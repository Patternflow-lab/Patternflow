// ===== Patternflow pattern =====
// Title:   Inspiral
// Family:  gravwave
// Idea:    Two white-hot black holes circle each other faster and faster at a random place on the panel while their gravitational waves spread over the whole panel as four interleaved spiral arms, gold where the strain is positive and blue where it is negative, until the two blend into one, a flash ring runs out and the remnant rings down, and then a new pair starts somewhere else while the old waves are still crossing.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gravitational radiation from a circular binary and the decay of its orbit by that radiation, Peters, Phys. Rev. 136, B1224 (1964); the rising chirp and the ringdown after the merger as the LIGO detectors recorded them for GW150914 (2016)
// Round:   216
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Chirp=1..4, Speed=30..52, Ratio=1..8
//
// Knob 1: Hue. Adds the knob to the hue of both strain colours, so one turn comes back to where it began. At 0 the positive strain is gold and the negative strain is deep blue; at 0.25 green and violet; at 0.5 the two swap places, blue and gold; at 0.75 magenta and teal.
// Knob 2: Chirp. How slowly the orbit decays, as a multiple of the opening: 0.5 at 1, 1 at the opening 2, 2 at 4. At 1 a pair spirals in over about 5 to 14 s and the arms tighten fast toward the source; at 4 it takes 20 to 57 s, the orbit turns lazily and the arms stay far apart. The frequency at the merger does not change, only the time it takes to get there.
// Knob 3: Speed. The speed of the waves, c, in LEDs a second. The wavelength is c over the wave frequency, so a faster wave is also a wider one: at the opening 28 the arms are 8.5 LEDs apart at the merger and 6.8 in the ringdown, and at 50 they are 15 and 12. The waves cross the 128 LED panel in 4.6 s at 28 and in 2.6 s at 50.
// Knob 4: Ratio. The mass ratio of the two holes, 1 for equal up to 8. It opens at 1, two equal points and an even four-arm spiral. Raised, the heavy hole grows and moves toward the middle of the orbit, the light one shrinks and swings wide, a lopsided third arm grows out of the spiral, and the waves get weaker, to 63 percent of their strength at 8. Each pair also has its own spread, so no two pairs are alike at any setting.

