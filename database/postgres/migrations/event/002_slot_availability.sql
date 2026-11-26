CREATE TABLE IF NOT EXISTS event_slot_availability (
  slot_id UUID NOT NULL REFERENCES event_slots(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slot_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_slot_availability_user_id_idx ON event_slot_availability (user_id);
