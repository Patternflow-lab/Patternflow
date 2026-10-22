/**
 * Pictures for the pull request: a GIF of the pattern running at the study's
 * start knobs (lab.ts), drawn as LED dots so a pixel-fine texture looks the way it
 * will on the panel, and a sheet of each knob at its minimum, middle and
 * maximum. ffmpeg makes the GIF, sharp the PNG.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type Sharp from "sharp";
import type { OverlayOptions } from "sharp";

import { STUDY, type Frame, type Pattern } from "./lab";

// This folder has no node_modules of its own: sharp is web/'s.
const sharp = createRequire(path.resolve(STUDY, "../../web/package.json"))("sharp") as typeof Sharp;

export const SHOTS = path.join(STUDY, "shots");

/** Each LED becomes a round dot `scale` px apart, with the unlit ones faintly there. */
export function ledLook(rgb: Uint8Array, width: number, height: number, scale: number): Buffer {
  const W = width * scale;
  const H = height * scale;
  const out = Buffer.alloc(W * H * 3);
  const mask = new Float32Array(scale * scale);
  const r = scale * 0.42;
  const c = (scale - 1) / 2;
  for (let y = 0; y < scale; y++)
    for (let x = 0; x < scale; x++) {
      const d = Math.hypot(x - c, y - c);
      // Below 3 px there is no room for a dot and its gap: plain pixels.
      mask[y * scale + x] = scale < 3 ? 1 : Math.max(0, Math.min(1, r - d + 0.5));
    }
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 3;
      const R = Math.max(rgb[i], 16);
      const G = Math.max(rgb[i + 1], 16);
      const B = Math.max(rgb[i + 2], 18);
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const m = mask[y * scale + x];
          if (m <= 0) continue;
          const o = ((py * scale + y) * W + px * scale + x) * 3;
          out[o] = R * m;
          out[o + 1] = G * m;
          out[o + 2] = B * m;
        }
    }
  return out;
}

export function writeGif(file: string, frames: Frame[], width: number, height: number, scale: number, fps: number) {
  const W = width * scale;
  const H = height * scale;
  const raw = Buffer.concat(frames.map((f) => ledLook(f.rgb, width, height, scale)));
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-v", "error", "-y",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-",
      "-filter_complex", "split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none",
      "-loop", "0", file,
    ],
    { input: raw, maxBuffer: 1 << 30 },
  );
  if (ffmpeg.status !== 0) throw new Error(`ffmpeg: ${ffmpeg.stderr.toString()}`);
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const number = (v: number) => `${Number(v.toPrecision(3))}`;

/**
 * Knob sheet: a row per knob at its minimum, middle and maximum, the other
 * three at the study's start knobs.
 */
export async function writeKnobSheet(file: string, pattern: Pattern, rows: Uint8Array[][]) {
  const { width, height } = pattern.matrix;
  const scale = 2;
  const tileW = width * scale;
  const tileH = height * scale;
  const gap = 10;
  const label = 22;
  const top = 36;
  const columns = 3;
  const sheetW = gap + columns * (tileW + gap);
  const sheetH = top + rows.length * (label + tileH + gap);
  const tiles: OverlayOptions[] = [];
  const texts: string[] = [
    `<text x="${gap}" y="25" font-size="19" font-weight="bold" fill="#f2f2f2">${escape(pattern.title)}</text>`,
  ];
  rows.forEach((row, k) => {
    const y = top + k * (label + tileH + gap);
    const knob = pattern.knobs[k];
    row.forEach((rgb, column) => {
      const value = knob.min + ((knob.max - knob.min) * column) / (columns - 1);
      const x = gap + column * (tileW + gap);
      texts.push(`<text x="${x}" y="${y + 16}" font-size="14" fill="#b8b8b8">K${k + 1} ${escape(knob.name)} ${number(value)}</text>`);
      tiles.push({ input: ledLook(rgb, width, height, scale), raw: { width: tileW, height: tileH, channels: 3 }, left: x, top: y + label });
    });
  });
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" font-family="WenQuanYi Zen Hei, DejaVu Sans, sans-serif">${texts.join("")}</svg>`,
  );
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#0b0b0d" } })
    .composite([...tiles, { input: svg, left: 0, top: 0 }])
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 })
    .toFile(file);
}

/** Every pattern's frame at the start knobs, three across, named, for the top of the pull request. */
export async function writeOverview(file: string, items: { pattern: Pattern; rgb: Uint8Array }[]) {
  const scale = 3;
  const { width, height } = items[0].pattern.matrix;
  const tileW = width * scale;
  const tileH = height * scale;
  const gap = 12;
  const label = 26;
  const columns = 3;
  const rows = Math.ceil(items.length / columns);
  const sheetW = gap + columns * (tileW + gap);
  const sheetH = gap + rows * (label + tileH + gap);
  const tiles: OverlayOptions[] = [];
  const texts: string[] = [];
  items.forEach(({ pattern, rgb }, i) => {
    const x = gap + (i % columns) * (tileW + gap);
    const y = gap + Math.floor(i / columns) * (label + tileH + gap);
    texts.push(
      `<text x="${x}" y="${y + 18}" font-size="17" font-weight="bold" fill="#f2f2f2">${escape(pattern.title)}</text>`,
      `<text x="${x + tileW}" y="${y + 18}" font-size="14" fill="#9a9aa6" text-anchor="end">${escape(pattern.family)}</text>`,
    );
    tiles.push({ input: ledLook(rgb, width, height, scale), raw: { width: tileW, height: tileH, channels: 3 }, left: x, top: y + label });
  });
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" font-family="DejaVu Sans, sans-serif">${texts.join("")}</svg>`,
  );
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#0b0b0d" } })
    .composite([...tiles, { input: svg, left: 0, top: 0 }])
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 })
    .toFile(file);
}

export function ensureShots() {
  fs.mkdirSync(SHOTS, { recursive: true });
}
