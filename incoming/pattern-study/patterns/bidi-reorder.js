// ===== Patternflow pattern =====
// Title:   Bidi Reorder
// Family:  type
// Idea:    A line that mixes left-to-right letters in lowercase with right-to-left ones in UPPERCASE is worked through down the panel the way the Unicode bidirectional algorithm does it: typed in order, each character given its class and then its embedding level as a bar, every run at the top level reversed along crossing arcs, then every run at the next level, until the row at the foot is what a reader's eye meets.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Unicode bidirectional algorithm (Unicode Standard Annex #9, Mark Davis and others, Unicode 2.0, 1996), its bracket-pair rule N0 (Unicode 6.3, 2013), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..4, Direction=0..1, Sample=1..8
//
// Knob 1: Hue. Turns the five classes' colours round the wheel together. At 0 the lowercase left-to-right letters are azure, the UPPERCASE right-to-left ones orange, the numbers green, the neutrals (brackets, ! and .) pink and the spaces grey dots; at 0.46 the right-to-left letters are azure and the left-to-right ones red.
// Knob 2: Speed. How fast a line is worked through. At 2 the typed line is in by 0.8 s, the class bars are recoloured by 1.7 s and at height by 2.1 s, the first pass starts at 2.1 s and the next 1.2 s after it, the eye then reads the last row for 1.4 to 1.8 s, and a line lasts 7.4 to 9.0 s: the eight lines at Direction 0 come round in 63 s. At 0.4 it is five times slower, at 4 twice as fast.
// Knob 3: Direction. The paragraph direction, a step at the middle of the knob: below 0.5 left-to-right, level 0, with the arrow along the top pointing right; from 0.5 right-to-left, level 1, arrow pointing left. It moves where the neutrals fall, which letters sit at level 2 and where the reading starts: see CAR. comes out see RAC. at 0 and .RAC see at 1, and the line restarts when it flips.
// Knob 4: Sample. Which of the eight lines is worked, snapped to a whole number: 1 see CAR., 2 AB 12 CD, 3 AB! CD ef, 4 AB (CD) EF, 5 AB (cd) EF, 6 ab 12 CD, 7 a CD 12 e, 8 (AB) cd. Eight dots at the top show which one. A turn jumps to its line and restarts it; a line that has finished is followed by the next, round to 1 again.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[o + 1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[o + 2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// ---- the algorithm ---------------------------------------------------------
// A teaching alphabet: a to z are left-to-right letters (class L), A to Z
// stand for right-to-left letters (R), 0 to 9 are European numbers (EN), the
// space is white space (WS) and every other character, the brackets among
// them, is a neutral (ON). One paragraph on one line, no explicit embeddings
// or isolates, so the line is a single run of one level that starts at the
// paragraph level P (0 for left-to-right, 1 for right-to-left) and the
// algorithm only has to resolve classes (W7, N0, N1, N2), turn them into
// levels (I1, I2), reset trailing white space (L1) and reverse (L2).
const L = 0, R = 1, EN = 2, WS = 3, ON = 4;
const classOf = (c) => (c >= "a" && c <= "z" ? L : c >= "A" && c <= "Z" ? R : c >= "0" && c <= "9" ? EN : c === " " ? WS : ON);
const CLOSER = { "(": ")", "[": "]" };
const MIRROR = { "(": ")", ")": "(", "[": "]", "]": "[" };

