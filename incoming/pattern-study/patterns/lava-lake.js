// ===== Patternflow pattern =====
// Title:   Lava Lake
// Family:  volcano
// Idea:    Looking straight down into a lava lake at night: plates of black crust drift away from a glowing spreading crack that steps sideways at a transform fault, toward the terraced crater walls, where they tilt and go under a bright seam, while gas bubbles burst and throw spatter that lands and darkens and steam drifts off the walls.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after the lava lakes of Erta Ale and Nyiragongo seen from the crater rim
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Heat=0..1, Speed=0.2..3, Plates=0..1, Spatter=0..1
//
// Knob 1: Heat. At 0 the lake is crusted over and only thin red-orange seams show between the plates; turned up, the seams and the crack open into rivers of orange lava with dark skin wrinkling on them, the young crust glows further from the crack and the walls and steam burn brighter.
// Knob 2: Speed. At 2 the plates drift about a LED and a half a second, so a plate born at the crack reaches the bottom wall in about half a minute; at 0.2 ten times slower.
// Knob 3: Plates. At 0 plates about eighteen LEDs wide and thirteen tall and one transform fault in the crack; turned up, the crust breaks into plates under half that size and the crack steps sideways at two faults, then three.
// Knob 4: Spatter. How often gas bubbles burst: at the start a small one every two seconds or so; turned up they come faster and bigger, past the middle some throw fountains, and the fumaroles in the walls steam harder.
// Buttons: K1 tap bursts a big gas bubble that throws a fountain of spatter for two seconds. K2 tap founders a plate below the crack: its edges melt in as it tilts and sinks, and the hole skins over in small new plates.

const W = 64, H = 128, N = W * H;
// Sparks at most; plates are 1 / AX wider than tall, stretched along the
// crack; the crust drifts V LEDs per second at Speed 2.
const MAXP = 700, AX = 0.72, V = 1.6;
const { min, max, floor, round, sin, cos, sqrt, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function h32(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const hash = (i, j) => h32(i, j) / 4294967296;
function vn(x, y, p) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), x0 = xi % p, y0 = yi % p, x1 = (xi + 1) % p, y1 = (yi + 1) % p;
  const a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(x1, y1)) * su * sv;
}
// Smooth noise on a 128 x 128 torus, features about eight texels across.
const NZ = new Float32Array(128 * 128).map((_, k) => 0.65 * vn((k & 127) / 8, (k >> 7) / 8, 16) + 0.35 * vn((k & 127) / 4 + 3, (k >> 7) / 4, 32));
function nz(u, v) {
  const xi = floor(u), yi = floor(v), fx = u - xi, fy = v - yi, x0 = xi & 127, y0 = (yi & 127) << 7, x1 = (x0 + 1) & 127, y1 = ((yi + 1) & 127) << 7;
  const a = NZ[y0 + x0], b = NZ[y0 + x1], c = NZ[y1 + x0];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + NZ[y1 + x1]) * fx * fy;
}
// Lava by temperature: dull red, cherry, orange, yellow, the white of a fresh tear.
const STOPS = [[0, 30, 1, 0], [0.2, 104, 7, 0], [0.4, 184, 27, 2], [0.6, 238, 82, 7], [0.8, 250, 158, 36], [1, 254, 230, 148]];
const LUT = new Float32Array(257 * 3);
for (let q = 0; q <= 256; q++) {
  const T = q / 256;
  let k = 0;
  while (k < 4 && T > STOPS[k + 1][0]) k++;
  const [a, b] = [STOPS[k], STOPS[k + 1]], u = (T - a[0]) / (b[0] - a[0]);
  for (let c = 0; c < 3; c++) LUT[q * 3 + c] = mix(a[c + 1], b[c + 1], u);
}
const lut = (T) => round(cl(T, 0, 1) * 256) * 3;
// exp(-v) for v >= 0, read from a table.
const EX = new Float32Array(1025).map((_, k) => exp(-k / 64)), ex = (v) => (v < 16 ? EX[(v * 64) | 0] : 0);
// sin, read from a table.
const SN = new Float32Array(1024).map((_, k) => sin((k * PI) / 512)), fsin = (a) => SN[(a * 162.97) & 1023];

