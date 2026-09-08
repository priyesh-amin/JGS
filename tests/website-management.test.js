import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { activateManagement, saveEvent, savePreparation, saveGuest, saveBalance, saveResults, managementData, importLegacyReviews, resolveLegacyReview, importMissingBooking } from '../functions/_lib/management-store.js';
import { registerMember, cancelMember, updateMemberBooking } from '../functions/_lib/booking-store.js';
import { correctBooking } from '../functions/_lib/admin-store.js';
import { memberBalance } from '../functions/_lib/balance-store.js';
function database() {
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0001_secure_booking','0002_operational_admin_username','0003_wp4_outputs','0004_member_identity_and_password_recovery','0005_website_management']) sql.exec(readFileSync(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'));
  const wrap=(query,args=[])=>({query,args,bind(...values){return wrap(query,values);},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}});
  const db={sql,prepare:wrap,async batch(stmts){sql.exec('BEGIN');try {const results=[];for(const s of stmts)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  for(const [id,role] of [['admin','admin'],['one','member'],['two','member']]) sql.prepare(`INSERT INTO members (id,email,display_name,role,status,password_hash,password_salt,password_iterations,created_at,updated_at) VALUES (?,?,?,?,'active','x','x',1,'2026-01-01','2026-01-01')`).run(id,`${id}@example.test`,id,role);
  sql.exec("INSERT INTO leaderboard_state VALUES (1,'legacy','2026-01-01'); INSERT INTO leaderboard_entries VALUES ('legacy','poy',2025,'Winner','40',1,'2026-01-01')");
  return db;
}
const actor={id:'admin'}, now=new Date('2026-09-08T12:00:00Z');
async function native(db) {db.sql.exec("UPDATE management_settings SET value='website' WHERE key='mode'");return saveEvent(db,actor,null,{title:'September game',venue:'Club',event_date:'2026-09-19',status:'open',cost:'65',registration_opens_at:'2026-09-01T00:00Z',registration_closes_at:'2026-09-12T23:00Z',cancellation_closes_at:'2026-09-12T23:00Z',bookingFields:{capacity:2,questions:[{key:'social',label:'Social meal',type:'select',options:['Yes','No'],required:true}]}});}
const details={dietaryRequirements:'Veg',buggyRequired:true,preferences:{social:'Yes'}};
test('website event lifecycle, live capacity including guests, booking edits, cancellation and preparation',async()=>{
 const db=database(),event=await native(db);
 await assert.rejects(()=>registerMember(db,{memberId:'one',eventId:event.id,input:{...details,preferences:{}},now}),/Social meal/);
 const booking=await registerMember(db,{memberId:'one',eventId:event.id,input:details,now});
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM integration_outbox').first()).n,0);
 await savePreparation(db,actor,booking.id,{group_name:'1',tee_time:'10:00',handicap:'12',notes:'Club list',version:0});
 await assert.rejects(()=>savePreparation(db,actor,booking.id,{group_name:'2',version:0}),/changed/);
 await saveGuest(db,actor,event.id,null,{name:'Guest',dietary:'Veg'});
 await assert.rejects(()=>registerMember(db,{memberId:'two',eventId:event.id,input:details,now}),/capacity/);
 await updateMemberBooking(db,{memberId:'one',eventId:event.id,input:{...details,preferences:{social:'No'}},now});
 assert.equal(JSON.parse((await db.prepare('SELECT preferences_json FROM bookings WHERE id=?').bind(booking.id).first()).preferences_json).social,'No');
 await cancelMember(db,{memberId:'one',eventId:event.id,now});
 await registerMember(db,{memberId:'two',eventId:event.id,input:details,now});
 await assert.rejects(()=>correctBooking(db,booking.id,{status:'registered'},actor,now),/capacity/);
 assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(booking.id).first()).status,'cancelled');
 const edited=await saveEvent(db,actor,event.id,{...event,title:'Edited event'});
 assert.equal(edited.title,'Edited event');
 await assert.rejects(()=>saveEvent(db,actor,event.id,{...event,title:'Stale edit'}),/changed/);
});
test('cutover retains bookings, results and balances and blocks old writers',async t=>{
 const db=database();
 t.mock.method(globalThis,'fetch',async()=>new Response('one,65,,,,,2026-08-31\ntwo,-20'));
 await activateManagement({env:{DB:db,MEMBER_BALANCES_CSV_URL:'https://example.test/balance'}},actor);
 assert.equal((await managementData(db,'status')).mode,'website');
 assert.equal((await managementData(db,'balances')).balances.length,2);
 const results=await managementData(db,'results');assert.equal(results.entries[0].winner,'Winner');
 db.sql.exec("UPDATE leaderboard_state SET active_generation_id='old-worker'; DELETE FROM leaderboard_entries WHERE generation_id <> 'old-worker'");
 assert.equal((await managementData(db,'results')).entries[0].winner,'Winner');
 db.sql.exec("INSERT INTO events (id,title,event_date,source_type,source_key,created_at,updated_at) VALUES ('old','Stale','2026-10-01','google_sheet','old','now','now')");
 assert.equal(await db.prepare("SELECT id FROM events WHERE id='old'").first(),null);
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('Spreadsheets offline');});
 const balance=await memberBalance({env:{DB:db}},{id:'one'});assert.equal(balance.balancePence,6500);
 await saveBalance(db,actor,'one',{version:1,amount:'75',reconciled_on:'2026-09-08',note:'Payment received'});
 await assert.rejects(()=>saveBalance(db,actor,'one',{version:1,amount:'0',reconciled_on:'2026-09-08',note:'Stale'}),/changed/);
 await saveResults(db,actor,{generation:results.generation,entries:[{category:'poy',year:2026,winner:'New winner',score:'45'}]});
 assert.equal((await managementData(db,'results')).entries[0].winner,'New winner');
 await assert.rejects(()=>saveResults(db,actor,{generation:results.generation,entries:[]}),/changed/);
 const backup=await managementData(db,'backup');assert.equal(JSON.stringify(backup).includes('password_hash'),false);
});

