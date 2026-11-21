// ===== Patternflow pattern =====
// Title:   Basilar Wave
// Family:  cochlea
// Idea:    The panel is the basilar membrane of a cochlea unrolled, the stiff base at the top row and the soft apex at the bottom row, and up to four tones that glide past one another on no common period each send a travelling wave down it: bands of crest, deep teal through cyan to bone white, flow down the dark teal membrane, crowd and brighten as they near the place the tone belongs to by Greenwood's map, and die within a few LEDs past it, where a ladder of coral hair-cell light (one broad inner band and three outer ones) says where the sound is heard, and two tones that come close beat, swelling and fading the crests between them.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Georg von Bekesy's travelling wave on the basilar membrane (first papers from 1928, Nobel Prize in Physiology or Medicine 1961), Donald Greenwood's position-to-frequency function f = A (10^(a x) - k) (1961, revised 1990) with the human constants A = 165.4, a = 2.1, k = 0.88; pattern round 211
// Round:   211
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pitch=0..4, Level=-1..1, Tones=-1..0.2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the membrane is dark teal, the crests run from deep teal through cyan to bone white and the hair-cell light is coral pink; at 0.5 the same picture is on the opposite side of the wheel, and at 1 it is back where it began.
// Knob 2: Pitch. Where the middle of the chord sits on Greenwood's map (A = 165.4, a = 2.1, k = 0.88; row 0 is 20.7 kHz and row 127 is 19.8 Hz). Each unit of the knob moves it 0.9 octave: at 0 the middle is 287 Hz (row 102), at the opening 2 it is 1000 Hz (row 76, with 16 LEDs to the octave around it), at 4 it is 3.5 kHz (row 46). The tones wander up to 1.9 octave either side of the middle and are held between 62 Hz (row 121) and 12 kHz (row 14), so every peak stays on the panel.
// Knob 3: Level. How loud the sound is. The pressure runs through 30 dB over the knob and the membrane compresses it to 0.3 of its dB, as the outer hair cells do, so a tone still shows 0.36 of the full amplitude at -1, 0.60 at the opening 0 and 1.0 at 1, where the crests saturate to white. The wave swells over 24 LEDs before its peak at -1, 33 at 0 and 42 at 1, and dies over 2.7, 3.8 and 4.8 LEDs past it.
// Knob 4: Tones. How many tones sound: 1 at -1 and 4 at 0.2, a straight line between. The opening 0.06 is 3.65 tones, three in full and the fourth 72 percent of the way in; a fraction fades the next tone in. The third tone, once it is in, flickers on for 0.8 to 3.2 s and off for 0.5 to 2.4 s whatever the knob says.

const W = 64, H = 128;
const { floor, exp, abs, sin, cos, tanh, log10, pow, PI, min, max } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// ---- Greenwood's map, x from the apex (0) to the base (1): f = A (10^(a x) - k)
const GA = 165.4, GAL = 2.1, GK = 0.88;
const FREF = 1000; // Hz that Pitch 2 centres on
const yOfOct = (p) => (H - 1) * (1 - log10((FREF * pow(2, p)) / GA + GK) / GAL); // row of a tone p octaves above 1 kHz
const PMIN = -4.0, PMAX = 3.6; // peaks stay between rows 122 and 12
const PITCH_OCT = 0.9; // octaves a unit of the Pitch knob moves the middle (Pitch 2, the opening, is 1000 Hz)
const OFFMAX = 1.9; // how far a tone wanders from the middle, octaves
const TSPREAD = 1.15; // spread of the places a tone picks to glide to, octaves

// ---- the wave on the membrane, sampled every half LED
const NT = 4;
const NS = 2 * H;
const LAMPK = 8; // LEDs from crest to crest at the peak
const LAMF = 24; // LEDs from crest to crest far from the peak
const LSLOPE = 0.45; // how fast the wavelength grows with the distance above the peak
const LR0 = 28; // LEDs over which the envelope grows to the peak, at Level 0
const LD0 = 3.2; // LEDs over which it dies past the peak, at Level 0
const NU0 = 0.62; // Hz the crests pass a point at the middle of the chord, a slowed-down stand-in for the real hundreds of Hz. A tone above the middle runs up to 2.4 times faster and one below it down to 0.4 times, so two close tones beat slowly
const COMP = 0.3; // the membrane's compression: dB in to dB out
const LIFT = 0.15; // how much of the envelope is added to the displacement, so a crest lobe is wider than a trough
const BOW = 2.4; // how far the middle of a crest lags its ends, LEDs, on average
const TILT = 2.2; // how far one end of a crest runs ahead of the other, LEDs at the most

