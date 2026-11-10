// `@matrix` carries the frame a pattern draws into. The lab, the community
// pages and the sandbox all read it through this module, and 33 files import
// it; a pattern without the line is the stock 128×64 panel.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_MATRIX,
  MATRIX_MAX,
  MATRIX_MIN,
  buildMatrixAnnotationLine,
  clampMatrixDimension,
  describeMatrixShape,
  formatMatrix,
  isStockPanelFrame,
  matchMatrixAnnotation,
  matrixFit,
  matrixFromCode,
  parseMatrixAnnotation,
  parseMatrixSize,
  stripMatrixAnnotation,
  withMatrixAnnotation,
  type MatrixSize,
} from "./matrix";

const DRAW = "function draw(display) {\n  display.clear();\n}";

describe("parseMatrixAnnotation", () => {
  it("reads width and height", () => {
    expect(parseMatrixAnnotation(`// @matrix 64x128\n${DRAW}`)).toEqual({ width: 64, height: 128 });
  });

  it("takes ×, * and spaces between the numbers, and finds the line below other code", () => {
    expect(parseMatrixAnnotation("// @matrix 64 × 32")).toEqual({ width: 64, height: 32 });
    expect(parseMatrixAnnotation("const a = 1;\n  //@matrix 32*32\n")).toEqual({ width: 32, height: 32 });
  });

  it("refuses a side outside 8..512 instead of clamping it", () => {
    expect(parseMatrixAnnotation(`// @matrix ${MATRIX_MIN - 1}x64`)).toBeNull();
    expect(parseMatrixAnnotation(`// @matrix 128x${MATRIX_MAX + 1}`)).toBeNull();
    expect(parseMatrixAnnotation(`// @matrix ${MATRIX_MIN}x${MATRIX_MAX}`)).toEqual({
      width: MATRIX_MIN,
      height: MATRIX_MAX,
    });
  });

  it("refuses a line with anything after the size", () => {
    expect(parseMatrixAnnotation("// @matrix 128x64 rotated")).toBeNull();
    expect(parseMatrixAnnotation("// @matrix 128x64x2")).toBeNull();
    expect(parseMatrixAnnotation("// @matrix 128 by 64")).toBeNull();
  });
});

describe("matrixFromCode", () => {
  it("falls back to the stock panel when the code says nothing", () => {
    expect(DEFAULT_MATRIX).toEqual({ width: 128, height: 64 });
    expect(matrixFromCode(DRAW)).toEqual(DEFAULT_MATRIX);
    expect(matrixFromCode(`// @matrix 4x4\n${DRAW}`)).toEqual(DEFAULT_MATRIX);
  });
});

describe("writing the line", () => {
  it("builds the line the parser reads back", () => {
    const line = buildMatrixAnnotationLine({ width: 64, height: 128 });
    expect(line).toBe("// @matrix 64x128");
    expect(parseMatrixAnnotation(line)).toEqual({ width: 64, height: 128 });
    expect(matchMatrixAnnotation(`${line}\n${DRAW}`)).toBe(line);
  });

  it("replaces an old line with one at the top, and strip gives the code back", () => {
    const old = `// @matrix 64x64\n${DRAW}`;
    const code = withMatrixAnnotation(old, { width: 128, height: 64 });
    expect(code).toBe(`// @matrix 128x64\n${DRAW}`);
    expect(withMatrixAnnotation(code, { width: 128, height: 64 })).toBe(code);
    expect(stripMatrixAnnotation(code)).toBe(DRAW);
    expect(stripMatrixAnnotation(DRAW)).toBe(DRAW);
  });
});

describe("sizes typed by hand", () => {
  it("clampMatrixDimension pulls a number into range and rounds it", () => {
    expect(clampMatrixDimension(4)).toBe(MATRIX_MIN);
    expect(clampMatrixDimension(600)).toBe(MATRIX_MAX);
    expect(clampMatrixDimension(63.6)).toBe(64);
    expect(clampMatrixDimension(Number.NaN)).toBeNull();
  });

  it("parseMatrixSize wants both sides inside the range", () => {
    expect(parseMatrixSize({ width: 128, height: 64 })).toEqual({ width: 128, height: 64 });
    expect(parseMatrixSize({ width: 4, height: 64 })).toBeNull();
    expect(parseMatrixSize({ width: 128 })).toBeNull();
    expect(parseMatrixSize(null)).toBeNull();
  });

  it("parseMatrixSize reads a side saved as text and rounds one between whole numbers", () => {
    const saved = JSON.parse('{"width":"64","height":"128"}') as Partial<MatrixSize>;
    expect(parseMatrixSize(saved)).toEqual({ width: 64, height: 128 });
    expect(parseMatrixSize({ width: 127.6, height: 64 })).toEqual({ width: 128, height: 64 });
  });
});

describe("describing a frame", () => {
  it("counts the stock panel either way up as the stock panel", () => {
    expect(isStockPanelFrame({ width: 128, height: 64 })).toBe(true);
    expect(isStockPanelFrame({ width: 64, height: 128 })).toBe(true);
    expect(isStockPanelFrame({ width: 64, height: 64 })).toBe(false);
    expect(isStockPanelFrame({ width: 256, height: 64 })).toBe(false);
  });

  it("names the shape and prints the size with ×", () => {
    expect(describeMatrixShape({ width: 128, height: 64 })).toBe("landscape");
    expect(describeMatrixShape({ width: 64, height: 128 })).toBe("portrait");
    expect(describeMatrixShape({ width: 64, height: 64 })).toBe("square");
    expect(formatMatrix({ width: 128, height: 64 })).toBe("128×64");
  });
});

describe("matrixFit", () => {
  const panel = { width: 128, height: 64 };

  it("draws a matching frame straight through, turns a swapped one, and letterboxes the rest", () => {
    expect(matrixFit({ width: 128, height: 64 }, panel)).toBe("direct");
    expect(matrixFit({ width: 64, height: 128 }, panel)).toBe("rotate");
    expect(matrixFit({ width: 64, height: 64 }, panel)).toBe("letterbox");
    expect(matrixFit({ width: 32, height: 32 }, { width: 32, height: 32 })).toBe("direct");
  });
});
