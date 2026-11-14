import type { KeyboardEvent } from "react";

interface Props<T extends string> {
  tabs: { id: T; label: string; badge?: number }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}

/** WAI-ARIA tabs: one Tab stop for the group, arrow keys / Home / End move between tabs. */
export default function Tabs<T extends string>({ tabs, active, onChange, label }: Props<T>) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === active);
    const moves: Record<string, number> = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className="tabs__tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {!!t.badge && <span className="tabs__badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
