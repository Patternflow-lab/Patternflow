import type { DemoAction, Step, SceneDef } from "../scenes";

// 06 Pattern Lab — the script for the chapter on the second page
// (/guide/make). Layers, Graphic Export and Director are steps in here, not
// chapters of their own. Step N here is on stage while step N of copy/lab.ts
// is in the middle of the screen; the two lists must be the same length
// (pages.test.ts checks it, and the page warns in development).
//
// Import only TYPES from "../scenes": scenes.ts imports this file, so a value
// import from it here would be a cycle that runs before scenes.ts has set its
// constants. The demo below is written out here for the same reason.
//
// The whole chapter is the Lab beside the board, and the board keeps playing
// the reader's own Lab draft (`mirror`) while the cards walk through the Lab's
// screens (LabShots.tsx). It holds still, showing what the reader made, except
// where the step is about something the board can show: the knobs' ranges
// (their names and values come up beside the knobs, from the reader's own
// @knobs line) and Apply (the pattern arriving over Wi-Fi).

// Pattern Lab beside the device, which plays the reader's draft.
const lab: Step = { view: "labSide", power: true, pack: "basics", mode: "run", mirror: true };

// K1 then K3, a few detents up and back down again: net nothing (unless a
// range's end stops one on the way), so the draft's knobs end about where
// they started however long the reader stays, and the
// readouts show the Lab's names and ranges for them. The mirror stops them at
// the ends of those ranges, as the Lab's sliders do. (K1 and K3 print their
// readouts beside the case; K2's goes above it, where the draft's own tag is.)
const turnRange: DemoAction[] = [0, 2].flatMap((k, i) => {
  // Far enough apart that one knob's readout has gone (Device.tsx holds it
  // 1.4 s) before the next turns: on a phone the two sit close.
  const t0 = 400 + i * 3300;
  return [
    { at: t0, turn: k, detents: 3 },
    { at: t0 + 250, turn: k, detents: 3 },
    { at: t0 + 500, turn: k, detents: 3 },
    { at: t0 + 1000, turn: k, detents: -3 },
    { at: t0 + 1250, turn: k, detents: -3 },
    { at: t0 + 1500, turn: k, detents: -3 },
  ];
});

export const LAB_SCENE: SceneDef = {
  id: "lab",
  steps: [
    // 0 — "Open the Lab.": Pattern Lab beside the device, which plays the
    // reader's own draft. Fixed: keep these fields as they are.
    { view: "labSide", power: true, pack: "basics", mode: "run", mirror: true },
    // 1 — name it first (name this pattern · Saved locally · Recent ▾)
    lab,
    // 2 — ask an AI (Copy prompt → Paste; Gallery · Generate with your own key)
    lab,
    // 3 — black and white is right (v-field, the Color Ramp, Random ramp)
    lab,
    // 4 — the knobs' names and ranges: two of the draft's knobs turning
    { ...lab, demo: turnRange, period: 7200 },
    // 5 — To hardware: the conversion prompt, the .h
    lab,
    // 6 — ↗ Apply to my Patternflow → Send over Wi-Fi: it arrives over Wi-Fi
    { ...lab, stream: true },
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
