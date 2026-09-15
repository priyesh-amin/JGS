# Reconciliation implementation and activation plan

Updated 15 September 2026. Branch: `feat/bank-reconciliation`.

## Status and evidence

The branch implements bank import/review, a persisted member journal and private statements, extending foundation commit `202fa19`. Automatic booking charges, migration `0007`, event configuration and the member/admin screens are implemented and pass local integration tests. Cloudflare staging and browser validation remain required before financial cutover. No production migration, real transaction posting, account activation or deployment was performed.

The implementation follows the approved reconciliation requirements: memo-based payer identification, controlled member selection and named event/category fields. Private supporting evidence is maintained outside this public repository.

## Supported bank export contract

The original CSV or single-sheet XLSX must provide these six columns:

| Column | Header | Treatment |
| --- | --- | --- |
| A | Number | Preserve; not a unique transaction ID |
| B | Date | Convert native Excel dates to calendar dates |
| C | Account | Preserve privately; one bank account per workspace |
| D | Amount | Signed GBP, validated and stored as integer pence |
| E | Subcategory | Preserve bank classification |
| F | Memo | Administrator review only; never publish raw memos in member statements |

The Number column is not a reliable unique identifier. Candidate fingerprints require overlapping-export validation. A transaction list does not establish opening balances or complete bank-period coverage.

The XLSX reader has been validated against the supported export format. Real bank data stays outside Git. Regression fixtures are invented.

## Chetan's routine

1. Sign in as an administrator. Open **Admin → Reconciliation** in website management mode.
2. Upload the original six-column CSV or single-sheet XLSX. Enter the period requested from the bank, including days with no movements.
3. Preview counts, money in/out and duplicate warnings. Confirm import into the review queue. This changes no member balances.
4. Read the memo and choose a member. Full-name matches are suggestions; surname-only and ambiguous matches are not auto-assigned.
5. Confirm up to 20 simple assignments together. For complex receipts, split the whole amount across members or event/category portions, adding a member-visible description and a separate committee note.
6. Classify outgoings as confirmed member refunds or non-member movements. Mark duplicates only after resolving their matching original. Similar rows may be confirmed as distinct movements.
7. Use **Historical event charge catch-up** only for historical bookings missing a charge: select event, fee, posting date and due date, then review and post up to 30 at once. Preview and posting exclude bookings already charged automatically or manually. Confirm the charges are not in opening balances. Guests and different tariffs currently need individual charges.
8. Review **Cancellation charges to review**. Check the member, event, amount and cancellation date, record a committee-only reason, then retain or release the charge. Release reverses the account charge; it does not send a cash refund.
9. Check members' payment reports against bank evidence. Resolving a report does not itself credit money. Review accounts and movement control totals; export who owes what.
10. Correct a bank assignment under **Correct a reviewed bank transaction**. Previous member entries are reversed and replacement treatment is saved atomically. Charges/credits also support linked reversals.

Chetan adds assignment and classification without retyping running balances. Downloading and importing bank data remains a recurring manual task; there is no live bank feed.

## Member journey

An activated member signs in normally and sees due now, upcoming unpaid charges and available credit. They can expand charge/payment history, see bank-data coverage and unresolved-payment warnings, and report a payment for review. Reporting payment does not clear debt. Cancellation reviews show the event, creation date and pending/resolved outcome without committee notes. A pending review does not clear the charge. Their endpoint never returns another member's statement or raw bank memos. No ChatGPT or MCP session is required.

Inactive accounts retain legacy balances. Activated accounts use the journal through the compatibility endpoint too, avoiding a second deduction for bookings. The legacy editor rejects balance replacement for activated members.

## Automatic booking charge rules (migration 0007)

