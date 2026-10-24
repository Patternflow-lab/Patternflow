// ===== Patternflow pattern =====
// Title:   High Dive
// Family:  sport
// Idea:    A diving hall at night seen from the side: divers climb a concrete tower and somersault ten metres in a second and a half into a pool whose rippling light plays over the walls while the scoreboard posts the marks.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the 10 m platform event in competition diving
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Pool=0..1, Speed=0.2..3, Dive=0..4, Lights=0..1
//
// Knob 1: Pool. The colour of the underwater lights, aqua at 0 and once round the wheel; the pool throws it onto the walls.
// Knob 2: Speed. Real time at 2, where a dive takes about 1.6 s and a diver starts up the stairs every 6 s; ten times slower at 0.2.
// Knob 3: Dive. The next dive, from a plain forward dive through forward somersaults of 1.5 up to 3.5 to 2.5 with two twists. Harder ones jump higher and take longer to set up. The scoreboard shows the dive and its difficulty.
// Knob 4: Lights. From a dim night practice with only the tower lamps on to full competition lights.
// Buttons: K1 tap sends the waiting diver off now, or hurries the one on the stairs.

const W = 64;
const H = 128;
const N = W * H;
// The still waterline and the pool floor; the pool's end wall stands under the tower.
const WL = 86;
const POOL_X = 14;
const FLOOR = 123;
// LEDs per metre, and gravity in LEDs per second squared.
const PX = 7;
const G = 9.81 * PX;
// The top row of each platform (10 m, 7.5 m, 5 m, 3 m) and where it ends.
const PLAT = [16, 33, 51, 65];
const PLAT_END = [26, 21, 23, 19];
// Where a diver's hip stands at the edge of the 10 m platform.
const EDGE = 24;
const HIP = 5.4;
const INTERVAL = 6;
const [CLIMB, WALK, STAND, FLY, UNDER, SWIM] = [0, 1, 2, 3, 4, 5];

// Number, difficulty in tenths, somersaults, position (2 is a tuck, 1 a pike),
// twists, take-off speed in m/s, seconds the diver stands first.
const DIVES = [
  ["101A", 16, 0.5, 0, 0, 1.6, 0.5],
  ["103B", 20, 1.5, 1, 0, 2.4, 1.1],
  ["105B", 30, 2.5, 1, 0, 3.0, 1.6],
  ["107C", 37, 3.5, 2, 0, 3.5, 2.1],
  ["5154B", 36, 2.5, 1, 2, 3.2, 2.5],
];
const SUITS = [[255, 40, 60], [40, 110, 255], [255, 215, 30], [30, 220, 120], [220, 60, 255]];
const SKIN = [245, 180, 140];

const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
const F = (n) => new Float32Array(n);
// A fixed hash, so the window lights and the glints repeat on every run.
const hash = (a, b) => ((Math.imul(a * 7919 + b, 2654435761) >>> 8) & 1023) / 1024;
const hsv = (h, s, v) => [5, 3, 1].map((n) => v - v * s * max(0, min((n + h * 6) % 6, 4 - ((n + h * 6) % 6), 1)));

// The climb, as feet positions: in along the deck, then up the flights that
// zigzag across the stairwell to the top of the tower.
const PATH = [[-6, 83.5], [11, 83.5], [3, 74], [11, 64.5], [3, 57.5], [11, 50.5], [3, 41.5], [11, 32.5], [3, 24], [11, 15.5]];
const SEGL = [];
let PLEN = 0;
for (let j = 1; j < PATH.length; j++) {
  SEGL.push(hypot(PATH[j][0] - PATH[j - 1][0], PATH[j][1] - PATH[j - 1][1]));
  PLEN += SEGL[j - 1];
}
function along(p, out) {
  let j = 0;
  while (j < SEGL.length - 1 && p > SEGL[j]) p -= SEGL[j++];
  const u = cl(p / SEGL[j], 0, 1);
  const a = PATH[j];
  const b = PATH[j + 1];
  out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u;
  out[2] = b[0] >= a[0] ? 1 : -1; out[3] = j > 0 ? 1 : 0;
}

