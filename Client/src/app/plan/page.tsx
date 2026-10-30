import { Suspense } from "react";
import { Wizard } from "@/components/planner/wizard";
export const metadata = { title: "Compose your journey", description: "Your kind of trip, one of a kind. Build a personal itinerary around your interests, pace and budget." };
export default function Page() { return <Suspense fallback={<div className="container section"><div className="skeleton" style={{ height: 500 }} /></div>}><Wizard /></Suspense>; }
