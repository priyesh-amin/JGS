import { AppError } from './errors.js';
import { parseCsv } from './sheet-sync.js';

const CLASSIFICATIONS = [
  'bookable',
  'temporarily_unbookable',
  'withheld',
  'historical_archived',
];

function textValue(record, ...names) {
  for (const name of names) {
    const found = record[name];
    if (found !== undefined && String(found).trim() !== '') {
      return String(found).trim();
    }
  }
  return null;
}

function parseDate(input) {
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
  const year = Number(match[3]);
  const day = Number(match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function validCalendarDate(input) {
  const value = String(input || '');
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const uk = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!iso && !uk) return null;
  const year = Number(iso ? iso[1] : uk[3]);
  const month = Number(iso ? iso[2] : uk[2]);
  const day = Number(iso ? iso[3] : uk[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  ) ? { year, month, day } : null;
}

function timezoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const localAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function londonDateBoundary(input, endOfDay) {
  const date = validCalendarDate(input);
  if (!date) return null;
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;
  const wallTime = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    hour,
    minute,
    second,
    millisecond,
  );
  let instant = new Date(wallTime);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    instant = new Date(
      wallTime - timezoneOffsetMs(instant, 'Europe/London'),
    );
  }
  return instant.toISOString();
}

function parseIso(input, { allowDate = false, endOfDay = false } = {}) {
  if (!input) return { value: null, valid: true };
  if (
    allowDate
    && (
      /^\d{4}-\d{2}-\d{2}$/.test(input)
      || /^\d{2}\/\d{2}\/\d{4}$/.test(input)
    )
  ) {
    const value = londonDateBoundary(input, endOfDay);
    return value
      ? { value, valid: true }
      : { value: null, valid: false };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)
  ) {
    return { value: null, valid: false };
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime())
    ? { value: null, valid: false }
    : { value: parsed.toISOString(), valid: true };
}

function parseExpectedIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function issue(code, message, action) {
  return { code, message, action };
}

function classifyFixture(event, sourceStatus, issues, now) {
  const currentDate = now.toISOString().slice(0, 10);
  if (sourceStatus === 'completed' || event.eventDate < currentDate) {
    return 'historical_archived';
  }
  if (issues.length > 0 || sourceStatus === 'draft' || sourceStatus === 'closed') {
    return 'temporarily_unbookable';
  }
  if (
    !event.registrationOpensAt
    || !event.registrationClosesAt
    || !event.cancellationClosesAt
  ) {
    return 'temporarily_unbookable';
  }
  const currentTime = now.getTime();
  const opens = new Date(event.registrationOpensAt).getTime();
  const closes = new Date(event.registrationClosesAt).getTime();
  const cancellationCloses = new Date(event.cancellationClosesAt).getTime();
  return currentTime >= opens
    && currentTime < closes
    && currentTime < cancellationCloses
    ? 'bookable'
    : 'temporarily_unbookable';
}

