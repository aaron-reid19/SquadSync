CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_event_id_unique_idx
  ON chat_rooms (event_id)
  WHERE event_id IS NOT NULL;
