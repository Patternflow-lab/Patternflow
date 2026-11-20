// ===== Patternflow pattern =====
// Title:   Metachronal Carpet
// Family:  cilia
// Idea:    A dense carpet of about two hundred cilia on a tilted lattice, seen from above under a dark-field lamp, each one beating a fast power stroke and a slow curled recovery a little later than its neighbour, so bands of cilia at the same stage of the beat sweep across the carpet like wind over wheat while the direction of the waves slowly wanders.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: metachronal coordination of cilia, after Sleigh, Cilia and Flagella / ciliary propulsion (1962) and Gray, Ciliary Movement (1928)
// Round:   199
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Beat=0..3, Lag=-1..1, Heading=0..1
//
// Knob 1: Hue. The colour of the strokes, from magenta-pink where the knob opens round the whole wheel; the ground behind them stays a deep indigo-violet, leaning a little away from them, and the tips run to white.
// Knob 2: Beat. How fast every cilium beats, from a slow third of a beat a second at the bottom to two and a half at the top; it opens on a little over one. Turning it never makes the carpet jump.
// Knob 3: Lag. How far each cilium is behind its neighbour. At the bottom they are nearly in step, with a wave 160 LEDs long, and the whole carpet nods together; it opens on waves 64 LEDs long, ten rows of cilia from crest to crest, and at the top the waves are tight, 30 LEDs or five rows.
// Knob 4: Heading. The direction the waves travel across the carpet, a full turn over the knob's range; a slow wander is added on top, so the waves never keep one course.

const W = 64;
const H = 128;
// Lattice of cilia: pitch in LEDs and tilt in radians. Cilia just off the panel are kept, so their strokes reach in.
const PITCH = 7.0;
const TILT = 0.31;
// Cilium length in LEDs and how many segments it is drawn in.
const LEN = 5.7;
const SEG = 5;
// Half the sweep of the power stroke, in radians (110 degrees in all), and where it points. The ends of the sweep keep well clear of the lattice rows, so neighbours never string into a line.
const HALF = 0.96;
const AXIS = 1.88;
// How much of the beat the power stroke takes.
const POWER = 0.35;
// Light comes from this side, in radians.
const LIGHT = -2.2;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p;
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p;
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// The signed distance round the colour wheel, in turns.
function wrap(x) {
  return x - Math.round(x);
}

function smooth(x) {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
}

