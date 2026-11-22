// ===== Patternflow pattern =====
// Title:   Virga
// Family:  virga
// Idea:    A dark violet cloud base hangs over the top 26 rows at dusk and lets down slanted curtains of fine rain streaks, gold on the side that faces the low sun and violet on the other, that thin out and end raggedly in the air above an amber, rose and indigo sky, while one cell of rain builds and another fades.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Virga, rain that falls from a cloud base and dries up in the air before it reaches the ground, a supplementary feature of clouds in the WMO International Cloud Atlas (2017 edition); the streaks lean with wind shear and the cloud base hangs in soft pouches, as under mammatus. The streaks here are 1D value noise slid down a sheared coordinate.
// Round:   218
// ===============================
// @matrix 64x128
// @knobs Hue=-0.14..0.1, Rain=0.5..3.5, Shear=-1..1, Dry=-1..1
//
// Knob 1: Hue. Turns the whole dusk, the sky, the cloud and the rain together. At the opening 0 the sky runs from indigo (62, 49, 84) under the cloud through violet (89, 55, 92) and a dim mauve (107, 64, 82) to a peach amber (219, 150, 105) at the bottom row, and the rain is gold (255, 180, 92) on its lit side. The cool side moves every colour by 0.9 times the knob, so at -0.14 the sky under the cloud is blue-green, the middle blue-violet and the horizon pink (219, 105, 147). On the warm side the sky aloft moves by +0.5 times the knob and the horizon by -0.5 times it, so at 0.1 the top goes violet and the horizon turns coral (219, 116, 105). The range stops before yellow and green.
// Knob 2: Rain. The knob less 0.5, over 3, sets how heavy the rain is. The number of cells that may hang at once is 3.6 at 0.5, 5.3 at the opening 2 and 7 at 3.5, the brightness of a curtain is 1.9 to 2.85 times, and its width grows from 0.85 to 1.15 times, so a near curtain is 19 LEDs wide at 0.5, 22 at 2 and 25 at 3.5, and a far one 8 to 11. A cell that a lower knob switches off fades over about 6 s and comes back when the knob does. At 0.5 there are three or four thin veils with a few gold threads in them, at 3.5 they are close to solid grey-gold sheets with only the lit streaks standing out.
// Knob 3: Shear. Wind shear, which way the streaks lean and how much the lean grows with the fall. A streak moves 0.1 + 0.28 times the knob LED sideways for each row it falls and bends by another 0.0014 + 0.005 times the knob per row squared, so after 50 rows it has moved 8.5 LEDs to the right at the opening 0, 35 at 1 with a hard curve in it, and 18 to the left at -1. The lean also wanders by up to 0.045 on its own, and a near curtain leans about 1.3 times as much as a far one. The cloud base tilts with the knob, 0.2 rows per LED of distance from the middle column, so at 1 its left edge is 6 rows higher and its right edge 6 lower, and the low haze banks lean with it.
// Knob 4: Dry. The height of the dry layer, where the rain has gone. The layer is on row 42 at -1, row 81 at the opening 0.06 and row 116 at 1, and it moves up and down by up to 13 rows over about a minute on its own. At -1 the rain hangs from the cloud as stubs 15 to 20 LEDs long, at 1 as ropes that reach down to within 12 to 30 LEDs of the bottom row. Each streak ends within 20 percent of the layer's depth by its own cut-off, and a cell that is still building has reached only a third of the way. A drier layer also brightens the horizon glow to 1.45 times (0.45 times at -1) and thins the curtains' brightness from 1.2 times to 0.95.

