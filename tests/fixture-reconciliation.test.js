import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessFixtureSheet,
  reconcileFixtureSheet,
} from '../functions/_lib/fixture-reconciliation.js';

function fakeDatabase() {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      return {
        bind(...values) {
          return { sql, values };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

const expectedIds = [
  'season-opener-2026',
  'may-monthly-2026',
  'may-midweek-2026',
  'june-monthly-2026',
  'charity-day-2026',
  'july-monthly-2026',
  'july-midweek-2026',
  'aug-monthly-2026',
  'aug-midweek-2026',
  'weekend-away-2026',
  'sept-monthly-2026',
  'season-finale-2026',
].join(',');

const canonicalRows = [
  ['season-opener-2026', '18 Apr 2026', 'Season Opener', 'Hampton Court'],
  ['may-monthly-2026', '09 May 2026', 'May Monthly', 'Lullingstone Park'],
  ['may-midweek-2026', '20 May 2026', 'Midweek', 'Purley Downs'],
  ['june-monthly-2026', '06 Jun 2026', 'June Monthly', 'Grims Dyke'],
  ['charity-day-2026', '17 Jun 2026', 'Charity Day', 'Maylands'],
  ['july-monthly-2026', '04 Jul 2026', 'July Monthly', 'Croham Hurst'],
  ['july-midweek-2026', '23 Jul 2026', 'Midweek', 'Bush Hill Park'],
  ['aug-monthly-2026', '08 Aug 2026', 'August Monthly', 'Hazlemere'],
  ['aug-midweek-2026', '19 Aug 2026', 'Midweek', 'Bentley'],
  ['weekend-away-2026', '04 Sep 2026', 'Weekend Away', 'Donnington'],
  ['sept-monthly-2026', '19 Sep 2026', 'September Monthly', 'Pine Ridge'],
  ['season-finale-2026', '03 Oct 2026', 'Season Finale', 'Basildon'],
];

test('all 12 canonical rows are individually classified without inventing windows', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,Deadline',
    ...canonicalRows.map((row) => [...row, 'Open', 'See source'].join(',')),
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: expectedIds },
  );

  assert.equal(report.sourceRowCount, 12);
  assert.equal(report.assessments.length, 12);
  assert.deepEqual(report.counts, {
    bookable: 0,
    temporarily_unbookable: 5,
    withheld: 0,
    historical_archived: 7,
  });
  const august = report.assessments.find(
    (entry) => entry.sourceKey === 'aug-monthly-2026',
  );
  assert.equal(august.event.registrationOpensAt, null);
  assert.equal(august.event.registrationClosesAt, null);
  assert.equal(august.event.cancellationClosesAt, null);
  assert.match(august.actions[0], /YYYY-MM-DD/);
});

test('missing, invalid and duplicate fixtures remain individually accounted for', () => {
  const csv = [
    'ID,Date,Event,Venue,Status',
    'a,10 Aug 2026,A Fixture,A Venue,Open',
    'b,11 Aug 2026,B Fixture,,Open',
    'c,12 Aug 2026,C Fixture,C Venue,Open',
    'c,13 Aug 2026,C Duplicate,Other Venue,Open',
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'a,b,c,d' },
  );

  assert.equal(report.sourceRowCount, 4);
  assert.equal(report.assessments.length, 5);
  assert.equal(report.counts.temporarily_unbookable, 1);
  assert.equal(report.counts.withheld, 4);
  assert.equal(
    report.assessments.filter((entry) => entry.sourceKey === 'c').length,
    2,
  );
  assert.equal(
    report.assessments.find((entry) => entry.sourceKey === 'd')
      .issues[0].code,
    'missing_from_source',
  );
});

test('withheld source rows preserve event details but force matching D1 events to draft', async () => {
  const db = fakeDatabase();
  const csv = [
    'ID,Date,Event,Venue,Status',
    'known,10 Aug 2026,Known Fixture,,Open',
  ].join('\n');

  const result = await reconcileFixtureSheet(
    db,
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'known' },
  );

  assert.equal(result.summary.classifications.withheld, 1);
  const statements = db.batches[0];
  const safetyUpdate = statements.find((entry) => (
    entry.sql.includes("SET status = 'draft'")
  ));
  assert.ok(safetyUpdate);
  assert.equal(safetyUpdate.values.at(-1), 'known');
  assert.equal(
    statements.some((entry) => entry.sql.includes('INSERT INTO events')),
    false,
  );
});

