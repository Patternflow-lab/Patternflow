// ===== Patternflow pattern =====
// Title:   Meander Belt
// Family:  fluvial
// Idea:    A river seen from above wanders down a 64 by 128 LED floodplain, each bend sliding sideways and downstream while the inside of the bend builds a pale point bar of curved scroll ridges behind it, and every 20 to 40 seconds a loop closes on itself, the river cuts through the neck, and the old bend is left as a blue-green oxbow lake that silts up into marsh and field.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: meander migration by an upstream-weighted curvature (Syunsuke Ikeda, Gary Parker and Kenji Sawai, 1981), its simple form (Alan Howard and Thomas Knutson, 1984), a meandering line with cutoffs (Hongbo Sun, Paul Meakin, Torstein Jossang and Karl Schwarz, 1996), pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0..4, Drive=-1..1, Width=-1..1
//
// Knob 1: Hue. Placeholder.
// Knob 2: Flow. Placeholder.
// Knob 3: Drive. Placeholder.
// Knob 4: Width. Placeholder.

const W = 64, H = 128, N = W * H;
const RS = 2, RW = W * RS, RH = H * RS; // the floodplain raster, two cells to an LED
const { floor, sqrt, pow, exp, sin, cos, PI, min, max, abs, atan2, tanh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, u) => a + (b - a) * u;

// ---- the model
const Y0 = -14, Y1 = 142; // the river enters above the panel and leaves below it
const CAP = 1400;
const OMEGA = 1; // local curvature term, which pulls a bend back toward its centre
const GAM0 = 2.5; // upstream-weighted term, which pushes it out and downstream
const E0 = 2.7; // bank erodibility at the 3.5 LED channel
const ALPHA0 = 0.77; // 1 / (length of the upstream memory), times the channel width
const W0 = 3.5;
const WALL = 7.5; // the valley wall: migration toward an edge stops this far from it
const CUTF = 1.1; // a neck narrower than this many channel widths is cut
const T_STAMP = 0.3; // seconds between two stampings of the channel into the raster
const SILT = 170; // seconds an oxbow takes to fill
const PRE = 420; // seconds the river has run before the first frame

const NBR_CELL = 6.5;
const GW = Math.ceil(W / NBR_CELL) + 1, GH = Math.ceil((Y1 - Y0) / NBR_CELL) + 2;

function lattice(cell, w, h) {
  const gw = Math.ceil(w / cell) + 3, gh = Math.ceil(h / cell) + 3, g = new Float64Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = Math.random();
  return (x, y) => {
    const u = x / cell, v = y / cell, iu = floor(u), iv = floor(v), fu = sm(u - iu), fv = sm(v - iv);
    const a = g[iv * gw + iu], b = g[iv * gw + iu + 1], c = g[(iv + 1) * gw + iu], d = g[(iv + 1) * gw + iu + 1];
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
  };
}

function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx > 0 ? d / mx : 0, mx / 255];
}
function rgbOf(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r * 255, g * 255, b * 255];
}

// Colours at hue 0. Every one is turned round the wheel by Hue when it changes.
const COLS = {
  deep: [18, 92, 110], mid: [32, 148, 160], core: [66, 196, 198], glint: [170, 240, 232],
  lakeA: [22, 110, 116], lakeB: [56, 106, 64],
  sand: [232, 212, 160], crest: [206, 176, 110], swale: [112, 130, 62],
  g1: [80, 120, 56], g2: [108, 138, 66], och: [180, 152, 84],
  hill: [58, 84, 46], hill2: [94, 90, 58], rim: [40, 86, 52],
};
const KEYS = Object.keys(COLS);
const IDX = {};
KEYS.forEach((k, i) => (IDX[k] = i * 3));

function makeState() {
  const F = () => new Float64Array(CAP);
  return {
    X: F(), Y: F(), X2: F(), Y2: F(), dx: F(), dy: F(), ln: F(), kap: F(), kap2: F(), U: F(), arc: F(), RX: F(), RY: F(),
    n: 0, t: 0, since: 0, flowT: 0,
    tL: new Float32Array(RW * RH).fill(-1e9),
    head: new Int32Array(GW * GH), nxt: new Int32Array(CAP),
    lakes: [], nCuts: 0,
    er: null, fa: new Float32Array(N), fb: new Float32Array(N), ft: new Float32Array(N), hf: new Float32Array(N),
    pal: new Float32Array(KEYS.length * 3), hueDone: -1,
    rd: new Float32Array(N), ra: new Float32Array(N), rq: new Float32Array(N),
    avgT: new Float32Array(N), cov: new Float32Array(N), lk: new Float32Array(N), lks: new Float32Array(N),
    Wc: 3.5, knobs: [0, 2, 0, 0.06], pre: true, ph: [0, 0, 0],
  };
}

