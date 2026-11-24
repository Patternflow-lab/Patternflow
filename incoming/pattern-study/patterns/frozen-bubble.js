// ===== Patternflow pattern =====
// Title:   Frozen Bubble
// Family:  frozenbubble
// Idea:    Three soap bubbles stand one above another in the night, each wearing a rainbow film that has drained to magenta and gold bands at the bottom and thinned to blue and black at the top while Marangoni eddies wander through it, until a crystal seeds at one point and a feathered dendrite front runs over the film leaving pale blue frost, the frozen shell glints for a few seconds, cracks, drops away in pieces, and a new bubble swells from a point in its place, every bubble on its own random clock.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: thin-film interference (Thomas Young, 1801, from memory), the dendritic crystal front seen when a soap bubble freezes in cold air, pattern round 236
// Round:   236
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cold=0.3..3, Drain=-1..1, Swirl=-1..1
//
// Knob 1: Hue. Turns the film colour once round the wheel, 0 to 1, about the colours the bubbles open with (magenta, mint, gold, violet, cyan); each bubble keeps its own offset of up to 0.15 turn and wanders a further 0.065 about it. The frost leans a little toward the film's hue and the night mist toward cyan or magenta, and both come back to blue-white and blue at 1.
// Knob 2: Cold. How fast a bubble seeds and freezes, 0.3 to 3. A dendrite arm runs 6.5 LED a second per unit, so 2 LED a second at 0.3, 13 at the opening 2 and 19 at 3, barbs a little slower and the frost fills in behind them at 1.8 per unit. A bubble floats 4.6 to 13 s at 2, 14 to 41 s at 0.3 and 3.6 to 10 s at 3 before it seeds. The film also runs warmer toward 0.3 and bluer toward 3, by up to a sixth of a turn.
// Knob 3: Drain. How far the film has run down, -1 to 1 on a log scale: 0.3 at -1, 0.77 at the opening 0 and 2 at 1. The bottom of the film is 540 nm times that, plus up to 30 percent over a bubble's life, so at -1 there is one gold and pink bloom under a silver top, at 0 two bands of colour and at 1 five, which are narrowed to pearl grey wherever they would be under 2 LED wide.
// Knob 4: Swirl. The Marangoni eddies, -1 to 1 read as a strength of 0 to 1 (0.53 at the opening 0.06), each bubble taking 0.6 to 1.4 of it. At -1 the bands lie flat across the bubble and only drift and sink; at 1 the eddies bend the bands by up to a third of the bubble's height and carry patches of other colour round them. A new bubble swells with up to 0.4 extra.

const W = 64, H = 128, S = 64, SS = S * S;
const { floor, min, max, sqrt, sin, cos, exp, PI, abs, ceil, round, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Lattice noise with a fixed table, so the same seeds give the same swirl on every run.
const PERM = new Uint8Array(512), GRAD = new Float32Array(256);
{
  let s = 1234567;
  const rn = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = floor(rn() * (i + 1)), t = p[i];
    p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) GRAD[i] = rn() * 2 - 1;
}
function n2(x, y) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const X = xi & 255, Y = yi & 255;
  const a = PERM[X] + Y, b = PERM[X + 1] + Y;
  const v00 = GRAD[PERM[a]], v01 = GRAD[PERM[a + 1]], v10 = GRAD[PERM[b]], v11 = GRAD[PERM[b + 1]];
  const l0 = v00 + (v10 - v00) * fx, l1 = v01 + (v11 - v01) * fx;
  return l0 + (l1 - l0) * fy;
}
function n3(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  const a = PERM[X] + Y, b = PERM[X + 1] + Y;
  const aa = PERM[a] + Z, ab = PERM[a + 1] + Z, ba = PERM[b] + Z, bb = PERM[b + 1] + Z;
  const c000 = GRAD[PERM[aa]], c001 = GRAD[PERM[aa + 1]], c010 = GRAD[PERM[ab]], c011 = GRAD[PERM[ab + 1]];
  const c100 = GRAD[PERM[ba]], c101 = GRAD[PERM[ba + 1]], c110 = GRAD[PERM[bb]], c111 = GRAD[PERM[bb + 1]];
  const x00 = c000 + (c100 - c000) * fx, x01 = c001 + (c101 - c001) * fx;
  const x10 = c010 + (c110 - c010) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

// Thin-film colour against optical thickness T = n d cos(theta_t) in nm. Each channel is
// sin^2(2 pi T / lambda) at 640, 540 and 460 nm, averaged over a band of 26 nm either side in
// five steps, which is what lets the high orders fade toward pastel instead of cycling for ever.
const NL = 1024, TMAX = 2400, LS = (NL - 1) / TMAX;
const LUT = new Float32Array(NL * 3);
{
  const lam = [640, 540, 460];
  for (let i = 0; i < NL; i++) {
    const T = (i * TMAX) / (NL - 1), v = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let a = 0;
      for (let k = -2; k <= 2; k++) {
        const s = sin((TAU * T) / (lam[c] + 26 * k));
        a += s * s;
      }
      v[c] = a / 5;
    }
    // Colour first: the bands that come out plain red or brown get blue and a lift so they read as
    // magenta, and the greens lean to mint. The gold, cyan and violet bands are left as they are.
    let [r, g, b] = v;
    const red = sstep(0.62, 0.35, g / max(0.01, r)) * sstep(0.2, 0.5, r);
    b += red * max(0, 0.8 * r - b);
    b += 0.5 * sstep(0.45, 0.85, g) * max(0, 0.75 * g - b);
    const m = max(r, g, b), w = max(red, sstep(0.3, 0.1, g));
    if (m < 0.7 && T > 150) {
      const k = 1 + w * (0.7 / max(0.05, m) - 1);
      r *= k; g *= k; b *= k;
    }
    LUT[i * 3] = min(1, r); LUT[i * 3 + 1] = min(1, g); LUT[i * 3 + 2] = min(1, b);
  }
}

