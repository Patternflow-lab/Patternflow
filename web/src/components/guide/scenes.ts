import type { SimMode, SimPack } from "@/lib/guide/deviceSim";
import { kitHeld } from "./timing";
import { useGuideStore, type GuidePageId } from "./store";
import type { DeskPlacement } from "./desk/types";
import { COMMUNITY_SCENE } from "./scenes/community";
import { LAB_SCENE } from "./scenes/lab";

// The script. Each scene is a band of the page; each step is one block of
// copy inside it, and the step whose block crosses the middle of the viewport
// is the one on stage. The page (GuideExperience) renders the copy and the
// DOM motion, the stage (GuideCanvas) reads the step here and moves the
// device, the camera and the effects to match.
//
// Knobs are logical: 0..3 = K1..K4, as the device numbers them.
//
// The guide has two pages (pages.ts), each with its own script: SCENES is
// the first page (/guide, 01–04), played by the 3D stage; MAKE_SCENES the
// second (/guide/make, 05–06), whose chapters are in scenes/ and whose
// stage is the desk of app windows (desk/DeskStage.tsx) — its steps say
// which windows are on the desk (DeskStep), not what a device does. Both
// pages open on a scene called "opening" and end on one called "next";
// which page's is meant is the store's `page`.

export type ViewName =
  | "hero"
  | "front"
  | "back"
  | "screen"
  | "screenKnobs"
  | "knobs"
  | "esp"
  | "espPorts"
  | "espButtons"
  | "wide"
  /** Pattern Lab beside the device (stage/views.ts). */
  | "labSide";

export type DemoAction =
  | { at: number; press: number }
  | { at: number; release: number }
  | { at: number; turn: number; detents: number }
  | { at: number; mode: SimMode };

export type Step = {
  view: ViewName;
  /** Radians per second the device turns on its own (the opening). */
  spin?: number;
  power: boolean;
  pack: SimPack;
  /** Screen the board is put on when the step starts. */
  mode?: SimMode;
  focus?: number | null;
  labels?: boolean;
  /** 0 = the ESP32 is in the device, 1 = out in front of it. */
  esp?: number;
  /** The USB-C cable in the left port (KitFx plugs it in once the DevKit is presented). */
  cable?: number;
  /** Which ports / buttons to name on the module. */
  espTags?: ("usb" | "uart" | "boot" | "rst")[];
  flashing?: boolean;
  /** Loop the BOOT/RST download-mode sequence on the module (timing.ts). */
  bootSeq?: boolean;
  /** Point out RST and press it once a loop (timing.ts). */
  rstPulse?: boolean;
  wifi?: "esp" | "device" | null;
  /** Pixels streaming from the deck into the panel. */
  stream?: boolean;
  /** A scripted demo, looped every `period` ms while nobody has the knobs. */
  demo?: DemoAction[];
  period?: number;
  /**
   * How long this step's block is, in viewport heights (default 1): a step
   * the reader has to watch loop — BOOT and RST — gets more scroll to stay on.
   */
  dwell?: number;
  /**
   * The device plays the reader's own Pattern Lab draft (read from the
   * browser's saved draft, never written) instead of the deck's pattern.
   */
  mirror?: boolean;
};

/**
 * A step of the make page (/guide/make): which app windows are on the desk
 * and which is in front (desk/types.ts DeskPlacement). What the pointer does
 * in them is the chapter's tutorial (tutorials/*.ts), by the same index.
 */
export type DeskStep = {
  desk: DeskPlacement;
  /** As Step's: a longer block for the step to stay on, in viewport heights. */
  dwell?: number;
};

/** A step of either page's script. */
export type AnyStep = Step | DeskStep;

export type SceneDef<S extends AnyStep = Step> = { id: string; steps: S[] };

const base: Pick<Step, "power" | "pack"> = { power: true, pack: "origin" };

