// ===== Patternflow pattern =====
// Title:   Minor Veins
// Family:  venation
// Idea:    A leaf blade held up against the light keeps growing past the top of the panel while its veins form by auxin canalization, so a thick midrib and a few secondaries stream down to the petiole below the bottom edge and a fresh fine net keeps appearing inside every areole that the stretching tissue opens.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Runions, Fuhrer, Lane, Federl, Rolland-Lagan and Prusinkiewicz, Modeling and visualization of leaf venation patterns (SIGGRAPH 2005); the space colonization algorithm of Runions, Lane and Prusinkiewicz (2007)
// Round:   214
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=0.6..5, Fineness=-1..1, Light=-1..1
//
// Knob 1: Hue.
// Knob 2: Growth.
// Knob 3: Fineness.
// Knob 4: Light.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, exp, sqrt, abs, round, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the tissue
const CX = 28, CY = 184; // centre of the expansion, below the panel; the root of the network sits on it
const G0 = 0.04; // relative growth rate at Growth 2, per second
const ITER = 0.1; // seconds of tissue time per colonization pass
const TTL = 4.5; // a source that no vein has reached in this many seconds is dropped
const MAJOR = 6; // tips downstream that make a vein permanent
const STEP = 1.5; // how far a vein node sprouts in one pass, LEDs
const RINF = 12; // a source calls the nearest vein node inside this radius
const TROP = 0.5; // forward bias of a sprout, along the line out from the centre
const LOOPF = 0.8; // a new node within this share of the spacing of another branch joins it, closing a loop
const INERTIA = 0.7; // weight of the vein's own heading against the pull of the sources
const LMAX = 3.4; // an edge longer than this is split by a new node
const KW = 0.85; // the blade is a wedge about the midrib: half-width KW times the distance from the root, plus a margin
const R0 = 32; // the seedling blade is this long, LEDs
const LEAN = 0.03; // the midrib leans this much to the right per LED of height
const NM = 5400, SM = 1500, LM = 1800; // capacity of nodes, sources, loop edges
// Where sources live, and how far a node may go before it is dropped.
const SX0 = -8, SX1 = 72, SY0 = -8, SY1 = CY - 4;
const PX0 = -14, PX1 = 78, PY0 = -18, PY1 = CY + 6;
const CS = 12; // cell of the grid the passes look up neighbours in
const GX = ceil((PX1 - PX0) / CS) + 1, GY = ceil((PY1 - PY0) / CS) + 1, GN = GX * GY;

// ---- the picture
const WA = 0.82; // display width of a vein: WA * (tips downstream * stretch)^0.25, LEDs
const EXPT = new Float32Array(560);
for (let i = 0; i < EXPT.length; i++) EXPT[i] = exp(-i / 96);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

export function setup(params) {
  const S = {
    n: 0, ns: 0, nl: 0,
    x: new Float32Array(NM), y: new Float32Array(NM), par: new Int32Array(NM),
    rb: new Float32Array(NM), bs: new Float32Array(NM), maj: new Uint8Array(NM), rk: new Float32Array(NM), vis: new Float32Array(NM), wd: new Float32Array(NM), ms: new Float32Array(NM), mass: new Float32Array(NM),
    nch: new Int32Array(NM), stack: new Int32Array(NM), dead: new Uint8Array(NM), map: new Int32Array(NM),
    ax: new Float32Array(NM), ay: new Float32Array(NM), hx: new Float32Array(NM), hy: new Float32Array(NM), cnt: new Int32Array(NM), mark: new Int32Array(NM), stamp: 0,
    cc: new Int32Array(NM), cs: new Int32Array(GN + 1), fp: new Int32Array(GN), ci: new Int32Array(NM),
    sx: new Float32Array(SM), sy: new Float32Array(SM), sa: new Float32Array(SM), shead: new Int32Array(GN), snext: new Int32Array(SM),
    l0: new Int32Array(LM), l1: new Int32Array(LM),
    cv: new Float32Array(N), gl: new Float32Array(N), bl: new Float32Array(N), tn: new Float32Array(N),
    lam: new Float32Array(256 * 3), vein: new Float32Array(256 * 3), bloom: [1, 0.8, 0.4], key: "",
    hue: 0, gk: 1, sc: 2.6, u: 0.53, apex: R0,
    assumed: [1, 2.6], warm: false,
  };
  params.s = S;
  seed(S);
  prerun(S);
}

