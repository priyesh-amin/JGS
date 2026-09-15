import test from 'node:test';
import assert from 'node:assert/strict';
import { createTools } from '../src/lib/webmcp-tools.js';

const stamp = '2026-09-15T10:00:00.000Z';
function fixture(role = 'member', options = {}) {
  const user = { id: 'member-1', role };
  const event = { id: 'event-1', title: 'Autumn Cup', eventDate: '2026-10-01', cost: '45.00', updatedAt: stamp, availability: { cancellation: 'open' }, bookingFields: { questions: [{ key: 'meal', label: 'Meal choice', type: 'select', options: ['Yes', 'No'], required: true }] }, booking: { status: 'registered', updatedAt: stamp, preferences: { meal: 'Yes', legacy_secret: 'hidden' } }, balance: 123, secret: 'hidden' };
  const adminEvent = { id: event.id, title: event.title, event_date: event.eventDate, cost: event.cost, updated_at: stamp, venue: 'Club', status: 'draft', description: 'Keep this description', joining_information: 'Keep joining details', meet_time: '09:00', tee_time: '10:00', publication_at: null, registration_opens_at: null, registration_closes_at: null, cancellation_closes_at: null, booking_fields_json: JSON.stringify({ ...event.bookingFields, capacity: 80, package: 'Lunch', schedule: 'Golf', isCharity: false }), payment_due_on: '2026-09-20', cancellation_charge_policy: 'review' };
  const player = { id: 'event-1::member-2', member_id: 'member-2', display_name: 'Alex Golfer', status: 'registered', version: 4, preparation_version: 2, group_name: 'A', tee_time: '10:00', handicap: '12', notes: 'Keep notes', preferences_json: '{"meal":"Yes","legacy_secret":"hidden"}', email: 'hidden@example.com', balance_pence: 123 };
  const members = [{ id: 'member-2', displayName: 'Alex Golfer', role: 'member', status: 'active', updatedAt: stamp, email: 'hidden@example.com', financeUrl: 'secret', password: 'secret' }, { id: 'admin-2', displayName: 'Admin', role: 'admin' }];
  const results = { generation: 'website:old', entries: [{ category: 'poy', year: 2026, winner: 'Alex Golfer', score: '42', secret: 'hidden' }] };
  const calls = [], confirmations = [], changes = [];
  const state = { active: true, session: user, event, adminEvent, player, members, results };
  const api = {
    async get(path) {
      calls.push(['get', path]);
      if (options.get) await options.get(path, state);
      if (path === '/api/auth/session') return { user: state.session };
      if (path === '/api/events') return { events: [state.event] };
      if (path === '/api/events/event-1') return { event: structuredClone(state.event) };
      if (path === '/api/admin/events') return { events: [state.adminEvent] };
      if (path === '/api/admin/manage/events/event-1') return structuredClone({ event: state.adminEvent, players: [state.player], guests: [], reviews: [{ secret: 'hidden' }] });
      if (path === '/api/admin/members') return { members: structuredClone(state.members) };
      if (path === '/api/admin/manage/results') return structuredClone(state.results);
      throw Error(`Unexpected path ${path}`);
    },
  };
  for (const method of ['post', 'patch', 'delete']) api[method] = async (path, body) => { calls.push([method, path, body]); if (options.write) await options.write(state); return { secret: 'hidden', balance: 123 }; };
  const tools = createTools({ user, api, isActive: () => state.active, confirm: async prompt => { confirmations.push(prompt); return options.confirm ? options.confirm(prompt, state) : true; }, onChanged: async () => { changes.push(true); if (options.onChanged) await options.onChanged(); } });
  return { tools, state, calls, confirmations, changes, run: (name, input = {}) => tools.find(t => t.name === `jgs_${name}`).execute(input), writes: () => calls.filter(c => c[0] !== 'get') };
}
const booking = { eventId: 'event-1', dietaryRequirements: 'Veg', buggyRequired: false, answers: [{ key: 'meal', value: 'Yes' }] };
const payload = response => JSON.parse(response.content[0].text);

