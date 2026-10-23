// ===== Patternflow pattern =====
// Title:   Tetromino Well
// Family:  algo
// Idea:    The standing panel is a falling-block well ten cells wide and twenty-one tall, and a player that never tires stacks the pieces two thirds of the way up before it burns them down, four lines at a time when the long bar comes.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the falling-block puzzle of Tetris (Alexey Pajitnov, 1984); the player weighs every landing with holes, bumps and wells, after Pierre Dellacherie's one-piece controller
// Round:   10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Headroom=6..18, Garbage=0..1
//
// Knob 1: Hue. Turns the seven piece colours together, starting from the usual cyan bar, yellow square, purple T, green S, red Z, blue J and orange L.
// Knob 2: Speed. How fast pieces fall and rows clear: where it starts a piece drops ten rows a second, at the bottom of the range it drifts down one.
// Knob 3: Headroom. The rows the player keeps free above its stack: at 6 it builds two thirds of the way up the panel before it starts taking lines, at 18 it keeps the stack on the floor.
// Knob 4: Garbage. The chance that a grey row with one hole pushes up from the floor as each piece arrives; turned up, the stack climbs until it tops out and the floor drops it.
// Buttons: K1 tap sends the long bar next, and the player drops it into the well for four lines if four are ready.

const W = 64;
const H = 128;
const N = W * H;
const CELL = 6;
const COLS = 10;
const ROWS = 21;
// Two rows above the panel where a piece comes in from.
const HID = 2;
const BR = ROWS + HID;
// 10 cells of 6 LEDs leave two LEDs of wall on each side; 21 rows leave two LEDs of floor.
const X0 = 2;
// The player keeps the right-hand column open for the long bar.
const WELL = COLS - 1;
const GARBAGE = 8;
const BUILD = 0;
const BURN = 1;
const PANIC = 2;

// Spawn shapes, (x, y) in a 4×4 box for the bar and a 3×3 box for the rest:
// I, O, T, S, Z, J, L.
const SHAPES = [
  [[0, 1], [1, 1], [2, 1], [3, 1]],
  [[1, 0], [2, 0], [1, 1], [2, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[2, 0], [0, 1], [1, 1], [2, 1]],
];
// The guideline colours: cyan, yellow, purple, green, red, blue, orange.
const HUES = [0.5, 0.15, 0.79, 0.33, 0.995, 0.63, 0.075];

// ROT[type][r] is the shape turned r quarters clockwise.
const ROT = SHAPES.map((cells, type) => {
  const out = [cells];
  for (let r = 1; r < 4; r++) {
    const prev = out[r - 1];
    if (type === 1) out.push(prev);
    else if (type === 0) out.push(prev.map(([x, y]) => [3 - y, x]));
    else out.push(prev.map(([x, y]) => [2 - y, x]));
  }
  return out;
});

function hsvInto(out, o, h, s, v) {
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

function fits(board, cells, x, y) {
  for (let i = 0; i < 4; i++) {
    const c = x + cells[i][0];
    const r = y + cells[i][1];
    if (c < 0 || c >= COLS || r >= BR) return false;
    if (r >= 0 && board[r * COLS + c]) return false;
  }
  return true;
}

function dropRow(board, cells, x, y) {
  while (fits(board, cells, x, y + 1)) y++;
  return y;
}

function fullRows(board) {
  const rows = [];
  for (let r = 0; r < BR; r++) {
    let n = 0;
    for (let c = 0; c < COLS; c++) if (board[r * COLS + c]) n++;
    if (n === COLS) rows.push(r);
  }
  return rows;
}

// Take the rows out and let everything above them fall in.
function removeRows(board, rows) {
  let dst = BR - 1;
  for (let src = BR - 1; src >= 0; src--) {
    if (rows.includes(src)) continue;
    if (dst !== src) for (let c = 0; c < COLS; c++) board[dst * COLS + c] = board[src * COLS + c];
    dst--;
  }
  for (; dst >= 0; dst--) for (let c = 0; c < COLS; c++) board[dst * COLS + c] = 0;
}

function heights(board, h) {
  let max = 0;
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < BR && !board[r * COLS + c]) r++;
    h[c] = BR - r;
    if (h[c] > max) max = h[c];
  }
  return max;
}

