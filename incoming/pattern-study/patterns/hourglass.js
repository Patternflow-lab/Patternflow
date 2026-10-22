// ===== Patternflow pattern =====
// Title:   Hourglass
// Family:  time
// Idea:    One LED is one grain: a falling-sand automaton pours through a two-LED neck, funnels the top heap into a V and builds a cone below, and when the top runs dry the glass turns over.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Sand=0..1, Flow=0.5..4, Glass=0..1, Layers=1..6
//
// Knob 1: Sand. The colour of the sand.
// Knob 2: Flow. How fast the sand runs: a glass takes about half a minute where it starts, two minutes at the bottom of the range.
// Knob 3: Glass. The shape of the glass: round bulbs, then two straight cones, then two spheres on a thin tube.
// Knob 4: Layers. Colours each grain by when in the run it passed the neck, so the heap below grows rings of time.
// Buttons: K1 tap turns the glass over now.

const W = 64;
const H = 128;
const N = W * H;
// The neck sits between rows 63 and 64; the glass reaches 58 rows each way.
const MID = 64;
const REACH = 58.5;
const BULB = 25;
const TURN = 1.5;

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

// Half the inside width of the glass at d rows from the neck. Three shapes,
// blended as the knob turns: round bulbs, straight cones, spheres on a tube.
function profile(d, shape) {
  const t = Math.max(0, Math.min(1, (d - 2) / (REACH - 2)));
  const round = Math.pow(Math.sin(t * Math.PI * 0.62), 0.7);
  const cone = Math.min(1, t * 1.06);
  const u = (t - 0.58) / 0.46;
  const sphere = u * u < 1 ? Math.sqrt(1 - u * u) : 0;
  const f = shape < 0.5 ? round + (cone - round) * shape * 2 : cone + (sphere - cone) * (shape - 0.5) * 2;
  return 1 + (BULB - 1) * f;
}

function build(p, shape) {
  const cell = p.cell;
  for (let y = 0; y < H; y++) {
    const d = Math.abs(y + 0.5 - MID);
    p.hw[y] = d < REACH ? profile(d, shape) : 0;
  }
  // Grains the new walls land on are taken out and poured back in from the top of their half.
  let lost = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const inside = Math.abs(x + 0.5 - W / 2) < p.hw[y];
      if (inside) {
        if (cell[i] === 1) cell[i] = 0;
      } else {
        if (cell[i] >= 2) {
          p.spill[lost * 3] = cell[i];
          p.spill[lost * 3 + 1] = p.ord[i];
          p.spill[lost * 3 + 2] = y < MID ? 0 : 1;
          lost++;
        }
        cell[i] = 1;
      }
    }
  }
  for (let g = 0; g < lost; g++) {
    const bottom = p.spill[g * 3 + 2];
    const y0 = bottom ? MID : 0;
    let placed = false;
    for (let y = y0; y < y0 + MID && !placed; y++) {
      for (let s = 0; s < W && !placed; s++) {
        const x = s & 1 ? W / 2 + (s >> 1) : W / 2 - 1 - (s >> 1);
        const i = y * W + x;
        if (cell[i] === 0) {
          cell[i] = p.spill[g * 3];
          p.ord[i] = p.spill[g * 3 + 1];
          placed = true;
        }
      }
    }
  }
  let total = 0;
  for (let i = 0; i < N; i++) if (cell[i] >= 2) total++;
  p.total = total;
  // The outline is drawn on the outside cells that touch the inside.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let edge = 0;
      if (cell[i] === 1) {
        for (let dy = -1; dy <= 1 && !edge; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
            if (cell[yy * W + xx] !== 1) {
              edge = 1;
              break;
            }
          }
        }
      }
      p.wall[i] = edge;
    }
  }
}

