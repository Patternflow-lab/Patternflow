// ===== Patternflow pattern =====
// Title:   Siteswap
// Family:  rhythm
// Idea:    Glowing balls fly between two hands at the foot of the panel, each throw staying up as many beats as its siteswap number says, so in 531 the 5 reaches the top while the 1 zips straight across, and the juggler works through a list of patterns with the throws between two of them found in the state diagram.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: siteswap juggling notation (Paul Klimek, 1981; Bruce Tiemann and Bengt Magnusson, 1985), pattern round 41
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Balls=3..7, Tail=0..1
//
// Knob 1: Hue. Turns every ball round the wheel together. The balls sit 0.618 of a turn apart, so at 0 three balls are azure, yellow and violet, a fourth is green and a fifth red. A ball that comes round to orange is paled and its tail kept at full brightness, so it never reads brown.
// Knob 2: Speed. At 2 the highest throw of the pattern stays up 1.8 seconds and the beat follows from it: 0.4 s in 51, 0.21 s in 97531, and never longer than 0.62 s, so a plain 3 stays up 1.55 s. At 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Balls, 3 to 7, each count with its own list of 7 to 10 patterns (for 3: 51, 531, 3, 441, 6316131 and on). Turning it brings a new ball out of a hand that has a free beat or lets one fall off the bottom of the panel, and the throws in between come from the state diagram. Each pattern runs 7 seconds at Speed 2 and then to the end of its cycle.
// Knob 4: Tail. Each ball trails a comet tail as wide as the ball that tapers to nothing. At Speed 2 it holds the last 0.72 s of flight at 0, 0.78 s at the opening 0.06 and 1.8 s at 1, the whole flight of the highest throw, so every ball paints its full arch.
// Buttons: K1 tap moves on to the next pattern at the next beat.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, round, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Hands: the ball centre's row at the hands, the inner point each hand
// throws from and the outer point it catches at. Hand 0 is the left.
const YH = 114, YTOP = 9, HMAX = YH - YTOP, DIP = 5;
const THROW_X = [26, 38], CATCH_X = [7, 57];
// Dwell: the share of a beat a ball spends in the hand before it is thrown
// again. A 1 is in the air 1 - DWELL beats, a 9 is in the air 8.5.
const DWELL = 0.5;
// The highest throw of a pattern takes T_HI seconds at Speed 2, and a beat
// is never shorter than B_MIN or longer than B_MAX seconds.
const T_HI = 1.8, B_MIN = 0.2, B_MAX = 0.62;
// Each pattern runs at least this many seconds (at Speed 2), then the next.
const RUN = 7;
const MAXT = 9;
const R_BALL = 4, R_GLOW = 7, R_TAIL = 3.7;
const HUE0 = 0.55, GOLD = 0.618034;

// Patterns by ball count. Every one is checked in setup: a sequence is
// jugglable exactly when i + s_i mod n hits every i once, and then its
// average is the number of balls. The first of each list opens.
const LISTS = {
  3: ["51", "531", "3", "441", "6316131", "423", "711", "52512", "4413", "72312"],
  4: ["4", "534", "7531", "5551", "633", "741", "552", "6451", "53", "7441"],
  5: ["5", "744", "97531", "645", "75751", "663", "771", "753", "726"],
  6: ["6", "75", "864", "756", "9555", "774", "8448", "855"],
  7: ["7", "966", "86", "975", "95", "9559", "8677"],
};

function jugglable(seq) {
  const n = seq.length, hit = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const j = (i + seq[i]) % n;
    if (hit[j]) return false;
    hit[j] = true;
  }
  return true;
}

// The state at phase j: bit k is set when a ball thrown earlier lands k
// beats from now, bit 0 being the ball in the hand that throws now.
function stateAt(seq, j) {
  const n = seq.length;
  let st = 0;
  for (let m = 1; m <= MAXT; m++) {
    const k = seq[(((j - m) % n) + n) % n] - m;
    if (k >= 0) st |= 1 << k;
  }
  return st;
}

const pop = (st) => {
  let c = 0;
  for (; st; st &= st - 1) c++;
  return c;
};

