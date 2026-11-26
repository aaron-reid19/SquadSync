// HTTP in, use case out. Validation and status codes live here; rules live in services.
import type { FastifyReply, FastifyRequest } from "fastify";
import { createSquadSchema, joinSquadSchema, squadParamsSchema } from "../schemas/squadSchemas.js";
import * as squads from "../services/squadService.js";

const MAX_INT4 = 2_147_483_647;

// auth_db user IDs are integers; identity tokens carry them as the JWT subject.
function userIdOf(request: FastifyRequest): number | undefined {
  const subject = request.identity?.subject ?? "";
  if (!/^[1-9][0-9]{0,9}$/.test(subject)) return undefined;
  const id = Number(subject);
  return id <= MAX_INT4 ? id : undefined;
}

function send(reply: FastifyReply, request: FastifyRequest, status: number, body: Record<string, unknown>) {
  return reply.code(status).send({ ...body, requestId: request.id });
}

// Same answer for "doesn't exist" and "not a member", so Squad IDs can't be probed.
const notFound = (request: FastifyRequest, reply: FastifyReply) => send(reply, request, 404, { error: "Squad not found" });

/** Wraps a handler so every request has a supported user ID. */
function withUser(handler: (userId: number, request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = userIdOf(request);
    if (userId === undefined) return send(reply, request, 403, { error: "Unsupported identity" });
    return handler(userId, request, reply);
  };
}

export const listSquads = withUser(async (userId) => ({ squads: await squads.listMySquads(userId) }));

export const createSquad = withUser(async (userId, request, reply) => {
  const parsed = createSquadSchema.safeParse(request.body);
  if (!parsed.success) return send(reply, request, 400, { error: "Invalid request" });
  return reply.code(201).send({ squad: await squads.createSquad(userId, parsed.data) });
});

export const getSquad = withUser(async (userId, request, reply) => {
  const params = squadParamsSchema.safeParse(request.params);
  if (!params.success) return notFound(request, reply);
  const squad = await squads.getSquad(userId, params.data.squadId);
  return squad ? { squad } : notFound(request, reply);
});

export const joinSquad = withUser(async (userId, request, reply) => {
  const parsed = joinSquadSchema.safeParse(request.body);
  if (!parsed.success) return send(reply, request, 400, { error: "That invite code isn't valid.", field: "code" });

  const result = await squads.joinSquad(userId, parsed.data.code);
  if (result.status === "invalid_code") {
    return send(reply, request, 404, { error: "No Squad uses that invite code.", field: "code" });
  }
  const joined = result.status === "joined";
  return reply.code(joined ? 201 : 200).send({ squad: result.squad, joined });
});

export const leaveSquad = withUser(async (userId, request, reply) => {
  const params = squadParamsSchema.safeParse(request.params);
  if (!params.success) return notFound(request, reply);

  const outcome = await squads.leaveSquad(userId, params.data.squadId);
  if (outcome === "not_found") return notFound(request, reply);
  if (outcome === "owner_must_transfer") {
    return send(reply, request, 409, {
      error: "You own this Squad. Transfer ownership to another member before leaving.",
      code: "OWNER_MUST_TRANSFER",
    });
  }
  return { left: true, squadDeleted: outcome === "squad_deleted" };
});
