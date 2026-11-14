/**
 * The script of reference.html (sheet.ts bundles it with LabEngine, the Lab
 * preview's engine). Every <canvas data-play="slug"> shows that pattern as the
 * panel would, round LEDs drawn over the frame. Canvases that ask for the same
 * pattern at the same knobs share one engine. Only runners with a canvas on
 * screen step, on the Lab's 30 fps clock, so a sheet with a dozen panels on it
 * plays slower on a weak machine instead of locking the page.
 *
 * A tile's sliders (data-knob-for, data-knob) turn that tile's runner's knobs.
 */
import { LabEngine, type EngineFrame } from "../../web/src/lib/lab/engine";
import type { CodeLayer } from "../../web/src/lib/lab/types";

import { panel } from "./led";

type Knob = { name: string; min: number; max: number };
type Entry = { slug: string; title: string; layer: CodeLayer; matrix: { width: number; height: number }; knobs: Knob[]; start: number[] };

const data = JSON.parse(document.getElementById("sheet-data")!.textContent!) as { patterns: Entry[] };
const bySlug = new Map(data.patterns.map((p) => [p.slug, p]));

const STEP = 1 / 30;
const BUDGET_MS = 12;
// Each canvas is drawn at a whole number of device pixels per LED, worked out
// from how large it shows, so the browser never shrinks a drawing of LED
// discs: a 4 px disc grid scaled to 1.2 px an LED beats against the screen's
// pixels into a red and black check. Under 3 device pixels an LED is a plain
// square; from 3 up it is a disc, as on the panel.
const MAX_PITCH = 6;

type Target = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; visible: boolean; image: ImageData | null; pitch: number };
type Runner = { entry: Entry; knobs: number[]; engine: LabEngine | null; time: number; owed: number; targets: Target[]; broken: boolean };

const runners = new Map<string, Runner>();
const byCanvas = new Map<Element, { runner: Runner; target: Target }>();

// How much of each pixel in one LED's square the disc covers (0.84 of the
// pitch across), worked out once per pitch.
const covers = new Map<number, Float32Array>();
function cover(pitch: number) {
  let out = covers.get(pitch);
  if (out) return out;
  out = new Float32Array(pitch * pitch);
  if (pitch < 3) out.fill(1);
  else {
    const radius = pitch * 0.42;
    const SUB = 4;
    for (let v = 0; v < pitch; v++)
      for (let u = 0; u < pitch; u++) {
        let inside = 0;
        for (let sy = 0; sy < SUB; sy++)
          for (let sx = 0; sx < SUB; sx++) {
            const dx = u + (sx + 0.5) / SUB - pitch / 2;
            const dy = v + (sy + 0.5) / SUB - pitch / 2;
            if (dx * dx + dy * dy <= radius * radius) inside++;
          }
        out[v * pitch + u] = inside / (SUB * SUB);
      }
  }
  covers.set(pitch, out);
  return out;
}

function fit(t: Target, w: number, h: number) {
  const across = (t.canvas.clientWidth * (window.devicePixelRatio || 1)) / w;
  const pitch = Math.max(1, Math.min(MAX_PITCH, Math.round(across) || 1));
  if (pitch === t.pitch && t.canvas.width === w * pitch) return;
  t.pitch = pitch;
  t.canvas.width = w * pitch;
  t.canvas.height = h * pitch;
  t.image = null;
}

function draw(frame: EngineFrame, t: Target, w: number, h: number) {
  const PITCH = t.pitch;
  if (!t.image || t.image.width !== w * PITCH) t.image = t.ctx.createImageData(w * PITCH, h * PITCH);
  const COVER = cover(PITCH);
  const src = frame.data;
  const dst = t.image.data;
  const row = w * PITCH * 4;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const a = src[p + 3] / 255;
      const [cr, cg, cb] = panel(src[p] * a, src[p + 1] * a, src[p + 2] * a);
      const r = Math.max(cr, 14);
      const g = Math.max(cg, 14);
      const b = Math.max(cb, 14);
      for (let v = 0; v < PITCH; v++)
        for (let u = 0; u < PITCH; u++) {
          const c = COVER[v * PITCH + u];
          const o = (y * PITCH + v) * row + (x * PITCH + u) * 4;
          dst[o] = r * c + 6 * (1 - c);
          dst[o + 1] = g * c + 6 * (1 - c);
          dst[o + 2] = b * c + 6 * (1 - c);
          dst[o + 3] = 255;
        }
    }
  t.ctx.putImageData(t.image, 0, 0);
}

