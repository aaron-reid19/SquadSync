"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ADMIN, AVATAR_COLORS, createSeed, DB_VERSION } from "./seed";
import type { Area, AvailabilityKey, DB, Message, Squad, SquadEvent, Suggestion, User } from "./types";
import { uid } from "../format";

const DB_KEY = "squadsync:db";
const SESSION_KEY = "squadsync:session";
const CREDS_KEY = "squadsync:credentials"; // demo-only accounts made on the sign-up page

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

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
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

export interface SignupInput extends Omit<User, "id" | "color" | "availability"> {
  password: string;
}

interface Store {
  ready: boolean;
  db: DB;
  me: User | null;
  user: (id: string) => User | undefined;
  // auth
  login: (username: string, password: string) => Promise<boolean>;
  signup: (input: SignupInput) => Promise<{ ok: true } | { ok: false; field: "username" | "email"; error: string }>;
  isUsernameTaken: (username: string) => boolean;
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

  // Load once on the client. The PostgreSQL-backed services will replace this
  // demo persistence layer as the API contracts are implemented.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readJson<DB>(DB_KEY);
      const loaded = stored?.version === DB_VERSION ? stored : null;
      if (cancelled) return;
      const initial = loaded ?? createSeed();
      setDb(initial);
      setSessionId(readJson<string>(SESSION_KEY));
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
    const startSession = (id: string) => {
      setSessionId(id);
      writeJson(SESSION_KEY, id);
    };

    return {
      ready,
      db,
      me,
      user,

      async login(username, password) {
        const name = username.trim().toLowerCase();
        if (name === ADMIN.username && password === ADMIN.password) {
          startSession(ADMIN.id);
          return true;
        }
        const creds = readJson<Record<string, string>>(CREDS_KEY) ?? {};
        const found = db.users.find((u) => u.username === name || u.email === name);
        if (found && creds[found.username] && creds[found.username] === (await sha256(password))) {
          startSession(found.id);
          return true;
        }
        return false;
      },

      isUsernameTaken: (username) => db.users.some((u) => u.username === username.trim().toLowerCase()),

      async signup({ password, ...profile }) {
        const username = profile.username.trim().toLowerCase();
        const email = profile.email.trim().toLowerCase();
        if (db.users.some((u) => u.username === username)) return { ok: false, field: "username", error: "That username is taken." };
        if (db.users.some((u) => u.email === email)) return { ok: false, field: "email", error: "An account with that email already exists." };
        const newUser: User = {
          ...profile, username, email, id: uid("u"),
          color: AVATAR_COLORS[db.users.length % AVATAR_COLORS.length], availability: [],
        };
        const creds = readJson<Record<string, string>>(CREDS_KEY) ?? {};
        creds[username] = await sha256(password);
        writeJson(CREDS_KEY, creds);
        setDb((d) => ({ ...d, users: [...d.users, newUser] }));
        startSession(newUser.id);
        return { ok: true };
      },

      logout() {
        setSessionId(null);
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
        setDb(fresh);
        try { localStorage.removeItem(CREDS_KEY); } catch { /* ignore */ }
        startSession(ADMIN.id);
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