// Rotation of a colour about the grey axis by angle a.
function hueMat(a, M) {
  const c = cos(a), s = sin(a) * 0.57735, k = (1 - c) / 3;
  M[0] = c + k; M[1] = k - s; M[2] = k + s;
  M[3] = k + s; M[4] = c + k; M[5] = k - s;
  M[6] = k - s; M[7] = k + s; M[8] = c + k;
}

const GROW = 0, FLOAT = 1, NUC = 2, FRONT = 3, STAND = 4, CRACK = 5, FALL = 6, GAP = 7;
const VF = 1.8;                         // LED a second the frost fills in at, per unit of Cold
const TIPK = [3.6, 2.8, 2.2];           // dendrite tips outrun the fill by this much: arm, barb, twig
const RIDGE_HW = [0, 1.75, 1.35, 1.1];  // half width of a branch in LED, 3.5, 2.7 and 2.2 wide
const PALE = 0.7;                       // how much of the film's chroma is kept; the panel adds 1.62 times back
const MIST = [0.12, 0.3, 0.75, 0.45, 0.18, 0.72, 0.06, 0.5, 0.58]; // blue, violet and teal of the night mist
const GRAV = 34;                        // LED a second squared, for the falling pieces

function makeBubble(i) {
  return {
    i, stage: GAP, t: 0, dur: 0.2, x0: 32, y0: 21 + 43 * i, bp: [0, 0, 0, 0], bw: [0.5, 0.6, 0.4, 0.55], ax: 0, rs: 1, tn: 0, rot: 0, rv: 0, fa: 0, life: 0, x: 32, y: 21 + 43 * i, R: 18, ox: 0, oy: 0,
    o: new Float32Array(16), hoff: 0, hp: [0, 0, 0], gain: 1, fg: 1, kd: 1, sk: 1, wph: 0, light: 0, lw: 0.3,
    nx: 0, ny: 0, sf: 0, tmax: 10, c0x: 0, c0y: 0, ns: 0,
    T: new Float32Array(SS), D: new Float32Array(SS), ang: new Float32Array(SS), ca: new Float32Array(SS), sa: new Float32Array(SS), cls: new Uint8Array(SS),
    id: new Uint8Array(SS), edge: new Float32Array(SS), buf: new Float32Array(SS * 4),
    sh: new Float32Array(12 * 10), M: new Float32Array(9), MI: new Float32Array(9), ice: new Float32Array(3),
  };
}

export function setup(params) {
  params.st = {
    t: 0, init: false, hue: 0, cold: 2, drain: 0.77, sw: 0.53,
    bs: [makeBubble(0), makeBubble(1), makeBubble(2)],
    F: new Float32Array(W * H * 3), hm: new Float32Array(9), mc: new Float32Array(9), pr: new Float32Array(W), cu: new Float32Array(W),
  };
}

// A bubble's place: the top one stays above row 49, the bottom one below row 79, and each
// fits against the others standing now, so the three never touch and always have room.
function place(st, b) {
  const [t, m, u] = st.bs;
  const alive = (o) => o !== b && o.stage <= CRACK;
  let lo, hi;
  if (b.i === 0) {
    lo = 1; hi = alive(m) ? min(49, m.y0 - m.R - 5.5) : 49;
  } else if (b.i === 1) {
    lo = alive(t) ? t.y0 + t.R + 5.5 : 29; hi = alive(u) ? u.y0 - u.R - 5.5 : 99;
  } else {
    lo = alive(m) ? max(79, m.y0 + m.R + 5.5) : 79; hi = 127;
  }
  const rmax = min(24.5, (hi - lo) / 2);
  b.R = rmax <= 13 ? rmax : 13 + (rmax - 13) * Math.random() ** 1.2;
  const slack = max(0, hi - lo - 2 * b.R);
  b.y = lo + b.R + slack * (0.5 + (Math.random() - 0.5) * 0.9);
  b.x = 32 + (Math.random() - 0.5) * 2 * max(0, 30.5 - b.R);
  b.x0 = b.x; b.y0 = b.y;
  b.ax = min(4, 0.85 * max(0, min(b.x - b.R - 1.5, 62.5 - b.x - b.R)));
}

function spawn(st, b) {
  place(st, b);
  b.ox = floor(b.x) - 32; b.oy = floor(b.y) - 32;
  for (let j = 0; j < 4; j++) { b.bp[j] = Math.random() * TAU; b.bw[j] = 0.3 + Math.random() * 0.5; }
  b.stage = GROW; b.t = 0; b.dur = 1.9 + Math.random() * 1.0;
  b.fa = 0; b.life = 0; b.tn = 0; b.rs = 1;
  for (let j = 0; j < 16; j++) b.o[j] = Math.random() * 60;
  b.rv = (Math.random() - 0.5) * 0.3; b.rot = Math.random() * TAU;
  b.hoff = (Math.random() - 0.5) * 0.3;
  b.hp[0] = Math.random() * TAU; b.hp[1] = Math.random() * TAU; b.hp[2] = Math.random() * TAU;
  b.gain = 0.74 + Math.random() * 0.52; b.fg = 0.8 + Math.random() * 0.4; b.kd = 0.75 + Math.random() * 0.6; b.sk = 0.6 + Math.random() * 0.8;
  b.wph = Math.random() * TAU; b.light = Math.random() * TAU; b.lw = (0.12 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1);
}

