// ===== Patternflow pattern =====
// Title:   Finger Rafting
// Family:  nilas
// Idea:    Seen from above, four or five sheets of young sea ice meet along oblique seams, where one seam opens into a black lead that freezes over from steel blue to grey-white and the next closes, and the two sheets slide over each other in alternate interleaved tongues, wider the thicker the ice, double thick and brighter where they lie on each other.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: finger rafting of nilas under convergence (Weeks and Anderson, 1958, who described it; Parmerter, 1975, who gave a wavelength that grows about as thickness to the 1.5; both from memory, the exponent is the only number I am sure of); the WMO names nilas, young ice and lead; ice thickening as the square root of freezing degree days (Stefan, 1891). The model, the numbers and the colours are original, pattern round 268.
// Round:   268
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0.8..4, Cold=-1..1, Drift=-1..1
//
// Knob 1: Hue. Turns the whole palette once round the wheel with luma kept, so the open sea and the thin ice go through jewel tones and the thick ice through pastel ones. 0 and 1 are the icy steel blue and white it opens on, 0.25 forest green under pale lime ice, 0.5 wine red under peach, 0.75 violet. A dark colour that would land among the browns is pushed on to forest green or wine.
// Knob 2: Wind. How hard the pack is pushed. The sites wander 0.79, 1 and 1.33 times as far at 0.8, 2 and 4, and 0.85, 1 and 1.17 times as fast, and the whole pack drifts 0.28 LED a second times the speed. The median open seam is 8, 9.5 and 11.7 LED wide at 0.8, 2 and 4 and the median overlap 7.6, 9.3 and 12 (at most 17 for a lead and 18 of overlap, which is a band up to 30 LED across), and a gap changes about 0.4, 0.55 and 0.7 LED a second at its median, 1.4, 2 and 3 at its fastest.
// Knob 3: Cold. How fast it freezes. The colour thickness of the plates and of new ice goes as exp(0.28 K3), 0.76 at -1 and 1.32 at 1, and the finger wavelength goes as the thickness of the thinner sheet to the 1.5 with exp(0.6 K3) on it: its median over 600 s is 8.8, 10.8 and 15.8 LED at -1, 0 and 1, so tongues about 4, 5 and 8 LED wide, and up to 12 where two thick sheets meet. New ice in a lead thickens as the square root of its age, after 5 s of open water: 0.2 of a unit after 30 s, 0.5 after 150 s, at Cold 0.
// Knob 4: Drift. The direction the sheets slide along each other compared with the seam. At 0 the tongues stand square to it, and at -1 and 1 every one leans 45 degrees one way or the other (each seam adds up to 7 degrees of its own, on a slow sine). The pack also drifts along a direction 1.2 radians off per unit of the knob, so plates keep moving in at another edge and the picture a minute on is a different one.
//
// What the picture is. A tall panel of sea ice in the polar night with the dark of the open water between. Four or five plates of different thickness, each from dark steel blue through pale grey-blue to cool white, with soft mottling and a few blurred frost flowers on the thinnest. Their seams run oblique and bend a little, and three plates meet at each junction. Along an opening seam is a black lead with ice growing in from both edges, the plate edges lit on the side facing the top left. Along a closing seam is a band of finger rafting: tongues of both sheets lie on each other, round-tipped and of different lengths, a thin raised rim round each, the band double thick and brighter, wide tongues where the ice is thick and narrow where it is thin.
// What is modelled. Sites on a stretched, jittered triangular lattice carry plates; each plate is the Voronoi cell of its site, and the gap across a seam is how far its two sites are from where they touch, so a seam is open when that is above 0 and overlapped when it is below. Each site wanders on three incommensurate sines and the lattice drifts and rotates a little, so seams change angle, and plates come in at one edge and leave at the other. A lead keeps the age of every strip of ice in it (new ice at the middle, oldest at the plate edges) and thickens as the square root of the age. The finger wavelength of a seam is fixed by the thickness of the thinner ice it first touched, to the 1.5. The first update runs 110 s of this, and on until a lead and two rafts are in the panel.
// What is made up. The plates are Voronoi cells, which are not rigid bodies, and a seam is where two sites are the same distance from, not where two real edges are. A rafted band is 1.7 times as wide as the overlap once that is over 6 LED (it grows in from nothing between 3 and 6.5), and the tongue lengths, widths, slant, edge lines and raised tips are drawn, not computed. All gaps, speeds, periods, the lattice, the tone of each plate and its slow drift, the 600 s it takes new ice to reach one unit of thickness, and every colour. The wavelength has a floor of 7.4 LED so the fingers show at all. A picture of a mechanism, not a floe.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, exp, sin, cos, abs, min, max, PI, atan2 } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const hv = (a, b, c) => {
  let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

