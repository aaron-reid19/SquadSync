import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dobError, validateEmail, validateField, validateLogin, validateNewPassword, type SignupValues } from "../validation";

const signup = (patch: Partial<SignupValues> = {}): SignupValues => ({
  email: "sam@example.com", password: "Str0ng!pass", confirm: "Str0ng!pass",
  firstName: "Sam", lastName: "Lee", username: "sam_lee", dob: "1999-05-01", phone: "",
  city: "Calgary", travelKm: "10", pronouns: "", bio: "",
  interests: ["Movies", "Hiking", "Coffee"], transport: [], acceptTerms: true, ...patch,
});

describe("validateEmail", () => {
  it("accepts a normal address and rejects junk", () => {
    expect(validateEmail("  sam@example.com ")).toBeUndefined();
    expect(validateEmail("")).toBe("Enter your email.");
    expect(validateEmail("sam@example")).toMatch(/valid email/);
  });
});

describe("validateLogin", () => {
  it("only checks length, never complexity", () => {
    expect(validateLogin({ email: "sam@example.com", password: "alllowercase" })).toEqual({});
    expect(validateLogin({ email: "sam@example.com", password: "short" }).password).toMatch(/at least 8/);
  });
});

describe("validateNewPassword", () => {
  it("lists every missing rule", () => {
    expect(validateNewPassword("alllowercase", "").password).toBe("Add an uppercase letter, a number, a special character.");
  });

  it("checks the confirmation only once the password itself is fine", () => {
    expect(validateNewPassword("Str0ng!pass", "nope").confirm).toBe("Passwords don't match.");
    expect(validateNewPassword("weak", "nope").confirm).toBeUndefined();
  });
});

describe("dobError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("lets in someone who turned 18 today", () => {
    expect(dobError("2008-11-13")).toBeUndefined();
  });

  it("blocks someone who turns 18 tomorrow", () => {
    expect(dobError("2008-11-14")).toBe("You must be 18 or older to join.");
  });

  it("rejects impossible dates and future dates", () => {
    expect(dobError("2001-02-30")).toBe("Enter a valid date.");
    expect(dobError("2030-01-01")).toBe("Birth date can't be in the future.");
  });
});

describe("validateField", () => {
  it("passes a complete sign-up", () => {
    const v = signup();
    for (const key of Object.keys(v) as (keyof SignupValues)[]) expect(validateField(key, v)).toBeUndefined();
  });

  it("treats phone as optional but checks it when given", () => {
    expect(validateField("phone", signup({ phone: "" }))).toBeUndefined();
    expect(validateField("phone", signup({ phone: "403-555-0123" }))).toBeUndefined();
    expect(validateField("phone", signup({ phone: "555" }))).toMatch(/valid phone/);
  });

  it("needs at least 3 interests", () => {
    expect(validateField("interests", signup({ interests: ["Movies"] }))).toBe("Pick at least 3 interests.");
  });
});
