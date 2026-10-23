// ===== Patternflow pattern =====
// Title:   Helter Skelter
// Family:  fair
// Idea:    A helter skelter stands the height of the panel at a night fair, its striped tower under a pointed roof and a flag, and riders climb the stair inside past its little windows, come out of the door at the top, sit on their coir mats and slide down the spiral round and behind the tower and round again under a chase of festoon bulbs, shoot off the run-out at the foot and carry their mats back to the door.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 19, after the helter skelters of British fairgrounds and seaside piers
// Round:   19
// ===============================
// @matrix 64x128
// @knobs Bulbs=0..1, Speed=0.2..3, Turns=3..6, Stripes=-1..1
//
// Knob 1: Bulbs. Turns the festoon bulbs round the colour wheel, and with them the light they throw on the tower, the slide and the sky, starting from warm gold.
// Knob 2: Speed. How fast the night runs: at 2 a rider takes 8 s to come down three turns, a lit stretch of the chase passes each bulb about once a second, and every 8 s all the bulbs come on together for a second and a half; at 0.2 it is ten times slower.
// Knob 3: Turns. How many times the slide wraps round the tower, 3 to 6; more turns make a tighter spiral, a longer ride and a longer climb inside.
// Knob 4: Stripes. The tower's painted stripes: straight up and down near 0, twisting into a barber's pole one way or the other, up to three turns from foot to roof at either end, with the roof's segments twisting after them.

const W = 64;
const H = 128;
const N = W * H;
const CX = 32;
// The tower's radius, the slide's outer edge and where the riders sit, in LEDs.
const RT = 9;
const RO = 20;
const RM = 15;
// How far below the middle of a ring its front edge sits: the panel looks down a little.
const TILT = 0.2;
// The roof's apex, its eaves and their radius; the slide leaves the top door on row 33
// at the front and comes round to the front on its last turn on row 104; the ground.
const YR = 9;
const YE = 25;
const RR = 13;
const YTOP = 33;
const YBOT = 104;
const YG = 121;
const SKY = -1e9;
// How fast a rider goes round once moving, in radians a second.
const OMEGA = 2.5;
const STRING = -100;

const RED = [184, 26, 38];
const CREAM = [250, 240, 214];
const WOOD = [190, 120, 56];
const WALL = [40, 84, 196];
const WALL2 = [24, 56, 150];
const TRIM = [230, 230, 236];
const FLAG = [250, 206, 40];
// The night's own light on the paint, without the bulbs.
const AMB = [0.16, 0.18, 0.3];
const SHIRTS = [[200, 40, 60], [40, 110, 210], [240, 240, 240], [50, 170, 80], [240, 170, 30], [150, 70, 200], [30, 190, 190]];
const SKINS = [[226, 172, 132], [160, 104, 70], [240, 196, 160], [110, 70, 46]];
const HAIRS = [[40, 26, 18], [120, 70, 30], [220, 180, 90], [20, 18, 20], [160, 50, 30]];
const MAT = [130, 86, 40];
const JEANS = [40, 60, 120];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function hsv(h, s, v) {
  h -= Math.floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

export function setup(params) {
  const P = params;
  P.t = 0;
  P.turns = 0;
  P.twist = 99;
  P.alb = new Float32Array(N * 3);
  P.z = new Float32Array(N);
  P.lm = new Float32Array(N);
  P.ph = new Float32Array(N);
  P.lo = new Float32Array(N);
  P.kind = new Uint8Array(N);
  P.win = new Int8Array(N);
  P.sky = new Float32Array(N * 3);
  P.halo = new Float32Array(N);
  P.out = new Float32Array(N * 3);
  P.pos = new Float32Array(5);
  // A deep blue night, paler and warmer low down where the fair lights the haze.
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      P.sky[o] = 3 + 14 * v * v + 30 * Math.max(0, v - 0.75) ** 2 * 16;
      P.sky[o + 1] = 4 + 12 * v * v;
      P.sky[o + 2] = 18 + 30 * v;
      // The bulbs' glow on the air round the ride.
      P.halo[y * W + x] = Math.exp(-(((x - CX) / 20) ** 2)) * Math.min(1, Math.max(0, (y - 4) / 30)) * (y < YG ? 1 : 0);
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * 70);
    const o = (y * W + x) * 3;
    const b = 30 + Math.random() * 50;
    P.sky[o] += b;
    P.sky[o + 1] += b;
    P.sky[o + 2] += b * 1.1;
  }
  // Seven riders, each a seventh of the round behind the one before.
  P.riders = [];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  for (let i = 0; i < 7; i++) P.riders.push({ shirt: pick(SHIRTS), skin: pick(SKINS), hair: pick(HAIRS), arms: Math.random() < 0.5, lag: i / 7 + Math.random() * 0.04 });
}

