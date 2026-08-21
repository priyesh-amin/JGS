# WP4 Booking Outputs and Live Leaderboards — local evidence

## Scope implemented locally

- Reuse the existing private `JGS Booking Management` tabs `Bookings` and `Sync Log`; D1 remains canonical and delivery is one-way.
- Claim outbox work with expiring leases, conditional ownership updates, bounded retry, and hourly scheduled retry.
- Sign a canonical message with HMAC-SHA256; the shared secret is never included in the request body or reports.
- Allowlist booking/member/event fields and neutralise spreadsheet formula prefixes. Dietary data is omitted unless a later explicit provider setting is approved.
- Preserve booking sheet idempotency and monotonic version checks; make Sync Log entries idempotent by delivery key.
- Replace bundle-time leaderboard data with an hourly, validated, atomic D1 generation sourced from `DB_Leaderboards`; serve only category/year/winner/score through a public read-only endpoint.
- Preserve the last valid leaderboard generation if fetching or validation fails. Fixture, leaderboard, and booking-output scheduled work runs independently.

## Verification

- Independent architecture reviews were completed separately for booking output and leaderboards.
- The recovered candidate passed lint, all 79 automated tests, a clean Vite production build, and Cloudflare Pages Functions packaging on 2026-08-21.
- New tests cover signed secret-free envelopes, lease state, retryable adapter rejection, endpoint allowlisting, required leaderboard categories, duplicate source-row preservation, and atomic generation activation.
- Three migrations applied to an empty isolated local D1 database (19, 5 and 7 commands). The local API verifier passed 21 checks covering authentication boundaries, exact dietary choice, booking/cancellation, duplicate protection, administrator correction, operations/integration status and Hall of Fame JSON.
- The generated Pages routing manifest includes `/api/*`. Mobile member/admin browser journeys at 390 px passed with no horizontal overflow or console errors.
- `npm audit` reports zero known production or development vulnerabilities for the final lockfile.
- No production deployment or external Google/Cloudflare mutation was performed.

## Deferred release gates

1. Google owner authorization of the bound Apps Script and private secret setup, followed by isolated test-workbook acceptance.
2. Cloudflare owner entry of masked/provider-held configuration, remote D1 backup/migration, and Worker/Pages preview verification.
3. Committee confirmation of exact remaining fixture windows, capacity behaviour, and any non-empty `BookingFields` contract before booking can open.
4. Real administrator/member preview acceptance and explicit production approval.
5. A future current-points/rank product remains out of scope until a separate authoritative source and schema are approved; WP4 itself uses the verified historical Hall of Fame.

- Isolated Wrangler D1 migration 0003 applied successfully and the new leaderboard/lease schema was read back on 2026-07-29; the isolated database contained test-only records and no remote database was contacted.

## Approved operational decisions implemented locally

- Member name and email are included only in the designated booking workbook; dietary/preferences remain off.
- Hourly reconciliation never deletes rows. It repairs canonical rows and flags sheet-only or conflicting versions in `Sync Log`.
- Non-managed cells are preserved and a managed-column formula causes a visible conflict rather than an overwrite.
- Booking-output runs record owner semantics and a failed status after three attempts or fifteen unresolved minutes, surfaced through existing logs/admin integration status only.
- Historical Hall of Fame automation is WP4; current points/rank leaderboards are backlog.

## Final local release-candidate state (2026-08-21)

The exact clean local candidate passes lint, all 79 automated tests, the production build, Pages Functions packaging, isolated D1 migrations, the 21-check API verifier and the mobile browser journeys described above. Deployment tooling builds and validates a clean temporary copy and remains dry-run by default. No remote mutation occurred. At the external gate, the first read-only Cloudflare check must confirm the intended project/bindings and that `BOOKING_SYNC_INCLUDE_DIETARY` is absent or false before any WP4 secret, migration or deployment action.
