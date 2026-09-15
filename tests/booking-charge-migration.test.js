import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

test('booking charge migration links existing invoices without changing balances or charging old bookings',()=>{
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  const dir=new URL('../migrations/',import.meta.url);
  for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n<'0007').sort())db.exec(readFileSync(new URL(name,dir),'utf8'));
  db.exec(`INSERT INTO members(id,email,display_name,role,status,password_hash,password_salt,password_iterations,created_at,updated_at)
    VALUES('member','member@example.test','Example Member','member','active','x','x',1,'2026-01-01','2026-01-01');
    INSERT INTO events(id,title,venue,event_date,cost,source_type,source_key,created_at,updated_at)
    VALUES('golf','Golf','Club','2026-09-20','65','website','golf','2026-01-01','2026-01-01');
    INSERT INTO bookings(id,member_id,event_id,status,registered_at,updated_at)
    VALUES('booking','member','golf','registered','2026-08-01','2026-08-01');
    INSERT INTO finance_accounts VALUES('member','2026-07-31','2026-08-01','member');
    INSERT INTO finance_journal(id,member_id,kind,amount_pence,posted_on,due_on,note,created_at,actor_id)
    VALUES('event:booking','member','charge',-6500,'2026-08-01','2026-09-20','Original invoice','2026-08-01','member');`);
  const before=db.prepare('SELECT * FROM finance_journal').all();
  db.exec(readFileSync(new URL('0007_booking_charges.sql',dir),'utf8'));
  assert.deepEqual(db.prepare('SELECT * FROM finance_journal').all(),before);
  const link=db.prepare('SELECT * FROM finance_booking_charges').get();
  assert.equal(link.journal_id,'event:booking');
  assert.equal(link.cancellation_charge_policy,'review');
  assert.equal(db.prepare('SELECT revision FROM finance_state').get().revision,0);
  assert.throws(()=>db.exec("UPDATE finance_journal SET amount_pence=0"),/immutable/);
  db.close();
});
