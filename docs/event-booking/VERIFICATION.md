# Secure booking verification record

Date: 21 August 2026

Local-gate environment: clean disposable copy under `%LOCALAPPDATA%\Temp`, Node 24/npm 11, Cloudflare Pages Functions with an isolated local D1 database, and test-only `example.invalid` identities. No production credentials or remote resources were used during that local phase; production completion is recorded below.

## Automated checks

- `npm ci`: passed from the lockfile in the clean copy.
- Focused WP3 dietary/security and WP4/WP5/auth/non-disclosure suites: passed.
- `npm run check`: ESLint passed; all 80 Node tests passed; the Vite production build passed; the Wrangler Pages Functions build passed.
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

The form uses native buttons, checkbox, required radios and labelled controls. The clean browser run verified semantic keyboard-focus targets; non-mutating real-member mobile acceptance was subsequently completed in production.

The sign-in fields were populated once by the test browser's password manager. A repository search found none of those values in source, history-bound proposed files or configuration; the controlled tab was closed after QA.

## Deployment packaging review

- `scripts/deploy_pages.py` creates a clean temporary copy, checks Node 24, runs `npm ci` and `npm run check`, validates the Functions bundle and `/api/*` route, and deploys from the project root so both `dist/` and `functions/` are uploaded.
- The helper is dry-run by default. `--deploy` is required for preview; production also requires `--approve-production`.
- After deployment it rejects a target whose `/api/auth/session` or `/api/leaderboards` response is SPA HTML instead of an API response. Production verification uses the public Pages alias rather than a provider-protected immutable deployment URL.
- The GitHub content-sync workflow uses an explicit four-file data allowlist and only deploys the `main` branch after checks pass.

## Production verification completed

- Priyesh explicitly approved production and designated
  `https://jaguargolfsociety.siteproductions.co.uk/` as the canonical production
  and authentication origin.
- A pre-change production D1 export was preserved outside the repository with a
  verified checksum, and migrations `0001`–`0003` plus aggregate invariants were
  read back remotely.
- Apps Script Version 2, the scheduled Worker and Pages Functions were deployed;
  secret values and private endpoint/database identifiers were not copied into
  source or this record.
- The custom domain serves the expected release and JSON APIs. Fresh provider
  configuration read-back confirmed the exact origin, D1 binding, production
  variable count and disabled dietary output.
- Both genuine production bookings are registered and projected exactly once,
  leaving two sent and zero failed/pending outbox rows. The restricted workbook
  reports both canonical rows as synced, with no row error and dietary output
  omitted by policy.
- Real ordinary-member role isolation, direct administrator denial, required
  no-default dietary choices, existing booking state and narrow mobile layout
  passed without submitting or cancelling a booking. The session was signed out
  after verification.
- The first scheduled check exposed a mismatched Worker integration secret. With
  explicit user approval, one new value was rotated through Apps Script, Pages
  and Worker using masked/provider-held controls. Eight historical unauthorised
  attempts remain in the append-only sheet log; the latest log entry succeeded
  and no failure followed it.
- A controlled scheduled replay delivered two, failed zero and raised zero
  reconciliation alerts. Additional cycles during trigger propagation were also
  healthy, after which the configured minute-7 hourly schedule took effect and
  the temporary cadence stopped.

Exact future fixture windows, capacity behaviour, non-empty
`BookingFields`, roster expansion, and any later DNS or Drive-sharing change
remain separate owner decisions and are not guessed.