// The scoreboard's letters, three wide and five tall, one bit an LED.
const FONT = { 0: 0x7b6f, 1: 0x2c97, 2: 0x73e7, 3: 0x73cf, 4: 0x5bc9, 5: 0x79cf, 6: 0x79ef, 7: 0x7249, 8: 0x7bef, 9: 0x7bcf, A: 0x2bed, B: 0x6bae, C: 0x3923, D: 0x6b6e, M: 0x5fed, ".": 4 };

// The hall, built once: what each LED's surface is made of and how much
// light the lamps and the pool throw on it.
function build(S) {
  const [alb, em] = [F(N * 3), F(N * 3)];
  const [lt, lh, rf, cone, wb, wl] = [F(N), F(N), F(N), F(N), F(N), F(N)];
  const lamp = (x, y, lx) => exp(-((x - lx) ** 2) / 300 - (y - 1) ** 2 / 5200);
  const glow = (x, y, s) => exp(-((x - 28) ** 2 + (y - 106) ** 2) / s) + exp(-((x - 52) ** 2 + (y - 106) ** 2) / s);
  const flights = [];
  for (let j = 1; j < PATH.length - 1; j++) flights.push([PATH[j], PATH[j + 1]]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // Back wall: painted block in panels, catching the pool's light.
      let a = x % 8 ? [0.42, 0.44, 0.5] : [0.36, 0.37, 0.42];
      let r = 1;
      let plat = -1;
      for (let p = 0; p < 4; p++) if (y >= PLAT[p] && y <= PLAT[p] + 2 && x <= PLAT_END[p]) plat = p;
      if (y <= 1) {
        a = [0.18, 0.18, 0.2]; r = 0;
      } else if (x >= 33 && y >= 3 && y <= 33) {
        // The scoreboard.
        a = x === 33 || x === 63 || y === 3 || y === 33 ? [0.5, 0.5, 0.52] : [0.03, 0.03, 0.035];
        r = 0;
      } else if (y >= 9 && y < PLAT[0] && x <= 12 && (x % 6 === 0 || y === 9 || y === 12)) {
        a = [0.7, 0.74, 0.8]; r = 0.5;
      } else if (plat >= 0) {
        const row = y - PLAT[plat];
        const v = x === PLAT_END[plat] ? 0.75 : row === 0 ? 0.92 : row === 1 ? 0.62 : 0.4;
        a = [v, v * 0.97, v * 0.92]; r = row === 2 ? 1.6 : 0.8;
      } else if (x <= 12 && y > PLAT[0] && y < 84) {
        // The tower: two concrete legs and the stairwell between them.
        if (x <= 1 || x === 12) {
          const v = 0.62 - 0.06 * (y % 5 === 0);
          a = [v, v * 0.97, v * 0.9];
        } else {
          a = [0.24, 0.24, 0.26];
          for (const [p, q] of flights) {
            const lo = min(p[0], q[0]);
            const hi = max(p[0], q[0]);
            if (x < lo - 1 || x > hi + 1) continue;
            const xs = cl(x, lo, hi);
            const sl = (q[1] - p[1]) / (q[0] - p[0]);
            const xq = p[0] + floor((xs - p[0]) / 2 + (q[0] > p[0] ? 0 : 0.99)) * 2;
            const yf = p[1] + sl * (cl(xq, lo, hi) - p[0]);
            if (y >= ceil(yf) && y <= ceil(yf) + 1) a = [0.74, 0.72, 0.66];
            else if (abs(y - p[1] + 5.5 - sl * (xs - p[0])) < 0.5 && x >= lo && x <= hi) a = [0.4, 0.4, 0.42];
          }
          r = 0.6;
        }
      } else if (y >= 84 && y <= 86 && x < POOL_X) {
        a = [0.8, 0.8, 0.78]; r = 0.7;
      } else if (y > 86 && x < POOL_X) {
        // The ground under the deck, hatched like the cut concrete of a section drawing.
        a = x === POOL_X - 1 ? [0.6, 0.65, 0.66] : [0.2, 0.2, 0.21];
        r = 0;
        if (x < POOL_X - 1 && (x + y) % 4 === 0) em.fill(30, i * 3, i * 3 + 3);
      } else if (y >= 84) {
        // The gutter on the far side, and the far wall when a wave dips.
        a = y < 86 ? [0.78, 0.8, 0.82] : [0.6, 0.66, 0.7];
        r = 0.6;
      } else if (x >= 31 && x <= 61 && y >= 39 && y <= 63) {
        // Tall windows onto the night.
        if ((x - 31) % 10 === 0 || (y - 39) % 12 === 0) {
          a = [0.33, 0.34, 0.37]; r = 0.6;
        } else {
          a = [0.06, 0.07, 0.09]; r = 0.35;
          const g = (y - 39) / 24;
          const c = y > 54 && hash(x, y) < 0.1;
          em.set([6 + 8 * g + 120 * c, 14 + 14 * g + 90 * c, 38 + 26 * g + 40 * c], i * 3);
        }
      }
      // Light reflected up from the pool fades with height above the water.
      rf[i] = r * exp(-max(0, WL - y) / 30); alb.set(a, i * 3);
      lt[i] = lamp(x, y, 6) + lamp(x, y, 22); lh[i] = lamp(x, y, 40) + lamp(x, y, 56) + 0.3;
      // The platform lamp: a cone of hazy light from the ceiling onto the 10 m platform.
      if (y >= 3 && y <= PLAT[0]) {
        const e = y - 2;
        cone[i] = sm((x - 21 + e * 0.85) / 2) * sm((23 + e * 0.42 - x) / 2) * (1 - 0.45 * (e / 14));
      }
      // Underwater: light fading with depth, and the tiled far wall with its two lamps.
      if (x >= POOL_X && y >= WL - 2) {
        const d = y - WL;
        let v = 0.34 + 0.42 * exp(-max(0, d) / 13);
        if ((x - POOL_X) % 5 === 0 || (y - WL) % 5 === 4) v *= 0.82;
        if (y >= FLOOR) {
          // The floor, with the dark lane lines running away from us.
          v = 0.62 - 0.06 * (y - FLOOR);
          const dx = x - 21 - floor((x - 21) / 14) * 14 - ((y - FLOOR) * (x - 38)) / 40;
          if (x >= 21 && abs(dx) < 1.2) v = 0.16;
        }
        wb[i] = v;
        wl[i] = 1.1 * glow(x, y, 3) + 0.22 * glow(x, y, 50);
      }
    }
  Object.assign(S, { alb, lt, lh, rf, em, cone, wb, wl });
}

