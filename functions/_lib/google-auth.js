import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from './errors.js';
import { currentUser, issueSession, requireUser } from './auth.js';
import { randomToken } from './crypto.js';
import { normaliseEmail } from './http.js';

const GOOGLE_NONCE_COOKIE = 'jgs_google_nonce';
const GOOGLE_NONCE_MAX_AGE = 10 * 60;
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const MEMBER_FIELDS = `id, email, username, display_name, role, status,
  must_change_password, finance_url, google_subject, password_login_enabled`;

function cookieValue(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return '';
}

function nonceCookie(nonce, request) {
  const attributes = [
    `${GOOGLE_NONCE_COOKIE}=${encodeURIComponent(nonce)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${GOOGLE_NONCE_MAX_AGE}`,
  ];
  if (new URL(request.url).protocol === 'https:') attributes.push('Secure');
  return attributes.join('; ');
}

function validClientId(value) {
  return /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(
    String(value || ''),
  );
}

function textEqual(leftValue, rightValue) {
  const left = new TextEncoder().encode(String(leftValue || ''));
  const right = new TextEncoder().encode(String(rightValue || ''));
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

function changeCount(result) {
  return Number(result?.meta?.changes || result?.changes || 0);
}

function authoritativeGoogleEmail(email, hostedDomain) {
  const domain = email.split('@')[1];
  return domain === 'gmail.com'
    || domain === 'googlemail.com'
    || Boolean(String(hostedDomain || '').trim());
}

export function googleSignInAvailable(context) {
  const expectedOrigin = context.env.APP_ORIGIN;
  return validClientId(context.env.GOOGLE_CLIENT_ID)
    && Boolean(expectedOrigin)
    && new URL(context.request.url).origin === expectedOrigin;
}

export function googleAuthConfig(context) {
  if (!googleSignInAvailable(context)) {
    return { config: { enabled: false }, cookie: null };
  }
  const nonce = randomToken(24);
  return {
    config: {
      enabled: true,
      clientId: context.env.GOOGLE_CLIENT_ID,
      nonce,
    },
    cookie: nonceCookie(nonce, context.request),
  };
}

export async function verifyGoogleCredential(
  context,
  credential,
  { verify = jwtVerify, jwks = GOOGLE_JWKS } = {},
) {
  if (!googleSignInAvailable(context)) {
    throw new AppError(
      503,
      'google_sign_in_unavailable',
      'Google Sign-In is temporarily unavailable. Use your password instead.',
    );
  }
  const token = String(credential || '');
  const nonce = cookieValue(context.request, GOOGLE_NONCE_COOKIE);
  if (!nonce || token.length < 100 || token.length > 12_000) {
    throw new AppError(
      401,
      'invalid_google_credential',
      'Google could not verify this sign-in. Please try again.',
    );
  }

  let payload;
  try {
    ({ payload } = await verify(token, jwks, {
      algorithms: ['RS256'],
      audience: context.env.GOOGLE_CLIENT_ID,
      issuer: GOOGLE_ISSUERS,
      maxTokenAge: '10m',
      clockTolerance: '5s',
    }));
  } catch {
    throw new AppError(
      401,
      'invalid_google_credential',
      'Google could not verify this sign-in. Please try again.',
    );
  }

  if (
    !textEqual(payload.nonce, nonce)
    || payload.email_verified !== true
    || typeof payload.sub !== 'string'
    || payload.sub.length < 1
    || payload.sub.length > 255
  ) {
    throw new AppError(
      401,
      'invalid_google_credential',
      'Google could not verify this sign-in. Please try again.',
    );
  }

  let email;
  try {
    email = normaliseEmail(payload.email);
  } catch {
    throw new AppError(
      401,
      'invalid_google_credential',
      'Google could not verify this sign-in. Please try again.',
    );
  }
  return {
    subject: payload.sub,
    email,
    hostedDomain: String(payload.hd || '').trim(),
  };
}

async function memberByGoogleSubject(db, subject) {
  return db.prepare(
    `SELECT ${MEMBER_FIELDS}
     FROM members WHERE google_subject = ? AND username IS NULL`,
  ).bind(subject).first();
}

async function memberByEmail(db, email) {
  return db.prepare(
    `SELECT ${MEMBER_FIELDS}
     FROM members WHERE email = ? AND username IS NULL`,
  ).bind(email).first();
}

async function linkSubject(db, member, subject, now) {
  try {
    const results = await db.batch([
      db.prepare(
        `UPDATE members
         SET google_subject = ?, google_linked_at = ?, updated_at = ?
         WHERE id = ? AND google_subject IS NULL`,
      ).bind(subject, now, now, member.id),
      db.prepare(
        `INSERT INTO authentication_audit
           (id, member_id, action, created_at)
         SELECT ?, ?, 'google_linked', ?
         WHERE EXISTS (
           SELECT 1 FROM members
           WHERE id = ? AND google_subject = ?
         )`,
      ).bind(crypto.randomUUID(), member.id, now, member.id, subject),
    ]);
    if (changeCount(results[0]) !== 1) {
      const current = await memberByGoogleSubject(db, subject);
      if (current?.id !== member.id) throw new Error('Google subject conflict');
    }
  } catch (error) {
    if (
      String(error?.message || error).includes('UNIQUE constraint failed')
      || String(error?.message || error).includes('Google subject conflict')
    ) {
      throw new AppError(
        409,
        'google_account_already_linked',
        'This Google Account is already linked to another member account.',
      );
    }
    throw error;
  }
  member.google_subject = subject;
  return member;
}

export async function googleLogin(context, credential, options = {}) {
  const identity = await verifyGoogleCredential(context, credential, options);
  let member = await memberByGoogleSubject(context.env.DB, identity.subject);

  if (!member) {
    if (!authoritativeGoogleEmail(identity.email, identity.hostedDomain)) {
      throw new AppError(
        403,
        'google_link_requires_password',
        'For this email provider, reset your password and sign in once before linking Google.',
      );
    }
    member = await memberByEmail(context.env.DB, identity.email);
    if (!member || member.status !== 'active') {
      throw new AppError(
        403,
        'google_account_not_authorised',
        'This Google Account is not on the active member list.',
      );
    }
    member = await linkSubject(
      context.env.DB,
      member,
      identity.subject,
      new Date().toISOString(),
    );
  }

  if (member.status !== 'active') {
    throw new AppError(
      403,
      'google_account_not_authorised',
      'This Google Account is not on the active member list.',
    );
  }
  return issueSession(context, member, { authMethod: 'google' });
}

export async function linkGoogleAccount(context, credential, options = {}) {
  const user = await requireUser(context, { allowPasswordChange: true });
  if (!user.email) {
    throw new AppError(
      403,
      'google_link_unavailable',
      'This account cannot be linked to Google.',
    );
  }
  const identity = await verifyGoogleCredential(context, credential, options);
  if (!textEqual(user.email, identity.email)) {
    throw new AppError(
      403,
      'google_email_mismatch',
      'Choose the Google Account with the same email address as your member account.',
    );
  }
  const member = await memberByEmail(context.env.DB, user.email);
  if (!member || member.id !== user.id || member.status !== 'active') {
    throw new AppError(403, 'google_link_unavailable', 'Google linking is unavailable.');
  }
  if (member.google_subject && member.google_subject !== identity.subject) {
    throw new AppError(
      409,
      'google_account_already_linked',
      'A different Google Account is already linked to this member account.',
    );
  }
  if (!member.google_subject) {
    await linkSubject(
      context.env.DB,
      member,
      identity.subject,
      new Date().toISOString(),
    );
  }
  return currentUser(context);
}
