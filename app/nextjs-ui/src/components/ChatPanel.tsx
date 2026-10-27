import { FormEvent, useEffect, useRef, useState } from "react";
import type { SquadEvent } from "../lib/data/types";
import { useMe, useStore } from "../lib/data/store";
import { fmtDay, fmtTime } from "../lib/format";
import { rankSlots, rankSuggestions } from "../lib/results";
import { Avatar } from "./Avatar";

export default function ChatPanel({ event }: { event: SquadEvent }) {
  const me = useMe();
  const { db, user, sendMessage } = useStore();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const messages = db.messages.filter((m) => m.eventId === event.id).sort((a, b) => a.at.localeCompare(b.at));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(event.id, text);
    setText("");
  }

  function shareStatus() {
    const top = rankSuggestions(event.suggestions)[0];
    const slot = rankSlots(event.slots)[0];
    const when = slot ? `${fmtDay(slot.start)} ${fmtTime(slot.start)}` : "TBD";
    sendMessage(event.id, `📊 Vote check: ${top ? `${top.title} is leading with ${top.likes.length} 👍` : "no ideas yet"}, best time ${when}.`);
  }

  let lastDay = "";
  return (
    <div className="chat">
      <div className="chat__log" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && <p className="empty center">No messages yet. Say hi 👋</p>}
        {messages.map((m) => {
          const day = fmtDay(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          if (m.userId === "system") {
            return (
              <div key={m.id}>
                {showDay && <p className="chat__day">{day}</p>}
                <p className="chat__system">{m.text}</p>
              </div>
            );
          }
          const author = user(m.userId);
          const mine = m.userId === me.id;
          return (
            <div key={m.id}>
              {showDay && <p className="chat__day">{day}</p>}
              <div className={`msg${mine ? " msg--mine" : ""}`}>
                {!mine && <Avatar user={author} size={32} />}
                <div className="msg__bubble">
                  {!mine && <span className="msg__name">{author?.firstName}</span>}
                  <span className="msg__text">{m.text}</span>
                  <time className="msg__time" dateTime={m.at}>{fmtTime(m.at)}</time>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="chat__quick">
        {event.status === "voting" && <button type="button" className="chip" onClick={shareStatus}>📊 Share vote status</button>}
        {["I'm in! 🙌", "Running late", "Who's driving?"].map((q) => (
          <button key={q} type="button" className="chip" onClick={() => sendMessage(event.id, q)}>{q}</button>
        ))}
      </div>
      <form className="chat__form" onSubmit={submit}>
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input id="chat-input" value={text} maxLength={500} autoComplete="off" placeholder={`Message ${event.title}`} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn--primary btn--auto" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
