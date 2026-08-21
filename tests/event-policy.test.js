import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanCancel,
  assertCanRegister,
  eventAvailability,
} from '../functions/_lib/event-policy.js';

const baseEvent = {
  status: 'published',
  publication_at: '2026-07-01T00:00:00.000Z',
  registration_opens_at: '2026-08-01T08:00:00.000Z',
  registration_closes_at: '2026-09-12T17:00:00.000Z',
  cancellation_closes_at: '2026-09-16T17:00:00.000Z',
};

test('unpublished events are hidden', () => {
  assert.equal(
    eventAvailability(
      { ...baseEvent, status: 'draft' },
      new Date('2026-08-10T12:00:00Z'),
    ).visibility,
    'hidden',
  );
});

test('registration has explicit before, open and closed states', () => {
  assert.equal(
    eventAvailability(baseEvent, new Date('2026-07-20T12:00:00Z')).registration,
    'upcoming',
  );
  assert.equal(
    eventAvailability(baseEvent, new Date('2026-08-10T12:00:00Z')).registration,
    'open',
  );
  assert.equal(
    eventAvailability(baseEvent, new Date('2026-09-12T17:00:00Z')).registration,
    'closed',
  );
});

test('cancellation uses its independent deadline', () => {
  const afterRegistrationClose = new Date('2026-09-14T12:00:00Z');
  const state = eventAvailability(baseEvent, afterRegistrationClose);
  assert.equal(state.registration, 'closed');
  assert.equal(state.cancellation, 'open');
  assert.doesNotThrow(() => assertCanCancel(baseEvent, afterRegistrationClose));
});

test('missing windows fail closed instead of guessing a default', () => {
  const state = eventAvailability(
    {
      ...baseEvent,
      registration_opens_at: null,
      registration_closes_at: null,
    },
    new Date('2026-08-10T12:00:00Z'),
  );
  assert.equal(state.registration, 'unavailable');
  assert.throws(
    () => assertCanRegister(
      {
        ...baseEvent,
        registration_opens_at: null,
        registration_closes_at: null,
      },
      new Date('2026-08-10T12:00:00Z'),
    ),
    (error) => error.code === 'configuration_required',
  );
});


test('cancellation configuration is required and closes at the exact boundary', () => {
  const missing = { ...baseEvent, cancellation_closes_at: null };
  const missingState = eventAvailability(missing, new Date('2026-08-10T12:00:00Z'));
  assert.equal(missingState.registration, 'unavailable');
  assert.equal(missingState.reason, 'configuration_required');
  assert.throws(
    () => assertCanRegister(missing, new Date('2026-08-10T12:00:00Z')),
    (error) => error.code === 'configuration_required',
  );

  const boundary = eventAvailability(
    baseEvent,
    new Date(baseEvent.cancellation_closes_at),
  );
  assert.equal(boundary.registration, 'closed');
  assert.equal(boundary.cancellation, 'closed');
  assert.equal(boundary.reason, 'cancellation_closed');
});
