/**
 * The pattern study's one command. From web/:
 *
 *   npx tsx ../incoming/pattern-study/tools/study.ts            check, measure, write index.html
 *   npx tsx ../incoming/pattern-study/tools/study.ts --shots    the same, and the GIFs and knob sheets
 *   npx tsx ../incoming/pattern-study/tools/study.ts --check    write nothing; fail on a pattern or a stale index.html
 *   ... study.ts --only ripple-tank,moire    just those (index.html is left alone)
 *
 * A pattern passes when a Lab paste reads all four knobs and the frame from
 * it, it runs eight seconds in the Lab engine without throwing (and three more
 * with every knob at its minimum, then at its maximum), it lights the panel,
 * it moves, and each knob on its own changes the picture.
 */
import fs from "node:fs";
import path from "node:path";

import { isStockPanelFrame, parseMatrixAnnotation } from "@/lib/pattern/matrix";
import { parseRampAnnotation } from "@/lib/pattern/ramp";

import { listPatterns, loadPattern, run, STUDY, type Frame, type Pattern } from "./lab";
import { difference, measure, type Measures } from "./measure";
import { ensureShots, SHOTS, writeGif, writeKnobSheet } from "./shots";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const withShots = args.includes("--shots");
const onlyArg = args.indexOf("--only");
const only = onlyArg >= 0 ? (args[onlyArg + 1] ?? "").split(",").filter(Boolean) : null;

const FPS = 30;
// A knob whose settings all stay this close to each other, frame for frame,
// is a knob the person turning it would not see.
const KNOB_FLOOR = 0.012;
const LIT_FLOOR = 0.03;
const MOTION_FLOOR = 0.004;

const pending: Promise<unknown>[] = [];

export type Result = {
  pattern: Pattern;
  problems: string[];
  measures: Measures | null;
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
  if (/\bsetValue\s*\(/.test(code) && !parseRampAnnotation(code)) problems.push("draws with setValue() but has no @ramp, so the Lab would show it grey");
  for (const key of ["Title", "Family", "Idea"]) if (!new RegExp(`^//[ \\t]*${key}:`, "m").test(code)) problems.push(`no "// ${key}:" line`);
  if (!/SPDX-License-Identifier:\s*CC-BY-SA-4\.0/.test(code)) problems.push("no CC-BY-SA-4.0 SPDX line");
  pattern.knobs.forEach((knob, i) => {
    if (!(pattern.start[i] >= knob.min && pattern.start[i] <= knob.max)) problems.push(`K${i + 1} starts outside its range`);
  });

  const main = framesOf(pattern, pattern.start, 8, 2);
  if (main.error) {
    problems.push(`throws at the start knobs: ${main.error.split("\n")[0]}`);
    return { pattern, problems, measures: null, knobResponse: [], ms: main.ms };
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
  const sheet: Uint8Array[][] = [];
  const knobResponse = pattern.knobs.map((knob, k) => {
    const runs = stops.map((u) => {
      const knobs = [...pattern.start];
      knobs[k] = knob.min + (knob.max - knob.min) * u;
      return framesOf(pattern, knobs, 3, 2).frames;
    });
    sheet.push([runs[0], runs[2], runs[4]].map((frames) => frames[frames.length - 1].rgb));
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

  if (withShots && !checkOnly) {
    ensureShots();
    // Three seconds at 15 fps. A busy pattern whose GIF comes out past 450 KB
    // goes again at 10 fps, then for two seconds, so a page of them still
    // opens on a phone.
    const gif = path.join(SHOTS, `${slug}.gif`);
    for (const [every, seconds] of [[2, 3], [3, 3], [3, 2]]) {
      const fps = FPS / every;
      const gifFrames = main.frames.filter((_, i) => i % every === 0).slice(0, fps * seconds);
      writeGif(gif, gifFrames, pattern.matrix.width, pattern.matrix.height, 3, fps);
      if (fs.statSync(gif).size <= 450 * 1024) break;
    }
    pending.push(writeKnobSheet(path.join(SHOTS, `${slug}-knobs.png`), pattern, sheet));
  }

  return { pattern, problems, measures, knobResponse, ms: main.ms };
}

async function main() {
  const slugs = only ?? listPatterns();
  const results = slugs.map(study);
  await Promise.all(pending);

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad("pattern", 22) + pad("family", 11) + "motion detail edges  cmplx  lit    colour drift  ms   knobs");
  for (const r of results) {
    const m = r.measures;
    const f = (v: number | undefined) => (v === undefined ? "-".padEnd(7) : v.toFixed(3).padEnd(7));
    console.log(
      pad(r.pattern.slug, 22) +
        pad(r.pattern.family, 11) +
        f(m?.motion) + f(m?.detail) + f(m?.edges) + f(m?.complexity) + f(m?.coverage) + f(m?.colour) + f(m?.drift) +
        r.ms.toFixed(1).padEnd(5) +
        r.knobResponse.map((v) => v.toFixed(2)).join(" "),
    );
  }

  const failed = results.filter((r) => r.problems.length);
  for (const r of failed) for (const p of r.problems) console.log(`FAIL ${r.pattern.slug}: ${p}`);
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
  if (failed.length) process.exit(1);
}

void main();
