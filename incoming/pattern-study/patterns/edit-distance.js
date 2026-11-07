// ===== Patternflow pattern =====
// Title:   Edit Distance
// Family:  type
// Idea:    Two words stand as the headers of a table and the Levenshtein distance between their prefixes fills it cell by cell, each number the least of its three neighbours plus a cost, then the cheapest way from corner to corner is walked back and lit as a path while the same path edits the first word into the second in a ladder of words below, one letter swapped, struck out or put in at each step.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Levenshtein distance (Vladimir Levenshtein, 1965), its dynamic programming table (Robert Wagner and Michael Fischer, 1974); the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from kasiski-examination.js; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pair=0..6, Cost=1..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the table runs from cyan at 0 through blue and violet to magenta at 8, the first word is pale cyan and the second pale rose, and on the path a swap is orange, a letter put in is green, a letter struck out is crimson and a letter kept is pale violet.
// Knob 2: Speed. How fast the table fills and is walked. At 2 each diagonal of cells takes 0.15 s, so KITTEN and SITTING, 14 diagonals, are filled by 2.1 s, the path is walked back from the last cell at 0.2 s a cell and lit forward at 0.13 s a cell, and the picture holds for 1.75 s, fades for 0.5 s and starts again: 8.1 s round. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Pair. Which two words, snapping at whole numbers: 0 KITTEN to SITTING (where it opens), 1 SUNDAY to SATURDAY, 2 FLAW to LAWN, 3 SILENT to LISTEN, 4 MONDAY to MOON, 5 HORSE to ROSE and 6 EDIT to DISTANCE. The table and the ladder under it are sized to fit the pair. The digits are 3 LEDs wide, and 6 wide where the table is small enough, for FLAW and LAWN and for HORSE and ROSE at cost 1.
// Knob 4: Cost. What a swap of one letter for another costs, 1 or 2, snapping at 1.5. A letter put in or struck out costs 1 whatever it is. At 2 a swap costs as much as a strike and a put-in together, so the walk takes the strike and the put-in and no swap is left: KITTEN to SITTING is 3 edits at cost 1 and 5 at cost 2, its ladder goes from 4 lines to 6, and the numbers in the table change in 42 of its 56 cells.

const W = 64, H = 128;
const { floor, round, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, both copied from kasiski-examination.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));
// What each step does, in a 3 by 3: a swap, a put-in and a strike-out.
const ICON = { S: "#.#|.#.|#.#", I: ".#.|###|.#.", D: "...|###|..." };

const PAIRS = [["KITTEN", "SITTING"], ["SUNDAY", "SATURDAY"], ["FLAW", "LAWN"], ["SILENT", "LISTEN"], ["MONDAY", "MOON"], ["HORSE", "ROSE"], ["EDIT", "DISTANCE"]];

