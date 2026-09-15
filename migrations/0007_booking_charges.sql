-- New live bookings charge activated accounts atomically with their booking audit.
-- Existing bookings are not backfilled from current event prices.
ALTER TABLE events ADD COLUMN payment_due_on TEXT;
ALTER TABLE events ADD COLUMN cancellation_charge_policy TEXT NOT NULL DEFAULT 'review'
 CHECK(cancellation_charge_policy IN ('review','release_before_cutoff'));

CREATE TABLE finance_booking_charges (
 journal_id TEXT PRIMARY KEY REFERENCES finance_journal(id),
 booking_id TEXT NOT NULL REFERENCES bookings(id),
 booking_version INTEGER NOT NULL,
 cancellation_charge_policy TEXT NOT NULL DEFAULT 'review',
 cancellation_closes_at TEXT,
 UNIQUE(booking_id,booking_version)
);
INSERT INTO finance_booking_charges
 SELECT j.id,b.id,b.version,'review',e.cancellation_closes_at FROM finance_journal j
 JOIN bookings b ON j.id='event:' || b.id JOIN events e ON e.id=b.event_id;

CREATE TABLE finance_booking_reviews (
 id TEXT PRIMARY KEY REFERENCES booking_audit(id),
 booking_id TEXT NOT NULL REFERENCES bookings(id),
 journal_id TEXT NOT NULL REFERENCES finance_journal(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 resolution TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, resolved_at TEXT, actor_id TEXT REFERENCES members(id)
);

-- An aggregate opening balance cannot identify the liability of an old booking.
CREATE TABLE finance_opening_bookings (
 booking_id TEXT PRIMARY KEY REFERENCES bookings(id),
 member_id TEXT NOT NULL REFERENCES finance_accounts(member_id),
 disposition TEXT NOT NULL DEFAULT 'review' CHECK(disposition IN ('review','included','excluded')),
 note TEXT NOT NULL DEFAULT '',actor_id TEXT REFERENCES members(id),reviewed_at TEXT
);
INSERT INTO finance_opening_bookings(booking_id,member_id)
 SELECT b.id,b.member_id FROM bookings b JOIN finance_accounts a ON a.member_id=b.member_id
 WHERE NOT EXISTS(SELECT 1 FROM finance_booking_charges c WHERE c.booking_id=b.id);
CREATE TRIGGER finance_capture_opening_bookings AFTER INSERT ON finance_accounts
 BEGIN INSERT INTO finance_opening_bookings(booking_id,member_id)
 SELECT id,member_id FROM bookings WHERE member_id=NEW.member_id; END;

-- Values with an unknown fee must never be coerced into a free booking.
CREATE VIEW finance_event_prices AS
 SELECT id,CASE WHEN fee<>'' AND fee NOT GLOB '*[^0-9.]*'
   AND fee GLOB '[0-9]*' AND length(fee)-length(replace(fee,'.',''))<=1
   AND (instr(fee,'.')=0 OR length(substr(fee,instr(fee,'.')+1)) BETWEEN 1 AND 2)
   AND CAST(fee AS REAL)<=1000000
 THEN CAST(fee AS INTEGER)*100 + CASE WHEN instr(fee,'.')=0 THEN 0
   ELSE CAST(substr(substr(fee,instr(fee,'.')+1)||'00',1,2) AS INTEGER) END
 ELSE NULL END AS amount_pence
 FROM (SELECT id,trim(replace(replace(cost,'£',''),',','')) AS fee FROM events);

CREATE TRIGGER finance_manual_booking_link AFTER INSERT ON finance_journal
 WHEN NEW.id LIKE 'event:%'
 BEGIN
 INSERT INTO finance_booking_charges SELECT NEW.id,b.id,b.version,e.cancellation_charge_policy,e.cancellation_closes_at
 FROM bookings b JOIN events e ON e.id=b.event_id WHERE NEW.id='event:'||b.id;
 END;

CREATE TRIGGER finance_no_duplicate_booking_charge BEFORE INSERT ON finance_journal
 WHEN NEW.id LIKE 'event:%' AND (EXISTS(
 SELECT 1 FROM finance_booking_charges c JOIN finance_journal j ON j.id=c.journal_id
 WHERE c.booking_id=substr(NEW.id,7)
 AND NOT EXISTS(SELECT 1 FROM finance_journal r WHERE r.reverses_id=j.id))
 OR EXISTS(SELECT 1 FROM finance_opening_bookings o WHERE o.booking_id=substr(NEW.id,7) AND o.disposition='included'))
 BEGIN SELECT RAISE(ABORT,'finance_duplicate_booking_charge'); END;

CREATE TRIGGER finance_booking_registered AFTER INSERT ON booking_audit
 WHEN NEW.action IN ('registered','admin_corrected') AND NEW.id NOT LIKE 'legacy:%'
 AND COALESCE(json_extract(NEW.before_json,'$.status'),'')<>'registered'
 AND EXISTS(SELECT 1 FROM bookings b JOIN finance_accounts a ON a.member_id=b.member_id
   WHERE b.id=NEW.booking_id AND b.status='registered')
 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM finance_opening_bookings o WHERE o.booking_id=NEW.booking_id
   AND o.disposition='review' AND NOT EXISTS(SELECT 1 FROM finance_booking_charges c WHERE c.booking_id=o.booking_id))
   THEN RAISE(ABORT,'finance_historical_booking_review') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b JOIN finance_accounts a ON a.member_id=b.member_id
   WHERE b.id=NEW.booking_id AND COALESCE(json_extract(NEW.after_json,'$.financeDate'),substr(NEW.created_at,1,10))<=a.opening_on)
   THEN RAISE(ABORT,'finance_booking_cutoff') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b JOIN finance_event_prices p ON p.id=b.event_id
   WHERE b.id=NEW.booking_id AND p.amount_pence IS NULL)
   THEN RAISE(ABORT,'finance_booking_fee_missing') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=NEW.booking_id
   AND (date(COALESCE(e.payment_due_on,e.event_date)) IS NULL
   OR date(COALESCE(e.payment_due_on,e.event_date),'+0 days')<>COALESCE(e.payment_due_on,e.event_date)))
   THEN RAISE(ABORT,'finance_booking_due_invalid') END;

 INSERT INTO finance_journal
 (id,member_id,kind,amount_pence,posted_on,due_on,event_code,category,note,created_at,actor_id)
 SELECT 'booking-charge:'||NEW.id,b.member_id,'charge',-p.amount_pence,
   COALESCE(json_extract(NEW.after_json,'$.financeDate'),substr(NEW.created_at,1,10)),
   COALESCE(e.payment_due_on,e.event_date),e.id,'Golf',e.title||' — booking charge',NEW.created_at,NEW.actor_member_id
 FROM bookings b JOIN events e ON e.id=b.event_id JOIN finance_event_prices p ON p.id=e.id
 WHERE b.id=NEW.booking_id AND p.amount_pence>0
 AND NOT EXISTS(SELECT 1 FROM finance_opening_bookings o WHERE o.booking_id=b.id AND o.disposition='included')
 AND NOT EXISTS(SELECT 1 FROM finance_booking_charges c JOIN finance_journal j ON j.id=c.journal_id
   WHERE c.booking_id=b.id AND NOT EXISTS(SELECT 1 FROM finance_journal r WHERE r.reverses_id=j.id));
 INSERT INTO finance_booking_charges
 SELECT j.id,b.id,b.version,e.cancellation_charge_policy,e.cancellation_closes_at FROM finance_journal j
 JOIN bookings b ON b.id=NEW.booking_id JOIN events e ON e.id=b.event_id
 WHERE j.id='booking-charge:'||NEW.id;
 UPDATE finance_booking_reviews SET status='resolved',resolution='rebooked',
   resolved_at=NEW.created_at,actor_id=NEW.actor_member_id
 WHERE booking_id=NEW.booking_id AND status='pending';
 UPDATE finance_state SET revision=revision+1 WHERE id=1;
 INSERT INTO management_audit(id,actor_id,entity_type,entity_id,action,after_json,created_at)
 VALUES('finance:'||NEW.id,NEW.actor_member_id,'reconciliation',NEW.booking_id,'booking_charge_checked',NEW.after_json,NEW.created_at);
 END;

