import { journalShareImage } from "@/components/journal/shareImage";
import { getJournalSlugs } from "@/lib/journal";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Drawn at build, as the Korean card is (../opengraph-image.tsx).
export function generateStaticParams() {
  return getJournalSlugs().map((slug) => ({ slug }));
}

type OpenGraphImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { slug } = await params;
  return journalShareImage(slug, "en");
}
