// ===== Patternflow pattern =====
// Title:   Clay Mask
// Family:  cosmetic
// Idea:    A clay mask spread over the whole panel in spatula strokes dries from its thinnest places: the wet clay is deep, saturated and glossy with the spatula's scrapes catching a drifting lamp, the drying front spreads unevenly round the thick ridges, and the dry clay is pale, matte and chalky until a band of water sweeps down and darkens it again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 32, after the clay face mask that pales as it dries
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Thickness=-1..1, Gloss=-1..1
//
// Knob 1: Hue. The clay's colour once round the wheel; the dry clay keeps a pale tint of it. At 0 rose clay, deep raspberry wet and blush when dry; at 0.1 terracotta, at 0.35 green clay, at 0.6 teal, at 0.85 violet.
// Knob 2: Speed. At 2 the first pale spots open within a second and the last wet ridge goes pale at 8.1 seconds; the clay stays dry for 1.2 seconds, then a band of water sweeps down the panel in 2.2 seconds and it dries again, about 12 seconds a round. The lamp's reflection drifts with it. At 0.2 all of it runs ten times slower.
// Knob 3: Thickness. At -1 a thin coat with a shallow relief that pales almost all at once and is dry at 5.8 seconds; at 0 the spatula ridges stand out and the front works round them; at 1 the ridges are deepest, the pale patches open as sharp islands and the last of the clay dries at 12.5 seconds.
// Knob 4: Gloss. Only the wet clay. At -1 satin, a broad soft sheen that lifts the whole surface; at 1 a wet look, the colour deeper and the lamp's reflection a tight bright spot that the scrape lines break into streaks. The sheen goes before the colour lifts, so a damp matte band leads every pale patch.
// Buttons: K1 tap sends the band of water down the panel now, unless one is already on its way.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Smooth value noise, 0..1.
function vn(x, y, s) {
  const i = floor(x), j = floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// The clay as it was laid on: a base coat and spatula strokes across it,
// each piling a ridge at its edges and scraping fine lines along its length.
// Baked once: thickness, its slope, the order the LEDs dry in, the delay of
// the rewetting sweep and the dry grain.
function lay(P) {
  const R = Math.random;
  const h = new Float32Array(N), hb = new Float32Array(N), key = new Float32Array(N);
  const strokes = [];
  for (let k = 0; k < 7; k++) {
    const th = 1.05 + (R() - 0.5) * 0.5;
    strokes.push({
      tx: cos(th), ty: sin(th), nx: -sin(th), ny: cos(th),
      c: -62 + k * 20 + (R() - 0.5) * 8, w: 24 + R() * 10, t: 0.45 + R() * 0.2, tilt: (R() - 0.5) * 0.3,
      f1: 0.9 + R() * 0.6, f2: 2.1 + R() * 0.9, p1: R() * 6.3, p2: R() * 6.3, e1: R() * 6.3, e2: R() * 6.3, run: 0.0025 + R() * 0.002,
    });
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x - 31.5, py = y - 63.5;
      let v = 0.42 + 0.12 * vn(x / 9, y / 9, 3), sc = 0;
      for (const s of strokes) {
        const a = px * s.tx + py * s.ty, n = px * s.nx + py * s.ny;
        const edge = s.w / 2 + 2.2 * sin(a * 0.08 + s.e1) + 1.2 * sin(a * 0.21 + s.e2);
        const off = abs(n - s.c);
        if (off > edge) continue;
        const u = (n - s.c) / edge, rim = edge - off;
        v = s.t + s.tilt * u - s.run * a + 0.32 * exp(-(rim * rim) / 3.2);
        sc = 0.027 * sin(n * s.f1 + s.p1) * (0.6 + 0.4 * sin(a * 0.05 + s.p2)) + 0.014 * sin(n * s.f2 + s.p2);
      }
      hb[y * W + x] = v;
      h[y * W + x] = v + sc + 0.05 * (vn(x / 4, y / 4, 5) - 0.5);
    }
  // The order of drying follows the thickness blurred over a few LEDs, so the
  // front creeps round the ridges instead of fraying along every scrape.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let j = -2; j <= 2; j++)
        for (let i = -2; i <= 2; i++) {
          const xx = x + i, yy = y + j;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          sum += hb[yy * W + xx];
          n++;
        }
      key[y * W + x] = 0.5 * sum / n + 0.5 * hb[y * W + x] + 0.16 * (vn(x / 7, y / 7, 9) - 0.5) + 0.06 * (vn(x / 2.5, y / 2.5, 10) - 0.5);
    }
  const gx = new Float32Array(N), gy = new Float32Array(N), rank = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      gx[i] = (h[y * W + min(W - 1, x + 1)] - h[y * W + max(0, x - 1)]) / 2;
      gy[i] = (h[min(H - 1, y + 1) * W + x] - h[max(0, y - 1) * W + x]) / 2;
    }
  // Thin clay dries first: the LEDs in order of thickness, as a rank 0..1.
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => key[a] - key[b]);
  order.forEach((i, r) => (rank[i] = r / (N - 1)));
  const delay = new Float32Array(N), grain = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      delay[i] = (y + 4 + 3 * sin(x * 0.13 + 1.1) + 3 * vn(x / 5, y / 5, 11)) / (H + 10);
      grain[i] = 0.6 * (R() - 0.5) + 0.4 * (vn(x / 1.7, y / 1.7, 13) - 0.5);
    }
  // Three hairline cracks, each a short wandering line from a thick spot,
  // numbered 0..1 along its length so it opens from one end.
  const crack = new Float32Array(N);
  for (let n = 0; n < 3; n++) {
    let best = 0, bi = 0;
    for (let t = 0; t < 60; t++) {
      const i = floor(R() * N);
      if (h[i] > best && !crack[i]) (best = h[i]), (bi = i);
    }
    let x = bi % W, y = floor(bi / W), a = R() * 2 * PI;
    const len = 14 + floor(R() * 12);
    for (let s = 0; s < len; s++) {
      const i = floor(y) * W + floor(x);
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      crack[i] = max(crack[i], 0.02 + s / len);
      a += (R() - 0.5) * 0.9;
      x += cos(a) * 0.9;
      y += sin(a) * 0.9;
    }
  }
  Object.assign(P, { h, gx, gy, rank, delay, grain, crack });
}

