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
| `Jaguar_Golf_Society_QA_Compliance_Matrix` -> `DB_Fixtures` | Master fixture source, including status and strict UK/ISO booking-window fields | Sheet -> validated fixture sync -> D1/website; webhook is only an authenticated refresh signal | `MASTER_FIXTURES_CSV_URL`; approved 12-ID roster in `EXPECTED_FIXTURE_IDS` | 2026-07-29: tab present; 12 fixtures; WP1 immediate and hourly sync complete |
| `Jaguar_Golf_Society_QA_Compliance_Matrix` -> `DB_Leaderboards` | Existing historical leaderboard source | Designated leaderboard source for later WP4 validation; not booking state | Connected Drive workbook; link is surfaced admin-only in WP5 when an approved URL is configured | 2026-08-21: local WP4/WP5 implementation and disclosure tests complete |
| `JGS_Members_Balance` -> `Sheet1` | Member payment/balance reconciliation source maintained operationally | Sheet -> read-only balance reconciliation in the website; never account credentials | `MEMBER_BALANCES_CSV_URL` | 2026-07-29: workbook/tab and Chetan balance row verified |
| `JGS Booking Management` -> `Bookings` | Approved WP4 operational booking-output projection | D1/website -> authenticated idempotent upsert into sheet; D1 remains canonical | Future `BOOKING_SYNC_WEBHOOK_URL` plus provider-managed `BOOKING_SYNC_TOKEN`; direct link remains admin-only | 2026-08-21: adapter, retry, privacy and packaging complete locally; external deployment remains gated |
| `JGS Booking Management` -> `Sync Log` | Approved WP4 operational delivery log | Integration run outcomes append to sheet; failures must not delete valid D1 or sheet rows | Same future booking-output adapter | 2026-08-21: local idempotency and recovery checks complete |
| `JGS Booking Management` -> `README` / `Event Config` | Committee operating notes and workbook context | Reference/projection only; fixture authority remains `DB_Fixtures` | Connected Drive workbook | 2026-07-29: both tabs present; existing notes already state committee-only access and stable IDs |
| Legacy Google Form responses and `Live_Entry_List` | Historical/legacy operational evidence only | Not an input to new canonical booking state | Connected Drive; do not wire into WP3/WP4 booking writes | 2026-07-29: named sources inspected read-only |
| `Players_Specific_URLs` -> `Sheet1` | Restricted member finance-link directory for the WP5 dashboard | Dashboard information source approved; authority over D1 `finance_url` mappings is not yet assigned | Connected Drive workbook; admin-only link/configuration, never public or embedded | 2026-08-21: protected dashboard treatment implemented locally; authority remains unresolved |
| Other member-portal operational sheets | WP5 dashboard/guide category | Authority not yet assigned | Exact approved sources still to be inventoried and confirmed | Unresolved |

## Account and role model

| Semantic identity | Role and purpose | Verified state |
| --- | --- | --- |
| Priyesh personal account | Ordinary member identity for booking acceptance testing; not a website administrator | Active member; existing identity/password preserved and prior sessions revoked |
| Shared operational administrator (`admin`) | Sole website administrator for routine committee administration | Active; password remains private/provider-safe |
| Members | Individual personal booking identities; may manage only their own booking | Production member roster/onboarding not yet authorised |
| Chetan Patel | Operational spreadsheet maintainer and intended shared-admin user | A single consistent contact email exists in approved project/Drive evidence; Google account ownership must still be confirmed before editor sharing |

## Confirmed decisions

