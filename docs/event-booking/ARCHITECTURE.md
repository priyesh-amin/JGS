# Architecture assessment

## Verified facts

- The application is a React 19/Vite single-page application hosted on
  Cloudflare Pages with Pages Functions under `functions/`.
- There is no `.openai/hosting.json`, D1 binding, server-side account store,
  lockfile, or automated test command in the baseline.
- Baseline production build succeeds with an unresolved `/images/hero-bg.jpg`
  warning.
- Baseline lint has nine errors and one warning.
- Existing authentication compares shared credential hashes in browser code and
  stores a role in `sessionStorage`.
- Fixtures and leaderboards are generated from public Google Sheet CSV exports.
- Existing attendee details are compiled into browser-delivered JSON.
- The balance area fetches a public spreadsheet directly in the browser.
- The sync trigger is not protected by a trusted administrator boundary.
- The Cloudflare Pages project is available, but the current API token cannot
  list or create D1 databases. Production currently exposes only `GH_PAT`.

## Assumptions

- `Europe/London` is the default event timezone.
- Membership is invitation-only and administered by the committee.
- `DB_Fixtures` remains the event-information source.
- D1 is the canonical source for identity, booking state, audit history, and
  integration delivery state.
- The committee booking spreadsheet will accept idempotent webhook updates, or
  an equivalent adapter will be supplied using the documented contract.

## External blockers

- A production D1 database ID and `DB` binding, or authority to create them.
- Authorised active-member records and the initial administrator identity.
- Exact September registration and cancellation timestamps.
- A booking-output webhook URL/token and confirmed spreadsheet field mapping.
- Authorised per-member finance links or identifiers.

These block a production-readiness claim but do not block implementation and
verification with local data and mocks.

## Target data flow

```text
Member/admin React UI
        |
        | same-origin JSON, HttpOnly session
        v
Cloudflare Pages Functions
        |
        | prepared statements and server-side policy
        v
Cloudflare D1
  - members and roles
  - sessions
  - events and configured windows
  - canonical bookings
  - booking audit
  - sync runs
  - integration outbox
        |
        | idempotent retryable webhook
        v
Committee operational spreadsheet
```

## Trusted boundaries

- The browser is untrusted. Member IDs, roles, event status, dates, and booking
  ownership are derived again at the server.
- Sessions use a random token in an HttpOnly cookie; only its SHA-256 hash is
  stored.
- Passwords use per-user random salt and PBKDF2-SHA-256.
- Every mutating endpoint validates same-origin requests and an authenticated
  server-side session.
- Administrator endpoints call a server-side administrator guard.
- Bookings use a unique `(member_id, event_id)` constraint and a version field.
- Audit and outbox writes use unique idempotency keys.

## Canonical state and integration

D1 is canonical for the member-facing booking state because a spreadsheet
cannot reliably enforce ownership or concurrent uniqueness. The fixture sheet
remains canonical for committee-maintained event information. Booking changes
create outbox records for the operational spreadsheet. Delivery failures remain
visible and retryable without invalidating the member’s confirmed website state.

## Reversibility

- The initial migration creates new tables and does not alter existing website
  data.
- Rollback disables the new routes/UI, restores the previous static fixtures
  component, and leaves D1 data intact for audit/export.
- Before production migration, export D1 and record the deployment commit.
- Google Forms remain available as a committee-controlled emergency fallback
  until the September cutover is accepted.

