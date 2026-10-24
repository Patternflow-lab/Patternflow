// ===== Patternflow pattern =====
// Title:   Sequins
// Family:  textile
// Idea:    A cushion of reversible flip sequins fills the panel under a lamp, silver scales in staggered rows, and an unseen fingertip strokes a heart, a star, a cat's face, a lightning bolt and a wave into it one after another, each sequin it passes turning edge on and over to its coloured side, until a flat palm sweeps the cushion silver again.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after reversible flip-sequin fabric
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Drawing=0..4, Lamp=0..1
//
// Knob 1: Hue. The colour on the back of the sequins: hot pink at 0, then on through red, gold, green and blue to violet, and pink again at 1.
// Knob 2: Speed. How fast the fingertip draws and the palm sweeps: at 2 a drawing takes about four seconds and a round seven; at 0.2 everything runs ten times slower.
// Knob 3: Drawing. What the fingertip draws next: a heart, a star, a cat's face, a lightning bolt or a wave, the rest following in that order. Turning it sweeps the cushion silver and starts the new one.
// Knob 4: Lamp. Where the lamp stands above the cushion, from upper left over the top to upper right: the highlight in every cupped sequin slides the other way, and the bright sheen across the cushion follows the lamp.
// Buttons: K1 tap sweeps the palm down the cushion now and the next drawing starts.

const W = 64;
const H = 128;
const N = W * H;
const NDRAW = 5;
const { min, max, sqrt, sin, cos, abs, floor, round, hypot, atan2, PI } = Math;
// Sequins sit 5 LEDs apart in a row and rows 3 LEDs apart, every other row
// shifted by half a sequin. Each is a disc a little wider than the spacing,
// so the row above covers the top of the row below.
const PX = 5;
const PY = 3;
const R = 2.8;
const NC = floor(W / PX) + 2;
// The round at Speed 2, in seconds: draw, hold, sweep, rest.
const TD = 4.2;
const TH = 1.8;
const TS = 0.8;
const TR = 0.3;
const TC = TD + TH + TS + TR;
// One sequin takes this long to turn over.
const FL = 0.16;
// How far the fingertip reaches, in LEDs.
const REACH = 4.2;
// The shading of one sequin. The part that shows sits low on the disc. The
// sequins are cupped, so the lamp lights the inside wall away from it, where a
// tight highlight sits. The rim nearest the lamp falls into shadow.
const SHOW = 0.5;
const SPOT = 0.45;
const SPOT2 = 0.15;
const RIM = 0.62;
// Each sequin is tipped a little its own way and catches more or less lamp.
const GLA = 0.35;
const GLB = 0.9;
// The coloured side reflects this share of what the silver side does.
const DIM = 0.24;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The sequins, listed bottom row first, so a later one lies over an earlier one.
const SX = [];
const SY = [];
const ROWS = floor(H / PY) + 1;
for (let k = ROWS - 1; k >= -1; k--)
  for (let j = -1; j < NC - 1; j++) {
    SX.push(j * PX + ((k & 1) ? 0 : PX / 2));
    SY.push(k * PY + 1.5);
  }
const NS = SX.length;

// The drawings, as shapes in LED coordinates: true inside.
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function heart(x, y) {
  const X = (x - 32) / 26;
  const Y = (35 - y) / 26;
  const a = X * X + Y * Y - 1;
  return a * a * a - X * X * Y * Y * Y <= 0;
}
function star(x, y) {
  const dx = x - 32;
  const dy = y - 66;
  const r = hypot(dx, dy);
  const t = (((atan2(dx, -dy) / (2 * PI)) * 5) % 1 + 1) % 1;
  const e = abs(t - 0.5) * 2;
  return r < 13 + 19 * e * e;
}
function cat(x, y) {
  const dx = x - 32;
  const dy = y - 66;
  const head = (dx / 22) ** 2 + (dy / 19) ** 2 < 1;
  const ears = inPoly(x, y, [11, 60, 13, 34, 28, 50]) || inPoly(x, y, [53, 60, 51, 34, 36, 50]);
  const eyes = ((abs(dx) - 8.5) / 4.6) ** 2 + ((dy + 3) / 5.5) ** 2 < 1;
  const nose = inPoly(x, y, [28.5, 71, 35.5, 71, 32, 76]);
  // Whiskers reach out past the cheeks, two to a side.
  const ax = abs(dx);
  const wh = ax > 21 && (abs(dy - 3 + (ax - 21) * 0.35) < 1.6 || abs(dy - 8 - (ax - 21) * 0.2) < 1.6);
  return ((head || ears) && !eyes && !nose) || wh;
}
const BOLT = [40, 0, 58, 0, 38, 48, 55, 48, 14, 128, 26, 66, 8, 66];
const bolt = (x, y) => inPoly(x, y, BOLT);
// The sea, with one wave standing up and curling over to the left.
function wave(x, y) {
  const sea = y > 77 + 2.5 * sin(x * 0.35 + 1);
  const back = x > 28 && y > 40 + (x - 28) ** 2 / 20;
  const curl = hypot(x - 29, y - 52) < 14 && hypot(x - 24, y - 60) > 6.5 && y < 64;
  const face = y > 56 && x > 31 - (y - 58) * 0.9 && x < 36;
  return sea || back || curl || face;
}
const DRAWINGS = [heart, star, cat, bolt, wave];
// How the fingertip colours each one in: the angle of its strokes.
const STROKE = [0.35, -0.5, 0, 1.25, 0.12];

