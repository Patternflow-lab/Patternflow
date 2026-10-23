/**
 * The pattern study's one command. From web/:
 *
 *   npx tsx ../incoming/pattern-study/tools/study.ts            check, measure, write index.html
 *   npx tsx ../incoming/pattern-study/tools/study.ts --check    write nothing; fail on a pattern or a stale index.html
 *   ... study.ts --only ripple-tank,moire    just those (index.html is left alone)
 *   ... study.ts --check --gaps              and the empty cells of every map, the
 *                                           ones the page draws dashed
 *
 * A pattern passes when the Lab reads all four knobs and the frame from its
 * code, the frame is the panel standing up (64 wide, 128 tall), it runs eight seconds in the Lab engine without throwing (and three more
 * with every knob at its minimum, then at its maximum), it lights the panel,
 * it moves, and each knob on its own changes the picture. Its code may not
 * name the network, the page, a clock or code built from text (OFF_LIMITS),
 * its family is one families.json names, and a file from round three on
 * carries the whole header the rounds write: Author, Date, Lineage and a
 * "// Knob N:" line for each knob.
 *
 * The study keeps no pictures. Earlier rounds left a GIF and a knob sheet
 * per pattern and an overview in shots/; they were taken out when a round
 * started bringing ten patterns, and index.html is where the patterns are
 * looked at.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type * as TS from "typescript";

import { isStockPanelFrame, parseMatrixAnnotation } from "@/lib/pattern/matrix";
import { parseRampAnnotation } from "@/lib/pattern/ramp";

import { AXES, emptyCells } from "./map";
import { FAMILIES_FILE, listPatterns, loadFamilies, loadPattern, roundOf, run, STUDY, type Family, type Frame, type Pattern } from "./lab";
import { difference, measure, thirds, type Measures } from "./measure";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const withGaps = args.includes("--gaps");
const onlyArg = args.indexOf("--only");
const only = onlyArg >= 0 ? (args[onlyArg + 1] ?? "").split(",").filter(Boolean) : null;
// An old round's notes still say --shots. Running on past it would let a
// round believe the pictures were made.
for (const flag of args.filter((a) => a.startsWith("--") && !["--check", "--gaps", "--only"].includes(a))) {
  console.log(flag === "--shots" ? "--shots is gone: the study keeps no GIFs now. Open index.html to look." : `unknown flag ${flag}`);
  process.exit(1);
}

const FPS = 30;
// A knob whose settings all stay this close to each other, frame for frame,
// is a knob the person turning it would not see.
const KNOB_FLOOR = 0.012;
const LIT_FLOOR = 0.03;
const MOTION_FLOOR = 0.004;

// This folder has no node_modules of its own: typescript is web/'s.
const ts = createRequire(path.resolve(STUDY, "../../web/package.json"))("typescript") as typeof TS;

/**
 * A pattern draws from its knobs, its buttons and the time the Lab hands it.
 * These names reach past that. The page and the Lab run a pattern with the
 * browser's rights, and the study runs it inside Node, so a pattern that
 * names one fails the check. Comments may say them; the names are read from
 * the parsed code. This catches a pattern that reaches out by mistake. It is
 * not a sandbox: a name spelled out of pieces of text gets past it.
 */
const OFF_LIMITS: Record<string, string> = {
  fetch: "reaches the network",
  XMLHttpRequest: "reaches the network",
  WebSocket: "reaches the network",
  EventSource: "reaches the network",
  navigator: "reaches the network",
  Worker: "reaches the network",
  SharedWorker: "reaches the network",
  importScripts: "reaches the network",
  import: "reaches the network",
  document: "reaches the page",
  window: "reaches the page",
  globalThis: "reaches the page",
  self: "reaches the page",
  global: "reaches the page",
  location: "reaches the page",
  localStorage: "reaches the page",
  sessionStorage: "reaches the page",
  indexedDB: "reaches the page",
  process: "reaches Node, where the study runs patterns",
  require: "reaches Node, where the study runs patterns",
  eval: "builds code from text",
  Function: "builds code from text",
  constructor: "builds code from text",
  setTimeout: "builds code from text",
  setInterval: "builds code from text",
  // The Lab hands a pattern its time. A clock of its own makes the GIFs and
  // --check come out different on every run.
  Date: "keeps a clock of its own",
  performance: "keeps a clock of its own",
};

