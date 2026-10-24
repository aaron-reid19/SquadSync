import type { Area, SquadEvent, Suggestion, TimeSlot, Venue } from "./data/types";
import { VENUES } from "./data/seed";

/** Most likes wins; ties go to fewer passes, then to the earlier suggestion. */
export function rankSuggestions(suggestions: Suggestion[]) {
  return suggestions
    .map((s, index) => ({ s, index, score: s.likes.length - s.passes.length }))
    .sort((a, b) => b.s.likes.length - a.s.likes.length || a.s.passes.length - b.s.passes.length || a.index - b.index)
    .map(({ s, score }) => ({ ...s, score }));
}

/** Most people free wins; ties go to the earliest slot. */
export function rankSlots(slots: TimeSlot[]) {
  return [...slots].sort(
    (a, b) => b.availableIds.length - a.availableIds.length || a.start.localeCompare(b.start)
  );
}

export function winner(event: SquadEvent) {
  return {
    activity: rankSuggestions(event.suggestions)[0],
    slot: rankSlots(event.slots)[0],
  };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type NearbyVenue = Venue & { km: number };

/** Venues for a category, closest to the meeting area first. */
export function venuesNear(area: Area, category: string): NearbyVenue[] {
  return VENUES.filter((v) => v.category === category)
    .map((v) => ({ ...v, km: distanceKm(area, v) }))
    .sort((a, b) => a.km - b.km);
}

export const venueById = (id?: string) => VENUES.find((v) => v.id === id);

/** Has this user swiped on every suggestion yet? */
export function hasFinishedVoting(event: SquadEvent, userId: string) {
  return event.suggestions.every((s) => s.likes.includes(userId) || s.passes.includes(userId));
}
