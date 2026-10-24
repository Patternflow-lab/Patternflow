// ===== Patternflow pattern =====
// Title:   Origami
// Family:  paper
// Idea:    A square of origami paper lies on a dark table under a lamp and folds into a crane one crease at a time, each flap swinging over with the light sliding across its face and the white back turning up, then the crane opens flat again and its crease pattern glows faintly before the next sheet is laid on top.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after the orizuru, the paper crane folded from the bird base
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Paper=0..1, Speed=0.2..3, Sheets=1..3, Lamp=-1..1
//
// Knob 1: Paper. Which sheet comes off the pack: teal kami at 0, then indigo chiyogami printed with seigaiha waves, gold foil, pink with white kanoko dots, yellow, green ichimatsu checks, silver foil and vermilion at 1. Each new sheet is the next one in the pack, and the pack in the corner shows which.
// Knob 2: Speed. How fast the hands fold: at 2 a fold takes about a second and a sheet goes from flat to crane and back to flat in twenty-two seconds; at 0.2 it all runs ten times slower.
// Knob 3: Sheets. How many sheets fold at once, one above the other, each a step behind the last: one big sheet at 1, three small ones at 3.
// Knob 4: Lamp. Where the lamp stands, from the left of the table at -1 to the right at 1. The flaps that turn toward it light up, the far side of the sheet falls into shade and a lifted flap throws its shadow the other way.
// Buttons: K1 tap opens the crane flat now, or lays the next sheet if it is already open.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sin, cos, sqrt, abs, hypot, log, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const mix = (a, b, t) => a + (b - a) * t;

// The sheet is a diamond with corners (0, ±1) and (±1, 0), its crease-pattern
// coordinates. K is where the petal fold's hinge crosses the square base and Q
// is half the width of a leg once it is thinned.
const K = 1 - Math.SQRT1_2;
const Q = Math.SQRT1_2 * Math.tan(PI / 16);

// An affine map [a, b, c, d, e, f]: x' = a x + b y + e, y' = c x + d y + f.
const mul = (M, A) => [
  M[0] * A[0] + M[1] * A[2], M[0] * A[1] + M[1] * A[3],
  M[2] * A[0] + M[3] * A[2], M[2] * A[1] + M[3] * A[3],
  M[0] * A[4] + M[1] * A[5] + M[4], M[2] * A[4] + M[3] * A[5] + M[5],
];
const tx = (A, c, j) => A[0] * c[j] + A[1] * c[j + 1] + A[4];
const ty = (A, c, j) => A[2] * c[j] + A[3] * c[j + 1] + A[5];
// A flap turned by theta about the hinge through (hx, hy) with unit normal
// (nx, ny) toward the flap, as seen from straight above: k = cos(theta) - 1.
// At k = -2 the flap lies flat on the other side, mirrored.
function hingeM(h, k) {
  const [hx, hy, nx, ny] = h;
  const hn = hx * nx + hy * ny;
  return [1 + k * nx * nx, k * nx * ny, k * nx * ny, 1 + k * ny * ny, -k * hn * nx, -k * hn * ny];
}

