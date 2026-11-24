// ===== Patternflow pattern =====
// Title:   Karplus-Strong
// Family:  karplus
// Idea:    Thirty-two delay lines lie stacked down the panel, each plucked with a burst of noise that the loop's averaging filter smooths, lap after lap, from speckled warm and cool blocks into a few broad lobes that circulate and fade.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Karplus-Strong plucked-string synthesis (Kevin Karplus and Alex Strong, 1983), analysed as a comb filter with a low-pass in the loop by David Jaffe and Julius Smith (1983), with the drum variant that flips the sign of the average at random and the decay-stretching factor from the original paper, here with two filter heads half a line apart so a burst settles in half the laps, pattern round 239
// Round:   239
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Decay=0.2..3, Brightness=-1..1, Pluck=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel. At 0 a fresh burst is hot pink and amber in its positive blocks and blue in its negative ones, and a settled string is coral over deep teal. Each strip leans a little off that, towards pink or amber on the warm side and teal or blue on the cool side, and the lean drifts down the wall over a few minutes.
// Knob 2: Decay. 0.2 to 3, opening at 2. How long a string rings. The time constant of the loss is 0.5 + 1.8 K2^1.15 seconds, which is 0.8 s at 0.2, 4.5 s at 2 and 6.9 s at 3, then 0.55 to 1.7 times that for each string. At 0.2 a pluck is a flash that is gone in two seconds and the player plucks about 19 strings a second to keep the wall lit; at 3 a settled lobe is still there 20 s later.
// Knob 3: Brightness. -1 to 1, opening at 0. The blend of the averaging filter, the share of the next sample mixed into each one on every pass: 0.5 at -1, 0.22 at 0, 0.05 at 1, a little more for the slow strings. At -1 the blocks of a burst are rounded off in two laps and it is down to a few soft lobes in fourteen; at 0 those take four and twenty; at 1 fourteen and nearly sixty, so the blocks keep their edges for a long time, a hard bright mosaic.
// Knob 4: Pluck. -1 to 1, opening at 0.06. How much the player plays, from 1.6 plucks a second at -1, mostly single notes, with 45 percent of the strips ringing, to 5.6 a second at 1, with more chords, runs down the wall and drum strings, and 90 percent of them. At the opening it is 3 a second.