function step(r: Runner) {
  if (!r.engine) r.engine = new LabEngine();
  r.time += STEP;
  const frame = r.engine.render(
    {
      matrix: r.entry.matrix,
      layers: [r.entry.layer],
      activeLayerId: r.entry.layer.id,
      knobs: r.knobs,
      ranges: r.entry.knobs.map((k): [number, number] => [k.min, k.max]),
    },
    STEP,
    r.time,
  );
  const error = r.engine.errors.get(r.entry.layer.id);
  if (error && !r.broken) {
    r.broken = true;
    for (const t of r.targets) t.canvas.closest("[data-tile]")?.classList.add("broken");
    console.warn(`${r.entry.slug}: ${error}`);
  }
  for (const t of r.targets) if (t.visible) draw(frame, t, r.entry.matrix.width, r.entry.matrix.height);
}

const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const hit = byCanvas.get(e.target);
      if (hit) hit.target.visible = e.isIntersecting;
    }
  },
  { rootMargin: "120px" },
);

const sized = new ResizeObserver((entries) => {
  for (const e of entries) {
    const hit = byCanvas.get(e.target);
    if (hit) fit(hit.target, hit.runner.entry.matrix.width, hit.runner.entry.matrix.height);
  }
});

for (const canvas of document.querySelectorAll<HTMLCanvasElement>("canvas[data-play]")) {
  const entry = bySlug.get(canvas.dataset.play!);
  if (!entry) continue;
  const knobs = canvas.dataset.knobs ? canvas.dataset.knobs.split(",").map(Number) : [...entry.start];
  // A tile with sliders gets a runner of its own, so turning it moves only it.
  const key = canvas.dataset.own ? `${entry.slug}#${canvas.dataset.own}` : `${entry.slug}|${knobs.join(",")}`;
  let runner = runners.get(key);
  if (!runner) {
    runner = { entry, knobs, engine: null, time: Number(canvas.dataset.offset ?? 0), owed: STEP, targets: [], broken: false };
    runners.set(key, runner);
  }
  const target: Target = { canvas, ctx: canvas.getContext("2d")!, visible: false, image: null, pitch: 0 };
  fit(target, entry.matrix.width, entry.matrix.height);
  runner.targets.push(target);
  byCanvas.set(canvas, { runner, target });
  seen.observe(canvas);
  sized.observe(canvas);
}

for (const input of document.querySelectorAll<HTMLInputElement>("input[data-knob-for]")) {
  const runner = runners.get(input.dataset.knobFor!);
  if (!runner) continue;
  const i = Number(input.dataset.knob);
  const out = input.parentElement?.querySelector("output");
  const show = () => {
    runner.knobs[i] = Number(input.value);
    if (out) out.textContent = Number(Number(input.value).toPrecision(3)).toString();
  };
  input.addEventListener("input", show);
  show();
}

let last = performance.now();
let cursor = 0;
function loop(now: number) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  const started = performance.now();
  const list = [...runners.values()].filter((r) => r.targets.some((t) => t.visible));
  for (const r of list) r.owed = Math.min(r.owed + dt, STEP * 2);
  for (let k = 0; k < list.length; k++) {
    const r = list[(cursor + k) % list.length];
    if (r.owed < STEP) continue;
    step(r);
    r.owed -= STEP;
    if (performance.now() - started > BUDGET_MS) {
      cursor = (cursor + k + 1) % list.length;
      break;
    }
  }
  requestAnimationFrame(loop);
}
document.documentElement.classList.add("live");
requestAnimationFrame(loop);
