// ===== Patternflow pattern =====
// Title:   Ice Halo
// Family:  skyoptics
// Idea:    The sun seen through thin cirrus: a 22 degree ring red on the inside and blue-white on the outside, a sundog on either side of the sun trailing a white tail, a faint parhelic circle at the sun's height and a rainbow arc hung upside down near the zenith, all worked out from the refractive index of ice, and as the sun slowly climbs and sinks the sundogs draw away from the ring and the arc rises, thins and goes out.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: halos of hexagonal ice crystals (Auguste Bravais, 1847)
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sun=0..4, Ice=-1..1, Tilt=-1..1
//
// Knob 1: Hue. The colour of the sky, from day blue where the knob opens through teal and violet to evening pink; the halos keep the colours ice gives them whatever the sky is.
// Knob 2: Sun. Where the sun's height is centred, from 5 degrees at the bottom to 37 at the top, where it opens on 21, with a swing of up to 9 degrees either side that never repeats; low, the sundogs sit against the ring and the upside-down arc is wide, high, the sundogs draw out past the ring and the arc shrinks to the zenith and goes out.
// Knob 3: Ice. How much ice is in the sky: clear blue and the sun alone at the bottom, the ring and sundogs where it opens, and every halo at full strength under a veil of cirrus at the top.
// Knob 4: Tilt. How much the crystals wobble: at the bottom the ring edge is sharp and the sundog tails short, the parhelic circle a thin line; at the top the ring is thick and soft, the tails long and the circle broad.

const W = 64;
const H = 128;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
// The sun stands at LED (32, 80) and the camera is a fisheye, 0.95 LED to the degree,
// looking at the azimuth of the sun with its axis tilted up so that the sun stays there.
const SUN_Y = 80;
const PER_DEG = 0.95;
const SUN_DOWN = ((SUN_Y - 64) / PER_DEG) * D2R;
// Index of ice at red, green and blue. Ice spreads the three by 0.012; the
// ring and the sundogs spread them two and a half times wider, the 46 degree ring twice
// and the arc one and a half, so each shows its colours on 64 LEDs.
const NICE = [1.307, 1.313, 1.319];
const spread = (k) => NICE.map((n) => 1.313 + (n - 1.313) * k);
const N_RING = spread(2.4);
const N_46 = spread(2);
const N_ARC = spread(1.5);
const BINS = 240;
// The ring's outer edge runs out soonest in red and furthest in blue.
const OUTW = [0.8, 0.95, 1.1];
const OUTG = [0.95, 1, 1.15];