// The shore of the lake under each column, and where the crater rim is.
const ST = new Float32Array(W), SB = new Float32Array(W), RT = new Float32Array(W), RB = new Float32Array(W);
for (let x = 0; x < W; x++) {
  ST[x] = 17.5 + 2.2 * sin(x * 0.11 + 1) + 1.4 * sin(x * 0.29 + 4) + 1.6 * (vn(x * 0.35, 2, 64) - 0.5);
  SB[x] = 109.5 + 2.4 * sin(x * 0.09 + 3) + 1.3 * sin(x * 0.31) + 1.6 * (vn(x * 0.35, 9, 64) - 0.5);
  RT[x] = 4 + 1.6 * sin(x * 0.07 + 2) + 1.4 * vn(x * 0.4, 5, 64);
  RB[x] = H - 4 - 1.5 * sin(x * 0.08) - 1.4 * vn(x * 0.4, 7, 64);
}
// The walls: old lava beds stacked up the crater, the lip of each catching
// the lake's light, and the rim at the top; a dark grain everywhere.
const WG = new Float32Array(N * 3), WA = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const x = i & 63, y = i >> 6, top = y < 64, u = top ? ST[x] - y - 0.5 : y + 0.5 - SB[x], g = h32(i, 77);
  const q = u * 0.27 + 0.7 * vn(x * 0.1, top ? 1 : 30, 64) + 0.25 * vn(x * 0.4, top ? 4 : 40, 64), k = floor(q) + (top ? 0 : 50), f = q - floor(q);
  WG[i * 3] = (g & 31) * 0.78;
  WG[i * 3 + 1] = ((g >> 5) & 31) * 0.78;
  WG[i * 3 + 2] = ((g >> 10) & 31) * 0.78;
  const rim = top ? RT[x] - y - 0.5 : y + 0.5 - RB[x];
  WA[i] = rim > 0.5 ? 0 : (rim > -0.5 ? 0.9 : (0.5 + 0.5 * hash(k, 3)) * sm(0.34, 0.08, f) * sm(0.12, 0.32, vn(x * 0.25, k * 7, 64))) * (0.8 + 0.4 * hash(i, 5));
}

// The fumaroles, each as its column and its height above the shore; the
// last number is 1 on the top wall.
const VENTS = [[6, 5, 1], [27, 8, 1], [44, 4.5, 1], [15, 4.5, 0], [36, 7, 0], [55, 5, 0]];
// Where the spreading crack steps sideways, and by how much: one fault at
// the start, two or three as the crust breaks up.
const FAULTS = [[27, 11], [17, 9, 45, -8], [12, 8, 31, -10, 50, 8]];

export function setup(params) {
  const F32 = (n) => new Float32Array(n);
  params.s = {
    PX: F32(MAXP), PY: F32(MAXP), PVX: F32(MAXP), PVY: F32(MAXP), PF: F32(MAXP), PT: F32(MAXP), PG: new Int8Array(MAXP), np: 0,
    t: 0, off: 0, k3: -1, heat: 0, spat: 0.06, c: 13, pm: 0.18, tf: FAULTS[0], rb: 50,
    bubs: [], fl: [], hot: [], puffs: [], vt: [0, 0, 0, 0, 0, 0], fnd: null, fe: 0, next: 1.2, nfl: 0.5,
  };
}

function ridge(S, x) {
  let y = S.rb + 2.2 * sin(x * 0.085 + S.t * 0.05) + 1.3 * sin(x * 0.23 - S.t * 0.037 + 2);
  for (let k = 0; k < S.tf.length; k += 2) y += S.tf[k + 1] * (1 / (1 + exp(-(x - S.tf[k]) / 0.6)) - 0.5);
  return y;
}