// Paints one LED of the ride if it is nearer than what is there: its paint c dimmed
// by f, the bulb light l that reaches it, its place ph on the chase (-1 for none) and
// how far the light there falls between the chase's lit stretches, lo.
function plot(P, x, y, z, c, l, ph, f, lo = 0.3, kind = 0) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = y * W + x;
  if (z <= P.z[p]) return;
  P.z[p] = z;
  P.alb[p * 3] = c[0] * f;
  P.alb[p * 3 + 1] = c[1] * f;
  P.alb[p * 3 + 2] = c[2] * f;
  P.lm[p] = l;
  P.ph[p] = ph;
  P.lo[p] = lo;
  P.kind[p] = kind;
  P.win[p] = 0;
}

// The tower's and the roof's paint at an LED: the colour, and how much it is shaded
// to the sides. The stripes twist with the Stripes knob.
function tower(x, y, twist) {
  const th = Math.asin(clamp((x - CX) / (RT + 0.5), -1, 1));
  const turn = th / (Math.PI * 2) + (twist * 3 * (YG - y)) / (YG - YE);
  return [Math.floor(turn * 12 + 100) & 1 ? CREAM : RED, 0.4 + 0.6 * Math.cos(th)];
}

function roof(x, y, yb, twist) {
  const r = Math.min(RR, (RR * (y - YR + 0.5)) / (YE - YR)) + 0.5;
  const th = Math.asin(clamp((x - CX) / r, -1, 1));
  const c = y > yb - 1 ? TRIM : Math.floor((th / (Math.PI * 2) + 1 + twist * (1 - (y - YR) / (YE - YR))) * 16) & 1 ? CREAM : RED;
  return [c, 0.35 + 0.65 * Math.cos(th)];
}

function eave(x) {
  return YE + RR * TILT * Math.cos(Math.asin(clamp((x - CX) / (RR + 0.5), -1, 1)));
}

// Paints the tower and the roof again for a new twist, leaving the rest as it is.
function repaint(P, twist) {
  P.twist = twist;
  for (let p = 0; p < N; p++) {
    const kind = P.kind[p];
    if (!kind || P.win[p]) continue;
    const x = p % W;
    const y = (p / W) | 0;
    const [c, f] = kind === 1 ? tower(x, y, twist) : roof(x, y, eave(x), twist);
    P.alb[p * 3] = c[0] * f;
    P.alb[p * 3 + 1] = c[1] * f;
    P.alb[p * 3 + 2] = c[2] * f;
  }
}

