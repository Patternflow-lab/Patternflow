// ===== Patternflow pattern =====
// Title:   Anderson Localization
// Family:  wave
// Idea:    A quantum particle starts on one site of a chain whose site energies are random, shown as faint stripes behind, and its probability is drawn with the sites across the panel and time running down it: the cone it opens stops growing about 13 sites either side and stands there as a speckled column for the rest of the run, while the dotted edges of the cone a clean chain would make run on to the sides.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Anderson localization (Philip W. Anderson, 1958), pattern round 38
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Disorder=4..12, Samples=1..16
//
// Knob 1: Hue. Turns the wave round the wheel; the old run below the head and the stripes turn with it. At 0 tails violet, body azure, core pale cyan; at 0.1 blue, at 0.2 violet, at 0.35 pink, at 0.42 red, at 0.5 peach, at 0.58 butter, at 0.66 lime, at 0.85 mint. From 0.42 to 0.68 the tails turn toward rose instead of yellow and the body is paled and lifted up to 1.4 times, so nothing reads brown or olive.
// Knob 2: Speed. How fast time is written down the panel. At 2 twenty rows a second, so a run of 128 rows (t = 0 to 32 in units of the hopping) takes 6.4 s and the finished run holds 1.5 s; at 0.2 64 s, at 3 4.3 s.
// Knob 3: Disorder. The width W of the random site energies, uniform in [-W/2, W/2]. At 4 the localization length at the band centre is about 105/W^2 = 6.6 sites: the lit column, where the probability is over 1/1000, is 13 LEDs wide at row 8, 19 at row 16, 25 at row 32 and stops at 27 to 28 from row 48 on, where a clean cone would be 49 wide and growing. At 8 it stops at 12 LEDs by row 16; at 12 the particle hardly leaves its site and the column is 8 LEDs wide from row 8.
// Knob 4: Samples. How many disorder samples run side by side from the same site, their probabilities averaged. At 1 the speckle of one sample, braided fringes and dark holes where its localized states beat; from about 8 the holes fill in, and at 16 the column is a smooth bell that falls off exponentially on both sides and stops widening.
// Buttons: K1 tap launches now, on a new sample of energies and a new site.

const W = 64, H = 128, NS = 192, OFF = 64, MAXS = 16;
// Time per row: 0.25 in units of the hopping, so 128 rows hold t = 0 to 32
// and a clean cone, whose edge runs 2 sites per unit, reaches 32 sites out at
// row 64. RK4 steps of 0.025, ten to a row.
const TROW = 0.25, STEPS = 10, DT = TROW / STEPS;
// Rows per second at Speed 1.
const RATE = 10;
// Brightness from the probability on a log scale: 1e-3 is dark, 0.4 full.
const LMIN = -3, LSPAN = 2.6;
// Opening hue: azure.
const H0 = 0.56;
const { floor, min, max, abs, log10, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, dis: 3, ns: 1, begun: false,
    // u: each sample's site energies over W, uniform in [-1/2, 1/2].
    u: new Float64Array(MAXS * NS), re: new Float64Array(MAXS * NS), im: new Float64Array(MAXS * NS), done: 0,
    ya: new Float64Array(NS), yb: new Float64Array(NS), ka: new Float64Array(NS), kb: new Float64Array(NS),
    sa: new Float64Array(NS), sb: new Float64Array(NS),
    n0: 96, t: 0, row: 0, prog: 0, hold: 0, norm: 1,
    rho: new Float32Array(W * H), vt: new Float32Array(W * H), cone: new Uint8Array(W * H), dim: new Float32Array(H),
    lo: [0, 0, 0], mid: [0, 0, 0], hi: [0, 0, 0], pos: [0, 0, 0], neg: [0, 0, 0],
  };
}

