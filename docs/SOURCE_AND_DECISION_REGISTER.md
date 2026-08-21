# Source and decision register

This register is the evidence-first companion to the [Project delivery and orchestration charter](./PROJECT_DELIVERY_CHARTER.md). Before asking a person for an apparently missing fact, inspect the relevant project documentation, current configuration concepts, package evidence, and already-authorised connected sources. Record only what can be verified; do not imply permanent access to historic chats or unavailable systems.

## Handling rules

- Verify the current source and its intended authority before asking for data or making a change.
- Prefer an exact artifact title, tab, configuration key, and last-verified note over copied data.
- Never record member lists, passwords, tokens, secret values, database identifiers, or raw credential material here.
- A known contact address is not automatically a verified Google sharing identity. Confirm ownership and sharing authority before granting access.
- D1 is canonical for accounts, sessions, bookings, booking audit, and delivery state. Spreadsheets are authoritative only for the designated source data below.
- Booking data flows from the authenticated website/D1 to approved operational outputs. Do not imply or implement two-way spreadsheet editing of bookings.
- Re-verify time-sensitive facts after a package changes configuration, ownership, integrations, or source structure.

## Authoritative and operational artifacts

| Artifact | Verified role | Authority and direction | Known location/configuration concept | Last verified |
| --- | --- | --- | --- | --- |
| `Jaguar_Golf_Society_QA_Compliance_Matrix` -> `DB_Fixtures` | Master fixture source, including status and strict UK/ISO booking-window fields | Sheet -> validated fixture sync -> D1/website; webhook is only an authenticated refresh signal | `MASTER_FIXTURES_CSV_URL`; approved 12-ID roster in `EXPECTED_FIXTURE_IDS` | 2026-08-21: production Worker accounted for all 12 fixtures: 1 bookable, 2 temporarily unavailable, 9 historical, 0 withheld |
| `Jaguar_Golf_Society_QA_Compliance_Matrix` -> `DB_Leaderboards` | Existing historical leaderboard source | Designated historical Hall of Fame source; not booking state | Connected Drive workbook; link is surfaced admin-only in WP5 when an approved URL is configured | 2026-08-21: production Worker and public JSON API healthy; 54 active rows |
| `JGS_Members_Balance` -> `Sheet1` | Member payment/balance reconciliation source maintained operationally | Sheet -> read-only balance reconciliation in the website; never account credentials | `MEMBER_BALANCES_CSV_URL` | 2026-07-29: workbook/tab and Chetan balance row verified |
| `JGS Booking Management` -> `Bookings` | Approved WP4 operational booking-output projection | D1/website -> authenticated idempotent upsert into sheet; D1 remains canonical | Provider-managed `BOOKING_SYNC_WEBHOOK_URL` and `BOOKING_SYNC_TOKEN`; direct link remains admin-only | 2026-08-21: Apps Script Version 2 active; both genuine registered bookings are present exactly once as canonical synced rows; dietary output remains omitted |
| `JGS Booking Management` -> `Sync Log` | Approved WP4 operational delivery log | Integration run outcomes append to sheet; failures must not delete valid D1 or sheet rows | Same deployed booking-output adapter | 2026-08-21: eight historical unauthorised attempts retained, followed by successful user-approved secret alignment and scheduled reconciliation; no failure followed the latest success |
| `JGS Booking Management` -> `README` / `Event Config` | Committee operating notes and workbook context | Reference/projection only; fixture authority remains `DB_Fixtures` | Connected Drive workbook | 2026-07-29: both tabs present; existing notes already state committee-only access and stable IDs |
| Legacy Google Form responses and `Live_Entry_List` | Historical/legacy operational evidence only | Not an input to new canonical booking state | Connected Drive; do not wire into WP3/WP4 booking writes | 2026-07-29: named sources inspected read-only |
| `Players_Specific_URLs` -> `Sheet1` | Authorised member name/email roster and restricted finance-link directory | `Member` + `E-mail` are approved for one-way account provisioning; authority over D1 `finance_url` mappings remains unassigned | Connected Drive workbook; rows and links remain restricted and never public or embedded | 2026-08-21: exactly 56 unique valid emails reconfirmed; Priyesh explicitly authorised creating those accounts |
| Other member-portal operational sheets | WP5 dashboard/guide category | Authority not yet assigned | Exact approved sources still to be inventoried and confirmed | Unresolved |

## Account and role model

| Semantic identity | Role and purpose | Verified state |
| --- | --- | --- |
| Priyesh personal account | Ordinary member identity for booking acceptance testing; not a website administrator | Active member; existing identity/password preserved and prior sessions revoked |
| Shared operational administrator (`admin`) | Sole website administrator for routine committee administration | Active; password remains private/provider-safe |
| Members | Individual personal booking identities; may manage only their own booking | Existing identity preserved; 56-row email roster explicitly authorised for Google/reset-email onboarding on 2026-08-21 |
| Chetan Patel | Operational spreadsheet maintainer and intended shared-admin user | A single consistent contact email exists in approved project/Drive evidence; Google account ownership must still be confirmed before editor sharing |

