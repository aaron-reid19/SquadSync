ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#59bfdf';

CREATE INDEX IF NOT EXISTS profiles_username_lower_idx ON profiles (LOWER(username));
