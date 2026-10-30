import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/server-catalog";
import { Article } from "@/components/details";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { const { slug } = await params; const p = (await getCatalog()).journal.find(item => item.slug === slug); return { title: p?.title || "Story not found", description: p?.excerpt }; }
export default async function Page({ params }: Props) { const { slug } = await params; const p = (await getCatalog()).journal.find(item => item.slug === slug); if (!p) notFound(); return <Article post={p} />; }
