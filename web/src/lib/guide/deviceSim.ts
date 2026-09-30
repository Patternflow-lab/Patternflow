// A Patternflow in the browser: four encoders with push, the panel, and the
// device's own screens on top of whatever pattern is running.
//
// The guide's 3D device drives this and paints its `frame` onto the LED mesh.
// It is a simulation of the FIRMWARE's behaviour, not of a pattern: the
// patterns themselves run on the lab's real runtime (PatternRuntime), and the
// screens are drawn by panelScreens.ts, ported from patternflow.ino. What this
// file owns is the part in between — which knob opens which screen, how long a
// long-press is, what a turn does while a screen is open — and every rule in
// it is one the firmware has; FIRMWARE carries the numbers and their sources.
//
// Knobs are addressed by their LOGICAL index, 0..3 = K1..K4, the numbers the
// device prints on its KNOB MAP screen. Where each one sits on the front is
// the 3D stage's business.

import { PATTERN_DETENTS_PER_TURN, PatternRuntime, type ColorRamp, type PatternInput } from "@/lib/pattern/harness";
import { parseRampAnnotation } from "@/lib/pattern/ramp";
import { hexToRgb } from "@/lib/pattern/color";
import { knobSetupFromCode } from "@/lib/community/knobs";
import { LOGICAL_KNOB_DEFAULTS, knobUnitsPerTurn } from "@/lib/pattern/controls";
import { livePresets } from "@/lib/presets";
import { BASICS_PACK } from "@/lib/pattern/packs";
import { BASICS_NAMES } from "./basicsNames";
import {
  brightnessPercent,
  drawOverlay,
  FIRMWARE,
  PANEL_H,
  PANEL_W,
  stepBrightness,
  stepSelect,
  wrapIndex,
  type PanelOverlay,
} from "./panelScreens";

export type SimMode = "off" | "run" | "brightness" | "network" | "knobmap" | "select" | "sleep";
export type SimPack = "origin" | "basics";

export type SimPattern = {
  slug: string;
  /** What the SELECT screen prints — the module's NAME. */
  name: string;
  code: string;
};

type Knob = {
  down: boolean;
  downAt: number;
  longFired: boolean;
  /** Set on release of a short press; consumed by the next frame. */
  clicked: boolean;
  /** The press edge, for the pattern; consumed by the next frame. */
  edge: boolean;
};

type FrameInput = { detents: number[]; edges: boolean[]; clicks: boolean[]; longs: boolean[] };

/** The address the simulated board shows on its NETWORK screen; the guide's phone types the same one. */
export const SIM_IP = "192.168.0.42";

// The ramp a setValue() pattern gets without an @ramp line, same as the
// community sandbox, so a pattern looks here the way it does on its card.
const DEFAULT_RAMP: ColorRamp = {
  stops: [
    { position: 0.0, color: [8, 24, 64] },
    { position: 0.55, color: [255, 77, 0] },
    { position: 1.0, color: [255, 232, 154] },
  ],
  mode: "linear",
  wrap: false,
};

const ORIGIN: SimPattern = (() => {
  const origin = livePresets.find((p) => p.id === "origin");
  return { slug: "origin", name: "Origin", code: origin?.code ?? "" };
})();

/** Origin first, as on a board: the firmware compiles it in, the pack adds the rest. */
function basicsPatterns(): SimPattern[] {
  const list: SimPattern[] = [ORIGIN];
  for (const slug of BASICS_PACK.order) {
    const num = BASICS_PACK.presets[slug];
    const preset = num === undefined ? undefined : livePresets.find((p) => p.num === num);
    if (!preset) continue; // built outside the repo: no JS twin to run
    list.push({ slug, name: BASICS_NAMES[slug] ?? slug, code: preset.code });
  }
  return list;
}

/** The count a board shows after the Basics pack, whether or not every module has a JS twin here. */
export const BASICS_BOARD_COUNT = 1 + BASICS_PACK.order.length;

