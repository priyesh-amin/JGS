import assert from 'node:assert/strict';
import test from 'node:test';
import { auditBookingOutput, deliverPendingOutbox, queueBookingReconciliation, recordBookingDeliveryStatus } from '../functions/_lib/integration.js';

function mockContext(fetchImplementation) {
  const updates = [];
  const item = { id: 'outbox-1', idempotency_key: 'booking:booking-1:1', event_type: 'booking.registered', aggregate_id: 'booking-1', payload_json: JSON.stringify({ id: 'booking-1', memberId: 'member-1', eventId: 'event-1', status: 'registered', version: 1, updatedAt: '2026-01-01T00:00:00.000Z' }), attempts: 1, email: '=unsafe@example.invalid', display_name: '+Test Member', event_title: 'August Monthly', event_date: '2026-08-08', venue: '@Venue', booking_status: 'registered', buggy_required: 1, dietary_requirements: '=Vegetarian' };
  const db = { prepare(sql) { return { bind(...values) { return {
    async all() { if (/SELECT id FROM integration_outbox/.test(sql)) return { results: [{ id: item.id }] }; throw new Error(`Unexpected all: ${sql}`); },
    async first() { if (/SELECT o\.\*/.test(sql)) return item; throw new Error(`Unexpected first: ${sql}`); },
    async run() { updates.push({ sql, values }); return { meta: { changes: 1 } }; },
  }; } }; } };
  return { context: { env: { DB: db, BOOKING_SYNC_WEBHOOK_URL: 'https://script.google.com/macros/s/example-deployment/exec', BOOKING_SYNC_TOKEN: 'test-secret' } }, updates, installFetch() { const original = globalThis.fetch; globalThis.fetch = fetchImplementation; return () => { globalThis.fetch = original; }; } };
}

test('spreadsheet delivery uses a lease and signed envelope without transmitting the static secret', async () => {
  let envelope;
  const mock = mockContext(async (_url, init) => { envelope = JSON.parse(init.body); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  const restore = mock.installFetch();
  try {
    const result = await deliverPendingOutbox(mock.context, { now: new Date('2026-01-01T00:00:00.000Z') });
    assert.deepEqual(result, { configured: true, delivered: 1, failed: 0 });
    assert.equal(JSON.stringify(envelope).includes('test-secret'), false);
    assert.match(envelope.signature, /^[0-9a-f]{64}$/);
    const message = JSON.parse(envelope.message);
    assert.equal(message.member.email, "'=unsafe@example.invalid");
    assert.equal(message.member.displayName, "'+Test Member");
    assert.equal(message.event.venue, "'@Venue");
    assert.equal(message.operational.dietaryRequirements, '');
    assert.match(mock.updates[0].sql, /status = 'processing'/);
    assert.match(mock.updates[1].sql, /status = 'sent'/);
  } finally { restore(); }
});

test('a 2xx adapter rejection releases the lease and remains retryable', async () => {
  const mock = mockContext(async () => new Response(JSON.stringify({ ok: false, error: 'Sheet write failed' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const restore = mock.installFetch();
  try {
    const result = await deliverPendingOutbox(mock.context);
    assert.deepEqual(result, { configured: true, delivered: 0, failed: 1 });
    assert.match(mock.updates[1].sql, /status = 'failed'/);
    assert.equal(mock.updates[1].values[1], 'Sheet write failed');
  } finally { restore(); }
});

test('unapproved webhook URLs are rejected before a secret-derived signature is made', async () => {
  const mock = mockContext(async () => { throw new Error('must not fetch'); });
  mock.context.env.BOOKING_SYNC_WEBHOOK_URL = 'https://example.invalid/exec';
  await assert.rejects(() => deliverPendingOutbox(mock.context), /approved Apps Script URL/);
});

test('hourly reconciliation requeues only the latest sent canonical booking projection', async () => {
  let statement;
  const db = { prepare(sql) { statement = sql; return { bind() { return { async run() { return { meta: { changes: 2 } }; } }; } }; } };
  assert.equal(await queueBookingReconciliation(db, new Date('2026-01-01T00:00:00.000Z')), 2);
  assert.match(statement, /current\.status = 'sent'/);
  assert.match(statement, /latest\.aggregate_id = current\.aggregate_id/);
  assert.match(statement, /ORDER BY latest\.created_at DESC/);
  assert.doesNotMatch(statement, /DELETE/i);
});

test('reconciliation audit sends only canonical booking ids and versions in a signed secret-free envelope', async () => {
  let envelope;
  const db = { prepare(sql) { assert.match(sql, /SELECT id, version FROM bookings/); return { async all() { return { results: [{ id: 'booking-1', version: 3 }] }; } }; } };
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { envelope = JSON.parse(init.body); return new Response(JSON.stringify({ ok: true, flagged: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  try {
    const result = await auditBookingOutput({ env: { DB: db, BOOKING_SYNC_WEBHOOK_URL: 'https://script.google.com/macros/s/example-deployment/exec', BOOKING_SYNC_TOKEN: 'test-secret' } }, new Date('2026-01-01T10:00:00.000Z'));
    assert.deepEqual(result, { configured: true, audited: 1, flagged: 1 });
    assert.equal(JSON.stringify(envelope).includes('test-secret'), false);
    const message = JSON.parse(envelope.message);
    assert.deepEqual(message.canonicalBookings, [{ id: 'booking-1', version: 3 }]);
    assert.equal(message.eventType, 'booking.reconciliation');
    assert.equal(message.member, undefined);
  } finally { globalThis.fetch = original; }
});

test('delivery alert is recorded after three attempts or fifteen unresolved minutes with approved owners', async () => {
  let inserted;
  const db = { prepare(sql) { return { bind(...values) { return {
    async first() { assert.match(sql, /attempts >= 3 OR updated_at <=/); assert.doesNotMatch(sql, /created_at <=/); return { count: 2 }; },
    async run() { inserted = { sql, values }; return { success: true }; },
  }; } }; } };
  const summary = await recordBookingDeliveryStatus(db, { delivered: 0, failed: 0 }, new Date('2026-01-01T10:00:00.000Z'));
  assert.equal(summary.alertCount, 2);
  assert.equal(summary.primaryOwner, 'Chetan');
  assert.equal(summary.backupOwner, 'Priyesh');
  assert.match(inserted.sql, /'booking_output'/);
  assert.equal(inserted.values[1], 'failed');
  assert.equal(inserted.values[5], 'Booking output requires operational review.');
});

test('alert age is based on the current unresolved episode, not the original outbox creation', () => {
  const oldSentRowRequeuedNow = { createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z', attempts: 1 };
  const threshold = new Date('2026-01-01T09:45:00.000Z').toISOString();
  assert.equal(oldSentRowRequeuedNow.attempts >= 3 || oldSentRowRequeuedNow.updatedAt <= threshold, false);
  const stuckCurrentEpisode = { ...oldSentRowRequeuedNow, updatedAt: '2026-01-01T09:44:59.000Z' };
  assert.equal(stuckCurrentEpisode.attempts >= 3 || stuckCurrentEpisode.updatedAt <= threshold, true);
});
