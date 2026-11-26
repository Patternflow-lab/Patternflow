// ===== Patternflow pattern =====
// Title:   Root Locus
// Family:  rootlocus
// Idea:    A feedback loop's complex plane with a wandering plant: six poles and three zeros drift and trade places, the closed-loop poles are solved for every gain from nothing to infinity and drawn as glowing curves coloured by log gain, and a dot per branch rides the gain up and down and flares the imaginary axis each time it crosses into the unstable half.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the root locus method of Walter R. Evans (1948), the closed-loop poles of D(s) + K N(s) = 0 followed as the gain K runs from 0 to infinity, with the breakaway points, the asymptotes and the imaginary-axis crossing where a loop turns unstable (from memory); the constant-damping rays of the s-plane; the first-order Pade pair that stands in for a time delay, a pole at -d and a zero at +d. Original here: a plant whose poles and zeros walk from place to place and cross over, so the locus changes shape while it is drawn; the gain that roams along it with a comet trail; the contour where |D(s)/N(s)| equals the gain, which passes through every dot. Pattern round 256
// Round:   256
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Gain=0..3, Wander=-1..1, Zoom=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. It opens on blue for low gain, then green and yellow, to red for the highest, over a cool wash on the stable side and a warm one on the unstable side.
// Knob 2: Gain. 0 to 3, opening at 2. Where the roaming gain is centred on the locus: at 0 the dots wander near the open-loop poles, at 3 out toward the panel's edge where the branches leave for infinity. The gain keeps sweeping about that centre, with pauses, so the dots never settle.
// Knob 3: Wander. -1 to 1, opening at 0. How far and how fast the poles and zeros of the plant walk. At -1 they take small slow steps; at 1 they range over the whole panel, a pair turns into two real poles and back, and branches bend, merge and split within ten seconds or so.
// Knob 4: Zoom. -1 to 1, opening at about 0.06. The scale of the s-plane view, 9 LEDs to a unit at -1 and 13.4 at 1; zoomed in, the origin slides right a little so more of the stable half stays in view.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, log, round, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);

const Y0 = 64;                     // the real axis is the row between 63 and 64; the imaginary axis sits at st.x0, column 32 at the opening zoom
const NB = 6;                      // branches, one per pole of the plant
const MAXS = 1400;                 // samples along the gain axis
const MAXEV = 8, MAXBK = 8;
const NH = 48;                     // samples of each pole's and zero's own path, a quarter of a second apart
const DMAX = 1.3;                  // longest step of any root between two samples, in LEDs
const OUTM = 26;                   // how far outside the panel a root counts as gone, in LEDs

// the plant: a real pole r, two quadratic pole factors A and B, one quadratic zero factor Z, and a first-order delay pair,
// a pole at -d and a zero at +d. A factor (a, c) is s^2 - 2 a s + a^2 + c: a pair a +- j sqrt(c) when c > 0, two real
// roots a +- sqrt(-c) when c < 0. Six poles and three zeros, so three branches run off to infinity.
// centre and reach of each of the 8 numbers: aA cA aB cB r aZ cZ d
const PT = [[-0.5, 1.2], [5.0, 10.0], [-0.9, 1.5], [2.5, 8.0], [-0.8, 1.8], [-0.8, 1.4], [1.0, 4.5], [1.2, 0.8]];

// the colour of log gain: t, hue, saturation, value
const RAMP = [
  0.00, 0.640, 0.88, 0.82,
  0.20, 0.570, 0.86, 0.92,
  0.40, 0.470, 0.80, 0.96,
  0.58, 0.300, 0.78, 1.00,
  0.72, 0.150, 0.86, 1.00,
  0.86, 0.060, 0.90, 1.00,
  1.00, 0.990, 0.78, 1.00,
];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// a stroke's profile by distance in LEDs, in steps of 1/16: a core two LEDs thick with soft edges, and a glow around it
const PN = 112;
const PROF = new Float32Array(PN);
for (let i = 0; i < PN; i++) {
  const d = i / 16, core = cl(1.75 - d, 0, 1), gl = 0.28 * exp(-(d / 2.8) * (d / 2.8));
  PROF[i] = 1 - (1 - core) * (1 - gl);
}

