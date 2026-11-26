import { Pool, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for event-service");

export const db = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX) || 10,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export function query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
  return db.query<T>(sql, values);
}
