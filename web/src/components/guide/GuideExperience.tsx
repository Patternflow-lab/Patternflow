"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import styles from "./Guide.module.css";
import { COPY, type StepCopy } from "./copy";
import { sceneById } from "./scenes";
import { useGuideStore, type GuideLang, type GuidePageId } from "./store";
import Extras from "./Extras";
import { hereFor, reportUrl } from "./report";
import { PAGES, type PageChapter } from "./pages";
import { scriptMismatches } from "./checks";
import { useDeskFits } from "./desk/query";
import DeskCue from "./desk/DeskCue";
import { beatIndex, beatSeconds } from "./stage/build/beats";
import GuideLink from "./world/GuideLink";
import { useGuidePage } from "./world/usePage";
import Preloader from "./ui/Preloader";
import Words from "./ui/Words";
import { usePanelTint } from "./ui/panelTint";
import { useReveal } from "./ui/useReveal";
import { useStepKeys } from "./ui/useStepKeys";

// A guide (pages.ts: /guide/build is "build", /guide/play "play", /guide/make
// "make"; /guide itself is the hub, GuideHub). A fixed stage behind, the
// story scrolling over it. The tracker below finds the step block nearest
// the middle of the viewport and hands its scene and index to the store; the
// stage takes it from there, from this page's script.
//
// The stage is not this page's. Build's and Play's is the 3D device, and it
// is mounted above the pages, once for the whole guide (world/GuideWorld,
// stage/GuideCanvas): this page says it is the one on screen (useGuidePage)
// and the stage, already up if the reader came from the hub or another
// guide, plays its script. Make's is a desk of app windows left of the story
// (desk/DeskStage) — the real Pattern Lab, a practice community, a practice
// AI, and a pointer that shows the way — on a screen big enough for it
// (desk/query.ts); below that it has no stage, and its cards show
// screenshots instead. The device leaves as the desk comes up.
//
// The ways to the guide's other pages are GuideLinks: the words leave, the
// stage stays, the next page comes in. What is this page's alone — each
// block of the story, the chapter rail, the desk — is marked [data-leaves]
// for that (Guide.module.css).
//
// How the page moves is the sheet's (Guide.module.css); what it needs from
// here is small. The first screen's lines and words arrive as the page does.
// A chapter's number rolls in and its title's words rise the first time the
// reader reaches them (ui/useReveal marks the block, once). A card's lines
// arrive the first time it comes on, and never again (the tracker marks its
// step [data-seen]). The chapter rail's marker travels (ChapterRail), and a
// card says where it is in its chapter (StepMarks). → and ←, or J and K, go
// stop by stop (ui/useStepKeys). The page's accent follows the colour on the
// panel (ui/panelTint), and the first visit opens under a cover that counts
// the stage in (ui/Preloader).

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
            // Its card's lines arrive the first time, and only then (Guide.module.css).
            if (on && !stepEl.dataset.seen) stepEl.dataset.seen = "1";
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

/**
 * Where a step is in its chapter: a mark a step at the end of the kicker's
 * line, this one longer, the ones before it done. Not a count in figures —
 * some kickers are one already, of something else ("1 / 34": the pattern).
 */
