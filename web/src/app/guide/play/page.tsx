import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { guideMetadata } from "@/components/guide/meta";

// Play: the first hour with a built Patternflow — 01 Flash to 04 Console.

export const metadata: Metadata = guideMetadata("play", "en");

export const dynamic = "force-static";

export default function GuidePlayPage() {
  return <GuideExperience lang="en" page="play" />;
}