function fill(p) {
  const cell = p.cell;
  let room = 0;
  for (let i = 0; i < MID * W; i++) if (cell[i] !== 1) room++;
  const count = Math.floor(room * 0.62);
  let placed = 0;
  let far = 1;
  for (let y = MID - 1; y >= 0 && placed < count; y--) {
    for (let s = 0; s < W && placed < count; s++) {
      const x = s & 1 ? W / 2 + (s >> 1) : W / 2 - 1 - (s >> 1);
      const i = y * W + x;
      if (cell[i] !== 0) continue;
      cell[i] = 2 + Math.floor(Math.random() * 4);
      far = Math.max(far, Math.hypot(x + 0.5 - W / 2, (MID - y) * 1.6));
      placed++;
    }
  }
  // The first heap is banded in bowls around the neck, the way a heap that
  // has just been turned over hangs, rather than in flat rows.
  for (let y = 0; y < MID; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (cell[i] >= 2) p.ord[i] = Math.min(255, Math.floor((Math.hypot(x + 0.5 - W / 2, (MID - y) * 1.6) / far) * 256));
    }
  }
  p.total = placed;
  p.passed = 0;
}

// A grain takes its band as it passes the neck, by how much of the run has
// gone before it, so the heap below lays down the run as rings of colour.
function through(p) {
  const band = Math.min(255, Math.floor((p.passed * 256) / Math.max(1, p.total)));
  p.passed++;
  return band;
}

// One step of the automaton, bottom row first so a grain moves once a step.
// In each row every grain that can drop straight down does so before any
// grain slides sideways. Otherwise a slide takes the hole first, the side of
// the top heap drains before its middle, and the heap peaks instead of
// funnelling into a crater the way real sand does.
function step(p) {
  const cell = p.cell;
  const ord = p.ord;
  const flip = p.steps & 1;
  let moved = 0;
  let top = 0;
  for (let y = H - 2; y >= 0; y--) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      const c = cell[i];
      if (c < 2 || cell[i + W] !== 0) continue;
      cell[i + W] = c;
      ord[i + W] = y + 1 === MID ? through(p) : ord[i];
      cell[i] = 0;
      moved++;
      if (y + 1 < MID) top++;
    }
    for (let s = 0; s < W; s++) {
      const x = flip ? s : W - 1 - s;
      const i = row + x;
      const c = cell[i];
      if (c < 2) continue;
      let to = i + W;
      const left = x > 0 && cell[to - 1] === 0;
      const right = x < W - 1 && cell[to + 1] === 0;
      if (left && right) to += Math.random() < 0.5 ? -1 : 1;
      else if (left) to -= 1;
      else if (right) to += 1;
      else if (y < MID && cell[to] === 1) {
        // Glass is smoother than sand: near the neck the walls are flatter
        // than the sand would stand, so a grain lying on the glass creeps
        // toward the neck instead of staying there for good.
        const inward = x < W / 2 ? 1 : -1;
        if (cell[i + inward] !== 0) {
          top++;
          continue;
        }
        to = i + inward;
      } else {
        if (y < MID) top++;
        continue;
      }
      cell[to] = c;
      ord[to] = y + 1 === MID && to >= MID * W ? through(p) : ord[i];
      cell[i] = 0;
      moved++;
      if (to < MID * W) top++;
    }
  }
  p.steps++;
  p.moved = moved;
  p.top = top;
}

function spin(p) {
  p.passed = 0;
  const cell = p.cell;
  const ord = p.ord;
  for (let i = 0, j = N - 1; i < j; i++, j--) {
    const c = cell[i];
    cell[i] = cell[j];
    cell[j] = c;
    const o = ord[i];
    ord[i] = ord[j];
    ord[j] = o;
  }
}

