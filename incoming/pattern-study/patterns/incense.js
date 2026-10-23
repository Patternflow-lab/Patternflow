// ===== Patternflow pattern =====
// Title:   Incense
// Family:  noise
// Idea:    A backflow cone on a little cairn of stones sends a thin thread of smoke straight up until it snakes, curls and breaks into wisps in a curl-noise draught, while its heavy smoke pours down the stones like water and pools in the dish.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bridson, Hourihan and Nordenstam's curl noise for procedural fluid flow (SIGGRAPH 2007), driving smoke particles
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sticks=1..3, Breeze=-1..1
//
// Knob 1: Hue. The colour of the lamp that lights the smoke and the room, starting from a cool grey-blue; thick smoke goes whiter whatever the colour.
// Knob 2: Speed. How fast the air moves: at 2 the thread leaves the tip at 18 rows a second and breaks up about 17 rows above it; at 0.2 the smoke drifts up ten times slower and holds together for 29 rows; at 3 it breaks up after 10.
// Knob 3: Sticks. One to three sticks of incense standing in the dish beside the burner, each with a glowing tip and its own thread; each stick past the first warms and stirs the air so every thread breaks up 3.5 rows sooner.
// Knob 4: Breeze. A cross draught: at 0 the smoke rises straight; turned either way it leans that way, breaks up as much as 9 rows sooner, bends the falling smoke and drags the pool along the dish.
// Buttons: K1 tap breathes across the smoke at some height between rows 22 and 62, bending and scrambling the threads there for a second and a half while the embers flare.

const W = 64;
const H = 128;
const MAXP = 4600;
// Rows: the dish's rim is DISH, the pooled smoke lies at POOL, the table top is TABLE.
const DISH = 114;
const POOL = 113.5;
const TABLE = 123.5;
// The cone's glowing tip, and the hole in the top stone where its heavy smoke comes out.
const CONE_X = 32;
const CONE_Y = 76;
const HOLE_X = 32;
const HOLE_Y = 91;
// Sticks in the dish as base x, base y, tip x, tip y. The first stands behind the stones.
const STICKS = [
  [41, 104, 42.5, 66],
  [11, 116, 12, 92],
  [53, 116, 51.5, 97],
];
// Stones of the burner as left x, right x, top y at the left, top y at the right, bottom y.
const STONES = [
  [21, 52, 109, 104, 113],
  [19, 47, 96, 99, 105],
  [25, 39, 84, 84, 95],
];
// The heavy smoke slides down the tops of the two lower stones: stone index, from x, to x.
const LEDGES = [
  [1, 24, 47.5],
  [0, 52, 22],
];
// Curl-noise velocity grid: a node every 2 LEDs.
const GX = 33;
const GY = 65;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vn(lat, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ix & 255;
  const x1 = (ix + 1) & 255;
  const y0 = (iy & 255) << 8;
  const y1 = ((iy + 1) & 255) << 8;
  const a = lat[y0 + x0] + (lat[y0 + x1] - lat[y0 + x0]) * ux;
  const b = lat[y1 + x0] + (lat[y1 + x1] - lat[y1 + x0]) * ux;
  return a + (b - a) * uy;
}

function hsv(out, h, s, v) {
  h -= Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
  return out;
}

function smooth(v) {
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  return v * v * (3 - 2 * v);
}

function stoneTop(s, x) {
  const S = STONES[s];
  return S[2] + ((S[3] - S[2]) * (x - S[0])) / (S[1] - S[0]);
}

