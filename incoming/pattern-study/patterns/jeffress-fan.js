// ===== Patternflow pattern =====
// Title:   Jeffress Fan
// Family:  binaural
// Idea:    The panel is the cross-correlogram of the two ears, internal delay across and cochlear channel down, where each of two to four talkers is a bright straight spine at its own interaural delay with curved fringes fanning out of it toward the low channels and crowding together toward the high ones, while the talkers wander in delay, appear and fade in mint, teal, indigo and rose, and a reverberant room breaks their fringes into grain over a slow haze.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lloyd Jeffress's place theory of sound localisation, coincidence detectors lying along delay lines so that the place of most coincidences gives the difference in the time a sound reaches the two ears (Jeffress, 1948, from memory); the delay lines found in the nucleus laminaris of the barn owl (Catherine Carr and Masakazu Konishi, 1988, from memory) and the argument over whether mammals use them in the medial superior olive (Benedikt Grothe, David McAlpine and others, 2000s, from memory); the running cross-correlogram of the cochlear channels with its ridge that stays straight across frequency (Richard Stern, Constantine Trahiotis and colleagues, 1980s and 1990s, from memory); the equivalent rectangular bandwidth of an auditory filter (Brian Glasberg and Brian Moore, 1990, from memory); original code, pattern round 261
// Round:   261
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Walk=0.25..4, Sources=-1.5..1.5, Room=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together, once for the knob's travel. At 0 and 1 the first talker is mint green, the second rose, the third teal and the fourth indigo, each one's negative correlation is a dim tint of another hue (indigo under the green, teal under the rose), and the haze is indigo above and sea green below.
// Knob 2: Walk. How fast the talkers wander in delay and how fast their pitch glides. A talker's delay speed is 0.055 ms a second rms (1.8 LEDs a second) times 0.15 + 0.425 of the knob: 0.45 LED a second at 0.25, 1.8 at the opening 2, 3.3 at 4. At 0.25 the fans nearly stand and only the pitch, the room and the haze move.
// Knob 3: Sources. How many talkers are in the room, 2.5 plus the knob: 1 at -1.5, 2.5 at the opening 0 and 4 at 1.5. A fraction fades the next talker in over about a third of a second, so at the opening two talkers are in full and a third stands at half strength. Each talker also comes and goes on its own, a minute or so in and 6 to 26 s out; only the first stays.
// Knob 4: Room. How reverberant the room is. The coherence of the two ears at 2 kHz is exp(-R) with R 0.12 at -1, 0.37 at the opening 0.06 and 1.0 at 1, so at the lowest row (4.2 kHz) the spine keeps 0.78 of its strength at -1, 0.46 at the opening and 0.12 at 1. As R grows the fringes break into pieces, the envelope that carries them out from the spine shortens by up to 45 percent, and a teal grain of the room's own fringes fills the low channels.