// How the player likes a board, after Dellacherie with El-Tetris's weights:
// few changes between full and empty along rows and down columns, no holes,
// no narrow pits. The right-hand column counts as wall: the player keeps it
// for the long bar. Three rows from the top it panics and counts it in.
function boardScore(P, board, mode) {
  const h = P.h;
  heights(board, h);
  const last = mode === PANIC ? COLS : WELL;
  let rowT = 0;
  for (let r = 0; r < BR; r++) {
    let prev = 1;
    for (let c = 0; c < last; c++) {
      const f = board[r * COLS + c] ? 1 : 0;
      if (f !== prev) rowT++;
      prev = f;
    }
    if (!prev) rowT++;
  }
  let colT = 0;
  let holes = 0;
  for (let c = 0; c < COLS; c++) {
    let prev = 0;
    for (let r = 0; r < BR; r++) {
      const f = board[r * COLS + c] ? 1 : 0;
      if (f !== prev) colT++;
      if (!f && r >= BR - h[c]) holes++;
      prev = f;
    }
    if (!prev) colT++;
  }
  let wells = 0;
  for (let c = 0; c < last; c++) {
    let depth = 0;
    for (let r = 0; r < BR; r++) {
      const left = c === 0 || board[r * COLS + c - 1];
      const right = c + 1 === last || board[r * COLS + c + 1];
      if (!board[r * COLS + c] && left && right) wells += ++depth;
      else depth = 0;
    }
  }
  let s = -3.2 * rowT - 9.3 * colT - 7.9 * holes - 3.4 * wells;
  if (mode === BURN) for (let c = 0; c < WELL; c++) if (h[c] > P.target) s -= 1.5 * (h[c] - P.target);
  return s;
}

// Drop a piece onto a copy of the board and score the move itself: the piece
// low and its cells in the rows it clears. Below its line the player saves
// the rows that are ready and keeps everything out of the right-hand column;
// at the line it takes four at a time whenever the bar comes; in a panic it
// fills whatever clears a line.
function move(P, board, out, type, rot, x, y, mode) {
  const cells = ROT[type][rot];
  out.set(board);
  let inWell = 0;
  let top = 4;
  let bottom = 0;
  for (let i = 0; i < 4; i++) {
    out[(y + cells[i][1]) * COLS + x + cells[i][0]] = type + 1;
    if (x + cells[i][0] === WELL) inWell++;
    top = Math.min(top, cells[i][1]);
    bottom = Math.max(bottom, cells[i][1]);
  }
  const rows = fullRows(out);
  let eroded = 0;
  for (let i = 0; i < 4; i++) if (rows.includes(y + cells[i][1])) eroded++;
  eroded *= rows.length;
  if (rows.length) removeRows(out, rows);
  const lines = rows.length;
  let s = -4.5 * (BR - y - (top + bottom) / 2) + 3.4 * eroded;
  if (mode === PANIC) s += 8 * lines;
  else if (mode === BURN) {
    if (type !== 0) s -= 40 * inWell;
    s += 8 * lines + (lines === 4 ? 25 : 0);
  } else s -= 40 * inWell + 3.4 * eroded + 12 * lines;
  return s;
}

// Every turn and column a piece can reach by sliding along the top and
// dropping straight down.
function each(board, type, fn) {
  const turns = type === 1 ? 1 : type === 0 || type === 3 || type === 4 ? 2 : 4;
  for (let rot = 0; rot < turns; rot++) {
    const cells = ROT[type][rot];
    if (!fits(board, cells, 3, HID - 1)) continue;
    for (let dir = -1; dir <= 1; dir += 2)
      for (let x = dir < 0 ? 3 : 4; x >= -3 && x <= COLS; x += dir) {
        if (!fits(board, cells, x, HID - 1)) break;
        fn(rot, x, dropRow(board, cells, x, HID - 1));
      }
  }
}

// The best place for this piece, looking one piece ahead when it can: the
// player sees the next piece, as the game shows it.
function choose(P, type, next, force) {
  const board = P.board;
  const max = heights(board, P.h);
  if (max >= P.target) P.burn = true;
  else if (max <= P.target - 3) P.burn = false;
  const mode = max >= ROWS - 3 ? PANIC : P.burn || force ? BURN : BUILD;
  let best = null;
  each(board, type, (rot, x, y) => {
    let s = move(P, board, P.trial, type, rot, x, y, mode);
    if (next >= 0) {
      let after = -Infinity;
      each(P.trial, next, (r2, x2, y2) => {
        const s2 = move(P, P.trial, P.trial2, next, r2, x2, y2, mode) + boardScore(P, P.trial2, mode);
        if (s2 > after) after = s2;
      });
      if (after === -Infinity) after = -1000;
      s += after;
    } else s += boardScore(P, P.trial, mode);
    s += Math.random() * 0.3;
    if (!best || s > best.s) best = { s, rot, x, y };
  });
  return best;
}

