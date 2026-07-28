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
| `RegistrationOpensAt` | `registration_opens_at` | ISO-8601 timestamp with offset |
| `RegistrationClosesAt` | `registration_closes_at` | ISO-8601 timestamp with offset |
| `CancellationClosesAt` | `cancellation_closes_at` | ISO-8601 timestamp with offset |
| `Timezone` | `timezone` | IANA name, normally `Europe/London` |
| `JoiningInformation` | `joining_information` | Plain text |
| `BookingFields` | `booking_fields_json` | JSON object |

If a new optional column is absent or blank, synchronisation preserves an
existing configured value. It does not guess a deadline or erase a valid
configuration.

## Booking output webhook

The configured endpoint receives `POST` JSON with:

- `Authorization: Bearer <BOOKING_SYNC_TOKEN>`
- `webhookToken` in the HTTPS JSON body for the Google Apps Script adapter,
  because Apps Script web apps do not expose arbitrary request headers;
- `Idempotency-Key: <stable booking/version key>`
- `schemaVersion`
- `eventType`
- `idempotencyKey`
- `booking`: canonical state and version
- `member`: stable ID, email, display name
- `event`: stable ID, title, date
- `operational`: status, buggy, dietary, and configured preference fields

The endpoint must:

1. authenticate the bearer token;
2. upsert by stable member ID and event ID;
3. store and deduplicate the idempotency key;
4. update the canonical operational row on cancellation rather than append a
   second active row;
5. return JSON `{ "ok": true }` only after the update is durable. A 2xx
   response containing `{ "ok": false }` remains a retryable failure.

Form URLs and Google Form response rows are not inputs to the new booking state.
