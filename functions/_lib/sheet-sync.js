import { AppError } from './errors.js';

export const DEFAULT_CANCELLATION_CUTOFF_DAYS = 7;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function value(record, ...names) {
  for (const name of names) {
    const found = record[name];
    if (found !== undefined && String(found).trim() !== '') {
      return String(found).trim();
    }
  }
  return null;
}

function parseEventDate(input) {
  const match = String(input || '').trim().match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/,
  );
  if (!match) return null;
  const months = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const month = months[match[2].toLowerCase()];
  if (!month) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function optionalIso(valueToParse, field, rowNumber) {
  if (!valueToParse) return null;
  const parsed = new Date(valueToParse);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      422,
      'invalid_sheet_data',
      `Row ${rowNumber} has an invalid ${field} timestamp.`,
    );
  }
  return parsed.toISOString();
}

function cancellationCutoff(eventDate, timezone, days) {
  const [year, month, day] = eventDate.split('-').map(Number);
  const cutoffDate = new Date(Date.UTC(year, month - 1, day - days));
  const targetUtc = Date.UTC(
    cutoffDate.getUTCFullYear(),
    cutoffDate.getUTCMonth(),
    cutoffDate.getUTCDate(),
    23,
    59,
    59,
  );
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let guess = targetUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess -= representedUtc - targetUtc;
  }
  return new Date(guess).toISOString();
}

function cutoffDays(valueToParse) {
  if (valueToParse === undefined || valueToParse === null || valueToParse === '') {
    return DEFAULT_CANCELLATION_CUTOFF_DAYS;
  }
  const parsed = Number(valueToParse);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) {
    throw new AppError(
      500,
      'invalid_configuration',
      'DEFAULT_CANCELLATION_CUTOFF_DAYS must be an integer from 0 to 365.',
    );
  }
  return parsed;
}

function normaliseStatus(input) {
  const status = String(input || '').trim().toLowerCase();
  if (status === 'closed') return 'closed';
  if (status === 'completed') return 'completed';
  if (status === 'draft') return 'draft';
  return 'published';
}

export function parseFixtureSheet(csvText, options = {}) {
  const defaultCutoffDays = cutoffDays(options.defaultCancellationCutoffDays);
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new AppError(
      422,
      'invalid_sheet_data',
      'The fixture sheet has no event rows.',
    );
  }
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const records = [];
  const ids = new Set();

  for (let index = 1; index < rows.length; index += 1) {
    const record = {};
    headers.forEach((header, cellIndex) => {
      record[header] = String(rows[index][cellIndex] || '').trim();
    });
    const rowNumber = index + 1;
    const id = value(record, 'ID', 'Id', 'id');
    const title = value(record, 'Event', 'Title');
    const venue = value(record, 'Venue');
    const eventDate = parseEventDate(value(record, 'Date', 'EventDate'));

    if (!id || !title || !venue || !eventDate) {
      throw new AppError(
        422,
        'invalid_sheet_data',
        `Row ${rowNumber} must contain a stable ID, event title, venue and valid date.`,
      );
    }
    if (ids.has(id)) {
      throw new AppError(
        422,
        'invalid_sheet_data',
        `The fixture sheet contains duplicate event ID "${id}".`,
      );
    }
    ids.add(id);

    const bookingFields = value(record, 'BookingFields', 'Booking Fields');
    if (bookingFields) {
      try {
        JSON.parse(bookingFields);
      } catch {
        throw new AppError(
          422,
          'invalid_sheet_data',
          `Row ${rowNumber} has invalid BookingFields JSON.`,
        );
      }
    }

    const timezone = value(record, 'Timezone') || 'Europe/London';
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
    } catch {
      throw new AppError(
        422,
        'invalid_sheet_data',
        `Row ${rowNumber} has an invalid Timezone.`,
      );
    }
    const explicitCancellationClosesAt = optionalIso(
      value(record, 'CancellationClosesAt', 'Cancellation Closes At'),
      'CancellationClosesAt',
      rowNumber,
    );

    records.push({
      id,
      sourceKey: id,
      title,
      venue,
      eventDate,
      meetTime: value(record, 'MeetTime', 'Meet Time'),
      teeTime: value(record, 'TeeTime', 'Tee Time'),
      cost: value(record, 'Cost'),
      description: value(record, 'Details', 'Description'),
      joiningInformation: value(
        record,
        'JoiningInformation',
        'Joining Information',
      ),
      publicationAt: optionalIso(
        value(record, 'PublicationAt', 'Publication At'),
        'PublicationAt',
        rowNumber,
      ),
      registrationOpensAt: optionalIso(
        value(record, 'RegistrationOpensAt', 'Registration Opens At'),
        'RegistrationOpensAt',
        rowNumber,
      ),
      registrationClosesAt: optionalIso(
        value(record, 'RegistrationClosesAt', 'Registration Closes At'),
        'RegistrationClosesAt',
        rowNumber,
      ),
      cancellationClosesAt: explicitCancellationClosesAt
        || cancellationCutoff(eventDate, timezone, defaultCutoffDays),
      hasExplicitCancellationClosesAt: Boolean(explicitCancellationClosesAt),
      timezone,
      status: normaliseStatus(value(record, 'Status')),
      bookingFields: bookingFields || null,
    });
  }
  return records;
}

