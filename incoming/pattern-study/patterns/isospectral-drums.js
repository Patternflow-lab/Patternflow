// ===== Patternflow pattern =====
// Title:   Isospectral Drums
// Family:  wave
// Idea:    Two drums of different shape, each glued from the same seven half-squares, one above the other, ring in the same eigenmode at the same frequency, one tone where the membrane is up and the opposite tone where it is down with dark nodal lines between, while a strip between them marks their one shared spectrum and the mode they play as they climb it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: isospectral drums (Carolyn Gordon, David Webb and Scott Wolpert, 1992), the answer to Mark Kac's "Can one hear the shape of a drum?" (1966); the drums built from the Fano plane as Peter Buser, John Conway, Peter Doyle and Klaus-Dieter Semmler did (1994), pattern round 39
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mode=0..24, Beat=0..1
//
// Knob 1: Hue. Turns the two tones round the wheel together, always half a turn apart: at 0 the membrane is rose where it is up and aqua where it is down, at 0.1 coral and sky blue, at 0.25 yellow-lime and indigo, at 0.5 aqua and rose, at 0.75 indigo and yellow-lime. Orange and yellow tones are paled a little and lifted up to 1.5 times, so the dim parts of a swing do not turn brown or olive.
// Knob 2: Speed. At 2 the fundamental swings once in 2.5 s and the 24th mode, 3.3 times higher, in 0.76 s, and on its climb the pair holds each mode 5 s. At 0.2 all of it ten times slower, at 3 one and a half times faster.
// Knob 3: Mode. At 0 the drums climb their spectrum on their own from the 6th mode, a step every 5 s at Speed 2, back to the fundamental after the 24th. From 1 to 24 they hold that mode: 1 is a single dome; at 9 the nodal lines are exactly the seams between the seven half-squares, because that mode is the half-square's own lowest mode turned over at every seam; by 24 each drum is cut into eight to ten nodal domains, never laid out the same in the two.
// Knob 4: Beat. Mixes in the mode three steps up, to half and half at 1. The two frequencies beat and the nodal lines sweep across both drums and come back in the same rhythm, because the two drums share every frequency; the strip lights both modes.