// A midrib along the ray from the centre, a few LEDs of it: the blade is a seedling.
function seed(S) {
  S.n = S.ns = S.nl = 0;
  S.apex = R0;
  const l = sqrt(LEAN * LEAN + 1);
  for (let d = 0; d < R0; d += 2.2) {
    const j = S.n++;
    S.x[j] = CX + (LEAN / l) * d;
    S.y[j] = CY - (1 / l) * d;
    S.par[j] = j - 1;
    S.rb[j] = max(d, 1);
    S.bs[j] = 99;
    S.maj[j] = 1;
    S.rk[j] = 0;
    S.ms[j] = 1;
  }
}

function prerun(S) {
  const gk = max(1, S.gk), f = exp(G0 * gk * ITER);
  seed(S);
  for (let t = 0; t < 56 / gk; t += ITER) {
    stretch(S, f);
    iterate(S);
  }
  for (let j = 0; j < S.n; j++) S.ms[j] = S.mass[j];
  S.assumed = [S.gk, S.sc];
  S.warm = true;
}

function stretch(S, f) {
  const { x, y, sx, sy } = S;
  S.apex = min(S.apex * f, 1500);
  for (let j = 0; j < S.n; j++) {
    x[j] = CX + (x[j] - CX) * f;
    y[j] = CY + (y[j] - CY) * f;
  }
  for (let i = 0; i < S.ns; i++) {
    sx[i] = CX + (sx[i] - CX) * f;
    sy[i] = CY + (sy[i] - CY) * f;
  }
}

// Is a point on the blade: above the base, inside the wedge, below the apex.
function inLeaf(S, px, py, margin) {
  const r = CY - py;
  if (r < 4 || px < SX0 || px > SX1 || py < SY0) return false;
  return abs(px - (CX + LEAN * r)) < KW * r + margin && r * r + (px - CX) * (px - CX) < S.apex * S.apex;
}

function cellOf(px, py) {
  let cx = floor((px - PX0) / CS), cy = floor((py - PY0) / CS);
  cx = cx < 0 ? 0 : cx >= GX ? GX - 1 : cx;
  cy = cy < 0 ? 0 : cy >= GY ? GY - 1 : cy;
  return cy * GX + cx;
}

// Nodes binned into cells, by counting sort.
function gridNodes(S) {
  const { x, y, cs, fp, ci, cc } = S, n = S.n;
  cs.fill(0);
  for (let j = 0; j < n; j++) {
    const c = cellOf(x[j], y[j]);
    cc[j] = c;
    cs[c + 1]++;
  }
  for (let c = 0; c < GN; c++) cs[c + 1] += cs[c];
  for (let c = 0; c < GN; c++) fp[c] = cs[c];
  for (let j = 0; j < n; j++) ci[fp[cc[j]]++] = j;
}

function iterate(S) {
  gridNodes(S);
  attract(S);
  sprout(S);
  prune(S);
  split(S);
  gridNodes(S);
  scatter(S);
  weigh(S);
}

