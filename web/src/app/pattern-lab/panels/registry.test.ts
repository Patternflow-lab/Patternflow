// The default dock, wide and narrow. At 390px the three columns left each
// panel about 110px, so a narrow dock stacks: Preview on top, the rest as
// tabs under it. The fake below keeps only what the layout code and the
// Panels menu ask of dockview: which group a panel lands in, the order of the
// splits, the size it was given, which panel was fronted, and which tab is in
// front in each group.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { DockviewApi } from "dockview-react";
import { NARROW_PREVIEW_HEIGHT, PANELS, buildDefaultLayout, isNarrowDock, togglePanel } from "./registry";

type Placement = { id: string; ref: string | null; dir: string | null };

function fakeDock(width: number, height: number) {
  const groups: string[][] = [];
  const groupOf = new Map<string, string[]>();
  const placements: Placement[] = [];
  const sizes = new Map<string, { width?: number; height?: number }>();
  // The tab in front of each group. dockview fronts a panel as it is added.
  const front = new Map<string[], string>();
  let active: string | null = null;

  const api = {
    width,
    height,
    addPanel(options: { id: string; title?: string; position?: { referencePanel: string; direction: string } }) {
      const ref = options.position?.referencePanel ?? null;
      const dir = options.position?.direction ?? null;
      if (ref !== null && !groupOf.has(ref)) throw new Error(`${options.id} placed before ${ref}`);
      // No position at all is dockview's "into the active group", as a new tab.
      let into: string[] | undefined;
      if (dir === "within" && ref !== null) into = groupOf.get(ref);
      else if (ref === null && active !== null) into = groupOf.get(active);
      const group = into ?? [];
      if (!into) groups.push(group);
      group.push(options.id);
      groupOf.set(options.id, group);
      front.set(group, options.id);
      active = options.id;
      placements.push({ id: options.id, ref, dir });
    },
    removePanel(panel: { id: string }) {
      const group = groupOf.get(panel.id)!;
      group.splice(group.indexOf(panel.id), 1);
      groupOf.delete(panel.id);
      if (group.length === 0) {
        groups.splice(groups.indexOf(group), 1);
        front.delete(group);
      } else if (front.get(group) === panel.id) {
        front.set(group, group[0]);
      }
      if (active === panel.id) active = null;
    },
    getPanel(id: string) {
      if (!groupOf.has(id)) return undefined;
      return {
        id,
        api: {
          get isVisible() {
            return front.get(groupOf.get(id)!) === id;
          },
          setActive: () => {
            front.set(groupOf.get(id)!, id);
            active = id;
          },
          setSize: (size: { width?: number; height?: number }) => {
            sizes.set(id, { ...sizes.get(id), ...size });
          },
        },
      };
    },
  };

  const inFront = () => groups.map((group) => front.get(group));
  return { api: api as unknown as DockviewApi, groups, placements, sizes, active: () => active, inFront };
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

describe("the Panels menu", () => {
  it("fronts a panel behind another tab instead of closing it, and closes it on the next press", () => {
    const dock = fakeDock(374, 723);
    buildDefaultLayout(dock.api, true);
    expect(dock.inFront()).toEqual(["preview", "code"]);

    expect(togglePanel(dock.api, "knobs")).toBe("fronted");
    expect(dock.groups[1]).toContain("knobs");
    expect(dock.inFront()).toEqual(["preview", "knobs"]);

    expect(togglePanel(dock.api, "knobs")).toBe("closed");
    expect(dock.groups[1]).not.toContain("knobs");
  });

  it("closes a panel in front with one press", () => {
    const dock = fakeDock(1424, 819);
    buildDefaultLayout(dock.api);

    // Knobs has a column of its own on a desktop, so it is always in front.
    expect(togglePanel(dock.api, "knobs")).toBe("closed");
    expect(dock.api.getPanel("knobs")).toBeUndefined();
    expect(togglePanel(dock.api, "code")).toBe("closed");
    expect(dock.api.getPanel("code")).toBeUndefined();
  });

  it("fronts a desktop tab hidden behind Code, which a press used to close", () => {
    const dock = fakeDock(1424, 819);
    buildDefaultLayout(dock.api);
    const codeGroup = dock.groups.find((group) => group.includes("code"))!;
    expect(codeGroup).toContain("pixel");

    expect(togglePanel(dock.api, "pixel")).toBe("fronted");
    expect(dock.api.getPanel("pixel")?.api.isVisible).toBe(true);
    expect(dock.api.getPanel("code")?.api.isVisible).toBe(false);
  });

  it("opens a closed panel under its registry title, in front", () => {
    const dock = fakeDock(374, 723);
    buildDefaultLayout(dock.api, true);
    expect(togglePanel(dock.api, "ramp")).toBe("fronted");
    expect(togglePanel(dock.api, "ramp")).toBe("closed");
    expect(dock.api.getPanel("ramp")).toBeUndefined();

    const added = vi.spyOn(dock.api, "addPanel");
    expect(togglePanel(dock.api, "ramp")).toBe("opened");
    expect(added).toHaveBeenCalledWith({ id: "ramp", component: "ramp", title: "Color Ramp" });
    expect(dock.api.getPanel("ramp")?.api.isVisible).toBe(true);
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