const W = 64, H = 128;
// Leg of a half-square in LEDs. A drum spans three legs each way, 58 LEDs
// with its rim; the lower drum's grid starts at row 70.
const S = 19, NG = 3 * S + 1, X0 = 3, TOP = [0, 70];
// Modes found at setup, and the Lanczos steps that find them.
const K = 24, M = 64;
// The spectrum strip, rows 59 to 68: its axis runs from 0 to 1.05 times the
// 24th eigenvalue across the drums' width.
const AX = 1.05, TICK = [0.7, 0.8, 0.85];
// Fundamental frequency in Hz at Speed 2; seconds a mode is held on the
// climb, of which the last XF fade into the next; the mode the climb opens on.
const F1 = 0.4, DWELL = 5, XF = 1.2, FIRST = 6;
// Membrane level where it is flat, so the drums stay in sight between swings.
const FLOOR = 0.18;
// Opening hue: rose up, aqua down.
const H0 = 0.96;
const { floor, min, max, abs, sqrt, cos, round, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The Fano plane: its seven points are the nonzero vectors (x, y, z) of
// F2^3, held as the numbers 1 to 7, and so are its seven lines, a line v
// holding the points p with p.v = 0. Three involutions of PSL(3,2) act on
// both: a swaps x and z, b swaps y and z, c adds z to x. On lines an element
// acts by its inverse transpose, which for a and b is themselves and for c
// adds x to z.
const bit = (v, k) => (v >> k) & 1, vec = (x, y, z) => (x << 2) | (y << 1) | z;
const swapXZ = (v) => vec(bit(v, 0), bit(v, 1), bit(v, 2)), swapYZ = (v) => vec(bit(v, 2), bit(v, 0), bit(v, 1));
const ON_POINTS = [swapXZ, swapYZ, (v) => vec(bit(v, 2) ^ bit(v, 0), bit(v, 1), bit(v, 0))];
const ON_LINES = [swapXZ, swapYZ, (v) => vec(bit(v, 2), bit(v, 1), bit(v, 2) ^ bit(v, 0))];

// The base tile is the half-square (0,0), (1,0), (0,1); a and b are its
// legs, c its hypotenuse. Reflection across each, as (x, y) -> (m0 x + m1 y
// + m4, m2 x + m3 y + m5). Legs on the LED axes and the hypotenuse at 45
// degrees, so every reflection maps the LED grid onto itself.
const REF = [[1, 0, 0, -1, 0, 0], [-1, 0, 0, 1, 0, 0], [0, -1, -1, 0, 1, 1]];
const comp = (g, h) => [g[0] * h[0] + g[1] * h[2], g[0] * h[1] + g[1] * h[3], g[2] * h[0] + g[3] * h[2], g[2] * h[1] + g[3] * h[3], g[0] * h[4] + g[1] * h[5] + g[4], g[2] * h[4] + g[3] * h[5] + g[5]];

// Copy i of the tile is glued to copy a(i) across side a, and so on; a
// side an involution fixes is the drum's rim. The gluings make a tree, so
// unfolding it from copy 1 places every copy in the plane.
function unfold(inv) {
  const g = [];
  g[1] = [1, 0, 0, 1, 0, 0];
  const q = [1];
  while (q.length) {
    const i = q.pop();
    for (let s = 0; s < 3; s++) {
      const j = inv[s](i);
      if (j !== i && !g[j]) {
        g[j] = comp(g[i], REF[s]);
        q.push(j);
      }
    }
  }
  return g.slice(1);
}

// Each grid point of the drum: 0 outside, 1 on the rim, 2 inside. A point
// is inside when a step into every one of the eight 45-degree wedges round
// it stays on the drum; every tile edge runs along a wedge's side.
function drumMask(tiles, flip) {
  let mx = 1e9, my = 1e9;
  for (const g of tiles)
    for (const [u, v] of [[0, 0], [1, 0], [0, 1]]) {
      mx = min(mx, g[0] * u + g[1] * v + g[4]);
      my = min(my, g[2] * u + g[3] * v + g[5]);
    }
  const on = (x, y) => {
    for (const g of tiles) {
      const px = x / S + mx - g[4], py = y / S + my - g[5];
      const u = g[0] * px + g[2] * py, v = g[1] * px + g[3] * py;
      if (u > -1e-9 && v > -1e-9 && u + v < 1 + 1e-9) return true;
    }
    return false;
  };
  const m = new Uint8Array(NG * NG);
  for (let y = 0; y < NG; y++)
    for (let x = 0; x < NG; x++) {
      const gy = flip ? NG - 1 - y : y;
      if (!on(x, gy)) continue;
      let all = true;
      for (const [dx, dy] of [[2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]]) if (!on(x + 0.05 * dx, gy + 0.05 * dy)) all = false;
      m[y * NG + x] = all ? 2 : 1;
    }
  return m;
}

// Implicit QL on a symmetric tridiagonal matrix (EISPACK's tql2): d the
// diagonal, e[1..n-1] below it; z starts as the identity and leaves holding
// the eigenvectors in its columns.
function tql2(n, d, e, z) {
  for (let i = 1; i < n; i++) e[i - 1] = e[i];
  e[n - 1] = 0;
  let f = 0, tst = 0;
  for (let l = 0; l < n; l++) {
    tst = max(tst, abs(d[l]) + abs(e[l]));
    let m = l;
    while (m < n && abs(e[m]) > 2.2e-16 * tst) m++;
    if (m > l)
      do {
        let g = d[l], p = (d[l + 1] - g) / (2 * e[l]), r = hypot(p, 1);
        if (p < 0) r = -r;
        d[l] = e[l] / (p + r);
        d[l + 1] = e[l] * (p + r);
        const dl1 = d[l + 1];
        let h = g - d[l];
        for (let i = l + 2; i < n; i++) d[i] -= h;
        f += h;
        p = d[m];
        let c = 1, c2 = 1, c3 = 1, s = 0, s2 = 0;
        const el1 = e[l + 1];
        for (let i = m - 1; i >= l; i--) {
          c3 = c2;
          c2 = c;
          s2 = s;
          g = c * e[i];
          h = c * p;
          r = hypot(p, e[i]);
          e[i + 1] = s * r;
          s = e[i] / r;
          c = p / r;
          p = c * d[i] - s * g;
          d[i + 1] = h + s * (c * g + s * d[i]);
          for (let k = 0; k < n; k++) {
            const a = z[k * n + i], b = z[k * n + i + 1];
            z[k * n + i + 1] = s * a + c * b;
            z[k * n + i] = c * a - s * b;
          }
        }
        p = (-s * s2 * c3 * el1 * e[l]) / dl1;
        e[l] = s * p;
        d[l] = c * p;
      } while (abs(e[l]) > 2.2e-16 * tst);
    d[l] += f;
    e[l] = 0;
  }
}

// The lowest K eigenpairs of the 5-point Dirichlet Laplacian on the drum's
// inside points: Lanczos on its inverse, applied by a banded Cholesky
// factor, with full reorthogonalisation. Eigenvalues in units of one LED.
// Every reflection of the gluing maps the LED grid onto itself, so the two
// pixel drums are isospectral exactly, not only in the limit: both have
// 1179 inside points and the same 1179 eigenvalues, and the lowest 24 found
// here for each agree to 1e-11.
function drumModes(mask) {
  const id = new Int32Array(NG * NG).fill(-1), pos = [];
  for (let p = 0; p < NG * NG; p++) if (mask[p] === 2) id[p] = pos.push(p) - 1;
  const n = pos.length;
  let bw = 1;
  for (let i = 0; i < n; i++) if (id[pos[i] - NG] >= 0) bw = max(bw, i - id[pos[i] - NG]);
  const B = bw + 1, L = new Float64Array(n * B);
  for (let i = 0; i < n; i++)
    for (let j = max(0, i - bw); j <= i; j++) {
      const dp = pos[i] - pos[j];
      let s = i === j ? 4 : dp === 1 || dp === NG ? -1 : 0;
      for (let k = max(0, i - bw); k < j; k++) s -= L[i * B + i - k] * L[j * B + j - k];
      L[i * B + i - j] = i === j ? sqrt(s) : s / L[j * B];
    }
  const solve = (b, x) => {
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let k = max(0, i - bw); k < i; k++) s -= L[i * B + i - k] * x[k];
      x[i] = s / L[i * B];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      for (let k = i + 1; k <= min(n - 1, i + bw); k++) s -= L[k * B + k - i] * x[k];
      x[i] = s / L[i * B];
    }
  };
  const Q = new Float64Array(M * n), w = new Float64Array(n), d = new Float64Array(M), e = new Float64Array(M);
  // A fixed start, so both drums and every run find the same modes.
  let seed = 12345, nn = 0;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    Q[i] = seed / 4294967296 - 0.5;
    nn += Q[i] * Q[i];
  }
  for (let i = 0; i < n; i++) Q[i] /= sqrt(nn);
  for (let j = 0; j < M; j++) {
    solve(Q.subarray(j * n, j * n + n), w);
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i <= j; i++) {
        let dot = 0;
        for (let k = 0; k < n; k++) dot += w[k] * Q[i * n + k];
        if (!pass && i === j) d[j] = dot;
        for (let k = 0; k < n; k++) w[k] -= dot * Q[i * n + k];
      }
    let b = 0;
    for (let k = 0; k < n; k++) b += w[k] * w[k];
    b = sqrt(b);
    if (j + 1 < M) {
      e[j + 1] = b;
      for (let k = 0; k < n; k++) Q[(j + 1) * n + k] = w[k] / b;
    }
  }
  const z = new Float64Array(M * M);
  for (let i = 0; i < M; i++) z[i * M + i] = 1;
  tql2(M, d, e, z);
  const order = [...d.keys()].sort((a, b) => d[b] - d[a]).slice(0, K);
  const lam = new Float64Array(K), V = new Float32Array(K * n);
  order.forEach((col, m) => {
    lam[m] = 1 / d[col];
    const v = new Float64Array(n);
    for (let j = 0; j < M; j++) {
      const c = z[j * M + col];
      for (let i = 0; i < n; i++) v[i] += c * Q[j * n + i];
    }
    // The sign of a mode is free: its strongest antinode is taken as up.
    let big = 0;
    for (let i = 0; i < n; i++) if (abs(v[i]) > abs(big)) big = v[i];
    for (let i = 0; i < n; i++) V[m * n + i] = v[i] / big;
  });
  return { n, pos, lam, V };
}