export type SimSnapshot = {
  mode: SimMode;
  pack: SimPack;
  patternIndex: number;
  patternName: string;
  patternCount: number;
  brightness: number;
  /** Knob being turned in the last ~0.4 s, for highlights. */
  activeKnob: number | null;
  /** 0..1 progress of a hold towards a long-press, per knob. */
  hold: [number, number, number, number];
  /** Every detent each knob has turned since load, clockwise positive — the stage turns the 3D knob by it. */
  turns: [number, number, number, number];
  down: [boolean, boolean, boolean, boolean];
};

export class DeviceSim {
  /** 128×64 RGBA, landscape, y = 0 at the top — what the panel shows. */
  readonly frame = new Uint8ClampedArray(PANEL_W * PANEL_H * 4);

  private runtime = new PatternRuntime(PANEL_W, PANEL_H);
  private patterns: SimPattern[] = [ORIGIN];
  private pack: SimPack = "origin";
  private active = 0; // the pattern running
  private cursor = 0; // the pattern highlighted on SELECT
  private values = new Map<string, number[]>();
  private ranges: Array<[number, number]> = [];
  private wraps: boolean[] = [false, false, false, false];

  private mode: SimMode = "run";
  /** The panel's brightness byte, 5..255, as the firmware keeps it. */
  private level: number = FIRMWARE.defaultBrightness;
  /** When the open screen's idle timer last restarted. */
  private idleAt = 0;
  private sleptAt = 0;
  private now = 0;
  private time = 0;

  private knobs: Knob[] = Array.from({ length: 4 }, () => ({
    down: false,
    downAt: 0,
    longFired: false,
    clicked: false,
    edge: false,
  }));
  private pendingDetents = [0, 0, 0, 0];
  private selectAccum = 0;
  private selectMovedAt = 0;
  private selectPending = false;
  private activeKnob: number | null = null;
  private activeKnobAt = 0;
  /** When each knob last moved a detent — KNOB MAP lights it for a while. */
  private litAt = [-1e9, -1e9, -1e9, -1e9];
  private bootAt = -1;
  private turns: [number, number, number, number] = [0, 0, 0, 0];

  /** Called with the new mode whenever it changes. */
  onModeChange: ((mode: SimMode) => void) | null = null;

  constructor() {
    this.load(0);
  }

  // ── what the stage asks ────────────────────────────────────────────────────

  snapshot(): SimSnapshot {
    const hold = this.knobs.map((k) =>
      k.down && !k.longFired ? Math.min(1, (this.now - k.downAt) / FIRMWARE.longPressMs) : 0,
    ) as SimSnapshot["hold"];
    const shownIndex = this.mode === "select" ? this.cursor : this.active;
    return {
      mode: this.mode,
      pack: this.pack,
      patternIndex: shownIndex,
      patternName: this.patterns[shownIndex]?.name ?? "",
      patternCount: this.boardCount(),
      brightness: brightnessPercent(this.level),
      activeKnob: this.now - this.activeKnobAt < 400 ? this.activeKnob : null,
      hold,
      turns: [...this.turns] as SimSnapshot["turns"],
      down: this.knobs.map((k) => k.down) as SimSnapshot["down"],
    };
  }

  /** Put the board in a state, the way a scene of the guide wants to show it. */
  setPack(pack: SimPack) {
    if (pack === this.pack) return;
    this.pack = pack;
    const runningSlug = this.patterns[this.active]?.slug;
    this.patterns = pack === "basics" ? basicsPatterns() : [ORIGIN];
    const keep = this.patterns.findIndex((p) => p.slug === runningSlug);
    this.cursor = this.active = keep >= 0 ? keep : 0;
    if (keep < 0) this.load(0);
  }

