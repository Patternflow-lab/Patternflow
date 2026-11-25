// ===== Patternflow pattern =====
// Title:   Chinese Restaurant
// Family:  nonparametric
// Idea:    Customers arrive a few a second and sit at a table with the Chinese restaurant process rule, rich tables more likely, a new table now and then, and leave after twenty to ninety seconds, so the panel is the plane the tables live in: every table is a soft anisotropic cloud of its own hue whose glow grows with its customers, every customer is one soft dot in it, a few rich clouds fill the panel and a dust of new tables flickers at their feet.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Chinese restaurant process, the rich-get-richer random partition (Aldous 1985, named from Dubins and Pitman; Pitman 1995; the two-parameter version with discount by Pitman and Yor 1997; the Ewens sampling formula of Ewens 1972 is its d = 0 case; all from memory), customers who leave as the neutral birth and death balance that keeps the partition stationary (from memory), hue and chroma mixed in OKLCH (Ottosson 2020, from memory), pattern round 241
// Round:   241
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Concentration=0..4, Discount=-1..1, Arrival=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the tables run from cyan through blue and violet to pink, spread over 165 degrees by a golden-angle step so two tables in a row are never near each other; at 1 the wheel has come round again.
// Knob 2: Concentration. 0 to 4, opening at 2. The concentration theta of the process, 0.6 at 0, 2.7 at 2 and 12 at 4: a new customer opens a new table with chance theta over (customers + theta). Low, three or four clouds hold everyone and nobody opens a new table for a minute or more. High, twenty or thirty tables of five to fifteen people stand side by side, and a new one blooms every few seconds.
// Knob 3: Discount. -1 to 1, opening at 0. The discount d of the Pitman-Yor process, 0 at -1, 0.45 at 0 and 0.9 at 1. At 0 the table sizes are those of the plain process, a few rich and some small. Raised, a table is joined less for being small and new tables open more often: one cloud takes most of the room and the rest is a dust of single customers, each a dim glow with one dot.
// Knob 4: Arrival. -1 to 1, opening near 0. Customers a second, 1.5 at -1, 3.7 at 0 and 9 at 1, and with them how crowded the room is: it holds about 36 times that many people, 54 to 324. Quiet, every cloud is dim with a few dots in it. Crowded, the rich tables saturate to pale cores and the dots pack into grain.

