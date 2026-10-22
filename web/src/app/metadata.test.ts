import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { SITE_OPEN_GRAPH } from "@/lib/siteMetadata";
import { guideMetadata } from "@/components/guide/meta";
import { PAGES, pagePath } from "@/components/guide/pages";
import { builds } from "@/components/sections/InsideGlobe/builds";
import type { GuideScreen } from "@/components/guide/store";

// A link pasted into a chat shows the page's own title, address and a
// picture. Next merges metadata one key deep, so the root layout's openGraph
// and twitter decide what every page without its own carries, and a page that
// sets openGraph keeps the picture only by spreading SITE_OPEN_GRAPH in.

// The pages render nothing here: only their metadata is read.
vi.mock("@/components/HomeView", () => ({ default: () => null }));
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "", className: "" });
  return { Inter: font, JetBrains_Mono: font, Silkscreen: font, Newsreader: font };
});

type OpenGraph = NonNullable<Metadata["openGraph"]>;

function urlOf(og: OpenGraph): string {
  return String(og.url ?? "");
}

describe("site metadata", () => {
  it("leaves each page's title and address to the page, in the root layout", async () => {
    const { metadata } = await import("@/app/layout");
    const og = metadata.openGraph as OpenGraph;
    expect(og).toEqual(SITE_OPEN_GRAPH);
    expect(og).not.toHaveProperty("title");
    expect(og).not.toHaveProperty("url");
    // Next copies a page's og:title into twitter:title only when no layout
    // set one.
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
  });

  it.each([
    ["/", () => import("@/app/page")],
    ["/pattern", () => import("@/app/pattern/page")],
    ["/build", () => import("@/app/build/page")],
    ["/build/breadboard", () => import("@/app/build/breadboard/layout")],
    ["/inside", () => import("@/app/inside/page")],
    ["/features", () => import("@/app/features/page")],
    ["/contact", () => import("@/app/contact/page")],
    ["/terms", () => import("@/app/terms/page")],
    ["/update", () => import("@/app/update/page")],
  ] as const)("%s previews with its own address and the site's picture", async (path, load) => {
    const { metadata } = (await load()) as { metadata: Metadata };
    const og = metadata.openGraph as OpenGraph;
    expect(og.images).toEqual(SITE_OPEN_GRAPH.images);
    expect(urlOf(og).replace("https://patternflow.work", "") || "/").toBe(path);
  });

  it("gives /build/breadboard a title of its own", async () => {
    const { metadata } = await import("@/app/build/breadboard/layout");
    expect(metadata.title).toBe("Breadboard Build Guide / Patternflow");
  });

  it("gives every guide page, in both languages, the site's picture", () => {
    const screens: GuideScreen[] = ["hub", ...(Object.keys(PAGES) as GuideScreen[])];
    for (const page of screens) {
      for (const lang of ["en", "ko"] as const) {
        const og = guideMetadata(page, lang).openGraph as OpenGraph;
        expect(og.images).toEqual(SITE_OPEN_GRAPH.images);
        expect(urlOf(og)).toBe(pagePath(page, lang));
      }
    }
  });

  it("previews a build on the map with its photo, or the site's picture without one", async () => {
    const { generateMetadata } = await import("@/app/inside/[build]/page");
    const ogOf = async (slug: string) =>
      (await generateMetadata({ params: Promise.resolve({ build: slug }) })).openGraph as OpenGraph;

    const withPhoto = builds.find((b) => b.images?.length);
    expect(withPhoto).toBeDefined();
    expect(await ogOf(withPhoto!.slug)).toMatchObject({
      images: [{ url: `https://patternflow.work${withPhoto!.images![0].src}` }],
      url: `https://patternflow.work/inside/${withPhoto!.slug}`,
    });

    const withoutPhoto = builds.find((b) => !b.images?.length);
    if (withoutPhoto) {
      expect((await ogOf(withoutPhoto.slug)).images).toEqual(SITE_OPEN_GRAPH.images);
    }
  });
});