export function setup(params) {
  // Drum A: copies of the tile at the points; drum B: at the lines.
  const masks = [drumMask(unfold(ON_POINTS), true), drumMask(unfold(ON_LINES), true)];
  params.s = {
    hue: 0, speed: 2, mode: 0, beat: 0.06, t: 0, tour: 0,
    masks, drums: masks.map(drumModes), w: new Float32Array(K), swing: new Float32Array(K), U: new Float32Array(NG * NG), strip: new Float32Array(W * 10 * 3),
    up: [0, 0, 0], down: [0, 0, 0], rim: [0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1) * (cl(k[1], 0.2, 3) / 2);
  S.hue = k[0];
  S.mode = round(cl(k[2], 0, K));
  S.beat = cl(k[3], 0, 1);
  S.t += d;
  // The modes playing and their shares: one held mode, or on the climb the
  // mode of this step fading into the next.
  const w = S.w, base = [];
  w.fill(0);
  if (S.mode > 0) base.push([S.mode - 1, 1]);
  else {
    S.tour += d;
    const step = floor(S.tour / DWELL), x = sm(DWELL - XF, DWELL, S.tour - step * DWELL), m = (FIRST - 1 + step) % K;
    base.push([m, 1 - x], [(m + 1) % K, x]);
  }
  // Beat shares each mode with the one three steps above it (below, for
  // the top three).
  for (const [m, s] of base) {
    w[m] += s * (1 - S.beat / 2);
    w[m + 3 < K ? m + 3 : m - 3] += (s * S.beat) / 2;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { up, down, rim, w, U, swing } = S;
  const lam = S.drums[0].lam, h = S.hue + H0;
  // Yellow and orange read olive and brown when dim: there the tone is paled
  // a little and the membrane lifted up to 1.5 times.
  const warm = (hh) => cl(1.5 - abs(hh - floor(hh) - 0.16) / 0.08, 0, 1), wu = warm(h), wd = warm(h + 0.5);
  hsv(h, 0.72 - 0.14 * wu, 1, up);
  hsv(h + 0.5, 0.78 - 0.14 * wd, 1, down);
  const lift = [1 + 0.5 * wu, 1 + 0.5 * wd];
  hsv(h + 0.25, 0.12, 0.62, rim);
  // Each mode swings as cos(omega t), omega in proportion to the square root
  // of its eigenvalue, and the same omega in both drums.
  for (let m = 0; m < K; m++) swing[m] = w[m] > 0.002 ? cos(2 * PI * F1 * sqrt(lam[m] / lam[0]) * S.t) : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);
  S.drums.forEach((D, di) => {
    const mask = S.masks[di], { n, pos, V } = D, y0 = TOP[di];
    U.fill(0);
    let scale = 0;
    for (let m = 0; m < K; m++) {
      if (w[m] <= 0.002) continue;
      const a = w[m] * swing[m];
      scale += w[m];
      for (let i = 0; i < n; i++) U[pos[i]] += a * V[m * n + i];
    }
    scale = max(scale, 1e-6);
    for (let gy = 0; gy < NG; gy++)
      for (let gx = 0; gx < NG; gx++) {
        const p = gy * NG + gx, kind = mask[p];
        if (!kind) continue;
        let r, g, b;
        if (kind === 1) [r, g, b] = rim;
        else {
          // How far the nearest nodal line is, in LEDs: the value over the
          // slope, the same at every moment of a swing.
          const u = U[p], sx = (U[p + 1] - U[p - 1]) / 2, sy = (U[p + NG] - U[p - NG]) / 2;
          const dist = abs(u) / sqrt(sx * sx + sy * sy + 1e-30), node = sm(0.15, 0.85, dist);
          const a = min(1, abs(u) / scale), tone = u >= 0 ? up : down, wh = 0.35 * a * a * a;
          const lv = (FLOOR + (1 - FLOOR) * a ** 0.7) * node * lift[u >= 0 ? 0 : 1];
          r = (tone[0] + (1 - tone[0]) * wh) * lv;
          g = (tone[1] + (1 - tone[1]) * wh) * lv;
          b = (tone[2] + (1 - tone[2]) * wh) * lv;
        }
        display.setPixel(X0 + gx, y0 + gy, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
      }
  });
  // The shared spectrum: a dim tick at every eigenvalue, and the modes
  // playing lit the full height of the strip, brightest at the top of their
  // swing and in the tone of the side it swings to.
  const span = (NG - 1) / (AX * lam[K - 1]), st = S.strip;
  st.fill(0);
  for (let m = 0; m < K; m++) {
    const xf = X0 + lam[m] * span, xi = floor(xf), fr = xf - xi;
    const tone = swing[m] >= 0 ? up : down, on = cl(w[m] * 1.4, 0, 1) * (0.45 + 0.55 * abs(swing[m]));
    for (let j = 0; j < 10; j++) {
      const tick = j >= 2 && j <= 7 ? 0.26 : 0, lit = on * (j === 0 || j === 9 ? 0.5 : 1);
      for (const [xx, f] of [[xi, 1 - fr], [xi + 1, fr]]) {
        const q = (j * W + xx) * 3;
        for (let c = 0; c < 3; c++) st[q + c] += (tick * (1 - lit) * TICK[c] + lit * (tone[c] + (1 - tone[c]) * 0.35)) * f;
      }
    }
  }
  for (let j = 0; j < 10; j++)
    for (let x = 0; x < W; x++) {
      const q = (j * W + x) * 3;
      display.setPixel(x, 59 + j, round(255 * min(1, st[q])), round(255 * min(1, st[q + 1])), round(255 * min(1, st[q + 2])));
    }
}
