// ===== Patternflow pattern =====
// Title:   Frieze Letters
// Family:  type
// Idea:    Seven strips run down the panel, each one glyph repeated in one of the seven frieze groups the textbook way, b, d, p and q, every glyph coloured by how it sits, and on each beat every strip makes one of its own symmetries, sliding down by its period, gliding, folding pairs of cells over the mirror between them, mirroring across its axis or turning pairs half round, so that it lands exactly where it began, while a caption names one strip at a time by the group its pixels really have, in Conway's words and orbifold signature, so that with a symmetric glyph such as A or H strips built in different ways end as the same frieze under the same name.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the seven frieze groups with John Conway's names and orbifold signatures (John H. Conway, Heidi Burgiel and Chaim Goodman-Strauss, The Symmetries of Things, 2008), shown the textbook way with b, d, p and q; 5 by 7 glyphs, Hangul included, and 3 by 5 caption letters drawn for this pattern, pattern round 76
// Round:   76
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Glyph=0..1, Marks=-1..1
//
// Knob 1: Hue. Turns the four colours round the wheel together. A glyph's colour says how it sits: at 0 the glyph as drawn (b) is azure, mirrored left to right (d) pink, upside down (p) yellow and turned half round (q) green. Ways of sitting that look alike take the first one's colour, so A and its mirror are both azure and the upside-down A is yellow.
// Knob 2: Speed. A beat lasts 3 / Speed seconds, 1.5 s at the opening 2: every strip makes its motion in the first 0.9 s and holds for 0.6 s. 15 s at 0.2, 1 s at 3. The caption moves to the next strip every two beats.
// Knob 3: Glyph. Ten glyphs, a tenth of the knob each: b, F, R, J, ㄱ and 가 have no symmetry of their own and give seven different friezes. N has a half-turn: hop and spinning hop draw the same strip, and so do step and sidle, five pictures in four groups. E has a mirror across: hop is sidle, step is spinning hop and jump is spinning jump, four pictures in three groups. A has a mirror down its middle: hop and step are one picture, sidle, spinning hop and spinning sidle another, and only two groups are left, jump and spinning jump. H has both, and all seven strips are spinning jump.
// Knob 4: Marks. The symmetry of each strip as the pixels have it, in grey under the glyphs: a line across the strip at each mirror across it, a small diamond at each half-turn centre, a line down the axis for a mirror along it and a dotted line for a glide. Off at -1, 35% grey at the opening 0.06, 90% at 1. At any setting the mirror, centre or axis a strip is moving about flashes white while it moves.
// Buttons: K1 tap starts the next beat at once.

const W = 64, H = 128, GW = 5, GH = 7, CH = 12, TOPY = -3, FBOT = 112;
const { floor, min, max, round, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);

// The glyphs, 5 by 7, drawn for this pattern.
const GLYPHS = [
  "#.... #.... #.##. ##..# #...# #...# ####.", // b
  "##### #.... #.... ####. #.... #.... #....", // F
  "####. #...# #...# ####. #.#.. #..#. #...#", // R
  "..### ...#. ...#. ...#. ...#. #..#. .##..", // J
  "##### ....# ....# ....# ....# ...#. ..#..", // ㄱ
  "...#. ##.#. .#.#. .#.## .#.#. #..#. ...#.", // 가
  "#...# #...# ##..# #.#.# #..## #...# #...#", // N, a half-turn
  "##### #.... #.... ####. #.... #.... #####", // E, a mirror across
  ".###. #...# #...# ##### #...# #...# #...#", // A, a mirror along
  "#...# #...# #...# ##### #...# #...# #...#", // H, both
].map((s) => s.replace(/ /g, "").split("").map((c) => c === "#"));

// The four ways a glyph can sit: as drawn, mirrored left to right (b to d),
// upside down (b to p), turned half round (b to q).
const I = 0, V = 1, M = 2, R = 3;
// Doing one after another is t ^ u: the four form the Klein group, V M = R.
function variant(g, t) {
  const o = new Array(GW * GH);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const sx = t & 1 ? GW - 1 - x : x, sy = t & 2 ? GH - 1 - y : y;
      o[y * GW + x] = g[sy * GW + sx];
    }
  return o;
}

