// ===== Patternflow pattern =====
// Title:   Mitosis
// Family:  microbe
// Idea:    A confocal immunofluorescence micrograph of a cell culture on black, DNA blue, microtubules green, actin red and centrosomes yellow, where each cell crawls and grows, then rounds up, lines its chromosomes on the plate between two spindle poles, pulls them apart and pinches in two at a red contractile ring, leaving a green midbody bridge between daughters that drift apart.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after immunofluorescence micrographs of dividing cells
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Stain=0..1, Speed=0.2..3, Cells=9..17, Zoom=0..1
//
// Knob 1: Stain. The dyes and their colours. At 0 the classic merge: DAPI blue DNA, green tubulin, red actin and yellow centrosomes. Turning it swaps them round, red tubulin against green actin at a third and magenta tubulin with yellow actin on cyan DNA at two thirds; at 1 the tubulin is yellow and the actin magenta, on violet DNA.
// Knob 2: Speed. At 2 a cell runs its whole cycle in about 30 seconds, half of it in mitosis; 0.2 is ten times slower.
// Knob 3: Cells. How many cells share the field, from 9 to 17. When a division leaves one too many, the most crowded interphase cell lifts out of the focal plane and fades; when one is missing, a new cell settles in.
// Knob 4: Zoom. The objective, from the whole field at 0 to about twice the magnification at 1, where single spindle fibres and chromosomes show.
// Buttons: K1 tap sends the interphase cell nearest the middle into prophase now.

const W = 64, H = 128, N = W * H, TAU = 2 * Math.PI, NCH = 8;
const { min, max, floor, ceil, round, sin, cos, sqrt, exp, abs, atan2, PI } = Math;
const hypot = (a, b) => sqrt(a * a + b * b);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// A 64x64 tile of value noise that wraps, for chromatin.
const NT = new Float32Array(4096);
for (let k = 0; k < 4096; k++) {
  const x = ((k & 63) * 16) / 64, y = ((k >> 6) * 16) / 64, xi = floor(x), yi = floor(y), u = x - xi, v = y - yi;
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), a = hash(xi, yi), b = hash((xi + 1) % 16, yi), c = hash(xi, (yi + 1) % 16), d = hash((xi + 1) % 16, (yi + 1) % 16);
  NT[k] = a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
function nz(x, y) {
  const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi, x0 = xi & 63, y0 = (yi & 63) * 64, x1 = (xi + 1) & 63, y1 = ((yi + 1) & 63) * 64;
  return mix(mix(NT[y0 + x0], NT[y0 + x1], fx), mix(NT[y1 + x0], NT[y1 + x1], fx), fy);
}

// The cycle, as fractions of it: daughters spread, interphase, prophase,
// prometaphase, metaphase, anaphase, telophase to the split at 1.
const P1 = 0.1, P2 = 0.5, P3 = 0.6, P4 = 0.67, P5 = 0.79, P6 = 0.86;

// Dye hues in degrees: DNA, tubulin, actin, centrosome.
const STAINS = [
  [240, 120, 0, 55],
  [228, 352, 125, 185],
  [192, 305, 55, 120],
  [262, 60, 318, 170],
];
const hueRGB = (h, out, o) => {
  for (let j = 0; j < 3; j++) {
    const k = (((5 - 2 * j) + h / 60) % 6 + 6) % 6;
    out[o + j] = 1 - max(0, min(k, 4 - k, 1));
  }
};

// One buffer per dye (actin, tubulin, DNA, centrosome) and one for the body
// haze. LIN holds the merged colour and BL its blur for the glow; TMP is scratch.
const SA = new Float32Array(N), ST = new Float32Array(N), SD = new Float32Array(N), SC = new Float32Array(N), HZ = new Float32Array(N);
const LIN = new Float32Array(N * 3), BL = new Float32Array(N * 3), TMP = new Float32Array(N * 3);
let Z = 1, TT = 0;

