"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import AuthLayout from "../components/AuthLayout";
import { AuthError, requestPasswordReset } from "../lib/auth";
import { validateEmail } from "../lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const problem = validateEmail(email);
    setError(problem ?? "");
    setFormError("");
    if (problem) return emailRef.current?.focus();

    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" lead="We've done our part. Now it's your turn.">
        <p className="notice" role="status">
          If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your password.
          It works for 30 minutes. Not there? Check your spam folder.
        </p>
        <Link className="btn btn--primary btn--link" href="/login">Back to log in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" lead="Enter your email and we'll send you a link to choose a new password.">
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            ref={emailRef}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "email-error" : undefined}
          />
          {error && <p id="email-error" className="field__error">{error}</p>}
        </div>

        <div className="form__status" role="alert">{formError}</div>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="login__foot"><Link className="link" href="/login">Back to log in</Link></p>
    </AuthLayout>
  );
}