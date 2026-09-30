import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { COPY } from "@/components/guide/copy";

const copy = COPY.en;

export const metadata: Metadata = {
  title: `${copy.meta.title} / Patternflow`,
  description: copy.meta.description,
  alternates: {
    canonical: "/guide",
    languages: { en: "/guide", ko: "/guide/ko", "x-default": "/guide" },
  },
  openGraph: { title: copy.meta.title, description: copy.meta.description, url: "/guide" },
};

export const dynamic = "force-static";

export default function GuidePage() {
  return <GuideExperience lang="en" />;
}
