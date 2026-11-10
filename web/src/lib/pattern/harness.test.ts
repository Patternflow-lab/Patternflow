// A pasted pattern that was cut off used to be reported as "Unexpected token
// 'return'" or "Unexpected token ')'": the `return` compilePatternCode puts
// after the code, and the `)` that `new Function` closes it with. Neither is in
// the editor. The Lab's Code panel and the Live Editor both show what
// describePatternError says, through PatternRuntime and LedMatrixTexture.

import { describe, expect, it } from "vitest";
import { PatternRuntime, describePatternError } from "./harness";

const FULL = `export function setup(params) {
  params.t = 0;
}

export function draw(display, params, time) {
  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      display.setPixel(x, y, 255, 0, 0);
    }
  }
}
`;

function loadError(code: string) {
  const result = new PatternRuntime(8, 8).loadCode(code);
  expect(result.ok).toBe(false);
  return result.error;
}

describe("a pattern cut off partway", () => {
  it("says the code stops early, and quotes the last line, when cut inside a call", () => {
    expect(loadError(FULL.slice(0, FULL.indexOf("255")))).toBe(
      "The code stops before it ends: 1 ( and 3 { never close. Was the paste cut off?\n" +
        "line 8 (the last): display.setPixel(x, y,",
    );
  });

  it("says so when only the last } is missing", () => {
    expect(loadError(FULL.trimEnd().slice(0, -1))).toBe(
      "The code stops before it ends: 1 { never closes. Was the paste cut off?\nline 10 (the last): }",
    );
  });

  it("names the string, template or comment the code stops inside", () => {
    expect(loadError(`function draw(display) {\n  const label = "Patt`)).toMatch(
      /^The code stops before it ends: 1 " and 1 \{ never close\./,
    );
    expect(loadError("function draw(display) {\n  const label = `x = ${display.width")).toMatch(
      /^The code stops before it ends: 1 \$\{, 1 ` and 1 \{ never close\./,
    );
    expect(loadError("function draw(display) {\n  /* fill the panel")).toMatch(
      /^The code stops before it ends: 1 \/\* and 1 \{ never close\./,
    );
  });

  it("does not count brackets inside strings, comments, templates or regular expressions", () => {
    const code = `function draw(display, params) {
  const a = "(([";
  const b = '{{';
  const c = \`\${display.width} ((\`;
  const d = /[({]+/g.test(a) ? display.width / 2 : display.height / 2;
  // ((({
  /* {[( */
  display.setPixel(d, 0,`;
    expect(loadError(code)).toBe(
      "The code stops before it ends: 1 ( and 1 { never close. Was the paste cut off?\n" +
        "line 8 (the last): display.setPixel(d, 0,",
    );
  });

  it("keeps the tail of a long last line, where the paste stopped", () => {
    const tail = "display.setPixel(x, y, 255, 0, ";
    const message = loadError(`function draw(display) {\n  ${"const pad = 0; ".repeat(8)}${tail}`);
    expect(message).toMatch(/\nline 2 \(the last\): …/);
    expect(message?.endsWith(tail.trim())).toBe(true);
  });

  it("skips blank lines after the cut when it quotes the last line", () => {
    expect(loadError("function draw(display) {\n  display.setPixel(0, 0,\n\n\n")).toMatch(
      /\nline 2 \(the last\): display\.setPixel\(0, 0,$/,
    );
  });
});

describe("a syntax error that is not a cut", () => {
  it("keeps the engine's message when a ) is missing in the middle", () => {
    const code = FULL.replace("255, 0, 0)", "255, 0, 0");
    expect(loadError(code)).not.toMatch(/stops before it ends/);
  });

  it("keeps the engine's message when a string runs into the next line", () => {
    const code = FULL.replace("255, 0, 0);", '"red);');
    expect(loadError(code)).not.toMatch(/stops before it ends/);
  });

  it("keeps the engine's message when every bracket closes", () => {
    const code = FULL.replace("let y = 0;", "let y = = 0;");
    expect(loadError(code)).not.toMatch(/stops before it ends/);
  });

  it("leaves errors that are not syntax errors alone", () => {
    const error = new TypeError("display.fill is not a function");
    expect(describePatternError(error, "function draw(display) {")).toBe("display.fill is not a function");
  });
});