const E1 = [51, 19], E2 = [27, -27];            // the lattice, LED
const DET = E1[0] * E2[1] - E1[1] * E2[0];
const WIN = 56;                                 // sites this far outside the panel still count
const NB = 16, DW = 0.5;                        // bins of a lead's age record, LED
const NONE = -1e9;
const GP = 17, GN = 18;
const RK = 0.85;                                // half the width of a rafted band, per LED of overlap                         // widest lead and widest rafted band
const GC = 2.5;                                 // a seam this near shut is drawn as a crack
const T1 = 600;                                 // seconds for new ice to reach one unit of thickness at Cold 0
const ZK = 1.0;                                 // height per unit of thickness, for the shading
const LMIN = 7.4, LMAX = 28;
const AW = [8.5, 5.5, 3.2];                     // how far a site wanders on each of its three sines
const XS = 0.005, LN = 481;

// ---- noise on a 128 LED torus, one cell of the table is one LED
const NT = 128;
function vnoise(nx, ny) {
  const g = new Float32Array(nx * ny);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(NT * NT);
  for (let y = 0; y < NT; y++) {
    const fy = (y * ny) / NT, y0 = floor(fy);
    let ty = fy - y0;
    ty = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % ny) * nx, r1 = ((y0 + 1) % ny) * nx;
    for (let x = 0; x < NT; x++) {
      const fx = (x * nx) / NT, x0 = floor(fx);
      let tx = fx - x0;
      tx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % nx, c1 = (x0 + 1) % nx;
      const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * tx;
      const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * tx;
      out[y * NT + x] = a + (b - a) * ty;
    }
  }
  return out;
}
function fbm(list) {
  const out = new Float32Array(NT * NT);
  for (const [nx, ny, w] of list) {
    const n = vnoise(nx, ny);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * w;
  }
  let m = 0, v = 0;
  for (let i = 0; i < out.length; i++) m += out[i];
  m /= out.length;
  for (let i = 0; i < out.length; i++) v += (out[i] - m) * (out[i] - m);
  const k = 0.2 / sqrt(v / out.length + 1e-9);
  for (let i = 0; i < out.length; i++) out[i] = cl(0.5 + (out[i] - m) * k, 0, 1);
  return out;
}
function samp(f, x, y) {
  const xf = floor(x), yf = floor(y), fx = x - xf, fy = y - yf;
  const x0 = xf & 127, y0 = yf & 127, x1 = (x0 + 1) & 127, y1 = (y0 + 1) & 127;
  const a = f[y0 * NT + x0] + (f[y0 * NT + x1] - f[y0 * NT + x0]) * fx;
  const b = f[y1 * NT + x0] + (f[y1 * NT + x1] - f[y1 * NT + x0]) * fx;
  return a + (b - a) * fy;
}

