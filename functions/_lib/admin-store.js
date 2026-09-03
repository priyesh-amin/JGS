import { AppError } from './errors.js';
import { hashPassword } from './crypto.js';
import { normaliseEmail, requireString } from './http.js';
import { normaliseDietaryChoice } from './booking-store.js';

function isRecoveryAccount(member, recoveryEmailValue) {
  if (!member || member.username || !recoveryEmailValue) return false;
  try {
    return normaliseEmail(member.email) === normaliseEmail(recoveryEmailValue);
  } catch {
    return false;
  }
}

function assertGenericAccountMutationAllowed(member, actor, recoveryEmailValue) {
  if (member.username || (actor?.username && isRecoveryAccount(
    member,
    recoveryEmailValue,
  ))) {
    throw new AppError(404, 'member_not_found', 'Member not found.');
  }
}

export async function listMembers(db, actor, recoveryEmailValue) {
  const result = await db.prepare(
    `SELECT id, email, username, display_name, role, status, must_change_password,
            finance_url, google_subject, password_login_enabled,
            account_source, created_at, updated_at
     FROM members ORDER BY display_name COLLATE NOCASE`,
  ).all();
  return result.results
    .filter((member) => !(
      actor?.username && isRecoveryAccount(member, recoveryEmailValue)
    ))
    .map(mapMember);
}