function fromBag(P) {
  if (!P.bag.length) {
    P.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = P.bag[i];
      P.bag[i] = P.bag[j];
      P.bag[j] = t;
    }
  }
  return P.bag.pop();
}

// The piece that comes now. The one after it waits dim at the top of the
// well: the player sees it coming, as the game shows it.
function nextType(P) {
  if (P.next < 0) P.next = fromBag(P);
  const type = P.next;
  P.forced = P.forceNext;
  P.forceNext = false;
  P.next = P.after >= 0 ? P.after : fromBag(P);
  P.after = -1;
  return type;
}

// A grey row with one hole pushes the stack up a row. The hole mostly stays
// in the same column for a few rows, the way garbage comes in a block, and
// half the time it lines up under the player's open column.
function addGarbage(P) {
  const b = P.board;
  for (let c = 0; c < COLS; c++) if (b[c]) P.toppled = true;
  b.copyWithin(0, COLS);
  if (Math.random() < 0.3) P.hole = Math.random() < 0.5 ? WELL : Math.floor(Math.random() * COLS);
  for (let c = 0; c < COLS; c++) b[(BR - 1) * COLS + c] = c === P.hole ? 0 : GARBAGE;
  for (let r = 0; r < BR - 1; r++) P.off[r] = P.off[r + 1] + CELL;
  P.off[BR - 1] = CELL;
}

// Play without drawing until the stack stands near the player's line, so the
// panel opens on a game in progress.
function prebuild(P, garbage) {
  P.board.fill(0);
  P.off.fill(0);
  P.vel.fill(0);
  P.burn = false;
  const rows = Math.round(garbage * 6);
  for (let i = 0; i < rows; i++) addGarbage(P);
  P.off.fill(0);
  const extra = Math.floor(Math.random() * 7);
  let after = -1;
  for (let n = 0; n < 400 && after < extra; n++) {
    const type = nextType(P);
    const m = choose(P, type, P.next, false);
    if (!m) break;
    const cells = ROT[type][m.rot];
    for (let i = 0; i < 4; i++) P.board[(m.y + cells[i][1]) * COLS + m.x + cells[i][0]] = type + 1;
    const full = fullRows(P.board);
    if (full.length) removeRows(P.board, full);
    if (after >= 0) after++;
    else if (heights(P.board, P.h) >= P.target - 1) after = 0;
  }
}

function spawn(P) {
  if (P.chance > 0 && Math.random() < P.chance) {
    addGarbage(P);
    if (P.toppled) return topple(P);
  }
  const type = nextType(P);
  const m = choose(P, type, P.next, P.forced);
  if (!m) return topple(P);
  // The piece that waited at the top lights up there and starts to move.
  P.type = type;
  P.rot = 0;
  P.x = 3;
  P.y = HID;
  P.wait = 0;
  P.goal = m;
  P.phase = "move";
  P.clock = 0;
}

// Topped out: the floor opens and the whole stack falls out of the panel.
function topple(P) {
  P.phase = "drop";
  P.clock = 0;
  P.fall = 0;
  P.fallV = 0;
  P.toppled = false;
  P.type = -1;
}

function lock(P) {
  const cells = ROT[P.type][P.rot];
  P.flashCells.length = 0;
  for (let i = 0; i < 4; i++) {
    const r = P.y + cells[i][1];
    const c = P.x + cells[i][0];
    if (r >= 0) P.board[r * COLS + c] = P.type + 1;
    P.flashCells.push(r * COLS + c);
  }
  P.flash = 1;
  P.type = -1;
  const rows = fullRows(P.board);
  if (rows.length) {
    P.clearing = rows;
    P.phase = "clear";
    if (rows.length === 4) P.glow = 1;
  } else P.phase = "rest";
  P.clock = 0;
}