  setMode(mode: SimMode) {
    if (mode === "select") {
      this.cursor = this.active;
      this.selectAccum = 0;
    }
    if (mode === "run" && this.mode === "off") this.bootAt = this.now;
    this.enter(mode);
  }

  /** Jump to a pattern by slug (or index), as if chosen on SELECT. */
  showPattern(which: string | number) {
    const index = typeof which === "number" ? which : this.patterns.findIndex((p) => p.slug === which);
    if (index < 0 || index >= this.patterns.length) return;
    this.cursor = index;
    if (index !== this.active) this.load(index);
  }

  // ── the hands ──────────────────────────────────────────────────────────────

  /** Encoder detents, clockwise positive. */
  turn(knob: number, detents: number) {
    if (!Number.isFinite(detents) || detents === 0) return;
    this.pendingDetents[knob] += detents;
    this.turns[knob] += detents;
    this.activeKnob = knob;
    this.activeKnobAt = this.now;
  }

  press(knob: number) {
    const k = this.knobs[knob];
    if (k.down) return;
    k.down = true;
    k.downAt = this.now;
    k.longFired = false;
    k.edge = true;
  }

  release(knob: number) {
    const k = this.knobs[knob];
    if (!k.down) return;
    k.down = false;
    // A hold that crossed the threshold already fired its long-press; its
    // release is the tail of that gesture, not a click (core_encoders.h:151).
    if (!k.longFired) k.clicked = true;
  }

  /** A press that turned into a turn: let go without it counting as a click. */
  cancel(knob: number) {
    const k = this.knobs[knob];
    k.down = false;
    k.longFired = false;
    k.clicked = false;
    k.edge = false;
  }

  /** Let go of everything — the pointer left the canvas, the tab hid. */
  releaseAll() {
    this.knobs.forEach((k) => {
      k.down = false;
      k.longFired = false;
      k.clicked = false;
      k.edge = false;
    });
  }

  // ── the loop ───────────────────────────────────────────────────────────────

  /** Advance by dt seconds and repaint `frame`. */
  tick(dt: number) {
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.now += step * 1000;
    this.time += step;

    const input: FrameInput = {
      detents: this.pendingDetents,
      edges: this.knobs.map((k) => {
        const e = k.edge;
        k.edge = false;
        return e;
      }),
      clicks: this.knobs.map((k) => {
        const c = k.clicked;
        k.clicked = false;
        return c;
      }),
      // Fires while still held, once the hold passes the threshold (strict >).
      longs: this.knobs.map((k) => {
        if (k.down && !k.longFired && this.now - k.downAt > FIRMWARE.longPressMs) {
          k.longFired = true;
          return true;
        }
        return false;
      }),
    };
    this.pendingDetents = [0, 0, 0, 0];

    const toPattern = this.handle(input);
    this.render(step, toPattern);
  }

  // ── firmware rules (patternflow.ino; see panelScreens.ts FIRMWARE) ──────────

