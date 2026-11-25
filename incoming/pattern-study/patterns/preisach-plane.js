// ===== Patternflow pattern =====
// Title:   Preisach Plane
// Family:  preisach
// Idea:    A triangle of magnetic hysterons is drawn as a plane, warm where they point up and cool where they point down with a ridge of density glowing through, under a bright staircase edge whose corners are the past reversals of a random walk and whose moving corner chases the input, while below it the magnetisation traces its hysteresis loop in a fading trail, so minor loops close where they began and a big swing wipes the corners out.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Preisach model of hysteresis (Ferenc Preisach, 1935) in the staircase and return-point-memory form of Isaak Mayergoyz (1986, from memory), driven by a random walk of reversal points that shrinks like an AC demagnetisation and now and then swings wide, pattern round 239
// Round:   239
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drive=0.2..3, Spread=-1..1, Memory=-1..1
//
// Knob 1: Hue. Turns the plane, the staircase and the loop round the wheel. At 0 the up region is rose and gold, the down region azure and aqua, the staircase aqua to cream. The ground behind only sways about indigo and violet, so it never goes brown.
// Knob 2: Drive. 0.2 to 3, opening at 2. How fast the input sweeps, and how fast the clouds behind drift. At 2 a swing from one end to the other takes 2 s and a small step 0.35 s; at 0.2 the same swing takes 20 s and the corner crawls; at 3 it takes 1.3 s and the minor loops come in a flurry.
// Knob 3: Spread. -1 to 1, opening at 0. The width of the coercivity distribution. At -1 the lit ridge is a thin band near the base and the two branches of the major loop stand 9 rows apart at the middle; at 0 they are 22 apart; at 1 the ridge fills the plane and they are 38 apart, a fat lens.
// Knob 4: Memory. -1 to 1, opening near 0. How many nested loops the input leaves before a big swing starts over. Each stroke is 0.62 of the one before at -1, so a run has about five teeth; 0.75 at the opening, about nine; 0.86 at 1, eighteen or more, with tiny loops piled up inside the big one.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, min, max, abs, exp, log, pow, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.16, 0.3, c);
  hsv(h, s * (1 - 0.5 * b), min(1, v + b * (v * 1.1 * (1 - v) + 0.9 * max(0, 0.42 - v))), out, o);
}

// ---- the geometry ---------------------------------------------------------
// The plane is drawn in (h, c): h = (alpha + beta) / 2 runs along the base and is the input's own axis,
// c = (alpha - beta) / 2 is the coercivity and runs up. The triangle alpha >= beta stands on its base
// with the apex at the top, and every segment of the staircase runs at 60 degrees. Below it the loop
// has the input u on the same columns and the magnetisation M up the rows.
const CX = 32, SX = 30.5;      // column of h = 0, columns to one unit
const PY0 = 62, PHC = 58.5;    // row of the base, rows to c = 1
const LY0 = 97, LH = 27.5;     // row of M = 0, rows to one unit of M
const NPR = 64;                // rows the plane owns
const SIDE = sqrt(SX * SX + PHC * PHC);

// ---- the model ------------------------------------------------------------
// A grid of N by N hysterons in (alpha, beta). T holds the density, Rc its running sum along each row,
// so the magnetisation of any staircase is a sum of N row pieces.
const N = 72, DN = 2 / N;
const NMB = 16;  // minor ridges that come and go in the density
const NAMB = 28; // large soft clouds behind everything
const NSM = 18;  // smaller, quicker ones
const LS = 3.1;  // the trail fades by e in this many strokes
const NTR = 1400;

function seedMinor(b, first) {
  const c = 0.1 + 0.7 * Math.random();
  b.c = c;
  b.h = (Math.random() * 2 - 1) * (1 - c) * 0.9;
  b.sh = 0.25 + 0.25 * Math.random();
  b.sc = 0.14 + 0.14 * Math.random();
  b.w = 0.035 + 0.06 * Math.random();
  b.life = 9 + 26 * Math.random();
  b.age = first ? Math.random() * b.life : 0;
  return b;
}
function seedAmb(b, first, small) {
  b.x = Math.random() * W;
  b.y = Math.random() * H;
  b.small = !!small;
  b.sx = small ? 3.5 + 4 * Math.random() : 6 + 9 * Math.random();
  b.sy = small ? 4.5 + 6 * Math.random() : 8 + 15 * Math.random();
  b.hu = (Math.random() - 0.5) * 0.28;
  b.amp = 0.45 + 0.55 * Math.random();
  b.vx = 1.4 * gauss();
  b.vy = 1.4 * gauss();
  b.life = small ? 5 + 11 * Math.random() : 7 + 19 * Math.random();
  b.age = first ? Math.random() * b.life : 0;
  return b;
}

