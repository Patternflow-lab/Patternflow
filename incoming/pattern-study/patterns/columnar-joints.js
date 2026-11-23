// ===== Patternflow pattern =====
// Title:   Columnar Joints
// Family:  columnarjoint
// Idea:    A vertical section through a basalt lava flow: grey-blue prisms run down the panel and merge into fewer, wider ones as they go deeper, until their cracks glow orange where the cooling front sits near the bottom, while the whole rock slowly sinks into it and a new flow, with new narrow prisms, comes in over a rust-red seam at the top.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 228, after the columnar jointing of cooling basalt at the Giant's Causeway and Devils Postpile
// Round:   230
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sink=0.2..4, Width=-1..1, Heat=-1..1
//
// Knob 1: Hue. The colour of the glow and of the rock turn together; at 0 an orange front on blue-grey rock.
// Knob 2: Sink. How fast the section sinks and the front wanders; at 2 a prism takes about a minute to cross the panel.
// Knob 3: Width. Prisms narrower at -1 and wider at 1, about four LEDs across at the top and eight at the bottom for the first, nine and twenty for the other.
// Knob 4: Heat. How much of the front shows through: at -1 only the last cracks above it are dull red, at 1 the cracks burn orange a third of the panel up and the front is white at its core.

const W = 64, H = 128;
const { min, max, floor, sin, cos, sqrt, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}
const vn1 = (x, s) => {
  const xi = floor(x), u = x - xi;
  return mix(hash(xi, s), hash(xi + 1, s), u * u * (3 - 2 * u));
};
function hsv(out, h, s, v) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  out[0] = 255 * (m === 0 ? v : m === 1 ? q : m === 2 ? p : m === 3 ? p : m === 4 ? t : v);
  out[1] = 255 * (m === 0 ? t : m === 1 ? v : m === 2 ? v : m === 3 ? q : m === 4 ? p : p);
  out[2] = 255 * (m === 0 ? p : m === 1 ? p : m === 2 ? t : m === 3 ? v : m === 4 ? v : q);
}

// The crack network lives in a world wider than the panel, in reference LEDs;
// Width scales it about the middle at draw time, so a knob turn shows at once.
const XL = -24, XR = 88, RING = 256, GMIN = 2.2;
const BASE = 4.2; // reference column width at a flow's surface, in LEDs
const LEN = 190; // rows over which the width grows by e
const FRONT = 98; // where the front sits on average, in rows from the top

function newCrack(P, e, x) {
  const c = { id: ++P.nid, r: new Float32Array(RING), lo: e, hi: Infinity, x, vx: 0, mode: 0, tip: false, th: 1.35 + 0.45 * rnd(), busy: -1e9, nx: x, age: 0, par: null, sgn: 0, gt: 0, Lf: 0, x0: 0 };
  c.r[e & (RING - 1)] = x;
  P.open.push(c);
  P.ren.push(c);
  return c;
}

// A flow: it is cracked from its surface (depth 0) down to its base (depth D).
// The generator climbs from the base to the surface, so a column is born as a
// crack forks, and read downwards that is a column narrowing to a point.
function startUnit(P, eb, dStart) {
  const D = dStart > 0 ? dStart + 30 + 40 * rnd() : 160 + 45 * rnd();
  const d0 = dStart > 0 ? dStart : D;
  const U = (P.u = { et: eb + d0, D, wt: 0.88 + 0.24 * rnd() });
  const g0 = BASE * U.wt * exp(d0 / LEN);
  P.open.length = 0;
  let x = XL + rnd() * g0;
  while (x < XR) {
    newCrack(P, eb, x);
    x += g0 * (0.8 + 0.4 * rnd());
  }
  P.eg = eb;
}

