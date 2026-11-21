// ===== Patternflow pattern =====
// Title:   Radargram
// Family:  georadar
// Idea:    A ground-penetrating radar section of the last 64 traces of a cart's track, two-way travel time running down the 128 rows and the whole picture sliding left as the cart rolls on, in which soil layers bend across the panel as bands of amber and teal stripes, a fault steps them by 3 to 8 rows now and then and a sand lens pinches out between two of them, while each pipe, boulder, void and run of rebar the cart passes draws its own hyperbola, a pipe with a ringing tail and a void in reversed colours, over ground that is made from the track coordinate and never repeats.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ground-penetrating radar as a sounding of the ground by pulse echoes along a line (David Daniels, Ground Penetrating Radar, 2004), the Ricker wavelet (Norman Ricker, 1953), the two echoes of a thin bed that tune and fade as it thins (M. B. Widess, 1973), the diffraction hyperbola of a point reflector in a time section; pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cart=0..4, Moisture=0.1..0.6, Antenna=-1..1
//
// Knob 1: Hue. Turns both signs of the echo round the wheel together. At 0 the positive lobes are amber and the negative ones teal. At 0.5 they are blue and red, and at 1 they are back where they began.
// Knob 2: Cart. How fast the cart is pushed along the track, 2.5 traces a second for each unit of the knob, with a wobble of up to 20 percent. At 0 it stands and the section stays where it is, with only the arrival times swaying by up to half a row and the gain by 6.5 percent. At 2, where it opens, it is 5 traces a second, so the 64 traces are all new after 13 s and a pipe takes about 8 s to cross the panel. At 4 it is 10 traces a second.
// Knob 3: Moisture. The share of water in the soil, which sets how fast the wave travels and how much of it is lost. Where it opens, at 0.1, the time axis is stretched by 0.85 and a hyperbola's arms fall 0.85 rows for each LED they run out, so a pipe 30 rows down has fallen 10 rows by 29 LEDs from its apex. At 0.6 the axis is stretched by 1.15 and the arms fall 1.56 rows an LED, 10 rows in 18 LEDs, steep and narrow. The loss per row goes from 0.0137 to 0.0235, and an echo is weighted by exp(g t) with g = 0.0081 minus 0.39 of that loss, so one 100 rows down is 1.3 times its surface strength on dry soil and 0.9 on wet.
// Knob 4: Antenna. The centre frequency, as the centre period of the wavelet: 10.3 rows at -1, 6.6 where it opens at 0.06 and 4.5 at 1. The bright lobe of each echo is 0.45 of that, 4.6 rows, 3.0 and 2.0, with a darker lobe of the other sign either side. A fine antenna shows thin separate stripes and loses depth sooner, a low one fills the panel with wide soft bands that carry to the bottom (loss per row 0.0106 at -1 on dry soil, 0.0297 at 1 on wet soil).

