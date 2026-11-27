// ===== Patternflow pattern =====
// Title:   Whispering Gallery
// Family:  whisper
// Idea:    A glass microdisk coupled to a tapered fibre lights up one whispering-gallery mode after another as a drifting laser scans past them, each mode a ring of bright lobes crawling round the rim while the fibre's transmitted light dips and a record below draws every dip as a line that the heat of the light drags aside.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: whispering-gallery waves round a curved wall (Lord Rayleigh, 1910); optical whispering-gallery modes of a glass sphere with very high Q (Braginsky, Gorodetsky and Ilchenko, 1989, from memory); a tapered fibre that excites them (Knight, Cheung, Jacques and Birks, 1997, from memory); under, critical and over coupling (Cai, Painter and Vahala, 2000, from memory); the triangle-shaped thermal resonance (Carmon, Yang and Vahala, 2004, from memory); zeros of Bessel functions by the Airy asymptotics (Olver, 1954, from memory); pattern round 270
// Round:   270
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scan=0.2..5, Gap=-1..1, Size=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of everything, one turn over the range: at 0 the colour runs from magenta at the low end of the scan through violet to blue where the disk opens and azure at the high end, the glass is indigo, and the hue wanders a tenth of a turn either way over a few minutes.
// Knob 2: Scan. How fast the laser sweeps between its turning points, 2.2 columns of the record a second for each unit of the knob and each sweep a random 0.65 to 1.35 of that: 0.44 at 0.2, 4.4 where it opens at 2 and 11 at 5. At 0.2 the drifting resonances do most of the work and a mode can stay lit for several seconds, at 5 the laser crosses the record in 4 to 9 s and a mode is lit for a second or less.
// Knob 3: Gap. The distance from the fibre to the rim, 0.3 LED at -1, 2.8 at 0 and 5.3 at 1, and the fibre breathes 0.8 LED either way over a minute. The coupling falls by a factor e for every 1.5 LED, so a first-order line has a half-width of about 1.7 columns at -1, over-coupled and broad, 1.2 at 0 where it is near critical and takes nearly the whole beam so that the fibre goes dark past the disk, and 0.8 at 1, under-coupled and thin.
// Knob 4: Size. The size of the disk against the wavelength, n k R at the middle of the scan: the first-order mode there has about 16 lobes round the rim at -1, 24 where it opens and 30 at 1 (two for each period m of the field, since the picture is the field squared), and the colour of the light runs from violet to azure with it; the slow drift moves it a few lobes either way over minutes.
//
// What the picture is. A glass microdisk 56 LED across fills the top of the panel and a fibre runs along its foot. Under the fibre a record scrolls down at 3.5 rows a second, 16 s of it on the panel with the newest on top. Each row is the whole spectrum at its moment with the dip of the transmitted light drawn as a bright line, so every resonance of the disk is a thread running down the record, magenta at the low end of the scan and blue at the high end. The bead above the record is the laser, at its place in that spectrum.
// When the bead meets a thread the disk rings. A mode with m periods round the rim shows 2m lobes, and l = 1, 2 or 3 gives that many rings of them. The lobes crawl round the rim as a travelling wave, and now and then part of the light runs back the other way, so they stand still and pulse. The fibre goes dark past the disk by as much as the mode takes, and a hot white lobe is a mode taking nearly all of it. The heat of the light shifts every resonance down by up to 5.5 columns and the glass takes 1.1 s to follow, so on a sweep towards the low end the laser drags the line it sits on and stays on it about 1.5 times as long as on a sweep the other way, and every thread in the record bends with it.
// The model. 60 modes, m from 4 to 25 and l from 1 to 3, each at the l-th zero of J_m. The Airy asymptotics give the zero to within 0.2, and a few Newton steps on Bessel's integral settle it. The profile across the disk is J_m with its zero set 1.2 LED outside the rim, so the field is not nil at the edge, and a tail that dies away over R / (1.05 m) beyond it. A mode has an intrinsic half-width and a coupling half-width, and its dip is 4 a b / (a + b)^2 deep at the centre for the two half-widths a and b. The record draws the dip as the square of a Lorentzian with 1.5 columns of spectrometer width added in, so a line is never under 2 LED wide. Each mode's loss and coupling wander on a sine of their own, the laser's power on five, the resonances against the laser's centre on four, and the fibre's gap and the range of the scan on two each. No two periods share a whole-number ratio, so the picture does not come round to a scene it has shown before.
// What is exact and what is not. The field J_m cos(m phi), the zeros of J_m as the resonances, the dip that reaches nil only at critical coupling and the red shift that drags a line are the textbook picture (from memory). A glass disk has its zeros a little lower and a small leak, and carries both polarisations and many more radial orders than three. The widths, the 16 columns to one unit of n k R, the 56 LED disk with m up to 25, the rates of the crawl, the heat and the scan, and the slowing of the light to a few LED a second are chosen by eye. So is the colour, which a real laser would not change across a scan.

