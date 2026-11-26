"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Renders browser-dependent children after hydration to avoid server/client markup mismatches. */
export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : null;
}