function assessRow(record, rowNumber, now) {
  const id = textValue(record, 'ID', 'Id', 'id');
  const title = textValue(record, 'Event', 'Title');
  const venue = textValue(record, 'Venue');
  const eventDate = parseDate(textValue(record, 'Date', 'EventDate'));
  const issues = [];

  if (!id) {
    issues.push(issue(
      'missing_id',
      `Row ${rowNumber} has no stable fixture ID.`,
      'Add the fixture’s stable ID; do not reuse an ID from another row.',
    ));
  }
  if (!title) {
    issues.push(issue(
      'missing_title',
      `Row ${rowNumber} has no event title.`,
      'Add the approved event title.',
    ));
  }
  if (!venue) {
    issues.push(issue(
      'missing_venue',
      `Row ${rowNumber} has no venue.`,
      'Add the approved venue.',
    ));
  }
  if (!eventDate) {
    issues.push(issue(
      'invalid_date',
      `Row ${rowNumber} has no valid event date.`,
      'Enter the approved date in a format such as 19 Sep 2026.',
    ));
  }

  const sourceKey = id || `source-row-${rowNumber}`;
  const critical = issues.length > 0;
  if (critical) {
    return {
      rowNumber,
      sourceKey,
      classification: 'withheld',
      issues,
      actions: issues.map((entry) => entry.action),
      event: null,
    };
  }

  const timezone = textValue(record, 'Timezone') || 'Europe/London';
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format();
  } catch {
    issues.push(issue(
      'invalid_timezone',
      `Row ${rowNumber} has an invalid timezone.`,
      'Use an approved IANA timezone such as Europe/London.',
    ));
  }

  const timestamps = {};
  for (const [property, ...headers] of [
    ['publicationAt', 'PublicationAt', 'Publication At'],
    ['registrationOpensAt', 'RegistrationOpensAt', 'Registration Opens At'],
    ['registrationClosesAt', 'RegistrationClosesAt', 'Registration Closes At'],
    ['cancellationClosesAt', 'CancellationClosesAt', 'Cancellation Closes At'],
  ]) {
    const parsed = parseIso(textValue(record, ...headers), {
      allowDate: property !== 'publicationAt',
      endOfDay: ['registrationClosesAt', 'cancellationClosesAt'].includes(
        property,
      ),
    });
    timestamps[property] = parsed.value;
    if (!parsed.valid) {
      issues.push(issue(
        `invalid_${property}`,
        `Row ${rowNumber} has an invalid ${headers[0]} timestamp.`,
        property === 'publicationAt'
          ? `Enter an exact ${headers[0]} timestamp including its timezone.`
          : `Use DD/MM/YYYY, YYYY-MM-DD or an exact ${headers[0]} timestamp including its timezone.`,
      ));
    }
  }

  if (
    timestamps.registrationOpensAt
    && timestamps.registrationClosesAt
    && timestamps.registrationOpensAt >= timestamps.registrationClosesAt
  ) {
    issues.push(issue(
      'invalid_registration_window',
      `Row ${rowNumber} registration closes before it opens.`,
      'Correct the registration opening and closing dates or timestamps.',
    ));
    timestamps.registrationOpensAt = null;
    timestamps.registrationClosesAt = null;
  }

  if (
    timestamps.registrationClosesAt
    && timestamps.cancellationClosesAt
    && timestamps.cancellationClosesAt <= timestamps.registrationClosesAt
  ) {
    issues.push(issue(
      'invalid_cancellation_window',
      `Row ${rowNumber} cancellation must close after registration closes.`,
      'Set CancellationClosesAt to a date or timestamp after RegistrationClosesAt.',
    ));
    timestamps.cancellationClosesAt = null;
  }

  const bookingFields = textValue(record, 'BookingFields', 'Booking Fields');
  let bookingFieldsValid = true;
  if (bookingFields) {
    try {
      JSON.parse(bookingFields);
    } catch {
      bookingFieldsValid = false;
      issues.push(issue(
        'invalid_booking_fields',
        `Row ${rowNumber} has invalid BookingFields JSON.`,
        'Correct BookingFields JSON before opening this fixture.',
      ));
    }
  }

  const rawStatus = String(textValue(record, 'Status') || 'draft').toLowerCase();
  const recognisedStatuses = ['open', 'published', 'draft', 'closed', 'completed'];
  const sourceStatus = recognisedStatuses.includes(rawStatus) ? rawStatus : 'draft';
  if (!recognisedStatuses.includes(rawStatus)) {
    issues.push(issue(
      'invalid_status',
      `Row ${rowNumber} has an unsupported status.`,
      'Use Open, Published, Draft, Closed or Completed.',
    ));
  }

  const event = {
    id,
    sourceKey: id,
    title,
    venue,
    eventDate,
    meetTime: textValue(record, 'MeetTime', 'Meet Time'),
    teeTime: textValue(record, 'TeeTime', 'Tee Time'),
    cost: textValue(record, 'Cost'),
    description: textValue(record, 'Details', 'Description'),
    joiningInformation: textValue(
      record,
      'JoiningInformation',
      'Joining Information',
    ),
    ...timestamps,
    timezone,
    status: sourceStatus === 'completed'
      ? 'completed'
      : sourceStatus === 'closed'
        ? 'closed'
        : sourceStatus === 'draft' ? 'draft' : 'published',
    bookingFields: bookingFieldsValid ? (bookingFields || '{}') : null,
  };

  const classification = classifyFixture(event, sourceStatus, issues, now);
  if (
    classification === 'temporarily_unbookable'
    && (
      !event.registrationOpensAt
      || !event.registrationClosesAt
      || !event.cancellationClosesAt
    )
  ) {
    issues.push(issue(
      'registration_window_missing',
      `Row ${rowNumber} is missing a valid booking or cancellation window.`,
      'Add RegistrationOpensAt, RegistrationClosesAt and CancellationClosesAt as DD/MM/YYYY or YYYY-MM-DD dates, or exact timezone-bearing timestamps; Deadline text is not used for booking.',
    ));
  }
  if (
    classification === 'historical_archived'
    && sourceStatus !== 'completed'
  ) {
    issues.push(issue(
      'past_fixture_not_archived',
      `Row ${rowNumber} is in the past but is not marked Completed.`,
      'Mark this past fixture Completed in the Status column.',
    ));
  }

  if (
    issues.some((entry) => [
      'invalid_timezone',
      'invalid_publicationAt',
      'invalid_booking_fields',
    ].includes(entry.code))
  ) {
    return {
      rowNumber,
      sourceKey,
      classification: 'withheld',
      issues,
      actions: issues.map((entry) => entry.action),
      event: null,
    };
  }

  if (issues.some((entry) => entry.code.startsWith('invalid_'))) {
    event.status = 'draft';
  }
  if (classification === 'historical_archived') event.status = 'completed';

  return {
    rowNumber,
    sourceKey,
    classification,
    issues,
    actions: [...new Set(issues.map((entry) => entry.action))],
    event,
  };
}

