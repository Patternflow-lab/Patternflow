/**
 * What check.ts, shoot.ts and sheet.ts share. A brand folder is
 * incoming/collab-<brand>/ with patterns/<slug>.js, sheet.json and shots/.
 * Patterns load and run through the pattern study's lab.ts, which builds the
 * layer the way Pattern Lab does and renders it with LabEngine, the Lab
 * preview's own engine. Nothing here renders a pattern any other way.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

import { loadPatternFile, run, type Pattern } from "../pattern-study/tools/lab";

import { panel } from "./led";

export { run, type Pattern };

export const KIT = path.dirname(fileURLToPath(import.meta.url));
export const INCOMING = path.resolve(KIT, "..");

export type Look = { name: string; knobs: number[]; note?: string };
export type SheetPattern = {
  slug: string;
  /** One Korean line under the tile. */
  note: string;
  /** Why this pattern belongs to the brand, a short Korean paragraph. */
  why: string;
  /** Knob settings worth showing beside the live tile. */
  looks?: Look[];
};
export type Place = { kind: "wall" | "counter" | "mirror" | "reel" | "window"; title: string; text: string; pattern: string; knobs?: number[] };
export type Source = { title: string; url: string; what: string };
export type Sheet = {
  brand: string;
  brandKo: string;
  /** One Korean sentence: the brand in our words. */
  line: string;
  date: string;
  palette: { name: string; hex: string; from: string }[];
  mood: string[];
  keywords: string[];
  patterns: SheetPattern[];
  places: Place[];
  sources: Source[];
  /** What the sheet does not do, one Korean sentence (no logo, no product photos). */
  fineprint: string;
};

export function brandDir(brand: string): string {
  const dir = path.join(INCOMING, `collab-${brand}`);
  if (!fs.existsSync(dir)) throw new Error(`no folder ${path.relative(process.cwd(), dir)}`);
  return dir;
}

export function loadSheet(dir: string): Sheet {
  return JSON.parse(fs.readFileSync(path.join(dir, "sheet.json"), "utf8")) as Sheet;
}

export function listSlugs(dir: string): string[] {
  const p = path.join(dir, "patterns");
  if (!fs.existsSync(p)) return [];
  return fs
    .readdirSync(p)
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.slice(0, -3))
    .sort();
}

export function loadBrandPattern(dir: string, slug: string): Pattern {
  // The seed for Math.random comes from the slug (lab.ts), so a brand prefix
  // keeps these runs apart from a study pattern of the same name.
  return loadPatternFile(path.join(dir, "patterns", `${slug}.js`), `${path.basename(dir)}/${slug}`);
}

/** Pulls `--only a,b` out of argv. */
export function onlyArg(args: string[]): Set<string> | null {
  const i = args.indexOf("--only");
  return i >= 0 ? new Set((args[i + 1] ?? "").split(",").filter(Boolean)) : null;
}

/** Frames of one run, kept every `every` seconds from `from`. */
export function frames(pattern: Pattern, knobs: number[], seconds: number, every: number, from = 0) {
  const kept: { rgb: Uint8Array; t: number }[] = [];
  let next = from;
  const result = run(pattern, {
    knobs,
    seconds,
    from,
    onFrame: (f) => {
      if (f.t + 1e-6 >= next) {
        kept.push(f);
        next += every;
      }
    },
  });
  return { kept, ...result };
}

// ── The panel ───────────────────────────────────────────────────────────────
export { panel };

export type Image = { w: number; h: number; px: Uint8Array };

export function image(w: number, h: number, grey = 0): Image {
  return { w, h, px: new Uint8Array(w * h * 3).fill(grey) };
}

/** The frame as the panel shows it: round LEDs at `pitch` px, an LED that is off still faintly there. */
export function leds(rgb: Uint8Array, w: number, h: number, pitch: number): Image {
  const img = image(w * pitch, h * pitch, 6);
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
      const i = (y * w + x) * 3;
      const [r, g, b] = panel(rgb[i], rgb[i + 1], rgb[i + 2]).map((c) => Math.max(c, 14));
      for (let v = 0; v < pitch; v++)
        for (let u = 0; u < pitch; u++) {
          const c = cover[v * pitch + u];
          const o = ((y * pitch + v) * img.w + x * pitch + u) * 3;
          img.px[o] = r * c + 6 * (1 - c);
          img.px[o + 1] = g * c + 6 * (1 - c);
          img.px[o + 2] = b * c + 6 * (1 - c);
        }
    }
  return img;
}

export function blit(dst: Image, src: Image, x0: number, y0: number) {
  for (let y = 0; y < src.h; y++) {
    const yy = y0 + y;
    if (yy < 0 || yy >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const xx = x0 + x;
      if (xx < 0 || xx >= dst.w) continue;
      const s = (y * src.w + x) * 3;
      const d = (yy * dst.w + xx) * 3;
      dst.px[d] = src.px[s];
      dst.px[d + 1] = src.px[s + 1];
      dst.px[d + 2] = src.px[s + 2];
    }
  }
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function png(img: Image): Buffer {
  const raw = Buffer.alloc((img.w * 3 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 3 + 1)] = 0;
    Buffer.from(img.px.buffer, img.px.byteOffset + y * img.w * 3, img.w * 3).copy(raw, y * (img.w * 3 + 1) + 1);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(img.w, 0);
  head.writeUInt32BE(img.h, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", head),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
