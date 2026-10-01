import { useSyncExternalStore } from "react";

// How much the stage draws, decided by how long its frames really take.
//
// Three tiers. Every machine starts on the first (a phone-sized screen starts
// with a phone's settings of it); a machine whose frames run long is stepped
// down — the expensive parts first, the ones least missed — and never back up
// in the same visit, so the picture does not flip between two looks. The step
// is remembered for the tab's session, so the next page of the guide starts
// where this one settled.
//
//   0  everything: depth of field, ambient occlusion, multisampling, the
//      screen's full pixel ratio (up to 2)
//   1  no depth of field, a pixel ratio of 1.5 at most, lighter occlusion
//   2  no occlusion, no multisampling (an edge filter instead), one canvas
//      pixel per CSS pixel, a smaller shadow map
//
// The bloom, the tone curve, the panel's own light and the materials stay at
// every tier: they are what the stage looks like, and cost little.
//
// ?gq=0|1|2 pins a tier (and stops the measuring), for looking at each.

export type Tier = 0 | 1 | 2;

const KEY = "pf-guide-tier";

function pinned(): Tier | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("gq");
  return q === "0" || q === "1" || q === "2" ? (Number(q) as Tier) : null;
}

function initial(): Tier {
  const pin = pinned();
  if (pin !== null) return pin;
  try {
    const s = window.sessionStorage.getItem(KEY);
    if (s === "1" || s === "2") return Number(s) as Tier;
  } catch {
    // No storage (private mode): measure again.
  }
  return 0;
}

let tier: Tier | null = null;
const listeners = new Set<() => void>();

export function getTier(): Tier {
  if (typeof window === "undefined") return 0;
  return (tier ??= initial());
}

function setTier(next: Tier) {
  if (next === getTier()) return;
  tier = next;
  try {
    window.sessionStorage.setItem(KEY, String(next));
  } catch {
    // Not remembered, then.
  }
  listeners.forEach((l) => l());
}

// In development, step it by hand from the console: __pfSetTier(1).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __pfSetTier?: (t: Tier) => void }).__pfSetTier = setTier;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The tier, for a component: re-renders when the stage is stepped down. */
export function useTier(): Tier {
  return useSyncExternalStore(subscribe, getTier, () => 0);
}

export type Settings = {
  /** The most canvas pixels per CSS pixel. */
  dpr: number;
  /** MSAA samples of the frame the effects are drawn from (0: none). */
  msaa: number;
  /** A cheap edge filter after the fact, where there is no multisampling and the pixels are big enough to show it. */
  fxaa: boolean;
  /** Ambient occlusion: off, or its quality. */
  ao: false | "performance" | "medium";
  /** Depth of field. */
  dof: boolean;
  /** The key light's shadow map, pixels a side. */
  shadow: number;
};

/** What a tier draws. A narrow screen (a phone) never had multisampling or occlusion: its pixels are small and its GPU is not. */
export function settingsFor(t: Tier, narrow: boolean): Settings {
  if (narrow) {
    if (t === 0) return { dpr: 1.5, msaa: 0, fxaa: false, ao: false, dof: false, shadow: 2048 };
    if (t === 1) return { dpr: 1.25, msaa: 0, fxaa: false, ao: false, dof: false, shadow: 1024 };
    return { dpr: 1, msaa: 0, fxaa: true, ao: false, dof: false, shadow: 1024 };
  }
  if (t === 0) return { dpr: 2, msaa: 4, fxaa: false, ao: "medium", dof: true, shadow: 2048 };
  if (t === 1) return { dpr: 1.5, msaa: 4, fxaa: false, ao: "performance", dof: false, shadow: 2048 };
  return { dpr: 1, msaa: 0, fxaa: true, ao: false, dof: false, shadow: 1024 };
}

// ── the measuring ───────────────────────────────────────────────────────────
//
// The median of a window of frames: a median, because one long frame (a
// shader built, a model parsed) says nothing about the machine. Two windows
// in a row over the limit and the stage steps down; then it waits for the new
// settings to take before it measures again.
//
// The windows are lengths of time, not counts of frames. Counted in frames
// (120 of them, twice) the wait was four seconds at 60 a second and most of
// a minute at 12 — the slower the machine, the longer it was left struggling,
// and one slower than four frames a second was never stepped down at all,
// because its frames were thrown away as "the tab was away".

/** A window, ms, and the fewest frames one must hold to be judged. */
const WINDOW_MS = 1200;
const MIN_FRAMES = 8;
/** Slower than this is not smooth: 45 frames a second. */
const LIMIT_MS = 22;
/** This slow, and the top tier's next step would not be enough: straight to the last. */
const FAR_MS = 40;
/** After a step: the composer is rebuilt and the canvas resized. Not measured for this long, ms. */
const REST_MS = 900;
/** A gap this long is the tab coming back, not a frame, ms. */
const AWAY_MS = 2000;

const samples: number[] = [];
let span = 0;
let strikes = 0;
let restUntil = 0;
let last = 0;

/** For the look of it in development: the last window's median, ms. */
export const qualityProbe = { median: 0, tier: 0 as Tier };

/**
 * Call once a frame with the frame's time, ms. `settled` is false while the
 * stage is doing something that is slow for its own reasons — loading, a
 * page changing, the Build stage warming its shaders — and those frames are
 * not counted.
 */
export function measureFrame(ms: number, settled: boolean) {
  if (pinned() !== null) return;
  const now = performance.now();
  // A tab that was away, or the first frame: start over. (A long frame is a
  // slow machine's frame unless the gap says the tab was not being drawn.)
  if (!settled || document.hidden || now - last > AWAY_MS || last === 0) {
    last = now;
    samples.length = 0;
    span = 0;
    return;
  }
  last = now;
  if (now < restUntil) return;
  samples.push(ms);
  span += ms;
  if (span < WINDOW_MS || samples.length < MIN_FRAMES) return;
  samples.sort((a, b) => a - b);
  const median = samples[samples.length >> 1];
  samples.length = 0;
  span = 0;
  qualityProbe.median = median;
  qualityProbe.tier = getTier();
  if (median <= LIMIT_MS) {
    strikes = 0;
    return;
  }
  if (++strikes < 2) return;
  strikes = 0;
  const t = getTier();
  if (t < 2) {
    setTier(median > FAR_MS ? 2 : ((t + 1) as Tier));
    restUntil = now + REST_MS;
  }
}
