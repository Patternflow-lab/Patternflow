// ===== Patternflow pattern =====
// Title:   McMullen Carpet
// Family:  fractal
// Idea:    A Bedford-McMullen self-affine carpet fills the panel: the square is cut into m columns and n > m rows, a few cells are kept and the same cut repeats inside each, every LED is shaded by how much of it stays kept level after level, and the view zooms m times across and n times down into one kept cell until the picture comes back exactly, which an even zoom never does.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: self-affine carpets (Tim Bedford, 1984; Curtis T. McMullen, 1984), pattern round 65
// Round:   65
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pattern=0..5, Iso=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the points that stay in the kept cells all the way down are near white, the holes cut at deeper levels step from dark blue through teal to pale cyan, the holes cut at the first level are black, and the two dimensions in the corner are pale gold. The holes skip orange, which reads brown when dark.
// Knob 2: Speed. How fast the view zooms. At 2 one level, m times across and n times down, takes 3 s; at 0.2 30 s and at 3 2 s. Each level dives into a kept cell picked at random, and since the picture at the end of a level is the picture at its start, the dive never jumps.
// Knob 3: Pattern. Six carpets, m columns across and n rows down, n always on the long side. The corner gives the Hausdorff dimension, log_m of the sum over columns of t_j^(log_n m) with t_j the kept cells in column j (McMullen), over the box dimension log_m r + log_n(N / r) with r the columns that keep a cell and N the kept cells. 0: 2 x 3, t = 3, 1, 1.585 (log_2 3) and 1.631. 1: 3 x 4, t = 4, 1, 2, 1.589 and 1.611. 2: 2 x 3, t = 2, 1, 1.350 and 1.369. 3: 3 x 5, t = 5, 1, 2, 1.569 and 1.609. 4: 2 x 6, t = 5, 1, 1.518 and 1.613. 5: 2 x 4, t = 2, 2, every column keeping the same number, and both are 1.500.
// Knob 4: Iso. Up to 0.1 the zoom is the affine one, m^t across and n^t down, and repeats every level. Above it the vertical rate slides from n towards m, so at 1 the zoom is the same in both directions: the picture never comes back, the carpet flattens into wide bands, and after two levels the view fades and starts again from the whole square.