// The ride for a number of turns and a twist of the stripes: the paint, how near
// each LED is, how much bulb light reaches it, and where on the slide it is.
function build(P, turns, twist) {
  P.turns = turns;
  P.twist = twist;
  P.kind.fill(0);
  P.z.fill(SKY);
  P.alb.fill(0);
  P.lm.fill(0);
  P.ph.fill(-1);
  P.win.fill(0);
  const T = turns * Math.PI * 2;
  P.pitch = (YBOT - YTOP) / turns;
  // The ground, lit round the foot of the tower.
  for (let y = YG; y < H; y++)
    for (let x = 0; x < W; x++) plot(P, x, y, -60, [44, 52, 30], 0.12 + 0.55 * Math.exp(-(((x - CX) / 18) ** 2)), -1, 1);
  // Festoon strings from the top of the roof out to the ground on both sides.
  P.strings = [];
  for (const [ex, ey] of [[-2, 100], [65, 100], [4, 124], [60, 124]]) {
    const n = Math.ceil(Math.hypot(ex - CX, ey - YR));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = CX + (ex - CX) * u;
      const y = YR + 2 + (ey - YR - 2) * u + 6 * u * (1 - u);
      plot(P, x, y, STRING, [10, 8, 8], 0, -1, 1);
      if (i % 4 === 2) P.strings.push([Math.round(x), Math.round(y + 1), i]);
    }
  }
  // The tower, which takes the chase from the turn of the slide at its height.
  for (let y = YE; y < YG; y++)
    for (let x = CX - RT; x <= CX + RT; x++) {
      const th = Math.asin(clamp((x - CX) / (RT + 0.5), -1, 1));
      const [c, f] = tower(x, y, twist);
      plot(P, x, y, RT * Math.cos(th), c, 1, th + (2 * Math.PI * (y - YTOP)) / P.pitch, f, 0.55, 1);
    }
  // The roof, a cone of red and cream segments with a pale trim along the eaves.
  for (let x = CX - RR; x <= CX + RR; x++) {
    const yb = eave(x);
    for (let y = YR; y <= yb; y++) {
      if (Math.abs(x - CX) > Math.min(RR, (RR * (y - YR + 0.5)) / (YE - YR)) + 0.5) continue;
      const [c, f] = roof(x, y, yb, twist);
      plot(P, x, y, 50, c, 0.6, -1, f, 0.3, 2);
    }
  }
  // The slide: a wooden trough round the tower with a blue outer wall and a white
  // rail on it, from the top door down to the front again on the last turn.
  for (let f = 0; f <= T; f += 0.02) {
    const h = YTOP + (YBOT - YTOP) * (f / T);
    const s = Math.sin(f);
    const c = Math.cos(f);
    for (let r = RT; r <= RO; r += 0.5) {
      const shade = 0.55 + 0.45 * Math.max(0, c * 0.6 + 0.4);
      plot(P, CX + r * s, h + r * TILT * c, r * c, WOOD, 0.95, f, shade);
      plot(P, CX + r * s, h + r * TILT * c + 1, r * c - 0.05, WOOD, 0.95, f, shade * 0.55);
    }
    const panel = Math.floor((f * RO) / 6) & 1 ? WALL : WALL2;
    for (let d = 0; d < 4; d++) plot(P, CX + RO * s, h + RO * TILT * c - d + 1, RO * c + 0.1, d === 3 ? TRIM : panel, 0.95, f, c < 0 ? 0.6 : 1);
  }
  // The run-out: straight off to the right and down onto the landing.
  const r0 = YBOT + RM * TILT;
  for (let u = 0; u <= 1; u += 0.01) {
    const x = CX + 24 * u;
    const y = YBOT + (YG - 3 - r0) * u * u;
    for (let r = RT; r <= RO; r += 0.5) plot(P, x, y + r * TILT, r + 20, WOOD, 0.95, T + u, 1);
    for (let d = 0; d < 3; d++) plot(P, x, y + RO * TILT - d + 1, RO + 20.5, d === 2 ? TRIM : WALL, 0.95, T + u, 1);
  }
  // A pile of mats to land on.
  for (let y = YG - 4; y < YG; y++) for (let x = 56; x < W; x++) plot(P, x, y, 40, (y + (x >> 1)) & 1 ? MAT : [100, 66, 30], 0.8, -1, 1);
  // Doors at the top and the foot and little windows on the stair between the turns,
  // lit from inside. Window k is marked k + 1, the doors 100 and 101.
  const mark = (x0, x1, y0, y1, id) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const p = y * W + x;
        // Doors are arched; nothing in front of the tower is cut.
        if ((id > 99 && y === y0 && (x === x0 || x === x1)) || P.z[p] > RT + 0.1) continue;
        P.win[p] = id;
        P.alb[p * 3] = P.alb[p * 3 + 1] = P.alb[p * 3 + 2] = 0;
      }
  };
  mark(CX - 2, CX + 2, YTOP - 7, YTOP - 1, 100);
  mark(25, 29, YG - 9, YG - 1, 101);
  for (let k = 0; k < turns; k++) {
    const wy = Math.round(YTOP + (k + 0.5) * P.pitch + 2);
    if (wy <= YBOT) mark(CX - 1, CX + 1, wy - 2, wy + 1, k + 1);
  }
  // Bulbs along the slide's rail, a little more than 3 LEDs apart.
  P.bulbs = [];
  for (let f = 0.1; f <= T; f += 3.2 / RO) P.bulbs.push(f);
}

