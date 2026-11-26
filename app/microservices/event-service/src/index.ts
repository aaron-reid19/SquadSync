import "dotenv/config";
import Fastify, { type FastifyRequest } from "fastify";
import { fastifyOptions, registerObservability } from "./shared/fastifyObservability.js";
import cookie from "@fastify/cookie";
import { assertRequiredConfig } from "./shared/config.js";
import { pool, query, withTransaction } from "./shared/db.js";
import { jwksCheck, postgresCheck, runReadiness } from "./shared/readiness.js";
import { requireIdentity } from "./auth.js";

assertRequiredConfig("event-service", ["DATABASE_URL", "IDENTITY_JWKS_URL", "IDENTITY_ISSUER"]);

const app = Fastify(fastifyOptions("event-service"));
registerObservability(app);
const port = Number(process.env.PORT) || 4102;

await app.register(cookie);

type EventRow = {
  id: string;
  squad_id: string;
  organizer_user_id: number;
  title: string;
  description: string;
  area_name: string;
  latitude: number | null;
  longitude: number | null;
  visibility: "squad" | "public";
  status: "voting" | "final" | "draft";
  vote_deadline: Date | string | null;
  created_at: Date | string;
};
type SlotRow = { id: string; starts_at: Date | string; ends_at: Date | string };
type SuggestionRow = { id: string; suggested_by_user_id: number; title: string; category: string; note: string | null; price: number | null; likes: number[]; passes: number[] };
type AttendeeRow = { user_id: number; response: string };
type FinalRow = { suggestion_id: string; slot_id: string; venue_id: string | null; finalized_at: Date | string };

function userId(request: FastifyRequest) {
  return Number(request.identity?.subject);
}

function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : "";
}

async function loadEvent(eventId: string) {
  const event = (await query<EventRow>("SELECT * FROM events WHERE id = $1", [eventId])).rows[0];
  if (!event) return undefined;
  const [slots, suggestions, availability, attendees, finalPlan] = await Promise.all([
    query<SlotRow>("SELECT id, starts_at, ends_at FROM event_slots WHERE event_id = $1 ORDER BY starts_at", [eventId]),
    query<SuggestionRow>(
      `SELECT es.id, es.suggested_by_user_id, es.title, es.category, es.note, es.price,
              COALESCE(ARRAY_AGG(v.user_id) FILTER (WHERE v.vote = 'like'), '{}') AS likes,
              COALESCE(ARRAY_AGG(v.user_id) FILTER (WHERE v.vote = 'pass'), '{}') AS passes
         FROM event_suggestions es
         LEFT JOIN event_suggestion_votes v ON v.suggestion_id = es.id
        WHERE es.event_id = $1
        GROUP BY es.id
        ORDER BY es.created_at`,
      [eventId],
    ),
    query<{ slot_id: string; user_id: number }>(
      "SELECT slot_id, user_id FROM event_slot_availability WHERE available = TRUE AND slot_id IN (SELECT id FROM event_slots WHERE event_id = $1)",
      [eventId],
    ),
    query<AttendeeRow>("SELECT user_id, response FROM event_attendees WHERE event_id = $1", [eventId]),
    query<FinalRow>("SELECT suggestion_id, slot_id, venue_id, finalized_at FROM event_final_plans WHERE event_id = $1", [eventId]),
  ]);
  const availabilityBySlot = new Map<string, string[]>();
  for (const row of availability.rows) availabilityBySlot.set(row.slot_id, [...(availabilityBySlot.get(row.slot_id) ?? []), String(row.user_id)]);
  const attendeeIds = attendees.rows.filter((row) => row.response === "going").map((row) => String(row.user_id));
  const declinedIds = attendees.rows.filter((row) => row.response === "declined").map((row) => String(row.user_id));
  const plan = finalPlan.rows[0];
  return {
    id: event.id,
    squadId: event.squad_id,
    organizerId: String(event.organizer_user_id),
    title: event.title,
    description: event.description,
    area: { name: event.area_name, lat: Number(event.latitude ?? 0), lng: Number(event.longitude ?? 0) },
    visibility: event.visibility,
    status: event.status === "final" ? "final" as const : "voting" as const,
    voteDeadline: iso(event.vote_deadline),
    createdAt: iso(event.created_at),
    slots: slots.rows.map((slot) => ({ id: slot.id, start: iso(slot.starts_at), end: iso(slot.ends_at), availableIds: availabilityBySlot.get(slot.id) ?? [] })),
    suggestions: suggestions.rows.map((suggestion) => ({
      id: suggestion.id,
      title: suggestion.title,
      category: suggestion.category,
      note: suggestion.note ?? undefined,
      price: (suggestion.price ?? 1) as 1 | 2 | 3,
      suggestedBy: String(suggestion.suggested_by_user_id),
      likes: (suggestion.likes ?? []).map(String),
      passes: (suggestion.passes ?? []).map(String),
    })),
    attendeeIds,
    declinedIds,
    ...(plan ? { final: { suggestionId: plan.suggestion_id, slotId: plan.slot_id, venueId: plan.venue_id ?? "", finalizedAt: iso(plan.finalized_at) } } : {}),
  };
}

