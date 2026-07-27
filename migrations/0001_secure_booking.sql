PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active', 'disabled')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
    finance_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS members_status_idx ON members (status);

CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_member_idx ON sessions (member_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_throttles (
    throttle_key TEXT PRIMARY KEY,
    window_started_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    venue TEXT NOT NULL,
    event_date TEXT NOT NULL,
    meet_time TEXT,
    tee_time TEXT,
    cost TEXT,
    description TEXT,
    joining_information TEXT,
    publication_at TEXT,
    registration_opens_at TEXT,
    registration_closes_at TEXT,
    cancellation_closes_at TEXT,
    timezone TEXT NOT NULL DEFAULT 'Europe/London',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'open', 'closed', 'completed')),
    booking_fields_json TEXT NOT NULL DEFAULT '{}',
    source_type TEXT NOT NULL DEFAULT 'google_sheet',
    source_key TEXT NOT NULL,
    source_updated_at TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (source_type, source_key)
);

CREATE INDEX IF NOT EXISTS events_date_idx ON events (event_date);
CREATE INDEX IF NOT EXISTS events_status_idx ON events (status);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('registered', 'cancelled')),
    buggy_required INTEGER NOT NULL DEFAULT 0 CHECK (buggy_required IN (0, 1)),
    dietary_requirements TEXT,
    preferences_json TEXT NOT NULL DEFAULT '{}',
    registered_at TEXT NOT NULL,
    cancelled_at TEXT,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    UNIQUE (member_id, event_id)
);

CREATE INDEX IF NOT EXISTS bookings_event_status_idx
    ON bookings (event_id, status);

CREATE TABLE IF NOT EXISTS booking_audit (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    actor_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (
        action IN ('registered', 'cancelled', 'admin_corrected')
    ),
    before_json TEXT,
    after_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS booking_audit_booking_idx
    ON booking_audit (booking_id, created_at);

CREATE TABLE IF NOT EXISTS integration_outbox (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sent_at TEXT
);

CREATE INDEX IF NOT EXISTS integration_outbox_pending_idx
    ON integration_outbox (status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS sync_runs (
    id TEXT PRIMARY KEY,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    summary_json TEXT,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS sync_runs_type_time_idx
    ON sync_runs (sync_type, started_at DESC);