// What is drawn is the plus strain of a binary seen face on, on the whole panel as a flat field. The strain at a
// point r from the pair, at angle phi, is
//   h = A(t - r/c) cos(2 (phi - Phi(t - r/c))) / sqrt(r),
// with Phi the orbital phase and t - r/c the retarded time, the moment the wave now at r left the pair. A wave
// takes r/c to arrive, so a point near the pair shows what the pair was doing a moment ago and a point far out
// shows what it did seconds ago. That is why the arms are wide apart far out, where the orbit was slow when they
// were made, and tight near the source. Each pixel reads the orbit's history at its own retarded time.
// The orbit decays by Peters' law. The time left to the merger, tau, runs as the fourth power of the separation,
// so the orbital angular frequency goes as tau to the power -3/8, the separation as tau to the power 1/4 and the
// amplitude as tau to the power -1/4. Here u is tau in units of TAUC: u = 1 is the moment of contact, where the
// frequency is OMEGA_C, 10.4 rad/s (1.65 turns a second), and
//   omega(u) = OMEGA_C u^(-3/8),  separation(u) = SEP_C u^(1/4),  amplitude(u) = u^(-1/4).
// The Chirp knob scales how many seconds one unit of u takes (TAUC times the knob over 2), and nothing else, so
// the frequency at contact stays put and the pair only takes longer to arrive at it. A pair starts at u between 60
// and 160, which is 11 to 29 s at the opening setting.
// The wave phase P is twice the orbital phase. Each event keeps its own last 8.5 s of P, amplitude and separation
// in ring buffers, one sample every 1/60 s, and a pixel at distance r reads them r/c seconds back and
// interpolates. The history does not depend on the wave speed, so the Speed knob re-scales the whole field at once.
// cos(2 (phi - Phi)) is not computed with an angle: with z = (dx + i dy) / r, it is the real part of
// z^2 exp(-i P). The two sines and cosines the pixel needs are cos and sin of Phi, and the double and triple angles
// follow from them.
// At contact, u = 1, the amplitude has grown by 45 percent over u^(-1/4) in the last 0.27 s, as the real signal
// peaks at the merger. The pair then becomes one remnant. Its phase turns at 1.25 times the frequency at contact
// (26 rad/s, a fixed number, whatever the knobs say), its amplitude falls as exp(-t/0.55 s), about six cycles of
// ringing, and a monopole term fades in over 0.12 s so the ringing reads as rings, gold and blue in turn. A real
// face-on ringdown is only the two-arm term; the ring term is added because a bare spiral does not read as
// ringing. At the same instant a flash ring starts at the source and moves out at c, 3 LEDs wide at half height
// and fading in 0.9 s.
// The third arm is cos(3 (phi - Phi) + 90 degrees) added with weight 0.55 times (q - 1) / (q + 1), q the mass ratio.
// A real face-on signal carries this term only weakly; it is drawn because it is what makes unequal masses look
// unequal. It ends at the merger.
// The strain is summed over the live events, at most three, as a signed number. Positive goes to the gold ramp and
// negative to the blue, brightness following |h| through a power of 0.7. Where the local wavelength falls under
// 7.5 LEDs the oscillation fades out and what is left is its envelope, a soft neutral glow. The glow is
// 0.07 times the envelope everywhere, so the ground is never quite black near a source. At the opening speed the
// shortest wavelength in the field is 6.8 LEDs, the ringdown, so nothing there is under 3.4 LEDs per half cycle.
// The two holes are soft white points about 3 LEDs across at half height (1.4 LEDs sigma for equal masses), each in a
// wider halo. The heavy one has radius a q / (1 + q) smaller and the pair orbits their common centre. A short
// tail follows each point for 0.13 s so the orbit reads in a still frame. The pair starts from 16 LEDs apart and
// ends at 4.4, where the two points overlap into one bar. After the merger one remnant point breathes at the ring
// frequency and fades in 1.1 s.
// A new pair starts when the newest event is a random 0 to 7.5 s from its merger, counted from 0.5 s after it when
// that is negative, so waves from two events cross the panel most of the time, and three at most. The place is the
// farthest from the live events of six random points in the panel's inner part. Each pair draws a mass-ratio spread
// 0.75 to 1.6 that multiplies the knob (the ratio is never under 1), a start of u from 60 to 160, a start phase and
// the next wait from a generator seeded when the pattern starts, so the order of events never repeats.
// The first pair is run for 11 s before the first frame at the knob values it opened with, so the first frame
// has one pair about 8 s from its merger and its waves across the whole panel.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sin, cos, exp, sqrt, round, pow, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the orbit
const STEP = 1 / 60; // seconds between history samples
const RING = 512, RMASK = 511; // samples kept, 8.5 s
const OMEGA_C = 13; // orbital frequency at contact, rad/s
const SEP_C = 4.4; // separation at contact, LEDs
const TAUC = 0.15; // seconds one unit of u takes at the opening Chirp setting
const RING_UP = 1.15; // ringdown frequency over the frequency at contact
const TAU_RD = 0.55; // ringdown decay time, seconds
const PEAK = 0.3; // the amplitude's extra growth over the last 0.27 s before the merger
const FADE_IN = 2.5; // seconds a new pair takes to fade in
const PREROLL = 5.5; // seconds of inspiral a new pair has already radiated when it appears, enough to cross the panel at the lowest speed
const TAIL = 2.8 + 5.4; // seconds after the merger that an event stays live: the ringdown and then the longest crossing at c = 28
const U_OPEN = 45; // u of the first pair at the first frame
const PRE = 11; // seconds the first pair runs before the first frame

