import "dotenv/config";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4104;

async function requireServiceToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!process.env.SERVICE_TOKEN || request.headers["x-service-token"] !== process.env.SERVICE_TOKEN) {
    reply.code(401).send({ error: "Service authentication required" });
    return;
  }
}

app.get("/health", async () => ({ ok: true, service: "notification-worker" }));
app.get("/ready", async () => ({ ok: true, service: "notification-worker", smtpConfigured: Boolean(process.env.SMTP_URL) }));

app.post("/internal/notifications", { preHandler: requireServiceToken }, async (_request, reply) =>
  reply.code(501).send({ error: "Notification worker scaffold: delivery is not implemented" }),
);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
