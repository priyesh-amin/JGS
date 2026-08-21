import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../integrations/google-apps-script/BookingWebhook.gs', import.meta.url), 'utf8');

test('Apps Script verifies HMAC envelope and supports reconciliation audit without deletes', () => {
  assert.match(source, /computeHmacSha256Signature/);
  assert.match(source, /CacheService\.getScriptCache/);
  assert.match(source, /Replayed request envelope/);
  assert.match(source, /booking\.reconciliation/);
  assert.match(source, /auditBookingOutput_/);
  assert.doesNotMatch(source, /deleteRow|deleteRows|clearContent/);
});

test('Apps Script preserves non-managed cells and checks managed formulas before writes', () => {
  assert.match(source, /getFormula\(\).*Formula collision/s);
  assert.match(source, /requiredHeaders\.forEach[\s\S]*requiredHeaders\.forEach/);
  assert.doesNotMatch(source, /getRange\(targetRow, 1, 1, lastColumn\)\.setValues\(\[rowValues\]\);[\s\S]*targetRow <=/);
});

test('Apps Script flags orphaned and conflicting rows for human review', () => {
  assert.match(source, /Orphaned sheet row requires human review/);
  assert.match(source, /Conflicting booking version requires human review/);
  assert.match(source, /appendSyncLog_/);
});

test('Apps Script sends validated password-reset mail without writing member data to sheets', () => {
  assert.match(source, /purpose.*password_reset/);
  assert.match(source, /password\.reset/);
  assert.match(source, /MailApp\.sendEmail/);
  assert.match(source, /PASSWORD_RESET_URL_PREFIX/);
  assert.match(source, /htmlEscape_/);
  assert.match(source, /payload\.eventType === 'password\.reset'[\s\S]*return jsonResponse_/);
});
