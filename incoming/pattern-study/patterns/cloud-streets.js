// ===== Patternflow pattern =====
// Title:   Cloud Streets
// Family:  cloudstreet
// Idea:    A satellite looking straight down on a cold wind blowing off the ice over a warm sea: the air upwind is clear and dark, then convection lines up in rolls along the wind and the sky fills with parallel white streets of soft cumulus puffs that grow, drift downwind and thin out, until further downwind the streets break into open cells, rings of cloud round clear holes, with a bright upper-left edge on every cloud and a blue shadow on the sea to its lower right.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: horizontal convective rolls and the cloud streets they make (Kuettner, 1959 and 1971; Brown, 1970; Etling and Brown, 1993, all from memory); open and closed mesoscale cellular convection in cold-air outbreaks over warm water (Agee, Chen and Dowell, 1973; Atkinson and Zhang, 1996, both from memory); the prescribed roll field with meander and sub-harmonic street merging, the puff life cycle, the Voronoi rim spawn for open cells and the drawing are original, pattern round 249
// Round:   249
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Breakup=0..4, Spacing=-1..1, Wind=-1..1
//
// Knob 1: Hue. Turns the tint of the sea, the cloud shadows and the sky round the wheel while the cloud tops stay near white; it opens on deep blue and teal.
// Knob 2: Breakup. 0 to 4, opening at 2. Where the streets turn into open cells: at 0 the streets run the whole panel, at 2 the top third is rings of cloud round clear holes, at 4 the cells begin near the middle.
// Knob 3: Spacing. -1 to 1, opening at 0. The distance between streets, 9 LED apart at -1 (and the cells smaller), 15 at 0, 26 at 1 (and the cells wide).
// Knob 4: Wind. -1 to 1, opening at about 0.06. The angle of the wind from straight up the panel, 55 degrees to the left at -1 and 55 degrees to the right at 1, so the streets lean; it also wanders a few degrees by itself.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const CX = 32, CY = 64;       // the middle of the panel, the origin of the wind frame
const RD = 80;                // radius of the disc the puffs live in, so any wind angle is covered
const SC = -42;               // condensation line: 22 LED of clear sea above the upwind edge (s = -64)
const NMAX = 400;             // hard cap on live puffs
const NT = 440;             // the count the spawn rate steers to
const MEANLIFE = 12;          // the live time the spawn rate is sized for, a little under the mean life because puffs also leave the disc
const HS = 0.8660254;         // row spacing of the hex lattice

// ---- helpers ---------------------------------------------------------------
function h2(i, j, k) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- state -----------------------------------------------------------------
export function setup(params) {
  const ph = new Float64Array(16);
  for (let i = 0; i < 16; i++) ph[i] = rnd() * TP;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    t: 0, vint: 0, acc: 0, n: 0, ph,
    // environment, refreshed every step
    ca: 1, sa: 0, V: 5.6, lam0: 15, D: 27, sb: 40,
    // the puffs, struct of arrays
    kind: new Uint8Array(NMAX), pa: new Float32Array(NMAX), s: new Float32Array(NMAX),
    age: new Float32Array(NMAX), life: new Float32Array(NMAX), rad: new Float32Array(NMAX), amp: new Float32Array(NMAX),
    lx: new Float32Array(NMAX), ly: new Float32Array(NMAX), lx2: new Float32Array(NMAX), ly2: new Float32Array(NMAX),
    cj: new Float32Array(NMAX), cf: new Float32Array(NMAX), cp: new Float32Array(NMAX),
    g: new Float32Array(W * H),
  });
  return st;
}

