import { Router, type NextFunction, type Request, type Response } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { db, query, type User } from "./db";
import { googleSchema, loginSchema } from "./schemas";
import { sha256 } from "./util";

const isProd = process.env.NODE_ENV === "production";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const identityCookieName = process.env.IDENTITY_COOKIE_NAME ?? (isProd ? "__Host-squadsync-access" : "squadsync-access");
const identityServiceUrl = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4100";
const squadServiceUrl = process.env.SQUAD_SERVICE_URL ?? "http://localhost:4101";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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
  const ok = header.length > 0 && header.length === cookie.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(cookie));
  if (!ok) return res.status(403).json({ error: "Forbidden" });
  next();
}

async function createIdentityToken(userId: number) {
  const internalToken = process.env.IDENTITY_INTERNAL_TOKEN;
  if (!internalToken) throw new Error("IDENTITY_INTERNAL_TOKEN is required");
  const response = await fetch(`${identityServiceUrl}/internal/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-token": internalToken },
    body: JSON.stringify({ subject: String(userId), scopes: ["user"] }),
  });
  if (!response.ok) throw new Error(`Identity token service returned ${response.status}`);
  const data = await response.json() as { accessToken?: string };
  if (!data.accessToken) throw new Error("Identity token service did not return an access token");
  return data.accessToken;
}

function setIdentityCookie(res: Response, token: string) {
  const maxAge = (Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 86400) * 1000;
  res.cookie(identityCookieName, token, {
    httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge,
  });
}

export async function startSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_MS;
  await query("DELETE FROM sessions WHERE expires_at < $1", [Date.now()]);
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [sha256(token), userId, expiresAt]);
  try {
    const identityToken = await createIdentityToken(userId);
    res.cookie("sid", token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: SESSION_MS });
    setIdentityCookie(res, identityToken);
  } catch (error) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
    throw error;
  }
}

export async function sessionUserId(req: Request) {
  const token = req.cookies?.sid as string | undefined;
  if (!token) return null;
  const row = (await query<{ user_id: number }>(
    "SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2", [sha256(token), Date.now()],
  )).rows[0];
  return row?.user_id ?? null;
}

async function loadProfile(userId: number) {
  return (await query<{
    id: number; email: string; first_name: string; last_name: string; username: string; dob: string;
    phone: string | null; city: string; travel_km: number; pronouns: string | null; bio: string | null;
    interests: string[]; transport: string[]; availability: string[]; color: string;
  }>(`
    SELECT u.id, u.email, p.first_name, p.last_name, p.username, p.dob, p.phone, p.city, p.travel_km,
           p.pronouns, p.bio, p.interests, p.transport, p.availability, p.color
    FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1
  `, [userId])).rows[0];
}

async function membersInSharedSquads(userId: number) {
  const members = new Set<number>([userId]);
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) return members;
  try {
    const headers = { "x-internal-token": token };
    const squadsResponse = await fetch(`${squadServiceUrl}/internal/users/${userId}/squads`, { headers });
    if (!squadsResponse.ok) return members;
    const squadsData = await squadsResponse.json() as { squadIds?: string[] };
    const squadIds = Array.isArray(squadsData.squadIds) ? squadsData.squadIds : [];
    const memberLists = await Promise.all(squadIds.map(async (squadId) => {
      const response = await fetch(`${squadServiceUrl}/internal/squads/${encodeURIComponent(squadId)}/members`, { headers });
      if (!response.ok) return [] as string[];
      const data = await response.json() as { memberIds?: string[] };
      return Array.isArray(data.memberIds) ? data.memberIds : [];
    }));
    for (const memberId of memberLists.flat()) {
      const id = Number(memberId);
      if (Number.isSafeInteger(id) && id > 0) members.add(id);
    }
  } catch (error) {
    // The profile endpoint remains usable during a Squad service outage; only shared availability is hidden.
    console.warn("Could not resolve shared Squad availability:", error instanceof Error ? error.message : "unknown error");
  }
  return members;
}

function toUser(profile: NonNullable<Awaited<ReturnType<typeof loadProfile>>>) {
  return {
    id: String(profile.id), email: profile.email, firstName: profile.first_name, lastName: profile.last_name,
    username: profile.username, dob: profile.dob, phone: profile.phone ?? undefined, city: profile.city,
    travelKm: profile.travel_km, pronouns: profile.pronouns ?? undefined, bio: profile.bio ?? undefined,
    interests: profile.interests ?? [], transport: profile.transport ?? [], availability: profile.availability ?? [],
    color: profile.color ?? "#59bfdf",
  };
}

export const authRouter = Router();

authRouter.get("/csrf", (_req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf", token, { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: 2 * 60 * 60 * 1000 });
  res.set("Cache-Control", "no-store").json({ csrfToken: token });
});

authRouter.post("/login", requireCsrf, loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const { identifier, password } = parsed.data;
  const user = (await query<User>(`SELECT u.* FROM users u LEFT JOIN profiles p ON p.user_id = u.id
    WHERE LOWER(u.email) = $1 OR LOWER(p.username) = $1 LIMIT 1`, [identifier])).rows[0];
  const now = Date.now();
  const locked = !!user && user.locked_until > now;
  const ok = await argon2.verify(user?.password_hash ?? (await dummyHash), password).catch(() => false);
  if (!user || !user.password_hash || locked || !ok) {
    if (user && !locked) {
      await query(`UPDATE users SET
        failed_attempts = CASE WHEN failed_attempts + 1 >= $1 THEN 0 ELSE failed_attempts + 1 END,
        locked_until = CASE WHEN failed_attempts + 1 >= $1 THEN $2 ELSE locked_until END WHERE id = $3`,
      [MAX_FAILS, now + LOCK_MS, user.id]);
    }
    return res.status(401).json({ error: "Invalid credentials" });
  }
  await query("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = $1", [user.id]);
  try { await startSession(res, user.id); return res.json({ ok: true }); }
  catch (error) { console.error("Identity session creation failed:", error); return res.status(503).json({ error: "Sign-in is temporarily unavailable." }); }
});

authRouter.post("/google", requireCsrf, loginLimiter, async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: parsed.data.credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) return res.status(401).json({ error: "Invalid credentials" });
    const email = payload.email.toLowerCase();
    let user = (await query<User>("SELECT * FROM users WHERE google_sub = $1", [payload.sub])).rows[0];
    if (!user) {
      user = (await query<User>("SELECT * FROM users WHERE email = $1", [email])).rows[0];
      if (!user) return res.status(409).json({ error: "Create a SquadSync account first, then connect Google sign-in." });
      await query("UPDATE users SET google_sub = $1 WHERE id = $2", [payload.sub, user.id]);
    }
    const profile = await loadProfile(user.id);
    if (!profile) return res.status(409).json({ error: "Complete your profile before using Google sign-in." });
    await startSession(res, user.id);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Google sign-in failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(401).json({ error: "Invalid credentials" });
  }
});

authRouter.get("/me", async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Not signed in" });
  const profile = await loadProfile(userId);
  if (!profile) return res.status(409).json({ error: "Account profile is incomplete" });
  try {
    setIdentityCookie(res, await createIdentityToken(userId));
  } catch (error) {
    console.error("Identity token refresh failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(503).json({ error: "Authentication service is temporarily unavailable." });
  }
  res.set("Cache-Control", "no-store").json({ user: toUser(profile) });
});

authRouter.get("/profiles", async (req, res) => {
  const requesterId = await sessionUserId(req);
  if (!requesterId) return res.status(401).json({ error: "Not signed in" });
  const ids = String(req.query.ids ?? "").split(",").filter(Boolean).slice(0, 100).map(Number);
  if (!ids.every((id) => Number.isSafeInteger(id) && id > 0)) return res.status(400).json({ error: "Invalid profile IDs" });
  const [rows, sharedMembers] = await Promise.all([
    query<{
      id: number; first_name: string; last_name: string; username: string; city: string;
      pronouns: string | null; bio: string | null; interests: string[]; transport: string[];
      travel_km: number; color: string; availability: string[];
    }>(`SELECT u.id, p.first_name, p.last_name, p.username, p.city, p.pronouns, p.bio,
        p.interests, p.transport, p.travel_km, p.color, p.availability
        FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ANY($1::integer[])`, [ids]),
    membersInSharedSquads(requesterId),
  ]);
  res.set("Cache-Control", "no-store").json(rows.rows.map((p) => ({
    id: String(p.id), firstName: p.first_name, lastName: p.last_name, username: p.username,
    city: p.city, pronouns: p.pronouns ?? undefined, bio: p.bio ?? undefined,
    interests: p.interests ?? [], transport: p.transport ?? [], travelKm: p.travel_km,
    color: p.color ?? "#59bfdf", email: "", phone: undefined,
    availability: sharedMembers.has(p.id) ? (p.availability ?? []) : [],
  })));
});

authRouter.patch("/profile", requireCsrf, async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: "Not signed in" });
  const body = req.body as Record<string, unknown>;
  const current = await loadProfile(userId);
  if (!current) return res.status(404).json({ error: "Profile not found" });
  // Profile endpoints accept partial updates (for example, an availability-only save).
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : current.first_name;
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : current.last_name;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : current.email;
  const city = typeof body.city === "string" ? body.city.trim() : current.city;
  const travelKm = body.travelKm === undefined ? current.travel_km : Number(body.travelKm);
  const interests = Array.isArray(body.interests) ? body.interests : (current.interests ?? []);
  const transport = Array.isArray(body.transport) ? body.transport : (current.transport ?? []);
  const availability = Array.isArray(body.availability) ? body.availability : undefined;
  const color = typeof body.color === "string" ? body.color : (current.color ?? "#59bfdf");
  const pronouns = typeof body.pronouns === "string" ? body.pronouns.trim() || null : current.pronouns;
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 160) || null : current.bio;
  if (firstName.length < 1 || firstName.length > 50 || lastName.length < 1 || lastName.length > 50 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || city.length < 2 || city.length > 80 ||
      ![5, 10, 25, 50].includes(travelKm) || !Array.isArray(interests) || interests.length < 3 || interests.length > 10 ||
      !interests.every((item) => typeof item === "string" && item.length <= 40) ||
      !Array.isArray(transport) || transport.length > 3 || !transport.every((item) => typeof item === "string" && item.length <= 40) ||
      !/^#[0-9a-fA-F]{6}$/.test(color) ||
      (availability && (availability.length > 28 || !availability.every((k) => typeof k === "string" && /^([0-6])-(0|1|2|3)$/.test(k))))) {
    return res.status(400).json({ error: "Invalid profile details" });
  }
  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET email = $1 WHERE id = $2", [email, userId]);
      await client.query(`UPDATE profiles SET first_name = $1, last_name = $2, city = $3, travel_km = $4,
        pronouns = $5, bio = $6, interests = $7::jsonb, transport = $8::jsonb, color = $9,
        availability = COALESCE($10::jsonb, availability) WHERE user_id = $11`,
      [firstName, lastName, city, travelKm, pronouns, bio,
        JSON.stringify(interests), JSON.stringify(transport), color,
        availability ? JSON.stringify(availability) : null, userId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    const profile = await loadProfile(userId);
    return res.json({ user: profile ? toUser(profile) : null });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return res.status(409).json({ error: "That email address is already in use.", field: "email" });
    console.error("Profile update failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(500).json({ error: "Could not save your profile." });
  }
});

authRouter.post("/logout", requireCsrf, async (req, res) => {
  const token = req.cookies?.sid as string | undefined;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  res.clearCookie("sid", { path: "/" });
  res.clearCookie(identityCookieName, { path: "/" });
  res.json({ ok: true });
});
