import { create } from "zustand";
import { DeviceSim } from "@/lib/guide/deviceSim";

// The guide's shared state. Scroll position is written here many times a
// second, so nothing that renders React should subscribe to `progress`: the
// 3D stage reads it with getState() inside its frame loop, and the page's own
// motion reads the --p custom property the scroll tracker sets on each scene.
// Components subscribe to `scene` and `step`, which only change at edges.

export type GuideLang = "en" | "ko";

/** Which page of the guide is open (pages.ts): "start" is /guide, 01–04; "make" is /guide/make, 05–06. */
export type GuidePageId = "start" | "make";

type GuideState = {
  /**
   * The page the reader is on. Scene ids are the page's own — both pages
   * have an "opening" and a "next" — so a step is looked up in this page's
   * script (scenes.ts sceneById): the 3D stage's on the first page
   * (stepOf), the desk's on the make page (deskStepOf).
   */
  page: GuidePageId;
  /** The scene whose band contains the middle of the viewport. */
  scene: string;
  /** 0..1 through that scene. */
  progress: number;
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
  enterPage: (page: GuidePageId) => void;
  setScroll: (scene: string, progress: number, step: number) => void;
  setHandsOn: (on: boolean) => void;
  setNarrow: (narrow: boolean) => void;
  setFlasher: (f: { set: string; index: number } | null) => void;
  setKitPresented: (on: boolean) => void;
};

export const useGuideStore = create<GuideState>((set, get) => ({
  page: "start",
  scene: "opening",
  progress: 0,
  step: 0,
  handsOn: false,
  narrow: false,
  flasher: null,
  kitPresented: false,
  enterPage: (page) => {
    if (get().page === page && get().scene === "opening" && get().step === 0) return;
    set({ page, scene: "opening", progress: 0, step: 0, handsOn: false, flasher: null });
  },
  setScroll: (scene, progress, step) => {
    const s = get();
    if (s.scene !== scene || s.step !== step) {
      // Moving to another step hands the knobs back to the script.
      set({ scene, progress, step, handsOn: false });
    } else if (s.progress !== progress) {
      set({ progress });
    }
  },
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
