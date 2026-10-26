// ===== Patternflow pattern =====
// Title:   Zonal Jets
// Family:  wave
// Idea:    Two-dimensional turbulence stirred in small eddies on a beta plane, solved on the panel's own 64x128 grid, gathers its energy into east-west jets stacked up the panel, eastward flow red to pale amber and westward violet to sky blue, while the stream lines drawn over them close into cat's eyes between the jets and slide west as Rossby waves, three times faster than the jets carry the water east; beta sets how many jets stand, through the Rhines scale.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: beta-plane zonal jets and the Rhines scale (Peter Rhines, 1975), Rossby waves (Carl-Gustaf Rossby, 1939), pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beta=-1..1, Stir=0..1
//
// Knob 1: Hue. Turns both colours round the wheel together. At 0 eastward flow runs from red through orange to pale amber and westward flow from violet through blue to pale sky blue, dark where the water is still. At 0.33 the eastward flow is green and the westward crimson to pink; at 0.67 blue and lime.
// Knob 2: Speed. Flow time per second. At 2 the jet cores carry the water east at about 7 LEDs a second, and the pattern of stream lines on them slides west at about 20. At 1 half as fast, at 0.2 a tenth. Above 2 a frame may take a third step; when the flow is too fast for the steps a frame may take, it runs slower instead.
// Knob 3: Beta. How fast the Coriolis parameter grows northward, 9 at 0, from 2.5 at -1 to 32 at 1. At -1 two eastward jets stand on the panel, now and then three, with big eddies between them; at 0 three or four; at 1 four to six narrow ones, and the stream lines slide west at about 48 LEDs a second. Turning it by more than 0.2 starts a fresh run at the new beta.
// Knob 4: Stir. How hard the small eddies that feed the jets are stirred, at a wavelength of 6.4 LEDs, by a factor of 12 from one end to the other. At 0 and at the opening 0.06 the jets run smooth between round eddies; at 1 the bands fill with grainy small eddies and the jets fray.
// Buttons: K1 tap starts a fresh run.

