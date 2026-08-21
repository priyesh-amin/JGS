import { AppError } from './errors.js';
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from './crypto.js';
import { normaliseEmail } from './http.js';

const SESSION_COOKIE = 'jgs_session';
const SESSION_DAYS = 30;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_ATTEMPTS = 10;
export const OPERATIONAL_ADMIN_USERNAME = 'admin';
const OPERATIONAL_ADMIN_INTERNAL_EMAIL = 'admin@operational.invalid';
const DUMMY_PASSWORD_RECORD = Object.freeze({
  password_hash: 'u8qvlaavzUno9x7WbW0ljFRXuYGh444aNPlLu0ggU84',
  password_salt: 'AAECAwQFBgcICQoLDA0ODw',
  password_iterations: 100_000,
});

function canRecoverOperationalAdmin(env, member) {
  if (member?.username || !member?.email || !env.RECOVERY_ADMIN_EMAIL) {
    return false;
  }
  try {
    return normaliseEmail(member.email) === normaliseEmail(
      env.RECOVERY_ADMIN_EMAIL,
    );
  } catch {
    return false;
  }
}

function parseCookies(request) {
  const result = {};
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    result[part.slice(0, separator).trim()] = decodeURIComponent(
      part.slice(separator + 1).trim(),
    );
  }
  return result;
}

function sessionCookie(token, request, maxAge) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (new URL(request.url).protocol === 'https:') attributes.push('Secure');
  return attributes.join('; ');
}

function userPayload(member, { sessionIdHash = null, authMethod = 'password' } = {}) {
  const isOperationalAdmin = member.role === 'admin'
    && member.username === OPERATIONAL_ADMIN_USERNAME;
  const user = {
    id: member.id,
    email: member.username ? null : member.email,
    username: member.username || null,
    displayName: member.display_name,
    role: member.role,
    mustChangePassword: Boolean(member.must_change_password)
      && authMethod !== 'google'
      && !isOperationalAdmin,
    financeUrl: member.finance_url || null,
    canRecoverOperationalAdmin: false,
    signedInWith: authMethod,
    authenticationMethods: {
      google: Boolean(member.google_subject),
      password: member.password_login_enabled !== 0,
    },
  };
  Object.defineProperty(user, 'sessionIdHash', {
    value: sessionIdHash,
    enumerable: false,
  });
  return user;
}

