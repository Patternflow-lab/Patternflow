/**
 * Checks a brand folder's patterns and measures what the pattern study asks of
 * a pattern that keeps moving (incoming/pattern-study/ROUND.md, 「창작자 방향」).
 * From web/:
 *
 *   npx tsx ../incoming/collab-kit/check.ts clio               every pattern in incoming/collab-clio/
 *   ... check.ts clio --only rouge-lacquer                     just that one
 *   ... check.ts clio --soak                                   and a 900 s run each
 *
 * A pattern fails on a missing header line, a name that reaches past the knobs
 * and the clock the Lab hands it (the study's OFF_LIMITS), an error in any run,
 * a knob whose response is under 0.03 (measured as the study measures it), or recur under 0.40: a picture that comes
 * back to where it was. The fill numbers are printed against their lines and
 * marked, but do not fail: a brand look may want a dark ground, and the README
 * says why when it does.
 *
 * recur: 240 s at 30 fps, a frame kept every half second, each cut to 8x8 LED
 * cells of mean colour. The closest pair more than 20 s apart, over the median
 * distance of such pairs. 0 is a loop. The study's Domain Warp measures 0.74.
 * dark: the darkest 16x16 cell's mean level over the mean of all cells (0.40).
 * still: the cell that changes least between frames half a second apart, over
 * the mean change of all cells (0.30). last: the same two over the last quarter.
 * drift: last quarter's mean level against the first quarter's (within 25%).
 * A level is an LED's brightest channel, as the study's measure.ts reads it.
 */
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { brandDir, frames, listSlugs, loadBrandPattern, onlyArg, run, type Pattern } from "./kit";

const args = process.argv.slice(2);
const brand = args[0];
if (!brand || brand.startsWith("--")) {
  console.log("usage: check.ts <brand> [--only a,b] [--soak]");
  process.exit(1);
}
const dir = brandDir(brand);
const only = onlyArg(args);
const soak = args.includes("--soak");

const HEADER = ["Title", "Idea", "Author", "Date", "SPDX-License-Identifier", "Lineage"];

// The study's list (incoming/pattern-study/tools/study.ts). Names, read from
// the parsed code, that reach the network, the page, Node or a clock.
const OFF_LIMITS = [
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "navigator", "Worker", "SharedWorker", "importScripts",
  "document", "window", "globalThis", "self", "global", "location", "localStorage", "sessionStorage", "indexedDB",
  "process", "require", "eval", "Function", "constructor", "setTimeout", "setInterval", "Date", "performance",
];

function offLimits(code: string): string[] {
  const found = new Set<string>();
  const source = ts.createSourceFile("p.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && OFF_LIMITS.includes(node.text)) found.add(node.text);
    else if (node.kind === ts.SyntaxKind.ImportKeyword || ts.isImportDeclaration(node) || ts.isMetaProperty(node)) found.add("import");
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && OFF_LIMITS.includes(node.argumentExpression.text))
      found.add(node.argumentExpression.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}

function headerProblems(p: Pattern): string[] {
  const out: string[] = [];
  for (const key of HEADER) if (!new RegExp(`^//[ \\t]*${key}:[ \\t]*\\S`, "m").test(p.code)) out.push(`no "// ${key}:" line`);
  for (let k = 1; k <= 4; k++) if (!new RegExp(`^//[ \\t]*Knob ${k}:`, "m").test(p.code)) out.push(`no "// Knob ${k}:" line`);
  if (!/^\/\/[ \t]*@matrix[ \t]+64x128/m.test(p.code)) out.push("no @matrix 64x128 line");
  if (!/^\/\/[ \t]*@knobs[ \t]/m.test(p.code)) out.push("no @knobs line");
  return out;
}

const W = 64;
const H = 128;
const level = (rgb: Uint8Array, p: number) => Math.max(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2]);

