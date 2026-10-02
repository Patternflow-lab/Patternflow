import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeviceSim } from "@/lib/guide/deviceSim";
import { knobIsTurned, turnBackNow, turnOn } from "../hubKnob";
import { useGuideStore } from "../store";
import { handBackNow, handIsOn, handSteer } from "./hubHand";
import { makeNext, makeRestore } from "./hubMake";

// The hub's panel answers the hand: a mouse over it turns K1 and K2 a few
// clicks. The board is the one every guide shares, so whatever comes next —
// the pointer leaves, a guide is pointed at, the knobs are taken, the page is
// left — it must be back as the hub found it, and the three answers must
// find it so.

const FRAME = 1 / 60;
const MS = 1000 * FRAME;

/** The pointer held at one place on the panel for `frames` frames (null: off the panel). */
function hold(sim: DeviceSim, at: { u: number; v: number } | null, frames: number) {
  for (let i = 0; i < frames; i++) {
    handSteer(sim, at, MS);
    sim.tick(FRAME);
  }
}

describe("the hub's panel under the hand", () => {
  let sim: DeviceSim;
  beforeEach(() => {
    useGuideStore.setState({ page: "hub", preview: null, leaving: null, handsOn: false });
    sim = new DeviceSim();
    sim.tick(FRAME);
  });
  // The count is kept with the board, outside any one hub: no test leaves it owing.
  afterEach(() => {
    useGuideStore.setState({ handsOn: false });
    handBackNow(sim);
    makeRestore(sim);
    turnBackNow(sim);
  });

  it("does nothing with the pointer off the panel", () => {
    hold(sim, null, 30);
    expect(handIsOn()).toBe(false);
    expect(sim.snapshot().turns).toEqual([0, 0, 0, 0]);
  });

  it("turns K1 across the panel and K2 up it, a click at a time, and no further than its reach", () => {
    hold(sim, { u: 1, v: 1 }, 3);
    const early = sim.snapshot().turns;
    expect(early[0]).toBeGreaterThan(0);
    expect(early[0]).toBeLessThanOrEqual(2);
    hold(sim, { u: 1, v: 1 }, 120);
    const t = sim.snapshot().turns;
    expect(t[0]).toBe(9);
    expect(t[1]).toBe(7);
    expect(t[2]).toBe(0);
    expect(t[3]).toBe(0);
    expect(sim.knobReadout(0).value).toBeCloseTo(9 / 48, 6);
    hold(sim, { u: -1, v: -1 }, 200);
    expect(sim.snapshot().turns.slice(0, 2)).toEqual([-9, -7]);
  });

  it.each([
    [1, 1],
    [-1, 0.4],
    [0.3, -1],
    [-0.62, -0.77],
  ])("is back exactly where it began once the pointer leaves the panel (%f, %f)", (u, v) => {
    const speed = sim.knobReadout(1).value;
    hold(sim, { u, v }, 90);
    expect(handIsOn()).toBe(true);
    hold(sim, null, 90);
    expect(handIsOn()).toBe(false);
    expect(sim.snapshot().turns).toEqual([0, 0, 0, 0]);
    expect(sim.knobReadout(0).value).toBe(0);
    expect(sim.knobReadout(1).value).toBeCloseTo(speed, 9);
  });

  it("is back at once when a guide is pointed at, and Play's answer starts from Origin's own start", () => {
    hold(sim, { u: 0.8, v: -0.5 }, 90);
    handBackNow(sim);
    expect(handIsOn()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
    useGuideStore.setState({ preview: "play" });
    // The hand does not steer while a guide has the board.
    hold(sim, { u: 1, v: 1 }, 30);
    expect(handIsOn()).toBe(false);
    for (let i = 0; i < 12; i++) {
      turnOn(sim);
      sim.tick(FRAME);
    }
    useGuideStore.setState({ preview: null });
    // …nor while K1 is still on its way back from Play's answer.
    hold(sim, { u: 1, v: 1 }, 5);
    expect(handIsOn()).toBe(false);
    turnBackNow(sim);
    expect(knobIsTurned()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
  });

  it("leaves Make's pattern alone", () => {
    makeNext(sim);
    sim.tick(FRAME);
    const before = sim.snapshot().turns;
    hold(sim, { u: 1, v: 1 }, 60);
    expect(handIsOn()).toBe(false);
    expect(sim.snapshot().turns).toEqual(before);
  });

  it("gives the board back before the reader's own turn, and keeps out of it afterwards", () => {
    hold(sim, { u: 1, v: 0 }, 90);
    // The reader takes K3: Device presses it and says so (store.handsOn); HubAnswers calls handBackNow.
    sim.press(2);
    useGuideStore.setState({ handsOn: true });
    handBackNow(sim);
    sim.tick(FRAME);
    expect(handIsOn()).toBe(false);
    expect(sim.snapshot().down[2]).toBe(true);
    expect(sim.knobReadout(0).value).toBeCloseTo(0, 9);
    hold(sim, { u: -1, v: 1 }, 60);
    expect(handIsOn()).toBe(false);
    sim.release(2);
  });

  it("does not steer off the hub", () => {
    useGuideStore.setState({ page: "play" });
    hold(sim, { u: 1, v: 1 }, 60);
    expect(handIsOn()).toBe(false);
  });
});
