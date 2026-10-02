// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Resident } from "./engine";
import { COLS, ROWS, framePath, type Eyes, type Pose } from "./sprite";

const POSES: Pose[] = ["stand", "stepA", "stepB", "hop", "sit"];
const EYES: Eyes[] = ["mid", "left", "right", "shut"];

/** The lit cells of a frame, from its path (each run is "M x y h len v1 h-len z"). */
function cells(d: string): Set<string> {
  const lit = new Set<string>();
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(m[3]); i++) lit.add(`${Number(m[1]) + i},${m[2]}`);
  }
  return lit;
}

describe("the resident's frames", () => {
  it("every pose with every eyes is a figure inside its 7 × 6 cells", () => {
    for (const pose of POSES) {
      for (const eyes of EYES) {
        const lit = cells(framePath(pose, eyes));
        expect(lit.size).toBeGreaterThan(20);
        for (const c of lit) {
          const [x, y] = c.split(",").map(Number);
          expect(x).toBeLessThan(COLS);
          expect(y).toBeLessThan(ROWS);
        }
      }
    }
  });

  it("has two eyes, a cell each, that close in a blink and move in a glance", () => {
    const open = cells(framePath("stand", "mid"));
    const shut = cells(framePath("stand", "shut"));
    expect(shut.size - open.size).toBe(2);
    const left = cells(framePath("stand", "left"));
    const right = cells(framePath("stand", "right"));
    expect(left.size).toBe(open.size);
    expect(right.size).toBe(open.size);
    expect([...left].sort()).not.toEqual([...right].sort());
  });

  it("stands on the bottom row in every pose (its feet are on the line)", () => {
    for (const pose of POSES) {
      const lit = cells(framePath(pose, "mid"));
      expect([...lit].some((c) => c.endsWith(`,${ROWS - 1}`))).toBe(true);
    }
  });
});

describe("the resident's engine", () => {
  const make = () => {
    const el = document.createElement("span");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    return { el, path, r: new Resident(el, path as SVGPathElement, { scale: 3, hop: 8, sitAfter: 0 }) };
  };

  it("is not shown until it has been put somewhere, and is then on whole pixels", () => {
    const { el, r } = make();
    expect(el.dataset.on).toBeUndefined();
    r.still = true;
    r.place(123.6);
    expect(el.dataset.on).toBe("1");
    expect(el.style.transform).toBe("translate3d(124px,0px,0)");
    r.destroy();
  });

  it("under reduced motion goes straight to its place, and neither hops nor glances", () => {
    const { el, path, r } = make();
    r.still = true;
    r.place(10);
    const frame = path.getAttribute("d");
    r.walkTo(400);
    expect(el.style.transform).toBe("translate3d(400px,0px,0)");
    r.hop();
    r.glance(1);
    expect(el.style.transform).toBe("translate3d(400px,0px,0)");
    expect(path.getAttribute("d")).toBe(frame);
    r.destroy();
  });

  it("knows where its middle is on the screen (for the glance)", () => {
    const { r } = make();
    r.still = true;
    r.setGround(100);
    r.place(50);
    expect(r.centre).toBe(100 + 50 + r.width / 2);
    r.destroy();
  });
});
