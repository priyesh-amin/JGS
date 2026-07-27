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

export async function currentUser(context) {
  const token = parseCookies(context.request)[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const user = await context.env.DB.prepare(
    `SELECT
       m.id, m.email, m.display_name, m.role, m.status,
       m.must_change_password, m.finance_url,
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

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
    financeUrl: user.finance_url || null,
    sessionIdHash: user.session_id_hash,
  };
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

export async function login(context, emailValue, password) {
  const email = normaliseEmail(emailValue);
  const now = new Date();
  const key = await throttleKey(context.request, email);
  const throttle = await assertNotThrottled(context, key, now);
  const member = await context.env.DB.prepare(
    `SELECT id, email, display_name, role, status, must_change_password,
            finance_url, password_hash, password_salt, password_iterations
     FROM members WHERE email = ?`,
  ).bind(email).first();

  const valid = member?.status === 'active'
    && await verifyPassword(String(password || ''), member);

  if (!valid) {
    await recordFailedLogin(context, key, throttle, now);
    throw new AppError(
      401,
      'invalid_credentials',
      'The email address or password is incorrect.',
    );
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO sessions
         (id_hash, member_id, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(tokenHash, member.id, createdAt, expiresAt, createdAt),
    context.env.DB.prepare(
      'DELETE FROM login_throttles WHERE throttle_key = ?',
    ).bind(key),
    context.env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at <= ?',
    ).bind(createdAt),
  ]);

  return {
    user: {
      id: member.id,
      email: member.email,
      displayName: member.display_name,
      role: member.role,
      mustChangePassword: Boolean(member.must_change_password),
      financeUrl: member.finance_url || null,
    },
    cookie: sessionCookie(
      token,
      context.request,
      SESSION_DAYS * 24 * 60 * 60,
    ),
  };
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
  if (!await verifyPassword(String(currentPassword || ''), row)) {
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
           must_change_password = 0, updated_at = ?
       WHERE id = ?`,
    ).bind(next.hash, next.salt, next.iterations, now, user.id),
    context.env.DB.prepare(
      'DELETE FROM sessions WHERE member_id = ? AND id_hash <> ?',
    ).bind(user.id, user.sessionIdHash),
  ]);

  return { ...user, mustChangePassword: false };
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
