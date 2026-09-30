import { create } from "zustand";
import { DeviceSim } from "@/lib/guide/deviceSim";

// The guide's shared state. Scroll position is written here many times a
// second, so nothing that renders React should subscribe to `progress`: the
// 3D stage reads it with getState() inside its frame loop, and the page's own
// motion reads the --p custom property the scroll tracker sets on each scene.
// Components subscribe to `scene` and `step`, which only change at edges.

export type GuideLang = "en" | "ko";

type GuideState = {
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
  setScroll: (scene: string, progress: number, step: number) => void;
  setHandsOn: (on: boolean) => void;
  setNarrow: (narrow: boolean) => void;
};

export const useGuideStore = create<GuideState>((set, get) => ({
  scene: "opening",
  progress: 0,
  step: 0,
  handsOn: false,
  narrow: false,
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
}));

// One simulated board per page. Module scope rather than state because it is
// an imperative object ticked from the render loop, and the DOM control pad
// and the 3D knobs must reach the same one.
let sim: DeviceSim | null = null;
export function getSim(): DeviceSim {
  if (!sim) sim = new DeviceSim();
  return sim;
}
