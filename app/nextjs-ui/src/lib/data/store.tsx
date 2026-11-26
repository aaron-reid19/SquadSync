"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  addSlot as addSlotApi, addSuggestion as addSuggestionApi, createEvent as createEventApi, createSquad as createSquadApi,
  finalize as finalizeApi, getEvents, getMessages, getSquads, getUsers, joinSquad as joinSquadApi, leaveSquad as leaveSquadApi,
  reopen as reopenApi, rsvp as rsvpApi, sendMessage as sendMessageApi, toggleSlot as toggleSlotApi,
  vote as voteApi, type NewEventInput,
} from "./api";
import {
  AuthError, getCurrentUser, loginWithPassword, logoutFromServer, signUp, updateCurrentAvailability, updateCurrentUser, type AuthUser,
} from "../auth";
import type { AvailabilityKey, DB, Squad, SquadEvent, Suggestion, User } from "./types";

export { type NewEventInput } from "./api";

export interface SignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  dob: string;
  phone?: string;
  city: string;
  travelKm: number;
  pronouns?: string;
  bio?: string;
  interests: string[];
  transport: string[];
  acceptTerms: true;
  termsVersion: string;
}

const EMPTY_DB: DB = { version: 1, users: [], squads: [], events: [], messages: [] };

function userFromAuth(authUser: AuthUser): User {
  return {
    id: authUser.id,
    username: authUser.username || authUser.email.split("@")[0],
    email: authUser.email,
    firstName: authUser.firstName || "SquadSync",
    lastName: authUser.lastName || "member",
    pronouns: authUser.pronouns || undefined,
    phone: authUser.phone || undefined,
    bio: authUser.bio || undefined,
    city: authUser.city || "",
    travelKm: authUser.travelKm || 25,
    interests: authUser.interests ?? [],
    transport: authUser.transport ?? [],
    color: authUser.color || "#59bfdf",
    availability: (authUser.availability ?? []) as AvailabilityKey[],
  };
}

function mergeUsers(database: DB, authUsers: AuthUser[]): DB {
  const byId = new Map(database.users.map((user) => [user.id, user]));
  for (const authUser of authUsers) byId.set(authUser.id, userFromAuth(authUser));
  return { ...database, users: [...byId.values()] };
}

async function loadDatabaseState(serverUser: AuthUser): Promise<DB> {
  const [squads, events] = await Promise.all([getSquads(), getEvents()]);
  const ids = new Set<string>([serverUser.id]);
  for (const squad of squads) squad.memberIds.forEach((id) => ids.add(id));
  for (const event of events) {
    ids.add(event.organizerId);
    event.attendeeIds.forEach((id) => ids.add(id));
    event.declinedIds.forEach((id) => ids.add(id));
    event.suggestions.forEach((suggestion) => {
      ids.add(suggestion.suggestedBy);
      suggestion.likes.forEach((id) => ids.add(id));
      suggestion.passes.forEach((id) => ids.add(id));
    });
    event.slots.forEach((slot) => slot.availableIds.forEach((id) => ids.add(id)));
  }
  const [profiles, messagesByEvent] = await Promise.all([
    getUsers([...ids]),
    Promise.all(events.map((event) => getMessages(event.id))),
  ]);
  return mergeUsers({ ...EMPTY_DB, squads, events, messages: messagesByEvent.flat() }, [serverUser, ...profiles]);
}

