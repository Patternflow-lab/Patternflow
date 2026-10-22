// ===== Patternflow pattern =====
// Title:   Flip Clock
// Family:  time
// Idea:    A split-flap clock stood on end, hours above minutes: at each change the top half of the old card falls forward, and its back lands as the bottom half of the new one.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Rate=0..3, Seconds=0..1, Light=0..1
//
// Knob 1: Colour. The colour of the digits; the dark cards take a little of it.
// Knob 2: Rate. From real time at 0 to a minute every second at 3, a minute every four seconds where it starts.
// Knob 3: Seconds. Turn it up and a seconds card joins below, growing until all three are one size.
// Knob 4: Light. How hard the light falls on the cards, from flat to a deep shadow under each falling flap.
// Buttons: K1 tap sets the clock back to 09:58, and the flaps spin round to get there.

const START = 9 * 3600 + 59 * 60 + 20;
// Like a real flap clock, the hours are one wheel of 24 cards and the minutes
// and seconds wheels of 60, each card printed with both digits.
const SIZE = [24, 60, 60];
const MAX_DW = 24;
const MAX_DH = 42;

// Each digit is a few strokes in a box one wide and one tall, y downward.
// Arcs are cut into short straight pieces when the masks are baked.
const FONT = [
  [["l", 0, 0.3, 0, 0.7], ["a", 0.5, 0.7, 0.5, 0.3, 180, 0], ["l", 1, 0.7, 1, 0.3], ["a", 0.5, 0.3, 0.5, 0.3, 0, -180]],
  [["l", 0.58, 0, 0.58, 1], ["l", 0.58, 0, 0.2, 0.22]],
  [["a", 0.5, 0.28, 0.5, 0.28, 190, 385], ["l", 0.953, 0.398, 0, 1], ["l", 0, 1, 1, 1]],
  [["a", 0.5, 0.25, 0.47, 0.25, 205, 450], ["a", 0.5, 0.74, 0.5, 0.26, 270, 520]],
  [["l", 0.72, 1, 0.72, 0], ["l", 0.72, 0, 0, 0.7], ["l", 0, 0.7, 1, 0.7]],
  [["l", 0.95, 0, 0.12, 0], ["l", 0.12, 0, 0.07, 0.47], ["a", 0.5, 0.68, 0.5, 0.32, 215, 510]],
  [["a", 0.5, 0.7, 0.5, 0.3, 0, 360], ["a", 0.95, 0.7, 0.95, 0.68, 180, 250]],
  [["l", 0, 0, 1, 0], ["l", 1, 0, 0.32, 1]],
  [["a", 0.5, 0.24, 0.42, 0.24, 0, 360], ["a", 0.5, 0.73, 0.5, 0.27, 0, 360]],
  [["a", 0.5, 0.3, 0.5, 0.3, 0, 360], ["a", 0.05, 0.3, 0.95, 0.68, 0, 70]],
];

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function strokes() {
  const all = [];
  for (let d = 0; d < 10; d++) {
    const segs = [];
    for (const s of FONT[d]) {
      if (s[0] === "l") {
        segs.push(s[1], s[2], s[3], s[4]);
        continue;
      }
      const [, cx, cy, rx, ry, a0, a1] = s;
      const pieces = Math.max(3, Math.round(Math.abs(a1 - a0) / 20));
      for (let i = 0; i < pieces; i++) {
        const b0 = ((a0 + ((a1 - a0) * i) / pieces) * Math.PI) / 180;
        const b1 = ((a0 + ((a1 - a0) * (i + 1)) / pieces) * Math.PI) / 180;
        segs.push(cx + rx * Math.cos(b0), cy + ry * Math.sin(b0), cx + rx * Math.cos(b1), cy + ry * Math.sin(b1));
      }
    }
    all.push(new Float32Array(segs));
  }
  return all;
}

