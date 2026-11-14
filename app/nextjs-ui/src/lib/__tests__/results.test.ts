import { describe, expect, it } from "vitest";
import type { SquadEvent, Suggestion, TimeSlot } from "../data/types";
import { distanceKm, hasFinishedVoting, rankSlots, rankSuggestions } from "../results";

const idea = (id: string, likes: string[] = [], passes: string[] = []): Suggestion => ({
  id, title: id, category: "Movies", price: 1, suggestedBy: "u1", likes, passes,
});
const slot = (id: string, start: string, availableIds: string[] = []): TimeSlot => ({
  id, start, end: start, availableIds,
});
const event = (patch: Partial<SquadEvent> = {}): SquadEvent => ({
  id: "e1", squadId: "s1", title: "Test", description: "", organizerId: "u1",
  area: { name: "Downtown", lat: 51.0453, lng: -114.0631 }, visibility: "squad", status: "voting",
  voteDeadline: "2026-11-20T00:00:00.000Z", slots: [], suggestions: [], attendeeIds: [], declinedIds: [],
  createdAt: "2026-11-01T00:00:00.000Z", ...patch,
});

describe("rankSuggestions", () => {
  it("puts the most liked idea first", () => {
    const ranked = rankSuggestions([idea("a", ["1"]), idea("b", ["1", "2"])]);
    expect(ranked.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("breaks a like tie with fewer passes", () => {
    const ranked = rankSuggestions([idea("a", ["1"], ["2"]), idea("b", ["1"])]);
    expect(ranked[0].id).toBe("b");
  });

  it("keeps the earlier suggestion first on a full tie", () => {
    const ranked = rankSuggestions([idea("a", ["1"]), idea("b", ["2"])]);
    expect(ranked[0].id).toBe("a");
  });

  it("adds a score of likes minus passes", () => {
    expect(rankSuggestions([idea("a", ["1", "2"], ["3"])])[0].score).toBe(1);
  });
});

describe("rankSlots", () => {
  it("puts the slot with the most people free first, then the earliest", () => {
    const ranked = rankSlots([
      slot("late", "2026-11-21T20:00:00.000Z", ["1", "2"]),
      slot("early", "2026-11-20T20:00:00.000Z", ["1", "2"]),
      slot("few", "2026-11-19T20:00:00.000Z", ["1"]),
    ]);
    expect(ranked.map((t) => t.id)).toEqual(["early", "late", "few"]);
  });

  it("does not reorder the array it was given", () => {
    const input = [slot("a", "2026-11-21T00:00:00.000Z"), slot("b", "2026-11-20T00:00:00.000Z")];
    rankSlots(input);
    expect(input[0].id).toBe("a");
  });
});

describe("hasFinishedVoting", () => {
  it("is true only when the user liked or passed every idea", () => {
    const e = event({ suggestions: [idea("a", ["me"]), idea("b", [], ["me"])] });
    expect(hasFinishedVoting(e, "me")).toBe(true);
    expect(hasFinishedVoting(event({ suggestions: [idea("a", ["me"]), idea("b")] }), "me")).toBe(false);
  });
});

describe("distanceKm", () => {
  it("is zero for the same point and a few km from Downtown to Inglewood", () => {
    const downtown = { lat: 51.0453, lng: -114.0631 };
    expect(distanceKm(downtown, downtown)).toBe(0);
    const km = distanceKm(downtown, { lat: 51.0379, lng: -114.0281 });
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(3.5);
  });
});
