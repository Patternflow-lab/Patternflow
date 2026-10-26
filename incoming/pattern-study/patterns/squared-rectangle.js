// ===== Patternflow pattern =====
// Title:   Squared Rectangle
// Family:  cells
// Idea:    A network of resistors between a top and a bottom pole is drawn the way Brooks, Smith, Stone and Tutte drew it, one tile per wire with the voltage drop for its height and the current for its width, so the tiles always fill one tall rectangle exactly while the conductances wander and stretch them, and every few seconds the conductances all come back to 1 and the tiling snaps into squares, with a new network now and then giving a new squared rectangle.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: squared rectangles from electrical networks (R. L. Brooks, C. A. B. Smith, A. H. Stone and W. T. Tutte, 1940), after Zbigniew Moroń's first squared rectangle (1925), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tiles=13..20, Wander=-1..1
//
// Knob 1: Hue. Turns the palette round the wheel. A tile's colour comes from its size against the biggest and smallest tiles shown: at 0 the biggest is teal, the middling ones blue, violet and pink, and the smallest orange.
// Knob 2: Speed. At 2 a cycle takes 8 seconds: the squares hold for 1.2, the conductances drift for 5.6, and the tiling snaps back into squares at the end of the eighth second with a flash on every seam. Every second cycle the network is rewired; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Tiles. How many wires the network has, so how many squares the snap shows, from 13 to 20. Rewiring keeps the count within one of the knob; at 16, 17 and 19 the first rectangle shown is perfect, every square a different size.
// Knob 4: Wander. How far each conductance drifts from 1: within a factor of 1.4 at -1, 2 at the opening 0.06, and 4.5 at 1.
// Buttons: K1 tap snaps the tiling into squares now.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, sqrt, log, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => ((u = cl(u, 0, 1)), u * u * (3 - 2 * u));

// The network lives on a triangular lattice of 3 by 4 nodes, the top pole
// above it wired to the first row and the bottom pole below wired to the
// last. Positions only fix the order of the wires round each node, which
// is all the drawing needs: the plane picture says which faces lie on
// either side of a wire.
const CW = 3, RW = 4, NI = CW * RW, PS = NI, PT = NI + 1, NN = NI + 2;
const NX = [], NY = [];
for (let j = 0; j < RW; j++) for (let i = 0; i < CW; i++) NX.push(i + (j % 2) * 0.5), NY.push(-j * 0.866);
NX.push(1.25, 1.25);
NY.push(1.5, -(RW - 1) * 0.866 - 1.5);
const EU = [], EW = [];
const wire = (u, w) => (EU.push(u), EW.push(w));
for (let j = 0; j < RW; j++)
  for (let i = 0; i < CW; i++) {
    const p = j * CW + i, k = j % 2 ? i + 1 : i - 1;
    if (i + 1 < CW) wire(p, p + 1);
    if (j + 1 < RW) {
      wire(p, p + CW);
      if (k >= 0 && k < CW) wire(p, (j + 1) * CW + k);
    }
  }
for (let i = 0; i < CW; i++) wire(PS, i), wire((RW - 1) * CW + i, PT);
// Wire NE is the battery, leaving the top pole upward and reaching the
// bottom pole from below, round the outside.
const NE = EU.length;

