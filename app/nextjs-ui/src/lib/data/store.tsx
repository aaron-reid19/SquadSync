"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthError, getCurrentUser, loginWithPassword, logoutFromServer, signUp, type AuthUser } from "../auth";
import { AVATAR_COLORS, createSeed, DB_VERSION } from "./seed";
import type { Area, AvailabilityKey, DB, Message, Squad, SquadEvent, Suggestion, User } from "./types";
import { uid } from "../format";

const DB_KEY = "squadsync:db";
const SESSION_KEY = "squadsync:session";
const LEGACY_CREDS_KEY = "squadsync:credentials";

// ---------- browser storage helpers (never throw: private windows can block storage) ----------
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the demo still works for this tab */
  }
}

const CANNED_REPLIES = [
  "I'm in 🙌", "Works for me!", "Who's driving?", "Can we do a bit later?", "Love that idea",
  "Voted ✅", "Ooh yes", "As long as there's food 😂", "I'll check my schedule and get back to you",
];

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

function localUserFromAuth(authUser: AuthUser, color: string, existing?: User): User {
  return {
    id: authUser.id,
    username: authUser.username || existing?.username || authUser.email.split("@")[0],
    email: authUser.email,
    firstName: authUser.firstName || existing?.firstName || "SquadSync",
    lastName: authUser.lastName || existing?.lastName || "member",
    pronouns: authUser.pronouns || existing?.pronouns,
    phone: authUser.phone || existing?.phone,
    bio: authUser.bio || existing?.bio,
    city: authUser.city || existing?.city || "Calgary",
    travelKm: authUser.travelKm || existing?.travelKm || 25,
    interests: authUser.interests ?? existing?.interests ?? [],
    transport: authUser.transport ?? existing?.transport ?? [],
    color: existing?.color ?? color,
    availability: existing?.availability ?? [],
  };
}

function mergeAuthUser(database: DB, authUser: AuthUser): DB {
  const existingIndex = database.users.findIndex((user) => user.id === authUser.id || user.email === authUser.email);
  const existing = existingIndex >= 0 ? database.users[existingIndex] : undefined;
  const localUser = localUserFromAuth(authUser, AVATAR_COLORS[database.users.length % AVATAR_COLORS.length], existing);
  if (existingIndex < 0) return { ...database, users: [...database.users, localUser] };
  return {
    ...database,
    users: database.users.map((user, index) => (index === existingIndex ? localUser : user)),
  };
}

