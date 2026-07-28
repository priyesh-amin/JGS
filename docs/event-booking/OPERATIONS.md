# Secure booking operations

## Configuration required before production

Do not publish the secure booking routes until every item below is supplied and
validated:

1. Create a Cloudflare D1 database named `jgs-secure-booking` and obtain its
   real database ID.
2. Bind that database to the existing Pages project `jaguargolfsociety` as
   `DB` in both Preview and Production.
3. Set `APP_ORIGIN` to the exact HTTPS production origin.
4. Set a one-time, high-entropy `BOOTSTRAP_TOKEN`.
5. Confirm `MASTER_FIXTURES_CSV_URL` is the authorised fixture CSV.
6. Confirm `DEFAULT_CANCELLATION_CUTOFF_DAYS` (seven by default). This fallback
   applies only where neither the spreadsheet nor an administrator has set an
   event-specific cancellation timestamp.
7. Deploy `integrations/google-apps-script/BookingWebhook.gs` as a web app,
   configure its `SPREADSHEET_ID` and `BOOKING_SYNC_TOKEN` script properties,
   and supply the resulting `BOOKING_SYNC_WEBHOOK_URL` plus the same
   `BOOKING_SYNC_TOKEN` to Cloudflare Pages.
8. Supply the authorised initial administrator email and approved member
   roster. Create imported accounts disabled until committee verification.
9. Confirm exact September publication, registration, and cancellation
   timestamps in `Europe/London`.
10. Supply authorised HTTPS finance links for each applicable member.

No production IDs, accounts, deadlines, or secrets belong in source control.

## Migration and preview

From a clean checkout:

```powershell
npm ci
npm run check
npx wrangler d1 migrations apply jgs-secure-booking --remote
```

Before applying the migration, export or back up the target D1 database and
record the deployed commit SHA. The migration is additive: it creates only the
new booking tables. It does not modify legacy website content.

Deploy the branch to a Cloudflare Pages preview using the existing
`jaguargolfsociety` project. Confirm the Preview `DB` binding and preview
`APP_ORIGIN` match the preview URL before exercising mutations.

## First administrator

Call `POST /api/setup/bootstrap` once with:

- header `X-Bootstrap-Token`;
- exact same-origin `Origin` header;
- JSON `displayName`, `email`, and a password of at least 12 characters.

The endpoint refuses to run after the first member exists. After successful
bootstrap, rotate or remove `BOOTSTRAP_TOKEN`.

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
