// ===== Patternflow pattern =====
// Title:   Neon Alley
// Family:  city
// Idea:    The wall of a narrow night alley hung from roof to street with neon pictograms in bent glass tube, lighting in sequence, chasing and buzzing over wet asphalt.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 16; the stacked shop signs of Seoul, Hong Kong and Tokyo back streets
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0..4, Wear=0..1, Rain=0..1
//
// Knob 1: Hue. Turns every tube round the colour wheel together, so each sign keeps its opposite pair; at 0 the alley burns its own red, green, cyan and magenta.
// Knob 2: Pace. The tempo of the sign controllers and how many run a show: at 0 every sign holds still, at 2 about half black out and relight tube by tube or double-blink every few seconds, at 4 all of them, with hardly a pause between.
// Knob 3: Wear. How tired the glass is: at 0 one frame tube buzzes, at 1 nearly half the tubes stutter and sag and three in ten have died dark.
// Knob 4: Rain. A drizzle that shows only where a sign lights it, puddles that spread on the asphalt and mirror the signs, and haze that widens every glow.
// Buttons: K1 tap cuts the power; the signs come back one at a time, each tube stuttering as its transformer strikes. K2 tap hangs a new set of signs.

const W = 64;
const H = 128;
const N = W * H;
// Rows from here down are the street.
const STREET = 116;
// In dry air a tube lights the wall up to 3 LEDs out and never above 20/255,
// so the wall counts as dark: colourfulness wants every lit LED full and
// saturated.
const GLOW = 3;
// A raindrop still takes a tube's colour 8 LEDs away from it.
const REACH = 8;
// Tube LEDs the wall may carry, 30% of the panel before shows and chases
// switch part of it off. A frame that would pass it is not hung.
const BUDGET = 2450;
const D2R = Math.PI / 180;

// Hues in degrees at full saturation and value. Red, green, cyan and magenta
// carry the most chroma a pixel can (285 on the measure's opponent axes,
// against about 240 for this yellow and blue), so frames and pictograms take
// those and yellow and blue stay accents. No tube is white.
const [R, Y, G, C, B, M, P] = [0, 54, 120, 180, 230, 300, 330];
// [frame, pictogram, contrast, accent]: the frame across the wheel from the
// pictogram it holds.
const SCHEMES = [
  [C, M, G, Y], [M, G, Y, C], [R, C, Y, G], [G, R, C, Y], [M, C, Y, G],
  [C, R, Y, M], [G, M, C, Y], [R, G, C, B], [P, C, G, Y], [C, M, Y, R],
];

// The layout keeps its own generator, so every panel opens on the same alley.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rnd) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function arc(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(3, Math.ceil((Math.abs(a1 - a0) * D2R * Math.max(rx, ry)) / 1.2));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * D2R;
    out.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return out;
}

const rrect = (x, y, w, h, c) => [
  ...arc(x + c, y + c, c, c, 180, 270),
  ...arc(x + w - c, y + c, c, c, 270, 360),
  ...arc(x + w - c, y + h - c, c, c, 0, 90),
  ...arc(x + c, y + h - c, c, c, 90, 180),
];

// A closed path cut into dashes of 4 LEDs with gaps of 2.5, for marquees.
function dashes(pts) {
  const out = [];
  const n = pts.length >> 1;
  let cur = null;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const ax = pts[2 * i];
    const ay = pts[2 * i + 1];
    const dx = pts[(2 * i + 2) % (2 * n)] - ax;
    const dy = pts[(2 * i + 3) % (2 * n)] - ay;
    const m = Math.ceil(Math.hypot(dx, dy) * 2);
    for (let j = 0; j < m; j++, s += Math.hypot(dx, dy) / m)
      if (s % 6.5 < 4) {
        if (!cur) out.push((cur = []));
        cur.push(ax + (dx * j) / m, ay + (dy * j) / m);
      } else cur = null;
  }
  return out;
}

