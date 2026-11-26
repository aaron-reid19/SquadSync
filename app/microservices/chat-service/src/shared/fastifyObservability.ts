// Copied into each Fastify service's src/shared/ by scripts/sync-shared.sh. Edit the _shared copy.
import type { FastifyError, FastifyInstance, FastifyServerOptions } from "fastify";
import { REQUEST_ID_HEADER, isProbePath, requestIdFrom } from "./requestId.js";

/** Logger and request-ID options shared by every Fastify service. */
export function fastifyOptions(service: string): FastifyServerOptions {
  return {
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      base: { service },
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "req.headers[\"x-internal-token\"]", "req.headers[\"x-service-token\"]"],
        censor: "[redacted]",
      },
    },
    // Validated in genReqId instead of trusted blindly. Logged as "reqId" (Fastify default).
    requestIdHeader: false,
    genReqId: (request) => requestIdFrom(request.headers[REQUEST_ID_HEADER]),
  };
}

/**
 * Call right after creating the app, before registering routes.
 * Echoes the request ID, quiets probe logs, and keeps error bodies generic.
 */
export function registerObservability(app: FastifyInstance) {
  app.addHook("onRoute", (route) => {
    if (isProbePath(route.url)) route.logLevel = "warn";
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, "request failed");
      return reply.code(status).send({ error: "Something went wrong", requestId: request.id });
    }
    request.log.info({ code: error.code, status }, "request rejected");
    return reply.code(status).send({ error: error.validation ? "Invalid request" : error.message, requestId: request.id });
  });

  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: "Not found", requestId: request.id }));
}
