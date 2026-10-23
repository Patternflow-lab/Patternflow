// ===== Patternflow pattern =====
// Title:   Datamosh
// Family:  glitch
// Idea:    A video of a sunset and a spinning pinwheel plays with its keyframes dropped, so each frame only moves the last one's blocks along the picture's own motion and the image melts in blocky streams, swirls when the shot cuts, and comes back in partial slices now and then.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: datamoshing, after Takeshi Murata's Monster Movie (2005)
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Block=8..16, Mosh=0..1
//
// Knob 1: Hue. Turns every colour of the video round the colour wheel, opening on a magenta and orange sunset over a cyan grid.
// Knob 2: Speed. How fast the video runs, from a tenth of its speed to one and a half times, opening at full speed, where the ground nearest the viewer streams down about 45 LEDs a second.
// Knob 3: Block. The codec's block size, from 8 LEDs square to 16; sizes that do not divide the panel leave cut blocks along its right and bottom edges, as a codec pads a frame.
// Knob 4: Mosh. How long the decoder goes without a keyframe and how hard the motion pushes: a partial keyframe every 2 s of video at 0, every 12 s and twice the push at 1.
// Buttons: K1 tap drops a whole clean keyframe, which then melts.

const W = 64;
const H = 128;
const N = W * H;
// Blocks are 8 LEDs or more, so there are never more than 8 by 16 of them.
const MAXB = (W / 8) * (H / 8);
// The sunset's horizon row.
const HZ = 70;
const SHOT_A = 0;
const SHOT_B = 1;
// How far, in LEDs a second, the encoder's vectors stray over flat sky.
const NOISE = 3;

function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t, c) {
  return a[c] + (b[c] - a[c]) * t;
}

const SKY = [
  [0, [20, 4, 56]],
  [0.5, [120, 16, 124]],
  [0.84, [235, 52, 96]],
  [1, [255, 126, 48]],
];
const BLADES = [
  [255, 200, 0],
  [240, 0, 140],
  [0, 180, 240],
];

// The camera on the sunset sways slowly from side to side.
function pan(t) {
  return 9 * Math.sin(t * 0.45);
}

function panSpeed(t) {
  return 9 * 0.45 * Math.cos(t * 0.45);
}

