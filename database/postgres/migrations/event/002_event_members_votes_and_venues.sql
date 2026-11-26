CREATE TABLE IF NOT EXISTS event_members (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_slot_availability (
  slot_id UUID NOT NULL REFERENCES event_slots(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slot_id, user_id)
);

ALTER TABLE event_final_plans
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS venue_address TEXT,
  ADD COLUMN IF NOT EXISTS venue_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS venue_longitude NUMERIC;

CREATE INDEX IF NOT EXISTS event_members_user_id_idx ON event_members (user_id);
CREATE INDEX IF NOT EXISTS event_attendees_user_id_idx ON event_attendees (user_id);
CREATE INDEX IF NOT EXISTS event_slot_availability_user_id_idx ON event_slot_availability (user_id);
