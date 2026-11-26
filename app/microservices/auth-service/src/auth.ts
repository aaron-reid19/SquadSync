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
const identityServiceUrl = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4100";
const identityInternalToken = process.env.IDENTITY_INTERNAL_TOKEN;
const identityCookieName = process.env.IDENTITY_COOKIE_NAME ?? "squadsync-access";

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

  if (!identityInternalToken) throw new Error("IDENTITY_INTERNAL_TOKEN is required to issue API access tokens");
  const identityResponse = await fetch(`${identityServiceUrl}/internal/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": identityInternalToken },
    body: JSON.stringify({ subject: String(userId), scopes: ["api"] }),
  });
  if (!identityResponse.ok) throw new Error(`Identity service rejected token issuance (${identityResponse.status})`);
  const identity = (await identityResponse.json()) as { accessToken?: string; expiresIn?: number };
  if (!identity.accessToken) throw new Error("Identity service returned no access token");
  res.cookie(identityCookieName, identity.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Number(identity.expiresIn ?? 900) * 1000,
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
  const { identifier, password } = parsed.data;

  const user = (await query<User>(
    `SELECT u.*
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.email = $1 OR p.username = $1
      LIMIT 1`,
    [identifier],
  )).rows[0];
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
  const row = (await query<{
    id: number;
    email: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    dob: string | null;
    phone: string | null;
    city: string | null;
    travel_km: number | null;
    pronouns: string | null;
    bio: string | null;
    interests: string[] | null;
    transport: string[] | null;
    availability: string[] | null;
    color: string | null;
  }>(
    `SELECT u.id, u.email, p.username, p.first_name, p.last_name, p.dob, p.phone,
            p.city, p.travel_km, p.pronouns, p.bio, p.interests, p.transport, p.availability, p.color
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [sha256(token), Date.now()],
  )).rows[0];
  if (!row) return res.status(401).json({ error: "Not signed in" });
  res.json({
    id: String(row.id),
    email: row.email,
    username: row.username ?? row.email.split("@")[0],
    firstName: row.first_name ?? "SquadSync",
    lastName: row.last_name ?? "member",
    dob: row.dob ?? "",
    phone: row.phone ?? "",
    city: row.city ?? "",
    travelKm: row.travel_km ?? 25,
    pronouns: row.pronouns ?? "",
    bio: row.bio ?? "",
    interests: row.interests ?? [],
    transport: row.transport ?? [],
    availability: row.availability ?? [],
    color: row.color ?? "#59bfdf",
  });
});

authRouter.get("/users", async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  const session = (await query<{ user_id: number }>("SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2", [sha256(token), Date.now()])).rows[0];
  if (!session) return res.status(401).json({ error: "Not signed in" });
  const rawIds = String(req.query.ids ?? "").split(",").map((value) => Number(value)).filter(Number.isInteger);
  const ids = [...new Set([session.user_id, ...rawIds])];
  if (!ids.length) return res.json([]);
  const rows = (await query<{
    id: number; email: string; username: string | null; first_name: string | null; last_name: string | null;
    dob: string | null; phone: string | null; city: string | null; travel_km: number | null; pronouns: string | null;
    bio: string | null; interests: string[] | null; transport: string[] | null; availability: string[] | null; color: string | null;
  }>(
    `SELECT u.id, u.email, p.username, p.first_name, p.last_name, p.dob, p.phone, p.city, p.travel_km,
            p.pronouns, p.bio, p.interests, p.transport, p.availability, p.color
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ANY($1::int[])`,
    [ids],
  )).rows;
  res.json(rows.map((row) => ({
    id: String(row.id), email: row.email, username: row.username ?? row.email.split("@")[0], firstName: row.first_name ?? "SquadSync",
    lastName: row.last_name ?? "member", dob: row.dob ?? "", phone: row.phone ?? "", city: row.city ?? "", travelKm: row.travel_km ?? 25,
    pronouns: row.pronouns ?? "", bio: row.bio ?? "", interests: row.interests ?? [], transport: row.transport ?? [], availability: row.availability ?? [], color: row.color ?? "#59bfdf",
  })));
});

authRouter.patch("/me", requireCsrf, async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  const session = (await query<{ user_id: number }>("SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2", [sha256(token), Date.now()])).rows[0];
  if (!session) return res.status(401).json({ error: "Not signed in" });
  const current = (await query("SELECT u.email, p.* FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1", [session.user_id])).rows[0] as Record<string, unknown> | undefined;
  if (!current) return res.status(404).json({ error: "Profile not found" });
  const body = req.body as Record<string, unknown>;
  const text = (name: string, fallback: unknown) => typeof body[name] === "string" ? String(body[name]).trim() : String(fallback ?? "");
  const email = text("email", current.email).toLowerCase();
  const firstName = text("firstName", current.first_name);
  const lastName = text("lastName", current.last_name);
  const city = text("city", current.city);
  const travelKm = Number(body.travelKm ?? current.travel_km);
  const interests = Array.isArray(body.interests) ? body.interests.filter((value): value is string => typeof value === "string") : (current.interests ?? []);
  const transport = Array.isArray(body.transport) ? body.transport.filter((value): value is string => typeof value === "string") : (current.transport ?? []);
  if (!email.includes("@") || !firstName || !lastName || !city || !Number.isFinite(travelKm)) return res.status(400).json({ error: "Invalid profile" });
  try {
    await query("UPDATE users SET email = $1 WHERE id = $2", [email, session.user_id]);
    await query(
      `UPDATE profiles SET first_name = $1, last_name = $2, phone = $3, city = $4, travel_km = $5,
         pronouns = $6, bio = $7, interests = $8::jsonb, transport = $9::jsonb, color = $10 WHERE user_id = $11`,
      [firstName, lastName, text("phone", current.phone) || null, city, travelKm, text("pronouns", current.pronouns) || null,
        text("bio", current.bio) || null, JSON.stringify(interests), JSON.stringify(transport), text("color", current.color) || "#59bfdf", session.user_id],
    );
    return res.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ error: "That email is already in use.", field: "email" });
    throw error;
  }
});

authRouter.put("/me/availability", requireCsrf, async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  const session = (await query<{ user_id: number }>("SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2", [sha256(token), Date.now()])).rows[0];
  if (!session) return res.status(401).json({ error: "Not signed in" });
  const availability = req.body?.availability;
  if (!Array.isArray(availability) || availability.some((value) => typeof value !== "string" || !/^\d+-\d+$/.test(value))) return res.status(400).json({ error: "Invalid availability" });
  await query("UPDATE profiles SET availability = $1::jsonb WHERE user_id = $2", [JSON.stringify(availability), session.user_id]);
  return res.json({ ok: true });
});

authRouter.post("/logout", requireCsrf, async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  res.clearCookie("sid", { path: "/" });
  res.clearCookie(identityCookieName, { path: "/" });
  res.json({ ok: true });
});