- WP1 fixture foundation is complete: canonical spreadsheet re-read, validation, immediate Apps Script refresh notification, hourly reconciliation, and twelve-fixture accounting.
- WP2 operational authentication is complete: shared `admin` is the sole website administrator; Priyesh's existing personal account is an active member.
- WP3 fail-closed security code was independently reviewed, deployed to production, and verified on 2026-07-29. The 2026-08-21 local candidate adds one exact required dietary choice, `Veg` or `Non-veg`, with no default and the same validation for member booking and administrator correction. This new candidate has not been deployed.
- All production fixtures remain unbookable until exact authoritative registration-open, registration-close, and cancellation-close timestamps are present and valid.
- Spreadsheet-maintained fixtures are read-only in the website administrator UI; source corrections belong in `DB_Fixtures`.
- `JGS Booking Management` is the approved WP4 booking-output destination. Its existing `Bookings` and `Sync Log` tabs must be reused rather than recreated.
- D1 remains canonical for accounts and bookings; booking-output spreadsheets are operational projections, not competing edit surfaces.
- The current stable authentication origin remains the existing Pages production host. Custom-domain origin/redirect changes are outside the approved WP3 deployment.
- WP5 locally delivers an admin-only source dashboard and plain-English operations guide with source ownership, approved server-supplied links, sync/error meaning, and a source -> sync -> website -> outputs flow.
- `Players_Specific_URLs` is an approved WP5 dashboard-linked information source, but its link and contents are restricted to authenticated administrators; its D1 mapping authority remains unresolved.

## Unresolved business and external-authority gates

| Gate | Required owner/authority | Why it cannot be inferred |
| --- | --- | --- |
| Exact fixture registration and cancellation timestamps | Chetan or committee owner | Booking-critical business times must never be invented |
| Capacity behavior: unlimited, hard cap, or waitlist | Committee decision | Current importer does not enforce `Capacity` |
| Non-empty `BookingFields` contract | Committee plus implementation review | Current UI/server supports only the approved basic fields; arbitrary business schema is not accepted |
| Production member roster, onboarding, and one real acceptance identity | Priyesh/Chetan with member authority | No fake production members or bookings |
| Booking-output webhook deployment/authorization and provider-managed secret | Google/Cloudflare owner during WP4 | External authorization and private credential entry are required |
| Chetan editor sharing | Verified Google account owner plus Drive sharing authority | The observed contact email is consistent, but Google identity ownership and permission remain an external gate |
| `Players_Specific_URLs` authority and owner | Priyesh/Chetan | Structure is verified, but evidence does not establish whether it drives D1 `finance_url` values or is reference-only; stable identity matching is also unapproved |
| Member-portal sheet inventory and designated authority | Priyesh/Chetan | Exact approved sources are not yet established |
| Real administrator/member acceptance and WP4/WP5 production sign-off | Committee acceptance owner | Automated local mobile, keyboard-semantic, role and journey checks are complete; real identities and committee acceptance still require the external preview gate |
| Public constitution, privacy notice and contact route | Committee/legal content owner | No approved text or public contact endpoint is available; the release candidate shows an honest unavailable/committee state |
| Donation provider and current sponsorship availability | Committee/finance owner | No approved provider, payment destination, contact action or current package confirmation may be invented |
| Verified sponsor logos and further gallery media | Committee publication owner | Only approved local media is published; further names, logos and images require content and consent verification |

## Maintenance and provenance

Update this register when a package completes, a source/tab/configuration concept changes, an owner approves a business rule, or an unresolved gate is closed. Each update should state the evidence source and date without copying sensitive rows or values.

Current provenance: project source and docs, independently reviewed WP1-WP3 evidence, the 2026-08-21 recovery snapshot and clean local release-candidate checks, prior read-only production D1 counts, Cloudflare configuration names, and already-authorised connected Google Drive metadata/ranges inspected on 2026-07-29. This register is a maintained project artifact, not a claim of permanent access to every historic conversation or external system.

## WP4 verified architecture and current local state (2026-07-29)

