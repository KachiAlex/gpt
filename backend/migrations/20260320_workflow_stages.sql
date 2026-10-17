-- Configurable review workflow.
-- workflow_stages: ordered chain of review stages per deployment; each stage
-- declares which roles may move a submission INTO it. submissions.stage tracks
-- the position; submissions.status remains the coarse outcome for pills/filters.
-- is_system stages cannot be deleted; maps_to_status ties a stage back to the
-- existing submission_status enum; is_terminal marks chain ends.

CREATE TABLE IF NOT EXISTS workflow_stages (
  key            TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  order_index    INT NOT NULL,
  allowed_roles  TEXT[] NOT NULL DEFAULT '{}',
  maps_to_status submission_status,
  is_terminal    BOOLEAN NOT NULL DEFAULT FALSE,
  is_system      BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO workflow_stages (key, label, order_index, allowed_roles, maps_to_status, is_terminal, is_system) VALUES
  ('DRAFT',        'Draft',         0, '{CONTRACTOR}',                          'PENDING',      FALSE, TRUE),
  ('SUBMITTED',    'Submitted',     1, '{CONTRACTOR}',                          'PENDING',      FALSE, TRUE),
  ('UNDER_REVIEW', 'Under review',  2, '{ME_OFFICER,GOVERNMENT_ADMIN}',         'UNDER_REVIEW', FALSE, FALSE),
  ('APPROVED',     'Approved',      3, '{ME_OFFICER,GOVERNMENT_ADMIN}',         'APPROVED',     TRUE,  TRUE),
  ('REJECTED',     'Rejected',      4, '{ME_OFFICER,GOVERNMENT_ADMIN}',         'REJECTED',     TRUE,  TRUE)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS submission_stage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  from_stage    TEXT,
  to_stage      TEXT NOT NULL,
  action        TEXT NOT NULL DEFAULT 'advance',
  actor_id      UUID REFERENCES users(id),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_submission ON submission_stage_history(submission_id);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS stage TEXT REFERENCES workflow_stages(key);

-- Backfill from existing status values
UPDATE submissions SET stage = CASE status
  WHEN 'PENDING' THEN 'SUBMITTED'
  WHEN 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
  WHEN 'APPROVED' THEN 'APPROVED'
  WHEN 'REJECTED' THEN 'REJECTED'
  WHEN 'FLAGGED' THEN 'UNDER_REVIEW'
  WHEN 'REQUIRES_CLARIFICATION' THEN 'UNDER_REVIEW'
  ELSE 'SUBMITTED'
END WHERE stage IS NULL;

ALTER TABLE submissions ALTER COLUMN stage SET DEFAULT 'SUBMITTED';
ALTER TABLE submissions ALTER COLUMN stage SET NOT NULL;
