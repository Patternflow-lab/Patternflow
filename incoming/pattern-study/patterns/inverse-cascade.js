// ===== Patternflow pattern =====
// Title:   Inverse Cascade
// Family:  noise
// Idea:    Two-dimensional turbulence solved on the panel's own 64x128 grid: a field of small random eddies gathers within two seconds into round vortices, red-to-amber ones turning one way and indigo-to-sky-blue ones the other, each ringed by contour bands of its vorticity, and same-sign vortices orbit, wrap each other in thin spiral filaments and merge into fewer and larger ones, carrying the energy up to the large scales while the enstrophy drains away down the filaments, until the energy fills the box and a fresh field of small eddies starts the cascade again.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: inverse energy cascade of two-dimensional turbulence (Robert Kraichnan, 1967; George Batchelor, 1969), coherent vortices of decaying two-dimensional turbulence (James McWilliams, 1984), pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=-1..1, Viscosity=0..1
//
// Knob 1: Hue. Turns both colours round the wheel together, always half a turn apart. At 0 vorticity of one sign runs from deep crimson through red to amber and the white of a vortex core, and of the other from indigo through blue to sky blue and white; on the panel the warm vortices turn clockwise and the cool ones anticlockwise. At 0.25 lime and magenta, at 0.5 olive and cyan, at 0.75 green and violet. The stream function tints each side a little towards one end or the other of its own range.
// Knob 2: Speed. Flow time per second. At 2 the eddies gather into round vortices in about 2 seconds, about 80 vortices become 10 in 9 seconds, and a run ends with 5 to 8 after 13 to 17 seconds; at 1 half as fast, at 0.2 a tenth. Above 2 a frame may take a third step, and at 3 a run lasts about 8 seconds. When the flow is too fast for the steps a frame may take, it runs slower instead.
// Knob 3: Scale. The size of the eddies a run starts from: the noise is filtered round wavenumber 5 at 0, a wavelength of 13 LEDs, round 8.7 at -1 (7 LEDs) and 2.9 at 1 (22 LEDs). Bigger eddies start nearer the end, so a run is shorter. Turning it by more than 0.15 starts a fresh run at the new size.
// Knob 4: Viscosity. The hyperviscosity that takes the enstrophy out at the bottom of its cascade, doubling with every fifth of the knob. At the opening 0.06 a filament two LEDs wide lasts about a tenth of a second and wider ones survive, so the vortices trail long spiral arms; at 1 it is 26 times stronger, filaments up to three LEDs wide dissolve as fast, and the vortices sit in smoother, emptier water.
// Buttons: K1 tap starts a fresh run of small eddies.