export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], init: false, t: 0,
    // the input
    u: -1, dir: 1, from: -1, to: 1, D: 2, p: 0, ext: [], rev: 0, M: -1, runC: 0, runA: 1, runN: 0,
    tr: [], fl: [],
    mb: Array.from({ length: NMB }, () => seedMinor({}, true)),
    amb: Array.from({ length: NAMB + NSM }, (_, i) => seedAmb({}, true, i >= NAMB)),
    // the density and its sums
    T: new Float64Array(N * N), Rc: new Float64Array(N * (N + 1)), tot: 1,
    list: [], gh: new Float64Array(2 * N), gc: new Float64Array(N),
    field: new Float32Array(NPR * W), fgx: new Float64Array(W), fgy: new Float64Array(NPR),
    // the staircase as strips of beta, and as corners
    sLo: new Float64Array(64), sHi: new Float64Array(64), sA: new Float64Array(64), ns: 0,
    vx: new Float64Array(64), vy: new Float64Array(64), nv: 0,
    // the edges of the major loop, one value of M a column
    Ma: new Float64Array(W), Md: new Float64Array(W),
    P: new Float32Array(NPX * 3), Q: new Float32Array(NPX * 3),
    hue: -9, upL: new Float32Array(64 * 3), dnL: new Float32Array(64 * 3), lnL: new Float32Array(32 * 3),
    gx: new Float64Array(W), gy: new Float64Array(H),
  };
}

// ---- the density ----------------------------------------------------------
// A sum of ridges, each the product of a Gaussian in h and one in c. On the (alpha, beta) grid the
// cell (i, j) has h = -1 + (i + j + 1) DN / 2 and c = (i - j) DN / 2, so each ridge is two short tables.
function rebuild(st) {
  const f = pow(3.2, st.k[2]), list = st.list;
  list.length = 0;
  // the main ridge, a soft phase close to the base and a hard phase high in the plane
  list.push([0, 0.17 * f, 0.55, 0.03 + 0.04 * f, 1]);
  list.push([0.1, min(0.9, 0.4 * pow(f, 0.9)), 0.3, 0.03 + 0.05 * f, 0.2]);
  list.push([-0.12, 0.03 * f, 0.5, 0.03 + 0.02 * f, 0.2]);
  for (const b of st.mb) {
    const e = sin((PI * b.age) / b.life);
    const fw = pow(f, 0.9), w = b.w * e * e * fw;
    if (w > 0.0015) list.push([b.h, b.c, b.sh * (0.6 + 0.4 * f), b.sc * (0.6 + 0.4 * f), w, 2.8 / fw]);
  }
  const { T, Rc, gh, gc } = st;
  T.fill(0);
  for (const [h0, c0, sh, sc, w] of list) {
    for (let s = 0; s < 2 * N - 1; s++) {
      const z = (-1 + ((s + 1) * DN) / 2 - h0) / sh;
      gh[s] = w * exp(-0.5 * z * z);
    }
    for (let q = 0; q < N; q++) {
      const z = ((q * DN) / 2 - c0) / sc;
      gc[q] = exp(-0.5 * z * z);
    }
    for (let j = 0; j < N; j++) {
      const row = j * N;
      for (let i = j; i < N; i++) T[row + i] += gh[i + j] * gc[i - j];
    }
  }
  let tot = 0;
  for (let j = 0; j < N; j++) {
    T[j * N + j] *= 0.5;
    const b = j * (N + 1);
    Rc[b] = 0;
    for (let i = 0; i < N; i++) Rc[b + i + 1] = Rc[b + i] + T[j * N + i];
    tot += Rc[b + N];
  }
  st.tot = tot || 1;
  // the same ridges on the pixels of the plane, for the tint
  const fld = st.field, fx = st.fgx, fy = st.fgy;
  fld.fill(0);
  for (const [h0, c0, sh, sc, w0, tint] of list) {
    const w = w0 * (tint || 1);
    for (let x = 0; x < W; x++) {
      const z = ((x + 0.5 - CX) / SX - h0) / sh;
      fx[x] = w * exp(-0.5 * z * z);
    }
    for (let y = 0; y < NPR; y++) {
      const z = ((PY0 - (y + 0.5)) / PHC - c0) / sc;
      fy[y] = exp(-0.5 * z * z);
    }
    for (let y = 0; y < NPR; y++) {
      const g = fy[y];
      if (g < 0.003) continue;
      const row = y * W;
      for (let x = 0; x < W; x++) fld[row + x] += g * fx[x];
    }
  }
}