const W = 64, H = 128, NPIX = W * H;
const { floor, sqrt, cbrt, sin, cos, exp, abs, min, max, tanh, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();

const CX = 32, CY = 31, R = 28;   // the disk, in LED
const RY0 = 72;                   // the first row of the record
const RR = 3.5;                   // rows of the record a second
const SC = 16;                    // columns of the record to one unit of x = n k R, before the scan range breathes
const STEP = 1 / 60;              // the model's clock
const HTH = 5.5;                  // columns the heat of a full-strength mode pulls the resonances down
const TAUH = 1.1;                 // seconds the glass takes to warm and cool
const TAUR = 0.1, TAUD = 1.2;    // seconds a mode takes to ring up and to ring down
const RING = 2048;                // steps of heat the record remembers
const NB = 1024;                  // angle bins round the disk
const RT = 4;                     // radial table entries to the LED
const RMAX = R + 8;

// ---- the modes. A disk of radius R, light of wave number k in glass of index
// n: inside, the field of a mode with m periods round the rim is
// J_m(n k r) cos(m phi - w t), and it rings when n k R sits on a zero of J_m,
// the l-th one for l rings of lobes. For l = 1, 2, 3 the zeros are found by
// Newton's method from the Airy asymptotics
//   j(m,l) ~ m + a_l 2^(-1/3) m^(1/3) + (3/20) a_l^2 2^(1/3) m^(-1/3),
// a_l the l-th zero of Ai taken positive (2.338, 4.088, 5.521).
// Outside the rim the field dies away over R / (1.05 m), the evanescent tail
// that reaches the fibre.
const AIRY = [2.33810741, 4.08794944, 5.52055983];
// Modes with few periods round the rim for their ring count are not
// whispering-gallery modes: they leak and make no clean line, so each ring
// count starts at its own smallest m.
const MMIN = [4, 6, 8], MMAX = 25;
const MODES = [];
for (let m = 4; m <= MMAX; m++) for (let l = 1; l <= 3; l++) if (m >= MMIN[l - 1]) MODES.push([m, l]);
const NM = MODES.length;

// Bessel's integral by the midpoint rule: for an integrand periodic like this one it is exact to rounding.
function Jn(m, x) {
  let a = 0;
  for (let i = 0; i < 64; i++) {
    const t = ((i + 0.5) * PI) / 64;
    a += cos(m * t - x * sin(t));
  }
  return a / 64;
}
function dJn(m, x) {
  let a = 0;
  for (let i = 0; i < 64; i++) {
    const t = ((i + 0.5) * PI) / 64;
    a += sin(t) * sin(m * t - x * sin(t));
  }
  return a / 64;
}
function zero(m, l) {
  const a = AIRY[l - 1];
  const g = m + a * 0.7937005 * cbrt(m) + (0.15 * a * a * 1.259921) / cbrt(m);
  let x = g;
  for (let i = 0; i < 14; i++) {
    const dx = Jn(m, x) / dJn(m, x);
    x -= dx;
    if (abs(dx) < 1e-7) break;
  }
  return abs(x - g) < 0.6 ? x : g;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// a dim orange or yellow reads as brown on the panel, so the warm hues lean to
// red where the level is low and come back to themselves as it rises
function warm(h, b) {
  const f = h - floor(h), w = 1 - sm(0.12, 0.3, f);
  return h - f + f * (1 - w * (0.85 - 0.85 * sm(0.2, 0.8, b)));
}
// light of one colour at a level 0..1, going to white at the top
function glow(h, b, out) {
  hsv(warm(h, b), 0.95 - 0.8 * sm(0.5, 1, b), min(1, b * 1.05), out);
}

// the drift of the resonances against the laser's centre, in units of x: four
// slow sines whose periods share no whole-number ratio, the speeds in x a second
const CT = [293, 127, 61.3, 29.7], CA = [2.0, 1.6, 0.7, 0.3];
const CLO = 10, CHI = 23;
function cOf(s, t) {
  let w = 0;
  for (let i = 0; i < 4; i++) w += CA[i] * sin((TAU * t) / CT[i] + s.cph[i]);
  const mid = 0.5 * (CLO + CHI), hr = 0.5 * (CHI - CLO);
  return mid + hr * tanh((s.cm + w - mid) / hr);
}
// the laser's power wanders on five sines of its own, between 0.4 and 1
const PT = [37.1, 21.3, 12.9, 8.3, 5.1], PA = [0.4, 0.3, 0.25, 0.2, 0.15];
function powOf(s, t) {
  let w = 0;
  for (let i = 0; i < 5; i++) w += PA[i] * sin((TAU * t) / PT[i] + s.pph[i]);
  return 0.7 + 0.3 * (w / 1.3);
}
const hueOf = (s, xa) => 0.7 - s.hs * (xa - 16) + s.k[0] + s.hd;

export function setup(params) {
  const s = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, t: 0, n: 0,
    cph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], gph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], pph: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU], pw: 1, hd: 0, hs: 0.027,
    cm: 16.5, sc: SC, spd: 3.2, g: 2.8,
    u: 20 + 24 * rnd(), vel: 0, tgt: 4, sr: 1, th: 0, Pt: 0, xl: 16,
    TH: new Float32Array(RING),
    mm: new Int16Array(NM), ml: new Int8Array(NM), X: new Float32Array(NM), hw0: new Float32Array(NM), fc: new Float32Array(NM),
    hwx: new Float32Array(NM), hw: new Float32Array(NM), dep: new Float32Array(NM),
    qph: new Float32Array(NM), qw: new Float32Array(NM), a: new Float32Array(NM), ang: new Float32Array(NM), om: new Float32Array(NM), bph: new Float32Array(NM), bsp: new Float32Array(NM),
    tab: new Array(NM).fill(null), trig: new Array(MMAX + 1).fill(null),
    pidx: null, pr: null, pb: null, np: 0,
    buf: new Float32Array(NPIX * 3), col: [0, 0, 0], col2: [0, 0, 0],
  };
  // the opening should find the laser at good power: of a few draws of phases keep the one that is strongest over the first ten seconds
  let bp = -1, best = s.pph;
  for (let tr = 0; tr < 24; tr++) {
    const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU];
    s.pph = ph;
    let sum = 0;
    for (let q = 0; q < 12; q++) sum += powOf(s, 46 + q);
    if (sum > bp) { bp = sum; best = ph; }
  }
  s.pph = best;
  for (let k = 0; k < NM; k++) {
    const m = MODES[k][0], l = MODES[k][1];
    s.mm[k] = m;
    s.ml[k] = l;
    s.X[k] = zero(m, l);
    s.hw0[k] = 0.45 * (1 + 0.15 * (l - 1)) * (1 + 2.2 * exp(-(m / l - 2.2) / 1.4)) * (0.85 + 0.3 * rnd());
    s.fc[k] = [1, 0.7, 0.45][l - 1] * (12 / m) ** 0.7 * exp(0.9 * (rnd() + rnd() + rnd() + rnd() - 2) * 1.732);
    s.om[k] = 1.1 + 0.6 * rnd();
    s.bph[k] = rnd() * TAU;
    s.qph[k] = rnd() * TAU;
    s.qw[k] = TAU / (37 + 94 * rnd());
    s.bsp[k] = 0.11 + 0.17 * rnd();
  }
  // the LED of the disk and the tail round it
  const idx = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY;
      if (dx * dx + dy * dy < (R + 7) * (R + 7)) idx.push(y * W + x);
    }
  s.np = idx.length;
  s.pidx = Int32Array.from(idx);
  s.pr = new Float32Array(s.np);
  s.pb = new Int16Array(s.np);
  for (let i = 0; i < s.np; i++) {
    const p = s.pidx[i], dx = (p % W) + 0.5 - CX, dy = floor(p / W) + 0.5 - CY;
    s.pr[i] = sqrt(dx * dx + dy * dy);
    s.pb[i] = floor(((atan2(dy, dx) + PI) / TAU) * NB) & (NB - 1);
  }
  params.s = s;
}

function readKnobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
  const k = s.k;
  s.spd = 2.2 * cl(k[1], 0.2, 5);
  // the fibre breathes a little nearer and further, and the colour drifts, each on slow sines of their own
  const t = s.t, gp = s.gph;
  s.g = max(0.2, 2.8 + 2.5 * cl(k[2], -1, 1) + 0.4 * sin((TAU * t) / 71 + gp[0]) + 0.25 * sin((TAU * t) / 43.7 + gp[1]) + 0.15 * sin((TAU * t) / 19.3 + gp[2]));
  s.hs = 0.027 * exp(0.55 * sin((TAU * t) / 137 + gp[2] * 0.6));
  s.hd = 0.06 * sin((TAU * t) / 157 + gp[3]) + 0.04 * sin((TAU * t) / 89.3 + gp[0] * 1.7);
  s.cm = 16.5 + 5 * cl(k[3], -1, 1);
  // the range the laser scans widens and narrows, so the lines crowd and open out
  s.sc = SC * exp(0.28 * sin((TAU * t) / 109 + gp[2] * 1.3) + 0.18 * sin((TAU * t) / 61.7 + gp[1] * 0.7));
  // the coupling falls off with the gap; the loss of each mode wanders on its own, a third either way, so a line now and then crosses critical
  for (let i = 0; i < NM; i++) {
    const w = exp(-(s.g - 2.8) / 1.5) * s.fc[i] * exp(0.7 * sin(s.qw[i] * 1.3 * t + s.qph[i] * 2.1)), h0 = s.hw0[i] * (1 + 0.33 * sin(s.qw[i] * t + s.qph[i]));
    s.hwx[i] = 1.3 * tanh(w / 1.3);
    s.hw[i] = h0 + s.hwx[i];
    s.dep[i] = (4 * h0 * s.hwx[i]) / (s.hw[i] * s.hw[i]);
  }
}

