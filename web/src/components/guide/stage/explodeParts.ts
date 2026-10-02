import { useGuideStore } from "../store";
import { buildClock } from "../timing";
import { OPENING_GONE } from "./build/beats";

// The device, taken apart in the air: the hub's answer to "Build" (GuideHub
// → store.preview → stage/Explode.tsx), and how the Build guide opens. One
// amount, 0 whole … 1 apart, and
// each part's place is a function of it — along the axis that part really
// goes on or comes off by (BUILD_GUIDE.md §6–§9, stage/build/BuildStage):
//
//   knobs      pressed onto the encoder shafts from the front      +z
//   panel      into the frame from the front                       +z
//   lid        slides over the power-bank tray from the case's side +x (and a little forward, clear of the face)
//   body       stays: everything else is told from it
//   board      in from behind, its encoder shafts through the face  −z
//   devkit     onto its sockets on the back of the board            −z
//   backPlate  hooked on and shut over the back                     −z
//   slider     the cover on the back plate, along its rails         +x, with the plate
//
// The numbers are model units (10 mm). The parts leave in order — the
// outside first — and come home in the reverse order, each on its own slice
// of the amount (`from`…`to`), eased; nothing travels at a constant speed.
//
// This file is the arithmetic, kept free of three.js so it can be tested;
// Explode.tsx applies it to the device's objects.

export type ExplodePart = "knobs" | "panel" | "lid" | "board" | "devkit" | "backPlate" | "slider";

export type ExplodeSpec = {
  /** Where the part is when the device is fully apart, from its place in the device. */
  offset: readonly [number, number, number];
  /** The slice of the amount this part travels over. */
  from: number;
  to: number;
};

export const EXPLODE: Record<ExplodePart, ExplodeSpec> = {
  // The knobs come less far than the panel: seen from the knob side they
  // then stand in front of the white face they came off, not of the dark panel.
  knobs: { offset: [0, 0, 4.2], from: 0, to: 0.72 },
  slider: { offset: [5.4, 0, -15.5], from: 0, to: 0.8 },
  backPlate: { offset: [0, 0, -15.5], from: 0.04, to: 0.84 },
  panel: { offset: [0, 0, 6.4], from: 0.1, to: 0.88 },
  lid: { offset: [7.2, 0, 2.2], from: 0.14, to: 0.9 },
  devkit: { offset: [0, 0, -11.2], from: 0.16, to: 0.94 },
  board: { offset: [0, 0, -6.8], from: 0.22, to: 1 },
};

export const EXPLODE_PARTS = Object.keys(EXPLODE) as ExplodePart[];

/**
 * Below this the device is whole: the amount snaps to 0 and every part is
 * exactly home (and above 1 − this, to 1). At this amount the parts that
 * lead are a few hundredths of a millimetre out, so the snap cannot be seen;
 * a spring left to itself would take another second to get there.
 */
export const EXPLODE_WHOLE = 0.02;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Starts and ends at rest, with no corner in between. */
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/** How far along its own way a part is, 0…1, for an amount. */
export function partAmount(part: ExplodePart, amount: number): number {
  const { from, to } = EXPLODE[part];
  return ease((amount - from) / (to - from));
}

/** A part's displacement for an amount, written into `out` (x, y, z). */
export function partOffset(part: ExplodePart, amount: number, out: { x: number; y: number; z: number }) {
  const a = partAmount(part, amount);
  const o = EXPLODE[part].offset;
  // (+ 0: a part that goes backward is at 0 when home, not −0.)
  out.x = o[0] * a + 0;
  out.y = o[1] * a + 0;
  out.z = o[2] * a + 0;
  return out;
}

/**
 * Where the stage is with it. Explode.tsx writes `amount` every frame;
 * anything may read it (the Build stage draws its opening apart by it, and
 * hands the device back only at 0; the light and the page may follow it).
 */
export const explodeState = { amount: 0 };

let calm: MediaQueryList | null = null;
function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  calm ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return calm.matches;
}

/**
 * Should the device be apart right now? On the hub, while Build is the guide
 * pointed at (or chosen: store.leaveFor keeps it pointed at until the guide
 * arrives) — and on through Build's own opening: choosing Build does not put
 * back together what pointing at it took apart. The parts hang there beside
 * the title until the reader scrolls into the build, and go as the bench
 * comes up (BuildStage; Explode holds them apart while they do).
 *
 * Not under reduced motion — nothing on the hub answers there, and Build
 * opens on the whole device — and on the hub not while the Build stage is
 * still showing the build (it is winding it back after its guide was left:
 * timing.ts buildClock; at its opening it draws the device apart as well as
 * whole).
 */
export function explodeWanted(): boolean {
  const { page, preview, scene } = useGuideStore.getState();
  if (reducedMotion()) return false;
  if (page === "hub") return preview === "build" && buildClock.t < OPENING_GONE;
  return page === "build" && scene === "opening";
}