// What the section is. A column of the panel is one trace, the echo of one radar pulse laid down against the two-way travel time t in rows
// (row 0 is the pulse leaving, row 127 the latest echo). The cart's track has a coordinate in LEDs, and the left edge of the panel stands
// at track coordinate 8216 + the distance rolled. Every column is worked out from its own coordinate, with no stored picture, so the
// ground scrolls a fraction of an LED at a time and a place looks the same each time it is passed. A sample is the sum of
//   a_j * ricker((t - t_j) / P)
// over the echoes j, where the Ricker wavelet is (1 - 2 q^2) exp(-q^2) with q = pi (t - t_j) / P and P its centre period in rows.
// It has a bright lobe and a darker lobe of the other sign on each side, so a reflector is a stack of three stripes. The echo is
// drawn for 0.95 P either side of t_j and not beyond.
// The first echo is the direct wave, at row 4.5 plus or minus 1.5 and 1.2 in strength, followed by the antenna ringing, three more
// wavelets 0.62 P apart at -0.45, 0.2 and -0.08 of it.
// The layers are 9 reflectors 17 to 189 rows down (unscaled, so 5 to 7 show), 18 to 25 rows apart, with signed coefficients of 0.4 to 0.72
// that swell and fade by 35 percent over 24 to 80 LEDs. The undulation they share is a sum of sines of 173 and 97 LEDs, 4.6 and 3 rows tall,
// and a slower one of 331 LEDs and 2 rows. Each layer takes 0.55 to 1.25 of it, so the spacing between layers breathes, and adds two
// sines of its own with wavelengths of 60 to 400 LEDs and 0.9 to 2.5 rows. Six weaker beds sit between them and come and go along the track.
// Everything below is made from hashes of a 72 LED chunk of track number, and each chunk keeps its own few things.
// A fault is in 45 percent of the chunks: a block of 70 to 240 LEDs raised or dropped by 3 to 8 rows over 4 LEDs at each edge,
// from a top 30 to 85 rows down, the edges leaning by up to half an LED a row so they are slanted planes. It moves only the layers
// below its top. A sand lens is in half of them: 60 to 180 LEDs long and up to 14 rows thick, one echo off its top and 0.85 of
// the opposite sign off its bottom. As it thins the two come together and cancel, which is the tuning of a thin bed, so it fades
// out before it ends.
// Diffractors average 2 a chunk: a pipe in 44 percent of them, a boulder in 20, a run of rebar in 22 and a void in 14. A reflector
// that is a point comes back as the hyperbola
//   t(x) = sqrt(t0^2 + (K (x - x0))^2),
// with K, the slope of its arms in rows an LED, set by the moisture. A pipe has its first wavelet and then -0.6 and 0.35 of it
// 6 to 10 rows later, the two walls of the pipe. A boulder has 0.55 of the slope, a strength of 0.75 against the pipe's 1.05, and arms 1.5 times as wide.
// Rebar is 8 to 12 small hyperbolas 7 to 9 LEDs apart, 12 to 24 rows down, with narrow arms. A void has a strength of 0.95 with the
// sign reversed, and a second echo 10 to 16 rows later at 0.7 of it, reversed again. Each hyperbola is weighted by t0 / t, the spreading of the wave, and by
// exp(-(dx / hw)^2), hw = 0.55 t0 / K + 6 LEDs, the beam of the antenna, so an arm dies out instead of crossing the panel.
// Every echo is weighted by exp(g t), g = 0.0081 - 0.39 a, with a the loss per row of the ground and the antenna, and the sum goes through
// a dead zone of 0.1 and 1 - exp(-1.9 x) to a colour whose zero is black. The clutter is a lattice of 5 LEDs by 3.5 rows, each point
// swelling and fading on its own period of 10 to 42 s. The soft smudges it makes mostly stay under the dead zone and show only
// where an echo is already there.

const W = 64, H = 128;
const { floor, ceil, sqrt, exp, sin, cos, PI, abs, min, max, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);
const TAU = 2 * PI;

