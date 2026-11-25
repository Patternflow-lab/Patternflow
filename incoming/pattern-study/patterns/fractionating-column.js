// ===== Patternflow pattern =====
// Title:   Fractionating Column
// Family:  distillation
// Idea:    A tall stack of sieve trays stands in the dark, each pool on a tray coloured by how much of the light component it holds, teal where that is rich and amber where the heavy one is, while bubbles climb through every tray and come out a little more teal, reflux falls from tray to tray down alternating sides, and the slope from amber at the bottom to teal at the top slides up and down the column as the feed, the heat and the reflux wander.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the equilibrium-stage model of a binary distillation column (Sorel, 1893; McCabe and Thiele, 1925; Lewis and Matheson, 1932): twelve trays between a reboiler and a total condenser, constant molal overflow, a relative volatility of 2.0 to 2.5 and a first-order holdup on every tray, integrated live as ordinary differential equations; the trim that holds the front where the picture wants it, the wandering feed, heat, reflux and front, the unsteadiness of each tray and the drawing of pools, weirs, bubbles and downcomers in abstract shapes are original, pattern round 255
// Round:   255
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=0.3..3, Reflux=-1..1, Feed=-1..1
//
// Knob 1: Hue. Turns the light and heavy components round the wheel together, keeping them about a third of the wheel apart; it opens on teal and amber, and the hot band of the reboiler follows it a little.
// Knob 2: Heat. 0.3 to 3, opening at 2. The boil-up: at 2 about 9 bubbles climb through each tray at 15 LED a second, at 0.3 three lazy ones at 7, at 3 about 12 at 20. The reboiler band glows hotter, the downcomers run stronger and the column answers faster; the relative volatility falls a little as the heat rises, so a hard boil separates a little worse.
// Knob 3: Reflux. -1 to 1, opening at 0. The reflux ratio, 0.67 at -1, 2 at 0 and 6 at 1: more reflux makes the rectifying streaks brighter and the gradient steeper and cleaner, less lets the middle trays pinch into a flat plateau.
// Knob 4: Feed. -1 to 1, opening at about 0.06. The light fraction of the feed, 0.15 at -1, 0.5 at 0 and 0.85 at 1: a light-poor feed leaves only a thin teal cap at the top of an amber column, a light-rich one fills the column with teal up to a thin amber foot, and the feed pipe on the left takes the feed's own colour.

const W = 64, H = 128;
const NT = 12;                  // trays
const FT = 5;                   // the feed tray, counted from the bottom
const YB = 108, SP = 8;         // tray 1's bar sits at y = 108, a tray every 8 LED
const trayY = (k) => YB - (k - 1) * SP;   // tray 13 is the condenser, tray 0 the reboiler (y = 116)
const XL = 18, XR = 46, CH = 5;  // the inside of the column and the width of a downcomer channel
const { min, max, floor, sqrt, sin, cos, exp, abs, pow, PI, tanh, log, ceil } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

// Bubbles: a stage s is the climb from tray s's bar to the next bar; stage 0 climbs out of the reboiler, stage 12 into the condenser.
const NS = 13, PER = 16, NB = NS * PER;
const MD = 56;                  // drops in flight

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const st = (params.st = {
    init: false, tau: 0, k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], hue: 0,
    x: new Float64Array(NT + 2),
    ph: [], ou: [0, 0, 0],
    lo: 0.3, hi: 0.7, boost: 0,
    rho: 0.5, Lr: 0.67, Ls: 1.3, F: 1.3, D: 0.33, B: 0.97, alpha: 2.2, V: 2, R: 2, z: 0.5, pos: 6,
    bs: new Int8Array(NB), bp: new Float32Array(NB), bx: new Float32Array(NB), bj: new Float32Array(NB), bw: new Float32Array(NB),
    sph: new Float64Array(NT + 2), tw: new Float64Array(NT + 2), tb: new Float64Array(NT + 2), th: new Float64Array(NT + 2), fp: [0, 0, 0],
    dx: new Float32Array(MD), dy: new Float32Array(MD), dv: new Float32Array(MD), dk: new Int8Array(MD), dl: new Uint8Array(MD),
    dacc: [0, 0, 0],
    buf: new Float32Array(W * H * 3),
    cc: new Float64Array(3), pc: new Float64Array((NT + 2) * 3), vc: new Float64Array((NT + 2) * 3),
    pt: new Float64Array(NT + 2), pool: new Float64Array(NT + 2), fl: new Float64Array(NT + 2),
  });
  for (let i = 0; i < 24; i++) st.ph.push(rnd() * TP);
  for (let n = 0; n <= NT + 1; n++) st.x[n] = 0.1 + (0.8 * n) / (NT + 1);
  for (let i = 0; i < NB; i++) {
    st.bs[i] = floor(i / PER);
    st.bp[i] = rnd();
    st.bx[i] = 25 + rnd() * 14;
    st.bj[i] = 0.75 + rnd() * 0.5;
    st.bw[i] = rnd() * TP;
  }
  for (let i = 0; i < MD; i++) st.dl[i] = 0;
  return st;
}

