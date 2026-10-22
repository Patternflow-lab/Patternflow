// ===== Patternflow pattern =====
// Title:   Maze
// Family:  algo
// Idea:    A maze is carved cell by cell, a breadth-first flood from the way in colours every corridor by its distance, the shortest way out is traced bright, and the maze crumbles for the next one.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Cell=2..4, Carver=0..3
//
// Knob 1: Hue. Turns the flood, which runs from gold at the way in through red to violet at the far ends, and the carver's lit cells with it.
// Knob 2: Speed. Carving, flood and trace together, from about 50 carving steps a second to about 1100.
// Knob 3: Cell. Corridor width in LEDs: 2 gives a maze of 21 by 42 cells, 4 one of 12 by 25.
// Knob 4: Carver. 0 recursive backtracker with its stack lit, 1 Prim's with its frontier lit, 2 Kruskal's with each joined patch its own shade, 3 sidewinder row by row.
// Buttons: K1 tap crumbles the maze and carves a new one.

const W = 64;
const H = 128;
const MAXC = 900;

const CARVE = 0;
const FLOOD = 1;
const TRACE = 2;
const HOLD = 3;
const CRUMBLE = 4;

const BACKTRACK = 0;
const PRIM = 1;
const KRUSKAL = 2;

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = 255 * (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v);
  out[o + 1] = 255 * (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p);
  out[o + 2] = 255 * (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q);
}

export function setup(params) {
  const P = params;
  // Every LED says what it shows: a cell, the wall a passage can open in
  // (N + 2a to the right of cell a, N + 2a + 1 below it), or -1 for a wall
  // that never opens.
  P.map = new Int16Array(W * H);
  P.openR = new Uint8Array(MAXC);
  P.openD = new Uint8Array(MAXC);
  P.inMaze = new Uint8Array(MAXC);
  P.seq = new Int16Array(MAXC);
  P.mark = new Uint8Array(MAXC);
  P.stack = new Int16Array(MAXC);
  P.front = new Int16Array(MAXC);
  P.parent = new Int16Array(MAXC);
  P.size = new Int16Array(MAXC);
  P.edges = new Int16Array(MAXC * 2);
  P.dist = new Int16Array(MAXC);
  P.from = new Int16Array(MAXC);
  P.queue = new Int16Array(MAXC);
  P.onPath = new Uint8Array(MAXC);
  P.thr = new Float32Array(MAXC);
  P.rgb = new Float32Array(MAXC * 3);
  P.nb = new Int16Array(4);
  P.floodLut = new Float32Array(64 * 3);
  P.patchLut = new Float32Array(16 * 3);
  P.pal = new Float32Array(4 * 3);
  P.cell = 0;
  P.carver = 0;
  P.hueKey = -1;
  P.phase = CARVE;
  P.t = 0;
  P.acc = 0;
}

function build(P, c) {
  const pitch = c + 1;
  const cols = Math.floor((W - 1) / pitch);
  const rows = Math.floor((H - 1) / pitch);
  const N = cols * rows;
  P.cols = cols;
  P.rows = rows;
  P.N = N;
  P.cell = c;
  P.ox = (W - (cols * pitch + 1)) >> 1;
  P.oy = (H - (rows * pitch + 1)) >> 1;
  P.map.fill(-1);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const a = cy * cols + cx;
      const x0 = P.ox + cx * pitch + 1;
      const y0 = P.oy + cy * pitch + 1;
      for (let y = 0; y < c; y++) {
        for (let x = 0; x < c; x++) P.map[(y0 + y) * W + x0 + x] = a;
        if (cx < cols - 1) P.map[(y0 + y) * W + x0 + c] = N + a * 2;
      }
      if (cy < rows - 1) for (let x = 0; x < c; x++) P.map[(y0 + c) * W + x0 + x] = N + a * 2 + 1;
    }
  }
  P.inX = -1;
  P.outX = -1;
}

