import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/server-catalog";
import { ExperienceDetail } from "@/components/details";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { const { slug } = await params; const e = (await getCatalog()).experiences.find(item => item.slug === slug); return { title: e?.title || "Experience not found", description: e?.summary }; }
export default async function Page({ params }: Props) { const { slug } = await params; const data = await getCatalog(); const e = data.experiences.find(item => item.slug === slug); const d = data.destinations.find(item => item.id === e?.destinationId); if (!e || !d) notFound(); return <ExperienceDetail experience={e} destination={d} />; }
