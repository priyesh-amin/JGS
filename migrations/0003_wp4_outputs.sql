-- WP4 last-known-valid leaderboard projection and leased booking output.
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    generation_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('poy', 'singles', 'radha', 'doubles')),
    year INTEGER NOT NULL,
    winner TEXT NOT NULL,
    score TEXT NOT NULL DEFAULT '',
    source_row INTEGER NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (generation_id, source_row)
);
CREATE INDEX IF NOT EXISTS leaderboard_entries_display_idx ON leaderboard_entries (generation_id, category, year DESC, source_row);
CREATE TABLE IF NOT EXISTS leaderboard_state (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    active_generation_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE integration_outbox ADD COLUMN lease_token TEXT;
ALTER TABLE integration_outbox ADD COLUMN lease_expires_at TEXT;
CREATE INDEX IF NOT EXISTS integration_outbox_lease_idx ON integration_outbox (status, lease_expires_at);