- Member and administrator registration POSTs send the loaded event version as `expectedEventUpdatedAt`. A changed event returns 409 `event_changed` rather than charging unseen terms; standalone preference PATCHes do not send this guard.
- Event configuration adds nullable `events.payment_due_on`: blank means the event date. `events.cancellation_charge_policy` defaults to `review`; its only alternative is `release_before_cutoff`. The administrator event editor explains both settings. Members with activated ledger accounts see the configured due date and cancellation policy beside the event cost before confirming when `bookingChargesEnabled` is true. Duplicating an event clears the old payment date.
- `saveEvent` checks each column with `PRAGMA table_info(events)`. It validates and persists only available configuration fields, using the existing event write and audit batch. On legacy schemas, blank due dates and the default review policy are omitted from writes and audit values, so ordinary event creation and editing still work. An explicit nonblank due date or nondefault policy whose column is unavailable rejects the entire save with “Automatic booking charges are not enabled yet; payment settings were not saved.” No schema migration runs from this save path.
- With the booking-charge backend installed, live registration for an activated finance account after its opening cutoff records the event fee and snapshots the configured due date, falling back to the event date. Event save normalizes accepted fees (including formatted input) to decimal pounds and caps them at £1,000,000. Numeric cost 0 is preserved and creates no charge. A missing or invalid fee rejects booking for activated accounts.
- Editing booking preferences at the same price does not charge again. Charges also snapshot the cancellation policy and deadline in `finance_booking_charges`. Event edits apply to future charges only; existing charges retain their fee, due date and cancellation terms.
- Historical bookings are not automatically backfilled. Existing manual event charges are linked to their bookings and migrated with the default review policy, without retrospectively assuming free cancellation, so automatic charging and historical catch-up must not duplicate them. Review historical liabilities against opening balances before posting.
- Default cancellation policy retains the charge and creates a review. Opting into `release_before_cutoff` reverses the charge only before the charge’s snapshotted cancellation deadline. Late administrator cancellation still requires review. No cancellation or review action automatically sends a cash refund.
- Rebooking reuses a retained charge; if the previous charge was reversed, it creates a new one.
- Administrator dashboard `bookingReviews` contains `id` (booking audit ID), `member_name`, `event_title`, `amount_pence` and `created_at`. The UI submits `save('booking-review', {id, resolution: 'retain' | 'release', note})` through the existing revision-guarded save flow.
- Dashboard, member statement and compatibility balance responses include `bookingChargesEnabled`. Automatic-charge promises require this flag; false or absent shows setup needed for ledger accounts. Inactive accounts retain legacy booking treatment. Administrator cancellation reviews are pending only.
- Member statement `bookingReviews` exposes only `event_title`, `created_at`, `status` (`pending` or `resolved`) and `resolution`. The UI renders fixed outcome labels and never displays the administrator reason. Both review lists tolerate the array being absent on older backends.

## Implemented controls and policy

- Positive opening amount means credit; negative means debt. Opening activation requires a cutoff, amount, reason and explicit confirmation. Bank receipts on/before the member's cutoff cannot be added again.
- Only confirmed journal entries affect accounts. Unidentified money remains pending. Member portions must equal the entire receipt or refund.
- Current policy: unrestricted credit covers oldest due charges and then later charges. Event/category labels do not reserve money. Allocations are deterministic calculations, not persisted charge-specific instructions.
- Manual charges require explicit posting/due dates; automatic booking charges snapshot their dates from the booking/event configuration. Negative bank evidence confirms refunds; credit adjustments are not presented as cash refunds.
- Reordered identical transaction sets share an import identity. Candidate fingerprints use all six normalised source fields. Overlapping identical-looking rows require review. Changed source text can evade a fingerprint match; comparison with bank evidence remains necessary.
- Atomic batches protect posting, splits, corrections and write audit. Revision guards reject stale edits. Snapshot checks reject finance data changed during dashboard/preview/statement reads. Journal rows cannot be updated or deleted.
- Coverage extends from the opening cutoff only across contiguous administrator-declared periods. A new upload cannot hide gaps. Coverage is not a verified reconciliation cutoff.
- Authentication, server-side administrator checks, same-origin writes and session-derived member identity protect routes.
- Control totals show count/inflows/outflows for pending, posted, non-member and duplicate rows. Duplicate totals are separate; they must not be counted as bank movements.
- Protected JSON backup includes imports, original bank cells, journal, claims and finance audit. It is not an automated restore service.

## Critical comparison with the proposed requirements

This branch does not claim to complete every earlier P0 requirement.

