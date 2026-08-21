# Jaguar release-candidate evidence — 21 August 2026

## Outcome

Recommendation: `PRODUCTION RELEASED — VERIFIED READY`.

Priyesh approved the external gate and explicitly designated
`https://jaguargolfsociety.siteproductions.co.uk/` as the canonical production
origin. The approved release is deployed there. Google Apps Script, Cloudflare
Worker, Pages and D1 setup are complete; signed administrator delivery and
non-mutating real-member acceptance passed. A controlled scheduled Worker cycle
also completed successfully, and the normal minute-7 hourly trigger was restored
and observed after provider propagation settled.

No fabricated member or booking was created. Both genuine production bookings
were preserved and projected to the restricted operational workbook. The second
booking was genuine member activity outside the release operator's actions;
member UAT itself did not submit a registration or cancellation.

## Recovered stopping point and preservation

- Verified starting commit: `59c25fb`; starting tree: 31 tracked modifications and 34 untracked status entries.
- Recovery snapshot: `%LOCALAPPDATA%\Temp\jgs-recovery-2026-08-21-59c25fb`.
- Binary-capable tracked patch: 151,623 bytes, SHA-256 `D2EA1DF32C7F2FA723E61EB50FE68F099E14A5BC727298D58591579B74166EA7`.
- Untracked backup: 29 non-secret/non-generated files, 31,787,723 bytes.
- Recovery manifest: SHA-256 `C9EF8AF6677C33F365ED16B0EF4EA8C1AEE0AF6E6ACCDB17486DB188B0D06934`.
- Generated provider reports and real local Wrangler configuration were preserved in place but excluded from the snapshot/commit and added to ignore rules.
- Four evidenced obsolete one-off logo/helper duplicates were removed only after backup; they remain recoverable from the snapshot.
- A merge-base review proved the newer `origin/main` content stream changed only `src/data/metadata.json` and `src/data/signups.json`. Merge commit `880c668` reconciled those files without replacing the secure-booking work.
- Implementation save point: `bb8f386` (`feat: complete operational website release candidate`).

## WP1–WP5 status

| Work package | State | Evidence | Remaining governance/input |
| --- | --- | --- | --- |
| WP1 fixture foundation | Production | Twelve-ID allowlist, strict UK/ISO window parsing, fail-closed classification, hourly Worker reconciliation and last-known-safe handling; latest run accounted for all 12 fixtures | Committee must continue to supply exact booking-window changes; invalid/missing rows remain fail-closed |
| WP2 operational authentication | Production | Sole shared administrator plus separate ordinary-member identity; session and role isolation; real admin/member UAT on the custom origin | Normal committee account stewardship only |
| WP3 secure booking | Production | Exact required `Veg` / `Non-veg` with no default; same member/admin validation; origin/role/race/duplicate/cancel controls; dietary output remains off | Capacity and any non-empty `BookingFields` rules remain committee decisions |
| WP4 outputs and Hall of Fame | Production | Deployed signed idempotent adapter, bounded retry/recovery, D1 migrations, 54-row Hall of Fame state, two synced booking projections and a successful scheduled reconciliation | Retain the append-only sheet audit trail and investigate future alerts under the documented procedure |
| WP5 operations and handover | Production | Protected source dashboard, approved-link allowlist, role/non-disclosure tests and operational guidance | Add only separately approved business links/content; unresolved ownership remains explicit |

## Reviewed change groups

- Secure accounts, booking policy/store/API, member balance reconciliation and administrator controls.
- Fixture/Hall of Fame reconciliation Worker, migrations, signed Apps Script adapter and isolated smoke tooling.
- Protected WP5 operations dashboard and server-only source-link allowlist.
- Exact dietary-choice member/admin UI and tests.
- Honest public unavailable states, verified committee media, charity video integrity, favicon and dead-link cleanup.
- Node 24, supported React Router/Vite/ESLint/PostCSS toolchain, reproducible lockfile and current CI actions.
- Dry-run-first Pages deployment helper that packages root Functions with `dist/` and verifies API JSON after an approved deployment.
- Authority, setup, verification, recovery and plain-English handover documentation.