function newDiver(S, st) {
  S.num = (S.num % 9) + 1;
  const suit = SUITS[floor(rnd() * 5) % 5];
  return { st, p: 0, x: 0, t: 0, num: S.num, suit, wait: rnd() * 0.4, hx: -20, face: 1, q: [0, 0, 0, 0, 0, PI, PI, 0] };
}

export function setup(params) {
  const S = { t: 0, divers: [], drops: [], bubs: [], num: 0, spawn: 0.5, spot: 1, surge: 0.1, foam: -9, foamX: 0, hue: 0.49, dive: 0, lights: 0.06 };
  Object.assign(S, { h: F(W), hv: F(W), sy: new Int16Array(W), sh: F(W), C: F(N * 3) });
  params.s = S; build(S);
  const a = newDiver(S, STAND);
  a.x = EDGE; a.wait = 0; S.divers.push(a);
  S.board = { num: a.num, suit: a.suit, sc: null, reveal: -1 };
}

// Poses are [body angle, hip and knee of each leg, each arm, twist].
function walkPose(q, ph, stair) {
  const s = sin(ph);
  const lift = 0.35 * stair;
  q.splice(0, 8, 0.08 * stair, 0.45 * s + lift * max(0, s), 0.5 * max(0, s) + 0.3 * stair, -0.45 * s + lift * max(0, -s), 0.5 * max(0, -s) + 0.3 * stair, PI - 0.4 * s, PI + 0.4 * s, 0);
}

