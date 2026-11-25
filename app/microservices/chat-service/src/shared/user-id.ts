import { ChatServiceError, type UserId } from "./chat.types";

/**
 * Convert the authenticated identity's `subject` claim into the numeric user
 * key used by the current PostgreSQL schema. Do not parse IDs independently in
 * REST and WebSocket adapters.
 */
export function parseUserId(subject: unknown): UserId {
  const value =
    typeof subject === "number"
      ? subject
      : typeof subject === "string" && /^\d+$/.test(subject.trim())
        ? Number(subject.trim())
        : Number.NaN;

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ChatServiceError("Invalid authenticated user ID", "INVALID_ARGUMENT", 401);
  }

  return value;
}
