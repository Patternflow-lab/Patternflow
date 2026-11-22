// ===== Patternflow pattern =====
// Title:   Annual Rings
// Family:  dendro
// Idea:    A tree trunk cut across fills the panel with warm wood while it grows in time-lapse: every year adds a pale ring that darkens to a thin latewood band, the rings are born at the edge and flow inward as the view pulls back, and droughts, frost rings, a fire scar with callus closing over it and a few radial cracks pass along with them until they blur into the average wood colour at the centre.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dendrochronology, A. E. Douglass: tree rings read as a record of wet and dry years and cross-dated between trees, 1913 into the 1920s (Climatic Cycles and Tree-Growth, 1919); fire scars and frost rings dated by the same cross-dating
// Round:   216
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.6..4, Climate=-1..1, Lean=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the wood and carries it through four woods in one turn: pine amber at 0 (earlywood (232, 199, 140), latewood (110, 62, 27)), cherry red at 0.22, olive oak at 0.5 (half the colour of amber, 0.88 of its brightness), grey driftwood at 0.76 (0.16 of the colour, 0.86 of the brightness), and amber again at 1. At every position the dry years are greyer and darker and the wet years richer.
// Knob 2: Growth. Rings born a second, the knob over 4: 0.15 at 0.6, 0.5 at the opening 2 and 1 at 4. Every ring moves inward by one of its own widths per ring born, so at the bark, where a mean ring is 3.6 LEDs wide across and up to twice that along the panel, the flow is 0.5 LEDs a second at 0.6 and 3.6 at 4. The tree is already 40 s old at second 0 at that rate, which puts a different stretch of the record on the panel at each setting.
// Knob 3: Climate. The spread of the ring record, steady years at -1 and wild ones at 1, opening at 0. Ring width is e to the power of the spread times a 1/f series, the spread being 0.2 at -1, 0.475 at 0 and 0.75 at 1. The knob also scales the droughts (3 to 9 narrow rings, down to 0.12 of the normal width, greyer and darker), the good years (rings up to 2.1 times the mean) and the frost rings (a thin dark band inside a ring, one ring in 100 at -1, one in 14 at 0 and one in 8 at 1).
// Knob 4: Lean. Opens at 0.06, so (knob + 1) / 2 is 0.53. It moves the pith up to 20 LEDs from the middle, 12 left and 16 down at the top of the knob, so the rings are wider on the far side, the reaction wood, and it makes the rings oval: a ring is 1.0 high for 1.0 wide near the pith and 1.55 at the edge at -1, and 1.3 and 2.0 at 1.

// The picture is a function of one number, the age of the tree in rings, uN, which grows by the Growth rate
// every second. Ring i is the stretch of age from i to i + 1. Its width comes from a record that is made on
// the fly from hashed noise, so it never repeats and needs no memory: a 1/f series (six octaves of value
// noise, each with half the power of the one below), droughts, good years, frost rings, fire scars and
// radial checks, each drawn from a cell of rings with its own hashed event.
//
// The view is a pull-back of that trunk. A pixel has a depth x below the bark, x = (1 - q) 50, where q is 1
// on the bark outline and 0 at the pith (x in units close to LEDs). A ring's width at depth x is S0 times
// its width factor times cam(x), which is 1 at the bark and 0.4 at 50, so rings are 3 to 9 LEDs wide at the
// edge and shrink inward. An ODE run from the bark inward turns that into the age at each depth: uN sits at
// the bark and a ring born there moves in by one of its own widths per ring born, slowly and smoothly.
// Nothing jumps when a ring is born, since the newest ring is a thin sliver that swells.
//
// A ring is drawn as a colour table of 40 samples, kept as a running sum, so the picture at a pixel is the
// mean of the table over a window of age. The window is 1.1 LEDs wide where the rings are wide and grows to
// 2.3 as they narrow under 4 LEDs. Under 2.6 LEDs the picture goes over to the smoothed mean colour of the
// rings, weighted by their width, so the middle is the average wood colour and nothing shimmers.
//
// The geometry: the pith is off the middle by the Lean knob. In a space where the rings are squashed
// (taller than wide, more so toward the edge) the bark outline is a circle around the middle of the panel
// that passes through the four corners. A ring at depth x is that outline scaled about the pith: circles at
// the pith, offset ovals at the bark, wide rings where the pith is far from the bark. A smooth wander of
// the age with the angle, different for every ring, moves the boundaries by a fraction of a ring width.
//
// Events sit in age and angle, so they move with the rings. A fire scar is a charcoal wedge, about one ring
// wide at its base, that closes from both lips over 3.5 to 6.5 rings with an orange rim, while the rings
// bulge outward beside it. A radial check starts at some ring, runs inward and ends at the ring it grew in.
// The bark shows in the corners when the newest rings are narrow, up to 4.5 LEDs deep, and not at all in a
// good year.

