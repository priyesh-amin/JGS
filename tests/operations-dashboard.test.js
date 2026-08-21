import assert from 'node:assert/strict';
import test from 'node:test';
import { operationsDashboard } from '../functions/_lib/operations-dashboard.js';
import { onRequest } from '../functions/api/[[path]].js';

const FIXTURES_LINK = 'https://docs.google.com/spreadsheets/d/example-fixtures/edit#gid=1';
const BOOKING_LINK = 'https://docs.google.com/spreadsheets/d/example-bookings/edit#gid=2';
const CSV_SOURCE = 'https://example.invalid/private-source.csv';

function integrationDb(role = null) {
  return {
    prepare(sql) {
      const all = async () => {
        if (sql.includes('FROM integration_outbox')) {
          return { results: [{ status: 'failed', count: 1 }] };
        }
        if (sql.includes('FROM sync_runs')) {
          return {
            results: [{
              sync_type: 'fixtures',
              status: 'failed',
              completed_at: '2026-08-21T09:00:00.000Z',
              summary_json: '{}',
              error_message: `Fetch failed for ${CSV_SOURCE}`,
            }],
          };
        }
        throw new Error(`Unexpected all query: ${sql}`);
      };
      return {
        all,
        bind() {
          return {
            async first() {
              if (sql.includes('FROM sessions s')) {
                return role ? {
                  id: `${role}-one`,
                  email: `${role}@example.invalid`,
                  username: null,
                  display_name: `Test ${role}`,
                  role,
                  status: 'active',
                  must_change_password: 0,
                  finance_url: null,
                  session_id_hash: 'session-hash',
                  expires_at: '2027-01-01T00:00:00.000Z',
                } : null;
              }
              throw new Error(`Unexpected first query: ${sql}`);
            },
            all,
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function dashboardContext(role = null) {
  return {
    request: new Request('https://jgs.example.invalid/api/admin/operations', {
      headers: role ? { Cookie: 'jgs_session=test-session' } : {},
    }),
    env: {
      DB: integrationDb(role),
      FIXTURES_WORKBOOK_URL: FIXTURES_LINK,
      BOOKING_MANAGEMENT_WORKBOOK_URL: BOOKING_LINK,
      LEADERBOARDS_WORKBOOK_URL: 'https://example.invalid/not-approved',
      MASTER_FIXTURES_CSV_URL: CSV_SOURCE,
      BOOKING_SYNC_TOKEN: 'must-never-be-returned',
    },
    waitUntil() {},
  };
}

test('operations guide exposes only approved workbook links and sanitised status', async () => {
  const result = await operationsDashboard(dashboardContext('admin'));
  const fixtures = result.sources.find((item) => item.id === 'fixtures');
  const booking = result.sources.find((item) => item.id === 'booking_output');
  const leaderboards = result.sources.find((item) => item.id === 'leaderboards');
  const financeLinks = result.sources.find((item) => item.id === 'member_finance_links');

  assert.equal(fixtures.link, FIXTURES_LINK);
  assert.equal(booking.link, BOOKING_LINK);
  assert.equal(leaderboards.link, null);
  assert.equal(leaderboards.linkStatus, 'misconfigured');
  assert.match(fixtures.sync.error, /\[redacted URL\]/);
  assert.match(financeLinks.owner, /Unresolved/);

  const serialised = JSON.stringify(result);
  assert.doesNotMatch(serialised, /must-never-be-returned/);
  assert.doesNotMatch(serialised, /private-source\.csv/);
  assert.doesNotMatch(serialised, /example\.invalid\/not-approved/);
  assert.doesNotMatch(serialised, /member row/i);
});

test('restricted operations endpoint enforces the administrator role server-side', async () => {
  const unauthenticated = await onRequest(dashboardContext());
  assert.equal(unauthenticated.status, 401);
  assert.doesNotMatch(await unauthenticated.text(), /example-fixtures|example-bookings/);

  const member = await onRequest(dashboardContext('member'));
  assert.equal(member.status, 403);
  assert.doesNotMatch(await member.text(), /example-fixtures|example-bookings/);

  const administrator = await onRequest(dashboardContext('admin'));
  assert.equal(administrator.status, 200);
  assert.equal(administrator.headers.get('cache-control'), 'no-store');
  const body = await administrator.json();
  assert.equal(body.sources.find((item) => item.id === 'fixtures').link, FIXTURES_LINK);
});