function resolve(str, P) {
  const n = str.length, e = P ? R : L, orig = [], t = [];
  for (let i = 0; i < n; i++) orig.push(classOf(str[i]));
  for (let i = 0; i < n; i++) t.push(orig[i]);
  // W7: a European number after left-to-right text, or at the start of a
  // left-to-right paragraph, becomes left-to-right text.
  let last = e;
  for (let i = 0; i < n; i++) {
    if (t[i] === L || t[i] === R) last = t[i];
    else if (t[i] === EN && last === L) t[i] = L;
  }
  // The direction a character gives its neighbours: numbers count as R.
  const dir = (c) => (c === L ? L : c === R || c === EN ? R : -1);
  // N0: bracket pairs (BD16: a closing bracket pairs with the nearest open
  // one of its kind, and the ones opened after that are dropped).
  const pairs = [], stack = [];
  for (let i = 0; i < n; i++) {
    if (t[i] !== ON) continue;
    if (CLOSER[str[i]] && stack.length < 63) stack.push([CLOSER[str[i]], i]);
    else {
      for (let j = stack.length - 1; j >= 0; j--)
        if (stack[j][0] === str[i]) {
          pairs.push([stack[j][1], i]);
          stack.length = j;
          break;
        }
    }
  }
  pairs.sort((a, b) => a[0] - b[0]);
  for (const [o, c] of pairs) {
    let inE = false, inO = false;
    for (let k = o + 1; k < c; k++) {
      const d = dir(t[k]);
      if (d === e) inE = true;
      else if (d >= 0) inO = true;
    }
    let to = -1;
    if (inE) to = e;
    else if (inO) {
      // Only the other direction inside: the brackets follow the text before
      // them if that was the other direction too, and the paragraph if not.
      let before = e;
      for (let k = o - 1; k >= 0; k--) {
        const d = dir(t[k]);
        if (d >= 0) { before = d; break; }
      }
      to = before !== e ? before : e;
    }
    if (to >= 0) t[o] = t[c] = to;
  }
  // N1: neutrals between two characters that push the same way take that
  // way, the line's ends count as the paragraph direction. N2: the rest take
  // the paragraph direction.
  for (let i = 0; i < n; ) {
    if (t[i] !== WS && t[i] !== ON) { i++; continue; }
    let j = i;
    while (j < n && (t[j] === WS || t[j] === ON)) j++;
    const a = i === 0 ? e : dir(t[i - 1]), b = j === n ? e : dir(t[j]);
    for (let k = i; k < j; k++) t[k] = a === b ? a : e;
    i = j;
  }
  // I1, I2: levels from the paragraph level.
  const lev = t.map((c) => (P ? (c === R ? 1 : 2) : c === L ? 0 : c === R ? 1 : 2));
  // L1: white space at the end of the line goes back to the paragraph level.
  for (let i = n - 1; i >= 0 && orig[i] === WS; i--) lev[i] = P;
  // L2: from the highest level down to the lowest odd one, reverse every run
  // of characters at that level or higher. Each pass is kept as a row.
  let hi = 0, lo = 99;
  for (const v of lev) { hi = max(hi, v); if (v & 1) lo = min(lo, v); }
  const rows = [Array.from({ length: n }, (_, i) => i)], ks = [];
  for (let k = hi; k >= lo; k--) {
    const row = rows[rows.length - 1].slice();
    for (let i = 0; i < n; ) {
      if (lev[row[i]] < k) { i++; continue; }
      let j = i;
      while (j < n && lev[row[j]] >= k) j++;
      for (let a = i, b = j - 1; a < b; a++, b--) { const x = row[a]; row[a] = row[b]; row[b] = x; }
      i = j;
    }
    rows.push(row);
    ks.push(k);
  }
  return { str, P, n, orig, res: t, lev, rows, ks };
}

// ---- the face --------------------------------------------------------------
// 5 x 7 letters drawn for this pattern: capitals for the right-to-left
// letters, lower case for the left-to-right ones.
const SRC = {
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/#...#/####./#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#....",
  R: "####./#...#/#...#/####./#.#../#..#./#...#",
  a: "...../...../.###./....#/.####/#...#/.####",
  b: "#..../#..../####./#...#/#...#/#...#/####.",
  c: "...../...../.###./#...#/#..../#...#/.###.",
  d: "....#/....#/.####/#...#/#...#/#...#/.####",
  e: "...../...../.###./#...#/#####/#..../.###.",
  f: "..##./.#..#/.#.../###../.#.../.#.../.#...",
  s: "...../...../.####/#..../.###./....#/####.",
  1: "..#../.##../..#../..#../..#../..#../.###.",
  2: ".###./#...#/....#/...#./..#../.#.../#####",
  ".": "...../...../...../...../...../.##../.##..",
  "!": "..#../..#../..#../..#../..#../...../..#..",
  "(": "...#./..#../.#.../.#.../.#.../..#../...#.",
  ")": ".#.../..#../...#./...#./...#./..#../.#...",
};
const GLYPH = {};
for (const ch of Object.keys(SRC)) {
  const px = [];
  SRC[ch].split("/").forEach((row, y) => [...row].forEach((c, x) => c === "#" && px.push(x, y)));
  GLYPH[ch] = px;
}
const BLOCK = [];
for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) BLOCK.push(x, y);
// 3 x 5 digits for the level beside each pass.
const TINY = ["### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###"].map((s) => {
  const rows = s.split(" "), m = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === "#") m.push(x, y);
  return m;
});

