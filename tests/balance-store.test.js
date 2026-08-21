import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateBalance,
  findMemberBalance,
  findReconciledOn,
  isAfterReconciliation,
  localDateKey,
  memberBalance,
  parseBalancePence,
} from '../functions/_lib/balance-store.js';

test('balance values are parsed safely into integer pence', () => {
  assert.equal(parseBalancePence('£1,234.56'), 123456);
  assert.equal(parseBalancePence('(44.52)'), -4452);
  assert.equal(parseBalancePence('-20.00'), -2000);
  assert.equal(parseBalancePence('not money'), null);
});

test('a member balance is matched by one normalised display name', () => {
  const csv = [
    'Amit Vaja,10.00,FALSE',
    'Chetan Patel,140.00,TRUE',
  ].join('\n');
  assert.equal(findMemberBalance(csv, '  CHETAN   PATEL '), 14000);
});

test('duplicate member names are rejected instead of guessing', () => {
  const csv = [
    'Same Name,10.00',
    'Same Name,20.00',
  ].join('\n');
  assert.throws(
    () => findMemberBalance(csv, 'Same Name'),
    (error) => error.code === 'ambiguous_balance',
  );
});

test('the reconciliation date is read from G1 in UK date format', () => {
  const csv = 'Amit Vaja,10.00,FALSE,,,Last reconciled by CK on:,16/7/2026';
  assert.equal(findReconciledOn(csv), '2026-07-16');
});

test('missing or invalid reconciliation dates fail safely', () => {
  assert.throws(
    () => findReconciledOn('Amit Vaja,10.00'),
    (error) => error.code === 'balance_reconciliation_date_missing',
  );
  assert.throws(
    () => findReconciledOn('Amit Vaja,10.00,,,,,31/2/2026'),
    (error) => error.code === 'balance_reconciliation_date_missing',
  );
});

test('only bookings after the UK reconciliation day consume the balance', () => {
  assert.equal(
    localDateKey('2026-07-16T23:30:00.000Z', 'Europe/London'),
    '2026-07-17',
  );
  assert.equal(
    isAfterReconciliation(
      '2026-07-16T22:59:59.000Z',
      '2026-07-16',
      'Europe/London',
    ),
    false,
  );
  assert.equal(
    isAfterReconciliation(
      '2026-07-16T23:00:00.000Z',
      '2026-07-16',
      'Europe/London',
    ),
    true,
  );
});

test('member balance subtracts only active bookings after reconciliation', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(
    'Member One,100.00,,,,Last reconciled by CK on:,16/7/2026',
    { status: 200, headers: { 'content-type': 'text/csv' } },
  );
  const rows = [
    {
      event_id: 'already-reconciled',
      registered_at: '2026-07-16T22:59:59.000Z',
      cost: '65',
      event_date: '2026-09-01',
      registration_closes_at: '2026-08-20T22:59:59.000Z',
      timezone: 'Europe/London',
    },
    {
      event_id: 'first-later',
      registered_at: '2026-07-16T23:00:00.000Z',
      cost: '65',
      event_date: '2026-10-01',
      registration_closes_at: '2026-09-20T22:59:59.000Z',
      timezone: 'Europe/London',
    },
    {
      event_id: 'second-later',
      registered_at: '2026-07-17T12:00:00.000Z',
      cost: '50',
      event_date: '2026-11-01',
      registration_closes_at: '2026-10-20T22:59:59.000Z',
      timezone: 'Europe/London',
    },
  ];
  const context = {
    env: {
      MEMBER_BALANCES_CSV_URL: 'https://example.test/balances.csv',
      DB: {
        prepare: () => ({
          bind: () => ({ all: async () => ({ results: rows }) }),
        }),
      },
    },
  };

  const result = await memberBalance(context, {
    id: 'member-1',
    displayName: 'Member One',
  });

  assert.equal(result.reconciledOn, '2026-07-16');
  assert.deepEqual(result.reconciledEventIds, ['already-reconciled']);
  assert.equal(result.projectedBalancePence, -1500);
  assert.equal(result.outstandingPence, 1500);
  assert.deepEqual(
    result.allocations.map(({ eventId, outstandingPence }) => ({
      eventId,
      outstandingPence,
    })),
    [
      { eventId: 'first-later', outstandingPence: 0 },
      { eventId: 'second-later', outstandingPence: 1500 },
    ],
  );
});
test('one balance is allocated only once across multiple bookings', () => {
  const allocations = allocateBalance(6500, [
    {
      eventId: 'later',
      eventDate: '2026-10-10',
      paymentDeadline: '2026-10-03T22:59:59Z',
      costPence: 6500,
    },
    {
      eventId: 'earlier',
      eventDate: '2026-09-19',
      paymentDeadline: '2026-09-12T22:59:59Z',
      costPence: 6500,
    },
  ]);

  assert.deepEqual(allocations.map((item) => ({
    eventId: item.eventId,
    covered: item.isCovered,
    outstandingPence: item.outstandingPence,
  })), [
    { eventId: 'earlier', covered: true, outstandingPence: 0 },
    { eventId: 'later', covered: false, outstandingPence: 6500 },
  ]);
});

test('partial and negative balances produce the true top-up amount', () => {
  const partial = allocateBalance(10000, [
    {
      eventId: 'first',
      eventDate: '2026-09-19',
      costPence: 6500,
    },
    {
      eventId: 'second',
      eventDate: '2026-10-10',
      costPence: 6500,
    },
  ]);
  assert.equal(partial[0].outstandingPence, 0);
  assert.equal(partial[1].outstandingPence, 3000);

  const inDeficit = allocateBalance(-2000, [{
    eventId: 'first',
    eventDate: '2026-09-19',
    costPence: 6500,
  }]);
  assert.equal(inDeficit[0].outstandingPence, 8500);
});
