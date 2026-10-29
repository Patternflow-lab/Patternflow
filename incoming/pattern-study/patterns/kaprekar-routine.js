// ===== Patternflow pattern =====
// Title:   Kaprekar's Routine
// Family:  type
// Idea:    A worksheet of Kaprekar's routine runs down the panel in large drawn digits: the digits of a number fly one by one, largest first, into descending order on the line below, that row turns half round like a carousel into ascending order under it, the two are subtracted column by column from the right with the borrows marked, and the difference becomes the next line, until 6174 comes back and the two 6174s light up gold.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kaprekar's routine and the constant 6174 (D. R. Kaprekar, 1949), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Digits=4..7, Start=0..1
//
// Knob 1: Hue. Turns the digits round the wheel. Each digit value keeps its own colour, so a digit can be followed as it moves: at 0 a 0 is cyan, a 9 violet and the rest between; the number the routine comes back to is always gold.
// Knob 2: Speed. At 2 the start is written in 1.5 s and the first step takes 4.7 s (the sort 1.2 s, the turn 0.9 s, the rule 0.3 s, four columns of 0.45 s and a pause), each later step 0.86 times the one before, down to half. A seven-step start has 6174 on the sheet at 23.8 s and finds it again at 26.1 s; the pair glows 3.5 s, the sheet slides away and a new start comes at 30.5 s. At 0.2 ten times slower; at 3 one and a half times faster.
// Knob 3: Digits. 4: all 9990 starts from 0000 to 9999 whose digits are not all the same reach 6174 within 7 steps. 5: no number stays; every start falls within 6 steps into the 2-cycle 53955, 59994 (3190 starts) or one of the 4-cycles 61974, 82962, 75933, 63954 (48,480) and 62964, 71973, 83952, 74943 (48,320). 6: 549945 (1950 starts) and 631764 (62,520) stay put, and the rest fall into the 7-cycle 840852, 860832, 862632, 642654, 420876, 851742, 750843, within 13 steps. 7: all 9,999,990 starts fall into one 8-cycle through 7509843, within 13 steps. A sheet stops when a number comes back, and with a cycle every line of the loop lights up.
// Knob 4: Start. Which starts the sheet takes, by the steps they need: at 0 the farthest (7 steps for 4 digits, 6 for 5, 13 for 6 and 7), at 1 the nearest, one step. Each start is a random arrangement of a random digit multiset that needs that many. At 0 with 4 digits the 2184 seven-step starts leave only 8 different numbers after their first subtraction, and those run into three tails, so the sheet keeps ending in the same lines: 8172, 7443, 3996, 6264, 4176 or 7992, 7173, 6354, 3087, 8352 or 5994, 5355, 1998, 8082, 8532.
// Buttons: K1 tap starts a new sheet.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, PI, random, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The digits, drawn as strokes on a 10 x 16 grid with the pen's centre kept
// inside 1..9 and 1..15: L for a line, A for an arc (centre, radius, start
// and end angle in degrees, y pointing down, so the angle grows clockwise).
const STROKES = [
  [["A", 5, 5, 4, 180, 360], ["L", 9, 5, 9, 11], ["A", 5, 11, 4, 0, 180], ["L", 1, 11, 1, 5]],
  [["L", 5.6, 1, 5.6, 15], ["L", 5.6, 1, 2.2, 4.4]],
  [["A", 5, 5, 4, 180, 390], ["L", 8.46, 7, 1, 15], ["L", 1, 15, 9, 15]],
  [["A", 5, 4.5, 3.5, 195, 450], ["A", 5, 11.5, 3.6, 270, 525], ["L", 3.2, 8, 5, 8]],
  [["L", 7, 15, 7, 1], ["L", 7, 1, 1, 11], ["L", 1, 11, 9.4, 11]],
  [["L", 8.8, 1, 2.3, 1], ["L", 2.3, 1, 2.03, 7.53], ["A", 5, 10.5, 4.2, 225, 500]],
  [["A", 5, 10.8, 4, 0, 360], ["A", 9.5, 10.8, 8.5, 180, 258]],
  [["L", 1, 1, 9, 1], ["L", 9, 1, 3.6, 15]],
  [["A", 5, 4.6, 3.4, 0, 360], ["A", 5, 11.2, 3.8, 0, 360]],
  [["A", 5, 5.2, 4, 0, 360], ["A", 0.5, 5.2, 8.5, 0, 78]],
];