// The magnetisation of a staircase: the density summed over the up region, 2 * part - 1.
// Strip k covers beta from lo to hi and its hysterons are up where alpha <= a (a < -1.5 means none).
function integrate(st, sLo, sHi, sA, ns) {
  const { T, Rc } = st;
  let num = 0;
  for (let k = 0; k < ns; k++) {
    const a = sA[k], lo = sLo[k], hi = sHi[k];
    if (a < -1.5 || hi <= lo) continue;
    const xm = cl((a + 1) / DN, 0, N), ii = min(N, floor(xm)), fr = xm - ii;
    const jl = max(0, floor((lo + 1) / DN)), jh = min(N - 1, floor((hi + 1) / DN - 1e-9));
    for (let j = jl; j <= jh; j++) {
      const r0 = -1 + j * DN, r1 = r0 + DN;
      const ov = (min(hi, r1) - max(lo, r0)) / DN;
      if (ov <= 0) continue;
      const b = j * (N + 1);
      num += ov * (Rc[b + ii] + (ii < N ? fr * T[j * N + ii] : 0));
    }
  }
  return (2 * num) / st.tot - 1;
}

// ---- the staircase --------------------------------------------------------
// ext is the stack of reversal points, a maximum first, alternating. A rising input has an even number
// of them and a falling one an odd number.
function build(st) {
  const e = st.ext, n = e.length, u = st.u, rising = st.dir > 0;
  const { sLo, sHi, sA, vx, vy } = st;
  let ns = 0, nv = 0;
  const put = (a, b) => {
    vx[nv] = CX + (SX * (a + b)) / 2;
    vy[nv] = PY0 - (PHC * (a - b)) / 2;
    nv++;
  };
  if (rising) {
    for (let m = 0; m < n / 2; m++) {
      sLo[ns] = m === 0 ? -1 : e[2 * m - 1];
      sHi[ns] = e[2 * m + 1];
      sA[ns++] = e[2 * m];
    }
    sLo[ns] = n > 0 ? e[n - 1] : -1;
    sHi[ns] = 1;
    sA[ns++] = u;
  } else {
    const p = (n - 1) / 2;
    for (let m = 0; m < p; m++) {
      sLo[ns] = m === 0 ? -1 : e[2 * m - 1];
      sHi[ns] = e[2 * m + 1];
      sA[ns++] = e[2 * m];
    }
    sLo[ns] = p === 0 ? -1 : e[2 * p - 1];
    sHi[ns] = u;
    sA[ns++] = e[2 * p];
    sLo[ns] = u;
    sHi[ns] = 1;
    sA[ns++] = -2;
  }
  st.ns = ns;
  // the corners
  if (n === 0) {
    put(u, -1);
  } else {
    let a = e[0], b = -1;
    put(a, b);
    for (let k = 1; k < n; k++) {
      if (k & 1) b = e[k];
      else a = e[k];
      put(a, b);
    }
    if (rising) put(u, b);
    else put(a, u);
  }
  put(u, u);
  st.nv = nv;
}

function flash(st, a, b) {
  if (st.fl.length < 10) st.fl.push({ x: CX + (SX * (a + b)) / 2, y: PY0 - (PHC * (a - b)) / 2, age: 0 });
}