## Confirmed decisions

- WP1 fixture foundation is complete: canonical spreadsheet re-read, validation, immediate Apps Script refresh notification, hourly reconciliation, and twelve-fixture accounting.
- WP2 operational authentication is complete: shared `admin` is the sole website administrator; Priyesh's existing personal account is an active member.
- WP3 fail-closed security code was independently reviewed and deployed. The 2026-08-21 production release adds one exact required dietary choice, `Veg` or `Non-veg`, with no default and the same validation for member booking and administrator correction.
- A fixture is bookable only when its authoritative registration/cancellation windows are complete and current. The latest production reconciliation classified exactly 1 of 12 as bookable, 2 as temporarily unavailable and 9 as historical; invalid or missing windows continue to fail closed.
- Spreadsheet-maintained fixtures are read-only in the website administrator UI; source corrections belong in `DB_Fixtures`.
- `JGS Booking Management` is the approved WP4 booking-output destination. Its existing `Bookings` and `Sync Log` tabs must be reused rather than recreated.
- D1 remains canonical for accounts and bookings; booking-output spreadsheets are operational projections, not competing edit surfaces.
- Priyesh explicitly designated `https://jaguargolfsociety.siteproductions.co.uk/` as the canonical production and authentication origin on 2026-08-21. The attached `pages.dev` hostname remains a provider alias for public/read API access and is intentionally rejected by the write-origin gate.
- WP5 delivers an admin-only source dashboard and plain-English operations guide with source ownership, approved server-supplied links, sync/error meaning, and a source -> sync -> website -> outputs flow.
- `Players_Specific_URLs` is an approved WP5 dashboard-linked information source, but its link and contents are restricted to authenticated administrators; its D1 mapping authority remains unresolved.
- Priyesh explicitly authorised all 56 unique `Players_Specific_URLs` member emails as accounts on 2026-08-21. Only names and emails may provision D1 accounts; passwords and reset tokens remain hashed in D1 and never belong in Sheets. Google Sign-In is primary, with verified one-time reset email as the fallback.

## Unresolved business and external-authority gates

| Gate | Required owner/authority | Why it cannot be inferred |
| --- | --- | --- |
| Exact future or missing fixture registration and cancellation timestamps | Chetan or committee owner | Booking-critical business times must never be invented |
| Capacity behavior: unlimited, hard cap, or waitlist | Committee decision | Current importer does not enforce `Capacity` |
| Non-empty `BookingFields` contract | Committee plus implementation review | Current UI/server supports only the approved basic fields; arbitrary business schema is not accepted |
| Google OAuth client and Apps Script mail permission activation | Google project/script owner | A Web client ID and new `MailApp` scope require provider-owner interaction before the approved roster can be safely activated |
| Chetan editor sharing | Verified Google account owner plus Drive sharing authority | The observed contact email is consistent, but Google identity ownership and permission remain an external gate |
| `Players_Specific_URLs` finance-link authority and owner | Priyesh/Chetan | Name/email account provisioning is approved; evidence still does not establish whether `Finance Sheet ID` may drive D1 `finance_url` values |
| Member-portal sheet inventory and designated authority | Priyesh/Chetan | Exact approved sources are not yet established |
| Public constitution, privacy notice and contact route | Committee/legal content owner | No approved text or public contact endpoint is available; the release candidate shows an honest unavailable/committee state |
| Donation provider and current sponsorship availability | Committee/finance owner | No approved provider, payment destination, contact action or current package confirmation may be invented |
| Verified sponsor logos and further gallery media | Committee publication owner | Only approved local media is published; further names, logos and images require content and consent verification |

## Maintenance and provenance

Update this register when a package completes, a source/tab/configuration concept changes, an owner approves a business rule, or an unresolved gate is closed. Each update should state the evidence source and date without copying sensitive rows or values.

Current provenance: project source and docs, independently reviewed WP1-WP3 evidence, the 2026-08-21 recovery snapshot, clean release checks, aggregate-only production D1 verification, masked Cloudflare configuration read-back, signed Apps Script delivery evidence, real administrator/member UAT, and already-authorised connected Google Drive metadata/ranges. This register is a maintained project artifact, not a claim of permanent access to every historic conversation or external system.

## WP4 verified architecture and production state (2026-08-21)