// The crust on each side of the crack is one rigid sheet sliding away from
// it, so its plates are cells of a jittered grid in the sheet's own frame.
// Each frame the grid points the panel can see are kept in a table (tab).
const CELL = { id: 0, px: 0, py: 0, e: 9, em: 9 }, TPX = new Float32Array(2048), TPY = new Float32Array(2048), TID = new Uint32Array(2048), GY0 = [0, 0];
let GX0 = 0, TW = 1;
const grid = (gx, gy, s) => h32(gx + s * 7919, gy);
function table(off, c) {
  (GX0 = floor((-3 * AX) / c) - 2), (TW = floor((67 * AX) / c) + 3 - GX0);
  for (let s = 0; s < 2; s++) {
    const y0 = (s ? -off : off) + s * 300 - 3, n = floor((y0 + 134) / c) + 3 - (GY0[s] = floor(y0 / c) - 2);
    for (let j = 0; j < n * TW && j < 1024; j++) {
      const gx = GX0 + (j % TW), gy = GY0[s] + floor(j / TW), h = grid(gx, gy, s), q = s * 1024 + j;
      (TID[q] = h), (TPX[q] = gx + 0.05 + 0.9 * ((h & 65535) / 65536)), (TPY[q] = gy + 0.05 + 0.9 * ((h >>> 16) / 65536));
    }
  }
}
function cells(xx, ya, s, c, pm, tab) {
  const u = (xx * AX) / c, v = ya / c, cu = floor(u), cv = floor(v);
  let d1 = 99, d2 = 99, d3 = 99, a1 = 0, b1 = 0, a2 = 0, b2 = 0, a3 = 0, b3 = 0, i1 = 0, i2 = 0, i3 = 0;
  for (let gy = cv - 1; gy <= cv + 1; gy++)
    for (let gx = cu - 1; gx <= cu + 1; gx++) {
      let h, px, py;
      if (tab) {
        const q = s * 1024 + (gy - GY0[s]) * TW + gx - GX0;
        (h = TID[q]), (px = TPX[q]), (py = TPY[q]);
      } else (h = grid(gx, gy, s)), (px = gx + 0.05 + 0.9 * ((h & 65535) / 65536)), (py = gy + 0.05 + 0.9 * ((h >>> 16) / 65536));
      const d = (px - u) * (px - u) + (py - v) * (py - v);
      if (d < d1) (d3 = d2), (a3 = a2), (b3 = b2), (i3 = i2), (d2 = d1), (a2 = a1), (b2 = b1), (i2 = i1), (d1 = d), (a1 = px), (b1 = py), (i1 = h);
      else if (d < d2) (d3 = d2), (a3 = a2), (b3 = b2), (i3 = i2), (d2 = d), (a2 = px), (b2 = py), (i2 = h);
      else if (d < d3) (d3 = d), (a3 = px), (b3 = py), (i3 = h);
    }
  // Some neighbours have frozen together into one bigger, odd-shaped plate.
  let e = (c * (d2 - d1)) / (2 * sqrt(AX * AX * (a1 - a2) ** 2 + (b1 - b2) ** 2) + 1e-6), em = 9;
  if (hash(i1 ^ i2, 99) < pm) {
    em = e;
    e = hash(i1 ^ i3, 99) < pm ? 9 : (c * (d3 - d1)) / (2 * sqrt(AX * AX * (a1 - a3) ** 2 + (b1 - b3) ** 2) + 1e-6);
  }
  (CELL.id = i1), (CELL.px = (a1 * c) / AX), (CELL.py = b1 * c), (CELL.e = e), (CELL.em = em);
  return CELL;
}

function bubble(S, big) {
  const x = 4 + rnd() * 56, y = mix(ST[floor(x)] + 7, SB[floor(x)] - 7, 0.1 + 0.8 * rnd());
  const sg = y < ridge(S, x) ? -1 : 1;
  S.bubs.push({ x, y, sg, t0: S.t, r: big ? 4.5 + 2 * rnd() : 1.2 + rnd() * (1.4 + 1.8 * S.spat), big: big ? 1 : rnd() < S.spat * 0.4 ? 0.6 : 0, done: 0 });
}
function spark(S, x, y, sp, tf) {
  if (S.np >= MAXP) return;
  const i = S.np++, a = rnd() * 2 * PI;
  (S.PX[i] = x), (S.PY[i] = y), (S.PVX[i] = cos(a) * sp), (S.PVY[i] = sin(a) * sp), (S.PF[i] = tf), (S.PT[i] = 0.62 + 0.3 * rnd()), (S.PG[i] = 0);
}

