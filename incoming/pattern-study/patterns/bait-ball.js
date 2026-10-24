// ===== Patternflow pattern =====
// Title:   Bait Ball
// Family:  ocean
// Idea:    Seen from the side in open blue water, a sardine bait ball fills the panel with a thousand fish churning in layers, and when the school turns together a wave of silver runs across it until it turns away again and shows its dark blue backs, while sharks and dolphins charge through and gannets dive in from the surface, punching holes that close behind them.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the sardine bait balls of the Sardine Run
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Water=0..1, Speed=0.2..3, Predators=1..5, Sun=0..1
//
// Knob 1: Water. The colour of the sea: the clear blue of open ocean at 0, turning to the green of plankton-rich coastal water at 1.
// Knob 2: Speed. How fast the school and its hunters move: at 2 a turn runs across the ball in just over a second, and the school shows its flanks for five to eight seconds before it turns away; at 0.2 it all runs ten times slower.
// Knob 3: Predators. How many sharks and dolphins work the ball, from one to five. More hunters charge more often and bring more gannets with them. The school packs tighter against them.
// Knob 4: Sun. The time of day, from noon of a Sardine Run winter at 0, when the sun stands 35 degrees up and its rays lean 38 degrees in the water, to late afternoon at 1. Toward 1 the rays lean further and fade as the sea darkens. The flash dims to cold steel.
// Buttons: K1 tap sends a hunter charging through the ball now.