interface Store {
  ready: boolean;
  db: DB;
  me: User | null;
  user: (id: string) => User | undefined;
  // auth
  login: (username: string, password: string) => Promise<boolean>;
  signup: (input: SignupInput) => Promise<{ ok: true } | { ok: false; field: "username" | "email"; error: string }>;
  logout: () => void;
  // profile
  updateProfile: (patch: Partial<Omit<User, "id" | "username">>) => void;
  setAvailability: (keys: AvailabilityKey[]) => void;
  // squads
  createSquad: (name: string, emoji: string) => Squad;
  joinSquad: (code: string) => Squad | null;
  leaveSquad: (squadId: string) => void;
  // events
  createEvent: (input: NewEventInput) => SquadEvent;
  rsvp: (eventId: string, going: boolean) => void;
  vote: (eventId: string, suggestionId: string, like: boolean | null) => void;
  addSuggestion: (eventId: string, idea: Omit<Suggestion, "id" | "suggestedBy" | "likes" | "passes">) => void;
  toggleSlot: (eventId: string, slotId: string, free?: boolean) => void;
  addSlot: (eventId: string, start: string, end: string) => void;
  finalize: (eventId: string, plan: { suggestionId: string; slotId: string; venueId: string }) => void;
  reopen: (eventId: string) => void;
  // chat
  sendMessage: (eventId: string, text: string) => void;
  // demo
  resetDemo: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => createSeed());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Load the demo domain projection and hydrate the authenticated user from
  // the server session cookie. Domain persistence is still local until those
  // APIs are implemented, but credentials never live in browser storage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readJson<DB>(DB_KEY);
      const loaded = stored?.version === DB_VERSION ? stored : null;
      try { localStorage.removeItem(LEGACY_CREDS_KEY); } catch { /* ignore */ }
      let initial = loaded ?? createSeed();
      let serverUser: AuthUser | null = null;
      try {
        serverUser = await getCurrentUser();
      } catch {
        // Keep the shell usable while the API is starting, but do not trust a
        // browser-only session as authentication.
      }
      if (cancelled) return;
      if (serverUser) {
        initial = mergeAuthUser(initial, serverUser);
        setSessionId(serverUser.id);
        writeJson(SESSION_KEY, serverUser.id);
      } else {
        setSessionId(null);
        try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      }
      setDb(initial);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist after every change.
  useEffect(() => {
    if (!ready) return;
    writeJson(DB_KEY, db);
  }, [db, ready]);

  const me = useMemo(() => db.users.find((u) => u.id === sessionId) ?? null, [db.users, sessionId]);
  const myId = me?.id ?? "";

  const updateEvent = useCallback((eventId: string, fn: (e: SquadEvent) => SquadEvent) => {
    setDb((d) => ({ ...d, events: d.events.map((e) => (e.id === eventId ? fn(e) : e)) }));
  }, []);

  const pushMessage = useCallback((m: Omit<Message, "id" | "at">) => {
    setDb((d) => ({ ...d, messages: [...d.messages, { ...m, id: uid("m"), at: new Date().toISOString() }] }));
  }, []);

  const store = useMemo<Store>(() => {
    const user = (id: string) => db.users.find((u) => u.id === id);
    const startServerSession = (authUser: AuthUser) => {
      setDb((current) => mergeAuthUser(current, authUser));
      setSessionId(authUser.id);
      writeJson(SESSION_KEY, authUser.id);
    };

    return {
      ready,
      db,
      me,
      user,

      async login(username, password) {
        try {
          const authUser = await loginWithPassword(username, password);
          startServerSession(authUser);
          return true;
        } catch {
          return false;
        }
      },

      async signup(input) {
        try {
          const authUser = await signUp(input);
          startServerSession(authUser);
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
        void logoutFromServer().catch(() => undefined);
        try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      },

      updateProfile(patch) {
        setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === myId ? { ...u, ...patch } : u)) }));
      },

      setAvailability(keys) {
        setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === myId ? { ...u, availability: keys } : u)) }));
      },

      createSquad(name, emoji) {
        const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");
        const squad: Squad = { id: uid("s"), name: name.trim(), emoji, code, memberIds: [myId], createdBy: myId };
        setDb((d) => ({ ...d, squads: [...d.squads, squad] }));
        return squad;
      },

      joinSquad(code) {
        const squad = db.squads.find((s) => s.code === code.trim().toUpperCase());
        if (!squad) return null;
        if (!squad.memberIds.includes(myId)) {
          setDb((d) => ({
            ...d,
            squads: d.squads.map((s) => (s.id === squad.id ? { ...s, memberIds: [...s.memberIds, myId] } : s)),
          }));
        }
        return squad;
      },

      leaveSquad(squadId) {
        setDb((d) => ({
          ...d,
          squads: d.squads.map((s) => (s.id === squadId ? { ...s, memberIds: s.memberIds.filter((id) => id !== myId) } : s)),
        }));
      },

      createEvent(input) {
        const event: SquadEvent = {
          id: uid("e"),
          squadId: input.squadId,
          title: input.title.trim(),
          description: input.description.trim(),
          organizerId: myId,
          area: input.area,
          visibility: input.visibility,
          status: "voting",
          voteDeadline: input.voteDeadline,
          createdAt: new Date().toISOString(),
          attendeeIds: [myId],
          declinedIds: [],
          slots: input.slots.map((s) => ({ id: uid("t"), ...s, availableIds: [] })),
          suggestions: input.ideas.map((i) => ({ id: uid("a"), ...i, suggestedBy: myId, likes: [], passes: [] })),
        };
        setDb((d) => ({
          ...d,
          events: [event, ...d.events],
          messages: [
            ...d.messages,
            { id: uid("m"), eventId: event.id, userId: "system", text: `${me?.firstName ?? "Someone"} created the event and opened voting.`, at: event.createdAt },
          ],
        }));
        return event;
      },

      rsvp(eventId, going) {
        updateEvent(eventId, (e) => ({
          ...e,
          attendeeIds: going ? [...new Set([...e.attendeeIds, myId])] : e.attendeeIds.filter((id) => id !== myId),
          declinedIds: going ? e.declinedIds.filter((id) => id !== myId) : [...new Set([...e.declinedIds, myId])],
        }));
      },

      vote(eventId, suggestionId, like) {
        updateEvent(eventId, (e) => ({
          ...e,
          suggestions: e.suggestions.map((s) => {
            if (s.id !== suggestionId) return s;
            const likes = s.likes.filter((id) => id !== myId);
            const passes = s.passes.filter((id) => id !== myId);
            if (like === true) likes.push(myId);
            if (like === false) passes.push(myId);
            return { ...s, likes, passes };
          }),
        }));
      },

      addSuggestion(eventId, idea) {
        updateEvent(eventId, (e) => ({
          ...e,
          suggestions: [...e.suggestions, { ...idea, id: uid("a"), suggestedBy: myId, likes: [myId], passes: [] }],
        }));
        pushMessage({ eventId, userId: "system", text: `${me?.firstName} suggested “${idea.title}”.` });
      },

      toggleSlot(eventId, slotId, free) {
        updateEvent(eventId, (e) => ({
          ...e,
          slots: e.slots.map((t) => {
            if (t.id !== slotId) return t;
            const isFree = t.availableIds.includes(myId);
            const want = free ?? !isFree;
            if (want === isFree) return t;
            return { ...t, availableIds: want ? [...t.availableIds, myId] : t.availableIds.filter((id) => id !== myId) };
          }),
        }));
      },

      addSlot(eventId, start, end) {
        updateEvent(eventId, (e) => ({
          ...e,
          slots: [...e.slots, { id: uid("t"), start, end, availableIds: [myId] }].sort((a, b) => a.start.localeCompare(b.start)),
        }));
      },

      finalize(eventId, plan) {
        const event = db.events.find((e) => e.id === eventId);
        const activity = event?.suggestions.find((s) => s.id === plan.suggestionId);
        updateEvent(eventId, (e) => ({ ...e, status: "final", final: { ...plan, finalizedAt: new Date().toISOString() } }));
        pushMessage({ eventId, userId: "system", text: `${me?.firstName} locked in the plan: ${activity?.title ?? "it's happening"}! 🎉` });
      },

      reopen(eventId) {
        updateEvent(eventId, (e) => ({ ...e, status: "voting", final: undefined }));
        pushMessage({ eventId, userId: "system", text: `${me?.firstName} reopened voting.` });
      },

      sendMessage(eventId, text) {
        const body = text.trim();
        if (!body) return;
        pushMessage({ eventId, userId: myId, text: body });

        // Mock squadmates reply now and then so the chat feels alive in the demo.
        const event = db.events.find((e) => e.id === eventId);
        const squad = db.squads.find((s) => s.id === event?.squadId);
        const others = squad?.memberIds.filter((id) => id !== myId) ?? [];
        if (others.length && Math.random() < 0.7) {
          const who = others[Math.floor(Math.random() * others.length)];
          const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
          window.setTimeout(() => pushMessage({ eventId, userId: who, text: reply }), 1200 + Math.random() * 1500);
        }
      },

      resetDemo() {
        const fresh = createSeed();
        setDb(me ? { ...fresh, users: [...fresh.users, me] } : fresh);
      },
    };
  }, [db, me, myId, ready, updateEvent, pushMessage]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** For pages behind login: `me` is guaranteed by the (app) layout guard. */
export function useMe() {
  const { me } = useStore();
  if (!me) throw new Error("useMe called without a signed-in user");
  return me;
}
