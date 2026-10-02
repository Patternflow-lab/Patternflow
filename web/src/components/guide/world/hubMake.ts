import type { DeviceSim } from "@/lib/guide/deviceSim";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";

// The hub's Make answer (HubAnswers): while Make is pointed at, the pattern on
// the panel is made again and again — someone's own pattern drawn in over the
// last, a row at a time from the top, then the next — and when the reader
// points away Origin is drawn back the same way. The patterns are community
// ones from the Basics pack, pictures where Origin is tiles.
//
// The drawing-in is the page's, not the firmware's: a board switches pattern
// at once. It is done over the simulator's frame (deviceSim setFrameFilter),
// and only while a redraw is running.
//
// The board is the same one in every guide (store.ts getSim), so what this
// changes — the pack, the pattern — it puts back: makeRestore. Origin's own
// knob values are the board's to keep (it remembers them per pattern), so the
// hue the reader left Origin on is the hue it comes back with.

/** What the panel is remade into, in turn. */
export const MAKE_PATTERNS = ["midsummer_sea", "chromatic_vortex", "lissajous_weave", "firefly_hollow"] as const;

/** How long a pattern takes to be drawn in, and Origin to be drawn back, ms. */
export const DRAW_MS = 640;
export const RESTORE_MS = 460;

/** The colour of the row being drawn: the guide's LED orange, bright. */
const HEAD = [255, 150, 96] as const;

type Redraw = { old: Uint8ClampedArray; at: number; ms: number };

let redraw: Redraw | null = null;
/** The panel is showing a pattern this answer put there. */
let made = false;
let next = 0;

/** The clock the redraw runs on; tests set it. */
export const makeClock = { now: (): number => performance.now() };

const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * Over the frame: what has not been drawn yet is still the old picture, and
 * the row being drawn is lit. The panel stands on its end — the frame's x
 * runs up the device, its last column the top row (panelScreens.ts) — so the
 * drawing goes down the frame's x.
 */
function filter(frame: Uint8ClampedArray) {
  const r = redraw;
  if (!r) return;
  const u = (makeClock.now() - r.at) / r.ms;
  if (u >= 1) {
    redraw = null;
    return;
  }
  // Columns from `edge` up are the new pattern; below it, the old one.
  const edge = Math.round(PANEL_W * (1 - ease(u)));
  for (let y = 0; y < PANEL_H; y++) {
    const row = y * PANEL_W * 4;
    frame.set(r.old.subarray(row, row + edge * 4), row);
    if (edge > 0 && edge < PANEL_W) {
      const i = row + edge * 4;
      frame[i] = HEAD[0];
      frame[i + 1] = HEAD[1];
      frame[i + 2] = HEAD[2];
    }
  }
}

function begin(sim: DeviceSim, ms: number) {
  redraw = { old: sim.frame.slice(), at: makeClock.now(), ms };
  sim.setFrameFilter(filter);
}

/** The panel is showing one of the answer's patterns, or still drawing Origin back. */
export function makeIsShown(): boolean {
  return made;
}

/** A redraw is on its way down the panel. */
export function makeIsDrawing(): boolean {
  return redraw !== null && makeClock.now() - redraw.at < redraw.ms;
}

/** The answer: the next pattern, drawn in over what is there. */
export function makeNext(sim: DeviceSim) {
  begin(sim, DRAW_MS);
  sim.setPack("basics");
  sim.showPattern(MAKE_PATTERNS[next % MAKE_PATTERNS.length]);
  next++;
  made = true;
}

/** Pointing away: Origin drawn back, and the board's pack as it was. Nothing to do if the answer never showed. */
export function makeRestore(sim: DeviceSim) {
  if (!made) return;
  made = false;
  next = 0;
  begin(sim, RESTORE_MS);
  sim.showPattern("origin");
  sim.setPack("origin");
}