function entryX(S, t) {
  return 32 + 6.5 * sin(0.0207 * t + S.ph[0]) + 3.5 * sin(0.0529 * t + S.ph[1]);
}

// ---- the centreline: nodes from the entry at the top to the exit at the bottom
function resample(S, ds) {
  const { X, Y, X2, Y2, arc } = S;
  const n = S.n;
  arc[0] = 0;
  for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  const L = arc[n - 1], m = max(8, Math.round(L / ds)), step = L / m;
  X2[0] = X[0];
  Y2[0] = Y[0];
  let k = 0;
  for (let j = 1; j < m; j++) {
    const s = j * step;
    while (k < n - 2 && arc[k + 1] < s) k++;
    const u = (s - arc[k]) / max(1e-9, arc[k + 1] - arc[k]);
    const k0 = max(0, k - 1), k2 = min(n - 1, k + 2);
    // Catmull-Rom through the four nodes round the point
    const u2 = u * u, u3 = u2 * u;
    const c0 = -0.5 * u3 + u2 - 0.5 * u, c1 = 1.5 * u3 - 2.5 * u2 + 1, c2 = -1.5 * u3 + 2 * u2 + 0.5 * u, c3 = 0.5 * u3 - 0.5 * u2;
    X2[j] = c0 * X[k0] + c1 * X[k] + c2 * X[k + 1] + c3 * X[k2];
    Y2[j] = c0 * Y[k0] + c1 * Y[k] + c2 * Y[k + 1] + c3 * Y[k2];
  }
  X2[m] = X[n - 1];
  Y2[m] = Y[n - 1];
  S.X.set(X2.subarray(0, m + 1));
  S.Y.set(Y2.subarray(0, m + 1));
  S.n = m + 1;
}

function needsResample(S, ds) {
  const { X, Y, n } = S;
  const lo = 0.55 * ds, hi = 1.45 * ds;
  for (let i = 0; i < n - 1; i++) {
    const l = Math.hypot(X[i + 1] - X[i], Y[i + 1] - Y[i]);
    if (l < lo || l > hi) return true;
  }
  return n + 4 > CAP;
}

function initialLine(S, ds) {
  const { X, Y } = S;
  const ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
  const n0 = Math.round((Y1 - Y0) / ds);
  const x0 = entryX(S, 0);
  for (let i = 0; i <= n0; i++) {
    const y = Y0 + ((Y1 - Y0) * i) / n0, u = i / n0;
    const env = sm(u * 8) * sm((1 - u) * 8);
    X[i] = mix(mix(x0, 33, u), 0, 0) + env * (8 * sin((2 * PI * y) / 46 + ph[0]) + 3.5 * sin((2 * PI * y) / 29 + ph[1]));
    Y[i] = y;
  }
  S.n = n0 + 1;
}