// What the picture is. The cross-correlogram C(f, tau) of the two ears' signals in each cochlear channel f, as a function of the internal delay tau that a delay line in
// Jeffress's model adds to one ear. The panel is that map: the 64 columns are tau from -1 ms at the left edge to +1 ms at the right (31 microseconds a LED, a human head spans about
// +-0.7 ms), and the 128 rows are 128 channels from 180 Hz at the top row to 4.2 kHz at the bottom on a log scale, 28 rows an octave.
// A talker that reaches the right ear tau0 before the left puts a ridge at tau = tau0 in every channel, the place where its two signals coincide. Each channel is narrow, so what it
// hears is a tone of its own centre frequency under a slow envelope, and the correlation is a cosine in the delay, cos(2 pi f (tau - tau0)), under an envelope of width about 1 / ERB(f)
// (ERB = 24.7 (4.37 f / 1000 + 1) Hz, 44 Hz at the top row and 478 Hz at the bottom). In row y that cosine has a period 1 / f: 178 LEDs at the top row, where the panel holds one
// wide lobe, 32 LEDs at 1 kHz (row 70), and 7.6 LEDs at the bottom, where there are eight fringes across the panel. All the rows share the peak at tau0, so the peak is a straight
// vertical spine, the straightness that tells a real talker from an accident of one channel; the fringes at tau0 +- k / f are not straight. They lean out as hyperbola-like arches
// that fan wide at the low channels and bunch against the spine at the high ones, because the row's fringe spacing goes as 1 / f and f rises exponentially down the panel. The
// first side fringe walks in from the panel's edge at 1 kHz and eight or nine of them stand across the panel at the bottom. Nothing is integrated or advected: each pixel is
// evaluated in closed form, so a pixel is its own cosine, and a talker moving in delay slides its whole fan sideways, spine and fringes together.
// What is drawn for one talker in one row, with c = cos(2 pi f (tau - tau0)):
//   lobe     exp(-kappa (1 - c)), a bright fringe with a rounded top; kappa grows toward the top rows, 1 / (2 pi f sigma)^2 with sigma 0.075 ms (f / 180 Hz)^-0.3, so the spine
//            stays about 5 LEDs across instead of widening to the panel, and is never less than 1.5, so the fringes at the bottom are 2 to 3 LEDs across
//   halo     the plain cos^2 lobe at 0.2 strength, fading out between 300 Hz and 1.3 kHz, a soft glow round the spine in the upper rows
//   trough   ((1 - c) / 2)^6, the negative correlation, in the talker's second tint at 0.6, a dim thin curve between the fringes
//   envelope a Gaussian of tau - tau0 whose sigma is 0.42 / ERB(f in kHz) ms (0.88 ms at the bottom), times a reach that drifts 0.75 to 1.25 over a minute, times 1 - 0.45 R
//   coherence  exp(-R f / 2 kHz), the room's loss of coherence between the ears, which grows with frequency
//   spectrum two bright bands of the talker's voice (Gaussians in rows, sigma 16 to 28 and 18 to 32 rows, wandering 1.3 rows a second), and its harmonics, the
//            strength falling by 0.4 to 0.75 at the channels between two harmonics, comb = (1 + cos(2 pi f / f0)) / 2, wherever ERB < 0.55 f0 (f0 105 to 225 Hz at the start and
//            gliding a few tenths of an octave in a minute), so that the spine breaks into a string of beads 5 to 29 rows apart which slide along it as the pitch glides; above
//            about 1 kHz the harmonics are not resolved and the spine runs unbroken
// cos and the Gaussian envelope are stepped along the row by a rotation and two multiplications, so a talker costs one exp a pixel.
// The room. The two ears' signals share only part of their power, the coherence gamma(f), and the rest is diffuse noise whose correlogram is random, with the same fringes in it
// but a phase that changes from patch to patch. sqrt(1 - gamma^2) of that is drawn in three ways. A smooth complex random field Z(tau, f, t), nodes 15 columns by 6 rows turning over
// every 2.9 s, gives a mask that takes up to 0.7 of the talkers' fringes away where Im Z is high, so at a high R they break into pieces; it gives a grain, Re(Z e^(i 2 pi f tau)) sharpened
// like a fringe, in a teal tint, that grows with R and fills the lower channels with short braided fringes; and the haze below is its own pair of fields.
// The haze is two strata of smooth noise, 26 columns by 5 rows and 17 columns by 8 rows, turning over every 6 s, tinted indigo at the top and sea green at the bottom, brighter at
// the top. It is not in the cross-correlation. It is the floor the correlogram sits on in a real recording, the energy that none of the channels' coincidence detectors can place,
// and it keeps the four corners from going dark.
// The talkers. Four slots. Slot 0 stays; the others come and go, fading in and out over 7 to 12 s, staying 30 to 90 s and away 6 to 26 s, and each time one comes back it takes a
// delay far from the others, a new pitch, new bands, and a colour that no one is wearing. A talker's delay is a velocity of Ornstein-Uhlenbeck noise (0.055 ms a second, memory 7 s)
// held near +-0.7 ms by a soft wall and pushed away from a neighbour closer than 0.2 ms; a tremor of 0.4 LED, a loudness that wanders 0.55 to 1 with a 16 s memory, and a tint
// that slides up to 0.65 of a step along the colour path mint, teal, indigo, rose with a 14 s memory ride on it. The listener turns the head by up to 0.17 ms over 30 s, which moves every
// spine together, and the room's R wanders by 0.1 over 22 s. All of these have different rates, so the picture does not come back: a minute later the fans stand at other delays,
// in other colours, with other beads, over another haze.
// Colour. A talker's fringe is its base tint times the lobe, plus its core tint times the lobe to the fourth, a white-green or white-rose heat at the top of the fringe; the sum
// of all the talkers, the grain and the haze goes through 1 - exp(-1.4 x) a channel at a time, so two fans that cross add up to a pale mixture instead of clipping to flat colour.

