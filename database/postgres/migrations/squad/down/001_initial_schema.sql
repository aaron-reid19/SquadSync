-- Reverts squad/001_initial_schema.sql. DESTROYS all Squads and memberships.
DROP TABLE IF EXISTS squad_members;
DROP TABLE IF EXISTS squads;
