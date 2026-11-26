-- Reverts auth/001_initial_schema.sql. DESTROYS all accounts, profiles and sessions.
-- Only for a fresh environment or after taking a backup; see database/postgres/README.md.
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;
