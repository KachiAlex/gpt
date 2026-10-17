-- Render PostgreSQL Initial Schema for ABT Project Tracker
-- Run this migration on your Render Postgres instance before switching the backend
-- Requires: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================
-- Enum Types
-- =============================
CREATE TYPE user_role AS ENUM (
  'GOVERNMENT_ADMIN',
  'GOVERNMENT_OFFICER',
  'CONTRACTOR',
  'ME_OFFICER',
  'PUBLIC'
);

CREATE TYPE project_category AS ENUM (
  'TRANSPORTATION','HEALTHCARE','EDUCATION','WATER_SANITATION','HOUSING','AGRICULTURE','ENERGY','ICT','TOURISM','ENVIRONMENT'
);

CREATE TYPE project_status AS ENUM (
  'NOT_STARTED','IN_PROGRESS','NEAR_COMPLETION','COMPLETED','DELAYED','ON_HOLD','CANCELLED'
);

CREATE TYPE priority_level AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');

CREATE TYPE milestone_status AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','DELAYED','CANCELLED');

CREATE TYPE submission_type AS ENUM ('MILESTONE','PROGRESS','ISSUE','SAFETY','QUALITY','DELAY','GENERAL');

CREATE TYPE submission_status AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','FLAGGED','REQUIRES_CLARIFICATION');

CREATE TYPE approval_action AS ENUM ('APPROVED','REJECTED','FLAGGED','REQUEST_CLARIFICATION');

CREATE TYPE document_category AS ENUM ('CONTRACT','TECHNICAL','ENVIRONMENTAL','REPORT','PHOTO','VIDEO','OTHER');

CREATE TYPE inspection_type AS ENUM ('QUALITY','SAFETY','PROGRESS','FINAL','COMPLIANCE');

CREATE TYPE inspection_status AS ENUM ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','RESCHEDULED');

CREATE TYPE notification_type AS ENUM ('DEADLINE','PAYMENT','INSPECTION','APPROVAL','REJECTION','SYSTEM','GENERAL');

CREATE TYPE report_type AS ENUM ('MONTHLY','QUARTERLY','ANNUAL','SPECIAL','CUSTOM');

-- =============================
-- Core Tables
-- =============================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  profile_image TEXT,
  department TEXT,
  job_title TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  registration_no TEXT UNIQUE NOT NULL,
  contact_person TEXT NOT NULL,
  company_email TEXT NOT NULL,
  company_phone TEXT NOT NULL,
  company_address TEXT NOT NULL,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_certified BOOLEAN NOT NULL DEFAULT FALSE,
  years_experience INTEGER,
  specialization TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category project_category NOT NULL,
  lga TEXT[] NOT NULL DEFAULT '{}',
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  status project_status NOT NULL DEFAULT 'NOT_STARTED',
  progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  budget NUMERIC(14,2) NOT NULL,
  allocated_budget NUMERIC(14,2) NOT NULL,
  spent_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  funding_source TEXT,
  start_date DATE,
  expected_end_date DATE,
  actual_end_date DATE,
  beneficiaries TEXT,
  contractor_id UUID REFERENCES contractor_profiles(id) ON DELETE SET NULL,
  project_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location JSONB,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  quality_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  safety_compliance TEXT,
  weather_delay INTEGER NOT NULL DEFAULT 0,
  safety_incidents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_date DATE,
  status milestone_status NOT NULL DEFAULT 'PENDING',
  progress NUMERIC(5,2) NOT NULL DEFAULT 0,
  budget NUMERIC(14,2),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type submission_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  progress NUMERIC(5,2),
  estimated_value NUMERIC(14,2),
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  status submission_status NOT NULL DEFAULT 'PENDING',
  quality_score NUMERIC(4,2),
  safety_compliance TEXT,
  weather_impact TEXT,
  media_count INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  category document_category NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type inspection_type NOT NULL,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status inspection_status NOT NULL DEFAULT 'SCHEDULED',
  findings TEXT,
  score NUMERIC(4,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type report_type NOT NULL,
  category TEXT,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  data JSONB,
  file_path TEXT,
  file_size BIGINT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================
-- Helpful Indexes
-- =============================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_contractor_user ON contractor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_contractor ON projects(contractor_id);
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contractor ON submissions(contractor_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_submission ON documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);

-- =============================
-- Comment metadata for clarity
-- =============================
COMMENT ON TABLE users IS 'System users including admins, officers, contractors, and M&E officers';
COMMENT ON TABLE contractor_profiles IS 'Contractor company profiles linked to user accounts';
COMMENT ON TABLE projects IS 'Government projects being tracked';
COMMENT ON TABLE submissions IS 'Contractor submissions for progress, issues, etc.';
COMMENT ON TABLE documents IS 'File uploads associated with projects/submissions';
COMMENT ON TABLE notifications IS 'User notifications and alerts';
