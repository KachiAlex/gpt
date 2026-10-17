-- TOTP two-factor authentication.
-- totp_secret holds the pending or active secret; totp_enabled flips only
-- after the user proves possession of the secret with a valid code.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