  /** Applies the frame's input to the device and returns what reaches the pattern. */
  private handle(f: FrameInput): { detents: number[]; presses: boolean[] } {
    const none = () => ({ detents: [0, 0, 0, 0], presses: [false, false, false, false] });
    const any = f.detents.some((d) => d !== 0) || f.edges.some(Boolean);
    f.detents.forEach((d, i) => {
      if (d) this.litAt[i] = this.now;
    });

    if (this.mode === "off") return none();

    if (this.mode === "sleep") {
      // Any turn or press wakes it once the guard has passed; the input that
      // woke it never reaches the pattern, and held buttons are retired so
      // no long-press fires afterwards.
      if (any && this.now - this.sleptAt > FIRMWARE.wakeGuardMs) {
        this.knobs.forEach((k) => {
          if (k.down) k.longFired = true;
        });
        this.enter("run");
      }
      return none();
    }

    switch (this.mode) {
      case "brightness": {
        if (f.detents[0]) {
          const next = stepBrightness(this.level, f.detents[0]);
          if (next !== this.level) {
            this.level = next;
            this.idleAt = this.now;
          }
        }
        if (f.clicks[0] || f.longs[0]) {
          this.enter("run");
          return none();
        }
        if (f.longs[1]) return this.enterFrom("network");
        if (f.longs[2]) return this.enterFrom("knobmap");
        if (f.longs[3]) return this.enterFrom("select");
        if (this.idleFor(FIRMWARE.brightnessIdleExitMs)) this.enter("run");
        // K1 is the screen's; K2..K4 still play the pattern.
        this.moveValues(f.detents, [1, 2, 3]);
        return {
          detents: [0, f.detents[1], f.detents[2], f.detents[3]],
          presses: [false, f.edges[1], f.edges[2], f.edges[3]],
        };
      }
      case "network": {
        if (f.detents[0]) {
          this.sleptAt = this.now;
          this.enter("sleep");
          return none();
        }
        if (f.detents[1] || f.detents[2]) this.idleAt = this.now;
        if (f.longs[1] || f.clicks[1]) this.enter("run");
        else if (this.idleFor(FIRMWARE.networkIdleExitMs)) this.enter("run");
        return none();
      }
      case "knobmap": {
        if (f.detents.some((d) => d !== 0)) this.idleAt = this.now;
        if (f.longs[2] || f.clicks[2]) this.enter("run");
        else if (this.idleFor(FIRMWARE.knobmapIdleExitMs)) this.enter("run");
        return none();
      }
      case "select": {
        if (f.detents[3]) {
          const r = stepSelect(this.selectAccum, f.detents[3]);
          this.selectAccum = r.accum;
          if (r.steps !== 0) {
            this.cursor = wrapIndex(this.cursor + r.steps, this.patterns.length);
            this.selectPending = true;
            this.selectMovedAt = this.now;
          }
        }
        if (this.selectPending && this.now - this.selectMovedAt >= FIRMWARE.selectSettleMs) {
          this.selectPending = false;
          if (this.cursor !== this.active) this.load(this.cursor);
        }
        if (f.longs[3]) {
          this.selectPending = false;
          if (this.cursor !== this.active) this.load(this.cursor);
          this.enter("run");
        }
        // The preview behind the list gets neutral input.
        return none();
      }
      case "run": {
        if (f.longs[0]) this.enter("brightness");
        else if (f.longs[1]) this.enter("network");
        else if (f.longs[2]) this.enter("knobmap");
        else if (f.longs[3]) {
          this.cursor = this.active;
          this.selectAccum = 0;
          this.enter("select");
        }
        // The press edge reaches the pattern the moment the button goes down,
        // so a long-press delivers one too (patternflow.ino:1201-1205).
        this.moveValues(f.detents, [0, 1, 2, 3]);
        return { detents: f.detents.slice(), presses: f.edges.slice() };
      }
    }
    return none();
  }

  private enterFrom(mode: SimMode) {
    this.setMode(mode);
    return { detents: [0, 0, 0, 0], presses: [false, false, false, false] };
  }

  private moveValues(detents: number[], knobs: number[]) {
    const values = this.currentValues();
    for (const i of knobs) {
      const d = detents[i];
      if (!d) continue;
      const [min, max] = this.ranges[i] ?? [0, 1];
      const next = values[i] + d * (knobUnitsPerTurn([min, max]) / PATTERN_DETENTS_PER_TURN);
      values[i] = this.wraps[i] ? wrap(next, min, max) : clamp(next, min, max);
    }
  }

  private enter(mode: SimMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.idleAt = this.now;
    this.onModeChange?.(mode);
  }

  private idleFor(ms: number) {
    return this.now - this.idleAt > ms;
  }

  private boardCount() {
    // A pack module without a JS twin is still on the board.
    return this.pack === "basics" ? BASICS_BOARD_COUNT : 1;
  }

  // ── patterns ───────────────────────────────────────────────────────────────