export function setup(params) {
  params.sq = {
    p: new Float32Array(NS),
    on: new Uint8Array(NS),
    tOn: new Float32Array(NS),
    tOff: new Float32Array(NS),
    jit: new Float32Array(NS),
    r: new Float32Array(N),
    g: new Float32Array(N),
    b: new Float32Array(N),
    own: new Int32Array(N),
    started: false,
  };
  const S = params.sq;
  for (let i = 0; i < NS; i++) S.jit[i] = GLA + GLB * hash(i);
}

// The fingertip's path: strokes back and forth across the shape at an angle,
// a little different each time.
function load(S, d) {
  const fn = DRAWINGS[d];
  const a = STROKE[d] + (Math.random() - 0.5) * 0.3;
  const ux = cos(a);
  const uy = sin(a);
  const pts = [];
  let m = 0;
  for (let s = -76; s <= 76; s += 6, m++) {
    const segs = [];
    let t0 = null;
    for (let t = -76; t <= 77; t++) {
      const x = 32 - uy * s + ux * t;
      const y = 64 + ux * s + uy * t;
      const inside = t < 77 && x >= 0 && x < W && y >= 0 && y < H && fn(x, y);
      if (inside && t0 === null) t0 = t;
      if (!inside && t0 !== null) {
        segs.push(t0, t - 1);
        t0 = null;
      }
    }
    if (m & 1) segs.reverse();
    for (const t of segs) pts.push(32 - uy * s + ux * t, 64 + ux * s + uy * t);
  }
  // Each sequin in the shape turns when the fingertip first comes within reach.
  let len = 0;
  for (let i = 2; i < pts.length; i += 2) len += hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  for (let n = 0; n < NS; n++) {
    S.tOn[n] = 1e9;
    const cx = SX[n];
    const cy = SY[n];
    if (cx < 0 || cx >= W || cy < 0 || cy >= H || !fn(cx, cy)) continue;
    let at = 0;
    let hit = len;
    for (let i = 0; i + 2 < pts.length; i += 2) {
      const dx = pts[i + 2] - pts[i];
      const dy = pts[i + 3] - pts[i + 1];
      const l = hypot(dx, dy) || 1e-6;
      const fx = pts[i] - cx;
      const fy = pts[i + 1] - cy;
      const bb = (fx * dx + fy * dy) / l;
      const cc = fx * fx + fy * fy - REACH * REACH;
      const disc = bb * bb - cc;
      if (disc >= 0) {
        const t = cc <= 0 ? 0 : -bb - sqrt(disc);
        if (t >= 0 && t <= l) {
          hit = at + t;
          break;
        }
      }
      at += l;
    }
    S.tOn[n] = (0.1 + (hit / len) * 0.86) * TD;
  }
  // The palm comes down from the top, its lower edge a little uneven.
  const lean = Math.random() - 0.5;
  for (let n = 0; n < NS; n++) S.tOff[n] = clamp((SY[n] + 10 + 5 * sin(SX[n] * 0.09 + lean * 3) + lean * (SX[n] - 32) * 0.3) / (H + 24), 0, 1) * TS * 0.9;
}

function sweep(S) {
  if (S.c < TD + TH) S.c = TD + TH;
}

