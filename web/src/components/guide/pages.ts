import { COPY, type ClosingCopy, type OpeningCopy, type SceneCopy } from "./copy";
import { BUILD_COPY } from "./copy/build";
import { MAKE_COPY } from "./copy/make";
import { COMMUNITY_COPY } from "./copy/community";
import { LAB_COPY } from "./copy/lab";
import type { GuideLang, GuidePageId, GuideScreen } from "./store";

// The guide: a hub and three guides. The hub (/guide, GuideHub) is where the
// reader picks one by where they are; each guide is one scroll over a stage:
// an opening, its chapters, and an end. GuideExperience renders whichever it
// is given from here — the opening, the chapter list and the rail, the
// chapters, the end — and the stage plays that guide's script (scenes.ts
// scenesOf). A chapter's id is its scene's id, its anchor (#knobs) and its
// steps' anchors (#knobs-1). Each guide numbers its own chapters from 01.
//
//   build  /guide/build  soldering a Patternflow from bare parts (copy/build.ts)
//   play   /guide/play   01 Flash · 02 Knobs · 03 Patterns · 04 Console
//   make   /guide/make   01 Community · 02 Pattern Lab
//
// Korean is the same page under /ko. The copy/script check is checks.ts:
// this file holds words only, so the hub can read the chapter lists without
// the stage's script.

export type PageChapter = {
  /** The scene id: data-scene, #anchor, and the script's scene. */
  id: string;
  /** Its name on the rail and in the opening's list ("Flash"). */
  label: string;
  copy: SceneCopy;
};

export type PageText = {
  meta: { title: string; description: string };
  /** The guide's name ("Play"): in the hub, and in a "Stuck here?" issue's where. */
  name: string;
  opening: OpeningCopy;
  chapters: PageChapter[];
  next: ClosingCopy;
};

export type PageDef = {
  id: GuidePageId;
  /** The page's address in each language. */
  path: Record<GuideLang, string>;
  text: (lang: GuideLang) => PageText;
};

/** The guides, in the order a reader goes through them. */
export const GUIDE_ORDER: readonly GuidePageId[] = ["build", "play", "make"];

/** The hub's address in each language. */
export const HUB_PATH: Record<GuideLang, string> = { en: "/guide", ko: "/guide/ko" };

function chapters(opening: OpeningCopy, list: [string, SceneCopy][]): PageChapter[] {
  return list.map(([id, copy], i) => ({ id, label: opening.chapters[i], copy }));
}

export const PAGES: Record<GuidePageId, PageDef> = {
  build: {
    id: "build",
    path: { en: "/guide/build", ko: "/guide/build/ko" },
    text: (lang) => {
      const c = BUILD_COPY[lang];
      return {
        meta: c.meta,
        name: c.name,
        opening: c.opening,
        chapters: chapters(
          c.opening,
          c.chapters.map((ch) => [ch.id, ch.copy]),
        ),
        next: c.next,
      };
    },
  },
  play: {
    id: "play",
    path: { en: "/guide/play", ko: "/guide/play/ko" },
    text: (lang) => {
      const c = COPY[lang];
      return {
        meta: c.meta,
        name: c.name,
        opening: c.opening,
        chapters: chapters(c.opening, [
          ["flash", c.flash],
          ["knobs", c.knobs],
          ["patterns", c.patterns],
          ["console", c.console],
        ]),
        next: c.next,
      };
    },
  },
  make: {
    id: "make",
    path: { en: "/guide/make", ko: "/guide/make/ko" },
    text: (lang) => {
      const c = MAKE_COPY[lang];
      return {
        meta: c.meta,
        name: c.name,
        opening: c.opening,
        chapters: chapters(c.opening, [
          ["community", COMMUNITY_COPY[lang]],
          ["lab", LAB_COPY[lang]],
        ]),
        next: c.next,
      };
    },
  },
};

/** Where a page of the guide is — a guide, or the hub — in a language. */
export function pagePath(page: GuideScreen, lang: GuideLang): string {
  return page === "hub" ? HUB_PATH[lang] : PAGES[page].path[lang];
}

/**
 * The page of the guide an address is, and its language — the other way
 * round from pagePath — or null for an address that is not the guide's. The
 * world (world/GuideWorld) reads the address for what it can know before a
 * page has mounted: which room to light on the server's first paint.
 */
export function screenAt(pathname: string): { page: GuideScreen; lang: GuideLang } | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const lang of ["en", "ko"] as const) {
    if (HUB_PATH[lang] === path) return { page: "hub", lang };
    for (const page of GUIDE_ORDER) if (PAGES[page].path[lang] === path) return { page, lang };
  }
  return null;
}

/**
 * Where the reader is on a guide, as an anchor: "#flash-3" for a step whose
 * card is on screen, "#flash" for a chapter's title, "#next" for the end, and
 * nothing at the opening. A link to the same guide in the other language
 * carries it (world/GuideLink), so switching language keeps the place.
 */
export function placeAnchor(scene: string, step: number, cardIn: boolean): string {
  if (scene === "opening") return "";
  if (scene === "next") return "#next";
  return cardIn ? `#${scene}-${step + 1}` : `#${scene}`;
}
