// ===== Patternflow pattern =====
// Title:   Behrend Sets
// Family:  number
// Idea:    The integers 0 to 8191 lie in rows of 64 and a scan runs down them, lighting the members of a set that has no three terms in arithmetic progression and counting the progressions it meets, which stays at 0 for the numbers whose digits in one base are all 0 or 1 and for one of Behrend's spheres of digit vectors, while a random set of 384 numbers climbs past 1500 and shows its progressions as lines.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Behrend's construction of a large set with no three terms in arithmetic progression, from the integer points of one sphere (Felix Behrend, 1946), the Salem-Spencer sets it improved on (Raphaël Salem and Donald Spencer, 1942), the numbers with ternary digits 0 and 1 as the greedy set (Paul Erdős and Pál Turán, 1936), 3 x 5 digits from lill-method.js, pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Set=0..2, Base=3..13
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a number is coloured by the sum of the squares of its digits, from pale cyan for the smallest to pink for the largest, a progression is a salmon line with a white dot on each of its three numbers, the number half way in a try is a blue cross round a dark LED, and the scan leaves a faint blue tint behind it. At 0.5 the numbers run from salmon to green and the progression lines are cyan.
// Knob 2: Speed. How fast the scan runs down the numbers. A pass over all 8192 takes 8 / Speed seconds, 4.0 s at 2, 40 s at 0.2 and 2.7 s at 3, and the finished picture stays 1.2 s before the next pass. A set number is half bright until the scan reaches it, then goes to full and flashes white, settling in about 0.3 s. A try or a progression goes up as a line at most every 0.14 s and fades in 1.1 s, so at 3 a pass shows at most 19 of them.
// Knob 3: Set. Snaps to one of three sets, which the same scan counts. 0 is dust, the numbers whose digits in base b are all 0 or 1, 384 of them at b = 3. 1 is a sphere: the numbers whose digits are at most (b - 1) / 2, so that two add without a carry, and whose squares add to one value r; one of the five fullest of these shells goes up in turn, a new one each pass, from 90 numbers down to 60 at b = 5. 2 is 384 numbers drawn at random, afresh each pass. Of the 16,773,120 triples a, a + d, a + 2d in 0 to 8191, none lies in the dust or in any shell at a base from 3 to 13, while the random set holds 1584 in its first draw and 1716 on average over twenty. The readout at the foot gives the size of the set on the left and, after three dots in a row, the progressions met so far. In dust and sphere the scan tries an earlier member against the one it has reached, and the number half way is always dark; in the random set it draws the progressions that are there.
// Knob 4: Base. The base b the numbers are written in, 3 to 13, snapping to whole numbers. The faint cells are every number whose digits are all at most (b - 1) / 2, the lattice a sphere is cut from: 384 at b = 3, 729 at 5, 960 at 7 and 1372 at 13. The dust is the 0 and 1 numbers inside it, 384 at 3 and 128 at 4, 64 at 5, 32 for 7 to 9 and 16 for 10 to 13. The fullest sphere holds 105 numbers at 3, 90 at 5 and 70 at 7, small beside the ternary dust: counting the best sphere over bases to 120 against the ternary set, Behrend's sets pass it only between 10^14 and 10^15 numbers. At 4 the dust is a grid of 8 columns by 16 rows, because 64 is 4 cubed.
// Buttons: K1 tap ends the pass where it is and starts the next from the top: the next shell of a sphere, a fresh draw of the random set.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The numbers in base b: the sum of the squares of the digits, and whether every digit
// is at most (b - 1) / 2 rounded down, which is the condition for two numbers to add
// without a carry in any place. dust is the numbers whose digits are all 0 or 1, and
// shells the numbers that pass the carry test grouped by sum of squares, fullest first.
function digitsOf(b) {
  const D = floor((b - 1) / 2), r = new Int16Array(NP), ok = new Uint8Array(NP), dust = [];
  let rmax = 0;
  for (let n = 0; n < NP; n++) {
    let m = n, s = 0, g = 1, hi = 0;
    while (m > 0) {
      const d = m % b;
      m = (m - d) / b;
      s += d * d;
      if (d > D) g = 0;
      if (d > hi) hi = d;
    }
    r[n] = s; ok[n] = g;
    if (g && s > rmax) rmax = s;
    if (hi <= 1) dust.push(n);
  }
  const by = new Map();
  for (let n = 0; n < NP; n++) if (ok[n]) { if (!by.has(r[n])) by.set(r[n], []); by.get(r[n]).push(n); }
  const shells = [...by.entries()].map(([s, list]) => ({ r: s, list })).sort((p, q) => q.list.length - p.list.length || p.r - q.r);
  return { b, D, r, ok, rmax, dust, shells };
}

