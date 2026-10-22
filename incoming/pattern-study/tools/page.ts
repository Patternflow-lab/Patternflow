/**
 * index.html: one file that runs on its own, opened from disk or from any
 * static host. The script is tools/gallery.ts bundled by esbuild together with
 * LabEngine, the Lab preview's engine, so a card on the page renders what a
 * paste into Pattern Lab renders. Each card gets the layer and knob state that
 * codeLayerFromSource builds for the paste, computed here and carried as
 * JSON, and the map gets the measures study.ts took.
 *
 * The one-line Korean note beside each card comes from the README's table of
 * patterns, the row that links patterns/<slug>.js. Without a row, the card
 * shows the pattern's own Idea line.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type * as Esbuild from "esbuild";

import { STUDY } from "./lab";
import type { Result } from "./study";

const esbuild = createRequire(path.resolve(STUDY, "../../web/package.json"))("esbuild") as typeof Esbuild;

/** Family slug as a pattern's header writes it → how the page names and colours it. */
export const FAMILIES: Record<string, { label: string; color: string }> = {
  noise: { label: "노이즈·흐름", color: "#5ec8ff" },
  sim: { label: "시뮬레이션", color: "#3fe0a8" },
  wave: { label: "물결·간섭", color: "#4f7dff" },
  particle: { label: "입자", color: "#ffb02e" },
  line: { label: "선·궤적", color: "#ff7a45" },
  geometry: { label: "기하·대칭", color: "#c77dff" },
  automata: { label: "셀룰러 오토마타", color: "#9be15d" },
  type: { label: "글자", color: "#ff5fa2" },
  rhythm: { label: "리듬·펄스", color: "#ff4d4d" },
  space: { label: "공간·원근", color: "#e8e05a" },
  glitch: { label: "글리치", color: "#b0b8c8" },
};

function readmeNotes(): Map<string, string> {
  const notes = new Map<string, string>();
  const file = path.join(STUDY, "README.md");
  if (!fs.existsSync(file)) return notes;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const row = line.match(/^\|\s*\[[^\]]+\]\(patterns\/([a-z0-9-]+)\.js\)\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/);
    if (row) notes.set(row[1], row[2]);
  }
  return notes;
}

function knobNotes(code: string): string[] {
  return [1, 2, 3, 4].map((n) => {
    const line = code.match(new RegExp(`^//[ \\t]*Knob ${n}:[ \\t]*(.+)$`, "m"))?.[1].trim() ?? "";
    // "Hue. Turns the pair..." → the sentence after the name.
    return line.replace(/^[^.]{1,20}\.\s*/, "");
  });
}

const round = (v: number) => Number(v.toFixed(4));

export function buildPage(results: Result[]): string {
  const notes = readmeNotes();
  const patterns = results
    .filter((r) => r.measures)
    .map((r) => {
      const p = r.pattern;
      const about = knobNotes(p.code);
      return {
        slug: p.slug,
        title: p.title,
        family: p.family,
        note: notes.get(p.slug) ?? "",
        idea: p.idea,
        buttons: p.code.match(/^\/\/[ \t]*Buttons:[ \t]*(.+)$/m)?.[1].trim() ?? "",
        code: p.code,
        layer: { ...p.layer, id: `layer-${p.slug}` },
        matrix: p.matrix,
        knobs: p.knobs.map((k, i) => ({ ...k, about: about[i] })),
        start: p.start,
        measures: Object.fromEntries(Object.entries(r.measures!).map(([k, v]) => [k, round(v)])),
        knobResponse: r.knobResponse.map(round),
      };
    });
  const used = new Set(patterns.map((p) => p.family));
  const families = Object.fromEntries(
    [...used].sort().map((f) => [f, FAMILIES[f] ?? { label: f, color: "#cccccc" }]),
  );
  const data = { patterns, families };

  const bundle = esbuild.buildSync({
    entryPoints: [path.join(STUDY, "tools", "gallery.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    minifyWhitespace: true,
    minifySyntax: true,
    legalComments: "none",
    logLevel: "warning",
  });
  const js = bundle.outputFiles[0].text.trimEnd();
  if (js.includes("</script")) throw new Error("the bundle contains '</script' and cannot be inlined");

  const template = fs.readFileSync(path.join(STUDY, "tools", "page.html"), "utf8");
  return template
    .replace("/*__DATA__*/", () => JSON.stringify(data).replace(/</g, "\\u003c"))
    .replace("/*__SCRIPT__*/", () => js);
}