// ---- colour
const COL = [
  [0.0, 0.235, 0.05, 205],
  [0.28, 0.42, 0.085, 205],
  [0.58, 0.72, 0.115, 200],
  [0.8, 0.88, 0.065, 190],
  [0.93, 0.965, 0.02, 100],
  [1.0, 0.985, 0.012, 100],
];
const NL = 128;
const CORAL = [0.77, 0.135, 22];

function lab2rgb(L, a, b, out) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  let r = 4.0767416621 * l_ ** 3 - 3.3077115913 * m_ ** 3 + 0.2309699292 * s_ ** 3;
  let g = -1.2684380046 * l_ ** 3 + 2.6097574011 * m_ ** 3 - 0.3413193965 * s_ ** 3;
  let bl = -0.0041960863 * l_ ** 3 - 0.7034186147 * m_ ** 3 + 1.707614701 * s_ ** 3;
  r = max(r, 0);
  g = max(g, 0);
  bl = max(bl, 0);
  const top = max(r, g, bl);
  if (top > 1) {
    r /= top;
    g /= top;
    bl /= top;
  }
  const enc = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1 / 2.4) - 0.055);
  out[0] = enc(r);
  out[1] = enc(g);
  out[2] = enc(bl);
}

function lch(L, C, hDeg, turn, out) {
  const h = (hDeg / 360 + turn) * TAU;
  lab2rgb(L, C * cos(h), C * sin(h), out);
}

function buildColours(S) {
  const t = S.hue;
  const tmp = [0, 0, 0];
  for (let n = 0; n <= NL; n++) {
    const u = n / NL;
    let k = 0;
    while (k < COL.length - 2 && u > COL[k + 1][0]) k++;
    const A = COL[k], B = COL[k + 1], f = (u - A[0]) / (B[0] - A[0]);
    const ha = (A[3] / 360 + t) * TAU, hb = (B[3] / 360 + t) * TAU;
    const L = A[1] + (B[1] - A[1]) * f;
    const a = A[2] * cos(ha) + (B[2] * cos(hb) - A[2] * cos(ha)) * f;
    const b = A[2] * sin(ha) + (B[2] * sin(hb) - A[2] * sin(ha)) * f;
    lab2rgb(L, a, b, tmp);
    S.lut[n * 3] = tmp[0];
    S.lut[n * 3 + 1] = tmp[1];
    S.lut[n * 3 + 2] = tmp[2];
  }
  lch(CORAL[0], CORAL[1], CORAL[2], t, tmp);
  S.coral[0] = tmp[0];
  S.coral[1] = tmp[1];
  S.coral[2] = tmp[2];
  S.builtHue = t;
}

// per tone: its own incommensurate wobbles of loudness
const WOB = [
  [0.071, 0.0, 0.037, 1.7],
  [0.059, 2.1, 0.023, 0.4],
  [0.083, 4.0, 0.041, 2.9],
  [0.047, 5.2, 0.029, 3.7],
];
const START = [-1.1, 0.2, 1.5, -1.9]; // where the tones stand at the opening, octaves from the middle
const FIRST = [3.0, 1.5, 4.5, 0.8]; // when each one first sets off

function newTone(i) {
  return { o: START[i], o0: START[i], o1: START[i], s0: FIRST[i], dur: 8, th: i * 1.9, gate: 1, gOn: true, gNext: 1.5 + 0.7 * i, yc: 60, A: 0 };
}

export function setup(params) {
  params.s = {
    t: 0,
    hue: 0,
    pitch: -1,
    lev: -1,
    n: -1,
    builtHue: -1,
    tone: [0, 1, 2, 3].map(newTone),
    wf: new Float32Array(NS + 2),
    ef: new Float32Array(NS + 2),
    gf: new Float32Array(NS + 2),
    hf: new Float32Array(NS + 2),
    mf: new Float32Array(NS + 2),
    lut: new Float32Array((NL + 1) * 3),
    coral: [0, 0, 0],
    shift: new Float32Array(W),
    taper: new Float32Array(W),
    u: new Float32Array(W),
    sx1: new Float32Array(W),
    sx2: new Float32Array(W),
    p1: 0,
    p2: 0,
  };
  const S = params.s;
  for (let x = 0; x < W; x++) {
    const u = (x - 31.5) / 32;
    S.u[x] = u;
    S.sx1[x] = (TAU * x) / 74;
    S.sx2[x] = (TAU * x) / 43 + 1.3;
    S.taper[x] = 0.74 + 0.26 * pow(1 - u * u, 0.5);
  }
}