// The way in is a gap in the top edge above one cell, the way out one in the
// bottom edge; the LEDs of the gap belong to the cell beside them.
function doors(P, value) {
  const c = P.cell;
  const pitch = c + 1;
  const top = P.oy * W;
  const bottom = (P.oy + P.rows * pitch) * W;
  for (let x = 0; x < c; x++) {
    if (P.inX >= 0) P.map[top + P.ox + P.inX * pitch + 1 + x] = value ? P.start : -1;
    if (P.outX >= 0) P.map[bottom + P.ox + P.outX * pitch + 1 + x] = value ? P.goal : -1;
  }
}

function open(P, a, b) {
  if (b === a + 1) P.openR[a] = 1;
  else if (b === a - 1) P.openR[b] = 1;
  else if (b > a) P.openD[a] = 1;
  else P.openD[b] = 1;
}

// The neighbours of a with inMaze equal to want go into P.nb.
function neighbours(P, a, want) {
  const cols = P.cols;
  const x = a % cols;
  let n = 0;
  if (x > 0 && P.inMaze[a - 1] === want) P.nb[n++] = a - 1;
  if (x < cols - 1 && P.inMaze[a + 1] === want) P.nb[n++] = a + 1;
  if (a >= cols && P.inMaze[a - cols] === want) P.nb[n++] = a - cols;
  if (a + cols < P.N && P.inMaze[a + cols] === want) P.nb[n++] = a + cols;
  return n;
}

function join(P, a) {
  P.inMaze[a] = 1;
  P.seq[a] = ++P.seqN;
}

function find(P, a) {
  const parent = P.parent;
  while (parent[a] !== a) {
    parent[a] = parent[parent[a]];
    a = parent[a];
  }
  return a;
}

function addFront(P, a) {
  const n = neighbours(P, a, 0);
  for (let i = 0; i < n; i++) {
    const b = P.nb[i];
    if (!P.mark[b]) {
      P.mark[b] = 1;
      P.front[P.fN++] = b;
    }
  }
}

function newMaze(P, carver) {
  const N = P.N;
  doors(P, false);
  P.openR.fill(0);
  P.openD.fill(0);
  P.inMaze.fill(0);
  P.mark.fill(0);
  P.onPath.fill(0);
  P.seq.fill(-1);
  P.seqN = 0;
  P.carver = carver;
  P.inX = Math.floor(Math.random() * P.cols);
  P.outX = Math.floor(Math.random() * P.cols);
  P.start = P.inX;
  P.goal = (P.rows - 1) * P.cols + P.outX;
  doors(P, true);
  P.phase = CARVE;
  P.solved = false;
  P.acc = 0;
  P.t = 0;
  if (carver === BACKTRACK) {
    join(P, P.start);
    P.stack[0] = P.start;
    P.sp = 1;
    P.mark[P.start] = 1;
    P.total = 2 * N;
  } else if (carver === PRIM) {
    join(P, P.start);
    P.fN = 0;
    addFront(P, P.start);
    P.total = N;
  } else if (carver === KRUSKAL) {
    let e = 0;
    for (let a = 0; a < N; a++) {
      P.parent[a] = a;
      P.size[a] = 1;
      if (a % P.cols < P.cols - 1) P.edges[e++] = a * 2;
      if (a + P.cols < N) P.edges[e++] = a * 2 + 1;
    }
    for (let i = e - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = P.edges[i];
      P.edges[i] = P.edges[j];
      P.edges[j] = t;
    }
    P.eN = e;
    P.eAt = 0;
    P.total = N;
  } else {
    P.sx = 0;
    P.sy = 0;
    P.run = 0;
    P.total = N;
  }
}

