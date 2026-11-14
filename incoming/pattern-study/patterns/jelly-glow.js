// ===== Patternflow pattern =====
// Title:   Jelly Glow
// Family:  cosmetic
// Idea:    A thick block of pink jelly lit from behind and by a few lights buried in it, solved as light diffusing through a turbid medium, so every light wears a pale core inside a deeper, wider halo, the lumps and creases of the slowly reflowing jelly hold or drain the glow, and air bubbles and milky beads drift through it, the bubbles as paler windows and the beads with soft shadows behind them.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion approximation for subsurface light transport and the dipole model's total diffuse reflectance (Henrik Wann Jensen, Stephen Marschner, Marc Levoy and Pat Hanrahan, 2001), solved on the panel as a slab of varying thickness with Beer-Lambert absorption (August Beer, 1852); collab reference for PERIPERA, after its jelly tints and jelly blushers
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.4..3, Scale=-1..1, Clarity=-1..1
//
// Knob 1: Hue. The tint of the jelly, all the way round the wheel; at 0 it is a raspberry pink, and whatever the tint the haloes run deeper than the pale cores.
// Knob 2: Drift. How fast the lights wander and fade and the jelly reflows: at 2 a light drifts about 0.7 LEDs a second and a lump changes shape over 12 seconds or so; at 0.4 everything runs at 0.44 of that, at 3 at 1.35 times.
// Knob 3: Scale. The size of everything in the jelly: lumps about 13 LEDs across at -1, 21 at the opening and 34 at 1, with the bubbles, the beads and the slab's thickness, and so the width of the glows, growing with them.
// Knob 4: Clarity. The mean free path of the light: at -1 the jelly is milky, pastel where the lamp in front lights it and with the buried lights glowing red through it; at 1 it is a clear gel, lit through, where the lights show as sharp bright cores.

