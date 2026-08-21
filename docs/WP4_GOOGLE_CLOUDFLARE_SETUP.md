# WP4 one-time Google and Cloudflare setup

This procedure is performed only after the local release candidate is approved for production. It does not open bookings or create member data.

## What the integration does

`JGS Booking Management` is a private operational projection. D1 remains the booking source of truth. The adapter writes only to the existing `Bookings` and `Sync Log` tabs, never deletes rows, preserves non-managed cells, and flags orphaned, conflicting, or formula-collision rows for human review.

The exported operational fields are booking identity/status/timestamps, event details, buggy requirement, member name, and member email. Dietary requirements and arbitrary preferences remain disabled.

## Unavoidable Google owner steps

1. Open the existing `JGS Booking Management` workbook using the committee Google account that owns or operates it.
2. Open **Extensions → Apps Script**. This must be a script bound to this workbook, not the fixture workbook.
3. Put the reviewed local file `integrations/google-apps-script/BookingWebhook.gs` into `Code.gs`. If `Code.gs` still contains only Google’s untouched default `myFunction`, replace it wholesale. If it contains committee code, stop for review rather than overwriting it.
4. In Apps Script **Project Settings → Script properties**, add:
   - `SPREADSHEET_ID`: the ID of this same booking workbook;
   - `BOOKING_SYNC_TOKEN`: one new high-entropy password-manager value.
5. Never paste either value into chat, project files, or screenshots.
6. Choose **Deploy → New deployment → Web app**. Execute as the deploying committee account. Set access to **Anyone**; unauthenticated requests still cannot pass the HMAC check and the GET response contains no member data.
7. Approve Google’s one-time authorization and finish deployment.
8. Copy the final URL ending in `/exec` into the later masked/private setup prompt. Do not post it in chat.

## Private Cloudflare step

The previously authorised Wrangler session was found expired during the final read-only preflight. The user must first complete normal browser-based `wrangler login`; no API token should be requested or pasted. Immediately after login, read-only configuration checks must confirm `BOOKING_SYNC_INCLUDE_DIETARY` is absent or false.

The same password-manager secret must be entered privately for both the Pages Functions environment and the scheduled Worker as `BOOKING_SYNC_TOKEN`. The `/exec` URL must be configured for both runtimes as `BOOKING_SYNC_WEBHOOK_URL`. Wrangler must receive these values through masked/provider-owned input; they are never written to `.dev.vars`, shell history, helper files, logs, or reports.

After private configuration, production release still follows this order:

1. apply reviewed migration `0003_wp4_outputs.sql`;
2. deploy the scheduled Worker and unchanged validated Pages build;
3. run a signed adapter health/reconciliation request with zero fabricated bookings;
4. verify the historical leaderboard import and public Hall of Fame API;
5. verify the two administrator accounts and production booking count are unchanged;
6. verify `Sync Log` records the zero-booking reconciliation and no orphan/conflict alert, or stop for human review if it flags one.

## Operations ownership

Chetan is the primary operational owner and Priyesh is the recovery backup. The existing admin integration status and `Sync Log` record an alert when a delivery has failed at least three attempts or remains unresolved for fifteen minutes. No email or external alert channel is invented; a later configured channel needs separate approval.