// ---- the prescribed fields -----------------------------------------------------
// roll phase offset: the streets meander along the wind and breathe in time, a little more downwind than upwind
function phiOf(st, s, t) {
  const p = st.ph;
  const m = 0.5 + 0.5 * sstep(SC, 50, s);
  return m * (1.35 * sin(0.042 * s + 0.047 * t + p[4]) + 0.8 * sin(0.0931 * s - 0.0293 * t + p[5]) + 0.5 * sin(0.0171 * s + 0.0111 * t + p[6]));
}
// street spacing, a few percent different from one end to the other so streets drift together and apart
function lamOf(st, s, t) {
  const p = st.ph;
  return st.lam0 * (1 + 0.07 * sin(0.0271 * s + 0.0083 * t + p[7]) + 0.035 * sin(0.0743 * s - 0.0151 * t + p[8]));
}
// half-spacing modulation: alternate streets swell and fade, so pairs merge and new ones appear
function psiOf(st, s, t) {
  const p = st.ph;
  return 2.4 * sin(0.0215 * s + 0.0137 * t + p[9]) + 1.5 * sin(0.0071 * s - 0.0173 * t + p[10]);
}
// open-cell rim weight: near 1 on the edges of a jittered hex lattice that rides the wind, 0 in the holes
function rim(st, c, s, t) {
  const D = st.D;
  const u = c / D, w = (s - st.vint) / D;
  const jr = Math.round(w / HS);
  let d1 = 9, d2 = 9;
  for (let j = jr - 2; j <= jr + 2; j++) {
    const off = (j & 1) * 0.5;
    const ic = Math.round(u - off);
    for (let i = ic - 1; i <= ic + 1; i++) {
      const hx = h2(i, j, 1), hy = h2(i, j, 2), hp = h2(i, j, 3);
      const sx = i + off + 0.4 * (hx - 0.5) + 0.08 * sin(0.019 * t + TP * hp);
      const sy = j * HS + 0.4 * (hy - 0.5) + 0.08 * sin(0.0143 * t + TP * hy + 1);
      const dx = u - sx, dy = w - sy;
      const d = sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  const e = (d2 - d1) * D;
  return exp(-(e * e) / 24);
}
// how far into the cell regime a height along the wind is
function cellMix(st, s) {
  return sstep(st.sb - 12, st.sb + 12, s);
}
// cross-wind position of a puff
function crossOf(st, i, s, t) {
  const jit = st.cj[i] * sin(st.cf[i] * t + st.cp[i]);
  if (st.kind[i] === 1) return st.pa[i] * st.D + jit;
  return lamOf(st, s, t) * (st.pa[i] - phiOf(st, s, t)) / TP + jit;
}

// ---- the model -------------------------------------------------------------
function env(st, dtSmooth) {
  const ks = st.ks, k = st.k, t = st.t, p = st.ph;
  const a = dtSmooth >= 1 ? 1 : 1 - exp(-dtSmooth / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  const b = cl(ks[1] / 4, 0, 1);
  st.sb = 85 - 139 * b + 58 * b * b;
  const k3 = cl(ks[2], -1, 1);
  st.lam0 = k3 >= 0 ? 15 * pow(26 / 15, k3) : 15 * pow(9 / 15, -k3);
  st.D = 1.8 * st.lam0;
  const ang = (cl(ks[3], -1, 1) * 55 + 4 * sin(0.0173 * t + p[0]) + 2.2 * sin(0.00571 * t + p[1])) * (PI / 180);
  st.ca = cos(ang); st.sa = sin(ang);
  st.V = 5.6 + 1.2 * sin(0.0213 * t + p[2]) + 0.6 * sin(0.00717 * t + p[3]);
}

function kill(st, i) {
  const n = --st.n;
  if (i === n) return;
  st.kind[i] = st.kind[n]; st.pa[i] = st.pa[n]; st.s[i] = st.s[n]; st.age[i] = st.age[n]; st.life[i] = st.life[n];
  st.rad[i] = st.rad[n]; st.amp[i] = st.amp[n]; st.lx[i] = st.lx[n]; st.ly[i] = st.ly[n]; st.lx2[i] = st.lx2[n]; st.ly2[i] = st.ly2[n];
  st.cj[i] = st.cj[n]; st.cf[i] = st.cf[n]; st.cp[i] = st.cp[n];
}

function spawn(st) {
  const t = st.t;
  for (let tr = 0; tr < 60; tr++) {
    const c = (rnd() * 2 - 1) * RD;
    const s = SC + rnd() * (RD - SC);
    if (c * c + s * s > RD * RD) continue;
    const ramp = sstep(SC, SC + 7, s);
    const bb = cellMix(st, s);
    // spawn is thickest at the condensation line; the cells spawn where they are
    const gs = ramp * (0.2 + 0.8 * exp(-(s - SC) / 32));
    const gc = ramp * 0.6;
    // aim the spawns at what the panel can see, a little less at the rest of the disc
    const x = CX + c * st.ca + s * st.sa, y = CY + c * st.sa - s * st.ca;
    const see = x > -10 && x < W + 10 && y > -10 && y < H + 10 ? 1 : 0.3;
    const lam = lamOf(st, s, t);
    const Phi = TP * c / lam + phiOf(st, s, t);
    let ws = 0;
    const cs = cos(Phi);
    if (cs > 0) ws = pow(cs, cl(4 + (15 - lam) * 0.3, 3.2, 6)) * (0.62 + 0.38 * cos(0.5 * Phi + psiOf(st, s, t)));
    const w1 = (1 - bb) * ws * gs;
    const w2 = bb > 0.002 ? bb * 0.55 * rim(st, c, s, t) * gc : 0;
    const wt = w1 + w2;
    if (rnd() >= wt * see) continue;
    const i = st.n++;
    const kind = rnd() * wt < w2 ? 1 : 0;
    st.kind[i] = kind;
    st.pa[i] = kind === 1 ? c / st.D : Phi;
    st.s[i] = s;
    st.age[i] = 0;
    st.life[i] = 12 + 12 * rnd();
    const ls = cl(lam / 15, 0.6, 1.5);
    st.rad[i] = max(2.5, (2.9 + 2.5 * pow(rnd(), 0.8)) * (0.4 + 0.6 * ls));
    st.amp[i] = 0.75 + 0.45 * rnd();
    const a1 = rnd() * TP, a2 = a1 + 2.2 + 1.6 * rnd();
    st.lx[i] = cos(a1) * 0.62; st.ly[i] = sin(a1) * 0.62;
    st.lx2[i] = cos(a2) * 0.58; st.ly2[i] = sin(a2) * 0.58;
    st.cj[i] = (0.5 + 1.0 * rnd()) * (0.5 + 0.5 * ls);
    st.cf[i] = 0.12 + 0.2 * rnd();
    st.cp[i] = rnd() * TP;
    return;
  }
}

function step(st, dt) {
  st.t += dt;
  env(st, dt);
  const dv = st.V * dt;
  st.vint += dv;
  const t = st.t, R2 = RD * RD;
  for (let i = st.n - 1; i >= 0; i--) {
    st.age[i] += dt;
    st.s[i] += dv;
    const s = st.s[i];
    if (st.age[i] >= st.life[i] || s > RD) { kill(st, i); continue; }
    const c = crossOf(st, i, s, t);
    if (c * c + s * s > R2) kill(st, i);
  }
  const rate = (NT / MEANLIFE) * cl(1 + 1.4 * (NT - st.n) / NT, 0.15, 2.6);
  st.acc += rate * dt;
  while (st.acc >= 1) {
    st.acc -= 1;
    if (st.n < NMAX) spawn(st);
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    env(st, 1);
    // a minute of weather first, so the panel starts full and a knob at the start is seen at once
    for (let i = 0; i < 240; i++) step(st, 0.25);
  }
  if (dt > 0) step(st, dt);
}

// ---- drawing ---------------------------------------------------------------
// a soft bump, stretched rs along the wind and rc across it
function splat(g, x, y, rc, rs, a, ca, sa) {
  const R = max(rc, rs);
  const x0 = max(0, floor(x - R - 0.5)), x1 = min(W - 1, floor(x + R - 0.5) + 1);
  const y0 = max(0, floor(y - R - 0.5)), y1 = min(H - 1, floor(y + R - 0.5) + 1);
  const ic = 1 / (rc * rc), is = 1 / (rs * rs);
  for (let j = y0; j <= y1; j++) {
    const dy = j + 0.5 - y;
    const o = j * W;
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - x;
      const cc = dx * ca + dy * sa, ss = dx * sa - dy * ca;
      const q = cc * cc * ic + ss * ss * is;
      if (q < 1) { const m = 1 - q; g[o + i] += a * m * m; }
    }
  }
}
function samp(g, x, y) {
  let fx = x - 0.5, fy = y - 0.5;
  fx = fx < 0 ? 0 : fx > W - 1.001 ? W - 1.001 : fx;
  fy = fy < 0 ? 0 : fy > H - 1.001 ? H - 1.001 : fy;
  const i = floor(fx), j = floor(fy), tx = fx - i, ty = fy - j, o = j * W + i;
  return (g[o] * (1 - tx) + g[o + 1] * tx) * (1 - ty) + (g[o + W] * (1 - tx) + g[o + W + 1] * tx) * ty;
}

const seaD = [0, 0, 0], seaL = [0, 0, 0], shd = [0, 0, 0], glc = [0, 0, 0];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const g = st.g, t = st.t, ca = st.ca, sa = st.sa, p = st.ph;
  g.fill(0);
  // puffs into the density grid
  for (let i = 0; i < st.n; i++) {
    const s = st.s[i];
    const c = crossOf(st, i, s, t);
    const x = CX + c * ca + s * sa, y = CY + c * sa - s * ca;
    const a = st.age[i] / st.life[i];
    const rad = st.rad[i];
    if (x < -rad * 2 || x > W + rad * 2 || y < -rad * 2 || y > H + rad * 2) continue;
    // liquid water: swells fast, holds, then evaporates; street puffs also dissolve where the cells take over
    const am = pow(sin(PI * pow(a, 0.8)), 0.75) * st.amp[i] * (st.kind[i] === 0 ? 1 - cellMix(st, s) : 1);
    if (am < 0.02) continue;
    const r = rad * (0.55 + 0.45 * sstep(0, 0.22, a)) * (1 - 0.18 * sstep(0.6, 1, a));
    // street puffs are drawn longer along the wind than across it, cell rims are round
    const fc = st.kind[i] === 0 ? 0.82 : 1, fs = st.kind[i] === 0 ? 1.45 : 1;
    const rc = max(2.2, r * fc), rs = r * fs;
    splat(g, x, y, rc, rs, am, ca, sa);
    let ox = (st.lx[i] * rc) * ca + (st.ly[i] * rs) * sa, oy = (st.lx[i] * rc) * sa - (st.ly[i] * rs) * ca;
    splat(g, x + ox, y + oy, max(2.2, rc * 0.72), rs * 0.72, am * 0.8, ca, sa);
    ox = (st.lx2[i] * rc) * ca + (st.ly2[i] * rs) * sa; oy = (st.lx2[i] * rc) * sa - (st.ly2[i] * rs) * ca;
    splat(g, x + ox, y + oy, max(2.2, rc * 0.66), rs * 0.66, am * 0.7, ca, sa);
  }
  // palette: the sea and the cloud's shade side follow the hue knob, the cloud tops stay near white
  const hue = st.ks[0] + 0.575;
  // orange and yellow read as brown when dark on the panel, so the sea lifts as the hue nears them
  const wm = 0.5 + 0.5 * cos(TP * (hue - 0.08));
  const lift = 1 + 0.55 * wm * wm;
  hsv(hue, 0.9, 0.31 * lift, seaD);
  hsv(hue - 0.03, 0.82, 0.46 * lift, seaL);
  hsv(hue + 0.01, 0.3, 0.66, shd);
  hsv(hue + 0.02, 0.2, 1, glc);
  // wind frame of the sea patches: they drift with the wind at a third of its speed
  const vs = 0.33 * st.vint;
  // a few soft sun glints that wander in the clear sea
  const gl = [];
  for (let q = 0; q < 4; q++) {
    gl.push([
      30 + 22 * sin(0.0113 * t * (1 + 0.37 * q) + p[11] + q * 1.7),
      64 + 52 * sin(0.0071 * t * (1 + 0.29 * q) + p[12] + q * 2.3),
      0.18 + 0.14 * sin(0.31 * t + q * 2.1 + p[13]),
    ]);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const D0 = g[y * W + x];
      // sea: deep blue, lighter teal patches that ride the swell
      const dx = px - CX, dy = py - CY;
      const cc = dx * ca + dy * sa, ss = dx * sa - dy * ca;
      const pat = 0.5 + 0.3 * sin(0.121 * cc + 0.067 * (ss - vs) + p[14]) + 0.22 * sin(-0.083 * cc + 0.109 * (ss - vs) * 0.7 + 0.0049 * t + p[15]);
      const pw = 0.5 * sstep(0.6, 1.0, pat);
      let sr = seaD[0] + (seaL[0] - seaD[0]) * pw, sg = seaD[1] + (seaL[1] - seaD[1]) * pw, sb = seaD[2] + (seaL[2] - seaD[2]) * pw;
      // sun glints
      let gv = 0;
      for (let q = 0; q < 4; q++) {
        const e = gl[q], ddx = px - e[0], ddy = py - e[1];
        gv += e[2] * exp(-(ddx * ddx + ddy * ddy) / 9);
      }
      // shadow of the cloud to the upper left falls on the sea to its lower right
      const sh = samp(g, px - 2.8, py - 3.4);
      const shadow = 1 - 0.55 * cl(sh * 1.3, 0, 1);
      sr = (sr + glc[0] * gv * 0.5) * shadow; sg = (sg + glc[1] * gv * 0.5) * shadow; sb = (sb + glc[2] * gv * 0.5) * shadow;
      let r = sr * 255, gg = sg * 255, b = sb * 255;
      if (D0 > 0.004 || sh > 0.004) {
        const alpha = 1 - exp(-2.1 * D0);
        if (alpha > 0.003) {
          // light from the upper left: a flank facing it is bright, the lee side is dim
          const Dul = samp(g, px - 1.5, py - 1.5), Dlr = samp(g, px + 1.5, py + 1.5);
          const tt = cl(0.5 + 1.25 * (Dlr - Dul) + 0.14 * min(D0, 1.2), 0, 1);
          let cr, cg, cb;
          if (tt < 0.62) {
            const u = tt / 0.62;
            cr = shd[0] * 255 + (236 - shd[0] * 255) * u;
            cg = shd[1] * 255 + (240 - shd[1] * 255) * u;
            cb = shd[2] * 255 + (250 - shd[2] * 255) * u;
          } else {
            const u = (tt - 0.62) / 0.38;
            cr = 236 + 14 * u; cg = 240 + 4 * u; cb = 250 - 24 * u;
          }
          r = r * (1 - alpha) + cr * alpha;
          gg = gg * (1 - alpha) + cg * alpha;
          b = b * (1 - alpha) + cb * alpha;
        }
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
