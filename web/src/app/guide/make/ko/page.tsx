import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { MAKE_COPY } from "@/components/guide/copy/make";

const copy = MAKE_COPY.ko;

export const metadata: Metadata = {
  title: `${copy.meta.title} / Patternflow`,
  description: copy.meta.description,
  alternates: {
    canonical: "/guide/make/ko",
    languages: { en: "/guide/make", ko: "/guide/make/ko", "x-default": "/guide/make" },
  },
  openGraph: { title: copy.meta.title, description: copy.meta.description, url: "/guide/make/ko", locale: "ko_KR" },
};

export const dynamic = "force-static";

export default function GuideMakePageKo() {
  return <GuideExperience lang="ko" page="make" />;
}