function step(S, d) {
  const t = (S.t += d);
  S.off += V * d;
  // Gas bubbles: a couple of seconds apart at the start, often and bigger with Spatter.
  if ((S.next -= d * (0.35 + 2.2 * S.spat)) <= 0) bubble(S, rnd() < (S.spat - 0.55) * 0.5), (S.next = 0.4 + rnd());
  for (const b of S.bubs) {
    const a = t - b.t0;
    b.y += b.sg * V * d;
    if (a > 0.6 && !b.done) {
      b.done = 1;
      S.fe = max(S.fe, 0.25 + 0.9 * b.big + 0.05 * b.r);
      for (let k = 0; k < 5 + 7 * b.r + 40 * b.big; k++) spark(S, b.x, b.y, 3 + rnd() * (6 + 3 * b.r), 0.25 + rnd() * (0.4 + 0.8 * b.big));
    }
    // A big bubble keeps a fountain going for a while.
    if (b.big && a > 0.6 && a < 0.6 + 2 * b.big) for (let k = 0; k < 2 + 4 * b.big; k++) spark(S, b.x + rnd() - 0.5, b.y + rnd() - 0.5, 2 + rnd() * 13 * b.big, 0.4 + rnd() * 1.1 * b.big);
  }
  S.bubs = S.bubs.filter((b) => t - b.t0 < 5);
  // Sparks fly out from the burst, land on the crust and ride it as they cool.
  const { PX, PY, PVX, PVY, PF, PT, PG } = S;
  let j = 0;
  for (let i = 0; i < S.np; i++) {
    if (PF[i] > 0) {
      (PX[i] += PVX[i] * d), (PY[i] += PVY[i] * d);
      if ((PF[i] -= d) <= 0) {
        const x = floor(cl(PX[i], 0, W - 1));
        PG[i] = PY[i] < ST[x] || PY[i] > SB[x] ? 0 : PY[i] < ridge(S, PX[i]) ? -1 : 1;
      }
    } else (PT[i] -= d * 0.28), (PY[i] += PG[i] * V * d);
    if (PT[i] <= 0 || PX[i] < -2 || PX[i] > W + 2 || PY[i] < -2 || PY[i] > H + 2) continue;
    (PX[j] = PX[i]), (PY[j] = PY[i]), (PVX[j] = PVX[i]), (PVY[j] = PVY[i]), (PF[j] = PF[i]), (PT[j] = PT[i]), (PG[j] = PG[i]), j++;
  }
  S.np = j;
  // Where plates dive under the walls the crust breaks with a flash.
  if ((S.nfl -= d * V) <= 0) S.fl.push({ x: rnd() * W, top: rnd() < 0.4, t0: t, a: 0.4 + 0.6 * rnd() }), (S.nfl = 0.3 + 1.1 * rnd());
  S.fl = S.fl.filter((f) => t - f.t0 < 1.6);
  // Fumaroles in the walls breathe out puffs that the wind takes along the rim.
  VENTS.forEach(([x, u, top], k) => {
    if ((S.vt[k] -= d * (1.6 + 3 * S.spat)) <= 0) (S.vt[k] = 0.6 + 0.6 * rnd()), S.puffs.push({ x: x + rnd() - 0.5, u, top, t0: t, r: 1.4 + rnd() + 2 * S.spat });
  });
  for (const p of S.puffs) (p.x += (2.2 + 0.6 * sin(t * 0.3)) * d), (p.u += 1.1 * d);
  S.puffs = S.puffs.filter((p) => t - p.t0 < 4.5 && p.x < W + 6);
  S.fe *= exp(-d / 0.5);
  // A foundering plate sinks for two seconds, then the hole crusts over.
  const f = S.fnd;
  if (f && t - f.t0 > 2.2) S.hot.push({ s: f.s, id: f.id, t }), (S.fnd = null);
  S.hot = S.hot.filter((h) => t - h.t < 7);
}

