import { AppError } from './errors.js';
import { hashPassword, randomToken, sha256 } from './crypto.js';
import { normaliseEmail } from './http.js';

const RESET_TOKEN_MINUTES = 60;
const RESET_WINDOW_MINUTES = 60;
const RESET_MAX_ATTEMPTS = 5;
const RESET_MAX_IP_ATTEMPTS = 20;
const RESET_COOLDOWN_MINUTES = 2;
const GENERIC_RESULT = Object.freeze({
  message: 'If an active member account matches, a password reset link has been sent.',
});

function webhookUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'script.google.com'
    || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
  ) {
    throw new Error('Password reset email endpoint is not approved.');
  }
  return url.toString();
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function signMessage(secret, timestamp, nonce, message, purpose = '') {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${purpose ? `${purpose}.` : ''}${timestamp}.${nonce}.${message}`),
  ));
}

function resetOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('The password reset origin must be an HTTPS website origin.');
  }
  return url.origin;
}

export async function sendPasswordResetEmail(
  context,
  { email, displayName, token, expiresAt },
  { fetcher = fetch } = {},
) {
  const tokenSecret = context.env.BOOKING_SYNC_TOKEN;
  if (!context.env.BOOKING_SYNC_WEBHOOK_URL || !tokenSecret) {
    throw new Error('Password reset email delivery is not configured.');
  }
  const endpoint = webhookUrl(context.env.BOOKING_SYNC_WEBHOOK_URL);
  const origin = resetOrigin(context.env.APP_ORIGIN);
  const message = JSON.stringify({
    schemaVersion: 1,
    eventType: 'password.reset',
    recipient: email,
    displayName,
    resetUrl: `${origin}/reset-password#token=${encodeURIComponent(token)}`,
    expiresAt,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const signature = await signMessage(
    tokenSecret,
    timestamp,
    nonce,
    message,
    'password_reset',
  );
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purpose: 'password_reset',
      timestamp,
      nonce,
      signature,
      message,
    }),
  });
  if (!response.ok) throw new Error(`Password reset email returned HTTP ${response.status}`);
  const acknowledgement = await response.json();
  if (acknowledgement?.ok !== true) {
    throw new Error('Password reset email was rejected.');
  }
}

function changeCount(result) {
  return Number(result?.meta?.changes || result?.changes || 0);
}

async function recordResetThrottle(db, key, now, maximum) {
  const previous = await db.prepare(
    `SELECT window_started_at, attempts
     FROM password_reset_throttles WHERE throttle_key = ?`,
  ).bind(key).first();
  const started = previous?.window_started_at
    ? new Date(previous.window_started_at)
    : null;
  const insideWindow = started
    && now.getTime() - started.getTime() < RESET_WINDOW_MINUTES * 60_000;
  const attempts = insideWindow ? Number(previous.attempts || 0) + 1 : 1;
  const windowStartedAt = insideWindow
    ? previous.window_started_at
    : now.toISOString();
  await db.prepare(
    `INSERT INTO password_reset_throttles
       (throttle_key, window_started_at, attempts)
     VALUES (?, ?, ?)
     ON CONFLICT(throttle_key) DO UPDATE SET
       window_started_at = excluded.window_started_at,
       attempts = excluded.attempts`,
  ).bind(key, windowStartedAt, attempts).run();
  return attempts <= maximum;
}

async function resetThrottleAllowed(context, email, now) {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'local';
  const ipKey = await sha256(`password-reset-ip|${ip}`);
  if (!await recordResetThrottle(
    context.env.DB,
    ipKey,
    now,
    RESET_MAX_IP_ATTEMPTS,
  )) {
    return false;
  }
  const emailKey = await sha256(`password-reset-email|${email}`);
  return recordResetThrottle(
    context.env.DB,
    emailKey,
    now,
    RESET_MAX_ATTEMPTS,
  );
}

