// ===== Patternflow pattern =====
// Title:   Shapiro Steps
// Family:  josephson
// Idea:    A Josephson junction driven by a microwave current has an average voltage that locks onto plateaus at whole multiples of the drive frequency, so the panel draws the map of that locking with the bias current up the panel and time scrolling left, and as the drive amplitude wanders the plateaus swell and pinch off one after another at the zeros of the Bessel functions, like a string of beads.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Sidney Shapiro, steps in the current-voltage curve of a junction under microwaves, 1963 (from memory); Brian Josephson, the tunnelling supercurrent, 1962; the resistively shunted junction model (Stewart and McCumber, 1968, from memory); pattern round 273
// Round:   273
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.6..3, Swing=-1..1, Scroll=-1..1
//
// Knob 1: Hue. Turns the palette one turn over the range, and the plateaus stay 0.075 of a turn apart. At 0 the zero-voltage plateau runs from orange at the left edge to gold at the right (hue 0.05 to 0.14 across the history), the next ones from orange to crimson, then magenta and violet going out from the middle; at 0.25 it is green and the next ones lime, yellow and amber; at 0.5 blue, then azure, teal and green. The palette also turns once by itself in 280 s, with a wobble of 0.15 on three slow sines, and the colour of a column stays what it was when the column was made.
// Knob 2: Drive. The drive frequency Omega, in units of the junction's own frequency 2e Ic Rn / h. The plateaus sit at V = n Omega, so Omega is their spacing: at a swing of 2 the n = 1 plateau lies 9, 11, 20 and 30 LED from the middle row at Omega 0.6, 1, 2 and 3, the n = 2 plateau 16, 22, 41 and 61. At the opening 2 the panel holds the plateaus n = 0 to 3 on each side; at 3 only n = 0 to 2, fat and far apart; at 0.6 the plateaus are wider than their spacing and the panel is a stack of touching ones. The drive breathes by up to 13 percent (8 percent in 37 s and 5 in 83 s), so every plateau slides a few rows up and down as it goes.
// Knob 3: Swing. The centre b0 of the swing b = a / Omega of the phase, 3.9 + 2.3 for each unit of the knob: 1.6 at -1, 3.9 at the opening 0, 6.2 at 1. The swing wanders about it by up to 2.4 (a sum of six sines, 6 to 62 s long, no period dividing another), and its centre drifts by up to 1.1 on 97 and 151 s. Over an hour the swing crosses a zero of J0 to J3 3.2 times a minute at -1 (b stays between 0.4 and 4.0), 12.8 times at 0 (1.4 to 6.5) and 20.5 times at 1 (3.7 to 8.8). Each crossing closes one plateau to a point.
// Knob 4: Scroll. Columns a second, 4.2 exp(0.6 K): 2.3 at -1, 4.35 at the opening 0.06, 7.65 at 1, so the 64 columns hold 27.8 s, 14.7 s or 8.4 s of the swing. At -1 each plateau shows several swells across the panel, at 1 hardly more than one. A column is one new integration, and the picture slides by a fraction of a column every frame.
//
// What the picture is. A Josephson junction shunted by its own resistance obeys d phi / dt = I + a cos(Omega t) - sin phi, with the critical current and the normal resistance as units of current and voltage. Its average voltage is V = <d phi / dt>. Drive it with a microwave current a cos(Omega t) and V does not rise with the bias I: it locks onto plateaus at whole multiples of Omega (V = n h f / 2e in SI units), the Shapiro steps. The panel plots the bias I up the panel from -6.4 at the bottom edge to 6.4 at the top, 0 on the seam between rows 63 and 64, and time along it, with now at the right and the past scrolling left. The picture is symmetric about the seam, because the junction is: I and V both change sign. A bright band is a plateau and its colour is its n. Between two plateaus the junction is in its resistive branch, where V runs on from n Omega to (n + 1) Omega, and the panel is quiet there.
// The Bessel pinch. In the limit of a fast drive the phase swings by b = a / Omega and the plateau n is 2 |J_n(b)| wide in I (Bessel function of the first kind), so as b wanders every plateau swells and closes at the zeros of its own function, 2.405 and 5.520 for n = 0, 3.832 and 7.016 for n = 1, 5.136 for n = 2. Measured here, with 30 periods at each of 0.02 steps in I, the widths of n = 1 and 2 at Omega 2 and 3 are within 0.06 of 2 |J_n(b)| (n = 1, b = 1.5: 1.06 and 1.10 against 1.12; n = 2, b = 3: 0.96 against 0.97). The n = 0 plateau, whose half on one side is all the panel can show against the seam, is |J0(b)| wide on each side. Below Omega 2 the fast-drive picture fails: at 1 the widths are off by up to 0.24, at 0.6 by up to 0.5. The narrowest n = 1 plateau (J1 has its zero at 3.832) is at b = 3.6 at Omega 3, 3.7 at 2, 4.0 at 1 and 4.4 at 0.6, to 0.1. The panel draws the swing b, not the amplitude a, so that Omega moves the plateaus and does not move the pinches.
// How a column is computed. The junction is integrated for 128 values of I from 0 to 6.4, 0.05 apart, two to an LED row, the other half is the mirror. The midpoint method with at least 14 steps to a drive period (a step of 0.25 or less) runs 4 periods to settle and 12 to measure, 230 to 670 steps for each of the 128 rows, 2.1 ms a column in Node at Omega 2 and 3, 4.0 at 1 and 6.6 at 0.6, and one column is made every 1 / speed seconds. The phase each row ends on starts the same row in the next column, so a column carries on from the one before and there is no settling noise. The rotation number V / Omega is the phase gained over the two measured halves of 6 periods each, divided by 12 turns. A row is on plateau n when it is within 0.02 of n (weight 1) to 0.08 (weight 0), and the two halves agree to within 0.006 (to 0.03). On a plateau the gain is exactly n turns a period, so the test is sharp; between plateaus V / Omega is an irrational number and no row is mistaken for a plateau by chance.
// Fractional steps. At a lower drive there are fractional steps in a real junction, at V = (p / q) Omega. In this equation I looked for them and there are none wider than a sample: scans over Omega 0.2 to 3 and a 1 to 7, I 0 to 6, with 70 periods at each point, found no plateau at V / Omega = p / q for q = 2 to 5 wider than 0.06 in I, so the panel does not draw any. They come with a second harmonic in the current-phase relation, which this sin phi does not have, and with a capacitance in parallel, which would make the picture two-valued.
// What is drawing. A plateau thinner than 2.6 LED fades out (sum of its row weights, 1.0 to 2.6), so a pinch ends in a soft point and not in dots; each plateau is shaded 0.55 to 1 toward its middle like a bead, so plateaus that touch stay apart; a Gaussian of 0.85 LED sets the edge and one of 3.4 LED a halo at 0.5, and the quiet ground between is a violet-blue that rises from 0.07 to 0.27 toward the outer rows. The pixel averages three taps 0.9 of a column apart, because an edge moves by a row from one column to the next. The drive frequency (8 and 5 percent), the scale of I (7 and 4 percent on 59 and 101 s), the swing and its centre, the hue and the scroll are all slow drifts of their own, set so the panel does not come back; the first call computes the whole history, 66 columns, in 0.13 to 0.4 s in Node, with the swing laid so that it crosses 8 zeros of J0 to J4 in the 16 s before the first frame.

