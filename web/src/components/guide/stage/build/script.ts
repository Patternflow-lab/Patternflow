import type { DemoAction, Step } from "../../scenes";
import type { BuildBeat } from "./beats";

// A ready stage step for every beat of the build (beats.ts), for the Build
// guide's script (scenes/build.ts): the beat, the camera view that shows it,
// and what the device is doing — dark until firmware-3, then Origin. The
// script can use one as it is, or spread it and change a field.
//
// Import only TYPES from "../../scenes" (scenes.ts imports scenes/build.ts,
// which imports this file).

const dark = { power: false, pack: "origin", mode: "off" } as const;
const lit = { power: true, pack: "origin", mode: "run" } as const;

// Each knob turned a few detents and clicked once (BUILD_GUIDE §9.3–9.4).
const turnAndClick: DemoAction[] = [0, 1, 2, 3].flatMap((k, i) => {
  const t0 = i * 1300;
  return [
    { at: t0, turn: k, detents: 2 },
    { at: t0 + 150, turn: k, detents: 2 },
    { at: t0 + 300, turn: k, detents: -2 },
    { at: t0 + 700, press: k },
    { at: t0 + 850, release: k },
  ];
});

// Each long-press in turn (§9.4–9.5): K4 pattern select, K1 brightness, K2
// network, K3 knob numbers — each opened, shown, closed.
const longPresses: DemoAction[] = [
  { at: 0, mode: "run" },
  { at: 300, press: 3 },
  { at: 1400, release: 3 },
  { at: 2100, turn: 3, detents: 1 },
  { at: 2700, turn: 3, detents: -1 },
  { at: 3300, press: 3 },
  { at: 4500, release: 3 },
  { at: 5200, press: 0 },
  { at: 6300, release: 0 },
  { at: 6900, turn: 0, detents: -4 },
  { at: 7300, turn: 0, detents: 4 },
  { at: 8000, press: 0 },
  { at: 8100, release: 0 },
  { at: 8800, press: 1 },
  { at: 9900, release: 1 },
  { at: 12400, press: 1 },
  { at: 12550, release: 1 },
  { at: 13200, press: 2 },
  { at: 14300, release: 2 },
  { at: 16600, press: 2 },
  { at: 16750, release: 2 },
];

export const BUILD_STEPS: Record<BuildBeat, Step> = {
  opening: { build: "opening", view: "hero", spin: 0.22, ...dark, esp: 0 },
  "gather-1": { build: "gather-1", view: "bench", ...dark, esp: 1 },
  "gather-2": { build: "gather-2", view: "benchWide", ...dark, esp: 1 },
  "gather-3": { build: "gather-3", view: "benchWide", spin: 0.3, ...dark, esp: 1 },
  "gather-4": { build: "gather-4", view: "bench", ...dark, esp: 1 },
  "print-1": { build: "print-1", view: "boardLift", ...dark, esp: 1 },
  "print-2": { build: "print-2", view: "plates", ...dark, esp: 1 },
  "print-3": { build: "print-3", view: "platesKnobs", ...dark, esp: 1 },
  "print-4": { build: "print-4", view: "bond", ...dark, esp: 1 },
  "solder-1": { build: "solder-1", view: "boardF", ...dark, esp: 1 },
  "solder-2": { build: "solder-2", view: "boardParts", ...dark, esp: 1 },
  "solder-3": { build: "solder-3", view: "boardC11", ...dark, esp: 1 },
  "solder-4": { build: "solder-4", view: "boardSW", ...dark, esp: 1 },
  // The panel goes in from the front; the camera is behind the frame, where the panel's IN header and the tabs show.
  "case-1": { build: "case-1", view: "panelIn", ...dark, esp: 1 },
  "case-2": { build: "case-2", view: "screwsBack", ...dark, esp: 1 },
  // Close on the bay's floor: the small slot the lead comes up through, then
  // J4. On a phone those are two shots: the floor, then — as the board is
  // brought over — J4 on it.
  "case-3": { build: "case-3", view: "leadBack", narrowView: "leadHole", narrowLate: { from: 0.52, view: "leadJ4" }, ...dark, esp: 1 },
  "case-4": { build: "case-4", view: "caseBackClose", ...dark, esp: 1 },
  "case-5": { build: "case-5", view: "knobs", ...dark, esp: 1 },
  "wire-1": { build: "wire-1", view: "wireBack", ...dark, esp: 1 },
  // On a phone, close on the two terminals: the polarity is the step.
  "wire-2": { build: "wire-2", view: "wireBack", narrowView: "terminalsBack", ...dark, esp: 1 },
  // Flashing is Play's 01 Flash: the DevKit held up, the cable in its left port.
  "firmware-1": { build: "firmware-1", view: "esp", ...dark, esp: 1, cable: 1, flashing: true, espTags: ["usb"] },
  "firmware-2": { build: "firmware-2", view: "back", ...dark, esp: 0 },
  "firmware-3": { build: "firmware-3", view: "front", ...lit, esp: 0 },
  "check-1": { build: "check-1", view: "knobs", ...lit, esp: 0, labels: true, demo: turnAndClick, period: 5600 },
  "check-2": { build: "check-2", view: "screenKnobs", ...lit, esp: 0, labels: true, demo: longPresses, period: 17800 },
  "check-3": { build: "check-3", view: "front", ...lit, esp: 0, demo: [{ at: 700, mode: "off" }, { at: 2300, mode: "run" }], period: 5200 },
  "check-4": { build: "check-4", view: "caseBack", ...lit, esp: 0 },
  "check-5": { build: "check-5", view: "front", ...lit, esp: 0 },
  next: { build: "next", view: "hero", spin: 0.18, ...lit, esp: 0 },
};
