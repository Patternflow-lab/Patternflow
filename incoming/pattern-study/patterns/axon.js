// ===== Patternflow pattern =====
// Title:   Axon
// Family:  body
// Idea:    A neuron glows green in a fluorescence micrograph of dark tissue, and each burst it fires leaves the cell body and leaps down the myelinated axon from one node of Ranvier to the next until the terminals spill glowing vesicles across the clefts onto a second neuron, which lights up in turn.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after Santiago Ramón y Cajal's drawings of neurons and fluorescence microscopy
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Dye=0..1, Speed=0.2..3, Rate=1..8, Damage=0..1
//
// Knob 1: Dye. The fluorescent labels, turning round the colour wheel together. At 0 the neuron is GFP green and the second neuron magenta, on cream myelin with blue nuclei.
// Knob 2: Speed. The clock of the whole slide: at 2 a healthy spike takes about a second from the cell body to the terminals, and at 0.2 everything runs ten times slower.
// Knob 3: Rate. How often the neuron fires: a burst of three spikes every 1.8 s at 1, up to about nine spikes a second at 8.
// Knob 4: Damage. Demyelination. At 0 the sheaths are whole and a spike leaps from node to node. As it rises the sheaths thin and break, and the spike crawls through the bare stretches, fading as it goes. Past about 0.3 the second neuron no longer answers, and near 1 the spike dies in the bare axon before it reaches the terminals.
// Buttons: K1 tap fires a burst of four spikes now.

const W = 64, H = 128, N = W * H;
const { min, max, abs, exp, sin, cos, hypot, floor, ceil, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const F32 = (n) => new Float32Array(n);

// The axon's centre line, a gentle S from the hillock down to where it branches.
const AX = (y) => 32 + 2.6 * sin((y - 28) * 0.07);
const YH = 28;
// Four sheaths 11 rows long, each followed by a bare node two rows long.
const NSH = 4, SA = 39.5, SL = 11, SP = 13;
const sa = (k) => SA + SP * k;
const sb = (k) => sa(k) + SL;
// Where a spike flashes: the end of the initial segment, then each node.
const NODE = [SA - 0.5, sb(0) + 1, sb(1) + 1, sb(2) + 1, sb(3) + 1];
const YB = sb(3) + 2.5;
// Conduction in LEDs a second of slide time.
const V_AIS = 60, V_FAST = 110, V_SLOW = 14, V_NODE = 40, V_TERM = 45;
// The boutons, and how far below each the second neuron's spine sits.
const BOUT = [[9, 101], [20, 105], [31, 103], [42, 106], [54, 100]];
const CLEFT = 6, S1 = [32, 23], S2 = [33, 121];

// Distance to a segment; T is how far along it the nearest point lies.
let T = 0;
function seg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  T = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return hypot(px - ax - dx * T, py - ay - dy * T);
}

// A tapered stroke into layer L, kept by the brighter of old and new. With a
// record R it also notes, LED by LED, how far along a branch the stroke is.
function stroke(L, ax, ay, bx, by, ra, rb, wt, R) {
  const r = max(ra, rb) + 1;
  const x0 = max(0, floor(min(ax, bx) - r));
  const x1 = min(W - 1, ceil(max(ax, bx) + r));
  const y0 = max(0, floor(min(ay, by) - r));
  const y1 = min(H - 1, ceil(max(ay, by) + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = seg(x + 0.5, y + 0.5, ax, ay, bx, by) - (ra + (rb - ra) * T);
      const v = clamp(0.5 - d, 0, 1) * wt;
      const i = y * W + x;
      if (v > L[i]) L[i] = v;
      if (R && v > R.c[i]) {
        R.c[i] = v;
        R.s[i] = R.s0 + T * R.len;
        R.b[i] = R.id;
      }
    }
}

function blob(L, cx, cy, rx, ry, wt, soft) {
  const s = soft || 1;
  for (let y = max(0, floor(cy - ry - 2)); y <= min(H - 1, ceil(cy + ry + 2)); y++)
    for (let x = max(0, floor(cx - rx - 2)); x <= min(W - 1, ceil(cx + rx + 2)); x++) {
      const d = (hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) - 1) * min(rx, ry);
      const v = clamp(0.5 - d / s, 0, 1) * wt;
      const i = y * W + x;
      if (v > L[i]) L[i] = v;
    }
}