/** 8x8 cells of mean colour, 8 x 16 x 3 values. */
function cells8(rgb: Uint8Array) {
  const out = new Float32Array(8 * 16 * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = ((y >> 3) * 8 + (x >> 3)) * 3;
      const i = (y * W + x) * 3;
      out[c] += rgb[i];
      out[c + 1] += rgb[i + 1];
      out[c + 2] += rgb[i + 2];
    }
  for (let i = 0; i < out.length; i++) out[i] /= 64;
  return out;
}

function recur(kept: { rgb: Uint8Array; t: number }[]) {
  const v = kept.map((f) => cells8(f.rgb));
  const dists: number[] = [];
  let best = Infinity;
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      if (kept[j].t - kept[i].t <= 20) continue;
      let d = 0;
      for (let k = 0; k < v[i].length; k++) d += (v[i][k] - v[j][k]) ** 2;
      d = Math.sqrt(d);
      dists.push(d);
      if (d < best) best = d;
    }
  if (dists.length === 0) return 0;
  dists.sort((a, b) => a - b);
  const median = dists[dists.length >> 1];
  return median > 0 ? best / median : 0;
}

/** The two fill numbers over a run of frames half a second apart, and the mean level. */
function fill(kept: { rgb: Uint8Array }[]) {
  const CELLS = 4 * 8;
  const mean = new Float64Array(CELLS);
  const change = new Float64Array(CELLS);
  let prev: Uint8Array | null = null;
  for (const f of kept) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        const c = (y >> 4) * 4 + (x >> 4);
        const l = level(f.rgb, p);
        mean[c] += l;
        if (prev) change[c] += Math.abs(l - level(prev, p));
      }
    prev = f.rgb;
  }
  const n = kept.length * 256;
  for (let c = 0; c < CELLS; c++) {
    mean[c] /= n;
    change[c] /= Math.max(1, (kept.length - 1) * 256);
  }
  const avg = (a: Float64Array) => a.reduce((s, x) => s + x, 0) / a.length;
  const m = avg(mean);
  const ch = avg(change);
  return { dark: m > 0 ? Math.min(...mean) / m : 0, still: ch > 0 ? Math.min(...change) / ch : 0, level: m };
}

// The study's knob measure (study.ts): each knob alone at five points across
// its range, three seconds each from a fresh start, compared frame against
// frame over the last second; the largest pair. The ends alone are not
// enough: a hue knob is the same colour at 0 and 1.
function knobResponse(p: Pattern) {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return p.knobs.map((k, i) => {
    const runs = stops.map((u) => {
      const knobs = [...p.start];
      knobs[i] = k.min + (k.max - k.min) * u;
      const kept: Uint8Array[] = [];
      const r = run(p, { knobs, seconds: 3, from: 2, onFrame: (f) => kept.push(f.rgb) });
      if (r.error) throw new Error(`knob ${i + 1} at ${knobs[i]}: ${r.error}`);
      return kept;
    });
    let response = 0;
    for (let a = 0; a < runs.length; a++)
      for (let b = a + 1; b < runs.length; b++) {
        const n = Math.min(runs[a].length, runs[b].length);
        let sum = 0;
        for (let f = 0; f < n; f++) {
          let d = 0;
          const x = runs[a][f];
          const y = runs[b][f];
          for (let j = 0; j < x.length; j++) d += Math.abs(x[j] - y[j]);
          sum += d / x.length / 255;
        }
        response = Math.max(response, sum / Math.max(1, n));
      }
    return response;
  });
}

const f2 = (v: number) => v.toFixed(2);
const mark = (v: number, line: number) => `${f2(v)}${v >= line ? "" : "!"}`;

