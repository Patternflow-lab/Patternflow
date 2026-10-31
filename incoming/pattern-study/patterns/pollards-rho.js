// ===== Patternflow pattern =====
// Title:   Pollard's Rho
// Family:  algo
// Idea:    The sequence x -> x^2 + c taken modulo a hidden prime factor p of n stands up the panel as the Greek letter rho, a tail of numbered beads climbing from x0 = 2 at the bottom into a loop of beads at the top, and a tortoise and a hare chase each other along it, one bead and two beads a beat after Floyd or one bead a beat with the tortoise jumping to the hare at powers of two after Brent, while the readout beside the tail shows what the algorithm itself sees, the two values modulo n and their difference, and the gcd in the middle of the loop stays 1 until the two land on the same bead, when it jumps to p, the loop flashes and n is written as its two factors before the next number.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Pollard's rho method of factorisation (John M. Pollard, 1975), with Floyd's cycle finding (credited to Robert W. Floyd) and Brent's (Richard P. Brent, 1980); numerals and letters drawn for this pattern on a 3 by 5 grid, pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Number=0..7, Constant=1..6
//
// Knob 1: Hue. Turns the three colours round the wheel together. At 0 the beads are azure, the tortoise green and the hare orange; at 0.5 the beads are orange-red, the tortoise magenta and the hare blue.
// Knob 2: Speed. One evaluation of f takes 0.44 / Speed seconds: 0.22 s at the opening 2, so a Floyd beat (three evaluations) takes 0.66 s and a Brent beat 0.22 s. At 0.2 a Floyd beat takes 6.6 s, at 3 it takes 0.44 s. A found factor is held 3.2 s at Speed 2.
// Knob 3: Number. Which n the pattern starts from: 0 is 5893 = 71 x 83, then 6319, 8051 = 83 x 97, 4307, 4331, 6497, 2911 and 7031. Each number is factored by Floyd and then by Brent, and then the next one comes. With c = 1, 4307 = 59 x 73 fails: both primes close their loops on the same beat, the gcd is n itself, and the pattern tries again with c = 2.
// Knob 4: Constant. The c in x^2 + c, 1 to 6. A new c is a new sequence and a new rho: for 5893 the rho modulo 83 has a tail of 4 and a loop of 5 at c = 1, 2 and 4 at c = 2, 5 and 5 at c = 4, and at c = 5 the factor that turns up first is 71, with a tail of 2 and a loop of 6.

// Pollard's idea: take a map that looks random, f(x) = x^2 + c, and walk
// x0, x1 = f(x0), x2 = f(x1), ... modulo n. Modulo an unknown prime factor p
// of n the same walk is a walk on only p values, so after about sqrt(p)
// steps it must come back to a value it has seen, and from there it goes
// round the same loop for ever. Drawn out, the walk modulo p is a tail and a
// loop: the letter rho. Modulo n nothing has repeated yet, but two terms
// that sit on the same bead of the rho differ by a multiple of p, so
// gcd(|x_i - x_j|, n) is p.
//
// The algorithm cannot see the rho, only the values modulo n. It finds the
// loop without storing the walk by running two pointers. Floyd's tortoise
// takes one step and his hare two each beat; once both are on the loop the
// hare gains one bead a beat and lands on the tortoise's bead at the first
// beat i that is at least the tail's length and a multiple of the loop's.
// Brent's hare takes one step a beat and his tortoise waits, jumping to the
// hare after 1, 2, 4, 8, ... steps; it costs one evaluation of f a beat
// against Floyd's three, which is what Brent's 1980 paper gains. Here time
// runs by evaluations, so the two methods race fairly on the same number.
//
// The beads are x_i mod p, which the panel knows and the algorithm does
// not; the readout T and H are x_t and x_h mod n, and D is their difference.
// The hare lights each bead as it first reaches it. Every product here is
// below 8051^2, about 6.5e7, so ordinary doubles are exact.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, sin, cos, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const TAU = 2 * PI;

const NUMS = [5893, 6319, 8051, 4307, 4331, 6497, 2911, 7031];
const X0 = 2;
// The rho: loop centre and radius, the stem down its left side to YB.
const CX = 32, CY = 31, R = 24, SX = CX - R, YB = 122;
// Model seconds: one evaluation of f, the start, and the hold after a find.
const EVAL = 0.22, INTRO = 0.5, HOLD = 3.2, MOVE = 0.6;
const HUE_BEAD = 0.55, HUE_T = 0.33, HUE_H = 0.09;

