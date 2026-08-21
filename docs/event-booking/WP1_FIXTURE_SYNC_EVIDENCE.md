# Work Package 1: authoritative fixture synchronisation

## Accepted architecture

- `DB_Fixtures` is the sole fixture-detail authority.
- Google Apps Script sends only an authenticated refresh notification. Its
  payload contains no fixture details and the Cloudflare Worker does not read
  or trust the body.
- Every notification and hourly run re-fetches the approved canonical CSV,
  validates it, and writes only validated values to D1.
- `EXPECTED_FIXTURE_IDS` is the required non-secret allowlist for the approved
  12-fixture 2026 roster. Missing and unexpected IDs are therefore individually
  withheld and reported; malformed or incomplete allowlist configuration fails
  closed.
- Booking-critical values are never inferred from `Deadline` text. Strict UK
  `DD/MM/YYYY` and ISO `YYYY-MM-DD` dates use Europe/London day boundaries;
  explicit ISO timestamps must include `Z` or a numeric offset. Ambiguous,
  missing, timezone-less, or invalid values fail closed.
- A publication-critical failure with a stable ID preserves the last-known
  event details but forces the matching D1 event to `draft`.
- Each run records per-fixture classification, exact validation failures, and
  Chetan actions in `sync_runs.summary_json`. The administrator system view
  presents the recorded totals and action list.

## Classification rules

| Classification | Meaning | D1 safety behavior |
| --- | --- | --- |
| `bookable` | Valid fixture, exact registration window, and the current time is inside that window | Validated source fields are upserted |
| `temporarily_unbookable` | Valid public identity but booking is not currently available, including missing/external windows | Fixture may remain visible, but registration fails closed |
| `withheld` | Publication-critical data is absent/invalid, an ID is duplicated, or an expected fixture is missing | No unvalidated details are inserted; matching existing event is forced to `draft` |
| `historical_archived` | Event date is in the past or source status is `Completed` | Validated source fields are retained and D1 status is `completed` |

## Verified 2026 decision table

Validated read-only against the approved typed canonical CSV on 29 July 2026.
All 12 source rows have a stable ID, title, venue, and valid date. August
Monthly supplies valid strict UK booking-window dates; the other four future
fixtures do not yet supply complete valid windows.

| Fixture ID | Safe classification | Chetan action |
| --- | --- | --- |
| `season-opener-2026` | historical/archived | No action; source Status is `Completed` |
| `may-monthly-2026` | historical/archived | No action; source Status is `Completed` |
| `may-midweek-2026` | historical/archived | No action; source Status is `Completed` |
| `june-monthly-2026` | historical/archived | No action; source Status is `Completed` |
| `charity-day-2026` | historical/archived | No action; source Status is `Completed` |
| `july-monthly-2026` | historical/archived | No action; source Status is `Completed` |
| `july-midweek-2026` | historical/archived | No action; source Status is `Completed` |
| `aug-monthly-2026` | bookable | No validation action; the current strict UK dates pass |
| `aug-midweek-2026` | temporarily unbookable | Add approved strict dates or exact timezone-bearing timestamps before booking opens |
| `weekend-away-2026` | temporarily unbookable | Add approved strict dates or exact timezone-bearing timestamps before booking opens |
| `sept-monthly-2026` | temporarily unbookable | Add approved strict dates or exact timezone-bearing timestamps before booking opens |
| `season-finale-2026` | temporarily unbookable | Add approved strict dates or exact timezone-bearing timestamps before booking opens |

`Deadline` remains display/source context only. Chetan should supply
`CancellationClosesAt` as a strict date or exact timezone-bearing timestamp
where member cancellation is intended; a blank value keeps online cancellation
closed.

## Automated evidence

- A malicious webhook body containing fixture objects is ignored; the Worker
  imports only a separately fetched canonical CSV.
- The approved 12 IDs produce 12 individual decisions: seven historical, one
  bookable, and four temporarily unbookable on 29 July 2026.
- Missing, invalid, duplicate, and omitted expected fixtures remain
  individually recorded.
- Withheld records cannot overwrite last-known event details and force a
  matching record to `draft`.
- Missing registration and cancellation windows remain null; no dates are
  inferred.
- No production bookings, attendance, accounts, or credentials are created or
  changed by WP1 tests.

## Human gates

1. Chetan or the site owner must provide approved strict booking dates or exact
   timezone-bearing timestamps for the four remaining future fixtures before
   they can become bookable. They remain safely non-bookable until then.
2. The Apps Script notification trigger and hourly Cloudflare reconciliation
   are installed production safety paths; no further WP1 authorization gate
   remains.

## Later-package dependencies (not started)

- Member booking acceptance depends on approved valid fixture windows.
- Spreadsheet booking-delivery work depends on a separately authorized
  operational booking sheet and is outside WP1.
- Member-account rollout, finance balances, and member experience testing must
  use isolated/preview automation before any production member activity.

## Date-only operational policy

Booking windows accept strict UK `DD/MM/YYYY` (the primary operator format, with leading zeroes) and ISO `YYYY-MM-DD` values. Europe/London start-of-day is used for registration opening, and Europe/London end-of-day is used for registration and cancellation closing. Explicit timezone-bearing timestamps remain valid. US month-first dates, single-digit slash dates, natural-language dates and datetimes without an offset are rejected; invalid values preserve fail-closed behavior.