// The panel is a view up at a high cloud base from the ground at dusk. Rows 0 to about 26 are the cloud base. Its
// underside is two octaves of value noise on a domain warp, so it hangs between rows 18 and 34 in pouches about
// 6 LEDs across, and the whole deck drifts with the wind. The body is a dark violet (58, 36, 71) mottled by two
// noise layers that slide past each other, with a rim of gold and rose along the underside. A flank of a pouch
// that faces the sun is lit more, so the glow runs along one side of each. Under the cloud the sky is a gradient
// in seven stops from indigo to a peach amber at the bottom row, with a soft glow around the sun, which sits
// beyond the horizon somewhere between 26 LEDs left of the panel and 90 across, and a few flat banks of haze
// low in the sky, gold where lit and rose where not, that drift with the wind and change as they go.
// Rain cells are the state: seven slots, each a cell with a column, a distance, an age and a life of 15 to 39 s.
// A cell rises over the first 13 percent of its life and hangs, then thins out from 68 percent on. Its rain
// reaches a third of the way to the dry layer when new, the whole way by 26 percent and a third less at the
// end. It pulses by 40 percent on a period of 13 to 22 s, sways 9 LEDs on 48 to 90 s, and drifts with the wind
// at 0.4 to 1.3 LEDs a second in the mean wind, the near ones faster. The cloud base sags up to 5.5 rows under it. A dead slot waits
// 0.5 to 5.5 s and starts a new cell at a random column. The first update gives the cells ages spread over a
// life, with three of them near their peak, at columns shuffled evenly over the panel, so second 0 is full.
// Hue, brightness, the sun, the glow, the lean, the dry layer and the wind are slow random walks that pull
// back toward the middle, run through two low-pass stages of 5 s, so the sky never comes round to a scene it
// has shown.
// A curtain is drawn per cell, far ones first. A far one is 9 LEDs wide, falls 4.5 LEDs a second and is hazy,
// a near one is 22 LEDs wide, falls 10.5 and is clearer. Every pixel is turned into the curtain's own sheared
// coordinate, the column minus the lean times the rows below the cloud, so a streak is a slanted curve that
// hangs from the cloud. A coarse layer (6 LEDs across, long in y) says where the rain is dense and a fine layer
// (2.7 LEDs across, about 11 rows long) cuts it into streaks. Each is a row of lattice columns, each with its
// own centre, a soft bump across x and 1D noise down y, slid down at the fall speed, the fine layer 13 percent
// faster, so no streak is thinner than 2 LEDs. Going down, the level the noise has to reach to show rises and
// each column has an end height of its own, so the rain thins into sparse wisps and ends raggedly.
// The sun side of a curtain is gold and the other side a dark lilac, the top is dimmer as if in the cloud's
// shade, and near its tip a curtain takes on the colour of the sky behind it.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, exp, sqrt, abs, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const F = (n) => new Float32Array(n);

const NSLOT = 7; // most cells of rain at once
const EDGE0 = 26; // mean row of the underside of the cloud
const SAG = 5.5; // rows the cloud base hangs down under a full cell
const END_LO = 42, END_HI = 116; // the dry layer at Dry -1 and Dry 1, rows

// the sky: elevation (0 top row, 1 bottom row), hue, saturation, value
const ST_E = [0, 0.2, 0.4, 0.6, 0.78, 0.9, 1];
const ST_H = [0.68, 0.73, 0.82, 0.93, 1.01, 1.045, 1.065];
const ST_S = [0.5, 0.42, 0.4, 0.4, 0.44, 0.5, 0.52];
const ST_V = [0.3, 0.33, 0.36, 0.42, 0.55, 0.74, 0.86];

function hsv(h, s, v, out) {
  h -= floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[0] = f(5);
  out[1] = f(3);
  out[2] = f(1);
}

// ---- noise
function hs(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) * 2.3283064365386963e-10;
}

function vn2(x, y) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const a = hs(ix, iy), b = hs(ix + 1, iy), c = hs(ix, iy + 1), d = hs(ix + 1, iy + 1);
  return a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy;
}

// One column of a streak field: 1D value noise along y with a phase of its own.
function colv(ix, fy) {
  const p = fy + hs(ix, 911) * 64, iy = floor(p), f = p - iy, w = f * f * (3 - 2 * f);
  const a = hs(ix, iy), b = hs(ix, iy + 1);
  return a + (b - a) * w;
}

let SE = 0; // the end cut-off of the column the last streak() call fell in
// Streaks: each lattice column is a long soft bar with its own centre, a bump across x, and 1D noise along y.
function streak(xs, fy, rad) {
  const ix = floor(xs);
  let best = 0, end = 0;
  for (let k = ix - 1; k <= ix + 1; k++) {
    const d = (xs - (k + 0.5 + (hs(k, 3) - 0.5) * 0.5)) / rad, q = 1 - d * d;
    if (q <= 0) continue;
    const v = colv(k, fy) * q * q;
    if (v > best) {
      best = v;
      end = hs(k, 5);
    }
  }
  SE = end;
  return best;
}

