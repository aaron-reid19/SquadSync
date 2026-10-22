export interface LoginValues {
  email: string;
  password: string;
}
export type LoginErrors = Partial<Record<keyof LoginValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Client-side checks are for friendly feedback only. The server repeats every
 * check (server/src/schemas.ts) because anyone can bypass the browser.
 */
export function validateEmail(email: string): string | undefined {
  const e = email.trim();
  if (!e) return "Enter your email.";
  if (e.length > 254 || !EMAIL_PATTERN.test(e)) return "Enter a valid email, like name@example.com.";
}

/** Login deliberately does not enforce password complexity and never reveals which credential was wrong. */
export function validateLogin({ email, password }: LoginValues): LoginErrors {
  const errors: LoginErrors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (!password) errors.password = "Enter your password.";
  else if (password.length < 8) errors.password = "Passwords have at least 8 characters.";
  else if (password.length > 128) errors.password = "Passwords have at most 128 characters.";

  return errors;
}

export const PASSWORD_RULES = [
  { label: "At least 8 characters", need: "", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", need: "an uppercase letter", test: (p: string) => /\p{Lu}/u.test(p) },
  { label: "A lowercase letter", need: "a lowercase letter", test: (p: string) => /\p{Ll}/u.test(p) },
  { label: "A number", need: "a number", test: (p: string) => /\d/.test(p) },
  { label: "A special character (like ! ? # $)", need: "a special character", test: (p: string) => /[^\p{L}\p{N}\s]/u.test(p) },
] as const;

export interface NewPasswordErrors {
  password?: string;
  confirm?: string;
}

/** Rules for choosing a NEW password (reset and sign-up). Login does not enforce these. */
export function validateNewPassword(password: string, confirm: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  if (password.length < 8) errors.password = "Use at least 8 characters.";
  else if (password.length > 128) errors.password = "Use at most 128 characters.";
  else {
    const missing = PASSWORD_RULES.filter((r) => r.need && !r.test(password)).map((r) => r.need);
    if (missing.length) errors.password = `Add ${missing.join(", ")}.`;
  }

  if (!errors.password && confirm !== password) errors.confirm = "Passwords don't match.";
  return errors;
}

export interface SignupValues {
  email: string; password: string; confirm: string;
  firstName: string; lastName: string; username: string; dob: string; phone: string;
  city: string; travelKm: string; pronouns: string; bio: string;
  interests: string[]; transport: string[]; acceptTerms: boolean;
}
export type SignupErrors = Partial<Record<keyof SignupValues, string>>;

const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.-]*$/u;

export const MIN_AGE = 18;
export const MAX_AGE = 100; // change this one number to loosen or tighten the limit

/** Age in whole years for a YYYY-MM-DD string, or null if it isn't a real calendar date. */
export function ageFromDob(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null; // also blocks 6-digit years some browsers allow
  const [y, m, d] = dob.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d)) age--;
  return age;
}

export function dobError(dob: string): string | undefined {
  if (!dob) return "Enter your date of birth.";
  const age = ageFromDob(dob);
  if (age === null) return "Enter a valid date.";
  if (age < 0) return "Birth date can't be in the future.";
  if (age < MIN_AGE) return `You must be ${MIN_AGE} or older to join.`;
  if (age > MAX_AGE) return "Please check the year. It looks too far back.";
}

export const FIELD_ORDER: (keyof SignupValues)[] = [
  "email", "password", "confirm", "firstName", "lastName", "username", "dob",
  "phone", "city", "travelKm", "bio", "interests", "acceptTerms",
];

function nameError(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return "Required.";
  if (s.length > 50 || !NAME_PATTERN.test(s)) return "Use letters, spaces, hyphens or apostrophes.";
}

/** Validates ONE field. Used on blur, while typing, and on submit. */
export function validateField(key: keyof SignupValues, v: SignupValues): string | undefined {
  switch (key) {
    case "email": return validateEmail(v.email);
    case "password": return validateNewPassword(v.password, v.confirm).password;
    case "confirm":
      if (!v.confirm) return "Re-enter your password.";
      return v.confirm !== v.password ? "Passwords don't match." : undefined;
    case "firstName": return nameError(v.firstName);
    case "lastName": return nameError(v.lastName);
    case "username":
      return /^[a-z0-9_.]{3,20}$/.test(v.username.trim().toLowerCase())
        ? undefined
        : "Use 3 to 20 letters, numbers, dots or underscores.";
    case "dob": return dobError(v.dob);
    case "phone": {
      const p = v.phone.trim();
      if (!p) return undefined; // optional
      const digits = p.replace(/\D/g, "").length;
      return /^\+?[0-9 ()-]+$/.test(p) && digits >= 10 && digits <= 15
        ? undefined
        : "Enter a valid phone number, like 403-555-0123.";
    }
    case "city": {
      const c = v.city.trim();
      return c.length >= 2 && c.length <= 80 ? undefined : "Enter your city.";
    }
    case "travelKm": return v.travelKm ? undefined : "Choose a distance.";
    case "bio": return v.bio.length > 160 ? "Keep it to 160 characters." : undefined;
    case "interests": return v.interests.length >= 3 ? undefined : "Pick at least 3 interests.";
    case "acceptTerms": return v.acceptTerms ? undefined : "Please read and accept to continue.";
    default: return undefined;
  }
}