// ---- Glyphs on a 3 by 5 grid, rows top to bottom.
const GL = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001011001111",
  4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001001010010",
  8: "111101111101111", 9: "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", L: "100100100100111", N: "101111111101101", O: "010101101101010",
  R: "110101110101101", T: "111010010010010", X: "101101010101101", Y: "101101010010010",
  "+": "000010111010000", "=": "000111000111000", "*": "000101010101000", "|": "010010010010010",
  "-": "000000111000000", " ": "000000000000000",
};

function gcd(a, b) {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function smallestFactor(n) {
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return d;
  return n;
}

// One run of the method on (n, c): the states beat by beat, and the rho of
// the prime it finds (or, when it fails, of the smaller prime).
function plan(n, c, brent) {
  const xs = [X0 % n];
  const x = (i) => {
    while (xs.length <= i) {
      const v = xs[xs.length - 1];
      xs.push((v * v + c) % n);
    }
    return xs[i];
  };
  const beats = [{ t: 0, h: 0, d: 0 }];
  let d = 1;
  if (!brent) {
    for (let i = 1; d === 1 && i < 400; i++) {
      d = gcd(abs(x(i) - x(2 * i)), n);
      beats.push({ t: i, h: 2 * i, d });
    }
  } else {
    let pw = 1, lam = 1, t = 0, h = 1;
    for (let k = 0; k < 800; k++) {
      d = gcd(abs(x(t) - x(h)), n);
      beats.push({ t, h, d });
      if (d > 1) break;
      if (pw === lam) {
        t = h;
        pw *= 2;
        lam = 0;
      }
      h++;
      lam++;
    }
  }
  const p = d > 1 && d < n ? d : smallestFactor(n);
  const seen = new Map(), lab = [];
  let v = X0 % p, i = 0;
  while (!seen.has(v)) {
    seen.set(v, i);
    lab.push(v);
    v = (v * v + c) % p;
    i++;
  }
  const mu = seen.get(v), lam = i - mu;
  const tailSp = mu > 0 ? (YB - CY) / mu : 99, loopSp = lam > 1 ? 2 * R * sin(PI / lam) : 99;
  return {
    n, c, brent, xs, beats, d, p, q: n / p, mu, lam, lab, fail: d === n,
    rt: cl(tailSp / 2 - 0.4, 1.5, 5), rl: cl(loopSp / 2 - 0.4, 1.5, 5),
    beat: brent ? EVAL : 3 * EVAL,
  };
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, num: -1, c: -1, idx: 0, cc: 1, brent: false,
    run: null, m: 0, buf: new Float32Array(N * 3),
    cb: [0, 0, 0], ct: [0, 0, 0], ch: [0, 0, 0], pos: [0, 0],
  };
}

function start(S) {
  S.run = plan(NUMS[S.idx], S.cc, S.brent);
  S.m = 0;
}

