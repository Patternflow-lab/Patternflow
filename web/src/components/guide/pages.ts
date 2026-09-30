import { COPY, type ClosingCopy, type OpeningCopy, type SceneCopy } from "./copy";
import { MAKE_COPY } from "./copy/make";
import { COMMUNITY_COPY } from "./copy/community";
import { LAB_COPY } from "./copy/lab";
import { scenesOf } from "./scenes";
import type { GuideLang, GuidePageId } from "./store";

// The guide's pages. Each is one scroll over the same stage: an opening, its
// chapters, and an end. GuideExperience renders whichever it is given from
// here — the opening, the chapter list and the rail, the chapters, the end —
// and the stage plays that page's script (scenes.ts scenesOf). A chapter's
// id is its scene's id, its anchor (#lab) and its steps' anchors (#lab-1).
//
//   start  /guide       01 Flash · 02 Knobs · 03 Patterns · 04 Console
//   make   /guide/make  05 Community · 06 Pattern Lab
//
// Korean is the same page under /ko.

export type PageChapter = {
  /** The scene id: data-scene, #anchor, and the script's scene. */
  id: string;
  /** Its name on the rail and in the opening's list ("Flash"). */
  label: string;
  copy: SceneCopy;
};

export type PageText = {
  meta: { title: string; description: string };
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

function chapters(opening: OpeningCopy, list: [string, SceneCopy][]): PageChapter[] {
  return list.map(([id, copy], i) => ({ id, label: opening.chapters[i], copy }));
}

export const PAGES: Record<GuidePageId, PageDef> = {
  start: {
    id: "start",
    path: { en: "/guide", ko: "/guide/ko" },
    text: (lang) => {
      const c = COPY[lang];
      return {
        meta: c.meta,
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

/** Where a page of the guide is, in a language. */
export function pagePath(page: GuidePageId, lang: GuideLang): string {
  return PAGES[page].path[lang];
}

/**
 * Where a page's words and its script disagree: a chapter with no scene, a
 * scene no chapter shows, or a different number of steps — in either
 * language. Empty when they line up. The page warns with these in
 * development; pages.test.ts fails on them.
 */
export function scriptMismatches(page: GuidePageId): string[] {
  const out: string[] = [];
  const scenes = scenesOf(page);
  for (const lang of ["en", "ko"] as const) {
    const { opening, chapters } = PAGES[page].text(lang);
    if (opening.chapters.length !== chapters.length) {
      out.push(`${page}/${lang}: the opening names ${opening.chapters.length} chapters but the page has ${chapters.length}`);
    }
    for (const ch of chapters) {
      const def = scenes.find((s) => s.id === ch.id);
      if (!def) out.push(`${page}/${lang}: chapter ${ch.id} has no scene in the script (scenes.ts)`);
      else if (def.steps.length !== ch.copy.steps.length) {
        out.push(`${page}/${lang}: scene ${ch.id} has ${ch.copy.steps.length} copy steps but ${def.steps.length} script steps`);
      }
    }
    for (const def of scenes) {
      if (def.id === "opening" || def.id === "next") continue;
      if (!chapters.some((c) => c.id === def.id)) out.push(`${page}/${lang}: scene ${def.id} is in the script but not on the page`);
    }
  }
  return out;
}
