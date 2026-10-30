// ===== Patternflow pattern =====
// Title:   Word Bokeh
// Family:  type
// Idea:    Points of light at different depths seen through a lens whose aperture is cut in the shape of a word, so every light out of focus is drawn as the word, upright behind the plane of focus and turned 180 degrees in front of it, while the focus pulls slowly through the scene and each light shrinks to a point and swells into the word again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: bokeh (Japanese boke, blur; spelled with an h and brought into English by Mike Johnston's Photo Techniques, 1997), the thin-lens circle of confusion, the shaped aperture, pattern round 78
// Round:   78
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Word=0..1, Stop=1.4..2.8
//
// Knob 1: Hue. Turns the three colours of the lights round the wheel together. At 0 they are sky blue, magenta and golden yellow, and where words cross their light adds, to near white where all three do.
// Knob 2: Speed. The focus pull. One cycle, near to far and back, takes 12 s at 2: the words stand upright, shrink to points, open out turned over 6 s later, and come back. 120 s at 0.2, 8 s at 3.
// Knob 3: Word. The word cut in the aperture, a fifth of the knob each: BOKE, LUX, BLUR, GLOW, LENS.
// Knob 4: Stop. The f-number. The blur goes as the aperture diameter, F/N, so it halves from f/1.4 to f/2.8: at the ends of the pull the largest word stands 14 LEDs tall at f/1.4 (BOKE is then 46 wide), 10 at f/2 and 7 at f/2.8.

// Thin lens, focal length F, aperture diameter A = F/N, focused at depth f.
// A point at depth d comes to focus in front of the sensor or behind it, and
// the cone of light through the aperture cuts the sensor in a copy of the
// aperture, the circle of confusion, of diameter about A F |1/d - 1/f|. The
// sign matters. For a point behind the plane of focus (d > f) the rays meet
// before the sensor and cross, so the copy on the sensor is turned 180
// degrees, and the lens has already turned the whole picture 180 degrees: the
// light is drawn upright, the word as it reads from behind the lens. For a
// point in front of it (d < f) the rays have not met yet and the light is
// drawn turned 180 degrees. Every light here gets the signed scale
// s = K (1/f - 1/d) / N, LEDs per cell of the word, and is drawn as the word
// scaled by s about its own centre; a negative s turns it over by itself.
// Each LED is lit by how much of its square the scaled word's ink covers,
// read exactly from a summed-area table of the 5 by 7 letters, so a word 1.6
// LEDs to the cell keeps clean strokes and a light in focus folds into one
// LED.
//
// The 21 lights lie within 1/3 either side of the middle of the scene in
// inverse depth (1/d), and the focus swings to 1 either side, so the ends of
// the pull are beyond every light: at the near end every light is behind the
// plane of focus and upright, at the far end every one is in front and
// turned, and at f/1.4 each is a word 7 to 14 LEDs tall. The focus offset
// goes as sin^2.3 of the phase, so it lingers in the middle, where it passes
// the lights one by one while they are small and turns each over as it goes
// by. Below 0.7 LEDs to the cell a light keeps all its power as its word
// shrinks, so near focus the words burn out into short bright bars.

