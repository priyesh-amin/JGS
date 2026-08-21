# Secure booking operations

## Configuration required before external deployment

Do not run remote migration, Worker, Pages or Google deployment commands until
Priyesh explicitly approves the external decision pack. Then verify every item
below in Preview before Production:

1. Read back the intended Cloudflare account, Pages project, Worker and D1
   database. Reuse approved existing resources; create a missing resource only
   with separate owner authority.
2. Bind the approved D1 database to the Pages project as `DB` in both Preview
   and Production without copying its identifier into source control.
3. Set `APP_ORIGIN` to the exact HTTPS production origin.
4. Set a one-time, high-entropy `BOOTSTRAP_TOKEN`.
5. Confirm `MASTER_FIXTURES_CSV_URL` is the authorised fixture CSV.
6. Confirm `MEMBER_BALANCES_CSV_URL` is Chetan's authorised balance sheet
   and that `Sheet1!G1` contains the latest reconciliation date as a real
   date cell.
7. Supply `CancellationClosesAt` as strict `DD/MM/YYYY`, `YYYY-MM-DD`, or an exact timezone-bearing timestamp for every fixture where
   online cancellation is intended. WP1 does not infer a cancellation deadline.
8. Deploy `integrations/google-apps-script/BookingWebhook.gs` as a web app,
   configure its `SPREADSHEET_ID` and `BOOKING_SYNC_TOKEN` script properties,
   and supply the resulting `BOOKING_SYNC_WEBHOOK_URL` plus the same
   `BOOKING_SYNC_TOKEN` to Cloudflare Pages.
9. Supply the authorised initial administrator email and approved member
   roster. Create imported accounts disabled until committee verification.
10. Confirm exact September publication, registration, and cancellation
   timestamps in `Europe/London`.
11. Supply authorised HTTPS finance links for each applicable member.
12. Supply approved administrator-only Google Sheets document URLs through
   `FIXTURES_WORKBOOK_URL`, `LEADERBOARDS_WORKBOOK_URL`,
   `MEMBER_BALANCES_WORKBOOK_URL`, `BOOKING_MANAGEMENT_WORKBOOK_URL`, and
   `MEMBER_FINANCE_LINKS_WORKBOOK_URL`. Missing links remain unavailable.
13. Confirm `BOOKING_SYNC_INCLUDE_DIETARY` is absent or false. Dietary data is
   not approved for the operational spreadsheet output.

No production IDs, accounts, deadlines, or secrets belong in source control.

## Current production target

For the release approved on 21 August 2026, the canonical public and
authentication origin is
`https://jaguargolfsociety.siteproductions.co.uk/`. The attached provider Pages
hostname remains a public/read API alias and is not an accepted write origin.
Fresh configuration must continue to be downloaded and compared before any
future deployment; do not reconstruct provider identifiers from this document.

## Authoritative fixture automation

The `DB_Fixtures` tab remains the authoritative event-information source.
Cloudflare re-reads and validates its public CSV through two deterministic
paths that share the same per-fixture classifier and idempotent reconciliation:

- `jgs-fixture-sync` runs at minute 7 of every hour as a reconciliation check;
- the installable Google Apps Script edit trigger sends only an authenticated
  refresh notification immediately after an edit to `DB_Fixtures`. The Worker
  ignores notification content and re-fetches the approved canonical CSV.

After the external gate, deploy the Worker from the reviewed commit:

```powershell
npx wrangler deploy --config wrangler.fixture-sync.jsonc
npx wrangler secret put FIXTURE_SYNC_TOKEN --config wrangler.fixture-sync.jsonc
```

In the authoritative workbook, open **Extensions > Apps Script**, add
`integrations/google-apps-script/FixtureSyncTrigger.gs`, then set these Script
properties:

- `CLOUDFLARE_FIXTURE_SYNC_URL`: the deployed Worker URL ending `/sync`;
- `FIXTURE_SYNC_TOKEN`: the same high-entropy value stored as the encrypted
  Cloudflare Worker secret.

