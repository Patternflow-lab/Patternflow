// ===== Patternflow pattern =====
// Title:   Block Diagram
// Family:  erosion
// Idea:    A geologist's block of layered rock floats on the dark panel in strict 2:1 isometric, its top a pale plateau that rivers cut into canyons, mesas and buttes while a dark caprock holds up the cliffs, and the bands of bed colour on the two cut faces and on the canyon walls line up bed for bed, creep down the block and tilt left or right with the dip.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the block diagram of structural geology (W. M. Davis's cut-away landscapes, 1890s; Erwin Raisz's landform drawings, 1930s); the stream-power law of river incision (Howard and Kerby, 1983) solved implicitly in order of height with D8 routing and priority-flood depression filling (Braun and Willett, 2013; Barnes, Lehman and Mulla, 2014); erodibility that changes bed by bed and the caprock cliffs it holds up (G. K. Gilbert, Henry Mountains, 1877). All from memory.
// Round:   268
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rain=0.5..4, Caprock=-1..1, Dip=-1..1
//
// Knob 1: Hue. Turns every colour once round the wheel with its luma kept, rock, plateau, water and haze together; 0 and 1 are the natural earth palette (rust sandstone, cream limestone, grey-green shale, ochre siltstone, dark brown caprock, pale sand plateau, teal river).
// Knob 2: Rain. The tempo of the whole land and the strength of its rivers: 0.5 at the minimum, 2 where it opens, 4 at the top. The land is lifted at 0.225, 0.45 and 0.64 LED a second at those three and the beds sink down the faces a third faster, at 0.3, 0.6 and 0.85 LED a second, one LED in 3.3, 1.7 and 1.2 s. K scales with Rain to the power 0.8, so the canyons cut and the walls fall back faster the more it rains. A column is river from a drainage area of 4 columns at 0.5, 3 at 2 and 1.6 at 4. Rain also swells and shrinks by 36 percent on clocks of 97 and 151 s of its own.
// Knob 3: Caprock. Hard against soft, -1 soft rock all alike, 0 where it opens, 1 hard caprock over soft beds. The erodibility of a bed is exp(-3.6 c h) with c = (Caprock+1)/2 and h its hardness (shale 0, siltstone 0.25, sandstone 0.55, limestone 0.72, caprock 1), so caprock is 6 times harder than shale at 0, 37 times at 1, and equal to it at -1. The same knob pulls the bed colours toward one grey-brown, to 40 percent of their contrast at -1, so at the bottom the block is a dissected pile of hills and at the top an intact plateau on sharply banded faces.
// Knob 4: Dip. Tilt of the beds. They rise 0.1 + 0.9 Dip LED for every sixteenth of the block's width along one face and 0.04 - 0.8 Dip along the other, so at 0.06 they are tilted a few degrees, at 1 the lines lie flat on the left face and run steep on the right, and at -1 the other way round. It acts on the stratigraphy, so the bands on the faces and on the canyon walls follow it within a second or so; the land follows over tens of seconds.
//
// What the picture is. A block of 12 by 12 columns drawn back to front, each column with a flat top and a mid and a dark side, heights in steps of 3 LED, the two front faces cut 50 to 80 rows deep. The strata are 4 to 10 LED thick and are read from absolute rock height, so a wall in a canyon shows the same bed as the cut face does at that height; two slow folds keep the beds from being ruled lines. The plateau is planed off at one height and drawn pale; below it each column is the colour of the bed it stands on. Rivers are teal columns along the lowest drainage and spread across the valley floor where the drainage is big. Over 900 s at the start knobs the plateau covers between 3 and 66 percent of the 144 columns in five runs, 47 percent at the median opening of forty, and it grows back after a canyon has eaten it.
// What is modelled. Heights on a 22 by 22 grid: the 12 by 12 block, four columns of land behind it and six in front of the faces for the rivers to leave over, the front rim held at base level. D8 flow to the lowest neighbour after priority-flood filling, drainage area summed from the top, incision E = K A^0.8 S solved implicitly in order of height (it cannot overshoot or fall into a checkerboard), hillslope diffusion that is weaker on hard rock, steady uplift, a plateau planed off at 36, and a rock strength on every column that fades between two random fields on a 143 s clock. K comes from the bed under the column at its height, and the beds move through the land, so the hard layers pass through it and the cliffs they hold move with them. The first update runs 260 model seconds at the knobs it is given.
// What is made up. Every rate and exponent above; the planation at one height; the canyons cut in before the run; the base level that rises and falls by up to 5 LED on clocks of 83 and 137 s; the five bed types and their sequence (a long random one that grows both ways, so it never repeats; a caprock lies on a soft bed and not within three beds of another); the folds; the haze; the glints on the river. The beds creep down the faces, a third faster than the land is lifted, so that the picture keeps moving. Real uplift carries rock up through a land that holds its height; the sign is `S.off += down` in step() and `S.offv` in update(). I flipped it once, so that they rise, and the opening frame of the same seed came out grey and tan with a small canyon, because the random bed sequence is read in the other direction; it is a matter of which stretch of beds comes first, not of the picture being worse.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, abs, min, max, PI, pow } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