export function setup(params) {
  const P = params;
  P.board = new Uint8Array(BR * COLS);
  P.trial = new Uint8Array(BR * COLS);
  P.trial2 = new Uint8Array(BR * COLS);
  P.h = new Int32Array(COLS);
  // Each board row's offset in LEDs while it falls into a cleared gap or
  // rises over a garbage row, and how fast it is falling.
  P.off = new Float32Array(BR);
  P.vel = new Float32Array(BR);
  P.img = new Float32Array(N * 3);
  P.col = new Float32Array(9 * 3);
  P.bag = [];
  P.next = -1;
  P.after = -1;
  P.wait = 0;
  P.hole = 0;
  P.flashCells = [];
  P.clearing = [];
  P.ready = false;
  P.type = -1;
  P.phase = "rest";
  P.clock = 0;
  P.flash = 0;
  P.glow = 0;
  P.target = 16;
  P.burn = false;
  P.forceNext = false;
  P.forced = false;
  P.toppled = false;
  P.chance = 0;
  P.hue = 0;
  P.time = 0;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  const tempo = Math.max(0.2, Math.min(3, k[1]));
  const headroom = Math.round(Math.max(6, Math.min(18, k[2])));
  const garbage = Math.max(0, Math.min(1, k[3]));
  P.target = ROWS - headroom;
  P.chance = garbage * garbage * 0.5;
  if (!P.ready) {
    P.ready = true;
    prebuild(P, garbage);
    spawn(P);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    if (P.next !== 0) {
      P.after = P.next;
      P.next = 0;
    }
    P.forceNext = true;
  }

  const s = dt * tempo;
  P.time += s;
  P.flash = Math.max(0, P.flash - s * 6);
  P.glow = Math.max(0, P.glow - s * 0.9);
  // The next piece fades in at the top once the live one has dropped clear of it.
  if (P.phase === "drop") P.wait = 0;
  else if (P.type < 0 || P.y > HID + 2.5) P.wait = Math.min(1, P.wait + s * 5);

  // Rows settle: down into a cleared gap under gravity, up over garbage at a steady pace.
  let settling = false;
  for (let r = 0; r < BR; r++) {
    if (P.off[r] < 0) {
      P.vel[r] += 220 * s;
      P.off[r] = Math.min(0, P.off[r] + P.vel[r] * s);
      if (P.off[r] === 0) P.vel[r] = 0;
      settling = true;
    } else if (P.off[r] > 0) {
      P.off[r] = Math.max(0, P.off[r] - 40 * s);
      settling = true;
    }
  }

  P.clock += s;
  if (P.phase === "move") {
    // Turn and slide along the top to the chosen column, a row higher where
    // the stack has come up that far.
    const g = P.goal;
    if (P.clock > 0.07) {
      P.clock = 0;
      if (P.rot !== g.rot) P.rot = (P.rot + 1) % 4;
      else if (P.x !== g.x) P.x += Math.sign(g.x - P.x);
    }
    P.y = fits(P.board, ROT[P.type][P.rot], P.x, HID) ? HID : HID - 1;
    if (P.rot === g.rot && P.x === g.x) {
      P.phase = "fall";
      P.clock = 0;
    }
  } else if (P.phase === "fall") {
    P.y += 5 * s;
    if (P.y >= P.goal.y) {
      P.y = P.goal.y;
      lock(P);
    }
  } else if (P.phase === "clear") {
    // White, then the cells go from the middle out, then the rows above fall in.
    if (P.clock > 0.42) {
      const below = new Int32Array(BR);
      for (let r = 0; r < BR; r++) for (const c of P.clearing) if (c > r) below[r]++;
      removeRows(P.board, P.clearing);
      const moved = new Float32Array(BR);
      let dst = BR - 1;
      for (let src = BR - 1; src >= 0; src--) {
        if (P.clearing.includes(src)) continue;
        moved[dst] = -below[src] * CELL + P.off[src];
        dst--;
      }
      for (let r = 0; r < BR; r++) {
        P.off[r] = r <= dst ? 0 : moved[r];
        P.vel[r] = 0;
      }
      P.clearing = [];
      P.phase = "rest";
      P.clock = 0;
    }
  } else if (P.phase === "rest") {
    if (!settling && P.clock > 0.06) spawn(P);
  } else if (P.phase === "drop") {
    P.fallV += 160 * s;
    P.fall += P.fallV * s;
    if (P.fall > H + CELL * 2) {
      P.board.fill(0);
      P.off.fill(0);
      P.vel.fill(0);
      P.fall = 0;
      P.burn = false;
      P.phase = "rest";
      P.clock = -0.5;
    }
  }
}

function blockInto(img, x0, y0, rgb, o, white, ghost, dim = 1) {
  for (let j = 0; j < CELL; j++) {
    const y = y0 + j;
    if (y < 0 || y >= H) continue;
    for (let i = 0; i < CELL; i++) {
      const x = x0 + i;
      if (x < X0 || x >= X0 + COLS * CELL) continue;
      const rim = i === 0 || j === 0 || i === CELL - 1 || j === CELL - 1;
      if (ghost && !rim) continue;
      let f = 1;
      let lift = 0;
      if (i === CELL - 1 || j === CELL - 1) f = 0.5;
      else if (i === 0 || j === 0) lift = 0.38;
      else if (i === 1 && j === 1) lift = 0.6;
      if (ghost) {
        f = 0.28;
        lift = 0;
      }
      const p = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        let v = rgb[o + ch] * f;
        v += (255 - v) * lift;
        v += (255 - v) * white;
        img[p + ch] = v * dim;
      }
    }
  }
}

