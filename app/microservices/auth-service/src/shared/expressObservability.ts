// Copied into each Express service's src/shared/ by scripts/sync-shared.sh. Edit the _shared copy.
import type { NextFunction, Request, Response } from "express";
import { REQUEST_ID_HEADER, isProbePath, requestIdFrom } from "./requestId.js";

// Same shape as the Fastify (pino) services, including the "reqId" field,
// so one request can be followed across the gateway and every service.
const LEVELS = { info: 30, warn: 40, error: 50 } as const;

export function createLogger(service: string) {
  function write(level: keyof typeof LEVELS, fields: Record<string, unknown>, msg: string) {
    const line = JSON.stringify({ level: LEVELS[level], time: Date.now(), service, ...fields, msg });
    if (level === "error") console.error(line);
    else console.log(line);
  }
  return {
    info: (fields: Record<string, unknown>, msg: string) => write("info", fields, msg),
    warn: (fields: Record<string, unknown>, msg: string) => write("warn", fields, msg),
    error: (fields: Record<string, unknown>, msg: string) => write("error", fields, msg),
  };
}

export type Logger = ReturnType<typeof createLogger>;

export function requestIdOf(res: Response): string {
  return (res.locals.requestId as string | undefined) ?? "unknown";
}

/**
 * Assigns or reuses x-request-id, sets it on the request (so proxies forward it)
 * and on the response, then logs one line per completed request.
 * Never logs headers, bodies, or query strings: they can carry tokens.
 */
export function requestLogging(log: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = requestIdFrom(req.headers[REQUEST_ID_HEADER]);
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const path = req.originalUrl.split("?")[0];
      if (isProbePath(path) && res.statusCode < 500) return;
      const fields = {
        reqId: requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
      };
      if (res.statusCode >= 500) log.error(fields, "request completed");
      else log.info(fields, "request completed");
    });
    next();
  };
}

/** Final error handler: logs the message server-side and returns a generic body. */
export function errorHandler(log: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error(
      { reqId: requestIdOf(res), err: err instanceof Error ? err.message : "Unknown error" },
      "unhandled error",
    );
    if (res.headersSent) return;
    res.status(500).json({ error: "Something went wrong", requestId: requestIdOf(res) });
  };
}
