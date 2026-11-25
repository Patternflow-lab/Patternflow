// ===== Patternflow pattern =====
// Title:   Mimosa
// Family:  nastic
// Idea:    The feathered leaves of a sensitive plant stand along an endless stem that the view climbs, and wherever something touches a leaflet the pairs fold shut one after another along the pinna, through the hub into its sisters and down a stalk that drops, then open again slowly from the base outward.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the touch response of Mimosa pudica, the sensitive plant: leaflets that fold in pairs and a petiole that drops at its pulvinus, the signal running along the rachis and on through the stem (Robert Hooke wrote about the plant in Micrographia, 1665; Jagadish Chandra Bose measured the travelling signal in the early 1900s; both from memory); the hashed endless stem, the budget of pairs a touch can spend, the rest a pinna takes after it reopens and the crane up the stem are original, pattern round 253
// Round:   253
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Touch=-1..1, Shy=0..1
//
// Knob 1: Hue. Turns the plant's colours round the wheel together; it opens on fresh green leaflets with pale blue-green undersides, red rachises and a red-purple stem.
// Knob 2: Speed. 0.3 to 3, opening at 2. The plant's clock: how fast the fold runs, how soon the pairs reopen, how quick the breeze is, how often the touches come and how fast the view climbs the stem, from about 0.65 LEDs a second to about 2.5.
// Knob 3: Touch. -1 to 1, opening at 0. How often something touches a leaflet, on the plant's clock: once in 12 seconds at -1, every 2 to 3 seconds at 0, four times a second at 1, where it is rain, every drop a ring, and about half the leaflets are shut at any moment.
// Knob 4: Shy. 0 to 1, opening at 0.06. How far one touch spreads: at 0 a few pairs round it fold and the wave dies; at 0.06 it takes most of a pinna, and one touch in five crosses the hub and shuts the leaf; by 0.3 the leaf shuts and its stalk drops; from 0.5 the signal runs on along the stem, and at 1 every leaf on the panel folds and hangs.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, cos, log, PI } = Math;
const TP = 2 * PI, DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const ZIG = 3.5;               // the stem leans away from each leaf
const S0 = 7;                  // bare rachis between the hub and the first pair
const A_OPEN = 70 * DEG, A_SHUT = 12 * DEG;   // a leaflet's angle to the rachis, open and folded
const RL = 1.15;               // half the width of a leaflet
const VW = 7;                  // pairs a second the fold travels
const TF = 0.25, TO = 1.3;     // seconds a pair takes to fold and to reopen
const GATE = 0.6;              // a pair starts to reopen once the pair below it is this far open
const HUBC = 8, DROOPC = 3, STEMC = 30;   // what crossing the hub costs, what a droop needs, what the stem costs
const CRANE = 1.8;             // LEDs a second the view climbs at the opening speed

