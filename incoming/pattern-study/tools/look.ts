/**
 * Pictures of one pattern to look at while crafting it and to show judges.
 * They go to a folder outside the study; the study keeps no pictures apart
 * from the one sheet a craft round commits (ROUND.md). From web/:
 *
 *   npx tsx ../incoming/pattern-study/tools/look.ts <slug>
 *   ... look.ts <slug> --file /tmp/x.js        a pattern from any file, under this slug's seed
 *   ... look.ts <slug> --pair /tmp/before.js   and the A/B pictures against that version
 *   ... look.ts <slug> --at 3.5                the stills at 3.5 s instead of 2 (snapped to 1/30 s)
 *   ... look.ts <slug> --knobs 0.2,1,3,0       the stills and the loop at these knobs
 *   ... look.ts <slug> --crop 16,20,24,24      and crop.png, crop-led.png: that box (x, y, width, height)
 *   ... look.ts <slug> --out /tmp/look/a       where to write (default <tmp>/pattern-look/<slug>[-vs-<pair>])
 *
 * Two truths. zoom.png and the pictures built on it show the frame the way the
 * Lab and the page show it. led.png shows it the way the panel does: the
 * firmware raises saturation by 1.62 around Rec. 601 luma (PF_POST_PIXEL),
 * then each channel goes through the CIE1931 table to an 8-bit PWM step,
 * rounded to nearest (hub75/VENDORED.md), so the dark end has a handful of
 * steps and a dark neutral can come out tinted. The browser does neither.
 *
 * Coordinates are LEDs, x 0-63 from the left and y 0-127 from the top. The
 * pictures marked "ruled" carry a margin with every eighth column and row
 * numbered; in a pair, each half has its own.
 *
 * What it writes:
 *   zoom.png      one frame at 8x with a dark line between LEDs, ruled
 *   led.png       the same frame as the panel shows it, round LEDs at a 6 px pitch, ruled
 *   checks.png    left, the silhouette as the panel shows it: white where the brightest
 *                 channel is 48 or more, grey 25 to 47, black below; right, each lit LED
 *                 by that channel: magenta 1 to 19 (off on the panel), yellow 20 to 47
 *                 (barely there), grey 48 and up. Both at 4x, ruled
 *   gray.png      Rec. 709 luma at 4x, and the same cut into four levels, ruled
 *   small.png     the frame at 1x, at 2x, and averaged to a quarter (16 x 32) at 8x
 *   palette.png   the colours the lit LEDs use, most used first up to 256: greys in their
 *                 own row, the rest by 30 degree hue bands, each by lightness
 *   strip.png     twelve frames a third of a second apart from --at, at 2x, two rows of six
 *   motion.png    over ten seconds from --at: red where an LED changed, grey where a lit one did not, at 4x, ruled
 *   knobs.png     a row per knob, its range at 0, 1/4, 1/2, 3/4 and 1 with the others held, at 2x
 *   sheet.png     led at a 5 px pitch, zoom at 4x, small, the strip and the knob rows, for a phone
 *   crop.png      with --crop, the box ruled and as large as fits 1568 px; crop-led.png the same as the panel shows it
 * and with --pair, this version (A) beside the other (B), each drawn at its own start knobs
 * unless --knobs is given:
 *   pair-zoom.png, pair-led.png    A left, B right, each half ruled
 *   pair-strip.png                 each side's twelve frames in two columns of six, A left
 *   pair-knobs.png                 each knob at its minimum, start and maximum, A left
 *   swap-*.png                     the same four with B left
 *   same-a-*.png, same-b-*.png     the same four with A on both sides, and with B on both sides
 *   diff.png                       A's still at 4x, magenta wherever A and B differ in the still,
 *                                  across the ten seconds or at any knob stop, ruled
 * Every picture a judge reads stays within 1568 px on the long side and 1.15 million pixels;
 * sheet.png is for a phone and is larger.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

import { loadPattern, loadPatternFile, run, type Pattern } from "./lab";

type Image = { w: number; h: number; px: Uint8Array };
type Frame = Uint8Array;
type RGB = [number, number, number];

const FPS = 30;
const LOOP = 10;
const FLAGS = ["--file", "--pair", "--at", "--knobs", "--crop", "--out"];
const args = process.argv.slice(2);
const slug = args[0];
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (message: string): never => {
  console.log(message);
  process.exit(1);
};
if (!slug || slug.startsWith("--")) fail(`usage: look.ts <slug> ${FLAGS.map((f) => `[${f} …]`).join(" ")}`);
for (const flag of args.filter((a) => a.startsWith("--"))) if (!FLAGS.includes(flag)) fail(`unknown flag ${flag}`);

const file = option("--file");
const pattern: Pattern = file ? loadPatternFile(path.resolve(file), slug) : loadPattern(slug);
const pairFile = option("--pair");
const other: Pattern | null = pairFile ? loadPatternFile(path.resolve(pairFile), slug) : null;
const atAsked = Number(option("--at") ?? 2);
if (!Number.isFinite(atAsked) || atAsked < 1 / FPS) fail("--at takes a time in seconds, at least 1/30");
const at = Math.round(atAsked * FPS) / FPS;
const knobsGiven = option("--knobs")?.split(",").map(Number);
if (knobsGiven && (knobsGiven.length !== 4 || knobsGiven.some((k) => !Number.isFinite(k)))) fail("--knobs takes four numbers");
const knobs = knobsGiven ?? pattern.start;
const theirKnobs = knobsGiven ?? other?.start ?? knobs;
const base = file ? `${slug}-${path.basename(file, ".js")}` : slug;
const out = path.resolve(option("--out") ?? path.join(os.tmpdir(), "pattern-look", pairFile ? `${base}-vs-${path.basename(pairFile, ".js")}` : base));
const { width: W, height: H } = pattern.matrix;
if (other && (other.matrix.width !== W || other.matrix.height !== H)) fail("--pair is not the same size of panel");

function frames(p: Pattern, knobsAt: number[], from: number, seconds: number): Frame[] {
  const got: Frame[] = [];
  const result = run(p, { knobs: knobsAt, seconds: from + seconds, from, onFrame: (f) => got.push(f.rgb) });
  if (result.error) fail(`${p.file} throws: ${result.error.split("\n")[0]}`);
  return got;
}
const still = (p: Pattern, knobsAt: number[]) => frames(p, knobsAt, at, 0).at(-1) ?? fail(`no frame at ${at} s`);
const top = (f: Frame, i: number) => Math.max(f[i], f[i + 1], f[i + 2]);
const same = (a: Frame, b: Frame, i: number) => a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2];

// ---- pictures -------------------------------------------------------------

const image = (w: number, h: number, grey = 0): Image => ({ w, h, px: new Uint8Array(w * h * 3).fill(grey) });

function set(img: Image, x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 3;
  img.px[i] = r;
  img.px[i + 1] = g;
  img.px[i + 2] = b;
}

function blit(dst: Image, src: Image, x0: number, y0: number) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 3;
      set(dst, x0 + x, y0 + y, src.px[i], src.px[i + 1], src.px[i + 2]);
    }
}

/** Any per-LED colour at `scale`; with `grid`, each LED's last row and column darker. */
function cells(colour: (x: number, y: number) => RGB, w: number, h: number, scale: number, grid: boolean): Image {
  const img = image(w * scale, h * scale);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = colour(x, y);
      for (let v = 0; v < scale; v++)
        for (let u = 0; u < scale; u++) {
          const edge = grid && scale > 2 && (u === scale - 1 || v === scale - 1);
          if (!edge) set(img, x * scale + u, y * scale + v, r, g, b);
          else if (r + g + b === 0) set(img, x * scale + u, y * scale + v, 26, 26, 26);
          else set(img, x * scale + u, y * scale + v, r * 0.55, g * 0.55, b * 0.55);
        }
    }
  return img;
}