const W = 64, H = 128;
const { floor, min, max, exp, sqrt, abs, cos, sin, PI, log2, pow, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The panel is a periodic box 2 pi wide and 4 pi tall, x to the east and y to
// the north (up the panel), solved pseudo-spectrally the way Inverse Cascade
// solves it, with Orszag's two-thirds rule and third-order Adams-Bashforth
// steps of changing length. The vorticity q obeys
//   dq/dt + J(psi, q) + beta dpsi/dx = stirring - MU q - NU (k / kmax)^8 q
// The beta term is linear like the friction, so it goes into the integrating
// factor with them: each mode turns round by beta kx / k^2 per unit time,
// the westward drift of a Rossby wave.
// Flow time per panel second at Speed 2, and the Courant number each step
// keeps to (with |u| + |v|). At 1.0 the smallest modes flare up now and
// then; at 0.9 they do not.
const RATE = 0.7, CFL = 0.9;
// Hyperviscosity at the cut-off wavenumber, per unit time. At 12 the
// enstrophy piled up near the cut-off in bursts, patches of ripples three
// LEDs long; at 80 it drains away.
const NU = 80;
// White-in-time stirring on a ring of wavenumbers KF +- 1, a wavelength of
// 6.4 LEDs, injecting energy EPS per unit time at Stir 0.06; the knob scales
// it by STR per unit of knob. Linear drag MU.
const KF = 10, EPS = 0.003, STR = 12, MU = 0.003;
// beta at Beta 0, and the factor one unit of the knob multiplies it by.
const BM = 9, BR = 3.6;
// A run starts from noise round wavenumber K0 with energy E0 on a grid half
// as fine (32 x 64, stirred at KF0). It runs there for PRE units of flow
// time before the first frame and is then carried over mode for mode to the
// panel grid, so the jets already stand when the panel lights.
const KF0 = 7, K0 = 5, E0 = 1, PRE = 15;
// The colour is the zonal velocity u with only AL of its departure from the
// row's mean, so the eddies tint the bands without breaking them; UN of its
// largest size reaches full colour.
const AL = 0.4, UN = 0.7, LUT = 512;
// Stream lines: BANDS per largest size of psi, cut DEP deep with a cos^LP
// profile so they stay thin.
const BANDS = 4, DEP = 0.6, LP = 3;
// The hue of the strongest eastward flow at Hue 0 and how far the weak flow
// turns from it; the brightness floor and curve.
const HE = 0.12, HS = 0.15, V0 = 0.25, GAM = 0.5;
// Crossfade into a fresh run, panel seconds.
const FADE = 0.6;

// ---- radix-2 FFT, in place on (re, im) at off, off + st, off + 2 st, ...
function plan(n) {
  const lg = log2(n), rev = new Uint16Array(n), c = new Float64Array(n >> 1), s = new Float64Array(n >> 1);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) r |= ((i >> b) & 1) << (lg - 1 - b);
    rev[i] = r;
  }
  for (let i = 0; i < n >> 1; i++) (c[i] = cos((2 * PI * i) / n)), (s[i] = sin((2 * PI * i) / n));
  return { n, rev, c, s, br: new Float64Array(n), bi: new Float64Array(n) };
}
function fft1(P, re, im, off, st, sign) {
  const { n, rev, c, s, br, bi } = P;
  for (let i = 0; i < n; i++) {
    const j = off + rev[i] * st;
    br[i] = re[j];
    bi[i] = im[j];
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let a0 = 0; a0 < n; a0 += size)
      for (let k = 0, t = 0; k < half; k++, t += step) {
        const wr = c[t], wi = sign * s[t], a = a0 + k, b = a + half;
        const xr = br[b] * wr - bi[b] * wi, xi = br[b] * wi + bi[b] * wr;
        br[b] = br[a] - xr;
        bi[b] = bi[a] - xi;
        br[a] += xr;
        bi[a] += xi;
      }
  }
  for (let i = 0; i < n; i++) (re[off + i * st] = br[i]), (im[off + i * st] = bi[i]);
}
// The y transforms run only on the columns that survive the cut.
function fft2(G, re, im, sign) {
  const { w, h, cols, px, py } = G;
  if (sign < 0) for (let y = 0; y < h; y++) fft1(px, re, im, y * w, 1, sign);
  for (let t = 0; t < cols.length; t++) fft1(py, re, im, cols[t], w, sign);
  if (sign > 0) for (let y = 0; y < h; y++) fft1(px, re, im, y * w, 1, sign);
}

// One grid over the box, w x h, stirred at kf.
function grid(w, h, kf) {
  const n = w * h, kxc = floor(w / 3), kyc = floor(h / 3), F = () => new Float64Array(n);
  const G = {
    w, h, n, dx: (2 * PI) / w, px: plan(w), py: plan(h), cols: [],
    kx: F(), ky: F(), k2: F(), ik2: F(), lin: F(), neg: new Int32Array(n), idx: new Int32Array(n),
    wr: F(), wi: F(), nr: F(), ni: F(), p1r: F(), p1i: F(), p2r: F(), p2i: F(), ar: F(), ai: F(), br: F(), bi: F(), ug: F(),
    h1: 0, h2: 0, vmax: 0.4, vs: 0.4, um: 0, Ec: new Map(),
  };
  for (let x = 0; x < w; x++) if ((x < w / 2 ? x : w - x) <= kxc) G.cols.push(x);
  const keep = [], forced = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, jx = x < w / 2 ? x : x - w, jy = y < h / 2 ? y : y - h, k2 = jx * jx + (jy * jy) / 4;
      G.kx[i] = jx;
      G.ky[i] = jy / 2;
      G.k2[i] = k2;
      G.ik2[i] = k2 > 0 ? 1 / k2 : 0;
      G.neg[i] = ((h - y) % h) * w + ((w - x) % w);
      // where the same mode sits on the panel grid
      G.idx[i] = ((jy + H) % H) * W + ((jx + W) % W);
      const q = k2 / (kxc * kxc);
      G.lin[i] = q * q * q * q;
      if (abs(jx) > kxc || abs(jy) > kyc) continue;
      keep.push(i);
      if (abs(sqrt(k2) - kf) <= 1 && (jx > 0 || (jx === 0 && jy > 0))) forced.push(i);
    }
  G.keep = Int32Array.from(keep);
  G.forced = Int32Array.from(forced);
  // A kick of +-A sqrt(h) to both parts of each forced pair adds 4 A^2 h / 3
  // to the sum of |q^|^2, an energy of EPS h at wavenumber kf.
  G.famp = n * sqrt((3 * EPS * kf * kf) / (2 * forced.length));
  return G;
}

