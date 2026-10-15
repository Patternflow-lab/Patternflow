/** A frame as a PNG: 8-bit RGB, alpha dropped, one IDAT, with Node's zlib and no package. */
import zlib from "node:zlib";

const TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (bytes: Buffer) => (bytes.reduce((c, b) => TABLE[(c ^ b) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

function chunk(type: string, data: Buffer) {
  const out = Buffer.concat([Buffer.alloc(4), Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
  out.writeUInt32BE(data.length, 0);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** rgba is width × height × 4 bytes, rows top to bottom, as DeviceSim's frame is. */
export function png(rgba: Uint8ClampedArray, width: number, height: number): Buffer {
  // Each row is a filter byte, 0 for none, then its pixels.
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let i = 0; i < width * height; i++) rows.set(rgba.subarray(i * 4, i * 4 + 3), i * 3 + Math.floor(i / width) + 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8); // 8 bits a channel, RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