// Slow random walks that pull back toward zero (Ornstein-Uhlenbeck), so what they steer never comes round again.
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;
const OU_TAU = [28, 24, 50, 28, 40, 35, 70]; // hue, brightness, sun, glow, lean, dry layer, wind: seconds
const OU_SIG = [0.04, 0.06, 40, 0.14, 0.04, 8, 0.7];

export function setup(params) {
  const S = {
    t: 0, t0: Math.random() * 1500, cd: Math.random() * 60, ready: false,
    k1: 0, rn: 0.5, k3: 0, u4: 0.5, nf: 4,
    r: OU_SIG.map((v) => v * gauss()), q: [0, 0, 0, 0, 0, 0, 0], o: [0, 0, 0, 0, 0, 0, 0], bg: 1, sunX: 32, glowG: 0.6, wind: 0, endRow: 80, lean: 0.1, curve: 0.0014,
    R: F(N), G: F(N), B: F(N), SR: F(N), SG: F(N), SB: F(N),
    edge: F(W + 2), sag: F(W), gx: F(W), gw: F(W),
    lutR: F(H), lutG: F(H), lutB: F(H),
    cells: [],
    c: { body: [0, 0, 0], lit: [0, 0, 0], shade: [0, 0, 0], gold: [0, 0, 0], rose: [0, 0, 0], glow: [0, 0, 0], tmp: [0, 0, 0] },
  };
  for (let i = 0; i < NSLOT; i++) S.cells.push({ on: false, idle: 0, w: 0, x: 0, hw: 8, z: 0.5, age: 0, life: 100, seed: 0, vf: 7, xd: 0, jit: 1, lm: 1, lb: 0, pw: 0.25, pp: 0, sw: 0.1, str: 0, yb: 26, end: 70, op: 1, side: 0, wyc: 24, wyf: 14, sx: 0, sx2: 0, sy: 0, sy2: 0, leanC: 0.1, curveC: 0 });
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.k1 = cl(k[0], -0.14, 0.1);
  S.rn = (cl(k[1], 0.5, 3.5) - 0.5) / 3;
  S.k3 = cl(k[2], -1, 1);
  S.u4 = (cl(k[3], -1, 1) + 1) / 2;
  S.nf = 3.6 + 3.4 * S.rn;
  if (!S.ready) {
    for (let i = 0; i < OU_SIG.length; i++) {
      if (i !== 2) S.r[i] *= 0.4; // all but the sun start near their middle, so the opening is a good one
      if (i === 3) S.r[i] = 0.1 + 0.06 * Math.random();
      S.q[i] = S.o[i] = S.r[i];
    }
    prerun(S);
    S.ready = true;
  }
  step(S, d);
}

function windAt(S) {
  return cl(0.5 + S.o[6], -1, 1);
}

// Each walk is run through two low-pass stages of 5 s, so it moves smoothly frame to frame.
function walk(S, dt) {
  const ks = 1 - exp(-dt / 5);
  for (let i = 0; i < OU_TAU.length; i++) {
    const k = exp(-dt / OU_TAU[i]);
    S.r[i] = S.r[i] * k + OU_SIG[i] * sqrt(1 - k * k) * gauss();
    S.q[i] += (S.r[i] - S.q[i]) * ks;
    S.o[i] += (S.q[i] - S.o[i]) * ks;
  }
}

