import { FormEvent, useEffect, useRef, useState } from "react";
import { useStore } from "../lib/data/store";

const MAX_FAILED_ATTEMPTS = 5; // UX-only throttle
const COOLDOWN_SECONDS = 30;
const GENERIC_ERROR = "We couldn't log you in. Check your details and try again.";

interface LoginErrors {
  username?: string;
  password?: string;
}

/**
 * All login behaviour lives here so the page component stays purely visual.
 * MVP: checks the hard-coded admin (and demo sign-ups) in the mock store instead of the server.
 */
export function useLoginForm(onSuccess: () => void) {
  const { login } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failures, setFailures] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function registerFailure() {
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

    const found: LoginErrors = {
      username: username.trim() ? undefined : "Enter your username or email.",
      password: password ? undefined : "Enter your password.",
    };
    setErrors(found);
    setFormError("");
    if (found.username) return usernameRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setSubmitting(true);
    const ok = await login(username, password);
    setSubmitting(false);
    setPassword(""); // don't keep the secret in memory longer than needed
    if (ok) return onSuccess();

    setFormError(GENERIC_ERROR);
    passwordRef.current?.focus();
    registerFailure();
  }

  return {
    username, setUsername, password, setPassword,
    errors, formError, submitting, cooldown,
    locked: cooldown > 0,
    usernameRef, passwordRef,
    submit,
  };
}
