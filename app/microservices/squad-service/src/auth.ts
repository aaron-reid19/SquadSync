import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface IdentityContext {
  subject: string;
  scopes: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    identity?: IdentityContext;
  }
}

const jwks = createRemoteJWKSet(new URL(process.env.IDENTITY_JWKS_URL ?? "http://localhost:4100/.well-known/jwks.json"));
const identityCookieName = process.env.IDENTITY_COOKIE_NAME ?? "squadsync-access";

export async function requireIdentity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? request.cookies?.[identityCookieName];
  if (!token) {
    reply.code(401).send({ error: "Authentication required" });
    return;
  }

  try {
    const verified = await jwtVerify(token, jwks, {
      issuer: process.env.IDENTITY_ISSUER ?? "http://localhost:4100",
      audience: process.env.IDENTITY_AUDIENCE ?? "squadsync-api",
      algorithms: ["RS256"],
    });
    if (!verified.payload.sub) {
      reply.code(401).send({ error: "Token subject missing" });
      return;
    }
    request.identity = {
      subject: verified.payload.sub,
      scopes: typeof verified.payload.scope === "string" ? verified.payload.scope.split(" ").filter(Boolean) : [],
    };
  } catch {
    reply.code(401).send({ error: "Invalid identity token" });
  }
}
