"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Area, AvailabilityKey, DB, Message, Squad, SquadEvent, Suggestion, User, Venue } from "./types";

const DB_VERSION = 4;
const EMPTY_DB: DB = { version: DB_VERSION, users: [], squads: [], events: [], messages: [] };

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

export interface SignupInput {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone?: string;
  city: string;
  travelKm: number;
  pronouns?: string;
  bio?: string;
  interests: string[];
  transport: string[];
}

type SignupResult = { ok: true } | { ok: false; field: "username" | "email"; error: string };

interface Store {
  ready: boolean;
  db: DB;
  me: User | null;
  user: (id: string) => User | undefined;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<boolean>;
  signup: (input: SignupInput) => Promise<SignupResult>;
  isUsernameTaken: (username: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Omit<User, "id" | "username">>) => Promise<void>;
  setAvailability: (keys: AvailabilityKey[]) => Promise<void>;
  createSquad: (name: string, emoji: string) => Promise<Squad>;
  joinSquad: (code: string) => Promise<Squad | null>;
  leaveSquad: (squadId: string) => Promise<void>;
  createEvent: (input: NewEventInput) => Promise<SquadEvent>;
  rsvp: (eventId: string, going: boolean) => Promise<void>;
  vote: (eventId: string, suggestionId: string, like: boolean | null) => Promise<void>;
  addSuggestion: (eventId: string, idea: Omit<Suggestion, "id" | "suggestedBy" | "likes" | "passes">) => Promise<void>;
  toggleSlot: (eventId: string, slotId: string, free?: boolean) => Promise<void>;
  addSlot: (eventId: string, start: string, end: string) => Promise<void>;
  finalize: (eventId: string, plan: { suggestionId: string; slotId: string; venue: Venue }) => Promise<void>;
  reopen: (eventId: string) => Promise<void>;
  sendMessage: (eventId: string, text: string) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function getCsrfToken() {
  const response = await fetch("/api/auth/csrf", { credentials: "include", cache: "no-store" });
  const data = await responseJson<{ csrfToken: string }>(response);
  return data.csrfToken;
}

async function apiRead<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include", cache: "no-store" });
  return responseJson<T>(response);
}

