import type { Metadata } from "next";
import GuideExperience from "@/components/guide/GuideExperience";
import { guideMetadata } from "@/components/guide/meta";

// Audio: the Audio edition, then a browser tab, the microphone, MIDI and a DAW.

export const metadata: Metadata = guideMetadata("audio", "en");

export const dynamic = "force-static";

export default function GuideAudioPage() {
  return <GuideExperience lang="en" page="audio" />;
}
