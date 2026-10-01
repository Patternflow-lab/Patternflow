"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef } from "react";
import styles from "./Guide.module.css";
import { COPY, type StepCopy } from "./copy";
import { sceneById } from "./scenes";
import { useGuideStore, type GuideLang, type GuidePageId } from "./store";
import Extras from "./Extras";
import { hereFor, reportUrl } from "./report";
import { PAGES, pagePath, type PageChapter } from "./pages";
import { scriptMismatches } from "./checks";
import { useDeskFits } from "./desk/query";
import DeskCue from "./desk/DeskCue";
import { useDarkDocument, useDocumentLang } from "./darkDocument";
import { beatIndex, beatSeconds } from "./stage/build/beats";

// A guide (pages.ts: /guide/build is "build", /guide/play "play", /guide/make
// "make"; /guide itself is the hub, GuideHub). A fixed stage behind, the
// story scrolling over it. The tracker below finds the step block nearest
// the middle of the viewport and hands its scene and index to the store; the
// stage takes it from there, from this page's script.
//
// Build's and Play's stage is the 3D device (stage/GuideCanvas). Make's is a
// desk of app windows left of the story (desk/DeskStage) — the
// real Pattern Lab, a practice community, a practice AI, and a pointer that
// shows the way — on a screen big enough for it (desk/query.ts); below that
// it has no stage, and its cards show screenshots instead.

const GuideCanvas = dynamic(() => import("./stage/GuideCanvas"), { ssr: false });
const DeskStage = dynamic(() => import("./desk/DeskStage"), { ssr: false });

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
      const chosen = { el: null as HTMLElement | null };
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
              chosen.el = stepEl;
            }
          });
        }
      });
      // Is that step's card on screen yet? A chapter's first step is chosen
      // while the chapter's title is still in the middle of the screen, its
      // card a screen further down (store.ts cardIn). A chapter step's block
      // holds one card; the opening and the end are their own.
      const card = chosen.el && chosen.el.children.length === 1 ? chosen.el.firstElementChild : null;
      const cardIn = !card || card.getBoundingClientRect().top < vh * 0.86;
      useGuideStore.getState().setScroll(chosenScene, chosenProgress, chosenStep, cardIn);
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

/** A quiet line at the foot of a card, and at the end of the page: opens a GitHub issue that already says where. */
function Report({ label, hint, title, where, anchor }: { label: string; hint: string; title: string; where: string; anchor?: string }) {
  return (
    <a
      className={styles.report}
      href={reportUrl(title, where)}
      target="_blank"
      rel="noopener noreferrer"
      title={hint}
      // The link back to the step and the browser are only known here.
      onClick={(e) => {
        e.currentTarget.href = reportUrl(title, where, hereFor(anchor));
      }}
    >
      {label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

function Step({
  page,
  scene,
  copy,
  index,
  total,
  chapter,
  lang,
}: {
  page: GuidePageId;
  scene: string;
  copy: StepCopy;
  index: number;
  total: number;
  /** "Play · 01 Flash": the guide, then the chapter — every guide has an 01. */
  chapter: string;
  lang: GuideLang;
}) {
  // A step the reader has to watch loop (BOOT and RST) gets a longer block,
  // and its card holds still inside it (Guide.module.css, .step[data-dwell]).
  const script = sceneById(scene, page)?.steps[index];
  const dwell = script?.dwell;
  const ui = COPY[lang].ui;
  // A Build step's motion plays once, and reading the card takes longer than
  // most of them: the ones with something to watch can be played again.
  const beat = script && "build" in script ? script.build : undefined;
  const replayable = page === "build" && beat !== undefined && beatSeconds(beatIndex(beat)) >= 2.5;
  // Steps count from 1 where people see them: #flash-3 is the third.
  const anchor = `${scene}-${index + 1}`;
  return (
    <article
      id={anchor}
      className={styles.step}
      data-step={index}
      data-on="0"
      data-dwell={dwell ? "1" : undefined}
      style={dwell ? ({ "--dwell": dwell } as React.CSSProperties) : undefined}
    >
      <div className={styles.card}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {copy.kicker}
          {replayable && (
            <button type="button" className={styles.replay} onClick={() => useGuideStore.getState().replayStep()}>
              <span aria-hidden="true">↻</span>
              {ui.replay}
            </button>
          )}
        </p>
        <h3 className={styles.stepTitle}>{copy.title}</h3>
        {copy.body.map((p, i) => (
          <p key={i} className={styles.body}>
            {p}
          </p>
        ))}
        {copy.warn && <p className={styles.warn}>{copy.warn}</p>}
        {page === "make" && <DeskCue scene={scene} index={index} lang={lang} />}
        {copy.extra && <Extras kind={copy.extra} lang={lang} step={index} />}
        {copy.note && (
          <aside className={styles.note}>
            <span className={styles.noteBy}>{ui.noteBy}</span>
            {copy.note}
          </aside>
        )}
        <Report
          label={ui.report.step}
          hint={ui.report.hint}
          title={`${chapter} · ${index + 1} — ${copy.title}`}
          where={`${chapter} · ${index + 1}/${total} — ${copy.title}`}
          anchor={anchor}
        />
      </div>
    </article>
  );
}

function Chapter({
  page,
  guide,
  chapter: { id, label, copy },
  lang,
}: {
  page: GuidePageId;
  /** The guide's name ("Play"), for the "Stuck here?" issues. */
  guide: string;
  chapter: PageChapter;
  lang: GuideLang;
}) {
  const chapter = `${guide} · ${copy.num} ${label}`;
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
        <Step key={i} page={page} scene={id} copy={step} index={i} total={copy.steps.length} chapter={chapter} lang={lang} />
      ))}
    </section>
  );
}