async function accessible(eventId: string, _memberId: number) {
  // Squad membership is owned by squad-service. The gateway authenticates the
  // caller here; the UI applies private-event visibility from its squad list.
  return Boolean((await query("SELECT 1 FROM events WHERE id = $1", [eventId])).rowCount);
}

async function requireEvent(request: FastifyRequest, reply: import("fastify").FastifyReply, id: string) {
  if (!(await accessible(id, userId(request)))) {
    reply.code(404).send({ error: "Event not found" });
    return undefined;
  }
  return loadEvent(id);
}

app.get("/health", async () => ({ ok: true, service: "event" }));
const readinessChecks = {
  database: postgresCheck(pool),
  identityKeys: jwksCheck(process.env.IDENTITY_JWKS_URL),
};
app.get("/ready", async (request, reply) => {
  const result = await runReadiness(readinessChecks);
  if (!result.ok) request.log.warn({ failures: result.failures }, "not ready");
  return reply.code(result.statusCode).send({ ok: result.ok, service: "event", checks: result.checks });
});

app.get("/api/events", { preHandler: requireIdentity }, async () => {
  const rows = await query<{ id: string }>("SELECT id FROM events ORDER BY created_at DESC");
  return (await Promise.all(rows.rows.map((row) => loadEvent(row.id)))).filter(Boolean);
});