// Bake the ten digits at one size into coverage masks, one byte an LED, with
// a one-LED soft edge. This runs only when a card changes size.
function bake(p, m, dh) {
  const dw = Math.round(dh * 0.56);
  const sw = Math.max(2.2, dh * 0.135);
  m.dh = dh;
  m.dw = dw;
  const half = sw / 2;
  const sx = dw - sw;
  const sy = dh - sw;
  for (let d = 0; d < 10; d++) {
    const segs = p.strokes[d];
    for (let j = 0; j < dh; j++) {
      for (let i = 0; i < dw; i++) {
        const x = i + 0.5;
        const y = j + 0.5;
        let best = 1e9;
        for (let s = 0; s < segs.length; s += 4) {
          const ax = half + segs[s] * sx;
          const ay = half + segs[s + 1] * sy;
          const bx = half + segs[s + 2] * sx - ax;
          const by = half + segs[s + 3] * sy - ay;
          const px = x - ax;
          const py = y - ay;
          const len = bx * bx + by * by;
          let t = len > 0 ? (px * bx + py * by) / len : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = px - bx * t;
          const dy = py - by * t;
          const dd = dx * dx + dy * dy;
          if (dd < best) best = dd;
        }
        const c = half + 0.5 - Math.sqrt(best);
        m.mask[(d * MAX_DH + j) * MAX_DW + i] = Math.round(Math.max(0, Math.min(1, c)) * 255);
      }
    }
  }
}

// Bilinear read of a baked digit at box position (x, y), so a squashed flap stays smooth.
function sample(m, d, x, y) {
  const u = x - 0.5;
  const v = y - 0.5;
  const i = Math.floor(u);
  const j = Math.floor(v);
  if (i < -1 || j < -1 || i >= m.dw || j >= m.dh) return 0;
  const fu = u - i;
  const fv = v - j;
  const base = d * MAX_DH;
  const mask = m.mask;
  const a = i >= 0 && j >= 0 ? mask[(base + j) * MAX_DW + i] : 0;
  const b = i + 1 < m.dw && j >= 0 ? mask[(base + j) * MAX_DW + i + 1] : 0;
  const c = i >= 0 && j + 1 < m.dh ? mask[(base + j + 1) * MAX_DW + i] : 0;
  const e = i + 1 < m.dw && j + 1 < m.dh ? mask[(base + j + 1) * MAX_DW + i + 1] : 0;
  return ((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + e * fu) * fv) / 255;
}

export function setup(params) {
  const p = params;
  p.strokes = strokes();
  // One set of masks for the hours and minutes cards, one for the seconds card.
  p.masks = [
    { dh: 0, dw: 0, mask: new Uint8Array(10 * MAX_DH * MAX_DW) },
    { dh: 0, dw: 0, mask: new Uint8Array(10 * MAX_DH * MAX_DW) },
  ];
  p.clock = START;
  p.target = new Int32Array(3);
  p.shown = new Int32Array([9, 59, 20]);
  p.prev = new Int32Array([9, 59, 20]);
  p.prog = new Float32Array([1, 1, 1]);
  p.dur = new Float32Array([0.34, 0.34, 0.34]);
  p.rect = new Int32Array(12);
  p.card = [0, 0, 0];
  p.face = [0, 0, 0];
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  // At 0 the digits are a pale blue rather than red.
  p.hue = k[0] + 0.6;
  p.light = 0.3 + 0.7 * k[3];
  p.secs = k[2];
  if (input.btnPressed && input.btnPressed[0]) p.clock = 9 * 3600 + 58 * 60;
  p.clock += dt * Math.pow(60, k[1] / 3);
  const t = Math.floor(p.clock) % 86400;
  p.target[0] = Math.floor(t / 3600);
  p.target[1] = Math.floor(t / 60) % 60;
  p.target[2] = t % 60;
  for (let u = 0; u < 3; u++) {
    if (p.prog[u] < 1) p.prog[u] = Math.min(1, p.prog[u] + dt / p.dur[u]);
    if (p.prog[u] >= 1 && p.shown[u] !== p.target[u]) {
      // A wheel can only step to its next card, so a clock run fast spins
      // its flaps to catch up the way a real one does.
      const n = SIZE[u];
      p.prev[u] = p.shown[u];
      p.shown[u] = (p.shown[u] + 1) % n;
      const behind = (p.target[u] - p.prev[u] + n) % n;
      p.dur[u] = 0.34 / Math.min(5, behind);
      p.prog[u] = 0;
    }
  }
}

function setRect(r, u, x, y, w, h) {
  r[u * 4] = x;
  r[u * 4 + 1] = y;
  r[u * 4 + 2] = w;
  r[u * 4 + 3] = h;
}

function layout(p) {
  const r = p.rect;
  if (p.secs <= 0.12) {
    // Hours and minutes, one big card each.
    setRect(r, 0, 3, 5, 58, 55);
    setRect(r, 1, 3, 68, 58, 55);
    return 2;
  }
  // The seconds card grows from small to the size of the other two.
  const u = Math.min(1, (p.secs - 0.12) / 0.88);
  const hs = 2 * Math.round(12 + 6 * u) + 1;
  let ch = Math.floor((128 - hs - 12) / 2);
  if (ch % 2 === 0) ch--;
  const top = Math.floor((128 - 2 * ch - hs - 8) / 2);
  const sw = Math.min(58, 2 * Math.round(hs * 0.8));
  setRect(r, 0, 3, top, 58, ch);
  setRect(r, 1, 3, top + ch + 4, 58, ch);
  setRect(r, 2, (64 - sw) / 2, top + 2 * ch + 8, sw, hs);
  return 3;
}

