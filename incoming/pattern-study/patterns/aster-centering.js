// ===== Patternflow pattern =====
// Title:   Aster Centering
// Family:  cytoskeleton
// Idea:    A microtubule aster sits in a cell as tall as the panel, about a hundred rays growing from its centre at a steady speed and collapsing at random into fast retreats, and the rays that reach the cell wall push the aster back, so it hunts for the middle of a cell whose walls slowly change shape.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dynamic instability of microtubules, each ray growing at a steady speed and collapsing into a fast shrinkage (Mitchison and Kirschner 1984, from memory); the catastrophe and rescue frequencies of the two-state model (Dogterom and Leibler 1993, from memory); a growing tip slowing and collapsing sooner under the force it bears (Dogterom and Yurke 1997, from memory); an aster centred in a cell by the pushing of the rays that reach the wall, longer rays more likely to have collapsed first (Holy, Dogterom, Yurke and Leibler 1997, from memory); the walls that wander in shape, the ray count turned by a knob and the drawing are original, pattern round 244
// Round:   244
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Catastrophe=0.4..4, Squeeze=-1..1, Rays=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; it opens with the growing rays aqua near the core and lime at the tip, the shrinking ones coral to magenta, the core pale and the wall a dim teal that flushes coral where rays push on it.
// Knob 2: Catastrophe. 0.4 to 4, opening at 2: how often a growing ray collapses. At 0.4 the rays run long, most of them reach the wall and stall there, the wall glows hot where they push and the aster is pushed about the cell. At 4 they collapse after a few seconds and the aster is a short busy fuzz that rarely touches the wall.
// Knob 3: Squeeze. -1 to 1, opening at 0: the shape of the cell. At 0 it fills the panel, 56 LED wide and about 116 tall. At -1 it is squeezed short, about 80 LED tall, and the rays reach the top and bottom walls within seconds; at 1 it is squeezed narrow, 34 LED wide, and the aster sits 17 LED from each side wall with the rays piled on both.
// Knob 4: Rays. -1 to 1, opening at 0.06: how many rays the aster has. At -1 there are about 45, bare spokes that you can count; at the opening about 105, a dense star; at 1 about 220 and the core fills with a pale glow.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, log, PI, atan2, cbrt, cos, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const DT = 1 / 30;
const PRE = 45;                // seconds run before the first frame
const NMAX = 230;              // the most rays a knob can ask for
const CX = 32, CY = 64;        // the centre the walls are measured from
const VG = 7;                  // growth speed of a free ray, LED a second
const DEL0 = 2.2;              // how far a ray is squeezed (LED) to slow its growth by a factor e
const FCF = 0.7;               // the force that raises the catastrophe rate by a factor e, in units of DEL0
const FR = 0.2;                // rescue rate a second
const PUSH = 0.11;             // aster speed (LED a second) for each LED of squeeze summed over the rays
const NB = 72;                 // bins round the wall for the pressure glow

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// ---- the palette ------------------------------------------------------------
// Every colour is a hue, saturation and value; K1 adds to the hue of all of them.
function buildColours(st, hue) {
  const c = (h, s, v) => hsv(h + hue, s, v, [0, 0, 0]);
  st.col = {
    g0: c(0.5, 0.5, 1), g1: c(0.23, 0.82, 1),      // growing: aqua at the core, lime far out
    s0: c(0.015, 0.62, 1), s1: c(0.9, 0.8, 1),     // shrinking: coral, then magenta
    cap: c(0.2, 0.22, 1), core: c(0.47, 0.2, 1), halo: c(0.45, 0.6, 1),
    wall: c(0.44, 0.75, 0.75), hot: c(0.015, 0.6, 1), cyto: c(0.4, 0.8, 0.09), ground: c(0.4, 0.8, 0.045),
  };
  st.hue = hue;
}

