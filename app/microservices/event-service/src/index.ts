import "dotenv/config";
import Fastify from "fastify";
import { fastifyOptions, registerObservability } from "./shared/fastifyObservability.js";
import cookie from "@fastify/cookie";
import { assertRequiredConfig } from "./shared/config.js";
import { requireIdentity } from "./auth.js";

assertRequiredConfig("event-service", ["DATABASE_URL", "IDENTITY_JWKS_URL", "IDENTITY_ISSUER"]);

const app = Fastify(fastifyOptions("event-service"));
registerObservability(app);
const port = Number(process.env.PORT) || 4102;

await app.register(cookie);

app.get("/health", async () => ({ ok: true, service: "event" }));
app.get("/ready", async () => ({ ok: true, service: "event", database: Boolean(process.env.DATABASE_URL) }));

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
