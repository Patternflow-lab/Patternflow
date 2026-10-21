// The knob math every preview shares: how far one detent moves a value, which
// knobs wrap, and how a value change becomes the encoder clicks a pattern
// reads in input.knobDeltas. The first-screen preview goes through
// getKnobValueDelta by front-panel id; the lab, the sandbox and the guide go
// through knobTargetToDelta by logical index. Both used to spell out the wrap
// rule themselves.

import { describe, expect, it } from "vitest";
import { DETENTS_PER_TURN, TURNS_PER_FULL_RANGE } from "@/lib/shared/constants";
import { knobTargetToDelta } from "./harness";
import {
  ENCODER_CLICKS_PER_TURN,
  LOGICAL_KNOB_RANGES,
  LOGICAL_KNOB_TO_WEB_KNOB,
  LOGICAL_KNOB_WRAP,
  getKnobValueDelta,
  knobDetentStep,
  knobUnitsPerTurn,
  logicalKnobUnitsPerTurn,
  toEncoderDelta,
  webKnobRange,
  wrapKnobDelta,
  type KnobId,
} from "./controls";

describe("travel", () => {
  it("crosses any range in the same number of turns", () => {
    for (const range of [[0, 1], [0.1, 10], [-20, 20], [3, 12]] as const) {
      const span = range[1] - range[0];
      expect(knobUnitsPerTurn(range) * TURNS_PER_FULL_RANGE).toBeCloseTo(span, 12);
      expect(knobDetentStep(range) * DETENTS_PER_TURN * TURNS_PER_FULL_RANGE).toBeCloseTo(span, 12);
    }
  });

  it("counts the encoder's detents from shared/constants.json", () => {
    expect(ENCODER_CLICKS_PER_TURN).toBe(DETENTS_PER_TURN);
  });

  it("turns one detent's worth of value back into one click", () => {
    for (const range of LOGICAL_KNOB_RANGES) {
      expect(toEncoderDelta(range, knobDetentStep(range))).toBeCloseTo(1, 12);
      expect(toEncoderDelta(range, -knobUnitsPerTurn(range))).toBeCloseTo(-DETENTS_PER_TURN, 12);
    }
  });

  it("takes a pattern's declared ranges per knob and the lab's defaults for the rest", () => {
    const perTurn = logicalKnobUnitsPerTurn([[0, 10]]);
    expect(perTurn).toHaveLength(4);
    expect(perTurn[0]).toBeCloseTo(10 / TURNS_PER_FULL_RANGE, 12);
    LOGICAL_KNOB_RANGES.slice(1).forEach((range, index) => {
      expect(perTurn[index + 1]).toBeCloseTo(knobUnitsPerTurn(range), 12);
    });
  });
});

describe("front-panel ids", () => {
  it("finds each knob's range through the logical order (Hue, Speed, Mode, Freq)", () => {
    expect(webKnobRange("c1")).toEqual(LOGICAL_KNOB_RANGES[0]);
    expect(webKnobRange("c2")).toEqual(LOGICAL_KNOB_RANGES[1]);
    expect(webKnobRange("c4")).toEqual(LOGICAL_KNOB_RANGES[2]);
    expect(webKnobRange("c3")).toEqual(LOGICAL_KNOB_RANGES[3]);
  });
});

describe("wrapping", () => {
  it("takes the short way across the seam", () => {
    expect(wrapKnobDelta(0.05 - 0.95)).toBeCloseTo(0.1, 12);
    expect(wrapKnobDelta(0.95 - 0.05)).toBeCloseTo(-0.1, 12);
  });

  it("leaves a move of half a range or less alone", () => {
    expect(wrapKnobDelta(0.3)).toBe(0.3);
    expect(wrapKnobDelta(-0.3)).toBe(-0.3);
    expect(wrapKnobDelta(0.5)).toBe(0.5);
    expect(wrapKnobDelta(-0.5)).toBe(-0.5);
  });

  it("wraps the front-panel knobs that LOGICAL_KNOB_WRAP marks, and only those", () => {
    const wraps = (id: KnobId) => getKnobValueDelta(id, 0.05, 0.95) > 0;
    expect((["c1", "c2", "c3", "c4"] as const).filter(wraps)).toEqual(["c1", "c3"]);
    LOGICAL_KNOB_TO_WEB_KNOB.forEach((id, logicalIndex) => {
      expect(wraps(id)).toBe(LOGICAL_KNOB_WRAP[logicalIndex]);
    });
  });

  it("gives the same clicks by front-panel id as the lab's path gives by logical index", () => {
    const moves: Array<[number, number]> = [
      [0.95, 0.05],
      [0.05, 0.95],
      [0.2, 0.45],
      [0.6, 0.1],
    ];
    LOGICAL_KNOB_TO_WEB_KNOB.forEach((id, logicalIndex) => {
      const range = LOGICAL_KNOB_RANGES[logicalIndex];
      for (const [previous, next] of moves) {
        const byId = toEncoderDelta(range, getKnobValueDelta(id, next, previous));
        const byIndex = knobTargetToDelta(
          previous,
          next,
          LOGICAL_KNOB_WRAP[logicalIndex],
          knobUnitsPerTurn(range),
        );
        expect(byId).toBeCloseTo(byIndex, 9);
      }
    });
  });
});
