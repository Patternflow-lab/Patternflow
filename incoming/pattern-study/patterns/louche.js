// ===== Patternflow pattern =====
// Title:   Louche
// Family:  ouzo
// Idea:    Water poured into clear amber spirit that holds a little anise oil turns it milky the moment the mixture crosses the oil's solubility line, so each filament of water sinks as a plume with a sharp bright front where droplets are born, a blue haze behind it that coarsens to white and rises as cream, while fresh spirit keeps arriving and the milk drains away.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the ouzo effect, the milky cloud that spontaneous emulsification of anise oil makes when water is added to a spirit (Vitale and Katz, 2003, from memory); droplet nucleation, growth and Ostwald ripening in it (Sitnikova, Sprik, Wegdam and Eiser, 2005; Lohse and Zhang, from memory); the louche of absinthe; Rayleigh scattering. Original here: a 40 by 80 stream-function flow with buoyancy, constants tuned by eye, pattern round 266
// Round:   266
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pour=1..3, Anise=-1..1, Warmth=0..1
//
// Knob 1: Hue. The spirit's colour, with the poured water 0.44 round the wheel from it. At 0, where it opens, amber (255, 165, 10) and pale sky blue; lime at 0.25, cyan at 0.5, blue-violet at 0.75, hot pink at 1. The milk keeps its own blue and white.
// Knob 2: Pour. How much water the pipette brings and how hard gravity pulls it: about 28 pours a minute at 1, 40 at 2 where it opens and 60 at 3, each 1.2 to 3.4 s long and 3 to 7 LEDs wide. The spirit slides down at 3.5 LEDs a second at 1 and 6 at 3.
// Knob 3: Anise. How much oil the spirit holds: 34 percent of what pure spirit could dissolve at -1, 57 at 0 where it opens, 86 at 1. Droplets are born where the water fraction passes 0.33, 0.25 and 0.19. At -1 water barely clouds anything; at 1 the clouds bloom wide, covering about 20 percent of the panel at -1, 27 at 0 and 50 at 1.
// Knob 4: Warmth. Ripening against nucleation, and the shade of the amber, paler gold at 0 and richer at 1. The mean droplet volume grows by 0.004 a second at 0, 0.005 where it opens and 0.22 at 1: blue haze turns white in about a minute at 0 and in a second or so at 1. Warm droplets are born at 0.45 of the cold rate in a spirit that holds 45 percent more. Cream rises with the square of the size, 0.8 LEDs a second for size 1 at 0 and 3.5 at 1.

// What the picture is. A slice through a tall glass of spirit and nothing else. Water comes from a needle at random places and heights, a thread that falls, leans with a slow cross current and rolls up at its head. Where it
// has mixed in far enough a bright front runs out through the amber and milk follows it: young haze sky blue, older white, the oldest cream. Fresh spirit slides in from the top; the milk is let out over the bottom 30 LEDs.
// The model. Fields on a 40 by 80 grid, drawn up to 64 by 128 with cubic filters. Water fraction w, dissolved oil c and the spirit's streaks ride an incompressible flow: a stream function from the vorticity, solved by
// a sine transform across and a tridiagonal solve down, free slip at the walls. Water is heavier than spirit, and the sideways slope of the density w^1.5 makes the vorticity. Oil is soluble up to exp(-6w) of what the spirit
// holds; the supersaturation S is the oil over that. Droplets are born where S is past 1.3 plus the anise number, take oil until S is 1, and dissolve where it falls under 1. They ripen by Ostwald's rule (the mean volume grows at
// one rate, the number falls to keep the oil) and cream upward with the square of their size. Light: opacity from the droplet oil and a size factor; scattered colour per channel (1 - exp(-(x/lambda)^4)) / x, Rayleigh blue
// for small droplets and white for large; amber through the spirit by Beer-Lambert.
// What is not exact. The units are dimensionless, every rate is tuned by eye, and model seconds run 1.35 to the panel's. The flow-through is invented: the top 5 LEDs are spirit, it moves down at the speed Pour sets, and
// over the bottom 30 LEDs the mix relaxes to fresh spirit. A pour is a patch of pure water held in place, pushed down and turned, each with its own strength, width, drift and depth; the hand's mood is a random walk; the
// cross current is two sines in depth; the opening is twelve scripted pours of different ages. The optics is one slab: scattered light rises as 1 - e^(-2 tau) while amber falls as e^(-tau), which makes the bright front, with
// a glow where oil condenses. The depth of the amber (gradient, vignette, advected streaks, schlieren from the water's slope, glints) and the light from the upper left on the clouds are not physical.