## Exact local validation

Clean candidate: `%LOCALAPPDATA%\Temp\jgs-release-final-2026-08-21-v3`; 123 source files, 30,348,008 bytes before dependency installation; no `node_modules`, real Wrangler config or `.dev.vars` copied.

| Check | Command/evidence | Result |
| --- | --- | --- |
| Clean install | `npm ci` | 233 packages installed, 234 audited, 0 vulnerabilities, no unsupported-package warning |
| WP3/auth focus | `node --test tests/wp3-booking-security.test.js tests/operational-admin-auth.test.js tests/event-policy.test.js` | 29 passed, 0 failed |
| WP4/WP5/non-disclosure focus | Eight named WP4/WP5/auth test files via `node --test` | 48 passed, 0 failed |
| Full release check | `npm run check` | ESLint passed; 80 passed, 0 failed; Vite 8.2.2 build passed; Wrangler 4.125.0 Functions compilation passed |
| Repeatability | `npm run check` with an existing generated `.tmp/pages-functions` | Passed after adding generated-output ESLint ignores |
| Production bundle | Vite output | 54 modules; HTML 1.01 kB, CSS 37.20 kB, JS 362.44 kB; no unresolved asset warning |
| Functions routing | `.tmp/pages-functions/_routes.json` | Version 1; includes `/api/*`; non-empty Worker bundle |
| Empty local D1 | `wrangler d1 migrations apply ... --local --persist-to .tmp/d1-final` | `0001`, `0002`, `0003` passed: 19 + 5 + 7 commands |
| API smoke | `npm run verify:api` with isolated local settings | 21 checks passed; auth/roles, exact dietary choice, booking/cancel/duplicates, admin correction, operations/status and Hall of Fame JSON |
| Data invariants | Aggregate-only D1 query | 0 invalid dietary values; 0 duplicate active member/event bookings; four seeded Hall of Fame rows |
| Browser | Built Pages candidate at 390 px | Member/admin/public journeys passed; accessible labels/statuses; no tested overflow or console errors; React Router 7 client navigation passed |
| Media integrity | `ffprobe` and reference search | MP4 valid, 94.993 seconds, 24,123,983 bytes; all three committee images and video referenced |
| Audit | `npm audit --omit=dev --json`; `npm audit --json` | 0 production and 0 full-tree vulnerabilities |
| Patch hygiene | `git diff --check` | Passed |
| Proposed implementation scan | 60 staged files; high-confidence credential/PII/private-URL and forbidden-filename rules | 0 findings after replacing private-looking test fixtures with `example.invalid`/example URLs |
| Deployment packaging | `python scripts/deploy_pages.py` | Independent clean install/check/build/Functions validation passed; production helper now verifies the public Pages alias rather than a provider-protected immutable deployment URL |

The complete check was repeated from a fresh clean archive of `main` before the
custom-domain production deployment. The deployed runtime change is `21bfd6b`;
`bdac599` adds only the production-verification helper correction.

## Production verification