interface Store {
  ready: boolean;
  db: DB;
  me: User | null;
  user: (id: string) => User | undefined;
  login: (identifier: string, password: string) => Promise<boolean>;
  signup: (input: SignupInput) => Promise<{ ok: true } | { ok: false; field: "username" | "email"; error: string }>;
  logout: () => void;
  updateProfile: (patch: Partial<Omit<User, "id" | "username" | "availability">>) => Promise<void>;
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
  finalize: (eventId: string, plan: { suggestionId: string; slotId: string; venueId: string }) => Promise<void>;
  reopen: (eventId: string) => Promise<void>;
  sendMessage: (eventId: string, text: string) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(EMPTY_DB);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const serverUser = await getCurrentUser();
        if (!serverUser) {
          if (!cancelled) setReady(true);
          return;
        }
        const state = await loadDatabaseState(serverUser);
        if (cancelled) return;
        setSessionId(serverUser.id);
        setDb(state);
      } catch (error) {
        console.error("Unable to load database state", error);
        if (!cancelled) {
          const serverUser = await getCurrentUser().catch(() => null);
          if (serverUser) {
            setSessionId(serverUser.id);
            setDb(mergeUsers(EMPTY_DB, [serverUser]));
          }
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const me = useMemo(() => db.users.find((user) => user.id === sessionId) ?? null, [db.users, sessionId]);
  const myId = me?.id ?? "";

  const replaceEvent = (event: SquadEvent) => setDb((current) => ({ ...current, events: current.events.map((item) => item.id === event.id ? event : item) }));
  const replaceProfile = (authUser: AuthUser) => setDb((current) => mergeUsers(current, [authUser]));

  const store = useMemo<Store>(() => ({
    ready,
    db,
    me,
    user: (id) => db.users.find((item) => item.id === id),

    async login(identifier, password) {
      try {
        const authUser = await loginWithPassword(identifier, password);
        setSessionId(authUser.id);
        setDb(await loadDatabaseState(authUser));
        return true;
      } catch {
        return false;
      }
    },

    async signup(input) {
      try {
        const authUser = await signUp(input);
        setSessionId(authUser.id);
        replaceProfile(authUser);
        setDb((current) => ({ ...current, squads: [], events: [], messages: [] }));
        return { ok: true };
      } catch (error) {
        if (error instanceof AuthError && error.status === 409 && (error.field === "username" || error.field === "email")) {
          return { ok: false, field: error.field, error: error.message };
        }
        throw error;
      }
    },

    logout() {
      setSessionId(null);
      setDb(EMPTY_DB);
      void logoutFromServer().catch(() => undefined);
    },

    async updateProfile(patch) {
      await updateCurrentUser(patch);
      const refreshed = await getCurrentUser();
      if (refreshed) replaceProfile(refreshed);
    },

    async setAvailability(keys) {
      await updateCurrentAvailability(keys);
      const refreshed = await getCurrentUser();
      if (refreshed) replaceProfile(refreshed);
    },

    async createSquad(name, emoji) {
      const squad = await createSquadApi(name, emoji);
      setDb((current) => ({ ...current, squads: [squad, ...current.squads] }));
      return squad;
    },

    async joinSquad(code) {
      try {
        const squad = await joinSquadApi(code);
        setDb((current) => ({ ...current, squads: [squad, ...current.squads.filter((item) => item.id !== squad.id)] }));
        return squad;
      } catch {
        return null;
      }
    },

    async leaveSquad(squadId) {
      await leaveSquadApi(squadId);
      setDb((current) => ({ ...current, squads: current.squads.filter((squad) => squad.id !== squadId) }));
    },

    async createEvent(input) {
      const event = await createEventApi(input);
      setDb((current) => ({ ...current, events: [event, ...current.events] }));
      return event;
    },

    async rsvp(eventId, going) { replaceEvent(await rsvpApi(eventId, going)); },
    async vote(eventId, suggestionId, like) { replaceEvent(await voteApi(eventId, suggestionId, like)); },
    async addSuggestion(eventId, idea) { replaceEvent(await addSuggestionApi(eventId, idea)); },
    async toggleSlot(eventId, slotId, free) {
      const event = db.events.find((item) => item.id === eventId);
      const slot = event?.slots.find((item) => item.id === slotId);
      if (!slot) return;
      const available = free ?? !slot.availableIds.includes(myId);
      replaceEvent(await toggleSlotApi(eventId, slotId, available));
    },
    async addSlot(eventId, start, end) { replaceEvent(await addSlotApi(eventId, start, end)); },
    async finalize(eventId, plan) { replaceEvent(await finalizeApi(eventId, plan)); },
    async reopen(eventId) { replaceEvent(await reopenApi(eventId)); },
    async sendMessage(eventId, text) {
      const body = text.trim();
      if (!body) return;
      const message = await sendMessageApi(eventId, body);
      setDb((current) => ({ ...current, messages: [...current.messages, message] }));
    },
  }), [db, me, myId, ready]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useMe() {
  const { me } = useStore();
  if (!me) throw new Error("useMe called without a signed-in user");
  return me;
}
