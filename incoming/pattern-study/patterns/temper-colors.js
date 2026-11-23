// ===== Patternflow pattern =====
// Title:   Temper Colors
// Family:  oxidecolor
// Idea:    A wandering torch heats a bare steel plate seen from above, its heat spreads through the metal and an oxide film grows wherever it is hot and never shrinks, so the plate keeps the torch's road as straw, gold, brown, magenta and blue bands that are the history of its isotherms, until a wire brush sweeps a bright edge across it and leaves polished steel to be written on again.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: temper colours of steel, the interference colours of a growing oxide film (heat tint), whose thickness follows the parabolic law of oxidation (Gustav Tammann, 1920; Carl Wagner, 1933, from memory); film reflectance by the Airy sum (George Airy, 1833, from memory), colour from the multi-lobe CIE 1931 fit (Chris Wyman, Peter-Pike Sloan and Peter Shirley, 2013, from memory) and the glow from Planck's law (1900); pattern round 228
// Round:   230
// ===============================
// @matrix 64x128
// @knobs Tint=0..1, Power=1..3.4, Spot=-1..1, Brush=-1..1
//
// Knob 1: Tint. The refractive index of the film, 2.0 at 0 to 3.3 at 1, which scales the optical path n h, so the same film reads further along the colour order: at 0 a growing film runs silver, straw at 20 nm, gold, brown, magenta at 50 and blue at 60 to 70, and at 1 blue is already there at 40 nm and the film goes on through green to the second order's gold and pink.
// Knob 2: Power. The torch's heat input, 1 to 3.4 and opening at 2: at 1 the flame is a dull red and the road stays straw, gold and brown with blue only where it crosses itself, at 3.4 the flame glows orange and the road runs blue and pale blue about 16 LED wide.
// Knob 3: Spot. The width of the flame, 3 LED at -1, 8 at 0 and 12 at 1: a small flame draws a thin gold line with a blue thread down it, whose colour order takes 6 LED from straw to blue, a wide one a band that takes 12.
// Knob 4: Brush. How often the wire brush sweeps the plate, every 180 seconds at -1, 56 at the opening 0.06 and 20 at 1; each sweep takes 5 to 10 seconds and wipes the film behind its edge, so the more it brushes, the less of the road survives.

