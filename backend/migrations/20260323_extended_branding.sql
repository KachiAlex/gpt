-- Extended branding: favicon + secondary/accent color
ALTER TABLE instance_settings
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT;