test('only an exact currently active registration window is classified bookable', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
    'ready,10 Aug 2026,Ready Fixture,A Venue,Open,2026-07-20T09:00:00+01:00,2026-08-05T18:00:00+01:00,2026-08-07T18:00:00+01:00',
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'ready' },
  );

  assert.equal(report.assessments[0].classification, 'bookable');
  assert.equal(report.assessments[0].event.cancellationClosesAt, '2026-08-07T17:00:00.000Z');
});


test('a duplicate ID with one invalid row withholds every occurrence', () => {
  const csv = [
    'ID,Date,Event,Venue,Status',
    'same,10 Aug 2026,Valid Row,A Venue,Open',
    'same,11 Aug 2026,Invalid Row,,Open',
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'same' },
  );

  assert.equal(report.assessments.length, 2);
  assert.equal(
    report.assessments.every((entry) => entry.classification === 'withheld'),
    true,
  );
  assert.equal(
    report.assessments.every((entry) => (
      entry.issues.some((item) => item.code === 'duplicate_id')
    )),
    true,
  );
});

test('the approved roster is required, unique and enforced as an allowlist', async () => {
  const csv = [
    'ID,Date,Event,Venue,Status',
    'approved,10 Aug 2026,Approved Fixture,A Venue,Open',
    'unexpected,11 Aug 2026,Unexpected Fixture,B Venue,Open',
  ].join('\n');

  assert.throws(
    () => assessFixtureSheet(csv, new Date(), {}),
    (error) => error.code === 'invalid_configuration',
  );
  assert.throws(
    () => assessFixtureSheet(csv, new Date(), {
      expectedFixtureIds: 'approved,approved',
    }),
    (error) => error.code === 'invalid_configuration',
  );
  assert.throws(
    () => assessFixtureSheet(csv, new Date(), {
      expectedFixtureIds: 'approved',
      requiredExpectedFixtureCount: 12,
    }),
    (error) => error.code === 'invalid_configuration',
  );

  const db = fakeDatabase();
  const result = await reconcileFixtureSheet(
    db,
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'approved' },
  );
  assert.equal(result.summary.classifications.withheld, 1);
  assert.equal(
    result.summary.fixtures.find(
      (entry) => entry.sourceKey === 'unexpected',
    ).validationFailures.some((entry) => entry.code === 'unexpected_id'),
    true,
  );
  const inserts = db.batches[0].filter(
    (entry) => entry.sql.includes('INSERT INTO events'),
  );
  assert.equal(inserts.length, 1);
  assert.ok(inserts[0].values.includes('Approved Fixture'));
});

test('invalid BookingFields is withheld even for a past fixture', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,BookingFields',
    'past,10 Jan 2026,Past Fixture,A Venue,Open,{bad',
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'past' },
  );

  assert.equal(report.assessments[0].classification, 'withheld');
  assert.equal(report.assessments[0].event, null);
  assert.equal(
    report.assessments[0].issues.some(
      (entry) => entry.code === 'invalid_booking_fields',
    ),
    true,
  );
});

test('ISO booking dates use inclusive Europe London day boundaries', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
    'ready,10 Aug 2026,Ready Fixture,A Venue,Open,2026-07-20,2026-08-05,2026-08-07',
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'ready' },
  );
  const event = report.assessments[0].event;
  assert.equal(report.assessments[0].classification, 'bookable');
  assert.equal(event.registrationOpensAt, '2026-07-19T23:00:00.000Z');
  assert.equal(event.registrationClosesAt, '2026-08-05T22:59:59.999Z');
  assert.equal(event.cancellationClosesAt, '2026-08-07T22:59:59.999Z');
});

test('strict UK booking dates use the same inclusive London boundaries', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
    'ready,10 Aug 2026,Ready Fixture,A Venue,Open,20/07/2026,05/08/2026,07/08/2026',
  ].join('\n');
  const assessment = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'ready' },
  ).assessments[0];
  assert.equal(assessment.classification, 'bookable');
  assert.equal(assessment.event.registrationOpensAt, '2026-07-19T23:00:00.000Z');
  assert.equal(assessment.event.registrationClosesAt, '2026-08-05T22:59:59.999Z');
  assert.equal(assessment.event.cancellationClosesAt, '2026-08-07T22:59:59.999Z');
});

