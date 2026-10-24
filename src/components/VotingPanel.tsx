import { FormEvent, useMemo, useState } from "react";
import type { SquadEvent } from "../lib/data/types";
import { useMe, useStore } from "../lib/data/store";
import { fitsAvailability } from "../lib/availability";
import { emojiFor, fmtSlot, fullName, priceLabel } from "../lib/format";
import { INTERESTS } from "../lib/profileOptions";
import { rankSlots, rankSuggestions, venuesNear } from "../lib/results";
import { AvatarStack } from "./Avatar";
import FinalPlan from "./FinalPlan";
import Modal from "./Modal";
import SwipeDeck from "./SwipeDeck";
import VenueMap from "./VenueMap";

type Step = "swipe" | "times" | "results";

export default function VotingPanel({ event }: { event: SquadEvent }) {
  const me = useMe();
  const { user, reopen } = useStore();
  const [step, setStep] = useState<Step>(() => {
    const unswiped = event.suggestions.some((s) => !s.likes.includes(me.id) && !s.passes.includes(me.id));
    return unswiped ? "swipe" : event.slots.some((t) => t.availableIds.includes(me.id)) ? "results" : "times";
  });

  if (event.status === "final" && event.final) {
    return (
      <div className="stack">
        <FinalPlan event={event} />
        {event.organizerId === me.id && (
          <button type="button" className="btn btn--small btn--auto btn--ghost" onClick={() => reopen(event.id)}>
            Reopen voting
          </button>
        )}
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: "swipe", label: "1 · Activities" },
    { id: "times", label: "2 · Times" },
    { id: "results", label: "3 · Results" },
  ];

  return (
    <div className="stack">
      <ol className="stepper" aria-label="Voting steps">
        {steps.map((s) => (
          <li key={s.id}>
            <button type="button" className="stepper__btn" aria-current={step === s.id ? "step" : undefined} onClick={() => setStep(s.id)}>
              {s.label}
            </button>
          </li>
        ))}
      </ol>
      {step === "swipe" && <SwipeStep event={event} onDone={() => setStep("times")} />}
      {step === "times" && <TimesStep event={event} onDone={() => setStep("results")} />}
      {step === "results" && <ResultsStep event={event} />}
      <p className="muted small center">Organized by {fullName(user(event.organizerId))}</p>
    </div>
  );
}

