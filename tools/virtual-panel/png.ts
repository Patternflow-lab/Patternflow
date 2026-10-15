/** A frame as a PNG: 8-bit RGB, alpha dropped, one IDAT. Node's zlib, no package. */
import zlib from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (bytes: Buffer) => (bytes.reduce((c, b) => CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** `rgba` is width × height × 4 bytes, rows top to bottom, as DeviceSim's frame is. */
export function png(rgba: Uint8ClampedArray, width: number, height: number): Buffer {
  const rows = Buffer.alloc((width * 3 + 1) * height); // each row starts with filter 0, none
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [from, to] = [(y * width + x) * 4, y * (width * 3 + 1) + 1 + x * 3];
      rows[to] = rgba[from];
      rows[to + 1] = rgba[from + 1];
      rows[to + 2] = rgba[from + 2];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 2; // RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
