import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// Pretendard's parts against the @font-face rules in globals.css: each
// weight's ranges still cover all of Unicode, the Hangul is the 2,350
// syllables of KS X 1001 in one file and the other 8,822 in another, and the
// common file is the one the browser tries first. Reads each WOFF2's cmap.

const FONTS = path.resolve(__dirname, '../../public/fonts');
const CSS = fs.readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8');

/** The one Hangul file a Korean page fetched before the split: Regular 593,848 bytes, Bold 617,400. */
const COMMON_BUDGET = 170_000;

type Range = [number, number];

interface Face {
  weight: number;
  file: string;
  ranges: Range[];
}

function parseRanges(value: string): Range[] {
  return value.split(',').map((part) => {
    const [from, to] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(from, 16), parseInt(to ?? from, 16)];
  });
}

const faces: Face[] = [...CSS.matchAll(/@font-face\s*{([^}]*)}/g)]
  .map((m) => m[1])
  .filter((body) => /font-family:\s*'Pretendard'/.test(body))
  .map((body) => ({
    weight: Number(/font-weight:\s*(\d+)/.exec(body)![1]),
    file: /url\('\/fonts\/([^']+)'\)/.exec(body)![1],
    ranges: parseRanges(/unicode-range:\s*([^;]+);/.exec(body)![1]),
  }));

const inRanges = (ranges: Range[], cp: number) => ranges.some(([a, b]) => cp >= a && cp <= b);

/** UIntBase128 from the WOFF2 table directory. */
function base128(buf: Buffer, at: { pos: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[at.pos++];
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return value;
  }
  throw new Error('UIntBase128 longer than five bytes');
}

/** The code points a WOFF2 maps to a glyph other than .notdef. */
function woff2Cmap(file: string): Set<number> {
  const buf = fs.readFileSync(path.join(FONTS, file));
  expect(buf.toString('latin1', 0, 4), `${file} is not WOFF2`).toBe('wOF2');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  const at = { pos: 48 };
  let offset = 0;
  let cmap: { offset: number; length: number } | null = null;
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at.pos++];
    const known = flags & 0x3f;
    const tag = known === 0x3f ? buf.toString('latin1', at.pos, (at.pos += 4)) : known;
    const origLength = base128(buf, at);
    const version = flags >> 6;
    // glyf (10) and loca (11) are transformed at version 0; every other table at any other version.
    const transformed = tag === 10 || tag === 11 ? version === 0 : version !== 0;
    const length = transformed ? base128(buf, at) : origLength;
    if (tag === 0) cmap = { offset, length };
    offset += length;
  }
  expect(cmap, `${file} has no cmap`).not.toBeNull();
  const data = brotliDecompressSync(buf.subarray(at.pos, at.pos + compressedSize));
  const table = data.subarray(cmap!.offset, cmap!.offset + cmap!.length);

  const subtables = new Map<string, number>();
  for (let i = 0; i < table.readUInt16BE(2); i++) {
    const rec = 4 + i * 8;
    subtables.set(`${table.readUInt16BE(rec)},${table.readUInt16BE(rec + 2)}`, table.readUInt32BE(rec + 4));
  }
  const cps = new Set<number>();
  const full = subtables.get('3,10') ?? subtables.get('0,4');
  if (full !== undefined) {
    expect(table.readUInt16BE(full), `${file}: full-repertoire cmap is not format 12`).toBe(12);
    const groups = table.readUInt32BE(full + 12);
    for (let g = 0; g < groups; g++) {
      const rec = full + 16 + g * 12;
      const start = table.readUInt32BE(rec);
      const end = table.readUInt32BE(rec + 4);
      const glyph = table.readUInt32BE(rec + 8);
      for (let cp = start; cp <= end; cp++) if (glyph + cp - start !== 0) cps.add(cp);
    }
    return cps;
  }
  const bmp = subtables.get('3,1') ?? subtables.get('0,3');
  expect(bmp, `${file} has no Unicode cmap`).toBeDefined();
  expect(table.readUInt16BE(bmp!), `${file}: BMP cmap is not format 4`).toBe(4);
  const segs = table.readUInt16BE(bmp! + 6) / 2;
  const ends = bmp! + 14;
  const starts = ends + segs * 2 + 2;
  const deltas = starts + segs * 2;
  const rangeOffsets = deltas + segs * 2;
  for (let s = 0; s < segs; s++) {
    const end = table.readUInt16BE(ends + s * 2);
    const start = table.readUInt16BE(starts + s * 2);
    const delta = table.readInt16BE(deltas + s * 2);
    const rangeOffset = table.readUInt16BE(rangeOffsets + s * 2);
    for (let cp = start; cp <= end; cp++) {
      let glyph: number;
      if (rangeOffset === 0) glyph = (cp + delta) & 0xffff;
      else {
        glyph = table.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (cp - start) * 2);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) cps.add(cp);
    }
  }
  return cps;
}

