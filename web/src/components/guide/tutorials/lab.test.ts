import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { needsFlatten } from "@/lib/lab/flatten";
import { codeLayerFromSource, initialLabPreset } from "@/lib/lab/store/shared";
import type { Layer } from "@/lib/lab/types";
import { LAB_COPY } from "../copy/lab";
import { LAB_TUTORIAL, stackOf } from "./lab";

// Make · 02 Pattern Lab: the words the pointer aims at in the real Lab, and the UI
// words its cards quote, are still the Lab's (and the community's) own. If
// the Lab renames a button, this fails before the pointer silently hides.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function sources(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out += sources(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out += readFileSync(p, "utf8") + "\n";
  }
  return out;
}

const LAB_UI = ["app/pattern-lab", "lib/lab"].map((d) => sources(path.join(SRC, d))).join("\n");
const COMMUNITY_UI = ["components/community", "app/community"].map((d) => sources(path.join(SRC, d))).join("\n");

/** The Lab's words the tutorial finds controls by (tutorials/lab.ts). */
const AIMED_AT = [
  // dock tabs (panels/registry.tsx titles)
  '"Preview"',
  '"Code"',
  '"Knobs"',
  '"Color Ramp"',
  '"Graphic Export"',
  '"Director"',
  '"Layers"',
  // controls
  'aria-label="Pattern name"',
  "Saved locally",
  "Copy prompt",
  "Paste",
  "Pasted ✓",
  "Random ramp",
  'aria-label="Ramp gradient preview"',
  'role="spinbutton"',
  "To hardware",
  'aria-label="Hardware"',
  'aria-label="Close"',
  "Copy the conversion prompt",
  'placeholder="Paste the .h',
  "placeholder={`Paste the namespace L",
  '"Hide layer"',
  '"Show layer"',
  "MASK↓",
  '"JS"',
  "Looks like a header ✓",
  "Next →",
  "← Back to the header",
  "↗ Apply to my Patternflow",
  "+ Code",
  "masks layer below",
  'aria-label="Output size preset"',
  "Save PNG",
  '"▶"',
  "Upload to the community",
  "Share",
];

/** UI words the chapter's cards quote, and where they come from. */
const QUOTED: [string, "lab" | "community"][] = [
  ["name this pattern", "lab"],
  ["Saved locally", "lab"],
  ["Copy prompt", "lab"],
  ["Paste", "lab"],
  ["Color Ramp", "lab"],
  ["Random ramp", "lab"],
  ["To hardware", "lab"],
  ["Copy the conversion prompt", "lab"],
  ["Looks like a header ✓", "lab"],
  ["Next →", "lab"],
  ["↗ Apply to my Patternflow", "lab"],
  ["+ Code", "lab"],
  ["+ Pixel", "lab"],
  ["masks layer below", "lab"],
  ["Opacity", "lab"],
  ["Blend", "lab"],
  ["Graphic Export", "lab"],
  ["Save PNG", "lab"],
  ["● Record", "lab"],
  ["MP4", "lab"],
  ["WebM", "lab"],
  [".pfs", "lab"],
  [".mid", "lab"],
  ["Render…", "lab"],
  ["Upload to the community", "lab"],
  ["Share", "lab"],
  ["Send over Wi-Fi", "community"],
  ["Device address", "community"],
  ["NETWORK screen", "community"],
  ["hold K2", "community"],
  ["Port this pattern (.h)", "community"],
];

describe("02 Pattern Lab: the Lab's own words", () => {
  it.each(AIMED_AT)("the Lab still says %s", (w) => {
    expect(LAB_UI.includes(w)).toBe(true);
  });

  it.each(QUOTED)("the cards quote %s as the UI says it", (w, from) => {
    expect((from === "lab" ? LAB_UI : COMMUNITY_UI).includes(w)).toBe(true);
    const inCopy = (["en", "ko"] as const).some((lang) =>
      LAB_COPY[lang].steps.some((s) => [...s.body, s.warn ?? ""].some((t) => t.includes(w))),
    );
    expect(inCopy, `copy/lab.ts no longer quotes "${w}": drop it from this list`).toBe(true);
  });

  it("tells a layer stack from one pattern as To hardware does (flatten.ts needsFlatten)", () => {
    const one = codeLayerFromSource(initialLabPreset.code, "Code 1").layer;
    const two = codeLayerFromSource(initialLabPreset.code, "Code 2").layer;
    const px = { ...one, type: "pixel" } as unknown as Layer;
    const cases: Layer[][] = [
      [one],
      [two, one],
      [{ ...two, visible: false }, one],
      [{ ...two, role: "mask" }, one],
      [{ ...two, opacity: 0 }, one],
      [px, one],
      [{ ...px, visible: false }, one],
      [{ ...one, role: "mask" }],
      [{ ...one, visible: false }],
      [],
    ];
    for (const layers of cases) {
      // As the Lab saves them: plain JSON (serialize.ts).
      const saved = JSON.parse(JSON.stringify(layers.map((l) => ({ type: l.type, visible: l.visible, role: l.role, opacity: l.opacity }))));
      expect(stackOf(saved)).toBe(needsFlatten(layers));
    }
  });

  it("has a tutorial entry for every step, the pointer never pressing what leaves the browser", () => {
    expect(LAB_TUTORIAL.length).toBe(LAB_COPY.en.steps.length);
    const leaves = /^(Share|↗ Apply to my Patternflow|Upload to the community|Send over Wi-Fi)$/;
    for (const beats of LAB_TUTORIAL) {
      for (const b of beats ?? []) {
        const words = typeof b.target === "object" && b.target && "text" in b.target ? b.target.text : null;
        if (typeof words === "string" && leaves.test(words)) {
          expect(b.do ?? "point").toBe("point");
          expect(typeof b.until).toBe("number");
        }
      }
    }
  });
});