function flyPose(q, D, u) {
  const [, , turns, pos, twist] = D;
  const Th = turns * TAU;
  let th, arm;
  let s = 0;
  let tw = 0;
  if (turns < 1) {
    // A plain forward dive: arms out like a swallow, closing overhead for the entry.
    th = Th * min(1, u / 0.9);
    arm = 1.5 * sm(u / 0.2) * (1 - sm((u - 0.55) / 0.25));
  } else {
    // Fold up, spin fast, open out at about three quarters of the fall and line up.
    const uo = 0.72;
    th = u < uo ? (Th - 0.5) * (u / uo) ** 1.15 : Th - 0.5 + 0.5 * sm((u - uo) / (0.92 - uo));
    s = sm(u / 0.1) * (1 - sm((u - uo + 0.03) / 0.08));
    if (twist) {
      tw = twist * TAU * sm((u - 0.05) / 0.33); s *= sm((u - 0.38) / 0.06);
    }
    arm = s * (pos === 2 ? 1.9 : 2.5);
    if (twist) arm = max(arm, PI * 0.9 * sm(u / 0.06) * (1 - sm((u - 0.36) / 0.06)));
  }
  const hip = s * (pos === 2 ? 2.3 : 2.75);
  const knee = pos === 2 ? s * 2.6 : 0;
  q.splice(0, 8, th, hip, knee, hip, knee, arm, arm, tw);
}

function takeOff(S, d) {
  const D = DIVES[S.dive];
  Object.assign(d, { dv: D, st: FLY, t: 0, x0: d.hx, y0: d.hy, vx: D[2] < 1 ? 6 : 7.5, vy: D[5] * PX });
  // Time until the hands reach the water, with the body straight and head down.
  d.T = (d.vy + sqrt(d.vy * d.vy + 2 * G * (WL - 8.6 - d.y0))) / G;
  [S.board.code, S.board.dd] = D;
}

function enter(S, d) {
  const ex = round(d.hx);
  for (let j = -2; j <= 2; j++) S.hv[cl(ex + j, POOL_X, W - 1)] += 30 * (1 - abs(j) * 0.25);
  // A rip throws up only a few drops and drags air down the hole.
  for (let j = 0; j < 12; j++) S.drops.push({ x: ex + (rnd() - 0.5) * 3, y: WL - 1, vx: (rnd() - 0.5) * 16, vy: -(14 + rnd() * 30) });
  for (let j = 0; j < 4; j++) S.drops.push({ x: ex + rnd() - 0.5, y: WL - 1, vx: (rnd() - 0.5) * 3, vy: -(30 + rnd() * 14) });
  for (let j = 0; j < 40; j++) bub(S, ex + (rnd() - 0.5) * 4, WL + 1 + rnd() * 8, 6 + rnd() * 16, 1 + rnd() * 2.2, 0.7 + 0.3 * rnd());
  S.foam = S.t; S.foamX = ex;
  Object.assign(d, { st: UNDER, t: 0, xE: d.hx, yE: d.hy, vE: G * d.T - d.vy });
  S.board.reveal = 0.7;
}

// Seven judges; the two highest and two lowest drop, the middle three times the difficulty.
function score(S) {
  const b = S.board;
  const q = 6.4 + rnd() * 2.7;
  const sc = [];
  for (let j = 0; j < 7; j++) sc.push(cl(round(q + (rnd() - 0.5) * 1.8), 3, 9));
  const order = [0, 1, 2, 3, 4, 5, 6].sort((i, j) => sc[i] - sc[j] || i - j);
  b.drop = order.slice(0, 2).concat(order.slice(5));
  const v = (sc[order[2]] + sc[order[3]] + sc[order[4]]) * b.dd;
  b.total = `${floor(v / 10)}.${v % 10}0`;
  b.sc = sc;
}

const onPlat = (v) => v.st === WALK || v.st === STAND;
const bub = (S, x, y, vy, life, b) => S.bubs.push({ x, y, vy, life, b });

