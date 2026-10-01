import type { DeviceSim } from "@/lib/guide/deviceSim";
import { ENCODER_CLICKS_PER_TURN, TURNS_PER_FULL_RANGE } from "@/lib/pattern/controls";
import { useGuideStore } from "./store";

// The hub's Play answer (world/HubAnswers): K1 turns while Play is pointed at, and
// Origin's colour follows. The board is the same one in every guide
// (store.ts getSim), so the hub hands it on as it found it: Play's words call
// Origin red, and a hue left turned here opened that guide in another colour.
// This file keeps the count of what the answer turned, and turns it back.

/** K1 clicks that bring Origin's hue round to where it started (the hue wraps over its whole range). */
const HUE_CLICKS = TURNS_PER_FULL_RANGE * ENCODER_CLICKS_PER_TURN;

// What the answer has done to K1 and nothing has undone yet. Kept with the
// board, not the hub: the board outlives it.
/** It has turned K1, and K1 is not home yet. */
let turned = false;
/** The clicks it has turned, less the ones turned back. */
let owed = 0;
/** The hue was at Origin's own start (the low end of its range) when it began. */
let fromStart = false;

/** K1 is still turned from where the answer found it. */
export function knobIsTurned(): boolean {
  return turned;
}

/** The answer: one more click of K1 — unless the reader has the knobs, or a screen is open over the pattern. */
export function turnOn(sim: DeviceSim) {
  if (useGuideStore.getState().handsOn || sim.snapshot().mode !== "run") return;
  if (!turned) {
    const k1 = sim.knobReadout(0);
    fromStart = k1.value === k1.min;
    turned = true;
    owed = 0;
  }
  sim.turn(0, 1);
  owed++;
}

/** The clicks that take the hue back, the short way round: negative is back the way it came. */
function wayBack(): number {
  const r = ((owed % HUE_CLICKS) + HUE_CLICKS) % HUE_CLICKS;
  return r > HUE_CLICKS / 2 ? HUE_CLICKS - r : -r;
}

/**
 * The last step home, once the clicks are turned back. Sums of clicks leave
 * the value a hair off (the knob's readout then says "hue 1.00" where it said
 * 0.00), so from Origin's own start it ends as the device would: a click of
 * K1, which puts that knob at its start exactly (not once the reader has
 * taken the knobs: where K1 is then is theirs). A turn or a click only
 * reaches the pattern on a frame, while the pattern runs, so the frame is
 * made here — whatever the board is told next.
 */
function land(sim: DeviceSim) {
  turned = false;
  owed = 0;
  if (fromStart && !useGuideStore.getState().handsOn) {
    sim.press(0);
    sim.release(0);
  }
  sim.tick(0);
}

/**
 * Pointing away from Play: one click on the way back, so the knob turns back
 * and the colour comes home with it. True once K1 is home. It waits while a
 * screen the reader opened is over the pattern: K1 is that screen's for now.
 */
export function turnBackClick(sim: DeviceSim): boolean {
  if (!turned) return true;
  if (sim.snapshot().mode !== "run") return false;
  const clicks = wayBack();
  if (clicks) {
    sim.turn(0, Math.sign(clicks));
    owed += Math.sign(clicks);
    return false;
  }
  land(sim);
  return true;
}

/**
 * K1 back where it was, at once: before the board is put in another state
 * (off, another pattern), and when the hub is left.
 */
export function turnBackNow(sim: DeviceSim) {
  if (!turned) return;
  if (sim.snapshot().mode !== "run") sim.setMode("run");
  const clicks = wayBack();
  if (clicks) sim.turn(0, clicks);
  land(sim);
}