// The distance table, then the way back from its last cell. At each cell the
// walk back goes diagonally if that is how the cell was reached, then up (a
// strike), then left (a put-in), and the result is turned round to read from
// the first corner. A step is S for a swap, M for a letter kept, I for a
// letter put in and D for a letter struck out.
function make(pi, sc) {
  const a = PAIRS[pi][0], b = PAIRS[pi][1], m = a.length, n = b.length;
  const D = [];
  for (let i = 0; i <= m; i++) {
    D.push(new Array(n + 1).fill(0));
    D[i][0] = i;
  }
  for (let j = 0; j <= n; j++) D[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) D[i][j] = min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : sc));
  const rev = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const same = i > 0 && j > 0 && a[i - 1] === b[j - 1];
    const diag = i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (same ? 0 : sc);
    const up = i > 0 && D[i][j] === D[i - 1][j] + 1;
    // A letter kept is always taken. When a swap costs 2 it costs what a strike and a put-in cost, and
    // the walk takes those two; when it costs 1 the swap is taken before them.
    if (diag && (same || sc === 1 || (!up && !(j > 0 && D[i][j] === D[i][j - 1] + 1)))) {
      rev.push({ op: same ? "M" : "S", ca: a[i - 1], cb: b[j - 1], i, j });
      i--;
      j--;
    } else if (up) {
      rev.push({ op: "D", ca: a[i - 1], cb: "", i, j });
      i--;
    } else {
      rev.push({ op: "I", ca: "", cb: b[j - 1], i, j });
      j--;
    }
  }
  const moves = rev.reverse(), L = moves.length;
  // Cells on the path, first corner to last, and for each step which edit it is among the ones that cost.
  const cells = [[0, 0]];
  let K = 0;
  const cum = [0];
  for (const mv of moves) {
    cells.push([mv.i, mv.j]);
    if (mv.op !== "M") {
      K++;
      mv.k = K;
      cum.push(cum[K - 1] + (mv.op === "S" ? sc : 1));
    } else mv.k = 0;
  }
  const at = new Int16Array((m + 1) * (n + 1)).fill(-1);
  cells.forEach(([ci, cj], q) => (at[ci * (n + 1) + cj] = q));

  // The layout. The ladder below the table has K + 1 lines, as large as they go.
  const lines = K + 1, ls = lines <= 4 && L <= 7 ? 2 : 1, lp = ls === 2 ? 12 : 8;
  const lpitch = ls === 2 ? min(8, floor(54 / L)) : min(7, floor(54 / L));
  const LH = lines * lp, NC = n + 2, NR = m + 2;
  const cw = min(10, floor(62 / NC)), ch = min(13, floor((128 - 6 - LH) / NR));
  const ds = cw >= 8 && ch >= 12 ? 2 : 1;
  return {
    a, b, m, n, D, moves, L, K, cum, cells, at, sc, lines, ls, lp, lpitch, NC, NR, cw, ch, ds,
    tx: floor((W - NC * cw) / 2), ty: 2, ly: 2 + NR * ch + 3, lx: 10,
  };
}

