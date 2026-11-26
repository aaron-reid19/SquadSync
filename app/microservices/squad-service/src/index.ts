import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { assertRequiredConfig } from "./shared/config.js";
import { requireIdentity } from "./auth.js";

assertRequiredConfig("squad-service", ["DATABASE_URL", "IDENTITY_JWKS_URL", "IDENTITY_ISSUER"]);

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4101;

await app.register(cookie);

app.get("/health", async () => ({ ok: true, service: "squad" }));
app.get("/ready", async () => ({ ok: true, service: "squad", database: Boolean(process.env.DATABASE_URL) }));

app.get("/api/squads", { preHandler: requireIdentity }, async (_request, reply) =>
  reply.code(501).send({ error: "Squad service scaffold: persistence is not implemented" }),
);

app.post("/api/squads", { preHandler: requireIdentity }, async (_request, reply) =>
  reply.code(501).send({ error: "Squad service scaffold: persistence is not implemented" }),
);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
