// ===== Patternflow pattern =====
// Title:   Cut and Project
// Family:  geometry
// Idea:    A glowing strip is cut out of the integer lattice Z^2 and its lattice points are projected onto the strip's line, giving a chain of two tile lengths that is written out as a tape of tiles below, while the strip's slope sweeps through the Fibonacci ratios 3/2, 5/3, 8/5, 13/8 where the chain repeats after 5, 8, 13, 21 tiles, and on to the golden slope where it never repeats.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: cut-and-project sets (Yves Meyer, 1972) and the Fibonacci chain as the projection of a lattice strip (Nicolaas de Bruijn, 1981), whose tile words are Sturmian words (Marston Morse and Gustav Hedlund, 1940), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Window=-0.45..0.8, Phase=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 a long tile is cyan, a short tile pink, the band blue-violet and, when the window is wider or narrower than the unit square, a middle tile lime. The gold of the flash, the period bracket and the golden mark stays gold.
// Knob 2: Speed. How fast the slope sweeps. At 2 the cycle of nine stops takes 33.5 s: it has rested 0.5 s of its 1.5 s on 3/2 when the pattern opens, then rests 1.7 s each on 5/3, 8/5 and 13/8, reaches the golden slope at 10.5 s and stays 4.6 s, then goes on to 7/4, 2/1, 5/2 and 4/3 and back to 3/2. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Window. The strip's width as a multiple of the shadow of the unit square, 1 plus the knob. The shadow is sin + cos of the slope angle, 1.39 cells or 9.7 LEDs at 3/2, and it is the one width that gives only two tile lengths, so within 0.04 of 0 the knob snaps there. At -0.45 the strip is 0.55 as wide and drops points, at 0.8 it is 1.8 times as wide and picks up more. Either way a third tile length appears, and the period bracket and the P number go.
// Knob 4: Phase. Slides the strip sideways, across its own direction, by 2.4 cells (17 LEDs) at 1. Points leave the strip on one side and enter on the other, and each change in the tape is two neighbouring tiles swapping places.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sqrt, sin, cos, atan, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * v * (v * (v * 6 - 15) + 10));
const PHI = (1 + sqrt(5)) / 2;

// The lattice: points (i, j), i = 0..8 across and j = 0..10 up, LED (4 + 7 i,
// 74 - 7 j). The strip is pivoted on the middle point (4, 5).
const D = 7, X0 = 4, Y0 = 74, NI = 9, NJ = 11, PX = 4, PY = 5, LAT = 78;
// Rows of the tape (two of 7), the ratio plot (mid row 105) and the word chart.
const TAPE = [83, 93], TH = 7, RMID = 105, CHB = 126, NW = 16;
// How far along the line the chain is cut, in lattice units, and a nudge that
// keeps the strip's edges off the lattice lines at the rational slopes.
const REACH = 110, EPS = 0.0371, CAP = 1400;
// The tape holds the chain from 64 / D units before the pivot's projection to
// 64 / D after it, folded into two rows.
const UT = 64 / D;

// The nine stops: the slope is p / q, the golden one is p = 0. dwell is the
// time the slope holds still, in seconds at Speed 2.
const STOPS = [
  { p: 3, q: 2, dwell: 1.5 },
  { p: 5, q: 3, dwell: 1.7 },
  { p: 8, q: 5, dwell: 1.7 },
  { p: 13, q: 8, dwell: 1.7 },
  { p: 0, q: 1, dwell: 4.6 },
  { p: 7, q: 4, dwell: 1.8 },
  { p: 2, q: 1, dwell: 2 },
  { p: 5, q: 2, dwell: 2 },
  { p: 4, q: 3, dwell: 2 },
];
const slopeOf = (s) => (s.p === 0 ? PHI : s.p / s.q);