function hsh(a, b, s) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ s;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the plant: one leaf from its number, and each side's nodes a hashed step above the last ----
const SA = 1 / sin(A_OPEN);
// the two sides keep their own count, so left and right leaves drift past each other and no stretch of stem comes twice
const gapOf = (c, sd, s) => 60 + 36 * hsh(c, 1 + sd, s);
const stemX = (y, s) => 32 + 7.5 * sin(y * 0.0091 + (s & 255)) + 4.5 * sin(y * 0.0233 + ((s >> 8) & 255));
function mkLeaf(k, s, ny, side) {
  const u = (n) => hsh(k, n, s ^ 0x5a5);
  const nx = stemX(ny, s) - side * ZIG;
  // the stem wanders across the panel, and a leaf grows to the room it has on its side:
  // a small steep pair of pinnae where the edge is near, a wide fan of long ones where it is far
  const room = cl(((side > 0 ? W - nx : nx) - 16) / 30, 0, 1);
  const np = u(2) < 0.75 - 0.9 * room ? 2 : u(2) < 1.25 - 0.55 * room ? 3 : 4;
  const fs = ((np === 2 ? 40 : np === 3 ? 30 : 27) + 6 * (u(6) - 0.5)) * DEG;
  const lo = 6 * DEG + (np - 1) / 2 * fs, hi = 92 * DEG - (np - 1) / 2 * fs;
  const L = {
    k, q: 0, side, nx, ny, np, fs,
    lp: 9 + 6 * room + 6 * u(3), ap0: (36 + 28 * u(4)) * DEG,
    ax0: cl((24 + 36 * room + 16 * (u(5) - 0.5)) * DEG, lo, max(lo, hi)),
    sp: 4 + 0.7 * u(7), ll: np === 4 ? 5.8 + 1.2 * u(8) : 6.2 + 2.6 * u(8),
    w1: 0.6 + 0.9 * u(9), w2: 1.3 + 1.1 * u(10), p1: TP * u(11), p2: TP * u(12),
    w3: 0.05 + 0.06 * u(62), w4: 0.13 + 0.1 * u(63), p3: TP * u(64), p4: TP * u(65),
    fl: u(13) < 0.2, fa: (28 + 16 * u(15)) * DEG, fl2: 13 + 5 * u(16), fr: 3.8 + 1.3 * u(66),
    hue: 0.08 * (u(14) - 0.5), val: 0.74 + 0.26 * u(17),
    // where this leaf hangs when it droops, how far its fan closes, how long it stays shut
    da: (140 + 44 * u(18)) * DEG, dp: (118 + 46 * u(61)) * DEG, ds: 0.2 + 0.65 * u(19), rf: 0.65 + 0.9 * u(60),
    dr: 0, drT: 0, hold: 0, wait: 0, kt: 0, kk: 0, re: 0, dead: false, pins: [],
    hx: 0, hy: 0, ap: 0, ax: 0, spr: 1, sw: 0,
  };
  for (let j = 0; j < np; j++) {
    // the pinna nearest the panel's edge is the shortest, as the lowest pair is on the plant
    const n = cl(floor(6.5 + 4.2 * room + 4 * u(20 + j)) - (np > 2 && j === np - 1 ? 1 : 0), 6, 13);
    L.pins.push({
      n, f: new Float32Array(n), st: new Uint8Array(n), tm: new Float32Array(n),
      k0: 0.009 * u(30 + j) - 0.002, dj: 0.5 * (u(70 + j) - 0.5), kd: 0.016 * (u(80 + j) - 0.5), kt: 0, kk: 0, re: 0, w: 0.9 + 1.3 * u(40 + j), p: TP * u(50 + j), kap: 0,
    });
  }
  return L;
}
// where the leaf stands at plant time T: the stalk's angle, the hub, the fan and each rachis's bend
function pose(L, T) {
  const d = L.dr;
  // the breeze comes up the stem in slow swells, and each leaf answers on its own two beats
  const gu = 0.7 + 0.6 * sin(0.19 * T - 0.021 * L.ny + L.p2);
  const sway = gu * (0.04 * sin(L.w1 * T + L.p1) + 0.022 * sin(L.w2 * T + L.p2));
  // and through the minutes a leaf lifts, sinks and spreads a little, as leaves follow the light
  const slow = 0.12 * (sin(L.w3 * T + L.p3) + 0.6 * sin(L.w4 * T + L.p4));
  L.sw = sway;
  L.ap = L.ap0 + d * (L.dp - L.ap0) + 0.4 * sway + 0.5 * slow;
  L.ax = L.ax0 + d * (L.da - L.ax0) + sway * (1 + 2.5 * d) + slow + L.kk * (0.5 + d);
  L.spr = (1 - (1 - L.ds) * d) * (1 + 0.15 * sin(0.77 * L.w4 * T + L.p1));
  L.hx = L.nx + L.side * sin(L.ap) * L.lp;
  L.hy = L.ny + cos(L.ap) * L.lp;
  for (let j = 0; j < L.np; j++) {
    const P = L.pins[j];
    P.kap = P.k0 * (1 - d) + P.kd * d + P.kk + 0.003 * sin(0.083 * P.w * T + 1.9 * P.p) + (1 + 1.5 * d) * (0.0016 * sin(P.w * T + P.p) + 0.0009 * sin(P.w * 1.618 * T + 2.3 * P.p));
  }
}
// the pairs of one pinna: where each sits on the rachis and which way the rachis runs there
const PX = new Float64Array(24), PY = new Float64Array(24), TX = new Float64Array(24), TY = new Float64Array(24);
function pinna(L, j) {
  const P = L.pins[j], n = P.n, sp = L.sp, sd = L.side;
  const phi = L.ax + (j - (L.np - 1) / 2) * L.fs * L.spr + P.dj * L.dr;
  let s = S0, a = phi + P.kap * S0 * 0.5;
  let x = L.hx + sd * sin(a) * S0, y = L.hy + cos(a) * S0;
  for (let i = 0; i <= n; i++) {
    a = phi + P.kap * s;
    PX[i] = x; PY[i] = y; TX[i] = sd * sin(a); TY[i] = cos(a);
    const am = phi + P.kap * (s + sp / 2), q = i === n - 1 ? 1.6 : sp;
    x += sd * sin(am) * q; y += cos(am) * q; s += sp;
  }
}