// -div(u q) for the spectrum (sr, si), into (or, oi), dealiased. One inverse
// transform brings q and psi to the grid together as q + i psi, the velocity
// comes from fourth-order differences of psi, and one forward transform takes
// u q + i v q back. Leaves q, psi and u on the grid in br, bi, ug.
function tendency(G, sr, si, or, oi) {
  const { w, h, n, kx, ky, ik2, keep, neg, ar, ai, br: om, bi: ps, ug } = G, nk = keep.length, mw = w - 1, mh = h - 1;
  om.fill(0);
  ps.fill(0);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], r = sr[i] / n, m = si[i] / n, q = ik2[i];
    om[i] = r + q * m;
    ps[i] = m - q * r;
  }
  fft2(G, om, ps, 1);
  const c = 1 / (12 * G.dx);
  let vmax = 0, um = 0;
  for (let y = 0; y < h; y++) {
    const o = y * w, u1 = ((y + 1) & mh) * w, d1 = ((y - 1) & mh) * w, u2 = ((y + 2) & mh) * w, d2 = ((y - 2) & mh) * w;
    for (let x = 0; x < w; x++) {
      const r1 = (x + 1) & mw, l1 = (x - 1) & mw, r2 = (x + 2) & mw, l2 = (x - 2) & mw;
      const u = -c * (8 * (ps[u1 + x] - ps[d1 + x]) - (ps[u2 + x] - ps[d2 + x]));
      const v = c * (8 * (ps[o + r1] - ps[o + l1]) - (ps[o + r2] - ps[o + l2]));
      const q = om[o + x];
      ug[o + x] = u;
      ar[o + x] = u * q;
      ai[o + x] = v * q;
      const sp = abs(u) + abs(v);
      if (sp > vmax) vmax = sp;
    }
  }
  fft2(G, ar, ai, -1);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], j = neg[i], cr = ar[i], ci = ai[i], dr = ar[j], di = ai[j], a = kx[i], b = ky[i];
    or[i] = 0.5 * (a * (ci - di) - b * (cr - dr));
    oi[i] = -0.5 * (a * (cr + dr) + b * (ci + di));
  }
  return vmax;
}

