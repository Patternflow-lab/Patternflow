// ===== Patternflow pattern =====
// Title:   Stage Haze
// Family:  cosmetic
// Idea:    Soft cones of coloured light from unseen heads above and below the panel sweep through a drifting haze, each on a slow path of its own, and where two cross their colours add toward white while the haze carries the light in curls that never settle.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, collab reference for CLIO, after the Express Yours campaign with ALLDAY PROJECT (November 2025), which CLIO tied to the group's strong stage performance and free energy, lit in shades from CLIO palettes
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.2..3, Width=-1..1, Beams=-1..1
//
// Knob 1: Hue. Turns every beam's colour round the wheel together; at 0 the beams are plum rose, coral, lilac, golden ochre and peony over a deep plum haze, and one turn comes back to them.
// Knob 2: Sweep. How fast the heads swing and the haze drifts: at 2 a beam takes ten seconds or so to swing across the panel and the haze rises about one LED a second; at 0.2 the heads hardly move and the haze alone turns.
// Knob 3: Width. The spread of every cone, from pencil beams a few LEDs wide at -1 to broad washes that fill half the panel at 1.
// Knob 4: Beams. How many heads are lit, from two at -1 to seven at 1, four and most of a fifth at the opening; a head fades in and out as the knob passes it rather than switching, and each one also dims to about half and comes back on a slow cue of its own.

