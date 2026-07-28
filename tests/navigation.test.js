import test from 'node:test';
import assert from 'node:assert/strict';
import { safeInternalPath } from '../src/lib/navigation.js';

test('safe internal navigation preserves ordinary application paths', () => {
  assert.equal(safeInternalPath('/events/september-2026'), '/events/september-2026');
  assert.equal(safeInternalPath('/admin'), '/admin');
});

test('unsafe redirect-like paths fall back to the fixtures page', () => {
  for (const path of [
    '//attacker.example',
    '/%2Fattacker.example',
    '/\\attacker.example',
    '\\\\attacker.example',
    'https://attacker.example',
    '%2F%2Fattacker.example',
    '',
    null,
  ]) {
    assert.equal(safeInternalPath(path), '/events');
  }
});