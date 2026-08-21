# Event-booking risk register

| ID | Risk | Likelihood | Impact | Mitigation | Release status |
|---|---|---:|---:|---|---|
| R1 | Incorrect member-to-email migration lets the wrong person access an account | Medium | Critical | Authorised roster only; disabled-by-default import; committee verification; audit log | Roster confirmed: 56 members; production import pending |
| R2 | Duplicate or concurrent requests create multiple active bookings | Medium | Critical | Unique member/event constraint; versioned writes; idempotency keys; concurrency tests | Mitigated locally: concurrent test passed |
| R3 | Client-side tampering changes another member’s booking | Medium | Critical | Server derives member from session; ownership predicates; forged-request tests | Mitigated locally: role/forgery tests passed |
| R4 | Wrong event timezone or deadline accepts/rejects a valid booking | Medium | High | ISO timestamps; IANA timezone; backend checks; boundary tests; admin display | Open: September values required |
| R5 | Spreadsheet is unavailable or rejects a booking update | Medium | High | D1 canonical state; durable outbox; explicit `{ok:true}` acknowledgement; retries; admin-visible error | Adapter deployment required |
| R6 | Spreadsheet retries create duplicate operational rows | Medium | High | Stable member/event IDs, booking versions, idempotency key and Apps Script locking | Adapter deployment required |
| R7 | Existing public attendee or balance data leaks personal information | High | High | Remove attendee details from member payloads; replace shared balance table with self-only finance link | Mitigated locally; production roster/links pending |
| R8 | First administrator cannot be provisioned safely | Medium | High | One-time bootstrap secret; endpoint disables itself after first member; rotate/remove secret | Config required |
| R9 | D1 migration or deployment disrupts the existing public site | Low | High | Additive migration; preview first; backup/export; recorded commit; UI feature cutover separate | Open |
| R10 | Legacy sync overwrites configured booking windows | Medium | High | Explicit optional source fields; preserve configured values when source omits them; idempotency tests | Mitigated locally: rerun test passed |
| R11 | Authentication brute force or stolen session | Medium | High | PBKDF2, login throttling, HttpOnly/Secure/SameSite cookie, expiry, logout revocation | Mitigated locally; production HTTPS validation pending |
| R12 | Lack of production D1 authority prevents activation | High | High | Complete local implementation/mocks; document exact binding and migration steps | Blocker |
| R13 | Existing unrelated functionality regresses | Medium | Medium | Baseline screenshots/build; route smoke tests; final lint/build/browser checks | Lint, test, build and API checks passed; user accepted preview; automated browser rerun blocked by Windows sandbox |
| R14 | Members are confused during Google Form cutover | Medium | Medium | Single website CTA; clear status; staged September pilot; documented rollback | Open |