// the laser and the heat, one step of 1/60 s
function stepSim(s) {
  const h = STEP;
  s.t += h;
  s.n++;
  // the laser goes from one random turning point to another, easing at each
  let d = s.tgt - s.u;
  if (abs(d) < 1) {
    const L = 22 + 36 * rnd();
    let dir = rnd() < 0.5 ? -1 : 1;
    if (s.u + dir * L > 61) dir = -1;
    else if (s.u + dir * L < 3) dir = 1;
    s.tgt = cl(s.u + dir * L, 3, 61);
    s.sr = 0.65 + 0.7 * rnd();
    d = s.tgt - s.u;
  }
  const want = (d > 0 ? 1 : -1) * s.spd * s.sr * min(1, 0.2 + abs(d) / 7);
  s.vel += (want - s.vel) * (1 - exp(-h / 0.3));
  s.u += s.vel * h;
  const c = cOf(s, s.t), off = 32 - c * s.sc - s.th, u = s.u, pw = powOf(s, s.t);
  s.pw = pw;
  const { X, hw, dep, a, ang, om } = s, kr = 1 - exp(-h / TAUR), kd = 1 - exp(-h / TAUD);
  let Pt = 0;
  for (let k = 0; k < NM; k++) {
    const dd = u - (X[k] * s.sc + off);
    let P = 0;
    if (dd < 40 && dd > -40) {
      const q = (hw[k] * hw[k]) / (dd * dd + hw[k] * hw[k]);
      P = dep[k] * q ** 1.25;
    }
    Pt += P;
    a[k] += (P * pw - a[k]) * (P * pw > a[k] ? kr : kd);
    ang[k] += om[k] * (1 + 0.35 * sin(0.37 * s.t + s.bph[k])) * h;
  }
  Pt = min(1, Pt);
  s.Pt = Pt;
  // the heat of the light shifts every resonance down together
  s.th += ((HTH * pw * min(Pt, 1.25) - s.th) * h) / TAUH;
  s.TH[s.n & (RING - 1)] = s.th;
  s.xl = c + (u - 32) / s.sc;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  readKnobs(s, input);
  if (!s.init) {
    s.init = true;
    s.tgt = 4;
    for (let i = 0; i < 2700; i++) stepSim(s);
    // open the laser a second and a half above the strongest line in view, running down towards it
    const off = 32 - cOf(s, s.t) * s.sc - s.th;
    let bk = 0, bp = 0;
    for (let k = 0; k < NM; k++) {
      const p = s.X[k] * s.sc + off;
      if (p > 12 && p < 52 && s.dep[k] / s.hw[k] > bk) { bk = s.dep[k] / s.hw[k]; bp = p; }
    }
    s.u = bp + 1.6 * s.spd;
    s.tgt = 4;
    s.sr = 1;
    s.vel = -s.spd;
  }
  s.acc += cl(dt || 0, 0, 0.1);
  while (s.acc >= STEP) {
    s.acc -= STEP;
    stepSim(s);
  }
}

