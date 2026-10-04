import type { DemoAction, SceneDef, Step } from "../scenes";

// The Audio guide's script (/guide/audio, copy/audio.ts): the 3D board, as
// in Play. One scene comes first — the edition — and the other three are in
// no order, so every step says the whole of what the board is: its power,
// its pack, its screen, and the two things this guide adds (scenes.ts Step):
//
//   edition: "audio"   the board runs the Audio edition — hold K2 shows the
//                      OSC and AUD rows. Declared by every step from the
//                      install's check on; the Director returns the board to
//                      the core firmware on any step that does not say it.
//   lanes: "editor"    the knob values follow the extension's editor in the
//                      step's card (EditorWindow) — the one step that has it.
//
// The pack is Origin throughout: a step edge from Origin to Basics is the
// "install complete" flash (stage/Fx.tsx), and nothing is installed here.
// No step has `stream` either: that is the deck pouring into the panel.
//
// What moves on this stage is what a hand or the editor moves. The hold-K2
// loops are the reader's own gesture, as Play's are; the microphone and MIDI
// steps show the board as it stands, with no signal made up for it.

const core: Pick<Step, "power" | "pack"> = { power: true, pack: "origin" };
const audio: Pick<Step, "power" | "pack" | "edition"> = { ...core, edition: "audio" };
// The microphone goes on with the power off and the ESP32 out in the hand.
const bench: Pick<Step, "power" | "pack" | "mode" | "esp"> = { power: false, pack: "origin", mode: "off", esp: 1 };

// Hold K2: the NETWORK screen with the edition's two rows. K3 turns the AUD
// row off and on again — left off, right on — and K2 closes the screen. The
// screen closes itself after eight idle seconds, so the loop opens it again
// for as long as the card is read (Play's hold-K2 step does the same). Each
// loop ends with AUD on, where the edition starts.
const holdK2: DemoAction[] = [
  { at: 0, mode: "run" },
  { at: 400, press: 1 },
  { at: 1500, release: 1 },
  { at: 3600, turn: 2, detents: -1 },
  { at: 5600, turn: 2, detents: 1 },
  // K2 = EXIT, as the screen says.
  { at: 8000, press: 1 },
  { at: 8150, release: 1 },
];
const HOLD_K2_PERIOD = 9400;

export const AUDIO_SCENES: SceneDef[] = [
  {
    id: "opening",
    steps: [{ ...core, view: "hero", spin: 0.22, mode: "run" }],
  },
  {
    id: "edition",
    steps: [
      // 0 — an edition: the same board, more firmware
      { ...core, view: "hero", mode: "run" },
      // 1 — Install to my panel (the card links the shelf): over Wi-Fi, the board still on the core firmware
      { ...core, view: "wide", mode: "run", wifi: "device" },
      // 2 — hold K2: the OSC and AUD rows; K3 switches AUD
      { ...audio, view: "screenKnobs", mode: "run", focus: 1, demo: holdK2, period: HOLD_K2_PERIOD },
    ],
  },
  {
    id: "browser",
    steps: [
      // 0 — load the extension: the board waits, whole
      { ...audio, view: "front", mode: "run" },
      // 1 — open the tab, press Start (the popup: Idle, Live): it reaches the board over Wi-Fi
      { ...audio, view: "wide", mode: "run", wifi: "device" },
      // 2 — not Live: "Aud off" is the AUD row on hold K2
      { ...audio, view: "screenKnobs", mode: "run", focus: 1, demo: holdK2, period: HOLD_K2_PERIOD },
      // 3 — the editor drives the four values; a hand on a knob has it for five seconds
      { ...audio, view: "screenKnobs", mode: "run", labels: true, lanes: "editor", dwell: 1.6 },
    ],
  },
  {
    id: "mic",
    steps: [
      // 0 — the part; the board from behind, where it will go
      { ...audio, view: "back", mode: "run" },
      // 1 — the ESP32 comes out, at its own pace once the card is up (micLiftStep)
      { ...bench, view: "esp", espTags: [] },
      // 2 — five leads, four places, on the module's top side
      { ...bench, view: "esp", espTags: [], dwell: 1.4 },
      // 3 — the right port (UART) stays empty: it shares TX and RX with the microphone.
      // Both ports are named, and UART is the marked one (micPortStep)
      { ...bench, view: "espPorts", espTags: ["usb", "uart"] },
      // 4 — back on its pins, power on (micReseatStep); console, Audio, Microphone
      { ...audio, view: "wide", mode: "run", wifi: "device" },
      // 5 — the mapping, saved on the board: a box a knob
      { ...audio, view: "knobs", mode: "run", labels: true },
      // 6 — what the chip says, with the board running in front of you
      { ...audio, view: "front", mode: "run" },
    ],
  },
  {
    id: "midi",
    steps: [
      // 0 — a network MIDI session: the board on the same Wi-Fi
      { ...audio, view: "wide", mode: "run", wifi: "device", dwell: 1.4 },
      // 1 — Live: tick Remote, then map a knob — Ctrl-M, click, turn
      { ...audio, view: "knobs", mode: "run", labels: true, focus: 0 },
      // 2 — channel 1 and the numbers: K1–K4, by name
      { ...audio, view: "knobs", mode: "run", labels: true },
      // 3 — the console's MIDI page
      { ...audio, view: "front", mode: "run", wifi: "device" },
      // 4 — Use this computer: the board calls the session itself
      { ...audio, view: "wide", mode: "run", wifi: "device" },
    ],
  },
  {
    id: "next",
    steps: [{ ...audio, view: "hero", spin: 0.18, mode: "run" }],
  },
];

// The microphone section takes the ESP32 out once and puts it back once, and
// the stage plays those two as Play plays its own (stage/Device.tsx
// choreoSpeed, stage/GuideCanvas.tsx CameraRig): the lift at its own pace
// once the step's card is on screen, the way back watched from behind until
// the board is whole and the panel comes on.

/** "Lift it out.": mic, step 1. */
export function micLiftStep(page: string, scene: string, step: number) {
  return page === "audio" && scene === "mic" && step === 1;
}

/**
 * "Leave the right port empty.": mic, step 3. The port this card is about is
 * UART, so that is the tag the stage marks (stage/KitFx.tsx); everywhere else
 * the marked port is USB, the one the cable goes into.
 */
export function micPortStep(page: string, scene: string, step: number) {
  return page === "audio" && scene === "mic" && step === 3;
}

/** The step after the soldering, where the board is whole and on again: mic, step 4. */
export function micReseatStep(page: string, scene: string, step: number) {
  return page === "audio" && scene === "mic" && step === 4;
}