// ---------------------------------------------------------------- step 1
function SwipeStep({ event, onDone }: { event: SquadEvent; onDone: () => void }) {
  const me = useMe();
  const { vote, addSuggestion } = useStore();
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState({ title: "", category: INTERESTS[0] as string, price: 2 as 1 | 2 | 3, note: "" });
  const [error, setError] = useState("");
  const pending = event.suggestions.filter((s) => !s.likes.includes(me.id) && !s.passes.includes(me.id));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (idea.title.trim().length < 3) return setError("Give it a short name (3+ characters).");
    addSuggestion(event.id, { title: idea.title.trim(), category: idea.category, price: idea.price, note: idea.note.trim() || undefined });
    setIdea({ title: "", category: INTERESTS[0], price: 2, note: "" });
    setError("");
    setOpen(false);
  }

  return (
    <div className="stack">
      {pending.length > 0 ? (
        <SwipeDeck cards={pending} total={event.suggestions.length} onVote={(id, like) => vote(event.id, id, like)} />
      ) : (
        <div className="card done-card">
          <p className="done-card__emoji" aria-hidden="true">🎉</p>
          <h3 className="h2">All swiped!</h3>
          <p className="muted">You can change any vote on the Results step.</p>
          <button type="button" className="btn btn--primary btn--auto" onClick={onDone}>Next: pick your times →</button>
        </div>
      )}
      <button type="button" className="btn btn--small btn--auto btn--blue center-self" onClick={() => setOpen(true)}>
        + Suggest an activity
      </button>

      <Modal open={open} title="Suggest an activity" onClose={() => setOpen(false)}>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="idea-title">What should we do?</label>
            <input id="idea-title" value={idea.title} maxLength={50} placeholder="Ramen + arcade"
              onChange={(e) => setIdea({ ...idea, title: e.target.value })} aria-invalid={!!error} autoFocus />
          </div>
          <div className="row2">
            <div className="field">
              <label htmlFor="idea-cat">Type</label>
              <select id="idea-cat" value={idea.category} onChange={(e) => setIdea({ ...idea, category: e.target.value })}>
                {INTERESTS.map((c) => <option key={c} value={c}>{emojiFor(c)} {c}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="idea-price">Budget</label>
              <select id="idea-price" value={idea.price} onChange={(e) => setIdea({ ...idea, price: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>$ cheap</option>
                <option value={2}>$$ moderate</option>
                <option value={3}>$$$ treat</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="idea-note">Note <span className="optional">(optional)</span></label>
            <input id="idea-note" value={idea.note} maxLength={80} onChange={(e) => setIdea({ ...idea, note: e.target.value })} />
          </div>
          <div className="form__status" role="alert">{error}</div>
          <button type="submit" className="btn btn--primary">Add to the deck</button>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- step 2
function TimesStep({ event, onDone }: { event: SquadEvent; onDone: () => void }) {
  const me = useMe();
  const { user, toggleSlot, addSlot } = useStore();
  const [newStart, setNewStart] = useState("");
  const [note, setNote] = useState("");
  const max = Math.max(1, ...event.slots.map((t) => t.availableIds.length));

  function fillFromProfile() {
    if (!me.availability.length) return setNote("You haven't set your weekly availability yet. Add it on your Profile.");
    let n = 0;
    for (const t of event.slots) {
      const free = fitsAvailability(t.start, me.availability);
      if (free) n++;
      toggleSlot(event.id, t.id, free);
    }
    setNote(`Filled from your profile: free for ${n} of ${event.slots.length} options. Adjust anything below.`);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const start = new Date(newStart);
    if (!newStart || start.getTime() < Date.now()) return setNote("Pick a future date and time.");
    addSlot(event.id, start.toISOString(), new Date(start.getTime() + 3 * 3_600_000).toISOString());
    setNewStart("");
    setNote("Added. You're marked free for it.");
  }

  return (
    <div className="stack">
      <div className="row-gap wrap">
        <p className="lead" style={{ margin: 0, flex: 1 }}>When are you free?</p>
        <button type="button" className="btn btn--small btn--auto btn--blue" onClick={fillFromProfile}>✨ Use my availability</button>
      </div>
      {note && <p className="field__hint" role="status">{note}</p>}
      <ul className="slots">
        {event.slots.map((t) => {
          const free = t.availableIds.includes(me.id);
          return (
            <li key={t.id}>
              <button type="button" className="slot" aria-pressed={free} onClick={() => toggleSlot(event.id, t.id)}>
                <span className="slot__check" aria-hidden="true">{free ? "✓" : ""}</span>
                <span className="slot__main">
                  <strong>{fmtSlot(t.start, t.end)}</strong>
                  <span className="slot__bar"><span style={{ width: `${(t.availableIds.length / max) * 100}%` }} /></span>
                </span>
                <span className="slot__who">
                  <AvatarStack users={t.availableIds.map(user)} size={24} max={4} />
                  <span className="small">{t.availableIds.length} free</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <form className="row-gap wrap" onSubmit={add}>
        <label htmlFor="new-slot" className="small"><strong>Suggest another time</strong></label>
        <input id="new-slot" type="datetime-local" className="input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
        <button type="submit" className="btn btn--small btn--auto">Add</button>
      </form>
      <button type="button" className="btn btn--primary" onClick={onDone}>See results →</button>
    </div>
  );
}

// ---------------------------------------------------------------- step 3
function ResultsStep({ event }: { event: SquadEvent }) {
  const me = useMe();
  const { user, vote, finalize, sendMessage } = useStore();
  const ranked = rankSuggestions(event.suggestions);
  const slots = rankSlots(event.slots);
  const [activityId, setActivityId] = useState(ranked[0]?.id);
  const [slotId, setSlotId] = useState(slots[0]?.id);
  const activity = event.suggestions.find((s) => s.id === activityId) ?? ranked[0];
  const venues = useMemo(() => (activity ? venuesNear(event.area, activity.category) : []), [activity, event.area]);
  const [venueId, setVenueId] = useState<string | undefined>();
  const chosenVenue = venues.find((v) => v.id === venueId) ?? venues[0];
  const isOrganizer = event.organizerId === me.id;
  const maxLikes = Math.max(1, ...event.suggestions.map((s) => s.likes.length + s.passes.length));
  const [nudged, setNudged] = useState(false);

  if (!activity) return <p className="empty">No ideas yet. Suggest one on the Activities step.</p>;

  return (
    <div className="stack">
      <section aria-labelledby="rank-h">
        <h3 id="rank-h" className="h3">Activities</h3>
        <ol className="ranking">
          {ranked.map((s, i) => {
            const mine = s.likes.includes(me.id) ? true : s.passes.includes(me.id) ? false : null;
            return (
              <li key={s.id} className={`rank${s.id === activity.id ? " rank--on" : ""}`}>
                <button type="button" className="rank__pick" onClick={() => { setActivityId(s.id); setVenueId(undefined); }}
                  aria-pressed={s.id === activity.id} aria-label={`Show venues for ${s.title}`}>
                  <span className="rank__pos">{i === 0 ? "🏆" : i + 1}</span>
                  <span className="rank__main">
                    <strong>{emojiFor(s.category)} {s.title}</strong>
                    <span className="rank__bar" aria-hidden="true">
                      <span className="rank__likes" style={{ width: `${(s.likes.length / maxLikes) * 100}%` }} />
                      <span className="rank__passes" style={{ width: `${(s.passes.length / maxLikes) * 100}%` }} />
                    </span>
                    <span className="small muted">{s.likes.length} 👍 · {s.passes.length} 👎</span>
                  </span>
                </button>
                <span className="rank__mine" role="group" aria-label={`Your vote on ${s.title}`}>
                  <button type="button" className="mini" aria-pressed={mine === true} onClick={() => vote(event.id, s.id, mine === true ? null : true)} aria-label="Like">👍</button>
                  <button type="button" className="mini" aria-pressed={mine === false} onClick={() => vote(event.id, s.id, mine === false ? null : false)} aria-label="Pass">👎</button>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="map-h">
        <h3 id="map-h" className="h3">{emojiFor(activity.category)} {activity.title}: spots near {event.area.name}</h3>
        {venues.length === 0 ? (
          <p className="empty">No mock venues for {activity.category} yet.</p>
        ) : (
          <div className="split">
            <div className="venue-list">
              {venues.map((v) => (
                <button key={v.id} type="button" className={`card venue venue__main${chosenVenue?.id === v.id ? " venue--on" : ""}`}
                  aria-pressed={chosenVenue?.id === v.id} onClick={() => setVenueId(v.id)}>
                  <span className="venue__emoji" aria-hidden="true">{emojiFor(v.category)}</span>
                  <span>
                    <strong className="venue__name">{v.name}</strong>
                    <span className="muted small">★ {v.rating} · {priceLabel(v.price)} · {v.km.toFixed(1)} km · {v.address}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="split__map">
              <VenueMap area={event.area} venues={venues} selectedId={chosenVenue?.id} onSelect={setVenueId} height={320} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="time-h">
        <h3 id="time-h" className="h3">Time</h3>
        <div className="field">
          <label htmlFor="final-slot" className="sr-only">Time</label>
          <select id="final-slot" value={slotId} onChange={(e) => setSlotId(e.target.value)} disabled={!isOrganizer}>
            {slots.map((t, i) => (
              <option key={t.id} value={t.id}>
                {i === 0 ? "🏆 " : ""}{fmtSlot(t.start, t.end)} ({t.availableIds.length} free)
              </option>
            ))}
          </select>
        </div>
      </section>

      {isOrganizer ? (
        <button type="button" className="btn btn--primary" disabled={!chosenVenue || !slotId}
          onClick={() => chosenVenue && slotId && finalize(event.id, { suggestionId: activity.id, slotId, venueId: chosenVenue.id })}>
          🔒 Lock it in: {activity.title} at {chosenVenue?.name ?? "…"}
        </button>
      ) : (
        <div className="banner">
          Waiting for {user(event.organizerId)?.firstName} to lock in the plan.{" "}
          <button type="button" className="link link--btn" disabled={nudged}
            onClick={() => { sendMessage(event.id, `@${user(event.organizerId)?.username} the vote is in, can we lock it? 🙏`); setNudged(true); }}>
            {nudged ? "Nudged ✓" : "Nudge them"}
          </button>
        </div>
      )}
    </div>
  );
}