function newCell(x, y, p, B) {
  const c = {
    x, y, vx: 0, vy: 0, a: rnd() * PI, hd: rnd() * TAU, p, rate: 0.85 + 0.3 * rnd(), B: B || 12 + 2 * rnd(),
    sd: floor(rnd() * 9973), w1: rnd() * TAU, w2: rnd() * TAU, w3: rnd() * TAU, nf: 22 + floor(rnd() * 7), cang: rnd() * TAU,
    ox: rnd() * 64, oy: rnd() * 64, tilt: (rnd() - 0.5) * 0.4, al: 1, out: 0, br: 0, bx: 0, by: 0,
    ca: 1, sa: 0, e: 0, rl: 5, kk: 2, pin: 0, wa: 0, hdl: 0, lam: 0, cx: 1, fur: 0, nS: 0, rn: 3, cond: 0, dense: 0, dS: 0, dr: 2,
    Lp: 3, sp: 0, net: 0, ast: 0, chA: 0, sh: 0.5, pf: 0, ip: 0, ft: 0, fa: 0, cu: 0, cv: 0, dup: 0, rad: 10, p1u: 0, p1v: 0, p2u: 0, p2v: 0,
    ch: new Float32Array(NCH * 4), wt: new Float32Array(64), fw: new Float32Array(64), gp: new Float32Array(64),
  };
  for (let j = 0; j < NCH; j++) {
    const r = 0.75 * sqrt(rnd()), q = rnd() * TAU;
    c.ch[j * 4] = r * cos(q);
    c.ch[j * 4 + 1] = r * sin(q);
    c.ch[j * 4 + 2] = ((j + 0.5) / NCH) * 2 - 1 + (rnd() - 0.5) * 0.15;
    c.ch[j * 4 + 3] = rnd() * PI;
  }
  return c;
}

// Where the cell is in its cycle decides its shape and what each dye shows.
function geo(c) {
  const p = c.p, B = c.B, Rm = 0.8 * B;
  let rho = 1, R = Rm, f;
  if (p < P1) (f = sm(0, P1, p)), (rho = 1 - f), (R = mix(0.59 * B, 0.74 * B, f));
  else if (p < P2) (rho = 0), (R = mix(0.74 * B, B, (p - P1) / (P2 - P1)));
  else if (p < P3) (f = sm(P2, P3, p)), (rho = f), (R = mix(B, Rm, f));
  const fa = (c.fa = sm(P5, P6, p)), ft = (c.ft = sm(P6, 1, p));
  let e = 0.3 * R * (1 - rho);
  if (p >= P5) e = p < P6 ? 0.3 * Rm * fa : mix(0.3, 0.58, ft) * Rm;
  c.e = e;
  c.rl = R - 0.45 * e;
  c.kk = (p >= P6 ? mix(0.5, 0.06, ft) : 0.5) * R;
  c.pin = p >= P6 ? 3 * ft * sqrt(ft) : 0;
  c.wa = 0.16 * (1 - rho) + 0.025;
  c.lam = 1 - rho;
  c.cx = mix(0.85, 1.2, rho);
  c.fur = ft;
  c.hdl = c.hd - c.a;
  // Nucleus: whole until the envelope breaks early in prometaphase.
  c.rn = 0.44 * R;
  c.nS = p < P3 ? 1 : 1 - sm(P3, P3 + 0.035, p);
  c.cond = p < P2 || p >= P6 ? 0 : p < P3 ? sm(P2, P3, p) : 1;
  c.dense = p < P1 ? 1 - sm(0, P1, p) : p >= P6 ? 1 : 0;
  c.dS = sm(0.3, 0.8, ft);
  c.dr = mix(0.13, 0.22, ft) * B;
  // Chromosomes gather on the plate; in anaphase the sisters part for the poles.
  c.pf = sm(P3, P4, p);
  c.chA = p < P3 ? 0 : sm(P3, P3 + 0.03, p) * (1 - sm(0.25, 0.7, ft));
  const Lp0 = 0.58 * Rm;
  c.Lp = p < P5 ? Lp0 : p < P6 ? Lp0 + 0.7 * e : mix(0.79, 0.86, ft) * Rm;
  c.sh = p < P5 ? 0.5 : p < P6 ? mix(0.5, c.Lp - 1.4, fa) : c.Lp - 1.4;
  c.sp = p < P3 ? 0 : p < P6 ? sm(P3, P4, p) : 1 - ft;
  c.ip = p < P5 ? 0 : p < P6 ? fa : 1;
  c.net = p < P1 ? mix(0.45, 1, sm(0, P1, p)) : p < P2 ? 1 : p < P3 ? 1 - sm(P2, P3, p) : 0;
  c.ast = p < P2 ? 0 : p < P3 ? sm(P2, P3, p) : 1;
  c.dup = p > 0.4 && p < P3 ? 1 : 0;
  // Centrosome beside the nucleus; in prophase the pair travels round it to the poles.
  c.cu = (c.rn + 1) * cos(c.cang);
  c.cv = (c.rn + 1) * sin(c.cang);
  if (p >= P2) {
    const g = p < P3 ? sm(P2, P3, p) : 1;
    c.p1u = mix(c.cu, -c.Lp, g);
    c.p1v = mix(c.cv, 0, g) + sin(g * PI) * (c.rn + 1) * (c.cv < 0 ? -1 : 1);
    c.p2u = mix(c.cu, c.Lp, g);
    c.p2v = mix(c.cv, 0, g) + sin(g * PI) * (c.rn + 1) * (c.cv < 0 ? -1 : 1);
  }
  // The ruffled outline and the leading edge, as a table round the cell.
  for (let k = 0; k < 64; k++) {
    const th = (k * PI) / 32 - PI, fr = max(0, cos(th - c.hdl)), F = fr * fr * c.lam;
    c.fw[k] = F;
    c.gp[k] = 1 - 0.9 * c.lam * sm(0.4, 0.5, 0.5 + 0.28 * sin(3 * th + 2 * c.w2) + 0.22 * sin(7 * th + c.w3));
    c.wt[k] = c.rl * c.wa * (0.5 * sin(2 * th + c.w1) + 0.3 * sin(3 * th + c.w2) + 0.2 * sin(5 * th + c.w3 + TT * 0.35) + 0.9 * F);
  }
  c.rad = (c.e + c.rl * (1 + 1.6 * c.wa) + 2) * Z;
  c.ca = cos(c.a);
  c.sa = sin(c.a);
}