const W = 64;
const H = 128;
const N = W * H;
const { ceil, sqrt, exp, sin, cos, pow, max, min, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- the plate: temperature in degrees over the room
const ALPHA = 4.5; // diffusivity, LED^2 a second
const LOSS = 0.1; // the face cools to the room, a second
const EDGE = 0.45; // conductance of an outer face to the frame, against 1 between two cells
const LAM = 0.22; // alpha dt / dx^2 may not pass a quarter; this is the part used
const OPEN_AT = 0.3; // how far across the plate the brush is at the first frame
const PRE = 70; // world seconds run before the first frame

// ---- oxide: d(h^2)/dt = 2 k(T), the diffusion-limited law dh/dt = k / h, k = A exp(-Q / T)
const TQ = 3000; // Q over the gas constant, kelvin
const K_REF = 2400; // k at 900 C over the room, nm^2 a second
const T_REF = 293 + 900;
const T_ROOM = 293;
const HSLOW = 70; // nm; past it the film slows faster than the pure parabolic law, as a scale that seals itself does
const HS2 = 1 / (HSLOW * HSLOW);
const H0 = 2; // the film a clean plate starts with, nm
const HMAX = 170; // nm where the colour table ends
const NH = 512;
const TH_MIN = 120; // under this nothing grows
const KT_STEP = 4;
const KT_N = 400; // table of k over 0 .. 1600 C

// ---- glow of the hot metal
const GLOW_LO = 470;
const FLAME = 520; // degrees the flame adds to what the glow shows at power 1
const GLOW_N = 192;
const GLOW_STEP = 8;

// ---- the torch's road
const SPEED_T = 15; // LED a second
const EDGE_M = 9; // LED from an edge where the torch starts to turn back

// ---- the brush
const BAND = 7; // LED the bright band trails behind its leading edge
const SPEED = 13; // LED a second

// Multi-lobe fit of the CIE 1931 colour-matching functions (Wyman, Sloan and Shirley, 2013).
const lobe = (l, mu, s1, s2) => {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return exp(-0.5 * t * t);
};
function cie(l, out) {
  const x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
  const y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
  const z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
  out[0] = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  out[1] = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  out[2] = 0.0557 * x - 0.204 * y + 1.057 * z;
}

const NL = 24; // wavelengths summed
const LAM_LO = 400;
const LAM_HI = 700;
const enc = (v) => 255 * pow(cl(v, 0, 1), 0.4545);

// Reflectance of an absorbing film of index n + ik and thickness h on steel (complex index NS), light straight on.
const NS_RE = 2.6;
const NS_IM = 3.2;
function reflect(n, kk, h, l) {
  // r01 = (1 - nf) / (1 + nf), r12 = (nf - ns) / (nf + ns), complex
  const dn = (1 + n) * (1 + n) + kk * kk;
  const r01r = ((1 - n) * (1 + n) - kk * kk) / dn;
  const r01i = (-kk * (1 + n) - (1 - n) * kk) / dn;
  const a = n - NS_RE, b = kk - NS_IM, c = n + NS_RE, d = kk + NS_IM, dd = c * c + d * d;
  const r12r = (a * c + b * d) / dd;
  const r12i = (b * c - a * d) / dd;
  const ph = (4 * PI * h) / l;
  const am = exp(-ph * kk);
  const er = am * cos(ph * n), ei = am * sin(ph * n);
  const pr = r12r * er - r12i * ei, pi = r12r * ei + r12i * er; // r12 e
  const nr = r01r + pr, ni = r01i + pi;
  const qr = 1 + (r01r * pr - r01i * pi), qi = r01r * pi + r01i * pr;
  const qq = qr * qr + qi * qi;
  const rr = (nr * qr + ni * qi) / qq, ri = (ni * qr - nr * qi) / qq;
  return rr * rr + ri * ri;
}

// The colour of every film thickness from 0 to HMAX at index n, as the ratio of the film's reflected light to the bare plate's,
// colour by colour, lifted and made more vivid for the panel.
function buildFilm(S, n) {
  // The knob's index scales the optical path n h; the film's own contrast stays that of 2.3.
  const sc = n / N_FILM;
  n = N_FILM;
  const kk = 0.45;
  const t = [0, 0, 0];
  const ws = [], wr = [];
  for (let i = 0; i < NL; i++) {
    const l = LAM_LO + ((i + 0.5) * (LAM_HI - LAM_LO)) / NL;
    cie(l, t);
    ws.push(l);
    wr.push([t[0], t[1], t[2]]);
  }
  const bare = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const R = reflect(n, kk, 0, ws[i]);
    for (let j = 0; j < 3; j++) bare[j] += wr[i][j] * R;
  }
  const g = S.ground, out = S.film;
  for (let q = 0; q < NH; q++) {
    const h = (q * HMAX) / (NH - 1);
    const c = [0, 0, 0];
    for (let i = 0; i < NL; i++) {
      const R = reflect(n, kk, h * sc, ws[i]);
      for (let j = 0; j < 3; j++) c[j] += wr[i][j] * R;
    }
    let r = max(0, c[0] / bare[0]) * 0.5, gg = max(0, c[1] / bare[1]) * 0.5, b = max(0, c[2] / bare[2]) * 0.5;
    // More vivid, and most for the faint tints: a film's first colours are only a few percent off grey and would read as dirty white.
    const Y = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const dr = r - Y, dg = gg - Y, db = b - Y;
    const cm = sqrt(dr * dr + dg * dg + db * db) + 1e-6;
    const f = (SAT * pow(cm, 0.72)) / cm;
    r = max(0, Y + dr * f);
    gg = max(0, Y + dg * f);
    b = max(0, Y + db * f);
    const m = max(r, gg, b, 1e-4);
    const s = (LIFT + (1 - LIFT) * min(m, 1)) / m;
    r *= s;
    gg *= s;
    b *= s;
    const top = max(r, gg, b);
    if (top > 1) {
      r /= top;
      gg /= top;
      b /= top;
    }
    // a film under about 16 nm is not seen: the plate keeps its blue-grey
    const w = sm(0, 16, h);
    out[q * 3] = g[0] + (enc(r) - g[0]) * w;
    out[q * 3 + 1] = g[1] + (enc(gg) - g[1]) * w;
    out[q * 3 + 2] = g[2] + (enc(b) - g[2]) * w;
  }
}
const SAT = 1.0;
const N_FILM = 2.3;
const LIFT = 0.42;