// K1: whoever is on the platform goes now; failing that, the climber hurries.
function go(S) {
  const d = S.divers.find(onPlat) || S.divers.find((v) => v.st === CLIMB);
  if (d) d.hurry = d.go = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1); S.hue = (0.49 + cl(k[0], 0, 1)) % 1; S.dive = cl(round(k[2]), 0, 4);
  S.lights = cl(k[3], 0, 1);
  const st = (dt * cl(k[1], 0.2, 3)) / 2;
  S.t += st;
  if (input.btnPressed && input.btnPressed[0]) go(S);

  S.spawn -= st;
  if (S.spawn <= 0 && S.divers.length < 7) {
    S.spawn += INTERVAL; S.divers.push(newDiver(S, CLIMB));
  }
  const busy = S.divers.some(onPlat);
  const surf = (x) => WL + S.h[cl(round(x), POOL_X, W - 1)];
  const flying = S.divers.some((v) => v.st === FLY);
  let lim = PLEN;
  const pt = [0, 0, 0, 0];
  const top = PLAT[0] - 0.5 - HIP;
  for (const d of S.divers) {
    const q = d.q;
    if (d.st === CLIMB) {
      // Climbers keep a flight apart and wait at the top while the platform is taken.
      d.p = min(d.p + st * 24 * (d.hurry ? 3 : 1), lim);
      lim = d.p - 16; along(d.p, pt); d.hx = pt[0]; d.hy = pt[1] - HIP; d.face = pt[2];
      walkPose(q, d.p * 0.55, pt[3]);
      if (d.p >= PLEN && !busy) {
        d.st = WALK; d.x = 11;
        Object.assign(S.board, { num: d.num, suit: d.suit, sc: null, reveal: -1 });
      }
    } else if (d.st === WALK) {
      d.hx = d.x = min(EDGE, d.x + st * 14 * (d.hurry ? 2.5 : 1));
      d.hy = top; d.face = 1; walkPose(q, d.x * 0.6, 0);
      if (d.x >= EDGE) {
        d.st = STAND; d.t = 0;
      }
    } else if (d.st === STAND) {
      d.t += st;
      const wait = DIVES[S.dive][6] + d.wait;
      d.hx = EDGE; d.hy = top; walkPose(q, 0, 0);
      // Arms come up from the sides over the last moment before take-off.
      q[5] = q[6] = PI * (1 - (d.go ? 1 : sm((d.t - wait + 0.6) / 0.45)));
      if (d.go || (d.t >= wait && !flying)) takeOff(S, d);
    } else if (d.st === FLY) {
      d.t += st; d.hx = d.x0 + d.vx * d.t; d.hy = d.y0 - d.vy * d.t + 0.5 * G * d.t * d.t;
      flyPose(q, d.dv, min(1, d.t / d.T));
      if (d.t >= d.T) enter(S, d);
    } else if (d.st === UNDER) {
      d.t += st; q[1] = q[2] = q[3] = q[4] = q[7] = 0;
      if (d.t < 0.5) {
        // Straight down the hole it punched, slowing fast and trailing air.
        d.yD = d.hy = d.yE + d.vE * 0.22 * (1 - exp(-d.t / 0.22));
        d.hx = d.xE; q[0] = PI; q[5] = q[6] = 0;
        for (let j = 0; j < st * 260; j++) bub(S, d.hx + (rnd() - 0.5) * 3, WL + 1 + rnd() * (d.hy + 6 - WL), 8 + rnd() * 20, 1.4 + rnd() * 2, 0.5 + rnd() / 2);
      } else {
        // Turn up and rise to the surface, drifting away from the tower.
        const u = cl((d.t - 0.5) / 1.1, 0, 1);
        d.hy = d.yD + (WL + 0.8 - d.yD) * sm(u); d.hx += st * 5;
        q[0] = PI - 0.75 * PI * sm(u * 1.5) + 0.25 * PI * sm((u - 0.7) / 0.3);
        q[5] = q[6] = 0.3 + 2 * sm(u);
        if (u >= 1) {
          d.st = SWIM; d.t = 0;
        }
      }
    } else if (d.st === SWIM) {
      // Front crawl to the far side, the arms wheeling over the surface.
      d.t += st; d.hx += st * 10;
      d.hy = surf(d.hx) + 0.8;
      const kick = 0.25 * sin(d.t * 12);
      q.splice(0, 8, PI / 2, kick, 0.15, -kick, 0.15, d.t * 5.5, d.t * 5.5 + PI, 0);
      const fx = cl(round(d.hx - 6), POOL_X, W - 1);
      S.hv[fx] += st * 22;
      if (rnd() < st * 4.5) S.drops.push({ x: fx, y: WL - 1, vx: (rnd() - 0.5) * 6, vy: -8 - rnd() * 10 });
    }
  }
  S.divers = S.divers.filter((d) => d.st !== SWIM || d.hx < 74);

  // The platform lamp is up while someone is out on the 10 m platform.
  S.spot += (+S.divers.some(onPlat) - S.spot) * min(1, st * 2.2);
  const b = S.board;
  if (b.reveal > 0 && (b.reveal -= st) <= 0) score(S);

  // The surface: a damped string of water heights, kicked by the sparger
  // under the landing area and by every entry.
  const { h, hv } = S;
  const kicks = round(st * 70 + rnd() * 0.5);
  for (let j = 0; j < kicks; j++) hv[22 + floor(rnd() * 26)] += (rnd() - 0.5) * 9;
  for (let s = 0; s < 3; s++) {
    const q = st / 3;
    for (let x = POOL_X; x < W; x++) {
      const l = x > POOL_X ? h[x - 1] : h[x];
      const r = x < W - 1 ? h[x + 1] : h[x];
      hv[x] += (160 * (l + r - 2 * h[x]) - 22 * h[x] - 1.6 * hv[x]) * q;
    }
    for (let x = POOL_X; x < W; x++) h[x] = cl(h[x] + hv[x] * q, -3, 3);
  }
  let e = 0;
  for (let x = POOL_X; x < W; x++) e += h[x] * h[x];
  const target = min(1.3, sqrt(e / 40));
  S.surge += (target - S.surge) * min(1, st * (target > S.surge ? 6 : 0.9));

  // Sparger bubbles from the floor, and the entry bubbles rising.
  const ns = st * 38 + rnd();
  for (let j = 1; j < ns; j++) bub(S, 22 + rnd() * 26, FLOOR - 1, 26 + rnd() * 16, 3, 0.28 + 0.2 * rnd());
  for (const u of S.bubs) {
    u.y -= u.vy * st; u.vy = min(u.vy + st * 6, 40); u.x += sin(u.y * 0.5 + u.b * 20) * 0.25;
    u.life -= st;
  }
  S.bubs = S.bubs.filter((u) => u.life > 0 && u.y > surf(u.x) + 0.5);
  for (const p of S.drops) {
    p.vy += G * st; p.x += p.vx * st; p.y += p.vy * st;
  }
  S.drops = S.drops.filter((p) => p.vy < 0 || p.y < surf(p.x));
}