export function setup(params) {
  const lat = new Float32Array(256 * 256);
  for (let i = 0; i < lat.length; i++) lat[i] = Math.random();
  params.lat = lat;
  // Particles: position, velocity, age, what they are doing, where they came from, when, and a depth in the stream.
  params.x = new Float32Array(MAXP);
  params.y = new Float32Array(MAXP);
  params.vx = new Float32Array(MAXP);
  params.vy = new Float32Array(MAXP);
  params.age = new Float32Array(MAXP);
  params.kind = new Int8Array(MAXP).fill(-1);
  params.src = new Int8Array(MAXP);
  params.emit = new Float32Array(MAXP);
  params.dep = new Float32Array(MAXP);
  params.led = new Int8Array(MAXP);
  // Each rising particle remembers the one its source let go just before it, so the thread is drawn as a line between them.
  params.prev = new Int32Array(MAXP).fill(-1);
  params.last = new Int32Array(5).fill(-1);
  params.next = 0;
  params.gvx = new Float32Array(GX * GY);
  params.gvy = new Float32Array(GX * GY);
  params.psi = new Float32Array(GX * GY);
  params.dens = new Float32Array(W * H);
  params.soft = new Float32Array(W * H);
  params.tmp = new Float32Array(W * H);
  params.scene = new Float32Array(W * H * 3);
  // 1 where a stone or the dish stands in front of the sticks.
  params.front = new Uint8Array(W * H);
  params.buf = new Float32Array(W * H * 3);
  params.glow = new Float32Array(W * H);
  params.debt = new Float32Array(5);
  params.sx = new Float32Array(4);
  params.sy = new Float32Array(4);
  params.sway = new Float32Array(4);
  params.col = [0, 0, 0];
  params.t = 0;
  params.started = false;
  params.breath = 9;
  params.by = 40;
  params.bdir = 1;
  params.sticks = 0;
  params.flare = 0;
  params.hb = 17;
  bakeScene(params);
}

function bakeScene(params) {
  const sc = params.scene;
  const fr = params.front;
  const c = params.col;
  const set = (x, y) => sc.set(c, (y * W + x) * 3);
  // A dark room, a little lighter up to the left where the lamp is; draw() colours it with the lamp.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) params.glow[y * W + x] = 0.012 + 0.1 * (1 - Math.hypot(x + 10, y - 20) / 140);
  // The table, dark wood with its grain running across.
  for (let y = TABLE + 0.5; y < H; y++)
    for (let x = 0; x < W; x++) {
      const g = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(x * 0.05 + y) * 2 + y * 1.7);
      hsv(c, 0.07, 0.62, y === TABLE + 0.5 ? 0.24 : 0.13 + 0.04 * g);
      set(x, y);
      params.glow[y * W + x] = y === TABLE + 0.5 ? 0.16 - (0.1 * x) / W : 0;
    }
  // Stones, glazed a dark celadon, lit on their top edges and on the side towards the lamp.
  STONES.forEach((S, s) => {
    for (let x = S[0]; x <= S[1]; x++) {
      const top = Math.round(stoneTop(s, x));
      const u = (x - S[0]) / (S[1] - S[0]);
      for (let y = top; y <= S[4]; y++) {
        // Rounded corners, and sides that bulge a little at the middle like a river stone.
        const e = Math.min(y - top, S[4] - y);
        const inset = (e < 2 ? 2 - e : 0) + 1.2 * Math.abs((2 * (y - top)) / (S[4] - top) - 1) ** 2;
        if (x < S[0] + inset - 0.3 || x > S[1] - inset + 0.3) continue;
        const edgeL = x < S[0] + inset + 0.7;
        const edgeR = x > S[1] - inset - 0.7;
        // Layers in the stone, a few pits, darker towards the foot and away from the lamp.
        let v = 0.25 - 0.09 * u + 0.025 * Math.sin(y * 1.1 + s * 2 + x * 0.08) + 0.04 * (hash(x, y) - 0.5) - (0.07 * (y - top)) / (S[4] - top + 1);
        if (hash(x * 5, y * 3 + s) < 0.05) v -= 0.06;
        if (y === top) v = 0.46 - 0.12 * u;
        else if (edgeL || y === top + 1) v += 0.06;
        else if (edgeR || y === S[4]) v -= 0.06;
        hsv(c, 0.44, 0.32, v);
        set(x, y);
        fr[y * W + x] = 1;
        // The lamp catches the top edges.
        params.glow[y * W + x] = y === top ? 0.22 - 0.12 * u : 0;
      }
    }
  });
  // The hole the heavy smoke comes out of, and the cone sitting on the top stone.
  for (let x = 31; x <= 33; x++) {
    hsv(c, 0.44, 0.4, x === 32 ? 0.03 : 0.08);
    set(x, HOLE_Y - 1);
    set(x, HOLE_Y);
  }
  for (let y = CONE_Y + 1; y < 84; y++) {
    const half = ((y - CONE_Y) * 3.4) / (83 - CONE_Y);
    for (let x = Math.round(CONE_X - half); x <= Math.round(CONE_X + half); x++) {
      hsv(c, 0.03, 0.55, 0.36 - (0.12 * (x - CONE_X + half)) / (2 * half + 1));
      set(x, y);
      fr[y * W + x] = 1;
      params.glow[y * W + x] = 0;
    }
  }
  // The dish, a dark iron glaze with a lit rim, standing on a foot.
  for (let y = DISH; y <= DISH + 8; y++) {
    const q = (y - DISH) / 7;
    const half = y > DISH + 7 ? 13 : 26.5 - 7 * q * q;
    for (let x = Math.ceil(31.5 - half); x <= Math.floor(31.5 + half); x++) {
      const u = (x - 31.5 + half) / (2 * half);
      let v = y === DISH ? 0.55 - 0.2 * u : 0.24 - 0.12 * u - 0.06 * q + 0.03 * hash(x, y);
      if (y === DISH + 1) v += 0.08;
      hsv(c, 0.05, y === DISH ? 0.35 : 0.6, v);
      set(x, y);
      fr[y * W + x] = 1;
      params.glow[y * W + x] = y === DISH ? 0.2 - 0.12 * u : 0;
    }
  }
}

