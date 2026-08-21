ALTER TABLE members ADD COLUMN username TEXT COLLATE NOCASE;

CREATE UNIQUE INDEX IF NOT EXISTS members_username_unique
    ON members (username)
    WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_security_audit (
    id TEXT PRIMARY KEY,
    actor_member_id TEXT REFERENCES members(id) ON DELETE RESTRICT,
    actor_kind TEXT NOT NULL CHECK (actor_kind IN ('member', 'system_setup')),
    target_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (
        action IN (
            'operational_admin_created',
            'operational_admin_password_reset'
        )
    ),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS account_security_audit_time_idx
    ON account_security_audit (created_at DESC);