| Requirement | Delivered | Remaining before relevant cutover |
| --- | --- | --- |
| FR01–03: privacy, identity, journal | Private statements, stable member selection, append-only entries and legacy lock | Staging verification with actual roles |
| FR04–05: charge lifecycle | Automatic live booking fee/due-date snapshots, cancellation policy/reviews and historical catch-up under migration 0007 | Validate lifecycle integration; tariff versions, substitutions and historical liability migration remain |
| FR06–07: imports and duplicates | Bank adapter, preserved cells, validation, replay prevention and collision review | Overlapping-export validation; import hash covers normalised content, not original XLSX bytes |
| FR08: permanent payment reference | Member can report the reference used; memo-based review | Issuing/displaying new permanent member references is not included |
| FR09: allocations | Splits, part-payments, overpayments and oldest-charge allocation | Earmarked/reserved credit and persisted explicit allocations are not implemented; approve unrestricted policy or extend |
| FR10, FR13: exceptions/claims | Pending payment queue, cancellation charge reviews and separate payment reports | Named exception owner, next actions and line-level dispute workflow remain; no automated chasing added |
| FR11: corrections/refunds | Linked reversals, bank reassignment and bank-confirmed refunds | Validate configured cancellation rules with committee; linked partial charge credits remain |
| FR12: freshness | Coverage, import timestamp and pending warning | Verified reconciliation cutoff and service target require an operational close process |
| FR14–15: reporting/audit | Who-owes-what, history, bank control totals and write audit | Per-event settlement reports, export-access audit and policy-change audit remain |
| FR16: guests | Individual charges to a responsible member | Structured guest-liability/charge linkage is not implemented |
| FR17: bank controls | Every row pending or classified, with movement totals | Opening/closing bank balance proof and period-close review remain external |
| FR18: opening migration | Per-member reviewed opening and cutoff protection | Aggregate comparison, itemised existing due dates and migration approval; negative opening figures are immediately due |
| FR19: usability | Responsive forms for import/review/statements | Actual phone/desktop browser acceptance remains |
| FR20–21: notifications/cash | Neither enabled | Notifications later; if cash is accepted, custody/deposit matching is a cutover prerequisite |

## Activation sequence

1. Review the branch and resolve policy gaps for the first cohort. Obtain Chetan's master-sheet example/formulas and overlapping exports. Confirm GBP/account identity, earmarked credit and cash treatment.
2. Apply repository migrations through the booking-charge migration `0007` (after `0006_reconciliation.sql`) to an isolated staging D1 database using an approved staging Wrangler configuration. Do not migrate production during review. The application detects a missing finance schema and falls back to legacy balances; it does not auto-migrate finance tables.
3. Run `npm ci` and `npm run check`. Exercise file selection, preview, assignment, correction, stale edits, automatic registration charges, free/missing fees, cancellation policies, retain/release reviews, rebooking, historical catch-up and statements with separate admin/member sessions on phone and desktop. Demonstrate restoring backup into a separate test database.
4. Shadow-reconcile one complete bank period against Chetan's master: every movement, member, credit/debt total, existing charge and guest liability. Resolve differences.
5. Approve the opening cutoff and member opening detail. Do not count opening totals and the same historical transactions twice. A flat opening cannot preserve future due dates; migrate those separately or agree a suitable cutoff.
6. After financial acceptance and separate release authorisation, back up production, apply the reviewed migration, deploy and activate only reconciled accounts. Record who imports/reviews bank data and how often.

The application workflow deploys pushes to `main`; this work stays on a feature branch. Code deployment, schema migration and account activation are separate operations.

## Verification

Final local verification: `npm run check` passed all 153 tests, release policy, lint, frontend build and Pages Functions compilation. New tests cover automatic booking-to-bank-payment settlement, unchanged historical invoices during migration, fee/due-date/cancellation-term snapshots, cancellation review and release, rebooking, free/unknown fees, opening cutoffs, stale event prices, atomic rollback and member privacy. Two subagents contributed the interface/configuration updates and independent lifecycle tests; their changes were integrated and checked together.

Release review corrections: opening cutoffs must be completed prior London days, preventing same-day account activation from blocking all bookings. Existing bookings are captured separately at account activation. Rebooking a historical booking without a linked charge is blocked until Chetan records whether it is already covered by the opening balance. An included booking cannot generate a second automatic or catch-up charge; an excluded booking is charged on rebooking. Historical cancellation credits still require a reviewed manual adjustment because the aggregate opening balance contains no individual charge to reverse. Both reported release blockers now have passing regression tests.

`npm run check` covers release policy, lint, Node tests, frontend build and Pages Functions compilation. Finance tests apply every migration to local SQLite and exercise real API session/role checks, import replay, split conservation, overpayment, refund, corrected payer, opening cutoffs, stale writes, atomic batches, claims, privacy and explicit event charging. XLSX tests cover shared strings, dates, blanks and rejection of formulas/extra columns/unsupported formats.

For the UI/configuration changes, targeted ESLint and `git diff --check` passed. An in-memory SQLite check passed create/update, defaults, preservation, invalid date/policy rejection, fee normalization/cap, zero fee, unsupported-setting rejection and default-field audit omission across four schemas: neither new column, either column individually, and both columns. These are separate from the full integration suite. No deployment or browser acceptance is claimed. Validate event create/update both with and without migration 0007, including blank due dates and invalid policies, and check the member endpoint excludes committee notes.

These checks and actual-file parsing do not substitute for Cloudflare staging, browser acceptance, verified opening balances or full bank reconciliation.
