import { AppError, isUniqueConstraintError } from './errors.js';
import {
  assertCanCancel,
  assertCanRegister,
  publicEvent,
} from './event-policy.js';

const MAX_PREFERENCE_FIELDS = 20;
const MAX_PREFERENCES_BYTES = 4_096;

function bookingId(memberId, eventId) {
  return `${eventId}::${memberId}`;
}

function invalidBookingInput(message) {
  return new AppError(400, 'invalid_booking_input', message);
}

export function normaliseDietaryChoice(value) {
  if (value !== 'Veg' && value !== 'Non-veg') {
    throw new AppError(
      400,
      'invalid_dietary_choice',
      'Choose either Veg or Non-veg.',
    );
  }
  return value;
}

function normalisePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalidBookingInput('Booking details must be a JSON object.');
  }

  const buggyRequired = input.buggyRequired ?? false;
  if (typeof buggyRequired !== 'boolean') {
    throw invalidBookingInput('Buggy required must be true or false.');
  }

  const dietaryRequirements = normaliseDietaryChoice(
    input.dietaryRequirements,
  );

  const extra = input.preferences ?? {};
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
    throw invalidBookingInput('Booking preferences must be a JSON object.');
  }
  const entries = Object.entries(extra);
  if (entries.length > MAX_PREFERENCE_FIELDS) {
    throw invalidBookingInput('Too many booking preference fields were supplied.');
  }

  const allowedExtra = {};
  for (const [key, value] of entries) {
    if (!/^[a-z][a-z0-9_]{0,49}$/i.test(key)) {
      throw invalidBookingInput('A booking preference field name is invalid.');
    }
    if (typeof value === 'string') {
      if (value.length > 500) {
        throw invalidBookingInput('A booking preference value is too long.');
      }
      allowedExtra[key] = value;
    } else if (typeof value === 'boolean') {
      allowedExtra[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      allowedExtra[key] = value;
    } else {
      throw invalidBookingInput('A booking preference value has an invalid type.');
    }
  }
  if (
    new TextEncoder().encode(JSON.stringify(allowedExtra)).length
    > MAX_PREFERENCES_BYTES
  ) {
    throw invalidBookingInput('Booking preferences are too large.');
  }

  return { buggyRequired, dietaryRequirements, preferences: allowedExtra };
}

async function getEvent(db, eventId) {
  const event = await db.prepare(
    `SELECT e.*,
            (SELECT COUNT(*)
             FROM bookings b
             WHERE b.event_id = e.id AND b.status = 'registered')
              AS attendee_count
     FROM events e
     WHERE e.id = ?`,
  ).bind(eventId).first();
  if (!event) throw new AppError(404, 'event_not_found', 'Event not found.');
  return event;
}

async function getBooking(db, memberId, eventId) {
  return db.prepare(
    'SELECT * FROM bookings WHERE member_id = ? AND event_id = ?',
  ).bind(memberId, eventId).first();
}

export async function listEventsForMember(db, memberId, now = new Date()) {
  const result = await db.prepare(
    `SELECT e.*,
            (SELECT COUNT(*)
             FROM bookings registered
             WHERE registered.event_id = e.id
               AND registered.status = 'registered') AS attendee_count,
            b.status AS booking_status, b.buggy_required,
            b.dietary_requirements, b.preferences_json, b.registered_at,
            b.cancelled_at, b.updated_at AS booking_updated_at
     FROM events e
     LEFT JOIN bookings b ON b.event_id = e.id AND b.member_id = ?
     WHERE e.status <> 'draft'
     ORDER BY e.event_date ASC, e.title ASC`,
  ).bind(memberId).all();

  return result.results
    .map((row) => {
      const booking = row.booking_status
        ? {
            status: row.booking_status,
            buggy_required: row.buggy_required,
            dietary_requirements: row.dietary_requirements,
            preferences_json: row.preferences_json,
            registered_at: row.registered_at,
            cancelled_at: row.cancelled_at,
            updated_at: row.booking_updated_at,
          }
        : null;
      return publicEvent(row, booking, now);
    })
    .filter((event) => event.availability.visibility === 'visible');
}

