# Jaguar release-candidate evidence — 21 August 2026

## Outcome

Recommendation: `READY FOR EXTERNAL GATE`.

The approved operational release is complete locally and preserved on `codex/jaguar-finish-2026-08-21`. It is not production-complete: Google/Cloudflare authorization, remote migration/deployment, exact remaining business inputs and real administrator/member acceptance still require Priyesh's explicit gate approval.

No Google, Cloudflare, DNS, production D1, spreadsheet, sharing, account or booking mutation was performed in this recovery.

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

| Work package | Local state | Evidence | Remaining external/human gate |
| --- | --- | --- | --- |
| WP1 fixture foundation | Complete | Twelve-ID allowlist, strict UK/ISO window parsing, fail-closed classification, immediate authenticated refresh signal, hourly reconciliation, last-known-safe handling and focused tests | Read back approved remote bindings; deploy/verify Worker and authoritative source against Preview |
| WP2 operational authentication | Complete | Fixed operational username, individual member identity separation, recovery-only controls, session/role isolation and 26 focused auth/integration tests | Confirm real approved accounts and complete real administrator/member Preview UAT |
| WP3 secure booking | Complete locally; externally gated | Exact required `Veg` / `Non-veg` with no default; same member/admin validation; buggy unchanged; origin/role/race/duplicate/cancel controls; dietary output remains off | Exact real fixture windows/business rules, Preview migration/deployment and real-identity acceptance |
| WP4 outputs and Hall of Fame | Complete locally; externally gated | Leased signed idempotent one-way booking adapter, bounded retry/recovery, atomic last-valid Hall of Fame, three migrations, 21-step API smoke and Functions packaging | Apps Script authorization/private HMAC setup, remote D1 backup/migration, Worker/Pages Preview then Production verification |
| WP5 operations and handover | Complete locally; externally gated | Protected source dashboard, approved-link allowlist, role/non-disclosure tests, ownership/direction/sync/error/recovery guidance and committee handover | Enter approved links privately, retain unresolved ownership where stated, and obtain committee sign-off |

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
| Full release check | `npm run check` | ESLint passed; 79 passed, 0 failed; Vite 8.2.2 build passed; Wrangler 4.125.0 Functions compilation passed |
| Repeatability | `npm run check` with an existing generated `.tmp/pages-functions` | Passed after adding generated-output ESLint ignores |
| Production bundle | Vite output | 54 modules; HTML 1.00 kB, CSS 37.20 kB, JS 362.44 kB; no unresolved asset warning |
| Functions routing | `.tmp/pages-functions/_routes.json` | Version 1; includes `/api/*`; non-empty Worker bundle |
| Empty local D1 | `wrangler d1 migrations apply ... --local --persist-to .tmp/d1-final` | `0001`, `0002`, `0003` passed: 19 + 5 + 7 commands |
| API smoke | `npm run verify:api` with isolated local settings | 21 checks passed; auth/roles, exact dietary choice, booking/cancel/duplicates, admin correction, operations/status and Hall of Fame JSON |
| Data invariants | Aggregate-only D1 query | 0 invalid dietary values; 0 duplicate active member/event bookings; four seeded Hall of Fame rows |
| Browser | Built Pages candidate at 390 px | Member/admin/public journeys passed; accessible labels/statuses; no tested overflow or console errors; React Router 7 client navigation passed |
| Media integrity | `ffprobe` and reference search | MP4 valid, 94.993 seconds, 24,123,983 bytes; all three committee images and video referenced |
| Audit | `npm audit --omit=dev --json`; `npm audit --json` | 0 production and 0 full-tree vulnerabilities |
| Patch hygiene | `git diff --check` | Passed |
| Proposed implementation scan | 60 staged files; high-confidence credential/PII/private-URL and forbidden-filename rules | 0 findings after replacing private-looking test fixtures with `example.invalid`/example URLs |
| Deployment packaging | `python scripts/deploy_pages.py` | Independent clean install/check/build/Functions validation passed; dry run exited 0; no external deployment attempted |

Meaningful warning: automated browser key injection was not reliable in the final browser reconnect. The application exposes native labelled buttons, checkbox and required radios, focus targets were verified, and the earlier complete local member/admin journeys passed; real keyboard/mobile acceptance therefore remains an explicit Preview UAT gate rather than a waived check.

## External decision pack

| Action | Owner/authority | Required proof before advancing |
| --- | --- | --- |
| Authorize and deploy the bound Google Apps Script adapter | Verified Google workbook/script owner, operationally Chetan | Private properties entered outside chat; signed test accepted; one idempotent test row and Sync Log outcome; retry/conflict behavior; dietary absent |
| Read back and enter masked Cloudflare configuration | Priyesh or authorized Cloudflare account owner | Exact account/project/Worker/D1/bindings confirmed; secrets remain masked/provider-held; `BOOKING_SYNC_INCLUDE_DIETARY` absent or false; origins exact |
| Back up and migrate remote D1 | Authorized Cloudflare/D1 owner | Pre-change export stored outside the repo with checksum and commit SHA; migrations `0001`–`0003` recorded; aggregate schema/count invariants; tested rollback route |
| Deploy Worker and Pages Preview from the project root | Release operator after gate approval | Fixture/Hall of Fame runs healthy; `/api/auth/session` and `/api/leaderboards` return expected API status plus JSON, never SPA HTML; Functions/logs/bindings healthy |
| Resolve booking-critical business inputs | Chetan/committee owner | Exact registration/cancellation windows, capacity behavior and any non-empty `BookingFields` contract recorded; unresolved fixtures remain fail-closed |
| Real Preview UAT | Priyesh, Chetan and one authorized real member identity | Admin/member role isolation; book/refresh/duplicate/cancel; exact dietary choice; attendee correction; private balance; mobile and keyboard; no unintended PII disclosure |
| Approve and deploy Production | Priyesh after all Preview evidence | Fresh backup; reviewed commit; explicit production switch; API/browser/log/D1/sheet invariants repeated; current production content/accounts/bookings preserved |
| DNS/domain or Drive sharing changes, if required | Domain owner or verified Google sharing owner | Separate exact target/scope approval and post-change verification; none is assumed by this pack |

Secrets must be entered through Google/Cloudflare provider controls and never pasted into chat, docs, logs or Git.

## Readiness score

`8.8 / 10` against the charter:

- security and data integrity: 2.0/2.0;
- clean automated verification and packaging: 2.0/2.0;
- WP4/WP5 operations and recovery: 1.8/2.0;
- source evidence and committee handover: 1.8/2.0;
- external deployment and real UAT proof: 1.2/2.0.

The bounded improvement pass removed all dependency advisories, upgraded the unsupported lint toolchain, made repeated checks ignore generated bundles, and removed private-looking test fixtures. The remaining 1.2-point gap is deliberately external and cannot be closed safely without Priyesh's approval and provider/committee participation.
