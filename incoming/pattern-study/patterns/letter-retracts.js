// ===== Patternflow pattern =====
// Title:   Letter Retracts
// Family:  type
// Idea:    Three bold capitals stacked down the tall panel thin layer by layer to their skeletons without ever opening or closing a hole, then lose their free ends one LED at a time, so each letter shrinks onto its homotopy type, a point for X, T or Y, one loop round the counter for O, A or D and two loops for B, coloured by that hole count, and from those few LEDs the next word of the same classes grows.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: deformation retract and homotopy type (Karol Borsuk, 1931); parallel thinning in two subiterations (T. Y. Zhang and C. Y. Suen, 1984), in the version of Zicheng Guo and Richard W. Hall (1989); simple points (Shigeru Yokoi, Jun-ichiro Toriwaki and Teruo Fukumura, 1975); capitals drawn for this pattern; pattern round 82
// Round:   82
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Set=0..3, Weight=0..1
//
// Knob 1: Hue. Turns the three class colours round the wheel together. At 0 a letter with no hole is green, with one hole sky blue and with two holes magenta; at 0.5 they are violet, red-orange and green.
// Knob 2: Speed. At 2 a letter loses one layer of thinning every 0.16 s and one LED off each free end every 0.1 s, so BOX retracts in 3.3 s and BAG in 6.6 s; every time goes as 2 / Speed.
// Knob 3: Set. Four lists of words whose letters keep the same hole counts, so each word grows out of the last one's points and loops: 0 BOX, BAT, BAG, BOY (two, one, none); 1 DOG, ROT, PAL, DOT (one, one, none); 2 KEY, LEG, YET, ZEN (none); 3 ROD, POD, PRO, ODD (one each).
// Knob 4: Weight. Stroke width, 7 LEDs at 0 to 11.5 at 1 (7.5 at the opening 0.06): the bolder the letter, the more layers it loses before its skeleton shows, 11 for B at the opening and 17 at 1.

// Each letter is drawn as round-ended strokes in a 48 by 40 box and lit
// where an LED centre is within half the weight of a stroke. Then it is
// taken apart and every LED remembers the step at which it went:
//
// 1. Thinning, Guo and Hall's two subiterations, each one step, shown
//    1.6 times as long as a pruning step. A pixel goes when it has one
//    run of neighbours, two or three neighbouring pairs and does not face
//    the side the subiteration keeps; that peels the strokes from both
//    sides down to one LED wide, keeps every hole and keeps every free
//    end.
// 2. Pruning. At each step every pixel that is simple for 8-connected
//    letters on 4-connected ground, Yokoi's connectivity number 1, is
//    taken, rechecked as it goes. On a one-LED skeleton only the free
//    ends are simple, so every branch loses one LED a step. A pixel on
//    a loop is never simple, since taking it would join the hole to the
//    ground; a single pixel is not either.
//
// What is left cannot shrink further without changing the topology: one
// pixel, one loop, or two loops sharing an arc. The number of holes, the
// 4-connected pieces of ground the letter closes off, is counted once for
// the colour and is the same at every step.