export async function getEventForMember(db, memberId, eventId, now = new Date()) {
  const event = await getEvent(db, eventId);
  const booking = await getBooking(db, memberId, eventId);
  const response = publicEvent(event, booking, now);
  if (response.availability.visibility !== 'visible') {
    throw new AppError(404, 'event_not_found', 'Event not found.');
  }
  return response;
}

export async function registerMember(
  db,
  { memberId, eventId, input, actorId = memberId, now = new Date() },
) {
  const event = await getEvent(db, eventId);
  assertCanRegister(event, now);
  const existing = await getBooking(db, memberId, eventId);
  if (existing?.status === 'registered') {
    throw new AppError(
      409,
      'already_registered',
      'You are already registered for this event.',
    );
  }

  const preferences = normalisePreferences(input || {});
  const id = existing?.id || bookingId(memberId, eventId);
  const nextVersion = Number(existing?.version || 0) + 1;
  const timestamp = now.toISOString();
  const after = {
    id,
    memberId,
    eventId,
    status: 'registered',
    buggyRequired: preferences.buggyRequired,
    dietaryRequirements: preferences.dietaryRequirements,
    preferences: preferences.preferences,
    registeredAt: timestamp,
    cancelledAt: null,
    updatedAt: timestamp,
    version: nextVersion,
  };
  const auditId = `register:${id}:${nextVersion}`;
  const outboxKey = `booking:${id}:${nextVersion}`;

  const guard = `e.id = ?
       AND e.source_type = 'google_sheet'
       AND e.status IN ('published', 'open')
       AND (e.publication_at IS NULL OR e.publication_at <= ?)
       AND e.registration_opens_at IS NOT NULL
       AND e.registration_opens_at <= ?
       AND e.registration_closes_at IS NOT NULL
       AND e.registration_closes_at > ?
       AND e.cancellation_closes_at IS NOT NULL
       AND e.cancellation_closes_at > ?`;
  const write = existing
    ? db.prepare(
        `UPDATE bookings
         SET status = 'registered', buggy_required = ?,
             dietary_requirements = ?, preferences_json = ?,
             registered_at = ?, cancelled_at = NULL, updated_at = ?,
             version = ?
         WHERE id = ? AND status = 'cancelled' AND version = ?
           AND EXISTS (SELECT 1 FROM events e WHERE ${guard})`,
      ).bind(
        preferences.buggyRequired ? 1 : 0,
        preferences.dietaryRequirements || null,
        JSON.stringify(preferences.preferences),
        timestamp,
        timestamp,
        nextVersion,
        id,
        existing.version,
        eventId,
        timestamp,
        timestamp,
        timestamp,
        timestamp,
      )
    : db.prepare(
        `INSERT INTO bookings
           (id, member_id, event_id, status, buggy_required,
            dietary_requirements, preferences_json, registered_at,
            cancelled_at, updated_at, version)
         SELECT ?, ?, e.id, 'registered', ?, ?, ?, ?, NULL, ?, ?
         FROM events e WHERE ${guard}`,
      ).bind(
        id,
        memberId,
        preferences.buggyRequired ? 1 : 0,
        preferences.dietaryRequirements || null,
        JSON.stringify(preferences.preferences),
        timestamp,
        timestamp,
        nextVersion,
        eventId,
        timestamp,
        timestamp,
        timestamp,
        timestamp,
      );

  try {
    const results = await db.batch([
      write,
      db.prepare(
        `INSERT INTO booking_audit
           (id, booking_id, actor_member_id, action, before_json,
            after_json, created_at)
         SELECT ?, b.id, ?, 'registered', ?, ?, ?
         FROM bookings b
         WHERE b.id = ? AND b.status = 'registered'
           AND b.version = ? AND b.updated_at = ?`,
      ).bind(
        auditId,
        actorId,
        existing ? JSON.stringify(existing) : null,
        JSON.stringify(after),
        timestamp,
        id,
        nextVersion,
        timestamp,
      ),
      db.prepare(
        `INSERT INTO integration_outbox
           (id, idempotency_key, aggregate_type, aggregate_id, event_type,
            payload_json, status, attempts, created_at, updated_at)
         SELECT ?, ?, 'booking', b.id, 'booking.registered', ?,
                'pending', 0, ?, ?
         FROM bookings b
         WHERE b.id = ? AND b.status = 'registered'
           AND b.version = ? AND b.updated_at = ?`,
      ).bind(
        crypto.randomUUID(),
        outboxKey,
        JSON.stringify(after),
        timestamp,
        timestamp,
        id,
        nextVersion,
        timestamp,
      ),
    ]);
    if (!results[0]?.meta?.changes) {
      throw new AppError(
        409,
        'registration_unavailable',
        'Registration is no longer available for this event.',
      );
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        409,
        'already_registered',
        'You are already registered for this event.',
      );
    }
    throw error;
  }

  return after;
}

