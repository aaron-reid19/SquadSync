"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EventCard from "../components/EventCard";
import VenueMap from "../components/VenueMap";
import { AREAS, VENUES } from "../lib/data/seed";
import { useMe, useStore } from "../lib/data/store";
import { emojiFor, priceLabel } from "../lib/format";
import { INTERESTS } from "../lib/profileOptions";
import { distanceKm } from "../lib/results";

export default function ExplorePage() {
  const { db, rsvp } = useStore();
  const me = useMe();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("For you");
  const [selected, setSelected] = useState<string>();

  const mySquadIds = new Set(db.squads.filter((s) => s.memberIds.includes(me.id)).map((s) => s.id));
  const q = query.trim().toLowerCase();
  const matchesCategory = (cat: string) =>
    filter === "All" || (filter === "For you" ? me.interests.includes(cat) : cat === filter);

  const publicEvents = db.events.filter((e) => {
    if (e.visibility !== "public" || mySquadIds.has(e.squadId)) return false;
    const cats = e.suggestions.map((s) => s.category);
    const text = `${e.title} ${e.description} ${cats.join(" ")}`.toLowerCase();
    return (!q || text.includes(q)) && (filter === "All" || filter === "For you" || cats.includes(filter));
  });

  const center = AREAS[0];
  const venues = useMemo(
    () =>
      VENUES.filter((v) => matchesCategory(v.category) && (!q || `${v.name} ${v.category}`.toLowerCase().includes(q)))
        .map((v) => ({ ...v, km: distanceKm(center, v) }))
        .sort((a, b) => b.rating - a.rating || a.km - b.km),
    [filter, q, me.interests] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="h1">Explore</h1>
          <p className="lead">Public hangouts to join and spots around {me.city} for your next plan.</p>
        </div>
      </section>

      <div className="toolbar">
        <div className="field field--inline">
          <label htmlFor="q" className="sr-only">Search</label>
          <input id="q" type="search" placeholder="Search karaoke, hiking, cafés…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="chips__list chips__list--scroll" role="group" aria-label="Filter by category">
          {["For you", "All", ...INTERESTS].map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {c === "For you" || c === "All" ? c : `${emojiFor(c)} ${c}`}
            </button>
          ))}
        </div>
      </div>

      <section className="section" aria-labelledby="pub-h">
        <h2 id="pub-h" className="h2">Public hangouts</h2>
        {publicEvents.length === 0 ? (
          <p className="empty">No public hangouts match. Try another filter.</p>
        ) : (
          <div className="grid">
            {publicEvents.map((e) => {
              const going = e.attendeeIds.includes(me.id);
              return (
                <EventCard key={e.id} event={e} action={
                  going ? (
                    <Link href={`/events/${e.id}`} className="btn btn--small btn--green">✓ Signed up</Link>
                  ) : (
                    <button type="button" className="btn btn--small btn--primary" onClick={() => rsvp(e.id, true)}>Sign up</button>
                  )
                } />
              );
            })}
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="ideas-h">
        <h2 id="ideas-h" className="h2">Spots near you</h2>
        <div className="split">
          <div className="venue-list">
            {venues.length === 0 && <p className="empty">No spots match that search.</p>}
            {venues.map((v) => (
              <article key={v.id} className={`card venue${selected === v.id ? " venue--on" : ""}`}>
                <button type="button" className="venue__main" onClick={() => setSelected(v.id)} aria-pressed={selected === v.id}>
                  <span className="venue__emoji" aria-hidden="true">{emojiFor(v.category)}</span>
                  <span>
                    <strong className="venue__name">{v.name}</strong>
                    <span className="muted small">{v.category} · ★ {v.rating} · {priceLabel(v.price)} · {v.km.toFixed(1)} km</span>
                  </span>
                </button>
                <Link className="btn btn--small btn--auto" href={`/events/new?idea=${encodeURIComponent(v.category)}`}>Plan this</Link>
              </article>
            ))}
          </div>
          <div className="split__map">
            <VenueMap area={center} venues={venues} selectedId={selected} onSelect={setSelected} height={460} />
          </div>
        </div>
      </section>
    </>
  );
}
