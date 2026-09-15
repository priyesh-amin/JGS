import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { registerMember, cancelMember, updateMemberBooking } from '../functions/_lib/booking-store.js';
import { correctBooking } from '../functions/_lib/admin-store.js';
import { openAccount, statement, reviewOpeningBooking, reviewBookingCancellation, eventChargePreview, postEventCharges, addEntry } from '../functions/_lib/reconciliation/store.js';

const actor = { id: 'admin' };
const at = day => new Date(`2026-08-${day}T12:00:00.000Z`);
const input = { dietaryRequirements: 'Veg', buggyRequired: false };

// Same local D1 adapter as reconciliation-bank: every batch is a real transaction.
function database(t, beforeBookingMigration) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) {
    if (name === '0007_booking_charges.sql') beforeBookingMigration?.(sql);
    sql.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  const wrap = (query, args = []) => ({
    query, args,
    bind(...values) { return wrap(query, values); },
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; },
    async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
  });
  const db = { sql, prepare: wrap, async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const s of statements) results.push(await s.run());
      sql.exec('COMMIT');
      return results;
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  } };
  seedMembers(sql);
  return db;
}
function seedMembers(sql) {
  for (const [id, role] of [['admin', 'admin'], ['one', 'member'], ['two', 'member']]) {
    sql.prepare(`INSERT OR IGNORE INTO members
      (id,email,display_name,role,status,password_hash,password_salt,password_iterations,created_at,updated_at)
      VALUES (?,?,?,?,'active','x','x',1,'2026-01-01','2026-01-01')`).run(id, `${id}@example.test`, id, role);
  }
}
function event(db, { id = 'golf', cost = '65', due = null, policy = 'review' } = {}) {
  db.sql.prepare(`INSERT INTO events
    (id,title,venue,event_date,cost,status,source_type,source_key,publication_at,
     registration_opens_at,registration_closes_at,cancellation_closes_at,payment_due_on,
     cancellation_charge_policy,created_at,updated_at)
    VALUES (?, 'August golf','Test club','2026-08-30',?,'open','website',?,
      '2026-07-01T00:00:00.000Z','2026-08-01T00:00:00.000Z',
      '2026-08-20T12:00:00.000Z','2026-08-25T12:00:00.000Z',?,?, '2026-07-01','2026-07-01')`)
    .run(id, cost, id, due, policy);
}
const rows = (db, table) => db.sql.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
const revision = db => db.sql.prepare('SELECT revision FROM finance_state WHERE id=1').get().revision;
const charges = db => rows(db, 'finance_journal').filter(e => e.kind === 'charge');
const reversals = db => rows(db, 'finance_journal').filter(e => e.kind === 'reversal');
const snapshot = db => Object.fromEntries(['bookings', 'booking_audit', 'integration_outbox',
  'finance_journal', 'finance_booking_charges', 'finance_booking_reviews', 'finance_state', 'management_audit']
  .map(table => [table, rows(db, table)]));
const opening = (db, amount = '0', memberId = 'one') => openAccount(db, actor, {
  revision: revision(db), memberId, openingOn: '2026-07-31', amount,
  note: 'Verified opening including existing bookings', confirmed: true,
});
const register = (db, extra = {}) => registerMember(db, { memberId: 'one', eventId: 'golf', input, now: at('10'), ...extra });
const cancel = (db, extra = {}) => cancelMember(db, { memberId: 'one', eventId: 'golf', now: at('11'), ...extra });
const review = (db, id, resolution) => reviewBookingCancellation(db, actor, {
  revision: revision(db), id, resolution, note: 'Supplier cancellation terms checked',
});
const catchup = { eventId: 'golf', amount: '65', postedOn: '2026-08-10', dueOn: '2099-08-30' };

test('historical rebooking requires reviewed opening treatment and never silently doubles opening debt',async t=>{
  for(const disposition of ['included','excluded']) {
    const db=database(t);event(db);const booking=await register(db);
    await opening(db,disposition==='included'?'-65':'0');
    await cancel(db);
    const before=snapshot(db);
    await assert.rejects(register(db,{now:at('12')}),{code:'historical_booking_review'});
    assert.deepEqual(snapshot(db),before);
    await reviewOpeningBooking(db,actor,{id:booking.id,revision:revision(db),disposition,note:'Compared member opening to original booking'});
    await register(db,{now:at('12')});
    assert.equal((await statement(db,'one')).dueNowPence,6500);
    assert.equal(charges(db).length,disposition==='included'?0:1);
    assert.equal((await eventChargePreview(db,catchup)).bookings[0].eligible,false);
  }
});

