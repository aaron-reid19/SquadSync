import { Router } from "express";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import { query, withTransaction } from "./db";
import { requireCsrf, startSession } from "./auth";
import { signupSchema } from "./schemas";

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts" },
});

const checkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts" },
});

export const signupRouter = Router();

signupRouter.get("/username-available", checkLimiter, async (req, res) => {
  const username = String(req.query.u ?? "").toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) return res.status(400).json({ error: "Invalid request" });
  const row = (await query("SELECT 1 FROM profiles WHERE username = $1", [username])).rows[0];
  res.set("Cache-Control", "no-store").json({ available: !row });
});

signupRouter.post("/signup", requireCsrf, limiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const d = parsed.data;

  try {
    const hash = await argon2.hash(d.password, { type: argon2.argon2id });
    const userId = await withTransaction(async (client) => {
      const userResult = await client.query<{ id: number }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [d.email, hash],
      );
      const id = userResult.rows[0].id;
      await client.query(
        `INSERT INTO profiles (user_id, first_name, last_name, username, dob, phone, city,
                               travel_km, pronouns, bio, interests, transport, terms_version, terms_accepted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14)`,
        [
          id, d.firstName, d.lastName, d.username, d.dob, d.phone ?? null, d.city,
          d.travelKm, d.pronouns ?? null, d.bio ?? null, JSON.stringify(d.interests),
          JSON.stringify(d.transport), d.termsVersion, Math.floor(Date.now() / 1000),
        ],
      );
      return id;
    });

    await startSession(res, userId);
    res.status(201).json({ ok: true, nextStep: 2 });
  } catch (err) {
    const code = (err as { code?: string }).code;
    const constraint = (err as { constraint?: string }).constraint;
    if (code === "23505" && constraint === "users_email_key") {
      return res.status(409).json({ error: "An account with this email already exists.", field: "email" });
    }
    if (code === "23505" && constraint === "profiles_username_key") {
      return res.status(409).json({ error: "That username is taken.", field: "username" });
    }
    console.error("Signup failed:", err instanceof Error ? err.message : "unknown error");
    res.status(500).json({ error: "Something went wrong" });
  }
});
