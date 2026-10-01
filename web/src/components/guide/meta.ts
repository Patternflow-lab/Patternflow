import type { Metadata } from "next";
import { PAGES, pagePath } from "./pages";
import { HUB_COPY } from "./copy/hub";
import type { GuideLang, GuideScreen } from "./store";

/**
 * A guide page's metadata (app/guide/**): its title and description in the
 * page's language, its own address as canonical, and the other language's as
 * an alternate — English is the x-default.
 */
export function guideMetadata(page: GuideScreen, lang: GuideLang): Metadata {
  const meta = page === "hub" ? HUB_COPY[lang].meta : PAGES[page].text(lang).meta;
  const en = pagePath(page, "en");
  const ko = pagePath(page, "ko");
  const url = lang === "en" ? en : ko;
  return {
    title: `${meta.title} / Patternflow`,
    description: meta.description,
    alternates: { canonical: url, languages: { en, ko, "x-default": en } },
    openGraph: { title: meta.title, description: meta.description, url, ...(lang === "ko" ? { locale: "ko_KR" } : {}) },
  };
}