const W = 64, H = 128;
const { floor, sqrt, sin, cos, exp, max, min, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Beam colours at Hue 0, in 0..1, already softened: the firmware raises
// saturation by 1.62 on the way to the LEDs.
const COLS = [
  [0.86, 0.3, 0.46],
  [0.95, 0.52, 0.4],
  [0.66, 0.56, 0.9],
  [0.9, 0.7, 0.34],
  [0.94, 0.6, 0.72],
  [0.86, 0.3, 0.46],
  [0.66, 0.56, 0.9],
];
const HAZE = [0.16, 0.045, 0.11];
const MAXB = 7;

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

function rotateHue(c, turn, out) {
  // Rotation about the grey axis: keeps each colour's lightness, turns its hue.
  const a = turn * 2 * PI, cs = cos(a), sn = sin(a), k = 1 / 3, s3 = sqrt(k);
  const m00 = cs + (1 - cs) * k, m01 = k * (1 - cs) - s3 * sn, m02 = k * (1 - cs) + s3 * sn;
  const m10 = k * (1 - cs) + s3 * sn, m11 = cs + k * (1 - cs), m12 = k * (1 - cs) - s3 * sn;
  const m20 = k * (1 - cs) - s3 * sn, m21 = k * (1 - cs) + s3 * sn, m22 = cs + k * (1 - cs);
  out[0] = cl(m00 * c[0] + m01 * c[1] + m02 * c[2], 0, 1);
  out[1] = cl(m10 * c[0] + m11 * c[1] + m12 * c[2], 0, 1);
  out[2] = cl(m20 * c[0] + m21 * c[1] + m22 * c[2], 0, 1);
}

export function setup(params) {
  const beams = [];
  for (let i = 0; i < MAXB; i++) {
    // Heads hang in a rig above the panel and stand on the floor below it,
    // in turn. Heads at the sides were tried: across 64 LEDs a beam has no
    // room to open and read as a smear.
    const side = i % 2;
    beams.push({
      side,
      along: 0.15 + 0.7 * Math.random(),
      // Rates for each head's swing, its slow sway and its slide along the edge.
      w1: 0.21 + 0.17 * Math.random(),
      w2: 0.083 + 0.07 * Math.random(),
      w3: 0.037 + 0.03 * Math.random(),
      p1: Math.random() * 2 * PI,
      p2: Math.random() * 2 * PI,
      p3: Math.random() * 2 * PI,
      swing: 0.55 + 0.25 * Math.random(),
      // A slow breath in each head's brightness.
      wb: 0.11 + 0.09 * Math.random(),
      pb: Math.random() * 2 * PI,
    });
  }
  params.s = {
    t: 0, beams, hue: -1, speed: 2, width: 0, count: 0.06,
    col: new Float32Array(MAXB * 3), haze: new Float32Array(3),
    dens: new Float32Array(W * H), acc: new Float32Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  if (k[0] !== S.hue) {
    S.hue = k[0];
    const out = [0, 0, 0];
    for (let i = 0; i < MAXB; i++) {
      rotateHue(COLS[i], S.hue, out);
      S.col[i * 3] = out[0];
      S.col[i * 3 + 1] = out[1];
      S.col[i * 3 + 2] = out[2];
    }
    rotateHue(HAZE, S.hue, out);
    S.haze.set(out);
  }
  S.speed = cl(k[1], 0.2, 3);
  S.width = cl(k[2], -1, 1);
  S.count = cl(k[3], -1, 1);
  // Model time runs at 0.35 of Sweep.
  S.t += cl(dt || 0, 0, 0.1) * S.speed * 0.35;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.hue < 0) return;
  const t = S.t, dens = S.dens, acc = S.acc;
  // The haze: a density that drifts up the panel and folds over on itself,
  // two octaves of noise moved by a third. Its third axis runs with time.
  const z = 0.085 * t, rise = 1.6 * t, sx = 4 * sin(0.047 * t);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const X = (x + sx) * 0.055, Y = (y + rise) * 0.055;
      const wx = noise3(X * 0.6, Y * 0.6, z * 0.7) - 0.5;
      const n = noise3(X + 1.6 * wx, Y, z) * 0.65 + noise3(X * 2.1 + 4.1, Y * 2.1, z * 1.7) * 0.35;
      dens[y * W + x] = 0.16 + 1.7 * n * n;
    }
  acc.fill(0);
  // Cone half-width as a slope: about 0.03 at -1, 0.095 at the opening, 0.33 at 1.
  const spread = 0.095 * Math.pow(3.5, S.width);
  const countF = 4.5 + 2.5 * S.count;
  for (let i = 0; i < MAXB; i++) {
    const on = cl(countF - i, 0, 1);
    if (on <= 0) continue;
    const B = S.beams[i];
    // Paths come from smooth noise, not sines alone: on sines the heads came
    // back to the same pose often enough that the picture repeated (recur
    // 0.37 over four minutes).
    const slide = B.along + 0.5 * (noise3(i * 7.1, 3.3, B.w3 * t) - 0.5);
    let ox, oy, base;
    // The head slides along its edge, and its beam swings about straight in.
    if (B.side === 0) (ox = slide * W), (oy = -14), (base = PI / 2);
    else (ox = slide * W), (oy = H + 14), (base = -PI / 2);
    const ang = base + 2.2 * B.swing * (noise3(i * 13.7, 0.5, B.w1 * t * 0.7 + B.p1) - 0.5) + 0.3 * sin(B.w2 * t + B.p2);
    const ux = cos(ang), uy = sin(ang);
    // A breath of its own, and a slow cue: over half a minute or so a head
    // fades down to about half and comes back, as a desk would bring it.
    const cue = 0.55 + 0.45 * noise3(i * 2.9, 6.6, 0.028 * t + i);
    const bright = on * cue * (0.8 + 0.2 * sin(B.wb * t + B.pb)) * 1.25;
    // Each head's gel drifts slowly toward the colour two heads on, and back.
    const j = (i + 2) % MAXB, mix = noise3(i * 5.3, 9.1, 0.045 * t);
    const cr = (S.col[i * 3] + (S.col[j * 3] - S.col[i * 3]) * mix) * bright;
    const cg = (S.col[i * 3 + 1] + (S.col[j * 3 + 1] - S.col[i * 3 + 1]) * mix) * bright;
    const cb = (S.col[i * 3 + 2] + (S.col[j * 3 + 2] - S.col[i * 3 + 2]) * mix) * bright;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const px = x + 0.5 - ox, py = y + 0.5 - oy;
        const along = px * ux + py * uy;
        if (along <= 0) continue;
        const perp = abs(px * uy - py * ux);
        // Soft edge, the cone widening with distance from the head, and a
        // little light lost along the way.
        const r = perp / (along * spread + 1.0);
        if (r > 3) continue;
        const f = (exp(-r * r) + 0.9 * exp(-r * r * 9)) / (1 + along / 300);
        const p = (y * W + x) * 3;
        acc[p] += cr * f;
        acc[p + 1] += cg * f;
        acc[p + 2] += cb * f;
      }
  }
  // Light shows only where the haze holds it. Crossed beams add, and a soft
  // shoulder takes the sum toward white instead of clipping it.
  const hr = S.haze[0], hg = S.haze[1], hb = S.haze[2];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, p = q * 3, d = dens[q];
      const r = d * (acc[p] * 1.4 + hr), g = d * (acc[p + 1] * 1.4 + hg), b = d * (acc[p + 2] * 1.4 + hb);
      const sum = r + g + b, white = cl((sum - 1.6) / 2.2, 0, 1) * 0.6;
      display.setPixel(
        x,
        y,
        255 * (1 - exp(-1.6 * r)) * (1 - white) + 255 * white,
        255 * (1 - exp(-1.6 * g)) * (1 - white) + 250 * white,
        255 * (1 - exp(-1.6 * b)) * (1 - white) + 246 * white,
      );
    }
}
