import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, query } from "./db.js";

const dir = path.resolve(process.cwd(), "../../../database/postgres/migrations/squad");
try {
  await query("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  for (const file of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
    const version = file.replace(/\.sql$/, "");
    const prior = await query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
    if (prior.rowCount) { console.log(`${version} already applied`); continue; }
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`Applied ${version}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
} finally { await db.end(); }
