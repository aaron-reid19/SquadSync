import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, query } from "./db";

const migrationPath = path.resolve(process.cwd(), "../../../database/postgres/migrations/001_initial_schema.sql");

try {
  await query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const version = "001_initial_schema";
  const existing = await query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", [version]);
  if (!existing.rowCount) {
    const sql = await readFile(migrationPath, "utf8");
    await query(sql);
    await query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
    console.log(`Applied ${version}`);
  } else {
    console.log(`${version} is already applied`);
  }
} finally {
  await db.end();
}
