"use client";

import { useEffect, useRef, type RefObject } from "react";
import { GUIDE_ORDER } from "../../pages";
import { useGuideStore, type GuidePageId } from "../../store";
import { busy } from "../useStepKeys";
import type { ResidentSetup } from "./engine";
import { ROWS } from "./sprite";
import { Figure, useResident, useWide } from "./useResident";

// The resident on the hub. It stands on the rule over the three guides —
// at first at the rule's start, under the page's own name — and it goes
// where the reader points:
//
//   · the mouse or the Tab key on a guide (store.preview, as before): it
//     walks to that guide, hopping the gaps between the three rules;
//   · → and ← (or D and A): it walks a guide on or a guide back, and the
//     guide it stands over is the chosen one — the same state as pointing at
//     it, so the device answers (the hub marks the column [data-here]);
//     ← from the first guide takes it home and nothing is chosen;
//   · Enter or Space: into the chosen guide (the guide's own link is
//     followed, so the page leaves the way it always does); Escape: nothing
//     chosen.
//
// It takes nothing from anyone. No focus: Tab walks the three links as it
// always did, and while one of them has the focus the arrows move the focus
// along them instead. Enter and Space are left alone unless a guide has been
// chosen with the arrows and nothing has the focus. The mouse takes the
// choice back by moving (GuideHub). Under 900 px there is no resident, and
// no keys.

/** 3 px a cell: 21 × 18 px, beside names 96 px tall. */
const SCALE = 3;
const SETUP: ResidentSetup = { scale: SCALE, hop: 8, sitAfter: 7000 };
/** What it keeps between itself and the page's words, px. */
const CLEAR = 16;

type Props = {
  /** The hub's choices (.inner): the block it lives in, and measures. */
  within: RefObject<HTMLElement | null>;
  /** The guide chosen by walking to it, or null. */
  chosen: GuidePageId | null;
  onChoose: (guide: GuidePageId | null) => void;
};