const W = 64, H = 128, N = W * H;
const { floor, min, max, exp, sqrt, abs, cos, sin, PI, log2, pow, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The panel is a periodic box 2 pi wide and 4 pi tall, one grid step 2 pi / 64
// either way, so kx runs over the integers and ky over the half-integers.
// Modes with |kx| or |ky| above 21 are dropped after every product
// (Orszag's two-thirds rule).
const KXC = 21, KYC = 42, DX = (2 * PI) / W;
// Flow time per panel second at Speed 2, and the Courant number each step
// keeps to (with |u| + |v|). A frame takes at most two steps up to Speed 2
// and three above it; when the flow is faster than that allows, it runs
// slower instead.
const RATE = 7.5, CFL = 0.8;
// Hyperviscosity nu (k / 21)^8: nu at Viscosity 0, doubling with every fifth
// of the knob.
const NU = 12;
// A run ends when the energy-weighted wavenumber has fallen to this share of
// the one it started from (but not below 1, the box), or after this much
// flow time.
const KEND = 0.28, RUN = 240;
// Crossfade into a fresh field, panel seconds.
const FADE = 0.7;
// Colour: the hue of strong warm vorticity at Hue 0; contour bands per unit
// of the display scale and how deep they cut (reaching full depth above a
// sixth of the scale); the brightness curve; the share of the largest |w| that
// shows at full scale; and how far round the wheel the stream function tints.
const WARM = 0.09, BANDS = 4, BDEP = 0.4, GAM = 0.4, NORM = 0.7, TINT = 0.08, LUT = 1024;

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
// Only the 43 columns with |kx| <= 21 can be non-zero, so the y transforms
// run on those alone: after the x transforms going forward (sign -1), before
// them going back (sign +1). Neither direction divides by N.
const COLS = [];
for (let x = 0; x < W; x++) if ((x < W / 2 ? x : W - x) <= KXC) COLS.push(x);
function fft2(S, re, im, sign) {
  if (sign < 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
  for (let t = 0; t < COLS.length; t++) fft1(S.py, re, im, COLS[t], W, sign);
  if (sign > 0) for (let y = 0; y < H; y++) fft1(S.px, re, im, y * W, 1, sign);
}

// The vorticity equation dw/dt = -div(u w) for the spectrum (sr, si), into
// (or, oi), dealiased. One inverse transform brings w and the stream function
// psi (psi^ = -w^ / k^2) to the grid together, as w + i psi; the velocity
// u = -dpsi/dy, v = dpsi/dx comes from fourth-order differences of psi; one
// forward transform takes u w + i v w back, and the two products are pulled
// apart with the conjugate mode. Leaves w and psi on the grid in br, bi
// (and their largest sizes in wm, pm) and returns the largest |u| + |v|.
function tendency(S, sr, si, or, oi) {
  const { kx, ky, ik2, keep, neg, ar, ai, br: om, bi: ps } = S, nk = keep.length;
  om.fill(0);
  ps.fill(0);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], r = sr[i] / N, m = si[i] / N, q = ik2[i];
    om[i] = r + q * m;
    ps[i] = m - q * r;
  }
  fft2(S, om, ps, 1);
  const c = 1 / (12 * DX);
  let vmax = 0, wm = 0, pm = 0;
  for (let y = 0; y < H; y++) {
    const o = y * W, u1 = ((y + 1) & (H - 1)) * W, d1 = ((y - 1) & (H - 1)) * W, u2 = ((y + 2) & (H - 1)) * W, d2 = ((y - 2) & (H - 1)) * W;
    for (let x = 0; x < W; x++) {
      const r1 = (x + 1) & (W - 1), l1 = (x - 1) & (W - 1), r2 = (x + 2) & (W - 1), l2 = (x - 2) & (W - 1);
      const u = -c * (8 * (ps[u1 + x] - ps[d1 + x]) - (ps[u2 + x] - ps[d2 + x]));
      const v = c * (8 * (ps[o + r1] - ps[o + l1]) - (ps[o + r2] - ps[o + l2]));
      const w = om[o + x], p = ps[o + x];
      ar[o + x] = u * w;
      ai[o + x] = v * w;
      const sp = abs(u) + abs(v);
      if (sp > vmax) vmax = sp;
      if (w > wm) wm = w;
      else if (-w > wm) wm = -w;
      if (p > pm) pm = p;
      else if (-p > pm) pm = -p;
    }
  }
  S.wm = wm;
  S.pm = pm;
  fft2(S, ar, ai, -1);
  for (let t = 0; t < nk; t++) {
    const i = keep[t], j = neg[i], cr = ar[i], ci = ai[i], dr = ar[j], di = ai[j], a = kx[i], b = ky[i];
    or[i] = 0.5 * (a * (ci - di) - b * (cr - dr));
    oi[i] = -0.5 * (a * (cr + dr) + b * (ci + di));
  }
  return vmax;
}