// The pictograms, each drawn in a box w by h at scale 1. T(group, role,
// closed, points, radius) bends one tube: the group is what the sign's
// controller switches, the role picks the colour (0 pictogram, 1 contrast,
// 2 accent). The radius of 1.05 makes a tube two LEDs thick along the grid
// lines and three between them. anim(group, t) is whether that group is lit
// at t seconds of the controller's clock.
const ICONS = [
  {
    // A heart with an arrow through it: the love motel on the corner.
    w: 26, h: 21,
    draw(T) {
      const pts = [];
      for (let i = 0; i < 44; i++) {
        const t = (i / 44) * 2 * Math.PI;
        const q = Math.sin(t);
        pts.push(13 + 9.9 * q * q * q, 9 - 0.62 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)));
      }
      T(0, 0, 1, pts);
      T(1, 2, 0, [0.6, 16.8, 0.6, 20.4, 4.2, 20.4], 0.95);
      T(1, 2, 0, [0.6, 20.4, 6.5, 17.2], 0.95);
      T(2, 2, 0, [20, 6.8, 25.4, 3.8], 0.95);
      T(2, 2, 0, [21.8, 2.9, 25.4, 3.8, 24.3, 7.2], 0.95);
    },
    // The heart drops out twice a beat, lub and dub; the arrow flies in,
    // fletching first.
    anim(g, t) {
      const c = t % 1.3;
      if (!g) return c < 0.09 || (c > 0.22 && c < 0.31) ? 0 : 1;
      return t % 6 > (g === 1 ? 0.3 : 0.6) ? 1 : 0;
    },
  },
  {
    // A cat's face for the cat cafe, whiskers out past its cheeks.
    w: 38, h: 23,
    draw(T) {
      T(0, 0, 1, [8.2, 14.4, 7.5, 9, 9, 1.8, 15, 6, 23, 6, 29, 1.8, 30.5, 9, ...arc(19, 13, 11, 8, 10, 170)]);
      T(1, 1, 0, [14, 12.5, 16, 12.5], 1.3);
      T(1, 1, 0, [22, 12.5, 24, 12.5], 1.3);
      T(2, 2, 0, [19, 16.6], 1.25);
      for (const s of [-1, 1]) {
        T(3, 2, 0, [19 + s * 11.4, 16, 19 + s * 18, 14], 0.9);
        T(3, 2, 0, [19 + s * 11.4, 18.5, 19 + s * 18, 19.6], 0.9);
      }
    },
    // It blinks every 3.4 s and twitches its whiskers every 5.3 s.
    anim(g, t) {
      if (g === 1) return t % 3.4 < 0.15 ? 0 : 1;
      return g === 3 && t % 5.3 > 5.05 && t % 5.3 < 5.17 ? 0 : 1;
    },
  },
  {
    // A martini with an olive on a pick: the basement bar.
    w: 25, h: 30,
    draw(T) {
      T(0, 0, 1, [0.5, 3.5, 24.5, 3.5, 12.5, 16]);
      T(0, 0, 0, [12.5, 16, 12.5, 27.5]);
      T(0, 0, 0, [6, 28.5, 19, 28.5]);
      T(1, 1, 1, arc(12.5, 8.8, 1.6, 1.6, 0, 360), 1.1);
      T(2, 2, 0, [19.5, 0.5, 14, 7.5], 0.9);
    },
    // The olive drops in: dark for the first half second of every 4.
    anim: (g, t) => (g === 1 && t % 4 < 0.5 ? 0 : 1),
  },
  {
    // A noodle bowl with chopsticks and three columns of steam.
    w: 31, h: 28,
    draw(T) {
      T(0, 0, 1, [0.5, 14, 30.5, 14, ...arc(15.5, 14, 15, 9, 0, 180)]);
      T(0, 0, 0, [10, 26.5, 21, 26.5]);
      const nd = [];
      for (let x = 7; x <= 24; x++) nd.push(x, 18.8 + 1.3 * Math.sin(x * 1.1));
      T(7, 2, 0, nd, 0.9);
      T(7, 2, 0, [17, 12, 26, 0.8], 0.9);
      T(7, 2, 0, [21, 12, 30.5, 2.8], 0.9);
      for (let c = 0; c < 3; c++)
        for (let k = 0; k < 2; k++) {
          const s = [];
          for (let y = 11 - k * 5.5; y >= 5.5 - k * 5.5; y--) s.push(4 + c * 5 + 1.2 * Math.sin(y * 0.9 + c), y);
          T(1 + c * 2 + k, 1, 0, s, 0.9);
        }
    },
    // Each steam column lights low, then high, then breaks, a third of a
    // cycle behind its neighbour.
    anim(g, t) {
      if (!g || g > 6) return 1;
      const f = (t * 0.7 + ((g - 1) >> 1) * 0.33) % 1;
      return (g - 1) & 1 ? (f > 0.25 && f < 0.9 ? 1 : 0) : f < 0.65 ? 1 : 0;
    },
  },
  {
    // The pharmacy cross: an outline round a solid cross.
    w: 24, h: 24,
    draw(T) {
      T(0, 0, 1, [7.5, 0.5, 16.5, 0.5, 16.5, 7.5, 23.5, 7.5, 23.5, 16.5, 16.5, 16.5, 16.5, 23.5, 7.5, 23.5, 7.5, 16.5, 0.5, 16.5, 0.5, 7.5, 7.5, 7.5]);
      T(1, 1, 0, [12, 4.5, 12, 19.5], 1.5);
      T(1, 1, 0, [4.5, 12, 19.5, 12], 1.5);
    },
    // The inside alone, the outline alone, then both, every 2.6 s.
    anim(g, t) {
      const c = t % 2.6;
      return g ? (c < 0.35 || c > 0.7 ? 1 : 0) : c < 0.35 ? 0 : 1;
    },
  },
  {
    // Two beamed quavers and the sound they make: the karaoke rooms upstairs.
    w: 32, h: 26,
    draw(T) {
      T(0, 0, 1, arc(4, 21.5, 2.2, 1.3, 0, 360), 1.15);
      T(0, 0, 1, arc(16, 18.5, 2.2, 1.3, 0, 360), 1.15);
      T(0, 0, 0, [6.4, 21, 6.4, 4]);
      T(0, 0, 0, [18.4, 18, 18.4, 1]);
      T(0, 0, 0, [6.4, 4, 18.4, 1], 1.5);
      T(0, 0, 0, [6.4, 8.5, 18.4, 5.5]);
      for (let k = 0; k < 3; k++) T(1 + k, 1, 0, arc(21, 12, 3.5 + k * 3.2, 3.5 + k * 3.2, -40, 40), 0.95);
    },
    // The sound waves light outward and go out together.
    anim(g, t) {
      const f = (t * 0.8) % 1;
      return !g || (f >= (g - 1) * 0.18 && f < 0.86) ? 1 : 0;
    },
  },
  {
    // A molar with a sparkle: the dentist on the third floor.
    w: 30, h: 24,
    draw(T) {
      T(0, 0, 1, [...arc(6.5, 6, 4.5, 4.5, 180, 300), 11, 4, ...arc(15.5, 6, 4.5, 4.5, 240, 360), 19.5, 12, 17.5, 22.5, 15, 22.5, 13, 15.5, 9, 15.5, 7, 22.5, 4.5, 22.5, 2.5, 12]);
      T(1, 1, 0, [25.5, 0.8, 25.5, 8.2], 0.9);
      T(1, 1, 0, [21.8, 4.5, 29.2, 4.5], 0.9);
    },
    anim: (g, t) => (g && t % 2.2 > 1.2 ? 0 : 1),
  },
  {
    // An eye with lashes whose iris looks about: the fortune teller.
    w: 30, h: 22,
    draw(T) {
      const up = (x) => 13 - 9 * (1 - ((x - 15) / 14.5) ** 2);
      const lid = [];
      for (let i = 0; i <= 20; i++) lid.push(0.5 + i * 1.45, up(0.5 + i * 1.45));
      for (let i = 19; i > 0; i--) lid.push(0.5 + i * 1.45, 13 + 7 * (1 - ((i * 1.45 - 14.5) / 14.5) ** 2));
      T(0, 0, 1, lid);
      T(0, 0, 0, [7.5, up(7.5), 5.6, 2.4], 0.9);
      T(0, 0, 0, [15, up(15), 15, 0.6], 0.9);
      T(0, 0, 0, [22.5, up(22.5), 24.4, 2.4], 0.9);
      for (let k = 0; k < 3; k++) {
        T(1 + k, 1, 1, arc(11 + 4 * k, 12.6, 3.2, 3.2, 0, 360));
        T(1 + k, 2, 0, [11 + 4 * k, 12.6], 1);
      }
    },
    // Ahead 2 s, left, ahead, right, ahead; the lids blink every 4.7 s.
    anim(g, t) {
      if (!g) return t % 4.7 < 0.12 ? 0 : 1;
      const c = t % 5;
      return g === (c < 2 ? 2 : c < 3 ? 1 : c < 3.5 ? 2 : c < 4.5 ? 3 : 2) ? 1 : 0;
    },
  },
  {
    // Scissors that snip: the hair salon.
    w: 24, h: 27,
    draw(T) {
      T(0, 0, 1, arc(6, 22.5, 3.4, 3.4, 0, 360));
      T(0, 0, 1, arc(18, 22.5, 3.4, 3.4, 0, 360));
      T(1, 1, 0, [8.6, 19.8, 19.5, 1], 1);
      T(1, 1, 0, [15.4, 19.8, 4.5, 1], 1);
      T(2, 1, 0, [8.6, 19.8, 14, 0.8], 1);
      T(2, 1, 0, [15.4, 19.8, 10, 0.8], 1);
    },
    // Snip, snip, then hold open.
    anim(g, t) {
      const c = t % 2.4;
      return !g || (g === 2) === (c < 0.2 || (c > 0.45 && c < 0.65)) ? 1 : 0;
    },
  },
  {
    // A beer mug with a head of foam and rising bubbles: the hof downstairs.
    w: 26, h: 28,
    draw(T) {
      T(0, 0, 1, [2.5, 7, 2.5, 26.5, 18.5, 26.5, 18.5, 7]);
      T(0, 0, 0, arc(18.5, 15.5, 5.5, 5.5, -70, 70));
      T(1, 1, 0, [...arc(4.5, 5.5, 3.5, 3.5, 150, 320), ...arc(10.5, 4, 3.5, 3.5, 210, 330), ...arc(16.5, 5.5, 3.5, 3.5, 220, 390)]);
      for (let k = 0; k < 3; k++) T(2 + k, 2, 0, [7 + (k & 1) * 6, 22 - k * 5], 1);
    },
    // Bubbles rise from the bottom of the glass, one after another.
    anim(g, t) {
      return g < 2 || ((t * 1.2) % 1) * 4 > g - 2 ? 1 : 0;
    },
  },
];

