import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flattenLayers } from "@/lib/lab/flatten";
import { rampStateToHarness } from "@/lib/lab/engine";
import { LAB_STORAGE } from "@/lib/lab/persist";
import { serializeProject } from "@/lib/lab/serialize";
import { defaultProject } from "@/lib/lab/store/shared";
import { DEFAULT_RAMP_STATE, cloneRampState, type CodeLayer, type LabProject, type PixelLayer } from "@/lib/lab/types";
import { emptyShow } from "@/lib/lab/director/types";
import { PANEL_H, PANEL_W } from "./panelScreens";
import { DeviceSim, type SimMirror } from "./deviceSim";
import { labMirrorName, mirrorOfProject, readLabMirror, subscribeLabMirror } from "./labMirror";

// The guide's board plays the reader's Pattern Lab draft (labMirror.ts):
// read-only, converted the way the lab converts it for hardware, and put back
// exactly as it was when the step ends (DeviceSim.setMirror).

const RED_DOT = `export function draw(display) { display.setPixel(0, 0, 255, 0, 0); }`;

function codeLayer(id: string, code: string, patch: Partial<CodeLayer> = {}): CodeLayer {
  return {
    id,
    type: "code",
    name: `Layer ${id}`,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    code,
    ramp: cloneRampState(DEFAULT_RAMP_STATE),
    recolor: false,
    knobsAnnotationRaw: null,
    matrixAnnotationRaw: null,
    ...patch,
  };
}

function project(layers: LabProject["layers"], patch: Partial<LabProject> = {}): LabProject {
  return {
    name: "",
    matrix: { width: 128, height: 64 },
    layers,
    activeLayerId: layers[0]?.id ?? "",
    knobs: [0.25, 3, 1, 0.5],
    ranges: [
      [0, 1],
      [0.1, 10],
      [0, 4.9],
      [0, 1],
    ],
    knobLabels: ["Hue", "Speed", "Knob 3", "Mix"],
    forkOf: null,
    editOf: null,
    gen: { count: 5, thinking: "LOW", refs: 6, colorMode: "vfield" },
    director: emptyShow(),
    ...patch,
  };
}

