import "dotenv/config";
import Fastify from "fastify";
import { fastifyOptions, registerObservability } from "./shared/fastifyObservability.js";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { assertRequiredConfig } from "./shared/config.js";
import { pool } from "./shared/db.js";
import { jwksCheck, postgresCheck, runReadiness } from "./shared/readiness.js";
import { requireIdentity, verifyIdentity } from "./auth.js";

assertRequiredConfig("chat-service", ["DATABASE_URL", "IDENTITY_JWKS_URL", "IDENTITY_ISSUER"]);

const app = Fastify(fastifyOptions("chat-service"));
registerObservability(app);
const port = Number(process.env.PORT) || 4103;

await app.register(cookie);
await app.register(websocket);

// Liveness: the process is up. Never checks dependencies, so a database blip
// doesn't make Kubernetes restart every pod.
// Readiness: PostgreSQL answers and identity signing keys are available.
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
