import { describe, expect, it } from "vitest";
import type { SquadEvent } from "../data/types";
import { isVotingClosed } from "../results";

const event = (patch: Partial<SquadEvent> = {}): SquadEvent => ({
  id: "e1", squadId: "s1", title: "Test", description: "", organizerId: "u1",
  area: { name: "Downtown", lat: 51.0453, lng: -114.0631 }, visibility: "squad", status: "voting",
  voteDeadline: "2026-11-20T00:00:00.000Z", slots: [], suggestions: [], attendeeIds: [], declinedIds: [],
  createdAt: "2026-11-01T00:00:00.000Z", ...patch,
});

describe("isVotingClosed", () => {
  const now = new Date("2026-11-13T12:00:00.000Z").getTime();

  it("is false before the deadline", () => {
    expect(isVotingClosed(event({ voteDeadline: "2026-11-14T00:00:00.000Z" }), now)).toBe(false);
  });

  it("is true once the deadline has passed", () => {
    expect(isVotingClosed(event({ voteDeadline: "2026-11-12T00:00:00.000Z" }), now)).toBe(true);
  });

  it("is false for a locked-in event, whatever the deadline", () => {
    expect(isVotingClosed(event({ status: "final", voteDeadline: "2026-11-12T00:00:00.000Z" }), now)).toBe(false);
  });
});