// After a run: a failure tries the next c with the same method; a Floyd find
// hands the number to Brent; a Brent find moves on to the next number.
function next(S) {
  const P = S.run;
  if (P.fail) S.cc++;
  else if (!P.brent) S.brent = true;
  else {
    S.brent = false;
    S.idx = (S.idx + 1) % NUMS.length;
    S.cc = S.c;
  }
  start(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const num = round(cl(k[2] || 0, 0, 7)), c = round(cl(k[3] == null ? 1 : k[3], 1, 6));
  if (num !== S.num || c !== S.c) {
    S.num = num;
    S.c = c;
    S.idx = num;
    S.cc = c;
    S.brent = false;
    start(S);
  }
  const P = S.run, end = INTRO + (P.beats.length - 1) * P.beat;
  // The hold after a find runs at no less than Speed 1, so a slow knob
  // still moves on to the next number within 6.4 s.
  S.m += d * (S.m > end ? max(1, S.speed) : S.speed) * 0.5;
  if (S.m > end + HOLD) next(S);
}

// ---- Drawing into a float RGB buffer.
function add(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3;
  buf[p] += c[0] * a;
  buf[p + 1] += c[1] * a;
  buf[p + 2] += c[2] * a;
}

function put(buf, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  buf[p] = c[0] * a;
  buf[p + 1] = c[1] * a;
  buf[p + 2] = c[2] * a;
}

function disc(buf, cx, cy, r, c, a) {
  for (let y = floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = floor(cx - r - 1); x <= cx + r + 1; x++) {
      const e = sqrt((x - cx) ** 2 + (y - cy) ** 2);
      add(buf, x, y, c, a * cl(r + 0.5 - e, 0, 1));
    }
}

function ring(buf, cx, cy, r, c, a, w) {
  for (let y = floor(cy - r - 2); y <= cy + r + 2; y++)
    for (let x = floor(cx - r - 2); x <= cx + r + 2; x++) {
      const e = abs(sqrt((x - cx) ** 2 + (y - cy) ** 2) - r);
      add(buf, x, y, c, a * cl(w + 0.5 - e, 0, 1));
    }
}

const textWidth = (s, sc) => s.length * 4 * sc - sc;

// mode 0 adds light, mode 1 punches the glyph dark out of what is there.
function text(buf, s, x0, y0, sc, c, a, mode) {
  for (let k = 0; k < s.length; k++) {
    const g = GL[s[k]];
    if (!g) continue;
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 3; gx++) {
        if (g[gy * 3 + gx] !== "1") continue;
        for (let yy = 0; yy < sc; yy++)
          for (let xx = 0; xx < sc; xx++) {
            const x = x0 + k * 4 * sc + gx * sc + xx, y = y0 + gy * sc + yy;
            if (mode) put(buf, x, y, c, a);
            else add(buf, x, y, c, a);
          }
      }
  }
}

