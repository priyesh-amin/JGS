# Member authentication and roster operations

## Approved model

`Players_Specific_URLs` / `Sheet1` is the authorised source for the current
member names and email allowlist. Only `Member` and `E-mail` are used for
account provisioning. `Type` and `Finance Sheet ID` are not copied into the
authentication database. D1 remains canonical for accounts, login methods,
sessions and bookings; no password or reset token is stored in Google Sheets.

The approved rollout contains 56 unique roster email accounts in addition to
the preserved existing ordinary-member account and fixed `admin` username.
Roster imports set `account_source = 'players_sheet'`, activate the member and
leave password login disabled. The stored placeholder password is random and
unusable. A member can then:

1. sign in directly with an allowlisted Gmail/Googlemail or Google Workspace
   account, which binds Google's immutable `sub` identifier on first use; or
2. request a one-time 60-minute email link, choose a password, sign in, and
   optionally link a matching Google Account from Account security.

Google is not treated as authoritative for a third-party mailbox merely
because someone created a Google Account using that address. Such a member
must prove access to the listed mailbox through the reset email before Google
can be linked. Disabled or unlisted accounts fail closed.

## Google configuration

Create one OAuth 2.0 client of type **Web application**. Configure the exact
authorised JavaScript origin:

`https://jaguargolfsociety.siteproductions.co.uk`

No redirect URI is needed for the JavaScript callback flow. Store the public
client ID as the production Pages variable `GOOGLE_CLIENT_ID`; never store a
client secret because this integration does not use one. The server verifies
the Google signature and `alg`, `aud`, `iss`, `exp`, `iat`, nonce,
`email_verified` and `sub` claims before looking up a member.

The provider Pages hostname is deliberately not enabled for authentication.
Preview testing needs its own explicitly authorised origin and matching
preview `APP_ORIGIN`; do not weaken the canonical-origin check.

## Password-reset delivery

The existing signed Apps Script adapter also handles the purpose-bound
`password_reset` envelope. Deploy the reviewed
`integrations/google-apps-script/BookingWebhook.gs` as a new immutable version
and approve its `MailApp.sendEmail` permission. It continues to use the
provider-held `BOOKING_SYNC_TOKEN`; the secret is never transmitted in a
request. Reset messages are not written to `Bookings`, `Sync Log` or any other
sheet.

The public request response is deliberately identical for known, unknown and
malformed addresses. D1 stores only a SHA-256 token hash. Links use a URL
fragment so the raw token is not sent in the initial HTTP request or referrer.
Successful reset consumption is single-use, enables password login and revokes
all existing sessions. Requests are throttled by email/IP and by per-member
delivery cooldown.

## Safe roster import and verification

1. Re-read spreadsheet metadata, then the bounded `Sheet1!A1:D963` range.
2. Require exactly 56 nonblank names, 56 valid unique normalised emails and no
   duplicate with an existing D1 email.
3. Export D1 outside the repository and record its checksum.
4. Apply migration `0004` and verify existing account counts are unchanged.
5. Activate Google and password-reset delivery and pass one real-member test
   before importing the roster.
6. Insert all 56 records without finance URLs, with unique random disabled
   password records and `account_source = 'players_sheet'`.
7. Verify aggregate counts, duplicate-email count, password completeness,
   disabled placeholder-password state and zero unexpected administrator roles.
8. Test Google login with an allowlisted Google-hosted identity and reset-email
   login with one authorised non-Google-hosted test identity. Do not print the
   roster, raw reset tokens, passwords or provider identifiers in logs.

If activation fails, do not import the roster. The additive schema may remain
in place while the previous application release continues to serve the two
preserved accounts.