function moveTo(st, u) {
  st.u = u;
  const e = st.ext;
  // Return-point memory: once the input passes an earlier extreme the two newest corners are wiped out.
  if (st.dir > 0) {
    while (e.length >= 2 && u >= e[e.length - 2]) {
      const n = e.length, a = e[n - 2];
      flash(st, a, n >= 3 ? e[n - 3] : -1);
      flash(st, a, e[n - 1]);
      e.length = n - 2;
    }
  } else {
    while (e.length >= 3 && u <= e[e.length - 2]) {
      const n = e.length, b = e[n - 2];
      flash(st, e[n - 3], b);
      flash(st, e[n - 1], b);
      e.length = n - 2;
    }
  }
  build(st);
  st.M = integrate(st, st.sLo, st.sHi, st.sA, st.ns);
  const x = CX + SX * u, y = LY0 - LH * st.M, tr = st.tr, last = tr[tr.length - 1];
  if (!last || (x - last.x) * (x - last.x) + (y - last.y) * (y - last.y) > 0.5) {
    tr.push({ x, y, s: st.rev + st.p, d: st.dir });
    if (tr.length > NTR) tr.shift();
  }
  while (tr.length > 2 && st.rev + st.p - tr[0].s > 11) tr.shift();
}

function reverse(st) {
  st.u = st.to;
  st.ext.push(st.to);
  if (st.ext.length > 48) st.ext.splice(0, 2);
  st.rev++;
  st.runN++;
  st.dir = -st.dir;
  // A run swings about a centre with a half-amplitude that shrinks by a ratio each stroke, like an AC
  // demagnetisation, so the new extremes nest inside the old ones. Now and then a stroke grows instead and
  // passes earlier extremes, and when the swing has shrunk away a new run starts with a new centre.
  const r = 0.74 + 0.12 * st.k[3];
  let rho = exp(log(r) + 0.2 * gauss());
  const cap = 1 - abs(st.runC);
  if (st.ext.length >= 4 && Math.random() < 0.08 && st.runA * 1.3 < cap) rho = min(1.3 + 0.6 * Math.random(), cap / st.runA);
  let A = st.runA * rho;
  if (A < 0.06) {
    st.runN = 0;
    if (Math.random() < 0.14) {
      st.runC = 0.12 * gauss();
      A = 1 - abs(st.runC);
    } else {
      st.runC = cl(st.runC * 0.5 + 0.8 * (Math.random() - 0.5), -0.55, 0.55);
      A = 0.4 + 0.55 * Math.random();
    }
  }
  A = min(A, 1 - abs(st.runC));
  st.runA = A;
  let to = cl(st.runC + st.dir * A * (1 + 0.07 * (2 * Math.random() - 1)), -1, 1);
  if (st.dir * (to - st.u) < 0.2) to = cl(st.u + st.dir * (0.25 + 0.4 * Math.random()), -1, 1);
  st.from = st.u;
  st.to = to;
  st.D = max(0.05, abs(to - st.u));
  st.p = 0;
}

function advance(st, d) {
  const k2 = st.k[1];
  while (d > 1e-9) {
    const h = min(d, 0.02);
    d -= h;
    st.p = min(1, st.p + (h * 0.55 * k2) / (0.28 + 0.95 * st.D));
    moveTo(st, st.from + (st.to - st.from) * (1 - cos(PI * st.p)) * 0.5);
    if (st.p >= 1) reverse(st);
  }
}

