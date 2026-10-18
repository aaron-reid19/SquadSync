import { forwardRef, useState } from "react";
import { EyeIcon, EyeOffIcon } from "./EyeIcons";

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
  label?: string;
  autoComplete?: "current-password" | "new-password";
}

const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { value, onChange, error, id = "password", label = "Password", autoComplete = "current-password" },
  ref
) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const errorId = `${id}-error`;
  const capsId = `${id}-caps`;
  const describedBy = [error && errorId, capsLock && capsId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id}
          ref={ref}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          className="field__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {capsLock && <p id={capsId} className="field__note">Caps Lock is on.</p>}
      {error && <p id={errorId} className="field__error">{error}</p>}
    </div>
  );
});

export default PasswordField;