function founder(S) {
  if (S.fnd) return;
  const x = 16 + rnd() * 32, y = 72 + rnd() * 16, c = cells(x, y - S.off + 300, 1, S.c, S.pm);
  S.fnd = { s: 1, id: c.id, t0: S.t };
  S.fe = max(S.fe, 0.5);
  for (let k = 0; k < 24; k++) spark(S, x + (rnd() - 0.5) * S.c, y + (rnd() - 0.5) * S.c * 0.7, 2 + 5 * rnd(), 0.2 + 0.4 * rnd());
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], k3 = cl(k[2], 0, 1);
  S.heat = cl(k[0], 0, 1);
  S.spat = cl(k[3], 0, 1);
  if (abs(k3 - S.k3) > 0.005) (S.k3 = k3), (S.c = mix(13, 6, k3)), (S.pm = mix(0.18, 0.06, k3)), (S.tf = FAULTS[min(2, floor(k3 * 2.6))]), (S.fnd = null);
  const p = input.btnPressed || [];
  if (p[0]) bubble(S, 1), (S.bubs[S.bubs.length - 1].t0 -= 0.3);
  if (p[1]) founder(S);
  step(S, cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3) * 0.5);
}

const F = new Float32Array(N * 3), SD = new Float32Array(N), RC = new Float32Array(W + 2), RMN = new Float32Array(W), RMX = new Float32Array(W);
const LAKE = [205, 80, 46], STEAM = [170, 112, 100], FL = new Float32Array(W * 2), SHN = new Float32Array(W * 2), WRN = new Float32Array(W), HS = new Int8Array(8), HI = new Uint32Array(8), HT = new Float32Array(8);

