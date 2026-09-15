import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { financeMigrations, setupReconciliation } from '../functions/_lib/reconciliation/schema.js';
import { issueSession } from '../functions/_lib/auth.js';
import { onRequest } from '../functions/api/[[path]].js';

const baseMigrations = [
  '0001_secure_booking.sql', '0002_operational_admin_username.sql',
  '0003_wp4_outputs.sql', '0004_member_identity_and_password_recovery.sql',
  '0005_website_management.sql',
];
const financeNames = ['0006_reconciliation.sql', '0007_booking_charges.sql'];
const source = name => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
const actor = { id: 'admin' };

function database(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec('PRAGMA foreign_keys=ON');
  for (const name of baseMigrations) sql.exec(source(name));
  sql.exec(`CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`);
  for (const name of baseMigrations) sql.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(name);
  for (const [id, role] of [['admin', 'admin'], ['one', 'member'], ['two', 'member']]) {
    sql.prepare(`INSERT INTO members
      (id,email,display_name,role,status,password_hash,password_salt,password_iterations,
       must_change_password,created_at,updated_at)
      VALUES (?,?,?,?,'active','x','x',1,0,'2026-01-01','2026-01-01')`)
      .run(id, `${id}@example.test`, id, role);
  }
  sql.exec(`INSERT INTO member_balances VALUES ('one',-6500,'2026-08-01','Existing debt',3,'2026-08-01');
    INSERT INTO member_balances VALUES ('two',2000,'2026-08-01','Existing credit',2,'2026-08-01');
    INSERT INTO events (id,title,venue,event_date,cost,source_type,source_key,created_at,updated_at)
      VALUES ('golf','Golf','Club','2026-09-20','65','website','golf','now','now');
    INSERT INTO bookings (id,member_id,event_id,status,registered_at,updated_at)
      VALUES ('booking','one','golf','registered','2026-08-01','2026-08-01')`);
  // Preparation is lazy, as in D1: later statements can refer to earlier batch DDL.
  const wrap = (query, args = []) => ({
    bind(...values) { return wrap(query, values); },
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
    async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
  });
  return { sql, prepare: wrap, async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sql.exec('COMMIT');
      return results;
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  } };
}

const rows = (db, table) => db.sql.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all();
const schema = db => db.sql.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name').all();
function snapshot(db) {
  return { schema: schema(db), tables: Object.fromEntries(schema(db)
    .filter(object => object.type === 'table')
    .map(object => [object.name, rows(db, object.name)])) };
}
function assertEmptyFinance(db) {
  for (const table of ['finance_accounts', 'finance_journal', 'finance_imports', 'finance_bank_rows',
    'finance_claims', 'finance_booking_charges', 'finance_booking_reviews', 'finance_opening_bookings']) {
    assert.deepEqual(rows(db, table), [], table);
  }
  assert.equal(rows(db, 'finance_state')[0].revision, 0);
}

test('fixed finance migrations match the complete source SQL with only whitespace normalized', () => {
  const normalize = sql => sql.replace(/\s+/g, ' ').trim();
  assert.deepEqual(financeMigrations.map(migration => migration.name), financeNames);
  for (const migration of financeMigrations) {
    assert.equal(normalize(migration.statements.join('\n')), normalize(source(migration.name)), migration.name);
  }
});

test('setup applies 0006 and 0007 without activating accounts or changing existing balances and bookings', async t => {
  const db = database(t), before = snapshot(db);
  assert.equal(schema(db).some(object => object.name.startsWith('finance_')), false);
  assert.deepEqual(await setupReconciliation(db, actor), { saved: true, accountsActivated: 0 });
  assertEmptyFinance(db);
  for (const table of ['members', 'member_balances', 'bookings', 'booking_audit', 'integration_outbox']) {
    assert.deepEqual(rows(db, table), before.tables[table], table);
  }
  assert.deepEqual(rows(db, 'd1_migrations').map(row => row.name), [...baseMigrations, ...financeNames]);
  const audit = rows(db, 'management_audit');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_id, actor.id);
  assert.equal(audit[0].entity_type, 'reconciliation');
  assert.equal(audit[0].action, 'enabled');
  assert.deepEqual(JSON.parse(audit[0].after_json), { migrations: financeNames, accountsActivated: 0 });
  // Independently apply source files to verify every table, index, view and trigger.
  const expected = database(t);
  for (const name of financeNames) expected.sql.exec(source(name));
  assert.deepEqual(schema(db), schema(expected));
});

test('repeated setup is a complete no-op, including audit and migration history', async t => {
  const db = database(t);
  await setupReconciliation(db, actor);
  const before = snapshot(db);
  assert.deepEqual(await setupReconciliation(db, actor), { saved: true, alreadyEnabled: true });
  assert.deepEqual(snapshot(db), before);
});