// One AB3 step of length h with the linear terms in a complex integrating
// factor (kept for a few step lengths at a time), then the stirring kick.
function step(G, S, h) {
  const { wr, wi, nr, ni, p1r, p1i, p2r, p2i, lin, kx, ik2, keep } = G, nk = keep.length;
  G.vmax = tendency(G, wr, wi, nr, ni);
  const key = h * 1e6 + S.beta;
  let E = G.Ec.get(key);
  if (!E) {
    if (G.Ec.size > 8) G.Ec.clear();
    E = new Float64Array(2 * G.n);
    for (let t = 0; t < nk; t++) {
      const i = keep[t], d = exp(-h * (NU * lin[i] + MU)), th = h * S.beta * kx[i] * ik2[i];
      E[2 * i] = d * cos(th);
      E[2 * i + 1] = d * sin(th);
    }
    G.Ec.set(key, E);
  }
  const h1 = G.h1, h2 = G.h2;
  let c0 = h, c1 = 0, c2 = 0;
  if (h1 && h2) {
    const a = (h * h * h) / 3, b = (h * h) / 2;
    c0 = (a + (2 * h1 + h2) * b + h1 * (h1 + h2) * h) / (h1 * (h1 + h2));
    c1 = -(a + (h1 + h2) * b) / (h1 * h2);
    c2 = (a + h1 * b) / ((h1 + h2) * h2);
  } else if (h1) (c0 = h * (1 + h / (2 * h1))), (c1 = -(h * h) / (2 * h1));
  for (let t = 0; t < nk; t++) {
    const i = keep[t], er = E[2 * i], ei = E[2 * i + 1];
    const xr = wr[i] + c0 * nr[i] + c1 * p1r[i] + c2 * p2r[i], xi = wi[i] + c0 * ni[i] + c1 * p1i[i] + c2 * p2i[i];
    wr[i] = er * xr - ei * xi;
    wi[i] = er * xi + ei * xr;
    let ar = p1r[i], ai = p1i[i];
    p2r[i] = er * ar - ei * ai;
    p2i[i] = er * ai + ei * ar;
    ar = nr[i];
    ai = ni[i];
    p1r[i] = er * ar - ei * ai;
    p1i[i] = er * ai + ei * ar;
  }
  const A = G.famp * sqrt(h * S.stir), F = G.forced, NG = G.neg;
  for (let t = 0; t < F.length; t++) {
    const i = F[t], j = NG[i], a = (Math.random() * 2 - 1) * A, b = (Math.random() * 2 - 1) * A;
    wr[i] += a;
    wi[i] += b;
    wr[j] += a;
    wi[j] -= b;
  }
  G.h2 = h1;
  G.h1 = h;
}

// The step: n steps from a ladder 16 to an octave, as long as the Courant
// number allows, so the integrating factors come back.
function ladder(G, adv, most) {
  G.vs = max(G.vmax, G.vs * 0.98);
  const hmax = (CFL * G.dx) / max(1e-6, G.vs), n = min(most, Math.ceil(adv / hmax));
  return [n, pow(2, floor(16 * log2(min(adv / n, hmax))) / 16)];
}