// What shapeD found at the last point it was asked about, kept for drawCell.
// A typed array, so writing it for every LED makes no garbage.
const G = new Float64Array(3);
// Signed distance to the cell's outline in its own frame: two discs joined
// smoothly, ruffled, bulging at the leading edge, pinched at the furrow.
function shapeD(c, u, v) {
  const e = c.e, rl = c.rl, kk = c.kk;
  const d1 = hypot(u - e, v) - rl, d2 = hypot(u + e, v) - rl, h = cl(0.5 + (0.5 * (d2 - d1)) / kk, 0, 1);
  let d = mix(d2, d1, h) - kk * h * (1 - h);
  const th = (G[1] = atan2(v, u)), q = (th + PI) * (32 / PI), k = floor(q), f = q - k, k0 = k & 63, k1 = (k + 1) & 63;
  G[0] = mix(c.fw[k0], c.fw[k1], f);
  G[2] = mix(c.gp[k0], c.gp[k1], f);
  d -= mix(c.wt[k0], c.wt[k1], f);
  if (c.pin > 0) d += c.pin * exp(-u * u * 0.4);
  return d;
}

function put(B, x, y, v) {
  if (x >= 0 && x < W && y >= 0 && y < H) {
    const i = y * W + x;
    if (v > B[i]) B[i] = v;
  }
}
// A soft dot at a world point; weights sharpened so lines stay one LED wide.
function dot(B, wx, wy, a) {
  const x = (wx - 32) * Z + 31.5, y = (wy - 64) * Z + 63.5, x0 = floor(x), y0 = floor(y);
  let fx = x - x0, fy = y - y0;
  (fx = fx * fx * (3 - 2 * fx)), (fy = fy * fy * (3 - 2 * fy));
  put(B, x0, y0, a * (1 - fx) * (1 - fy));
  put(B, x0 + 1, y0, a * fx * (1 - fy));
  put(B, x0, y0 + 1, a * (1 - fx) * fy);
  put(B, x0 + 1, y0 + 1, a * fx * fy);
}
// A curve in the cell's frame from (au, av) to (bu, bv) bowed through (mu, mv).
function curve(B, c, au, av, mu, mv, bu, bv, a) {
  const n = max(2, ceil((hypot(mu - au, mv - av) + hypot(bu - mu, bv - mv)) * Z * 2.2));
  for (let k = 0; k <= n; k++) {
    const t = k / n, s = 1 - t, u = s * s * au + 2 * s * t * mu + t * t * bu, v = s * s * av + 2 * s * t * mv + t * t * bv;
    dot(B, c.x + u * c.ca - v * c.sa, c.y + u * c.sa + v * c.ca, a);
  }
}
const line = (B, c, au, av, bu, bv, a) => curve(B, c, au, av, (au + bu) / 2, (av + bv) / 2, bu, bv, a);