const N = 12; // columns a side of the block that is drawn
const OFS = 4; // columns of land behind the block
const AP = 6; // columns of land in front of the faces, where the rivers leave
const ND = OFS + N + AP;
const NN = ND * ND;
const AX = 32 / N; // screen columns for one step of u - v: strict 2:1, so a step of u + v is AX / 2 rows
const HY = AX / 2;
const SC = 16 / N; // dip and folds are given per 16 columns, whatever N is
const X0 = 32, Y0 = 42; // where the back corner of the block stands on the panel at height 0
const ZBOT = -44; // the foot of the cut faces
const QZ = 3; // heights are drawn in steps of this many LED
const ZB = 0; // base level
const U_BASE = 0.45; // uplift at Rain 2, LED per second
const V_BASE = 0.6; // the speed the beds sink down the faces at Rain 2, LED per second
const K_BASE = 0.05; // incision constant at Rain 2 and soft rock
const M_EXP = 0.8; // area exponent of the stream power
const DIFF = 0.04; // hillslope diffusion, cells squared per second
const PRE = 260; // model seconds run before the first frame

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

// bed types: sandstone, limestone, shale, siltstone, caprock
const HARD = [0.55, 0.72, 0, 0.25, 1];
const BASE = [
  [196, 98, 62],
  [234, 218, 176],
  [112, 142, 120],
  [214, 164, 74],
  [124, 84, 62],
];
const MID = [170, 134, 104];
const PLAT = [204, 198, 168]; // the plateau, soil and dry grass
const ZC = 36; // the height the land is planed off at: the plateau
const WATER = [34, 152, 160];
const HAZE = [30, 40, 70], BGD = [5, 7, 15];

// chroma turned about the grey axis with luma kept; a colour that leaves the gamut gives up chroma first
function rot(c, ca, sa) {
  const r = c[0], g = c[1], b = c[2];
  const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
  const I2 = I * ca - Q * sa, Q2 = I * sa + Q * ca;
  const d0 = 0.956 * I2 + 0.621 * Q2, d1 = -0.272 * I2 - 0.647 * Q2, d2 = -1.106 * I2 + 1.703 * Q2;
  let k = 1;
  for (const d of [d0, d1, d2]) {
    if (Y + d > 255) k = min(k, (255 - Y) / d);
    else if (Y + d < 0) k = min(k, Y / -d);
  }
  return [Y + k * d0, Y + k * d1, Y + k * d2];
}