// ---- the lines -------------------------------------------------------------
// Lowercase is left-to-right, UPPERCASE right-to-left. The first is the
// classic car means CAR., shortened to fit ten characters.
const LINES = ["see CAR.", "AB 12 CD", "AB! CD ef", "AB (CD) EF", "AB (cd) EF", "ab 12 CD", "a CD 12 e", "(AB) cd."];

const ADV = 6, TOP = 6, BOT = 112, BASE = 22;
// When the first pass starts, at Speed 2.
const T1 = 2.1;
const NC = 110;

// A line at one paragraph level, resolved, with every position and arc it
// needs laid out.
function lay(str, P) {
  const r = resolve(str, P), n = r.n, ns = r.ks.length;
  const x0 = floor((W - (ADV * n - 1)) / 2);
  const ys = [TOP];
  for (let s = 1; s <= ns; s++) ys.push(TOP + round((s * (BOT - TOP)) / ns));
  // slot[s][i]: where character i stands after s passes.
  const slot = r.rows.map((row) => {
    const out = new Array(n);
    row.forEach((c, j) => (out[c] = j));
    return out;
  });
  // The arcs: from the foot of the character in the row above to the head of
  // its place in the next, an S with upright ends.
  const arc = [];
  for (let s = 1; s <= ns; s++) {
    const y0 = s === 1 ? BASE + 3 : ys[s - 1] + 10, y1 = ys[s] - 2, list = [];
    for (let i = 0; i < n; i++) {
      const xa = x0 + slot[s - 1][i] * ADV + 2.5, xb = x0 + slot[s][i] * ADV + 2.5, dy = y1 - y0, pts = new Float32Array(NC * 2);
      for (let q = 0; q < NC; q++) {
        const u = q / (NC - 1), v = 1 - u;
        // cubic Bezier with control points (xa, y0 + dy/2) and (xb, y1 - dy/2)
        const b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u;
        pts[q * 2] = (b0 + b1) * xa + (b2 + b3) * xb;
        pts[q * 2 + 1] = b0 * y0 + b1 * (y0 + dy / 2) + b2 * (y1 - dy / 2) + b3 * y1;
      }
      list.push(pts);
    }
    arc.push(list);
  }
  // The timeline, in seconds at Speed 2.
  const tp = T1 + 1.2 * ns + 0.045 * (n - 1) + 0.9;
  const total = tp + 0.18 * n + 1 + 0.4;
  return { ...r, x0, ys, slot, arc, ns, tp, total };
}

export function setup(params) {
  params.s = {
    lay: LINES.map((s) => [lay(s, 0), lay(s, 1)]),
    R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP),
    pal: new Float32Array(5 * 3), palHue: -1,
    hue: 0, sp: 2, line: 0, P: 0, t: 0, kLine: -1, kP: -1,
  };
}