// One figure, its hip at (hx, hy). q[0] turns it forward as it somersaults:
// 0 stands upright facing `face`.
const PART = new Float32Array(80);
function figure(S, hx, hy, face, q, suit, lf, pc) {
  const { C, sy } = S;
  const ct = cos(q[7]);
  const ux = sin(q[0]) * face;
  const uy = -cos(q[0]);
  const fx = cos(q[0]) * face * ct;
  const fy = sin(q[0]) * ct;
  const nx = hx + ux * 3.8;
  const ny = hy + uy * 3.8;
  let n = 0;
  const part = (ax, ay, bx, by, r, c) => {
    PART.set([ax, ay, bx, by, r, c], n);
    n += 6;
  };
  const limb = (x, y, a, l) => [x + l * (ux * cos(a) + fx * sin(a)), y + l * (uy * cos(a) + fy * sin(a))];
  // The far leg and arm go down first, dimmer, so the near ones cover them.
  for (let side = 0; side < 2; side++) {
    const a1 = PI - q[1 + side * 2];
    const [kx, ky] = limb(hx, hy, a1, 2.7);
    const [ax, ay] = limb(kx, ky, a1 + q[2 + side * 2], 2.7);
    const [wx, wy] = limb(nx, ny, q[5 + side], 3.4);
    const c = side ? 0 : 2;
    if (side) {
      part(hx, hy, nx, ny, 0.95, 1);
      part(hx + ux * 5.1, hy + uy * 5.1, hx + ux * 5.1, hy + uy * 5.1, 1.15, 0);
    }
    part(hx, hy, kx, ky, 0.75, c);
    part(kx, ky, ax, ay, 0.6, c);
    part(nx, ny, wx, wy, 0.5, c);
  }
  // Nothing reaches further than 8 LEDs from the hip.
  for (let y = max(0, floor(hy - 9)); y <= min(H - 1, hy + 9); y++)
    for (let x = max(0, floor(hx - 9)); x <= min(W - 1, hx + 9); x++) {
      const i = (y * W + x) * 3;
      const px = x + 0.5;
      const py = y + 0.5;
      // Seen through the water a body is tinted and softer.
      const wet = x >= POOL_X && y > sy[x];
      for (let j = 0; j < n; j += 6) {
        const ax = PART[j];
        const ay = PART[j + 1];
        const dx = PART[j + 2] - ax;
        const dy = PART[j + 3] - ay;
        const tt = cl(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy + 1e-6), 0, 1);
        const a = cl(PART[j + 4] + 0.5 - sqrt((px - ax - dx * tt) ** 2 + (py - ay - dy * tt) ** 2), 0, 1);
        if (a <= 0) continue;
        const src = PART[j + 5] === 1 ? suit : SKIN;
        const m = lf * (PART[j + 5] === 2 ? 0.62 : 1);
        for (let c = 0; c < 3; c++) {
          const v = wet ? src[c] * m * 0.45 + pc[c] * 70 : src[c] * m;
          C[i + c] += (v - C[i + c]) * a;
        }
      }
    }
}