export function update(dt, input, params) {
  if (!params.sq) setup(params);
  const S = params.sq;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  S.hue = clamp(k[0], 0, 1);
  S.rate = clamp(k[1], 0.2, 3) / 2;
  const base = clamp(round(k[2]), 0, NDRAW - 1);
  S.lamp = clamp(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    S.base = base;
    S.count = -1;
    // Open on the drawing before, just finished, a little before the palm.
    load(S, (base + NDRAW - 1) % NDRAW);
    S.c = TD + TH - 2.4 * S.rate;
    for (let i = 0; i < NS; i++) {
      S.on[i] = S.tOn[i] <= S.c ? 1 : 0;
      S.p[i] = S.on[i];
    }
  }
  if (base !== S.base) {
    S.base = base;
    S.count = -1;
    sweep(S);
  }
  if (input.btnPressed && input.btnPressed[0]) sweep(S);
  S.c += dt * S.rate;
  if (S.c >= TC) {
    S.c -= TC;
    S.count++;
    load(S, (S.base + S.count + NDRAW * 8) % NDRAW);
  }
  const { p, on, tOn, tOff } = S;
  const c = S.c;
  const sw = c - TD - TH;
  for (let i = 0; i < NS; i++) {
    if (sw < 0) {
      if (c >= tOn[i]) on[i] = 1;
    } else if (sw >= tOff[i]) on[i] = 0;
    const step = (dt * S.rate) / FL;
    p[i] = on[i] ? min(1, p[i] + step) : max(0, p[i] - step);
  }
}

function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function draw(display, params) {
  const S = params.sq;
  if (!S || !S.started) return;
  const { p, jit, r, g, b, own } = S;
  r.fill(0);
  g.fill(0);
  b.fill(0);
  own.fill(-1);
  // The lamp stands above the cushion, from upper left over to upper right.
  const ang = PI * (0.78 - 0.56 * S.lamp);
  const lx = cos(ang);
  const ly = -sin(ang);
  const tint = hsv((0.9 + S.hue) % 1, 0.9, 1);
  for (let n = 0; n < NS; n++) {
    const cx = SX[n];
    const cy = SY[n];
    const cs = cos(PI * p[n]);
    const back = cs < 0;
    const sy = max(0.55, R * abs(cs));
    const edge = abs(cs) < 0.4;
    const x0 = max(0, Math.ceil(cx - R - 0.5));
    const x1 = min(W - 1, floor(cx + R - 0.5));
    const y0 = max(0, Math.ceil(cy - sy - 0.5));
    const y1 = min(H - 1, floor(cy + sy - 0.5));
    // The sheen: brighter toward the lamp, falling off to the cushion's sides.
    const qx = cx - 32 - 34 * lx;
    const qy = (cy - 64 - 56 * ly) * 0.6;
    const sh = min(1, 0.76 + 0.3 * Math.exp(-(qx * qx + qy * qy) / 1500)) * (1 - 0.12 * ((cx - 32) / 36) ** 2);
    const gl = jit[n];
    // Tipping over, a sequin's face swings through the lamp's reflection.
    const tip = 1 + 0.5 * sin(PI * p[n]) ** 2;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const u = (x + 0.5 - cx) / R;
        const v = (y + 0.5 - cy) / sy;
        if (u * u + v * v > 1) continue;
        const i = y * W + x;
        own[i] = n;
        if (edge) {
          // Edge on: a thin line of bare metal.
          const e = 150 * sh;
          r[i] = e;
          g[i] = e;
          b[i] = e * 1.05;
          continue;
        }
        const sv = (y + 0.5 - cy - SHOW * abs(cs)) / (0.9 * sy);
        const su = (x + 0.5 - cx) / (0.9 * R);
        const dot = su * lx + sv * ly;
        const hx = su + SPOT * lx;
        const hy = sv + SPOT * ly;
        const hl = max(0, 1 - (hx * hx + hy * hy) / SPOT2);
        let val = ((1 - 0.5 * dot) * gl + 0.7 * hl) * tip;
        if (u * u + v * v > RIM) val *= dot > 0 ? 0.2 : 1.1;
        if (!back) {
          const e = 255 * val * sh;
          r[i] = e * 0.9;
          g[i] = e * 0.94;
          b[i] = e;
        } else {
          // The coloured side is darker, but its highlight still bites.
          const e = 255 * val * sh * DIM;
          const w = 140 * sh * hl * hl * gl;
          r[i] = e * tint[0] + w * (0.5 + 0.5 * tint[0]);
          g[i] = e * tint[1] + w * (0.5 + 0.5 * tint[1]);
          b[i] = e * tint[2] + w * (0.5 + 0.5 * tint[2]);
        }
      }
  }
  // Shadows: the lamp is above, so a sequin lying over another throws a thin
  // shadow down from its lower edge onto the one below.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const f = y > 0 && own[i - W] > own[i] ? 0.1 : 1;
      if (own[i] < 0) {
        display.setPixel(x, y, 10 * f, 9 * f, 12 * f);
        continue;
      }
      display.setPixel(x, y, min(255, r[i] * f), min(255, g[i] * f), min(255, b[i] * f));
    }
}
