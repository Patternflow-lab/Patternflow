import type { Metadata } from "next";

// What a link to any page carries when it is pasted into a chat or a post.
//
// Next merges metadata one key deep: a page that sets openGraph replaces the
// root layout's openGraph whole, picture and all ("Overwriting fields" in
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
// generate-metadata.md). So a page that names its own preview spreads this in
// first. A page that sets no openGraph inherits this as it is, and Next fills
// og:title and og:description from the page's own title and description.
//
// The root layout's openGraph is this and nothing more. Until 16 October
// 2026 it also carried the home page's title and address, and /features,
// /editions, /roadmap and every other page that sets no openGraph previewed
// as the home page.
export const SITE_OPEN_GRAPH = {
  type: "website",
  siteName: "Patternflow",
  images: [
    {
      url: "/og-image.png",
      width: 1200,
      height: 630,
      type: "image/png",
    },
  ],
} satisfies NonNullable<Metadata["openGraph"]>;
