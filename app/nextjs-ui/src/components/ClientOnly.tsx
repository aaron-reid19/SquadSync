"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Renders its children only in the browser. The app's data lives in localStorage, so there is nothing useful to server-render. */
export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : null;
}