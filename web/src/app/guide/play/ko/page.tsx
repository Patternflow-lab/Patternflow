import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { guideMetadata } from "@/components/guide/meta";

// Play: the first hour with a built Patternflow — 01 Flash to 04 Console.

export const metadata: Metadata = guideMetadata("play", "ko");

export const dynamic = "force-static";

export default function GuidePlayPageKo() {
  return <GuideExperience lang="ko" page="play" />;
}