// A fresh run: noise round K0 on the coarse grid, spun up, carried over.
function start(S) {
  const C = S.G0, G = S.G, { wr, wi, k2, keep, n } = C;
  wr.fill(0);
  wi.fill(0);
  for (let i = 0; i < n; i++) wr[i] = Math.random() * 2 - 1;
  fft2(C, wr, wi, -1);
  const on = new Uint8Array(n);
  for (let t = 0; t < keep.length; t++) on[keep[t]] = 1;
  let e = 0;
  for (let i = 0; i < n; i++) {
    const q = k2[i] / (K0 * K0), a = on[i] && k2[i] > 0 ? q * exp(-q) : 0;
    wr[i] *= a;
    wi[i] *= a;
    if (k2[i] > 0) e += (wr[i] * wr[i] + wi[i] * wi[i]) / k2[i];
  }
  const g = sqrt(E0 / ((0.5 * e) / (n * n)));
  for (let i = 0; i < n; i++) (wr[i] *= g), (wi[i] *= g);
  C.h1 = C.h2 = 0;
  for (let t = 0; t < PRE; ) {
    const [, h] = ladder(C, 1, 1);
    step(C, S, h);
    t += h;
  }
  const s = G.n / n;
  G.wr.fill(0);
  G.wi.fill(0);
  for (let t = 0; t < keep.length; t++) {
    const i = keep[t], j = C.idx[i];
    G.wr[j] = wr[i] * s;
    G.wi[j] = wi[i] * s;
  }
  G.h1 = G.h2 = 0;
  G.vs = C.vs;
  G.vmax = C.vmax;
  tendency(G, G.wr, G.wi, G.nr, G.ni);
  S.b0 = S.k3;
  S.runs++;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, k3: 0, b0: 0, beta: BM, stir: 1, runs: 0, fade: 0, usc: 0, psc: 0, palHue: -1,
    G: grid(W, H, KF), G0: grid(W / 2, H / 2, KF0), zm: new Float64Array(H),
    pal: new Float32Array(2 * LUT * 3), lines: new Float32Array(256), old: new Uint8Array(W * H * 3), cur: new Uint8Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, G = S.G, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.k3 = cl(k[2], -1, 1);
  S.beta = BM * pow(BR, S.k3);
  S.stir = pow(STR, cl(k[3], 0, 1) - 0.06);
  const ft = cl(dt || 0, 0, 0.1);
  if (!S.runs) start(S);
  else if ((input.btnPressed && input.btnPressed[0]) || abs(S.k3 - S.b0) > 0.2) {
    S.old.set(S.cur);
    S.fade = 1;
    start(S);
  }
  S.fade = max(0, S.fade - ft / FADE);
  const adv = (ft * S.speed * RATE) / 2;
  if (adv <= 0) return;
  const [n, h] = ladder(G, adv, S.speed > 2 ? 3 : 2);
  for (let j = 0; j < n; j++) step(G, S, h);
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Zonal velocity to colour: the upper half of the table is eastward flow,
// red through orange to pale amber, the lower half westward, violet through
// blue to pale sky blue, both dark where the flow is still.
function palette(S) {
  if (S.palHue === S.hue) return;
  S.palHue = S.hue;
  const T = S.pal, c = [0, 0, 0];
  for (let j = 0; j < 2 * LUT; j++) {
    const east = j >= LUT, a = east ? (j - LUT) / (LUT - 1) : (LUT - 1 - j) / (LUT - 1);
    hsv(S.hue + (east ? HE : HE + 0.42) + (east ? -HS : HS) * pow(1 - a, 1.2), 1 - 0.5 * a * a * a, 1, c);
    const v = 255 * (V0 + (1 - V0) * pow(a, GAM));
    T[j * 3] = v * c[0];
    T[j * 3 + 1] = v * c[1];
    T[j * 3 + 2] = v * c[2];
  }
  for (let j = 0; j < 256; j++) S.lines[j] = 1 - DEP * pow(0.5 + 0.5 * cos((2 * PI * j) / 256), LP);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.runs) return;
  palette(S);
  const G = S.G, { ug, bi: ps } = G, { pal: T, lines: L, zm, cur, old } = S;
  let pm = 0, um = 0;
  for (let y = 0; y < H; y++) {
    let a = 0;
    for (let x = 0, o = y * W; x < W; x++) {
      a += ug[o + x];
      if (abs(ps[o + x]) > pm) pm = abs(ps[o + x]);
    }
    zm[y] = a / W;
  }
  // The scales follow the flow slowly, so a strong eddy does not flash.
  S.psc = S.psc ? S.psc + (pm - S.psc) * 0.05 : pm;
  if (!S.usc) for (let i = 0; i < G.n; i++) S.usc = max(S.usc, abs(zm[i >> 6] + AL * (ug[i] - zm[i >> 6])));
  const iu = (LUT - 1) / max(1e-6, S.usc * UN), ip = (256 * BANDS) / max(1e-6, S.psc), f = S.fade, g = 1 - f;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, u = zm[y] + AL * (ug[i] - zm[y]), j = 3 * (LUT + cl(round(u * iu), -LUT, LUT - 1)), l = L[(ps[i] * ip + 1e6) & 255], o = 3 * ((H - 1 - y) * W + x);
      if (abs(u) > um) um = abs(u);
      cur[o] = T[j] * l;
      cur[o + 1] = T[j + 1] * l;
      cur[o + 2] = T[j + 2] * l;
    }
  S.usc = S.usc ? S.usc + (um - S.usc) * 0.05 : um;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      if (f > 0) display.setPixel(x, y, cur[o] * g + old[o] * f, cur[o + 1] * g + old[o + 1] * f, cur[o + 2] * g + old[o + 2] * f);
      else display.setPixel(x, y, cur[o], cur[o + 1], cur[o + 2]);
    }
}
