import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { Avatar } from "./Avatar";
import { useStore } from "../lib/data/store";

const NAV = [
  { to: "/", label: "Main", icon: "🏠" },
  { to: "/explore", label: "Explore", icon: "🧭" },
  { to: "/events/new", label: "New event", icon: "➕" },
  { to: "/profile", label: "Profile", icon: "🙂" },
];

/** Shell for every logged-in page. Sends signed-out visitors to /login. */
export default function AppLayout() {
  const { ready, me, logout } = useStore();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (ready && !me) navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }, [ready, me, pathname, search, navigate]);

  if (!ready || !me) {
    return <div className="loading" aria-busy="true">Loading SquadSync…</div>;
  }

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="topbar__logo" aria-label="SquadSync home">
          <img src={logo} alt="SquadSync" width={150} height={38} />
        </Link>
        <nav className="topbar__nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="navlink" aria-current={isActive(n.to) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="topbar__me">
          <Link to="/profile" className="topbar__avatar" aria-label="Your profile"><Avatar user={me} size={38} /></Link>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => { logout(); navigate("/login", { replace: true }); }}>
            Log out
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="tabbar__item" aria-current={isActive(n.to) ? "page" : undefined}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