const put = (S, i, col) => S.C.set(col, i * 3);
function text(S, s, x, y, col) {
  for (const ch of s) {
    for (let j = 0; j < 15; j++) if ((FONT[ch] >> (14 - j)) & 1) put(S, (y + floor(j / 3)) * W + x + (j % 3), col);
    x += ch === "." ? 2 : 4;
  }
}
const width = (s) => s.length * 4 - 1 - (s.includes(".") ? 2 : 0);
// Lamp light, warm white.
const WARM = [1, 0.93, 0.8];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { C, alb, lt, lh, rf, em, cone, wb, wl, h, sy, sh, spot } = S;
  const pc = hsv(S.hue, 0.78, 1);
  const k4 = S.lights;
  const t = S.t;
  const amb = 0.06 + 0.2 * k4;
  const wT = 0.55 + 0.45 * k4 + 0.25 * spot;
  const wH = 0.1 + 0.9 * k4;
  // Stirred water throws brighter light on the walls and stronger shafts below.
  const A = (0.3 + 1.7 * S.surge) * 0.9 * 255;
  const sw = 0.25 + 0.5 * S.surge;
  for (let x = 0; x < W; x++) {
    sy[x] = x >= POOL_X ? round(WL + h[x]) : 999;
    const c = x > POOL_X && x < W - 1 ? h[x - 1] + h[x + 1] - 2 * h[x] : 0;
    sh[x] = sin(x * 0.5 + t * 1.1 + 2 * h[x]) * sin(x * 0.19 - t * 0.7) - 2.5 * c;
  }
  const foamA = max(0, 1 - (t - S.foam) / 0.8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const j = i * 3;
      if (y < sy[x]) {
        // The hall, lit by the lamps and by the pool's rippling light.
        const light = (amb + wT * lt[i] + wH * lh[i]) * 153 + spot * cone[i] * 120;
        let cs = 0;
        if (rf[i] > 0.02) {
          const xc = cl((x + (WL - y) * 0.3) | 0, POOL_X, W - 1);
          let q1 = 1 - abs(sin(x * 0.62 + 1.7 * sin(y * 0.29 + t * 0.8) + t * 0.9 + 1.8 * h[xc]));
          let q2 = 1 - abs(sin(y * 0.5 - x * 0.2 + 1.5 * sin(x * 0.33 - t * 1.05) - t * 0.65));
          q1 *= q1;
          q2 *= q2;
          cs = (q1 * q1 * q1 + q2 * q2 * q2) * rf[i] * A;
        }
        const hz = spot * cone[i] * (40 + 30 * (1 - k4));
        for (let c = 0; c < 3; c++) C[j + c] = alb[j + c] * (light * WARM[c] + pc[c] * cs) + em[j + c] + hz * WARM[c];
      } else if (y === sy[x]) {
        // The surface line, glinting where it tilts and where the sparger froths.
        let gl = 0.55 + 0.45 * k4 + min(1, abs((x < W - 1 ? h[x + 1] : h[x]) - h[x - 1]) * 1.2);
        if (x >= 22 && x < 48 && hash(x, floor(t * 9)) < 0.18) gl += 0.6;
        gl += 1.5 * foamA * max(0, 1 - abs(x - S.foamX) / 4);
        for (let c = 0; c < 3; c++) C[j + c] = (pc[c] * 0.5 + 0.5) * 122 * gl;
      } else {
        const d = y - WL;
        let v = wb[i] * 255;
        if (d < 34 && y < FLOOR) v *= 1 + sw * sh[cl(round(x - d * 0.45), 0, W - 1)] * exp(-d / 20);
        const top = k4 * 30 * exp(-max(0, d) / 10);
        for (let c = 0; c < 3; c++) C[j + c] = pc[c] * v + wl[i] * 255 * (0.5 + 0.5 * pc[c]) + top;
      }
    }

  // Bubbles catch the underwater light.
  for (const u of S.bubs) {
    const x = round(u.x);
    const y = round(u.y);
    if (x < POOL_X || x >= W || y <= sy[x] || y >= H) continue;
    const v = u.b * min(1, u.life * 1.5) * 170;
    for (let c = 0; c < 3; c++) C[(y * W + x) * 3 + c] += v * (0.55 + 0.45 * pc[c]);
  }

  // The lamps along the ceiling: the two over the tower are on at night.
  for (const [lx, w] of [[6, wT], [22, wT], [40, wH], [56, wH]])
    for (let y = 0; y < 5; y++)
      for (let x = lx - 4; x <= lx + 4; x++) {
        const core = abs(x - lx) <= 1 && y >= 1 && y <= 2;
        if (!core && x >= 33 && y >= 3) continue;
        const v = core ? 120 + 135 * min(1, w) : 90 * min(1, w) * exp(-((x - lx) ** 2 + (y - 1.5) ** 2) / 3);
        for (let c = 0; c < 3; c++) C[(y * W + x) * 3 + c] = max(C[(y * W + x) * 3 + c], v * WARM[c]);
      }

  // The scoreboard shows the dive and its difficulty, then the seven judges' marks.
  const bd = S.board;
  const [code, dd] = bd.sc ? [bd.code, bd.dd] : DIVES[S.dive];
  const amber = [255, 170, 40];
  const white = [235, 235, 225];
  text(S, String(bd.num), 35, 6, amber);
  text(S, code, 62 - width(code), 6, white);
  for (let j = 0; j < 15; j++) put(S, (13 + floor(j / 3)) * W + 35 + (j % 3), bd.suit);
  text(S, "10M", 40, 13, [150, 150, 150]);
  const dds = `${floor(dd / 10)}.${dd % 10}`;
  text(S, dds, 62 - width(dds), 13, amber);
  if (bd.sc) {
    for (let j = 0; j < 7; j++) text(S, String(bd.sc[j]), 35 + j * 4, 20, bd.drop.includes(j) ? [80, 80, 80] : amber);
    text(S, bd.total, 62 - width(bd.total), 27, white);
  }

  const lf = 0.62 + 0.38 * k4;
  for (const d of S.divers) {
    const lit = d.st === WALK || d.st === STAND || (d.st === FLY && d.t < 0.4);
    figure(S, d.hx, d.hy, d.face, d.q, d.suit, min(1.1, lf + (lit ? 0.35 * spot : 0)), pc);
  }

  // Spray above the water.
  for (const p of S.drops) {
    const x = round(p.x);
    const y = round(p.y);
    if (x >= 0 && x < W && y >= 0 && y < H) for (let c = 0; c < 3; c++) C[(y * W + x) * 3 + c] = max(C[(y * W + x) * 3 + c], 210 + 40 * pc[c]);
  }

  for (let i = 0; i < N; i++) display.setPixel(i % W, (i / W) | 0, min(255, C[i * 3]), min(255, C[i * 3 + 1]), min(255, C[i * 3 + 2]));
}