// Every three-term progression a, m, n = 2m - a of the set, found from the pairs a < m.
// cnt[n] is how many end at n. Of those that lie on a straight line of the grid (a, m, n
// equally spaced in x as well, which a wrap to the next row can spoil) the shortest and the
// longest are kept to draw, as keep[4n .. 4n + 3] = a, m of the shortest, a, m of the longest.
function progressions(list, has) {
  const cnt = new Uint16Array(NP), keep = new Int32Array(NP * 4).fill(-1);
  for (let j = 1; j < list.length; j++) {
    const m = list[j];
    for (let i = j - 1; i >= 0; i--) {
      const a = list[i], n = 2 * m - a;
      if (n >= NP) break;
      if (!has[n]) continue;
      cnt[n]++;
      if ((a & 63) + (n & 63) !== 2 * (m & 63)) continue;
      const o = n * 4;
      keep[o] = a; keep[o + 1] = m;
      if (keep[o + 2] < 0) { keep[o + 2] = a; keep[o + 3] = m; }
    }
  }
  const tot = new Int32Array(NP + 1);
  for (let n = 0; n < NP; n++) tot[n + 1] = tot[n] + cnt[n];
  return { cnt, keep, tot };
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The random set is as large as the ternary one, the largest set the panel holds.
const NR = 384;

export function setup(params) {
  params.s = {
    R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP),
    bases: {}, cf: 0, hold: 0, pass: 0, key: "", hue: 0, speed: 2, mode: 0, b: 3,
    has: new Uint8Array(NP), list: [], ap: null, cur: null, flash: new Float32Array(NP),
    ev: [], c: 0, size: 0, found: 0, cool: 0, alt: 0, idx: new Int32Array(NP), rg: rng(1),
  };
}

function baseInfo(S, b) {
  if (!S.bases[b]) S.bases[b] = digitsOf(b);
  return S.bases[b];
}

// The set for the knobs.
function build(S) {
  const info = baseInfo(S, S.b);
  S.has.fill(0);
  let list;
  if (S.mode === 0) list = info.dust;
  else if (S.mode === 1) {
    const sh = info.shells, top = min(4, sh.length - 1);
    list = sh[S.pass % (top + 1)].list;
  } else {
    const g = rng(S.pass * 7919 + 12345), pool = new Int32Array(NP), pick = [];
    for (let i = 0; i < NP; i++) pool[i] = i;
    for (let i = 0; i < NR; i++) {
      const k = i + floor(g() * (NP - i)), t = pool[i];
      pool[i] = pool[k]; pool[k] = t;
      pick.push(pool[i]);
    }
    list = pick.sort((p, q) => p - q);
  }
  S.cur = info;
  S.list = list;
  for (const n of list) S.has[n] = 1;
  S.ap = progressions(list, S.has);
  S.size = list.length;
  for (let i = 0; i < list.length; i++) S.idx[list[i]] = i;
  S.rg = rng(S.pass * 131 + S.mode * 17 + S.b);
  S.ev.length = 0;
}

