// ===== Patternflow pattern =====
// Title:   Hair Oil
// Family:  cosmetic
// Idea:    A fall of teal hair fills the panel top to bottom in swaying locks that part into finer locks toward the ends, under a Kajiya-Kay shine band; beads of gold oil land near the top and slide down the locks, faster where the strands hang steep, splitting in two where a lock forks, and every strand they pass turns a shade richer with a sharp bright band, a pale sheen and a string of glinting beads of oil that lingers for many seconds before it dulls.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 37, after hair oil serums, with the strands lit by the Kajiya-Kay model (James Kajiya and Timothy Kay, 1989)
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drops=0.5..4, Wave=-1..1
//
// Knob 1: Hue. The hair colour once round the wheel, with the oil two thirds of the way on as its accent: at 0 teal hair and gold oil, at 0.15 steel blue and lime, 0.3 purple and aqua, 0.45 raspberry and sky blue, 0.55 rose gold and blue, 0.65 champagne blonde and violet, 0.75 sage and magenta, 0.85 green and coral. From 0.53 to 0.79 the hair is lifted and paled so it never reads brown or olive, and the oil is always at full brightness.
// Knob 2: Speed. At 2 a drop slides about 17 rows a second over the crown, 24 through the middle where the strands hang straight and 15 near the ends, so it crosses the panel in about 6 s; a wave of breeze runs down the hair every 4.6 s, the band rises and falls over 7 s, and where a full drop passed the gloss stays full for 6 s, is half gone after 13 s and gone by 34 s. At 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Drops. Drops landing a second at Speed 2: one every 2 s at 0.5, which keeps 4 or 5 beads on the hair and a quarter of the front strands glossy, up to 4 a second, about 34 beads at a time and four fifths of it glossy. A drop carries 0.6 to 1.2 units of oil and leaves 0.0045 a row; with more than 0.3 left it splits in two at the forks at rows 50 and 88, and under 0.08 it soaks in.
// Knob 4: Wave. At -1 the locks hang straight; at 0 they wave 2 LEDs to each side every 40 rows, each lock in its own phase; at 1 they wave 4 LEDs and turn in depth as well, so every wave catches its own highlight, and the slants hold the drops to 13 to 20 rows a second where straight locks let them run 11 to 28.
// Buttons: K1 tap pours a line of 12 drops across the top: they slide down together, split at the first fork into 24 and leave the upper half of the hair glossy.