app.post<{ Body: {
  squadId?: string; title?: string; description?: string; area?: { name?: string; lat?: number; lng?: number };
  visibility?: "squad" | "public"; voteDeadline?: string; slots?: { start: string; end: string }[];
  ideas?: { title: string; category: string; price: 1 | 2 | 3; note?: string }[];
} }>("/api/events", { preHandler: requireIdentity }, async (request, reply) => {
  const body = request.body;
  if (!body?.squadId || !body.title?.trim() || !body.area?.name || !Array.isArray(body.slots) || !body.slots.length) {
    return reply.code(400).send({ error: "Invalid event request" });
  }
  const title = body.title.trim();
  const slots = body.slots;
  try {
    const eventId = await withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO events (squad_id, organizer_user_id, title, description, area_name, latitude, longitude, visibility, status, vote_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'voting', $9) RETURNING id`,
        [body.squadId, userId(request), title, body.description?.trim() ?? "", body.area?.name,
          body.area?.lat ?? null, body.area?.lng ?? null, body.visibility ?? "squad", body.voteDeadline ? new Date(body.voteDeadline) : null],
      );
      const id = created.rows[0].id;
      await client.query("INSERT INTO event_attendees (event_id, user_id, response) VALUES ($1, $2, 'going')", [id, userId(request)]);
      for (const slot of slots) {
        await client.query("INSERT INTO event_slots (event_id, starts_at, ends_at) VALUES ($1, $2, $3)", [id, new Date(slot.start), new Date(slot.end)]);
      }
      for (const idea of body.ideas ?? []) {
        await client.query(
          "INSERT INTO event_suggestions (event_id, suggested_by_user_id, title, category, note, price) VALUES ($1, $2, $3, $4, $5, $6)",
          [id, userId(request), idea.title.trim(), idea.category, idea.note?.trim() || null, idea.price],
        );
      }
      return id;
    });
    return reply.code(201).send(await loadEvent(eventId));
  } catch (error) {
    request.log.error(error);
    return reply.code(400).send({ error: "Unable to create event" });
  }
});

app.post<{ Params: { id: string }; Body: { going?: boolean } }>("/api/events/:id/rsvp", { preHandler: requireIdentity }, async (request, reply) => {
  if (!(await requireEvent(request, reply, request.params.id))) return;
  await query(
    `INSERT INTO event_attendees (event_id, user_id, response) VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id) DO UPDATE SET response = EXCLUDED.response, responded_at = NOW()`,
    [request.params.id, userId(request), request.body?.going ? "going" : "declined"],
  );
  return loadEvent(request.params.id);
});

app.post<{ Params: { id: string; suggestionId: string }; Body: { vote?: "like" | "pass" | null } }>("/api/events/:id/suggestions/:suggestionId/vote", { preHandler: requireIdentity }, async (request, reply) => {
  if (!(await requireEvent(request, reply, request.params.id))) return;
  if (request.body?.vote == null) {
    await query("DELETE FROM event_suggestion_votes WHERE suggestion_id = $1 AND user_id = $2", [request.params.suggestionId, userId(request)]);
  } else {
    await query(
      `INSERT INTO event_suggestion_votes (suggestion_id, user_id, vote) VALUES ($1, $2, $3)
       ON CONFLICT (suggestion_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()`,
      [request.params.suggestionId, userId(request), request.body.vote],
    );
  }
  return loadEvent(request.params.id);
});

app.post<{ Params: { id: string; slotId: string }; Body: { available?: boolean } }>("/api/events/:id/slots/:slotId/availability", { preHandler: requireIdentity }, async (request, reply) => {
  if (!(await requireEvent(request, reply, request.params.id))) return;
  await query(
    `INSERT INTO event_slot_availability (slot_id, user_id, available) VALUES ($1, $2, $3)
     ON CONFLICT (slot_id, user_id) DO UPDATE SET available = EXCLUDED.available, updated_at = NOW()`,
    [request.params.slotId, userId(request), request.body?.available !== false],
  );
  return loadEvent(request.params.id);
});

app.post<{ Params: { id: string }; Body: { start?: string; end?: string } }>("/api/events/:id/slots", { preHandler: requireIdentity }, async (request, reply) => {
  if (!(await requireEvent(request, reply, request.params.id))) return;
  if (!request.body?.start || !request.body.end) return reply.code(400).send({ error: "Slot times are required" });
  const created = await query<{ id: string }>("INSERT INTO event_slots (event_id, starts_at, ends_at) VALUES ($1, $2, $3) RETURNING id", [request.params.id, new Date(request.body.start), new Date(request.body.end)]);
  await query("INSERT INTO event_slot_availability (slot_id, user_id, available) VALUES ($1, $2, TRUE)", [created.rows[0].id, userId(request)]);
  return loadEvent(request.params.id);
});

app.post<{ Params: { id: string }; Body: { title?: string; category?: string; price?: 1 | 2 | 3; note?: string } }>("/api/events/:id/suggestions", { preHandler: requireIdentity }, async (request, reply) => {
  if (!(await requireEvent(request, reply, request.params.id))) return;
  if (!request.body?.title?.trim() || !request.body.category) return reply.code(400).send({ error: "Suggestion title and category are required" });
  const created = await query<{ id: string }>(
    "INSERT INTO event_suggestions (event_id, suggested_by_user_id, title, category, note, price) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [request.params.id, userId(request), request.body.title.trim(), request.body.category, request.body.note?.trim() || null, request.body.price ?? 1],
  );
  await query("INSERT INTO event_suggestion_votes (suggestion_id, user_id, vote) VALUES ($1, $2, 'like')", [created.rows[0].id, userId(request)]);
  return loadEvent(request.params.id);
});

app.post<{ Params: { id: string }; Body: { suggestionId?: string; slotId?: string; venueId?: string } }>("/api/events/:id/finalize", { preHandler: requireIdentity }, async (request, reply) => {
  const event = await requireEvent(request, reply, request.params.id);
  if (!event) return;
  if (event.organizerId !== String(userId(request))) return reply.code(403).send({ error: "Only the organizer can finalize" });
  const { suggestionId, slotId, venueId } = request.body ?? {};
  if (!suggestionId || !slotId || !venueId) return reply.code(400).send({ error: "A suggestion, time, and venue are required" });
  await withTransaction(async (client) => {
    await client.query("DELETE FROM event_final_plans WHERE event_id = $1", [request.params.id]);
    await client.query("INSERT INTO event_final_plans (event_id, suggestion_id, slot_id, venue_id) VALUES ($1, $2, $3, $4)", [request.params.id, suggestionId, slotId, venueId]);
    await client.query("UPDATE events SET status = 'final' WHERE id = $1", [request.params.id]);
  });
  return loadEvent(request.params.id);
});

app.post<{ Params: { id: string } }>("/api/events/:id/reopen", { preHandler: requireIdentity }, async (request, reply) => {
  const event = await requireEvent(request, reply, request.params.id);
  if (!event) return;
  if (event.organizerId !== String(userId(request))) return reply.code(403).send({ error: "Only the organizer can reopen" });
  await withTransaction(async (client) => {
    await client.query("DELETE FROM event_final_plans WHERE event_id = $1", [request.params.id]);
    await client.query("UPDATE events SET status = 'voting' WHERE id = $1", [request.params.id]);
  });
  return loadEvent(request.params.id);
});

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
