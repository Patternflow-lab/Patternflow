import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { guideMetadata } from "@/components/guide/meta";
import { BomProvider } from "@/components/guide/build/BomContext";
import { readBom } from "@/components/guide/build/bom.server";

// Build: soldering a Patternflow from bare parts, on the 3D stage. Its parts
// list is the BOM file, read here when the page is built (build/bom.server.ts).

export const metadata: Metadata = guideMetadata("build", "en");

export const dynamic = "force-static";

export default function GuideBuildPage() {
  return (
    <BomProvider rows={readBom()}>
      <GuideExperience lang="en" page="build" />
    </BomProvider>
  );
}