// ---- one step of the migration
function step(S, h, gam, E0w, alpha, ds, W) {
  const { X, Y, X2, Y2, dx, dy, ln, kap, kap2, U } = S;
  const n = S.n;
  for (let i = 0; i < n - 1; i++) {
    dx[i] = X[i + 1] - X[i];
    dy[i] = Y[i + 1] - Y[i];
    ln[i] = sqrt(dx[i] * dx[i] + dy[i] * dy[i]) + 1e-9;
  }
  kap[0] = 0;
  kap[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    const cr = dx[i - 1] * dy[i] - dy[i - 1] * dx[i], dt = dx[i - 1] * dx[i] + dy[i - 1] * dy[i];
    kap[i] = atan2(cr, dt) / (0.5 * (ln[i - 1] + ln[i]));
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < n - 1; i++) kap2[i] = 0.25 * kap[i - 1] + 0.5 * kap[i] + 0.25 * kap[i + 1];
    for (let i = 1; i < n - 1; i++) kap[i] = kap2[i];
  }
  const km = 0.9 / W, k6 = 0.6 * km;
  for (let i = 1; i < n - 1; i++) {
    const a = abs(kap[i]);
    if (a > k6) kap[i] = (kap[i] < 0 ? -1 : 1) * (k6 + (km - k6) * tanh((a - k6) / (km - k6)));
  }
  U[0] = 0;
  for (let i = 1; i < n; i++) {
    const e = exp(-alpha * ln[i - 1]);
    U[i] = U[i - 1] * e + kap[i] * (1 - e);
  }
  const vmax = 0.9 * (W / W0);
  X2[0] = X[0];
  Y2[0] = Y[0];
  X2[n - 1] = X[n - 1];
  Y2[n - 1] = Y[n - 1];
  for (let i = 1; i < n - 1; i++) {
    let tx = dx[i - 1] / ln[i - 1] + dx[i] / ln[i], ty = dy[i - 1] / ln[i - 1] + dy[i] / ln[i];
    const tl = sqrt(tx * tx + ty * ty) + 1e-9;
    tx /= tl;
    ty /= tl;
    const nx = -ty, ny = tx;
    const x = X[i], y = Y[i];
    const er = 1 + 0.4 * (2 * S.er(x, y - Y0 + 8) - 1);
    const damp = sm((y - Y0) / 10) * sm((Y1 - y) / 10);
    let d = E0w * er * (OMEGA * kap[i] - gam * U[i]) * damp;
    d = vmax * tanh(d / vmax);
    let mx = nx * d * h;
    const my = ny * d * h;
    if (mx < 0) mx *= sm((x - WALL) / 5);
    else mx *= sm((W_PANEL - WALL - x) / 5);
    X2[i] = cl(x + mx, WALL - 0.5, W_PANEL - WALL + 0.5);
    Y2[i] = cl(y + my, Y0 - 6, Y1 + 6);
  }
  X.set(X2.subarray(0, n));
  Y.set(Y2.subarray(0, n));
}
const W_PANEL = W;

// ---- the closest approach of two reaches that are not neighbours along the river
function findCut(S, cutD, minGap) {
  const { X, Y, head, nxt } = S;
  const n = S.n;
  head.fill(-1);
  const cellOf = (i) => {
    const cx = cl(floor(X[i] / NBR_CELL), 0, GW - 1), cy = cl(floor((Y[i] - Y0) / NBR_CELL), 0, GH - 1);
    return cy * GW + cx;
  };
  for (let i = 0; i < n; i++) {
    const c = cellOf(i);
    nxt[i] = head[c];
    head[c] = i;
  }
  let bi = -1, bj = -1, bd = cutD * cutD;
  for (let i = 3; i < n - 3; i++) {
    const cx = cl(floor(X[i] / NBR_CELL), 0, GW - 1), cy = cl(floor((Y[i] - Y0) / NBR_CELL), 0, GH - 1);
    for (let gy = max(0, cy - 1); gy <= min(GH - 1, cy + 1); gy++)
      for (let gx = max(0, cx - 1); gx <= min(GW - 1, cx + 1); gx++)
        for (let j = head[gy * GW + gx]; j >= 0; j = nxt[j]) {
          if (j < i + minGap || j > n - 4) continue;
          const ddx = X[i] - X[j], ddy = Y[i] - Y[j], d2 = ddx * ddx + ddy * ddy;
          if (d2 < bd) {
            bd = d2;
            bi = i;
            bj = j;
          }
        }
  }
  return bi < 0 ? null : [bi, bj];
}

function cutOff(S, a, b, W) {
  const { X, Y } = S;
  const m = b - a + 1;
  const lx = new Float32Array(m), ly = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    lx[k] = X[a + k];
    ly[k] = Y[a + k];
  }
  S.lakes.push({ x: lx, y: ly, n: m, t0: S.t, w: W });
  if (S.lakes.length > 14) S.lakes.shift();
  const k = b - a - 1;
  for (let i = b; i < S.n; i++) {
    X[i - k] = X[i];
    Y[i - k] = Y[i];
  }
  S.n -= k;
  S.nCuts++;
}

