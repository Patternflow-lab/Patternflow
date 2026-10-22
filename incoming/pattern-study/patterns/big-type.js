// ===== Patternflow pattern =====
// Title:   Big Type
// Family:  type
// Idea:    One word as big as the screen will hold, on a set that cannot keep it still, the way a magnet bends the picture on an old television.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..5, Word=0..6, Warp=0..1
//
// Knob 1: Hue. Turns the outline colour; the fill and the shadow follow it.
// Knob 2: Speed. How fast the wave runs down the word and the bright scan bar rolls.
// Knob 3: Word. Picks the word: TV, 1963, LIGHT, HELLO, FLOW, PLAY, KNOB.
// Knob 4: Warp. How hard the picture bends, from a slow sway to a set losing its hold.

const W = 64;
const H = 128;

// The font is drawn from its Scale2x copy, ten by fourteen cells a glyph.
const ZOOM = 2;

const WORDS = ["TV", "1963", "LIGHT", "HELLO", "FLOW", "PLAY", "KNOB"];
// The panel stands up, so a word is set in lines: four letters as two over
// two like a poster, five down the panel like a hotel sign.
const LINES = [["T", "V"], ["19", "63"], ["L", "I", "G", "H", "T"], ["H", "E", "L", "L", "O"], ["FL", "OW"], ["PL", "AY"], ["KN", "OB"]];
const MAX_LINES = 5;

// 5x7 glyphs, seven rows each from the top, 16 is the left column.
const LETTERS = "TV1963LIGHEOFWPAYKNB";
const FONT = [
  31, 4, 4, 4, 4, 4, 4,
  17, 17, 17, 17, 17, 10, 4,
  4, 12, 4, 4, 4, 4, 14,
  14, 17, 17, 15, 1, 2, 12,
  6, 8, 16, 30, 17, 17, 14,
  31, 2, 4, 2, 1, 17, 14,
  16, 16, 16, 16, 16, 16, 31,
  14, 4, 4, 4, 4, 4, 14,
  14, 17, 16, 23, 17, 17, 15,
  17, 17, 17, 31, 17, 17, 17,
  31, 16, 16, 30, 16, 16, 31,
  14, 17, 17, 17, 17, 17, 14,
  31, 16, 16, 30, 16, 16, 16,
  17, 17, 17, 21, 21, 21, 10,
  30, 17, 17, 30, 16, 16, 16,
  14, 17, 17, 31, 17, 17, 17,
  17, 17, 10, 4, 4, 4, 4,
  17, 18, 20, 24, 20, 18, 17,
  17, 17, 25, 21, 19, 17, 17,
  30, 17, 17, 30, 17, 17, 30,
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

function hash(n) {
  let x = (Math.imul(n | 0, 374761393) + 668265263) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// Lays a word out: its lines, the glyphs of each, and one scale for all of
// them, as tall as the lines allow and no wider than 1.8 times that. The
// scale need not be whole: five lines get 3.2 LEDs a font row.
function setWord(p, slot, index) {
  const lines = LINES[index];
  const L = p.layout[slot];
  L.lines = lines.length;
  let wide = 0;
  let k = 0;
  for (let j = 0; j < L.lines; j++) {
    const text = lines[j];
    L.first[j] = k;
    L.cols[j] = text.length * 6 - 1;
    wide = Math.max(wide, L.cols[j]);
    for (let i = 0; i < text.length; i++) L.bits[k++] = p.big[LETTERS.indexOf(text[i])];
  }
  L.gap = L.lines > 2 ? 2 : 8;
  L.sy = Math.min(8, (H - 8 - (L.lines - 1) * L.gap) / (7 * L.lines));
  L.sx = Math.min(11, Math.floor((W - 6) / wide), L.sy * 1.8);
  L.pitch = Math.ceil(7 * L.sy) + L.gap;
  L.y0 = Math.floor((H - L.lines * L.pitch + L.gap) / 2);
  for (let j = 0; j < L.lines; j++) L.x0[j] = Math.floor((W - L.cols[j] * L.sx) / 2);
}

// Scale2x (EPX) on a bitmap: square corners stay, a diagonal step gets joined.
function epx(src, w, h) {
  const out = new Uint8Array(w * h * 4);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = at(x, y);
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      const o = y * 2 * w * 2 + x * 2;
      out[o] = C === A && C !== D && A !== B ? A : P;
      out[o + 1] = A === B && A !== C && B !== D ? B : P;
      out[o + w * 2] = D === C && D !== B && C !== A ? C : P;
      out[o + w * 2 + 1] = B === D && B !== A && D !== C ? D : P;
    }
  }
  return out;
}