// ---- the plant's clock ------------------------------------------------------------------
// a pair that is already shut lets the signal by and keeps its own time, and a pinna that is opening
// again rests: nothing folds it until a moment after it is open, so rain cannot hold a leaf shut for good
function trig(P, i, tr, T) { if (P.st[i] !== 1 && T >= P.re) { P.st[i] = 1; P.tm[i] = tr; } }

function hubEvent(st, L, E, from, dir, tr) {
  // once through the hub the fold runs each sister to its tip
  for (let j = 0; j < L.np; j++) if (j !== from) st.fronts.push({ L, j, pos: -1.8 - 0.8 * Math.random(), dir: 1, E: 1e9, tr });
  if (E >= DROOPC && st.T >= L.re) {
    if (L.hold <= 0) L.wait = 0.45;
    L.drT = max(L.drT, cl(0.45 + E / 110, 0, 1));    // a weak signal lets the stalk sink half way
    L.hold = max(L.hold, 0.45 + tr * 0.5 * L.rf);
  }
  if (E >= STEMC) {
    if (dir >= 0) st.pend.push({ t: st.T + 0.7, k: L.q + 1, E: E - STEMC, dir: 1, tr });
    if (dir <= 0) st.pend.push({ t: st.T + 0.7, k: L.q - 1, E: E - STEMC, dir: -1, tr });
  }
}

function touch(st) {
  const Ls = st.leaves;
  if (!Ls.length) return;
  for (let tries = 0; tries < 12; tries++) {
    const L = Ls[floor(Math.random() * Ls.length)];
    const j = floor(Math.random() * L.np), P = L.pins[j];
    const i = floor(Math.random() * P.n), sg = Math.random() < 0.5 ? 1 : -1;
    pinna(L, j);
    const wx = PX[i] + sg * TY[i] * 3.5, wy = PY[i] - sg * TX[i] * 3.5;
    const sy = H - (wy - st.cam);
    if (wx < 3 || wx > W - 3 || sy < 3 || sy > H - 3) continue;
    // a touch that will be answered rings wide and bright, one that will not rings small
    st.rings.push({ x: wx, y: wy, t: 0, a: P.f[i] > 0.3 || st.T < P.re ? 0.65 : 1 });
    // the touch pushes the pinna down and the whole leaf nods, and both spring back
    P.kt += (0.0025 + 0.002 * Math.random()) * (1.6 - i / P.n);
    L.kt += 0.03 + 0.04 * Math.random();
    // a shut or resting leaflet shows the ring and does not answer, so a shut plant is left alone to open
    if (P.f[i] > 0.3 || st.T < P.re) return;
    const s = cl(st.ks[3], 0, 1), r = Math.random();
    const E = (2 + 6 * (1 - exp(-s / 0.03)) + 300 * s * s * s) * (0.6 + 1.6 * r * r);
    const tr = 4 + 2.5 * Math.random();
    trig(P, i, tr * L.rf, st.T);
    st.fronts.push({ L, j, pos: i, dir: 1, E, tr }, { L, j, pos: i, dir: -1, E, tr });
    return;
  }
}

