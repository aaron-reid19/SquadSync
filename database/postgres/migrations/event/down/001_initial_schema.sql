-- Reverts event/001_initial_schema.sql. DESTROYS all events and planning data.
DROP TABLE IF EXISTS event_final_plans;
DROP TABLE IF EXISTS event_attendees;
DROP TABLE IF EXISTS event_suggestion_votes;
DROP TABLE IF EXISTS event_suggestions;
DROP TABLE IF EXISTS event_slots;
DROP TABLE IF EXISTS events;
