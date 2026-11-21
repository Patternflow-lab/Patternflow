import fs from "node:fs";
import path from "node:path";

type ImageMeta = { width: number; height: number };

const FALLBACK: ImageMeta = { width: 1400, height: 900 };
const cache = new Map<string, ImageMeta>();

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function probePng(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// The EXIF orientation (tag 0x0112) of an APP1 segment whose payload starts at
// `start`, or 1 when it has none. A phone photo is often stored on its side
// with 6 here, "turn a quarter turn to show".
function exifOrientation(buffer: Buffer, start: number): number {
  try {
    if (buffer.toString("latin1", start, start + 6) !== "Exif\0\0") return 1;
    const tiff = start + 6;
    const little = buffer.toString("latin1", tiff, tiff + 2) === "II";
    const u16 = (at: number) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at));
    const u32 = (at: number) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
    const ifd = tiff + u32(tiff + 4);
    const entries = u16(ifd);
    for (let i = 0; i < entries; i += 1) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === 0x0112) return u16(entry + 8);
    }
  } catch {
    // a truncated or malformed segment: treat as upright
  }
  return 1;
}

function probeJpeg(buffer: Buffer): ImageMeta | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  let orientation = 1;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // SOF0–SOF15 carry dimensions, except DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const width = buffer.readUInt16BE(offset + 7);
      const height = buffer.readUInt16BE(offset + 5);
      // Orientations 5 to 8 are the quarter turns. Browsers and the image
      // optimizer both draw the photo turned, so the box it needs is the
      // stored one with its sides swapped. Nine journal photos are like
      // this, and each had a landscape box reserved for a portrait picture.
      return orientation >= 5 && orientation <= 8
        ? { width: height, height: width }
        : { width, height };
    }
    if (marker === 0xe1 && orientation === 1) {
      orientation = exifOrientation(buffer, offset + 4);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

export function getJournalImageMeta(src?: string): ImageMeta {
  if (!src || !src.startsWith("/")) {
    return FALLBACK;
  }

  const cached = cache.get(src);
  if (cached) {
    return cached;
  }

  let meta = FALLBACK;
  try {
    const buffer = fs.readFileSync(path.join(process.cwd(), "public", src));
    meta = probePng(buffer) ?? probeJpeg(buffer) ?? FALLBACK;
  } catch {
    // missing file: fall back to default dimensions
  }

  cache.set(src, meta);
  return meta;
}