// Puddles on the asphalt: centre column, row below the kerb, half width.
const PUDDLES = [[10, 4, 9], [36, 6, 12], [58, 3, 7], [22, 11, 7], [52, 11, 8]];

// Slots [x, y, w, h, kind] on the wall above the street: f a pictogram hung
// bare, b in a rounded box, r in a ring, w a pictogram led to by chevrons, s an
// arrow strip in a marquee frame, v a blade sign whose arrow points down the
// basement stairs. Each layout also comes mirrored.
const TEMPLATES = [
  [[0, 0, 64, 33, "f"], [1, 36, 17, 51, "v"], [20, 36, 43, 29, "b"], [20, 67, 43, 21, "f"], [1, 90, 62, 25, "w"]],
  [[1, 1, 30, 31, "b"], [33, 1, 30, 31, "r"], [0, 35, 64, 33, "f"], [1, 71, 43, 26, "b"], [46, 71, 17, 44, "v"], [1, 100, 43, 15, "s"]],
  [[1, 1, 17, 56, "v"], [20, 1, 43, 28, "b"], [20, 31, 43, 26, "f"], [1, 60, 62, 25, "w"], [0, 88, 64, 27, "f"]],
];

function stroke(S, id, pts, closed, r) {
  const n = pts.length >> 1;
  const R = r + REACH;
  for (let s = 0; s < (n < 2 ? 1 : closed ? n : n - 1); s++) {
    const ax = pts[2 * s];
    const ay = pts[2 * s + 1];
    const j = n < 2 ? s : (s + 1) % n;
    const dx = pts[2 * j] - ax;
    const dy = pts[2 * j + 1] - ay;
    const L2 = dx * dx + dy * dy;
    const y1 = Math.min(STREET - 1, Math.ceil(Math.max(ay, ay + dy) + R));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, ax + dx) + R));
    for (let y = Math.max(0, Math.floor(Math.min(ay, ay + dy) - R)); y <= y1; y++)
      for (let x = Math.max(0, Math.floor(Math.min(ax, ax + dx) - R)); x <= x1; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const u = L2 > 0 ? Math.min(1, Math.max(0, (px * dx + py * dy) / L2)) : 0;
        const g = Math.hypot(px - u * dx, py - u * dy) - r;
        const p = y * W + x;
        if (g < S.gap[p]) {
          S.gap[p] = g;
          S.own[p] = id;
        }
      }
  }
}