// ---- the picture
const R0 = 30; // the amplitude falls as sqrt(R0 / (R0 + r))
const LAM_LO = 4, LAM_HI = 7.5; // wavelength in LEDs under which the oscillation fades out
const RD = 30; // distance in LEDs over which a wave at the frequency of contact falls to 1/e
const XF = 1 / (2 * OMEGA_C * STEP); // wave phase step per sample to frequency over the frequency at contact
const THIRD = 1.0; // weight of the third arm at the biggest mass difference
const MONO = 0.7; // weight of the ring term in the ringdown
const GLOW = 0.07; // neutral glow per unit of envelope
const BG = [2, 2.5, 5]; // the floor, out of 255

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
}

function newEvent() {
  return {
    on: false, x: 0, y: 0, f: 1, u: 1, P: 0, kStart: 0, kBirth: 0, kMerge: 0, merged: false,
    PH: new Float64Array(RING), A: new Float32Array(RING), SP: new Float32Array(RING), M: new Float32Array(RING),
    q: 1, gq: 1, b3: 0,
  };
}

export function setup(params) {
  const rng = mulberry32(floor(Math.random() * 4294967296));
  const S = {
    rng, k: 0, ready: false,
    ev: [newEvent(), newEvent(), newEvent(), newEvent()],
    lead: 0,
    hue: 0, sc: 1, c: 30, ratio: 1, hueBuilt: -1,
    lutP: new Float32Array(256 * 3), lutN: new Float32Array(256 * 3),
    Hs: new Float32Array(N), Gs: new Float32Array(N), Fs: new Float32Array(N), buf: new Float32Array(N * 3),
  };
  params.s = S;
}

// The event's state at step k, written into its history.
function sample(e, k) {
  const slot = k & RMASK;
  let A, sep, mono = 0;
  if (!e.merged) {
    const u = e.u;
    A = pow(u, -0.2) * (1 + PEAK * sm(2.5, 1, u));
    sep = SEP_C * pow(u, 0.25);
  } else {
    const age = (k - e.kMerge) * STEP;
    A = (1 + PEAK) * exp(-age / TAU_RD);
    sep = 0;
    mono = MONO * sm(0, 0.12, age);
  }
  e.PH[slot] = e.P;
  e.A[slot] = A;
  e.SP[slot] = sep;
  e.M[slot] = mono;
}

// One step of one event's orbit, to step k. False once the event is over.
function advance(e, k, sc) {
  if (!e.merged) {
    e.P += 2 * OMEGA_C * pow(e.u, -0.375) * STEP;
    e.u -= STEP / (TAUC * sc);
    if (e.u <= 1) {
      e.u = 1;
      e.merged = true;
      e.kMerge = k;
    }
  } else {
    e.P += 2 * OMEGA_C * RING_UP * STEP;
    if ((k - e.kMerge) * STEP > TAIL) return false;
  }
  sample(e, k);
  return true;
}

function massNow(S, e) {
  const q = cl(S.ratio * e.f, 1, 12);
  e.q = q;
  e.gq = pow(4 * q / ((1 + q) * (1 + q)), 0.5);
  e.b3 = THIRD * (q - 1) / (q + 1);
}

// A new pair. The first one is placed near the middle and starts at u0, and its history is run by the caller. Any
// other one is already PREROLL seconds into its inspiral when it appears: its history is run here, so its waves
// are out across the whole panel at once, and the picture fades them in over FADE_IN seconds.
function spawn(S, first, u0) {
  const rng = S.rng;
  let e = null;
  for (const o of S.ev) if (!o.on) { e = o; break; }
  let bx = 0, by = 0, bd = -1;
  for (let i = 0; i < 6; i++) {
    const cx = 14 + 36 * rng(), cy = 26 + 76 * rng();
    let d = 1e9;
    for (const o of S.ev) if (o.on) d = min(d, sqrt((cx - o.x) ** 2 + (cy - o.y) ** 2));
    if (d > bd) { bd = d; bx = cx; by = cy; }
  }
  const fx = 24 + 16 * rng(), fy = 50 + 28 * rng();
  const f = 0.75 + 0.85 * rng(), un = 55 + 95 * rng(), P0 = 2 * PI * rng();
  const wait = first ? 2 * rng() : -1 + 4.5 * rng();
  if (!e) return;
  const nPre = first ? 0 : round(PREROLL / STEP);
  const ub = first ? u0 : max(un, 1 + (PREROLL + 2) / (TAUC * S.sc)); // u at the moment it appears
  e.on = true;
  e.x = first ? fx : bx;
  e.y = first ? fy : by;
  e.f = f;
  e.u = ub + nPre * STEP / (TAUC * S.sc);
  e.P = P0;
  e.merged = false;
  e.kMerge = 0;
  e.kStart = S.k - nPre;
  e.kBirth = first ? -1000000 : S.k;
  sample(e, e.kStart);
  for (let j = 1; j <= nPre; j++) advance(e, e.kStart + j, S.sc);
  massNow(S, e);
  // The next pair starts this many seconds before this one merges, or after it when negative; never before 60 percent of this pair's inspiral has gone.
  S.lead = min(wait, 0.4 * (ub - 1) * TAUC * S.sc);
  S.last = e;
}