// The crane. Each step is one or more folds: a crease line, a point on the
// side that moves, which facets go (by the eighth of the sheet they came from
// or where they lie now), and +1 for a valley fold that lands on top or -1
// for one that goes behind.
const ALL = () => true;
const sec = (...s) => (f) => s.includes(f.sec);
const low = (...s) => (f, x, y) => y > K && s.includes(f.sec);
const legL = (f, x, y) => x < 0 && y > K;
const legR = (f, x, y) => x > 0 && y > K;
// The legs turn up about a line through (0, YP) along NL, so neck and tail
// rise at 40 degrees.
const YP = 0.34;
const NL = [-0.906, 0.423];
const CRANE = [
  // In half, corner to corner.
  [{ l: [-1, 0, 1, 0], s: [0, -1], m: 1, sel: ALL }],
  // Turned so the fold lies along the top.
  [],
  // The side corners down to the bottom one: the square base.
  [{ l: [0, 0, -0.5, 0.5], s: [-1, 0], m: 1, sel: ALL }, { l: [0, 0, 0.5, 0.5], s: [1, 0], m: 1, sel: ALL }],
  // Kite folds, the front layer to the front and the back one behind.
  [{ l: [0, 1, -K, K], s: [-0.5, 0.5], m: 1, sel: sec(3) }, { l: [0, 1, K, K], s: [0.5, 0.5], m: 1, sel: sec(0) },
    { l: [0, 1, -K, K], s: [-0.5, 0.5], m: -1, sel: sec(2) }, { l: [0, 1, K, K], s: [0.5, 0.5], m: -1, sel: sec(1) }],
  // The petal folds: front and back layers lift up past the top.
  [{ l: [-1, K, 1, K], s: [0, 1], m: 1, sel: sec(0, 3) }, { l: [-1, K, 1, K], s: [0, 1], m: -1, sel: sec(1, 2) }],
  // The sides of the middle layers tuck in: the bird base.
  [{ l: [0, 1, -K, K], s: [-0.5, 0.5], m: -1, sel: low(4, 5) }, { l: [0, 1, K, K], s: [0.5, 0.5], m: -1, sel: low(6, 7) }],
  // The legs thinned.
  [{ l: [0, 1, -Q, K], s: [-K, K], m: -1, sel: legL }, { l: [0, 1, Q, K], s: [K, K], m: -1, sel: legR }],
  // The legs reverse-folded up into neck and tail.
  [{ l: [0, YP, NL[0], YP + NL[1]], s: [0, 1], m: -1, sel: legL }, { l: [0, YP, -NL[0], YP + NL[1]], s: [0, 1], m: -1, sel: legR }],
  // The tip of the neck reverse-folded down into the head.
  [{ l: [-0.515, -0.013, -0.374, 0.004], s: [-0.506, -0.084], m: -1, sel: (f, x) => f.H[8] && x < 0 }],
];
// Seconds per step at Speed 2, and how the sheet lies on the table at each
// state: turned 45 degrees it is a square on the panel.
const DUR = [1.1, 0.7, 1.1, 0.8, 1.1, 0.8, 0.7, 1.0, 0.6];
const PHI = [PI / 4, PI / 4, 0, 0, 0, 0, 0, 0, 0, 0];
// The finished crane flaps its front wing about the line it was lifted on.
const FLAPH = [0, K, 0, -1, 1];

// A crease as a point on it and its unit normal toward the side that moves.
function lineOf(mv) {
  const [x1, y1, x2, y2] = mv.l;
  const l = hypot(x2 - x1, y2 - y1) * ((mv.s[0] - x1) * (y1 - y2) + (mv.s[1] - y1) * (x2 - x1) < 0 ? -1 : 1);
  return [x1, y1, (y1 - y2) / l, (x2 - x1) / l];
}

// Cut a convex polygon by the sign of d, keeping the side s.
function clip(cp, d, s) {
  const out = [];
  d.forEach((v, i) => {
    const j = (i + 1) % d.length;
    const a = v * s;
    const b = d[j] * s;
    const t = a / (a - b);
    if (a >= 0) out.push(cp[2 * i], cp[2 * i + 1]);
    if (a * b < 0) out.push(cp[2 * i] + t * (cp[2 * j] - cp[2 * i]), cp[2 * i + 1] + t * (cp[2 * j + 1] - cp[2 * i + 1]));
  });
  return out;
}

