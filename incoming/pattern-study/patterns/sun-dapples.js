// ===== Patternflow pattern =====
// Title:   Sun Dapples
// Family:  pinhole
// Idea:    The patches of sunlight on the ground under a tree, each one a pinhole image of the Sun made by a gap in the leaves, so high gaps throw big round spots and low gaps small ones, and in an eclipse every spot is a crescent pointing the same way.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the puzzle of the crescent-shaped spots under trees in an eclipse, raised in Aristotle's Problemata; Johannes Kepler's reasoning on the pinhole image of the Sun (1604); the same crescents seen under trees in the eclipses of 1999 and 2017; the layered canopy and the mean of its layers over the Sun's disc are original, pattern round 204
// Round:   204
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Eclipse=0..3, Wind=0.5..3, Canopy=-1..1
//
// Knob 1: Hue. Turns the whole palette round the colour wheel from the gold light on blue-green shade it opens on, to green light on violet shade at 0.25, blue on brown at 0.5 and pink on olive at 0.75, and back to the opening at 1.
// Knob 2: Eclipse. How much of the Sun the Moon hides: 0% at 0 so every spot is a round image of the Sun, 57% at 2 where it opens and every spot is a fat crescent, 85% at 3 and they are thin arcs; the horns all point up and to the right, and the shade darkens by up to a third as the cover grows.
// Knob 3: Wind. How hard the three leaf layers move: at 0.5 they sway 1 to 3 LEDs with periods from 7 s (lowest layer) to 55 s (highest) and a gust comes every 26 s on average, at 3 they sway 2 to 5 LEDs with periods of 1 to 9 s and a gust comes every 12 s.
// Knob 4: Canopy. How much of each layer is gap: 0.55 times the opening share at 1, so about 17 bright spots are left and they are small, and 1.8 times at -1, so about 30 spots swell and the larger fuse into patches, against about 26 where it opens near 0.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sin, cos, sqrt, exp, log, abs, min, max, acos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The Sun is 0.0047 rad in angular radius, so a gap at height h throws a spot
// of radius 0.0047 h on the ground. Three canopy layers at 638, 1064 and
// 1702 LED units high give spots of 3, 5 and 8 LEDs. A ray from a point of
// the Sun's disc, s of the Sun's radius off its centre, crosses layer l at
// x + R_l s, so the light at x is the mean over the disc of the product of
// the layers' transmissions there. The ground image is the disc turned
// upside down, which is what makes a crescent point away from the Moon.
const SUN_RAD = 0.0047;
const HGT = [638, 1064, 1702];
const R_LED = HGT.map((h) => h * SUN_RAD);
const NL = 3;
// The Sun's disc is sampled at 24 points; fewer leave steps in the 8 LED spots.
const K = 24;
// Each layer is kept on an array that reaches 26 LEDs past the panel on every side, which holds
// its sway, its gust and the 8 LEDs the disc moves the lookup.
const MARGIN = 26;
const RW = W + 2 * MARGIN;
const RH = H + 2 * MARGIN;
const RN = RW * RH;
// Each layer is a leaf screen over a share of the ground and open air over the rest. One slow
// noise (QCELL LEDs across, ranked 0 to 1) says which layer is the dense one where: the lowest
// third of its ranks is the low layer's, the middle third the middle layer's and the top third the
// high layer's, each widened by the Canopy knob so that neighbours overlap. Where a layer is a
// screen its light comes through round gaps GCELL LEDs across, which are the peaks of a noise
// above a threshold. A gap is a third to a half of the Sun's image across, so the spot it throws
// is the Sun's own shape, round or crescent, a little softened.
const QCELL = 18;
const QWIDTH0 = 0.62;
const QCENTRE = [1 / 6, 1 / 2, 5 / 6];
const GCELL = [4.8, 7.5, 11.5];
const GOPEN0 = [0.09, 0.08, 0.075];
const GEDGE = [0.2, 0.18, 0.16];
const BLUR = [1, 1, 2];
// The Moon's offset from the Sun's centre, in the disc's own coordinates (y down the panel):
// 135 degrees, so the ground crescents point their horns up and to the right.
const MOON_X = cos(0.75 * PI);
const MOON_Y = sin(0.75 * PI);

