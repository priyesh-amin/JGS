import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLeaderboardCsv, reconcileLeaderboards } from '../functions/_lib/leaderboard-reconciliation.js';

const VALID = `Category,Year,Winner,Score\nPlayer of the Year,2025,Alice,\nSingles,2024,Bob,\nRadha Cup,2023,Carol,Venue\nDoubles,2023,Dan & Eve,\nDoubles,2023,Dan & Eve,`;

test('leaderboard parser accepts all four allowlisted categories and preserves source duplicates', () => {
  const rows = parseLeaderboardCsv(VALID);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.slice(-2).map((row) => row.sourceRow), [5, 6]);
});

test('leaderboard parser rejects unknown categories and partial snapshots', () => {
  assert.throws(() => parseLeaderboardCsv(VALID.replace('Singles', 'Mystery')), /unsupported category/);
  assert.throws(() => parseLeaderboardCsv(VALID.split('\n').filter((row) => !row.startsWith('Radha')).join('\n')), /no radha records/);
});

test('leaderboard activation and old-generation cleanup are submitted in one batch', async () => {
  const sql = [];
  const db = { prepare(statement) { sql.push(statement); return { bind() { return this; } }; }, async batch(statements) { assert.equal(statements.length, 8); } };
  const result = await reconcileLeaderboards(db, VALID, new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(result.recordCount, 5);
  assert.equal(sql.some((statement) => /leaderboard_state/.test(statement)), true);
  assert.equal(sql.some((statement) => /DELETE FROM leaderboard_entries/.test(statement)), true);
});

test('invalid input never starts a database batch', async () => {
  let batches = 0;
  const db = { prepare() { return { bind() { return this; } }; }, async batch() { batches += 1; } };
  await assert.rejects(() => reconcileLeaderboards(db, VALID.replace('Radha Cup', 'Unknown')));
  assert.equal(batches, 0);
});

test('a failed atomic batch cannot report or activate a new snapshot', async () => {
  const db = { prepare() { return { bind() { return this; } }; }, async batch() { throw new Error('atomic failure'); } };
  await assert.rejects(() => reconcileLeaderboards(db, VALID), /atomic failure/);
});
