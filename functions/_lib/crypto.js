import { AppError } from './errors.js';

export const PASSWORD_ITERATIONS = 210_000;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(value)),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 12 || value.length > 200) {
    throw new AppError(
      400,
      'weak_password',
      'Password must be between 12 and 200 characters.',
    );
  }
  return value;
}

export async function hashPassword(password, options = {}) {
  const value = validatePassword(password);
  const iterations = options.iterations || PASSWORD_ITERATIONS;
  const saltBytes = options.salt
    ? base64UrlToBytes(options.salt)
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    256,
  );

  return {
    hash: bytesToBase64Url(new Uint8Array(bits)),
    salt: bytesToBase64Url(saltBytes),
    iterations,
  };
}

export async function verifyPassword(password, stored) {
  if (!stored?.password_hash || !stored?.password_salt) return false;
  const calculated = await hashPassword(password, {
    salt: stored.password_salt,
    iterations: stored.password_iterations,
  });
  const left = new TextEncoder().encode(calculated.hash);
  const right = new TextEncoder().encode(stored.password_hash);
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