// Networks, one walk per Tiles setting from 13 to 20. Each is a set of
// wires written as a bitmask in base 36, and two neighbours in a walk differ
// by one or two wires. They were picked so that at conductance 1 no wire
// carries zero current, the rectangle stands 1.75 to 2.35 times as tall as
// it is wide and the smallest square is at least 4.5 LEDs. Walks 16, 17
// and 19 open on perfect squared rectangles of orders 16, 17 and 19.
const WALKS = [
  "46p4dk 47xze0 47y2js 47y3ag 46qjoo 46qiy0 46npt4 46qiw8 46p548 46p554",
  "46mus8 46pniw 46qyxk 46qzbk 464le8 46o9cg 46r0wg 46pmfk 46k060 46lemw",
  "46pmfs 46pmcc 46k1ng 46musc 47vsyg 46o9co 46qzbs 464leg 46pnx4 46q0d4",
  "6c9fh7 69sxp7 69sxln 6l1h5n 6l1h5m 6l02oq 6l2vtm 6jwqsa 6m3el6 6m3ehn",
  "8k66kn 8hoa87 8hpop3 7xqhxr 808ea7 6catzj 6casf3 6c9dy7 69rj6n 69sxr2",
  "5iz8d7 6cy0ij 6d287v 6dj317 6m9q8r 6ma2or 6jtkwr 6jxsm3 6juzkr 26jdsr",
  "3syppz 3t02pj 3t02lz 3szwan 3t01tr 3t03en 3syou7 47y2wv 4cxvlq 4cxvlp",
  "8glqwb 8gg4mz 8gg5f7 8gg5ff 8gg5fc 8gg3y0 7mhbso 4am77c 4am9ko 4am9kc",
].map((s) => s.split(" ").map((w) => parseInt(w, 36)));
const has = (m, e) => floor(m / 2 ** e) % 2 === 1;
const apart = (a, b) => {
  let d = 0;
  for (let e = 0; e < NE; e++) d += has(a, e) !== has(b, e);
  return d;
};

// The plane structure of a set of wires: which nodes take part, and for
// each wire the face on its left going from EU to EW (half 2e) and going
// back (half 2e + 1). Faces are traced by turning clockwise at each node.
function build(S, mask) {
  const on = [];
  for (let e = 0; e < NE; e++) if (has(mask, e)) on.push(e);
  const adj = [];
  for (let u = 0; u < NN; u++) adj.push([]);
  for (const e of on) {
    const u = EU[e], w = EW[e];
    adj[u].push([atan2(NY[w] - NY[u], NX[w] - NX[u]), e, w]);
    adj[w].push([atan2(NY[u] - NY[w], NX[u] - NX[w]), e, u]);
  }
  adj[PS].push([PI / 2, NE, PT]);
  adj[PT].push([-PI / 2, NE, PS]);
  for (const l of adj) l.sort((p, q) => p[0] - q[0]);
  const half = (e, from) => 2 * e + (e === NE ? (from === PS ? 0 : 1) : from === EU[e] ? 0 : 1);
  const face = new Int32Array(2 * NE + 2).fill(-1);
  let nf = 0;
  for (let u0 = 0; u0 < NN; u0++)
    for (const h0 of adj[u0]) {
      if (face[half(h0[1], u0)] >= 0) continue;
      let u = u0, h = h0;
      while (face[half(h[1], u)] < 0) {
        face[half(h[1], u)] = nf;
        const l = adj[h[2]];
        let k = 0;
        while (l[k][1] !== h[1]) k++;
        u = h[2];
        h = l[(k + l.length - 1) % l.length];
      }
      nf++;
    }
  // Unknown node potentials: the inner nodes some wire touches.
  const idx = new Int32Array(NN).fill(-1);
  let n = 0;
  for (const e of on) for (const u of [EU[e], EW[e]]) if (u < NI && idx[u] < 0) idx[u] = n++;
  // An order to fix the face potentials: across wire e the left face sits
  // higher than the right by the current along it.
  const known = new Uint8Array(nf), order = [];
  known[face[2 * NE]] = 1;
  for (let more = true; more; ) {
    more = false;
    for (const e of [...on, NE]) {
      const a = face[2 * e], b = face[2 * e + 1];
      if (known[a] && !known[b]) order.push([e, a, b, -1]), (known[b] = 1), (more = true);
      else if (known[b] && !known[a]) order.push([e, b, a, 1]), (known[a] = 1), (more = true);
    }
  }
  Object.assign(S, { on, face, nf, idx, n, order, phi: new Float64Array(nf) });
}

