import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/server-catalog";
import { DestinationDetail } from "@/components/details";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const d = (await getCatalog()).destinations.find(
    (item) => item.slug === slug,
  );
  return {
    title: d?.name || "Destination not found",
    description: d?.description,
  };
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const d = (await getCatalog()).destinations.find(
    (item) => item.slug === slug,
  );
  if (!d) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Place",
            name: d.name,
            description: d.description,
            image: d.heroImage,
            address: { "@type": "PostalAddress", addressCountry: d.country },
            geo: {
              "@type": "GeoCoordinates",
              latitude: d.lat,
              longitude: d.lng,
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <DestinationDetail initial={d} />
    </>
  );
}