async function apiWrite<T = { ok: boolean }>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return responseJson<T>(response);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(EMPTY_DB);
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    let account: { user: User };
    try {
      account = await apiRead<{ user: User }>("/api/auth/me");
    } catch (error) {
      if (error instanceof Error && /401|not signed in/i.test(error.message)) {
        setDb(EMPTY_DB);
        setMeId(null);
        return;
      }
      throw error;
    }

    const [squads, events] = await Promise.all([
      apiRead<Squad[]>("/api/squads"),
      apiRead<SquadEvent[]>("/api/events"),
    ]);
    const ids = new Set<string>([account.user.id]);
    for (const squad of squads) for (const memberId of squad.memberIds) ids.add(memberId);
    for (const event of events) {
      ids.add(event.organizerId);
      for (const attendee of event.attendeeIds) ids.add(attendee);
      for (const attendee of event.declinedIds) ids.add(attendee);
      for (const slot of event.slots) for (const userId of slot.availableIds) ids.add(userId);
      for (const suggestion of event.suggestions) {
        ids.add(suggestion.suggestedBy);
        for (const voter of suggestion.likes) ids.add(voter);
        for (const voter of suggestion.passes) ids.add(voter);
      }
    }
    const profileIds = [...ids];
    const profiles = profileIds.length
      ? await apiRead<User[]>(`/api/auth/profiles?ids=${encodeURIComponent(profileIds.join(","))}`)
      : [];
    const users = [account.user, ...profiles.filter((profile) => profile.id !== account.user.id)];
    const messageGroups = await Promise.all(events.map(async (event) => {
      try { return await apiRead<Message[]>(`/api/chat/messages?eventId=${encodeURIComponent(event.id)}`); }
      catch { return []; }
    }));
    setDb({ version: DB_VERSION, users, squads, events, messages: messageGroups.flat() });
    setMeId(account.user.id);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch((error) => console.error("Could not load SquadSync data:", error)).finally(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, [refresh]);

  const me = useMemo(() => db.users.find((user) => user.id === meId) ?? null, [db.users, meId]);

  const store = useMemo<Store>(() => {
    const user = (id: string) => db.users.find((entry) => entry.id === id);
    return {
      ready, db, me, user, refresh,

      async login(identifier, password) {
        try {
          await apiWrite("/api/auth/login", "POST", { identifier: identifier.trim().toLowerCase(), password });
          await refresh();
          return true;
        } catch (error) {
          console.error("Sign-in failed:", error);
          return false;
        }
      },

      async signup(input) {
        try {
          await apiWrite("/api/auth/signup", "POST", {
            ...input,
            acceptTerms: true,
            termsVersion: "2026-10-20",
          });
          await refresh();
          return { ok: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not create your account.";
          const field = /username/i.test(message) ? "username" : "email";
          return { ok: false, field, error: message };
        }
      },

      async isUsernameTaken(username) {
        const response = await apiRead<{ available: boolean }>(`/api/auth/username-available?u=${encodeURIComponent(username.trim().toLowerCase())}`);
        return !response.available;
      },

      async logout() {
        try { await apiWrite("/api/auth/logout", "POST"); }
        catch (error) { console.error("Logout request failed:", error); }
        setDb(EMPTY_DB);
        setMeId(null);
      },

      async updateProfile(patch) {
        await apiWrite("/api/auth/profile", "PATCH", patch);
        await refresh();
      },

      async setAvailability(keys) {
        await apiWrite("/api/auth/profile", "PATCH", { availability: keys });
        await refresh();
      },

      async createSquad(name, emoji) {
        const squad = await apiWrite<Squad>("/api/squads", "POST", { name: name.trim(), emoji });
        await refresh();
        return squad;
      },

      async joinSquad(code) {
        try {
          const squad = await apiWrite<Squad>("/api/squads/join", "POST", { code: code.trim().toUpperCase() });
          await refresh();
          return squad;
        } catch (error) {
          if (error instanceof Error && /couldn't find|not found/i.test(error.message)) return null;
          throw error;
        }
      },

      async leaveSquad(squadId) {
        await apiWrite(`/api/squads/${encodeURIComponent(squadId)}/membership`, "DELETE");
        await refresh();
      },

      async createEvent(input) {
        const event = await apiWrite<SquadEvent>("/api/events", "POST", input);
        await refresh();
        return event;
      },

      async rsvp(eventId, going) {
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/rsvp`, "POST", { going });
        await refresh();
      },

      async vote(eventId, suggestionId, like) {
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/suggestions/${encodeURIComponent(suggestionId)}/vote`, "PUT", {
          vote: like === null ? null : like ? "like" : "pass",
        });
        await refresh();
      },

      async addSuggestion(eventId, idea) {
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/suggestions`, "POST", idea);
        await refresh();
      },

      async toggleSlot(eventId, slotId, free) {
        const event = db.events.find((entry) => entry.id === eventId);
        const slot = event?.slots.find((entry) => entry.id === slotId);
        const currentlyFree = Boolean(me && slot?.availableIds.includes(me.id));
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/slots/${encodeURIComponent(slotId)}/availability`, "PUT", {
          available: free ?? !currentlyFree,
        });
        await refresh();
      },

      async addSlot(eventId, start, end) {
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/slots`, "POST", { start, end });
        await refresh();
      },

      async finalize(eventId, plan) {
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/finalize`, "POST", {
          suggestionId: plan.suggestionId, slotId: plan.slotId, venue: plan.venue,
        });
        await refresh();
      },

      async reopen(eventId) {
        await apiWrite(`/api/events/${encodeURIComponent(eventId)}/reopen`, "POST", {});
        await refresh();
      },

      async sendMessage(eventId, text) {
        const message = await apiWrite<Message>("/api/chat/messages", "POST", { eventId, text: text.trim() });
        setDb((current) => ({ ...current, messages: [...current.messages, message] }));
      },
    };
  }, [db, me, ready, refresh]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside <StoreProvider>");
  return context;
}

export function useMe() {
  const { me } = useStore();
  if (!me) throw new Error("useMe called without a signed-in user");
  return me;
}