test('confirmed booking snapshots £65 and uses explicit payment due date or event date', async t => {
  const db = database(t); await opening(db);
  event(db); event(db, { id: 'future', due: '2099-08-30' });
  for (const [id, due] of [['golf', '2026-08-30'], ['future', '2099-08-30']]) {
    const booking = await register(db, { eventId: id });
    const charge = charges(db).find(e => e.event_code === id);
    assert.equal(booking.status, 'registered');
    assert.equal(charge.amount_pence, -6500);
    assert.equal(charge.due_on, due);
    assert.equal(charge.posted_on, '2026-08-10');
    assert.equal(charge.member_id, 'one');
    assert.equal(rows(db, 'finance_booking_charges').find(c => c.journal_id === charge.id).booking_id, booking.id);
  }
  const before = charges(db);
  db.sql.exec("UPDATE events SET cost='90', payment_due_on='2099-12-31'");
  assert.deepEqual(charges(db), before);
  const s = await statement(db, 'one');
  assert.equal(s.dueNowPence, 6500); assert.equal(s.upcomingPence, 6500);
});

test('repeated registration is rejected without writes; preference edits never charge again', async t => {
  const db = database(t); await opening(db); event(db); await register(db);
  const before = snapshot(db);
  await assert.rejects(register(db), { code: 'already_registered' });
  assert.deepEqual(snapshot(db), before);
  const edited = await updateMemberBooking(db, { memberId: 'one', eventId: 'golf',
    input: { dietaryRequirements: 'Non-veg', buggyRequired: true }, now: at('11') });
  assert.equal(edited.buggy_required, 1); assert.equal(edited.dietary_requirements, 'Non-veg');
  assert.equal(edited.version, 2);
  assert.deepEqual(charges(db), before.finance_journal.filter(e => e.kind === 'charge'));
  assert.equal(revision(db), before.finance_state[0].revision);
  assert.equal(rows(db, 'booking_audit').length, 2);
});

test('default cancellation retains charge pending review; release restores credit without cash refund', async t => {
  const db = database(t); await opening(db, '100'); event(db); await register(db);
  assert.equal((await statement(db, 'one')).availableCreditPence, 3500);
  await cancel(db);
  const pending = rows(db, 'finance_booking_reviews')[0];
  assert.equal(pending.status, 'pending'); assert.equal(pending.journal_id, charges(db)[0].id);
  assert.equal(reversals(db).length, 0);
  assert.equal((await statement(db, 'one')).availableCreditPence, 3500);
  await review(db, pending.id, 'release');
  const released = rows(db, 'finance_booking_reviews')[0];
  assert.equal(released.status, 'resolved'); assert.equal(released.resolution, 'release');
  assert.equal(released.actor_id, actor.id);
  assert.equal(released.note, 'Supplier cancellation terms checked');
  assert.equal(reversals(db)[0].reverses_id, pending.journal_id);
  assert.equal(reversals(db)[0].amount_pence, 6500);
  const memberStatement = await statement(db, 'one');
  assert.equal(memberStatement.availableCreditPence, 10000);
  assert.equal(JSON.stringify(memberStatement).includes(released.note), false,
    'Committee review notes must not leak through any member statement field');
  assert.equal(memberStatement.entries.find(e => e.kind === 'reversal').note,
    'Cancellation reviewed — charge released');
  assert.equal(rows(db, 'finance_journal').filter(e => e.kind === 'refund').length, 0);
  const before = snapshot(db);
  await assert.rejects(review(db, pending.id, 'release'), /no longer needs review/);
  assert.deepEqual(snapshot(db), before);
});

test('rebooking reuses retained charge both before and after an explicit retain review', async t => {
  for (const resolveFirst of [false, true]) {
    const db = database(t); await opening(db); event(db); await register(db); await cancel(db);
    const pending = rows(db, 'finance_booking_reviews')[0];
    if (resolveFirst) await review(db, pending.id, 'retain');
    assert.equal(reversals(db).length, 0);
    db.sql.exec("UPDATE events SET cost='90'");
    await register(db, { now: at('12') });
    assert.equal(charges(db).length, 1); assert.equal(charges(db)[0].amount_pence, -6500);
    const resolved = rows(db, 'finance_booking_reviews')[0];
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.resolution, resolveFirst ? 'retain' : 'rebooked');
    const before = snapshot(db);
    await assert.rejects(review(db, pending.id, 'release'), /no longer needs review/);
    assert.deepEqual(snapshot(db), before);
  }
});

