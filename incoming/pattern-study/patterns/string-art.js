// ===== Patternflow pattern =====
// Title:   String Art
// Family:  type
// Idea:    One thread is strung from pin to pin round the edge of the panel, each next pin picked greedily as the one whose straight chord best fills what the glyph still lacks and least lights what lies outside it, so a bold A, the Hangul syllable 실 (thread), a K and an ampersand come up one after another out of about four hundred lines of light on black, each strung in 12 s, held, faded and strung again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: computational string art, one continuous thread whose next pin is the greedy choice of the chord that most lowers the error against the picture (Petros Vrellis, A New Way to Knit, 2016); antialiased lines (Xiaolin Wu, 1991); the frame a superellipse (Gabriel Lamé, 1818); glyphs drawn here, the 실 included, pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spacing=2..8, Round=0..1
//
// Knob 1: Hue. Turns the thread colour round the wheel. At 0 the A is strung in cyan and its last threads have turned 0.14 of the wheel toward blue; each glyph after it starts 0.13 further round, so at 0 the 실 runs blue to violet, the K violet to pink and the ampersand pink to coral.
// Knob 2: Speed. At 2 a glyph is strung in 12.3 s, slowly at first and last and about 54 threads a second in the middle, holds 3 s and fades in 1.2 s, 16.5 s a glyph. At 0.2 it is ten times slower and each thread can be seen running from its pin to the next.
// Knob 3: Spacing. LEDs of frame between neighbouring pins, 2 to 8 in whole steps: 187 pins at 2, 94 at 4, 47 at 8. A glyph takes 2.25 threads a pin, 421 at 2 and 106 at 8, and fewer pins mean heavier threads, each twice as bright at 8 as at 2, so the A turns from a dense weave into a coarse lattice of separate lines.
// Knob 4: Round. The shape of the frame the pins stand on, the superellipse |x/a|^n + |y/b|^n = 1 through the edges of the panel with n = 2 + 40 (1 - Round)^3: at 0.06 n is 35, a rectangle with its corners rounded by about an LED; at 0.5 n is 7; at 1 it is the ellipse inside the panel, Vrellis's round loom stretched to 64 by 128, 153 pins and the corners left dark. Turning Spacing or Round strings the glyph again from its first thread.
// Buttons: K1 tap fades the glyph and starts the next.

// The greedy step. Each LED has a target, 3.5 units of thread light times
// how much of it the glyph covers, and the light the threads have left so
// far. Adding a thread of light a along a chord changes the squared error by
// a w (2 r - a w) at each LED it crosses with weight w, r the shortfall
// there. Outside the glyph the target is 0, so a thread there only adds
// error, counted 0.6 times. The chord from the current pin with the largest
// gain per LED of length wins; a chord is used once. The target is set
// above what 421 threads can give, so the glyph keeps drawing threads to
// itself to the end instead of filling up and spilling. What shows is
// (1 - exp(-light))^1.3 per colour channel, so one stray thread stays dim
// and fifteen crossing on a stroke come near full brightness.