function genRow(P) {
  const ne = P.eg + 1;
  if (P.seam > 0) {
    P.seam--;
    P.eg = ne;
    if (P.seam === 0) P.fresh = true;
    return;
  }
  if (P.fresh) {
    P.fresh = false;
    startUnit(P, ne, 0);
    return;
  }
  const U = P.u, oc = P.open;
  if (ne > U.et) {
    // The surface: every crack ends under the rust-red seam.
    for (const c of oc) c.hi = U.et;
    oc.length = 0;
    const SH = 5 + floor(4 * rnd());
    P.seams.push({ e0: U.et, e1: U.et + SH, seed: floor(rnd() * 1000) });
    P.seam = SH;
    genRow(P);
    return;
  }
  const d = U.et - ne, wt = BASE * U.wt * exp(d / LEN), n = oc.length;
  // Free cracks wander and level the column widths a little.
  for (let i = 0; i < n; i++) {
    const c = oc[i];
    if (c.mode !== 0) continue;
    let f = 0;
    if (i > 0 && i < n - 1) f = 0.02 * (oc[i + 1].x - c.x - (c.x - oc[i - 1].x));
    c.vx = cl(c.vx * 0.95 + (rnd() - 0.5) * 0.026 + f, -0.16, 0.16);
    c.nx = c.x + c.vx;
    if (c.nx < XL) ((c.nx = XL + (XL - c.nx)), (c.vx = abs(c.vx)));
    if (c.nx > XR) ((c.nx = XR - (c.nx - XR)), (c.vx = -abs(c.vx)));
  }
  for (let i = 0; i < n; i++) {
    const c = oc[i];
    if (c.mode === 1) {
      c.age++;
      c.nx = c.par.nx + c.sgn * c.gt * sm(0, 1, c.age / c.Lf);
      if (c.age >= c.Lf) ((c.mode = 0), (c.vx = c.nx - c.x));
    } else if (c.mode === 2) {
      c.age++;
      c.nx = mix(c.x0, c.par.nx, sm(0, 1, c.age / c.Lf));
    }
  }
  for (let i = 0; i < n; i++) oc[i].x = oc[i].nx;
  oc.sort((a, b) => a.x - b.x);
  for (let i = 0; i + 1 < n; i++) {
    const a = oc[i], b = oc[i + 1];
    if (b.x - a.x < GMIN && a.mode === 0 && b.mode === 0) {
      const m = (a.x + b.x) / 2;
      a.x = m - GMIN / 2;
      b.x = m + GMIN / 2;
    }
  }
  for (let i = oc.length - 1; i >= 0; i--) {
    const c = oc[i];
    c.r[ne & (RING - 1)] = c.x;
    if (c.mode === 2 && c.age >= c.Lf) {
      c.hi = ne;
      oc.splice(i, 1);
    }
  }
  // Wide columns split by a fork or a new tip; narrow ones close up.
  for (let i = 0; i + 1 < oc.length; i++) {
    const a = oc[i], b = oc[i + 1];
    if (a.busy > ne || b.busy > ne || a.mode || b.mode) continue;
    const g = b.x - a.x, rho = g / wt;
    if (rho > a.th && rnd() < 0.18) {
      const L = 14 + 10 * rnd(), r = rnd();
      if (r < 0.62) {
        const sgn = rnd() < 0.5 ? 1 : -1, par = sgn > 0 ? a : b;
        const c = newCrack(P, ne, par.x);
        c.mode = 1;
        c.par = par;
        c.sgn = sgn;
        c.gt = g * (0.42 + 0.16 * rnd());
        c.Lf = L;
        c.nx = par.x;
        a.busy = b.busy = c.busy = ne + L + 8;
        a.th = 1.35 + 0.45 * rnd();
        c.th = 1.35 + 0.45 * rnd();
      } else {
        const c = newCrack(P, ne, (a.x + b.x) / 2 + (rnd() - 0.5) * g * 0.12);
        c.tip = true;
        a.busy = b.busy = c.busy = ne + 18;
        a.th = 1.35 + 0.45 * rnd();
        c.th = 1.35 + 0.45 * rnd();
      }
      oc.sort((p, q) => p.x - q.x);
      i++;
    } else if (rho < 0.56 && rnd() < 0.2) {
      const moving = rnd() < 0.5 ? b : a, par = moving === b ? a : b;
      moving.mode = 2;
      moving.par = par;
      moving.x0 = moving.x;
      moving.age = 0;
      moving.Lf = 14 + 8 * rnd();
      moving.busy = par.busy = ne + moving.Lf + 8;
    }
  }
  P.eg = ne;
}

export function setup(params) {
  const P = (params.s = { E: 0, eg: 0, nid: 0, open: [], ren: [], seams: [], seam: 0, fresh: false, u: null, tm: 0, t: 0, k: [0, 2, 0, 0.06], lut: new Float32Array(167 * 3), pos: new Float32Array(48), tw: new Float32Array(48), idc: new Int32Array(48), hw: new Float32Array(48) });
  // The picture opens with the top of a flow at the top of the panel.
  startUnit(P, -H - 8, H + 8 + 4);
  while (P.eg < 4) genRow(P);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = (P.k = input.knobValues || P.k);
  dt = cl(dt || 0, 0, 0.1);
  P.t += dt;
  P.tm += (dt * k[1]) / 2;
  P.E += dt * 0.9 * k[1];
  while (P.eg < P.E + 3) genRow(P);
  // Forget what has sunk out of sight.
  const low = P.E - H - 6;
  if (P.ren.length > 40) P.ren = P.ren.filter((c) => c.hi >= low);
  P.seams = P.seams.filter((s) => s.e1 >= low);
}