test('agreed cancellation terms survive event edits; release and rebooking use separate fee snapshots', async t => {
  // Isolate policy edits from deadline edits, in both directions. Admin correction
  // allows testing agreed finance terms independently of the current member window.
  for (const [policy, editedPolicy, deadline, day, released] of [
    ['review', 'release_before_cutoff', '2026-08-25T12:00:00.000Z', '11', false],
    ['release_before_cutoff', 'review', '2026-08-25T12:00:00.000Z', '11', true],
    ['release_before_cutoff', 'release_before_cutoff', '2026-08-10T12:00:00.000Z', '11', true],
    ['release_before_cutoff', 'release_before_cutoff', '2026-08-29T12:00:00.000Z', '26', false],
  ]) {
    const editedDb = database(t); await opening(editedDb); event(editedDb, { policy });
    const booking = await register(editedDb);
    const agreed = rows(editedDb, 'finance_booking_charges');
    assert.equal(agreed[0].cancellation_charge_policy, policy);
    assert.equal(agreed[0].cancellation_closes_at, '2026-08-25T12:00:00.000Z');
    editedDb.sql.prepare(`UPDATE events SET cost='90', cancellation_charge_policy=?, cancellation_closes_at=?`)
      .run(editedPolicy, deadline);
    await correctBooking(editedDb, booking.id, { status: 'cancelled', version: 1 }, actor, at(day));
    assert.deepEqual(rows(editedDb, 'finance_booking_charges'), agreed);
    assert.equal(charges(editedDb)[0].amount_pence, -6500);
    assert.equal(reversals(editedDb).length, released ? 1 : 0);
    if (released) assert.equal(reversals(editedDb)[0].amount_pence, 6500);
    const reviews = rows(editedDb, 'finance_booking_reviews');
    assert.equal(reviews.length, released ? 0 : 1);
    if (!released) assert.equal(reviews[0].status, 'pending');
  }
  const db = database(t); await opening(db, '100'); event(db, { policy: 'release_before_cutoff' });
  const first = await register(db); await cancel(db);
  assert.equal(rows(db, 'finance_booking_reviews').length, 0);
  assert.equal(reversals(db).length, 1);
  assert.equal(reversals(db)[0].reverses_id, charges(db)[0].id);
  assert.equal((await statement(db, 'one')).availableCreditPence, 10000);
  const before = snapshot(db);
  await assert.rejects(cancel(db), { code: 'no_active_booking' });
  assert.deepEqual(snapshot(db), before);
  db.sql.exec("UPDATE events SET cost='70'");
  const rebooked = await register(db, { now: at('12') });
  assert.equal(rebooked.id, first.id); assert.equal(rebooked.version, 3);
  assert.deepEqual(charges(db).map(e => e.amount_pence), [-6500, -7000]);
  assert.equal(new Set(charges(db).map(e => e.id)).size, 2);
  assert.deepEqual(rows(db, 'finance_booking_charges').map(c => c.booking_version), [1, 3]);
  assert.equal((await statement(db, 'one')).availableCreditPence, 3000);
});

test('explicit free fee creates no charge; member without finance activation keeps legacy booking behaviour', async t => {
  const db = database(t); await opening(db); event(db, { cost: '0' });
  await register(db); await cancel(db);
  assert.equal(charges(db).length, 0); assert.equal(rows(db, 'finance_booking_reviews').length, 0);
  db.sql.exec('UPDATE events SET cost=NULL');
  const beforeRevision = revision(db), beforeJournal = rows(db, 'finance_journal');
  const booking = await register(db, { memberId: 'two' });
  assert.equal(booking.status, 'registered');
  await cancel(db, { memberId: 'two' });
  assert.equal((await statement(db, 'two')).active, false);
  assert.deepEqual(rows(db, 'finance_journal'), beforeJournal);
  assert.equal(revision(db), beforeRevision);
});