- `DB_Leaderboards` is verified as the authoritative historical Hall of Fame source with exact columns `Category`, `Year`, `Winner`, `Score` and 54 records across the four existing public categories. It contains historical winners, not a live points/rank table.
- The approved automatic design is authoritative sheet -> hourly Worker validation -> atomic D1 last-known-valid snapshot -> public read-only API -> Hall of Fame page. A source outage or invalid row preserves the previous valid snapshot; configuration URLs and sync diagnostics are not public.
- The approved booking-output direction remains D1/outbox -> authenticated adapter -> existing `JGS Booking Management` `Bookings` and `Sync Log` tabs. Production uses leased claims, bounded retries, HMAC-signed envelopes without transmitting the static secret, strict output fields, formula-safe text, monotonic booking versions, and idempotent log handling.
- Hourly Worker tasks are independent so fixture, leaderboard, and pending booking-output reconciliation cannot suppress one another.
- Remote migrations, scheduled Worker, Pages Functions and Apps Script Version 2 are deployed. Both genuine registered bookings are projected, with two sent and no failed or open outbox items. A controlled scheduled audit delivered both items with no alert, and the Worker is restored to its minute-7 hourly trigger.

WP4 privacy and operations decisions are implemented as recorded below: the restricted projection includes member name/email, dietary and arbitrary preferences remain off, orphans are flag-only, and the delivery threshold is three attempts or fifteen unresolved minutes. Provider-held secret values remain undisclosed. If a future "live leaderboard" means current points/ranks rather than historical winners, a separate authoritative schema/source decision remains required.

## WP4 owner decisions recorded 2026-07-29

- The approved booking output includes member name and email for operational administration in the existing restricted `JGS Booking Management` workbook. Dietary requirements and arbitrary preferences remain off.
- Existing non-managed/manual cells are preserved. Managed-column formulas are treated as collisions; no row is deleted. Orphaned or conflicting rows are recorded in `Sync Log` for human review.
- Chetan is the primary failed-delivery owner and Priyesh is backup. Existing logs/admin status record an alert after three attempts or fifteen unresolved minutes; no unconfigured email delivery is introduced.
- WP4 leaderboards mean the verified historical Hall of Fame. Current points/ranks are backlog pending a separately approved authoritative source.
- Google Apps Script authorization/deployment and private provider configuration completed on 2026-08-21. Secret values and private endpoint identifiers remain outside source, chat and evidence reports. See `WP4_GOOGLE_CLOUDFLARE_SETUP.md` for the maintained procedure.

## Fixture booking-window input decision (2026-07-29)

The primary operator format is strict UK calendar date `DD/MM/YYYY` (with leading zeroes); ISO `YYYY-MM-DD` is also accepted. Registration opening normalizes to the start of that Europe/London day; registration and cancellation closing normalize to the end of that day. Explicit timezone-bearing ISO timestamps remain supported. US month-first dates, single-digit slash dates, natural-language dates and timezone-less date-times are rejected. Strict normalized ordering and fail-closed publication remain mandatory. The approved typed Google CSV view was last verified on 29 July 2026 to emit the current Sheet dates as strict `DD/MM/YYYY`; any future format drift will fail closed rather than be guessed.

## 2026-08-21 local release-candidate decisions

- The recovered work is preserved on `codex/jaguar-finish-2026-08-21`; the latest `origin/main` content-only changes were reconciled without replacing the secure-booking implementation.
- Pages packaging must run from the project root so `dist/` and root `functions/` are uploaded together. A deployment that serves SPA HTML from `/api/...` fails acceptance.
- Deployment helpers are dry-run by default. Preview requires an explicit `--deploy`; production additionally requires `--approve-production`. These switches do not replace Priyesh's external-gate approval.
- Production dependencies and the local build toolchain were updated within the verified React/Vite/Tailwind architecture; the clean lockfile audit reports zero known vulnerabilities.
- Protected workbook URLs are accepted only from the five named server settings and only when they are Google Sheets document URLs. They are returned after administrator authorization, with member and unauthenticated non-disclosure enforced by tests.
- Public legal/contact, donation, sponsorship, sponsor-logo and additional-gallery content remains explicitly gated as listed above. No provider, recipient, legal wording, organisation or consent is inferred.
- After explicit approval, the release was deployed from clean `main`; runtime change `21bfd6b` and helper-only follow-up `bdac599` are pushed. Production `APP_ORIGIN` was changed only after the attached custom hostname was verified, and a fresh provider configuration read-back confirmed persistence.
- Real shared-administrator and ordinary-member acceptance passed on the custom production origin. Booking registration/cancellation mutations were deliberately not performed by the release operator during member acceptance; a second genuine member-created booking observed during the release window was preserved as live production data.
- A scheduled run exposed a mismatched Worker integration secret. After explicit user approval, one new high-entropy value was rotated through Apps Script, Pages and Worker using masked/provider-held controls. The controlled replay succeeded with two deliveries, zero failures and zero alerts; secret values and private identifiers were never added to source or this register.