const W = 64, H = 128, NB = 110, NF = 150;
const { floor, min, max, sqrt, sin, cos, exp, log, round, random, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

const norm3 = (x, y, z) => {
  const l = sqrt(x * x + y * y + z * z);
  return [x / l, y / l, z / l];
};
// Light from above, a little left and in front; the eye straight on. y runs
// down and z comes out of the panel.
const [LX, LY, LZ] = norm3(-0.15, -0.55, 0.82);
const [HX, HY, HZ] = norm3(LX, LY, LZ + 1);
const TZ0 = -HY / HZ;

// Locks: five across the panel near the top, each parting in two at about
// row 53 and again at about row 92, so 20 fine locks at the ends.
const F1 = [45, 62], F2 = [84, 100];
// Oil: a drop's slide speed in rows a second at Speed 2 on a strand hanging
// straight down, the oil it leaves per row, the volume below which it soaks
// in, and how long the gloss takes to fall to 1/e.
const V0 = 40, LOSS = 0.0045, VMIN = 0.08, TAU = 12, PULL = 0.55;

function wobble(out, o, n) {
  const f = [0, 0, 0].map(() => (1 / 30 + random() / 40) * 2 * PI), ph = [0, 0, 0].map(() => random() * 2 * PI);
  for (let r = 0; r < n; r++) out[o + r] = (sin(f[0] * r + ph[0]) + 0.6 * sin(0.5 * f[1] * r + ph[1]) + 0.4 * sin(0.3 * f[2] * r + ph[2])) / 1.4;
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, rate: 0.5, wave: 0.06, t: 0, warm: false, acc: 0,
    // Front strands, sorted by root position, with their locks at three levels.
    fx0: new Float32Array(NF), k0: new Int32Array(NF), k1: new Int32Array(NF), k2: new Int32Array(NF),
    fbr: new Float32Array(NF), fto: new Float32Array(NF), bp: new Int32Array(NF), bs: new Int32Array(NF),
    c0: new Float32Array(5), c1: new Float32Array(10), c2: new Float32Array(20), lph: new Float32Array(5),
    bx0: new Float32Array(NB), bb: new Float32Array(NB), bto: new Float32Array(NB),
    NX: new Float32Array((NF + NB) * H), NT: new Float32Array((NF + NB) * H),
    xs: new Float32Array(NF * H), zs: new Float32Array(NF * H), ty: new Float32Array(NF * H), G: new Float32Array(NF * H),
    f1: new Float32Array(H), f2: new Float32Array(H), lph1: new Float32Array(10), lph2: new Float32Array(20),
    sa: new Float32Array(20 * H), ca: new Float32Array(20 * H), reach: new Float32Array(H), pullr: new Float32Array(H),
    sx: new Float32Array(H), tz: new Float32Array(H), ws: new Float32Array(H), wz: new Float32Array(H),
    drops: [], born: [],
    ab: new Float32Array(W * H * 5), wt: new Float32Array(W * H), gl: new Float32Array(W * H), fb: new Float32Array(W * H * 3),
    body: [0, 0, 0], deep: [0, 0, 0], tint: [0, 0, 0], oil: [0, 0, 0],
  });
  for (let i = 0; i < NF; i++) S.fx0[i] = -4 + (72 * (i + random())) / NF;
  for (let i = 0; i < NF; i++) {
    S.k0[i] = min(4, floor(((S.fx0[i] + 4) / 72) * 5));
    S.fbr[i] = 0.35 + 0.65 * random() ** 0.6;
    S.fto[i] = (random() - 0.5) * 0.1;
    S.bs[i] = 8 + floor(random() * 4);
    S.bp[i] = floor(random() * 11);
  }
  // Each lock parts into the halves of its strands, so a fork is a real fork.
  const split = (kin, kout, n) => {
    for (let k = 0; k < n; k++) {
      const mem = [];
      for (let i = 0; i < NF; i++) if (kin[i] === k) mem.push(i);
      const half = mem.length >> 1;
      mem.forEach((i, m) => (kout[i] = 2 * k + (m < half ? 0 : 1)));
    }
  };
  split(S.k0, S.k1, 5);
  split(S.k1, S.k2, 10);
  const centre = (kk, c, n) => {
    for (let k = 0; k < n; k++) {
      let s = 0, m = 0;
      for (let i = 0; i < NF; i++) if (kk[i] === k) (s += S.fx0[i]), m++;
      c[k] = m ? s / m : 0;
    }
  };
  centre(S.k0, S.c0, 5);
  centre(S.k1, S.c1, 10);
  centre(S.k2, S.c2, 20);
  for (let k = 0; k < 5; k++) S.lph[k] = random() * 2 * PI;
  for (let k = 0; k < 10; k++) S.lph1[k] = S.lph[k >> 1] + (k & 1 ? 1 : -1) * (0.7 + 0.5 * random());
  for (let k = 0; k < 20; k++) S.lph2[k] = S.lph1[k >> 1] + (k & 1 ? 1 : -1) * (0.5 + 0.5 * random());
  for (let i = 0; i < NB; i++) {
    S.bx0[i] = -5 + (74 * (i + random())) / NB;
    S.bb[i] = 0.3 + 0.7 * random();
    S.bto[i] = (random() - 0.5) * 0.14;
  }
  for (let i = 0; i < NF + NB; i++) {
    wobble(S.NX, i * H, H);
    wobble(S.NT, i * H, H);
  }
}

// Rows: the breeze running down the hair, the waves, and the lean of the
// sheet toward the eye, which puts the shine band where tz meets TZ0.
function rows(S) {
  const t = S.t, wv = (S.wave + 1) / 2;
  const yb = 44 + 12 * sin(2 * PI * (t / 7)) + 3 * sin(2 * PI * (t / 3.1) + 1);
  for (let r = 0; r < H; r++) {
    const reach = ((r + 30) / 158) ** 1.6, a = (2 * PI * r) / 40;
    S.sx[r] = 3 * reach * sin(2 * PI * (r / 120 - t / 4.6)) + reach * sin(2 * PI * (r / 45 - t / 2.3) + 2);
    S.ws[r] = 4 * wv * sin(a + 0.5 * sin(2 * PI * (t / 6.1)));
    S.wz[r] = 0.32 * wv * cos(a + 0.5 * sin(2 * PI * (t / 6.1)));
    S.f1[r] = sm(F1[0], F1[1], r);
    S.f2[r] = sm(F2[0], F2[1], r);
    S.tz[r] = TZ0 + 0.015 * (1 - 0.5 * wv) * (yb - r);
  }
}

