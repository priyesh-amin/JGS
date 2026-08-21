# Spreadsheet integration contract

## Fixture input

Source: the established `DB_Fixtures` CSV export.

Required columns:

| Sheet column | Application field | Rule |
|---|---|---|
| `ID` | `events.id`, `source_key` | Stable, unique and never display-name-derived |
| `Event` | `title` | Required |
| `Venue` | `venue` | Required |
| `Date` | `event_date` | `D MMM YYYY` or `DD MMM YYYY` |
| `Status` | `status` | `Draft`, `Open/Published`, `Closed`, `Completed` |

Existing optional columns remain supported: `MeetTime`, `TeeTime`, `Cost`, and
`Details`.

New optional columns:

| Sheet column | Application field | Format |
|---|---|---|
| `PublicationAt` | `publication_at` | ISO-8601 timestamp with offset |
| `RegistrationOpensAt` | `registration_opens_at` | `DD/MM/YYYY` or `YYYY-MM-DD` (Europe/London start of day), or ISO-8601 timestamp with offset |
| `RegistrationClosesAt` | `registration_closes_at` | `DD/MM/YYYY` or `YYYY-MM-DD` (Europe/London end of day), or ISO-8601 timestamp with offset |
| `CancellationClosesAt` | `cancellation_closes_at` | `DD/MM/YYYY` or `YYYY-MM-DD` (Europe/London end of day), or ISO-8601 timestamp with offset |
| `Timezone` | `timezone` | IANA name, normally `Europe/London` |
| `JoiningInformation` | `joining_information` | Plain text |
| `BookingFields` | `booking_fields_json` | JSON object |

The canonical sheet is authoritative. Optional values that are absent or blank
remain null in D1; previous administrator-entered booking windows are not treated
as a competing source. Registration and cancellation therefore fail closed until
valid source dates or timestamps are supplied. Booking-window dates may use
strict `DD/MM/YYYY` or `YYYY-MM-DD`; exact date-times must be ISO-8601 with an
explicit `Z` or numeric UTC offset. `Deadline` display text is never converted
into a booking-critical timestamp.

### Date-only booking windows

Committee maintainers may enter booking-window values as strict UK calendar dates in `DD/MM/YYYY` form (the primary operator format, with leading zeroes) or ISO calendar dates in `YYYY-MM-DD` form. `RegistrationOpensAt` becomes 00:00 at the start of that Europe/London day. `RegistrationClosesAt` and `CancellationClosesAt` become 23:59:59.999 at the end of that Europe/London day, including British Summer Time changes. Explicit ISO-8601 timestamps with `Z` or a numeric offset remain supported when a precise time is genuinely required.

Strict `29/07/2026` is accepted. Values such as `7/29/2026`, `29 Jul 2026`, single-digit slash dates, or a date-time without `Z`/offset are rejected rather than guessed. Date-only cancellation must be on a later calendar day than date-only registration close; normalized instants must always be strictly ordered. Invalid or missing values keep the fixture unbookable and may force it to draft.
## Booking output webhook

The configured HTTPS Apps Script endpoint receives a signed JSON envelope:

- `timestamp` and one-time `nonce`;
- `signature`: HMAC-SHA256 over `timestamp + "." + nonce + "." + message`;
- `message`: the canonical schema-versioned booking projection.

The static `BOOKING_SYNC_TOKEN` is stored only as an encrypted Cloudflare secret and a Google Apps Script Script Property. It is never included in the request. The adapter rejects stale, malformed, oversized, or incorrectly signed envelopes before parsing the inner message.

The inner message contains only allowlisted booking, member, event, and operational fields. It excludes passwords, sessions, free-form preference objects, and credentials. Spreadsheet formula prefixes are neutralised. Dietary requirements default to omitted unless the committee explicitly approves their operational need, restricted access, and retention.

The endpoint must:

1. verify the HMAC envelope and freshness;
2. upsert by stable booking/member/event identity;
3. treat the idempotency key as a durable duplicate acknowledgement;
4. reject stale or conflicting booking versions;
5. update the same operational row on cancellation;
6. append at most one `Sync Log` record per idempotency key; and
7. return `{ "ok": true }` only after the durable projection/log state is established.

D1 remains canonical. The sheet never writes bookings back to D1, and reconciliation must not automatically delete unmatched sheet rows.