const rock = [0, 0, 0], glow = [0, 0, 0], seamC = [0, 0, 0];
const EXP = new Float32Array(257).map((_, i) => exp(-i / 48));

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const k = P.k, tm = P.tm, t = P.t, E = P.E;
  const hue = 0.058 + 0.92 * cl(k[0], 0, 1) + 0.014 * sin(tm * 0.043 + 1) + 0.01 * sin(tm * 0.0171 + 4);
  const sc = 1.15 * exp(0.3 * cl(k[2], -1, 1));
  const heat = cl(k[3], -1, 1);
  // Glow by temperature: dull red, red-orange, orange, hot yellow-white.
  const STOPS = [[0, -0.045, 1, 0], [0.12, -0.04, 1, 0.2], [0.35, -0.022, 1, 0.55], [0.7, 0.004, 1, 0.92], [1, 0.03, 0.92, 1], [1.3, 0.075, 0.6, 1]];
  const lut = P.lut, tmp = [0, 0, 0];
  for (let q = 0, s = 0; q <= 166; q++) {
    const T = q / 128;
    while (s < 4 && T > STOPS[s + 1][0]) s++;
    const a = STOPS[s], b = STOPS[s + 1], u = (T - a[0]) / (b[0] - a[0]);
    hsv(tmp, hue + mix(a[1], b[1], u), mix(a[2], b[2], u), mix(a[3], b[3], u));
    lut[q * 3] = tmp[0];
    lut[q * 3 + 1] = tmp[1];
    lut[q * 3 + 2] = tmp[2];
  }
  const rockHue = hue + 0.53 + 0.03 * sin(tm * 0.031 + 2.5) + 0.02 * sin(tm * 0.0113);
  hsv(rock, rockHue, 0.22, 0.46);
  hsv(seamC, hue - 0.025, 0.55, 0.42);
  // The front: a slow wander, deeper when the heat is turned up.
  const yf = FRONT + 7 * sin(tm * 0.021) + 4.5 * sin(tm * 0.0073 + 1.9) + 2.5 * sin(tm * 0.047 + 0.4);
  const span = 28 + 14 * heat;
  const hk = 0.62 + 0.4 * heat;

  const { pos, tw, idc, hw } = P;
  const seams = P.seams;
  for (let y = 0; y < H; y++) {
    const e = E - (y + 0.5), i0 = floor(e), fr = e - i0;
    let n = 1;
    pos[0] = -1000;
    idc[0] = 0;
    tw[0] = 0;
    for (const c of P.ren) {
      if (c.lo > i0 || c.hi < i0 + 1) continue;
      const x = mix(c.r[i0 & (RING - 1)], c.r[(i0 + 1) & (RING - 1)], fr);
      let w = 1;
      if (c.tip) w = 0.1 + 0.9 * sm(0, 1, (e - c.lo) / 14);
      // insertion sort by x
      let j = n++;
      const X = 32 + (x - 32) * sc;
      while (j > 1 && pos[j - 1] > X) {
        pos[j] = pos[j - 1];
        idc[j] = idc[j - 1];
        tw[j] = tw[j - 1];
        j--;
      }
      pos[j] = X;
      idc[j] = c.id;
      tw[j] = w;
    }
    pos[n] = 1000;
    idc[n] = 0;
    tw[n] = 0;
    // Crack half-widths grow with the columns they separate.
    for (let j = 1; j < n; j++) {
      const gl = pos[j] - (j > 1 ? pos[j - 1] : pos[j] - 6), gr = (j < n - 1 ? pos[j + 1] : pos[j] + 6) - pos[j];
      hw[j] = (0.5 + 0.026 * (gl + gr)) * tw[j] * (0.85 + 0.3 * vn1(e * 0.07 + idc[j] * 13.1, idc[j]));
    }
    hw[0] = hw[n] = 0;
    let a = 0;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      while (pos[a + 1] <= px) a++;
      const b = a + 1, id = idc[a];
      const xl = pos[a] + hw[a], xr = pos[b] - hw[b];
      const u = xr - xl > 0.5 ? cl((px - xl) / (xr - xl), 0, 1) : 0.5;
      const dl = px - pos[a] - hw[a], dr = pos[b] - hw[b] - px;
      const cov = max(cl(0.5 - dl, 0, 1), cl(0.5 - dr, 0, 1));
      // A column is a rounded prism lit from the upper left.
      const nr = 2 * u - 1, z = sqrt(max(0, 1 - 0.9 * nr * nr));
      const shade = 0.36 + 0.7 * max(0, -0.38 * nr + 0.92 * z);
      const vc = 0.84 + 0.3 * hash(id, 5);
      const chisel = 1 + 0.2 * (vn1(e * 0.19 + hash(id, 9) * 40, id) - 0.5) + 0.1 * (vn1(e * 0.47 + hash(id, 11) * 40, id + 7) - 0.5);
      const kk = shade * vc * chisel;
      let r = rock[0] * kk, g = rock[1] * kk, bl = rock[2] * kk;
      // Heat: each column's front sits a little differently. The cracks are
      // lit well above it, the prism faces only at and below it.
      const yfc = yf + (hash(id, 3) - 0.5) * 12 + 5 * (vn1(px * 0.07 + tm * 0.05, 3) - 0.5) + 5.5 * z * z, yy = y + 0.5;
      const Tf = sm(yfc - 5, yfc + 14, yy), Tl = sm(yfc - span - 5.5 * z * z, yfc + 10, yy) ** 1.5, Td = sm(yfc + 2, yfc + 36, yy);
      let Tcr = 0;
      if (Tl > 0.01) {
        const Tc = cl(0.1 * Tl + 0.3 * Tf + 0.2 * Td + 0.04 * (hash(id, 4) - 0.5), 0, 1);
        const q = ((Tc * 128) | 0) * 3, ms = sm(0.02, 0.2, Tc), lm = 0.45 + 0.55 * shade;
        r = mix(r, lut[q] * lm, ms);
        g = mix(g, lut[q + 1] * lm, ms);
        bl = mix(bl, lut[q + 2] * lm, ms);
        const fl = 0.16 * (vn(px * 0.3 + tm * 0.45, e * 0.2 + tm * 1.1) - 0.5) + 0.1 * (vn(px * 0.19 + 7, e * 0.33 - tm * 0.8) - 0.5);
        Tcr = cl(Tl * hk + 0.25 * Tf + fl * 3 * Tl, 0, 1.3);
        if (Tcr > 0.02) {
          const dm = min(max(dl, 0), max(dr, 0)), hl = EXP[min(256, (dm * 70) | 0)] * sm(0.04, 0.4, Tcr) * 0.34;
          const qq = ((Tcr * 128) | 0) * 3;
          r += lut[qq] * hl;
          g += lut[qq + 1] * hl;
          bl += lut[qq + 2] * hl;
        }
      }
      if (cov > 0) {
        const qq = ((Tcr * 128) | 0) * 3, m = sm(0, 0.25, Tcr);
        r = mix(r, mix(9, lut[qq], m), cov);
        g = mix(g, mix(8, lut[qq + 1], m), cov);
        bl = mix(bl, mix(14, lut[qq + 2], m), cov);
      }
      // The seam between two flows, where the old surface weathered red.
      for (let s = 0; s < seams.length; s++) {
        const S = seams[s];
        if (e < S.e0 - 5 || e > S.e1 + 6) continue;
        // The edges only bulge outwards, so no bare strip is left where the
        // cracks of one flow end and those of the next have not begun.
        const w0 = vn1(x * 0.13 + S.seed, S.seed) * 3.6, w1 = vn1(x * 0.1 + S.seed * 2, S.seed + 1) * 3.6;
        const sa = cl(min(e - (S.e0 - 0.2 - w0), S.e1 + 1.5 + w1 - e) * 1.3 + 0.5, 0, 1);
        if (sa <= 0) continue;
        const mo = 0.74 + 0.5 * vn(x * 0.22 + S.seed, e * 0.45);
        let sr = seamC[0] * mo, sg = seamC[1] * mo, sb = seamC[2] * mo;
        if (Tl > 0.01) {
          const Tc = cl(0.1 * Tl + 0.45 * Tf, 0, 1), q = ((Tc * 128) | 0) * 3, ms = sm(0.03, 0.3, Tc);
          sr = mix(sr, lut[q] * 0.8, ms);
          sg = mix(sg, lut[q + 1] * 0.8, ms);
          sb = mix(sb, lut[q + 2] * 0.8, ms);
        }
        r = mix(r, sr, sa);
        g = mix(g, sg, sa);
        bl = mix(bl, sb, sa);
      }
      display.setPixel(x, y, min(255, r) | 0, min(255, g) | 0, min(255, bl) | 0);
    }
  }
}
