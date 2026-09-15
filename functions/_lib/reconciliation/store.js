import { AppError } from '../errors.js';
import { dateKey, accountStatement } from './account.js';
import { amountPence } from './import-preview.js';
import { parseBank, suggestMember, clean } from './bank.js';

const all = async (db, query, ...args) => (await db.prepare(query).bind(...args).all()).results;
const bad = message => { throw new AppError(400, 'invalid_reconciliation', message); };
const now = () => new Date().toISOString();
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const text = (v, max=500) => { const s=clean(v); if (!s || s.length>max) bad(`Enter text between 1 and ${max} characters.`); return s; };
function date(v) { try { return dateKey(v); } catch { bad('Enter a valid date.'); } }
function amount(v) { try { const n=amountPence(String(v)); if (Math.abs(n)>100000000) bad('Amount too large.'); return n; } catch { bad('Enter pounds with at most two decimal places.'); } }
export async function financeAvailable(db) {
  return (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='finance_state'").first())?.name==='finance_state';
}
async function bookingFinanceAvailable(db) {
  return (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='finance_booking_reviews'").first())?.name==='finance_booking_reviews';
}
async function revision(db) { return (await db.prepare('SELECT revision FROM finance_state WHERE id=1').first()).revision; }
async function unchanged(db, start) {
  if(start!==await revision(db)) throw new AppError(409,'finance_changed','Records changed while loading. Refresh before continuing.');
}
function guards(db, expected) {
  return [db.prepare('UPDATE finance_state SET revision=revision+1 WHERE id=1 AND revision=?').bind(expected),
    db.prepare("SELECT CASE WHEN changes()=1 THEN 1 ELSE json('finance_stale') END")];
}
async function commit(db, expected, statements, actor, action, detail) {
  try {
    await db.batch([...guards(db,expected),...statements,db.prepare('INSERT INTO management_audit (id,actor_id,entity_type,entity_id,action,after_json,created_at) VALUES (?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),actor.id,'reconciliation',String(detail.id || ''),action,JSON.stringify(detail),now())]);
  } catch (e) {
    if (/malformed JSON|UNIQUE constraint|finance_duplicate_booking_charge/.test(e.message)) throw new AppError(409,'finance_changed','Records changed or this action was already saved. Refresh before continuing.');
    throw e;
  }
}
async function members(db) { return all(db,"SELECT id,display_name FROM members WHERE role='member' AND username IS NULL ORDER BY display_name"); }
function journal(db, actor, e) {
  return db.prepare(`INSERT INTO finance_journal (id,member_id,kind,amount_pence,posted_on,due_on,event_code,category,note,bank_row_id,reverses_id,created_at,actor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(e.id,e.memberId,e.kind,e.value,e.date,e.dueOn || e.date,e.eventCode || '',e.category || '',e.note,e.bankRowId || null,e.reversesId || null,now(),actor.id);
}

export async function statement(db, memberId) {
  if (!await financeAvailable(db)) return {active:false};
  const start=await revision(db);
  const account=await db.prepare('SELECT * FROM finance_accounts WHERE member_id=?').bind(memberId).first();
  if (!account) return {active:false};
  // Never return bank memo, raw source, administrator IDs or another member's split.
  const entries=await all(db,'SELECT id,kind,amount_pence,posted_on,due_on,event_code,category,note,reverses_id FROM finance_journal WHERE member_id=? ORDER BY posted_on,created_at,id',memberId);
  const imports=await all(db,'SELECT coverage_from,coverage_through,created_at FROM finance_imports ORDER BY coverage_from');
  const pending=await all(db,"SELECT posted_on FROM finance_bank_rows WHERE status='pending'");
  const claims=await all(db,'SELECT id,amount_pence,paid_on,reference,status,resolution FROM finance_claims WHERE member_id=? ORDER BY created_at DESC',memberId);
  const bookingChargesEnabled=await bookingFinanceAvailable(db);
  const bookingReviews=bookingChargesEnabled?await all(db,`SELECT e.title AS event_title,r.created_at,r.status,r.resolution
    FROM finance_booking_reviews r JOIN bookings b ON b.id=r.booking_id JOIN events e ON e.id=b.event_id
    WHERE b.member_id=? ORDER BY r.created_at DESC`,memberId):[];
  await unchanged(db,start);
  return {...projectStatement(memberId,account,entries,imports,pending,claims),bookingReviews,bookingChargesEnabled};
}

function projectStatement(memberId,account,entries,imports,pending,claims) {
  const reversed=new Set(entries.map(e=>e.reverses_id).filter(Boolean));
  const effective=entries.filter(e=>e.kind!=='reversal' && !reversed.has(e.id));
  const charges=effective.filter(e=>e.amount_pence<0).map(e=>({id:e.id,memberId,status:'posted',amountPence:-e.amount_pence,dueOn:e.due_on,eventCode:e.event_code,category:e.category,note:e.note}));
  const funds=effective.filter(e=>e.amount_pence>0).map(e=>({id:e.id,memberId,status:'posted',amountPence:e.amount_pence}));
  // Explicit v1 rule: unrestricted credit funds oldest due charges first.
  const remaining=new Map(funds.map(f=>[f.id,f.amountPence])), allocations=[];
  for (const c of [...charges].sort((a,b)=>a.dueOn.localeCompare(b.dueOn)||a.id.localeCompare(b.id))) {
    let unpaid=c.amountPence;
    for (const f of funds) {
      const value=Math.min(unpaid,remaining.get(f.id));
      if (value) { allocations.push({id:`${f.id}:${c.id}`,chargeId:c.id,fundId:f.id,amountPence:value}); remaining.set(f.id,remaining.get(f.id)-value); unpaid-=value; }
    }
  }
  let covered=account.opening_on;
  for (const i of imports) {
    const next=new Date(`${covered}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
    if (i.coverage_from<=next.toISOString().slice(0,10) && i.coverage_through>covered) covered=i.coverage_through;
  }
  return {active:true,...accountStatement({memberId,charges,funds,allocations,asOf:today()}),entries,
    openingOn:account.opening_on,bankDataThrough:covered,unresolvedBankItems:pending.some(r=>r.posted_on>account.opening_on),
    coverageBasis:'Administrator-declared export period; not a live bank feed',
    lastImportedAt:imports.map(i=>i.created_at).sort().at(-1) || null,
    claims};
}

export async function dashboard(db) {
  if (!await financeAvailable(db)) return {available:false};
  const start=await revision(db);
  const roster=await members(db);
  const pending=await all(db,"SELECT * FROM finance_bank_rows WHERE status='pending' ORDER BY posted_on,id");
  const fingerprints=await all(db,"SELECT fingerprint,COUNT(*) AS n FROM finance_bank_rows WHERE status<>'duplicate' GROUP BY fingerprint");
  const accounts=await all(db,'SELECT * FROM finance_accounts');
  const entries=await all(db,'SELECT member_id,id,kind,amount_pence,posted_on,due_on,event_code,category,note,reverses_id FROM finance_journal ORDER BY posted_on,created_at,id');
  const imports=await all(db,'SELECT id,filename,coverage_from,coverage_through,created_at FROM finance_imports ORDER BY coverage_from');
  const resolved=await all(db,"SELECT * FROM finance_bank_rows WHERE status<>'pending' ORDER BY resolved_at DESC LIMIT 100");
  const claims=await all(db,"SELECT c.*,m.display_name FROM finance_claims c JOIN members m ON m.id=c.member_id WHERE c.status='pending'");
  const controlTotals=await all(db,"SELECT status,COUNT(*) AS count,SUM(CASE WHEN amount_pence>0 THEN amount_pence ELSE 0 END) AS in_pence,SUM(CASE WHEN amount_pence<0 THEN -amount_pence ELSE 0 END) AS out_pence FROM finance_bank_rows GROUP BY status");
  const bookingChargesEnabled=await bookingFinanceAvailable(db);
  const bookingReviews=bookingChargesEnabled?await all(db,`SELECT r.id,r.created_at,m.display_name AS member_name,e.title AS event_title,-j.amount_pence AS amount_pence
    FROM finance_booking_reviews r JOIN bookings b ON b.id=r.booking_id JOIN members m ON m.id=b.member_id
    JOIN events e ON e.id=b.event_id JOIN finance_journal j ON j.id=r.journal_id WHERE r.status='pending' ORDER BY r.created_at`):[];
  const openingBookings=bookingChargesEnabled?await all(db,`SELECT o.booking_id,o.disposition,b.status,e.title AS event_title,m.display_name AS member_name
    FROM finance_opening_bookings o JOIN bookings b ON b.id=o.booking_id JOIN events e ON e.id=b.event_id
    JOIN members m ON m.id=o.member_id WHERE o.disposition='review'
    AND NOT EXISTS(SELECT 1 FROM finance_booking_charges c WHERE c.booking_id=b.id)`):[];
  await unchanged(db,start);
  return {available:true,revision:start,members:roster,
    accounts:roster.map(m=>{const account=accounts.find(a=>a.member_id===m.id);return {...m,...(account?projectStatement(m.id,account,entries.filter(e=>e.member_id===m.id),imports,pending,[]):{active:false})};}),
    imports,controlTotals,bookingReviews,bookingChargesEnabled,openingBookings,
    pending:pending.map(r=>({...r,suggestedMemberId:r.amount_pence>0?suggestMember(r.memo,roster):null,possibleDuplicate:(fingerprints.find(f=>f.fingerprint===r.fingerprint)?.n || 0)>1})),
    resolved:resolved.map(r=>({...r,possibleDuplicate:(fingerprints.find(f=>f.fingerprint===r.fingerprint)?.n || 0)>(r.status==='duplicate'?0:1)})),
    claims};
}

export async function financeBackup(db) {
  if(!await financeAvailable(db)) return {available:false};
  const start=await revision(db);
  const bookingEnabled=await bookingFinanceAvailable(db);
  const result={exportedAt:now(),schemaVersion:bookingEnabled?7:6};
  for(const table of ['finance_state','finance_accounts','finance_imports','finance_bank_rows','finance_journal','finance_claims']) result[table]=await all(db,`SELECT * FROM ${table}`);
  if(bookingEnabled) for(const table of ['finance_booking_charges','finance_booking_reviews','finance_opening_bookings']) result[table]=await all(db,`SELECT * FROM ${table}`);
  result.audit=await all(db,"SELECT * FROM management_audit WHERE entity_type='reconciliation' ORDER BY created_at");
  if(start!==await revision(db)) throw new AppError(409,'finance_changed','Records changed during backup. Download again.');
  return result;
}

export async function preview(db, input) {
  const start=await revision(db);
  let parsed; try { parsed=await parseBank(input); } catch(e) { bad(e.message); }
  if (parsed.coverageThrough>today()) bad('Export coverage cannot be in the future.');
  const roster=await members(db), existing=await all(db,'SELECT fingerprint,status,id FROM finance_bank_rows');
  const accounts=await all(db,'SELECT DISTINCT account FROM finance_imports');
  if (accounts.length && accounts.some(a=>a.account!==parsed.account)) bad('This reconciliation workspace uses a different bank account.');
  const imported=!!await db.prepare('SELECT id FROM finance_imports WHERE id=?').bind(parsed.id).first();
  const counts=new Map();for(const r of parsed.rows)counts.set(r.fingerprint,(counts.get(r.fingerprint)||0)+1);
  await unchanged(db,start);
  return {...parsed,revision:start,alreadyImported:imported,
    rows:parsed.rows.map(r=>({...r,suggestedMemberId:r.amountPence>0?suggestMember(r.memo,roster):null,
      possibleDuplicates:existing.filter(e=>e.fingerprint===r.fingerprint).map(e=>e.id),
      repeatedInFile:counts.get(r.fingerprint)>1})),
    warning:'Number is not a transaction ID. Similar rows require review. Staging does not affect member balances.'};
}

export async function stage(db, actor, input) {
  const p=await preview(db,input);
  if (p.alreadyImported) return {id:p.id,alreadyImported:true};
  if (input.revision!==p.revision) throw new AppError(409,'finance_changed','Refresh the import preview.');
  const queries=[db.prepare('INSERT INTO finance_imports VALUES (?,?,?,?,?,?,?)').bind(p.id,p.account,text(input.filename,150),p.coverageFrom,p.coverageThrough,now(),actor.id)];
  // JSON bulk insert stays below D1's statement/bind count limits for large files.
  queries.push(db.prepare(`INSERT INTO finance_bank_rows (id,import_id,fingerprint,posted_on,amount_pence,memo,subcategory,raw_json)
    SELECT ? || ':' || key,?,json_extract(value,'$.fingerprint'),json_extract(value,'$.postedOn'),json_extract(value,'$.amountPence'),json_extract(value,'$.memo'),json_extract(value,'$.subcategory'),json_extract(value,'$.raw') FROM json_each(?)`).bind(p.id,p.id,JSON.stringify(p.rows)));
  await commit(db,p.revision,queries,actor,'import_staged',{id:p.id,count:p.rows.length});
  return {id:p.id};
}

export async function openAccount(db, actor, input) {
  const id=text(input.memberId), d=date(input.openingOn), value=amount(input.amount);
  if (!(await members(db)).some(m=>m.id===id)) bad('Choose a member.');
  if (d>=today()) bad('Choose an opening cutoff before today in Europe/London, using a verified balance through that completed day.');
  if (input.confirmed!==true) bad('Confirm the opening balance and cutoff, including existing event charges.');
  const note=text(input.note);
  await commit(db,input.revision,[db.prepare('INSERT INTO finance_accounts VALUES (?,?,?,?)').bind(id,d,now(),actor.id),
    journal(db,actor,{id:`opening:${id}`,memberId:id,kind:'opening',value,date:d,note})],actor,'account_opened',{id,openingOn:d,value,note});
  return {saved:true};
}

export async function resolveRow(db, actor, id, input, collect=false, snapshot=null) {
  const row=snapshot?snapshot.rows.find(r=>r.id===id):await db.prepare('SELECT * FROM finance_bank_rows WHERE id=?').bind(id).first();
  if (!row || (row.status!=='pending' && input.reassign!==true)) bad('Choose an unresolved bank transaction, or explicitly correct its treatment.');
  const note=text(input.note), queries=[];
  if(row.status!=='pending') {
    const previous=await all(db,"SELECT j.* FROM finance_journal j WHERE j.bank_row_id=? AND j.kind<>'reversal' AND NOT EXISTS(SELECT 1 FROM finance_journal r WHERE r.reverses_id=j.id)",id);
    for(const e of previous) queries.push(journal(db,actor,{id:`reverse:${e.id}`,memberId:e.member_id,kind:'reversal',value:-e.amount_pence,date:today(),note:`Bank allocation correction: ${note}`,reversesId:e.id,bankRowId:id}));
  }
  if (!['posted','duplicate','non_member'].includes(input.status)) bad('Choose a resolution.');
  const others=snapshot?snapshot.rows.filter(r=>r.fingerprint===row.fingerprint&&r.id!==id&&r.status!=='duplicate'):await all(db,"SELECT id,status FROM finance_bank_rows WHERE fingerprint=? AND id<>? AND status<>'duplicate'",row.fingerprint,id);
  if (input.status==='duplicate' && !others.some(r=>['posted','non_member'].includes(r.status))) bad('First resolve the matching original transaction; then mark this duplicate.');
  if (input.status!=='duplicate' && others.length && input.distinctConfirmed!==true) bad('A similar transaction exists. Confirm this is a separate movement before posting.');
  if (input.status==='posted') {
    if (!Array.isArray(input.splits) || !input.splits.length || input.splits.length>20) bad('Assign 1–20 member portions.');
    let total=0;
    for (const [index,s] of input.splits.entries()) {
      const account=snapshot?snapshot.accounts.find(a=>a.member_id===s.memberId):await db.prepare('SELECT opening_on FROM finance_accounts WHERE member_id=?').bind(s.memberId).first();
      if (!account) bad('Approve this member’s opening account first.');
      if (row.posted_on<=account.opening_on) bad('This payment is on or before the opening cutoff. It must not be counted twice.');
      const value=amount(s.amount);
      if (value<=0) bad('Enter positive split amounts.'); total+=value;
      queries.push(journal(db,actor,{id:`bank:${id}:${input.revision}:${index}`,memberId:s.memberId,kind:row.amount_pence>0?'receipt':'refund',value:row.amount_pence>0?value:-value,date:row.posted_on,note:text(s.description),bankRowId:id,eventCode:clean(s.eventCode),category:clean(s.category)}));
    }
    if (total!==Math.abs(row.amount_pence)) bad('Member portions must equal the whole bank transaction.');
  }
  queries.push(db.prepare('UPDATE finance_bank_rows SET status=?,resolution=?,actor_id=?,resolved_at=? WHERE id=?').bind(input.status,note,actor.id,now(),id));
  const detail={id,status:input.status,note,splits:input.splits || []};
  if (collect) return {queries,detail};
  await commit(db,input.revision,queries,actor,'bank_row_resolved',detail);
  return {saved:true};
}

export async function resolveBatch(db,actor,input) {
  if(!Array.isArray(input.rows) || !input.rows.length || input.rows.length>20 || new Set(input.rows.map(r=>r.id)).size!==input.rows.length || input.rows.some(r=>r.reassign)) bad('Select 1–20 different pending rows. Correct resolved rows individually.');
  const snapshot={rows:await all(db,'SELECT * FROM finance_bank_rows'),accounts:await all(db,'SELECT * FROM finance_accounts')};
  const plans=[];
  for(const row of input.rows) plans.push(await resolveRow(db,actor,row.id,{...row,revision:input.revision},true,snapshot));
  if (plans.reduce((n,p)=>n+p.queries.length,0)>40) bad('Too many split portions. Confirm a smaller batch.');
  await commit(db,input.revision,plans.flatMap(p=>p.queries),actor,'bank_batch_resolved',{rows:plans.map(p=>p.detail)});
  return {saved:true,count:plans.length};
}

export async function addEntry(db, actor, input) {
  const account=await db.prepare('SELECT * FROM finance_accounts WHERE member_id=?').bind(input.memberId).first();
  if (!account) bad('Approve the opening account first.');
  if (!['charge','credit'].includes(input.kind)) bad('Choose charge or credit adjustment.');
  const value=amount(input.amount), d=date(input.postedOn), due=date(input.dueOn);
  if (value<=0 || d<=account.opening_on || d>today()) bad('Use a positive amount and a posting date after the opening cutoff, up to today.');
  const e={id:text(input.requestId,100),memberId:input.memberId,kind:input.kind,value:input.kind==='charge'?-value:value,date:d,dueOn:due,note:text(input.note),eventCode:clean(input.eventCode),category:clean(input.category)};
  await commit(db,input.revision,[journal(db,actor,e)],actor,'entry_posted',e);return {saved:true};
}

export async function reverseEntry(db, actor, input) {
  const e=await db.prepare('SELECT * FROM finance_journal WHERE id=?').bind(input.id).first();
  if (!e || ['opening','reversal'].includes(e.kind)) bad('This entry cannot be reversed.');
  const note=text(input.note);
  await commit(db,input.revision,[journal(db,actor,{id:`reverse:${e.id}`,memberId:e.member_id,kind:'reversal',value:-e.amount_pence,date:today(),note,reversesId:e.id})],actor,'entry_reversed',{id:e.id,note});return {saved:true};
}

export async function claimPayment(db, user, input) {
  if (!(await statement(db,user.id)).active) bad('Your account is not activated yet.');
  const value=amount(input.amount), d=date(input.paidOn);
  if (value<=0 || d>today()) bad('Enter a positive payment and a date up to today.');
  const count=(await db.prepare("SELECT COUNT(*) AS n FROM finance_claims WHERE member_id=? AND status='pending'").bind(user.id).first()).n;
  if (count>=10) bad('You already have ten payments awaiting review.');
  await commit(db,await revision(db),[db.prepare('INSERT INTO finance_claims (id,member_id,amount_pence,paid_on,reference,created_at) VALUES (?,?,?,?,?,?)').bind(text(input.requestId,100),user.id,value,d,text(input.reference),now())],user,'payment_claim',{id:input.requestId});
  return {saved:true};
}
export async function resolveClaim(db,actor,input) {
  const note=text(input.note);
  if(!await db.prepare("SELECT id FROM finance_claims WHERE id=? AND status='pending'").bind(input.id).first()) bad('Choose a pending payment report.');
  await commit(db,input.revision,[db.prepare("UPDATE finance_claims SET status='resolved',resolution=? WHERE id=? AND status='pending'").bind(note,input.id)],actor,'claim_reviewed',{id:input.id,note});return {saved:true};
}

export async function eventChargePreview(db,input) {
  const start=await revision(db);
  const event=await db.prepare('SELECT id,title,cost FROM events WHERE id=?').bind(input.eventId).first();
  if(!event) bad('Choose an event.');
  const value=amount(input.amount), d=date(input.postedOn), due=date(input.dueOn);
  if(value<=0||d>today()) bad('Enter a positive fee and posting date up to today.');
  const bookingEnabled=await bookingFinanceAvailable(db);
  const bookings=await all(db,`SELECT b.id,b.member_id,m.display_name,a.opening_on,${bookingEnabled?"COALESCE(j.id,(SELECT c.journal_id FROM finance_booking_charges c WHERE c.booking_id=b.id LIMIT 1),(SELECT 'opening' FROM finance_opening_bookings o WHERE o.booking_id=b.id AND o.disposition='included'))":"j.id"} AS charged
    FROM bookings b JOIN members m ON m.id=b.member_id LEFT JOIN finance_accounts a ON a.member_id=b.member_id
    LEFT JOIN finance_journal j ON j.id='event:' || b.id WHERE b.event_id=? AND b.status='registered' ORDER BY m.display_name`,event.id);
  await unchanged(db,start);
  return {revision:start,event,value,date:d,dueOn:due,bookings:bookings.map(b=>({...b,
    eligible:!!b.opening_on&&d>b.opening_on&&!b.charged,
    reason:b.charged?'Charge already recorded':!b.opening_on?'Opening account not approved':d<=b.opening_on?'On or before opening cutoff':''}))};
}

export async function reviewBookingCancellation(db,actor,input) {
  if(!await bookingFinanceAvailable(db)) bad('Apply the booking charge migration first.');
  if(!['release','retain'].includes(input.resolution)) bad('Choose release or retain charge.');
  const record=await db.prepare(`SELECT r.*,b.status AS booking_status,j.member_id,j.amount_pence,j.event_code,j.category,
    (SELECT id FROM finance_journal x WHERE x.reverses_id=j.id) AS reversed
    FROM finance_booking_reviews r JOIN bookings b ON b.id=r.booking_id JOIN finance_journal j ON j.id=r.journal_id
    WHERE r.id=? AND r.status='pending'`).bind(input.id).first();
  if(!record || record.booking_status!=='cancelled') bad('This cancellation no longer needs review. Refresh the page.');
  const note=text(input.note),queries=[];
  if(input.resolution==='release'&&!record.reversed) queries.push(journal(db,actor,{id:`reverse:${record.journal_id}`,memberId:record.member_id,kind:'reversal',value:-record.amount_pence,date:today(),eventCode:record.event_code,category:record.category,note:'Cancellation reviewed — charge released',reversesId:record.journal_id}));
  if(input.resolution==='retain'&&record.reversed) bad('This charge has already been reversed. It cannot be retained.');
  queries.push(db.prepare("UPDATE finance_booking_reviews SET status='resolved',resolution=?,note=?,resolved_at=?,actor_id=? WHERE id=?").bind(input.resolution,note,now(),actor.id,input.id));
  await commit(db,input.revision,queries,actor,'booking_cancellation_reviewed',{id:input.id,resolution:input.resolution,note});
  return {saved:true};
}

export async function reviewOpeningBooking(db,actor,input) {
  if(!['included','excluded'].includes(input.disposition)) bad('Confirm whether the booking is already covered by the opening balance.');
  const record=await db.prepare("SELECT * FROM finance_opening_bookings WHERE booking_id=? AND disposition='review'").bind(input.id).first();
  if(!record) bad('This historical booking has already been reviewed.');
  const note=text(input.note);
  await commit(db,input.revision,[db.prepare("UPDATE finance_opening_bookings SET disposition=?,note=?,actor_id=?,reviewed_at=? WHERE booking_id=?").bind(input.disposition,note,actor.id,now(),input.id)],actor,'opening_booking_reviewed',{id:input.id,disposition:input.disposition,note});
  return {saved:true};
}
export async function postEventCharges(db,actor,input) {
  const p=await eventChargePreview(db,input);
  if(input.confirmed!==true) bad('Confirm these event charges are not already in opening balances.');
  if(input.revision!==p.revision) throw new AppError(409,'finance_changed','Refresh the charge preview.');
  if(!Array.isArray(input.bookingIds)||!input.bookingIds.length||input.bookingIds.length>30||new Set(input.bookingIds).size!==input.bookingIds.length) bad('Select 1–30 different bookings per batch.');
  const queries=[];
  for(const id of input.bookingIds){
    const b=p.bookings.find(b=>b.id===id&&b.eligible);if(!b) bad('A selected booking is no longer eligible. Refresh.');
    queries.push(journal(db,actor,{id:`event:${id}`,memberId:b.member_id,kind:'charge',value:-p.value,date:p.date,dueOn:p.dueOn,eventCode:p.event.id,category:'Golf',note:`${p.event.title} — event charge`}));
  }
  await commit(db,input.revision,queries,actor,'event_charges_posted',{id:p.event.id,bookingIds:input.bookingIds,amountPence:p.value});return {saved:true};
}
