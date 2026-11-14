// ===== Patternflow pattern =====
// Title:   Finish Field
// Family:  cosmetic
// Idea:    One eye palette's shades pressed together into a single slow marbling field, where every patch keeps its own finish: matte patches lie flat, shimmer patches carry a soft sheen that slides as an unseen lamp wanders over the panel, and glitter patches hold single-LED facets that flash white-gold when they turn to face it.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, collab reference for CLIO, after the Pro Eye Palette Air, whose twelve shades mix matte, shimmer and glitter finishes in one pan set, and the shade names of the 2025 K-Heritage and 2026 Baby Koshort editions
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=-1..1, Finish=-1..1
//
// Knob 1: Hue. Turns the whole palette round the colour wheel; at 0 it is the palette this was built from, milk beige, coral, plum rose, lilac, peony and golden ochre, and one full turn comes back to it.
// Knob 2: Speed. How fast the shades marble and the lamp wanders: at 2 a patch drifts about one LED a second and the lamp takes about half a minute to cross the panel; at 0.2 it is ten times slower, at 3 half as fast again.
// Knob 3: Scale. The size of the shade patches, about 13 LEDs across at -1, 24 at the opening and 43 at 1; the finish patches grow with them.
// Knob 4: Finish. Which finish takes the field: at -1 the field is 87% matte and 13% shimmer, at the opening 47% matte, 35% shimmer and 18% glitter, at 1 it is 69% glitter with 18% shimmer and 13% matte.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, atan2, max, min, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The palette at Hue 0, a ring so the field can run off one end into the
// other. The colours are our reading of shade names CLIO has used: milk beige
// (Baby Milk, 2026), coral (Coral Dahlia), plum rose (the Maehwa ribbon of the
// K-Heritage edition), lilac (Lilac Petal), peony (Peony Mist) and the golden
// ochre of the golden-rain tree (Mogamju, K-Heritage).
const RING = [
  [234, 214, 192],
  [242, 118, 92],
  [186, 52, 92],
  [176, 146, 214],
  [236, 158, 182],
  [206, 150, 52],
];

// A 3D value noise on an integer lattice, smoothstep between corners. Time is
// its third axis, so the field changes without ever being wrapped.
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi), b = hash3(xi + 1, yi, zi), c = hash3(xi, yi + 1, zi), d = hash3(xi + 1, yi + 1, zi);
  const e = hash3(xi, yi, zi + 1), f = hash3(xi + 1, yi, zi + 1), g = hash3(xi, yi + 1, zi + 1), h = hash3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}