function colours(st, h1) {
  const c = [0, 0, 0], put = (arr, i) => {
    arr[i * 3] = c[0];
    arr[i * 3 + 1] = c[1];
    arr[i * 3 + 2] = c[2];
  };
  for (let i = 0; i < 64; i++) {
    const m = i / 63;
    // up: magenta rose at the foot of the ridge, coral along it, gold on the crest
    dim(h1 + 0.93 + 0.14 * m, 0.82 - 0.2 * m, 0.3 + 0.5 * pow(m, 0.9), c, 0);
    put(st.upL, i);
    // down: indigo at the foot, azure along the ridge, aqua on the crest
    dim(h1 + 0.67 - 0.17 * m, 0.9 - 0.2 * m, 0.15 + 0.5 * pow(m, 0.9), c, 0);
    put(st.dnL, i);
  }
  // the staircase, aqua at the oldest corner to cream at the newest
  for (let i = 0; i < 32; i++) {
    dim(h1 + 0.55 + 0.5 * (i / 31), 0.14 - 0.1 * (i / 31), 1, c, 0);
    put(st.lnL, i);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [cl(kv[0], 0, 1), cl(kv[1], 0.2, 3), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    // Run the input before the first frame so the panel opens with a staircase and a trail on it.
    rebuild(st);
    build(st);
    let guard = 0;
    while ((st.rev < 12 || st.runN !== 2) && guard++ < 8000) {
      advance(st, 0.05);
      if (guard % 4 === 0) rebuild(st);
    }
    st.fl.length = 0;
  }
  dt = cl(dt || 0, 0, 0.1);
  st.t += dt;
  // The clouds and the ridges of the density live a little faster when the drive is up.
  const wd = dt * (0.35 + 0.325 * st.k[1]);
  for (const b of st.mb) {
    b.age += wd;
    if (b.age >= b.life) seedMinor(b, false);
  }
  for (const b of st.amb) {
    b.age += wd;
    b.x += b.vx * wd;
    b.y += b.vy * wd;
    if (b.age >= b.life) seedAmb(b, false, b.small);
  }
  for (const f of st.fl) f.age += dt;
  while (st.fl.length && st.fl[0].age > 0.8) st.fl.shift();
  rebuild(st);
  advance(st, dt);
  // the edges of the major loop
  const lo = [-1], hi = [1], a = [0];
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - CX) / SX;
    hi[0] = 1;
    a[0] = u;
    st.Ma[x] = integrate(st, lo, hi, a, 1);
    hi[0] = u;
    a[0] = 1;
    st.Md[x] = integrate(st, lo, hi, a, 1);
  }
}

// ---- drawing --------------------------------------------------------------
// P is the picture, three floats a pixel from 0 to 1.
function screen(P, o, c, a) {
  for (let q = 0; q < 3; q++) P[o * 3 + q] = 1 - (1 - P[o * 3 + q]) * (1 - c[q] * a);
}
// A soft disc, full to rc and gone at rs.
function stamp(P, x, y, rc, rs, col, a) {
  const x0 = max(0, floor(x - rs)), x1 = min(W - 1, ceil(x + rs));
  const y0 = max(0, floor(y - rs)), y1 = min(H - 1, ceil(y + rs));
  for (let py = y0; py <= y1; py++)
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, dy = py + 0.5 - y;
      const c = 1 - sstep(rc, rs, sqrt(dx * dx + dy * dy));
      if (c > 0) screen(P, py * W + px, col, c * a);
    }
}

function drawAmbient(st) {
  const { P, gx, gy, amb } = st, h1 = 0.08 * sin(TAU * st.k[0]), c = [0, 0, 0];
  // the ground: a deep indigo that slides to violet down the panel
  for (let y = 0; y < H; y++) {
    hsv(h1 + 0.7 + 0.06 * (y / H), 0.8, 0.1 + 0.03 * sin(y * 0.09 + st.t * 0.21), c, 0);
    for (let x = 0; x < W; x++) for (let q = 0; q < 3; q++) P[(y * W + x) * 3 + q] = c[q];
  }
  for (const b of amb) {
    const e = sin((PI * b.age) / b.life), k = e * e * b.amp;
    if (k < 0.01) continue;
    hsv(h1 + 0.74 + b.hu, 0.66, (b.small ? 0.3 : 0.33) * k, c, 0);
    const x0 = max(0, floor(b.x - 2.6 * b.sx)), x1 = min(W - 1, ceil(b.x + 2.6 * b.sx));
    const y0 = max(0, floor(b.y - 2.6 * b.sy)), y1 = min(H - 1, ceil(b.y + 2.6 * b.sy));
    for (let x = x0; x <= x1; x++) gx[x] = exp(-0.5 * ((x + 0.5 - b.x) / b.sx) ** 2);
    for (let y = y0; y <= y1; y++) gy[y] = exp(-0.5 * ((y + 0.5 - b.y) / b.sy) ** 2);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) for (let q = 0; q < 3; q++) P[(y * W + x) * 3 + q] += c[q] * gx[x] * gy[y];
  }
}