export function setup(params) {
  const f64 = (n) => new Float64Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, ppu: 11, x0: 32,
    sa: f64(12), sb: f64(12), sp: f64(12), sd: f64(12), pp: f64(8),
    ls: new Float32Array(MAXS), sx: new Float32Array(NB * MAXS), sy: new Float32Array(NB * MAXS), ns: 0,
    zr: f64(NB), zi: f64(NB), ar: f64(NB), ai: f64(NB), cx: new Uint8Array(NB),
    D: f64(7), N: f64(4), co: f64(7), tmp: f64(7), q: f64(3), lin: f64(2),
    mx: f64(9), my: f64(9), hist: new Float32Array(9 * 2 * NH), hh: 0, hn: 0, hacc: 0,
    g: 0.3, gv: 0, gt: 0.8, pause: 0, go: 0.3, gtail: 0.3,
    fl: 0, side: new Int8Array(NB), ev: new Float32Array(MAXEV * 4), nev: 0,
    bk: new Float32Array(MAXBK * 3), nbk: 0,
    dx: new Float32Array(NB), dy: new Float32Array(NB),
    fb: new Float32Array(W * H * 3), lut: new Float32Array(256 * 3),
  });
  // every number of the plant and the view travels from one random place in its reach to the next, easing out and in
  for (let i = 0; i < 12; i++) { st.sa[i] = 2 * Math.random() - 1; st.sb[i] = 2 * Math.random() - 1; st.sp[i] = Math.random(); st.sd[i] = 9 + 24 * Math.random(); }
  st.t = 0;
  return st;
}

// where number j of the walk stands now, -1 to 1
function walk(st, j) {
  const t = st.sp[j];
  return st.sa[j] + (st.sb[j] - st.sa[j]) * (t * t * (3 - 2 * t));
}
function advance(st, dt, wsp) {
  for (let j = 0; j < 12; j++) {
    st.sp[j] += dt * wsp / st.sd[j];
    if (st.sp[j] >= 1) {
      st.sp[j] -= 1; st.sa[j] = st.sb[j]; st.sb[j] = 2 * Math.random() - 1; st.sd[j] = 9 + 24 * Math.random();
    }
  }
}

// ---- the plant at this moment ----
function plant(st, amp) {
  const pp = st.pp;
  for (let j = 0; j < 8; j++) pp[j] = PT[j][0] + PT[j][1] * amp * walk(st, j);
  // two real roots must not stray far into the right half-plane; the zeros may go further than the poles
  const lim = (a, c, l, lw) => {
    if (c >= 0) return c;
    const u = max(0, min(l - a, a - lw, sqrt(-c)));
    return -u * u;
  };
  pp[1] = lim(pp[0], pp[1], 1.0, -2.8);
  pp[3] = lim(pp[2], pp[3], 1.0, -2.8);
  pp[6] = lim(pp[5], pp[6], 1.4, -2.8);
  if (pp[4] > 1.0) pp[4] = 1.0;
}

function pmul(A, na, B, nb, out) {
  for (let i = 0; i <= na + nb; i++) out[i] = 0;
  for (let i = 0; i <= na; i++) for (let j = 0; j <= nb; j++) out[i + j] += A[i] * B[j];
}

// Aberth iteration for the roots of a real polynomial of degree n (coefficients low to high), from the guesses in zr, zi
function aberth(co, n, zr, zi, iters) {
  for (let it = 0; it < iters; it++) {
    let mc = 0;
    for (let i = 0; i < n; i++) {
      const xr = zr[i], xi = zi[i];
      let pr = co[n], pi = 0, dr = 0, di = 0;
      for (let k = n - 1; k >= 0; k--) {
        const ndr = dr * xr - di * xi + pr, ndi = dr * xi + di * xr + pi;
        dr = ndr; di = ndi;
        const npr = pr * xr - pi * xi + co[k], npi = pr * xi + pi * xr;
        pr = npr; pi = npi;
      }
      const den = dr * dr + di * di;
      let wr, wi;
      if (den < 1e-300) { wr = 1e-4; wi = 1e-4; } else { wr = (pr * dr + pi * di) / den; wi = (pi * dr - pr * di) / den; }
      let sr = 0, si = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const ex = xr - zr[j], ey = xi - zi[j], d2 = ex * ex + ey * ey + 1e-24;
        sr += ex / d2; si -= ey / d2;
      }
      const qr = 1 - (wr * sr - wi * si), qi = -(wr * si + wi * sr), q2 = qr * qr + qi * qi + 1e-300;
      const cr = (wr * qr + wi * qi) / q2, ci = (wi * qr - wr * qi) / q2;
      zr[i] = xr - cr; zi[i] = xi - ci;
      const m = sqrt(cr * cr + ci * ci) / (1 + sqrt(xr * xr + xi * xi));
      if (m > mc) mc = m;
    }
    if (mc < 1e-9) break;
  }
}

