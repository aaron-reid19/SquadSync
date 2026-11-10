import { useEffect, useRef } from "react";
import type { AvailabilityKey } from "../lib/data/types";
import { BLOCKS, DAYS, keyOf } from "../lib/availability";

interface Props {
  value: AvailabilityKey[];
  onChange?: (next: AvailabilityKey[]) => void;
  readOnly?: boolean;
}

/** Tap a cell to toggle it, or press and drag to paint several at once. */
export default function AvailabilityGrid({ value, onChange, readOnly = false }: Props) {
  const painting = useRef<null | boolean>(null); // true = adding, false = removing
  const current = useRef(new Set(value));
  current.current = new Set(value);

  useEffect(() => {
    if (readOnly) return;
    const stop = () => (painting.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, [readOnly]);

  function apply(key: AvailabilityKey, on: boolean) {
    if (readOnly || !onChange) return;
    const next = new Set(current.current);
    if (on) next.add(key);
    else next.delete(key);
    current.current = next;
    onChange([...next]);
  }

  return (
    <div
      className={`avail${readOnly ? " avail--readonly" : ""}`}
      role="grid"
      aria-label="Weekly availability"
      aria-readonly={readOnly || undefined}
      onPointerMove={readOnly ? undefined : (e) => {
        // elementFromPoint makes drag-painting work for touch too (touch pointers stay captured on the first cell).
        if (painting.current === null) return;
        const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-key]");
        const key = cell?.dataset.key as AvailabilityKey | undefined;
        if (key && current.current.has(key) !== painting.current) apply(key, painting.current);
      }}
    >
      <div className="avail__row" role="row">
        <span className="avail__corner" role="columnheader" />
        {DAYS.map((day) => <span key={day} className="avail__day" role="columnheader">{day}</span>)}
      </div>
      {BLOCKS.map((block, blockIndex) => (
        <div key={block.label} className="avail__row" role="row">
          <span className="avail__block" role="rowheader">
            {block.label}
            <small>{block.from > 12 ? block.from - 12 : block.from}{block.from >= 12 ? "pm" : "am"}–{block.to === 24 ? "12am" : block.to > 12 ? `${block.to - 12}pm` : `${block.to}pm`}</small>
          </span>
          {DAYS.map((day, dayIndex) => {
            const key = keyOf(dayIndex, blockIndex);
            const selected = value.includes(key);
            const label = `${day} ${block.label}: ${selected ? "available" : "not selected"}`;

            return readOnly ? (
              <span
                key={key}
                data-key={key}
                className={`avail__cell avail__cell--readonly${selected ? " is-selected" : ""}`}
                role="gridcell"
                aria-label={label}
                aria-selected={selected}
              >
                {selected ? "✓" : ""}
              </span>
            ) : (
              <button
                key={key}
                data-key={key}
                type="button"
                role="gridcell"
                className="avail__cell"
                aria-pressed={selected}
                aria-label={label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  painting.current = !selected;
                  apply(key, !selected);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    apply(key, !selected);
                  }
                }}
              >
                {selected ? "✓" : ""}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
