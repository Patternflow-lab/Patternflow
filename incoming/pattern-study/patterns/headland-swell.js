// ===== Patternflow pattern =====
// Title:   Headland Swell
// Family:  shoaling
// Idea:    A long ocean swell, four wave trains of slightly different period and bearing, is solved on a grid as the linear long-wave equation over a hand-built sea floor, so the crests slow in the shallows, bend round a rocky headland and pile their energy onto it, grow as they shoal and break into soft white water along the point and the two beaches, seen from above under a low sun.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: wave shoaling (George Green, 1837; George Biddell Airy, 1845, tides and waves in canals), the depth at which a wave breaks, height about 0.78 of the depth (James McCowan, 1894), and refraction of swell onto headlands, worked into surf forecasts for the Normandy landings (Walter Munk and Roger Revelle, 1944); pattern round 222
// Round:   222
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Period=1..3, Direction=-40..40, Tide=-1..1
//
// Knob 1: Hue. Turns the colour of the sea round the wheel, 0 to 1 once round. At the opening 0 the water runs from deep navy at the top through teal and turquoise over the shelf to pale aqua on the shoals; rock stays slate and sand stays sand, foam stays white. The sea also drifts by itself, by up to 0.09 of a turn either way, over a minute or two.
// Knob 2: Period. The period of the swell the wave maker sends, 0.85 s at 1, 1.2 s at the opening 2 and 1.55 s at 3. The sea floor does not change, so the wavelength in deep water, 14 LEDs a second times the period, is 12 LEDs at 1, 17 at 2 and 22 at 3: from a short choppy swell with many crests on the panel to a long slow one with three or four. A longer swell is also a little higher. The crests at the top change within a second and the surf at the point within 5 s.
// Knob 3: Direction. The bearing the swell comes from, measured from straight above, -40 degrees from the upper left to +40 from the upper right, 0 at the opening. The wave maker turns toward the knob with a time constant of 1.1 s, so 40 degrees takes about 3 s. The crests at the top follow within a second, the refraction at the point in about 5 s and the far beach in about 10 s. From the left the left flank of the headland takes the surf and the right one lies in its lee.
// Knob 4: Tide. Raises or lowers the water everywhere by up to 0.07 of the deep-water depth, lowest at -1, 0 at the middle and highest at 1. The shoreline of the bays moves 8 LEDs either way (row 116 to 108 or 124 in the left bay), the headland tip stands at row 65 at -1, 70 at 0 and 78 at 1, the two stacks of rock off it go under as the tide comes up (the small one by about 0.7, the large one at 1), and the line where the swell breaks moves seaward on a falling tide and inland on a rising one. The sea level also wanders by itself, by up to 0.03.

// The sea floor, h(x, y), is a sum of smooth functions: a shoreline that wanders down the panel, a headland 36 LEDs
// high with a shoulder on its right and a hook at its tip, whose depth contours spread wider the farther out they
// lie, a rocky point at each edge, two stacks of rock off the tip and a drowned reef off the left bay. Depth is 1 in
// the deep water at the top, falls with the distance from the shore to the power 1.4 over the last 64 LEDs, and is
// held at 0.02 on land, where a heavy friction stands in for the beach.
// The solver is the linear shallow-water pair on a staggered grid, one LED a cell, 88 by 134 with 12 columns and 6 rows
// outside the panel: eta_t = -div q and q_t = -g h grad eta, g = 196 so that c = sqrt(g h) is 14 LEDs a second in deep
// water, in steps of 1/60 s. The Courant number is at most 0.25 (the 2D limit is 0.71). The shortest wave in the deep
// water is 12 LEDs, 1 percent slow from the grid, and on the shoals where the depth is a tenth the wavelength is 5
// LEDs and 6 percent slow.
// The wave maker is a relaxation zone: along the top and down the upper sides eta and q are pulled toward the sum of
// four plane waves (period T times 1, 1.09, 0.93, 1.17; bearing plus 0, 15, -12, 26 degrees), whose strengths, bearings
// and periods each wander on a slow random walk, so the same zone also absorbs what comes back. Below the deep water
// it pulls toward flat. Shoaling and refraction are not coded: they come out of the equation.
// Two things are not the equation. A breaking drag, growing once a crest is above 0.4 of the depth, holds the height
// near that limit so the nearshore stays finite; and the white water is a map, not a simulation. A crest above 0.2 of
// the depth feeds foam into it, and it fades over 1.1 s with no motion of its own.

