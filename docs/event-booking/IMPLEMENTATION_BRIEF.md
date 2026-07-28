# JGS secure event booking: implementation brief

## Outcome

Deliver a mobile-first September-event vertical slice in the existing React and
Cloudflare Pages application. Each active member has an individual email-based
account, can register only themselves, sees an immediate persistent result, and
can cancel only their own active booking when the configured policy permits.
Administrators manage accounts, event windows, bookings, attendee lists, and
integration failures from trusted server-side endpoints.

## Non-negotiable rules

- Authentication and authorisation are enforced by Cloudflare Pages Functions.
- Member, event, and booking identifiers are stable and never inferred from
  display names.
- One canonical booking row exists per member and event.
- Database uniqueness and compare-and-swap versioning protect against retries,
  double clicks, and concurrent requests.
- Registration windows and event-specific cancellation windows are explicit
  ISO-8601 timestamps with a configured IANA timezone. Where cancellation is
  otherwise unset, synchronisation applies the documented configurable
  seven-day working fallback; no guessed registration-opening default is used.
- The committee spreadsheet remains the event-information source.
- The website becomes the normal member booking interface; Google Forms are not
  part of the new member flow.
- Spreadsheet delivery is idempotent and retryable. A spreadsheet outage does
  not erase or roll back a valid website booking.
- Members see only their own booking and finance-link state. Administrators see
  the confirmed-attendee list.
- No production identifiers, member records, deadlines, or credentials are
  invented.

## Delivery boundary

The implementation includes:

- D1-compatible schema and reversible migration notes.
- Individual email/password accounts with salted PBKDF2 hashes.
- HttpOnly server-side sessions and role checks.
- Administrator-only account provisioning and temporary-password reset.
- Configurable event publication, registration, and cancellation windows.
- Self-registration, duplicate prevention, confirmation, and cancellation.
- Booking audit history and spreadsheet-delivery outbox.
- Fixture-sheet import with idempotent event upserts and visible sync runs.
- Administrator members, events, attendees, and integration status interfaces.
- Secure self-only finance-resource link.
- Automated domain, API, security, concurrency, and UI tests where supported.
- Desktop, mobile, keyboard, console, and regression checks.

Production activation remains gated on the configuration listed in
`ARCHITECTURE.md`.

## Release strategy

1. Build and test locally against an isolated D1-compatible database.
2. Import and validate authorised members with accounts disabled by default.
3. Configure September event windows and operational spreadsheet delivery.
4. Test with committee-owned non-production accounts and data.
5. Back up the production database and apply migrations.
6. Deploy a preview and complete member/admin acceptance checks.
7. Enable September events only after all release gates pass.
8. Retain the old Google Forms as an unpublished rollback route until the first
   event closes successfully.

