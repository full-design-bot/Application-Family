"use client";

// Carte Leaflet (chargée uniquement côté navigateur, via PlacesMap).

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { categoryEmoji } from "@/lib/places/categories";
import { BORDEAUX } from "@/lib/places/geo";
import type { Place } from "@/lib/types";

export interface MapPlace {
  id: string;
  name: string;
  category: Place["category"];
  lat: number;
  lng: number;
  status?: Place["status"];
}

const iconCache = new Map<string, L.DivIcon>();

function emojiIcon(emoji: string, done: boolean): L.DivIcon {
  const key = `${emoji}-${done}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: `<div style="width:40px;height:40px;border-radius:9999px;background:var(--card);border:2px solid ${
        done ? "var(--sage)" : "var(--accent)"
      };box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1">${emoji}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function FitBounds({ places, single }: { places: MapPlace[]; single?: boolean }) {
  const map = useMap();
  const key = places.map((p) => `${p.id}:${p.lat}:${p.lng}`).join("|");
  useEffect(() => {
    if (places.length === 0) return;
    if (places.length === 1 || single) {
      map.setView([places[0].lat, places[0].lng], single ? 15 : 14);
      return;
    }
    map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map, single]);
  return null;
}

export default function PlacesMapInner({
  places,
  onSelect,
  single,
  interactive = true,
  className,
}: {
  places: MapPlace[];
  onSelect?: (id: string) => void;
  single?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  const center = useMemo<[number, number]>(
    () => (places[0] && single ? [places[0].lat, places[0].lng] : [BORDEAUX.lat, BORDEAUX.lng]),
    [places, single],
  );
  return (
    // "isolate" : les calques Leaflet (z-index 400+) ne passent pas au-dessus de la barre d'onglets ni des feuilles
    <div className="isolate size-full">
    <MapContainer
      center={center}
      zoom={single ? 15 : 12}
      className={className}
      style={{ height: "100%", width: "100%", background: "var(--card-2)" }}
      scrollWheelZoom={interactive}
      dragging={interactive}
      touchZoom={interactive}
      doubleClickZoom={interactive}
      zoomControl={interactive}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={emojiIcon(categoryEmoji(p.category), p.status === "done")}
          title={p.name}
          alt={p.name}
          eventHandlers={onSelect ? { click: () => onSelect(p.id) } : undefined}
        />
      ))}
      <FitBounds places={places} single={single} />
    </MapContainer>
    </div>
  );
}
