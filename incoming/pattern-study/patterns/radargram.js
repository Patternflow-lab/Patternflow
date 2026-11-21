// ===== Patternflow pattern =====
// Title:   Radargram
// Family:  georadar
// Idea:    A ground-penetrating radar section on a 64 by 128 panel, with the 64 traces of the cart's last stretch side by side and two-way travel time running down the 128 rows, in which gently bent soil layers show as long bands of amber and teal stripes, a fault now and then steps them by several rows, a lens of sand pinches out between two of them, and every pipe, boulder, void and run of rebar the cart passes draws its own hyperbola with a ringing tail, all of it sliding left as the cart rolls on over ground that is made from the track coordinate and never repeats.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ground-penetrating radar as a sounding of the ground by pulse echoes along a line (David Daniels, Ground Penetrating Radar, 2004), the Ricker wavelet (Norman Ricker, 1953), the diffraction hyperbola of a point reflector in a time section; pattern round 213
// Round:   215
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cart=0..4, Moisture=0.1..0.6, Antenna=-1..1
//
// Knob 1: Hue. placeholder
// Knob 2: Cart. placeholder
// Knob 3: Moisture. placeholder
// Knob 4: Antenna. placeholder

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

const START = 5512; // track coordinate of the left edge when the cart is first seen
const CH = 72; // a chunk of track, in LEDs
const SEED = 7919;

// ---- the layers: unscaled two-way times in rows, signed reflection coefficients
const LAYER_T = [17, 40, 63, 86, 108, 131, 155, 180];
const LAYER_A = [0.45, -0.34, 0.62, -0.38, 0.55, -0.6, 0.5, 0.55];
const NL = LAYER_T.length;
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
  const n = rn < 0.05 ? 0 : rn < 0.3 ? 1 : rn < 0.65 ? 2 : rn < 0.9 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const q = (k) => r(10 + i * 11 + k);
    const x0 = base + q(0) * CH;
    const ty = q(1);
    const t0 = 8 + 82 * pow(q(2), 1.35);
    const dsz = 6 + 4 * q(3); // pipe wall to wall, in rows
    if (ty < 0.4) {
      // a pipe: the wavelet, then 0.6 and 0.35 of it between the walls
      out.dif.push({ x0, t0, a: 1.25, km: 1, hw: 1, ech: [[0, 1], [dsz, -0.6], [2 * dsz, 0.35]] });
    } else if (ty < 0.58) {
      // a boulder: fainter, flatter and wider
      out.dif.push({ x0, t0: max(t0, 14), a: 0.75, km: 0.55, hw: 1.5, ech: [[0, 1]] });
    } else if (ty < 0.76) {
      // rebar: a run of small identical hyperbolas, a few LEDs apart, near the surface
      const cnt = 8 + floor(q(4) * 5), sp = 5 + q(5) * 2, tt = 12 + 12 * q(6);
      for (let k = 0; k < cnt; k++) out.dif.push({ x0: x0 + k * sp, t0: tt, a: 0.75, km: 1, hw: 0.55, ech: [[0, 1]] });
    } else {
      // a void: reversed polarity, the far wall coming back opposite again
      out.dif.push({ x0, t0: max(t0, 16), a: -1.15, km: 0.8, hw: 1.2, ech: [[0, 1], [dsz * 1.6, -0.7]] });
    }
  }
  if (r(1) < 0.4) {
    out.lens.push({ x0: base + r(2) * CH, hl: 45 + 65 * r(3), t0: 22 + 80 * r(4), th: 9 + 8 * r(5), a: (r(6) < 0.5 ? -1 : 1) * 0.6, ph: TAU * r(7) });
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
  const kn = S.knobs, hue = cl(kn[0], 0, 1) + 0.0;
  if (S.lutHue !== hue) buildLut(S, hue);
  const xm = cl((kn[2] - 0.1) / 0.5, 0, 1);
  const ant = cl(kn[3], -1, 1);
  const P = 7.2 * exp(-0.45 * ant);
  const s = 0.8 + 0.45 * xm; // the whole time axis stretches as the soil gets slower
  const K0 = 1.3 * s * s; // asymptote of a hyperbola, rows a LED
  const alpha = 0.019 * (0.6 + 1 * (0.1 + 0.5 * xm)) * pow(7 / P, 0.6);
  const gam = 0.021 - alpha; // receiver gain minus loss, per row
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
    // the direct wave through the air and the top of the ground, ringing
    const tw = 4.5 + 0.6 * sin(xw / 41 + 1) + 0.35 * sin(xw / 17.3);
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
      t *= s;
      const a = LAYER_A[i] * (1 + 0.35 * sin(xw / (24 + 6 * i) + i));
      addW(col, t, a * exp(gam * t), P);
    }
    // lenses
    for (let l = 0; l < lens.length; l++) {
      const L = lens[l], dx = (xw - L.x0) / L.hl;
      if (dx <= -1 || dx >= 1) continue;
      const w = 1 - dx * dx, th = L.th * w * w;
      const tc = (L.t0 + 4 * sin(xw / 70 + L.ph) + 0.3 * sh1) * s;
      addW(col, tc - 0.5 * th * s, L.a * exp(gam * tc), P);
      addW(col, tc + 0.5 * th * s, -0.85 * L.a * exp(gam * tc), P);
    }
    // diffractors
    for (let d = 0; d < dif.length; d++) {
      const D = dif[d], dx = xw - D.x0;
      const kk = K0 * D.km, hw = (0.95 * D.t0 * s) / kk * D.hw + 7;
      if (abs(dx) > 1.9 * hw) continue;
      const t0 = D.t0 * s;
      const t = sqrt(t0 * t0 + kk * kk * dx * dx);
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
      const m = 1 - exp(-2.5 * max(0, abs(v) - 0.04));
      const u = v >= 0 ? m : -m;
      const li = ((u * 0.5 + 0.5) * 1023 + 0.5) | 0, o = li * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