const GLYPH = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "/": ["001", "001", "010", "100", "100"],
  ".": ["0", "0", "0", "0", "1"],
  P: ["111", "101", "111", "100", "100"],
  // phi, and the sign for infinity
  f: ["00100", "01110", "10101", "10101", "01110", "00100", "00100"],
  o: ["00000", "01010", "10101", "01010", "00000"],
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  // Arrival time of each stop and the time the slope takes to get to the next.
  const at = [], tr = [];
  let t = 0;
  for (let i = 0; i < STOPS.length; i++) {
    at.push(t);
    const a = slopeOf(STOPS[i]), b = slopeOf(STOPS[(i + 1) % STOPS.length]);
    tr.push(0.55 + 2.4 * sqrt(abs(b - a)));
    t += STOPS[i].dwell + tr[i];
  }
  params.s = {
    B: new Float32Array(N * 3),
    at, tr, cycle: t,
    // The chain: its points in order along the line, their lattice cell, and
    // the class of the tile each one starts.
    n: 0,
    ci: new Int32Array(CAP), cj: new Int32Array(CAP), ct: new Float64Array(CAP), cc: new Uint8Array(CAP),
    ti: new Int32Array(CAP), tj: new Int32Array(CAP), tt: new Float64Array(CAP), ord: new Uint16Array(CAP),
    ncls: 2, vals: [0, 0, 0], slot: [0, 2, 1],
    stamp: new Int32Array(1 << 16), stampId: 0,
    wc: new Int32Array(NW + 1), rat: new Float32Array(64), ref: 1.6,
    pal: new Float32Array(30), palHue: -1,
    tape: new Float32Array(128 * 4), dark: new Float32Array(128),
    hue: 0, speed: 2, f: 1, shift: 0, canon: true,
    u: 0.5, clock: 0, stop: 0, age: 0, left: 9, m: 1.5, flash: 0, lab: "",
    cs: 0, sn: 0, w: 0, pc: 0, tc: 0, k0: 0,
  };
}

// The slope at cycle time u: held at a stop, then eased to the next.
function slopeAt(S, u) {
  const k = STOPS.length;
  let i = k - 1;
  while (i > 0 && S.at[i] > u) i--;
  const s = STOPS[i], d = u - S.at[i], a = slopeOf(s);
  S.stop = i;
  S.age = d;
  if (d <= s.dwell) {
    S.left = s.dwell - d;
    return a;
  }
  S.stop = -1;
  S.left = 0;
  return a + (slopeOf(STOPS[(i + 1) % k]) - a) * sm((d - s.dwell) / S.tr[i]);
}

// Every lattice point of the strip, in order along the line, with the class
// of the tile each starts: 0 the longest gap to the next point, up to 2.
function chain(S, m, shift, f) {
  const cs = 1 / sqrt(1 + m * m), sn = m * cs, w = f * (sn + cs);
  const pc = -PX * sn + PY * cs + shift + EPS, a = pc - w / 2, tc = PX * cs + PY * sn;
  const di = ceil(REACH * cs) + 3, { ci, cj, ct, ti, tj, tt, ord } = S;
  let n = 0;
  for (let i = PX - di; i <= PX + di; i++) {
    const lo = (a + i * sn) / cs, hi = (a + w + i * sn) / cs;
    for (let j = ceil(lo); j < hi && n < CAP; j++) {
      const t = i * cs + j * sn;
      if (abs(t - tc) > REACH) continue;
      ti[n] = i;
      tj[n] = j;
      tt[n] = t;
      ord[n] = n;
      n++;
    }
  }
  const idx = ord.subarray(0, n);
  idx.sort((x, y) => tt[x] - tt[y]);
  for (let k = 0; k < n; k++) {
    const o = idx[k];
    ci[k] = ti[o];
    cj[k] = tj[o];
    ct[k] = tt[o];
  }
  // Classify the gaps: at most three different ones, longest first.
  const vals = [];
  for (let k = 0; k + 1 < n; k++) {
    const g = ct[k + 1] - ct[k];
    let hit = false;
    for (let q = 0; q < vals.length; q++) if (abs(vals[q] - g) < 1e-7) hit = true;
    if (!hit && vals.length < 8) vals.push(g);
  }
  vals.sort((x, y) => y - x);
  S.ncls = min(3, max(1, vals.length));
  for (let q = 0; q < 3; q++) S.vals[q] = vals[min(q, vals.length - 1)] || 0;
  S.slot[0] = 0;
  S.slot[1] = S.ncls === 2 ? 2 : 1;
  S.slot[2] = 2;
  for (let k = 0; k + 1 < n; k++) {
    const g = ct[k + 1] - ct[k];
    let best = 0;
    for (let q = 1; q < S.ncls; q++) if (abs(vals[q] - g) < abs(vals[best] - g)) best = q;
    S.cc[k] = best;
  }
  S.n = n;
  S.cs = cs;
  S.sn = sn;
  S.w = w;
  S.pc = pc;
  S.tc = tc;
}