export async function createMember(db, input, now = new Date()) {
  const email = normaliseEmail(input.email);
  const displayName = requireString(input.displayName, 'Display name', {
    max: 120,
  });
  const role = input.role === 'admin' ? 'admin' : 'member';
  const status = input.status === 'active' ? 'active' : 'disabled';
  const password = await hashPassword(input.temporaryPassword);
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const financeUrl = validateFinanceUrl(input.financeUrl);
  const mustChangePassword = Boolean(input.mustChangePassword);

  try {
    await db.prepare(
      `INSERT INTO members
         (id, email, display_name, role, status, password_hash, password_salt,
          password_iterations, must_change_password, finance_url,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      email,
      displayName,
      role,
      status,
      password.hash,
      password.salt,
      password.iterations,
      mustChangePassword ? 1 : 0,
      financeUrl,
      timestamp,
      timestamp,
    ).run();
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE constraint failed')) {
      throw new AppError(
        409,
        'email_exists',
        'A member account already uses this email address.',
      );
    }
    throw error;
  }

  return {
    id,
    email,
    displayName,
    role,
    status,
    mustChangePassword,
    financeUrl,
  };
}

export async function updateMember(
  db,
  memberId,
  input,
  actor,
  recoveryEmailValue,
  now = new Date(),
) {
  const existing = await db.prepare(
    'SELECT * FROM members WHERE id = ?',
  ).bind(memberId).first();
  if (!existing) throw new AppError(404, 'member_not_found', 'Member not found.');
  assertGenericAccountMutationAllowed(existing, actor, recoveryEmailValue);

  const nextRole = input.role === undefined
    ? existing.role
    : input.role === 'admin' ? 'admin' : 'member';
  const nextStatus = input.status === undefined
    ? existing.status
    : input.status === 'active' ? 'active' : 'disabled';
  if (actor.id === memberId && (nextRole !== 'admin' || nextStatus !== 'active')) {
    throw new AppError(
      409,
      'cannot_remove_own_access',
      'You cannot remove your own active administrator access.',
    );
  }

  const displayName = input.displayName === undefined
    ? existing.display_name
    : requireString(input.displayName, 'Display name', { max: 120 });
  const email = input.email === undefined
    ? existing.email
    : normaliseEmail(input.email);
  const emailChanged = email !== normaliseEmail(existing.email);
  const financeUrl = input.financeUrl === undefined
    ? existing.finance_url
    : validateFinanceUrl(input.financeUrl);
  const timestamp = now.toISOString();

  const update = emailChanged
    ? db.prepare(
      `UPDATE members
       SET email = ?, display_name = ?, role = ?, status = ?, finance_url = ?,
           google_subject = NULL, google_linked_at = NULL, updated_at = ?
       WHERE id = ? AND username IS NULL`,
    ).bind(
      email,
      displayName,
      nextRole,
      nextStatus,
      financeUrl,
      timestamp,
      memberId,
    )
    : db.prepare(
      `UPDATE members
       SET display_name = ?, role = ?, status = ?, finance_url = ?, updated_at = ?
       WHERE id = ? AND username IS NULL`,
    ).bind(
      displayName,
      nextRole,
      nextStatus,
      financeUrl,
      timestamp,
      memberId,
    );

  try {
    await db.batch([
      update,
      ...(emailChanged || nextStatus === 'disabled'
        ? [db.prepare('DELETE FROM sessions WHERE member_id = ?').bind(memberId)]
        : []),
      ...(emailChanged
        ? [
          db.prepare(
            'DELETE FROM password_reset_tokens WHERE member_id = ?',
          ).bind(memberId),
        ]
        : []),
    ]);
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE constraint failed')) {
      throw new AppError(
        409,
        'email_exists',
        'A member account already uses this email address.',
      );
    }
    throw error;
  }

  if (emailChanged) {
    console.info('member_email_changed', {
      actorMemberId: actor.id,
      targetMemberId: memberId,
      changedAt: timestamp,
    });
  }

  return {
    id: memberId,
    email,
    username: existing.username || null,
    displayName,
    role: nextRole,
    status: nextStatus,
    mustChangePassword: Boolean(existing.must_change_password),
    financeUrl,
  };
}

export async function resetMemberPassword(
  db,
  memberId,
  temporaryPassword,
  actor,
  recoveryEmailValue,
) {
  const target = await db.prepare(
    'SELECT id, email, username FROM members WHERE id = ?',
  ).bind(memberId).first();
  if (!target) {
    throw new AppError(404, 'member_not_found', 'Member not found.');
  }
  assertGenericAccountMutationAllowed(target, actor, recoveryEmailValue);
  const password = await hashPassword(temporaryPassword);
  const timestamp = new Date().toISOString();
  const result = await db.batch([
    db.prepare(
      `UPDATE members
       SET password_hash = ?, password_salt = ?, password_iterations = ?,
           must_change_password = 0, password_login_enabled = 1,
           updated_at = ?
       WHERE id = ? AND username IS NULL`,
    ).bind(
      password.hash,
      password.salt,
      password.iterations,
      timestamp,
      memberId,
    ),
    db.prepare('DELETE FROM sessions WHERE member_id = ?').bind(memberId),
  ]);
  if (!result[0]?.meta?.changes) {
    throw new AppError(404, 'member_not_found', 'Member not found.');
  }
  return { id: memberId, mustChangePassword: false };
}

export async function resetOperationalAdminPassword(
  db,
  actor,
  newPassword,
  recoveryEmailValue,
) {
  const recoveryEmail = normaliseEmail(recoveryEmailValue);
  if (
    actor.username
    || normaliseEmail(actor.email) !== recoveryEmail
    || actor.role !== 'admin'
  ) {
    throw new AppError(
      403,
      'recovery_admin_required',
      'The private recovery administrator is required.',
    );
  }
  const target = await db.prepare(
    `SELECT id FROM members
     WHERE username = 'admin' AND role = 'admin' AND status = 'active'`,
  ).first();
  if (!target) {
    throw new AppError(
      409,
      'operational_admin_unavailable',
      'Operational administrator recovery is unavailable.',
    );
  }
  const password = await hashPassword(newPassword);
  const timestamp = new Date().toISOString();
  const result = await db.batch([
    db.prepare(
      `UPDATE members
       SET password_hash = ?, password_salt = ?, password_iterations = ?,
           must_change_password = 0, updated_at = ?
       WHERE id = ? AND username = 'admin'`,
    ).bind(
      password.hash,
      password.salt,
      password.iterations,
      timestamp,
      target.id,
    ),
    db.prepare('DELETE FROM sessions WHERE member_id = ?').bind(target.id),
    db.prepare(
      `INSERT INTO account_security_audit
         (id, actor_member_id, actor_kind, target_member_id, action, created_at)
       VALUES (?, ?, 'member', ?, 'operational_admin_password_reset', ?)`,
    ).bind(crypto.randomUUID(), actor.id, target.id, timestamp),
  ]);
  if (!result[0]?.meta?.changes) {
    throw new AppError(
      409,
      'operational_admin_unavailable',
      'Operational administrator recovery is unavailable.',
    );
  }
  return { username: 'admin', sessionsRevoked: true };
}

export async function listAdminEvents(db) {
  const result = await db.prepare(
    `SELECT e.*,
            SUM(CASE WHEN b.status = 'registered' THEN 1 ELSE 0 END)
              AS confirmed_count
     FROM events e
     LEFT JOIN bookings b ON b.event_id = e.id
     GROUP BY e.id
     ORDER BY e.event_date ASC`,
  ).all();
  return result.results;
}

export async function updateEvent(db, eventId, input) {
  const existing = await db.prepare(
    'SELECT * FROM events WHERE id = ?',
  ).bind(eventId).first();
  if (!existing) throw new AppError(404, 'event_not_found', 'Event not found.');
  if (existing.source_type === 'google_sheet') {
    throw new AppError(
      409,
      'source_managed_event',
      'Update this fixture in the authoritative spreadsheet.',
    );
  }

  const allowedStatuses = ['draft', 'published', 'open', 'closed', 'completed'];
  const status = input.status === undefined
    ? existing.status
    : allowedStatuses.includes(input.status) ? input.status : null;
  if (!status) throw new AppError(400, 'invalid_status', 'Invalid event status.');

  const timestamps = {};
  for (const field of [
    'publicationAt',
    'registrationOpensAt',
    'registrationClosesAt',
    'cancellationClosesAt',
  ]) {
    timestamps[field] = input[field] === undefined
      ? existing[toSnake(field)]
      : validateOptionalTimestamp(input[field], field);
  }
  if (
    timestamps.registrationOpensAt
    && timestamps.registrationClosesAt
    && timestamps.registrationOpensAt >= timestamps.registrationClosesAt
  ) {
    throw new AppError(
      400,
      'invalid_registration_window',
      'Registration must open before it closes.',
    );
  }

  const timezone = input.timezone === undefined
    ? existing.timezone
    : validateTimezone(input.timezone);
  const bookingFields = input.bookingFields === undefined
    ? existing.booking_fields_json
    : JSON.stringify(input.bookingFields || {});
  const timestamp = new Date().toISOString();

  await db.prepare(
    `UPDATE events
     SET status = ?, publication_at = ?, registration_opens_at = ?,
         registration_closes_at = ?, cancellation_closes_at = ?,
         timezone = ?, booking_fields_json = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    status,
    timestamps.publicationAt,
    timestamps.registrationOpensAt,
    timestamps.registrationClosesAt,
    timestamps.cancellationClosesAt,
    timezone,
    bookingFields,
    timestamp,
    eventId,
  ).run();
  return db.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first();
}

export async function confirmedAttendees(db, eventId) {
  const event = await db.prepare(
    'SELECT id, title, event_date FROM events WHERE id = ?',
  ).bind(eventId).first();
  if (!event) throw new AppError(404, 'event_not_found', 'Event not found.');
  const result = await db.prepare(
    `SELECT b.id AS booking_id, b.status, b.buggy_required,
            b.dietary_requirements, b.preferences_json, b.registered_at,
            b.updated_at, b.version, m.id AS member_id, m.email,
            m.display_name
     FROM bookings b
     JOIN members m ON m.id = b.member_id
     WHERE b.event_id = ? AND b.status = 'registered'
     ORDER BY m.display_name COLLATE NOCASE`,
  ).bind(eventId).all();
  return { event, attendees: result.results };
}

export async function correctBooking(
  db,
  bookingId,
  input,
  actor,
  now = new Date(),
) {
  const existing = await db.prepare(
    `SELECT b.*, m.email, m.display_name, e.title AS event_title
     FROM bookings b
     JOIN members m ON m.id = b.member_id
     JOIN events e ON e.id = b.event_id
     WHERE b.id = ?`,
  ).bind(bookingId).first();
  if (!existing) {
    throw new AppError(404, 'booking_not_found', 'Booking not found.');
  }

  const status = input.status === undefined
    ? existing.status
    : input.status === 'registered' || input.status === 'cancelled'
      ? input.status
      : null;
  if (!status) throw new AppError(400, 'invalid_status', 'Invalid booking status.');
  const dietaryRequirements = input.dietaryRequirements === undefined
    ? normaliseDietaryChoice(existing.dietary_requirements)
    : normaliseDietaryChoice(input.dietaryRequirements);
  const buggyRequired = input.buggyRequired === undefined
    ? Boolean(existing.buggy_required)
    : Boolean(input.buggyRequired);
  const preferences = input.preferences === undefined
    ? existing.preferences_json
    : JSON.stringify(input.preferences || {});
  const timestamp = now.toISOString();
  const nextVersion = Number(existing.version) + 1;
  const cancelledAt = status === 'cancelled'
    ? existing.cancelled_at || timestamp
    : null;
  const after = {
    id: existing.id,
    memberId: existing.member_id,
    eventId: existing.event_id,
    status,
    buggyRequired,
    dietaryRequirements: dietaryRequirements || '',
    preferences: JSON.parse(preferences || '{}'),
    registeredAt: existing.registered_at,
    cancelledAt,
    updatedAt: timestamp,
    version: nextVersion,
  };

  try {
    await db.batch([
      db.prepare(
        `UPDATE bookings
         SET status = ?, buggy_required = ?, dietary_requirements = ?,
             preferences_json = ?, cancelled_at = ?, updated_at = ?, version = ?
         WHERE id = ? AND version = ?`,
      ).bind(
        status,
        buggyRequired ? 1 : 0,
        dietaryRequirements,
        preferences,
        cancelledAt,
        timestamp,
        nextVersion,
        existing.id,
        existing.version,
      ),
      db.prepare(
        `INSERT INTO booking_audit
           (id, booking_id, actor_member_id, action, before_json,
            after_json, created_at)
         VALUES (?, ?, ?, 'admin_corrected', ?, ?, ?)`,
      ).bind(
        `admin:${existing.id}:${nextVersion}`,
        existing.id,
        actor.id,
        JSON.stringify(existing),
        JSON.stringify(after),
        timestamp,
      ),
      db.prepare(
        `INSERT INTO integration_outbox
           (id, idempotency_key, aggregate_type, aggregate_id, event_type,
            payload_json, status, attempts, created_at, updated_at)
         VALUES (?, ?, 'booking', ?, 'booking.admin_corrected', ?,
                 'pending', 0, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        `booking:${existing.id}:${nextVersion}`,
        existing.id,
        JSON.stringify(after),
        timestamp,
        timestamp,
      ),
    ]);
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE constraint failed')) {
      throw new AppError(
        409,
        'booking_changed',
        'This booking changed while you were editing it. Refresh and try again.',
      );
    }
    throw error;
  }
  return after;
}

function mapMember(row) {
  return {
    id: row.id,
    email: row.username ? null : row.email,
    username: row.username || null,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
    financeUrl: row.finance_url || null,
    authenticationMethods: {
      google: Boolean(row.google_subject),
      password: row.password_login_enabled !== 0,
    },
    accountSource: row.account_source || 'manual',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateFinanceUrl(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'https:') throw new Error('not https');
    return url.toString();
  } catch {
    throw new AppError(
      400,
      'invalid_finance_url',
      'Finance links must be valid HTTPS URLs.',
    );
  }
}

function validateOptionalTimestamp(value, field) {
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'invalid_timestamp', `${field} is not a valid timestamp.`);
  }
  return parsed.toISOString();
}

function validateTimezone(value) {
  const timezone = String(value || '').trim();
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new AppError(400, 'invalid_timezone', 'Enter a valid IANA timezone.');
  }
}

function toSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
