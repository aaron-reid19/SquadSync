import { Router, type NextFunction, type Request, type Response } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { db, type User } from "./db";
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
  limit: 20, // per IP; sends Retry-After when exceeded
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

export function startSession(res: Response, userId: number) {
  // A brand-new token on every login prevents session fixation.
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    sha256(token), userId, Date.now() + SESSION_MS
  );
  res.cookie("sid", token, {
    httpOnly: true, // JavaScript can't read it
    secure: isProd, // HTTPS only in production
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

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  const now = Date.now();
  const locked = !!user && user.locked_until > now;

  // Always run one hash check, whether or not the user exists.
  const ok = await argon2
    .verify(user?.password_hash ?? (await dummyHash), password)
    .catch(() => false);

  if (!user || !user.password_hash || locked || !ok) {
    if (user && !locked) {
      db.prepare(
        `UPDATE users SET
           failed_attempts = CASE WHEN failed_attempts + 1 >= @max THEN 0 ELSE failed_attempts + 1 END,
           locked_until   = CASE WHEN failed_attempts + 1 >= @max THEN @until ELSE locked_until END
         WHERE id = @id`
      ).run({ max: MAX_FAILS, until: now + LOCK_MS, id: user.id });
    }
    // Same answer for: unknown email, wrong password, locked account.
    return res.status(401).json({ error: "Invalid credentials" });
  }

  db.prepare("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = ?").run(user.id);
  startSession(res, user.id);
  res.json({ ok: true });
});

authRouter.post("/google", requireCsrf, loginLimiter, async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  try {
    // Verifies signature, expiry, issuer, and that it was issued for OUR client ID.
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) return res.status(401).json({ error: "Invalid credentials" });

    const email = p.email.toLowerCase();
    let user = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(p.sub) as User | undefined;
    if (!user) {
      user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
      if (user) db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").run(p.sub, user.id);
      else {
        const info = db.prepare("INSERT INTO users (email, google_sub) VALUES (?, ?)").run(email, p.sub);
        user = { id: Number(info.lastInsertRowid) } as User;
      }
    }
    startSession(res, user.id);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

authRouter.get("/me", (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  const row = db
    .prepare(
      `SELECT u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(sha256(token), Date.now()) as { email: string } | undefined;
  if (!row) return res.status(401).json({ error: "Not signed in" });
  res.json({ email: row.email });
});

authRouter.post("/logout", requireCsrf, (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  res.clearCookie("sid", { path: "/" });
  res.json({ ok: true });
});
