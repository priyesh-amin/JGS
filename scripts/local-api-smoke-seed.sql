-- Isolated local smoke-test data only. Never apply this file remotely.
PRAGMA foreign_keys = ON;

INSERT INTO events (
  id, title, venue, event_date, meet_time, tee_time, cost,
  description, joining_information, publication_at,
  registration_opens_at, registration_closes_at,
  cancellation_closes_at, timezone, status, booking_fields_json,
  source_type, source_key, source_updated_at, last_synced_at,
  created_at, updated_at
) VALUES (
  'local-smoke-event',
  'Local Smoke Test Event',
  'Isolated Test Course',
  '2030-09-19',
  '08:00',
  '09:00',
  '65',
  'Isolated local verification fixture.',
  'Test data only.',
  '2020-01-01T00:00:00.000Z',
  '2020-01-01T00:00:00.000Z',
  '2030-09-10T22:59:59.999Z',
  '2030-09-12T22:59:59.999Z',
  'Europe/London',
  'published',
  '{}',
  'google_sheet',
  'local-smoke-event',
  '2026-08-21T00:00:00.000Z',
  '2026-08-21T00:00:00.000Z',
  '2026-08-21T00:00:00.000Z',
  '2026-08-21T00:00:00.000Z'
);

INSERT INTO leaderboard_entries
  (generation_id, category, year, winner, score, source_row, synced_at)
VALUES
  ('local-smoke-generation', 'poy', 2025, 'Test Winner', 'Test score', 1, '2026-08-21T00:00:00.000Z'),
  ('local-smoke-generation', 'singles', 2025, 'Test Winner', 'Test score', 2, '2026-08-21T00:00:00.000Z'),
  ('local-smoke-generation', 'radha', 2025, 'Test Winner', 'Test score', 3, '2026-08-21T00:00:00.000Z'),
  ('local-smoke-generation', 'doubles', 2025, 'Test Winner', 'Test score', 4, '2026-08-21T00:00:00.000Z');

INSERT INTO leaderboard_state (singleton, active_generation_id, updated_at)
VALUES (1, 'local-smoke-generation', '2026-08-21T00:00:00.000Z');

INSERT INTO sync_runs
  (id, sync_type, status, started_at, completed_at, summary_json)
VALUES
  ('local-fixture-sync', 'fixtures', 'success', '2026-08-21T00:00:00.000Z', '2026-08-21T00:00:00.000Z', '{"accountedFixtureCount":1,"classifications":{"bookable":1},"fixtures":[]}'),
  ('local-leaderboard-sync', 'leaderboards', 'success', '2026-08-21T00:00:00.000Z', '2026-08-21T00:00:00.000Z', '{"recordCount":4}');
