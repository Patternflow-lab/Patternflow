// ===== Patternflow pattern =====
// Title:   Louche
// Family:  ouzo
// Idea:    Water poured into clear amber spirit that holds a little anise oil turns it milky the moment the mixture crosses the oil's solubility line, so each filament of water sinks as a plume with a sharp bright front where droplets are born, a blue haze behind it that coarsens to white and rises as cream, while fresh spirit keeps arriving and the milk drains away.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ouzo effect, spontaneous emulsification of a spirit's oil when water is added (Vitale and Katz, 2003, from memory); droplet nucleation, growth and Ostwald ripening in it (Sitnikova, Whyte, Lohse, Zhang and others, 2005, from memory); the louche of absinthe and pastis; Rayleigh scattering for the blue of small droplets. Original here: a 32 by 64 stream-function flow with a buoyancy term, constants tuned by eye, pattern round 266
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pour=0.8..3, Anise=-1..1, Warmth=0..1
//
// Knob 1: Hue.
// Knob 2: Pour.
// Knob 3: Anise.
// Knob 4: Warmth.

const W = 64, H = 128;
const NX = 32, NY = 64, NC = NX * NY;
const { floor, sqrt, cbrt, exp, sin, cos, min, max, PI, pow, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

// ---- the chemistry, in units where the spirit's oil is a fraction of what it could hold
const KQ = 6.0; // solubility falls as exp(-KQ w) with the water fraction w
const SCRIT = 1.8; // the supersaturation at which droplets are born
const JN = 90; // nuclei born per second at twice the critical supersaturation
const VNUC = 0.0012; // volume of a new nucleus, x^3
const GG = 5; // growth rate
const DRAIN = 16; // rows at the bottom where the milk is let out
const VMAX = 8; // mean droplet volume at most
const JET = 6; // how hard a pipette's stream is pushed down
// size parameter at which a droplet scatters a channel's wavelength like a wavelength-sized sphere
const LAM = [0.66, 0.52, 0.42];
const XLUT = 256, XLO = 0.1, XHI = 2.3;
const KO = 9; // optical depth per unit of droplet oil

function cr(t, o) {
  const t2 = t * t, t3 = t2 * t;
  o[0] = 0.5 * (-t3 + 2 * t2 - t);
  o[1] = 0.5 * (3 * t3 - 5 * t2 + 2);
  o[2] = 0.5 * (-3 * t3 + 4 * t2 + t);
  o[3] = 0.5 * (t3 - t2);
}

function hsv(h, s, v, o) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i % 6) {
    case 0: o[0] = v; o[1] = t; o[2] = p; break;
    case 1: o[0] = q; o[1] = v; o[2] = p; break;
    case 2: o[0] = p; o[1] = v; o[2] = t; break;
    case 3: o[0] = p; o[1] = q; o[2] = v; break;
    case 4: o[0] = t; o[1] = p; o[2] = v; break;
    default: o[0] = v; o[1] = p; o[2] = q;
  }
}

