import type { Metadata } from "next";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";

// The metadata lives here from when page.tsx was a client component, which
// cannot export it. Without it the guide's browser tab and its link preview
// were the home page's.
export const metadata: Metadata = {
  title: "Breadboard Build Guide / Patternflow",
  description:
    "Build Patternflow with no custom PCB: one snapped-off breadboard power strip and a handful of jumper wires. The guide leads with the picture, because the wiring is the hard part.",
  alternates: { canonical: "/build/breadboard" },
  openGraph: { ...SITE_OPEN_GRAPH, url: "/build/breadboard" },
};

export default function BreadboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