// Each source calls the nearest vein node inside RINF, and dies when a node is
// within the kill distance of it.
function attract(S) {
  const { x, y, sx, sy, sa, cs, ci, ax, ay, cnt } = S, n = S.n;
  const dk = max(0.9, 0.52 * S.sc), dk2 = dk * dk, R2 = RINF * RINF;
  cnt.fill(0, 0, n);
  ax.fill(0, 0, n);
  ay.fill(0, 0, n);
  const { par, hx, hy } = S;
  for (let j = 1; j < n; j++) {
    const p = par[j], ex = x[j] - x[p], ey = y[j] - y[p], el = sqrt(ex * ex + ey * ey) || 1;
    hx[j] = ex / el;
    hy[j] = ey / el;
  }
  hx[0] = hy[0] = 0;
  let m = 0;
  for (let i = 0; i < S.ns; i++) {
    const px = sx[i], py = sy[i];
    if (!inLeaf(S, px, py, 6) || sa[i] > TTL) continue;
    const c = cellOf(px, py), gx = c % GX, gy = (c / GX) | 0;
    let best = -1, bd = 1e9, call = -1, cd = 1e9;
    for (let yy = max(0, gy - 1); yy <= min(GY - 1, gy + 1); yy++)
      for (let xx = max(0, gx - 1); xx <= min(GX - 1, gx + 1); xx++) {
        const q = yy * GX + xx;
        for (let k = cs[q]; k < cs[q + 1]; k++) {
          const j = ci[k], dx = x[j] - px, dy = y[j] - py, d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = j;
          }
          // A node does not turn back on itself for a source: it calls only those ahead of its heading or abeam of it.
          if (d < cd && (dx * hx[j] + dy * hy[j]) * -1 >= -0.17 * sqrt(d)) {
            cd = d;
            call = j;
          }
        }
      }
    if (best >= 0 && bd < dk2) continue;
    sx[m] = px;
    sy[m] = py;
    sa[m] = sa[i] + ITER;
    m++;
    if (call >= 0 && cd < R2) {
      const d = sqrt(cd);
      ax[call] += (px - x[call]) / d;
      ay[call] += (py - y[call]) / d;
      cnt[call]++;
    }
  }
  S.ns = m;
}

// A node that some sources called sprouts one step toward their mean direction,
// bent forward by the tropism. A sprout that lands within DLOOP of another
// branch joins it, which closes a loop.
function sprout(S) {
  const { x, y, par, cnt, ax, ay, cs, ci, mark } = S, n0 = S.n;
  for (let j = 0; j < n0; j++) {
    if (!cnt[j]) continue;
    if (S.n >= NM) break;
    let dx = ax[j] / cnt[j], dy = ay[j] / cnt[j];
    const l = sqrt(dx * dx + dy * dy);
    if (l < 1e-3) continue;
    dx /= l;
    dy /= l;
    let rx = x[j] - CX, ry = y[j] - CY;
    const rl = sqrt(rx * rx + ry * ry) || 1;
    dx += (TROP * rx) / rl;
    dy += (TROP * ry) / rl;
    // Inertia: a vein keeps its heading, so it bends in arcs instead of corners.
    const pj = par[j];
    if (pj >= 0) {
      const hx = x[j] - x[pj], hy = y[j] - y[pj], hl = sqrt(hx * hx + hy * hy) || 1;
      dx += (INERTIA * hx) / hl;
      dy += (INERTIA * hy) / hl;
    }
    const dl = sqrt(dx * dx + dy * dy) || 1;
    const nx = x[j] + (STEP * dx) / dl, ny = y[j] + (STEP * dy) / dl;
    if (nx < PX0 || nx > PX1 || ny < PY0 || ny > PY1 || abs(nx - (CX + LEAN * (CY - ny))) > KW * (CY - ny) + 8) continue;
    // Not on top of a node that is already there.
    {
      const c0 = cellOf(nx, ny), cx0 = c0 % GX, cy0 = (c0 / GX) | 0;
      let crowd = false;
      for (let yy = max(0, cy0 - 1); !crowd && yy <= min(GY - 1, cy0 + 1); yy++)
        for (let xx = max(0, cx0 - 1); !crowd && xx <= min(GX - 1, cx0 + 1); xx++) {
          const cc = yy * GX + xx;
          for (let k = cs[cc]; k < cs[cc + 1]; k++) {
            const m = ci[k], ex = x[m] - nx, ey = y[m] - ny;
            if (ex * ex + ey * ey < 0.5) {
              crowd = true;
              break;
            }
          }
        }
      if (crowd) continue;
    }
    const q = S.n++;
    x[q] = nx;
    y[q] = ny;
    par[q] = j;
    rx = nx - CX;
    ry = ny - CY;
    S.rb[q] = sqrt(rx * rx + ry * ry);
    S.bs[q] = S.sc;
    S.maj[q] = 0;
    S.rk[q] = S.maj[j] || Math.random() < 0.3 ? Math.random() : S.rk[j];
    S.ms[q] = 1;
    // Loop: the nearest node of another branch, not within eight generations of j.
    if (S.nl >= LM) continue;
    const st = ++S.stamp;
    let a = j;
    for (let g = 0; g < 8 && a >= 0; g++) {
      mark[a] = st;
      a = par[a];
    }
    const c = cellOf(nx, ny), gx = c % GX, gy = (c / GX) | 0;
    let best = -1, bd = (LOOPF * S.sc) ** 2;
    for (let yy = max(0, gy - 1); yy <= min(GY - 1, gy + 1); yy++)
      for (let xx = max(0, gx - 1); xx <= min(GX - 1, gx + 1); xx++) {
        const cc = yy * GX + xx;
        for (let k = cs[cc]; k < cs[cc + 1]; k++) {
          const m = ci[k];
          if (mark[m] === st || mark[par[m]] === st) continue;
          const ex = x[m] - nx, ey = y[m] - ny, d = ex * ex + ey * ey;
          if (d < bd) {
            bd = d;
            best = m;
          }
        }
      }
    if (best >= 0) {
      S.l0[S.nl] = q;
      S.l1[S.nl] = best;
      S.nl++;
    }
  }
}

