// The `@knobs` line is how a pattern's knob names and ranges leave the lab.
// Publish, flatten and the lab's own export write it; the lab, the community's
// cards and the sandbox read it back. Until 21 October the printer wrote a
// knob with an empty name as "-=0..1", which reads back as a knob called "-",
// and rounded a fine range such as 0.0001..0.0004 to "0..0", which the parser
// throws away.

import { describe, expect, it } from "vitest";
import {
  KNOB_LABEL_MAX,
  buildKnobsAnnotationLine,
  matchKnobsAnnotation,
  parseKnobsAnnotation,
  stripKnobsAnnotation,
} from "./knobs";

const LAB_DEFAULT_RANGES: [number, number][] = [
  [0, 1],
  [0.1, 10],
  [0, 4.9],
  [0, 1],
];

/** Write a line and read it back: the trip every published pattern makes. */
const roundTrip = (labels: string[], ranges: [number, number][]) =>
  parseKnobsAnnotation(buildKnobsAnnotationLine(labels, ranges));

describe("parseKnobsAnnotation", () => {
  it("reads names and ranges, and '-' skips a slot", () => {
    const code = "// @knobs Folds=3..12, -, Zoom=2..17, Contrast=0.1..1\nfunction draw() {}";
    expect(parseKnobsAnnotation(code)).toEqual([
      { name: "Folds", min: 3, max: 12 },
      null,
      { name: "Zoom", min: 2, max: 17 },
      { name: "Contrast", min: 0.1, max: 1 },
    ]);
  });

  it("finds the line below other code and reads negative bounds", () => {
    const code = "const seed = 7;\n  //@knobs  Pitch = -20 .. 20\nfunction draw() {}";
    expect(parseKnobsAnnotation(code)).toEqual([{ name: "Pitch", min: -20, max: 20 }, null, null, null]);
  });

  it("drops an entry whose range is empty, backwards or missing", () => {
    expect(parseKnobsAnnotation("// @knobs A=1..1, B=5..2, C=fast, D=0..1")).toEqual([
      null,
      null,
      null,
      { name: "D", min: 0, max: 1 },
    ]);
  });

  it("is null without a line, or when nothing on it parses", () => {
    expect(parseKnobsAnnotation("function draw() {}")).toBeNull();
    expect(parseKnobsAnnotation("// @knobs -, -, -, -")).toBeNull();
    expect(parseKnobsAnnotation("// @knobs Speed")).toBeNull();
    expect(parseKnobsAnnotation("const note = '@knobs Speed=0..1';")).toBeNull();
  });

  it("reads four slots and leaves a fifth alone", () => {
    const entries = parseKnobsAnnotation("// @knobs A=0..1, B=0..2, C=0..3, D=0..4, E=0..5");
    expect(entries?.map((entry) => entry?.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("clips a name to what the device's status screen can show", () => {
    const entries = parseKnobsAnnotation("// @knobs TemperatureDrift=0..1");
    expect(entries?.[0]?.name).toBe("TemperatureDri");
    expect(entries?.[0]?.name).toHaveLength(KNOB_LABEL_MAX);
  });
});

describe("buildKnobsAnnotationLine", () => {
  it("writes the line the parser reads back", () => {
    const line = buildKnobsAnnotationLine(
      ["Folds", "Speed", "Zoom", "Contrast"],
      [
        [3, 12],
        [0.1, 10],
        [2, 17],
        [0.1, 1],
      ],
    );
    expect(line).toBe("// @knobs Folds=3..12, Speed=0.1..10, Zoom=2..17, Contrast=0.1..1");
    expect(parseKnobsAnnotation(line)).toEqual([
      { name: "Folds", min: 3, max: 12 },
      { name: "Speed", min: 0.1, max: 10 },
      { name: "Zoom", min: 2, max: 17 },
      { name: "Contrast", min: 0.1, max: 1 },
    ]);
  });

  it("gives a knob with no name its default label, which reads back as that knob", () => {
    const labels = ["", "Speed", "  ", ",="];
    expect(buildKnobsAnnotationLine(labels, LAB_DEFAULT_RANGES)).toBe(
      "// @knobs Knob 1=0..1, Speed=0.1..10, Knob 3=0..4.9, Knob 4=0..1",
    );
    expect(roundTrip(labels, LAB_DEFAULT_RANGES)?.map((entry) => entry?.name)).toEqual([
      "Knob 1",
      "Speed",
      "Knob 3",
      "Knob 4",
    ]);
  });

  it("turns the annotation's separators inside a name into spaces", () => {
    const names = roundTrip(["Hue, warm", "a=b", "Zoom", "Mix"], LAB_DEFAULT_RANGES)?.map(
      (entry) => entry?.name,
    );
    expect(names).toEqual(["Hue  warm", "a b", "Zoom", "Mix"]);
  });

  it("keeps a fine range whole", () => {
    const ranges: [number, number][] = [
      [0.0001, 0.0004],
      [1.0004, 1.0009],
      [-0.0005, 0.0005],
      [0, 1],
    ];
    expect(roundTrip(["Drift", "Detune", "Jitter", "Mix"], ranges)).toEqual([
      { name: "Drift", min: 0.0001, max: 0.0004 },
      { name: "Detune", min: 1.0004, max: 1.0009 },
      { name: "Jitter", min: -0.0005, max: 0.0005 },
      { name: "Mix", min: 0, max: 1 },
    ]);
  });

  it("leaves float noise out of the line", () => {
    const line = buildKnobsAnnotationLine(["Mix"], [[0.1 + 0.2, 0.7 * 3]]);
    expect(line).toBe("// @knobs Mix=0.3..2.1");
  });

  it("writes 0..1 for a label that has no range", () => {
    expect(buildKnobsAnnotationLine(["A", "B"], [[2, 3]])).toBe("// @knobs A=2..3, B=0..1");
  });
});

describe("stripKnobsAnnotation and matchKnobsAnnotation", () => {
  it("strip takes off a written line and gives the code back as it was", () => {
    const code = "function draw(display) {\n  display.clear();\n}";
    const line = buildKnobsAnnotationLine(["Speed"], [[0, 4]]);
    expect(stripKnobsAnnotation(`${line}\n${code}`)).toBe(code);
    expect(stripKnobsAnnotation(code)).toBe(code);
  });

  it("match returns the line as it is written, indent included", () => {
    expect(matchKnobsAnnotation("  // @knobs A=0..1\nfunction draw() {}")).toBe("  // @knobs A=0..1");
    expect(matchKnobsAnnotation("function draw() {}")).toBeNull();
  });
});