// One third-order Adams-Bashforth step of length h with the viscous decay
// folded in exactly (integrating factor). The two previous tendencies, each
// already decayed to the present, wait in (p1r, p1i) and (p2r, p2i); the
// coefficients come from integrating the quadratic through the last three
// tendencies, so the step may change length. A fresh run starts with an
// Euler step and a second-order one.
function step(S, h) {
  const { wr, wi, nr, ni, p1r, p1i, p2r, p2i, lin } = S;
  S.vmax = tendency(S, wr, wi, nr, ni);
  // The decay factors for each step length on the ladder are kept, a few
  // at a time, so a step that comes back costs no exponentials.
  const key = h * S.nu;
  let E = S.Ec.get(key);
  if (!E) {
    if (S.Ec.size > 8) S.Ec.clear();
    E = new Float64Array(N);
    for (let i = 0; i < N; i++) E[i] = exp(-key * lin[i]);
    S.Ec.set(key, E);
  }
  const h1 = S.h1, h2 = S.h2;
  let c0 = h, c1 = 0, c2 = 0;
  if (h1 && h2) {
    const a = (h * h * h) / 3, b = (h * h) / 2;
    c0 = (a + (2 * h1 + h2) * b + h1 * (h1 + h2) * h) / (h1 * (h1 + h2));
    c1 = -(a + (h1 + h2) * b) / (h1 * h2);
    c2 = (a + h1 * b) / ((h1 + h2) * h2);
  } else if (h1) (c0 = h * (1 + h / (2 * h1))), (c1 = -(h * h) / (2 * h1));
  for (let t = 0, keep = S.keep, nk = keep.length; t < nk; t++) {
    const i = keep[t], e = E[i];
    wr[i] = e * (wr[i] + c0 * nr[i] + c1 * p1r[i] + c2 * p2r[i]);
    wi[i] = e * (wi[i] + c0 * ni[i] + c1 * p1i[i] + c2 * p2i[i]);
    p2r[i] = e * p1r[i];
    p2i[i] = e * p1i[i];
    p1r[i] = e * nr[i];
    p1i[i] = e * ni[i];
  }
  S.h2 = h1;
  S.h1 = h;
}

// A fresh field: white noise filtered to a band round k0, scaled to an rms
// vorticity of 1.
function seed(S) {
  const { wr, wi, k2, mask } = S, k0 = S.k0;
  for (let i = 0; i < N; i++) (wr[i] = Math.random() * 2 - 1), (wi[i] = 0);
  fft2(S, wr, wi, -1);
  let z = 0;
  for (let i = 0; i < N; i++) {
    const q = k2[i] / (k0 * k0), a = mask[i] && k2[i] > 0 ? q * exp(-q) : 0;
    wr[i] *= a;
    wi[i] *= a;
    z += wr[i] * wr[i] + wi[i] * wi[i];
  }
  const g = N / sqrt(z);
  for (let i = 0; i < N; i++) (wr[i] *= g), (wi[i] *= g);
  S.age = 0;
  S.h1 = S.h2 = 0;
  S.sk = S.scale;
  S.runs++;
}