// Layout for 4 to 7 digits: the left margin that holds the minus sign and the
// step count, the glyph's width and height, the pen, and the gap between lines.
const LAYOUT = {
  4: { margin: 8, gw: 12, gh: 19, pen: 2.4, gap: 5 },
  5: { margin: 9, gw: 9, gh: 14, pen: 1.9, gap: 5 },
  6: { margin: 7, gw: 8, gh: 12, pen: 1.6, gap: 4 },
  7: { margin: 7, gw: 7, gh: 10, pen: 1.35, gap: 4 },
};
const MAX_STEPS = { 4: 7, 5: 6, 6: 13, 7: 13 };

// Beats of each phase at Speed 2, in seconds.
const T_INTRO = 0.25, T_SLIDE = 0.3, T_FLIP = 0.9, T_RULE = 0.3, T_COL = 0.45, T_SETTLE = 0.45, T_FINAL = 3.5, T_OUT = 0.9;

function segments(strokes) {
  const out = [];
  for (const s of strokes) {
    if (s[0] === "L") out.push([s[1], s[2], s[3], s[4]]);
    else {
      const [, cx, cy, r, a0, a1] = s, n = max(2, Math.ceil(abs(a1 - a0) / 8));
      for (let i = 0; i < n; i++) {
        const b0 = ((a0 + ((a1 - a0) * i) / n) * PI) / 180, b1 = ((a0 + ((a1 - a0) * (i + 1)) / n) * PI) / 180;
        out.push([cx + r * cos(b0), cy + r * sin(b0), cx + r * cos(b1), cy + r * sin(b1)]);
      }
    }
  }
  return out;
}

function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy;
  const t = l > 0 ? cl(((px - x0) * dx + (py - y0) * dy) / l, 0, 1) : 0;
  const ex = x0 + t * dx - px, ey = y0 + t * dy - py;
  return sqrt(ex * ex + ey * ey);
}

// Renders the ten digits at one size: 4 x 4 samples a pixel, a sample lit
// when it lies within half the pen of a stroke.
function renderGlyphs(L) {
  const { gw, gh, pen } = L, sx = (gw - pen) / 8, sy = (gh - pen) / 14, hw = pen / 2;
  const glyphs = [];
  for (let d = 0; d < 10; d++) {
    const segs = segments(STROKES[d]).map(([a, b, c, e]) => [hw + (a - 1) * sx, hw + (b - 1) * sy, hw + (c - 1) * sx, hw + (e - 1) * sy]);
    const g = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        let hit = 0;
        for (let j = 0; j < 4; j++)
          for (let i = 0; i < 4; i++) {
            const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4;
            for (const s of segs)
              if (segDist(px, py, s[0], s[1], s[2], s[3]) <= hw) {
                hit++;
                break;
              }
          }
        g[y * gw + x] = hit / 16;
      }
    glyphs.push(g);
  }
  return glyphs;
}

const toDigits = (v, n) => {
  const d = new Int8Array(n);
  for (let i = n - 1; i >= 0; i--, v = floor(v / 10)) d[i] = v % 10;
  return d;
};
const toValue = (d) => {
  let v = 0;
  for (let i = 0; i < d.length; i++) v = v * 10 + d[i];
  return v;
};
function kStep(v, n) {
  const d = Array.from(toDigits(v, n)).sort((a, b) => a - b);
  let asc = 0, desc = 0;
  for (let i = 0; i < n; i++) {
    asc = asc * 10 + d[i];
    desc = desc * 10 + d[n - 1 - i];
  }
  return desc - asc;
}