// One 1/60 s step of every live event, and the start of a new one when the newest is near its merger.
function step(S) {
  S.k++;
  let live = 0;
  for (const e of S.ev) {
    if (!e.on) continue;
    if (!advance(e, S.k, S.sc)) {
      e.on = false;
      continue;
    }
    live++;
  }
  const L = S.last;
  if (L && L.on && live < 3) {
    const remaining = L.merged ? -(S.k - L.kMerge) * STEP : (L.u - 1) * TAUC * S.sc;
    if (remaining <= S.lead) spawn(S, false, 0);
  }
}

function readKnobs(S, input) {
  const k = input.knobValues || [0, 2, 30, 1];
  S.hue = k[0];
  S.sc = cl(k[1], 1, 4) / 2;
  S.c = cl(k[2], 30, 52);
  S.ratio = cl(k[3], 1, 8);
  for (const e of S.ev) if (e.on) massNow(S, e);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  readKnobs(S, input);
  if (!S.ready) {
    S.ready = true;
    S.k = -round(PRE / STEP);
    spawn(S, true, U_OPEN + PRE / (TAUC * S.sc));
    while (S.k < 0) step(S);
    S.acc = 0;
  }
  S.acc += cl(dt || 0, 0, 0.1);
  while (S.acc >= STEP) {
    step(S);
    S.acc -= STEP;
  }
}

function buildLuts(S) {
  S.hueBuilt = S.hue;
  const tmp = [0, 0, 0];
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    // gold: amber in the dim end, pale gold at the top
    hsv(0.118 + 0.03 * v + S.hue, sm(0, 0.08, v) * (1 - 0.6 * sm(0.5, 1, v)), pow(v, 0.55) * (0.15 + 0.85 * sm(0.04, 0.4, v)), tmp, 0);
    S.lutP[i * 3] = tmp[0];
    S.lutP[i * 3 + 1] = tmp[1];
    S.lutP[i * 3 + 2] = tmp[2];
    // blue: a little brighter for the same step, since blue is dark to the eye
    hsv(0.64 - 0.05 * v + S.hue, sm(0, 0.08, v) * (1 - 0.5 * sm(0.55, 1, v)), min(1, pow(v, 0.7) * 1.1) * (0.2 + 0.8 * sm(0.03, 0.3, v)), tmp, 0);
    S.lutN[i * 3] = tmp[0];
    S.lutN[i * 3 + 1] = tmp[1];
    S.lutN[i * 3 + 2] = tmp[2];
  }
}

