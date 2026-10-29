// ===== Patternflow pattern =====
// Title:   Barrier Grid
// Family:  type
// Idea:    A barrier of dark bars with one slit in every two to four columns slides one column at a time over a print that interleaves a word and its negative column by column, so each step turns the word from light to shadow and back, every fourth step brings the next word, the frames mix while the barrier glides, and a tilted barrier lays moire bands across the word.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: barrier-grid animation as in the scanimation books of Rufus Butler Seder (Gallop!, 2007); moire of two superposed line gratings (Lord Rayleigh, 1874), pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Frames=2..4, Tilt=0..1
//
// Knob 1: Hue. The light behind the slits: at 0 the word glows gold and its negative is the opposite blue, and turning it moves the pair round the wheel, always opposite each other the way a colour negative is.
// Knob 2: Speed. How fast the barrier steps: at 2 a step every 1.6 seconds (held 0.96 s, gliding 0.64 s) and a new word every 6.4 seconds, at 0.2 a step every 16 seconds, at 3 one every 1.07.
// Knob 3: Frames. How many frames the print interleaves, which is the period of the line screen and of the barrier: at 2 every other column is lit, at 3 every third, at 4 every fourth, with the bars wider in between.
// Knob 4: Tilt. Turns the barrier against the print, so the slits drift sideways down the panel by up to three periods at 1 (tilt squared, so 0.06 is nearly level): moire bands cross the word, light in one band and shadow in the next, and roll down it while the barrier glides.