// Planck's law on the same eye: the colour of hot steel by temperature, by itself at full brightness in its top channel.
function buildGlow(S) {
  const t = [0, 0, 0];
  for (let q = 0; q < GLOW_N; q++) {
    const T = T_ROOM + GLOW_LO + q * GLOW_STEP;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < NL; i++) {
      const l = LAM_LO + ((i + 0.5) * (LAM_HI - LAM_LO)) / NL;
      cie(l, t);
      const lm = l * 1e-9;
      const B = 1 / (lm ** 5 * (exp(1.4388e-2 / (lm * T)) - 1));
      r += t[0] * B;
      g += t[1] * B;
      b += t[2] * B;
    }
    const m = max(r, g, b, 1e-30);
    r = max(0, r / m);
    g = max(0, g / m);
    b = max(0, b / m);
    // brightness climbs with temperature, from a dull red to the yellow-white of a flame
    const v = 0.3 + 0.7 * sm(0, 760, q * GLOW_STEP);
    S.glow[q * 3] = enc(r * v);
    S.glow[q * 3 + 1] = enc(g * v);
    S.glow[q * 3 + 2] = enc(b * v);
  }
}

export function setup(params) {
  const S = {
    t: 0,
    warm: false,
    T: new Float32Array(N),
    T2: new Float32Array(N),
    h2: new Float32Array(N).fill(H0 * H0),
    shine: new Float32Array(N),
    ec: new Float32Array(N),
    kt: new Float32Array(KT_N + 1),
    film: new Float32Array(NH * 3),
    glow: new Float32Array(GLOW_N * 3),
    ground: [86, 99, 120],
    nKey: -1,
    n1: 2.0,
    power: 1,
    sigma: 2.5,
    interval: 24,
    // the torch: phases of its sines, its heading, a turn still to be made and when the next one is due
    ph: [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3],
    hd: 1.0,
    pend: 0,
    turnAt: 9,
    pos: [32, 64],
    brushes: [],
    nextBrush: 0,
    gx: new Float32Array(80),
    gy: new Float32Array(80),
  };
  for (let p = 0; p < N; p++) {
    const x = p % W, y = (p / W) | 0;
    S.ec[p] = EDGE * ((x === 0) + (x === W - 1) + (y === 0) + (y === H - 1));
  }
  for (let q = 0; q <= KT_N; q++) {
    const T = T_ROOM + q * KT_STEP;
    S.kt[q] = q * KT_STEP < TH_MIN ? 0 : K_REF * exp(-TQ * (1 / T - 1 / T_REF));
  }
  buildGlow(S);
  params.s = S;
}

// Where the torch stands. It runs at a speed that breathes and its heading turns at a rate made of three sines whose rates are not
// multiples of one another, so the road never closes; now and then a slow turn of half a radian to a radian and a half is added, and near an edge the
// heading is steered back in. The road is the one thing the plate remembers, so it should cross the whole panel.
function walk(S, d) {
  const t = S.t;
  // a slow target that sweeps the whole panel, which the heading leans toward, and the curl of the road on top of that
  const tx = 32 + 28 * sin(0.047 * t + S.ph[0]) + 7 * sin(0.113 * t + S.ph[1]);
  const ty = 64 + 58 * sin(0.029 * t + S.ph[2]) + 10 * sin(0.071 * t + S.ph[3]);
  const gx = tx - S.pos[0], gy = ty - S.pos[1];
  const gd = sqrt(gx * gx + gy * gy);
  const lean = 0.12 * sm(5, 26, gd) * sin(Math.atan2(gy, gx) - S.hd);
  const turn = lean + 0.09 * sin(0.31 * t + S.ph[3]) + 0.07 * sin(0.77 * t + S.ph[1]) + 0.05 * sin(0.113 * t + S.ph[0]);
  const kick = S.pend * min(1, d / 4);
  S.pend -= kick;
  // the edge pushes toward the middle of the panel
  const x = S.pos[0], y = S.pos[1];
  const fx = sm(EDGE_M, 0, x) - sm(EDGE_M, 0, W - x), fy = sm(EDGE_M, 0, y) - sm(EDGE_M, 0, H - y);
  let steer = 0;
  const fm = sqrt(fx * fx + fy * fy);
  if (fm > 1e-3) {
    const a = Math.atan2(fy, fx) - S.hd;
    steer = 2.6 * fm * cl(Math.atan2(sin(a), cos(a)), -1.2, 1.2);
  }
  S.hd += (turn + steer) * d + kick;
  if (t >= S.turnAt) {
    S.pend += (Math.random() < 0.5 ? -1 : 1) * (0.5 + 0.9 * Math.random());
    S.turnAt = t + 5 + 12 * Math.random();
  }
  const v = SPEED_T * (1 + 0.14 * sin(0.37 * t + S.ph[3]) + 0.08 * sin(0.91 * t));
  S.pos[0] += cos(S.hd) * v * d;
  S.pos[1] += sin(S.hd) * v * d;
  S.pos[0] = cl(S.pos[0], -2, W + 2);
  S.pos[1] = cl(S.pos[1], -2, H + 2);
}

