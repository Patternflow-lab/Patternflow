"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./Guide.module.css";
import { COPY, type SceneCopy, type StepCopy } from "./copy";
import { SCENES } from "./scenes";
import { useGuideStore, type GuideLang } from "./store";
import Extras from "./Extras";

// The page. A fixed stage behind, the story scrolling over it. The tracker
// below finds the step block nearest the middle of the viewport and hands
// its scene and index to the store; the stage takes it from there.

const GuideCanvas = dynamic(() => import("./stage/GuideCanvas"), { ssr: false });

function useScrollTracker(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const vh = window.innerHeight;
      const mid = vh * 0.5;
      const scenes = el.querySelectorAll<HTMLElement>("[data-scene]");
      let chosenScene = "opening";
      let chosenStep = 0;
      let chosenProgress = 0;
      scenes.forEach((scene) => {
        const r = scene.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height)));
        scene.style.setProperty("--p", p.toFixed(4));
        if (r.top <= mid && r.bottom > mid) {
          chosenScene = scene.dataset.scene ?? "opening";
          chosenProgress = p;
          // The step whose block is closest to the middle.
          let best = Infinity;
          scene.querySelectorAll<HTMLElement>("[data-step]").forEach((stepEl) => {
            const sr = stepEl.getBoundingClientRect();
            const c = sr.top + sr.height / 2;
            const d = Math.abs(c - mid);
            const on = sr.top < vh * 0.72 && sr.bottom > vh * 0.28;
            stepEl.dataset.on = on ? "1" : "0";
            if (d < best) {
              best = d;
              chosenStep = Number(stepEl.dataset.step);
            }
          });
        }
      });
      useGuideStore.getState().setScroll(chosenScene, chosenProgress, chosenStep);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const onResize = () => {
      useGuideStore.getState().setNarrow(window.innerWidth < 900);
      onScroll();
    };
    onResize();
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root]);
}

function Step({ copy, index, lang, noteBy }: { copy: StepCopy; index: number; lang: GuideLang; noteBy: string }) {
  return (
    <article className={styles.step} data-step={index} data-on="0">
      <div className={styles.card}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {copy.kicker}
        </p>
        <h3 className={styles.stepTitle}>{copy.title}</h3>
        {copy.body.map((p, i) => (
          <p key={i} className={styles.body}>
            {p}
          </p>
        ))}
        {copy.warn && <p className={styles.warn}>{copy.warn}</p>}
        {copy.extra && <Extras kind={copy.extra} lang={lang} />}
        {copy.note && (
          <aside className={styles.note}>
            <span className={styles.noteBy}>{noteBy}</span>
            {copy.note}
          </aside>
        )}
      </div>
    </article>
  );
}

function Chapter({ id, copy, lang, noteBy }: { id: string; copy: SceneCopy; lang: GuideLang; noteBy: string }) {
  return (
    <section className={styles.scene} data-scene={id} id={id}>
      <header className={styles.chapterHead}>
        <span className={styles.chapterNum} aria-hidden="true">
          {copy.num}
        </span>
        <h2 className={styles.chapterTitle}>{copy.title}</h2>
        <p className={styles.chapterLede}>{copy.lede}</p>
      </header>
      {copy.steps.map((step, i) => (
        <Step key={i} copy={step} index={i} lang={lang} noteBy={noteBy} />
      ))}
    </section>
  );
}

function ChapterRail({ lang }: { lang: GuideLang }) {
  const scene = useGuideStore((s) => s.scene);
  const copy = COPY[lang];
  const ids = ["flash", "knobs", "patterns", "console"];
  return (
    <nav className={styles.rail} aria-label="Chapters">
      {ids.map((id, i) => (
        <a key={id} href={`#${id}`} className={styles.railItem} data-active={scene === id ? "1" : "0"}>
          <span className={styles.railNum}>{String(i + 1).padStart(2, "0")}</span>
          <span className={styles.railLabel}>{copy.opening.chapters[i]}</span>
        </a>
      ))}
    </nav>
  );
}

export default function GuideExperience({ lang }: { lang: GuideLang }) {
  const copy = COPY[lang];
  const root = useRef<HTMLDivElement>(null);
  useScrollTracker(root);

  // The site's body is cream. Anything that shows it here — a fast scroll, an
  // overscroll bounce, the frame before the canvas paints — flashed the whole
  // screen white, so the document itself goes dark while the guide is open.
  useEffect(() => {
    const html = document.documentElement;
    const prev = { html: html.style.background, body: document.body.style.background, scheme: html.style.colorScheme };
    html.style.background = "#0a0908";
    document.body.style.background = "#0a0908";
    html.style.colorScheme = "dark";
    return () => {
      html.style.background = prev.html;
      document.body.style.background = prev.body;
      html.style.colorScheme = prev.scheme;
    };
  }, []);

  // Sanity: the copy and the script must agree on how many steps each scene has.
  if (process.env.NODE_ENV !== "production") {
    for (const def of SCENES) {
      const c = (copy as unknown as Record<string, SceneCopy | undefined>)[def.id];
      if (c?.steps && c.steps.length !== def.steps.length) {
        console.warn(`guide: scene ${def.id} has ${c.steps.length} copy steps but ${def.steps.length} script steps`);
      }
    }
  }

  return (
    <div className={styles.page} lang={lang} ref={root}>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.stageGlow} />
        <GuideCanvas />
        <div className={styles.grain} />
      </div>

      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          {copy.brand}
        </Link>
        <ChapterRail lang={lang} />
        <Link href={copy.langSwitch.href} className={styles.lang} hrefLang={lang === "en" ? "ko" : "en"}>
          {copy.langSwitch.label}
        </Link>
      </header>

      <main className={styles.story}>
        <section className={`${styles.scene} ${styles.opening}`} data-scene="opening" id="top">
          <article className={styles.openingInner} data-step={0} data-on="1">
            <p className={styles.openingKicker}>{copy.opening.kicker}</p>
            <h1 className={styles.openingTitle}>{copy.opening.title}</h1>
            <p className={styles.openingLede}>{copy.opening.lede}</p>
            <ol className={styles.openingChapters}>
              {copy.opening.chapters.map((c, i) => (
                <li key={c}>
                  <a href={`#${["flash", "knobs", "patterns", "console"][i]}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {c}
                  </a>
                </li>
              ))}
            </ol>
            <p className={styles.scrollCue}>
              <span aria-hidden="true" className={styles.scrollLine} />
              {copy.opening.scroll}
            </p>
          </article>
        </section>

        <Chapter id="flash" copy={copy.flash} lang={lang} noteBy={copy.ui.noteBy} />
        <Chapter id="knobs" copy={copy.knobs} lang={lang} noteBy={copy.ui.noteBy} />
        <Chapter id="patterns" copy={copy.patterns} lang={lang} noteBy={copy.ui.noteBy} />
        <Chapter id="console" copy={copy.console} lang={lang} noteBy={copy.ui.noteBy} />

        <section className={`${styles.scene} ${styles.next}`} data-scene="next" id="next">
          <article className={styles.nextInner} data-step={0} data-on="1">
            <h2 className={styles.nextTitle}>{copy.next.title}</h2>
            <p className={styles.nextLede}>{copy.next.lede}</p>
            <ul className={styles.soon}>
              {copy.next.soon.map((s, i) => (
                <li key={s}>
                  <span>{String(i + 5).padStart(2, "0")}</span>
                  {s}
                </li>
              ))}
            </ul>
            <div className={styles.nextLinks}>
              {copy.next.links.map((l) => (
                <a key={l.href} href={l.href} className={styles.nextLink}>
                  {l.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