// Fold the sheet through every step once, cutting facets along each crease
// they cross. Each facet keeps where it lies, which way up and in which layer
// at every state, so any moment of the folding and unfolding is a lookup.
function build(steps) {
  const C = [[1, 0], [0.5, 0.5], [0, 1], [-0.5, 0.5], [-1, 0], [-0.5, -0.5], [0, -1], [0.5, -0.5]];
  const F = C.map((c, s) => ({ cp: [0, 0, c[0], c[1], ...C[(s + 1) % 8]], sec: s, T: [[1, 0, 0, 1, 0, 0]], L: [0], H: [null] }));
  const n = steps.length;
  for (let k = 1; k <= n; k++) {
    const top = max(...F.map((f) => f.L[k - 1]));
    const bot = min(...F.map((f) => f.L[k - 1]));
    for (const f of F) (f.T[k] = f.T[k - 1]), (f.L[k] = f.L[k - 1]), (f.H[k] = null);
    for (const mv of steps[k - 1]) {
      const h = lineOf(mv);
      const [px, py, nx, ny] = h;
      const moved = [];
      for (const f of F.slice()) {
        if (f.H[k]) continue;
        const A = f.T[k - 1];
        const cp = f.cp;
        const m = cp.length / 2;
        let cx = 0;
        let cy = 0;
        const d = [];
        for (let j = 0; j < 2 * m; j += 2) {
          const x = tx(A, cp, j);
          const y = ty(A, cp, j);
          (cx += x / m), (cy += y / m);
          const dd = (x - px) * nx + (y - py) * ny;
          d.push(abs(dd) < 1e-9 ? 0 : dd);
        }
        if (!mv.sel(f, cx, cy) || max(...d) < 1e-6) continue;
        let g = f;
        if (min(...d) < -1e-6) {
          g = { cp: clip(cp, d, 1), sec: f.sec, T: f.T.slice(), L: f.L.slice(), H: f.H.slice() };
          f.cp = clip(cp, d, -1);
          F.push(g);
        }
        moved.push(g);
      }
      let lo = 1e9;
      let hi = -1e9;
      for (const g of moved) (lo = min(lo, g.L[k - 1])), (hi = max(hi, g.L[k - 1]));
      for (const g of moved) {
        g.T[k] = mul(hingeM(h, -2), g.T[k - 1]);
        g.H[k] = [px, py, nx, ny, mv.m];
        g.L[k] = mv.m > 0 ? top + 1 + hi - g.L[k - 1] : bot - 1 - (g.L[k - 1] - lo);
      }
    }
  }
  // Facets that lie together at a state share a group there: a crease shows
  // between two facets that lie together now but were parted at the deepest
  // fold.
  // And the extent of each state, turned as it lies, for the camera.
  const nf = F.length;
  const gid = new Int32Array(nf * (n + 1));
  const det = new Int8Array(nf * (n + 1));
  const box = [];
  for (let k = 0; k <= n; k++) {
    const seen = new Map();
    const c = cos(PHI[k]);
    const s = sin(PHI[k]);
    const b = [1e9, -1e9, 1e9, -1e9];
    F.forEach((f, i) => {
      const A = f.T[k];
      const key = A.map((v) => round(v * 1e4)).join();
      if (!seen.has(key)) seen.set(key, seen.size);
      gid[i * (n + 1) + k] = seen.get(key);
      det[i * (n + 1) + k] = A[0] * A[3] - A[1] * A[2] > 0 ? 1 : -1;
      for (let j = 0; j < f.cp.length; j += 2) {
        const x = tx(A, f.cp, j);
        const y = ty(A, f.cp, j);
        const u = x * c - y * s;
        const v = x * s + y * c;
        (b[0] = min(b[0], u)), (b[1] = max(b[1], u)), (b[2] = min(b[2], v)), (b[3] = max(b[3], v));
      }
    });
    const u = (b[0] + b[1]) / 2;
    const v = (b[2] + b[3]) / 2;
    box.push([u * c + v * s, -u * s + v * c, b[1] - b[0], b[3] - b[2]]);
  }
  const tilt = F32(nf * 2);
  for (let i = 0; i < nf * 2; i++) tilt[i] = Math.random() - 0.5;
  return { F, n, gid, det, box, tilt };
}

