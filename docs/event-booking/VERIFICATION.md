# Secure booking verification record

Date: 28 July 2026  
Environment: isolated local Cloudflare Pages Functions and D1; mock member
identities under `example.invalid`; live public fixture CSV; no production
booking-output credentials.

## Automated checks

- ESLint: passed.
- Node domain tests: 15 passed, 0 failed.
- Vite production build: passed.
- D1 migration: 19 statements applied successfully to an empty local database.
- Production build completes without unresolved asset warnings.

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
- fixture sync applied the configurable seven-day cancellation fallback;
- fixture sync preserved administrator-configured registration and cancellation windows;
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

## Dependency and deployment review

- `npm audit --omit=dev` reports two moderate React Router advisories. The SPA
  does not use SSR/RSC hydration, and post-login navigation now passes through a
  tested internal-path validator that rejects protocol-relative, encoded-slash,
  and backslash destinations. The available major upgrade introduces a different
  RSC advisory, so the lockfile remains unchanged pending a clean release.
- The full audit also reports development-tool advisories in Babel, esbuild,
  brace-expansion, js-yaml, and PostCSS. Runtime member data is not exposed to
  these local build tools.
- Cloudflare preview deployment was attempted only after local verification, but
  `wrangler whoami` returned an expired/unavailable token. No remote database or
  deployment was changed.
## Not verified against production

- Real D1 binding and migration.
- Authorised member roster and finance links.
- Exact September windows.
- Live spreadsheet booking adapter, authentication, and row-level idempotency.
- Cloudflare preview/production deployment and logs (blocked by Wrangler authentication).

These are release blockers, not local implementation failures.