// A point on the rho at fractional node u: the tail up the stem, then the
// loop, entered at its leftmost point going up and round clockwise.
function along(P, u, o) {
  if (u < P.mu) {
    o[0] = SX;
    o[1] = YB - ((YB - CY) * u) / P.mu;
  } else {
    const a = PI + (TAU * (u - P.mu)) / P.lam;
    o[0] = CX + R * cos(a);
    o[1] = CY + R * sin(a);
  }
  return o;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.run) return;
  const P = S.run, buf = S.buf, pos = S.pos;
  buf.fill(0);
  const CB = hsv(S.hue + HUE_BEAD, 0.75, 1, S.cb), CT = hsv(S.hue + HUE_T, 0.8, 1, S.ct), CH = hsv(S.hue + HUE_H, 0.85, 1, S.ch);
  const white = [1, 1, 1], pale = [0.82, 0.86, 0.95];

  // Where the run is: beat k, the share f of it gone, the movement eased.
  const nb = P.beats.length, tm = S.m - INTRO;
  let k = 0, f = 1;
  if (tm >= 0) {
    k = min(nb - 1, 1 + floor(tm / P.beat));
    f = k === nb - 1 && tm >= (nb - 1) * P.beat ? 1 : (tm - (k - 1) * P.beat) / P.beat;
  }
  const e = smooth(f / MOVE), b0 = P.beats[max(0, k - 1)], b1 = P.beats[k];
  const tu = k === 0 ? 0 : b0.t + (b1.t - b0.t) * e, hu = k === 0 ? 0 : b0.h + (b1.h - b0.h) * e;
  const shown = k === 0 ? P.beats[0] : f >= MOVE ? b1 : b0;
  const found = k === nb - 1 && f >= MOVE;
  const since = found ? S.m - INTRO - (nb - 2) * P.beat - MOVE * P.beat : -1;
  const flash = found ? cl(1 - since / 0.7, 0, 1) : 0;

  // The string: the loop, and the stem when there is a tail.
  const loopA = 0.2 + (found ? 0.25 + 0.55 * flash : 0);
  ring(buf, CX, CY, R, found ? white : CB, loopA, 0.45);
  if (P.mu > 0) for (let y = CY; y <= YB; y++) add(buf, SX, y, CB, 0.22);

  // The beads, lit once the hare has reached them, each with x_i mod p.
  const nodes = P.mu + P.lam;
  for (let i = 0; i < nodes; i++) {
    along(P, i, pos);
    const x = pos[0], y = pos[1], r = i < P.mu ? P.rt : P.rl;
    if (hu + 1e-6 >= i) {
      disc(buf, x, y, r, CB, 0.82);
      const s = String(P.lab[i]);
      if (r >= 4.4) text(buf, s, round(x - textWidth(s, 1) / 2), round(y - 2.5), 1, CB, 0.05, 1);
    } else ring(buf, x, y, r - 0.5, CB, 0.3, 0.45);
  }

  // The meeting bead flashes white with a ring running out from it.
  if (found) {
    along(P, P.beats[nb - 1].t, pos);
    const r = P.beats[nb - 1].t < P.mu ? P.rt : P.rl;
    disc(buf, pos[0], pos[1], r + 1, white, 0.9 * flash);
    if (since < 1.2) ring(buf, pos[0], pos[1], r + 3 + since * 26, white, 0.7 * (1 - since / 1.2), 0.6);
  }

  // Tortoise and hare: rings round their beads.
  along(P, tu, pos);
  ring(buf, pos[0], pos[1], P.rl + 2.2, CT, 1, 0.55);
  along(P, hu, pos);
  ring(buf, pos[0], pos[1], P.rl + 3.8, CH, 1, 0.55);

  // The gcd in the middle of the loop.
  const g = shown.d || 1;
  text(buf, "GCD", CX - 5, CY - 13, 1, pale, 0.55, 0);
  if (P.fail && found) {
    // n itself is four digits wide and reaches the rings on the loop, so it
    // gets a dark field one LED round it to stay whole.
    const s = String(g), x0 = CX - textWidth(s, 2) / 2;
    for (let y = CY - 5; y <= CY + 6; y++) for (let x = x0 - 1; x <= x0 + textWidth(s, 2); x++) put(buf, x, y, white, 0);
    text(buf, s, x0, CY - 4, 2, white, 0.5 + 0.5 * flash, 0);
  } else {
    const s = String(g), sc = 3;
    text(buf, s, round(CX - textWidth(s, sc) / 2), CY - 5, sc, found ? CB : pale, found ? 0.6 + 0.4 * flash : 0.5, 0);
    if (found) text(buf, s, round(CX - textWidth(s, sc) / 2), CY - 5, sc, white, 0.6 * flash, 0);
  }

  // The readout beside the stem: what the algorithm sees modulo n.
  const RX = 20;
  const ns = String(P.n);
  text(buf, ns, RX + 23 - textWidth(ns, 2) / 2, 66, 2, pale, 0.85, 0);
  // f(x) = x^2 + c, the 2 a small raised one.
  text(buf, "X", RX + 6, 81, 1, pale, 0.7, 0);
  add(buf, RX + 10, 79, pale, 0.7);
  add(buf, RX + 11, 79, pale, 0.7);
  add(buf, RX + 11, 80, pale, 0.7);
  add(buf, RX + 10, 81, pale, 0.7);
  add(buf, RX + 10, 82, pale, 0.7);
  add(buf, RX + 11, 82, pale, 0.7);
  text(buf, "+" + P.c, RX + 13, 81, 1, pale, 0.7, 0);
  const evals = (k === 0 ? 0 : f >= MOVE ? k : k - 1) * (P.brent ? 1 : 3);
  text(buf, P.brent ? "BRENT" : "FLOYD", RX + 2, 90, 1, pale, 0.75, 0);
  const es = String(evals);
  text(buf, es, RX + 44 - textWidth(es, 1), 90, 1, pale, 0.6, 0);
  const xt = P.xs[shown.t], xh = P.xs[shown.h];
  text(buf, "T", RX + 2, 100, 1, CT, 1, 0);
  text(buf, String(xt), RX + 44 - textWidth(String(xt), 1), 100, 1, CT, 0.95, 0);
  text(buf, "H", RX + 2, 107, 1, CH, 1, 0);
  text(buf, String(xh), RX + 44 - textWidth(String(xh), 1), 107, 1, CH, 0.95, 0);
  text(buf, "D", RX + 2, 114, 1, pale, 0.75, 0);
  const ds = String(abs(xt - xh));
  text(buf, ds, RX + 44 - textWidth(ds, 1), 114, 1, pale, 0.75, 0);
  if (found) {
    const s = P.fail ? "FAIL C+1" : "=" + P.p + "*" + P.q;
    text(buf, s, RX + 44 - textWidth(s, 1), 122, 1, P.fail ? CH : CB, 0.7 + 0.3 * flash, 0);
  }

  for (let p = 0; p < N; p++)
    display.setPixel(p % W, floor(p / W), round(cl(buf[p * 3], 0, 1) * 255), round(cl(buf[p * 3 + 1], 0, 1) * 255), round(cl(buf[p * 3 + 2], 0, 1) * 255));
}
