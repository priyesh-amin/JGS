import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { runScheduled } from '../workers/fixture-sync-worker.js';

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

test('fixture sync health reports configured bindings without values', async () => {
  const response = await worker.fetch(
    new Request('https://fixture-sync.example/health'),
    {
      DB: {},
      MASTER_FIXTURES_CSV_URL: 'https://example.invalid/fixtures.csv',
      FIXTURE_SYNC_TOKEN: 'not-returned',
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    databaseConfigured: true,
    fixtureSourceConfigured: true,
    leaderboardSourceConfigured: false,
    webhookConfigured: true,
  });
});

test('fixture sync webhook rejects missing or incorrect credentials', async () => {
  for (const authorization of [null, 'Bearer incorrect']) {
    const headers = authorization ? { Authorization: authorization } : {};
    const response = await worker.fetch(
      new Request('https://fixture-sync.example/sync', {
        method: 'POST',
        headers,
      }),
      {
        DB: {},
        MASTER_FIXTURES_CSV_URL: 'https://example.invalid/fixtures.csv',
        FIXTURE_SYNC_TOKEN: 'expected-value',
      },
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'unauthorised');
  }
});


test('authenticated webhook payload is ignored and canonical CSV is re-read', async (t) => {
  const db = fakeDatabase();
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const roster = [
    'canonical', 'fixture-2', 'fixture-3', 'fixture-4',
    'fixture-5', 'fixture-6', 'fixture-7', 'fixture-8',
    'fixture-9', 'fixture-10', 'fixture-11', 'fixture-12',
  ];
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://canonical.example/fixtures.csv');
    return new Response([
      'ID,Date,Event,Venue,Status',
      ...roster.map((id, index) => (
        `${id},${10 + index} Aug 2026,${id === 'canonical' ? 'Canonical Fixture' : `Fixture ${index + 1}`},Approved Venue,Open`
      )),
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/csv' },
    });
  };

  const response = await worker.fetch(
    new Request('https://fixture-sync.example/sync', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer expected-value',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fixtures: [{
          id: 'attacker-controlled',
          title: 'This must never be trusted',
        }],
      }),
    }),
    {
      DB: db,
      MASTER_FIXTURES_CSV_URL: 'https://canonical.example/fixtures.csv',
      EXPECTED_FIXTURE_IDS: roster.join(','),
      FIXTURE_SYNC_TOKEN: 'expected-value',
    },
  );

  assert.equal(response.status, 200);
  const eventInsert = db.batches[0].find(
    (entry) => entry.sql.includes('INSERT INTO events'),
  );
  assert.ok(eventInsert);
  assert.ok(eventInsert.values.includes('Canonical Fixture'));
  assert.equal(eventInsert.values.includes('This must never be trusted'), false);
});


test('scheduled reconciliation reports any failed sibling task after all tasks settle', async () => {
  let completed = 0;
  await assert.rejects(
    () => runScheduled({}, [
      async () => { completed += 1; return 'fixtures'; },
      async () => { throw new Error('leaderboard failed'); },
      async () => { completed += 1; return 'bookings'; },
    ]),
    /1 scheduled reconciliation task\(s\) failed/,
  );
  assert.equal(completed, 2);
});
