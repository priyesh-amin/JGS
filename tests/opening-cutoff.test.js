import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { openAccount } from '../functions/_lib/reconciliation/store.js';

function database(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec('PRAGMA foreign_keys=ON');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(migrations).filter(n => n.endsWith('.sql')).sort()) {
    sql.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
  for (const [id, role] of [['admin', 'admin'], ['member', 'member']]) {
    sql.prepare(`INSERT INTO members
      (id,email,display_name,role,status,password_hash,password_salt,password_iterations,created_at,updated_at)
      VALUES (?,?,?,?,'active','x','x',1,'2026-01-01','2026-01-01')`)
      .run(id, `${id}@example.test`, id, role);
  }
  const wrap = (query, args = []) => ({
    bind(...values) { return wrap(query, values); },
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
    async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
  });
  return { sql, prepare: wrap, async batch(statements) {
    sql.exec('BEGIN');
    try {
      const result = [];
      for (const statement of statements) result.push(await statement.run());
      sql.exec('COMMIT');
      return result;
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  } };
}

const open = (db, openingOn, confirmed = true) => openAccount(db, { id: 'admin' }, {
  revision: 0, memberId: 'member', openingOn, amount: '25',
  note: 'Verified balance through the completed cutoff day', confirmed,
});
const snapshot = db => Object.fromEntries(
  ['finance_accounts', 'finance_journal', 'finance_state', 'management_audit']
    .map(table => [table, db.sql.prepare(`SELECT * FROM ${table}`).all()]),
);

test('opening rejects actual London today and future dates without any writes', async t => {
  const instant = new Date();
  t.mock.timers.enable({ apis: ['Date'], now: instant });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant);
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const db = database(t), before = snapshot(db);
  for (const cutoff of [today, tomorrow.toISOString().slice(0, 10)]) {
    await assert.rejects(open(db, cutoff), {
      code: 'invalid_reconciliation', message: /before today in Europe\/London/,
    });
    assert.deepEqual(snapshot(db), before);
  }
});

for (const [instant, londonToday, yesterday] of [
  ['2026-09-15T23:30:00Z', '2026-09-16', '2026-09-15'],
  ['2026-01-01T00:30:00Z', '2026-01-01', '2025-12-31'],
  ['2026-03-29T23:30:00Z', '2026-03-30', '2026-03-29'],
]) {
  test(`opening uses London calendar day at ${instant}`, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(instant) });
    const db = database(t), before = snapshot(db);
    await assert.rejects(open(db, londonToday), /before today in Europe\/London/);
    assert.deepEqual(snapshot(db), before);
    await assert.rejects(open(db, yesterday, false), /Confirm the opening balance/);
    assert.deepEqual(snapshot(db), before);
    assert.deepEqual(await open(db, yesterday), { saved: true });
    assert.equal(db.sql.prepare('SELECT opening_on FROM finance_accounts').get().opening_on, yesterday);
    const journal = db.sql.prepare('SELECT * FROM finance_journal').get();
    assert.equal(journal.kind, 'opening');
    assert.equal(journal.amount_pence, 2500);
    assert.equal(journal.posted_on, yesterday);
    assert.equal(db.sql.prepare('SELECT revision FROM finance_state').get().revision, 1);
    assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM management_audit').get().n, 1);
  });
}