test('missing or invalid fees roll back booking, audit, outbox and finance for new and restored bookings', async t => {
  for (const cost of [null, '', 'TBC', '-65', '65.001', '1e2']) {
    for (const path of ['member', 'admin', 'restore']) {
      const db = database(t); await opening(db); event(db);
      let booking;
      if (path === 'restore') { booking = await register(db); await cancel(db); }
      db.sql.prepare('UPDATE events SET cost=?').run(cost);
      const before = snapshot(db);
      const action = path === 'restore'
        ? correctBooking(db, booking.id, { status: 'registered', version: 2 }, actor, at('12'))
        : register(db, { administrator: path === 'admin', actorId: path === 'admin' ? 'admin' : 'one' });
      await assert.rejects(action, { status: 409, code: 'booking_fee_unavailable', message: /event fee needs checking/ }, `${path}: ${cost}`);
      assert.deepEqual(snapshot(db), before, `${path}: ${cost}`);
    }
  }
});

test('source and booking windows, opening cutoff and invalid due dates reject atomically', async t => {
  const cases = [
    ["UPDATE events SET source_type='manual'", at('10'), 'registration_unavailable'],
    ["UPDATE events SET registration_opens_at=NULL", at('10'), 'configuration_required'],
    ["UPDATE events SET registration_closes_at=NULL", at('10'), 'configuration_required'],
    ["UPDATE events SET cancellation_closes_at=NULL", at('10'), 'configuration_required'],
    ['', at('20'), 'registration_closed'],
    ['', at('25'), 'cancellation_closed'],
    ["UPDATE events SET registration_opens_at='2026-07-01T00:00:00.000Z'", new Date('2026-07-31T12:00:00Z'), 'booking_opening_cutoff'],
    ["UPDATE events SET payment_due_on='2026-02-30'", at('10'), 'booking_due_unavailable'],
  ];
  for (const [setup, now, code] of cases) {
    const db = database(t); await opening(db); event(db);
    if (setup) db.sql.exec(setup);
    const before = snapshot(db);
    await assert.rejects(register(db, { now }), { status: 409, code });
    assert.deepEqual(snapshot(db), before, code);
  }
  const db = database(t); await opening(db); event(db);
  const before = snapshot(db);
  await assert.rejects(register(db, { input: { ...input, expectedEventUpdatedAt: '2026-06-01' } }),
    { status: 409, code: 'event_changed' });
  assert.deepEqual(snapshot(db), before);
  await register(db, { input: { ...input, expectedEventUpdatedAt: '2026-07-01' } });
  assert.equal(charges(db).length, 1);

  for (const path of ['member', 'admin', 'restore']) {
    const raced = database(t); await opening(raced); event(raced);
    let booking;
    if (path === 'restore') { booking = await register(raced); await cancel(raced); }
    const unchanged = snapshot(raced), batch = raced.batch.bind(raced);
    // Commit an event edit after the function's read but before its real SQL batch.
    // Only scheduling is intercepted; all booking writes and triggers stay real.
    raced.batch = async statements => {
      raced.batch = batch;
      raced.sql.exec("UPDATE events SET cost='90', updated_at='2026-08-11T00:00:00.000Z'");
      return batch(statements);
    };
    const action = path === 'restore'
      ? correctBooking(raced, booking.id, { status: 'registered', version: 2 }, actor, at('12'))
      : register(raced, { administrator: path === 'admin', actorId: path === 'admin' ? 'admin' : 'one' });
    let rejection;
    await assert.rejects(action, error => { rejection = error; return true; });
    assert.deepEqual(snapshot(raced), unchanged, `${path} event edit race must leave no partial booking writes`);
    assert.equal(raced.sql.prepare('SELECT cost FROM events').get().cost, '90');
    assert.equal(rejection.status, 409, `${path} event edit race must return a conflict, got: ${rejection.message}`);
  }
});