// The energy-weighted mean wavenumber: sum k |w^|^2 / k^2 over sum |w^|^2 / k^2.
function kmean(S) {
  const { wr, wi, ik2, kk, keep } = S;
  let e = 0, ek = 0;
  for (let t = 0; t < keep.length; t++) {
    const i = keep[t], a = (wr[i] * wr[i] + wi[i] * wi[i]) * ik2[i];
    e += a;
    ek += a * kk[i];
  }
  return e > 0 ? ek / e : 0;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Four tables from |w| / scale to colour, two for each sign of spin, at two
// hues the stream function blends between. Weak vorticity is deep crimson on
// one side and indigo on the other, so it does not sink to brown and navy;
// strong vorticity climbs to amber and to sky blue, and the cores to white.
function palette(S) {
  if (S.palHue === S.hue) return;
  S.palHue = S.hue;
  const c = [0, 0, 0];
  for (let s = 0; s < 4; s++) {
    const T = S.pals[s], neg = s & 1, h0 = S.hue + (neg ? WARM + 0.47 : WARM) + ((s & 2 ? 1 : -1) * TINT) / 2;
    for (let j = 0; j < LUT; j++) {
      const a = j / (LUT - 1), d = BDEP * cl(a / 0.15, 0, 1);
      const b = pow(a, GAM) * (1 - d + d * cos(2 * PI * BANDS * a));
      hsv(h0 + (neg ? 0.15 : -0.11) * (1 - a), 1 - 0.55 * a * a, 1, c, 0);
      T[j * 3] = 255 * b * c[0];
      T[j * 3 + 1] = 255 * b * c[1];
      T[j * 3 + 2] = 255 * b * c[2];
    }
  }
}

export function setup(params) {
  const F = () => new Float64Array(N);
  const S = (params.s = {
    hue: 0, speed: 2, scale: 0, visc: 0.06, nu: NU, k0: 5, sk: 0, t: 0, age: 0, runs: 0, h1: 0, h2: 0, fade: 0, vmax: 0.4, vs: 0.4, km: 0,
    px: plan(W), py: plan(H),
    kx: F(), ky: F(), k2: F(), kk: F(), ik2: F(), lin: F(), mask: new Uint8Array(N), neg: new Int32Array(N),
    wr: F(), wi: F(), nr: F(), ni: F(), p1r: F(), p1i: F(), p2r: F(), p2i: F(), ar: F(), ai: F(), br: F(), bi: F(),
    wm: 0, pm: 0, Ec: new Map(),
    pals: [0, 1, 2, 3].map(() => new Float32Array(LUT * 3)), palHue: -1,
    old: new Uint8Array(N * 3), cur: new Uint8Array(N * 3), wsc: 0, psc: 0,
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, jx = x < W / 2 ? x : x - W, jy = y < H / 2 ? y : y - H;
      S.kx[i] = jx;
      S.ky[i] = jy / 2;
      S.k2[i] = jx * jx + (jy * jy) / 4;
      S.kk[i] = sqrt(S.k2[i]);
      S.ik2[i] = S.k2[i] > 0 ? 1 / S.k2[i] : 0;
      S.mask[i] = abs(jx) <= KXC && abs(jy) <= KYC ? 1 : 0;
      S.neg[i] = ((H - y) % H) * W + ((W - x) % W);
      const q = S.k2[i] / (KXC * KXC);
      S.lin[i] = q * q * q * q;
    }
  // The modes inside the two-thirds cut, the only ones that are ever
  // non-zero: the spectral loops run over these 3,655 alone.
  const keep = [];
  for (let i = 0; i < N; i++) if (S.mask[i]) keep.push(i);
  S.keep = Int32Array.from(keep);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.scale = cl(k[2], -1, 1);
  S.visc = cl(k[3], 0, 1);
  S.nu = NU * pow(2, 5 * S.visc);
  S.k0 = 5 * pow(2, -0.8 * S.scale);
  const ft = cl(dt || 0, 0, 0.1);
  if (!S.runs) seed(S);
  else if ((input.btnPressed && input.btnPressed[0]) || abs(S.scale - S.sk) > 0.15 || S.age > RUN || (S.age > 20 && (S.km = (S.km + 1) % 8) === 0 && kmean(S) < max(1, KEND * S.k0))) {
    S.old.set(S.cur);
    S.fade = 1;
    seed(S);
  }
  S.fade = max(0, S.fade - ft / FADE);
  let adv = (ft * S.speed * RATE) / 2;
  if (adv <= 0) return;
  // The speed limit holds the highest speed seen and lets it go slowly, so
  // the step length changes smoothly from frame to frame.
  S.vs = max(S.vmax, S.vs * 0.98);
  const hmax = (CFL * DX) / max(1e-6, S.vs);
  const n = min(S.speed > 2 ? 3 : 2, Math.ceil(adv / hmax));
  // Steps come from a ladder 16 to an octave, so the decay factors are
  // worked out again only when the step moves up or down a rung.
  const h = pow(2, floor(16 * log2(min(adv / n, hmax))) / 16);
  adv = n * h;
  for (let j = 0; j < n; j++) step(S, h);
  S.t += adv;
  S.age += adv;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.runs) return;
  palette(S);
  const { br: om, bi: ps, pals, cur, old } = S, m = S.wm, mp = S.pm;
  // The scales follow the field slowly, so a merger does not flash.
  S.wsc = S.wsc ? S.wsc + (m - S.wsc) * 0.05 : m;
  S.psc = S.psc ? S.psc + (mp - S.psc) * 0.05 : mp;
  const sc = (LUT - 1) / max(1e-6, S.wsc * NORM), tp = 0.5 / max(1e-9, S.psc);
  const f = S.fade, g = 1 - f;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, w = om[i], j = min(LUT - 1, round(abs(w) * sc)) * 3, s = w > 0 ? 0 : 1, A = pals[s], B = pals[s + 2], o = i * 3;
      const t = cl(0.5 + ps[i] * tp, 0, 1), u = 1 - t;
      cur[o] = A[j] * u + B[j] * t;
      cur[o + 1] = A[j + 1] * u + B[j + 1] * t;
      cur[o + 2] = A[j + 2] * u + B[j + 2] * t;
      if (f > 0) display.setPixel(x, y, cur[o] * g + old[o] * f, cur[o + 1] * g + old[o + 1] * f, cur[o + 2] * g + old[o + 2] * f);
      else display.setPixel(x, y, cur[o], cur[o + 1], cur[o + 2]);
    }
}
