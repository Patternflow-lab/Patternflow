"use client";

import { useSyncExternalStore } from "react";

/**
 * Where the desk is up: wide enough that Pattern Lab, laid out at 1024 CSS px
 * and scaled into the space left of the cards, stays readable (≈0.8× at
 * 1180), and tall enough for its window and for the tallest step card to fit
 * on screen beside it. The card column narrows with the window (27vw, at
 * least 330 px), so a narrower window has taller cards and needs more
 * height: 640 px from 1340 px wide (a 1366 × 768 laptop's window keeps the
 * desk; the longest card is about 560 px there), 660 from 1280 (about 630),
 * 700 from 1180. Below it the make page has no desk, and the cards show their
 * screenshots instead (CommunityShots, LabShots).
 *
 * The same query is written out in Guide.module.css (twice: it and its
 * opposite) and Desk.module.css (CSS can't import it): change them all
 * together.
 */
export const DESK_QUERY =
  "(min-width: 1340px) and (min-height: 640px), (min-width: 1280px) and (min-height: 660px), (min-width: 1180px) and (min-height: 700px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const snapshot = () => window.matchMedia(DESK_QUERY).matches;
const serverSnapshot = () => false;

/** The screen is big enough for the desk (false on the server). */
export function useDeskFits(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, reducedSnapshot, serverSnapshot);
}
function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const reducedSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