// ---- the cell ---------------------------------------------------------------
// The wall is a rounded outline, a superellipse of power three, with its own reach to the left, right, top and bottom and a
// slope on the top and bottom walls. Each of the six wanders on its own slow Ornstein-Uhlenbeck path.
const WSIG = [4, 4, 6.5, 6.5, 0.17, 0.17];
function stepWalls(st, dt) {
  const w = st.w, tau = st.wtau, o = st.wo, k = st.k, s = k[2];
  const A = s > 0 ? 28 - 11 * s : 28 + 2 * -s, B = s < 0 ? 58 + 18 * s : 58;
  const g = 1 - exp(-dt / 1.2);
  st.A += (A - st.A) * g;
  st.B += (B - st.B) * g;
  for (let j = 0; j < 6; j++) o[j] += (-o[j] / tau[j]) * dt + WSIG[j] * sqrt((2 * dt) / tau[j]) * gauss();
  w[0] = max(12, st.A + o[0]);
  w[1] = max(12, st.A + o[1]);
  w[2] = max(22, st.B + o[2]);
  w[3] = max(22, st.B + o[3]);
  w[4] = o[4];
  w[5] = o[5];
}
// 1 on the wall, below 1 inside.
function wallF(w, qx, qy) {
  const rx = qx - CX, ry = qy - CY;
  const aX = rx > 0 ? w[1] : w[0];
  const bY = max(14, ry < 0 ? w[2] + w[4] * rx : w[3] + w[5] * rx);
  const u = abs(rx) / aX, v = abs(ry) / bY;
  return u * u * u + v * v * v;
}
// How far from (px, py) along (dx, dy) to the wall.
function wallDist(w, px, py, dx, dy) {
  let lo = 0, hi = 175;
  for (let it = 0; it < 12; it++) {
    const m = (lo + hi) * 0.5;
    if (wallF(w, px + dx * m, py + dy * m) < 1) lo = m;
    else hi = m;
  }
  return lo;
}

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = {
    k: [0, 2, 0, 0.06], init: false, t: 0, acc: 0, hue: -9, col: null,
    px: CX, py: CY, ux: 0, uy: 0,
    len: f(NMAX), dx: f(NMAX), dy: f(NMAX), vg: f(NMAX), vs: f(NMAX), fcm: f(NMAX), frm: f(NMAX), dw: f(NMAX), dl: f(NMAX),
    gs: new Uint8Array(NMAX), act: new Uint8Array(NMAX),
    w: [28, 28, 58, 58, 0, 0], wo: [0, 0, 0, 0, 0, 0], wtau: [0, 0, 0, 0, 0, 0], A: 28, B: 58,
    pr: f(NB), pr2: f(NB),
    R: f(W * H), G: f(W * H), Bl: f(W * H),
  };
  params.st = st;
  return st;
}

function nucleate(st, i) {
  const a = rnd() * 2 * PI;
  st.dx[i] = cos(a);
  st.dy[i] = sin(a);
  st.len[i] = 0;
  st.gs[i] = 1;
  st.act[i] = 1;
  st.vg[i] = VG * (0.7 + 0.6 * rnd());
  st.vs[i] = st.vg[i] * (3 + 2 * rnd());
  st.fcm[i] = exp(0.45 * gauss());
  st.frm[i] = exp(0.45 * gauss());
}