// ---- the freezing front --------------------------------------------------------------

function mark(b, x, y, t, c, a) {
  const ix = floor(x), iy = floor(y);
  if (ix < 0 || iy < 0 || ix >= S || iy >= S) return;
  const k = iy * S + ix;
  if (t < b.T[k]) b.T[k] = t;
  if (b.cls[k] === 0 || c + 1 < b.cls[k]) {
    b.cls[k] = c + 1; b.ang[k] = a; b.D[k] = 0;
  }
}

// One branch as a chain of marks 0.8 LED apart, each stamped with the time its tip passes.
// Arms throw barbs forward at about 60 degrees, a barb throws twigs, so it reads as a feather.
function branch(b, x, y, a, len, c, t0, bend) {
  const step = 0.8, tk = TIPK[c], cxL = b.x - b.ox, cyL = b.y - b.oy, lim = b.R + 2.5;
  let nextSide = 5 + Math.random() * 3;
  for (let s = 0; s < len; s += step) {
    if (hypot(x - cxL, y - cyL) > lim) break;
    mark(b, x, y, t0 + s / tk, c, a);
    if (c < 2 && s >= nextSide && len - s > 3.4) {
      const room = len - s;
      const sl = (c === 0 ? min(11, 0.55 * room + 2.5) : min(5.5, 0.55 * room + 1)) * (0.8 + 0.4 * Math.random());
      if (sl >= 3.6) {
        const ts = t0 + s / tk + 0.12;
        if (Math.random() < 0.85) branch(b, x, y, a + 0.85 + 0.3 * Math.random(), sl, c + 1, ts, -0.02 - 0.03 * Math.random());
        if (Math.random() < 0.85) branch(b, x, y, a - 0.85 - 0.3 * Math.random(), sl * (0.85 + 0.3 * Math.random()), c + 1, ts, 0.02 + 0.03 * Math.random());
      }
      nextSide += 8.5 + Math.random() * 2.5;
    }
    x += cos(a) * step; y += sin(a) * step; a += bend + (Math.random() - 0.5) * 0.04;
  }
}

function relax(F, C, A, k, n, c) {
  const v = F[n] + c;
  if (v < F[k]) {
    F[k] = v;
    if (C) { C[k] = C[n]; A[k] = A[n]; }
  }
}
// Two rounds of forward and backward chamfer passes: a distance with at most a few percent of error.
function sweep(F, C, A) {
  const d = 1.4142;
  for (let it = 0; it < 2; it++) {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const k = y * S + x;
        if (x > 0) relax(F, C, A, k, k - 1, 1);
        if (y > 0) {
          relax(F, C, A, k, k - S, 1);
          if (x > 0) relax(F, C, A, k, k - S - 1, d);
          if (x < S - 1) relax(F, C, A, k, k - S + 1, d);
        }
      }
    for (let y = S - 1; y >= 0; y--)
      for (let x = S - 1; x >= 0; x--) {
        const k = y * S + x;
        if (x < S - 1) relax(F, C, A, k, k + 1, 1);
        if (y < S - 1) {
          relax(F, C, A, k, k + S, 1);
          if (x < S - 1) relax(F, C, A, k, k + S + 1, d);
          if (x > 0) relax(F, C, A, k, k + S - 1, d);
        }
      }
  }
}

// T(x, y) is the front clock at which the frost reaches a pixel: the tip time of the nearest
// branch plus the distance to it, at one LED per unit, roughened by a noise factor.
function buildFreeze(b) {
  b.T.fill(1e9); b.D.fill(1e9); b.cls.fill(0);
  const cxL = b.x - b.ox, cyL = b.y - b.oy;
  const na = Math.random() * TAU, nr = b.R * (0.1 + 0.5 * Math.random());
  b.nx = cxL + cos(na) * nr; b.ny = cyL + sin(na) * nr;
  // Four or five arms at uneven angles and lengths, each bending a little, so it is a frond and not a snowflake.
  const nArm = 4 + floor(Math.random() * 2);
  let aa = Math.random() * TAU;
  for (let k = 0; k < nArm; k++) {
    aa += (TAU / nArm) * (0.6 + 0.8 * Math.random());
    branch(b, b.nx, b.ny, aa, (b.R + nr + 2) * (0.5 + 0.5 * Math.random()), 0, 0, (Math.random() - 0.5) * 0.08);
  }
  sweep(b.T, null, null);
  sweep(b.D, b.cls, b.ang);
  for (let k = 0; k < SS; k++) { b.ca[k] = cos(b.ang[k]); b.sa[k] = sin(b.ang[k]); }
  const sx = Math.random() * 40, sy = Math.random() * 40;
  let tm = 0;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = y * S + x;
      let tk = b.T[k] * (1 + 0.14 * n2(x * 0.2 + sx, y * 0.2 + sy));
      if (tk > 12) tk = 12 + (tk - 12) * 0.55;   // far from every branch the film freezes in a rush
      b.T[k] = tk;
      if (hypot(x + 0.5 - cxL, y + 0.5 - cyL) < b.R + 0.5 && b.T[k] > tm) tm = b.T[k];
    }
  b.tmax = tm;
}

