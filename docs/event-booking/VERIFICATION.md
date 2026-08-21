# Secure booking verification record

Date: 21 August 2026

Environment: clean disposable copy under `%LOCALAPPDATA%\Temp`, Node 24/npm 11, Cloudflare Pages Functions with an isolated local D1 database, and test-only `example.invalid` identities. No production credentials or remote resources were used.

## Automated checks

- `npm ci`: passed from the lockfile in the clean copy.
- Focused WP3 dietary/security and WP4/WP5/auth/non-disclosure suites: passed.
- `npm run check`: ESLint passed; all 79 Node tests passed; the Vite production build passed; the Wrangler Pages Functions build passed.
- Pages Functions routing manifest: version 1 with `/api/*` included, proving API Functions are packaged with the SPA.
- Local D1 migrations: all three migrations applied to an empty isolated database (19, 5 and 7 commands).
- Dependency audit: `npm audit --omit=dev` and the full `npm audit` both report zero known vulnerabilities.
- `git diff --check`: passed after recovery whitespace cleanup.

## API and data checks

The isolated API verifier passed 21 checks:

- one-time local administrator bootstrap and administrator sign-in;
- an exact canonical fixture with all required booking windows;
- two test-member creations and member sign-in;
- member/admin role isolation and restricted-operations-link non-disclosure;
- same-origin mutation enforcement;
- rejection of missing/arbitrary dietary input and acceptance of exact `Veg` / `Non-veg` only;
- member self-registration, persisted canonical state, sequential/concurrent duplicate rejection, and self-cancellation;
- canonical administrator attendee state and correction using the same dietary enum;
- protected operations and integration-status responses; and
- public Hall of Fame JSON rather than SPA HTML.

The post-smoke isolated database had zero invalid dietary values and zero duplicate active member/event bookings. The verifier did not resynchronise or mutate the authoritative fixture source.

## Browser and responsive checks

The in-app browser exercised the built Pages candidate at a 390 px viewport:

- mobile landing page, menu landmarks and accessible names;
- administrator sign-in, protected dashboard, attendee correction controls, operations sources and safe external-link attributes;
- member sign-in, fixture list/detail, required no-default dietary radios, disabled-until-selected registration, success status, persisted `Non-veg`, two-step cancellation and cancellation status;
- public Hall of Fame and the honest donation, sponsorship and gallery unavailable states;
- no horizontal overflow on the tested public, member and administrator views; and
- no browser console warnings or errors.

The form uses native buttons, checkbox, required radios and labelled controls. The clean browser run verified semantic keyboard-focus targets; real-member keyboard/mobile acceptance remains part of preview UAT.

The sign-in fields were populated once by the test browser's password manager. A repository search found none of those values in source, history-bound proposed files or configuration; the controlled tab was closed after QA.

## Deployment packaging review

- `scripts/deploy_pages.py` creates a clean temporary copy, checks Node 24, runs `npm ci` and `npm run check`, validates the Functions bundle and `/api/*` route, and deploys from the project root so both `dist/` and `functions/` are uploaded.
- The helper is dry-run by default. `--deploy` is required for preview; production also requires `--approve-production`.
- After deployment it rejects a preview whose `/api/auth/session` or `/api/leaderboards` response is SPA HTML instead of an API response.
- The GitHub content-sync workflow uses an explicit four-file data allowlist and only deploys the `main` branch after checks pass.

## Not verified against production

- Current remote Cloudflare identity, Pages/Worker variables, D1 bindings, backups and migrations.
- Google Apps Script owner authorization, deployment, private HMAC setup and isolated workbook acceptance.
- Exact remaining real fixture windows, capacity behaviour and any non-empty `BookingFields` contract.
- Production member roster/import and one approved real member acceptance identity.
- Preview/production URLs, Function logs, D1 invariants, booking-output rows and real administrator/member UAT.
- DNS/custom-domain or Google sharing changes, if the approved release requires them.

These are explicit external-release gates, not waived local checks. No external mutation was performed.
