import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildVariantCopyPrompt } from "@/lib/ai/gemini";
import { buildCppPrompt } from "@/lib/lab/cppPrompt";
import { buildHExport } from "@/lib/lab/hExport";
import { codeLayerFromSource, initialLabPreset } from "@/lib/lab/store/shared";
import { defaultKnobState } from "@/lib/lab/annotations";
import { DEFAULT_RAMP_STATE } from "@/lib/lab/types";
import { livePresets } from "@/lib/presets";
import { AI_PRESETS, AI_WORDS, answer, recognize } from "./answers";

// The practice AI (06): it knows the Lab's two prompts by lines their own
// builders write, and answers with a preset's real JavaScript and that same
// preset's real firmware header — checked here against the files themselves.

const panel = { width: 128, height: 64 };
const tall = { width: 64, height: 128 };
const { knobs, ranges, labels } = defaultKnobState();

const variation = (code: string, colorMode: "vfield" | "rgb" = "vfield", matrix = panel) =>
  buildVariantCopyPrompt(code, knobs, ranges, colorMode, matrix);
const conversion = (code: string, extra: Partial<Parameters<typeof buildCppPrompt>[0]> = {}) =>
  buildCppPrompt({ code, matrix: panel, knobs, ranges, knobLabels: labels, ramp: DEFAULT_RAMP_STATE, name: "My pattern", ...extra });

const presetCode = (id: string) => livePresets.find((p) => p.id === `pattern-${id}`)!.code;
/** The repository's root: this file is web/src/components/guide/desk/ai/. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const firmwareHeader = (id: string) =>
  readFileSync(path.join(ROOT, "firmware/patternflow/presets", `preset_${id.replace(/-/g, "_")}.h`), "utf8").replace(/\r\n/g, "\n");

describe("practice AI: which prompt is this", () => {
  it("knows the Lab's Copy prompt, in both colour modes and any frame", () => {
    for (const mode of ["vfield", "rgb"] as const) {
      expect(recognize(variation(initialLabPreset.code, mode))).toBe("variation");
      expect(recognize(variation(initialLabPreset.code, mode, tall))).toBe("variation");
    }
  });

  it("knows the conversion prompt, whatever the pattern needs", () => {
    expect(recognize(conversion(initialLabPreset.code))).toBe("conversion");
    expect(recognize(conversion(presetCode("0510"), { recolor: true }))).toBe("conversion");
    expect(recognize(conversion(initialLabPreset.code, { matrix: tall }))).toBe("conversion");
    expect(recognize(conversion(initialLabPreset.code, { name: "" }))).toBe("conversion");
    // Pasted on Windows, or with a stray line before it.
    expect(recognize("\r\n" + conversion(initialLabPreset.code).replace(/\n/g, "\r\n"))).toBe("conversion");
  });

  it("does not take one for the other, or anything else for either", () => {
    // The variation prompt carries the pattern's code; the conversion prompt carries JS too.
    expect(recognize(variation(conversion(initialLabPreset.code)))).toBe("variation");
    expect(recognize("make me a pattern")).toBe("other");
    expect(recognize(initialLabPreset.code)).toBe("other");
    expect(recognize(AI_PRESETS[0].h)).toBe("other");
    // A stack's per-layer prompt (To hardware with layers) is neither: it gets its own set reply.
    const one = codeLayerFromSource(initialLabPreset.code, "Code 1").layer;
    const two = codeLayerFromSource(presetCode("0710"), "Code 2").layer;
    const stack = buildHExport({ name: "Stack", matrix: panel, layers: [two, one], knobs, ranges, knobLabels: labels });
    expect(stack.units.length).toBeGreaterThan(1);
    for (const unit of stack.units) {
      expect(recognize(unit.prompt)).toBe("layer");
      expect(answer(unit.prompt)).toEqual({ kind: "layer" });
    }
    for (const lang of ["en", "ko"] as const) expect(AI_WORDS[lang].layer).toContain("Copy the conversion prompt");
  });
});

describe("practice AI: its answers are the real presets", () => {
  it("answers with presets that are twins, neither of them the Lab's opening pattern", () => {
    for (const p of AI_PRESETS) {
      expect(p.js).toBe(presetCode(p.id));
      expect(p.h).toBe(firmwareHeader(p.id));
      // What HardwareModal checks before Next → ("Looks like a header ✓").
      expect(/^\s*#pragma\s+once\b/m.test(p.h)).toBe(true);
      expect(p.js).not.toBe(initialLabPreset.code);
      expect(p.title.test(p.js)).toBe(true);
      expect(p.title.test(p.h)).toBe(true);
    }
  });

  it("gives JavaScript that changes what the Lab has", () => {
    const [a, b] = AI_PRESETS;
    expect(answer(variation(initialLabPreset.code))).toMatchObject({ kind: "variation", code: a.js, lang: "javascript" });
    // The Lab already holds the first: the second, so the preview still changes.
    expect(answer(variation(a.js))).toMatchObject({ kind: "variation", code: b.js });
    expect(answer(variation(b.js))).toMatchObject({ kind: "variation", code: a.js });
  });

  it("gives the header of the pattern in the conversion prompt", () => {
    const [a, b] = AI_PRESETS;
    expect(answer(conversion(a.js))).toMatchObject({ kind: "conversion", code: a.h, lang: "cpp" });
    expect(answer(conversion(b.js))).toMatchObject({ kind: "conversion", code: b.h });
    // A pattern it doesn't know: the header of the JavaScript it last gave, else the first.
    expect(answer(conversion(initialLabPreset.code), b.id)).toMatchObject({ code: b.h });
    expect(answer(conversion(initialLabPreset.code))).toMatchObject({ code: a.h });
  });

  it("has one set reply for everything else", () => {
    expect(answer("hello")).toEqual({ kind: "other" });
    expect(answer("")).toEqual({ kind: "other" });
  });

  it("says everything in both languages", () => {
    expect(Object.keys(AI_WORDS.en).sort()).toEqual(Object.keys(AI_WORDS.ko).sort());
    for (const lang of ["en", "ko"] as const) {
      for (const [k, v] of Object.entries(AI_WORDS[lang])) {
        const s = typeof v === "function" ? (v as (arg: unknown) => string)(3) : v;
        expect(s.trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });
});
