-- Reverts auth/002_profile_fields.sql. Profile availability and color are removed.
ALTER TABLE profiles
  DROP COLUMN IF EXISTS availability,
  DROP COLUMN IF EXISTS color;
