"use client";

import dynamic from "next/dynamic";
import type { VenueMapProps } from "./VenueMapInner";

// Leaflet touches `window`, so it must never run during server rendering.
const VenueMapInner = dynamic(() => import("./VenueMapInner"), {
  ssr: false,
  loading: () => <div className="map map--loading">Loading map…</div>,
});

export default function VenueMap(props: VenueMapProps) {
  return <VenueMapInner {...props} />;
}