// Papers: colour, second colour, print. 0 plain kami, 1 seigaiha waves,
// 2 metal foil, 3 kanoko dots, 4 ichimatsu checks.
const PAPERS = [
  [[0.16, 0.72, 0.8], null, 0],
  [[0.13, 0.2, 0.58], [0.78, 0.86, 0.96], 1],
  [[1, 0.78, 0.3], null, 2],
  [[0.96, 0.46, 0.6], [1, 0.95, 0.96], 3],
  [[0.98, 0.78, 0.12], null, 0],
  [[0.12, 0.46, 0.26], [0.94, 0.88, 0.7], 4],
  [[0.74, 0.78, 0.84], null, 2],
  [[0.9, 0.16, 0.12], null, 0],
];
const WHITE = [0.95, 0.93, 0.87];

function print(kind, s, t) {
  if (kind === 1) {
    // Rows of scales two wide, each row half a scale lower and covering the one above.
    const X = s * 3;
    const Y = t * 3;
    const j = ceil(2 * Y);
    for (let jj = j + 1; jj >= j; jj--) {
      const ox = jj & 1;
      const dx = X - ox - 2 * round((X - ox) / 2);
      const dy = Y - jj / 2;
      const r = sqrt(dx * dx + dy * dy);
      if (r < 1 || jj === j) return (r * 3) % 1 < 0.4 ? 1 : 0;
    }
  }
  if (kind === 3) {
    const X = s * 5;
    const Y = t * 5;
    const ox = floor(Y) & 1 ? 0.5 : 0;
    const dx = X + ox - floor(X + ox) - 0.5;
    const dy = Y - floor(Y) - 0.5;
    return dx * dx + dy * dy < 0.06 ? 1 : 0;
  }
  if (kind === 4) return (floor(s * 4 + 4) + floor(t * 4 + 4)) & 1;
  return 0;
}

// The order a sheet goes through.
const WAIT = 0, IN = 1, REST = 2, FOLD = 3, HOLD = 4, SIT = 5, UNFOLD = 6, CREASE = 7;

const newSheet = (sl, first) =>
  Object.assign(sl, { old: first ? null : { seq: sl.seq, kmax: sl.kmax }, seq: sl.seq + 1, ph: IN, pt: 0, k: 0, u: 1, kmax: 0, rush: false });
const slot = (i) => ({ i, ph: WAIT, pt: -2.4 * i, k: 0, u: 1, kmax: 0, seq: -1, old: null, rush: false });
const F32 = (n) => new Float32Array(n);

export function setup(params) {
  const grain = F32(N);
  for (let y = 0; y < H; y++) {
    let w = Math.random();
    for (let x = 0; x < W; x++) {
      w += 0.25 * (Math.random() - 0.5);
      grain[y * W + x] = 0.75 + 0.2 * sin(y * 0.9 + 3 * sin(x * 0.05 + y * 0.02)) + 0.1 * w;
    }
  }
  params.s = { M: build(CRANE), slots: [slot(0)], n: 1, base: 0, rate: 1, lamp: 0.06, lampKey: null, grain, bg: F32(N * 3) };
  for (const k of ["LX", "LY", "LZ", "LI", "HZ"]) params.s[k] = F32(N);
}

function stepSlot(sl, h, M) {
  if (sl.rush && (sl.ph === UNFOLD || sl.ph === CREASE)) h *= 4;
  sl.pt += h;
  const ph = sl.ph;
  if (ph === WAIT && sl.pt >= 0) newSheet(sl, true);
  else if (ph === IN && sl.pt >= 1.2) Object.assign(sl, { ph: REST, pt: 0, old: null });
  else if (ph === REST && sl.pt >= 1) Object.assign(sl, { ph: FOLD, k: 1, u: 0 });
  else if (ph === FOLD) {
    sl.u = min(1, sl.u + h / DUR[sl.k - 1]);
    if (sl.u >= 1) Object.assign(sl, { kmax: max(sl.kmax, sl.k), ph: HOLD, pt: 0 });
  } else if (ph === HOLD && sl.pt >= 0.25) {
    if (sl.k < M.n) Object.assign(sl, { k: sl.k + 1, u: 0, ph: FOLD });
    else Object.assign(sl, { ph: SIT, pt: 0 });
  } else if (ph === SIT && sl.pt >= 3) sl.ph = UNFOLD;
  else if (ph === UNFOLD && (sl.u -= h / 0.45) <= 0) {
    if (sl.k > 1) (sl.k--), (sl.u += 1);
    else Object.assign(sl, { k: 0, u: 1, ph: CREASE, pt: 0 });
  } else if (ph === CREASE && (sl.pt >= 2.5 || sl.rush)) newSheet(sl, false);
}