| Area | Masked evidence | Result |
| --- | --- | --- |
| Recovery | Pre-change production D1 SQL export stored outside the repository; 1,816,987 bytes; SHA-256 `ed9cff690d55e1c221a0191db208a39d6bf04e139f6e3514b6dc361871db1f1d`; tied to reviewed commit `50b9ad32befc6d37edafcf5eb11570acee980e37` | SQL integrity passed; rollback artifact preserved |
| D1 schema | Required tables and migration ledger queried remotely | 11 required tables; migrations `0001`–`0003`; no pending migration |
| D1 invariants | Aggregate-only remote queries | 2 active accounts (1 sole shared administrator, 1 ordinary member); 2 registered bookings; 0 duplicate active bookings; 0 invalid dietary values; 12 fixtures; 54 active Hall of Fame rows |
| Fixture reconciliation | Latest successful production Worker summary | 12 source / 12 expected / 12 accounted; 1 bookable, 2 temporarily unavailable, 9 historical, 0 withheld |
| Apps Script | Bound booking adapter promoted to active Version 2; only the required Script Property key names were read back | HMAC envelope, idempotent upsert and reconciliation code active; Version 1 retained as rollback |
| Cloudflare Worker | Deployed from runtime commit `21bfd6b`; cron restored to minute 7 hourly after a controlled replay | Fixture, leaderboard and booking-output runs healthy; exact expected secret names present; values never disclosed |
| Cloudflare Pages | Clean production build deployed from `main` at `bdac599` with Functions included | Custom origin serves the release and accepts same-origin API writes; provider Pages alias remains a working read/API alias but rejects authentication-origin writes |
| Provider configuration | Fresh post-deploy Pages configuration read-back | `APP_ORIGIN` persists as the custom HTTPS origin; one D1 binding; five production variables; dietary-output flag absent; expected secret names retained |
| API routing | Custom-domain root and representative auth/public APIs | Release assets served; auth API returns JSON rather than SPA HTML; Hall of Fame API returns JSON; origin gate behaves as configured |
| Signed booking output | Shared administrator delivery plus controlled scheduled replay | 2 sent, 0 failed, 0 pending; both genuine registered bookings are projected as synced canonical rows, with dietary output omitted by policy |
| Secret alignment and sheet audit | User-approved rotation across Apps Script, Pages and Worker; aggregate-only `Sync Log` inspection | Eight historical unauthorised attempts exposed the prior Worker mismatch; the append-only failures were retained, the latest entry succeeded, and no failure followed that success |
| Administrator UAT | Real shared-admin session on the custom origin | Administrator dashboard and delivery retry passed |
| Member UAT | Real ordinary-member session on the custom origin, including narrow mobile viewport | Admin route denied; admin navigation absent; member portal passed; required two-choice dietary form has no default and remains disabled until selection; existing booking shown with cancellation closed; no horizontal overflow; no member mutation |
| Recurring booking audit | Controlled scheduled Worker replay, followed through trigger propagation | Booking output succeeded with 2 delivered, 0 failed and 0 alerts; subsequent propagation cycles were also healthy; the temporary cadence stopped after the configured hourly trigger took effect |

## Remaining decisions

| Decision | Owner/authority | Safe current behaviour |
| --- | --- | --- |
| Exact future fixture registration/cancellation windows | Chetan or committee owner | Missing or invalid values fail closed; no dates are invented |
| Capacity policy: unlimited, hard cap or waitlist | Committee | No unapproved capacity rule is enforced |
| Any non-empty `BookingFields` contract | Committee plus implementation review | Only the reviewed basic booking fields are accepted |
| Member-roster expansion and personal finance links | Priyesh/Chetan with member authority | No fabricated accounts, mappings or private URLs are introduced |
| Public legal/contact, donation, sponsorship and additional media | Appropriate committee/content owner | Honest unavailable states remain until approved material exists |
| DNS/domain or Drive sharing changes, if later required | Domain owner or verified Google sharing owner | No further sharing or DNS mutation is assumed by this release |

Secrets must be entered through Google/Cloudflare provider controls and never pasted into chat, docs, logs or Git.

## Readiness score

`9.8 / 10` against the charter for the verified production release:

- security and data integrity: 2.0/2.0;
- clean automated verification and packaging: 2.0/2.0;
- WP4/WP5 operations and recovery: 1.9/2.0;
- source evidence and committee handover: 1.9/2.0;
- external deployment and real UAT proof: 2.0/2.0.

The bounded improvement pass removed all dependency advisories, upgraded the
unsupported lint toolchain, made repeated checks ignore generated bundles, and
removed private-looking test fixtures. The separate future business/content
decisions above are intentionally unresolved rather than guessed; they do not
block the verified deployed release.
