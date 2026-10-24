import { lazy, Suspense } from "react";
import type { VenueMapProps } from "./VenueMapInner";

// Leaflet is big, so it loads only when a page actually shows a map.
const VenueMapInner = lazy(() => import("./VenueMapInner"));

export default function VenueMap(props: VenueMapProps) {
  return (
    <Suspense fallback={<div className="map map--loading">Loading map…</div>}>
      <VenueMapInner {...props} />
    </Suspense>
  );
}
