import type { SquadEvent } from "../lib/data/types";
import { useStore } from "../lib/data/store";
import { emojiFor, fmtSlot, fullName } from "../lib/format";
import { AvatarStack } from "./Avatar";

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function downloadIcs(event: SquadEvent, title: string, location: string, start: string, end: string) {
  const esc = (value: string) => value.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SquadSync//EN", "BEGIN:VEVENT",
    `UID:${event.id}@squadsync.app`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(`${event.title}: ${title}`)}`, `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(event.description || "Planned with SquadSync")}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${event.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function FinalPlan({ event }: { event: SquadEvent; showMap?: boolean }) {
  const { user } = useStore();
  if (!event.final) return null;
  const activity = event.suggestions.find((suggestion) => suggestion.id === event.final!.suggestionId);
  const slot = event.slots.find((time) => time.id === event.final!.slotId);
  const venue = event.final.venue;
  if (!activity || !slot || !venue) return null;
  const going = event.attendeeIds.map(user);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}`)}`;

  return (
    <section className="card final" aria-labelledby="final-h">
      <div className="final__ticket">
        <span className="final__stamp">It&apos;s a plan!</span>
        <div className="final__emoji" aria-hidden="true">{emojiFor(activity.category)}</div>
        <h2 id="final-h" className="final__title">{activity.title}</h2>
        <dl className="final__facts">
          <div><dt>When</dt><dd>{fmtSlot(slot.start, slot.end)}</dd></div>
          <div><dt>Where</dt><dd>{venue.name}<br /><span className="muted small">{venue.address}</span></dd></div>
          <div><dt>Meeting area</dt><dd>{event.area.name}</dd></div>
          <div><dt>Who&apos;s in</dt><dd className="row-gap"><AvatarStack users={going} size={28} max={8} /> <span className="small">{going.map((person) => person?.firstName).filter(Boolean).join(", ")}</span></dd></div>
          <div><dt>Organizer</dt><dd>{fullName(user(event.organizerId))}</dd></div>
        </dl>
        <div className="row-gap wrap">
          <button type="button" className="btn btn--small btn--primary btn--auto" onClick={() => downloadIcs(event, activity.title, `${venue.name}, ${venue.address}`, slot.start, slot.end)}>
            📅 Add to calendar
          </button>
          <a className="btn btn--small btn--auto" href={mapsUrl} target="_blank" rel="noreferrer">🧭 Find directions</a>
        </div>
      </div>
    </section>
  );
}