function randn() {
  return sqrt(-2 * log(1 - rnd())) * cos(TP * rnd());
}

// What the knobs ask for, with the wander laid over it: feed, heat, reflux and where the front is held. All on clocks that do not divide each other.
function wander(st, tau) {
  const ph = st.ph, ks = st.ks;
  const z0 = 0.5 + 0.35 * cl(ks[3], -1, 1);
  const z = cl(z0 + 0.06 * sin(TP * 0.0173 * tau + ph[0]) + 0.035 * sin(TP * 0.0419 * tau + ph[1]) + st.ou[0], 0.1, 0.9);
  // the front is held higher in the column for a light-poor feed and lower for a light-rich one
  const base = 9.4 - (6.8 * (z0 - 0.15)) / 0.7;
  const raw = base + 1.35 * sin(TP * 0.0131 * tau + ph[2]) + 0.85 * sin(TP * 0.0287 * tau + ph[3]) + 0.4 * sin(TP * 0.0611 * tau + ph[4]) + st.ou[1];
  const pos = 6.1 + 4.5 * tanh((raw - 6.1) / 4.5);
  const V = cl(ks[1], 0.3, 3) * (1 + 0.1 * sin(TP * 0.0231 * tau + ph[5]) + 0.06 * sin(TP * 0.0577 * tau + ph[6]));
  const R0 = 2 * pow(3, cl(ks[2], -1, 1));
  const R = cl(R0 * (1 + 0.17 * sin(TP * 0.0197 * tau + ph[7]) + 0.08 * sin(TP * 0.0503 * tau + ph[8])), 0.5, 7);
  st.z = z; st.pos = pos; st.V = cl(V, 0.25, 3.3); st.R = R;
  st.hue = ks[0] + 0.016 * sin(TP * 0.0113 * tau + ph[9]) + 0.01 * sin(TP * 0.0371 * tau + ph[10]) + st.ou[2];
}

// One step of the column. Flows are in units of the boil-up. x[0] is the reboiler, x[1..12] the trays, x[13] the condenser drum.
const eqm = (a, u) => (a * u) / (1 + (a - 1) * u);
const dxs = new Float64Array(NT + 2);
function step(st, h) {
  const x = st.x, a = st.alpha, R = st.R, z = st.z;
  const M = 0.9, M0 = 1.4, Md = 0.7;
  const i = cl(floor(st.pos), 1, NT - 1), f = st.pos - i;
  const xc = x[i] * (1 - f) + x[i + 1] * f;
  // the trim: a front that sits low asks for more distillate, a front that sits high asks for less
  const rho = cl(z + 2 * (xc - 0.5), 0.22, 0.85);
  const D = 1 / (1 + R), Lr = R * D, F = D / rho, Ls = Lr + F, B = Ls - 1;
  st.rho = rho; st.D = D; st.Lr = Lr; st.F = F; st.Ls = Ls; st.B = B;
  dxs[0] = (Ls * x[1] - eqm(a, x[0]) - B * x[0]) / M0;
  for (let n = 1; n <= NT; n++) {
    const Ln = n <= FT ? Ls : Lr, Lu = n === NT ? Lr : n + 1 <= FT ? Ls : Lr;
    dxs[n] = (Lu * x[n + 1] + eqm(a, x[n - 1]) - Ln * x[n] - eqm(a, x[n]) + (n === FT ? F * z : 0)) / M;
  }
  dxs[NT + 1] = (eqm(a, x[NT]) - x[NT + 1]) / Md;
  for (let n = 0; n <= NT + 1; n++) {
    const v = x[n] + h * dxs[n];
    x[n] = Number.isFinite(v) ? cl(v, 0, 1) : 0.5;
  }
}