// One step of the carver; false once the maze is whole.
function carve(P) {
  const cols = P.cols;
  if (P.carver === BACKTRACK) {
    if (P.sp === 0) return false;
    const a = P.stack[P.sp - 1];
    const n = neighbours(P, a, 0);
    if (n > 0) {
      const b = P.nb[Math.floor(Math.random() * n)];
      open(P, a, b);
      join(P, b);
      P.mark[b] = 1;
      P.stack[P.sp++] = b;
    } else {
      P.mark[a] = 0;
      P.sp--;
    }
    return true;
  }
  if (P.carver === PRIM) {
    if (P.fN === 0) return false;
    const i = Math.floor(Math.random() * P.fN);
    const a = P.front[i];
    P.front[i] = P.front[--P.fN];
    P.mark[a] = 0;
    const n = neighbours(P, a, 1);
    open(P, a, P.nb[Math.floor(Math.random() * n)]);
    join(P, a);
    addFront(P, a);
    return true;
  }
  if (P.carver === KRUSKAL) {
    while (P.eAt < P.eN) {
      const e = P.edges[P.eAt++];
      const a = e >> 1;
      const b = e & 1 ? a + cols : a + 1;
      let ra = find(P, a);
      let rb = find(P, b);
      if (ra === rb) continue;
      // The bigger patch keeps its root, and with it its shade.
      if (P.size[ra] < P.size[rb]) {
        const t = ra;
        ra = rb;
        rb = t;
      }
      P.parent[rb] = ra;
      P.size[ra] += P.size[rb];
      open(P, a, b);
      if (!P.inMaze[a]) join(P, a);
      if (!P.inMaze[b]) join(P, b);
      return true;
    }
    return false;
  }
  // Sidewinder: each row runs east and, where a run ends, one cell of it
  // opens north. The top row is one long corridor.
  if (P.sy >= P.rows) return false;
  const a = P.sy * cols + P.sx;
  join(P, a);
  if (P.sy === 0) {
    if (P.sx < cols - 1) P.openR[a] = 1;
  } else if (P.sx === cols - 1 || Math.random() < 0.5) {
    const r = P.run + Math.floor(Math.random() * (P.sx - P.run + 1));
    P.openD[(P.sy - 1) * cols + r] = 1;
    P.run = P.sx + 1;
  } else P.openR[a] = 1;
  P.sx++;
  if (P.sx >= cols) {
    P.sx = 0;
    P.sy++;
    P.run = 0;
  }
  return true;
}

