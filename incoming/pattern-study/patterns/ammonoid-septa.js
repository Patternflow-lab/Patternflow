// ===== Patternflow pattern =====
// Title:   Ammonoid Septa
// Family:  ammonoids
// Idea:    A polished section through the coil of an ammonoid shell, glowing amber, that keeps growing: pearly walls spiral inward, thin dark septa fold into goniatitic zigzags, toothed ceratitic lobes or frilled ammonitic leaf edges and cut the whorl into honey and agate-banded spar chambers with a golden siphuncle running through them, a new septum is sealed at the open end every few seconds while the whole shell recedes and shrinks into the matrix.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the chambered, coiled shell of the ammonoids, planispiral with a log-spiral whorl and a body chamber at the open end, that adds a septum behind itself as it grows (Devonian to the end of the Cretaceous), the three grades of suture line, goniatitic, ceratitic and ammonitic, and the way the folding of the suture grows over the life of one animal (textbook palaeontology, from memory), the siphuncle, a tube of tissue through every septum, and spar crystals that grow in from the chamber walls after death; pattern round 259
// Round:   259
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0..4, Frill=-1..1, Coil=-1..1
//
// Knob 1: Hue.
// Knob 2: Growth.
// Knob 3: Frill.
// Knob 4: Coil.

const W = 64, H = 128, NPX = W * H;
const TAU = 6.283185307179586;
const { floor, sqrt, abs, exp, sin, cos, log, pow, PI, min, max, atan2, tanh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the camera: the open end stays where it is, and the shell slides along its own spiral
// centre of the coil, radius of the outer wall at the open end (LEDs), screen angle of the open end (y down), 1 if the shell grows clockwise
const SHELLS = [
  { cx: 40, cy: 60, rap: 90, ap: 2.09, sg: 1, seed: 0, speed: 1 },
];
const BODY = 1.6; // the body chamber is this many chambers long

// ---- the shell
const N0 = 15 / TAU; // chambers a radian, on average
const FILL_RATE = 2.1; // LEDs of spar a chamber lays down a chamber of age

const WAYS = [
  { ramp: [[0, 150, 70, 10], [0.2, 206, 108, 22], [0.45, 236, 152, 38], [0.7, 250, 192, 84], [0.9, 255, 222, 140], [1, 255, 236, 172]], cav: [88, 36, 8], pearl: [222, 206, 184], mat: [46, 36, 29], sep: [40, 16, 6], gold: [206, 150, 44] },
  { ramp: [[0, 168, 92, 14], [0.2, 224, 140, 30], [0.45, 248, 184, 52], [0.7, 255, 214, 100], [0.9, 255, 234, 150], [1, 255, 244, 184]], cav: [96, 52, 10], pearl: [226, 212, 188], mat: [46, 38, 28], sep: [44, 24, 8], gold: [214, 164, 56] },
  { ramp: [[0, 120, 36, 56], [0.2, 176, 70, 92], [0.45, 216, 110, 124], [0.7, 240, 158, 160], [0.9, 252, 202, 196], [1, 255, 226, 214]], cav: [70, 22, 38], pearl: [228, 208, 206], mat: [44, 32, 34], sep: [36, 12, 22], gold: [236, 182, 80] },
  { ramp: [[0, 84, 74, 12], [0.2, 134, 118, 22], [0.45, 180, 164, 44], [0.7, 218, 204, 96], [0.9, 236, 228, 150], [1, 246, 240, 186]], cav: [50, 46, 10], pearl: [214, 210, 188], mat: [38, 38, 28], sep: [24, 22, 6], gold: [222, 200, 70] },
  { ramp: [[0, 44, 60, 92], [0.2, 76, 104, 144], [0.45, 118, 148, 186], [0.7, 168, 194, 224], [0.9, 214, 228, 244], [1, 238, 245, 253]], cav: [22, 30, 52], pearl: [206, 214, 228], mat: [34, 38, 46], sep: [14, 18, 30], gold: [214, 186, 100] },
];
const desat = (c, k) => {
  const y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return [y + (c[0] - y) * k, y + (c[1] - y) * k, y + (c[2] - y) * k];
};
const NZX = 128, NZY = 64; // a tile of value noise for the crystal texture, wrapped in both ways
const NH = 100, NT = 64;
for (const w of WAYS) {
  w.ramp = w.ramp.map((r) => [r[0], ...desat([r[1], r[2], r[3]], 0.84)]);
  w.cav = desat(w.cav, 0.9);
  w.gold = desat(w.gold, 0.8);
} // hue positions round the five ways, and steps of depth in the colour table

const ih = (n, s) => {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(s | 0, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

function wayColor(pos, key, out) {
  const p = (pos - floor(pos)) * WAYS.length, i0 = floor(p) % WAYS.length, i1 = (i0 + 1) % WAYS.length, t = p - floor(p);
  const a = WAYS[i0][key], b = WAYS[i1][key];
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

function rampAt(w, t) {
  const r = w.ramp;
  let k = 0;
  while (k < r.length - 2 && t > r[k + 1][0]) k++;
  const a = r[k], b = r[k + 1], u = cl((t - a[0]) / (b[0] - a[0]), 0, 1), s = u * u * (3 - 2 * u);
  return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s];
}

// fold shapes across the whorl, f from 0 at the outer wall to 1 at the inner one
const N1 = 3.4, P1 = 0.9, M1 = 5.7, Q1 = 2.0, K1S = 1.8, K1B = 0.25; // broad lobes and saddles: one slow wave, and a second that takes over as the folding grows
const N2 = 11, P2 = 0.3; // teeth at the bottom of the lobes
const N3 = 9, P3 = 1.0; // frills on the saddles
const N4 = 22, P4 = 0.6; // the finest frill

function vnoise(x, y, seed) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = ih(ix * 7919 + iy * 104729, seed), b = ih((ix + 1) * 7919 + iy * 104729, seed);
  const c = ih(ix * 7919 + (iy + 1) * 104729, seed), d = ih((ix + 1) * 7919 + (iy + 1) * 104729, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function makeShell(def) {
  const A = {
    def, alpha: 0, bAt: -1, n: 0, idx: new Int32Array(NPX),
    lnr: new Float32Array(NPX), psi0: new Float32Array(NPX), rr: new Float32Array(NPX),
    th: new Float32Array(NPX), fA: new Float32Array(NPX), dOut: new Float32Array(NPX), dIn: new Float32Array(NPX),
    hw: new Float32Array(NPX), hh: new Float32Array(NPX), rWall: new Float32Array(NPX),
    s0: new Float32Array(NPX), s0d: new Float32Array(NPX), s1: new Float32Array(NPX), s1d: new Float32Array(NPX), s5: new Float32Array(NPX), s5d: new Float32Array(NPX),
    s2: new Float32Array(NPX), s2d: new Float32Array(NPX), s3: new Float32Array(NPX), s3d: new Float32Array(NPX),
    s4: new Float32Array(NPX), s4d: new Float32Array(NPX),
    ckey: new Int32Array(128).fill(-99999), cb: new Float32Array(128 * 6),
  };
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - def.cx, dy = y + 0.5 - def.cy, r = max(0.6, sqrt(dx * dx + dy * dy));
      if (r > def.rap * 1.02) continue;
      A.idx[n] = y * W + x;
      A.rr[n] = r;
      A.lnr[n] = log(r / def.rap);
      let a = def.sg * (atan2(dy, dx) - def.ap);
      a -= TAU * floor(a / TAU);
      A.psi0[n] = a;
      n++;
    }
  }
  A.n = n;
  const rm = def.rap * 0.72;
  A.mouth = [def.cx + rm * cos(def.ap), def.cy + rm * sin(def.ap)];
  return A;
}

function makeState() {
  const S = {
    ready: false, kn: [0, 2, 0, 0.06], clk: 0,
    shells: SHELLS.map(makeShell),
    mt: new Float32Array(NPX), cr: new Float32Array(NPX), cg: new Float32Array(NPX), cbl: new Float32Array(NPX), own: new Uint8Array(NPX),
    lut: new Float32Array(NH * NT * 3), amp: new Float32Array(64 * 6), nz: new Float32Array(NZX * NZY),
    tmp: [0, 0, 0], col: new Float32Array(3),
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // the rock: a mottle 10 LEDs across, a grain 2.5 across, and a few paler clasts
      const m1 = vnoise(x / 11, y / 11, 3), m2 = vnoise(x / 2.6, y / 2.6, 5), m3 = vnoise(x / 5, y / 5, 9);
      let t = 0.78 + 0.34 * (m1 - 0.5) + 0.3 * (m2 - 0.5);
      if (m3 > 0.82) t += (m3 - 0.82) * 2.4;
      S.mt[y * W + x] = t;
    }
  }
  // paler clasts of broken shell and a few round ossicles lying in the rock
  const clast = (cx, cy, rad, a0, a1, wd, k) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
        let an = atan2(dy, dx) - a0;
        an -= TAU * floor(an / TAU);
        if (an > a1 - a0) continue;
        const e = cl(wd * 0.5 + 0.5 - abs(d - rad), 0, 1);
        if (e > 0) S.mt[y * W + x] += k * e;
      }
    }
  };
  clast(14, 110, 12, 3.3, 1.5, 2.4, 0.9);
  clast(46, 118, 9, 0.2, 2.0, 2.2, 0.8);
  clast(52, 104, 6, 4.0, 2.6, 2.2, 0.7);
  clast(24, 122, 5, 0.0, 6.3, 2.2, 0.5);
  // the colour table: for each position round the five ways and each depth into a chamber
  for (let h = 0; h < NH; h++) {
    const p = (h / NH) * WAYS.length, i0 = floor(p) % WAYS.length, i1 = (i0 + 1) % WAYS.length, u = p - floor(p);
    for (let k = 0; k < NT; k++) {
      const t = k / (NT - 1), a = rampAt(WAYS[i0], t), b = rampAt(WAYS[i1], t), o = (h * NT + k) * 3;
      S.lut[o] = a[0] + (b[0] - a[0]) * u;
      S.lut[o + 1] = a[1] + (b[1] - a[1]) * u;
      S.lut[o + 2] = a[2] + (b[2] - a[2]) * u;
    }
  }
  // value noise at two scales, wrapped
  for (let y = 0; y < NZY; y++) {
    for (let x = 0; x < NZX; x++) {
      const wv = (gx, gy, per, seed) => {
        const ix = floor(gx), iy = floor(gy), fx = gx - ix, fy = gy - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const h = (a, b) => ih(((a % per[0]) + per[0]) % per[0] * 977 + (((b % per[1]) + per[1]) % per[1]) * 131071, seed);
        const v00 = h(ix, iy), v10 = h(ix + 1, iy), v01 = h(ix, iy + 1), v11 = h(ix + 1, iy + 1);
        return v00 + (v10 - v00) * sx + (v01 - v00) * sy + (v00 - v10 - v01 + v11) * sx * sy;
      };
      S.nz[y * NZX + x] = 0.55 * wv(x / 8, y / 8, [16, 8], 21) + 0.45 * wv((x * 51) / 128, (y * 26) / 64, [51, 26], 22);
    }
  }
  // fold amplitudes, in chambers, for a complexity c in 0..1 stepped in 64
  for (let k = 0; k < 64; k++) {
    const c = k / 63;
    S.amp[k * 6] = 0.1; // the bow of the whole septum, a nautiloid curve
    S.amp[k * 6 + 1] = 0.03 + 0.1 * sm(0, 0.6, c); // broad lobes and saddles
    S.amp[k * 6 + 2] = 0.08 * sm(0.3, 0.7, c); // teeth in the lobes
    S.amp[k * 6 + 3] = 0.085 * sm(0.55, 1, c); // frills on the saddles
    S.amp[k * 6 + 4] = 0.045 * sm(0.75, 1, c); // the finest frill
    S.amp[k * 6 + 5] = sm(0.25, 0.9, c); // how much of the second wave is in the lobes
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// Everything that depends on the shape of the spiral and not on how far the shell has grown: it is rebuilt when Coil moves.
function rebuild(A, b) {
  const ib = 1 / b, e2 = TAU * b;
  for (let i = 0; i < A.n; i++) {
    const r = A.rr[i], lam = A.lnr[i] * ib;
    const u = (A.psi0[i] - lam) / TAU, f = u - floor(u), th = lam + TAU * f;
    A.th[i] = th;
    A.fA[i] = f;
    const ra = exp(e2 * f), rb = exp(-e2 * (1 - f)), rw = r * ra;
    A.dOut[i] = r * (ra - 1);
    A.dIn[i] = r * (1 - rb);
    A.rWall[i] = rw;
    A.hh[i] = rw * (1 - exp(-e2));
    A.hw[i] = cl(0.016 * rw + 0.55, 1, 1.5);
    A.s0[i] = -sin(PI * f);
    A.s0d[i] = -PI * cos(PI * f);
    const a1 = TAU * N1 * f + P1, b1 = TAU * M1 * f + Q1, ca = cos(a1), cb2 = cos(b1);
    const tA = tanh(K1S * (ca + 0.15 * cb2 + K1B)), tB = tanh(K1S * (ca + 0.7 * cb2 + K1B));
    A.s1[i] = tA;
    A.s1d[i] = -K1S * (1 - tA * tA) * (sin(a1) * TAU * N1 + 0.15 * sin(b1) * TAU * M1);
    A.s5[i] = tB;
    A.s5d[i] = -K1S * (1 - tB * tB) * (sin(a1) * TAU * N1 + 0.7 * sin(b1) * TAU * M1);
    const th1 = 0.5 * (tA + tB), lob = sm(-0.35, -0.8, th1), sad = sm(0.35, 0.85, th1);
    const g2 = PI * N2 * f + P2, sg2 = sin(g2);
    A.s2[i] = lob * (abs(sg2) - 1);
    A.s2d[i] = lob * PI * N2 * cos(g2) * (sg2 < 0 ? -1 : 1);
    const g3 = PI * N3 * f + P3, sg3 = sin(g3);
    A.s3[i] = sad * (1 - abs(sg3));
    A.s3d[i] = -sad * PI * N3 * cos(g3) * (sg3 < 0 ? -1 : 1);
    const g4 = PI * N4 * f + P4, sg4 = sin(g4);
    A.s4[i] = abs(sg4) - 0.64;
    A.s4d[i] = PI * N4 * cos(g4) * (sg4 < 0 ? -1 : 1);
  }
  A.bAt = b;
}

const cOf = (th) => N0 * th + 0.9 * sin(0.31 * th + 0.7) + 0.6 * sin(0.127 * th + 2.1);
const cpOf = (th) => N0 + 0.279 * cos(0.31 * th + 0.7) + 0.0762 * cos(0.127 * th + 2.1);

function params4(kn) {
  const k1 = cl(kn[0], 0, 1);
  const g = cl(kn[1], 0, 4);
  const fr = cl(kn[2], -1, 1);
  const co = cl(kn[3], -1, 1);
  const lnW = log(1.25) + (log(2.8) - log(1.25)) * pow((co + 1) / 2, 1.4);
  return { hue: k1, kappa: 0.07 * pow(10, g / 4), c0: (fr + 1) / 2, b: lnW / TAU };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  const P = params4(kn);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < S.shells.length; k++) S.shells[k].alpha = (7 + 1.7 * k) * TAU;
  }
  S.clk += d;
  for (let k = 0; k < S.shells.length; k++) {
    const A = S.shells[k];
    A.alpha += (P.kappa * A.def.speed * d) / cpOf(A.alpha);
    if (abs(P.b - A.bAt) > 1e-5) rebuild(A, P.b);
  }
}

