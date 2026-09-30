import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { MAKE_COPY } from "@/components/guide/copy/make";

const copy = MAKE_COPY.en;

export const metadata: Metadata = {
  title: `${copy.meta.title} / Patternflow`,
  description: copy.meta.description,
  alternates: {
    canonical: "/guide/make",
    languages: { en: "/guide/make", ko: "/guide/make/ko", "x-default": "/guide/make" },
  },
  openGraph: { title: copy.meta.title, description: copy.meta.description, url: "/guide/make" },
};

export const dynamic = "force-static";

export default function GuideMakePage() {
  return <GuideExperience lang="en" page="make" />;
}