// kind 0 follows the pictogram's anim, 1 is chevron k of n in a chase, 2 is
// steady, 3 is a marquee dash.
function tube(S, sg, hue, kind, k, n, order, r, closed, pts) {
  S.tubes.push({ s: sg.i, hue, kind, k, n, order });
  stroke(S, S.tubes.length - 1, pts, closed, r);
}

// Chevrons pointing dir (1 right, -1 left, 0 down) across a box; the chase
// runs toward the point.
function chevrons(S, sg, hue, x0, y0, w, h, dir) {
  const across = dir ? w : h;
  const d = (dir ? h : w) * 0.36;
  const step = d + 3.4;
  const n = Math.max(2, Math.floor((across - d) / step) + 1);
  const o = (across - d - (n - 1) * step) / 2;
  for (let k = 0; k < n; k++) {
    const c = o + k * step;
    const pts = dir
      ? [x0 + c + (dir < 0 ? d : 0), y0, x0 + c + (dir < 0 ? 0 : d), y0 + h / 2, x0 + c + (dir < 0 ? d : 0), y0 + h]
      : [x0, y0 + c, x0 + w / 2, y0 + c + d, x0 + w, y0 + c];
    tube(S, sg, hue, 1, dir < 0 ? n - 1 - k : k, n, 1 + k, 1.05, 0, pts);
  }
}

