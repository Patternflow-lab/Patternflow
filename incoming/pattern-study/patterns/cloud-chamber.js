// ===== Patternflow pattern =====
// Title:   Cloud Chamber
// Family:  particle
// Idea:    A diffusion cloud chamber seen from above through its glass lid, lit by a lamp strip along its left wall: cosmic muons rule thin straight lines across the black felt while radon alphas and stray electrons leave short thick bars and faint curling threads, each trail condensing in a flash and then drifting on the slow convection of the alcohol mist, spreading and fading over a few seconds.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 27, after the continuously sensitive diffusion cloud chamber Alexander Langsdorf described in 1939, a descendant of C. T. R. Wilson's expansion cloud chamber
// Round:   27
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Source=0..1, Field=0..1
//
// Knob 1: Light. The lamp along the left wall: a cold blue-white LED strip at 0, a warm halogen tube with a wide glow at a third, a thin green laser sheet at two thirds and a violet ultraviolet tube at 1. The mist near the wall glows in its colour and the brightest trails go nearly white.
// Knob 2: Speed. How fast the vapour turns over: at 2 a trail drifts a LED or two a second and is gone in about three and a half seconds; at 0.2 the drift is ten times slower and trails stay four times as long, coming four times less often.
// Knob 3: Source. A thoriated rod stood at the bottom of the chamber: at 0 there is none and only cosmic rays and the radon in the air leave trails; turned up, the rod appears and sprays a fan of alpha tracks from its tip, up to five a second, and thoron gas drifting off it leaves V-shaped pairs of alphas from one point.
// Knob 4: Field. A magnet under the floor: at 0.06 the trails are almost straight and the electrons only wander; turned up, electrons curl into tight spirals that wind inward as they slow, and the long muon lines bow into shallow arcs. Now and then a positron curls the other way.
// Buttons: K1 tap sends a cosmic-ray shower through: a dozen parallel muon and electron tracks at once. K2 tap clears the chamber: the trails blur out and sink while the mist rains down and dims. New trails start again a second later.

const W = 64, H = 128, N = W * H, CAP = 16384, ND = 170, DS = 0.6, SQ = Math.sqrt(DS);
const { min, max, floor, ceil, sqrt, exp, sin, cos, log, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y, p) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const x0 = xi % p, y0 = yi % p, x1 = (xi + 1) % p, y1 = (yi + 1) % p, a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(x1, y1)) * su * sv;
}
// The mist's sheen: a 64 by 64 tile of soft noise that wraps both ways.
const NZ = new Float32Array(4096).map((_, k) => 0.65 * vn((k & 63) / 8, (k >> 6) / 8, 8) + 0.35 * vn((k & 63) / 4, (k >> 6) / 4, 16));
function nz(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, x0 = xi & 63, y0 = (yi & 63) << 6, x1 = (xi + 1) & 63, y1 = ((yi + 1) & 63) << 6;
  return mix(mix(NZ[y0 + x0], NZ[y0 + x1], u), mix(NZ[y1 + x0], NZ[y1 + x1], u), v);
}
// A droplet is a round Gaussian; GL holds exp(-q / 32) out to where it is under 3%.
const GN = 112, GL = new Float32Array(GN).map((_, q) => exp(-q / 32));
// The lamp lights the wall side best; a trail across the chamber is about 0.55 as bright.
const LIT = new Float32Array(W).map((_, x) => 0.48 + 0.52 * exp(-x / 30));
const STRIP = new Float32Array(H).map((_, y) => 0.86 + 0.14 * hash(y >> 2, 3));

// Lamps: colour, near glow, its width in LEDs, far glow, drizzle, trails.
// The laser sheet lights only the sensitive layer, so its trails stand out hardest.
const LAMPS = [
  [0.6, 0.8, 1, 0.28, 6, 0.035, 1, 1],
  [1, 0.9, 0.72, 0.3, 13, 0.1, 0.9, 0.9],
  [0.4, 1, 0.6, 0.15, 3.5, 0.03, 1.3, 1.25],
  [0.7, 0.46, 1, 0.3, 8, 0.08, 1.15, 0.9],
];