export function update(dt, input, params) {
  const S = params.s;
  if (!S) return;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.base = floor(cl(k[0], 0, 1) * (PAPERS.length - 0.01));
  S.rate = cl(k[1], 0.2, 3) / 2;
  S.lamp = cl(k[3], -1, 1);
  const n = cl(round(k[2]), 1, 3);
  if (n !== S.n) {
    S.n = n;
    while (S.slots.length < n) S.slots.push(slot(S.slots.length));
    S.slots.length = n;
  }
  if (input.btnPressed && input.btnPressed[0])
    for (const sl of S.slots) {
      if (sl.ph === FOLD || sl.ph === HOLD || sl.ph === SIT) {
        if (sl.ph !== FOLD) sl.u = 1;
        sl.kmax = max(sl.kmax, sl.k);
        sl.ph = UNFOLD;
      } else if (sl.ph !== WAIT) {
        if (sl.ph === UNFOLD || sl.ph === CREASE) sl.rush = true;
        else newSheet(sl, false);
      }
    }
  for (const sl of S.slots) stepSlot(sl, dt * S.rate, S.M);
}

// The lamp: a bulb LH above the table at (lx, LY0). Each LED keeps the unit
// vector to it, the half vector's height for the shine on foil, and how much
// light reaches it. The table is dark walnut, kept below 24 of 255; on it lie
// the pack of paper, the next sheet on top, and a bone folder.
const LH = 80;
const LY0 = 34;
const PC = cos(-0.2);
const PS = sin(-0.2);
function lampField(S, next) {
  const lx = 31.5 + 44 * S.lamp;
  const { LX, LY, LZ, LI, HZ, bg, grain } = S;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const dx = lx - x - 0.5;
      const dy = LY0 - y - 0.5;
      const r2 = dx * dx + dy * dy;
      const l = sqrt(r2 + LH * LH);
      LX[p] = dx / l;
      LY[p] = dy / l;
      LZ[p] = LH / l;
      LI[p] = (LH * LH) / (LH * LH + 0.4 * r2);
      HZ[p] = (LZ[p] + 1) / sqrt(LX[p] * LX[p] + LY[p] * LY[p] + (LZ[p] + 1) * (LZ[p] + 1));
      const lit = LI[p] * (0.22 + 0.9 * LZ[p]);
      const w = min(21, 255 * 0.085 * (0.25 + 0.75 * LI[p]) * grain[p]);
      let c = [w, w * 0.56, w * 0.32];
      // The pack: four sheets a little askew, each showing an edge of its colour.
      for (let j = 0; j < 4; j++) {
        const X = x + 0.5 + 1 - 0.9 * j;
        const Y = y + 0.5 - 1 - 1.3 * j;
        const u = (X * PC + Y * PS) / 13;
        const v = (Y * PC - X * PS) / 13;
        if (abs(u) < 1 && abs(v) < 1) {
          const P = PAPERS[(next + j) % PAPERS.length];
          const col = P[2] !== 2 && print(P[2], u, v) ? P[1] : P[0];
          const e = (abs(u) > 0.92 || abs(v) > 0.92 ? 0.7 : 1) * (j ? 0.8 : 1) * (P[2] === 2 ? 0.75 : 1);
          c = col.map((v) => 255 * v * lit * e);
          break;
        }
      }
      // The bone folder, rounded at both ends, its back catching the lamp.
      const ax = x + 0.5 - 47;
      const ay = y + 0.5 - 118;
      const t = cl((ax * 14 - ay * 15) / 421, 0, 1);
      const d = hypot(ax - 14 * t, ay + 15 * t);
      if (d < 1.7) c = [0.8, 0.74, 0.62].map((v) => 255 * v * lit * (0.75 + 0.35 * (1 - d / 1.7)));
      bg[p * 3] = c[0];
      bg[p * 3 + 1] = c[1];
      bg[p * 3 + 2] = c[2];
    }
  S.lp = [lx, LY0, LH];
}