// L, R, EN, WS, ON.
function palette(S) {
  const t = S.pal, h = S.hue;
  hsv(h + 0.55, 0.7, 1, t, 0);
  hsv(h + 0.09, 0.85, 1, t, 3);
  hsv(h + 0.33, 0.75, 1, t, 6);
  t[9] = t[10] = t[11] = 120;
  hsv(h + 0.82, 0.5, 1, t, 12);
  S.palHue = h;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.sp = cl(k[1], 0.4, 4);
  const kP = cl(k[2], 0, 1) >= 0.5 ? 1 : 0, kLine = cl(round(k[3]), 1, LINES.length) - 1;
  // A knob that moves puts the show on the line or the direction it names.
  if (kLine !== S.kLine || kP !== S.kP) {
    S.kLine = kLine;
    S.kP = kP;
    S.line = kLine;
    S.P = kP;
    S.t = 0;
  }
  S.t += (d * S.sp) / 2;
  if (S.t >= S.lay[S.line][S.P].total) {
    S.line = (S.line + 1) % LINES.length;
    S.t = 0;
  }
}

function put(S, x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const q = y * W + x;
  S.R[q] = r; S.G[q] = g; S.B[q] = b;
}

function glyph(S, ch, gx, gy, col, a) {
  const m = GLYPH[ch] || BLOCK, r = col[0] * a, g = col[1] * a, b = col[2] * a;
  for (let i = 0; i < m.length; i += 2) put(S, gx + m[i], gy + m[i + 1], r, g, b);
}

