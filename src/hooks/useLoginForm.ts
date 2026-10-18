import { FormEvent, useEffect, useRef, useState } from "react";
import { validateLogin, type LoginErrors } from "../lib/validation";
import { AuthError, loginWithGoogle, loginWithPassword } from "../lib/auth";

const MAX_FAILED_ATTEMPTS = 5; // UX-only throttle; the server enforces the real limits
const COOLDOWN_SECONDS = 30;

/** All login behaviour lives here so the page component stays purely visual. */
export function useLoginForm(onSuccess: () => void) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failures, setFailures] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function registerFailure(retryAfter?: number) {
    if (retryAfter) {
      setCooldown(retryAfter);
      return;
    }
    const next = failures + 1;
    if (next >= MAX_FAILED_ATTEMPTS) {
      setCooldown(COOLDOWN_SECONDS);
      setFailures(0);
    } else {
      setFailures(next);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting || cooldown > 0) return;

    const found = validateLogin({ email, password });
    setErrors(found);
    setFormError("");
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setSubmitting(true);
    try {
      await loginWithPassword(email, password);
      setPassword(""); // don't keep the secret in memory longer than needed
      onSuccess();
    } catch (err) {
      const authErr = err instanceof AuthError ? err : new AuthError("Something went wrong.");
      setFormError(authErr.message);
      setPassword("");
      passwordRef.current?.focus();
      registerFailure(authErr.retryAfterSeconds);
    } finally {
      setSubmitting(false);
    }
  }

  async function googleSuccess(credential?: string) {
    if (!credential) return setFormError("Google didn't return a sign-in. Try again.");
    setFormError("");
    try {
      await loginWithGoogle(credential);
      onSuccess();
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : "Google sign-in failed. Try again.");
    }
  }

  const googleError = () => setFormError("Google sign-in was cancelled or failed. Try again.");

  return {
    email, setEmail, password, setPassword,
    errors, formError, submitting, cooldown,
    locked: cooldown > 0,
    emailRef, passwordRef,
    submit, googleSuccess, googleError,
  };
}