// One LED of the clean video, written into out at o: shot A is a sunset over
// a grid running towards the viewer, shot B a pinwheel spinning on dark.
function source(shot, x, y, t, out, o) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (shot === SHOT_A) {
    const px = pan(t);
    if (y < HZ) {
      const v = y / HZ;
      let i = 0;
      while (i < SKY.length - 2 && v > SKY[i + 1][0]) i++;
      const f = (v - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
      r = mix(SKY[i][1], SKY[i + 1][1], f, 0);
      g = mix(SKY[i][1], SKY[i + 1][1], f, 1);
      b = mix(SKY[i][1], SKY[i + 1][1], f, 2);
      // The sun, cut into bands that thicken towards the horizon and slide down.
      const sx = 32 + px;
      const sy = HZ - 18;
      const dx = x - sx;
      const dy = y - sy;
      const R = 20;
      if (dx * dx + dy * dy < R * R) {
        const u = dy / R;
        const band = u > -0.15 && ((u * 5 - t * 0.6) % 1 + 1) % 1 < 0.15 + 0.35 * (u + 0.15);
        if (!band) {
          const k = (u + 1) / 2;
          r = 255;
          g = 236 - 180 * k;
          b = 70 + 80 * k;
        }
      }
    } else {
      // The ground: a dark plain, a cyan grid in perspective and the sun's
      // reflection broken into ripples under it.
      const d = y - HZ + 0.5;
      const z = 60 / d;
      const zl = z * 1.5 + t * 1.2;
      const fz = zl - Math.floor(zl);
      const wz = 0.9 * (60 / (d * d)) * 1.5 + 0.03;
      const wx = ((x - 32 - px) * z) / 60;
      const fx = wx * 1.4 - Math.floor(wx * 1.4);
      const wl = (0.6 * z) / 60 + 0.02;
      // Cross lines fade into the haze near the horizon; the lines running
      // away from the viewer reach it.
      const across = Math.max(0, 1 - Math.min(fz, 1 - fz) / wz) * smooth(5, 22, d);
      const away = Math.max(0, 1 - Math.min(fx, 1 - fx) / (wl * 1.4)) * smooth(0, 4, d);
      const L = Math.max(across, away);
      const glow = Math.max(0, 1 - d / 14);
      r = 10 + 110 * glow;
      g = 2 + 14 * glow;
      b = 26 + 64 * glow;
      const half = 15 * (1 - d / 50);
      if (half > 0 && Math.abs(x - 32 - px) < half && Math.sin(d * 1.3 - t * 3 + Math.sin(x * 0.5) * 0.6) > 0.1 - 0.5 * (d / 50)) {
        const f = 1 - d / 50;
        r = 255 * f + r * (1 - f);
        g = 110 * f + g * (1 - f);
        b = 70 * f + b * (1 - f);
      }
      r = r * (1 - L) + 30 * L;
      g = g * (1 - L) + 200 * L;
      b = b * (1 - L) + 240 * L;
    }
  } else {
    const dx = x - 32;
    const dy = y - 64;
    const d = Math.sqrt(dx * dx + dy * dy);
    r = 12;
    g = 8;
    b = 40;
    // Rings round the pinwheel, far apart and faint.
    if (((d / 9) % 1) < 0.18) {
      r = 50;
      g = 16;
      b = 100;
    }
    if (d < 26) {
      const a = Math.atan2(dy, dx) - t * 0.9;
      const s = Math.floor(((a / (Math.PI * 2)) % 1 + 1) % 1 * 6);
      const twist = d < 6 ? -1 : s % 3;
      if (twist >= 0) {
        const c = BLADES[twist];
        r = c[0];
        g = c[1];
        b = c[2];
      } else {
        r = 250;
        g = 250;
        b = 240;
      }
    }
  }
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

// The video's own motion at (x, y), in LEDs a second: what the encoder found
// when it still had keyframes to compare against.
function motion(shot, x, y, t, out) {
  if (shot === SHOT_A) {
    const pv = panSpeed(t);
    if (y < HZ) {
      out[0] = pv;
      // Inside the sun the bands slide down. The sky round it is one smooth
      // ramp, where the encoder's search finds nothing to hold on to.
      const dx = x - 32 - pan(t);
      const dy = y - (HZ - 18);
      const sun = dx * dx + dy * dy < 400;
      out[1] = sun && dy > -3 ? 2.4 : 0;
      out[2] = sun ? 0 : 1;
    } else {
      // Ground running at the camera: everything below the horizon spreads
      // away from the vanishing point, faster the nearer it is, and the
      // near ground swings further with the camera than the far.
      const d = y - HZ + 0.5;
      const k = (d * 1.2) / 60 / 1.5;
      out[0] = pv * (1 + d / 20) + (x - 32 - pan(t)) * k;
      out[1] = d * k;
      out[2] = 0;
    }
  } else {
    const dx = x - 32;
    const dy = y - 64;
    const d = Math.sqrt(dx * dx + dy * dy);
    // Only the pinwheel turns; the dark round it stands still.
    const w = d < 27 ? 0.9 : 0;
    out[0] = -dy * w;
    out[1] = dx * w;
    out[2] = 0;
  }
}

export function setup(params) {
  params.buf = new Float32Array(N * 3);
  params.old = new Float32Array(N * 3);
  params.ax = new Float32Array(MAXB);
  params.ay = new Float32Array(MAXB);
  params.v = new Float32Array(3);
  params.src = 0;
  params.shot = SHOT_A;
  params.cut = 3.5;
  params.nextKey = 2.0;
  params.size = 0;
  params.keys = 0;
  params.started = false;
  params.m = new Float32Array(9);
  params.hue = -1;
}

// Writes the clean video over a block, or over every block for a whole keyframe.
function paintBlock(P, x0, y0, bs) {
  const buf = P.buf;
  const x1 = Math.min(W, x0 + bs);
  const y1 = Math.min(H, y0 + bs);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) source(P.shot, x + 0.5, y + 0.5, P.src, buf, (y * W + x) * 3);
}

