import type { SquadEvent } from "../lib/data/types";
import { useStore } from "../lib/data/store";
import { emojiFor, fmtSlot, fullName, priceLabel } from "../lib/format";
import { distanceKm, venueById } from "../lib/results";
import { AvatarStack } from "./Avatar";
import VenueMap from "./VenueMap";

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function downloadIcs(event: SquadEvent, title: string, location: string, start: string, end: string) {
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SquadSync//MVP//EN", "BEGIN:VEVENT",
    `UID:${event.id}@squadsync.app`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(`${event.title}: ${title}`)}`, `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(event.description || "Planned with SquadSync")}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinalPlan({ event, showMap = true }: { event: SquadEvent; showMap?: boolean }) {
  const { user } = useStore();
  if (!event.final) return null;
  const activity = event.suggestions.find((s) => s.id === event.final!.suggestionId);
  const slot = event.slots.find((t) => t.id === event.final!.slotId);
  const venue = venueById(event.final.venueId);
  if (!activity || !slot || !venue) return null;
  const going = event.attendeeIds.map(user);
  const mapsUrl = `https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=17/${venue.lat}/${venue.lng}`;

  return (
    <section className="card final" aria-labelledby="final-h">
      <div className="final__ticket">
        <span className="final__stamp">It&apos;s a plan!</span>
        <div className="final__emoji" aria-hidden="true">{emojiFor(activity.category)}</div>
        <h2 id="final-h" className="final__title">{activity.title}</h2>
        <dl className="final__facts">
          <div><dt>When</dt><dd>{fmtSlot(slot.start, slot.end)}</dd></div>
          <div><dt>Where</dt><dd>{venue.name}<br /><span className="muted small">{venue.address} · ★ {venue.rating} · {priceLabel(venue.price)}</span></dd></div>
          <div><dt>From meet area</dt><dd>{distanceKm(event.area, venue).toFixed(1)} km from {event.area.name}</dd></div>
          <div><dt>Who&apos;s in</dt><dd className="row-gap"><AvatarStack users={going} size={28} max={8} /> <span className="small">{going.map((u) => u?.firstName).join(", ")}</span></dd></div>
          <div><dt>Organizer</dt><dd>{fullName(user(event.organizerId))}</dd></div>
        </dl>
        <div className="row-gap wrap">
          <button type="button" className="btn btn--small btn--primary btn--auto"
            onClick={() => downloadIcs(event, activity.title, `${venue.name}, ${venue.address}, Calgary`, slot.start, slot.end)}>
            📅 Add to calendar
          </button>
          <a className="btn btn--small btn--auto" href={mapsUrl} target="_blank" rel="noreferrer">🧭 Directions</a>
        </div>
      </div>
      {showMap && <VenueMap area={event.area} venues={[venue]} selectedId={venue.id} height={300} />}
    </section>
  );
}
