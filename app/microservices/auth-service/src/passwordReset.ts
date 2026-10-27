import { Router } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { query, withTransaction } from "./db";
import { requireCsrf } from "./auth";
import { forgotSchema, resetSchema } from "./schemas";
import { sendMail } from "./mailer";
import { sha256 } from "./util";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts" },
  });

async function sendResetEmail(user: { id: number; email: string }) {
  const now = Date.now();
  const recent = (await query(
    "SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > $2",
    [user.id, now - RESEND_GAP_MS],
  )).rows[0];
  if (recent) return;

  const token = crypto.randomBytes(32).toString("base64url");
  await query("DELETE FROM password_resets WHERE user_id = $1 OR expires_at < $2", [user.id, now]);
  await query(
    "INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
    [sha256(token), user.id, now + TOKEN_TTL_MS, now],
  );

  // The link base comes from config, never from the request's Host header.
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/reset-password?token=${token}`;
  const text =
    `Someone asked to reset your SquadSync password.\n\nSet a new one here (valid for 30 minutes):\n${link}\n\n` +
    `If this wasn't you, ignore this email. Your password stays the same.`;
  const html =
    `<p>Someone asked to reset your SquadSync password.</p>` +
    `<p><a href="${link}">Set a new password</a> (valid for 30 minutes)</p>` +
    `<p>If this wasn't you, ignore this email. Your password stays the same.</p>`;

  void sendMail(user.email, "Reset your SquadSync password", text, html).catch((err: unknown) =>
    console.error("Reset email failed:", err instanceof Error ? err.message : "unknown"),
  );
}

export const passwordResetRouter = Router();

passwordResetRouter.post("/forgot-password", requireCsrf, limiter(8), async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const user = (await query<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE email = $1",
    [parsed.data.email],
  )).rows[0];
  if (user) await sendResetEmail(user);

  res.json({ ok: true });
});

passwordResetRouter.post("/reset-password", requireCsrf, limiter(10), async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const tokenHash = sha256(parsed.data.token);

  const row = (await query<{ user_id: number }>(
    "SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > $2",
    [tokenHash, Date.now()],
  )).rows[0];
  if (!row) return res.status(400).json({ error: "Invalid or expired link" });

  const hash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
  const applied = await withTransaction(async (client) => {
    const deleted = await client.query<{ user_id: number }>(
      "DELETE FROM password_resets WHERE token_hash = $1 RETURNING user_id",
      [tokenHash],
    );
    if (!deleted.rowCount) return false;
    const userId = deleted.rows[0].user_id;
    await client.query(
      "UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = 0 WHERE id = $2",
      [hash, userId],
    );
    await client.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    return true;
  });

  if (!applied) return res.status(400).json({ error: "Invalid or expired link" });
  res.json({ ok: true });
});
