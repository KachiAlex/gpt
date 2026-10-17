-- Financial reconciliation as an axis independent of physical progress
-- and publication. UNRECONCILED -> RECONCILED -> AUDITED, but all moves
-- are allowed (de-escalation matters when an audit is reopened).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS financial_status TEXT NOT NULL DEFAULT 'UNRECONCILED'
    CHECK (financial_status IN ('UNRECONCILED', 'RECONCILED', 'AUDITED'));
