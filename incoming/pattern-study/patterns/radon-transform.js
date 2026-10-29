// ===== Patternflow pattern =====
// Title:   Radon Transform
// Family:  algo
// Idea:    A beam sweeps half a turn round a few ellipses of different densities, the bottom square fills row by row with their sinogram, and each projection is filtered and smeared back across the top square along its own angle, so the ellipses build up out of crossing streaks, hold, and give way to the next, slightly moved phantom.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Radon transform and its inversion (Johann Radon, 1917), filtered back-projection with the ramp filter (G. N. Ramachandran and A. V. Lakshminarayanan, 1971), pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Angles=0..64, Filter=0..1
//
// Knob 1: Hue. Turns both squares round the wheel: at 0 the reconstruction is ice blue running to white and the sinogram violet.
// Knob 2: Speed. How fast the beam turns: half a turn in 6 s at 2, then the picture holds 1.5 s; at 0.2 a half turn takes 60 s, at 3 it takes 4 s.
// Knob 3: Angles. How many projections a half turn takes. 0 takes turns, doubling each cycle from 16: 16, 32, 64, then 4, 8 and round again. 1 to 64 hold that count; with few the shapes are crossed by the star of streaks, one per angle.
// Knob 4: Filter. The filter each projection passes before it is smeared back: (1 - f) c + f |w|, with c the ramp's height at 1/400 of a cycle a sample. At 0 it is plain back-projection, every shape in a blurred 1/r halo; at 0.06 the edges already come through; at 1 it is the ramp alone, sharp, with dark lobes beside every streak.

const W = 64, Q = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The detector: NB bins one LED wide, wide enough to cover the square's
// diagonal, so the corners get their share of every projection. The
// sinogram shows the middle 64.
const NB = 92, MID = (NB - 1) / 2, OFF = (NB - Q) / 2, C = (Q - 1) / 2;
// Ramachandran and Lakshminarayanan's ramp filter in space, one bin apart:
// 1/4 at 0, -1/(pi n)^2 at odd n, 0 at even n. Its response rises as |w|
// from 0 to 1/2 at the Nyquist frequency.
const KER = new Float32Array(2 * NB - 1);
for (let n = -(NB - 1); n < NB; n++) KER[n + NB - 1] = n === 0 ? 0.25 : n & 1 ? -1 / (PI * PI * n * n) : 0;
// The flat part of the Filter knob's blend, in the ramp's units.
const FLAT = 1 / 400;

// A phantom is a list of ellipses [x0, y0, a, b, phi, density]. The line
// integral of one along s at angle th is closed form: with
// r2 = a^2 cos^2(th - phi) + b^2 sin^2(th - phi) and t = s - (x0 cos th +
// y0 sin th) the line's distance from the centre, it is
// 2 rho a b sqrt(r2 - t^2) / r2 where t^2 < r2, and 0 elsewhere.
// One projection, each bin the mean of the lines a quarter bin either side
// of its middle.
function project(E, th, out) {
  out.fill(0);
  const c = cos(th), sn = sin(th);
  for (const [x0, y0, a, b, phi, rho] of E) {
    const ca = cos(th - phi), sa = sin(th - phi);
    const r2 = a * a * ca * ca + b * b * sa * sa, r = sqrt(r2), k = (rho * a * b) / r2, s0 = x0 * c + y0 * sn + MID;
    for (let i = max(0, floor(s0 - r - 1)), e = min(NB - 1, floor(s0 + r + 1)); i <= e; i++)
      for (const d of [-0.25, 0.25]) {
        const t = i + d - s0;
        if (t * t < r2) out[i] += k * sqrt(r2 - t * t);
      }
  }
  return out;
}

function ramp(p, q) {
  for (let i = 0; i < NB; i++) {
    let s = 0;
    for (let j = 0; j < NB; j++) s += p[j] * KER[i - j + NB - 1];
    q[i] = s;
  }
  return q;
}

// Every LED of the top square, (x, y) with y up, takes the value of the
// projection at s = x cos th + y sin th, read between bins.
function smear(acc, p, th) {
  const c = cos(th), sn = sin(th);
  for (let y = 0; y < Q; y++) {
    const u0 = -C * c + (C - y) * sn + MID;
    for (let x = 0, k = y * Q; x < Q; x++, k++) {
      const u = u0 + x * c, i = floor(u);
      if (i < 0 || i >= NB - 1) continue;
      const f = u - i;
      acc[k] += p[i] + (p[i + 1] - p[i]) * f;
    }
  }
}

// The first phantom: a body and five inner shapes, one of them a hole.
function firstPhantom() {
  return [
    [0, 0, 26, 19, 0.3, 0.5],
    [-9, 6, 9, 5, 0.9, 0.35],
    [8, 7, 7, 7, 0, -0.3],
    [5, -9, 10, 4, -0.4, 0.3],
    [-8, -8, 3, 3, 0, 0.7],
    [12, -4, 2, 3.5, 0.5, 0.8],
  ];
}