export function setup(params) {
  // two fixed fields of rock strength that the weather's clock fades between, so the weak places wander
  const nA = new Float32Array(NN), nB = new Float32Array(NN);
  for (const nf of [nA, nB]) {
    const g = new Float32Array(36);
    for (let i = 0; i < 36; i++) g[i] = rnd() * 2 - 1;
    for (let j = 0; j < ND; j++)
      for (let i = 0; i < ND; i++) {
        const fx = (i * 5) / (ND - 1), fy = (j * 5) / (ND - 1);
        const x0 = min(4, floor(fx)), y0 = min(4, floor(fy));
        const tx = fx - x0, ty = fy - y0;
        const a = g[y0 * 6 + x0] + (g[y0 * 6 + x0 + 1] - g[y0 * 6 + x0]) * tx;
        const b = g[(y0 + 1) * 6 + x0] + (g[(y0 + 1) * 6 + x0 + 1] - g[(y0 + 1) * 6 + x0]) * tx;
        nf[j * ND + i] = 0.65 * (a + (b - a) * ty) + 0.35 * (rnd() * 2 - 1);
      }
  }
  const h = new Float32Array(NN);
  for (let j = 0; j < ND; j++)
    for (let i = 0; i < ND; i++) {
      const rim = min(ND - 1 - i, ND - 1 - j);
      h[j * ND + i] = min(ZC, ZB + 3.5 * rim + (rnd() - 0.5) * 3);
    }
  // canyons already cut in from the rim, two to a face, so that the first frame has valleys to grow side canyons from
  for (let f = 0; f < 2; f++) {
    const n = f === 0 && rnd() < 0.5 ? 3 : 2;
    for (let m = 0; m < n; m++) {
      const pos = cl(floor(OFS + N * ((m + 0.5) / n) + (rnd() - 0.5) * 2.4), OFS + 1, ND - 2);
      let ci = f === 0 ? ND - 1 : pos, cj = f === 0 ? pos : ND - 1;
      const len = 12 + floor(rnd() * 6);
      for (let k = 0; k < len; k++) {
        const c = cj * ND + ci;
        const fl = ZB + 2 + 1.1 * k;
        if (h[c] > fl) h[c] = fl;
        const r = rnd();
        if (f === 0) {
          ci--;
          cj += r < 0.3 ? -1 : r > 0.7 ? 1 : 0;
        } else {
          cj--;
          ci += r < 0.3 ? -1 : r > 0.7 ? 1 : 0;
        }
        ci = cl(ci, OFS - 2, ND - 1);
        cj = cl(cj, OFS - 2, ND - 1);
      }
    }
  }
  const S = {
    ready: false,
    ks: [0, 2, 0, 0.06],
    h,
    hf: new Float32Array(NN),
    rc: new Int16Array(NN),
    rd: new Float32Array(NN),
    ord: new Int16Array(NN),
    A: new Float32Array(NN),
    K: new Float32Array(NN),
    D: new Float32Array(NN),
    dh: new Float32Array(NN),
    heap: new Int16Array(NN),
    closed: new Uint8Array(NN),
    nA, nB,
    zd: new Float32Array(NN),
    top: new Float32Array(NN * 3),
    wet: new Uint8Array(NN),
    wet2: new Uint8Array(NN),
    bz: [0],
    bt: [],
    off: 0, // rock elevation of height 0; it grows as the beds sink
    offv: 0,
    t: 0,
    acc: 0,
    f1: 1.1, f2: 2.3, da: 0.13, db: 0.01,
    pal: new Float32Array(5 * 9),
    water: new Float32Array(9),
    plat: new Float32Array(3),
    bg: new Uint8ClampedArray(W * H * 3),
    hueKey: -1, conKey: -9,
    img: new Uint8ClampedArray(W * H * 3),
  };
  for (let c = 0; c < NN; c++) S.zd[c] = QZ * Math.round(h[c] / QZ);
  ensure(S, -160, 160);
  params.s = S;
}