function spawn(params, kind, x, y, vx, vy, src) {
  const i = params.next;
  params.next = (i + 1) % MAXP;
  params.kind[i] = kind;
  params.x[i] = x;
  params.y[i] = y;
  params.vx[i] = vx;
  params.vy[i] = vy;
  params.age[i] = 0;
  params.src[i] = src;
  params.emit[i] = params.t;
  params.dep[i] = Math.random();
  return i;
}

// The draught: a stream function of two octaves of noise drifting up with the smoke; its curl
// gives a velocity that swirls without ever piling smoke up or thinning it out.
function stepField(params) {
  const lat = params.lat;
  const t = params.t;
  const psi = params.psi;
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const x = i * 2;
      const y = j * 2;
      psi[j * GX + i] = vn(lat, x / 13 + 0.05 * t, (y + 11 * t) / 13) + 0.4 * vn(lat, x / 5.5 - 0.09 * t + 40, (y + 15 * t) / 5.5 + 40);
    }
  const gvx = params.gvx;
  const gvy = params.gvy;
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const jm = j > 0 ? j - 1 : j;
      const jp = j < GY - 1 ? j + 1 : j;
      const im = i > 0 ? i - 1 : i;
      const ip = i < GX - 1 ? i + 1 : i;
      gvx[j * GX + i] = ((psi[jp * GX + i] - psi[jm * GX + i]) / (2 * (jp - jm))) * 190;
      gvy[j * GX + i] = (-(psi[j * GX + ip] - psi[j * GX + im]) / (2 * (ip - im))) * 190;
    }
}

