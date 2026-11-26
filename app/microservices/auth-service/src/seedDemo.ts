import "dotenv/config";
import argon2 from "argon2";
import { Pool, type PoolClient } from "pg";

type UserSpec = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  travelKm: number;
  interests: string[];
  transport: string[];
  color: string;
  availability: string[];
  pronouns?: string;
  bio?: string;
};

const users: UserSpec[] = [
  { username: "admin", email: "admin@squadsync.app", firstName: "Alex", lastName: "Admin", pronouns: "they/them", bio: "Always down for food and a bad karaoke duet.", city: "Calgary", travelKm: 25, interests: ["Karaoke", "Restaurants", "Escape rooms", "Hiking", "Board games"], transport: ["Car", "Transit"], color: "#f8de52", availability: ["4-2", "4-3", "5-1", "5-2", "5-3", "6-0", "6-1", "2-2"] },
  { username: "maya", email: "maya@example.com", firstName: "Maya", lastName: "Chen", city: "Calgary", travelKm: 10, interests: ["Karaoke", "Coffee", "Movies"], transport: ["Transit"], color: "#59bfdf", availability: ["4-2", "4-3", "5-2", "5-3"] },
  { username: "jordan", email: "jordan@example.com", firstName: "Jordan", lastName: "Reyes", city: "Calgary", travelKm: 25, interests: ["Karaoke", "Sports", "Video games"], transport: ["Car"], color: "#8fd84d", availability: ["4-2", "5-1", "5-2"] },
  { username: "priya", email: "priya@example.com", firstName: "Priya", lastName: "Shah", city: "Calgary", travelKm: 10, interests: ["Restaurants", "Escape rooms", "Museums"], transport: ["Walk or bike"], color: "#c9a7ff", availability: ["4-2", "5-2", "6-1"] },
  { username: "sam", email: "sam@example.com", firstName: "Sam", lastName: "O'Neil", city: "Calgary", travelKm: 50, interests: ["Escape rooms", "Bowling", "Board games"], transport: ["Car"], color: "#ffb470", availability: ["4-2", "5-1", "5-2"] },
  { username: "leo", email: "leo@example.com", firstName: "Leo", lastName: "Martin", city: "Calgary", travelKm: 50, interests: ["Hiking", "Sports"], transport: ["Car"], color: "#eb3c37", availability: ["6-0", "5-0"] },
  { username: "nina", email: "nina@example.com", firstName: "Nina", lastName: "Kowalski", city: "Calgary", travelKm: 25, interests: ["Hiking", "Board games", "Coffee"], transport: ["Transit"], color: "#59bfdf", availability: ["6-0", "3-2"] },
  { username: "tariq", email: "tariq@example.com", firstName: "Tariq", lastName: "Haddad", city: "Calgary", travelKm: 10, interests: ["Board games", "Video games"], transport: ["Transit"], color: "#8fd84d", availability: ["3-2", "5-1"] },
  { username: "zoe", email: "zoe@example.com", firstName: "Zoe", lastName: "Park", city: "Calgary", travelKm: 25, interests: ["Karaoke", "Concerts"], transport: ["Transit"], color: "#c9a7ff", availability: ["4-2", "4-3"] },
];

const areas = {
  downtown: { name: "Downtown / Stephen Ave", lat: 51.0453, lng: -114.0631 },
  kensington: { name: "Kensington", lat: 51.0526, lng: -114.0881 },
  beltline: { name: "17th Ave / Beltline", lat: 51.0377, lng: -114.0786 },
  noseHill: { name: "Nose Hill", lat: 51.1105, lng: -114.1105 },
};

const ids = {
  squads: { friday: "00000000-0000-0000-0000-000000000101", trail: "00000000-0000-0000-0000-000000000102", meeple: "00000000-0000-0000-0000-000000000103", mic: "00000000-0000-0000-0000-000000000104" },
  events: { friday: "00000000-0000-0000-0000-000000000201", hike: "00000000-0000-0000-0000-000000000202", games: "00000000-0000-0000-0000-000000000203", karaoke: "00000000-0000-0000-0000-000000000204" },
  slots: ["00000000-0000-0000-0000-000000000301", "00000000-0000-0000-0000-000000000302", "00000000-0000-0000-0000-000000000303", "00000000-0000-0000-0000-000000000304", "00000000-0000-0000-0000-000000000305", "00000000-0000-0000-0000-000000000306", "00000000-0000-0000-0000-000000000307"],
  suggestions: ["00000000-0000-0000-0000-000000000401", "00000000-0000-0000-0000-000000000402", "00000000-0000-0000-0000-000000000403", "00000000-0000-0000-0000-000000000404", "00000000-0000-0000-0000-000000000405", "00000000-0000-0000-0000-000000000406", "00000000-0000-0000-0000-000000000407", "00000000-0000-0000-0000-000000000408", "00000000-0000-0000-0000-000000000409", "00000000-0000-0000-0000-000000000410"],
};

const plusHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);
function nextWeekday(weekday: number, hour: number, weeksAhead = 0) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  const today = date.getDay();
  date.setDate(date.getDate() + (((weekday - today + 7) % 7) || 7) + weeksAhead * 7);
  return date;
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function poolFor(name: string, fallback: string) {
  return new Pool({ connectionString: process.env[`${name}_DATABASE_URL`] ?? fallback, max: 4 });
}

const authUrl = process.env.AUTH_DATABASE_URL ?? process.env.DATABASE_URL;
if (!authUrl) throw new Error("DATABASE_URL or AUTH_DATABASE_URL is required");

const auth = poolFor("AUTH", authUrl);
const squad = poolFor("SQUAD", authUrl);
const event = poolFor("EVENT", authUrl);
const chat = poolFor("CHAT", authUrl);

try {
  const adminHash = await argon2.hash("password", { type: argon2.argon2id });
  const userIds = await transaction(auth, async (client) => {
    const result = new Map<string, number>();
    for (const user of users) {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET password_hash = CASE WHEN users.email = 'admin@squadsync.app' THEN EXCLUDED.password_hash ELSE users.password_hash END
         RETURNING id`,
        [user.email, user.username === "admin" ? adminHash : null],
      );
      const id = inserted.rows[0].id;
      result.set(user.username, id);
      await client.query(
        `INSERT INTO profiles (user_id, first_name, last_name, username, dob, city, travel_km, pronouns, bio, interests, transport, availability, color, terms_version, terms_accepted_at)
         VALUES ($1, $2, $3, $4, '1990-01-01', $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, '2026-10-20', $13)
         ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
           username = EXCLUDED.username, city = EXCLUDED.city, travel_km = EXCLUDED.travel_km, pronouns = EXCLUDED.pronouns,
           bio = EXCLUDED.bio, interests = EXCLUDED.interests, transport = EXCLUDED.transport,
           availability = EXCLUDED.availability, color = EXCLUDED.color`,
        [id, user.firstName, user.lastName, user.username, user.city, user.travelKm, user.pronouns ?? null, user.bio ?? null,
          JSON.stringify(user.interests), JSON.stringify(user.transport), JSON.stringify(user.availability), user.color, Math.floor(Date.now() / 1000)],
      );
    }
    return result;
  });

  const id = (username: string) => {
    const value = userIds.get(username);
    if (!value) throw new Error(`Missing seeded user ${username}`);
    return value;
  };
  const friday = nextWeekday(5, 19);
  const saturday = nextWeekday(6, 14);
  const saturdayNight = nextWeekday(6, 19);
  const sunday = nextWeekday(0, 9);
  const thursday = nextWeekday(4, 18, 1);
  const saturdayTwo = nextWeekday(6, 13, 1);

  await transaction(squad, async (client) => {
    const squads = [
      [ids.squads.friday, "Friday Crew", "🎳", "FRYDAY", id("maya"), ["admin", "maya", "jordan", "priya", "sam"]],
      [ids.squads.trail, "Trail Mix", "🥾", "TRALMX", id("leo"), ["admin", "leo", "nina"]],
      [ids.squads.meeple, "Meeple Meetup", "🎲", "MEEPLE", id("tariq"), ["tariq", "nina", "sam"]],
      [ids.squads.mic, "Mic Night", "🎤", "MCKNTE", id("zoe"), ["zoe", "jordan"]],
    ] as const;
    for (const [squadId, name, emoji, code, ownerId, members] of squads) {
      await client.query("INSERT INTO squads (id, name, emoji, join_code, created_by_user_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING", [squadId, name, emoji, code, ownerId]);
      for (const member of members) await client.query("INSERT INTO squad_members (squad_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [squadId, id(member), member === (ownerId === id("maya") ? "maya" : ownerId === id("leo") ? "leo" : ownerId === id("tariq") ? "tariq" : "zoe") ? "owner" : "member"]);
    }
  });

  await transaction(event, async (client) => {
    const eventRows = [
      [ids.events.friday, ids.squads.friday, id("admin"), "Friday night out", "End-of-month hangout. Swipe on what sounds fun, mark when you're free, and we'll lock it in.", areas.beltline, "squad", new Date(Date.now() + 2 * 86_400_000), "voting", new Date(Date.now() - 600 * 60_000)],
      [ids.events.hike, ids.squads.trail, id("leo"), "Sunday morning hike", "Easy loop, then brunch if anyone's still standing.", { name: "Nose Hill", lat: 51.1105, lng: -114.1105 }, "squad", new Date(Date.now() - 1 * 86_400_000), "final", new Date(Date.now() - 4000 * 60_000)],
      [ids.events.games, ids.squads.meeple, id("tariq"), "Board game marathon", "Open table! Bring a friend or come solo. Strategy, party games, whatever wins the vote.", areas.kensington, "public", new Date(Date.now() + 4 * 86_400_000), "voting", new Date(Date.now() - 300 * 60_000)],
      [ids.events.karaoke, ids.squads.mic, id("zoe"), "Open mic karaoke", "Belt it out. Duets encouraged, talent optional.", areas.beltline, "public", new Date(Date.now() - 100 * 60_000), "final", new Date(Date.now() - 3000 * 60_000)],
    ] as const;
    for (const [eventId, squadId, organizer, title, description, area, visibility, deadline, status, createdAt] of eventRows) {
      await client.query(
        `INSERT INTO events (id, squad_id, organizer_user_id, title, description, area_name, latitude, longitude, visibility, status, vote_deadline, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING`,
        [eventId, squadId, organizer, title, description, area.name, area.lat, area.lng, visibility, status, deadline, createdAt],
      );
    }

    const slotRows = [
      [ids.slots[0], ids.events.friday, friday, plusHours(friday, 3)], [ids.slots[1], ids.events.friday, saturday, plusHours(saturday, 3)], [ids.slots[2], ids.events.friday, saturdayNight, plusHours(saturdayNight, 3)],
      [ids.slots[3], ids.events.hike, sunday, plusHours(sunday, 3)], [ids.slots[4], ids.events.games, thursday, plusHours(thursday, 4)], [ids.slots[5], ids.events.games, saturdayTwo, plusHours(saturdayTwo, 4)], [ids.slots[6], ids.events.karaoke, saturdayNight, plusHours(saturdayNight, 3)],
    ] as const;
    for (const row of slotRows) await client.query("INSERT INTO event_slots (id, event_id, starts_at, ends_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING", [...row]);

    const suggestions = [
      [ids.suggestions[0], ids.events.friday, "jordan", "Karaoke night", "Karaoke", 2, "Private room, 2 hours"], [ids.suggestions[1], ids.events.friday, "sam", "Escape room", "Escape rooms", 3, "The new heist room"], [ids.suggestions[2], ids.events.friday, "maya", "Bowling + wings", "Bowling", 2, null], [ids.suggestions[3], ids.events.friday, "priya", "Ramen crawl", "Restaurants", 2, "Start downtown, end on 17th"], [ids.suggestions[4], ids.events.friday, "jordan", "Arcade bar", "Video games", 2, null],
      [ids.suggestions[5], ids.events.hike, "leo", "Nose Hill loop", "Hiking", 1, null], [ids.suggestions[6], ids.events.hike, "nina", "Climbing gym", "Sports", 2, null],
      [ids.suggestions[7], ids.events.games, "tariq", "Board game café", "Board games", 1, null], [ids.suggestions[8], ids.events.games, "sam", "Retro console night", "Video games", 2, null],
      [ids.suggestions[9], ids.events.karaoke, "zoe", "Karaoke lounge", "Karaoke", 2, null],
    ] as const;
    for (const [suggestionId, eventId, author, title, category, price, note] of suggestions) {
      await client.query("INSERT INTO event_suggestions (id, event_id, suggested_by_user_id, title, category, price, note) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING", [suggestionId, eventId, id(author), title, category, price, note]);
    }

    const votes: [string, string, "like" | "pass"][] = [
      [ids.suggestions[0], "jordan", "like"], [ids.suggestions[0], "maya", "like"], [ids.suggestions[0], "priya", "pass"], [ids.suggestions[1], "sam", "like"], [ids.suggestions[1], "priya", "like"], [ids.suggestions[1], "maya", "like"], [ids.suggestions[2], "jordan", "like"], [ids.suggestions[2], "maya", "pass"], [ids.suggestions[3], "priya", "like"], [ids.suggestions[3], "sam", "pass"], [ids.suggestions[4], "jordan", "like"], [ids.suggestions[4], "priya", "pass"],
      [ids.suggestions[5], "admin", "like"], [ids.suggestions[5], "leo", "like"], [ids.suggestions[5], "nina", "like"], [ids.suggestions[6], "nina", "like"], [ids.suggestions[6], "leo", "pass"],
      [ids.suggestions[7], "tariq", "like"], [ids.suggestions[7], "nina", "like"], [ids.suggestions[7], "sam", "like"], [ids.suggestions[8], "sam", "like"], [ids.suggestions[8], "nina", "pass"],
      [ids.suggestions[9], "zoe", "like"], [ids.suggestions[9], "jordan", "like"],
    ];
    for (const [suggestionId, voter, vote] of votes) await client.query("INSERT INTO event_suggestion_votes (suggestion_id, user_id, vote) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [suggestionId, id(voter), vote]);

    const attendees: [string, string][] = [[ids.events.friday, "admin"], [ids.events.friday, "maya"], [ids.events.friday, "jordan"], [ids.events.friday, "sam"], [ids.events.hike, "admin"], [ids.events.hike, "leo"], [ids.events.hike, "nina"], [ids.events.games, "tariq"], [ids.events.games, "nina"], [ids.events.games, "sam"], [ids.events.karaoke, "zoe"], [ids.events.karaoke, "jordan"]];
    for (const [eventId, attendee] of attendees) await client.query("INSERT INTO event_attendees (event_id, user_id, response) VALUES ($1, $2, 'going') ON CONFLICT DO NOTHING", [eventId, id(attendee)]);

    const available: [string, string][] = [[ids.slots[0], "maya"], [ids.slots[0], "jordan"], [ids.slots[0], "priya"], [ids.slots[0], "sam"], [ids.slots[1], "jordan"], [ids.slots[1], "sam"], [ids.slots[2], "maya"], [ids.slots[2], "priya"], [ids.slots[3], "admin"], [ids.slots[3], "leo"], [ids.slots[3], "nina"], [ids.slots[4], "tariq"], [ids.slots[4], "nina"], [ids.slots[5], "tariq"], [ids.slots[5], "sam"], [ids.slots[6], "zoe"], [ids.slots[6], "jordan"]];
    for (const [slotId, user] of available) await client.query("INSERT INTO event_slot_availability (slot_id, user_id, available) VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING", [slotId, id(user)]);
    await client.query("INSERT INTO event_final_plans (event_id, suggestion_id, slot_id, venue_id, finalized_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING", [ids.events.hike, ids.suggestions[5], ids.slots[3], "v13", new Date(Date.now() - 1440 * 60_000)]);
    await client.query("INSERT INTO event_final_plans (event_id, suggestion_id, slot_id, venue_id, finalized_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING", [ids.events.karaoke, ids.suggestions[9], ids.slots[6], "v4", new Date(Date.now() - 100 * 60_000)]);
  });

  await transaction(chat, async (client) => {
    const rooms = [[ids.events.friday, "Friday night out"], [ids.events.hike, "Sunday morning hike"], [ids.events.games, "Board game marathon"]] as const;
    for (const [eventId, name] of rooms) {
      const room = await client.query<{ id: string }>("SELECT id FROM chat_rooms WHERE event_id = $1 ORDER BY created_at LIMIT 1", [eventId]);
      const roomId = room.rows[0]?.id ?? (await client.query<{ id: string }>("INSERT INTO chat_rooms (event_id, created_by_user_id, name) VALUES ($1, $2, $3) RETURNING id", [eventId, id("admin"), name])).rows[0].id;
      const members = eventId === ids.events.friday ? ["admin", "maya", "jordan", "priya", "sam"] : eventId === ids.events.hike ? ["admin", "leo", "nina"] : ["tariq", "nina", "sam"];
      for (const member of members) await client.query("INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [roomId, id(member)]);
      const messages: [string | null, string, number][] = eventId === ids.events.friday
        ? [[null, "Alex created the event and opened voting.", 600], ["maya", "Okay team, Friday plans. Swipe on the ideas so we stop going in circles 😅", 590], ["jordan", "Karaoke or riot.", 560], ["priya", "I can't do Saturday afternoon, I marked my times.", 300], ["sam", "Escape room has my vote, we never finished the last one", 45]]
        : eventId === ids.events.hike
          ? [[null, "Leo finalized the plan: Hiking at Nose Hill Park.", 1440], ["leo", "Bring water and layers, it gets windy up top.", 1400], ["nina", "I'll bring snacks 🍫", 1380]]
          : [["tariq", "New folks welcome! We'll teach any game.", 200]];
      for (const [author, body, minutes] of messages) await client.query("INSERT INTO chat_messages (room_id, user_id, body, created_at) SELECT $1, $2, $3, NOW() - ($4 || ' minutes')::interval WHERE NOT EXISTS (SELECT 1 FROM chat_messages WHERE room_id = $1 AND body = $3)", [roomId, author ? id(author) : null, body, minutes]);
    }
  });

  console.log("Demo data is ready. Test login: admin@squadsync.app / password");
} finally {
  await Promise.all([auth.end(), squad.end(), event.end(), chat.end()]);
}
