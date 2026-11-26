import Link from "next/link";
import type { SquadEvent } from "../lib/data/types";
import { useStore } from "../lib/data/store";
import { emojiFor, fmtRelative, fmtSlot, toneFor } from "../lib/format";
import { hasFinishedVoting, isVotingClosed, winner } from "../lib/results";
import { AvatarStack } from "./Avatar";
import type { ReactNode } from "react";

export default function EventCard({ event, action }: { event: SquadEvent; action?: ReactNode }) {
  const { db, user, me } = useStore();
  const squad = db.squads.find((s) => s.id === event.squadId) ?? event.squad;
  const isFinal = event.status === "final" && event.final;
  const activity = isFinal ? event.suggestions.find((s) => s.id === event.final!.suggestionId) : winner(event).activity;
  const slot = isFinal ? event.slots.find((t) => t.id === event.final!.slotId) : undefined;
  const venue = isFinal ? event.final!.venue : undefined;
  const closed = !isFinal && isVotingClosed(event);
  const isMember = Boolean(
    me &&
    db.squads.some(
      (entry) =>
        entry.id === event.squadId &&
        entry.memberIds.includes(me.id)
    )
  );
  const needsVote = !isFinal && !closed && me && isMember && !hasFinishedVoting(event, me.id);

  return (
    <article className="card event-card">
      <div className="event-card__art" style={{ background: toneFor(activity?.category ?? event.title) }} aria-hidden="true">
        {emojiFor(activity?.category ?? "")}
      </div>
      <div className="event-card__body">
        <div className="event-card__meta">
          <span className="pill">{squad?.emoji} {squad?.name}</span>
          {isFinal ? <span className="pill pill--green">Locked in</span>
            : closed ? <span className="pill pill--red">Voting closed · waiting on organizer</span>
            : <span className="pill pill--yellow">Voting · ends {fmtRelative(event.voteDeadline)}</span>}
          {event.visibility === "public" && <span className="pill">Public</span>}
        </div>
        <h3 className="event-card__title">
          <Link href={`/events/${event.id}`} className="stretched">{event.title}</Link>
        </h3>
        {isFinal ? (
          <p className="event-card__line">
            <strong>{activity?.title}</strong> at {venue?.name}
            <br />
            {venue?.address && <>{venue.address}<br /></>}
            {slot && fmtSlot(slot.start, slot.end)}
          </p>
        ) : (
          <p className="event-card__line">
            {activity ? <>Leading: <strong>{activity.title}</strong> ({activity.likes.length} 👍)</> : "No ideas yet"} · {event.suggestions.length} ideas
          </p>
        )}
        <div className="event-card__foot">
          <AvatarStack users={event.attendeeIds.map(user)} size={28} />
          <span className="muted small">{event.attendeeIds.length} going</span>
          {needsVote && <span className="pill pill--red">Your vote needed</span>}
        </div>
        {action && <div className="event-card__action">{action}</div>}
      </div>
    </article>
  );
}
