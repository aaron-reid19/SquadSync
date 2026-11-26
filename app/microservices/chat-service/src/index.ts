import "dotenv/config";
import Fastify, { type FastifyRequest } from "fastify";
import { fastifyOptions, registerObservability } from "./shared/fastifyObservability.js";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { assertRequiredConfig } from "./shared/config.js";
import { pool, query, withTransaction } from "./shared/db.js";
import { jwksCheck, postgresCheck, runReadiness } from "./shared/readiness.js";
import { requireIdentity, verifyIdentity } from "./auth.js";

assertRequiredConfig("chat-service", ["DATABASE_URL", "IDENTITY_JWKS_URL", "IDENTITY_ISSUER"]);

const app = Fastify(fastifyOptions("chat-service"));
registerObservability(app);
const port = Number(process.env.PORT) || 4103;

await app.register(cookie);
await app.register(websocket);

function userId(request: FastifyRequest) {
  return Number(request.identity?.subject);
}

type MessageRow = { id: string; event_id: string; user_id: number | null; body: string; created_at: Date | string };

function toMessage(row: MessageRow) {
  return { id: row.id, eventId: row.event_id, userId: row.user_id == null ? "system" : String(row.user_id), text: row.body, at: new Date(row.created_at).toISOString() };
}

async function roomFor(eventId: string, memberId: number) {
  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>("SELECT id FROM chat_rooms WHERE event_id = $1 ORDER BY created_at LIMIT 1", [eventId]);
    const roomId = existing.rows[0]?.id ?? (await client.query<{ id: string }>("INSERT INTO chat_rooms (event_id, created_by_user_id, name) VALUES ($1, $2, $3) RETURNING id", [eventId, memberId, `Event ${eventId}`])).rows[0].id;
    await client.query("INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roomId, memberId]);
    return roomId;
  });
}

app.get("/health", async () => ({ ok: true, service: "chat" }));
const readinessChecks = {
  database: postgresCheck(pool),
  identityKeys: jwksCheck(process.env.IDENTITY_JWKS_URL),
};
app.get("/ready", async (request, reply) => {
  const result = await runReadiness(readinessChecks);
  if (!result.ok) request.log.warn({ failures: result.failures }, "not ready");
  return reply.code(result.statusCode).send({ ok: result.ok, service: "chat", checks: result.checks });
});

app.get("/api/chat/rooms", { preHandler: requireIdentity }, async (request) => {
  const result = await query<{ id: string; event_id: string; name: string }>(
    `SELECT r.id, r.event_id, r.name FROM chat_rooms r
      JOIN chat_room_members rm ON rm.room_id = r.id WHERE rm.user_id = $1 ORDER BY r.created_at DESC`,
    [userId(request)],
  );
  return result.rows.map((row) => ({ id: row.id, eventId: row.event_id, name: row.name }));
});

app.get<{ Querystring: { eventId?: string } }>("/api/chat/messages", { preHandler: requireIdentity }, async (request) => {
  if (!request.query.eventId) return [];
  const result = await query<MessageRow>(
    `SELECT m.id, r.event_id, m.user_id, m.body, m.created_at
       FROM chat_messages m JOIN chat_rooms r ON r.id = m.room_id
      WHERE r.event_id = $1 ORDER BY m.created_at`,
    [request.query.eventId],
  );
  return result.rows.map(toMessage);
});

app.post<{ Body: { eventId?: string; body?: string } }>("/api/chat/messages", { preHandler: requireIdentity }, async (request, reply) => {
  const eventId = request.body?.eventId?.trim();
  const body = request.body?.body?.trim();
  if (!eventId || !body || body.length > 500) return reply.code(400).send({ error: "A message is required" });
  const roomId = await roomFor(eventId, userId(request));
  const result = await query<MessageRow>(
    `INSERT INTO chat_messages (room_id, user_id, body) VALUES ($1, $2, $3)
     RETURNING id, $4::text AS event_id, user_id, body, created_at`,
    [roomId, userId(request), body, eventId],
  );
  return reply.code(201).send(toMessage(result.rows[0]));
});

app.get("/api/chat/ws", { websocket: true }, async (socket, request) => {
  const identity = await verifyIdentity(request);
  if (!identity) {
    socket.close(1008, "Valid authentication required");
    return;
  }
  socket.send(JSON.stringify({ type: "ready", service: "chat", subject: identity.subject }));
  socket.on("message", async (raw: { toString(): string }) => {
    try {
      const parsed = JSON.parse(raw.toString()) as { eventId?: string; body?: string };
      const eventId = parsed.eventId?.trim();
      const body = parsed.body?.trim();
      if (!eventId || !body) return;
      const roomId = await roomFor(eventId, Number(identity.subject));
      const result = await query<MessageRow>(
        `INSERT INTO chat_messages (room_id, user_id, body) VALUES ($1, $2, $3)
         RETURNING id, $4::text AS event_id, user_id, body, created_at`,
        [roomId, Number(identity.subject), body, eventId],
      );
      socket.send(JSON.stringify({ type: "message", message: toMessage(result.rows[0]) }));
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid chat message" }));
    }
  });
});

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
