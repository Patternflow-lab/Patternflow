import type { MetadataRoute } from "next";
import { getAllJournalPosts } from "@/lib/journal";
import { builds } from "@/components/sections/InsideGlobe/builds";

const siteUrl = "https://patternflow.work";

type Entry = MetadataRoute.Sitemap[number];

// A page and its twin in the other language, each naming both. The pages say
// the same in their own <head> (hreflang, English as x-default); the sitemap
// listed the two as if they were unrelated.
function languagePair(
  en: string,
  ko: string,
  rest: Pick<Entry, "lastModified" | "changeFrequency">,
  priority: { en: number; ko: number },
): MetadataRoute.Sitemap {
  const languages = {
    en: `${siteUrl}${en}`,
    ko: `${siteUrl}${ko}`,
    "x-default": `${siteUrl}${en}`,
  };
  return [
    { url: languages.en, ...rest, priority: priority.en, alternates: { languages } },
    { url: languages.ko, ...rest, priority: priority.ko, alternates: { languages } },
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const monthly = { lastModified: now, changeFrequency: "monthly" } as const;
  const weekly = { lastModified: now, changeFrequency: "weekly" } as const;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/pattern`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/build`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/build/breadboard`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/inside`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/roadmap`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    // The guide: the hub, then its four guides in order — Build (soldering
    // one from bare parts), Play (01 Flash to 04 Console), Make (the
    // community and Pattern Lab), Audio (the Audio edition: a browser tab,
    // the microphone, MIDI and a DAW).
    ...languagePair("/guide", "/guide/ko", monthly, { en: 0.8, ko: 0.7 }),
    ...languagePair("/guide/build", "/guide/build/ko", monthly, { en: 0.7, ko: 0.6 }),
    ...languagePair("/guide/play", "/guide/play/ko", monthly, { en: 0.8, ko: 0.7 }),
    ...languagePair("/guide/make", "/guide/make/ko", monthly, { en: 0.7, ko: 0.6 }),
    ...languagePair("/guide/audio", "/guide/audio/ko", monthly, { en: 0.7, ko: 0.6 }),
    // The shelf of firmwares built on core. A device running an edition links
    // here from its own console, so this needs to be findable from outside too.
    // (/variants only redirects here.)
    { url: `${siteUrl}/editions`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // The catalogue of features, with a reel of each - the other axis of the shelf.
    { url: `${siteUrl}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // Where a device's console sends you when a newer firmware exists.
    { url: `${siteUrl}/update`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // Printed on the safety leaflet in every box as the address of the EU
    // declaration of conformity — it has to stay reachable and indexable.
    { url: `${siteUrl}/compliance`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // The journal's index: Korean at /journal, English at /journal/en.
    ...languagePair("/journal/en", "/journal", weekly, { en: 0.7, ko: 0.7 }),
  ];

  // One entry per pin on the build map.
  const buildRoutes: MetadataRoute.Sitemap = builds.map((build) => ({
    url: `${siteUrl}/inside/${build.slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const journalRoutes: MetadataRoute.Sitemap = getAllJournalPosts().flatMap((post) =>
    languagePair(
      `/journal/${post.slug}/en`,
      `/journal/${post.slug}`,
      { lastModified: new Date(post.date), changeFrequency: "monthly" },
      { en: 0.6, ko: 0.6 },
    ),
  );

  return [...staticRoutes, ...buildRoutes, ...journalRoutes];
}