function startNuc(b) {
  b.stage = NUC; b.t = 0; b.dur = 0.8 + 0.5 * Math.random();
  buildFreeze(b);
}

// The shell breaks along the edges between a few Voronoi cells, starting where the frost came last.
function startCrack(b) {
  b.stage = CRACK; b.t = 0; b.dur = 1.2 + 0.7 * Math.random();
  const R = b.R, cxL = b.x - b.ox, cyL = b.y - b.oy;
  const n = cl(round((PI * R * R) / 150), 5, 10);
  const sd = b.sh;
  let ns = 0;
  for (let tries = 0; tries < 500 && ns < n; tries++) {
    const a = Math.random() * TAU, r = sqrt(Math.random()) * R * 0.92;
    const x = cxL + cos(a) * r, y = cyL + sin(a) * r, sep = 9 * (1 - tries / 700);
    let ok = true;
    for (let j = 0; j < ns; j++) if (hypot(x - sd[j * 10], y - sd[j * 10 + 1]) < sep) ok = false;
    if (ok) { sd[ns * 10] = x; sd[ns * 10 + 1] = y; ns++; }
  }
  b.ns = ns;
  const cen = new Float32Array(ns * 3);
  b.id.fill(255);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const k = y * S + x;
      b.edge[k] = 9;
      const px = x + 0.5, py = y + 0.5;
      if (hypot(px - cxL, py - cyL) > R + 1) continue;
      let d1 = 1e9, d2 = 1e9, i1 = 0, i2 = 0;
      for (let j = 0; j < ns; j++) {
        const d = (px - sd[j * 10]) ** 2 + (py - sd[j * 10 + 1]) ** 2;
        if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = j; } else if (d < d2) { d2 = d; i2 = j; }
      }
      b.id[k] = i1;
      b.edge[k] = ns > 1 ? (d2 - d1) / (2 * hypot(sd[i1 * 10] - sd[i2 * 10], sd[i1 * 10 + 1] - sd[i2 * 10 + 1])) : 9;
      cen[i1 * 3] += px; cen[i1 * 3 + 1] += py; cen[i1 * 3 + 2]++;
    }
  // Where the crack starts: a late-frozen spot.
  b.c0x = cxL; b.c0y = cyL;
  for (let tries = 0; tries < 80; tries++) {
    const a = Math.random() * TAU, r = sqrt(Math.random()) * R * 0.85;
    const x = cxL + cos(a) * r, y = cyL + sin(a) * r, k = floor(y) * S + floor(x);
    if (b.T[k] > b.tmax * 0.8) { b.c0x = x; b.c0y = y; break; }
  }
  for (let j = 0; j < ns; j++) {
    const o = j * 10, c = max(1, cen[j * 3 + 2]);
    const gx = cen[j * 3] / c, gy = cen[j * 3 + 1] / c;
    sd[o + 2] = gx; sd[o + 3] = gy;
    let rad = 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (b.id[y * S + x] === j) rad = max(rad, hypot(x + 0.5 - gx, y + 0.5 - gy));
    sd[o + 4] = rad + 1.5;
    const dx = gx - b.c0x, dy = gy - b.c0y;
    sd[o + 5] = dx * 0.14 + (Math.random() - 0.5) * 3;          // sideways speed
    sd[o + 6] = -2.5 * Math.random() + dy * 0.05;               // first kick, up is negative
    sd[o + 7] = (Math.random() - 0.5) * 2.6;                    // turn rate
    sd[o + 8] = 0.03 + Math.random() * 0.3 + 0.012 * hypot(dx, dy); // when this piece lets go
    sd[o + 9] = Math.random() * TAU;
  }
}

// ---- the bubble's own clock ----------------------------------------------------------

const floatLen = () => 7 + 13 * Math.random() ** 1.2;

// A frozen shell holds until the others are here to be looked at: none is falling or waiting
// for its next bubble, and one of them is floating, seeding or frozen.
function mayBreak(st, b) {
  let ready = 0;
  for (const o of st.bs) {
    if (o === b) continue;
    if (o.stage === FALL || o.stage === GAP) return false;
    if ((o.stage === FLOAT && o.fa > 0.8) || (o.stage >= NUC && o.stage <= STAND)) ready++;
  }
  return ready > 0;
}

function step(st, b, d) {
  b.t += d; b.rot += d * b.rv;
  // Floating bubbles drift a little; a seeded one stays where its crystal is.
  if (b.stage <= FLOAT) {
    const t = st.t;
    b.x = b.x0 + b.ax * (0.65 * sin(b.bw[0] * t + b.bp[0]) + 0.35 * sin(b.bw[1] * t * 1.7 + b.bp[1]));
    b.y = b.y0 + 2 * (0.65 * sin(b.bw[2] * t + b.bp[2]) + 0.35 * sin(b.bw[3] * t * 1.3 + b.bp[3]));
    b.rs = 1 + 0.05 * sin(0.23 * t + b.bp[1] * 2) + 0.025 * sin(0.61 * t + b.bp[0]);
  }
  b.tn += d * (b.stage === GROW ? 1 + 4 * (1 - b.t / b.dur) : 1);
  switch (b.stage) {
    case GROW:
      if (b.t >= b.dur) { b.stage = FLOAT; b.t = 0; b.dur = floatLen(); }
      break;
    case FLOAT:
      b.fa += d; b.life = min(1, b.fa / 26);
      b.t += d * (st.cold ** 0.6 - 1);       // the float clock runs faster in the cold
      if (b.t >= b.dur) startNuc(b);
      break;
    case NUC:
      if (b.t >= b.dur) { b.stage = FRONT; b.t = 0; b.sf = 0; }
      break;
    case FRONT:
      b.sf += d * VF * st.cold;
      if (b.sf >= b.tmax + 2.6) { b.stage = STAND; b.t = 0; b.dur = 2 + 2.6 * Math.random(); }
      break;
    case STAND:
      if (b.t >= b.dur && mayBreak(st, b)) startCrack(b);
      break;
    case CRACK:
      if (b.t >= b.dur) { b.stage = FALL; b.t = 0; b.dur = 2.2 + 0.5 * Math.random(); }
      break;
    case FALL:
      if (b.t >= b.dur) { b.stage = GAP; b.t = 0; b.dur = 0.4 + 1.2 * Math.random(); }
      break;
    default:
      if (b.t >= b.dur) spawn(st, b);
  }
}