export async function requestPasswordReset(
  context,
  emailValue,
  { now = new Date(), sendEmail = sendPasswordResetEmail } = {},
) {
  let email;
  try {
    email = normaliseEmail(emailValue);
  } catch {
    await sha256(String(emailValue || ''));
    return GENERIC_RESULT;
  }
  if (!await resetThrottleAllowed(context, email, now)) return GENERIC_RESULT;

  const member = await context.env.DB.prepare(
    `SELECT id, email, display_name
     FROM members
     WHERE email = ? AND username IS NULL AND status = 'active'`,
  ).bind(email).first();
  if (!member) return GENERIC_RESULT;

  const latestRequest = await context.env.DB.prepare(
    `SELECT created_at
     FROM password_reset_tokens
     WHERE member_id = ?
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(member.id).first();
  if (
    latestRequest?.created_at
    && now.getTime() - new Date(latestRequest.created_at).getTime()
      < RESET_COOLDOWN_MINUTES * 60_000
  ) {
    return GENERIC_RESULT;
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + RESET_TOKEN_MINUTES * 60_000,
  ).toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO password_reset_tokens
         (token_hash, member_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(tokenHash, member.id, createdAt, expiresAt),
    context.env.DB.prepare(
      `INSERT INTO authentication_audit
         (id, member_id, action, created_at)
       VALUES (?, ?, 'password_reset_requested', ?)`,
    ).bind(crypto.randomUUID(), member.id, createdAt),
  ]);

  const delivery = (async () => {
    try {
      await sendEmail(context, {
        email: member.email,
        displayName: member.display_name,
        token,
        expiresAt,
      });
      await context.env.DB.prepare(
        `UPDATE password_reset_tokens
         SET delivered_at = ? WHERE token_hash = ?`,
      ).bind(new Date().toISOString(), tokenHash).run();
    } catch {
      await context.env.DB.batch([
        context.env.DB.prepare(
          'DELETE FROM password_reset_tokens WHERE token_hash = ?',
        ).bind(tokenHash),
        context.env.DB.prepare(
          `INSERT INTO authentication_audit
             (id, member_id, action, created_at)
           VALUES (?, ?, 'password_reset_delivery_failed', ?)`,
        ).bind(crypto.randomUUID(), member.id, new Date().toISOString()),
      ]);
      console.error('Password reset email delivery failed.');
    }
    const throttleCutoff = new Date(now.getTime() - 24 * 60 * 60_000)
      .toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare(
        'DELETE FROM password_reset_tokens WHERE expires_at <= ?',
      ).bind(createdAt),
      context.env.DB.prepare(
        'DELETE FROM password_reset_throttles WHERE window_started_at <= ?',
      ).bind(throttleCutoff),
    ]);
  })();
  if (context.waitUntil) context.waitUntil(delivery);
  else await delivery;
  return GENERIC_RESULT;
}

export async function completePasswordReset(
  context,
  tokenValue,
  newPassword,
  { now = new Date() } = {},
) {
  const token = String(tokenValue || '').trim();
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new AppError(
      400,
      'invalid_reset_token',
      'This password reset link is invalid or has expired.',
    );
  }
  const tokenHash = await sha256(token);
  const nowIso = now.toISOString();
  const record = await context.env.DB.prepare(
    `SELECT r.member_id
     FROM password_reset_tokens r
     JOIN members m ON m.id = r.member_id
     WHERE r.token_hash = ? AND r.delivered_at IS NOT NULL
       AND r.used_at IS NULL AND r.expires_at > ?
       AND m.status = 'active' AND m.username IS NULL`,
  ).bind(tokenHash, nowIso).first();
  if (!record) {
    throw new AppError(
      400,
      'invalid_reset_token',
      'This password reset link is invalid or has expired.',
    );
  }

  const password = await hashPassword(newPassword);
  const requestId = crypto.randomUUID();
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE password_reset_tokens
       SET used_at = ?, used_by_request = ?
       WHERE token_hash = ? AND delivered_at IS NOT NULL
         AND used_at IS NULL AND expires_at > ?`,
    ).bind(nowIso, requestId, tokenHash, nowIso),
    context.env.DB.prepare(
      `UPDATE members
       SET password_hash = ?, password_salt = ?, password_iterations = ?,
           password_login_enabled = 1, must_change_password = 0, updated_at = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM password_reset_tokens
         WHERE token_hash = ? AND used_by_request = ?
       )`,
    ).bind(
      password.hash,
      password.salt,
      password.iterations,
      nowIso,
      record.member_id,
      tokenHash,
      requestId,
    ),
    context.env.DB.prepare(
      `UPDATE password_reset_tokens
       SET used_at = COALESCE(used_at, ?), used_by_request = COALESCE(used_by_request, ?)
       WHERE member_id = ? AND used_at IS NULL`,
    ).bind(nowIso, requestId, record.member_id),
    context.env.DB.prepare(
      'DELETE FROM sessions WHERE member_id = ?',
    ).bind(record.member_id),
    context.env.DB.prepare(
      `INSERT INTO authentication_audit
         (id, member_id, action, created_at)
       SELECT ?, ?, 'password_reset_completed', ?
       WHERE EXISTS (
         SELECT 1 FROM password_reset_tokens
         WHERE token_hash = ? AND used_by_request = ?
       )`,
    ).bind(
      crypto.randomUUID(),
      record.member_id,
      nowIso,
      tokenHash,
      requestId,
    ),
  ]);
  if (changeCount(results[0]) !== 1 || changeCount(results[1]) !== 1) {
    throw new AppError(
      400,
      'invalid_reset_token',
      'This password reset link is invalid or has expired.',
    );
  }
  return { message: 'Your password has been reset. You can now sign in.' };
}