const W = 64, H = 128;
const { floor, min, max, log, pow, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The carpets: m columns across, n rows down, rows written top to bottom,
// X for a kept cell.
const PATTERNS = [
  { m: 2, n: 3, rows: ["X.", "XX", "X."] },
  { m: 3, n: 4, rows: ["X.X", "XX.", "X..", "X.X"] },
  { m: 2, n: 3, rows: ["X.", ".X", "X."] },
  { m: 3, n: 5, rows: ["X.X", "X..", "XX.", "X.X", "X.."] },
  { m: 2, n: 6, rows: ["X.", "X.", ".X", "X.", "X.", "X."] },
  { m: 2, n: 4, rows: ["X.", ".X", "X.", ".X"] },
];

// Dimensions of one carpet. The column counts t_j go over the m columns,
// the strips of the weaker contraction 1/m.
function dims(P) {
  const { m, n, rows } = P, t = new Array(m).fill(0);
  let N = 0;
  for (let b = 0; b < n; b++) for (let a = 0; a < m; a++) if (rows[b][a] === "X") t[a]++, N++;
  const th = log(m) / log(n);
  let s = 0, r = 0;
  for (const x of t) if (x) (s += pow(x, th)), r++;
  return { t, N, r, haus: log(s) / log(m), box: log(r) / log(m) + log(N / r) / log(n) };
}

// The holes are dark, and a dark orange reads brown on the panel, so their
// hues go round a wheel with orange (0.03 to 0.16) cut out.
const wheel = (h) => 0.16 + (h - floor(h)) * 0.87;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// Samples per LED: 2 across and 4 down, since the cells flatten as they
// shrink and the vertical detail runs out first.
const SX = 2, SY = 4, CS = W * SX, RS = H * SY, KMAX = 12, PAL = 32;

export function setup(params) {
  params.s = {
    pat: -1, P: null, D: null, info: null,
    t: 0, cell: [0, 0], iso: 0, fade: 1, hue: 0, speed: 2,
    xa: new Uint8Array(CS * KMAX), yb: new Uint8Array(RS * KMAX),
    lev: new Float32Array(W * H * 3), pal: new Float32Array(3 * (PAL + 1)),
    cs: new Float32Array(3 * KMAX), bl: new Float32Array(3 * KMAX), mean: new Float32Array(6), tmp: new Float32Array(3), L0: 4,
  };
}

function choose(S, k) {
  S.pat = k;
  const P = PATTERNS[k];
  S.P = P;
  S.D = new Uint8Array(P.m * P.n);
  S.kept = [];
  for (let b = 0; b < P.n; b++) for (let a = 0; a < P.m; a++) if (P.rows[b][a] === "X") (S.D[a * P.n + b] = 1), S.kept.push([a, b]);
  S.info = dims(P);
  // At t = 0 the digits run until a cell is about one and a half samples
  // tall; the shades are spread over that many levels and one more.
  S.L0 = log(RS / 1.5) / log(P.n);
  S.t = 0;
  S.fade = 1;
  pick(S);
}

// The next level dives into a kept cell picked at random, preferring one
// off the top and bottom rows so the dive stays on the panel's middle.
function pick(S) {
  const n = S.P.n, inner = S.kept.filter(([, b]) => b > 0 && b < n - 1);
  const pool = inner.length ? inner : S.kept;
  S.cell = pool[floor(Math.random() * pool.length)];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const k = cl(round(kv[2]), 0, PATTERNS.length - 1);
  if (k !== S.pat) choose(S, k);
  S.iso = kv[3] <= 0.1 ? 0 : cl((kv[3] - 0.1) / 0.9, 0, 1);
  S.t += (d * S.speed) / 6;
  if (S.iso === 0) {
    S.fade = min(1, S.fade + d * 3);
    if (S.t >= 1) {
      S.t -= 1;
      pick(S);
    }
  } else {
    // The even zoom does not come back to its start, so it runs two levels
    // and fades out, and the whole square fades back in.
    const T = 2;
    S.fade = S.t < 0.12 ? S.t / 0.12 : S.t > T - 0.25 ? max(0, (T - S.t) / 0.25) : 1;
    if (S.t >= T) {
      S.t = 0;
      pick(S);
    }
  }
}

// 3 x 5 digits and the letters the corner needs.
const GL = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111",
  ".": "000000000000010", H: "101101111101101", B: "110101110101110", " ": "000000000000000",
};

