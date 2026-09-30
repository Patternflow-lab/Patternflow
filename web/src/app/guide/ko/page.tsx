import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { COPY } from "@/components/guide/copy";

const copy = COPY.ko;

export const metadata: Metadata = {
  title: `${copy.meta.title} / Patternflow`,
  description: copy.meta.description,
  alternates: {
    canonical: "/guide/ko",
    languages: { en: "/guide", ko: "/guide/ko", "x-default": "/guide" },
  },
  openGraph: { title: copy.meta.title, description: copy.meta.description, url: "/guide/ko", locale: "ko_KR" },
};

export const dynamic = "force-static";

export default function GuidePageKo() {
  return <GuideExperience lang="ko" />;
}
