// Local WebMCP definitions only. Registration and confirmation UI belong to the bridge.
// One lock across catalogs (including catalogs replaced during a session refresh).
let mutationBusy = false;
const object = (properties = {}, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const string = (maxLength, minLength = 0, pattern) => ({ type: 'string', minLength, maxLength, ...(pattern ? { pattern } : {}) });
const id = string(200, 1, '^[A-Za-z0-9_-]+(?:::[A-Za-z0-9_-]+)?$');
const version = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const enumeration = (...values) => ({ type: 'string', enum: values });
const array = (items, maxItems) => ({ type: 'array', items, maxItems });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const date = string(10, 10, '^\\d{4}-\\d{2}-\\d{2}$');
const timestamp = string(35, 20, '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$');
const answer = object({ key: string(50, 1, '^[a-zA-Z][a-zA-Z0-9_]*$'), value: { anyOf: [string(500), { type: 'boolean' }] } });
const bookingInput = { eventId: id, dietaryRequirements: enumeration('Veg', 'Non-veg'), buggyRequired: { type: 'boolean' }, answers: array(answer, 15) };
const eventFields = {
  title: string(120, 1), venue: string(200), event_date: date, cost: string(10, 0, '^(?:\\d{1,7}(?:\\.\\d{1,2})?)?$'),
  meet_time: string(50), tee_time: string(50), description: string(5000), joining_information: string(5000),
  status: enumeration('draft', 'published', 'open', 'closed', 'completed'),
  publication_at: nullable(timestamp), registration_opens_at: nullable(timestamp), registration_closes_at: nullable(timestamp), cancellation_closes_at: nullable(timestamp),
};
const preparationFields = { group_name: string(80), tee_time: string(80), handicap: string(80), notes: string(1000) };
const resultEntry = object({ category: enumeration('poy', 'singles', 'radha', 'doubles'), year: { type: 'integer', minimum: 1900, maximum: 2200 }, winner: string(200, 1), score: string(100) });
class SafeError extends Error {}
const fail = message => { throw new SafeError(message); };
function validate(schema, value) {
  if (schema.anyOf) {
    if (!schema.anyOf.some(option => { try { validate(option, value); return true; } catch { return false; } })) fail('Invalid input.');
    return;
  }
  if (schema.type === 'object') {
    if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).some(k => typeof k !== 'string' || !Object.hasOwn(schema.properties, k) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), 'value'))) fail('Unknown or invalid input field.');
    if (schema.required.some(k => !Object.hasOwn(value, k))) fail('Missing required input field.');
    for (const k of Object.keys(value)) validate(schema.properties[k], value[k]);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > schema.maxItems || Object.keys(value).length !== value.length) fail('Invalid input list.');
    for (const item of value) validate(schema.items, item);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < schema.minLength || value.length > schema.maxLength || (schema.minLength > 0 && !value.trim()) || [...value].some(c => (c.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(c)) || c.charCodeAt(0) === 127) || (schema.pattern && !new RegExp(schema.pattern).test(value)) || (schema.enum && !schema.enum.includes(value))) fail('Invalid input text.');
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || value < schema.minimum || value > schema.maximum) fail('Invalid input number.');
  } else if (schema.type === 'boolean' ? typeof value !== 'boolean' : value !== null) fail('Invalid input value.');
}
const pick = (value, keys) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, value[k]]));
const parse = value => typeof value === 'string' ? JSON.parse(value) : value || {};
const fieldsOf = event => event.bookingFields || parse(event.booking_fields_json);
function safeFields(event) {
  const fields = fieldsOf(event);
  return { ...pick(fields, ['capacity', 'isCharity', 'package', 'schedule']), questions: (fields.questions || []).map(q => pick(q, ['key', 'label', 'type', 'required', 'options'])) };
}
function safePreferences(event, preferences) {
  return pick(parse(preferences), (fieldsOf(event).questions || []).map(q => q.key).filter(k => !['__proto__', 'constructor', 'prototype'].includes(k)));
}
function safeEvent(event) {
  return { ...pick(event, ['id', ...Object.keys(eventFields), 'eventDate', 'meetTime', 'teeTime', 'joiningInformation', 'registrationOpensAt', 'registrationClosesAt', 'cancellationClosesAt', 'timezone', 'updatedAt', 'updated_at', 'attendeeCount', 'confirmed_count']), bookingFields: safeFields(event),
    ...(event.availability ? { availability: pick(event.availability, ['visibility', 'registration', 'cancellation', 'reason']) } : {}),
    ...(event.booking ? { booking: { ...pick(event.booking, ['status', 'buggyRequired', 'dietaryRequirements', 'updatedAt']), preferences: safePreferences(event, event.booking.preferences) } } : {}),
  };
}
function safePreparation(data) {
  return { event: safeEvent(data.event), players: data.players.map(p => ({ ...pick(p, ['id', 'member_id', 'display_name', 'status', 'version', 'preparation_version', 'buggy_required', 'dietary_requirements', ...Object.keys(preparationFields)]), preferences: safePreferences(data.event, p.preferences_json) })), guests: (data.guests || []).map(g => pick(g, ['id', 'name', 'status', 'handicap', 'dietary', 'buggy_required', 'social', 'group_name', 'tee_time', 'notes'])) };
}
const directory = data => data.members.filter(m => m.role === 'member' && !m.username).map(m => pick(m, ['id', 'displayName', 'email', 'status', 'updatedAt']));
const resultData = data => ({ generation: data.generation, entries: data.entries.map(e => pick(e, Object.keys(resultEntry.properties))) });
const output = (data, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(data) }], ...(isError ? { isError: true } : {}) });
const changesText = changes => Object.entries(changes).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${JSON.stringify(value)}`).join('\n');
const same = (before, after) => { if (JSON.stringify(before) !== JSON.stringify(after)) fail('This record changed. Read it again before retrying.'); };
function checkEvent(form) {
  if (!Number.isFinite(Date.parse(form.event_date)) || new Date(form.event_date).toISOString().slice(0, 10) !== form.event_date) fail('Invalid event date.');
  if (Number(form.cost || 0) > 1000000) fail('Event cost exceeds the supported limit.');
  for (const k of ['publication_at', 'registration_opens_at', 'registration_closes_at', 'cancellation_closes_at']) if (form[k] && !Number.isFinite(Date.parse(form[k]))) fail('Invalid event deadline.');
  if (form.registration_opens_at && form.registration_closes_at && Date.parse(form.registration_opens_at) >= Date.parse(form.registration_closes_at)) fail('Registration must open before it closes.');
  if (['published', 'open'].includes(form.status) && (!form.venue?.trim() || !form.registration_opens_at || !form.registration_closes_at || !form.cancellation_closes_at)) fail('Publishing requires venue and all booking deadlines.');
}
function bookingBody(input, event) {
  const questions = fieldsOf(event).questions || [];
  const preferences = Object.create(null);
  for (const a of input.answers) {
    const q = questions.find(q => q.key === a.key);
    if (!q || ['__proto__', 'constructor', 'prototype'].includes(a.key) || Object.hasOwn(preferences, a.key) || (q.type === 'checkbox' ? typeof a.value !== 'boolean' : typeof a.value !== 'string') || (q.type === 'select' && a.value !== '' && !q.options.includes(a.value))) fail('Invalid event question answer.');
    preferences[a.key] = a.value;
  }
  for (const q of questions) if (q.required && (preferences[q.key] === undefined || preferences[q.key] === '' || (q.type === 'checkbox' && preferences[q.key] !== true))) fail('Answer all required event questions.');
  if (new TextEncoder().encode(JSON.stringify(preferences)).length > 4096) fail('Booking answers are too large.');
  return { dietaryRequirements: input.dietaryRequirements, buggyRequired: input.buggyRequired, preferences };
}

function safeApiError(error) {
  const messages = {
    cancellation_closed: 'The cancellation deadline has passed or cancellation is unavailable. Contact the committee. A refund is not guaranteed.',
    registration_not_open: 'Registration has not opened yet. Check the event opening time.',
    registration_closed: 'The registration deadline has passed. Contact the committee.',
    registration_unavailable: 'Registration is no longer available. Check event deadlines or contact the committee.',
    already_registered: 'This member already has an active booking.',
    no_active_booking: 'There is no active booking to update or cancel.',
    event_changed: 'The event changed. Read its current details and fee before booking again.',
    booking_changed: 'The booking changed. Read it again before saving.',
    changed: 'The record changed. Read it again before saving.',
    setup_required: 'Website management setup is required. Contact the committee.',
    email_exists: 'A member already uses this email address.',
    booking_fee_unavailable: 'The event fee needs checking. Contact the committee before booking.',
    booking_due_unavailable: 'The event payment due date needs checking. Contact the committee.',
    historical_booking_review: 'This previous booking needs committee review before rebooking.',
    booking_opening_cutoff: 'This booking date needs committee review before booking.',
  };
  return Object.hasOwn(messages, error?.code) ? messages[error.code] : null;
}

export function createTools({ user, api, confirm, onChanged = () => {}, isActive = () => true }) {
  if (!user || !['member', 'admin'].includes(user.role) || user.mustChangePassword) return [];
  const identity = { id: user.id, role: user.role };
  const active = () => { if (!isActive()) fail('This tool session is no longer active.'); };
  const session = async () => {
    active();
    const data = await api.get('/api/auth/session');
    active();
    if (!data.user || data.user.id !== identity.id || data.user.role !== identity.role || data.user.mustChangePassword) fail('Your signed-in identity or access changed. Refresh before continuing.');
  };
  const read = async path => { await session(); active(); const data = await api.get(path); active(); await session(); return data; };
  const eventRead = async eventId => (await read(`/api/events/${encodeURIComponent(eventId)}`)).event;
  const prepRead = eventId => read(`/api/admin/manage/events/${encodeURIComponent(eventId)}`);
  const write = async (title, details, method, path, body, guard) => {
    active();
    if (typeof confirm !== 'function') fail('Confirmation is unavailable.');
    const accepted = await confirm({ title, details });
    active();
    if (accepted !== true) fail('Action cancelled. Nothing was changed.');
    if (guard) { await guard(); active(); }
    await session(); active();
    await api[method](path, body); active();
    // A refresh failure must not report a successful mutation as failed/retryable.
    try { await onChanged(); } catch { /* The write succeeded. */ }
    active();
    return { success: true, action: title };
  };
  const definitions = [];
  const add = (name, description, schema, mutates, run) => definitions.push({
    name: `jgs_${name}`, description, inputSchema: schema, annotations: { readOnlyHint: !mutates, untrustedContentHint: true, consequentialHint: mutates },
    async execute(input) {
      let locked = false;
      try {
        validate(schema, input);
        const clean = JSON.parse(JSON.stringify(input));
        active();
        if (mutates) { if (mutationBusy) fail('Another change is awaiting confirmation or saving.'); mutationBusy = true; locked = true; }
        const result = await run(clean); active(); return output(result);
      } catch (error) {
        return output({ error: error instanceof SafeError ? error.message : safeApiError(error) || (error?.status === 409 ? 'The record changed or this action is unavailable. Refresh before retrying.' : error?.status === 401 || error?.status === 403 ? 'Sign-in or access verification failed.' : 'The action could not be completed. Check the website before retrying.') }, true);
      } finally { if (locked) mutationBusy = false; }
    },
  });
  add('list_events', 'List visible events and your booking status.', object(), false, async () => ({ events: (await read('/api/events')).events.map(safeEvent) }));
  add('get_event', 'Get one visible event, booking questions and your booking.', object({ eventId: id }), false, async i => ({ event: safeEvent(await eventRead(i.eventId)) }));
  if (identity.role === 'member') {
    for (const [name, method, title] of [['book_event', 'post', 'Book event'], ['update_booking_preferences', 'patch', 'Update booking preferences']]) {
      add(name, `${title}. Answers replace all event question answers; use get_event first. Requires confirmation.`, object(bookingInput), true, async i => {
        const event = await eventRead(i.eventId);
        const body = bookingBody(i, event);
        if (!event.updatedAt) fail('Event version is unavailable.');
        if (method === 'patch' && event.booking?.status !== 'registered') fail('No active booking to update.');
        if (method === 'post') body.expectedEventUpdatedAt = event.updatedAt;
        return write(title, `${title}: ${event.title} (${event.id}), ${event.eventDate}. Fee: £${event.cost || 'not specified'}.\n${changesText(body)}`, method, `/api/events/${encodeURIComponent(i.eventId)}/booking`, body, async () => same(safeEvent(event), safeEvent(await eventRead(i.eventId))));
      });
    }
    add('cancel_booking', 'Cancel your active event booking after confirmation.', object({ eventId: id }), true, async i => {
      const event = await eventRead(i.eventId);
      if (event.booking?.status !== 'registered') fail('No active booking to cancel.');
      if (event.availability?.cancellation !== 'open') fail('Cancellation is unavailable or the deadline has passed. Contact the committee. A refund is not guaranteed.');
      return write('Cancel booking', `Cancel your booking for ${event.title} (${event.id}), ${event.eventDate}. Status: registered → cancelled. A refund is not guaranteed; contact the committee about charges or refunds.`, 'delete', `/api/events/${encodeURIComponent(i.eventId)}/booking`, undefined, async () => same(safeEvent(event), safeEvent(await eventRead(i.eventId))));
    });
  }
  if (identity.role === 'admin') {
    add('admin_list_events', 'List administrator event details, including drafts.', object(), false, async () => ({ events: (await read('/api/admin/events')).events.map(safeEvent) }));
    add('admin_get_preparation', 'Get event players, guests and preparation; excludes contact and finance data.', object({ eventId: id }), false, async i => safePreparation(await prepRead(i.eventId)));
    add('admin_list_members', 'List ordinary member IDs, display names, contact emails and account status.', object(), false, async () => ({ members: directory(await read('/api/admin/members')) }));
    add('admin_update_member', 'Update an ordinary member display name and/or contact email after confirmation. Email changes unlink Google sign-in and revoke sessions.', object({ memberId: id, displayName: string(120, 1), email: string(254, 3, '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$') }, ['memberId']), true, async i => {
      const changes = pick(i, ['displayName', 'email']);
      if (!Object.keys(changes).length) fail('Supply a display name or contact email.');
      if (changes.email) changes.email = changes.email.trim().toLowerCase();
      const member = directory(await read('/api/admin/members')).find(m => m.id === i.memberId);
      if (!member) fail('Ordinary member not found.');
      if (!member.updatedAt) fail('Member version is unavailable.');
      return write('Update member', `Member ${member.displayName} (${member.id}).\n${Object.entries(changes).map(([k, v]) => `${k}: ${member[k] || '(not set)'} → ${v}`).join('\n')}${changes.email && changes.email !== member.email ? '\nChanging email unlinks Google sign-in and revokes this member’s active sessions and password-reset tokens.' : ''}`, 'patch', `/api/admin/members/${encodeURIComponent(i.memberId)}`, { ...changes, expectedUpdatedAt: member.updatedAt }, async () => same(member, directory(await read('/api/admin/members')).find(m => m.id === i.memberId)));
    });
    add('admin_add_booking', 'Book an active ordinary member into an event after confirmation, including after the booking deadline. Capacity and server booking checks still apply.', object({ ...bookingInput, memberId: id }), true, async i => {
      const data = await prepRead(i.eventId);
      const member = directory(await read('/api/admin/members')).find(m => m.id === i.memberId && m.status === 'active');
      if (!member) fail('Active ordinary member not found.');
      if (data.players.some(p => p.member_id === i.memberId && p.status === 'registered')) fail('This member already has an active booking.');
      if (!data.event.updated_at) fail('Event version is unavailable.');
      const body = { ...bookingBody(i, data.event), memberId: i.memberId, expectedEventUpdatedAt: data.event.updated_at };
      return write('Add member booking', `Book ${member.displayName} (${member.id}) into ${data.event.title} (${data.event.id}), ${data.event.event_date}. Fee: £${data.event.cost || 'not specified'}. Committee booking may override the booking deadline.\n${changesText(body)}`, 'post', `/api/admin/manage/events/${encodeURIComponent(i.eventId)}/bookings`, body, async () => {
        same(safePreparation(data), safePreparation(await prepRead(i.eventId)));
        same(member, directory(await read('/api/admin/members')).find(m => m.id === i.memberId && m.status === 'active'));
      });
    });
    add('admin_create_event', 'Create an event after confirmation. Booking questions and payment policy configuration are not supported.', object({ event: object(eventFields, ['title', 'event_date']) }), true, async i => {
      checkEvent(i.event);
      return write('Create event', `Create event ${i.event.title}.\n${changesText(i.event)}\nUnspecified status: draft; unspecified fee: not set.`, 'post', '/api/admin/manage/events', i.event);
    });
    add('admin_edit_event', 'Edit listed event fields, preserving booking questions and other settings. Use updated_at from preparation.', object({ eventId: id, updated_at: timestamp, changes: object(eventFields, []) }), true, async i => {
      if (!Object.keys(i.changes).length) fail('Supply at least one changed field.');
      const { event } = await prepRead(i.eventId);
      same(i.updated_at, event.updated_at);
      const body = { ...pick(event, Object.keys(eventFields)), ...i.changes, updated_at: event.updated_at, bookingFields: safeFields(event) };
      checkEvent(body);
      return write('Edit event', `Edit ${event.title} (${event.id}).\n${changesText(i.changes)}`, 'post', `/api/admin/manage/events/${encodeURIComponent(i.eventId)}`, body, async () => same(event.updated_at, (await prepRead(i.eventId)).event.updated_at));
    });
    add('admin_get_results', 'Get competition results and their replacement generation guard.', object(), false, async () => resultData(await read('/api/admin/manage/results')));
    add('admin_save_results', 'Replace ALL competition results after confirmation; omitted results are removed. Requires current generation.', object({ generation: string(200, 1), entries: array(resultEntry, 500) }), true, async i => {
      const before = resultData(await read('/api/admin/manage/results'));
      same(i.generation, before.generation);
      return write('Replace competition results', `Replace all ${before.entries.length} existing results with ${i.entries.length} results. Omitted results will be removed.\n${i.entries.map(e => `${e.category}, ${e.year}: ${e.winner}; score ${e.score}`).join('\n')}`, 'post', '/api/admin/manage/results', i, async () => same(before.generation, (await read('/api/admin/manage/results')).generation));
    });
    for (const cancel of [false, true]) {
      const name = cancel ? 'admin_cancel_booking' : 'admin_update_preparation';
      const schema = object({ eventId: id, bookingId: id, version, ...(cancel ? {} : { changes: object(preparationFields, []) }) });
      add(name, cancel ? 'Cancel a named member booking, with booking version guard and confirmation.' : 'Update a named player preparation, preserving omitted fields. Version is preparation_version (or 0).', schema, true, async i => {
        const data = await prepRead(i.eventId);
        const player = data.players.find(p => p.id === i.bookingId);
        if (!player) fail('Booking not found in this event.');
        const currentVersion = cancel ? player.version : player.preparation_version || 0;
        same(i.version, currentVersion);
        if (cancel && player.status !== 'registered') fail('No active booking to cancel.');
        if (!cancel && !Object.keys(i.changes).length) fail('Supply at least one changed field.');
        const body = cancel ? { version: i.version, status: 'cancelled' } : { ...Object.fromEntries(Object.keys(preparationFields).map(k => [k, player[k] || ''])), ...i.changes, version: i.version };
        const title = cancel ? 'Cancel member booking' : 'Update player preparation';
        return write(title, `${title}: ${player.display_name} (${player.member_id}), event ${data.event.title} (${data.event.id}).\n${changesText(cancel ? { status: 'registered → cancelled' } : i.changes)}${cancel ? '\nA refund is not guaranteed; contact the committee about charges or refunds.' : ''}`, cancel ? 'patch' : 'post', `/api/admin/${cancel ? 'bookings' : 'manage/preparation'}/${encodeURIComponent(i.bookingId)}`, body, async () => same(safePreparation(data), safePreparation(await prepRead(i.eventId))));
      });
    }
  }
  return definitions;
}
