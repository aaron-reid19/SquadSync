import type { ReactNode } from "react";
import logo from "../assets/logo.png";
import MapBackground from "./MapBackground";

interface Props {
  title: string;
  lead: string;
  wide?: boolean;
  children: ReactNode;
}

/** Shared shell for every account page: map background, card, logo, heading. */
export default function AuthLayout({ title, lead, wide, children }: Props) {
  return (
    <main className="login">
      <MapBackground />
      <section className={`login__card${wide ? " login__card--wide" : ""}`} aria-labelledby="auth-title">
        <img className="login__logo" src={logo} alt="SquadSync" width={320} />
        <h1 id="auth-title" className="login__title">{title}</h1>
        <p className="login__lead">{lead}</p>
        {children}
      </section>
    </main>
  );
}