// The seven friezes, each strip running down the panel. A cell holds one
// glyph, or two in the jumps, the second the first mirrored across the
// strip's axis. The textbook runs its friezes across the page; here they run
// down, so b to d is the mirror along the axis and b to p the mirror across
// it, and the textbook's sidle, b d b d, is b p b p. seq gives how the glyph
// sits in a cell by its place in the period, and ops the motions the strip
// makes, one a beat, in turn. Each is a symmetry of the strip, so it ends
// where it began: T slides the strip down n cells, G mirrors it across its
// axis as it slides, A mirrors it across its axis, Mp folds each pair of
// cells over the mirror between them and Rp turns each pair half round about
// the centre between them.
const FRIEZES = [
  { name: "HOP", sig: "∞∞", seq: [I], ops: [["T", 1]] },
  { name: "STEP", sig: "∞×", seq: [I, V], ops: [["G", 1]] },
  { name: "SIDLE", sig: "*∞∞", seq: [I, M], ops: [["Mp"], ["T", 2]] },
  { name: "SPINNING HOP", sig: "22∞", seq: [I, R], ops: [["Rp"], ["T", 2]] },
  { name: "SPINNING SIDLE", sig: "2*∞", seq: [I, M, V, R], ops: [["Mp"], ["Rp"], ["G", 2], ["T", 4]] },
  { name: "JUMP", sig: "∞*", seq: [I], twin: true, ops: [["A"], ["T", 1]] },
  { name: "SPINNING JUMP", sig: "*22∞", seq: [I, M], twin: true, ops: [["A"], ["Mp"], ["Rp"], ["T", 2]] },
];
const COLX = [0, 8, 16, 24, 32, 40, 53];
const colW = (f) => (FRIEZES[f].twin ? 2 * GW + 1 : GW);
// Slot j, counted down from the top, holds the cell with place -j.
const seqAt = (f, k) => {
  const s = FRIEZES[f].seq;
  return s[((k % s.length) + s.length) % s.length];
};
const tauAt = (f, j) => seqAt(f, -j);

// 3 by 5 capitals for the caption, N and M wider, and the orbifold signs.
const CAP = {
  H: "#.# #.# ### #.# #.#", O: ".#. #.# #.# #.# .#.", P: "##. #.# ##. #.. #..", S: ".## #.. .#. ..# ##.",
  T: "### .#. .#. .#. .#.", E: "### #.. ##. #.. ###", I: "### .#. .#. .#. ###", D: "##. #.# #.# #.# ##.",
  L: "#.. #.. #.. #.. ###", N: "#..# ##.# #.## #..# #..#", G: ".## #.. #.# #.# .##", J: "..# ..# ..# #.# .#.",
  U: "#.# #.# #.# #.# ###", M: "#...# ##.## #.#.# #...# #...#", 2: "##. ..# .#. #.. ###",
  "∞": "..... .#.#. #.#.# .#.#. .....", "*": "..#.. #.#.# .###. #.#.# ..#..", "×": "... #.# .#. #.# ...", " ": ". . . . .",
};

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - i;
  const c = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  for (let q = 0; q < 3; q++) o[q] = v * (1 - s + s * c[q]);
  return o;
}

// Four cells of a frieze, a whole period of every one, as a bitmap laid out
// like slots 0 to 3, so the marks found in it fall where the cells are drawn.
function periodMap(f, vars) {
  const cw = colW(f), L = 4 * CH, b = new Uint8Array(L * cw);
  for (let m = 0; m < 4; m++) {
    const t = tauAt(f, m);
    const put = (v, x0) => {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (v[y * GW + x]) b[(m * CH + y) * cw + x0 + x] = 1;
    };
    put(vars[t], 0);
    if (FRIEZES[f].twin) put(vars[t ^ V], GW + 1);
  }
  return b;
}

