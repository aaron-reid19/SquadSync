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
  .regex(/[A-Za-z]/, "needs a letter")
  .regex(/\d/, "needs a number");

export const resetSchema = z
  .object({ token: z.string().min(20).max(200), password: newPasswordSchema })
  .strict();