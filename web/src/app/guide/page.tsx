import type { Metadata } from "next";
import GuideHub from "@/components/guide/GuideHub";
import { guideMetadata } from "@/components/guide/meta";

// The guide's front door: pick Build, Play, Make or Audio by where your Patternflow
// is (GuideHub). /guide used to be the Play guide; its old anchors
// (/guide#flash …) are sent on to /guide/play (components/guide/legacy.ts).

export const metadata: Metadata = guideMetadata("hub", "en");

export const dynamic = "force-static";

export default function GuideHubPage() {
  return <GuideHub lang="en" />;
}
