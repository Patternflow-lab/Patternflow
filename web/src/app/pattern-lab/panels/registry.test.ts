// The default dock, wide and narrow. At 390px the three columns left each
// panel about 110px, so a narrow dock stacks: Preview on top, the rest as
// tabs under it. The fake below keeps only what the layout code asks of
// dockview: which group a panel lands in, the order of the splits, the size
// it was given and which panel was fronted.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DockviewApi } from "dockview-react";
import { NARROW_PREVIEW_HEIGHT, PANELS, buildDefaultLayout, isNarrowDock } from "./registry";

type Placement = { id: string; ref: string | null; dir: string | null };

function fakeDock(width: number, height: number) {
  const groups: string[][] = [];
  const groupOf = new Map<string, string[]>();
  const placements: Placement[] = [];
  const sizes = new Map<string, { width?: number; height?: number }>();
  let active: string | null = null;

  const api = {
    width,
    height,
    addPanel(options: { id: string; position?: { referencePanel: string; direction: string } }) {
      const ref = options.position?.referencePanel ?? null;
      const dir = options.position?.direction ?? null;
      if (ref !== null && !groupOf.has(ref)) throw new Error(`${options.id} placed before ${ref}`);
      if (dir === "within" && ref !== null) {
        const group = groupOf.get(ref)!;
        group.push(options.id);
        groupOf.set(options.id, group);
      } else {
        const group = [options.id];
        groups.push(group);
        groupOf.set(options.id, group);
      }
      placements.push({ id: options.id, ref, dir });
    },
    getPanel(id: string) {
      if (!groupOf.has(id)) return undefined;
      return {
        api: {
          setActive: () => {
            active = id;
          },
          setSize: (size: { width?: number; height?: number }) => {
            sizes.set(id, { ...sizes.get(id), ...size });
          },
        },
      };
    },
  };

  return { api: api as unknown as DockviewApi, groups, placements, sizes, active: () => active };
}

function stubWidth(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    return { matches: max ? width <= Number(max[1]) : false, media: query };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("narrow default layout", () => {
  it("puts Preview alone on top and every other panel in one group below it, Code first", () => {
    const dock = fakeDock(374, 723);
    buildDefaultLayout(dock.api, true);

    expect(dock.groups).toEqual([
      ["preview"],
      ["code", ...PANELS.filter((def) => def.id !== "preview" && def.id !== "code").map((def) => def.id)],
    ]);
    expect(dock.groups[1].slice(0, 3)).toEqual(["code", "layers", "pixel"]);
    // One split, and it is a row: nothing sits beside Preview.
    expect(dock.placements.filter((entry) => entry.dir !== "within" && entry.ref !== null)).toEqual([
      { id: "code", ref: "preview", dir: "below" },
    ]);
  });

  it("fronts Code and gives Preview its share of the height", () => {
    const dock = fakeDock(374, 723);
    buildDefaultLayout(dock.api, true);

    expect(dock.active()).toBe("code");
    expect(dock.sizes.get("preview")).toEqual({ height: Math.round(723 * NARROW_PREVIEW_HEIGHT) });
    // The column widths are the wide layout's; a narrow dock sets none.
    expect([...dock.sizes.values()].some((size) => size.width !== undefined)).toBe(false);
  });
});

describe("wide default layout", () => {
  it("places each panel where its registry entry says, columns before rows", () => {
    const dock = fakeDock(1424, 819);
    buildDefaultLayout(dock.api);

    expect(dock.placements.map((entry) => entry.id).sort()).toEqual(PANELS.map((def) => def.id).sort());
    for (const def of PANELS) {
      const placed = dock.placements.find((entry) => entry.id === def.id);
      expect(placed).toEqual({ id: def.id, ref: def.dock?.ref ?? null, dir: def.dock?.dir ?? null });
    }
    const firstRow = dock.placements.findIndex((entry) => entry.dir === "below");
    const lastColumn = dock.placements.map((entry) => entry.dir).lastIndexOf("right");
    expect(lastColumn).toBeLessThan(firstRow);
    expect(dock.groups).toHaveLength(5);
    expect(dock.active()).toBe("code");
  });
});

describe("isNarrowDock", () => {
  it("is true on a 390px phone and false on a 1440px desktop", () => {
    stubWidth(390);
    expect(isNarrowDock()).toBe(true);
    stubWidth(800);
    expect(isNarrowDock()).toBe(true);
    stubWidth(801);
    expect(isNarrowDock()).toBe(false);
    stubWidth(1440);
    expect(isNarrowDock()).toBe(false);
  });

  it("is false where the browser has no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(isNarrowDock()).toBe(false);
  });
});
