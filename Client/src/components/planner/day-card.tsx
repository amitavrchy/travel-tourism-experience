"use client";
import { useState } from "react";
import { Check, Clock3, MapPin, Pencil, X } from "lucide-react";
import type { Itinerary, Poi } from "@/lib/types";
import { Accordion } from "../details";

type Day = Itinerary["days"][number];
export function DayCard({ day, pois, onChange }: { day: Day; pois: Poi[]; onChange: (day: Day) => void }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(day);
  const begin = () => { setDraft(structuredClone(day)); setEditing(true); };
  return <Accordion number={day.day} title={day.theme} defaultOpen={day.day <= 2}>
    {editing ? <form className="day-edit-form" onSubmit={e => { e.preventDefault(); onChange(draft); setEditing(false); }}><label>Day theme<input value={draft.theme} maxLength={160} required minLength={2} onChange={e => setDraft({ ...draft, theme: e.target.value })} /></label>{draft.items.map((item, index) => <div className="edit-activity" key={index}><span className="eyebrow">{item.time} · {item.type}</span>{item.type === "poi" && <label>Choose a verified place<select value={item.sourceId} onChange={e => { const poi = pois.find(p => p.id === e.target.value); if (poi) setDraft({ ...draft, items: draft.items.map((p, n) => n === index ? { ...p, title: poi.name, lat: poi.lat, lng: poi.lng, sourceId: poi.id, notes: poi.description } : p) }); }}>{pois.map(poi => <option key={poi.id} value={poi.id}>{poi.name}</option>)}</select></label>}<label>{item.type === "poi" ? "Your notes" : item.title}<textarea value={item.notes} maxLength={1000} onChange={e => setDraft({ ...draft, items: draft.items.map((p, n) => n === index ? { ...p, notes: e.target.value } : p) })} /></label></div>)}<div className="day-edit-actions"><button type="button" className="button button-outline button-small" onClick={() => setEditing(false)}><X size={15} />Cancel</button><button className="button button-dark button-small"><Check size={15} />Keep these changes</button></div></form> : <><div className="itinerary-items">{day.items.map((item, index) => <div className="itinerary-item" key={`${index}-${item.title}`}><time><Clock3 size={12} />{item.time}</time><div><span className="item-type">{item.type === "poi" ? "EXPLORE" : item.type === "experience" ? "CONNECT" : item.type === "meal" ? "TASTE" : "SLOW DOWN"}</span><h4>{item.title}</h4><p>{item.notes}</p>{item.type === "poi" && <span className="item-coordinate"><MapPin size={11} />{item.lat.toFixed(3)}°, {item.lng.toFixed(3)}° · From destination notes</span>}</div></div>)}</div><button className="text-link edit-day-button" onClick={begin}><Pencil size={13} />Make this day yours</button></>}
  </Accordion>;
}