// Microtubules grown out from (u0, v0) until they meet the cortex.
function rays(c, u0, v0, n, ang, spread, len, a, sd) {
  const st = 0.45 / Z;
  for (let i = 0; i < n; i++) {
    const h1 = hash(c.sd + sd, i), h2 = hash(i, c.sd + sd + 7);
    let q = ang + (n > 1 ? ((i + 0.5 * h1) / n - 0.5) * spread : 0), u = u0, v = v0;
    const L = len * (0.7 + 0.45 * h2), curl = (h1 - 0.5) * 0.3, b = a * (0.9 + 0.25 * h2);
    for (let s = 0; s < L; s += st) {
      q += curl * st + 0.12 * sin(s * 0.6 + i * 1.7) * st;
      u += cos(q) * st;
      v += sin(q) * st;
      if (shapeD(c, u, v) > -1.6 - 1.4 * G[0]) break;
      const nq = c.nS > 0.5 ? hypot(u / (c.rn * 1.1), v / (c.rn * 0.92)) : 2;
      // Asters wrap round the nucleus until its envelope breaks.
      if (nq < 1 && sd) break;
      dot(ST, c.x + u * c.ca - v * c.sa, c.y + u * c.sa + v * c.ca, nq < 1 ? b * 0.3 : b);
    }
  }
}

function chromatin(c, u, v, cond) {
  const tu = u * 1.5 + c.ox, tv = v * 1.5 + c.oy;
  let t = mix(0.35 + 0.9 * nz(tu, tv) - 0.6 * exp(-((u - 0.3 * c.rn) ** 2 + (v + 0.2 * c.rn) ** 2) * 0.9), 1.2, c.dense);
  if (cond > 0) t = mix(t, 1.5 * sm(0.14, 0.04, abs(nz(tu * 1.4 + 17, tv * 1.4 + 5) - 0.5)), cond);
  return t;
}

