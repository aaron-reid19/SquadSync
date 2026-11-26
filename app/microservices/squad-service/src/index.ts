import "dotenv/config";
import { randomBytes, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import { requireIdentity } from "./auth.js";
import { db, query } from "./db.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4101;
await app.register(cookie);

function userId(request: FastifyRequest) {
  const id = Number(request.identity?.subject);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function requireCsrf(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers["x-csrf-token"];
  const cookieToken = request.cookies?.csrf;
  if (typeof header !== "string" || !cookieToken || header.length !== cookieToken.length ||
      !timingSafeEqual(Buffer.from(header), Buffer.from(cookieToken))) {
    return reply.code(403).send({ error: "Invalid CSRF token" });
  }
}

function internalAllowed(request: FastifyRequest) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  const supplied = request.headers["x-internal-token"];
  return Boolean(expected && typeof supplied === "string" && supplied === expected);
}

app.get("/health", async () => ({ ok: true, service: "squad" }));
app.get("/ready", async (_request, reply) => {
  try { await query("SELECT 1"); return { ok: true, service: "squad", database: true }; }
  catch { return reply.code(503).send({ ok: false, service: "squad", database: false }); }
});

app.get("/api/squads", { preHandler: requireIdentity }, async (request, reply) => {
  const id = userId(request);
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const result = await query<{
    id: string; name: string; join_code: string; created_by_user_id: number; emoji: string; member_ids: number[];
  }>(`
    SELECT s.id, s.name, s.join_code, s.created_by_user_id, s.emoji,
           COALESCE(array_agg(sm.user_id ORDER BY sm.joined_at) FILTER (WHERE sm.user_id IS NOT NULL), ARRAY[]::integer[]) AS member_ids
    FROM squads s
    JOIN squad_members mine ON mine.squad_id = s.id AND mine.user_id = $1
    LEFT JOIN squad_members sm ON sm.squad_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `, [id]);
  return result.rows.map((row) => ({
    id: row.id, name: row.name, code: row.join_code, emoji: row.emoji,
    createdBy: String(row.created_by_user_id), memberIds: row.member_ids.map(String),
  }));
});

app.post<{ Body: { name?: string; emoji?: string } }>("/api/squads", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = userId(request);
  const name = request.body?.name?.trim();
  const emoji = request.body?.emoji?.trim();
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (!name || name.length < 2 || name.length > 60 || !emoji || emoji.length > 16) {
    return reply.code(400).send({ error: "Enter a Squad name and emoji." });
  }
  const code = randomBytes(5).toString("base64url").replace(/[-_]/g, "A").slice(0, 6).toUpperCase();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; created_at: Date }>(
      "INSERT INTO squads (name, join_code, created_by_user_id, emoji) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
      [name, code, id, emoji],
    );
    const squadId = result.rows[0].id;
    await client.query("INSERT INTO squad_members (squad_id, user_id, role) VALUES ($1, $2, 'owner')", [squadId, id]);
    await client.query("COMMIT");
    return reply.code(201).send({ id: squadId, name, code, emoji, createdBy: String(id), memberIds: [String(id)] });
  } catch (error) {
    await client.query("ROLLBACK");
    request.log.error(error);
    return reply.code(500).send({ error: "Could not create this Squad." });
  } finally { client.release(); }
});

app.post<{ Body: { code?: string } }>("/api/squads/join", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = userId(request);
  const code = request.body?.code?.trim().toUpperCase();
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) return reply.code(400).send({ error: "Enter a six-character invite code." });
  const result = await query<{ id: string; name: string; emoji: string; created_by_user_id: number; join_code: string }>(
    "SELECT id, name, emoji, created_by_user_id, join_code FROM squads WHERE join_code = $1", [code],
  );
  const squad = result.rows[0];
  if (!squad) return reply.code(404).send({ error: "We couldn't find a Squad with that code." });
  await query("INSERT INTO squad_members (squad_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [squad.id, id]);
  const members = await query<{ user_id: number }>("SELECT user_id FROM squad_members WHERE squad_id = $1 ORDER BY joined_at", [squad.id]);
  return { id: squad.id, name: squad.name, emoji: squad.emoji, code: squad.join_code, createdBy: String(squad.created_by_user_id), memberIds: members.rows.map((row) => String(row.user_id)) };
});

