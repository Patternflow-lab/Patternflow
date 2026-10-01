import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BEATS, beatIndex, beatStill, clamp01, span } from "./beats";
import { BUILD_STEPS } from "./script";
import { PADS, PAD_COUNT } from "./pads";
import { SCREW_HOLES } from "./layout";
import { VIEWS } from "../views";
import { BUILD_SCENES } from "../../scenes/build";

// The build stage's contract with the Build guide's script (scenes/build.ts):
// every beat has a ready step that names itself and a view the camera knows,
// the script's beats run in the build's order, and the board's numbers are
// the KiCad file's.

describe("build stage", () => {
  it("has a ready step for every beat, naming that beat and a known view", () => {
    for (const [id] of BEATS) {
      const s = BUILD_STEPS[id];
      expect(s, id).toBeDefined();
      expect(s.build).toBe(id);
      expect(VIEWS[s.view], `${id}: view ${s.view}`).toBeDefined();
      if (s.narrowView) expect(VIEWS[s.narrowView], `${id}: narrow view ${s.narrowView}`).toBeDefined();
    }
  });

  it("is lit only once the power bank is in (firmware-3 on)", () => {
    const first = beatIndex("firmware-3");
    for (const [id] of BEATS) {
      if (id === "opening") continue;
      expect(BUILD_STEPS[id].power, id).toBe(beatIndex(id) >= first);
    }
  });

  it("plays the script's beats in the order the build happens", () => {
    const order = BUILD_SCENES.flatMap((sc) => sc.steps.map((s) => beatIndex(s.build)));
    expect(order.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });

  it("never runs a motion past its end", () => {
    // span() only clamps inside its ease. An identity ease let the bonded
    // halves keep going, through the bench (print-4): the straight ease is clamp01.
    expect(span(5, 0, 1, clamp01)).toBe(1);
    expect(span(-5, 0, 1, clamp01)).toBe(0);
    const stage = readFileSync(path.resolve(__dirname, "BuildStage.tsx"), "utf8");
    expect(stage).not.toMatch(/\(x\) => x\)/);
  });

  it("stands still on a frame inside the beat", () => {
    BEATS.forEach((_, i) => {
      expect(beatStill(i)).toBeGreaterThan(0);
      expect(beatStill(i)).toBeLessThan(1);
    });
    // wire-3's still is its 5 V reading, not its unplugged end.
    expect(beatStill(beatIndex("wire-3"))).toBeLessThan(0.82);
    expect(beatStill(beatIndex("wire-3"))).toBeGreaterThan(0.47);
  });

  it("solders every through-hole pad of the v3.9 board, and screws the panel at twelve slots", () => {
    const counts = Object.fromEntries(Object.entries(PADS).map(([k, v]) => [k, v.length]));
    expect(counts).toEqual({ U1: 44, J1: 16, J3: 2, J4: 2, C11: 2, SW1: 7, SW2: 7, SW3: 7, SW4: 7 });
    expect(PAD_COUNT).toBe(94);
    expect(SCREW_HOLES).toHaveLength(12);
  });
});