function OnHub({ within, chosen, onChoose }: Props) {
  const { el, path, engine } = useResident(SETUP);
  /** Where it stands for: home, then each guide (its left edge, in the block). */
  const stops = useRef<number[]>([]);
  /** Where it is, or is going: −1 home, else the guide's place in the row. */
  const pos = useRef(-1);
  const chosenNow = useRef(chosen);
  useEffect(() => {
    chosenNow.current = chosen;
  }, [chosen]);

  // Its line, and its places on it.
  useEffect(() => {
    const box = within.current;
    const r = engine.current;
    if (!box || !r) return;
    const measure = () => {
      const cols = Array.from(box.querySelectorAll<HTMLElement>("[data-guide]"));
      if (!cols.length || cols[0].offsetWidth === 0) return;
      const b = box.getBoundingClientRect();
      const rects = cols.map((c) => {
        const q = c.getBoundingClientRect();
        return { left: q.left - b.left, right: q.right - b.left, top: q.top - b.top };
      });
      // The words on the line above the rule: the page's sentence at its left end, the report at its right.
      let wordsEnd = -Infinity;
      const title = box.querySelector("h1");
      if (title) {
        const range = document.createRange();
        range.selectNodeContents(title);
        wordsEnd = range.getBoundingClientRect().right - b.left;
      }
      const report = box.querySelector("[data-report]");
      const reportStart = report ? report.getBoundingClientRect().left - b.left : Infinity;
      const w = r.width;
      const next = [rects[0].left];
      for (const c of rects) {
        // Over the middle of its guide; clear of the words where the column has room for that.
        let s = (c.left + c.right) / 2 - w / 2;
        if (s < wordsEnd + CLEAR && wordsEnd + CLEAR + w <= c.right - 8) s = wordsEnd + CLEAR;
        if (s + w > reportStart - CLEAR && reportStart - CLEAR - w >= Math.max(c.left + 8, wordsEnd + CLEAR)) s = reportStart - CLEAR - w;
        next.push(s);
      }
      stops.current = next;
      // The three rules are three: it hops from one to the next.
      const gaps: number[] = [];
      let half = 0;
      for (let i = 0; i + 1 < rects.length; i++) {
        gaps.push((rects[i].right + rects[i + 1].left) / 2);
        half = Math.max(half, (rects[i + 1].left - rects[i].right) / 2 + 12);
      }
      r.setGaps(gaps, half);
      // Feet on the rule.
      r.setGround(b.left, rects[0].top - ROWS * SCALE);
      r.put(next[pos.current + 1]);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [within, engine]);

  // The guide pointed at — by the mouse, the Tab key, or the arrows below: it goes there. Entering one: a hop.
  useEffect(
    () =>
      useGuideStore.subscribe((s, was) => {
        const r = engine.current;
        if (!r || s.page !== "hub") return;
        if (s.preview !== was.preview) {
          if (s.preview) {
            pos.current = GUIDE_ORDER.indexOf(s.preview);
            r.walkTo(stops.current[pos.current + 1]);
          }
          // It does not sit down on a choice.
          r.setRestful(s.preview === null);
        }
        if (s.leaving !== was.leaving && s.leaving && s.leaving !== "hub") r.hop();
      }),
    [engine],
  );

  // The keys.
  useEffect(() => {
    /** Choose a guide, or none. None hands the pointing back to the mouse: true if it is resting on a guide. */
    const choose = (guide: GuidePageId | null): boolean => {
      const s = useGuideStore.getState();
      const was = chosenNow.current;
      chosenNow.current = guide;
      onChoose(guide);
      if (guide) {
        s.setPreview(guide);
        return false;
      }
      const under = within.current?.querySelector<HTMLElement>("[data-guide]:hover")?.dataset.guide as GuidePageId | undefined;
      if (under) s.setPreview(under);
      else if (was && s.preview === was) s.setPreview(null);
      return Boolean(under);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (busy(e.target) || useGuideStore.getState().leaving !== null) return;
      const box = within.current;
      const r = engine.current;
      if (!box || !r || !r.isPlaced) return;
      const k = e.key;
      const dir = k === "ArrowRight" || k === "d" || k === "D" ? 1 : k === "ArrowLeft" || k === "a" || k === "A" ? -1 : 0;
      const active = document.activeElement as HTMLElement | null;
      if (dir) {
        // A guide's link has the focus: the arrows move the focus along the three, and the resident follows it.
        const links = Array.from(box.querySelectorAll<HTMLAnchorElement>("[data-guide] > a"));
        const at = active ? links.indexOf(active as HTMLAnchorElement) : -1;
        if (at >= 0) {
          e.preventDefault();
          links[at + dir]?.focus();
          return;
        }
        const to = Math.max(-1, Math.min(GUIDE_ORDER.length - 1, pos.current + dir));
        e.preventDefault();
        if (to < 0) {
          // Home: nothing is chosen (unless the mouse is on a guide: then that one is, and it goes there).
          if (choose(null)) return;
          pos.current = -1;
          r.walkTo(stops.current[0]);
          return;
        }
        // (At the row's end, with the guide it stands over not chosen yet: chosen now.)
        pos.current = to;
        choose(GUIDE_ORDER[to]);
        r.walkTo(stops.current[to + 1]);
        return;
      }
      const guide = chosenNow.current;
      if (!guide) return;
      if (k === "Escape") {
        choose(null);
        return;
      }
      // Enter and Space belong to whatever has the focus; with nothing focused, they go in.
      if ((k === "Enter" || k === " ") && (!active || active === document.body)) {
        e.preventDefault();
        box.querySelector<HTMLAnchorElement>(`[data-guide="${guide}"] > a`)?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [within, engine, onChoose]);

  return <Figure el={el} path={path} engine={engine} scale={SCALE} place="hub" />;
}

export default function HubResident(props: Props) {
  return useWide() ? <OnHub {...props} /> : null;
}