// Hang a pictogram not hung yet, the bigger it fits the likelier, or the one
// that fits best if none fits at 0.8; returns its width.
function hang(S, sg, left, bx, by, bw, bh, cap, rnd, align, mw = bw) {
  let best = -1;
  let score = -1e9;
  for (const i of left) {
    const s = Math.min(cap, mw / ICONS[i].w, bh / ICONS[i].h);
    const v = s >= 0.8 ? 10 + s + rnd() * 1.5 : s * 4 + rnd();
    if (v > score) [score, best] = [v, i];
  }
  left.splice(left.indexOf(best), 1);
  const ic = ICONS[best];
  const s = Math.min(cap, mw / ic.w, bh / ic.h);
  const x = bx + (align < 0 ? 0 : align > 0 ? bw - ic.w * s : (bw - ic.w * s) / 2);
  const y = by + (bh - ic.h * s) / 2;
  sg.icon = best;
  ic.draw((g, role, closed, pts, r = 1.05) => tube(S, sg, sg.hues[1 + role], 0, g, 0, 1 + sg.count++, s > 1.2 ? r * 1.25 : r, closed, pts.map((v, i) => (i & 1 ? y : x) + v * s)));
  return ic.w * s;
}

function build(S, seed) {
  const rnd = rng(seed * 7919 + 13);
  S.own.fill(-1);
  S.gap.fill(99);
  S.tubes = [];
  S.signs = [];
  const tpl = TEMPLATES[Math.floor(rnd() * TEMPLATES.length)];
  const flip = rnd() < 0.5;
  const left = shuffle([...ICONS.keys()], rnd);
  const schemes = shuffle([...SCHEMES.keys()], rnd);
  const frames = [];
  // Arrow strips point at the blade.
  let toward = 1;
  for (const s of tpl) if (s[4] === "v") toward = (flip ? W - s[0] - s[2] : s[0]) < W / 2 ? -1 : 1;
  tpl.forEach(([sx, y, w, h, kind], i) => {
    const x = flip ? W - sx - w : sx;
    const hues = SCHEMES[schemes[i]];
    const r = rnd();
    const sg = { i, hues, icon: -1, count: 0, prog: r < 0.6 ? 1 : 2, busy: rnd(), hold: 0.6 + rnd() * 0.8, ph: rnd() * 11, ign: 0 };
    S.signs.push(sg);
    const frame = (inset, k, hue, c) => frames.push([sg, hue, k, rrect(x + inset, y + inset, w - 2 * inset, h - 2 * inset, c), inset > 2 ? 1 : 0, 2 * (w + h - 4 * inset)]);
    if (kind === "v" || kind === "s") {
      sg.prog = 0;
      frame(1.5, kind === "s" ? 3 : 2, hues[0], 3);
      if (kind === "v") chevrons(S, sg, hues[1], x + 4, y + 6, w - 8, h - 12, 0);
      else chevrons(S, sg, hues[3], x + 6, y + 4.5, w - 12, h - 9, toward);
    } else if (kind === "w") {
      const side = rnd() < 0.5 ? -1 : 1;
      const iw = hang(S, sg, left, x + 6, y + 4.5, w - 12, h - 9, 1.35, rnd, side, w * 0.55);
      const ch = Math.min(14, h - 12);
      const a = side > 0 ? x + 6 : x + 9 + iw;
      chevrons(S, sg, hues[2], a, y + (h - ch) / 2, w - 15 - iw, ch, side);
      frame(1.5, 2, hues[0], 4);
    } else {
      const inset = kind === "f" ? 1 : kind === "r" ? Math.min(w, h) * 0.15 + 1.5 : 5;
      hang(S, sg, left, x + inset, y + inset, w - 2 * inset, h - 2 * inset, kind === "f" ? 1.6 : 1.35, rnd, 0);
      if (kind === "b") frame(1.5, 2, hues[0], 4);
      if (kind === "r") frames.push([sg, hues[0], 2, arc(x + w / 2, y + h / 2, w / 2 - 1.5, h / 2 - 1.5, 0, 360), 0, 1.6 * (w + h)]);
    }
  });
  // Count what pictograms and arrows already light, then hang the frames in a
  // shuffled order while the wall has budget for them.
  let lit = 0;
  for (let p = 0; p < STREET * W; p++) if (S.gap[p] <= 0) lit++;
  for (const [sg, hue, k, pts, order, perim] of shuffle(frames, rnd)) {
    const est = perim * 2.1 * (k === 3 ? 0.62 : 1);
    if (lit + est > BUDGET) continue;
    lit += est;
    if (k === 3) dashes(pts).forEach((d, j) => tube(S, sg, hue, 3, j % 3, 3, order, 1.05, 0, d));
    else tube(S, sg, hue, 2, 0, 0, order, 1.05, 1, pts);
  }
  const nt = S.tubes.length;
  S.tb = new Float32Array(nt);
  S.rgb = new Float32Array(nt * 3);
  S.fm = new Uint8Array(nt);
  S.ft = new Float32Array(nt);
  S.fv = new Float32Array(nt).fill(1);
  // Rank the tubes for wear: low ranks tire first, high ranks die first, and
  // a long tube is likelier to die. Rank 0, the tube that always buzzes, is
  // the longest frame.
  const size = new Float32Array(nt);
  for (let p = 0; p < STREET * W; p++) if (S.gap[p] <= 0) size[S.own[p]]++;
  const key = [...size].map((v) => rnd() * Math.sqrt(v));
  const order = [...Array(nt).keys()].sort((a, b) => key[a] - key[b]);
  let tired = order[0];
  for (let i = 0; i < nt; i++) if (S.tubes[i].kind === 2 && size[i] > size[tired]) tired = i;
  order.splice(order.indexOf(tired), 1);
  order.unshift(tired);
  order.forEach((t, rank) => (S.tubes[t].rank = rank));
}

