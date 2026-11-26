// Squad rules: ownership, join codes, and leave behaviour. No HTTP or SQL here.
import { randomInt } from "node:crypto";
import { pool, withTransaction } from "../shared/db.js";
import * as repo from "../repositories/squadRepository.js";
import type { SquadRow } from "../repositories/squadRepository.js";
import type { SquadResponse } from "../schemas/squadSchemas.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;
const DEFAULT_EMOJI = "👥";

function newJoinCode() {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

function isJoinCodeCollision(error: unknown) {
  const e = error as { code?: string; constraint?: string };
  return e.code === "23505" && e.constraint === "squads_join_code_key";
}

export function toSquadResponse(row: SquadRow): SquadResponse {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    code: row.join_code,
    createdBy: String(row.created_by_user_id),
    createdAt: row.created_at.toISOString(),
    role: row.role,
    memberIds: row.member_ids.map(String),
    memberCount: row.member_ids.length,
  };
}

export async function listMySquads(userId: number) {
  return (await repo.listSquadsForMember(pool, userId)).map(toSquadResponse);
}

export async function getSquad(userId: number, squadId: string) {
  const row = await repo.findSquadForMember(pool, squadId, userId);
  return row && toSquadResponse(row);
}

/** US-10: creates a Squad with a unique invite code; the creator becomes its owner. */
export async function createSquad(userId: number, input: { name: string; emoji?: string }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await withTransaction(async (client) => {
        const squadId = await repo.insertSquad(client, {
          name: input.name,
          emoji: input.emoji ?? DEFAULT_EMOJI,
          joinCode: newJoinCode(),
          createdBy: userId,
        });
        await repo.addMember(client, squadId, userId, "owner");
        return toSquadResponse((await repo.findSquadForMember(client, squadId, userId))!);
      });
    } catch (error) {
      if (isJoinCodeCollision(error) && attempt < MAX_CODE_ATTEMPTS) continue;
      throw error;
    }
  }
}

export type JoinResult = { status: "joined" | "already_member"; squad: SquadResponse } | { status: "invalid_code" };

/** US-11: joins by invite code. Joining a Squad you are already in changes nothing. */
export async function joinSquad(userId: number, joinCode: string): Promise<JoinResult> {
  return withTransaction(async (client) => {
    // The share lock stops a concurrent "last owner leaves" from deleting the Squad mid-join.
    const squadId = await repo.findSquadIdByCodeForShare(client, joinCode);
    if (!squadId) return { status: "invalid_code" };
    const added = await repo.addMember(client, squadId, userId, "member");
    const squad = toSquadResponse((await repo.findSquadForMember(client, squadId, userId))!);
    return { status: added ? "joined" : "already_member", squad };
  });
}

export type LeaveResult = "left" | "squad_deleted" | "owner_must_transfer" | "not_found";

/**
 * US-12: leaves a Squad. An owner with other members must transfer ownership
 * first; an owner who is the last member deletes the Squad.
 */
export async function leaveSquad(userId: number, squadId: string): Promise<LeaveResult> {
  return withTransaction(async (client) => {
    // Serialises with joins and other leaves so the member list can't change underneath us.
    if (!(await repo.lockSquadForUpdate(client, squadId))) return "not_found";

    const role = await repo.findMemberRole(client, squadId, userId);
    if (!role) return "not_found";

    if (role === "owner") {
      if (await repo.hasOtherMembers(client, squadId, userId)) return "owner_must_transfer";
      await repo.deleteSquad(client, squadId);
      return "squad_deleted";
    }

    await repo.removeMember(client, squadId, userId);
    return "left";
  });
}
