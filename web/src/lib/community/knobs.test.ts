// A community card has no saved knob state, so each knob starts in the middle
// of its @knobs range, and the card hands the pattern where a knob sits as
// input.knobNormalized. Both have to read a knob the way the Lab does. The
// cards rounded the middle to three decimals and divided by no less than
// 0.001, so a 0.0001..0.0004 knob started at 0, below its range, and reached
// its pattern as -0.1 where the Lab gave 0.5.

import { describe, expect, it } from "vitest";
import { LabEngine } from "@/lib/lab/engine";
import { DEFAULT_RAMP_STATE, cloneRampState, type CodeLayer } from "@/lib/lab/types";
import { knobSetupFromCode, normalizedKnobs } from "./knobs";

const FINE = "// @knobs Fine=0.0001..0.0004, Tight=0.001..0.002, Hue=0..1, Speed=0.1..10";

/** What the Lab's engine hands a pattern as knobNormalized, read back out of two pixels. */
function labNormalized(knobs: number[], ranges: Array<[number, number]>) {
  // Each knob's 0..1 is written times 200 into a channel: knobs 1..3 into
  // pixel (0, 0), knob 4 into pixel (1, 0).
  const code = `
    function update(dt, input, params) { params.n = input.knobNormalized; }
    function draw(display, params) {
      const n = params.n || [0, 0, 0, 0];
      display.setPixel(0, 0, n[0] * 200, n[1] * 200, n[2] * 200);
      display.setPixel(1, 0, n[3] * 200, 0, 0);
    }
  `;
  const layer: CodeLayer = {
    id: "norm",
    type: "code",
    name: "norm",
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    code,
    ramp: cloneRampState(DEFAULT_RAMP_STATE),
    recolor: false,
    knobsAnnotationRaw: null,
    matrixAnnotationRaw: null,
  };
  const data = new LabEngine().render(
    { matrix: { width: 2, height: 1 }, layers: [layer], activeLayerId: layer.id, knobs, ranges },
    1 / 60,
    0,
  ).data;
  return [data[0], data[1], data[2], data[4]];
}

describe("a card's knobs", () => {
  it("start in the middle of each range, however fine the range", () => {
    const { ranges, values } = knobSetupFromCode(FINE);
    expect(ranges).toEqual([[0.0001, 0.0004], [0.001, 0.002], [0, 1], [0.1, 10]]);
    // Three decimals started these at 0 and 0.002.
    expect(values).toEqual([0.00025, 0.0015, 0.5, 5.05]);
  });

  it("reach the pattern at 0.5 when they start", () => {
    const { ranges, values } = knobSetupFromCode(FINE);
    for (const share of normalizedKnobs(values, ranges)) expect(share).toBeCloseTo(0.5, 9);
  });

  it("reach the pattern as the same 0..1 the Lab's engine hands it", () => {
    const { ranges } = knobSetupFromCode(FINE);
    const knobs = [0.000175, 0.00125, 0.25, 7.525];
    const card = normalizedKnobs(knobs, ranges);
    expect(card.map((share) => Math.round(share * 200))).toEqual([50, 50, 50, 150]);
    expect(labNormalized(knobs, ranges)).toEqual([50, 50, 50, 150]);
  });
});
