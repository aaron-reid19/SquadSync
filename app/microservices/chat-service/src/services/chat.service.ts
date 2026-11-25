import { ChatRepository } from "../repositories/chat.repository";
import {
  ChatServiceError,
  type ChatMessage,
  type CreateRoomInput,
  type GetHistoryOptions,
  type ListRoomsOptions,
  type Page,
  type Room,
  type SendMessageInput,
  type UserId,
} from "../shared/chat.types";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const MAX_ROOM_NAME_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 4000;

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ChatServiceError(`${field} must be a positive integer`, "INVALID_ARGUMENT", 400);
  }
  return value;
}

function pageSize(value: number | undefined): number {
  const limit = value ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new ChatServiceError(`limit must be between 1 and ${MAX_PAGE_SIZE}`, "INVALID_ARGUMENT", 400);
  }
  return limit;
}

export class ChatService {
  constructor(private readonly repository: ChatRepository) {}

  async createRoom(userId: UserId, input: CreateRoomInput): Promise<Room> {
    positiveInteger(userId, "userId");
    const name = input?.name?.trim();
    if (!name || name.length > MAX_ROOM_NAME_LENGTH) {
      throw new ChatServiceError(
        `Room name must contain 1-${MAX_ROOM_NAME_LENGTH} characters`,
        "INVALID_ARGUMENT",
        400,
      );
    }
    return this.repository.createRoom(userId, { name });
  }

  async listRooms(userId: UserId, options: ListRoomsOptions = {}): Promise<Room[]> {
    positiveInteger(userId, "userId");
    const limit = pageSize(options.limit);
    const offset = options.offset ?? 0;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ChatServiceError("offset must be a non-negative integer", "INVALID_ARGUMENT", 400);
    }
    return this.repository.listRooms(userId, { limit, offset });
  }

  async joinRoom(userId: UserId, roomId: number): Promise<void> {
    positiveInteger(userId, "userId");
    positiveInteger(roomId, "roomId");
    if (!(await this.repository.roomExists(roomId))) {
      throw new ChatServiceError("Room not found", "NOT_FOUND", 404);
    }
    await this.repository.joinRoom(userId, roomId);
  }

  /** Shared authorization check for both REST history and WebSocket room joins. */
  async assertRoomMember(userId: UserId, roomId: number): Promise<void> {
    positiveInteger(userId, "userId");
    positiveInteger(roomId, "roomId");
    if (!(await this.repository.isMember(userId, roomId))) {
      throw new ChatServiceError("You are not a member of this room", "FORBIDDEN", 403);
    }
  }

  async getHistory(
    userId: UserId,
    roomId: number,
    options: GetHistoryOptions = {},
  ): Promise<Page<ChatMessage>> {
    await this.assertRoomMember(userId, roomId);
    const limit = pageSize(options.limit);
    const rows = await this.repository.getHistory(roomId, { limit, before: options.before });
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const chronological = selected.reverse();
    const last = chronological[0];
    const nextCursor = hasMore && last
      ? { createdAt: last.createdAt, id: last.id }
      : null;
    return { items: chronological, nextCursor };
  }

  /**
   * WebSocket adapter calls this method; there is deliberately no REST
   * send-message endpoint. Persistence happens before the adapter broadcasts.
   */
  async sendMessage(userId: UserId, input: SendMessageInput): Promise<ChatMessage> {
    positiveInteger(userId, "userId");
    positiveInteger(input?.roomId, "roomId");
    const body = input?.body?.trim();
    if (!body || body.length > MAX_MESSAGE_LENGTH) {
      throw new ChatServiceError(
        `Message body must contain 1-${MAX_MESSAGE_LENGTH} characters`,
        "INVALID_ARGUMENT",
        400,
      );
    }
    await this.assertRoomMember(userId, input.roomId);
    return this.repository.createMessage(userId, { roomId: input.roomId, body });
  }
}
