"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Renders its children only in the browser for components that explicitly need browser APIs. */
export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : null;
}