// Every multiset of n digits, not all the same, grouped by how many steps a
// number made of it takes to reach the fixed point or the cycle.
function classify(n) {
  const cache = new Map();
  const enter = (y) => {
    const path = [], seen = new Set();
    let z = y;
    while (!seen.has(z) && !cache.has(z)) {
      seen.add(z);
      path.push(z);
      z = kStep(z, n);
    }
    if (!cache.has(z)) {
      let c = z;
      do {
        cache.set(c, 0);
        c = kStep(c, n);
      } while (c !== z);
    }
    for (let i = path.length - 1; i >= 0; i--) if (!cache.has(path[i])) cache.set(path[i], cache.get(kStep(path[i], n)) + 1);
    return cache.get(y);
  };
  const by = [];
  const digits = [];
  const rec = (pos, lo) => {
    if (pos === n) {
      if (digits[0] === digits[n - 1]) return;
      let asc = 0, desc = 0;
      for (let i = 0; i < n; i++) {
        asc = asc * 10 + digits[i];
        desc = desc * 10 + digits[n - 1 - i];
      }
      const e = enter(desc - asc) + 1;
      (by[e] || (by[e] = [])).push(digits.slice());
      return;
    }
    for (let d = lo; d <= 9; d++) {
      digits.push(d);
      rec(pos + 1, d);
      digits.pop();
    }
  };
  rec(0, 0);
  return by;
}

export function setup(params) {
  params.s = {
    n: 0, L: null, glyphs: null, fonts: {}, cell: 0, classes: {}, target: -1,
    lines: [], phase: "intro", t: 0, k: 0, cam: 0, glow: [],
    buf: new Float32Array(W * H * 3), hue: 0, speed: 2, c: [0, 0, 0], gold: [0, 0, 0],
  };
}

function slotX(S, j) {
  return round(S.L.margin + j * S.cell + (S.cell - S.L.gw) / 2);
}

function pickStart(S) {
  const n = S.n, by = S.classes[n] || (S.classes[n] = classify(n));
  let t = S.target;
  while (t > 1 && !by[t]) t--;
  const pool = by[t], ms = pool[floor(random() * pool.length)].slice();
  // A random arrangement of the multiset, not starting with 0 if it can help it.
  for (let tries = 0; tries < 8; tries++) {
    for (let i = n - 1; i > 0; i--) {
      const j = floor(random() * (i + 1)), x = ms[i];
      ms[i] = ms[j];
      ms[j] = x;
    }
    if (ms[0] !== 0) break;
  }
  return Int8Array.from(ms);
}

function newSheet(S) {
  const L = LAYOUT[S.n];
  S.L = L;
  S.cell = (W - L.margin) / S.n;
  S.glyphs = S.fonts[S.n] || (S.fonts[S.n] = renderGlyphs(L));
  S.pitch = L.gh + L.gap;
  const dig = pickStart(S);
  S.lines = [{ kind: "N", dig, y: 4, value: toValue(dig), step: 0 }];
  S.phase = "intro";
  S.t = 0;
  S.k = 0;
  S.cam = 0;
  S.glow = [];
}

const last = (S) => S.lines[S.lines.length - 1];

