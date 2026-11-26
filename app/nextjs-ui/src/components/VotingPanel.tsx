import { FormEvent, useState } from "react";
import type { SquadEvent } from "../lib/data/types";
import { useMe, useStore } from "../lib/data/store";
import { fitsAvailability } from "../lib/availability";
import { emojiFor, fmtSlot, fullName } from "../lib/format";
import { INTERESTS } from "../lib/profileOptions";
import { rankSlots, rankSuggestions } from "../lib/results";
import { AvatarStack } from "./Avatar";
import FinalPlan from "./FinalPlan";
import Modal from "./Modal";
import SwipeDeck from "./SwipeDeck";

type Step = "swipe" | "times" | "results";

export default function VotingPanel({ event }: { event: SquadEvent }) {
  const me = useMe();
  const { user, reopen } = useStore();
  const [actionError, setActionError] = useState("");
  const [step, setStep] = useState<Step>(() => {
    const unswiped = event.suggestions.some((s) => !s.likes.includes(me.id) && !s.passes.includes(me.id));
    return unswiped ? "swipe" : event.slots.some((t) => t.availableIds.includes(me.id)) ? "results" : "times";
  });
  const deadlinePassed = Number.isFinite(Date.parse(event.voteDeadline)) && Date.parse(event.voteDeadline) <= Date.now();

  if (event.status === "final" && event.final) {
    return (
      <div className="stack">
        <FinalPlan event={event} />
        {actionError && <p className="field__error" role="alert">{actionError}</p>}
        {event.organizerId === me.id && (
          <button type="button" className="btn btn--small btn--auto btn--ghost" onClick={() => { void reopen(event.id).catch((e) => setActionError(e instanceof Error ? e.message : "Could not reopen voting.")); }}>
            Reopen voting
          </button>
        )}
      </div>
    );
  }

  if (deadlinePassed) {
    return (
      <div className="stack">
        <p className="banner">Voting has closed. The organizer can finalize a plan or reopen voting for up to 24 hours, ending before the next proposed time.</p>
        <ResultsStep event={event} />
        {event.organizerId === me.id && (
          <button type="button" className="btn btn--small btn--auto btn--ghost" onClick={() => { void reopen(event.id).catch((e) => setActionError(e instanceof Error ? e.message : "Could not reopen voting.")); }}>
            Reopen voting
          </button>
        )}
        {actionError && <p className="field__error" role="alert">{actionError}</p>}
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (idea.title.trim().length < 3) return setError("Give it a short name (3+ characters).");
    setError("");
    try {
      await addSuggestion(event.id, { title: idea.title.trim(), category: idea.category, price: idea.price, note: idea.note.trim() || undefined });
      setIdea({ title: "", category: INTERESTS[0], price: 2, note: "" });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this activity.");
    }
  }

  return (
    <div className="stack">
      {pending.length > 0 ? (
        <SwipeDeck cards={pending} total={event.suggestions.length} onVote={(id, like) => { void vote(event.id, id, like).catch((e) => setError(e instanceof Error ? e.message : "Could not save your vote.")); }} />
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

  async function fillFromProfile() {
    if (!me.availability.length) return setNote("You haven't set your weekly availability yet. Add it on your Profile.");
    let n = 0;
    try {
      await Promise.all(event.slots.map((t) => {
        const free = fitsAvailability(t.start, me.availability);
        if (free) n++;
        return toggleSlot(event.id, t.id, free);
      }));
      setNote(`Filled from your profile: free for ${n} of ${event.slots.length} options. Adjust anything below.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save your availability.");
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const start = new Date(newStart);
    if (!newStart || !Number.isFinite(start.getTime()) || start.getTime() < Date.now()) return setNote("Pick a future date and time.");
    try {
      await addSlot(event.id, start.toISOString(), new Date(start.getTime() + 3 * 3_600_000).toISOString());
      setNewStart("");
      setNote("Added. You're marked free for it.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not add this time.");
    }
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
              <button type="button" className="slot" aria-pressed={free} onClick={() => { void toggleSlot(event.id, t.id).catch((e) => setNote(e instanceof Error ? e.message : "Could not update availability.")); }}>
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
  const [venueName, setVenueName] = useState(event.final?.venue.name ?? "");
  const [venueAddress, setVenueAddress] = useState(event.final?.venue.address ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activity = event.suggestions.find((s) => s.id === activityId) ?? ranked[0];
  const isOrganizer = event.organizerId === me.id;
  const maxLikes = Math.max(1, ...event.suggestions.map((s) => s.likes.length + s.passes.length));
  const [nudged, setNudged] = useState(false);
  const canVote = event.status === "voting" && Date.parse(event.voteDeadline) > Date.now();

  if (!activity) return <p className="empty">No ideas yet. Suggest one on the Activities step.</p>;

  async function lockPlan() {
    if (!slotId) return setError("Choose a time option.");
    if (venueName.trim().length < 2 || venueAddress.trim().length < 5) {
      return setError("Enter the real meeting place and its street address.");
    }
    setBusy(true);
    setError("");
    try {
      await finalize(event.id, {
        suggestionId: activity.id,
        slotId,
        venue: { id: `manual-${event.id}`, name: venueName.trim(), address: venueAddress.trim() },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the final plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section aria-labelledby="rank-h">
        <h3 id="rank-h" className="h3">Activities</h3>
        <ol className="ranking">
          {ranked.map((s, i) => {
            const mine = s.likes.includes(me.id) ? true : s.passes.includes(me.id) ? false : null;
            return (
              <li key={s.id} className={`rank${s.id === activity.id ? " rank--on" : ""}`}>
                <button type="button" className="rank__pick" onClick={() => setActivityId(s.id)}
                  aria-pressed={s.id === activity.id} aria-label={`Select ${s.title}`}>
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
                  <button type="button" className="mini" aria-pressed={mine === true} disabled={!canVote}
                    onClick={() => void vote(event.id, s.id, mine === true ? null : true).catch((e) => setError(e instanceof Error ? e.message : "Could not save your vote."))} aria-label="Like">👍</button>
                  <button type="button" className="mini" aria-pressed={mine === false} disabled={!canVote}
                    onClick={() => void vote(event.id, s.id, mine === false ? null : false).catch((e) => setError(e instanceof Error ? e.message : "Could not save your vote."))} aria-label="Pass">👎</button>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="place-h">
        <h3 id="place-h" className="h3">Where should you meet?</h3>
        <p className="muted small">Enter the real place selected by your group. SquadSync saves the details you provide; it does not invent venue listings or ratings.</p>
        {isOrganizer ? (
          <div className="stack">
            <div className="field">
              <label htmlFor="venue-name">Place name</label>
              <input id="venue-name" value={venueName} maxLength={120} placeholder="Restaurant, park, venue…" onChange={(e) => setVenueName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="venue-address">Street address</label>
              <input id="venue-address" value={venueAddress} maxLength={240} placeholder="Street address, city" onChange={(e) => setVenueAddress(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="banner">Waiting for {user(event.organizerId)?.firstName} to add the meeting place.</p>
        )}
      </section>

      <section aria-labelledby="time-h">
        <h3 id="time-h" className="h3">Time</h3>
        <div className="field">
          <label htmlFor="final-slot" className="sr-only">Time</label>
          <select id="final-slot" value={slotId ?? ""} onChange={(e) => setSlotId(e.target.value)} disabled={!isOrganizer || slots.length === 0}>
            {slots.map((t, i) => (
              <option key={t.id} value={t.id}>{i === 0 ? "🏆 " : ""}{fmtSlot(t.start, t.end)} ({t.availableIds.length} free)</option>
            ))}
          </select>
        </div>
      </section>

      {error && <p className="field__error" role="alert">{error}</p>}
      {isOrganizer ? (
        <button type="button" className="btn btn--primary" disabled={busy || !slotId || !venueName.trim() || !venueAddress.trim()} onClick={() => void lockPlan()}>
          {busy ? "Saving…" : `🔒 Lock it in: ${activity.title}`}
        </button>
      ) : (
        <div className="banner">
          Waiting for {user(event.organizerId)?.firstName} to lock in the plan.{" "}
          <button type="button" className="link link--btn" disabled={nudged}
            onClick={() => { void sendMessage(event.id, `@${user(event.organizerId)?.username} the vote is in, can we lock it? 🙏`).then(() => setNudged(true)).catch((e) => setError(e.message)); }}>
            {nudged ? "Nudged ✓" : "Nudge them"}
          </button>
        </div>
      )}
    </div>
  );
}