function build() {
  const f = () => new Float32Array(NC);
  const S = {
    ready: false, t: 0, hue: 0, pour: 2, Q: 0.5, warm: 0.06, acc: 0, par: 0,
    w: f(), c: f(), Nn: f(), ph: f(), om: f(), nf: f(),
    w2: f(), c2: f(), N2: f(), p2: f(), o2: f(), n2: f(),
    rho: f(), psi: f(), uu: f(), vv: f(), px: f(),
    ix: new Int32Array(NC * 16), wt: new Float32Array(NC * 16),
    t1: new Float64Array(NC),
    Sx: new Float64Array(NX * NX), mm: new Float64Array(NC), cp: new Float64Array(NC),
    pipes: [], next: 0.2,
    up: [0, 1, 2, 3].map(() => new Float32Array(W * H)), hz: [0, 1, 2, 3].map(() => new Float32Array(NY * W)),
    lutO: new Float32Array(XLUT + 1), lutC: [0, 1, 2].map(() => new Float32Array(XLUT + 1)),
    lutT: new Float32Array(129 * 3),
    colx: [], rowx: [],
  };
  // sine transform across the panel, and the tridiagonal solve down it for each mode
  const sc = sqrt(2 / (NX + 1));
  for (let k = 0; k < NX; k++) for (let i = 0; i < NX; i++) S.Sx[k * NX + i] = sc * sin((PI * (k + 1) * (i + 1)) / (NX + 1));
  for (let k = 0; k < NX; k++) {
    const d = 4 - 2 * cos((PI * (k + 1)) / (NX + 1));
    let cprev = 0;
    for (let j = 0; j < NY; j++) {
      const m = 1 / (d + cprev);
      S.mm[k * NY + j] = m;
      cprev = -m;
      S.cp[k * NY + j] = cprev;
    }
  }
  // what a droplet of size x does to light: opacity per unit of oil, and the colour it scatters
  const ratio = [0, 0, 0];
  for (let i = 0; i <= XLUT; i++) {
    const x = XLO + ((XHI - XLO) * i) / XLUT;
    let qm = 0, qx = 0;
    for (let ch = 0; ch < 3; ch++) {
      ratio[ch] = (1 - exp(-pow(x / LAM[ch], 4))) / x;
      qm += ratio[ch];
      if (ratio[ch] > qx) qx = ratio[ch];
    }
    S.lutO[i] = 0.45 + 0.5 * qm;
    const cream = ss(0.35, 0.9, x);
    for (let ch = 0; ch < 3; ch++) {
      const warmW = ch === 0 ? 1 : ch === 1 ? 0.97 : 0.92;
      const cc = 0.35 + 0.65 * pow(ratio[ch] / (qx + 1e-6), 0.7); // blue for small droplets, white for large
      S.lutC[ch][i] = cc * (1 - cream) + warmW * cream;
    }
  }
  // the sampling positions of the 2x upsample
  for (let X = 0; X < W; X++) {
    const g = (X - 0.5) / 2, i0 = floor(g), o = [0, 0, 0, 0];
    cr(g - i0, o);
    S.colx.push({ i0, o });
  }
  for (let Y = 0; Y < H; Y++) {
    const g = (Y - 0.5) / 2, j0 = floor(g), o = [0, 0, 0, 0];
    cr(g - j0, o);
    S.rowx.push({ j0, o });
  }
  return S;
}

// ---- parameters from the knobs
function knobs(S, kv) {
  S.hue = 0.105 + 0.82 * kv[0];
  S.pour = kv[1];
  const t = (cl(kv[2], -1, 1) + 1) / 2;
  const Q = 0.3 + 0.68 * pow(t, 1.16);
  if (S.Q !== Q && S.ready) {
    const r = Q / S.Q;
    for (let i = 0; i < NC; i++) S.c[i] *= r;
  }
  S.Q = Q;
  S.warm = cl(kv[3], 0, 1);
}

// ---- flow: stream function from the vorticity, one sine transform across and a tridiagonal solve down
function solvePsi(S) {
  const { om, psi, t1, Sx, mm, cp } = S;
  for (let j = 0; j < NY; j++) {
    const jo = j * NX;
    for (let k = 0; k < NX; k++) {
      let s = 0;
      const ko = k * NX;
      for (let i = 0; i < NX; i++) s += om[jo + i] * Sx[ko + i];
      t1[jo + k] = s;
    }
  }
  for (let k = 0; k < NX; k++) {
    let dprev = 0;
    for (let j = 0; j < NY; j++) {
      const k1 = j * NX + k;
      dprev = (t1[k1] + dprev) * mm[k * NY + j];
      t1[k1] = dprev;
    }
    let xnext = 0;
    for (let j = NY - 1; j >= 0; j--) {
      const k1 = j * NX + k;
      xnext = t1[k1] - cp[k * NY + j] * xnext;
      t1[k1] = xnext;
    }
  }
  for (let j = 0; j < NY; j++) {
    const jo = j * NX;
    for (let i = 0; i < NX; i++) {
      let s = 0;
      const io = i * NX;
      for (let k = 0; k < NX; k++) s += t1[jo + k] * Sx[io + k];
      psi[jo + i] = s;
    }
  }
}

function velocity(S) {
  const { psi, uu, vv } = S;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      const up = j > 0 ? psi[c - NX] : 0, dn = j < NY - 1 ? psi[c + NX] : 0;
      const lf = i > 0 ? psi[c - 1] : 0, rt = i < NX - 1 ? psi[c + 1] : 0;
      uu[c] = 0.5 * (dn - up);
      vv[c] = -0.5 * (rt - lf);
    }
}

// semi-Lagrangian stencils: 16 taps and weights per cell for the back-traced point
const wxo = [0, 0, 0, 0], wyo = [0, 0, 0, 0];
function stencil(S, dt, vb) {
  const { uu, vv, ix, wt } = S;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      const px = cl(i - uu[c] * dt, 0, NX - 1.0001), py = cl(j - (vv[c] + vb) * dt, 0, NY - 1.0001);
      const i0 = floor(px), j0 = floor(py);
      cr(px - i0, wxo);
      cr(py - j0, wyo);
      let k = c * 16;
      for (let b = 0; b < 4; b++) {
        const jj = cl(j0 - 1 + b, 0, NY - 1) * NX;
        for (let a = 0; a < 4; a++) {
          ix[k] = jj + cl(i0 - 1 + a, 0, NX - 1);
          wt[k] = wyo[b] * wxo[a];
          k++;
        }
      }
    }
}

