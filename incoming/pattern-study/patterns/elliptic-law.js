// ===== Patternflow pattern =====
// Title:   Elliptic Law
// Family:  particle
// Idea:    The eigenvalues of a random real matrix whose entries wander drift as glowing particles inside an ellipse that stands up the panel, mirrored in pairs across the real axis down its middle, and whenever a mirrored pair meets on the axis it splits into two real eigenvalues that run apart along it, or two real ones meet and leave it as a pair.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: circular law (Jean Ginibre, 1965; Vyacheslav Girko, 1984), elliptic law (Hans-Jürgen Sommers, Andrea Crisanti, Haim Sompolinsky and Yaakov Stein, 1988), real eigenvalues of a real Gaussian matrix (Alan Edelman, Eric Kostlan and Michael Shub, 1994), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tau=0.333..1, Size=40..80
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the complex eigenvalues are cyan over a deep blue glow and the real ones pale violet, at 0.25 violet and red, at 0.5 rose and green, at 0.75 green and azure. The wheel skips the orange and yellow stretch, which reads brown when dim.
// Knob 2: Speed. How fast the matrix entries wander. At 2 an entry's correlation with where it was first falls to zero after 4.9 s, an eigenvalue in the middle of the ellipse moves about 12 LEDs a second, and somewhere on the axis a pair meets or parts about 6.5 times a second. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Tau. The correlation between the entries J_ij and J_ji, from 1/3 to 1. The ellipse has half-axes 1 + Tau along the real axis and 1 - Tau across it, drawn so the real half-axis is always 61 LEDs: at 1/3 it is 61 LEDs wide and fills the panel, at 0.6 30 wide, at 0.8 14, and at 1 the matrix is symmetric and every eigenvalue lies on the axis. A 40 x 40 matrix has 7.6 real eigenvalues on average at 1/3, 10.4 at 0.6 and 15.1 at 0.8 (4,000 matrices each).
// Knob 4: Size. The matrix is 40 x 40 to 80 x 80. The ellipse stays the same size and fills more evenly, and the share of real eigenvalues falls: at Tau 1/3 a 40 x 40 matrix has 7.6 of them on average and an 80 x 80 one 10.5, close to Peter Forrester and Taro Nagao's sqrt(2N/pi (1 + Tau)/(1 - Tau)) (2008), which gives 7.1 and 10.1.

