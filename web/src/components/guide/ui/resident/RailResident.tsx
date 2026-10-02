"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Resident, ResidentSetup } from "./engine";
import { Figure, useResident, useWide } from "./useResident";

// The resident in a guide. It stands on top of the chapter rail, over the
// tip of the line that fills along the current chapter's foot (ChapterRail's
// marker): as the reader goes on — by scrolling, or with → and ← — it runs
// to the step's place, and at a chapter's end it hops over to the next. It
// waits at the rail's start while the guide's opening is on screen, and at
// its far end once the guide is done. Left alone a while (a card being
// read), it sits down.
//
// It is outside the rail's box, so it lies over no chapter's name and takes
// no click meant for one. The rail is not shown under 900 px, and neither is
// it.

/** 2 px a cell: 14 × 12 px, in the 18 px the top bar keeps above the rail. */
const SCALE = 2;
const SETUP: ResidentSetup = { scale: SCALE, hop: 5, sitAfter: 9000 };
/** The progress line starts and ends this far inside a chapter's item (Guide.module.css .railMarker::after). */
const INSET = 13;
/** How far in from either end the rail's top is flat enough to stand on, px (its ends are half-circles some 20 px across). */
const ROUND = 16;

type Props = {
  /** The rail: its container. */
  nav: RefObject<HTMLElement | null>;
  /** The chapter the reader is in, −1 on the opening and the end. */
  index: number;
  /** How far through that chapter, 0..1 (the marker's fill). */
  fill: number;
  /** The guide's end is on screen. */
  end: boolean;
};

type Place = Pick<Props, "index" | "fill" | "end">;

/** Its place on the rail for where the reader is (its left edge, in the rail), or null while the rail is not laid out. */
function where(rail: HTMLElement, r: Resident, { index, fill, end }: Place): number | null {
  const items = rail.querySelectorAll<HTMLElement>("a");
  if (!items.length || items[0].offsetWidth === 0) return null;
  const item = index >= 0 ? items[index] : end ? items[items.length - 1] : items[0];
  if (!item) return null;
  const f = index >= 0 ? fill : end ? 1 : 0;
  // A chapter's item ends where the next begins: over the join, a hop.
  const joins: number[] = [];
  for (let i = 0; i + 1 < items.length; i++) joins.push((items[i].offsetLeft + items[i].offsetWidth + items[i + 1].offsetLeft) / 2);
  r.setGaps(joins, 9);
  r.setGround(rail.getBoundingClientRect().left);
  const x = item.offsetLeft + INSET + f * (item.offsetWidth - 2 * INSET) - r.width / 2;
  // The rail's ends are round: it keeps to the flat of its top.
  return Math.min(rail.offsetWidth - ROUND - r.width, Math.max(ROUND, x));
}

function OnRail({ nav, index, fill, end }: Props) {
  const { el, path, engine } = useResident(SETUP);
  const at = useRef<Place>({ index, fill, end });

  // The reader has moved on: it goes there.
  useEffect(() => {
    at.current = { index, fill, end };
    const rail = nav.current;
    const r = engine.current;
    if (!rail || !r) return;
    const x = where(rail, r, at.current);
    if (x !== null) r.walkTo(x);
  }, [nav, engine, index, fill, end]);

  // The items' widths change with the window and with their fonts: it is put where it belongs, not walked.
  useEffect(() => {
    const rail = nav.current;
    if (!rail) return;
    const ro = new ResizeObserver(() => {
      const r = engine.current;
      const x = r && where(rail, r, at.current);
      if (r && x !== null && x !== undefined) r.put(x);
    });
    ro.observe(rail);
    return () => ro.disconnect();
  }, [nav, engine]);

  return <Figure el={el} path={path} engine={engine} scale={SCALE} place="rail" />;
}

export default function RailResident(props: Props) {
  return useWide() ? <OnRail {...props} /> : null;
}