// Kirchhoff: solve for the node potentials with the top pole at 1 and the
// bottom at 0, then lay every wire out as a tile.
function solve(S) {
  const { on, idx, n, c, v, cur, face, order, phi, tiles } = S;
  const A = S.A;
  for (let i = 0; i < n; i++) A[i].fill(0, 0, n + 1);
  for (const e of on) {
    const g = c[e], u = EU[e], w = EW[e], iu = idx[u], iw = idx[w];
    if (iu >= 0) {
      A[iu][iu] += g;
      if (iw >= 0) A[iu][iw] -= g;
      else if (w === PS) A[iu][n] += g;
    }
    if (iw >= 0) {
      A[iw][iw] += g;
      if (iu >= 0) A[iw][iu] -= g;
      else if (u === PS) A[iw][n] += g;
    }
  }
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (abs(A[k][i]) > abs(A[p][i])) p = k;
    const t = A[i];
    (A[i] = A[p]), (A[p] = t);
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / A[i][i];
      if (f) for (let m = i; m <= n; m++) A[k][m] -= f * A[i][m];
    }
  }
  v.fill(0);
  v[PS] = 1;
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n];
    for (let m = i + 1; m < n; m++) s -= A[i][m] * S.x[m];
    S.x[i] = s / A[i][i];
  }
  for (let u = 0; u < NI; u++) if (idx[u] >= 0) v[u] = S.x[idx[u]];
  let I = 0;
  for (const e of on) {
    cur[e] = c[e] * (v[EU[e]] - v[EW[e]]);
    if (EU[e] === PS) I += cur[e];
  }
  cur[NE] = -I;
  phi[face[2 * NE]] = 0;
  for (const [e, a, b, s] of order) phi[b] = phi[a] + s * cur[e];
  let lo = 0;
  for (let f = 0; f < S.nf; f++) lo = min(lo, phi[f]);
  S.I = I;
  tiles.length = 0;
  for (const e of on) {
    const a = phi[face[2 * e]] - lo, b = phi[face[2 * e + 1]] - lo, p = v[EU[e]], q = v[EW[e]];
    tiles.push([e, min(a, b), max(a, b), 1 - max(p, q), 1 - min(p, q)]);
  }
}

// Story seconds at Speed 2: squares hold, drift rises, drift, snap.
const HOLD = 1.2, RISE = 2.4, SETTLE = 6.8, CYCLE = 8, REWIRE = 3.4;

export function setup(params) {
  const fq = [], ph = [];
  for (let e = 0; e < NE; e++) fq.push(0.35 + 0.5 * Math.random(), 0.8 + 0.7 * Math.random()), ph.push(6.3 * Math.random(), 6.3 * Math.random());
  params.s = {
    t: 0, tc: 0, cyc: 0, amp: 0, set0: SETTLE, setLen: CYCLE - SETTLE, setFrom: 1, flash: 1,
    K: 0, walk: 0, step: 0, dir: 1, mask: 0, next: 0, ramp: -1, rate: 0,
    hue: 0, speed: 2, wander: 0.06, fq, ph, drift: new Float64Array(NE + 1), c: new Float64Array(NE),
    v: new Float64Array(NN), cur: new Float64Array(NE + 1), x: new Float64Array(NI), A: Array.from({ length: NI }, () => new Float64Array(NI + 1)),
    tiles: [], I: 1, id: new Int16Array(W * H), stripe: new Float64Array(NE),
  };
}