function hash(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function setup(params) {
  params.t = 0;
  params.beat = 0;
  params.lag = null;
  params.head = null;
  // The lattice, hex-offset: every other row sits half a pitch along.
  const cx = W / 2;
  const cy = H / 2;
  const ax = Math.cos(TILT);
  const ay = Math.sin(TILT);
  const bx = Math.cos(TILT + Math.PI / 3);
  const by = Math.sin(TILT + Math.PI / 3);
  const cilia = [];
  for (let j = -30; j <= 30; j++)
    for (let i = -30; i <= 30; i++) {
      const x = cx + PITCH * (i * ax + j * bx);
      const y = cy + PITCH * (i * ay + j * by);
      if (x < -LEN || x > W + LEN || y < -LEN || y > H + LEN) continue;
      const n = cilia.length;
      cilia.push({
        x: x + (hash(n, 1) - 0.5) * 1.2,
        y: y + (hash(n, 2) - 0.5) * 1.2,
        dx: x - cx,
        dy: y - cy,
        turn: (hash(n, 3) - 0.5) * 0.8,
        slip: (hash(n, 4) - 0.5) * 1.1,
        len: LEN * (0.92 + 0.16 * hash(n, 5)),
      });
    }
  params.cilia = cilia;
  // The ground under the lamp: a little brighter in the middle.
  params.lamp = new Float32Array(W * H);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      const u = (x + 0.5 - 30) / 46;
      const v = (y + 0.5 - 58) / 84;
      params.lamp[i] = 0.7 + 0.3 * Math.exp(-(u * u + v * v) * 1.6);
    }
  params.cov = new Float32Array(W * H);
  params.win = new Float32Array(W * H);
  params.cr = new Float32Array(W * H);
  params.cg = new Float32Array(W * H);
  params.cb = new Float32Array(W * H);
  params.halo = new Float32Array(W * H);
  params.pow = new Float32Array(3);
  params.rec = new Float32Array(3);
  params.gnd = new Float32Array(3);
  params.hal = new Float32Array(3);
  params.wx = 1;
  params.wy = 0;
  params.k = 0.2;
  params.warp = 0;
  params.lift = 1;
  params.jit = 1;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // Beat: the phase is summed up, so a turn of the knob only changes how fast it runs from here on.
  const hz = 0.3 * Math.pow(2.5 / 0.3, clamp(k[1], 0, 3) / 3);
  params.beat += 2 * Math.PI * hz * (1 + 0.05 * Math.sin(0.37 * t) + 0.03 * Math.sin(0.91 * t + 1)) * dt;
  // Lag and heading follow the knobs with a short lag of their own, so the waves swing round rather than snap.
  const lagT = clamp(k[2], -1, 1);
  const headT = clamp(k[3], 0, 1) * 2 * Math.PI;
  if (params.lag === null) {
    params.lag = lagT;
    params.head = headT;
  } else {
    const a = 1 - Math.exp(-dt / 0.15);
    params.lag += (lagT - params.lag) * a;
    params.head += (headT - params.head) * a;
  }
  // Wavelength in LEDs along the wave: 160 where the cilia are nearly in step, 64 where the knob opens and 30, a little over four rows, where the lag is greatest. Any tighter and the lattice is too coarse to show a wave, only strokes at random.
  const lam = Math.exp(4.16 - 0.8375 * params.lag + 0.0775 * params.lag * params.lag);
  const breathe = 1 + 0.16 * Math.sin(0.134 * t + 0.7) + 0.09 * Math.sin(0.217 * t + 2.1);
  params.k = (2 * Math.PI) / (lam * breathe);
  // The jitter between neighbours is cut down as the waves tighten, or it would break the bands up.
  params.jit = clamp(lam / 80, 0.3, 1);
  // The course of the waves wanders: a slow drift and three sines whose periods do not line up.
  const wander = 0.026 * t + 0.8 * Math.sin(0.0476 * t + 0.4) + 0.45 * Math.sin(0.0793 * t + 2.2) + 0.25 * Math.sin(0.131 * t + 4.1);
  const psi = params.head + wander;
  params.wx = Math.cos(psi);
  params.wy = Math.sin(psi);
  params.warp = t;
  const hue = k[0] + 0.915;
  // Blue is the darkest colour on the panel, so where the strokes run through it they go paler, and the ground leans away from them.
  const bd = wrap(hue - 0.67);
  const bl = Math.exp(-(bd * bd) / 0.02);
  hsv(hue, 0.7 - 0.2 * bl, 1, params.pow);
  hsv(hue - 0.05, 0.88 - 0.22 * bl, 1, params.rec);
  // Dim orange and yellow read as brown on the panel, and dim violet sinks into the ground, so the curled recovery strokes are lifted where the strokes run through those colours.
  const wd = wrap(hue - 0.13);
  const vd = wrap(hue - 0.8);
  params.lift = 1 + 0.7 * Math.exp(-(wd * wd) / 0.035) + 0.55 * bl + 0.5 * Math.exp(-(vd * vd) / 0.012);
  // The ground stays a deep indigo-violet whatever the strokes do: it leans a little away from them and no further.
  const gh = 0.74 - 0.08 * Math.sin(2 * Math.PI * k[0]);
  hsv(gh, 0.9, 0.26, params.gnd);
  hsv(gh + 0.02, 0.75, 1, params.hal);
}