export function assessFixtureSheet(csvText, now = new Date(), options = {}) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new AppError(
      422,
      'invalid_sheet_data',
      'The fixture sheet has no fixture rows.',
    );
  }
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const assessments = rows.slice(1).map((cells, index) => {
    const record = {};
    headers.forEach((header, cellIndex) => {
      record[header] = String(cells[cellIndex] || '').trim();
    });
    return assessRow(record, index + 2, now);
  });

  const expectedIds = parseExpectedIds(options.expectedFixtureIds);
  const expectedIdSet = new Set(expectedIds);
  const requiredExpectedCount = Number(options.requiredExpectedFixtureCount || 0);
  if (
    expectedIds.length === 0
    || expectedIdSet.size !== expectedIds.length
    || (requiredExpectedCount > 0 && expectedIds.length !== requiredExpectedCount)
  ) {
    throw new AppError(
      500,
      'invalid_configuration',
      'EXPECTED_FIXTURE_IDS must contain the complete unique approved fixture roster.',
    );
  }

  const byId = new Map();
  for (const assessment of assessments) {
    if (!assessment.sourceKey || assessment.sourceKey.startsWith('source-row-')) {
      continue;
    }
    const matches = byId.get(assessment.sourceKey) || [];
    matches.push(assessment);
    byId.set(assessment.sourceKey, matches);
  }
  for (const [id, matches] of byId) {
    if (matches.length < 2) continue;
    for (const assessment of matches) {
      assessment.event = null;
      assessment.classification = 'withheld';
      assessment.issues.push(issue(
        'duplicate_id',
        `Fixture ID "${id}" appears more than once.`,
        `Keep exactly one authoritative row with fixture ID "${id}".`,
      ));
      assessment.actions = [
        ...new Set(assessment.issues.map((entry) => entry.action)),
      ];
    }
  }

  for (const assessment of assessments) {
    if (
      !assessment.sourceKey
      || assessment.sourceKey.startsWith('source-row-')
      || expectedIdSet.has(assessment.sourceKey)
    ) {
      continue;
    }
    assessment.event = null;
    assessment.classification = 'withheld';
    assessment.issues.push(issue(
      'unexpected_id',
      `Fixture "${assessment.sourceKey}" is not in the approved roster.`,
      `Remove the unexpected row or obtain approval before adding fixture "${assessment.sourceKey}".`,
    ));
    assessment.actions = [
      ...new Set(assessment.issues.map((entry) => entry.action)),
    ];
  }

  const observedIds = new Set(
    assessments.map((entry) => entry.sourceKey).filter(Boolean),
  );
  for (const id of expectedIds) {
    if (observedIds.has(id)) continue;
    assessments.push({
      rowNumber: null,
      sourceKey: id,
      classification: 'withheld',
      issues: [issue(
        'missing_from_source',
        `Expected fixture "${id}" is absent from the canonical sheet.`,
        `Restore the authoritative row for fixture "${id}".`,
      )],
      actions: [`Restore the authoritative row for fixture "${id}".`],
      event: null,
    });
  }

  const counts = Object.fromEntries(CLASSIFICATIONS.map((name) => [name, 0]));
  for (const assessment of assessments) {
    counts[assessment.classification] += 1;
  }
  return {
    sourceRowCount: rows.length - 1,
    expectedFixtureCount: expectedIds.length || null,
    assessments,
    counts,
  };
}