// Trail kinds: droplet radius, line brightness, life in seconds, how fast the
// trail spreads (LED squared a second), bending radius in a full field,
// scatter, bead spread, missing droplets, brightening toward the end, whether
// it slows to a stop (curling tighter), delta rays per LED.
const kind = (sig, I, life, D, R, sc, bead, gap, br, slow, dl) => ({ sig, I, life, D, R, sc, bead, gap, br, slow, dl });
const MU = kind(0.5, 0.85, 3.4, 0.16, 380, 0.004, 0.55, 0.08, 0, 0, 1 / 170);
const BE = kind(0.46, 0.7, 2.9, 0.2, 16, 0.085, 0.7, 0.28, 0.9, 1, 0);
const DE = kind(0.44, 0.65, 2.6, 0.2, 5, 0.12, 0.6, 0.2, 0.7, 1, 0);
const AL = kind(0.7, 1.9, 4, 0.14, 6000, 0.004, 0.2, 0, 0.45, 0, 0);
// Source alphas are a touch thinner and go sooner, so the fan reads ray by ray.
const AS = kind(0.6, 1.6, 2.6, 0.12, 6000, 0.004, 0.2, 0, 0.45, 0, 0);
const PR = kind(0.6, 1.3, 3.8, 0.18, 900, 0.01, 0.3, 0.02, 0.35, 0, 1 / 90);
// The thoriated rod's tip.
const SX = 40.5, SY = 117.5;

export function setup(params) {
  const F = (n) => new Float32Array(n), D = (n) => new Float64Array(n);
  params.s = {
    T: F(N), U: F(153), V: F(153), PX: F(CAP), PY: F(CAP), PU: F(CAP), PV: F(CAP), PB: D(CAP), PL: F(CAP), PS: F(CAP), PK: F(CAP), PD: F(CAP),
    DX: F(ND), DY: F(ND), DB: D(ND), DL: F(ND), DA: F(ND), head: 0, tail: 0, tf: 0, td: 0, wr: 99, tw: -99, ox: 0, oy: 0,
    tsf: 1, tsd: 1, field: 0.06, src: 0, lamp: [...LAMPS[0]], k1: -1, live: 0, pend: [], cnt: [0, 0, 0, 0, 0, 0, 0].map(() => -log(1 - rnd())),
  };
  const S = params.s;
  for (let j = 0; j < ND; j++) drop(S, j, -rnd() * 1.4);
}

function puff(S, x, y, sig, I, life, D) {
  const i = S.head++ & (CAP - 1), a = rnd() * 6.283, v = 0.1 + 0.35 * rnd();
  if (S.head - S.tail > CAP) S.tail = S.head - CAP;
  S.PX[i] = x;
  S.PY[i] = y;
  // Each droplet wanders a little on its own, so an old trail frays.
  S.PU[i] = v * cos(a);
  S.PV[i] = v * sin(a);
  S.PB[i] = S.tf;
  S.PL[i] = life * (0.85 + 0.3 * rnd());
  S.PS[i] = 2 * sig * sig;
  // Scaled so a line of droplets DS apart peaks at I.
  S.PK[i] = I * sig * DS * 0.798;
  S.PD[i] = D;
}

// Lays a trail of droplets from x, y heading th. A charge q bends it in the
// field; a slowing particle bends tighter and scatters more toward its end.
// With clip set it starts outside and stops once it has crossed the panel.
function trail(S, x, y, th, len, k, q, R0, clip, I = k.I) {
  const n = max(1, ceil(len / DS)), f = S.field, life = k.life * (0.85 + 0.3 * rnd());
  let inside = 0;
  for (let j = 0; j <= n; j++) {
    const rem = 1 - j / n, inn = x > -2 && x < W + 2 && y > -2 && y < H + 2;
    if (clip) {
      if (inn) inside = 1;
      else if (inside) break;
    }
    if (inn && rnd() >= k.gap) puff(S, x, y, k.sig * (1 + 0.3 * k.br * (1 - rem) ** 2), I * (1 + k.bead * (rnd() * 2 - 1)) * (1 + k.br * (1 - rem) ** 2), life, k.D);
    // A knock-on electron kicked sideways out of the trail.
    if (k.dl && inn && rnd() < k.dl * DS) {
      const s = rnd() < 0.5 ? -1 : 1;
      trail(S, x, y, th + s * (0.9 + 0.6 * rnd()), 3 + 11 * rnd(), DE, -1, 2 + 5 * rnd(), 0);
    }
    const R = R0 * (k.slow ? sqrt(rem + 0.03) : 1);
    th += q * min(0.5, (f * DS) / R) + (k.sc * gauss() * SQ) / (k.slow ? sqrt(rem + 0.12) : 1);
    x += cos(th) * DS;
    y += sin(th) * DS;
  }
  return [x, y, th];
}

const beta = (S, x, y, th, len) => trail(S, x, y, th, len, BE, rnd() < 0.9 ? -1 : 1, 8 + 22 * rnd(), 0);

