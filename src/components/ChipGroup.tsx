interface Props {
    id: string;
    legend: string;
    options: readonly string[];
    selected: string[];
    onChange: (next: string[]) => void;
    max?: number;
    hint?: string;
    error?: string;
  }
  
  export default function ChipGroup({ id, legend, options, selected, onChange, max, hint, error }: Props) {
    return (
      <fieldset id={id} tabIndex={-1} className="chips" aria-invalid={!!error}>
        <legend>{legend}</legend>
        <div className="chips__list">
          {options.map((option) => {
            const on = selected.includes(option);
            const full = !on && max !== undefined && selected.length >= max;
            return (
              <button
                key={option}
                type="button"
                className="chip"
                aria-pressed={on}
                disabled={full}
                onClick={() => onChange(on ? selected.filter((x) => x !== option) : [...selected, option])}
              >
                {option}
              </button>
            );
          })}
        </div>
        {hint && <p className="field__hint">{hint}</p>}
        {error && <p className="field__error">{error}</p>}
      </fieldset>
    );
  }