// A new cell at a random column, upwind of the middle a little, and at a random distance. Keeping new cells
// far from the old ones made every layout the same even spacing and the picture came back to it; left alone they
// bunch and gap, so the layouts differ.
function spawn(S, c, age0) {
  const best = -4 + 70 * Math.random() - 8 * (S.wind > 0 ? 1 : -1) * Math.random(), bz = 0.1 + 0.9 * Math.random();
  c.on = true;
  c.x = best;
  c.z = bz;
  c.life = 15 + 24 * Math.random();
  c.age = c.life * age0;
  c.hw = mix(4.6, 11, bz) * (0.9 + 0.2 * Math.random());
  c.vf = mix(4.5, 10.5, bz) * (0.92 + 0.16 * Math.random());
  c.jit = 0.92 + 0.2 * Math.random();
  c.lm = 0.85 + 0.3 * bz;
  c.op = mix(0.5, 1, bz);
  c.lb = 0.2 * (Math.random() - 0.6);
  c.pw = 0.28 + 0.22 * Math.random();
  c.pp = Math.random() * 6.283;
  c.sw = 0.07 + 0.06 * Math.random();
  c.seed = floor(Math.random() * 4000);
  c.sx = Math.random() * 500;
  c.sx2 = Math.random() * 500;
  c.sy = Math.random() * 500;
  c.sy2 = Math.random() * 500;
  c.wyc = 22 + 6 * Math.random();
  c.wyf = 10 + 3 * Math.random();
}

function prerun(S) {
  S.wind = windAt(S);
  // Ages spread over a life, a different way round for each slot, with the first two near their peak, so the
  // opening picture is full and the cells then go on without a lull.
  const ages = [0.3, 0.42, 0.5, 0.08, 0.62, 0.78, 0.2];
  for (let i = ages.length - 1; i > 2; i--) {
    const j = 3 + floor(Math.random() * (i - 2));
    const t = ages[i];
    ages[i] = ages[j];
    ages[j] = t;
  }
  // The first cells stand at columns spread over the panel, in an order that keeps any few of them apart, and
  // the whole row is mirrored half the time, so the opening is never a heap on one side.
  const cols = [34, 11, 54, 23, 45, 3, 62], mirror = Math.random() < 0.5;
  for (let i = 0; i < NSLOT; i++) {
    const c = S.cells[i], e = cl(S.nf - i, 0, 1);
    if (e > 0.2) {
      spawn(S, c, ages[i] + 0.06 * Math.random());
      c.x = (mirror ? 64 - cols[i] : cols[i]) + 5 * (Math.random() - 0.5);
    } else c.idle = 1 + 6 * Math.random();
    c.w = e;
  }
}

function step(S, dt) {
  S.t += dt;
  walk(S, dt);
  S.wind = windAt(S);
  S.cd += S.wind * 0.75 * dt;
  const kw = 1 - exp(-dt / 2.5);
  for (let i = 0; i < NSLOT; i++) {
    const c = S.cells[i], e = cl(S.nf - i, 0, 1);
    c.w += (e - c.w) * kw;
    if (c.on) {
      c.age += dt;
      c.x += S.wind * 2.2 * (0.4 + 0.8 * c.z) * dt;
      if (c.age > c.life || c.x < -26 || c.x > 90) {
        c.on = false;
        c.idle = 0.5 + 5 * Math.random();
      }
    } else {
      c.idle -= dt;
      if (c.idle <= 0 && e > 0.2) spawn(S, c, 0);
    }
  }
}

// ---- the picture
function edgeAt(S, x, T) {
  const xc = x - S.cd;
  const warp = vn2(xc * 0.045 + 7.3, T * 0.021) * 2 - 1;
  const f1 = vn2(xc * 0.075 + warp * 1.6, T * 0.013 + 3.3) - 0.5;
  const f2 = vn2(xc * 0.17 - warp * 2.2 + 9.1, T * 0.027 + 1.7) - 0.5;
  return EDGE0 + 11 * f1 + 4.2 * f2;
}

