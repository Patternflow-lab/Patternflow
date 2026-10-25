// ===== Patternflow pattern =====
// Title:   Ballistic Annihilation
// Family:  particle
// Idea:    A gun at the foot of the panel fires one bullet a beat straight up at one of three speeds, and the panel is their space-time diagram, the gun's present at the right edge and the past scrolling left, so each bullet is a straight rising line of its speed's slope that ends in a spark where a faster bullet catches a slower one and both vanish.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ballistic annihilation (Yves Elskens and Harry Frisch, 1985); with three speeds the middle ones survive exactly when their share is over 1/4 (Droz, Rey, Frachebourg and Piasecki, 1995; proved by Haslegrave, Sidoravicius and Tournier, 2018)
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Middle=-1..1, Spread=-1..1
//
// Knob 1: Hue. Turns the three bullet colours round the wheel together. At 0 slow bullets are magenta, middle ones gold and fast ones cyan; at 0.33 slow lime, middle aqua and fast purple.
// Knob 2: Speed. Columns of time a second. At 2 the diagram scrolls 8 columns a second, the gun fires twice a second and a middle bullet climbs the 128 rows in 8 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Middle. The share p of middle-speed bullets, p = 0.25 + 0.15 x knob, from 0.10 at -1 to 0.40 at 1, the rest split evenly between slow and fast. It opens at 0, the critical 1/4: above it a middle bullet outlives every collision with positive probability, at or below it every middle bullet is caught in the end. On the panel 14% of the middle bullets reach the top at -1, 22% at 0 and 33% at 1.
// Knob 4: Spread. How far the slow and fast speeds sit from the middle one, which climbs 2 rows a column. Their paces (columns a row) sit symmetric round the middle's, 1/2 x (1 +- r) with r = 0.35 + 0.25 x knob. At -1 r is 0.1, the speeds 1.82, 2 and 2.22 rows a column, the lines nearly parallel and a third of the bullets reach the top; at 0.06 the speeds are 1.47, 2 and 3.15 and a fifth reach it; at 1 they are 1.25, 2 and 5, the first meetings come 7 rows over the gun and one bullet in seven reaches the top. The spread changes where bullets meet, never which ones meet.

