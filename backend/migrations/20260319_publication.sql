-- Publication boundary: projects are internal-only until explicitly published.
-- Grandfather existing rows: anything already public stays public and is
-- stamped with its creation time as the publish moment.

ALTER TABLE projects ALTER COLUMN is_public SET DEFAULT FALSE;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id);

UPDATE projects SET published_at = created_at WHERE is_public = TRUE AND published_at IS NULL;