test('historical form imports are repeatable and never change live bookings',async()=>{
 const db=database(),event=await native(db);
 const input={source:'September form',csv:'Name,Status,Request\none,Cancelled,Vegetarian breakfast\none,Registered,Buggy'};
 await importLegacyReviews(db,actor,event.id,input);
 await importLegacyReviews(db,actor,event.id,input);
 const rows=(await db.prepare('SELECT * FROM legacy_registration_reviews').all()).results;
 assert.equal(rows.length,2);
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM bookings').first()).count,0);
 await resolveLegacyReview(db,actor,rows[0].id,{resolution:'Checked with member; later website cancellation stands.'});
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM bookings').first()).count,0);
});

test('missing form registration keeps source date and unknown dietary without replacing cancellations',async()=>{
 const db=database(),event=await native(db);
 const input={source:'Original form',csv:'Timestamp,Mandatory: Name,Are you registering or canceling?,LATEST entry requests,Will you attend social\\n2026-08-25 10:00:00,one,Register for event,Vegetarian Breakfast,Yes'.replaceAll('\\n','\n')};
 await importLegacyReviews(db,actor,event.id,input);
 const review=await db.prepare('SELECT * FROM legacy_registration_reviews').first();
 await importMissingBooking(db,actor,review.id,{registeredOn:'2026-08-25'});
 const b=await db.prepare('SELECT * FROM bookings').first();
 assert.equal(b.dietary_requirements,null);
 assert.equal(b.registered_at,'2026-08-25T12:00:00.000Z');
 assert.equal(JSON.parse(b.preferences_json).breakfast,'Vegetarian');
 await correctBooking(db,b.id,{status:'cancelled',dietaryRequirements:null,preferences:JSON.parse(b.preferences_json),preparation:{version:0,group_name:'1'}},actor,now);
 assert.equal((await db.prepare('SELECT status FROM bookings').first()).status,'cancelled');
 await assert.rejects(()=>importMissingBooking(db,actor,review.id,{registeredOn:'2026-08-25'}));
});