const rgbAt = (f: Frame, x0 = 0, y0 = 0) => (x: number, y: number): RGB => {
  const i = ((y0 + y) * W + x0 + x) * 3;
  return [f[i], f[i + 1], f[i + 2]];
};
const pixels = (f: Frame, scale: number, grid = false) => cells(rgbAt(f), W, H, scale, grid);

// The panel: PF_POST_PIXEL's saturation boost, then CIE1931 to a rounded 8-bit
// PWM step, shown back on a screen as the lightness that step gives.
const cie = (v: number) => {
  const l = (v / 255) * 100;
  return l <= 8 ? l / 903.3 : ((l + 16) / 116) ** 3;
};
const lightness = (y: number) => ((y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16) / 100) * 255;
const STEP = Array.from({ length: 256 }, (_, v) => lightness(Math.min(255, Math.round((cie(v) * 65535) / 256)) / 255));
function panel(r: number, g: number, b: number): RGB {
  const y = (r * 77 + g * 150 + b * 29) >> 8;
  const boost = (c: number) => Math.max(0, Math.min(255, y + Math.floor(((c - y) * 415) / 256)));
  return [STEP[boost(r)], STEP[boost(g)], STEP[boost(b)]];
}

/** The frame as the panel shows it: round LEDs at `pitch`, an LED that is off still faintly there. */
function leds(f: Frame, pitch: number, x0 = 0, y0 = 0, w = W, h = H): Image {
  const img = image(w * pitch, h * pitch);
  const radius = pitch * 0.42;
  const SUB = 4;
  const cover: number[] = [];
  for (let v = 0; v < pitch; v++)
    for (let u = 0; u < pitch; u++) {
      let inside = 0;
      for (let sy = 0; sy < SUB; sy++)
        for (let sx = 0; sx < SUB; sx++) {
          const dx = u + (sx + 0.5) / SUB - pitch / 2;
          const dy = v + (sy + 0.5) / SUB - pitch / 2;
          if (dx * dx + dy * dy <= radius * radius) inside++;
        }
      cover.push(inside / (SUB * SUB));
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * W + x0 + x) * 3;
      const [r, g, b] = panel(f[i], f[i + 1], f[i + 2]).map((c) => Math.max(c, 14));
      for (let v = 0; v < pitch; v++)
        for (let u = 0; u < pitch; u++) {
          const c = cover[v * pitch + u];
          set(img, x * pitch + u, y * pitch + v, r * c, g * c, b * c);
        }
    }
  return img;
}

