"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import AvailabilityGrid from "../components/AvailabilityGrid";
import { Avatar } from "../components/Avatar";
import ChipGroup from "../components/ChipGroup";
import Field from "../components/Field";
import Tabs from "../components/Tabs";
import type { AvailabilityKey, User } from "../lib/data/types";
import { useMe, useStore } from "../lib/data/store";
import { AVATAR_COLORS } from "../lib/data/seed";
import { fullName } from "../lib/format";
import { INTERESTS, PRONOUNS, TRANSPORT, TRAVEL_OPTIONS } from "../lib/profileOptions";
import { validateEmail } from "../lib/validation";
import { BLOCKS, keyOf } from "../lib/availability";

type Tab = "info" | "availability";

type ProfileDraft = {
  firstName: string;
  lastName: string;
  email: string;
  pronouns: string;
  bio: string;
  city: string;
  travelKm: string;
  interests: string[];
  transport: string[];
  color: string;
};

function makeDraft(user: User): ProfileDraft {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    pronouns: user.pronouns ?? "",
    bio: user.bio ?? "",
    city: user.city,
    travelKm: String(user.travelKm),
    interests: [...user.interests],
    transport: [...user.transport],
    color: user.color,
  };
}

export default function ProfilePage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "availability" ? "availability" : "info";
  const welcome = params.get("welcome") === "1";
  const me = useMe();

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <Avatar user={me} size={76} />
        <div className="profile-hero__copy">
          <p className="profile-eyebrow">YOUR SQUADSYNC PROFILE</p>
          <h1 className="h1">{fullName(me)}</h1>
          <p className="profile-hero__username">@{me.username}</p>
          {me.bio && <p className="profile-hero__bio">{me.bio}</p>}
        </div>
      </section>

      {welcome && (
        <div className="banner profile-welcome" role="status">
          <strong>Welcome to SquadSync! 🎉</strong>
          <span>One last step: set your usual free times so your Squad can plan around you.</span>
        </div>
      )}

      <Tabs<Tab>
        label="Profile sections"
        active={tab}
        onChange={(t) => router.replace(`/profile?tab=${t}${welcome ? "&welcome=1" : ""}`)}
        tabs={[{ id: "info", label: "Personal info" }, { id: "availability", label: "Availability" }]}
      />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel profile-panel">
        {tab === "info" ? <PersonalInfo /> : <Availability welcome={welcome} />}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="profile-section-heading">
      <div className="profile-section-heading__copy">
        <p className="profile-eyebrow">{eyebrow}</p>
        <h2 className="h2">{title}</h2>
        <p className="profile-section-heading__description">{description}</p>
      </div>
      {action && <div className="profile-section-heading__action">{action}</div>}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="profile-detail">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function PersonalInfo() {
  const me = useMe();
  const { updateProfile } = useStore();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<ProfileDraft>(() => makeDraft(me));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  function startEditing() {
    setV(makeDraft(me));
    setErrors({});
    setSaved(false);
    setEditing(true);
  }

  function cancelEditing() {
    setV(makeDraft(me));
    setErrors({});
    setEditing(false);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found = {
      firstName: v.firstName.trim() ? undefined : "Required.",
      lastName: v.lastName.trim() ? undefined : "Required.",
      email: validateEmail(v.email),
      city: v.city.trim().length >= 2 ? undefined : "Enter your city.",
      interests: v.interests.length >= 3 ? undefined : "Pick at least 3 interests.",
    };
    setErrors(found);
    const first = Object.entries(found).find(([, message]) => message)?.[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }

    await updateProfile({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim().toLowerCase(),
      pronouns: v.pronouns || undefined,
      bio: v.bio.trim() || undefined,
      city: v.city.trim(),
      travelKm: Number(v.travelKm),
      interests: v.interests,
      transport: v.transport,
      color: v.color,
    });
    setSaved(true);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="profile-view">
        <SectionHeading
          eyebrow="ABOUT YOU"
          title="Personal info"
          description="The details your Squad sees about you. You can update them whenever something changes."
          action={<button type="button" className="btn btn--primary btn--auto" onClick={startEditing}>✎ Edit profile</button>}
        />

        {saved && <p className="profile-saved" role="status">✓ Your profile changes have been saved.</p>}

        <section className="card profile-card" aria-labelledby="profile-details-title">
          <div className="profile-card__head">
            <div>
              <h3 id="profile-details-title" className="h3">Personal details</h3>
              <p className="muted small">Your contact and location information.</p>
            </div>
          </div>
          <dl className="profile-details">
            <Detail label="First name">{me.firstName}</Detail>
            <Detail label="Last name">{me.lastName}</Detail>
            <Detail label="Email"><a href={`mailto:${me.email}`}>{me.email}</a></Detail>
            <Detail label="Pronouns">{me.pronouns || <span className="muted">Not specified</span>}</Detail>
            <Detail label="City">{me.city}</Detail>
            <Detail label="Travel range">Within {me.travelKm} km</Detail>
          </dl>
        </section>

        <section className="card profile-card profile-card--preferences" aria-labelledby="profile-preferences-title">
          <div className="profile-card__head">
            <div>
              <h3 id="profile-preferences-title" className="h3">About & preferences</h3>
              <p className="muted small">A little more about what you enjoy and how you get around.</p>
            </div>
            <span className="profile-color" aria-label="Selected avatar colour">
              <span style={{ background: me.color }} />
              <small>Profile colour</small>
            </span>
          </div>

          <div className="profile-bio-block">
            <span className="profile-detail__label">Bio</span>
            <p>{me.bio || <span className="muted">No bio added yet.</span>}</p>
          </div>

          <div className="profile-preference-grid">
            <div className="profile-preference">
              <span className="profile-detail__label">Interests</span>
              {me.interests.length ? (
                <div className="profile-tags" aria-label="Interests">
                  {me.interests.map((interest) => <span className="profile-tag" key={interest}>{interest}</span>)}
                </div>
              ) : <p className="muted small">No interests added yet.</p>}
            </div>
            <div className="profile-preference">
              <span className="profile-detail__label">Getting around</span>
              {me.transport.length ? (
                <div className="profile-tags" aria-label="Transportation preferences">
                  {me.transport.map((method) => <span className="profile-tag profile-tag--blue" key={method}>{method}</span>)}
                </div>
              ) : <p className="muted small">Not specified.</p>}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="profile-edit">
      <SectionHeading
        eyebrow="PROFILE SETTINGS"
        title="Edit personal info"
        description="Make your changes below. Your profile won't update until you save."
      />

      <form onSubmit={save} noValidate className="card profile-card profile-edit__form">
        <div className="profile-form-section">
          <h3 className="h3">Personal details</h3>
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
                  {PRONOUNS.map((pronoun) => <option key={pronoun} value={pronoun}>{pronoun}</option>)}
                </select>
              )}
            </Field>
          </div>
          <Field id="bio" label="Bio" optional hint={`${v.bio.length}/160`}>
            {(a) => <textarea {...a} rows={3} maxLength={160} value={v.bio} onChange={(e) => set("bio", e.target.value)} />}
          </Field>
        </div>

        <div className="profile-form-section">
          <h3 className="h3">Location & travel</h3>
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
        </div>

        <div className="profile-form-section">
          <h3 className="h3">Your preferences</h3>
          <ChipGroup id="interests" legend="Interests" options={INTERESTS} selected={v.interests} max={10}
            onChange={(items) => set("interests", items)} error={errors.interests}
            hint={`Pick 3 to 10. Selected: ${v.interests.length}`} />
          <ChipGroup id="transport" legend="How do you usually get there?" options={TRANSPORT} selected={v.transport}
            onChange={(items) => set("transport", items)} />
          <fieldset className="chips profile-color-picker">
            <legend>Avatar colour</legend>
            <div className="chips__list">
              {AVATAR_COLORS.map((color) => (
                <button key={color} type="button" className="swatch" style={{ background: color }}
                  aria-pressed={v.color === color} aria-label={`Choose avatar colour ${color}`}
                  onClick={() => set("color", color)} />
              ))}
            </div>
          </fieldset>
        </div>

        <div className="profile-edit__footer">
          <p className="form__status form__status--ok" role="status">{saved ? "✓ Saved" : ""}</p>
          <div className="profile-edit__actions">
            <button type="button" className="btn btn--ghost btn--auto" onClick={cancelEditing}>Cancel</button>
            <button className="btn btn--primary btn--auto" type="submit">Save changes</button>
          </div>
        </div>

      </form>
    </div>
  );
}

