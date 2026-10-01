"use client";

import { useLayoutEffect } from "react";
import { useDocumentLang } from "../darkDocument";
import { useGuideStore, type GuideLang, type GuideScreen } from "../store";

/**
 * How a page of the guide says it is the one on screen. Every page under
 * /guide calls this once, from its root component: the hub (GuideHub) and
 * the three guides (GuideExperience).
 *
 * The stage is not the page's: it is mounted above the pages and stays up
 * between them (world/GuideWorld). This tells it whose script to play and in
 * which language (store.enterPage) — before the browser paints the page, so
 * the stage never plays the last page's script under the new page's words —
 * and tells the document its language.
 */
export function useGuidePage(page: GuideScreen, lang: GuideLang) {
  useLayoutEffect(() => {
    useGuideStore.getState().enterPage(page, lang);
  }, [page, lang]);
  useDocumentLang(lang);
}
