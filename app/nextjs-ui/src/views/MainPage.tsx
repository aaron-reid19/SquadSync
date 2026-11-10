"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { AvatarStack } from "../components/Avatar";
import EventCard from "../components/EventCard";
import Modal from "../components/Modal";
import { useMe, useStore } from "../lib/data/store";
import { hasFinishedVoting } from "../lib/results";

const EMOJIS = ["🎉", "🎳", "🍕", "🎮", "🥾", "🎤", "🎲", "☕", "🏀", "🎬"];

type SquadModal = "create" | "join" | null;

export default function MainPage() {
  const { db, user, createSquad, joinSquad } = useStore();
  const me = useMe();
  const [modal, setModal] = useState<SquadModal>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const mySquads = db.squads.filter((squad) => squad.memberIds.includes(me.id));
  const mySquadIds = new Set(mySquads.map((squad) => squad.id));
  const myEvents = db.events.filter(
    (event) => mySquadIds.has(event.squadId) || event.attendeeIds.includes(me.id),
  );

  const needsVote = myEvents.filter(
    (event) =>
      event.status === "voting" &&
      mySquadIds.has(event.squadId) &&
      !hasFinishedVoting(event, me.id),
  );
  const waitingOnSquad = myEvents.filter(
    (event) => event.status === "voting" && !needsVote.includes(event),
  );
  const upcoming = myEvents
    .filter((event) => event.status === "final")
    .sort((a, b) => {
      const startA = a.slots.find((slot) => slot.id === a.final?.slotId)?.start ?? "";
      const startB = b.slots.find((slot) => slot.id === b.final?.slotId)?.start ?? "";
      return startA.localeCompare(startB);
    });

  const status = needsVote.length
    ? { label: "Your input is needed", detail: `${needsVote.length} plan${needsVote.length === 1 ? "" : "s"} waiting for your vote`, tone: "yellow" }
    : waitingOnSquad.length
      ? { label: "Plans in motion", detail: `${waitingOnSquad.length} vote${waitingOnSquad.length === 1 ? "" : "s"} underway with your Squads`, tone: "blue" }
      : upcoming.length
        ? { label: "All caught up", detail: "Your confirmed plans are ready when you are", tone: "green" }
        : { label: "Ready when you are", detail: "Your planning space is up to date", tone: "green" };

  function closeModal() {
    setModal(null);
    setName("");
    setCode("");
    setEmoji(EMOJIS[0]);
    setError("");
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const squadName = name.trim();
    if (squadName.length < 2) {
      setError("Give your Squad a name with at least 2 characters.");
      return;
    }
    createSquad(squadName, emoji);
    closeModal();
  }

  function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const squad = joinSquad(code.trim().toUpperCase());
    if (!squad) {
      setError("We couldn't find a Squad with that code. Check it and try again.");
      return;
    }
    closeModal();
  }

  async function copyInviteCode(inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(inviteCode);
      setCopyMessage(`Invite code ${inviteCode} copied.`);
      window.setTimeout(() => setCopied((current) => current === inviteCode ? "" : current), 1800);
    } catch {
      setCopyMessage("Clipboard access isn't available in this browser. You can select the invite code to copy it.");
    }
  }

  const welcomeText = needsVote.length
    ? `You have ${needsVote.length} plan${needsVote.length === 1 ? "" : "s"} waiting for your vote. Your next step is right below.`
    : upcoming.length
      ? "Here's what your Squads have coming up, along with anything still being decided."
      : mySquads.length
        ? "Here's the latest from your Squads. Pick up where your group left off."
        : "Your shared planning space is ready. Join a Squad or create one with your friends.";

  return (
    <div className="dashboard">
      <section className="dashboard-welcome" aria-labelledby="welcome-title">
        <div className="dashboard-welcome__copy">
          <p className="dashboard-eyebrow">YOUR PLANNING SPACE</p>
          <h1 className="h1 dashboard-welcome__title" id="welcome-title">
            Hey {me.firstName}, good to see you <span aria-hidden="true">👋</span>
          </h1>
          <p className="lead dashboard-welcome__lead">{welcomeText}</p>
        </div>
        <div className={`dashboard-status dashboard-status--${status.tone}`} role="status">
          <span className="dashboard-status__mark" aria-hidden="true">{status.tone === "yellow" ? "!" : status.tone === "blue" ? "↗" : "✓"}</span>
          <span className="dashboard-status__copy">
            <strong>{status.label}</strong>
            <small>{status.detail}</small>
          </span>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Your SquadSync overview">
        <article className="dashboard-stat dashboard-stat--yellow">
          <span className="dashboard-stat__value">{mySquads.length}</span>
          <span className="dashboard-stat__label">Your Squads</span>
          <span className="dashboard-stat__note">{mySquads.length === 1 ? "One crew to plan with" : "Groups you're part of"}</span>
        </article>
        <article className="dashboard-stat dashboard-stat--blue">
          <span className="dashboard-stat__value">{upcoming.length}</span>
          <span className="dashboard-stat__label">Upcoming plans</span>
          <span className="dashboard-stat__note">Confirmed with your group</span>
        </article>
        <article className="dashboard-stat dashboard-stat--red">
          <span className="dashboard-stat__value">{needsVote.length}</span>
          <span className="dashboard-stat__label">Votes for you</span>
          <span className="dashboard-stat__note">{needsVote.length ? "Waiting on your input" : "Nothing waiting on you"}</span>
        </article>
        <article className="dashboard-stat dashboard-stat--green">
          <span className="dashboard-stat__value">{waitingOnSquad.length}</span>
          <span className="dashboard-stat__label">In progress</span>
          <span className="dashboard-stat__note">Your Squad is still deciding</span>
        </article>
      </section>

      {needsVote.length > 0 && (
        <section className="section dashboard-section" aria-labelledby="vote-heading">
          <div className="section__head dashboard-section__head">
            <div>
              <p className="dashboard-section__eyebrow">UP NEXT</p>
              <h2 id="vote-heading" className="h2">Needs your vote</h2>
              <p className="dashboard-section__description">Add your picks so your Squad can settle on a plan.</p>
            </div>
            <span className="dashboard-section__count dashboard-section__count--yellow">{needsVote.length} waiting</span>
          </div>
          <div className="grid">
            {needsVote.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                action={
                  <Link href={`/events/${event.id}/chat?tab=vote`} className="btn btn--primary btn--small">
                    Vote now <span aria-hidden="true">→</span>
                  </Link>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="section dashboard-section" aria-labelledby="upcoming-heading">
        <div className="section__head dashboard-section__head">
          <div>
            <p className="dashboard-section__eyebrow">LOCKED IN</p>
            <h2 id="upcoming-heading" className="h2">Upcoming plans</h2>
            <p className="dashboard-section__description">The plans your Squads have agreed on.</p>
          </div>
          <span className="dashboard-section__count dashboard-section__count--blue">{upcoming.length} confirmed</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="dashboard-empty">
            <span className="dashboard-empty__icon" aria-hidden="true">🗓️</span>
            <div>
              <h3>No plans locked in yet</h3>
              <p>Once a Squad settles on an idea, time and place, the details will show up here.</p>
            </div>
          </div>
        ) : (
          <div className="grid">{upcoming.map((event) => <EventCard key={event.id} event={event} />)}</div>
        )}
      </section>

      {waitingOnSquad.length > 0 && (
        <section className="section dashboard-section" aria-labelledby="progress-heading">
          <div className="section__head dashboard-section__head">
            <div>
              <p className="dashboard-section__eyebrow">IN THE WORKS</p>
              <h2 id="progress-heading" className="h2">Voting in progress</h2>
              <p className="dashboard-section__description">These plans are moving along with your group.</p>
            </div>
            <span className="dashboard-section__count dashboard-section__count--green">{waitingOnSquad.length} active</span>
          </div>
          <div className="grid">
            {waitingOnSquad.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </section>
      )}

      <section className="section dashboard-section" aria-labelledby="squads-heading">
        <div className="section__head dashboard-section__head">
          <div>
            <p className="dashboard-section__eyebrow">YOUR PEOPLE</p>
            <h2 id="squads-heading" className="h2">Your Squads</h2>
            <p className="dashboard-section__description">Your groups, their members and invite details.</p>
          </div>
          <div className="dashboard-squad-actions">
            <button type="button" className="btn btn--small" onClick={() => setModal("join")}>
              Join with code
            </button>
            <button type="button" className="btn btn--small btn--blue" onClick={() => setModal("create")}>
              + New Squad
            </button>
          </div>
        </div>

        {mySquads.length === 0 ? (
          <div className="dashboard-empty dashboard-empty--squads">
            <span className="dashboard-empty__icon" aria-hidden="true">👥</span>
            <div>
              <h3>Your Squads will show up here</h3>
              <p>Create a group for your friends or join one with an invite code. Your events and group activity will live here.</p>
            </div>
            <div className="dashboard-empty__actions">
              <button type="button" className="btn btn--primary btn--small" onClick={() => setModal("create")}>Create a Squad</button>
              <button type="button" className="btn btn--small" onClick={() => setModal("join")}>Join a Squad</button>
            </div>
          </div>
        ) : (
          <div className="grid grid--squads">
            {mySquads.map((squad) => {
              const squadEvents = db.events.filter((event) => event.squadId === squad.id);
              const activeCount = squadEvents.filter((event) => event.status === "voting").length;
              const confirmedCount = squadEvents.filter((event) => event.status === "final").length;

              return (
                <article key={squad.id} className="card squad-card">
                  <div className="squad-card__head">
                    <span className="squad-card__emoji" aria-hidden="true">{squad.emoji}</span>
                    <div className="squad-card__identity">
                      <h3 className="squad-card__name">{squad.name}</h3>
                      <p className="muted small">{squad.memberIds.length} members</p>
                    </div>
                    {activeCount > 0 && <span className="squad-card__activity">{activeCount} active</span>}
                  </div>

                  <div className="squad-card__members">
                    <AvatarStack users={squad.memberIds.map(user)} size={30} max={6} />
                    <span className="muted small">{confirmedCount} confirmed · {activeCount} in progress</span>
                  </div>

                  <div className="squad-card__invite-row">
                    <span className="squad-card__invite-label">INVITE CODE</span>
                    <button
                      type="button"
                      className="code squad-card__invite-code"
                      onClick={() => void copyInviteCode(squad.code)}
                      aria-label={`Copy invite code ${squad.code}`}
                    >
                      <strong>{squad.code}</strong>
                      <span aria-hidden="true">{copied === squad.code ? "✓" : "⧉"}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">{copyMessage}</p>
      </section>

      <Modal open={modal === "create"} title="Create a Squad" onClose={closeModal}>
        <form onSubmit={submitCreate} noValidate>
          <div className="field">
            <label htmlFor="squad-name">Squad name</label>
            <input
              id="squad-name"
              value={name}
              maxLength={40}
              minLength={2}
              required
              onChange={(event) => { setName(event.target.value); if (error) setError(""); }}
              aria-invalid={!!error}
              aria-describedby={error ? "squad-form-error" : undefined}
              autoFocus
            />
          </div>
          <fieldset className="chips">
            <legend>Pick an icon</legend>
            <div className="chips__list">
              {EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="chip chip--emoji"
                  aria-pressed={emoji === option}
                  onClick={() => setEmoji(option)}
                  aria-label={`Choose ${option}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <div id="squad-form-error" className="form__status" role="alert">{error}</div>
          <button className="btn btn--primary" type="submit">Create Squad</button>
        </form>
      </Modal>

      <Modal open={modal === "join"} title="Join a Squad" onClose={closeModal}>
        <form onSubmit={submitJoin} noValidate>
          <div className="field">
            <label htmlFor="squad-code">Invite code</label>
            <input
              id="squad-code"
              value={code}
              maxLength={6}
              minLength={6}
              required
              autoCapitalize="characters"
              autoComplete="off"
              className="input--code"
              onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); if (error) setError(""); }}
              aria-invalid={!!error}
              aria-describedby={error ? "squad-form-error" : "squad-code-hint"}
              autoFocus
            />
            <p id="squad-code-hint" className="field__hint">Enter the six-character code shared by a Squad member.</p>
          </div>
          <div id="squad-form-error" className="form__status" role="alert">{error}</div>
          <button className="btn btn--primary" type="submit">Join Squad</button>
        </form>
      </Modal>
    </div>
  );
}