app.delete<{ Params: { id: string } }>("/api/squads/:id/membership", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = userId(request);
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const squadResult = await client.query<{ created_by_user_id: number }>(
      "SELECT created_by_user_id FROM squads WHERE id = $1 FOR UPDATE", [request.params.id],
    );
    const squad = squadResult.rows[0];
    if (!squad) {
      await client.query("ROLLBACK");
      return reply.code(404).send({ error: "Squad not found." });
    }
    const membership = await client.query<{ role: string }>(
      "SELECT role FROM squad_members WHERE squad_id = $1 AND user_id = $2 FOR UPDATE", [request.params.id, id],
    );
    if (!membership.rowCount) {
      await client.query("ROLLBACK");
      return reply.code(404).send({ error: "Squad membership not found." });
    }
    if (squad.created_by_user_id === id || membership.rows[0].role === "owner") {
      const successor = await client.query<{ user_id: number }>(
        "SELECT user_id FROM squad_members WHERE squad_id = $1 AND user_id <> $2 ORDER BY joined_at LIMIT 1",
        [request.params.id, id],
      );
      if (!successor.rowCount) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "You're the only Squad member. Invite another member before leaving so the Squad keeps an owner." });
      }
      await client.query("UPDATE squads SET created_by_user_id = $1 WHERE id = $2", [successor.rows[0].user_id, request.params.id]);
      await client.query("UPDATE squad_members SET role = 'owner' WHERE squad_id = $1 AND user_id = $2", [request.params.id, successor.rows[0].user_id]);
    }
    await client.query("DELETE FROM squad_members WHERE squad_id = $1 AND user_id = $2", [request.params.id, id]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    request.log.error(error);
    return reply.code(500).send({ error: "Could not leave this Squad." });
  } finally { client.release(); }
});

// Authenticated service-to-service reads used by event-service; never exposed to browsers.
app.get<{ Params: { id: string } }>("/internal/squads/:id", async (request, reply) => {
  if (!internalAllowed(request)) return reply.code(401).send({ error: "Internal authentication required" });
  const result = await query<{ id: string; name: string; emoji: string; created_by_user_id: number }>(
    "SELECT id, name, emoji, created_by_user_id FROM squads WHERE id = $1", [request.params.id],
  );
  const squad = result.rows[0];
  if (!squad) return reply.code(404).send({ error: "Squad not found" });
  return { id: squad.id, name: squad.name, emoji: squad.emoji, createdBy: String(squad.created_by_user_id) };
});

app.get<{ Params: { id: string } }>("/internal/squads/:id/members", async (request, reply) => {
  if (!internalAllowed(request)) return reply.code(401).send({ error: "Internal authentication required" });
  const result = await query<{ user_id: number }>("SELECT user_id FROM squad_members WHERE squad_id = $1 ORDER BY joined_at", [request.params.id]);
  if (!result.rowCount) return reply.code(404).send({ error: "Squad not found" });
  return { memberIds: result.rows.map((row) => String(row.user_id)) };
});

app.get<{ Params: { userId: string } }>("/internal/users/:userId/squads", async (request, reply) => {
  if (!internalAllowed(request)) return reply.code(401).send({ error: "Internal authentication required" });
  const id = Number(request.params.userId);
  if (!Number.isSafeInteger(id) || id <= 0) return reply.code(400).send({ error: "Invalid user ID" });
  const result = await query<{ squad_id: string }>("SELECT squad_id FROM squad_members WHERE user_id = $1", [id]);
  return { squadIds: result.rows.map((row) => row.squad_id) };
});

app.addHook("onClose", async () => { await db.end(); });
app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
