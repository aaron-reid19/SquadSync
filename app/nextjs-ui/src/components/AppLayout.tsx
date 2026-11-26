"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/data/store";

const PRIMARY_NAV = [
  { to: "/", label: "Home", icon: "🏠", emphasis: false },
  { to: "/explore", label: "Explore", icon: "🧭", emphasis: false },
  { to: "/events/new", label: "New event", icon: "＋", emphasis: true },
] as const;

const MOBILE_NAV = PRIMARY_NAV.map((item) => ({
  ...item,
  label: item.to === "/events/new" ? "Create" : item.label,
}));

/** Shared shell for signed-in pages. Sends signed-out visitors to /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { ready, me, logout } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const queryString = useSearchParams().toString();
  const search = queryString ? `?${queryString}` : "";
  const accountMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (ready && !me) router.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
  }, [ready, me, pathname, search, router]);

  useEffect(() => {
    const menu = accountMenuRef.current;
    if (!menu) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (menu.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") menu.open = false;
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    menu.open = false;

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [pathname, ready]);

  if (!ready || !me) {
    return <div className="loading" aria-busy="true">Loading SquadSync…</div>;
  }

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const handleLogout = () => {
    void logout().finally(() => router.replace("/login"));
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <header className="topbar">
        <Link href="/" className="topbar__logo" aria-label="SquadSync home">
          <img src="/logo.png" alt="SquadSync" width={150} height={38} />
        </Link>

        <nav className="topbar__nav" aria-label="Main navigation">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.to}
              href={item.to}
              className={`navlink${item.emphasis ? " navlink--action" : ""}`}
              aria-current={isActive(item.to) ? "page" : undefined}
            >
              {item.emphasis && <span className="navlink__plus" aria-hidden="true">＋</span>}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar__me">
          <details className="account-menu" ref={accountMenuRef}>
            <summary className="account-menu__trigger" aria-label={`Account menu for ${me.firstName}`}>
              <Avatar user={me} size={38} />
              <span className="account-menu__name">{me.firstName}</span>
              <span className="account-menu__chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="account-menu__panel">
              <div className="account-menu__identity">
                <strong>{me.firstName} {me.lastName}</strong>
                <span>{me.email}</span>
              </div>
              <Link href="/profile" className="account-menu__item">
                <span aria-hidden="true">🙂</span>
                My profile
              </Link>
              <button type="button" className="account-menu__item account-menu__logout" onClick={handleLogout}>
                <span aria-hidden="true">↪</span>
                Log out
              </button>
            </div>
          </details>
        </div>
      </header>

      <main className="page" id="main-content" tabIndex={-1}>
        {children}
      </main>

      <nav className="tabbar" aria-label="Main navigation">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.to}
            href={item.to}
            className={`tabbar__item${item.to === "/events/new" ? " tabbar__item--action" : ""}`}
            aria-current={isActive(item.to) ? "page" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
