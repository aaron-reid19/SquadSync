"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EventCard from "../components/EventCard";
import { useMe, useStore } from "../lib/data/store";
import { emojiFor } from "../lib/format";
import { INTERESTS } from "../lib/profileOptions";

export default function ExplorePage() {
  const { db, rsvp } = useStore();
  const me = useMe();
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState<string>("For you");
  const mySquadIds = new Set(db.squads.filter((s) => s.memberIds.includes(me.id)).map((s) => s.id));
  const q = query.trim().toLowerCase();
  const publicEvents = useMemo(() => db.events.filter((event) => {
    if (event.visibility !== "public" || mySquadIds.has(event.squadId)) return false;
    const categories = event.suggestions.map((suggestion) => suggestion.category);
    const text = `${event.title} ${event.description} ${categories.join(" ")}`.toLowerCase();
    const categoryMatch = filter === "All" || (filter === "For you"
      ? categories.some((category) => me.interests.includes(category))
      : categories.includes(filter));
    return (!q || text.includes(q)) && categoryMatch;
  }), [db.events, db.squads, me.id, me.interests, q, filter]);

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="h1">Explore</h1>
          <p className="lead">Discover public hangouts organized by real SquadSync members in {me.city}.</p>
        </div>
      </section>
      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="q" className="sr-only">Search</label>
          <input id="q" type="search" placeholder="Search karaoke, hiking, cafés…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="chips__list chips__list--scroll" role="group" aria-label="Filter by category">
          {["For you", "All", ...INTERESTS].map((category) => (
            <button key={category} type="button" className="chip" aria-pressed={filter === category} onClick={() => setFilter(category)}>
              {category === "For you" || category === "All" ? category : `${emojiFor(category)} ${category}`}
            </button>
          ))}
        </div>
        <p className="toolbar__summary muted small" role="status" aria-live="polite">
          Showing {publicEvents.length} public {publicEvents.length === 1 ? "hangout" : "hangouts"}{filter !== "All" ? ` · ${filter}` : ""}{q ? ` · matching “${query.trim()}”` : ""}.
        </p>
      </div>
      <section className="section" aria-labelledby="pub-h">
        <h2 id="pub-h" className="h2">Public hangouts</h2>
        {actionError && <p className="field__error" role="alert">{actionError}</p>}
        {publicEvents.length === 0 ? (
          <div className="card form-card">
            <p className="empty">No public hangouts match those filters yet.</p>
            <p className="muted small">Public events appear here after members create them. Venue listings are not fabricated or pre-seeded.</p>
            <Link href="/events/new" className="btn btn--primary btn--auto">Create an event</Link>
          </div>
        ) : (
          <div className="grid">
            {publicEvents.map((event) => {
              const going = event.attendeeIds.includes(me.id);
              return <EventCard key={event.id} event={event} action={going
                ? <Link href={`/events/${event.id}`} className="btn btn--small btn--green">✓ Signed up</Link>
                : <button type="button" className="btn btn--small btn--primary" onClick={() => { void rsvp(event.id, true).catch((e) => setActionError(e instanceof Error ? e.message : "Could not sign up.")); }}>Sign up</button>} />;
            })}
          </div>
        )}
      </section>
    </>
  );
}