function tend(st) {
  const s = st.seed, lo = st.cam - 70, hi = st.cam + H + 55, Ls = st.leaves;
  while (Ls.length && Ls[0].ny < lo) Ls.shift().dead = true;
  for (;;) {
    const sd = st.ny[0] <= st.ny[1] ? 0 : 1;
    let y = st.ny[sd];
    if (y >= hi) break;
    if (y - st.lastY < 20) y = st.lastY + 20;     // two nodes never share a bend of the stem
    st.lastY = y;
    const c = st.nc[sd]++;
    st.ny[sd] = y + gapOf(c, sd, s);
    const L = mkLeaf(c * 2 + sd, s, y, sd ? 1 : -1);
    L.q = st.q++; pose(L, st.T); Ls.push(L);
  }
}

// one step of plant time
function sim(st, dts) {
  st.T += dts;
  tend(st);
  // touches
  const k3 = cl(st.ks[2], -1, 1);
  const gap = 2.5 * exp(-k3 * (k3 < 0 ? 1.57 : 2.3));
  if (st.next > 3 * gap) st.next = 3 * gap;
  st.next -= dts;
  for (let g = 0; st.next <= 0 && g < 8; g++) { touch(st); st.next += -gap * log(1 - 0.999 * Math.random()); }
  // signals that were on their way along the stem
  for (let n = st.pend.length - 1; n >= 0; n--) {
    const e = st.pend[n];
    if (e.t > st.T) continue;
    st.pend.splice(n, 1);
    for (const L of st.leaves) if (L.q === e.k) hubEvent(st, L, e.E, -1, e.dir, e.tr);
  }
  // fold fronts
  const fr = st.fronts;
  let m = 0;
  for (let n = 0; n < fr.length; n++) {
    const F = fr[n];
    if (F.L.dead) continue;
    const P = F.L.pins[F.j], to = F.pos + F.dir * VW * dts;
    let alive = true;
    if (F.dir > 0) {
      for (let i = floor(F.pos) + 1; i <= to && alive; i++) {
        if (i < 0) continue;
        if (i >= P.n) { alive = false; break; }
        trig(P, i, F.tr * F.L.rf, st.T);
        if (--F.E <= 0) alive = false;
      }
    } else {
      for (let i = Math.ceil(F.pos) - 1; i >= to && alive; i--) {
        if (i < 0) {
          alive = false;
          if (F.E >= HUBC) hubEvent(st, F.L, F.E - HUBC, F.j, 0, F.tr);
          break;
        }
        trig(P, i, F.tr * F.L.rf, st.T);
        if (--F.E <= 0) alive = false;
      }
    }
    F.pos = to;
    if (alive) fr[m++] = F;
  }
  fr.length = m;
  // pairs and stalks
  for (const L of st.leaves) {
    for (let j = 0; j < L.np; j++) {
      const P = L.pins[j], f = P.f, sx = P.st, tm = P.tm;
      P.kt *= exp(-dts / 0.5); P.kk += (P.kt - P.kk) * (1 - exp(-dts / 0.07));
      for (let i = 0; i < P.n; i++) {
        if (sx[i] === 1) {
          f[i] = min(1, f[i] + dts / TF);
          tm[i] -= dts;
          // the stalk lifts first, then the pairs open from the base outward
          if (tm[i] <= 0 && f[i] >= 1 && L.dr < 0.2 && (i === 0 || f[i - 1] < GATE)) {
            sx[i] = 2; tm[i] = 0;
            if (st.T >= P.re) {
              let c = 0;
              for (let q = 0; q < P.n; q++) if (sx[q] === 1) c++;
              P.re = st.T + 0.55 * c + TO + (0.6 + 1.8 * Math.random()) * L.rf;
              if (L.re < P.re) L.re = P.re;
            }
          }
        } else if (sx[i] === 2) {
          f[i] -= dts / TO;
          if (f[i] <= 0) { f[i] = 0; sx[i] = 0; }
        }
      }
    }
    if (L.hold > 0) { L.hold -= dts; if ((L.wait -= dts) <= 0) L.dr += (L.drT - L.dr) * (1 - exp(-dts / 0.32)); }
    else { L.drT = 0; L.dr -= L.dr * (1 - exp(-dts / 0.9)); }
    L.kt *= exp(-dts / 0.6); L.kk += (L.kt - L.kk) * (1 - exp(-dts / 0.08));
    pose(L, st.T);
  }
  const rg = st.rings;
  m = 0;
  for (let n = 0; n < rg.length; n++) { rg[n].t += dts; if (rg[n].t < 0.5) rg[m++] = rg[n]; }
  rg.length = m;
}