// The whole breadth-first search is done at once; the flood on screen only
// reveals it a layer at a time.
function solve(P) {
  const N = P.N;
  const cols = P.cols;
  P.dist.fill(-1, 0, N);
  P.dist[P.start] = 0;
  P.queue[0] = P.start;
  let qh = 0;
  let qt = 1;
  let far = 0;
  while (qh < qt) {
    const a = P.queue[qh++];
    const d = P.dist[a] + 1;
    const x = a % cols;
    for (let k = 0; k < 4; k++) {
      let b = -1;
      if (k === 0 && x > 0 && P.openR[a - 1]) b = a - 1;
      else if (k === 1 && x < cols - 1 && P.openR[a]) b = a + 1;
      else if (k === 2 && a >= cols && P.openD[a - cols]) b = a - cols;
      else if (k === 3 && a + cols < N && P.openD[a]) b = a + cols;
      if (b >= 0 && P.dist[b] < 0) {
        P.dist[b] = d;
        P.from[b] = a;
        P.queue[qt++] = b;
        if (d > far) far = d;
      }
    }
  }
  P.far = far;
  for (let a = P.goal; a !== P.start; a = P.from[a]) P.onPath[a] = 1;
  P.onPath[P.start] = 1;
  // The crumble takes the side corridors first, in no order, and the path last.
  for (let a = 0; a < N; a++) P.thr[a] = P.onPath[a] ? 0.72 + 0.12 * Math.random() : Math.random() * 0.7;
  P.phase = FLOOD;
  P.solved = true;
  P.front0 = -2;
  P.trace = -1e9;
  P.acc = 0;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 2, 0.06];
  const cell = Math.max(2, Math.min(4, Math.round(k[2])));
  const carver = Math.max(0, Math.min(3, Math.round(k[3])));
  const pace = Math.pow(2, 1.1 * k[1]);

  if (cell !== P.cell) {
    build(P, cell);
    newMaze(P, carver);
    // Open on a maze already under way rather than a dark panel.
    for (let i = Math.floor(P.total * 0.4); i > 0; i--) carve(P);
  } else if (carver !== P.carver && P.phase === CARVE) {
    newMaze(P, carver);
    for (let i = Math.floor(P.total * 0.25); i > 0; i--) carve(P);
  }
  if (input.btnPressed && input.btnPressed[0] && P.phase !== CRUMBLE) {
    // A maze still being carved has no path yet, so it all crumbles in no order.
    if (!P.solved) for (let a = 0; a < P.N; a++) P.thr[a] = Math.random() * 0.85;
    P.phase = CRUMBLE;
    P.t = 0;
  }

  if (P.phase === CARVE) {
    // Bigger cells are fewer, so they carve slower in step and a maze takes
    // about as long whatever its size.
    P.acc += dt * 50 * pace * (P.N / 882);
    let n = 0;
    while (P.acc >= 1 && n < 400) {
      P.acc -= 1;
      n++;
      if (!carve(P)) {
        solve(P);
        break;
      }
    }
    if (P.acc > 1) P.acc = 1;
  } else if (P.phase === FLOOD) {
    P.front0 += dt * 26 * pace * Math.sqrt(P.N / 882);
    if (P.front0 > P.far + 6) {
      P.front0 = P.far + 6;
      P.phase = TRACE;
      P.trace = -2;
    }
  } else if (P.phase === TRACE) {
    P.trace += dt * 40 * pace * Math.sqrt(P.N / 882);
    if (P.trace > P.dist[P.goal] + 4) {
      P.phase = HOLD;
      P.t = 0;
    }
  } else if (P.phase === HOLD) {
    P.t += dt;
    if (P.t > 1.4) {
      P.phase = CRUMBLE;
      P.t = 0;
    }
  } else {
    P.t += dt * Math.min(2, 0.7 + 0.3 * pace);
    if (P.t > 1.1) newMaze(P, carver);
  }

  const hue = k[0] + 0.14;
  if (hue !== P.hueKey) {
    P.hueKey = hue;
    // The flood runs backwards round the wheel from the way in, gold through
    // red to violet, and stays bright: a dim orange would read as brown.
    for (let i = 0; i < 64; i++) hsvInto(P.floodLut, i * 3, hue - 0.42 * (i / 63), 0.8, 0.85);
    // The bare maze is slate whatever the hue, and Kruskal's patches are
    // shades of it, from teal to violet.
    for (let i = 0; i < 16; i++) hsvInto(P.patchLut, i * 3, 0.5 + 0.32 * (((i * 7) % 16) / 15), 0.5, 0.5 + 0.2 * (i / 15));
    hsvInto(P.pal, 0, 0.6, 0.3, 0.42);
    hsvInto(P.pal, 3, hue, 0.8, 0.85);
    hsvInto(P.pal, 6, hue + 0.4, 0.35, 1);
  }
  colourCells(P);
}

function mixWhite(out, o, g) {
  out[o] += (228 - out[o]) * g;
  out[o + 1] += (228 - out[o + 1]) * g;
  out[o + 2] += (228 - out[o + 2]) * g;
}