const W = 64, H = 128;
const PX = 12, PT = 6; // columns left and right of the panel, rows above it
const NX = W + 2 * PX, NY = H + PT, NC = NX * NY;
const G = 196; // c = sqrt(g h), 14 LEDs a second at h = 1
const DT = 1 / 60;
const HMIN = 0.02; // depth the solver uses on land
const TIDE = 0.07;
const PRE = 20; // seconds the first update runs ahead
const FOAM_T = 1.1, WET_T = 5;
const { floor, abs, sqrt, sin, cos, exp, pow, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the coast

const XH = 33.5, SL = 10.5, SR = 7.5, AH = 36; // headland: centre, half widths, height in LEDs
const XPR = 67, XPL = -2;
const STACK = [[26.5, 68, 2.1, 0.07], [41, 61, 1.6, 0.05]]; // x, y, radius, how far it stands above the mean sea // the small points at the edges

// The y of the waterline at column x. w widens every bump and shortens it, which spreads the contours out to sea.
function coastBase(x) {
  return 111 + 4.2 * cos((x - 6) * 0.085) - 0.07 * (x - 32) + 1.5 * sin(x * 0.33 + 0.7);
}

function coastY(x, w) {
  const base = coastBase(x);
  const u = (abs(x - XH) / (x < XH ? SL : SR) / w) * (1 + 0.1 * sin(x * 0.52 + 1) / w);
  const ux = (x - 43.5) / (4 * w), uk = (x - 29.5) / (3.2 * w);
  const hl = (AH * exp(-pow(u, 2.4)) + 6 * exp(-ux * ux) + 5 * exp(-uk * uk)) / sqrt(w);
  const pr = (14 * exp(-pow((x - XPR) / (6 * w), 2))) / sqrt(w);
  const pl = (9 * exp(-pow((x - XPL) / (5 * w), 2))) / sqrt(w);
  return base - hl - pr - pl;
}

function build(S) {
  const nz = new Float32Array(NC);
  const r = rng(77);
  const grid = [];
  for (let k = 0; k < 4; k++) {
    const n = k < 3 ? 5 + 4 * k : 22, g = new Float32Array((n + 2) * (n + 2));
    for (let i = 0; i < g.length; i++) g[i] = r();
    grid.push({ n, g });
  }
  const vnoise = (x, y, k0 = 0, k1 = 3) => {
    let v = 0, a = k0 ? 1 : 0.55, tot = 0;
    for (let k = k0; k < k1; k++) {
      const { n, g } = grid[k];
      const fx = ((x + PX) / NX) * n, fy = ((y + PT) / NY) * n, ix = floor(fx), iy = floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const q = (a2, b2) => g[(iy + b2) * (n + 2) + ix + a2];
      v += a * mix(mix(q(0, 0), q(1, 0), sx), mix(q(0, 1), q(1, 1), sx), sy);
      tot += a;
      a *= 0.5;
    }
    return v / tot;
  };
  for (let j = 0; j < NY; j++) {
    const y = j - PT;
    for (let i = 0; i < NX; i++) {
      const x = i - PX, c = j * NX + i;
      // Two passes: the first finds how far out to sea this cell is, the second takes the coast as it is drawn
      // from that far, wider and lower.
      const d1 = coastY(x, 1) - y;
      const w = 1 + 0.035 * max(d1, 0);
      let d = coastY(x, w) - y;
      let h;
      if (d >= 0) h = 0.97 * pow(min(d / 64, 1), 1.4) + 0.03 * min(d / 4, 1);
      else h = d * 0.0085;
      // two stacks of rock off the point, under water at the highest tide
      for (let k = 0; k < 2; k++) {
        const sx = x - STACK[k][0], sy = y - STACK[k][1], q = (sx * sx + sy * sy) / (STACK[k][2] * STACK[k][2]);
        if (q < 6) h = min(h, 0.012 * q * 4 - STACK[k][3]);
      }
      // a drowned reef off the left bay
      const rx = x - 13, ry = y - 83;
      h -= 0.19 * exp(-(rx * rx) / 18 - (ry * ry) / 30) * sm(0, 0.12, h);
      nz[c] = vnoise(x, y);
      S.nd[c] = vnoise(x, y, 3, 4);
      S.hb[c] = h;
      // rock: the headland and the points, fading into sand toward the bottom edge
      const gh = (exp(-pow(abs(x - XH) / (x < XH ? SL : SR), 2.4)) * AH + 6 * exp(-pow((x - 43.5) / 4, 2))) / AH;
      const gp = exp(-pow((x - XPR) / 6, 2));
      const gl = exp(-pow((x - XPL) / 5, 2));
      const yb = coastBase(x);
      const foot = yb + 7 + 8 * (nz[c] - 0.5);
      let rk = sm(0.2, 0.42, max(gh, gp, gl)) * (1 - 0.92 * sm(foot - 2.5, foot + 2.5, y));
      for (let k = 0; k < 2; k++) {
        const sx = x - STACK[k][0], sy = y - STACK[k][1];
        if (sx * sx + sy * sy < 4 * STACK[k][2] * STACK[k][2]) rk = 1;
      }
      S.rock[c] = cl(rk, 0, 1);
    }
  }
  S.nz = nz;
  // light on the land: the sun is toward the upper left, so ground that rises away from it is lit
  for (let j = 1; j < NY - 1; j++)
    for (let i = 1; i < NX - 1; i++) {
      const c = j * NX + i;
      const ex = -(S.hb[c + 1] - S.hb[c - 1]) * 0.5, ey = -(S.hb[c + NX] - S.hb[c - NX]) * 0.5;
      S.land[c] = cl(0.5 + 55 * (0.6 * ex + 0.8 * ey), 0, 1);
      for (let k = 0; k < 2; k++) {
        const sx = (c % NX) - PX - STACK[k][0], sy = floor(c / NX) - PT - STACK[k][1];
        if (sx * sx + sy * sy < 5 * STACK[k][2] * STACK[k][2]) S.land[c] = 0.45 + 0.55 * S.land[c];
      }
    }
  // the wave maker's relaxation zone: top rows and the upper sides
  const idx = [], gam = [], amp = [];
  const ZT = PT + 10, ZS = PX + 8;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const gt = j < ZT ? pow((ZT - j) / ZT, 2) : 0;
      const gl2 = i < ZS ? pow((ZS - i) / ZS, 2) : 0;
      const gr = i > NX - 1 - ZS ? pow((i - (NX - 1 - ZS)) / ZS, 2) : 0;
      const g = 0.25 * max(gt, gl2, gr);
      if (g < 0.004) continue;
      idx.push(j * NX + i);
      gam.push(g);
      amp.push(gt > 0 ? 1 : 1 - sm(14, 46, j - PT));
    }
  S.nIdx = Int32Array.from(idx);
  S.nGam = Float32Array.from(gam, (g) => 1 - (1 - g) * (1 - g));
  S.nAmp = Float32Array.from(amp);
  S.nX = new Float32Array(idx.length);
  S.nY = new Float32Array(idx.length);
  for (let n = 0; n < idx.length; n++) {
    S.nX[n] = (idx[n] % NX) - PX - 32;
    S.nY[n] = floor(idx[n] / NX) - PT;
  }
}