const W = 64, H = 128, NPX = W * H, NM = 80;
const { floor, min, max, sqrt, exp, sin, cos, log, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The real half-axis in LEDs, and the centre of the panel.
const RPX = 61, CX = 32, CY = 64;
// Entry clock: units of the entries' own time per second at Speed 1. In one
// unit a resting entry turns one radian of its oscillation (below).
const RATE = 0.22;
// Damping of each entry's velocity, per unit of entry time.
const GAMMA = 0.8;
// Short trails fade by e in TRAIL seconds, the long exposure in EXPO.
const TRAIL = 0.3, EXPO = 3.5;
// A spark where a pair met on the axis lasts this long.
const SPARK = 0.4;

function gauss() {
  let u = 0;
  while (u < 1e-12) u = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// The wheel skips 0.03..0.18, orange through yellow, which reads brown and
// olive when dim, and runs the rest a little faster.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

export function setup(params) {
  const g = new Float64Array(NM * NM), v = new Float64Array(NM * NM);
  for (let i = 0; i < NM * NM; i++) (g[i] = gauss()), (v[i] = gauss());
  params.s = {
    g, v, hue: 0, speed: 2, tau: 1 / 3, n: 40,
    a: new Float64Array(NM * NM), wr: new Float64Array(NM), wi: new Float64Array(NM),
    // Eigenvalues as LED positions, this frame and last.
    px: new Float32Array(NM), py: new Float32Array(NM), re: new Uint8Array(NM),
    qx: new Float32Array(NM), qy: new Float32Array(NM), qre: new Uint8Array(NM), qn: 0,
    trail: new Float32Array(NPX * 3), expo: new Float32Array(NPX * 2), rgb: new Float32Array(NPX * 3), flash: [],
    pal: new Float32Array(15), palHue: -1, solved: false, fails: 0,
  };
}

// Each entry of the matrix is built from N(0, 1) numbers g that move as the
// position of a damped oscillator kicked by noise, a two-dimensional
// Ornstein-Uhlenbeck process whose resting law is N(0, 1) for g and its
// velocity v alike. A step of h units turns (g, v) by h radians, which keeps
// that law, then takes v through an exact Ornstein-Uhlenbeck step, which keeps it
// too; so at every moment the matrix is a fresh draw of the ensemble, and
// g moves smoothly enough for the eigenvalues to glide instead of jitter.
function wander(S, h) {
  const { g, v, n } = S, c = cos(h), s = sin(h), e = exp(-GAMMA * h), k = sqrt(1 - e * e);
  for (let i = 0; i < n; i++)
    for (let j = 0, o = i * NM; j < n; j++, o++) {
      const a = g[o], b = v[o];
      g[o] = a * c + b * s;
      v[o] = (b * c - a * s) * e + k * gauss();
    }
}

// The elliptic ensemble from those numbers: above the diagonal g holds the
// symmetric parts, below it the antisymmetric ones, so
//   J_ij = (c1 g_ij + c2 g_ji) / sqrt N,  J_ji = (c1 g_ij - c2 g_ji) / sqrt N,
// with c1^2 = (1 + tau)/2 and c2^2 = (1 - tau)/2: every entry has variance
// 1/N and E J_ij J_ji = tau/N.
function build(S) {
  const { g, a, n, tau } = S, r = 1 / sqrt(n), c1 = sqrt((1 + tau) / 2) * r, c2 = sqrt((1 - tau) / 2) * r;
  for (let i = 0; i < n; i++) {
    a[i * n + i] = sqrt(1 + tau) * g[i * NM + i] * r;
    for (let j = i + 1; j < n; j++) {
      const p = g[i * NM + j], q = g[j * NM + i];
      a[i * n + j] = c1 * p + c2 * q;
      a[j * n + i] = c1 * p - c2 * q;
    }
  }
}

// Reduction to upper Hessenberg form by stabilised elementary similarity
// transforms (row and column swaps, then elimination below the subdiagonal).
function hessenberg(a, n) {
  for (let m = 1; m < n - 1; m++) {
    let x = 0, i = m;
    for (let j = m; j < n; j++) if (abs(a[j * n + m - 1]) > abs(x)) (x = a[j * n + m - 1]), (i = j);
    if (i !== m) {
      for (let j = m - 1; j < n; j++) {
        const t = a[i * n + j];
        a[i * n + j] = a[m * n + j];
        a[m * n + j] = t;
      }
      for (let j = 0; j < n; j++) {
        const t = a[j * n + i];
        a[j * n + i] = a[j * n + m];
        a[j * n + m] = t;
      }
    }
    if (x === 0) continue;
    for (i = m + 1; i < n; i++) {
      let y = a[i * n + m - 1];
      if (y === 0) continue;
      y /= x;
      a[i * n + m - 1] = y;
      for (let j = m; j < n; j++) a[i * n + j] -= y * a[m * n + j];
      for (let j = 0; j < n; j++) a[j * n + m] += y * a[j * n + i];
    }
  }
}

// Francis's implicit double-shift QR on the Hessenberg matrix, eigenvalues
// only. Each sweep chases a 3 x 3 Householder bulge down the subdiagonal
// with the two shifts the trailing 2 x 2 block gives, a pair of complex
// conjugates kept in real arithmetic; a small subdiagonal entry splits off
// one real eigenvalue or a 2 x 2 block whose roots are a real pair or a
// conjugate pair. Real roots come back with wi exactly 0.
function francis(a, n, wr, wi) {
  let nn = n - 1, t = 0, anorm = 0, p = 0, q = 0, r = 0, x, y, z, w, s, u, v, l, m;
  for (let i = 0; i < n; i++) for (let j = max(i - 1, 0); j < n; j++) anorm += abs(a[i * n + j]);
  while (nn >= 0) {
    let its = 0;
    do {
      for (l = nn; l > 0; l--) {
        s = abs(a[(l - 1) * n + l - 1]) + abs(a[l * n + l]);
        if (s === 0) s = anorm;
        if (abs(a[l * n + l - 1]) + s === s) {
          a[l * n + l - 1] = 0;
          break;
        }
      }
      x = a[nn * n + nn];
      if (l === nn) {
        wr[nn] = x + t;
        wi[nn--] = 0;
      } else {
        y = a[(nn - 1) * n + nn - 1];
        w = a[nn * n + nn - 1] * a[(nn - 1) * n + nn];
        if (l === nn - 1) {
          p = 0.5 * (y - x);
          q = p * p + w;
          z = sqrt(abs(q));
          x += t;
          if (q >= 0) {
            z = p + (p >= 0 ? z : -z);
            wr[nn - 1] = wr[nn] = x + z;
            if (z) wr[nn] = x - w / z;
            wi[nn - 1] = wi[nn] = 0;
          } else {
            wr[nn - 1] = wr[nn] = x + p;
            wi[nn - 1] = -(wi[nn] = z);
          }
          nn -= 2;
        } else {
          if (its === 60) return false;
          // Exceptional shifts after 10 and 20 sweeps without a split.
          if (its === 10 || its === 20) {
            t += x;
            for (let i = 0; i <= nn; i++) a[i * n + i] -= x;
            s = abs(a[nn * n + nn - 1]) + abs(a[(nn - 1) * n + nn - 2]);
            y = x = 0.75 * s;
            w = -0.4375 * s * s;
          }
          ++its;
          // Where the bulge can start: two small subdiagonals in a row.
          for (m = nn - 2; m >= l; m--) {
            z = a[m * n + m];
            r = x - z;
            s = y - z;
            p = (r * s - w) / a[(m + 1) * n + m] + a[m * n + m + 1];
            q = a[(m + 1) * n + m + 1] - z - r - s;
            r = a[(m + 2) * n + m + 1];
            s = abs(p) + abs(q) + abs(r);
            p /= s;
            q /= s;
            r /= s;
            if (m === l) break;
            u = abs(a[m * n + m - 1]) * (abs(q) + abs(r));
            v = abs(p) * (abs(a[(m - 1) * n + m - 1]) + abs(z) + abs(a[(m + 1) * n + m + 1]));
            if (u + v === v) break;
          }
          for (let i = m; i < nn - 1; i++) {
            a[(i + 2) * n + i] = 0;
            if (i !== m) a[(i + 2) * n + i - 1] = 0;
          }
          // Chase the bulge.
          for (let k = m; k < nn; k++) {
            if (k !== m) {
              p = a[k * n + k - 1];
              q = a[(k + 1) * n + k - 1];
              r = k + 1 !== nn ? a[(k + 2) * n + k - 1] : 0;
              if ((x = abs(p) + abs(q) + abs(r)) !== 0) (p /= x), (q /= x), (r /= x);
            }
            const sg = sqrt(p * p + q * q + r * r);
            if ((s = p >= 0 ? sg : -sg) === 0) continue;
            if (k === m) {
              if (l !== m) a[k * n + k - 1] = -a[k * n + k - 1];
            } else a[k * n + k - 1] = -s * x;
            p += s;
            x = p / s;
            y = q / s;
            z = r / s;
            q /= p;
            r /= p;
            for (let j = k; j <= nn; j++) {
              p = a[k * n + j] + q * a[(k + 1) * n + j];
              if (k + 1 !== nn) {
                p += r * a[(k + 2) * n + j];
                a[(k + 2) * n + j] -= p * z;
              }
              a[(k + 1) * n + j] -= p * y;
              a[k * n + j] -= p * x;
            }
            const top = nn < k + 3 ? nn : k + 3;
            for (let i = l; i <= top; i++) {
              p = x * a[i * n + k] + y * a[i * n + k + 1];
              if (k + 1 !== nn) {
                p += z * a[i * n + k + 2];
                a[i * n + k + 2] -= p * r;
              }
              a[i * n + k + 1] -= p * q;
              a[i * n + k] -= p;
            }
          }
        }
      }
    } while (l < nn - 1);
  }
  return true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1 / 3, 40], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.tau = cl(kv[2], 1 / 3, 1);
  S.n = cl(floor(kv[3] + 0.5), 40, NM);
  wander(S, d * S.speed * RATE);
  build(S);
  hessenberg(S.a, S.n);
  // A failed solve keeps last frame's eigenvalues; none failed in 18,000
  // frames at the knobs' ends.
  if (!francis(S.a, S.n, S.wr, S.wi)) {
    S.fails++;
    return;
  }
  // Last frame's positions, for the trails and to spot a meeting on the axis.
  S.qx.set(S.px);
  S.qy.set(S.py);
  S.qre.set(S.re);
  S.qn = S.solved ? S.qn : 0;
  const sc = RPX / (1 + S.tau);
  for (let k = 0; k < S.n; k++) {
    S.px[k] = CX + S.wi[k] * sc;
    S.py[k] = CY - S.wr[k] * sc;
    S.re[k] = S.wi[k] === 0 ? 1 : 0;
  }
  const qn = S.qn;
  S.qn = S.n;
  S.solved = true;
  // An eigenvalue whose nearest one last frame was of the other kind has
  // just crossed over: a real one born from a conjugate pair meeting on the
  // axis, or a complex one from two real ones meeting. A spark marks where.
  if (qn === S.n)
    for (let k = 0; k < S.n; k++) {
      let best = 1e9, bj = -1;
      for (let j = 0; j < qn; j++) {
        const dx = S.qx[j] - S.px[k], dy = S.qy[j] - S.py[k], e = dx * dx + dy * dy;
        if (e < best) (best = e), (bj = j);
      }
      if (bj < 0 || S.qre[bj] === S.re[k] || best > 36) continue;
      const fy = S.re[k] ? S.py[k] : S.qy[bj];
      if (S.flash.some((f) => abs(f.y - fy) < 3 && f.age < 0.2)) continue;
      if (S.flash.length < 12) S.flash.push({ y: fy, age: 0, real: S.re[k] });
    }
  for (const f of S.flash) f.age += d;
  S.flash = S.flash.filter((f) => f.age < SPARK);
  S.dt = d;
}

function palette(S) {
  const P = S.pal, h = S.hue;
  hsv(wheel(0.58 + h), 0.75, 1, P, 0); // complex heads and trails
  hsv(wheel(0.9 + h), 0.6, 1, P, 3); // real heads and trails
  hsv(wheel(0.63 + h), 0.85, 1, P, 6); // long exposure, complex
  hsv(wheel(0.92 + h), 0.7, 1, P, 9); // long exposure, real
  hsv(wheel(0.6 + h), 0.5, 1, P, 12); // the law's ellipse
  S.palHue = S.hue;
}

// A point spread over its four nearest LEDs by how close it falls.
function splat(buf, x, y, c0, c1, c2, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const k = (dx ? tx : 1 - tx) * wy * a, p = (yy * W + xx) * 3;
      buf[p] = max(buf[p], c0 * k);
      buf[p + 1] = max(buf[p + 1], c1 * k);
      buf[p + 2] = max(buf[p + 2], c2 * k);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.solved) return;
  if (S.palHue !== S.hue) palette(S);
  const P = S.pal, n = S.n, tr = S.trail, ex = S.expo, rgb = S.rgb, d = S.dt || 1 / 30;
  // Trails and exposure fade with panel time, so they keep their length in
  // LEDs at any Speed.
  const ft = exp(-d / TRAIL), fe = exp(-d / EXPO);
  for (let i = 0; i < NPX * 3; i++) tr[i] *= ft;
  for (let i = 0; i < NPX * 2; i++) ex[i] *= fe;
  // Each eigenvalue draws a line back to the nearest of last frame's, and
  // drops a little light into the long exposure, which builds up the
  // ellipse's even density and the line of real eigenvalues.
  for (let k = 0; k < n; k++) {
    const x = S.px[k], y = S.py[k], o = S.re[k] ? 3 : 0;
    let best = 1e9, bx = x, by = y;
    for (let j = 0; j < S.qn; j++) {
      const dx = S.qx[j] - x, dy = S.qy[j] - y, e = dx * dx + dy * dy;
      if (e < best) (best = e), (bx = S.qx[j]), (by = S.qy[j]);
    }
    if (best > 100) (bx = x), (by = y);
    const m = Math.ceil(sqrt((bx - x) ** 2 + (by - y) ** 2) * 2) || 1;
    for (let e = 0; e <= m; e++) splat(tr, bx + ((x - bx) * e) / m, by + ((y - by) * e) / m, P[o] * 0.8, P[o + 1] * 0.8, P[o + 2] * 0.8, 1.6);
    const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy, ch = S.re[k] ? 1 : 0;
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const xx = ix + dx, yy = iy + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        ex[(yy * W + xx) * 2 + ch] += (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * d * (ch ? 3 : 24);
      }
  }
  // The law: the ellipse with half-axes 1 + tau and 1 - tau, a thin line.
  const sc = RPX / (1 + S.tau), ah = (1 - S.tau) * sc, bh = (1 + S.tau) * sc;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3;
      let R = tr[o], G = tr[o + 1], B = tr[o + 2];
      // Exposure, through a soft knee so a busy spot does not burn out.
      const e0 = ex[p * 2], e1 = ex[p * 2 + 1];
      const k0 = 0.4 * (1 - exp(-e0 * 1.4)), k1 = 0.5 * (1 - exp(-e1 * 1.2));
      R += P[6] * k0 + P[9] * k1;
      G += P[7] * k0 + P[10] * k1;
      B += P[8] * k0 + P[11] * k1;
      // Distance to the ellipse, roughly in LEDs.
      const u = (x + 0.5 - CX) / max(ah, 0.3), v = (y + 0.5 - CY) / bh, rr = sqrt(u * u + v * v);
      const gx = u / max(ah, 0.3), gy = v / bh, gl = sqrt(gx * gx + gy * gy) || 1;
      const dist = (abs(rr - 1) * rr) / gl;
      if (dist < 1.2 && ah > 1) {
        const a = 0.3 * (1 - dist / 1.2);
        R += P[12] * a;
        G += P[13] * a;
        B += P[14] * a;
      }
      (rgb[o] = R), (rgb[o + 1] = G), (rgb[o + 2] = B);
    }
  // Sparks where a pair met on the axis: a short bar across the axis that
  // shrinks as it fades, in the colour of what was born there.
  for (const f of S.flash) {
    const u = f.age / SPARK, a = (1 - u) * (1 - u), o = f.real ? 3 : 0, half = 4.5 * (1 - u) + 1;
    const iy = floor(f.y);
    for (let dy = -1; dy <= 1; dy++) {
      const yy = iy + dy;
      if (yy < 0 || yy >= H) continue;
      for (let xx = floor(CX - half); xx < CX + half; xx++) {
        if (xx < 0 || xx >= W) continue;
        const w = a * (dy ? 0.45 : 1) * min(1, half - abs(xx + 0.5 - CX) + 0.5), q = (yy * W + xx) * 3;
        for (let e = 0; e < 3; e++) rgb[q + e] += (0.6 + P[o + e]) * w;
      }
    }
  }
  for (let k = 0; k < n; k++) {
    const x = S.px[k], y = S.py[k], o = S.re[k] ? 3 : 0;
    const ix = floor(x - 0.5), iy = floor(y - 0.5);
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const xx = ix + dx, yy = iy + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const q = (yy * W + xx) * 3;
        for (let e = 0; e < 3; e++) rgb[q + e] = max(rgb[q + e], 0.45 + P[o + e] * 0.6);
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * min(1, rgb[o])) | 0, (255 * min(1, rgb[o + 1])) | 0, (255 * min(1, rgb[o + 2])) | 0);
}