/** The 2,350 Hangul syllables of KS X 1001: EUC-KR lead bytes B0–C8, trail bytes A1–FE. */
function ksx1001Syllables(): Set<number> {
  const decoder = new TextDecoder('euc-kr');
  const out = new Set<number>();
  for (let lead = 0xb0; lead <= 0xc8; lead++) {
    for (let trail = 0xa1; trail <= 0xfe; trail++) {
      const cp = decoder.decode(Uint8Array.of(lead, trail)).codePointAt(0)!;
      if (cp >= 0xac00 && cp <= 0xd7a3) out.add(cp);
    }
  }
  return out;
}

const isSyllable = (cp: number) => cp >= 0xac00 && cp <= 0xd7a3;

describe.each([
  [400, 'Regular'],
  [700, 'Bold'],
] as const)('Pretendard %i', (weight, name) => {
  const parts = faces.filter((face) => face.weight === weight);
  const common = `Pretendard-${name}.hangul.woff2`;
  const rare = `Pretendard-${name}.hangul-rare.woff2`;

  it('covers all of Unicode between its parts, as the whole file did', () => {
    const ranges = parts.flatMap((face) => face.ranges).sort((x, y) => x[0] - y[0]);
    let next = 0;
    for (const [a, b] of ranges) {
      expect(a, `nothing covers U+${next.toString(16).toUpperCase()}`).toBeLessThanOrEqual(next);
      next = Math.max(next, b + 1);
    }
    expect(next).toBe(0x110000);
  });

  it('writes hangul-rare before hangul, so the browser tries hangul first', () => {
    const files = parts.map((face) => face.file);
    expect(files).toContain(common);
    expect(files).toContain(rare);
    expect(files.indexOf(rare)).toBeLessThan(files.indexOf(common));
    for (const file of [common, rare]) {
      const face = parts.find((p) => p.file === file)!;
      expect(inRanges(face.ranges, 0xac00) && inRanges(face.ranges, 0xd7a3), `${file} claims the syllable block`).toBe(true);
    }
  });

  it('keeps each glyph of each part inside that part\'s unicode-range', () => {
    for (const face of parts) {
      const outside = [...woff2Cmap(face.file)].filter((cp) => !inRanges(face.ranges, cp));
      expect(outside.map((cp) => `U+${cp.toString(16).toUpperCase()}`), face.file).toEqual([]);
    }
  });

  it('puts the jamo and the 2,350 syllables of KS X 1001 in hangul, and the other 8,822 in hangul-rare', () => {
    const ks = ksx1001Syllables();
    expect(ks.size).toBe(2350);
    const commonCps = woff2Cmap(common);
    const rareCps = woff2Cmap(rare);
    expect([...commonCps].filter(isSyllable).sort()).toEqual([...ks].sort());
    // Hangul Compatibility Jamo, ㄱ to ㅣ, as typed alone.
    for (let cp = 0x3131; cp <= 0x3163; cp++) expect(commonCps.has(cp)).toBe(true);
    expect([...rareCps].every(isSyllable)).toBe(true);
    expect(rareCps.size).toBe(11172 - 2350);
    expect([...rareCps].filter((cp) => ks.has(cp))).toEqual([]);
  });

  it('keeps a Korean page\'s Hangul under a quarter of the file it replaced', () => {
    expect(fs.statSync(path.join(FONTS, common)).size).toBeLessThan(COMMON_BUDGET);
  });
});