test('catalog is role scoped and excludes finance, credentials and escalation', async () => {
  const member = fixture(), admin = fixture('admin');
  assert.deepEqual(member.tools.map(t => t.name.replace(/^jgs_/, '')), ['list_events', 'get_event', 'book_event', 'update_booking_preferences', 'cancel_booking']);
  assert.equal(admin.tools.length, 13);
  assert.ok(!admin.tools.some(t => t.name === 'book_event'));
  assert.deepEqual(createTools({ user: null }), []);
  assert.deepEqual(createTools({ user: { id: 'a', role: 'owner' } }), []);
  assert.deepEqual(createTools({ user: { id: 'a', role: 'admin', mustChangePassword: true } }), []);
  for (const tool of [...member.tools, ...admin.tools]) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(!/finance|balance|password|credential|reconciliation|escalat/.test(tool.name));
  }
  const response = await member.run('get_event', { eventId: 'event-1' });
  assert.ok(!JSON.stringify(response).includes('hidden'));
  assert.deepEqual(member.calls.slice(0, 2), [['get', '/api/auth/session'], ['get', '/api/events/event-1']]);
  const prep = await admin.run('admin_get_preparation', { eventId: 'event-1' });
  assert.ok(!/hidden|email|balance|reviews/.test(JSON.stringify(prep)));
  assert.deepEqual(payload(await admin.run('admin_list_members')).members, [{ id: 'member-2', displayName: 'Alex Golfer', email: 'hidden@example.com', status: 'active', updatedAt: stamp }]);
});

const mutations = [
  ['member', 'book_event', booking], ['member', 'update_booking_preferences', booking], ['member', 'cancel_booking', { eventId: 'event-1' }],
  ['admin', 'admin_update_member', { memberId: 'member-2', displayName: 'Alex Smith' }],
  ['admin', 'admin_create_event', { event: { title: 'New Cup', event_date: '2026-10-02' } }],
  ['admin', 'admin_edit_event', { eventId: 'event-1', updated_at: stamp, changes: { title: 'Renamed Cup' } }],
  ['admin', 'admin_save_results', { generation: 'website:old', entries: [{ category: 'poy', year: 2026, winner: 'Jamie Player', score: '43' }] }],
  ['admin', 'admin_update_preparation', { eventId: 'event-1', bookingId: 'event-1::member-2', version: 2, changes: { group_name: 'B' } }],
  ['admin', 'admin_cancel_booking', { eventId: 'event-1', bookingId: 'event-1::member-2', version: 4 }],
];
for (const [role, name, input] of mutations) {
  test(`${name}: denied confirmation never writes`, async () => {
    const f = fixture(role, { confirm: () => false });
    assert.equal((await f.run(name, input)).isError, true);
    assert.equal(f.confirmations.length, 1);
    assert.deepEqual(Object.keys(f.confirmations[0]), ['title', 'details']);
    assert.equal(f.writes().length, 0);
    assert.equal(f.changes.length, 0);
  });
  test(`${name}: confirmation, then session validation, then exactly one write`, async () => {
    const f = fixture(role, { confirm: () => { assert.equal(f.writes().length, 0); return true; } });
    const response = await f.run(name, input);
    assert.equal(response.isError, undefined, JSON.stringify(response));
    assert.equal(f.writes().length, 1);
    assert.equal(f.calls.at(-2)[1], '/api/auth/session');
    assert.equal(f.changes.length, 1);
    assert.ok(!JSON.stringify(response).includes('hidden'));
  });
}

test('confirmation shows event fee, member subject, and actual changed fields', async () => {
  const f = fixture(); await f.run('book_event', booking);
  assert.match(f.confirmations[0].details, /Autumn Cup.*event-1.*2026-10-01.*£45.00/s);
  assert.match(f.confirmations[0].details, /dietaryRequirements.*Veg/s);
  assert.equal(f.writes()[0][2].expectedEventUpdatedAt, stamp);
  assert.deepEqual(f.writes()[0][2].preferences, Object.assign(Object.create(null), { meal: 'Yes' }));
  const admin = fixture('admin');
  await admin.run('admin_update_preparation', mutations[7][2]);
  assert.match(admin.confirmations[0].details, /Alex Golfer.*Autumn Cup.*group name.*B/s);
  assert.deepEqual(admin.writes()[0][2], { group_name: 'B', tee_time: '10:00', handicap: '12', notes: 'Keep notes', version: 2 });
});

test('event edits preserve the full editable form and booking fields, without sending finance settings', async () => {
  const f = fixture('admin'); await f.run('admin_edit_event', mutations[5][2]);
  const body = f.writes()[0][2];
  assert.equal(body.title, 'Renamed Cup');
  for (const key of ['description', 'joining_information', 'event_date', 'venue', 'cost', 'meet_time', 'tee_time']) assert.equal(body[key], f.state.adminEvent[key]);
  assert.deepEqual(body.bookingFields, JSON.parse(f.state.adminEvent.booking_fields_json));
  assert.equal(body.updated_at, stamp);
  assert.ok(!('payment_due_on' in body));
  assert.ok(!('cancellation_charge_policy' in body));
});