function field(S, e) {
  const k = S.k, kS = e.kStart, c = S.c;
  const rinv = 1 / (c * STEP), lamk = 2 * PI * c * STEP;
  const { PH, A, M } = e;
  const fade = sm(0, FADE_IN, (k - e.kBirth) * STEP);
  if (fade <= 0) return;
  const b3 = e.b3, gq = e.gq * fade, ex = e.x, ey = e.y;
  const rmax = (k - kS) / rinv, rmax2 = rmax * rmax;
  const Hs = S.Hs, Gs = S.Gs;
  for (let y = 0; y < H; y++) {
    const dy = y - ey;
    for (let x = 0; x < W; x++) {
      const dx = x - ex;
      const r2 = dx * dx + dy * dy + 0.3;
      if (r2 > rmax2) continue;
      const r = sqrt(r2);
      let idx = k - r * rinv;
      if (idx > k - 1) idx = k - 1;
      const k0 = floor(idx), f = idx - k0, s0 = k0 & RMASK, s1 = (k0 + 1) & RMASK;
      const a = A[s0] + f * (A[s1] - A[s0]);
      if (a < 0.004) continue;
      const dP = PH[s1] - PH[s0];
      // Fast waves die out with distance: e-fold length RD at the frequency of contact, and 1/x squared as long at x of it.
      const xf = dP * XF;
      const g = sqrt(R0 / (R0 + r)) * a * gq * exp(-r * xf * xf / RD);
      const P = PH[s0] + f * dP;
      const lam = lamk / (dP + 1e-6);
      const C2 = sm(LAM_LO, LAM_HI, lam);
      const phi = 0.5 * P, c1 = cos(phi), s1n = sin(phi);
      const c2 = c1 * c1 - s1n * s1n, s2 = 2 * c1 * s1n;
      const zx = dx / r, zy = dy / r;
      const z2x = zx * zx - zy * zy, z2y = 2 * zx * zy;
      const mono = M[s0] + f * (M[s1] - M[s0]);
      const mw = mono / MONO;
      let h = (z2x * c2 + z2y * s2) * (1 - 0.8 * mw) + 0.9 * mw * c2;
      if (b3 > 0 && mono < MONO) {
        const w3 = (1 - mono / MONO) * b3 * sm(LAM_LO, LAM_HI, lam / 1.5);
        if (w3 > 0.001) {
          const c3 = c2 * c1 - s2 * s1n, s3 = s2 * c1 + c2 * s1n;
          const z3x = z2x * zx - z2y * zy, z3y = z2x * zy + z2y * zx;
          h += w3 * (z3x * s3 - z3y * c3);
        }
      }
      const p = y * W + x;
      // Long waves get sharper arms, so the dark between them is wider; short waves stay as they are.
      const ah = abs(h);
      Hs[p] += g * C2 * (ah > 1e-6 ? h * pow(ah, 1.6 * sm(10, 34, lam)) : 0);
      Gs[p] += g * (GLOW + 0.5 * (1 - C2));
    }
  }
}

