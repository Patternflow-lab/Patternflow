import type { MetadataRoute } from "next";
import { getAllJournalPosts } from "@/lib/journal";
import { builds } from "@/components/sections/InsideGlobe/builds";

const siteUrl = "https://patternflow.work";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/pattern`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/build`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/inside`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/roadmap`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    // The guide: the hub, then its four guides in order — Build (soldering
    // one from bare parts), Play (01 Flash to 04 Console), Make (the
    // community and Pattern Lab), Audio (the Audio edition: a browser tab,
    // the microphone, MIDI and a DAW).
    { url: `${siteUrl}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/guide/ko`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/guide/build`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/guide/build/ko`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/guide/play`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/guide/play/ko`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/guide/make`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/guide/make/ko`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/guide/audio`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/guide/audio/ko`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // The shelf of firmwares built on core. A device running an edition links
    // here from its own console, so this needs to be findable from outside too.
    // (/variants only redirects here.)
    { url: `${siteUrl}/editions`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // The catalogue of features, with a reel of each - the other axis of the shelf.
    { url: `${siteUrl}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    // Printed on the safety leaflet in every box as the address of the EU
    // declaration of conformity — it has to stay reachable and indexable.
    { url: `${siteUrl}/compliance`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/journal`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/journal/en`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ];

  // One entry per pin on the build map.
  const buildRoutes: MetadataRoute.Sitemap = builds.map((build) => ({
    url: `${siteUrl}/inside/${build.slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const journalRoutes: MetadataRoute.Sitemap = getAllJournalPosts().flatMap(
    (post) => {
      const lastModified = new Date(post.date);
      const languages = {
        ko: `${siteUrl}/journal/${post.slug}`,
        en: `${siteUrl}/journal/${post.slug}/en`,
      };

      return [
        {
          url: languages.ko,
          lastModified,
          changeFrequency: "monthly",
          priority: 0.6,
          alternates: { languages },
        },
        {
          url: languages.en,
          lastModified,
          changeFrequency: "monthly",
          priority: 0.6,
          alternates: { languages },
        },
      ];
    },
  );

  return [...staticRoutes, ...buildRoutes, ...journalRoutes];
}