// Where each front strand runs this frame, and how steeply.
// Each lock waves in its own phase, and the two halves of a lock drift a
// third of a turn apart past its fork, so the fork opens as a Y. The phase
// of a strand depends only on its fine lock, so the sines are taken once a
// row for each of the 20 fine locks.
function geometry(S) {
  const { xs, zs, ty, sx, tz, f1, f2, NX, NT, G, sa, ca, reach, pullr } = S, t = S.t, wv = (S.wave + 1) / 2, sway = 0.5 * sin(2 * PI * (t / 6.1));
  for (let r = 0; r < H; r++) {
    reach[r] = ((r + 30) / 158) ** 1.6;
    pullr[r] = PULL * sm(3, 32, r);
  }
  for (let k = 0; k < 20; k++) {
    const p0 = S.lph[k >> 2], p1 = S.lph1[k >> 1], p2 = S.lph2[k];
    for (let r = 0; r < H; r++) {
      const a = (2 * PI * r) / 40 + sway + p0 + (p1 - p0) * f1[r] + (p2 - p1) * f2[r];
      sa[k * H + r] = 4 * wv * sin(a);
      ca[k * H + r] = 0.32 * wv * cos(a);
    }
  }
  for (let i = 0; i < NF; i++) {
    const x0 = S.fx0[i], c0 = S.c0[S.k0[i]], c1 = S.c1[S.k1[i]], c2 = S.c2[S.k2[i]], o = i * H, ko = S.k2[i] * H;
    const lock = 1.2 * sin(2 * PI * (t / 3.7) + S.lph[S.k0[i]]), to = S.fto[i];
    let px = 0;
    for (let r = 0; r < H; r++) {
      const c = c0 + (c1 - c0) * f1[r] + (c2 - c1) * f2[r];
      // Oil lays a strand smoother: its own wiggle shrinks by half.
      const g = G[o + r], calm = g < 0.06 ? 1 : 1 - 0.5 * sm(0.06, 0.6, g);
      const x = x0 + pullr[r] * (c - x0) + sx[r] + sa[ko + r] + lock * reach[r] + 0.45 * calm * NX[o + r];
      xs[o + r] = x;
      const tx = r ? x - px : 0, z = tz[r] + ca[ko + r] + to + 0.07 * calm * NT[o + r];
      zs[o + r] = z;
      ty[o + r] = 1 / sqrt(tx * tx + 1 + z * z);
      px = x;
    }
  }
}

function spawn(S, i, y, vol) {
  if (S.drops.length < 48) S.drops.push({ i, y, vol, v: 0, age: 0, soak: 0 });
}

// The front strand whose root lies nearest x.
function strandAt(S, x) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < NF; i++) {
    const d = abs(S.fx0[i] - x);
    if (d < bd) (bd = d), (best = i);
  }
  return best;
}

// A drop moves down its strand, wetting the strands within its radius on
// every row it crosses; at a fork a drop with oil enough splits, half going
// down the sibling lock.
function slide(S, dp, ds) {
  const { xs, ty, G } = S;
  if (dp.soak > 0) {
    dp.soak += ds;
    return dp.soak < 0.5;
  }
  dp.age += ds;
  const r0 = cl(floor(dp.y), 0, H - 1);
  const steep = ty[dp.i * H + r0] ** 4;
  const vt = V0 * (0.45 + 0.55 * sqrt(dp.vol)) * steep * (dp.age < 0.2 ? dp.age / 0.2 : 1);
  dp.v += (vt - dp.v) * min(1, ds * 6);
  const y1 = dp.y + dp.v * ds;
  for (let r = floor(dp.y) + 1; r <= floor(y1); r++) {
    if (r >= H) break;
    if (r < 0) continue;
    const xc = xs[dp.i * H + r], rad = 0.7 + 1.3 * dp.vol, wet = 0.55 + 0.45 * min(1, dp.vol);
    const lo = max(0, dp.i - 12), hi = min(NF - 1, dp.i + 12);
    for (let j = lo; j <= hi; j++) {
      const q = j * H + r;
      if (abs(xs[q] - xc) < rad && G[q] < wet) G[q] = wet;
    }
    dp.vol -= LOSS;
    // Forks: the first at row 50, the second at row 88.
    if ((r === 50 || r === 88) && dp.vol > 0.3) {
      const kk = r === 50 ? S.k1 : S.k2, sib = kk[dp.i] ^ 1;
      let best = -1, bd = 1e9;
      for (let j = max(0, dp.i - 20); j <= min(NF - 1, dp.i + 20); j++)
        if (kk[j] === sib && abs(j - dp.i) < bd) (bd = abs(j - dp.i)), (best = j);
      if (best >= 0) {
        dp.vol *= 0.5;
        S.born.push({ i: best, y: r, vol: dp.vol, v: dp.v, age: 1, soak: 0 });
      }
    }
  }
  dp.y = y1;
  if (dp.vol < VMIN) dp.soak = 0.001;
  return dp.y < H + 3;
}