- `DB_Leaderboards` is verified as the authoritative historical Hall of Fame source with exact columns `Category`, `Year`, `Winner`, `Score` and 54 records across the four existing public categories. It contains historical winners, not a live points/rank table.
- The approved automatic design is authoritative sheet -> hourly Worker validation -> atomic D1 last-known-valid snapshot -> public read-only API -> Hall of Fame page. A source outage or invalid row preserves the previous valid snapshot; configuration URLs and sync diagnostics are not public.
- The approved booking-output direction remains D1/outbox -> authenticated adapter -> existing `JGS Booking Management` `Bookings` and `Sync Log` tabs. Local WP4 code now uses leased claims, bounded retries, HMAC-signed envelopes without transmitting the static secret, strict output fields, formula-safe text, monotonic booking versions, and idempotent log handling.
- Hourly Worker tasks are independent so fixture, leaderboard, and pending booking-output reconciliation cannot suppress one another.
- Local implementation, isolated D1 migrations, API smoke, browser journeys and Pages Functions packaging are complete. No remote WP4 migration, Worker/Pages deployment, Google Apps Script deployment, sheet write, sharing change, production account change, or production booking change occurred during the 2026-08-21 recovery.

WP4 privacy and operations decisions are implemented as recorded below: the restricted projection includes member name/email, dietary and arbitrary preferences remain off, orphans are flag-only, and the delivery threshold is three attempts or fifteen unresolved minutes. Google/Cloudflare owners must still authorize the bound Apps Script and enter the shared secret privately. If a future "live leaderboard" means current points/ranks rather than historical winners, a separate authoritative schema/source decision remains required.

## WP4 owner decisions recorded 2026-07-29

- The approved booking output includes member name and email for operational administration in the existing restricted `JGS Booking Management` workbook. Dietary requirements and arbitrary preferences remain off.
- Existing non-managed/manual cells are preserved. Managed-column formulas are treated as collisions; no row is deleted. Orphaned or conflicting rows are recorded in `Sync Log` for human review.
- Chetan is the primary failed-delivery owner and Priyesh is backup. Existing logs/admin status record an alert after three attempts or fifteen unresolved minutes; no unconfigured email delivery is introduced.
- WP4 leaderboards mean the verified historical Hall of Fame. Current points/ranks are backlog pending a separately approved authoritative source.
- The unavoidable remaining external gate is Google Apps Script authorization/deployment plus private entry of the HMAC secret and web-app URL into Cloudflare. See `WP4_GOOGLE_CLOUDFLARE_SETUP.md`.

## Fixture booking-window input decision (2026-07-29)

The primary operator format is strict UK calendar date `DD/MM/YYYY` (with leading zeroes); ISO `YYYY-MM-DD` is also accepted. Registration opening normalizes to the start of that Europe/London day; registration and cancellation closing normalize to the end of that day. Explicit timezone-bearing ISO timestamps remain supported. US month-first dates, single-digit slash dates, natural-language dates and timezone-less date-times are rejected. Strict normalized ordering and fail-closed publication remain mandatory. The approved typed Google CSV view was last verified on 29 July 2026 to emit the current Sheet dates as strict `DD/MM/YYYY`; any future format drift will fail closed rather than be guessed.

## 2026-08-21 local release-candidate decisions

- The recovered work is preserved on `codex/jaguar-finish-2026-08-21`; the latest `origin/main` content-only changes were reconciled without replacing the secure-booking implementation.
- Pages packaging must run from the project root so `dist/` and root `functions/` are uploaded together. A deployment that serves SPA HTML from `/api/...` fails acceptance.
- Deployment helpers are dry-run by default. Preview requires an explicit `--deploy`; production additionally requires `--approve-production`. These switches do not replace Priyesh's external-gate approval.
- Production dependencies and the local build toolchain were updated within the verified React/Vite/Tailwind architecture; the clean lockfile audit reports zero known vulnerabilities.
- Protected workbook URLs are accepted only from the five named server settings and only when they are Google Sheets document URLs. They are returned after administrator authorization, with member and unauthenticated non-disclosure enforced by tests.
- Public legal/contact, donation, sponsorship, sponsor-logo and additional-gallery content remains explicitly gated as listed above. No provider, recipient, legal wording, organisation or consent is inferred.