function palette(S, T) {
  const k = S.k1, c = S.c;
  // On the cool side the whole dusk turns toward pink over teal. On the warm side the sky aloft goes to violet and
  // the horizon to orange-red, so the hue never runs on into yellow and green.
  const wander = cl(S.o[0], -0.05, 0.025);
  S.bg = 1 + cl(S.o[1], -0.1, 0.1);
  const sh = (e) => wander + (k < 0 ? k * 0.9 : k * (0.5 - e));
  hsv(0.77 + sh(0.3), 0.5, 0.28, c.body);
  hsv(1.09 + sh(0.9), 0.64, 1.05, c.lit);
  hsv(0.76 + sh(0.5), 0.36, 0.34, c.shade);
  hsv(1.1 + sh(0.9), 0.5, 1.0, c.gold);
  hsv(0.975 + sh(0.7), 0.44, 0.9, c.rose);
  hsv(1.06 + sh(1), 0.62, 0.88, c.glow);
  const t = c.tmp;
  for (let y = 0; y < H; y++) {
    const e = (y + 0.5) / H;
    let i = 0;
    while (i < 5 && e > ST_E[i + 1]) i++;
    const f = (e - ST_E[i]) / (ST_E[i + 1] - ST_E[i]);
    hsv(mix(ST_H[i], ST_H[i + 1], f) + sh(e), mix(ST_S[i], ST_S[i + 1], f), mix(ST_V[i], ST_V[i + 1], f), t);
    S.lutR[y] = t[0];
    S.lutG[y] = t[1];
    S.lutB[y] = t[2];
  }
  S.sunX = 32 + 58 * Math.tanh(S.o[2] / 38);
  S.glowG = cl(0.5 + S.o[3], 0.26, 0.7) * mix(0.45, 1.45, S.u4);
  S.endRow = mix(END_LO, END_HI, S.u4) + cl(S.o[5], -13, 13);
  const w = S.wind;
  S.lean = 0.1 + 0.28 * S.k3 + cl(S.o[4], -0.045, 0.045) + 0.02 * w;
  S.curve = 0.0014 + 0.005 * S.k3;
}

function sky(S, T) {
  const { SR, SG, SB, lutR, lutG, lutB, gx, gw, c } = S, gc = c.glow, gold = c.gold, rose = c.rose, sx = S.sunX;
  for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - sx) / 27, dw = (x + 0.5 - sx) / 60;
    gx[x] = exp(-dx * dx);
    gw[x] = exp(-dw * dw);
  }
  for (let y = 0; y < H; y++) {
    const yy = (y + 0.5) / H, dy = (1 - yy) / 0.42, gy = exp(-dy * dy) * S.glowG;
    const lr = lutR[y], lg = lutG[y], lb = lutB[y], bw = sm(0.3, 0.75, yy);
    for (let x = 0, p = y * W; x < W; x++, p++) {
      const g = gx[x] * gy, b = 0.84 + 0.16 * gw[x];
      // far banks of haze low in the sky, long and flat, drifting with the wind and changing as they go
      const bk = (vn2((x - S.cd + S.k3 * (y - 96) * 0.4) * 0.02 + 11.3, y * 0.085 - T * 0.06) - 0.5) * 2 * bw;
      let r = lr * b + gc[0] * g, gg = lg * b + gc[1] * g, bb = lb * b + gc[2] * g;
      // a bank lit gold from below where bk is above 0, and one in the cloud's shadow, as bright but rose, where it is below
      const up = bk > 0 ? bk * bk : 0, dn = bk < 0 ? bk * bk : 0;
      r += gold[0] * 0.42 * up;
      gg += gold[1] * 0.42 * up;
      bb += gold[2] * 0.42 * up;
      const k = max(r, gg, bb) / 0.9, q = dn * 0.7;
      r += (rose[0] * k - r) * q;
      gg += (rose[1] * k - gg) * q;
      bb += (rose[2] * k - bb) * q;
      const mx = max(r, gg, bb);
      if (mx > 0.72) {
        // a soft shoulder on the brightest channel with the hue kept, so a strong glow stays orange and does not clip to yellow
        const f = (0.72 + 0.22 * (1 - exp(-(mx - 0.72) / 0.22))) / mx;
        r *= f;
        gg *= f;
        bb *= f;
      }
      SR[p] = r;
      SG[p] = gg;
      SB[p] = bb;
    }
  }
}

