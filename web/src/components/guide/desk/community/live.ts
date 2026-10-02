import { PatternRuntime, knobTargetToDelta, type ColorRamp, type PatternInput } from "@/lib/pattern/harness";
import { parseRampAnnotation } from "@/lib/pattern/ramp";
import { hexToRgb } from "@/lib/pattern/color";
import { matrixFromCode } from "@/lib/pattern/matrix";
import { LOGICAL_KNOB_WRAP, logicalKnobUnitsPerTurn } from "@/lib/pattern/controls";
import { normalizedKnobs } from "@/lib/community/knobs";

// The practice community's screens: real presets run by the real pattern
// runtime, drawn into canvases. The real community runs community code in a
// sandboxed iframe (SandboxPreview, src/sandbox/sandbox.ts); these are the
// repo's own presets, so they run here directly — the same runtime, the same
// ramp rules, the same knob maths, without a document per card.
//
// A screen shows a still until it is asked to play (a card under the mouse,
// a pattern's own page), then plays at the display's rate; stopped, it keeps
// its last frame, as the real card does. Stills are made one at a time and a
// few milliseconds a frame (a still is eighteen frames of its pattern: all of
// one in a single frame was a stall of its own, four times over, as the desk
// came up), so a page of them never stalls the page. Nothing runs while the
// practice window is off the desk (setScreensActive).

/** The sandbox's ramp for a setValue() pattern with no @ramp line (sandbox.ts DEFAULT_RAMP). */
const DEFAULT_RAMP: ColorRamp = {
  stops: [
    { position: 0.0, color: [8, 24, 64] },
    { position: 0.55, color: [255, 77, 0] },
    { position: 1.0, color: [255, 232, 154] },
  ],
  mode: "linear",
  wrap: false,
};

/** How far into a pattern its still is taken, as the sandbox's still (a little under a second at 15 fps). */
const STILL_STEPS = 18;
const STILL_DT = 1 / 15;
/** A still in the making is worked on for this long in one frame, ms. */
const STILL_BUDGET_MS = 5;
/** The sandbox's per-step cap and catch-up limit, so a slow frame is not slow motion. */
const MAX_STEP = 0.05;
const MAX_CATCHUP = 0.25;

type Ranges = Array<[number, number]>;

function makeRuntime(code: string): PatternRuntime | null {
  const frame = matrixFromCode(code);
  const rt = new PatternRuntime(frame.width, frame.height);
  const a = parseRampAnnotation(code);
  rt.setRamp(
    a ? { stops: a.stops.map((s) => ({ position: s.position, color: hexToRgb(s.color) })), mode: a.mode, wrap: a.wrap } : DEFAULT_RAMP,
  );
  rt.recolor = Boolean(a?.recolor);
  return rt.loadCode(code).ok ? rt : null;
}

function input(knobs: number[], ranges: Ranges, deltas: number[] | null): PatternInput {
  const flags = [false, false, false, false];
  return {
    knobDeltas: deltas ?? [0, 0, 0, 0],
    knobValues: knobs,
    knobNormalized: normalizedKnobs(knobs, ranges),
    knobRanges: ranges,
    btnPressed: flags,
    btnHeld: flags.slice(),
  };
}

type Screen = {
  canvas: HTMLCanvasElement;
  key: string;
  code: string;
  ranges: Ranges;
  knobs: number[];
  prevKnobs: number[] | null;
  playing: boolean;
  rt: PatternRuntime | null;
  simTime: number;
  lastNow: number;
  /** Something is on the canvas. */
  painted: boolean;
  /** The knobs moved while stopped: draw once more. */
  dirty: boolean;
  failed: boolean;
  /** Reused for every live frame. */
  img: ImageData | null;
};

const screens = new Set<Screen>();
const stills = new Map<string, ImageData | null>();
let active = true;
let raf = 0;

function stillKey(s: Screen) {
  return `${s.key}|${s.knobs.join(",")}`;
}

function paint(s: Screen, data: Uint8ClampedArray | ImageData) {
  const ctx = s.canvas.getContext("2d");
  if (!ctx) return;
  if (data instanceof ImageData) ctx.putImageData(data, 0, 0);
  else {
    if (!s.img) s.img = ctx.createImageData(s.canvas.width, s.canvas.height);
    s.img.data.set(data);
    ctx.putImageData(s.img, 0, 0);
  }
  s.painted = true;
}

function step(s: Screen, dt: number, withDeltas: boolean): boolean {
  if (!s.rt) return false;
  let deltas: number[] | null = null;
  if (withDeltas) {
    const prev = s.prevKnobs ?? s.knobs;
    const perTurn = logicalKnobUnitsPerTurn(s.ranges);
    deltas = s.knobs.map((v, i) => knobTargetToDelta(prev[i], v, LOGICAL_KNOB_WRAP[i], perTurn[i] || 1));
    s.prevKnobs = s.knobs.slice();
  }
  s.simTime += dt;
  const r = s.rt.renderFrame(dt, s.simTime, input(s.knobs, s.ranges, deltas));
  if (!r.ok) s.failed = true;
  return r.ok;
}