export function draw(display, params) {
  const P = params;
  const img = P.img;
  img.fill(0);
  const col = P.col;
  for (let t = 0; t < 7; t++) hsvInto(col, (t + 1) * 3, HUES[t] + P.hue, 0.86, 0.86);
  col[GARBAGE * 3] = 104;
  col[GARBAGE * 3 + 1] = 108;
  col[GARBAGE * 3 + 2] = 122;

  const drop = P.phase === "drop" ? Math.round(P.fall) : 0;
  const clearT = P.phase === "clear" ? P.clock : -1;
  for (let r = 0; r < BR; r++) {
    const y0 = (r - HID) * CELL + Math.round(P.off[r]) + drop;
    if (y0 <= -CELL || y0 >= H) continue;
    const clearing = clearT >= 0 && P.clearing.includes(r);
    for (let c = 0; c < COLS; c++) {
      const v = P.board[r * COLS + c];
      if (!v) continue;
      let white = 0;
      if (clearing) {
        // Flash white for an eighth of a second, then go two columns at a time from the middle.
        if (clearT < 0.12) white = 0.85;
        else {
          const ring = Math.min(4, Math.floor((clearT - 0.12) / 0.06));
          const fromMid = c < 5 ? 4 - c : c - 5;
          if (fromMid <= ring) continue;
          white = 0.5;
        }
      }
      if (P.flash > 0 && P.flashCells.includes(r * COLS + c)) white = Math.max(white, 0.45 * P.flash);
      blockInto(img, X0 + c * CELL, y0, col, v * 3, white, false);
    }
  }

  if (P.wait > 0 && P.next >= 0) {
    const cells = ROT[P.next][0];
    for (let i = 0; i < 4; i++) {
      const r = HID + cells[i][1];
      const c = 3 + cells[i][0];
      if (!P.board[r * COLS + c]) blockInto(img, X0 + c * CELL, (r - HID) * CELL, col, (P.next + 1) * 3, 0, false, 0.38 * P.wait);
    }
  }

  if (P.type >= 0) {
    const g = P.goal;
    const cells = ROT[P.type][P.rot];
    const o = (P.type + 1) * 3;
    // Where the player means to put it.
    const gc = ROT[P.type][g.rot];
    for (let i = 0; i < 4; i++) blockInto(img, X0 + (g.x + gc[i][0]) * CELL, (g.y + gc[i][1] - HID) * CELL, col, o, 0, true);
    const py = Math.round((P.y - HID) * CELL);
    for (let i = 0; i < 4; i++) blockInto(img, X0 + (P.x + cells[i][0]) * CELL, py + cells[i][1] * CELL, col, o, 0, false);
  }

  // The wall: two LEDs of steel each side and under the floor, which opens
  // when the stack tops out. After four lines a light runs up both walls.
  const open = P.phase === "drop";
  for (let y = 0; y < H; y++) {
    let gr = 0;
    let gg = 0;
    let gb = 0;
    if (P.glow > 0) {
      const band = Math.max(0, 1 - Math.abs(y / H - (1 - (1 - P.glow) * 1.4)) * 5);
      if (band > 0) {
        hsvInto(col, 0, y / H + P.hue + P.time * 0.5, 0.7, band);
        gr = col[0];
        gg = col[1];
        gb = col[2];
      }
    }
    for (const [x, base] of [[0, 0.55], [1, 1], [W - 2, 1], [W - 1, 0.55]]) {
      const p = (y * W + x) * 3;
      img[p] = 64 * base + gr;
      img[p + 1] = 72 * base + gg;
      img[p + 2] = 96 * base + gb;
    }
  }
  if (!open)
    for (const [y, base] of [[H - 2, 1], [H - 1, 0.55]])
      for (let x = 2; x < W - 2; x++) {
        const p = (y * W + x) * 3;
        img[p] = 64 * base;
        img[p + 1] = 72 * base;
        img[p + 2] = 96 * base;
      }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, img[p]), Math.min(255, img[p + 1]), Math.min(255, img[p + 2]));
    }
}