function rewire(S, to) {
  S.next = to;
  S.ramp = 0;
  S.rate = 1 / 2.6;
  build(S, S.mask | to);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 13, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.wander = 0.7 * 2 ** (1.1 * cl(k[3], -1, 1));
  const K = round(cl(k[2], 13, 20));
  if (!S.K) {
    S.K = K;
    S.mask = WALKS[K - 13][0];
    build(S, S.mask);
  } else if (K !== S.K && S.ramp < 0) {
    // A new walk: go to its network nearest the one shown.
    S.K = K;
    const w = WALKS[K - 13];
    let best = 0;
    for (let i = 1; i < w.length; i++) if (apart(w[i], S.mask) < apart(w[best], S.mask)) best = i;
    (S.step = best), (S.dir = best === w.length - 1 ? -1 : 1);
    if (w[best] !== S.mask) rewire(S, w[best]);
  }
  const ds = (d * S.speed) / 2;
  S.t += ds;
  S.flash *= exp(-d / 0.35);
  const press = input.btnPressed && input.btnPressed[0];
  if (press && S.tc > 0.15 && S.tc < S.set0) {
    // Snap now: settle from where the drift is in 0.4 seconds.
    (S.setFrom = S.amp), (S.set0 = S.tc), (S.setLen = 0.4);
    if (S.ramp >= 0) S.rate = max(S.rate, (1 - S.ramp) / 0.38);
  }
  S.tc += ds;
  if (S.tc >= S.set0 + S.setLen) {
    (S.tc = 0), S.cyc++, (S.flash = 1), (S.set0 = SETTLE), (S.setLen = CYCLE - SETTLE), (S.setFrom = 1);
  }
  const tc = S.tc;
  S.amp = tc < HOLD ? 0 : tc < S.set0 ? (tc < RISE ? sm((tc - HOLD) / (RISE - HOLD)) : 1) : S.setFrom * (1 - ((tc - S.set0) / S.setLen) ** 2);
  // Every second cycle, one step along the walk.
  if (S.ramp < 0 && S.cyc % 2 === 1 && tc >= REWIRE && tc < REWIRE + 0.5 && S.set0 === SETTLE) {
    const w = WALKS[S.K - 13];
    if (w.length > 1) {
      if (S.step + S.dir < 0 || S.step + S.dir >= w.length) S.dir = -S.dir;
      S.step += S.dir;
      rewire(S, w[S.step]);
    }
  }
  if (S.ramp >= 0) {
    S.ramp += ds * S.rate;
    if (S.ramp >= 1) {
      S.mask = S.next;
      S.ramp = -1;
      build(S, S.mask);
    }
  }
  // Conductances: each wire drifts as exp(a n(t)), n a slow wave in -1..1.
  const r = S.ramp < 0 ? 1 : sm(S.ramp), a = S.amp * S.wander;
  for (const e of S.on) {
    const n = 0.6 * sin(S.fq[2 * e] * S.t + S.ph[2 * e]) + 0.4 * sin(S.fq[2 * e + 1] * S.t + S.ph[2 * e + 1]);
    let g = a ? exp(a * n) : 1;
    if (S.ramp >= 0) {
      const was = has(S.mask, e), will = has(S.next, e);
      if (was && !will) g *= 1 - r;
      else if (will && !was) g *= r;
    }
    S.c[e] = max(g, 1e-9);
    S.stripe[e] += ds * 9 * S.c[e];
  }
  solve(S);
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.tiles.length) return;
  const { tiles, id, I } = S;
  const sc = min(W / I, H), ox = (W - I * sc) / 2, oy = (H - sc) / 2;
  id.fill(-1);
  const col = [], top = [], q = [];
  let qa = 1, qb = 0;
  tiles.forEach((t, k) => {
    const x0 = round(ox + t[1] * sc), x1 = round(ox + t[2] * sc), y0 = round(oy + t[3] * sc), y1 = round(oy + t[4] * sc);
    for (let y = max(0, y0); y < min(H, y1); y++) for (let x = max(0, x0); x < min(W, x1); x++) id[y * W + x] = k;
    // Size: the side of a square of the same area, against the width.
    q.push(log(max(1e-6, sqrt((t[2] - t[1]) * (t[4] - t[3])) / I)));
    if (x1 > x0 && y1 > y0) (qa = min(qa, q[k])), (qb = max(qb, q[k]));
    top.push(y0 + S.stripe[t[0]]);
  });
  // Colour by size between the smallest and the biggest tile shown now.
  tiles.forEach((t, k) => {
    const u = cl((q[k] - qa) / max(0.3, qb - qa), 0, 1);
    col.push(hsv(0.52 + S.hue + 0.55 * (1 - u), 0.85 - 0.1 * u, 0.62 + 0.38 * (1 - u)));
  });
  const fl = S.flash;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const k = id[p];
      if (k < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const c = col[k];
      // Seams on the left and top of each tile; the rectangle's own edge stays.
      if ((x > 0 && id[p - 1] >= 0 && id[p - 1] !== k) || (y > 0 && id[p - W] >= 0 && id[p - W] !== k)) {
        const b = 255 * fl;
        display.setPixel(x, y, round(0.08 * 255 * c[0] * (1 - fl) + b * 0.9), round(0.08 * 255 * c[1] * (1 - fl) + b * 0.95), round(0.08 * 255 * c[2] * (1 - fl) + b));
        continue;
      }
      // Faint bands run down each tile at a speed set by its conductance.
      const ph = (((y - top[k]) % 9) + 9) % 9, m = ph < 1 ? 0.8 : 1;
      display.setPixel(x, y, round(255 * c[0] * m), round(255 * c[1] * m), round(255 * c[2] * m));
    }
}
