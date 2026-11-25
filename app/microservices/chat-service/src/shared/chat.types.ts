/**
 * Shared chat-domain contracts.
 *
 * These types are intentionally transport-agnostic: REST controllers and the
 * WebSocket adapter should both call the services using these contracts.
 */

export type UserId = number;
export type RoomId = number;
export type MessageId = number;

export interface Room {
  id: RoomId;
  name: string;
  createdBy: UserId;
  createdAt: string;
  memberCount?: number;
}

export interface ChatMessage {
  id: MessageId;
  roomId: RoomId;
  senderId: UserId;
  body: string;
  createdAt: string;
}

export interface CreateRoomInput {
  name: string;
}

export interface ListRoomsOptions {
  limit?: number;
  offset?: number;
}

export interface HistoryCursor {
  /** ISO-8601 timestamp of the last message in the preceding page. */
  createdAt: string;
  /** Message ID breaks timestamp ties and prevents skipped messages. */
  id: MessageId;
}

export interface GetHistoryOptions {
  limit?: number;
  before?: HistoryCursor;
}

export interface SendMessageInput {
  roomId: RoomId;
  body: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: HistoryCursor | null;
}

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_ARGUMENT"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT",
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}