test('date boundaries remain correct across Europe London DST changes', () => {
  const cases = [
    ['2026-01-15', '2026-01-15T00:00:00.000Z', '2026-01-15T23:59:59.999Z'],
    ['2026-03-29', '2026-03-29T00:00:00.000Z', '2026-03-29T22:59:59.999Z'],
    ['2026-07-20', '2026-07-19T23:00:00.000Z', '2026-07-20T22:59:59.999Z'],
    ['2026-10-25', '2026-10-24T23:00:00.000Z', '2026-10-25T23:59:59.999Z'],
  ];
  for (const [date, expectedOpen, expectedClose] of cases) {
    const csv = [
      'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
      `ready,10 Nov 2026,Ready Fixture,A Venue,Published,${date},2026-11-01,2026-11-02`,
    ].join('\n');
    const event = assessFixtureSheet(csv, new Date('2026-01-01T00:00:00.000Z'), { expectedFixtureIds: 'ready' }).assessments[0].event;
    assert.equal(event.registrationOpensAt, expectedOpen);
    const closeCsv = [
      'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
      `ready,10 Nov 2026,Ready Fixture,A Venue,Published,2025-12-01,${date},2026-11-02`,
    ].join('\n');
    const closeEvent = assessFixtureSheet(closeCsv, new Date('2026-01-01T00:00:00.000Z'), { expectedFixtureIds: 'ready' }).assessments[0].event;
    assert.equal(closeEvent.registrationClosesAt, expectedClose);
  }
});

test('US month-first, loose or natural dates and timezone-less datetimes fail closed', () => {
  for (const value of ['7/29/2026', '29/7/2026', '29 Jul 2026', '2026-07-20T09:00:00']) {
    const csv = [
      'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
      `ready,10 Aug 2026,Ready Fixture,A Venue,Open,${value},2026-08-05,2026-08-07`,
    ].join('\n');
    const assessment = assessFixtureSheet(csv, new Date('2026-07-29T09:00:00.000Z'), { expectedFixtureIds: 'ready' }).assessments[0];
    assert.equal(assessment.classification, 'temporarily_unbookable');
    assert.equal(assessment.event.registrationOpensAt, null);
    assert.equal(assessment.event.status, 'draft');
  }
});
test('cancellation must close after registration and invalid ordering never opens booking', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
    'ready,10 Aug 2026,Ready Fixture,A Venue,Open,2026-07-20T09:00:00+01:00,2026-08-05T18:00:00+01:00,2026-08-05T18:00:00+01:00',
  ].join('\n');
  const report = assessFixtureSheet(
    csv,
    new Date('2026-07-29T09:00:00.000Z'),
    { expectedFixtureIds: 'ready' },
  );
  const assessment = report.assessments[0];
  assert.equal(assessment.classification, 'temporarily_unbookable');
  assert.equal(assessment.event.status, 'draft');
  assert.equal(assessment.event.cancellationClosesAt, null);
  assert.equal(
    assessment.issues.some((entry) => entry.code === 'invalid_cancellation_window'),
    true,
  );
});



test('date-only cancellation must be on a later calendar day than registration close', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
    'ready,10 Aug 2026,Ready Fixture,A Venue,Open,2026-07-20,2026-08-05,2026-08-05',
  ].join('\n');
  const assessment = assessFixtureSheet(csv, new Date('2026-07-29T09:00:00.000Z'), { expectedFixtureIds: 'ready' }).assessments[0];
  assert.equal(assessment.classification, 'temporarily_unbookable');
  assert.equal(assessment.event.status, 'draft');
  assert.equal(assessment.event.cancellationClosesAt, null);
  assert.equal(assessment.issues.some((entry) => entry.code === 'invalid_cancellation_window'), true);
});

test('invalid ISO and UK calendar dates fail closed', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt',
    'ready,10 Aug 2026,Ready Fixture,A Venue,Open,31/02/2026,2026-08-05,2026-08-07',
  ].join('\n');
  const assessment = assessFixtureSheet(csv, new Date('2026-01-01T09:00:00.000Z'), { expectedFixtureIds: 'ready' }).assessments[0];
  assert.equal(assessment.event.registrationOpensAt, null);
  assert.equal(assessment.event.status, 'draft');
});
