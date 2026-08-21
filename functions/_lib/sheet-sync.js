export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

export async function recordFailedSync(db, error, now = new Date()) {
  const timestamp = now.toISOString();
  const runId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO sync_runs
       (id, sync_type, status, started_at, completed_at, error_message)
     VALUES (?, 'fixtures', 'failed', ?, ?, ?)`,
  ).bind(
    runId,
    timestamp,
    timestamp,
    String(error?.message || error).slice(0, 1_000),
  ).run();
  return runId;
}