// Where a rider is at time u of their round, written into o: x, y, depth, a pose
// (0 sitting, 1 walking, 2 inside) and which way they face.
function where(P, u, o) {
  const T = P.turns * Math.PI * 2;
  const climb = 1 + 1.6 * P.turns;
  const slide = T / OMEGA + 0.4;
  const parts = [2.6, climb, 0.7, slide, 1, 0.5];
  let k = 0;
  while (k < parts.length - 1 && u > parts[k]) u -= parts[k++];
  if (k === 0) {
    // Walking back from the landing to the door at the foot, mat under the arm.
    const f = clamp(u / parts[0], 0, 1);
    o[0] = 57 - 30 * f;
    o[1] = YG + 4;
    o[2] = 100;
    o[3] = 1;
    o[4] = -1;
  } else if (k === 1) {
    // Up the stair inside, round and round, to the door at the top.
    const f = u / climb;
    o[0] = CX;
    o[1] = YG - 3 - f * (YG - 3 - YTOP + 2);
    o[2] = -100;
    o[3] = 2;
    o[4] = Math.cos(f * P.turns * Math.PI * 2);
  } else if (k === 2) {
    // Out of the top door and down onto the mat.
    o[0] = CX + 2 * (u / parts[2]);
    o[1] = YTOP + RM * TILT - 1 + (u / parts[2]);
    o[2] = RM + 0.5;
    o[3] = 0;
    o[4] = 1;
  } else if (k === 3) {
    // Down the slide: away from the door slowly, then at the slide's own speed.
    const f = u < 0.8 ? (OMEGA * u * u) / 1.6 : OMEGA * (u - 0.4);
    const g = Math.min(f, T);
    o[0] = CX + RM * Math.sin(g);
    o[1] = YTOP + (YBOT - YTOP) * (g / T) + RM * TILT * Math.cos(g);
    o[2] = RM * Math.cos(g) + 0.5;
    o[3] = 0;
    o[4] = Math.cos(g) >= 0 ? 1 : -1;
  } else {
    // Off the end of the run-out onto the mats, and up.
    const f = k === 4 ? 1 - (1 - u) ** 2 : 1;
    const y = YBOT + (YG - 3 - (YBOT + RM * TILT)) * f * f + RM * TILT;
    o[0] = CX + 24 * f + (k === 5 ? 2 : 0);
    o[1] = k === 5 ? YG - 4 : y;
    o[2] = k === 5 ? 60 : RM + 20.5;
    o[3] = 0;
    o[4] = 1;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 3, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.hue = clamp(k[0], 0, 1);
  const speed = clamp(k[1], 0.2, 3);
  const turns = Math.round(clamp(k[2], 3, 6));
  const twist = clamp(k[3], -1, 1);
  if (turns !== P.turns) build(P, turns, twist);
  else if (twist !== P.twist) repaint(P, twist);
  P.t += (dt * speed) / 2;
}

export function draw(display, params) {
  const P = params;
  const t = P.t;
  const out = P.out;
  const col = hsv(0.11 + P.hue, 0.6, 1);
  const col2 = hsv(0.11 + P.hue + 0.5, 0.7, 1);
  const warm = [1, 0.86, 0.6];
  // The chase runs down the spiral, three lit stretches to every two turns, and
  // the slide and the tower brighten under it.
  const ct = t * 6;
  // Every 8 s the operator throws every bulb on for a second and a half.
  const q = t % 8;
  const all = Math.min(1, Math.max(0, (q - 4.8) / 0.3)) * Math.min(1, Math.max(0, (6.9 - q) / 0.3));
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    const z = P.z[p];
    if (z === SKY) {
      const h = P.halo[p] * 70;
      out[o] = P.sky[o] + col[0] * h;
      out[o + 1] = P.sky[o + 1] + col[1] * h;
      out[o + 2] = P.sky[o + 2] + col[2] * h;
      continue;
    }
    const ph = P.ph[p];
    const lo = P.lo[p];
    const w = P.lm[p] * (ph < 0 ? 0.8 + 0.2 * all : lo + (1 - lo) * Math.max(all, (0.5 + 0.5 * Math.cos(ph * 1.5 - ct)) ** 2));
    out[o] = P.alb[o] * (AMB[0] + col[0] * w);
    out[o + 1] = P.alb[o + 1] * (AMB[1] + col[1] * w);
    out[o + 2] = P.alb[o + 2] * (AMB[2] + col[2] * w);
  }
  // The lamp-lit doors and windows of the stair.
  const flick = 0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 3.1);
  for (let p = 0; p < N; p++) {
    const id = P.win[p];
    if (!id) continue;
    const o = p * 3;
    out[o] = 230 * flick;
    out[o + 1] = 150 * flick;
    out[o + 2] = 70 * flick;
  }
  const pos = P.pos;
  const T = P.turns * Math.PI * 2;
  const round = 2.6 + 1 + 1.6 * P.turns + 0.7 + T / OMEGA + 0.4 + 1 + 0.5;
  // The riders, back ones first.
  const list = [];
  for (const r of P.riders) {
    where(P, (((t / round + r.lag) % 1) + 1) % 1 * round, pos);
    list.push([pos[2], r, pos[0], pos[1], pos[3], pos[4]]);
  }
  list.sort((a, b) => a[0] - b[0]);
  for (const [z, r, x, y, pose, dir] of list) {
    if (pose === 2) inside(P, out, r, y, dir);
    else if (pose === 1) walker(out, r, x, y, t);
    else sitter(P, out, r, x, y, z, dir, t);
  }
  // Bulbs on the rail, the eaves and the strings.
  for (let i = 0; i < P.bulbs.length; i++) {
    const f = P.bulbs[i];
    const s = Math.sin(f);
    const c = Math.cos(f);
    const x = CX + RO * s;
    const y = YTOP + (YBOT - YTOP) * (f / T) + RO * TILT * c - 2;
    const lit = 0.25 + 0.75 * Math.max(all, (0.5 + 0.5 * Math.cos(f * 1.5 - ct)) ** 3);
    bulb(P, out, x, y, RO * c + 0.3, i & 1 ? col : warm, lit);
  }
  for (let x = CX - RR + 1, i = 0; x <= CX + RR - 1; x += 3, i++) {
    bulb(P, out, x, eave(x) + 1, 60, (i + Math.floor(t * 3)) % 2 ? col2 : warm, 0.85);
  }
  for (const [x, y, i] of P.strings) bulb(P, out, x, y, STRING + 1, (i >> 2) % 3 === 0 ? col2 : (i >> 2) % 3 === 1 ? col : warm, Math.max(all, 0.55 + 0.35 * Math.sin(t * 2.1 + i)));
  // The flag on top, a pennant that ripples in the wind.
  for (let y = 1; y < YR; y++) paint(out, CX, y, [90, 90, 100], 1);
  for (let i = 0; i < 9; i++) {
    const half = 1.6 * (1 - i / 9);
    const wave = Math.sin(i * 0.8 - t * 7) * (i / 9) * 1.4;
    for (let d = -Math.ceil(half); d <= Math.ceil(half); d++) if (Math.abs(d) <= half + 0.3) paint(out, CX + 1 + i, 2.5 + d + wave, FLAG, 0.9 - 0.04 * i);
  }
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p % W, (p / W) | 0, Math.min(255, out[o]), Math.min(255, out[o + 1]), Math.min(255, out[o + 2]));
}

