// ===== Patternflow pattern =====
// Title:   Kinetic Scales
// Family:  kinetic
// Idea:    The whole panel is a wall of small hinged metal scales hung in staggered brick rows, dim steel blue with a low sun lighting a band across it, and gusts sweep over the wall on slanting fronts and swing each scale on its top hinge, so that as a front passes a ribbon of scales turns to catch the sun and flashes gold, and behind it the wall rocks and settles.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: wind-driven kinetic facades, after Ned Kahn's Technorama Wind Veil (2002)
// Round:   200
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0..3, Scale=-1..1, Sun=0..1
//
// Knob 1: Hue. The metal the scales are cut from, and the colour the sun's glint takes on it: blued steel with gold glints where the knob opens, then silver with cold white ones, bronze with copper ones, a purple alloy with lilac ones, and steel again at the top.
// Knob 2: Wind. How hard it blows. At the bottom no gust comes and the scales hang still while only the sun's band creeps over the wall; where the knob opens a front crosses every few seconds and a breeze ripples the band between them, and at the top the fronts come more often, faster, and swing the scales much further.
// Knob 3: Scale. How big each scale is, from 4 LEDs across at the bottom to 8 at the top, in whole LEDs so the dark gap between scales stays one LED wide; it opens on 5.
// Knob 4: Sun. Where the sun starts from. It climbs and falls by itself over a couple of minutes; low, where the knob opens, the band of light sits low on the wall and is deep gold, and turned up the band rides higher and its glint goes paler.

const W = 64;
const H = 128;
const { sin, cos, exp, sqrt, abs, floor, min, max, pow, PI } = Math;

// Gusts come in four lanes. Each lane sends a front every so many seconds, about, and the lanes' periods share no common factor.
const LANES = 4;
const PERIOD = [5.2, 7.9, 12.3, 18.7];
const AMP = [0.65, 0.85, 1.0, 1.15];
const SPEED = [38, 31, 25, 19];
const FRONT = [22, 28, 36, 44];
// How far a scale curves from its top to its bottom and from side to side, as a slope.
const CURVE_Y = 0.3;
const CURVE_X = 0.12;
const SHINE = 90;