function drawCard(display, p, u) {
  const x0 = p.rect[u * 4];
  const y0 = p.rect[u * 4 + 1];
  const cw = p.rect[u * 4 + 2];
  const ch = p.rect[u * 4 + 3];
  const L = p.light;
  const m = p.masks[u === 2 ? 1 : 0];
  const dh = Math.min(MAX_DH, Math.round(ch * 0.72));
  if (m.dh !== dh) bake(p, m, dh);
  const dw = m.dw;
  const gap = Math.max(2, Math.round(cw * 0.08));
  const lx = Math.round(cw / 2 - gap / 2 - dw);
  const rx = Math.round(cw / 2 + gap / 2);
  const oy = Math.round((ch - dh) / 2);
  const value = p.shown[u];
  const old = p.prev[u];
  const prog = p.prog[u];
  const flipping = prog < 1;

  const hh = (ch - 1) / 2;
  const hinge = hh + 0.5;
  const theta = prog * Math.PI;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const reach = hh * Math.abs(cos);
  const first = flipping && prog < 0.5;
  const second = flipping && prog >= 0.5;
  const mid = cw / 2;
  const card = p.card;
  const face = p.face;

  for (let y = 0; y < ch; y++) {
    const ry = y + 0.5;
    const upper = ry < hh;
    const lower = ry > hh + 1;
    if (!upper && !lower) continue;
    // Which surface is seen on this row, where on its card it comes from, and how it is lit.
    let sy = ry;
    let shown = value;
    let shade = 1;
    let flap = false;
    let f = 0;
    if (first && upper && hinge - ry <= reach) {
      f = (hinge - ry) / reach;
      sy = hinge - f * hh;
      shown = old;
      shade = 1 - 0.8 * L * sin;
      flap = true;
    } else if (second && lower && ry - hinge <= reach) {
      f = (ry - hinge) / reach;
      sy = hinge + f * hh;
      shade = 1 - 0.8 * L * sin;
      flap = true;
    } else if (lower && flipping) {
      // The old bottom half stays until the flap lands on it, in its shadow.
      shown = old;
      if (second) {
        const below = ry - hinge - reach;
        if (below < 7) shade *= 1 - 0.6 * L * (1 - below / 7) * (1 - 0.6 * Math.abs(cos));
      }
    }
    const ty = Math.floor(sy);
    const roundTop = ty === 0 || ty === hh + 1;
    const roundBottom = ty === ch - 1 || ty === hh - 1;
    // Light from above: each card darkens toward its foot, the top edge
    // catches the light and the row under the split sits in shadow.
    shade *= 1 + L * (0.1 - 0.45 * (sy / ch));
    if (ty === 0) shade *= 1 + 0.5 * L;
    else if (ty === hh + 1) shade *= 1 - 0.5 * L;
    const tens = Math.floor(shown / 10);
    const ones = shown % 10;
    // The falling flap's free edge swings toward you, so it looks a little wider.
    const widen = flap ? 1 + 0.12 * sin * f : 1;
    const pad = flap ? 2 : 0;
    for (let x = -pad; x < cw + pad; x++) {
      const sx = mid + (x + 0.5 - mid) / widen;
      if (sx < 0 || sx >= cw) continue;
      const tx = Math.floor(sx);
      // Each half card has its corners cut.
      if ((tx === 0 || tx === cw - 1) && (roundTop || roundBottom)) continue;
      const a = sx < mid ? sample(m, tens, sx - lx, sy - oy) : sample(m, ones, sx - rx, sy - oy);
      const r = (card[0] + (face[0] - card[0]) * a) * shade;
      const g = (card[1] + (face[1] - card[1]) * a) * shade;
      const b = (card[2] + (face[2] - card[2]) * a) * shade;
      display.setPixel(x0 + x, y0 + y, r, g, b);
    }
  }
}

export function draw(display, params, time) {
  const p = params;
  hsv(p.hue, 0.3, 0.19, p.card);
  hsv(p.hue, 0.4, 1, p.face);
  const cards = layout(p);
  for (let u = 0; u < cards; u++) drawCard(display, p, u);
}
