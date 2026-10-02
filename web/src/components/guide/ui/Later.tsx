"use client";

import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";

// A guide entered from another page of the guide: its words first, the rest
// of the page a moment after.
//
// Going from the hub into a guide, the whole story is mounted in one go —
// every chapter, every card — and laid out in one go, in the middle of the
// camera's move: one long frame (a twelfth of a second on a fast machine, a
// second on a slow one) on a stage that is meant never to stop. More than
// half of it was the browser laying out cards that are five and ten screens
// further down; the rest was React making what those cards hold besides their
// words — the flasher's screens, the consoles, the parts lists, the deck.
//
// So on such an arrival — and only then — the page comes in in two parts:
//
//   - What a card holds besides its words is mounted after the page (<Later>).
//   - Every block below the first screen is marked [data-wait]: the browser
//     skips the layout of what is inside it until it is near the screen or
//     its turn comes (Guide.module.css: content-visibility; a block keeps its
//     height meanwhile — its min-height is its usual one).
//
// Both are then done in the quiet after the move, one at a time and in the
// page's order, each a small piece of work between two frames
// (`whenQuiet`), until the page is exactly the page it always was: nothing
// stays skipped, nothing is measured from an estimate. A block that comes
// near the screen first is done there and then; and everything still waiting
// is done at once the moment the reader presses a key or the mouse — a
// chapter's link, → to the next stop: where those lead depends on every card
// above having its real height.
//
// A page that is loaded (its markup comes whole from the server), reached
// with Back or Forward (the browser puts the scroll back where it was), or
// swapped for its other language (the reader lands mid-page) is mounted whole,
// as it always was.

/** The first job waits this long after it was asked for: the words' arrival and the busiest part of the stage's move, ms. */
const START_MS = 650;
/** Near enough to the screen to be needed now: a screen's height either way. */
const NEAR = "100% 0px";

const jobs: (() => void)[] = [];
let pumping = 0;
let listening = false;

function idle(fn: () => void) {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 250 });
  else window.setTimeout(fn, 60);
}

function pump() {
  pumping = 0;
  const job = jobs.shift();
  if (!job) return;
  job();
  if (jobs.length) pumping = window.setTimeout(() => idle(pump), 24);
}

/** Everything that is waiting, now: the reader is about to go somewhere. */
function flush() {
  if (!jobs.length) return;
  window.clearTimeout(pumping);
  pumping = 0;
  for (const job of jobs.splice(0)) job();
}

/**
 * Do this in the quiet after the page has arrived, in its turn (or at once,
 * with everything else waiting, when the reader acts). Returns its undoing:
 * the job is forgotten.
 */
export function whenQuiet(job: () => void): () => void {
  jobs.push(job);
  if (!listening) {
    listening = true;
    window.addEventListener("pointerdown", flush, true);
    window.addEventListener("keydown", flush, true);
  }
  if (!pumping) pumping = window.setTimeout(() => idle(pump), START_MS);
  return () => {
    const i = jobs.indexOf(job);
    if (i >= 0) jobs.splice(i, 1);
  };
}

// A page reached with Back or Forward is never mounted late (see above): the
// browser puts the scroll back as the page mounts, and it must be the whole
// page it does that on. What is remembered is the kind of the last move, not
// when it was — the page can mount seconds after the button was pressed (its
// data being fetched), and a window of time let it through as a new arrival:
// it came back a hundred pixels off, on a card that was not the one on.
// A move through the history says so (popstate); a link followed is a new
// visit again; and the page that arrives takes the mark with it.
let byHistory = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    byHistory = true;
  });
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target as Element | null;
      if (el && typeof el.closest === "function" && el.closest("a[href]")) byHistory = false;
    },
    true,
  );
}
/** The page being mounted now was reached through the history. */
export function arrivedByHistory() {
  return byHistory;
}
/** A page has arrived: the next one is judged afresh. (From an effect, not as it renders.) */
export function arrived() {
  byHistory = false;
}

/** `late`: this page's extras come in after it (GuideExperience decides, once, as it mounts). */
export default function Later({ late, children }: { late: boolean; children: ReactNode }) {
  const [on, setOn] = useState(!late);
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (on) return;
    let done = false;
    // In its turn: a small render the stage's frames go on through.
    const forget = whenQuiet(() => {
      if (done) return;
      done = true;
      startTransition(() => setOn(true));
    });
    // Or as its card comes near the screen, whichever is first.
    const el = mark.current;
    const io =
      el && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (done || !entries.some((e) => e.isIntersecting)) return;
              done = true;
              setOn(true);
            },
            { rootMargin: NEAR },
          )
        : null;
    if (el) io?.observe(el);
    return () => {
      io?.disconnect();
      forget();
    };
  }, [on]);

  // (Its place in the card is kept: the card's lines are counted, Guide.module.css.)
  if (!on) return <span ref={mark} style={{ display: "block" }} />;
  return <>{children}</>;
}