// Leaves outside the box go, and so do the finest leaves when the net has been
// asked to be coarser than they were born. Compacts the arrays.
function prune(S) {
  const { x, y, par, nch, stack, dead, map } = S, n = S.n;
  nch.fill(0, 0, n);
  for (let j = 1; j < n; j++) nch[par[j]]++;
  dead.fill(0, 0, n);
  let sp = 0;
  for (let j = 1; j < n; j++) if (!nch[j]) stack[sp++] = j;
  while (sp > 0) {
    const j = stack[--sp];
    const out = x[j] < PX0 || x[j] > PX1 || y[j] < PY0 || y[j] > PY1 || abs(x[j] - (CX + LEAN * (CY - y[j]))) > KW * (CY - y[j]) + 8;
    if (!out) continue;
    dead[j] = 1;
    const p = par[j];
    if (p > 0 && --nch[p] === 0) stack[sp++] = p;
  }
  let k = 0;
  for (let j = 0; j < n; j++) {
    if (dead[j]) {
      map[j] = -1;
      continue;
    }
    map[j] = k;
    if (k !== j) {
      x[k] = x[j];
      y[k] = y[j];
      par[k] = par[j];
      S.rb[k] = S.rb[j];
      S.bs[k] = S.bs[j];
      S.maj[k] = S.maj[j];
      S.rk[k] = S.rk[j];
      S.ms[k] = S.ms[j];
    }
    k++;
  }
  for (let j = 1; j < k; j++) par[j] = map[par[j]];
  S.n = k;
  let m = 0;
  for (let i = 0; i < S.nl; i++) {
    const a = map[S.l0[i]], b = map[S.l1[i]];
    if (a < 0 || b < 0) continue;
    S.l0[m] = a;
    S.l1[m] = b;
    m++;
  }
  S.nl = m;
}

// An edge the tissue has stretched past LMAX gets a node in the middle.
function split(S) {
  const { x, y, par } = S, n0 = S.n, L2 = LMAX * LMAX;
  for (let j = 1; j < n0; j++) {
    if (S.n >= NM) break;
    const p = par[j], dx = x[j] - x[p], dy = y[j] - y[p];
    if (dx * dx + dy * dy <= L2) continue;
    const m = S.n++;
    x[m] = x[p] + dx / 2;
    y[m] = y[p] + dy / 2;
    par[m] = p;
    par[j] = m;
    S.rb[m] = (S.rb[j] + S.rb[p]) / 2;
    S.bs[m] = S.bs[j];
    S.maj[m] = S.maj[j];
    S.rk[m] = S.rk[j];
    S.ms[m] = S.ms[j];
  }
  // A loop edge is split the same way, the new node hanging off its first end.
  const nl0 = S.nl;
  for (let i = 0; i < nl0; i++) {
    if (S.n >= NM) break;
    const a = S.l0[i], b = S.l1[i], dx = x[b] - x[a], dy = y[b] - y[a];
    if (dx * dx + dy * dy <= L2 * 1.3) continue;
    const m = S.n++;
    x[m] = x[a] + dx / 2;
    y[m] = y[a] + dy / 2;
    par[m] = a;
    S.rb[m] = (S.rb[a] + S.rb[b]) / 2;
    S.bs[m] = S.bs[a];
    S.maj[m] = 0;
    S.rk[m] = Math.random();
    S.ms[m] = 1;
    S.l0[i] = m;
  }
}

