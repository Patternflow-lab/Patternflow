import type { Metadata } from "next";
import HomeView from "@/components/HomeView";
import { INSIDE_PAGE_TITLE } from "@/components/sections/InsideGlobe/builds";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: INSIDE_PAGE_TITLE,
  description:
    "How Patternflow works: an ESP32-S3 driving a HUB75 RGB LED matrix, four rotary encoders, and a modular C++ pattern architecture — a contemporary reinterpretation of Nam June Paik's Participation TV.",
  alternates: { canonical: "/inside" },
  openGraph: {
    ...SITE_OPEN_GRAPH,
    title: INSIDE_PAGE_TITLE,
    description:
      "ESP32-S3, a HUB75 RGB LED matrix, four rotary encoders, and a modular C++ pattern architecture.",
    url: "https://patternflow.work/inside",
  },
};

export default function InsidePage() {
  return <HomeView initialTab="inside" />;
}
