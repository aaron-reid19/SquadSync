"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import AvailabilityGrid from "../components/AvailabilityGrid";
import { Avatar } from "../components/Avatar";
import ChipGroup from "../components/ChipGroup";
import Field from "../components/Field";
import Tabs from "../components/Tabs";
import type { AvailabilityKey } from "../lib/data/types";
import { useMe, useStore } from "../lib/data/store";
import { AVATAR_COLORS } from "../lib/data/seed";
import { fullName } from "../lib/format";
import { INTERESTS, PRONOUNS, TRANSPORT, TRAVEL_OPTIONS } from "../lib/profileOptions";
import { validateEmail } from "../lib/validation";
import { BLOCKS, keyOf } from "../lib/availability";

type Tab = "info" | "availability";

export default function ProfilePage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "availability" ? "availability" : "info";
  const welcome = params.get("welcome") === "1";
  const me = useMe();

  return (
    <>
      <section className="hero hero--profile">
        <Avatar user={me} size={72} />
        <div>
          <h1 className="h1">{fullName(me)}</h1>
          <p className="lead">@{me.username}{me.pronouns ? ` · ${me.pronouns}` : ""} · {me.city}</p>
        </div>
      </section>

      {welcome && (
        <div className="banner" role="status">
          <strong>Welcome to SquadSync! 🎉</strong> Last step: mark when you&apos;re usually free so your Squad can find a time that works.
        </div>
      )}

      <Tabs<Tab>
        label="Profile sections"
        active={tab}
        onChange={(t) => router.replace(`/profile?tab=${t}${welcome ? "&welcome=1" : ""}`)}
        tabs={[{ id: "info", label: "Personal info" }, { id: "availability", label: "Availability" }]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === "info" ? <PersonalInfo /> : <Availability welcome={welcome} />}
      </div>
    </>
  );
}

function PersonalInfo() {
  const me = useMe();
  const { updateProfile, resetDemo } = useStore();
  const [v, setV] = useState({
    firstName: me.firstName, lastName: me.lastName, email: me.email, pronouns: me.pronouns ?? "", bio: me.bio ?? "",
    city: me.city, travelKm: String(me.travelKm), interests: me.interests, transport: me.transport, color: me.color,
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setSaved(false);
  };

  function save(e: FormEvent) {
    e.preventDefault();
    const found = {
      firstName: v.firstName.trim() ? undefined : "Required.",
      lastName: v.lastName.trim() ? undefined : "Required.",
      email: validateEmail(v.email),
      city: v.city.trim().length >= 2 ? undefined : "Enter your city.",
      interests: v.interests.length >= 3 ? undefined : "Pick at least 3 interests.",
    };
    setErrors(found);
    const first = Object.entries(found).find(([, msg]) => msg)?.[0];
    if (first) return document.getElementById(first)?.focus();
    updateProfile({
      firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim().toLowerCase(),
      pronouns: v.pronouns || undefined, bio: v.bio.trim() || undefined, city: v.city.trim(),
      travelKm: Number(v.travelKm), interests: v.interests, transport: v.transport, color: v.color,
    });
    setSaved(true);
  }

  return (
    <form onSubmit={save} noValidate className="card form-card">
      <div className="row2">
        <Field id="firstName" label="First name" error={errors.firstName}>
          {(a) => <input {...a} value={v.firstName} maxLength={50} onChange={(e) => set("firstName", e.target.value)} />}
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName}>
          {(a) => <input {...a} value={v.lastName} maxLength={50} onChange={(e) => set("lastName", e.target.value)} />}
        </Field>
      </div>
      <div className="row2">
        <Field id="email" label="Email" error={errors.email}>
          {(a) => <input {...a} type="email" value={v.email} maxLength={254} onChange={(e) => set("email", e.target.value)} />}
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
      <Field id="bio" label="Bio" optional hint={`${v.bio.length}/160`}>
        {(a) => <textarea {...a} rows={3} maxLength={160} value={v.bio} onChange={(e) => set("bio", e.target.value)} />}
      </Field>
      <div className="row2">
        <Field id="city" label="City" error={errors.city}>
          {(a) => <input {...a} value={v.city} maxLength={80} onChange={(e) => set("city", e.target.value)} />}
        </Field>
        <Field id="travelKm" label="Travel up to">
          {(a) => (
            <select {...a} value={v.travelKm} onChange={(e) => set("travelKm", e.target.value)}>
              {TRAVEL_OPTIONS.map((km) => <option key={km} value={km}>{km} km</option>)}
            </select>
          )}
        </Field>
      </div>
      <ChipGroup id="interests" legend="Interests" options={INTERESTS} selected={v.interests} max={10}
        onChange={(x) => set("interests", x)} error={errors.interests} hint={`Pick 3 to 10. Selected: ${v.interests.length}`} />
      <ChipGroup id="transport" legend="How do you usually get there?" options={TRANSPORT} selected={v.transport}
        onChange={(x) => set("transport", x)} />
      <fieldset className="chips">
        <legend>Avatar colour</legend>
        <div className="chips__list">
          {AVATAR_COLORS.map((c) => (
            <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={v.color === c}
              aria-label={`Colour ${c}`} onClick={() => set("color", c)} />
          ))}
        </div>
      </fieldset>

      <div className="form__status form__status--ok" role="status">{saved ? "✓ Saved" : ""}</div>
      <button className="btn btn--primary" type="submit">Save changes</button>

      <div className="danger">
        <p className="muted small">Demo data lives in this browser. Resetting restores the seeded Squads, events and chats.</p>
        <button type="button" className="btn btn--small btn--auto" onClick={() => { if (confirm("Reset all demo data?")) resetDemo(); }}>
          Reset demo data
        </button>
      </div>
    </form>
  );
}

function Availability({ welcome }: { welcome: boolean }) {
  const me = useMe();
  const { setAvailability } = useStore();
  const [value, setValue] = useState<AvailabilityKey[]>(me.availability);
  const [saved, setSaved] = useState(false);

  const preset = (name: "evenings" | "weekends" | "clear") => {
    const keys: AvailabilityKey[] = [];
    if (name === "evenings") for (let d = 0; d < 5; d++) keys.push(keyOf(d, 2));
    if (name === "weekends") for (const d of [5, 6]) for (let b = 0; b < BLOCKS.length; b++) keys.push(keyOf(d, b));
    setValue(name === "clear" ? [] : [...new Set([...value, ...keys])]);
    setSaved(false);
  };

  return (
    <div className="card form-card">
      <p className="lead">Tap or drag across the times you&apos;re usually free. SquadSync uses this to pre-fill your votes on event times.</p>
      <div className="row-gap wrap" style={{ marginBottom: 14 }}>
        <button type="button" className="btn btn--small btn--auto" onClick={() => preset("evenings")}>+ Weeknight evenings</button>
        <button type="button" className="btn btn--small btn--auto" onClick={() => preset("weekends")}>+ Weekends</button>
        <button type="button" className="btn btn--small btn--auto btn--ghost" onClick={() => preset("clear")}>Clear</button>
      </div>
      <AvailabilityGrid value={value} onChange={(v) => { setValue(v); setSaved(false); }} />
      <p className="muted small">{value.length} time blocks selected.</p>
      <div className="form__status form__status--ok" role="status">{saved ? "✓ Availability saved" : ""}</div>
      <div className="row-gap">
        <button type="button" className="btn btn--primary btn--auto" onClick={() => { setAvailability(value); setSaved(true); }}>
          Save availability
        </button>
        {welcome && saved && <Link href="/" className="btn btn--auto btn--blue">Go to SquadSync →</Link>}
      </div>
    </div>
  );
}
