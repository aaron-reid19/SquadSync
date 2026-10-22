import type { ReactNode } from "react";

interface Aria {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}
interface Props {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (aria: Aria) => ReactNode;
}

export default function Field({ id, label, error, hint, optional, children }: Props) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field__error">{error}</p>}
    </div>
  );
}