// ---- colour: thickness x (0 open water, about 1 young ice, 2 and more rafted) to RGB
const RAMP = [
  [0.0, 3, 8, 24], [0.03, 5, 16, 44], [0.1, 12, 42, 84], [0.22, 38, 80, 120], [0.38, 94, 134, 162],
  [0.58, 148, 182, 202], [0.8, 186, 208, 224], [1.1, 216, 230, 242], [1.6, 240, 247, 252], [2.4, 255, 255, 255],
];
// the hue turn keeps luma; a dark colour that would land among the browns is pushed on to forest green or wine
function tint(c, ca, sa) {
  const r = c[0], g = c[1], b = c[2];
  const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
  let I2 = I * ca - Q * sa, Q2 = I * sa + Q * ca;
  const C = sqrt(I2 * I2 + Q2 * Q2), ph = atan2(Q2, I2);
  const wd = ss(-1.4, -1.2, ph) * (1 - ss(0.25, 0.45, ph)) * ss(4, 14, C) * (1 - ss(100, 150, Y));
  if (wd > 0) {
    const t = ph + wd * ((ph < -0.45 ? -1.75 : 0.55) - ph);
    I2 = 1.25 * C * cos(t);
    Q2 = 1.25 * C * sin(t);
  }
  const d0 = 0.956 * I2 + 0.621 * Q2, d1 = -0.272 * I2 - 0.647 * Q2, d2 = -1.106 * I2 + 1.703 * Q2;
  const mx = max(d0, d1, d2), mn = min(d0, d1, d2), s = min(1, 255 / (mx - mn + 1e-6));
  const y = cl(Y, -s * mn, 255 - s * mx);
  c[0] = y + s * d0;
  c[1] = y + s * d1;
  c[2] = y + s * d2;
}
function buildLut(S, hue) {
  const ang = hue * TAU, ca = cos(ang), sa = sin(ang), c = [0, 0, 0];
  let k = 0;
  for (let i = 0; i < LN; i++) {
    const x = i * XS;
    while (k < RAMP.length - 2 && x > RAMP[k + 1][0]) k++;
    const p = RAMP[k], q = RAMP[k + 1], t = cl((x - p[0]) / (q[0] - p[0]), 0, 1);
    for (let j = 0; j < 3; j++) c[j] = p[j + 1] + (q[j + 1] - p[j + 1]) * t;
    if (hue > 0.002 && hue < 0.998) tint(c, ca, sa);
    for (let j = 0; j < 3; j++) S.lut[i * 3 + j] = cl(c[j], 0, 255);
  }
  S.lutHue = hue;
}

// ---- state
export function setup(params) {
  const S = {
    ready: false, ks: [0, 2, 0, 0.06], seed: floor(rnd() * 1e6),
    t: -110, th: 0, rx: 0, ry: 0, Th: 0, frame: 0, amp: 1, rate: 1, Cg: 1, Cc: 1, psi0: 0.05, hue: 0, lutHue: -1,
    sites: new Map(), list: [], pairs: new Map(), PIC: new Array(40 * 40), clean: 0,
    lut: new Float32Array(LN * 3), Z: new Float32Array(N), XE: new Float32Array(N), E: new Float32Array(N),
    img: new Uint8Array(N * 3), sx: new Float64Array(48), sy: new Float64Array(48),
    NL: fbm([[5, 10, 1], [10, 20, 0.6]]), NS: fbm([[12, 24, 1], [24, 48, 0.5]]), NP: fbm([[18, 36, 1], [36, 72, 0.4]]),
  };
  params.s = S;
  return S;
}

function getSite(S, i, j) {
  const id = (i + 512) * 1024 + (j + 512);
  let s = S.sites.get(id);
  if (s) return s;
  const h = (c) => hv(id, S.seed, c);
  const u = h(5), b = h(6);
  s = {
    id,
    hx: i * E1[0] + j * E2[0] + (h(1) - 0.5) * 24,
    hy: i * E1[1] + j * E2[1] + (h(2) - 0.5) * 24,
    tone0: u < 0.25 ? 0.12 + 0.09 * b : u < 0.55 ? 0.3 + 0.14 * b : 0.5 + 0.16 * b,
    tp: TAU / (200 + 250 * h(40)), tq: TAU * h(41),
    ox: 128 * h(50), oy: 128 * h(51), x: 0, y: 0, tone: 0,
    wx: [0, 0, 0], wy: [0, 0, 0], wo: [0, 0, 0], wp: [0, 0, 0],
  };
  for (let k = 0; k < 3; k++) {
    const a = TAU * h(10 + k);
    s.wx[k] = AW[k] * cos(a);
    s.wy[k] = AW[k] * sin(a);
    s.wo[k] = TAU / (34 + 80 * h(20 + k));
    s.wp[k] = TAU * h(30 + k);
  }
  S.sites.set(id, s);
  return s;
}