function hsv(h, out, o) {
  h = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(h);
  const up = 255 * (h - i);
  const down = 255 - up;
  out[o] = [255, down, 0, 0, up, 255][i];
  out[o + 1] = [up, 255, 255, down, 0, 0][i];
  out[o + 2] = [0, 0, up, 255, 255, down][i];
}

// The controller over a whole sign: a sequence that blacks the sign out and
// lights it tube by tube, then holds, or a double blink, then holds. The
// hold shrinks as Pace rises, and a sign runs its show at all only when the
// night is busy enough for it; otherwise it stays lit.
function signOn(sg, order, t, show, hold) {
  if (!sg.prog || sg.busy >= show) return 1;
  const c = (t + sg.ph) % ((sg.prog === 1 ? 0.6 + sg.count * 0.2 : 0.45) + sg.hold * hold);
  if (sg.prog === 1) return c >= 0.6 + order * 0.2;
  return !(c < 0.15 || (c > 0.3 && c < 0.45));
}

function tubeOn(sg, tb, t) {
  if (tb.kind === 0) return ICONS[sg.icon].anim(tb.k, t + sg.ph);
  if (tb.kind === 1) return (((t * 1.1 - tb.k / tb.n) % 1) + 1) % 1 < 0.55 ? 1 : 0;
  if (tb.kind === 3) return (Math.floor(t * 4) + tb.k) % 3 ? 1 : 0;
  return 1;
}