const LIFE = 1.1;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const mode = cl(Math.round(k[2]), 0, 2), b = cl(Math.round(k[3]), 3, 13);
  const key = mode + ":" + b;
  if (key !== S.key) {
    S.key = key; S.mode = mode; S.b = b; S.pass = 0;
    build(S);
  }
  // A tap on the first knob ends the pass where it is.
  if (input.btnPressed && input.btnPressed[0] && S.cf < NP) { S.cf = NP; S.hold = 1.2; }
  // The scan: a pass takes 8 / Speed seconds, and the finished picture stays 1.2 s.
  if (S.cf < NP) S.cf += (d * NP * S.speed) / 8;
  else if ((S.hold += d) >= 1.2) {
    S.pass++; build(S);
    S.cf = 0; S.c = 0; S.hold = 0; S.found = 0;
    S.flash.fill(0);
  }
  const c1 = min(NP, floor(S.cf));
  const fd = exp(-d / 0.3), { keep, tot } = S.ap;
  for (let i = 0; i < NP; i++) S.flash[i] *= fd;
  S.cool -= d;
  for (let n = S.c; n < c1; n++) {
    if (!S.has[n]) continue;
    S.flash[n] = 1;
    if (S.cool > 0) continue;
    if (S.mode === 2) {
      // A progression that is there goes up as a line, the closest and the farthest of a member in turn.
      if (keep[n * 4] < 0) continue;
      const o = n * 4 + ((S.alt++ & 1) << 1);
      S.ev.push({ a: keep[o], m: keep[o + 1], n, age: 0, hit: 1 });
      S.cool = 0.14;
    } else {
      // A set with none is tried instead: an earlier member and this one, and the number half way between, which is never in the set.
      const i = S.idx[n];
      for (let t = 0; i > 0 && t < 6; t++) {
        const a = S.list[floor(S.rg() * i)], m = (a + n) >> 1;
        if (((a + n) & 1) || (a & 63) + (n & 63) !== 2 * (m & 63)) continue;
        S.ev.push({ a, m, n, age: 0, hit: 0 });
        S.cool = 0.14;
        break;
      }
    }
  }
  S.c = c1;
  S.found = tot[c1];
  for (const e of S.ev) e.age += d;
  while (S.ev.length && S.ev[0].age > LIFE) S.ev.shift();
}