// A muon through a point of the chamber; most cross it the long way.
function muon(S, px, py, th) {
  const stop = rnd() < 0.1, len = stop ? 170 + 60 * rnd() : 400;
  const e = trail(S, px - cos(th) * 170, py - sin(th) * 170, th, len, MU, rnd() < 0.55 ? 1 : -1, 220 + 380 * rnd(), 1);
  // One that stops in the chamber decays: an electron leaves its end at an angle.
  if (stop && e[0] > 0 && e[0] < W && e[1] > 0 && e[1] < H) beta(S, e[0], e[1], e[2] + (rnd() < 0.5 ? -1 : 1) * (0.6 + 1.8 * rnd()), 30 + 30 * rnd());
}
const steep = () => (rnd() < 0.62 ? PI / 2 + 0.45 * gauss() + (rnd() < 0.5 ? PI : 0) : rnd() * 2 * PI);

// An alpha: short, thick, dead straight, thickest at its end. Now and then it
// glances off a nucleus near its end and the recoil leaves a stub: a fork.
function alpha(S, x, y, th, len) {
  if (rnd() < 0.14 && len > 7) {
    const e = trail(S, x, y, th, len * 0.75, AL, 1, 6000, 0, AL.I * 0.9), s = rnd() < 0.5 ? -1 : 1;
    trail(S, e[0], e[1], e[2] + s * (0.4 + 0.6 * rnd()), len * 0.3, AL, 1, 6000, 0);
    trail(S, e[0], e[1], e[2] - s * (0.9 + 0.6 * rnd()), 1.5 + 2 * rnd(), AL, 1, 6000, 0, AL.I * 1.3);
  } else trail(S, x, y, th, len, AL, 1, 6000, 0);
}

// A cosmic proton breaks up a nucleus: a thin track in and a star of thick prongs.
function star(S) {
  const x = 10 + 44 * rnd(), y = 16 + 96 * rnd(), th = steep();
  trail(S, x - cos(th) * 90, y - sin(th) * 90, th, 90, MU, 1, 600, 0);
  for (let j = 0, n = 2 + floor(rnd() * 3); j < n; j++) trail(S, x, y, rnd() * 2 * PI, 5 + 16 * rnd(), PR, 1, 900, 0);
  if (rnd() < 0.5) trail(S, x, y, th + gauss() * 0.6, 40 + 40 * rnd(), MU, rnd() < 0.5 ? 1 : -1, 300, 1);
}

// A shower: one direction for all, muons in parallel and electrons beside them.
function shower(S) {
  const th = steep(), c = cos(th), s = sin(th), n = 7 + floor(rnd() * 5);
  for (let j = 0; j < n; j++) {
    const o = (rnd() * 2 - 1) * 34;
    muon(S, 32 - s * o + c * gauss() * 20, 64 + c * o + s * gauss() * 20, th + 0.012 * gauss());
  }
  for (let j = 0, m = 3 + floor(rnd() * 4); j < m; j++) {
    const o = (rnd() * 2 - 1) * 30, a = (rnd() * 2 - 1) * 50;
    beta(S, 32 - s * o + c * a, 64 + c * o + s * a, th + 0.2 * gauss(), 25 + 40 * rnd());
  }
}

function spawn(S, k) {
  const src = S.src;
  if (k === 0) muon(S, rnd() * W, rnd() * H, steep());
  // A steep muon crosses the thin sensitive layer in a few LEDs.
  else if (k === 1) trail(S, rnd() * W, rnd() * H, rnd() * 2 * PI, 3 + 11 * rnd(), MU, 1, 400, 0);
  else if (k === 2) beta(S, rnd() * W, rnd() * H, rnd() * 2 * PI, 18 + 55 * rnd());
  // Radon in the air: an alpha anywhere, foreshortened when it leaves the layer.
  else if (k === 3) alpha(S, 3 + rnd() * (W - 3), rnd() * H, rnd() * 2 * PI, 3 + 11 * rnd() ** 0.7);
  else if (k === 4) star(S);
  else if (k === 5) {
    const t = -PI / 2 + (rnd() * 2 - 1) * 1.35;
    trail(S, SX + cos(t) * 1.5, SY + 1 + sin(t) * 1.5, t, 11 + 18 * rnd(), AS, 1, 6000, 0);
  } else if (k === 6 && src > 0.02) {
    // Thoron off the rod; its daughter decays a fraction of a second later from the same point.
    const x = cl(SX + gauss() * 13, 4, W - 2), y = SY - 6 - 40 * rnd() ** 1.5;
    alpha(S, x, y, rnd() * 2 * PI, 6 + 10 * rnd());
    S.pend.push([S.tf + 0.1 + 0.3 * rnd(), x, y]);
  }
}