function step(st, dt) {
  const k = st.k, w = st.w;
  stepWalls(st, dt);
  const fc0 = 0.1 * k[1];
  const nT = floor(clampN(105 * exp(0.8 * (k[3] - 0.06))) + 0.5);
  const { len, dx, dy, vg, vs, fcm, frm, dw, dl, gs, act, pr } = st;
  const px = st.px, py = st.py;
  let fx = 0, fy = 0;
  for (let b = 0; b < NB; b++) pr[b] *= exp(-dt / 0.35);
  for (let i = 0; i < NMAX; i++) {
    if (!act[i]) {
      if (i < nT && rnd() < dt * 2) nucleate(st, i);
      continue;
    }
    const d = wallDist(w, px, py, dx[i], dy[i]);
    dw[i] = d;
    let del = len[i] - d;
    if (del < 0) del = 0;
    else if (del > 14) del = 14;
    dl[i] = del;
    const F = del / DEL0;
    if (i >= nT) gs[i] = 0;
    if (gs[i]) {
      len[i] += vg[i] * exp(-F) * dt;
      if (len[i] > d + 14) len[i] = d + 14;
      if (rnd() < 1 - exp(-fc0 * fcm[i] * exp(F * FCF) * dt)) gs[i] = 0;
    } else {
      len[i] -= vs[i] * dt;
      if (i < nT && len[i] > 3 && rnd() < 1 - exp(-FR * frm[i] * dt)) gs[i] = 1;
      if (len[i] <= 0) {
        if (i < nT) nucleate(st, i);
        else (act[i] = 0), (len[i] = 0);
      }
    }
    if (del > 0.25) {
      fx -= del * dx[i];
      fy -= del * dy[i];
      const a = (atan2(py + dy[i] * d - CY, px + dx[i] * d - CX) / (2 * PI) + 0.5) * NB;
      const b0 = floor(a);
      for (let q = -2; q <= 2; q++) {
        const bb = (((b0 + q) % NB) + NB) % NB, e = b0 + q + 0.5 - a;
        pr[bb] += del * 0.04 * exp(-e * e * 0.5);
      }
    }
  }
  // the aster moves under a viscous drag: it follows the net push, with a little thermal shake
  st.px += (PUSH * fx + 0.35 * gauss()) * dt;
  st.py += (PUSH * fy + 0.35 * gauss()) * dt;
  const F = wallF(w, st.px, st.py);
  if (F > 0.45) {
    const s = cbrt(0.45 / F);
    st.px = CX + (st.px - CX) * s;
    st.py = CY + (st.py - CY) * s;
  }
}
function clampN(n) {
  return cl(n, 20, NMAX);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    for (let j = 0; j < 6; j++) {
      st.wtau[j] = 35 + 50 * rnd();
      st.wo[j] = gauss() * WSIG[j] * 0.8;
    }
    const s = st.k[2];
    st.A = s > 0 ? 28 - 11 * s : 28 + 2 * -s;
    st.B = s < 0 ? 58 + 18 * s : 58;
    stepWalls(st, 0);
    const nT = clampN(105 * exp(0.8 * (st.k[3] - 0.06)));
    for (let i = 0; i < nT; i++) {
      nucleate(st, i);
      st.len[i] = rnd() * 40;
      st.gs[i] = rnd() < 0.7 ? 1 : 0;
    }
    for (let i = 0; i < PRE / DT; i++) step(st, DT);
  }
  st.acc += cl(dt || 0, 0, 0.1);
  while (st.acc >= DT) {
    st.acc -= DT;
    st.t += DT;
    step(st, DT);
  }
}