// ---- state

const TRAIN_T = [1, 1.09, 0.93, 1.17];
const TRAIN_B = [0, 15, -12, 26]; // degrees added to the bearing
const TRAIN_A = [1, 0.8, 0.65, 0.5];


export function setup(params) {
  const f = () => new Float32Array(NC + NX + 2);
  const r = rng(2222);
  const S = {
    ready: false, t: 0, acc: 0, rnd: r,
    hue: 0, per: 2, dir: 0, tide: 0.0045, tideFor: 9,
    hb: new Float32Array(NC), nd: new Float32Array(NC), rock: new Float32Array(NC), land: new Float32Array(NC), nz: null,
    eta: f(), qx: f(), qy: f(), c2x: f(), c2y: f(), fdx: f(), fdy: f(), kd: f(), hs: f(),
    foam: new Float32Array(NC), foamB: new Float32Array(NC), wet: new Float32Array(NC),
    lut: new Float32Array(64 * 3), lutHue: 9,
    ou: { g: 1, b: [0, 0, 0, 0], a: [0.7, 0.7, 0.7, 0.7], p: [0, 0, 0, 0], hue: 0, tide: 0 },
    sm: { g: 1, b: [0, 0, 0, 0], a: [0.7, 0.7, 0.7, 0.7], p: [0, 0, 0, 0], hue: 0, tide: 0 },
    pacc: [0, 1, 2, 3].map(() => r() * 2 * PI), sub: 0,
    aq: [0, 1, 2, 3].map(() => r() * 2 * PI),
    tr: [0, 1, 2, 3].map(() => ({ k: 0, kx: 0, ky: 0, dx: 0, dy: 0, w: 0, a: 0, ph: 0 })),
  };
  build(S);
  params.s = S;
}

