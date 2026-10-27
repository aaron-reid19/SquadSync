import { Router, type NextFunction, type Request, type Response } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { query, type User } from "./db";
import { googleSchema, loginSchema } from "./schemas";
import { sha256 } from "./util";

const isProd = process.env.NODE_ENV === "production";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verified against when the email doesn't exist, so response time doesn't reveal it.
const dummyHash = argon2.hash("not-a-real-password", { type: argon2.argon2id });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts" },
});

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const header = req.get("X-CSRF-Token") ?? "";
  const cookie = (req.cookies?.csrf as string | undefined) ?? "";
  const ok =
    header.length > 0 &&
    header.length === cookie.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(cookie));
  if (!ok) return res.status(403).json({ error: "Forbidden" });
  next();
}

export async function startSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    sha256(token), userId, Date.now() + SESSION_MS,
  ]);
  res.cookie("sid", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS,
  });
}

export const authRouter = Router();

authRouter.get("/csrf", (_req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf", token, { httpOnly: true, secure: isProd, sameSite: "strict", maxAge: 2 * 60 * 60 * 1000 });
  res.set("Cache-Control", "no-store").json({ csrfToken: token });
});

authRouter.post("/login", requireCsrf, loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { email, password } = parsed.data;

  const user = (await query<User>("SELECT * FROM users WHERE email = $1", [email])).rows[0];
  const now = Date.now();
  const locked = !!user && user.locked_until > now;
  const ok = await argon2
    .verify(user?.password_hash ?? (await dummyHash), password)
    .catch(() => false);

  if (!user || !user.password_hash || locked || !ok) {
    if (user && !locked) {
      await query(
        `UPDATE users SET
           failed_attempts = CASE WHEN failed_attempts + 1 >= $1 THEN 0 ELSE failed_attempts + 1 END,
           locked_until = CASE WHEN failed_attempts + 1 >= $1 THEN $2 ELSE locked_until END
         WHERE id = $3`,
        [MAX_FAILS, now + LOCK_MS, user.id],
      );
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }

  await query("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = $1", [user.id]);
  await startSession(res, user.id);
  res.json({ ok: true });
});

authRouter.post("/google", requireCsrf, loginLimiter, async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) return res.status(401).json({ error: "Invalid credentials" });

    const email = p.email.toLowerCase();
    let user = (await query<User>("SELECT * FROM users WHERE google_sub = $1", [p.sub])).rows[0];
    if (!user) {
      user = (await query<User>("SELECT * FROM users WHERE email = $1", [email])).rows[0];
      if (user) {
        await query("UPDATE users SET google_sub = $1 WHERE id = $2", [p.sub, user.id]);
      } else {
        user = (await query<User>(
          `INSERT INTO users (email, google_sub)
           VALUES ($1, $2)
           RETURNING id, email, password_hash, google_sub, failed_attempts, locked_until`,
          [email, p.sub],
        )).rows[0];
      }
    }
    await startSession(res, user.id);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

authRouter.get("/me", async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  const row = (await query<{ email: string }>(
    `SELECT u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [sha256(token), Date.now()],
  )).rows[0];
  if (!row) return res.status(401).json({ error: "Not signed in" });
  res.json({ email: row.email });
});

authRouter.post("/logout", requireCsrf, async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  res.clearCookie("sid", { path: "/" });
  res.json({ ok: true });
});