function drawCell(c) {
  const al = c.al, cx = (c.x - 32) * Z + 32, cy = (c.y - 64) * Z + 64, r = c.rad;
  const x0 = max(0, floor(cx - r)), x1 = min(W - 1, ceil(cx + r)), y0 = max(0, floor(cy - r)), y1 = min(H - 1, ceil(cy + r));
  if (x0 > x1 || y0 > y1) return;
  const iz = 1 / Z, rn = c.rn, na = rn * 1.1, nb = rn * 0.92, r2 = r * r;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r2) continue;
      const dx = (x + 0.5 - cx) * iz, dy = (y + 0.5 - cy) * iz, u = dx * c.ca + dy * c.sa, v = -dx * c.sa + dy * c.ca;
      const d = shapeD(c, u, v);
      if (d > 0.8) continue;
      const i = y * W + x;
      // Actin: the cortex, broad at the leading edge, and the ring at the furrow.
      const fr = G[0], th = G[1];
      let A = sm(-1.2, -0.7, d) * sm(0.35, -0.15, d) * c.cx * G[2];
      if (fr > 0.05) A = max(A, fr * sm(-2.6, -1.9, d) * sm(0.35, -0.15, d) * (0.55 + 0.6 * nz(th * 20.372 + c.oy, c.ox + d)));
      if (c.lam > 0.05 && d < -1.2) {
        // Stress fibres along the cell's long axis, some broken off short.
        const q = (v + c.tilt * u) / 2.7 + c.ox, k = floor(q + 0.5), h = hash(c.sd + 11, k), e = (hash(k, c.sd) - 0.5) * c.rl;
        if (h > 0.55 && abs(u - e) < c.rl * (0.3 + 0.7 * h) && hypot(u / na, v / nb) > 1.15) A = max(A, c.lam * sm(0.62, 0.22, abs(q - k) * 2.7) * sm(-1.2, -2.2, d));
      }
      if (c.fur > 0) A = max(A, 1.3 * c.fur * exp(-u * u * 1.4) * sm(0.3, -0.5, d));
      if (A * al > SA[i]) SA[i] = A * al;
      if (d < 0 && al > HZ[i]) HZ[i] = al * sm(0.5, -2, d);
      // DNA: an interphase nucleus, or the two that reform in telophase.
      let D = 0;
      if (c.nS > 0) {
        const dn = (hypot(u / na, v / nb) - 1) * nb;
        if (dn < 0.6) D = sm(0.55, -0.45, dn) * c.nS * chromatin(c, u, v, c.cond);
      }
      if (c.dS > 0) {
        const dn = hypot(abs(u) - c.e, v) - c.dr;
        if (dn < 0.6) D = max(D, sm(0.55, -0.45, dn) * c.dS * chromatin(c, abs(u) - c.e, v, c.cond));
      }
      if (D * al > SD[i]) SD[i] = D * al;
    }
  const p = c.p, Rm = 0.8 * c.B;
  // Interphase network from the centrosome.
  if (c.net > 0.02) rays(c, c.cu, c.cv, c.nf, c.cang, TAU, c.net * 1.6 * c.rl, al, 0);
  if (p < P2) {
    dot(SC, c.x + c.cu * c.ca - c.cv * c.sa, c.y + c.cu * c.sa + c.cv * c.ca, 1.2 * al);
    if (c.dup) dot(SC, c.x + (c.cu + 0.8) * c.ca - c.cv * c.sa, c.y + (c.cu + 0.8) * c.sa + c.cv * c.ca, 1.2 * al);
  } else {
    // Asters, and the spindle between its poles.
    const spr = mix(TAU, 2.2, c.sp), la = c.ast * c.rl * 1.2;
    rays(c, c.p1u, c.p1v, 9, PI, spr, la, al, 3);
    rays(c, c.p2u, c.p2v, 9, 0, spr, la, al, 5);
    dot(SC, c.x + c.p1u * c.ca - c.p1v * c.sa, c.y + c.p1u * c.sa + c.p1v * c.ca, 1.25 * al);
    dot(SC, c.x + c.p2u * c.ca - c.p2v * c.sa, c.y + c.p2u * c.sa + c.p2v * c.ca, 1.25 * al);
    const hw = 0.42 * Rm, ch = c.ch, pf = c.pf * c.pf * (3 - 2 * c.pf);
    for (let j = 0; j < NCH; j++) {
      const cu = mix(ch[j * 4] * c.rn, 0.25 * sin(TT * 3.5 + j), pf), cv = mix(ch[j * 4 + 1] * c.rn, ch[j * 4 + 2] * hw, pf), o = mix(ch[j * 4 + 3], PI / 2, pf);
      for (let s = -1; s <= 1; s += 2) {
        const su = cu + s * c.sh * mix(-sin(o), 1, pf), sv = cv + s * c.sh * mix(cos(o), 0, pf);
        if (c.sp > 0.02) curve(ST, c, s * c.Lp, 0, (s * c.Lp + su) / 2, sv * 1.3, su, sv, c.sp * al * 0.95);
        if (c.chA > 0.02) {
          // Sister chromatids, arms trailing back toward the plate in anaphase.
          const tr = c.fa, du = mix(cos(o), -s * 0.9, tr) * 1.1, dv = mix(sin(o), 0.45 * (cv < 0 ? -1 : 1), tr) * 1.1;
          line(SD, c, su - du * (1 - tr), sv - dv * (1 - tr), su + du, sv + dv, 1.3 * c.chA * al);
        }
      }
    }
    // Central spindle, gathered into the midbody as the furrow closes.
    if (c.ip > 0.02) {
      const x = max(1.4, (c.sh - 0.8) * (1 - c.ft) + 1.6 * c.ft);
      for (let k = -1; k <= 1; k++) line(ST, c, -x, k * 1.1 * (1 - c.ft), x, k * 1.1 * (1 - c.ft), c.ip * al * (k ? 0.85 : 1.1));
    }
  }
  // The midbody bridge back to the sister cell, with its ring.
  if (c.br > 0.02) {
    const dx = c.bx - c.x, dy = c.by - c.y, L = hypot(dx, dy), r0 = c.rl * 0.8;
    if (L > r0) {
      const ux = dx / L, uy = dy / L, n = ceil((L - r0) * Z * 2.2);
      for (let k = 0; k <= n; k++) dot(ST, c.x + ux * (r0 + ((L - r0) * k) / n), c.y + uy * (r0 + ((L - r0) * k) / n), c.br * al);
      dot(SA, c.bx, c.by, 1.2 * c.br * al);
    }
  }
}

