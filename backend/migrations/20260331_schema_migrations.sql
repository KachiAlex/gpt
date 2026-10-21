-- DB-side record of applied migrations. The host ledger file
-- (.migrations-applied) is the apply-order source of truth during deploys;
-- this table mirrors it so the database itself knows its own history —
-- critical after restores or when the ledger is lost.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