export function setup(params) {
  params.s = {
    c: 0, hue: 0, speed: 2, thick: 0, gloss: 0.06, ts: -0.5, tk: 0, ps: -0.5, pk: 0,
  };
  lay(params.s);
}

// Drying times in clock seconds (one a second at Speed 2): an LED of rank r
// starts to dry at age A0 + r * span and is dry after band more.
const A0 = 1.0, SWEEP = 2.2, HOLD = 1.2;
const spanOf = (t) => 6 + (t < 0 ? 3.5 * t : 5 * t);
const bandOf = (t) => 1.6 + (t < 0 ? -1.2 * t : -0.6 * t);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.thick = cl(k[2], -1, 1);
  P.gloss = cl(k[3], -1, 1);
  P.c += d * P.speed * 0.5;
  const span = spanOf(P.thick), band = bandOf(P.thick);
  const sweeping = P.c < P.ts + P.tk * SWEEP;
  const allDry = P.c - (P.ts + P.tk * SWEEP) > A0 + span + band + HOLD;
  if (!sweeping && (allDry || (input.btnPressed && input.btnPressed[0]))) {
    (P.ps = P.ts), (P.pk = P.tk), (P.ts = P.c), (P.tk = 1);
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { h, gx, gy, rank, delay, grain, crack } = P;
  const span = spanOf(P.thick), band = bandOf(P.thick), c = P.c;
  const relief = 2.4 + 1.6 * P.thick, g = P.gloss;
  // A lamp above the panel drifts slowly, and the wet clay mirrors it as a
  // soft spot that the ridges and scrapes break into streaks.
  const la = 0.3 * c;
  const Lx = 32 + 46 * sin(la), Ly = 60 + 70 * sin(0.63 * la + 1.2), Lz = 150;
  const Ex = 32, Ey = 70, Ez = 260;
  const shin = 14 + 30 * (g + 1), specK = 0.25 + 0.5 * (g + 1) / 2;
  const hue = P.hue + 0.935;
  const wet = [0, 0, 0], dry = [0, 0, 0], deep = [0, 0, 0];
  hsv(hue, 0.64 + 0.08 * g, 0.56 - 0.05 * g, wet, 0);
  hsv(hue + 0.01, 0.12, 0.92, dry, 0);
  hsv(hue + 0.005, 0.3, 0.84, deep, 0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const tNew = P.ts + P.tk * SWEEP * delay[i];
      const fresh = c >= tNew;
      const tw = fresh ? tNew : P.ps + P.pk * SWEEP * delay[i];
      const age = c - tw;
      const D = cl((age - A0 - rank[i] * span) / band, 0, 1);
      const nx = -gx[i] * relief, ny = -gy[i] * relief, nl = 1 / sqrt(nx * nx + ny * ny + 1);
      let lx = Lx - x, ly = Ly - y, lz = Lz;
      const li = 1 / sqrt(lx * lx + ly * ly + lz * lz);
      (lx *= li), (ly *= li), (lz *= li);
      let vx = Ex - x, vy = Ey - y, vz = Ez;
      const vi = 1 / sqrt(vx * vx + vy * vy + vz * vz);
      let hx = lx + vx * vi, hy = ly + vy * vi, hz = lz + vz * vi;
      const hi = 1 / sqrt(hx * hx + hy * hy + hz * hz);
      const dif = (nx * lx + ny * ly + lz) * nl;
      const nh = max(0, (nx * hx + ny * hy + hz) * hi * nl);
      // Wet: deep colour shaded by the relief, with the sheen. The sheen
      // goes first as the surface turns matte, then the colour lifts.
      const shiny = 1 - sm(0, 0.3, D), lift = sm(0.12, 1, D);
      // Behind the rewetting band the clay carries a film of water, with a
      // bright line where the band's edge is.
      const water = fresh && P.tk ? sm(1.1, 0, age) : 0, rim = fresh && P.tk ? sm(0.06, 0, age) : 0;
      const spec = (specK * shiny * nh ** shin + water * (0.35 * nh ** 90 + 0.05) + 0.3 * rim) * 255;
      const shade = (0.62 + 0.45 * dif) * (1 - 0.18 * water);
      // Dry: pale and chalky, the thick ridges keeping a little more colour.
      const th = sm(0.45, 0.85, h[i]), gr = 1 + 0.13 * grain[i], ds = (0.84 + 0.2 * dif) * gr;
      let dr = (dry[0] + (deep[0] - dry[0]) * th) * ds, dg = (dry[1] + (deep[1] - dry[1]) * th) * ds, db = (dry[2] + (deep[2] - dry[2]) * th) * ds;
      // A hairline crack opens where a crack runs, once that spot is dry.
      const ck = crack[i];
      if (ck > 0) {
        const k = sm(0.6 + 1.4 * ck, 0.9 + 1.4 * ck, age - A0 - rank[i] * span - band);
        const f = 0.55 * k;
        (dr += (deep[0] * 0.7 - dr) * f), (dg += (deep[1] * 0.7 - dg) * f), (db += (deep[2] * 0.7 - db) * f);
      }
      const wr = wet[0] * shade, wg = wet[1] * shade, wb = wet[2] * shade;
      const r = wr + (dr - wr) * lift + spec;
      const gg = wg + (dg - wg) * lift + spec;
      const b = wb + (db - wb) * lift + spec * 0.96;
      display.setPixel(x, y, min(255, r), min(255, gg), min(255, b));
    }
}
