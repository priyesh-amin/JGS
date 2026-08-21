-- Member roster provenance, Google federation and one-time password recovery.
ALTER TABLE members ADD COLUMN google_subject TEXT;
ALTER TABLE members ADD COLUMN google_linked_at TEXT;
ALTER TABLE members ADD COLUMN password_login_enabled INTEGER NOT NULL DEFAULT 1
    CHECK (password_login_enabled IN (0, 1));
ALTER TABLE members ADD COLUMN account_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (account_source IN ('manual', 'players_sheet'));

CREATE UNIQUE INDEX IF NOT EXISTS members_google_subject_unique
    ON members (google_subject)
    WHERE google_subject IS NOT NULL;

ALTER TABLE sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'password'
    CHECK (auth_method IN ('password', 'google'));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    delivered_at TEXT,
    used_at TEXT,
    used_by_request TEXT
);

CREATE INDEX IF NOT EXISTS password_reset_member_time_idx
    ON password_reset_tokens (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_expiry_idx
    ON password_reset_tokens (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_throttles (
    throttle_key TEXT PRIMARY KEY,
    window_started_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS authentication_audit (
    id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (
        action IN (
            'google_linked',
            'password_reset_requested',
            'password_reset_completed',
            'password_reset_delivery_failed'
        )
    ),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS authentication_audit_time_idx
    ON authentication_audit (created_at DESC);