function flash(S, e) {
  const age = (S.k - e.kMerge) * STEP;
  if (age > 1.6) return;
  const R = S.c * age, sg = 2.6, inv = 1 / (2 * sg * sg);
  const amp = 2.2 * exp(-age / 1.2) * sm(0, 0.06, age);
  const Fs = S.Fs;
  const lo = max(0, R - 4 * sg), hi = R + 4 * sg;
  for (let y = 0; y < H; y++) {
    const dy = y - e.y;
    for (let x = 0; x < W; x++) {
      const dx = x - e.x, r = sqrt(dx * dx + dy * dy);
      if (r < lo || r > hi) continue;
      Fs[y * W + x] += amp * sqrt(R0 / (R0 + r)) * exp(-(r - R) * (r - R) * inv);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.hueBuilt !== S.hue) buildLuts(S);
  const { Hs, Gs, Fs, buf } = S;
  Hs.fill(0);
  Gs.fill(0);
  Fs.fill(0);
  for (const e of S.ev) {
    if (!e.on) continue;
    field(S, e);
    if (e.merged) flash(S, e);
  }

  // The strain and the glow become colour.
  const lutP = S.lutP, lutN = S.lutN;
  for (let p = 0; p < N; p++) {
    const h = Hs[p], b = p * 3;
    const v = 1 - exp(-3.4 * abs(h));
    const i = (v * 255 + 0.5) | 0, i3 = i * 3;
    const lut = h >= 0 ? lutP : lutN;
    const gl = Gs[p], fl = Fs[p];
    buf[b] = BG[0] / 255 + lut[i3] + gl * 0.7 + fl * 1.0;
    buf[b + 1] = BG[1] / 255 + lut[i3 + 1] + gl * 0.72 + fl * 0.92;
    buf[b + 2] = BG[2] / 255 + lut[i3 + 2] + gl * 0.85 + fl * 0.75;
  }

  // The holes: soft white points in a halo, with a short tail.
  const dot = (cx, cy, sg, cr, cg, cb) => {
    const R = Math.ceil(2.5 * sg), inv = 1 / (2 * sg * sg);
    for (let y = max(0, round(cy) - R); y <= min(H - 1, round(cy) + R); y++)
      for (let x = max(0, round(cx) - R); x <= min(W - 1, round(cx) + R); x++) {
        const w = exp(-((x - cx) ** 2 + (y - cy) ** 2) * inv), b = (y * W + x) * 3;
        buf[b] += cr * w;
        buf[b + 1] += cg * w;
        buf[b + 2] += cb * w;
      }
  };
  // Under a hole the strain is dimmed, so a white point still reads where the arms are at their brightest.
  const dim = (cx, cy, sg, amt) => {
    const R = Math.ceil(2.5 * sg), inv = 1 / (2 * sg * sg);
    for (let y = max(0, round(cy) - R); y <= min(H - 1, round(cy) + R); y++)
      for (let x = max(0, round(cx) - R); x <= min(W - 1, round(cx) + R); x++) {
        const kd = 1 - amt * exp(-((x - cx) ** 2 + (y - cy) ** 2) * inv), b = (y * W + x) * 3;
        buf[b] *= kd;
        buf[b + 1] *= kd;
        buf[b + 2] *= kd;
      }
  };
  const k = S.k;
  // Holes at the newest step, for the dimming pass and then the dots: [x, y, sigma, brightness].
  const pts = [];
  for (const e of S.ev) {
    if (!e.on) continue;
    const show = sm(0, FADE_IN, (k - e.kBirth) * STEP);
    if (!e.merged) {
      const q = e.q, mh = q / (1 + q), ml = 1 - mh;
      const sh = 0.65 + sqrt(mh), sl = 0.65 + sqrt(ml);
      for (let j = 0; j <= 4; j++) {
        const kk = k - 2 * j;
        if (kk < e.kStart) break;
        const slot = kk & RMASK, sep = e.SP[slot];
        if (sep <= 0) break;
        const phi = 0.5 * e.PH[slot], cx = cos(phi), cy = sin(phi);
        const al = (j === 0 ? 1 : 0.4 * (1 - j / 5)) * show;
        const rh = sep / (1 + q), rl = sep * q / (1 + q);
        pts.push([e.x - rh * cx, e.y - rh * cy, sh, al, j === 0]);
        pts.push([e.x + rl * cx, e.y + rl * cy, sl, al, j === 0]);
      }
    } else {
      const age = (k - e.kMerge) * STEP;
      if (age < 4.5) pts.push([e.x, e.y, 1.7, exp(-age / 1.1) * (1 + 0.25 * cos(2 * OMEGA_C * RING_UP * age)), true]);
    }
  }
  for (const [x, y, sg, al, lead] of pts) if (lead) dim(x, y, 2.6, 0.7 * min(1, al));
  for (const [x, y, sg, al, lead] of pts) {
    dot(x, y, sg, 1.5 * al, 1.45 * al, 1.35 * al);
    if (lead) dot(x, y, 3.6, 0.2 * al, 0.17 * al, 0.1 * al);
  }

  // Tone: keep each LED's colour and let only its brightness give way near full.
  for (let p = 0; p < N; p++) {
    const b = p * 3;
    let r = buf[b], g = buf[b + 1], bl = buf[b + 2];
    const m = max(r, g, bl);
    if (m > 0.8) {
      const kk = (0.8 + 0.2 * (1 - exp(-(m - 0.8) / 0.2))) / m;
      r *= kk;
      g *= kk;
      bl *= kk;
    }
    display.setPixel(p % W, (p / W) | 0, round(255 * r), round(255 * g), round(255 * bl));
  }
}
