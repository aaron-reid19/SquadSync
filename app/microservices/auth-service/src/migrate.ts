// Local-development runner for the auth database. Follows the same rules as
// database/postgres/migrations/run.sh (which the deployment Jobs use), so both
// can run against the same database: ordered NNN_*.sql files, one transaction
// per migration including its schema_migrations row, a shared advisory lock,
// and SHA-256 checksums that reject edits to applied migrations.
import "dotenv/config";
import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, withTransaction } from "./db";

const migrationDir = path.resolve(process.cwd(), "../../../database/postgres/migrations/auth");
const LOCK = "SELECT pg_advisory_xact_lock(hashtext('squadsync:schema_migrations'))";
const NAME = /^[0-9]{3}_[a-z0-9_]+\.sql$/;

try {
  await withTransaction(async (client) => {
    await client.query(LOCK);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    );
    await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT");
  });

  const files = (await readdir(migrationDir)).filter((f) => f.endsWith(".sql")).sort();
  const invalid = files.filter((f) => !NAME.test(f));
  if (invalid.length) throw new Error(`Invalid migration file names: ${invalid.join(", ")}`);

  for (const file of files) {
    const version = file.slice(0, -4);
    const sql = await readFile(path.join(migrationDir, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");

    await withTransaction(async (client) => {
      await client.query(LOCK);
      const row = (await client.query<{ checksum: string | null }>(
        "SELECT checksum FROM schema_migrations WHERE version = $1",
        [version],
      )).rows[0];

      if (!row) {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [version, checksum]);
        console.log(`Applied ${version}`);
      } else if (row.checksum === null) {
        await client.query("UPDATE schema_migrations SET checksum = $1 WHERE version = $2", [checksum, version]);
        console.log(`${version} is already applied (recorded checksum)`);
      } else if (row.checksum !== checksum) {
        throw new Error(`${version} was edited after it was applied; add a new migration instead`);
      } else {
        console.log(`${version} is already applied`);
      }
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.end();
}
