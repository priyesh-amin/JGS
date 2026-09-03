import assert from 'node:assert/strict';
import test from 'node:test';
import {
  login,
  normaliseLoginIdentifier,
  requireAdmin,
  setupOperationalAdmin,
} from '../functions/_lib/auth.js';
import {
  listMembers,
  resetMemberPassword,
  resetOperationalAdminPassword,
  updateMember,
} from '../functions/_lib/admin-store.js';
import { hashPassword } from '../functions/_lib/crypto.js';

const RECOVERY_EMAIL = 'recovery-admin@example.invalid';
const TEST_PASSWORD = 'valid-test-password';

function statement(sql, handlers, operations) {
  let values = [];
  return {
    get sql() { return sql; },
    get values() { return values; },
    bind(...next) {
      values = next;
      return this;
    },
    async first(column) {
      const value = await handlers.first?.(sql, values);
      return column ? value?.[column] : value;
    },
    async run() {
      operations.push({ type: 'run', sql, values });
      return handlers.run?.(sql, values) ?? { meta: { changes: 1 } };
    },
  };
}

function authContext({ member = null, sessionUser = null, setupExisting = null } = {}) {
  const operations = [];
  let batchCount = 0;
  const handlers = {
    first(sql, values) {
      if (sql.includes('FROM login_throttles')) return null;
      if (sql.includes('FROM sessions s')) return sessionUser;
      if (sql.includes('WHERE email = ? AND username IS NULL') && sql.includes('password_hash')) {
        return member?.username ? null : member;
      }
      if (sql.includes('WHERE username = ?') && sql.includes('password_hash')) {
        return member?.username === values[0] ? member : null;
      }
      if (sql.includes('WHERE email = ? AND username IS NULL') && sql.includes("role = 'admin'")) {
        return values[0] === RECOVERY_EMAIL ? { id: 'recovery-1' } : null;
      }
      if (sql === 'SELECT id FROM members WHERE username = ?') return setupExisting;
      return null;
    },
  };
  const DB = {
    prepare(sql) {
      return statement(sql, handlers, operations);
    },
    async batch(statements) {
      batchCount += 1;
      operations.push({ type: 'batch', statements });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return {
    context: {
      request: new Request('https://example.pages.dev/api/auth/login', {
        method: 'POST',
        headers: {
          Origin: 'https://example.pages.dev',
          'CF-Connecting-IP': '192.0.2.1',
          Cookie: 'jgs_session=test-session-token',
          'x-operational-admin-setup-token': 'one-time-token',
        },
      }),
      env: {
        DB,
        OPERATIONAL_ADMIN_SETUP_TOKEN: 'one-time-token',
        RECOVERY_ADMIN_EMAIL: RECOVERY_EMAIL,
      },
      waitUntil() {},
    },
    operations,
    get batchCount() { return batchCount; },
  };
}

async function memberRow(overrides = {}) {
  const password = await hashPassword(TEST_PASSWORD);
  return {
    id: 'member-1',
    email: 'member@example.invalid',
    username: null,
    display_name: 'Member One',
    role: 'admin',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
    password_hash: password.hash,
    password_salt: password.salt,
    password_iterations: password.iterations,
    ...overrides,
  };
}

test('existing email sign-in remains supported and excludes username accounts', async () => {
  const member = await memberRow();
  const mock = authContext({ member });
  const result = await login(mock.context, 'MEMBER@example.invalid', TEST_PASSWORD);
  assert.equal(result.user.email, 'member@example.invalid');
  assert.equal(result.user.username, null);
  assert.equal(result.user.canRecoverOperationalAdmin, false);
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /Secure/);
  assert.equal(mock.batchCount, 1);
});

test('the fixed operational username signs in with the same session security', async () => {
  const member = await memberRow({
    email: 'admin@operational.invalid',
    username: 'admin',
    display_name: 'Operational Administrator',
  });
  const mock = authContext({ member });
  const result = await login(mock.context, 'ADMIN', TEST_PASSWORD);
  assert.equal(result.user.email, null);
  assert.equal(result.user.username, 'admin');
  assert.equal(result.user.role, 'admin');
  assert.equal(result.user.canRecoverOperationalAdmin, false);
  assert.match(result.cookie, /SameSite=Lax/);
});

test('unknown username and wrong password have the same safe failure', async () => {
  const member = await memberRow({ username: 'admin' });
  const missing = authContext({ member });
  const wrong = authContext({ member });
  let missingError;
  let wrongError;
  await assert.rejects(
    login(missing.context, 'unknown-user', TEST_PASSWORD),
    (error) => { missingError = error; return true; },
  );
  await assert.rejects(
    login(wrong.context, 'admin', 'incorrect-password'),
    (error) => { wrongError = error; return true; },
  );
  assert.equal(missingError.status, 401);
  assert.equal(missingError.code, 'invalid_credentials');
  assert.equal(missingError.message, wrongError.message);
});

test('a roster placeholder password cannot be used until the member sets one', async () => {
  const member = await memberRow({ password_login_enabled: 0 });
  const mock = authContext({ member });
  await assert.rejects(
    login(mock.context, member.email, TEST_PASSWORD),
    (error) => error.status === 401 && error.code === 'invalid_credentials',
  );
  assert.equal(mock.batchCount, 0);
});

test('username format is constrained and deterministic', () => {
  assert.deepEqual(normaliseLoginIdentifier(' ADMIN '), {
    kind: 'username',
    value: 'admin',
  });
  assert.throws(
    () => normaliseLoginIdentifier('not a username'),
    (error) => error.code === 'invalid_identifier',
  );
});

test('the fixed operational administrator is never forced into member password setup', async () => {
  const member = await memberRow({
    email: 'admin@operational.invalid',
    username: 'admin',
    display_name: 'Operational Administrator',
    must_change_password: 1,
  });
  const loginMock = authContext({ member });
  const signedIn = await login(loginMock.context, 'admin', TEST_PASSWORD);
  assert.equal(signedIn.user.mustChangePassword, false);

  const sessionMock = authContext({ sessionUser: {
    ...member,
    session_id_hash: 'hash',
    expires_at: '2099-01-01T00:00:00.000Z',
  } });
  const sessionUser = await requireAdmin(sessionMock.context);
  assert.equal(sessionUser.mustChangePassword, false);
});

test('forced password changes remain enforced for members and email administrators', async () => {
  for (const role of ['member', 'admin']) {
    const mock = authContext({ sessionUser: {
      ...(await memberRow({ role, must_change_password: 1 })),
      session_id_hash: 'hash',
      expires_at: '2099-01-01T00:00:00.000Z',
    } });
    await assert.rejects(
      requireAdmin(mock.context),
      (error) => role === 'member'
        ? error.code === 'password_change_required'
        : error.code === 'password_change_required',
    );
  }
});

test('a username administrator session passes the existing admin guard', async () => {
  const mock = authContext({
    sessionUser: {
      id: 'operational-1',
      email: 'admin@operational.invalid',
      username: 'admin',
      display_name: 'Operational Administrator',
      role: 'admin',
      status: 'active',
      must_change_password: 0,
      finance_url: null,
      session_id_hash: 'hash',
      expires_at: '2099-01-01T00:00:00.000Z',
    },
  });
  const user = await requireAdmin(mock.context);
  assert.equal(user.username, 'admin');
  assert.equal(user.email, null);
  assert.equal(user.role, 'admin');
});

test('operational setup succeeds only with the one-time gate and records system attribution', async () => {
  const mock = authContext();
  const result = await setupOperationalAdmin(mock.context, {
    password: TEST_PASSWORD,
  });
  assert.equal(result.username, 'admin');
  assert.equal(result.email, null);
  assert.equal(mock.batchCount, 1);
  const statements = mock.operations.find((item) => item.type === 'batch').statements;
  assert.match(statements[1].sql, /actor_kind/);
  assert.match(statements[1].sql, /system_setup/);
  assert.equal(statements[1].values[1], null);
});

test('operational setup rejects an invalid gate and missing recovery configuration', async () => {
  const invalid = authContext();
  invalid.context.env.OPERATIONAL_ADMIN_SETUP_TOKEN = 'different-token';
  await assert.rejects(
    setupOperationalAdmin(invalid.context, { password: TEST_PASSWORD }),
    (error) => error.status === 404 && error.code === 'not_found',
  );
  assert.equal(invalid.batchCount, 0);

  const missingRecovery = authContext();
  delete missingRecovery.context.env.RECOVERY_ADMIN_EMAIL;
  await assert.rejects(
    setupOperationalAdmin(missingRecovery.context, { password: TEST_PASSWORD }),
    (error) => error.status === 503 && error.code === 'recovery_admin_not_configured',
  );
  assert.equal(missingRecovery.batchCount, 0);
});

test('operational setup refuses a duplicate username without changing data', async () => {
  const mock = authContext({ setupExisting: { id: 'already-present' } });
  await assert.rejects(
    setupOperationalAdmin(mock.context, { password: TEST_PASSWORD }),
    (error) => error.status === 409 && error.code === 'operational_admin_unavailable',
  );
  assert.equal(mock.batchCount, 0);
});

function recoveryDb(target = { id: 'operational-1' }) {
  const operations = [];
  const db = {
    prepare(sql) {
      return statement(sql, {
        first(query) {
          if (query.includes("WHERE username = 'admin'")) return target;
          if (query.includes('SELECT id, username FROM members')) {
            return { id: 'operational-1', username: 'admin' };
          }
          return null;
        },
      }, operations);
    },
    async batch(statements) {
      operations.push({ type: 'batch', statements });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return { db, operations };
}

test('only the personal recovery administrator can reset the fixed shared account', async () => {
  const mock = recoveryDb();
  const result = await resetOperationalAdminPassword(
    mock.db,
    { id: 'recovery-1', email: RECOVERY_EMAIL, username: null, role: 'admin' },
    'replacement-password',
    RECOVERY_EMAIL,
  );
  assert.deepEqual(result, { username: 'admin', sessionsRevoked: true });
  const statements = mock.operations[0].statements;
  assert.equal(statements.length, 3);
  assert.match(statements[0].sql, /WHERE id = \? AND username = 'admin'/);
  assert.match(statements[1].sql, /DELETE FROM sessions WHERE member_id = \?/);
  assert.match(statements[2].sql, /operational_admin_password_reset/);
  assert.match(statements[2].sql, /actor_kind/);
});

test('shared and member administrators cannot use the recovery reset', async () => {
  const mock = recoveryDb();
  await assert.rejects(
    resetOperationalAdminPassword(
      mock.db,
      { id: 'operational-1', email: null, username: 'admin', role: 'admin' },
      'replacement-password',
      RECOVERY_EMAIL,
    ),
    (error) => error.status === 403 && error.code === 'recovery_admin_required',
  );
  await assert.rejects(
    resetOperationalAdminPassword(
      mock.db,
      { id: 'other-1', email: 'other@example.invalid', username: null, role: 'admin' },
      'replacement-password',
      RECOVERY_EMAIL,
    ),
    (error) => error.status === 403 && error.code === 'recovery_admin_required',
  );
  assert.equal(mock.operations.length, 0);
});

test('the generic member reset cannot target the shared username account', async () => {
  const mock = recoveryDb();
  await assert.rejects(
    resetMemberPassword(
      mock.db,
      'operational-1',
      'replacement-password',
      { id: 'recovery-1', email: RECOVERY_EMAIL, username: null, role: 'admin' },
      RECOVERY_EMAIL,
    ),
    (error) => error.status === 404 && error.code === 'member_not_found',
  );
  assert.equal(mock.operations.length, 0);
});

test('the operational admin cannot list or mutate the private recovery account', async () => {
  let batchCalls = 0;
  const recovery = {
    id: 'recovery-1',
    email: RECOVERY_EMAIL,
    username: null,
    display_name: 'Private Recovery',
    role: 'admin',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
  };
  const operational = {
    id: 'operational-1',
    email: 'admin@operational.invalid',
    username: 'admin',
    display_name: 'Operational Administrator',
    role: 'admin',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
  };
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async all() { return { results: [recovery, operational] }; },
        async first() { return recovery; },
      };
    },
    async batch() { batchCalls += 1; return []; },
  };
  const actor = {
    id: operational.id,
    email: null,
    username: 'admin',
    role: 'admin',
  };
  const visible = await listMembers(db, actor, RECOVERY_EMAIL);
  assert.deepEqual(visible.map((member) => member.username), ['admin']);
  await assert.rejects(
    updateMember(db, recovery.id, { status: 'disabled' }, actor, RECOVERY_EMAIL),
    (error) => error.status === 404 && error.code === 'member_not_found',
  );
  await assert.rejects(
    resetMemberPassword(db, recovery.id, 'replacement-password', actor, RECOVERY_EMAIL),
    (error) => error.status === 404 && error.code === 'member_not_found',
  );
  assert.equal(batchCalls, 0);
});

