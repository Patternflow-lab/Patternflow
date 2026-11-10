// ── Nearest-neighbour stretch ────────────────────────────────────────────────
// The Graphic Export stage (capture/core.ts) stretches pixel and text layers
// to its render grid with this, and the engine stretches a text effect's
// frame the same way each tick.

/**
 * Nearest-neighbour stretch, independent per axis — a 128×64 sprite sheet
 * drawn for the panel lands on a 1050×600 card without a blurry resample,
 * and an off-aspect output simply stretches it the way the pattern beneath
 * stretches too.
 */
export function stretchNearest(
  src: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  into?: Uint8ClampedArray | null,
): Uint8ClampedArray {
  const size = dstWidth * dstHeight * 4;
  const out = into && into.length === size ? into : new Uint8ClampedArray(size);
  if (srcWidth <= 0 || srcHeight <= 0) return out;
  for (let y = 0; y < dstHeight; y++) {
    const sy = Math.min(srcHeight - 1, Math.floor((y * srcHeight) / dstHeight));
    const srcRow = sy * srcWidth;
    const dstRow = y * dstWidth;
    for (let x = 0; x < dstWidth; x++) {
      const sx = Math.min(srcWidth - 1, Math.floor((x * srcWidth) / dstWidth));
      const si = (srcRow + sx) * 4;
      const di = (dstRow + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}