const W = 64, H = 128, N = W * H, CX = 31.5, CY = 63.5, AX = 31.5, BY = 63.5;
const { floor, round, max, abs, sqrt, exp, pow, cos, sin, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Threads per pin; light a thread leaves per LED step with 188 pins; the
// light the glyph asks for; the weight of light outside it; the display curve.
const PER_PIN = 2.25, ALPHA = 0.2, PIN0 = 188, TGT = 3.5, LAM = 0.6, GAM = 1.3;
// Seconds at Speed 2: the first thread running out from its pin, the whole
// build, the hold, the fade. HUE0 is the A's hue at Hue 0, cyan.
const T0 = 0.6, TB = 12.3, HOLD = 3, CUT = 1.2, HUE0 = 0.52;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Glyph primitives: ["p", x, y, x, y, ...] a filled polygon, ["s", x0, y0,
// x1, y1, r] a stroke with round ends, ["a", cx, cy, R, r, from, to] an arc
// of a ring, angles in degrees with y down (90 is the bottom).
const GLYPHS = [
  // A
  [
    ["p", 25, 6, 39, 6, 18, 122, 4, 122],
    ["p", 25, 6, 39, 6, 60, 122, 46, 122],
    ["p", 12, 80, 52, 80, 52, 92, 12, 92],
  ],
  // 실
  [
    ["s", 24, 9, 6, 58, 6],
    ["s", 18, 27, 40, 58, 6],
    ["p", 46, 5, 58, 5, 58, 66, 46, 66],
    ["p", 6, 72, 58, 72, 58, 81, 6, 81],
    ["p", 48, 72, 58, 72, 58, 101, 48, 101],
    ["p", 6, 92, 58, 92, 58, 101, 6, 101],
    ["p", 6, 92, 16, 92, 16, 122, 6, 122],
    ["p", 6, 113, 59, 113, 59, 122, 6, 122],
  ],
  // K
  [
    ["p", 5, 6, 19, 6, 19, 122, 5, 122],
    ["p", 15, 62, 44, 6, 60, 6, 15, 90],
    ["p", 27, 62, 37, 50, 61, 122, 45, 122],
  ],
  // &
  [
    ["a", 30, 25, 13, 5.5, 0, 360],
    ["s", 21, 35, 59, 121, 6],
    ["s", 39, 35, 9.5, 87, 5.5],
    ["a", 28, 94, 20, 6, -30, 200],
    ["s", 45.3, 84, 57, 68, 5.5],
  ],
];

function inPoly(pr, x, y) {
  let c = false;
  for (let i = 1, j = pr.length - 2; i < pr.length; j = i, i += 2) {
    const xi = pr[i], yi = pr[i + 1], xj = pr[j], yj = pr[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function inside(g, x, y) {
  for (const pr of g) {
    if (pr[0] === "p" && inPoly(pr, x, y)) return true;
    if (pr[0] === "s") {
      const [, x0, y0, x1, y1, r] = pr, dx = x1 - x0, dy = y1 - y0;
      const t = cl(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1);
      if ((x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2 < r * r) return true;
    }
    if (pr[0] === "a") {
      const [, cx, cy, R, r, a0, a1] = pr, d = sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (abs(d - R) < r) {
        let a = (atan2(y - cy, x - cx) * 180) / PI;
        while (a < a0) a += 360;
        if (a <= a1) return true;
      }
    }
  }
  return false;
}
// Coverage of each LED by the glyph, 4 x 4 samples.
function mask(g) {
  const m = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (inside(g, x + (i + 0.5) / 4, y + (j + 0.5) / 4)) c++;
      m[y * W + x] = c / 16;
    }
  return m;
}

// The frame is the superellipse |x/a|^n + |y/b|^n = 1 through the panel's
// edges. norm() is its left side to the power 1/n, 1 on the frame.
function norm(u, v, n) {
  u = abs(u);
  v = abs(v);
  const m = max(u, v);
  return m > 0 ? m * pow(pow(u / m, n) + pow(v / m, n), 1 / n) : 0;
}
// Pins every `sp` LEDs of arc round the frame, on LED centres.
function pins(sp, n) {
  const M = 1440, xs = [], ys = [], arc = [0];
  for (let k = 0; k <= M; k++) {
    const f = (2 * PI * k) / M, c = cos(f), s = sin(f), r = 1 / norm(c / AX, s / BY, n);
    xs.push(CX + r * c);
    ys.push(CY + r * s);
    if (k) arc.push(arc[k - 1] + sqrt((xs[k] - xs[k - 1]) ** 2 + (ys[k] - ys[k - 1]) ** 2));
  }
  const P = [];
  for (let s = sp / 2, k = 0; s < arc[M]; s += sp) {
    while (arc[k + 1] < s) k++;
    const u = (s - arc[k]) / (arc[k + 1] - arc[k] || 1);
    const x = cl(round(xs[k] + u * (xs[k + 1] - xs[k])), 0, W - 1), y = cl(round(ys[k] + u * (ys[k + 1] - ys[k])), 0, H - 1);
    const q = P[P.length - 1];
    if (!q || q.x !== x || q.y !== y) P.push({ x, y });
  }
  if (P.length > 1 && P[0].x === P[P.length - 1].x && P[0].y === P[P.length - 1].y) P.pop();
  return P;
}

// Walk a chord LED by LED along its long axis, splitting each step between
// the two LEDs either side of it (Xiaolin Wu, 1991). u is how much of the
// chord, from a.
function walk(a, b, u, fn) {
  const dx = b.x - a.x, dy = b.y - a.y, n = max(abs(dx), abs(dy)), m = floor(n * u);
  const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
  if (abs(dx) >= abs(dy))
    for (let k = 0; k <= m; k++) {
      const x = a.x + sx * k, y = a.y + (dy * k) / n, yi = floor(y), f = y - yi;
      fn(x + yi * W, 1 - f);
      if (f > 1e-6 && yi + 1 < H) fn(x + (yi + 1) * W, f);
    }
  else
    for (let k = 0; k <= m; k++) {
      const y = a.y + sy * k, x = a.x + (dx * k) / n, xi = floor(x), f = x - xi;
      fn(xi + y * W, 1 - f);
      if (f > 1e-6 && xi + 1 < W) fn(xi + 1 + y * W, f);
    }
}

function newGlyph(S, gi) {
  S.gi = ((gi % GLYPHS.length) + GLYPHS.length) % GLYPHS.length;
  S.mask = mask(GLYPHS[S.gi]);
  S.P = pins(S.sp, S.n);
  // Fewer pins, fewer and heavier threads.
  S.nt = round(PER_PIN * S.P.length);
  S.al = ALPHA * sqrt(PIN0 / S.P.length);
  S.acc.fill(0);
  S.rgb.fill(0);
  Object.assign(S, { laid: 0, used: new Set(), t: 0, phase: 0, fade: 1, at: 0, u: 0 });
  // The thread is tied on at the pin nearest the bottom left corner.
  let best = 1e9;
  S.P.forEach((p, i) => {
    const d = (p.x - 8) ** 2 + (p.y - H) ** 2;
    if (d < best) (best = d), (S.at = i);
  });
  S.next = choose(S);
}

// The greedy step: from the pin the thread is on, the chord whose light most
// lowers the squared error against the glyph, per LED of its length. Light
// outside the glyph counts LAM times. A chord whose middle lies within 2.5
// LEDs of the frame would only hug the frame, and none is used twice.
function choose(S) {
  const P = S.P, a = P[S.at], acc = S.acc, m = S.mask, al = S.al;
  let best = -1e18, bi = -1;
  for (let j = 0; j < P.length; j++) {
    const b = P[j], key = S.at < j ? S.at * 4096 + j : j * 4096 + S.at;
    if (j === S.at || S.used.has(key)) continue;
    const mx = (a.x + b.x) / 2 - CX, my = (a.y + b.y) / 2 - CY;
    if ((1 - norm(mx / AX, my / BY, S.n)) * AX < 2.5) continue;
    let sc = 0;
    walk(a, b, 1, (i, w) => {
      const c = m[i], r = TGT * c - acc[i];
      sc += (c + LAM * (1 - c)) * w * (2 * r - al * w);
    });
    sc /= sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    if (sc > best) (best = sc), (bi = j);
  }
  return bi;
}

// Thread k's colour: the glyph's hue, turning 0.14 round the wheel from the
// first thread to the last.
const tint = (S, k, o) => hsv(S.hue + HUE0 + S.gi * 0.13 + (0.14 * k) / S.nt, 0.6, 1, o);

function lay(S) {
  const a = S.P[S.at], b = S.P[S.next], col = S.tc;
  tint(S, S.laid, col);
  walk(a, b, 1, (i, w) => {
    const l = S.al * w, k = i * 3;
    S.acc[i] += l;
    S.rgb[k] += l * col[0];
    S.rgb[k + 1] += l * col[1];
    S.rgb[k + 2] += l * col[2];
  });
  S.used.add(S.at < S.next ? S.at * 4096 + S.next : S.next * 4096 + S.at);
  S.at = S.next;
  S.laid++;
  S.next = choose(S);
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const tone = (a) => pow(1 - exp(-a), GAM);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, sp: 2, n: 40, rk: 0, started: false, btn: false, gi: 0,
    acc: new Float32Array(N), rgb: new Float32Array(N * 3), part: new Float32Array(N), tc: [1, 1, 1], pc: [1, 1, 1],
  };
  return params.s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const sp = round(cl(k[2] == null ? 2 : k[2], 2, 8)), rk = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (!S.started || sp !== S.sp || abs(rk - S.rk) > 0.02) {
    S.sp = sp;
    S.rk = rk;
    S.n = 2 + 40 * (1 - rk) ** 3;
    newGlyph(S, S.gi);
    S.started = true;
  } else if (btn && !S.btn && S.phase < 2) (S.phase = 2), (S.t = 0);
  S.btn = btn;
  S.t += (d * S.speed) / 2;
  if (S.phase === 0) {
    // The first thread runs out over T0, then the rest follow on an S-curve.
    const want = max(S.nt * ease((S.t - T0) / (TB - T0)), cl(S.t / T0, 0, 1));
    while (S.laid + 1 <= want && S.laid < S.nt && S.next >= 0) lay(S);
    S.u = cl(want - S.laid, 0, 1);
    if (S.laid >= S.nt || S.next < 0) (S.phase = 1), (S.t = 0);
  } else if (S.phase === 1) {
    if (S.t >= HOLD) (S.phase = 2), (S.t = 0);
  } else {
    S.fade = cl(1 - S.t / CUT, 0, 1);
    if (S.t >= CUT) newGlyph(S, S.gi + 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, f = S.fade, part = S.part, tc = S.tc;
  part.fill(0);
  // The thread being laid, as far as it has got.
  if (S.phase === 0 && S.next >= 0 && S.u > 0) {
    tint(S, S.laid, tc);
    walk(S.P[S.at], S.P[S.next], S.u, (i, w) => (part[i] += S.al * w));
  }
  for (let i = 0; i < N; i++) {
    const kk = i * 3, p = part[i];
    display.setPixel(i % W, floor(i / W), round(tone(rgb[kk] + p * tc[0]) * f * 255), round(tone(rgb[kk + 1] + p * tc[1]) * f * 255), round(tone(rgb[kk + 2] + p * tc[2]) * f * 255));
  }
  // The pins.
  hsv(S.hue + HUE0 + S.gi * 0.13, 0.15, 0.3, S.pc);
  const pc = S.pc;
  for (const p of S.P) display.setPixel(p.x, p.y, round(pc[0] * 255), round(pc[1] * 255), round(pc[2] * 255));
  // Below Speed 1 a thread takes long enough to follow, and the point it has
  // reached shows as a bright needle.
  const nd = cl((1 - S.speed) / 0.5, 0, 1);
  if (nd > 0 && S.phase === 0 && S.next >= 0 && S.u > 0) {
    const a = S.P[S.at], b = S.P[S.next], x = round(a.x + (b.x - a.x) * S.u), y = round(a.y + (b.y - a.y) * S.u);
    const v = 255 * nd * f;
    display.setPixel(x, y, round(v * (0.6 + 0.4 * tc[0])), round(v * (0.6 + 0.4 * tc[1])), round(v * (0.6 + 0.4 * tc[2])));
  }
}
