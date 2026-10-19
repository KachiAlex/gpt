-- Per-user UI preferences (theme, language, notification toggles) — the
-- Settings page already submits these; previously they were silently dropped.
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