function advance(st, total) {
  const n = max(1, ceil(total / 0.04));
  const h = total / n;
  st.alpha = 2.6 - 0.2 * st.V;
  for (let i = 0; i < n; i++) step(st, h);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.1);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // pre-roll to the settled column at the knobs
    wander(st, 0);
    for (let i = 0; i < 90; i++) advance(st, 1);
    const lo = st.x[0], hi = max(st.x[NT + 1], lo + 0.45);
    st.lo = lo; st.hi = hi;
  } else {
    const a = 1 - exp(-dt / 0.12);
    let act = 0;
    const rg = [1, 2.7, 2, 2];
    for (let i = 0; i < 4; i++) {
      act = max(act, abs(st.k[i] - st.ks[i]) / rg[i]);
      st.ks[i] += (st.k[i] - st.ks[i]) * a;
    }
    // while a knob is moving the column runs faster, so it follows within a few seconds
    st.boost += (min(1, act * 8) - st.boost) * (1 - exp(-dt / 0.4));
  }
  st.tau += dt;
  const tau = st.tau;
  // slow random walks on the feed, the front and the hue: accumulated state, so the picture does not come round
  const g = sqrt(2 * dt);
  st.ou[0] += (-st.ou[0] / 31) * dt + 0.08 * g * randn() / sqrt(31);
  st.ou[1] += (-st.ou[1] / 43) * dt + 1.0 * g * randn() / sqrt(43);
  st.ou[2] += (-st.ou[2] / 70) * dt + 0.013 * g * randn() / sqrt(70);
  wander(st, tau);
  const rate = (1.7 + 0.7 * st.V) * (1 + 2.6 * st.boost);
  advance(st, dt * rate);
  // the display scale: the bottoms are amber and the drum teal, whatever the column manages
  const lo = st.x[0], hi = max(st.x[NT + 1], lo + 0.45);
  const s = 1 - exp(-dt / 1.2);
  st.lo += (lo - st.lo) * s;
  st.hi += (hi - st.hi) * s;

  // bubbles climb at a speed that follows the heat
  const V = st.V, vb = 5.5 + 5 * V;
  for (let i = 0; i < NB; i++) {
    const sg = st.bs[i];
    const len = sg === 0 ? 9 : sg === 12 ? 8 : SP;
    st.bp[i] += (vb * st.bj[i] * dt) / len;
    if (st.bp[i] >= 1) {
      st.bp[i] -= floor(st.bp[i]);
      st.bx[i] = 25 + rnd() * 14;
      st.bj[i] = 0.75 + rnd() * 0.5;
      st.bw[i] = rnd() * TP;
    }
  }
  // flow along the downcomers
  for (let k = 1; k <= NT + 1; k++) {
    const fl = k <= FT ? st.Ls : st.Lr;
    const fa = cl(0.1 + 0.36 * fl * V, 0, 1);
    st.fl[k] = fa;
    st.sph[k] += dt * (11 + 7 * fa) / 4;
  }
  // every tray has its own unsteadiness: foam, weeping and surges, a few seconds long
  for (let k = 0; k <= NT + 1; k++) {
    st.tw[k] += (-st.tw[k] / 2.6) * dt + sqrt((2 * dt) / 2.6) * randn();
    // and a slower drift in how rich and how bright each pool sits
    st.tb[k] += (-st.tb[k] / 29) * dt + sqrt((2 * dt) / 29) * randn();
    st.th[k] += (-st.th[k] / 37) * dt + sqrt((2 * dt) / 37) * randn();
  }
  st.fp[0] += dt * (4 + 9 * cl(st.F * V * 0.5, 0, 1.5));
  st.fp[1] += dt * (4 + 9 * cl(st.D * V * 0.5, 0, 1.5));
  st.fp[2] += dt * (4 + 9 * cl(st.B * V * 0.5, 0, 1.5));
  // drops: reflux in the condenser, distillate and bottoms out of the stubs
  const rates = [0.8 + 3.2 * st.Lr * V * 0.5, 0.4 + 2.4 * st.D * V * 0.6, 0.4 + 2.4 * st.B * V * 0.6];
  for (let c = 0; c < 3; c++) {
    st.dacc[c] += dt * rates[c];
    while (st.dacc[c] >= 1) {
      st.dacc[c] -= 1 - 0.4 * rnd();
      for (let i = 0; i < MD; i++)
        if (!st.dl[i]) {
          st.dl[i] = 1; st.dk[i] = c; st.dv[i] = 0;
          if (c === 0) { st.dx[i] = 21 + rnd() * 16; st.dy[i] = 3.5; }
          else if (c === 1) { st.dx[i] = 56.5; st.dy[i] = 10; }
          else { st.dx[i] = 56.5; st.dy[i] = 117.5; }
          break;
        }
    }
  }
  for (let i = 0; i < MD; i++)
    if (st.dl[i]) {
      st.dv[i] += 55 * dt;
      st.dy[i] += st.dv[i] * dt;
      const c = st.dk[i];
      if ((c === 0 && st.dy[i] > 9) || (c === 1 && st.dy[i] > 50) || (c === 2 && st.dy[i] > 126)) st.dl[i] = 0;
    }
}

