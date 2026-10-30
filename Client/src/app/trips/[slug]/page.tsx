import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/server-catalog";
import { TripDetail } from "@/components/trip-detail";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = (await getCatalog()).packages.find((item) => item.slug === slug);
  return { title: t?.title || "Journey not found" };
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const data = await getCatalog();
  const t = data.packages.find((item) => item.slug === slug);
  const d = data.destinations.find((item) => item.id === t?.destinationId);
  if (!t || !d) notFound();
  return (
    <Suspense>
      <TripDetail trip={t} destination={d} />
    </Suspense>
  );
}
