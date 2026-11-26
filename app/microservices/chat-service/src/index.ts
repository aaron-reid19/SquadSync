import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { requireIdentity, verifyIdentity } from "./auth.js";
import { db, query } from "./db.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4103;
const eventServiceUrl = process.env.EVENT_SERVICE_URL ?? "http://localhost:4102";
await app.register(cookie);
await app.register(websocket);

function currentUserId(request: FastifyRequest) {
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

async function eventMembers(eventId: string) {
  const response = await fetch(`${eventServiceUrl}/internal/events/${encodeURIComponent(eventId)}/members`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!response.ok) return null;
  return await response.json() as { isPublic: boolean; memberIds: string[] };
}
async function roomFor(eventId: string, userId: number) {
  const event = await eventMembers(eventId);
  if (!event || (!event.isPublic && !event.memberIds.includes(String(userId)))) return null;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO chat_rooms (event_id, created_by_user_id, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO UPDATE SET event_id = EXCLUDED.event_id
      RETURNING id
    `, [eventId, event.memberIds[0] ? Number(event.memberIds[0]) : userId, `Event ${eventId}`]);
    const roomId = inserted.rows[0].id;
    for (const memberId of event.memberIds) {
      await client.query("INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roomId, Number(memberId)]);
    }
    await client.query("INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roomId, userId]);
    await client.query("COMMIT");
    return roomId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
async function messagesForEvent(eventId: string, userId: number) {
  const roomId = await roomFor(eventId, userId);
  if (!roomId) return null;
  const result = await query<{ id: string; room_id: string; user_id: number | null; body: string; created_at: Date }>(
    "SELECT id, room_id, user_id, body, created_at FROM chat_messages WHERE room_id = $1 ORDER BY created_at, id", [roomId],
  );
  return result.rows.map((row) => ({ id: row.id, eventId, userId: row.user_id == null ? "system" : String(row.user_id), text: row.body, at: row.created_at.toISOString() }));
}
async function saveMessage(eventId: string, userId: number, body: string) {
  const roomId = await roomFor(eventId, userId);
  if (!roomId) return null;
  const result = await query<{ id: string; created_at: Date }>(
    "INSERT INTO chat_messages (room_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, created_at", [roomId, userId, body],
  );
  return { id: result.rows[0].id, eventId, userId: String(userId), text: body, at: result.rows[0].created_at.toISOString() };
}

app.get("/health", async () => ({ ok: true, service: "chat" }));
app.get("/ready", async (_request, reply) => {
  try { await query("SELECT 1"); return { ok: true, service: "chat", database: true }; }
  catch { return reply.code(503).send({ ok: false, service: "chat", database: false }); }
});

app.get<{ Querystring: { eventId?: string } }>("/api/chat/messages", { preHandler: requireIdentity }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.query.eventId;
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (!eventId) return reply.code(400).send({ error: "eventId is required" });
  const messages = await messagesForEvent(eventId, id);
  if (!messages) return reply.code(403).send({ error: "You cannot access this event chat." });
  return messages;
});

app.post<{ Body: { eventId?: string; text?: string } }>("/api/chat/messages", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.body?.eventId; const body = request.body?.text?.trim();
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (!eventId || !body || body.length > 500) return reply.code(400).send({ error: "Enter a message of 1 to 500 characters." });
  const message = await saveMessage(eventId, id, body);
  if (!message) return reply.code(403).send({ error: "You cannot access this event chat." });
  return reply.code(201).send(message);
});

app.get("/api/chat/rooms", { preHandler: requireIdentity }, async (request, reply) => {
  const id = currentUserId(request);
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const result = await query<{ id: string; event_id: string | null; name: string; created_at: Date }>(`
    SELECT r.id, r.event_id, r.name, r.created_at
    FROM chat_rooms r JOIN chat_room_members m ON m.room_id = r.id
    WHERE m.user_id = $1 ORDER BY r.created_at DESC
  `, [id]);
  return result.rows.map((r) => ({ id: r.id, eventId: r.event_id, name: r.name, createdAt: r.created_at.toISOString() }));
});

app.get("/api/chat/ws", { websocket: true }, async (socket, request) => {
  const identity = await verifyIdentity(request);
  const userId = Number(identity?.subject);
  if (!identity || !Number.isSafeInteger(userId) || userId <= 0) {
    socket.close(1008, "Valid authentication required");
    return;
  }
  socket.send(JSON.stringify({ type: "ready", service: "chat" }));
  socket.on("message", async (raw) => {
    try {
      const payload = JSON.parse(raw.toString()) as { type?: string; eventId?: string; text?: string };
      if (payload.type !== "message" || !payload.eventId || !payload.text?.trim() || payload.text.trim().length > 500) return;
      const message = await saveMessage(payload.eventId, userId, payload.text.trim());
      if (message) socket.send(JSON.stringify({ type: "message", message }));
    } catch (error) { app.log.warn(error, "Invalid chat WebSocket message"); }
  });
});

app.addHook("onClose", async () => { await db.end(); });
app.listen({ port, host: "0.0.0.0" }).catch((error) => { app.log.error(error); process.exit(1); });
