import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BEATS, beatIndex, beatSeconds, beatStill, clamp01, span } from "./beats";
import { BUILD_STEPS } from "./script";
import { PADS, PAD_COUNT } from "./pads";
import { BOARD_WORK, CABLE_HOLE, PANEL_CENTRE, PANEL_IN, PANEL_OUT, PANEL_POWER, SCREW_HOLES } from "./layout";
import { BUILD_VIEWS, settleIn } from "./views";
import { ease, fall, glide, grow, land, latch, past, press, reach, rock, setDown, swing, windUp } from "./motion";
import { footprint, foldedRibbon } from "./props";
import * as THREE from "three";
import { VIEWS } from "../views";
import { BUILD_SCENES } from "../../scenes/build";
import { BOM_FILE, bomKey, parseBom } from "../../build/bom";
import { TOUCH_KEYS } from "./touchState";

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
      if (s.narrowLate) {
        expect(VIEWS[s.narrowLate.view], `${id}: late narrow view ${s.narrowLate.view}`).toBeDefined();
        expect(s.narrowLate.from).toBeGreaterThan(0);
        expect(s.narrowLate.from).toBeLessThan(1);
      }
    }
  });

  it("shows case-3 on a phone as two shots: the hole in the bay's floor, then J4 on the board held behind", () => {
    // One view of both left J4 and its two tags under the card (the card is
    // most of a phone's screen), and the slot a few pixels wide.
    const s = BUILD_STEPS["case-3"];
    expect(s.narrowView).toBe("leadHole");
    expect(s.narrowLate?.view).toBe("leadJ4");
    // The second shot starts while the board is on its way over (0.4…0.7 of
    // the beat), before the wires go into J4 (0.72 on).
    expect(s.narrowLate!.from).toBeGreaterThan(0.4);
    expect(s.narrowLate!.from).toBeLessThan(0.7);
    // The first looks at the bay's floor (model y 18.9 → world 0.24), the second 7 units behind the case.
    expect(BUILD_VIEWS.leadHole.target.z).toBeGreaterThan(-0.2);
    expect(BUILD_VIEWS.leadJ4.target.z).toBeLessThan(-0.6);
  });

  it("does not look at the board on the bench through the wide opening (case-3)", () => {
    // The wide opening beside the lead's slot is x 6.98…9.51 at y 18.9, and
    // the tray under it is open at the front until the lid goes on. While
    // the lead comes up, the soldered board is still in its holder on the
    // bench (x −4…4, y 2.95, z 23.6…36.4). A line of sight through the
    // opening that ends on it puts a bright green strip in the hole the step
    // says not to use.
    for (const name of ["leadBack", "leadHole"] as const) {
      const d = BUILD_VIEWS[name].dir;
      const travel = (18.9 - BOARD_WORK.p.y) / d.y; // down to the board's height, along −dir
      const z = -0.83 - d.z * travel;
      const xNearest = 6.98 - d.x * travel; // the opening's end nearest the board
      const xFarthest = 9.51 - d.x * travel;
      const overBoard = z > 23.6 && z < 36.4 && xFarthest > -4.6 && xNearest < 4.6;
      expect(overBoard, `${name}: lands at x ${xNearest.toFixed(1)}…${xFarthest.toFixed(1)}, z ${z.toFixed(1)}`).toBe(false);
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

  it("has no beat the script does not show: each one but the opening and the end is exactly one step", () => {
    const used = BUILD_SCENES.flatMap((sc) => sc.steps.map((s) => s.build));
    for (const [id] of BEATS) {
      const n = used.filter((b) => b === id).length;
      expect(n, id).toBe(1);
    }
    // The opening and the end are scenes of their own, one step each.
    expect(BUILD_SCENES[0].steps.map((s) => s.build)).toEqual(["opening"]);
    expect(BUILD_SCENES[BUILD_SCENES.length - 1].steps.map((s) => s.build)).toEqual(["next"]);
    expect(used).toHaveLength(BEATS.length);
  });

  it("gives every step whose motion the stage plays long enough for the card's Replay", () => {
    // GuideExperience offers Replay from 2.5 s. firmware-2's motion is the
    // DevKit going onto its pins (Device.tsx): it was 1 s, and had no Replay.
    expect(beatSeconds(beatIndex("firmware-2"))).toBeGreaterThanOrEqual(2.5);
  });

  it("puts the panel's connectors where the finished wiring has them", () => {
    // Production photo 08c, from behind: IN at the top beside the board bay
    // (y 19…32.2), OUT at the very bottom, the power header below the centre.
    expect(PANEL_IN.y).toBeGreaterThan(26);
    expect(PANEL_OUT.y).toBeLessThan(6);
    expect(PANEL_POWER.y).toBeLessThan(PANEL_CENTRE.y - 1);
    expect(PANEL_POWER.y).toBeGreaterThan(PANEL_OUT.y + 6);
  });

  it("takes the power lead through the small slot under J4, not the wide opening", () => {
    // The wide opening is x 6.98…9.51; the lead's slot is x 10.06…10.44, z −0.52…0.23.
    expect(CABLE_HOLE.x).toBeGreaterThan(10.06);
    expect(CABLE_HOLE.x).toBeLessThan(10.44);
    expect(CABLE_HOLE.z).toBeGreaterThan(-0.52);
    expect(CABLE_HOLE.z).toBeLessThan(0.23);
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
  });

  it("has no multimeter steps: solder-4 runs into case-1, wire-2 into firmware-1", () => {
    expect(beatIndex("solder-5")).toBe(-1);
    expect(beatIndex("wire-3")).toBe(-1);
    expect(beatIndex("case-1")).toBe(beatIndex("solder-4") + 1);
    expect(beatIndex("firmware-1")).toBe(beatIndex("wire-2") + 1);
    const stage = readFileSync(path.resolve(__dirname, "BuildStage.tsx"), "utf8") + readFileSync(path.resolve(__dirname, "props.ts"), "utf8");
    expect(stage).not.toMatch(/\bprobes?\b|\bmeter\b|multimeter/i);
  });

  it("moves every part from its start to exactly its end, whatever the timeline does outside the move", () => {
    // span() clamps only through its ease (above): each of these must hold its
    // ends for any input, or a part keeps going after its move is over.
    const rising = { glide, reach, ease, fall, press, past, swing, windUp, grow };
    for (const [name, f] of Object.entries(rising)) {
      expect(f(0), name).toBeCloseTo(0, 6);
      expect(f(1), name).toBeCloseTo(1, 6);
      expect(f(-3), name).toBeCloseTo(0, 6);
      expect(f(7), name).toBeCloseTo(1, 6);
    }
    const falling = { land, setDown, latch };
    for (const [name, f] of Object.entries(falling)) {
      expect(f(0), name).toBeCloseTo(1, 6);
      expect(f(1), name).toBeCloseTo(0, 6);
      expect(f(-3), name).toBeCloseTo(1, 6);
      expect(f(7), name).toBeCloseTo(0, 6);
    }
    expect(rock(0)).toBeCloseTo(1, 6);
    expect(rock(1)).toBeCloseTo(0, 6);
  });

  it("never pushes a part that seats against another past its seat, or under the mat", () => {
    // A press ends against the part behind it; a part that lands, lands ON
    // the mat; a cover shuts and no further (it swung on through the ribbon).
    let last = 0;
    for (let i = 0; i <= 400; i++) {
      const x = i / 400;
      const p = press(x);
      expect(p).toBeLessThanOrEqual(1 + 1e-9);
      expect(p).toBeGreaterThanOrEqual(last - 1e-9);
      last = p;
      expect(land(x)).toBeGreaterThanOrEqual(0);
      expect(setDown(x)).toBeGreaterThanOrEqual(0);
      expect(latch(x)).toBeGreaterThanOrEqual(0);
      expect(latch(x)).toBeLessThanOrEqual(1);
      // The ones that do go past their end go a little, and come back.
      expect(past(x)).toBeLessThan(1.05);
      expect(swing(x)).toBeLessThan(1.04);
      expect(swing(x)).toBeGreaterThan(-0.04);
    }
  });

  it("bends the ribbon and puts it back exactly as it is fitted", () => {
    const r = foldedRibbon(5.6, 24.2, -1, -3.85, 28.5, -0.6);
    const rest = Array.from(r.cable.getAttribute("position").array);
    r.bend(3.2, 3.2, 3.2, new THREE.Vector3(0, -0.9, 0));
    const bent = Array.from(r.cable.getAttribute("position").array);
    expect(bent).not.toEqual(rest);
    // Held out by the same amount everywhere, no part of it is left behind.
    expect(Math.max(...bent.filter((_, i) => i % 3 === 2).map((z, i) => z - rest[i * 3 + 2]))).toBeCloseTo(-3.2, 5);
    // Its ends carry the plugs: J1's end hangs the whole sag, IN's (the short run) less.
    expect(r.ends[0].y).toBeCloseTo(-0.9, 6);
    expect(r.ends[1].y).toBeGreaterThan(-0.9);
    expect(r.ends[0].z).toBeCloseTo(-3.2, 6);
    r.bend(0, 0, 0);
    expect(Array.from(r.cable.getAttribute("position").array)).toEqual(rest);
    expect(r.ends[0].length()).toBe(0);
  });

  it("finds a printed part's outline on its plate", () => {
    const box = new THREE.BoxGeometry(4, 1, 2);
    box.translate(10, 0.5, -6);
    const outline = footprint(box, 16, 0);
    for (const [x, z] of outline) {
      expect(Math.abs(Math.abs(x - 10) - 2) < 1e-6 || Math.abs(Math.abs(z + 6) - 1) < 1e-6).toBe(true);
    }
  });

  it("leaves every view as authored once the camera has settled in", () => {
    const before = Object.fromEntries(Object.entries(BUILD_VIEWS).map(([k, v]) => [k, { dir: v.dir.clone(), fill: v.fill }]));
    settleIn("boardF", 1);
    expect(BUILD_VIEWS.boardF.fill).toBeLessThan(before.boardF.fill);
    expect(BUILD_VIEWS.boardF.dir.angleTo(before.boardF.dir)).toBeGreaterThan(0.01);
    // The step's end, and another step's view: both put it back.
    settleIn("boardF", 0);
    expect(BUILD_VIEWS.boardF.dir.angleTo(before.boardF.dir)).toBeLessThan(1e-9);
    settleIn("boardF", 1);
    settleIn("caseBack", 0.5);
    expect(BUILD_VIEWS.boardF.dir.angleTo(before.boardF.dir)).toBeLessThan(1e-9);
    expect(BUILD_VIEWS.boardF.fill).toBe(before.boardF.fill);
    settleIn(null, 0);
    for (const [k, v] of Object.entries(BUILD_VIEWS)) {
      expect(v.dir.angleTo(before[k].dir), k).toBeLessThan(1e-9);
      expect(v.fill, k).toBe(before[k].fill);
    }
    // The views that look through a gap never turn (case-3, above): only in.
    for (const k of ["leadBack", "leadHole", "leadJ4", "terminalsBack"] as const) {
      settleIn(k, 1);
      expect(BUILD_VIEWS[k].dir.angleTo(before[k].dir), k).toBeLessThan(1e-9);
    }
    settleIn(null, 0);
  });

  it("solders every through-hole pad of the v3.9 board, and screws the panel at twelve slots", () => {
    const counts = Object.fromEntries(Object.entries(PADS).map(([k, v]) => [k, v.length]));
    expect(counts).toEqual({ U1: 44, J1: 16, J3: 2, J4: 2, C11: 2, SW1: 7, SW2: 7, SW3: 7, SW4: 7 });
    expect(PAD_COUNT).toBe(94);
    expect(SCREW_HOLES).toHaveLength(12);
  });
});

// The parts under the hand (touch.ts) go by their line in the parts list.
describe("the parts that can be touched", () => {
  it("are the BOM's lines, every one and no other", () => {
    const csv = readFileSync(path.resolve(__dirname, "../../../../../..", BOM_FILE), "utf8");
    const lines = parseBom(csv).map(bomKey);
    expect([...TOUCH_KEYS].sort()).toEqual([...lines].sort());
  });
});
