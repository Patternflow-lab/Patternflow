import { PAGES } from "./pages";
import { scenesOf } from "./scenes";
import type { GuidePageId } from "./store";

/**
 * Where a guide's words and its script disagree: a chapter with no scene, a
 * scene no chapter shows, or a different number of steps — in either
 * language — or a step whose card carries one thing in English and another
 * in Korean (its `extra`: a window, a set of captures). Empty when they line up. The page warns with these in
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
  const en = PAGES[page].text("en").chapters;
  const ko = PAGES[page].text("ko").chapters;
  for (const ch of en) {
    const twin = ko.find((c) => c.id === ch.id);
    if (!twin) continue;
    ch.copy.steps.forEach((step, i) => {
      const other = twin.copy.steps[i];
      if (other && step.extra !== other.extra) {
        out.push(`${page}: ${ch.id}-${i + 1} shows ${step.extra ?? "nothing"} in English and ${other.extra ?? "nothing"} in Korean`);
      }
    });
  }
  return out;
}
