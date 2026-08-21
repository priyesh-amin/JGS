import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_ITERATIONS,
  hashPassword,
  randomToken,
  validatePassword,
  verifyPassword,
} from '../functions/_lib/crypto.js';

test('password hashing stays within the Cloudflare PBKDF2 ceiling', () => {
  assert.equal(PASSWORD_ITERATIONS, 100_000);
});
test('the configured eleven-character minimum is enforced', () => {
  assert.equal(validatePassword('abcdefghijk'), 'abcdefghijk');
  assert.throws(
    () => validatePassword('abcdefghij'),
    (error) => error.code === 'weak_password',
  );
});


test('password hashes are salted and verifiable', async () => {
  const first = await hashPassword('correct horse battery staple');
  const second = await hashPassword('correct horse battery staple');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword('correct horse battery staple', {
    password_hash: first.hash,
    password_salt: first.salt,
    password_iterations: first.iterations,
  }), true);
  assert.equal(await verifyPassword('incorrect password value', {
    password_hash: first.hash,
    password_salt: first.salt,
    password_iterations: first.iterations,
  }), false);
});

test('session tokens contain sufficient random material', () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
});