// the open-loop poles (0 to 5) and zeros (6 to 8) in s-plane units
function marks(pp, mx, my) {
  const pair = (a, c, i0) => {
    if (c >= 0) { const b = sqrt(c); mx[i0] = a; my[i0] = b; mx[i0 + 1] = a; my[i0 + 1] = -b; }
    else { const b = sqrt(-c); mx[i0] = a + b; my[i0] = 0; mx[i0 + 1] = a - b; my[i0 + 1] = 0; }
  };
  mx[0] = pp[4]; my[0] = 0;
  pair(pp[0], pp[1], 1); pair(pp[2], pp[3], 3);
  mx[5] = -pp[7]; my[5] = 0;
  pair(pp[5], pp[6], 6);
  mx[8] = pp[7]; my[8] = 0;
}

// the paths the poles and zeros have taken lately, kept for the wakes they leave
function remember(st, dt) {
  st.hacc += dt;
  if (st.hacc < 0.25) return;
  st.hacc -= 0.25;
  marks(st.pp, st.mx, st.my);
  st.hh = (st.hh + 1) % NH;
  for (let i = 0; i < 9; i++) { st.hist[(st.hh * 9 + i) * 2] = st.mx[i]; st.hist[(st.hh * 9 + i) * 2 + 1] = st.my[i]; }
  if (st.hn < NH) st.hn++;
}

// ---- the locus: the roots of D(s) + K N(s) over a sweep of K from nothing to the panel's edge, followed root to root ----
function locus(st, ppu) {
  const { D, N, co, tmp, q, zr, zi, ar, ai, pp, ls, sx, sy, cx } = st, X0 = st.x0;
  const n = 6, lin = st.lin;
  // D = (s - r) QA QB (s + d), N = QZ (s - d), where d is the delay pair
  const quad = (a, c) => { q[0] = a * a + c; q[1] = -2 * a; q[2] = 1; };
  tmp[0] = -pp[4]; tmp[1] = 1;
  quad(pp[0], pp[1]); pmul(tmp, 1, q, 2, D);
  for (let i = 0; i < 4; i++) tmp[i] = D[i];
  quad(pp[2], pp[3]); pmul(tmp, 3, q, 2, D);
  for (let i = 0; i < 6; i++) tmp[i] = D[i];
  lin[0] = pp[7]; lin[1] = 1; pmul(tmp, 5, lin, 1, D);
  quad(pp[5], pp[6]); lin[0] = -pp[7]; pmul(q, 2, lin, 1, N);
  const px = st.mx, py = st.my;
  marks(pp, px, py);
  for (let i = 0; i < n; i++) { zr[i] = px[i] + 1e-3 * cos(1.9 * i + 0.5); zi[i] = py[i] + 1e-3 * sin(1.9 * i + 0.5); }
  const sol = (K) => {
    for (let i = 0; i <= n; i++) co[i] = D[i] + (i < 4 ? K * N[i] : 0);
    aberth(co, n, zr, zi, 16);
  };
  // the gain where the fastest root has moved a third of an LED
  const Kp = 1e-6;
  sol(Kp);
  let s0 = 1e-9;
  for (let i = 0; i < n; i++) { const d = sqrt((zr[i] - px[i]) * (zr[i] - px[i]) + (zi[i] - py[i]) * (zi[i] - py[i])); if (d > s0) s0 = d; }
  const K0 = cl(0.3 / ppu * Kp / s0, 1e-12, 1e3);
  for (let i = 0; i < n; i++) { zr[i] = px[i] + 1e-3 * cos(1.9 * i + 0.5); zi[i] = py[i] + 1e-3 * sin(1.9 * i + 0.5); }
  sol(K0);
  let lnK = log(K0), h = 0.06, ns = 0, rc0 = 0, nbk = 0;
  const store = () => {
    ls[ns] = lnK;
    for (let i = 0; i < n; i++) { sx[i * MAXS + ns] = X0 + zr[i] * ppu; sy[i * MAXS + ns] = Y0 - zi[i] * ppu; }
    ns++;
  };
  store();
  for (let i = 0; i < n; i++) { cx[i] = abs(zi[i]) > 0.05 ? 1 : 0; if (!cx[i]) rc0++; }
  const nInf = 3;
  let guard = 0;
  while (ns < MAXS - 1 && guard++ < 6000) {
    for (let i = 0; i < n; i++) { ar[i] = zr[i]; ai[i] = zi[i]; }
    sol(exp(lnK + h));
    let d = 0;
    for (let i = 0; i < n; i++) {
      const xa = X0 + ar[i] * ppu, ya = Y0 - ai[i] * ppu;
      if (xa < -OUTM || xa > W + OUTM || ya < -OUTM || ya > H + OUTM) continue;
      const dd = sqrt((zr[i] - ar[i]) * (zr[i] - ar[i]) + (zi[i] - ai[i]) * (zi[i] - ai[i])) * ppu;
      if (dd > d) d = dd;
    }
    if (d !== d) break;
    if (d > DMAX && h > 0.0025) {
      for (let i = 0; i < n; i++) { zr[i] = ar[i]; zi[i] = ai[i]; }
      h *= 0.5;
      continue;
    }
    lnK += h;
    store();
    if (d < 0.5 * DMAX) h = min(h * 1.4, 0.2);
    // breakaway and break-in points: the count of real roots changes
    let rc = 0;
    for (let i = 0; i < n; i++) { const c = abs(zi[i]) > 0.05 ? 1 : 0; if (!c) rc++; }
    if (rc !== rc0 && nbk < MAXBK) {
      for (let i = 0; i < n; i++) {
        const c = abs(zi[i]) > 0.05 ? 1 : 0;
        if (c !== cx[i] && ((rc < rc0 && zi[i] > 0) || (rc > rc0 && !c))) { st.bk[nbk * 3] = X0 + zr[i] * ppu; st.bk[nbk * 3 + 1] = Y0; st.bk[nbk * 3 + 2] = rc < rc0 ? 1 : 0; nbk++; break; }
      }
    }
    rc0 = rc;
    for (let i = 0; i < n; i++) cx[i] = abs(zi[i]) > 0.05 ? 1 : 0;
    let gone = 0;
    for (let i = 0; i < n; i++) {
      const xa = X0 + zr[i] * ppu, ya = Y0 - zi[i] * ppu;
      if (xa < -OUTM || xa > W + OUTM || ya < -OUTM || ya > H + OUTM) gone++;
    }
    if (gone >= nInf) break;
  }
  st.ns = ns; st.nbk = nbk;
}

