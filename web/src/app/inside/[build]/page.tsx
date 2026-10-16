import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeView from "@/components/HomeView";
import { builds, buildBySlug } from "@/components/sections/InsideGlobe/builds";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";

const SITE_URL = "https://patternflow.work";

type RouteParams = { params: Promise<{ build: string }> };

// One static page per pin, so every build on the map has its own link.
export function generateStaticParams() {
  return builds.map((build) => ({ build: build.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { build: slug } = await params;
  const build = buildBySlug(slug);
  if (!build) return {};

  const title = `${build.title} — ${build.maker} · ${build.location.label} | Patternflow`;
  const url = `${SITE_URL}/inside/${build.slug}`;
  const photo = build.images?.[0];

  return {
    title,
    description: build.description,
    alternates: { canonical: `/inside/${build.slug}` },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      title,
      description: build.description,
      url,
      // The build's own photo when it has one, the site's picture when not.
      ...(photo ? { images: [{ url: `${SITE_URL}${photo.src}`, alt: photo.alt }] } : {}),
    },
  };
}

export default async function InsideBuildPage({ params }: RouteParams) {
  const { build: slug } = await params;
  const build = buildBySlug(slug);
  if (!build) notFound();

  return <HomeView initialTab="inside" initialBuildId={build.id} />;
}
