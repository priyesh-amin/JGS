import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFixtureSheet } from '../functions/_lib/sheet-sync.js';

test('fixture mapping preserves stable IDs and configurable windows', () => {
  const csv = [
    'ID,Date,Event,Venue,Cost,Status,RegistrationOpensAt,RegistrationClosesAt,CancellationClosesAt,Timezone',
    'sept-monthly-2026,19 Sep 2026,September Monthly,Pine Ridge,£65,Open,2026-08-20T09:00:00+01:00,2026-09-12T18:00:00+01:00,2026-09-16T18:00:00+01:00,Europe/London',
  ].join('\n');
  const [event] = parseFixtureSheet(csv);
  assert.equal(event.id, 'sept-monthly-2026');
  assert.equal(event.eventDate, '2026-09-19');
  assert.equal(event.status, 'published');
  assert.equal(event.registrationOpensAt, '2026-08-20T08:00:00.000Z');
  assert.equal(event.timezone, 'Europe/London');
});

test('duplicate source IDs reject the entire sync input', () => {
  const csv = [
    'ID,Date,Event,Venue,Status',
    'same,19 Sep 2026,One,Pine Ridge,Open',
    'same,03 Oct 2026,Two,Basildon,Open',
  ].join('\n');
  assert.throws(
    () => parseFixtureSheet(csv),
    (error) => error.code === 'invalid_sheet_data',
  );
});

test('invalid optional timestamps are rejected instead of guessed', () => {
  const csv = [
    'ID,Date,Event,Venue,Status,RegistrationOpensAt',
    'sept,19 Sep 2026,September Monthly,Pine Ridge,Open,thirty days before',
  ].join('\n');
  assert.throws(
    () => parseFixtureSheet(csv),
    (error) => error.code === 'invalid_sheet_data',
  );
});