const { sin, cos, asin, acos, atan2, sqrt, exp, floor, min, max, abs, PI } = Math;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(a, b, v) {
  const u = clamp((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y) {
  const ix = floor(x);
  const iy = floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux;
  const b = hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux;
  return a * (1 - uy) + b * uy;
}

function hsv(h, s, v, out) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

// The sky's hue for knob 1: day blue, teal, violet, pink.
const STOPS = [0.6, 0.5, 0.74, 0.92];
function skyHue(k) {
  const x = clamp(k, 0, 1) * 3;
  const i = min(2, floor(x));
  return STOPS[i] + (STOPS[i + 1] - STOPS[i]) * (x - i);
}

export function setup(params) {
  params.t = 0;
  params.h = -1;
  params.cf = new Float32Array(W * H);
  params.cr = new Float32Array(W * H);
  params.cu = new Float32Array(W * H);
  params.ds = new Float32Array(W * H);
  params.bin = new Int16Array(W * H);
  const sx = cos(SUN_DOWN);
  const sz = -sin(SUN_DOWN);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const ix = x + 0.5 - 32;
      const iy = 64 - (y + 0.5);
      const r = sqrt(ix * ix + iy * iy);
      const phi = (r / PER_DEG) * D2R;
      const k = r > 1e-6 ? sin(phi) / r : 0;
      const cf = cos(phi);
      const cr = k * ix;
      const cu = k * iy;
      params.cf[i] = cf;
      params.cr[i] = cr;
      params.cu[i] = cu;
      params.ds[i] = acos(clamp(cf * sx + cu * sz, -1, 1)) * R2D;
      const th = atan2(iy - (64 - SUN_Y), ix);
      params.bin[i] = floor(((th + PI) / (2 * PI)) * BINS) % BINS;
    }
  params.mod22 = new Float32Array(BINS);
  params.mod46 = new Float32Array(BINS);
  params.deep = [0, 0, 0];
  params.pale = [0, 0, 0];
  params.veil = [0, 0, 0];
  params.d22 = [0, 0, 0];
  params.d46 = [0, 0, 0];
  params.dog = [0, 0, 0];
  params.cza = [0, 0, 0];
  params.czaFade = [0, 0, 0];
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const hue = skyHue(k[0]);
  // Teal reads brighter than blue at the same value, so it is turned down.
  const lum = 1 - 0.32 * exp(-((hue - 0.48) / 0.07) * ((hue - 0.48) / 0.07));
  hsv(hue, 0.95, 0.2 * lum, params.deep);
  hsv(hue, 0.5, 0.78 * lum, params.pale);
  hsv(hue, 0.18, 0.9 * lum, params.veil);
  const u = (clamp(k[2], -1, 1) + 1) / 2;
  params.ice = 1 - (1 - u) * (1 - u);
  params.tilt = (clamp(k[3], -1, 1) + 1) / 2;

  // The sun's height: the knob's centre and a swing that does not repeat.
  const centre = 5 + 8 * clamp(k[1], 0, 4);
  const swing = 4.6 * sin(0.0431 * t + 0.7) + 2.6 * sin(0.1117 * t + 2.2) + 1.6 * sin(0.2711 * t + 4.1);
  const target = clamp(centre + swing, 2.5, 40);
  if (params.h < 0) params.h = target;
  else params.h += (target - params.h) * (1 - exp(-dt / 1.2));
  const h = params.h;
  params.E0 = h * D2R + SUN_DOWN;

  const sh = sin(h * D2R);
  const ch = cos(h * D2R);
  params.ch = ch;
  for (let c = 0; c < 3; c++) {
    const n = N_RING[c];
    params.d22[c] = (2 * asin(n * 0.5) - PI / 3) * R2D;
    params.d46[c] = (2 * asin(N_46[c] * sin(PI / 4)) - PI / 2) * R2D;
    const np = sqrt(n * n - sh * sh) / ch;
    params.dog[c] = (2 * asin(min(1, np * 0.5)) - PI / 3) * R2D;
    const x = sqrt(max(0, N_ARC[c] * N_ARC[c] - ch * ch));
    params.cza[c] = asin(min(1, x)) * R2D;
    params.czaFade[c] = clamp((1 - x) / 0.05, 0, 1);
  }
  // Ice gathers and thins round the rings.
  for (let b = 0; b < BINS; b++) {
    const th = ((b + 0.5) / BINS) * 2 * PI;
    params.mod22[b] =
      0.98 + 0.2 * sin(th + 0.153 * t + 0.4) + 0.13 * sin(2 * th - 0.101 * t + 1.9) + 0.09 * sin(3 * th + 0.067 * t + 4.2) + 0.06 * sin(5 * th - 0.179 * t);
    params.mod46[b] = max(0, 0.3 + 0.6 * sin(th - 0.083 * t + 2.6) + 0.4 * sin(3 * th + 0.061 * t + 0.9) + 0.3 * sin(4 * th - 0.107 * t + 3.3));
  }
  params.sideL = 1 + 0.16 * sin(0.093 * t + 1.0) + 0.08 * sin(0.241 * t);
  params.sideR = 1 + 0.16 * sin(0.079 * t + 4.0) + 0.08 * sin(0.197 * t + 2.0);
}

export function draw(display, params) {
  const { cf, cr, cu, ds, bin, mod22, mod46, deep, pale, veil, d22, d46, dog, cza, czaFade, ice, tilt, t } = params;
  const h = params.h;
  if (h < 0) return;
  const cE = cos(params.E0);
  const sE = sin(params.E0);
  const ch = params.ch;
  // Widths in degrees, wider as the crystals wobble.
  const wIn = 1.25 + 1.4 * tilt;
  const wOut = 2.2 + 3.4 * tilt;
  const tail = 2 + 9 * tilt;
  const dogW = 1.5 + 1.2 * tilt;
  const dogV = 1.4 + 2 * tilt;
  const parW = 0.9 + 1.5 * tilt;
  const parA = 0.1 + 0.2 * tilt;
  const czaW = 1.4 + 1.3 * tilt;
  const amp = 1 - 0.35 * tilt;
  const czaBright = (0.55 + 0.45 * smooth(4, 16, h)) * ice;
  // Thicker and thinner ice drifts over the whole sky.
  const iceA = ice * amp * (0.84 + 0.17 * sin(0.061 * t + 1.3) + 0.1 * sin(0.157 * t + 0.4));
  // The ring is as strong as it gets by the time the knob opens; more ice brings the rest.
  const ringA = min(1, 1.5 * ice) * amp * (0.84 + 0.17 * sin(0.061 * t + 1.3) + 0.1 * sin(0.157 * t + 0.4));
  const col = [0, 0, 0];
  const halo = [0, 0, 0];
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const X = cf[i] * cE - cu[i] * sE;
      const Z = cf[i] * sE + cu[i] * cE;
      const Y = cr[i];
      const el = asin(clamp(Z, -1, 1)) * R2D;
      const az = abs(atan2(Y, X)) * R2D;
      const dsun = ds[i];

      // Cirrus, drifting: two octaves of stretched noise.
      const nx = x / 26 + 0.06 * t + y * 0.03;
      const ny = y / 6.5 - 0.09 * t;
      const w = vnoise(y / 30 + 0.02 * t, 3.1 + 0.013 * t) - 0.5;
      const cn = 0.6 * vnoise(nx + 2 * w, ny) + 0.4 * vnoise(nx * 2.3 - 0.1 * t, ny * 2.1 + 7 + 0.07 * t);
      const cir = smooth(0.36, 0.78, cn);

      // The sky: deep blue, paler towards the sun and the horizon.
      const gs = 1 / (1 + (dsun / 10) * (dsun / 10));
      const gh = 0.4 * exp(-max(el, 0) / 14);
      const g = min(1, 0.9 * gs + gh);
      const vl = min(0.85, cir * ice * (0.28 + 0.12 * gs) * 1.3);
      // Inside the ring the sky is darker: no light is bent into it.
      const inner = 1 - 0.3 * ice * smooth(8, 17, dsun) * (1 - smooth(20.5, 22.5, dsun));
      for (let c = 0; c < 3; c++) {
        const s = deep[c] + (pale[c] - deep[c]) * g;
        col[c] = (s + (veil[c] - s) * vl) * inner;
      }

      // Halos, one channel at a time.
      halo[0] = halo[1] = halo[2] = 0;
      const e = smooth(-1, 2, el);
      if (e > 0) {
        const dense = 0.8 + 0.4 * cir;
        const m22 = mod22[bin[i]] * ringA * dense;
        const m46 = mod46[bin[i]] * iceA * dense;
        const v = el - h;
        const near = abs(v) < 8;
        for (let c = 0; c < 3; c++) {
          let a = 0;
          // 22 degree ring: a sharp inner edge, a soft outer one.
          const x22 = dsun - d22[c];
          if (x22 > -4 && x22 < 26) a += 1.2 * OUTG[c] * m22 * (x22 < 0 ? exp(-(x22 / wIn) * (x22 / wIn)) : exp(-x22 / (wOut * OUTW[c])));
          // 46 degree ring.
          const x46 = dsun - d46[c];
          if (x46 > -6 && x46 < 22) {
            const wi = wIn * 1.6;
            a += 0.32 * m46 * (x46 < 0 ? exp(-(x46 / wi) * (x46 / wi)) : exp(-x46 / (wOut * 1.6)));
          }
          // Sundogs: a sharp inner edge, a bright core and a tail drawn out.
          if (near) {
            const uu = (az - dog[c]) * ch;
            let p = 0;
            if (uu < 0) p = exp(-(uu / dogW) * (uu / dogW));
            else p = 0.65 * exp(-(uu / (dogW * 1.4)) * (uu / (dogW * 1.4))) + 0.35 * exp(-uu / tail);
            a += 2.3 * iceA * p * exp(-(v / dogV) * (v / dogV)) * (Y < 0 ? params.sideL : params.sideR);
          }
          // The circumzenithal arc.
          const vz = el - cza[c];
          if (vz > -8 && vz < 8) {
            const win = exp(-(az / 46) * (az / 46));
            a += 0.9 * czaBright * czaFade[c] * win * exp(-(vz / czaW) * (vz / czaW));
          }
          halo[c] = a;
        }
        // The parhelic circle, a white line at the sun's height.
        if (near) {
          const k = (az - dog[1]) / 20;
          const a = parA * iceA * (0.35 + 0.65 * exp(-k * k)) * exp(-(v / parW) * (v / parW));
          halo[0] += a;
          halo[1] += a;
          halo[2] += a;
        }
        // The red edge of every halo is a red with some orange in it.
        halo[1] += 0.18 * halo[0];
        const top = max(halo[0], halo[1], halo[2]);
        const m = min(0.85, top * 0.9) * e;
        // The colours come pale, with a little white under each.
        const wh = 0.1 * (halo[0] + halo[1] + halo[2]);
        for (let c = 0; c < 3; c++) col[c] = col[c] * (1 - m) + (0.85 * halo[c] + wh) * e;
      }

      // The sun.
      const dl = dsun * PER_DEG;
      const disc = clamp((3.1 - dl) / 1.6, 0, 1);
      const bloom = 0.55 * exp(-dl / 3.2) + 0.14 * exp(-dl / 9);
      const sun = min(1.2, disc + bloom) * e;
      for (let c = 0; c < 3; c++) col[c] += sun;

      // Below the horizon only a dark edge.
      const a2 = smooth(-0.8, 1.2, el);
      for (let c = 0; c < 3; c++) {
        let v = col[c] * a2 + deep[c] * 0.2 * (1 - a2);
        if (v > 0.8) v = 0.8 + 0.2 * (1 - exp(-(v - 0.8) / 0.2));
        col[c] = v;
      }
      display.setPixel(x, y, clamp(col[0] * 255, 0, 255), clamp(col[1] * 255, 0, 255), clamp(col[2] * 255, 0, 255));
    }
}