function advect(S, src, dst) {
  const { ix, wt } = S;
  for (let c = 0; c < NC; c++) {
    const k = c * 16;
    let s = 0;
    for (let q = 0; q < 16; q++) s += wt[k + q] * src[ix[k + q]];
    const a = src[ix[k + 5]], b = src[ix[k + 6]], d = src[ix[k + 9]], e = src[ix[k + 10]];
    const lo = min(min(a, b), min(d, e)), hi = max(max(a, b), max(d, e));
    dst[c] = s < lo ? lo : s > hi ? hi : s;
  }
}

function diffuse(src, dst, D) {
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i, v = src[c];
      const up = j > 0 ? src[c - NX] : v, dn = j < NY - 1 ? src[c + NX] : v;
      const lf = i > 0 ? src[c - 1] : v, rt = i < NX - 1 ? src[c + 1] : v;
      dst[c] = v + D * (up + dn + lf + rt - 4 * v);
    }
}

// the part of a step that moves things: advection, buoyancy, drag, diffusion
function flow(S, dt) {
  const pour = S.pour;
  const g = 3 + 1.4 * pour;
  const vb = 0.9 + 0.45 * pour;
  velocity(S);
  stencil(S, dt, vb);
  advect(S, S.om, S.o2);
  advect(S, S.w, S.w2);
  advect(S, S.c, S.c2);
  advect(S, S.Nn, S.N2);
  advect(S, S.ph, S.p2);
  advect(S, S.nf, S.n2);
  let t;
  t = S.om; S.om = S.o2; S.o2 = t;
  t = S.w; S.w = S.w2; S.w2 = t;
  t = S.c; S.c = S.c2; S.c2 = t;
  t = S.Nn; S.Nn = S.N2; S.N2 = t;
  t = S.ph; S.ph = S.p2; S.p2 = t;
  t = S.nf; S.nf = S.n2; S.n2 = t;
  const { om, w, rho } = S;
  const damp = exp(-0.25 * dt);
  for (let k = 0; k < NC; k++) {
    const v = cl(w[k], 0, 1);
    rho[k] = v * sqrt(v);
  }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const lf = i > 0 ? rho[k - 1] : rho[k], rt = i < NX - 1 ? rho[k + 1] : rho[k];
      om[k] = om[k] * damp + dt * g * 0.5 * (rt - lf);
    }
  // the pipettes push a little too
  for (const P of S.pipes) {
    const env = ss(0, 0.3, P.age) * (1 - ss(P.dur - 0.5, P.dur, P.age));
    const s2 = P.sig * P.sig;
    for (let j = 0; j < 8; j++) {
      const rowp = 1 - ss(4, 7, j);
      for (let i = max(0, floor(P.x - 3 * P.sig)); i <= min(NX - 1, floor(P.x + 3 * P.sig)); i++) {
        const d = i - P.x;
        om[j * NX + i] += dt * JET * env * rowp * (-d / s2) * exp((-0.5 * d * d) / s2);
      }
    }
  }
  diffuse(S.om, S.o2, 0.35 * dt);
  diffuse(S.w, S.w2, 0.07 * dt);
  diffuse(S.c, S.c2, 0.07 * dt);
  diffuse(S.Nn, S.N2, 0.05 * dt);
  diffuse(S.ph, S.p2, 0.05 * dt);
  t = S.om; S.om = S.o2; S.o2 = t;
  t = S.w; S.w = S.w2; S.w2 = t;
  t = S.c; S.c = S.c2; S.c2 = t;
  t = S.Nn; S.Nn = S.N2; S.N2 = t;
  t = S.ph; S.ph = S.p2; S.p2 = t;
  solvePsi(S);
}

