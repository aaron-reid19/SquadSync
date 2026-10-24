# SquadSync MVP

Plan group hangouts without the group-chat chaos: create or join a Squad, create an event, swipe on activity ideas, mark your times, see the winning activity on a map with nearby venues, and lock in the final plan.

**Stack:** React 18 + TypeScript (Vite), react-router, Leaflet/OpenStreetMap for maps, Firebase (Firestore) wired in but off by default.

## Run it
```bash
npm install
npm run dev          # http://localhost:5173
```
Log in with **admin / password**. Everything else is mock data seeded in `src/lib/data/seed.ts` (Calgary venues, 4 Squads, 4 events, chat history). Changes save to your browser's localStorage; **Profile → Reset demo data** restores the seed.

## Pages
| Page | Route | What it does |
|---|---|---|
| Login / Signup | `/login`, `/signup` | Hard-coded admin login. Sign-up creates a demo account in this browser, then goes to availability. |
| Profile | `/profile` | Tabs: Personal info, Availability (tap/drag weekly grid). |
| Main | `/` | Events needing your vote, upcoming plans, your Squads. Create a Squad or join with a code (try `MEEPLE`, `SINGIT`). |
| Explore | `/explore` | Public hangouts to sign up for, and spots near you on a map, filtered by interest. |
| Event: Creation | `/events/new` | Squad, area, time options (or auto-suggest from Squad availability), starting ideas, visibility. |
| Event: Details + Signup | `/events/:id` | "I'm in / Can't make it", vote status or final plan, attendees. |
| Chat interface | `/events/:id/chat` | Tabs: Chat, Voting (1 swipe activities, 2 pick times, 3 results + venue map + lock it in). |

## Demo script
1. Log in as admin. Main shows **Friday night out** needs your vote.
2. Swipe now: drag cards (or arrow keys / buttons). Suggest an extra idea if you like.
3. Times: **Use my availability** pre-fills from your profile grid.
4. Results: ranked activities, venues near the meeting area on the map, best time. **Lock it in** (admin is the organizer).
5. Final plan: add to calendar (.ics) and directions. Chat posts a system message; mock friends reply.

## Code map
```
src/App.tsx            routes (logged-in pages sit under AppLayout, which redirects to /login)
src/pages/             one file per page
src/components/        SwipeDeck, VotingPanel, ChatPanel, AvailabilityGrid, VenueMap, FinalPlan, ...
src/hooks/             useLoginForm, useSignupForm (now backed by the mock store)
src/lib/data/types.ts  data model (one Firestore collection per top-level type)
src/lib/data/seed.ts   mock data + the admin credentials
src/lib/data/store.tsx React context store: all actions (vote, rsvp, finalize, sendMessage, ...)
src/lib/data/firebase*.ts  Firebase init + Firestore load/save adapter
src/lib/results.ts     ranking, winner, venues near an area
server/                original Express + SQLite auth server (not used by the MVP)
```

## Switching to Firebase
1. Create a Firebase project with Firestore, copy `.env.example` to `.env.local`, fill in the web config, and set `VITE_DATA_SOURCE=firebase`.
2. On first load with an empty project the app writes the seed data to `users`, `squads`, `events`, `messages`; after that it writes back only the documents that changed.
3. Deploy `firestore.rules` (open until Dec 31, 2026, for the MVP only).

Firebase is only downloaded in Firebase mode, so the mock build stays small. The Firestore adapter type-checks and builds but has not been run against a live project yet. For production: replace the hard-coded admin with Firebase Auth, use `onSnapshot` listeners for live chat/voting, query per Squad instead of loading everything, and lock down the rules to Squad members.

## What happened to the original auth
`server/`, `src/lib/auth.ts`, `ForgotPasswordPage.tsx` and `ResetPasswordPage.tsx` are untouched but not routed, since the MVP uses the hard-coded admin. Google sign-in was removed from the login page (the `@react-oauth/google` package is still installed). Bring them back when you move to real authentication.

## Known audit warnings
`npm audit` reports moderate/high advisories in Vite 5 (esbuild dev server) and react-router 6. They came with the original setup; fixing them means upgrading to Vite 6+ and react-router 7, which are breaking changes. Do that as its own task, not with `npm audit fix --force`.