// The next phantom: the whole turns 26 to 43 degrees, the inner shapes
// drift, and one of them is drawn anew. Everything stays inside a circle of
// 28 LEDs, so every shadow falls inside the 64 bins the sinogram shows.
function nextPhantom(E) {
  const turn = 0.45 + Math.random() * 0.3, ct = cos(turn), st = sin(turn);
  const out = E.map(([x, y, a, b, phi, rho], i) => {
    let nx = x * ct - y * st, ny = x * st + y * ct;
    if (i > 0) {
      nx += (Math.random() - 0.5) * 6, ny += (Math.random() - 0.5) * 6;
      const r = sqrt(nx * nx + ny * ny), lim = 15 - max(a, b) * 0.4;
      if (r > lim) (nx *= lim / r), (ny *= lim / r);
    }
    return [nx, ny, a, b, phi + turn, rho];
  });
  const k = 1 + floor(Math.random() * (out.length - 1)), small = Math.random() < 0.4;
  const a = small ? 2 + Math.random() * 2 : 4 + Math.random() * 6, b = small ? 2 + Math.random() * 2 : 3 + Math.random() * 4;
  const ang = Math.random() * 2 * PI, r = Math.random() * 10;
  const rho = small ? 0.6 + Math.random() * 0.3 : Math.random() < 0.4 ? -0.3 : 0.25 + Math.random() * 0.2;
  out[k] = [r * cos(ang), r * sin(ang), a, b, Math.random() * PI, rho];
  // The body breathes between rounder and longer.
  out[0][2] = 24 + Math.random() * 4, out[0][3] = 16 + Math.random() * 5;
  return out;
}

// The continuous sinogram of a phantom, 64 angles down and the middle 64
// bins across, and its peak.
function sinogram(E, out) {
  const p = new Float32Array(NB);
  let peak = 1e-6;
  for (let r = 0; r < Q; r++) {
    project(E, (r * PI) / Q, p);
    for (let x = 0; x < Q; x++) (out[r * Q + x] = p[x + OFF]), (peak = max(peak, p[x + OFF]));
  }
  return peak;
}

const TURNS = [4, 8, 16, 32, 64];
// At Speed 2 a half turn takes SWEEP seconds and the result holds HOLD.
const SWEEP = 6, HOLD = 1.5;

function startCycle(S, E) {
  S.prevSino.set(S.sino);
  S.prevPeak = S.peak;
  S.E = E;
  S.peak = sinogram(E, S.sino);
  S.cycle++;
  S.prog = 0, S.hold = 0;
  S.fadeFrom.set(S.shown), S.fade = S.first ? 1 : 0;
  rebuild(S);
}

function anglesFor(S) {
  return S.knobN > 0 ? S.knobN : TURNS[(S.cycle + 2) % TURNS.length];
}

// Start the reconstruction over for the current angle count and take every
// projection the beam has already passed.
function rebuild(S) {
  S.N = anglesFor(S);
  S.P.fill(0), S.R.fill(0);
  S.done = 0, S.taken.fill(-1);
  take(S);
}

function take(S) {
  while (S.done < S.N && (S.done * PI) / S.N <= S.prog * PI + 1e-9) {
    const th = (S.done * PI) / S.N;
    project(S.E, th, S.p);
    ramp(S.p, S.q);
    smear(S.P, S.p, th);
    smear(S.R, S.q, th);
    S.lastP.set(S.p), S.lastQ.set(S.q), S.lastTh = th, S.lastT = S.t;
    // Its row of the sinogram, drawn up to 3 rows deep when the rows
    // between projections leave room.
    const r0 = round((S.done / S.N) * Q), deep = cl(floor(Q / S.N / 3), 1, 3);
    for (let j = 0; j < deep; j++) {
      const r = (r0 + j) % Q;
      S.taken[r] = S.done, S.depth[r] = j;
      S.rows[r].set(S.p.subarray(OFF, OFF + Q));
    }
    S.done++;
  }
}

