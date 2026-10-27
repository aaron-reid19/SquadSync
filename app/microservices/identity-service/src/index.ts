import "dotenv/config";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import {
  exportJWK,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
} from "jose";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4100;
const issuer = process.env.IDENTITY_ISSUER ?? `http://localhost:${port}`;
const audience = process.env.IDENTITY_AUDIENCE ?? "squadsync-api";
const keyId = process.env.IDENTITY_KEY_ID ?? "dev-identity-key";
const cookieName = process.env.IDENTITY_COOKIE_NAME ??
  (process.env.NODE_ENV === "production" ? "__Host-squadsync-access" : "squadsync-access");
const accessTokenTtl = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 900;

type SigningKey = Parameters<SignJWT["sign"]>[0];
let privateKey: SigningKey;
let publicKey: SigningKey;
let publicJwk: Record<string, unknown>;

function pem(value: string | undefined) {
  return value?.replace(/\\n/g, "\n");
}

async function loadSigningKeys() {
  const privatePem = pem(process.env.IDENTITY_PRIVATE_KEY_PEM);
  const publicPem = pem(process.env.IDENTITY_PUBLIC_KEY_PEM);

  if (privatePem && publicPem) {
    privateKey = await importPKCS8(privatePem, "RS256");
    publicKey = await importSPKI(publicPem, "RS256");
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("IDENTITY_PRIVATE_KEY_PEM and IDENTITY_PUBLIC_KEY_PEM are required in production");
    }
    const generated = await generateKeyPair("RS256");
    privateKey = generated.privateKey;
    publicKey = generated.publicKey;
    app.log.warn("Identity signing keys are ephemeral; configure persistent keys before deployment");
  }

  publicJwk = { ...(await exportJWK(publicKey)), kid: keyId, alg: "RS256", use: "sig" };
}

async function requireInternalToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const configured = process.env.IDENTITY_INTERNAL_TOKEN;
  if (!configured || request.headers["x-internal-token"] !== configured) {
    reply.code(401).send({ error: "Internal authentication required" });
    return;
  }
}

async function verifyAccessToken(token: string) {
  return jwtVerify(token, publicKey, { issuer, audience, algorithms: ["RS256"] });
}

await loadSigningKeys();
await app.register(cookie);

app.get("/health", async () => ({ ok: true, service: "identity" }));
app.get("/ready", async () => ({ ok: true, service: "identity", signingKeys: "loaded" }));

app.get("/.well-known/jwks.json", async () => ({ keys: [publicJwk] }));

app.post<{ Body: { subject?: string; scopes?: string[] } }>(
  "/internal/tokens",
  { preHandler: requireInternalToken },
  async (request, reply) => {
    const subject = request.body?.subject?.trim();
    if (!subject) return reply.code(400).send({ error: "subject is required" });

    const scopes = Array.isArray(request.body?.scopes) ? request.body.scopes : [];
    const token = await new SignJWT({ scope: scopes.join(" ") })
      .setProtectedHeader({ alg: "RS256", kid: keyId, typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime(`${accessTokenTtl}s`)
      .sign(privateKey);

    reply.setCookie(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: accessTokenTtl,
    });
    return { accessToken: token, tokenType: "Bearer", expiresIn: accessTokenTtl };
  },
);

app.get("/api/identity/me", async (request, reply) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? request.cookies[cookieName];
  if (!token) return reply.code(401).send({ error: "Not authenticated" });

  try {
    const verified = await verifyAccessToken(token);
    return { subject: verified.payload.sub, issuer: verified.payload.iss, scopes: verified.payload.scope ?? "" };
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
});

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
