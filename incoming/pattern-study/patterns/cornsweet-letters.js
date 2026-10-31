// ===== Patternflow pattern =====
// Title:   Cornsweet Letters
// Family:  type
// Idea:    Three bold letters stacked down the tall panel are filled with exactly the ground's own colour and differ from it only along their outlines, where a sharp step falls back to the ground level within 4.5 LEDs inside and 6 outside, so a letter whose step is lighter on the inside looks lighter than the ground and one whose step is darker looks darker, and as each letter's step turns over, a third of a turn after the one above, the same untouched interiors seem to brighten, vanish into the ground and darken.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Craik-O'Brien-Cornsweet illusion (Vernon O'Brien, 1958; Kenneth Craik, 1966; Tom Cornsweet, 1970), with letters drawn for this pattern as round-ended strokes, pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..1, Cover=0..1
//
// Knob 1: Hue. The ground's hue, letters and all, since the letters are the ground. At 0 a slate azure, at 0.25 violet, at 0.5 a terracotta brown, at 0.75 green.
// Knob 2: Speed. How fast each letter's step turns from lighter inside to darker inside and back: one turn in 12 s at 1, 6 s at the opening 2, 60 s at 0.2 and 4 s at 3. The letters are a third of a turn apart, so at any moment one of them is near its lightest and another near its darkest.
// Knob 3: Word. LIT, DIM, LUX (the unit of illuminance) and NIT (the unit of luminance), a quarter of the knob each.
// Knob 4: Cover. Lays a dark band over the outlines, the way a pencil laid along the edge of Cornsweet's figure takes the illusion away. Nothing up to 0.1, then the band grows until at 1 it covers the whole profile, 4.5 LEDs in and 6 out, and leaves the inner strips of each stroke next to the open ground, the same colour on both sides of the band.

// The illusion carries the names of O'Brien, Craik and Cornsweet. Take a
// uniform field, and along a border put a sharp step that falls back on
// both sides to the field's own level: lighter just inside, darker just
// outside. The inside then looks lighter all the way across, though away
// from the border it sends out exactly the light the outside does. Cover
// the border and both sides look the same.
//
// Here the border is a letter's outline. Each LED's distance to it comes
// from a distance transform of the letter drawn five times finer than the
// panel. The profile is a parabola in that distance, a (1 - d/w)^2 with
// w = 4.5 LEDs inside and 6 outside, so it reaches the ground level exactly
// and the LEDs past it are the ground's own colour, bit for bit, inside the
// letter or not. The height a of the step turns as a cosine: positive, the
// letter looks lighter; zero, it is gone; negative, it looks darker. Where
// two letters' outer profiles meet in the gap between them they add.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, cos, sin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Ground level, the step's half height at its largest, and how far the
// profile reaches inside and outside (LEDs).
const G = 118, C = 88, WIN = 4.5, WOUT = 6;
const SS = 5; // the distance grid has SS x SS cells per LED
const HUE0 = 0.55, SAT = 0.62, COVER = 26;

// Letters as strokes on a unit box, x right and y down. "a" is an arc:
// [cx, cy, rx, ry, from, to] in degrees, 0 to the right, 90 down.
const GLYPHS = {
  L: [[0, 0, 0, 1], [0, 1, 1, 1]],
  I: [[0.5, 0, 0.5, 1]],
  T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  D: [[0, 0, 0, 1], [0, 0, 0.42, 0], [0, 1, 0.42, 1], ["a", 0.42, 0.5, 0.58, 0.5, -90, 90]],
  M: [[0, 1, 0, 0], [0, 0, 0.5, 0.62], [0.5, 0.62, 1, 0], [1, 0, 1, 1]],
  U: [[0, 0, 0, 0.5], ["a", 0.5, 0.5, 0.5, 0.5, 180, 0], [1, 0.5, 1, 0]],
  X: [[0, 0, 1, 1], [1, 0, 0, 1]],
  N: [[0, 1, 0, 0], [0, 0, 1, 1], [1, 1, 1, 0]],
};
const WORDS = ["LIT", "DIM", "LUX", "NIT"];
// Strokes 14 LEDs thick with round ends, letters 36 rows tall and 52 wide
// with 6 rows between them and 4 above the first and below the last.
const RAD = 7, X0 = 13, X1 = 51, LH = 36, GAP = 6, TOP0 = 4;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, word: 0, cover: 0.06, t: 0, built: -1, n: 3,
    dist: [0, 1, 2].map(() => new Float32Array(N)), inside: [0, 1, 2].map(() => new Uint8Array(N)),
    lut: new Uint8Array(256 * 3), lh: -1, c: [0, 0, 0],
  };
}