function buildLists() {
  const out = {};
  for (const [count, list] of Object.entries(LISTS)) {
    out[count] = [];
    for (const text of list) {
      const seq = [...text].map(Number), sum = seq.reduce((a, b) => a + b, 0);
      if (!jugglable(seq) || sum !== +count * seq.length) continue;
      out[count].push({ text, seq, top: max(...seq), states: seq.map((_, j) => stateAt(seq, j)) });
    }
  }
  return out;
}

// Shortest run of throws from state st to any state of pattern P, throws no
// higher than the lowest cap that finds one. Where the ball count differs a
// throw may be a new ball from an empty hand (add) or a ball let fall (drop).
function bridge(st, P, cap0) {
  const want = pop(P.states[0]);
  for (let cap = cap0; cap <= MAXT; cap++) {
    const prev = new Map([[st, null]]);
    let front = [st];
    while (front.length) {
      const next = [];
      for (const s of front) {
        const j = P.states.indexOf(s);
        if (j >= 0) {
          const path = [];
          for (let c = s; prev.get(c); c = prev.get(c).from) path.unshift(prev.get(c).move);
          return { path, phase: j };
        }
        const here = s & 1, rest = s >> 1, c = pop(s);
        const moves = [];
        if (here && c > want) moves.push({ v: 0, drop: true, to: rest });
        if (!here) moves.push({ v: 0, to: rest });
        if (here || c < want)
          for (let v = 1; v <= cap; v++) if (!(rest & (1 << (v - 1)))) moves.push({ v, add: !here, to: rest | (1 << (v - 1)) });
        for (const m of moves)
          if (!prev.has(m.to)) {
            prev.set(m.to, { from: s, move: m });
            next.push(m.to);
          }
      }
      front = next;
    }
  }
  return null;
}

export function setup(params) {
  const lists = buildLists();
  params.s = {
    lists, count: 3, pat: lists[3][0], idx: 0, phase: 0, st: 0, trans: [],
    beat: 0, next: 0, run: 0, want: false, begun: false,
    air: 1, bLen: 1, balls: [],
    hue: 0, speed: 2, tail: 0.06,
    zA: new Float32Array(N), zC: new Float32Array(N), zB: new Int8Array(N),
    rgb: new Float32Array(N * 3),
  };
}

const beatLen = (air) => cl(T_HI / air, B_MIN, B_MAX);

function newBall(S, t) {
  let id = 0;
  while (S.balls.some((b) => b.id === id)) id++;
  const b = { id, segs: [], land: 0, born: t, gone: false };
  S.balls.push(b);
  return b;
}

// A throw from hand (t & 1) at beat t: up along a parabola to the far hand's
// catching point, then a scoop in that hand back to its throwing point. A
// throw of v climbs HMAX ((v - DWELL) / air)^2 rows, air being the beats the
// pattern's highest throw stays up, so in 531 the 5 climbs 105 rows, the 3
// climbs 32 and the 1 barely leaves the hands.
function launch(S, b, t, v) {
  const h = t & 1, h2 = (t + v) & 1, t1 = t + v - DWELL;
  const a = (v - DWELL) / S.air, A = HMAX * min(1, a * a);
  b.segs.push({ k: 0, t0: t, t1, x0: THROW_X[h], x1: CATCH_X[h2], A });
  b.segs.push({ k: 1, t0: t1, t1: t + v, x0: CATCH_X[h2], x1: THROW_X[h2] });
  b.land = t + v;
}

// The pattern already running at beat 0: every throw of the last MAXT beats
// that is still to land, in flight.
function start(S, P) {
  S.pat = P;
  S.air = P.top - DWELL;
  S.bLen = beatLen(S.air);
  S.st = P.states[0];
  S.phase = 0;
  const n = P.seq.length;
  for (let m = MAXT; m >= 1; m--) {
    const v = P.seq[(((-m) % n) + n) % n];
    if (v - m >= 0 && v > 0) launch(S, newBall(S, -m - 1), -m, v);
  }
  S.beat = -0.001;
  S.next = 0;
}

