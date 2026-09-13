# Reconciliation implementation — 13 September 2026

## Delivered in this branch

A pure, inactive foundation for the proposed reconciliation service. No routes, live writes, schema migrations, member screens, or changes to the existing balance source.

- Integer-pence account calculations: due now, upcoming charges, available credit, and itemised outstanding charges.
- Explicit allocation validation: stable IDs, member ownership, posted-only entries, no double spending, no automatic choice of allocation policy.
- Strict synthetic CSV reader and import preview: exact member-reference suggestions, account-scoped duplicate detection, changed-ID conflicts, unassigned receipts and outgoing-payment review.
- Original source cells retained in preview, category counts/amounts, supplied coverage distinguished from verified coverage. Preview never posts or declares a period reconciled.
- Synthetic bank fixture and executable tests. These records are invented.

Run `node --test tests/reconciliation-foundation.test.js`.

## Contracts and limits

`accountStatement` consumes an effective projection of posted charges and confirmed funds for ONE member, plus explicit allocations. It does not implement the durable accounting journal, refunds, reversals, reserved credit or opening-balance migration. The future authenticated server adapter must enforce access and derive the member ID from the session. Input validation here is not authentication.

`previewSyntheticImport` accepts ONLY the documented synthetic columns, ISO dates, signed decimal GBP amounts and a required transaction ID. It is not the bank adapter. Existing rows must be trusted normalised bank records supplied by a future server adapter. Member references match the entire trimmed, uppercased field; payer names are not automatically matched. All matches remain suggestions. A conflict quarantines every affected occurrence in the incoming file. Missing transaction IDs are rejected pending a validated fallback strategy.

Coverage dates are supplied, not independently verified. A preview is neither receipt posting nor whole-bank reconciliation. No sensitive real bank export belongs in Git.

## Next implementation slices

1. Confirm CSV schema, ID stability using overlapping exports, account and coverage evidence with Chetan.
2. Confirm event charge trigger, due date, allocation/cancellation/guest rules, freshness and opening cutoff. User authorised foundation work; these business decisions remain open.
3. Add append-only persisted journal, linked reversals, durable bank evidence, split receipt assignments and atomic/idempotent posting with database constraints and audit records.
4. Add authenticated admin preview/review/confirm workflow and private member statement routes, plus phone-friendly screens and permission tests.
5. Shadow-compare with Chetan's records, sign off opening balances, demonstrate recovery and activate separately.

The existing website-managed `member_balances` remains in use. Do not feed preview results into it or run automatic booking/reminder actions. This branch is a reviewable start, not a production-ready finance release.