function keyframe(P, whole) {
  const bs = P.size;
  const rows = Math.ceil(H / bs);
  const cols = Math.ceil(W / bs);
  P.keys++;
  // A keyframe that arrives only partly: a band of slices comes through
  // with a few blocks missing, and a scatter of single blocks elsewhere.
  const r0 = Math.floor(hash(P.keys, 1) * rows * 0.7);
  const r1 = Math.min(rows, r0 + Math.max(2, Math.floor(rows * (0.2 + 0.25 * hash(P.keys, 2)))));
  for (let by = 0; by < rows; by++)
    for (let bx = 0; bx < cols; bx++) {
      const inBand = by >= r0 && by < r1;
      const p = hash(P.keys * 977 + bx, by);
      if (whole || (inBand && p < 0.85) || (!inBand && p < 0.04)) {
        paintBlock(P, bx * bs, by * bs, bs);
        P.ax[by * cols + bx] = 0;
        P.ay[by * cols + bx] = 0;
      }
    }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 8, 0.06];
  dt = Math.min(dt, 0.1);
  const P = params;
  const mosh = Math.max(0, Math.min(1, k[3]));
  const bs = Math.max(8, Math.min(16, Math.round(k[2])));
  const step = dt * Math.max(0.05, k[1]) * 0.5;
  if (bs !== P.size) {
    P.size = bs;
    P.ax.fill(0);
    P.ay.fill(0);
  }
  if (!P.started) {
    P.started = true;
    keyframe(P, true);
  }
  P.src += step;
  // The video cuts between its two shots, and the encoder's keyframe at the
  // cut is lost with the rest: the new shot's motion moves the old picture.
  if (P.src >= P.cut) {
    P.shot = P.shot === SHOT_A ? SHOT_B : SHOT_A;
    const len = P.shot === SHOT_A ? 6 : 4.5;
    P.cut = P.src + len;
    // The new shot's motion has most of the shot to work on the old picture
    // before a slice of the new one gets through.
    P.nextKey = Math.max(P.nextKey, P.src + len * 0.6);
  }
  if (input.btnPressed && input.btnPressed[0]) keyframe(P, true);
  else if (P.src >= P.nextKey) {
    keyframe(P, false);
    P.nextKey = P.src + 2 + 10 * mosh * mosh;
  }

  // Each block moves as one, by its own motion vector, rounded to whole
  // LEDs; what is left over carries to the next frame.
  const old = P.old;
  const buf = P.buf;
  old.set(buf);
  const cols = Math.ceil(W / bs);
  const rows = Math.ceil(H / bs);
  const gain = (1 + mosh) * step;
  const v = P.v;
  for (let by = 0; by < rows; by++)
    for (let bx = 0; bx < cols; bx++) {
      const b = by * cols + bx;
      const x0 = bx * bs;
      const y0 = by * bs;
      const x1 = Math.min(W, x0 + bs);
      const y1 = Math.min(H, y0 + bs);
      motion(P.shot, (x0 + x1) / 2, (y0 + y1) / 2, P.src, v);
      // The encoder's search was never exact: each block's vector strays a
      // little, and the stray changes every so often.
      const e = Math.floor(P.src * 1.5 + hash(b, 7) * 3);
      v[0] += (hash(b * 31 + e, 11) - 0.5) * NOISE * v[2];
      v[1] += (hash(b * 31 + e, 13) - 0.5) * NOISE * v[2];
      P.ax[b] += v[0] * gain;
      P.ay[b] += v[1] * gain;
      const mx = Math.trunc(P.ax[b]);
      const my = Math.trunc(P.ay[b]);
      if (mx === 0 && my === 0) continue;
      P.ax[b] -= mx;
      P.ay[b] -= my;
      for (let y = y0; y < y1; y++) {
        // Past the frame's edge the decoder repeats the edge LEDs.
        const sy = Math.max(0, Math.min(H - 1, y - my));
        for (let x = x0; x < x1; x++) {
          const sx = Math.max(0, Math.min(W - 1, x - mx));
          const o = (y * W + x) * 3;
          const s = (sy * W + sx) * 3;
          buf[o] = old[s];
          buf[o + 1] = old[s + 1];
          buf[o + 2] = old[s + 2];
        }
      }
    }

  if (k[0] !== P.hue) {
    // Hue turns colours round the grey axis.
    P.hue = k[0];
    const a = k[0] * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const q = (1 - c) / 3;
    const r3 = Math.sqrt(1 / 3) * s;
    const m = P.m;
    m[0] = c + q;
    m[1] = q - r3;
    m[2] = q + r3;
    m[3] = q + r3;
    m[4] = c + q;
    m[5] = q - r3;
    m[6] = q - r3;
    m[7] = q + r3;
    m[8] = c + q;
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  const m = params.m;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const r = buf[o];
      const g = buf[o + 1];
      const b = buf[o + 2];
      display.setPixel(
        x,
        y,
        Math.max(0, Math.min(255, r * m[0] + g * m[1] + b * m[2])),
        Math.max(0, Math.min(255, r * m[3] + g * m[4] + b * m[5])),
        Math.max(0, Math.min(255, r * m[6] + g * m[7] + b * m[8])),
      );
    }
}
