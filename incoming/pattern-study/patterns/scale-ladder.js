// ===== Patternflow pattern =====
// Title:   Scale Ladder
// Family:  blockspin
// Idea:    One critical Ising magnet on a 64 by 32 torus is drawn four times down the panel, as single spins and then as majority blocks of 2 by 2, 4 by 4 and 8 by 8 spins, so the fractal clusters look alike at every scale and each cluster flip rolls through all four bands at once.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the two-dimensional Ising model (Wilhelm Lenz 1920, Ernst Ising 1925, its critical temperature by Lars Onsager 1944), the Wolff single-cluster update (Ulli Wolff 1989), block-spin renormalisation (Leo Kadanoff 1966), all from memory, pattern round 237
// Round:   237
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=0..4, Pace=-1..1, Stretch=-1..1
//
// Knob 1: Hue. Turns the two spin colours round the wheel together. At 0 the up spins are teal and the down spins coral. Over a minute or two the two hues also drift a little towards and away from each other, so the pair never sits on one pair of colours for long.
// Knob 2: Heat. 0 to 4, opening at 2. The temperature of the magnet as a share of its critical temperature: exactly critical at 0, 1.05 at 2, and 1.42 at 4. Near 0 the clusters are huge and fractal, whole domains turn over at once, and the 8 by 8 band shows the same shapes as the spin band. At 4 the spins are fine speckle that the 2 by 2 band already averages to grey and the coarse bands lose almost all their colour.
// Knob 3: Pace. -1 to 1, opening at 0. How many spins turn over each second, counted in sweeps of the whole 2048-spin lattice: 0.04 sweeps a second at -1, where one big cluster turns over every few seconds, 0.3 at 0, and 2.4 at 1, where the lattice boils and the flip waves overlap. The slow sideways drift of the window speeds up a little with it.
// Knob 4: Stretch. -1 to 1, opening at 0.06 where the coupling is the same both ways. At -1 the bonds along the columns are 3.2 times stronger than along the rows and the clusters stand up as vertical stripes; at 1 the bonds along the rows are 2.8 times stronger and the clusters lie down as horizontal stripes. The temperature knob stays relative to the critical point of the stretched lattice, so the picture stays critical as it stretches.

const W = 64, H = 128;
const LW = 256, LH = 128, SH = 8, N = LW * LH; // the magnet: 256 by 128 spins, the panel looks at a window of 64 by 32 of them
const VW = 64, VH = 32;                        // the window: one band of the panel
const QCAP = 32768;                  // flips waiting to show
const { floor, abs, exp, log, sin, min, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.12, 0.2, c);
  hsv(h, s * (1 - 0.3 * b), min(1, v * (1 + 0.6 * b)), out, o);
}

