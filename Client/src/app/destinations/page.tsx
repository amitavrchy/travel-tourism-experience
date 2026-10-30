import { Suspense } from "react";
import { DestinationListing } from "@/components/explore";
export const metadata = { title: "Destinations", description: "Find your somewhere. Explore thoughtfully chosen destinations in Asia and Europe." };
export default function Page() { return <Suspense fallback={<div className="container page-intro"><h1>Find your somewhere.</h1></div>}><DestinationListing /></Suspense>; }
