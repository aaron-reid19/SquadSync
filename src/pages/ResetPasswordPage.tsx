import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { AuthError, resetPassword } from "../lib/auth";
import { validateNewPassword, type NewPasswordErrors } from "../lib/validation";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Keep the token in memory, then remove it from the address bar and browser history.
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => {
    if (token) navigate("/reset-password", { replace: true });
  }, [token, navigate]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [formError, setFormError] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found = validateNewPassword(password, confirm);
    setErrors(found);
    setFormError("");
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      const authErr = err instanceof AuthError ? err : new AuthError("Something went wrong. Try again.");
      setFormError(authErr.message);
      setLinkExpired(authErr.status === 400);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" lead="You're signed out on all devices. Log in with your new password.">
        <Link className="btn btn--primary btn--link" to="/login">Log in</Link>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout title="Link not valid" lead="This reset link is missing or has expired.">
        <Link className="btn btn--primary btn--link" to="/forgot-password">Request a new link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" lead="Pick something you don't use anywhere else.">
      <form onSubmit={submit} noValidate>
        <PasswordField
          ref={passwordRef}
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
        <p className="hint">Use at least 8 characters with a letter and a number.</p>
        <PasswordField
          ref={confirmRef}
          id="confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
        />

        <div className="form__status" role="alert">
          {formError}{" "}
          {linkExpired && <Link className="link" to="/forgot-password">Request a new link</Link>}
        </div>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save new password"}
        </button>
      </form>
    </AuthLayout>
  );
}