  private load(index: number) {
    const pattern = this.patterns[index];
    if (!pattern) return;
    this.active = index;
    const annotation = parseRampAnnotation(pattern.code);
    this.runtime.setRamp(
      annotation
        ? {
            stops: annotation.stops.map((s) => ({ position: s.position, color: hexToRgb(s.color) })),
            mode: annotation.mode,
            wrap: annotation.wrap,
          }
        : DEFAULT_RAMP,
    );
    this.runtime.recolor = Boolean(annotation?.recolor);
    this.runtime.loadCode(pattern.code);

    const setup = knobSetupFromCode(pattern.code);
    this.ranges = setup.ranges;
    const annotated = setup.ranges.some(
      (r, i) => r[0] !== [0, 0.1, 0, 0][i] || r[1] !== [1, 10, 4.9, 1][i],
    );
    this.wraps = annotated ? [false, false, false, false] : [true, false, false, true];
    if (!this.values.has(pattern.slug)) {
      // Origin starts where its setup() does; anything else in the middle of
      // its ranges, as the community cards do.
      this.values.set(pattern.slug, pattern.slug === "origin" ? [...LOGICAL_KNOB_DEFAULTS] : [...setup.values]);
    }
  }

  private currentValues() {
    const slug = this.patterns[this.active]?.slug ?? "origin";
    let v = this.values.get(slug);
    if (!v) {
      v = [...LOGICAL_KNOB_DEFAULTS];
      this.values.set(slug, v);
    }
    return v;
  }

  private render(dt: number, toPattern: { detents: number[]; presses: boolean[] }) {
    const out = this.frame;
    if (this.mode === "off" || this.mode === "sleep") {
      out.fill(0);
      for (let i = 3; i < out.length; i += 4) out[i] = 255;
      return;
    }

    const values = this.currentValues();
    const ranges = this.ranges;
    const input: PatternInput = {
      knobDeltas: toPattern.detents,
      knobValues: values.slice(),
      knobNormalized: values.map((v, i) => {
        const [min, max] = ranges[i] ?? [0, 1];
        return (v - min) / Math.max(0.0001, max - min);
      }),
      knobRanges: ranges,
      btnPressed: toPattern.presses,
      btnHeld: this.knobs.map((k) => this.mode === "run" && k.down),
    };
    this.runtime.renderFrame(dt, this.time, input);

    const src = this.runtime.data;
    // A short power-on: the frame fades up over the first 0.6 s after boot.
    const boot = this.bootAt < 0 ? 1 : Math.min(1, (this.now - this.bootAt) / 600);
    const gain = (this.level / 255) * boot;
    for (let i = 0; i < src.length; i += 4) {
      const a = src[i + 3] / 255;
      out[i] = src[i] * a * gain;
      out[i + 1] = src[i + 1] * a * gain;
      out[i + 2] = src[i + 2] * a * gain;
      out[i + 3] = 255;
    }

    const overlay = this.overlay();
    if (overlay) drawOverlay(out, overlay);
  }

  private overlay(): PanelOverlay | null {
    switch (this.mode) {
      case "brightness":
        return { kind: "brightness", percent: brightnessPercent(this.level) };
      case "network":
        return { kind: "network", wifi: "CONNECTED", ip: SIM_IP };
      case "knobmap":
        return {
          kind: "knobmap",
          activeKnob: null,
          activeKnobs: [0, 1, 2, 3].filter((i) => this.now - this.litAt[i] < FIRMWARE.knobmapHighlightMs),
        };
      case "select":
        return {
          kind: "select",
          rank: this.cursor + 1,
          count: this.boardCount(),
          name: this.patterns[this.cursor]?.name ?? "",
        };
      default:
        return null;
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function wrap(v: number, min: number, max: number) {
  const span = max - min;
  if (span <= 0) return min;
  return ((((v - min) % span) + span) % span) + min;
}
