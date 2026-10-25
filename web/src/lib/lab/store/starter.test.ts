// The layer "+ Code" adds. Until 23 October 2026 its starter read no knob and
// every pixel came out at full alpha, so the new layer covered 8,079 of the
// 8,192 pixels of the pattern beneath and turning a knob changed none of them.

import { beforeEach, describe, expect, it } from "vitest";
import { createIdleInput, PatternRuntime } from "@/lib/pattern/harness";
import { LabEngine, type EngineProject } from "../engine";
import { useLabStore } from "../store";
import { STARTER_CODE } from "./shared";

const store = () => useLabStore.getState();

function starterFrame(knobNormalized: number[], frames = 1): Uint8ClampedArray {
  const runtime = new PatternRuntime(128, 64);
  expect(runtime.loadCode(STARTER_CODE)).toEqual({ ok: true });
  const input = createIdleInput(undefined, { knobNormalized });
  for (let frame = 0; frame < frames; frame++) {
    expect(runtime.renderFrame(1 / 60, frame / 60, input)).toEqual({ ok: true });
  }
  return runtime.data.slice();
}

function changedPixels(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) count++;
  }
  return count;
}

function project(): EngineProject {
  const { matrix, layers, activeLayerId, knobs, ranges } = store();
  return { matrix, layers, activeLayerId, knobs, ranges };
}

const composite = (engineProject: EngineProject) => new LabEngine().render(engineProject, 1 / 60, 0).data.slice();

beforeEach(() => {
  store().discardProject();
});

describe("STARTER_CODE", () => {
  it("draws another frame with the knobs at 0 than at 1", () => {
    expect(changedPixels(starterFrame([0, 0, 0, 0]), starterFrame([1, 1, 1, 1]))).toBeGreaterThan(4096);
  });

  it("spaces its bands by knob 3 from the first frame", () => {
    expect(changedPixels(starterFrame([0.5, 0.5, 0, 0.5]), starterFrame([0.5, 0.5, 1, 0.5]))).toBeGreaterThan(4096);
  });

  it("stands still with knob 2 at 0 and moves with it up", () => {
    expect(changedPixels(starterFrame([0.5, 0, 0.5, 0.5], 1), starterFrame([0.5, 0, 0.5, 0.5], 60))).toBe(0);
    expect(changedPixels(starterFrame([0.5, 1, 0.5, 0.5], 1), starterFrame([0.5, 1, 0.5, 0.5], 60))).toBeGreaterThan(4096);
  });
});

describe("addCodeLayer", () => {
  it("starts a layer added over another with the low end of its ramp transparent", () => {
    store().addCodeLayer();
    const [added] = store().layers;
    expect(added.type === "code" ? added.ramp.stops.map((stop) => [stop.position, stop.alpha]) : null).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it("keeps the ramp opaque on an empty stack", () => {
    useLabStore.setState({ layers: [] });
    store().addCodeLayer();
    const [added] = store().layers;
    expect(added.type === "code" ? added.ramp.stops.map((stop) => stop.alpha) : null).toEqual([1, 1]);
  });

  it("lets the default pattern show through and answers knob 3 on the first frame", () => {
    store().addCodeLayer();
    const withBase = project();
    const withoutBase = { ...withBase, layers: withBase.layers.map((layer, index) => (index === 1 ? { ...layer, visible: false } : layer)) };
    // 0707 lights 4,107 of the 8,192 pixels on its first frame. Under the old
    // starter, hiding it changed none of them.
    expect(changedPixels(composite(withBase), composite(withoutBase))).toBeGreaterThan(2048);

    const [, , [, top]] = withBase.ranges;
    const turned = { ...withoutBase, knobs: withoutBase.knobs.map((value, index) => (index === 2 ? top : value)) };
    expect(changedPixels(composite(withoutBase), composite(turned))).toBeGreaterThan(4096);
  });
});
