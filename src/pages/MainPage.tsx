import { Link, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { AvatarStack } from "../components/Avatar";
import EventCard from "../components/EventCard";
import Modal from "../components/Modal";
import { useMe, useStore } from "../lib/data/store";
import { hasFinishedVoting } from "../lib/results";

const EMOJIS = ["🎉", "🎳", "🍕", "🎮", "🥾", "🎤", "🎲", "☕", "🏀", "🎬"];

export default function MainPage() {
  const { db, user, createSquad, joinSquad } = useStore();
  const me = useMe();
  const navigate = useNavigate();
  const [modal, setModal] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const mySquads = db.squads.filter((s) => s.memberIds.includes(me.id));
  const mySquadIds = new Set(mySquads.map((s) => s.id));
  const myEvents = db.events.filter((e) => mySquadIds.has(e.squadId) || e.attendeeIds.includes(me.id));
  const needsVote = myEvents.filter((e) => e.status === "voting" && mySquadIds.has(e.squadId) && !hasFinishedVoting(e, me.id));
  const voting = myEvents.filter((e) => e.status === "voting" && !needsVote.includes(e));
  const upcoming = myEvents
    .filter((e) => e.status === "final")
    .sort((a, b) => {
      const sa = a.slots.find((t) => t.id === a.final?.slotId)?.start ?? "";
      const sb = b.slots.find((t) => t.id === b.final?.slotId)?.start ?? "";
      return sa.localeCompare(sb);
    });

  function close() {
    setModal(null);
    setName("");
    setCode("");
    setError("");
  }

  function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Give your Squad a name (2+ characters).");
    createSquad(name, emoji);
    close();
  }

  function submitJoin(e: FormEvent) {
    e.preventDefault();
    const squad = joinSquad(code);
    if (!squad) return setError("No Squad has that code. Check it and try again.");
    close();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(() => setCopied(""), 1500);
    } catch { /* clipboard blocked: code is visible anyway */ }
  }

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="h1">Hey {me.firstName} 👋</h1>
          <p className="lead">
            {needsVote.length
              ? `${needsVote.length} plan${needsVote.length > 1 ? "s" : ""} waiting on your vote.`
              : "You're all caught up. Start something new?"}
          </p>
        </div>
        <div className="hero__actions">
          <Link to="/events/new" className="btn btn--primary btn--auto">Create event</Link>
        </div>
      </section>

      {needsVote.length > 0 && (
        <section className="section" aria-labelledby="vote-h">
          <h2 id="vote-h" className="h2">Needs your vote</h2>
          <div className="grid">
            {needsVote.map((e) => (
              <EventCard key={e.id} event={e} action={
                <Link to={`/events/${e.id}/chat?tab=vote`} className="btn btn--primary btn--small">Swipe now</Link>
              } />
            ))}
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="up-h">
        <h2 id="up-h" className="h2">Upcoming plans</h2>
        {upcoming.length === 0 ? (
          <p className="empty">Nothing locked in yet. Once a vote closes, the plan shows up here.</p>
        ) : (
          <div className="grid">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>

      {voting.length > 0 && (
        <section className="section" aria-labelledby="open-h">
          <h2 id="open-h" className="h2">Still deciding</h2>
          <div className="grid">{voting.map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}

      <section className="section" aria-labelledby="sq-h">
        <div className="section__head">
          <h2 id="sq-h" className="h2">Your Squads</h2>
          <div className="row-gap">
            <button type="button" className="btn btn--small" onClick={() => setModal("join")}>Join with code</button>
            <button type="button" className="btn btn--small btn--blue" onClick={() => setModal("create")}>New Squad</button>
          </div>
        </div>
        {mySquads.length === 0 ? (
          <p className="empty">You're not in a Squad yet. Create one or join with a friend's code.</p>
        ) : (
          <div className="grid grid--squads">
            {mySquads.map((s) => {
              const count = db.events.filter((e) => e.squadId === s.id).length;
              return (
                <article key={s.id} className="card squad-card">
                  <div className="squad-card__head">
                    <span className="squad-card__emoji" aria-hidden="true">{s.emoji}</span>
                    <div>
                      <h3 className="squad-card__name">{s.name}</h3>
                      <p className="muted small">{s.memberIds.length} members · {count} event{count === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <AvatarStack users={s.memberIds.map(user)} size={30} max={6} />
                  <div className="squad-card__foot">
                    <button type="button" className="code" onClick={() => copy(s.code)} aria-label={`Copy invite code ${s.code}`}>
                      {copied === s.code ? "Copied!" : <>Invite code <strong>{s.code}</strong></>}
                    </button>
                    <button type="button" className="btn btn--small btn--primary btn--auto"
                      onClick={() => navigate(`/events/new?squad=${s.id}`)}>
                      Plan something
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={modal === "create"} title="Create a Squad" onClose={close}>
        <form onSubmit={submitCreate} noValidate>
          <div className="field">
            <label htmlFor="squad-name">Squad name</label>
            <input id="squad-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!!error} autoFocus />
          </div>
          <fieldset className="chips">
            <legend>Pick an icon</legend>
            <div className="chips__list">
              {EMOJIS.map((x) => (
                <button key={x} type="button" className="chip chip--emoji" aria-pressed={emoji === x} onClick={() => setEmoji(x)} aria-label={x}>{x}</button>
              ))}
            </div>
          </fieldset>
          <div className="form__status" role="alert">{error}</div>
          <button className="btn btn--primary" type="submit">Create Squad</button>
        </form>
      </Modal>

      <Modal open={modal === "join"} title="Join a Squad" onClose={close}>
        <form onSubmit={submitJoin} noValidate>
          <div className="field">
            <label htmlFor="squad-code">Invite code</label>
            <input id="squad-code" value={code} maxLength={6} autoCapitalize="characters" className="input--code"
              onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={!!error} autoFocus />
            <p className="field__hint">Try <code>MEEPLE</code> or <code>SINGIT</code> from the demo data.</p>
          </div>
          <div className="form__status" role="alert">{error}</div>
          <button className="btn btn--primary" type="submit">Join</button>
        </form>
      </Modal>
    </>
  );
}