function initState(st) {
  st.init = true;
  for (const i of [1, 0, 2]) spawn(st, st.bs[i]);
  // One bubble seeding, one floating, one swelling, so the first frame already has all three.
  let a = 0;
  for (let i = 1; i < 3; i++) if (st.bs[i].R > st.bs[a].R) a = i;
  const b2 = (a + 1 + floor(Math.random() * 2)) % 3, c2 = 3 - a - b2;
  const A = st.bs[a], B = st.bs[b2], C = st.bs[c2];
  A.stage = FLOAT; A.fa = 6; A.life = 0.66;
  startNuc(A);
  A.t = 0.4 * A.dur;
  B.stage = FLOAT; B.t = 0; B.dur = 10 + 8 * Math.random(); B.fa = 3.2; B.life = 0.35;
  C.t = C.dur * 0.45; C.tn = C.t;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = input.knobValues || [0, 2, 0, 0.06];
  st.hue = kv[0];
  st.cold = cl(kv[1], 0.3, 3);
  st.drain = 0.3 * (2 / 0.3) ** ((cl(kv[2], -1, 1) + 1) / 2);
  st.sw = 0.5 + 0.5 * cl(kv[3], -1, 1);
  if (!st.init) initState(st);
  const d = cl(dt || 0, 0, 0.1);
  if (d <= 0) return;
  st.t += d;
  for (const b of st.bs) step(st, b, d);
  // Some bubble is always freezing: when none is, the one that has floated longest seeds.
  let active = 0, cand = null;
  for (const b of st.bs) {
    if (b.stage >= NUC && b.stage <= STAND) active++;
    else if (b.stage === FLOAT && b.fa > 0.8 && (!cand || b.fa > cand.fa)) cand = b;
  }
  if (!active && cand) cand.dur = cand.t;
}

// ---- drawing -------------------------------------------------------------------------