// The two edges of the major loop, a band of violet between them, rose below and azure above.
function drawLoopBand(st) {
  const { P, Ma, Md } = st, h1 = st.k[0];
  const fill = [0, 0, 0], lo = [0, 0, 0], up = [0, 0, 0];
  hsv(0.77 + 0.08 * sin(TAU * h1), 0.4, 0.42, fill, 0);
  hsv(h1 + 0.97, 0.55, 1, lo, 0);
  hsv(h1 + 0.57, 0.6, 1, up, 0);
  for (let y = 63; y < H; y++) {
    const M = (LY0 - (y + 0.5)) / LH;
    for (let x = 0; x < W; x++) {
      const a = Ma[x], d = Md[x];
      if (M < a - 0.2 || M > d + 0.2) continue;
      const sl = (Ma[min(W - 1, x + 1)] - Ma[max(0, x - 1)]) * 0.5 * LH, sd = (Md[min(W - 1, x + 1)] - Md[max(0, x - 1)]) * 0.5 * LH;
      const da = ((M - a) * LH) / sqrt(1 + sl * sl), dd = ((d - M) * LH) / sqrt(1 + sd * sd);
      const o = y * W + x, cov = sstep(-1.4, 1.4, min(da, dd));
      if (cov > 0) {
        const t = cl((M - a) / max(1e-4, d - a), 0, 1), k = cov * (0.6 + 0.3 * (1 - 4 * t * (1 - t)));
        for (let q = 0; q < 3; q++) P[o * 3 + q] += (fill[q] - P[o * 3 + q]) * k;
      }
      screen(P, o, lo, (1 - sstep(0.9, 2.1, abs(da))) * 0.62);
      screen(P, o, up, (1 - sstep(0.9, 2.1, abs(dd))) * 0.62);
    }
  }
}

function drawPlane(st) {
  const { P, field, vx, vy, nv, ns, sHi, sA, upL, dnL, lnL } = st;
  const nseg = nv - 1, rim = [0, 0, 0];
  hsv(st.k[0] + 0.58, 0.45, 0.8, rim, 0);
  for (let y = 0; y < NPR; y++) {
    const Yp = y + 0.5, c = (PY0 - Yp) / PHC;
    for (let x = 0; x < W; x++) {
      const Xp = x + 0.5, h = (Xp - CX) / SX;
      // LEDs inside the triangle, from its nearest side
      const dl = ((Xp - (CX - SX)) * PHC + (Yp - PY0) * SX) / SIDE, dr = ((CX + SX - Xp) * PHC + (Yp - PY0) * SX) / SIDE;
      const dIn = min(dl, dr, PY0 - Yp);
      if (dIn < -0.8) continue;
      // which side of the staircase
      const al = h + c, be = h - c;
      let up = false;
      for (let k = 0; k < ns; k++)
        if (be < sHi[k] || k === ns - 1) {
          up = sA[k] >= al;
          break;
        }
      // the nearest piece of the staircase
      let dm = 1e9, si = 0;
      for (let s = 0; s < nseg; s++) {
        const ax = vx[s], ay = vy[s], dx = vx[s + 1] - ax, dy = vy[s + 1] - ay;
        const q = cl(((Xp - ax) * dx + (Yp - ay) * dy) / (dx * dx + dy * dy || 1e-6), 0, 1);
        const ex = Xp - ax - q * dx, ey = Yp - ay - q * dy, d2 = ex * ex + ey * ey;
        if (d2 < dm) (dm = d2), (si = s);
      }
      const d = sqrt(dm), mi = floor(pow(cl((field[y * W + x] - 0.03) / 1.05, 0, 1), 1.2) * 63) * 3;
      const bu = up ? sstep(-1.1, 1.1, d) : 1 - sstep(-1.1, 1.1, d);
      // the staircase edge, 2 LEDs solid and soft round it, a little brighter on the two newest pieces
      const li = floor(cl((si + 0.5) / max(1, nseg), 0, 1) * 31) * 3, near = si >= nseg - 2 ? 1 : 0.92;
      const ln = 1 - sstep(1.2, 2.3, d), ke = near * ln, kg = near * 0.3 * exp(-(d * d) / 18) * (1 - ln);
      const rm = (1 - sstep(0.5, 2.4, dIn)) * 0.5, a = sstep(-0.8, 0.8, dIn) * 0.92, o = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) {
        let f = dnL[mi + q] + (upL[mi + q] - dnL[mi + q]) * bu;
        f = f * (1 - ke) + lnL[li + q] * (ke + kg);
        f += (rim[q] - f) * rm;
        P[o + q] += (min(1, f) - P[o + q]) * a;
      }
    }
  }
}

