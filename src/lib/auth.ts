/**
 * Auth API client.
 *  - The session is an HttpOnly cookie set by the server; JavaScript never sees it.
 *  - Every POST carries a CSRF token header.
 *  - Failure messages are generic so attackers can't learn which emails exist.
 */
export class AuthError extends Error {
  constructor(message: string, public status?: number, public retryAfterSeconds?: number, public field?: string) {
    super(message);
  }
}

const GENERIC_ERROR = "We couldn't log you in. Check your details and try again.";
const NETWORK_ERROR = "Can't reach SquadSync right now. Try again soon.";
const TIMEOUT_MS = 10_000;

async function getCsrfToken(signal: AbortSignal): Promise<string> {
  const res = await fetch("/api/auth/csrf", { credentials: "include", signal });
  if (!res.ok) throw new AuthError(NETWORK_ERROR, res.status);
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

async function post(path: string, body: unknown, failMessage = GENERIC_ERROR): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const csrf = await getCsrfToken(controller.signal);
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(body),
    });

    if (res.ok) return;
    if (res.status === 429) {
      const wait = Number(res.headers.get("Retry-After")) || 60;
      throw new AuthError(`Too many attempts. Try again in ${wait} seconds.`, 429, wait);
    }
    if (res.status === 409) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      throw new AuthError(data.error ?? failMessage, 409, undefined, data.field);
    }
    throw new AuthError(failMessage, res.status);
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof DOMException && err.name === "AbortError")
      throw new AuthError("The request timed out. Check your connection and try again.");
    throw new AuthError(NETWORK_ERROR);
  } finally {
    window.clearTimeout(timeout);
  }
}

export const loginWithPassword = (email: string, password: string) =>
  post("/api/auth/login", { email: email.trim().toLowerCase(), password });

/** `credential` is the Google ID token (JWT). The SERVER verifies it. */
export const loginWithGoogle = (credential: string) => post("/api/auth/google", { credential });

export const requestPasswordReset = (email: string) =>
  post("/api/auth/forgot-password", { email: email.trim().toLowerCase() }, "We couldn't send the link. Try again in a moment.");

export const resetPassword = (token: string, password: string) =>
  post("/api/auth/reset-password", { token, password }, "This reset link is invalid or has expired. Request a new one.");

export const signUp = (payload: Record<string, unknown>) =>
  post("/api/auth/signup", payload, "We couldn't create your account. Check your details and try again.");

export async function checkUsername(username: string, signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`/api/auth/username-available?u=${encodeURIComponent(username)}`, {
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new AuthError("Couldn't check that username.", res.status);
  return ((await res.json()) as { available: boolean }).available;
}