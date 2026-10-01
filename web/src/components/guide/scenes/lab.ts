import type { DeskStep, SceneDef } from "../scenes";

// Make · 02 Pattern Lab — the script for the chapter on the Make guide
// (/guide/make). Layers, Graphic Export and Director are steps in here, not
// chapters of their own. Step N here is on the desk while step N of
// copy/lab.ts is in the middle of the screen; the two lists must be the same
// length (pages.test.ts checks it, and the page warns in development).
//
// Each step says which app windows are on the desk (desk/types.ts
// DeskPlacement): the whole chapter is the reader's own Pattern Lab — the
// real /pattern-lab, in a window — with the practice AI over its corner
// where a step sends something to an AI and brings the answer back
// (desk/ai/PracticeAi.tsx). What the pointer does is tutorials/lab.ts, by
// the same index.
//
// The AI window sits over the Lab's bottom-right corner, where To hardware's
// window has its Next → — so 05 only copies the .h out of the AI, and 06,
// with the AI gone, pastes it into the Lab. In 05 the AI window is shorter,
// so it stays below To hardware's Copy the conversion prompt.
//
// Import only TYPES from "../scenes": scenes.ts imports this file, so a value
// import from it here would be a cycle that runs before scenes.ts has set its
// constants.

const lab: DeskStep = { desk: { front: "lab" } };
// The Lab, and the practice AI over its bottom-right corner.
const labAndAi: DeskStep = { desk: { front: "lab", show: ["lab", "ai"] } };
// The same, the AI window kept low: To hardware's window is open over the Lab.
const labAndLowAi: DeskStep = { desk: { front: "lab", show: ["lab", "ai"], aiHeight: 0.5 } };

export const LAB_SCENE: SceneDef<DeskStep> = {
  id: "lab",
  steps: [
    // 0 — "Open the Lab.": the reader's own Pattern Lab. Fixed: keep it the Lab, in front.
    { desk: { front: "lab" } },
    // 1 — name it first (name this pattern · Saved locally · Recent ▾)
    lab,
    // 2 — ask an AI (Copy prompt → the practice AI → Copy → Paste)
    labAndAi,
    // 3 — black and white is right (v-field, the Color Ramp, Random ramp)
    lab,
    // 4 — the knobs' names and ranges
    lab,
    // 5 — To hardware: Copy the conversion prompt → the practice AI → Copy the .h
    labAndLowAi,
    // 6 — the .h into the Lab → Looks like a header ✓ → Next → → ↗ Apply to my Patternflow (pointed at)
    lab,
    // 7 — layers (+ Code, + Pixel, mask, opacity, blend; a prompt per layer)
    lab,
    // 8 — Graphic Export
    lab,
    // 9 — the Director
    lab,
    // 10 — give it back (Upload to the community, Share, forks, ports, performances)
    lab,
  ],
};