export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    seed: floor(Math.random() * 1e9) | 0,
    T: 100 * Math.random(), cam: 4000 * Math.random(), next: 0.4, nc: [floor(1e6 * Math.random()), floor(1e6 * Math.random())], ny: [0, 0], lastY: -1e9, q: 0,
    leaves: [], fronts: [], pend: [], rings: [],
    fb: new Float32Array(W * H * 3),
  });
  // open where the stem stands near the middle of the panel, with a leaf's room on both sides
  for (let n = 0; n < 300; n++, st.cam += 9) {
    if (Math.abs(stemX(st.cam + 35, st.seed) - 32) < 4 && Math.abs(stemX(st.cam + 95, st.seed) - 32) < 6) break;
  }
  st.ny = [st.cam - 46 + 12 * Math.random(), st.cam - 6 + 12 * Math.random()];
  if (Math.random() < 0.5) st.ny.reverse();
  return st;
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // the plant has been touched at this rate for a while before the panel lights
    for (let n = 0; n < 700; n++) sim(st, 0.05);
    st.rings.length = 0;
  }
  if (dt <= 0) return;
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  const ts = 0.25 + 0.375 * cl(st.ks[1], 0.3, 3);
  st.cam += CRANE * ts * dt;
  sim(st, dt * ts);
}

// ---- drawing ----------------------------------------------------------------------------
// a round-ended stroke, lit g0 at its first end and g1 at its second
function cap(fb, x0, y0, x1, y1, r, cr, cg, cb, al, g0, g1) {
  const xa = max(0, floor(min(x0, x1) - r - 0.5)), xb = min(W - 1, floor(max(x0, x1) + r + 0.5));
  const ya = max(0, floor(min(y0, y1) - r - 0.5)), yb = min(H - 1, floor(max(y0, y1) + r + 0.5));
  if (xa > xb || ya > yb) return;
  const dx = x1 - x0, dy = y1 - y0, il = 1 / (dx * dx + dy * dy + 1e-9);
  for (let y = ya; y <= yb; y++) {
    const qy = y + 0.5 - y0;
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - x0;
      const t = cl((qx * dx + qy * dy) * il, 0, 1);
      const ex = qx - t * dx, ey = qy - t * dy;
      const c = r + 0.5 - sqrt(ex * ex + ey * ey);
      if (c <= 0) continue;
      const a = (c > 1 ? 1 : c) * al, g = g0 + (g1 - g0) * t, o = (y * W + x) * 3;
      fb[o] += (cr * g - fb[o]) * a; fb[o + 1] += (cg * g - fb[o + 1]) * a; fb[o + 2] += (cb * g - fb[o + 2]) * a;
    }
  }
}

