// The scaffold buildHExport writes for a layer stack has to compile before a
// single layer is translated. The stubs draw black, and everything around
// them is finished C++. Until 24 October 2026 two things in it stopped g++.
// A knob that only became a whole number once rounded to five places came out
// as `63f`, which C++ reads as 63 with a literal suffix nobody defined. The
// Director leaves a 0..360 knob there at bus value 175 of 1000
// (62.99999999999999). And a backslash at the end of the pattern name or a
// knob label escaped the closing quote.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { BUS_WIRE_MAX } from "@/lib/pattern/controls";
import { CXX, cxxFlags, writeStubs } from "./cxxHarness";
import { buildHExport, enforcePatternName, type HExportArgs } from "./hExport";
import { DEFAULT_RAMP_STATE, createPixelLayer, type CodeLayer, type KnobRange, type Layer } from "./types";

const FRAME = { width: 128, height: 64 };
const RANGES: KnobRange[] = [[0, 360], [0, 100], [0, 1], [0, 1]];

/** The knob the Director's transport sets for a bus value (lib/lab/director/transport.ts). */
const fromBus = (v: number, range: KnobRange) => range[0] + (v / BUS_WIRE_MAX) * (range[1] - range[0]);

// 62.99999999999999, 7.000000000000001, a value that rounds to 0, and one
// that was always fine.
const KNOBS = [fromBus(175, RANGES[0]), fromBus(70, RANGES[1]), 0.000001, 0.5];

function codeLayer(name: string): CodeLayer {
  return {
    id: name,
    type: "code",
    name,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    code: "export function draw(display) {}",
    ramp: DEFAULT_RAMP_STATE,
    recolor: false,
    knobsAnnotationRaw: null,
    matrixAnnotationRaw: null,
  };
}

// A code layer over pixel art, so the header is the scaffold and not one
// translated pattern. The names end in a backslash too: they land in comments.
function stack(): Layer[] {
  const art = createPixelLayer(FRAME, "Under\\");
  art.data.set([255, 0, 0, 255], 0);
  return [codeLayer("Top\\"), { ...art, name: "Under\\" }];
}

function scaffold(overrides: Partial<HExportArgs> = {}) {
  return buildHExport({
    name: "Lab",
    matrix: FRAME,
    layers: stack(),
    knobs: KNOBS,
    ranges: RANGES,
    knobLabels: ["Hue", "Speed", "Mode", "Freq"],
    ...overrides,
  });
}

describe("numbers in the scaffold", () => {
  it("writes a knob that rounds to a whole number as a float literal", () => {
    expect(KNOBS[0]).not.toBe(63);
    expect(KNOBS[1]).not.toBe(7);
    const { scaffold: text } = scaffold();
    expect(text).toContain("static float knobVal[4]  = {63.0f, 7.0f, 0.0f, 0.5f};");
    expect(text).toContain("static float knobNorm[4] = {0.175f, 0.07f, 0.0f, 0.5f};");
  });

  it("has no digits ending in a bare f", () => {
    const { scaffold: text } = scaffold();
    expect(text.match(/(?<![\w.])\d+f\b/g)).toBeNull();
  });
});

describe("names in the scaffold", () => {
  const name = 'Say "hi" AC\\';
  const knobLabels = ["Speed\\", 'Big "C"', "C", "D"];

  it("leaves the quotes and backslashes out of NAME and the knob labels", () => {
    const { scaffold: text } = scaffold({ name, knobLabels });
    expect(text).toContain('const char* NAME = "Say hi AC";');
    expect(text).toContain('const char* const KNOB_LABELS[4] = {"Speed", "Big C", "C", "D"};');
  });

  it("names the pattern as a one-layer header does", () => {
    const { scaffold: text } = scaffold({ name, knobLabels });
    expect(text).toContain(enforcePatternName('const char* NAME = "Placeholder";', name));
  });
});

// GitHub's runners have g++, so the compiler half runs there.
if (!CXX && process.env.CI) throw new Error("no C++ compiler on this runner, and the header test needs one");

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!CXX)("the scaffold through the compiler", () => {
  it("builds with the knobs and names above, and the program reads them back", () => {
    const built = scaffold({ name: "AC\\", knobLabels: ["Speed\\", "B", "C", "D"] });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pf-hexport-"));
    dirs.push(dir);
    writeStubs(dir);
    fs.writeFileSync(path.join(dir, "Lab.h"), built.scaffold);
    const ns = built.namespaceName;
    fs.writeFileSync(
      path.join(dir, "main.cpp"),
      `#include <stdio.h>
#include "Lab.h"

int main() {
  printf("%s|%s|%g|%g|%g|%g\\n", ${ns}::NAME, ${ns}::KNOB_LABELS[0],
         ${ns}::knobVal[0], ${ns}::knobVal[1], ${ns}::knobVal[2], ${ns}::knobVal[3]);
  return 0;
}
`,
    );
    const binary = path.join(dir, "lab");
    execFileSync(CXX!, [...cxxFlags(dir), "main.cpp", "-o", binary], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    expect(execFileSync(binary, { encoding: "utf8" }).trim()).toBe("AC|Speed|63|7|0|0.5");
  });
});