test('migration and activation do not backfill existing bookings; explicit catchup remains available', async t => {
  const db = database(t, sql => {
    seedMembers(sql);
    sql.exec(`INSERT INTO events (id,title,venue,event_date,cost,status,source_type,source_key,
      registration_opens_at,registration_closes_at,cancellation_closes_at,created_at,updated_at)
      VALUES ('golf','Existing golf','Club','2026-08-30','65','open','website','golf',
      '2026-08-01T00:00:00.000Z','2026-08-20T12:00:00.000Z','2026-08-25T12:00:00.000Z','now','now');
      INSERT INTO bookings (id,member_id,event_id,status,dietary_requirements,registered_at,updated_at)
      VALUES ('existing','one','golf','registered','Veg','2026-07-20','2026-07-20')`);
  });
  assert.equal(charges(db).length, 0);
  await opening(db);
  await updateMemberBooking(db, { memberId: 'one', eventId: 'golf', input, now: at('10') });
  assert.equal(charges(db).length, 0); assert.equal(rows(db, 'finance_booking_charges').length, 0);
  const preview = await eventChargePreview(db, catchup);
  assert.equal(preview.bookings[0].eligible, true);
  await postEventCharges(db, actor, { ...catchup, revision: preview.revision, bookingIds: ['existing'], confirmed: true });
  assert.equal(charges(db).length, 1);
  assert.equal((await statement(db, 'one')).upcomingPence, 6500);
  assert.equal((await eventChargePreview(db, catchup)).bookings[0].eligible, false);
});

test('automatically charged booking is excluded from catchup and cannot be charged twice', async t => {
  const db = database(t); await opening(db); event(db, { due: '2099-08-30' });
  const booking = await register(db);
  const preview = await eventChargePreview(db, catchup);
  assert.equal(preview.bookings.length, 1); assert.equal(preview.bookings[0].eligible, false);
  assert.equal(preview.bookings[0].reason, 'Charge already recorded');
  const before = snapshot(db);
  await assert.rejects(postEventCharges(db, actor, { ...catchup, revision: preview.revision,
    bookingIds: [booking.id], confirmed: true }), /no longer eligible/);
  assert.deepEqual(snapshot(db), before);
  assert.equal((await statement(db, 'one')).upcomingPence, 6500);
});

test('booking registration, cancellation and review advance the shared finance revision and reject stale edits', async t => {
  const db = database(t); await opening(db); event(db);
  const staleEdit = async stale => {
    const before = snapshot(db);
    await assert.rejects(addEntry(db, actor, { revision: stale, requestId: 'stale-credit', memberId: 'one',
      kind: 'credit', amount: '10', postedOn: '2026-08-10', dueOn: '2026-08-10', note: 'Stale finance screen' }), { code: 'finance_changed' });
    assert.deepEqual(snapshot(db), before);
  };
  let prior = revision(db); await register(db);
  assert.equal(revision(db), prior + 1); await staleEdit(prior);
  prior = revision(db); await cancel(db);
  assert.equal(revision(db), prior + 1); await staleEdit(prior);
  const pending = rows(db, 'finance_booking_reviews')[0], before = snapshot(db);
  await assert.rejects(reviewBookingCancellation(db, actor, { revision: prior, id: pending.id,
    resolution: 'release', note: 'Stale cancellation screen' }), { code: 'finance_changed' });
  assert.deepEqual(snapshot(db), before);
  prior = revision(db); await review(db, pending.id, 'release');
  assert.equal(revision(db), prior + 1); await staleEdit(prior);
});

test('admin registration and status restore charge through the same trigger; late admin cancellation requires review', async t => {
  const db = database(t); await opening(db); event(db, { policy: 'release_before_cutoff' });
  const booking = await register(db, { administrator: true, actorId: actor.id, now: at('21') });
  assert.equal(charges(db).length, 1); assert.equal(charges(db)[0].actor_id, actor.id);
  const before = snapshot(db);
  await assert.rejects(cancel(db, { now: at('26') }), { code: 'cancellation_closed' });
  assert.deepEqual(snapshot(db), before);
  await correctBooking(db, booking.id, { status: 'cancelled', version: 1 }, actor, at('26'));
  assert.equal(reversals(db).length, 0);
  assert.equal(rows(db, 'finance_booking_reviews')[0].status, 'pending');
  await review(db, rows(db, 'finance_booking_reviews')[0].id, 'release');
  await correctBooking(db, booking.id, { status: 'registered', version: 2 }, actor, at('27'));
  assert.equal(charges(db).length, 2); assert.equal(reversals(db).length, 1);
  assert.equal(charges(db)[1].amount_pence, -6500);
  assert.equal(charges(db)[1].actor_id, actor.id);
  assert.equal(rows(db, 'bookings')[0].status, 'registered');
  assert.deepEqual(rows(db, 'finance_booking_charges').map(c => c.booking_version), [1, 3]);
  const restored = snapshot(db);
  await assert.rejects(correctBooking(db, booking.id, { status: 'cancelled', version: 2 }, actor, at('28')), { code: 'booking_changed' });
  assert.deepEqual(snapshot(db), restored);
});
