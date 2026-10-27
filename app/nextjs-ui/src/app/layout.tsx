import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { StoreProvider } from "@/lib/data/store";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "leaflet/dist/leaflet.css";
import "@/styles.css";
import "@/app.css";
import ClientOnly from "@/components/ClientOnly";

export const metadata: Metadata = {
  title: "SquadSync",
  referrer: "strict-origin-when-cross-origin",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <ClientOnly>
            <Suspense fallback={null}>{children}</Suspense>
          </ClientOnly>
        </StoreProvider>
      </body>
    </html>
  );
}