Run `installFixtureSyncTrigger` once and approve the requested permissions.
Then run `testFixtureSync` once and confirm a successful execution. The token
must be transferred privately and must never be committed or pasted into chat.

This automation imports only validated source values. It does not infer booking
windows from `Deadline` text. Before booking opens, the committee must keep
event statuses current and supply `RegistrationOpensAt`,
`RegistrationClosesAt`, and (where cancellation is intended)
`CancellationClosesAt` as strict UK `DD/MM/YYYY` (with leading zeroes), ISO
`YYYY-MM-DD`, or exact timezone-bearing timestamps. Date-only opening is
start-of-day and closing is end-of-day in Europe/London. US month-first,
single-digit slash, natural-language, missing or timezone-less ambiguous values
fail closed. The approved
12 fixture IDs are checked on every run so omitted rows are still reported.

## Local release check, migration and preview

From a clean checkout:

```powershell
npm ci
npm run check
python scripts/deploy_pages.py
```

The Python command is a local dry run: it builds a clean temporary copy and
proves Pages Functions and `/api/*` routing are present. It does not deploy.

After approval, export or back up the exact target D1 database, store the backup
outside the repository, and record its checksum plus the reviewed commit SHA.
Only then apply the reviewed migrations remotely. Migrations `0001` through
`0003` create the secure booking model, account-security audit state, Hall of
Fame snapshot, and leased booking-output fields. Verify the migration ledger and
table/column invariants immediately after applying them; do not print member
rows.

Deploy the branch to a Cloudflare Pages preview from the project root, not from
`dist/` alone, so the root `functions/` directory is uploaded. The reviewed
helper invocation is:

```powershell
python scripts/deploy_pages.py --deploy
```

Confirm the Preview `DB` binding and `APP_ORIGIN` match the preview origin.
Reject the preview if `/api/auth/session` or `/api/leaderboards` returns SPA
HTML instead of the expected API status and JSON content type.

## Empty-environment bootstrap only

Do not run bootstrap against an environment that already has the approved
shared operational administrator. On a confirmed empty isolated environment,
call `POST /api/setup/bootstrap` once with:

- header `X-Bootstrap-Token`;
- exact same-origin `Origin` header;
- JSON `displayName`, `email`, and a password of at least 11 characters.

The endpoint refuses to run after the first member exists. After successful
bootstrap, remove `BOOTSTRAP_TOKEN` and verify the approved account/role model.

## Production validation

1. Sign in as the approved administrator.
2. Synchronise fixtures and verify the recorded successful timestamp.
3. Configure the exact September windows; do not infer a default.
4. Create two disabled committee test members, verify identities, then enable.
5. Complete registration, refresh, duplicate-click, cancellation, deadline,
   attendee-list, and role-isolation checks.
6. Verify a booking update reaches the authorised spreadsheet once, with its
   idempotency key, and a cancellation updates the same operational row.
7. Temporarily reject the adapter request and confirm the website booking
   remains valid while the admin dashboard shows a retryable failure.
8. Inspect production browser console, Pages Function logs, D1 state, and
   spreadsheet output.
9. Enable member access only after the committee signs off the confirmed list.
10. Before Production, repeat the preview backup/migration/API/browser/log checks
    and require the explicit production approval flag. Deploying assets alone is
    not acceptance.

## Rollback

Application rollback is independent of data rollback:

1. Close the affected event or remove its registration window.
2. Redeploy the recorded pre-cutover commit.
3. Keep D1 intact for audit and reconciliation; do not drop booking tables.
4. Export the canonical attendee state for the committee.
5. Re-enable the unpublished legacy Google Form only as a controlled temporary
   fallback.
6. Reconcile any fallback entries before re-enabling website booking.

The schema can be removed only after an explicit export, retention decision,
and destructive-change approval.