export async function issueSession(
  context,
  member,
  { authMethod = 'password', throttleKey = null, now = new Date() } = {},
) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const statements = [
    context.env.DB.prepare(
      `INSERT INTO sessions
         (id_hash, member_id, created_at, expires_at, last_seen_at, auth_method)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      tokenHash,
      member.id,
      createdAt,
      expiresAt,
      createdAt,
      authMethod,
    ),
    context.env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at <= ?',
    ).bind(createdAt),
  ];
  if (throttleKey) {
    statements.splice(1, 0, context.env.DB.prepare(
      'DELETE FROM login_throttles WHERE throttle_key = ?',
    ).bind(throttleKey));
  }
  await context.env.DB.batch(statements);

  const user = userPayload(member, { sessionIdHash: tokenHash, authMethod });
  user.canRecoverOperationalAdmin = canRecoverOperationalAdmin(
    context.env,
    member,
  );
  return {
    user,
    cookie: sessionCookie(
      token,
      context.request,
      SESSION_DAYS * 24 * 60 * 60,
    ),
  };
}

export async function currentUser(context) {
  const token = parseCookies(context.request)[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const user = await context.env.DB.prepare(
    `SELECT
       m.id, m.email, m.username, m.display_name, m.role, m.status,
       m.must_change_password, m.finance_url, m.google_subject,
       m.password_login_enabled, s.auth_method,
       s.id_hash AS session_id_hash, s.expires_at
     FROM sessions s
     JOIN members m ON m.id = s.member_id
     WHERE s.id_hash = ? AND s.expires_at > ? AND m.status = 'active'`,
  ).bind(tokenHash, now).first();

  if (!user) return null;

  context.waitUntil?.(
    context.env.DB.prepare(
      'UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?',
    ).bind(now, tokenHash).run(),
  );

  const result = userPayload(user, {
    sessionIdHash: user.session_id_hash,
    authMethod: user.auth_method || 'password',
  });
  result.canRecoverOperationalAdmin = canRecoverOperationalAdmin(
    context.env,
    user,
  );
  return result;
}

export async function requireUser(context, { allowPasswordChange = false } = {}) {
  const user = await currentUser(context);
  if (!user) {
    throw new AppError(401, 'unauthenticated', 'Sign in to continue.');
  }
  if (user.mustChangePassword && !allowPasswordChange) {
    throw new AppError(
      403,
      'password_change_required',
      'Change your temporary password before continuing.',
    );
  }
  return user;
}

export function assertMember(user) {
  if (user.role !== 'member') {
    throw new AppError(
      403,
      'member_account_required',
      'A member account is required to manage a booking.',
    );
  }
  return user;
}

export async function requireAdmin(context) {
  const user = await requireUser(context);
  if (user.role !== 'admin') {
    throw new AppError(
      403,
      'forbidden',
      'Administrator access is required.',
    );
  }
  return user;
}

async function throttleKey(request, email) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  return sha256(`${email}|${ip}`);
}

async function assertNotThrottled(context, key, now) {
  const row = await context.env.DB.prepare(
    'SELECT attempts, window_started_at, locked_until FROM login_throttles WHERE throttle_key = ?',
  ).bind(key).first();
  if (row?.locked_until && new Date(row.locked_until) > now) {
    throw new AppError(
      429,
      'login_throttled',
      'Too many sign-in attempts. Please wait and try again.',
    );
  }
  return row;
}

async function recordFailedLogin(context, key, previous, now) {
  const windowStart = previous?.window_started_at
    ? new Date(previous.window_started_at)
    : null;
  const withinWindow = windowStart
    && now.getTime() - windowStart.getTime() < LOGIN_WINDOW_MINUTES * 60_000;
  const attempts = withinWindow ? Number(previous.attempts || 0) + 1 : 1;
  const startedAt = withinWindow
    ? previous.window_started_at
    : now.toISOString();
  const lockedUntil = attempts >= LOGIN_MAX_ATTEMPTS
    ? new Date(now.getTime() + LOGIN_WINDOW_MINUTES * 60_000).toISOString()
    : null;

  await context.env.DB.prepare(
    `INSERT INTO login_throttles
       (throttle_key, window_started_at, attempts, locked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(throttle_key) DO UPDATE SET
       window_started_at = excluded.window_started_at,
       attempts = excluded.attempts,
       locked_until = excluded.locked_until`,
  ).bind(key, startedAt, attempts, lockedUntil).run();
}

export function normaliseUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) {
    throw new AppError(
      400,
      'invalid_identifier',
      'Enter a valid email address or username.',
    );
  }
  return username;
}

export function normaliseLoginIdentifier(value) {
  const identifier = String(value || '').trim();
  return identifier.includes('@')
    ? { kind: 'email', value: normaliseEmail(identifier) }
    : { kind: 'username', value: normaliseUsername(identifier) };
}

export async function login(context, identifierValue, password) {
  const identifier = normaliseLoginIdentifier(identifierValue);
  const now = new Date();
  const key = await throttleKey(context.request, identifier.value);
  const throttle = await assertNotThrottled(context, key, now);
  const lookup = identifier.kind === 'email'
    ? `SELECT id, email, username, display_name, role, status,
              must_change_password, finance_url, password_hash,
              password_salt, password_iterations, google_subject,
              password_login_enabled
       FROM members WHERE email = ? AND username IS NULL`
    : `SELECT id, email, username, display_name, role, status,
              must_change_password, finance_url, password_hash,
              password_salt, password_iterations, google_subject,
              password_login_enabled
       FROM members WHERE username = ?`;
  const member = await context.env.DB.prepare(lookup)
    .bind(identifier.value)
    .first();

  const passwordMatches = await verifyPassword(
    String(password || ''),
    member || DUMMY_PASSWORD_RECORD,
  );
  const valid = Boolean(member)
    && member.status === 'active'
    && member.password_login_enabled !== 0
    && passwordMatches;

  if (!valid) {
    await recordFailedLogin(context, key, throttle, now);
    throw new AppError(
      401,
      'invalid_credentials',
      'The email address, username or password is incorrect.',
    );
  }

  return issueSession(context, member, {
    authMethod: 'password',
    throttleKey: key,
    now,
  });
}

export async function logout(context) {
  const token = parseCookies(context.request)[SESSION_COOKIE];
  if (token) {
    const hash = await sha256(token);
    await context.env.DB.prepare(
      'DELETE FROM sessions WHERE id_hash = ?',
    ).bind(hash).run();
  }
  return sessionCookie('', context.request, 0);
}

export async function changePassword(context, currentPassword, newPassword) {
  const user = await requireUser(context, { allowPasswordChange: true });
  const row = await context.env.DB.prepare(
    `SELECT password_hash, password_salt, password_iterations
     FROM members WHERE id = ?`,
  ).bind(user.id).first();
  if (
    user.signedInWith !== 'google'
    && !await verifyPassword(String(currentPassword || ''), row)
  ) {
    throw new AppError(
      401,
      'invalid_current_password',
      'The current password is incorrect.',
    );
  }

  const next = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE members
       SET password_hash = ?, password_salt = ?, password_iterations = ?,
           must_change_password = 0, password_login_enabled = 1,
           updated_at = ?
       WHERE id = ?`,
    ).bind(next.hash, next.salt, next.iterations, now, user.id),
    context.env.DB.prepare(
      'DELETE FROM sessions WHERE member_id = ? AND id_hash <> ?',
    ).bind(user.id, user.sessionIdHash),
  ]);

  return { ...user, mustChangePassword: false };
}