const W = 64, H = 128, NS = 32, RH = 4, NMAX = 48;
const { floor, ceil, min, max, abs, exp, log, pow, sqrt, sin, PI, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * Math.random();
// The wait between gestures in units of the mean wait: two exponentials averaged, so the player is aperiodic but never leaves long silences.
const gap = () => -0.5 * (log(1 - Math.random()) + log(1 - Math.random()));

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A dim colour on the red-orange-yellow-olive stretch of the wheel reads brown, so it is lifted and paled there.
function dim(h, s, v, out, o) {
  const c = frac(h), b = c > 0.9 ? sstep(0.9, 0.97, c) : 1 - sstep(0.2, 0.32, c);
  hsv(h, s * (1 - 0.6 * b), min(1, v * (1 + 1.5 * b * (1 - v))), out, o);
}
// Two ramps from zero to the loudest sample: level, hue, saturation, value. Positive samples run rose, salmon, peach, cream; negative
// ones navy, teal, aqua, pale ice. A fresh burst pushes the warm side towards pink and the cool side towards blue and is a little more
// saturated; a settled string is gold over deep teal.
const POS = [[0, 0.97, 0.8, 0], [0.1, 0.985, 0.8, 0.24], [0.3, 1.0, 0.76, 0.62], [0.55, 1.03, 0.7, 0.95], [0.75, 1.055, 0.58, 1], [0.95, 1.072, 0.38, 1], [1.15, 1.085, 0.14, 1]];
const NEG = [[0, 0.64, 0.85, 0], [0.1, 0.61, 0.85, 0.2], [0.3, 0.55, 0.88, 0.52], [0.55, 0.51, 0.8, 0.86], [0.75, 0.49, 0.6, 1], [0.95, 0.48, 0.36, 1], [1.15, 0.47, 0.12, 1]];
const tmpA = [0, 0, 0];
function ramp(K, l, o) {
  let k = 0;
  while (k < K.length - 2 && l > K[k + 1][0]) k++;
  const a = K[k], b = K[k + 1], f = cl((l - a[0]) / (b[0] - a[0]), 0, 1);
  o[0] = a[1] + (b[1] - a[1]) * f;
  o[1] = a[2] + (b[2] - a[2]) * f;
  o[2] = a[3] + (b[3] - a[3]) * f;
}
// Colour of a sample of level l (0 to 1.15) and sign, on a string whose burst has settled by 1 - phi. The tint leans the warm side
// between pink and amber and the cool side between teal and blue; hue then turns the whole pair round the wheel.
function colour(pos, l, phi, tint, hue, out, o) {
  ramp(pos ? POS : NEG, l, tmpA);
  const h = pos ? tmpA[0] - 0.04 * phi + 0.075 * tint : cl(tmpA[0] + 0.06 * phi + 0.05 * tint, 0.46, 0.68);
  dim(h + hue, min(1, tmpA[1] * (0.85 + 0.15 * phi)) * sat(h + hue), tmpA[2], out, o);
}
// Yellow-green at full saturation is the garish part of the wheel, so it is eased.
const sat = (h) => 1 - 0.4 * sstep(0.1, 0.2, frac(h)) * (1 - sstep(0.4, 0.5, frac(h)));

// ---- the scale ------------------------------------------------------------
// Dorian over two octaves and four notes, degree d is the note SC[d % 7] semitones above the octave floor(d / 7). A string's delay line is
// 48 samples long for the lowest note of an octave and 27 for the highest, as the pitch is the sample rate over N. The octave sets the
// sample rate, 21.6 steps a second in the lowest, so the circulation runs from 0.45 laps a second in the longest line to 2.4 in the shortest.
const SC = [0, 2, 3, 5, 7, 9, 10];
const ND = 18, FS0 = 21.6;

// ---- strings --------------------------------------------------------------
function newString() {
  return {
    buf: new Float32Array(NMAX), N: 32, ptr: 0, acc: 0, fs: FS0, f: 0.45, dir: 1, m: 1,
    pAvg: 1, drum: false, sg: new Int8Array(NMAX), stretch: 1, tauK: 1, loss: 1,
    alive: false, rms: 0, rough: 0, phi: 0, age: 99, deg: 0, env: 0, gn: 1,
    tintO: 0, tintP: 80, tintPh: 0,
  };
}

// Pluck string S at scale degree deg: a new delay length, a new direction, a burst of correlated noise with its mean taken out.
function pluck(S, deg, drum, amp) {
  const o = floor(deg / 7), s = SC[deg % 7];
  const N = round(48 * pow(2, -s / 12));
  S.N = N;
  S.fs = FS0 * (1 << o);
  S.f = S.fs / N;
  S.m = ceil(N / 16);
  S.dir = Math.random() < 0.5 ? -1 : 1;
  S.drum = drum;
  S.stretch = drum ? 1 + 0.6 * Math.random() : Math.random() < 0.7 ? 1 : 1 + rnd(0.3, 1);
  S.pAvg = 1 / S.stretch;
  S.tauK = rnd(0.55, 1.7) * (drum ? 0.8 : 1);
  S.tintO = rnd(-0.5, 0.5);
  S.tintP = rnd(50, 140);
  S.tintPh = rnd(0, TAU);
  S.deg = deg;
  S.ptr = floor(Math.random() * N);
  S.acc = 0;
  const b = S.buf;
  let sum = 0;
  for (let j = 0; j < N; j += S.m) {
    const v = (Math.random() < 0.5 ? -1 : 1) * (0.4 + 0.6 * Math.random());
    for (let q = 0; q < S.m && j + q < N; q++) (b[j + q] = v), (sum += v);
  }
  const mean = sum / N;
  let top = 0;
  for (let j = 0; j < N; j++) {
    b[j] -= mean;
    top = max(top, abs(b[j]));
  }
  const g = amp / max(top, 1e-6);
  for (let j = 0; j < N; j++) b[j] *= g;
  for (let j = N; j < NMAX; j++) b[j] = 0;
  S.alive = true;
  S.age = 0;
  S.rms = amp * 0.7;
  S.env = amp;
  S.gn = 1;
  S.phi = 1;
  S.rough = 1;
}

// One filter pass on sample j: it is replaced by the blend of itself and its neighbour, times the loss. A drum flips the sign of the
// average at random, once for each block of samples the burst was made of. With the stretch factor S the pass happens only one time in S.
function pass(S, j, w) {
  const b = S.buf, N = S.N;
  let v = b[j];
  if (S.pAvg >= 1 || Math.random() < S.pAvg) {
    v = (1 - w) * v + w * b[j + 1 === N ? 0 : j + 1];
    if (S.drum) {
      const q = floor(j / S.m);
      if (j % S.m === 0) S.sg[q] = Math.random() < 0.5 ? -1 : 1;
      v *= S.sg[q];
    }
  }
  b[j] = v * S.loss;
}

// One step of the loop: the read pointer moves on by one sample and two heads half a line apart filter, so every sample is filtered
// twice a lap and a burst settles in about half the laps a single head would take.
function ksStep(S, w) {
  const N = S.N, j = S.ptr;
  pass(S, j, w);
  pass(S, (j + (N >> 1)) % N, w);
  S.ptr = j + 1 === N ? 0 : j + 1;
  if (S.ptr === 0) {
    // Once a lap, the mean goes, so the string stays centred on zero.
    const b = S.buf;
    let mean = 0;
    for (let q = 0; q < N; q++) mean += b[q];
    mean /= N;
    for (let q = 0; q < N; q++) b[q] -= mean;
  }
}

// ---- state ----------------------------------------------------------------
export function setup(params) {
  params.st = {
    k: [0, 2, 0, 0.06], t: 0, dt: 1 / 30, init: false,
    str: Array.from({ length: NS }, newString),
    q: [], haz: 0, hnext: gap(), cur: 7 + floor(Math.random() * 6), cover: 0.5, boost: 0,
    rgb: new Float32Array(W * 3), col: [0, 0, 0],
  };
}

const wOf = (k3) => (k3 < 0 ? 0.22 - 0.28 * max(k3, -1) : 0.22 * pow(0.227, min(k3, 1)));
const tauOf = (k2) => 0.5 + 1.8 * pow(cl(k2, 0.2, 3), 1.15);

// Choose a quiet string: of a few random strips the one with the least ringing in it and around it.
function pickString(st, taken) {
  let best = -1, bs = 1e9;
  for (let c = 0; c < 9; c++) {
    const i = floor(Math.random() * NS);
    if (taken && taken.indexOf(i) >= 0) continue;
    let sc = 0;
    for (let d = -2; d <= 2; d++) {
      const j = i + d;
      if (j >= 0 && j < NS) sc += st.str[j].rms * (d === 0 ? 1.4 : 1 / (1 + abs(d))) + (st.str[j].age < 0.4 ? 0.5 : 0);
    }
    sc += Math.random() * 0.03;
    if (sc < bs) (bs = sc), (best = i);
  }
  return best < 0 ? floor(Math.random() * NS) : best;
}

// The random walk on the scale: mostly a step or two, now and then a leap, pulled back to the middle of the range.
function walk(st) {
  let d = st.cur;
  const r = Math.random();
  if (r < 0.46) d += Math.random() < 0.5 ? -1 : 1;
  else if (r < 0.8) d += Math.random() < 0.5 ? -2 : 2;
  else if (r < 0.92) d += (Math.random() < 0.5 ? -1 : 1) * floor(3 + 3 * Math.random());
  else d = floor(rnd(3, ND - 3));
  if (d < 0) d = -d;
  if (d > ND - 1) d = 2 * (ND - 1) - d;
  st.cur = cl(d, 0, ND - 1);
  return st.cur;
}

function gesture(st, t, k4n) {
  const r = Math.random(), amp = rnd(0.78, 1);
  const pChord = 0.12 + 0.12 * k4n, pRun = 0.06 + 0.14 * k4n, pDrum = 0.06 + 0.07 * k4n;
  if (r < pDrum) {
    const n = 1 + (Math.random() < 0.3 + 0.3 * k4n ? 1 : 0), taken = [];
    for (let q = 0; q < n; q++) {
      const i = pickString(st, taken);
      taken.push(i);
      st.q.push({ t: t + q * rnd(0.05, 0.2), i, d: floor(rnd(1, 15)), drum: true, a: amp });
    }
  } else if (r < pDrum + pChord) {
    const d = walk(st), base = d > ND - 5 ? d - 7 : d, taken = [];
    const notes = Math.random() < 0.3 ? [0, 2, 4, 7] : [0, 2, 4];
    const rolled = rnd(0.02, 0.09);
    notes.forEach((n, q) => {
      const i = pickString(st, taken);
      taken.push(i);
      st.q.push({ t: t + q * rolled, i, d: cl(base + n, 0, ND - 1), drum: false, a: amp * rnd(0.85, 1) });
    });
  } else if (r < pDrum + pChord + pRun) {
    const len = floor(rnd(4, 8)), up = Math.random() < 0.5, dd = Math.random() < 0.8 ? 1 : 2, gapT = rnd(0.07, 0.16);
    const down = Math.random() < 0.5;
    let i = down ? floor(rnd(0, NS - len)) : floor(rnd(len, NS));
    // Start where it is quietest of three tries.
    for (let c = 0; c < 3; c++) {
      const i2 = down ? floor(rnd(0, NS - len)) : floor(rnd(len, NS));
      if (st.str[i2].rms < st.str[i].rms) i = i2;
    }
    let d = walk(st);
    for (let q = 0; q < len; q++) {
      st.q.push({ t: t + q * gapT, i: cl(i + (down ? q : -q), 0, NS - 1), d, drum: false, a: amp * rnd(0.8, 1) });
      d += up ? dd : -dd;
      if (d < 0) d = -d;
      if (d > ND - 1) d = 2 * (ND - 1) - d;
      d = cl(d, 0, ND - 1);
    }
    st.cur = d;
  } else {
    st.q.push({ t, i: pickString(st), d: walk(st), drum: false, a: amp });
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], cl(kv[1], 0.2, 3), cl(kv[2], -1, 1), cl(kv[3], -1, 1)];
  if (!st.init) {
    st.init = true;
    // Run the last 45 s before the first frame, so the panel opens with strings already ringing.
    for (let c = 0; c < 450; c++) step(st, 0.1);
  }
  step(st, cl(dt || 0, 0, 0.1));
}