// New sources go where a point is farther than the spacing from every node and every source.
function scatter(S) {
  const { x, y, sx, sy, cs, ci, shead, snext } = S, s2 = S.sc * S.sc;
  shead.fill(-1);
  for (let i = 0; i < S.ns; i++) {
    const c = cellOf(sx[i], sy[i]);
    snext[i] = shead[c];
    shead[c] = i;
  }
  // Sample the wedge by area, out to the apex or the far corner of the box.
  const R = min(S.apex - 2, 200), r0 = 4, th = Math.atan(KW);
  if (S.n > NM * 0.9) return;
  const tries = cl(ceil((0.08 * th * (R * R - r0 * r0)) / s2 * 6.25), 6, 700);
  for (let t = 0; t < tries && S.ns < SM; t++) {
    const r = sqrt(r0 * r0 + Math.random() * (R * R - r0 * r0)), a = (Math.random() * 2 - 1) * th;
    const px = CX + LEAN * r + r * Math.sin(a), py = CY - r * Math.cos(a);
    if (!inLeaf(S, px, py, 0)) continue;
    const c = cellOf(px, py), gx = c % GX, gy = (c / GX) | 0;
    let ok = true;
    for (let yy = max(0, gy - 1); ok && yy <= min(GY - 1, gy + 1); yy++)
      for (let xx = max(0, gx - 1); ok && xx <= min(GX - 1, gx + 1); xx++) {
        const q = yy * GX + xx;
        for (let k = cs[q]; k < cs[q + 1]; k++) {
          const j = ci[k], dx = x[j] - px, dy = y[j] - py;
          if (dx * dx + dy * dy < s2) {
            ok = false;
            break;
          }
        }
        for (let i = shead[q]; ok && i >= 0; i = snext[i]) {
          const dx = sx[i] - px, dy = sy[i] - py;
          if (dx * dx + dy * dy < s2) ok = false;
        }
      }
    if (!ok) continue;
    const i = S.ns++;
    sx[i] = px;
    sy[i] = py;
    S.sa[i] = 0;
    snext[i] = shead[c];
    shead[c] = i;
  }
}

// Tips downstream of every node: the pipe model, where the squared widths of
// the children add up to the square of the parent's.
function weigh(S) {
  const { par, nch, stack, mass } = S, n = S.n;
  nch.fill(0, 0, n);
  mass.fill(0, 0, n);
  for (let j = 1; j < n; j++) nch[par[j]]++;
  let sp = 0;
  for (let j = 0; j < n; j++)
    if (!nch[j]) {
      mass[j] = 1;
      stack[sp++] = j;
    }
  while (sp > 0) {
    const j = stack[--sp], p = par[j];
    if (p < 0) continue;
    mass[p] += mass[j];
    if (--nch[p] === 0) stack[sp++] = p;
  }
  // A node that has ever carried this many tips is a vein to keep, whatever the spacing asks.
  for (let j = 0; j < n; j++) if (mass[j] >= MAJOR) S.maj[j] = 1;
}