// Draw one segment of a cilium into the buffers.
function stroke(params, x0, y0, x1, y1, u0, u1, ang0, ang1, power, bright) {
  const { cov, win, cr, cg, cb, halo, pow, rec } = params;
  const M = 3;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - M));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + M));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - M));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + M));
  const sx = x1 - x0;
  const sy = y1 - y0;
  const sl = sx * sx + sy * sy;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x0;
      const py = y + 0.5 - y0;
      let t = (px * sx + py * sy) / sl;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = px - t * sx;
      const qy = py - t * sy;
      const d2 = qx * qx + qy * qy;
      if (d2 > 9) continue;
      const i = y * W + x;
      const u = u0 + (u1 - u0) * t;
      const d = Math.sqrt(d2);
      // The hair is a little fatter at the root than at the tip, and never thinner than two LEDs across the lit part.
      const r = 1.1 - 0.25 * u;
      const a = smooth((r + 0.55 - d) / 0.95);
      const h = 0.1 * bright * Math.exp(-d2 / 4);
      if (h > halo[i]) halo[i] = h;
      if (a <= 0) continue;
      // Light from one side: strokes that point away from the lamp shine, those that point at it are duller.
      const ang = ang0 + (ang1 - ang0) * t;
      const lit = 0.78 + 0.22 * Math.cos(ang - LIGHT);
      const score = a * bright * lit;
      if (score <= win[i]) continue;
      win[i] = score;
      cov[i] = a;
      // Colour: violet-leaning in the recovery, pink in the power stroke, a white-hot tip.
      const white = power * smooth((u - 0.55) / 0.45) * 0.85;
      const m = power;
      const br = Math.min(1, bright * lit * (1 + (params.lift - 1) * (1 - power)));
      const r0 = rec[0] + (pow[0] - rec[0]) * m;
      const g0 = rec[1] + (pow[1] - rec[1]) * m;
      const b0 = rec[2] + (pow[2] - rec[2]) * m;
      cr[i] = r0 * br + (1 - r0 * br) * white;
      cg[i] = g0 * br + (1 - g0 * br) * white;
      cb[i] = b0 * br + (1 - b0 * br) * white;
    }
}

export function draw(display, params) {
  const { cilia, cov, win, cr, cg, cb, halo, lamp, gnd, hal } = params;
  cov.fill(0);
  win.fill(0);
  halo.fill(0);
  const t = params.warp;
  const wx = params.wx;
  const wy = params.wy;
  const kk = params.k;
  const beat = params.beat;
  const px = [0, 0, 0, 0, 0, 0];
  const py = [0, 0, 0, 0, 0, 0];
  const pa = [0, 0, 0, 0, 0, 0];
  for (let n = 0; n < cilia.length; n++) {
    const c = cilia[n];
    // The phase of this cilium: the beat, less the lag along the wave, bent a little by a slow ripple so the bands have living edges.
    const ripple = params.jit * (0.6 * Math.sin(0.061 * c.x + 0.037 * c.y + 0.31 * t) + 0.4 * Math.sin(-0.043 * c.x + 0.071 * c.y - 0.23 * t + 1.7));
    const phase = beat - kk * (c.dx * wx + c.dy * wy) + c.slip * params.jit + ripple;
    let f = phase / (2 * Math.PI);
    f -= Math.floor(f);
    let theta;
    let bend;
    let power;
    let shrink = 1;
    if (f < POWER) {
      // The power stroke: quick, the hair nearly straight and trailing a little.
      const s = f / POWER;
      theta = -HALF + 2 * HALF * smooth(s);
      bend = -0.3 * Math.sin(Math.PI * s);
      power = Math.pow(Math.sin(Math.PI * s), 0.45);
    } else {
      // The recovery: slow, the hair curled and dragged back close to the ground.
      const s = (f - POWER) / (1 - POWER);
      theta = HALF - 2 * HALF * smooth(s);
      bend = 1.5 * Math.sin(Math.PI * s);
      power = 0;
      shrink = 1 - 0.22 * Math.sin(Math.PI * s);
    }
    const bright = 0.42 + 0.58 * power;
    const base = AXIS + c.turn + theta;
    let x = c.x;
    let y = c.y;
    px[0] = x;
    py[0] = y;
    const step = (c.len * shrink) / SEG;
    for (let j = 0; j < SEG; j++) {
      const um = (j + 0.5) / SEG;
      const a = base + bend * Math.pow(um, 1.5);
      pa[j] = a;
      x += step * Math.cos(a);
      y += step * Math.sin(a);
      px[j + 1] = x;
      py[j + 1] = y;
    }
    for (let j = 0; j < SEG; j++) stroke(params, px[j], py[j], px[j + 1], py[j + 1], j / SEG, (j + 1) / SEG, pa[j], pa[j], power, bright);
  }
  for (let i = 0; i < W * H; i++) {
    const g = lamp[i];
    const a = cov[i];
    const h = halo[i];
    let r = gnd[0] * g + hal[0] * h;
    let gr = gnd[1] * g + hal[1] * h;
    let b = gnd[2] * g + hal[2] * h;
    r = r * (1 - a) + cr[i] * a;
    gr = gr * (1 - a) + cg[i] * a;
    b = b * (1 - a) + cb[i] * a;
    display.setPixel(i % W, (i / W) | 0, clamp(r * 255, 0, 255), clamp(gr * 255, 0, 255), clamp(b * 255, 0, 255));
  }
}
