// ===== Patternflow pattern =====
// Title:   Galton Board
// Family:  data
// Idea:    Balls pour from a hopper through a triangle of pegs, each peg a coin toss, and the bins under it fill into a bell curve coloured by how many standard deviations each bin sits from the middle.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=30..240, Bias=-0.3..0.3, Rows=8..15
//
// Knob 1: Hue. Turns the pile round the wheel; the middle, the one-sigma band and the tails keep their steps apart.
// Knob 2: Rate. Balls let through the neck each second, from a trickle to a pour.
// Knob 3: Bias. The chance of bouncing right at a peg, from 0.2 to 0.8; at 0 it is a fair coin and the curve stands straight.
// Knob 4: Rows. Rows of pegs, which is also coins tossed per ball; more rows make more, narrower bins.
// Buttons: K1 tap opens the floor, the bins drain and the hopper fills again.

const W = 64;
const H = 128;
const NECK = 11;
const PEG_TOP = 17;
const BOTTOM = H - 1;
const MAXB = 400;
const MAXP = 136;

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

// The hopper's walls: a funnel from the top corners down to a two-LED neck.
function wallLeft(y) {
  return Math.round(1 + (29 * y) / NECK);
}

function layout(params, rows) {
  params.rows = rows;
  // Bins and pegs share one spacing, as wide as the panel allows for this many bins.
  const dx = Math.floor(65 / (rows + 1));
  const span = (rows + 1) * dx - 1;
  const x0 = Math.floor((W - span) / 2);
  const mid = x0 + span / 2;
  const dy = dx * 0.866;
  params.dx = dx;
  params.iw = dx - 1;
  params.x0 = x0;
  params.mid = mid;
  params.dy = dy;
  params.trow = 0.11 * Math.sqrt(dy / 3.46);
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j <= r; j++) {
      const n = (r * (r + 1)) / 2 + j;
      params.pegX[n] = Math.floor(mid + (j - r / 2) * dx);
      params.pegY[n] = Math.round(PEG_TOP + r * dy);
      params.glow[n] = 0;
    }
  }
  params.pegs = (rows * (rows + 1)) / 2;
  // The last row of pegs sits on top of the dividers.
  params.binTop = params.pegY[params.pegs - 1];
  params.binRows = BOTTOM - params.binTop;
  const col = params.colBin;
  for (let x = 0; x < W; x++) {
    const rel = x - x0;
    if (rel === -1 || rel === span) col[x] = -2;
    else if (rel < 0 || rel > span) col[x] = -1;
    else if ((rel + 1) % dx === 0) col[x] = -2;
    else col[x] = Math.floor(rel / dx);
  }
}

function pmf(n, j, p) {
  let c = 1;
  for (let i = 0; i < j; i++) c = (c * (n - i)) / (i + 1);
  return c * Math.pow(p, j) * Math.pow(1 - p, n - j);
}

// Bands and the curve the pile is heading for, from the bias as it stands.
function theory(params) {
  const n = params.rows;
  const p = params.p;
  const sd = Math.sqrt(n * p * (1 - p));
  let top = 0;
  for (let j = 0; j <= n; j++) {
    const m = pmf(n, j, p);
    params.expect[j] = m;
    if (m > top) top = m;
    const z = Math.abs(j - n * p) / sd;
    params.band[j] = z <= 1 ? 0 : z <= 2 ? 1 : 2;
  }
  params.top = top;
}

function fill(params) {
  theory(params);
  // Enough balls that the tallest bin should end a little under the brim.
  params.total = Math.round((0.9 * params.iw * params.binRows) / params.top);
  params.hopper = params.total;
  params.count.fill(0);
  params.pile.fill(0);
}

function place(params, j, xp) {
  const iw = params.iw;
  const level = Math.floor(params.count[j] / iw);
  if (level >= params.binRows) return false;
  const y = BOTTOM - level;
  const left = params.x0 + j * params.dx;
  let c = Math.max(left, Math.min(left + iw - 1, Math.floor(xp)));
  // The nearest free place in the row the bin is filling.
  for (let d = 0; d < iw * 2; d++) {
    const cc = c + (d & 1 ? -((d + 1) >> 1) : d >> 1);
    if (cc < left || cc >= left + iw) continue;
    if (params.pile[y * W + cc] === 0) {
      c = cc;
      break;
    }
  }
  params.pile[y * W + c] = 140 + Math.floor(Math.random() * 115);
  params.count[j]++;
  if (params.count[j] >= iw * params.binRows) params.full = true;
  return true;
}

