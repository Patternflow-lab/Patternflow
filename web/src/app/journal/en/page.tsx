import type { Metadata } from "next";
import JournalIndex from "@/components/journal/JournalIndex";
import { getAllJournalPosts } from "@/lib/journal";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: "Journal / Patternflow",
  description: "Writing and notes from Patternflow.",
  alternates: {
    canonical: "/journal/en",
    languages: {
      ko: "/journal",
      en: "/journal/en",
      "x-default": "/journal/en",
    },
  },
  openGraph: { ...SITE_OPEN_GRAPH, url: "/journal/en" },
};

export default function EnglishJournalPage() {
  const lang = "en";
  const posts = getAllJournalPosts({ lang });

  return <JournalIndex posts={posts} lang={lang} />;
}