// Letter k's strokes as panel segments [x0, y0, x1, y1].
function strokes(ch, k) {
  const segs = [];
  const top = TOP0 + k * (LH + GAP) + RAD, bot = TOP0 + k * (LH + GAP) + LH - RAD;
  const px = (u) => X0 + (X1 - X0) * u, py = (v) => top + (bot - top) * v;
  for (const s of GLYPHS[ch]) {
    if (s[0] === "a") {
      const [, cx, cy, rx, ry, a0, a1] = s, n = 12;
      for (let j = 0; j < n; j++) {
        const t0 = ((a0 + ((a1 - a0) * j) / n) * PI) / 180, t1 = ((a0 + ((a1 - a0) * (j + 1)) / n) * PI) / 180;
        segs.push([px(cx + rx * cos(t0)), py(cy + ry * sin(t0)), px(cx + rx * cos(t1)), py(cy + ry * sin(t1))]);
      }
    } else segs.push([px(s[0]), py(s[1]), px(s[2]), py(s[3])]);
  }
  return segs;
}

function segDist(x, y, s) {
  const dx = s[2] - s[0], dy = s[3] - s[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? cl(((x - s[0]) * dx + (y - s[1]) * dy) / l2, 0, 1) : 0;
  const ex = x - s[0] - t * dx, ey = y - s[1] - t * dy;
  return sqrt(ex * ex + ey * ey);
}

// One pass of the squared Euclidean distance transform along a line: the
// lower envelope of parabolas (Felzenszwalb and Huttenlocher, 2004).
function edt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

function edt(grid, gw, gh) {
  const n = max(gw, gh), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < gw; x++) {
    for (let y = 0; y < gh; y++) f[y] = grid[y * gw + x];
    edt1(f, gh, d, v, z);
    for (let y = 0; y < gh; y++) grid[y * gw + x] = d[y];
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) f[x] = grid[y * gw + x];
    edt1(f, gw, d, v, z);
    for (let x = 0; x < gw; x++) grid[y * gw + x] = d[x];
  }
}

// For each letter, every LED's distance to its outline and which side the
// LED is on. Each letter gets its own field over its rows and 8 more above
// and below, so where two outer profiles overlap they can add.
function build(S) {
  const word = WORDS[S.word], INF = 1e12, gw = W * SS, h = SS >> 1;
  S.n = word.length;
  for (let k = 0; k < word.length; k++) {
    const segs = strokes(word[k], k), D = S.dist[k], IN = S.inside[k];
    D.fill(1e9);
    IN.fill(0);
    const y0 = max(0, TOP0 + k * (LH + GAP) - 8), y1 = min(H, TOP0 + k * (LH + GAP) + LH + 8), gh = (y1 - y0) * SS;
    const toIn = new Float64Array(gw * gh), toOut = new Float64Array(gw * gh), ins = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++) {
        const x = (gx + 0.5) / SS, y = y0 + (gy + 0.5) / SS;
        let dmin = 1e9;
        for (const s of segs) {
          const dd = segDist(x, y, s);
          if (dd < dmin) dmin = dd;
        }
        const i = gy * gw + gx, inn = dmin <= RAD ? 1 : 0;
        ins[i] = inn;
        toIn[i] = inn ? 0 : INF;
        toOut[i] = inn ? INF : 0;
      }
    edt(toIn, gw, gh);
    edt(toOut, gw, gh);
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < W; x++) {
        const g = ((y - y0) * SS + h) * gw + x * SS + h, i = y * W + x;
        IN[i] = ins[g];
        // From the cell's centre to the nearest cell on the other side,
        // less half a cell: the distance to the outline between them.
        D[i] = (sqrt(ins[g] ? toOut[g] : toIn[g]) - 0.5) / SS;
      }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.word = min(WORDS.length - 1, floor(cl(k[2] || 0, 0, 1) * WORDS.length));
  S.cover = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t += d * S.speed;
  if (S.t > 1200) S.t -= 1200;
  if (S.built !== S.word) {
    S.built = S.word;
    build(S);
  }
}

// One colour for everything: the ground's hue and saturation at each level.
function ramp(S) {
  if (S.lh === S.hue) return;
  S.lh = S.hue;
  for (let v = 0; v < 256; v++) {
    hsv(S.hue + HUE0, SAT, v / 255, S.c);
    S.lut[v * 3] = round(S.c[0] * 255);
    S.lut[v * 3 + 1] = round(S.c[1] * 255);
    S.lut[v * 3 + 2] = round(S.c[2] * 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  ramp(S);
  const L = S.lut, n = S.n;
  // Each letter's step height, a third of a turn behind the letter above.
  const amp = [0, 0, 0];
  for (let k = 0; k < n; k++) amp[k] = C * cos(2 * PI * (S.t / 12 - k / 3));
  const cv = max(0, S.cover - 0.1) / 0.9, cin = cv * WIN, cout = cv * WOUT;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = G, covered = false;
      for (let k = 0; k < n; k++) {
        const dd = S.dist[k][i];
        if (dd >= WOUT) continue;
        if (S.inside[k][i]) {
          if (dd < cin) covered = true;
          else if (dd < WIN) v += amp[k] * (1 - dd / WIN) * (1 - dd / WIN);
        } else if (dd < cout) covered = true;
        else v -= amp[k] * (1 - dd / WOUT) * (1 - dd / WOUT);
      }
      const o = (covered ? COVER : round(cl(v, 0, 255))) * 3;
      display.setPixel(x, y, L[o], L[o + 1], L[o + 2]);
    }
}
