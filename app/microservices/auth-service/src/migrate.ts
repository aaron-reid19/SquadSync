import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, query } from "./db";

const migrationDir = path.resolve(process.cwd(), "../../../database/postgres/migrations/auth");

try {
  await query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const files = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();
  if (!files.length) throw new Error(`No auth migrations found in ${migrationDir}`);
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const existing = await query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", [version]);
    if (existing.rowCount) {
      console.log(`${version} is already applied`);
      continue;
    }
    const sql = await readFile(path.join(migrationDir, file), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`Applied ${version}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await db.end();
}