test('a failure at the final audit write rolls back all DDL, migration history and data', async t => {
  for (const tracked of [true, false]) {
    const db = database(t);
    if (!tracked) db.sql.exec('DROP TABLE d1_migrations');
    db.sql.exec(`CREATE TRIGGER reject_setup_audit BEFORE INSERT ON management_audit
      BEGIN SELECT RAISE(ABORT,'test setup audit failure'); END`);
    const before = snapshot(db);
    await assert.rejects(setupReconciliation(db, actor), /test setup audit failure/);
    assert.deepEqual(snapshot(db), before);
    db.sql.exec('DROP TRIGGER reject_setup_audit');
    await setupReconciliation(db, actor);
    assertEmptyFinance(db);
  }
});

test('existing 0006 upgrades only 0007 and preserves accounts, journal and balances', async t => {
  const db = database(t);
  db.sql.exec(source(financeNames[0]));
  db.sql.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run(financeNames[0]);
  db.sql.exec(`INSERT INTO finance_accounts VALUES ('one','2026-07-31','now','admin');
    INSERT INTO finance_journal
      (id,member_id,kind,amount_pence,posted_on,due_on,note,created_at,actor_id)
      VALUES ('opening','one','opening',2000,'2026-07-31','2026-07-31','Verified opening','now','admin'),
      ('event:booking','one','charge',-6500,'2026-08-01','2026-09-20','Existing charge','now','admin');
    UPDATE finance_state SET revision=9`);
  const before = snapshot(db);
  await setupReconciliation(db, actor);
  for (const table of ['finance_accounts', 'finance_journal', 'finance_state', 'member_balances', 'bookings']) {
    assert.deepEqual(rows(db, table), before.tables[table], table);
  }
  assert.deepEqual(rows(db, 'd1_migrations').slice(0, -1), before.tables.d1_migrations);
  assert.deepEqual(rows(db, 'd1_migrations').map(row => row.name), [...baseMigrations, ...financeNames]);
  assert.deepEqual(JSON.parse(rows(db, 'management_audit')[0].after_json), {
    migrations: [financeNames[1]], accountsActivated: 0,
  });
  assert.equal(rows(db, 'finance_booking_charges')[0].journal_id, 'event:booking');
  assert.equal(rows(db, 'finance_booking_charges')[0].booking_id, 'booking');
  assert.throws(() => db.sql.exec("UPDATE finance_journal SET amount_pence=0 WHERE id='opening'"), /immutable/);
  const upgraded = snapshot(db);
  await setupReconciliation(db, actor);
  assert.deepEqual(snapshot(db), upgraded);
});

async function api(db) {
  const env = { DB: db, APP_ORIGIN: 'https://jgs.example.test' };
  const cookie = async id => (await issueSession({ env, request: new Request(env.APP_ORIGIN) },
    await db.prepare('SELECT * FROM members WHERE id=?').bind(id).first())).cookie.split(';')[0];
  const admin = await cookie('admin'), member = await cookie('one');
  return { admin, member, call(session, origin = env.APP_ORIGIN) {
    return onRequest({ env, request: new Request(`${env.APP_ORIGIN}/api/admin/reconciliation/setup`, {
      method: 'POST', headers: { ...(session ? { cookie: session } : {}), origin },
    }) });
  } };
}

test('setup API denies unauthenticated, member and wrong-origin requests without schema or finance writes', async t => {
  const db = database(t);
  db.sql.exec("UPDATE management_settings SET value='website' WHERE key='mode'");
  const client = await api(db);
  for (const [cookie, origin, status] of [
    [undefined, undefined, 401], [client.member, undefined, 403],
    [client.admin, 'https://evil.example', 403],
  ]) {
    const before = snapshot(db);
    assert.equal((await client.call(cookie, origin)).status, status);
    const after = snapshot(db);
    // Authentication may refresh last_seen_at; all other data must stay unchanged.
    delete before.tables.sessions;
    delete after.tables.sessions;
    assert.deepEqual(after, before);
  }
});

test('authenticated same-origin admin can set up the existing website database and repeat safely', async t => {
  const db = database(t);
  db.sql.exec("UPDATE management_settings SET value='website' WHERE key='mode'");
  const client = await api(db), balances = rows(db, 'member_balances');
  const response = await client.call(client.admin);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { saved: true, accountsActivated: 0 });
  assertEmptyFinance(db);
  assert.deepEqual(rows(db, 'member_balances'), balances);
  assert.deepEqual(rows(db, 'd1_migrations').map(row => row.name), [...baseMigrations, ...financeNames]);
  const audit = rows(db, 'management_audit');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_id, 'admin');
  const repeat = await client.call(client.admin);
  assert.equal(repeat.status, 200);
  assert.deepEqual(await repeat.json(), { saved: true, alreadyEnabled: true });
  assert.deepEqual(rows(db, 'management_audit'), audit);
});