// dy/dt for y = re + i im under i dy/dt = H y, H y_n = -(y_n+1 + y_n-1) + V_n y_n,
// with hard walls past both ends of the chain: d re = H im, d im = -H re.
function deriv(a, b, u, o, Wd, ka, kb) {
  for (let n = 0; n < NS; n++) {
    const V = Wd * u[o + n];
    let ha = V * a[n], hb = V * b[n];
    if (n > 0) {
      ha -= a[n - 1];
      hb -= b[n - 1];
    }
    if (n < NS - 1) {
      ha -= a[n + 1];
      hb -= b[n + 1];
    }
    ka[n] = hb;
    kb[n] = -ha;
  }
}

// One RK4 step of one sample.
function rk4(S, k, h) {
  const o = k * NS, { re, im, u, ya, yb, ka, kb, sa, sb } = S, Wd = S.dis;
  for (let n = 0; n < NS; n++) {
    ya[n] = re[o + n];
    yb[n] = im[o + n];
  }
  // k1
  const a0 = re.subarray(o, o + NS), b0 = im.subarray(o, o + NS);
  deriv(a0, b0, u, o, Wd, ka, kb);
  for (let n = 0; n < NS; n++) {
    sa[n] = ka[n];
    sb[n] = kb[n];
    ya[n] = a0[n] + 0.5 * h * ka[n];
    yb[n] = b0[n] + 0.5 * h * kb[n];
  }
  // k2
  deriv(ya, yb, u, o, Wd, ka, kb);
  for (let n = 0; n < NS; n++) {
    sa[n] += 2 * ka[n];
    sb[n] += 2 * kb[n];
    ya[n] = a0[n] + 0.5 * h * ka[n];
    yb[n] = b0[n] + 0.5 * h * kb[n];
  }
  // k3
  deriv(ya, yb, u, o, Wd, ka, kb);
  for (let n = 0; n < NS; n++) {
    sa[n] += 2 * ka[n];
    sb[n] += 2 * kb[n];
    ya[n] = a0[n] + h * ka[n];
    yb[n] = b0[n] + h * kb[n];
  }
  // k4
  deriv(ya, yb, u, o, Wd, ka, kb);
  for (let n = 0; n < NS; n++) {
    a0[n] += (h / 6) * (sa[n] + ka[n]);
    b0[n] += (h / 6) * (sb[n] + kb[n]);
  }
}

// Put sample k on the launch site and run it up to the time of the run.
function start(S, k) {
  const o = k * NS;
  S.re.fill(0, o, o + NS);
  S.im.fill(0, o, o + NS);
  S.re[o + S.n0] = 1;
  const steps = round(S.t / DT);
  for (let i = 0; i < steps; i++) rk4(S, k, DT);
}

// A new run: fresh energies for every sample and a new site, picked so the
// start lies in the middle 40 columns.
function launch(S) {
  for (let i = 0; i < MAXS * NS; i++) S.u[i] = random() - 0.5;
  S.n0 = OFF + 12 + floor(random() * 40);
  S.t = 0;
  S.row = 0;
  S.prog = 0;
  S.hold = 0;
  for (let k = 0; k < S.ns; k++) start(S, k);
  S.done = S.ns;
  // What is left of the run before stays at 40%.
  S.dim.fill(0.4);
}

// Write the row for the present time, the samples' probability averaged.
function writeRow(S) {
  const r = S.row, { re, im, rho, vt, cone, u } = S, ns = S.ns, c0 = S.n0 - OFF, edge = 2 * S.t;
  let norm = 0;
  for (let n = 0; n < NS; n++) norm += re[n] * re[n] + im[n] * im[n];
  S.norm = norm;
  for (let x = 0; x < W; x++) {
    const n = OFF + x;
    let s = 0;
    for (let k = 0; k < ns; k++) {
      const i = k * NS + n;
      s += re[i] * re[i] + im[i] * im[i];
    }
    const p = r * W + x;
    rho[p] = s / ns;
    vt[p] = u[n];
    // The clean chain's light cone, n0 +- 2t, dotted every other row.
    const d = abs(abs(x - c0) - edge);
    cone[p] = r % 2 === 0 && d < 0.5 && r > 0 ? 1 : 0;
  }
  S.dim[r] = 1;
  S.row++;
}

