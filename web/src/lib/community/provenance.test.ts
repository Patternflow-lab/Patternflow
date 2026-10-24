// Provenance badges against the lines Pattern Lab writes by itself. Every Lab
// publish carries `@matrix` and every value-field layer carries `@ramp`,
// touched or not. Until 21 October 2026 the badges counted the line alone, so
// a variant published the way it came out of the Lab's AI gallery showed
// "Framed" and "Colour shaped" on its page.

import { describe, expect, it } from "vitest";
import { defaultKnobState, withKnobsAnnotation } from "@/lib/lab/annotations";
import { flattenLayers } from "@/lib/lab/flatten";
import { DEFAULT_RAMP_STATE, cloneRampState, type CodeLayer, type KnobRange, type RampState } from "@/lib/lab/types";
import { DEFAULT_MATRIX, withMatrixAnnotation, type MatrixSize } from "@/lib/pattern/matrix";
import { withRampAnnotation } from "@/lib/pattern/ramp";
import { MADE_HOW_LABELS } from "./validate";
import { provenanceFor, provenanceSignals } from "./provenance";

const VALUE_FIELD = `export function draw(display, params, time) {
  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) display.setValue(x, y, (x / display.width + time) % 1);
  }
}`;

function codeLayer(id: string, ramp: RampState = cloneRampState(DEFAULT_RAMP_STATE), recolor = false): CodeLayer {
  return {
    id,
    type: "code",
    name: id,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    code: VALUE_FIELD,
    ramp,
    recolor,
    knobsAnnotationRaw: null,
    matrixAnnotationRaw: null,
  };
}

type LabState = { matrix?: MatrixSize; labels?: string[]; ranges?: KnobRange[] };

// The single-layer branch of buildExportCode (app/pattern-lab/PatternLabClient.tsx),
// with every stop at full alpha so the premultiply there changes nothing.
function publishedByLab(layer: CodeLayer, state: LabState = {}): string {
  const knobs = defaultKnobState();
  let code = withMatrixAnnotation(layer.code, state.matrix ?? DEFAULT_MATRIX);
  code = withKnobsAnnotation(code, state.labels ?? knobs.labels, state.ranges ?? knobs.ranges);
  return withRampAnnotation(code, {
    stops: layer.ramp.stops.map((stop) => ({ position: stop.position, color: stop.color })),
    mode: layer.ramp.mode,
    wrap: layer.ramp.wrap,
    recolor: layer.recolor,
  });
}

const ids = (code: string, hasHeader = false) => provenanceSignals(code, hasHeader).map((signal) => signal.id);

describe("provenanceSignals", () => {
  it("gives an untouched value-field layer no badge", () => {
    const code = publishedByLab(codeLayer("variant"));
    expect(code).toContain("// @matrix 128x64");
    expect(code).toContain("// @ramp linear 0:#000000 1:#ffffff");
    expect(ids(code)).toEqual([]);
  });

  it("gives an untouched flattened stack no badge from its knobs or frame", () => {
    const knobs = defaultKnobState();
    const code = flattenLayers([codeLayer("top"), codeLayer("bottom")], DEFAULT_MATRIX, {
      labels: knobs.labels,
      ranges: knobs.ranges,
    });
    expect(code).toContain("// @knobs Knob 1=0..1, Knob 2=0.1..10, Knob 3=0..4.9, Knob 4=0..1");
    expect(code).toContain("// @matrix 128x64");
    expect(ids(code)).toEqual([]);
  });

  it("counts a ramp somebody changed", () => {
    const recoloured = cloneRampState(DEFAULT_RAMP_STATE);
    recoloured.stops[1].color = "#ff4d00";
    expect(ids(publishedByLab(codeLayer("a", recoloured)))).toEqual(["ramp"]);

    const stepped = { ...cloneRampState(DEFAULT_RAMP_STATE), mode: "step" as const };
    expect(ids(publishedByLab(codeLayer("b", stepped)))).toEqual(["ramp"]);

    const wrapped = { ...cloneRampState(DEFAULT_RAMP_STATE), wrap: true };
    expect(ids(publishedByLab(codeLayer("c", wrapped)))).toEqual(["ramp"]);

    const threeStops = cloneRampState(DEFAULT_RAMP_STATE);
    threeStops.stops.splice(1, 0, { position: 0.5, color: "#808080", alpha: 1 });
    expect(ids(publishedByLab(codeLayer("d", threeStops)))).toEqual(["ramp"]);
  });

  it("counts recolor switched on over the stock ramp", () => {
    expect(ids(publishedByLab(codeLayer("a", cloneRampState(DEFAULT_RAMP_STATE), true)))).toEqual(["ramp"]);
  });

  it("reads the stock ramp in either stop order and either case", () => {
    expect(ids("// @ramp linear 1:#FFFFFF 0:#000000\nfunction draw() {}")).toEqual([]);
  });

  it("counts knobs somebody named or retuned", () => {
    const knobs = defaultKnobState();
    const named = ["Folds", ...knobs.labels.slice(1)];
    expect(ids(publishedByLab(codeLayer("a"), { labels: named }))).toEqual(["knobs"]);

    const ranges = knobs.ranges.map((range): KnobRange => [range[0], range[1]]);
    ranges[1] = [0.1, 3];
    expect(ids(publishedByLab(codeLayer("b"), { ranges }))).toEqual(["knobs"]);
  });

  it("does not count a knobs line that only repeats the stock slots", () => {
    expect(ids("// @knobs Knob 1=0..1, -, -, -\nfunction draw() {}")).toEqual([]);
  });

  it("counts any frame other than 128×64, the portrait one too", () => {
    const square = provenanceSignals(publishedByLab(codeLayer("a"), { matrix: { width: 64, height: 64 } }), false);
    expect(square.map((signal) => signal.id)).toEqual(["matrix"]);
    expect(square[0].detail).toBe("Composed for 64×64. Every new pattern starts at 128×64.");

    expect(ids(publishedByLab(codeLayer("b"), { matrix: { width: 64, height: 128 } }))).toEqual(["matrix"]);
  });

  it("ignores lines their own parser throws away", () => {
    const code = ["// @ramp sparkly 0:#000000", "// @knobs whatever", "// @matrix 4x4", "function draw() {}"].join("\n");
    expect(ids(code)).toEqual([]);
  });

  it("keeps the layer stack and the hardware header as they were", () => {
    expect(ids("// @stack v1:abc\nfunction draw() {}", true)).toEqual(["stack", "hardware"]);
  });

  it("lists every signal in one order", () => {
    const ramp = cloneRampState(DEFAULT_RAMP_STATE);
    ramp.stops[0].color = "#081840";
    const code = publishedByLab(codeLayer("all", ramp), {
      matrix: { width: 64, height: 64 },
      labels: ["Folds", "Speed", "Zoom", "Contrast"],
    });
    expect(ids(`${code}\n// @stack v1:abc\n`, true)).toEqual(["ramp", "knobs", "stack", "matrix", "hardware"]);
  });
});

describe("provenanceFor", () => {
  it("names a made_how the community knows", () => {
    const record = provenanceFor("function draw() {}", false, "ai-generated");
    expect(record.madeHow).toBe("ai-generated");
    expect(record.madeHowLabel).toBe(MADE_HOW_LABELS["ai-generated"]);
    expect(record.signals).toEqual([]);
  });

  it("drops a made_how it does not know", () => {
    const record = provenanceFor("function draw() {}", false, "by robots");
    expect(record).toEqual({ madeHow: null, madeHowLabel: null, madeHowBlurb: null, signals: [] });
  });
});
