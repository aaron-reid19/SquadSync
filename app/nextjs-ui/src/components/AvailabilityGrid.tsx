import { useEffect, useRef } from "react";
import type { AvailabilityKey } from "../lib/data/types";
import { BLOCKS, DAYS, keyOf } from "../lib/availability";

interface Props {
  value: AvailabilityKey[];
  onChange: (next: AvailabilityKey[]) => void;
}

/** Tap a cell to toggle it, or press and drag to paint several at once. */
export default function AvailabilityGrid({ value, onChange }: Props) {
  const painting = useRef<null | boolean>(null); // true = adding, false = removing
  const current = useRef(new Set(value));
  current.current = new Set(value);

  useEffect(() => {
    const stop = () => (painting.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  function apply(key: AvailabilityKey, on: boolean) {
    const next = new Set(current.current);
    if (on) next.add(key);
    else next.delete(key);
    current.current = next;
    onChange([...next]);
  }

  return (
    <div
      className="avail"
      role="grid"
      aria-label="Weekly availability"
      onPointerMove={(e) => {
        // elementFromPoint makes drag-painting work for touch too (touch pointers stay captured on the first cell).
        if (painting.current === null) return;
        const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-key]");
        const key = cell?.dataset.key as AvailabilityKey | undefined;
        if (key && current.current.has(key) !== painting.current) apply(key, painting.current);
      }}
    >
      <div className="avail__row" role="row">
        <span className="avail__corner" role="columnheader" />
        {DAYS.map((d) => <span key={d} className="avail__day" role="columnheader">{d}</span>)}
      </div>
      {BLOCKS.map((b, bi) => (
        <div key={b.label} className="avail__row" role="row">
          <span className="avail__block" role="rowheader">
            {b.label}
            <small>{b.from > 12 ? b.from - 12 : b.from}{b.from >= 12 ? "pm" : "am"}–{b.to === 24 ? "12am" : b.to > 12 ? `${b.to - 12}pm` : `${b.to}pm`}</small>
          </span>
          {DAYS.map((d, di) => {
            const key = keyOf(di, bi);
            const on = value.includes(key);
            return (
              <button
                key={key}
                data-key={key}
                type="button"
                role="gridcell"
                className="avail__cell"
                aria-pressed={on}
                aria-label={`${d} ${b.label}: ${on ? "free" : "busy"}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  painting.current = !on;
                  apply(key, !on);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    apply(key, !on);
                  }
                }}
              >
                {on ? "✓" : ""}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