function buildColours(S) {
  const key = S.hue.toFixed(3);
  if (key === S.key) return;
  S.key = key;
  const c = [0, 0, 0], h = S.hue;
  const LAM = [
    [0.0, 0.35, 0.88, 0.5],
    [0.35, 0.3, 0.86, 0.66],
    [0.7, 0.235, 0.8, 0.88],
    [1.0, 0.185, 0.68, 1.0],
  ];
  for (let i = 0; i < 256; i++) {
    const g = i / 255;
    let k = 0;
    while (k < LAM.length - 2 && g > LAM[k + 1][0]) k++;
    const a = LAM[k], b = LAM[k + 1], u = cl((g - a[0]) / (b[0] - a[0]), 0, 1);
    // Dark orange and dark yellow read as brown and olive on a panel, so where the hue falls in that
    // band the lamina is lifted to amber and gold instead.
    const hh = a[1] + (b[1] - a[1]) * u + h, d = hh - floor(hh) - 0.095, zone = abs(d) < 0.14 ? 0.5 + 0.5 * Math.cos((d / 0.14) * Math.PI) : 0;
    const vv = a[3] + (b[3] - a[3]) * u;
    hsv(hh - zone * 0.75 * d, a[2] + (b[2] - a[2]) * u, vv + zone * (0.86 + 0.14 * g - vv), c, 0);
    S.lam.set(c, i * 3);
    const t = i / 255;
    hsv(0.2 - 0.07 * t + h, 0.55 - 0.4 * t, 1, c, 0);
    S.vein.set(c, i * 3);
  }
  hsv(0.13 + h, 0.65, 1, S.bloom, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.gk = cl(k[1], 0.6, 5) / 2;
  S.sc = 2.6 * 1.35 ** -cl(k[2], -1, 1);
  S.u = (cl(k[3], -1, 1) + 1) / 2;
  if (abs(S.gk - S.assumed[0]) > 0.02 || abs(S.sc - S.assumed[1]) > 0.02) {
    if (!S.opened) prerun(S);
  }
  S.opened = true;
  stretch(S, exp(G0 * S.gk * d));
  S.tacc = (S.tacc || 0) + d;
  let guard = 0;
  while (S.tacc >= ITER && guard++ < 3) {
    iterate(S);
    S.tacc -= ITER;
  }
  const a = min(1, d * 4);
  for (let j = 0; j < S.n; j++) S.ms[j] += (S.mass[j] - S.ms[j]) * a;
}

// ---- drawing

let CV, GL, BL, TN;

function seg(x0, y0, x1, y1, wa, wb, ff) {
  const ha = max(0.5, wa * 0.5), hb = max(0.5, wb * 0.5), wm = max(wa, wb);
  const sig = 1.1 + 0.55 * wm, rg = max(ha, hb) + 2.3 * sig;
  const minx = min(x0, x1), maxx = max(x0, x1), miny = min(y0, y1), maxy = max(y0, y1);
  // Glow, vein alpha, tone and bloom follow the width at each end and are blended along the edge.
  const ga = (0.38 + 0.55 * sm(1.2, 4, wa)) * ff, gb = (0.38 + 0.55 * sm(1.2, 4, wb)) * ff;
  const aa = (0.55 + 0.45 * sm(0.95, 2.4, wa)) * ff, ab = (0.55 + 0.45 * sm(0.95, 2.4, wb)) * ff;
  const ta = sm(1.0, 5, wa), tb = sm(1.0, 5, wb);
  const ba = sm(2.0, 4.8, wa) * ff, bb = sm(2.0, 4.8, wb) * ff, sbl = 2.0 + 0.9 * wm, rbm = max(ba, bb) > 0.02 ? 2.2 * sbl : 0;
  const R = max(rg, rbm);
  if (maxx + R < 0 || minx - R > W || maxy + R < 0 || miny - R > H) return;
  const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1e-6;
  const ya = max(0, floor(miny - R)), yb = min(H - 1, ceil(maxy + R));
  const xa = max(0, floor(minx - R)), xb = min(W - 1, ceil(maxx + R));
  const rg2 = rg * rg, rb2 = rbm * rbm, isg = 1 / (sig * sig), isb = 1 / (sbl * sbl);
  for (let yy = ya; yy <= yb; yy++) {
    const py = yy + 0.5;
    for (let xx = xa; xx <= xb; xx++) {
      const px = xx + 0.5;
      let t = ((px - x0) * vx + (py - y0) * vy) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - x0 - t * vx, dy = py - y0 - t * vy, d2 = dx * dx + dy * dy, p = yy * W + xx;
      if (d2 < rg2) {
        const hh = ha + (hb - ha) * t, d = sqrt(d2), e = d > hh ? d - hh : 0, q = e * e * isg;
        if (q < 5.4) {
          const g = (ga + (gb - ga) * t) * EXPT[(q * 96) | 0];
          if (g > GL[p]) GL[p] = g;
        }
        const c = (hh + 0.75 - d) * 0.6667;
        if (c > 0) {
          const cc = (c > 1 ? 1 : c) * (aa + (ab - aa) * t);
          if (cc > CV[p]) {
            CV[p] = cc;
            TN[p] = ta + (tb - ta) * t;
          }
        }
      }
      if (d2 < rb2) {
        const q = d2 * isb;
        if (q < 5.4) {
          const b = (ba + (bb - ba) * t) * EXPT[(q * 96) | 0];
          if (b > BL[p]) BL[p] = b;
        }
      }
    }
  }
}

function raster(S) {
  CV = S.cv;
  GL = S.gl;
  BL = S.bl;
  TN = S.tn;
  CV.fill(0);
  GL.fill(0);
  BL.fill(0);
  TN.fill(0);
  const { x, y, par, ms, rb, bs } = S, n = S.n, sc = S.sc;
  // How much of each minor vein shows. A net asked to be coarser than a vein was born keeps a share
  // of the veins that goes with the ratio of the spacings; a chain of nodes shares one rank.
  const { vis, rk, maj } = S;
  for (let j = 0; j < n; j++) {
    const f = min(1, bs[j] / sc), v = maj[j] || f >= 1 ? 1 : sm(rk[j] - 0.1, rk[j] + 0.1, f);
    vis[j] = v + (1 - v) * sm(3, 6, ms[j]);
  }
  // Width of the vein that ends in each node: the pipe model, tips downstream under a square root,
  // and a little more for the stretch the tissue has had since the node was made.
  const wd = S.wd;
  for (let j = 1; j < n; j++) {
    const rx = x[j] - CX, ry = y[j] - CY, st = min(40, max(1, sqrt(rx * rx + ry * ry) / max(rb[j], 1)));
    wd[j] = min(4.8, (0.8 + 0.19 * sqrt(ms[j] - 1 + 1e-3)) * (1 + 0.07 * Math.log(st)));
  }
  wd[0] = wd[1];
  for (let j = 1; j < n; j++) {
    const p = par[j];
    if (vis[j] > 0.01) seg(x[p], y[p], x[j], y[j], p > 0 ? wd[p] : wd[j], wd[j], vis[j]);
  }
  for (let i = 0; i < S.nl; i++) {
    const a = S.l0[i], b = S.l1[i];
    const v = min(vis[a], vis[b]);
    if (v > 0.01) seg(x[a], y[a], x[b], y[b], 0.8, 0.8, 0.7 * v);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  buildColours(S);
  raster(S);
  const { cv, gl, bl, tn, lam, vein, bloom } = S, u = S.u;
  const lamGain = 0.68 + 0.45 * u, veinGain = 0.78 + 0.22 * u, bloomGain = 0.95 * pow(u, 1.3);
  for (let p = 0, yy = 0; yy < H; yy++) {
    const vy = (yy - 63.5) / 68;
    for (let xx = 0; xx < W; xx++, p++) {
      const vx = (xx - 31.5) / 34, rr = sqrt(vx * vx + vy * vy);
      const shade = 1 - 0.34 * sm(0.5, 1.15, rr);
      const gi = ((pow(cl(gl[p], 0, 1), 1.25) * 255) | 0) * 3;
      const lg = lamGain * shade;
      let r = lam[gi] * lg, g = lam[gi + 1] * lg, b = lam[gi + 2] * lg;
      const bb = bl[p] * bloomGain;
      r += bloom[0] * bb;
      g += bloom[1] * bb;
      b += bloom[2] * bb;
      const c = cv[p];
      if (c > 0) {
        const ti = ((cl(tn[p], 0, 1) * 255) | 0) * 3;
        r += (vein[ti] * veinGain - r) * c;
        g += (vein[ti + 1] * veinGain - g) * c;
        b += (vein[ti + 2] * veinGain - b) * c;
      }
      display.setPixel(xx, yy, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
  }
}