function release(params) {
  for (let i = 0; i < MAXB; i++) {
    if (params.mode[i] !== 0) continue;
    params.mode[i] = 1;
    params.bt[i] = 0;
    params.row[i] = 0;
    params.bj[i] = 0;
    params.bx[i] = params.mid;
    params.by[i] = NECK;
    params.hopper--;
    return;
  }
}

function toss(params, i) {
  params.nj[i] = params.bj[i] + (Math.random() < params.p ? 1 : 0);
  params.glow[(params.row[i] * (params.row[i] + 1)) / 2 + params.bj[i]] += 1;
}

function moveBalls(params, dt) {
  const T = params.trow;
  const dy = params.dy;
  for (let i = 0; i < MAXB; i++) {
    const m = params.mode[i];
    if (m === 0) continue;
    if (m === 1) {
      // Out of the neck and onto the top peg.
      params.bt[i] += dt / 0.14;
      const t = Math.min(1, params.bt[i]);
      params.bx[i] = params.mid;
      params.by[i] = NECK + (params.pegY[0] - 1 - NECK) * t * t;
      if (params.bt[i] >= 1) {
        params.bt[i] -= 1;
        params.mode[i] = 2;
        toss(params, i);
      }
    } else if (m === 2) {
      params.bt[i] += dt / T;
      const r = params.row[i];
      const a = (r * (r + 1)) / 2 + params.bj[i];
      if (r === params.rows - 1) {
        // Off the last peg and into a bin.
        params.mode[i] = params.drain >= 0 ? 4 : 3;
        params.vy[i] = -dy * 2;
        params.bt[i] = 0;
        params.tx[i] = params.x0 + params.nj[i] * params.dx + Math.random() * params.iw;
        params.bj[i] = params.nj[i];
        continue;
      }
      const b = ((r + 1) * (r + 2)) / 2 + params.nj[i];
      const t = Math.min(1, params.bt[i]);
      params.bx[i] = params.pegX[a] + 0.5 + (params.pegX[b] - params.pegX[a]) * t;
      // A little hop off the peg, then falling.
      params.by[i] = params.pegY[a] - 1 + (params.pegY[b] - params.pegY[a]) * t * t - dy * 0.35 * 4 * t * (1 - t);
      if (params.bt[i] >= 1) {
        params.bt[i] -= 1;
        params.row[i] = r + 1;
        params.bj[i] = params.nj[i];
        toss(params, i);
      }
    } else {
      params.vy[i] = Math.min(70, params.vy[i] + 400 * dt);
      params.by[i] += params.vy[i] * dt;
      params.bt[i] += dt;
      if (m === 3) {
        params.bx[i] += (params.tx[i] - params.bx[i]) * Math.min(1, dt * 12);
        const j = params.bj[i];
        const land = BOTTOM - Math.floor(params.count[j] / params.iw);
        if (params.drain >= 0) params.mode[i] = 4;
        else if (params.by[i] >= land) {
          params.mode[i] = 0;
          if (!place(params, j, params.bx[i])) params.full = true;
        }
      } else if (params.by[i] > H + 2) params.mode[i] = 0;
    }
  }
}