const W = 64, H = 128, NP = W * H;
const { floor, sin, exp, sqrt, max, min, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();

// The light is solved on a grid of 2 by 2 LED cells; the cores, the bubbles
// and the gloss are drawn on top at full resolution.
const C = 2, GW = W / C, GH = H / C, GN = GW * GH, QW = W / 4, QH = H / 4;
const NL = 6, NO = 13; // lights buried in the jelly; inclusions (bubbles and beads)
const T0 = 34; // mean thickness of the jelly in LEDs at Scale 0
// Reduced scattering per channel, as a multiple of what Clarity sets: red
// scatters least, so its mean free path is longest and it spreads widest.
const SCAT = [0.62, 0.85, 1.18];
const LAMP = [1, 0.9, 0.8]; // the buried lights, warm
const BACK = [0.92, 0.96, 1]; // the light behind, a little cooler
const OM = 1.55; // over-relaxation
// (1 + Fdr) / (1 - Fdr), the internal reflection at the face for a
// refractive index of 1.35, from the polynomial fit for Fdr that Jensen et
// al. use.
const AF = 2.92;
const FRONT = 0.3; // the lamp in front, against the light behind
const LEVEL = 0.58; // the mean level the exposure holds, of the brightest channel

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- gradient noise (Ken Perlin's improved noise, 2002) ---------------------
function perm() {
  const a = [];
  for (let i = 0; i < 256; i++) a.push(i);
  for (let i = 255; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = a[i & 255];
  return P;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function gr(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}
function noise(P, x, y, z) {
  const X = floor(x), Y = floor(y), Z = floor(z);
  x -= X;
  y -= Y;
  z -= Z;
  const xi = X & 255, yi = Y & 255, zi = Z & 255, u = fade(x), v = fade(y), w = fade(z);
  const A = P[xi] + yi, AA = P[A] + zi, AB = P[A + 1] + zi, B = P[xi + 1] + yi, BA = P[B] + zi, BB = P[B + 1] + zi;
  const l1 = gr(P[AA], x, y, z) + u * (gr(P[BA], x - 1, y, z) - gr(P[AA], x, y, z));
  const l2 = gr(P[AB], x, y - 1, z) + u * (gr(P[BB], x - 1, y - 1, z) - gr(P[AB], x, y - 1, z));
  const l3 = gr(P[AA + 1], x, y, z - 1) + u * (gr(P[BA + 1], x - 1, y, z - 1) - gr(P[AA + 1], x, y, z - 1));
  const l4 = gr(P[AB + 1], x, y - 1, z - 1) + u * (gr(P[BB + 1], x - 1, y - 1, z - 1) - gr(P[AB + 1], x, y - 1, z - 1));
  const m1 = l1 + v * (l2 - l1), m2 = l3 + v * (l4 - l3);
  return m1 + w * (m2 - m1);
}

// ---- the things in the jelly ------------------------------------------------
function newLight() {
  // Each coordinate is the sum of two sines at random rates, so no two lights
  // and no two moments share a path.
  const L = { a: [], p: [] };
  for (let i = 0; i < 8; i++) {
    L.a.push(rnd(0.011, 0.018) * (i % 2 ? 1.83 : 1) * (i >= 4 ? 1.37 : 1));
    L.p.push(rnd(0, 2 * PI));
  }
  L.zr = rnd(0.017, 0.031);
  L.ir = [rnd(0.015, 0.027), rnd(0.033, 0.054)];
  return L;
}
function spawn(o, first) {
  o.bubble = Math.random() < 0.55;
  o.x = rnd(-6, W + 6);
  o.y = rnd(-6, H + 6);
  o.z = rnd(0.04, 0.45); // depth below the front face, as a fraction of the slab
  o.r = o.bubble ? rnd(2.2, 4.2) : rnd(2.4, 4.4);
  const a = rnd(0, 2 * PI), v = rnd(0.12, 0.4);
  o.vx = v * Math.cos(a);
  o.vy = v * Math.sin(a);
  o.turn = rnd(-0.03, 0.03);
  o.life = rnd(30, 75);
  o.age = first ? rnd(0, o.life) : 0;
}

export function setup(params) {
  const f = (n) => new Float32Array(n), f3 = (n) => [f(n), f(n), f(n)];
  const S = {
    t: 0, P: perm(), warm: false, dt: 1 / 30,
    T: f(GN), Tf: f(NP), hf: f(NP), cr: f(NP), wq: f((QW + 1) * (QH + 1) * 4), den: f(GN), bf: f(GN), back: f(GN), gx: f(NP), gy: f(NP),
    phi: f3(GN), E: f3(GN), kx: f3(GN), ky: f3(GN), dg: f3(GN), q: f3(GN), gam: f3(GN), Rd: f3(GN), kap: f(GN),
    add: f3(NP), mul: f(NP), post: f(NP), lin: f(NP * 3), wv: f(NP),
    lights: [], objs: [], lit: [],
    hue: 0, drift: 2, scale: 0, clar: 0.06, gain: -1,
    tint: [0, 0, 0],
  };
  for (let i = 0; i < NL; i++) S.lights.push(newLight());
  for (let i = 0; i < NO; i++) {
    const o = {};
    spawn(o, true);
    S.objs.push(o);
  }
  params.s = S;
  return S;
}

// The optical constants per channel, for the current tint and clarity.
function optics(S) {
  const sc = pow(1.6, S.scale);
  // Clarity sets the reduced scattering coefficient for green, per LED:
  // 0.68 at the milky end, 0.09 at the opening, 0.015 at the clear end.
  const ss = 0.12 * exp(-1.9 * S.clar);
  hsv(0.875 + S.hue, 0.4, 1, S.tint);
  const sa = [], sg = [];
  for (let c = 0; c < 3; c++) {
    // Beer-Lambert: the absorption of each channel is the tint's optical
    // depth. A milkier jelly holds a little more dye, a clearer one less.
    const tau = -Math.log(max(0.02, S.tint[c]));
    sa.push(((0.085 * tau + 0.002) * pow(ss / 0.12, 0.25)) / sc);
    sg.push((ss * SCAT[c]) / sc);
  }
  return { sc, sa, ss: sg };
}

function lightAt(L, t, sc) {
  const a = L.a, p = L.p;
  const x = W / 2 + (W / 2 + 8) * (0.6 * sin(a[0] * t + p[0]) + 0.4 * sin(a[1] * t + p[1]));
  const y = H / 2 + (H / 2 + 8) * (0.6 * sin(a[2] * t + p[2]) + 0.4 * sin(a[3] * t + p[3]));
  const z = T0 * sc * (0.08 + 0.36 * (0.5 + 0.5 * sin(L.zr * t + p[4])));
  const on = sm(-0.3, 0.75, 0.62 * sin(L.ir[0] * t + p[5]) + 0.38 * sin(L.ir[1] * t + p[6]));
  return { x, y, z, on };
}

// Bilinear reads: from the 4-LED grid of four interleaved fields, and from
// the 2-LED light grid.
const bq = (a, q, q2, k, w00, w10, w01, w11) => a[q + k] * w00 + a[q + 4 + k] * w10 + a[q2 + k] * w01 + a[q2 + 4 + k] * w11;
const bil = (a, g, w00, w10, w01, w11) => a[g] * w00 + a[g + 1] * w10 + a[g + GW] * w01 + a[g + GW + 1] * w11;

// The slab: its thickness, its inclusions and the light it is given.
function build(S, O) {
  const { P, T, den, bf, back, gx, gy, Tf, hf, cr } = S, t = S.t, sc = O.sc;
  const s = 21 * sc, ws = 2.3 * s, T1 = T0 * sc;
  T.fill(0);
  // A slow domain warp makes the lumps reflow rather than boil. It and the
  // field that lets creases open are smooth, so they are taken every 4 LEDs.
  const wq = S.wq;
  for (let j = 0; j <= QH; j++)
    for (let i = 0; i <= QW; i++) {
      const x = i * 4, y = j * 4, q = (j * (QW + 1) + i) * 4;
      const wx = noise(P, x / ws, y / ws, t * 0.047 + 11.3), wy = noise(P, x / ws + 31.7, y / ws, t * 0.047 + 3.1);
      wq[q] = wx;
      wq[q + 1] = wy;
      wq[q + 2] = noise(P, x / (2.2 * s) + 41.3, y / (2.2 * s) + 12.9, t * 0.057 + 9.1);
      // The second octave of the lumps, which only thickens and thins.
      wq[q + 3] = 0.3 * noise(P, 2.03 * (x / s + 0.6 * wx) + 5.2, 2.03 * (y / s + 0.6 * wy) + 1.7, t * 0.127 + 7.7);
    }
  for (let y = 0; y < H; y++) {
    const jq = y >> 2, fy = (y & 3) / 4;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, iq = x >> 2, fx = (x & 3) / 4, q = (jq * (QW + 1) + iq) * 4, q2 = q + (QW + 1) * 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const X = x / s + 0.6 * bq(wq, q, q2, 0, w00, w10, w01, w11), Y = y / s + 0.6 * bq(wq, q, q2, 1, w00, w10, w01, w11);
      const n3 = bq(wq, q, q2, 2, w00, w10, w01, w11);
      const l1 = noise(P, X, Y, t * 0.083), lump = l1 + bq(wq, q, q2, 3, w00, w10, w01, w11);
      // Creases: the jelly thins along the zero line of a second field, where
      // a third, slower one lets it; so creases form, run and close again.
      const n2 = noise(P, 0.78 * X + 17.1, 0.78 * Y + 9.4, t * 0.067 + 2.2);
      const crease = exp(-(n2 * n2) / 0.035) * sm(-0.1, 0.3, n3), Tl = T1 * exp(0.75 * lump);
      // The face is the broad lumps only: a gloss narrower than a few LEDs
      // breaks into single-LED shards on the panel. It shines on the crowns.
      hf[p] = T1 * exp(0.75 * l1);
      cr[p] = sm(0, 0.4, l1);
      Tf[p] = Tl * (1 - 0.4 * crease);
      T[(y >> 1) * GW + (x >> 1)] += 0.25 * Tf[p];
    }
  }
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const g = j * GW + i;
      den[g] = 0;
      bf[g] = 0;
      back[g] = 0.55 + 0.5 * noise(P, i / 20 + 3.3, j / 20 + 8.1, t * 0.061 + 5.5);
    }
  // Inclusions: bubbles thin the jelly by their chord and let light through;
  // beads are milky lumps of denser jelly.
  for (const o of S.objs) {
    const e = sm(0, 0.18, o.age / o.life) * sm(1, 0.8, o.age / o.life);
    if (e <= 0) continue;
    const R = o.r * sc, ox = o.x / C - 0.5, oy = o.y / C - 0.5, rc = (R + 2) / C;
    const i0 = max(0, floor(ox - rc)), i1 = min(GW - 1, floor(ox + rc) + 1), j0 = max(0, floor(oy - rc)), j1 = min(GH - 1, floor(oy + rc) + 1);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = (i - ox) * C, dy = (j - oy) * C, d = sqrt(dx * dx + dy * dy), g = j * GW + i;
        if (o.bubble) {
          const k = 1 - (d * d) / ((R + 0.8) * (R + 0.8));
          if (k > 0) bf[g] = max(bf[g], (e * 2 * R * sqrt(k)) / T[g]);
        } else den[g] = min(1, den[g] + e * sm(R + 1.6, R - 1.6, d));
      }
  }
  for (let g = 0; g < GN; g++) T[g] *= 1 - min(0.4, bf[g]);
  // Front-face slope, for the gloss.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      gx[p] = (hf[y * W + min(W - 1, x + 1)] - hf[y * W + max(0, x - 1)]) / (x > 0 && x < W - 1 ? 2 : 1);
      gy[p] = (hf[min(H - 1, y + 1) * W + x] - hf[max(0, y - 1) * W + x]) / (y > 0 && y < H - 1 ? 2 : 1);
    }
}