// ---- the gain: it roams up and down the locus on its own, easing in and out, and now and then rests ----
function roam(st, dt) {
  const vmax = 0.075, acc = 0.1;
  if (st.pause > 0) {
    st.pause -= dt;
    st.gv += cl(-st.gv, -acc * dt * 2, acc * dt * 2);
  } else {
    const e = st.gt - st.g, dir = e < 0 ? -1 : 1;
    const want = dir * min(vmax, sqrt(2 * acc * abs(e)) + 0.004);
    st.gv += cl(want - st.gv, -acc * dt, acc * dt);
    if (abs(e) < 0.006 && abs(st.gv) < 0.02) {
      st.pause = 0.25 + 3.6 * Math.random() * Math.random();
      const r = Math.random();
      st.gt = r < 0.34 ? 0.55 + 0.35 * Math.random() : r < 0.56 ? 0.34 * Math.random() : cl(st.g + (Math.random() - 0.5) * 0.9, 0.02, 0.97);
    }
  }
  st.g = cl(st.g + st.gv * dt, 0, 0.98);
}

function step(st, dt, wsp, wamp) {
  st.t += dt;
  advance(st, dt, wsp);
  plant(st, wamp);
  remember(st, dt);
  roam(st, dt);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(dt || 0, 0, 0.1);
  const wk = (v) => { const w = cl(v, -1, 1); return w < 0 ? [0.9 + 0.1 * w, exp(0.25 * w)] : [0.9 + 0.4 * w, exp(0.5 * w)]; };
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    const [wa, ws] = wk(st.ks[2]);
    // the plant has been wandering a while, and the gain has been roaming
    st.g = Math.random() * 0.8; st.gt = 0.6 + 0.35 * Math.random(); st.pause = 0;
    for (let i = 0; i < 400; i++) step(st, 0.1, ws, wa);
    // the picture opens with the dots out on the locus, moving
    st.g = 0.3 + 0.25 * Math.random(); st.gt = 0.7 + 0.18 * Math.random(); st.gv = 0.03; st.pause = 0;
    st.go = st.g; st.gtail = st.go - 0.04;
  }
  const a = 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  const kg = cl(st.ks[1], 0, 3);
  const [wa, ws] = wk(st.ks[2]);
  if (dt > 0) step(st, dt, ws, wa);
  // the gain the dots are at: the roaming gain, centred where the knob puts it
  const gtarget = cl(0.22 + 0.2 * kg + (st.g - 0.5) * 0.8, 0.01, 0.97);
  st.go = gtarget;
  st.gtail += (st.go - st.gtail) * (1 - exp(-dt / 0.8));
  const zk = cl(st.ks[3], -1, 1);
  // zoomed in, the origin slides right a little so more of the left half-plane stays in view; the view also
  // breathes and pans a little, on walks of its own
  const cb = 0.9;
  const zb = cb * (0.13 * walk(st, 8) + 0.09 * walk(st, 9)), pn = cb * (3.5 * walk(st, 10) + 2.5 * walk(st, 11));
  st.ppu = 11 * exp(0.2 * zk + zb); st.x0 = 32 + 8 * sstep(0, 1, zk) * zk + pn;
  locus(st, st.ppu);
  // where the dots are now, and whether one has crossed the imaginary axis
  const ns = st.ns, ls = st.ls, lk = ls[0] + st.go * (ls[ns - 1] - ls[0]);
  let lo = 0, hi = ns - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ls[m] <= lk) lo = m; else hi = m; }
  const f = cl((lk - ls[lo]) / (ls[hi] - ls[lo] + 1e-9), 0, 1);
  for (let b = 0; b < NB; b++) {
    const x = st.sx[b * MAXS + lo] + (st.sx[b * MAXS + hi] - st.sx[b * MAXS + lo]) * f;
    const y = st.sy[b * MAXS + lo] + (st.sy[b * MAXS + hi] - st.sy[b * MAXS + lo]) * f;
    st.dx[b] = x; st.dy[b] = y;
    const sg = x - st.x0, sd = st.side[b];
    if (sg > 0.4 && sd <= 0) {
      if (sd < 0 && dt > 0) crossAt(st, x, y, 1);
      st.side[b] = 1;
    } else if (sg < -0.4 && sd >= 0) {
      if (sd > 0 && dt > 0) crossAt(st, x, y, 0);
      st.side[b] = -1;
    }
  }
  if (dt <= 0) return;
  st.fl *= exp(-dt / 0.45);
  for (let e = 0; e < st.nev; e++) {
    st.ev[e * 4 + 2] += dt;
    if (st.ev[e * 4 + 2] > 1.6) {
      st.nev--;
      for (let m = e * 4; m < st.nev * 4; m++) st.ev[m] = st.ev[m + 4];
      e--;
    }
  }
}