export function setup(params) {
  params.pegX = new Int16Array(MAXP);
  params.pegY = new Int16Array(MAXP);
  params.glow = new Float32Array(MAXP);
  params.colBin = new Int8Array(W);
  params.count = new Int16Array(17);
  params.expect = new Float32Array(17);
  params.band = new Uint8Array(17);
  params.pile = new Uint8Array(W * H);
  params.mode = new Uint8Array(MAXB);
  params.bx = new Float32Array(MAXB);
  params.by = new Float32Array(MAXB);
  params.bt = new Float32Array(MAXB);
  params.vy = new Float32Array(MAXB);
  params.tx = new Float32Array(MAXB);
  params.row = new Int8Array(MAXB);
  params.bj = new Int8Array(MAXB);
  params.nj = new Int8Array(MAXB);
  params.fb = new Float32Array(W * H * 3);
  params.colours = new Float32Array(4 * 3);
  params.hueKey = -1;
  params.grain = new Uint8Array(W * (NECK + 1));
  for (let i = 0; i < params.grain.length; i++) params.grain[i] = 120 + Math.floor(Math.random() * 135);
  let cap = 0;
  for (let y = 0; y <= NECK; y++) cap += 63 - 2 * wallLeft(y);
  params.hopCap = cap;
  params.rows = 0;
  params.p = 0.5;
  params.acc = 0;
  params.drain = -1;
  params.hold = 0;
  params.refill = 1;
  params.refillFrom = 1;
  params.full = false;
  params.fresh = true;
}

function startDrain(params) {
  if (params.drain >= 0) return;
  params.drain = 0;
  // Whatever is left in the hopper stays there and is topped up after.
  params.refillFrom = params.hopper / params.total;
  for (let i = 0; i < MAXB; i++) if (params.mode[i] === 3) params.mode[i] = 4;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 30, 0, 8];
  dt = Math.min(dt, 0.1);
  params.hue = k[0];
  const rate = Math.max(1, k[1]);
  params.p = 0.5 + Math.max(-0.3, Math.min(0.3, k[2]));
  const rows = Math.max(1, Math.min(15, Math.round(k[3])));

  if (params.fresh) {
    params.fresh = false;
    layout(params, rows);
    fill(params);
    // Start partway through a fill: over half the balls already sorted, and
    // two and a half seconds of the stream run so the board is busy.
    const n = Math.floor(params.total * 0.55);
    for (let b = 0; b < n; b++) {
      let j = 0;
      for (let r = 0; r < rows; r++) if (Math.random() < params.p) j++;
      place(params, j, params.x0 + j * params.dx + Math.random() * params.iw);
    }
    params.hopper -= n;
    for (let s = 0; s < 75; s++) {
      params.acc += rate / 30;
      while (params.acc >= 1) {
        params.acc -= 1;
        release(params);
      }
      moveBalls(params, 1 / 30);
    }
  }

  if (rows !== params.rows || (input.btnPressed && input.btnPressed[0])) {
    if (params.drain < 0) startDrain(params);
    params.nextRows = rows;
  }
  theory(params);

  if (params.drain >= 0) {
    params.drain += dt;
    // The floor is open: the pile falls out under gravity.
    if (0.5 * 300 * params.drain * params.drain > H) {
      params.drain = -1;
      if (params.nextRows && params.nextRows !== params.rows) {
        // Balls still on the old pegs have nowhere to go on the new board.
        for (let i = 0; i < MAXB; i++) if (params.mode[i] !== 0) params.mode[i] = 4;
        layout(params, params.nextRows);
      }
      fill(params);
      params.full = false;
      params.hold = 0;
      params.refill = 0;
    }
  } else if (params.refill < 1) {
    params.refill = Math.min(1, params.refill + dt / 0.8);
  } else {
    let flying = 0;
    for (let i = 0; i < MAXB; i++) if (params.mode[i] >= 1 && params.mode[i] <= 3) flying++;
    if (params.full || (params.hopper <= 0 && flying === 0)) {
      // Hold the finished curve a moment before the floor opens.
      params.hold += dt;
      if (params.hold > 2.5) startDrain(params);
    } else if (!params.full) {
      params.acc += rate * dt;
      while (params.acc >= 1 && params.hopper > 0) {
        params.acc -= 1;
        release(params);
      }
      if (params.hopper <= 0) params.acc = 0;
    }
  }

  moveBalls(params, dt);
  const fade = Math.exp(-dt * 5);
  for (let n = 0; n < params.pegs; n++) params.glow[n] *= fade;
}

function add(fb, x, y, r, g, b) {
  const i = (y * W + x) * 3;
  fb[i] += r;
  fb[i + 1] += g;
  fb[i + 2] += b;
}

