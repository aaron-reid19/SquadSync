import { FocusEvent, FormEvent, useEffect, useRef, useState } from "react";
import { AuthError, checkUsername, signUp } from "../lib/auth";
import { TERMS_VERSION } from "../content/policies";
import { FIELD_ORDER, validateField, type SignupErrors, type SignupValues } from "../lib/validation";

export type UsernameStatus = "idle" | "checking" | "available" | "taken";

const USERNAME_FORMAT = /^[a-z0-9_.]{3,20}$/;
const TAKEN_MESSAGE = "That username is taken.";

const empty: SignupValues = {
  email: "", password: "", confirm: "", firstName: "", lastName: "", username: "", dob: "",
  phone: "", city: "", travelKm: "", pronouns: "", bio: "", interests: [], transport: [], acceptTerms: false,
};

const focusField = (id: string) => document.getElementById(id)?.focus();

export function useSignupForm(onSuccess: () => void) {
  const [values, setValues] = useState<SignupValues>(empty);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const touched = useRef(new Set<string>()); // fields the user has left at least once
  const taken = useRef(new Set<string>()); // usernames the server said are taken

  function fieldError(key: keyof SignupValues, v: SignupValues) {
    if (key === "username" && taken.current.has(v.username.trim().toLowerCase())) return TAKEN_MESSAGE;
    return validateField(key, v);
  }

  function revalidate(v: SignupValues, key: keyof SignupValues) {
    // Changing the password also re-checks "confirm" if the user already visited it.
    const keys: (keyof SignupValues)[] =
      key === "password" && touched.current.has("confirm") ? ["password", "confirm"] : [key];
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = fieldError(k, v);
      return next;
    });
  }

  function set<K extends keyof SignupValues>(key: K, value: SignupValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    // Once a field has been visited or shown an error, check it live while typing.
    if (touched.current.has(key) || errors[key]) revalidate(next, key);
  }

  /** Attach to <form onBlur>: validates a field as soon as the user leaves it. */
  function blur(e: FocusEvent<HTMLFormElement>) {
    const key = e.target.id as keyof SignupValues;
    if (!(key in empty)) return;
    touched.current.add(key);
    revalidate(values, key);
  }

  // Debounced "is this username free?" check against the server.
  useEffect(() => {
    const u = values.username.trim().toLowerCase();
    if (!USERNAME_FORMAT.test(u)) return setUsernameStatus("idle");
    if (taken.current.has(u)) {
      setUsernameStatus("taken");
      setErrors((prev) => ({ ...prev, username: TAKEN_MESSAGE }));
      return;
    }
    setUsernameStatus("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        if (await checkUsername(u, controller.signal)) {
          setUsernameStatus("available");
        } else {
          taken.current.add(u);
          setUsernameStatus("taken");
          setErrors((prev) => ({ ...prev, username: TAKEN_MESSAGE }));
        }
      } catch {
        if (!controller.signal.aborted) setUsernameStatus("idle"); // the server re-checks on submit anyway
      }
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [values.username]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const found: SignupErrors = {};
    for (const key of FIELD_ORDER) {
      const message = fieldError(key, values);
      if (message) found[key] = message;
    }
    setErrors(found);
    setFormError("");
    const first = Object.keys(found)[0];
    if (first) return focusField(first);

    setSubmitting(true);
    try {
      await signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        username: values.username.trim().toLowerCase(),
        dob: values.dob,
        phone: values.phone.trim() || undefined,
        city: values.city.trim(),
        travelKm: Number(values.travelKm),
        pronouns: values.pronouns || undefined,
        bio: values.bio.trim() || undefined,
        interests: values.interests,
        transport: values.transport,
        acceptTerms: values.acceptTerms,
        termsVersion: TERMS_VERSION,
      });
      setValues(empty); // clears the password from memory
      onSuccess();
    } catch (err) {
      const authErr = err instanceof AuthError ? err : new AuthError("Something went wrong. Try again.");
      if (authErr.status === 409 && authErr.field) {
        setErrors({ [authErr.field]: authErr.message });
        focusField(authErr.field);
      } else {
        setFormError(authErr.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { values, errors, formError, submitting, usernameStatus, set, blur, submit };
}