// A dendrite: short strokes that wander and thin out, forking now and then
// and set with spines.
function grow(L, x, y, a, w, len, depth, wt, spines) {
  let s = 0;
  while (s < len) {
    const nx = x + cos(a) * 1.5;
    const ny = y + sin(a) * 1.5;
    const nw = max(0.42, w * 0.975);
    stroke(L, x, y, nx, ny, w, nw, wt);
    if (spines && rnd() < 0.28) {
      const side = rnd() < 0.5 ? 1 : -1;
      stroke(L, nx, ny, nx - sin(a) * side * (w + 1.3), ny + cos(a) * side * (w + 1.3), 0.3, 0.55, wt * 0.8);
    }
    (x = nx), (y = ny), (w = nw), (s += 1.5);
    a += (rnd() - 0.5) * 0.36;
    if (x < -4 || x > W + 4 || y < -4 || y > H + 4) return;
    if (depth > 0 && s > 4 && rnd() < 0.1) {
      const turn = (0.35 + 0.45 * rnd()) * (rnd() < 0.5 ? 1 : -1);
      grow(L, x, y, a + turn, w * 0.8, (len - s) * 0.85 + 3, depth - 1, wt, spines);
      a -= turn * 0.4;
    }
  }
}

// A quadratic curve of strokes from p to q bent toward c. Returns its length.
function curve(L, p, c, q, r0, r1, wt, R) {
  let px = p[0], py = p[1], s = 0;
  for (let j = 1; j <= 14; j++) {
    const u = j / 14, v = 1 - u;
    const qx = v * v * p[0] + 2 * u * v * c[0] + u * u * q[0];
    const qy = v * v * p[1] + 2 * u * v * c[1] + u * u * q[1];
    const len = hypot(qx - px, qy - py);
    if (R) (R.s0 = s), (R.len = len);
    stroke(L, px, py, qx, qy, r0 + ((r1 - r0) * (j - 1)) / 14, r0 + (r1 - r0) * u, wt, R);
    s += len;
    (px = qx), (py = qy);
  }
  return s;
}

