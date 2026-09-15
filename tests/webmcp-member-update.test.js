import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { updateMember } from '../functions/_lib/admin-store.js';

const stamp = '2026-09-15T10:00:00.000Z';
function database(t, race = false) {
  const sql = new DatabaseSync(':memory:'); t.after(() => sql.close());
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  for (const [id, role] of [['admin', 'admin'], ['member', 'member']]) sql.prepare(`INSERT INTO members (id,email,display_name,role,status,password_hash,password_salt,password_iterations,created_at,updated_at) VALUES (?,?,?,?,'active','x','x',1,?,?)`).run(id, `${id}@example.test`, id, role, stamp, stamp);
  sql.exec("INSERT INTO sessions (id_hash,member_id,created_at,expires_at,last_seen_at) VALUES ('test','member','2026','2099','2026')");
  const prepare = (query, args = []) => ({ bind(...values) { return prepare(query, values); }, async first() { return sql.prepare(query).get(...args); }, async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; } });
  return { sql, prepare, async batch(statements) {
    if (race) sql.prepare('UPDATE members SET updated_at=? WHERE id=?').run('2026-09-15T11:00:00.000Z', 'member');
    sql.exec('BEGIN'); try { const result=[]; for (const s of statements) result.push(await s.run()); sql.exec('COMMIT'); return result; } catch(e) { sql.exec('ROLLBACK'); throw e; }
  } };
}

test('confirmed guarded email change records actor and revokes sessions atomically', async t => {
  const db = database(t);
  await updateMember(db, 'member', { email: 'new@example.test', expectedUpdatedAt: stamp }, { id:'admin' }, '', new Date('2026-09-15T11:00:00.000Z'));
  assert.equal(db.sql.prepare("SELECT email FROM members WHERE id='member'").get().email, 'new@example.test');
  const audit = db.sql.prepare('SELECT * FROM management_audit').get();
  assert.equal(audit.actor_id, 'admin'); assert.equal(audit.entity_id, 'member');
  assert.deepEqual(JSON.parse(audit.after_json), { displayName: 'member', email:'new@example.test' });
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
});

test('racing member update cannot overwrite details, append an audit or revoke sessions', async t => {
  const db = database(t, true);
  await assert.rejects(updateMember(db, 'member', { email:'new@example.test', expectedUpdatedAt:stamp }, { id:'admin' }, '', new Date('2026-09-15T11:00:00.000Z')), { code:'member_changed' });
  assert.equal(db.sql.prepare("SELECT email FROM members WHERE id='member'").get().email, 'member@example.test');
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM management_audit').get().count, 0);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 1);
});

test('guarded detail update rejects stale versions and privilege fields', async t => {
  const db=database(t);
  await assert.rejects(updateMember(db,'member',{displayName:'Changed',expectedUpdatedAt:'old'},{id:'admin'},''),{code:'member_changed'});
  await assert.rejects(updateMember(db,'member',{role:'admin',expectedUpdatedAt:stamp},{id:'admin'},''),{code:'invalid_member_update'});
});
