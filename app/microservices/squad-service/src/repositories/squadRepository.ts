// All squad_db SQL lives here. Functions take a pool or a transaction client so
// services decide the transaction boundaries.
import type pg from "pg";

type Db = pg.Pool | pg.PoolClient;

export interface SquadRow {
  id: string;
  name: string;
  emoji: string;
  join_code: string;
  created_by_user_id: number;
  created_at: Date;
  role: "owner" | "member";
  member_ids: number[];
}

const SQUAD_FOR_MEMBER_SQL = `
  SELECT s.id, s.name, s.emoji, s.join_code, s.created_by_user_id, s.created_at, me.role,
         ARRAY(SELECT m.user_id FROM squad_members m WHERE m.squad_id = s.id ORDER BY m.joined_at, m.user_id) AS member_ids
  FROM squads s
  JOIN squad_members me ON me.squad_id = s.id AND me.user_id = $1`;

export async function listSquadsForMember(db: Db, userId: number) {
  return (await db.query<SquadRow>(`${SQUAD_FOR_MEMBER_SQL} ORDER BY me.joined_at DESC, s.id`, [userId])).rows;
}

/** The Squad as seen by one member, or undefined when it doesn't exist or they aren't in it. */
export async function findSquadForMember(db: Db, squadId: string, userId: number) {
  return (await db.query<SquadRow>(`${SQUAD_FOR_MEMBER_SQL} WHERE s.id = $2`, [userId, squadId])).rows[0];
}

export async function insertSquad(db: Db, squad: { name: string; emoji: string; joinCode: string; createdBy: number }) {
  const result = await db.query<{ id: string }>(
    "INSERT INTO squads (name, emoji, join_code, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING id",
    [squad.name, squad.emoji, squad.joinCode, squad.createdBy],
  );
  return result.rows[0].id;
}

export async function deleteSquad(db: Db, squadId: string) {
  await db.query("DELETE FROM squads WHERE id = $1", [squadId]);
}

/** Locks the Squad row for the rest of the transaction. Returns false if it doesn't exist. */
export async function lockSquadForUpdate(db: Db, squadId: string) {
  return Boolean((await db.query("SELECT 1 FROM squads WHERE id = $1 FOR UPDATE", [squadId])).rowCount);
}

/** Finds a Squad by code and holds a share lock so it can't be deleted until commit. */
export async function findSquadIdByCodeForShare(db: Db, joinCode: string) {
  return (await db.query<{ id: string }>("SELECT id FROM squads WHERE join_code = $1 FOR SHARE", [joinCode])).rows[0]?.id;
}

/** Adds a member. Returns false when they were already in the Squad. */
export async function addMember(db: Db, squadId: string, userId: number, role: "owner" | "member") {
  const result = await db.query(
    "INSERT INTO squad_members (squad_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (squad_id, user_id) DO NOTHING",
    [squadId, userId, role],
  );
  return Boolean(result.rowCount);
}

export async function findMemberRole(db: Db, squadId: string, userId: number) {
  return (await db.query<{ role: "owner" | "member" }>(
    "SELECT role FROM squad_members WHERE squad_id = $1 AND user_id = $2",
    [squadId, userId],
  )).rows[0]?.role;
}

export async function hasOtherMembers(db: Db, squadId: string, userId: number) {
  return Boolean((await db.query(
    "SELECT 1 FROM squad_members WHERE squad_id = $1 AND user_id <> $2 LIMIT 1",
    [squadId, userId],
  )).rowCount);
}

export async function removeMember(db: Db, squadId: string, userId: number) {
  await db.query("DELETE FROM squad_members WHERE squad_id = $1 AND user_id = $2", [squadId, userId]);
}