export async function cancelMember(
  db,
  { memberId, eventId, actorId = memberId, now = new Date() },
) {
  const event = await getEvent(db, eventId);
  assertCanCancel(event, now);
  const existing = await getBooking(db, memberId, eventId);
  if (!existing || existing.status !== 'registered') {
    throw new AppError(
      409,
      'no_active_booking',
      'There is no active booking to cancel.',
    );
  }

  const timestamp = now.toISOString();
  const nextVersion = Number(existing.version) + 1;
  const after = {
    ...existing,
    status: 'cancelled',
    cancelled_at: timestamp,
    updated_at: timestamp,
    version: nextVersion,
  };
  const auditId = `cancel:${existing.id}:${nextVersion}`;
  const outboxKey = `booking:${existing.id}:${nextVersion}`;

  try {
    const results = await db.batch([
      db.prepare(
        `UPDATE bookings
         SET status = 'cancelled', cancelled_at = ?, updated_at = ?, version = ?
         WHERE id = ? AND status = 'registered' AND version = ?
           AND EXISTS (
             SELECT 1 FROM events e
             WHERE e.id = ? AND e.source_type = 'google_sheet'
               AND e.status IN ('published', 'open', 'closed')
               AND e.cancellation_closes_at IS NOT NULL
               AND e.cancellation_closes_at > ?
           )`,
      ).bind(
        timestamp,
        timestamp,
        nextVersion,
        existing.id,
        existing.version,
        eventId,
        timestamp,
      ),
      db.prepare(
        `INSERT INTO booking_audit
           (id, booking_id, actor_member_id, action, before_json,
            after_json, created_at)
         SELECT ?, b.id, ?, 'cancelled', ?, ?, ?
         FROM bookings b
         WHERE b.id = ? AND b.status = 'cancelled'
           AND b.version = ? AND b.updated_at = ?`,
      ).bind(
        auditId,
        actorId,
        JSON.stringify(existing),
        JSON.stringify(after),
        timestamp,
        existing.id,
        nextVersion,
        timestamp,
      ),
      db.prepare(
        `INSERT INTO integration_outbox
           (id, idempotency_key, aggregate_type, aggregate_id, event_type,
            payload_json, status, attempts, created_at, updated_at)
         SELECT ?, ?, 'booking', b.id, 'booking.cancelled', ?,
                'pending', 0, ?, ?
         FROM bookings b
         WHERE b.id = ? AND b.status = 'cancelled'
           AND b.version = ? AND b.updated_at = ?`,
      ).bind(
        crypto.randomUUID(),
        outboxKey,
        JSON.stringify(after),
        timestamp,
        timestamp,
        existing.id,
        nextVersion,
        timestamp,
      ),
    ]);
    if (!results[0]?.meta?.changes) {
      throw new AppError(
        409,
        'cancellation_closed',
        'Cancellation is no longer available for this event.',
      );
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        409,
        'no_active_booking',
        'There is no active booking to cancel.',
      );
    }
    throw error;
  }

  return after;
}