function drawCell(S, c, T) {
  const { R, G, B, SR, SG, SB, edge } = S, col = S.c;
  const yb0 = c.yb, span = max(14, c.end - yb0), dsp = 1 / span;
  const side = c.side, back = 1 - abs(side);
  const y0 = max(0, floor(yb0 - 4)), y1 = min(H - 1, ceil(c.end + 0.3 * span + 6));
  const wxc = 6, wxf = 2.7, fall = c.vf * T;
  const thc = 0.3 - 0.1 * (S.rn - 0.5), thf = 0.3 - 0.1 * (S.rn - 0.5);
  const gain = (1.9 + 0.95 * S.rn) * mix(1.2, 0.95, S.u4) * c.op * Math.min(1, c.str * 1.6);
  const lr = col.lit, sr = col.shade;
  for (let y = y0; y <= y1; y++) {
    const yy = y + 0.5, d = yy - yb0;
    const dxs = c.leanC * d + c.curveC * d * d;
    const hw = c.hw * (1 - 0.2 * cl(d * dsp, 0, 1) + 0.08 * sin(d * 0.13 + c.seed)) * (0.85 + 0.3 * S.rn);
    const xa = max(0, floor(c.xd + dxs - hw * 1.25)), xb = min(W - 1, ceil(c.xd + dxs + hw * 1.25));
    const fyc = (yy - fall) / c.wyc + c.sy, fyf = (yy - fall * 1.13) / c.wyf + c.sy2;
    for (let x = xa; x <= xb; x++) {
      const xs = x + 0.5 - c.xd - dxs, xr = abs(xs) / hw;
      if (xr >= 1.25) continue;
      const env = 1 - sm(0.5, 1.1, xr);
      if (env <= 0) continue;
      const yl = edge[x + 1] - 2, dl = yy - yl;
      if (dl < -3) continue;
      const u = dl / max(10, c.end - yl), top = sm(-2.5, 2.5, dl);
      const sc = streak(xs / wxc + c.sx, fyc, 1.05);
      const sf = streak(xs / wxf + c.sx2, fyf, 0.9);
      const endr = 1 + 0.4 * (SE - 0.5), uu = u / endr;
      if (uu > 1.1) continue;
      const g = pow(cl(uu, 0, 1.1), 1.3);
      // a coarse layer says where the rain is dense, a fine one cuts it into streaks, and both ask more of the noise lower down
      const bun = 0.5 + 0.5 * sm(thc + 0.3 * g, thc + 0.3 * g + 0.34, sc);
      const fin = 0.36 + 0.64 * sm(thf + 0.34 * g, thf + 0.34 * g + 0.3, sf);
      const dens = env * top * (1 - sm(0.72, 1, uu)) * bun * fin * (1 - 0.12 * cl(u, 0, 1));
      const a = cl(dens * gain, 0, 0.93);
      if (a < 0.01) continue;
      const q = cl(xs / hw, -1, 1), lit0 = 0.5 + 0.62 * side * q + 0.2 * back + 0.14 * S.gx[x] + c.lb, lit = sm(0.12, 0.88, lit0);
      const bright = 0.5 + 0.5 * sm(0, 0.35, u);
      const p = y * W + x, haze = mix(0.3 * (1 - c.z), 0.3, sm(0.4, 1, u)) + 0.08 * (1 - c.z);
      const li2 = lit * (0.35 + 0.65 * sm(0, 0.3, u));
      let cr = (sr[0] + (lr[0] - sr[0]) * li2) * bright, cg = (sr[1] + (lr[1] - sr[1]) * li2) * bright, cb = (sr[2] + (lr[2] - sr[2]) * li2) * bright;
      cr += (SR[p] - cr) * haze;
      cg += (SG[p] - cg) * haze;
      cb += (SB[p] - cb) * haze;
      R[p] += (cr - R[p] * 0.55) * a;
      G[p] += (cg - G[p] * 0.55) * a;
      B[p] += (cb - B[p] * 0.55) * a;
    }
  }
}