const W = 64, H = 128, GW = 32, GH = 64, MAXT = 150;
const { floor, round, min, max, abs, exp, sqrt, sin, cos, atan2, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const HUE0 = 190, ARC = 165;          // the palette starts at cyan and runs 165 degrees of OKLCH hue
const GOLD = 0.6180339887;
const LMEAN = 36;                     // mean of a lifetime drawn from a Pareto of index 1.4 cut to 20..90 s
const LA = 1.4, LLO = 20, LHI = 90;
const LUTH = 256, LUTV = 128;
const WASH = 0.09;
const HALO = 0.2, HALOS = 4.5;          // the glow round a customer: its strength and its spread in LED                    // the faint ground every pixel keeps, in level
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ---- colour -----------------------------------------------------------------
function oklab(L, C, hdeg, out) {
  const h = (hdeg * PI) / 180, a = C * cos(h), b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
const inGamut = (c) => c[0] >= -0.001 && c[1] >= -0.001 && c[2] >= -0.001 && c[0] <= 1.001 && c[1] <= 1.001 && c[2] <= 1.001;
// the colour at lightness L and hue h with the most chroma up to C that the panel can show
function rgbOf(L, C, h, out, o) {
  const c = [0, 0, 0];
  oklab(L, C, h, c);
  if (!inGamut(c)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      oklab(L, mid, h, c);
      if (inGamut(c)) lo = mid;
      else hi = mid;
    }
    oklab(L, lo, h, c);
  }
  out[o] = 255 * enc(cl(c[0], 0, 1));
  out[o + 1] = 255 * enc(cl(c[1], 0, 1));
  out[o + 2] = 255 * enc(cl(c[2], 0, 1));
}
// Level 0..1 against hue. Lightness climbs, chroma rises early and gives way to a pale core at the top, and on the red-orange-
// yellow stretch a dim colour is lifted and paled, because there it reads brown on the panel.
function buildLut(st) {
  const lut = (st.lut = new Float32Array(LUTH * LUTV * 3)), dot = (st.dotLut = new Float32Array(LUTH * 3)), hal = (st.haloLut = new Float32Array(LUTH * 3));
  for (let hi = 0; hi < LUTH; hi++) {
    const h = (hi * 360) / LUTH;
    const warm = sstep(5, 30, h) * (1 - sstep(110, 145, h));
    for (let vi = 0; vi < LUTV; vi++) {
      const v = vi / (LUTV - 1);
      const L = 0.1 + 0.82 * pow(v, 0.9) + warm * 0.17 * pow(1 - v, 0.7) * sstep(0, 0.08, v);
      const C = 0.17 * pow(v, 0.45) * (1 - 0.72 * sstep(0.8, 1, v)) * (1 - 0.5 * warm * (1 - v));
      rgbOf(L, C, h, lut, (hi * LUTV + vi) * 3);
    }
    rgbOf(0.9, 0.1, h, dot, hi * 3);
    rgbOf(0.68, 0.17, h, hal, hi * 3);
  }
}

// ---- the restaurant ---------------------------------------------------------
const lifetime = () => LLO / pow(1 - rnd() * (1 - pow(LLO / LHI, LA)), 1 / LA);

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], kp: null, init: false, t: 0, boost: 0, nextArr: 0, nid: 0, off: rnd(),
    sm: { th: 2.7, d: 0.45, lam: 3.7 },
    tabs: [], cust: [],
    A: {
      X: new Float32Array(MAXT), Y: new Float32Array(MAXT), C: new Float32Array(MAXT), S: new Float32Array(MAXT),
      IX2: new Float32Array(MAXT), IY2: new Float32Array(MAXT), SX: new Float32Array(MAXT), SY: new Float32Array(MAXT),
      LV: new Float32Array(MAXT), HC: new Float32Array(MAXT), HS: new Float32Array(MAXT), M2: new Float32Array(MAXT),
      IS2: new Float32Array(MAXT), HI: new Int32Array(MAXT),
    },
    cell: new Float32Array(GW * GH * 3), fb: new Float32Array(W * H * 3),
    n0: 12, ph: rnd() * TAU,
  });
  buildLut(st);
  // the half resolution cell each LED column and row leans on, and by how much
  st.ix = new Int32Array(W); st.fx = new Float32Array(W);
  st.iy = new Int32Array(H); st.fy = new Float32Array(H);
  for (let x = 0; x < W; x++) {
    const g = cl((x - 0.5) / 2, 0, GW - 1.001);
    st.ix[x] = floor(g);
    st.fx[x] = g - floor(g);
  }
  for (let y = 0; y < H; y++) {
    const g = cl((y - 0.5) / 2, 0, GH - 1.001);
    st.iy[y] = floor(g);
    st.fy[y] = g - floor(g);
  }
  return st;
}

// The knobs as the process's own numbers.
function targets(k) {
  return {
    th: 0.6 * pow(20, cl(k[1], 0, 4) / 4),
    d: 0.45 + 0.45 * cl(k[2], -1, 1),
    lam: 3.7 * pow(2.4, cl(k[3], -1, 1)),
  };
}

// A new table: its own place (the best of five tries at being far from the others), shape, size and hue.
function newTable(st) {
  let bx = 32, by = 64, bd = -1;
  for (let i = 0; i < 5; i++) {
    const x = -2 + 68 * rnd(), y = -4 + 136 * rnd();
    let md = 1e9;
    for (const t of st.tabs) {
      const dx = x - t.x, dy = y - t.y;
      md = min(md, sqrt(dx * dx + dy * dy) / (t.sig + 6));
    }
    if (md > bd) (bd = md), (bx = x), (by = y);
  }
  st.nid++;
  const u = st.off + GOLD * st.nid;
  const tb = {
    u: u - floor(u), x: bx, y: by, vx: gauss() * 0.4, vy: gauss() * 0.4,
    th: rnd() * PI, om: 0, sig: 5 + 7 * rnd(), asp: 1 + 1.3 * pow(rnd(), 1.4),
    p1: rnd() * TAU, p2: rnd() * TAU, p3: rnd() * TAU,
    n: 0, refs: 0, e: 0, lvl: 0, gro: 0.8, ring: st.t, di: 0,
  };
  st.tabs.push(tb);
  return tb;
}

