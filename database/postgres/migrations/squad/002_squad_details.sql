-- Squad display icon plus the rules the squad service relies on (KAN-39).
ALTER TABLE squads ADD COLUMN emoji TEXT NOT NULL DEFAULT '👥';

ALTER TABLE squads
  ADD CONSTRAINT squads_name_length CHECK (char_length(name) BETWEEN 1 AND 40),
  ADD CONSTRAINT squads_emoji_length CHECK (char_length(emoji) BETWEEN 1 AND 16),
  -- Six letters without I and O, so codes are easy to read aloud.
  ADD CONSTRAINT squads_join_code_format CHECK (join_code ~ '^[A-HJ-NP-Z]{6}$');

ALTER TABLE squad_members
  ADD CONSTRAINT squad_members_role_check CHECK (role IN ('owner', 'member'));

-- Exactly one owner per Squad at a time.
CREATE UNIQUE INDEX squad_members_one_owner_idx ON squad_members (squad_id) WHERE role = 'owner';