function step(params, dts) {
  const t = (params.t += dts);
  stepField(params);
  const sticks = params.sticks;
  const breeze = params.breeze;
  // Sources: the cone, then the sticks the knob has lit. Room air leans each thread gently one way and the other.
  const srcs = 1 + sticks;
  const SX = params.sx;
  const SY = params.sy;
  const sway = params.sway;
  for (let s = 0; s < srcs; s++) {
    SX[s] = s === 0 ? CONE_X : STICKS[s - 1][2];
    SY[s] = s === 0 ? CONE_Y : STICKS[s - 1][3];
    sway[s] = 2 * Math.sin(t * 0.43 + s * 2) + 1.2 * Math.sin(t * 0.17 + s);
    params.debt[s] += 50 * dts;
    while (params.debt[s] >= 1) {
      params.debt[s] -= 1;
      // vx keeps how far this bit of smoke will be pushed aside where the thread starts to snake.
      const i = spawn(params, 0, SX[s] + (Math.random() - 0.5) * 0.15, SY[s] - 1 - Math.random(), 5 * Math.sin(t * 2.7 + s * 1.9), 0, s);
      params.prev[i] = params.last[s];
      params.last[s] = i;
    }
  }
  // Heavy smoke out of the hole in the stone.
  params.debt[4] += 44 * dts;
  while (params.debt[4] >= 1) {
    params.debt[4] -= 1;
    spawn(params, 1, HOLE_X + (Math.random() - 0.5) * 2, HOLE_Y + 0.5, (Math.random() - 0.5) * 0.8, 2, 4);
  }

  // How far a thread climbs before it breaks up: less in a faster or crosswise draught.
  // More sticks warm the air more and stir it, so every thread breaks sooner.
  const hb = (params.hb = 17 * (1.8 - 0.8 * params.speed) - 9 * Math.abs(breeze) - 3.5 * (sticks - 1));
  const breath = params.breath;
  const env = breath < 1.6 ? Math.sin((Math.PI * breath) / 1.6) : 0;
  const gvx = params.gvx;
  const gvy = params.gvy;
  const X = params.x;
  const Y = params.y;
  for (let i = 0; i < MAXP; i++) {
    const kind = params.kind[i];
    if (kind < 0) continue;
    const age = (params.age[i] += dts);
    let x = X[i];
    let y = Y[i];
    if (kind === 0) {
      const s = params.src[i];
      const h = SY[s] - y;
      const turb = smooth((h - hb) / 18);
      // Still air carries the thread straight up, slower as it cools.
      let ux = breeze * 20 * (0.2 + Math.min(1, h / 45)) + sway[s] * Math.min(1, h / 25);
      let uy = -18 * (0.4 + 0.6 * Math.exp(-h / 50));
      // A broken-up plume entrains the air round it and widens as it climbs.
      ux += (x - SX[s]) * 0.12 * turb;
      // Just below the break the thread starts to snake: each bit of smoke was pushed aside by the moment it left the tip.
      if (h > hb - 14) ux += params.vx[i] * smooth((h - hb + 14) / 12) * (1 - 0.6 * turb);
      if (turb > 0 || env > 0) {
        const gx = Math.max(0, Math.min(GX - 1.001, x / 2));
        const gy = Math.max(0, Math.min(GY - 1.001, y / 2));
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const o = iy * GX + ix;
        const a = (1 - fx) * (1 - fy);
        const b = fx * (1 - fy);
        const c = (1 - fx) * fy;
        const d = fx * fy;
        let amp = turb;
        if (env > 0) {
          const e = env * Math.exp(-((y - params.by) * (y - params.by)) / 120);
          ux += params.bdir * 45 * e;
          amp += 1.6 * e;
        }
        ux += amp * (gvx[o] * a + gvx[o + 1] * b + gvx[o + GX] * c + gvx[o + GX + 1] * d);
        uy += amp * (gvy[o] * a + gvy[o + 1] * b + gvy[o + GX] * c + gvy[o + GX + 1] * d);
      }
      x += ux * dts;
      y += uy * dts;
      // Past the break the smoke also spreads in small eddies the field is too coarse to hold.
      if (turb > 0) {
        const r = turb * 1.4 * Math.sqrt(dts);
        x += (Math.random() - 0.5) * r;
        y += (Math.random() - 0.5) * r;
      }
      if (y < -3 || x < -3 || x > W + 2 || age > 9) params.kind[i] = -1;
    } else if (kind === 1) {
      // Heavy smoke falls slowly and lands on a stone, in the dish or on the table.
      let vy = params.vy[i] + 22 * dts;
      if (vy > 9) vy = 9;
      params.vy[i] = vy;
      params.vx[i] += (breeze * 9 - params.vx[i]) * dts;
      x += params.vx[i] * dts;
      const ny = y + vy * dts;
      const dep = params.dep[i];
      let landed = false;
      for (let l = 0; l < LEDGES.length && !landed; l++) {
        const L = LEDGES[l];
        if (x < Math.min(L[1], L[2]) || x > Math.max(L[1], L[2])) continue;
        const top = stoneTop(L[0], x) - 0.6 - dep * 1.4;
        if (y <= top + 0.5 && ny >= top) {
          params.kind[i] = 2;
          params.led[i] = l;
          y = top;
          landed = true;
        }
      }
      if (!landed) {
        y = ny;
        const inDish = x > 6 && x < 57;
        if (inDish && y >= POOL - dep * 3) {
          params.kind[i] = 3;
          // Pooled smoke spreads out over the dish from where it lands; vy keeps the way it drifts.
          params.vy[i] = (Math.random() < 0.45 ? -1 : 1) * (0.8 + 2.2 * Math.random());
          params.vx[i] = params.vy[i] * 2;
          y = POOL - dep * 3;
        } else if (!inDish && y >= TABLE - dep * 1.5) {
          params.kind[i] = 4;
          params.vx[i] = (x < 31.5 ? -1 : 1) * (2 + 2 * Math.random());
          y = TABLE - dep * 1.5;
        }
      }
    } else if (kind === 2) {
      // Sliding down the top of a stone to its lower end, then over.
      const L = LEDGES[params.led[i]];
      const dir = L[2] > L[1] ? 1 : -1;
      x += dir * (6 + 3 * params.dep[i]) * dts;
      y = stoneTop(L[0], x) - 0.6 - params.dep[i] * 1.4;
      if ((x - L[2]) * dir > 0) {
        params.kind[i] = 1;
        params.vx[i] = dir * 3.5;
        params.vy[i] = 0.5;
      }
    } else {
      // Pooled on the dish or the table: spreading out, wandering, thinning.
      params.vx[i] += ((Math.random() - 0.5) * 9 + breeze * 9 + (kind === 3 ? params.vy[i] - params.vx[i] : -0.3 * params.vx[i])) * dts;
      x += params.vx[i] * dts;
      if (kind === 3) {
        y = POOL - params.dep[i] * 3 - 0.6 * Math.sin(age * 1.3 + params.dep[i] * 9);
        if (x < 5.5 || x > 57.5) {
          params.kind[i] = 1;
          params.vy[i] = 0.5;
        } else if (age > 20) params.kind[i] = -1;
      } else if (age > 13 || x < -2 || x > W + 1) params.kind[i] = -1;
    }
    X[i] = x;
    Y[i] = y;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = Math.min(dt, 0.1);
  params.hue = 0.58 + k[0];
  params.speed = Math.max(0.1, k[1] / 2);
  params.sticks = Math.max(1, Math.min(3, Math.round(k[2])));
  params.breeze = Math.max(-1, Math.min(1, k[3]));
  if (!params.started) {
    params.started = true;
    // Ten seconds of smoke before the first frame, so the thread is up and the dish has its pool.
    for (let n = 0; n < 100; n++) step(params, 0.1);
  }
  if (input.btnPressed && input.btnPressed[0]) {
    params.breath = 0;
    params.by = 22 + Math.random() * 40;
    params.bdir = Math.random() < 0.5 ? -1 : 1;
  }
  params.breath += dt;
  params.flare = params.breath < 2 ? Math.sin((Math.PI * params.breath) / 2) : 0;
  step(params, dt * params.speed);
}

function splat(dens, x, y, w) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return;
  const fx = x - ix;
  const fy = y - iy;
  const o = iy * W + ix;
  dens[o] += w * (1 - fx) * (1 - fy);
  dens[o + 1] += w * fx * (1 - fy);
  dens[o + W] += w * (1 - fx) * fy;
  dens[o + W + 1] += w * fx * fy;
}

