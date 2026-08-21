import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertMember } from '../functions/_lib/auth.js';
import {
  correctBooking,
  updateEvent,
} from '../functions/_lib/admin-store.js';
import {
  cancelMember,
  registerMember,
} from '../functions/_lib/booking-store.js';

const now = new Date('2026-07-29T09:00:00.000Z');
const event = {
  id: 'fixture-one',
  source_type: 'google_sheet',
  status: 'published',
  publication_at: '2026-07-01T00:00:00.000Z',
  registration_opens_at: '2026-07-20T08:00:00.000Z',
  registration_closes_at: '2026-08-05T17:00:00.000Z',
  cancellation_closes_at: '2026-08-07T17:00:00.000Z',
  timezone: 'Europe/London',
  attendee_count: 0,
};

function fakeBookingDb({ booking = null, changes = 1 } = {}) {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            sql,
            values,
            async first() {
              if (sql.includes('FROM events e')) return event;
              if (sql.includes('FROM bookings')) return booking;
              return null;
            },
          };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map((_, index) => ({
        meta: { changes: index === 0 ? changes : changes ? 1 : 0 },
      }));
    },
  };
}

test('only member roles can use personal booking mutations', () => {
  assert.equal(assertMember({ role: 'member' }).role, 'member');
  assert.throws(
    () => assertMember({ role: 'admin' }),
    (error) => error.status === 403 && error.code === 'member_account_required',
  );
});

test('booking input rejects type coercion and unbounded preference shapes', async () => {
  for (const input of [
    { buggyRequired: 'false', dietaryRequirements: 'Veg' },
    { dietaryRequirements: 'Veg', preferences: [] },
    { dietaryRequirements: 'Veg', preferences: { unsafe: { nested: true } } },
  ]) {
    const db = fakeBookingDb();
    await assert.rejects(
      registerMember(db, { memberId: 'member-one', eventId: event.id, input, now }),
      (error) => error.status === 400 && error.code === 'invalid_booking_input',
    );
    assert.equal(db.batches.length, 0);
  }
});

test('booking requires exactly one canonical dietary choice', async () => {
  for (const dietaryRequirements of [
    undefined,
    null,
    '',
    'veg',
    'Non-Veg',
    'Vegetarian',
    ' Veg ',
    12,
  ]) {
    const db = fakeBookingDb();
    await assert.rejects(
      registerMember(db, {
        memberId: 'member-one',
        eventId: event.id,
        input: { dietaryRequirements },
        now,
      }),
      (error) => error.status === 400 && error.code === 'invalid_dietary_choice',
    );
    assert.equal(db.batches.length, 0);
  }

  for (const dietaryRequirements of ['Veg', 'Non-veg']) {
    const db = fakeBookingDb();
    await registerMember(db, {
      memberId: 'member-one',
      eventId: event.id,
      input: { dietaryRequirements },
      now,
    });
    assert.equal(db.batches[0][0].values[3], dietaryRequirements);
  }
});

test('registration write is guarded by the authoritative source and every exact window', async () => {
  const db = fakeBookingDb();
  await registerMember(db, {
    memberId: 'member-one',
    eventId: event.id,
    input: { buggyRequired: false, dietaryRequirements: 'Veg' },
    now,
  });
  const [write, audit, outbox] = db.batches[0];
  assert.match(write.sql, /source_type = 'google_sheet'/);
  assert.match(write.sql, /registration_opens_at IS NOT NULL/);
  assert.match(write.sql, /registration_closes_at IS NOT NULL/);
  assert.match(write.sql, /cancellation_closes_at IS NOT NULL/);
  assert.match(audit.sql, /SELECT .* FROM bookings/s);
  assert.match(outbox.sql, /SELECT .* FROM bookings/s);
});

test('a registration policy race fails closed without claiming success', async () => {
  const db = fakeBookingDb({ changes: 0 });
  await assert.rejects(
    registerMember(db, {
      memberId: 'member-one',
      eventId: event.id,
      input: { dietaryRequirements: 'Veg' },
      now,
    }),
    (error) => error.status === 409 && error.code === 'registration_unavailable',
  );
});

test('a cancellation policy race fails closed', async () => {
  const booking = {
    id: 'fixture-one::member-one',
    member_id: 'member-one',
    event_id: event.id,
    status: 'registered',
    version: 1,
  };
  const db = fakeBookingDb({ booking, changes: 0 });
  await assert.rejects(
    cancelMember(db, { memberId: 'member-one', eventId: event.id, now }),
    (error) => error.status === 409 && error.code === 'cancellation_closed',
  );
  assert.match(db.batches[0][0].sql, /cancellation_closes_at > \?/);
});

test('administrator correction uses the same strict dietary enum', async () => {
  const booking = {
    id: 'fixture-one::member-one',
    member_id: 'member-one',
    event_id: event.id,
    status: 'registered',
    buggy_required: 0,
    dietary_requirements: 'Veg',
    preferences_json: '{}',
    registered_at: now.toISOString(),
    cancelled_at: null,
    updated_at: now.toISOString(),
    version: 1,
  };
  const invalid = fakeBookingDb({ booking });
  await assert.rejects(
    correctBooking(
      invalid,
      booking.id,
      { dietaryRequirements: 'Vegetarian' },
      { id: 'admin-one' },
      now,
    ),
    (error) => error.status === 400 && error.code === 'invalid_dietary_choice',
  );
  assert.equal(invalid.batches.length, 0);

  const valid = fakeBookingDb({ booking });
  const corrected = await correctBooking(
    valid,
    booking.id,
    { dietaryRequirements: 'Non-veg' },
    { id: 'admin-one' },
    now,
  );
  assert.equal(corrected.dietaryRequirements, 'Non-veg');
  assert.equal(valid.batches[0][0].values[2], 'Non-veg');
});

test('member form exposes an accessible required two-choice selector with no default', () => {
  const source = readFileSync(
    new URL('../src/pages/EventDetails.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /<fieldset>/);
  assert.match(source, /Dietary choice/);
  assert.match(source, /\['Veg', 'Non-veg'\]/);
  assert.match(source, /name="dietary-choice"/);
  assert.match(source, /required/);
  assert.match(source, /checked=\{dietaryChoice === choice\}/);
  assert.match(source, /disabled=\{submitting \|\| !dietaryChoice\}/);
  assert.doesNotMatch(source, /id="dietary-requirements"/);
});

test('sheet-owned fixture fields cannot be overridden through admin update', async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return { first: async () => ({ id: event.id, source_type: 'google_sheet' }) };
        },
      };
    },
  };
  await assert.rejects(
    updateEvent(db, event.id, { status: 'open' }),
    (error) => error.status === 409 && error.code === 'source_managed_event',
  );
});