function paint(out, x, y, c, f) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  out[o] = c[0] * f;
  out[o + 1] = c[1] * f;
  out[o + 2] = c[2] * f;
}

function bulb(P, out, x, y, z, c, L) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (z < P.z[y * W + x] - 0.6) return;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const o = (yy * W + xx) * 3;
      const k = dx === 0 && dy === 0 ? 255 : dx === 0 || dy === 0 ? 70 : 28;
      out[o] += c[0] * k * L;
      out[o + 1] += c[1] * k * L;
      out[o + 2] += c[2] * k * L;
    }
}

// A rider on a mat, sitting up with the legs out in front, only where nothing
// nearer stands in front.
function sitter(P, out, r, x, y, z, dir, t) {
  const put = (fx, dy, c) => {
    const xx = Math.round(x) + fx * dir;
    const yy = Math.round(y) + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) return;
    if (z < P.z[yy * W + xx] - 0.6) return;
    const o = (yy * W + xx) * 3;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
  };
  for (let i = -2; i <= 2; i++) put(i, 0, MAT);
  put(-1, -1, r.shirt);
  put(0, -1, JEANS);
  put(1, -1, JEANS);
  put(2, -1, [235, 235, 240]);
  for (let dy = -3; dy <= -2; dy++) {
    put(-1, dy, r.shirt);
    put(0, dy, r.shirt);
  }
  put(-1, -4, r.skin);
  put(0, -4, r.skin);
  put(-1, -5, r.hair);
  put(0, -5, r.hair);
  // Half of them throw their arms up on the way down.
  if (r.arms && Math.sin(t * 3 + x * 0.1) > -0.3) for (let dy = -6; dy <= -4; dy++) put(1, dy, r.skin);
  else put(1, -3, r.skin);
}

