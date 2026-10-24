import type { AvailabilityKey } from "./data/types";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Four blocks per day keeps the grid tappable on a phone. Hours are [start, end). */
export const BLOCKS = [
  { label: "Morning", short: "AM", from: 8, to: 12 },
  { label: "Afternoon", short: "PM", from: 12, to: 17 },
  { label: "Evening", short: "Eve", from: 17, to: 21 },
  { label: "Late", short: "Late", from: 21, to: 24 },
] as const;

export const keyOf = (day: number, block: number) => `${day}-${block}` as AvailabilityKey;

/** Which grid cell a timestamp falls in (Monday = 0), or null outside 8am to midnight. */
export function keyForDate(date: Date): AvailabilityKey | null {
  const day = (date.getDay() + 6) % 7;
  const hour = date.getHours();
  const block = BLOCKS.findIndex((b) => hour >= b.from && hour < b.to);
  return block === -1 ? null : keyOf(day, block);
}

export function fitsAvailability(startIso: string, availability: AvailabilityKey[]) {
  const key = keyForDate(new Date(startIso));
  return key !== null && availability.includes(key);
}