const W = 64, H = 128, NPX = W * H;
const TAU = 6.283185307179586;
const { floor, min, max, sqrt, abs, exp, sin, atan2, pow, imul, tanh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- the camera
const XR = 50; // depth of the pith in x units
const DX = 0.25; // step of the depth table
const NJ = 208; // entries of the depth table, enough for XR plus a margin
const S0 = 3.6; // width of a ring of mean width at the bark, in x units (about LEDs)
const XG = 52; // depth where a ring is down to 0.37 of its width at the bark
const cam = (x) => exp(-(x / XG) * (x / XG));
const NS = 40; // colour samples per ring in the running sum
const MAXR = 140; // most rings in the table

// ---- the record
let SD = 0; // seed of the running tree, set at the start of update and draw
let SIG = 0.43, DSTR = 0.5, BOOM = 0.6, FROST = 0.07; // climate, set from the Climate knob

function hh(i, k) {
  let h = imul(i | 0, 0x27d4eb2d) ^ imul(k | 0, 0x165667b1) ^ SD;
  h = imul(h ^ (h >>> 15), 0x85ebca6b);
  h = imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth value noise in -1..1, one lattice cell per unit of x.
function vn(x, k) {
  const i = floor(x), t = x - i, s = t * t * (3 - 2 * t);
  return mix(hh(i, k), hh(i + 1, k), s) * 2 - 1;
}

// 1/f series with about unit spread: octave o has period 2^o rings and amplitude 2^(-o/2).
function zrec(u) {
  let s = 0, p = 1, a = 1;
  for (let o = 0; o < 6; o++) {
    s += a * vn(u / p, 10 + o);
    p *= 2;
    a *= 0.7071;
  }
  return s * 1.43;
}

const DROUGHT_CELL = 36, BOOM_CELL = 23;

// Width factor of the ring at age u, mean about 1.
function omega(u) {
  let w = exp(SIG * zrec(u) - 0.5 * SIG * SIG);
  const c0 = floor(u / DROUGHT_CELL);
  let dr = 0;
  for (let c = c0 - 1; c <= c0; c++) {
    if (hh(c, 21) < 0.6) {
      const st = c * DROUGHT_CELL + hh(c, 22) * 30, len = 3 + hh(c, 23) * 6, dp = 0.6 + 0.4 * hh(c, 24);
      const e = sm(st - 0.7, st + 0.7, u) * (1 - sm(st + len - 0.7, st + len + 0.7, u));
      if (dp * e > dr) dr = dp * e;
    }
  }
  w *= 1 - DSTR * 0.88 * dr;
  const b0 = floor(u / BOOM_CELL);
  for (let c = b0 - 1; c <= b0; c++) {
    if (hh(c, 31) < 0.6) {
      const cen = c * BOOM_CELL + hh(c, 32) * BOOM_CELL, d = (u - cen) / 0.9;
      if (d > -3 && d < 3) w *= 1 + BOOM * (0.7 + 0.9 * hh(c, 33)) * exp(-d * d);
    }
  }
  // soft ceiling: no ring gets wider than about 2.1 times the mean
  return w < 1.4 ? w : 1.4 + 0.7 * tanh((w - 1.4) / 0.7);
}

// ---- colour
const BASE_E0 = [0.91, 0.78, 0.55]; // pale earlywood, #e8c78c
const BASE_E1 = [0.76, 0.54, 0.31]; // earlywood late in the season
const BASE_LW = [0.43, 0.245, 0.105]; // latewood, #6e3e1b
const BASE_FR = [0.3, 0.15, 0.07]; // frost band
const BASE_RIM = [0.95, 0.46, 0.1]; // callus rim of a fire scar
const CHAR = [0.15, 0.115, 0.1]; // charcoal
const BARK = [0.3, 0.17, 0.09];

// Hue knob: where the wood sits at the key positions, as a shift of hue (turns), a factor on saturation and one on value.
const HKEY = [0, 0.22, 0.5, 0.76, 1];
const HDH = [0, -0.075, 0.055, 0.03, 0];
const HDS = [1, 1.0, 0.5, 0.16, 1];
const HDV = [1, 0.8, 0.88, 0.86, 1];

function paletteShift(k, out) {
  k -= floor(k);
  let s = 0;
  while (s < 3 && k >= HKEY[s + 1]) s++;
  const t = sm(HKEY[s], HKEY[s + 1], k);
  out[0] = mix(HDH[s], HDH[s + 1], t);
  out[1] = mix(HDS[s], HDS[s + 1], t);
  out[2] = mix(HDV[s], HDV[s + 1], t);
}

function shift(c, sh, o, i) {
  const r = c[0], g = c[1], b = c[2];
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  h = (h + sh[0] + 1) % 1;
  const s = min(1, (mx > 0 ? d / mx : 0) * sh[1]), v = min(1, mx * sh[2]);
  const k = (n) => {
    const kk = (n + h * 6) % 6;
    return v - v * s * max(0, min(kk, 4 - kk, 1));
  };
  o[i] = k(5);
  o[i + 1] = k(3);
  o[i + 2] = k(1);
}

// Dry years go grey and dark, wet years golden and a little richer.
function tint(c, dry, wet, jit, out) {
  let r = c[0], g = c[1], b = c[2];
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  const ds = 1 - 0.3 * dry, dv = (1 - 0.3 * dry) * jit;
  const ws = 1 + 0.25 * wet;
  r = (l + (r - l) * ds * ws) * dv;
  g = (l + (g - l) * ds * ws) * dv * (1 - 0.04 * wet);
  b = (l + (b - l) * ds * ws) * dv * (1 - 0.14 * wet);
  out[0] = cl(r, 0, 1);
  out[1] = cl(g, 0, 1);
  out[2] = cl(b, 0, 1);
}

const F = (n) => new Float32Array(n);

export function setup(params) {
  const seed = (Math.random() * 2147483647) | 0;
  SD = seed;
  params.s = {
    seed,
    uN: 100 + hh(0, 99) * 400 + 20,
    opened: false,
    key: "",
    knobs: [0, 2, 0, 0.06],
    leanKey: -9,
    // geometry, per pixel
    R: F(NPX), B: F(NPX), TH: F(NPX), Q: F(NPX), GQ: F(NPX),
    Rb2: 0, cbx: 0, cby: 0,
    // depth table
    ud: F(NJ + 1), rw: F(NJ + 1),
    // running sums of colour
    cr: F((MAXR + 6) * NS + 2), cg: F((MAXR + 6) * NS + 2), cb: F((MAXR + 6) * NS + 2),
    ev: { sc: F(8 * 6), nsc: 0, ck: F(8 * 12), nck: 0 },
    tmp2: new Float32Array(3), sh: [0, 1, 1],
    mr: F(MAXR + 8), mg: F(MAXR + 8), mb: F(MAXR + 8), ow: F(MAXR + 8),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  SD = S.seed;
  S.knobs = k;
  const g = cl(k[1], 0.6, 4) / 4;
  if (!S.opened) {
    // The tree is already 40 s old at the rate the knob asks for, so the opening picture depends on it.
    S.uN = 100 + hh(0, 99) * 400 + 40 * g;
    S.opened = true;
  }
  S.uN += g * cl(dt || 0, 0, 0.1);
}

// ---- drawing

function geometry(S, lean) {
  if (abs(S.leanKey - lean) < 1e-5) return;
  S.leanKey = lean;
  const ex = 20 * lean;
  const px = 32 - 0.62 * ex, py = 64 + 0.78 * ex;
  const aIn = 1.0 + 0.3 * lean, aOut = 1.55 + 0.45 * lean;
  const ar = (r) => aIn + (aOut - aIn) * sm(8, 80, r);
  const xy = (dx, dy) => [dx, dy / ar(sqrt(dx * dx + dy * dy))];
  const cb = xy(32 - px, 64 - py);
  let rb = 0;
  for (const [cx, cy] of [[0, 0], [64, 0], [0, 128], [64, 128]]) {
    const c = xy(cx - px, cy - py);
    rb = max(rb, sqrt((c[0] - cb[0]) ** 2 + (c[1] - cb[1]) ** 2));
  }
  const cb2 = cb[0] * cb[0] + cb[1] * cb[1];
  S.Rb2 = rb * rb - cb2;
  const { R, B, TH, Q } = S;
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++) {
      const c = xy(x + 0.5 - px, y + 0.5 - py);
      const r = sqrt(c[0] * c[0] + c[1] * c[1]);
      R[p] = r;
      TH[p] = atan2(c[1], c[0]);
      B[p] = r > 1e-6 ? (c[0] * cb[0] + c[1] * cb[1]) / r : 0;
      const t = B[p] + sqrt(B[p] * B[p] + S.Rb2);
      Q[p] = r / t;
    }
  }
  const { GQ } = S;
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++) {
      const x0 = x > 0 ? p - 1 : p, x1 = x < W - 1 ? p + 1 : p, y0 = y > 0 ? p - W : p, y1 = y < H - 1 ? p + W : p;
      const gx = (Q[x1] - Q[x0]) / (x1 - x0), gy = (Q[y1] - Q[y0]) / ((y1 - y0) / W);
      let g = sqrt(gx * gx + gy * gy);
      if (R[p] < 3) g = max(g, 1 / (sqrt(S.Rb2 + cb2) + 1e-5)); // across the pith the difference sees no slope
      GQ[p] = g + 1e-5;
    }
  }
}