// The next pattern: the next in the list, or the first when the ball count
// is changing, reached by the shortest bridge from where the juggle stands.
function plan(S) {
  const list = S.lists[S.count];
  if (S.count !== pop(S.st)) S.idx = 0;
  else S.idx = (S.idx + 1) % list.length;
  const P = list[S.idx];
  const cap = max(P.top, S.pat.top);
  const r = bridge(S.st, P, min(MAXT, cap));
  if (!r) return;
  S.trans = r.path;
  S.pat = P;
  S.phase = r.phase;
  S.run = 0;
}

// Beat t: hand t & 1 throws the ball that lands now with the next value of
// the bridge, or of the pattern once the bridge is done. A 0 leaves the hand
// empty, a drop lets its ball fall off the panel, and a throw from an empty
// hand is a new ball.
function onBeat(S, t) {
  const sw = S.want || (S.count !== pop(S.st) && !S.trans.length) || (S.run >= RUN && S.phase === 0 && !S.trans.length);
  if (sw) {
    S.want = false;
    plan(S);
  }
  let move;
  if (S.trans.length) move = S.trans.shift();
  else {
    const v = S.pat.seq[S.phase];
    S.phase = (S.phase + 1) % S.pat.seq.length;
    move = { v };
  }
  const here = S.st & 1, rest = S.st >> 1;
  const b = S.balls.find((x) => !x.gone && x.land === t);
  if (move.drop) {
    if (b) {
      b.gone = true;
      b.segs.push({ k: 2, t0: t, x0: THROW_X[t & 1], dir: t & 1 ? 1 : -1 });
    }
    S.st = rest;
  } else if (move.v === 0) S.st = rest;
  else {
    const ball = here && b ? b : newBall(S, t);
    launch(S, ball, t, move.v);
    S.st = rest | (1 << (move.v - 1));
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.count = cl(round(k[2]), 3, 7);
  S.tail = cl(k[3], 0, 1);
  // The first frame opens on the first pattern for the knob's ball count.
  if (!S.begun) {
    start(S, S.lists[S.count][0]);
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0]) S.want = true;
  const pd = d * S.speed * 0.5;
  // Scale and tempo ease toward the pattern being juggled.
  const e = 1 - Math.exp(-pd / 0.5);
  S.air += (S.pat.top - DWELL - S.air) * e;
  S.bLen += (beatLen(S.pat.top - DWELL) - S.bLen) * e;
  S.run += pd;
  S.beat += pd / S.bLen;
  while (S.beat >= S.next) onBeat(S, S.next++);
  // Forget what the longest tail no longer reaches.
  const keep = S.beat - T_HI / S.bLen - 2;
  for (const b of S.balls) while (b.segs.length > 2 && (b.segs[0].t1 ?? 1e9) < keep) b.segs.shift();
  S.balls = S.balls.filter((b) => !(b.gone && S.beat - b.segs[b.segs.length - 1].t0 > 4));
}

