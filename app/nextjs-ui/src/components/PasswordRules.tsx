import { PASSWORD_RULES } from "../lib/validation";

export default function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="rules" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className={ok ? "rules__ok" : ""}>
            {ok ? "✓" : "○"} {rule.label}
          </li>
        );
      })}
    </ul>
  );
}