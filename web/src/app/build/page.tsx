import type { Metadata } from "next";
import HomeView from "@/components/HomeView";

export const metadata: Metadata = {
  title: "Build Your Own — Patternflow",
  description:
    "Build the open-source Patternflow LED synthesizer from scratch: the hand-soldered v3.9 board, a printed or laser-cut case, and firmware flashed from the browser. Every file and the full build guide.",
  alternates: { canonical: "/build" },
  openGraph: {
    title: "Build Your Own — Patternflow",
    description:
      "Build the open-source Patternflow LED synthesizer from scratch — firmware, PCB, a printed or laser-cut case, and the browser flasher.",
    url: "https://patternflow.work/build",
  },
};

export default function BuildPage() {
  return <HomeView initialTab="build" />;
}
