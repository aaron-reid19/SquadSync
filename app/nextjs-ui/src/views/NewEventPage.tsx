"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import Field from "../components/Field";
import { AREAS } from "../lib/data/seed";
import { useMe, useStore } from "../lib/data/store";
import { BLOCKS, DAYS } from "../lib/availability";
import { emojiFor, uid } from "../lib/format";
import { INTERESTS } from "../lib/profileOptions";

const IDEA_TITLES: Record<string, string> = {
  Bowling: "Bowling night", Movies: "Movie night", Restaurants: "Dinner out", Karaoke: "Karaoke night",
  "Board games": "Board game café", Hiking: "Group hike", Coffee: "Coffee catch-up", Concerts: "Live show",
  Sports: "Pickup game", "Video games": "Arcade bar", "Escape rooms": "Escape room", "Mini golf": "Mini golf",
  Museums: "Museum afternoon", Parks: "Picnic in the park",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Next date (after today) that falls on `day` (Monday = 0) at `hour`. */
function nextDate(day: number, hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const today = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + (((day - today + 7) % 7) || 7));
  return d;
}

interface SlotRow { id: string; start: string; hours: number }

export default function NewEventPage() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const { db, user, createEvent } = useStore();
  const mySquads = db.squads.filter((s) => s.memberIds.includes(me.id));

  const initialSquad = mySquads.find((s) => s.id === params.get("squad"))?.id ?? mySquads[0]?.id ?? "";
  const idea = params.get("idea");
  const [squadId, setSquadId] = useState(initialSquad);
  const [title, setTitle] = useState(idea ? `${IDEA_TITLES[idea] ?? idea} with the Squad` : "");
  const [description, setDescription] = useState("");
  const [areaName, setAreaName] = useState<string>(AREAS[0].name);
  const [visibility, setVisibility] = useState<"squad" | "public">("squad");
  // Two days from now, but never later than an hour before the first default time option.
  const [deadline, setDeadline] = useState(() =>
    toLocalInput(new Date(Math.min(Date.now() + 2 * 86_400_000, nextDate(4, 19).getTime() - 3_600_000))));
  const [slots, setSlots] = useState<SlotRow[]>(() => [
    { id: uid("r"), start: toLocalInput(nextDate(4, 19)), hours: 3 },
    { id: uid("r"), start: toLocalInput(nextDate(5, 14)), hours: 3 },
  ]);
  const [ideas, setIdeas] = useState<string[]>(idea && INTERESTS.includes(idea as never) ? [idea] : []);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [suggestNote, setSuggestNote] = useState("");

  if (mySquads.length === 0) {
    return (
      <div className="event-create event-create--empty">
        <div className="card form-card event-create__empty-card">
          <span className="event-create__eyebrow">ONE PLAN STARTS WITH A SQUAD</span>
          <h1 className="h1">Create an event</h1>
          <p className="lead">Events belong to a Squad. Create or join one first, then you can bring everyone together here.</p>
          <Link href="/" className="btn btn--primary btn--auto">Go to your Squads</Link>
        </div>
      </div>
    );
  }

  /** Find the blocks most of the Squad is free and turn the top 3 into time options. */
  function suggestFromAvailability() {
    const squad = db.squads.find((s) => s.id === squadId);
    const members = (squad?.memberIds ?? []).map(user).filter(Boolean);
    const counts = new Map<string, number>();
    for (const m of members) for (const k of m!.availability) counts.set(k, (counts.get(k) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return setSuggestNote("Nobody in this Squad has set their availability yet.");
    setSlots(top.map(([k]) => {
      const [day, block] = k.split("-").map(Number);
      const hour = Math.max(BLOCKS[block].from, block === 1 ? 13 : BLOCKS[block].from + 1);
      return { id: uid("r"), start: toLocalInput(nextDate(day, hour)), hours: 3 };
    }));
    setSuggestNote(`Picked the ${top.length} times most of ${squad?.name} is free: ${top
      .map(([k, n]) => { const [d, b] = k.split("-").map(Number); return `${DAYS[d]} ${BLOCKS[b].label.toLowerCase()} (${n}/${members.length})`; })
      .join(", ")}.`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const now = Date.now();
    // Infinity when there are no valid slots, so the slots error shows instead of a deadline error.
    const earliestSlot = Math.min(...slots.filter((s) => s.start).map((s) => new Date(s.start).getTime()));
    const found = {
      title: title.trim().length >= 3 ? undefined : "Give your event a name (3+ characters).",
      squadId: squadId ? undefined : "Pick a Squad.",
      slots: slots.length === 0 ? "Add at least one time option."
        : slots.some((s) => !s.start || new Date(s.start).getTime() < now) ? "Every time option needs a future date and time." : undefined,
      ideas: ideas.length ? undefined : "Pick at least one activity to start the vote.",
      deadline: !deadline || new Date(deadline).getTime() <= now
        ? "The vote should close in the future."
        : new Date(deadline).getTime() > earliestSlot
          ? "Close the vote before the first time option starts."
          : undefined,
    };
    setErrors(found);
    const first = Object.entries(found).find(([, m]) => m)?.[0];
    if (first) return document.getElementById(first)?.focus();

    const area = AREAS.find((a) => a.name === areaName) ?? AREAS[0];
    try {
    const event = await createEvent({
      squadId, title, description, visibility, area: { ...area },
      voteDeadline: new Date(deadline).toISOString(),
      slots: slots.map((s) => {
        const start = new Date(s.start);
        return { start: start.toISOString(), end: new Date(start.getTime() + s.hours * 3_600_000).toISOString() };
      }).sort((a, b) => a.start.localeCompare(b.start)),
      ideas: ideas.map((c) => ({ title: IDEA_TITLES[c] ?? c, category: c, price: 2 as const })),
    });
    router.push(`/events/${event.id}/chat?tab=vote`);
    } catch (error) {
      setErrors((current) => ({ ...current, squadId: error instanceof Error ? error.message : "Could not create event." }));
    }
  }

  return (
    <div className="event-create">
      <header className="event-create__header">
          <span className="event-create__eyebrow">MAKE A PLAN TOGETHER</span>
          <h1 className="h1">Create an event</h1>
          <p className="lead">Choose a few details, add possible times and activities, then let your Squad vote on the plan.</p>
        </header>

        <form className="card form-card event-create__form" onSubmit={submit} noValidate aria-label="Create a Squad event">
          <fieldset className="group event-create__group">
            <legend><span className="event-create__step" aria-hidden="true">01</span> Event basics</legend>
            <p className="event-create__section-intro">Give everyone the context they need to join in.</p>
            <div className="row2">
              <Field id="title" label="Event name" error={errors.title}>
                {(a) => <input {...a} value={title} maxLength={60} placeholder="Friday night out" onChange={(e) => setTitle(e.target.value)} />}
              </Field>
              <Field id="squadId" label="Squad" error={errors.squadId}>
                {(a) => (
                  <select {...a} value={squadId} onChange={(e) => setSquadId(e.target.value)}>
                    {mySquads.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <Field id="description" label="Details" optional hint="What's the vibe? Budget? Anything people should know?">
              {(a) => <textarea {...a} rows={3} maxLength={280} value={description} onChange={(e) => setDescription(e.target.value)} />}
            </Field>
            <div className="row2">
              <Field id="area" label="Meet around">
                {(a) => (
                  <select {...a} value={areaName} onChange={(e) => setAreaName(e.target.value)}>
                    {AREAS.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                  </select>
                )}
              </Field>
              <Field id="deadline" label="Voting closes" error={errors.deadline}>
                {(a) => <input {...a} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
              </Field>
            </div>
            <fieldset className="chips">
              <legend>Who can see it?</legend>
              <div className="chips__list">
                <button type="button" className="chip" aria-pressed={visibility === "squad"} onClick={() => setVisibility("squad")}>🔒 Squad only</button>
                <button type="button" className="chip" aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}>🌍 Public on Explore</button>
              </div>
            </fieldset>
          </fieldset>

          <fieldset className="group event-create__group" id="slots" tabIndex={-1}>
            <legend><span className="event-create__step" aria-hidden="true">02</span> Time options</legend>
            <p className="event-create__section-intro">Offer a few dates so everyone has a chance to find a time that works.</p>
            <button type="button" className="btn btn--small btn--auto btn--blue event-create__suggest" onClick={suggestFromAvailability}>
              ✨ Suggest times from Squad availability
            </button>
            {suggestNote && <p className="field__hint" role="status">{suggestNote}</p>}
            <ul className="slot-rows">
              {slots.map((s, i) => (
                <li key={s.id} className="slot-row">
                  <label className="sr-only" htmlFor={`slot-${s.id}`}>Option {i + 1} start</label>
                  <input id={`slot-${s.id}`} type="datetime-local" value={s.start}
                    onChange={(e) => setSlots(slots.map((x) => (x.id === s.id ? { ...x, start: e.target.value } : x)))} />
                  <label className="sr-only" htmlFor={`hours-${s.id}`}>Option {i + 1} length</label>
                  <select id={`hours-${s.id}`} value={s.hours}
                    onChange={(e) => setSlots(slots.map((x) => (x.id === s.id ? { ...x, hours: Number(e.target.value) } : x)))}>
                    {[1, 2, 3, 4, 6].map((h) => <option key={h} value={h}>{h} h</option>)}
                  </select>
                  <button type="button" className="icon-btn" aria-label={`Remove option ${i + 1}`}
                    onClick={() => setSlots(slots.filter((x) => x.id !== s.id))}>✕</button>
                </li>
              ))}
            </ul>
            {slots.length < 6 && (
              <button type="button" className="btn btn--small btn--auto"
                onClick={() => setSlots([...slots, { id: uid("r"), start: toLocalInput(nextDate(6, 19)), hours: 3 }])}>
                + Add time
              </button>
            )}
            {errors.slots && <p className="field__error">{errors.slots}</p>}
          </fieldset>

          <fieldset className="group event-create__group" id="ideas" tabIndex={-1}>
            <legend><span className="event-create__step" aria-hidden="true">03</span> What should you do?</legend>
            <p className="event-create__section-intro">Pick at least one activity to kick off the vote. Your Squad can add more later.</p>
            <div className="chips__list">
              {INTERESTS.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={ideas.includes(c)}
                  onClick={() => setIdeas(ideas.includes(c) ? ideas.filter((x) => x !== c) : [...ideas, c])}>
                  {emojiFor(c)} {c}
                </button>
              ))}
            </div>
            <p className="event-create__selection-count" aria-live="polite">
            {ideas.length ? `${ideas.length} ${ideas.length === 1 ? "activity" : "activities"} selected` : "No activities selected yet"}
            </p>
            {errors.ideas && <p className="field__error">{errors.ideas}</p>}
          </fieldset>

          <div className="event-create__footer">
            <p className="event-create__footer-note">
              {slots.length} {slots.length === 1 ? "time option" : "time options"} · {ideas.length} {ideas.length === 1 ? "activity" : "activities"} selected
            </p>
            <button className="btn btn--primary event-create__submit" type="submit">Create event &amp; open voting <span aria-hidden="true">→</span></button>
          </div>
        </form>
    </div>
  );
}