const gauss = (r) => sqrt(-2 * Math.log(r() + 1e-9)) * cos(2 * PI * r());

// Slow random walks that pull back to their middle (Ornstein-Uhlenbeck): the strength of the whole swell, the
// strength, bearing and period of each train, the hue of the sea and the sea level. They never come round to the same state twice.
function wander(S, d) {
  const o = S.ou, r = S.rnd;
  const walk = (x, tau, sd) => x - (x * d) / tau + sd * sqrt((2 * d) / tau) * gauss(r);
  o.g = cl(1 + walk(o.g - 1, 26, 0.34), 0.5, 1.6);
  for (let j = 0; j < 4; j++) {
    o.b[j] = cl(walk(o.b[j], 30, 8), -14, 14);
    o.a[j] = cl(0.7 + walk(o.a[j] - 0.7, 22, 0.32), 0.25, 1.15);
    o.p[j] = cl(walk(o.p[j], 80, 0.02), -0.04, 0.04);
  }
  o.hue = cl(walk(o.hue, 60, 0.04), -0.09, 0.09);
  o.tide = cl(walk(o.tide, 32, 0.012), -0.03, 0.03);
  // What the wave maker and the sea level read is these walks put through a low-pass of 7 s, since a step of the
  // random walk is white noise, and noise in the bearing or the period would be sent down the panel as waves.
  const m = S.sm, k = 1 - exp(-d / 7);
  m.g += (o.g - m.g) * k;
  m.hue += (o.hue - m.hue) * k;
  m.tide += (o.tide - m.tide) * k;
  for (let j = 0; j < 4; j++) {
    m.b[j] += (o.b[j] - m.b[j]) * k;
    m.a[j] += (o.a[j] - m.a[j]) * k;
    m.p[j] += (o.p[j] - m.p[j]) * k;
  }
}

function trains(S) {
  wander(S, 2 * DT);
  const T = 0.5 + 0.35 * S.per;
  const c0 = sqrt(G * (1 + S.tide));
  const A0 = 0.05 * sqrt(T / 1.2) * S.sm.g;
  for (let j = 0; j < 4; j++) {
    const o = S.tr[j], Tj = T * TRAIN_T[j] * (1 + S.sm.p[j]);
    const th = ((S.dir + TRAIN_B[j] + S.sm.b[j]) * PI) / 180;
    o.w = (2 * PI) / Tj;
    o.k = o.w / c0;
    // the swell comes from the bearing, so it travels away from it
    o.dx = -sin(th);
    o.dy = cos(th);
    o.kx = o.k * o.dx;
    o.ky = o.k * o.dy;
    o.a = A0 * TRAIN_A[j] * S.sm.a[j];
    // the phase is summed, not worked out from the time, so that a change of period never jumps it
    o.ph = S.pacc[j];
    S.pacc[j] += o.w * 2 * DT;
  }
}

function setDepth(S) {
  const td = S.tide;
  for (let c = 0; c < NC; c++) {
    const h = S.hb[c] + td;
    S.hs[c] = h;
  }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      const h0 = max(S.hs[c], HMIN);
      S.c2x[c] = i > 0 ? G * 0.5 * (h0 + max(S.hs[c - 1], HMIN)) : 0;
      S.c2y[c] = j > 0 ? G * 0.5 * (h0 + max(S.hs[c - NX], HMIN)) : 0;
    }
  S.tideFor = S.tide;
}