/** A runtime for a screen about to play, brought to where its still was taken so playing starts from the picture. */
function warm(s: Screen) {
  if (s.rt || s.failed) return;
  s.rt = makeRuntime(s.code);
  if (!s.rt) {
    s.failed = true;
    return;
  }
  s.simTime = 0;
  s.prevKnobs = s.knobs.slice();
  for (let i = 0; i < STILL_STEPS; i++) step(s, STILL_DT, false);
}

/** The still being made: its runtime, and how far into the pattern it has got. */
let making: { key: string; rt: PatternRuntime; steps: number; t: number } | null = null;

/**
 * A screen's still, a few milliseconds of it at a time: the picture when it
 * is done, null when the pattern fails, undefined while there is more to do
 * (ask again next frame).
 */
function renderStill(s: Screen, key: string): ImageData | null | undefined {
  if (!making || making.key !== key) {
    const rt = makeRuntime(s.code);
    if (!rt) return null;
    making = { key, rt, steps: 0, t: 0 };
  }
  const m = making;
  const began = performance.now();
  while (m.steps < STILL_STEPS) {
    m.t += STILL_DT;
    m.steps++;
    if (!m.rt.renderFrame(STILL_DT, m.t, input(s.knobs, s.ranges, null)).ok) {
      making = null;
      return null;
    }
    if (performance.now() - began >= STILL_BUDGET_MS) break;
  }
  if (m.steps < STILL_STEPS) return undefined;
  making = null;
  return new ImageData(new Uint8ClampedArray(m.rt.data), m.rt.width, m.rt.height);
}

function tick(now: number) {
  raf = 0;
  if (!active) return;
  let more = false;
  let stillMade = false;
  for (const s of screens) {
    if (s.failed) continue;
    if (s.playing) {
      warm(s);
      if (!s.rt) continue;
      let remaining = Math.min(Math.max(0, (now - s.lastNow) / 1000), MAX_CATCHUP);
      s.lastNow = now;
      let first = true;
      do {
        const slice = remaining > MAX_STEP ? MAX_STEP : remaining;
        if (!step(s, slice, first)) break;
        remaining -= slice;
        first = false;
      } while (remaining > 1e-5);
      paint(s, s.rt.data);
      more = true;
      continue;
    }
    if (s.dirty && s.rt) {
      // Stopped, knobs moved: one frame at the new setting (the sandbox does the same).
      step(s, 0, true);
      paint(s, s.rt.data);
      s.dirty = false;
      continue;
    }
    if (!s.painted) {
      const k = stillKey(s);
      if (stills.has(k)) {
        const img = stills.get(k);
        if (img) paint(s, img);
        else s.failed = true;
      } else if (!stillMade) {
        // One still at a time, a little of it a frame: a page of them never holds the page up.
        stillMade = true;
        const img = renderStill(s, k);
        if (img !== undefined) {
          stills.set(k, img);
          if (img) paint(s, img);
          else s.failed = true;
        }
      } else {
        more = true;
      }
    }
  }
  if (more || stillMade) raf = requestAnimationFrame(tick);
}

function wake() {
  if (!raf && active && typeof window !== "undefined") raf = requestAnimationFrame(tick);
}

/** The practice window is on the desk (or not): screens run only while it is. */
export function setScreensActive(on: boolean) {
  active = on;
  if (on) {
    const now = performance.now();
    for (const s of screens) s.lastNow = now;
    wake();
  } else if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

export type ScreenCtl = {
  set: (next: { knobs?: number[]; playing?: boolean }) => void;
  detach: () => void;
};

/** Put a pattern on a canvas (sized to the pattern's frame). */
export function attachScreen(
  canvas: HTMLCanvasElement,
  opts: { key: string; code: string; knobs: number[]; ranges: Ranges; playing: boolean },
): ScreenCtl {
  const frame = matrixFromCode(opts.code);
  canvas.width = frame.width;
  canvas.height = frame.height;
  const s: Screen = {
    canvas,
    key: opts.key,
    code: opts.code,
    ranges: opts.ranges,
    knobs: opts.knobs.slice(),
    prevKnobs: null,
    playing: opts.playing,
    rt: null,
    simTime: 0,
    lastNow: performance.now(),
    painted: false,
    dirty: false,
    failed: false,
    img: null,
  };
  screens.add(s);
  wake();
  return {
    set: ({ knobs, playing }) => {
      if (knobs && knobs.join(",") !== s.knobs.join(",")) {
        s.knobs = knobs.slice();
        if (!s.playing) {
          if (s.rt) s.dirty = true;
          else s.painted = false; // a new still at the new setting
        }
      }
      if (playing !== undefined && playing !== s.playing) {
        s.playing = playing;
        s.lastNow = performance.now();
      }
      wake();
    },
    detach: () => {
      screens.delete(s);
    },
  };
}
