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
// Knob 1: Paper. Which sheet comes off the pack: teal kami at 0, then indigo chiyogami printed with seigaiha waves, gold foil, pink with white kanoko dots, yellow, green ichimatsu checks, silver foil and vermilion at 1. Each new sheet is the next one in the pack.
// Knob 2: Speed. How fast the hands fold: at 2 a fold takes about a second and a sheet goes from flat to crane and back in twenty-three seconds; at 0.2 it runs ten times slower.
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
// The legs turn up about a line through (0, YP) along NL: neck and tail rise
// 40 degrees above the table's edge.
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
  // The head.
  [{ head: 1, m: -1, sel: (f, x) => f.H[8] && x < 0 }],
];
// Seconds per step at Speed 2, and how the sheet lies on the table at each
// state: turned 45 degrees it is a square on the panel.
const DUR = [1.1, 0.7, 1.1, 0.8, 1.1, 0.8, 0.7, 1.0, 0.6];
const PHI = [PI / 4, PI / 4, 0, 0, 0, 0, 0, 0, 0, 0];
// The finished crane flaps its front wing about the line it was lifted on.
const FLAPH = [0, K, 0, -1, 1];

function reflectPt(p, h) {
  const d = (p[0] - h[0]) * h[2] + (p[1] - h[1]) * h[3];
  return [p[0] - 2 * d * h[2], p[1] - 2 * d * h[3]];
}

function lineOf(mv) {
  const [x1, y1, x2, y2] = mv.l;
  let nx = y1 - y2;
  let ny = x2 - x1;
  if ((mv.s[0] - x1) * nx + (mv.s[1] - y1) * ny < 0) (nx = -nx), (ny = -ny);
  const l = hypot(nx, ny);
  return [x1, y1, nx / l, ny / l];
}

// Cut a convex polygon by the sign of d, keeping the side s.
function clip(cp, d, s) {
  const out = [];
  const m = d.length;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    const a = d[i] * s;
    const b = d[j] * s;
    if (a >= 0) out.push(cp[2 * i], cp[2 * i + 1]);
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
      const t = a / (a - b);
      out.push(cp[2 * i] + t * (cp[2 * j] - cp[2 * i]), cp[2 * i + 1] + t * (cp[2 * j + 1] - cp[2 * i + 1]));
    }
  }
  return out;
}