// ---- drawing ----------------------------------------------------------------
// A soft dot: a bump 2R wide, for the rays (R = 1.6, about 1.7 LED across at half height) and for the caps.
function blob(st, x, y, R, a, c) {
  const fx = x - 0.5, fy = y - 0.5;
  const x0 = max(0, floor(fx - R) + 1), x1 = min(W - 1, floor(fx + R)), y0 = max(0, floor(fy - R) + 1), y1 = min(H - 1, floor(fy + R));
  const ir2 = 1 / (R * R), { R: Rb, G: Gb, Bl } = st;
  for (let yy = y0; yy <= y1; yy++) {
    const ey = yy - fy, wy = 1 - ey * ey * ir2;
    if (wy <= 0) continue;
    for (let xx = x0; xx <= x1; xx++) {
      const ex = xx - fx, q = 1 - ex * ex * ir2 - ey * ey * ir2;
      if (q <= 0) continue;
      const v = a * q * q, o = yy * W + xx;
      Rb[o] += v * c[0];
      Gb[o] += v * c[1];
      Bl[o] += v * c[2];
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (!st.col || abs(hue - st.hue) > 1e-4) buildColours(st, hue);
  const col = st.col, w = st.w, { R, G, Bl, pr } = st;
  // pressure: smooth the bins once so the wall glows in patches rather than spikes
  for (let b = 0; b < NB; b++) st.pr2[b] = 0.25 * pr[(b + NB - 1) % NB] + 0.5 * pr[b] + 0.25 * pr[(b + 1) % NB];
  const pr2 = st.pr2, px = st.px, py = st.py;
  // the ground, the cytoplasm and the membrane
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - CY;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - CX, o = y * W + x;
      const aX = rx > 0 ? w[1] : w[0];
      const bY = max(14, ry < 0 ? w[2] + w[4] * rx : w[3] + w[5] * rx);
      const u = rx / aX, v = ry / bY, au = abs(u), av = abs(v);
      const F = au * au * au + av * av * av, rho = cbrt(F);
      const gx = (u * au) / aX, gy = (v * av) / bY;
      const dist = (rho - 1) / (max(0.02, sqrt(gx * gx + gy * gy)) / (rho * rho + 0.01));
      let r, g, b;
      if (dist < -14 || dist > 16) {
        const c = dist < 0 ? col.cyto : col.ground;
        r = c[0]; g = c[1]; b = c[2];
      } else {
        const a = (atan2(ry, rx) / (2 * PI) + 0.5) * NB, b0 = floor(a), fr = a - b0;
        const pv = mix(pr2[b0 % NB], pr2[(b0 + 1) % NB], fr);
        const heat = cl(pv * 0.22, 0, 1);
        const line = 0.3 * exp(-(dist * dist) / 3.9) * (1 + 1.6 * heat) + (dist < 0 ? 0.11 * exp(dist / 4) : 0.1 * exp(-dist / 5.5)) * (1 + 1.2 * heat);
        const base = dist < 0 ? col.cyto : col.ground;
        r = base[0] + line * mix(col.wall[0], col.hot[0], heat);
        g = base[1] + line * mix(col.wall[1], col.hot[1], heat);
        b = base[2] + line * mix(col.wall[2], col.hot[2], heat);
      }
      R[o] = r; G[o] = g; Bl[o] = b;
    }
  }
  // the rays, each a line from the core to its tip, a soft 1.7 LED wide, coloured by state and by how far out
  const { len, dx, dy, dw, dl, gs, act } = st;
  const c = [0, 0, 0];
  for (let i = 0; i < NMAX; i++) {
    if (!act[i]) continue;
    const Lt = min(len[i], dw[i]);
    if (Lt < 1.5) continue;
    const grow = gs[i] === 1, c0 = grow ? col.g0 : col.s0, c1 = grow ? col.g1 : col.s1;
    const ds = Lt > 40 ? 0.75 : 0.6, tipDim = grow ? 0.5 : 0.55;
    for (let s = 0.8; s < Lt; s += ds) {
      const u = min(1, s / 56);
      c[0] = mix(c0[0], c1[0], u); c[1] = mix(c0[1], c1[1], u); c[2] = mix(c0[2], c1[2], u);
      const prof = (0.22 + 0.78 * exp(-s / 24)) * mix(tipDim, 1, sstep(0, 6, Lt - s)) * (0.12 + 0.88 * sstep(0, 17, s));
      blob(st, px + dx[i] * s, py + dy[i] * s, 1.6, 0.17 * prof * (grow ? 1 : 1.6), c);
    }
    if (grow) {
      const hot = dl[i] > 0.3 ? 1 + 0.35 * min(dl[i], 6) : 1;
      blob(st, px + dx[i] * Lt, py + dy[i] * Lt, 2.2, 0.5 * hot, col.cap);
    }
  }
  // the core: a bright soft disc with a wide halo
  const x0 = max(0, floor(px - 24)), x1 = min(W - 1, floor(px + 24)), y0 = max(0, floor(py - 24)), y1 = min(H - 1, floor(py + 24));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ex = x + 0.5 - px, ey = y + 0.5 - py, r2 = ex * ex + ey * ey, o = y * W + x;
      const a = 0.55 * exp(-r2 / 9), h = 0.08 * exp(-r2 / 70);
      R[o] += a * col.core[0] + h * col.halo[0];
      G[o] += a * col.core[1] + h * col.halo[1];
      Bl[o] += a * col.core[2] + h * col.halo[2];
    }
  }
  // tone: each channel is bent by 1 - e^-x so that the dense field round the core stays a glow
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      display.setPixel(x, y, (255 * (1 - exp(-1.25 * R[o]))) | 0, (255 * (1 - exp(-1.25 * G[o]))) | 0, (255 * (1 - exp(-1.25 * Bl[o]))) | 0);
    }
  }
}