export async function syncFixtureSheet(
  db,
  csvText,
  now = new Date(),
  options = {},
) {
  const events = parseFixtureSheet(csvText, options);
  const timestamp = now.toISOString();
  const runId = crypto.randomUUID();
  const statements = [
    db.prepare(
      `INSERT INTO sync_runs
         (id, sync_type, status, started_at)
       VALUES (?, 'fixtures', 'running', ?)`,
    ).bind(runId, timestamp),
  ];

  for (const event of events) {
    statements.push(
      db.prepare(
        `INSERT INTO events
           (id, title, venue, event_date, meet_time, tee_time, cost,
            description, joining_information, publication_at,
            registration_opens_at, registration_closes_at,
            cancellation_closes_at, timezone, status, booking_fields_json,
            source_type, source_key, last_synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, '{}'),
                 'google_sheet', ?, ?, ?, ?)
         ON CONFLICT(source_type, source_key) DO UPDATE SET
           title = excluded.title,
           venue = excluded.venue,
           event_date = excluded.event_date,
           meet_time = excluded.meet_time,
           tee_time = excluded.tee_time,
           cost = excluded.cost,
           description = excluded.description,
           joining_information = COALESCE(
             excluded.joining_information, events.joining_information
           ),
           publication_at = COALESCE(excluded.publication_at, events.publication_at),
           registration_opens_at = COALESCE(
             excluded.registration_opens_at, events.registration_opens_at
           ),
           registration_closes_at = COALESCE(
             excluded.registration_closes_at, events.registration_closes_at
           ),
           cancellation_closes_at = CASE
             WHEN ? = 1 THEN excluded.cancellation_closes_at
             ELSE COALESCE(
               events.cancellation_closes_at, excluded.cancellation_closes_at
             )
           END,
           timezone = COALESCE(excluded.timezone, events.timezone),
           status = CASE
             WHEN events.status IN ('open', 'closed', 'completed')
               AND excluded.status = 'published' THEN events.status
             ELSE excluded.status
           END,
           booking_fields_json = CASE
             WHEN ? IS NULL THEN events.booking_fields_json
             ELSE excluded.booking_fields_json
           END,
           last_synced_at = excluded.last_synced_at,
           updated_at = excluded.updated_at`,
      ).bind(
        event.id,
        event.title,
        event.venue,
        event.eventDate,
        event.meetTime,
        event.teeTime,
        event.cost,
        event.description,
        event.joiningInformation,
        event.publicationAt,
        event.registrationOpensAt,
        event.registrationClosesAt,
        event.cancellationClosesAt,
        event.timezone,
        event.status,
        event.bookingFields,
        event.sourceKey,
        timestamp,
        timestamp,
        timestamp,
        event.hasExplicitCancellationClosesAt ? 1 : 0,
        event.bookingFields,
      ),
    );
  }

  statements.push(
    db.prepare(
      `UPDATE sync_runs
       SET status = 'success', completed_at = ?, summary_json = ?
       WHERE id = ?`,
    ).bind(
      timestamp,
      JSON.stringify({ eventCount: events.length }),
      runId,
    ),
  );

  await db.batch(statements);
  return { runId, eventCount: events.length, completedAt: timestamp };
}

export async function recordFailedSync(db, error, now = new Date()) {
  const timestamp = now.toISOString();
  const runId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO sync_runs
       (id, sync_type, status, started_at, completed_at, error_message)
     VALUES (?, 'fixtures', 'failed', ?, ?, ?)`,
  ).bind(
    runId,
    timestamp,
    timestamp,
    String(error?.message || error).slice(0, 1_000),
  ).run();
  return runId;
}