test('changed identity or role denies reads and writes, including changes during confirmation', async () => {
  for (const session of [null, { id: 'other', role: 'member' }, { id: 'member-1', role: 'admin' }, { id: 'member-1', role: 'member', mustChangePassword: true }]) {
    const f = fixture(); f.state.session = session;
    assert.equal((await f.run('list_events')).isError, true);
    assert.equal(f.calls.length, 1);
    const g = fixture('member', { confirm: (_, state) => { state.session = session; return true; } });
    assert.equal((await g.run('book_event', booking)).isError, true);
    assert.equal(g.writes().length, 0);
  }
  const admin = fixture('admin', { confirm: (_, state) => { state.session = { id: 'member-1', role: 'member' }; return true; } });
  assert.equal((await admin.run('admin_create_event', mutations[4][2])).isError, true);
  assert.equal(admin.writes().length, 0);
});

test('stale input versions and records changed while confirming cannot write', async () => {
  for (const [role, name, input] of mutations.filter(([, n]) => ['admin_edit_event', 'admin_save_results', 'admin_update_preparation', 'admin_cancel_booking'].includes(n))) {
    const f = fixture(role, { confirm: (_, state) => { state.adminEvent.updated_at = '2026-09-16T10:00:00.000Z'; state.results.generation = 'new'; state.player.version++; state.player.preparation_version++; return true; } });
    assert.equal((await f.run(name, input)).isError, true);
    assert.equal(f.writes().length, 0);
  }
  const f = fixture('member', { confirm: (_, state) => { state.event.cost = '99.00'; return true; } });
  assert.equal((await f.run('book_event', booking)).isError, true);
  assert.equal(f.writes().length, 0);
  const stale = fixture('admin');
  assert.equal((await stale.run('admin_edit_event', { ...mutations[5][2], updated_at: '2026-09-14T10:00:00.000Z' })).isError, true);
  assert.equal(stale.confirmations.length, 0);
});

test('inactive catalogs stop after awaits, including confirmation and post-write', async () => {
  for (const where of ['session', 'read', 'confirm', 'write']) {
    const f = fixture('member', {
      get: (path, state) => { if ((where === 'session' && path === '/api/auth/session') || (where === 'read' && path === '/api/events/event-1')) state.active = false; },
      confirm: (_, state) => { if (where === 'confirm') state.active = false; return true; },
      write: state => { if (where === 'write') state.active = false; },
    });
    assert.equal((await f.run('book_event', booking)).isError, true);
    assert.equal(f.writes().length, where === 'write' ? 1 : 0);
    assert.equal(f.changes.length, 0);
  }
});

test('global mutation lock covers async confirmation across separate catalogs', async () => {
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const f = fixture('member', { confirm: () => { entered(); return new Promise(resolve => { release = resolve; }); } });
  const pending = f.run('book_event', booking); await ready;
  const g = fixture('admin');
  assert.match(payload(await g.run('admin_create_event', mutations[4][2])).error, /Another change/);
  assert.equal(g.calls.length, 0);
  assert.equal(g.confirmations.length, 0);
  release(false); await pending;
  assert.equal((await g.run('admin_create_event', mutations[4][2])).isError, undefined);
});

test('strict schemas reject unknown fields, injection, invalid types and hostile objects before reads', async () => {
  for (const input of [null, [], {}, { eventId: '../account/balance' }, { eventId: '%2e%2e' }, { eventId: 'event-1?x=1' }, { eventId: 'event-1/booking' }, { eventId: 'event-1', path: '/api/admin/reconciliation' }, { eventId: 1 }, Object.assign(Object.create({ eventId: 'event-1' }), {}), JSON.parse('{"eventId":"event-1","__proto__":{}}')]) {
    const f = fixture(); assert.equal((await f.run('get_event', input)).isError, true); assert.equal(f.calls.length, 0);
  }
  for (const changes of [{ role: 'admin' }, { password: 'pw' }, { status: 'active' }, { financeUrl: 'https://example.com' }]) {
    const f = fixture('admin'); assert.equal((await f.run('admin_update_member', { memberId: 'member-2', displayName: 'Alex', ...changes })).isError, true); assert.equal(f.calls.length, 0);
  }
  for (const changes of [{ payment_due_on: '2026-10-01' }, { cancellation_charge_policy: 'review' }, { booking_fields_json: '{}' }, { bookingFields: {} }]) {
    const f = fixture('admin'); assert.equal((await f.run('admin_edit_event', { ...mutations[5][2], changes })).isError, true); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); assert.equal((await f.run('book_event', { ...booking, buggyRequired: 'false' })).isError, true); assert.equal(f.calls.length, 0);
});