const W = 64, H = 128;
const NX = 40, NY = 80, NC = NX * NY;
const CELL = W / NX; // LEDs to a cell of the grid the model runs on
const R = CELL / 2; // the constants below were tuned on cells of 2 LEDs
const { floor, sqrt, cbrt, exp, sin, cos, min, max, PI, pow, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

const KQ = 6.0; // solubility falls as exp(-KQ w)
const SCRIT0 = 1.3; // droplets are born past this plus the anise number
const JN = 90; // nuclei born a second at twice the critical S
const VNUC = 0.0012; // volume of a nucleus
const GG = 5; // growth rate
const DRAIN = Math.round(15 / R); // rows at the foot where the milk is let out
const VMAX = 8; // mean droplet volume at most
const TEMPO = 1.35; // the model's seconds to the panel's
const PRE_N = 200, PRE_DT = 0.2;
const JET = 3.5; // how hard a pipette's stream is pushed down
const SPIN = 2;
const SHEAR = 0.45; // cells a second of the cross current
const TXK = 0.2;
const SCH = 0.8, EDG = 1.0;
// size at which a droplet scatters each channel like a wavelength-sized sphere
const LAM = [0.66, 0.52, 0.42];
const XLUT = 256, XLO = 0.1, XHI = 2.3;
const KO = 6; // optical depth per unit of droplet oil
const SHADE = 3;

function cr(t, o) {
  const t2 = t * t, t3 = t2 * t;
  o[0] = 0.5 * (-t3 + 2 * t2 - t);
  o[1] = 0.5 * (3 * t3 - 5 * t2 + 2);
  o[2] = 0.5 * (-3 * t3 + 4 * t2 + t);
  o[3] = 0.5 * (t3 - t2);
}

function hsv(h, s, v, o) {
  h = h - floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const r = [v, q, p, p, t, v], g = [t, v, v, q, p, p], b = [p, p, t, v, v, q];
  o[0] = r[i % 6]; o[1] = g[i % 6]; o[2] = b[i % 6];
}

function build() {
  const f = () => new Float32Array(NC);
  const S = {
    ready: false, t: 0, hue: 0, pour: 2, Q: 0.5, warm: 0.06, acc: 0, par: 0,
    w: f(), c: f(), Nn: f(), ph: f(), om: f(), nf: f(),
    w2: f(), c2: f(), N2: f(), p2: f(), o2: f(), tx: f(), tx2: f(), dc: f(),
    rho: f(), psi: f(), uu: f(), vv: f(), px: f(),
    ix: new Int32Array(NC * 16), wt: new Float32Array(NC * 16),
    t1: new Float64Array(NC),
    Sx: new Float64Array(NX * NX), mm: new Float64Array(NC), cp: new Float64Array(NC),
    pipes: [], script: [], next: 0.2, mood: 0, kc: [0, 0, 0], tp: [0, 0, 0, 0, 0].map(() => rnd() * 6.28),
    gl: [0, 1, 2, 3].map((i) => ({ f1: 0.02 + 0.017 * rnd() + 0.006 * i, f2: 0.013 + 0.015 * rnd() + 0.005 * i, p1: rnd() * 6.28, p2: rnd() * 6.28, r: 5 + 4 * rnd(), a: 0.25 + 0.15 * rnd(), cx: 0, cy: 0 })),
    vgx: new Float32Array(W), vgy: new Float32Array(H), sh: new Float32Array(NY), sp: [rnd() * 6.28, rnd() * 6.28],
    up: [0, 1, 2, 3, 4].map(() => new Float32Array(W * H)), hz: [0, 1, 2, 3, 4].map(() => new Float32Array(NY * W)),
    lutO: new Float32Array(XLUT + 1), lutC: [0, 1, 2].map(() => new Float32Array(XLUT + 1)),
    lutT: new Float32Array(129 * 3),
    colI: new Int32Array(W * 4), colW: new Float32Array(W * 4), rowI: new Int32Array(H * 4), rowW: new Float32Array(H * 4),
  };
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
  // what a droplet of size x does to light
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
      const warmW = ch === 0 ? 1 : ch === 1 ? 0.99 : 0.96;
      const cc = 0.35 + 0.65 * pow(ratio[ch] / (qx + 1e-6), 0.7);
      S.lutC[ch][i] = cc * (1 - cream) + warmW * cream;
    }
  }
  for (let X = 0; X < W; X++) S.vgx[X] = 1 - 0.07 * pow((X - 31.5) / 32, 2);
  for (let Y = 0; Y < H; Y++) S.vgy[Y] = 1 - 0.03 * pow((Y - 63.5) / 64, 2);
  const o = [0, 0, 0, 0];
  for (let X = 0; X < W; X++) {
    const g = (X + 0.5) / CELL - 0.5, i0 = floor(g);
    cr(g - i0, o);
    for (let a = 0; a < 4; a++) { S.colI[X * 4 + a] = cl(i0 - 1 + a, 0, NX - 1); S.colW[X * 4 + a] = o[a]; }
  }
  for (let Y = 0; Y < H; Y++) {
    const g = (Y + 0.5) / CELL - 0.5, j0 = floor(g);
    cr(g - j0, o);
    for (let a = 0; a < 4; a++) { S.rowI[Y * 4 + a] = cl(j0 - 1 + a, 0, NY - 1) * W; S.rowW[Y * 4 + a] = o[a]; }
  }
  return S;
}