function retarget(S, i) {
  const T = S.tone[i];
  let o;
  if (Math.random() < 0.16) {
    // glide toward another tone's destination, so that two of them end up close and beat
    const j = (i + 1 + floor(Math.random() * (NT - 1))) % NT;
    o = S.tone[j].o1 + (Math.random() < 0.5 ? -1 : 1) * (0.1 + 0.3 * Math.random());
  } else {
    // otherwise a place at least 0.7 octave from where the others are headed, if five tries find one
    for (let k = 0; k < 5; k++) {
      o = (Math.random() + Math.random() + Math.random() - 1.5) * 2 * TSPREAD;
      let free = true;
      for (let j = 0; j < NT; j++) if (j !== i && abs(S.tone[j].o1 - o) < 0.7) free = false;
      if (free) break;
    }
  }
  T.o0 = T.o;
  T.o1 = cl(o, -OFFMAX, OFFMAX);
  T.s0 = S.t + 2.5 * Math.random();
  T.dur = 5 + 6.5 * abs(T.o1 - T.o0) + 5 * Math.random();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  S.t += d;
  const t = S.t;
  S.p1 = 0.31 * t;
  S.p2 = -0.23 * t;
  S.hue = cl(kn[0], 0, 1);
  const pitchK = cl(kn[1], 0, 4);
  const levK = (cl(kn[2], -1, 1) + 1) / 2;
  const nK = 1 + 3 * ((cl(kn[3], -1, 0.2) + 1) / 1.2);
  const a = 1 - exp(-d / 0.18);
  if (S.pitch < 0) {
    S.pitch = pitchK;
    S.lev = levK;
    S.n = nK;
  } else {
    S.pitch += (pitchK - S.pitch) * a;
    S.lev += (levK - S.lev) * a;
    S.n += (nK - S.n) * a;
  }
  if (abs(S.hue - S.builtHue) > 0.001) buildColours(S);

  const Pc = (S.pitch - 2) * PITCH_OCT;
  const lev = S.lev;
  const level = pow(pow(10, -1.5 * (1 - lev)), COMP); // compressed loudness, 0.35 to 1
  const Lr = LR0 * (0.85 + 0.65 * lev);
  const Ld = LD0 * (0.85 + 0.65 * lev);

  // tones: gliding, flickering, swelling
  let pw = 0, ws = 0;
  for (let i = 0; i < NT; i++) {
    const T = S.tone[i];
    if (t >= T.s0 + T.dur) {
      T.o = T.o1;
      retarget(S, i);
    }
    T.o = t < T.s0 ? T.o0 : T.o0 + (T.o1 - T.o0) * sm((t - T.s0) / T.dur);
    T.p = cl(Pc + T.o, PMIN, PMAX);
    T.w = sm(S.n - i);
    pw += T.w * T.p;
    ws += T.w;
    if (i === 2) {
      if (t >= T.gNext) {
        T.gOn = !T.gOn;
        T.gNext = t + (T.gOn ? 0.8 + 2.4 * Math.random() : 0.5 + 1.9 * Math.random());
      }
      const tau = T.gOn ? 0.1 : 0.45;
      T.gate += ((T.gOn ? 1 : 0) - T.gate) * (1 - exp(-d / tau));
    }
  }
  const pm = pw / ws;
  const wf = S.wf;
  wf.fill(0);
  S.ef.fill(0);
  S.gf.fill(0);
  S.hf.fill(0);
  S.mf.fill(0);
  const bow = BOW * (1 + 0.45 * sin(0.113 * t + 0.7)), tilt = TILT * (0.75 * sin(0.071 * t + 1.9) + 0.25 * sin(0.157 * t));
  for (let x = 0; x < W; x++) S.shift[x] = bow * (1 - S.u[x] * S.u[x]) + tilt * S.u[x];
  const sigma = 4.5 * (0.85 + 0.6 * lev);
    for (let i = 0; i < NT; i++) {
    const T = S.tone[i];
    const wb = WOB[i];
    const wobble = 1 + 0.2 * sin(TAU * wb[0] * t + wb[1]) + 0.12 * sin(TAU * wb[2] * t + wb[3]);
    T.A = level * T.w * T.gate * wobble;
    const nu = NU0 * pow(2, 1.25 * tanh((T.p - pm) / 0.9));
    T.th = (T.th + TAU * nu * d) % TAU;
    if (T.A < 0.004) continue;
    const yc = yOfOct(T.p);
    T.yc = yc;
    // the wave: phase grows down the membrane at the local wavenumber, which rises toward the peak
    let ph = 0;
    for (let j = 0; j <= NS; j++) {
      const y = j * 0.5;
      const dd = yc - y;
      const dp = dd > 0 ? dd : 0;
      const lam = min(LAMF, LAMPK + LSLOPE * dp);
      ph += (TAU / lam) * 0.5;
      let E;
      if (dd >= 0) E = exp(-dd / Lr);
      else {
        const q = dd / Ld;
        E = exp(-q * q);
      }
      if (E < 0.003) continue;
      wf[j] += T.A * E * cos(ph - T.th);
      S.ef[j] += T.A * E;
    }
    // the hair cells: three outer rows and one inner row, as bands across the membrane
    const G = min(1, 1.4 * T.A);
    // the hair cells: one inner band and three outer ones, across the membrane, just past the peak
    const bands = [
      [1.5, 3, 1.0],
      [6, 2, 0.62],
      [10, 2, 0.46],
      [14, 2, 0.34],
    ];
    const hc = yc + 6;
    const j0 = max(0, floor(2 * (hc - 4 * sigma))), j1 = min(NS, floor(2 * (hc + 4 * sigma)) + 1);
    for (let j = j0; j <= j1; j++) {
      const z = (j * 0.5 - hc) / sigma;
      S.hf[j] += 0.05 * G * exp(-0.5 * z * z);
    }
    // the wave is dimmed under the whole ladder, so the gaps between its bands stay clean
    const ma = max(0, floor(2 * (yc - 1.5)) - 2), mb = min(NS, floor(2 * (yc + 17)) + 3);
    const ms = min(1, 1.6 * G);
    for (let j = ma; j <= mb; j++) {
      const m = ms * cl(0.5 + (j * 0.5 - (yc - 1.5)) / 1.5, 0, 1) * cl(0.5 + (yc + 16.5 - j * 0.5) / 1.5, 0, 1);
      if (m > S.mf[j]) S.mf[j] = m;
    }
    for (const [off, h, k] of bands) {
      const c = yc + off, hh = h;
      const ja = max(0, floor(2 * (c - hh / 2) - 2)), jb = min(NS, floor(2 * (c + hh / 2) + 3));
      for (let j = ja; j <= jb; j++) S.gf[j] += G * k * cl(0.5 + (hh / 2 - abs(j * 0.5 - c)) / 0.8, 0, 1);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.builtHue < 0) buildColours(S);
  const wf = S.wf, ef = S.ef, gf = S.gf, hf = S.hf, mf = S.mf, lut = S.lut, cor = S.coral;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const jy = cl((y + 0.5 + S.shift[x]) * 2, 0, NS - 1);
      const j = floor(jy), fr = jy - j, q = 1 - fr;
      // light slides slowly along the membrane: two broad lobes of sheen that drift on different periods
      const sheen = 1 + 0.2 * sin(S.sx1[x] + y * 0.042 + S.p1) + 0.14 * sin(S.sx2[x] - y * 0.027 + S.p2);
      const w = (wf[j] * q + wf[j + 1] * fr + LIFT * (ef[j] * q + ef[j + 1] * fr)) * sheen;
      const b = w > 0 ? 1 - exp(-2.2 * pow(w, 0.9)) : 0;
      const n = floor(b * NL + 0.5) * 3;
      const tp = S.taper[x];
      const g = min(1, (gf[j] * q + gf[j + 1] * fr) * tp);
      const c = min(1, g + (hf[j] * q + hf[j + 1] * fr) * (1 - b));
      const mk = 1 - 0.8 * (mf[j] * q + mf[j + 1] * fr);
      // under a hair-cell band the ground and the wave give way, so the band is pure coral
      const gk = g < 0.4 ? 1 - 2.5 * g : 0;
      const keep = gk * mk;
      const sh = 0.82 + 0.18 * tp;
      const cc = pow(g, 0.8) + (c - g);
      display.setPixel(
        x, y,
        min(255, (lut[0] * gk + (lut[n] - lut[0]) * keep) * sh + cor[0] * cc),
        min(255, (lut[1] * gk + (lut[n + 1] - lut[1]) * keep) * sh + cor[1] * cc),
        min(255, (lut[2] * gk + (lut[n + 2] - lut[2]) * keep) * sh + cor[2] * cc),
      );
    }
  }
}