const W = 64, H = 128, N = W * H, CH = 7, NL = 21;
const { floor, min, max, abs, sin, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// 5 by 7 capitals, drawn for this pattern.
const FONT = {
  B: "####. #...# #...# ####. #...# #...# ####.",
  O: ".###. #...# #...# #...# #...# #...# .###.",
  K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#",
  E: "##### #.... #.... ####. #.... #.... #####",
  L: "#.... #.... #.... #.... #.... #.... #####",
  U: "#...# #...# #...# #...# #...# #...# .###.",
  X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  R: "####. #...# #...# ####. #.#.. #..#. #...#",
  G: ".###. #...# #.... #.### #...# #...# .###.",
  W: "#...# #...# #...# #.#.# #.#.# ##.## #...#",
  N: "#...# ##..# #.#.# #..## #...# #...# #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.",
};
const WORDS = ["BOKE", "LUX", "BLUR", "GLOW", "LENS"];

// A word as an aperture: its width in cells, its ink area, and the table
// F(i, j) = ink in cells [0, i) x [0, j), from which the ink in any
// rectangle comes by bilinear reads, exactly.
function aperture(word) {
  const w = word.length * 6 - 1, F = new Float32Array((w + 1) * (CH + 1));
  const ink = (i, j) => {
    const c = floor(i / 6), q = i % 6;
    return q < 5 && FONT[word[c]].split(" ")[j][q] === "#" ? 1 : 0;
  };
  for (let j = 1; j <= CH; j++)
    for (let i = 1; i <= w; i++) F[j * (w + 1) + i] = ink(i - 1, j - 1) + F[(j - 1) * (w + 1) + i] + F[j * (w + 1) + i - 1] - F[(j - 1) * (w + 1) + i - 1];
  return { w, F, area: F[CH * (w + 1) + w] };
}
const APS = WORDS.map(aperture);

function hsv(h, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const v = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  o[0] = v[0];
  o[1] = v[1];
  o[2] = v[2];
  return o;
}

// Inverse depths about the middle of the scene: the lights lie between
// -SPREAD and +SPREAD, the focus swings between -PULL and +PULL.
const SPREAD = 1 / 3, PULL = 1, K = 1.5, SHAPE = 2.3, HUES = [0.53, 0.86, 0.13];

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, word: 0, stop: 1.4, ph: PI / 6,
    x: new Float32Array(NL), y: new Float32Array(NL), z: new Float32Array(NL), g: new Float32Array(NL), c: new Uint8Array(NL),
    buf: new Float32Array(N * 3), cu: new Float32Array(W + 1), cv: new Float32Array(H + 1), rgb: [0, 0, 0],
  });
  // Columns, rows and depths each spread evenly, then paired at random, so
  // the words do not pile up in one place or one plane.
  const shuffle = () => {
    const a = [];
    for (let i = 0; i < NL; i++) a.splice(floor(Math.random() * (i + 1)), 0, i);
    return a;
  };
  const cols = shuffle(), rows = shuffle();
  for (let i = 0; i < NL; i++) {
    S.x[i] = 8 + ((W - 16) * (cols[i] + Math.random())) / NL;
    S.y[i] = 5 + ((H - 10) * (rows[i] + Math.random())) / NL;
    S.z[i] = -SPREAD + (2 * SPREAD * (i + Math.random())) / NL;
    S.g[i] = 0.75 + 0.25 * Math.random();
    S.c[i] = i % 3;
  }
  return S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.word = min(WORDS.length - 1, floor(cl(k[2] || 0, 0, 1) * WORDS.length));
  S.stop = cl(k[3] == null ? 1.4 : k[3], 1.4, 2.8);
  // 12 s a cycle at Speed 2.
  S.ph += (d * S.speed * PI) / 12;
}

// Ink of the aperture in [0, u) x [0, v), u and v in cells.
function inkTo(F, w, u, v) {
  u = cl(u, 0, w);
  v = cl(v, 0, CH);
  const i = min(w - 1, floor(u)), j = min(CH - 1, floor(v)), a = u - i, b = v - j, r = w + 1;
  const f00 = F[j * r + i], f10 = F[j * r + i + 1], f01 = F[(j + 1) * r + i], f11 = F[(j + 1) * r + i + 1];
  return f00 + a * (f10 - f00) + b * (f01 - f00) + a * b * (f11 - f10 - f01 + f00);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, ap = APS[S.word], F = ap.F, w = ap.w, cu = S.cu, cv = S.cv, col = S.rgb;
  buf.fill(0);
  const sn = sin(S.ph), focus = PULL * (sn < 0 ? -1 : 1) * abs(sn) ** SHAPE, gain = (K * 1.4) / S.stop;
  for (let n = 0; n < NL; n++) {
    let s = gain * (focus - S.z[n]);
    if (abs(s) < 0.04) s = s < 0 ? -0.04 : 0.04;
    const as = abs(s), lx = S.x[n], ly = S.y[n];
    // Surface brightness: even over a word of 0.7 LEDs to the cell and
    // more, overdriven 1.8 times so the strokes stay whole after clamping.
    // Below that the light keeps its whole power and spreads it less, so a
    // small word burns out and a light in focus is one bright LED.
    const lum = S.g[n] * 1.8 * max(1, 0.45 / (s * s));
    hsv(S.hue + HUES[S.c[n]], col);
    const x0 = max(0, floor(lx - (w * as) / 2)), x1 = min(W - 1, floor(lx + (w * as) / 2));
    const y0 = max(0, floor(ly - (CH * as) / 2)), y1 = min(H - 1, floor(ly + (CH * as) / 2));
    // Cell coordinates of each LED edge; a negative s runs them backwards,
    // which is the 180 degree turn.
    for (let x = x0; x <= x1 + 1; x++) cu[x - x0] = (x - lx) / s + w / 2;
    for (let y = y0; y <= y1 + 1; y++) cv[y - y0] = (y - ly) / s + CH / 2;
    const s2 = s * s * lum;
    for (let y = y0; y <= y1; y++) {
      let va = cv[y - y0], vb = cv[y - y0 + 1];
      if (va > vb) (vb = va), (va = cv[y - y0 + 1]);
      for (let x = x0; x <= x1; x++) {
        let ua = cu[x - x0], ub = cu[x - x0 + 1];
        if (ua > ub) (ub = ua), (ua = cu[x - x0 + 1]);
        const c = (inkTo(F, w, ub, vb) - inkTo(F, w, ua, vb) - inkTo(F, w, ub, va) + inkTo(F, w, ua, va)) * s2;
        if (c <= 0.001) continue;
        const p = (y * W + x) * 3;
        buf[p] += c * col[0];
        buf[p + 1] += c * col[1];
        buf[p + 2] += c * col[2];
      }
    }
  }
  for (let i = 0; i < N; i++) display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
