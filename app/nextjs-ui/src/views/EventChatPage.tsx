"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ChatPanel from "../components/ChatPanel";
import Tabs from "../components/Tabs";
import VotingPanel from "../components/VotingPanel";
import { useMe, useStore } from "../lib/data/store";

type Tab = "chat" | "vote";

export default function EventChatPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { db } = useStore();
  const me = useMe();
  const tab: Tab = params.get("tab") === "vote" ? "vote" : "chat";
  const event = db.events.find((e) => e.id === id);
  const squad = db.squads.find((s) => s.id === event?.squadId);

  if (!event || !squad) {
    return (
      <div className="card form-card">
        <h1 className="h1">Event not found</h1>
        <Link href="/" className="btn btn--primary btn--auto">Back to Main</Link>
      </div>
    );
  }

  if (!squad.memberIds.includes(me.id) && !event.attendeeIds.includes(me.id)) {
    return (
      <div className="card form-card">
        <h1 className="h1">Sign up to join the chat</h1>
        <p className="lead">Chat and voting are open to {squad.name} members and people who signed up.</p>
        <Link href={`/events/${event.id}`} className="btn btn--primary btn--auto">View event</Link>
      </div>
    );
  }

  const toSwipe = event.status === "voting"
    ? event.suggestions.filter((s) => !s.likes.includes(me.id) && !s.passes.includes(me.id)).length
    : 0;

  return (
    <div className="chat-page">
      <div className="chat-page__head">
        <Link href={`/events/${event.id}`} className="back">← Event details</Link>
        <h1 className="h1 h1--sm">{squad.emoji} {event.title}</h1>
        <p className="muted small">{squad.name} · {squad.memberIds.length} members</p>
      </div>
      <Tabs<Tab>
        label="Event sections"
        active={tab}
        onChange={(t) => router.replace(`/events/${event.id}/chat${t === "vote" ? "?tab=vote" : ""}`)}
        tabs={[
          { id: "chat", label: "💬 Chat" },
          { id: "vote", label: event.status === "final" ? "✅ Plan" : "🗳️ Voting", badge: toSwipe },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === "chat" ? <ChatPanel event={event} /> : <VotingPanel key={event.status} event={event} />}
      </div>
    </div>
  );
}