// The trail keeps the brightest of its own pieces, so a crossing does not double, and goes over the picture.
function drawTrail(st) {
  const { P, Q, tr } = st, h1 = st.k[0];
  Q.fill(0);
  const warm = [0, 0, 0], cool = [0, 0, 0], cream = [0, 0, 0], col = [0, 0, 0];
  hsv(h1 + 0.99, 0.5, 1, warm, 0);
  hsv(h1 + 0.55, 0.55, 1, cool, 0);
  hsv(h1 + 0.1, 0.18, 1, cream, 0);
  const sNow = st.rev + st.p, hx = CX + SX * st.u, hy = LY0 - LH * st.M, n = tr.length;
  for (let i = 0; i < n; i++) {
    const a = tr[i], b = i + 1 < n ? tr[i + 1] : { x: hx, y: hy, s: sNow, d: st.dir };
    const age = sNow - 0.5 * (a.s + b.s), w = exp(-age / LS);
    if (w < 0.03) continue;
    const hot = exp(-age / 0.5) * 0.85, base = b.d > 0 ? warm : cool;
    for (let q = 0; q < 3; q++) col[q] = base[q] + (cream[q] - base[q]) * hot;
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1e-6;
    const x0 = max(0, floor(min(a.x, b.x) - 5.5)), x1 = min(W - 1, ceil(max(a.x, b.x) + 5.5));
    const y0 = max(0, floor(min(a.y, b.y) - 5.5)), y1 = min(H - 1, ceil(max(a.y, b.y) + 5.5));
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5 - a.x, cy = py + 0.5 - a.y;
        const q = cl((cx * dx + cy * dy) / l2, 0, 1), ex = cx - q * dx, ey = cy - q * dy, d2 = ex * ex + ey * ey;
        if (d2 > 30) continue;
        const d = sqrt(d2), r = 1 - d2 / 30, v = (1 - sstep(1.1, 2.2, d) + 0.34 * r * r) * w, o = (py * W + px) * 3;
        for (let k = 0; k < 3; k++) if (col[k] * v > Q[o + k]) Q[o + k] = col[k] * v;
      }
  }
  for (let o = 0; o < NPX * 3; o++) P[o] = 1 - (1 - P[o]) * (1 - min(1, Q[o]));
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const h1 = st.k[0];
  if (abs(h1 - st.hue) > 1e-4) (st.hue = h1), colours(st, h1);
  const P = st.P;
  drawAmbient(st);
  drawLoopBand(st);
  drawPlane(st);
  // a plumb line from the corner on the base down to the head of the trail
  const col = [0, 0, 0], hx = CX + SX * st.u, hy = LY0 - LH * st.M;
  hsv(h1 + 0.1, 0.2, 1, col, 0);
  for (let y = PY0 - 1; y <= hy; y++)
    for (let x = max(0, floor(hx - 4)); x <= min(W - 1, ceil(hx + 4)); x++) screen(P, y * W + x, col, 0.14 * exp(-((x + 0.5 - hx) ** 2) / 3));
  drawTrail(st);
  // the corners, the moving corner and the tip on the base, the head of the trail
  const { vx, vy, nv } = st;
  hsv(h1 + 0.08, 0.2, 1, col, 0);
  for (let i = 1; i < nv - 2; i++) stamp(P, vx[i], vy[i], 0.8, 2.2, col, 0.8);
  stamp(P, vx[nv - 2], vy[nv - 2], 1.3, 3.2, col, 1);
  stamp(P, vx[nv - 1], vy[nv - 1], 1.6, 4.2, col, 1);
  stamp(P, hx, hy, 1.8, 4.4, col, 1);
  for (const f of st.fl) stamp(P, f.x, f.y, 0.8, 2.2, col, 0.8 * (1 - f.age / 0.8));
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, floor(min(255, P[o] * 255)), floor(min(255, P[o + 1] * 255)), floor(min(255, P[o + 2] * 255)));
}