function row(images: Image[], gap: number, grey = 40): Image {
  const img = image(images.reduce((w, i) => w + i.w, 0) + gap * (images.length - 1), Math.max(...images.map((i) => i.h)), grey);
  let x = 0;
  for (const part of images) {
    blit(img, part, x, 0);
    x += part.w + gap;
  }
  return img;
}

function column(images: Image[], gap: number, grey = 40): Image {
  const img = image(Math.max(...images.map((i) => i.w)), images.reduce((h, i) => h + i.h, 0) + gap * (images.length - 1), grey);
  let y = 0;
  for (const part of images) {
    blit(img, part, 0, y);
    y += part.h + gap;
  }
  return img;
}

function framed(img: Image, pad: number, grey = 18): Image {
  const f = image(img.w + pad * 2, img.h + pad * 2, grey);
  blit(f, img, pad, pad);
  return f;
}

// A 3 by 5 pixel hand for knob names and coordinates.
const GLYPHS: Record<string, string[]> = {
  K: ["1.1", "1.1", "11.", "1.1", "1.1"],
  "0": ["111", "1.1", "1.1", "1.1", "111"],
  "1": [".1.", "11.", ".1.", ".1.", "111"],
  "2": ["11.", "..1", ".1.", "1..", "111"],
  "3": ["11.", "..1", ".1.", "..1", "11."],
  "4": ["1.1", "1.1", "111", "..1", "..1"],
  "5": ["111", "1..", "11.", "..1", "11."],
  "6": [".11", "1..", "111", "1.1", "111"],
  "7": ["111", "..1", ".1.", ".1.", ".1."],
  "8": ["111", "1.1", "111", "1.1", "111"],
  "9": ["111", "1.1", "111", "..1", "11."],
};
function text(img: Image, s: string, x0: number, y0: number, scale: number) {
  [...s].forEach((ch, n) =>
    GLYPHS[ch]?.forEach((line, y) =>
      [...line].forEach((on, x) => {
        if (on !== "1") return;
        for (let v = 0; v < scale; v++) for (let u = 0; u < scale; u++) set(img, x0 + (n * 4 + x) * scale + u, y0 + y * scale + v, 200, 200, 200);
      }),
    ),
  );
}
function label(s: string, scale: number, grey = 40): Image {
  const img = image(s.length * 4 * scale, 5 * scale, grey);
  text(img, s, 0, 0, scale);
  return img;
}