const W = 64, H = 128;
const { floor, min, max, round, sqrt, sin, cos, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Glyph strokes in a unit box, v downwards: [x0, y0, x1, y1] segments and
// [cx, cy, rx, ry, from, to] elliptic arcs in degrees (0 right, 90 down).
// The first number of each entry is the glyph's width in the box.
const GLYPHS = {
  A: [1, [0, 1, 0.5, 0], [0.5, 0, 1, 1], [0.15, 0.7, 0.85, 0.7]],
  B: [0.9, [0, 0, 0, 1], [0, 0, 0.58, 0], [0.58, 0.235, 0.34, 0.235, -90, 90], [0.58, 0.47, 0, 0.47], [0, 0.47, 0.62, 0.47], [0.62, 0.735, 0.38, 0.265, -90, 90], [0.62, 1, 0, 1]],
  D: [0.9, [0, 0, 0, 1], [0, 0, 0.42, 0], [0.42, 0.5, 0.58, 0.5, -90, 90], [0.42, 1, 0, 1]],
  E: [0.78, [0, 0, 0, 1], [0, 0, 1, 0], [0, 0.5, 0.85, 0.5], [0, 1, 1, 1]],
  G: [0.95, [0.5, 0.5, 0.5, 0.5, 25, 310], [0.52, 0.56, 1, 0.56], [1, 0.56, 0.953, 0.711]],
  K: [0.88, [0, 0, 0, 1], [1, 0, 0, 0.64], [0.32, 0.435, 1, 1]],
  L: [0.72, [0, 0, 0, 1], [0, 1, 1, 1]],
  N: [0.9, [0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]],
  O: [0.95, [0.5, 0.5, 0.5, 0.5, 0, 360]],
  P: [0.85, [0, 0, 0, 1], [0, 0, 0.52, 0], [0.52, 0.28, 0.48, 0.28, -90, 90], [0.52, 0.56, 0, 0.56]],
  R: [0.9, [0, 0, 0, 1], [0, 0, 0.5, 0], [0.5, 0.27, 0.46, 0.27, -90, 90], [0.5, 0.54, 0, 0.54], [0.42, 0.54, 1, 1]],
  T: [0.95, [0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  X: [0.95, [0, 0, 1, 1], [1, 0, 0, 1]],
  Y: [0.95, [0, 0, 0.5, 0.52], [1, 0, 0.5, 0.52], [0.5, 0.52, 0.5, 1]],
  Z: [0.85, [0, 0, 1, 0], [1, 0, 0, 1], [0, 1, 1, 1]],
};

const SETS = [
  ["BOX", "BAT", "BAG", "BOY"],
  ["DOG", "ROT", "PAL", "DOT"],
  ["KEY", "LEG", "YET", "ZEN"],
  ["ROD", "POD", "PRO", "ODD"],
];

// Letter boxes: 48 wide by 40 tall, three down the panel.
const BW = 48, BH = 40, BX = 3, BY = [2, 44, 86];
// The sign of each letter's homotopy type stands at this column.
const SX = 57.5;
const KEEP = 32767;

// Segments of a glyph in LED coordinates for a stroke radius r.
function segmentsOf(ch, r) {
  const g = GLYPHS[ch], gw = g[0];
  const w = (BW - 2 * r) * gw, h = BH - 2 * r, ox = (BW - w) / 2, oy = r;
  const P = (u, v) => [ox + u * w, oy + v * h];
  const out = [];
  for (let i = 1; i < g.length; i++) {
    const s = g[i];
    if (s.length === 4) out.push([...P(s[0], s[1]), ...P(s[2], s[3])]);
    else {
      const n = max(8, round(abs(s[5] - s[4]) / 7.5));
      let prev = null;
      for (let j = 0; j <= n; j++) {
        const t = ((s[4] + ((s[5] - s[4]) * j) / n) * PI) / 180;
        const q = P(s[0] + s[2] * cos(t), s[1] + s[3] * sin(t));
        if (prev) out.push([...prev, ...q]);
        prev = q;
      }
    }
  }
  return out;
}

function rasterize(ch, r) {
  const segs = segmentsOf(ch, r), img = new Uint8Array(BW * BH), r2 = r * r;
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const px = x + 0.5, py = y + 0.5;
      for (const [x0, y0, x1, y1] of segs) {
        const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
        const t = L > 0 ? cl(((px - x0) * dx + (py - y0) * dy) / L, 0, 1) : 0;
        const ex = px - x0 - t * dx, ey = py - y0 - t * dy;
        if (ex * ex + ey * ey <= r2) {
          img[y * BW + x] = 1;
          break;
        }
      }
    }
  return img;
}

// Neighbours of (x, y) in the box, outside counts as ground.
const at = (img, x, y) => (x < 0 || y < 0 || x >= BW || y >= BH ? 0 : img[y * BW + x]);

// Yokoi's 8-connectivity number: 1 for a simple pixel or a free end.
function simple(img, x, y) {
  const n = [at(img, x + 1, y), at(img, x + 1, y - 1), at(img, x, y - 1), at(img, x - 1, y - 1), at(img, x - 1, y), at(img, x - 1, y + 1), at(img, x, y + 1), at(img, x + 1, y + 1)];
  let c = 0;
  for (let k = 0; k < 8; k += 2) {
    const a = 1 - n[k], b = 1 - n[k + 1], d = 1 - n[(k + 2) & 7];
    c += a - a * b * d;
  }
  return c === 1;
}

// Pieces of 4-connected ground that do not reach the box edge.
function holes(img) {
  const seen = new Uint8Array(BW * BH), stack = [];
  let count = 0;
  for (let s = 0; s < BW * BH; s++) {
    if (img[s] || seen[s]) continue;
    let edge = false;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % BW, y = (p / BW) | 0;
      if (x === 0 || y === 0 || x === BW - 1 || y === BH - 1) edge = true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= BW || ny >= BH) continue;
        const q = ny * BW + nx;
        if (!img[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (!edge) count++;
  }
  return count;
}

// Takes a letter apart: the step each pixel goes at, KEEP for what stays.
function retract(ch, r) {
  const img = rasterize(ch, r), N = BW * BH;
  const gone = new Int16Array(N).fill(-1);
  for (let p = 0; p < N; p++) if (img[p]) gone[p] = KEEP;
  const kind = holes(img);
  let step = 0;
  const mark = [];
  // Thinning, Guo and Hall.
  for (let pass = 0, any = 0; pass < 200; pass++) {
    const iter = pass & 1;
    if (!iter) any = 0;
    mark.length = 0;
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        if (!img[y * BW + x]) continue;
        const p2 = at(img, x, y - 1), p3 = at(img, x + 1, y - 1), p4 = at(img, x + 1, y), p5 = at(img, x + 1, y + 1);
        const p6 = at(img, x, y + 1), p7 = at(img, x - 1, y + 1), p8 = at(img, x - 1, y), p9 = at(img, x - 1, y - 1);
        const C = (!p2 & (p3 | p4)) + (!p4 & (p5 | p6)) + (!p6 & (p7 | p8)) + (!p8 & (p9 | p2));
        const N1 = (p9 | p2) + (p3 | p4) + (p5 | p6) + (p7 | p8), N2 = (p2 | p3) + (p4 | p5) + (p6 | p7) + (p8 | p9);
        const n = min(N1, N2);
        const m = iter === 0 ? (p6 | p7 | !p9) & p8 : (p2 | p3 | !p5) & p4;
        if (C === 1 && n >= 2 && n <= 3 && m === 0) mark.push(y * BW + x);
      }
    if (!mark.length) {
      if (iter === 1 && !any) break;
      continue;
    }
    any = 1;
    step++;
    for (const p of mark) {
      img[p] = 0;
      gone[p] = step;
    }
  }
  const thin = step;
  // Pruning: every simple pixel of the step before goes, if still simple.
  for (;;) {
    mark.length = 0;
    for (let p = 0; p < N; p++) if (img[p] && simple(img, p % BW, (p / BW) | 0)) mark.push(p);
    if (!mark.length) break;
    step++;
    let took = 0;
    for (const p of mark)
      if (simple(img, p % BW, (p / BW) | 0)) {
        img[p] = 0;
        gone[p] = step;
        took++;
      }
    if (!took) {
      step--;
      break;
    }
  }
  let point = -1;
  if (!kind) for (let p = 0; p < N; p++) if (gone[p] === KEEP) point = p;
  return { gone, kind, thin, last: step, point, end: SLOW * thin + step - thin };
}

// A thinning layer takes SLOW times as long as a pruning step.
const SLOW = 1.6;
const stepAt = (L, tau) => (tau < SLOW * L.thin ? tau / SLOW : L.thin + tau - SLOW * L.thin);

function wordOf(text, r) {
  const letters = [...text].map((ch) => retract(ch, r));
  return { text, letters, last: max(...letters.map((l) => l.end)) };
}

const hsv = (h, s, v) => {
  h = ((h % 1) + 1) % 1;
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
};
// Class hues: no hole green, one hole sky blue, two holes magenta.
const HUES = [0.3, 0.56, 0.86];

// Phases of one word, in steps: grow from the points and loops, stand,
// retract, rest, then cross to the next word's points and loops.
const STAND = 10, REST = 12, CROSS = 6;

export function setup(params) {
  params.s = { set: -1, weight: -1, index: 0, word: null, next: null, phase: "stand", t: 0, clock: 0, hue: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const set = round(cl(k[2] || 0, 0, 3));
  const r = round((3.5 + 2.25 * cl(k[3] == null ? 0.06 : k[3], 0, 1)) * 4) / 4;
  const list = SETS[set];
  if (set !== S.set) {
    S.set = set;
    S.index = 0;
    S.weight = r;
    S.word = wordOf(list[0], r);
    S.next = wordOf(list[1], r);
    S.phase = "stand";
    S.t = 0;
  } else if (r !== S.weight) {
    S.weight = r;
    S.word = wordOf(list[S.index], r);
    S.next = wordOf(list[(S.index + 1) % list.length], r);
  }
  S.clock += d * speed;
  let left = d * speed * 5;
  // Walk the phases with the steps this frame has.
  while (left > 0) {
    const w = S.word;
    if (S.phase === "grow") {
      const go = min(left * 1.5, S.t);
      S.t -= go;
      left -= go / 1.5;
      if (S.t <= 0) (S.phase = "stand"), (S.t = 0);
    } else if (S.phase === "stand") {
      const go = min(left, STAND - S.t);
      S.t += go;
      left -= go;
      if (S.t >= STAND) (S.phase = "retract"), (S.t = 0);
    } else if (S.phase === "retract") {
      const go = min(left, w.last - S.t);
      S.t += go;
      left -= go;
      if (S.t >= w.last) (S.phase = "rest"), (S.t = 0);
    } else if (S.phase === "rest") {
      const go = min(left, REST - S.t);
      S.t += go;
      left -= go;
      if (S.t >= REST) (S.phase = "cross"), (S.t = 0);
    } else {
      const go = min(left, CROSS - S.t);
      S.t += go;
      left -= go;
      if (S.t >= CROSS) {
        S.index = (S.index + 1) % list.length;
        S.word = S.next;
        S.next = wordOf(list[(S.index + 1) % list.length], S.weight);
        S.phase = "grow";
        S.t = S.word.last;
      }
    }
  }
}

// One word at retraction step tau, faded by f, into the frame.
function paint(frame, word, tau, f, S, glow) {
  const pulse = 0.75 + 0.25 * sin(S.clock * 4);
  for (let li = 0; li < 3; li++) {
    const L = word.letters[li], hue = HUES[L.kind] + S.hue, oy = BY[li];
    const body = hsv(hue, 0.85, 1), ghost = hsv(hue, 0.45, 0.2), tip = hsv(hue, 0.25, 1);
    const st = stepAt(L, tau), pruning = st > L.thin;
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const g = L.gone[y * BW + x];
        if (g < 0) continue;
        let c, a;
        if (g === KEEP) {
          // What stays: brighter once nothing else is left.
          const done = st >= L.last;
          c = done ? hsv(hue, 0.6, glow ? pulse : 1) : body;
          a = 1;
        } else if (g > st + 1) {
          c = body;
          // A soft depth: pixels that go late are brighter.
          a = 0.62 + (0.38 * min(g, L.thin + 1)) / (L.thin + 1);
        } else if (g > st) {
          // The layer or end that goes next, fading out.
          c = pruning ? tip : body;
          a = 0.2 + 0.8 * (g - st);
        } else {
          c = ghost;
          a = 1;
        }
        const p = ((oy + y) * W + BX + x) * 3;
        frame[p] += c[0] * a * f;
        frame[p + 1] += c[1] * a * f;
        frame[p + 2] += c[2] * a * f;
      }
    // Beside the letter, the sign of what it retracts to: a dot, a ring, or
    // two rings that touch. Dim until the letter gets there.
    {
      const there = st >= L.last, c = hsv(hue, 0.55, 1), sy = oy + BH / 2;
      const a0 = (there ? (glow ? pulse : 1) : 0.3) * f;
      for (let y = -6; y <= 6; y++)
        for (let x = -4; x <= 4; x++) {
          const px = floor(SX) + x + 0.5 - SX, py = y;
          let a = 0;
          if (L.kind === 0) a = max(0, 1 - sqrt(px * px + py * py) / 1.6);
          else if (L.kind === 1) a = max(0, 1 - abs(sqrt(px * px + py * py) - 3.2) / 0.7);
          else {
            const d1 = abs(sqrt(px * px + (py + 2.6) ** 2) - 2.6), d2 = abs(sqrt(px * px + (py - 2.6) ** 2) - 2.6);
            a = max(0, 1 - min(d1, d2) / 0.7);
          }
          if (!a) continue;
          const p = ((sy + y) * W + floor(SX) + x) * 3;
          frame[p] += c[0] * a * a0;
          frame[p + 1] += c[1] * a * a0;
          frame[p + 2] += c[2] * a * a0;
        }
    }
    // A point is one LED, so it gets a halo once it is all that is left.
    if (L.point >= 0 && st >= L.last) {
      const px = L.point % BW, py = (L.point / BW) | 0, c = hsv(hue, 0.5, 1);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const d = sqrt(dx * dx + dy * dy);
          if (!d || d > 3.2) continue;
          const a = 0.5 * (1 - d / 3.4) * (glow ? pulse : 1) * f, p = ((oy + py + dy) * W + BX + px + dx) * 3;
          frame[p] += c[0] * a;
          frame[p + 1] += c[1] * a;
          frame[p + 2] += c[2] * a;
        }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.word) return;
  const frame = (S.frame = S.frame || new Float32Array(W * H * 3));
  frame.fill(0);
  if (S.phase === "grow") paint(frame, S.word, S.t, 1, S, false);
  else if (S.phase === "stand") paint(frame, S.word, 0, 1, S, false);
  else if (S.phase === "retract") paint(frame, S.word, S.t, 1, S, false);
  else if (S.phase === "rest") paint(frame, S.word, S.word.last, 1, S, true);
  else {
    const f = S.t / CROSS;
    paint(frame, S.word, S.word.last, 1 - f, S, true);
    paint(frame, S.next, S.next.last, f, S, true);
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, round(min(1, frame[p]) * 255), round(min(1, frame[p + 1]) * 255), round(min(1, frame[p + 2]) * 255));
    }
}
