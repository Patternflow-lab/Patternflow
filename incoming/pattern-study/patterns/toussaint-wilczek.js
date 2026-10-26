// ===== Patternflow pattern =====
// Title:   Toussaint-Wilczek
// Family:  particle
// Idea:    Two species of random walkers sprinkled evenly over the panel annihilate wherever they meet, and the chance surplus of one or the other in each patch survives as green and magenta domains that grow like the square root of time behind dark fizzing seams.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion-limited annihilation A + B -> 0 (A. A. Ovchinnikov and Ya. B. Zeldovich, 1978; Doug Toussaint and Frank Wilczek, 1983), pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Density=80..320, Excess=0..1
//
// Knob 1: Hue. Turns both species round the wheel together, B always 0.47 of a turn from A. At 0 A is spring green and B magenta; at 0.25 blue and orange; at 0.6 red and aquamarine. The dim glow of each domain behind its walkers skips the orange and yellow part of the wheel, which reads brown and olive when dark.
// Knob 2: Speed. Hops a second for every walker, 4 for each unit: 8 at 2, 0.8 at 0.2, 12 at 3. The panel is sprinkled again after 100 hops, every 12.5 seconds at 2, so the 2 to 8 second window sees hops 16 to 64, where a row crosses a domain in 16 LEDs on average at the start and 29 at the end, the square root of four times the hops.
// Knob 3: Density. How many A and how many B each LED gets at the sprinkle, as Poisson means, from 80 to 320. Most cancel on the spot and about 10 a LED are left at 80 (20 at 320). The domains grow at the same pace at any Density, and only their fill changes: after 40 hops 0.71 walkers a LED are left at 80 and 1.40 at 320, the square root of four times as many, and 45% or 64% of the LEDs hold one.
// Knob 4: Excess. A surplus of A over B at the sprinkle, 1.6 x knob^2 a LED: 0.006 at the opening 0.06, 47 walkers on the whole panel, 0.4 at 0.5 and 1.6 at 1. The surplus never cancels, so the magenta minority dies out while the green fills in: at 1 the 2,011 B left after 8 hops are 4 after 96, and at 0.5 the 4,881 are 556.
// Buttons: K1 tap sprinkles the panel afresh.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, log, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Hops per walker per second at Speed 1. At 8 hops a second the 2 to 8
// second window spans hops 16 to 64, where the LEDs holding a walker fall
// from 59% to 39%: dense enough to read every domain, sparse enough that
// the seams between them are already dark.
const RATE = 4;
// Hops per walker before the panel is sprinkled again. By 100 a row
// crosses a domain in 37 LEDs on average, on a panel 64 wide, and the
// walls start to set the domains' size instead of the walk.
const LIFE = 100;
// Hue of species A at knob 0; B sits opposite.
const HUE_A = 0.38;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown and olive, so the glow's hue wheel skips
// 0.03..0.18 and runs the rest a little faster.
const glowHue = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

export function setup(params) {
  let seed = (Math.random() * 4294967296) >>> 0 || 1;
  params.s = {
    // Signed count per LED: A is positive, B negative. An A and a B on one
    // LED cancel at once, so a sign says which species is there.
    m: new Int32Array(N), pos: new Int32Array(N), neg: new Int32Array(N),
    spark: new Float32Array(N), glow: new Float32Array(N), tmp: new Float32Array(N),
    hops: 0, hue: 0, speed: 2, n0: 80, ex: 0.06, born: false, extinct: 0,
    rnd: () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    },
    pal: new Float32Array(24), palHue: -1, rgb: new Float32Array(N * 3),
  };
}

// A Poisson count, by its normal: the means here are 80 and up.
function poisson(S, l) {
  const u = (S.rnd() + 1) / 4294967297, v = S.rnd() / 4294967296;
  return max(0, floor(l + sqrt(l) * sqrt(-2 * log(u)) * cos(2 * PI * v) + 0.5));
}

// Every LED gets a Poisson number of A and of B; what is left after they
// cancel on the spot is the starting field. Its sign is white noise, and
// the walk smooths it: a patch L LEDs wide keeps a surplus of about L times
// the square root of the Density, so the density left falls as one over
// the square root of the hops (Toussaint and Wilczek's t^(-d/4) in two
// dimensions), not as one over the hops the well-stirred rate law gives.
// Over 5 to 80 hops it fell with exponent -0.49 at Density 80.
function sprinkle(S) {
  const d = 1.6 * S.ex * S.ex;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += S.m[i] = poisson(S, S.n0) - poisson(S, S.n0);
  // The two species start exactly level, or level but for the Excess: a
  // chance surplus over the whole panel would hand it to one colour within
  // seconds. Each correction adds or cancels one particle on a random LED.
  for (let k = Math.round(d * N) - sum, s = k > 0 ? 1 : -1; k !== 0; k -= s) S.m[S.rnd() % N] += s;
  S.hops = 0;
  S.extinct = 0;
  S.spark.fill(0);
}

