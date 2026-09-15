import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {parseBank,suggestMember,BANK_COLUMNS} from '../functions/_lib/reconciliation/bank.js';
import {preview,stage,openAccount,resolveRow,resolveBatch,statement,addEntry,reverseEntry,claimPayment,eventChargePreview,postEventCharges,dashboard,financeBackup} from '../functions/_lib/reconciliation/store.js';
import {issueSession} from '../functions/_lib/auth.js';
import {onRequest} from '../functions/api/[[path]].js';
import {registerMember} from '../functions/_lib/booking-store.js';

function database(){
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
  for(const f of readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(`../migrations/${f}`,import.meta.url),'utf8'));
  const wrap=(query,args=[])=>({query,args,bind(...a){return wrap(query,a);},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}});
  const db={sql,prepare:wrap,async batch(stmts){sql.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  for(const [id,name,role] of [['admin','Admin','admin'],['one','Alex Example','member'],['two','Sam Example','member']])sql.prepare(`INSERT INTO members (id,email,display_name,role,status,password_hash,password_salt,password_iterations,created_at,updated_at) VALUES (?,?,?,?,'active','x','x',1,'2026-01-01','2026-01-01')`).run(id,`${id}@example.test`,name,role);
  return db;
}
const actor={id:'admin'};
const rev=async db=>(await db.prepare('SELECT revision FROM finance_state').first()).revision;
const source=(rows)=>({rows:[BANK_COLUMNS,...rows],coverageFrom:'2026-08-01',coverageThrough:'2026-08-31',filename:'synthetic.xlsx'});
const row=(amount='65',memo='Alex Example golf',date='2026-08-10')=>['\t0',date,'TEST-ACCOUNT',amount,'Counter Credit',memo];
async function opening(db,id='one',amount='0') {return openAccount(db,actor,{revision:await rev(db),memberId:id,openingOn:'2026-07-31',amount,note:'Verified synthetic opening',confirmed:true});}
async function imported(db,rows){const input=source(rows),p=await preview(db,input);await stage(db,actor,{...input,revision:p.revision});return (await db.prepare('SELECT * FROM finance_bank_rows WHERE import_id=? ORDER BY id').bind(p.id).all()).results;}
const treatment=(id,memberId='one',amount='65')=>({id,status:'posted',note:'Memo reviewed',splits:[{memberId,amount,description:'Event payment',eventCode:'TRIP26',category:'Accommodation'}]});

test('confirmed booking to bank payment updates the private account without manual invoicing',async()=>{
  const db=database();await opening(db,'one','20');
  db.sql.exec(`INSERT INTO events(id,title,venue,event_date,cost,payment_due_on,source_type,source_key,status,registration_opens_at,registration_closes_at,cancellation_closes_at,created_at,updated_at)
    VALUES('golf','Golf','Club','2026-08-20','65','2026-08-02','website','golf','published','2026-07-01T00:00:00Z','2026-08-15T00:00:00Z','2026-08-19T00:00:00Z','2026-07-01','2026-07-01')`);
  await registerMember(db,{memberId:'one',eventId:'golf',input:{dietaryRequirements:'Veg'},now:new Date('2026-08-01T12:00:00Z')});
  assert.equal((await statement(db,'one')).dueNowPence,4500);
  const [bank]=await imported(db,[row('50')]);
  assert.equal((await statement(db,'one')).dueNowPence,4500);
  await resolveRow(db,actor,bank.id,{...treatment(bank.id,'one','50'),revision:await rev(db)});
  const account=await statement(db,'one');
  assert.equal(account.dueNowPence,0);assert.equal(account.availableCreditPence,500);
  assert.equal(account.entries.filter(e=>e.kind==='charge').length,1);
});

test('correcting the payer reverses the original allocation and preserves evidence',async()=>{
  const db=database();await opening(db);await opening(db,'two');
  const [bank]=await imported(db,[row()]);
  await resolveRow(db,actor,bank.id,{...treatment(bank.id),revision:await rev(db)});
  await resolveRow(db,actor,bank.id,{...treatment(bank.id,'two'),reassign:true,revision:await rev(db)});
  assert.equal((await statement(db,'one')).availableCreditPence,0);
  assert.equal((await statement(db,'two')).availableCreditPence,6500);
  const view=await dashboard(db),backup=await financeBackup(db);
  assert.equal(view.resolved.length,1);
  assert.equal(view.accounts.find(a=>a.id==='two').availableCreditPence,6500);
  assert.equal(backup.finance_bank_rows[0].raw_json,bank.raw_json);
  assert.equal(backup.finance_journal.filter(e=>e.bank_row_id===bank.id).length,3);
  assert.equal(backup.audit.filter(a=>a.action==='bank_row_resolved').length,2);
});

test('bank format accepts tabs, UK/ISO dates, blank trailing row, and repeated zero Number',async()=>{
  const p=await parseBank(source([row(),row('55','Other payer','11/08/2026'),['\t','','','','','']]));
  assert.equal(p.rows.length,2);assert.equal(p.rows[0].number,'0');assert.notEqual(p.rows[0].fingerprint,p.rows[1].fingerprint);
  assert.equal(p.rows[1].postedOn,'2026-08-11');assert.equal(p.rows[0].raw[0],'\t0');
  for(const bad of [source([row('1.234')]),source([row('0')]),source([row('5','memo','31/02/2026')]),source([row('5','memo','2026-09-01')])])await assert.rejects(async()=>parseBank(bad));
});
test('memo full-name suggestions never choose a surname-only or ambiguous member',()=>{
  const members=[{id:'one',display_name:'Alex Example'},{id:'two',display_name:'Sam Example'}];
  assert.equal(suggestMember('PAYER\tAlex Example golf',members),'one');
  assert.equal(suggestMember('EXAMPLE golf',members),null);
  assert.equal(suggestMember('Alex Example and Sam Example',members),null);
  assert.equal(suggestMember('Alex Example', [...members,{id:'three',display_name:'Alex Example'}]),null);
});
test('preview and staging preserve all movements without changing accounts; reordered replay stages once',async()=>{
  const db=database();await opening(db,'one','20');const input=source([row(),row('-25.45','Supplier debit')]);
  const p=await preview(db,input);assert.equal((await statement(db,'one')).availableCreditPence,2000);
  await stage(db,actor,{...input,revision:p.revision});
  const again=await stage(db,actor,{...source(input.rows.slice(1).reverse()),revision:await rev(db)});
  assert.equal(again.alreadyImported,true);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM finance_bank_rows').first()).n,2);
  assert.equal((await statement(db,'one')).availableCreditPence,2000);
});
test('charge, receipt, partial settlement, categories, reversal and private statement',async()=>{
  const db=database();await opening(db,'one','20');
  await addEntry(db,actor,{revision:await rev(db),requestId:'charge',memberId:'one',kind:'charge',amount:'65',postedOn:'2026-08-01',dueOn:'2026-08-02',note:'Golf day',category:'Golf'});
  assert.equal((await statement(db,'one')).dueNowPence,4500);
  const [bank]=await imported(db,[row('60')]);await resolveRow(db,actor,bank.id,{...treatment(bank.id,'one','60'),revision:await rev(db)});
  const s=await statement(db,'one');assert.equal(s.dueNowPence,0);assert.equal(s.availableCreditPence,1500);assert.equal(s.entries.find(e=>e.kind==='receipt').category,'Accommodation');
  assert.equal(JSON.stringify(s).includes('TEST-ACCOUNT'),false);assert.equal(JSON.stringify(s).includes('Alex Example golf'),false);
  assert.equal((await statement(db,'two')).active,false);
  await reverseEntry(db,actor,{revision:await rev(db),id:s.entries.find(e=>e.kind==='receipt').id,note:'Wrong assignment'});
  assert.equal((await statement(db,'one')).dueNowPence,4500);
  await assert.rejects(async()=>reverseEntry(db,actor,{revision:await rev(db),id:s.entries.find(e=>e.kind==='receipt').id,note:'Repeat'}));
  assert.throws(()=>db.sql.exec("UPDATE finance_journal SET amount_pence=0"),/immutable/);
});
test('split receipt conserves amount; invalid final split leaves whole batch unchanged',async()=>{
  const db=database();await opening(db);await opening(db,'two');const [bank]=await imported(db,[row('100')]);
  const input={...treatment(bank.id),revision:await rev(db),splits:[{memberId:'one',amount:'60',description:'Part one'},{memberId:'two',amount:'39',description:'Part two'}]};
  await assert.rejects(async()=>resolveRow(db,actor,bank.id,input),/whole bank/);
  assert.equal((await statement(db,'one')).availableCreditPence,0);
  input.splits[1].amount='40';await resolveRow(db,actor,bank.id,input);
  assert.equal((await statement(db,'one')).availableCreditPence,6000);assert.equal((await statement(db,'two')).availableCreditPence,4000);
  await assert.rejects(async()=>resolveRow(db,actor,bank.id,input),/unresolved/);
});
test('overlapping fingerprints require review; duplicates cannot reference only unresolved rows',async()=>{
  const db=database();await opening(db);const [first,second]=await imported(db,[row(),row()]);
  await assert.rejects(async()=>resolveRow(db,actor,first.id,{revision:await rev(db),status:'duplicate',note:'Repeated'}),/First resolve/);
  await assert.rejects(async()=>resolveRow(db,actor,first.id,{...treatment(first.id),revision:await rev(db)}),/similar transaction/);
  await resolveRow(db,actor,first.id,{...treatment(first.id),revision:await rev(db),distinctConfirmed:true});
  await resolveRow(db,actor,second.id,{revision:await rev(db),status:'duplicate',note:'Same movement repeated'});
  assert.equal((await statement(db,'one')).availableCreditPence,6500);
});
test('stale revisions and member pre-cutoff receipts fail without any partial writes',async()=>{
  const db=database();await opening(db);const [bank]=await imported(db,[row()]);const stale=await rev(db);await opening(db,'two');
  await assert.rejects(async()=>resolveRow(db,actor,bank.id,{...treatment(bank.id),revision:stale}),/changed/);
  assert.equal((await statement(db,'one')).availableCreditPence,0);assert.equal((await db.prepare('SELECT status FROM finance_bank_rows').first()).status,'pending');
  const other=database();await openAccount(other,actor,{revision:0,memberId:'one',openingOn:'2026-08-10',amount:'65',note:'Includes receipt',confirmed:true});const [r]=await imported(other,[row()]);
  await assert.rejects(async()=>resolveRow(other,actor,r.id,{...treatment(r.id),revision:await rev(other)}),/cutoff/);
});
test('claims never clear debt; bulk receipt confirmation is atomic',async()=>{
  const db=database();await opening(db,'one','-65');await opening(db,'two');
  await claimPayment(db,{id:'one'},{amount:'65',paidOn:'2026-08-10',reference:'Ref',requestId:'claim'});
  assert.equal((await statement(db,'one')).dueNowPence,6500);
  const rows=await imported(db,[row(),row('20','Sam Example')]);
  await assert.rejects(async()=>resolveBatch(db,actor,{revision:await rev(db),rows:[treatment(rows[0].id),treatment(rows[1].id,'two','19')]}));
  assert.equal((await statement(db,'one')).dueNowPence,6500);
  await resolveBatch(db,actor,{revision:await rev(db),rows:[treatment(rows[0].id),treatment(rows[1].id,'two','20')]});
  assert.equal((await statement(db,'one')).dueNowPence,0);assert.equal((await statement(db,'two')).availableCreditPence,2000);
});
test('event charge preview excludes already invoiced bookings and posts explicit batch once',async()=>{
  const db=database();await opening(db);
  db.sql.exec("INSERT INTO events (id,title,venue,event_date,source_type,source_key,created_at,updated_at) VALUES ('event','Golf','Test club','2026-09-20','manual','event','now','now'); INSERT INTO bookings (id,event_id,member_id,status,registered_at,updated_at) VALUES ('booking','event','one','registered','2026-08-01','2026-08-01')");
  const input={eventId:'event',amount:'65',postedOn:'2026-08-01',dueOn:'2026-12-01'};
  assert.equal((await eventChargePreview(db,input)).bookings[0].eligible,true);
  await postEventCharges(db,actor,{...input,revision:await rev(db),bookingIds:['booking'],confirmed:true});
  const s=await statement(db,'one');assert.equal(s.dueNowPence,0);assert.equal(s.upcomingPence,6500);
  assert.equal((await eventChargePreview(db,input)).bookings[0].eligible,false);
});

test('real API enforces session, role, same-origin writes and own-account scope',async()=>{
  const db=database();await opening(db,'one','10');await opening(db,'two','20');
  db.sql.exec("UPDATE members SET must_change_password=0; UPDATE management_settings SET value='website' WHERE key='mode'");
  const env={DB:db,APP_ORIGIN:'https://jgs.example.test'};
  const session=async id=>(await issueSession({env,request:new Request(env.APP_ORIGIN)},await db.prepare('SELECT * FROM members WHERE id=?').bind(id).first())).cookie.split(';')[0];
  const one=await session('one'),admin=await session('admin');
  const call=(path,cookie,method='GET',body,origin=env.APP_ORIGIN)=>onRequest({env,request:new Request(`${env.APP_ORIGIN}/api/${path}`,{method,headers:{...(cookie?{cookie}:{}),'content-type':'application/json',origin},...(body?{body:JSON.stringify(body)}:{})})});
  assert.equal((await call('admin/reconciliation',null)).status,401);
  assert.equal((await call('admin/reconciliation',one)).status,403);
  assert.equal((await call('admin/reconciliation/open',admin,'POST',{},'https://evil.example')).status,403);
  const s=await (await call('account/statement?memberId=two',one)).json();
  assert.equal(s.memberId,'one');assert.equal(s.availableCreditPence,1000);
  const claim=await call('account/statement/claims',one,'POST',{memberId:'two',amount:'5',paidOn:'2026-08-10',reference:'test',requestId:'api-claim'});
  assert.equal(claim.status,200);assert.equal((await statement(db,'one')).claims.length,1);assert.equal((await statement(db,'two')).claims.length,0);
});

test('confirmed refunds reduce credit; unassigned outgoings never charge members',async()=>{
  const db=database();await opening(db,'one','100');const rows=await imported(db,[row('-25','Refund'),row('-30','Supplier')]);
  await resolveRow(db,actor,rows[0].id,{...treatment(rows[0].id,'one','25'),revision:await rev(db)});
  await resolveRow(db,actor,rows[1].id,{revision:await rev(db),status:'non_member',note:'Club expense'});
  assert.equal((await statement(db,'one')).availableCreditPence,7500);
});

test('coverage gaps are not hidden by a recent upload; legacy balances are locked after activation',async()=>{
  const db=database();db.sql.exec("INSERT INTO member_balances VALUES ('one',2000,'2026-07-31','old',1,'now')");await opening(db,'one','20');
  const input={...source([row()]),coverageFrom:'2026-08-05'};const p=await preview(db,input);await stage(db,actor,{...input,revision:p.revision});
  assert.equal((await statement(db,'one')).bankDataThrough,'2026-07-31');
  assert.throws(()=>db.sql.exec("UPDATE member_balances SET balance_pence=0 WHERE member_id='one'"),/reconciliation adjustments/);
});
