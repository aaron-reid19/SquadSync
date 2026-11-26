-- Reverts squad/002_squad_details.sql. Drops Squad icons; memberships are kept.
DROP INDEX IF EXISTS squad_members_one_owner_idx;
ALTER TABLE squad_members DROP CONSTRAINT IF EXISTS squad_members_role_check;
ALTER TABLE squads
  DROP CONSTRAINT IF EXISTS squads_join_code_format,
  DROP CONSTRAINT IF EXISTS squads_emoji_length,
  DROP CONSTRAINT IF EXISTS squads_name_length,
  DROP COLUMN IF EXISTS emoji;
