import { ensureManagementSchema } from './management-schema.js';
import { importCompetitionTables } from './competition-tables.js';
import { parseCsv } from './sheet-sync.js';
import { AppError } from './errors.js';
import { validateFields } from './booking-fields.js';
import { websiteManaged } from './management-mode.js';
import { findMemberBalance, findReconciledOn, parseBalancePence } from './balance-store.js';

const bad = message => { throw new AppError(400, 'invalid_details', message); };
const conflict = () => { throw new AppError(409, 'changed', 'Someone changed this record. Refresh before saving again.'); };
const text = (v, max=500) => { if (typeof v !== 'string' || v.length > max) bad(`Enter text of at most ${max} characters.`); return v.trim(); };
const date = v => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '') || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) bad('Enter a valid date.'); return v; };
const stamp = v => { if (!v) return null; if (!Number.isFinite(Date.parse(v))) bad('Enter a valid deadline.'); return new Date(v).toISOString(); };
const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
function audit(db, actor, type, id, before, after) {
  return db.prepare('INSERT INTO management_audit SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes()=1').bind(crypto.randomUUID(), actor.id, type, id, before ? 'updated' : 'created', before ? JSON.stringify(before) : null, JSON.stringify(after), new Date().toISOString());
}
export async function assertManaged(db) {
  if (!await websiteManaged(db)) throw new AppError(409, 'setup_required', 'Complete website management setup first.');
}
export async function managementStatus(db) {
  const mode=await websiteManaged(db)?'website':'legacy';
  return {mode};
}
export async function activateManagement(context, actor) {
  const db = context.env.DB;
  await ensureManagementSchema(db);
  if (await websiteManaged(db)) return managementStatus(db);
  const pending = await db.prepare("SELECT COUNT(*) AS count FROM integration_outbox WHERE status <> 'sent'").first();
  if (pending.count) throw new AppError(409, 'delivery_pending', 'Finish pending booking deliveries before switching.');
  const response = await fetch(context.env.MEMBER_BALANCES_CSV_URL, {headers:{Accept:'text/csv'}});
  if (!response.ok) throw new AppError(502, 'balance_import_failed', 'Existing balances could not be read. No changes were made.');
  const csv = await response.text();
  const competitionTables = await importCompetitionTables();
  const reconciled = findReconciledOn(csv);
  const [events, bookings, results, members, preparation, guests] = await Promise.all([
    all(db,'SELECT * FROM events'), all(db,'SELECT * FROM bookings'),
    all(db,'SELECT * FROM leaderboard_entries WHERE generation_id = (SELECT active_generation_id FROM leaderboard_state WHERE singleton=1)'),
    all(db,"SELECT id,display_name FROM members WHERE role='member'"), all(db,'SELECT * FROM event_preparation'), all(db,'SELECT * FROM event_guests'),
  ]);
  const balances = [], unmatched = [];
  for (const member of members) {
    try {
      if (members.filter(m=>m.display_name.trim().toLowerCase()===member.display_name.trim().toLowerCase()).length !== 1) throw new Error('duplicate');
      balances.push({memberId:member.id,balancePence:findMemberBalance(csv,member.display_name)});
    } catch { unmatched.push(member.display_name); }
  }
  if (!balances.length) bad('No balances could be matched. Existing data was preserved.');
  const now = new Date().toISOString(), generation = `website:${crypto.randomUUID()}`;
  const snapshot = {events,bookings,results,balances,reconciledOn:reconciled,unmatched,preparation,guests,competitionTables};
  await db.batch([
    db.prepare('INSERT INTO management_snapshots VALUES (?, ?, ?)').bind(crypto.randomUUID(),JSON.stringify(snapshot),now),
    db.prepare("INSERT OR IGNORE INTO member_balances (member_id,balance_pence,reconciled_on,note,updated_at) SELECT json_extract(value,'$.memberId'),json_extract(value,'$.balancePence'),?,'Imported from existing Treasurer records',? FROM json_each(?)").bind(reconciled,now,JSON.stringify(balances)),
    ...competitionTables.map(t=>db.prepare('INSERT OR IGNORE INTO competition_tables (id,rows_json,updated_at) VALUES (?,?,?)').bind(t.id,JSON.stringify(t.rows),now)),
    db.prepare("UPDATE events SET source_type='website', updated_at=?").bind(now),
    db.prepare("UPDATE events SET booking_fields_json=json_set(booking_fields_json,'$.questions',json(?)) WHERE event_date>=? AND COALESCE(json_array_length(booking_fields_json,'$.questions'),0)=0").bind(JSON.stringify([{key:'breakfast',label:'Breakfast preference',type:'select',options:['Vegetarian','Standard','Not required'],required:false},{key:'social',label:'Social / meal attendance',type:'select',options:['Yes','No','Maybe'],required:false}]),now.slice(0,10)),
    db.prepare("UPDATE events SET booking_fields_json=json_set(booking_fields_json,'$.isCharity',json('true'),'$.package',COALESCE(json_extract(booking_fields_json,'$.package'),'Full English Breakfast, Lunch, Dinner, On-course drinks, Golf'),'$.schedule',COALESCE(json_extract(booking_fields_json,'$.schedule'),'08:00 Reg, 11:00 Shotgun, 19:00 Dinner'),'$.capacity',COALESCE(json_extract(booking_fields_json,'$.capacity'),128)) WHERE title='Charity Day' AND event_date='2026-06-17'"),
    db.prepare('INSERT INTO leaderboard_entries SELECT ?,category,year,winner,score,source_row,? FROM leaderboard_entries WHERE generation_id=(SELECT active_generation_id FROM leaderboard_state WHERE singleton=1)').bind(generation,now),
    db.prepare('UPDATE leaderboard_state SET active_generation_id=?,updated_at=? WHERE singleton=1').bind(generation,now),
    db.prepare("UPDATE management_settings SET value='website' WHERE key='mode'"),
    audit(db,actor,'setup','website',null,{importedBalances:balances.length,unmatched}),
  ]);
  return {...await managementStatus(db), importedBalances:balances.length,unmatched};
}
export async function saveEvent(db, actor, id, input) {
  await assertManaged(db);
  const before = id ? await db.prepare('SELECT * FROM events WHERE id=?').bind(id).first() : null;
  if (id && !before) throw new AppError(404,'not_found','Event not found.');
  if (before && input.updated_at !== before.updated_at) conflict();
  const value = {...before,...input};
  const title = text(value.title || '',120), venue = text(value.venue || '',200);
  if (!title) bad('Enter an event name.');
  const status = value.status || 'draft';
  if (!['draft','published','open','closed','completed'].includes(status)) bad('Choose a valid status.');
  const dates = ['publication_at','registration_opens_at','registration_closes_at','cancellation_closes_at'].map(k=>stamp(value[k]));
  if (dates[1] && dates[2] && dates[1] >= dates[2]) bad('Registration must open before it closes.');
  if (['published','open'].includes(status) && (!venue || dates.slice(1).some(v=>!v))) bad('Set venue and all booking deadlines before publishing.');
  const cost = value.cost || '';
  if (cost && (parseBalancePence(cost) === null || parseBalancePence(cost)<0)) bad('Enter a valid non-negative cost in pounds.');
  const fields = validateFields(value.bookingFields ?? JSON.parse(value.booking_fields_json || '{}'));
  id ||= crypto.randomUUID();
  const now = new Date(Math.max(Date.now(), (Date.parse(before?.updated_at) || 0)+1)).toISOString();
  const args = [title,venue,date(value.event_date),text(value.meet_time || '',50),text(value.tee_time || '',50),cost,text(value.description || '',5000),text(value.joining_information || '',5000),...dates,status,JSON.stringify(fields),now];
  const write = before ? db.prepare(`UPDATE events SET title=?,venue=?,event_date=?,meet_time=?,tee_time=?,cost=?,description=?,joining_information=?,publication_at=?,registration_opens_at=?,registration_closes_at=?,cancellation_closes_at=?,status=?,booking_fields_json=?,updated_at=? WHERE id=? AND updated_at=?`).bind(...args,id,before.updated_at)
    : db.prepare(`INSERT INTO events (title,venue,event_date,meet_time,tee_time,cost,description,joining_information,publication_at,registration_opens_at,registration_closes_at,cancellation_closes_at,status,booking_fields_json,updated_at,id,source_type,source_key,created_at,timezone) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'website', ?,?,'Europe/London')`).bind(...args,id,id,now);
  const result = await db.batch([write,audit(db,actor,'event',id,before,{...value,bookingFields:fields})]);
  if (!result[0].meta.changes) conflict();
  return db.prepare('SELECT * FROM events WHERE id=?').bind(id).first();
}
export async function preparation(db,eventId) {
  const event = await db.prepare('SELECT * FROM events WHERE id=?').bind(eventId).first();
  if (!event) throw new AppError(404,'not_found','Event not found.');
  return {event,reviews:await all(db,'SELECT * FROM legacy_registration_reviews WHERE event_id=? ORDER BY name',eventId),players:await all(db,`SELECT b.*,m.display_name,m.email,p.group_name,p.tee_time,p.handicap,p.notes,p.version AS preparation_version FROM bookings b JOIN members m ON m.id=b.member_id LEFT JOIN event_preparation p ON p.booking_id=b.id WHERE b.event_id=? ORDER BY m.display_name COLLATE NOCASE`,eventId),guests:await all(db,'SELECT * FROM event_guests WHERE event_id=? ORDER BY name COLLATE NOCASE',eventId)};
}
export async function savePreparation(db,actor,bookingId,input) {
  await assertManaged(db);
  if (!await db.prepare('SELECT id FROM bookings WHERE id=?').bind(bookingId).first()) bad('Booking not found.');
  const before = await db.prepare('SELECT * FROM event_preparation WHERE booking_id=?').bind(bookingId).first();
  if (Number(input.version || 0) !== Number(before?.version || 0)) conflict();
  const values = ['group_name','tee_time','handicap','notes'].map(k=>text(input[k] || '',k==='notes'?1000:80));
  const write = db.prepare(`INSERT INTO event_preparation (booking_id,group_name,tee_time,handicap,notes,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET group_name=excluded.group_name,tee_time=excluded.tee_time,handicap=excluded.handicap,notes=excluded.notes,updated_at=excluded.updated_at,version=event_preparation.version+1 WHERE event_preparation.version=?`).bind(bookingId,...values,new Date().toISOString(),input.version || 0);
  const result = await db.batch([write,audit(db,actor,'preparation',bookingId,before,input)]);
  if (!result[0].meta.changes) conflict();
  return {saved:true};
}
export async function saveGuest(db,actor,eventId,id,input) {
  await assertManaged(db);
  const before = id ? await db.prepare('SELECT * FROM event_guests WHERE id=? AND event_id=?').bind(id,eventId).first() : null;
  if (id && !before) bad('Guest not found.');
  if (before && before.version !== input.version) conflict();
  const name = text(input.name || '',120);
  if (!name) bad('Enter the guest name.');
  const status = input.status || 'registered';
  if (!['registered','cancelled'].includes(status)) bad('Invalid guest status.');
  if (!['','Veg','Non-veg'].includes(input.dietary || '')) bad('Invalid dietary choice.');
  id ||= crypto.randomUUID();
  const vals = [eventId,name,...['handicap','dietary'].map(k=>text(input[k] || '',80)),input.buggy_required?1:0,...['social','group_name','tee_time','notes'].map(k=>text(input[k] || '',k==='notes'?1000:100)),status,new Date().toISOString()];
  const write = before ? db.prepare(`UPDATE event_guests SET event_id=?,name=?,handicap=?,dietary=?,buggy_required=?,social=?,group_name=?,tee_time=?,notes=?,status=?,updated_at=?,version=version+1 WHERE id=? AND version=?`).bind(...vals,id,input.version)
    : db.prepare('INSERT INTO event_guests (event_id,name,handicap,dietary,buggy_required,social,group_name,tee_time,notes,status,updated_at,id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(...vals,id);
  const result = await db.batch([write,audit(db,actor,'guest',id,before,input)]);
  if (!result[0].meta.changes) conflict();
  return {saved:true};
}
export async function balances(db) {
  return all(db,`SELECT m.id,m.display_name,b.balance_pence,b.reconciled_on,b.note,b.version,b.updated_at FROM members m LEFT JOIN member_balances b ON b.member_id=m.id WHERE m.role='member' ORDER BY m.display_name COLLATE NOCASE`);
}
export async function saveBalance(db,actor,id,input) {
  await assertManaged(db);
  const before = await db.prepare('SELECT * FROM member_balances WHERE member_id=?').bind(id).first();
  if (Number(before?.version || 0) !== Number(input.version || 0)) conflict();
  const pence = parseBalancePence(input.amount);
  if (!Number.isSafeInteger(pence) || Math.abs(pence)>100000000) bad('Enter a valid balance in pounds.');
  const note = text(input.note || '',1000);
  if (!note) bad('Add a short reason for the balance update.');
  const result = await db.batch([db.prepare(`INSERT INTO member_balances (member_id,balance_pence,reconciled_on,note,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET balance_pence=excluded.balance_pence,reconciled_on=excluded.reconciled_on,note=excluded.note,updated_at=excluded.updated_at,version=member_balances.version+1 WHERE member_balances.version=?`).bind(id,pence,date(input.reconciled_on),note,new Date().toISOString(),input.version || 0),audit(db,actor,'balance',id,before,input)]);
  if (!result[0].meta.changes) conflict();
  return {saved:true};
}
export async function saveResults(db,actor,input) {
  await assertManaged(db);
  const current = await db.prepare('SELECT * FROM leaderboard_state WHERE singleton=1').first();
  if (input.generation !== current?.active_generation_id) conflict();
  if (!Array.isArray(input.entries) || input.entries.length>500) bad('Provide at most 500 results.');
  const entries = input.entries.map(e=>{
    if (!['poy','singles','radha','doubles'].includes(e.category)) bad('Invalid competition.');
    if (!Number.isInteger(Number(e.year)) || e.year<1900 || e.year>2200) bad('Invalid year.');
    const winner=text(e.winner || '',200); if (!winner) bad('Enter the winner.');
    return {category:e.category,year:Number(e.year),winner,score:text(String(e.score ?? ''),100)};
  });
  const generation=`website:${crypto.randomUUID()}`,now=new Date().toISOString();
  const saved=await db.batch([
    ...entries.map((e,i)=>db.prepare('INSERT INTO leaderboard_entries VALUES (?,?,?,?,?,?,?)').bind(generation,e.category,e.year,e.winner,e.score,i+1,now)),
    db.prepare('UPDATE leaderboard_state SET active_generation_id=?,updated_at=? WHERE singleton=1 AND active_generation_id=?').bind(generation,now,input.generation),
    audit(db,actor,'results',generation,current,entries),
  ]);
  if (!saved[entries.length].meta.changes) conflict();
  return {saved:true};
}
export async function managementData(db,kind) {
  if (kind==='balances') return {balances:await balances(db)};
  if (kind==='results') return {generation:(await db.prepare('SELECT active_generation_id FROM leaderboard_state WHERE singleton=1').first())?.active_generation_id,entries:await all(db,'SELECT * FROM leaderboard_entries WHERE generation_id=(SELECT active_generation_id FROM leaderboard_state WHERE singleton=1) ORDER BY year DESC,category')};
  if (kind==='history') return {history:await all(db,'SELECT a.*,m.display_name AS actor FROM management_audit a JOIN members m ON m.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100')};
  if (kind==='backup') return {exportedAt:new Date().toISOString(),events:await all(db,'SELECT * FROM events'),bookings:await all(db,'SELECT * FROM bookings'),members:await all(db,"SELECT id,display_name,email,role,status FROM members WHERE username IS NULL AND role='member'"),balances:await balances(db),preparation:await all(db,'SELECT * FROM event_preparation'),guests:await all(db,'SELECT * FROM event_guests'),results:await managementData(db,'results'),competitionTables:await all(db,'SELECT * FROM competition_tables'),legacyReviews:await all(db,'SELECT * FROM legacy_registration_reviews')};
  return managementStatus(db);
}

export async function importLegacyReviews(db,actor,eventId,input) {
  await assertManaged(db);
  const source=text(input.source || 'Historical form',200);
  const rows=parseCsv(text(input.csv || '',100000));
  if (rows.length<2 || rows.length>501) bad('Upload a CSV with a header and up to 500 responses.');
  const headers=rows[0];
  const nameIndex=headers.findIndex(h=>/name/i.test(h) && !/guest/i.test(h));
  if (nameIndex<0) bad('The CSV needs a player name column.');
  const statements=[];
  for (const row of rows.slice(1)) {
    if (!row[nameIndex]?.trim()) continue;
    const details=JSON.stringify(Object.fromEntries(headers.map((h,i)=>[h,row[i] || ''])));
    const bytes=new TextEncoder().encode(eventId+source+details);
    const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    statements.push(db.prepare('INSERT OR IGNORE INTO legacy_registration_reviews (id,event_id,source,name,details_json) VALUES (?,?,?,?,?)').bind(key,eventId,source,text(row[nameIndex],120),details));
  }
  if (!statements.length) bad('No named registrations found.');
  await db.batch([...statements,audit(db,actor,'legacy_review',eventId,null,{source,rows:statements.length})]);
  return {saved:true};
}
export async function resolveLegacyReview(db,actor,id,input) {
  const note=text(input.resolution || '',1000);if(!note) bad('Record how you checked this entry.');
  const before=await db.prepare('SELECT * FROM legacy_registration_reviews WHERE id=?').bind(id).first();
  if(!before) bad('Review not found.');
  await db.batch([db.prepare('UPDATE legacy_registration_reviews SET resolution=?,resolved_by=?,resolved_at=? WHERE id=?').bind(note,actor.id,new Date().toISOString(),id),audit(db,actor,'legacy_review',id,before,{resolution:note})]);
  return {saved:true};
}
