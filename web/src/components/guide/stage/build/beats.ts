// The build, beat by beat. A beat is one step of the Build guide's script
// (scenes/build.ts): what is happening on the bench or in the case while
// that step's card is read. They are in the order the build really happens
// (BUILD_GUIDE.md, v3.9), and the stage (BuildStage) plays them as one
// timeline: t = a beat's index + how far through its own motion it is
// (0…1). Everything on the stage — which parts exist, where each one is —
// is a function of t alone, so scrolling back and forth, or jumping from a
// chapter list, always shows the build as it stands at that step: the stage
// runs t forward (or back) to the step at a quick pace, then plays the
// step's own motion once at its own pace and holds its end.
//
// The ids are the storyboard's step ids. `seconds` is how long the beat's
// own motion takes at its own pace. A beat whose step has the camera come a
// long way — from the bench to behind the case, from behind it to the front —
// keeps what it is about out of its first second and a bit: the camera is
// still arriving then (its springs take about that long), and the reader
// would see the end of something that had already happened. There is no solder-5 and no wire-3: the
// build has no multimeter checks, so solder-4 is followed by case-1 and
// wire-2 by firmware-1. Every beat but "opening" and "next" is one step of
// the script, and the script uses every one (build.test.ts).

export const BEATS = [
  ["opening", 1],
  ["gather-1", 5],
  ["gather-2", 4],
  ["gather-3", 1],
  ["gather-4", 1.6],
  ["print-1", 3.4],
  ["print-2", 6.5],
  ["print-3", 3.8],
  ["print-4", 6.4],
  ["solder-1", 7],
  ["solder-2", 6.4],
  ["solder-3", 4.6],
  ["solder-4", 8.8],
  ["case-1", 5],
  ["case-2", 6.6],
  ["case-3", 6.4],
  ["case-4", 3.6],
  ["case-5", 6],
  ["wire-1", 5],
  ["wire-2", 5],
  ["firmware-1", 2.2],
  // The DevKit's travel round the case and onto its pins is Device's (it is
  // Play's move), not this timeline's: these seconds are how long that takes,
  // so the step's card offers Replay like the other steps with a motion.
  ["firmware-2", 2.6],
  ["firmware-3", 4.6],
  ["check-1", 1],
  ["check-2", 1],
  ["check-3", 1],
  ["check-4", 5.4],
  ["check-5", 5],
  ["next", 1],
] as const;

export type BuildBeat = (typeof BEATS)[number][0];

const INDEX = new Map<string, number>(BEATS.map(([id], i) => [id, i]));

/** A beat's place on the timeline (its start), or −1 for an unknown id. */
export function beatIndex(id: string | undefined): number {
  return id === undefined ? -1 : (INDEX.get(id) ?? -1);
}

/** The timeline value where a beat starts, plus `at` of the way through it. */
export function at(id: BuildBeat, phase = 0): number {
  return (INDEX.get(id) ?? 0) + phase;
}

export function beatSeconds(i: number): number {
  return BEATS[Math.max(0, Math.min(BEATS.length - 1, i))][1];
}

/**
 * Where a beat stands when nothing moves (prefers-reduced-motion), 0…1
 * through it: its end, unless the end is not the frame that says what the
 * step is about (none is, today).
 */
const STILL: Partial<Record<BuildBeat, number>> = {};
export function beatStill(i: number): number {
  return STILL[BEATS[Math.max(0, Math.min(BEATS.length - 1, i))][0]] ?? 0.999;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
export const smoother = (x: number) => {
  const c = clamp01(x);
  return c * c * c * (c * (c * 6 - 15) + 10);
};
/** Eases out past the end and settles back: a part landing. */
export const settle = (x: number) => {
  const c = clamp01(x);
  const s = 1.4;
  const u = c - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/**
 * Where t is between two timeline values, 0…1 (eased with `ease`). The ease
 * must clamp, as these all do — clamp01 is the straight one: an unclamped
 * ease runs on past 1, and whatever it drives keeps going (the bonded halves
 * sank through the bench).
 */
export function span(t: number, a: number, b: number, ease: (x: number) => number = smooth): number {
  return ease((t - a) / (b - a));
}