// Shade pixel j of a shell into S.col, which holds the rock under it, and return 0 if it lies outside the shell, 1 inside the phragmocone or the walls, 2 in the body chamber.
function shade(S, A, j, P, pal, cform) {
  const thS = A.th[j];
  const col = S.col;
  if (thS > 0) return 0;
  const r = A.rr[j], al = A.alpha;
  const Th = al + thS;
  const p1 = 0.31 * Th + 0.7, p2 = 0.127 * Th + 2.1;
  const Cth = N0 * Th + 0.9 * sin(p1) + 0.6 * sin(p2);
  const Cp = N0 + 0.279 * cos(p1) + 0.0762 * cos(p2);
  const lloc = r / Cp, hh = A.hh[j];
  const res = min(sm(4, 7.5, lloc), sm(3, 6.5, hh));
  if (res <= 0) {
    const dk = 0.55 + 0.45 * sm(0, 16, r), wk = max(cl(A.hw[j] + 0.5 - A.dOut[j], 0, 1), cl(A.hw[j] + 0.5 - A.dIn[j], 0, 1)) * 0.3 * sm(2.5, 5.5, hh);
    col[0] = pal.tone[0] * dk + (pal.pearl[0] * 0.8 - pal.tone[0] * dk) * wk;
    col[1] = pal.tone[1] * dk + (pal.pearl[1] * 0.8 - pal.tone[1] * dk) * wk;
    col[2] = pal.tone[2] * dk + (pal.pearl[2] * 0.8 - pal.tone[2] * dk) * wk;
    return 1;
  }
  const e2 = TAU * P.b, amp = S.amp, cb = A.cb, ck = A.ckey, lut = S.lut;
  const cd = 0.17 * sin(0.37 * Th + 1.3) + 0.11 * sin(0.21 * Th + 4) - 0.3 * exp(-Th / 17);
  const ai = ((cl(P.c0 + cd, 0, 1) * 63) | 0) * 6, wb = amp[ai + 5];
  const dC = amp[ai] * A.s0[j] + amp[ai + 1] * (A.s1[j] + (A.s5[j] - A.s1[j]) * wb) + amp[ai + 2] * A.s2[j] + amp[ai + 3] * A.s3[j] + amp[ai + 4] * A.s4[j];
  const dD = amp[ai] * A.s0d[j] + amp[ai + 1] * (A.s1d[j] + (A.s5d[j] - A.s1d[j]) * wb) + amp[ai + 2] * A.s2d[j] + amp[ai + 3] * A.s3d[j] + amp[ai + 4] * A.s4d[j];
  const Ce = Cth - dC, kk = floor(Ce), q = Ce - kk;
  const gR = dD / e2, gT = Cp - dD / TAU;
  const ratio = cl(Cp / sqrt(gR * gR + gT * gT), 0.3, 1);
  const bSep = min(q, 1 - q) * lloc, dPerp = bSep * ratio;
  const hw = A.hw[j], dOut = A.dOut[j], dIn = A.dIn[j];
  const ci2 = kk & 127, o = ci2 * 6, sd = A.def.seed * 17;
  if (ck[ci2] !== kk) {
    ck[ci2] = kk;
    cb[o] = (ih(kk, 1 + sd) - 0.5) * 0.16; // hue shift
    cb[o + 1] = 0.82 + 0.3 * ih(kk, 2 + sd); // brightness
    cb[o + 2] = 5 + 3 * ih(kk, 3 + sd); // band width
    cb[o + 3] = ih(kk, 4 + sd); // band phase
    cb[o + 4] = ih(kk, 5 + sd) < 0.18 ? 3 : 60; // fill to depth: a few chambers keep a vug
    cb[o + 5] = ih(kk, 6 + sd);
  }
  const age = cform - (kk + 1);
  const sealed = sm(0, 0.7, age);
  const dwall = min(dOut, dIn) - hw;
  const dd = min(bSep - 1, dwall);
  // the crystal texture: noise that lives in the shell, so it slides and shrinks with it
  const nx = Th * 17.5, ny = A.fA[j] * 9, ix = floor(nx), iy = floor(ny), fx = nx - ix, fy = ny - iy;
  const z0 = ((iy & 63) * NZX) + (ix & 127), z1 = ((iy & 63) * NZX) + ((ix + 1) & 127), z2 = (((iy + 1) & 63) * NZX) + (ix & 127), z3 = (((iy + 1) & 63) * NZX) + ((ix + 1) & 127);
  const nzv = S.nz[z0] * (1 - fx) * (1 - fy) + S.nz[z1] * fx * (1 - fy) + S.nz[z2] * (1 - fx) * fy + S.nz[z3] * fx * fy;
  const du = max(dd + (nzv - 0.5) * 5, 0), saw = du / cb[o + 2] + cb[o + 3];
  const tt = 1 - exp(-du / (4.5 + 3 * cb[o + 5])), ring = (saw - floor(saw) - 0.5) * 0.3;
  const tb = cl(tt + ring * (1 - 0.5 * tt), 0, 0.999) * (NT - 1), t0i = tb | 0, tf = tb - t0i, t1i = min(t0i + 1, NT - 1);
  let hp = (P.hue + cb[o]) % 1;
  if (hp < 0) hp += 1;
  const hi = ((hp * NH) | 0) % NH, la = (hi * NT + t0i) * 3, lb = (hi * NT + t1i) * 3;
  const bri = cb[o + 1] * (1 + (nzv - 0.5) * 0.18);
  let fr = (lut[la] + (lut[lb] - lut[la]) * tf) * bri, fg = (lut[la + 1] + (lut[lb + 1] - lut[la + 1]) * tf) * bri, fb = (lut[la + 2] + (lut[lb + 2] - lut[la + 2]) * tf) * bri;
  const fillD = min(cb[o + 4], max(0, age - 0.2) * FILL_RATE);
  const cav = sm(fillD - 0.7, fillD + 0.7, dd);
  fr += (pal.cav[0] - fr) * cav; fg += (pal.cav[1] - fg) * cav; fb += (pal.cav[2] - fb) * cav;
  // the spar has a pale fringe where the crystals started from the wall
  const dr = max(dd, 0), rim = exp(-(dr * dr) / 1.7) * 0.28;
  fr += (pal.pearl[0] * 0.9 - fr) * rim; fg += (pal.pearl[1] * 0.85 - fg) * rim; fb += (pal.pearl[2] * 0.75 - fb) * rim;
  let R = col[0], G = col[1], B = col[2];
  R += (fr - R) * sealed; G += (fg - G) * sealed; B += (fb - B) * sealed;
  // the septum, dark and 2 LEDs wide
  const kn1 = q > 0.5 ? kk + 1 : kk;
  const sf = sm(0, 0.7, cform - kn1);
  const sc = cl(1.5 - dPerp, 0, 1) * sf;
  R += (pal.sep[0] - R) * sc; G += (pal.sep[1] - G) * sc; B += (pal.sep[2] - B) * sc;
  // the siphuncle: a gold tube with a dark outline, swelling into a collar at every septum
  const th2 = cl(0.05 * A.rWall[j], 1, 1.6), sipC = hw + 1.6 + th2;
  const neck = 1 + 0.4 * exp(-(dPerp * dPerp) / 4.8);
  const dsip = abs(dOut - sipC), tw = th2 * neck;
  const sipOut = cl(tw + 1.4 - dsip, 0, 1) * sealed;
  if (sipOut > 0) {
    R += (pal.sep[0] * 1.4 - R) * sipOut; G += (pal.sep[1] * 1.4 - G) * sipOut; B += (pal.sep[2] * 1.4 - B) * sipOut;
    const sipIn = cl(tw + 0.4 - dsip, 0, 1) * sealed;
    if (sipIn > 0) {
      const tt2 = dsip / tw, sdn = (dOut - sipC) / tw, shade2 = 0.66 + 0.3 * (1 - tt2 * tt2) + 0.2 * exp(-((sdn + 0.4) * (sdn + 0.4)) / 0.1);
      R += (pal.gold[0] * shade2 - R) * sipIn; G += (pal.gold[1] * shade2 - G) * sipIn; B += (pal.gold[2] * shade2 - B) * sipIn;
    }
  }
  // the walls: pearl, with a sheen that slides round and a thin-film tint
  const wc = max(cl(hw + 0.5 - dOut, 0, 1), cl(hw + 0.5 - dIn, 0, 1));
  if (wc > 0) {
    const ps = A.psi0[j], sheen = 0.5 + 0.5 * cos(2 * (ps - P.light)), ia = 2.2 * ps - 0.2 * S.clk;
    const k = (0.7 + 0.3 * sheen) * (1 + 0.35 * exp(thS / 0.6));
    const pr = pal.pearl[0] * k + 16 * sheen * cos(ia), pg = pal.pearl[1] * k + 16 * sheen * cos(ia + 2.1), pb = pal.pearl[2] * k + 16 * sheen * cos(ia + 4.2);
    R += (pr - R) * wc; G += (pg - G) * wc; B += (pb - B) * wc;
  }
  if (res < 1) {
    R += (pal.tone[0] - R) * (1 - res); G += (pal.tone[1] - G) * (1 - res); B += (pal.tone[2] - B) * (1 - res);
  }
  col[0] = R; col[1] = G; col[2] = B;
  return age > 0 ? 1 : 2;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const P = params4(S.kn);
  const pal = { mat: [0, 0, 0], cav: [0, 0, 0], pearl: [0, 0, 0], sep: [0, 0, 0], gold: [0, 0, 0], tone: [0, 0, 0], glow: [0, 0, 0] };
  wayColor(P.hue, "mat", pal.mat);
  wayColor(P.hue, "cav", pal.cav);
  wayColor(P.hue, "pearl", pal.pearl);
  wayColor(P.hue, "sep", pal.sep);
  wayColor(P.hue, "gold", pal.gold);
  for (let c = 0; c < 3; c++) {
    pal.tone[c] = pal.cav[c] * 1.35;
    pal.glow[c] = pal.cav[c] * 0.9;
  }
  const { cr, cg, cbl, own, mt, col } = S;
  P.light = 0.13 * S.clk + 0.6 * sin(0.05 * S.clk);
  // the rock, lit a little by the animal at each open end
  for (let i = 0; i < NPX; i++) {
    const x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
    let g = 0;
    for (let k = 0; k < S.shells.length; k++) {
      const m = S.shells[k].mouth, dx = x - m[0], dy = y - m[1];
      g += exp(-(dx * dx + dy * dy) / 380);
    }
    cr[i] = pal.mat[0] * mt[i] + pal.glow[0] * g; cg[i] = pal.mat[1] * mt[i] + pal.glow[1] * g; cbl[i] = pal.mat[2] * mt[i] + pal.glow[2] * g;
    own[i] = 0;
  }
  for (let k = 0; k < S.shells.length; k++) {
    const A = S.shells[k], cform = cOf(A.alpha) - BODY;
    for (let j = 0; j < A.n; j++) {
      const i = A.idx[j];
      if (own[i]) continue;
      col[0] = cr[i]; col[1] = cg[i]; col[2] = cbl[i];
      const v = shade(S, A, j, P, pal, cform);
      if (v) {
        cr[i] = col[0]; cg[i] = col[1]; cbl[i] = col[2];
        own[i] = k + 1;
      }
    }
  }
  const gp = 40 + 50 * sin(0.043 * S.clk + 0.8) + 20 * sin(0.011 * S.clk);
  for (let i = 0; i < NPX; i++) {
    const x = i % W, y = (i / W) | 0, u = (x * 0.55 + y * 0.83 - gp) / 16, g = 1 + (own[i] ? 0.1 : 0.03) * exp(-u * u);
    display.setPixel(x, y, cl(cr[i] * g, 0, 255) | 0, cl(cg[i] * g, 0, 255) | 0, cl(cbl[i] * g, 0, 255) | 0);
  }
}
