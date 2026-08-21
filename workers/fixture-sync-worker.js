import { recordFailedSync } from '../functions/_lib/sheet-sync.js';
import { reconcileFixtureSheet } from '../functions/_lib/fixture-reconciliation.js';
import { auditBookingOutput, deliverPendingOutbox, queueBookingReconciliation, recordBookingDeliveryStatus } from '../functions/_lib/integration.js';
import { reconcileLeaderboards, recordFailedLeaderboardSync } from '../functions/_lib/leaderboard-reconciliation.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

function constantTimeEqual(leftValue, rightValue) {
  const left = new TextEncoder().encode(String(leftValue || ''));
  const right = new TextEncoder().encode(String(rightValue || ''));
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) mismatch |= (left[index] || 0) ^ (right[index] || 0);
  return mismatch === 0;
}
const bearerToken = (request) => {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

async function fetchCsv(url, fetchSource) {
  const response = await fetchSource(url, { headers: { Accept: 'text/csv' }, cf: { cacheTtl: 0, cacheEverything: false } });
  if (!response.ok) throw new Error(`Authoritative source returned HTTP ${response.status}.`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 250000) throw new Error('Authoritative source exceeds the safe size limit.');
  return text;
}

export async function synchroniseFixtures(env, fetchSource = fetch) {
  if (!env.DB || !env.MASTER_FIXTURES_CSV_URL || !env.EXPECTED_FIXTURE_IDS) throw new Error('Fixture synchronisation is not configured.');
  return reconcileFixtureSheet(env.DB, await fetchCsv(env.MASTER_FIXTURES_CSV_URL, fetchSource), new Date(), { expectedFixtureIds: env.EXPECTED_FIXTURE_IDS, requiredExpectedFixtureCount: 12 });
}

export async function synchroniseLeaderboards(env, fetchSource = fetch) {
  if (!env.DB || !env.MASTER_LEADERBOARDS_CSV_URL) throw new Error('Leaderboard synchronisation is not configured.');
  return reconcileLeaderboards(env.DB, await fetchCsv(env.MASTER_LEADERBOARDS_CSV_URL, fetchSource));
}

async function runFixtureSync(env) {
  try { return await synchroniseFixtures(env); } catch (error) { if (env.DB) await recordFailedSync(env.DB, error); throw error; }
}
async function runLeaderboardSync(env) {
  try { return await synchroniseLeaderboards(env); } catch (error) { if (env.DB) await recordFailedLeaderboardSync(env.DB, error); throw error; }
}
export async function runScheduled(env, taskFactories) {
  const tasks = taskFactories || [
    () => runFixtureSync(env),
    () => runLeaderboardSync(env),
    async () => {
      await queueBookingReconciliation(env.DB);
      const delivery = await deliverPendingOutbox({ env }, { limit: 50 });
      if (delivery.configured) await auditBookingOutput({ env });
      await recordBookingDeliveryStatus(env.DB, delivery);
      return delivery;
    },
  ];
  const results = await Promise.allSettled(tasks.map((task) => task()));
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) {
    throw new Error(`${failures.length} scheduled reconciliation task(s) failed.`);
  }
  return results;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, databaseConfigured: Boolean(env.DB), fixtureSourceConfigured: Boolean(env.MASTER_FIXTURES_CSV_URL), leaderboardSourceConfigured: Boolean(env.MASTER_LEADERBOARDS_CSV_URL), webhookConfigured: Boolean(env.FIXTURE_SYNC_TOKEN) });
    if (request.method !== 'POST' || url.pathname !== '/sync') return json({ error: { code: 'not_found', message: 'Not found.' } }, 404);
    if (!env.FIXTURE_SYNC_TOKEN || !constantTimeEqual(bearerToken(request), env.FIXTURE_SYNC_TOKEN)) return json({ error: { code: 'unauthorised', message: 'Valid synchronisation credentials are required.' } }, 401);
    const results = await Promise.allSettled([runFixtureSync(env), runLeaderboardSync(env)]);
    const fixture = results[0];
    const leaderboard = results[1];
    if (fixture.status === 'rejected' && leaderboard.status === 'rejected') return json({ error: { code: 'source_sync_failed', message: 'Source synchronisation failed; existing validated data was preserved.' } }, 502);
    return json({ ok: true, fixtures: fixture.status === 'fulfilled' ? { eventCount: fixture.value.eventCount, classifications: fixture.value.summary.classifications } : { ok: false }, leaderboards: leaderboard.status === 'fulfilled' ? { recordCount: leaderboard.value.recordCount } : { ok: false } });
  },
  async scheduled(_event, env, context) { context.waitUntil(runScheduled(env)); },
};
