// ===== Patternflow pattern =====
// Title:   Bauhaus
// Family:  geometry
// Idea:    A poster grid of discs, halves, quarters and bars in three primaries and a cream, where one cell at a time turns or trades its shape and the sheet finds a new balance.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.25..6, Grid=4..12, Line=0..1
//
// Knob 1: Hue. Turns the red, yellow and blue together around the wheel; the cream stays cream.
// Knob 2: Pace. How often a cell changes and how long it takes; low is one slow turn after another, high has three cells moving at once.
// Knob 3: Grid. Cells down the long side, from four big squares to twelve small ones.
// Knob 4: Line. How many cells are drawn as a line instead of a solid shape; at the top the sheet is a line drawing.
// Buttons: K1 tap deals the whole sheet again, a diagonal of cells at a time.

const W = 64;
const H = 128;
const MAX = 12 * 6;

const DISC = 0;
const HALF = 1;
const QUARTER = 2;
const BAR = 3;
const SQUARE = 4;
const TRIANGLE = 5;
const LEAF = 6;
const ARCS = 7;
const DOT = 8;
const SHAPES = 9;

// Where each shape shrinks to and grows from, in its own unturned frame.
const ANCHOR_U = [0, 0, -1, 0, 0, 1, 0, -1, 0.5];
const ANCHOR_V = [0, 1, 1, 0, 0, 1, 0, 1, 0.5];

// How likely a freshly dealt shape sits on a coloured square: small ones often, big ones seldom.
const GROUND = [0.3, 0.1, 0.06, 0.22, 0.35, 0.1, 0.1, 0.06, 0.5];

const TURN = 1;
const MORPH = 2;
const RECOLOUR = 3;

const SQRT_HALF = Math.SQRT1_2;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function smooth(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Signed distance to a shape, in half-cells, negative inside.
function shapeDist(shape, u, v) {
  if (shape === DISC) return Math.sqrt(u * u + v * v) - 0.81;
  if (shape === HALF) return Math.max(Math.sqrt(u * u + (v - 1) * (v - 1)) - 1, v - 1);
  if (shape === QUARTER) return Math.sqrt((u + 1) * (u + 1) + (v - 1) * (v - 1)) - 2;
  if (shape === BAR) return Math.abs(v) - 0.36;
  if (shape === SQUARE) return Math.max(Math.abs(u), Math.abs(v)) - 0.56;
  if (shape === TRIANGLE) return -(u + v) * SQRT_HALF;
  if (shape === DOT) return Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5)) - 0.3;
  if (shape === LEAF) {
    const a = Math.sqrt((u + 1) * (u + 1) + (v - 1) * (v - 1)) - 2;
    const b = Math.sqrt((u - 1) * (u - 1) + (v + 1) * (v + 1)) - 2;
    return Math.max(a, b);
  }
  // Three bands round a corner, two of them lit.
  const r = Math.sqrt((u + 1) * (u + 1) + (v - 1) * (v - 1));
  if (r >= 2) return r - 2;
  const q = r * 1.5;
  const band = Math.floor(q);
  const f = q - band;
  const edge = Math.min(f, 1 - f) / 1.5;
  return band === 1 ? edge : -edge;
}

// A shape turned by `ang` and scaled by `s` about its anchor.
function placed(shape, u, v, c, sn, s) {
  let su = c * u + sn * v;
  let sv = -sn * u + c * v;
  if (s < 0.999) {
    if (s < 0.02) return 9;
    const au = ANCHOR_U[shape];
    const av = ANCHOR_V[shape];
    su = au + (su - au) / s;
    sv = av + (sv - av) / s;
    return shapeDist(shape, su, sv) * s;
  }
  return shapeDist(shape, su, sv);
}

// A square looks the same after a quarter turn, so it turns in eighths.
function angleOf(shape, rot) {
  return rot * (shape === SQUARE ? Math.PI / 4 : Math.PI / 2);
}

function pickColour(p, avoidA, avoidB) {
  for (let tries = 0; tries < 4; tries++) {
    const r = Math.random();
    const c = r < 0.32 ? 1 : r < 0.58 ? 2 : r < 0.88 ? 3 : 4;
    if (c !== avoidA && c !== avoidB) return c;
  }
  return 1 + Math.floor(Math.random() * 4);
}

// Grounds lean to red and blue; a yellow square is loud on a dark panel.
function pickGround(avoid) {
  for (let tries = 0; tries < 4; tries++) {
    const r = Math.random();
    const c = r < 0.38 ? 1 : r < 0.8 ? 3 : r < 0.9 ? 2 : 4;
    if (c !== avoid) return c;
  }
  return avoid === 3 ? 1 : 3;
}