// K1..K4 turning in turn, a few detents each way — what "turn" looks like.
const turnAll: DemoAction[] = [0, 1, 2, 3].flatMap((k, i) => {
  const t0 = i * 1100;
  return [
    { at: t0, turn: k, detents: 2 },
    { at: t0 + 150, turn: k, detents: 2 },
    { at: t0 + 300, turn: k, detents: 2 },
    { at: t0 + 550, turn: k, detents: -2 },
    { at: t0 + 700, turn: k, detents: -2 },
  ];
});

export const SCENES: SceneDef[] = [
  {
    id: "opening",
    steps: [{ ...base, view: "hero", spin: 0.22, mode: "run" }],
  },
  {
    id: "flash",
    steps: [
      // 0 — the board that is the brain: the back slides off, the DevKit
      // comes straight off its pins
      { view: "back", power: false, pack: "origin", mode: "off", esp: 0.25 },
      // 1 — out it comes, antenna up
      { view: "esp", power: false, pack: "origin", mode: "off", esp: 1, espTags: [] },
      // 2 — the LEFT port
      { view: "espPorts", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, espTags: ["usb", "uart"] },
      // 3 — Flash Patternflow
      { view: "esp", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, flashing: true },
      // 4 — nothing in the port list: BOOT + RST, slowly, with room to watch it
      { view: "espButtons", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, bootSeq: true, espTags: ["boot", "rst"], dwell: 1.6 },
      // 5 — Wi-Fi; and if that step never came, RST, right here — pressed
      // only while the card's "No Wi-Fi step?" screens say to (KitFx reads
      // which flasher screen is up from the store)
      { view: "esp", power: false, pack: "origin", mode: "off", esp: 1, cable: 1, wifi: "esp", rstPulse: true, espTags: ["rst"] },
      // 6 — back in, power on (the cable comes out first: timing.ts)
      { view: "hero", power: true, pack: "origin", mode: "run", esp: 0 },
    ],
  },
  {
    id: "knobs",
    steps: [
      // 0 — four knobs, numbered from the top right
      { ...base, view: "knobs", mode: "run", labels: true },
      // 1 — turn
      { ...base, view: "screenKnobs", mode: "run", labels: true, demo: turnAll, period: 4800 },
      // 2 — click
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 0,
        demo: [
          { at: 0, turn: 0, detents: 6 },
          { at: 200, turn: 0, detents: 6 },
          { at: 1400, press: 0 },
          { at: 1600, release: 0 },
        ],
        period: 3000,
      },
      // 3 — hold K1: brightness
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 0,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 0 },
          { at: 1500, release: 0 },
          { at: 1900, turn: 0, detents: -4 },
          { at: 2100, turn: 0, detents: -4 },
          { at: 2300, turn: 0, detents: -4 },
          { at: 3200, turn: 0, detents: 4 },
          { at: 3400, turn: 0, detents: 4 },
          { at: 3600, turn: 0, detents: 4 },
          { at: 4600, press: 0 },
          { at: 4700, release: 0 },
        ],
        period: 5600,
      },
      // 4 — hold K2: network
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 1,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 1 },
          { at: 1500, release: 1 },
          // K2 = EXIT, as the screen says.
          { at: 4600, press: 1 },
          { at: 4750, release: 1 },
        ],
        period: 6000,
      },
      // 5 — hold K3: knob map
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 2,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 2 },
          { at: 1500, release: 2 },
          { at: 2100, turn: 0, detents: 1 },
          { at: 2800, turn: 1, detents: 1 },
          { at: 3500, turn: 2, detents: 1 },
          { at: 4200, turn: 3, detents: 1 },
          // K3 = EXIT.
          { at: 5000, press: 2 },
          { at: 5150, release: 2 },
        ],
        period: 6200,
      },
      // 6 — hold K4: patterns
      {
        ...base,
        view: "screenKnobs",
        mode: "run",
        focus: 3,
        demo: [
          { at: 0, mode: "run" },
          { at: 400, press: 3 },
          { at: 1500, release: 3 },
          { at: 2400, turn: 3, detents: 1 },
          { at: 3000, turn: 3, detents: 1 },
          { at: 3600, turn: 3, detents: 1 },
          // Hold K4 again to close it: the ring fills, then the list goes.
          { at: 4300, press: 3 },
          { at: 5500, release: 3 },
        ],
        period: 6400,
      },
    ],
  },
  {
    id: "patterns",
    steps: [
      // 0 — only Origin
      { ...base, view: "screen", mode: "select" },
      // 1 — the Basics deck (a deck, or a single pattern)
      { ...base, view: "front", mode: "run", stream: true },
      // 2 — install, format, done
      { ...base, view: "front", mode: "run", stream: true },
      // 3 — 1 / 34
      {
        view: "screenKnobs",
        power: true,
        pack: "basics",
        mode: "select",
        focus: 3,
        demo: [
          { at: 700, turn: 3, detents: 3 },
          { at: 1400, turn: 3, detents: 3 },
          { at: 2100, turn: 3, detents: 3 },
          { at: 2800, turn: 3, detents: 3 },
          { at: 3500, turn: 3, detents: 3 },
        ],
        period: 4200,
      },
    ],
  },
  {
    id: "console",
    steps: [
      // 0 — patternflow.local
      { view: "wide", power: true, pack: "basics", mode: "run", wifi: "device" },
      // 1 — on a phone: the IP from K2
      {
        view: "screenKnobs",
        power: true,
        pack: "basics",
        mode: "run",
        focus: 1,
        demo: [
          { at: 0, mode: "run" },
          { at: 300, press: 1 },
          { at: 1400, release: 1 },
          { at: 7600, press: 1 },
          { at: 7750, release: 1 },
        ],
        period: 9000,
      },
      // 2 — what is in it
      { view: "front", power: true, pack: "basics", mode: "run", wifi: "device" },
    ],
  },
  {
    id: "next",
    steps: [{ view: "hero", spin: 0.18, power: true, pack: "basics", mode: "run" }],
  },
];