// ---- the channel stamped into the floodplain raster, with the time it was last under water
function stamp(S, W) {
  const { X, Y, tL } = S;
  const rc = (W * 0.5 + 0.3) * RS, r2 = rc * rc, t = S.t;
  for (let i = 0; i < S.n; i++) {
    const cx = X[i] * RS, cy = Y[i] * RS;
    const x0 = max(0, Math.ceil(cx - rc - 0.5)), x1 = min(RW - 1, floor(cx + rc - 0.5));
    const y0 = max(0, Math.ceil(cy - rc - 0.5)), y1 = min(RH - 1, floor(cy + rc - 0.5));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, dy2 = dy * dy;
      for (let x = x0; x <= x1; x++) {
        const dxx = x + 0.5 - cx;
        if (dxx * dxx + dy2 <= r2) tL[y * RW + x] = t;
      }
    }
  }
  S.since = 0;
}

function par(S) {
  const kn = S.knobs;
  const k3 = cl(kn[2], -1, 1);
  const W = S.Wc;
  return { gam: GAM0 * pow(1.5, k3), alpha: ALPHA0 / W, E: E0 * (W / W0) * (W / W0), ds: 0.34 * W, W };
}

function advance(S, mdt) {
  let rest = mdt;
  while (rest > 1e-9) {
    const p = par(S);
    const hmax = 0.1;
    const h = min(rest, hmax);
    rest -= h;
    step(S, h, p.gam, p.E, p.alpha, p.ds, p.W);
    S.t += h;
    S.since += h;
    S.X[0] = entryX(S, S.t);
    S.Y[0] = Y0;
    if (needsResample(S, p.ds)) resample(S, p.ds);
    const c = findCut(S, CUTF * p.W, max(12, Math.round((3.2 * p.W) / p.ds)));
    if (c) {
      stamp(S, p.W);
      cutOff(S, c[0], c[1], p.W);
      resample(S, p.ds);
    } else if (S.since >= T_STAMP) stamp(S, p.W);
  }
}

export function setup(params) {
  const S = (params.s = makeState());
  S.ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
  S.er = lattice(15, W, Y1 - Y0 + 16);
  const fA = lattice(12, W, H), fB = lattice(5, W, H), fC = lattice(3, W, H), hA = lattice(7, W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, e = min(x + 0.5, W - x - 0.5);
      S.fa[p] = sm((fA(x, y) - 0.5) * 4.2 + 0.5);
      S.fb[p] = fB(x, y);
      S.ft[p] = fC(x, y) - 0.5;
      S.hf[p] = sm(1 - (e - 1) / 7);
    }
  S.pal.fill(0);
  initialLine(S, 0.34 * 3.5);
  S.X[0] = entryX(S, 0);
  S.pre = true;
}

function prerun(S) {
  const p = par(S);
  const total = PRE;
  advance(S, total);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.knobs = kn;
  const wt = 3.5 + 1.5 * cl(kn[3], -1, 1);
  if (S.pre) {
    S.Wc = wt;
    S.pre = false;
    resample(S, 0.34 * wt);
    prerun(S);
  }
  S.Wc += (wt - S.Wc) * (1 - exp(-d / 0.35));
  const f = cl(kn[1], 0, 4) * 0.5;
  S.flowT += d * f;
  advance(S, d * f);
}