// Per frame: every facet on the table, as drawn.
// RA maps it from the crease pattern to the panel, RN is its lit normal, RK
// its draw order; RS the side up, RP the paper, RQ the sheet; RG and RX its
// group now and at the deepest fold, RU and RL its side and layer there.
const MAXR = 1600;
const [RA, RN, RK, RL, RM] = [6, 3, 1, 1, 1].map((k) => F32(MAXR * k));
const [RS, RU] = [new Int8Array(MAXR), new Int8Array(MAXR)];
const [RP, RQ, RG, RX] = [0, 0, 0, 0].map(() => new Int32Array(MAXR));
const ORD = [];
const RCP = [];
const ID = new Int16Array(N);
const SHK = F32(N);
const VX = F32(64);
const VY = F32(64);
let nr = 0;

// Fill a convex polygon with v; mode 0 writes facet ids, mode 1 raises the
// shadow key.
function fill(cnt, v, mode) {
  let ya = 1e9;
  let yb = -1e9;
  for (let i = 0; i < cnt; i++) (ya = min(ya, VY[i])), (yb = max(yb, VY[i]));
  const y0 = max(0, ceil(ya - 0.5));
  const y1 = min(H - 1, floor(yb - 0.5));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    let xl = 1e9;
    let xr = -1e9;
    for (let i = 0; i < cnt; i++) {
      const j = i + 1 < cnt ? i + 1 : 0;
      const ay = VY[i];
      const by = VY[j];
      if ((ay <= py && by > py) || (by <= py && ay > py)) {
        const x = VX[i] + ((py - ay) / (by - ay)) * (VX[j] - VX[i]);
        (xl = min(xl, x)), (xr = max(xr, x));
      }
    }
    const x0 = max(0, ceil(xl - 0.5));
    const x1 = min(W - 1, floor(xr - 0.5));
    const row = y * W;
    if (mode === 0) for (let x = x0; x <= x1; x++) ID[row + x] = v;
    else for (let x = x0; x <= x1; x++) if (SHK[row + x] < v) SHK[row + x] = v;
  }
}

// The camera for state j of a sheet in its slot: turned PHI[j], scaled to fit.
function viewOf(M, j, fw, fh, zmax) {
  const b = M.box[j];
  return [PHI[j], log(min(fw / b[2], fh / b[3], zmax)), b[0], b[1]];
}