// One sub-step: each walker hops to a random neighbour with chance p, the
// walls reflect, and opposite signs arriving on one LED annihilate in pairs.
// The signed sum is the whole reaction; the spark marks where it happened.
function step(S, p) {
  const { m, pos, neg, spark } = S;
  pos.fill(0);
  neg.fill(0);
  const P = floor(p * 1073741824);
  let nA = 0, nB = 0;
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      let k = m[i];
      if (!k) continue;
      const to = k > 0 ? pos : neg;
      k = abs(k);
      if (m[i] > 0) nA += k;
      else nB += k;
      for (let j = 0; j < k; j++) {
        const r = S.rnd();
        if (r >>> 2 >= P) {
          to[i]++;
          continue;
        }
        const d = r & 3;
        let xx = x, yy = y;
        if (d === 0) xx = x + 1 < W ? x + 1 : x - 1;
        else if (d === 1) xx = x > 0 ? x - 1 : x + 1;
        else if (d === 2) yy = y + 1 < H ? y + 1 : y - 1;
        else yy = y > 0 ? y - 1 : y + 1;
        to[yy * W + xx]++;
      }
    }
  for (let i = 0; i < N; i++) {
    const a = pos[i], b = neg[i];
    m[i] = a - b;
    if (a && b) spark[i] = 1;
  }
  S.nA = nA;
  S.nB = nB;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 80, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.n0 = cl(kv[2], 80, 320);
  S.ex = cl(kv[3], 0, 1);
  const tap = input.btnPressed && input.btnPressed[0];
  if (!S.born || tap || S.hops > LIFE || S.extinct > 40) {
    sprinkle(S);
    S.born = true;
  }
  // Hops this frame, split into sub-steps of at most one hop each, so a walker
  // moves on some frames and not others instead of jumping two LEDs.
  const want = d * S.speed * RATE, n = Math.ceil(want - 1e-9);
  for (let k = 0; k < n; k++) step(S, want / n);
  S.hops += want;
  if (!S.nA || !S.nB) S.extinct += want;
  for (let i = 0; i < N; i++) S.spark[i] *= exp(-d * 3.5);
  // The glow: the signed field blurred by two box passes of radius 2, scaled
  // by its own spread so it holds its brightness while the walkers thin out.
  const { m, glow, tmp } = S;
  for (let i = 0; i < N; i++) glow[i] = m[i];
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      const o = y * W;
      for (let x = -2; x <= 2; x++) acc += glow[o + cl(x, 0, W - 1)];
      for (let x = 0; x < W; x++) {
        tmp[o + x] = acc / 5;
        acc += glow[o + min(W - 1, x + 3)] - glow[o + max(0, x - 2)];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -2; y <= 2; y++) acc += tmp[cl(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        glow[y * W + x] = acc / 5;
        acc += tmp[min(H - 1, y + 3) * W + x] - tmp[max(0, y - 2) * W + x];
      }
    }
  }
  let ss = 0;
  for (let i = 0; i < N; i++) ss += glow[i] * glow[i];
  S.rms = sqrt(ss / N) || 1;
}

function palette(S) {
  const P = S.pal, h = HUE_A + S.hue;
  hsv(h, 0.8, 1, P, 0); // A particle
  hsv(h + 0.47, 0.75, 1, P, 3); // B particle
  hsv(glowHue(h), 0.85, 1, P, 6); // A glow
  hsv(glowHue(h + 0.47), 0.85, 1, P, 9); // B glow
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const { m, glow, spark, pal: P, rgb } = S;
  const inv = 1 / (1.6 * S.rms);
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const k = m[i];
    if (k) {
      const c = k > 0 ? 0 : 3, a = abs(k), L = a === 1 ? 0.93 : a === 2 ? 0.97 : 1;
      rgb[o] = P[c] * L;
      rgb[o + 1] = P[c + 1] * L;
      rgb[o + 2] = P[c + 2] * L;
      continue;
    }
    // Gaps stay dark against the walkers, which keeps the speckle sharp; a
    // gap next to walkers lifts a little, so steps between gaps are soft.
    const x = i % W, nb = (x + 1 < W && m[i + 1] ? 1 : 0) + (x > 0 && m[i - 1] ? 1 : 0) + (i + W < N && m[i + W] ? 1 : 0) + (i >= W && m[i - W] ? 1 : 0);
    const g = glow[i] * inv, c = g > 0 ? 6 : 9, a = min(1, abs(g)) * 0.2 + 0.01 + 0.01 * nb, sp = spark[i] * 0.45;
    rgb[o] = P[c] * a + sp;
    rgb[o + 1] = P[c + 1] * a + sp;
    rgb[o + 2] = P[c + 2] * a + sp;
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * min(1, rgb[o])) | 0, (255 * min(1, rgb[o + 1])) | 0, (255 * min(1, rgb[o + 2])) | 0);
}
