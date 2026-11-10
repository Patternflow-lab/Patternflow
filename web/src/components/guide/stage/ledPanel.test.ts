import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TARGET, render } from "../../../../scripts/cut-led-panel";

// The stage's LED panel is a copy cut out of the official case model
// (scripts/cut-led-panel.ts). When tools/case-models writes that model anew,
// the copy is cut again, or this fails.

describe("the LED panel the stage loads", () => {
  it("is the official case model's panel, as the cut writes it", () => {
    expect(Buffer.from(render()).equals(readFileSync(TARGET))).toBe(true);
  });
});