// A tired tube: steady stretches, then a buzz of random stutter or a dropout.
// As wear rises the stretches shorten and the steady glow sinks.
function flicker(S, i, dt, wear) {
  if ((S.ft[i] -= dt) <= 0) {
    const steady = S.fm[i] === 0;
    S.fm[i] = steady ? (Math.random() < 0.7 ? 1 : 2) : 0;
    S.ft[i] = !steady ? (0.6 + Math.random() * 3) / (0.6 + wear * 3) : S.fm[i] === 1 ? 0.25 + Math.random() * 0.8 : 0.08 + Math.random() * 0.4;
  }
  if (S.fm[i] === 1) {
    if (Math.random() < 0.45) S.fv[i] = Math.random() < 0.5 ? 1 : 0.15 + Math.random() * 0.35;
    return S.fv[i];
  }
  return S.fm[i] === 2 ? 0 : 1 - wear * 0.3;
}

export function setup(params) {
  Object.assign(params, { own: new Int16Array(N), gap: new Float32Array(N), buf: new Uint8ClampedArray(N * 3), tubes: null, t: 0, clk: 0, cut: -1, hue: 0, rain: 0.06, drops: [] });
  params.seed = 5;
  for (let i = 0; i < 300; i++) params.drops.push({ x: Math.random() * (W + 12) - 6, y: Math.random() * H, v: 70 + Math.random() * 50, n: 4 + Math.floor(Math.random() * 5) });
}

export function update(dt, input, params) {
  const S = params;
  dt = Math.min(Math.max(dt || 0, 0), 0.1);
  const k = input.knobValues || [];
  const wear = k[2] ?? 0;
  S.hue = (k[0] ?? 0) * 360;
  S.rain = k[3] ?? 0.06;
  const pr = input.btnPressed || [];
  if (!S.tubes || pr[1]) {
    if (S.tubes) S.seed++;
    build(S, S.seed);
  }
  if (pr[0]) {
    // Power cut: the signs strike again in a shuffled order, half a second apart.
    S.cut = 0;
    shuffle(S.signs.map((s, i) => i), Math.random).forEach((si, n) => (S.signs[si].ign = 1.2 + n * 0.5 + Math.random() * 0.2));
  }
  S.t += dt;
  const pace = k[1] ?? 2;
  const show = pace / 3.6;
  S.clk += dt * pace;
  if (S.cut >= 0 && (S.cut += dt) > Math.max(...S.signs.map((s) => s.ign)) + 0.8) S.cut = -1;
  const T = S.tubes;
  const nt = T.length;
  const tired = 1 + Math.floor(wear * 0.45 * nt);
  const dead = Math.floor(wear * 0.3 * nt);
  for (let i = 0; i < nt; i++) {
    const tb = T[i];
    const sg = S.signs[tb.s];
    let on = signOn(sg, tb.order, S.clk, show, 12 / Math.max(0.1, pace * pace)) ? tubeOn(sg, tb, S.clk) : 0;
    if (tb.rank < tired) on *= flicker(S, i, dt, wear);
    if (tb.rank >= nt - dead) on = 0;
    if (S.cut >= 0) {
      // A transformer strikes over 0.7 s, the tube catching more often as it warms.
      const u = (S.cut - sg.ign) / 0.7;
      on *= u < 0 ? 0 : u >= 1 || Math.random() < 0.2 + 0.8 * u ? 1 : 0;
    }
    S.tb[i] = on;
    hsv(tb.hue + S.hue, S.rgb, i * 3);
  }
  const n = Math.round(S.rain * S.drops.length);
  for (let i = 0; i < n; i++) {
    const d = S.drops[i];
    d.y += d.v * dt;
    d.x += d.v * dt * 0.1;
    if (d.y - d.n > H) {
      d.y = -Math.random() * 20;
      d.x = Math.random() * (W + 12) - 12;
    }
  }
}

