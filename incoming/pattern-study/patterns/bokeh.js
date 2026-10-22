// ===== Patternflow pattern =====
// Title:   Bokeh
// Family:  light
// Idea:    A city at night with the lens left out of focus, so every lamp turns into a disc the shape of the iris.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.2..4, Size=-1..1, Lights=40..90
//
// Knob 1: Hue. Turns the lights round the colour wheel, starting from sodium amber with a few red and blue ones among them.
// Knob 2: Pace. How fast the lights drift past and how quickly each one blooms and goes out.
// Knob 3: Size. How far out of focus they are, from small bright points to wide soft discs.
// Knob 4: Lights. How many are lit at once; big discs come in fewer.
// Buttons: K1 tap racks the focus through, so every disc closes to a point and opens out again.

const W = 64;
const H = 128;
const N = 160;

function hsvInto(out, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255;
  out[1] = (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255;
  out[2] = (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255;
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function spawn(params, i) {
  params.x[i] = Math.random() * (W + 12) - 6;
  params.y[i] = Math.random() * (H + 20) - 10;
  // Bigger discs are nearer lamps, so they also drift faster.
  params.size[i] = 0.65 + Math.random() * 0.75;
  const pick = Math.random();
  if (pick < 0.62) {
    params.off[i] = (Math.random() - 0.5) * 0.07;
    params.sat[i] = 0.82 + Math.random() * 0.18;
  } else if (pick < 0.8) {
    // Pale lamps, nearly white.
    params.off[i] = (Math.random() - 0.5) * 0.05;
    params.sat[i] = 0.25 + Math.random() * 0.25;
  } else if (pick < 0.92) {
    // Tail lights, a step towards red.
    params.off[i] = -0.07 - Math.random() * 0.03;
    params.sat[i] = 0.95;
  } else {
    // The odd cool one across the wheel.
    params.off[i] = 0.47 + Math.random() * 0.08;
    params.sat[i] = 0.75;
  }
  params.bright[i] = 0.65 + Math.random() * 0.35;
  params.life[i] = 1.8 + Math.random() * 1.6;
  params.age[i] = 0;
  params.jx[i] = (Math.random() - 0.5) * 2;
  params.jy[i] = (Math.random() - 0.5) * 2;
  params.on[i] = 1;
}

export function setup(params) {
  params.x = new Float32Array(N);
  params.y = new Float32Array(N);
  params.size = new Float32Array(N);
  params.off = new Float32Array(N);
  params.sat = new Float32Array(N);
  params.bright = new Float32Array(N);
  params.life = new Float32Array(N);
  params.age = new Float32Array(N);
  params.jx = new Float32Array(N);
  params.jy = new Float32Array(N);
  params.on = new Uint8Array(N);
  params.buf = new Float32Array(W * H * 3);
  params.col = new Float32Array(3);
  params.t = 0;
  params.rack = 0;
  params.started = false;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 40];
  params.hue = k[0];
  const pace = Math.max(0.05, k[1]);
  params.radius = 9 * Math.pow(1.6, k[2]);
  const want = Math.min(N, Math.round(k[3] * Math.pow(9 / params.radius, 1.8)));
  // A crowd dims each lamp a little, so the overlaps stay colours rather than a white wash.
  params.crowd = Math.min(1, Math.pow(45 / k[3], 0.6));
  dt = Math.min(dt, 0.1);
  const step = dt * pace;
  params.t += step;

  if (!params.started) {
    // The first frame finds each lamp somewhere in its life, so they never bloom together.
    for (let i = 0; i < want; i++) {
      spawn(params, i);
      params.age[i] = Math.random() * params.life[i];
    }
    params.started = true;
  }
  if (input.btnPressed && input.btnPressed[0]) params.rack = 1;
  params.rack = Math.max(0, params.rack - dt * 0.9);

  // The whole view pans slowly, the way a car window passes a street.
  const t = params.t;
  const ang = 0.6 * Math.sin(t * 0.11) + 0.3 * Math.sin(t * 0.23 + 2);
  const sp = 9;
  const dx = Math.cos(ang) * sp;
  const dy = Math.sin(ang) * sp * 0.6;
  for (let i = 0; i < N; i++) {
    if (!params.on[i]) {
      if (i < want) {
        spawn(params, i);
        // A lamp that K4 adds waits a moment, so a quick turn does not light a crowd at once.
        params.age[i] = -Math.random() * 1.5;
      }
      continue;
    }
    params.age[i] += step;
    if (params.age[i] >= params.life[i]) {
      if (i < want) spawn(params, i);
      else params.on[i] = 0;
      continue;
    }
    const s = params.size[i];
    params.x[i] += (dx * s + params.jx[i]) * step;
    params.y[i] += (dy * s + params.jy[i]) * step;
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  buf.fill(0);
  const col = params.col;
  // Racking focus: the discs close to points and open again, brighter as they shrink.
  const r0 = params.rack > 0 ? Math.sin(params.rack * Math.PI) : 0;
  const focus = 1 - 0.8 * r0;
  const gain = Math.min(4, 1 / (focus * focus));
  // A six-bladed iris, turned a little off square.
  const ic = Math.cos(0.3);
  const is = Math.sin(0.3);
  for (let i = 0; i < N; i++) {
    if (!params.on[i]) continue;
    const u = params.age[i] / params.life[i];
    const env = smooth(0, 0.2, u) * (1 - smooth(0.45, 1, u));
    if (env <= 0.01) continue;
    const r = params.radius * params.size[i] * (0.6 + 0.4 * smooth(0, 0.35, u) + 0.1 * smooth(0.5, 1, u)) * focus;
    hsvInto(col, params.hue + 0.075 + params.off[i], params.sat[i], 1);
    const level = params.bright[i] * env * gain * params.crowd;
    const cr = col[0] * level;
    const cg = col[1] * level;
    const cb = col[2] * level;
    const cx = params.x[i];
    const cy = params.y[i];
    // Soft edge never narrower than four and a half LEDs.
    const e = Math.max(0.3, 4.5 / r);
    const e0 = 1 - e * 0.5;
    const e1 = 1 + e * 0.5;
    // Near the panel's edge the lens barrel clips the disc into a cat's eye,
    // measured against the long side so the corners clip as much as before.
    const vx = ((cx - W / 2) / (H / 2)) * 0.45 * r;
    const vy = ((cy - H / 2) / (H / 2)) * 0.45 * r;
    const reach = r * e1 * 1.12 + 1;
    const x0 = Math.max(0, Math.floor(cx - reach));
    const x1 = Math.min(W - 1, Math.ceil(cx + reach));
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(H - 1, Math.ceil(cy + reach));
    const inv = 1 / r;
    const vinv = 1 / (r * 1.12);
    for (let y = y0; y <= y1; y++) {
      const py = y - cy;
      for (let x = x0; x <= x1; x++) {
        const px = x - cx;
        const round = Math.sqrt(px * px + py * py) * inv;
        if (round > e1 * 1.2) continue;
        const ax = Math.abs(px * ic - py * is);
        const ay = Math.abs(px * is + py * ic);
        const hex = Math.max(ay, ax * 0.866 + ay * 0.5) * inv * 1.05;
        let d = round * 0.6 + hex * 0.4;
        const qx = px + vx;
        const qy = py + vy;
        const clip = Math.sqrt(qx * qx + qy * qy) * vinv;
        if (clip > d) d = clip;
        if (d >= e1) continue;
        // Brighter towards the rim, the way a lens draws an out-of-focus light.
        const v = (1 - smooth(e0, e1, d)) * (0.64 + 0.36 * smooth(0.15, e0, d));
        const o = (y * W + x) * 3;
        buf[o] += cr * v;
        buf[o + 1] += cg * v;
        buf[o + 2] += cb * v;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, knee(buf[o]), knee(buf[o + 1]), knee(buf[o + 2]));
    }
  }
}

// Overlaps add up, and past 160 the light rolls off instead of clipping flat.
function knee(c) {
  if (c < 160) return c;
  return 160 + 95 * (1 - Math.exp(-(c - 160) / 95));
}