function StepMarks({ index, total }: { index: number; total: number }) {
  if (total < 2) return null;
  return (
    <span className={styles.steps} role="img" aria-label={`${index + 1} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} data-s={i < index ? "done" : i === index ? "on" : "todo"} />
      ))}
    </span>
  );
}

/**
 * A chapter's number, as a counter that rolls to it: each figure in a window
 * of its own, the last one coming up through the number before (01 arrives
 * through 00, 02 through 01), the tens just ahead of the units.
 */
function RollNum({ num }: { num: string }) {
  const before = String(Math.max(0, Number(num) - 1)).padStart(num.length, "0");
  return (
    <span className={styles.chapterNum} aria-hidden="true">
      {num.split("").map((figure, i) => {
        const rolls = before[i] !== figure;
        return (
          <span key={i} className={styles.digit}>
            <span className={styles.digitRoll} data-roll={rolls ? "1" : undefined} style={{ "--i": i } as CSSProperties}>
              {rolls && <span>{before[i]}</span>}
              <span>{figure}</span>
            </span>
          </span>
        );
      })}
    </span>
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
      <div className={styles.card} data-leaves="">
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          {copy.kicker}
          <StepMarks index={index} total={total} />
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
      <header className={styles.chapterHead} data-leaves="" data-reveal="">
        <RollNum num={copy.num} />
        <h2 className={styles.chapterTitle} data-reveal-at="">
          <Words text={copy.title} />
        </h2>
        <p className={styles.chapterLede} data-line="">
          {copy.lede}
        </p>
      </header>
      {copy.steps.map((step, i) => (
        <Step key={i} page={page} scene={id} copy={step} index={i} total={copy.steps.length} chapter={chapter} lang={lang} />
      ))}
    </section>
  );
}

// The chapter rail. Its marker is one pill that travels to the chapter the
// reader is in (measured off that chapter's item, so it fits any label in
// either language), and the line along the marker's foot fills as the
// chapter's steps go by: nothing under the chapter's title, then a share a
// step, full on the last.
function ChapterRail({ chapters }: { chapters: PageChapter[] }) {
  const scene = useGuideStore((s) => s.scene);
  const step = useGuideStore((s) => s.step);
  const cardIn = useGuideStore((s) => s.cardIn);
  const nav = useRef<HTMLElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const index = chapters.findIndex((c) => c.id === scene);
  const total = index < 0 ? 0 : chapters[index].copy.steps.length;
  const fill = total ? Math.min(1, (cardIn ? step + 1 : step) / total) : 0;

  useLayoutEffect(() => {
    const el = nav.current;
    const m = marker.current;
    if (!el || !m) return;
    let frame = 0;
    const place = (travel: boolean) => {
      const item = index < 0 ? null : el.querySelectorAll<HTMLElement>("a")[index];
      if (!item || item.offsetWidth === 0) {
        m.dataset.on = "0";
        return;
      }
      // Its first place, and a place after being away, is taken, not travelled to.
      const still = !travel || m.dataset.on !== "1";
      if (still) m.dataset.still = "1";
      m.style.setProperty("--x", `${item.offsetLeft}px`);
      m.style.setProperty("--w", `${item.offsetWidth}px`);
      m.dataset.on = "1";
      el.dataset.marked = "1";
      if (still) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => delete m.dataset.still);
        });
      }
    };
    place(true);
    // The items' widths change with the window and with their fonts.
    const ro = new ResizeObserver(() => place(false));
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [index]);

  return (
    <nav ref={nav} className={styles.rail} aria-label="Chapters" data-leaves="">
      <span ref={marker} className={styles.railMarker} style={{ "--f": fill } as CSSProperties} aria-hidden="true" />
      {chapters.map(({ id, label, copy }) => (
        <a key={id} href={`#${id}`} className={styles.railItem} data-active={scene === id ? "1" : "0"} aria-current={scene === id ? "true" : undefined}>
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

  // The stage plays this page's script, from its top: said before the browser
  // paints the page, and before the tracker below says where the reader is.
  // The board is the same one on every page (store.ts getSim); the Director
  // puts it in this page's state on its next frame. The document says the
  // page's language meanwhile (darkDocument.ts).
  useGuidePage(page, lang);
  useScrollTracker(root);
  useReveal(root);
  useStepKeys(root);
  usePanelTint(root);

  // Sanity: the copy and the script must agree on how many steps each
  // chapter has, in both languages (pages.test.ts holds the same line).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    for (const problem of scriptMismatches(page)) console.warn(`guide: ${problem}`);
  }, [page]);

  return (
    <div className={styles.page} lang={lang} ref={root} data-page={page}>
      {/* The first visit's cover; Make has no stage to wait for. */}
      {page !== "make" && <Preloader />}
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
        {/* The same guide in the other language, at the step the reader is on. */}
        <GuideLink to={page} lang={other} keepPlace className={styles.lang} hrefLang={other}>
          {copy.langSwitch.label}
        </GuideLink>
      </header>

      <main className={styles.story}>
        <section className={`${styles.scene} ${styles.opening}`} data-scene="opening" id="top">
          <article className={styles.openingInner} data-step={0} data-on="1" data-leaves="">
            <p className={styles.openingKicker}>{opening.kicker}</p>
            <h1 className={`${styles.openingTitle} ${styles.wordsNow}`}>
              <Words text={opening.title} />
            </h1>
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
                <GuideLink to={opening.back.to} lang={lang}>
                  <span aria-hidden="true">←</span>
                  {opening.back.label}
                </GuideLink>
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
          <article className={styles.nextInner} data-step={0} data-on="1" data-leaves="" data-reveal="">
            <h2 className={styles.nextTitle} data-reveal-at="">
              <Words text={next.title} />
            </h2>
            <p className={styles.nextLede} data-line="">
              {next.lede}
            </p>
            {next.groups.map((g, gi) => {
              const items = (
                <ul className={styles.soon}>
                  {g.items.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              );
              return (
                <div key={g.label} className={styles.soonGroup} data-later={g.later ? "1" : undefined} data-line="" style={{ "--n": gi + 1 } as CSSProperties}>
                  <p className={styles.soonLabel}>{g.label}</p>
                  {g.to ? (
                    // A guide that exists: the whole group is the way there.
                    <GuideLink to={g.to} lang={lang} className={styles.soonLink}>
                      {items}
                      <span className={styles.soonArrow} aria-hidden="true">
                        →
                      </span>
                    </GuideLink>
                  ) : (
                    items
                  )}
                </div>
              );
            })}
            <p className={styles.nextUntil} data-line="" style={{ "--n": next.groups.length + 1 } as CSSProperties}>
              {next.until}
            </p>
            <div className={styles.nextLinks} data-line="" style={{ "--n": next.groups.length + 2 } as CSSProperties}>
              {next.links.map((l) => (
                <a key={l.href} href={l.href} className={styles.nextLink}>
                  {l.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
            <div data-line="" style={{ "--n": next.groups.length + 3 } as CSSProperties}>
              <Report
                label={copy.ui.report.general}
                hint={copy.ui.report.hint}
                title={next.report?.title ?? copy.ui.report.generalTitle}
                where={next.report?.where ?? copy.ui.report.generalWhere}
              />
            </div>
          </article>
        </section>
      </main>

      {page === "make" && deskFits && <DeskStage lang={lang} />}
    </div>
  );
}