export function setup(params) {
  params.s = { cells: [], t: 0, k1: -1, pal: new Float32Array(12), cool: 0, n: 0 };
}

// The emptiest spot in the field: best of a dozen tries.
function freeSpot(S) {
  let bx = 32, by = 64, bd = -1;
  for (let k = 0; k < 14; k++) {
    const x = 6 + rnd() * 52, y = 6 + rnd() * 116;
    let d = min(x + 6, 70 - x, y + 6, 134 - y) * 0.6;
    for (const c of S.cells) d = min(d, hypot(c.x - x, c.y - y));
    if (d > bd) (bd = d), (bx = x), (by = y);
  }
  return [bx, by];
}

// Everything here runs on the slide's own clock, ds seconds a step.
function step(S, ds) {
  const cells = S.cells, n = S.n;
  S.t += ds;
  TT = S.t;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    c.p += (ds * c.rate) / 30;
    if (c.br > 0) {
      c.br = c.p < 0.13 ? 1 - sm(0.07, 0.13, c.p) : 0;
      if (hypot(c.bx - c.x, c.by - c.y) > c.rl * 2.4) c.br = max(0, c.br - ds * 2);
    }
    if (c.p >= 1) {
      // Abscission: two daughters, each half the size, moving apart.
      cells.splice(i, 1);
      for (let s = -1; s <= 1; s += 2) {
        const d = newCell(c.x + s * c.e * c.ca, c.y + s * c.e * c.sa, 0, c.B * (0.95 + 0.1 * rnd()));
        (d.vx = s * c.ca * 0.7), (d.vy = s * c.sa * 0.7), (d.br = 1), (d.bx = c.x), (d.by = c.y), (d.al = c.al), (d.out = c.out);
        // Each daughter keeps its centrosome on the far side from its sister.
        d.hd = c.a + (s < 0 ? PI : 0) + (rnd() - 0.5);
        d.cang = c.a + (s < 0 ? PI : 0) - d.a;
        cells.push(d);
      }
      continue;
    }
    // Crawling: interphase cells wander, round cells sit still.
    const crawl = c.lam * 0.7;
    c.hd += (rnd() - 0.5) * ds * 1.2;
    c.vx *= exp(-ds * 0.6);
    c.vy *= exp(-ds * 0.6);
    c.x += (c.vx + cos(c.hd) * crawl) * ds;
    c.y += (c.vy + sin(c.hd) * crawl) * ds;
    // The walls turn a cell back and nudge it in.
    const wx = sm(4, -3, c.x) - sm(60, 67, c.x), wy = sm(4, -3, c.y) - sm(124, 131, c.y);
    if (wx || wy) {
      c.hd = atan2(sin(c.hd) + wy * ds * 3, cos(c.hd) + wx * ds * 3);
      (c.x += wx * ds * 2), (c.y += wy * ds * 2);
    }
    if (c.out) c.al -= ds * 0.45;
    else c.al = min(1, c.al + ds * 0.5);
  }
  // Cells push gently apart.
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j], dx = b.x - a.x, dy = b.y - a.y, d = hypot(dx, dy) + 1e-6, m = 0.8 * (a.rl + b.rl + a.e + b.e);
      if (d < 1.8 * m) {
        const f = (((d < m ? m - d : 0) * 0.5 + (1.8 * m - d) * 0.15) / d) * ds;
        (a.x -= dx * f), (a.y -= dy * f), (b.x += dx * f), (b.y += dy * f);
      }
    }
  for (let i = cells.length - 1; i >= 0; i--) if (cells[i].al <= 0 && cells[i].out) cells.splice(i, 1);
  // Keep the count: a crowded interphase cell lifts away, or a new one settles in.
  let live = 0;
  for (const c of cells) live += c.out ? 0 : 1;
  S.cool -= ds;
  if (live > n && (S.cool <= 0 || live > n + 1)) {
    let best = null, bs = -1;
    for (const a of cells) {
      if (a.out || a.p < 0.14 || a.p > P2 - 0.04) continue;
      let s = 0;
      for (const b of cells) if (b !== a) s += max(0, a.rl + b.rl - hypot(a.x - b.x, a.y - b.y));
      s += max(0, 10 - min(a.x, 64 - a.x, a.y, 128 - a.y));
      if (s > bs) (bs = s), (best = a);
    }
    if (best) (best.out = 1), (S.cool = 0.8);
  } else if (live < n && S.cool <= 0) {
    const [x, y] = freeSpot(S), c = newCell(x, y, 0.12 + 0.6 * rnd());
    c.al = 0;
    cells.push(c);
    S.cool = 0.5;
  }
  for (const c of cells) geo(c);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 9, 0.06], speed = cl(k[1], 0.2, 3);
  S.n = round(cl(k[2], 9, 17));
  Z = 1 + 1.15 * cl(k[3], 0, 1) ** 1.3;
  if (k[0] !== S.k1) {
    const s = cl(k[0], 0, 1) * 3, i = min(2, floor(s)), f = sm(0, 1, s - i);
    for (let j = 0; j < 4; j++) {
      let a = STAINS[i][j], b = STAINS[i + 1][j];
      if (b - a > 180) a += 360;
      if (a - b > 180) b += 360;
      hueRGB(mix(a, b, f), S.pal, j * 3);
    }
    S.k1 = k[0];
  }
  if (!S.cells.length) {
    for (let i = 0; i < S.n; i++) {
      const [x, y] = freeSpot(S);
      S.cells.push(newCell(x, y, (i + 0.8 * rnd()) / S.n));
    }
    for (const c of S.cells) geo(c);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    let best = null, bd = 1e9;
    for (const c of S.cells) {
      const d = hypot(c.x - 32, c.y - 64);
      if (!c.out && c.p > P1 && c.p < P2 && d < bd) (bd = d), (best = c);
    }
    if (best) best.p = P2;
  }
  step(S, cl(dt || 0, 0, 0.1) * speed * 0.5);
}

