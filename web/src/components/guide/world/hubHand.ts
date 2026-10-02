import type { DeviceSim } from "@/lib/guide/deviceSim";
import { knobIsTurned } from "../hubKnob";
import { useGuideStore } from "../store";
import { makeIsDrawing, makeIsShown } from "./hubMake";

// The hub is a poster, and the panel on it answers the hand: a mouse over the
// panel steers Origin a little, as two knobs would — across the panel is K1
// (the hue), up it is K2 (the speed) — and K1 and K2 are seen to turn for it.
// The panel's middle is where the board was found; the further from it, the
// further the knobs are turned, a click at a time. Off the panel they turn
// back the same way. And because the page's accent is the panel's colour
// (ui/panelTint.ts), the whole hub leans with the hand.
//
// The board is the same one in every guide (store.ts getSim), so what the
// hand turned is counted here and given back, exactly as the Play answer's
// K1 is (hubKnob.ts) — and at once, before anything else takes the board:
// a guide pointed at or chosen, the knobs taken in hand, the page left
// (world/HubAnswers calls handBackNow from the store's own update). It does
// nothing while any of that is going on, so the three answers play on a
// board that is as the hub found it.
//
// stage/StageHand.tsx calls handSteer every frame with where the pointer is on
// the panel; the arithmetic is here, free of three.js, so it can be tested.

/** The knobs the hand turns: K1 across the panel, K2 up it. */
const KNOBS = [0, 1] as const;
/** Clicks at the panel's edge: a fifth of the hue's wheel either way; the speed from a crawl to nearly twice. */
const REACH = [9, 7] as const;
/** A click of each knob at most this often on the way out, and on the way home, ms. */
const OUT_MS = 34;
const HOME_MS = 20;

/** The clicks the hand has turned and not yet turned back, per knob. */
const applied = [0, 0];
const since = [0, 0];
/** K1 was at Origin's own start when the hand began (the Play answer asks the same: hubKnob.ts). */
let fromStart = false;

const turned = () => applied[0] !== 0 || applied[1] !== 0;

/** The hand has the pattern turned from where the hub found it. */
export function handIsOn(): boolean {
  return turned();
}

/** The board is the hub's to steer: Origin running, nothing pointed at, nobody on the knobs. */
function free(sim: DeviceSim): boolean {
  const s = useGuideStore.getState();
  if (s.page !== "hub" || s.preview !== null || s.leaving !== null || s.handsOn) return false;
  // The Play answer's K1 is still on its way home, or Make's pattern is on the panel.
  if (knobIsTurned() || makeIsShown() || makeIsDrawing()) return false;
  const snap = sim.snapshot();
  return snap.mode === "run" && snap.pack === "origin";
}

/**
 * Home. Sums of clicks leave the hue a hair off (hubKnob.ts land), so from
 * Origin's own start it ends as the device would: a click of K1. Not once
 * the reader has the knobs — a press of K1 is theirs then.
 */
function land(sim: DeviceSim) {
  applied[0] = applied[1] = 0;
  since[0] = since[1] = 0;
  if (fromStart && !useGuideStore.getState().handsOn) {
    sim.press(0);
    sim.release(0);
  }
}

/**
 * A frame of the hand: `at` is the pointer on the panel — u across it, −1 at
 * its left edge … 1 at its right; v up it, −1 at its foot … 1 at its top —
 * or null when the pointer is anywhere else. One click a knob at a time.
 */
export function handSteer(sim: DeviceSim, at: { u: number; v: number } | null, dtMs: number) {
  if (!at && !turned()) return;
  const ok = free(sim);
  if (!ok && !turned()) return;
  // A knob only turns a pattern that is running: the way home waits for it.
  if (!ok && sim.snapshot().mode !== "run") return;
  for (let i = 0; i < 2; i++) {
    const reach = REACH[i];
    const want = ok && at ? Math.max(-reach, Math.min(reach, Math.round((i === 0 ? at.u : at.v) * reach))) : 0;
    if (want === applied[i]) {
      since[i] = 0;
      continue;
    }
    since[i] += dtMs;
    if (since[i] < (want === 0 ? HOME_MS : OUT_MS)) continue;
    since[i] = 0;
    if (!turned()) {
      const k1 = sim.knobReadout(0);
      fromStart = k1.value === k1.min;
    }
    const step = Math.sign(want - applied[i]);
    sim.turn(KNOBS[i], step);
    applied[i] += step;
    if (!turned()) land(sim);
  }
}

/**
 * Everything the hand turned, back at once: before the board is anyone
 * else's. With `frame`, the turn reaches the pattern here and now — whatever
 * the board is told next (a page that opens dark).
 */
export function handBackNow(sim: DeviceSim, frame = true) {
  if (!turned()) return;
  const handsOn = useGuideStore.getState().handsOn;
  if (sim.snapshot().mode !== "run") {
    // A screen the reader opened: the knobs are that screen's now, and the count is let go.
    if (handsOn) {
      applied[0] = applied[1] = 0;
      return;
    }
    sim.setMode("run");
  }
  for (let i = 0; i < 2; i++) if (applied[i]) sim.turn(KNOBS[i], -applied[i]);
  land(sim);
  // (Not on top of the reader's own press: the next frame takes both.)
  if (frame && !handsOn) sim.tick(0);
}