/** A picture of LEDs at `pitch` px each, with every eighth column and row numbered in the margin. */
function ruled(img: Image, pitch: number, x0 = 0, y0 = 0): Image {
  const left = 28;
  const above = 16;
  const out = image(left + img.w, above + img.h, 18);
  blit(out, img, left, above);
  const w = Math.round(img.w / pitch);
  const h = Math.round(img.h / pitch);
  for (let x = Math.ceil(x0 / 8) * 8; x < x0 + w; x += 8) text(out, String(x), left + (x - x0) * pitch, 2, 2);
  for (let y = Math.ceil(y0 / 8) * 8; y < y0 + h; y += 8) text(out, String(y), 2, above + (y - y0) * pitch, 2);
  return out;
}

function checks(f: Frame): Image {
  const lit = cells((x, y) => {
    const t = top(f, (y * W + x) * 3);
    return t >= 48 ? [255, 255, 255] : t > 24 ? [110, 110, 110] : [0, 0, 0];
  }, W, H, 4, false);
  const level = cells((x, y) => {
    const t = top(f, (y * W + x) * 3);
    return t === 0 ? [0, 0, 0] : t < 20 ? [255, 0, 255] : t < 48 ? [230, 200, 40] : [90, 90, 90];
  }, W, H, 4, false);
  return row([ruled(lit, 4), ruled(level, 4)], 8);
}

const luma = (f: Frame, i: number) => 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
function gray(f: Frame): Image {
  const plain = cells((x, y) => {
    const l = luma(f, (y * W + x) * 3);
    return [l, l, l];
  }, W, H, 4, false);
  const LEVELS = [0, 85, 170, 255];
  const cut = cells((x, y) => {
    const l = LEVELS[Math.min(3, Math.floor(luma(f, (y * W + x) * 3) / 64))];
    return [l, l, l];
  }, W, H, 4, false);
  return row([ruled(plain, 4), ruled(cut, 4)], 8);
}

function small(f: Frame): Image {
  const quarter = cells(
    (x, y) => {
      const sum = [0, 0, 0];
      for (let v = 0; v < 4; v++)
        for (let u = 0; u < 4; u++) {
          const i = ((y * 4 + v) * W + x * 4 + u) * 3;
          for (let c = 0; c < 3; c++) sum[c] += f[i + c];
        }
      return [sum[0] / 16, sum[1] / 16, sum[2] / 16];
    },
    W / 4,
    H / 4,
    8,
    false,
  );
  return row([pixels(f, 1), pixels(f, 2), quarter], 16, 18);
}

