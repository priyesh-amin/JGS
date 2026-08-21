import { parseCsv } from './sheet-sync.js';

const CATEGORY_MAP = new Map([
  ['player of the year', 'poy'], ['poy', 'poy'],
  ['singles', 'singles'], ['singles cup', 'singles'],
  ['radha', 'radha'], ['radha cup', 'radha'], ['doubles', 'doubles'],
]);
const CATEGORIES = ['poy', 'singles', 'radha', 'doubles'];
const normaliseHeader = (value) => String(value || '').trim().toLowerCase();

function requiredIndex(headers, name) {
  const index = headers.indexOf(name);
  if (index < 0) throw new Error(`Leaderboard source is missing ${name}.`);
  return index;
}

export function parseLeaderboardCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Leaderboard source contains no records.');
  const headers = rows[0].map(normaliseHeader);
  const categoryIndex = requiredIndex(headers, 'category');
  const yearIndex = requiredIndex(headers, 'year');
  const winnerIndex = requiredIndex(headers, 'winner');
  const scoreIndex = requiredIndex(headers, 'score');
  const currentYear = new Date().getUTCFullYear();
  const entries = rows.slice(1).map((row, offset) => {
    const sourceRow = offset + 2;
    const category = CATEGORY_MAP.get(normaliseHeader(row[categoryIndex])) || '';
    const yearText = String(row[yearIndex] || '').trim();
    const winner = String(row[winnerIndex] || '').trim();
    const score = String(row[scoreIndex] || '').trim();
    const year = Number(yearText);
    if (!category) throw new Error(`Row ${sourceRow} has an unsupported category.`);
    if (!/^\d{4}$/.test(yearText) || year < 1900 || year > currentYear + 1) throw new Error(`Row ${sourceRow} has an invalid year.`);
    if (!winner || winner.length > 200) throw new Error(`Row ${sourceRow} has an invalid winner.`);
    if (score.length > 200) throw new Error(`Row ${sourceRow} has an invalid score.`);
    return { category, year, winner, score, sourceRow };
  });
  if (entries.length > 500) throw new Error('Leaderboard source exceeds 500 records.');
  for (const category of CATEGORIES) {
    if (!entries.some((entry) => entry.category === category)) throw new Error(`Leaderboard source contains no ${category} records.`);
  }
  return entries;
}

export async function reconcileLeaderboards(db, csvText, now = new Date()) {
  const startedAt = now.toISOString();
  const generationId = crypto.randomUUID();
  const entries = parseLeaderboardCsv(csvText);
  await db.batch([
    ...entries.map((entry) => db.prepare(`INSERT INTO leaderboard_entries (generation_id, category, year, winner, score, source_row, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(generationId, entry.category, entry.year, entry.winner, entry.score, entry.sourceRow, startedAt)),
    db.prepare(`INSERT INTO leaderboard_state (singleton, active_generation_id, updated_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO UPDATE SET active_generation_id = excluded.active_generation_id, updated_at = excluded.updated_at`).bind(generationId, startedAt),
    db.prepare('DELETE FROM leaderboard_entries WHERE generation_id <> ?').bind(generationId),
    db.prepare(`INSERT INTO sync_runs (id, sync_type, status, started_at, completed_at, summary_json) VALUES (?, 'leaderboards', 'success', ?, ?, ?)`).bind(crypto.randomUUID(), startedAt, startedAt, JSON.stringify({ recordCount: entries.length })),
  ]);
  return { recordCount: entries.length, completedAt: startedAt };
}

export async function recordFailedLeaderboardSync(db, error, now = new Date()) {
  const timestamp = now.toISOString();
  await db.prepare(`INSERT INTO sync_runs (id, sync_type, status, started_at, completed_at, error_message) VALUES (?, 'leaderboards', 'failed', ?, ?, ?)`).bind(crypto.randomUUID(), timestamp, timestamp, String(error?.message || error).slice(0, 1000)).run();
}

export async function listLeaderboards(db) {
  const result = await db.prepare(`SELECT category, year, winner, score FROM leaderboard_entries WHERE generation_id = (SELECT active_generation_id FROM leaderboard_state WHERE singleton = 1) ORDER BY year DESC, source_row ASC`).all();
  if (!result.results.length) throw new Error('No validated leaderboard snapshot is available.');
  const grouped = Object.fromEntries(CATEGORIES.map((category) => [category, []]));
  for (const row of result.results) if (grouped[row.category]) grouped[row.category].push({ year: Number(row.year), winner: row.winner, score: row.score || '' });
  return grouped;
}