// Wind. Each layer has its own sway amplitude in LEDs and two sines per axis at frequencies no
// two share, so the layers slide past each other and never fall back into step.
const AMP = [2.2, 3.4, 4.8];
const FREQ = [
  [[0.93, 1.71], [1.07, 1.83]],
  [[0.57, 1.13], [0.49, 0.97]],
  [[0.23, 0.41], [0.31, 0.53]],
];
const MORPH = [[0.066, 0.0373], [0.0467, 0.0274], [0.0307, 0.0181]];
// What a gust pushes each layer by and how hard it shivers it, in LEDs, and the shiver's rate in rad/s.
const PUSH = [1.6, 2.6, 3.8];
const SHIVER = [0.9, 0.6, 0.35];
const SHIVER_F = [20.7, 25.8, 17.1];

// Colours, 0 to 1. The shade is the sky's blue-green; the light is warm gold with a white core.
const SHADE_DEEP = [0.02, 0.1, 0.11];
const SHADE_SKY = [0.06, 0.25, 0.25];
const GOLD = [1.0, 0.74, 0.27];
const WHITE = [1.0, 0.95, 0.8];
const EXPO = 1.7;
const WARM_GLOW = [0.9, 0.62, 0.22];

function hash2(ix, iy, seed) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
function vnoise(x, y, seed) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return mix(mix(a, b, u), mix(c, d, u), v);
}

// A field of clumps turned by a fixed angle so the lattice does not show, set to zero mean and
// unit spread. A little of a finer octave keeps the gaps from being perfect ovals.
function leafField(cell, seed, fine) {
  const f = new Float32Array(RN);
  const ang = (seed % 13) * 0.47, ca = cos(ang), sa = sin(ang);
  let s1 = 0, s2 = 0;
  for (let y = 0; y < RH; y++) {
    for (let x = 0; x < RW; x++) {
      const u = (x * ca - y * sa) / cell, w = (x * sa + y * ca) / cell;
      const v = vnoise(u, w, seed) + fine * vnoise(2.3 * u + 17, 2.3 * w + 5, seed + 101);
      f[y * RW + x] = v;
      s1 += v;
      s2 += v * v;
    }
  }
  const m = s1 / RN, sd = sqrt(s2 / RN - m * m);
  for (let i = 0; i < RN; i++) f[i] = (f[i] - m) / sd;
  return f;
}

