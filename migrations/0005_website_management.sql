CREATE TABLE IF NOT EXISTS management_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO management_settings VALUES ('mode', 'legacy');
CREATE TABLE IF NOT EXISTS management_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES members(id),
 entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL,
 before_json TEXT, after_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS member_balances (
 member_id TEXT PRIMARY KEY REFERENCES members(id), balance_pence INTEGER NOT NULL,
 reconciled_on TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS event_preparation (
 booking_id TEXT PRIMARY KEY REFERENCES bookings(id), group_name TEXT NOT NULL DEFAULT '',
 tee_time TEXT NOT NULL DEFAULT '', handicap TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS event_guests (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), host_member_id TEXT REFERENCES members(id),
 name TEXT NOT NULL, handicap TEXT NOT NULL DEFAULT '', dietary TEXT NOT NULL,
 buggy_required INTEGER NOT NULL DEFAULT 0, social TEXT NOT NULL DEFAULT '',
 group_name TEXT NOT NULL DEFAULT '', tee_time TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'registered' CHECK(status IN ('registered','cancelled')),
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS management_snapshots (
 id TEXT PRIMARY KEY, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
);
-- Protect website-owned data even while an older scheduled Worker is deployed.
CREATE TRIGGER IF NOT EXISTS protect_native_fixture_insert BEFORE INSERT ON events
WHEN NEW.source_type = 'google_sheet' AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS protect_native_fixture_update BEFORE UPDATE ON events
WHEN NEW.source_type = 'google_sheet' AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS protect_native_leaderboard_state BEFORE UPDATE ON leaderboard_state
WHEN NEW.active_generation_id NOT LIKE 'website:%' AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS protect_native_leaderboard_insert BEFORE INSERT ON leaderboard_state
WHEN NEW.active_generation_id NOT LIKE 'website:%' AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS protect_native_results BEFORE DELETE ON leaderboard_entries
WHEN OLD.generation_id = (SELECT active_generation_id FROM leaderboard_state WHERE singleton=1)
AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS stop_booking_sheet_queue BEFORE INSERT ON integration_outbox
WHEN NEW.aggregate_type='booking' AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS stop_booking_sheet_requeue BEFORE UPDATE ON integration_outbox
WHEN NEW.aggregate_type='booking' AND NEW.status IN ('pending','processing')
AND (SELECT value FROM management_settings WHERE key='mode')='website'
BEGIN SELECT RAISE(IGNORE); END;
CREATE TRIGGER IF NOT EXISTS website_booking_capacity_insert BEFORE INSERT ON bookings
WHEN NEW.status='registered' AND (SELECT source_type FROM events WHERE id=NEW.event_id)='website'
AND (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id) IS NOT NULL
AND (SELECT COUNT(*) FROM bookings WHERE event_id=NEW.event_id AND status='registered') + (SELECT COUNT(*) FROM event_guests WHERE event_id=NEW.event_id AND status='registered') >= (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'Event capacity reached'); END;
CREATE TRIGGER IF NOT EXISTS website_booking_capacity_update BEFORE UPDATE ON bookings
WHEN NEW.status='registered' AND OLD.status<>'registered' AND (SELECT source_type FROM events WHERE id=NEW.event_id)='website'
AND (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id) IS NOT NULL
AND (SELECT COUNT(*) FROM bookings WHERE event_id=NEW.event_id AND status='registered') + (SELECT COUNT(*) FROM event_guests WHERE event_id=NEW.event_id AND status='registered') >= (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'Event capacity reached'); END;
CREATE TRIGGER IF NOT EXISTS website_guest_capacity_insert BEFORE INSERT ON event_guests
WHEN NEW.status='registered' AND (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id) IS NOT NULL
AND (SELECT COUNT(*) FROM bookings WHERE event_id=NEW.event_id AND status='registered') + (SELECT COUNT(*) FROM event_guests WHERE event_id=NEW.event_id AND status='registered') >= (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'Event capacity reached'); END;
CREATE TRIGGER IF NOT EXISTS website_guest_capacity_update BEFORE UPDATE ON event_guests
WHEN NEW.status='registered' AND OLD.status<>'registered'
AND (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id) IS NOT NULL
AND (SELECT COUNT(*) FROM bookings WHERE event_id=NEW.event_id AND status='registered') + (SELECT COUNT(*) FROM event_guests WHERE event_id=NEW.event_id AND status='registered') >= (SELECT json_extract(booking_fields_json,'$.capacity') FROM events WHERE id=NEW.event_id)
BEGIN SELECT RAISE(ABORT,'Event capacity reached'); END;
CREATE TABLE IF NOT EXISTS legacy_registration_reviews (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), source TEXT NOT NULL,
 name TEXT NOT NULL, details_json TEXT NOT NULL, resolution TEXT NOT NULL DEFAULT '',
 resolved_by TEXT REFERENCES members(id), resolved_at TEXT
);
CREATE TRIGGER IF NOT EXISTS prevent_unsafe_cutover BEFORE UPDATE ON management_settings
WHEN NEW.key='mode' AND NEW.value='website' AND OLD.value<>'website'
AND EXISTS (SELECT 1 FROM integration_outbox WHERE status<>'sent')
BEGIN SELECT RAISE(ABORT,'Pending deliveries must finish before cutover'); END;
CREATE TRIGGER IF NOT EXISTS prevent_capacity_reduction BEFORE UPDATE OF booking_fields_json ON events
WHEN NEW.source_type='website' AND json_extract(NEW.booking_fields_json,'$.capacity') IS NOT NULL
AND json_extract(NEW.booking_fields_json,'$.capacity') < (SELECT COUNT(*) FROM bookings WHERE event_id=NEW.id AND status='registered') + (SELECT COUNT(*) FROM event_guests WHERE event_id=NEW.id AND status='registered')
BEGIN SELECT RAISE(ABORT,'Capacity cannot be below confirmed players'); END;
CREATE TABLE IF NOT EXISTS competition_tables (
 id TEXT PRIMARY KEY, rows_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
