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

Use normal browser-based `wrangler login` when the authorised session has expired;
no API token should be requested or pasted. After login, read-only
configuration checks must confirm `BOOKING_SYNC_INCLUDE_DIETARY` is absent or
false.

The same password-manager secret must be entered privately for both the Pages Functions environment and the scheduled Worker as `BOOKING_SYNC_TOKEN`. The `/exec` URL must be configured for both runtimes as `BOOKING_SYNC_WEBHOOK_URL`. Wrangler must receive these values through masked/provider-owned input; they are never written to `.dev.vars`, shell history, helper files, logs, or reports.

After private configuration, production release still follows this order:

1. apply reviewed migration `0003_wp4_outputs.sql`;
2. deploy the scheduled Worker and unchanged validated Pages build;
3. run a signed adapter health/reconciliation request without creating a fabricated booking;
4. verify the historical leaderboard import and public Hall of Fame API;
5. verify the two existing accounts — one sole shared administrator and one ordinary member — and the production booking count are unchanged;
6. verify `Sync Log` records reconciliation of the preserved canonical bookings and no orphan/conflict alert, or stop for human review if it flags one.

## Operations ownership

Chetan is the primary operational owner and Priyesh is the recovery backup. The existing admin integration status and `Sync Log` record an alert when a delivery has failed at least three attempts or remains unresolved for fifteen minutes. No email or external alert channel is invented; a later configured channel needs separate approval.

## Completion note — 21 August 2026

This procedure was completed after Priyesh's explicit production approval. Apps
Script Version 2 is active, the required private property and Cloudflare secret
names were verified without reading their values, migrations `0001`–`0003` are
recorded, Worker and Pages are deployed, and signed delivery of both genuine
production bookings succeeded. A scheduled check exposed an earlier Worker
secret mismatch; after explicit approval the secret was rotated across Apps
Script, Pages and Worker, and the controlled replay completed with no failure or
alert. The Worker was then restored to its minute-7 hourly trigger. The
canonical production origin is
`https://jaguargolfsociety.siteproductions.co.uk/`; the provider Pages hostname
is retained as a public/read alias, not an authentication/write origin.
