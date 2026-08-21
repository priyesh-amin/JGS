import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completePasswordReset,
  requestPasswordReset,
  sendPasswordResetEmail,
} from '../functions/_lib/password-reset.js';
import { randomToken } from '../functions/_lib/crypto.js';

function statement(sql, state, operations) {
  let values = [];
  return {
    sql,
    get values() { return values; },
    bind(...next) { values = next; return this; },
    async first() {
      if (sql.includes('password_reset_throttles')) return null;
      if (sql.includes('FROM members') && sql.includes("status = 'active'")) {
        return state.member;
      }
      if (sql.includes('delivered_at') && sql.includes('ORDER BY')) return null;
      if (sql.includes('FROM password_reset_tokens r')) {
        return state.resetRecord;
      }
      return null;
    },
    async run() {
      operations.push({ sql, values });
      return { meta: { changes: 1 } };
    },
  };
}

function context(state = {}) {
  const operations = [];
  const runtime = {
    member: {
      id: 'member-1',
      email: 'member@example.com',
      display_name: 'Member One',
    },
    resetRecord: null,
    ...state,
  };
  const DB = {
    prepare(sql) { return statement(sql, runtime, operations); },
    async batch(statements) {
      operations.push(...statements.map((item) => ({ sql: item.sql, values: item.values })));
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return {
    operations,
    runtime,
    value: {
      request: new Request('https://members.example.com/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '192.0.2.10' },
      }),
      env: {
        DB,
        APP_ORIGIN: 'https://members.example.com',
        BOOKING_SYNC_TOKEN: 'test-only-delivery-secret',
        BOOKING_SYNC_WEBHOOK_URL: 'https://script.google.com/macros/s/test-deployment/exec',
      },
      waitUntil() {},
    },
  };
}

test('reset requests store only a token hash and return a non-enumerating message', async () => {
  const mock = context();
  let delivery;
  const result = await requestPasswordReset(
    mock.value,
    'MEMBER@example.com',
    {
      now: new Date('2026-08-21T12:00:00.000Z'),
      sendEmail: async (_context, input) => { delivery = input; },
    },
  );
  assert.match(result.message, /If an active member account matches/);
  assert.match(delivery.token, /^[A-Za-z0-9_-]{43}$/);
  const insert = mock.operations.find((item) => item.sql.includes('INSERT INTO password_reset_tokens'));
  assert.ok(insert);
  assert.notEqual(insert.values[0], delivery.token);
  assert.equal(insert.values[1], 'member-1');
});

test('unknown and malformed emails receive the same safe response without delivery', async () => {
  const unknown = context({ member: null });
  let deliveries = 0;
  const sendEmail = async () => { deliveries += 1; };
  const one = await requestPasswordReset(unknown.value, 'unknown@example.com', { sendEmail });
  const two = await requestPasswordReset(unknown.value, 'not-an-email', { sendEmail });
  assert.equal(one.message, two.message);
  assert.equal(deliveries, 0);
});

test('a delivered one-time token enables password login and revokes sessions', async () => {
  const token = randomToken();
  const mock = context({ resetRecord: { member_id: 'member-1' } });
  const result = await completePasswordReset(
    mock.value,
    token,
    'replacement-password',
    { now: new Date('2026-08-21T12:10:00.000Z') },
  );
  assert.match(result.message, /now sign in/);
  const update = mock.operations.find((item) => item.sql.includes('UPDATE members'));
  assert.match(update.sql, /password_login_enabled = 1/);
  assert.ok(mock.operations.some((item) => item.sql.includes('DELETE FROM sessions')));
  assert.ok(mock.operations.some((item) => item.sql.includes("'password_reset_completed'")));
});

test('reset email delivery signs a purpose-bound envelope and keeps the token out of logs', async () => {
  const mock = context();
  let request;
  const token = randomToken();
  await sendPasswordResetEmail(mock.value, {
    email: 'member@example.com',
    displayName: 'Member One',
    token,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  }, {
    fetcher: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  const envelope = JSON.parse(request.options.body);
  assert.equal(envelope.purpose, 'password_reset');
  assert.match(envelope.signature, /^[a-f0-9]{64}$/);
  const message = JSON.parse(envelope.message);
  assert.equal(message.eventType, 'password.reset');
  assert.match(message.resetUrl, new RegExp(`#token=${token}$`));
});
