import Database from "better-sqlite3";

export const db = new Database("squadsync.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,              -- null for Google-only accounts
    google_sub TEXT UNIQUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,     -- only a hash of the cookie token is stored
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,     -- only a hash of the emailed token is stored
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    dob TEXT NOT NULL,               -- YYYY-MM-DD; show an age, never this
    phone TEXT,
    city TEXT NOT NULL,
    travel_km INTEGER NOT NULL,
    pronouns TEXT,
    bio TEXT,
    interests TEXT NOT NULL,         -- JSON array
    transport TEXT NOT NULL,         -- JSON array
    onboarding_step INTEGER NOT NULL DEFAULT 2,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );
`);

const profileCols = db.prepare("PRAGMA table_info(profiles)").all() as { name: string }[];
if (!profileCols.some((c) => c.name === "terms_version")) {
  db.exec("ALTER TABLE profiles ADD COLUMN terms_version TEXT NOT NULL DEFAULT ''");
  db.exec("ALTER TABLE profiles ADD COLUMN terms_accepted_at INTEGER NOT NULL DEFAULT 0");
}

export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  google_sub: string | null;
  failed_attempts: number;
  locked_until: number;
}
