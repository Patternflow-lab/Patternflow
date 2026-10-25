// ===== Patternflow pattern =====
// Title:   Party Lights
// Family:  halloween
// Idea:    Strings of big orange, purple, poison green and bone white bulbs sag across a dark porch wall at different heights down the panel, running a chase, a sparkle, a slow breath and a flash on the beat in turn, while gusts swing the strings like pendulums and a garland of black paper bats twists on its threads between the bulbs.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Warmth=-1..1, Speed=0.2..3, Strands=3..7, Gust=0..1
//
// Knob 1: Warmth. At 0 the bulbs are orange, purple, poison green and bone white in turn along each string; at 1 red orange, rose, amber and candle white, and the wall paint takes their light a little warmer; at -1 magenta, blue violet, aqua green and ice white on a colder wall. A dimmed bulb sinks to deep red, plum, dark green or lavender grey, never brown.
// Knob 2: Speed. At 2 each program runs 4 seconds, in turn: a chase (one bulb in three lit, stepping 6 times a second, each string the other way), a sparkle (every bulb at two thirds, each flaring on its own 0.7 to 1.6 times a second), a breath (a 2.4 second swell rolling down the strings) and the beat (every bulb flashing together at 120 a minute, every fourth flash held twice as long). Gusts come every 5 seconds, the first at 1.7. At 0.2 it all runs ten times slower, at 3 half as fast again.
// Knob 3: Strands. How many strings hang down the panel, 3 to 7, each slung from edge to edge with one end a few rows higher than the other: 3 sag 22 rows each, 7 sag 9 rows and fill the panel, and every string carries 6 bulbs 10 LEDs apart. The paper bats always hang from the second string.
// Knob 4: Gust. The wind swings each string out of the wall like a pendulum, so it lifts, its low point slides sideways and the lower strings swing a little slower. At 0 the strings hang still; at 0.06 a breeze swings them up to 0.5 radians, lifting the sag by an eighth and sliding the low point 5 LEDs; at 1 each gust swings them past a radian, lifting them to a third of their sag and sliding the low point 11 LEDs, while the bulbs knock about and the bats spin on their threads.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, atan, tanh, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fr = (x) => x - floor(x);

// The four bulbs, each lit and dimmed, at Warmth -1, 0 and 1. Dimmed, the
// warm ones sink to red rather than brown.
const PAL = [
  // orange
  [[[0.95, 0.2, 0.9], [0.5, 0.04, 0.55]], [[1, 0.46, 0.02], [0.78, 0.1, 0.02]], [[1, 0.22, 0.02], [0.72, 0.04, 0.02]]],
  // purple
  [[[0.35, 0.3, 1], [0.14, 0.1, 0.7]], [[0.7, 0.2, 1], [0.42, 0.08, 0.72]], [[1, 0.12, 0.5], [0.68, 0.03, 0.3]]],
  // poison green
  [[[0.15, 1, 0.6], [0.03, 0.55, 0.3]], [[0.45, 1, 0.08], [0.12, 0.58, 0.04]], [[1, 0.72, 0.05], [0.75, 0.16, 0.02]]],
  // bone white
  [[[0.75, 0.9, 1], [0.35, 0.42, 0.62]], [[1, 0.95, 0.8], [0.55, 0.45, 0.62]], [[1, 0.82, 0.5], [0.72, 0.36, 0.2]]],
];
// A glass bulb hanging from its socket: half its width and length in LEDs,
// and how far below the socket its middle hangs.
const BRX = 2.1, BRY = 3, BDY = 3.6;
// A paper bat, 9 wide and 5 tall, its middle column at 4: ears, head,
// wings with raised tips and a scalloped hem.
const BAT = ["#..#.#..#", "##.###.##", "#########", ".#######.", "..#.#.#.."];
// The light's rings round a bulb, radius in LEDs and share of the bulb's colour.
const RING = [[3.2, 0.45], [5.6, 0.3], [9, 0.2], [13, 0.1]];
// The same as squared radii and the share inside each.
const RR = RING.map(([r]) => r * r), RS = RING.map((_, k) => RING.slice(k).reduce((s, q) => s + q[1], 0));
// The programs, each this many story seconds; a chase steps this many times
// a second; the beat is this long.
const PROG = 4, STEP = 6, BEAT = 0.5;
// Gusts come every GUSTS seconds, the first at G0.
const GUSTS = 5, G0 = 2.2;

export function setup(params) {
  // Each bulb's sparkle rate and phase, so they twinkle out of step.
  const spark = [];
  for (let i = 0; i < 7 * 9; i++) spark.push([0.7 + 0.9 * Math.random(), Math.random()]);
  params.s = {
    warmth: 0.5, speed: 2, strands: 3, gust: 0.06, pt: 0.5,
    phi: new Float64Array(7), dphi: new Float64Array(7), wind: 0.5, spark,
    yw: new Float32Array(7 * W), light: new Float32Array(N * 3), rgb: new Float32Array(N * 3),
    bulbs: [],
  };
}