function offLimits(code: string): string[] {
  const source = ts.createSourceFile("pattern.js", code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const found = new Set<string>();
  const visit = (node: TS.Node) => {
    if (ts.isIdentifier(node) && Object.hasOwn(OFF_LIMITS, node.text)) found.add(node.text);
    // import("…"), import.meta and a static import all start with the keyword.
    else if (node.kind === ts.SyntaxKind.ImportKeyword || ts.isImportDeclaration(node) || ts.isMetaProperty(node)) found.add("import");
    // thing["constructor"] is thing.constructor.
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && Object.hasOwn(OFF_LIMITS, node.argumentExpression.text))
      found.add(node.argumentExpression.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}

// The lines the page reads: a family's name and colour.
function familyProblems(families: Record<string, Family>): string[] {
  const problems: string[] = [];
  for (const [key, family] of Object.entries(families)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key)) problems.push(`"${key}" is not a lowercase family slug`);
    if (typeof family?.label !== "string" || !family.label.trim()) problems.push(`${key} has no label`);
    if (typeof family?.color !== "string" || !/^#[0-9a-f]{6}$/.test(family.color)) problems.push(`${key} has no #rrggbb color`);
  }
  return problems;
}

let families: Record<string, Family> = {};
const familyFile = path.relative(STUDY, FAMILIES_FILE);
const familyFailures: string[] = [];
try {
  families = loadFamilies();
  familyFailures.push(...familyProblems(families));
} catch (error) {
  familyFailures.push(`cannot read it: ${(error as Error).message.split("\n")[0]}`);
}

export type Result = {
  pattern: Pattern;
  problems: string[];
  measures: Measures | null;
  /** Lit share of the top, middle and bottom third of the panel. */
  thirds: number[];
  knobResponse: number[];
  ms: number;
};

function framesOf(pattern: Pattern, knobs: number[], seconds: number, from: number, presses?: [number, number][]) {
  const frames: Frame[] = [];
  const result = run(pattern, { knobs, seconds, from, presses, onFrame: (f) => frames.push(f) });
  return { frames, ...result };
}

function study(slug: string): Result {
  const problems: string[] = [];
  const pattern = loadPattern(slug);
  const { code } = pattern;

  const knobLine = pattern.layer.knobsAnnotationRaw;
  if (!knobLine) problems.push("no @knobs line");
  else {
    const named = (pattern.layer.code.match(/@knobs[ \t]+(.+)/)?.[1] ?? "").split(",").length;
    if (named !== 4) problems.push(`@knobs names ${named} knobs, not 4`);
  }
  const matrix = parseMatrixAnnotation(code);
  if (!matrix) problems.push("no @matrix line");
  else if (!isStockPanelFrame(matrix)) problems.push(`@matrix ${matrix.width}x${matrix.height} is not the stock panel`);
  // The panel stands on its short side by default, so the study draws for 64x128.
  else if (matrix.width > matrix.height) problems.push(`@matrix ${matrix.width}x${matrix.height} lies on its side; the panel stands 64x128`);
  if (/\bsetValue\s*\(/.test(code) && !parseRampAnnotation(code)) problems.push("draws with setValue() but has no @ramp, so the Lab would show it grey");
  for (const key of ["Title", "Family", "Idea"]) if (!new RegExp(`^//[ \\t]*${key}:`, "m").test(code)) problems.push(`no "// ${key}:" line`);
  if (!/SPDX-License-Identifier:\s*CC-BY-SA-4\.0/.test(code)) problems.push("no CC-BY-SA-4.0 SPDX line");
  if (pattern.family && !Object.hasOwn(families, pattern.family)) problems.push(`family "${pattern.family}" is not in ${familyFile}`);
  const roundLine = code.match(/^\/\/[ \t]*Round:[ \t]*(.*)$/m);
  if (roundLine && !/^\d+\s*$/.test(roundLine[1])) problems.push(`"// Round:" is not a number`);
  // Rounds three and on run without anyone at the desk, so their files carry
  // everything rounds one and two wrote by hand.
  if (roundOf(code) >= 3) {
    for (const key of ["Author", "Lineage"]) if (!new RegExp(`^//[ \\t]*${key}:[ \\t]*\\S`, "m").test(code)) problems.push(`no "// ${key}:" line`);
    if (!/^\/\/[ \t]*Date:[ \t]*\d{4}-\d{2}-\d{2}\b/m.test(code)) problems.push(`no "// Date: YYYY-MM-DD" line`);
    for (let n = 1; n <= 4; n++) if (!new RegExp(`^//[ \\t]*Knob ${n}:[ \\t]*\\S`, "m").test(code)) problems.push(`no "// Knob ${n}:" line`);
  }
  for (const name of offLimits(code)) problems.push(`uses ${name}, which ${OFF_LIMITS[name]}`);
  pattern.knobs.forEach((knob, i) => {
    if (!(pattern.start[i] >= knob.min && pattern.start[i] <= knob.max)) problems.push(`K${i + 1} starts outside its range`);
  });

  const main = framesOf(pattern, pattern.start, 8, 2);
  if (main.error) {
    problems.push(`throws at the start knobs: ${main.error.split("\n")[0]}`);
    return { pattern, problems, measures: null, thirds: [], knobResponse: [], ms: main.ms };
  }
  for (const [name, knobs] of [
    ["minimum", pattern.knobs.map((k) => k.min)],
    ["maximum", pattern.knobs.map((k) => k.max)],
  ] as const) {
    const corner = run(pattern, { knobs: [...knobs], seconds: 3, presses: [[1, 0], [1.5, 1], [2, 2], [2.5, 3]] });
    if (corner.error) problems.push(`throws with every knob at its ${name}: ${corner.error.split("\n")[0]}`);
  }

  const measures = measure(main.frames, pattern.matrix.width, pattern.matrix.height, FPS);
  if (measures.coverage < LIT_FLOOR) problems.push(`lights ${(measures.coverage * 100).toFixed(1)}% of the panel`);
  if (measures.motion < MOTION_FLOOR) problems.push(`hardly moves (${measures.motion.toFixed(4)})`);

  // Each knob alone, at five points across its range, three seconds each from
  // a fresh start and compared over the last second frame against frame. The
  // ends alone are not enough: a hue knob is the same colour at 0 and 1.
  const stops = [0, 0.25, 0.5, 0.75, 1];
  const knobResponse = pattern.knobs.map((knob, k) => {
    const runs = stops.map((u) => {
      const knobs = [...pattern.start];
      knobs[k] = knob.min + (knob.max - knob.min) * u;
      return framesOf(pattern, knobs, 3, 2).frames;
    });
    let response = 0;
    for (let a = 0; a < runs.length; a++)
      for (let b = a + 1; b < runs.length; b++) {
        const n = Math.min(runs[a].length, runs[b].length);
        let sum = 0;
        for (let i = 0; i < n; i++) sum += difference(runs[a][i].rgb, runs[b][i].rgb);
        response = Math.max(response, sum / Math.max(1, n));
      }
    if (response < KNOB_FLOOR) problems.push(`K${k + 1} ${knob.name} barely changes the picture (${response.toFixed(4)})`);
    return response;
  });

  return { pattern, problems, measures, thirds: thirds(main.frames, pattern.matrix.width, pattern.matrix.height), knobResponse, ms: main.ms };
}

/**
 * The empty cells of the map for each pair of the seven measures, the cells
 * the page draws dashed for that pair. A cell can be empty only because one
 * pattern far out at an end stretched the axis, so each cell is tried again
 * with the pattern at either end of either axis left out; a cell still empty
 * every time gets a *.
 */
function printGaps(results: Result[]) {
  const all = results.filter((r) => r.measures).map((r) => r.measures as unknown as Record<string, number>);
  const keys = Object.keys(AXES);
  console.log("empty cells (column,row from the low end of each axis, 1..4; * still empty with an end pattern left out)");
  for (let a = 0; a < keys.length; a++)
    for (let b = a + 1; b < keys.length; b++) {
      const [x, y] = [keys[a], keys[b]];
      const empty = emptyCells(x, y, all);
      const ends = new Set<number>();
      for (const key of [x, y]) {
        let lo = 0;
        let hi = 0;
        all.forEach((m, i) => {
          if (m[key] < all[lo][key]) lo = i;
          if (m[key] > all[hi][key]) hi = i;
        });
        ends.add(lo).add(hi);
      }
      const holds = ([cx, cy]: [number, number]) =>
        [...ends].every((skip) => emptyCells(x, y, all.filter((_, i) => i !== skip)).some(([ex, ey]) => ex === cx && ey === cy));
      const cells = empty.map((c) => `${c[0] + 1},${c[1] + 1}${holds(c) ? "*" : ""}`).join(" ");
      console.log(`${(x + " x " + y).padEnd(24)}${cells || "none"}`);
    }
}

async function main() {
  const slugs = only ?? listPatterns();
  const results = slugs.map(study);

  const pad = (s: string, n: number) => s.padEnd(n);
  // thirds: the share of the top, middle and bottom third lit, in whole
  // percent rounded down, so a 5 there is at least 5%.
  console.log(pad("pattern", 22) + pad("family", 11) + "motion detail edges  cmplx  lit    colour drift  thirds      ms   knobs");
  for (const r of results) {
    const m = r.measures;
    const f = (v: number | undefined) => (v === undefined ? "-".padEnd(7) : v.toFixed(3).padEnd(7));
    console.log(
      pad(r.pattern.slug, 22) +
        pad(r.pattern.family, 11) +
        f(m?.motion) + f(m?.detail) + f(m?.edges) + f(m?.complexity) + f(m?.coverage) + f(m?.colour) + f(m?.drift) +
        pad(r.thirds.length ? r.thirds.map((v) => Math.floor(v * 100)).join("/") : "-", 12) +
        r.ms.toFixed(1).padEnd(5) +
        r.knobResponse.map((v) => v.toFixed(2)).join(" "),
    );
  }

  if (withGaps && !only) printGaps(results);

  const failed = results.filter((r) => r.problems.length);
  for (const r of failed) for (const p of r.problems) console.log(`FAIL ${r.pattern.slug}: ${p}`);
  for (const p of familyFailures) console.log(`FAIL ${familyFile}: ${p}`);
  console.log(`${results.length - failed.length} of ${results.length} patterns pass`);

  // The page builder is optional while the study is being set up.
  if (!only && fs.existsSync(path.join(STUDY, "tools", "page.ts"))) {
    const pagePath = path.join(STUDY, "index.html");
    const { buildPage } = await import("./page");
    const html = buildPage(results);
    if (checkOnly) {
      const current = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";
      if (current !== html) {
        console.log("FAIL index.html is not what the patterns build: run study.ts without --check");
        process.exit(1);
      }
      console.log("index.html is up to date");
    } else {
      fs.writeFileSync(pagePath, html);
      console.log(`wrote index.html (${(html.length / 1024).toFixed(0)} KB)`);
    }
  }
  if (failed.length || familyFailures.length) process.exit(1);
}

void main();