function knobs(S, kv) {
  S.hue = 0.105 + 0.82 * kv[0];
  S.pour = kv[1];
  const t = (cl(kv[2], -1, 1) + 1) / 2;
  const Q = 0.34 + 0.52 * pow(t, 1.16);
  if (S.Q !== Q && S.ready) {
    const r = Q / S.Q;
    for (let i = 0; i < NC; i++) S.c[i] *= r;
  }
  S.Q = Q;
  S.warm = cl(kv[3], 0, 1);
}

// stream function from the vorticity
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

const wxo = [0, 0, 0, 0], wyo = [0, 0, 0, 0];
function stencil(S, dt, vb) {
  const { uu, vv, ix, wt, sh } = S;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const c = j * NX + i;
      const px = cl(i - (uu[c] + sh[j]) * dt, 0, NX - 1.0001), py = cl(j - (vv[c] + vb) * dt, 0, NY - 1.0001);
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

// the part of a step that moves things
function flow(S, dt) {
  const pour = S.pour;
  const g = (3 + 1.4 * pour) / R;
  const vb = (0.8 + 0.5 * pour) / R;
  // a slow cross current, so nothing falls straight
  for (let j = 0; j < NY; j++) S.sh[j] = (SHEAR / R) * (sin(0.1 * j * R + S.sp[0] + 0.05 * S.t) + 0.6 * sin(0.26 * j * R + S.sp[1] - 0.04 * S.t));
  velocity(S);
  stencil(S, dt, vb);
  advect(S, S.om, S.o2);
  advect(S, S.w, S.w2);
  advect(S, S.c, S.c2);
  advect(S, S.Nn, S.N2);
  advect(S, S.ph, S.p2);
  advect(S, S.tx, S.tx2);
  let t;
  t = S.om; S.om = S.o2; S.o2 = t;
  t = S.w; S.w = S.w2; S.w2 = t;
  t = S.c; S.c = S.c2; S.c2 = t;
  t = S.Nn; S.Nn = S.N2; S.N2 = t;
  t = S.ph; S.ph = S.p2; S.p2 = t;
  t = S.tx; S.tx = S.tx2; S.tx2 = t;
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
  for (const P of S.pipes) {
    const env = ss(0, 0.3, P.age) * (1 - ss(P.dur - 0.5, P.dur, P.age)) * P.amp;
    const s2 = P.sig * P.sig;
    for (let j = 0; j < 8 / R && P.y0 + j < NY; j++) {
      const rowp = 1 - ss(4 / R, 7 / R, j);
      for (let i = max(0, floor(P.x - 3 * P.sig)); i <= min(NX - 1, floor(P.x + 3 * P.sig)); i++) {
        const d = i - P.x;
        om[(P.y0 + j) * NX + i] += dt * env * rowp * ((JET / R) * (-d / s2) + SPIN * P.spin + 2.5 * (rnd() - 0.5)) * exp((-0.5 * d * d) / s2);
      }
    }
  }
  diffuse(S.om, S.o2, (0.2 / (R * R)) * dt);
  diffuse(S.w, S.w2, (0.03 / (R * R)) * dt);
  diffuse(S.c, S.c2, (0.03 / (R * R)) * dt);
  diffuse(S.Nn, S.N2, (0.05 / (R * R)) * dt);
  diffuse(S.ph, S.p2, (0.05 / (R * R)) * dt);
  t = S.om; S.om = S.o2; S.o2 = t;
  t = S.w; S.w = S.w2; S.w2 = t;
  t = S.c; S.c = S.c2; S.c2 = t;
  t = S.Nn; S.Nn = S.N2; S.N2 = t;
  t = S.ph; S.ph = S.p2; S.p2 = t;
  solvePsi(S);
}

// the streaks that arrive with the spirit: five slow waves across the glass
function streak(S, i) {
  const t = S.t, p = S.tp;
  return (
    0.4 * sin(0.61 * i + 0.09 * t + p[0]) + 0.3 * sin(1.13 * i - 0.14 * t + p[1]) + 0.25 * sin(1.87 * i + 0.21 * t + p[2]) +
    0.2 * sin(2.41 * i - 0.27 * t + p[3]) + 0.15 * sin(3.3 * i + 0.33 * t + p[4])
  );
}

function pipe(x) {
  return { x, y0: rnd() < 0.4 ? 0 : floor(rnd() * 0.4 * NY), age: 0, dur: 1.2 + 2.2 * rnd() * rnd(), sig: (0.65 + 0.7 * rnd()) / R, dx: ((rnd() - 0.5) * 3) / R, amp: 0.6 + 0.8 * rnd(), wob: rnd() * 6.28, spin: (rnd() - 0.5) * 2 };
}

// one step of the model; the flow is stepped every other call unless asked
function step(S, dt, every) {
  const pour = S.pour, warm = S.warm, Q = S.Q;
  S.acc += dt;
  if (every || (S.par++ & 1)) {
    flow(S, S.acc);
    S.acc = 0;
  }
  const kap = 0.004 * exp(4.0 * warm);
  const vcream = (0.3 + 1.0 * warm) / R;
  const Jn = JN * exp(-0.8 * warm);
  const ceq0 = 1 + 0.45 * warm;
  const SCRIT = SCRIT0 + Q;
  const { w: W_, c: C_, Nn, ph, nf } = S;

  // chemistry: droplets are born, grow, dissolve and ripen
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

  // droplets cream upward with the square of their size
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

  // the hand's slow moods: lulls and bursts
  S.t += dt;
  S.mood += (-S.mood * dt) / 40 + 0.15 * sqrt(dt) * (rnd() + rnd() + rnd() + rnd() - 2) * 1.73;
  S.mood = cl(S.mood, -2, 2);
  const hand = exp(0.4 * S.mood);
  S.next -= dt;
  while (S.script.length && S.script[0].t <= S.t) S.pipes.push(S.script.shift());
  if (S.next <= 0) {
    S.pipes.push(pipe(3 / R + rnd() * (NX - 6 / R)));
    S.next = min(3.2, ((3.2 * (0.75 + 0.6 * Q)) / (pour * hand)) * (0.5 + rnd()));
  }
  for (let j = 0; j < 2 / R; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i, r = min(1, 3 * dt);
      W_[k] -= W_[k] * r;
      C_[k] += (Q - C_[k]) * r;
      Nn[k] *= 1 - r; ph[k] *= 1 - r;
      S.tx[k] += (streak(S, i) - S.tx[k]) * r;
    }
  for (let q = S.pipes.length - 1; q >= 0; q--) {
    const P = S.pipes[q];
    P.age += dt;
    if (P.age > P.dur) { S.pipes.splice(q, 1); continue; }
    P.x = cl(P.x + (P.dx + (1.6 / R) * sin(P.wob + 2.3 * P.age)) * dt, 2 / R, NX - 3 / R);
    const env = ss(0, 0.3, P.age) * (1 - ss(P.dur - 0.5, P.dur, P.age)) * P.amp;
    for (let j = 0; j < 7 / R && P.y0 + j < NY; j++) {
      const rowp = 1 - ss(3.5 / R, 6 / R, j);
      for (let i = max(0, floor(P.x - 3 * P.sig)); i <= min(NX - 1, floor(P.x + 3 * P.sig)); i++) {
        const d = (i - P.x) / P.sig, G = exp(-0.5 * d * d) * rowp * env;
        const r = min(1, 7 * G * dt);
        const k = (P.y0 + j) * NX + i;
        W_[k] += (1 - W_[k]) * r;
        C_[k] *= 1 - r;
        Nn[k] *= 1 - r; ph[k] *= 1 - r;
      }
    }
  }
  // the drain
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

function tint(S) {
  const sp = [0, 0, 0], wc = [0, 0, 0], kap = [0, 0, 0];
  S.dw = 0.36 * (S.warm - 0.5) + 0.08;
  hsv(S.hue, 0.96, 1, sp);
  hsv(S.hue + 0.44, 0.5, 0.97, wc);
  for (let ch = 0; ch < 3; ch++) S.kc[ch] = kap[ch] = -log(max(sp[ch], 0.03));
  for (let q = 0; q <= 128; q++) {
    const w = q / 128, m = ss(0.5, 1, w);
    for (let ch = 0; ch < 3; ch++) S.lutT[q * 3 + ch] = exp(-kap[ch] * (1 - w)) * (1 - m + m * wc[ch]);
  }
}

// how deep the spirit's colour runs, per cell: gradient, sides, streaks that came in with it, slow glints
function lightfield(S) {
  const { dc, tx, gl } = S, t = S.t;
  for (const G of gl) {
    G.cx = (0.5 + 0.4 * sin(G.f1 * t + G.p1)) * NX;
    G.cy = (0.5 + 0.42 * sin(G.f2 * t + G.p2)) * NY;
  }
  for (let j = 0; j < NY; j++) {
    const by = 0.72 + 0.26 * (j / (NY - 1));
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i, gx = (2 * i) / (NX - 1) - 1;
      let d = by + 0.14 * gx * gx + TXK * tx[k];
      for (let q = 0; q < 4; q++) {
        const G = gl[q], dx = (i - G.cx) / (G.r / R), dy = (j - G.cy) / (1.5 * G.r / R);
        d -= G.a * exp(-(dx * dx + dy * dy));
      }
      dc[k] = d;
    }
  }
}

function upsample(S) {
  const px = S.px;
  for (let k = 0; k < NC; k++) {
    const p = S.ph[k];
    px[k] = p > 1e-6 ? p * cbrt(p / max(S.Nn[k], p / VMAX)) : 0;
  }
  lightfield(S);
  const src = [S.w, S.ph, px, S.nf, S.dc];
  const ci = S.colI, cw = S.colW, ri = S.rowI, rw = S.rowW;
  for (let f = 0; f < 5; f++) {
    const s = src[f], h = S.hz[f], u = S.up[f];
    for (let j = 0; j < NY; j++) {
      const jo = j * NX;
      for (let X = 0; X < W; X++) {
        const q = X * 4;
        h[j * W + X] = cw[q] * s[jo + ci[q]] + cw[q + 1] * s[jo + ci[q + 1]] + cw[q + 2] * s[jo + ci[q + 2]] + cw[q + 3] * s[jo + ci[q + 3]];
      }
    }
    for (let Y = 0; Y < H; Y++) {
      const q = Y * 4, r0 = ri[q], r1 = ri[q + 1], r2 = ri[q + 2], r3 = ri[q + 3], w0 = rw[q], w1 = rw[q + 1], w2 = rw[q + 2], w3 = rw[q + 3];
      for (let X = 0; X < W; X++) u[Y * W + X] = w0 * h[r0 + X] + w1 * h[r1 + X] + w2 * h[r2 + X] + w3 * h[r3 + X];
    }
  }
}

export function setup(params) {
  params.s = build();
}

export function update(dt, input, params) {
  if (!params.s) params.s = build();
  const S = params.s;
  dt = cl(dt, 0.001, 0.1) * TEMPO;
  knobs(S, input.knobValues);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < NC; k++) S.c[k] = S.Q;
    // twelve pours of different ages and places, so plumes stand at several heights; then the hand takes over
    rnd(); rnd(); rnd();
    const T = PRE_N * PRE_DT, ages = [0.8, 2, 3.5, 5, 7, 9, 11.5, 14, 17, 20, 23, 27], at = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (let q = at.length - 1; q > 0; q--) { const z = floor(rnd() * (q + 1)), tmp = at[q]; at[q] = at[z]; at[z] = tmp; }
    ages.forEach((age, q) => {
      const P = pipe(3 / R + ((at[q] + 0.15 + 0.7 * rnd()) / 12) * (NX - 6 / R));
      P.t = T - age;
      S.script.push(P);
    });
    S.script.sort((p, q) => p.t - q.t);
    S.next = 1e9;
    for (let n = 0; n < PRE_N; n++) step(S, PRE_DT, true);
    S.next = 0.3 + rnd();
  }
  step(S, dt, false);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  tint(S);
  upsample(S);
  const { up, lutT, lutO, lutC, kc, vgx, vgy } = S;
  const uw = up[0], uph = up[1], upx = up[2], unf = up[3], udc = up[4];
  const lc0 = lutC[0], lc1 = lutC[1], lc2 = lutC[2];
  const xs = XLUT / (XHI - XLO);
  const k0 = kc[0] > 0.02 ? kc[0] : 0, k1 = kc[1] > 0.02 ? kc[1] : 0, k2 = kc[2] > 0.02 ? kc[2] : 0;
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const k = Y * W + X;
      const w = uw[k] < 0 ? 0 : uw[k] > 1 ? 1 : uw[k];
      const ph = uph[k] > 0 ? uph[k] : 0;
      const tq = w * 128, t0 = tq | 0, tf = tq - t0, t3 = (t0 + (t0 < 128 ? 1 : 0)) * 3;
      // depth of the amber here, with schlieren threads and a richer edge where the water slopes
      let dm = udc[k] - 1;
      if (X > 0 && X < W - 1 && Y > 0 && Y < H - 1) {
        const gx = uw[k + 1] - uw[k - 1], gy = uw[k + W] - uw[k - W];
        const sg = gx + gy, ax = gx < 0 ? -gx : gx, ay = gy < 0 ? -gy : gy;
        const mg = ax > ay ? ax + 0.4 * ay : ay + 0.4 * ax;
        dm += SCH * (sg < -0.3 ? -0.3 : sg > 0.3 ? 0.3 : sg) + EDG * (mg > 0.3 ? 0.3 : mg);
      }
      dm += S.dw;
      dm = dm < -0.5 ? -0.5 : dm > 0.28 ? 0.28 : dm;
      const sw = (1 - w) * dm, vg = vgx[X] * vgy[Y];
      const T0 = (lutT[t0 * 3] * (1 - tf) + lutT[t3] * tf) * vg * (k0 ? exp(-k0 * sw) : 1);
      const T1 = (lutT[t0 * 3 + 1] * (1 - tf) + lutT[t3 + 1] * tf) * vg * (k1 ? exp(-k1 * sw) : 1);
      const T2 = (lutT[t0 * 3 + 2] * (1 - tf) + lutT[t3 + 2] * tf) * vg * (k2 ? exp(-k2 * sw) : 1);
      if (ph < 0.0015 && unf[k] < 0.01) {
        display.setPixel(X, Y, (T0 * 255) | 0, (T1 * 255) | 0, (T2 * 255) | 0);
        continue;
      }
      let x = upx[k] / (ph + 1e-4);
      x = x < XLO ? XLO : x > XHI ? XHI : x;
      const xq = (x - XLO) * xs, x0 = xq | 0, xf = xq - x0, x1 = x0 < XLUT ? x0 + 1 : x0;
      const e = exp(-KO * ph * (lutO[x0] * (1 - xf) + lutO[x1] * xf));
      const a = 1 - e * e; // scattered light rises faster than amber goes out: a bright front
      const fl = unf[k] > 1.5 ? 1.5 : unf[k] < 0 ? 0 : unf[k];
      const c0 = lc0[x0] * (1 - xf) + lc0[x1] * xf, c1 = lc1[x0] * (1 - xf) + lc1[x1] * xf, c2 = lc2[x0] * (1 - xf) + lc2[x1] * xf;
      // light from the upper left, from the slope of the droplet oil
      const ka = X > 1 && Y > 1 ? k - W - 1 : k, kb = X < W - 2 && Y < H - 2 ? k + W + 1 : k;
      let sh = 1 + SHADE * (uph[ka] - uph[kb]);
      sh = sh < 0.9 ? 0.9 : sh > 1.2 ? 1.2 : sh;
      const r = T0 * e + c0 * (0.9 + 0.1 * T0) * a * sh + fl * 0.5;
      const g = T1 * e + c1 * (0.9 + 0.1 * T1) * a * sh + fl * 0.8;
      const b = T2 * e + c2 * (0.9 + 0.1 * T2) * a * sh + fl;
      display.setPixel(X, Y, r >= 1 ? 255 : (r * 255) | 0, g >= 1 ? 255 : (g * 255) | 0, b >= 1 ? 255 : (b * 255) | 0);
    }
}