const W = 64, H = 128, NR = 64, NS = 2 * NR, NCOL = 66;
const { floor, ceil, exp, sin, cos, min, max, abs, round, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

const IMAX = 6.4;                 // bias current at the top and bottom edge, in units of the critical current
const DS = IMAX / NS;             // current between two integrated rows: two of them to a row of LEDs
const BURN = 4, MEAS = 6;         // drive periods integrated before the average, and in each of its two halves
const H0 = 0.1;                  // hue of the zero step when the Hue knob is at 0
const DH = -0.075;                // hue step from one plateau to the next

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---------------------------------------------------------------- the model
export function setup(params) {
  params.s = {
    t: 0, acc: 0, head: -1, k: null,
    col: new Float32Array(NCOL * H * 3),                    // the picture of each column, ready to draw
    phi: new Float32Array(NCOL * NS),                       // the phase each row of each column ended on
    cr: new Float32Array(NCOL * NS), cd: new Float32Array(NCOL * NS),
    ct: new Float32Array(NCOL), cOm: new Float32Array(NCOL), cB0: new Float32Array(NCOL), cH: new Float32Array(NCOL),
    drv: new Float32Array(256),
    o0: new Int32Array(3), o1: new Int32Array(3), fr: new Float32Array(3), fw: new Float32Array(3),
  };
}

// the swing b of the drive, as a number between -1 and 1 about its centre: sines whose periods do not divide each other
function wander(t) {
  return 0.36 * sin(TAU * t / 14 + 3.08) + 0.22 * sin(TAU * t / 23.5 + 2.34) + 0.13 * sin(TAU * t / 9.6 + 6.22) + 0.1 * sin(TAU * t / 38 + 2.15) + 0.1 * sin(TAU * t / 61.7 + 1.08) + 0.09 * sin(TAU * t / 6.1 + 5.44);
}
// the centre of the swing, the drive frequency and the hue each drift on sines of their own, slower still
const b0Of = (k, t) => 3.9 + 2.3 * cl(k, -1, 1) + 0.7 * sin(TAU * t / 97 + 0.27) + 0.4 * sin(TAU * t / 151 + 1.06);
const ampOf = (b0, t) => min(2.4, b0 - 0.3) * (0.85 + 0.15 * sin(TAU * t / 53 + 2.53));
const omOf = (om, t) => om * (1 + 0.08 * sin(TAU * t / 37.3 + 0.7) + 0.05 * sin(TAU * t / 83 + 2.9));
const hueOf = (h, t) => h + H0 + t / 280 + 0.06 * sin(TAU * t / 71 + 3.4) + 0.05 * sin(TAU * t / 43 + 1.1) + 0.04 * sin(TAU * t / 27 + 0.4);
const speedOf = (k) => 4.2 * exp(0.6 * cl(k, -1, 1));   // columns a second

// one column: the overdamped junction, d phi / dt = I + a cos(Omega t) - sin(phi), for every bias row
function integrate(S, slot, om, a, ds, nburn) {
  const T = TAU / om, spp = max(14, ceil(T / 0.25)), dt = T / spp, hd = 0.5 * dt, drv = S.drv;
  for (let i = 0; i <= 2 * spp; i++) drv[i] = a * cos(om * i * hd);
  const base = slot * NS, tot = (nburn + 2 * MEAS) * spp, st = nburn * spp, mid = (nburn + MEAS) * spp;
  for (let k = 0; k < NS; k++) {
    const I = (k + 0.5) * ds;
    let p = S.phi[base + k], p0 = 0, p1 = 0;
    for (let n = 0; n < tot; n++) {
      if (n === st) p0 = p;
      else if (n === mid) p1 = p;
      const j = (n % spp) * 2;
      const pm = p + hd * (I + drv[j] - sin(p));
      p += dt * (I + drv[j + 1] - sin(pm));
    }
    S.cr[base + k] = (p - p0) / (TAU * 2 * MEAS);                  // the rotation number V / Omega
    S.cd[base + k] = ((p - p1) - (p1 - p0)) / (TAU * 2 * MEAS);    // how far the two halves disagree: 0 on a plateau
    S.phi[base + k] = p - TAU * round(p / TAU);
  }
}

const NEU = [0, 0, 0], BC = [0, 0, 0];
const WS = new Float32Array(NS), SH = new Float32Array(NS), MS = new Int16Array(NS);
const SR = new Float32Array(NS), SG = new Float32Array(NS), SB = new Float32Array(NS);
const BR = new Float32Array(NR), BG = new Float32Array(NR), BB = new Float32Array(NR);
// a Gaussian of 3.4 rows for the halo, a narrow one of 0.85 for the edge of a band
const HK = 9, GH = new Float32Array(2 * HK + 1), GE = new Float32Array(5);
{
  let a = 0, b = 0;
  for (let i = -HK; i <= HK; i++) a += (GH[i + HK] = exp(-(i * i) / (2 * 3.4 * 3.4)));
  for (let i = 0; i < GH.length; i++) GH[i] /= a;
  for (let i = -2; i <= 2; i++) b += (GE[i + 2] = exp(-(i * i) / (2 * 0.85 * 0.85)));
  for (let i = 0; i < 5; i++) GE[i] /= b;
}

function paint(S, slot, h0) {
  const o0 = slot * NS;
  for (let s = 0; s < NS; s++) {
    const r = S.cr[o0 + s], n = round(r), d = abs(r - n), dd = abs(S.cd[o0 + s]);
    WS[s] = (1 - sm(0.02, 0.08, d)) * (1 - sm(0.006, 0.03, dd));
    MS[s] = n;
    SH[s] = 1;
  }
  // a plateau thinner than about two LEDs fades out, so a pinch ends in a soft point and not in dots;
  // the plateau of rotation number 0 on the middle row goes on through the mirror and is not thin
  for (let s = 0; s < NS; s++) {
    if (WS[s] <= 0.1) continue;
    let e = s, sum = WS[s];
    while (e + 1 < NS && MS[e + 1] === MS[s] && WS[e + 1] > 0.1) sum += WS[++e];
    const rows = sum / 2, mid = s === 0 && MS[0] === 0;
    const g = mid ? 1 : sm(1.0, 2.6, rows);
    for (let q = s; q <= e; q++) {
      WS[q] *= g;
      // darker toward its two edges, like a bead
      const dist = 0.5 * min(s === 0 ? 99 : q - s + 0.5, e === NS - 1 ? 99 : e - q + 0.5);
      SH[q] = 0.55 + 0.45 * sm(0, 1, dist / min(2.6, 0.5 * rows + 0.01));
    }
    s = e;
  }
  for (let s = 0; s < NS; s++) {
    hsv(h0 + DH * MS[s], 0.88, 1, BC);
    const w = WS[s] * SH[s];
    SR[s] = BC[0] * w;
    SG[s] = BC[1] * w;
    SB[s] = BC[2] * w;
  }
  for (let k = 0; k < NR; k++) {
    BR[k] = 0.5 * (SR[2 * k] + SR[2 * k + 1]);
    BG[k] = 0.5 * (SG[2 * k] + SG[2 * k + 1]);
    BB[k] = 0.5 * (SB[2 * k] + SB[2 * k + 1]);
  }
  const col = S.col, o = slot * H * 3;
  for (let k = 0; k < NR; k++) {
    let er = 0, eg = 0, eb = 0, hr = 0, hg = 0, hb = 0;
    for (let j = -2; j <= 2; j++) {
      let q = k + j;
      q = q < 0 ? -q - 1 : q >= NR ? NR - 1 : q;
      const g = GE[j + 2];
      er += g * BR[q];
      eg += g * BG[q];
      eb += g * BB[q];
    }
    for (let j = -HK; j <= HK; j++) {
      let q = k + j;
      q = q < 0 ? -q - 1 : q >= NR ? NR - 1 : q;
      const g = GH[j + HK];
      hr += g * BR[q];
      hg += g * BG[q];
      hb += g * BB[q];
    }
    hsv(h0 + 0.62, 0.45, 0.07 + 0.2 * pow(k / NR, 0.8), NEU);
    const r = min(1, NEU[0] + 0.92 * er + 0.5 * pow(hr, 0.72)), g = min(1, NEU[1] + 0.92 * eg + 0.5 * pow(hg, 0.72)), b = min(1, NEU[2] + 0.92 * eb + 0.5 * pow(hb, 0.72));
    const u = o + (NR + k) * 3, v = o + (NR - 1 - k) * 3;
    col[u] = col[v] = r;
    col[u + 1] = col[v + 1] = g;
    col[u + 2] = col[v + 2] = b;
  }
}

function compute(S, slot, t, nburn) {
  const b0 = b0Of(S.k[2], t), b = max(0.4, b0 + ampOf(b0, t) * wander(t)), om = omOf(S.k[1], t);
  integrate(S, slot, om, b * om, DS * (1 + 0.07 * sin(TAU * t / 59 + 1.2) + 0.04 * sin(TAU * t / 101 + 4.4)), nburn);
  paint(S, slot, hueOf(S.k[0], t));
  S.ct[slot] = t;
  S.cOm[slot] = S.k[1];
  S.cB0[slot] = S.k[2];
  S.cH[slot] = S.k[0];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    // the whole history, oldest column first, each one starting from the phases the one before ended on
    S.k = [kv[0], kv[1], kv[2], kv[3]];
    const sp = speedOf(S.k[3]);
    for (let i = 0; i < NCOL; i++) {
      S.head = i;
      if (i > 0) S.phi.copyWithin(i * NS, (i - 1) * NS, i * NS);
      compute(S, i, (i - (NCOL - 1)) / sp, i === 0 ? 12 : BURN);
    }
    return;
  }
  const al = 1 - exp(-d / 0.12);
  for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  const sp = speedOf(S.k[3]);
  S.t += d;
  S.acc += d * sp;
  let made = 0;
  while (S.acc >= 1) {
    S.acc -= 1;
    made++;
    const prev = S.head;
    S.head = (S.head + 1) % NCOL;
    S.phi.copyWithin(S.head * NS, prev * NS, prev * NS + NS);
    compute(S, S.head, S.t - S.acc / sp, BURN);
  }
  // columns made under other knobs are worked out again, the newest first; a new hue only repaints
  let left = S.k[1] > 1.6 ? 2 - min(made, 1) : 1 - min(made, 1), paints = 16;
  for (let j = 0; j < NCOL - 1; j++) {
    const i = (S.head - j + NCOL) % NCOL;
    if (left > 0 && (abs(S.cOm[i] - S.k[1]) > 0.01 || abs(S.cB0[i] - S.k[2]) > 0.02)) {
      compute(S, i, S.ct[i], BURN);
      left--;
    } else if (paints > 0 && abs(S.cH[i] - S.k[0]) > 0.004) {
      paint(S, i, hueOf(S.k[0], S.ct[i]));
      S.cH[i] = S.k[0];
      paints--;
    }
  }
}

