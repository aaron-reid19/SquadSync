"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/data/store";

const NAV = [
  { to: "/", label: "Main", icon: "🏠" },
  { to: "/explore", label: "Explore", icon: "🧭" },
  { to: "/events/new", label: "New event", icon: "➕" },
  { to: "/profile", label: "Profile", icon: "🙂" },
];

/** Shell for every logged-in page. Sends signed-out visitors to /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { ready, me, logout } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const queryString = useSearchParams().toString();
  const search = queryString ? `?${queryString}` : "";

  useEffect(() => {
    if (ready && !me) router.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
  }, [ready, me, pathname, search, router]);

  if (!ready || !me) {
    return <div className="loading" aria-busy="true">Loading SquadSync…</div>;
  }

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="topbar__logo" aria-label="SquadSync home">
          <img src="/logo.png" alt="SquadSync" width={150} height={38} />
        </Link>
        <nav className="topbar__nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} href={n.to} className="navlink" aria-current={isActive(n.to) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="topbar__me">
          <Link href="/profile" className="topbar__avatar" aria-label="Your profile"><Avatar user={me} size={38} /></Link>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => { logout(); router.replace("/login"); }}>
            Log out
          </button>
        </div>
      </header>

      <main className="page">
        {children}
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.to} href={n.to} className="tabbar__item" aria-current={isActive(n.to) ? "page" : undefined}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