const W = 64;
const H = 128;
const N = W * H;
// Fish swim in rows one LED apart, each two body lengths behind the next and
// one length along from the fish in the rows above and below, as schools space themselves.
const ROWS = 124;
const GAP = 6;
// Each row's fish wrap round this length, wider than the panel so the wrap stays out of sight.
const SPAN = 84;
// Rows swim in bands this deep, each band the other way from the next: the ball mills.
const BAND = 13;
// How fast a turning front runs, in LEDs per second at Speed 2.
const SWEEP = 80;
const { min, max, sin, exp, sqrt, round, floor, atan2, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const hash = (a, b) => {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// A dusky shark and a common dolphin, nose to the right: # back, b belly, h the dolphin's tan flank, e eye.
const SHARK = [
  "..........#.........",
  ".........##.........",
  "#.......##########..",
  "##...###############",
  ".##############e####",
  "##...bbbbbbbbbbbbbb.",
  "#........#.....#....",
];
const DOLPHIN = [
  "........#..........",
  ".......##..........",
  "...###########.....",
  "##############e##..",
  ".##hhhhhhbbbbbbbbbb",
  "##...bbbbbbbbb.....",
  ".........#.........",
];
const SHARK_C = { "#": [30, 40, 54], b: [74, 84, 96], e: [4, 4, 6] };
const DOLPHIN_C = { "#": [40, 48, 66], b: [128, 136, 148], h: [118, 104, 70], e: [4, 4, 6] };

export function setup(params) {
  const fu = [];
  const fr = [];
  for (let j = 0; j < ROWS; j++)
    for (let u = (j & 1) * (GAP / 2); u < SPAN - 1; u += GAP) {
      fu.push(u + (Math.random() - 0.5) * 1.4);
      fr.push(j);
    }
  const n = fu.length;
  const R = (a, b) => Float32Array.from({ length: n }, () => a + Math.random() * b);
  const v = new Float32Array(ROWS);
  for (let j = 0; j < ROWS; j++) {
    const b = floor(j / BAND);
    v[j] = (b & 1 ? -1 : 1) * (3.2 + 2.4 * sin(b * 2.1 + 0.4));
  }
  params.s = {
    fu: Float32Array.from(fu),
    fr: Uint8Array.from(fr),
    edge: R(0, 1),
    lag: R(0, 1),
    ph: R(0, 6.283),
    v,
    off: new Float32Array(ROWS),
    buf: new Float32Array(N * 3),
    clear: new Float32Array(N),
    lt: new Float32Array(129),
    rt: new Float32Array(440),
    tau: 0,
    base: 0,
    ev: [],
    next: 2.08,
    nextTo: 1,
    nextDir: 1,
    hunters: [],
    gannets: [],
    bubbles: [],
    holes: [],
    // The first hunter charges just as the panel has opened, and the school turns from it.
    slots: Float32Array.from({ length: 5 }, (_, k) => 2.1 + k * (1.7 + Math.random() * 1.2)),
    gTimer: 3.2 + Math.random(),
    queue: [],
    k: [0, 2, 1, 0.06],
  };
}

function charge(S, from) {
  const dir = from || (Math.random() < 0.5 ? 1 : -1);
  S.hunters.push({
    kind: Math.random() < 0.5 ? 0 : 1,
    dir,
    x: dir > 0 ? -18 : W + 18,
    y0: S.cy + (Math.random() * 2 - 1) * S.ry * 0.55,
    y: 0,
    sp: 38 + Math.random() * 16,
    ph: Math.random() * 6.283,
    drop: 0,
  });
}

function dive(S, delay) {
  S.queue.push({ at: S.tau + delay, x: 8 + Math.random() * 48 });
}

// How far a turn has carried a point: 0 shows the backs, 1 the silver flanks.
// Each front is kept as one position per row. TG is the flash right on the
// front, where the fish are mid-turn.
let TG = 0;
function fronts(S) {
  for (const e of S.ev) {
    if (!e.row) e.row = new Float32Array(H);
    const X = (S.tau - e.at) * SWEEP - 12;
    for (let y = 0; y < H; y++) e.row[y] = X - 9 * sin(y * 0.045 + e.ph) - 0.2 * (y - 64) * e.tilt;
  }
}
function turned(S, x, y, lag) {
  let s = S.base;
  TG = 0;
  const yi = y < 0 ? 0 : y > H - 1 ? H - 1 : y | 0;
  for (const e of S.ev) {
    const d = e.row[yi] - (e.dir > 0 ? x : 63 - x) - lag * 8;
    if (d <= 0) continue;
    if (d >= 8) {
      s = e.to;
      continue;
    }
    const p = sstep(0, 8, d);
    TG = max(TG, 4 * p * (1 - p));
    s += (e.to - s) * p;
  }
  return s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || S.k;
  S.k = [clamp(k[0], 0, 1), clamp(k[1], 0.2, 3), clamp(k[2], 1, 5), clamp(k[3], 0, 1)];
  dt = clamp(dt || 0, 0, 0.1);
  const d = dt * (S.k[1] / 2);
  S.tau += d;
  const t = S.tau;
  const hunt = round(S.k[2]);
  // The more hunters, the tighter the school packs.
  const sc = 1 - 0.055 * (S.k[2] - 1);
  S.cx = 32 + 2.5 * sin(t * 0.17);
  S.cy = 73 + 3 * sin(t * 0.13 + 1);
  S.rx = 32 * sc;
  S.ry = 61 * sc;
  for (let j = 0; j < ROWS; j++) S.off[j] += S.v[j] * d;

  // The turns: the first comes just after the panel opens on dark backs.
  if (t >= S.next) {
    S.ev.push({ at: S.next, to: S.nextTo, dir: S.nextDir, ph: Math.random() * 6.283, tilt: Math.random() * 2 - 1 });
    const first = S.ev.length === 1 && S.next < 3;
    S.next += S.nextTo ? (first ? 7.3 : 5 + Math.random() * 3) : 2.6 + Math.random() * 2;
    S.nextTo = 1 - S.nextTo;
    S.nextDir = first ? -1 : Math.random() < 0.5 ? 1 : -1;
  }
  // A front that has left the panel is folded into the base state.
  while (S.ev.length && (t - S.ev[0].at) * SWEEP > 130) S.base = S.ev.shift().to;

  // Hunters from the sides, each on its own clock.
  for (let i = 0; i < 5; i++) {
    if (i >= hunt) continue;
    S.slots[i] -= d;
    if (S.slots[i] <= 0) {
      // The first comes in from the left, the side the first turn starts from.
      charge(S, S.charged ? 0 : 1);
      S.charged = true;
      S.slots[i] = 3 + Math.random() * 4;
    }
  }
  if (input.btnPressed && input.btnPressed[0]) charge(S);
  // Gannets come in volleys of two to four.
  S.gTimer -= d * (0.6 + 0.4 * hunt);
  if (S.gTimer <= 0) {
    const m = 2 + floor(Math.random() * 3);
    for (let i = 0; i < m; i++) dive(S, i * (0.2 + Math.random() * 0.3));
    S.gTimer = 4 + Math.random() * 4;
  }
  for (let i = S.queue.length - 1; i >= 0; i--) {
    const q = S.queue[i];
    if (t < q.at) continue;
    S.queue.splice(i, 1);
    S.gannets.push({ x: q.x, y: -3, vx: (Math.random() * 2 - 1) * 14, vy: 100 + Math.random() * 30, up: false, last: 0 });
  }

  for (let i = S.hunters.length - 1; i >= 0; i--) {
    const h = S.hunters[i];
    h.x += h.dir * h.sp * d;
    h.y = h.y0 + 7 * sin(h.x * 0.035 + h.ph);
    h.drop += d;
    if (h.drop > 0.07) {
      h.drop = 0;
      S.holes.push({ x: h.x + h.dir * 5, y: h.y, r: 10.5, age: 0, life: 0.9 });
    }
    if (h.x < -36 || h.x > W + 36) S.hunters.splice(i, 1);
  }
  for (let i = S.gannets.length - 1; i >= 0; i--) {
    const g = S.gannets[i];
    const wet = g.y > 2;
    g.x += g.vx * d;
    g.y += g.vy * d;
    if (!wet && g.y > 2) {
      // The splash: a burst of air dragged under.
      for (let b = 0; b < 16; b++) bubble(S, g.x + (Math.random() * 2 - 1) * 4, 3 + Math.random() * 8);
    }
    if (g.y > 2 && !g.up) {
      g.vy *= exp(-1.5 * d);
      g.vx *= exp(-1.5 * d);
      if (Math.random() < 0.9) bubble(S, g.x - g.vx * 0.04, g.y - 3 - Math.random() * 3);
      if (g.vy < 20) {
        g.up = true;
        g.vy = -32;
      }
    }
    g.last += d;
    if (g.y > 2 && g.last > 0.06) {
      g.last = 0;
      S.holes.push({ x: g.x, y: g.y, r: 4.5, age: 0, life: 0.9 });
    }
    if (g.up && g.y < -4) S.gannets.splice(i, 1);
  }
  for (let i = S.bubbles.length - 1; i >= 0; i--) {
    const b = S.bubbles[i];
    b.age += d;
    b.y -= b.vy * d;
    b.x += sin(b.age * 6 + b.ph) * 4 * d;
    if (b.age > b.life || b.y < 1) S.bubbles.splice(i, 1);
  }
  for (let i = S.holes.length - 1; i >= 0; i--) {
    S.holes[i].age += d;
    if (S.holes[i].age > S.holes[i].life) S.holes.splice(i, 1);
  }
}

function bubble(S, x, y) {
  if (S.bubbles.length < 400) S.bubbles.push({ x, y, vy: 9 + Math.random() * 12, age: 0, life: 1.2 + Math.random() * 1.6, ph: Math.random() * 6.283 });
}

function put(buf, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = r;
  buf[o + 1] = g;
  buf[o + 2] = b;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.cx === undefined) return;
  const { buf } = S;
  const t = S.tau;
  const [wq, , , sun] = S.k;
  // The sea: clear blue to coastal green, light near the surface and deep below.
  const top = [mix(30, 50, wq), mix(118, 150, wq), mix(196, 120, wq)];
  const deep = [mix(4, 8, wq), mix(30, 52, wq), mix(84, 44, wq)];
  const day = 1 - 0.45 * sun;
  // Rays bend into the water: 55 degrees off the vertical above it is 38 below, 82 is 48.
  const slope = mix(0.78, 1.11, sun);
  const rayS = mix(1, 0.3, sun) * day;
  // Low sun reaches the school through more water, so the flash cools as it dims.
  const silver = [mix(242, 200, sun), mix(249, 214, sun), mix(255, 232, sun)];
  const flash = mix(1, 0.7, sun);
  const back = [mix(12, 10, wq), mix(28, 42, wq), mix(52, 40, wq)];
  const glow = [10 * flash, 16 * flash, 22 * flash];
  const { cx, cy, rx, ry } = S;
  // The ball's outline, one radius for each of 128 directions, and the rays by where they leave the surface.
  const { lt, rt, clear } = S;
  for (let i = 0; i <= 128; i++) {
    const th = -PI + (i * PI) / 64;
    lt[i] = 1 + 0.08 * sin(3 * th + 0.45 * t) + 0.06 * sin(5 * th - 0.7 * t + 1) + 0.05 * sin(2 * th + 0.25 * t + 2);
  }
  const lump = (th) => lt[round(((th + PI) * 64) / PI)];
  for (let i = 0; i < rt.length; i++) {
    const u = i / 2 - 150;
    const ray = sin(u * 0.23 + t * 0.35) + 0.8 * sin(u * 0.41 - t * 0.27 + 1.3) + 0.6 * sin(u * 0.13 + t * 0.15 + 2) - 0.9;
    rt[i] = ray > 0 ? ray : 0;
  }
  fronts(S);
  // Where the hunters have just been, the ball is open and the sea shows through.
  clear.fill(0);
  for (const h of S.holes) {
    const rr = (h.rr = h.r * (1 - h.age / h.life) ** 0.6);
    for (let y = max(0, floor(h.y - rr)); y <= min(H - 1, h.y + rr); y++)
      for (let x = max(0, floor(h.x - rr * 1.6)); x <= min(W - 1, h.x + rr * 1.6); x++) {
        const dd = sqrt(((x - h.x) / 1.6) ** 2 + (y - h.y) ** 2);
        const c = 1 - sstep(0.45 * rr, 0.8 * rr, dd);
        if (c > clear[y * W + x]) clear[y * W + x] = c;
      }
  }

  for (let y = 0; y < H; y++) {
    const dz = y / (H - 1);
    const f = dz ** 0.8;
    const wr = mix(top[0], deep[0], f) * day;
    const wg = mix(top[1], deep[1], f) * day;
    const wb = mix(top[2], deep[2], f) * day;
    const fade = exp(-y / 60) * rayS;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      // Sun rays: bright where the waves above focus the light, leaning with the sun.
      const u = x - slope * y;
      const ray = rt[((u + 150) * 2) | 0] * fade;
      let r = wr + ray * 46;
      let g = wg + ray * 60;
      let b = wb + ray * 58;
      const ddx = (x - cx) / rx;
      const ddy = (y - cy) / ry;
      const q0 = sqrt(ddx * ddx + ddy * ddy);
      // The outline only matters near it: the lumps change the radius by a fifth at most.
      const q = q0 < 0.7 || q0 > 1.8 ? q0 : q0 / lump(atan2(ddy, ddx));
      if (q < 1.5) {
        // Inside the ball the fish shade the water; outside it, light thrown off their flanks.
        const m0 = 1 - sstep(0.88, 1.05, q);
        const c = clear[y * W + x];
        const m = m0 * (1 - c);
        const s = turned(S, x, y, 0.5);
        const sh = 1 - 0.9 * m;
        const hl = (s + 0.6 * TG) * (1.6 * m + 0.6 * c * m0 + (1 - m0) * 3.4 * (1 - sstep(1, 1.5, q)));
        r = r * sh + glow[0] * hl;
        g = g * sh + glow[1] * hl;
        b = b * sh + glow[2] * hl;
      }
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }

  // The fish.
  const { fu, fr, edge, lag, ph, v, off, holes } = S;
  const tick = floor(t * 6);
  for (let i = 0; i < fu.length; i++) {
    const j = fr[i];
    let u = (fu[i] + off[j]) % SPAN;
    if (u < 0) u += SPAN;
    let x = cx + u - SPAN / 2;
    if (x < -4 || x > W + 3) continue;
    let y = cy + (j - (ROWS - 1) / 2) + 1.2 * sin(x * 0.085 + t * 0.6);
    const ddx = (x - cx) / rx;
    const ddy = (y - cy) / ry;
    const q0 = sqrt(ddx * ddx + ddy * ddy);
    if (q0 > 0.74 && q0 / lump(atan2(ddy, ddx)) > 0.93 + 0.1 * edge[i]) continue;
    // Holes the hunters punch: fish inside are pushed to the rim and flash as they flee.
    let startle = 0;
    for (let h = 0; h < holes.length; h++) {
      const H0 = holes[h];
      const rr = H0.rr;
      const hy = y - H0.y;
      if (hy > rr * 1.8 || hy < -rr * 1.8) continue;
      const hx = (x - H0.x) / 1.6;
      const d2 = hx * hx + hy * hy;
      if (d2 > rr * rr * 3.2) continue;
      const dd = sqrt(d2) + 1e-3;
      if (dd < rr) {
        const k = (rr - (rr - dd) * 0.3) / dd;
        x = H0.x + hx * 1.6 * k;
        y = H0.y + hy * k;
      }
      startle = max(startle, 1 - dd / (rr * 1.8));
    }
    let s = turned(S, x, y, lag[i]);
    let g = TG;
    if (hash(i, tick) < 0.012) g = 1;
    s = max(s, startle);
    const dir = v[j] > 0 ? 1 : -1;
    const len = s > 0.5 ? 3 : 2;
    // Broadside the flanks shimmer as ripples run through the school.
    const rip = 0.5 + 0.5 * sin(x * 0.27 - t * 2.6 + y * 0.08 + ph[i] * 0.3);
    const lit = (1 - 0.06 * s * rip * rip * rip) * flash;
    const xi = round(x);
    const yi = round(y);
    for (let p = 0; p < len; p++) {
      const w = (p === 0 ? 1 : p === 1 ? 0.95 : 0.86) * lit;
      const a = s * w;
      const c = (1 - s) * (p === 0 ? 1 : 0.8);
      put(buf, xi - dir * p, yi, back[0] * c + silver[0] * a + 90 * g, back[1] * c + silver[1] * a + 95 * g, back[2] * c + silver[2] * a + 100 * g);
    }
  }

  // The hunters, dark against the silver, drawn half as large again as their art.
  for (const h of S.hunters) {
    const art = h.kind ? DOLPHIN : SHARK;
    const col = h.kind ? DOLPHIN_C : SHARK_C;
    const wd = round(art[0].length * 1.5);
    const ht = round(art.length * 1.5);
    const x0 = round(h.x - wd / 2);
    const y0 = round(h.y - ht / 2);
    for (let j = 0; j < ht; j++)
      for (let i = 0; i < wd; i++) {
        const c = art[floor(j / 1.5)][floor((h.dir > 0 ? i : wd - 1 - i) / 1.5)];
        if (c === ".") continue;
        const cc = col[c];
        put(buf, x0 + i, y0 + j, cc[0] * day, cc[1] * day, cc[2] * day);
      }
  }
  for (const b of S.bubbles) {
    const a = 1 - b.age / b.life;
    const x = round(b.x);
    const y = round(b.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3;
    buf[o] = mix(buf[o], 210, a);
    buf[o + 1] = mix(buf[o + 1], 240, a);
    buf[o + 2] = mix(buf[o + 2], 255, a);
  }
  // Gannets: white darts with buff heads and black wingtips, folded for the dive.
  for (const g of S.gannets) {
    const sp = sqrt(g.vx * g.vx + g.vy * g.vy) + 1e-3;
    const ux = g.vx / sp;
    const uy = g.vy / sp;
    for (let p = 0; p < 6; p++) {
      const px = round(g.x - ux * p);
      const py = round(g.y - uy * p);
      if (p === 0) put(buf, px, py, 250, 228, 150);
      else if (p < 4) {
        put(buf, px, py, 250, 250, 250);
        if (p === 2) put(buf, px + 1, py, 225, 228, 232);
      } else put(buf, px, py, 26, 26, 30);
    }
  }
  // The underside of the surface, bright and broken by the waves.
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < W; x++) {
      const a = [0.85, 0.5, 0.2][y] * (0.7 + 0.3 * sin(x * 0.5 + t * 2.1) * sin(x * 0.23 - t * 1.3));
      const o = (y * W + x) * 3;
      buf[o] = mix(buf[o], 200 * day, a);
      buf[o + 1] = mix(buf[o + 1], 232 * day, a);
      buf[o + 2] = mix(buf[o + 2], 248 * day, a);
    }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
    }
}