// Fold the sheet through every step once, cutting facets along each crease
// they cross. Each facet keeps where it lies, which way up and in which layer
// at every state, so any moment of the folding and unfolding is a lookup.
function build(steps) {
  const C = [[1, 0], [0.5, 0.5], [0, 1], [-0.5, 0.5], [-1, 0], [-0.5, -0.5], [0, -1], [0.5, -0.5]];
  const F = C.map((c, s) => ({ cp: [0, 0, c[0], c[1], ...C[(s + 1) % 8]], sec: s, T: [[1, 0, 0, 1, 0, 0]], L: [0], H: [null] }));
  const n = steps.length;
  const lines = [];
  for (let k = 1; k <= n; k++) {
    let top = -1e9;
    let bot = 1e9;
    for (const f of F) {
      f.T[k] = f.T[k - 1];
      f.L[k] = f.L[k - 1];
      f.H[k] = null;
      top = max(top, f.L[k - 1]);
      bot = min(bot, f.L[k - 1]);
    }
    for (const mv of steps[k - 1]) {
      let h;
      if (mv.head) {
        // The tip of the neck, bent down and forward.
        const tip = reflectPt([0, 1], lines[k - 2][0]);
        const r = [-0.766, -0.643];
        const J = [tip[0] - 0.13 * r[0], tip[1] - 0.13 * r[1]];
        const to = [J[0] - 0.13 * 0.9, J[1] + 0.13 * 0.44];
        const nx = tip[0] - to[0];
        const ny = tip[1] - to[1];
        const l = hypot(nx, ny);
        h = [(tip[0] + to[0]) / 2, (tip[1] + to[1]) / 2, nx / l, ny / l];
      } else h = lineOf(mv);
      (lines[k - 1] = lines[k - 1] || []).push(h);
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
        for (let j = 0; j < m; j++) {
          const x = A[0] * cp[2 * j] + A[1] * cp[2 * j + 1] + A[4];
          const y = A[2] * cp[2 * j] + A[3] * cp[2 * j + 1] + A[5];
          cx += x / m;
          cy += y / m;
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
  const nf = F.length;
  const gid = new Int32Array(nf * (n + 1));
  const det = new Int8Array(nf * (n + 1));
  for (let k = 0; k <= n; k++) {
    const seen = new Map();
    F.forEach((f, i) => {
      const key = f.T[k].map((v) => round(v * 1e4)).join();
      if (!seen.has(key)) seen.set(key, seen.size);
      gid[i * (n + 1) + k] = seen.get(key);
      const A = f.T[k];
      det[i * (n + 1) + k] = A[0] * A[3] - A[1] * A[2] > 0 ? 1 : -1;
    });
  }
  // The extent of each state, turned as it lies, for the camera.
  const box = [];
  for (let k = 0; k <= n; k++) {
    const c = cos(PHI[k]);
    const s = sin(PHI[k]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const f of F) {
      const A = f.T[k];
      for (let j = 0; j < f.cp.length; j += 2) {
        const x = A[0] * f.cp[j] + A[1] * f.cp[j + 1] + A[4];
        const y = A[2] * f.cp[j] + A[3] * f.cp[j + 1] + A[5];
        const u = x * c - y * s;
        const v = x * s + y * c;
        (x0 = min(x0, u)), (x1 = max(x1, u)), (y0 = min(y0, v)), (y1 = max(y1, v));
      }
    }
    const u = (x0 + x1) / 2;
    const v = (y0 + y1) / 2;
    box.push([u * c + v * s, -u * s + v * c, x1 - x0, y1 - y0]);
  }
  const tilt = new Float32Array(nf * 2);
  for (let i = 0; i < nf * 2; i++) tilt[i] = Math.random() - 0.5;
  return { F, n, gid, det, box, tilt };
}

// Papers: colour, second colour, print. 0 plain kami, 1 seigaiha waves,
// 2 metal foil, 3 kanoko dots, 4 ichimatsu checks.
const PAPERS = [
  [[0.16, 0.72, 0.8], null, 0],
  [[0.13, 0.2, 0.58], [0.78, 0.86, 0.96], 1],
  [[0.96, 0.7, 0.26], null, 2],
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

function newSheet(sl, first) {
  sl.old = first ? null : { seq: sl.seq, kmax: sl.kmax };
  sl.seq++;
  sl.ph = IN;
  sl.pt = 0;
  sl.k = 0;
  sl.u = 1;
  sl.kmax = 0;
  sl.rush = false;
}

function slot(i) {
  return { i, ph: WAIT, pt: -2.4 * i, k: 0, u: 1, kmax: 0, seq: -1, old: null, rush: false };
}

export function setup(params) {
  const grain = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    let w = Math.random();
    for (let x = 0; x < W; x++) {
      w += 0.25 * (Math.random() - 0.5);
      grain[y * W + x] = 0.75 + 0.2 * sin(y * 0.9 + 3 * sin(x * 0.05 + y * 0.02)) + 0.1 * w;
    }
  }
  params.s = {
    M: build(CRANE),
    slots: [slot(0)],
    n: 1,
    base: 0,
    rate: 1,
    lamp: 0.06,
    lampKey: null,
    grain,
    bg: new Float32Array(N * 3),
    LX: new Float32Array(N),
    LY: new Float32Array(N),
    LZ: new Float32Array(N),
    LI: new Float32Array(N),
    HZ: new Float32Array(N),
    lp: [0, 0, 1],
  };
}

function stepSlot(sl, h, M) {
  if (sl.rush && (sl.ph === UNFOLD || sl.ph === CREASE)) h *= 4;
  sl.pt += h;
  switch (sl.ph) {
    case WAIT:
      if (sl.pt >= 0) newSheet(sl, true);
      break;
    case IN:
      if (sl.pt >= 1.2) (sl.ph = REST), (sl.pt = 0), (sl.old = null);
      break;
    case REST:
      if (sl.pt >= 1) (sl.ph = FOLD), (sl.k = 1), (sl.u = 0);
      break;
    case FOLD:
      sl.u = min(1, sl.u + h / DUR[sl.k - 1]);
      if (sl.u >= 1) (sl.kmax = max(sl.kmax, sl.k)), (sl.ph = HOLD), (sl.pt = 0);
      break;
    case HOLD:
      if (sl.pt >= 0.25) {
        if (sl.k < M.n) (sl.k++), (sl.u = 0), (sl.ph = FOLD);
        else (sl.ph = SIT), (sl.pt = 0);
      }
      break;
    case SIT:
      if (sl.pt >= 3) sl.ph = UNFOLD;
      break;
    case UNFOLD:
      sl.u -= h / 0.45;
      if (sl.u <= 0) {
        if (sl.k > 1) (sl.k--), (sl.u += 1);
        else (sl.k = 0), (sl.u = 1), (sl.ph = CREASE), (sl.pt = 0);
      }
      break;
    case CREASE:
      if (sl.pt >= 2.5 || sl.rush) newSheet(sl, false);
      break;
  }
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
// light reaches it. The table is dark walnut, kept below 24 of 255.
const LH = 80;
const LY0 = 34;
function lampField(S) {
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
      const w = min(21, 255 * 0.085 * (0.25 + 0.75 * LI[p]) * grain[p]);
      bg[p * 3] = w;
      bg[p * 3 + 1] = w * 0.56;
      bg[p * 3 + 2] = w * 0.32;
    }
  S.lp = [lx, LY0, LH];
}

// Per frame: every facet on the table, as drawn.
const MAXR = 1600;
const RA = new Float32Array(MAXR * 6);
const RN = new Float32Array(MAXR * 3);
const RK = new Float32Array(MAXR);
const RS = new Int8Array(MAXR);
const RP = new Int16Array(MAXR);
const RG = new Int32Array(MAXR);
const RX = new Int32Array(MAXR);
const RU = new Int8Array(MAXR);
const RL = new Float32Array(MAXR);
const RQ = new Int16Array(MAXR);
const RM = new Float32Array(MAXR);
const ORD = [];
const RCP = [];
const ID = new Int16Array(N);
const SHK = new Float32Array(N);
const VX = new Float32Array(64);
const VY = new Float32Array(64);
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
function placeSheet(S, M, k, u, flap, kmax, pi, cyp, fw, fh, zmax, dx, dphi, keyBase, mem, qid) {
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
  const V = [c, -s, s, c, 31.5 + dx - (c * ccx - s * ccy), cyp - (s * ccx + c * ccy)];
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
          const x0 = A0[0] * cp[2 * j] + A0[1] * cp[2 * j + 1] + A0[4];
          const y0 = A0[2] * cp[2 * j] + A0[3] * cp[2 * j + 1] + A0[5];
          const hz = ((x0 - hg[0]) * hg[2] + (y0 - hg[1]) * hg[3]) * st * z;
          const px = A[0] * cp[2 * j] + A[1] * cp[2 * j + 1] + A[4];
          const py = A[2] * cp[2 * j] + A[3] * cp[2 * j + 1] + A[5];
          VX[j] = px + (hz * (px - lx)) / lh;
          VY[j] = py + (hz * (py - ly)) / lh;
        }
        fill(cnt, keyBase + key, 1);
      }
    }
    const tl = 0.05 + 0.1 * mem;
    nx += tl * M.tilt[2 * i];
    ny += tl * M.tilt[2 * i + 1];
    const nl = hypot(nx, ny, nz);
    RN[r * 3] = nx / nl;
    RN[r * 3 + 1] = ny / nl;
    RN[r * 3 + 2] = nz / nl;
    RS[r] = side;
    RK[r] = keyBase + key;
    RP[r] = pi;
    RG[r] = M.gid[i * n1 + jb];
    RX[r] = M.gid[i * n1 + kmax];
    RU[r] = M.det[i * n1 + kmax];
    RL[r] = f.L[kmax];
    RQ[r] = qid;
    RM[r] = mem;
    ORD.push(r);
  });
  return V;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.lampKey !== S.lamp) (S.lampKey = S.lamp), lampField(S);
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
    if (sl.old) placeSheet(S, M, 0, 1, 0, sl.old.kmax, (S.base + 3 * sl.i + sl.old.seq) % PAPERS.length, cyp, fw, fh, zmax, 0, 0, -1e8, 1, q++);
    let dx = 0;
    let dphi = 0;
    if (sl.ph === IN) {
      const e = 1 - ease(sl.pt / 1.2);
      dx = -78 * e;
      dphi = 0.35 * e;
    }
    let flap = 0;
    if (sl.ph === SIT) {
      // The crane beats its wing once.
      const t = (sl.pt - 0.6) / 1.6;
      if (t > 0 && t < 1) flap = 0.78 * PI * sin(PI * t) ** 2;
    }
    const mem = sl.ph === UNFOLD || sl.ph === CREASE || (sl.ph === FOLD && sl.kmax >= M.n) ? 1 : 0;
    placeSheet(S, M, sl.k, sl.u, flap, sl.kmax, pi, cyp, fw, fh, zmax, dx, dphi, 0, mem, q++);
  }
  ORD.sort((a, b) => RK[a] - RK[b]);
  ID.fill(-1);
  for (const r of ORD) {
    const cp = RCP[r];
    const o = r * 6;
    const cnt = cp.length / 2;
    for (let j = 0; j < cnt; j++) {
      VX[j] = RA[o] * cp[2 * j] + RA[o + 1] * cp[2 * j + 1] + RA[o + 4];
      VY[j] = RA[o + 2] * cp[2 * j] + RA[o + 3] * cp[2 * j + 1] + RA[o + 5];
    }
    fill(cnt, r, 0);
  }
  const lx = S.lp[0];
  const sx = lx < 31.5 ? -1 : 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const r = ID[p];
      let R;
      let G;
      let B;
      if (r < 0) {
        const f = SHK[p] > -1e11 ? 0.55 : 1;
        R = bg[p * 3] * f;
        G = bg[p * 3 + 1] * f;
        B = bg[p * 3 + 2] * f;
      } else {
        const o = r * 6;
        const a = RA[o];
        const b = RA[o + 1];
        const c = RA[o + 2];
        const d = RA[o + 3];
        const det = a * d - b * c;
        const P = PAPERS[RP[r]];
        let col = P[0];
        let kind = P[2];
        if (RS[r] < 0) (col = WHITE), (kind = -1);
        else if (kind === 1 || kind === 3 || kind === 4) {
          if (abs(det) > 1e-3) {
            const X = x + 0.5 - RA[o + 4];
            const Y = y + 0.5 - RA[o + 5];
            const cu = (d * X - b * Y) / det;
            const cv = (-c * X + a * Y) / det;
            if (print(kind, cu + cv, cv - cu)) col = P[1];
          }
        }
        const nx = RN[r * 3];
        const ny = RN[r * 3 + 1];
        const nz = RN[r * 3 + 2];
        const dif = max(0, nx * LX[p] + ny * LY[p] + nz * LZ[p]);
        const I = LI[p];
        let lit = I * (0.22 + 0.9 * dif);
        let sp = 0;
        const hz = nz * HZ[p];
        if (kind === 2) {
          lit *= 0.45;
          sp = 1.3 * I * max(0, hz) ** 30;
        } else sp = 0.06 * I * max(0, hz) ** 8;
        // Shade under a lifted flap, and along the edge of a layer above.
        const k = RK[r];
        let f = SHK[p] > k ? 0.55 : 1;
        const qx = x - sx;
        const qy = y - 1;
        if (qx >= 0 && qx < W && qy >= 0) {
          const s = ID[qy * W + qx];
          if (s >= 0 && RQ[s] === RQ[r] && RK[s] > k + 0.5 && RG[s] !== RG[r]) f *= 0.66;
        }
        // Creases left from the folding.
        if (RM[r] > 0) {
          for (const s of [x + 1 < W ? ID[p + 1] : -1, y + 1 < H ? ID[p + W] : -1])
            if (s >= 0 && s !== r && RQ[s] === RQ[r] && RG[s] === RG[r] && RX[s] !== RX[r]) {
              const up = RL[s] > RL[r] ? s : r;
              f *= RU[up] * RS[r] > 0 ? 1.22 : 0.72;
              break;
            }
        }
        R = 255 * f * (col[0] * lit + sp * (kind === 2 ? col[0] : 1));
        G = 255 * f * (col[1] * lit + sp * (kind === 2 ? col[1] : 1));
        B = 255 * f * (col[2] * lit + sp * (kind === 2 ? col[2] : 1));
      }
      display.setPixel(x, y, min(255, R), min(255, G), min(255, B));
    }
}