// ---- hash of a world coordinate, so the ground is the same each time the cart passes
function h32(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const START = 8216; // track coordinate of the left edge when the cart is first seen
const CH = 72; // a chunk of track, in LEDs
const SEED = 7919;

// ---- the layers: unscaled two-way times in rows, signed reflection coefficients
const LAYER_T = [17, 35, 54, 74, 95, 117, 140, 164, 189];
const LAYER_A = [0.55, -0.4, 0.72, -0.42, 0.66, -0.7, 0.52, 0.66, -0.5];
const NL = LAYER_T.length;
// weaker beds between them, each present along stretches of the track only
const MINOR_T = [26, 45, 64, 85, 106, 128];
const MINOR_A = [0.42, -0.38, 0.44, -0.4, 0.42, -0.38];
const NM = MINOR_T.length;
const LAYER_C = [], LAYER_OWN = [];
for (let i = 0; i < NL; i++) {
  LAYER_C.push(0.55 + 0.7 * fr(0.618034 * (i + 1) + 0.21));
  const own = [];
  for (let j = 0; j < 2; j++) {
    own.push({
      amp: (0.9 + 1.6 * fr(0.7548777 * (i + 2) * (j + 1.3) + 0.11)) * (j ? 0.6 : 1),
      k: TAU / (60 + 340 * fr(0.5698403 * (i + 1) * (j + 1.7) + 0.37 * j)),
      ph: TAU * fr(0.3247180 * (i + 3) + 0.41 * j),
    });
  }
  LAYER_OWN.push(own);
}

// ---- the chunk generator: faults, lenses and diffractors from the hash alone
const chunkCache = new Map();
function genChunk(c) {
  const r = (k) => h32(c * 97 + k, SEED);
  const base = c * CH;
  const out = { dif: [], lens: [], fault: [] };
  const rn = r(0);
  const n = rn < 0.06 ? 0 : rn < 0.34 ? 1 : rn < 0.72 ? 2 : rn < 0.92 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const q = (k) => r(10 + i * 11 + k);
    const x0 = base + q(0) * CH;
    const ty = q(1);
    const t0 = 8 + 82 * pow(q(2), 1.35);
    const dsz = 6 + 4 * q(3); // pipe wall to wall, in rows
    if (ty < 0.44) {
      // a pipe: the wavelet, then 0.6 and 0.35 of it between the walls
      out.dif.push({ x0, t0, a: 1.05, km: 1, hw: 1, ech: [[0, 1], [dsz, -0.6], [2 * dsz, 0.35]] });
    } else if (ty < 0.64) {
      // a boulder: fainter, flatter and wider
      out.dif.push({ x0, t0: max(t0, 14), a: 0.75, km: 0.55, hw: 1.5, ech: [[0, 1]] });
    } else if (ty < 0.86) {
      // rebar: a run of small identical hyperbolas, a few LEDs apart, near the surface
      const cnt = 8 + floor(q(4) * 5), sp = 7 + q(5) * 2, tt = 12 + 12 * q(6);
      for (let k = 0; k < cnt; k++) out.dif.push({ x0: x0 + k * sp, t0: tt, a: 0.75, km: 1, hw: 0.55, ech: [[0, 1]] });
    } else {
      // a void: reversed polarity, the far wall coming back opposite again
      out.dif.push({ x0, t0: max(t0, 16), a: -0.95, km: 0.8, hw: 1.2, ech: [[0, 1], [dsz * 1.6, -0.7]] });
    }
  }
  if (r(1) < 0.5) {
    out.lens.push({ x0: base + r(2) * CH, hl: 30 + 60 * r(3), t0: 14 + 90 * r(4), th: 6 + 8 * r(5), a: (r(6) < 0.5 ? -1 : 1) * 0.55, ph: TAU * r(7) });
  }
  if (r(8) < 0.45) {
    out.fault.push({
      xa: base + r(9) * CH,
      len: 70 + 170 * r(10),
      d: (r(11) < 0.5 ? -1 : 1) * (3 + 5 * r(12)),
      top: 30 + 55 * r(13),
      slope: (r(14) - 0.5) * 1.0,
    });
  }
  return out;
}
function chunkAt(c) {
  let o = chunkCache.get(c);
  if (!o) {
    o = genChunk(c);
    chunkCache.set(c, o);
  }
  return o;
}

function makeState() {
  return {
    cart: START,
    tau: 0,
    knobs: [0, 2, 0.1, 0.06],
    col: new Float32Array(H),
    lat: new Float32Array(40 * 40),
    lut: new Uint8Array(1024 * 3),
    lutHue: -1,
    dif: [], lens: [], fault: [],
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0.1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.knobs = kn;
  S.tau += d;
  const t = S.tau;
  const jitter = 1 + 0.1 * sin(0.9 * t) + 0.06 * sin(2.3 * t + 1.1) + 0.04 * sin(4.1 * t + 2.4);
  S.cart += 2.5 * cl(kn[1], 0, 4) * jitter * d;
  const c0 = floor((S.cart - 200) / CH) - 1;
  for (const k of chunkCache.keys()) if (k < c0) chunkCache.delete(k);
}

// Palette: a signed value in -1..1 to a colour, zero near black, the hue added to both sides.
const POS = [[0, 0, 0, 0], [0.1, 40, 16, 0], [0.35, 196, 88, 6], [0.65, 255, 168, 36], [1, 255, 236, 186]];
const NEG = [[0, 0, 0, 0], [0.1, 0, 18, 30], [0.35, 0, 84, 124], [0.65, 18, 152, 196], [1, 150, 228, 242]];
function ramp(stops, v) {
  let k = 0;
  while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
  const a = stops[k], b = stops[k + 1], u = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
  return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
}
function hsvOf(r, g, b) {
  const mx = max(r, g, b), mn = min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h / 6, mx > 0 ? d / mx : 0, mx];
}
function rgbOf(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const r = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  const g = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  const b = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return [r, g, b];
}
function buildLut(S, hue) {
  for (let i = 0; i < 1024; i++) {
    const u = (i / 1023) * 2 - 1;
    const c = u >= 0 ? ramp(POS, u) : ramp(NEG, -u);
    const [h, s, v] = hsvOf(c[0], c[1], c[2]);
    const o = rgbOf(h + hue, s, v);
    S.lut[i * 3] = o[0];
    S.lut[i * 3 + 1] = o[1];
    S.lut[i * 3 + 2] = o[2];
  }
  S.lutHue = hue;
}