const W = 64, H = 128, N = W * H;
const Q = 3; // supersampling of the glyph masks
const { floor, round, min, max, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Words of light and of looking. A Hangul word is one syllable filling the
// panel; a Latin word is four letters, two by two, 29 by 58 LEDs each.
const WORDS = ["빛", "LOOK", "달", "NEON", "별", "HALO", "밤", "SEEN"];

// Shapes: [kind, add, ...]. kind 0 a rounded box x0 y0 x1 y1 tl tr br bl,
// kind 1 a thick segment x0 y0 x1 y1 width.
function glyph(ch, w, h, s, t) {
  const P = [];
  const rr = (x0, y0, x1, y1, tl = 0, tr = 0, br = 0, bl = 0, add = 1) => P.push([0, add, x0, y0, x1, y1, tl, tr, br, bl]);
  const ln = (x0, y0, x1, y1, wd, add = 1) => P.push([1, add, x0, y0, x1, y1, wd]);
  const R = 13, r = 5;
  switch (ch) {
    case "O":
      rr(0, 0, w, h, R, R, R, R);
      rr(s, t, w - s, h - t, r, r, r, r, 0);
      break;
    case "L":
      rr(0, 0, s, h);
      rr(0, h - t, w, h);
      break;
    case "K":
      rr(0, 0, s, h);
      ln(s - 1, h * 0.58, w - 5, 4, 10);
      ln(s + 5, h * 0.42, w - 5, h - 4, 10);
      rr(w - 9, 0, w, 6, 0, 0, 0, 0, 0);
      break;
    case "N":
      rr(0, 0, s, h);
      rr(w - s, 0, w, h);
      ln(4, 4, w - 4, h - 4, 10);
      break;
    case "E":
      rr(0, 0, s, h);
      rr(0, 0, w, t);
      rr(0, round(h / 2 - t / 2), w - 4, round(h / 2 + t / 2));
      rr(0, h - t, w, h);
      break;
    case "H":
      rr(0, 0, s, h);
      rr(w - s, 0, w, h);
      rr(0, round(h / 2 - t / 2), w, round(h / 2 + t / 2));
      break;
    case "A":
      rr(0, 0, w, h, R, R, 0, 0);
      rr(s, t, w - s, h + 1, r, r, 0, 0, 0);
      rr(0, round(h * 0.55), w, round(h * 0.55) + t);
      break;
    case "S": {
      // Two bowls sharing the middle bar, each open on one side.
      const m = round(h / 2 - t / 2);
      rr(0, 0, w, m + t, R, R, R, R);
      rr(s, t, w - s, m, r, r, r, r, 0);
      rr(w - s, t + 4, w + 1, m, 0, 0, 0, 0, 0);
      rr(0, m, w, h, R, R, R, R);
      rr(s, m + t, w - s, h - t, r, r, r, r, 0);
      rr(-1, m + t, s, h - t - 4, 0, 0, 0, 0, 0);
      break;
    }
    default:
      hangul(ch, w, h, s, t, rr, ln);
  }
  return P;
}

// The four Hangul syllables, each one filling the panel: the initial top
// left, the vowel's stem on the right, the final across the lower half. The
// coordinates are the panel's, and the upright strokes stand on multiples of
// 4 LEDs, so a stroke covers whole columns of the line screen.
function hangul(ch, w, h, s, t, rr, ln) {
  // ㅂ, ㄷ, ㄹ and ㅁ from bars.
  const b = (x0, y0, x1, y1) => {
    const m = round(y0 + (y1 - y0) * 0.45);
    rr(x0, y0, x0 + s, y1);
    rr(x1 - s, y0, x1, y1);
    rr(x0, m, x1, m + t);
    rr(x0, y1 - t, x1, y1);
  };
  const d = (x0, y0, x1, y1) => {
    rr(x0, y0, x1, y0 + t);
    rr(x0, y0, x0 + s, y1);
    rr(x0, y1 - t, x1, y1);
  };
  const rieul = (x0, y0, x1, y1) => {
    const m = round((y0 + y1) / 2 - t / 2);
    rr(x0, y0, x1, y0 + t);
    rr(x1 - s, y0, x1, m + t);
    rr(x0, m, x1, m + t);
    rr(x0, m, x0 + s, y1);
    rr(x0, y1 - t, x1, y1);
  };
  const mieum = (x0, y0, x1, y1) => {
    rr(x0, y0, x1, y1, 2, 2, 2, 2);
    rr(x0 + s, y0 + t, x1 - s, y1 - t, 0, 0, 0, 0, 0);
  };
  // ㅏ: the stem with its arm to the right.
  const a = () => {
    rr(44, 4, 56, 68);
    rr(56, 30, 64, 39);
  };
  if (ch === "빛") {
    b(4, 8, 40, 64);
    rr(48, 4, 60, 70);
    rr(28, 74, 36, 82);
    rr(4, 84, 60, 93);
    ln(32, 95, 12, 124, 13);
    ln(32, 95, 52, 124, 13);
  } else if (ch === "달") {
    d(4, 8, 36, 64);
    a();
    rieul(8, 76, 56, 124);
  } else if (ch === "별") {
    b(4, 8, 32, 64);
    rr(48, 4, 60, 70);
    rr(36, 20, 48, 29);
    rr(36, 42, 48, 51);
    rieul(8, 76, 56, 124);
  } else if (ch === "밤") {
    b(4, 8, 36, 64);
    a();
    mieum(8, 76, 56, 124);
  }
}

function inside(p, x, y) {
  if (p[0] === 0) {
    if (x < p[2] || x > p[4] || y < p[3] || y > p[5]) return false;
    const cx = (p[2] + p[4]) / 2, cy = (p[3] + p[5]) / 2;
    const left = x < cx, top = y < cy;
    const r = left ? (top ? p[6] : p[9]) : top ? p[7] : p[8];
    if (r <= 0) return true;
    const dx = left ? p[2] + r - x : x - (p[4] - r);
    const dy = top ? p[3] + r - y : y - (p[5] - r);
    if (dx <= 0 || dy <= 0) return true;
    return dx * dx + dy * dy <= r * r;
  }
  const ex = p[4] - p[2], ey = p[5] - p[3];
  const u = cl(((x - p[2]) * ex + (y - p[3]) * ey) / (ex * ex + ey * ey), 0, 1);
  const dx = x - p[2] - u * ex, dy = y - p[3] - u * ey;
  return dx * dx + dy * dy <= (p[6] * p[6]) / 4;
}

// The shapes of a word placed on the panel, each with the rows and columns
// of the supersampled mask it may touch.
function layout(word) {
  const chars = [...word];
  const big = chars.length === 1;
  const cells = big ? [[0, 0, 64, 128]] : [[2, 4, 29, 58], [33, 4, 29, 58], [2, 66, 29, 58], [33, 66, 29, 58]];
  const out = [];
  chars.forEach((ch, gi) => {
    const [cx, cy, w, h] = cells[gi];
    for (const p of glyph(ch, w, h, big ? 12 : 8, big ? 9 : 7)) {
      let x0, y0, x1, y1;
      if (p[0] === 0) (x0 = p[2]), (y0 = p[3]), (x1 = p[4]), (y1 = p[5]);
      else {
        const r = p[6] / 2;
        (x0 = min(p[2], p[4]) - r), (x1 = max(p[2], p[4]) + r), (y0 = min(p[3], p[5]) - r), (y1 = max(p[3], p[5]) + r);
      }
      out.push({
        p, cx, cy,
        sx0: max(cx * Q, floor((cx + x0) * Q)), sx1: min((cx + w) * Q, ceil((cx + x1) * Q)),
        sy0: max(cy * Q, floor((cy + y0) * Q)), sy1: min((cy + h) * Q, ceil((cy + y1) * Q)),
      });
    }
  });
  return out;
}

// A word's mask is built 8 rows at a time, a few frames ahead of the step
// that needs it, so no frame pays for a whole word. Each shape inks (1) or
// cuts (0) the samples inside it, in order, and the samples are averaged
// back to coverage per LED.
const CHUNK = 8;
function buildRows(B, rows) {
  const r0 = B.row, r1 = min(H, r0 + rows);
  const hi = B.hi, WQ = W * Q;
  for (const sh of B.shapes) {
    const sy0 = max(sh.sy0, r0 * Q), sy1 = min(sh.sy1, r1 * Q);
    for (let sy = sy0; sy < sy1; sy++)
      for (let sx = sh.sx0; sx < sh.sx1; sx++)
        if (inside(sh.p, (sx + 0.5) / Q - sh.cx, (sy + 0.5) / Q - sh.cy)) hi[sy * WQ + sx] = sh.p[1];
  }
  for (let y = r0; y < r1; y++)
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let j = 0; j < Q; j++) for (let i = 0; i < Q; i++) n += hi[(y * Q + j) * WQ + x * Q + i];
      B.m[y * W + x] = n / (Q * Q);
    }
  B.row = r1;
}