const tmp = [0, 0, 0];
const CG = [0, 0, 0], CU = [0, 0, 0], CS = [0, 0, 0], CR = [0, 0, 0], CF = [0, 0, 0];
function tone(out, h, s, v) {
  hsv(h, s, 1, tmp);
  // blue and violet are dark on an LED, so they lift a little
  const Y = 0.299 * tmp[0] + 0.587 * tmp[1] + 0.114 * tmp[2];
  const lift = max(0, 0.5 - Y) * 0.6;
  // and a dim amber reads as brown on the panel, so whatever turns orange is kept bright
  const wa = 0.5 + 0.5 * cos(TP * (h - 0.11));
  v += (1 - v) * 0.75 * wa * wa * wa;
  for (let c = 0; c < 3; c++) out[c] = v * min(1, tmp[c] + lift);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const fb = st.fb, cam = st.cam, s = st.seed, hk = st.ks[0];
  const SY = (y) => H - (y - cam);
  // a leaflet's upper face and its underside are toned leaf by leaf below
  tone(CS, hk + 0.875, 0.6, 0.62);   // stem and stalks
  tone(CR, hk + 0.985, 0.55, 0.88);     // rachis
  tone(CF, hk + 0.87, 0.45, 1);       // flower head
  fb.fill(0);

  // the stem, an S from each node to the next
  const Ls = st.leaves;
  for (let q = 0; q + 1 < Ls.length; q++) {
    const xa = Ls[q].nx, ya = Ls[q].ny, xb = Ls[q + 1].nx, yb = Ls[q + 1].ny;
    let px = xa, py = ya;
    for (let n = 1; n <= 6; n++) {
      const u = n / 6, e = u * u * (3 - 2 * u);
      const x = xa + (xb - xa) * e, y = ya + (yb - ya) * u;
      cap(fb, px, SY(py), x, SY(y), 1, CS[0], CS[1], CS[2], 1, 1, 1);
      px = x; py = y;
    }
  }
  // stalks
  for (const L of st.leaves) {
    const ca = L.ap - 0.25 * (1 - L.dr), h = 0.5 * L.lp;
    const mx = L.nx + L.side * sin(ca) * h, my = L.ny + cos(ca) * h;
    let px = L.nx, py = L.ny;
    for (let n = 1; n <= 4; n++) {
      const u = n / 4, v = 1 - u;
      const x = v * v * L.nx + 2 * u * v * mx + u * u * L.hx, y = v * v * L.ny + 2 * u * v * my + u * u * L.hy;
      cap(fb, px, SY(py), x, SY(y), 0.95, CS[0], CS[1], CS[2], 1, 1, 1);
      px = x; py = y;
    }
  }
  // leaves
  for (const L of st.leaves) {
    const hw = sin(L.fs / 2);
    tone(CG, hk + 0.29 + L.hue, 0.62, 0.9 * L.val);
    tone(CU, hk + 0.47 + 1.2 * L.hue, 0.36, 0.86 + 0.14 * L.val);
    for (let j = 0; j < L.np; j++) {
      pinna(L, j);
      const P = L.pins[j], n = P.n;
      for (let i = 0; i < n; i++) {
        const f = P.f[i], e = f * f * (3 - 2 * f);
        const a = A_OPEN + (A_SHUT - A_OPEN) * e + (hsh(L.k * 8 + j, i, s) - 0.5) * 0.1 * (1 - e);
        // short by the hub, where the pinnae stand close, so each comb keeps a dark wedge beside it
        const l = cl(((S0 + i * L.sp) * hw + 0.4) * SA, 3.2, L.ll) * (i === n - 1 ? 0.7 : i === n - 2 ? 0.88 : 1);
        const ca = cos(a), sa = sin(a), tx = TX[i], ty = TY[i];
        const cr = CG[0] + (CU[0] - CG[0]) * e, cg = CG[1] + (CU[1] - CG[1]) * e, cb = CG[2] + (CU[2] - CG[2]) * e;
        for (let sg = -1; sg <= 1; sg += 2) {
          const dx = ca * tx + sg * sa * ty, dy = ca * ty - sg * sa * tx;
          const bx = PX[i] + dx * 0.6, by = PY[i] + dy * 0.6;
          cap(fb, bx, SY(by), bx + dx * l, SY(by + dy * l), RL, cr, cg, cb, 1, 0.8, 1);
        }
      }
      // the rachis shows between open leaflets and is covered where they have folded over it
      cap(fb, L.hx, SY(L.hy), PX[0], SY(PY[0]), 0.8, CR[0], CR[1], CR[2], 1, 1, 1);
      for (let i = 0; i < n; i++) {
        const al = 1 - 0.9 * max(P.f[i], i + 1 < n ? P.f[i + 1] : 0);
        cap(fb, PX[i], SY(PY[i]), PX[i + 1], SY(PY[i + 1]), 0.8, CR[0], CR[1], CR[2], al, 1, 1);
      }
    }
    cap(fb, L.hx, SY(L.hy), L.hx, SY(L.hy), 1.3, CS[0], CS[1], CS[2], 1, 1, 1);
  }
  // a flower head now and then, a soft round tuft on its own stalk in the gap between two leaves
  for (const L of st.leaves) {
    if (!L.fl) continue;
    const a = L.fa + 0.6 * L.sw;
    const fx = L.nx - L.side * sin(a) * L.fl2, fy = L.ny + cos(a) * L.fl2;
    cap(fb, L.nx, SY(L.ny), fx, SY(fy), 0.75, CS[0], CS[1], CS[2], 1, 1, 1);
    const cx = fx, cy = SY(fy), R = L.fr;
    const xa = max(0, floor(cx - R - 1)), xb = min(W - 1, floor(cx + R + 1));
    const ya = max(0, floor(cy - R - 1)), yb = min(H - 1, floor(cy + R + 1));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const d = sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy));
      const c = 1 - sstep(R - 2.2, R + 0.6, d);
      if (c <= 0) continue;
      const wv = 0.55 * (1 - sstep(0, R - 1, d)), o = (y * W + x) * 3;
      fb[o] += (CF[0] + (1 - CF[0]) * wv - fb[o]) * c; fb[o + 1] += (CF[1] + (1 - CF[1]) * wv - fb[o + 1]) * c; fb[o + 2] += (CF[2] + (1 - CF[2]) * wv - fb[o + 2]) * c;
    }
  }
  // touches: a ring that opens and fades
  for (const g of st.rings) {
    const u = g.t / 0.5, rr = 1.2 + (7 * g.a - 2) * (1 - (1 - u) * (1 - u)), al = g.a * min(1, 2.2 * (1 - u));
    const cx = g.x, cy = SY(g.y);
    const xa = max(0, floor(cx - rr - 2)), xb = min(W - 1, floor(cx + rr + 2));
    const ya = max(0, floor(cy - rr - 2)), yb = min(H - 1, floor(cy + rr + 2));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const d = Math.abs(sqrt((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy)) - rr);
      const c = cl(1.5 - d, 0, 1) * al;
      if (c <= 0) continue;
      const o = (y * W + x) * 3;
      fb[o] += (1 - fb[o]) * c; fb[o + 1] += (1 - fb[o + 1]) * c; fb[o + 2] += (1 - fb[o + 2]) * c;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = (y * W + x) * 3;
      display.setPixel(x, y, (fb[f] * 255 + 0.5) | 0, (fb[f + 1] * 255 + 0.5) | 0, (fb[f + 2] * 255 + 0.5) | 0);
    }
  }
}
