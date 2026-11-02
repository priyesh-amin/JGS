import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('content security policy permits Google Sheets export redirects', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  const connect = headers.match(/connect-src\s+([^;]+)/)?.[1].split(/\s+/);
  assert.ok(connect?.includes('https://docs.google.com'));
  assert.ok(connect?.includes('https://*.googleusercontent.com'));
  assert.ok(!connect?.includes('*'));
});
