import { AppError, isUniqueConstraintError } from './errors.js';
import {
  assertCanCancel,
  assertCanRegister,
  publicEvent,
} from './event-policy.js';

function bookingId(memberId, eventId) {
  return `${eventId}::${memberId}`;
}

function normalisePreferences(input) {
  const dietaryRequirements = String(input.dietaryRequirements || '').trim();
  if (dietaryRequirements.length > 500) {
    throw new AppError(
      400,
      'invalid_dietary_requirements',
      'Dietary requirements must be 500 characters or fewer.',
    );
  }

  const allowedExtra = {};
  const extra = input.preferences && typeof input.preferences === 'object'
    ? input.preferences
    : {};
  for (const [key, value] of Object.entries(extra)) {
    if (!/^[a-z][a-z0-9_]{0,49}$/i.test(key)) continue;
    if (typeof value === 'string') allowedExtra[key] = value.slice(0, 500);
    else if (typeof value === 'boolean' || typeof value === 'number') {
      allowedExtra[key] = value;
    }
  }

  return {
    buggyRequired: Boolean(input.buggyRequired),
    dietaryRequirements,
    preferences: allowedExtra,
  };
}

async function getEvent(db, eventId) {
  const event = await db.prepare(
    'SELECT * FROM events WHERE id = ?',
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
    `SELECT e.*, b.status AS booking_status, b.buggy_required,
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

  const write = existing
    ? db.prepare(
        `UPDATE bookings
         SET status = 'registered', buggy_required = ?,
             dietary_requirements = ?, preferences_json = ?,
             registered_at = ?, cancelled_at = NULL, updated_at = ?,
             version = ?
         WHERE id = ? AND status = 'cancelled' AND version = ?`,
      ).bind(
        preferences.buggyRequired ? 1 : 0,
        preferences.dietaryRequirements || null,
        JSON.stringify(preferences.preferences),
        timestamp,
        timestamp,
        nextVersion,
        id,
        existing.version,
      )
    : db.prepare(
        `INSERT INTO bookings
           (id, member_id, event_id, status, buggy_required,
            dietary_requirements, preferences_json, registered_at,
            cancelled_at, updated_at, version)
         VALUES (?, ?, ?, 'registered', ?, ?, ?, ?, NULL, ?, ?)`,
      ).bind(
        id,
        memberId,
        eventId,
        preferences.buggyRequired ? 1 : 0,
        preferences.dietaryRequirements || null,
        JSON.stringify(preferences.preferences),
        timestamp,
        timestamp,
        nextVersion,
      );

  try {
    await db.batch([
      write,
      db.prepare(
        `INSERT INTO booking_audit
           (id, booking_id, actor_member_id, action, before_json,
            after_json, created_at)
         VALUES (?, ?, ?, 'registered', ?, ?, ?)`,
      ).bind(
        auditId,
        id,
        actorId,
        existing ? JSON.stringify(existing) : null,
        JSON.stringify(after),
        timestamp,
      ),
      db.prepare(
        `INSERT INTO integration_outbox
           (id, idempotency_key, aggregate_type, aggregate_id, event_type,
            payload_json, status, attempts, created_at, updated_at)
         VALUES (?, ?, 'booking', ?, 'booking.registered', ?, 'pending', 0, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        outboxKey,
        id,
        JSON.stringify(after),
        timestamp,
        timestamp,
      ),
    ]);
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
    await db.batch([
      db.prepare(
        `UPDATE bookings
         SET status = 'cancelled', cancelled_at = ?, updated_at = ?, version = ?
         WHERE id = ? AND status = 'registered' AND version = ?`,
      ).bind(timestamp, timestamp, nextVersion, existing.id, existing.version),
      db.prepare(
        `INSERT INTO booking_audit
           (id, booking_id, actor_member_id, action, before_json,
            after_json, created_at)
         VALUES (?, ?, ?, 'cancelled', ?, ?, ?)`,
      ).bind(
        auditId,
        existing.id,
        actorId,
        JSON.stringify(existing),
        JSON.stringify(after),
        timestamp,
      ),
      db.prepare(
        `INSERT INTO integration_outbox
           (id, idempotency_key, aggregate_type, aggregate_id, event_type,
            payload_json, status, attempts, created_at, updated_at)
         VALUES (?, ?, 'booking', ?, 'booking.cancelled', ?, 'pending', 0, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        outboxKey,
        existing.id,
        JSON.stringify(after),
        timestamp,
        timestamp,
      ),
    ]);
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