// ---- one step of the model, dt in seconds; the flow is stepped every other call unless asked
function step(S, dt, every) {
  const pour = S.pour, warm = S.warm, Q = S.Q;
  S.acc += dt;
  if (every || (S.par++ & 1)) {
    flow(S, S.acc);
    S.acc = 0;
  }
  const kap = 0.004 * exp(5.0 * warm);
  const vcream = 0.3 + 1.7 * warm;
  const Jn = JN * exp(-0.8 * warm);
  const ceq0 = 1 + 0.15 * warm;
  const { w: W_, c: C_, Nn, ph, nf } = S;

  // chemistry: droplets are born where the oil is past SCRIT times what the water leaves it, grow while there is
  // more, dissolve when there is less, and ripen
  const nfd = exp(-dt / 0.8);
  for (let k = 0; k < NC; k++) {
    const wk = cl(W_[k], 0, 1);
    W_[k] = wk;
    const ceq = ceq0 * exp(-KQ * wk);
    let ck = C_[k], N = Nn[k], p = ph[k], f = nf[k] * nfd;
    const Sup = ck / ceq;
    if (Sup > SCRIT) {
      const dN = Jn * min((Sup - SCRIT) / SCRIT, 2.5) * dt;
      N += dN;
      const dv = min(dN * VNUC, ck);
      p += dv;
      ck -= dv;
    }
    if (p > 1e-6) {
      if (N < p / VMAX) N = p / VMAX;
      const x = cbrt(p / N);
      let d = (ck - ceq) * (1 - exp(-GG * N * x * dt));
      if (d < -p) d = -p;
      p += d;
      ck -= d;
      if (d > 0) f += d * 2.4;
      if (p > 1e-6) {
        let v = p / N + kap * dt;
        if (v > VMAX) v = VMAX;
        N = p / v;
      }
    } else { p = 0; N = 0; }
    Nn[k] = N; ph[k] = p; C_[k] = ck < 0 ? 0 : ck; nf[k] = f;
  }

  // droplets cream upward (Stokes: with the square of the size), taken out at the top
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const p = ph[k];
      if (p < 1e-5) continue;
      const x = cbrt(p / max(Nn[k], p / VMAX));
      const f = min(vcream * x * x * dt, 0.6);
      const dp = p * f, dN = Nn[k] * f;
      ph[k] -= dp; Nn[k] -= dN;
      if (j > 0) { ph[k - NX] += dp; Nn[k - NX] += dN; }
    }

  // the pipettes
  S.t += dt;
  S.next -= dt;
  if (S.next <= 0) {
    S.pipes.push({ x: 3 + rnd() * (NX - 6), age: 0, dur: 0.8 + 1.8 * rnd() * rnd(), sig: 0.7 + 0.5 * rnd(), dx: (rnd() - 0.5) * 0.8 });
    S.next = min(4, (3.2 / pour) * (0.5 + rnd()));
  }
  // fresh spirit at the top
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i, r = min(1, 3 * dt);
      W_[k] -= W_[k] * r;
      C_[k] += (Q - C_[k]) * r;
      Nn[k] *= 1 - r; ph[k] *= 1 - r;
    }
  for (let q = S.pipes.length - 1; q >= 0; q--) {
    const P = S.pipes[q];
    P.age += dt;
    if (P.age > P.dur) { S.pipes.splice(q, 1); continue; }
    P.x = cl(P.x + P.dx * dt, 2, NX - 3);
    const env = ss(0, 0.3, P.age) * (1 - ss(P.dur - 0.5, P.dur, P.age));
    for (let j = 0; j < 7; j++) {
      const rowp = 1 - ss(3.5, 6, j);
      for (let i = max(0, floor(P.x - 3 * P.sig)); i <= min(NX - 1, floor(P.x + 3 * P.sig)); i++) {
        const d = (i - P.x) / P.sig, G = exp(-0.5 * d * d) * rowp * env;
        const r = min(1, 7 * G * dt);
        const k = j * NX + i;
        W_[k] += (1 - W_[k]) * r;
        C_[k] *= 1 - r;
        Nn[k] *= 1 - r; ph[k] *= 1 - r;
      }
    }
  }
  // the drain: over the last rows the milk is let out and spirit stands in
  for (let j = NY - DRAIN; j < NY; j++) {
    const q = (j - (NY - DRAIN) + 1) / DRAIN, r = min(1, 2.5 * q * q * dt);
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      W_[k] -= W_[k] * r;
      C_[k] += (Q - C_[k]) * r;
      Nn[k] *= 1 - r; ph[k] *= 1 - r;
    }
  }
}

// ---- the picture
function tint(S) {
  // the colour a beam has passed through the spirit by, per water fraction
  const sp = [0, 0, 0], wc = [0, 0, 0], kap = [0, 0, 0];
  hsv(S.hue, 0.96, 1, sp);
  hsv(S.hue + 0.44, 0.5, 0.97, wc);
  for (let ch = 0; ch < 3; ch++) kap[ch] = -log(max(sp[ch], 0.03));
  for (let q = 0; q <= 128; q++) {
    const w = q / 128, m = ss(0.5, 1, w);
    for (let ch = 0; ch < 3; ch++) S.lutT[q * 3 + ch] = exp(-kap[ch] * (1 - w)) * (1 - m + m * wc[ch]);
  }
}

