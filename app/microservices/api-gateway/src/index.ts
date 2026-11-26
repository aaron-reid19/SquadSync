
import "dotenv/config";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import express, { type Request, type Response } from "express";
import httpProxy from "http-proxy";

const app = express();
const port = Number(process.env.PORT) || 4000;

const authServiceUrl =
  process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";

const identityServiceUrl =
  process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4100";

const squadServiceUrl =
  process.env.SQUAD_SERVICE_URL ?? "http://localhost:4101";

const eventServiceUrl =
  process.env.EVENT_SERVICE_URL ?? "http://localhost:4102";

const chatServiceUrl =
  process.env.CHAT_SERVICE_URL ?? "http://localhost:4103";

app.disable("x-powered-by");

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api-gateway" });
});

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function copyRequestHeaders(req: Request) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (
      !value ||
      name === "host" ||
      name === "content-length" ||
      hopByHopHeaders.has(name.toLowerCase())
    ) {
      continue;
    }

    headers.set(
      name,
      Array.isArray(value) ? value.join(", ") : value
    );
  }

  headers.set("x-forwarded-host", req.headers.host ?? "");
  headers.set("x-forwarded-proto", req.protocol);

  return headers;
}

function copyResponseHeaders(
  response: globalThis.Response,
  res: Response
) {
  response.headers.forEach((value, name) => {
    if (
      name !== "set-cookie" &&
      !hopByHopHeaders.has(name.toLowerCase())
    ) {
      res.setHeader(name, value);
    }
  });

  const getSetCookie = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;

  const cookies = getSetCookie?.call(response.headers);

  if (cookies?.length) {
    res.setHeader("set-cookie", cookies);
  }
}

/**
 * Proxy requests to individual microservices.
 */
function proxyTo(serviceName: string, serviceUrl: string) {
  return async function proxyRequest(
    req: Request,
    res: Response
  ) {
    try {
      const target = new URL(req.originalUrl, serviceUrl);

      const method = req.method.toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD";

      const body = hasBody
        ? (Readable.toWeb(req) as ReadableStream<Uint8Array>)
        : undefined;

      const init: RequestInit & { duplex?: "half" } = {
        method,
        headers: copyRequestHeaders(req),
        body,
        duplex: hasBody ? "half" : undefined,
      };

      console.log(
        `[API Gateway] ${method} ${req.originalUrl} -> ${serviceName}`
      );

      const response = await fetch(target, init);

      res.status(response.status);
      copyResponseHeaders(response, res);

      if (!response.body) {
        res.end();
        return;
      }

      Readable.fromWeb(response.body as any).pipe(res);

    } catch (error) {
      console.error(
        `[API Gateway] ${serviceName} unavailable: ${req.method} ${req.originalUrl}`,
        error
      );

      if (res.headersSent) {
        res.destroy(
          error instanceof Error ? error : undefined
        );
        return;
      }

      const message =
        process.env.NODE_ENV === "production"
          ? "Upstream service unavailable"
          : `Upstream service unavailable: ${serviceName}`;

      res.status(502).json({
        error: message,
        code: "UPSTREAM_SERVICE_UNAVAILABLE",
      });
    }
  };
}

// Browser API routes
app.use(
  "/api/auth",
  proxyTo("auth-service", authServiceUrl)
);

app.use(
  "/api/identity",
  proxyTo("identity-service", identityServiceUrl)
);

app.use(
  "/api/squads",
  proxyTo("squad-service", squadServiceUrl)
);

app.use(
  "/api/events",
  proxyTo("event-service", eventServiceUrl)
);

app.use(
  "/api/chat",
  proxyTo("chat-service", chatServiceUrl)
);

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "API route not found",
  });
});

// HTTP server
const server = createServer(app);

// WebSocket proxy for Chat Service
const websocketProxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
});

websocketProxy.on("error", (error, _request, socket) => {
  console.error(
    "[API Gateway] Chat WebSocket proxy failed:",
    error.message
  );

  if (socket && "destroy" in socket) {
    socket.destroy();
  }
});

server.on("upgrade", (request, socket, head) => {
  if (request.url?.startsWith("/api/chat/ws")) {
    websocketProxy.ws(request, socket, head, {
      target: chatServiceUrl,
    });
    return;
  }

  socket.destroy();
});

// Start API Gateway
server.listen(port, "0.0.0.0", () => {
  console.log(
    `API Gateway running on http://localhost:${port}`
  );

  console.log("Connected service targets:");
  console.log("Auth:", authServiceUrl);
  console.log("Identity:", identityServiceUrl);
  console.log("Squad:", squadServiceUrl);
  console.log("Event:", eventServiceUrl);
  console.log("Chat:", chatServiceUrl);
});