function colours(f: Frame) {
  const count = new Map<number, number>();
  for (let p = 0; p < W * H; p++) {
    const i = p * 3;
    if (top(f, i) <= 24) continue;
    const key = (f[i] << 16) | (f[i + 1] << 8) | f[i + 2];
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return count;
}
function band(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d < 0.15 * max) return 99;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60 + 360) % 360) / 30) % 12;
}
function palette(count: Map<number, number>): Image {
  const kept = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256);
  const rows = new Map<number, RGB[]>();
  for (const [k] of kept) {
    const c: RGB = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
    const key = band(...c);
    rows.set(key, [...(rows.get(key) ?? []), c]);
  }
  const PER = 16;
  const SIDE = 24;
  const lines: RGB[][] = [];
  for (const key of [...rows.keys()].sort((a, b) => a - b)) {
    const list = rows.get(key)!.sort((a, b) => a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722 - (b[0] * 0.2126 + b[1] * 0.7152 + b[2] * 0.0722));
    for (let i = 0; i < list.length; i += PER) lines.push(list.slice(i, i + PER));
  }
  const img = image(PER * (SIDE + 4), Math.max(1, lines.length) * (SIDE + 4), 18);
  lines.forEach((line, y) =>
    line.forEach(([r, g, b], x) => {
      for (let v = 0; v < SIDE; v++) for (let u = 0; u < SIDE; u++) set(img, x * (SIDE + 4) + u, y * (SIDE + 4) + v, r, g, b);
    }),
  );
  return img;
}

/** Over a run of frames: which LEDs changed, the share of lit ones that did, one-frame blips, and small events. */
function motion(run: Frame[]) {
  const changed = new Uint8Array(W * H);
  const lit = new Uint8Array(W * H);
  let flicker = 0;
  const perFrame: number[] = [0];
  for (let t = 0; t < run.length; t++) {
    let n = 0;
    for (let p = 0; p < W * H; p++) {
      const i = p * 3;
      if (top(run[t], i) > 24) lit[p] = 1;
      if (t > 0 && !same(run[t], run[t - 1], i)) {
        changed[p] = 1;
        n++;
        if (t + 1 < run.length && same(run[t + 1], run[t - 1], i)) flicker++;
      }
    }
    if (t > 0) perFrame.push(n);
  }
  let moved = 0;
  let litCount = 0;
  for (let p = 0; p < W * H; p++) {
    litCount += lit[p];
    if (changed[p] && lit[p]) moved++;
  }
  // Small events (blinks, glints): runs of frames changing 1 to 60 LEDs.
  const events: string[] = [];
  for (let t = 1; t < perFrame.length; t++)
    if (perFrame[t] > 0 && perFrame[t] <= 60 && !(perFrame[t - 1] > 0 && perFrame[t - 1] <= 60)) events.push((at + t / FPS).toFixed(2));
  const map = ruled(cells((x, y) => (changed[y * W + x] ? [230, 40, 40] : lit[y * W + x] ? [90, 90, 90] : [0, 0, 0]), W, H, 4, false), 4);
  return { map, moved: litCount ? moved / litCount : 0, flicker, events };
}

/** Twelve frames a third of a second apart: two rows of six, or for a pair, two columns of six. */
function strip(run: Frame[], upright = false): Image {
  const pick = (n: number) => run[Math.min(n * 10, run.length - 1)];
  if (upright) return column(Array.from({ length: 6 }, (_, n) => row([pixels(pick(n * 2), 2), pixels(pick(n * 2 + 1), 2)], 4)), 4);
  const half = (from: number) => row(Array.from({ length: 6 }, (_, n) => pixels(pick(from + n), 2)), 4);
  return column([half(0), half(6)], 4);
}

/** A knob's position at fraction u of its range. */
const stop = (p: Pattern, k: number, u: number) => p.knobs[k].min + (p.knobs[k].max - p.knobs[k].min) * u;
const startFraction = (p: Pattern, held: number[], k: number) => (p.knobs[k].max === p.knobs[k].min ? 0 : (held[k] - p.knobs[k].min) / (p.knobs[k].max - p.knobs[k].min));

function knobStills(p: Pattern, held: number[], fractions: (k: number) => number[]) {
  return p.knobs.map((_, k) =>
    fractions(k).map((u) => {
      const knobsAt = [...held];
      knobsAt[k] = stop(p, k, u);
      return still(p, knobsAt);
    }),
  );
}
function knobRows(stills: Frame[][], scale: number): Image {
  return column(stills.map((list, k) => row([label(`K${k + 1}`, 3), ...list.map((f) => pixels(f, scale))], 4)), 8);
}

