import "dotenv/config";
import argon2 from "argon2";
import { db, query } from "./db";
import { loginSchema } from "./schemas";

const [email, password] = process.argv.slice(2);
const parsed = loginSchema.safeParse({ email, password });
if (!parsed.success) {
  console.error('Usage: npm run seed -- you@example.com "AtLeast8Chars"');
  process.exit(1);
}

try {
  const hash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
  await query("INSERT INTO users (email, password_hash) VALUES ($1, $2)", [parsed.data.email, hash]);
  console.log("User created:", parsed.data.email);
} finally {
  await db.end();
}
