import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { requireIdentity, verifyIdentity } from "./auth.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4103;

await app.register(cookie);
await app.register(websocket);

app.get("/health", async () => ({ ok: true, service: "chat" }));
app.get("/ready", async () => ({ ok: true, service: "chat", database: Boolean(process.env.DATABASE_URL) }));

app.get("/api/chat/rooms", { preHandler: requireIdentity }, async (_request, reply) =>
  reply.code(501).send({ error: "Chat service scaffold: persistence is not implemented" }),
);

app.get("/api/chat/messages", { preHandler: requireIdentity }, async (_request, reply) =>
  reply.code(501).send({ error: "Chat service scaffold: persistence is not implemented" }),
);

app.get("/api/chat/ws", { websocket: true }, async (socket, request) => {
  const identity = await verifyIdentity(request);
  if (!identity) {
    socket.close(1008, "Valid authentication required");
    return;
  }

  socket.send(JSON.stringify({ type: "ready", service: "chat", subject: identity.subject }));
  socket.on("message", () => {
    socket.send(JSON.stringify({ type: "not_implemented", message: "Chat persistence is not implemented" }));
  });
});

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