function rgb2hsv(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

// Twelve shades taken round the ring, like the twelve pans of one palette,
// rebuilt when Hue moves. The firmware raises saturation by 1.62 on the way
// to the LEDs, so the shades go in at 0.68 of their saturation and come out
// near the colours they were picked as.
const SHADES = 12;
function buildLut(S, hue) {
  const n = RING.length, c = [0, 0, 0];
  for (let i = 0; i < SHADES; i++) {
    const p = ((i + 0.5) / SHADES) * n, k = floor(p), f = sm(0, 1, p - k);
    const A = RING[k % n], B = RING[(k + 1) % n];
    const r = A[0] + (B[0] - A[0]) * f, g = A[1] + (B[1] - A[1]) * f, b = A[2] + (B[2] - A[2]) * f;
    const hsv = rgb2hsv(r / 255, g / 255, b / 255);
    // Every other pan a step deeper, so neighbours read as two shades.
    const v = hsv[2] * (i % 2 ? 0.86 : 1);
    hsv2rgb(hsv[0] + hue, hsv[1] * 0.68, v, c, 0);
    S.lut[i * 3] = c[0] * 255;
    S.lut[i * 3 + 1] = c[1] * 255;
    S.lut[i * 3 + 2] = c[2] * 255;
  }
  S.lutHue = hue;
}

export function setup(params) {
  const facet = new Float32Array(N), spin = new Float32Array(N), tilt = new Float32Array(N), grain = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    facet[p] = Math.random() * 2 * PI;
    // Each flake turns at a rate of its own, either way round.
    spin[p] = (0.25 + 0.9 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    // How sharply a flake catches the lamp: most are narrow mirrors, a few broad.
    tilt[p] = 10 + 40 * Math.random() * Math.random();
    grain[p] = Math.random() - 0.5;
  }
  params.s = { t: 0, lut: new Float32Array(SHADES * 3), lutHue: -1, facet, spin, tilt, grain, hue: 0, speed: 2, scale: 0, finish: 0.06 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.scale = cl(k[2], -1, 1);
  S.finish = cl(k[3], -1, 1);
  // Model time runs at 0.6 of Speed, so the opening Speed of 2 is a calm pace.
  S.t += cl(dt || 0, 0, 0.1) * S.speed * 0.6;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.lutHue !== S.hue) buildLut(S, S.hue);
  const t = S.t, lut = S.lut;
  // Patch size: one lattice cell is 1/fs LEDs.
  const fs = 0.042 * Math.pow(0.55, S.scale);
  // The field drifts on two slow currents whose rates share no ratio, and
  // its third axis runs with time, so it never comes back to a past state.
  const ox = 0.9 * t + 7 * sin(0.031 * t), oy = 0.55 * t + 9 * cos(0.0233 * t);
  const z = 0.04 * t;
  // The lamp: a point that wanders over and past the panel on four sines.
  const lx = 32 + 40 * sin(0.091 * t + 0.4) + 10 * sin(0.237 * t), ly = 64 + 70 * sin(0.0577 * t + 1.1) + 14 * cos(0.171 * t);
  // Finish thresholds: below a is matte, above b is glitter.
  const f4 = S.finish;
  const a = 0.5 - 0.22 * f4, b = 0.7 - 0.3 * f4;
  const { facet, spin, tilt, grain } = S;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const X = (x + ox) * fs, Y = (y + oy) * fs;
      // A domain warp folds the patches into marbled tongues.
      const wx = noise3(X * 0.7 + 11.3, Y * 0.7, z * 0.8) - 0.5, wy = noise3(X * 0.7, Y * 0.7 + 5.7, z * 0.8 + 3.1) - 0.5;
      const U = X + 2.2 * wx, V = Y + 2.2 * wy;
      const n1 = noise3(U, V, z) * 0.7 + noise3(U * 2.03 + 3.3, V * 2.03 + 1.7, z * 1.6) * 0.3;
      // Shade: the field runs the twelve pans a little more than once, each
      // pan a flat patch with a soft edge a LED or two wide into the next.
      let q = (n1 * 1.7 + 0.11 * sin(0.013 * t)) % 1;
      if (q < 0) q += 1;
      const qi = q * SHADES, k0 = floor(qi), e = sm(0.86, 1, qi - k0);
      const i0 = (k0 % SHADES) * 3, i1 = ((k0 + 1) % SHADES) * 3;
      const r = lut[i0] + (lut[i1] - lut[i0]) * e, g = lut[i0 + 1] + (lut[i1 + 1] - lut[i0 + 1]) * e, bl = lut[i0 + 2] + (lut[i1 + 2] - lut[i0 + 2]) * e;
      // Finish: its own field, larger and slower than the shades.
      const fin = noise3(U * 0.55 + 21.7, V * 0.55 + 8.9, z * 0.6 + 9.4);
      const wMatte = 1 - sm(a - 0.04, a + 0.04, fin);
      const wGlit = sm(b - 0.03, b + 0.03, fin);
      const wShim = max(0, 1 - wMatte - wGlit);
      const dx = x - lx, dy = y - ly, d2 = dx * dx + dy * dy;
      // Matte: flat colour with a faint pressed grain.
      const gr = 1 + 0.05 * grain[p];
      let R = r * gr * wMatte, G = g * gr * wMatte, B = bl * gr * wMatte;
      if (wShim > 0) {
        // Shimmer: a broad sheen round the lamp, broken by a fine pearly
        // grain that turns with the field.
        const sheen = exp(-d2 / (2 * 34 * 34));
        const pearl = 0.45 + 0.55 * noise3(x * 0.5 + ox * 0.2, y * 0.5, z * 1.2);
        const s = 0.16 + 0.6 * sheen * pearl;
        R += wShim * (r * (0.92 - 0.2 * s) + 255 * s);
        G += wShim * (g * (0.92 - 0.2 * s) + 240 * s);
        B += wShim * (bl * (0.92 - 0.2 * s) + 236 * s);
      }
      if (wGlit > 0) {
        // Glitter: a deeper ground, and each LED a flake that flashes when
        // its face turns toward the lamp.
        const toward = atan2(dy, dx);
        const c = cos(facet[p] + spin[p] * t * 0.9 - toward);
        let flash = c > 0.8 ? Math.pow(c, tilt[p]) : 0;
        flash *= 0.45 + 0.55 * exp(-d2 / (2 * 56 * 56));
        // The ground goes toward a deep plum rather than toward black, so a
        // golden pan reads as dark gold and not as olive.
        const gr0 = r * 0.55 + 46, gg0 = g * 0.5 + 14, gb0 = bl * 0.55 + 30;
        R += wGlit * (gr0 + (255 - gr0) * flash);
        G += wGlit * (gg0 + (236 - gg0) * flash);
        B += wGlit * (gb0 + (196 - gb0) * flash);
      }
      display.setPixel(x, y, R, G, B);
    }
  }
}