function step(S, d) {
  const ds = d * (S.speed / 2);
  S.t += ds;
  rows(S);
  geometry(S);
  const fade = exp(-ds / TAU), G = S.G;
  for (let q = 0; q < G.length; q++) G[q] *= fade;
  S.acc += S.rate * ds;
  while (S.acc >= 1) {
    S.acc -= 1;
    spawn(S, floor(random() * NF), 2 + random() * 22, 0.6 + 0.6 * random());
  }
  // A drop born at a fork waits for the end of the pass: filter would drop it.
  S.born.length = 0;
  S.drops = S.drops.filter((dp) => slide(S, dp, ds)).concat(S.born);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.rate = cl(k[2], 0.5, 4);
  S.wave = cl(k[3], -1, 1);
  if (!S.warm) {
    // Open on hair that has had oil for 20 seconds at Speed 2.
    const sp = S.speed;
    S.speed = 2;
    for (let i = 0; i < 200; i++) step(S, 0.1);
    S.speed = sp;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) for (let c = 0; c < 12; c++) spawn(S, strandAt(S, 2.6 + c * 5.3 + (random() - 0.5) * 2), 2 + random() * 4, 0.9 + 0.3 * random());
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { ab, wt, gl, fb, xs, zs, G, NX, NT, sx, ws, wz, tz, body, deep, tint, oil } = S;
  ab.fill(0);
  wt.fill(0);
  gl.fill(0);
  const t = S.t;
  // Kajiya-Kay: the band where the tangent lies square to the half vector,
  // the white one shifted toward the root and a tinted one toward the tip.
  // Dry hair has a soft band; oil makes it six times sharper and twice as
  // bright, and darkens the body a shade.
  const splat = (x, r, w0, dif, s1, s2, oilw, s3) => {
    const xi = floor(x), fr = x - xi, q = r * W + xi;
    for (let e = 0; e < 2; e++) {
      const xx = xi + e;
      if (xx < 0 || xx >= W) continue;
      const w = (e ? fr : 1 - fr) * w0, p = (q + e) * 5;
      ab[p] += dif * (1 - oilw) * w;
      ab[p + 1] += dif * oilw * w;
      ab[p + 2] += s1 * w;
      ab[p + 3] += s2 * w;
      ab[p + 4] += s3 * w;
      wt[q + e] += w;
    }
  };
  // Back layer: a dim, even curtain behind the locks.
  for (let i = 0; i < NB; i++) {
    const o = (NF + i) * H, x0 = S.bx0[i], b = S.bb[i];
    let px = x0;
    for (let r = 0; r < H; r++) {
      const x = x0 + 0.8 * sx[r] + ws[r] + 0.5 * NX[o + r], tx = r ? x - px : 0;
      px = x;
      const z = tz[r] + wz[r] + S.bto[i] + 0.08 * NT[o + r], inv = 1 / sqrt(tx * tx + 1 + z * z);
      const th = (tx * HX + HY + z * HZ) * inv, tl = (tx * LX + LY + z * LZ) * inv, dif = sqrt(max(0, 1 - tl * tl));
      const s1 = 0.35 * exp(40 * log(max(1e-6, 1 - (th - 0.05) ** 2)));
      splat(x, r, 0.8, 0.4 * b * (0.4 + 0.6 * dif), 0.6 * s1 * b, 0, 0, 0);
    }
  }
  for (let i = 0; i < NF; i++) {
    const o = i * H, b = S.fbr[i], bs = S.bs[i], bp = S.bp[i];
    for (let r = 0; r < H; r++) {
      const x = xs[o + r], tx = r ? x - xs[o + r - 1] : 0, ge = sm(0.06, 0.6, G[o + r]);
      const z = zs[o + r], inv = 1 / sqrt(tx * tx + 1 + z * z);
      const th = (tx * HX + HY + z * HZ) * inv, tl = (tx * LX + LY + z * LZ) * inv, dif = sqrt(max(0, 1 - tl * tl));
      const p1 = 70 * (1 + 5 * ge), t1 = th - 0.05, t2 = th + 0.11;
      const l1 = log(max(1e-6, 1 - t1 * t1));
      const s1 = (0.8 + 1.0 * ge) * exp(0.5 * p1 * l1);
      // The oil film also gives a broad sheen of its own colour along the
      // whole strand, which is what draws the streak down the fall.
      const s3 = ge * (0.2 + 0.4 * exp(5 * l1));
      const s2 = 0.45 * exp(0.5 * 0.4 * p1 * log(max(1e-6, 1 - t2 * t2)));
      splat(x, r, 1.5, b * (0.4 + 0.6 * dif), s1 * (0.4 + 0.6 * b), s2 * b, ge, s3);
      // The oil film on a fibre breaks into a string of tiny beads (Plateau
      // and Rayleigh), one every 8 to 11 rows here; each holds a point of
      // light that twinkles as the strand sways.
      if (ge > 0.02 && (r + bp) % bs === 0) {
        const xi = round(x);
        if (xi >= 0 && xi < W) {
          const tw = 0.5 + 0.5 * sin(2 * PI * (t / 1.7) + i * 2.3 + r * 0.7);
          gl[r * W + xi] += 0.9 * ge * tw * tw * tw;
        }
      }
    }
  }
  // Colours. Orange, yellow and yellow-green read brown and olive at mid
  // level, so from hue 0 to 0.26 the hair is lifted and paled toward rose
  // gold, champagne and sage; deep blue reads nearly black, so round hue
  // 0.66 it is paled a little toward cornflower.
  const h = S.hue + 0.47, hh = h - floor(h), warm = sm(-0.03, 0.03, hh) * (1 - sm(0.22, 0.3, hh)), blue = sm(0.56, 0.62, hh) * (1 - sm(0.7, 0.77, hh));
  hsv(h, 0.82 - 0.25 * warm - 0.22 * blue, 1 + 0.35 * warm + 0.1 * blue, body);
  hsv(h + 0.015, 1 - 0.2 * warm - 0.1 * blue, 0.8 + 0.3 * warm + 0.1 * blue, deep);
  hsv(h, 0.7 - 0.25 * warm - 0.15 * blue, 1, tint);
  // The oil is the accent: two thirds of the way round from the hair, gold
  // on teal at 0, and always at full brightness so it never goes muddy.
  const ho = h + 0.66, oo = ho - floor(ho), ow = max(0, 1 - abs(oo - 0.1) / 0.12);
  hsv(ho, 0.62 - 0.17 * ow, 1, oil);
  const RHO = ((NF * 1.5 + NB * 0.8) / 72) * 0.85;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, n = max(wt[q], RHO), p = q * 5;
      const d0 = ab[p] / n, d1 = ab[p + 1] / n, s1 = ab[p + 2] / n, s2 = ab[p + 3] / n, s3 = ab[p + 4] / n, gv = gl[q];
      for (let ch = 0; ch < 3; ch++) {
        const v = 0.6 * d0 * body[ch] + 0.6 * d1 * deep[ch] + 0.8 * s2 * tint[ch] + s1 * (0.82 + 0.18 * tint[ch]) + s3 * (0.5 * oil[ch] + 0.5) + gv * (0.6 * oil[ch] + 0.4);
        fb[q * 3 + ch] = 1 - exp(-1.4 * v);
      }
    }
  // The drops: a clear bead in the oil's colour, brighter toward its foot
  // where it gathers the light, with a dark rim and a white point of light
  // up and to the left.
  for (const dp of S.drops) {
    const grow = min(1, dp.age / 0.15), shrink = dp.soak > 0 ? 1 - dp.soak / 0.5 : 1;
    const rb = (1.5 + 1.2 * sqrt(dp.vol)) * grow * shrink, r0 = cl(round(dp.y), 0, H - 1), xc = xs[dp.i * H + r0] + 0.5, yc = dp.y;
    if (rb < 0.3) continue;
    for (let yy = floor(yc - rb - 1); yy <= yc + rb + 1; yy++)
      for (let xx = floor(xc - rb - 1); xx <= xc + rb + 1; xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const ex = xx + 0.5 - xc, ey = yy + 0.5 - yc, e = sqrt(ex * ex + ey * ey), cov = cl(rb + 0.5 - e, 0, 1);
        if (cov <= 0) continue;
        const rim = 0.8 * sm(rb - 1.1, rb - 0.1, e), lit = 0.7 + 0.35 * cl(ey / rb, -1, 1);
        const hot = cl(1.3 - 1.6 * sqrt((ex + 0.4 * rb) ** 2 + (ey + 0.45 * rb) ** 2), 0, 1), q = (yy * W + xx) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const v = oil[ch] * lit * (1 - rim) + 0.15 * oil[ch] * rim + hot;
          fb[q + ch] += (cl(v, 0, 1) - fb[q + ch]) * cov;
        }
      }
  }
  for (let q = 0; q < W * H; q++) display.setPixel(q % W, (q / W) | 0, round(255 * fb[q * 3]), round(255 * fb[q * 3 + 1]), round(255 * fb[q * 3 + 2]));
}