// Wander of the ring boundaries, in rings, as a function of the angle and the age.
const WK = [2, 3, 4, 6, 9], WA = [0.24, 0.2, 0.15, 0.1, 0.06], WP = [0.7, 2.1, 4.0, 5.3, 1.2];
function wander(th, u) {
  let s = 0;
  for (let k = 0; k < 5; k++) s += WA[k] * sin(WK[k] * th + WP[k] + 2.4 * vn(u / (4 + WK[k]), 60 + k));
  return s;
}

function paintEvents(S, uLo, uN) {
  const ev = S.ev;
  let n = 0;
  // fire scars, one cell of 20 rings each, six cells in ten with a fire
  for (let c = floor(uLo / 20) - 1; c <= floor(uN / 20); c++) {
    if (hh(c, 41) >= 0.6) continue;
    const fire = c * 20 + floor(hh(c, 42) * 18), m = 3.5 + hh(c, 45) * 3;
    if (fire > uN || fire + m + 9 < uLo || n >= 6) continue;
    ev.sc[n * 8] = fire;
    ev.sc[n * 8 + 1] = hh(c, 43) * TAU - Math.PI;
    ev.sc[n * 8 + 2] = 0.7 + 0.35 * hh(c, 44);
    ev.sc[n * 8 + 3] = m;
    n++;
  }
  ev.nsc = n;
  n = 0;
  // radial checks: end at a ring, run inward, widest at the outer end
  for (let c = floor(uLo / 9) - 4; c <= floor(uN / 9); c++) {
    if (hh(c, 51) >= 0.6 || n >= 12) continue;
    const end = c * 9 + hh(c, 52) * 9, len = 9 + hh(c, 53) * 20;
    if (end > uN || end < uLo - 2) continue;
    ev.ck[n * 8] = end;
    ev.ck[n * 8 + 1] = hh(c, 54) * TAU - Math.PI;
    ev.ck[n * 8 + 2] = len;
    ev.ck[n * 8 + 3] = 1.5 + 1.2 * hh(c, 55);
    n++;
  }
  ev.nck = n;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  SD = S.seed;
  const k = S.knobs;
  const s3 = (cl(k[2], -1, 1) + 1) / 2, lean = (cl(k[3], -1, 1) + 1) / 2;
  SIG = 0.2 + 0.55 * s3;
  DSTR = 0.08 + 0.92 * s3;
  BOOM = 0.15 + 0.7 * s3;
  FROST = 0.01 + 0.12 * s3;
  geometry(S, lean);
  const sh = S.sh;
  paletteShift(k[0], sh);
  const uN = S.uN;

  // The depth table: age below the bark at every depth, and the ring width there.
  const { ud, rw } = S;
  let u = uN;
  ud[0] = 0;
  rw[0] = S0 * omega(uN);
  for (let j = 0; j < NJ; j++) {
    const x = j * DX;
    const w0 = S0 * cam(x) * omega(u);
    const uh = u - (0.5 * DX) / w0;
    const w1 = S0 * cam(x + 0.5 * DX) * omega(uh);
    u -= DX / w1;
    ud[j + 1] = uN - u;
    rw[j + 1] = S0 * cam(x + DX) * omega(u);
  }
  const uMin = u;

  // The colour table, rings iLo..iHi, 40 samples each, as a running sum.
  const iHi = floor(uN);
  let iLo = floor(uMin) - 4;
  if (iHi - iLo + 1 > MAXR) iLo = iHi - MAXR + 1;
  const nR = iHi - iLo + 1;
  const { cr, cg, cb, tmp2 } = S;
  const cE0 = [0, 0, 0], cE1 = [0, 0, 0], cLW = [0, 0, 0], cFR = [0, 0, 0];
  cr[0] = cg[0] = cb[0] = 0;
  for (let r = 0; r < nR; r++) {
    const i = iLo + r;
    const w = omega(i + 0.5);
    const dry = cl((0.85 - w) / 0.6, 0, 1), wet = cl((w - 1.2) / 1.0, 0, 1);
    const jit = 1 + 0.1 * (hh(i, 7) - 0.5);
    tint(BASE_E0, dry, wet, jit, tmp2); shift(tmp2, sh, cE0, 0);
    tint(BASE_E1, dry, wet, jit, tmp2); shift(tmp2, sh, cE1, 0);
    tint(BASE_LW, dry, wet, jit, tmp2); shift(tmp2, sh, cLW, 0);
    tint(BASE_FR, dry, wet, jit, tmp2); shift(tmp2, sh, cFR, 0);
    const phs = cl(0.8 - 0.22 * dry + 0.04 * wet + 0.1 * (hh(i, 8) - 0.5), 0.5, 0.88);
    const frost = hh(i, 9) < FROST ? 1 : 0, phf = 0.3 + 0.35 * hh(i, 10);
    for (let s = 0; s < NS; s++) {
      const ph = (s + 0.5) / NS;
      const te = pow(sm(0, 1, min(ph / phs, 1)), 1.3);
      const m = sm(phs - 0.02, phs + 0.02, ph);
      const late = 1 + 0.18 * sm(0.93, 1, ph);
      const fb = frost ? 0.8 * exp(-(((ph - phf) / 0.09) ** 2)) : 0;
      const o = r * NS + s + 1;
      for (let c = 0; c < 3; c++) {
        let v = mix(mix(cE0[c], cE1[c], te), cLW[c] * late, m);
        v = mix(v, cFR[c], fb);
        const arr = c === 0 ? cr : c === 1 ? cg : cb;
        arr[o] = arr[o - 1] + v / NS;
      }
    }
  }

  // The mean colour of the rings, at the middle of each ring: (1, 2, 1) over three rings, each weighted by its
  // width, since a wide ring is more wood than a narrow one.
  const { mr, mg, mb, ow } = S;
  for (let r = 0; r < nR; r++) {
    const wgt = omega(iLo + r + 0.5);
    ow[r] = wgt;
    mr[r] = (cr[(r + 1) * NS] - cr[r * NS]) * wgt;
    mg[r] = (cg[(r + 1) * NS] - cg[r * NS]) * wgt;
    mb[r] = (cb[(r + 1) * NS] - cb[r * NS]) * wgt;
  }
  for (let r = 0, a0 = mr[0], a1 = mg[0], a2 = mb[0], a3 = ow[0]; r < nR; r++) {
    const n = min(r + 1, nR - 1);
    const b0 = mr[r], b1 = mg[r], b2 = mb[r], b3 = ow[r];
    const den = a3 + 2 * b3 + ow[n];
    mr[r] = (a0 + 2 * b0 + mr[n]) / den;
    mg[r] = (a1 + 2 * b1 + mg[n]) / den;
    mb[r] = (a2 + 2 * b2 + mb[n]) / den;
    a0 = b0; a1 = b1; a2 = b2; a3 = b3;
    ow[r] = b3;
  }

  paintEvents(S, uMin, uN);
  const ev = S.ev;
  const rim = [0, 0, 0];
  shift(BASE_RIM, [sh[0] * 0.5, mix(1, sh[1], 0.5), mix(1, sh[2], 0.5)], rim, 0);
  const bark = [0, 0, 0];
  shift(BARK, sh, bark, 0);
  // The bark shows at the corners when the newest rings are narrow, a few LEDs deep in a drought, none in a good year.
  const barkW = 4.5 * (1 - sm(0.55, 1.15, omega(uN)));

  const { R, TH, Q, GQ } = S;
  const uOff = uN - iLo;
  const TS = nR * NS;
  const chartAt = (arr, t) => {
    if (t <= 0) return 0;
    if (t >= TS) return arr[TS];
    const j = floor(t), f = t - j;
    return arr[j] + (arr[j + 1] - arr[j]) * f;
  };

  for (let p = 0, yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++, p++) {
      const q = Q[p], th = TH[p];
      const xn = (1 - q) * XR;
      let r, g, b;
      const xc = max(xn, 0);
      const jf = xc / DX, j = min(floor(jf), NJ - 1), fr = jf - j;
      const d0 = ud[j] + (ud[j + 1] - ud[j]) * fr;
      const rwn = rw[j] + (rw[j + 1] - rw[j]) * fr;
      const ringW = rwn / (XR * GQ[p]); // LEDs per ring here
      const uAge = uN - d0;
      // wander, plus callus rolled over the lips of a fire scar
      let off = wander(th, uAge) * sm(2, 10, R[p]);
      let scarMask = 0, scarRim = 0, scarIn = 0;
      for (let e = 0; e < ev.nsc; e++) {
        const fire = ev.sc[e * 8], m = ev.sc[e * 8 + 3], th0 = ev.sc[e * 8 + 1], dl = ev.sc[e * 8 + 2];
        if (uAge < fire - 2 || uAge > fire + m + 6) continue;
        let da = th - th0;
        if (da > Math.PI) da -= TAU; else if (da < -Math.PI) da += TAU;
        const open = cl(1 - (uAge - fire) / m, 0, 1);
        // the wedge is about one ring wide at its base and closes from both lips
        const halfL = dl * ringW * pow(open, 1.25);
        const tl = abs(da) * R[p]; // LEDs from the scar's line
        const lip = (tl - halfL) / (0.9 * ringW);
        off += -0.5 * exp(-lip * lip) * sm(fire - 0.2, fire + 1.6, uAge) * (1 - sm(fire + m, fire + m + 5, uAge)) * (halfL > 0.5 ? 1 : 0.6);
        if (uAge >= fire - 0.1 && uAge <= fire + m) {
          const sideD = halfL - tl; // LEDs inside the wedge sides
          const baseD = (uAge - fire) * ringW; // LEDs above the charred base
          const tipD = (fire + m - uAge) * ringW * 0.5;
          const sd = min(sideD, baseD, tipD);
          const fade = sm(37, 28, xn);
          const mk = sm(-0.7, 0.7, sd) * fade * sm(0.6, 1.8, halfL);
          const rmv = exp(-(((sd + 0.2) / 1.1) ** 2)) * fade * sm(0.6, 1.8, halfL);
          if (mk > scarMask) { scarMask = mk; scarIn = sd; }
          if (rmv > scarRim) scarRim = rmv;
        }
      }
      const uu = uAge + off;
      // The filter window grows from 1.1 LEDs to 2.3 as the rings narrow, then the picture goes over to the mean.
      const du = (1.1 + 1.2 * sm(4, 2.2, ringW)) / ringW;
      let da = uN - uu - 0.5 * du, db = uN - uu + 0.5 * du;
      if (da < 0) { db -= da; da = 0; }
      const ta = (uOff - db) * NS, tb = (uOff - da) * NS;
      const inv = NS / ((tb - max(ta, 0)) || 1e-6);
      r = (chartAt(cr, tb) - chartAt(cr, ta)) * inv;
      g = (chartAt(cg, tb) - chartAt(cg, ta)) * inv;
      b = (chartAt(cb, tb) - chartAt(cb, ta)) * inv;
      const wm = sm(2.6, 1.6, ringW);
      if (wm > 0) {
        const tm = cl(uOff - (uN - uu) - 0.5, 0, nR - 1.001), i0 = floor(tm), f0 = tm - i0;
        r = mix(r, mix(mr[i0], mr[i0 + 1], f0), wm);
        g = mix(g, mix(mg[i0], mg[i0 + 1], f0), wm);
        b = mix(b, mix(mb[i0], mb[i0 + 1], f0), wm);
      }
      // grain along the rings, only where the rings are resolved
      const gr = 1 + 0.05 * sm(2.2, 3.8, ringW) * vn(th * 12 + uu * 7.3, 71);
      r *= gr; g *= gr; b *= gr;

      // resin canals: short darker streaks along the earlywood of the wider rings
      if (ringW > 3.6) {
        const i0 = floor(uAge), ph = uAge - i0;
        if (ph > 0.1 && ph < 0.6) {
          for (let c = 0; c < 2; c++) {
            if (hh(i0, 120 + c) < 0.45) continue;
            let dc = th - (hh(i0, 122 + c) * TAU - Math.PI);
            if (dc > Math.PI) dc -= TAU; else if (dc < -Math.PI) dc += TAU;
            const a = (1 - sm(1.6, 3, abs(dc) * R[p])) * (1 - sm(0.5, 1.3, abs(ph - 0.3) * ringW)) * 0.17 * sm(3.6, 5, ringW);
            if (a > 0) { r *= 1 - a; g *= 1 - a * 1.15; b *= 1 - a * 1.3; }
          }
        }
      }

      // radial checks
      for (let e = 0; e < ev.nck; e++) {
        const end = ev.ck[e * 8], len = ev.ck[e * 8 + 2];
        if (uAge > end || uAge < end - len) continue;
        let da2 = th - ev.ck[e * 8 + 1] - 0.006 * sin(uAge * 0.5);
        if (da2 > Math.PI) da2 -= TAU; else if (da2 < -Math.PI) da2 += TAU;
        const tp = pow(cl(1 - (end - uAge) / len, 0, 1), 0.8);
        const hw = 0.5 * (0.9 + ev.ck[e * 8 + 3] * tp); // half width in LEDs, 0.45 at the inner end to 1.7 at the outer
        const dist = abs(da2) * R[p];
        const a = (1 - sm(hw * 0.5, hw + 0.8, dist)) * sm(0.05, 0.3, tp) * sm(34, 25, xn) * (1 - sm(end - 0.3, end, uAge)) * 0.55;
        if (a > 0) {
          r = mix(r, 0.2, a); g = mix(g, 0.1, a); b = mix(b, 0.05, a);
        }
      }
      if (scarRim > 0) {
        const a = 0.8 * scarRim;
        r = mix(r, rim[0], a); g = mix(g, rim[1], a); b = mix(b, rim[2], a);
      }
      if (scarMask > 0) {
        // charcoal, with an ember glow just inside the lips and lumps in it
        const glow = exp(-max(scarIn, 0) / 1.8) * 0.55, lump = 0.8 + 0.4 * (0.5 + 0.5 * vn(xx * 0.45 + yy * 0.3, 90));
        const cr0 = mix(CHAR[0] * lump, rim[0] * 0.55, glow), cg0 = mix(CHAR[1] * lump, rim[1] * 0.45, glow), cb0 = mix(CHAR[2] * lump, rim[2] * 0.4, glow);
        r = mix(r, cr0, scarMask); g = mix(g, cg0, scarMask); b = mix(b, cb0, scarMask);
      }
      if (xn < barkW + 0.6) {
        // bark at the corners: furrows run along the radius, ridges between them
        const bm = sm(barkW + 0.6, barkW - 0.6, xn);
        const fz = 0.55 + 0.45 * sm(-0.2, 0.5, vn(th * 16 + uAge * 0.15, 80));
        r = mix(r, bark[0] * fz, bm); g = mix(g, bark[1] * fz, bm); b = mix(b, bark[2] * fz, bm);
      }
      // the cut face is lit a little from the upper left
      const lt = 255 * (1.05 - 0.1 * (xx * 0.45 / W + yy * 0.55 / H));
      display.setPixel(xx, yy, min(255, r * lt), min(255, g * lt), min(255, b * lt));
    }
  }
}
