import type { User } from "../lib/data/types";
import { fullName, initials } from "../lib/format";

export function Avatar({ user, size = 36 }: { user?: User; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: user?.color ?? "#ddd" }}
      title={fullName(user)}
      aria-label={fullName(user)}
      role="img"
    >
      {initials(user)}
    </span>
  );
}

export function AvatarStack({ users, max = 5, size = 32 }: { users: (User | undefined)[]; max?: number; size?: number }) {
  const shown = users.filter(Boolean).slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((u) => <Avatar key={u!.id} user={u} size={size} />)}
      {extra > 0 && <span className="avatar avatar--more" style={{ width: size, height: size, fontSize: size * 0.36 }}>+{extra}</span>}
    </span>
  );
}