function step(st, d) {
  st.t += d;
  if (d > 0) st.dt = min(d, 0.05);
  const t = st.t, k4 = st.k[3], k4n = (k4 + 1) / 2;
  const w = wOf(st.k[2]), tau = tauOf(st.k[1]);

  // The player. The wall should hold a share of its strips ringing, which the Pluck knob sets (0.45 at -1, 0.9 at 1). Plucks a second to
  // hold that share follow from how long a string stays visible, about twice the time constant, spread over the strings a gesture
  // plucks; a slow correction on the lit share trims what is left over.
  const target = 0.45 + 0.45 * k4n, per = 1.5 + 1.2 * k4n;
  st.boost = cl(st.boost + 0.1 * (target - st.cover) * d, -0.8, 1);
  const lam = (target * NS) / (2 * tau * 1.05 * per) * exp(st.boost + cl(2 * (target - st.cover), -0.8, 1.2));
  st.haz += lam * d;
  while (st.haz >= st.hnext) {
    st.haz -= st.hnext;
    st.hnext = gap();
    gesture(st, t - st.haz / max(lam, 1e-3), k4n);
  }
  for (let c = st.q.length - 1; c >= 0; c--) {
    const e = st.q[c];
    if (e.t <= t) {
      pluck(st.str[e.i], e.d, e.drum, e.a);
      st.q.splice(c, 1);
    }
  }

  // The strings: each runs its own fixed steps, so what is on the panel does not depend on the frame time.
  let cov = 0;
  for (let i = 0; i < NS; i++) {
    const S = st.str[i];
    S.age += d;
    if (!S.alive) continue;
    // The loss per lap from a time constant that is a little longer for the slow strings, and the blend a little stronger for them.
    const ti = tau * S.tauK * pow(S.f / 0.9, -0.3);
    S.loss = exp(-1 / (S.f * ti));
    S.env *= exp(-d / ti);
    const wi = min(0.5, w * cl(pow(0.9 / S.f, 0.5), 0.8, 1.7));
    S.acc += d * S.fs;
    let n = floor(S.acc);
    S.acc -= n;
    while (n-- > 0) ksStep(S, wi);
    let e = 0, r = 0, pk = 0;
    const b = S.buf, N = S.N;
    for (let j = 0; j < N; j++) {
      const x = b[j], y = b[j + 1 === N ? 0 : j + 1] - x;
      e += x * x;
      r += y * y;
      pk = max(pk, abs(x));
    }
    S.rms = sqrt(e / N);
    S.rough = r / (e + 1e-9);
    S.phi += (sstep(0.1, 0.6, S.rough) - S.phi) * (1 - exp(-d / 0.5));
    // The averaging takes the energy out of the noise, and that alone would leave a settled string dim. The picture shows each string
    // scaled to its own loudest sample times the loss envelope, so what fades it is the loss; a drum is scaled only part of the way and fades faster.
    S.gn = min(10, S.drum ? pow(S.env / max(pk, 1e-4), 0.6) : S.env / max(pk, 1e-4));
    const lev = S.drum ? 0.7 * S.env : S.env;
    if (lev < 0.012 || pk < 1e-4) {
      S.alive = false;
      S.rms = 0;
      b.fill(0);
    }
    cov += sstep(0.03, 0.25, S.alive ? lev : 0);
    S.rms = S.alive ? lev * 0.5 : 0;
  }
  st.cover += (cov / NS - st.cover) * (1 - exp(-d / 0.4));
}

