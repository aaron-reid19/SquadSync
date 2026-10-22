import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import ChipGroup from "../components/ChipGroup";
import Field from "../components/Field";
import PasswordField from "../components/PasswordField";
import StepProgress from "../components/StepProgress";
import { useSignupForm } from "../hooks/useSignupForm";
import { INTERESTS, PRONOUNS, TRANSPORT, TRAVEL_OPTIONS } from "../lib/profileOptions";
import ConsentSection from "../components/ConsentSection";
import PasswordRules from "../components/PasswordRules";
import { MAX_AGE, MIN_AGE } from "../lib/validation";

// Local-time YYYY-MM-DD (toISOString would shift the date by a day in some time zones).
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return isoDate(d);
};

export default function SignupPage() {
  const navigate = useNavigate();
  const { values: v, errors, formError, submitting, usernameStatus, set, blur, submit } = useSignupForm(() =>
    navigate("/signup/availability")
  );
  const usernameHint = {
    idle: "Friends find you with this. Letters, numbers, dots and underscores.",
    checking: "Checking...",
    available: "✓ Available",
    taken: "Friends find you with this. Letters, numbers, dots and underscores.",
  }[usernameStatus];

  return (
    <AuthLayout wide title="Join SquadSync" lead="Tell us about you so your Squad can find you.">
      <StepProgress current={1} />

      <form onSubmit={submit} onBlur={blur} noValidate>
        <fieldset className="group">
          <legend>Your account</legend>
          <Field id="email" label="Email" error={errors.email}>
            {(a) => (
              <input {...a} type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
                spellCheck={false} maxLength={254} value={v.email} onChange={(e) => set("email", e.target.value)} />
            )}
          </Field>
          <PasswordField id="password" label="Password" autoComplete="new-password"
            value={v.password} onChange={(x) => set("password", x)} error={errors.password} />
          <PasswordRules password ={v.password}/>
          <PasswordField id="confirm" label="Confirm password" autoComplete="new-password"
            value={v.confirm} onChange={(x) => set("confirm", x)} error={errors.confirm} />
        </fieldset>

        <fieldset className="group">
          <legend>About you</legend>
          <div className="row2">
            <Field id="firstName" label="First name" error={errors.firstName}>
              {(a) => <input {...a} autoComplete="given-name" maxLength={50} value={v.firstName}
                onChange={(e) => set("firstName", e.target.value)} />}
            </Field>
            <Field id="lastName" label="Last name" error={errors.lastName}>
              {(a) => <input {...a} autoComplete="family-name" maxLength={50} value={v.lastName}
                onChange={(e) => set("lastName", e.target.value)} />}
            </Field>
          </div>
          <Field id="username" label="Username" error={errors.username} hint={usernameHint}>
            {(a) => <input {...a} autoComplete="nickname" autoCapitalize="none" spellCheck={false} maxLength={20}
              value={v.username} onChange={(e) => set("username", e.target.value)} />}
          </Field>
          <div className="row2">
            <Field id="dob" label="Date of birth" error={errors.dob} hint="You must be 18 or older. We show your age, never your birth date.">
                {(a) => <input {...a} type="date" autoComplete="bday" min={yearsAgo(MAX_AGE)} max={yearsAgo(MIN_AGE)}
                value={v.dob} onChange={(e) => set("dob", e.target.value)} />}
            </Field>
            <Field id="pronouns" label="Pronouns" optional>
              {(a) => (
                <select {...a} value={v.pronouns} onChange={(e) => set("pronouns", e.target.value)}>
                  <option value="">Select</option>
                  {PRONOUNS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
            </Field>
          </div>
          <Field id="phone" label="Phone" optional error={errors.phone}>
            {(a) => <input {...a} type="tel" inputMode="tel" autoComplete="tel" maxLength={20}
              value={v.phone} onChange={(e) => set("phone", e.target.value)} />}
          </Field>
          <Field id="bio" label="Bio" optional error={errors.bio} hint={`${v.bio.length}/160`}>
            {(a) => <textarea {...a} rows={3} maxLength={160} value={v.bio}
              onChange={(e) => set("bio", e.target.value)} />}
          </Field>
        </fieldset>

        <fieldset className="group">
          <legend>Your hangout style</legend>
          <div className="row2">
            <Field id="city" label="City" error={errors.city}>
              {(a) => <input {...a} autoComplete="address-level2" maxLength={80} value={v.city}
                onChange={(e) => set("city", e.target.value)} />}
            </Field>
            <Field id="travelKm" label="Travel up to" error={errors.travelKm}>
              {(a) => (
                <select {...a} value={v.travelKm} onChange={(e) => set("travelKm", e.target.value)}>
                  <option value="">Select</option>
                  {TRAVEL_OPTIONS.map((km) => <option key={km} value={km}>{km} km</option>)}
                </select>
              )}
            </Field>
          </div>
          <ChipGroup id="interests" legend="Interests" options={INTERESTS} selected={v.interests}
            onChange={(x) => set("interests", x)} max={10} error={errors.interests}
            hint={`Pick 3 to 10. Selected: ${v.interests.length}`} />
          <ChipGroup id="transport" legend="How do you usually get there? (optional)" options={TRANSPORT}
            selected={v.transport} onChange={(x) => set("transport", x)} />
        </fieldset>

        <ConsentSection checked={v.acceptTerms} error={errors.acceptTerms} onChange={(x) => set("acceptTerms", x)} />  

        <div className="form__status" role="alert">{formError}</div>

        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Continue to availability"}
        </button>
      </form>

      <p className="login__foot">Already have an account? <Link className="link" to="/login">Log in</Link></p>
    </AuthLayout>
  );
}