// the radial profile of one mode, as a table at 1/RT LED: J_m inside with its
// zero a little outside the rim, a decaying tail beyond it
function radial(s, k) {
  const m = s.mm[k], x = s.X[k], w = 1.2, nt = RMAX * RT + 2, t = new Float32Array(nt);
  const dl = cl(R / (1.05 * m), 0.9, 3), fr = Jn(m, (x * R) / (R + w));
  let top = 1e-9;
  for (let i = 0; i < nt; i++) {
    const r = i / RT;
    t[i] = r <= R ? Jn(m, (x * (r + w)) / (R + w)) : fr * exp(-(r - R) / dl);
    if (r <= R && abs(t[i]) > top) top = abs(t[i]);
  }
  for (let i = 0; i < nt; i++) t[i] /= top;
  s.tab[k] = t;
  return t;
}
function trigs(s, m) {
  let t = s.trig[m];
  if (t) return t;
  t = { c: new Float32Array(NB), s: new Float32Array(NB) };
  for (let b = 0; b < NB; b++) {
    const f = ((b + 0.5) / NB) * TAU - PI;
    t.c[b] = cos(m * f);
    t.s[b] = sin(m * f);
  }
  s.trig[m] = t;
  return t;
}

export function draw(display, params) {
  const s = params.s;
  if (!s || !s.init) return;
  const buf = s.buf, k0 = s.k[0], col = s.col, c2 = s.col2;
  buf.fill(0);
  const hL = hueOf(s, s.xl);

  // ---- the disk: glass, then the modes that are ringing
  const act = [];
  for (let k = 0; k < NM; k++)
    if (s.a[k] > 0.012) {
      const m = s.mm[k], th = s.ang[k];
      const sw = sin(s.bph[k] + s.bsp[k] * s.t), Bk = 0.5 * (0.5 + 0.5 * sw) * (0.5 + 0.5 * sw), Ak = 1 - Bk;
      const tr = trigs(s, m);
      act.push({ tb: s.tab[k] || radial(s, k), tc: tr.c, ts: tr.s, P: (Ak + Bk) * cos(th), Q: -(Ak - Bk) * sin(th), a: s.a[k] });
    }
  const nA = act.length, gh = 0.69 + k0 + s.hd;
  for (let i = 0; i < s.np; i++) {
    const r = s.pr[i], bn = s.pb[i], p = s.pidx[i] * 3;
    let I = 0;
    const ri = floor(r * RT), fr = r * RT - ri;
    for (let j = 0; j < nA; j++) {
      const A = act[j], f = A.tb[ri] + (A.tb[ri + 1] - A.tb[ri]) * fr, e = f * (A.P * A.tc[bn] + A.Q * A.ts[bn]);
      I += A.a * e * e;
    }
    let R0 = 0, G0 = 0, B0 = 0;
    if (r < R + 0.5) {
      const edge = cl(R + 0.5 - r, 0, 1), q = r / R;
      const v = (0.05 + 0.07 * q * q * q + 0.16 * exp(-(((r - (R - 0.9)) / 1.2) ** 2))) * edge;
      hsv(warm(gh, v * 3), 0.85, v, c2);
      R0 = c2[0]; G0 = c2[1]; B0 = c2[2];
    }
    if (I > 0.003) {
      glow(hL, min(1, I * 2.3) ** 0.65, col);
      R0 += col[0]; G0 += col[1]; B0 += col[2];
    }
    buf[p] = R0; buf[p + 1] = G0; buf[p + 2] = B0;
  }

  // ---- the fibre along the foot of the disk, dimmer past the disk by what the modes took
  const yf = CY + R + s.g + 1, Tt = 1 - s.Pt;
  for (let y = floor(yf) - 1; y <= floor(yf) + 2; y++) {
    const cov = cl(1.5 - abs(y + 0.5 - yf), 0, 1);
    if (cov <= 0 || y < 0 || y >= H) continue;
    for (let x = 0; x < W; x++) {
      const v = 0.1 + 0.85 * s.pw * (1 - (1 - Tt) * sm(CX - 5, CX + 7, x + 0.5));
      hsv(warm(hL, v), 0.6, v * cov, col);
      const p = (y * W + x) * 3;
      buf[p] = max(buf[p], col[0]); buf[p + 1] = max(buf[p + 1], col[1]); buf[p + 2] = max(buf[p + 2], col[2]);
    }
  }

  // ---- the record: every row is the spectrum at its moment, newest on top, each dip a line
  const nrow = H - RY0, sx = new Float32Array(32), sw2 = new Float32Array(32), sd = new Float32Array(32);
  for (let ry = 0; ry < nrow; ry++) {
    const y = RY0 + ry, age = (ry + 0.5) / RR, tr = s.t - age;
    const c = cOf(s, tr), thr = s.TH[(s.n - Math.round(age / STEP)) & (RING - 1)];
    const off = 32 - c * s.sc - thr;
    let ns = 0;
    for (let k = 0; k < NM; k++) {
      const p = s.X[k] * s.sc + off;
      if (p > -14 && p < 78 && s.dep[k] > 0.03 && ns < 32) {
        sx[ns] = p; sw2[ns] = s.hw[k] * s.hw[k] + 2.25; sd[ns] = s.dep[k];
        ns++;
      }
    }
    const fade = (1 - 0.45 * (age / (nrow / RR))) * (0.6 + 0.4 * powOf(s, tr));
    for (let x = 0; x < W; x++) {
      const xc = x + 0.5;
      let L = 0;
      for (let j = 0; j < ns; j++) {
        const d = xc - sx[j], q = sw2[j] / (d * d + sw2[j]);
        L += sd[j] * q * q;
      }
      if (L < 0.02) continue;
      L = min(1, L * 1.25) ** 0.85;
      glow(hueOf(s, c + (xc - 32) / s.sc), L * fade, col);
      const p = (y * W + x) * 3;
      buf[p] = col[0]; buf[p + 1] = col[1]; buf[p + 2] = col[2];
    }
  }

  // ---- the laser, a bead riding the top of the record at its place in the spectrum
  for (let y = RY0 - 6; y < RY0 - 1; y++)
    for (let x = floor(s.u) - 3; x <= floor(s.u) + 3; x++) {
      if (x < 0 || x >= W) continue;
      const dx = x + 0.5 - s.u, dy = y + 0.5 - (RY0 - 3.5), cv = cl(2.3 - sqrt(dx * dx + dy * dy), 0, 1);
      if (cv <= 0) continue;
      hsv(hL, 0.25, cv, col);
      const p = (y * W + x) * 3;
      buf[p] = max(buf[p], col[0]); buf[p + 1] = max(buf[p + 1], col[1]); buf[p + 2] = max(buf[p + 2], col[2]);
    }

  for (let i = 0; i < NPIX; i++) {
    const p = i * 3;
    display.setPixel(i % W, floor(i / W), (min(1, buf[p]) * 255) | 0, (min(1, buf[p + 1]) * 255) | 0, (min(1, buf[p + 2]) * 255) | 0);
  }
}