// The normal curve's tail, to turn a share of the layer into a threshold.
function cdf(z) {
  const t = 1 / (1 + 0.2316419 * abs(z));
  const d = 0.3989423 * exp(-0.5 * z * z);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
function quantile(p) {
  let lo = -4, hi = 4;
  for (let i = 0; i < 24; i++) {
    const m = 0.5 * (lo + hi);
    if (cdf(m) < p) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}

export function setup(params) {
  const S = {
    t: 0,
    wind: 0.5, canopy: 0, ecl: -1, hue: 0,
    // Three independent fields per layer, blended on a sphere so the spread stays at 1.
    fa: [], fb: [], fc: [], qa: leafField(QCELL, 29, 0.15), qb: leafField(QCELL, 71, 0.15), qo: [], qTick: 0, qph: 0,
    T: [], // the layers' transmission, 0 to 1
    psi: [], pa: [], ou: [], off: [],
    gustIn: 5 + 9 * Math.random(), gustAge: 99, gustStr: 0, gustDx: 1, gustDy: 0, gust: 0,
    sx: new Float32Array(K), sy: new Float32Array(K),
    // Per layer and sample: the array offset, then the four bilinear weights.
    wOff: new Int32Array(NL * K), w00: new Float32Array(NL * K), w10: new Float32Array(NL * K), w01: new Float32Array(NL * K), w11: new Float32Array(NL * K),
    v: new Float32Array(N),
    q: new Float32Array(16 * 32), qm: new Float32Array(16 * 32), qm2: new Float32Array(16 * 32), lit: new Float32Array(N), tmp: new Float32Array(N),
    dark: 0,
    cm: new Float32Array(9),
    rank: new Float32Array(RN), canopyQ: 9, g1: new Float32Array(RN), g2: new Float32Array(RN),
  };
  for (let l = 0; l < NL; l++) {
    S.fa.push(leafField(GCELL[l], 11 + 7 * l, 0.25));
    S.fb.push(leafField(GCELL[l], 53 + 7 * l, 0.25));
    S.fc.push(leafField(GCELL[l], 97 + 7 * l, 0.25));
        S.qo.push(new Float32Array(RN));
    S.T.push(new Float32Array(RN));
    S.psi.push([TAU * Math.random(), TAU * Math.random()]);
    S.pa.push([[TAU * Math.random(), TAU * Math.random()], [TAU * Math.random(), TAU * Math.random()]]);
    S.ou.push([0, 0]);
    S.off.push([0, 0]);
  }
  params.s = S;
}

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// Fraction of one unit disc a second unit disc d away from its centre hides.
function hidden(d) {
  if (d >= 2) return 0;
  if (d <= 0) return 1;
  return (2 * acos(d / 2) - (d / 2) * sqrt(4 - d * d)) / PI;
}

// The 24 points of the Sun's disc that are still lit: a quasi-random sequence over the
// disc's bounding square, keeping the points outside the Moon's disc until there are 24.
// Turning Eclipse moves a few of them at a time, so the spots change smoothly.
function sunPoints(S, d) {
  const mx = MOON_X * d, my = MOON_Y * d;
  let n = 0;
  for (let k = 1; n < K && k < 6000; k++) {
    const u = ((0.5 + k * 0.7548776662) % 1) * 2 - 1;
    const v = ((0.5 + k * 0.5698402909) % 1) * 2 - 1;
    if (u * u + v * v > 1) continue;
    const du = u - mx, dv = v - my;
    if (du * du + dv * dv < 1) continue;
    S.sx[n] = u;
    S.sy[n] = v;
    n++;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.5, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.t += dt;
  const t = S.t;
  S.hue = k[0];
  const wind = cl(k[2], 0.5, 3);
  S.wind = wind;
  const canopy = cl(k[3], -1, 1);
  S.canopy = canopy;

  // The Moon. Knob 0 to 3 is 0 to 85% of the Sun hidden; find the offset by bisection.
  const e = cl(k[1], 0, 3);
  if (abs(e - S.ecl) > 0.002) {
    S.ecl = e;
    const cover = 0.85 * (e / 3);
    let lo = 0, hi = 2;
    for (let i = 0; i < 30; i++) {
      const mid = 0.5 * (lo + hi);
      if (hidden(mid) > cover) lo = mid; else hi = mid;
    }
    sunPoints(S, 0.5 * (lo + hi));
    // How far into the eclipse, 0 to 1, for the dimming in draw.
    S.dark = cover / 0.85;
  }

  // Gusts: now and then a push from one side, a quick rise and a long fall, with a shiver in it.
  const speed = wind;
  S.gustIn -= dt;
  S.gustAge += dt;
  if (S.gustIn <= 0) {
    S.gustIn = (9 + 24 * Math.random()) / (0.6 + 0.4 * wind);
    S.gustAge = 0;
    S.gustStr = 0.6 + 0.4 * Math.random();
    const a = TAU * Math.random();
    S.gustDx = cos(a);
    S.gustDy = sin(a);
  }
  const ga = S.gustAge;
  S.gust = ga > 16 ? 0 : S.gustStr * (ga < 0.9 ? sstep(0, 0.9, ga) : exp(-(ga - 0.9) / 2.6));

  // The zones of the canopy turn through their two fields too, slowly: a turn takes 5 to 11 minutes.
  S.qph += dt * 0.012 * (0.6 + 0.4 * wind);

  // Sway: sines, plus a slow wander the sines do not have, and the gust.
  const ampF = 0.42 + 0.2 * wind;
  for (let l = 0; l < NL; l++) {
    for (let ax = 0; ax < 2; ax++) {
      const p = S.pa[l][ax];
      p[0] += dt * speed * FREQ[l][ax][0];
      p[1] += dt * speed * FREQ[l][ax][1];
      // Ornstein-Uhlenbeck wander, 15 s memory, spread about half the amplitude.
      S.ou[l][ax] += -S.ou[l][ax] * dt / 15 + 0.5 * AMP[l] * sqrt(2 / 15) * sqrt(dt) * gauss();
      const sway = AMP[l] * ampF * (0.62 * sin(p[0]) + 0.38 * sin(p[1])) + S.ou[l][ax] * ampF;
      const push = S.gust * PUSH[l] * (ax === 0 ? S.gustDx : S.gustDy);
      const shiver = S.gust * SHIVER[l] * sin(SHIVER_F[l] * t + 2.3 * ax + l);
      const lim = MARGIN - R_LED[l] - 2;
      S.off[l][ax] = cl(sway + push + shiver, -lim, lim);
    }
    // The leaf field morphs through three fixed fields, so gaps open and close in place.
    S.psi[l][0] += dt * MORPH[l][0] * (0.5 + 0.5 * wind);
    S.psi[l][1] += dt * MORPH[l][1] * (0.5 + 0.5 * wind);
  }

  // The layers' transmission. First the screen: 1 where the layer is open air, 0 under leaves,
  // turned slowly and only every 12th frame. Then the gaps in the screen.
  S.qTick++;
  if (S.qTick % 12 === 1) {
    const ph = S.qph + 1.7, c = cos(ph), sn = sin(ph);
    const qa = S.qa, qb = S.qb, rank = S.rank;
    for (let i = 0; i < RN; i++) rank[i] = cdf(c * qa[i] + sn * qb[i]);
  }
  const half = 0.5 * cl(QWIDTH0 + 0.06 * canopy, 0.4, 0.68);
  for (let l = 0; l < NL; l++) {
    if (S.qTick % 12 === 1 || S.canopy !== S.canopyQ || S.qTick < 4) {
      const lo = QCENTRE[l] - half, hi = QCENTRE[l] + half, qo = S.qo[l], rank = S.rank;
      // The layer's screen is 1 inside its band of ranks, with a soft shoulder 0.06 wide; the ends take the whole of the 0 and 1.
      const e = 0.06;
      for (let i = 0; i < RN; i++) {
        const r = rank[i];
        const a = l === 0 ? 1 : sstep(lo - e, lo + e, r), b = l === NL - 1 ? 1 : 1 - sstep(hi - e, hi + e, r);
        qo[i] = 1 - a * b;
      }
    }
  }
  const fresh = S.canopy !== S.canopyQ || S.qTick < 4;
  S.canopyQ = S.canopy;
  for (let l = 0; l < NL; l++) {
    // The gaps drift slowly, so each layer is redone every third frame, one layer after another.
    if (!fresh && (S.qTick + l) % 3 !== 0) continue;
    const open = GOPEN0[l] * exp(-0.6 * canopy);
    const th = quantile(1 - open);
    const inv = 1 / (2 * GEDGE[l]);
    const c1 = cos(S.psi[l][0]), s1 = sin(S.psi[l][0]), c2 = cos(S.psi[l][1]), s2 = sin(S.psi[l][1]);
    const wa = c1 * c2, wb = s1 * c2, wc = s2;
    const fa = S.fa[l], fb = S.fb[l], fc = S.fc[l], T = S.T[l], qo = S.qo[l], g1 = S.g1, g2 = S.g2;
    for (let i = 0; i < RN; i++) {
      const u = 0.5 + ((wa * fa[i] + wb * fb[i] + wc * fc[i]) - th) * inv;
      g1[i] = u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
    }
    // A box blur of 3, 5 or 7 LEDs in each direction. A gap smaller than the spacing of the 24
    // points would print as a few separate dots; blurred, it prints as one dim small disc.
    const rad = BLUR[l], bw = 1 / (2 * rad + 1);
    for (let y = 0; y < RH; y++) {
      const row = y * RW;
      let acc = 0;
      for (let x = 0; x <= rad; x++) acc += g1[row + x];
      acc += g1[row] * rad;
      for (let x = 0; x < RW; x++) {
        g2[row + x] = acc * bw;
        acc += g1[row + min(RW - 1, x + rad + 1)] - g1[row + max(0, x - rad)];
      }
    }
    for (let x = 0; x < RW; x++) {
      let acc = 0;
      for (let y = 0; y <= rad; y++) acc += g2[y * RW + x];
      acc += g2[x] * rad;
      for (let y = 0; y < RH; y++) {
        const o = qo[y * RW + x], g = acc * bw;
        T[y * RW + x] = g > o ? g : o;
        acc += g2[min(RH - 1, y + rad + 1) * RW + x] - g2[max(0, y - rad) * RW + x];
      }
    }
  }

  // Where each sample of the Sun looks into each layer: a whole-LED offset and the four bilinear weights.
  for (let l = 0; l < NL; l++) {
    for (let i = 0; i < K; i++) {
      const fx = MARGIN + S.off[l][0] + R_LED[l] * S.sx[i];
      const fy = MARGIN + S.off[l][1] + R_LED[l] * S.sy[i];
      const ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
      const j = l * K + i;
      S.wOff[j] = iy * RW + ix;
      S.w00[j] = (1 - ax) * (1 - ay);
      S.w10[j] = ax * (1 - ay);
      S.w01[j] = (1 - ax) * ay;
      S.w11[j] = ax * ay;
    }
  }

  // The hue wheel as a rotation about grey.
  const ang = TAU * S.hue, ca = cos(ang), sa = sin(ang) / sqrt(3), q = (1 - ca) / 3;
  S.cm[0] = ca + q; S.cm[1] = q - sa; S.cm[2] = q + sa;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const v = S.v, T0 = S.T[0], T1 = S.T[1], T2 = S.T[2];
  const w00 = S.w00, w10 = S.w10, w01 = S.w01, w11 = S.w11, wOff = S.wOff;
  const inv = 1 / K;
  // The light on the ground: the mean over the Sun's points of the layers' product. A point that
  // meets a closed layer is dropped before the next layers are read.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b = y * RW + x;
      let acc = 0;
      for (let i = 0; i < K; i++) {
        let j = b + wOff[i];
        let p = w00[i] * T0[j] + w10[i] * T0[j + 1] + w01[i] * T0[j + RW] + w11[i] * T0[j + RW + 1];
        if (p <= 0.003) continue;
        const i1 = K + i;
        j = b + wOff[i1];
        p *= w00[i1] * T1[j] + w10[i1] * T1[j + 1] + w01[i1] * T1[j + RW] + w11[i1] * T1[j + RW + 1];
        if (p <= 0.003) continue;
        const i2 = 2 * K + i;
        j = b + wOff[i2];
        p *= w00[i2] * T2[j] + w10[i2] * T2[j + 1] + w01[i2] * T2[j + RW] + w11[i2] * T2[j + RW + 1];
        acc += p;
      }
      v[y * W + x] = acc * inv;
    }
  }

  // Each spot is read against the brightest point near it (the 4 by 4 blocks' maximum, spread
  // over the 3 by 3 blocks round it, taken to the 0.8 power). A gap much smaller than the Sun's
  // image makes a dim spot, and without this it would be drawn dim and fat; read like this it is
  // drawn at the same kind of edge as a bright one, so a thin crescent keeps its horns.
  const q = S.q, qm = S.qm, qm2 = S.qm2, lit = S.lit;
  for (let qy = 0; qy < 32; qy++) {
    for (let qx = 0; qx < 16; qx++) {
      let s = 0, m = 0;
      for (let dy = 0; dy < 4; dy++) {
        const row = (qy * 4 + dy) * W + qx * 4;
        for (let dx = 0; dx < 4; dx++) {
          const e = v[row + dx];
          s += e;
          if (e > m) m = e;
        }
      }
      q[qy * 16 + qx] = s / 16;
      qm[qy * 16 + qx] = m;
    }
  }
  for (let qy = 0; qy < 32; qy++) {
    for (let qx = 0; qx < 16; qx++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = qy + dy;
        if (yy < 0 || yy > 31) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = qx + dx;
          if (xx < 0 || xx > 15) continue;
          const e = qm[yy * 16 + xx];
          if (e > m) m = e;
        }
      }
      qm2[qy * 16 + qx] = m ** 0.8 + 0.03;
    }
  }
  // The eclipse darkens the shade by up to a third and the spots by a seventh.
  const dimA = 1 - 0.34 * S.dark, dimS = 1 - 0.14 * S.dark;
  for (let y = 0; y < H; y++) {
    const fy = cl((y - 1.5) / 4, 0, 30.999), iy = floor(fy), ty = fy - iy;
    for (let x = 0; x < W; x++) {
      const fx = cl((x - 1.5) / 4, 0, 14.999), ix = floor(fx), tx = fx - ix;
      const qi = iy * 16 + ix;
      const nrm = mix(mix(qm2[qi], qm2[qi + 1], tx), mix(qm2[qi + 16], qm2[qi + 17], tx), ty);
      // A peak under about 0.025 is a sliver of a gap, too faint to be a spot, and fades out.
      lit[y * W + x] = (v[y * W + x] / nrm) * EXPO * sstep(0.08, 0.14, nrm);
    }
  }
  // A 5-tap blur in each direction ([1 2 3 2 1] / 9) gives every edge a soft shoulder and takes a
  // line 1 LED thick down to a third of its height, so it falls under the edge of the ramp: a
  // feature on the panel is 2 LEDs thick or it is not drawn.
  const tmp = S.tmp;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const x0 = max(0, x - 2), x1 = max(0, x - 1), x2 = min(W - 1, x + 1), x3 = min(W - 1, x + 2);
      tmp[row + x] = (lit[row + x0] + 2 * lit[row + x1] + 3 * lit[row + x] + 2 * lit[row + x2] + lit[row + x3]) * (1 / 9);
    }
  }
  for (let y = 0; y < H; y++) {
    const y0 = max(0, y - 2) * W, y1 = max(0, y - 1) * W, y2 = min(H - 1, y + 1) * W, y3 = min(H - 1, y + 2) * W, row = y * W;
    for (let x = 0; x < W; x++) lit[row + x] = (tmp[y0 + x] + 2 * tmp[y1 + x] + 3 * tmp[row + x] + 2 * tmp[y2 + x] + tmp[y3 + x]) * (1 / 9);
  }
  // The halo: the spots averaged over 4 by 4 LEDs and read back smoothly. Shade near light is lighter.
  for (let qy = 0; qy < 32; qy++) {
    for (let qx = 0; qx < 16; qx++) {
      let s = 0;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) s += min(1, lit[(qy * 4 + dy) * W + qx * 4 + dx]);
      q[qy * 16 + qx] = s / 16;
    }
  }

  const cm = S.cm;
  const m00 = cm[0], m01 = cm[1], m02 = cm[2];
  // Skylight reaches the floor more under the high crowns than under the low foliage: the shade follows the zones.
  const rank = S.rank, rx = MARGIN + Math.round(S.off[2][0]), ry = MARGIN + Math.round(S.off[2][1]);
  for (let y = 0; y < H; y++) {
    const fy = cl((y - 1.5) / 4, 0, 30.999), iy = floor(fy), ty = fy - iy;
    for (let x = 0; x < W; x++) {
      const fx = cl((x - 1.5) / 4, 0, 14.999), ix = floor(fx), tx = fx - ix;
      const qi = iy * 16 + ix;
      const halo = mix(mix(q[qi], q[qi + 1], tx), mix(q[qi + 16], q[qi + 17], tx), ty);
      const l = lit[y * W + x];
      // The spot: gold at the edge, white at the core, soft shoulders.
      const a = sstep(0.34, 0.66, l);
      const core = sstep(0.5, 0.95, l);
      const sh = clamp01(halo * 1.2 + 0.05 + 0.4 * rank[(y + ry) * RW + x + rx]);
      let r = mix(SHADE_DEEP[0], SHADE_SKY[0], sh), g = mix(SHADE_DEEP[1], SHADE_SKY[1], sh), b = mix(SHADE_DEEP[2], SHADE_SKY[2], sh);
      const hw = halo * 0.3;
      r += WARM_GLOW[0] * hw; g += WARM_GLOW[1] * hw; b += WARM_GLOW[2] * hw;
      const sr = mix(GOLD[0], WHITE[0], core), sg = mix(GOLD[1], WHITE[1], core), sb = mix(GOLD[2], WHITE[2], core);
      r = mix(r, sr, a); g = mix(g, sg, a); b = mix(b, sb, a);
      const R_ = m00 * r + m01 * g + m02 * b, G_ = m02 * r + m00 * g + m01 * b, B_ = m01 * r + m02 * g + m00 * b;
      const d = dimA + (dimS - dimA) * a;
      display.setPixel(x, y, cl(R_ * d, 0, 1) * 255, cl(G_ * d, 0, 1) * 255, cl(B_ * d, 0, 1) * 255);
    }
  }
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
