-- Reverts chat/001_initial_schema.sql. DESTROYS all chat rooms and messages.
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_room_members;
DROP TABLE IF EXISTS chat_rooms;