// The vapour's slow convection on a grid of 9 by 17 nodes, 8 LEDs apart: the
// curl of a few drifting waves, so it neither piles up nor thins out, and a
// gentle drift that turns round over a minute or two.
const MODES = [[0.09, 0.05, 0.11, 0, 9], [-0.06, 0.08, -0.09, 2, 8], [0.13, -0.11, 0.13, 4, 4], [0.03, 0.12, 0.07, 1.3, 6]];
function flow(S) {
  const t = S.td, mu = 0.45 * cos(t * 0.05), mv = 0.45 * sin(t * 0.07 + 1);
  for (let j = 0; j < 17; j++)
    for (let i = 0; i < 9; i++) {
      let u = mu, v = mv;
      for (const [kx, ky, w, p, a] of MODES) {
        const c = a * cos(kx * i * 8 + ky * j * 8 + w * t + p);
        u += ky * c;
        v -= kx * c;
      }
      S.U[j * 9 + i] = u;
      S.V[j * 9 + i] = v;
    }
  return [mu, mv];
}
function vel(S, x, y, out) {
  const gx = cl(x / 8, 0, 7.999), gy = cl(y / 8, 0, 15.999), i = floor(gx), j = floor(gy), u = gx - i, v = gy - j, k = j * 9 + i;
  out[0] = mix(mix(S.U[k], S.U[k + 1], u), mix(S.U[k + 9], S.U[k + 10], u), v);
  out[1] = mix(mix(S.V[k], S.V[k + 1], u), mix(S.V[k + 9], S.V[k + 10], u), v);
}

// The drizzle: droplets raining out of the mist, seen as they cross the light.
function drop(S, j, b) {
  S.DX[j] = rnd() * W;
  S.DY[j] = rnd() * H;
  S.DB[j] = S.tf + b;
  S.DL[j] = 0.45 + 1.1 * rnd();
  S.DA[j] = 0.08 + 0.28 * rnd();
}

const UV = new Float32Array(2);
function step(S, d) {
  const df = d * S.tsf, dd = d * S.tsd;
  (S.tf += df), (S.td += dd), (S.wr += d);
  const [mu, mv] = flow(S);
  (S.ox += mu * dd), (S.oy += mv * dd);
  // Births run on the fade clock, so the chamber holds as many trails at any speed.
  if (S.wr > 1.2) {
    const rate = [0.75, 1.1, 2.4, 0.9, 0.05, 5 * S.src ** 1.5, 0.6 * S.src];
    for (let k = 0; k < 7; k++) for (S.cnt[k] -= rate[k] * df; S.cnt[k] <= 0; S.cnt[k] -= log(1 - rnd())) spawn(S, k);
  }
  for (const p of S.pend) if (p[0] <= S.tf) alpha(S, p[1], p[2], rnd() * 2 * PI, 6 + 10 * rnd()), (p[0] = -1);
  S.pend = S.pend.filter((p) => p[0] > 0);
  const { PX, PY, PU, PV, PB, PL } = S;
  for (let n = S.tail; n < S.head; n++) {
    const i = n & (CAP - 1);
    if (S.tf - PB[i] > PL[i]) continue;
    vel(S, PX[i], PY[i], UV);
    PX[i] += (UV[0] + PU[i]) * dd;
    PY[i] += (UV[1] + PV[i]) * dd;
  }
  while (S.tail < S.head && S.tf - PB[S.tail & (CAP - 1)] > PL[S.tail & (CAP - 1)]) S.tail++;
  for (let j = 0; j < ND; j++) {
    if (S.tf - S.DB[j] > S.DL[j]) drop(S, j, 0);
    vel(S, S.DX[j], S.DY[j], UV);
    S.DX[j] += UV[0] * dd;
    S.DY[j] += UV[1] * dd;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], sp = cl(k[1], 0.2, 3) / 2, k1 = cl(k[0], 0, 1);
  (S.field = cl(k[3], 0, 1)), (S.src = cl(k[2], 0, 1)), (S.tsd = sp), (S.tsf = sp ** 0.6);
  if (k1 !== S.k1) {
    const f = k1 * 3, a = min(2, floor(f)), u = sm(0, 1, f - a);
    for (let j = 0; j < 8; j++) S.lamp[j] = mix(LAMPS[a][j], LAMPS[a + 1][j], u);
    S.k1 = k1;
  }
  // Start with the chamber already running.
  for (; !S.live; S.live = 1) while (S.tf < 4.5) step(S, 1 / 30);
  const b = input.btnPressed || [];
  if (b[0]) shower(S);
  if (b[1] && S.wr > 0.3) (S.tw = S.tf), (S.wr = 0);
  step(S, cl(dt || 0, 0, 0.1));
}

