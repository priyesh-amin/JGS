import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverPendingOutbox } from '../functions/_lib/integration.js';

function mockContext(fetchImplementation) {
  const updates = [];
  const item = {
    id: 'outbox-1',
    idempotency_key: 'booking:booking-1:1',
    event_type: 'booking.registered',
    aggregate_id: 'booking-1',
    payload_json: JSON.stringify({
      id: 'booking-1',
      memberId: 'member-1',
      eventId: 'event-1',
      status: 'registered',
      version: 1,
    }),
    attempts: 0,
    email: 'member@example.invalid',
    display_name: 'Test Member',
    event_title: 'August Monthly',
    event_date: '2026-08-08',
    booking_status: 'registered',
    buggy_required: 1,
    dietary_requirements: 'Vegetarian',
    preferences_json: '{}',
  };
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              assert.match(sql, /FROM integration_outbox/);
              return { results: [item] };
            },
            async run() {
              updates.push({ sql, values });
              return { success: true };
            },
          };
        },
      };
    },
  };
  return {
    context: {
      env: {
        DB: db,
        BOOKING_SYNC_WEBHOOK_URL: 'https://example.invalid/exec',
        BOOKING_SYNC_TOKEN: 'test-secret',
      },
    },
    updates,
    installFetch() {
      const original = globalThis.fetch;
      globalThis.fetch = fetchImplementation;
      return () => {
        globalThis.fetch = original;
      };
    },
  };
}

test('spreadsheet delivery sends the body token and requires an explicit acknowledgement', async () => {
  let requestBody;
  const mock = mockContext(async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const restore = mock.installFetch();
  try {
    const result = await deliverPendingOutbox(mock.context);
    assert.deepEqual(result, { configured: true, delivered: 1, failed: 0 });
    assert.equal(requestBody.webhookToken, 'test-secret');
    assert.equal(requestBody.idempotencyKey, 'booking:booking-1:1');
    assert.match(mock.updates[0].sql, /status = 'sent'/);
  } finally {
    restore();
  }
});

test('a 2xx adapter rejection remains retryable instead of being marked sent', async () => {
  const mock = mockContext(async () => new Response(
    JSON.stringify({ ok: false, error: 'Sheet write failed' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  ));
  const restore = mock.installFetch();
  try {
    const result = await deliverPendingOutbox(mock.context);
    assert.deepEqual(result, { configured: true, delivered: 0, failed: 1 });
    assert.match(mock.updates[0].sql, /status = 'failed'/);
    assert.equal(mock.updates[0].values[2], 'Sheet write failed');
  } finally {
    restore();
  }
});