function newRec(S, A, B) {
  const h = (c) => hv(A.id, B.id + S.seed, c);
  const dx = B.hx - A.hx, dy = B.hy - A.hy;
  return {
    seed: floor(h(1) * 1e6), d0: sqrt(dx * dx + dy * dy),
    bm: (h(2) - 0.5) * 6 + 0.8, bv: 9.5 + 4 * h(3), bo: TAU / (42 + 84 * h(4)), bp: TAU * h(5),
    k1: TAU / (40 + 22 * h(6)), k2: TAU / (17 + 10 * h(7)), c1: TAU * h(8), c2: TAU * h(9), ph0: h(10),
    aw1: 3.4 * (0.6 + 0.8 * h(11)), aw2: 1.0 * (0.5 + h(12)), wc1: TAU * h(13), wc2: TAU * h(14),
    pv: 0.12 * (h(15) - 0.5) * 2, pw: TAU * h(16), pq: TAU / (150 + 200 * h(17)),
    born: new Float32Array(NB).fill(NONE), xc: 0.4, had: false, init: true, age0: 4 + 70 * h(18),
    g: 0, frame: -1, seen: 0, nx: 0, ny: 0, mx: 0, my: 0, cs: 1, sn: 0, lam: 10, A1: 0, A2: 0,
  };
}

// the seam of two sites: its gap, its geometry for this frame, and the age of the ice in it
function pairAt(S, a, b) {
  const key = a * 48 + b;
  let r = S.PIC[key];
  if (r && r.frame === S.frame) return r;
  const A = S.list[a], B = S.list[b];
  const kk = A.id * 1048576 + B.id;
  r = S.pairs.get(kk);
  if (!r) {
    r = newRec(S, A, B);
    S.pairs.set(kk, r);
  }
  S.PIC[key] = r;
  const dx = B.x - A.x, dy = B.y - A.y, d = sqrt(dx * dx + dy * dy) + 1e-6;
  const g = cl(d - r.d0 + r.bm + r.bv * S.amp * sin(r.bo * S.th + r.bp), -GN, GP);
  r.g = g;
  r.frame = S.frame;
  r.seen = S.t;
  r.nx = dx / d;
  r.ny = dy / d;
  r.mx = 0.5 * (A.x + B.x);
  r.my = 0.5 * (A.y + B.y);
  // the ice in a lead: strips are laid down at the middle and carried out to the plate edges as it opens
  const half = g > 0.6 ? g / 2 : 0, bn = r.born;
  for (let k = 0; k < NB; k++) {
    if ((k + 0.5) * DW < half) {
      if (bn[k] < -1e8) bn[k] = r.init ? S.t - r.age0 * (1.2 - 0.8 * ((k + 0.5) * DW) / max(half, 1)) : S.t;
    } else bn[k] = NONE;
  }
  r.init = false;
  // the thickness of the thinner ice where the two sheets will first meet, in thickness units before Cold
  if (g > 1) {
    const kc = cl(floor(half / DW - 0.5), 0, NB - 1), age = bn[kc] < -1e8 ? 0 : S.t - bn[kc];
    r.had = true;
    r.xc = min(A.tone, B.tone, sqrt(max(age - 5, 0) / T1));
  } else if (!r.had) r.xc = min(A.tone, B.tone);
  const psi = S.psi0 + r.pv * sin(r.pq * S.th + r.pw);
  r.cs = cos(psi);
  r.sn = sin(psi);
  const f = cl((S.Cg * r.xc) / 0.7, 0, 1.2);
  r.lam = LMIN + (LMAX - LMIN) * f * sqrt(f);
  r.A1 = 0.22 / (r.k1 * r.lam);
  r.A2 = 0.12 / (r.k2 * r.lam);
  return r;
}

// real seams (the two sites are each other's nearest at the middle of the seam) that are well open or well overlapped, in the panel
function seams(S) {
  let lead = 0, raft = 0;
  const list = S.list, n = list.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      const r = S.PIC[(list[a].id < list[b].id ? a : b) * 48 + (list[a].id < list[b].id ? b : a)];
      if (!r || r.frame !== S.frame || (r.g > -6 && r.g < 4.5)) continue;
      if (r.mx < 4 || r.mx > W - 4 || r.my < 8 || r.my > H - 8) continue;
      let ok = true;
      const da = (r.mx - list[a].x) ** 2 + (r.my - list[a].y) ** 2;
      for (let c = 0; c < n && ok; c++) if (c !== a && c !== b && (r.mx - list[c].x) ** 2 + (r.my - list[c].y) ** 2 < da - 1) ok = false;
      if (ok) r.g > 0 ? lead++ : raft++;
    }
  return lead >= 1 && raft >= 2;
}

