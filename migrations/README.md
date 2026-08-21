# D1 migrations

`0001_secure_booking.sql` is additive: it creates the account, session, event,
booking, audit, sync, and integration-outbox tables without modifying existing
website data.

`0002_operational_admin_username.sql` adds the fixed shared-admin username and
its supporting uniqueness rule without creating an account or changing a
password.

`0003_wp4_outputs.sql` adds leased booking-output delivery fields plus the
atomic historical Hall of Fame generation tables. It does not backfill
bookings, dietary choices or leaderboard rows.

Production procedure:

1. Export the target D1 database.
2. Record the active deployment commit.
3. From a clean release copy, apply all migrations to an empty local D1
   database and inspect the resulting schema.
4. Apply only the pending migration list to a separate preview/test database.
5. Run the API and browser acceptance suite, including Pages Functions JSON
   route checks.
6. Record `wrangler d1 migrations list` and a rollback timestamp.
7. Apply the reviewed pending migrations to production only after the external
   gate is approved.

Rollback disables the booking UI and API routes and restores the previous
deployment. The new tables should be retained for audit/export. If physical
removal is later required, export the database first and apply a separately
reviewed down migration; destructive `DROP TABLE` statements are intentionally
not included here.

Provider database identifiers and export locations belong in masked/provider
controls and the private deployment record, never in Git, chat or this guide.