// the long random sequence of beds, grown both ways on demand: bz[k] is the foot of bed k and bz[k+1] its top
function pick(S, below, above, side) {
  const bt = S.bt;
  let t = 2;
  for (let tries = 0; tries < 40; tries++) {
    const r = rnd();
    t = r < 0.23 ? 0 : r < 0.37 ? 1 : r < 0.62 ? 2 : r < 0.86 ? 3 : 4;
    if (t === below || t === above) continue;
    if (t === 4) {
      if (below >= 0 && below !== 2 && below !== 3) continue;
      let near = false;
      for (let k = 0; k < 3; k++) {
        const q = side > 0 ? bt.length - 1 - k : k;
        if (q >= 0 && q < bt.length && bt[q] === 4) near = true;
      }
      if (near) continue;
    }
    if (above === 4 && t !== 2 && t !== 3) continue;
    break;
  }
  return t;
}
function ensure(S, lo, hi) {
  const bz = S.bz, bt = S.bt;
  while (bz[bz.length - 1] < hi) {
    const t = pick(S, bt.length ? bt[bt.length - 1] : -1, -1, 1);
    bt.push(t);
    bz.push(bz[bz.length - 1] + (t === 4 ? 4 + rnd() * 3 : 4 + rnd() * 6));
  }
  while (bz[0] > lo) {
    const t = pick(S, -1, bt.length ? bt[0] : -1, -1);
    bt.unshift(t);
    bz.unshift(bz[0] - (t === 4 ? 4 + rnd() * 3 : 4 + rnd() * 6));
  }
}
function bedAt(S, z) {
  let bz = S.bz;
  if (z >= bz[bz.length - 1] - 1 || z <= bz[0] + 1) {
    ensure(S, z - 60, z + 60);
    bz = S.bz;
  }
  let lo = 0, hi = bz.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bz[mid] > z) hi = mid;
    else lo = mid + 1;
  }
  return lo > 0 ? lo - 1 : 0;
}
// how far the beds are lifted or dropped at a place: the tilt, then two slow folds; u and v in columns from the back corner of the block
function warp(S, u, v) {
  const x = u * SC, y = v * SC;
  return S.da * x + S.db * y + 1.5 * sin(0.37 * x + 0.14 * y + S.f1) + 1.1 * sin(-0.21 * x + 0.43 * y + S.f2);
}

// priority flood from the rim: the order out of the heap is the order of the filled height, the cell that finds a neighbour is its receiver
function route(S) {
  const h = S.h, hf = S.hf, rc = S.rc, ord = S.ord, A = S.A, closed = S.closed, hp = S.heap, rd = S.rd;
  let hn = 0;
  closed.fill(0);
  const push = (c) => {
    let k = hn++;
    const key = hf[c];
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hf[hp[p]] <= key) break;
      hp[k] = hp[p];
      k = p;
    }
    hp[k] = c;
  };
  const pop = () => {
    const top = hp[0];
    const c = hp[--hn];
    const key = hf[c];
    let k = 0;
    for (;;) {
      let l = 2 * k + 1;
      if (l >= hn) break;
      if (l + 1 < hn && hf[hp[l + 1]] < hf[hp[l]]) l++;
      if (hf[hp[l]] >= key) break;
      hp[k] = hp[l];
      k = l;
    }
    hp[k] = c;
    return top;
  };
  for (let j = 0; j < ND; j++)
    for (let i = 0; i < ND; i++)
      if (i === ND - 1 || j === ND - 1) {
        const c = j * ND + i;
        closed[c] = 1;
        hf[c] = h[c];
        rc[c] = -1;
        push(c);
      }
  let n = 0;
  while (hn > 0) {
    const c = pop();
    ord[n++] = c;
    const ci = c % ND, cj = (c / ND) | 0;
    for (let k = 0; k < 8; k++) {
      const ni = ci + DX[k], nj = cj + DY[k];
      if (ni < 0 || nj < 0 || ni >= ND || nj >= ND) continue;
      const nb = nj * ND + ni;
      if (closed[nb]) continue;
      closed[nb] = 1;
      hf[nb] = max(h[nb], hf[c] + 0.002);
      rc[nb] = c;
      rd[nb] = k < 4 ? 1 : 1.4142;
      push(nb);
    }
  }
  A.fill(1);
  for (let k = n - 1; k >= 0; k--) {
    const c = ord[k], r = rc[c];
    if (r >= 0) A[r] += A[c];
  }
}