function derive(S) {
  const k = S.ks, tau = cl(k[1], 0.8, 4) / 2;
  S.rate = 0.6 + 0.4 * sqrt(tau);
  S.ampT = 0.62 + 0.38 * Math.pow(tau, 0.9);
  S.Cg = exp(0.6 * cl(k[2], -1, 1));
  S.Cc = exp(0.28 * cl(k[2], -1, 1));
  S.psi0 = 0.78 * cl(k[3], -1, 1);
  S.hue = k[0] - floor(k[0]);
}

// the pack: a drift that turns slowly, a slow rotation, and the wind time that every wander runs on
function advance(S, d) {
  S.t += d;
  S.th += S.rate * d;
  const th = S.th, beta = 0.9 + 1.2 * cl(S.ks[3], -1, 1) + 0.8 * sin(0.0137 * th + 1.1) + 0.5 * sin(0.0071 * th + 4);
  S.rx += 0.28 * cos(beta) * S.rate * d;
  S.ry += 0.28 * sin(beta) * S.rate * d;
  S.Th = 0.22 * sin(0.0113 * th + 0.6) + 0.12 * sin(0.0197 * th + 2.3);
}

// sites for this frame and the seams between them that are near enough to matter
function frameSetup(S) {
  S.frame++;
  const th = S.th, ca = cos(S.Th), sa = sin(S.Th);
  const px = 32 - S.rx, py = 64 - S.ry;
  const ci = Math.round((px * E2[1] - py * E2[0]) / DET), cj = Math.round((E1[0] * py - E1[1] * px) / DET);
  const list = S.list;
  list.length = 0;
  for (let i = ci - 5; i <= ci + 5; i++)
    for (let j = cj - 5; j <= cj + 5; j++) {
      const s = getSite(S, i, j);
      const rx = s.hx + S.rx - 32, ry = s.hy + S.ry - 64;
      let x = 32 + ca * rx - sa * ry, y = 64 + sa * rx + ca * ry;
      for (let k = 0; k < 3; k++) {
        const w = sin(s.wo[k] * th + s.wp[k]) * S.amp;
        x += s.wx[k] * w;
        y += s.wy[k] * w;
      }
      if (x < -WIN || x > W + WIN || y < -WIN || y > H + WIN || list.length >= 46) continue;
      s.x = x;
      s.y = y;
      s.tone = s.tone0 * (1 + 0.12 * sin(s.tp * S.t + s.tq));
      list.push(s);
    }
  const n = list.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      const dx = list[a].x - list[b].x, dy = list[a].y - list[b].y;
      if (dx * dx + dy * dy < 105 * 105) list[a].id < list[b].id ? pairAt(S, a, b) : pairAt(S, b, a);
    }
  if (S.t > S.clean) {
    S.clean = S.t + 20;
    for (const [k, r] of S.pairs) if (r.seen < S.t - 20) S.pairs.delete(k);
  }
}

// ---- the scene, pixel by pixel
let oX = 0, oZ = 0, oE = 0;

function plate(S, s, px, py) {
  const qx = px - s.x + s.ox, qy = py - s.y + s.oy;
  return s.tone * (0.76 + 0.48 * samp(S.NL, qx, qy)) * S.Cc;
}
// a few soft frost flowers on thin ice: brightness added to x, never above a few percent
function frost(S, s, px, py, x) {
  const qx = px - s.x + s.ox, qy = py - s.y + s.oy;
  const bell = ss(0.06, 0.18, x) * (1 - ss(0.4, 0.75, x));
  if (bell < 0.01) return 0;
  return bell * (0.2 * (samp(S.NS, qx, qy) - 0.5) + 0.13 * ss(0.62, 0.9, samp(S.NP, qx * 0.8 + 40, qy * 0.8 + 17)));
}

function lead(S, P, A, B, px, py, u, hz) {
  const au = abs(u), side = u < 0 ? A : B, bn = P.born;
  const rho = min(1, au / hz), fk = (P.g * 0.5 * (1 - rho)) / DW - 0.5;
  const k0 = cl(floor(fk), 0, NB - 1), k1 = min(NB - 1, k0 + 1), tt = cl(fk - k0, 0, 1);
  const a0 = bn[k0] < -1e8 ? 0 : S.t - bn[k0], a1 = bn[k1] < -1e8 ? 0 : S.t - bn[k1];
  const age = max(0, a0 + (a1 - a0) * tt);
  let xl = min(0.8, sqrt(max(0, age - 5) / T1)) * S.Cc;
  xl += frost(S, side, px, py, xl);
  const m = ss(-0.7, 0.7, au - hz);
  let xp = xl;
  if (m > 0.01) xp = xl + (plate(S, side, px, py) - xl) * m;
  const rim = exp(-(((au - hz) / 1.0) * ((au - hz) / 1.0)));
  oX = xp;
  oZ = ZK * xp + 0.07 * rim;
  oE = 0.04 * rim * (xp > 0.1 ? 1 : 0);
}

