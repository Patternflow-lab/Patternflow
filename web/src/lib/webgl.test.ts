import { beforeEach, describe, expect, it, vi } from "vitest";

// hasWebGL keeps its first answer for the visit, so each case loads the
// module afresh and sets up what the browser says before it asks.
async function load() {
  vi.resetModules();
  return (await import("./webgl")).hasWebGL;
}

let asked: string[];
beforeEach(() => {
  asked = [];
});

function browserGives(context: unknown) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string) {
    asked.push(`${kind} ${this.width}×${this.height}`);
    if (context instanceof Error) throw context;
    return context as RenderingContext | null;
  } as typeof HTMLCanvasElement.prototype.getContext);
}

describe("hasWebGL", () => {
  it("asks a 1×1 canvas for WebGL 2, the least three.js draws with", async () => {
    browserGives({});
    const hasWebGL = await load();
    expect(hasWebGL()).toBe(true);
    expect(asked).toEqual(["webgl2 1×1"]);
  });

  it("is false where the browser hands back no context", async () => {
    browserGives(null);
    const hasWebGL = await load();
    expect(hasWebGL()).toBe(false);
  });

  it("is false where asking throws", async () => {
    browserGives(new Error("blocked"));
    const hasWebGL = await load();
    expect(hasWebGL()).toBe(false);
  });

  it("asks once a visit: the guide and the home page share the answer", async () => {
    browserGives(null);
    const hasWebGL = await load();
    hasWebGL();
    hasWebGL();
    hasWebGL();
    expect(asked).toHaveLength(1);
  });
});
