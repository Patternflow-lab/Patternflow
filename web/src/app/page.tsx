import type { Metadata } from "next";
import HomeView from "@/components/HomeView";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";

// The <title> and description are the root layout's. The preview is here,
// not there, so that a page without one does not borrow the home page's.
export const metadata: Metadata = {
  openGraph: {
    ...SITE_OPEN_GRAPH,
    url: "https://patternflow.work",
    title: "Patternflow — An LED synthesizer",
    description:
      "An open-source LED synthesizer. Play light patterns with your fingertips — and every Patternflow plays every pattern we make.",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Patternflow is an open-source LED synthesizer. Play light with your fingertips.",
  },
};

export default function Home() {
  return <HomeView initialTab="hero" />;
}
