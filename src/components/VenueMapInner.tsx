import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Area, Venue } from "../lib/data/types";
import { emojiFor } from "../lib/format";

export interface VenueMapProps {
  area?: Area;
  venues: Venue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  height?: number;
}

function pin(venue: Venue, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin${selected ? " map-pin--on" : ""}"><span>${emojiFor(venue.category)}</span></div>`,
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    tooltipAnchor: [0, -40],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function VenueMapInner({ area, venues, selectedId, onSelect, height = 340 }: VenueMapProps) {
  const points: [number, number][] = [
    ...(area ? [[area.lat, area.lng] as [number, number]] : []),
    ...venues.map((v) => [v.lat, v.lng] as [number, number]),
  ];
  const center: [number, number] = points[0] ?? [51.0447, -114.0719];

  return (
    <div className="map" style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {area && (
          <CircleMarker center={[area.lat, area.lng]} radius={11} pathOptions={{ color: "#fff", weight: 4, fillColor: "#59bfdf", fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -10]}>Meeting area: {area.name}</Tooltip>
          </CircleMarker>
        )}
        {venues.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={pin(v, v.id === selectedId)}
            zIndexOffset={v.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(v.id) }}
            keyboard
            title={v.name}
          >
            <Tooltip direction="top">{v.name}</Tooltip>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
