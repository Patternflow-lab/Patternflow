// ===== Patternflow pattern =====
// Title:   Ehrenfest Urn
// Family:  particle
// Idea:    N balls start in the upper of two chambers stacked down the panel and joined by a narrow neck, and every step one ball chosen at random darts through the neck to the other side, while a strip at the foot traces the count in the upper chamber falling from N to N/2 along its expected curve and then hovering inside the binomial spread, with the time spent at each count piling up beside it into the binomial bell, and the chambers flash each time the count comes back to the state the fourth knob watches.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ehrenfest urn model (Paul and Tatjana Ehrenfest, 1907), its mean recurrence times (Mark Kac, 1947), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Balls=8..200, Watch=0..1
//
// Knob 1: Hue. Turns the two chambers' colours round the wheel together, nearly half a wheel apart: at 0 the balls in the upper chamber are gold and those in the lower one azure, and a ball changes colour as it goes through the neck.
// Knob 2: Speed. Steps a second, 5 times Speed times the square root of N / 8: 10 at 2 with 8 balls, so the all-up state, 256 steps apart on average, comes back about every 26 s; 50 at 2 with 200 balls. A step's flight takes 1.8 steps' time, between 0.12 and 0.5 s.
// Knob 3: Balls. N, 8 to 200. Turning it starts again with every ball in the upper chamber. At 8 the count drops to 4 within a second and swings by 1.4 either side; at 200 the distance to 100 halves every 69 steps, 1.4 s at Speed 2, and the count swings by 7, and the all-up state would take 2^200 steps to come back.
// Knob 4: Watch. Which count the flash watches, from N (every ball up, the start) below 0.08 down to N/2 at 1. Kac's mean return time to count k is 2^N / C(N, k) steps: 256 for k = 8 of 8, 9.1 for k = 6 and 3.7 for k = 4, so the flash goes from rare to nearly every step. A dotted line on the trace marks the count, and a tick above the trace each visit.

