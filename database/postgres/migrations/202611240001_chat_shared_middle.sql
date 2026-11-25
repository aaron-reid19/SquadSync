-- SquadSync chat shared-middle persistence.
-- The chat service uses numeric user IDs from identity.subject. This migration
-- references the existing public.users(id) key. If your canonical user table
-- has a different schema/name, adjust only these FK targets to match it.
BEGIN;

CREATE TABLE IF NOT EXISTS chat_rooms (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_rooms_created_at_id_idx
  ON chat_rooms (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id BIGINT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_room_members_user_room_idx
  ON chat_room_members (user_id, room_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body VARCHAR(4000) NOT NULL CHECK (length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_created_id_idx
  ON chat_messages (room_id, created_at DESC, id DESC);

COMMIT;