// Which of the seven groups a frieze of this glyph really has, found from
// the pixels: a symmetric glyph adds symmetry, and two constructions can
// end in the same frieze. Also where its mirrors and half-turn centres are.
function analyse(f, vars) {
  const cw = colW(f), L = 4 * CH, b = periodMap(f, vars);
  const at = (y, x) => b[(((y % L) + L) % L) * cw + x];
  const test = (fn) => {
    for (let y = 0; y < L; y++) for (let x = 0; x < cw; x++) if (at(y, x) !== fn(y, x)) return false;
    return true;
  };
  const axis = test((y, x) => at(y, cw - 1 - x));
  const mir = [], rot = [];
  for (let h = 0; h < 2 * L; h++) {
    if (test((y, x) => at(h - y, x))) mir.push(h);
    if (test((y, x) => at(h - y, cw - 1 - x))) rot.push(h);
  }
  let glide = false;
  for (let s = 1; s < L && !axis && !glide; s++) glide = test((y, x) => at(y + s, cw - 1 - x));
  const g = axis && mir.length ? 6 : axis ? 5 : mir.length && rot.length ? 4 : mir.length ? 2 : rot.length ? 3 : glide ? 1 : 0;
  return { g, axis, glide, mir, rot };
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, gi: -1, marks: 0.5, ph: 0, vars: null, cls: [0, 1, 2, 3], an: [],
    buf: new Float32Array(W * H * 3), pal: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const gi = min(GLYPHS.length - 1, floor(cl(k[2] || 0, 0, 1) * GLYPHS.length));
  if (gi !== S.gi) {
    S.gi = gi;
    S.vars = [I, V, M, R].map((t) => variant(GLYPHS[gi], t));
    // Ways of sitting that look the same share a colour: b, d, p and q are
    // four, A and its mirror are one.
    S.cls = [I, V, M, R].map((t) => {
      for (let u = 0; u < t; u++) if (S.vars[u].every((v, i) => v === S.vars[t][i])) return u;
      return t;
    });
    S.an = FRIEZES.map((_, f) => analyse(f, S.vars));
  }
  S.marks = (cl(k[3] == null ? 0.06 : k[3], -1, 1) + 1) / 2;
  if (input.btnPressed && input.btnPressed[0]) S.ph = floor(S.ph) + 1;
  S.ph += (d * S.speed) / 3;
}

// One glyph through an affine motion: the LED at p shows the glyph's pixel
// at A^-1 (p - c), counted from the glyph's centre, c being where that
// centre has got to.
function glyph(S, src, a, b, c, d, cx, cy, col) {
  const det = a * d - b * c || 1e-3, buf = S.buf;
  for (let y = max(0, floor(cy - 5)); y <= min(FBOT - 1, floor(cy + 5)); y++)
    for (let x = max(0, floor(cx - 5)); x <= min(W - 1, floor(cx + 5)); x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const gx = floor((d * px - b * py) / det + GW / 2), gy = floor((-c * px + a * py) / det + GH / 2);
      if (gx < 0 || gx >= GW || gy < 0 || gy >= GH || !src[gy * GW + gx]) continue;
      const q = (y * W + x) * 3;
      buf[q] = col[0];
      buf[q + 1] = col[1];
      buf[q + 2] = col[2];
    }
}

function mark(S, x, y, a) {
  if (x < 0 || x >= W || y < 0 || y >= FBOT) return;
  const q = (y * W + x) * 3;
  S.buf[q] = S.buf[q + 1] = S.buf[q + 2] = max(S.buf[q], a);
}