// The numbers the readouts show, from the chain: how many different words of
// each length from 1 to NW it holds, and the long : short count of its first
// tiles from the pivot on.
function readouts(S) {
  const n = S.n - 1, cc = S.cc, ncls = S.ncls;
  for (let len = 1; len <= NW; len++) {
    let cnt = 0;
    if (ncls <= 2) {
      const mask = (1 << len) - 1, id = ++S.stampId, st = S.stamp;
      let r = 0;
      for (let k = 0; k < n; k++) {
        r = ((r << 1) | (cc[k] ? 1 : 0)) & mask;
        if (k >= len - 1 && st[r] !== id) {
          st[r] = id;
          cnt++;
        }
      }
    } else {
      const seen = new Set(), mod = 3 ** len;
      let r = 0;
      for (let k = 0; k < n; k++) {
        r = (r * 3 + cc[k]) % mod;
        if (k >= len - 1) seen.add(r);
      }
      cnt = seen.size;
    }
    S.wc[len] = cnt;
  }
  let k0 = 0;
  while (k0 < n && S.ct[k0] < S.tc) k0++;
  S.k0 = k0;
  let lo = 0, sh = 0;
  const isShort = (k) => ncls > 1 && cc[k] === ncls - 1;
  for (let k = 0; k < n; k++) isShort(k) ? sh++ : lo++;
  // The ratio the long run settles on: the slope itself at the unit-square
  // window, where there are p long tiles to q short ones; the count otherwise.
  S.ref = S.canon ? S.m : sh ? lo / sh : 9;
  lo = sh = 0;
  for (let k = k0, c = 0; c < 66 && k < n; k++, c++) {
    isShort(k) ? sh++ : lo++;
    if (c >= 2) S.rat[c - 2] = sh ? lo / sh : 9;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  const kw = cl(kv[2], -0.45, 0.8);
  S.f = abs(kw) < 0.04 ? 1 : 1 + kw;
  S.shift = 2.4 * cl(kv[3], 0, 1);
  S.clock += d * (S.speed / 2);
  S.u = (S.u + d * (S.speed / 2)) % S.cycle;
  S.m = slopeAt(S, S.u);
  // The golden stop is the fifth. Its flash starts the moment the slope lands.
  S.flash = S.stop === 4 ? exp(-S.age / 0.55) : 0;
  S.canon = S.f === 1;
  chain(S, S.m, S.shift, S.f);
  readouts(S);
}

function put(B, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  B[o] += r;
  B[o + 1] += g;
  B[o + 2] += b;
}

// A soft disc of radius rad at (fx, fy), laid over what is there.
function disc(B, fx, fy, rad, c, a) {
  const x0 = max(0, floor(fx - rad)), x1 = min(W - 1, ceil(fx + rad));
  const y0 = max(0, floor(fy - rad)), y1 = min(H - 1, ceil(fy + rad));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dd = sqrt((x + 0.5 - fx) ** 2 + (y + 0.5 - fy) ** 2), v = cl(rad - dd + 0.2, 0, 1) * a;
      if (v <= 0) continue;
      const o = (y * W + x) * 3;
      B[o] += (c[0] - B[o]) * v;
      B[o + 1] += (c[1] - B[o + 1]) * v;
      B[o + 2] += (c[2] - B[o + 2]) * v;
    }
}

function text(B, str, x, y, c, a) {
  for (const ch of str) {
    const g = GLYPH[ch];
    if (!g) continue;
    for (let r = 0; r < g.length; r++)
      for (let q = 0; q < g[r].length; q++) if (g[r][q] === "1") put(B, x + q, y + r, c[0] * a, c[1] * a, c[2] * a);
    x += g[0].length + 1;
  }
}

const mix = (a, b, t) => a + (b - a) * t;