CREATE TRIGGER finance_booking_cancelled AFTER INSERT ON booking_audit
 WHEN NEW.action IN ('cancelled','admin_corrected')
 AND json_extract(NEW.before_json,'$.status')='registered'
 AND EXISTS(SELECT 1 FROM bookings b JOIN finance_accounts a ON a.member_id=b.member_id
   WHERE b.id=NEW.booking_id AND b.status='cancelled')
 BEGIN
 -- Cancellation permission alone does not prove a fee is refundable.
 INSERT INTO finance_booking_reviews(id,booking_id,journal_id,created_at)
 SELECT NEW.id,b.id,j.id,NEW.created_at FROM bookings b
 JOIN events e ON e.id=b.event_id JOIN finance_booking_charges c ON c.booking_id=b.id
 JOIN finance_journal j ON j.id=c.journal_id
 WHERE b.id=NEW.booking_id AND NOT EXISTS(SELECT 1 FROM finance_journal r WHERE r.reverses_id=j.id)
 AND NOT(c.cancellation_charge_policy='release_before_cutoff'
   AND c.cancellation_closes_at IS NOT NULL AND NEW.created_at<c.cancellation_closes_at);
 INSERT INTO finance_journal
 (id,member_id,kind,amount_pence,posted_on,due_on,event_code,category,note,reverses_id,created_at,actor_id)
 SELECT 'booking-release:'||NEW.id,j.member_id,'reversal',-j.amount_pence,
   COALESCE(json_extract(NEW.after_json,'$.financeDate'),substr(NEW.created_at,1,10)),
   COALESCE(json_extract(NEW.after_json,'$.financeDate'),substr(NEW.created_at,1,10)),
   j.event_code,j.category,'Booking cancelled before cutoff — charge released',j.id,NEW.created_at,NEW.actor_member_id
 FROM bookings b JOIN events e ON e.id=b.event_id
 JOIN finance_booking_charges c ON c.booking_id=b.id JOIN finance_journal j ON j.id=c.journal_id
 WHERE b.id=NEW.booking_id AND NOT EXISTS(SELECT 1 FROM finance_journal r WHERE r.reverses_id=j.id)
 AND c.cancellation_charge_policy='release_before_cutoff'
 AND c.cancellation_closes_at IS NOT NULL AND NEW.created_at<c.cancellation_closes_at;
 UPDATE finance_state SET revision=revision+1 WHERE id=1;
 INSERT INTO management_audit(id,actor_id,entity_type,entity_id,action,after_json,created_at)
 VALUES('finance:'||NEW.id,NEW.actor_member_id,'reconciliation',NEW.booking_id,'booking_cancellation_checked',NEW.after_json,NEW.created_at);
 END;
