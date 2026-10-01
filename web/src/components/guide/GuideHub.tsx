"use client";

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import styles from "./Guide.module.css";
import hub from "./Hub.module.css";
import { COPY } from "./copy";
import { HUB_COPY } from "./copy/hub";
import { GUIDE_ORDER, PAGES } from "./pages";
import { hereFor, reportUrl } from "./report";
import { legacyGuideTarget } from "./legacy";
import { useGuideStore, type GuideLang, type GuidePageId } from "./store";
import GuideLink from "./world/GuideLink";
import { useGuidePage } from "./world/usePage";
import Preloader from "./ui/Preloader";
import Words from "./ui/Words";
import { usePanelTint } from "./ui/panelTint";

// /guide: the hub. One glance, three ways in: Build (soldering one from bare
// parts), Play (it's built), Make (it plays; now their own patterns) — side
// by side in that order, each a number, a name and the one line a reader
// recognises themselves in. What a guide covers is its own opening's to say;
// here its chapter names only surface under the guide being pointed at. The
// 3D device stands alone above them, the page's one image, and it answers
// the guide being pointed at.
//
// The device is not this page's: the stage is mounted above the pages, once
// for the whole guide (world/GuideWorld — loaded after the page, so the
// words never wait for it), and the hub is one of the pages that play on it.
// This page tells the stage three things, all through the store: that the
// hub is on screen (useGuidePage), where its choices start (setHubTop — the
// device is framed above them, world/framing.ts), and which guide the reader
// is pointing at (setPreview). The answers are the stage's (world/HubAnswers,
// stage/Explode): Build — the device comes apart; Play — K1 turns and the
// pattern follows; Make — the pattern is made again and again. Choosing a
// guide (GuideLink) holds its answer while the words leave, and the guide's
// opening takes it from there: the parts settle, the camera pushes in, the
// device stands back for the desk.
//
// /guide used to be the Play guide. Its old anchors (#flash, #knobs-3, …)
// are sent on to /guide/play (legacy.ts): on a page load by the root
// layout's script, before the hub is parsed; here when the hub is reached
// without one, before it paints.

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

// Where the choices start, from the top of the page: the stage frames the
// device in what is above them, and fades its floor out behind them
// (store.hubTop → world/framing.ts hubFraming, Guide.module.css --hub-top).
function useChoicesTop(choices: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = choices.current;
    if (!el) return;
    const measure = () => useGuideStore.getState().setHubTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    measure();
    // The choices grow and shrink with the window's width and with their fonts.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [choices]);
}

/** The guide being pointed at, for the stage (store.preview). */
function point(id: GuidePageId) {
  useGuideStore.getState().setPreview(id);
}
function pointAway(id: GuidePageId) {
  const s = useGuideStore.getState();
  if (s.preview === id) s.setPreview(null);
}

export default function GuideHub({ lang }: { lang: GuideLang }) {
  const copy = COPY[lang];
  const words = HUB_COPY[lang];
  const other: GuideLang = lang === "en" ? "ko" : "en";
  const root = useRef<HTMLDivElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  useLegacyAnchors();
  useGuidePage("hub", lang);
  useChoicesTop(choices);
  // The page's accent follows the colour on the panel (ui/panelTint.ts).
  usePanelTint(root);
  // Nothing is pointed at once the hub is gone (the store outlives it; a guide's own arrival clears it too).
  useEffect(() => () => useGuideStore.setState({ preview: null }), []);

  return (
    <div className={`${styles.page} ${hub.page}`} lang={lang} ref={root}>
      {/* The first visit's cover, while the stage loads (ui/Preloader). */}
      <Preloader />
      <header className={`${styles.top} ${hub.top}`}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>
            {copy.brand}
          </Link>
          <span className={styles.wip} title={copy.ui.wip}>
            WIP
          </span>
        </div>
        <GuideLink to="hub" lang={other} className={styles.lang} hrefLang={other}>
          {copy.langSwitch.label}
        </GuideLink>
      </header>

      <main className={styles.story}>
        <section className={`${styles.scene} ${hub.hub}`} data-scene="opening" id="top">
          <div ref={choices} className={hub.inner} data-leaves="">
            <h1 className={hub.title}>
              <span className={hub.kicker}>{words.kicker}</span> {words.title}
            </h1>

            <ol className={hub.guides}>
              {GUIDE_ORDER.map((id, i) => {
                const text = PAGES[id].text(lang);
                const inside = `hub-${id}-inside`;
                return (
                  <li key={id} className={hub.guide} data-guide={id}>
                    <GuideLink
                      to={id}
                      lang={lang}
                      className={hub.go}
                      aria-describedby={inside}
                      // Over, not enter: coming Back with the mouse where it
                      // clicked, the link arrives under a pointer that never
                      // left the page, and React makes no enter out of that
                      // — the column lit (CSS :hover) and the device did not answer.
                      onPointerOver={(e) => {
                        if (e.pointerType === "mouse") point(id);
                      }}
                      onPointerLeave={() => pointAway(id)}
                      onFocus={() => point(id)}
                      onBlur={() => pointAway(id)}
                    >
                      <span className={hub.num}>{String(i + 1).padStart(2, "0")}</span>
                      <span className={`${hub.name} ${styles.wordsNow}`}>
                        <Words text={text.name} />
                      </span>
                      <span className={hub.arrow} aria-hidden="true">
                        →
                      </span>
                      <span className={hub.situation}>{words.guides[id].situation}</span>
                    </GuideLink>
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