// colour of a composition on the display scale: amber at 0, teal at 1, round the wheel with Hue
function colX(st, X, s, v, o, out) {
  X = sm(X);
  const h = st.hue + 0.135 + 0.335 * X;
  hsv(h, s, 1, out, o);
  const Y = 0.299 * out[o] + 0.587 * out[o + 1] + 0.114 * out[o + 2];
  const gn = cl(pow(0.62 / max(Y, 0.15), 0.6), 0.9, 1.25) * v;
  let r = out[o] * gn, gg = out[o + 1] * gn, b = out[o + 2] * gn;
  const m = max(r, gg, b);
  if (m > 1) { r /= m; gg /= m; b /= m; }
  out[o] = r; out[o + 1] = gg; out[o + 2] = b;
}

let buf = null;
// paint over what is there, with fractional edges
function box(x0, y0, x1, y1, r, g, b, a, add) {
  const ix0 = max(0, floor(x0)), ix1 = min(W - 1, ceil(x1) - 1), iy0 = max(0, floor(y0)), iy1 = min(H - 1, ceil(y1) - 1);
  for (let y = iy0; y <= iy1; y++) {
    const cy = min(y + 1, y1) - max(y, y0);
    if (cy <= 0) continue;
    for (let x = ix0; x <= ix1; x++) {
      const cx = min(x + 1, x1) - max(x, x0);
      if (cx <= 0) continue;
      const w = a * cx * cy, i = (y * W + x) * 3;
      if (add) {
        buf[i] += r * w; buf[i + 1] += g * w; buf[i + 2] += b * w;
      } else {
        buf[i] += (r - buf[i]) * w; buf[i + 1] += (g - buf[i + 1]) * w; buf[i + 2] += (b - buf[i + 2]) * w;
      }
    }
  }
}

