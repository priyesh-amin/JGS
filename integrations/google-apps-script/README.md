# JGS booking Google Sheet adapter

This bound Google Apps Script turns the private `JGS Booking Management`
spreadsheet into the idempotent operational projection used by the website.

## Script properties

Configure these in **Project Settings > Script properties**:

- `SPREADSHEET_ID`: the native Google Sheet ID.
- `BOOKING_SYNC_TOKEN`: a high-entropy secret that exactly matches the
  Cloudflare Pages `BOOKING_SYNC_TOKEN` secret.

Do not commit either production value.

## Deployment

1. Open the private booking spreadsheet.
2. Select **Extensions > Apps Script**.
3. Replace the default code with `BookingWebhook.gs`.
4. Update the manifest from `appsscript.json`.
5. Add the two script properties.
6. Deploy a **Web app** that executes as the deploying committee account.
7. Permit access to **Anyone**. The endpoint contains no member data and every
   POST is rejected unless the JSON-body token matches.
8. Store the resulting `/exec` URL as the Cloudflare Pages secret
   `BOOKING_SYNC_WEBHOOK_URL`.

The adapter returns `{ "ok": true }` only after the booking row and sync log
have been written. Application-level errors deliberately return
`{ "ok": false, "error": "..." }`; the Cloudflare outbox treats that response
as failed and retries without invalidating the member's canonical D1 booking.

## Data behaviour

- One operational row is maintained for each `event_id + member_id`.
- Duplicate idempotency keys are acknowledged without adding rows.
- Older booking versions are acknowledged as stale and cannot overwrite newer
  state.
- Cancellation updates the same row to `Cancelled`.
- `LockService` serialises concurrent spreadsheet updates.
- Every request appends a success or failure record to `Sync Log`.
