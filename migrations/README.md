# D1 migrations

`0001_secure_booking.sql` is additive: it creates the account, session, event,
booking, audit, sync, and integration-outbox tables without modifying existing
website data.

Production procedure:

1. Export the target D1 database.
2. Record the active deployment commit.
3. Apply the migration to a preview/test database.
4. Run the API and browser acceptance suite.
5. Apply the migration to production.

Rollback disables the booking UI and API routes and restores the previous
deployment. The new tables should be retained for audit/export. If physical
removal is later required, export the database first and apply a separately
reviewed down migration; destructive `DROP TABLE` statements are intentionally
not included here.

