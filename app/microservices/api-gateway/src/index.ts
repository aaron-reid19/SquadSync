import "dotenv/config";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import express, { type Request, type Response } from "express";
import httpProxy from "http-proxy";

const app = express();
const port = Number(process.env.PORT) || 4000;
const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:4001";
const identityServiceUrl = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4100";
const squadServiceUrl = process.env.SQUAD_SERVICE_URL ?? "http://localhost:4101";
const eventServiceUrl = process.env.EVENT_SERVICE_URL ?? "http://localhost:4102";
const chatServiceUrl = process.env.CHAT_SERVICE_URL ?? "http://localhost:4103";

app.disable("x-powered-by");
app.get("/health", (_req, res) => res.json({ ok: true, service: "api-gateway" }));

function copyRequestHeaders(req: Request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || name === "host" || name === "content-length") continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("x-forwarded-host", req.headers.host ?? "");
  headers.set("x-forwarded-proto", req.protocol);
  return headers;
}

function copyResponseHeaders(response: globalThis.Response, res: Response) {
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie") res.setHeader(name, value);
  });

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie?.call(response.headers);
  if (cookies?.length) res.setHeader("set-cookie", cookies);
}

function proxyTo(serviceUrl: string) {
  return async function proxyRequest(req: Request, res: Response) {
    const target = new URL(req.originalUrl, serviceUrl);
  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: copyRequestHeaders(req),
    body: hasBody ? (req as unknown as BodyInit) : undefined,
    duplex: hasBody ? "half" : undefined,
  };

    try {
      const response = await fetch(target, init);
      res.status(response.status);
      copyResponseHeaders(response, res);
      if (!response.body) {
        res.end();
        return;
      }
      Readable.fromWeb(response.body as any).pipe(res);
    } catch (error) {
      console.error("Service proxy failed:", error instanceof Error ? error.message : "unknown error");
      res.status(502).json({ error: "Upstream service unavailable" });
    }
  };
}

// All browser API calls enter here. Keep domain services private behind the gateway.
app.use("/api/auth", proxyTo(authServiceUrl));
app.use("/api/identity", proxyTo(identityServiceUrl));
app.use("/api/squads", proxyTo(squadServiceUrl));
app.use("/api/events", proxyTo(eventServiceUrl));
app.use("/api/chat", proxyTo(chatServiceUrl));
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));

const server = createServer(app);
const websocketProxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true });
websocketProxy.on("error", (error, _request, socket) => {
  console.error("Chat WebSocket proxy failed:", error.message);
  if (socket && "destroy" in socket) socket.destroy();
});

server.on("upgrade", (request, socket, head) => {
  if (request.url?.startsWith("/api/chat/ws")) {
    websocketProxy.ws(request, socket, head, { target: chatServiceUrl });
    return;
  }
  socket.destroy();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`API gateway running on http://localhost:${port}`);
});