function upsample(S) {
  const px = S.px;
  for (let k = 0; k < NC; k++) {
    const p = S.ph[k];
    px[k] = p > 1e-6 ? p * cbrt(p / max(S.Nn[k], p / VMAX)) : 0;
  }
  const src = [S.w, S.ph, px, S.nf];
  for (let f = 0; f < 4; f++) {
    const s = src[f], h = S.hz[f], u = S.up[f];
    for (let j = 0; j < NY; j++) {
      const jo = j * NX;
      for (let X = 0; X < W; X++) {
        const { i0, o } = S.colx[X];
        h[j * W + X] =
          o[0] * s[jo + cl(i0 - 1, 0, NX - 1)] + o[1] * s[jo + cl(i0, 0, NX - 1)] +
          o[2] * s[jo + cl(i0 + 1, 0, NX - 1)] + o[3] * s[jo + cl(i0 + 2, 0, NX - 1)];
      }
    }
    for (let Y = 0; Y < H; Y++) {
      const { j0, o } = S.rowx[Y];
      const r0 = cl(j0 - 1, 0, NY - 1) * W, r1 = cl(j0, 0, NY - 1) * W, r2 = cl(j0 + 1, 0, NY - 1) * W, r3 = cl(j0 + 2, 0, NY - 1) * W;
      for (let X = 0; X < W; X++) u[Y * W + X] = o[0] * h[r0 + X] + o[1] * h[r1 + X] + o[2] * h[r2 + X] + o[3] * h[r3 + X];
    }
  }
}

export function setup(params) {
  params.s = build();
}

export function update(dt, input, params) {
  if (!params.s) params.s = build();
  const S = params.s;
  dt = cl(dt, 0.001, 0.1);
  knobs(S, input.knobValues);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < NC; k++) S.c[k] = S.Q;
    S.next = 0.1;
    for (let n = 0; n < 260; n++) step(S, 0.2, true);
  }
  step(S, dt, false);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  tint(S);
  upsample(S);
  const { up, lutT, lutO, lutC } = S;
  const uw = up[0], uph = up[1], upx = up[2], unf = up[3];
  const lc0 = lutC[0], lc1 = lutC[1], lc2 = lutC[2];
  const xs = XLUT / (XHI - XLO);
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const k = Y * W + X;
      const w = uw[k] < 0 ? 0 : uw[k] > 1 ? 1 : uw[k];
      const ph = uph[k] > 0 ? uph[k] : 0;
      const tq = w * 128, t0 = tq | 0, tf = tq - t0, t3 = (t0 + (t0 < 128 ? 1 : 0)) * 3;
      let x = upx[k] / (ph + 1e-4);
      x = x < XLO ? XLO : x > XHI ? XHI : x;
      const xq = (x - XLO) * xs, x0 = xq | 0, xf = xq - x0, x1 = x0 < XLUT ? x0 + 1 : x0;
      const e = exp(-KO * ph * (lutO[x0] * (1 - xf) + lutO[x1] * xf));
      const a = 1 - e;
      const fl = unf[k] > 1.5 ? 1.5 : unf[k] < 0 ? 0 : unf[k];
      const c0 = lc0[x0] * (1 - xf) + lc0[x1] * xf, c1 = lc1[x0] * (1 - xf) + lc1[x1] * xf, c2 = lc2[x0] * (1 - xf) + lc2[x1] * xf;
      const T0 = lutT[t0 * 3] * (1 - tf) + lutT[t3] * tf;
      const T1 = lutT[t0 * 3 + 1] * (1 - tf) + lutT[t3 + 1] * tf;
      const T2 = lutT[t0 * 3 + 2] * (1 - tf) + lutT[t3 + 2] * tf;
      const r = T0 * e + c0 * (0.9 + 0.1 * T0) * a + fl * 0.5;
      const g = T1 * e + c1 * (0.9 + 0.1 * T1) * a + fl * 0.8;
      const b = T2 * e + c2 * (0.9 + 0.1 * T2) * a + fl;
      display.setPixel(X, Y, r >= 1 ? 255 : (r * 255) | 0, g >= 1 ? 255 : (g * 255) | 0, b >= 1 ? 255 : (b * 255) | 0);
    }
}
