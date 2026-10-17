-- Tamper-evident audit trail for sensitive actions.
-- Append-only: no UPDATE/DELETE is ever issued against this table.
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email  TEXT,                        -- snapshot, survives user deletion
  actor_role   TEXT,
  action       TEXT NOT NULL,               -- e.g. 'project.publish', 'submission.transition'
  entity_type  TEXT,                        -- 'project' | 'submission' | 'instance' | ...
  entity_id    TEXT,                        -- stored as text to cover non-uuid entities
  detail       JSONB NOT NULL DEFAULT '{}', -- before/after, comments, changed fields
  ip           TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log(action);
