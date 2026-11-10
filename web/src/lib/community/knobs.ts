"use client";

import { LOGICAL_KNOB_RANGES, knobMidpoint, normalizeKnob } from "@/lib/pattern/controls";
import { DEFAULT_KNOB_LABELS, parseKnobsAnnotation } from "@/lib/pattern/knobs";

// @knobs for the community's cards and detail page: the labels, the ranges,
// and a starting value per knob — the MIDPOINT of each range, because a card
// has no saved knob state and the middle is where a pattern shows most.
//
// The line's grammar and parser are lib/pattern/knobs.ts, shared with the
// lab. This file used to carry its own copy of the regex "so the community
// never reaches into the lab's internals"; the shared module is neither
// side's internals, which is the point of it.

export type KnobSetup = {
  labels: string[];
  ranges: Array<[number, number]>;
  values: number[];
};

export { DEFAULT_KNOB_LABELS };

export function knobSetupFromCode(code: string): KnobSetup {
  const labels = [...DEFAULT_KNOB_LABELS];
  const ranges: Array<[number, number]> = LOGICAL_KNOB_RANGES.map(([min, max]) => [min, max]);
  const values: number[] = ranges.map(knobMidpoint);

  const entries = parseKnobsAnnotation(code);
  if (entries) {
    entries.forEach((entry, index) => {
      if (!entry) return;
      labels[index] = entry.name;
      ranges[index] = [entry.min, entry.max];
      values[index] = knobMidpoint(ranges[index]);
    });
  }

  return { labels, ranges, values };
}

export function normalizedKnobs(values: number[], ranges: Array<[number, number]>): number[] {
  return values.map((value, index) => normalizeKnob(value, ranges[index] ?? [0, 1]));
}