// The diffusion equation for one channel on the slab, averaged through its
// thickness T:  div(T D grad phi) - (T sa + pi^2 D / T) phi + q = 0,
// where pi^2 D / T is the light lost through the two faces. The front face
// gives out pi^2 D / (2 T) phi. With D = 1 / (3 (sa + ss')), the spread is
// about T / pi where the jelly absorbs little and shrinks as sa ss' grows.
function coefficients(S, O, c, lights) {
  const { T, den, bf, back, kap } = S, kx = S.kx[c], ky = S.ky[c], dg = S.dg[c], q = S.q[c], gam = S.gam[c];
  const sa0 = O.sa[c], ss0 = O.ss[c], h2 = C * C;
  for (let g = 0; g < GN; g++) {
    const Tg = T[g], dn = den[g], b = min(1, bf[g] * 2);
    // Beads are milky: they scatter five times as much, so the light flows
    // round them and leaves a soft shadow behind, and under the lamp in front
    // they come back paler than the jelly round them.
    const sj = ss0 * (1 - 0.8 * b), ss = sj * (1 + 4 * dn), sa = sa0 + 0.003 * dn;
    const st = sa + ss, D = 1 / (3 * st);
    kap[g] = Tg * D;
    dg[g] = Tg * sa + (PI * PI * D) / Tg;
    gam[g] = (PI * PI) / (6 * (sa0 + sj) * Tg);
    // Light from the lamp in front comes back out after a short walk: the
    // total diffuse reflectance of the dipole model for the albedo here.
    const al = ss / st, sq = sqrt(3 * (1 - al));
    S.Rd[c][g] = 0.5 * al * (1 + exp(-(4 / 3) * AF * sq)) * exp(-sq);
    // Light from behind: the scattered part enters the diffusion near the
    // back face; the part that is never scattered goes straight through and
    // is added in draw.
    q[g] = back[g] * BACK[c] * (1 - exp(-ss * Tg)) * min(1, PI / (st * Tg));
  }
  for (const L of lights) {
    if (L.on <= 0.001) continue;
    // The light starts diffusing over a patch about as wide as it is deep.
    const sg = (1.2 + 0.5 * L.z) / C, ox = L.x / C - 0.5, oy = L.y / C - 0.5, r = 3 * sg;
    const amp = (L.on * LAMP[c] * 600 * (1 - exp(-ss0 * 0.5 * T0 * O.sc))) / (2 * PI * sg * sg);
    const i0 = max(0, floor(ox - r)), i1 = min(GW - 1, floor(ox + r) + 1), j0 = max(0, floor(oy - r)), j1 = min(GH - 1, floor(oy + r) + 1);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const dx = i - ox, dy = j - oy;
        q[j * GW + i] += amp * exp(-(dx * dx + dy * dy) / (2 * sg * sg));
      }
  }
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const g = j * GW + i;
      kx[g] = i < GW - 1 ? (0.5 * (kap[g] + kap[g + 1])) / h2 : 0;
      ky[g] = j < GH - 1 ? (0.5 * (kap[g] + kap[g + GW])) / h2 : 0;
    }
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const g = j * GW + i;
      dg[g] += kx[g] + ky[g] + (i > 0 ? kx[g - 1] : 0) + (j > 0 ? ky[g - GW] : 0);
    }
}

