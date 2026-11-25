import type { Pool, PoolClient } from "pg";
import type {
  ChatMessage,
  CreateRoomInput,
  GetHistoryOptions,
  HistoryCursor,
  ListRoomsOptions,
  Room,
  SendMessageInput,
  UserId,
} from "../shared/chat.types";

type Db = Pool | PoolClient;

interface RoomRow {
  id: number;
  name: string;
  created_by: number;
  created_at: Date | string;
  member_count?: string | number;
}

interface MessageRow {
  id: number;
  room_id: number;
  sender_id: number;
  body: string;
  created_at: Date | string;
}

const roomFromRow = (row: RoomRow): Room => ({
  id: Number(row.id),
  name: row.name,
  createdBy: Number(row.created_by),
  createdAt: new Date(row.created_at).toISOString(),
  ...(row.member_count === undefined ? {} : { memberCount: Number(row.member_count) }),
});

const messageFromRow = (row: MessageRow): ChatMessage => ({
  id: Number(row.id),
  roomId: Number(row.room_id),
  senderId: Number(row.sender_id),
  body: row.body,
  createdAt: new Date(row.created_at).toISOString(),
});

/**
 * PostgreSQL persistence only. No HTTP, Fastify, or WebSocket dependencies.
 * The Pool is injected by the chat-service composition root.
 */
export class ChatRepository {
  constructor(private readonly db: Pool) {}

  async createRoom(userId: UserId, input: CreateRoomInput): Promise<Room> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<RoomRow>(
        `INSERT INTO chat_rooms (name, created_by)
         VALUES ($1, $2)
         RETURNING id, name, created_by, created_at`,
        [input.name, userId],
      );
      const room = inserted.rows[0];
      await client.query(
        `INSERT INTO chat_room_members (room_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (room_id, user_id) DO NOTHING`,
        [room.id, userId],
      );
      await client.query("COMMIT");
      return roomFromRow(room);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRooms(userId: UserId, options: Required<ListRoomsOptions>): Promise<Room[]> {
    const result = await this.db.query<RoomRow>(
      `SELECT r.id, r.name, r.created_by, r.created_at,
              COUNT(m.user_id)::int AS member_count
       FROM chat_rooms r
       INNER JOIN chat_room_members mine
         ON mine.room_id = r.id AND mine.user_id = $1
       LEFT JOIN chat_room_members m ON m.room_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT $2 OFFSET $3`,
      [userId, options.limit, options.offset],
    );
    return result.rows.map(roomFromRow);
  }

  async roomExists(roomId: number): Promise<boolean> {
    const result = await this.db.query(
      "SELECT 1 FROM chat_rooms WHERE id = $1",
      [roomId],
    );
    return result.rowCount > 0;
  }

  async isMember(userId: UserId, roomId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM chat_room_members
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId],
    );
    return result.rowCount > 0;
  }

  async joinRoom(userId: UserId, roomId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO chat_room_members (room_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [roomId, userId],
    );
  }

  async getHistory(
    roomId: number,
    options: Required<Pick<GetHistoryOptions, "limit">> & Pick<GetHistoryOptions, "before">,
  ): Promise<ChatMessage[]> {
    const params: unknown[] = [roomId, options.limit + 1];
    let cursorClause = "";
    if (options.before) {
      params.push(options.before.createdAt, options.before.id);
      cursorClause = `AND (created_at, id) < ($3::timestamptz, $4::bigint)`;
    }

    // Fetch newest-first for efficient keyset pagination; the service reverses
    // the selected page so callers always receive chronological order.
    const result = await this.db.query<MessageRow>(
      `SELECT id, room_id, sender_id, body, created_at
       FROM chat_messages
       WHERE room_id = $1 ${cursorClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      params,
    );
    return result.rows.map(messageFromRow);
  }

  async createMessage(userId: UserId, input: SendMessageInput): Promise<ChatMessage> {
    const result = await this.db.query<MessageRow>(
      `INSERT INTO chat_messages (room_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, room_id, sender_id, body, created_at`,
      [input.roomId, userId, input.body],
    );
    return messageFromRow(result.rows[0]);
  }
}
