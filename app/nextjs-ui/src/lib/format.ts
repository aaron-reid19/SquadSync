import type { User } from "./data/types";

const dayFmt = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit" });

export const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso)).replace(":00", "");
export const fmtSlot = (start: string, end: string) => `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`;

export function fmtRelative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const amount = mins < 60 ? `${Math.max(mins, 1)} min` : hours < 24 ? `${hours} h` : `${days} d`;
  return diff >= 0 ? `in ${amount}` : `${amount} ago`;
}

export const fullName = (u?: User) => (u ? `${u.firstName} ${u.lastName}` : "Someone");
export const initials = (u?: User) => (u ? `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase() : "?");
export const priceLabel = (p: number) => "$".repeat(p);

export const CATEGORY_EMOJI: Record<string, string> = {
  Bowling: "🎳", Movies: "🍿", Restaurants: "🍜", Karaoke: "🎤", "Board games": "🎲", Hiking: "🥾",
  Coffee: "☕", Concerts: "🎸", Sports: "🏀", "Video games": "🕹️", "Escape rooms": "🔐", "Mini golf": "⛳",
  Museums: "🏛️", Parks: "🌳",
};
export const emojiFor = (category: string) => CATEGORY_EMOJI[category] ?? "✨";

/** Card colour per category, from the brand palette. */
export function toneFor(category: string) {
  const tones = ["var(--yellow)", "var(--blue)", "var(--green)", "#ffb470", "#c9a7ff"];
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