export function draw(display, params, time) {
  const fb = params.fb;
  const col = params.colours;
  if (params.hueKey !== params.hue) {
    params.hueKey = params.hue;
    // K1 at 0 opens on mint, with the tails stepping towards blue.
    const h = params.hue + 0.42;
    const cs = [hsv(h, 0.62, 1), hsv(h + 0.09, 0.8, 0.9), hsv(h + 0.19, 0.9, 0.82), hsv(h + 0.05, 0.2, 1)];
    for (let c = 0; c < 4; c++) {
      col[c * 3] = cs[c][0];
      col[c * 3 + 1] = cs[c][1];
      col[c * 3 + 2] = cs[c][2];
    }
  }
  fb.fill(0);

  // The hopper, filled from the neck up with what is left to drop.
  const from = params.refillFrom;
  const left = params.drain >= 0 ? from : params.refill < 1 ? from + (1 - from) * params.refill : params.hopper / params.total;
  let cells = Math.round(params.hopCap * Math.max(0, left));
  for (let y = NECK; y >= 0; y--) {
    const wl = wallLeft(y);
    const wr = W - 1 - wl;
    add(fb, wl, y, 46, 48, 58);
    add(fb, wr, y, 46, 48, 58);
    const width = wr - wl - 1;
    // A part-filled row fills from the walls in, the dip a draining funnel makes.
    for (let n = 0; n < width && cells > 0; n++, cells--) {
      const x = n & 1 ? wr - 1 - (n >> 1) : wl + 1 + (n >> 1);
      const s = params.grain[y * W + x] / 255;
      add(fb, x, y, col[0] * s * 0.7, col[1] * s * 0.7, col[2] * s * 0.7);
    }
  }

  // Pegs glow for a moment each time a ball strikes them.
  for (let n = 0; n < params.pegs; n++) {
    const v = 0.42 + 0.58 * (1 - Math.exp(-params.glow[n] * 0.5));
    add(fb, params.pegX[n], params.pegY[n], col[9] * v, col[10] * v, col[11] * v);
  }

  const colBin = params.colBin;
  for (let x = 0; x < W; x++) {
    if (colBin[x] !== -2) continue;
    for (let y = params.binTop + 1; y < H; y++) add(fb, x, y, 40, 42, 52);
  }

  // The pile, falling away while the floor is open.
  const drop = params.drain >= 0 ? Math.floor(0.5 * 300 * params.drain * params.drain) : 0;
  const pile = params.pile;
  for (let y = BOTTOM; y > params.binTop; y--) {
    const to = y + drop;
    if (to > BOTTOM) continue;
    for (let x = 0; x < W; x++) {
      const s = pile[y * W + x];
      if (s === 0) continue;
      const c = params.band[colBin[x]] * 3;
      const v = s / 255;
      add(fb, x, to, col[c] * v, col[c + 1] * v, col[c + 2] * v);
    }
  }

  // Where theory says each bin will stand when the hopper is empty.
  if (params.drain < 0) {
    for (let j = 0; j <= params.rows; j++) {
      const tall = (params.total * params.expect[j]) / params.iw;
      if (tall < 1) continue;
      const y = BOTTOM - Math.floor(tall);
      if (y <= params.binTop) continue;
      const c = params.band[j] * 3;
      const x0 = params.x0 + j * params.dx;
      for (let x = x0; x < x0 + params.iw; x++) {
        if (pile[y * W + x] !== 0) continue;
        add(fb, x, y, col[c] * 0.22, col[c + 1] * 0.22, col[c + 2] * 0.22);
      }
    }
  }

  // Balls in flight, each spread over its four nearest LEDs so it glides.
  for (let i = 0; i < MAXB; i++) {
    if (params.mode[i] === 0) continue;
    const fx = params.bx[i] - 0.5;
    const fy = params.by[i] - 0.5;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const ax = fx - ix;
    const ay = fy - iy;
    for (let q = 0; q < 4; q++) {
      const x = ix + (q & 1);
      const y = iy + (q >> 1);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const w = (q & 1 ? ax : 1 - ax) * (q >> 1 ? ay : 1 - ay);
      add(fb, x, y, col[9] * w, col[10] * w, col[11] * w);
    }
  }

  for (let p = 0, i = 0; p < W * H; p++, i += 3) {
    const r = fb[i];
    const g = fb[i + 1];
    const b = fb[i + 2];
    display.setPixel(p % W, (p / W) | 0, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
  }
}
