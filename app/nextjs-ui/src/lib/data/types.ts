// Public application data returned by the PostgreSQL-backed API services.

/** Availability grid key: `${day}-${block}` where day 0 = Monday and block indexes BLOCKS. */
export type AvailabilityKey = `${number}-${number}`;

export interface User {
  id: string;
  username: string;
  email: string;
  dob?: string;
  firstName: string;
  lastName: string;
  pronouns?: string;
  phone?: string;
  bio?: string;
  city: string;
  travelKm: number;
  interests: string[];
  transport: string[];
  color: string; // avatar colour
  availability: AvailabilityKey[];
}

export interface Squad {
  id: string;
  name: string;
  emoji: string;
  code: string; // 6-letter join code
  memberIds: string[];
  createdBy: string;
}

export interface Area {
  name: string;
  lat: number;
  lng: number;
}

export interface TimeSlot {
  id: string;
  start: string; // ISO
  end: string; // ISO
  availableIds: string[];
}

export interface Suggestion {
  id: string;
  title: string;
  category: string; // one of INTERESTS
  note?: string;
  price: 1 | 2 | 3;
  suggestedBy: string;
  likes: string[];
  passes: string[];
}

export interface FinalPlan {
  suggestionId: string;
  slotId: string;
  venueId: string;
  venue: { id: string; name: string; address: string; lat?: number; lng?: number };
  finalizedAt: string;
}

export type EventStatus = "voting" | "final";

export interface SquadEvent {
  id: string;
  squadId: string;
  /** Public, non-sensitive squad label used when viewing a public event outside your own squads. */
  squad?: { id: string; name: string; emoji: string; createdBy?: string };
  title: string;
  description: string;
  organizerId: string;
  area: Area;
  visibility: "squad" | "public";
  status: EventStatus;
  voteDeadline: string; // ISO
  slots: TimeSlot[];
  suggestions: Suggestion[];
  attendeeIds: string[]; // people who signed up ("I'm in")
  declinedIds: string[];
  final?: FinalPlan;
  createdAt: string;
}

export interface Message {
  id: string;
  eventId: string;
  userId: string | "system";
  text: string;
  at: string; // ISO
}

/** A place explicitly confirmed by an event organizer, not a catalogue fixture. */
export interface Venue {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export interface DB {
  version: number;
  users: User[];
  squads: Squad[];
  events: SquadEvent[];
  messages: Message[];
}