// The second page, "Make your own": a desk of app windows instead of the
// device — the community and the Lab are things you do on a screen. It opens
// with the practice community in front and the Lab behind it, both at rest
// (dimmed, nothing pointed at yet), and ends on the reader's Lab.
export const MAKE_SCENES: SceneDef<DeskStep>[] = [
  {
    id: "opening",
    steps: [{ desk: { front: "community", show: ["community", "lab"], rest: true } }],
  },
  COMMUNITY_SCENE,
  LAB_SCENE,
  {
    id: "next",
    steps: [{ desk: { front: "lab", rest: true } }],
  },
];

const PAGE_SCENES: Record<GuidePageId, SceneDef<AnyStep>[]> = { start: SCENES, make: MAKE_SCENES };

/** A page's script, opening to end. */
export function scenesOf(page: GuidePageId): SceneDef<AnyStep>[] {
  return PAGE_SCENES[page];
}

/** A scene of the page the reader is on (or of `page`). */
export function sceneById(id: string, page: GuidePageId = useGuideStore.getState().page): SceneDef<AnyStep> | undefined {
  return scenesOf(page).find((s) => s.id === id);
}

/** A step of the make page's script (clamped into its scene; the opening's for an unknown scene). */
export function deskStepOf(scene: string, step: number): DeskStep {
  const def = MAKE_SCENES.find((s) => s.id === scene) ?? MAKE_SCENES[0];
  return def.steps[Math.max(0, Math.min(def.steps.length - 1, step))];
}

// A step as the stage should play it right now. The one difference from the
// script: while the USB-C cable is still on the DevKit, the DevKit stays out
// where it is (esp held at 1) — the plug has to come out and the cable go
// before it can travel anywhere, whichever step the reader has scrolled to.
const heldSteps = new WeakMap<Step, Step>();

export function stepOf(scene: string, step: number): Step {
  // The 3D stage plays only the first page's script: the make page has the
  // desk instead (MAKE_SCENES, deskStepOf).
  const def = SCENES.find((s) => s.id === scene) ?? SCENES[0];
  const s = def.steps[Math.max(0, Math.min(def.steps.length - 1, step))];
  if ((s.esp ?? 0) < 1 && kitHeld()) {
    let held = heldSteps.get(s);
    if (!held) {
      held = { ...s, esp: 1 };
      heldSteps.set(s, held);
    }
    return held;
  }
  return s;
}