export function draw(display, params) {
  const S = params.s;
  if (!S || S.n < 3) return;
  const B = S.B, pal = S.pal;
  if (S.palHue !== S.hue) {
    const h = S.hue;
    hsv(h + 0.5, 0.78, 1, pal, 0); // long
    hsv(h + 0.28, 0.8, 1, pal, 3); // middle
    hsv(h + 0.93, 0.78, 1, pal, 6); // short
    hsv(h + 0.68, 0.82, 1, pal, 9); // band
    hsv(h + 0.62, 0.34, 0.46, pal, 12); // lattice dot
    hsv(h + 0.6, 0.12, 1, pal, 15); // white
    S.palHue = h;
  }
  const GOLD = [1, 0.78, 0.26];
  const col = (slot) => [pal[slot * 3], pal[slot * 3 + 1], pal[slot * 3 + 2]];
  const cT = [col(0), col(1), col(2)], cBand = col(3), cDot = col(4), cWhite = col(5);
  B.fill(0);
  const { n, ci, cj, ct, cc, cs, sn, w, pc, tc } = S, F = S.flash, breath = 0.92 + 0.08 * sin(S.clock * 1.7);
  const tileCol = (k) => cT[S.slot[cc[k]]];

  // The cursor: a light that runs along the chain, lighting the tile it is on
  // and, a moment later, the tile after it has passed.
  const tau = tc + ((S.clock * 0.3) % 1) * 2 * UT - UT;
  // After the slope lands on phi a gold pulse runs the length of the chain.
  const tg = S.stop === 4 ? tc - UT - 1 + S.age * 22 : -1e9;
  const boost = (k) => {
    const a = ct[k], b = ct[k + 1];
    let v = 0;
    if (tau >= a) v = exp(-max(0, tau - b) * 1.1);
    const mid = (a + b) / 2;
    return [v, exp(-(((mid - tg) / 1.6) ** 2))];
  };

  // The band, its edges, and the necklace of tiles down its middle.
  const hw = (w * D) / 2;
  const ncount = n - 1, gh = S.stop === 4 ? sm(S.age / 0.4) : 0;
  for (let y = 0; y < LAT; y++) {
    const v = (Y0 - y) / D;
    for (let x = 0; x < W; x++) {
      const u = (x - X0) / D;
      const pr = -u * sn + v * cs - pc, dl = abs(pr) * D;
      let r = 0, g = 0, b = 0;
      if (dl < hw) {
        const e = dl / hw, inner = (0.17 + 0.27 * (1 - e) ** 1.3) * breath * (1 + F * 0.9), gi = sm((F - 0.15) / 0.6);
        r = mix(cBand[0], GOLD[0], gi) * inner;
        g = mix(cBand[1], GOLD[1], gi) * inner;
        b = mix(cBand[2], GOLD[2], gi) * inner;
        const edge = cl(1 - (hw - dl) / 1.1, 0, 1);
        if (edge > 0) {
          const ev = edge * 0.8, gx = min(1, F * 0.9 + gh * 0.45);
          r += mix(cBand[0], GOLD[0], gx) * ev;
          g += mix(cBand[1], GOLD[1], gx) * ev;
          b += mix(cBand[2], GOLD[2], gx) * ev;
        }
        if (dl < 0.95) {
          // On the centre line: the tile this stretch of the line belongs to.
          const t = u * cs + v * sn;
          let lo = 0, hi = ncount - 1;
          if (t >= ct[0] && t < ct[ncount]) {
            while (lo < hi) {
              const mid = (lo + hi + 1) >> 1;
              if (ct[mid] <= t) lo = mid;
              else hi = mid - 1;
            }
            const c = tileCol(lo), bo = boost(lo), wgt = 1 - dl / 1.15;
            const bead = cl(1 - abs(t - ct[lo]) * D / 1.1, 0, 1) * 0.6;
            const wh = min(1, bo[0] * 0.55 + bead + bo[1] * 0.6);
            const mixc = (q) => {
              const base = c[q] * 0.82 * wgt;
              const tint = q === 0 ? GOLD[0] : q === 1 ? GOLD[1] : GOLD[2];
              return mix(mix(base, tint, bo[1] * 0.8), cWhite[q], wh * wgt);
            };
            r = r * (1 - wgt) + mixc(0);
            g = g * (1 - wgt) + mixc(1);
            b = b * (1 - wgt) + mixc(2);
          }
        }
      } else if (dl - hw < 9) {
        const h = 0.17 * exp(-(dl - hw) / 2.4);
        r = cBand[0] * h;
        g = cBand[1] * h;
        b = cBand[2] * h;
      }
      if (r + g + b > 0) put(B, x, y, r, g, b);
    }
  }

  // The lattice: a dim dot where the strip does not take the point.
  const bandHas = new Uint8Array(NI * NJ);
  for (let k = 0; k < n; k++) {
    const i = ci[k], j = cj[k];
    if (i >= 0 && i < NI && j >= 0 && j < NJ) bandHas[j * NI + i] = 1;
  }
  for (let j = 0; j < NJ; j++)
    for (let i = 0; i < NI; i++) {
      if (bandHas[j * NI + i]) continue;
      const o = (Y0 - D * j) * W + X0 + D * i;
      B[o * 3] = cDot[0];
      B[o * 3 + 1] = cDot[1];
      B[o * 3 + 2] = cDot[2];
    }

  // The lit points, each with a stem to the line and the colour of its tile.
  for (let k = 0; k + 1 < n; k++) {
    const i = ci[k], j = cj[k];
    if (i < 0 || i >= NI || j < 0 || j >= NJ) continue;
    const c = tileCol(k), px = X0 + D * i + 0.5, py = Y0 - D * j + 0.5;
    const pr = (-i * sn + j * cs - pc) * D;
    const steps = floor(abs(pr) * 2);
    for (let q = 0; q < steps; q++) {
      const s = (q / steps) * pr;
      put(B, floor(px + s * sn), floor(py + s * cs), c[0] * 0.3, c[1] * 0.3, c[2] * 0.3);
    }
    const bo = boost(k);
    const lit = [mix(mix(c[0], cWhite[0], bo[0] * 0.5), GOLD[0], bo[1] * 0.7), mix(mix(c[1], cWhite[1], bo[0] * 0.5), GOLD[1], bo[1] * 0.7), mix(mix(c[2], cWhite[2], bo[0] * 0.5), GOLD[2], bo[1] * 0.7)];
    disc(B, px, py, 1.75, lit, 1);
    disc(B, px, py, 0.7, cWhite, 0.4);
  }
  // The cursor's spark on the centre line.
  {
    const dt = tau - tc, sh = S.shift + EPS, fx = X0 + D * (PX + dt * cs - sh * sn) + 0.5, fy = Y0 - D * (PY + dt * sn + sh * cs) + 0.5;
    if (fy < LAT) disc(B, fx, fy, 1.6, cWhite, 0.55);
  }

  // The tape: the chain from UT before the pivot's projection to UT after it
  // laid out at the lattice's own scale, 7 LEDs to a unit, on two rows.
  const tp = S.tape, dk = S.dark;
  tp.fill(0);
  dk.fill(1);
  for (let k = 0; k + 1 < n; k++) {
    const u0 = (ct[k] - tc) * D + 64, u1 = (ct[k + 1] - tc) * D + 64;
    if (u1 < 0) continue;
    if (u0 >= 128) break;
    const c = tileCol(k), inb = ci[k] >= 0 && ci[k] < NI && cj[k] >= 0 && cj[k] < NJ && ci[k + 1] >= 0 && ci[k + 1] < NI && cj[k + 1] >= 0 && cj[k + 1] < NJ;
    const bo = boost(k), br = inb ? 0.95 : 0.4;
    const wh = bo[0] * 0.5, gd = bo[1] * 0.75, fl = F * 0.3;
    const rr = (mix(mix(c[0], cWhite[0], wh), GOLD[0], gd) + GOLD[0] * fl) * br;
    const gg = (mix(mix(c[1], cWhite[1], wh), GOLD[1], gd) + GOLD[1] * fl) * br;
    const bb = (mix(mix(c[2], cWhite[2], wh), GOLD[2], gd) + GOLD[2] * fl) * br;
    for (let p = max(0, floor(u0)); p < min(128, ceil(u1)); p++) {
      const cov = max(0, min(u1, p + 1) - max(u0, p));
      tp[p * 4] += rr * cov;
      tp[p * 4 + 1] += gg * cov;
      tp[p * 4 + 2] += bb * cov;
    }
    for (let p = max(0, floor(u0 - 1)); p <= min(127, floor(u0 + 1)); p++) {
      const dd = abs(p + 0.5 - u0);
      if (dd < 0.95) dk[p] = min(dk[p], 0.3 + 0.7 * dd / 0.95);
    }
  }
  // Flash on the tape's frame when the slope lands on phi.
  for (let p = 0; p < 128; p++) {
    const row = p >> 6, x = p & 63, y0 = TAPE[row];
    for (let r = 0; r < TH; r++) {
      const shade = (r === 0 ? 0.86 : r === TH - 1 ? 0.62 : 1) * dk[p];
      const o = (y0 + r) * W + x;
      B[o * 3] += tp[p * 4] * shade;
      B[o * 3 + 1] += tp[p * 4 + 1] * shade;
      B[o * 3 + 2] += tp[p * 4 + 2] * shade;
    }
  }
  // Rational stops: a gold bracket over one period, and a tick at the start
  // of every later period. At phi there is nothing to bracket.
  const per = S.stop >= 0 && STOPS[S.stop].p ? STOPS[S.stop].p + STOPS[S.stop].q : 0;
  if (per && S.canon) {
    const ea = sm(S.age / 0.35) * sm(S.left / 0.3);
    let k0 = 0;
    while (k0 < n && (ct[k0] - tc) * D + 64 < 1) k0++;
    const ua = (ct[k0] - tc) * D + 64, ub = (ct[min(n - 1, k0 + per)] - tc) * D + 64;
    for (let p = max(0, floor(ua)); p < min(128, floor(ub)); p++) {
      const row = p >> 6;
      put(B, p & 63, TAPE[row] - 2, GOLD[0] * 0.9 * ea, GOLD[1] * 0.9 * ea, GOLD[2] * 0.9 * ea);
    }
    for (let k = k0; k < n; k += per) {
      const u = (ct[k] - tc) * D + 64;
      if (u >= 128) break;
      const row = u >= 64 ? 1 : 0, x = floor(u) & 63, y = TAPE[row] - 3;
      for (let q = 0; q < 2; q++) put(B, x, y - q, GOLD[0] * ea, GOLD[1] * ea, GOLD[2] * ea);
    }
  }

  // The ratio of long to short among the first n tiles from the pivot, for n
  // from 3 up, as the miss from the ratio the whole chain has. The gold line
  // is phi. At a rational slope the misses repeat; at phi they die away.
  const gold = cl(1 - abs(PHI - S.ref) / 0.025, 0, 1), RX = 18, SC = 0.06;
  for (let c = 0; c < 46; c++) {
    const dv = S.rat[c] - S.ref, rows = cl(round(dv / SC), -4, 4), x = RX + c;
    put(B, x, RMID, 0.3 + gold * 0.6, 0.3 + gold * 0.5, 0.34 - gold * 0.1);
    const cu = rows > 0 ? cT[0] : cT[2];
    for (let r = 1; r <= abs(rows); r++) {
      const y = rows > 0 ? RMID - r : RMID + r, v = r === 4 ? 1 : 0.85;
      put(B, x, y, cu[0] * v, cu[1] * v, cu[2] * v);
    }
  }
  {
    const off = round((PHI - S.ref) / SC);
    if (abs(off) <= 4 && off !== 0)
      for (let c = 0; c < 46; c += 2) put(B, RX + c, RMID - off, GOLD[0] * 0.5, GOLD[1] * 0.5, GOLD[2] * 0.5);
  }
  // The slope: the fraction at a stop, its value on the way.
  {
    let str, a = 1;
    if (S.stop >= 0) {
      const s = STOPS[S.stop];
      str = s.p ? s.p + "/" + s.q : "f";
      a = 0.5 + 0.5 * sm(S.age / 0.3);
      text(B, str, 1, s.p ? 103 : 102, s.p ? cWhite : GOLD, a);
    } else text(B, (round(S.m * 100) / 100).toFixed(2), 1, 103, cWhite, 0.5);
    if (per && S.canon) text(B, "P" + per, 1, 111, GOLD, 0.7);
    else if (S.stop === 4 && S.canon) text(B, "Po", 1, 111, GOLD, 0.7 + 0.3 * S.flash);
  }

  // Words of each length: the count, a bar of it, and a dot at n + 1, the
  // most a two-tile word can have. Longer than the period, the count stops.
  for (let len = 1; len <= NW; len++) {
    const cnt = S.wc[len], x = (len - 1) * 4, hh = min(17, cnt);
    const cu = cnt === len + 1 ? cT[0] : cnt < len + 1 ? cT[2] : cT[1];
    for (let r = 0; r < hh; r++) {
      const v = r === hh - 1 ? 1 : 0.62;
      for (let q = 0; q < 3; q++) put(B, x + q, CHB - r, cu[0] * v, cu[1] * v, cu[2] * v);
    }
    if (len + 1 <= 17) put(B, x + 1, CHB - len, cWhite[0] * 0.55, cWhite[1] * 0.55, cWhite[2] * 0.55);
  }
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, min(255, B[p * 3] * 255), min(255, B[p * 3 + 1] * 255), min(255, B[p * 3 + 2] * 255));
}