function renderShell(st, b) {
  const buf = b.buf, R = b.R, T = b.T, D = b.D, CA = b.ca, SA = b.sa, C = b.cls;
  buf.fill(0);
  const stage = b.stage;
  let rad = R * b.rs;
  if (stage === GROW) {
    const p = b.t / b.dur;
    rad = 1.6 + (rad - 1.6) * (1 - (1 - p) ** 2.6) * (1 + 0.045 * sin(PI * p));
  }
  const fz = stage >= STAND ? 1 : stage === FRONT ? sstep(0, b.tmax, b.sf) : 0;
  const wob = 0.03 * (1 - fz) * min(1, rad / R), wt = st.t * 1.6 + b.wph;
  const rx = rad * (1 + wob * sin(wt) + 0.4 * wob * sin(wt * 0.43 + 2)), ry = rad * (1 - wob * sin(wt) + 0.4 * wob * sin(wt * 0.57 + 1));
  const sf = stage >= STAND ? 1e3 : stage === FRONT ? b.sf : -1e3;
  const tt = st.t;

  // The film's colour turn, this bubble's offset wandering slowly about the Hue knob.
  const ha = TAU * (st.hue + b.hoff + 0.1 * (2 - st.cold) + 0.04 * sin(0.11 * tt + b.hp[0]) + 0.025 * sin(0.047 * tt + b.hp[1]));
  const M = b.M, IM = b.MI, ice = b.ice;
  hueMat(ha, M);
  // The frost leans toward the film's hue and comes back to blue-white at a full turn.
  hueMat(0.5 * sin(ha), IM);
  ice[0] = max(0.2, 0.72 * IM[0] + 0.88 * IM[1] + IM[2]);
  ice[1] = max(0.2, 0.72 * IM[3] + 0.88 * IM[4] + IM[5]);
  ice[2] = max(0.2, 0.72 * IM[6] + 0.88 * IM[7] + IM[8]);

  const sw = min(1, st.sw * b.sk + (stage === GROW ? 0.4 * (1 - b.t / b.dur) : 0));
  const drain = st.drain * b.kd * (1 + 0.07 * sin(0.21 * tt + b.hp[2]) + 0.3 * b.life);
  const cap = 0.1 + 0.34 * sstep(0, 1, b.life);
  const cs = cos(b.rot), sn = sin(b.rot), o = b.o, tn = b.tn;
  const breath = 1 + 0.2 * sin(0.37 * tt + b.hp[0]) + 0.06 * sin(0.9 * tt + b.hp[1]);
  const bandDrift = 0.03 * sin(0.27 * tt + b.hp[1]) + 0.07 * sin(0.061 * tt + b.hp[0] * 3);
  const crk = stage === CRACK ? b.t / b.dur : -1;
  const crackR = crk < 0 ? 0 : (2.4 * R * crk) / 0.85;
  const flash = stage === CRACK ? max(0, 1 - b.t * 5) * 0.25 : 0;
  const lp = 0.8 * tt + 2 * b.light, c2 = cos(lp), s2 = sin(lp);
  // A light that circles each bubble at its own pace and brightens the side it is on.
  const lg = b.lw * tt + b.light, lc = 0.3 * cos(lg), ls = 0.3 * sin(lg);
  const stand = stage >= STAND ? 1 + 0.07 * sin(1.1 * tt + b.hp[2]) : 1;

  const x0 = max(b.ox, floor(b.x - rad - 2), 0), x1 = min(W - 1, ceil(b.x + rad + 2), b.ox + S - 1);
  const y0 = max(b.oy, floor(b.y - rad - 2), 0), y1 = min(H - 1, ceil(b.y + rad + 2), b.oy + S - 1);
  const c35 = 0.939, s35 = 0.343;
  const nucx = b.ox + b.nx, nucy = b.oy + b.ny;
  const nucT = stage === NUC ? b.t / b.dur : 0;

  let pr = st.pr, cu = st.cu;
  pr.fill(-1);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - b.y) / ry;
    let last = -1;
    cu.fill(-1);
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - b.x) / rx;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1.3) { last = -1; continue; }
      const rho = sqrt(r2);
      const cover = cl((1 - rho) * rad + 0.5, 0, 1);
      if (cover <= 0) { last = -1; continue; }
      const rc2 = r2 > 0.9985 ? 0.9985 : r2;
      const nz = sqrt(1 - rc2), ct = sqrt(1 - rc2 * 0.5653);
      // Eddies: a warped 3D noise on the sphere, turning slowly about the vertical.
      const px = (dx * cs + nz * sn) * 1.7, py = dy * 1.7, pz = (-dx * sn + nz * cs) * 1.7;
      const w0 = n3(px + o[0] + tn * 0.11, py + o[1] - tn * 0.09, pz + o[2] + tn * 0.07);
      const w1 = n3(px + o[3] - tn * 0.08, py + o[4] + tn * 0.1, pz + o[5] + tn * 0.06);
      const s1 = n3(px * 1.35 + 2.1 * w0 + o[6], py * 1.35 + 2.1 * w1 + o[7] - tn * 0.12, pz * 1.35 + 1.5 * (w0 - w1) + o[8] + tn * 0.05);
      // Thickness: it grows down the bubble, the black cap grows down from the top as the film thins.
      const hh = (dy + 1) * 0.5 + bandDrift + 0.06 * w1 + sw * 0.45 * (0.8 * s1 + 0.35 * w0);
      let xr = (hh - cap) / (1 - cap);
      xr = xr < 0 ? 0 : xr > 1.2 ? 1.2 : xr;
      const dr = xr * sqrt(sqrt(xr));
      let thick = 14 + 540 * drain * dr + (60 * w1 + sw * (45 * s1 * (0.35 + dr) + 300 * w0)) * dr;
      if (thick < 8) thick = 8;
      const tn2 = 1.33 * thick * ct;
      // Bands narrower than about 2 LED would be a tangle of 1 LED lines, so they fade to a pearl grey.
      let gr = last < 0 ? 0 : abs(tn2 - last);
      const up = pr[x];
      if (up >= 0 && abs(tn2 - up) > gr) gr = abs(tn2 - up);
      cu[x] = tn2; last = tn2;
      let li = tn2 * LS;
      if (li > NL - 1.01) li = NL - 1.01;
      const i0 = floor(li), f = li - i0, q = i0 * 3;
      let fr0 = LUT[q] + (LUT[q + 3] - LUT[q]) * f, fg0 = LUT[q + 1] + (LUT[q + 4] - LUT[q + 1]) * f, fb0 = LUT[q + 2] + (LUT[q + 5] - LUT[q + 2]) * f;
      const wash = sstep(75, 140, gr), mean = (fr0 + fg0 + fb0) / 3, base = mean + (0.5 - mean) * wash, ps = PALE * (1 - wash);
      fr0 = base + (fr0 - mean) * ps; fg0 = base + (fg0 - mean) * ps; fb0 = base + (fb0 - mean) * ps;
      // The thinnest silver is a little blue.
      const cold = 1 - sstep(90, 190, tn2);
      fr0 *= 1 - 0.3 * cold; fg0 *= 1 - 0.1 * cold;
      let r = M[0] * fr0 + M[1] * fg0 + M[2] * fb0, g = M[3] * fr0 + M[4] * fg0 + M[5] * fb0, bl = M[6] * fr0 + M[7] * fg0 + M[8] * fb0;
      // Fresnel: a dark middle and a bright rim.
      const fres = 1 - nz, side = 1 + dx * lc + dy * ls, gain = (0.66 + 0.45 * fres * sqrt(fres)) * b.gain * breath * side;
      r = (r < 0 ? 0 : r) * gain; g = (g < 0 ? 0 : g) * gain; bl = (bl < 0 ? 0 : bl) * gain;
      // A dim warm colour reads brown on the panel, so the film's dark reds get blue and go mauve.
      bl += 0.6 * (r > bl ? r - bl : 0) * (1 - sstep(0.4, 0.8, r));
      r += 0.05; g += 0.06; bl += 0.1;
      const thaw = 1 - 0.5 * fz;
      // Blue sky in the top of the sphere and a soft window of light up on the left.
      const sky = 0.09 * sstep(0.1, -0.85, dy) * thaw;
      // A thin pale rim, so a black film still has an outline.
      const rim = 0.17 * sstep(0.8, 0.97, rho) * thaw;
      r += sky * 0.3 + rim * 0.5; g += sky * 0.55 + rim * 0.75; bl += sky + rim;
      const u = dx + 0.38, w = dy + 0.42;
      if (u < 0.45 && u > -0.45 && w < 0.35 && w > -0.35) {
        const xr2 = u * c35 - w * s35, yr2 = u * s35 + w * c35;
        const qq = (abs(xr2) / 0.25) ** 3 + (abs(yr2) / 0.15) ** 3;
        const hl = (1 - sstep(0.45, 1, qq)) * 0.62 * thaw;
        r += hl * 0.8; g += hl * 0.92; bl += hl;
      }
      const li2 = (y - b.oy) * S + (x - b.ox);
      if (stage >= NUC) {
        const k = li2, sfd = sf - T[k];
        if (sfd > -4) {
          const fr = sstep(0, 2.2, sfd);
          const e = (sfd - 0.7) / 1.5, eg = exp(-e * e);
          const hw = RIDGE_HW[C[k]], ridge = hw > 0 ? 1 - sstep(hw * 0.55, hw * 1.25, D[k]) : 0;
          let spark = 0, fib = 0;
          if (fr > 0.02) {
            // Fibres run along the branch nearest, and glints are 3 LED lumps whose brightness
            // follows how that branch faces a light turning slowly round.
            const ca = CA[k], sa = SA[k];
            fib = n2((x * ca + y * sa) * 0.16 + o[12], (y * ca - x * sa) * 0.5 + o[13]);
            const nn = n3(x * 0.3 + o[9], y * 0.3 + o[10], tt * 0.45 + o[11]);
            const glint = 0.5 + 0.5 * ((ca * ca - sa * sa) * c2 + 2 * ca * sa * s2);
            spark = sstep(0.12, 0.5, nn) * (0.3 + 0.7 * glint * glint);
          }
          const rimIce = 0.3 * fres * fres;
          const lvl = (fr * (0.12 + 0.14 * fib + 0.5 * ridge + 0.38 * spark + rimIce) + 0.6 * eg * (0.5 + 0.5 * ridge)) * stand * b.fg * (1 + 1.5 * (dx * lc + dy * ls));
          const keep = 1 - 0.78 * fr;
          r = r * keep + ice[0] * lvl; g = g * keep + ice[1] * lvl; bl = bl * keep + ice[2] * lvl;
        }
      }
      if (stage === NUC) {
        // The seed: a 3 LED glint that swells and pulses.
        const dd = hypot(x + 0.5 - nucx, y + 0.5 - nucy), sg = 1.3 + 1.6 * sstep(0, 1, nucT);
        const gl = exp(-(dd * dd) / (2 * sg * sg)) * (0.75 + 0.25 * sin(tt * 14));
        r += gl * 0.7; g += gl * 0.9; bl += gl;
      }
      if (crk >= 0 && b.id[li2] !== 255) {
        const e = b.edge[li2];
        if (e < 1.3) {
          const dc = hypot(x + 0.5 - b.ox - b.c0x, y + 0.5 - b.oy - b.c0y);
          const cr = (1 - sstep(0.5, 1.2, e)) * sstep(0, 1.6, crackR - dc);
          r = r * (1 - cr) + 0.86 * cr; g = g * (1 - cr) + 0.95 * cr; bl = bl * (1 - cr) + cr;
        }
      }
      const k4 = li2 * 4;
      buf[k4] = min(1, r + flash); buf[k4 + 1] = min(1, g + flash); buf[k4 + 2] = min(1, bl + flash); buf[k4 + 3] = cover;
    }
    const sw2 = pr; pr = cu; cu = sw2;
  }
}

