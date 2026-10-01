import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeviceSim } from "@/lib/guide/deviceSim";
import { knobIsTurned, turnBackClick, turnBackNow, turnOn } from "./hubKnob";
import { useGuideStore } from "./store";

// The hub's Play answer turns K1 on the board every guide shares. Whatever
// the reader does next — points away, at another guide, or goes in — the hue
// must be back where the hub found it: Play's words call Origin red.

const FRAME = 1 / 60;

/** Play pointed at for `clicks` clicks, a frame after each, as on the hub. */
function pointAtPlay(sim: DeviceSim, clicks: number) {
  for (let i = 0; i < clicks; i++) {
    turnOn(sim);
    sim.tick(FRAME);
  }
}

/** The colour of Origin's tiles on the panel: the most saturated pixel of the frame. */
function tileColour(sim: DeviceSim): [number, number, number] {
  const f = sim.frame;
  let best: [number, number, number] = [0, 0, 0];
  let spread = -1;
  for (let i = 0; i < f.length; i += 4) {
    const s = Math.max(f[i], f[i + 1], f[i + 2]) - Math.min(f[i], f[i + 1], f[i + 2]);
    if (s > spread) {
      spread = s;
      best = [f[i], f[i + 1], f[i + 2]];
    }
  }
  return best;
}

function expectRed(sim: DeviceSim) {
  const [r, g, b] = tileColour(sim);
  expect(r).toBeGreaterThan(100);
  expect(g).toBe(0);
  expect(b).toBe(0);
}

describe("the hub's Play answer", () => {
  let sim: DeviceSim;
  beforeEach(() => {
    useGuideStore.setState({ handsOn: false });
    sim = new DeviceSim();
    sim.tick(FRAME);
  });
  // The count is kept with the board, outside any one hub: no test leaves it owing.
  afterEach(() => turnBackNow(sim));

  it("starts from a red Origin with K1 at its start", () => {
    expect(sim.knobReadout(0).value).toBe(0);
    expectRed(sim);
  });

  it("turns the hue while Play is pointed at", () => {
    pointAtPlay(sim, 18);
    expect(knobIsTurned()).toBe(true);
    expect(sim.knobReadout(0).value).toBeCloseTo(18 / 48, 6);
    const [, g, b] = tileColour(sim);
    expect(g + b).toBeGreaterThan(0);
    turnBackNow(sim);
  });

  it.each([1, 7, 18, 24, 25, 40, 48, 61, 200])("is back at exactly its start after %i clicks, going in at once", (clicks) => {
    pointAtPlay(sim, clicks);
    turnBackNow(sim);
    expect(knobIsTurned()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
    sim.tick(FRAME);
    expectRed(sim);
  });

  it.each([3, 18, 30, 48, 100])("comes home a click at a time after %i clicks, never by more than half a turn of the hue", (clicks) => {
    pointAtPlay(sim, clicks);
    let steps = 0;
    while (!turnBackClick(sim)) {
      sim.tick(FRAME);
      if (++steps > 200) throw new Error("never came home");
    }
    expect(steps).toBeLessThanOrEqual(24);
    expect(knobIsTurned()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
    sim.tick(FRAME);
    expectRed(sim);
  });

  it("is turned back before the panel goes dark for Build, and is red when it lights again", () => {
    pointAtPlay(sim, 20);
    // Play -> Build in one move: no frame in between.
    turnOn(sim);
    turnBackNow(sim);
    sim.setMode("off");
    sim.tick(FRAME);
    sim.setMode("run");
    // Power on fades the frame up over 0.6 s.
    for (let i = 0; i < 60; i++) sim.tick(FRAME);
    expect(sim.knobReadout(0).value).toBe(0);
    expectRed(sim);
  });

  it("leaves another pattern's knob alone when Make's pattern comes on", () => {
    pointAtPlay(sim, 20);
    turnBackNow(sim);
    sim.setPack("basics");
    sim.showPattern("midsummer_sea");
    sim.tick(FRAME);
    const sea = sim.knobReadout(0).value;
    sim.showPattern("origin");
    sim.setPack("origin");
    sim.tick(FRAME);
    expect(sim.knobReadout(0).value).toBe(0);
    expectRed(sim);
    sim.setPack("basics");
    sim.showPattern("midsummer_sea");
    expect(sim.knobReadout(0).value).toBe(sea);
  });

  it("does not turn while the reader has the knobs, and keeps their turn", () => {
    sim.turn(0, 5);
    sim.tick(FRAME);
    const theirs = sim.knobReadout(0).value;
    useGuideStore.setState({ handsOn: true });
    pointAtPlay(sim, 10);
    expect(knobIsTurned()).toBe(false);
    turnBackNow(sim);
    expect(sim.knobReadout(0).value).toBe(theirs);
  });

  it("gives back only its own clicks when the hue was not at its start", () => {
    sim.turn(0, 5);
    sim.tick(FRAME);
    const theirs = sim.knobReadout(0).value;
    pointAtPlay(sim, 12);
    turnBackNow(sim);
    expect(sim.knobReadout(0).value).toBeCloseTo(theirs, 9);
  });

  it("does not turn a screen's knob: with BRIGHTNESS open, nothing is counted", () => {
    sim.setMode("brightness");
    sim.tick(FRAME);
    const before = sim.snapshot().brightness;
    pointAtPlay(sim, 10);
    expect(knobIsTurned()).toBe(false);
    expect(sim.snapshot().brightness).toBe(before);
  });
});