function job(S, wi) {
  if (!S.jobs[wi]) S.jobs[wi] = { shapes: layout(WORDS[wi]), hi: new Uint8Array(W * Q * H * Q), m: new Float32Array(N), row: 0 };
  return S.jobs[wi];
}

// The mask now: finished at once if the background builder has not got there.
function mask(S, wi) {
  const B = job(S, wi);
  if (B.row < H) buildRows(B, H);
  return B.m;
}

export function setup(params) {
  params.s = { jobs: [], u: 0, hue: 0, n: 2, tilt: 0.06, col: new Float32Array(H * 6), bar: new Float32Array(6) };
}

// The stream of frames: each word four times, light, shadow, light, shadow.
const REPEAT = 4;
const wordOf = (f) => floor(f / REPEAT) % WORDS.length;

// A step lasts STEP seconds at Speed 2, and the barrier glides for the last
// GLIDE of it. The bars are pierced on a checkerboard: a hole catches G1 of
// the light in the slits beside it and lets G2 of the print under the bar
// show through. OVER brightens a half-open column, so in mid-glide both
// frames shine at 0.8.
const STEP = 1.6, GLIDE = 0.4;
const G1 = 0.35, G2 = 0.2, OVER = 1.6;

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt, 0, 0.1);
  S.hue = k[0];
  S.n = cl(round(k[2]), 2, 4);
  S.tilt = cl(k[3], 0, 1);
  S.u += (dt * cl(k[1], 0.05, 3)) / 2 / STEP;
  // Build ahead: the first unfinished word among those the print holds now
  // and the next one it will need.
  for (let f = floor(S.u); f <= floor(S.u) + S.n + REPEAT; f++) {
    const B = job(S, wordOf(f));
    if (B.row < H) {
      buildRows(B, CHUNK);
      break;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  const n = S.n;
  const K = floor(S.u);
  const e = S.u - K;
  const g = e < 1 - GLIDE ? 0 : (e - 1 + GLIDE) / GLIDE;
  // The barrier's place in columns: on step K the slits stand over the
  // columns of slot K mod n, and in the glide they ease one column right.
  const b = K + g * g * (3 - 2 * g);
  // Slot s of the print holds the frame f of K..K+n-1 with f = s mod n. A
  // slot the barrier has just left is printed again with the frame n steps
  // on, so the print always carries the frame on show and the next n-1.
  const fw = [], fn = [];
  for (let s = 0; s < n; s++) {
    const f = K + ((((s - K) % n) + n) % n);
    fw.push(mask(S, wordOf(f)));
    fn.push(f % 2);
  }
  // Light for the word (gold at Hue 0) and for its negative (the opposite
  // blue), a little warmer down the panel.
  const col = S.col;
  for (let y = 0; y < H; y++) {
    hsv(0.11 + S.hue - 0.05 * (y / H), 0.62, 1, col, y * 6);
    hsv(0.61 + S.hue - 0.05 * (y / H), 0.62, 1, col, y * 6 + 3);
  }
  // The bars' own faint indigo, and the pale light of the print under them.
  const bar = S.bar;
  hsv(0.7, 0.7, 0.1, bar, 0);
  hsv(0.7, 0.3, 1, bar, 3);
  const shift = S.tilt * S.tilt * 3 * n;
  const o = [0, 0, 0, 0], V = [0, 0, 0, 0];
  const g1 = (G1 * 2) / n, g2 = (G2 * 2) / n;
  for (let y = 0; y < H; y++) {
    // How open each slot's columns are in this row: a slit one column wide,
    // box-filtered over the LED, so the openings of the n slots add to 1.
    const by = b + shift * (y / (H - 1) - 0.5);
    for (let k = 0; k < n; k++) {
      let d = (k - by) % n;
      if (d < 0) d += n;
      o[k] = max(0, 1 - min(d, n - d));
    }
    const c0 = y * 6;
    for (let x = 0; x < W; x++) {
      const s = x % n, p = y * W + x;
      // Every slot's print at this LED, and the light the slits pass, which
      // is what a hole in a bar here would catch.
      let vr = 0, vg = 0, vb = 0;
      for (let k = 0; k < n; k++) {
        const v = fn[k] ? 1 - fw[k][p] : fw[k][p];
        V[k] = v;
        const c = c0 + fn[k] * 3, w = o[k] * v;
        vr += col[c] * w;
        vg += col[c + 1] * w;
        vb += col[c + 2] * w;
      }
      const os = o[s], lit = V[s] * min(1, OVER * os), c = c0 + fn[s] * 3, shut = 1 - os;
      let r = col[c] * lit + bar[0] * shut, gg = col[c + 1] * lit + bar[1] * shut, bb = col[c + 2] * lit + bar[2] * shut;
      if ((x + y) & 1) {
        const h1 = shut * g1, h2 = shut * g2 * V[s];
        r += h1 * vr + h2 * bar[3];
        gg += h1 * vg + h2 * bar[4];
        bb += h1 * vb + h2 * bar[5];
      }
      display.setPixel(x, y, min(255, r * 255) | 0, min(255, gg * 255) | 0, min(255, bb * 255) | 0);
    }
  }
}