test('the fixed username account is immutable through generic member update', async () => {
  let batchCalls = 0;
  const target = {
    id: 'operational-1',
    email: 'admin@operational.invalid',
    username: 'admin',
    display_name: 'Operational Administrator',
    role: 'admin',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
  };
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return target; },
      };
    },
    async batch() { batchCalls += 1; return []; },
  };
  await assert.rejects(
    updateMember(
      db,
      target.id,
      { role: 'member', status: 'disabled' },
      { id: 'recovery-1', email: RECOVERY_EMAIL, username: null, role: 'admin' },
      RECOVERY_EMAIL,
    ),
    (error) => error.status === 404 && error.code === 'member_not_found',
  );
  assert.equal(batchCalls, 0);
});

test('member email changes preserve the account and revoke stale authentication', async () => {
  const operations = [];
  const target = {
    id: 'member-1',
    email: 'old@example.invalid',
    username: null,
    display_name: 'Member One',
    role: 'member',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
    google_subject: 'google-subject-1',
  };
  const db = {
    prepare(sql) {
      return statement(sql, { first: () => target }, operations);
    },
    async batch(statements) {
      operations.push({ type: 'batch', statements });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };

  const result = await updateMember(
    db,
    target.id,
    { email: ' New@Example.Invalid ' },
    { id: 'admin-1', role: 'admin' },
    RECOVERY_EMAIL,
    new Date('2026-09-03T12:00:00.000Z'),
  );

  assert.equal(result.id, target.id);
  assert.equal(result.email, 'new@example.invalid');
  const statements = operations[0].statements;
  assert.equal(statements.length, 3);
  assert.match(statements[0].sql, /SET email = \?/);
  assert.match(statements[0].sql, /google_subject = NULL/);
  assert.match(statements[0].sql, /WHERE id = \? AND username IS NULL/);
  assert.deepEqual(statements[0].values.slice(0, 2), [
    'new@example.invalid',
    target.display_name,
  ]);
  assert.match(statements[1].sql, /DELETE FROM sessions/);
  assert.match(statements[2].sql, /DELETE FROM password_reset_tokens/);
});

test('member email changes return a clear conflict for duplicate addresses', async () => {
  const target = {
    id: 'member-1',
    email: 'old@example.invalid',
    username: null,
    display_name: 'Member One',
    role: 'member',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
  };
  const db = {
    prepare(sql) {
      return statement(sql, { first: () => target }, []);
    },
    async batch() {
      throw new Error('UNIQUE constraint failed: members.email');
    },
  };

  await assert.rejects(
    updateMember(
      db,
      target.id,
      { email: 'used@example.invalid' },
      { id: 'admin-1', role: 'admin' },
      RECOVERY_EMAIL,
    ),
    (error) => error.status === 409 && error.code === 'email_exists',
  );
});
