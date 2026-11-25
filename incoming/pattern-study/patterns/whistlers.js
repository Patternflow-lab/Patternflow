// ===== Patternflow pattern =====
// Title:   Whistlers
// Family:  whistler
// Idea:    A VLF radio spectrogram is written across the panel with time running left and frequency up, where every lightning stroke is a vertical spike of broadband crackle followed a moment later by a whistler, a tone that falls along the dispersion curve because the high frequencies arrive first, then by fainter echoes after each bounce along the magnetic field line, while rising chorus tones, a teal hiss and keyed carrier lines move through the same window.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: whistlers, the falling tones that Barkhausen heard on field telephone lines in the First World War (1919, from memory), explained as a lightning pulse dispersed on its way along a geomagnetic field line, with travel time t = D / sqrt(f) so that the high frequencies arrive first (Eckersley 1925 and Storey 1953, from memory); the nose whistler, whose delay t = D / sqrt(f) / (1 - f / fm)^1.5 has a minimum at f = fm / 4 (the form follows from the cold-plasma whistler mode; the plasmapause work of Carpenter in the 1960s, from memory); the echoes of order 3, 5, 7 that come back after each hemisphere-to-hemisphere bounce at 3D, 5D, 7D (Helliwell 1965, from memory); the rising tones of the dawn chorus and the plasmaspheric hiss (Storey, Helliwell, from memory); the sound spectrogram with time across and frequency up (Koenig, Dunn and Lacy 1946). What is original: the panel as a pen that writes the spectrogram at the right edge, so a whistler falls in front of you while its own past scrolls away, and the picture as a pile of independent random events (strokes and their trains, echoes, noses, chorus episodes, hiss, carrier keys) that never line up twice.
// Round:   244
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Storm=0..4, Dispersion=-1..1, Chorus=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel and opens on cyan: the whistlers run from deep blue through cyan and green to pale yellow, the sferic spikes go near white, the chorus has its own tint a third of the wheel away (magenta at the opening), and the hiss is a faint veil of the first colour.
// Knob 2: Storm. 0 to 4, opening at 2: how many lightning strokes a second. At 0 a stroke comes every ten seconds or so and the panel is mostly hiss and one long whistler; at 2 about one every two seconds with a few echoing at a time; at 4 a thunderstorm of up to one and a half a second, whistler trains piled over each other.
// Knob 3: Dispersion. -1 to 1, opening at 0: how much plasma the signal crosses, the D in t = D / sqrt(f). At -1 the whistlers are short and steep and hug their spike (D 0.37); at 0 they cross a third of the panel (D 0.85); at 1 they are long and drawn out, flat at the bottom, and the echoes slide off the right side (D 1.95).
// Knob 4: Chorus. -1 to 1, opening at 0.06 in the middle: how much of the picture is rising tones in a second tint. At -1 almost none; in the middle a group of rising dashes follows some strokes; at 1 chorus episodes arrive on their own and often, and the panel fills with short rising strokes.

