// Copied into each PostgreSQL-backed Fastify service by scripts/sync-shared.sh. Edit the _shared copy.
import pg from "pg";

// Production startup already refuses a missing DATABASE_URL (see config.ts);
// in development the pool is still created so /ready can report the problem.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 5000,
});

export function query<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

export function checkDatabase() {
  return pool.query("SELECT 1");
}

// Without this handler, an error on an idle connection would crash the whole process.
pool.on("error", (error) => {
  console.error(JSON.stringify({ level: 50, time: Date.now(), msg: "postgres pool error", err: error.message }));
});

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