// Friction near and on the beach, and the breaking drag where a crest stands too high for the depth.
function drag(S) {
  const { eta, hs, kd } = S;
  for (let c = 0; c < NC; c++) {
    const h = hs[c];
    let r = 5 * sm(0.035, -0.004, h);
    const hh = h > 0.03 ? h : 0.03;
    const e = eta[c] > 0 ? eta[c] : -eta[c];
    r += 3 * sm(0.4, 0.75, e / hh) * (h > 0 ? 1 : 0);
    kd[c] = DT * r;
  }
  const { fdx, fdy } = S;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      fdx[c] = i > 0 ? 1 / (1 + 0.5 * (kd[c] + kd[c - 1])) : 0;
      fdy[c] = j > 0 ? 1 / (1 + 0.5 * (kd[c] + kd[c - NX])) : 0;
    }
}

function step(S, nudge) {
  const { eta, qx, qy, c2x, c2y, fdx, fdy } = S;
  S.t += DT;
  for (let j = 0; j < NY; j++) {
    const row = j * NX;
    for (let i = 1; i < NX; i++) {
      const c = row + i;
      qx[c] = (qx[c] - DT * c2x[c] * (eta[c] - eta[c - 1])) * fdx[c];
    }
  }
  for (let j = 1; j < NY; j++) {
    const row = j * NX;
    for (let i = 0; i < NX; i++) {
      const c = row + i;
      qy[c] = (qy[c] - DT * c2y[c] * (eta[c] - eta[c - NX])) * fdy[c];
    }
  }
  for (let c = 0; c < NC; c++) eta[c] -= DT * (qx[c + 1] - qx[c] + qy[c + NX] - qy[c]);
  if (!nudge) return;
  // the wave maker, applied once for every two sub-steps with twice the pull
  const tr = S.tr;
  const dtp = S.t - S.tFrame;
  const { nIdx, nGam, nAmp, nX, nY, hs } = S;
  const n = nIdx.length;
  const t0 = tr[0], t1 = tr[1], t2 = tr[2], t3 = tr[3];
  const p0 = t0.ph + t0.w * dtp, p1 = t1.ph + t1.w * dtp, p2 = t2.ph + t2.w * dtp, p3 = t3.ph + t3.w * dtp;
  for (let m = 0; m < n; m++) {
    const c = nIdx[m], x = nX[m], y = nY[m], a = nAmp[m], g = nGam[m];
    if (a < 0.002) {
      eta[c] -= g * eta[c];
      qx[c] -= g * qx[c];
      qy[c] -= g * qy[c];
      continue;
    }
    const s0 = t0.a * sin(t0.kx * x + t0.ky * y - p0);
    const s1 = t1.a * sin(t1.kx * x + t1.ky * y - p1);
    const s2 = t2.a * sin(t2.kx * x + t2.ky * y - p2);
    const s3 = t3.a * sin(t3.kx * x + t3.ky * y - p3);
    const cw = sqrt(G * max(hs[c], HMIN)) * a;
    eta[c] += g * (a * (s0 + s1 + s2 + s3) - eta[c]);
    qx[c] += g * (cw * (t0.dx * s0 + t1.dx * s1 + t2.dx * s2 + t3.dx * s3) - qx[c]);
    qy[c] += g * (cw * (t0.dy * s0 + t1.dy * s1 + t2.dy * s2 + t3.dy * s3) - qy[c]);
  }
}

function runFor(S, seconds) {
  S.acc += seconds;
  let n = 0;
  while (S.acc >= DT && n < 4000) {
    if ((S.sub & 1) === 0) {
      S.tFrame = S.t;
      trains(S);
    }
    step(S, (S.sub & 1) === 1);
    S.sub++;
    S.acc -= DT;
    n++;
  }
}