// A neighbour's colour, so a new cell can avoid matching the one beside it and the one above.
function neighbour(p, c, dx, dy) {
  const i = c % p.cols;
  const j = (c - i) / p.cols;
  const ni = i + dx;
  const nj = j + dy;
  if (ni < 0 || nj < 0 || ni >= p.cols || nj >= p.rows) return -1;
  return p.toFg[nj * p.cols + ni];
}

function randomShape(p, c) {
  p.toShape[c] = Math.floor(Math.random() * SHAPES);
  p.toRot[c] = Math.floor(Math.random() * 4);
  p.toFg[c] = pickColour(p, neighbour(p, c, -1, 0), neighbour(p, c, 0, -1));
  if (Math.random() < GROUND[p.toShape[c]]) {
    p.toBg[c] = pickGround(p.toFg[c]);
  } else p.toBg[c] = 0;
}

function build(p, n) {
  p.n = n;
  // The panel stands up, so the knob counts cells down its long side.
  const S = Math.floor(H / n);
  p.S = S;
  p.rows = n;
  p.cols = Math.max(1, Math.floor(W / S));
  p.ox = Math.floor((W - p.cols * S) / 2);
  p.oy = Math.floor((H - n * S) / 2);
  const count = p.cols * p.rows;
  for (let c = 0; c < count; c++) {
    randomShape(p, c);
    p.fromShape[c] = p.toShape[c];
    p.fromRot[c] = p.toRot[c];
    p.fromFg[c] = p.toFg[c];
    p.fromBg[c] = p.toBg[c];
    p.kind[c] = 0;
    p.prog[c] = 1;
    p.last[c] = p.clock - Math.random() * 4;
    p.pending[c] = -1;
    p.lineR[c] = Math.random();
  }
  p.count = count;
}

function start(p, c, kind, dur) {
  p.fromShape[c] = p.toShape[c];
  p.fromRot[c] = p.toRot[c];
  p.fromFg[c] = p.toFg[c];
  p.fromBg[c] = p.toBg[c];
  if (kind === TURN && p.toShape[c] === DISC) kind = Math.random() < 0.5 ? MORPH : RECOLOUR;
  if (kind === TURN) {
    p.toRot[c] = (p.toRot[c] + (Math.random() < 0.5 ? 1 : 3)) & 3;
  } else if (kind === MORPH) {
    let s = Math.floor(Math.random() * (SHAPES - 1));
    if (s >= p.fromShape[c]) s++;
    p.toShape[c] = s;
    p.toRot[c] = Math.floor(Math.random() * 4);
    if (Math.random() < 0.5) p.toFg[c] = pickColour(p, p.fromFg[c], p.toBg[c]);
  } else {
    if (Math.random() < 0.35) {
      // The ground changes: a bare cell gets a colour, a coloured one usually goes bare.
      p.toBg[c] = p.fromBg[c] && Math.random() < 0.6 ? 0 : pickGround(p.fromFg[c]);
    } else p.toFg[c] = pickColour(p, p.fromFg[c], p.toBg[c]);
    p.wipe[c] = Math.floor(Math.random() * 5);
  }
  p.kind[c] = kind;
  p.prog[c] = 0;
  p.dur[c] = dur;
  p.last[c] = p.clock;
}

