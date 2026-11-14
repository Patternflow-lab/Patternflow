import { journalShareImage } from "@/components/journal/shareImage";
import { getJournalSlugs } from "@/lib/journal";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// One card per post, drawn at build like the posts themselves. A card drawn
// on request reads content/journal, which is on disk while the site builds
// and nowhere inside a Cloudflare Worker.
export function generateStaticParams() {
  return getJournalSlugs().map((slug) => ({ slug }));
}

type OpenGraphImageProps = {
  params: Promise<{ slug: string }>;
};

export default async function OpenGraphImage({ params }: OpenGraphImageProps) {
  const { slug } = await params;
  return journalShareImage(slug, "ko");
}