// rain, with the weather's clocks on it; Rain also sets the tempo of the whole land, the rate the land is lifted and the beds sink
const weather = (t) => 0.8 + 0.2 * sin((TWO_PI * t) / 97 + 0.7) + 0.16 * sin((TWO_PI * t) / 151 + 2.2);
const rainNow = (S) => cl(S.ks[1], 0.5, 4) * 0.5 * weather(S.t);
const tempo = (S) => U_BASE * sqrt(cl(S.ks[1], 0.5, 4) * 0.5);
const sink = (S) => V_BASE * sqrt(cl(S.ks[1], 0.5, 4) * 0.5);

function step(S, dt) {
  route(S);
  const h = S.h, A = S.A, K = S.K, D = S.D, dh = S.dh, ord = S.ord, rc = S.rc, rd = S.rd, nA = S.nA, nB = S.nB;
  const con = (S.ks[2] + 1) * 0.5;
  const kt = [0, 0, 0, 0, 0];
  for (let t = 0; t < 5; t++) kt[t] = exp(-con * 3.6 * HARD[t]);
  const km = K_BASE * pow(rainNow(S), 0.8);
  const off = S.off;
  const pa = (TWO_PI * S.t) / 143, ca = cos(pa), sa = sin(pa);
  const base = ZB + 3 * sin((TWO_PI * S.t) / 83 + 0.4) + 2 * sin((TWO_PI * S.t) / 137 + 2.9);
  for (let j = 0; j < ND; j++) {
    h[j * ND + ND - 1] = base;
    h[(ND - 1) * ND + j] = base;
  }
  S.f1 = 1.1 + 0.011 * S.t;
  S.f2 = 2.3 - 0.007 * S.t;
  for (let j = 0; j < ND; j++)
    for (let i = 0; i < ND; i++) {
      const c = j * ND + i;
      const z = h[c] + off - warp(S, i - OFS + 0.5, j - OFS + 0.5);
      const kk = kt[S.bt[bedAt(S, z)]] * exp(0.8 * (nA[c] * ca + nB[c] * sa));
      K[c] = km * kk;
      D[c] = DIFF * (0.4 + 0.6 * min(1, kk));
    }
  const up = dt * tempo(S);
  for (let j = 0; j < ND - 1; j++)
    for (let i = 0; i < ND - 1; i++) h[j * ND + i] += up;
  dh.fill(0);
  for (let j = 0; j < ND; j++)
    for (let i = 0; i < ND; i++) {
      const c = j * ND + i;
      if (i + 1 < ND) {
        const f = 0.5 * (D[c] + D[c + 1]) * (h[c + 1] - h[c]) * dt;
        dh[c] += f;
        dh[c + 1] -= f;
      }
      if (j + 1 < ND) {
        const f = 0.5 * (D[c] + D[c + ND]) * (h[c + ND] - h[c]) * dt;
        dh[c] += f;
        dh[c + ND] -= f;
      }
    }
  for (let j = 0; j < ND - 1; j++)
    for (let i = 0; i < ND - 1; i++) h[j * ND + i] += dh[j * ND + i];
  for (let k = 0; k < NN; k++) {
    const c = ord[k], r = rc[c];
    if (r < 0) continue;
    const F = (dt * K[c] * pow(A[c], M_EXP)) / rd[c];
    const v = (h[c] + F * h[r]) / (1 + F);
    h[c] = v < ZB - 9 ? ZB - 9 : v;
  }
  // the plateau is planed off at one height
  for (let j = 0; j < ND - 1; j++)
    for (let i = 0; i < ND - 1; i++) if (h[j * ND + i] > ZC) h[j * ND + i] = ZC;
  S.t += dt;
  S.off += dt * sink(S);
}