// Box blur of radius 2 across and then down, for the glow.
function blur(src, dst) {
  for (let y = 0; y < H; y++)
    for (let ch = 0; ch < 3; ch++) {
      let s = 0;
      const o = y * W * 3 + ch;
      for (let x = -2; x < W; x++) {
        if (x + 2 < W) s += src[o + (x + 2) * 3];
        if (x - 3 >= 0) s -= src[o + (x - 3) * 3];
        if (x >= 0) dst[o + x * 3] = s / 5;
      }
    }
  for (let x = 0; x < W; x++)
    for (let ch = 0; ch < 3; ch++) {
      let s = 0;
      const o = x * 3 + ch;
      for (let y = -2; y < H; y++) {
        if (y + 2 < H) s += dst[o + (y + 2) * W * 3];
        if (y - 3 >= 0) s -= dst[o + (y - 3) * W * 3];
        if (y >= 0) src[o + y * W * 3] = s / 5;
      }
    }
}

// Hard knee: a dye is either lit near full or left under the glow.
const knee = (v) => (v <= 0.28 ? 0 : v >= 0.52 ? 255 : 255 * sm(0.28, 0.52, v));

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cells.length) return;
  SA.fill(0), ST.fill(0), SD.fill(0), SC.fill(0), HZ.fill(0);
  TT = S.t;
  for (const c of S.cells) drawCell(c);
  const P = S.pal;
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const a = SA[i], t = ST[i], d = SD[i], z = SC[i];
    if (a + t + d + z === 0) {
      LIN[o] = LIN[o + 1] = LIN[o + 2] = BL[o] = BL[o + 1] = BL[o + 2] = 0;
      continue;
    }
    LIN[o] = BL[o] = min(1, a * P[6] + t * P[3] + d * P[0] + z * P[9]);
    LIN[o + 1] = BL[o + 1] = min(1, a * P[7] + t * P[4] + d * P[1] + z * P[10]);
    LIN[o + 2] = BL[o + 2] = min(1, a * P[8] + t * P[5] + d * P[2] + z * P[11]);
  }
  blur(BL, TMP);
  // The glow and a faint body haze stay under 21, below what counts as lit.
  const h0 = 13 * P[3], h1 = 13 * P[4], h2 = 13 * P[5];
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const h = HZ[i];
    display.setPixel(
      i & 63,
      i >> 6,
      max(knee(LIN[o]), min(21, 24 * BL[o] + h * h0)) | 0,
      max(knee(LIN[o + 1]), min(21, 24 * BL[o + 1] + h * h1)) | 0,
      max(knee(LIN[o + 2]), min(21, 24 * BL[o + 2] + h * h2)) | 0,
    );
  }
}