test('dynamic question allowlist rejects unknown, duplicate, wrong-choice and missing required answers', async () => {
  for (const answers of [[], [{ key: 'role', value: 'admin' }], [{ key: 'meal', value: 'Maybe' }], [{ key: 'meal', value: true }], [{ key: 'meal', value: 'Yes' }, { key: 'meal', value: 'No' }], [{ key: 'constructor', value: 'Yes' }]]) {
    const f = fixture(); assert.equal((await f.run('book_event', { ...booking, answers })).isError, true); assert.equal(f.writes().length, 0); assert.equal(f.confirmations.length, 0);
  }
});

test('invalid event semantics cannot reach confirmation or write', async () => {
  for (const event of [{ title: 'Cup', event_date: '2026-02-30' }, { title: 'Cup', event_date: '2026-10-01', cost: '1000001' }, { title: 'Cup', event_date: '2026-10-01', status: 'open' }]) {
    const f = fixture('admin'); assert.equal((await f.run('admin_create_event', { event })).isError, true); assert.equal(f.writes().length, 0); assert.equal(f.confirmations.length, 0);
  }
});

test('safe errors redact API messages; callback failure cannot imply a write failed', async () => {
  const f = fixture('member', { get: () => { throw Error('secret token balance'); } });
  const response = await f.run('list_events'); assert.equal(response.isError, true); assert.ok(!/secret|token|balance/.test(JSON.stringify(response)));
  const g = fixture('member', { onChanged: () => { throw Error('refresh failed'); } });
  assert.equal((await g.run('book_event', booking)).isError, undefined); assert.equal(g.writes().length, 1);
  const h = fixture('member', { confirm: () => 'true' });
  assert.equal((await h.run('book_event', booking)).isError, true); assert.equal(h.writes().length, 0);
});


test('read result is withheld when the account changes during its request', async () => {
  const f = fixture('member', { get(path, state) {
    if (path === '/api/events') state.session = { id: 'other-member', role: 'member' };
  } });
  const result = await f.run('list_events');
  assert.equal(result.isError, true);
  assert.ok(!JSON.stringify(result).includes('Autumn Cup'));
});

test('administrator booking needs confirmation and carries the observed fee version', async () => {
  for (const accepted of [false, true]) {
    const f = fixture('admin', { confirm: () => accepted });
    f.state.player.status = 'cancelled';
    const result = await f.run('admin_add_booking', { ...booking, memberId: 'member-2' });
    assert.equal(f.writes().length, accepted ? 1 : 0);
    assert.match(f.confirmations[0].details, /Alex Golfer.*Autumn Cup.*£45.00/s);
    if (accepted) {
      assert.equal(result.isError, undefined);
      assert.equal(f.writes()[0][1], '/api/admin/manage/events/event-1/bookings');
      assert.equal(f.writes()[0][2].expectedEventUpdatedAt, stamp);
    }
  }
});

test('email update confirms sign-in consequences and rejects role changes', async () => {
  const f = fixture('admin');
  const result = await f.run('admin_update_member', { memberId: 'member-2', email: 'alex@example.test' });
  assert.equal(result.isError, undefined);
  assert.match(f.confirmations[0].details, /unlinks Google sign-in and revokes/);
  assert.deepEqual(f.writes()[0][2], { email: 'alex@example.test', expectedUpdatedAt: stamp });
  assert.equal((await f.run('admin_update_member', { memberId: 'member-2', role: 'admin' })).isError, true);
  assert.equal(f.writes().length, 1);
});

test('closed cancellation is rejected before confirmation', async () => {
  const f = fixture(); f.state.event.availability.cancellation = 'closed';
  const result = await f.run('cancel_booking', { eventId: 'event-1' });
  assert.match(payload(result).error, /Contact the committee/);
  assert.equal(f.confirmations.length, 0);
  assert.equal(f.writes().length, 0);
});


test('browser cancellation while reviewing cannot commit a change', async () => {
  const controller = new AbortController();
  const f = fixture('member', { confirm: () => { controller.abort(); return true; } });
  const result = await f.tools.find(t => t.name === 'jgs_book_event').execute(booking, { signal: controller.signal });
  assert.equal(result.isError, true);
  assert.equal(f.writes().length, 0);
});
