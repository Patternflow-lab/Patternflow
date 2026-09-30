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

import {
  PATTERN_DETENTS_PER_TURN,
  PatternRuntime,
  knobTargetToDelta,
  type ColorRamp,
  type PatternInput,
} from "@/lib/pattern/harness";
import { parseRampAnnotation } from "@/lib/pattern/ramp";
import { hexToRgb } from "@/lib/pattern/color";
import { knobSetupFromCode } from "@/lib/community/knobs";
import { LOGICAL_KNOB_DEFAULTS, LOGICAL_KNOB_WRAP, knobUnitsPerTurn } from "@/lib/pattern/controls";
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

/**
 * A pattern from outside the board's list, played as the running one: the
 * reader's own Pattern Lab draft (lib/guide/labMirror.ts turns the saved
 * project into this, the way the lab turns it into one pattern for hardware).
 * Nothing here is written anywhere; the board only runs it.
 */
export type SimMirror = {
  /** What the lab calls it — the name its hardware export would carry. */
  name: string;
  /** One runnable pattern: the layer stack flattened, or the one code layer. */
  code: string;
  /** The frame the pattern draws in (the lab's matrix). */
  width: number;
  height: number;
  /** The code layer's ramp, for setValue() and recolor; null for a flattened stack (its ramps are baked in). */
  ramp: ColorRamp | null;
  recolor: boolean;
  /** The lab's four knobs: their names, ranges and where they are. */
  labels: string[];
  ranges: Array<[number, number]>;
  values: number[];
};

type MirrorRun = {
  spec: SimMirror;
  runtime: PatternRuntime;
  /** Where the knobs are on the board: the lab's values, then whatever the knobs did. */
  values: number[];
  /** A change the lab made to a knob, owed to the pattern as the lab would pass it (engine.ts). */
  owed: number[];
  /** Why the draft's code would not load (a syntax error, a setup() that threw); null when it loaded. */
  loadError: string | null;
  /** Frames in a row whose update()/draw() threw, and the last reason. */
  fails: number;
  error: string | null;
};

/**
 * A draft whose frames have thrown this many times in a row doesn't run: the
 * board plays its own pattern again underneath, and says so (mirrorState).
 * One that throws now and then keeps playing.
 */
const MIRROR_FAILS = 5;

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

// Origin's knobs, as its header comment names them (lib/presets/pattern-origin.ts).
const ORIGIN_LABELS = ["hue", "speed", "tiling", "freq"];

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
  /** The running pattern is a mirrored Pattern Lab draft (setMirror), not one of the board's. */
  mirror: boolean;
};

/** A mirrored draft as the stage tells the reader about it (MirrorTag). */
export type SimMirrorState = {
  /** What the lab calls the draft. */
  name: string;
  /** The draft doesn't run — its code won't load, or every frame throws — so the board plays its own pattern. */
  broken: boolean;
  /** Why, in the runtime's words; null while it runs. */
  error: string | null;
};

/** What the device console reads off the board (ConsoleWindow's bridge). */
export type SimConsoleState = {
  /** The running pattern — not SELECT's cursor, which has not loaded yet. */
  patternIndex: number;
  patternName: string;
  patternSlug: string;
  /** The brightness byte, 5..255, and the percent the panel prints for it. */
  level: number;
  brightness: number;
  sleeping: boolean;
  /** No power: nothing answers. */
  off: boolean;
  /** Detents each encoder has turned since load, clockwise positive. */
  knobs: [number, number, number, number];
};