function Availability({ welcome }: { welcome: boolean }) {
  const me = useMe();
  const { setAvailability } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<AvailabilityKey[]>(() => [...me.availability]);
  const [saved, setSaved] = useState(false);

  const preset = (name: "evenings" | "weekends" | "clear") => {
    const keys: AvailabilityKey[] = [];
    if (name === "evenings") {
      for (let day = 0; day < 5; day++) keys.push(keyOf(day, 2));
    }
    if (name === "weekends") {
      for (const day of [5, 6]) for (let block = 0; block < BLOCKS.length; block++) keys.push(keyOf(day, block));
    }
    setValue(name === "clear" ? [] : [...new Set([...value, ...keys])]);
    setSaved(false);
  };

  function startEditing() {
    setValue([...me.availability]);
    setSaved(false);
    setEditing(true);
  }

  function cancelEditing() {
    setValue([...me.availability]);
    setEditing(false);
  }

  async function saveAvailability() {
    await setAvailability(value);
    setSaved(true);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="profile-view">
        <SectionHeading
          eyebrow="YOUR WEEKLY ROUTINE"
          title="Availability"
          description="Show your Squad when you're usually free. SquadSync uses this to make event planning and voting easier."
          action={<button type="button" className="btn btn--primary btn--auto" onClick={startEditing}>✎ Edit availability</button>}
        />

        {saved && <p className="profile-saved" role="status">✓ Your availability has been saved.</p>}

        {me.availability.length ? (
          <section className="card profile-card profile-availability-card" aria-labelledby="availability-overview-title">
            <div className="profile-card__head">
              <div>
                <h3 id="availability-overview-title" className="h3">Weekly overview</h3>
                <p className="muted small">Green cells are times you've marked as free.</p>
              </div>
              <span className="profile-availability-count"><strong>{me.availability.length}</strong><span>of 28 blocks</span></span>
            </div>
            <AvailabilityGrid value={me.availability} readOnly />
            <div className="profile-availability-legend">
              <span className="profile-availability-legend__swatch" /> Available
              <span className="profile-availability-legend__note">Your selections are visible to members of your Squads.</span>
            </div>
          </section>
        ) : (
          <section className="card profile-card profile-availability-empty">
            <div className="profile-availability-empty__icon" aria-hidden="true">🗓️</div>
            <div>
              <h3 className="h3">No availability set yet</h3>
              <p className="muted">Add the days and times that usually work for you. Your Squad can then find a time that suits everyone.</p>
              <button type="button" className="btn btn--primary btn--auto" onClick={startEditing}>Set my availability</button>
            </div>
          </section>
        )}

        {welcome && saved && <Link href="/" className="btn btn--auto btn--blue profile-availability-home">Go to SquadSync →</Link>}
      </div>
    );
  }

  return (
    <div className="profile-edit">
      <SectionHeading
        eyebrow="PROFILE SETTINGS"
        title="Edit availability"
        description="Tap a time block to mark it free, or drag across several blocks. You can change this whenever your routine changes."
      />

      <section className="card profile-card profile-availability-edit" aria-labelledby="availability-edit-title">
        <div className="profile-availability-edit__head">
          <div>
            <h3 id="availability-edit-title" className="h3">When are you usually free?</h3>
            <p className="muted small">Select all the time blocks that normally work for you.</p>
          </div>
          <span className="profile-availability-count"><strong>{value.length}</strong><span>selected</span></span>
        </div>

        <div className="profile-availability-presets" aria-label="Availability shortcuts">
          <button type="button" className="btn btn--small btn--auto" onClick={() => preset("evenings")}>＋ Weeknight evenings</button>
          <button type="button" className="btn btn--small btn--auto" onClick={() => preset("weekends")}>＋ Weekends</button>
          <button type="button" className="btn btn--small btn--auto btn--ghost" onClick={() => preset("clear")}>Clear all</button>
        </div>

        <AvailabilityGrid value={value} onChange={(next) => { setValue(next); setSaved(false); }} />
        <div className="profile-edit__footer">
          <p className="muted small">{value.length} of 28 weekly time blocks selected.</p>
          <div className="profile-edit__actions">
            <button type="button" className="btn btn--ghost btn--auto" onClick={cancelEditing}>Cancel</button>
            <button type="button" className="btn btn--primary btn--auto" onClick={saveAvailability}>Save availability</button>
          </div>
        </div>
      </section>
    </div>
  );
}