// A rider walking back to the door with a mat under the arm.
function walker(out, r, x, y, t) {
  const step = Math.floor(t * 8) & 1;
  const px = Math.round(x);
  const py = Math.round(y);
  paint(out, px, py - 6, r.hair, 1);
  paint(out, px, py - 5, r.skin, 1);
  for (let d = 4; d >= 2; d--) paint(out, px, py - d, r.shirt, 1);
  paint(out, px - 1, py - 4, r.shirt, 0.8);
  paint(out, px, py - 1, JEANS, 1);
  paint(out, px - step, py, JEANS, 1);
  paint(out, px + 1 - step, py, JEANS, 0.8);
  for (let i = 1; i <= 3; i++) paint(out, px + i, py - 3, MAT, 1);
}

// A rider on the stair inside, seen only as a shadow crossing a window.
function inside(P, out, r, y, facing) {
  if (facing < -0.2) return;
  for (let dy = -4; dy <= 0; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const yy = Math.round(y) + dy;
      const xx = CX + dx;
      if (yy < 0 || yy >= H) continue;
      const p = yy * W + xx;
      const id = P.win[p];
      if (!id || id === 101) continue;
      if (dy === -4 && dx !== 0) continue;
      const o = p * 3;
      out[o] = r.shirt[0] * 0.25;
      out[o + 1] = r.shirt[1] * 0.2;
      out[o + 2] = r.shirt[2] * 0.2;
    }
}
