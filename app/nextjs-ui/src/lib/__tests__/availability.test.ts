import { describe, expect, it } from "vitest";
import { fitsAvailability, keyForDate, keyOf } from "../availability";

// new Date(y, m, d, h) is local time, which is what keyForDate reads.
// Nov 16 2026 is a Monday.
describe("keyForDate", () => {
  it("maps Monday 9am to the Monday morning cell", () => {
    expect(keyForDate(new Date(2026, 10, 16, 9))).toBe("0-0");
  });

  it("maps Sunday 11pm to the Sunday late cell", () => {
    expect(keyForDate(new Date(2026, 10, 22, 23))).toBe("6-3");
  });

  it("puts block edges in the later block (hours are [start, end))", () => {
    expect(keyForDate(new Date(2026, 10, 16, 12))).toBe("0-1");
    expect(keyForDate(new Date(2026, 10, 16, 17))).toBe("0-2");
  });

  it("returns null before 8am", () => {
    expect(keyForDate(new Date(2026, 10, 16, 7, 59))).toBeNull();
  });
});

describe("fitsAvailability", () => {
  it("is true only when the start time lands in a selected cell", () => {
    const friEvening = new Date(2026, 10, 20, 19).toISOString();
    expect(fitsAvailability(friEvening, [keyOf(4, 2)])).toBe(true);
    expect(fitsAvailability(friEvening, [keyOf(4, 1)])).toBe(false);
  });
});
