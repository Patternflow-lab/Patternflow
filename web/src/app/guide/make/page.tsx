import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { guideMetadata } from "@/components/guide/meta";

// Make: 01 Community and 02 Pattern Lab, hands-on on a desk of windows.

export const metadata: Metadata = guideMetadata("make", "en");

export const dynamic = "force-static";

export default function GuideMakePage() {
  return <GuideExperience lang="en" page="make" />;
}
