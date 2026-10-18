import argon2 from "argon2";
import { db } from "./db";
import { loginSchema } from "./schemas";

// Creates a test user (there is no sign-up page yet):
//   npm run seed -- you@example.com "AtLeast8Chars"
const [email, password] = process.argv.slice(2);
const parsed = loginSchema.safeParse({ email, password });
if (!parsed.success) {
  console.error('Usage: npm run seed -- you@example.com "AtLeast8Chars"');
  process.exit(1);
}
const hash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(parsed.data.email, hash);
console.log("User created:", parsed.data.email);