// 3 x 5 digits, from lill-method.js.
const DIGITS = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# ### ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((s) => {
  const rows = s.split(" "), m = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === "#") m.push(x, y);
  return m;
});

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, has, flash } = S;
  R.fill(0); G.fill(0); B.fill(0);
  const tmp = [0, 0, 0], h0 = S.hue + 0.5, c = S.c;
  const cube = baseInfo(S, S.b);
  const rm = max(1, cube.rmax), wash = [0, 0, 0];
  hsv(h0 + 0.1, 0.75, 0.09, wash);
  const glow = [];
  for (let n = 0; n < NP; n++) {
    const tested = n < c;
    let r = 0, g = 0, b = 0;
    if (tested) { r = wash[0]; g = wash[1]; b = wash[2]; }
    if (cube.ok[n]) {
      hsv(h0 + 0.45 * (cube.r[n] / rm), 0.4, 0.24, tmp);
      r = tmp[0]; g = tmp[1]; b = tmp[2];
    }
    if (has[n]) {
      const v = tested ? 1 : 0.5, w = flash[n];
      if (S.mode === 2) hsv(h0 + 0.08, 0.2 * (1 - w), v, tmp);
      else hsv(h0 + 0.45 * (cube.r[n] / rm), 0.5 * (1 - w), v, tmp);
      r = tmp[0]; g = tmp[1]; b = tmp[2];
      if (S.mode) glow.push(n, v);
    }
    R[n] = r; G[n] = g; B[n] = b;
  }
  // A bright number lends its four neighbours a little of its light.
  for (let i = 0; i < glow.length; i += 2) {
    const n = glow[i], v = glow[i + 1] * 0.22, x = n & 63, y = n >> 6;
    hsv(h0 + 0.45 * (cube.r[n] / rm), 0.6, v, tmp);
    if (S.mode === 2) hsv(h0 + 0.08, 0.2, v, tmp);
    for (const o of [x > 0 ? n - 1 : -1, x < 63 ? n + 1 : -1, y > 0 ? n - W : -1, y < H - 1 ? n + W : -1]) {
      if (o < 0 || has[o]) continue;
      R[o] += tmp[0]; G[o] += tmp[1]; B[o] += tmp[2];
    }
  }
  // The scan: the row it is in.
  if (c < NP) {
    const y = c >> 6;
    for (let x = 0; x < W; x++) { const o = y * W + x; R[o] += 36; G[o] += 36; B[o] += 36; }
  }
  const add = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = y * W + x;
    R[o] += r; G[o] += g; B[o] += b;
  };
  const line = (x0, y0, x1, y1, r, g, b) => {
    const n = max(abs(x1 - x0), abs(y1 - y0)) + 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      add(floor(x0 + (x1 - x0) * u), floor(y0 + (y1 - y0) * u), r, g, b);
    }
  };
  const hot = [0, 0, 0], cool = [0, 0, 0];
  hsv(h0 + 0.5, 0.45, 1, hot);
  hsv(h0 + 0.15, 0.35, 1, cool);
  const holes = [];
  for (const e of S.ev) {
    const f = 1 - e.age / LIFE, ax = e.a & 63, ay = e.a >> 6, mx = e.m & 63, my = e.m >> 6, nx = e.n & 63, ny = e.n >> 6;
    if (e.hit) {
      line(ax, ay, nx, ny, hot[0] * f * 0.7, hot[1] * f * 0.7, hot[2] * f * 0.7);
      for (const [x, y] of [[ax, ay], [mx, my], [nx, ny]]) {
        add(x, y, 255 * f, 255 * f, 255 * f);
        for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) add(x + u, y + v, hot[0] * f * 0.6, hot[1] * f * 0.6, hot[2] * f * 0.6);
      }
    } else {
      line(ax, ay, nx, ny, cool[0] * f * 0.5, cool[1] * f * 0.5, cool[2] * f * 0.5);
      add(ax, ay, 255 * f, 255 * f, 255 * f);
      add(nx, ny, 255 * f, 255 * f, 255 * f);
      // The number half way is a cross round an empty LED.
      for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) add(mx + u, my + v, cool[0] * f * 0.8, cool[1] * f * 0.8, cool[2] * f * 0.8);
      holes.push(my * W + mx);
    }
  }
  for (const o of holes) { R[o] = 0; G[o] = 0; B[o] = 0; }
  // The readout on a dark band: how many numbers are in the set, and how many
  // three-term progressions the scan has met so far.
  for (let y = 121; y < H; y++) for (let x = 0; x < W; x++) { const o = y * W + x; R[o] *= 0.12; G[o] *= 0.12; B[o] *= 0.12; }
  const num = (v, x, y, r, g, b, right) => {
    const str = String(min(9999, v)), w = str.length * 4 - 1, x0 = right ? x - w + 1 : x;
    for (let ch = 0; ch < str.length; ch++) {
      const m = DIGITS[str.charCodeAt(ch) - 48];
      for (let i = 0; i < m.length; i += 2) {
        const o = (y + m[i + 1]) * W + x0 + ch * 4 + m[i];
        R[o] = r; G[o] = g; B[o] = b;
      }
    }
  };
  hsv(h0 + 0.05, 0.5, 1, tmp);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) add(2 + i, 123 + j, tmp[0], tmp[1], tmp[2]);
  num(S.size, 8, 122, tmp[0], tmp[1], tmp[2], false);
  if (S.found === 0) hsv(h0 + 0.2, 0.35, 1, tmp); else { tmp[0] = hot[0]; tmp[1] = hot[1]; tmp[2] = hot[2]; }
  for (let i = 0; i < 3; i++) add(35 + i * 3, 124, tmp[0], tmp[1], tmp[2]);
  for (const x of [36, 37, 39, 40]) add(x, 124, tmp[0] * 0.3, tmp[1] * 0.3, tmp[2] * 0.3);
  num(S.found, 62, 122, tmp[0], tmp[1], tmp[2], true);
  for (let q = 0; q < NP; q++) {
    const m = max(R[q], G[q], B[q]), k = m > 255 ? 255 / m : 1;
    display.setPixel(q % W, (q / W) | 0, R[q] * k, G[q] * k, B[q] * k);
  }
}