function constantTimeTextEqual(leftValue, rightValue) {
  const left = new TextEncoder().encode(String(leftValue || ''));
  const right = new TextEncoder().encode(String(rightValue || ''));
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

export async function setupOperationalAdmin(context, input) {
  const configuredToken = context.env.OPERATIONAL_ADMIN_SETUP_TOKEN;
  const suppliedToken = context.request.headers.get(
    'x-operational-admin-setup-token',
  );
  if (
    !configuredToken
    || !suppliedToken
    || !constantTimeTextEqual(suppliedToken, configuredToken)
  ) {
    throw new AppError(404, 'not_found', 'Not found.');
  }
  if (!context.env.RECOVERY_ADMIN_EMAIL) {
    throw new AppError(
      503,
      'recovery_admin_not_configured',
      'Operational administrator recovery is not configured.',
    );
  }
  const recoveryEmail = normaliseEmail(context.env.RECOVERY_ADMIN_EMAIL);
  const recovery = await context.env.DB.prepare(
    `SELECT id FROM members
     WHERE email = ? AND username IS NULL
       AND role = 'admin' AND status = 'active'`,
  ).bind(recoveryEmail).first();
  if (!recovery) {
    throw new AppError(
      503,
      'recovery_admin_unavailable',
      'Operational administrator recovery is unavailable.',
    );
  }
  const existing = await context.env.DB.prepare(
    'SELECT id FROM members WHERE username = ?',
  ).bind(OPERATIONAL_ADMIN_USERNAME).first();
  if (existing) {
    throw new AppError(
      409,
      'operational_admin_unavailable',
      'Operational administrator setup is unavailable.',
    );
  }

  const password = await hashPassword(input.password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO members
           (id, email, username, display_name, role, status, password_hash,
            password_salt, password_iterations, must_change_password,
            created_at, updated_at)
         VALUES (?, ?, ?, 'Operational Administrator', 'admin', 'active',
                 ?, ?, ?, 0, ?, ?)`,
      ).bind(
        id,
        OPERATIONAL_ADMIN_INTERNAL_EMAIL,
        OPERATIONAL_ADMIN_USERNAME,
        password.hash,
        password.salt,
        password.iterations,
        now,
        now,
      ),
      context.env.DB.prepare(
        `INSERT INTO account_security_audit
           (id, actor_member_id, actor_kind, target_member_id, action, created_at)
         VALUES (?, ?, 'system_setup', ?, 'operational_admin_created', ?)`,
      ).bind(crypto.randomUUID(), null, id, now),
    ]);
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE constraint failed')) {
      throw new AppError(
        409,
        'operational_admin_unavailable',
        'Operational administrator setup is unavailable.',
      );
    }
    throw error;
  }
  return {
    id,
    email: null,
    username: OPERATIONAL_ADMIN_USERNAME,
    displayName: 'Operational Administrator',
    role: 'admin',
    status: 'active',
  };
}

export async function bootstrapAdmin(context, input) {
  const configuredToken = context.env.BOOTSTRAP_TOKEN;
  const suppliedToken = context.request.headers.get('x-bootstrap-token');
  if (!configuredToken || !suppliedToken || suppliedToken !== configuredToken) {
    throw new AppError(404, 'not_found', 'Not found.');
  }

  const count = await context.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM members',
  ).first('count');
  if (Number(count) > 0) {
    throw new AppError(
      409,
      'bootstrap_completed',
      'Initial administrator setup has already been completed.',
    );
  }

  const email = normaliseEmail(input.email);
  const displayName = String(input.displayName || '').trim();
  if (!displayName || displayName.length > 120) {
    throw new AppError(
      400,
      'invalid_display_name',
      'Enter an administrator display name.',
    );
  }
  const password = await hashPassword(input.password);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await context.env.DB.prepare(
    `INSERT INTO members
       (id, email, display_name, role, status, password_hash, password_salt,
        password_iterations, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, 'admin', 'active', ?, ?, ?, 0, ?, ?)`,
  ).bind(
    id,
    email,
    displayName,
    password.hash,
    password.salt,
    password.iterations,
    now,
    now,
  ).run();

  return { id, email, displayName, role: 'admin', status: 'active' };
}
