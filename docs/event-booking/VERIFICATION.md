# Secure booking verification record

Date: 28 July 2026  
Environment: isolated local Cloudflare Pages Functions and D1; mock member
identities under `example.invalid`; live public fixture CSV; no production
booking-output credentials.

## Automated checks

- ESLint: passed.
- Node domain tests: 9 passed, 0 failed.
- Vite production build: passed.
- D1 migration: 19 statements applied successfully to an empty local database.
- Existing build warning remains: `/images/hero-bg.jpg` is unresolved at build
  time.

## API and data checks

Passed:

- one-time administrator bootstrap and individual login;
- temporary-password enforcement before member data access;
- server-side member/admin role isolation;
- same-origin mutation enforcement;
- open-event listing and event detail;
- self-registration and immediate canonical state;
- repeated registration rejected with `already_registered`;
- concurrent registration returned one `201` and one `409`;
- member cannot call administrator booking correction;
- cancellation without an active booking rejected;
- self-cancellation and persisted cancelled state;
- canonical administrator attendee list;
- fixture sync rerun retained 12 stable event records;
- fixture sync preserved administrator-configured booking windows;
- successful sync timestamp/status exposed to administrators;
- missing booking webhook retained visible, retryable outbox records.

## Browser and responsive checks

- Sign-in, fixtures, event detail, registration, persistent confirmation,
  explicit cancellation confirmation, and cancellation result exercised.
- At 390px: `scrollWidth` equalled `clientWidth`; no horizontal page overflow.
- Controls expose semantic roles and accessible labels in the browser tree.
- Registration and cancellation success messages use live status regions.
- Administrator dashboard exercised at the default desktop viewport.
- No console errors were recorded for the local Pages application.

## Not verified against production

- Real D1 binding and migration.
- Authorised member roster and finance links.
- Exact September windows.
- Live spreadsheet booking adapter, authentication, and row-level idempotency.
- Cloudflare preview/production deployment and logs.

These are release blockers, not local implementation failures.
