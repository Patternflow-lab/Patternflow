// ===== Patternflow pattern =====
// Title:   Truchet
// Family:  geometry
// Idea:    Every tile holds the same two quarter circles, and turning one tile a quarter turn is enough to join two paths into one or cut one in two.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 128x64
// @knobs Hue=0..1, Flip Rate=0..5, Tile=8..20, Thickness=0..1
//
// Knob 1: Hue. Turns the path colours around the colour wheel.
// Knob 2: Flip Rate. How often a wave of quarter turns crosses the panel; at 0 the paths hold still and only the light runs along them.
// Knob 3: Tile. Tile size in LEDs; small is a dense meander, large a few wide loops.
// Knob 4: Thickness. Line width, from a thin wire to fat ribbons with small dark holes between them.
// Buttons: K1 tap turns a quarter of the tiles at once.

function hsv(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  const r = k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v;
  const g = k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p;
  const b = k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q;
  return [r * 255, g * 255, b * 255];
}

function hash(a, b) {
  let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// Room for tiles down to 4 LEDs, so nothing is allocated after setup.
const MAX_TILES = 32 * 16;
const MAX_NODES = 17 * 32 + 16 * 33;
const HALF_PI = Math.PI / 2;
// Arcs between two pulses of light.
const PULSE = 5;

export function setup(params) {
  params.from = new Uint8Array(MAX_TILES);
  params.to = new Uint8Array(MAX_TILES);
  params.prog = new Float32Array(MAX_TILES);
  params.cross = new Int32Array(MAX_TILES);
  params.bit = new Uint8Array(MAX_TILES);
  params.cos = new Float32Array(MAX_TILES);
  params.sin = new Float32Array(MAX_TILES);
  params.fill = new Float32Array(MAX_TILES);
  params.arcA = new Int32Array(MAX_TILES * 2);
  params.arcB = new Int32Array(MAX_TILES * 2);
  params.arcStart = new Float32Array(MAX_TILES * 2);
  params.arcRev = new Uint8Array(MAX_TILES * 2);
  params.arcPeriod = new Float32Array(MAX_TILES * 2);
  params.arcTarget = new Float32Array(MAX_TILES * 2);
  params.arcHue = new Float32Array(MAX_TILES * 2);
  params.arcCol = new Float32Array(MAX_TILES * 2 * 3);
  params.seen = new Uint8Array(MAX_TILES * 2);
  params.walk = new Int32Array(MAX_TILES * 2);
  params.nodeArc = new Int32Array(MAX_NODES * 2);
  params.colTile = new Int16Array(128);
  params.colLocal = new Float32Array(128);
  params.rowTile = new Int16Array(64);
  params.rowLocal = new Float32Array(64);
  params.size = 0;
  params.wave = 0;
  params.flow = 0;
  params.kick = 0;
}

function build(params, size) {
  params.size = size;
  params.tw = Math.ceil(128 / size);
  params.th = Math.ceil(64 / size);
  // The grid is centred, so a size that does not divide the panel crops evenly.
  const ox = (params.tw * size - 128) / 2;
  const oy = (params.th * size - 64) / 2;
  for (let x = 0; x < 128; x++) {
    const gx = x + 0.5 + ox;
    params.colTile[x] = Math.floor(gx / size);
    params.colLocal[x] = gx - params.colTile[x] * size;
  }
  for (let y = 0; y < 64; y++) {
    const gy = y + 0.5 + oy;
    params.rowTile[y] = Math.floor(gy / size);
    params.rowLocal[y] = gy - params.rowTile[y] * size;
  }
  const n = params.tw * params.th;
  for (let t = 0; t < n; t++) {
    const b = hash(t, 7) < 0.5 ? 1 : 0;
    params.from[t] = b;
    params.to[t] = b;
    params.prog[t] = 1;
    params.cross[t] = -1 << 30;
  }
  params.arcHue.fill(-1);
  trace(params);
}

// Join the arcs into paths. Each path is numbered from its lowest edge
// midpoint, so a path no flip touched keeps its colour and its pulses.
function trace(params) {
  const tw = params.tw;
  const th = params.th;
  const hCount = (th + 1) * tw;
  const nodes = hCount + th * (tw + 1);
  const nodeArc = params.nodeArc;
  nodeArc.fill(-1, 0, nodes * 2);
  const link = (node, arc) => {
    if (nodeArc[node * 2] < 0) nodeArc[node * 2] = arc;
    else nodeArc[node * 2 + 1] = arc;
  };
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const t = j * tw + i;
      const top = j * tw + i;
      const bottom = (j + 1) * tw + i;
      const left = hCount + j * (tw + 1) + i;
      const right = left + 1;
      const logical = params.prog[t] < 0.5 ? params.from[t] : params.to[t];
      // Arc 0 starts at the top edge, arc 1 at the bottom edge.
      params.arcA[t * 2] = top;
      params.arcB[t * 2] = logical ? right : left;
      params.arcA[t * 2 + 1] = bottom;
      params.arcB[t * 2 + 1] = logical ? left : right;
      link(top, t * 2);
      link(params.arcB[t * 2], t * 2);
      link(bottom, t * 2 + 1);
      link(params.arcB[t * 2 + 1], t * 2 + 1);
    }
  }
  const arcs = tw * th * 2;
  params.seen.fill(0, 0, arcs);
  const walk = (start, first) => {
    let node = start;
    let arc = first;
    let len = 0;
    while (arc >= 0 && !params.seen[arc]) {
      params.seen[arc] = 1;
      params.walk[len] = arc;
      params.arcStart[arc] = len;
      const forward = params.arcA[arc] === node;
      params.arcRev[arc] = forward ? 0 : 1;
      node = forward ? params.arcB[arc] : params.arcA[arc];
      len++;
      arc = nodeArc[node * 2] === arc ? nodeArc[node * 2 + 1] : nodeArc[node * 2];
    }
    const closed = arc >= 0;
    // A closed loop fits a whole number of pulses, so it has no seam.
    const period = closed ? len / Math.max(1, Math.round(len / PULSE)) : PULSE;
    const r = hash(start, 3);
    let hue = Math.floor(r * 5) * 0.035 - 0.07;
    if (hash(start, 11) < 0.12) hue += 0.5;
    for (let w = 0; w < len; w++) {
      params.arcPeriod[params.walk[w]] = period;
      params.arcTarget[params.walk[w]] = hue;
    }
  };
  for (let node = 0; node < nodes; node++) {
    if (nodeArc[node * 2 + 1] < 0 && nodeArc[node * 2] >= 0 && !params.seen[nodeArc[node * 2]]) walk(node, nodeArc[node * 2]);
  }
  for (let node = 0; node < nodes; node++) {
    const a = nodeArc[node * 2];
    const b = nodeArc[node * 2 + 1];
    if (a < 0 || b < 0 || params.seen[a]) continue;
    const na = params.arcA[a] === node ? params.arcB[a] : params.arcA[a];
    const nb = params.arcA[b] === node ? params.arcB[b] : params.arcA[b];
    walk(node, na < nb ? a : b);
  }
  for (let a = 0; a < arcs; a++) if (params.arcHue[a] < -0.5) params.arcHue[a] = params.arcTarget[a];
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 8, 0.06];
  // K1 at 0 opens on teal rather than the red most of the study opens on.
  params.hue = k[0] + 0.48;
  params.rate = k[1];
  params.thick = k[3];
  const size = Math.round(k[2]);
  if (size !== params.size) build(params, size);
  const tw = params.tw;
  const th = params.th;
  const n = tw * th;
  const kick = input.btnPressed && input.btnPressed[0];
  if (kick) params.kick++;

  params.wave += dt * params.rate * 0.12;
  params.flow += dt * 0.45;
  let dirty = false;
  for (let t = 0; t < n; t++) {
    const i = t % tw;
    const j = (t - i) / tw;
    // The front runs diagonally, and each pass turns a different third of the tiles.
    const c = (i + j * 0.7 + 1.5 * Math.sin(j * 0.6)) / (tw + th * 0.7 + 3);
    const count = Math.floor(params.wave - c);
    let flip = false;
    if (count !== params.cross[t]) {
      if (params.cross[t] !== -1 << 30 && hash(t, count) < 0.35) flip = true;
      params.cross[t] = count;
    }
    if (kick && hash(t, 1000 + params.kick) < 0.25) flip = true;
    if (flip && params.prog[t] >= 1) {
      params.from[t] = params.to[t];
      params.to[t] = 1 - params.to[t];
      params.prog[t] = 0;
    }
    if (params.prog[t] < 1) {
      const before = params.prog[t];
      params.prog[t] = Math.min(1, before + dt / 0.5);
      if (before < 0.5 && params.prog[t] >= 0.5) dirty = true;
    }
    const pr = params.prog[t];
    params.fill[t] = 1 - Math.sin(pr * Math.PI);
    if (pr >= 1) {
      params.bit[t] = params.to[t];
      params.cos[t] = 1;
      params.sin[t] = 0;
    } else {
      const eased = pr * pr * (3 - 2 * pr);
      const ang = pr < 0.5 ? eased * HALF_PI : (eased - 1) * HALF_PI;
      params.bit[t] = pr < 0.5 ? params.from[t] : params.to[t];
      params.cos[t] = Math.cos(ang);
      params.sin[t] = Math.sin(ang);
    }
  }
  if (dirty) trace(params);
  // A path that was joined to another one eases into its new colour.
  const ease = Math.min(1, dt * 3);
  for (let a = 0; a < n * 2; a++) {
    let d = params.arcTarget[a] - params.arcHue[a];
    d -= Math.round(d);
    params.arcHue[a] += d * ease;
    params.arcHue[a] -= Math.floor(params.arcHue[a]);
    const col = hsv(params.hue + params.arcHue[a], 0.85, 1);
    params.arcCol[a * 3] = col[0];
    params.arcCol[a * 3 + 1] = col[1];
    params.arcCol[a * 3 + 2] = col[2];
  }
}