// The distance from (x, y) to the crack, along its line through the column centres.
let STEEP = 0;
function ridgeDist(x, xx, yy) {
  let best = 1e9;
  for (let c = max(0, x - 5); c < min(W, x + 5); c++) {
    const ax = c + 0.5, ay = RC[c], ey = RC[c + 1] - ay;
    const u = cl((xx - ax + (yy - ay) * ey) / (1 + ey * ey), 0, 1), dx = xx - ax - u, dy = yy - ay - ey * u, d = dx * dx + dy * dy;
    if (d < best) (best = d), (STEEP = abs(ey));
  }
  return sqrt(best);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.k3 < 0) return;
  const { t, heat, off, c: C } = S;
  for (let x = 0; x < W + 1; x++) RC[x] = ridge(S, x + 0.5);
  for (let x = 0; x < W; x++) {
    let a = 1e9, b = -1e9;
    for (let c = max(0, x - 5); c <= min(W, x + 5); c++) (a = min(a, RC[c])), (b = max(b, RC[c]));
    (RMN[x] = a), (RMX[x] = b), (WRN[x] = 0.5 + nz(x * 0.9 + 70, t * 0.7 + 20));
    for (let s = 0; s < 2; s++) SHN[x * 2 + s] = sm(0.3, 0.75, nz(x * 1.4 + 90 + s * 40, t * 0.5));
  }
  const LL = (0.5 + 0.75 * heat) * (0.92 + 0.08 * sin(t * 0.45)) + S.fe;
  const ws0 = 0.42 + 2.5 * heat, wr0 = 0.8 + 3.4 * heat, Lc = 1.6 + 7 * heat, opA = 0.22 - 0.3 * heat;
  table(off, C);
  const fnd = S.fnd, fp = fnd ? cl((t - fnd.t0) / 2.2, 0, 1) : 0, nh = min(8, S.hot.length);
  for (let k = 0; k < nh; k++) (HS[k] = S.hot[k].s), (HI[k] = S.hot[k].id), (HT[k] = S.hot[k].t);
  // Flashes along each shore, per column.
  FL.fill(0);
  for (const f of S.fl) for (let x = 0; x < W; x++) FL[x * 2 + (f.top ? 0 : 1)] += f.a * exp(-(((x + 0.5 - f.x) / 2.6) ** 2)) * sm(0, 0.1, t - f.t0) * exp(-(t - f.t0) / 0.45);

  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 3, xx = x + 0.5, st = ST[x], sb = SB[x];
      if (yy < st || yy > sb) {
        // Crater wall, lit red from the lake below: its foot, then the lip of each bed.
        const top = yy < st, u = top ? st - yy : yy - sb, a = WA[i];
        const lw = LL * (1.7 * ex(u / 1.6) * (0.6 + 0.6 * a) + 2.4 * a * ex(u / 11));
        for (let c = 0; c < 3; c++) F[o + c] = WG[o + c] + LAKE[c] * lw;
        continue;
      }
      const up = yy < RC[x], s = up ? 0 : 1, sg = up ? -1 : 1, ya = yy - sg * off + s * 300;
      // Plate edges bend a little: the grid is read through a slow warp.
      const n1 = nz(xx * 1.3, ya * 1.3), n2 = nz(xx * 0.6 + 40, ya * 0.6), P = cells(xx + 3 * (n2 - 0.5), ya + 2.6 * (n1 - 0.5), s, C, S.pm, 1), id = P.id, e = P.e, em = P.em, px = P.px, py = P.py;
      STEEP = 0;
      const dr = yy > RMN[x] - 7 && yy < RMX[x] + 7 ? ridgeDist(x, xx, yy) : abs(yy - RC[x]) * 0.92, tf = sm(1.2, 3, STEEP);
      const ds = up ? yy - st : sb - yy;

      // The crust: black, its grain and ropes fixed to the plate.
      const lx = xx - px, ly = (ya - py) * sg, g = h32(x + s * 131, round(ya) + 5003), pt = (id & 255) / 255;
      const rope = fsin(ly * 1.9 + 0.05 * lx * lx + pt * 40) * (0.6 + 0.4 * fsin(lx * 0.4 + pt * 9)), tilt = 0.45 + 0.55 * sm(0, 4, ds);
      let cr = ((g & 31) * 0.76 + rope * 1.5 + pt * 2) * tilt, cg = (((g >> 5) & 31) * 0.74 + rope * 2) * tilt, cb = (((g >> 10) & 31) * 0.76 + rope * 2.5 + pt * 2.5) * tilt;
      // Young crust near the crack still glows through; so does a plate that foundered and froze over.
      let Tc = 0.62 * ex(dr / Lc) * (0.65 + 0.7 * n1), hot = 99;
      for (let k = 0; k < nh; k++) if (HS[k] === s && HI[k] === id) hot = t - HT[k];
      if (hot < 7) Tc = max(Tc, 0.9 * exp(-hot / 0.7) * (0.75 + 0.5 * n2));
      Tc = max(Tc, 0.22 * ex(e / 0.7) * (0.6 + heat));
      if (Tc > 0.02) {
        const L = lut(Tc), gl = sm(0, 0.5, Tc) * (0.75 + 0.03 * ((g >> 12) & 15));
        (cr += LUT[L] * gl), (cg += LUT[L + 1] * gl), (cb += LUT[L + 2] * gl);
      }
      if (em < 1.2) cr += 14 * sm(1.2, 0.2, em + 0.8 * (n1 - 0.5));
      // Seams between plates: some open and red, some crusted shut; near the crack they spread wider.
      const ws = ws0 * (0.4 + 1.2 * n1) * (1 + 0.7 * ex(dr / 6)), op = sm(opA, opA + 0.12, n1);
      let A = e < ws + 0.35 ? sm(ws + 0.35, ws - 0.25, e) * op : 0, T = 0.57 + 0.27 * heat + 0.12 * ex(dr / 8) + 0.36 * (n2 - 0.5);
      // The spreading crack: the hottest lava, opening and closing along its length.
      const wr = wr0 * WRN[x] * (1 - 0.6 * tf), ar = dr < wr + 0.6 ? sm(wr + 0.6, wr - 0.4, dr) : 0;
      if (ar > A) (A = ar), (T = 0.9 + 0.1 * heat - 0.3 * (dr / (wr + 0.6)) ** 2 + 0.25 * (n1 - 0.5) - 0.3 * tf);
      // The shore where the crust dives under, flashing as it breaks.
      const sh = ds < 5 ? sm(1.7, 0.2, ds) * SHN[x * 2 + s] + 0.7 * ex(e / 1.2) * sm(5, 0.5, ds) + FL[x * 2 + s] * sm(4, 0.3, ds) : 0;
      if (sh > A) (A = min(1, sh)), (T = 0.45 + 0.3 * heat + 0.3 * min(1, sh) + 0.2 * (n2 - 0.5));
      // A foundering plate: its edges melt inward as it tilts and sinks.
      if (fnd && fnd.s === s && fnd.id === id) {
        const fa = sm(fp * 0.5 * C + 0.6, fp * 0.5 * C - 0.4, e);
        (cr *= 1 - 0.6 * fp), (cg *= 1 - 0.6 * fp), (cb *= 1 - 0.6 * fp);
        if (fa > A) (A = fa), (T = 0.62 + 0.3 * (1 - fp) + 0.2 * (n1 - 0.5));
      }
      if (hot < 7) {
        // The hole skins over in small new plates, their cracks narrowing and dimming.
        const k = exp(-hot / 1.3), w = 0.3 + 3.5 * k * k * k, ha = sm(w + 0.5, w - 0.4, cells(xx, ya, s + 2, 4.5, 0).e) * sm(7, 4, hot);
        if (ha > A) (A = ha), (T = 0.24 + 0.72 * k + 0.8 * k * (nz(xx * 2.4, ya * 2.4 + 9) - 0.5));
      }
      if (A > 0.003) {
        // Open lava wrinkles a dark skin on itself as it cools.
        const sw = hot < 7 ? 0.8 : sm(0.2, 0.6, heat), sk = A > 0.5 && sw > 0 ? sm(0.07, 0.01, abs(nz(xx * 2.2 + 5, ya * 2.2) - 0.5)) * sw * 0.7 : 0;
        const L = lut(T), b = A * (1 - sk);
        (cr = mix(cr, LUT[L] + ((g >> 15) & 15) - 7.5, b)), (cg = mix(cg, LUT[L + 1] + ((g >> 19) & 31) * 0.8 - 12, b)), (cb = mix(cb, LUT[L + 2] + ((g >>> 24) & 31) * 0.8, b));
      }
      (F[o] = cr), (F[o + 1] = cg), (F[o + 2] = cb);
    }
  }
  overlay(S, t);
  // Exposed for the lava, as a night photograph of a lava lake is: what only
  // glows faintly sinks back into the black of the crust.
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const m = max(F[o], F[o + 1], F[o + 2]), k = m > 24 && m < 60 ? (12 + (m - 24) * 1.333) / m : 1;
    display.setPixel(i & 63, i >> 6, cl(F[o] * k, 0, 255) | 0, cl(F[o + 1] * k, 0, 255) | 0, cl(F[o + 2] * k, 0, 255) | 0);
  }
}

