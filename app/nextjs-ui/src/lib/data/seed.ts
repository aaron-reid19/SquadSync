// Meeting-area choices are real geographic labels selected by the organizer.
/** Calgary neighbourhoods used as meeting areas. */
export const AREAS = [
  { name: "Downtown / Stephen Ave", lat: 51.0453, lng: -114.0631 },
  { name: "Kensington", lat: 51.0526, lng: -114.0881 },
  { name: "Inglewood", lat: 51.0379, lng: -114.0281 },
  { name: "17th Ave / Beltline", lat: 51.0377, lng: -114.0786 },
  { name: "Mission", lat: 51.0331, lng: -114.0697 },
  { name: "Bridgeland", lat: 51.0539, lng: -114.0396 },
] as const;

export const AVATAR_COLORS = ["#f8de52", "#59bfdf", "#8fd84d", "#eb3c37", "#c9a7ff", "#ffb470"];

// All fabricated users, squads, events, votes, messages and venue records below are disabled.
// They are retained only as commented legacy reference and are never imported by the app.
// LEGACY MOCK FIXTURE DISABLED: /** Mock venues. Business names are made up; parks are real. */
// LEGACY MOCK FIXTURE DISABLED: export const VENUES: Venue[] = [
// LEGACY MOCK FIXTURE DISABLED:   { id: "v1", name: "Strike Zone Lanes", category: "Bowling", address: "212 10 Ave SW", lat: 51.0442, lng: -114.0712, rating: 4.4, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v2", name: "Lucky Pins Bowl & Bar", category: "Bowling", address: "1120 Kensington Rd NW", lat: 51.0531, lng: -114.0905, rating: 4.1, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v3", name: "Retro Ten Pin", category: "Bowling", address: "905 9 Ave SE", lat: 51.0405, lng: -114.0335, rating: 4.6, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v4", name: "The Mic Drop Karaoke", category: "Karaoke", address: "318 17 Ave SW", lat: 51.0379, lng: -114.0681, rating: 4.5, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v5", name: "Encore Private Rooms", category: "Karaoke", address: "128 2 Ave SE", lat: 51.0505, lng: -114.0589, rating: 4.2, price: 3 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v6", name: "Golden Note Lounge", category: "Karaoke", address: "1310 Edmonton Tr NE", lat: 51.0549, lng: -114.0451, rating: 3.9, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v7", name: "Locked In Escape Co.", category: "Escape rooms", address: "540 11 Ave SW", lat: 51.0420, lng: -114.0742, rating: 4.8, price: 3 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v8", name: "The Vault Puzzle Rooms", category: "Escape rooms", address: "1022 9 Ave SE", lat: 51.0398, lng: -114.0303, rating: 4.6, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v9", name: "Noodle Lab", category: "Restaurants", address: "1213 1 St SW", lat: 51.0410, lng: -114.0660, rating: 4.7, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v10", name: "Bridgeland Bistro", category: "Restaurants", address: "917 1 Ave NE", lat: 51.0526, lng: -114.0410, rating: 4.4, price: 3 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v11", name: "Taco Social", category: "Restaurants", address: "726 17 Ave SW", lat: 51.0377, lng: -114.0760, rating: 4.3, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v12", name: "Spice Route Kitchen", category: "Restaurants", address: "2116 4 St SW", lat: 51.0331, lng: -114.0718, rating: 4.5, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v13", name: "Nose Hill Park", category: "Hiking", address: "Nose Hill Park, NW", lat: 51.1105, lng: -114.1105, rating: 4.8, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v14", name: "Fish Creek Provincial Park", category: "Hiking", address: "Bow Valley Ranch, SE", lat: 50.9150, lng: -114.0120, rating: 4.8, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v15", name: "Edworthy Park", category: "Hiking", address: "5050 Spruce Dr SW", lat: 51.0632, lng: -114.1589, rating: 4.6, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v16", name: "Prince's Island Park", category: "Parks", address: "698 Eau Claire Ave SW", lat: 51.0549, lng: -114.0700, rating: 4.8, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v17", name: "Riley Park", category: "Parks", address: "800 12 St NW", lat: 51.0566, lng: -114.0903, rating: 4.6, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v18", name: "Bean There Café", category: "Coffee", address: "1140 Kensington Cres NW", lat: 51.0528, lng: -114.0878, rating: 4.5, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v19", name: "Second Cup of Joy", category: "Coffee", address: "1238 9 Ave SE", lat: 51.0389, lng: -114.0270, rating: 4.3, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v20", name: "Dice & Brew", category: "Board games", address: "1203 Kensington Rd NW", lat: 51.0528, lng: -114.0920, rating: 4.7, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v21", name: "The Meeple Den", category: "Board games", address: "620 17 Ave SW", lat: 51.0381, lng: -114.0745, rating: 4.5, price: 1 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v22", name: "Pixel Arcade Bar", category: "Video games", address: "333 17 Ave SW", lat: 51.0376, lng: -114.0690, rating: 4.4, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v23", name: "Level Up Lounge", category: "Video games", address: "101 8 Ave SW", lat: 51.0459, lng: -114.0628, rating: 4.0, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v24", name: "Lantern Cinema", category: "Movies", address: "1235 Kensington Rd NW", lat: 51.0530, lng: -114.0930, rating: 4.6, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v25", name: "Downtown Screens", category: "Movies", address: "200 8 Ave SE", lat: 51.0461, lng: -114.0575, rating: 4.2, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v26", name: "Putt Putt Paradise", category: "Mini golf", address: "1450 9 Ave SE", lat: 51.0380, lng: -114.0230, rating: 4.3, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v27", name: "Glow Golf Indoor", category: "Mini golf", address: "250 6 Ave SW", lat: 51.0479, lng: -114.0665, rating: 4.1, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v28", name: "Riverside Music Hall", category: "Concerts", address: "1100 9 Ave SE", lat: 51.0395, lng: -114.0290, rating: 4.6, price: 3 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v29", name: "The Basement Stage", category: "Concerts", address: "410 17 Ave SW", lat: 51.0378, lng: -114.0712, rating: 4.4, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v30", name: "Bow River Sports Dome", category: "Sports", address: "800 Memorial Dr NE", lat: 51.0560, lng: -114.0480, rating: 4.2, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v31", name: "City Climb Gym", category: "Sports", address: "1010 Macleod Tr SE", lat: 51.0428, lng: -114.0560, rating: 4.7, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v32", name: "Gallery of the Prairies", category: "Museums", address: "130 9 Ave SE", lat: 51.0445, lng: -114.0590, rating: 4.5, price: 2 },
// LEGACY MOCK FIXTURE DISABLED:   { id: "v33", name: "Science & Space Centre", category: "Museums", address: "220 St Georges Dr NE", lat: 51.0460, lng: -114.0390, rating: 4.7, price: 3 },
// LEGACY MOCK FIXTURE DISABLED: ];
// LEGACY MOCK FIXTURE DISABLED: 
// LEGACY MOCK FIXTURE DISABLED: export const AVATAR_COLORS = ["#f8de52", "#59bfdf", "#8fd84d", "#eb3c37", "#c9a7ff", "#ffb470"];
// LEGACY MOCK FIXTURE DISABLED: 
// LEGACY MOCK FIXTURE DISABLED: // ---------- date helpers (seed is relative to "now" so the demo never looks stale) ----------
// LEGACY MOCK FIXTURE DISABLED: function nextWeekday(weekday: number, hour: number, weeksAhead = 0) {
// LEGACY MOCK FIXTURE DISABLED:   // weekday: 0 = Sunday ... 6 = Saturday (JS convention)
// LEGACY MOCK FIXTURE DISABLED:   const d = new Date();
// LEGACY MOCK FIXTURE DISABLED:   d.setHours(hour, 0, 0, 0);
// LEGACY MOCK FIXTURE DISABLED:   let diff = (weekday - d.getDay() + 7) % 7;
// LEGACY MOCK FIXTURE DISABLED:   if (diff === 0) diff = 7;
// LEGACY MOCK FIXTURE DISABLED:   d.setDate(d.getDate() + diff + weeksAhead * 7);
// LEGACY MOCK FIXTURE DISABLED:   return d;
// LEGACY MOCK FIXTURE DISABLED: }
// LEGACY MOCK FIXTURE DISABLED: const plusHours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000).toISOString();
// LEGACY MOCK FIXTURE DISABLED: const iso = (d: Date) => d.toISOString();
// LEGACY MOCK FIXTURE DISABLED: const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
// LEGACY MOCK FIXTURE DISABLED: const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
// LEGACY MOCK FIXTURE DISABLED: 
// LEGACY MOCK FIXTURE DISABLED: /** Availability shorthand: "0-2" = Monday evening. Day 0 = Monday, block per BLOCKS in lib/availability. */
// LEGACY MOCK FIXTURE DISABLED: const avail = (...keys: string[]) => keys as AvailabilityKey[];
// LEGACY MOCK FIXTURE DISABLED: 
// LEGACY MOCK FIXTURE DISABLED: export function createSeed(): DB {
// LEGACY MOCK FIXTURE DISABLED:   const fri = nextWeekday(5, 19);
// LEGACY MOCK FIXTURE DISABLED:   const sat = nextWeekday(6, 14);
// LEGACY MOCK FIXTURE DISABLED:   const satNight = nextWeekday(6, 19);
// LEGACY MOCK FIXTURE DISABLED:   const sun = nextWeekday(0, 9);
// LEGACY MOCK FIXTURE DISABLED:   const thu = nextWeekday(4, 18, 1);
// LEGACY MOCK FIXTURE DISABLED:   const sat2 = nextWeekday(6, 13, 1);
// LEGACY MOCK FIXTURE DISABLED: 
// LEGACY MOCK FIXTURE DISABLED:   const messages: Message[] = [
// LEGACY MOCK FIXTURE DISABLED:     { id: "m1", eventId: "e1", userId: "system", text: "Alex created the event and opened voting.", at: minutesAgo(600) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m2", eventId: "e1", userId: "u-maya", text: "Okay team, Friday plans. Swipe on the ideas so we stop going in circles 😅", at: minutesAgo(590) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m3", eventId: "e1", userId: "u-jordan", text: "Karaoke or riot.", at: minutesAgo(560) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m4", eventId: "e1", userId: "u-priya", text: "I can't do Saturday afternoon, I marked my times.", at: minutesAgo(300) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m5", eventId: "e1", userId: "u-sam", text: "Escape room has my vote, we never finished the last one", at: minutesAgo(45) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m6", eventId: "e2", userId: "system", text: "Leo finalized the plan: Hiking at Nose Hill Park.", at: minutesAgo(1440) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m7", eventId: "e2", userId: "u-leo", text: "Bring water and layers, it gets windy up top.", at: minutesAgo(1400) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m8", eventId: "e2", userId: "u-nina", text: "I'll bring snacks 🍫", at: minutesAgo(1380) },
// LEGACY MOCK FIXTURE DISABLED:     { id: "m9", eventId: "e3", userId: "u-tariq", text: "New folks welcome! We'll teach any game.", at: minutesAgo(200) },
// LEGACY MOCK FIXTURE DISABLED:   ];
// LEGACY MOCK FIXTURE DISABLED: 
// LEGACY MOCK FIXTURE DISABLED:   return {
// LEGACY MOCK FIXTURE DISABLED:     version: DB_VERSION,
// LEGACY MOCK FIXTURE DISABLED:     users: [
// LEGACY MOCK FIXTURE DISABLED:       {
// LEGACY MOCK FIXTURE DISABLED:         id: ADMIN.id, username: "admin", email: "admin@squadsync.app", firstName: "Alex", lastName: "Admin",
// LEGACY MOCK FIXTURE DISABLED:         pronouns: "they/them", bio: "Always down for food and a bad karaoke duet.", city: "Calgary", travelKm: 25,
// LEGACY MOCK FIXTURE DISABLED:         interests: ["Karaoke", "Restaurants", "Escape rooms", "Hiking", "Board games"], transport: ["Car", "Transit"],
// LEGACY MOCK FIXTURE DISABLED:         color: "#f8de52", availability: avail("4-2", "4-3", "5-1", "5-2", "5-3", "6-0", "6-1", "2-2"),
// LEGACY MOCK FIXTURE DISABLED:       },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-maya", username: "maya", email: "maya@example.com", firstName: "Maya", lastName: "Chen", city: "Calgary", travelKm: 10, interests: ["Karaoke", "Coffee", "Movies"], transport: ["Transit"], color: "#59bfdf", availability: avail("4-2", "4-3", "5-2", "5-3") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-jordan", username: "jordan", email: "jordan@example.com", firstName: "Jordan", lastName: "Reyes", city: "Calgary", travelKm: 25, interests: ["Karaoke", "Sports", "Video games"], transport: ["Car"], color: "#8fd84d", availability: avail("4-2", "5-1", "5-2") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-priya", username: "priya", email: "priya@example.com", firstName: "Priya", lastName: "Shah", city: "Calgary", travelKm: 10, interests: ["Restaurants", "Escape rooms", "Museums"], transport: ["Walk or bike"], color: "#c9a7ff", availability: avail("4-2", "5-2", "6-1") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-sam", username: "sam", email: "sam@example.com", firstName: "Sam", lastName: "O'Neil", city: "Calgary", travelKm: 50, interests: ["Escape rooms", "Bowling", "Board games"], transport: ["Car"], color: "#ffb470", availability: avail("4-2", "5-1", "5-2") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-leo", username: "leo", email: "leo@example.com", firstName: "Leo", lastName: "Martin", city: "Calgary", travelKm: 50, interests: ["Hiking", "Sports"], transport: ["Car"], color: "#eb3c37", availability: avail("6-0", "5-0") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-nina", username: "nina", email: "nina@example.com", firstName: "Nina", lastName: "Kowalski", city: "Calgary", travelKm: 25, interests: ["Hiking", "Board games", "Coffee"], transport: ["Transit"], color: "#59bfdf", availability: avail("6-0", "3-2") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-tariq", username: "tariq", email: "tariq@example.com", firstName: "Tariq", lastName: "Haddad", city: "Calgary", travelKm: 10, interests: ["Board games", "Video games"], transport: ["Transit"], color: "#8fd84d", availability: avail("3-2", "5-1") },
// LEGACY MOCK FIXTURE DISABLED:       { id: "u-zoe", username: "zoe", email: "zoe@example.com", firstName: "Zoe", lastName: "Park", city: "Calgary", travelKm: 25, interests: ["Karaoke", "Concerts"], transport: ["Transit"], color: "#c9a7ff", availability: avail("4-2", "4-3") },
// LEGACY MOCK FIXTURE DISABLED:     ],
// LEGACY MOCK FIXTURE DISABLED:     squads: [
// LEGACY MOCK FIXTURE DISABLED:       { id: "s1", name: "Friday Crew", emoji: "🎳", code: "FRYDAY", memberIds: [ADMIN.id, "u-maya", "u-jordan", "u-priya", "u-sam"], createdBy: "u-maya" },
// LEGACY MOCK FIXTURE DISABLED:       { id: "s2", name: "Trail Mix", emoji: "🥾", code: "TRAILS", memberIds: [ADMIN.id, "u-leo", "u-nina"], createdBy: "u-leo" },
// LEGACY MOCK FIXTURE DISABLED:       { id: "s3", name: "Meeple Meetup", emoji: "🎲", code: "MEEPLE", memberIds: ["u-tariq", "u-nina", "u-sam"], createdBy: "u-tariq" },
// LEGACY MOCK FIXTURE DISABLED:       { id: "s4", name: "Mic Night", emoji: "🎤", code: "SINGIT", memberIds: ["u-zoe", "u-jordan"], createdBy: "u-zoe" },
// LEGACY MOCK FIXTURE DISABLED:     ],
// LEGACY MOCK FIXTURE DISABLED:     events: [
// LEGACY MOCK FIXTURE DISABLED:       {
// LEGACY MOCK FIXTURE DISABLED:         id: "e1", squadId: "s1", title: "Friday night out", organizerId: ADMIN.id, status: "voting", visibility: "squad",
// LEGACY MOCK FIXTURE DISABLED:         description: "End-of-month hangout. Swipe on what sounds fun, mark when you're free, and we'll lock it in.",
// LEGACY MOCK FIXTURE DISABLED:         area: AREAS[3], voteDeadline: daysFromNow(2), createdAt: minutesAgo(600),
// LEGACY MOCK FIXTURE DISABLED:         attendeeIds: [ADMIN.id, "u-maya", "u-jordan", "u-sam"], declinedIds: [],
// LEGACY MOCK FIXTURE DISABLED:         slots: [
// LEGACY MOCK FIXTURE DISABLED:           { id: "t1", start: iso(fri), end: plusHours(fri, 3), availableIds: ["u-maya", "u-jordan", "u-priya", "u-sam"] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "t2", start: iso(sat), end: plusHours(sat, 3), availableIds: ["u-jordan", "u-sam"] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "t3", start: iso(satNight), end: plusHours(satNight, 3), availableIds: ["u-maya", "u-priya"] },
// LEGACY MOCK FIXTURE DISABLED:         ],
// LEGACY MOCK FIXTURE DISABLED:         suggestions: [
// LEGACY MOCK FIXTURE DISABLED:           { id: "a1", title: "Karaoke night", category: "Karaoke", price: 2, note: "Private room, 2 hours", suggestedBy: "u-jordan", likes: ["u-jordan", "u-maya"], passes: ["u-priya"] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "a2", title: "Escape room", category: "Escape rooms", price: 3, note: "The new heist room", suggestedBy: "u-sam", likes: ["u-sam", "u-priya", "u-maya"], passes: [] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "a3", title: "Bowling + wings", category: "Bowling", price: 2, suggestedBy: "u-maya", likes: ["u-jordan"], passes: ["u-maya"] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "a4", title: "Ramen crawl", category: "Restaurants", price: 2, note: "Start downtown, end on 17th", suggestedBy: "u-priya", likes: ["u-priya"], passes: ["u-sam"] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "a5", title: "Arcade bar", category: "Video games", price: 2, suggestedBy: "u-jordan", likes: ["u-jordan"], passes: ["u-priya"] },
// LEGACY MOCK FIXTURE DISABLED:         ],
// LEGACY MOCK FIXTURE DISABLED:       },
// LEGACY MOCK FIXTURE DISABLED:       {
// LEGACY MOCK FIXTURE DISABLED:         id: "e2", squadId: "s2", title: "Sunday morning hike", organizerId: "u-leo", status: "final", visibility: "squad",
// LEGACY MOCK FIXTURE DISABLED:         description: "Easy loop, then brunch if anyone's still standing.",
// LEGACY MOCK FIXTURE DISABLED:         area: { name: "Nose Hill", lat: 51.1105, lng: -114.1105 }, voteDeadline: minutesAgo(1440), createdAt: minutesAgo(4000),
// LEGACY MOCK FIXTURE DISABLED:         attendeeIds: [ADMIN.id, "u-leo", "u-nina"], declinedIds: [],
// LEGACY MOCK FIXTURE DISABLED:         slots: [{ id: "t4", start: iso(sun), end: plusHours(sun, 3), availableIds: [ADMIN.id, "u-leo", "u-nina"] }],
// LEGACY MOCK FIXTURE DISABLED:         suggestions: [
// LEGACY MOCK FIXTURE DISABLED:           { id: "a6", title: "Nose Hill loop", category: "Hiking", price: 1, suggestedBy: "u-leo", likes: [ADMIN.id, "u-leo", "u-nina"], passes: [] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "a7", title: "Climbing gym", category: "Sports", price: 2, suggestedBy: "u-nina", likes: ["u-nina"], passes: ["u-leo"] },
// LEGACY MOCK FIXTURE DISABLED:         ],
// LEGACY MOCK FIXTURE DISABLED:         final: { suggestionId: "a6", slotId: "t4", venueId: "v13", finalizedAt: minutesAgo(1440) },
// LEGACY MOCK FIXTURE DISABLED:       },
// LEGACY MOCK FIXTURE DISABLED:       {
// LEGACY MOCK FIXTURE DISABLED:         id: "e3", squadId: "s3", title: "Board game marathon", organizerId: "u-tariq", status: "voting", visibility: "public",
// LEGACY MOCK FIXTURE DISABLED:         description: "Open table! Bring a friend or come solo. Strategy, party games, whatever wins the vote.",
// LEGACY MOCK FIXTURE DISABLED:         area: AREAS[1], voteDeadline: daysFromNow(4), createdAt: minutesAgo(300),
// LEGACY MOCK FIXTURE DISABLED:         attendeeIds: ["u-tariq", "u-nina", "u-sam"], declinedIds: [],
// LEGACY MOCK FIXTURE DISABLED:         slots: [
// LEGACY MOCK FIXTURE DISABLED:           { id: "t5", start: iso(thu), end: plusHours(thu, 4), availableIds: ["u-tariq", "u-nina"] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "t6", start: iso(sat2), end: plusHours(sat2, 4), availableIds: ["u-tariq", "u-sam"] },
// LEGACY MOCK FIXTURE DISABLED:         ],
// LEGACY MOCK FIXTURE DISABLED:         suggestions: [
// LEGACY MOCK FIXTURE DISABLED:           { id: "a8", title: "Board game café", category: "Board games", price: 1, suggestedBy: "u-tariq", likes: ["u-tariq", "u-nina", "u-sam"], passes: [] },
// LEGACY MOCK FIXTURE DISABLED:           { id: "a9", title: "Retro console night", category: "Video games", price: 2, suggestedBy: "u-sam", likes: ["u-sam"], passes: ["u-nina"] },
// LEGACY MOCK FIXTURE DISABLED:         ],
// LEGACY MOCK FIXTURE DISABLED:       },
// LEGACY MOCK FIXTURE DISABLED:       {
// LEGACY MOCK FIXTURE DISABLED:         id: "e4", squadId: "s4", title: "Open mic karaoke", organizerId: "u-zoe", status: "final", visibility: "public",
// LEGACY MOCK FIXTURE DISABLED:         description: "Belt it out. Duets encouraged, talent optional.",
// LEGACY MOCK FIXTURE DISABLED:         area: AREAS[3], voteDeadline: minutesAgo(100), createdAt: minutesAgo(3000),
// LEGACY MOCK FIXTURE DISABLED:         attendeeIds: ["u-zoe", "u-jordan"], declinedIds: [],
// LEGACY MOCK FIXTURE DISABLED:         slots: [{ id: "t7", start: iso(satNight), end: plusHours(satNight, 3), availableIds: ["u-zoe", "u-jordan"] }],
// LEGACY MOCK FIXTURE DISABLED:         suggestions: [{ id: "a10", title: "Karaoke lounge", category: "Karaoke", price: 2, suggestedBy: "u-zoe", likes: ["u-zoe", "u-jordan"], passes: [] }],
// LEGACY MOCK FIXTURE DISABLED:         final: { suggestionId: "a10", slotId: "t7", venueId: "v4", finalizedAt: minutesAgo(100) },
// LEGACY MOCK FIXTURE DISABLED:       },
// LEGACY MOCK FIXTURE DISABLED:     ],
// LEGACY MOCK FIXTURE DISABLED:     messages,
// LEGACY MOCK FIXTURE DISABLED:   };
// LEGACY MOCK FIXTURE DISABLED: }
