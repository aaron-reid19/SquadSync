interface Props<T extends string> {
  tabs: { id: T; label: string; badge?: number }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}

export default function Tabs<T extends string>({ tabs, active, onChange, label }: Props<T>) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
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