// A Ricker wavelet of centre period P rows, centred on row tj, added to the column.
function addW(col, tj, a, P) {
  const lo = max(0, ceil(tj - 0.95 * P)), hi = min(H - 1, floor(tj + 0.95 * P));
  for (let y = lo; y <= hi; y++) {
    const q = (PI * (y - tj)) / P, q2 = q * q;
    col[y] += a * (1 - 2 * q2) * exp(-q2);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const kn = S.knobs, hue = cl(kn[0], 0, 1);
  if (S.lutHue !== hue) buildLut(S, hue);
  const xm = cl((kn[2] - 0.1) / 0.5, 0, 1);
  const ant = cl(kn[3], -1, 1);
  const P = 6.8 * exp(-0.41 * ant);
  const s = 0.85 + 0.3 * xm; // the whole time axis stretches as the soil gets slower
  const K0 = 1.18 * s * s; // asymptote of a hyperbola, rows a LED
  const alpha = 0.019 * (0.6 + 1 * (0.1 + 0.5 * xm)) * pow(7 / P, 0.6);
  const gam = 0.0081 - 0.39 * alpha; // receiver gain minus loss, per row
  const cart = S.cart, tau = S.tau;
  const breathe = 1 + 0.04 * sin(0.7 * tau) + 0.025 * sin(1.9 * tau + 0.8);

  // the chunks that can reach the window
  const c0 = floor((cart - 200) / CH), c1 = floor((cart + W + 200) / CH);
  const dif = [], lens = [], fault = [];
  for (let c = c0; c <= c1; c++) {
    const ch = chunkAt(c);
    for (const d of ch.dif) dif.push(d);
    for (const l of ch.lens) lens.push(l);
    for (const f of ch.fault) fault.push(f);
  }

  // clutter lattice: 5 LEDs by 3.5 rows, each point breathing at its own slow rate
  const CX = 5, CY = 3.5, NY = ceil(H / CY) + 2;
  const ix0 = floor(cart / CX), nx = ceil(W / CX) + 2;
  const lat = S.lat;
  for (let a = 0; a < nx; a++)
    for (let b = 0; b < NY; b++) {
      const hh = h32((ix0 + a) * 131 + b, 4242), h2 = h32((ix0 + a) * 57 + b * 3, 99), h3 = h32(b * 11 + (ix0 + a), 7);
      lat[a * NY + b] = (hh * 2 - 1) * cos((0.15 + 0.5 * h2) * tau + TAU * h3);
    }

  const col = S.col, lut = S.lut;
  for (let x = 0; x < W; x++) {
    const xw = cart + x;
    col.fill(0);
    // the antenna never couples twice the same way: every arrival time sways by up to half a row
    const jit = 0.3 * sin(0.75 * tau + 0.17 * x) + 0.2 * sin(0.43 * tau - 0.11 * x + 1);
    // the direct wave through the air and the top of the ground, ringing
    const tw = 4.5 + jit + 0.6 * sin(xw / 41 + 1) + 0.35 * sin(xw / 17.3);
    const aw = 1.2 * (1 + 0.15 * sin(xw / 29));
    addW(col, tw, aw, P);
    addW(col, tw + 0.62 * P, -0.45 * aw, P);
    addW(col, tw + 1.24 * P, 0.2 * aw, P);
    addW(col, tw + 1.86 * P, -0.08 * aw, P);
    // the layers
    const sh1 = 4.6 * sin((TAU * xw) / 173 + 0.7) + 3 * sin((TAU * xw) / 97.3 + 2.1) + 2 * sin((TAU * xw) / 331 + 4.0);
    for (let i = 0; i < NL; i++) {
      let t = LAYER_T[i] + LAYER_C[i] * sh1;
      const o = LAYER_OWN[i];
      t += o[0].amp * sin(o[0].k * xw + o[0].ph) + o[1].amp * sin(o[1].k * xw + o[1].ph);
      for (let f = 0; f < fault.length; f++) {
        const F = fault[f];
        if (LAYER_T[i] <= F.top) continue;
        const xa = F.xa + F.slope * (LAYER_T[i] - F.top);
        t += F.d * (sm((xw - xa) / 4 + 0.5) - sm((xw - xa - F.len) / 4 + 0.5));
      }
      t = t * s + jit;
      const a = LAYER_A[i] * (1 + 0.35 * sin(xw / (24 + 6 * i) + i));
      addW(col, t, a * exp(gam * t), P);
    }
    // the weaker beds
    for (let i = 0; i < NM; i++) {
      const w = sm((sin(xw / (61 + 23 * i) + 1.7 * i) + 0.45) * 1.3);
      if (w <= 0.01) continue;
      const t = (MINOR_T[i] + 0.8 * sh1 + 2.4 * sin(xw / (29 + 5 * i) + i)) * s + jit;
      addW(col, t, MINOR_A[i] * w * exp(gam * t), P);
    }
    // lenses
    for (let l = 0; l < lens.length; l++) {
      const L = lens[l], dx = (xw - L.x0) / L.hl;
      if (dx <= -1 || dx >= 1) continue;
      const w = 1 - dx * dx, th = L.th * w * w;
      const tc = (L.t0 + 4 * sin(xw / 70 + L.ph) + 0.3 * sh1) * s + jit;
      addW(col, tc - 0.5 * th * s, L.a * exp(gam * tc), P);
      addW(col, tc + 0.5 * th * s, -0.85 * L.a * exp(gam * tc), P);
    }
    // diffractors
    for (let d = 0; d < dif.length; d++) {
      const D = dif[d], dx = xw - D.x0;
      const kk = K0 * D.km, hw = (0.55 * D.t0 * s) / kk * D.hw + 6;
      if (abs(dx) > 2.1 * hw) continue;
      const t0 = D.t0 * s;
      const t = sqrt(t0 * t0 + kk * kk * dx * dx) + jit;
      const env = exp(-(dx * dx) / (hw * hw)) * (t0 / t);
      for (let e = 0; e < D.ech.length; e++) addW(col, t + D.ech[e][0], D.a * D.ech[e][1] * env * exp(gam * t), P);
    }
    // clutter and the tone map
    const fx = fr(xw / CX), ax = floor(xw / CX) - ix0, sx = fx * fx * (3 - 2 * fx);
    for (let y = 0; y < H; y++) {
      const yy = y / CY, by = floor(yy), fy = yy - by, sy = fy * fy * (3 - 2 * fy);
      const l00 = lat[ax * NY + by], l10 = lat[(ax + 1) * NY + by], l01 = lat[ax * NY + by + 1], l11 = lat[(ax + 1) * NY + by + 1];
      const nz = l00 + (l10 - l00) * sx + (l01 - l00 + (l11 - l10 - l01 + l00) * sx) * sy;
      const v = (col[y] + 0.14 * nz) * breathe;
      const m = 1 - exp(-1.9 * max(0, abs(v) - 0.1));
      const u = v >= 0 ? m : -m;
      const li = ((u * 0.5 + 0.5) * 1023 + 0.5) | 0, o = li * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
