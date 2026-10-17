-- Second-approver queue for sensitive configuration changes.
-- When REQUIRE_SECOND_APPROVAL=true, admin PUTs to /api/instance and
-- /api/instance/workflow create pending rows here instead of applying;
-- a DIFFERENT admin must approve before the change takes effect.
CREATE TABLE IF NOT EXISTS config_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('instance', 'workflow')),
  payload JSONB NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_requests_status ON config_requests(status) WHERE status = 'PENDING';