// Put one sheet on the table: model M at step k, progress u, in slot
// region (cy, fw, fh), paper index pi. dx and dphi slide a new sheet in.
function placeSheet(S, M, k, u, flap, kmax, pi, cyp, fw, fh, zmax, dx, dy, dphi, keyBase, mem, qid) {
  const n1 = M.n + 1;
  const go = k > 0 && u > 0 && u < 1;
  const jb = k === 0 ? 0 : u >= 1 ? k : k - 1;
  const a = viewOf(M, k > 0 ? k - 1 : 0, fw, fh, zmax);
  const b = viewOf(M, k, fw, fh, zmax);
  const w = k > 0 ? ease(u) : 1;
  const phi = mix(a[0], b[0], w) + dphi;
  const z = exp(mix(a[1], b[1], w));
  const ccx = mix(a[2], b[2], w);
  const ccy = mix(a[3], b[3], w);
  const c = cos(phi) * z;
  const s = sin(phi) * z;
  const V = [c, -s, s, c, 31.5 + dx - (c * ccx - s * ccy), cyp + dy - (s * ccx + c * ccy)];
  const [lx, ly, lh] = S.lp;
  M.F.forEach((f, i) => {
    if (nr >= MAXR) return;
    const r = nr++;
    // The hinge this facet turns on now, if any: the fold under way, or the
    // finished crane's wing beat.
    let hg = null;
    let th = 0;
    if (go && f.H[k]) (hg = f.H[k]), (th = PI * ease(u));
    else if (flap > 0 && (f.sec === 0 || f.sec === 3)) (hg = FLAPH), (th = flap);
    const A0 = f.T[jb];
    const ct = cos(th);
    const st = sin(th);
    const A = mul(V, hg ? mul(hingeM(hg, ct - 1), A0) : A0);
    RA.set(A, r * 6);
    RCP[r] = f.cp;
    let side = M.det[i * n1 + jb];
    let nx = 0;
    let ny = 0;
    let nz = 1;
    let key = f.L[jb];
    if (hg) {
      const m = hg[4];
      // The hinge normal as it lies on the panel.
      const hx = hg[2] * cos(phi) - hg[3] * sin(phi);
      const hy = hg[2] * sin(phi) + hg[3] * cos(phi);
      nx = -m * st * hx;
      ny = -m * st * hy;
      nz = ct;
      if (ct < 0) (nx = -nx), (ny = -ny), (nz = -nz), (side = -side);
      key = (m > 0 ? 1e6 : -1e6) + (ct >= 0 ? f.L[jb] : go ? f.L[k] : -f.L[jb]);
      // A lifted flap throws its shadow away from the lamp.
      if (m > 0 && st > 0.02) {
        const cp = f.cp;
        const cnt = cp.length / 2;
        for (let j = 0; j < cnt; j++) {
          const hz = (((tx(A0, cp, 2 * j) - hg[0]) * hg[2] + (ty(A0, cp, 2 * j) - hg[1]) * hg[3]) * st * z) / lh;
          const px = tx(A, cp, 2 * j);
          const py = ty(A, cp, 2 * j);
          VX[j] = px + hz * (px - lx);
          VY[j] = py + hz * (py - ly);
        }
        fill(cnt, keyBase + key, 1);
      }
    }
    // Paper never lies quite flat: each layer tips a little its own way, and a
    // sheet opened out again keeps a tilt in every facet between its creases.
    const g = M.gid[i * n1 + jb];
    nx += 0.06 * M.tilt[2 * g] + 0.12 * mem * M.tilt[2 * i + 1];
    ny += 0.06 * M.tilt[2 * g + 1] + 0.12 * mem * M.tilt[2 * i];
    const nl = hypot(nx, ny, nz);
    RN[r * 3] = nx / nl;
    RN[r * 3 + 1] = ny / nl;
    RN[r * 3 + 2] = nz / nl;
    RS[r] = side;
    RK[r] = keyBase + key;
    RP[r] = pi;
    RG[r] = g;
    RX[r] = M.gid[i * n1 + kmax];
    RU[r] = M.det[i * n1 + kmax];
    RL[r] = f.L[kmax];
    RQ[r] = qid;
    RM[r] = mem;
    ORD.push(r);
  });
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const next = (S.base + S.slots[0].seq + 1) % PAPERS.length;
  const lk = S.lamp + 10 * next;
  if (S.lampKey !== lk) (S.lampKey = lk), lampField(S, next);
  const { M, LX, LY, LZ, LI, HZ, bg } = S;
  nr = 0;
  ORD.length = 0;
  SHK.fill(-1e12);
  const n = S.slots.length;
  const sh = H / n;
  const zmax = [74, 50, 34][n - 1];
  const fw = n === 1 ? 60 : n === 2 ? 56 : 46;
  const fh = sh - (n === 1 ? 12 : 8);
  let q = 0;
  for (const sl of S.slots) {
    if (sl.ph === WAIT) continue;
    const cyp = sl.i * sh + sh / 2;
    const pi = (S.base + 3 * sl.i + sl.seq) % PAPERS.length;
    if (sl.old) placeSheet(S, M, 0, 1, 0, sl.old.kmax, (S.base + 3 * sl.i + sl.old.seq) % PAPERS.length, cyp, fw, fh, zmax, 0, 0, 0, -1e8, 1, q++);
    let dx = 0;
    let dy = 0;
    let dphi = 0;
    if (sl.ph === IN) {
      // Slid off the pack in the corner.
      const e = 1 - ease(sl.pt / 1.2);
      dx = -62 * e;
      dy = (8 - cyp) * e;
      dphi = -0.2 * e;
    }
    let flap = 0;
    if (sl.ph === SIT) {
      // The crane beats its wing once.
      const t = (sl.pt - 0.6) / 1.6;
      if (t > 0 && t < 1) flap = 0.78 * PI * sin(PI * t) ** 2;
    }
    const mem = sl.ph === UNFOLD || sl.ph === CREASE ? 1 : 0;
    placeSheet(S, M, sl.k, sl.u, flap, sl.kmax, pi, cyp, fw, fh, zmax, dx, dy, dphi, 0, mem, q++);
  }
  ORD.sort((a, b) => RK[a] - RK[b]);
  ID.fill(-1);
  for (const r of ORD) {
    const cp = RCP[r];
    const A = RA.subarray(r * 6, r * 6 + 6);
    for (let j = 0; j < cp.length; j += 2) (VX[j / 2] = tx(A, cp, j)), (VY[j / 2] = ty(A, cp, j));
    fill(cp.length / 2, r, 0);
  }
  const lx = S.lp[0];
  const sx = lx < 31.5 ? -1 : 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const r = ID[p];
      if (r < 0) {
        const f = SHK[p] > -1e11 ? 0.55 : 1;
        display.setPixel(x, y, bg[p * 3] * f, bg[p * 3 + 1] * f, bg[p * 3 + 2] * f);
      } else {
        // The print, found back in the crease pattern: paper square s, t in -1..1.
        const o = r * 6;
        const [a, b, c, d] = [RA[o], RA[o + 1], RA[o + 2], RA[o + 3]];
        const det = a * d - b * c;
        const P = PAPERS[RP[r]];
        let col = P[0];
        let kind = P[2];
        if (RS[r] < 0) (col = WHITE), (kind = -1);
        else if (P[1] && abs(det) > 1e-3) {
          const X = x + 0.5 - RA[o + 4];
          const Y = y + 0.5 - RA[o + 5];
          const cu = (d * X - b * Y) / det;
          const cv = (a * Y - c * X) / det;
          if (print(kind, cu + cv, cv - cu)) col = P[1];
        }
        const nz = RN[r * 3 + 2];
        const I = LI[p];
        const hz = max(0, nz * HZ[p]);
        // Kami is matte with a little sheen; foil is darker but throws the lamp back.
        const fo = kind === 2;
        const lit = I * (0.22 + 0.9 * max(0, RN[r * 3] * LX[p] + RN[r * 3 + 1] * LY[p] + nz * LZ[p])) * (fo ? 0.8 : 1);
        const sp = I * (fo ? 0.25 + 0.9 * hz ** 12 : 0.06 * hz ** 8);
        // Shade under a lifted flap, and along the edge of a layer above.
        const k = RK[r];
        let f = SHK[p] > k ? 0.55 : 1;
        const s = x - sx >= 0 && x - sx < W && y > 0 ? ID[p - W - sx] : -1;
        if (s >= 0 && RQ[s] === RQ[r] && RK[s] > k + 0.5 && RG[s] !== RG[r]) f *= 0.66;
        // Creases left from the folding.
        if (RM[r] > 0) {
          for (const s of [x + 1 < W ? ID[p + 1] : -1, y + 1 < H ? ID[p + W] : -1])
            if (s >= 0 && s !== r && RQ[s] === RQ[r] && RG[s] === RG[r] && RX[s] !== RX[r]) {
              const up = RL[s] > RL[r] ? s : r;
              f *= RU[up] * RS[r] > 0 ? 1.22 : 0.72;
              break;
            }
        }
        const m = 255 * f * (fo ? lit + sp : lit);
        const e = fo ? 0 : 255 * f * sp;
        display.setPixel(x, y, min(255, col[0] * m + e), min(255, col[1] * m + e), min(255, col[2] * m + e));
      }
    }
}