// The gaps (j, j + 1) where the cell below is the cell above under op t:
// M for a mirror across the strip, R for a half-turn. Taken top down so no
// cell is in two pairs.
function pairs(f, t, j0, j1) {
  const out = [];
  for (let j = j0; j < j1; j++) if ((tauAt(f, j) ^ tauAt(f, j + 1)) === t) out.push(j++);
  return out;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.vars) return;
  const b = S.buf;
  b.fill(0);
  // A beat: every strip makes its next motion in the first 60%, then holds.
  const beat = floor(S.ph), u = S.ph - beat, e = ease(min(1, u / 0.6)), fl = sin(PI * min(1, u / 0.6));
  const hl = floor(beat / 2) % FRIEZES.length;
  for (let c = 0; c < 4; c++) hsv(S.hue + [0.58, 0.9, 0.14, 0.36][c], 0.75, 1, S.pal[c]);
  const ma = 0.9 * S.marks ** 1.5;
  for (let f = 0; f < FRIEZES.length; f++) {
    const fr = FRIEZES[f], an = S.an[f], x0 = COLX[f], cw = colW(f), ax = x0 + cw / 2;
    const op = fr.ops[beat % fr.ops.length], kind = op[0], n = op[1] || 0;
    const yc = (j) => TOPY + j * CH + GH / 2;
    const gx = fr.twin ? [x0 + GW / 2, x0 + GW + 1 + GW / 2] : [x0 + GW / 2];
    const mp = kind === "Mp" ? pairs(f, M, -5, 16) : [];
    const rp = kind === "Rp" ? pairs(f, fr.twin ? M : R, -5, 16) : [];
    // Marks of the strip's real symmetry, under the glyphs: mirrors across
    // it as lines, half-turn centres as small diamonds, a mirror along the
    // axis as a line down it and a glide as a dotted one. The ones the
    // motion uses light up while it moves.
    const axf = kind === "A" || kind === "G" ? fl : 0;
    for (let y = 0; y < FBOT; y++) {
      if (an.axis || (an.glide && y % 3 === 0)) mark(S, floor(ax), y, ma);
      if (axf && (kind === "A" || y % 3 === 0)) mark(S, floor(ax), y, axf);
    }
    for (let j = -1; j <= 12; j++) {
      const yk = TOPY + j * CH, m = ((j % 4) + 4) % 4;
      for (const h of an.mir) {
        const r = floor(h / 2) - m * CH;
        if (r >= 0 && r < CH) for (let x = x0 - 1; x <= x0 + cw; x++) mark(S, x, yk + r, ma);
      }
      for (const h of an.rot) {
        const r = floor(h / 2) - m * CH;
        if (r >= 0 && r < CH) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) mark(S, floor(ax) + dx, yk + r + dy, ma);
      }
    }
    const gapY = TOPY + GH + (CH - GH - 1) / 2;
    for (const j of mp) for (let x = x0 - 1; x <= x0 + cw; x++) mark(S, x, gapY + j * CH, fl);
    for (const j of rp) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) mark(S, floor(ax) + dx, gapY + j * CH + dy, fl);
    // The glyphs. Each one's colour is the look it lands in, from halfway.
    const draw1 = (t, t2, c0x, c0y, A, c1x, c1y) => glyph(S, S.vars[t], A[0], A[1], A[2], A[3], c1x, c1y, S.pal[S.cls[e < 0.5 ? t : t2]]);
    const sc = cos(PI * e), sn = sin(PI * e);
    for (let j = -n - 1; j <= 12; j++) {
      const t0 = tauAt(f, j);
      for (let g = 0; g < gx.length; g++) {
        const t = g ? t0 ^ V : t0, cx = gx[g], cy = yc(j);
        if (kind === "T") draw1(t, t, cx, cy, [1, 0, 0, 1], cx, cy + n * CH * e);
        else if (kind === "G") draw1(t, t ^ V, cx, cy, [sc, 0, 0, 1], ax + (cx - ax) * sc, cy + n * CH * e);
        else if (kind === "A") draw1(t, t ^ V, cx, cy, [sc, 0, 0, 1], ax + (cx - ax) * sc, cy);
        else if (kind === "Mp") {
          const p = mp.indexOf(j) >= 0 ? j : mp.indexOf(j - 1) >= 0 ? j - 1 : null;
          if (p === null) draw1(t, t, cx, cy, [1, 0, 0, 1], cx, cy);
          else {
            const ym = gapY + p * CH + 0.5;
            draw1(t, t ^ M, cx, cy, [1, 0, 0, sc], cx, ym + (cy - ym) * sc);
          }
        } else {
          const p = rp.indexOf(j) >= 0 ? j + 1 : rp.indexOf(j - 1) >= 0 ? j - 1 : null;
          if (p === null) draw1(t, t, cx, cy, [1, 0, 0, 1], cx, cy);
          else {
            // Turned about its own centre while the centre runs straight to
            // its partner's place: the same end as the half-turn about the
            // point between them, kept inside the strip.
            const tx = fr.twin ? gx[1 - g] : cx, ty = yc(p);
            draw1(t, t ^ R, cx, cy, [sc, -sn, sn, sc], cx + (tx - cx) * e, cy + (ty - cy) * e);
          }
        }
      }
    }
  }
  // The caption: the group of one strip at a time, read from what its
  // pixels do, under a bar over the strip it names.
  const an = S.an[hl], fr = FRIEZES[an.g], ink = 0.85;
  for (let x = COLX[hl]; x < COLX[hl] + colW(hl); x++) for (let y = FBOT + 1; y < FBOT + 3; y++) b.fill(ink, (y * W + x) * 3, (y * W + x) * 3 + 3);
  const text = (s, y0) => {
    const gl = [...s].map((ch) => CAP[ch].split(" "));
    let wd = -1;
    for (const g of gl) wd += g[0].length + 1;
    let x = floor((W - wd) / 2);
    for (const g of gl) {
      for (let r = 0; r < 5; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === "#") b.fill(ink, ((y0 + r) * W + x + q) * 3, ((y0 + r) * W + x + q) * 3 + 3);
      x += g[0].length + 1;
    }
  };
  text(fr.name, FBOT + 5);
  text(fr.sig, FBOT + 11);
  for (let p = 0; p < W * H; p++) {
    const x = p % W, y = (p - x) / W;
    display.setPixel(x, y, round(cl(b[p * 3], 0, 1) * 255), round(cl(b[p * 3 + 1], 0, 1) * 255), round(cl(b[p * 3 + 2], 0, 1) * 255));
  }
}