export function draw(display, params, time) {
  const buf = params.buf;
  buf.set(params.scene);
  const fr = params.front;
  const c = params.col;
  // The lamp: its colour on the smoke, and a paler wash of it on the room and the lit edges.
  const light = hsv([0, 0, 0], params.hue, 0.5, 0.95);
  const room = hsv([0, 0, 0], params.hue, 0.45, 0.95);
  const glow = params.glow;
  for (let p = 0; p < W * H; p++) {
    const g = glow[p];
    if (g === 0) continue;
    buf[p * 3] += room[0] * g;
    buf[p * 3 + 1] += room[1] * g;
    buf[p * 3 + 2] += room[2] * g;
  }
  // Sticks behind the stones and the dish: bamboo at the foot, the dark coated length, and grey ash over the ember.
  const embers = [[CONE_X, CONE_Y, 0]];
  for (let s = 0; s < params.sticks; s++) {
    const [bx, by, tx, ty] = STICKS[s];
    for (let y = ty; y <= by; y++) {
      const x = Math.round(bx + ((tx - bx) * (by - y)) / (by - ty));
      if (fr[y * W + x]) continue;
      if (y - ty < 2) hsv(c, 0.08, 0.06, 0.55 - 0.1 * (y - ty));
      else if (by - y < 9) hsv(c, 0.11, 0.45, 0.5);
      else hsv(c, 0.02, 0.62, 0.36);
      buf.set(c, (y * W + x) * 3);
    }
    embers.push([tx, ty + 2, s + 1]);
  }

  // Smoke goes into two layers: the threads as they are, and the broken-up and pooled smoke, which is blurred so it reads as haze, not grains.
  const dens = params.dens;
  const soft = params.soft;
  dens.fill(0);
  soft.fill(0);
  const hb = params.hb;
  // The tip burns at its own pace, so in a slow draught the same smoke crowds into less air and looks thicker.
  const thick = Math.pow(params.speed, -0.35);
  for (let i = 0; i < MAXP; i++) {
    const kind = params.kind[i];
    if (kind < 0) continue;
    const age = params.age[i];
    const x = params.x[i];
    const y = params.y[i];
    if (kind === 0) {
      // Rising smoke thins as it cools. A thread is drawn as a line back to the smoke let go just before it, so a stretched line spreads the same smoke thinner.
      const s = params.src[i];
      const w = 0.75 * thick * Math.exp(-age / 9);
      const ws = w * 0.85 * smooth((params.sy[s] - y - hb) / 18);
      const wc = w - ws;
      const both = ws > 0.01 * w && wc > 0.16 * w;
      const into = wc > ws ? dens : soft;
      const j = params.prev[i];
      if (j >= 0 && params.kind[j] === 0 && params.src[j] === s && params.emit[j] <= params.emit[i]) {
        const dx = params.x[j] - x;
        const dy = params.y[j] - y;
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < 9) {
          const n = Math.ceil(d / 0.75);
          for (let k = 0; k < n; k++) {
            if (both) {
              splat(dens, x + (dx * k) / n, y + (dy * k) / n, wc / n);
              splat(soft, x + (dx * k) / n, y + (dy * k) / n, ws / n);
            } else splat(into, x + (dx * k) / n, y + (dy * k) / n, w / n);
          }
          continue;
        }
      }
      splat(into, x, y, w);
      continue;
    }
    // The heavy smoke stays milky until it has lain a while.
    if (kind === 3 || kind === 4) splat(soft, x, y, 0.35 * thick * Math.min(1, ((kind === 3 ? 20 : 13) - age) / 6));
    else {
      splat(dens, x, y, 0.23 * thick);
      splat(soft, x, y, 0.23 * thick);
    }
  }
  // A 3 x 3 tent blur of the soft layer, across then down.
  const tmp = params.tmp;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      tmp[p] = 0.5 * soft[p] + 0.25 * ((x > 0 ? soft[p - 1] : 0) + (x < W - 1 ? soft[p + 1] : 0));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      dens[p] += 0.5 * tmp[p] + 0.25 * ((y > 0 ? tmp[p - W] : 0) + (y < H - 1 ? tmp[p + W] : 0));
    }

  for (let p = 0; p < W * H; p++) {
    const d = dens[p];
    if (d < 0.004) continue;
    const s = 1 - Math.exp(-d * 2.2);
    // Thin smoke takes the lamp's colour; where it is thick it scatters more of everything and goes whiter.
    const wv = s * s * 0.3;
    const o = p * 3;
    buf[o] += (light[0] + (245 - light[0]) * wv - buf[o]) * s;
    buf[o + 1] += (light[1] + (245 - light[1]) * wv - buf[o + 1]) * s;
    buf[o + 2] += (light[2] + (245 - light[2]) * wv - buf[o + 2]) * s;
  }

  // Embers breathe, and flare when breathed on; their glow warms the smoke right over them.
  for (const [ex, ey, s] of embers) {
    const heat = (0.8 + 0.12 * Math.sin(time * 1.7 + s * 2.3) + 0.08 * Math.sin(time * 4.1 + s)) * (1 + 0.6 * params.flare);
    const cx = Math.round(ex);
    const cy = Math.round(ey);
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const g = heat * Math.exp(-(dx * dx + dy * dy) / 2.2) * (dx === 0 && dy === 0 ? 1 : 0.5);
        const o = (y * W + x) * 3;
        buf[o] += 255 * g;
        buf[o + 1] += 105 * g;
        buf[o + 2] += 30 * g;
      }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
}
