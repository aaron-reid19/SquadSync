import { FocusEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useStore } from "../lib/data/store";
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
  const { signup, isUsernameTaken } = useStore();
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

  // Debounced "is this username free?" check (MVP: against the mock store instead of the server).
  useEffect(() => {
    const u = values.username.trim().toLowerCase();
    if (!USERNAME_FORMAT.test(u)) return setUsernameStatus("idle");
    if (taken.current.has(u)) {
      setUsernameStatus("taken");
      setErrors((prev) => ({ ...prev, username: TAKEN_MESSAGE }));
      return;
    }
    setUsernameStatus("checking");
    const timer = window.setTimeout(() => {
      if (isUsernameTaken(u)) {
        taken.current.add(u);
        setUsernameStatus("taken");
        setErrors((prev) => ({ ...prev, username: TAKEN_MESSAGE }));
      } else {
        setUsernameStatus("available");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [values.username]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const result = await signup({
      email: values.email,
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      username: values.username,
      phone: values.phone.trim() || undefined,
      city: values.city.trim(),
      travelKm: Number(values.travelKm),
      pronouns: values.pronouns || undefined,
      bio: values.bio.trim() || undefined,
      interests: values.interests,
      transport: values.transport,
    });
    setSubmitting(false);
    if (result.ok) {
      setValues(empty); // clears the password from memory
      return onSuccess();
    }
    setErrors({ [result.field]: result.error });
    focusField(result.field);
  }

  return { values, errors, formError, submitting, usernameStatus, set, blur, submit };
}