function makeBrush() {
  const a = Math.random() * 2 * PI;
  const nx = cos(a), ny = sin(a);
  // the plate's corners along the brush's direction of travel
  let lo = 1e9, hi = -1e9;
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const u = cx * nx + cy * ny;
    lo = min(lo, u);
    hi = max(hi, u);
  }
  return { nx, ny, s: lo - 1.5, end: hi + BAND + 1, v: SPEED * (0.85 + 0.3 * Math.random()), lo, hi };
}

// One step of the plate: the torch's heat goes in, diffusion and cooling follow, and the film grows where it is hot.
function step(S, h) {
  const { T, T2, h2, kt, ec } = S;
  const lam = ALPHA * h, cool = LOSS * h;
  // the flame: a gaussian, a little unsteady
  const sg = S.sigma, R = min(31, ceil(3 * sg)), cx = S.pos[0], cy = S.pos[1];
  const q = S.q * (1 + 0.12 * sin(0.9 * S.t) + 0.08 * sin(2.3 * S.t + 1)) * h;
  const x0 = max(0, (cx - R) | 0), x1 = min(W - 1, ceil(cx + R)), y0 = max(0, (cy - R) | 0), y1 = min(H - 1, ceil(cy + R));
  const gx = S.gx, gy = S.gy;
  for (let x = x0; x <= x1; x++) gx[x - x0] = exp(-((x + 0.5 - cx) ** 2) / (2 * sg * sg));
  for (let y = y0; y <= y1; y++) gy[y - y0] = exp(-((y + 0.5 - cy) ** 2) / (2 * sg * sg)) * q;
  for (let y = y0; y <= y1; y++) {
    const w = gy[y - y0];
    for (let x = x0; x <= x1; x++) T[y * W + x] += w * gx[x - x0];
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const c = T[p];
      const l = x > 0 ? T[p - 1] : c, r = x < W - 1 ? T[p + 1] : c, u = y > 0 ? T[p - W] : c, d = y < H - 1 ? T[p + W] : c;
      T2[p] = c + lam * (l + r + u + d - 4 * c - ec[p] * c) - cool * c;
    }
  S.T = T2;
  S.T2 = T;
  // growth where it is hot enough to matter
  const Tn = S.T;
  for (let p = 0; p < N; p++) {
    const th = Tn[p];
    if (th > TH_MIN) h2[p] += (2 * kt[min(KT_N, (th / KT_STEP) | 0)] * h) / (1 + h2[p] * HS2);
  }
  // brushes
  for (const b of S.brushes) {
    const s1 = b.s + b.v * h;
    const lo = b.s - BAND, hi = s1;
    for (let y = 0, p = 0; y < H; y++)
      for (let x = 0; x < W; x++, p++) {
        const u = (x + 0.5) * b.nx + (y + 0.5) * b.ny;
        if (u > lo && u <= hi) {
          h2[p] = H0 * H0;
          S.shine[p] = 1;
        }
      }
    b.s = s1;
  }
  S.brushes = S.brushes.filter((b) => b.s < b.end);
  S.t += h;
}

function advance(S, span) {
  while (span > 1e-9) {
    // equal steps no longer than the explicit scheme allows
    const h = span / ceil(span / (LAM / ALPHA) - 1e-9);
    walk(S, h);
    if (S.plan) {
      while (S.plan.length && S.t >= S.plan[0].at) S.brushes.push(S.plan.shift());
    } else if (S.t >= S.nextBrush) {
      S.brushes.push(makeBrush());
      S.nextBrush = S.t + S.interval * (0.7 + 0.6 * Math.random());
    }
    step(S, h);
    const dec = exp(-h / 1.0);
    if (S.brushes.length || S.shineOn) {
      let any = false;
      const sh = S.shine;
      for (let p = 0; p < N; p++) {
        const v = sh[p];
        if (v > 0.004) {
          sh[p] = v * dec;
          any = true;
        } else sh[p] = 0;
      }
      S.shineOn = any;
    }
    span -= h;
  }
}