function hash3(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(x) {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
}

// The four metals, as the colour a scale shows face on. Steel blue at 0 and at 1.
const METAL = [
  [0.3, 0.5, 0.78],
  [0.78, 0.84, 0.9],
  [0.82, 0.62, 0.46],
  [0.6, 0.48, 0.86],
];

// And the colour the sun's glint takes on each of them: gold on steel, a cold white on silver, copper on bronze, lilac on the purple.
const GLINT = [
  [1, 0.64, 0.24],
  [0.92, 0.95, 1],
  [1, 0.58, 0.3],
  [0.86, 0.72, 1],
];

function metal(k, out, glint) {
  const f = clamp(k, 0, 1) * 4;
  const i = Math.min(3, floor(f));
  const u = smooth(f - i);
  const a = METAL[i];
  const b = METAL[(i + 1) % 4];
  const ga = GLINT[i];
  const gb = GLINT[(i + 1) % 4];
  for (let c = 0; c < 3; c++) {
    out[c] = a[c] + (b[c] - a[c]) * u;
    glint[c] = ga[c] + (gb[c] - ga[c]) * u;
  }
}

export function setup(params) {
  // The wall has been standing in the wind for a couple of minutes when the panel opens, with a front on its way across.
  params.t = 90;
  params.gusts = [];
  params.tilt = new Float32Array(80 * 70);
  params.yaw = new Float32Array(80 * 70);
  params.act = new Float32Array(80 * 70);
  params.off = new Float32Array(80 * 70);
  params.alb = [0, 0, 0];
  params.glint = [1, 0.7, 0.3];
}

// The fronts that have been sent and not yet died away, at time t.
function collect(params, t, w) {
  const list = params.gusts;
  list.length = 0;
  const strength = pow(w, 0.55);
  for (let j = 0; j < LANES; j++) {
    const P = PERIOD[j];
    const k1 = floor(t / P);
    for (let k = k1; k > k1 - 7; k--) {
      const T = (k + 0.7 * hash3(j, k, 1)) * P;
      if (T > t) continue;
      // The weather turns over a few minutes: spells with few gusts, spells with many, set when each gust is sent.
      const reach = 0.05 + 0.9 * w * (0.55 + 0.9 * (0.5 + 0.5 * sin(0.0237 * T + 1)));
      const on = clamp((reach - hash3(j, k, 2)) / 0.2, 0, 1);
      if (on <= 0) continue;
      // Fronts come mostly from the left and the top, some the other way round.
      const flip = hash3(j, k, 5) < 0.25 ? PI : 0;
      const beta = 0.55 + flip + 1.3 * (2 * hash3(j, k, 4) - 1);
      const dx = cos(beta);
      const dy = sin(beta);
      const speed = SPEED[j] * (0.78 + 0.45 * hash3(j, k, 6)) * (0.75 + 0.5 * w);
      const extent = abs(dx) * W + abs(dy) * H;
      const rise = (FRONT[j] * (0.8 + 0.5 * hash3(j, k, 7))) / speed;
      const decay = 0.55 + 0.7 * hash3(j, k, 8);
      const span = extent / speed + rise + 5 * decay;
      if (t - T > span) continue;
      // Along the front the gust is a patch, not the whole wall.
      const tmin = min(0, -dy * W) + min(0, dx * H);
      const text = abs(dy) * W + abs(dx) * H;
      const a = AMP[j] * (0.7 + 0.6 * hash3(j, k, 3)) * strength * on * (hash3(j, k, 9) < 0.78 ? 1 : -1);
      list.push({
        dx,
        dy,
        c0: min(0, dx * W) + min(0, dy * H),
        age: t - T,
        speed,
        rise,
        decay,
        omega: 2 * PI * (0.5 + 0.4 * hash3(j, k, 10)),
        a,
        tc: tmin + text * hash3(j, k, 11),
        lw: text * (0.4 + 0.5 * hash3(j, k, 12)),
        bend: 3 + 6 * hash3(j, k, 13),
        bk: 0.025 + 0.03 * hash3(j, k, 14),
        bp: 6.28 * hash3(j, k, 15),
        side: cos(beta + 1.2),
      });
    }
  }
}

// How far a gust has swung a scale tau seconds after its front reached it.
function swing(G, env, tau) {
  if (tau <= 0) return 0;
  return env * smooth(tau / G.rise) * exp(-tau / G.decay) * cos(G.omega * tau);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.wind = clamp(k[1] / 3, 0, 1);
  const sk = clamp(k[2], -1, 1);
  params.size = Math.round(sk < 0 ? 5 + 1.4 * sk : 5 + 3 * sk);
  params.sun = clamp(k[3], 0, 1);
  metal(k[0], params.alb, params.glint);
  collect(params, params.t, params.wind);
}

export function draw(display, params) {
  const t = params.t;
  const w = params.wind;
  const s = params.size;
  const sw = s;
  const sh = s;
  const half = floor(sw / 2);
  const rows = floor(H / sh) + 2;
  const cols = floor(W / sw) + 3;
  const { gusts, tilt, yaw, act, off, alb } = params;

  // The sun: its height, how far round it stands, and its colour.
  const elev = 0.08 + 1.0 * params.sun + 0.3 * (1 + sin(0.043 * t + 0.5)) + 0.16 * (1 + sin(0.0171 * t + 2.1)) + 0.1 * (1 + sin(0.0071 * t + 0.9));
  const az = 0.14 * sin(0.029 * t + 1.3) + 0.06 * sin(0.0113 * t);
  const ce = cos(elev);
  const Lx = sin(az) * ce;
  const Ly = sin(elev);
  const Lz = cos(az) * ce;
  const hn = 1 / sqrt(Lx * Lx + Ly * Ly + (Lz + 1) * (Lz + 1));
  const Hx = Lx * hn;
  const Hy = Ly * hn;
  const Hz = (Lz + 1) * hn;
  const warm = smooth((elev - 0.1) / 1.1);
  // The higher the sun, the whiter its glint.
  const sunR = params.glint[0] + (1 - params.glint[0]) * 0.3 * warm;
  const sunG = params.glint[1] + (1 - params.glint[1]) * 0.3 * warm;
  const sunB = params.glint[2] + (1 - params.glint[2]) * 0.3 * warm;

  // The sun is a patch of light on the wall, a band that climbs as the sun does and wanders as it swings.
  const rise = clamp((elev - 0.05) / 1.2, 0, 1);
  const bandY = 108 - 88 * rise;
  // How far a scale must swing from rest to catch the sun: more the higher it stands.
  const need = 0.33 + 0.15 * rise;
  const aim = Hy / Hz;
  // The band swells and thins as the sun climbs and falls.
  const thick = 110 + 90 * (0.5 + 0.5 * sin(0.0137 * t + 4));

  // Each scale: where its centre is, how far the gusts and the breeze have swung it, and how far it is from the sun's glint.
  for (let r = 0; r < rows; r++) {
    const xo = r & 1 ? half : 0;
    for (let c = 0; c < cols; c++) {
      const cx = c * sw - sw + xo + sw / 2;
      const cy = r * sh + sh / 2;
      // The wall hangs a little bowed and swells slowly.
      const rest = 0.2 - 0.38 * (cy / H) + 0.04 * sin(0.026 * cx + 0.012 * cy - 0.06 * t + 0.6);
      let p = rest;
      let q = 0.04 * sin(cx * 0.05 + 1);
      if (w > 0) {
        // The breeze between gusts.
        p += w * (0.12 * sin(0.13 * cx - 0.07 * cy - 1.3 * t) + 0.09 * sin(-0.05 * cx + 0.11 * cy - 0.83 * t + 2) + 0.07 * sin(0.08 * cx + 0.09 * cy - 1.9 * t + 4));
      }
      let moving = 0;
      for (let g = 0; g < gusts.length; g++) {
        const G = gusts[g];
        const tang = -G.dy * cx + G.dx * cy;
        const d = G.dx * cx + G.dy * cy - G.c0 + G.bend * sin(G.bk * tang + G.bp);
        const tau = G.age - d / G.speed;
        if (tau < 0) continue;
        const e = (tang - G.tc) / G.lw;
        const env = G.a * (0.3 + 0.7 * exp(-e * e));
        const now = swing(G, env, tau);
        p += now;
        q += 0.2 * now * G.side;
        moving += now - swing(G, env, tau - 0.06);
      }
      const y0 = bandY + 9 * sin(0.042 * cx + 0.05 * t) + 5 * sin(0.019 * cx - 0.031 * t + 1) + 0.32 * (cx - 32) * sin(0.0173 * t + 1.7);
      const lit = exp(-((cy - y0) * (cy - y0)) / thick);
      const i = r * 80 + c;
      tilt[i] = p;
      yaw[i] = q;
      act[i] = min(1, abs(moving) / (0.06 * 2));
      // What is added to the slope for the sun's glint alone: a scale in the band already faces the sun, one outside it is turned away.
      off[i] = aim - rest - need * (1 - lit);
    }
  }

  const albR = alb[0];
  const albG = alb[1];
  const albB = alb[2];
  for (let y = 0; y < H; y++) {
    const r = floor(y / sh);
    const py = y - r * sh;
    const xo = r & 1 ? half : 0;
    for (let x = 0; x < W; x++) {
      const xs = x - xo + sw;
      const c = floor(xs / sw);
      const px = xs - c * sw;
      const i = r * 80 + c;
      if (py === 0 || px === 0) {
        const dark = py === 0 ? 0.05 : 0.08;
        display.setPixel(x, y, albR * 255 * dark, albG * 255 * dark, albB * 255 * dark);
        continue;
      }
      const v = (py - 0.5) / sh;
      const u = (px - 0.5) / sw;
      const sy = tilt[i] + CURVE_Y * (0.5 - v);
      const sx = yaw[i] + CURVE_X * (u - 0.5);
      const inv = 1 / sqrt(1 + sx * sx + sy * sy);
      const nx = sx * inv;
      const ny = sy * inv;
      const nz = inv;
      const hemi = 0.5 + 0.5 * ny;
      const sky = 0.165 + 0.1 * hemi * hemi;
      const sheen = ny > 0.12 ? (ny - 0.12) * (ny - 0.12) * 2.6 : 0;
      const nl = max(0, nx * Lx + ny * Ly + nz * Lz);
      const dif = 0.02 * nl;
      const sg = sy + off[i];
      const ig = 1 / sqrt(1 + sx * sx + sg * sg);
      const nh = (sx * Hx + sg * Hy + Hz) * ig;
      const sp = nh > 0 ? pow(nh, SHINE) : 0;
      const ao = 0.7 + 0.3 * smooth(py / 3);
      const flare = 0.6 + 1.2 * act[i];
      let rr = (albR * (sky * 0.75 + dif * sunR) + sheen * 0.62) * ao;
      let gg = (albG * (sky * 0.9 + dif * sunG) + sheen * 0.8) * ao;
      let bb = (albB * (sky * 1 + dif * sunB) + sheen) * ao;
      const hot = sp * flare * (0.85 - 0.25 * warm);
      const white = max(0, hot - 0.7) * 0.25;
      // Where the sun's glint lies the blue of the wall gives way to it, so the two do not mix to grey.
      const keep = 1 - 0.85 * clamp(hot * 1.6, 0, 1);
      rr = rr * keep + hot * sunR + white;
      gg = gg * keep + hot * sunG + white;
      bb = bb * keep + hot * sunB + white;
      display.setPixel(
        x,
        y,
        255 * clamp(1 - exp(-1.7 * rr), 0, 1),
        255 * clamp(1 - exp(-1.7 * gg), 0, 1),
        255 * clamp(1 - exp(-1.7 * bb), 0, 1),
      );
    }
  }
}
