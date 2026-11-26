import "dotenv/config";
import Fastify from "fastify";
import { fastifyOptions, registerObservability } from "./shared/fastifyObservability.js";
import cookie from "@fastify/cookie";
import { assertRequiredConfig } from "./shared/config.js";
import { pool } from "./shared/db.js";
import { jwksCheck, postgresCheck, runReadiness } from "./shared/readiness.js";
import { requireIdentity } from "./auth.js";

assertRequiredConfig("event-service", ["DATABASE_URL", "IDENTITY_JWKS_URL", "IDENTITY_ISSUER"]);

const app = Fastify(fastifyOptions("event-service"));
registerObservability(app);
const port = Number(process.env.PORT) || 4102;

await app.register(cookie);

// Liveness: the process is up. Never checks dependencies, so a database blip
// doesn't make Kubernetes restart every pod.
// Readiness: PostgreSQL answers and identity signing keys are available.
app.get("/health", async () => ({ ok: true, service: "event" }));
const readinessChecks = {
  database: postgresCheck(pool),
  identityKeys: jwksCheck(process.env.IDENTITY_JWKS_URL),
};
app.get("/ready", async (request, reply) => {
  const result = await runReadiness(readinessChecks);
  if (!result.ok) request.log.warn({ failures: result.failures }, "not ready");
  return reply.code(result.statusCode).send({ ok: result.ok, service: "event", checks: result.checks });
});

app.get("/api/events", { preHandler: requireIdentity }, async (_request, reply) =>
  reply.code(501).send({ error: "Event service scaffold: persistence is not implemented" }),
);

app.post("/api/events", { preHandler: requireIdentity }, async (_request, reply) =>
  reply.code(501).send({ error: "Event service scaffold: persistence is not implemented" }),
);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
