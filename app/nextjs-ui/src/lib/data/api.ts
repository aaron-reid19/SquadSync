import type { Area, AvailabilityKey, Message, Squad, SquadEvent, Suggestion } from "./types";
import type { AuthUser } from "../auth";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const getSquads = async () => (await request<{ squads: Squad[] }>("/api/squads")).squads;
export const createSquad = async (name: string, emoji: string) => (await request<{ squad: Squad }>("/api/squads", json({ name, emoji }))).squad;
export const joinSquad = async (code: string) => (await request<{ squad: Squad }>("/api/squads/join", json({ code }))).squad;
export const leaveSquad = (id: string) => request<void>(`/api/squads/${encodeURIComponent(id)}/membership`, { method: "DELETE" });

export interface NewEventInput {
  squadId: string;
  title: string;
  description: string;
  area: Area;
  visibility: "squad" | "public";
  voteDeadline: string;
  slots: { start: string; end: string }[];
  ideas: { title: string; category: string; price: 1 | 2 | 3; note?: string }[];
}

export const getEvents = () => request<SquadEvent[]>("/api/events");
export const createEvent = (input: NewEventInput) => request<SquadEvent>("/api/events", json(input));
export const rsvp = (eventId: string, going: boolean) => request<SquadEvent>(`/api/events/${eventId}/rsvp`, json({ going }));
export const vote = (eventId: string, suggestionId: string, like: boolean | null) => request<SquadEvent>(`/api/events/${eventId}/suggestions/${suggestionId}/vote`, json({ vote: like == null ? null : like ? "like" : "pass" }));
export const addSuggestion = (eventId: string, idea: Omit<Suggestion, "id" | "suggestedBy" | "likes" | "passes">) => request<SquadEvent>(`/api/events/${eventId}/suggestions`, json(idea));
export const toggleSlot = (eventId: string, slotId: string, available: boolean) => request<SquadEvent>(`/api/events/${eventId}/slots/${slotId}/availability`, json({ available }));
export const addSlot = (eventId: string, start: string, end: string) => request<SquadEvent>(`/api/events/${eventId}/slots`, json({ start, end }));
export const finalize = (eventId: string, plan: { suggestionId: string; slotId: string; venueId: string }) => request<SquadEvent>(`/api/events/${eventId}/finalize`, json(plan));
export const reopen = (eventId: string) => request<SquadEvent>(`/api/events/${eventId}/reopen`, json({}));

export const getMessages = (eventId: string) => request<Message[]>(`/api/chat/messages?eventId=${encodeURIComponent(eventId)}`);
export const sendMessage = (eventId: string, body: string) => request<Message>("/api/chat/messages", json({ eventId, body }));

export const getUsers = (ids: string[]) => ids.length
  ? request<AuthUser[]>(`/api/auth/users?ids=${ids.map(encodeURIComponent).join(",")}`)
  : Promise.resolve([] as AuthUser[]);

export type ProfilePatch = Partial<Pick<AuthUser, "firstName" | "lastName" | "email" | "phone" | "city" | "travelKm" | "pronouns" | "bio" | "interests" | "transport" | "color">>;

export const updateProfile = (patch: ProfilePatch) => request<void>("/api/auth/me", { method: "PATCH", body: JSON.stringify(patch) });
export const updateAvailability = (availability: AvailabilityKey[]) => request<void>("/api/auth/me/availability", { method: "PUT", body: JSON.stringify({ availability }) });