/** Every write to any Storage, for the "never writes" checks. */
function spyStorageWrites() {
  return [
    vi.spyOn(Storage.prototype, "setItem"),
    vi.spyOn(Storage.prototype, "removeItem"),
    vi.spyOn(Storage.prototype, "clear"),
  ];
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("labMirror: the project as one pattern", () => {
  it("runs a single plain code layer as it is, with its ramp and recolor, and the project's knobs", () => {
    const layer = codeLayer("a", RED_DOT, { name: "Rings", recolor: true });
    layer.ramp.stops[1].color = "#ff8800";
    const m = mirrorOfProject(project([layer]), "draft", 42);
    expect(m.code).toBe(RED_DOT);
    expect(m.ramp).toEqual(rampStateToHarness(layer.ramp));
    expect(m.recolor).toBe(true);
    expect(m).toMatchObject({ width: 128, height: 64, source: "draft", savedAt: 42, name: "Rings" });
    expect(m.labels).toEqual(["Hue", "Speed", "Knob 3", "Mix"]);
    expect(m.values).toEqual([0.25, 3, 1, 0.5]);
    expect(m.ranges[1]).toEqual([0.1, 10]);
  });

  it("flattens a stack exactly as the lab's hardware path does", () => {
    const pixel: PixelLayer = {
      id: "p",
      type: "pixel",
      name: "Dots",
      visible: true,
      opacity: 1,
      blend: "normal",
      role: "paint",
      maskInvert: false,
      width: 128,
      height: 64,
      data: new Uint8ClampedArray(128 * 64 * 4),
      rev: 0,
    };
    const p = project([pixel, codeLayer("a", RED_DOT)]);
    const m = mirrorOfProject(p, "draft");
    expect(m.code).toBe(flattenLayers(p.layers, p.matrix, { labels: p.knobLabels, ranges: p.ranges }));
    expect(m.ramp).toBeNull();
    expect(m.recolor).toBe(false);
  });

  it("names it as the lab does: the piece's name, else the focus code layer's", () => {
    const layers = [codeLayer("a", RED_DOT, { name: "Top" }), codeLayer("b", RED_DOT, { name: "Focus" })];
    expect(labMirrorName({ name: "  My piece ", layers, activeLayerId: "b" })).toBe("My piece");
    expect(labMirrorName({ name: "", layers, activeLayerId: "b" })).toBe("Focus");
    expect(labMirrorName({ name: "", layers: [], activeLayerId: "" })).toBe("pattern");
  });
});

describe("labMirror: reading the browser, never writing it", () => {
  it("with nothing saved, plays what the lab opens with, and writes nothing", () => {
    const writes = spyStorageWrites();
    const m = readLabMirror();
    expect(m.source).toBe("starter");
    const starter = defaultProject();
    expect(m.code).toBe((starter.layers[0] as CodeLayer).code);
    expect(m.values).toEqual(starter.knobs);
    for (const w of writes) expect(w).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("reads the saved project, follows a new save, and writes nothing", () => {
    const first = serializeProject(project([codeLayer("a", RED_DOT)], { name: "One" }))!;
    localStorage.setItem(LAB_STORAGE.project, first);
    const writes = spyStorageWrites();
    const a = readLabMirror();
    expect(a).toMatchObject({ source: "draft", name: "One" });
    // Same text, same object: nothing is parsed again.
    expect(readLabMirror()).toBe(a);
    writes.forEach((w) => w.mockRestore());

    localStorage.setItem(LAB_STORAGE.project, serializeProject(project([codeLayer("a", RED_DOT)], { name: "Two" }))!);
    const again = spyStorageWrites();
    const b = readLabMirror();
    expect(b).not.toBe(a);
    expect(b.name).toBe("Two");
    for (const w of again) expect(w).not.toHaveBeenCalled();
  });

  it("lifts a v1 draft in memory the way the lab would, without migrating anything in storage", () => {
    const legacy = JSON.stringify({ code: RED_DOT, savedAt: 7, knobs: [0.5, 2, 1, 0.1] });
    localStorage.setItem(LAB_STORAGE.legacyDraft, legacy);
    const writes = spyStorageWrites();
    const m = readLabMirror();
    expect(m).toMatchObject({ source: "draft", code: RED_DOT, savedAt: 7 });
    for (const w of writes) expect(w).not.toHaveBeenCalled();
    expect(localStorage.getItem(LAB_STORAGE.project)).toBeNull();
    expect(localStorage.getItem(LAB_STORAGE.legacyDraft)).toBe(legacy);
  });

  it("importing it writes nothing either", async () => {
    vi.resetModules();
    const writes = spyStorageWrites();
    await import("./labMirror");
    for (const w of writes) expect(w).not.toHaveBeenCalled();
  });

  it("hears the lab's saves (a storage event for its keys) and nothing else", () => {
    const heard = vi.fn();
    const off = subscribeLabMirror(heard);
    window.dispatchEvent(new StorageEvent("storage", { key: LAB_STORAGE.project }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something_else" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    off();
    window.dispatchEvent(new StorageEvent("storage", { key: LAB_STORAGE.project }));
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

// ── the board ────────────────────────────────────────────────────────────────

function spec(patch: Partial<SimMirror> = {}): SimMirror {
  return {
    name: "My draft",
    code: RED_DOT,
    width: PANEL_W,
    height: PANEL_H,
    ramp: null,
    recolor: false,
    labels: ["Hue", "Knob 2", "Knob 3", "Knob 4"],
    ranges: [
      [0, 1],
      [0, 10],
      [0, 1],
      [0, 1],
    ],
    values: [0.5, 5, 0, 0],
    ...patch,
  };
}

function pixel(sim: DeviceSim, x: number, y: number) {
  const i = (y * PANEL_W + x) * 4;
  return [sim.frame[i], sim.frame[i + 1], sim.frame[i + 2]];
}

function settle(sim: DeviceSim, seconds = 1.2) {
  // Past the name card (1 s), so the panel shows the pattern alone.
  for (let t = 0; t < seconds; t += 0.05) sim.tick(0.05);
}

describe("DeviceSim.setMirror", () => {
  it("plays the draft under its own name, then puts the board's pattern back as it was", () => {
    const sim = new DeviceSim();
    sim.setPack("basics");
    sim.showPattern(3);
    settle(sim);
    sim.turn(0, 4);
    settle(sim);
    const before = sim.snapshot();
    const knobBefore = sim.knobReadout(0);

    sim.setMirror(spec());
    settle(sim);
    const mirrored = sim.snapshot();
    expect(mirrored.mirror).toBe(true);
    expect(mirrored.patternName).toBe("My draft");
    expect(pixel(sim, 0, 0)[0]).toBeGreaterThan(0);
    expect(sim.knobReadout(0)).toMatchObject({ label: "hue", value: 0.5 });
    expect(sim.knobReadout(1).label).toBe("value");
    // The board's knobs turn the draft's, a detent at a time, and stop at the range's end.
    sim.turn(0, 100);
    settle(sim, 0.1);
    expect(sim.knobReadout(0).value).toBe(1);

    sim.setMirror(null);
    settle(sim);
    const after = sim.snapshot();
    expect(after.mirror).toBe(false);
    expect(after.patternIndex).toBe(before.patternIndex);
    expect(after.patternName).toBe(before.patternName);
    expect(sim.knobReadout(0)).toEqual(knobBefore);
  });

  it("follows the lab: a knob it moved moves, one it left keeps where the board put it", () => {
    const sim = new DeviceSim();
    const first = spec();
    sim.setMirror(first);
    sim.turn(1, 24); // one turn: half of 0..10
    settle(sim, 0.1);
    expect(sim.knobReadout(1).value).toBeCloseTo(10, 5);
    sim.setMirror({ ...first, values: [0.9, 5, 0, 0] });
    expect(sim.knobReadout(0).value).toBeCloseTo(0.9, 5);
    expect(sim.knobReadout(1).value).toBeCloseTo(10, 5);
  });

  it("puts a turned or odd-sized frame on the panel by the firmware's rule", () => {
    const sim = new DeviceSim();
    // 64×128 is the panel turned: rotated 90°, (x, y) -> (127 - y, x).
    sim.setMirror(spec({ width: PANEL_H, height: PANEL_W }));
    settle(sim);
    expect(pixel(sim, PANEL_W - 1, 0)[0]).toBeGreaterThan(0);
    expect(pixel(sim, 0, 0)[0]).toBe(0);
    // Anything else is centred: 32×32 starts at (48, 16).
    sim.setMirror(spec({ width: 32, height: 32 }));
    settle(sim);
    expect(pixel(sim, 48, 16)[0]).toBeGreaterThan(0);
    expect(pixel(sim, 0, 0)[0]).toBe(0);
  });

  it("says so when the draft doesn't run, plays the board's own pattern meanwhile, and picks the fix up", () => {
    const board = new DeviceSim();
    settle(board);
    const origin = Array.from(board.frame);

    // Won't load: a syntax error the lab saved mid-edit.
    const sim = new DeviceSim();
    sim.setMirror(spec({ code: "export function draw(d) { d.setPixel(0, 0, " }));
    settle(sim);
    expect(sim.mirroring).toBe(false);
    expect(sim.mirrorState()).toMatchObject({ name: "My draft", broken: true });
    expect(sim.mirrorState()?.error).toBeTruthy();
    expect(sim.snapshot().patternName).toBe("Origin");
    // Not a dead panel: the board's own pattern, as it would play anyway.
    expect(Array.from(sim.frame).some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
    expect(Array.from(sim.frame)).toEqual(origin);

    // Throws on every frame.
    sim.setMirror(spec({ code: "export function draw() { throw new Error('nope'); }" }));
    settle(sim);
    expect(sim.mirrorState()).toMatchObject({ broken: true, error: expect.stringContaining("nope") });
    expect(sim.mirroring).toBe(false);

    // Fixed in the lab: it plays again.
    sim.setMirror(spec());
    settle(sim);
    expect(sim.mirroring).toBe(true);
    expect(sim.mirrorState()).toMatchObject({ broken: false, error: null });
    expect(pixel(sim, 0, 0)[0]).toBeGreaterThan(0);
  });

  it("steps aside when the board's own pattern is picked", () => {
    const sim = new DeviceSim();
    sim.setPack("basics");
    sim.setMirror(spec());
    expect(sim.mirroring).toBe(true);
    sim.showPattern(2);
    expect(sim.mirroring).toBe(false);
    expect(sim.snapshot().patternIndex).toBe(2);
  });
});