const W = 64, H = 128;
const { floor, ceil, min, max, abs, sin, sqrt, exp, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const VEL = 14;                  // LED a second the picture scrolls left; the 64 columns hold 4.6 s
const XN = 64;                   // the column of "now", the right edge, where the pen writes
const FMIN = 0.3, FMAX = 6.5;    // kHz at the bottom row and at the top row
const PRE = 40;                  // seconds run before the first frame
const DT = 1 / 30;
const ORD = [1, 3, 5, 7];        // the hop orders of the echoes
const MAXDEL = 9;                // a trace is not drawn where its delay passes this many seconds

// frequency of each row, its square root's inverse, and the row's height in 0..1 (0 at the foot)
const FT = new Float32Array(H), ISQ = new Float32Array(H), UH = new Float32Array(H);
for (let y = 0; y < H; y++) {
  UH[y] = 1 - (y + 0.5) / H;
  FT[y] = FMIN + (FMAX - FMIN) * UH[y];
  ISQ[y] = 1 / sqrt(FT[y]);
}
const DFROW = (FMAX - FMIN) / H; // kHz a row spans

// ---- noise ------------------------------------------------------------------
function hash(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---- colour -----------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}
const H0 = 0.5;                  // the hue the ramps are written round: cyan
// Whistlers and sferics: [intensity, hue offset, saturation, value]. Blue-black ground, teal veil, cyan, green, pale yellow, white.
const KEYA = [
  [0.0, 0.1, 0.9, 0.1],
  [0.04, 0.09, 0.9, 0.18],
  [0.12, 0.05, 0.9, 0.32],
  [0.3, 0.0, 0.85, 0.6],
  [0.55, -0.08, 0.75, 0.88],
  [0.8, -0.2, 0.6, 1.0],
  [1.05, -0.32, 0.38, 1.0],
  [1.35, -0.34, 0.1, 1.0],
];
// Chorus: its own tint a third of the wheel round from the cyan, black at zero so it adds to the ground.
const KEYB = [
  [0.0, 0.3, 0.9, 0.0],
  [0.05, 0.3, 0.9, 0.14],
  [0.2, 0.34, 0.85, 0.42],
  [0.5, 0.37, 0.75, 0.8],
  [0.85, 0.39, 0.45, 1.0],
  [1.35, 0.4, 0.15, 1.0],
];
const NL = 256, IMAX = 1.35;
function buildLut(lut, keys, hue) {
  const c = [0, 0, 0];
  for (let i = 0; i < NL; i++) {
    const u = (i / (NL - 1)) * IMAX;
    let k = 0;
    while (k < keys.length - 2 && u > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[k + 1], f = cl((u - a[0]) / (b[0] - a[0]), 0, 1);
    const h = H0 + mix(a[1], b[1], f) + hue, s = mix(a[2], b[2], f), v = mix(a[3], b[3], f);
    // a dim colour on the red, orange and yellow stretch of the wheel reads brown on the panel, so it is paled and lifted
    const hh = h - floor(h), br = (hh > 0.5 ? sstep(0.8, 0.95, hh) : 1 - sstep(0.16, 0.3, hh)) * (1 - v) * sstep(0.04, 0.3, v);
    hsv(h, s * (1 - 0.5 * br), min(1, v * (1 + 0.6 * br)), c, 0);
    lut[i * 3] = c[0];
    lut[i * 3 + 1] = c[1];
    lut[i * 3 + 2] = c[2];
  }
}

// a trace fades with the time since the pen wrote that point
const fadeAge = (a) => (a <= 0 ? 1 : 0.2 + 0.8 * exp(-a / 2.3));

// ---- state ------------------------------------------------------------------
export function setup(params) {
  const hiss = new Float32Array(H);
  for (let y = 0; y < H; y++) hiss[y] = sstep(0.0, 0.1, UH[y]) * (1 - sstep(0.3, 0.46, UH[y]));
  params.st = {
    k: [0, 2, 0, 0.06], init: false, t: -PRE, acc: 0, hue: -9,
    ev: [], ch: [], cr: [],
    zs: 0, zc: 0, zk: 0,          // slow drifts of the storm, the chorus and the carriers
    lut: new Float32Array(NL * 3), lutB: new Float32Array(NL * 3),
    Fw: new Float32Array(W * H), Fc: new Float32Array(W * H),
    XS: new Float32Array(H), SL: new Float32Array(H), hissBand: hiss,
    seed1: floor(rnd() * 1e6), seed2: floor(rnd() * 1e6), seed3: floor(rnd() * 1e6),
    lam: 0.5, D: 0.85, cho: 0.5,
  };
  return params.st;
}

function derive(st) {
  const kv = st.k;
  st.lam = 0.07 + 1.45 * pow(cl(kv[1] / 4, 0, 1), 1.5);
  st.D = 0.85 * pow(2, 1.4 * cl(kv[2], -1, 1));
  st.cho = cl((kv[3] + 1) / 2, 0, 1);
}

// ---- the events -------------------------------------------------------------
// A smooth random curve over the rows: a value every four rows, joined by lines.
function smoothRows(lo, hi) {
  const out = new Float32Array(H), n = H / 4 + 2, v = [];
  for (let i = 0; i < n; i++) v.push(lo + (hi - lo) * rnd());
  for (let y = 0; y < H; y++) {
    const p = y / 4, i = floor(p), f = p - i;
    out[y] = mix(v[i], v[i + 1], f);
  }
  return out;
}

function spawnStroke(st, t0, base) {
  const yc = 48 + 36 * rnd(), sp = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const d = (y - yc) / 30;
    sp[y] = 0.1 + 0.9 * exp(-d * d);
  }
  const r = rnd();
  const e = {
    t0,
    dr: base ? base.dr * exp(0.06 * gauss()) : exp(0.3 * gauss()),
    amp: base ? base.amp * (0.8 + 0.4 * rnd()) : 0.5 + 0.75 * pow(rnd(), 1.5),
    q: 0.3 + 0.35 * rnd(),
    nh: r < 0.35 ? 0 : r < 0.65 ? 1 : r < 0.85 ? 2 : 3,
    fn: base ? base.fn : rnd() < 0.3 ? 2 + 3.5 * rnd() : 0,   // nose frequency in kHz, 0 for none
    sp, ck: smoothRows(0.08, 0.7), sig: 0.95 + 0.25 * rnd(),
    ulo: 0.02 + 0.25 * rnd(), uhi: 0.6 + 0.4 * rnd(),
    w1: 5 + 6 * rnd(), p1: rnd() * 6.3,
  };
  st.ev.push(e);
  return e;
}

// A group of rising tones, each a short line climbing at r kHz a second.
function spawnEpisode(st, t, f0) {
  const m = 3 + floor(rnd() * 5), r = 2 + 3.5 * rnd(), gap = 0.55 + 0.45 * rnd();
  let f = f0, tt = t;
  for (let i = 0; i < m; i++) {
    const dur = 0.24 + 0.26 * rnd();
    st.ch.push({ t0: tt, f0: f, r: r * exp(0.12 * gauss()), dur, amp: 0.5 + 0.4 * rnd(), sig: 1.0 });
    tt += gap * (0.75 + 0.5 * rnd());
    f = cl(f + (rnd() - 0.4) * 0.6, 0.5, FMAX - 1.6);
  }
}

function spawnCarrier(st, t) {
  const dur = 2 + 6 * rnd();
  st.cr.push({ t0: t, t1: t + dur, y: 10 + 108 * rnd(), amp: 0.1 + 0.1 * rnd(), p: rnd() * 6.3 });
}

function step(st, dt) {
  const T = (st.t += dt), c = st.cho;
  // the slow drifts: stationary, so the storm comes and goes for as long as it runs
  st.zs += (-st.zs / 14) * dt + 0.265 * sqrt(dt) * gauss();
  st.zc += (-st.zc / 20) * dt + 0.22 * sqrt(dt) * gauss();
  st.zk += (-st.zk / 10) * dt + 0.3 * sqrt(dt) * gauss();
  if (rnd() < st.lam * exp(0.8 * st.zs) * dt) {
    const e = spawnStroke(st, T, null);
    // a train: more strokes of nearly the same D a few tenths of a second apart
    if (rnd() < 0.28) {
      let tt = T;
      for (let n = 1 + floor(rnd() * 3); n > 0; n--) {
        tt += 0.3 + 0.35 * rnd();
        spawnStroke(st, tt, e);
      }
    }
    // chorus likes to come after a whistler
    if (rnd() < 0.08 + 0.45 * c) spawnEpisode(st, T + 0.7 + 1.8 * rnd(), 0.9 + 2.4 * rnd());
  }
  if (rnd() < (0.015 + 0.24 * c * c) * exp(0.6 * st.zc) * dt) spawnEpisode(st, T + 0.2, 0.7 + 2.8 * rnd());
  if (rnd() < 0.3 * exp(0.5 * st.zk) * dt && st.cr.length < 6) spawnCarrier(st, T);
  // what has left the left edge goes
  const ev = st.ev, ch = st.ch, cr = st.cr;
  let j = 0;
  for (let i = 0; i < ev.length; i++) if (T - ev[i].t0 < MAXDEL + 5.8) ev[j++] = ev[i];
  ev.length = min(j, 60);
  j = 0;
  for (let i = 0; i < ch.length; i++) if (T - ch[i].t0 < ch[i].dur + 5.8) ch[j++] = ch[i];
  ch.length = min(j, 90);
  j = 0;
  for (let i = 0; i < cr.length; i++) if (T - cr[i].t1 < 5.8) cr[j++] = cr[i];
  cr.length = j;
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  derive(st);
  if (!st.init) {
    st.init = true;
    st.zs = gauss() * 0.6;
    st.zc = gauss() * 0.6;
    for (let i = 0; i < PRE / DT; i++) step(st, DT);
  }
  st.acc += cl(dt || 0, 0, 0.1);
  while (st.acc >= DT) {
    st.acc -= DT;
    step(st, DT);
  }
}

// ---- drawing the events into the two fields -----------------------------------
// One row of a trace: a glow of perpendicular width sig about the line through (x, y) of slope s columns a row.
function stamp(F, y, x, s, sig, a) {
  const sx = sig * sqrt(1 + s * s), half = min(26, ceil(3 * sx));
  const x0 = max(0, floor(x - half)), x1 = min(W - 1, floor(x + half)), k = -1 / (2 * sx * sx), o = y * W;
  for (let xx = x0; xx <= x1; xx++) {
    const d = xx + 0.5 - x;
    F[o + xx] += a * exp(d * d * k);
  }
}

function drawStroke(st, e) {
  const T = st.t, age0 = T - e.t0, F = st.Fw, XS = st.XS, D = st.D * e.dr;
  if (age0 < 0) return;
  // the sferic: a hard core and a crackle that trails to the right
  const xs0 = XN - age0 * VEL;
  if (xs0 > -18) {
    const fa = fadeAge(age0) * e.amp, c0 = max(0, floor(xs0 - 3)), c1 = min(W - 1, floor(xs0 + 18));
    for (let xx = c0; xx <= c1; xx++) {
      const dx = xx + 0.5 - xs0, core = exp((-dx * dx) / (2 * e.sig * e.sig)) * 0.95, tail = dx > 0 ? 0.5 * exp(-dx / 3.2) : 0;
      if (core + tail < 0.01) continue;
      for (let y = 0; y < H; y++) F[y * W + xx] += fa * (e.sp[y] * core + e.ck[y] * tail);
    }
  }
  // the whistler and its echoes
  const fm = e.fn > 0 ? 4 * e.fn : 0;
  for (let k = 0; k <= e.nh; k++) {
    const n = ORD[k], ak = e.amp * pow(e.q, k);
    if (ak < 0.04 || age0 < n * D * ISQ[0] - 0.05) break;
    const nD = n * D;
    for (let y = 0; y < H; y++) {
      let dl = nD * ISQ[y];
      if (fm > 0) {
        const r = FT[y] / fm;
        dl = r > 0.95 ? 99 : dl * pow(1 - r, -1.5);
      }
      XS[y] = dl > MAXDEL ? 999 : XN - (age0 - dl) * VEL;
    }
    const sig = e.sig * (1 + 0.12 * k);
    for (let y = 0; y < H; y++) {
      const x = XS[y];
      if (x > XN + 3 || x < -12) continue;
      const ya = y > 0 ? y - 1 : 0, yb = y < H - 1 ? y + 1 : H - 1;
      let xa = XS[ya], xb = XS[yb];
      if (xa > 900) xa = x;
      if (xb > 900) xb = x;
      const s = cl((xb - xa) / (yb - ya), -8, 8);
      const u = UH[y], dl = max(0, age0 - (XN - x) / VEL);
      const edge = sstep(e.ulo - 0.1, e.ulo + 0.1, u) * (1 - sstep(e.uhi - 0.12, e.uhi + 0.12, u));
      const a = 1.7 * ak * edge * (0.78 + 0.22 * sin(u * e.w1 + e.p1)) * exp(-dl / 4) * fadeAge((XN - x) / VEL);
      if (a < 0.012) continue;
      stamp(F, y, x, s, sig, a);
    }
  }
}

function drawChorus(st, c) {
  const T = st.t, age0 = T - c.t0, F = st.Fc;
  if (age0 < 0) return;
  const f1 = c.f0 + c.r * c.dur;
  // rows whose frequency lies between f0 and f1
  const yHi = max(0, floor((1 - (f1 - FMIN) / (FMAX - FMIN)) * H - 0.5)), yLo = min(H - 1, ceil((1 - (c.f0 - FMIN) / (FMAX - FMIN)) * H - 0.5));
  const s = (-VEL * DFROW) / c.r;
  for (let y = yHi; y <= yLo; y++) {
    const tau = (FT[y] - c.f0) / c.r;
    if (tau < 0 || tau > c.dur || tau > age0) continue;
    const x = XN - (age0 - tau) * VEL;
    if (x < -12) continue;
    const env = pow(sin((PI * tau) / c.dur), 0.7);
    stamp(F, y, x, s, c.sig, c.amp * env * fadeAge(age0 - tau));
  }
}

function drawCarrier(st, c) {
  const T = st.t, F = st.Fw;
  if (T < c.t0) return;
  const xa = XN - (T - c.t0) * VEL, xb = T < c.t1 ? XN + 2 : XN - (T - c.t1) * VEL;
  const x0 = max(0, floor(xa - 2)), x1 = min(W - 1, ceil(xb + 2));
  for (let y = max(0, floor(c.y - 3)); y <= min(H - 1, ceil(c.y + 3)); y++) {
    const dy = y + 0.5 - c.y, g = exp(-(dy * dy) / 2.2);
    if (g < 0.02) continue;
    for (let xx = x0; xx <= x1; xx++) {
      const x = xx + 0.5, cov = sstep(xa - 1.2, xa + 1.2, x) * (1 - sstep(xb - 1.2, xb + 1.2, x));
      if (cov <= 0) continue;
      F[y * W + xx] += c.amp * g * cov * (0.75 + 0.25 * sin(x * 0.31 + c.p)) * fadeAge((XN - x) / VEL);
    }
  }
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  if (!st.init) update(0, { knobValues: st.k }, params);
  const hue = st.k[0];
  if (abs(hue - st.hue) > 1e-4) {
    st.hue = hue;
    buildLut(st.lut, KEYA, hue);
    buildLut(st.lutB, KEYB, hue);
  }
  const Fw = st.Fw, Fc = st.Fc, lut = st.lut, lutB = st.lutB, band = st.hissBand, T = st.t;
  Fw.fill(0);
  Fc.fill(0);
  for (const e of st.ev) drawStroke(st, e);
  for (const c of st.ch) drawChorus(st, c);
  for (const c of st.cr) drawCarrier(st, c);
  const scroll = T * VEL, ls = (NL - 1) / IMAX;
  for (let y = 0; y < H; y++) {
    const b = band[y], sy = y / 6;
    for (let xx = 0; xx < W; xx++) {
      const sx = xx + scroll;
      let hs = 0;
      if (b > 0.001) {
        const n1 = vnoise(sx / 11, sy, st.seed1), n2 = vnoise(sx / 150, y / 40, st.seed2);
        hs = b * (0.1 + 0.9 * n1 * n1) * (0.15 + 0.85 * n2) * 0.2;
      }
      const i = y * W + xx;
      const iw = IMAX * (1 - exp(-1.1 * (Fw[i] + hs + 0.012 + 0.02 * UH[y])));
      const ic = IMAX * (1 - exp(-1.1 * Fc[i]));
      const a = floor(iw * ls + 0.5) * 3, bb = floor(ic * ls + 0.5) * 3;
      display.setPixel(xx, y, min(255, lut[a] + lutB[bb]) | 0, min(255, lut[a + 1] + lutB[bb + 1]) | 0, min(255, lut[a + 2] + lutB[bb + 2]) | 0);
    }
  }
}
