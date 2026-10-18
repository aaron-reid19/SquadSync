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

export interface NewPasswordErrors {
  password?: string;
  confirm?: string;
}

/** Rules for choosing a NEW password (reset now, sign-up later). */
export function validateNewPassword(password: string, confirm: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  if (password.length < 8) errors.password = "Use at least 8 characters.";
  else if (password.length > 128) errors.password = "Use at most 128 characters.";
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.password = "Include at least one letter and one number.";

  if (!errors.password && confirm !== password) errors.confirm = "Passwords don't match.";
  return errors;
}