function colourCells(P) {
  const N = P.N;
  const rgb = P.rgb;
  const pal = P.pal;
  const carving = !P.solved;
  // A tap mid-flood or mid-trace crumbles what is shown at that moment.
  const shown = P.front0;
  const lit = P.trace;
  const back = 1 - 0.4 * Math.max(0, Math.min(1, (P.trace + 2) / 30));
  for (let a = 0; a < N; a++) {
    const o = a * 3;
    if (carving && !P.inMaze[a]) {
      // Prim's frontier waits dim in the accent colour.
      const f = P.carver === PRIM && P.mark[a] ? 0.7 : 0;
      rgb[o] = pal[3] * f;
      rgb[o + 1] = pal[4] * f;
      rgb[o + 2] = pal[5] * f;
    } else if (carving) {
      if (P.carver === KRUSKAL) {
        const s = (Math.imul(find(P, a) + 1, 2654435761) >>> 28) * 3;
        rgb[o] = P.patchLut[s];
        rgb[o + 1] = P.patchLut[s + 1];
        rgb[o + 2] = P.patchLut[s + 2];
      } else {
        // The backtracker's stack, and the sidewinder's open run, in the accent.
        let c = 0;
        if (P.carver === BACKTRACK && P.mark[a]) c = 3;
        else if (P.carver === 3 && a >= P.sy * P.cols + P.run && a < P.sy * P.cols + P.sx) c = 3;
        rgb[o] = pal[c];
        rgb[o + 1] = pal[c + 1];
        rgb[o + 2] = pal[c + 2];
      }
      // The cell the carver stands on is white: the backtracker's head even
      // as it backs up, for the others the cells carved in the last six steps.
      if (P.carver === BACKTRACK) {
        if (P.sp > 0 && a === P.stack[P.sp - 1]) mixWhite(rgb, o, 1);
      } else {
        const age = P.seqN - P.seq[a];
        if (age < 6) mixWhite(rgb, o, 1 - age / 6);
      }
    } else {
      const d = P.dist[a];
      if (d < 0 || d > shown) {
        rgb[o] = pal[0];
        rgb[o + 1] = pal[1];
        rgb[o + 2] = pal[2];
      } else {
        const s = Math.min(63, Math.floor((d * 63) / Math.max(1, P.far))) * 3;
        rgb[o] = P.floodLut[s];
        rgb[o + 1] = P.floodLut[s + 1];
        rgb[o + 2] = P.floodLut[s + 2];
        // The newest layers of the flood are its white front.
        if (shown - d < 5) mixWhite(rgb, o, 1 - (shown - d) / 5);
      }
      if (P.onPath[a] && d <= lit) {
        rgb[o] = pal[6];
        rgb[o + 1] = pal[7];
        rgb[o + 2] = pal[8];
        if (lit - d < 4) mixWhite(rgb, o, 1 - (lit - d) / 4);
      } else if (back < 1) {
        // The rest of the maze steps back while the path is drawn.
        rgb[o] *= back;
        rgb[o + 1] *= back;
        rgb[o + 2] *= back;
      }
    }
    if (P.phase === CRUMBLE) {
      const f = Math.max(0, Math.min(1, 1 - (P.t - P.thr[a]) / 0.16));
      rgb[o] *= f;
      rgb[o + 1] *= f;
      rgb[o + 2] *= f;
    }
  }
}

export function draw(display, params, time) {
  const P = params;
  const N = P.N;
  const rgb = P.rgb;
  const map = P.map;
  const carving = !P.solved;
  const cols = P.cols;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = map[y * W + x];
      if (v < 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      let c = v;
      if (v >= N) {
        const e = v - N;
        const a = e >> 1;
        if (!(e & 1 ? P.openD[a] : P.openR[a])) {
          display.setPixel(x, y, 0, 0, 0);
          continue;
        }
        const b = e & 1 ? a + cols : a + 1;
        // A passage shows whichever of its two cells came later: carved
        // later while carving, reached later by the flood after.
        if (carving) c = P.seq[a] > P.seq[b] ? a : b;
        else c = P.dist[a] > P.dist[b] ? a : b;
      }
      display.setPixel(x, y, rgb[c * 3], rgb[c * 3 + 1], rgb[c * 3 + 2]);
    }
  }
}
