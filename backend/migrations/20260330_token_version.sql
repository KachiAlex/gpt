-- Bumps on logout/password change so outstanding JWTs for the account die
-- server-side instead of living out the 7-day lifetime.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