let failed = 0;
const slugs = listSlugs(dir).filter((s) => !only || only.has(s));
if (slugs.length === 0) {
  console.log(`no patterns in ${path.relative(process.cwd(), dir)}/patterns`);
  process.exit(1);
}
console.log(`${path.basename(dir)} · ${slugs.length} pattern(s) · ! marks a number under its line`);
console.log("slug                      recur  dark  still  last(dark/still)  drift   knobs                    ms/frame");
for (const slug of slugs) {
  const problems: string[] = [];
  const p = loadBrandPattern(dir, slug);
  problems.push(...headerProblems(p));
  const names = offLimits(p.code);
  if (names.length) problems.push(`names ${names.join(", ")}`);
  const size = fs.statSync(p.file).size;

  const main = frames(p, p.start, 240, 0.5, 0.5);
  if (main.error) problems.push(`error at start knobs: ${main.error}`);
  let line = "";
  if (!main.error) {
    const r = recur(main.kept);
    const all = fill(main.kept);
    const q = main.kept.length >> 2;
    const last = fill(main.kept.slice(-q));
    const first = fill(main.kept.slice(0, q));
    const drift = first.level > 0 ? last.level / first.level - 1 : 0;
    let resp: number[] = [];
    try {
      resp = knobResponse(p);
    } catch (e) {
      problems.push(String((e as Error).message));
    }
    if (r < 0.4) problems.push(`recur ${f2(r)} is under 0.40`);
    resp.forEach((v, i) => v < 0.03 && problems.push(`knob ${i + 1} (${p.knobs[i].name}) responds ${v.toFixed(3)}, under 0.03`));
    line = [
      slug.padEnd(25),
      mark(r, 0.4).padEnd(6),
      mark(all.dark, 0.4).padEnd(5),
      mark(all.still, 0.3).padEnd(6),
      `${mark(last.dark, 0.4)}/${mark(last.still, 0.3)}`.padEnd(17),
      `${drift >= 0 ? "+" : ""}${Math.round(drift * 100)}%${Math.abs(drift) <= 0.25 ? "" : "!"}`.padEnd(7),
      resp.map((v) => v.toFixed(3)).join(" ").padEnd(24),
      main.ms.toFixed(2),
    ].join(" ");

    // The extremes and two settings in between, for errors and the fill lines.
    const rand = (i: number, s: number) => {
      const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    const settings: [string, number[]][] = [
      ["all min", p.knobs.map((k) => k.min)],
      ["all max", p.knobs.map((k) => k.max)],
      ...[1, 2].map((s): [string, number[]] => [`mix ${s}`, p.knobs.map((k, i) => k.min + (k.max - k.min) * rand(i, s))]),
    ];
    const extra: string[] = [];
    for (const [name, knobs] of settings) {
      const r2 = frames(p, knobs, 60, 0.5, 0.5);
      if (r2.error) {
        problems.push(`error at ${name}: ${r2.error}`);
        continue;
      }
      const f = fill(r2.kept);
      extra.push(`${name} ${mark(f.dark, 0.4)}/${mark(f.still, 0.3)}`);
    }
    line += `\n${"".padEnd(26)}${extra.join(" · ")} · ${(size / 1024).toFixed(1)} KB`;

    if (soak) {
      const long = frames(p, p.start, 900, 1, 1);
      if (long.error) problems.push(`error in the 900 s run: ${long.error}`);
      else {
        const q2 = long.kept.length >> 2;
        const a = fill(long.kept.slice(0, q2));
        const b = fill(long.kept.slice(-q2));
        const d = a.level > 0 ? b.level / a.level - 1 : 0;
        line += `\n${"".padEnd(26)}900 s: level ${a.level.toFixed(1)} → ${b.level.toFixed(1)} (${d >= 0 ? "+" : ""}${Math.round(d * 100)}%), last quarter ${mark(b.dark, 0.4)}/${mark(b.still, 0.3)}`;
        if (b.level < 8) problems.push("the 900 s run ends nearly dark");
      }
    }
  }
  console.log(line || slug);
  for (const problem of problems) console.log(`  FAIL ${problem}`);
  if (problems.length) failed++;
}
console.log(failed ? `${failed} of ${slugs.length} fail` : `${slugs.length} of ${slugs.length} pass`);
process.exit(failed ? 1 : 0);
