"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useLayoutEffect } from "react";
import styles from "./Guide.module.css";
import hub from "./Hub.module.css";
import { COPY } from "./copy";
import { HUB_COPY } from "./copy/hub";
import { GUIDE_ORDER, PAGES, pagePath } from "./pages";
import { hereFor, reportUrl } from "./report";
import { legacyGuideTarget } from "./legacy";
import { useDarkDocument, useDocumentLang } from "./darkDocument";
import type { GuideLang } from "./store";

// /guide: the hub. The reader picks a guide by where their Patternflow is —
// Build (soldering one from bare parts), Play (it's built), Make (it plays;
// now their own patterns and the extras) — in that order, each with its
// chapters, each chapter a way straight in. The 3D device turns beside the
// choices as it does on Play's opening (HubStage, loaded after the page), so
// the words never wait for it.
//
// /guide used to be the Play guide. Its old anchors (#flash, #knobs-3, …)
// are sent on to /guide/play (legacy.ts): on a page load by the root
// layout's script, before the hub is parsed; here when the hub is reached
// without one, before it paints.

const HubStage = dynamic(() => import("./HubStage"), { ssr: false });

function useLegacyAnchors() {
  useLayoutEffect(() => {
    const d = document.documentElement;
    const go = () => {
      const to = legacyGuideTarget(window.location.pathname, window.location.search, window.location.hash);
      if (!to) return;
      d.style.visibility = "hidden";
      window.location.replace(to);
    };
    // Back to the hub from the history the hash made: show it again.
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) d.style.visibility = "";
    };
    go();
    window.addEventListener("hashchange", go);
    window.addEventListener("pageshow", shown);
    return () => {
      window.removeEventListener("hashchange", go);
      window.removeEventListener("pageshow", shown);
    };
  }, []);
}

export default function GuideHub({ lang }: { lang: GuideLang }) {
  const copy = COPY[lang];
  const words = HUB_COPY[lang];
  const other: GuideLang = lang === "en" ? "ko" : "en";
  useLegacyAnchors();
  useDarkDocument();
  useDocumentLang(lang);

  return (
    <div className={styles.page} lang={lang}>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.stageGlow} />
        <HubStage />
        <div className={styles.grain} />
      </div>

      <header className={`${styles.top} ${hub.top}`}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>
            {copy.brand}
          </Link>
          <span className={styles.wip} title={copy.ui.wip}>
            WIP
          </span>
        </div>
        <Link href={pagePath("hub", other)} className={styles.lang} hrefLang={other}>
          {copy.langSwitch.label}
        </Link>
      </header>

      <main className={styles.story}>
        {/* data-scene / data-step: the stage frames the device in what this leaves free (GuideCanvas freeArea). */}
        <section className={`${styles.scene} ${hub.hub}`} data-scene="opening" id="top">
          <div className={hub.inner} data-step={0} data-on="1">
            <p className={hub.kicker}>{words.kicker}</p>
            <h1 className={hub.title}>{words.title}</h1>
            <p className={hub.lede}>{words.lede}</p>

            <ol className={hub.guides}>
              {GUIDE_ORDER.map((id) => {
                const text = PAGES[id].text(lang);
                const g = words.guides[id];
                const path = pagePath(id, lang);
                return (
                  <li key={id} className={hub.guide} data-guide={id}>
                    <div className={hub.head}>
                      <p className={hub.name}>{text.name}</p>
                      {/* The way in; it covers the whole card (Hub.module.css .go::after). */}
                      <Link href={path} className={hub.go}>
                        {g.go}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                    <h2 className={hub.situation}>{g.situation}</h2>
                    <p className={hub.about}>{g.about}</p>
                    <ol className={hub.chapters} aria-label={text.name}>
                      {text.chapters.map((c) => (
                        <li key={c.id}>
                          <Link href={`${path}#${c.id}`}>
                            <span>{c.copy.num}</span>
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ol>
                    {g.later && (
                      <p className={hub.later}>
                        <b>{g.later.label}</b>
                        {g.later.items.join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            <a
              className={styles.report}
              href={reportUrl("stuck", words.report.where)}
              target="_blank"
              rel="noopener noreferrer"
              title={copy.ui.report.hint}
              // The browser is only known here.
              onClick={(e) => {
                e.currentTarget.href = reportUrl("stuck", words.report.where, hereFor());
              }}
            >
              {words.report.label}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