function crossAt(st, x, y, kind) {
  if (st.nev >= MAXEV) return;
  const o = st.nev++ * 4;
  st.ev[o] = x; st.ev[o + 1] = y; st.ev[o + 2] = 0; st.ev[o + 3] = kind;
  st.fl = min(1.6, st.fl + (kind ? 0.7 : 0.25));
}

// ---- drawing ----
// one stroke from (ax, ay) to (bx, by) in the colour (cr, cg, cb) at strength lev, its profile widened by ws
function stroke(fb, ax, ay, bx, by, cr, cg, cb, lev, ws) {
  const R = 6.5 * ws;
  let x0 = floor(min(ax, bx) - R), x1 = ceil(max(ax, bx) + R), y0 = floor(min(ay, by) - R), y1 = ceil(max(ay, by) + R);
  if (x1 < 0 || y1 < 0 || x0 >= W || y0 >= H) return;
  x0 = max(0, x0); y0 = max(0, y0); x1 = min(W - 1, x1); y1 = min(H - 1, y1);
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey, il = l2 > 1e-9 ? 1 / l2 : 0, iw = 16 / ws;
  for (let py = y0; py <= y1; py++) {
    const qy = py + 0.5 - ay;
    for (let px = x0; px <= x1; px++) {
      const qx = px + 0.5 - ax;
      const t = cl((qx * ex + qy * ey) * il, 0, 1), rx = qx - t * ex, ry = qy - t * ey;
      const i = (sqrt(rx * rx + ry * ry) * iw) | 0;
      if (i >= PN) continue;
      const v = PROF[i] * lev;
      const o = (py * W + px) * 3;
      if (cr * v > fb[o]) fb[o] = cr * v;
      if (cg * v > fb[o + 1]) fb[o + 1] = cg * v;
      if (cb * v > fb[o + 2]) fb[o + 2] = cb * v;
    }
  }
}