export function setup(params) {
  const p = params;
  p.cell = new Uint8Array(N);
  p.ord = new Uint8Array(N);
  p.wall = new Uint8Array(N);
  p.hw = new Float32Array(H);
  p.spill = new Uint8Array(N * 3);
  p.img = new Float32Array(N * 3);
  p.lut = new Float32Array(6 * 4 * 3);
  p.shape = -1;
  p.ready = false;
  p.acc = 0;
  p.steps = 0;
  p.moved = 0;
  p.top = 1;
  p.idle = 0;
  p.turn = -1;
  p.total = 1;
  p.passed = 0;
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 0, 1];
  const shape = Math.round(Math.max(0, Math.min(1, k[2])) * 40) / 40;
  if (shape !== p.shape) {
    p.shape = shape;
    build(p, shape);
  }
  if (!p.ready) {
    p.ready = true;
    fill(p);
    // Open a third of the way through a run, with the stream already landing.
    for (let i = 0; i < 260; i++) step(p);
  }
  p.layers = Math.max(1, Math.min(6, Math.round(k[3])));
  // At 0 the sand is a sea green rather than red.
  p.hue = k[0] + 0.44;

  if (input.btnPressed && input.btnPressed[0] && p.turn < 0) p.turn = 0;
  if (p.turn >= 0) {
    p.turn += dt / TURN;
    if (p.turn >= 1) {
      spin(p);
      p.turn = -1;
      p.idle = 0;
      p.acc = 0;
    }
    return;
  }
  p.acc += dt * 11 * k[1];
  let n = 0;
  while (p.acc >= 1 && n < 8) {
    step(p);
    p.acc -= 1;
    n++;
  }
  if (p.acc > 1) p.acc = 1;
  // Once the top is empty and the heap has stopped sliding, wait a moment and turn.
  if (p.top === 0 && p.moved === 0) {
    p.idle += dt;
    if (p.idle > 1.2) p.turn = 0;
  } else p.idle = 0;
}

export function draw(display, params, time) {
  const p = params;
  const cell = p.cell;
  const ord = p.ord;
  const wall = p.wall;
  const img = p.img;
  const lut = p.lut;
  const layers = p.layers;
  for (let b = 0; b < layers; b++) {
    // Neighbouring bands step a little round the wheel and alternate light and dark.
    const h = p.hue + b * 0.09;
    const light = b & 1 ? 0.6 : 1;
    for (let s = 0; s < 4; s++) hsv(h, 0.5 + s * 0.04, (0.62 + s * 0.11) * light, lut, (b * 4 + s) * 3);
  }
  for (let y = 0; y < H; y++) {
    const hw = p.hw[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 3;
      const c = cell[i];
      let r = 0;
      let g = 0;
      let b = 0;
      if (c >= 2) {
        const l = ((ord[i] * layers) >> 8) * 12 + (c - 2) * 3;
        r = lut[l];
        g = lut[l + 1];
        b = lut[l + 2];
      } else if (wall[i]) {
        r = 74;
        g = 96;
        b = 118;
      } else if (c === 0) {
        // A faint glint down one side of each bulb, mirrored so it survives the turn.
        const dx = x + 0.5 - W / 2;
        const side = y < MID ? -dx : dx;
        if (hw > 8 && side > hw * 0.55 && side < hw * 0.55 + 1.2) {
          r = 26;
          g = 32;
          b = 40;
        }
      } else if (y < 4 || y >= H - 4) {
        // The two wooden ends, lit on their outer face.
        const outer = y === 0 || y === H - 1;
        r = outer ? 150 : 108;
        g = outer ? 92 : 62;
        b = outer ? 46 : 28;
      } else if (x === 1 || x === W - 2) {
        r = 128;
        g = 78;
        b = 38;
      } else if (x === 2 || x === W - 3) {
        r = 84;
        g = 48;
        b = 22;
      }
      img[o] = r;
      img[o + 1] = g;
      img[o + 2] = b;
    }
  }
  if (p.turn < 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3;
        display.setPixel(x, y, img[o], img[o + 1], img[o + 2]);
      }
    }
    return;
  }
  // The turn: the whole glass rotates half a turn about the middle, shrinking
  // so that lying on its side it still fits across the panel.
  const u = p.turn;
  const e = u * u * (3 - 2 * u);
  const a = e * Math.PI;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const fit = Math.min(1, W / (W * Math.abs(ca) + H * Math.abs(sa)), H / (W * Math.abs(sa) + H * Math.abs(ca)));
  const inv = 1 / fit;
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = (x + 0.5 - cx) * inv;
      const py = (y + 0.5 - cy) * inv;
      const sx = ca * px + sa * py + cx - 0.5;
      const sy = -sa * px + ca * py + cy - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let q = 0; q < 4; q++) {
        const xx = x0 + (q & 1);
        const yy = y0 + (q >> 1);
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const w = (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy);
        const o = (yy * W + xx) * 3;
        r += img[o] * w;
        g += img[o + 1] * w;
        b += img[o + 2] * w;
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