// Where a strand hangs. i of n, its anchors at the panel's edges, its sag,
// and the lowest point pushed sideways and lifted as it swings out of the
// wall by phi, seen through a soft limit so it never swings past 75 degrees.
function strandY(S, i, n, x) {
  const D = (H - 22) / n, yl = 5 + i * D + (i % 2 ? 5 : 0), yr = yl + (i % 2 ? -6 : 5), sag = 0.62 * D;
  const ph = 1.3 * tanh(S.phi[i] / 1.3), u = (x + 0.5) / W, u0 = 0.5 + 0.18 * sin(ph), sg = sag * cos(ph);
  const v = u < u0 ? (u - u0) / u0 : (u - u0) / (1 - u0);
  return mix(yl, yr, u) + sg * (1 - v * v);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.warmth = cl(k[0], -1, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.strands = round(cl(k[2], 3, 7));
  S.gust = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.pt += ds;
  // The wind: a breeze and a gust every few seconds, each a swell of about
  // a second and a half.
  const t = S.pt, gt = t - G0, gk = floor(gt / GUSTS + 0.5), dg = gt - gk * GUSTS;
  S.wind = sqrt(S.gust) * (0.35 + 1.1 * exp(-((dg / 0.75) ** 2)) * (gk % 2 ? 0.75 : 1));
  // Each strand swings out of the wall like a pendulum, the lower and
  // longer ones slower, pushed by the wind and slowly damped.
  for (let i = 0; i < 7; i++) {
    const w = TAU / (1.5 + 0.12 * i), steps = 3;
    for (let s = 0; s < steps; s++) {
      const h = ds / steps, a = -w * w * S.phi[i] - 0.5 * w * S.dphi[i] + w * w * 1.1 * S.wind * (1 + 0.15 * sin(i * 1.7));
      S.dphi[i] += a * h;
      S.phi[i] = cl(S.phi[i] + S.dphi[i] * h, -3, 3);
    }
  }
  const n = S.strands;
  for (let i = 0; i < n; i++) for (let x = 0; x < W; x++) S.yw[i * W + x] = strandY(S, i, n, x);
  // The program and how far into it: chase, sparkle, breath, beat, with a
  // short cross-fade from the one before.
  const pn = floor(t / PROG), pf = t - pn * PROG, p = pn % 4, q = (pn + 3) % 4, xf = pn > 0 ? ease(pf / 0.4) : 1;
  const level = (pr, i, j) => {
    if (pr === 0) {
      // Chase: one bulb in three lit, stepping along, each strand the other way.
      const st = floor(t * STEP);
      return ((((i % 2 ? j : -j) + st + i) % 3) + 3) % 3 === 0 ? 1 : 0.25;
    }
    if (pr === 1) {
      // Sparkle: every bulb two thirds lit, each flaring at its own times.
      const [r, o] = S.spark[(i * 9 + j) % S.spark.length], f = fr(t * r + o);
      return 0.68 + 0.32 * max(0, 1 - f * 5) ** 2;
    }
    if (pr === 2) return 0.4 + 0.6 * (0.5 + 0.5 * sin(TAU * (t / 2.4 - i * 0.11 - j * 0.03)));
    // Beat: all strings flash together and hold, every fourth beat longer.
    const b = floor(t / BEAT), f = t - b * BEAT - (b % 4 ? 0.1 : 0.22);
    return f < 0 ? 1 : 0.35 + 0.65 * exp(-f / 0.12);
  };
  // The bulbs: every 10 LEDs along each strand, the kinds in turn, each
  // hanging off the wire tilted by its slope and knocked about by the wind.
  S.bulbs.length = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 7; j++) {
      const x = (i % 2 ? 7 : 2) + 10 * j;
      if (x > W - 3) continue;
      const xi = min(W - 1, x), y = S.yw[i * W + xi], sl = S.yw[i * W + min(W - 1, xi + 1)] - S.yw[i * W + max(0, xi - 1)];
      const tilt = 0.6 * atan(sl / 2) + S.wind * 0.35 * sin(S.pt * (5 + j * 0.7) + i * 2 + j);
      const lv = mix(level(q, i, j), level(p, i, j), xf);
      S.bulbs.push({ x, y, tilt, kind: (j + i) % 4, lv });
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.bulbs.length) return;
  const { light: L, rgb, bulbs, yw } = S, n = S.strands, wm = S.warmth;
  // The bulbs' colours at this warmth, lit and dimmed.
  const col = PAL.map((k) => [0, 1].map((m) => [0, 1, 2].map((c) => (wm < 0 ? mix(k[1][m][c], k[0][m][c], -wm) : mix(k[1][m][c], k[2][m][c], wm)))));
  const bulbCol = (b) => [0, 1, 2].map((c) => mix(col[b.kind][1][c], col[b.kind][0][c], cl((b.lv - 0.35) / 0.65, 0, 1)));
  // The light on the wall: stepped rings round each bulb, by its brightness.
  L.fill(0);
  for (const b of bulbs) {
    const c = col[b.kind][0], cx = b.x + 0.5 + BDY * sin(b.tilt), cy = b.y + BDY * cos(b.tilt), a = b.lv;
    const R = RING[RING.length - 1][0];
    for (let y = max(0, floor(cy - R)); y <= min(H - 1, floor(cy + R)); y++)
      for (let x = max(0, floor(cx - R)); x <= min(W - 1, floor(cx + R)); x++) {
        const r2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
        if (r2 >= RR[3]) continue;
        const s = r2 < RR[0] ? RS[0] : r2 < RR[1] ? RS[1] : r2 < RR[2] ? RS[2] : RS[3];
        const o = (y * W + x) * 3;
        (L[o] += c[0] * s * a), (L[o + 1] += c[1] * s * a), (L[o + 2] += c[2] * s * a);
      }
  }
  // The porch wall: clapboards 6 rows tall, each with a shadowed lower edge,
  // dark violet and lit by the bulbs, its paint a little warmer or colder
  // with the bulbs.
  const ar = 0.85 + 0.15 * wm, ab = 0.85 - 0.15 * wm;
  for (let y = 0; y < H; y++) {
    const edge = y % 6 === 5, alb = edge ? 0.53 : 1, br = edge ? 0.5 : 1;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      rgb[o] = 0.04 * br + alb * ar * min(1, L[o]);
      rgb[o + 1] = 0.025 * br + alb * 0.85 * min(1, L[o + 1]);
      rgb[o + 2] = 0.075 * br + alb * ab * min(1, L[o + 2]);
    }
  }
  const put = (x, y, r, g, b) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
  };
  // The wires, dark green, lit where the bulbs are near.
  for (let i = 0; i < n; i++) {
    let py = round(yw[i * W]);
    for (let x = 0; x < W; x++) {
      const y = round(yw[i * W + x]);
      for (let yy = min(py, y); yy <= max(py, y); yy++) {
        const o = (yy * W + x) * 3;
        if (yy >= 0 && yy < H) put(x, yy, 0.06 + 0.5 * min(1, L[o]), 0.12 + 0.5 * min(1, L[o + 1]), 0.05 + 0.5 * min(1, L[o + 2]));
      }
      py = y;
    }
  }
  // The garland of paper bats on the second strand, one between each pair
  // of bulbs on a thread 8 LEDs long, so they hang in the glow below the
  // bulbs, each twisting on its thread.
  const gi = 1, off = gi % 2 ? 7 : 2;
  for (let j = 0; j < 6; j++) {
    const x0 = off + 5 + 10 * j;
    if (x0 > W - 3) continue;
    const yt = round(yw[gi * W + x0]), tw = S.pt * (1.3 + 0.37 * j) + j * 1.9, amp = 0.35 + 2.2 * S.wind;
    const sw = cos(amp * sin(tw) + 0.25 * j), wid = max(0.12, abs(sw));
    for (let yy = yt + 1; yy <= yt + 8; yy++) put(x0, yy, 0.16, 0.13, 0.18);
    const by = yt + 9, flap = sin(S.pt * 9 + j) > 0.6 ? 1 : 0;
    for (let r = 0; r < BAT.length; r++)
      for (let cxx = 0; cxx < 9; cxx++) {
        if (BAT[r][cxx] !== "#") continue;
        const dx = (cxx - 4) * wid, x = round(x0 + dx), y = by + r - (flap && abs(cxx - 4) > 2 && r < 3 ? 1 : 0);
        // A bat turned past a quarter shows its plain back, which takes a
        // little more of the bulbs' light.
        if (x >= 0 && x < W && y >= 0 && y < H) {
          const o = (y * W + x) * 3, lit = sw < 0 ? 0.25 : 0.1;
          put(x, y, 0.015 + lit * min(1, L[o]), 0.01 + lit * min(1, L[o + 1]), 0.02 + lit * min(1, L[o + 2]));
        }
      }
  }
  // The bulbs: a dark socket on the wire, then the glass, lit in its own
  // colour with a paler fleck where it is brightest.
  for (const b of bulbs) {
    const c = bulbCol(b), s = sin(b.tilt), co = cos(b.tilt), bx = b.x + 0.5, by = b.y + 0.5;
    for (let dx = -1; dx <= 1; dx++) put(floor(bx + dx * co), floor(by + 0.5 - dx * s), 0.1, 0.13, 0.08);
    const mx = bx + BDY * s, my = by + BDY * co, hot = cl((b.lv - 0.6) / 0.4, 0, 1) * 0.45;
    for (let y = floor(my - 4); y <= my + 4; y++)
      for (let x = floor(mx - 4); x <= mx + 4; x++) {
        const px = x + 0.5 - mx, py = y + 0.5 - my, u = (px * co - py * s) / BRX, v = (px * s + py * co) / BRY, e = u * u + v * v;
        if (e > 1) continue;
        // The glass glows paler toward its middle, and a fleck shines up and left.
        const m = e < 0.3 ? hot : 0, fl = b.lv > 0.6 && u < -0.2 && u > -0.75 && v < -0.15 && v > -0.6 ? 0.55 : 0;
        put(x, y, mix(c[0], 1, max(m, fl)), mix(c[1], 1, max(m, fl)), mix(c[2], 1, max(m, fl)));
      }
  }
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    display.setPixel(i % W, floor(i / W), (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
  }
}