// ------------------------------------------------------------------ drawing
const TAPS = [-0.9, 0, 0.9], TW = [0.25, 0.5, 0.25];
export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const f = S.acc, col = S.col, HH = H * 3;
  for (let x = 0; x < W; x++) {
    // the column position of this pixel: the right edge shows the interval before the newest column;
    // three taps 0.9 of a column apart average out a plateau's edge that moves by a row from one column to the next
    let r = 0, g = 0, b = 0;
    for (let t = 0; t < 3; t++) {
      const c = min(0, x - (W - 1) - 1 + f + TAPS[t]), c0 = floor(c), fr = c - c0, w = TW[t];
      const i0 = (((S.head + c0) % NCOL) + NCOL) % NCOL, i1 = (i0 + 1) % NCOL;
      S.o0[t] = i0 * HH;
      S.o1[t] = i1 * HH;
      S.fr[t] = fr * w;
      S.fw[t] = w - fr * w;
    }
    for (let y = 0; y < H; y++) {
      const p = y * 3;
      r = g = b = 0;
      for (let t = 0; t < 3; t++) {
        const a0 = S.o0[t] + p, a1 = S.o1[t] + p, u = S.fw[t], v = S.fr[t];
        r += col[a0] * u + col[a1] * v;
        g += col[a0 + 1] * u + col[a1 + 1] * v;
        b += col[a0 + 2] * u + col[a1 + 2] * v;
      }
      display.setPixel(x, y, min(255, (r * 255) | 0), min(255, (g * 255) | 0), min(255, (b * 255) | 0));
    }
  }
}