function text(buf, s, x0, y0, r, g, b) {
  for (let i = 0; i < s.length; i++) {
    const m = GL[s[i]];
    if (!m) continue;
    const w = s[i] === "." ? 2 : 4, dx = s[i] === "." ? -1 : 0;
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 3; x++)
        if (m[y * 3 + x] === "1") {
          const o = ((y0 + y) * W + x0 + x + dx) * 3;
          buf[o] = r;
          buf[o + 1] = g;
          buf[o + 2] = b;
        }
    x0 += w;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.P) return;
  const { m, n } = S.P, t = S.t, D = S.D, xa = S.xa, yb = S.yb, pal = S.pal, buf = S.lev;
  const [a, b] = S.cell;
  // The zoom's centre is the fixed point of the map into cell (a, b),
  // (x, y) -> ((x + a) / m, (y + b) / n): x* = a / (m - 1), y* = b / (n - 1).
  const fx = a / (m - 1), fy = b / (n - 1);
  const sx = pow(m, -t), sy = pow(n, -t * (1 - S.iso)) * pow(m, -t * S.iso);
  // Base-m digits of every column sample and base-n digits of every row
  // sample, KMAX deep. A sample is in the level-k carpet when its first k
  // digit pairs are all kept cells.
  for (let c = 0; c < CS; c++) {
    let x = fx + ((c + 0.5) / CS - fx) * sx;
    x = cl(x, 0, 1 - 1e-12);
    for (let k = 0; k < KMAX; k++) {
      const dgt = floor(x * m);
      xa[c * KMAX + k] = dgt;
      x = x * m - dgt;
    }
  }
  for (let r = 0; r < RS; r++) {
    let y = fy + ((r + 0.5) / RS - fy) * sy;
    y = cl(y, 0, 1 - 1e-12);
    for (let k = 0; k < KMAX; k++) {
      const dgt = floor(y * n);
      yb[r * KMAX + k] = dgt;
      y = y * n - dgt;
    }
  }
  // Shading. A sample that leaves the kept cells at level e is a hole cut
  // e levels down, and the level is read t levels down, v = e - t, so at
  // t = 1 every value is what it was at t = 0 and the loop has no seam.
  // Below the level whose cells are a sample tall the digits stop: the
  // sample takes the mean shade of what a kept cell holds, since a share
  // rho = N / (m n) of its area stays kept at every further level. Two stop
  // levels are blended so the stop never pops.
  const h0 = S.hue + 0.42, VC = S.L0 + 1, rho = S.info.N / (m * n);
  for (let q = 0; q <= PAL; q++) {
    const v = (q / PAL) * VC, u = v / VC;
    if (q === PAL) hsv(wheel(h0 - 0.02), 0.12, 1, pal, q * 3);
    else hsv(wheel(h0 + 0.06 - 0.1 * u), 0.8 - 0.5 * u, v < 0.02 ? 0 : 0.1 + 0.75 * pow(u, 0.9), pal, q * 3);
  }
  const shade = (v, out, o) => {
    const p = v <= 0 ? 0 : v >= VC ? PAL : (v / VC) * PAL;
    const q0 = floor(p), fr = p - q0, q1 = min(PAL, q0 + 1);
    out[o] = pal[q0 * 3] * (1 - fr) + pal[q1 * 3] * fr;
    out[o + 1] = pal[q0 * 3 + 1] * (1 - fr) + pal[q1 * 3 + 1] * fr;
    out[o + 2] = pal[q0 * 3 + 2] * (1 - fr) + pal[q1 * 3 + 2] * fr;
  };
  const Lf = log(RS / (1.5 * sy)) / log(n);
  const ks = min(KMAX - 2, max(1, floor(Lf))), kf = cl(Lf - ks, 0, 1), cs = S.cs, mean = S.mean;
  for (let e = 0; e <= ks + 1; e++) shade(e - t, cs, e * 3);
  for (let L = ks; L <= ks + 1; L++) {
    let R = 0, G = 0, B = 0, w = 1;
    for (let j = 0; j < 24; j++) {
      const pj = j === 23 ? w : w * (1 - rho);
      shade(L + j - t, S.tmp, 0);
      R += S.tmp[0] * pj;
      G += S.tmp[1] * pj;
      B += S.tmp[2] * pj;
      w *= rho;
    }
    mean[(L - ks) * 3] = R;
    mean[(L - ks) * 3 + 1] = G;
    mean[(L - ks) * 3 + 2] = B;
  }
  // The colour of a sample that stays in e levels: below ks the mean if it
  // got that far, the hole if not; the same at ks + 1; then the blend.
  const f = S.fade / (SX * SY), k2 = ks + 1, bl = S.bl;
  for (let e = 0; e <= k2; e++)
    for (let c = 0; c < 3; c++) {
      const v0 = e < ks ? cs[e * 3 + c] : mean[c], v1 = e < k2 ? cs[e * 3 + c] : mean[3 + c];
      bl[e * 3 + c] = (v0 + (v1 - v0) * kf) * f;
    }
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      let R = 0, G = 0, B = 0;
      for (let j = 0; j < SY; j++) {
        const yo = (py * SY + j) * KMAX;
        for (let i = 0; i < SX; i++) {
          const xo = (px * SX + i) * KMAX;
          let e = 0;
          while (e < k2 && D[xa[xo + e] * n + yb[yo + e]]) e++;
          R += bl[e * 3];
          G += bl[e * 3 + 1];
          B += bl[e * 3 + 2];
        }
      }
      const o = (py * W + px) * 3;
      buf[o] = R;
      buf[o + 1] = G;
      buf[o + 2] = B;
    }
  // The two dimensions, Hausdorff over box, on a dark plate in the corner.
  const hs = "H" + S.info.haus.toFixed(3), bs = "B" + S.info.box.toFixed(3);
  for (let y = H - 15; y < H; y++)
    for (let x = 0; x < 25; x++) {
      const o = (y * W + x) * 3;
      buf[o] *= 0.2;
      buf[o + 1] *= 0.2;
      buf[o + 2] *= 0.2;
    }
  const tc = [0, 0, 0];
  hsv(S.hue + 0.12, 0.45, 0.95, tc, 0);
  text(buf, hs, 2, H - 14, tc[0], tc[1], tc[2]);
  text(buf, bs, 2, H - 7, tc[0] * 0.8, tc[1] * 0.8, tc[2] * 0.8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, buf[o] | 0, buf[o + 1] | 0, buf[o + 2] | 0);
    }
}