function blur(L) {
  const o = F32(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      o[y * W + x] = 0.25 * L[y * W + max(0, x - 1)] + 0.5 * L[y * W + x] + 0.25 * L[y * W + min(W - 1, x + 1)];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      L[y * W + x] = 0.25 * o[max(0, y - 1) * W + x] + 0.5 * o[y * W + x] + 0.25 * o[min(H - 1, y + 1) * W + x];
}

// A nucleus is dark in the cell's own label and blue in the nuclear stain.
function nucleus(D, NU, x, y, rx, ry) {
  const m = F32(N);
  blob(m, x, y, rx, ry, 1);
  for (let i = 0; i < N; i++) if (m[i] > 0) (D[i] *= 1 - 0.7 * m[i]), (NU[i] = max(NU[i], 0.8 * m[i]));
}

// Merge a layer into the neighbours' layer, noting whose each LED is.
function merge(S, L, j) {
  for (let i = 0; i < N; i++) if (L[i] > S.NB[i]) (S.NB[i] = L[i]), (S.NBI[i] = j);
}

// Copy a piece into the damageable layer with its breaking point.
function mark(GD, GZ, L, z) {
  for (let i = 0; i < N; i++)
    if (L[i] > GD[i]) {
      GD[i] = L[i];
      GZ[i] = z + 0.08 * rnd();
    }
}

export function setup(params) {
  const S = {
    D1: F32(N), X1: F32(N), X1v: F32(N), D2: F32(N), NU: F32(N), NB: F32(N), NBI: new Uint8Array(N),
    GL: F32(N), GD: F32(N), GZ: F32(N), GV: F32(N), TI: F32(N), H1: F32(N), H2: F32(N), MY: F32(N), SP1: F32(N), SP2: F32(N),
    t: 0, next: 0.5, q: [], sp: [], ves: [], ca1: 0, v2: 0, ca2: 0, f2: 0,
    caN: [0, 0, 0, 0], Fs: F32(5), Fn: F32(5), Fb: F32(5),
    m: F32(NSH), mr: F32(NSH), nz: F32(NSH * 14),
    tN: F32(5), aN: F32(5), tA: F32(NSH), tB: F32(NSH), AA: F32(NSH), AB: F32(NSH), tBo: F32(5), blen: F32(5),
    dye: -1, dmg: -1, na: [],
  };
  params.s = S;
  const { D1, X1, D2, NU, GL, TI } = S;

  // The neuron: a pyramid of a cell body whose apical dendrite climbs to a
  // tuft at the top edge. The basal dendrites spread to the sides.
  blob(D1, S1[0], S1[1] + 0.5, 7, 6, 0.85);
  stroke(D1, 32, 21, 32, 13, 4.6, 1.3, 0.85);
  stroke(D1, 32, 27.5, AX(31.5), 31.5, 2.6, 0.9, 0.85);
  grow(D1, 32, 13.5, -PI / 2 + (rnd() - 0.5) * 0.2, 1.25, 18, 3, 0.85, true);
  grow(D1, 32, 9.5, -PI / 2 - 0.9, 0.8, 22, 1, 0.8, true);
  grow(D1, 32, 8, -PI / 2 + 0.9, 0.8, 22, 1, 0.8, true);
  grow(D1, 26.5, 27, 2.3, 1.1, 26, 2, 0.85, true);
  grow(D1, 37.5, 27, 0.85, 1.1, 26, 2, 0.85, true);
  grow(D1, 25.5, 21, PI + 0.3, 1.05, 24, 2, 0.85, true);
  grow(D1, 38.5, 21, -0.3, 1.05, 24, 2, 0.85, true);
  grow(D1, 28.5, 29, 1.95, 0.8, 14, 1, 0.8, true);
  grow(D1, 35.5, 29, 1.2, 0.8, 14, 1, 0.8, true);
  nucleus(D1, NU, S1[0] + 0.4, S1[1] + 0.3, 3.2, 3.6);
  NU[22 * W + 33] *= 0.4;

  // The axon as a tube of LEDs, row by row, for the myelin and the spikes.
  const tI = [], tY = [], tR = [], tK = [], tJ = [];
  S.row = new Int32Array(H + 2);
  for (let y = 0; y < H; y++) {
    S.row[y] = tI.length;
    if (y < YH || y > YB + 1) continue;
    const yc = y + 0.5, ax = AX(yc), sl = 0.182 * cos((yc - 28) * 0.07);
    for (let x = max(0, floor(ax - 5)); x <= min(W - 1, ceil(ax + 5)); x++) {
      const r = (x + 0.5 - ax) / Math.sqrt(1 + sl * sl);
      let k = -1;
      for (let j = 0; j < NSH; j++) if (yc >= sa(j) - 0.5 && yc <= sb(j) + 0.5) k = j;
      tI.push(y * W + x), tY.push(yc), tR.push(r), tK.push(k), tJ.push(rnd());
      const rr = 0.7 + 0.3 * clamp((SA - yc) / 10, 0, 1);
      X1[y * W + x] = max(X1[y * W + x], clamp(rr + 0.5 - abs(r), 0, 1) * 0.8);
    }
  }
  S.row[H] = S.row[H + 1] = tI.length;
  [S.tI, S.tY, S.tR, S.tK, S.tJ] = [Int32Array.from(tI), Float32Array.from(tY), Float32Array.from(tR), Int8Array.from(tK), Float32Array.from(tJ)];
  for (let k = 0; k < NSH; k++) {
    S.mr[k] = rnd();
    let a = rnd();
    for (let j = 0; j < 14; j++) {
      const b = rnd();
      (S.nz[k * 14 + j] = 0.5 * a + 0.5 * b), (a = b);
    }
  }

  // The terminal arbor: five branches fanning out from the last node to the
  // boutons, each LED tagged with how far along its branch it lies.
  const R = { c: F32(N), s: F32(N), b: new Int8Array(N), s0: 0, len: 0, id: 0 };
  const P = [AX(YB), YB];
  BOUT.forEach((B, b) => {
    R.id = b;
    const C = [P[0] + (B[0] - P[0]) * 0.5, P[1] + (B[1] - P[1]) * 0.2 + 1];
    S.blen[b] = curve(X1, P, C, B, 0.65, 0.5, 0.8, R);
    blob(X1, B[0], B[1], 1.8, 1.6, 0.95);
  });
  const ti = [], ts = [], tb = [], tc = [];
  for (let i = 0; i < N; i++)
    if (R.c[i] > 0.05) ti.push(i), ts.push(R.s[i]), tb.push(R.b[i]), tc.push(R.c[i]);
  [S.ti, S.ts, S.tb, S.tc] = [Int32Array.from(ti), Float32Array.from(ts), Int8Array.from(tb), Float32Array.from(tc)];

  // The second neuron below: its dendrites rise to a spine under each bouton.
  blob(D2, S2[0], S2[1], 7, 5.4, 0.85);
  stroke(D2, 33, 118, 32, 112, 3.8, 1.1, 0.85);
  BOUT.forEach((B) => {
    const sx = B[0], sy = B[1] + CLEFT;
    const st = [33 + (sx - 33) * 0.22, abs(sx - 33) < 4 ? 112 : 117];
    curve(D2, st, [sx * 0.8 + st[0] * 0.2, st[1] - 1], [sx, sy + 2.5], 1.1, 0.55, 0.8);
    stroke(D2, sx, sy + 2.5, sx, sy + 0.8, 0.4, 0.5, 0.8);
    blob(D2, sx, sy, 1.3, 1.1, 0.95);
  });
  grow(D2, 27, 124, PI - 0.15, 1, 24, 2, 0.8, true);
  grow(D2, 39, 124, 0.12, 1, 24, 2, 0.8, true);
  grow(D2, 28, 118, PI + 0.6, 0.8, 12, 1, 0.75, true);
  grow(D2, 38, 118, -0.6, 0.8, 12, 1, 0.75, true);
  nucleus(D2, NU, S2[0] + 0.3, S2[1] + 0.5, 3.2, 2.8);

  // Neighbouring neurons, out of focus, each with a calcium flicker of its own.
  [[8, 36], [56, 58], [9, 84]].forEach((c, j) => {
    const L = F32(N), x = c[0] + (rnd() - 0.5) * 4, y = c[1] + (rnd() - 0.5) * 6;
    blob(L, x, y, 3.2, 2.8, 0.7);
    for (let d = 0; d < 4; d++) grow(L, x, y, (d / 4) * 2 * PI + rnd(), 0.8, 10 + 8 * rnd(), 1, 0.65, false);
    blur(L);
    merge(S, L, j);
    blob(NU, x, y, 1.8, 1.6, 0.3, 2);
  });

  // Two myelinated axons of other cells cross behind, with nodes of their
  // own. Their sheaths and the oligodendrocytes go into GD, the layer that
  // Damage takes apart, each piece with its own breaking point in GZ.
  const { GD, GZ } = S;
  const tmp = F32(N);
  [[-3, 47 + rnd() * 4, 67, 43 + rnd() * 4], [-3, 69 + rnd() * 4, 67, 82 + rnd() * 4]].forEach((A, n) => {
    const len = hypot(A[2] - A[0], A[3] - A[1]), ux = (A[2] - A[0]) / len, uy = (A[3] - A[1]) / len;
    const bow = (n ? -3 : 3) * (0.6 + 0.4 * rnd());
    const at = (s) => [A[0] + ux * s - uy * bow * sin((PI * s) / len), A[1] + uy * s + ux * bow * sin((PI * s) / len)];
    const nodes = [];
    for (let s = 2 + rnd() * 8; s < len; s += 10) nodes.push(at(s));
    for (let j = 0; j < nodes.length - 1; j++) {
      const p = nodes[j], q = nodes[j + 1], dx = (q[0] - p[0]) / 10, dy = (q[1] - p[1]) / 10;
      tmp.fill(0);
      sheath(tmp, p[0] + dx * 1.2, p[1] + dy * 1.2, q[0] - dx * 1.2, q[1] - dy * 1.2, 1.5, 0.27);
      mark(GD, GZ, tmp, 0.15 + 0.85 * rnd());
    }
    tmp.fill(0);
    for (const p of nodes) blob(tmp, p[0], p[1], 0.6, 0.6, 0.4);
    merge(S, tmp, 3);
    S.na.push({ nodes, sp: [] });
  });

  // Oligodendrocytes, the glia that wrap the sheaths, reaching to the axon.
  const og = [[19 + rnd() * 3, 61, -1, [55, 66]], [44 + rnd() * 3, 76, 1, [70, 82]]];
  for (const [x, y, side, ys] of og) {
    tmp.fill(0);
    blob(tmp, x, y, 2.2, 1.9, 0.6);
    for (const ty of ys) {
      const tx = AX(ty) + side * 2.4;
      curve(tmp, [x, y], [(x + tx) / 2, y + (ty - y) * 0.15 + (rnd() - 0.5) * 3], [tx, ty], 0.5, 0.42, 0.34);
    }
    mark(GD, GZ, tmp, 0.35 + 0.3 * rnd());
  }
  // Astrocytes, small stars of fine processes.
  for (const [x, y] of [[54, 31], [52, 95], [12, 70]]) {
    blob(GL, x, y, 1.3, 1.2, 0.42);
    for (let d = 0; d < 8; d++) grow(GL, x, y, (d / 8) * 2 * PI + rnd() * 0.7, 0.5, 3 + 6 * rnd(), 0, 0.22 + 0.1 * rnd(), false);
  }
  // Nuclei of every other cell in the slice, in the blue stain.
  for (let n = 0; n < 26; n++) {
    const x = rnd() * W, y = rnd() * H;
    if (hypot(x - S1[0], y - S1[1]) < 10 || hypot(x - S2[0], y - S2[1]) < 10) continue;
    if (y > 26 && y < 94 && abs(x - AX(y)) < 5) continue;
    blob(NU, x, y, 1.4 + rnd() * 0.8, 1.2 + rnd() * 0.6, 0.2 + rnd() * 0.16, 1.5);
  }
  // Dark tissue: a faint, uneven autofluorescence.
  const g = F32(9 * 17).map(rnd), g2 = F32(17 * 33).map(rnd);
  const samp = (G, gw, x, y) => {
    const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, at = (a, b) => G[b * gw + a];
    return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = 0.65 * samp(g, 9, x / 8, y / 8) + 0.35 * samp(g2, 17, x / 4, y / 4);
      TI[y * W + x] = 0.02 + 0.055 * n * n;
      S.H1[y * W + x] = exp(-((x + 0.5 - S1[0]) ** 2 + (y + 0.5 - S1[1]) ** 2) / 240);
      S.H2[y * W + x] = exp(-((x + 0.5 - S2[0]) ** 2 + (y + 0.5 - S2[1]) ** 2) / 240);
    }
}

// A sheath seen from above: bright walls and a dark line down the middle.
function sheath(L, ax, ay, bx, by, R, wt) {
  for (let y = max(0, floor(min(ay, by) - R - 1)); y <= min(H - 1, ceil(max(ay, by) + R + 1)); y++)
    for (let x = max(0, floor(min(ax, bx) - R - 1)); x <= min(W - 1, ceil(max(ax, bx) + R + 1)); x++) {
      const d = seg(x + 0.5, y + 0.5, ax, ay, bx, by);
      const v = clamp(R + 0.5 - d, 0, 1) * (0.3 + 0.7 * sstep(0.1, R, d)) * wt;
      const i = y * W + x;
      if (v > L[i]) L[i] = v;
    }
}

function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

function colours(S, dye) {
  S.dye = dye;
  const h = 0.33 + dye;
  S.c1 = hsv(h, 0.88, 1);
  S.c2 = hsv(h + 0.53, 0.78, 1);
  S.cm = hsv(h - 0.21, 0.3, 1);
  S.cn = hsv(h + 0.31, 0.8, 1);
  S.ct = hsv(h + 0.2, 0.55, 1);
}

// The sheaths for this much damage: each thins and breaks by its own measure.
function myelin(S, dmg) {
  S.dmg = dmg;
  for (let k = 0; k < NSH; k++) S.m[k] = clamp(1 - dmg * (0.8 + 0.7 * S.mr[k]), 0, 1);
  const { tI, tY, tR, tK, tJ, MY, X1, X1v } = S;
  X1v.set(X1);
  for (let j = 0; j < tI.length; j++) {
    const i = tI[j], k = tK[j];
    MY[i] = 0;
    if (k < 0) continue;
    const m = S.m[k], y = tY[j], r = abs(tR[j]);
    const Rs = 2.75 * (0.45 + 0.55 * m);
    const dy = max(0, sa(k) + Rs - y, y - (sb(k) - Rs));
    const cov = clamp(0.5 - (hypot(r, dy) - Rs), 0, 1);
    const thr = (1 - m) * 1.3 - 0.15;
    const row = clamp(floor(y - sa(k) + 0.5), 0, 13);
    const pres = sstep(thr - 0.1, thr + 0.1, S.nz[k * 14 + row] + 0.12 * tJ[j]);
    MY[i] = cov * pres * (0.18 + 0.82 * sstep(0.2, 1.5, r)) * (0.5 + 0.25 * m);
    X1v[i] = X1[i] * (1 - 0.9 * pres * cov);
  }
  const thr = dmg * 1.3 - 0.15;
  for (let i = 0; i < N; i++) S.GV[i] = S.GL[i] + (S.GD[i] ? S.GD[i] * sstep(thr - 0.1, thr + 0.1, S.GZ[i]) : 0);
}

// A spike's timetable at this much damage: when it reaches each node and how
// strong it is there. It dies inside a sheath that is too far gone.
function table(S) {
  const { tN, aN, m } = S;
  tN[0] = (SA - YH) / V_AIS;
  aN[0] = 1;
  S.blk = -1;
  for (let k = 0; k < NSH; k++) {
    const v = V_SLOW + (V_FAST - V_SLOW) * m[k] * m[k];
    const A0 = aN[k];
    const A1 = A0 * (1 - 0.36 * (1 - m[k]) ** 1.2);
    S.tA[k] = tN[k] + 0.5 / V_NODE;
    S.tB[k] = S.tA[k] + SL / v;
    (S.AA[k] = A0), (S.AB[k] = A1);
    if (A1 < 0.3) {
      const f = (A0 - 0.3) / (A0 - A1);
      S.blk = k;
      S.blkY = sa(k) + SL * f;
      S.blkT = S.tA[k] + (SL * f) / v;
      for (let j = k + 1; j <= NSH; j++) {
        tN[j] = 1e9;
        aN[j] = 0;
      }
      break;
    }
    tN[k + 1] = S.tB[k] + 1 / V_NODE;
    aN[k + 1] = A1;
  }
  S.tT = tN[NSH] + (YB - NODE[NSH]) / V_NODE;
  let end = 0;
  for (let b = 0; b < 5; b++) {
    S.tBo[b] = S.tT + S.blen[b] / V_TERM;
    end = max(end, S.tBo[b]);
  }
  S.tEnd = (S.blk >= 0 ? S.blkT : end) + 0.8;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  const dye = clamp(k[0], 0, 1);
  const rate = clamp(k[2], 1, 8);
  if (dye !== S.dye) colours(S, dye);
  const dmg = clamp(k[3], 0, 1);
  if (abs(dmg - S.dmg) > 0.001) myelin(S, dmg);
  table(S);
  // Slide time: Speed 2 is real time.
  const st = (dt * clamp(k[1], 0.2, 3)) / 2;
  S.t += st;
  if (S.t >= S.next) {
    S.q.push(S.t, S.t + 0.2, S.t + 0.4);
    S.next = S.t + (1.8 / rate ** 0.8) * (0.75 + 0.5 * rnd());
  }
  if (input.btnPressed && input.btnPressed[0]) {
    for (let j = 0; j < 4; j++) S.q.push(S.t + j * 0.15);
    S.next = max(S.next, S.t + 1.2);
  }
  S.q.sort((a, b) => a - b);
  while (S.q.length && S.q[0] <= S.t) {
    S.sp.push({ t: S.t - S.q.shift(), p: -1 });
    S.ca1 += 0.3 * (1.25 - S.ca1);
  }
  // Each spike moves on; one reaching a bouton releases its vesicles.
  for (const p of S.sp) {
    p.p = p.t;
    p.t += st;
    for (let b = 0; b < 5; b++)
      if (p.p < S.tBo[b] && p.t >= S.tBo[b])
        for (let n = 0; n < 3; n++) {
          const B = BOUT[b];
          S.ves.push({ b, a: S.aN[NSH], x: B[0] + (rnd() - 0.5) * 2, y: B[1] + 1.2, tx: B[0] + (rnd() - 0.5) * 1.6, ty: B[1] + CLEFT - 1, age: -n * 0.05, dur: 0.3 + 0.2 * rnd() });
        }
  }
  S.sp = S.sp.filter((p) => p.t < S.tEnd);
  for (const v of S.ves) {
    v.age += st;
    if (v.age >= v.dur) {
      S.v2 += (0.75 * v.a) / 15;
      S.Fs[v.b] += 0.3;
    }
  }
  S.ves = S.ves.filter((v) => v.age < v.dur);
  // The second neuron fires once enough transmitter has landed.
  if (S.v2 >= 1) {
    (S.v2 = 0.15), (S.ca2 = min(1.3, S.ca2 + 0.8)), (S.f2 = 1);
  }
  (S.ca1 *= exp(-st / 0.9)), (S.v2 *= exp(-st / 0.6)), (S.ca2 *= exp(-st / 1.1)), (S.f2 *= exp(-st / 0.15));
  for (let b = 0; b < 5; b++) S.Fs[b] *= exp(-st / 0.25);
  for (let j = 0; j < 3; j++) {
    S.caN[j] *= exp(-st / 1.4);
    if (rnd() < st * 0.3) S.caN[j] += 0.7;
  }
  // The neighbouring axons carry spikes now and then too.
  for (const A of S.na) {
    for (const p of A.sp) p.t += st;
    A.sp = A.sp.filter((p) => p.t < A.nodes.length * 0.1 + 0.5);
    if (rnd() < st * 0.5) A.sp.push({ t: 0, back: rnd() < 0.5 });
  }
}

// A bright point with a soft halo, added into layer L.
function bloom(L, cx, cy, amp, rc, rh, ha) {
  if (amp < 0.004) return;
  const R = ceil(rh * 2.2);
  for (let y = max(0, floor(cy - R)); y <= min(H - 1, ceil(cy + R)); y++)
    for (let x = max(0, floor(cx - R)); x <= min(W - 1, ceil(cx + R)); x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      L[y * W + x] += amp * (exp(-d2 / (rc * rc)) + ha * exp(-d2 / (rh * rh)));
    }
}

const pulse = (u, tau) => (u < -0.03 ? 0 : u < 0 ? 1 + u / 0.03 : exp(-u / tau));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.c1) return;
  const { SP1, SP2, tN, aN, Fn, Fb, tI, tY, tR, tK, MY } = S;
  for (const A of [SP1, SP2, Fn, Fb]) A.fill(0);
  let hill = 0;
  for (const p of S.sp) {
    const t = p.t;
    hill += exp(-t / 0.12);
    for (let j = 0; j <= NSH; j++) Fn[j] += aN[j] * pulse(t - tN[j], 0.08);
    // The front: always seen in the bare initial segment, seen in a sheath
    // only as far as its myelin is gone.
    let yf = -1, amp = 0;
    if (t < tN[0]) {
      yf = YH + ((SA - YH) * t) / tN[0];
      amp = 1;
    } else
      for (let k = 0; k < NSH; k++) {
        if (S.blk === k && t >= S.blkT) {
          yf = S.blkY;
          amp = 0.3 * exp(-(t - S.blkT) / 0.25);
        } else if (t >= S.tA[k] && t < S.tB[k]) {
          const f = (t - S.tA[k]) / (S.tB[k] - S.tA[k]);
          yf = sa(k) + SL * f;
          amp = (S.AA[k] + (S.AB[k] - S.AA[k]) * f) * (1 - S.m[k]) ** 0.8;
        }
      }
    if (yf >= 0 && amp > 0.01) {
      for (let y = max(YH, floor(yf - 9)); y <= min(H - 1, ceil(yf + 3)); y++)
        for (let j = S.row[y]; j < S.row[y + 1]; j++) {
          const dy = tY[j] - yf;
          const w = exp((-dy * dy) / 2.2) + (dy < 0 ? 0.35 * exp(dy / 3.5) : 0);
          const r2 = tR[j] * tR[j];
          SP1[tI[j]] += amp * w * (1.1 * exp(-r2 / 0.9) + 0.15 * exp(-r2 / 6));
        }
    }
    // Down the terminal branches to the boutons.
    if (t >= S.tT && t < S.tT + 1.2) {
      const sf = (t - S.tT) * V_TERM;
      const a = aN[NSH];
      for (let j = 0; j < S.ti.length; j++) {
        const s = S.ts[j];
        if (s > S.blen[S.tb[j]] + 1) continue;
        const d = s - sf;
        if (d > -8 && d < 8) SP1[S.ti[j]] += a * S.tc[j] * 1.1 * exp((-d * d) / 3);
      }
    }
    for (let b = 0; b < 5; b++) Fb[b] += aN[NSH] * pulse(t - S.tBo[b], 0.18);
  }
  // Node flashes, and the sheaths on either side glowing with them.
  bloom(SP1, AX(29.5), 29.5, min(1.5, hill) * 0.5, 2, 4.5, 0.4);
  for (let j = 0; j <= NSH; j++) bloom(SP1, AX(NODE[j]), NODE[j], Fn[j] * (j ? 1 : 0.7), 1.1, 3.4, 0.4);
  for (let j = 0; j < tI.length; j++) {
    const k = tK[j];
    if (k < 0) continue;
    const g = max(Fn[k], Fn[k + 1]);
    if (g > 0.01) SP1[tI[j]] += 0.9 * g * MY[tI[j]];
  }
  for (let b = 0; b < 5; b++) {
    bloom(SP1, BOUT[b][0], BOUT[b][1], Fb[b], 1.6, 4, 0.4);
    bloom(SP2, BOUT[b][0], BOUT[b][1] + CLEFT, S.Fs[b], 1.3, 3.5, 0.35);
  }
  // Vesicles crossing the clefts.
  for (const v of S.ves) {
    if (v.age < 0) continue;
    const u = v.age / v.dur;
    const e = u * u * (3 - 2 * u);
    bloom(SP1, v.x + (v.tx - v.x) * e, v.y + (v.ty - v.y) * e, 0.7 * (1 - 0.4 * u), 0.6, 1.8, 0.15);
  }
  for (const A of S.na)
    for (const p of A.sp) {
      const n = A.nodes.length;
      for (let j = 0; j < n; j++) {
        const u = p.t - j * 0.1;
        if (u > -0.03 && u < 0.5) {
          const q = A.nodes[p.back ? n - 1 - j : j];
          bloom(SP1, q[0], q[1], 0.55 * pulse(u, 0.08), 0.9, 2.6, 0.35);
        }
      }
    }

  const { D1, X1v, D2, NU, NB, NBI, GV, TI, H1, H2, c1, c2, cm, cn, ct } = S;
  const k1 = 0.28 + 0.95 * S.ca1;
  const kx = 0.62 + 0.4 * S.ca1;
  const kh1 = 0.03 + 0.32 * S.ca1;
  const k2 = 0.27 + 0.4 * S.v2 + 1 * S.ca2 + 0.5 * S.f2;
  const kh2 = 0.03 + 0.3 * S.ca2;
  const kn = [0.45 + 1.4 * S.caN[0], 0.45 + 1.4 * S.caN[1], 0.45 + 1.4 * S.caN[2], 1];
  for (let i = 0; i < N; i++) {
    const v1 = D1[i] * k1 + X1v[i] * kx + NB[i] * kn[NBI[i]] + H1[i] * kh1 + SP1[i];
    const v2 = D2[i] * k2 + H2[i] * kh2 + SP2[i];
    const vm = MY[i] + GV[i];
    const vn = NU[i];
    const vt = TI[i];
    let r = 255 * (v1 * c1[0] + v2 * c2[0] + vm * cm[0] + vn * cn[0] + vt * ct[0]);
    let g = 255 * (v1 * c1[1] + v2 * c2[1] + vm * cm[1] + vn * cn[1] + vt * ct[1]);
    let b = 255 * (v1 * c1[2] + v2 * c2[2] + vm * cm[2] + vn * cn[2] + vt * ct[2]);
    // Where a label saturates the camera it bleaches toward white.
    const top = max(r, g, b);
    if (top > 210) {
      const e = (top - 210) * 0.5;
      r += e;
      g += e;
      b += e;
    }
    display.setPixel(i % W, (i / W) | 0, min(255, r), min(255, g), min(255, b));
  }
}
