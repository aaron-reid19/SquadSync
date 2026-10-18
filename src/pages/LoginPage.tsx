import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { useLoginForm } from "../hooks/useLoginForm";

interface Props {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: Props) {
  const form = useLoginForm(onSuccess);

  return (
    <AuthLayout title="Welcome back" lead="Log in to plan your next hangout with your Squad.">
      <form onSubmit={form.submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            ref={form.emailRef}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={form.email}
            onChange={(e) => form.setEmail(e.target.value)}
            aria-invalid={!!form.errors.email}
            aria-describedby={form.errors.email ? "email-error" : undefined}
          />
          {form.errors.email && <p id="email-error" className="field__error">{form.errors.email}</p>}
        </div>

        <PasswordField
          ref={form.passwordRef}
          value={form.password}
          onChange={form.setPassword}
          error={form.errors.password}
        />

        <p className="forgot">
          Forgot your password? <Link className="link" to="/forgot-password">Reset it</Link>
        </p>

        <div className="form__status" role="alert">
          {form.locked ? `Too many attempts. Try again in ${form.cooldown}s.` : form.formError}
        </div>

        <button className="btn btn--primary" type="submit" disabled={form.submitting || form.locked}>
          {form.submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="divider"><span>or</span></div>

      <div className="google">
        <GoogleLogin
          onSuccess={(res) => form.googleSuccess(res.credential)}
          onError={form.googleError}
          text="continue_with"
          shape="pill"
          theme="outline"
          size="large"
          width="320"
        />
      </div>

      <p className="login__foot">
        New to SquadSync? <a className="link" href="/signup">Create an account</a>
      </p>
    </AuthLayout>
  );
}