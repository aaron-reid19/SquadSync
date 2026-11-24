import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// One shared pool for the whole service. Repositories import this and call pool.query(...).
export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX) || 10,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

// Without this handler, an error on an idle connection would crash the whole process.
pool.on("error", (error) => {
  console.error("Unexpected Postgres pool error:", error.message);
});