function dipOf(S) {
  S.da = 0.1 + 0.9 * S.ks[3];
  S.db = 0.04 - 0.8 * S.ks[3];
}

// palette and haze, rebuilt when Hue or Caprock move
function palette(S) {
  const hue = S.ks[0], con = (S.ks[2] + 1) * 0.5;
  const q = 0.4 + 0.6 * con;
  const ang = hue * TWO_PI, ca = cos(ang), sa = sin(ang);
  const put = (arr, o, c) => {
    arr[o] = c[0];
    arr[o + 1] = c[1];
    arr[o + 2] = c[2];
    arr[o + 3] = c[0] * 0.78;
    arr[o + 4] = c[1] * 0.78;
    arr[o + 5] = c[2] * 0.8 + 3;
    arr[o + 6] = c[0] * 0.56;
    arr[o + 7] = c[1] * 0.57;
    arr[o + 8] = c[2] * 0.62 + 6;
  };
  for (let t = 0; t < 5; t++) {
    const b = BASE[t];
    const m = [MID[0] + (b[0] - MID[0]) * q, MID[1] + (b[1] - MID[1]) * q, MID[2] + (b[2] - MID[2]) * q];
    put(S.pal, t * 9, rot(m, ca, sa));
  }
  put(S.water, 0, rot(WATER, ca, sa));
  const pc = rot(PLAT, ca, sa);
  for (let ch = 0; ch < 3; ch++) S.plat[ch] = pc[ch];
  const hz = rot(HAZE, ca, sa), bg = rot(BGD, ca, sa);
  const bgi = S.bg;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const rx = (x - 32) / 38, ry = (y - 72) / 62;
      const gl = exp(-(rx * rx + ry * ry) * 1.6);
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) bgi[o + c] = bg[c] + (hz[c] - bg[c]) * gl;
    }
  S.hueKey = hue;
  S.conKey = con;
}

function prerun(S) {
  const r = cl(S.ks[1], 0.5, 4) * 0.5;
  const n = Math.round(PRE / sqrt(max(r, 0.4)));
  dipOf(S);
  for (let k = 0; k < n; k++) step(S, 1);
  palette(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    prerun(S);
    S.ready = true;
  }
  const e = 1 - exp(-d / 0.15);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  dipOf(S);
  if (abs(S.ks[0] - S.hueKey) > 0.0004 || abs((S.ks[2] + 1) * 0.5 - S.conKey) > 0.0004) palette(S);
  // the land moves in half-second steps, the beds between them
  S.acc += d;
  let n = 0;
  while (S.acc >= 0.5 && n++ < 6) {
    S.acc -= 0.5;
    step(S, 0.5);
  }
  S.offv = S.off + sink(S) * S.acc;
  S.f1 = 1.1 + 0.011 * (S.t + S.acc);
  S.f2 = 2.3 - 0.007 * (S.t + S.acc);
  render(S);
}