export function setup(params) {
  const p = params;
  p.fromShape = new Uint8Array(MAX);
  p.toShape = new Uint8Array(MAX);
  p.fromRot = new Uint8Array(MAX);
  p.toRot = new Uint8Array(MAX);
  p.fromFg = new Uint8Array(MAX);
  p.toFg = new Uint8Array(MAX);
  p.fromBg = new Uint8Array(MAX);
  p.toBg = new Uint8Array(MAX);
  p.kind = new Uint8Array(MAX);
  p.wipe = new Uint8Array(MAX);
  p.prog = new Float32Array(MAX);
  p.dur = new Float32Array(MAX);
  p.last = new Float32Array(MAX);
  p.pending = new Float32Array(MAX);
  p.lineR = new Float32Array(MAX);
  p.pal = new Float32Array(5 * 3);
  p.hue = -1;
  p.n = 0;
  p.clock = 0;
  p.timer = 0.4;
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 4, 0.06];
  p.clock += dt;
  const n = Math.max(4, Math.min(12, Math.round(k[2])));
  if (n !== p.n) build(p, n);
  p.line = k[3];

  if (k[0] !== p.hue) {
    p.hue = k[0];
    hsv(0.995 + p.hue, 0.86, 0.94, p.pal, 3);
    hsv(0.125 + p.hue, 0.9, 1, p.pal, 6);
    hsv(0.6 + p.hue, 0.84, 0.92, p.pal, 9);
    p.pal[12] = 190;
    p.pal[13] = 168;
    p.pal[14] = 128;
  }

  // At pace 2 a cell changes every 2.5 s, and each whole step of the knob is 1.7 times quicker or slower.
  const every = 2.5 * Math.pow(2, (2 - k[1]) * 0.8);
  const dur = Math.max(0.6, every * 1.1);

  if (input.btnPressed && input.btnPressed[0]) {
    for (let c = 0; c < p.count; c++) {
      const i = c % p.cols;
      p.pending[c] = p.clock + (i + (c - i) / p.cols) * 0.14;
    }
  }

  for (let c = 0; c < p.count; c++) {
    if (p.prog[c] < 1) {
      p.prog[c] = Math.min(1, p.prog[c] + dt / p.dur[c]);
      if (p.prog[c] >= 1) p.kind[c] = 0;
    } else if (p.pending[c] >= 0 && p.clock >= p.pending[c]) {
      p.pending[c] = -1;
      start(p, c, MORPH, 0.9);
    }
  }

  p.timer -= dt;
  if (p.timer <= 0) {
    p.timer += every;
    if (p.timer < 0) p.timer = every;
    // Of four cells drawn at random, the one left alone longest changes.
    let best = -1;
    for (let tries = 0; tries < 4; tries++) {
      const c = Math.floor(Math.random() * p.count);
      if (p.prog[c] < 1 || p.pending[c] >= 0) continue;
      if (best < 0 || p.last[c] < p.last[best]) best = c;
    }
    if (best >= 0) {
      const r = Math.random();
      start(p, best, r < 0.4 ? TURN : r < 0.8 ? MORPH : RECOLOUR, dur);
    }
  }
}

export function draw(display, params, time) {
  const p = params;
  const S = p.S;
  const half = S / 2;
  const pal = p.pal;
  const lineW = (S >= 20 ? 2 : 1) / half;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) display.setPixel(x, y, 0, 0, 0);

  for (let c = 0; c < p.count; c++) {
    const i = c % p.cols;
    const j = (c - i) / p.cols;
    const x0 = p.ox + i * S;
    const y0 = p.oy + j * S;
    const kind = p.kind[c];
    const e = smooth(p.prog[c]);
    const outline = p.lineR[c] < p.line;

    let shape = p.toShape[c];
    let ang = angleOf(shape, p.toRot[c]);
    let scale = 1;
    let fg = p.toFg[c];
    let bg = p.toBg[c];
    let fg2 = fg;
    let bg2 = bg;
    let front = 2;
    if (kind === TURN) {
      const a0 = angleOf(shape, p.fromRot[c]);
      let d = ang - a0;
      // The short way round.
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      ang = a0 + d * e;
    } else if (kind === MORPH) {
      const pr = p.prog[c];
      if (pr < 0.5) {
        shape = p.fromShape[c];
        ang = angleOf(shape, p.fromRot[c]);
        fg = p.fromFg[c];
        scale = 1 - smooth(pr * 2);
      } else scale = smooth(pr * 2 - 1);
    } else if (kind === RECOLOUR) {
      fg = p.fromFg[c];
      bg = p.fromBg[c];
      front = -1.45 + e * 2.9;
    }
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const wipe = p.wipe[c];

    for (let ly = 0; ly < S; ly++) {
      const y = y0 + ly;
      const v = (ly + 0.5 - half) / half;
      for (let lx = 0; lx < S; lx++) {
        const x = x0 + lx;
        const u = (lx + 0.5 - half) / half;
        let f = fg;
        let b = bg;
        if (kind === RECOLOUR) {
          // A hard front sweeps the new colours in: from a side, or as an iris.
          const w = wipe === 0 ? u : wipe === 1 ? -u : wipe === 2 ? v : wipe === 3 ? -v : Math.sqrt(u * u + v * v) * 1.42 - 1;
          if (w < front) {
            f = fg2;
            b = bg2;
          }
        }
        const d = Math.max(placed(shape, u, v, cs, sn, scale), Math.max(Math.abs(u), Math.abs(v)) - 1);
        let col = d < 0 && (!outline || d > -lineW) ? f : 0;
        // Drawn as a line, the ground is a frame round the cell.
        if (!col && b) col = !outline || Math.max(Math.abs(u), Math.abs(v)) > 1 - lineW ? b : 0;
        if (col) display.setPixel(x, y, pal[col * 3], pal[col * 3 + 1], pal[col * 3 + 2]);
      }
    }
  }
}