function haloOf(st, b, F) {
  let a = 1, rad = b.R;
  if (b.stage === GROW) { const p = b.t / b.dur; rad = 1.6 + (b.R - 1.6) * (1 - (1 - p) ** 2.6); a = sstep(0, 0.5, p); }
  else if (b.stage === FALL) a = 1 - sstep(0, 1.3, b.t);
  else if (b.stage === GAP) return;
  if (a <= 0.01 || rad < 2) return;
  const fz = b.stage >= STAND ? 1 : b.stage === FRONT ? sstep(0, b.tmax, b.sf) : 0;
  const ha = TAU * (st.hue + b.hoff);
  hueMat(ha, b.M);
  const M = b.M;
  const cr = 0.55 * M[0] + 0.3 * M[1] + 0.75 * M[2], cg = 0.55 * M[3] + 0.3 * M[4] + 0.75 * M[5], cb = 0.55 * M[6] + 0.3 * M[7] + 0.75 * M[8];
  const hr = 0.28 + (max(0, cr) - 0.28) * (1 - fz), hg = 0.5 + (max(0, cg) - 0.5) * (1 - fz), hb = 0.75 + (max(0, cb) - 0.75) * (1 - fz);
  const reach = rad + 9, x0 = max(0, floor(b.x - reach)), x1 = min(W - 1, ceil(b.x + reach));
  const y0 = max(0, floor(b.y - reach)), y1 = min(H - 1, ceil(b.y + reach));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dd = hypot(x + 0.5 - b.x, y + 0.5 - b.y) - rad;
      if (dd > 9) continue;
      const v = 0.13 * exp(-max(0, dd) / 3.4) * a;
      const o = (y * W + x) * 3;
      F[o] += v * hr; F[o + 1] += v * hg; F[o + 2] += v * hb;
    }
}

