import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import { requireIdentity } from "./auth.js";
import { db, query } from "./db.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT) || 4102;
const squadServiceUrl = process.env.SQUAD_SERVICE_URL ?? "http://localhost:4101";
await app.register(cookie);

interface EventRow {
  id: string; squad_id: string; organizer_user_id: number; title: string; description: string;
  area_name: string; latitude: number | null; longitude: number | null; visibility: "squad" | "public";
  status: "draft" | "voting" | "final"; vote_deadline: Date | null; created_at: Date;
}
function currentUserId(request: FastifyRequest) {
  const id = Number(request.identity?.subject);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function votingIsOpen(event: EventRow) {
  return event.status === "voting" && event.vote_deadline instanceof Date && event.vote_deadline.getTime() > Date.now();
}
async function requireCsrf(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers["x-csrf-token"];
  const cookieToken = request.cookies?.csrf;
  if (typeof header !== "string" || !cookieToken || header.length !== cookieToken.length ||
      !timingSafeEqual(Buffer.from(header), Buffer.from(cookieToken))) {
    return reply.code(403).send({ error: "Invalid CSRF token" });
  }
}
function internalAllowed(request: FastifyRequest) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  const supplied = request.headers["x-internal-token"];
  return Boolean(expected && typeof supplied === "string" && supplied === expected);
}
async function squadMembers(squadId: string) {
  const response = await fetch(`${squadServiceUrl}/internal/squads/${encodeURIComponent(squadId)}/members`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!response.ok) return null;
  const data = await response.json() as { memberIds?: string[] };
  return Array.isArray(data.memberIds) ? data.memberIds : null;
}
async function squadSummary(squadId: string) {
  try {
    const response = await fetch(`${squadServiceUrl}/internal/squads/${encodeURIComponent(squadId)}`, {
      headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
    });
    if (!response.ok) return undefined;
    return await response.json() as { id: string; name: string; emoji: string; createdBy: string };
  } catch {
    return undefined;
  }
}

