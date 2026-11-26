import type { SquadEvent, Suggestion, TimeSlot } from "./data/types";

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

/** Voting is still open on paper, but its deadline has passed. */
export function isVotingClosed(event: SquadEvent, now = Date.now()) {
  return event.status === "voting" && new Date(event.voteDeadline).getTime() <= now;
}

/** Has this user swiped on every suggestion yet? */
export function hasFinishedVoting(event: SquadEvent, userId: string) {
  return event.suggestions.every((s) => s.likes.includes(userId) || s.passes.includes(userId));
}

/**
 * Calculates the distance between two geographical coordinates
 * using the Haversine formula.
 *
 * Returns distance in kilometres.
 */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const earthRadiusKm = 6371.0088;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const clamped = Math.min(1, Math.max(0, haversine));

  return (
    2 *
    earthRadiusKm *
    Math.atan2(
      Math.sqrt(clamped),
      Math.sqrt(1 - clamped)
    )
  );
}