function composite(b, F) {
  const buf = b.buf;
  for (let ly = 0; ly < S; ly++) {
    const y = ly + b.oy;
    if (y < 0 || y >= H) continue;
    for (let lx = 0; lx < S; lx++) {
      const k = (ly * S + lx) * 4, a = buf[k + 3];
      if (a <= 0) continue;
      const x = lx + b.ox;
      if (x < 0 || x >= W) continue;
      const o = (y * W + x) * 3;
      F[o] = F[o] * (1 - a) + buf[k] * a;
      F[o + 1] = F[o + 1] * (1 - a) + buf[k + 1] * a;
      F[o + 2] = F[o + 2] * (1 - a) + buf[k + 2] * a;
    }
  }
}

// The pieces fall and turn, each from the shell as it last stood; a piece is found by walking
// each destination pixel back to the shell, so a turned piece has no holes.
function pieces(b, F) {
  const buf = b.buf, sd = b.sh;
  for (let j = 0; j < b.ns; j++) {
    const o = j * 10, tt = max(0, b.t - sd[o + 8]);
    const gx = sd[o + 2], gy = sd[o + 3], rad = sd[o + 4];
    const th = sd[o + 7] * tt, c = cos(th), s = sin(th);
    const dx = sd[o + 5] * tt, dy = sd[o + 6] * tt + 0.5 * GRAV * tt * tt;
    const sc = 1 - 0.3 * sstep(0.8, 2, tt), al = (1 - sstep(0.5, 1.8, tt)) * (0.92 + 0.08 * sin(tt * 9 + sd[o + 9]));
    if (al <= 0.01) continue;
    const mx = b.ox + gx + dx, my = b.oy + gy + dy, rr = rad * sc + 1.5;
    const x0 = max(0, floor(mx - rr)), x1 = min(W - 1, ceil(mx + rr)), y0 = max(0, floor(my - rr)), y1 = min(H - 1, ceil(my + rr));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const vx = (x + 0.5 - mx) / sc, vy = (y + 0.5 - my) / sc;
        const lx = floor(gx + vx * c + vy * s), ly = floor(gy - vx * s + vy * c);
        if (lx < 0 || ly < 0 || lx >= S || ly >= S) continue;
        const li = ly * S + lx;
        if (b.id[li] !== j) continue;
        const k = li * 4, a = buf[k + 3] * al;
        if (a <= 0) continue;
        const p = (y * W + x) * 3;
        F[p] = F[p] * (1 - a) + buf[k] * a;
        F[p + 1] = F[p + 1] * (1 - a) + buf[k + 1] * a;
        F[p + 2] = F[p + 2] * (1 - a) + buf[k + 2] * a;
      }
  }
}

export function draw(display, params) {
  const st = params.st, F = st.F, tt = st.t;
  if (!st.init) initState(st);
  // The night: a cold mist whose colour wanders between blue, violet and teal; the Hue knob leans it
  // toward cyan and magenta without taking it round to red.
  const M = st.hm, mc = st.mc;
  hueMat(0.5 * sin(TAU * st.hue), M);
  for (let j = 0; j < 3; j++) {
    const r = MIST[j * 3], g = MIST[j * 3 + 1], b2 = MIST[j * 3 + 2];
    mc[j * 3] = max(0, M[0] * r + M[1] * g + M[2] * b2);
    mc[j * 3 + 1] = max(0, M[3] * r + M[4] * g + M[5] * b2);
    mc[j * 3 + 2] = max(0, M[6] * r + M[7] * g + M[8] * b2);
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const a = n2(0.055 * (x + 1.1 * tt), 0.05 * (y - 1.4 * tt) + 7) + 0.4 * n2(0.11 * (x - 1.7 * tt) + 3, 0.1 * (y + 0.9 * tt));
      let v = 0.5 + 0.6 * a;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      v = 0.07 + 0.42 * v * v;
      const m = 0.5 + 0.7 * n2(0.07 * (x - 0.8 * tt) + 40, 0.06 * (y + 0.6 * tt) + 11), q = 0.5 + 0.7 * n2(0.06 * (x + 0.7 * tt) + 90, 0.07 * (y - 0.5 * tt) + 21);
      const m1 = m < 0 ? 0 : m > 1 ? 1 : m, q1 = q < 0 ? 0 : q > 1 ? 1 : q;
      const w1 = (1 - m1) * (1 - q1), w2 = m1, w3 = q1 * (1 - m1);
      F[o] = 0.006 + v * (w1 * mc[0] + w2 * mc[3] + w3 * mc[6]);
      F[o + 1] = 0.01 + v * (w1 * mc[1] + w2 * mc[4] + w3 * mc[7]);
      F[o + 2] = 0.024 + v * (w1 * mc[2] + w2 * mc[5] + w3 * mc[8]);
    }
  for (const b of st.bs) haloOf(st, b, F);
  for (const b of st.bs) {
    if (b.stage <= CRACK) {
      renderShell(st, b);
      composite(b, F);
    }
  }
  for (const b of st.bs) if (b.stage === FALL) pieces(b, F);
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, round(min(1, F[o]) * 255), round(min(1, F[o + 1]) * 255), round(min(1, F[o + 2]) * 255));
}