function fixtureSummary(report) {
  return {
    sourceRowCount: report.sourceRowCount,
    expectedFixtureCount: report.expectedFixtureCount,
    accountedFixtureCount: report.assessments.length,
    classifications: report.counts,
    fixtures: report.assessments.map((assessment) => ({
      rowNumber: assessment.rowNumber,
      sourceKey: assessment.sourceKey,
      classification: assessment.classification,
      validationFailures: assessment.issues.map((entry) => ({
        code: entry.code,
        message: entry.message,
      })),
      chetanActions: assessment.actions,
    })),
  };
}

export async function reconcileFixtureSheet(
  db,
  csvText,
  now = new Date(),
  options = {},
) {
  const report = assessFixtureSheet(csvText, now, options);
  const timestamp = now.toISOString();
  const runId = crypto.randomUUID();
  const statements = [
    db.prepare(
      `INSERT INTO sync_runs
         (id, sync_type, status, started_at)
       VALUES (?, 'fixtures', 'running', ?)`,
    ).bind(runId, timestamp),
  ];

  const draftedSourceKeys = new Set();
  for (const assessment of report.assessments) {
    if (!assessment.event) {
      if (
        assessment.sourceKey
        && !assessment.sourceKey.startsWith('source-row-')
        && !draftedSourceKeys.has(assessment.sourceKey)
      ) {
        draftedSourceKeys.add(assessment.sourceKey);
        statements.push(
          db.prepare(
            `UPDATE events
             SET status = 'draft', last_synced_at = ?, updated_at = ?
             WHERE source_type = 'google_sheet' AND source_key = ?`,
          ).bind(timestamp, timestamp, assessment.sourceKey),
        );
      }
      continue;
    }
    const event = assessment.event;
    statements.push(
      db.prepare(
        `INSERT INTO events
           (id, title, venue, event_date, meet_time, tee_time, cost,
            description, joining_information, publication_at,
            registration_opens_at, registration_closes_at,
            cancellation_closes_at, timezone, status, booking_fields_json,
            source_type, source_key, last_synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 'google_sheet', ?, ?, ?, ?)
         ON CONFLICT(source_type, source_key) DO UPDATE SET
           title = excluded.title,
           venue = excluded.venue,
           event_date = excluded.event_date,
           meet_time = excluded.meet_time,
           tee_time = excluded.tee_time,
           cost = excluded.cost,
           description = excluded.description,
           joining_information = excluded.joining_information,
           publication_at = excluded.publication_at,
           registration_opens_at = excluded.registration_opens_at,
           registration_closes_at = excluded.registration_closes_at,
           cancellation_closes_at = excluded.cancellation_closes_at,
           timezone = excluded.timezone,
           status = excluded.status,
           booking_fields_json = excluded.booking_fields_json,
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
      ),
    );
  }

  const summary = fixtureSummary(report);
  statements.push(
    db.prepare(
      `UPDATE sync_runs
       SET status = 'success', completed_at = ?, summary_json = ?
       WHERE id = ?`,
    ).bind(timestamp, JSON.stringify(summary), runId),
  );
  await db.batch(statements);
  return {
    runId,
    eventCount: report.assessments.filter((entry) => entry.event).length,
    completedAt: timestamp,
    summary,
  };
}