export function setup(params) {
  params.s = { hue: 0, speed: 2, pair: -1, cost: -1, t: 0, G: null, buf: new Uint8Array(W * H * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const pair = cl(round(k[2]), 0, PAIRS.length - 1), cost = cl(round(k[3]), 1, 2);
  if (pair !== S.pair || cost !== S.cost) {
    S.pair = pair;
    S.cost = cost;
    S.G = make(pair, cost);
    S.t = 0;
  }
  S.t += d;
  const G = S.G, v = S.speed;
  // The schedule, in seconds: the table, the walk back, the walk forward, the hold.
  const dd = 0.3 / v, db = 0.4 / v, dr = 0.26 / v;
  S.dd = dd;
  S.db = db;
  S.dr = dr;
  S.tf = 0.15 + (G.m + G.n + 1) * dd + 0.25;
  S.tb = S.tf + 0.1;
  S.tr = S.tb + (G.L + 1) * db + 0.3;
  S.th = S.tr + (G.L + 1) * dr + 0.3;
  S.te = S.th + 1 + 1.5 / v;
  if (S.t >= S.te + 0.5) S.t = 0;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, buf = S.buf, t = S.t, hb = S.hue + 0.52;
  buf.fill(0);
  const fade = 1 - sm((t - S.te) / 0.5);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3, f = 255 * a * fade;
    buf[o] = min(255, c[0] * f);
    buf[o + 1] = min(255, c[1] * f);
    buf[o + 2] = min(255, c[2] * f);
  };
  const rect = (x, y, w, h, c, a) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, a);
  };
  const glyph = (ch, x, y, s, c, a) => {
    const g = GLYPH[ch];
    if (!g) return;
    for (let p = 0; p < 15; p++) if (g[p]) rect(x + (p % 3) * s, y + floor(p / 3) * s, s, s, c, a);
  };
  const icon = (op, x, y, c, a) => {
    const g = ICON[op].replace(/\|/g, "");
    for (let p = 0; p < 9; p++) if (g[p] === "#") put(x + (p % 3), y + floor(p / 3), c, a);
  };
  const mix = (c1, c2, f) => [c1[0] + (c2[0] - c1[0]) * f, c1[1] + (c2[1] - c1[1]) * f, c1[2] + (c2[2] - c1[2]) * f];

  // The colours, all from the hue: the two words, a step of each kind, the table.
  const CA = [0, 0, 0], CB = [0, 0, 0], OPC = { S: [0, 0, 0], I: [0, 0, 0], D: [0, 0, 0], M: [0, 0, 0] };
  hsv(hb, 0.3, 1, CA);
  hsv(hb + 0.42, 0.35, 1, CB);
  hsv(hb + 0.58, 0.85, 1, OPC.S);
  hsv(hb - 0.18, 0.8, 1, OPC.I);
  hsv(hb + 0.45, 0.8, 1, OPC.D);
  hsv(hb + 0.13, 0.28, 1, OPC.M);
  const DARK = [0.03, 0.03, 0.06], WHITE = [1, 1, 1];
  const tint = (v) => {
    const u = v / 9, c = [0, 0, 0];
    hsv(hb - 0.03 + 0.4 * u, 0.7, 1, c);
    return c;
  };

  const { m, n, D, moves, L, K, cells, at, cw, ch, ds, tx, ty } = G;
  const iw = cw - 1, ih = ch - 1;
  const cx = (j) => tx + (j + 1) * cw, cy = (i) => ty + (i + 1) * ch;

  // When the walk back reaches the q-th cell of the path, and the walk forward does.
  const tBack = (q) => S.tb + (L - q) * S.db;
  const tFwd = (q) => S.tr + q * S.dr;

  // The table.
  for (let i = 0; i <= m; i++)
    for (let j = 0; j <= n; j++) {
      const x = cx(j), y = cy(i), age = t - (0.15 + (i + j) * S.dd), v = D[i][j];
      const q = at[i * (n + 1) + j];
      if (age < 0) {
        rect(x, y, iw, ih, tint(0), 0.07);
        continue;
      }
      const flash = 1 - sm(age / 0.22);
      let bg = mix(tint(v), WHITE, flash * 0.8), ba = 0.08 + 0.06 * v + 0.3 * flash, dc = mix(WHITE, tint(v), 0.25 + 0.35 * (1 - flash));
      if (q >= 0 && t >= tBack(q)) {
        // On the path: the cell lights in the colour of the step into it, and the digit goes dark.
        const mv = q > 0 ? moves[q - 1] : null, oc = mv ? OPC[mv.op] : OPC.M;
        const pass = t >= tFwd(q) ? 1 - sm((t - tFwd(q)) / 0.35) : 0, born = 1 - sm((t - tBack(q)) / 0.3);
        bg = mix(oc, WHITE, max(pass, born) * 0.85);
        ba = 0.78 + 0.22 * max(pass, born);
        dc = DARK;
      }
      rect(x, y, iw, ih, bg, ba);
      glyph(String(v), x + floor((iw - 3 * ds) / 2), y + floor((ih - 5 * ds) / 2), ds, dc, 1);
      if (i > 0 && j > 0 && G.a[i - 1] === G.b[j - 1] && !(q >= 0 && t >= tBack(q))) put(x + iw - 1, y, OPC.M, 1);
    }
  // What a swap costs, in the empty corner of the table: its icon and the cost.
  {
    const lx0 = tx + floor((2 * cw - 7) / 2), ly0 = ty + floor((ih - 5) / 2);
    icon("S", lx0, ly0 + 1, OPC.S, 1);
    glyph(String(G.sc), lx0 + 4, ly0, 1, WHITE, 0.9);
  }
  // The words at the table's edges.
  for (let i = 1; i <= m; i++) glyph(G.a[i - 1], tx + floor((iw - 3 * ds) / 2), cy(i) + floor((ih - 5 * ds) / 2), ds, CA, 1);
  for (let j = 1; j <= n; j++) glyph(G.b[j - 1], cx(j) + floor((iw - 3 * ds) / 2), ty + floor((ih - 5 * ds) / 2), ds, CB, 1);

  // The path's joints in the gaps between cells.
  for (let q = 1; q <= L; q++) {
    if (t < tBack(q - 1)) continue;
    const [pi, pj] = cells[q - 1], [ci, cj] = cells[q], mv = moves[q - 1];
    const x = cx(cj) - 1, y = cy(ci) - 1, c = OPC[mv.op];
    const pass = t >= tFwd(q) ? 1 - sm((t - tFwd(q)) / 0.35) : 0;
    const cc = mix(c, WHITE, pass * 0.85);
    if (ci > pi && cj > pj) put(x, y, cc, 1);
    else if (cj > pj) for (let r = 0; r < max(1, ds); r++) put(x, y + 1 + floor((ih - ds) / 2) + r, cc, 1);
    else for (let r = 0; r < max(1, ds); r++) put(x + 1 + floor((iw - ds) / 2) + r, y, cc, 1);
  }

  // The ladder. Line k is the first word with its first k edits made, drawn in the columns of the walk
  // so that each letter stays over the one it becomes. Line 0 and the last line are there from the
  // start, on the words' own spacing, and slide into the columns when the walk back begins.
  const { ls, lp, lpitch, lx, ly } = G;
  const lw = 3 * ls, lh = 5 * ls;
  const slide = sm((t - S.tb) / (0.5 / S.speed));
  // For each step, the line that is lit when the walk back has passed it.
  const stepTime = new Array(K + 2).fill(0);
  moves.forEach((mv, q) => {
    if (mv.k) stepTime[mv.k] = tBack(q);
  });
  const aPos = [], bPos = [];
  moves.forEach((mv, c) => {
    if (mv.ca) aPos.push(c);
    if (mv.cb) bPos.push(c);
  });
  for (let k = 0; k <= K; k++) {
    const y = ly + k * lp;
    const shown = k === 0 || k === K ? 0 : t >= stepTime[k + 1] ? 1 : 0;
    const reveal = k === 0 || k === K ? 1 : sm((t - stepTime[k + 1]) / 0.25);
    // The replay lights line k when the walk forward passes its step.
    let hot = 0;
    if (k > 0) {
      const q = moves.findIndex((mv) => mv.k === k) + 1;
      if (t >= tFwd(q)) hot = 1 - sm((t - tFwd(q)) / 0.5);
    }
    if (k > 0 && k < K && !shown) {
      // A line not found yet: a dotted rule where its word will be.
      for (let x = lx; x < lx + L * lpitch - (lpitch - lw); x += 2) put(x, y + floor(lh / 2), CA, 0.14);
      continue;
    }
    for (let c = 0; c < L; c++) {
      const mv = moves[c], done = mv.op === "M" || (mv.k > 0 && mv.k <= k);
      const ch2 = done ? mv.cb : mv.ca;
      // The line's own spacing before the slide, for the two ends.
      let x = lx + c * lpitch;
      if (k === 0 || k === K) {
        const own = k === 0 ? aPos.indexOf(c) : bPos.indexOf(c);
        if (own >= 0) x = lx + (own * lpitch) + (c * lpitch - own * lpitch) * slide;
      }
      const isNew = mv.k === k && k > 0;
      let colr = k === 0 ? CA : k === K ? CB : mix(CA, CB, k / K);
      if (done && mv.op !== "M") colr = OPC[mv.op];
      const a = (0.55 + 0.25 * (k === 0 || k === K ? 1 : reveal) + 0.2 * hot) * (k === 0 || k === K ? 1 : reveal);
      if (ch2) glyph(ch2, round(x), y, ls, isNew && hot > 0 ? mix(colr, WHITE, hot) : colr, min(1, a + (done && mv.op !== "M" ? 0.2 : 0)));
      else if (done && mv.op === "D") {
        // A letter struck out leaves a dash in its column, and a letter not yet put in, a faint tick.
        rect(round(x), y + floor(lh / 2), lw, ls, OPC.D, 0.7 * reveal);
      } else if (mv.op === "I") rect(round(x), y + lh - ls, lw, ls, OPC.I, 0.28 * reveal);
    }
    // The icon of the edit that made this line, and the cost so far.
    if (k > 0) {
      const mv = moves.find((q) => q.k === k), ic = OPC[mv.op];
      if (t >= stepTime[k]) {
        const a = 0.75 + 0.25 * hot;
        icon(mv.op, 1, y + floor((lh - 3) / 2), mix(ic, WHITE, hot * 0.7), a);
        glyph(String(G.cum[k]), 5, y + floor((lh - 5) / 2), 1, WHITE, 0.55 + 0.45 * hot);
      }
    } else if (slide > 0.5) glyph("0", 5, y + floor((lh - 5) / 2), 1, WHITE, 0.5);
  }

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
