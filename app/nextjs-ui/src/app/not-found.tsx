"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Same as the old catch-all route: unknown addresses go to the main page.
export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
