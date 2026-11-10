// The AI gallery came out of the lab on 23 October 2026. What it left behind
// in a browser that used it: a dock layout with a Gallery tab, a project whose
// `gen` block holds batch settings, its generated patterns and the Gemini key.

import { beforeEach, describe, expect, it } from "vitest";
import { PANELS } from "@/app/pattern-lab/panels/registry";
import { LAB_STORAGE } from "./persist";
import { deserializeProject, dropRetiredPanels, layoutViewCount } from "./serialize";
import { useLabStore } from "./store";

const known = new Set(PANELS.map((panel) => panel.id));

function panel(id: string, title: string) {
  return { id, contentComponent: id, title };
}

// The default desktop layout as dockview's toJSON writes it, with the Gallery
// tab where the registry used to put it: inside the Code group, fronted.
function savedLayout() {
  return {
    grid: {
      root: {
        type: "branch",
        data: [
          {
            type: "branch",
            data: [
              { type: "leaf", data: { views: ["preview"], activeView: "preview", id: "1" }, size: 500 },
              { type: "leaf", data: { views: ["layers"], activeView: "layers", id: "2" }, size: 300 },
            ],
            size: 420,
          },
          {
            type: "leaf",
            data: { views: ["code", "pixel", "gallery", "capture", "director"], activeView: "gallery", id: "3" },
            size: 680,
          },
          {
            type: "branch",
            data: [
              { type: "leaf", data: { views: ["knobs"], activeView: "knobs", id: "4" }, size: 460 },
              { type: "leaf", data: { views: ["ramp"], activeView: "ramp", id: "5" }, size: 340 },
            ],
            size: 340,
          },
        ],
        size: 800,
      },
      width: 1440,
      height: 800,
      orientation: "HORIZONTAL",
    },
    panels: {
      preview: panel("preview", "Preview"),
      layers: panel("layers", "Layers"),
      code: panel("code", "Code"),
      pixel: panel("pixel", "Pixel"),
      gallery: panel("gallery", "Gallery"),
      capture: panel("capture", "Graphic Export"),
      director: panel("director", "Director"),
      knobs: panel("knobs", "Knobs"),
      ramp: panel("ramp", "Color Ramp"),
    },
    activeGroup: "3",
  };
}

beforeEach(() => localStorage.clear());

describe("a saved layout from before the gallery went", () => {
  it("keeps every other panel where it was and fronts the tab beside the gone one", () => {
    const layout = dropRetiredPanels(savedLayout(), known)!;
    expect(layout).not.toBeNull();
    expect(Object.keys(layout.panels)).not.toContain("gallery");
    const editors = layout.grid.root.data[1] as { data: { views: string[]; activeView: string } };
    expect(editors.data.views).toEqual(["code", "pixel", "capture", "director"]);
    expect(editors.data.activeView).toBe("code");
    expect(layout.grid.width).toBe(1440);
    expect(layoutViewCount(layout)).toBe(8);
  });

  it("hands back a layout with nothing retired unchanged", () => {
    const layout = dropRetiredPanels(savedLayout(), known)!;
    expect(dropRetiredPanels(layout, known)).toBe(layout);
  });

  it("gives up on a layout where the gallery had a group to itself", () => {
    const layout = savedLayout();
    layout.grid.root.data[1] = {
      type: "leaf",
      data: { views: ["gallery"], activeView: "gallery", id: "3" },
      size: 680,
    };
    expect(dropRetiredPanels(layout, known)).toBeNull();
    expect(layoutViewCount(dropRetiredPanels(layout, known))).toBe(0);
  });

  it("takes the tab out of a floating group too", () => {
    const layout = {
      ...savedLayout(),
      floatingGroups: [
        {
          data: { views: ["knobs", "gallery"], activeView: "knobs", id: "6" },
          position: { left: 10, top: 10, width: 300, height: 200 },
        },
      ],
    };
    const result = dropRetiredPanels(layout, known)!;
    expect(result.floatingGroups[0].data.views).toEqual(["knobs"]);
  });
});

describe("a project saved with the gallery's settings", () => {
  it("restores with the colour mode and lets the batch settings go", () => {
    const json = JSON.stringify({
      version: 2,
      name: "Old piece",
      matrix: { width: 128, height: 64 },
      layers: [
        {
          id: "a",
          type: "code",
          name: "Code 1",
          visible: true,
          opacity: 1,
          blend: "normal",
          code: "function draw() {}",
        },
      ],
      activeLayerId: "a",
      knobs: [0.5, 0.5, 0.5, 0.5],
      ranges: [[0, 1], [0, 1], [0, 1], [0, 1]],
      knobLabels: ["Knob 1", "Knob 2", "Knob 3", "Knob 4"],
      gen: { count: 12, thinking: "HIGH", refs: 3, colorMode: "rgb" },
    });
    const project = deserializeProject(json);
    expect(project?.gen).toEqual({ colorMode: "rgb" });
  });
});

describe("opening the lab", () => {
  it("removes the gallery's patterns and the Gemini key, and nothing else", () => {
    localStorage.setItem(LAB_STORAGE.gallery, JSON.stringify([{ id: "x", name: "Variation", code: "function draw() {}" }]));
    localStorage.setItem(LAB_STORAGE.geminiKey, "AIza-not-a-real-key");
    localStorage.setItem(LAB_STORAGE.capture, "{}");
    useLabStore.getState().hydrate();
    expect(localStorage.getItem(LAB_STORAGE.gallery)).toBeNull();
    expect(localStorage.getItem(LAB_STORAGE.geminiKey)).toBeNull();
    expect(localStorage.getItem(LAB_STORAGE.capture)).toBe("{}");
    expect(useLabStore.getState()).not.toHaveProperty("gallery");
  });
});