function add(x, y, L, a) {
  (x = floor(x)), (y = floor(y));
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  for (let c = 0; c < 3; c++) F[o + c] = mix(F[o + c], LUT[L + c], min(1, a));
}

function overlay(S, t) {
  // Bubbles: the crust domes and cracks in a ring, then tears open and freezes over.
  for (const b of S.bubs) {
    const a = t - b.t0, R = b.r, E = R * 1.3 + 2, fnt = 2 * b.big;
    for (let y = max(0, floor(b.y - E)); y < min(H, b.y + E); y++)
      for (let x = max(0, floor(b.x - E)); x < min(W, b.x + E); x++) {
        if (y < ST[x] || y > SB[x]) continue;
        const dx = x + 0.5 - b.x, dy = y + 0.5 - b.y, d = sqrt(dx * dx + dy * dy), o = (y * W + x) * 3;
        let A, T;
        if (a < 0.6) {
          // The crust domes up and cracks: a ring and spokes.
          const p = a / 0.6, rr = R * (0.6 + 0.4 * p), sp = d < rr ? sm(0.3, 0.08, abs(sin(Math.atan2(dy, dx) * 2.5 + b.r))) * sm(0.5, rr, d) : 0;
          (A = p * max(sm(1, 0.2, abs(d - rr)), 0.8 * sp)), (T = 0.4 + 0.45 * p);
        } else {
          // Torn open: white-hot, churning while a fountain plays, then a skin
          // closes over it in small plates, as over a foundered one.
          const c = a - 0.6, hot = c < fnt ? 1 : exp(-(c - fnt) / (0.4 + 0.2 * R)), sk = nz(x * 2.3 + b.r * 9, y * 2.3 + b.t0 * 7 + (c < fnt ? c * 5 : 0));
          const rr = R * (c < fnt ? 0.6 : 1) * (0.7 + 0.8 * nz(x * 1.1 + b.r * 5, y * 1.1 + 40)), w = 0.3 + 3 * hot * hot * hot;
          (A = sm(rr + 0.5, rr - 0.5, d) * sm(w + 0.5, w - 0.4, cells(dx + 40, dy + 40, 9 + floor(b.r * 97), 3.2, 0).e) * sm(0, 0.15, hot)), (T = 0.22 + 0.66 * hot - (0.2 * d) / R + 0.5 * (sk - 0.5) + (c < fnt ? 0.25 * sm(R * 0.6, 0, d) : 0));
          A = max(A, 0.9 * sm(1, 0.2, abs(d - R * 1.15)) * exp(-c / 0.35));
        }
        if (A > 0) {
          const L = lut(T);
          for (let k = 0; k < 3; k++) F[o + k] = mix(F[o + k], LUT[L + k], min(1, A));
        }
      }
  }
  // Steam: soft puffs that swell and thin out, lit from the lake below.
  SD.fill(0);
  for (const p of S.puffs) {
    const a = t - p.t0, r = p.r + 0.8 * a, al = sm(0, 0.5, a) * sm(4.5, 1.5, a);
    const sx = p.top ? ST[cl(floor(p.x), 0, W - 1)] : SB[cl(floor(p.x), 0, W - 1)], yc = p.top ? sx - p.u : sx + p.u;
    for (let y = max(0, floor(yc - r)); y < min(H, yc + r + 1); y++) {
      const u = p.top ? sx - y - 0.5 : y + 0.5 - sx, dy = (u - p.u) / 0.8;
      if (abs(dy) > r) continue;
      for (let x = max(0, floor(p.x - r)); x < min(W, p.x + r); x++) {
        const dx = x + 0.5 - p.x, q = 1 - (dx * dx + dy * dy) / (r * r);
        if (q <= 0) continue;
        SD[y * W + x] += al * q * q * (0.45 + 0.55 * ex(max(0, u) / 7)) * (0.7 + 0.6 * nz(x * 1.7 + p.t0 * 13, y * 1.7));
      }
    }
  }
  const sl = min(1, (0.65 + 0.6 * S.spat) * (S.fe + 0.6 + 0.6 * S.heat));
  for (let i = 0, o = 0; i < N; i++, o += 3) if (SD[i] > 0.01) for (let c = 0; c < 3; c++) F[o + c] += STEAM[c] * sl * min(1, SD[i]) * (1 - F[o + c] / 255);
  // Sparks: white-hot in the air, orange where they land, then dull red and gone.
  const { PX, PY, PVX, PVY, PF, PT, np } = S;
  for (let i = 0; i < np; i++) {
    if (PF[i] > 0) {
      const L = lut(0.93 + 0.07 * sin(i));
      add(PX[i], PY[i], L, 1), add(PX[i] - PVX[i] * 0.04, PY[i] - PVY[i] * 0.04, L, 0.5);
    } else add(PX[i], PY[i], lut(PT[i] * 0.85), sm(0, 0.3, PT[i]));
  }
}