// Run the present time forward to row r and write each row on the way.
function advanceTo(S, target) {
  while (S.row <= target && S.row < H) {
    if (S.row > 0) {
      for (let i = 0; i < STEPS; i++) for (let k = 0; k < S.ns; k++) rk4(S, k, DT);
      S.t = S.row * TROW;
    }
    writeRow(S);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 4, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.dis = cl(k[2], 4, 12);
  S.ns = round(cl(k[3], 1, MAXS));
  if (!S.begun) {
    // Open on a whole run already written, and a new one starting over it.
    launch(S);
    advanceTo(S, H - 1);
    launch(S);
    S.begun = true;
  }
  // Samples turned up in the middle of a run catch up to its time.
  while (S.done < S.ns) start(S, S.done++);
  if (S.done > S.ns) S.done = S.ns;
  if (input.btnPressed && input.btnPressed[0]) launch(S);
  if (S.row >= H) {
    S.hold += d * S.speed;
    // Hold the finished run 1.5 s at Speed 2.
    if (S.hold > 3) launch(S);
    return;
  }
  S.prog += d * S.speed * RATE;
  advanceTo(S, floor(S.prog));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rho, vt, cone, dim, lo, mid, hi, pos, neg } = S;
  const h = S.hue + H0;
  // Orange to yellow on the panel goes brown or olive when dim. Round there
  // the tails turn toward rose instead of toward yellow, the body is paled
  // to peach or butter, and everything is lifted.
  const hh = h - floor(h), warm = cl(1 - abs(hh - 0.11) / 0.13, 0, 1);
  hsv(h + 0.09 - 0.19 * warm, 1 - 0.2 * warm, 1, lo);
  hsv(h, 0.85 - 0.4 * warm, 1, mid);
  hsv(h - 0.04, 0.18, 1, hi);
  hsv(h + 0.45, 0.7, 1, pos);
  hsv(h + 0.3, 0.7, 1, neg);
  const vlift = 1 + 0.4 * warm, head = S.row, mixOld = 0.5 + 0.4 * warm;
  for (let y = 0; y < H; y++) {
    const old = dim[y] < 1, dm = old ? dim[y] + 0.2 * warm : 1;
    // Two rows of dark under the head, between the new run and the old.
    const gap = old && y >= head && y < head + 2;
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r = 0, g = 0, b = 0;
      if (!gap) {
        const L = cl((log10(rho[p] + 1e-12) - LMIN) / LSPAN, 0, 1);
        if (L > 0) {
          const v = min(1, (0.1 + 0.9 * L) * vlift);
          let c0 = lo, c1 = mid, f = L * 2;
          if (L > 0.5) {
            c0 = mid;
            c1 = hi;
            f = L * 2 - 1;
          }
          r = (c0[0] + (c1[0] - c0[0]) * f) * v;
          g = (c0[1] + (c1[1] - c0[1]) * f) * v;
          b = (c0[2] + (c1[2] - c0[2]) * f) * v;
          // The run before is drawn half in the tails' colour, so it sits
          // back and dims to violet or rose, not to grey or brown.
          if (old) {
            r += (lo[0] * v - r) * mixOld;
            g += (lo[1] * v - g) * mixOld;
            b += (lo[2] * v - b) * mixOld;
          }
        }
        // The site energies, faint: high sites one tint, low sites another.
        const e = vt[p], c = e > 0 ? pos : neg, a = 0.16 * abs(e) * 2;
        r = max(r, c[0] * a);
        g = max(g, c[1] * a);
        b = max(b, c[2] * a);
        if (cone[p]) {
          r = max(r, 0.32);
          g = max(g, 0.32);
          b = max(b, 0.32);
        }
        r *= dm;
        g *= dm;
        b *= dm;
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
  }
}
