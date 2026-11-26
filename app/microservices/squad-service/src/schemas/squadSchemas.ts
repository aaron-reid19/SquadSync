import { z } from "zod";

// Six letters without I or O (same alphabet as the UI demo store).
export const JOIN_CODE_PATTERN = /^[A-HJ-NP-Z]{6}$/;

export const createSquadSchema = z
  .object({
    name: z.string().trim().min(1).max(40).regex(/^[^\p{Cc}]+$/u),
    emoji: z.string().trim().min(1).max(16).regex(/^\S+$/u).optional(),
  })
  .strict();

export const joinSquadSchema = z
  .object({ code: z.string().trim().toUpperCase().regex(JOIN_CODE_PATTERN) })
  .strict();

export const squadParamsSchema = z.object({ squadId: z.uuid() });

/** Response shape. Matches the UI's `Squad` type, plus the caller's role and a count. */
export interface SquadResponse {
  id: string;
  name: string;
  emoji: string;
  code: string;
  createdBy: string;
  createdAt: string;
  role: "owner" | "member";
  memberIds: string[];
  memberCount: number;
}