async function userSquadIds(userId: number) {
  const response = await fetch(`${squadServiceUrl}/internal/users/${userId}/squads`, {
    headers: { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
  });
  if (!response.ok) throw new Error("Squad membership service unavailable");
  const data = await response.json() as { squadIds?: string[] };
  return Array.isArray(data.squadIds) ? data.squadIds : [];
}
async function canAccess(eventId: string, userId: number) {
  const row = (await query<EventRow>("SELECT * FROM events WHERE id = $1", [eventId])).rows[0];
  if (!row) return { row: null, allowed: false };
  if (row.visibility === "public" || row.organizer_user_id === userId) return { row, allowed: true };
  const [member, attendee] = await Promise.all([
    query("SELECT 1 FROM event_members WHERE event_id = $1 AND user_id = $2", [eventId, userId]),
    query("SELECT 1 FROM event_attendees WHERE event_id = $1 AND user_id = $2", [eventId, userId]),
  ]);
  if (member.rowCount || attendee.rowCount) return { row, allowed: true };
  const members = await squadMembers(row.squad_id);
  return { row, allowed: Boolean(members?.includes(String(userId))) };
}
async function mapEvent(row: EventRow) {
  const [slots, suggestions, attendees, finalResult] = await Promise.all([
    query<{ id: string; starts_at: Date; ends_at: Date }>("SELECT id, starts_at, ends_at FROM event_slots WHERE event_id = $1 ORDER BY starts_at", [row.id]),
    query<{ id: string; title: string; category: string; note: string | null; price: number; suggested_by_user_id: number; created_at: Date }>("SELECT id, title, category, note, price, suggested_by_user_id, created_at FROM event_suggestions WHERE event_id = $1 ORDER BY created_at", [row.id]),
    query<{ user_id: number; response: string }>("SELECT user_id, response FROM event_attendees WHERE event_id = $1", [row.id]),
    query<{ suggestion_id: string; slot_id: string; venue_id: string | null; venue_name: string | null; venue_address: string | null; venue_latitude: number | null; venue_longitude: number | null; finalized_at: Date }>("SELECT * FROM event_final_plans WHERE event_id = $1", [row.id]),
  ]);
  const slotModels = await Promise.all(slots.rows.map(async (slot) => {
    const availability = await query<{ user_id: number }>("SELECT user_id FROM event_slot_availability WHERE slot_id = $1", [slot.id]);
    return { id: slot.id, start: slot.starts_at.toISOString(), end: slot.ends_at.toISOString(), availableIds: availability.rows.map((x) => String(x.user_id)) };
  }));
  const suggestionModels = await Promise.all(suggestions.rows.map(async (suggestion) => {
    const votes = await query<{ user_id: number; vote: string }>("SELECT user_id, vote FROM event_suggestion_votes WHERE suggestion_id = $1", [suggestion.id]);
    return {
      id: suggestion.id, title: suggestion.title, category: suggestion.category,
      note: suggestion.note ?? undefined, price: suggestion.price as 1 | 2 | 3,
      suggestedBy: String(suggestion.suggested_by_user_id),
      likes: votes.rows.filter((v) => v.vote === "like").map((v) => String(v.user_id)),
      passes: votes.rows.filter((v) => v.vote === "pass").map((v) => String(v.user_id)),
    };
  }));
  const attendeeIds = attendees.rows.filter((a) => a.response === "going").map((a) => String(a.user_id));
  const declinedIds = attendees.rows.filter((a) => a.response === "declined").map((a) => String(a.user_id));
  const finalRow = finalResult.rows[0];
  const squad = await squadSummary(row.squad_id);
  return {
    id: row.id,
    squad,
    squadId: row.squad_id,
    organizerId: String(row.organizer_user_id),
    title: row.title,
    description: row.description,
    area: { name: row.area_name, lat: row.latitude == null ? 0 : Number(row.latitude), lng: row.longitude == null ? 0 : Number(row.longitude) },
    visibility: row.visibility,
    status: row.status === "final" ? "final" : "voting",
    voteDeadline: row.vote_deadline?.toISOString() ?? new Date().toISOString(),
    createdAt: row.created_at.toISOString(),
    slots: slotModels,
    suggestions: suggestionModels,
    attendeeIds,
    declinedIds,
    final: finalRow ? {
      suggestionId: finalRow.suggestion_id,
      slotId: finalRow.slot_id,
      venueId: finalRow.venue_id ?? finalRow.suggestion_id,
      venue: {
        id: finalRow.venue_id ?? finalRow.suggestion_id,
        name: finalRow.venue_name ?? "Meeting point",
        address: finalRow.venue_address ?? "",
        lat: finalRow.venue_latitude == null ? undefined : Number(finalRow.venue_latitude),
        lng: finalRow.venue_longitude == null ? undefined : Number(finalRow.venue_longitude),
      },
      finalizedAt: finalRow.finalized_at.toISOString(),
    } : undefined,
  };
}

app.get("/health", async () => ({ ok: true, service: "event" }));
app.get("/ready", async (_request, reply) => {
  try { await query("SELECT 1"); return { ok: true, service: "event", database: true }; }
  catch { return reply.code(503).send({ ok: false, service: "event", database: false }); }
});

app.get("/api/events", { preHandler: requireIdentity }, async (request, reply) => {
  const id = currentUserId(request);
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  try {
    const squadIds = await userSquadIds(id);
    const events = await query<EventRow>(`
      SELECT DISTINCT e.* FROM events e
      LEFT JOIN event_attendees a ON a.event_id = e.id AND a.user_id = $1
      WHERE e.visibility = 'public' OR e.organizer_user_id = $1 OR a.user_id IS NOT NULL
         OR e.squad_id = ANY($2::uuid[])
         OR EXISTS (SELECT 1 FROM event_members em WHERE em.event_id = e.id AND em.user_id = $1)
      ORDER BY e.created_at DESC
    `, [id, squadIds]);
    return await Promise.all(events.rows.map(mapEvent));
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Could not load events because Squad membership is unavailable." });
  }
});

app.post<{ Body: {
  squadId?: string; title?: string; description?: string; visibility?: "squad" | "public";
  area?: { name?: string; lat?: number; lng?: number }; voteDeadline?: string;
  slots?: { start?: string; end?: string }[];
  ideas?: { title?: string; category?: string; price?: number; note?: string }[];
} }>("/api/events", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request);
  const body = request.body ?? {};
  const title = body.title?.trim();
  const areaName = body.area?.name?.trim();
  const deadline = body.voteDeadline ? new Date(body.voteDeadline) : null;
  const slots = body.slots ?? [];
  const ideas = body.ideas ?? [];
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (!body.squadId || !title || title.length < 3 || title.length > 100 || !areaName || areaName.length > 120 ||
      !deadline || !Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now() ||
      !["squad", "public"].includes(body.visibility ?? "squad") || slots.length < 1 || slots.length > 8 || ideas.length < 1 || ideas.length > 20) {
    return reply.code(400).send({ error: "Complete the event details, add at least one future time and activity, and choose a future voting deadline." });
  }
  let earliestSlot = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    const start = new Date(slot.start ?? ""); const end = new Date(slot.end ?? "");
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) {
      return reply.code(400).send({ error: "Every time option must be a valid future time range." });
    }
    earliestSlot = Math.min(earliestSlot, start.getTime());
  }
  if (deadline && deadline.getTime() >= earliestSlot) {
    return reply.code(400).send({ error: "Voting must close before the first proposed time." });
  }
  for (const idea of ideas) {
    if (!idea.title?.trim() || idea.title.trim().length > 80 || !idea.category?.trim() || ![1, 2, 3].includes(Number(idea.price))) {
      return reply.code(400).send({ error: "Each activity needs a name, category and budget." });
    }
  }
  const members = await squadMembers(body.squadId);
  if (!members?.includes(String(id))) return reply.code(403).send({ error: "You must be a member of that Squad to create an event." });

  const client = await db.connect();
  let eventId = "";
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO events (squad_id, organizer_user_id, title, description, area_name, latitude, longitude, visibility, status, vote_deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'voting', $9) RETURNING id
    `, [body.squadId, id, title, body.description?.trim().slice(0, 500) ?? "", areaName,
      Number.isFinite(body.area?.lat) ? body.area?.lat : null, Number.isFinite(body.area?.lng) ? body.area?.lng : null,
      body.visibility ?? "squad", deadline]);
    eventId = inserted.rows[0].id;
    for (const memberId of members) await client.query("INSERT INTO event_members (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [eventId, Number(memberId)]);
    await client.query("INSERT INTO event_attendees (event_id, user_id, response) VALUES ($1, $2, 'going') ON CONFLICT (event_id, user_id) DO UPDATE SET response = 'going', responded_at = NOW()", [eventId, id]);
    for (const slot of slots) await client.query("INSERT INTO event_slots (event_id, starts_at, ends_at) VALUES ($1, $2, $3)", [eventId, new Date(slot.start!), new Date(slot.end!)]);
    for (const idea of ideas) await client.query("INSERT INTO event_suggestions (event_id, suggested_by_user_id, title, category, note, price) VALUES ($1, $2, $3, $4, $5, $6)", [eventId, id, idea.title!.trim(), idea.category!.trim(), idea.note?.trim() || null, Number(idea.price)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    request.log.error(error);
    return reply.code(500).send({ error: "Could not create the event." });
  } finally { client.release(); }
  const row = (await query<EventRow>("SELECT * FROM events WHERE id = $1", [eventId])).rows[0];
  return reply.code(201).send(await mapEvent(row));
});

app.post<{ Params: { id: string }; Body: { going?: boolean } }>("/api/events/:id/rsvp", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.params.id;
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (typeof request.body?.going !== "boolean") return reply.code(400).send({ error: "Choose an RSVP response." });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  await query(`INSERT INTO event_attendees (event_id, user_id, response) VALUES ($1, $2, $3)
    ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response, responded_at = NOW()`, [eventId, id, request.body.going ? "going" : "declined"]);
  return await mapEvent((await query<EventRow>("SELECT * FROM events WHERE id = $1", [eventId])).rows[0]);
});

app.post<{ Params: { id: string }; Body: { title?: string; category?: string; note?: string; price?: number } }>("/api/events/:id/suggestions", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.params.id; const body = request.body ?? {};
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const title = body.title?.trim(); const category = body.category?.trim();
  if (!title || title.length < 3 || title.length > 80 || !category || category.length > 50 || ![1, 2, 3].includes(Number(body.price))) return reply.code(400).send({ error: "Enter a valid activity." });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  if (!votingIsOpen(access.row)) return reply.code(409).send({ error: "Voting has closed. Ask the organizer to reopen it before adding activities." });
  await query("INSERT INTO event_suggestions (event_id, suggested_by_user_id, title, category, note, price) VALUES ($1, $2, $3, $4, $5, $6)", [eventId, id, title, category, body.note?.trim().slice(0, 120) || null, body.price]);
  return await mapEvent(access.row);
});

app.put<{ Params: { id: string; suggestionId: string }; Body: { vote?: "like" | "pass" | null } }>("/api/events/:id/suggestions/:suggestionId/vote", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const { id: eventId, suggestionId } = request.params;
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const vote = request.body?.vote ?? null;
  if (vote !== null && vote !== "like" && vote !== "pass") return reply.code(400).send({ error: "Invalid vote." });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  if (!votingIsOpen(access.row)) return reply.code(409).send({ error: "Voting has closed. Ask the organizer to reopen it before changing votes." });
  const found = await query("SELECT 1 FROM event_suggestions WHERE id = $1 AND event_id = $2", [suggestionId, eventId]);
  if (!found.rowCount) return reply.code(404).send({ error: "Activity not found." });
  if (vote === null) await query("DELETE FROM event_suggestion_votes WHERE suggestion_id = $1 AND user_id = $2", [suggestionId, id]);
  else await query(`INSERT INTO event_suggestion_votes (suggestion_id, user_id, vote) VALUES ($1, $2, $3)
    ON CONFLICT (suggestion_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`, [suggestionId, id, vote]);
  return await mapEvent(access.row);
});

app.post<{ Params: { id: string }; Body: { start?: string; end?: string } }>("/api/events/:id/slots", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.params.id;
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const start = new Date(request.body?.start ?? ""); const end = new Date(request.body?.end ?? "");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) return reply.code(400).send({ error: "Choose a valid future time range." });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  if (!votingIsOpen(access.row)) return reply.code(409).send({ error: "Voting has closed. Ask the organizer to reopen it before adding times." });
  if (!access.row.vote_deadline || start.getTime() <= access.row.vote_deadline.getTime()) {
    return reply.code(400).send({ error: "A proposed event time must be after the voting deadline." });
  }
  const inserted = await query<{ id: string }>("INSERT INTO event_slots (event_id, starts_at, ends_at) VALUES ($1, $2, $3) RETURNING id", [eventId, start, end]);
  await query("INSERT INTO event_slot_availability (slot_id, user_id) VALUES ($1, $2)", [inserted.rows[0].id, id]);
  return await mapEvent(access.row);
});

app.put<{ Params: { id: string; slotId: string }; Body: { available?: boolean } }>("/api/events/:id/slots/:slotId/availability", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const { id: eventId, slotId } = request.params;
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  if (typeof request.body?.available !== "boolean") return reply.code(400).send({ error: "Choose availability." });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  if (!votingIsOpen(access.row)) return reply.code(409).send({ error: "Voting has closed. Ask the organizer to reopen it before changing availability." });
  const found = await query("SELECT 1 FROM event_slots WHERE id = $1 AND event_id = $2", [slotId, eventId]);
  if (!found.rowCount) return reply.code(404).send({ error: "Time option not found." });
  if (request.body.available) await query("INSERT INTO event_slot_availability (slot_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [slotId, id]);
  else await query("DELETE FROM event_slot_availability WHERE slot_id = $1 AND user_id = $2", [slotId, id]);
  return await mapEvent(access.row);
});

app.post<{ Params: { id: string }; Body: { suggestionId?: string; slotId?: string; venue?: { name?: string; address?: string; lat?: number; lng?: number } } }>("/api/events/:id/finalize", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.params.id; const body = request.body ?? {};
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  if (access.row.organizer_user_id !== id) return reply.code(403).send({ error: "Only the event organizer can lock the plan." });
  if (access.row.status === "final") return reply.code(409).send({ error: "This plan is already finalized. Reopen voting before changing it." });
  const venueName = body.venue?.name?.trim(); const venueAddress = body.venue?.address?.trim();
  if (!body.suggestionId || !body.slotId || !venueName || venueName.length > 120 || !venueAddress || venueAddress.length > 240) return reply.code(400).send({ error: "Enter a real meeting place and address, then select an activity and time." });
  const [idea, slot] = await Promise.all([
    query("SELECT 1 FROM event_suggestions WHERE id = $1 AND event_id = $2", [body.suggestionId, eventId]),
    query("SELECT 1 FROM event_slots WHERE id = $1 AND event_id = $2", [body.slotId, eventId]),
  ]);
  if (!idea.rowCount || !slot.rowCount) return reply.code(400).send({ error: "Choose an activity and time from this event." });
  await query(`INSERT INTO event_final_plans (event_id, suggestion_id, slot_id, venue_id, venue_name, venue_address, venue_latitude, venue_longitude)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (event_id) DO UPDATE SET suggestion_id = EXCLUDED.suggestion_id, slot_id = EXCLUDED.slot_id,
      venue_id = EXCLUDED.venue_id, venue_name = EXCLUDED.venue_name, venue_address = EXCLUDED.venue_address,
      venue_latitude = EXCLUDED.venue_latitude, venue_longitude = EXCLUDED.venue_longitude, finalized_at = NOW()`,
    [eventId, body.suggestionId, body.slotId, `manual-${eventId}`, venueName, venueAddress,
      Number.isFinite(body.venue?.lat) ? body.venue?.lat : null, Number.isFinite(body.venue?.lng) ? body.venue?.lng : null]);
  await query("UPDATE events SET status = 'final' WHERE id = $1", [eventId]);
  return await mapEvent((await query<EventRow>("SELECT * FROM events WHERE id = $1", [eventId])).rows[0]);
});

app.post<{ Params: { id: string } }>("/api/events/:id/reopen", { preHandler: [requireIdentity, requireCsrf] }, async (request, reply) => {
  const id = currentUserId(request); const eventId = request.params.id;
  if (!id) return reply.code(401).send({ error: "Invalid account identity" });
  const access = await canAccess(eventId, id);
  if (!access.row || !access.allowed) return reply.code(404).send({ error: "Event not found." });
  if (access.row.organizer_user_id !== id) return reply.code(403).send({ error: "Only the event organizer can reopen voting." });
  if (access.row.status === "voting" && access.row.vote_deadline && access.row.vote_deadline.getTime() > Date.now()) {
    return reply.code(409).send({ error: "This event is already open for voting." });
  }
  const nextSlot = await query<{ starts_at: Date }>(
    "SELECT starts_at FROM event_slots WHERE event_id = $1 AND starts_at > NOW() ORDER BY starts_at LIMIT 1", [eventId],
  );
  if (!nextSlot.rowCount) return reply.code(409).send({ error: "There are no future time options. Create a new event with an upcoming date before reopening voting." });
  // Reopen for up to 24 hours, but always close at least one minute before the earliest upcoming option.
  const deadlineMs = Math.min(Date.now() + 24 * 60 * 60 * 1000, nextSlot.rows[0].starts_at.getTime() - 60_000);
  if (deadlineMs <= Date.now()) return reply.code(409).send({ error: "The next time option is too soon to reopen voting. Create a new event with more notice." });
  await query("DELETE FROM event_final_plans WHERE event_id = $1", [eventId]);
  await query("UPDATE events SET status = 'voting', vote_deadline = $2 WHERE id = $1", [eventId, new Date(deadlineMs)]);
  return await mapEvent((await query<EventRow>("SELECT * FROM events WHERE id = $1", [eventId])).rows[0]);
});

// Internal access check for chat-service. Never expose this route through the UI.
app.get<{ Params: { id: string } }>("/internal/events/:id/members", async (request, reply) => {
  if (!internalAllowed(request)) return reply.code(401).send({ error: "Internal authentication required" });
  const event = (await query<EventRow>("SELECT * FROM events WHERE id = $1", [request.params.id])).rows[0];
  if (!event) return reply.code(404).send({ error: "Event not found" });
  const [members, attendees, currentSquadMembers] = await Promise.all([
    query<{ user_id: number }>("SELECT user_id FROM event_members WHERE event_id = $1", [event.id]),
    query<{ user_id: number }>("SELECT user_id FROM event_attendees WHERE event_id = $1 AND response = 'going'", [event.id]),
    squadMembers(event.squad_id),
  ]);
  return {
    isPublic: event.visibility === "public",
    memberIds: [...new Set([
      ...members.rows.map((row) => String(row.user_id)),
      ...attendees.rows.map((row) => String(row.user_id)),
      ...(currentSquadMembers ?? []),
    ])],
  };
});

app.addHook("onClose", async () => { await db.end(); });
app.listen({ port, host: "0.0.0.0" }).catch((error) => { app.log.error(error); process.exit(1); });
