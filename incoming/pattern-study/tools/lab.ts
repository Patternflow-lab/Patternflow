/**
 * The Lab, without the page: codeLayerFromSource reads a pattern file's
 * @ramp, @knobs and @matrix the way the Lab builds a layer from code, and
 * LabEngine, the Lab preview's own engine, renders it. study.ts checks and
 * measures through this; nothing here is a copy of the Lab's code.
 *
 * The knobs start at the Lab's default knob state, [0, 2, 0, 0.06], pulled
 * into the pattern's ranges: where a new Lab project's knobs sit. A paste
 * into a Lab already open does not reset them. It pulls whatever the knobs
 * were into the new ranges, so a freshly opened Lab, holding its first
 * preset's (0, 2, 10, 2), lands K3 near 10 and K4 near its top. That is why
 * study.ts looks at every knob across its whole range.
 */
import fs from "node:fs";
import path from "node:path";

import { applyKnobEntries, defaultKnobState } from "@/lib/lab/annotations";
import { LabEngine } from "@/lib/lab/engine";
import { codeLayerFromSource } from "@/lib/lab/store/shared";
import type { CodeLayer } from "@/lib/lab/types";
import { parseKnobsAnnotation } from "@/lib/pattern/knobs";
import { DEFAULT_MATRIX, type MatrixSize } from "@/lib/pattern/matrix";

export const STUDY = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const PATTERNS = path.join(STUDY, "patterns");

export type Knob = { name: string; min: number; max: number };

export type Pattern = {
  slug: string;
  file: string;
  code: string;
  title: string;
  family: string;
  idea: string;
  knobs: Knob[];
  /** The Lab's default knob state pulled into this pattern's ranges. */
  start: number[];
  layer: CodeLayer;
  matrix: MatrixSize;
};

const header = (code: string, key: string) =>
  code.match(new RegExp(`^//[ \\t]*${key}:[ \\t]*(.+)$`, "m"))?.[1].trim() ?? "";

export function loadPattern(slug: string): Pattern {
  const file = path.join(PATTERNS, `${slug}.js`);
  const code = fs.readFileSync(file, "utf8");
  const { layer, matrix, knobEntries } = codeLayerFromSource(code, slug);
  const state = knobEntries ? applyKnobEntries(knobEntries, defaultKnobState()) : defaultKnobState();
  const entries = parseKnobsAnnotation(layer.code) ?? [null, null, null, null];
  return {
    slug,
    file,
    code,
    title: header(code, "Title") || slug,
    family: header(code, "Family"),
    idea: header(code, "Idea"),
    knobs: entries.map((entry, i) => entry ?? { name: state.labels[i], min: state.ranges[i][0], max: state.ranges[i][1] }),
    start: state.knobs,
    layer,
    matrix: matrix ?? DEFAULT_MATRIX,
  };
}

export function listPatterns(): string[] {
  return fs
    .readdirSync(PATTERNS)
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.slice(0, -3))
    .sort();
}

// Patterns that scatter with Math.random() would measure differently on every
// run, and the shots would never match the page twice. A seeded generator
// stands in while a run lasts; the page itself keeps the real one.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type Frame = { rgb: Uint8Array; t: number };

export type RunOptions = {
  knobs: number[];
  seconds: number;
  fps?: number;
  /** Called with each frame's RGB (a fresh copy) once `from` seconds have passed. */
  onFrame?: (frame: Frame) => void;
  from?: number;
  /** Knob presses: [seconds, knob index]. */
  presses?: [number, number][];
};

export type RunResult = { error: string | null; rendered: number; ms: number };

/** One fresh engine, the Lab's 30 fps clock, the knobs held where given. */
export function run(pattern: Pattern, options: RunOptions): RunResult {
  const fps = options.fps ?? 30;
  const dt = 1 / fps;
  const engine = new LabEngine();
  const project = {
    matrix: pattern.matrix,
    layers: [pattern.layer],
    activeLayerId: pattern.layer.id,
    knobs: options.knobs,
    ranges: pattern.knobs.map((k): [number, number] => [k.min, k.max]),
  };
  const random = Math.random;
  Math.random = mulberry32(hash(pattern.slug));
  const count = Math.round(options.seconds * fps);
  const pixels = pattern.matrix.width * pattern.matrix.height;
  // Each press lands on the frame whose time is nearest it. Comparing times
  // instead dropped a press at 0.5 s to float rounding.
  const presses = (options.presses ?? []).map(([at, knob]) => [Math.max(0, Math.round(at * fps) - 1), knob]);
  let time = 0;
  let ms = 0;
  try {
    for (let i = 0; i < count; i++) {
      time += dt;
      for (const [frame, knob] of presses) if (frame === i) engine.pressButton(knob);
      const started = performance.now();
      const frame = engine.render(project, dt, time);
      ms += performance.now() - started;
      for (const [frame, knob] of presses) if (frame === i) engine.releaseButton(knob);
      const error = engine.errors.get(pattern.layer.id);
      if (error) return { error, rendered: i, ms };
      if (options.onFrame && time >= (options.from ?? 0) - 1e-9) {
        const rgb = new Uint8Array(pixels * 3);
        for (let p = 0; p < pixels; p++) {
          // Pixels a pattern never wrote are clear, and a clear LED is dark.
          const a = frame.data[p * 4 + 3] / 255;
          rgb[p * 3] = frame.data[p * 4] * a;
          rgb[p * 3 + 1] = frame.data[p * 4 + 1] * a;
          rgb[p * 3 + 2] = frame.data[p * 4 + 2] * a;
        }
        options.onFrame({ rgb, t: time });
      }
    }
  } finally {
    Math.random = random;
  }
  return { error: null, rendered: count, ms: ms / Math.max(1, count) };
}
