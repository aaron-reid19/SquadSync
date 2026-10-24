import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { useLoginForm } from "../hooks/useLoginForm";
import { useStore } from "../lib/data/store";

export default function LoginPage() {
  const navigate = useNavigate();
  const { ready, me } = useStore();
  const next = useSearchParams()[0].get("next") || "/";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const form = useLoginForm(() => navigate(target, { replace: true }));

  // Already signed in? Skip the form.
  useEffect(() => {
    if (ready && me) navigate(target, { replace: true });
  }, [ready, me, target, navigate]);

  return (
    <AuthLayout title="Welcome back" lead="Log in to plan your next hangout with your Squad.">
      <p className="demo-hint">
        <strong>Demo login:</strong> username <code>admin</code>, password <code>password</code>
      </p>
      <form onSubmit={form.submit} noValidate>
        <div className="field">
          <label htmlFor="username">Username or email</label>
          <input
            id="username"
            ref={form.usernameRef}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={form.username}
            onChange={(e) => form.setUsername(e.target.value)}
            aria-invalid={!!form.errors.username}
            aria-describedby={form.errors.username ? "username-error" : undefined}
          />
          {form.errors.username && <p id="username-error" className="field__error">{form.errors.username}</p>}
        </div>

        <PasswordField
          ref={form.passwordRef}
          value={form.password}
          onChange={form.setPassword}
          error={form.errors.password}
        />

        <div className="form__status" role="alert">
          {form.locked ? `Too many attempts. Try again in ${form.cooldown}s.` : form.formError}
        </div>

        <button className="btn btn--primary" type="submit" disabled={form.submitting || form.locked}>
          {form.submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="login__foot">
        New to SquadSync? <Link className="link" to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
