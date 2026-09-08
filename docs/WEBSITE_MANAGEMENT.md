# Website management handover

The website database owns events, bookings, preparation, guests, member balances, competition winners and the handicap/match-play tables after activation. Google authentication and password recovery are unchanged.

## Committee workflow

1. Open Admin → Events. Create or duplicate a draft. Enter details, booking deadlines and any additional questions. Publish when ready.
2. Members register and edit their own requirements while registration is open. Capacity counts member and guest places together. Committee additions can bypass deadlines, but cannot exceed capacity.
3. In the event workspace, open a player to edit requirements, cancel/reinstate, or set a group, tee time and handicap. Add guests separately. Save before exporting.
4. Print produces a confirmed club list without email addresses or committee notes. CSV includes cancellations and committee notes for internal administration. Buggy totals are requests, not a vehicle calculation.
5. Balances stores the reconciled amount, date and explanatory note. Positive is credit. The existing forecast only deducts bookings made after the reconciliation date. This is a balance register, not automated payment collection or a bank reconciliation system.
6. Results publishes competition winners. Match play edits the preserved handicap/singles/doubles values. These tables do not run spreadsheet formulas; verify allowances and progression before publishing.
7. Mark an event completed after it is finished. Use Members for routine account administration. Help includes a protected records export; History records committee changes.

## Existing data and switch

The additive migration retains existing tables and records. Activation refuses to proceed with undelivered booking messages. It imports exact-name matched balances and the three current competition tables, snapshots pre-switch records, changes event ownership and preserves the active leaderboard. Unmatched balances remain explicitly unrecorded.

Historical form responses can be imported into an event’s review queue. This never creates or cancels bookings automatically. Resolve identity/status conflicts with the member, update the website if appropriate and record the check. Repeated identical source imports are deduplicated. Do not infer dietary choices from missing answers.

The original Sheets remain historical references. Existing hourly sync writes are blocked by database triggers after activation; removing the old scheduled trigger is a one-time Cloudflare owner task (the deployment token lacks Workers schedule permission). It is not part of routine releases. Do not reopen old forms for current registrations.

## Technical recovery

Deploy through the existing GitHub Actions / Cloudflare Pages workflow. The authenticated activation action applies a fixed, additive schema through the existing application DB binding; it accepts no SQL input. No new hosting service or database is introduced.

Use Cloudflare D1 recovery for a database incident. `management_snapshots` retains the cutover snapshot; management/booking audits retain changes. The committee JSON export intentionally excludes passwords, sessions, reset tokens and provider credentials. Keep exports private. Restore requires a technical review; there is no unsafe one-click database overwrite.

Do not roll back to a pre-management application after activation: it assumes spreadsheet ownership. Fix forward, or deliberately restore both the pre-switch data and application in a reviewed recovery procedure.

## Remaining provider cleanup

The application is independent of spreadsheet reads after activation. The legacy `jgs-fixture-sync` cron is still configured because Cloudflare returned 403 / 10000 for schedule administration. Database ownership triggers block its writes. A Cloudflare owner should remove its cron trigger under Workers & Pages → jgs-fixture-sync → Settings → Triggers. The standalone `scripts/retire-legacy-schedule.mjs` performs the same bounded operation with an appropriately authorised token; never broaden the routine Pages token merely for this one-time cleanup.