const W = 64, H = 128;
const { sin, cos, exp, sqrt, abs, floor, min, max, log, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// ---- the panel's axes
const TPX = 2 / W; // ms of internal delay a column holds: the panel is -1 ms (left) to +1 ms (right)
const F0 = 180, F1 = 4200; // centre frequencies of the first and last channel row, Hz, on a log scale
const NS = 4; // talkers (slots)
const ZI = 6, ZJ = 23, HNI = 4, HNJ = 15, HMI = 6, HMJ = 20; // nodes of the room's field and of the two haze strata, columns by rows
const MASK = 0.7, HZ = 0.7, FLOOR = 0.34; // how much of a fringe the room can take away, and how bright its haze is

const FROW = new Float64Array(H), ERBROW = new Float64Array(H), KAPROW = new Float64Array(H);
for (let y = 0; y < H; y++) {
  const f = F0 * pow(F1 / F0, (y + 0.5) / H);
  FROW[y] = f;
  ERBROW[y] = 24.7 * (4.37 * f / 1000 + 1); // Glasberg and Moore's equivalent rectangular bandwidth, Hz
  const sg = 0.075 * pow(f / 180, -0.3); // ms: how wide the main lobe is allowed to stay in the low rows
  KAPROW[y] = max(1.5, 1 / (TAU * f / 1000 * sg) ** 2);
}

// ---- colours: [base, core] of a bright fringe, and the tint of its negative correlation
// the talkers' colours lie along one path, mint, teal, indigo, rose, and each talker's own tint wanders a little along it
const SRC = [
  { b: [0.12, 0.8, 0.5], c: [0.55, 0.45, 0.6], n: [0.2, 0.14, 0.7] }, // mint green, its negative a dim indigo
  { b: [0.04, 0.72, 0.85], c: [0.5, 0.45, 0.3], n: [0.3, 0.12, 0.62] }, // teal
  { b: [0.22, 0.28, 1.0], c: [0.45, 0.55, 0.0], n: [0.08, 0.5, 0.36] }, // indigo, its negative a sea green
  { b: [1.0, 0.2, 0.42], c: [0.0, 0.62, 0.55], n: [0.04, 0.46, 0.52] }, // rose, its negative a dim teal
];
const GAIN = [1.0, 0.92, 0.85, 0.78];
const START_CI = [0, 3, 1, 2];
const DIFF = [0.2, 0.62, 0.62], HAZE = [0.14, 0.22, 0.62], HAZE2 = [0.04, 0.55, 0.5]; // the diffuse field's tints: teal for its fringes, indigo for the haze

function randn() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

function newSlot(k, first) {
  const o = {
    p: 0, v: 0, j: 0, lv: 1, lz: Math.random() * 2 - 1, a: 0, on: true, tmr: 0, fade: 9, ci: START_CI[k], uo: 0, uv: 0,
    lf0: 0, vf: 0, c1: 0, c2: 0, v1: 0, v2: 0, w1: 22, w2: 26, dep: 0.7,
  };
  respawn(o, null, k, first);
  return o;
}

// a talker appears at a delay away from the others, with its own pitch and its own bright bands
function respawn(o, slots, k, first) {
  let best = 0, bd = -1;
  for (let t = 0; t < 10; t++) {
    const p = (Math.random() * 2 - 1) * 0.72;
    let d = 9;
    if (slots) for (let j = 0; j < NS; j++) if (j !== k && slots[j].a > 0.02) d = min(d, abs(slots[j].p - p));
    if (d > bd) { bd = d; best = p; }
  }
  o.p = best; o.v = 0;
  if (slots) {
    // a colour no one in the room is wearing, if there is one
    const used = [false, false, false, false];
    for (let j = 0; j < NS; j++) if (j !== k && slots[j].a > 0.02) used[slots[j].ci] = true;
    const free = [];
    for (let c = 0; c < NS; c++) if (!used[c] && !(k === 0 && c !== 0)) free.push(c);
    if (free.length) o.ci = free[floor(Math.random() * free.length)];
  }
  o.lf0 = Math.log2(105 + Math.random() * 120); o.vf = 0;
  o.c1 = 20 + Math.random() * 26; o.c2 = 68 + Math.random() * 38;
  o.w1 = 16 + Math.random() * 12; o.w2 = 18 + Math.random() * 14;
  o.dep = 0.4 + Math.random() * 0.35;
  o.fade = 7 + Math.random() * 5;
  o.on = true;
  o.tmr = first ? 6 + Math.random() * 70 : 30 + Math.random() * 60;
  o.a = first ? 1 : 0;
}

function setup(params) {
  const S = {
    ready: false, t: 0, nt: 0, seed: floor(Math.random() * 65536), rz: Math.random() * 2 - 1, oz: Math.random() * 2 - 1, hz: Math.random() * 2 - 1, hy: 0,
    slots: [], w: [0, 0, 0, 0], Rs: 0.5, hueAt: -1,
    sc: new Float32Array(NS * 9), col: new Float32Array(NS * 9 + 9), // b, c, n of each talker and the diffuse tint, hue-turned
    rr: new Float32Array(W), gg: new Float32Array(W), bb: new Float32Array(W),
    zr: new Float32Array(ZI * ZJ), zi: new Float32Array(ZI * ZJ), hn: new Float32Array(HNI * HNJ), hm: new Float32Array(HMI * HMJ), rzr: new Float32Array(W), rzi: new Float32Array(W), mk: new Float32Array(W),
    xi: new Int32Array(W), xf: new Float32Array(W),
    tone: new Float32Array(2048),
  };
  for (let k = 0; k < NS; k++) S.slots.push(newSlot(k, true));
  S.slots[0].a = 1; S.slots[0].on = true; S.slots[0].tmr = 1e9;
  S.slots[1].a = 1;
  S.slots[2].a = Math.random() < 0.7 ? 1 : 0; S.slots[3].a = Math.random() < 0.4 ? 1 : 0;
  for (let k = 2; k < NS; k++) if (S.slots[k].a === 0) { S.slots[k].on = false; S.slots[k].tmr = 3 + Math.random() * 15; }
  for (let x = 0; x < W; x++) {
    const u = x / 15, i = floor(u);
    S.xi[x] = i; S.xf[x] = sm(u - i);
  }
  for (let i = 0; i < 2048; i++) S.tone[i] = 1 - exp(-i / 512 * 1.4);
  params.s = S;
}

// a hash of a noise node to [-1, 1]
function node(i, j, k, c) {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(j + 7, 668265263) ^ Math.imul(k + 13, 1274126177) ^ Math.imul(c + 3, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

function hueTurn(S, hue) {
  if (S.hueAt === hue) return;
  S.hueAt = hue;
  const A = -TAU * hue, c = cos(A), s = sin(A);
  const m0 = 0.213 + c * 0.787 - s * 0.213, m1 = 0.715 - c * 0.715 - s * 0.715, m2 = 0.072 - c * 0.072 + s * 0.928;
  const m3 = 0.213 - c * 0.213 + s * 0.143, m4 = 0.715 + c * 0.285 + s * 0.14, m5 = 0.072 - c * 0.072 - s * 0.283;
  const m6 = 0.213 - c * 0.213 - s * 0.787, m7 = 0.715 - c * 0.715 + s * 0.715, m8 = 0.072 + c * 0.928 + s * 0.072;
  const put = (o, v) => {
    S.col[o] = max(0, v[0] * m0 + v[1] * m1 + v[2] * m2);
    S.col[o + 1] = max(0, v[0] * m3 + v[1] * m4 + v[2] * m5);
    S.col[o + 2] = max(0, v[0] * m6 + v[1] * m7 + v[2] * m8);
  };
  for (let k = 0; k < NS; k++) { put(k * 9, SRC[k].b); put(k * 9 + 3, SRC[k].c); put(k * 9 + 6, SRC[k].n); }
  put(NS * 9, DIFF); put(NS * 9 + 3, HAZE); put(NS * 9 + 6, HAZE2);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const walk = kn[1] / 2, count = cl(2.5 + kn[2], 1, 4), R = 0.12 + 0.88 * cl((kn[3] + 1) / 2, 0, 1) ** 2;
  hueTurn(S, kn[0]);
  S.t += d;
  S.nt += d;
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < NS; k++) S.w[k] = cl(count - k, 0, 1);
    S.Rs = R;
  }
  // the room itself and the listener's reach wander slowly: how far the fringes carry, and how much of the room there is
  const ez = exp(-d / 22);
  S.rz = S.rz * ez + 0.75 * sqrt(1 - ez * ez) * randn();
  S.oz = S.oz * ez + 0.75 * sqrt(1 - ez * ez) * randn();
  S.reach = 1 + 0.25 * Math.tanh(S.rz);
  const eh = exp(-d / 30);
  S.hz = S.hz * eh + 0.8 * sqrt(1 - eh * eh) * randn();
  S.hy = 0.17 * Math.tanh(S.hz); // the listener turns the head a little: every spine moves together
  S.Rs += (cl(R + 0.1 * Math.tanh(S.oz), 0.05, 1) - S.Rs) * (1 - exp(-d / 0.3));
  const sl = S.slots;
  const ex = exp(-d / 7), exf = exp(-d / 9), exc = exp(-d / 12), exj = exp(-d / 0.7), exj2 = exp(-d / 16), exj3 = exp(-d / 14);
  for (let k = 0; k < NS; k++) {
    const o = sl[k];
    S.w[k] += (cl(count - k, 0, 1) - S.w[k]) * (1 - exp(-d / 0.35));
    // the talker walks: an Ornstein-Uhlenbeck velocity in delay, held inside the head's range
    o.v = o.v * ex + 0.055 * sqrt(1 - ex * ex) * randn();
    let rep = 0;
    for (let j = 0; j < NS; j++) if (j !== k && sl[j].a > 0.05) {
      const dd = o.p - sl[j].p, ad = abs(dd);
      if (ad < 0.2) rep += (dd < 0 ? -1 : 1) * (0.2 - ad);
    }
    o.v += 0.5 * rep * d - 1.4 * max(0, abs(o.p) - 0.7) * (o.p < 0 ? -1 : 1) * d;
    o.p = cl(o.p + o.v * (0.15 + 0.85 * walk) * d, -0.9, 0.9);
    o.j = o.j * exj + 0.012 * sqrt(1 - exj * exj) * randn(); // a slight tremor of the delay, 0.4 LED
    // its tint slides along the colour path and back
    o.uv = o.uv * exj3 + 0.11 * sqrt(1 - exj3 * exj3) * randn();
    o.uo = cl(o.uo + o.uv * d - 0.02 * o.uo * d, -0.65, 0.65);
    // how loud it is wanders over tens of seconds
    o.lz = o.lz * exj2 + 0.9 * sqrt(1 - exj2 * exj2) * randn();
    o.lv = 0.55 + 0.45 * sm(0.5 + 0.55 * Math.tanh(o.lz));
    // the pitch and the two bright bands wander more slowly
    o.vf = o.vf * exf + 0.009 * sqrt(1 - exf * exf) * randn();
    o.lf0 += o.vf * (0.2 + 0.8 * walk) * d;
    o.vf -= 0.0025 * (o.lf0 - 7.25) * d; // pulled gently toward 150 Hz
    o.v1 = o.v1 * exc + 1.3 * sqrt(1 - exc * exc) * randn();
    o.v2 = o.v2 * exc + 1.3 * sqrt(1 - exc * exc) * randn();
    o.c1 = cl(o.c1 + o.v1 * d, 18, 48); o.c2 = cl(o.c2 + o.v2 * d, 66, 108);
    // appear, stay a while, fade, stay away, appear again somewhere else
    if (k > 0) {
      o.tmr -= d;
      if (o.on) {
        o.a = min(1, o.a + d / o.fade);
        if (o.tmr <= 0) { o.on = false; o.tmr = 6 + Math.random() * 20; }
      } else {
        o.a = max(0, o.a - d / o.fade);
        if (o.a <= 0 && o.tmr <= 0) respawn(o, sl, k, false);
      }
    }
  }
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s, sl = S.slots, col = S.col, Rs = S.Rs;
  if (S.hueAt < 0) hueTurn(S, 0);
  const rr = S.rr, gg = S.gg, bb = S.bb, tone = S.tone, sc = S.sc;
  for (let k = 0; k < NS; k++) {
    const o = sl[k], u = cl(o.ci + o.uo, 0, NS - 1), i0 = min(NS - 2, floor(u)), fu = u - i0;
    for (let q = 0; q < 9; q++) sc[k * 9 + q] = col[i0 * 9 + q] * (1 - fu) + col[(i0 + 1) * 9 + q] * fu;
  }
  const tz = S.nt * 0.35, kz = floor(tz) + S.seed, fz = sm(tz - floor(tz));
  // the diffuse field: a smooth complex random field Z(delay, channel, time), nodes 15 columns by 6 rows
  for (let j = 0; j < ZJ; j++)
    for (let i = 0; i < ZI; i++) {
      const a0 = node(i, j, kz, 0), a1 = node(i, j, kz + 1, 0), b0 = node(i, j, kz, 1), b1 = node(i, j, kz + 1, 1);
      S.zr[j * ZI + i] = a0 + (a1 - a0) * fz;
      S.zi[j * ZI + i] = b0 + (b1 - b0) * fz;
    }
  // the haze: strata, 26 columns wide and 5 rows tall, which turn over every 6 s
  const th = S.nt * 0.17, kh = floor(th) + S.seed, fh = sm(th - floor(th));
  for (let j = 0; j < HNJ; j++)
    for (let i = 0; i < HNI; i++) {
      const a0 = node(i, j, kh, 2), a1 = node(i, j, kh + 1, 2);
      S.hn[j * HNI + i] = a0 + (a1 - a0) * fh;
    }
  for (let j = 0; j < HMJ; j++)
    for (let i = 0; i < HMI; i++) {
      const a0 = node(i, j, kh, 3), a1 = node(i, j, kh + 1, 3);
      S.hm[j * HMI + i] = a0 + (a1 - a0) * fh;
    }
  for (let y = 0; y < H; y++) {
    const f = FROW[y], fk = f / 1000, kap = KAPROW[y];
    const gam = exp(-1.0 * Rs * (f / 2000)), hzR = sm((Rs - 0.12) / 0.88);
    const halo = 0.2 * sm((1300 - f) / 1000);
    const envS = (0.42 * S.reach * (1 - 0.45 * Rs)) / (ERBROW[y] / 1000); // ms
    rr.fill(0); gg.fill(0); bb.fill(0);
    // the room's field along this row: a smooth complex noise, and from it the places where the two ears have lost each other
    const wd = sqrt(max(0, 1 - gam * gam));
    const yj = y / 6, j0 = floor(yj), fy = sm(yj - j0), jb = j0 * ZI, jc = (j0 + 1) * ZI, zrN = S.zr, ziN = S.zi, ZR = S.rzr, ZIm = S.rzi, MK = S.mk;
    for (let x = 0; x < W; x++) {
      const i0 = S.xi[x], fx = S.xf[x];
      const ar = zrN[jb + i0] + (zrN[jc + i0] - zrN[jb + i0]) * fy, br = zrN[jb + i0 + 1] + (zrN[jc + i0 + 1] - zrN[jb + i0 + 1]) * fy;
      const ai = ziN[jb + i0] + (ziN[jc + i0] - ziN[jb + i0]) * fy, bi = ziN[jb + i0 + 1] + (ziN[jc + i0 + 1] - ziN[jb + i0 + 1]) * fy;
      ZR[x] = ar + (br - ar) * fx; ZIm[x] = ai + (bi - ai) * fx;
      MK[x] = 1 - wd * MASK * sm(0.5 + 0.75 * ZIm[x]);
    }
    const dph = TAU * fk * TPX, cd = cos(dph), sd = sin(dph); // phase step a column makes, radians
    const t0 = -(W - 1) / 2 * TPX; // delay of column 0, ms
    for (let k = 0; k < NS; k++) {
      const o = sl[k], wt = o.a * S.w[k];
      if (wt < 0.004) continue;
      // spectrum of the talker at this channel: two bright bands and the resolved harmonics of its pitch
      const g1 = (y - o.c1) / o.w1, g2 = (y - o.c2) / o.w2;
      let band = exp(-0.5 * g1 * g1) + 0.85 * exp(-0.5 * g2 * g2);
      band = 0.32 + 0.68 * (band > 1 ? 1 : band);
      const f0 = pow(2, o.lf0), res = 1 - sm((ERBROW[y] / f0 - 0.55) / 0.8);
      const comb = 0.5 + 0.5 * cos(TAU * f / f0);
      const spec = band * (1 - o.dep * res * (1 - comb));
      const A = GAIN[k] * wt * o.lv * gam * spec;
      const a0 = t0 - o.p - o.j - S.hy; // delay from the spine at column 0, ms
      const ph0 = TAU * fk * a0;
      let c = cos(ph0), s = sin(ph0);
      let e = exp(-0.5 * (a0 / envS) ** 2);
      let r = exp(-(2 * a0 * TPX + TPX * TPX) / (2 * envS * envS));
      const q = exp(-(TPX * TPX) / (envS * envS));
      const br = sc[k * 9], bg = sc[k * 9 + 1], bbl = sc[k * 9 + 2];
      const cr = sc[k * 9 + 3], cg = sc[k * 9 + 4], cbb = sc[k * 9 + 5];
      const nr = sc[k * 9 + 6], ng = sc[k * 9 + 7], nb = sc[k * 9 + 8];
      for (let x = 0; x < W; x++) {
        const amp = A * e * MK[x];
        if (amp > 0.002) {
          const u = kap * (1 - c);
          const v = u < 7 ? exp(-u) : 0;
          const hh = (1 + c) * 0.5, nn = (1 - c) * 0.5, n2 = nn * nn, n6 = n2 * n2 * n2 * 0.6;
          const v4 = v * v * v * v, hl = hh * hh * halo;
          rr[x] += amp * (br * (v + hl) + cr * v4 + nr * n6);
          gg[x] += amp * (bg * (v + hl) + cg * v4 + ng * n6);
          bb[x] += amp * (bbl * (v + hl) + cbb * v4 + nb * n6);
        }
        const cn = c * cd - s * sd;
        s = s * cd + c * sd; c = cn;
        e *= r; r *= q;
      }
    }
    // the diffuse part: what the room leaves of the two ears' signals is the same fringes with a random phase from patch to patch,
    // and under it a deep haze of the field's own bright patches, strongest in the low channels where the spines are bare
    {
      const dr = col[NS * 9], dg = col[NS * 9 + 1], db = col[NS * 9 + 2];
      const hr = col[NS * 9 + 3], hg = col[NS * 9 + 4], hb = col[NS * 9 + 5];
      let c = cos(TAU * fk * t0), s = sin(TAU * fk * t0);
      const gw = wd * HZ * hzR, fl = FLOOR * (1.5 - 0.75 * y / (H - 1));
      const ty = y / (H - 1), hq = col[NS * 9 + 6], hw = col[NS * 9 + 7], hv = col[NS * 9 + 8];
      const hr2 = hr + (hq - hr) * ty, hg2 = hg + (hw - hg) * ty, hb2 = hb + (hv - hb) * ty;
      const hyj = y / 10, hj0 = floor(hyj), hfy = sm(hyj - hj0), hn = S.hn, myj = y / 7, mj0 = floor(myj), mfy = sm(myj - mj0), hm = S.hm;
      for (let x = 0; x < W; x++) {
        const zr = ZR[x], zi = ZIm[x];
        if (gw > 0.01) {
          const mag = sqrt(zr * zr + zi * zi) * 1.5, cs = (zr * c - zi * s) / (mag + 0.0001) * 1.5;
          const v = (mag > 1 ? 1 : mag) * exp(-2.4 * (1 - cs));
          const aa = gw * v;
          rr[x] += dr * aa; gg[x] += dg * aa; bb[x] += db * aa;
        }
        {
          const hu = x / 24, hi = floor(hu), hfx = sm(hu - hi), b0 = hj0 * HNI + hi, b1 = b0 + HNI;
          const n0 = hn[b0] + (hn[b1] - hn[b0]) * hfy, n1 = hn[b0 + 1] + (hn[b1 + 1] - hn[b0 + 1]) * hfy;
          const mu = x / 14, mi = floor(mu), mfx = sm(mu - mi), m0 = mj0 * HMI + mi, m1 = m0 + HMI;
          const o0 = hm[m0] + (hm[m1] - hm[m0]) * mfy, o1 = hm[m0 + 1] + (hm[m1 + 1] - hm[m0 + 1]) * mfy;
          const h = sm(0.5 + 0.95 * 0.62 * (n0 + (n1 - n0) * hfx + o0 + (o1 - o0) * mfx));
          const aa = fl * h * h * h;
          rr[x] += hr2 * aa; gg[x] += hg2 * aa; bb[x] += hb2 * aa;
        }
        const cn = c * cd - s * sd;
        s = s * cd + c * sd; c = cn;
      }
    }
    for (let x = 0; x < W; x++) {
      const ir = rr[x] * 512, ig = gg[x] * 512, ib = bb[x] * 512;
      const R8 = tone[ir > 2047 ? 2047 : ir | 0], G8 = tone[ig > 2047 ? 2047 : ig | 0], B8 = tone[ib > 2047 ? 2047 : ib | 0];
      display.setPixel(x, y, (R8 * 255 + 0.5) | 0, (G8 * 255 + 0.5) | 0, (B8 * 255 + 0.5) | 0);
    }
  }
}