const W = 64, H = 128, NP = W * H;
const { floor, round, min, max, sqrt, exp, abs, pow, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The vessel. Two rounded chambers 62 by 44 LEDs, the upper from row 1
// to 44 and the lower from 51 to 94, joined by a neck 6 LEDs wide (x 29 to
// 34) and 6 rows long. The trace takes rows 96 to 126.
const CH = [
  { x0: 1, y0: 51, x1: 62, y1: 94 }, // side 0: lower
  { x0: 1, y0: 1, x1: 62, y1: 44 }, // side 1: upper
];
const NX0 = 29, NX1 = 34, NECK = 31.5;
const MOUTH = [52.5, 43.5]; // the row a ball passes as it leaves each chamber

// Wall brightness 0..1 per LED: the outline of each rounded rectangle (corner
// radius 5), open where the neck meets it, and the neck's two sides.
const WALL = new Float32Array(NP);
function rrect(px, py, c) {
  const r = 5, cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, hx = (c.x1 - c.x0) / 2 - r, hy = (c.y1 - c.y0) / 2 - r;
  const qx = abs(px - cx) - hx, qy = abs(py - cy) - hy;
  return sqrt(max(qx, 0) ** 2 + max(qy, 0) ** 2) + min(max(qx, qy), 0) - r;
}
for (let y = 0; y < 96; y++)
  for (let x = 0; x < W; x++) {
    const px = x, py = y;
    let v = 0;
    for (const c of CH) v = max(v, 1 - abs(rrect(px, py, c)));
    if (x >= NX0 && x <= NX1 && y >= 43 && y <= 52) v = 0;
    if ((x === NX0 - 1 || x === NX1 + 1) && y >= 44 && y <= 51) v = 1;
    WALL[y * W + x] = cl(v, 0, 1);
  }
// The LEDs inside either chamber or the neck.
const INSIDE = new Uint8Array(NP);
for (let y = 0; y < 96; y++)
  for (let x = 0; x < W; x++)
    INSIDE[y * W + x] = WALL[y * W + x] <= 0 && (rrect(x, y, CH[0]) < 0 || rrect(x, y, CH[1]) < 0 || (x >= NX0 && x <= NX1 && y > 44 && y < 51)) ? 1 : 0;

// ---- The trace. Count n of N maps to row TY1 - n / N * (TY1 - TY0): all up
// on row 99, none up on row 126. 52 columns of history (x 0 to 51), then a
// gap, then the time spent at each count as bars from x 54 to 63.
const TY0 = 99, TY1 = 126, TCOLS = 52, HX = 54, HW = 10, RUG = 97;
const rowOf = (n, N) => TY1 - (n / N) * (TY1 - TY0);

// log C(N, k), for the binomial law the count settles to: C(N, k) / 2^N.
function logC(N, k) {
  let s = 0;
  for (let i = 1; i <= k; i++) s += log(N - k + i) - log(i);
  return s;
}

function gauss() {
  // Box-Muller from the seeded Math.random.
  const u = 1 - Math.random(), v = Math.random();
  return sqrt(-2 * log(u)) * cos(2 * PI * v);
}

function reset(S, N) {
  S.N = N;
  S.n = N;
  S.x = new Float32Array(N), S.y = new Float32Array(N), S.vx = new Float32Array(N), S.vy = new Float32Array(N);
  S.side = new Uint8Array(N).fill(1);
  // A flight: start time, length, and the four points start, mouth, other mouth, end.
  S.ft = new Float32Array(N).fill(-1), S.fd = new Float32Array(N), S.fp = new Float32Array(N * 8);
  const c = CH[1];
  for (let i = 0; i < N; i++) {
    S.x[i] = c.x0 + 4 + Math.random() * (c.x1 - c.x0 - 8);
    S.y[i] = c.y0 + 4 + Math.random() * (c.y1 - c.y0 - 8);
  }
  // Radius 3.3 at N = 8, 1.25 at 200.
  S.r = 3.3 * pow(8 / N, 0.3);
  // Steps per trace column: 2 at N = 8, 10 at N = 200, so the 52 columns
  // hold 104 and 520 steps, a little over 5 relaxation times at 200.
  S.per = max(1, round(2 * sqrt(N / 8)));
  S.cols = [];
  S.cur = { mn: N, mx: N, last: N, hit: 1, g: 0 };
  S.steps = 0;
  S.g = 0;
  S.time = new Float64Array(N + 1);
  S.time[N] = 1;
  // The law the count settles to, C(N, k) / 2^N, summed into trace rows.
  S.law = new Float64Array(H);
  const l2 = N * log(2);
  for (let k = 0; k <= N; k++) S.law[round(rowOf(k, N))] += exp(logC(N, k) - l2);
  S.lawMax = 0;
  for (let y = TY0; y <= TY1; y++) S.lawMax = max(S.lawMax, S.law[y]);
  S.flash = 1;
}

function step(S) {
  const N = S.N, i = floor(Math.random() * N);
  const from = S.side[i], to = 1 - from;
  S.side[i] = to;
  S.n += to ? 1 : -1;
  // Fly from wherever the ball is now through the neck to a random place in
  // the other chamber. A ball still flying that has not yet passed the
  // middle of the neck turns round inside the chamber it is in.
  const p = ballAt(S, i, S.clock), c = CH[to], ox = NECK + (Math.random() - 0.5) * (NX1 - NX0 - 1.5);
  const f = S.fp, o = i * 8, here = p[1] < 48 ? 1 : 0;
  f[o] = p[0], f[o + 1] = p[1];
  if (here === to) (f[o + 2] = f[o + 4] = p[0]), (f[o + 3] = f[o + 5] = p[1]);
  else (f[o + 2] = f[o + 4] = ox), (f[o + 3] = MOUTH[here]), (f[o + 5] = MOUTH[to]);
  f[o + 6] = c.x0 + 4 + Math.random() * (c.x1 - c.x0 - 8);
  f[o + 7] = c.y0 + 4 + Math.random() * (c.y1 - c.y0 - 8);
  S.ft[i] = S.clock;
  S.fd[i] = S.fly;
  // The trace and the clock of counts.
  const cur = S.cur, n = S.n;
  cur.mn = min(cur.mn, n), cur.mx = max(cur.mx, n), cur.last = n;
  S.time[n]++;
  if (n === S.kw) (cur.hit = 1), (S.flash = 1);
  S.steps++;
  if (S.steps % S.per === 0) {
    S.cols.push(cur);
    if (S.cols.length > TCOLS - 1) S.cols.shift();
    S.g++;
    S.cur = { mn: n, mx: n, last: n, hit: 0, g: S.g };
  }
}

// Where ball i is drawn at time `at`: on its flight path, or resting in its chamber.
function ballAt(S, i, at) {
  const t0 = S.ft[i];
  if (t0 < 0) return [S.x[i], S.y[i], -1];
  const u = cl((at - t0) / S.fd[i], 0, 1), e = u * u * (3 - 2 * u), f = S.fp, o = i * 8;
  const l1 = sqrt((f[o + 2] - f[o]) ** 2 + (f[o + 3] - f[o + 1]) ** 2), l2 = abs(f[o + 5] - f[o + 3]);
  const l3 = sqrt((f[o + 6] - f[o + 4]) ** 2 + (f[o + 7] - f[o + 5]) ** 2), L = l1 + l2 + l3;
  let d = e * L, k = 0;
  if (d > l1) (d -= l1), (k = 2);
  if (k === 2 && d > l2) (d -= l2), (k = 4);
  const seg = k === 0 ? l1 : k === 2 ? l2 : l3, a = seg > 0 ? d / seg : 1;
  // The third value says how far through the neck it is, 0 before, 1 after
  // (and 1 all along for a ball turning round on its own side).
  const thr = l1 + l2 === 0 || k === 4 ? 1 : k === 2 ? a : 0;
  return [f[o + k] + (f[o + k + 2] - f[o + k]) * a, f[o + k + 1] + (f[o + k + 3] - f[o + k + 1]) * a, thr, u];
}

export function setup(params) {
  params.s = { clock: 0, acc: 0.6, hue: 0, rate: 10, fly: 0.18, kw: 8, rgb: new Float32Array(NP * 3) };
  reset(params.s, 8);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 8, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  const speed = cl(k[1], 0.2, 3), N = cl(round(k[2]), 8, 200), w = cl(k[3], 0, 1);
  if (N !== S.N) reset(S, N);
  S.kw = N - round((max(0, w - 0.08) / 0.92) * (N / 2));
  S.rate = 5 * speed * sqrt(N / 8);
  S.fly = cl(1.8 / S.rate, 0.12, 0.5);
  S.clock += d;
  S.flash *= exp(-d / 0.3);
  // A gentle jiggle for every ball at rest: velocities relax in 0.6 s and
  // run at about 5 LEDs a second, and the walls turn them back.
  const sig = 9.1 * sqrt(d), r = S.r;
  for (let i = 0; i < N; i++) {
    if (S.ft[i] >= 0) {
      if (S.clock - S.ft[i] < S.fd[i]) continue;
      // Landed: rest where the flight ended.
      S.x[i] = S.fp[i * 8 + 6], S.y[i] = S.fp[i * 8 + 7], S.ft[i] = -1;
    }
    S.vx[i] += -S.vx[i] * (d / 0.6) + sig * gauss();
    S.vy[i] += -S.vy[i] * (d / 0.6) + sig * gauss();
    S.x[i] += S.vx[i] * d, S.y[i] += S.vy[i] * d;
    const c = CH[S.side[i]], a0 = c.x0 + 1.5 + r, a1 = c.x1 - 1.5 - r, b0 = c.y0 + 1.5 + r, b1 = c.y1 - 1.5 - r;
    if (S.x[i] < a0) (S.x[i] = a0), (S.vx[i] = abs(S.vx[i]));
    if (S.x[i] > a1) (S.x[i] = a1), (S.vx[i] = -abs(S.vx[i]));
    if (S.y[i] < b0) (S.y[i] = b0), (S.vy[i] = abs(S.vy[i]));
    if (S.y[i] > b1) (S.y[i] = b1), (S.vy[i] = -abs(S.vy[i]));
  }
  S.acc += d * S.rate;
  for (let s = 0; s < 40 && S.acc >= 1; s++) (S.acc -= 1), step(S);
}

// A ball: a disc of radius r with a brighter middle and a halo that falls
// from a fifth of its brightness at the rim to nothing a radius and a half out.
function disc(rgb, x, y, r, c, a) {
  const R = 2.5 * r + 1;
  for (let j = max(0, floor(y - R)); j <= min(H - 1, floor(y + R)); j++)
    for (let i = max(0, floor(x - R)); i <= min(W - 1, floor(x + R)); i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y, dd = sqrt(dx * dx + dy * dy);
      const core = cl(r + 0.5 - dd, 0, 1) * (1 + 0.5 * exp(-(dd * dd) / (0.3 * r * r)));
      const v = a * max(core, 0.2 * cl(1 - (dd - r) / (1.5 * r), 0, 1) ** 2);
      if (v <= 0.5) continue;
      const o = (j * W + i) * 3;
      rgb[o] += c[0] * v, rgb[o + 1] += c[1] * v, rgb[o + 2] += c[2] * v;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, N } = S;
  const hT = 0.12 + S.hue, hB = hT + 0.45;
  // Walls, band and mean line are only tinted (saturation 0.2 to 0.3): at Hue 0.5
  // the lower colour is orange, and a dim orange would read brown.
  const up = hsv(hT, 0.78, 1), lo = hsv(hB, 0.78, 1), pale = hsv(hT, 0.12, 1), band = hsv(hB, 0.3, 1);
  rgb.fill(0);

  // ---- Walls, flashing white on a visit to the watched count, and the
  // inside of both chambers lit to 40 with them.
  const fl = S.flash, wc = hsv(hB, 0.2 * (1 - fl), 1), wv = 62 + 170 * fl, fv = 40 * fl;
  for (let p = 0; p < 96 * W; p++) {
    const v = WALL[p];
    if (v > 0) rgb[p * 3] = wc[0] * wv * v, rgb[p * 3 + 1] = wc[1] * wv * v, rgb[p * 3 + 2] = wc[2] * wv * v;
    else if (fv > 1 && INSIDE[p]) rgb[p * 3] = pale[0] * fv, rgb[p * 3 + 1] = pale[1] * fv, rgb[p * 3 + 2] = pale[2] * fv;
  }
  // ---- Balls.
  const r = S.r;
  for (let i = 0; i < N; i++) {
    const b = ballAt(S, i, S.clock);
    if (b[2] < 0) {
      disc(rgb, b[0], b[1], r, S.side[i] ? up : lo, 235);
      continue;
    }
    // In flight: brighter, with the colour turning in the neck and two
    // fading copies behind it.
    const to = S.side[i], t = b[2], c0 = to ? lo : up, c1 = to ? up : lo;
    const c = [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    // The copies are paled towards white so a dim one does not read brown.
    for (let k = 2; k >= 0; k--) {
      const q = ballAt(S, i, S.clock - k * 0.025), a = 0.3 * k;
      const ck = [c[0] + (1 - c[0]) * a, c[1] + (1 - c[1]) * a, c[2] + (1 - c[2]) * a];
      disc(rgb, q[0], q[1], r * (1 - 0.2 * k), ck, 255 * pow(0.5, k));
    }
  }

  // ---- The trace. The binomial spread first: rows within one standard
  // deviation sqrt(N)/2 of N/2 at 30, within two at 18.
  const sd = sqrt(N) / 2, m = N / 2;
  for (let y = TY0 - 1; y <= TY1 + 1; y++) {
    const n = ((TY1 - y) / (TY1 - TY0)) * N, z = abs(n - m) / sd;
    const v = z <= 1 ? 30 : z <= 2 ? 18 : 0;
    if (!v) continue;
    for (let x = 0; x < TCOLS; x++) {
      const o = (y * W + x) * 3;
      rgb[o] += band[0] * v, rgb[o + 1] += band[1] * v, rgb[o + 2] += band[2] * v;
    }
  }
  const put = (x, y, c, v) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] = max(rgb[o], c[0] * v), rgb[o + 1] = max(rgb[o + 1], c[1] * v), rgb[o + 2] = max(rgb[o + 2], c[2] * v);
  };
  // The mean N/2, dashed, and the watched count, dotted.
  const ym = round(rowOf(m, N)), yk = round(rowOf(S.kw, N));
  for (let x = 0; x < TCOLS; x++) {
    if (x % 4 < 2) put(x, ym, band, 120);
    if (x % 3 === 0) put(x, yk, pale, 110);
  }
  const cols = S.cols.concat([S.cur]);
  // The expected count from the start, N/2 + (N/2)(1 - 2/N)^t, dim, for the
  // columns still on the trace since the start.
  for (let x = 0; x < cols.length; x++) {
    const t = (cols[x].g + 1) * S.per, e = m + m * pow(1 - 2 / N, t);
    if (e - m < 0.5) continue;
    put(x, round(rowOf(e, N)), pale, 70);
  }
  let prev = cols.length ? cols[0].mx : N;
  for (let x = 0; x < cols.length; x++) {
    const c = cols[x], a = round(rowOf(max(c.mx, prev), N)), b = round(rowOf(min(c.mn, prev), N));
    for (let y = a; y <= b; y++) put(x, y, up, 255);
    if (c.hit) (put(x, RUG, pale, 255), put(x, RUG - 1, pale, 140));
    prev = c.last;
  }
  // The time spent at each count, against the binomial law (bright dots).
  let tot = 0;
  for (let k = 0; k <= N; k++) tot += S.time[k];
  const rows = new Float64Array(H);
  for (let k = 0; k <= N; k++) rows[round(rowOf(k, N))] += S.time[k] / tot;
  for (let y = TY0; y <= TY1; y++) {
    const len = min(HW, (rows[y] / S.lawMax) * (HW - 2)), want = (S.law[y] / S.lawMax) * (HW - 2);
    for (let x = 0; x < len - 0.3; x++) put(HX + x, y, up, 70 + 110 * min(1, len - x));
    if (want >= 0.5) put(HX + round(want), y, pale, 230);
  }

  for (let p = 0; p < NP; p++) {
    const o = p * 3, R = rgb[o], G = rgb[o + 1], B = rgb[o + 2];
    if (R < 1 && G < 1 && B < 1) continue;
    display.setPixel(p % W, (p - (p % W)) / W, min(255, R) | 0, min(255, G) | 0, min(255, B) | 0);
  }
}