// Where ball b is at beat t, or false before its first segment.
function posAt(b, t, out) {
  for (let i = b.segs.length - 1; i >= 0; i--) {
    const s = b.segs[i];
    if (t < s.t0) continue;
    if (s.k === 2) {
      const u = t - s.t0;
      out[0] = s.x0 + s.dir * 10 * u;
      out[1] = YH + 70 * u * u;
      return true;
    }
    const u = cl((t - s.t0) / (s.t1 - s.t0), 0, 1);
    if (s.k === 0) {
      out[0] = s.x0 + (s.x1 - s.x0) * u;
      out[1] = YH - 4 * s.A * u * (1 - u);
    } else {
      const w = u * u * (3 - 2 * u);
      out[0] = s.x0 + (s.x1 - s.x0) * w;
      out[1] = YH + DIP * sin(PI * u);
    }
    return true;
  }
  return false;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { zA, zC, zB, rgb, balls } = S;
  zA.fill(1e9);
  zC.fill(0);
  rgb.fill(0);
  // Tail length in beats.
  const L = (T_HI * (0.4 + 0.6 * S.tail)) / S.bLen;
  const p = [0, 0], q = [0, 0];
  for (let bi = 0; bi < balls.length; bi++) {
    const b = balls[bi];
    const steps = max(8, Math.ceil(L * 40));
    let have = posAt(b, S.beat, q);
    for (let s = 1; s <= steps && have; s++) {
      const a0 = ((s - 1) / steps) * L, a1 = (s / steps) * L;
      p[0] = q[0];
      p[1] = q[1];
      have = posAt(b, S.beat - a1, q) && S.beat - a1 >= b.born;
      if (!have) break;
      // A capsule from p to q, its radius tapering with age.
      const r = R_TAIL * (1 - a0 / L) ** 0.5;
      if (r < 0.3) break;
      const x0 = max(0, floor(min(p[0], q[0]) - r - 1)), x1 = min(W - 1, floor(max(p[0], q[0]) + r + 1));
      const y0 = max(0, floor(min(p[1], q[1]) - r - 1)), y1 = min(H - 1, floor(max(p[1], q[1]) + r + 1));
      const dx = q[0] - p[0], dy = q[1] - p[1], ll = dx * dx + dy * dy || 1e-9;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5 - p[0], py = y + 0.5 - p[1], u = cl((px * dx + py * dy) / ll, 0, 1);
          const ex = px - u * dx, ey = py - u * dy, dd = sqrt(ex * ex + ey * ey);
          const c = cl(r - dd + 0.5, 0, 1);
          if (c <= 0) continue;
          const o = y * W + x, age = a0 + u * (a1 - a0);
          if (age < zA[o] - 0.02 || (zB[o] === bi && c > zC[o])) {
            zA[o] = age;
            zB[o] = bi;
            zC[o] = c;
          }
        }
    }
  }
  const col = [0, 0, 0];
  const cols = balls.map((b) => {
    const h = S.hue + HUE0 + b.id * GOLD, hh = h - floor(h);
    const warm = max(0, 1 - abs(hh - 0.11) / 0.1);
    hsv(h, 0.85 - 0.25 * warm, 1, col);
    return [col[0], col[1], col[2], warm];
  });
  for (let o = 0; o < N; o++) {
    const c = zC[o];
    if (c <= 0) continue;
    const bc = cols[zB[o]], age = zA[o] / L, lv = (1 - 0.45 * age) * (1 - 0.6 * bc[3]) + bc[3];
    rgb[o * 3] = bc[0] * lv * c;
    rgb[o * 3 + 1] = bc[1] * lv * c;
    rgb[o * 3 + 2] = bc[2] * lv * c;
  }
  // The balls: a glow, a full disc and a pale core.
  for (let bi = 0; bi < balls.length; bi++) {
    const b = balls[bi];
    if (!posAt(b, S.beat, q)) continue;
    const grow = cl((S.beat - b.born) / 0.4, 0, 1), c = cols[bi];
    const R = R_BALL * grow, G = R_GLOW * grow;
    for (let y = max(0, floor(q[1] - G)); y <= min(H - 1, floor(q[1] + G)); y++)
      for (let x = max(0, floor(q[0] - G)); x <= min(W - 1, floor(q[0] + G)); x++) {
        const dd = sqrt((x + 0.5 - q[0]) ** 2 + (y + 0.5 - q[1]) ** 2);
        if (dd > G) continue;
        const o = (y * W + x) * 3, halo = 0.55 * (1 - dd / G) ** 1.4, disc = cl(R - dd + 0.5, 0, 1), core = cl(1 - dd / (R * 0.8), 0, 1) * 0.6;
        for (let ch = 0; ch < 3; ch++) {
          let v = 1 - (1 - rgb[o + ch]) * (1 - c[ch] * halo);
          v += (c[ch] - v) * disc;
          v += (1 - v) * core * disc;
          rgb[o + ch] = v;
        }
      }
  }
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, round(255 * min(1, rgb[o * 3])), round(255 * min(1, rgb[o * 3 + 1])), round(255 * min(1, rgb[o * 3 + 2])));
}