function foamAndWet(S, d) {
  const { eta, hs, foam, wet, nz } = S;
  const kf = exp(-d / FOAM_T), kw = exp(-d / WET_T);
  for (let j = PT; j < NY; j++)
    for (let i = PX; i < PX + W; i++) {
      const c = j * NX + i, h = hs[c], e = eta[c];
      let inj = 0;
      if (h > 0.004 && e > 0) {
        const hh = h > 0.03 ? h : 0.03;
        inj = sm(0.2, 0.42, e / hh) * (0.7 + 0.6 * nz[c]) * sm(0.004, 0.03, h);
        // a crest running up the beach in a thin sheet of water
        const lace = sm(0.01, 0.034, e) * (1 - sm(0.03, 0.08, h)) * (0.85 + 0.3 * nz[c]);
        if (lace > inj) inj = lace;
      }
      const f = foam[c] * kf;
      foam[c] = inj > f ? inj : f;
      // the swash: water that stands above the sand, remembered for a few seconds
      const lvl = h + e;
      const wv = sm(-0.004, 0.012, lvl);
      const w = wet[c] * kw;
      wet[c] = wv > w ? wv : w;
    }
  // blur the foam by 1 2 1 each way so no single LED stands alone
  const fb = S.foamB;
  for (let j = PT; j < NY; j++) {
    for (let i = PX; i < PX + W; i++) {
      const c = j * NX + i;
      fb[c] = 0.25 * foam[c - 1] + 0.5 * foam[c] + 0.25 * foam[c + 1];
    }
  }
  const t2 = S.t2 || (S.t2 = new Float32Array(NC));
  for (let j = PT + 1; j < NY - 1; j++)
    for (let i = PX; i < PX + W; i++) {
      const c = j * NX + i;
      t2[c] = 0.25 * fb[c - NX] + 0.5 * fb[c] + 0.25 * fb[c + NX];
    }
  for (let j = PT + 1; j < NY - 1; j++)
    for (let i = PX; i < PX + W; i++) {
      const c = j * NX + i;
      fb[c] = t2[c];
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  // the sea also rises and falls a little of itself, by up to 0.03, on a slow random walk of its own
  const surge = S.sm.tide;
  const tgtDir = cl(kn[2], -40, 40), tgtTide = cl(kn[3], -1, 1) * TIDE + surge, tgtPer = cl(kn[1], 1, 3);
  // the colour of the sea also sways, by up to 0.09 of a turn either way, as the light and the water change
  S.hue = kn[0] + S.sm.hue;
  if (!S.ready) {
    // the sea is already running when the panel opens, with the knobs where they stand
    S.dir = tgtDir;
    S.tide = tgtTide;
    S.per = tgtPer;
    setDepth(S);
    for (let k = 0; k < PRE * 60; k += 2) {
      if ((k & 7) === 0) drag(S);
      runFor(S, 2 * DT);
    }
    S.acc = 0;
    S.ready = true;
  } else {
    const a1 = 1 - exp(-d / 0.7), a2 = 1 - exp(-d / 0.45), a3 = 1 - exp(-d / 1.1);
    S.tide += (tgtTide - S.tide) * a1;
    S.per += (tgtPer - S.per) * a2;
    S.dir += (tgtDir - S.dir) * a3;
    if (abs(S.tide - S.tideFor) > 0.0004) setDepth(S);
    drag(S);
    runFor(S, d);
  }
  foamAndWet(S, d);
}

// ---- drawing

// Control points of the water colour by sqrt(depth), deep at 1: navy, teal, turquoise, pale aqua, and at 0 the sand
// seen through a film of water.
const PAL = [
  [0, 168, 210, 190],
  [0.12, 150, 232, 212],
  [0.26, 70, 206, 192],
  [0.44, 24, 164, 168],
  [0.62, 8, 112, 146],
  [0.8, 8, 78, 148],
  [1, 10, 50, 128],
];
const SAND = [226, 202, 160], WETSAND = [124, 98, 70];
const SLATE = [64, 78, 98], RIM = [140, 162, 176];

function buildLut(S) {
  const a = 2 * PI * S.hue, ca = cos(a), sa = sin(a) * 0.57735, k = (1 - ca) / 3;
  const m = [ca + k, k - sa, k + sa, k + sa, ca + k, k - sa, k - sa, k + sa, ca + k];
  for (let n = 0; n < 64; n++) {
    const t = n / 63;
    let p = 0;
    while (p < PAL.length - 2 && PAL[p + 1][0] < t) p++;
    const A = PAL[p], B = PAL[p + 1], u = cl((t - A[0]) / (B[0] - A[0]), 0, 1);
    const r = mix(A[1], B[1], u), g = mix(A[2], B[2], u), b = mix(A[3], B[3], u);
    S.lut[n * 3] = m[0] * r + m[1] * g + m[2] * b;
    S.lut[n * 3 + 1] = m[3] * r + m[4] * g + m[5] * b;
    S.lut[n * 3 + 2] = m[6] * r + m[7] * g + m[8] * b;
  }
  S.lutHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) buildLut(S);
  const { eta, hs, lut, foamB, wet, rock, land } = S;
  // Soft cloud shadows slide across the picture: a product of two slow plane waves, 78 and 100 LEDs long, dims it by up to 28 percent.
  const t = S.t, sx1 = [], cx1 = [], sx2 = [], cx2 = [], sy1 = [], cy1 = [], sy2 = [], cy2 = [];
  for (let x = 0; x < W; x++) {
    sx1[x] = sin(0.08 * x - 0.19 * t);
    cx1[x] = cos(0.08 * x - 0.19 * t);
    sx2[x] = sin(0.037 * x + 0.13 * t + 1);
    cx2[x] = cos(0.037 * x + 0.13 * t + 1);
  }
  for (let y = 0; y < H; y++) {
    sy1[y] = sin(0.043 * y);
    cy1[y] = cos(0.043 * y);
    sy2[y] = sin(-0.061 * y);
    cy2[y] = cos(-0.061 * y);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = (y + PT) * NX + x + PX, h = hs[c];
      let r, g, b;
      if (h > 0.0005) {
        const t = sqrt(h > 1 ? 1 : h) * 63, n = floor(t), u = t - n, n1 = n < 63 ? n + 1 : 63;
        r = mix(lut[n * 3], lut[n1 * 3], u);
        g = mix(lut[n * 3 + 1], lut[n1 * 3 + 1], u);
        b = mix(lut[n * 3 + 2], lut[n1 * 3 + 2], u);
        // slope of the surface toward the sun, low and almost due north
        const ex = (eta[c + 1] - eta[c - 1]) * 0.5, ey = (eta[c + NX] - eta[c - NX]) * 0.5;
        const v = (0.12 * ex + 0.99 * ey) * 130;
        const s = v / (1 + 0.8 * abs(v));
        const e = eta[c] / (0.035 * pow(h > 0.03 ? h : 0.03, -0.25));
        const lum = 0.86 + 0.45 * s;
        const ec = max(0, e - 0.55) / 0.8;
        const sp = max(0, s - 0.1);
        const spec0 = sp * sp * sp * 2.6 + ec * ec * 0.45, spec = spec0 > 0.8 ? 0.8 : spec0;
        r = r * lum + 60 * spec;
        g = g * lum + 110 * spec;
        b = b * lum + 120 * spec;
        const f = foamB[c] * sm(0.002, 0.03, h) * 1.1;
        if (f > 0) {
          const ff = f > 1 ? 1 : f * f * (3 - 2 * f);
          r = mix(r, 236, ff);
          g = mix(g, 248, ff);
          b = mix(b, 246, ff);
        }
      } else {
        // land: sand, or rock where the headland stands
        const wt = max(wet[c], sm(-0.05, -0.002, h) * 0.85);
        const lt = 0.88 + 0.25 * land[c] + 0.2 * (S.nz[c] - 0.5);
        let sr = mix(SAND[0], WETSAND[0], wt) * lt, sg = mix(SAND[1], WETSAND[1], wt) * lt, sb = mix(SAND[2], WETSAND[2], wt) * lt;
        const rk = rock[c];
        if (rk > 0) {
          const rim = sm(-0.03, -0.003, h);
          const rl = 0.8 + 0.5 * land[c] + 0.55 * (S.nz[c] - 0.5) + 0.7 * (S.nd[c] - 0.5);
          const rr = (SLATE[0] * rl) * (1 - rim) + RIM[0] * rim * (0.6 + 0.4 * land[c]);
          const rg = (SLATE[1] * rl) * (1 - rim) + RIM[1] * rim * (0.6 + 0.4 * land[c]);
          const rb = (SLATE[2] * rl) * (1 - rim) + RIM[2] * rim * (0.6 + 0.4 * land[c]);
          sr = mix(sr, rr, rk);
          sg = mix(sg, rg, rk);
          sb = mix(sb, rb, rk);
        }
        r = sr;
        g = sg;
        b = sb;
      }
      const cs = 1 - 0.14 * (1 + (sx1[x] * cy1[y] + cx1[x] * sy1[y]) * (sx2[x] * cy2[y] + cx2[x] * sy2[y]));
      r *= cs;
      g *= cs;
      b *= cs;
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