function setKnobs(S, k) {
  S.n1 = 2.0 + 1.3 * cl(k[0], 0, 1);
  S.power = cl(k[1], 1, 3.4) / 2;
  const ks = cl(k[2], -1, 1);
  const d = ks < 0 ? 8 * (3 / 8) ** -ks : 8 + 4 * ks; // 3 LED at -1, 8 at 0, 12 at 1
  S.sigma = d / 2.355;
  // heat input falls a little with the spot's size, so a wide flame does not simply burn hotter
  S.q = 1300 * S.power * (3.4 / S.sigma) ** 1.3;
  S.interval = 60 * 3 ** -cl(k[3], -1, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  setKnobs(S, k);
  if (!S.warm) {
    S.warm = true;
    // Open on a plate that has been under the torch for a minute, with the brush a third of the way across it: the last sweep is timed
    // to be at OPEN_AT of its way at the first frame and the ones before it are laid back from there at the brush's own interval.
    const last = makeBrush();
    const at = max(0, PRE - (OPEN_AT * (last.hi - last.lo)) / last.v);
    last.at = at;
    S.plan = [last];
    for (let g = at - S.interval * (0.7 + 0.6 * Math.random()); g > 0; g -= S.interval * (0.7 + 0.6 * Math.random())) {
      const b = makeBrush();
      b.at = g;
      S.plan.unshift(b);
    }
    S.nextBrush = at + S.interval * (0.7 + 0.6 * Math.random());
    advance(S, PRE);
    S.plan = null;
    S.nextBrush = max(S.nextBrush, S.t + 2);
  }
  advance(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.nKey !== S.n1) {
    buildFilm(S, S.n1);
    S.nKey = S.n1;
  }
  const { T, h2, film, glow, shine } = S;
  const hs = (NH - 1) / HMAX, t = S.t;
  const fp = S.power ** 1.5, fs = 0.95 * S.sigma, fl2 = 1 / (2 * fs * fs), fl3 = 9 * fs * fs;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      let th = T[p];
      const hh = sqrt(h2[p]) * hs;
      const i0 = min(NH - 2, hh | 0), f = hh - i0;
      let r = film[i0 * 3] + (film[i0 * 3 + 3] - film[i0 * 3]) * f;
      let g = film[i0 * 3 + 1] + (film[i0 * 3 + 4] - film[i0 * 3 + 1]) * f;
      let b = film[i0 * 3 + 2] + (film[i0 * 3 + 5] - film[i0 * 3 + 2]) * f;
      const sh = shine[p];
      if (sh > 0) {
        r += sh * 0.2 * (214 - r);
        g += sh * 0.2 * (222 - g);
        b += sh * 0.2 * (236 - b);
      }
      // the flame itself burns hotter than the plate under it can show on a grid this coarse
      const fx = x + 0.5 - S.pos[0], fy = y + 0.5 - S.pos[1], fr2 = fx * fx + fy * fy;
      if (fr2 < fl3) th += FLAME * fp * exp(-fr2 * fl2);
      if (th > GLOW_LO) {
        const a = sm(GLOW_LO, GLOW_LO + 330, th);
        const q = min(GLOW_N - 1, ((th - GLOW_LO) / GLOW_STEP) | 0) * 3;
        r += (glow[q] - r) * a;
        g += (glow[q + 1] - g) * a;
        b += (glow[q + 2] - b) * a;
      }
      // two soft lights drift over the polished steel, so a bare plate is never the same grey twice
      const lamp = 0.9 + 0.06 * sin(0.075 * x + 0.04 * y + 0.083 * t) + 0.05 * sin(0.03 * x - 0.058 * y - 0.061 * t + 1.7) + 0.03 * sin(0.11 * x + 0.02 * y + 0.19 * t);
      r *= lamp;
      g *= lamp;
      b *= lamp;
      // the brush: a bright metallic edge at its front and a polish that fades behind it
      for (let k = 0; k < S.brushes.length; k++) {
        const bs = S.brushes[k];
        const dd = bs.s - ((x + 0.5) * bs.nx + (y + 0.5) * bs.ny);
        if (dd < -1.2 || dd > BAND) continue;
        const along = (y + 0.5) * bs.nx - (x + 0.5) * bs.ny;
        const sheen = 0.9 + 0.1 * sin(0.37 * along + 0.8) * sin(0.23 * along + 2.1);
        const fr = sm(-1.0, 0.3, dd) * exp(-(max(0, dd) * max(0, dd)) / 3.0);
        const body = 0.4 * sm(BAND, 1, dd) * sm(-0.2, 0.4, dd);
        const a = cl(max(fr * 0.95, body), 0, 1) * sheen;
        r += a * (238 - r);
        g += a * (243 - g);
        b += a * (252 - b);
      }
      display.setPixel(x, y, r, g, b);
    }
}
