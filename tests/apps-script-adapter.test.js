import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../integrations/google-apps-script/BookingWebhook.gs', import.meta.url), 'utf8');

test('Apps Script verifies HMAC envelope and supports reconciliation audit without deletes', () => {
  assert.match(source, /computeHmacSha256Signature/);
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