function crack(S, A, B, px, py, u) {
  const side = u < 0 ? A : B, x = plate(S, side, px, py), au = abs(u);
  const c = exp(-((au / 0.75) * (au / 0.75)));
  oX = x + (0.05 - x) * 0.92 * c;
  oZ = ZK * x - 0.12 * c;
  oE = 0.04 * exp(-(((au - 1.3) / 0.6) * ((au - 1.3) / 0.6)));
}

// two sheets lying on each other over |u| < hw, in tongues that run along the sliding direction
function raft(S, P, A, B, px, py, u, v, hw) {
  const cs = P.cs, sn = P.sn;
  const vp = -u * sn + v * cs, a = u * cs + v * sn;
  const g1 = vp * P.k1 + P.c1, g2 = vp * P.k2 + P.c2;
  const Phi = vp / P.lam + P.A1 * sin(g1) + P.A2 * sin(g2) + P.ph0;
  const dPhi = (1 + 0.22 * cos(g1) + 0.12 * cos(g2)) / P.lam;
  let j = floor(2 * Phi);
  const J = (n) => 0.34 * (hv(n, P.seed, 9) - 0.5);
  let p0 = 0.5 * j + J(j), p1 = 0.5 * (j + 1) + J(j + 1);
  if (Phi < p0) {
    j--;
    p1 = p0;
    p0 = 0.5 * j + J(j);
  } else if (Phi >= p1) {
    j++;
    p0 = p1;
    p1 = 0.5 * (j + 1) + J(j + 1);
  }
  const isA = (j & 1) === 0, ll = 1 / dPhi;
  const wid = (p1 - p0) * ll, hwid = 0.5 * wid, dv = (Phi - 0.5 * (p0 + p1)) * ll;
  const dedge = min(Phi - p0, p1 - Phi) * ll;
  const cv = cl(dv / hwid, -1, 1), cap = hwid * (1 - sqrt(1 - cv * cv)), vc = vp - dv;
  // each tongue ends where it likes, from two thirds of the band to a little past it
  const lenj = 0.66 + 0.5 * hv(j, P.seed, 4);
  let top, dtip, mA, mB, wA;
  if (isA) {
    const ce = (hw * lenj + vc * sn) / cs - cap;
    top = ss(-0.6, 0.6, ce - a);
    dtip = abs(a - ce);
    mA = top;
    mB = ss(-1, 1, u + hw * 0.9);
    wA = top;
  } else {
    const ce = (-hw * lenj + vc * sn) / cs + cap;
    top = ss(-0.6, 0.6, a - ce);
    dtip = abs(a - ce);
    mB = top;
    mA = ss(-1, 1, hw * 0.9 - u);
    wA = 1 - top;
  }
  const xa = mA > 0.02 ? plate(S, A, px, py) : 0, xb = mB > 0.02 ? plate(S, B, px, py) : 0;
  const both = mA * mB;
  const stack = wA * (xa + 0.38 * xb) + (1 - wA) * (xb + 0.38 * xa) + 0.07 + (isA ? 0.1 : -0.1) + 0.12 * (hv(j, P.seed, 3) - 0.5);
  let xe = mA * (1 - mB) * xa + mB * (1 - mA) * xb + both * stack;
  const rw = ss(2.8, 5.5, wid), rdg = exp(-((dedge / 0.95) * (dedge / 0.95))) * both * rw;
  const tip = exp(-(dtip * dtip)) * both;
  oZ = ZK * (mA * xa + mB * xb) + 0.45 * rdg + 0.3 * tip;
  oE = 0.3 * rdg + 0.25 * tip;
  xe += frost(S, wA > 0.5 ? A : B, px, py, xe * 0.5);
  oX = xe;
}

