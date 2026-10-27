import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
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

function tokenFrom(request: FastifyRequest) {
  return request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? request.cookies?.[identityCookieName];
}

function toIdentity(payload: JWTPayload): IdentityContext | undefined {
  if (!payload.sub) return undefined;
  return {
    subject: payload.sub,
    scopes: typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [],
  };
}

export async function verifyIdentity(request: FastifyRequest) {
  const token = tokenFrom(request);
  if (!token) return undefined;

  try {
    const verified = await jwtVerify(token, jwks, {
      issuer: process.env.IDENTITY_ISSUER ?? "http://localhost:4100",
      audience: process.env.IDENTITY_AUDIENCE ?? "squadsync-api",
      algorithms: ["RS256"],
    });
    return toIdentity(verified.payload);
  } catch {
    return undefined;
  }
}

export async function requireIdentity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const identity = await verifyIdentity(request);
  if (!identity) {
    reply.code(401).send({ error: "Valid authentication required" });
    return;
  }
  request.identity = identity;
}
