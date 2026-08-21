# WP5 administrator dashboard source inventory

This is the discovery inventory for the WP5 administrator dashboard and handover guide. It is governed by the [Project delivery and orchestration charter](./PROJECT_DELIVERY_CHARTER.md) and should be read with the [source and decision register](./SOURCE_AND_DECISION_REGISTER.md).

No workbook is made authoritative merely by appearing here. Links are surfaced only after their role, owner, sharing scope, and data direction are verified. Restricted links must be delivered only to authenticated administrators, opened as safe external links, and never embedded in public pages or exposed through member-facing APIs.

## Verified inventory

| Dashboard label | Workbook / tab | Verified purpose and schema | Data classification | Authority and direction | WP5 treatment | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fixture source | `Jaguar_Golf_Society_QA_Compliance_Matrix` / `DB_Fixtures` | Twelve fixture records and exact booking-window fields | Committee operational data | Authoritative fixture source → validation/sync → D1/website | Admin-only link plus last-sync/failure summary | Verified |
| Historical leaderboards | `Jaguar_Golf_Society_QA_Compliance_Matrix` / `DB_Leaderboards` | Category, year, winner, score | Committee/public-results data | Designated historical Hall of Fame source; booking-independent | Admin-only source link plus last-sync/failure summary | Verified and implemented locally |
| Payments and balances | `JGS_Members_Balance` / `Sheet1` | Member balance and reconciliation context | Restricted financial/member data | Authoritative balance input → read-only member balance view | Restricted admin-only link and reconciliation guidance | Verified |
| Booking output | `JGS Booking Management` / `Bookings` | Stable booking/event/member IDs, current status, preferences, timestamps, idempotency, sync state and version | Restricted booking/member data | D1 canonical booking → authenticated operational projection | Restricted admin-only link plus delivery status/errors | Adapter and dashboard implemented locally; external setup gated |
| Booking sync log | `JGS Booking Management` / `Sync Log` | Run/type/status/timestamps/count/error/trigger columns | Restricted operational data | Integration outcome log; never canonical booking state | Restricted admin-only link or workbook-section link | Recovery/status view implemented locally; external setup gated |
| Member finance-link directory | `Players_Specific_URLs` / `Sheet1` | `Member`, device `Type`, `E-mail`, and per-member `Finance Sheet ID` link | Highly restricted member PII and personal-finance links | Dashboard information source approved; whether it drives D1 `finance_url` or remains reference-only is not yet evidenced | Label “Member finance links (restricted)”; authenticated-admin-only safe external link; never embed or expose rows/client-side | Verified structure; authority/owner decision pending |
| Other member-portal sources | Not yet confirmed | Exact sources and roles remain unknown | Presume restricted until classified | No authority assigned | Do not add speculative links | Human gate |

## Restricted-link acceptance rules

- Link visibility is enforced server-side by the existing administrator role, not only hidden in the UI.
- Do not put restricted workbook URLs, member rows, or per-member finance links into public assets, page source, unauthenticated APIs, logs, or analytics.
- Open external Google links in a new tab with `noopener` and `noreferrer`; do not embed Google editing surfaces.
- The dashboard shows source purpose, owner, data direction, last verified/sync state, and plain-English use instructions without reproducing sensitive rows.
- D1 remains canonical for accounts and website bookings. A member-specific finance link may be copied or synchronised into that member’s D1 record only after the committee explicitly designates the source and approves identity matching; never match solely by display name.

## Decisions still required for `Players_Specific_URLs`

1. Confirm whether it is the authoritative source for each member’s personal finance-link mapping or a committee reference directory only.
2. Confirm the operational owner/maintainer and review cadence.
3. If it becomes authoritative, approve a stable member-identity key and one-way import/reconciliation design before any automation; names and email addresses alone are insufficient for silent account updates.

Last verified read-only on 2026-07-29 from connected Google Sheets metadata and bounded `A1:T10` values. The workbook was not edited, shared, exported, or deployed.

## Local dashboard implementation (2026-08-21)

The protected `Operations` administrator section now presents source purpose, owner, direction, classification, last review/sync status, recovery instructions, routine checks and escalation. It receives links only from these server settings:

- `FIXTURES_WORKBOOK_URL`
- `LEADERBOARDS_WORKBOOK_URL`
- `MEMBER_BALANCES_WORKBOOK_URL`
- `BOOKING_MANAGEMENT_WORKBOOK_URL`
- `MEMBER_FINANCE_LINKS_WORKBOOK_URL`

Only `https://docs.google.com/spreadsheets/d/...` values are accepted. Missing or invalid values produce an unavailable state, not a guessed link. Links use `noopener noreferrer` and a no-referrer policy. API tests prove unauthenticated users receive `401`, members receive `403`, neither response discloses a workbook link, and an administrator response is marked `no-store`. Unresolved owners remain explicitly unresolved. See [Operations handover](./OPERATIONS_HANDOVER.md) for the committee workflow.