function render(S) {
  const { Z, XE, E, list, sx, sy, lut } = S;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    sx[i] = list[i].x;
    sy[i] = list[i].y;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      let i0 = -1, i1 = -1, i2 = -1, d0 = 1e9, d1 = 1e9, d2 = 1e9;
      for (let i = 0; i < n; i++) {
        const dx = px - sx[i], dy = py - sy[i], dd = dx * dx + dy * dy;
        if (dd < d0) {
          d2 = d1; i2 = i1; d1 = d0; i1 = i0; d0 = dd; i0 = i;
        } else if (dd < d1) {
          d2 = d1; i2 = i1; d1 = dd; i1 = i;
        } else if (dd < d2) {
          d2 = dd; i2 = i;
        }
      }
      const o = y * W + x;
      let a = i0, b = i1;
      if (list[a].id > list[b].id) {
        a = i1;
        b = i0;
      }
      const P = pairAt(S, a, b), A = list[a], B = list[b];
      const dx = px - P.mx, dy = py - P.my;
      const u0 = dx * P.nx + dy * P.ny, v = -dx * P.ny + dy * P.nx;
      // the way a seam ends in a point where a third sheet comes in
      let del = 99;
      if (i2 >= 0) {
        const ex = sx[i2] - sx[i1], ey = sy[i2] - sy[i1];
        del = (d2 - d1) / (2 * sqrt(ex * ex + ey * ey) + 1e-6);
      }
      const f = ss(0, 5, del), u = u0 - (P.aw1 * sin(v / 9 + P.wc1) + P.aw2 * sin(v / 5.7 + P.wc2)) * ss(0, 12, del);
      const hz = abs(P.g) * (P.g > 0 ? 0.5 : RK * ss(3, 6.5, -P.g)) * f;
      if (hz < 1.25) {
        if (abs(u) < 1.9) crack(S, A, B, px, py, u);
        else {
          const s = u < 0 ? A : B, xp = plate(S, s, px, py);
          oX = xp + frost(S, s, px, py, xp);
          oZ = ZK * xp;
          oE = 0;
        }
      } else if (P.g > 0) {
        if (abs(u) < hz + 1.2) lead(S, P, A, B, px, py, u, hz);
        else {
          const s = u < 0 ? A : B, xp = plate(S, s, px, py);
          oX = xp + frost(S, s, px, py, xp);
          oZ = ZK * xp;
          oE = 0;
        }
      } else if (u > -hz - 4.5 && u < hz + 4.5) raft(S, P, A, B, px, py, u, v, hz);
      else {
        const s = u < 0 ? A : B, xp = plate(S, s, px, py);
        oX = xp + frost(S, s, px, py, xp);
        oZ = ZK * xp;
        oE = 0;
      }
      XE[o] = oX;
      Z[o] = oZ;
      E[o] = oE;
    }
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const xl = x > 0 ? o - 1 : o, xr = x < W - 1 ? o + 1 : o, yu = y > 0 ? o - W : o, yd = y < H - 1 ? o + W : o;
      const D = 0.6 * (Z[xr] - Z[xl]) + 0.8 * (Z[yd] - Z[yu]);
      const s = cl(1.0 * D, -0.55, 0.6), e = E[o];
      const li = cl(Math.round(XE[o] / XS), 0, LN - 1) * 3;
      for (let c = 0; c < 3; c++) {
        let v = lut[li + c];
        v = s < 0 ? v * (1 + 0.9 * s) : v + s * 0.8 * (255 - v);
        v += e * (255 - v);
        img[o * 3 + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : S.ks;
  const d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    derive(S);
    S.amp = S.ampT;
    for (let n = 0; n < 220; n++) {
      advance(S, 0.5);
      frameSetup(S);
    }
    // a pack with no lead and no raft in the panel is not the picture: run on until there are both
    for (let n = 0; n < 160 && !seams(S); n++) {
      advance(S, 0.5);
      frameSetup(S);
    }
    S.ready = true;
  } else {
    const e = 1 - exp(-d / 0.35);
    for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
    derive(S);
    S.amp += (S.ampT - S.amp) * (1 - exp(-d / 1.2));
    advance(S, d);
    frameSetup(S);
  }
  if (abs(S.hue - S.lutHue) > 0.0015) buildLut(S, S.hue);
  render(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, (img[o] + 0.5) | 0, (img[o + 1] + 0.5) | 0, (img[o + 2] + 0.5) | 0);
    }
}
