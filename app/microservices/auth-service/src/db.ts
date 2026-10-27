import { Pool, type PoolClient, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn("DATABASE_URL is not set: the auth service cannot connect to PostgreSQL.");
}

export const db = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX) || 10,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface User {
  id: number;
  email: string;
  password_hash: string | null;
  google_sub: string | null;
  failed_attempts: number;
  locked_until: number;
}
