"use client";
import dynamic from "next/dynamic";
import { Compass } from "lucide-react";

export type MapPoint = { id: string; name: string; lat: number; lng: number; description?: string; href?: string };
export type MapProps = { points: MapPoint[]; route?: boolean; selectedId?: string; onSelect?: (id: string) => void };
const Canvas = dynamic(() => import("./map-canvas"), { ssr: false, loading: () => <div className="map-loading"><Compass size={22} className="spin" />Finding your bearings…</div> });
export function MapView(props: MapProps) {
  return <div className="map-frame" aria-label="Interactive map of places" role="region"><Canvas {...props} /></div>;
}
