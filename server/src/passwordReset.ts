import { Router } from "express";
import argon2 from "argon2";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { requireCsrf } from "./auth";
import { forgotSchema, resetSchema } from "./schemas";
import { sendMail } from "./mailer";
import { sha256 } from "./util";

const TOKEN_TTL_MS = 30 * 60 * 1000; // link works for 30 minutes
const RESEND_GAP_MS = 60 * 1000; // at most one email per account per minute

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts" },
  });

function sendResetEmail(user: { id: number; email: string }) {
  const now = Date.now();
  const recent = db
    .prepare("SELECT 1 FROM password_resets WHERE user_id = ? AND created_at > ?")
    .get(user.id, now - RESEND_GAP_MS);
  if (recent) return;

  const token = crypto.randomBytes(32).toString("base64url");
  // A new request voids any older link for this account (and sweeps expired ones).
  db.prepare("DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?").run(user.id, now);
  db.prepare(
    "INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run(sha256(token), user.id, now + TOKEN_TTL_MS, now);

  // The link base comes from config, never from the request's Host header.
  const base = process.env.APP_URL ?? "http://localhost:5173";
  const link = `${base}/reset-password?token=${token}`;
  const text =
    `Someone asked to reset your SquadSync password.\n\nSet a new one here (valid for 30 minutes):\n${link}\n\n` +
    `If this wasn't you, ignore this email. Your password stays the same.`;
  const html =
    `<p>Someone asked to reset your SquadSync password.</p>` +
    `<p><a href="${link}">Set a new password</a> (valid for 30 minutes)</p>` +
    `<p>If this wasn't you, ignore this email. Your password stays the same.</p>`;

  // Not awaited: the response time is the same whether or not the account exists.
  sendMail(user.email, "Reset your SquadSync password", text, html).catch((err: unknown) =>
    console.error("Reset email failed:", err instanceof Error ? err.message : "unknown error")
  );
}

export const passwordResetRouter = Router();

passwordResetRouter.post("/forgot-password", requireCsrf, limiter(8), (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

  const user = db.prepare("SELECT id, email FROM users WHERE email = ?").get(parsed.data.email) as
    | { id: number; email: string }
    | undefined;
  if (user) sendResetEmail(user);

  // Identical answer whether or not the account exists.
  res.json({ ok: true });
});

passwordResetRouter.post("/reset-password", requireCsrf, limiter(10), async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  const tokenHash = sha256(parsed.data.token);

  const row = db
    .prepare("SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?")
    .get(tokenHash, Date.now()) as { user_id: number } | undefined;
  if (!row) return res.status(400).json({ error: "Invalid or expired link" });

  const hash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });

  const apply = db.transaction(() => {
    // Deleting the token first makes it single-use even if two requests race.
    if (db.prepare("DELETE FROM password_resets WHERE token_hash = ?").run(tokenHash).changes === 0) return false;
    db.prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = 0 WHERE id = ?").run(hash, row.user_id);
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(row.user_id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id); // sign out everywhere
    return true;
  });

  if (!apply()) return res.status(400).json({ error: "Invalid or expired link" });
  res.json({ ok: true });
});