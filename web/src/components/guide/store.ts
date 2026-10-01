import { create } from "zustand";
import { DeviceSim } from "@/lib/guide/deviceSim";

// The guide's shared state. Scroll position is written here many times a
// second, so nothing that renders React should subscribe to `progress`: the
// 3D stage reads it with getState() inside its frame loop, and the page's own
// motion reads the --p custom property the scroll tracker sets on each scene.
// Components subscribe to `scene` and `step`, which only change at edges.

export type GuideLang = "en" | "ko";

/**
 * The guides (pages.ts), in the order a reader goes through them: "build" is
 * /guide/build (soldering one from bare parts), "play" /guide/play (01 Flash
 * to 04 Console), "make" /guide/make (01 Community, 02 Pattern Lab). Each
 * numbers its own chapters from 01.
 */
export type GuidePageId = "build" | "play" | "make";

/** What the stage can be showing: a guide, or /guide itself — the hub, where the reader picks one (GuideHub). */
export type GuideScreen = GuidePageId | "hub";

type GuideState = {
  /**
   * The page the reader is on. Scene ids are the page's own — every guide
   * has an "opening" and a "next" — so a step is looked up in this page's
   * script (scenes.ts sceneById): the 3D stage's on the build and play
   * guides and the hub (stepOf), the desk's on the make guide (deskStepOf).
   */
  page: GuideScreen;
  /** The scene whose band contains the middle of the viewport. */
  scene: string;
  /** 0..1 through that scene. */
  progress: number;
  /**
   * The current step's card has come onto the screen. A chapter's first step
   * is the current one from the moment the chapter's title reaches the middle
   * of the screen, a screen and more before its card does; the Build stage
   * (BuildStage) holds that step's motion until this is true, so it plays
   * for the reader and not under the title.
   */
  cardIn: boolean;
  /** Counts up each time the reader asks to see the current step's motion again (the Build guide's cards). */
  replay: number;
  /** Index of the step inside the scene, derived from progress by the scene's script. */
  step: number;
  /** The reader has taken the knobs: scripted demos pause, the camera settles. */
  handsOn: boolean;
  /** Narrow screen: the stage sits above the text instead of beside it. */
  narrow: boolean;
  /**
   * The flasher screens a card is playing right now (FlasherShots), so the
   * DevKit on stage can act out the one on screen: RST is pressed only while
   * the "No Wi-Fi step?" sequence says to press it. `at` is when this screen
   * came up (performance.now()). Null when no flasher viewer is running.
   */
  flasher: { set: string; index: number; at: number } | null;
  /** The DevKit is held up in front of the reader (KitFx), so a card about it can start. */
  kitPresented: boolean;
  /** A guide page has mounted: its script, from its top (the scroll tracker takes over at once). */
  enterPage: (page: GuideScreen) => void;
  setScroll: (scene: string, progress: number, step: number, cardIn?: boolean) => void;
  replayStep: () => void;
  setHandsOn: (on: boolean) => void;
  setNarrow: (narrow: boolean) => void;
  setFlasher: (f: { set: string; index: number } | null) => void;
  setKitPresented: (on: boolean) => void;
};

export const useGuideStore = create<GuideState>((set, get) => ({
  page: "play",
  scene: "opening",
  progress: 0,
  step: 0,
  cardIn: true,
  replay: 0,
  handsOn: false,
  narrow: false,
  flasher: null,
  kitPresented: false,
  enterPage: (page) => {
    if (get().page === page && get().scene === "opening" && get().step === 0) return;
    set({ page, scene: "opening", progress: 0, step: 0, cardIn: true, handsOn: false, flasher: null });
  },
  setScroll: (scene, progress, step, cardIn = true) => {
    const s = get();
    if (s.scene !== scene || s.step !== step) {
      // Moving to another step hands the knobs back to the script.
      set({ scene, progress, step, cardIn, handsOn: false });
    } else if (s.progress !== progress || s.cardIn !== cardIn) {
      set({ progress, cardIn });
    }
  },
  replayStep: () => set({ replay: get().replay + 1 }),
  setHandsOn: (handsOn) => set({ handsOn }),
  setNarrow: (narrow) => set({ narrow }),
  setFlasher: (f) => {
    const cur = get().flasher;
    if (!f) {
      if (cur) set({ flasher: null });
    } else if (!cur || cur.set !== f.set || cur.index !== f.index) {
      set({ flasher: { ...f, at: performance.now() } });
    }
  },
  setKitPresented: (kitPresented) => {
    if (get().kitPresented !== kitPresented) set({ kitPresented });
  },
}));

// One simulated board per page. Module scope rather than state because it is
// an imperative object ticked from the render loop, and the DOM control pad
// and the 3D knobs must reach the same one.
let sim: DeviceSim | null = null;
export function getSim(): DeviceSim {
  if (!sim) sim = new DeviceSim();
  return sim;
}
