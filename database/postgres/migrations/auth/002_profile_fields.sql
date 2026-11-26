-- Bring older auth databases up to the profile shape used by the current API.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#59bfdf';