export function setup(params) {
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, filt: 0.06, knobN: -1, N: 4, cycle: -1, prog: 0, hold: 0, done: 0, first: true,
    E: null, P: new Float32Array(Q * Q), R: new Float32Array(Q * Q), shown: new Float32Array(Q * Q), fadeFrom: new Float32Array(Q * Q), fade: 1,
    sino: new Float32Array(Q * Q), prevSino: new Float32Array(Q * Q), peak: 1, prevPeak: 1,
    p: new Float32Array(NB), q: new Float32Array(NB), lastP: new Float32Array(NB), lastQ: new Float32Array(NB), lastTh: 0, lastT: -9,
    taken: new Int16Array(Q).fill(-1), depth: new Uint8Array(Q), rows: Array.from({ length: Q }, () => new Float32Array(Q)), gain: 0, c: [0, 0, 0],
  });
  // The panel opens on a sinogram already under way: a phantom before the
  // first stands in the rows the beam has not reached.
  const E = firstPhantom();
  S.peak = sinogram(nextPhantom(E), S.sino);
  S.E = E;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.t += dt;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.filt = cl(k[3], 0, 1);
  const kn = cl(round(k[2]), 0, 64);
  if (S.first) {
    // The first cycle starts 60% of the way round, so the picture is mostly
    // built when the panel opens.
    S.knobN = kn;
    startCycle(S, S.E);
    S.prog = 0.6;
    take(S);
    S.first = false;
  } else if (kn !== S.knobN) {
    S.knobN = kn;
    if (anglesFor(S) !== S.N) rebuild(S);
  }
  const rate = S.speed / 2;
  S.fade = min(1, S.fade + dt / 0.6);
  if (S.prog < 1) {
    S.prog = min(1, S.prog + (dt * rate) / SWEEP);
    take(S);
  } else {
    S.hold += dt * rate;
    if (S.hold >= HOLD) startCycle(S, nextPhantom(S.E));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const c = S.c, f = S.filt, n = max(1, S.done), A = (1 - f) * FLAT, B = f;
  const shown = S.shown;
  // The reconstruction, the mean of the smeared projections so far, and
  // its gain eased toward its peak so a new streak does not flash the scale.
  let peak = 1e-6;
  for (let i = 0; i < Q * Q; i++) {
    const v = (A * S.P[i] + B * S.R[i]) / n;
    shown[i] = v;
    if (v > peak) peak = v;
  }
  S.gain = S.gain > 0 ? S.gain + (1 / peak - S.gain) * 0.25 : 1 / peak;
  const g = S.gain;
  // The newest projection flashes along its rays for a moment.
  const fl = exp(-(S.t - S.lastT) / 0.25) * 0.5, cth = cos(S.lastTh), sth = sin(S.lastTh);
  const hr = 0.55 + S.hue, hn = 0.78 + S.hue;
  for (let y = 0; y < Q; y++) {
    const u0 = -C * cth + (C - y) * sth + MID;
    for (let x = 0; x < Q; x++) {
      const i = y * Q + x;
      let u = shown[i] * g;
      if (fl > 0.01) {
        const s = u0 + x * cth, j = floor(s);
        if (j >= 0 && j < NB - 1) {
          const w = s - j, pv = S.lastP[j] + (S.lastP[j + 1] - S.lastP[j]) * w, qv = S.lastQ[j] + (S.lastQ[j + 1] - S.lastQ[j]) * w;
          u += fl * (A * pv + B * qv) * g;
        }
      }
      if (S.fade < 1) u = S.fadeFrom[i] + (u - S.fadeFrom[i]) * S.fade;
      shown[i] = u;
      if (u >= 0) {
        const v = min(1, u);
        hsv(hr, 0.85 - 0.75 * v * v, 0.06 + 0.94 * v, c);
      } else hsv(hn, 0.65, min(0.5, -u * 0.9), c);
      display.setPixel(x, y, 255 * c[0], 255 * c[1], 255 * c[2]);
    }
  }
  // The sinogram, angle 0 at the top to 180 degrees at the bottom. Rows the
  // beam has passed show the full sinogram dimly and the rows of the
  // projections taken brightly; rows ahead still hold the last phantom's.
  const swept = S.prog >= 1 ? Q : floor(S.prog * Q + 1e-6) + 1, hs = 0.72 + S.hue;
  for (let r = 0; r < Q; r++) {
    const tk = S.taken[r] >= 0 && r < swept;
    const lv = tk ? (S.depth[r] ? 0.75 : 1) : r < swept ? 0.5 : 0.3;
    const src = tk ? S.rows[r] : r < swept ? S.sino.subarray(r * Q, r * Q + Q) : S.prevSino.subarray(r * Q, r * Q + Q);
    const pk = r < swept ? S.peak : S.prevPeak;
    const hot = tk && S.taken[r] === S.done - 1 ? exp(-(S.t - S.lastT) / 0.3) : 0;
    for (let x = 0; x < Q; x++) {
      const v = cl(src[x] / pk, 0, 1);
      hsv(hs, max(0, 0.8 - 0.55 * v * v - 0.6 * hot), lv * (0.05 + 0.95 * v) * (1 - hot) + hot * (0.3 + 0.7 * v), c);
      display.setPixel(x, Q + r, 255 * c[0], 255 * c[1], 255 * c[2]);
    }
  }
  // The beam's place in the sweep, a tick at each side of the sinogram, and
  // its direction across the reconstruction as a faint line.
  if (S.prog < 1) {
    const r = min(Q - 1, floor(S.prog * Q));
    for (const x of [0, 1, Q - 2, Q - 1]) display.setPixel(x, Q + r, 255, 255, 255);
    const th = S.prog * PI, dx = -sin(th), dy = -cos(th);
    for (let s = -44; s <= 44; s += 0.5) {
      const x = round(C + s * dx), y = round(C + s * dy);
      if (x < 0 || x >= Q || y < 0 || y >= Q) continue;
      const u = shown[y * Q + x];
      hsv(hr, 0.3, min(1, 0.35 + max(0, u)), c);
      display.setPixel(x, y, 255 * c[0], 255 * c[1], 255 * c[2]);
    }
  }
}