// The arc from its start to u of the way, a full LED at each sample, never dimming what is already brighter.
function stroke(S, pts, u, col, a) {
  const last = floor(u * (NC - 1)), r = col[0] * a, g = col[1] * a, b = col[2] * a;
  for (let q = 0; q <= last; q++) {
    const px = floor(pts[q * 2]), py = floor(pts[q * 2 + 1]);
    if (px < 0 || px >= W || py < 0 || py >= H) continue;
    const o = py * W + px;
    if (r > S.R[o]) S.R[o] = r;
    if (g > S.G[o]) S.G[o] = g;
    if (b > S.B[o]) S.B[o] = b;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const { R, G, B, pal } = S, Ln = S.lay[S.line][S.P], t = S.t, n = Ln.n, ns = Ln.ns, x0 = Ln.x0;
  R.fill(0); G.fill(0); B.fill(0);
  const fade = cl((Ln.total - t) / 0.4, 0, 1);
  const colOf = (c) => [pal[c * 3], pal[c * 3 + 1], pal[c * 3 + 2]];
  const white = [255, 255, 255];
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

  // The reading eye: which place in the last row it is on, once the last pass has landed.
  const rd = ns > 0 ? floor((t - Ln.tp) / 0.18) : -1;
  const read = rd >= 0 && rd < n ? Ln.rows[ns][rd] : -1;

  // Paragraph direction along the top.
  for (let x = 4; x < 60; x++) put(S, x, 1, 70 * fade, 70 * fade, 90 * fade);
  const tip = S.P ? 3 : 60, dir = S.P ? 1 : -1;
  put(S, tip, 1, 140 * fade, 140 * fade, 180 * fade);
  for (let q = 1; q <= 2; q++) { put(S, tip + dir * q, 1 - q, 140 * fade, 140 * fade, 180 * fade); put(S, tip + dir * q, 1 + q, 140 * fade, 140 * fade, 180 * fade); }

  // Which of the lines this is.
  for (let q = 0; q < LINES.length; q++) {
    const on = q === S.line, v = (on ? 255 : 70) * fade;
    for (let x = 0; x < 2; x++) for (let y = 0; y < (on ? 2 : 1); y++) put(S, 6 + 7 * q + x, 3 + y, v, v, v);
  }

  // Pass levels beside the arcs.
  for (let s = 1; s <= ns; s++) {
    const ts = T1 + 1.2 * (s - 1), y = ceil((s === 1 ? BASE + 3 : Ln.ys[s - 1] + 10) / 2 + (Ln.ys[s] - 2) / 2) - 2;
    const a = ease((t - ts + 0.3) / 0.3) * (t < ts + 1.1 ? 1 : 0.55) * fade, m = TINY[Ln.ks[s - 1]] || TINY[0];
    for (let i = 0; i < m.length; i += 2) put(S, 1 + m[i], y + m[i + 1], 230 * a, 230 * a, 230 * a);
  }

  // The arcs and the places the characters hold after each pass. Row 0 is the line as typed.
  for (let s = ns; s >= 1; s--) {
    const ts = T1 + 1.2 * (s - 1);
    for (let i = 0; i < n; i++) {
      const u = ease((t - ts - 0.045 * i) / 0.7);
      if (u <= 0) continue;
      const orig = Ln.orig[i];
      let col = colOf(orig);
      const hot = read === i;
      if (hot) col = mix(col, white, 0.5);
      stroke(S, Ln.arc[s - 1][i], u, col, (u < 1 ? 1 : 0.8) * fade);
    }
  }
  for (let s = ns; s >= 0; s--) {
    const ts = T1 + 1.2 * (s - 1);
    for (let i = 0; i < n; i++) {
      const ch = Ln.str[i], o = Ln.orig[i];
      let gx, gy, u = 1, a = 1;
      if (s === 0) {
        a = ease((t - 0.07 * i) / 0.2);
        if (a <= 0) continue;
        gx = x0 + i * ADV;
        gy = TOP;
      } else {
        u = ease((t - ts - 0.045 * i) / 0.7);
        if (u <= 0) continue;
        // The traveller: the head of the arc, the glyph following it.
        const sx = x0 + Ln.slot[s - 1][i] * ADV, ex = x0 + Ln.slot[s][i] * ADV, sy = Ln.ys[s - 1], ey = Ln.ys[s];
        const pts = Ln.arc[s - 1][i], q = min(NC - 1, floor(u * (NC - 1))), px = pts[q * 2] - 2.5, py = pts[q * 2 + 1] - 3.5;
        const y0 = s === 1 ? BASE + 3 : Ln.ys[s - 1] + 10, y1 = ey - 2;
        gx = round(px + (1 - u) * (sx - (pts[0] - 2.5)) + u * (ex - (pts[(NC - 1) * 2] - 2.5)));
        gy = round(py + (1 - u) * (sy - (y0 - 3.5)) + u * (ey - (y1 - 3.5)));
      }
      // A bracket that lands in an odd level is shown the other way round.
      let shown = ch;
      if (s === ns && s > 0 && (Ln.lev[i] & 1) && MIRROR[ch] && u >= 0.5) shown = MIRROR[ch];
      let col = colOf(o);
      if (read === i) col = mix(col, white, 0.55);
      if (o === WS) glyph(S, ".", gx, gy - 3, [120, 120, 120], 0.7 * a * fade);
      else glyph(S, shown, gx, gy, col, a * fade);
    }
  }

  // The level bars under the typed line: first the class each character was typed as, then the class it is
  // resolved to, then a bar as high as its level.
  for (let i = 0; i < n; i++) {
    const tc = 0.5 + 0.04 * i, a = ease((t - tc) / 0.2);
    if (a <= 0) continue;
    const tr = ease((t - 0.95 - 0.05 * i) / 0.25), tl = ease((t - 1.45 - 0.04 * i) / 0.3);
    const col = mix(colOf(Ln.orig[i]), colOf(Ln.res[i]), tr), h = round(2 + 3 * Ln.lev[i] * tl);
    const gx = x0 + i * ADV;
    for (let y = 0; y < h; y++) for (let x = 0; x < 5; x++) put(S, gx + x, BASE - y, col[0] * 0.8 * a * fade, col[1] * 0.8 * a * fade, col[2] * 0.8 * a * fade);
  }

  // The eye's caret under the last row.
  if (ns > 0 && rd >= 0) {
    const j = min(n - 1, rd), cx = x0 + j * ADV + 2, cy = Ln.ys[ns] + 9, a = (rd < n ? 1 : 0.5) * fade;
    put(S, cx, cy, 255 * a, 255 * a, 255 * a);
    for (let q = -1; q <= 1; q++) put(S, cx + q, cy + 1, 255 * a, 255 * a, 255 * a);
  }

  for (let q = 0; q < NP; q++) display.setPixel(q % W, (q / W) | 0, min(255, R[q]), min(255, G[q]), min(255, B[q]));
}
