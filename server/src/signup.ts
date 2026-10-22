import { Router } from "express";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import { db } from "./db";
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

signupRouter.get("/username-available", checkLimiter, (req, res) => {
    const u = String(req.query.u ?? "").toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) return res.status(400).json({ error: "Invalid request" });
    const row = db.prepare("SELECT 1 FROM profiles WHERE username = ?").get(u);
    res.set("Cache-Control", "no-store").json({ available: !row });
  });
  
signupRouter.post("/signup", requireCsrf, limiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const d = parsed.data;

  try {
    const hash = await argon2.hash(d.password, { type: argon2.argon2id });
    // One transaction: either the user and profile both exist, or neither does.
    const userId = db.transaction(() => {
      const info = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(d.email, hash);
      const id = Number(info.lastInsertRowid);
      db.prepare(
        `INSERT INTO profiles (user_id, first_name, last_name, username, dob, phone, city,
                               travel_km, pronouns, bio, interests, transport, terms_version, terms_accepted_at)
         VALUES (@id, @firstName, @lastName, @username, @dob, @phone, @city,
                 @travelKm, @pronouns, @bio, @interests, @transport, @termsVersion, @acceptedAt)`
      ).run({
        id, firstName: d.firstName, lastName: d.lastName, username: d.username, dob: d.dob,
        phone: d.phone ?? null, city: d.city, travelKm: d.travelKm, pronouns: d.pronouns ?? null,
        bio: d.bio ?? null, interests: JSON.stringify(d.interests), transport: JSON.stringify(d.transport),
        termsVersion: d.termsVersion, acceptedAt: Math.floor(Date.now() / 1000),
      });
      return id;
    })();

    startSession(res, userId);
    res.status(201).json({ ok: true, nextStep: 2 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("users.email"))
      return res.status(409).json({ error: "An account with this email already exists.", field: "email" });
    if (msg.includes("profiles.username"))
      return res.status(409).json({ error: "That username is taken.", field: "username" });
    console.error("Signup failed:", msg);
    res.status(500).json({ error: "Something went wrong" });
  }
});