// The next step's three lines: the digits sorted down, the same flipped, and
// the difference with the borrows it needs.
function beginStep(S) {
  const n = S.n, top = last(S), src = top.dig;
  const order = Array.from(src, (d, i) => [d, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const D = Int8Array.from(order, (o) => o[0]);
  const A = Int8Array.from(D).reverse();
  const R = new Int8Array(n), dots = new Uint8Array(n), ticks = new Uint8Array(n);
  let borrow = 0;
  for (let j = n - 1; j >= 0; j--) {
    let v = D[j] - borrow - A[j];
    if (v < 0) {
      v += 10;
      ticks[j] = 1;
      if (j > 0) dots[j - 1] = 1;
      borrow = 1;
    } else borrow = 0;
    R[j] = v;
  }
  const p = S.pitch, y = top.y;
  S.k++;
  S.lines.push({ kind: "D", dig: D, y: y + p, from: order.map((o) => o[1]), dots, ticks });
  S.lines.push({ kind: "A", dig: A, y: y + 2 * p });
  S.lines.push({ kind: "R", dig: R, y: y + 3 * p + 3, value: toValue(R), step: S.k });
  S.phase = "slide";
  S.t = 0;
}

const pace = (S) => max(0.5, Math.pow(0.86, S.k - 1));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  const n = cl(round(kv[2]), 4, 7), maxT = MAX_STEPS[n];
  const target = maxT - round(cl(kv[3], 0, 1) * (maxT - 1));
  if (n !== S.n || target !== S.target) {
    S.n = n;
    S.target = target;
    newSheet(S);
  }
  if (input.btnPressed && input.btnPressed[0]) newSheet(S);
  let r = (d * S.speed) / 2;
  // Phases run on beats; one frame can cross several short ones.
  for (let guard = 0; guard < 6 && r > 0; guard++) {
    const f = S.phase === "intro" || S.phase === "final" || S.phase === "out" ? 1 : pace(S);
    const dur =
      S.phase === "intro" ? T_INTRO * S.n + 0.5 :
      S.phase === "slide" ? T_SLIDE * S.n * f :
      S.phase === "flip" ? T_FLIP * f :
      S.phase === "rule" ? T_RULE * f :
      S.phase === "sub" ? T_COL * S.n * f :
      S.phase === "settle" ? T_SETTLE * f :
      S.phase === "final" ? T_FINAL : T_OUT;
    const used = min(r, dur - S.t);
    S.t += used;
    r -= used;
    if (S.t < dur - 1e-9) break;
    S.t = 0;
    if (S.phase === "intro") beginStep(S);
    else if (S.phase === "slide") S.phase = "flip";
    else if (S.phase === "flip") S.phase = "rule";
    else if (S.phase === "rule") S.phase = "sub";
    else if (S.phase === "sub") S.phase = "settle";
    else if (S.phase === "settle") {
      const R = last(S);
      let hit = -1;
      for (let i = 0; i < S.lines.length - 1; i++) if ((S.lines[i].kind === "N" || S.lines[i].kind === "R") && S.lines[i].value === R.value) hit = i;
      if (hit >= 0) {
        S.glow = [];
        for (let i = hit; i < S.lines.length; i++) if (S.lines[i].kind === "N" || S.lines[i].kind === "R") S.glow.push(i);
        S.phase = "final";
      } else beginStep(S);
    } else if (S.phase === "final") S.phase = "out";
    else newSheet(S);
  }
  // The view follows the lowest line being written.
  const L = S.L, bottom = last(S).y + L.gh + 3;
  const want = max(0, bottom - (H - 6));
  S.cam += (want - S.cam) * (1 - exp(-d * 5));
}

function blit(S, d, x0, y0, rgb) {
  const { gw, gh } = S.L, g = S.glyphs[d], buf = S.buf;
  const xi = round(x0), yi = round(y0);
  for (let y = 0; y < gh; y++) {
    const yy = yi + y;
    if (yy < 0 || yy >= H) continue;
    for (let x = 0; x < gw; x++) {
      const v = g[y * gw + x], xx = xi + x;
      if (v <= 0 || xx < 0 || xx >= W) continue;
      const o = (yy * W + xx) * 3;
      buf[o] = max(buf[o], rgb[0] * v);
      buf[o + 1] = max(buf[o + 1], rgb[1] * v);
      buf[o + 2] = max(buf[o + 2], rgb[2] * v);
    }
  }
}

function rect(S, x0, y0, w, h, r, g, b) {
  for (let y = round(y0); y < round(y0) + h; y++)
    for (let x = round(x0); x < round(x0) + w; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const o = (y * W + x) * 3;
      S.buf[o] = max(S.buf[o], r);
      S.buf[o + 1] = max(S.buf[o + 1], g);
      S.buf[o + 2] = max(S.buf[o + 2], b);
    }
}

const SMALL = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
function small(S, v, x0, y0, g) {
  const s = String(v);
  for (let i = 0; i < s.length; i++) {
    const b = SMALL[s.charCodeAt(i) - 48];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (b[r * 3 + q] === "1") rect(S, x0 + 4 * i + q, y0 + r, 1, 1, g, g, g + 12);
  }
}

// Alpha over: a glyph in flight covers what it passes.
function blitOver(S, d, x0, y0, rgb) {
  const { gw, gh } = S.L, g = S.glyphs[d], buf = S.buf;
  const xi = round(x0), yi = round(y0);
  for (let y = 0; y < gh; y++) {
    const yy = yi + y;
    if (yy < 0 || yy >= H) continue;
    for (let x = 0; x < gw; x++) {
      const a = g[y * gw + x], xx = xi + x;
      if (a <= 0 || xx < 0 || xx >= W) continue;
      const o = (yy * W + xx) * 3;
      buf[o] += (rgb[0] - buf[o]) * a;
      buf[o + 1] += (rgb[1] - buf[o + 1]) * a;
      buf[o + 2] += (rgb[2] - buf[o + 2]) * a;
    }
  }
}

const STAGE = { intro: 0, slide: 1, flip: 2, rule: 3, sub: 4, settle: 5, final: 6, out: 7 };

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.L) return;
  const { L, buf, c, gold } = S, n = S.n;
  buf.fill(0);
  const ph = S.phase, st = STAGE[ph], f = pace(S), h0 = S.hue + 0.5;
  const dy = S.cam + (ph === "out" ? ease(S.t / T_OUT) * (H + 20) : 0);
  const pulse = 0.78 + 0.22 * sin(S.t * 6);
  hsv(0.13, 0.5, 1, gold);
  const g = [gold[0] * pulse, gold[1] * pulse, gold[2] * pulse];
  const nl = S.lines.length, top = st === 0 ? 0 : nl - 4;
  const u = ph === "slide" ? S.t / (T_SLIDE * n * f) : ph === "flip" ? S.t / (T_FLIP * f) : ph === "rule" ? S.t / (T_RULE * f) : 0;
  const colT = ph === "sub" ? S.t / (T_COL * f) : st > 4 ? n + 1 : -1;
  const colour = (dv, v, sat) => hsv(h0 + 0.034 * dv, sat, v, c);
  const lnD = st > 0 ? S.lines[nl - 3] : null;
  for (let li = 0; li < nl; li++) {
    const ln = S.lines[li], y = ln.y - dy;
    if (y > H || y + L.gh + 3 < -3) continue;
    const cur = li >= top + 1 && st > 0, glow = st >= 6 && S.glow.indexOf(li) >= 0;
    const base = li < top ? 0.4 : li === top && st > 0 ? 0.6 : 1;
    for (let j = 0; j < n; j++) {
      let v = base, sat = 0.72;
      if (ln.kind === "N" && st === 0 && j >= floor(S.t / T_INTRO)) continue;
      if (li === top && ph === "slide") {
        // A digit dims once it has been picked for the sorted row.
        let picked = false;
        for (let k = 0; k < n; k++) if (lnD.from[k] === j && u * n - k > 0) picked = true;
        v = picked ? 0.6 : 1;
      }
      if (cur && ln.kind === "D" && st === 1 && u * n - j < 1) continue;
      if (cur && ln.kind === "A" && st <= 2) continue;
      if (cur && ln.kind === "R") {
        if (st < 4) continue;
        const k = n - 1 - j;
        if (colT < k + 0.5) continue;
        // The digit is written white and settles into its colour.
        sat = 0.72 * cl((colT - k - 0.5) * 2, 0, 1);
      }
      if (cur && ph === "sub" && (ln.kind === "D" || ln.kind === "A") && j === n - 1 - floor(colT)) {
        v = 1;
        sat = 0.12;
      }
      if (glow) blit(S, ln.dig[j], slotX(S, j), y, g);
      else {
        colour(ln.dig[j], v, sat);
        blit(S, ln.dig[j], slotX(S, j), y, c);
      }
    }
    // Borrows: a tick before the digit that takes ten, a dot over the one
    // that gives it.
    if (ln.kind === "D" && ln.ticks && (!cur || st >= 4)) {
      const w = n === 4 ? 2 : 1, b = (li < top ? 0.45 : 1) * 255;
      for (let j = 0; j < n; j++) {
        if (ln.ticks[j] && colT + (cur ? 0 : 99) >= n - 1 - j + 0.25) rect(S, slotX(S, j) - 2, y + 1, 1, round(L.gh * 0.42), b, b * 0.85, b * 0.35);
        if (ln.dots[j] && colT + (cur ? 0 : 99) >= n - 2 - j + 0.25) rect(S, slotX(S, j) + round((L.gw - w) / 2), y - 1 - w, w, w, b, b * 0.85, b * 0.35);
      }
    }
    if (ln.kind === "A" && (!cur || st >= 3)) {
      const b = (li < top ? 0.45 : 1) * 190, my = y + round(L.gh / 2) - 1;
      rect(S, 1, my, L.margin - 3, n === 4 ? 2 : 1, b, b, b);
      const rw = cur && ph === "rule" ? round((W - 2) * ease(u)) : W - 2;
      rect(S, 1, y + L.gh + 1, rw, 1, b * 0.75, b * 0.75, b * 0.8);
    }
    if (ln.kind === "R" && (!cur || st >= 5)) small(S, ln.step, 1, y + L.gh - 5, li < top ? 50 : 90);
  }
  if (ph === "slide") {
    // The sorted row is picked one digit at a time, the largest first, each
    // flying from its place in the line above.
    const lnN = S.lines[nl - 4];
    for (let k = 0; k < n; k++) {
      const uk = u * n - k;
      if (uk <= 0 || uk >= 1) continue;
      const i = lnD.from[k], e = ease(uk);
      const x = slotX(S, i) + (slotX(S, k) - slotX(S, i)) * ease(uk * 1.2);
      const yy = lnN.y + (lnD.y - lnN.y) * e - 2 * sin(PI * e) - dy;
      colour(lnD.dig[k], 1, 0.3);
      blitOver(S, lnD.dig[k], x, yy, c);
    }
  }
  if (ph === "flip") {
    // The copy drops a line, then turns half round like a carousel seen from
    // a little below, the digits behind swinging low and dim, so it lands
    // reversed.
    const lnA = S.lines[nl - 2], e = ease(u / 0.3), th = PI * ease((u - 0.3) / 0.7), cx = L.margin + (n * S.cell) / 2;
    const dx = (j) => slotX(S, j) + L.gw / 2 - cx, zmax = abs(dx(0)) || 1;
    const idx = [];
    for (let j = 0; j < n; j++) idx.push(j);
    idx.sort((a, b) => dx(b) - dx(a));
    for (const j of idx) {
      const z = -dx(j) * sin(th);
      const x = cx + dx(j) * cos(th) - L.gw / 2;
      const yy = lnD.y + (lnA.y - lnD.y) * e + (z < 0 ? -z * 0.55 : -z * 0.08) - dy;
      colour(lnD.dig[j], 0.55 + 0.45 * (0.5 + (0.5 * z) / zmax), 0.3);
      blitOver(S, lnD.dig[j], x, yy, c);
    }
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