function cloud(S, T) {
  const { R, G, B, edge, sag, gx, gw, c } = S, body = c.body, gold = c.gold, rose = c.rose, sx = S.sunX, cd = S.cd;
  for (let x = 0; x < W; x++) {
    const e = edge[x + 1], ymax = min(H - 1, ceil(e + 3));
    const sunDir = cl((sx - (x + 0.5)) / 34, -1, 1), slope = (edge[min(W + 1, x + 2)] - edge[x]) * 0.5;
    const litS = cl(0.5 - 0.9 * sunDir * slope, 0, 1);
    const near = 0.5 + 0.5 * gw[x] + 0.35 * gx[x];
    const xc = x - cd;
    for (let y = 0; y <= ymax; y++) {
      const yy = y + 0.5, depth = e - yy;
      const fr = 1.1 * (vn2(xc * 0.31 + 4.1, yy * 0.2 + T * 0.05) - 0.5);
      const cov = cl((depth + fr) / 2.2 + 0.5, 0, 1);
      if (cov <= 0) continue;
      const warp = vn2(xc * 0.05, yy * 0.07 + T * 0.02);
      const tex = 0.55 * vn2(xc * 0.085 + T * 0.01 + warp * 2, yy * 0.14 + warp * 1.5) + 0.45 * vn2(xc * 0.19 - T * 0.016 - warp, yy * 0.27 + T * 0.012);
      const top = 0.8 + 0.2 * sm(0, 24, yy);
      const dd = max(depth, 0), edgeG = exp(-dd / 3.2), amb = exp(-dd / 12);
      const k = (0.5 + 1.05 * tex) * top * (1 - 0.18 * sag[x]);
      const rim = edgeG * (0.25 + 0.75 * litS) * near * 0.85;
      const rg = rim * (0.35 + 0.65 * litS), rr = rim - rg;
      const p = y * W + x, fa = 0.2 * amb * near;
      const cr = body[0] * k + gold[0] * rg + rose[0] * (rr + fa * 0.5);
      const cg = body[1] * k + gold[1] * rg + rose[1] * (rr + fa * 0.5);
      const cb = body[2] * k + gold[2] * rg + rose[2] * (rr + fa * 0.5);
      R[p] += (cr - R[p]) * cov;
      G[p] += (cg - G[p]) * cov;
      B[p] += (cb - B[p]) * cov;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const T = S.t + S.t0, cells = S.cells;
  palette(S, T);
  // the cloud base, with a sag under every cell
  for (let x = 0; x < W; x++) S.sag[x] = 0;
  const live = [];
  for (const c of cells) {
    if (!c.on) {
      c.str = 0;
      continue;
    }
    c.xd = c.x + 9 * sin(T * c.sw + c.pp);
    const a = c.age / c.life;
    c.str = sm(0, 0.13, a) * (1 - sm(0.68, 1, a)) * c.w * (0.6 + 0.4 * sin(T * c.pw + c.pp));
    if (c.str < 0.01) continue;
    const reachF = (0.3 + 0.7 * sm(0, 0.26, a)) * (1 - 0.33 * sm(0.66, 1, a));
    c.reachF = reachF;
    const s2 = c.hw * 1.3;
    const xa = max(0, floor(c.xd - 3 * s2)), xb = min(W - 1, ceil(c.xd + 3 * s2));
    for (let x = xa; x <= xb; x++) {
      const q = (x + 0.5 - c.xd) / s2;
      S.sag[x] += c.str * exp(-q * q);
    }
    live.push(c);
  }
  for (let x = 0; x < W + 2; x++) {
    const xx = cl(x - 0.5, 0, W - 0.5);
    S.edge[x] = edgeAt(S, xx, T) + SAG * min(1, S.sag[cl(x - 1, 0, W - 1)]) + 0.2 * S.k3 * (xx - 32);
  }
  sky(S, T);
  S.R.set(S.SR);
  S.G.set(S.SG);
  S.B.set(S.SB);
  live.sort((a, b) => a.z - b.z);
  for (const c of live) {
    const xi = cl(floor(c.xd), 0, W - 1);
    c.yb = S.edge[xi + 1] - 2;
    c.end = c.yb + max(12, (S.endRow - c.yb) * c.reachF * mix(0.9, 1.06, c.z) * c.jit);
    c.side = cl((S.sunX - c.xd) / 38, -1, 1);
    c.leanC = S.lean * c.lm;
    c.curveC = S.curve * c.lm;
    drawCell(S, c, T);
  }
  cloud(S, T);
  const { R, G, B } = S, bg = S.bg;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let r = R[p] * bg, g = G[p] * bg, b = B[p] * bg;
      const mx = max(r, g, b);
      if (mx > 0.8) {
        // the brightest channel rolls off toward 1 with the hue kept, so gold stays gold where two curtains lie over each other
        const f = (0.8 + 0.2 * (1 - exp(-(mx - 0.8) / 0.35))) / mx;
        r *= f;
        g *= f;
        b *= f;
      }
      display.setPixel(x, y, r * 255, g * 255, b * 255);
    }
}