// The absolute parameter bus (src/core_bus.h): what the console's sliders
// write. A channel is held once written; a change of the held value reaches
// a pattern as clicks, ten bus units each, the remainder carried; a hand on
// that encoder takes it back after a grace.
const BUS_UNITS_PER_CLICK = 10;
const BUS_RELEASE_GRACE_MS = 250;

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
  /** What the running pattern calls each knob (its @knobs line, or Origin's own). */
  private labels: string[] = [...ORIGIN_LABELS];

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
  /** Until when the name card of a console pick stays up (patternflow.ino contentNoticeTimer). */
  private noticeUntil = -1;
  private turns: [number, number, number, number] = [0, 0, 0, 0];

  // The console's side of the board, all neutral until a console sets them.
  /** The installed modules when the console has changed them from the pack; null = the pack as shipped. */
  private moduleSlugs: string[] | null = null;
  /** Clicks per detent, signed: the /knobs page's direction and edges per click (4 edges a detent). */
  private clickScale = [1, 1, 1, 1];
  private busHeld = [false, false, false, false];
  private busHeldAt = [0, 0, 0, 0];
  private busValue = [500, 500, 500, 500];
  private busResidual = [0, 0, 0, 0];
  private busPending = [0, 0, 0, 0];

  // A Pattern Lab draft played over the board (setMirror). It has its own
  // runtime, so the board's pattern is left exactly where it was and comes
  // back as it was when the mirror goes.
  private mirror: MirrorRun | null = null;
  /** The mirror is what runs: set by setMirror, cleared by a pick (SELECT, a console). */
  private mirrorOn = false;

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
    const mirrored = this.mirroring && this.mode !== "select";
    return {
      mode: this.mode,
      pack: this.pack,
      patternIndex: shownIndex,
      patternName: mirrored ? (this.mirror?.spec.name ?? "") : (this.patterns[shownIndex]?.name ?? ""),
      patternCount: this.boardCount(),
      brightness: brightnessPercent(this.level),
      activeKnob: this.now - this.activeKnobAt < 400 ? this.activeKnob : null,
      hold,
      turns: [...this.turns] as SimSnapshot["turns"],
      down: this.knobs.map((k) => k.down) as SimSnapshot["down"],
      mirror: this.mirroring,
    };
  }

  // ── a Pattern Lab draft on the board ───────────────────────────────────────

  /**
   * Play a pattern that is not on the board — the reader's Pattern Lab draft —
   * as the running one, or (null) put the board's own pattern back exactly as
   * it was: same pattern, same knob values, its runtime never touched.
   *
   * Calling it again with a changed draft follows the change: new code or a
   * new frame loads it afresh; a new ramp recolours; a knob the lab moved
   * moves here too, and one it left alone stays where the board's knobs put
   * it. The name card comes up when the mirror starts and when its name
   * changes, as it does on a board when a pattern arrives.
   *
   * A pick on SELECT (or from a console) takes the mirror off: the board then
   * plays what was picked, until setMirror is called again.
   */
  setMirror(spec: SimMirror | null) {
    if (!spec) {
      if (this.mirrorOn && this.mode === "run") this.noticeUntil = -1;
      this.mirror = null;
      this.mirrorOn = false;
      return;
    }
    const width = Math.max(1, Math.round(spec.width));
    const height = Math.max(1, Math.round(spec.height));
    const prev = this.mirror;
    const sameFrame = prev !== null && prev.runtime.width === width && prev.runtime.height === height;
    const run: MirrorRun =
      prev && sameFrame
        ? prev
        : {
            spec,
            runtime: new PatternRuntime(width, height),
            values: [0, 0, 0, 0],
            owed: [0, 0, 0, 0],
            loadError: null,
            fails: 0,
            error: null,
          };

    if (!prev || !sameFrame || prev.spec.code !== spec.code) {
      run.runtime.setRamp(spec.ramp);
      run.runtime.recolor = spec.recolor;
      const loaded = run.runtime.loadCode(spec.code);
      run.loadError = loaded.ok ? null : (loaded.error ?? "It doesn't load.");
      run.fails = 0;
      run.error = null;
    } else if (prev.spec.recolor !== spec.recolor || JSON.stringify(prev.spec.ramp) !== JSON.stringify(spec.ramp)) {
      run.runtime.setRamp(spec.ramp);
      run.runtime.recolor = spec.recolor;
    }

    for (let i = 0; i < 4; i++) {
      const [min, max] = spec.ranges[i] ?? [0, 1];
      const want = Number.isFinite(spec.values[i]) ? spec.values[i] : min;
      const fresh = !prev || run !== prev;
      if (fresh) {
        run.values[i] = clamp(want, min, max);
        run.owed[i] = 0;
        continue;
      }
      const before = prev.spec.values[i];
      const [pmin, pmax] = prev.spec.ranges[i] ?? [0, 1];
      if (want !== before || min !== pmin || max !== pmax) {
        // The lab moved it: the pattern hears it the way the lab's own
        // preview passes a slider's move (engine.ts, knobTargetToDelta).
        const next = clamp(want, min, max);
        run.owed[i] += knobTargetToDelta(run.values[i], next, LOGICAL_KNOB_WRAP[i], knobUnitsPerTurn([min, max]));
        run.values[i] = next;
      } else {
        run.values[i] = clamp(run.values[i], min, max);
      }
    }

    const renamed = !prev || prev.spec.name !== spec.name;
    run.spec = spec;
    this.mirror = run;
    if (!this.mirrorOn || renamed) {
      this.mirrorOn = true;
      // The name card, as a board shows one arriving — not for a draft that
      // doesn't run, whose name would sit over the board's own pattern.
      if (this.mode !== "select" && !mirrorBroken(run)) this.noticeUntil = this.now + FIRMWARE.contentNoticeMs;
    }
  }

  /** The board is playing the mirrored draft right now (set, not picked away, and it runs). */
  get mirroring(): boolean {
    return this.mirrorOn && this.mirror !== null && !mirrorBroken(this.mirror);
  }

  /** The mirrored draft, set and not picked away — running or not; null otherwise. */
  mirrorState(): SimMirrorState | null {
    const m = this.mirrorOn ? this.mirror : null;
    if (!m) return null;
    const broken = mirrorBroken(m);
    return { name: m.spec.name, broken, error: broken ? (m.loadError ?? m.error) : null };
  }

  /** Put the board in a state, the way a scene of the guide wants to show it. */
  setPack(pack: SimPack) {
    if (pack === this.pack) return;
    this.pack = pack;
    const runningSlug = this.patterns[this.active]?.slug;
    this.patterns = pack === "basics" ? this.installed() : [ORIGIN];
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
    this.pick(index);
  }

  /** A pattern of the board's is chosen: it runs (loaded if it wasn't), and a mirrored draft steps aside. */
  private pick(index: number) {
    if (index !== this.active) this.load(index);
    this.mirrorOn = false;
  }

  // ── the hands ──────────────────────────────────────────────────────────────

  /** Encoder detents, clockwise positive. */
  turn(knob: number, detents: number) {
    if (!Number.isFinite(detents) || detents === 0) return;
    // clickScale is 1 unless a console changed the knob's settings.
    this.pendingDetents[knob] += detents * this.clickScale[knob];
    this.turns[knob] += detents;
    // Physical motion takes a held bus channel back (PatternflowBus::releaseAbsolute).
    if (this.busHeld[knob] && this.now - this.busHeldAt[knob] >= BUS_RELEASE_GRACE_MS) this.releaseBus(knob);
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
    if (this.busPending.some((d) => d !== 0)) this.applyBus(toPattern.detents);
    this.render(step, toPattern);
  }

  // ── the console (ConsoleWindow bridges the demo console to these) ──────────

  /** What /api/status would say about the board right now. */
  consoleState(): SimConsoleState {
    const p = this.patterns[this.active];
    return {
      patternIndex: this.active,
      patternName: p?.name ?? "",
      patternSlug: p?.slug ?? "origin",
      level: this.level,
      brightness: brightnessPercent(this.level),
      sleeping: this.mode === "sleep",
      off: this.mode === "off",
      knobs: [...this.turns] as SimConsoleState["knobs"],
    };
  }

  /**
   * GET /api/patterns/select: switch to a pattern by slug, as the console
   * does. The board goes back to running it, closing any screen, and shows
   * its name upright for a second (patternflow.ino:1798-1808, :1891-1893).
   * False if the board cannot run it here.
   */
  selectPattern(slug: string): boolean {
    if (this.mode === "off") return false;
    if (slug !== "origin" && this.pack !== "basics") this.setPack("basics");
    const index = this.patterns.findIndex((p) => p.slug === slug);
    if (index < 0) return false;
    this.showPattern(index);
    if (this.mode !== "sleep" && this.mode !== "run") this.enter("run");
    this.noticeUntil = this.now + FIRMWARE.contentNoticeMs;
    return true;
  }

  /** GET /api/display?brightness=: the byte, 5..255, the same one K1's screen moves. */
  setBrightnessLevel(level: number) {
    if (!Number.isFinite(level)) return;
    this.level = clamp(Math.round(level), FIRMWARE.brightnessMin, FIRMWARE.brightnessMax);
  }

  /** POST /api/sleep: the panel goes dark (or wakes) without a knob being touched. */
  setSleeping(on: boolean) {
    if (this.mode === "off") return;
    if (on && this.mode !== "sleep") {
      this.sleptAt = this.now;
      this.enter("sleep");
    } else if (!on && this.mode === "sleep") {
      this.enter("run");
    }
  }

  /**
   * POST /api/params pN: a console slider, 0..1000. The first write only holds
   * the channel; every later change moves a pattern by one click per ten units
   * (core_bus.h applyRemoteParam). The 3D knob does not turn — nothing did.
   */
  applyRemoteParam(knob: number, value: number) {
    if (knob < 0 || knob > 3 || !Number.isFinite(value)) return;
    const v = clamp(Math.round(value), 0, 1000);
    if (this.busHeld[knob]) {
      const acc = this.busResidual[knob] + (v - this.busValue[knob]);
      const d = Math.trunc(acc / BUS_UNITS_PER_CLICK);
      this.busResidual[knob] = acc - d * BUS_UNITS_PER_CLICK;
      this.busPending[knob] += d;
    }
    this.busHeld[knob] = true;
    this.busValue[knob] = v;
    this.busHeldAt[knob] = this.now;
  }

  /** What a knob controls on the running pattern, for the readout beside it. */
  knobReadout(knob: number): { label: string; value: number; min: number; max: number } {
    const m = this.mirroring ? this.mirror : null;
    if (m) {
      // The lab's names for its knobs, printed the way the board's own are.
      const [min, max] = m.spec.ranges[knob] ?? [0, 1];
      const raw = (m.spec.labels[knob] ?? "").trim();
      const label = !raw || raw === `Knob ${knob + 1}` ? "value" : raw.toLowerCase();
      return { label, value: m.values[knob] ?? min, min, max };
    }
    const [min, max] = this.ranges[knob] ?? [0, 1];
    return { label: this.labels[knob] ?? "value", value: this.currentValues()[knob] ?? min, min, max };
  }

  /** The /knobs page: which way each encoder counts and how many of its 4 edges make a click. */
  setKnobSettings(invert: boolean[], edgesPerClick: number[]) {
    for (let i = 0; i < 4; i++) {
      const sub = [1, 2, 4].includes(edgesPerClick[i]) ? edgesPerClick[i] : 4;
      this.clickScale[i] = (invert[i] ? -1 : 1) * (4 / sub);
    }
  }

  /** The modules installed, in device order, when a console changed them; null puts the pack back as shipped. */
  setModules(slugs: string[] | null) {
    const next = slugs && slugs.join("\n") !== BASICS_PACK.order.join("\n") ? [...slugs] : null;
    if ((next?.join("\n") ?? null) === (this.moduleSlugs?.join("\n") ?? null)) return;
    this.moduleSlugs = next;
    if (this.pack !== "basics") return;
    const runningSlug = this.patterns[this.active]?.slug;
    this.patterns = this.installed();
    const keep = this.patterns.findIndex((p) => p.slug === runningSlug);
    this.cursor = this.active = keep >= 0 ? keep : 0;
    if (keep < 0) this.load(0);
  }

  /** Origin, then the pack's modules — or the console's list of them — that have a JS twin to run. */
  private installed(): SimPattern[] {
    if (!this.moduleSlugs) return basicsPatterns();
    const all = basicsPatterns();
    const list: SimPattern[] = [ORIGIN];
    for (const slug of this.moduleSlugs) {
      const p = all.find((x) => x.slug === slug);
      if (p) list.push(p);
    }
    return list;
  }

  private releaseBus(knob: number) {
    this.busHeld[knob] = false;
    this.busPending[knob] = 0;
    this.busResidual[knob] = 0;
  }

  /** The bus's clicks reach the pattern where a turn of that knob would. */
  private applyBus(detents: number[]) {
    const knobs = this.mode === "run" ? [0, 1, 2, 3] : this.mode === "brightness" ? [1, 2, 3] : [];
    const moved = [0, 0, 0, 0];
    for (const i of knobs) moved[i] = this.busPending[i];
    this.busPending = [0, 0, 0, 0];
    if (!knobs.length) return;
    this.moveValues(moved, knobs);
    for (const i of knobs) detents[i] += moved[i];
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
        // A mirrored draft is not on the list; landing on another of the
        // board's patterns takes it off (pick), coming back without leaving
        // doesn't.
        if (this.selectPending && this.now - this.selectMovedAt >= FIRMWARE.selectSettleMs) {
          this.selectPending = false;
          if (this.cursor !== this.active) this.pick(this.cursor);
        }
        if (f.longs[3]) {
          this.selectPending = false;
          if (this.cursor !== this.active) this.pick(this.cursor);
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
        // Origin's own click sends that knob back to its start (its update()
        // zeroes the parameter); the knob's readout follows it there.
        if (!this.mirroring && this.patterns[this.active]?.slug === "origin") {
          const values = this.currentValues();
          f.edges.forEach((e, i) => {
            if (e) values[i] = this.ranges[i]?.[0] ?? 0;
          });
        }
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
    const m = this.mirroring ? this.mirror : null;
    if (m) {
      // The lab's knobs are its sliders: they stop at the ends of their ranges.
      // A detent is the step its hardware export calibrates (knobDetentStep).
      for (const i of knobs) {
        const d = detents[i];
        if (!d) continue;
        const [min, max] = m.spec.ranges[i] ?? [0, 1];
        m.values[i] = clamp(m.values[i] + d * (knobUnitsPerTurn([min, max]) / PATTERN_DETENTS_PER_TURN), min, max);
      }
      return;
    }
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
    // SELECT clears the name card (patternflow.ino:1731).
    if (mode === "select") this.noticeUntil = -1;
    // SELECT drops every held bus channel, so browsing never fights one (patternflow.ino).
    if (mode === "select") for (let i = 0; i < 4; i++) if (this.busHeld[i]) this.releaseBus(i);
    this.mode = mode;
    this.idleAt = this.now;
    this.onModeChange?.(mode);
  }

  private idleFor(ms: number) {
    return this.now - this.idleAt > ms;
  }

  private boardCount() {
    // A pack module without a JS twin is still on the board.
    if (this.pack !== "basics") return 1;
    return this.moduleSlugs ? 1 + this.moduleSlugs.length : BASICS_BOARD_COUNT;
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
    // A pattern without an @knobs line gets "Knob 1".."Knob 4"; Origin's are in its header comment.
    this.labels =
      pattern.slug === "origin"
        ? [...ORIGIN_LABELS]
        : setup.labels.map((l, i) => (l === `Knob ${i + 1}` ? "value" : l.toLowerCase()));
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

    if (this.mirrorOn && this.mirror) {
      const m = this.mirror;
      const wasBroken = mirrorBroken(m);
      // A draft that doesn't run is still tried every frame (with no knob
      // input: the knobs are the board's pattern's meanwhile), so a fix that
      // makes it run again shows at once.
      const none = { detents: [0, 0, 0, 0], presses: [false, false, false, false] };
      if (this.renderMirror(m, dt, wasBroken ? none : toPattern)) {
        const overlay = this.overlay();
        if (overlay) drawOverlay(out, overlay);
        return;
      }
      // It has just stopped running: its name card goes with it.
      if (!wasBroken && mirrorBroken(m) && this.mode === "run") this.noticeUntil = -1;
      // Otherwise the board's own pattern plays underneath, below.
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

  /**
   * One frame of the mirrored draft. The knobs reach it as a board's reach a
   * pattern — the detents turned this frame — plus any move the lab made to
   * one (owed). Its frame goes onto the panel by the firmware's own rule
   * (core_canvas.h setFrame): the panel's size straight through, the panel
   * turned (w×h = 64×128) rotated 90°, anything else centred with the rest
   * left black.
   */
  private renderMirror(m: MirrorRun, dt: number, toPattern: { detents: number[]; presses: boolean[] }): boolean {
    if (m.loadError !== null) return false;
    const ranges = m.spec.ranges;
    const deltas = [0, 1, 2, 3].map((i) => (toPattern.detents[i] ?? 0) + m.owed[i]);
    m.owed = [0, 0, 0, 0];
    const input: PatternInput = {
      knobDeltas: deltas,
      knobValues: m.values.slice(),
      knobNormalized: m.values.map((v, i) => {
        const [min, max] = ranges[i] ?? [0, 1];
        return (v - min) / Math.max(0.0001, max - min);
      }),
      knobRanges: ranges.map((r) => [r[0], r[1]] as [number, number]),
      btnPressed: toPattern.presses,
      btnHeld: this.knobs.map((k) => this.mode === "run" && k.down),
    };
    const result = m.runtime.renderFrame(dt, this.time, input);
    if (!result.ok) {
      m.fails++;
      m.error = result.error ?? null;
      if (m.fails >= MIRROR_FAILS) return false;
    } else {
      m.fails = 0;
      m.error = null;
    }

    const out = this.frame;
    const src = m.runtime.data;
    const w = m.runtime.width;
    const h = m.runtime.height;
    const boot = this.bootAt < 0 ? 1 : Math.min(1, (this.now - this.bootAt) / 600);
    const gain = (this.level / 255) * boot;
    out.fill(0);
    for (let i = 3; i < out.length; i += 4) out[i] = 255;
    const direct = w === PANEL_W && h === PANEL_H;
    const rotate = !direct && w === PANEL_H && h === PANEL_W;
    // C's integer division truncates toward zero; so does Math.trunc.
    const offX = direct || rotate ? 0 : Math.trunc((PANEL_W - w) / 2);
    const offY = direct || rotate ? 0 : Math.trunc((PANEL_H - h) / 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = rotate ? PANEL_W - 1 - y : x + offX;
        const py = rotate ? x : y + offY;
        if (px < 0 || px >= PANEL_W || py < 0 || py >= PANEL_H) continue;
        const s = (y * w + x) * 4;
        const d = (py * PANEL_W + px) * 4;
        const a = (src[s + 3] / 255) * gain;
        out[d] = src[s] * a;
        out[d + 1] = src[s + 1] * a;
        out[d + 2] = src[s + 2] * a;
      }
    }
    return true;
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
      case "run": {
        const name = this.mirroring ? (this.mirror?.spec.name ?? "") : (this.patterns[this.active]?.name ?? "");
        return this.now < this.noticeUntil ? { kind: "content", name } : null;
      }
      default:
        return null;
    }
  }
}

function mirrorBroken(m: MirrorRun) {
  return m.loadError !== null || m.fails >= MIRROR_FAILS;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function wrap(v: number, min: number, max: number) {
  const span = max - min;
  if (span <= 0) return min;
  return ((((v - min) % span) + span) % span) + min;
}
