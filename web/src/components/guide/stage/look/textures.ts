import * as THREE from "three";

// The stage's surface detail, made here rather than downloaded: three small
// tiling textures, each built once and shared by every material that uses it.
// They carry what a surface does to light at the scale of a tenth of a
// millimetre — a print's layers, the pebble of a textured build plate, the
// grooves a lathe leaves — as a slope, a roughness and a shade, and they are
// mipmapped: from further away than the detail can be resolved the filter
// averages it to nothing, so nothing shimmers when the camera moves. A
// procedural line in the shader would alias exactly where these fade.

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(127.5 + 127.5 * v)));

function finish(t: THREE.DataTexture, wrapT: THREE.Wrapping) {
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = wrapT;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Layers in one tile of the layer texture, and texels across a layer. */
export const LAYER_TILE = 128;
const LAYER_TEXELS = 8;

let layers: THREE.DataTexture | null = null;

/**
 * A printed wall, read across its layers: one tile is LAYER_TILE layers.
 *   R  the surface's slope along the print axis (each layer is a rounded
 *      bead: it leans one way coming out of a groove and the other going in)
 *   G  roughness (the grooves are duller; no two layers went down alike)
 *   B  shade (the grooves hold a little shadow; bands a few layers wide —
 *      the faint striping every print has)
 * 0.5 is "no change" in each.
 */
export function layerTexture(): THREE.DataTexture {
  if (layers) return layers;
  const rand = seeded(20260931);
  const w = LAYER_TILE * LAYER_TEXELS;
  const data = new Uint8Array(w * 4);
  // Per layer: its own small difference, and a slow drift over several layers (periodic, so the tile repeats without a seam).
  const own = Array.from({ length: LAYER_TILE }, () => rand() * 2 - 1);
  const knots = Array.from({ length: 16 }, () => rand() * 2 - 1);
  const drift = (i: number) => {
    const x = (i / LAYER_TILE) * knots.length;
    const a = Math.floor(x) % knots.length;
    const b = (a + 1) % knots.length;
    const f = x - Math.floor(x);
    const s = f * f * (3 - 2 * f);
    return knots[a] + (knots[b] - knots[a]) * s;
  };
  for (let i = 0; i < LAYER_TILE; i++) {
    const d = drift(i);
    const dNext = drift(i + 1);
    for (let k = 0; k < LAYER_TEXELS; k++) {
      const s = ((k + 0.5) / LAYER_TEXELS) * 2 - 1; // −1 … 1 across the bead
      const groove = Math.abs(s) ** 3;
      const o = (i * LAYER_TEXELS + k) * 4;
      // The bead's own slope, and the lean of a band that stands a hair proud of the next.
      data[o] = byte(s * 0.85 + (dNext - d) * 0.15);
      data[o + 1] = byte(groove * 0.55 - 0.14 + own[i] * 0.22 + d * 0.3);
      data[o + 2] = byte(-groove * 0.6 + 0.15 + own[i] * 0.3 + d * 0.35);
      data[o + 3] = 255;
    }
  }
  layers = finish(new THREE.DataTexture(data, w, 1, THREE.RGBAFormat), THREE.ClampToEdgeWrapping);
  return layers;
}

let grain: THREE.DataTexture | null = null;

/**
 * The face a print lay on: the fine pebble of a textured PEI plate, and much
 * the same tooth for any moulded matt plastic. RG is the slope in the two
 * directions of the face, B roughness; 0.5 is "no change".
 */
export function grainTexture(): THREE.DataTexture {
  if (grain) return grain;
  const n = 128;
  const rand = seeded(7_190_423);
  let h = new Float32Array(n * n);
  for (let i = 0; i < h.length; i++) h[i] = rand() * 2 - 1;
  // Two wrapped box blurs: pebbles a few texels across.
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += h[((y + dy + n) % n) * n + ((x + dx + n) % n)];
        out[y * n + x] = sum / 9;
      }
    }
    h = out;
  }
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const at = (xx: number, yy: number) => h[((yy + n) % n) * n + ((xx + n) % n)];
      const o = (y * n + x) * 4;
      data[o] = byte((at(x + 1, y) - at(x - 1, y)) * 3.2);
      data[o + 1] = byte((at(x, y + 1) - at(x, y - 1)) * 3.2);
      data[o + 2] = byte(at(x, y) * 2.4);
      data[o + 3] = 255;
    }
  }
  grain = finish(new THREE.DataTexture(data, n, n, THREE.RGBAFormat), THREE.RepeatWrapping);
  return grain;
}

let turned: THREE.DataTexture | null = null;

/**
 * Turned or brushed metal, read across the tool's marks: R the slope across
 * them, G roughness; 0.5 is "no change". Fine marks over a few broader ones.
 */
export function turnedTexture(): THREE.DataTexture {
  if (turned) return turned;
  const w = 512;
  const rand = seeded(55_210_917);
  const data = new Uint8Array(w * 4);
  const broad = Array.from({ length: 32 }, () => rand() * 2 - 1);
  for (let i = 0; i < w; i++) {
    const b = broad[Math.floor((i / w) * broad.length)];
    const o = i * 4;
    data[o] = byte((rand() * 2 - 1) * 0.75 + b * 0.25);
    data[o + 1] = byte((rand() * 2 - 1) * 0.5 + b * 0.4);
    data[o + 2] = 128;
    data[o + 3] = 255;
  }
  turned = finish(new THREE.DataTexture(data, w, 1, THREE.RGBAFormat), THREE.ClampToEdgeWrapping);
  return turned;
}
