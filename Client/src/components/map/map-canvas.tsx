"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapProps } from "./map-view";

function Bounds({ points, selectedId }: MapProps) {
  const map = useMap();
  const key = points.map(point => `${point.id}:${point.lat}:${point.lng}`).join("|");
  useEffect(() => {
    const selected = points.find(point => point.id === selectedId);
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (selected) map.flyTo([selected.lat, selected.lng], 12, { animate, duration: 1.2 });
    else if (points.length) map.fitBounds(L.latLngBounds(points.map(point => [point.lat, point.lng])), { padding: [48, 48], maxZoom: 13, animate });
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  // Coordinate key avoids moving the map when an unchanged array is re-created.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, selectedId]);
  return null;
}
export default function MapCanvas({ points, route, selectedId, onSelect }: MapProps) {
  const [tileError, setTileError] = useState(false);
  const icons = useMemo(() => points.map((_, i) => L.divIcon({ className: "wanderline-marker", html: `<div class="map-pin"><span>${i + 1}</span></div>`, iconSize: [32, 38], iconAnchor: [16, 35], popupAnchor: [0, -30] })), [points.length]);
  return <><MapContainer center={[24, 50]} zoom={3} minZoom={2} scrollWheelZoom={false} worldCopyJump>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true), load: () => setTileError(false) }} />
    <Bounds points={points} selectedId={selectedId} />
    {points.map((point, index) => <Marker key={point.id} position={[point.lat, point.lng]} icon={icons[index]} title={point.name} eventHandlers={{ click: () => onSelect?.(point.id) }}><Popup><h3>{point.name}</h3>{point.description && <p>{point.description}</p>}{point.href && <a href={point.href} style={{ display: "inline-block", marginTop: 10, color: "#1f6f8b" }}>Explore this place →</a>}<a href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=14/${point.lat}/${point.lng}`} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 10 }}>Open larger map ↗</a></Popup></Marker>)}
    {route && points.length > 1 && <Polyline positions={points.map(point => [point.lat, point.lng])} pathOptions={{ color: "#e07a5f", weight: 3, dashArray: "6 9" }} />}
  </MapContainer>{tileError && <div className="map-offline" role="status">Map tiles are unavailable. Place details and pins remain accessible.</div>}</>;
}