function render(S) {
  const img = S.img, zd = S.zd, h = S.h, pal = S.pal, top = S.top, wet = S.wet, wet2 = S.wet2, A = S.A, hf = S.hf;
  img.set(S.bg);
  // heights drawn in steps of QZ, with a little hysteresis so that a column does not flicker between two
  for (let c = 0; c < NN; c++) {
    let z = zd[c];
    const hh = h[c];
    while (hh > z + 0.5 * QZ + 0.6) z += QZ;
    while (hh < z - 0.5 * QZ - 0.6) z -= QZ;
    zd[c] = z;
  }
  const off = S.offv;
  const ac = 4 - 2.4 * cl((rainNow(S) * 2 - 0.5) / 3.5, 0, 1);
  const tm = S.t + S.acc;
  // water: the drainage above a threshold, a pond where the flood fill stands above the ground, and the valley floor beside the big reaches
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const c = (j + OFS) * ND + i + OFS;
      wet[c] = zd[c] <= ZC - QZ && (A[c] >= ac || hf[c] - h[c] > 3) ? 1 : 0;
      wet2[c] = wet[c];
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const c = (j + OFS) * ND + i + OFS;
      if (!wet[c] || A[c] < 4 * ac) continue;
      for (let k = 0; k < 4; k++) {
        const nb = c + DX[k] + DY[k] * ND;
        if (!wet[nb] && zd[nb] <= zd[c]) wet2[nb] = 1;
      }
    }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const c = (j + OFS) * ND + i + OFS;
      const z = zd[c];
      const o = c * 3;
      const t = S.bt[bedAt(S, z + off - warp(S, i + 0.5, j + 0.5))];
      if (z >= ZC - 0.1) {
        const v = 1 + 0.05 * (S.nA[c] * cos(tm * 0.04) + S.nB[c] * sin(tm * 0.04));
        for (let ch = 0; ch < 3; ch++) top[o + ch] = S.plat[ch] * v;
      }
      else for (let ch = 0; ch < 3; ch++) top[o + ch] = pal[t * 9 + ch];
      if (wet2[c]) {
        const ph = sin(TWO_PI * (0.31 * tm - 0.23 * (i + j)) + 1.7 * 0);
        const gl = ph > 0.55 ? 1.2 : ph < -0.55 ? 0.86 : 1;
        for (let ch = 0; ch < 3; ch++) top[o + ch] = S.water[ch] * gl;
      }
    }
  for (let px = 0; px < W; px++) {
    const d = (px + 0.5 - X0) / AX;
    const ad = d < 0 ? -d : d;
    let s = 2 * N - ad;
    let i, j, tone;
    if (d >= 0) {
      i = N - 1;
      j = floor(N - d);
      tone = 2;
    } else {
      j = N - 1;
      i = floor(N + d);
      tone = 1;
    }
    let ybuf = H, zprev = ZBOT;
    for (;;) {
      const c = (j + OFS) * ND + i + OFS;
      const z = zd[c];
      const su = 2 * i - d, sv = 2 * j + d;
      const sx = su > sv ? su : sv;
      const yb = Y0 + HY * s - z, yf = Y0 + HY * s - zprev;
      const rb = ceil(yb - 0.5);
      let rf = ceil(yf - 0.5);
      if (rf > ybuf) rf = ybuf;
      if (rb < rf) {
        const wp = off - warp(S, (s + d) * 0.5, (s - d) * 0.5);
        for (let r = rb < 0 ? 0 : rb; r < rf; r++) {
          const zz = Y0 + HY * s - (r + 0.5);
          const t = S.bt[bedAt(S, zz + wp)];
          const dep = 1 - 0.12 * cl((36 - zz) / 70, 0, 1);
          const p = t * 9 + tone * 3;
          const o = (r * W + px) * 3;
          img[o] = pal[p] * dep;
          img[o + 1] = pal[p + 1] * dep;
          img[o + 2] = pal[p + 2] * dep;
        }
      }
      if (rb < ybuf) ybuf = rb;
      const ra = ceil(Y0 + HY * sx - z - 0.5);
      if (ra < ybuf) {
        const o3 = c * 3;
        const cr = top[o3], cg = top[o3 + 1], cb = top[o3 + 2];
        for (let r = ra < 0 ? 0 : ra; r < ybuf; r++) {
          const o = (r * W + px) * 3;
          img[o] = cr;
          img[o + 1] = cg;
          img[o + 2] = cb;
        }
        ybuf = ra;
      }
      zprev = z;
      s = sx;
      if (su > sv) {
        i--;
        tone = 2;
      } else {
        j--;
        tone = 1;
      }
      if (i < 0 || j < 0) break;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, img[o], img[o + 1], img[o + 2]);
    }
}