// ---- drawing --------------------------------------------------------------
const RG = [0.6, 1, 1, 0.3];
const smooth = (f) => f * f * (3 - 2 * f);

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const t = st.t, hue = st.k[0], c = st.col;
  for (let i = 0; i < NS; i++) {
    const S = st.str[i];
    // The tint slides down the wall, and each string leans its own way and drifts on its own period.
    const tint = 0.55 * sin(TAU * (i / NS * 0.8 + t / 170)) + (S.alive ? S.tintO + 0.3 * sin(TAU * t / S.tintP + S.tintPh) : 0);
    const rgb = st.rgb;
    if (!S.alive) {
      for (let x = 0; x < W; x++) {
        colour(true, 0.02, 0, tint, hue, c, 0);
        rgb[x * 3] = c[0] * 255; rgb[x * 3 + 1] = c[1] * 255; rgb[x * 3 + 2] = c[2] * 255;
      }
    } else {
      const N = S.N, b = S.buf, sc = N / W, flash = 1 + 0.3 * exp(-S.age / 0.2);
      // A string that moves several samples a frame is smeared along its travel, so a fast one does not strobe.
      const trav = min(1.6, S.fs * st.dt), K = trav > 0.4 ? 4 : 1;
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let q = 0; q < K; q++) {
          const u = S.ptr + S.acc - (K > 1 ? (q / (K - 1)) * trav : 0) + (S.dir > 0 ? x + 0.5 : W - x - 0.5) * sc - 0.5;
          const i0 = floor(u), f = smooth(u - i0), a = b[((i0 % N) + N) % N], bb = b[(((i0 + 1) % N) + N) % N];
          v += a + (bb - a) * f;
        }
        v /= K;
        const l = cl(pow(abs(v) * S.gn, 0.7) * 1.15 * flash, 0, 1.15);
        colour(v >= 0, l, S.phi, tint, hue, c, 0);
        rgb[x * 3] = c[0] * 255; rgb[x * 3 + 1] = c[1] * 255; rgb[x * 3 + 2] = c[2] * 255;
      }
    }
    for (let r = 0; r < RH; r++) {
      const g = RG[r], y = i * RH + r;
      for (let x = 0; x < W; x++) display.setPixel(x, y, floor(min(255, rgb[x * 3] * g)), floor(min(255, rgb[x * 3 + 1] * g)), floor(min(255, rgb[x * 3 + 2] * g)));
    }
  }
}
