import { z } from "zod";

// Server-side validation: the browser checks are only for convenience.
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
  })
  .strict();

export const googleSchema = z
  .object({ credential: z.string().min(20).max(4096) })
  .strict();

  export const forgotSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();

// Rules for a NEW password (sign-up and reset). Login does not enforce these.
export const newPasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/\p{Lu}/u, "needs an uppercase letter")
  .regex(/\p{Ll}/u, "needs a lowercase letter")
  .regex(/\d/, "needs a number")
  .regex(/[^\p{L}\p{N}\s]/u, "needs a special character");

export const resetSchema = z
  .object({ token: z.string().min(20).max(200), password: newPasswordSchema })
  .strict();

export const INTERESTS = [
  "Bowling", "Movies", "Restaurants", "Karaoke", "Board games", "Hiking", "Coffee",
  "Concerts", "Sports", "Video games", "Escape rooms", "Mini golf", "Museums", "Parks",
] as const;
export const TRANSPORT = ["Car", "Transit", "Walk or bike"] as const;
export const PRONOUNS = ["she/her", "he/him", "they/them", "Prefer not to say"] as const;

const MAX_AGE = 100; // keep in sync with src/lib/validation.ts

function isAdultDob(dob: string) {
  const [y, m, d] = dob.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d)) age--;
  return age >= 18 && age <= MAX_AGE;
}

const NAME = z.string().trim().min(1).max(50).regex(/^\p{L}[\p{L}\p{M} '’.-]*$/u);

export const TERMS_VERSION = "2026-10-20"; // must match src/content/policies.tsx

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: newPasswordSchema,
    firstName: NAME,
    lastName: NAME,
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,20}$/),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isAdultDob),
    phone: z.string().trim()
    .refine((p) => /^\+?[0-9 ()-]+$/.test(p) && p.replace(/\D/g, "").length >= 10 && p.replace(/\D/g, "").length <= 15)
    .optional(),
    city: z.string().trim().min(2).max(80),
    travelKm: z.union([z.literal(5), z.literal(10), z.literal(25), z.literal(50)]),
    pronouns: z.enum(PRONOUNS).optional(),
    bio: z.string().trim().max(160).optional(),
    interests: z.array(z.enum(INTERESTS)).min(3).max(10)
      .refine((a) => new Set(a).size === a.length),
    transport: z.array(z.enum(TRANSPORT)).max(3),
    acceptTerms: z.literal(true),
    termsVersion: z.literal(TERMS_VERSION),
  })
  .strict();