// u is across the panel, v down from the top of the word.
function inside(L, u, v) {
  if (v < 0) return 0;
  const j = Math.floor(v / L.pitch);
  if (j >= L.lines) return 0;
  v -= j * L.pitch;
  u -= L.x0[j];
  if (u < 0) return 0;
  const cu = Math.floor((u * ZOOM) / L.sx);
  const cv = Math.floor((v * ZOOM) / L.sy);
  if (cu >= L.cols[j] * ZOOM || cv >= 7 * ZOOM) return 0;
  const letter = Math.floor(cu / (6 * ZOOM));
  const b = cu - letter * 6 * ZOOM;
  if (b >= 5 * ZOOM) return 0;
  return L.bits[L.first[j] + letter][cv * 5 * ZOOM + b];
}

function newLayout() {
  return {
    lines: 0,
    gap: 0,
    pitch: 1,
    sx: 1,
    sy: 1,
    y0: 0,
    first: new Int8Array(MAX_LINES),
    cols: new Int16Array(MAX_LINES),
    x0: new Int16Array(MAX_LINES),
    bits: [],
  };
}

export function setup(params) {
  params.phase = 0;
  params.roll = 1;
  params.word = -1;
  params.layout = [newLayout(), newLayout()];
  params.big = [];
  for (let g = 0; g < LETTERS.length; g++) {
    const bits = new Uint8Array(35);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) bits[r * 5 + c] = (FONT[g * 7 + r] >> (4 - c)) & 1;
    params.big.push(epx(bits, 5, 7));
  }
  params.mask = new Uint8Array(W * H);
  params.rowShift = new Float32Array(H);
  params.colShift = new Float32Array(W);
  params.line = [0, 0, 0];
  params.fill = [0, 0, 0];
  params.shade = [0, 0, 0];
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  p.hue = k[0];
  p.speed = k[1];
  p.warp = k[3];
  const index = Math.max(0, Math.min(WORDS.length - 1, Math.round(k[2])));
  if (p.word < 0) {
    setWord(p, 0, index);
    p.word = index;
  } else if (index !== p.word) {
    // The old word rolls up out of frame and the new one follows it in.
    p.layout.reverse();
    setWord(p, 0, index);
    p.word = index;
    p.roll = 0;
  }
  p.roll = Math.min(1, p.roll + dt * 3);
  p.phase += dt * p.speed;
}

export function draw(display, params, time) {
  const p = params;
  const warp = p.warp;
  const ph = p.phase;
  const amp = 1.5 + warp * 6;
  // About one wave to a big letter, as on the wide panel.
  const lambda = 64 - warp * 16;
  const shear = warp * 0.09 * Math.sin(ph * 0.45);
  // Above half warp a band of rows slips sideways now and then, like lost sync.
  const slot = Math.floor(ph * 3);
  const tearY = hash(slot) * H;
  const tearH = 3 + hash(slot + 7) * 12;
  const tear = warp > 0.5 && hash(slot + 3) < 0.6 ? (hash(slot + 11) - 0.5) * 44 * (warp - 0.5) : 0;
  for (let y = 0; y < H; y++) {
    let s = amp * Math.sin((y / lambda) * 6.2832 - ph * 2.4) + shear * (y - H / 2);
    if (tear !== 0 && y >= tearY && y < tearY + tearH) s += tear;
    p.rowShift[y] = s;
  }
  for (let x = 0; x < W; x++) p.colShift[x] = warp * 3 * Math.sin((x / 56) * 6.2832 + ph * 1.3);

  const e = p.roll * p.roll * (3 - 2 * p.roll);
  const now = p.layout[0];
  const old = p.layout[1];
  const rolling = p.roll < 1;
  const mask = p.mask;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x - p.rowShift[y];
      const v = y - p.colShift[x];
      let m = inside(now, u, v - now.y0 - (rolling ? (1 - e) * H : 0));
      if (rolling && !m) m = inside(old, u, v - old.y0 + e * H);
      mask[y * W + x] = m;
    }
  }

  hsv(p.hue, 0.75, 1, p.line);
  hsv(p.hue + 0.07, 0.95, 1, p.fill);
  hsv(p.hue + 0.55, 0.9, 0.32, p.shade);
  const line = p.line;
  const fill = p.fill;
  const shade = p.shade;
  const bar = ((ph * 30) % (H + 24)) - 12;
  const sdx = 2;
  const sdy = 2;
  for (let y = 0; y < H; y++) {
    const glow = Math.max(0, 1 - Math.abs(y - bar) / 7);
    const lit = (y & 1) === 0 ? 0.3 + glow * 0.6 : glow * 0.35;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (mask[i]) {
        const edge =
          x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
          !mask[i - 1] || !mask[i + 1] || !mask[i - W] || !mask[i + W];
        if (edge) display.setPixel(x, y, line[0], line[1], line[2]);
        else display.setPixel(x, y, fill[0] * lit, fill[1] * lit, fill[2] * lit);
      } else if (x >= sdx && y >= sdy && mask[i - sdy * W - sdx]) {
        display.setPixel(x, y, shade[0], shade[1], shade[2]);
      } else {
        display.setPixel(x, y, 0, 0, 0);
      }
    }
  }
}
