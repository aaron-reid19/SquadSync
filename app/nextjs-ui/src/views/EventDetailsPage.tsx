"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import FinalPlan from "../components/FinalPlan";
import { useMe, useStore } from "../lib/data/store";
import { emojiFor, fmtRelative, fmtSlot, fullName, toneFor } from "../lib/format";
import { hasFinishedVoting, isVotingClosed, rankSlots, rankSuggestions } from "../lib/results";

export default function EventDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, rsvp } = useStore();
  const me = useMe();
  const [rsvpError, setRsvpError] = useState("");
  const event = db.events.find((e) => e.id === id);
  const squadRecord = db.squads.find((s) => s.id === event?.squadId);
  const squad = squadRecord ?? (event?.squad ? { ...event.squad, memberIds: [] as string[] } : undefined);
  const eventTitle = event?.title;

  useEffect(() => {
    document.title = eventTitle ? `${eventTitle} · SquadSync` : "Event · SquadSync";
  }, [eventTitle]);

  if (!event || !squad) {
    return (
      <div className="card form-card">
        <h1 className="h1">Event not found</h1>
        <p className="lead">It may have been deleted, or the link is wrong.</p>
        <Link href="/" className="btn btn--primary btn--auto">Back to Main</Link>
      </div>
    );
  }

  const isMember = Boolean(squadRecord?.memberIds.includes(me.id));
  const going = event.attendeeIds.includes(me.id);
  const declined = event.declinedIds.includes(me.id);
  const canParticipate = isMember || going;
  if (!isMember && event.visibility !== "public") {
    return (
      <div className="card form-card">
        <h1 className="h1">This event is private</h1>
        <p className="lead">Only members of {squad.name} can see it. Ask a member for their invite code.</p>
        <Link href="/" className="btn btn--primary btn--auto">Back to Main</Link>
      </div>
    );
  }

  const isFinal = event.status === "final" && !!event.final;
  const leading = rankSuggestions(event.suggestions)[0];
  const bestSlot = rankSlots(event.slots)[0];
  const voters = new Set(event.suggestions.flatMap((s) => [...s.likes, ...s.passes]));
  const participants = new Set([...(squadRecord?.memberIds ?? []), ...event.attendeeIds]);
  const headerCategory = isFinal ? event.suggestions.find((s) => s.id === event.final!.suggestionId)?.category : leading?.category;

  return (
    <>
      <Link href="/" className="back">← Main</Link>
      <section className="event-hero card">
        <div className="event-hero__art" style={{ background: toneFor(headerCategory ?? event.title) }} aria-hidden="true">
          {emojiFor(headerCategory ?? "")}
        </div>
        <div className="event-hero__body">
          <div className="event-card__meta">
            <span className="pill">{squad.emoji} {squad.name}</span>
            {isFinal ? <span className="pill pill--green">Locked in</span>
              : isVotingClosed(event) ? <span className="pill pill--red">Voting closed · waiting on organizer</span>
              : <span className="pill pill--yellow">Voting ends {fmtRelative(event.voteDeadline)}</span>}
            <span className="pill">{event.visibility === "public" ? "🌍 Public" : "🔒 Squad only"}</span>
          </div>
          <h1 className="h1">{event.title}</h1>
          {event.description && <p className="lead">{event.description}</p>}
          <p className="muted small">Organized by {fullName(user(event.organizerId))} · Meeting around {event.area.name}</p>

          <div className="rsvp" role="group" aria-label="Sign up">
            <span className="rsvp__q">Are you in?</span>
            <button type="button" className={`btn btn--small btn--auto ${going ? "btn--green" : ""}`} aria-pressed={going} onClick={() => { void rsvp(event.id, true).catch((e) => setRsvpError(e instanceof Error ? e.message : "Could not update RSVP.")); }}>
              {going ? "✓ I'm in" : "I'm in"}
            </button>
            <button type="button" className={`btn btn--small btn--auto ${declined ? "btn--red" : ""}`} aria-pressed={declined} onClick={() => { void rsvp(event.id, false).catch((e) => setRsvpError(e instanceof Error ? e.message : "Could not update RSVP.")); }}>
              Can&apos;t make it
            </button>
          </div>
          {rsvpError && <p className="field__error" role="alert">{rsvpError}</p>}
        </div>
      </section>

      <div className="row-gap wrap section">
        {canParticipate ? (
          <>
            {!isFinal && (
              <Link href={`/events/${event.id}/chat?tab=vote`} className="btn btn--primary btn--auto">
                {hasFinishedVoting(event, me.id) ? "See the vote" : "Vote now"}
              </Link>
            )}
            <Link href={`/events/${event.id}/chat`} className="btn btn--auto btn--blue">💬 Open chat</Link>
          </>
        ) : (
          <p className="muted">Sign up to join the chat and vote.</p>
        )}
      </div>

      {isFinal ? (
        <FinalPlan event={event} />
      ) : (
        <section className="card form-card section" aria-labelledby="status-h">
          <h2 id="status-h" className="h2">Where the vote stands</h2>
          <div className="stats">
            <div className="stat"><span className="stat__n">{voters.size}/{participants.size}</span><span className="stat__l">have swiped</span></div>
            <div className="stat"><span className="stat__n">{event.suggestions.length}</span><span className="stat__l">ideas</span></div>
            <div className="stat"><span className="stat__n">{event.slots.length}</span><span className="stat__l">time options</span></div>
          </div>
          {leading && <p><strong>Leading activity:</strong> {emojiFor(leading.category)} {leading.title} ({leading.likes.length} 👍)</p>}
          {bestSlot && <p><strong>Best time so far:</strong> {fmtSlot(bestSlot.start, bestSlot.end)} ({bestSlot.availableIds.length} free)</p>}
        </section>
      )}

      <section className="section" aria-labelledby="who-h">
        <h2 id="who-h" className="h2">Who&apos;s coming ({event.attendeeIds.length})</h2>
        <ul className="people">
          {event.attendeeIds.map((uidStr) => {
            const u = user(uidStr);
            return (
              <li key={uidStr} className="person">
                <Avatar user={u} size={40} />
                <span><strong>{fullName(u)}</strong>{uidStr === event.organizerId && <span className="pill pill--tiny">Organizer</span>}<br /><span className="muted small">@{u?.username}</span></span>
              </li>
            );
          })}
        </ul>
        {event.declinedIds.length > 0 && (
          <p className="muted small">Can&apos;t make it: {event.declinedIds.map((x) => user(x)?.firstName).join(", ")}</p>
        )}
      </section>
    </>
  );
}