function ChapterRail({ chapters }: { chapters: PageChapter[] }) {
  const scene = useGuideStore((s) => s.scene);
  return (
    <nav className={styles.rail} aria-label="Chapters">
      {chapters.map(({ id, label, copy }) => (
        <a key={id} href={`#${id}`} className={styles.railItem} data-active={scene === id ? "1" : "0"}>
          <span className={styles.railNum}>{copy.num}</span>
          <span className={styles.railLabel}>{label}</span>
        </a>
      ))}
    </nav>
  );
}

export default function GuideExperience({ lang, page = "play" }: { lang: GuideLang; page?: GuidePageId }) {
  const copy = COPY[lang];
  const { name, opening, chapters, next } = PAGES[page].text(lang);
  const other: GuideLang = lang === "en" ? "ko" : "en";
  const root = useRef<HTMLDivElement>(null);
  const deskFits = useDeskFits();

  // The stage plays this page's script, from its top: set before the canvas
  // draws a frame, and before the tracker below says where the reader is.
  // Coming from another page the board is the same one (store.ts getSim);
  // the Director puts it in this page's state on its first frame.
  useLayoutEffect(() => {
    useGuideStore.getState().enterPage(page);
  }, [page]);
  useScrollTracker(root);

  // The document goes dark while the guide is open, and says its language (darkDocument.ts).
  useDarkDocument();
  useDocumentLang(lang);

  // Sanity: the copy and the script must agree on how many steps each
  // chapter has, in both languages (pages.test.ts holds the same line).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const problem of scriptMismatches(page)) console.warn(`guide: ${problem}`);
  }, [page]);

  return (
    <div className={styles.page} lang={lang} ref={root} data-page={page}>
      {page === "make" ? (
        // The room only: the desk comes after the story, so the keyboard
        // reaches the cards first (each card's cue line can jump into it).
        <div className={styles.stage} aria-hidden="true">
          <div className={styles.stageGlow} />
          <div className={styles.grain} />
        </div>
      ) : (
        <div className={styles.stage} aria-hidden="true">
          <div className={styles.stageGlow} />
          <GuideCanvas />
          <div className={styles.grain} />
        </div>
      )}

      <header className={styles.top}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>
            {copy.brand}
          </Link>
          {/* The guide is shipped while it is still being written. */}
          <span className={styles.wip} title={copy.ui.wip}>
            WIP
          </span>
        </div>
        <ChapterRail chapters={chapters} />
        <Link href={pagePath(page, other)} className={styles.lang} hrefLang={other}>
          {copy.langSwitch.label}
        </Link>
      </header>

      <main className={styles.story}>
        <section className={`${styles.scene} ${styles.opening}`} data-scene="opening" id="top">
          <article className={styles.openingInner} data-step={0} data-on="1">
            <p className={styles.openingKicker}>{opening.kicker}</p>
            <h1 className={styles.openingTitle}>{opening.title}</h1>
            <p className={styles.openingLede}>{opening.lede}</p>
            <ol className={styles.openingChapters}>
              {chapters.map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`}>
                    <span>{c.copy.num}</span>
                    {c.label}
                  </a>
                </li>
              ))}
            </ol>
            {opening.back && (
              <p className={styles.openingBack}>
                <Link href={pagePath(opening.back.to, lang)}>
                  <span aria-hidden="true">←</span>
                  {opening.back.label}
                </Link>
              </p>
            )}
            <p className={styles.scrollCue}>
              <span aria-hidden="true" className={styles.scrollLine} />
              {opening.scroll}
            </p>
          </article>
        </section>

        {chapters.map((c) => (
          <Chapter key={c.id} page={page} guide={name} chapter={c} lang={lang} />
        ))}

        <section className={`${styles.scene} ${styles.next}`} data-scene="next" id="next">
          <article className={styles.nextInner} data-step={0} data-on="1">
            <h2 className={styles.nextTitle}>{next.title}</h2>
            <p className={styles.nextLede}>{next.lede}</p>
            {next.groups.map((g) => {
              const items = (
                <ul className={styles.soon}>
                  {g.items.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              );
              return (
                <div key={g.label} className={styles.soonGroup} data-later={g.later ? "1" : undefined}>
                  <p className={styles.soonLabel}>{g.label}</p>
                  {g.to ? (
                    // A guide that exists: the whole group is the way there.
                    <Link href={pagePath(g.to, lang)} className={styles.soonLink}>
                      {items}
                      <span className={styles.soonArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ) : (
                    items
                  )}
                </div>
              );
            })}
            <p className={styles.nextUntil}>{next.until}</p>
            <div className={styles.nextLinks}>
              {next.links.map((l) => (
                <a key={l.href} href={l.href} className={styles.nextLink}>
                  {l.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
            <Report
              label={copy.ui.report.general}
              hint={copy.ui.report.hint}
              title={next.report?.title ?? copy.ui.report.generalTitle}
              where={next.report?.where ?? copy.ui.report.generalWhere}
            />
          </article>
        </section>
      </main>

      {page === "make" && deskFits && <DeskStage lang={lang} />}
    </div>
  );
}
