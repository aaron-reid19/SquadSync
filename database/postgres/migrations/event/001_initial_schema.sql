CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL,
  organizer_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  area_name TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  visibility TEXT NOT NULL DEFAULT 'squad',
  status TEXT NOT NULL DEFAULT 'draft',
  vote_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS event_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  suggested_by_user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  price SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_suggestion_votes (
  suggestion_id UUID NOT NULL REFERENCES event_suggestions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  vote TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_attendees (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  response TEXT NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_final_plans (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  suggestion_id UUID NOT NULL REFERENCES event_suggestions(id),
  slot_id UUID NOT NULL REFERENCES event_slots(id),
  venue_id TEXT,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_squad_id_idx ON events (squad_id);
CREATE INDEX IF NOT EXISTS event_slots_event_id_idx ON event_slots (event_id);
CREATE INDEX IF NOT EXISTS event_suggestions_event_id_idx ON event_suggestions (event_id);