// The critical coupling of the stretched lattice: sinh(2 a K) sinh(2 K) = 1, where K = J / T for the
// bonds along the columns and a K for the bonds along the rows. With a = 1 it is ln(1 + sqrt 2) / 2.
function criticalK(a) {
  let lo = 0.05, hi = 3;
  for (let i = 0; i < 48; i++) {
    const mid = 0.5 * (lo + hi);
    const s = Math.sinh(2 * a * mid) * Math.sinh(2 * mid);
    if (s < 1) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// ---- the magnet -----------------------------------------------------------
// Wolff 1989: pick a spin, add each equal neighbour to the cluster with probability 1 - exp(-2 K),
// the bond's own K, and turn the whole cluster over. The cluster is grown breadth first so each
// member knows how many bonds it is from the seed, and the flip is shown that many steps later: it
// rolls outward from the seed instead of switching on at once.
function wolff(st, now) {
  const { spin, queue, depth, px, py } = st;
  const seed = floor(Math.random() * N);
  const s0 = spin[seed];
  spin[seed] = -s0;
  queue[0] = seed;
  depth[0] = 0;
  let head = 0, tail = 1;
  while (head < tail) {
    const i = queue[head], d = depth[head] + 1;
    head++;
    const x = i & (LW - 1), y = i >> SH;
    const xl = (x + LW - 1) & (LW - 1), xr = (x + 1) & (LW - 1);
    const yu = (y + LH - 1) % LH, yd = (y + 1) % LH;
    let j = y * LW + xl;
    if (spin[j] === s0 && Math.random() < px) (spin[j] = -s0), (queue[tail] = j), (depth[tail++] = d);
    j = y * LW + xr;
    if (spin[j] === s0 && Math.random() < px) (spin[j] = -s0), (queue[tail] = j), (depth[tail++] = d);
    j = yu * LW + x;
    if (spin[j] === s0 && Math.random() < py) (spin[j] = -s0), (queue[tail] = j), (depth[tail++] = d);
    j = yd * LW + x;
    if (spin[j] === s0 && Math.random() < py) (spin[j] = -s0), (queue[tail] = j), (depth[tail++] = d);
  }
  if (now >= 0) {
    for (let k = 0; k < tail; k++) {
      if (st.qn >= QCAP) {
        st.shown[queue[k]] = spin[queue[k]];
        st.glow[queue[k]] = 1;
        continue;
      }
      st.qi[st.qn] = queue[k];
      st.qt[st.qn++] = now + min(depth[k] * 0.011, 0.9);
    }
  }
  return tail;
}

// Turn over clusters until `budget` spins have turned, at most `cap` clusters.
function turnOver(st, budget, cap, now) {
  let n = 0;
  while (budget > 0 && n < cap) {
    budget -= wolff(st, now);
    n++;
  }
  return budget;
}

export function setup(params) {
  const st = {
    k: [0, 2, 0, 0.06], t: 0, init: false,
    spin: new Int8Array(N), shown: new Int8Array(N), glow: new Float32Array(N),
    queue: new Int16Array(N + 8), depth: new Int16Array(N + 8),
    qi: new Int16Array(QCAP), qt: new Float32Array(QCAP), qn: 0,
    px: 0.5, py: 0.5, tau: -1, ratio: -1, kc: 0.44, budget: 0, boost: 0,
    sx: 0, sy: 0,
    hueUp: 0.5, hueDn: 0.98, gain: 1,
  };
  for (let i = 0; i < N; i++) st.spin[i] = st.shown[i] = Math.random() < 0.5 ? 1 : -1;
  params.sl = st;
}

// The knobs as the magnet sees them.
function readKnobs(st, kv) {
  st.k = [frac(kv[0]), cl(kv[1], 0, 4), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  const k = st.k;
  // Heat 0..4 as T over Tc: a cubic, so the stretch near the critical point is wide.
  const tau = 1.045 + 0.375 * pow(k[1] / 4, 3.2);
  const ratio = exp(log(3.5) * (k[3] - 0.06)); // Jx over Jy
  let turned = 0;
  if (tau !== st.tau || ratio !== st.ratio) {
    if (st.tau >= 0) turned = abs(tau - st.tau) * 6 + abs(log(ratio / st.ratio));
    if (ratio !== st.ratio) st.kc = criticalK(ratio);
    st.tau = tau;
    st.ratio = ratio;
    const ky = st.kc / tau, kx = ratio * ky;
    st.px = 1 - exp(-2 * kx);
    st.py = 1 - exp(-2 * ky);
  }
  return turned;
}
const pow3 = (v) => v * v * v;

export function update(dt, input, params) {
  if (!params.sl) setup(params);
  const st = params.sl, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  if (!st.init) {
    st.init = true;
    readKnobs(st, kv);
    // Open on a magnet that has been running a while.
    turnOver(st, 30 * N, 40000, -1);
    st.shown.set(st.spin);
    st.glow.fill(0);
  }
  const turned = readKnobs(st, kv);
  const k = st.k;
  st.t += d;
  const t = st.t;

  // A knob moved: let the lattice relax towards its new temperature quickly, over a few frames.
  if (turned > 0.004) st.boost = min(st.boost + N * (1 + 5 * min(1, turned)), 12 * N);

  // How many spins turn over this frame.
  const rate = 0.06 * pow(8, 0.5 * (k[2] + 1)); // sweeps of the whole magnet a second: 0.06, 0.17 and 0.48
  st.budget += rate * N * d;
  const extra = min(st.boost, N * 0.5);
  st.boost -= extra;
  st.budget += extra;
  st.budget = turnOver(st, st.budget, 240, t);
  st.budget = cl(st.budget, -3 * N, 2 * N);

  // Flips whose turn has come show now, bright, and then fade.
  let w = 0;
  for (let q = 0; q < st.qn; q++) {
    if (st.qt[q] <= t) {
      const i = st.qi[q];
      st.shown[i] = st.spin[i];
      st.glow[i] = 1;
    } else {
      st.qi[w] = st.qi[q];
      st.qt[w++] = st.qt[q];
    }
  }
  st.qn = w;
  const decay = exp(-d / (0.6 * pow(rate / 0.17, -0.3)));
  for (let i = 0; i < N; i++) st.glow[i] *= decay;

  // The window drifts over the torus. All four bands drift together so the bands stay one magnet.
  st.sx += d * (1.1 + 0.25 * (k[2] + 1));
  st.sy += d * 0.37;
  if (st.sx >= LW) st.sx -= LW;
  if (st.sy >= LH) st.sy -= LH;

  // The two spin hues wander in opposite directions on periods that do not divide one another.
  const wan = 0.045 * sin(t * 0.0377) + 0.03 * sin(t * 0.0913) + 0.01 * sin(t * 0.2113);
  st.hueUp = 0.47 + k[0] + wan;
  st.hueDn = 0.985 + k[0] - wan;
}

const upCol = new Float32Array(3), dnCol = new Float32Array(3), tmp = new Float32Array(3);

// One cell: m is the mean spin of its block (-1..1), g the mean of the flip glow.
function paint(st, m, g, out, o) {
  const a = abs(m);
  const lift = 0.2 + 0.8 * pow(a, 0.85);
  const sat = (m >= 0 ? 0.88 : 0.74) * (0.45 + 0.55 * sstep(0.0, 0.55, a));
  dim(m >= 0 ? st.hueUp : st.hueDn, sat, 0.9 * lift, tmp, 0);
  const gl = min(1, g * 1.25);
  for (let c = 0; c < 3; c++) out[o + c] = min(1, tmp[c] + (1 - tmp[c]) * 0.48 * gl + 0.06 * gl);
}

const wx = new Float32Array(10), wy = new Float32Array(10);

export function draw(display, params) {
  const st = params.sl;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { shown, glow } = st;
  const ox = floor(st.sx), fx = st.sx - ox, oy = floor(st.sy), fy = st.sy - oy;
  for (let b = 0; b < 4; b++) {
    const B = 1 << b, nx = VW / B, ny = VH / B, y0 = b * VH;
    // Weights of the B + 1 spins a block reaches over with the window moved by a part of a spin.
    // Single spins hold their place and change over quickly; the blocks glide.
    const bx = b === 0 ? sstep(0.3, 0.7, fx) : fx, by = b === 0 ? sstep(0.3, 0.7, fy) : fy;
    for (let j = 0; j <= B; j++) {
      wx[j] = (j === 0 ? 1 - bx : j === B ? bx : 1) / B;
      wy[j] = (j === 0 ? 1 - by : j === B ? by : 1) / B;
    }
    // Gap on the lower and right edge of each block: none for single spins, a soft one for 2 by 2.
    const gap = b === 0 ? 1 : b === 1 ? 0.78 : 0.05;
    for (let cy = 0; cy < ny; cy++) {
      for (let cx = 0; cx < nx; cx++) {
        let m = 0, g = 0;
        for (let i = 0; i <= B; i++) {
          const row = ((cy * B + i + oy) % LH) * LW, wi = wy[i];
          for (let j = 0; j <= B; j++) {
            const idx = row + ((cx * B + j + ox) & (LW - 1)), ww = wi * wx[j];
            m += ww * shown[idx];
            g += ww * glow[idx];
          }
        }
        paint(st, m, g, upCol, 0);
        for (let i = 0; i < B; i++) {
          const y = y0 + cy * B + i;
          for (let j = 0; j < B; j++) {
            const f = (i === B - 1 || j === B - 1) ? gap : 1;
            display.setPixel(cx * B + j, y, upCol[0] * f * 255, upCol[1] * f * 255, upCol[2] * f * 255);
          }
        }
      }
    }
  }
}
