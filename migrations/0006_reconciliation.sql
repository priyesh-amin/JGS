-- Separate ledger; existing balance records are not migrated automatically.
CREATE TABLE finance_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
INSERT INTO finance_state VALUES (1,0);
CREATE TABLE finance_accounts (
 member_id TEXT PRIMARY KEY REFERENCES members(id), opening_on TEXT NOT NULL,
 created_at TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES members(id)
);
CREATE TABLE finance_imports (
 id TEXT PRIMARY KEY, account TEXT NOT NULL, filename TEXT NOT NULL,
 coverage_from TEXT NOT NULL, coverage_through TEXT NOT NULL,
 created_at TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES members(id)
);
CREATE TABLE finance_bank_rows (
 id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES finance_imports(id),
 fingerprint TEXT NOT NULL, posted_on TEXT NOT NULL, amount_pence INTEGER NOT NULL,
 memo TEXT NOT NULL, subcategory TEXT NOT NULL, raw_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','posted','duplicate','non_member')),
 resolution TEXT NOT NULL DEFAULT '', actor_id TEXT REFERENCES members(id), resolved_at TEXT
);
CREATE INDEX finance_fingerprint ON finance_bank_rows(fingerprint);
CREATE TABLE finance_journal (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES finance_accounts(member_id),
 kind TEXT NOT NULL CHECK(kind IN ('opening','receipt','charge','credit','refund','reversal')),
 amount_pence INTEGER NOT NULL, posted_on TEXT NOT NULL, due_on TEXT NOT NULL,
 event_code TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', note TEXT NOT NULL,
 bank_row_id TEXT REFERENCES finance_bank_rows(id), reverses_id TEXT UNIQUE REFERENCES finance_journal(id),
 created_at TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES members(id)
);
CREATE INDEX finance_member_journal ON finance_journal(member_id,posted_on);
CREATE TRIGGER finance_event_booking_guard BEFORE INSERT ON finance_journal
WHEN NEW.id LIKE 'event:%' AND NOT EXISTS(SELECT 1 FROM bookings WHERE id=substr(NEW.id,7) AND member_id=NEW.member_id AND status='registered')
BEGIN SELECT RAISE(ABORT,'Booking changed before charging'); END;
CREATE TRIGGER finance_journal_no_update BEFORE UPDATE ON finance_journal BEGIN SELECT RAISE(ABORT,'Journal entries are immutable'); END;
CREATE TRIGGER finance_journal_no_delete BEFORE DELETE ON finance_journal BEGIN SELECT RAISE(ABORT,'Journal entries are immutable'); END;
CREATE TRIGGER finance_lock_balance_update BEFORE UPDATE ON member_balances
WHEN EXISTS(SELECT 1 FROM finance_accounts WHERE member_id=OLD.member_id)
BEGIN SELECT RAISE(ABORT,'Use reconciliation adjustments for this member'); END;
CREATE TABLE finance_claims (
 id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES finance_accounts(member_id),
 amount_pence INTEGER NOT NULL CHECK(amount_pence>0), paid_on TEXT NOT NULL, reference TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 resolution TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