function splat(T, x, y, s2, a) {
  const r = sqrt(3.5 * s2), k = 32 / s2, x0 = max(0, ceil(x - 0.5 - r)), x1 = min(W - 1, floor(x - 0.5 + r)), y0 = max(0, ceil(y - 0.5 - r)), y1 = min(H - 1, floor(y - 0.5 + r));
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y, d2 = dy * dy, o = py * W;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x, q = ((dx * dx + d2) * k) | 0;
      if (q < GN) T[o + px] += a * GL[q];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.live) return;
  const { T, PX, PY, PB, PL, PS, PK, PD, lamp } = S, tf = S.tf, tin = 0.07 * S.tsf;
  // After a clear the old trails blur and fade within a second; the mist dims and comes back.
  const wq = exp(-S.wr / 0.3), wipe = S.wr < 2.5 ? sm(0, 0.25, S.wr) * exp(-S.wr / 1.1) : 0;
  T.fill(0);
  for (let n = S.tail; n < S.head; n++) {
    const i = n & (CAP - 1), a = tf - PB[i], L = PL[i];
    if (a > L) continue;
    const old = PB[i] < S.tw;
    if (old && S.wr > 2) continue;
    // Fresh droplets catch the light hardest for the first half second.
    let s2 = PS[i] + 2 * PD[i] * a, e = min(1, a / tin) * (1 - sm(0.12, 1, a / L)) * (1 + 0.6 * exp(-a / 0.4));
    if (old) (s2 += 3 * (1 - wq)), (e *= wq);
    // Once a trail has spread wider than the droplet spacing, every second
    // or fourth droplet stands for its neighbours.
    let m = 1;
    if (s2 > 5) {
      if (n & 3) continue;
      m = 4;
    } else if (s2 > 2.2) {
      if (n & 1) continue;
      m = 2;
    }
    if (e > 0.004) splat(T, PX[i], PY[i], s2, (m * PK[i] * e) / s2);
  }
  // Drizzle, brightest in the light near the wall, heavier just after a clear.
  const dz = lamp[6] * (1 + 2.5 * wipe);
  for (let j = 0; j < ND; j++) {
    const u = (tf - S.DB[j]) / S.DL[j];
    if (u <= 0 || u >= 1) continue;
    const x = S.DX[j] - 0.5, y = S.DY[j] - 0.5, xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
    const a = dz * S.DA[j] * sin(u * PI) ** 2 * (0.3 + 0.7 * exp(-S.DX[j] / 16));
    if (xi < 0 || yi < 0 || xi >= W - 1 || yi >= H - 1) continue;
    const o = yi * W + xi;
    T[o] += a * (1 - fx) * (1 - fy);
    T[o + 1] += a * fx * (1 - fy);
    T[o + W] += a * (1 - fx) * fy;
    T[o + W + 1] += a * fx * fy;
  }
  const [cr, cg, cb, g1, w1, g2, , tg] = lamp, rod = sm(0.01, 0.06, S.src), mist = 1 - 0.7 * wipe, ox = S.ox, oy = S.oy;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x === 0) {
        // The lamp strip itself, through the glass at the chamber's rim.
        const v = 0.92 * STRIP[y] * (1 - 0.3 * wipe);
        display.setPixel(0, y, 255 * v * mix(cr, 1, 0.4), 255 * v * mix(cg, 1, 0.4), 255 * v * mix(cb, 1, 0.4));
        continue;
      }
      const n = 0.6 * nz(x * 0.9 - ox * 0.9, y * 0.55 - oy * 0.55) + 0.4 * nz(x * 1.7 - ox * 1.6 + 17, y * 1.1 - oy * 1.4 + 29);
      const h = (g1 * exp(-(x - 1) / w1) + g2 * exp(-x / 40)) * (1.7 * n * n) * mist;
      let t = T[i] * LIT[x] * tg, g = 0;
      // The rod: dull metal lit from the lamp side.
      if (rod > 0 && y > SY - 0.5 && x > SX - 2 && x < SX + 1) g = rod * (x < SX - 0.5 ? 0.42 : 0.24) * (y < SY + 0.5 ? 1.25 : 1);
      const v = min(1, (1 - exp(-1.6 * (t + h + g))) * 1.25), wf = 0.8 * sm(0.1, 0.8, t) + 0.6 * g;
      display.setPixel(x, y, 255 * v * mix(cr, 1, wf), 255 * v * mix(cg, 1, wf), 255 * v * mix(cb, 1, wf));
    }
  }
}