// a filled disc of radius r with a soft halo, and a ring when thick > 0
function blob(fb, cx, cy, r, cr, cg, cb, lev, halo, ring) {
  const R = r + 5;
  const x0 = max(0, floor(cx - R)), x1 = min(W - 1, ceil(cx + R)), y0 = max(0, floor(cy - R)), y1 = min(H - 1, ceil(cy + R));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const dx = px + 0.5 - cx, dy = py + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
    let cov = ring > 0 ? cl(ring * 0.5 + 0.5 - abs(d - r), 0, 1) : cl(r + 0.5 - d, 0, 1);
    const dd = ring > 0 ? abs(d - r) : max(0, d - r);
    cov = 1 - (1 - cov) * (1 - halo * exp(-(dd / 2.0) * (dd / 2.0)));
    if (cov <= 0.004) continue;
    const v = cov * lev, o = (py * W + px) * 3;
    if (cr * v > fb[o]) fb[o] = cr * v;
    if (cg * v > fb[o + 1]) fb[o + 1] = cg * v;
    if (cb * v > fb[o + 2]) fb[o + 2] = cb * v;
  }
}

// a patch of the picture is darkened first so a mark reads over the glow of a branch
function knock(fb, cx, cy, r, amt) {
  const x0 = max(0, floor(cx - r - 1)), x1 = min(W - 1, ceil(cx + r + 1)), y0 = max(0, floor(cy - r - 1)), y1 = min(H - 1, ceil(cy + r + 1));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const dx = px + 0.5 - cx, dy = py + 0.5 - cy, d = sqrt(dx * dx + dy * dy);
    const k = 1 - amt * cl(r + 0.5 - d, 0, 1), o = (py * W + px) * 3;
    fb[o] *= k; fb[o + 1] *= k; fb[o + 2] *= k;
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { fb, lut } = st, ns = st.ns, ls = st.ls, sx = st.sx, sy = st.sy, X0 = st.x0;
  const hue = st.ks[0];
  // the colour of log gain at this turn of the hue knob
  for (let i = 0; i < 256; i++) {
    const tt = i / 255;
    let k = 0;
    while (k < 5 && tt > RAMP[k * 4 + 4]) k++;
    const o = k * 4, f = cl((tt - RAMP[o]) / (RAMP[o + 4] - RAMP[o]), 0, 1);
    hsv(hue + RAMP[o + 1] + (RAMP[o + 5] - RAMP[o + 1]) * f, RAMP[o + 2] + (RAMP[o + 6] - RAMP[o + 2]) * f, RAMP[o + 3] + (RAMP[o + 7] - RAMP[o + 3]) * f, lut, i * 3);
  }
  const cool = [0, 0, 0], warm = [0, 0, 0], axc = [0, 0, 0], ray = [0, 0, 0];
  hsv(hue + 0.62, 0.8, 1, cool, 0); hsv(hue + 0.03, 0.9, 1, warm, 0); hsv(hue + 0.58, 0.45, 1, ray, 0); hsv(hue + 0.58, 0.2, 1, axc, 0);
  const fl = st.fl;
  // ground: the stable side cool, the unstable side warm; the warm side swells while a closed-loop pole is out there and flares at a crossing
  if (ns < 2) { fb.fill(0); out(display, fb); return; }
  const ppu = st.ppu, ippu = 1 / ppu;
  const span = ls[ns - 1] - ls[0] + 1e-9, lk = ls[0] + st.go * span, lt = ls[0] + st.gtail * span;
  const ti = round(cl((lk - ls[0]) / span, 0, 1) * 255) * 3;
  const mx = st.mx, my = st.my;
  const rays = [[0.25, 0], [0.5, 0], [0.707, 0]];
  for (const r of rays) { const ph = Math.acos(r[0]); r[1] = sin(ph); r.push(cos(ph)); }
  for (let py = 0; py < H; py++) {
    const dy = py + 0.5 - Y0, ady = abs(dy);
    for (let px = 0; px < W; px++) {
      const dx = px + 0.5 - X0, o = (py * W + px) * 3;
      let r = 0, g = 0, b = 0;
      if (dx < 0) {
        const v = 0.09 * (0.4 + 0.6 / (1 + (dx / 20) * (dx / 20)));
        r = cool[0] * v; g = cool[1] * v; b = cool[2] * v;
        for (let k = 0; k < 3; k++) {
          const sn = rays[k][1], cs = rays[k][2];
          const t = -dx * cs + ady * sn;
          if (t < 0) continue;
          const d = abs(dx * sn + ady * cs);
          if (d > 3) continue;
          const c = 0.11 * exp(-d * d / 1.1) * (1 - 0.5 * min(1, t / 80));
          r += ray[0] * c; g += ray[1] * c; b += ray[2] * c;
        }
      } else {
        const v = (0.07 + 0.05 * fl) * (0.4 + 0.6 / (1 + (dx / 14) * (dx / 14)));
        r = warm[0] * v; g = warm[1] * v; b = warm[2] * v;
      }
      // the contour where |D(s)/N(s)| equals the present gain: the closed-loop poles are where it meets the branches
      const sxu = dx * ippu, syu = -dy * ippu;
      let num = 1, den = 1, gr = 0, gi = 0;
      for (let i = 0; i < NB; i++) {
        const ex = sxu - mx[i], ey = syu - my[i], r2 = ex * ex + ey * ey + 1e-8, ir = 1 / r2;
        num *= r2; gr += ex * ir; gi -= ey * ir;
      }
      for (let i = 0; i < 3; i++) {
        const ex = sxu - mx[6 + i], ey = syu - my[6 + i], r2 = ex * ex + ey * ey + 1e-8, ir = 1 / r2;
        den *= r2; gr -= ex * ir; gi += ey * ir;
      }
      const hh = 0.5 * log(num / den) - lk, sd = hh / (sqrt(gr * gr + gi * gi) + 1e-9) * ppu, dl = abs(sd);
      // inside the contour, where the loop gain beats this K, the plane glows faintly; the contour itself is a soft line
      let c = 0;
      if (dl < 3.5) c += 0.34 * exp(-dl * dl / 1.3);
      r += lut[ti] * c; g += lut[ti + 1] * c; b += lut[ti + 2] * c;
      // the real axis and the imaginary axis
      const ha = cl(1.0 - abs(dy), 0, 1) * 0.1, va = cl(1.5 - abs(dx), 0, 1) * (0.2 + 0.5 * fl);
      r += ray[0] * ha + axc[0] * va; g += ray[1] * ha + axc[1] * va; b += ray[2] * ha + axc[2] * va;
      fb[o] = r; fb[o + 1] = g; fb[o + 2] = b;
    }
  }
  const tlo = min(lk, lt), thi = max(lk, lt);
  // the locus, branch by branch, segment by segment
  for (let b = 0; b < NB; b++) {
    const o = b * MAXS;
    for (let k = 0; k + 1 < ns; k++) {
      const ax = sx[o + k], ay = sy[o + k], bx = sx[o + k + 1], by = sy[o + k + 1];
      const lm = 0.5 * (ls[k] + ls[k + 1]), t = (lm - ls[0]) / span;
      const ci = round(t * 255) * 3;
      // swept part brighter than what lies ahead
      let lev = 0.55 + 0.4 * sstep(lk + 0.3, lk - 0.3, lm), ws = 1, wh = 0;
      if (lm >= tlo && lm <= thi) {
        const u = (lm - lt) / (lk - lt + (lk === lt ? 1e-9 : 0));
        wh = cl(u, 0, 1); wh = wh * wh * (3 - 2 * wh);
        lev = lev + (1 - lev) * wh; ws = 1 + 0.5 * wh;
      }
      const cr = lut[ci] + (1 - lut[ci]) * 0.55 * wh, cg = lut[ci + 1] + (1 - lut[ci + 1]) * 0.55 * wh, cb = lut[ci + 2] + (1 - lut[ci + 2]) * 0.55 * wh;
      stroke(fb, ax, ay, bx, by, cr, cg, cb, lev, ws);
    }
  }
  // the wakes: where each pole and zero has been in the last dozen seconds
  const cw0 = [0.5 + 0.5 * lut[0], 0.5 + 0.5 * lut[1], 0.5 + 0.5 * lut[2]], cw1 = [0.5 + 0.5 * lut[765 - 3], 0.5 + 0.5 * lut[765 - 2], 0.5 + 0.5 * lut[765 - 1]];
  for (let m = 0; m < 9; m++) {
    const cc = m < 6 ? cw0 : cw1;
    let pxl = X0 + mx[m] * ppu, pyl = Y0 - my[m] * ppu;
    for (let k = 0; k < st.hn; k++) {
      const hi = ((st.hh - k + NH) % NH * 9 + m) * 2;
      const qx = X0 + st.hist[hi] * ppu, qy = Y0 - st.hist[hi + 1] * ppu, a = 1 - (k + 0.5) / NH;
      stroke(fb, pxl, pyl, qx, qy, cc[0], cc[1], cc[2], 0.7 * a * a, 0.7);
      pxl = qx; pyl = qy;
    }
  }
  // breakaway and break-in points
  for (let i = 0; i < st.nbk; i++) blob(fb, st.bk[i * 3], st.bk[i * 3 + 1], 1.0, 0.9, 0.95, 1, 0.55, 0.2, 0);
  // the open-loop zeros (rings) and poles (crosses)
  const c0 = [lut[0], lut[1], lut[2]], c1 = [lut[765 - 3], lut[765 - 2], lut[765 - 1]];
  for (let i = 0; i < 3; i++) {
    const x = X0 + mx[6 + i] * ppu, y = Y0 - my[6 + i] * ppu;
    if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
    knock(fb, x, y, 3.0, 0.75);
    blob(fb, x, y, 1.9, 0.45 + 0.55 * c1[0], 0.45 + 0.55 * c1[1], 0.45 + 0.55 * c1[2], 1, 0.12, 1.2);
  }
  for (let i = 0; i < NB; i++) {
    const x = X0 + mx[i] * ppu, y = Y0 - my[i] * ppu;
    if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
    knock(fb, x, y, 3.0, 0.75);
    const cr = 0.5 + 0.5 * c0[0], cg = 0.5 + 0.5 * c0[1], cb = 0.5 + 0.5 * c0[2];
    stroke(fb, x - 1.7, y - 1.7, x + 1.7, y + 1.7, cr, cg, cb, 0.95, 0.62);
    stroke(fb, x - 1.7, y + 1.7, x + 1.7, y - 1.7, cr, cg, cb, 0.95, 0.62);
  }
  // crossings: a ring spreads from the point and the axis flares near it
  for (let e = 0; e < st.nev; e++) {
    const x = st.ev[e * 4], y = st.ev[e * 4 + 1], age = st.ev[e * 4 + 2], kind = st.ev[e * 4 + 3];
    const fade = exp(-age / 0.55) * (kind ? 1 : 0.45);
    const col = kind ? warm : cool;
    blob(fb, x, y, 2.5 + 10 * age, 0.5 + 0.5 * col[0], 0.5 + 0.5 * col[1], 0.5 + 0.5 * col[2], 0.8 * fade, 0.1 * fade, 1.5);
    const L = 5 + 16 * age;
    for (let py = max(0, floor(y - 3 * L)); py <= min(H - 1, ceil(y + 3 * L)); py++) {
      const q = (py + 0.5 - y) / L, v = 0.8 * fade * exp(-q * q);
      for (let px = max(0, floor(X0) - 2); px <= min(W - 1, floor(X0) + 2); px++) {
        const c = cl(1.5 - abs(px + 0.5 - X0), 0, 1) * v, o = (py * W + px) * 3;
        fb[o] += col[0] * c; fb[o + 1] += col[1] * c; fb[o + 2] += col[2] * c;
      }
    }
  }
  // the dots: the closed-loop poles at the present gain
  const dr = lut[ti] * 0.6 + 0.4, dg = lut[ti + 1] * 0.6 + 0.4, db = lut[ti + 2] * 0.6 + 0.4;
  for (let b = 0; b < NB; b++) {
    const x = st.dx[b], y = st.dy[b];
    if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
    blob(fb, x, y, 2.6, lut[ti], lut[ti + 1], lut[ti + 2], 1, 0.5, 0);
    blob(fb, x, y, 1.4, dr, dg, db, 1, 0, 0);
  }
  out(display, fb);
}

function out(display, fb) {
  for (let p = 0, f = 0; p < W * H; p++, f += 3) {
    const r = fb[f], g = fb[f + 1], b = fb[f + 2];
    display.setPixel(p % W, (p / W) | 0, (r > 1 ? 255 : r * 255 + 0.5) | 0, (g > 1 ? 255 : g * 255 + 0.5) | 0, (b > 1 ? 255 : b * 255 + 0.5) | 0);
  }
}
