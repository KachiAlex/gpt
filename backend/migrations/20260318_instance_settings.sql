-- Per-instance white-label configuration (single-row table)
CREATE TABLE IF NOT EXISTS instance_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Government Project Tracker',
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#0284c7',
  sidebar_color TEXT,
  currency TEXT NOT NULL DEFAULT '₦',
  area_label TEXT NOT NULL DEFAULT 'LGA',
  area_label_plural TEXT NOT NULL DEFAULT 'LGAs',
  contact_email TEXT,
  footer_org TEXT NOT NULL DEFAULT 'Kreatix Technologies',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO instance_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