export function draw(display, params) {
  const S = params;
  if (!S.tubes) return;
  const { buf, rgb } = S;
  buf.fill(0);
  // Rain hazes the air: the glow reaches further and brightens past the 24/255
  // the wall otherwise stays under.
  const haze = Math.max(0, S.rain - 0.1);
  const reach = GLOW + haze * 3.5;
  const glow = (20 + haze * 110) / 255;
  for (let p = 0; p < STREET * W; p++) {
    const o = S.own[p];
    const g = S.gap[p];
    if (o < 0 || g >= reach) continue;
    const b = S.tb[o];
    // An unlit tube is still glass: its own colour at 14/255.
    const f = 1 - g / reach;
    const lv = g <= 0 ? Math.max(b, 0.055) : glow * f * f * b;
    for (let c = 0; c < 3; c++) buf[p * 3 + c] = rgb[o * 3 + c] * lv;
  }
  // The street mirrors the bottom of the wall, shivering. Asphalt gives back
  // next to nothing; the puddles, low ellipses in the view, give back half
  // and spread as the rain comes on.
  const grow = 0.85 + S.rain;
  for (let d = 0; d < H - STREET; d++) {
    const ys = STREET - 1 - d;
    for (let x = 0; x < W; x++) {
      let wet = 0;
      for (const [cx, cd, rx] of PUDDLES) wet = Math.max(wet, (1 - ((x - cx) / (rx * grow)) ** 2 - ((d - cd) / (rx * grow * 0.36)) ** 2) * 3);
      const lv = (0.04 + 0.56 * Math.min(1, wet)) * (1 - d / 24);
      const xs = x + Math.round(Math.sin(d * 1.3 + S.t * 3) * (0.6 + S.rain));
      if (xs < 0 || xs >= W) continue;
      const q = (ys * W + xs) * 3;
      const p = ((STREET + d) * W + x) * 3;
      for (let c = 0; c < 3; c++) buf[p + c] = buf[q + c] * lv;
    }
  }
  // Rain shows only where a tube lights it, in that tube's colour.
  const n = Math.round(S.rain * S.drops.length);
  for (let i = 0; i < n; i++) {
    const dr = S.drops[i];
    for (let j = 0; j < dr.n; j++) {
      const y = Math.floor(dr.y) - j;
      const x = Math.floor(dr.x - j * 0.1);
      if (y < 0 || y >= H || x < 0 || x >= W) continue;
      const p = y * W + x;
      const fade = 1 - (j / dr.n) * 0.6;
      if (y >= STREET) {
        for (let c = 0; c < 3; c++) buf[p * 3 + c] *= 1.8;
        continue;
      }
      const o = S.own[p];
      const g = S.gap[p];
      if (o < 0 || g <= 0) continue;
      const lv = (0.9 - (0.7 * g) / REACH) * S.tb[o] * fade;
      for (let c = 0; c < 3; c++) buf[p * 3 + c] = Math.max(buf[p * 3 + c], rgb[o * 3 + c] * lv);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      if (buf[p] | buf[p + 1] | buf[p + 2]) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
    }
}
