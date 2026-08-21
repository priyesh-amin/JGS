import assert from 'node:assert/strict';
import test from 'node:test';
import {
  googleAuthConfig,
  googleLogin,
  linkGoogleAccount,
} from '../functions/_lib/google-auth.js';

const CLIENT_ID = '123456789-example.apps.googleusercontent.com';
const ORIGIN = 'https://members.example.com';
const NONCE = 'test-google-nonce';

function statement(sql, state, operations) {
  let values = [];
  return {
    sql,
    get values() { return values; },
    bind(...next) { values = next; return this; },
    async first() {
      if (sql.includes('FROM sessions s')) {
        return state.sessionUser ? {
          ...state.sessionUser,
          google_subject: state.member?.google_subject || null,
        } : null;
      }
      if (sql.includes('WHERE google_subject = ?')) {
        return state.member?.google_subject === values[0] ? state.member : null;
      }
      if (sql.includes('WHERE email = ?')) {
        return state.member?.email === values[0] ? state.member : null;
      }
      return null;
    },
    async run() {
      operations.push({ sql, values });
      return { meta: { changes: 1 } };
    },
  };
}

function mockContext(stateOverrides = {}) {
  const operations = [];
  const state = {
    member: null,
    sessionUser: null,
    ...stateOverrides,
  };
  const DB = {
    prepare(sql) { return statement(sql, state, operations); },
    async batch(statements) {
      operations.push(...statements.map((item) => ({ sql: item.sql, values: item.values })));
      return statements.map((item) => {
        if (item.sql.includes('UPDATE members') && item.sql.includes('google_subject')) {
          if (state.member.google_subject) return { meta: { changes: 0 } };
          state.member.google_subject = item.values[0];
        }
        return { meta: { changes: 1 } };
      });
    },
  };
  return {
    state,
    operations,
    context: {
      request: new Request(`${ORIGIN}/api/auth/google`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Cookie: `jgs_google_nonce=${NONCE}; jgs_session=session-token`,
        },
      }),
      env: { DB, APP_ORIGIN: ORIGIN, GOOGLE_CLIENT_ID: CLIENT_ID },
      waitUntil() {},
    },
  };
}

function member(overrides = {}) {
  return {
    id: 'member-1',
    email: 'member@gmail.com',
    username: null,
    display_name: 'Member One',
    role: 'member',
    status: 'active',
    must_change_password: 0,
    finance_url: null,
    google_subject: null,
    password_login_enabled: 0,
    ...overrides,
  };
}

function verifier(payload) {
  return async (_token, _jwks, options) => {
    assert.equal(options.audience, CLIENT_ID);
    assert.deepEqual(options.algorithms, ['RS256']);
    return { payload: { nonce: NONCE, email_verified: true, ...payload } };
  };
}

test('Google configuration is issued only on the configured canonical origin', () => {
  const canonical = mockContext();
  const result = googleAuthConfig(canonical.context);
  assert.equal(result.config.enabled, true);
  assert.equal(result.config.clientId, CLIENT_ID);
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /SameSite=Lax/);

  canonical.context.request = new Request('https://alias.pages.dev/api/auth/google/config');
  assert.deepEqual(googleAuthConfig(canonical.context).config, { enabled: false });
});

test('an allowlisted Gmail member is linked by Google subject and receives a secure session', async () => {
  const mock = mockContext({ member: member() });
  const result = await googleLogin(mock.context, 'x'.repeat(200), {
    verify: verifier({ sub: 'google-subject-1', email: 'MEMBER@gmail.com' }),
  });
  assert.equal(mock.state.member.google_subject, 'google-subject-1');
  assert.equal(result.user.email, 'member@gmail.com');
  assert.equal(result.user.signedInWith, 'google');
  assert.equal(result.user.authenticationMethods.google, true);
  assert.equal(result.user.authenticationMethods.password, false);
  assert.match(result.cookie, /Secure/);
  assert.ok(mock.operations.some((item) => item.sql.includes("'google_linked'")));
});

test('a third-party Google email must prove current mailbox ownership before first link', async () => {
  const mock = mockContext({
    member: member({ email: 'member@yahoo.co.uk' }),
  });
  await assert.rejects(
    googleLogin(mock.context, 'x'.repeat(200), {
      verify: verifier({ sub: 'third-party-subject', email: 'member@yahoo.co.uk' }),
    }),
    (error) => error.status === 403 && error.code === 'google_link_requires_password',
  );
  assert.equal(mock.state.member.google_subject, null);
});

test('a password-authenticated member can link the matching third-party Google email', async () => {
  const target = member({ email: 'member@yahoo.co.uk', password_login_enabled: 1 });
  const mock = mockContext({
    member: target,
    sessionUser: {
      ...target,
      auth_method: 'password',
      session_id_hash: 'session-hash',
      expires_at: '2099-01-01T00:00:00.000Z',
    },
  });
  const result = await linkGoogleAccount(mock.context, 'x'.repeat(200), {
    verify: verifier({ sub: 'third-party-subject', email: 'member@yahoo.co.uk' }),
  });
  assert.equal(mock.state.member.google_subject, 'third-party-subject');
  assert.equal(result.authenticationMethods.google, true);
});

test('Google credentials require the browser nonce and a verified email', async () => {
  const mock = mockContext({ member: member() });
  await assert.rejects(
    googleLogin(mock.context, 'x'.repeat(200), {
      verify: verifier({
        nonce: 'wrong-nonce',
        sub: 'google-subject-1',
        email: 'member@gmail.com',
      }),
    }),
    (error) => error.status === 401 && error.code === 'invalid_google_credential',
  );
});