// ---- drawing
function buildPal(S, hue) {
  for (let k = 0; k < KEYS.length; k++) {
    const c = COLS[KEYS[k]];
    const [h, s, v] = hsvOf(c[0], c[1], c[2]);
    const o = rgbOf(h + hue, s, v);
    S.pal[k * 3] = o[0];
    S.pal[k * 3 + 1] = o[1];
    S.pal[k * 3 + 2] = o[2];
  }
  S.hueDone = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.knobs, hue = cl(kn[0], 0, 1);
  if (S.hueDone !== hue) buildPal(S, hue);
  const P = S.pal, I = IDX;
  const Wc = S.Wc, t = S.t;
  const TR = 18 * pow(W0 / Wc, 0.68);
  const { tL, avgT, cov, rd, ra, rq, lk, lks, X, Y, arc } = S;

  // 1. the floodplain raster, two cells to an LED, down to one value an LED
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b = y * 2 * RW + x * 2, a = tL[b], c = tL[b + 1], d = tL[b + RW], e = tL[b + RW + 1];
      let v = 0, s = 0;
      if (a > -1e8) { v++; s += a; }
      if (c > -1e8) { v++; s += c; }
      if (d > -1e8) { v++; s += d; }
      if (e > -1e8) { v++; s += e; }
      const p = y * W + x;
      cov[p] = v * 0.25;
      avgT[p] = v ? s / v : -1e9;
    }

  // 2. distance to the channel
  rd.fill(99);
  const n = S.n, r = Wc * 0.5;
  arc[0] = 0;
  for (let i = 1; i < n; i++) arc[i] = arc[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  const reach = r + 2;
  for (let i = 0; i < n - 1; i++) {
    const x0 = X[i], y0 = Y[i], sx = X[i + 1] - x0, sy = Y[i + 1] - y0, l2 = sx * sx + sy * sy + 1e-9, l = sqrt(l2);
    const bx0 = max(0, floor(min(x0, x0 + sx) - reach)), bx1 = min(W - 1, Math.ceil(max(x0, x0 + sx) + reach));
    const by0 = max(0, floor(min(y0, y0 + sy) - reach)), by1 = min(H - 1, Math.ceil(max(y0, y0 + sy) + reach));
    for (let py = by0; py <= by1; py++)
      for (let px = bx0; px <= bx1; px++) {
        const ux = px + 0.5 - x0, uy = py + 0.5 - y0;
        const u = cl((ux * sx + uy * sy) / l2, 0, 1);
        const qx = ux - u * sx, qy = uy - u * sy, dd = sqrt(qx * qx + qy * qy), p = py * W + px;
        if (dd < rd[p]) {
          rd[p] = dd;
          ra[p] = arc[i] + u * l;
          rq[p] = (qx * sy - qy * sx) / l;
        }
      }
  }

  // 3. the lakes
  lk.fill(0);
  for (const L of S.lakes) {
    const age = t - L.t0, s = age / SILT;
    if (s >= 1) continue;
    const tap = sm(age / 25);
    const lm = L.n;
    for (let i = 0; i < lm - 1; i++) {
      const u = (i + 0.5) / (lm - 1), prof = pow(sin(PI * u), 0.5);
      const rr = (L.w * 0.5) * (1 - pow(s, 1.3)) * (1 - tap * (1 - prof));
      if (rr < 0.8) continue;
      const al = sm((rr - 0.8) / 0.6);
      const x0 = L.x[i], y0 = L.y[i], sx = L.x[i + 1] - x0, sy = L.y[i + 1] - y0, l2 = sx * sx + sy * sy + 1e-9;
      const rch = rr + 1;
      const bx0 = max(0, floor(min(x0, x0 + sx) - rch)), bx1 = min(W - 1, Math.ceil(max(x0, x0 + sx) + rch));
      const by0 = max(0, floor(min(y0, y0 + sy) - rch)), by1 = min(H - 1, Math.ceil(max(y0, y0 + sy) + rch));
      for (let py = by0; py <= by1; py++)
        for (let px = bx0; px <= bx1; px++) {
          const ux = px + 0.5 - x0, uy = py + 0.5 - y0;
          const uu = cl((ux * sx + uy * sy) / l2, 0, 1);
          const qx = ux - uu * sx, qy = uy - uu * sy, dd = sqrt(qx * qx + qy * qy);
          const c = cl(rr + 0.5 - dd, 0, 1) * al;
          const p = py * W + px;
          if (c > lk[p]) {
            // hidden where the channel has been since the cut
            const b = py * 2 * RW + px * 2;
            const lim = L.t0 + 0.4;
            const vis = ((tL[b] <= lim ? 1 : 0) + (tL[b + 1] <= lim ? 1 : 0) + (tL[b + RW] <= lim ? 1 : 0) + (tL[b + RW + 1] <= lim ? 1 : 0)) * 0.25;
            const cc = c * vis;
            if (cc > lk[p]) {
              lk[p] = cc;
              lks[p] = s;
            }
          }
        }
    }
  }

  // 4. colour
  const TWO_PI = 2 * PI;
  const ft = S.flowT;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // field and valley wall
      const fa = S.fa[p], fb = S.fb[p], tx = S.ft[p] * 0.1;
      let fr = mix(mix(P[I.g1], P[I.g2], fb), P[I.och], fa * 0.85);
      let fg = mix(mix(P[I.g1 + 1], P[I.g2 + 1], fb), P[I.och + 1], fa * 0.85);
      let fbl = mix(mix(P[I.g1 + 2], P[I.g2 + 2], fb), P[I.och + 2], fa * 0.85);
      const hf = S.hf[p];
      if (hf > 0) {
        const hm = fb;
        fr = mix(fr, mix(P[I.hill], P[I.hill2], hm), hf * 0.9);
        fg = mix(fg, mix(P[I.hill + 1], P[I.hill2 + 1], hm), hf * 0.9);
        fbl = mix(fbl, mix(P[I.hill + 2], P[I.hill2 + 2], hm), hf * 0.9);
      }
      fr *= 1 + tx;
      fg *= 1 + tx;
      fbl *= 1 + tx;
      let R = fr, G = fg, B = fbl;
      // bars: scroll ridges are the isochrones of the last time under water
      const m = cov[p];
      if (m > 0) {
        const T = avgT[p], age = t - T;
        // spacing of the ridges from the gradient of T
        const pl = x > 0 && cov[p - 1] > 0 ? avgT[p - 1] : T, pr = x < W - 1 && cov[p + 1] > 0 ? avgT[p + 1] : T;
        const pu = y > 0 && cov[p - W] > 0 ? avgT[p - W] : T, pd = y < H - 1 && cov[p + W] > 0 ? avgT[p + W] : T;
        const gx = (pr - pl) * 0.5, gy = (pd - pu) * 0.5, g = sqrt(gx * gx + gy * gy);
        const sp = TR / max(g, 1e-3);
        const amp = sm((sp - 1.8) / 1.4) * (1 - sm((sp - 6) / 4));
        const rv = cos((TWO_PI * T) / TR) * amp;
        const veg = sm(age / 28), old = sm(age / 260);
        const cr = mix(P[I.sand], P[I.crest], veg), cg = mix(P[I.sand + 1], P[I.crest + 1], veg), cb = mix(P[I.sand + 2], P[I.crest + 2], veg);
        const sr = mix(P[I.sand] * 0.92, P[I.swale], veg), sg = mix(P[I.sand + 1] * 0.92, P[I.swale + 1], veg), sb = mix(P[I.sand + 2] * 0.92, P[I.swale + 2], veg);
        const u = 0.5 + 0.5 * rv;
        let br = mix(sr, cr, u), bg = mix(sg, cg, u), bb = mix(sb, cb, u);
        // fade into the field, a faint ridge staying behind
        const rr = 1 + 0.045 * rv;
        br = mix(br, fr * rr, old);
        bg = mix(bg, fg * rr, old);
        bb = mix(bb, fbl * rr, old);
        R = mix(R, br, m);
        G = mix(G, bg, m);
        B = mix(B, bb, m);
      }
      // the bank beside the water
      const dd = rd[p];
      if (dd < r + 1.6) {
        const rim = sm((r + 1.6 - dd) / 1.4) * 0.35;
        R = mix(R, P[I.rim], rim);
        G = mix(G, P[I.rim + 1], rim);
        B = mix(B, P[I.rim + 2], rim);
      }
      // oxbow water
      const lc = lk[p];
      if (lc > 0) {
        const s = lks[p], k = sm(s / 0.8);
        const lr = mix(P[I.lakeA], P[I.lakeB], k), lg = mix(P[I.lakeA + 1], P[I.lakeB + 1], k), lb = mix(P[I.lakeA + 2], P[I.lakeB + 2], k);
        R = mix(R, lr, lc);
        G = mix(G, lg, lc);
        B = mix(B, lb, lc);
      }
      // the river
      const wc = cl(r + 0.5 - dd, 0, 1);
      if (wc > 0) {
        const q = cl(abs(rq[p]) / r, 0, 1), c = 1 - q * q;
        const st = 0.5 + 0.5 * sin(TWO_PI * (ra[p] / 10.5 - ft * 0.5) + 1.6 * rq[p] / r);
        let wr = mix(P[I.deep], P[I.core], c), wg = mix(P[I.deep + 1], P[I.core + 1], c), wb = mix(P[I.deep + 2], P[I.core + 2], c);
        const gl = st * 0.35 * (0.4 + 0.6 * c);
        wr = mix(wr, P[I.glint], gl);
        wg = mix(wg, P[I.glint + 1], gl);
        wb = mix(wb, P[I.glint + 2], gl);
        R = mix(R, wr, wc);
        G = mix(G, wg, wc);
        B = mix(B, wb, wc);
      }
      display.setPixel(x, y, R, G, B);
    }
  }
}