const W = 64, H = 128;
const { floor, round, min, max, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Time runs in columns of the diagram. The gun fires every BEAT columns on
// average; each gap is drawn from 0.9 to 1.1 of it, so no three bullets ever
// meet at one point and the threshold stays the one for any spacing.
const BEAT = 4, WOB = 0.2;
// The middle speed in rows a column: a middle bullet crosses the 128 rows
// while the diagram scrolls its 64 columns, so a survivor runs corner to
// corner.
const VM = 2;
// Columns a second at Speed 1.
const RATE = 4;
// Slow, middle and fast on the wheel at Hue 0: magenta, gold, cyan.
const HUES = [0.9, 0.135, 0.52];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

export function setup(params) {
  params.s = {
    begun: false, hue: 0, speed: 2, p: 0.25, r: 0.365,
    now: 0, next: 0, top: H + 2, keep: true,
    live: [], done: [], sparks: [], shot: [0, 0, 0], out: [0, 0, 0], muzzle: 0, mk: 1,
    pal: [new Float32Array(3), new Float32Array(3), new Float32Array(3)],
    tip: [new Float32Array(3), new Float32Array(3), new Float32Array(3)],
    rgb: new Uint8Array(W * H * 3),
  };
}

// Speed of class k (0 slow, 1 middle, 2 fast) in rows a column. The paces,
// not the speeds, sit symmetric round the middle: swap time and height in
// the diagram and the gun's bullets become particles spaced along a line at
// relative speeds -r, 0 and +r, the three-speed problem the 1/4 belongs to.
const speedOf = (k, r) => VM / (1 + r * (1 - k));

function fire(S, t) {
  const u = Math.random(), q = (1 - S.p) / 2;
  const k = u < q ? 0 : u < q + S.p ? 1 : 2;
  S.live.push({ t0: t, v: speedOf(k, S.r), k, t1: 0 });
  S.shot[k]++;
  S.muzzle = t;
  S.mk = k;
  S.next = t + BEAT * (1 + WOB * (Math.random() - 0.5));
}

// Run the gun and its bullets on to time t1. The live bullets sit in firing
// order, which is also height order, oldest and highest first: two bullets
// cannot pass without meeting. So the next event is a shot, the oldest
// bullet leaving over the top, or the earliest meeting of two neighbours in
// the list, a newer bullet faster than the one above it. Each is taken at
// its exact time; a meeting removes both and makes their outer neighbours
// the new pair.
function advance(S, t1) {
  const L = S.live;
  for (;;) {
    let tc = Infinity, at = -1;
    for (let i = 0; i + 1 < L.length; i++) {
      const a = L[i], b = L[i + 1];
      if (b.v <= a.v) continue;
      const t = (b.v * b.t0 - a.v * a.t0) / (b.v - a.v);
      if (t < tc) (tc = t), (at = i);
    }
    const te = L.length ? L[0].t0 + S.top / L[0].v : Infinity;
    const t = min(tc, te, S.next);
    if (t > t1) break;
    if (t === S.next) fire(S, t);
    else if (t === tc) {
      const a = L[at], b = L[at + 1], h = a.v * (t - a.t0);
      a.t1 = b.t1 = t;
      L.splice(at, 2);
      if (S.keep) {
        S.done.push(a, b);
        S.sparks.push({ t, h });
      }
    } else {
      const a = L.shift();
      a.t1 = t;
      S.out[a.k]++;
      if (S.keep) S.done.push(a);
    }
  }
  S.now = t1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.p = 0.25 + 0.15 * cl(k[2], -1, 1);
  S.r = 0.35 + 0.25 * cl(k[3], -1, 1);
  // The first frame already shows a full diagram: the gun has been firing
  // for as long as the slowest bullet takes to clear the panel's 64 columns.
  if (!S.begun) {
    S.begun = true;
    fire(S, 0);
    advance(S, W + H / speedOf(0, S.r) + 8);
  }
  advance(S, S.now + cl(dt || 0, 0, 0.1) * S.speed * RATE);
  // Forget lines and sparks that have scrolled off the left edge.
  const left = floor(S.now) - W - 2;
  if (S.done.length > 400 || S.sparks.length > 200 || (S.done.length && S.done[0].t1 < left)) {
    S.done = S.done.filter((b) => b.t1 >= left);
    S.sparks = S.sparks.filter((s) => s.t >= left - 3);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const { rgb, pal, tip } = S;
  rgb.fill(0);
  for (let k = 0; k < 3; k++) {
    hsv(HUES[k] + S.hue, k === 1 ? 0.88 : 0.82, 1, pal[k]);
    hsv(HUES[k] + S.hue, 0.3, 1, tip[k]);
  }
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] = round(c[0] * a * 255);
    rgb[o + 1] = round(c[1] * a * 255);
    rgb[o + 2] = round(c[2] * a * 255);
  };
  // Time T sits in column T + off: the diagram moves a whole column at a
  // time, and the heads grow smoothly up the right edge.
  const nq = floor(S.now), off = W - 1 - nq;
  const line = (b, live) => {
    const end = live ? S.now : b.t1, top = min(H - 1, floor(b.v * (end - b.t0)));
    const c = pal[b.k];
    for (let h = 0; h <= top; h++) {
      let x = round(b.t0 + h / b.v + off);
      if (x > W - 1) x = W - 1;
      if (x < 0) continue;
      const y = H - 1 - h, head = live && h > top - 3;
      put(x - 1, y, head ? tip[b.k] : c, 1);
      put(x, y, head ? tip[b.k] : c, 1);
    }
  };
  // Middle bullets last, over the others: they are the ones the question is
  // about.
  for (const k of [0, 2, 1]) {
    for (const b of S.done) if (b.k === k && b.t1 + off >= -1) line(b, false);
    for (const b of S.live) if (b.k === k) line(b, true);
  }
  // Sparks: a burst for the first three columns, then a small white cross
  // that stays on the diagram where the two lines end.
  const white = [1, 0.97, 0.88], hot = [1, 0.75, 0.35];
  for (const s of S.sparks) {
    const x = round(s.t + off) - 1, y = H - 1 - round(s.h), age = S.now - s.t;
    if (x < -4) continue;
    if (age < 3) {
      const r = 1 + floor(age);
      for (let d = -r - 1; d <= r + 1; d++) {
        put(x + d, y, hot, 1);
        put(x, y + d, hot, 1);
      }
      for (let d = -r; d <= r; d++) {
        put(x + d, y + d, hot, 0.8);
        put(x + d, y - d, hot, 0.8);
      }
    }
    for (let d = -2; d <= 2; d++) {
      put(x + d, y, white, 1);
      put(x, y + d, white, 1);
    }
  }
  // The gun's muzzle flash at the foot of the right edge.
  const m = S.now - S.muzzle;
  if (m < 1.2) {
    const a = 1 - m / 1.2;
    for (let y = H - 3; y < H; y++) for (let x = W - 3; x < W; x++) put(x, y, tip[S.mk], a);
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, rgb[o], rgb[o + 1], rgb[o + 2]);
}