const WALL = [0.5, 0.62, 0.8];

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  buf = st.buf;
  buf.fill(0);
  const tau = st.tau, V = st.V;
  const span = max(0.3, st.hi - st.lo), lo = st.lo;
  const x = st.x, a = st.alpha;
  const c3 = st.cc, pc = st.pc, vc = st.vc;
  // liquid and vapour colours of every stage on the display scale
  for (let n = 0; n <= NT + 1; n++) {
    colX(st, (x[n] - lo) / span + 0.06 * cl(st.th[n], -2, 2), 0.86, 0.8 * (1 + 0.13 * cl(st.tb[n], -2, 2)), n * 3, pc);
    colX(st, (eqm(a, x[n]) - lo) / span, 0.55, 1, n * 3, vc);
    for (let j = 0; j < 3; j++) vc[n * 3 + j] = vc[n * 3 + j] * 0.7 + 0.3;
  }
  // a faint glow behind the column, in the colour of the composition at that height
  const cy = st.pt;
  cy[0] = 119;
  for (let k = 1; k <= NT + 1; k++) cy[k] = trayY(k) - 2;
  for (let y = 0; y < H; y++) {
    let n = 0;
    while (n < NT + 1 && cy[n + 1] > y) n++;
    // the stage whose centre is just below this row
    const n0 = min(NT + 1, n), n1 = min(NT + 1, n + 1);
    const yy = n1 === n0 ? 0 : cl((cy[n0] - y) / (cy[n0] - cy[n1]), 0, 1);
    const Xr = (x[n0] * (1 - yy) + x[n1] * yy - lo) / span;
    colX(st, Xr, 0.8, 1, 0, c3);
    const fade = sm((y - 1) / 12) * sm((127 - y) / 8);
    for (let xx = 6; xx < 58; xx++) {
      const dxx = (xx + 0.5 - 32) / 12;
      const w = 0.115 * exp(-dxx * dxx * 0.5) * fade;
      const i = (y * W + xx) * 3;
      buf[i] += c3[0] * w; buf[i + 1] += c3[1] * w; buf[i + 2] += c3[2] * w;
    }
  }

  // the structure's own colour, a pale grey-blue
  const wl = 0.5;
  const wr = WALL[0] * wl, wg = WALL[1] * wl, wb = WALL[2] * wl;

  // pools on the trays and the reboiler
  const poolTop = st.pool;
  const wobb = 0.2 + 0.1 * V;
  for (let k = 0; k <= NT + 1; k++) {
    const flo = k === 0 ? 0.5 : st.fl[k];
    const lv = 3.3 + 1.2 * flo;
    const y1 = k === 0 ? 117 : trayY(k);
    const w0 = 0.5 * sin(tau * (2.1 + 0.17 * k) + st.ph[k % 24]) + 0.5 * sin(tau * (3.3 - 0.11 * k) + st.ph[(k + 7) % 24]);
    const yt = (k === 0 ? 112 : y1 - lv) + wobb * w0;
    poolTop[k] = yt;
    const odd = k % 2 === 1;
    const px0 = k === 0 || odd ? XL : XL + CH + 2, px1 = k === 0 || !odd ? XR : XR - CH - 2;
    const o = k * 3;
    box(px0, yt, px1, y1, pc[o], pc[o + 1], pc[o + 2], 1, false);
    // a lighter surface
    box(px0, yt, px1, yt + 1.15, pc[o] * 0.55 + 0.4, pc[o + 1] * 0.55 + 0.4, pc[o + 2] * 0.55 + 0.4, 0.9, false);
  }

  // the structure: walls, tray bars and weirs
  box(XL - 2, 11.5, XL, 125, wr, wg, wb, 1, false);
  box(XR, 11.5, XR + 2, 125, wr, wg, wb, 1, false);
  for (let k = 1; k <= NT + 1; k++) {
    const y1 = trayY(k), odd = k % 2 === 1;
    if (odd) {
      box(XL, y1, XR - CH, y1 + 2, wr, wg, wb, 1, false);
      box(XR - CH - 2, y1 - 5, XR - CH, y1, wr, wg, wb, 1, false);
    } else {
      box(XL + CH, y1, XR, y1 + 2, wr, wg, wb, 1, false);
      box(XL + CH, y1 - 5, XL + CH + 2, y1, wr, wg, wb, 1, false);
    }
  }
  // reboiler floor and the roof of the condenser
  box(XL - 2, 125, XR + 2, 127, wr, wg, wb, 1, false);
  box(XL - 2, 1.5, XR + 2, 3.5, wr, wg, wb, 1, false);

  // the reboiler: bottoms liquid with a hot band under it
  const hh = 0.055 + 0.05 * sin(TP * st.k[0]);
  const hot = c3;
  hsv(hh, 0.93, 1, hot, 0);
  const hr = hot[0], hg = hot[1], hb = hot[2];
  const heat = cl(0.26 + 0.25 * V, 0.2, 1);
  box(XL, 117, XR, 125, pc[0] * 0.5, pc[1] * 0.5, pc[2] * 0.5, 1, false);
  for (let y = 117; y < 125; y++) {
    const vp = (y - 116.5) / 8;
    for (let xx = XL; xx < XR; xx++) {
      const sh = 0.78 + 0.22 * sin(xx * 0.71 + tau * 3.1) * sin(xx * 0.29 - tau * 2.2 + y * 0.45) + 0.1 * sin(xx * 1.3 + tau * 5.3 + y);
      const w = heat * (0.4 + 0.6 * vp) * sh;
      const i = (y * W + xx) * 3;
      buf[i] += hr * w; buf[i + 1] += hg * w; buf[i + 2] += hb * w;
    }
  }
  // heat rising out of the band
  for (let j = 0; j < 9; j++) {
    const sp = 0.35 + 0.42 * V * (0.8 + 0.4 * sin(j * 2.7 + 1));
    const ph = (tau * sp * 0.5 + st.ph[j + 12]) % 1;
    const wy = 124 - ph * 11, wx = XL + 2.5 + j * 2.9 + sin(tau * 1.7 + j * 1.9) * 0.7;
    box(wx - 1, wy - 1.4, wx + 1, wy + 1.4, hr, hg, hb, 0.5 * sin(PI * ph) * heat, true);
  }

  // condenser: pale-blue cool glow above a pool of the top composition
  const ch = 0.58 + 0.045 * sin(TP * st.k[0] + 1);
  hsv(ch, 0.3, 1, c3, 0);
  const cg = 0.72 + 0.05 * V;
  for (let y = 4; y < 9; y++) {
    const vp = 1 - (y - 4) / 6;
    for (let xx = XL; xx < XR; xx++) {
      const sh = 0.85 + 0.15 * sin(xx * 0.5 - tau * 1.3 + y * 0.6) * sin(xx * 0.23 + tau * 0.9);
      const w = cg * (0.45 + 0.55 * vp) * sh;
      const i = (y * W + xx) * 3;
      buf[i] += c3[0] * w; buf[i + 1] += c3[1] * w; buf[i + 2] += c3[2] * w;
    }
  }
  box(XL, 8.6, XR - CH - 2, 12, pc[(NT + 1) * 3], pc[(NT + 1) * 3 + 1], pc[(NT + 1) * 3 + 2], 1, false);
  box(XL, 8.6, XR - CH - 2, 9.7, 0.5 + 0.2 * c3[0], 0.55 + 0.2 * c3[1], 0.6 + 0.2 * c3[2], 0.85, false);

  // downcomers: streaks from tray to tray on alternating sides, with the colour of the tray above
  for (let k = 1; k <= NT + 1; k++) {
    const right = k % 2 === 1;
    const cxs = right ? XR - CH / 2 : XL + CH / 2;
    const yt = trayY(k) - 4.5;
    const yb = k === 1 ? 112.5 : trayY(k - 1) - 3.5;
    const f = st.fl[k];
    const hw = 1.25 + 0.4 * f;
    const o = k * 3;
    const r0 = min(1, pc[o] * 1.3 + 0.1), g0 = min(1, pc[o + 1] * 1.3 + 0.1), b0 = min(1, pc[o + 2] * 1.3 + 0.1);
    for (let y = floor(yt); y < ceil(yb); y++) {
      const ycen = y + 0.5;
      const cov = cl(min(ycen + 0.5, yb) - max(ycen - 0.5, yt), 0, 1);
      if (cov <= 0) continue;
      const bl = 0.5 + 0.5 * sin(TP * (ycen / 4 - st.sph[k] + st.ph[(k + 3) % 24]));
      const q = 0.45 + 0.55 * bl;
      const gate = cl((q - (1 - f) * 0.8) / 0.3, 0, 1);
      const I = (0.6 + 0.4 * f) * (0.65 + 0.35 * q) * gate * cov;
      if (I <= 0) continue;
      for (let xx = floor(cxs - hw - 1); xx <= ceil(cxs + hw + 1); xx++) {
        const cx = cl(hw - abs(xx + 0.5 - cxs) + 0.5, 0, 1);
        if (cx <= 0) continue;
        const i = (y * W + xx) * 3, w = I * cx;
        buf[i] += (r0 - buf[i]) * w * 0.9;
        buf[i + 1] += (g0 - buf[i + 1]) * w * 0.9;
        buf[i + 2] += (b0 - buf[i + 2]) * w * 0.9;
      }
    }
  }

  // bubbles: out of the holes of one bar, through the pool, to the next bar, a little more teal for every pool
  const nbv = 2 + 3.4 * V;
  for (let i = 0; i < NB; i++) {
    const j = i % PER;
    const al = cl(nbv * (1 + 0.1 * cl(st.tw[st.bs[i]], -2, 2)) - j, 0, 1);
    if (al <= 0) continue;
    const s = st.bs[i], p = st.bp[i];
    const yb0 = s === 0 ? 118 : trayY(s) + 1, yb1 = s === 12 ? 13.5 : s === 0 ? 109.5 : trayY(s + 1) + 1;
    const by = yb0 - p * (yb0 - yb1);
    const pt = poolTop[s] - 0.3;
    const bx = st.bx[i] + 0.7 * sin(st.bw[i] + p * 9);
    // colour: entering vapour in the pool, leaving vapour above it
    const prog = by >= pt ? cl((yb0 - by) / (yb0 - pt), 0, 1) : 1;
    const o1 = s * 3, o0 = (s === 0 ? 0 : s - 1) * 3;
    const r = vc[o0] * (1 - prog) + vc[o1] * prog, g = vc[o0 + 1] * (1 - prog) + vc[o1 + 1] * prog, b = vc[o0 + 2] * (1 - prog) + vc[o1 + 2] * prog;
    const inpool = by >= pt - 0.5;
    // fade out against the next bar and into the condenser
    const fade = s === 12 ? sm((by - 12.5) / 3) : 1;
    box(bx - 1, by - 1, bx + 1, by + 1, r, g, b, al * (inpool ? 0.95 : 0.8) * fade, false);
  }

  // the reflux leaving the condenser, and the drops
  // (the streak of tray 13 above is that reflux)
  for (let i = 0; i < MD; i++) {
    if (!st.dl[i]) continue;
    const c = st.dk[i], yy = st.dy[i], xx = st.dx[i];
    if (c === 0) {
      box(xx - 1, yy - 1, xx + 1, yy + 1, 0.72, 0.9, 1, 0.9, false);
    } else {
      const o = (c === 1 ? NT + 1 : 0) * 3;
      box(xx - 1, yy - 1.5, xx + 1, yy + 1.5, min(1, pc[o] * 1.35 + 0.1), min(1, pc[o + 1] * 1.35 + 0.1), min(1, pc[o + 2] * 1.35 + 0.1), 0.95, false);
    }
  }

  // the pipe stubs: feed in at the left, distillate out at the top right, bottoms out at the bottom right, each in its own colour, with a pulse running along it
  const pipe = (x0, x1, yi0, yi1, r, g, b, ph, lvl) => {
    box(x0, yi0 - 1, x1, yi0, wr, wg, wb, 1, false);
    box(x0, yi1, x1, yi1 + 1, wr, wg, wb, 1, false);
    for (let xx = floor(x0); xx < ceil(x1); xx++) {
      const sw = (0.8 + 0.2 * sin(TP * (xx / 6.5 - ph))) * lvl;
      box(xx, yi0, xx + 1, yi1, min(1, r * 1.15) * sw, min(1, g * 1.15) * sw, min(1, b * 1.15) * sw, 1, false);
    }
  };
  colX(st, (st.z - lo) / span, 0.86, 0.8, 0, c3);
  pipe(4, XL, trayY(FT) - 4, trayY(FT) - 1, c3[0], c3[1], c3[2], st.fp[0], 0.78 + 0.22 * cl(st.F * V * 0.5, 0, 1));
  const od = (NT + 1) * 3;
  pipe(XR + 2, 58, 6, 9, pc[od], pc[od + 1], pc[od + 2], st.fp[1], 0.78 + 0.22 * cl(st.D * V * 0.6, 0, 1));
  pipe(XR + 2, 58, 113, 116, pc[0], pc[1], pc[2], st.fp[2], 0.78 + 0.22 * cl(st.B * V * 0.6, 0, 1));

  // out to the panel
  for (let y = 0; y < H; y++)
    for (let xx = 0; xx < W; xx++) {
      const i = (y * W + xx) * 3;
      display.setPixel(xx, y, (min(1, buf[i]) * 255 + 0.5) | 0, (min(1, buf[i + 1]) * 255 + 0.5) | 0, (min(1, buf[i + 2]) * 255 + 0.5) | 0);
    }
}