// Red-black over-relaxed Gauss-Seidel, warm-started from the last frame:
// the slab changes slowly, so a few sweeps a frame keep up with it.
function relax(S, c, n) {
  const phi = S.phi[c], kx = S.kx[c], ky = S.ky[c], dg = S.dg[c], q = S.q[c];
  for (let it = 0; it < n; it++)
    for (let col = 0; col < 2; col++)
      for (let j = 0; j < GH; j++) {
        const o = j * GW;
        for (let i = (j + col) & 1; i < GW; i += 2) {
          const g = o + i;
          let s = q[g] + kx[g] * (i < GW - 1 ? phi[g + 1] : 0) + ky[g] * (j < GH - 1 ? phi[g + GW] : 0);
          if (i > 0) s += kx[g - 1] * phi[g - 1];
          if (j > 0) s += ky[g - GW] * phi[g - GW];
          phi[g] += OM * (s / dg[g] - phi[g]);
        }
      }
}

function step(S, sweeps) {
  const O = optics(S), t = S.t;
  S.lit = S.lights.map((L) => lightAt(L, t, O.sc));
  build(S, O);
  for (let c = 0; c < 3; c++) {
    coefficients(S, O, c, S.lit);
    relax(S, c, sweeps);
    const E = S.E[c], phi = S.phi[c], gam = S.gam[c];
    for (let g = 0; g < GN; g++) E[g] = gam[g] * phi[g];
  }
  S.O = O;
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.drift = cl(k[1], 0.4, 3);
  S.scale = cl(k[2], -1, 1);
  S.clar = cl(k[3], -1, 1);
  const h = cl(dt || 0, 0, 0.1);
  S.dt = h;
  // Model seconds run at 0.3 + 0.35 Drift of real ones: 1 at the opening,
  // 0.44 at the slow end, where slower still let frames 20 s apart match.
  const ms = h * (0.3 + 0.35 * S.drift);
  S.t += ms;
  for (const o of S.objs) {
    o.age += ms;
    if (o.age > o.life) spawn(o, false);
    const a = o.turn * ms, ca = Math.cos(a), sa = Math.sin(a), vx = o.vx * ca - o.vy * sa;
    o.vy = o.vx * sa + o.vy * ca;
    o.vx = vx;
    o.x += o.vx * ms;
    o.y += o.vy * ms;
  }
  if (!S.warm) {
    S.warm = true;
    S.t = rnd(0, 400);
    step(S, 260);
  } else step(S, 10);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const O = S.O, sc = O.sc, add = S.add, mul = S.mul, post = S.post;
  for (let c = 0; c < 3; c++) add[c].fill(0);
  mul.fill(1);
  post.fill(0);
  // The buried lights seen straight on: what reaches the eye unscattered is
  // the source dimmed by exp(-(sa + ss') z), blurred a little by the jelly.
  for (const L of S.lit) {
    if (L.on <= 0.001) continue;
    const w = 0.75 + 0.06 * L.z * (1 + 4 * O.ss[1] * L.z), r = 3.5 * w;
    const x0 = max(0, floor(L.x - r)), x1 = min(W - 1, floor(L.x + r)), y0 = max(0, floor(L.y - r)), y1 = min(H - 1, floor(L.y + r));
    const amp = [0, 1, 2].map((c) => (L.on * LAMP[c] * 2.4 * exp(-(O.sa[c] + O.ss[c]) * L.z)) / (w * w));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - L.x, dy = y + 0.5 - L.y, g = exp(-(dx * dx + dy * dy) / (2 * w * w)), p = y * W + x;
        add[0][p] += amp[0] * g;
        add[1][p] += amp[1] * g;
        add[2][p] += amp[2] * g;
      }
  }
  // Bubbles: a dark ring where the light is bent away at the wall, a bright
  // ring just inside it, and a glint of the lamp in front.
  for (const o of S.objs) {
    if (!o.bubble) continue;
    const e = sm(0, 0.18, o.age / o.life) * sm(1, 0.8, o.age / o.life);
    const vis = e * exp(-O.ss[1] * o.z * T0 * sc * 0.4);
    if (vis < 0.02) continue;
    const R = o.r * sc, x0 = max(0, floor(o.x - R - 2)), x1 = min(W - 1, floor(o.x + R + 2)), y0 = max(0, floor(o.y - R - 2)), y1 = min(H - 1, floor(o.y + R + 2));
    const gx = o.x - 0.38 * R, gy = o.y - 0.42 * R, gw = 0.35 + 0.02 * R * R;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - o.x, dy = y + 0.5 - o.y, d = sqrt(dx * dx + dy * dy) / R, p = y * W + x;
        const dark = exp(-((d - 1.02) * (d - 1.02)) / 0.03), lite = exp(-((d - 0.78) * (d - 0.78)) / 0.02);
        mul[p] *= 1 - 0.5 * vis * dark;
        const ex = x + 0.5 - gx, ey = y + 0.5 - gy;
        // Inside, the light comes through no dye at all: a paler window.
        post[p] += vis * (0.16 * sm(1, 0.6, d) + 0.12 * lite + 0.6 * exp(-(ex * ex + ey * ey) / gw));
      }
  }
  // Upsample the solved light, add what the lamp in front gives back from
  // under the lumpy face and the gloss on it, and tone-map.
  const E = S.E, Rd = S.Rd, cr = S.cr, gxa = S.gx, gya = S.gy, Tf = S.Tf, den = S.den, bf = S.bf, back = S.back, sa = O.sa, ss = O.ss;
  const la = 0.0021 * S.t, lx = -0.35 + 0.15 * sin(la * 3.1), ly = -0.5 + 0.15 * sin(la * 2.3 + 1), lz = sqrt(1 - lx * lx - ly * ly);
  const hn = sqrt(lx * lx + ly * ly + (lz + 1) * (lz + 1)), hx = lx / hn, hy = ly / hn, hzz = (lz + 1) / hn;
  const lin = S.lin, wv = S.wv;
  for (let y = 0; y < H; y++) {
    const v = cl((y + 0.5) / C - 0.5, 0, GH - 1), j0 = min(GH - 2, floor(v)), fy = v - j0;
    for (let x = 0; x < W; x++) {
      const u = cl((x + 0.5) / C - 0.5, 0, GW - 1), i0 = min(GW - 2, floor(u)), fx = u - i0, g = j0 * GW + i0;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const p = y * W + x, m = mul[p], nx = -0.35 * gxa[p], ny = -0.35 * gya[p], nn = 1 / sqrt(nx * nx + ny * ny + 1);
      const lam = FRONT * (0.15 + 0.85 * max(0, (1.5 * (nx * lx + ny * ly) + lz) / sqrt(2.25 * (nx * nx + ny * ny) + 1)));
      // The light from behind that is never scattered: Beer-Lambert through
      // the jelly here, less a bubble's chord. A bead takes some out of the
      // beam and sends most of it on forward, a little blurred.
      const dn = bil(den, g, w00, w10, w01, w11), Te = Tf[p] * (1 - min(0.4, bil(bf, g, w00, w10, w01, w11))), bk = bil(back, g, w00, w10, w01, w11);
      for (let c = 0; c < 3; c++) {
        const kb = exp(-4 * ss[c] * dn * Te);
        lin[p * 3 + c] = (bil(E[c], g, w00, w10, w01, w11) + bk * BACK[c] * exp(-(sa[c] + ss[c]) * Te) * (0.6 + 0.4 * kb)) * m + lam * bil(Rd[c], g, w00, w10, w01, w11) + add[c][p];
      }
      // The gloss: the lamp's reflection on the crowns of the lumps.
      const nh = max(0, (nx * hx + ny * hy + hzz) * nn), n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n16 = n8 * n8;
      wv[p] = 0.02 + 0.25 * cr[p] * n16 + post[p];
    }
  }
  // Mostly hue-keeping: the brightest channel sets the level, so the haloes
  // keep their colour; a third per channel, so the hottest cores run toward
  // white. The exposure holds the mean level at LEVEL; on the first frame it
  // is found outright.
  const level = (G, step) => {
    let sum = 0;
    for (let p = 0; p < NP; p += step) {
      const r = lin[p * 3], g = lin[p * 3 + 1], b = lin[p * 3 + 2], mx = max(r, g, b, 1e-6), f = (1 - exp(-G * mx)) / mx;
      sum += max(0.65 * r * f + 0.35 * (1 - exp(-G * r)), 0.65 * g * f + 0.35 * (1 - exp(-G * g)), 0.65 * b * f + 0.35 * (1 - exp(-G * b)));
    }
    return (sum * step) / NP;
  };
  if (S.gain < 0) {
    S.gain = 1;
    for (let i = 0; i < 12; i++) S.gain *= pow(LEVEL / max(0.02, level(S.gain, 7)), 1.2);
  }
  const G = S.gain;
  for (let p = 0; p < NP; p++) {
    const r = lin[p * 3], g = lin[p * 3 + 1], b = lin[p * 3 + 2], mx = max(r, g, b, 1e-6), f = (1 - exp(-G * mx)) / mx;
    const R = 0.65 * r * f + 0.35 * (1 - exp(-G * r)), Gc = 0.65 * g * f + 0.35 * (1 - exp(-G * g)), B = 0.65 * b * f + 0.35 * (1 - exp(-G * b));
    const w = wv[p];
    display.setPixel(p % W, (p / W) | 0, 255 * min(1, R + w * (1 - R)), 255 * min(1, Gc + w * (1 - Gc)), 255 * min(1, B + w * (1 - B)));
  }
  S.gain *= pow(LEVEL / max(0.05, level(G, 3)), 0.04);
}