export function draw(display, params, time) {
  const S = params.size;
  const half = S / 2;
  const tw = params.tw;
  const hw = 0.8 + params.thick * (S * 0.235 - 0.8);
  const ground = hsv(params.hue + 0.6, 0.85, 0.16);
  for (let y = 0; y < 64; y++) {
    const ty = params.rowTile[y];
    const ly = params.rowLocal[y] - half;
    for (let x = 0; x < 128; x++) {
      const t = ty * tw + params.colTile[x];
      const lx = params.colLocal[x] - half;
      const c = params.cos[t];
      const s = params.sin[t];
      const px = c * lx + s * ly + half;
      const py = -s * lx + c * ly + half;
      let d0;
      let d1;
      if (params.bit[t] === 0) {
        d0 = Math.hypot(px, py) - half;
        d1 = Math.hypot(S - px, S - py) - half;
      } else {
        d0 = Math.hypot(S - px, py) - half;
        d1 = Math.hypot(px, S - py) - half;
      }
      const which = Math.abs(d0) <= Math.abs(d1) ? 0 : 1;
      const d = which === 0 ? Math.abs(d0) : Math.abs(d1);
      const cover = Math.min(1, hw + 0.5 - d);
      if (cover <= 0) {
        // The two kinds of region between paths alternate like a chessboard;
        // one of them glows faintly, and fades while its tile turns.
        const inside = d0 < 0 || d1 < 0;
        const parity = (ty + params.colTile[x] + (inside ? params.bit[t] : 1 - params.bit[t])) & 1;
        if (parity) {
          const f = params.fill[t];
          display.setPixel(x, y, ground[0] * f, ground[1] * f, ground[2] * f);
        } else display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // Where along the arc this LED sits, from its first end to its second.
      let theta;
      if (params.bit[t] === 0) theta = which === 0 ? Math.atan2(py, px) : Math.atan2(S - py, S - px);
      else theta = which === 0 ? Math.atan2(py, S - px) : Math.atan2(S - py, px);
      const along = Math.max(0, Math.min(1, theta / HALF_PI));
      const arc = t * 2 + which;
      const dist = params.arcStart[arc] + (params.arcRev[arc] ? 1 - along : along);
      const wave = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (dist / params.arcPeriod[arc] - params.flow));
      const v = (0.4 + 0.6 * wave * wave * wave) * cover;
      const col = params.arcCol;
      display.setPixel(x, y, col[arc * 3] * v, col[arc * 3 + 1] * v, col[arc * 3 + 2] * v);
    }
  }
}