// ---- PNG -------------------------------------------------------------------

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function png(img: Image): Buffer {
  const raw = Buffer.alloc((img.w * 3 + 1) * img.h);
  for (let y = 0; y < img.h; y++) Buffer.from(img.px.buffer, img.px.byteOffset + y * img.w * 3, img.w * 3).copy(raw, y * (img.w * 3 + 1) + 1);
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(img.w, 0);
  head.writeUInt32BE(img.h, 4);
  head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---- run -------------------------------------------------------------------

// A folder this tool wrote before holds pictures from that run; clear the names
// it writes, and only those, so nothing left over passes for this run's.
const NAMES = ["zoom", "led", "checks", "gray", "small", "palette", "strip", "motion", "knobs", "sheet", "crop", "crop-led", "diff"];
for (const side of ["pair", "swap", "same-a", "same-b"]) for (const kind of ["zoom", "led", "strip", "knobs"]) NAMES.push(`${side}-${kind}`);
fs.mkdirSync(out, { recursive: true });
for (const name of NAMES) fs.rmSync(path.join(out, `${name}.png`), { force: true });
const written: string[] = [];
const write = (name: string, img: Image) => {
  fs.writeFileSync(path.join(out, name), png(img));
  written.push(`${name} ${img.w}x${img.h}`);
};

const frame = still(pattern, knobs);
const loop = frames(pattern, knobs, at, LOOP);
const used = colours(frame);
const moves = motion(loop);
const STOPS = [0, 0.25, 0.5, 0.75, 1];
const knobFrames = knobStills(pattern, knobs, () => STOPS);
const loopStrip = strip(loop);

write("zoom.png", ruled(pixels(frame, 8, true), 8));
write("led.png", ruled(leds(frame, 6), 6));
write("checks.png", checks(frame));
write("gray.png", gray(frame));
write("small.png", small(frame));
write("palette.png", palette(used));
write("strip.png", loopStrip);
write("motion.png", moves.map);
write("knobs.png", knobRows(knobFrames, 2));

const crop = option("--crop")?.split(",").map(Number);
if (crop) {
  const [x, y, w, h] = crop;
  if (crop.length !== 4 || crop.some((n) => !Number.isInteger(n)) || x < 0 || y < 0 || w < 1 || h < 1 || x + w > W || y + h > H) fail(`--crop takes x,y,w,h inside ${W}x${H}`);
  const scale = Math.max(2, Math.min(16, Math.floor(1500 / Math.max(w, h))));
  write("crop.png", ruled(cells(rgbAt(frame, x, y), w, h, scale, true), scale, x, y));
  write("crop-led.png", ruled(leds(frame, scale, x, y, w, h), scale, x, y));
}

const sheet = column([row([leds(frame, 5), pixels(frame, 4, true), column([pixels(frame, 1), pixels(frame, 2)], 16, 18)], 16, 18), loopStrip, knobRows(knobFrames, 2)], 24, 18);
write("sheet.png", framed(sheet, 16));

let litCount = 0;
let dim = 0;
let faint = 0;
let nearWhite = 0;
for (let p = 0; p < W * H; p++) {
  const i = p * 3;
  const t = top(frame, i);
  if (t > 24) litCount++;
  if (t > 0 && t < 20) dim++;
  else if (t >= 20 && t < 48) faint++;
  if (Math.min(frame[i], frame[i + 1], frame[i + 2]) >= 230) nearWhite++;
}
console.log(`${pattern.title}: knobs ${knobs.map((k) => +k.toFixed(3)).join(", ")} at ${at.toFixed(3)} s → ${out}`);
console.log(
  `  lit ${litCount} LEDs (${((litCount / (W * H)) * 100).toFixed(1)}%) · colours ${used.size}${used.size > 256 ? " (palette.png shows the 256 most used)" : ""} · off on the panel (1-19) ${dim} · barely there (20-47) ${faint} · near white ${nearWhite}`,
);
console.log(`  over ${LOOP} s: ${(moves.moved * 100).toFixed(1)}% of lit LEDs change · one-frame blips ${moves.flicker} · small events at ${moves.events.slice(0, 12).join(", ") || "none"}`);

if (other) {
  const theirs = still(other, theirKnobs);
  const theirLoop = frames(other, theirKnobs, at, LOOP);
  const fractions = (p: Pattern, held: number[]) => (k: number) => [0, startFraction(p, held, k), 1];
  const ours3 = knobStills(pattern, knobs, fractions(pattern, knobs));
  const theirs3 = knobStills(other, theirKnobs, fractions(other, theirKnobs));
  const theirKnobFrames = knobStills(other, theirKnobs, () => STOPS);

  const views = (f: Frame, run: Frame[], k3: Frame[][]) => ({
    zoom: ruled(pixels(f, 6, true), 6),
    led: ruled(leds(f, 5), 5),
    strip: strip(run, true),
    knobs: knobRows(k3, 2),
  });
  const a = views(frame, loop, ours3);
  const b = views(theirs, theirLoop, theirs3);
  for (const kind of ["zoom", "led", "strip", "knobs"] as const) {
    const gap = kind === "strip" ? 16 : 12;
    write(`pair-${kind}.png`, row([a[kind], b[kind]], gap, 90));
    write(`swap-${kind}.png`, row([b[kind], a[kind]], gap, 90));
    write(`same-a-${kind}.png`, row([a[kind], a[kind]], gap, 90));
    write(`same-b-${kind}.png`, row([b[kind], b[kind]], gap, 90));
  }

  // Where A and B differ: the still, every frame of the ten seconds, every knob stop.
  const mask = new Uint8Array(W * H);
  const tally = { still: 0, loop: 0, knobs: 0 };
  const compare = (x: Frame, y: Frame, kind: keyof typeof tally) => {
    for (let p = 0; p < W * H; p++)
      if (!same(x, y, p * 3)) {
        if (!(mask[p] & (1 << ["still", "loop", "knobs"].indexOf(kind)))) tally[kind]++;
        mask[p] |= 1 << ["still", "loop", "knobs"].indexOf(kind);
      }
  };
  compare(frame, theirs, "still");
  for (let t = 0; t < Math.min(loop.length, theirLoop.length); t++) compare(loop[t], theirLoop[t], "loop");
  knobFrames.forEach((list, k) => list.forEach((f, s) => compare(f, theirKnobFrames[k]?.[s] ?? f, "knobs")));
  const box = { x0: W, y0: H, x1: -1, y1: -1 };
  for (let p = 0; p < W * H; p++)
    if (mask[p]) {
      const x = p % W;
      const y = Math.floor(p / W);
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
    }
  write(
    "diff.png",
    ruled(
      cells((x, y) => {
        if (mask[y * W + x]) return [255, 0, 255];
        const l = luma(frame, (y * W + x) * 3) * 0.35;
        return [l, l, l];
      }, W, H, 4, false),
      4,
    ),
  );
  const show = (k: number[]) => k.map((v) => +v.toFixed(3)).join(", ");
  console.log(`  A ${path.basename(pattern.file)} at knobs ${show(knobs)} · B ${path.basename(other.file)} at knobs ${show(theirKnobs)}`);
  const ranges = (p: Pattern) => p.knobs.map((k) => `${k.name}=${k.min}..${k.max}`).join(", ");
  if (ranges(pattern) !== ranges(other)) console.log(`  knob ranges differ: A ${ranges(pattern)} / B ${ranges(other)}`);
  console.log(
    `  A and B differ: still ${tally.still} LEDs · over ${LOOP} s ${tally.loop} · at the knob stops ${tally.knobs}` +
      (box.x1 >= 0 ? ` · all inside (${box.x0},${box.y0})-(${box.x1},${box.y1})` : " · nowhere: the two draw the same"),
  );
}
for (const line of written) console.log(`  ${line}`);