// One customer arrives and sits by the Pitman-Yor rule: a table with n_k people is taken with weight n_k - d, a new one with
// theta + d K, and the weights add up to n + theta.
function arrive(st) {
  const { th, d } = st.sm, tabs = st.tabs;
  let n = 0;
  for (const t of tabs) n += t.n;
  const full = tabs.length >= MAXT;
  let r = rnd() * (full ? n - d * tabs.length : n + th), tb = null;
  for (const t of tabs) {
    if (t.n > 0) {
      r -= t.n - d;
      if (r < 0) {
        tb = t;
        break;
      }
    }
  }
  if (!tb) tb = full ? tabs[floor(rnd() * tabs.length)] : newTable(st);
  // a random sample of the table's own Gaussian, kept to within about two standard deviations
  let u, v;
  do {
    u = gauss();
    v = gauss();
  } while (u * u + v * v > 5);
  const c = { tb, u, v, life: lifetime(), age: 0, dead: false, fi: 0, fo: 0, tin: 2 + rnd(), tout: 3 + 1.5 * rnd(), a: 0 };
  tb.n++;
  tb.refs++;
  st.cust.push(c);
  return c;
}

// dt of real time, speed times as much of the process. The tables wander in real time, and the process runs faster for a few
// seconds after a knob moves, so the room has caught up with the knob before the knob is let go.
function tick(st, dt, speed) {
  const sm = st.sm, tg = st.tg;
  const f = 1 - exp(-dt / 0.8);
  sm.th = exp(log(sm.th) + (log(tg.th) - log(sm.th)) * f);
  sm.d += (tg.d - sm.d) * f;
  sm.lam = exp(log(sm.lam) + (log(tg.lam) - log(sm.lam)) * f);
  st.t += dt;
  const ps = dt * speed, tabs = st.tabs;
  // the tables wander: a velocity that forgets in nine seconds, a turn that forgets in fifteen, a soft wall at the panel's edge
  for (const t of tabs) {
    const a = dt / 6, b = dt / 10;
    t.vx += -t.vx * a + 2.2 * sqrt(2 * a) * gauss();
    t.vy += -t.vy * a + 2.2 * sqrt(2 * a) * gauss();
    t.vx -= 0.05 * (t.x - cl(t.x, -3, 67)) * dt;
    t.vy -= 0.05 * (t.y - cl(t.y, -6, 134)) * dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.om += -t.om * b + 0.14 * sqrt(2 * b) * gauss();
    t.th += t.om * dt;
  }
  // arrivals
  st.nextArr -= ps;
  let guard = 0;
  while (st.nextArr <= 0 && guard++ < 60) {
    arrive(st);
    st.nextArr += -log(1 - rnd()) / sm.lam;
  }
  for (const t of tabs) t.e = 0;
  const cust = st.cust;
  for (let i = cust.length - 1; i >= 0; i--) {
    const c = cust[i];
    c.age += ps;
    c.fi += dt;
    if (!c.dead && c.age >= c.life) {
      c.dead = true;
      c.tb.n--;
    }
    if (c.dead) c.fo += dt;
    if (c.dead && c.fo > c.tout) {
      c.tb.refs--;
      cust[i] = cust[cust.length - 1];
      cust.pop();
      continue;
    }
    const lf = min(1, c.age / c.life);
    c.a = sstep(0, c.tin, c.fi) * (c.dead ? 1 - sstep(0, c.tout, c.fo) : 1) * (1 - 0.45 * pow(lf, 1.3));
    c.tb.e += c.a;
  }
  for (let i = tabs.length - 1; i >= 0; i--) {
    const t = tabs[i];
    if (t.refs <= 0) {
      tabs[i] = tabs[tabs.length - 1];
      tabs.pop();
    }
  }
  // how many people make a strong table grows with the room, a little
  st.n0 = 9 * pow(sm.lam * LMEAN / 100, 0.4);
  for (const t of tabs) {
    t.lvl = 0.8 * (1 - exp(-t.e / st.n0));
    t.gro = 0.8 + 0.45 * (1 - exp(-t.e / (2.2 * st.n0)));
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  const prev = st.kp;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  st.tg = targets(st.k);
  if (!st.init) {
    st.init = true;
    st.kp = st.k.slice();
    st.sm.th = st.tg.th;
    st.sm.d = st.tg.d;
    st.sm.lam = st.tg.lam;
    st.nextArr = -log(1 - rnd()) / st.sm.lam;
    // the room as it would be if it had been open a long while: the people in it, each with the time it has been there (a person
    // met at random has a lifetime drawn in proportion to its length), seated one after another by the rule; then a minute of
    // the process, which costs nothing because none of it is drawn
    const N = round(st.sm.lam * LMEAN);
    for (let i = 0; i < N; i++) {
      const c = arrive(st);
      for (let tries = 0; tries < 30; tries++) {
        c.life = lifetime();
        if (rnd() * LHI < c.life) break;
      }
      c.age = rnd() * c.life;
      c.fi = 99;
    }
    for (let i = 0; i < 300; i++) tick(st, 0.2, 1);
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  // knobs 2 to 4 changing: the room runs faster for a while
  let moved = 0;
  if (prev) moved = abs(st.k[1] - prev[1]) / 4 + abs(st.k[2] - prev[2]) / 2 + abs(st.k[3] - prev[3]) / 2;
  st.kp = st.k.slice();
  st.boost = min(5, st.boost * exp(-dt / 5) + 14 * moved);
  tick(st, dt, 1 + st.boost);
}

// ---- drawing ----------------------------------------------------------------
export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const A = st.A, tabs = st.tabs, nT = tabs.length, hueOff = HUE0 + st.k[0] * 360;
  // each table's numbers for this frame
  for (let k = 0; k < nT; k++) {
    const t = tabs[k];
    t.di = k;
    const sg = t.sig * t.gro * (1 + 0.16 * sin(0.12 * st.t + t.p2));
    const as = t.asp * (1 + 0.25 * sin(0.17 * st.t + t.p3));
    const sx = sg * sqrt(as), sy = sg / sqrt(as);
    const hd = hueOff + ARC * t.u + 28 * sin(0.045 * st.t + t.p1) + 18 * sin(0.021 * st.t + st.ph), hr = (hd * PI) / 180;
    const S = 12 + 1.5 * sg, m = 0.3 + 0.7 * t.lvl;
    A.X[k] = t.x; A.Y[k] = t.y; A.C[k] = cos(t.th); A.S[k] = sin(t.th);
    A.SX[k] = sx; A.SY[k] = sy; A.IX2[k] = 1 / (sx * sx); A.IY2[k] = 1 / (sy * sy);
    A.LV[k] = min(0.97, t.lvl * (1 + 0.18 * sin(0.09 * st.t + t.p3 * 1.7))); A.HC[k] = cos(hr); A.HS[k] = sin(hr);
    A.M2[k] = m * m * 0.12; A.IS2[k] = 1 / (S * S);
    A.HI[k] = round(((hd / 360) - floor(hd / 360)) * LUTH) & (LUTH - 1);
  }
  // the clouds on a grid of 2 x 2 LED cells: a level from the tables laid over one another as light is, a hue from the vector sum
  // of the tables' hues, each weighed by the square of its glow there plus a faint broad ground, so overlapping tables go through
  // the hues between them and never through grey
  const lut = st.lut, cell = st.cell, X = A.X, Y = A.Y, C = A.C, S = A.S, IX2 = A.IX2, IY2 = A.IY2, LV = A.LV, HC = A.HC, HS = A.HS, M2 = A.M2, IS2 = A.IS2;
  let o = 0;
  for (let j = 0; j < GH; j++) {
    const py = 2 * j + 1;
    for (let i = 0; i < GW; i++) {
      const px = 2 * i + 1;
      let P = 1, sx = 0, sy = 0;
      for (let k = 0; k < nT; k++) {
        const dx = px - X[k], dy = py - Y[k];
        const q = 1 / (1 + (dx * dx + dy * dy) * IS2[k]);
        let w = M2[k] * q * q * q;
        const qx = dx * C[k] + dy * S[k], qy = -dx * S[k] + dy * C[k];
        const r2 = qx * qx * IX2[k] + qy * qy * IY2[k];
        if (r2 < 60) {
          const a = LV[k] * ((r2 < 30 ? 0.8 * exp(-0.5 * r2) : 0) + 0.2 * exp(-r2 / 18));
          P *= 1 - a;
          w += a * a;
        }
        sx += w * HC[k];
        sy += w * HS[k];
      }
      const v = 1 - (1 - WASH) * P;
      const hi = round((atan2(sy, sx) / TAU) * LUTH) & (LUTH - 1);
      const lv = v * (LUTV - 1), l0 = min(floor(lv), LUTV - 2), f = lv - l0, b = (hi * LUTV + l0) * 3;
      cell[o] = lut[b] + (lut[b + 3] - lut[b]) * f;
      cell[o + 1] = lut[b + 1] + (lut[b + 4] - lut[b + 1]) * f;
      cell[o + 2] = lut[b + 2] + (lut[b + 5] - lut[b + 2]) * f;
      o += 3;
    }
  }
  // a faint wide glow round every customer, in its table's hue, so a cloud is lumpy where its people actually sit
  const dl = st.dotLut, hl = st.haloLut, cust = st.cust;
  for (let i = 0; i < cust.length; i++) {
    const c = cust[i];
    if (c.a < 0.03) continue;
    const t = c.tb, k = t.di, px = t.x + c.u * A.SX[k] * A.C[k] - c.v * A.SY[k] * A.S[k], py = t.y + c.u * A.SX[k] * A.S[k] + c.v * A.SY[k] * A.C[k];
    c.px = px;
    c.py = py;
    const hi = A.HI[k] * 3, hs = HALO / sqrt(1 + t.e / 14), ci = (px - 1) / 2, cj = (py - 1) / 2;
    const i0 = max(0, floor(ci - 6)), i1 = min(GW - 1, floor(ci + 6)), j0 = max(0, floor(cj - 6)), j1 = min(GH - 1, floor(cj + 6));
    for (let j = j0; j <= j1; j++) {
      for (let x = i0; x <= i1; x++) {
        const dx = 2 * x + 1 - px, dy = 2 * j + 1 - py;
        const a = hs * c.a * exp(-(dx * dx + dy * dy) / (2 * HALOS * HALOS)), p = (j * GW + x) * 3;
        for (let q = 0; q < 3; q++) cell[p + q] = 255 - (255 - cell[p + q]) * (1 - (a * hl[hi + q]) / 255);
      }
    }
  }
  // up to the LEDs
  const fb = st.fb, ix = st.ix, fx = st.fx, iy = st.iy, fy = st.fy;
  for (let y = 0; y < H; y++) {
    const r0 = iy[y] * GW, wy = fy[y];
    for (let x = 0; x < W; x++) {
      const a = (r0 + ix[x]) * 3, b = a + GW * 3, wx = fx[x], p = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        const top = cell[a + c] + (cell[a + 3 + c] - cell[a + c]) * wx;
        const bot = cell[b + c] + (cell[b + 3 + c] - cell[b + c]) * wx;
        fb[p + c] = top + (bot - top) * wy;
      }
    }
  }
  // the bloom ring of a new table
  for (let k = 0; k < nT; k++) {
    const t = tabs[k], ra = st.t - t.ring;
    if (ra > 1.9 || ra < 0) continue;
    const R = (5 + 0.9 * sqrt(A.SX[k] * A.SY[k])) * (1 - exp(-ra / 0.5)), sw = 1.3 + 0.35 * ra, str = 0.6 * pow(1 - ra / 1.9, 1.5) * min(1, 0.4 + t.e);
    const hi = A.HI[k] * 3, ext = R + 4 * sw;
    const x0 = max(0, floor(t.x - ext)), x1 = min(W - 1, floor(t.x + ext)), y0 = max(0, floor(t.y - ext)), y1 = min(H - 1, floor(t.y + ext));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - t.x, dy = y + 0.5 - t.y, d = sqrt(dx * dx + dy * dy) - R;
        const a = str * exp(-(d * d) / (2 * sw * sw));
        if (a < 0.01) continue;
        const p = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) fb[p + c] = 255 - (255 - fb[p + c]) * (1 - (a * dl[hi + c]) / 255);
      }
    }
  }
  // the customers: one soft dot each, about 3 LED across, at its sample of its table's Gaussian
  for (let i = 0; i < cust.length; i++) {
    const c = cust[i];
    if (c.a < 0.03) continue;
    const t = c.tb, k = t.di, px = c.px, py = c.py;
    if (px < -3 || px > W + 3 || py < -3 || py > H + 3) continue;
    const hi = A.HI[k] * 3, x0 = floor(px - 2.5), y0 = floor(py - 2.5);
    for (let y = max(0, y0); y <= min(H - 1, y0 + 5); y++) {
      for (let x = max(0, x0); x <= min(W - 1, x0 + 5); x++) {
        const dx = x + 0.5 - px, dy = y + 0.5 - py, r2 = dx * dx + dy * dy;
        if (r2 > 6.25) continue;
        const a = min(1, 1.1 * c.a * exp(-r2 / 1.6)), p = (y * W + x) * 3;
        for (let q = 0; q < 3; q++) fb[p + q] = 255 - (255 - fb[p + q]) * (1 - (a * dl[hi + q]) / 255);
      }
    }
  }
  // out, with an ordered dither so the dim gradients do not band
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3, d = BAYER[((y & 3) << 2) | (x & 3)];
      display.setPixel(x, y, cl(floor(fb[p] + d), 0, 255), cl(floor(fb[p + 1] + d), 0, 255), cl(floor(fb[p + 2] + d), 0, 255));
    }
  }
}
