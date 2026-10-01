"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useLayoutEffect, useRef, useState, type RefObject } from "react";
import styles from "./Guide.module.css";
import hub from "./Hub.module.css";
import { COPY } from "./copy";
import { HUB_COPY } from "./copy/hub";
import { GUIDE_ORDER, PAGES, pagePath } from "./pages";
import { hereFor, reportUrl } from "./report";
import { legacyGuideTarget } from "./legacy";
import { useDarkDocument, useDocumentLang } from "./darkDocument";
import type { GuideLang, GuidePageId } from "./store";

// /guide: the hub. One glance, three ways in: Build (soldering one from bare
// parts), Play (it's built), Make (it plays; now their own patterns) — side
// by side in that order, each a number, a name and the one line a reader
// recognises themselves in. What a guide covers is its own opening's to say;
// here its chapter names only surface under the guide being pointed at. The
// 3D device stands alone above them, the page's one image (HubStage, loaded
// after the page, so the words never wait for it), and it answers the guide
// being pointed at.
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

// Where the choices start, from the top of the page: the stage is a box round
// what is above them (Hub.module.css .stageBox reads --hub-top).
function useChoicesTop(page: RefObject<HTMLElement | null>, choices: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = page.current;
    const el = choices.current;
    if (!root || !el) return;
    const measure = () => root.style.setProperty("--hub-top", `${Math.round(el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    // The choices grow and shrink with the window's width and with their fonts.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [page, choices]);
}

export default function GuideHub({ lang }: { lang: GuideLang }) {
  const copy = COPY[lang];
  const words = HUB_COPY[lang];
  const other: GuideLang = lang === "en" ? "ko" : "en";
  // The guide the reader is pointing at (mouse or keyboard): the device answers it (HubStage).
  const [guide, setGuide] = useState<GuidePageId | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  useLegacyAnchors();
  useDarkDocument();
  useDocumentLang(lang);
  useChoicesTop(page, choices);

  const leave = (id: GuidePageId) => setGuide((g) => (g === id ? null : g));

  return (
    <div ref={page} className={`${styles.page} ${hub.page}`} lang={lang}>
      <div className={styles.stage} aria-hidden="true">
        <div className={hub.glow} />
        <HubStage guide={guide} />
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
        {/* data-scene / data-step: what the stage frames the device against (GuideCanvas freeArea; Hub.module.css .frame). */}
        <section className={`${styles.scene} ${hub.hub}`} data-scene="opening" id="top">
          <div ref={choices} className={hub.inner}>
            <span className={hub.frame} data-step={0} aria-hidden="true" />
            <h1 className={hub.title}>
              <span className={hub.kicker}>{words.kicker}</span> {words.title}
            </h1>

            <ol className={hub.guides}>
              {GUIDE_ORDER.map((id, i) => {
                const text = PAGES[id].text(lang);
                const inside = `hub-${id}-inside`;
                return (
                  <li key={id} className={hub.guide} data-guide={id}>
                    <Link
                      href={pagePath(id, lang)}
                      className={hub.go}
                      aria-describedby={inside}
                      // Over, not enter: coming Back with the mouse where it
                      // clicked, the link arrives under a pointer that never
                      // left the page, and React makes no enter out of that
                      // — the column lit (CSS :hover) and the device did not answer.
                      onPointerOver={(e) => {
                        if (e.pointerType === "mouse") setGuide(id);
                      }}
                      onPointerLeave={() => leave(id)}
                      onFocus={() => setGuide(id)}
                      onBlur={() => leave(id)}
                    >
                      <span className={hub.num}>{String(i + 1).padStart(2, "0")}</span>
                      <span className={hub.name}>{text.name}</span>
                      <span className={hub.arrow} aria-hidden="true">
                        →
                      </span>
                      <span className={hub.situation}>{words.guides[id].situation}</span>
                    </Link>
                    {/* What is inside, for the guide being pointed at. A name never breaks in two: the line turns after its dot. */}
                    <p className={hub.inside} id={inside}>
                      {text.chapters.map((c, n) => (
                        <Fragment key={c.id}>
                          <span className={hub.chapter}>{n < text.chapters.length - 1 ? `${c.label} ·` : c.label}</span>{" "}
                        </Fragment>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ol>

            <a
              className={`${styles.report} ${hub.report}`}
              href={reportUrl("stuck", words.report.where)}
              target="_blank"
              rel="noopener noreferrer"
              title={copy.ui.report.hint}
              data-report
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
