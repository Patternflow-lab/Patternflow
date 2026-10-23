// ===== Patternflow pattern =====
// Title:   Pop-up Book
// Family:  paper
// Idea:    A pop-up book lies open under a reading lamp: each spread's cut-card scene stands up out of the gutter in layers and its paper parts move, until the page turns over, folds it flat and raises the next.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after layered pop-up books, tunnel books and the pull-tab movable books of the nineteenth century
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Spread=0..3, Speed=0.2..3, Layers=4..6, Lamp=0..1
//
// Knob 1: Spread. Which spread the book is open at: a castle at dusk at 0, a pine forest with a stag at 1, a lighthouse at night at 2, a city at 3. Turned, the book leafs over to it and reads on from there.
// Knob 2: Speed. How fast the pages and the paper parts go: at 2 a spread stands seven seconds and a page turns in under three.
// Knob 3: Layers. How many cards stand: sky, main piece, front strip and a flying piece at 4, hills, a swell with a sailing boat or a far skyline at 5, and at 6 a tunnel-book frame across the front (a rose arch, pine boughs, a sea cave, a theatre curtain).
// Knob 4: Lamp. Where the light comes from: a warm lamp low on the left at 0, overhead at 0.5, cool daylight from the right at 1. The folds swap their lit and shaded faces and the shadows swing.
// Buttons: K1 tap turns the page now.

const [W, H] = [64, 128];
const N = W * H;
// The gutter's row, a page's depth (the tallest a card may stand), and how far
// a unit of depth climbs the panel for a viewer a little above the book.
const [G, D, K] = [102, 74, 0.2];
// Cards 56 wide from column 4, pages 58 from column 3, the table's back edge.
const [CW, X0, PW, P0, TB] = [56, 4, 58, 3, 80];
// A texel on a face turned to the left or to the right.
const [LF, RF] = [64, 128];
const [STAND, TURN, OPEN] = [0, 1, 2];
// The order cards rise in: the main piece first, the sky last but for the frame.
const ORDER = [4, 0, 1, 3, 2, 5];
const { min, max, floor, ceil, round, sin, cos, abs, sqrt, exp, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
const mix = (a, b, t) => a + (b - a) * t;

// Card and paper colours. Lit windows, the beam and a lit gateway glow on their own.
const PAL = [[0, 0, 0]], EM = new Uint8Array(64);
const [stone, ink, dark, roof, yel, peach, pink, mauve, violet, hill, white, cream, green, greend, wood, warm, blush, skyw, skyl, skyb, mtn, mtnd, snow, fir, firl, firb, trunk, deer, fly, fern, grey, navy, night, sea, sead, teal, red, glow, rock, black, dusk, mag, indigo, sky2, brick, cteal, purple, glass, win, street, paper, text, cloth] = "dccdb0 ad987c 2a2034 cc3a44 fccc46 fab270 ec7884 ac5492 5c3a8e 40346c f8f6ee faeec4 5aa850 287040 9c6234 f8b860 fadece fadeb0 b0d8f0 76b0e6 7084b8 56689c eef4fa 1c643e 3c8c50 2c6c6c 70462a be7640 dc2828 82c450 9696a0 162058 283a80 245cb2 183c8c 2896a8 d63034 fff0ac 5c5c70 1e1e26 f4885a b0487c 3e347c 48548c a4483c 3a7c7c 70508a 5a6e96 ffd66e 484854 ece0c6 483e3c 8c2430"
  .split(" ")
  .map((h) => PAL.push([0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))) - 1);
EM[win] = EM[glow] = EM[warm] = 1;

// Drawing on a card: x 0..55, y up from the fold at its foot.
let T, TH;
const put = (x, y, c) => ((x = round(x)), (y = round(y)), x >= 0 && x < CW && y >= 0 && y < TH && (T[y * CW + x] = c));
const rect = (x0, y0, x1, y1, c) => {
  for (let y = round(y0); y <= y1; y++) for (let x = round(x0); x <= x1; x++) put(x, y, c);
};
const rects = (list) => list.forEach((r) => rect(...r));
// A body narrowing from half width a to b over rows y0..y1, its left half on a
// face turned left and its right half turned right: towers, tiers, roofs.
const cone = (cx, y0, y1, a, b, c) => {
  for (let y = y0; y <= y1; y++) for (let w = a + ((b - a) * (y - y0)) / max(1, y1 - y0), x = ceil(cx - w - 0.01); x <= cx + w + 0.01; x++) put(x, y, c | (x < cx - 0.3 ? LF : x > cx + 0.3 ? RF : 0));
};
const disc = (cx, cy, r, c) => {
  for (let y = floor(cy - r); y <= cy + r; y++) for (let x = floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, c);
};
const line = (x0, y0, x1, y1, c) => {
  for (let i = 0, n = max(abs(x1 - x0), abs(y1 - y0), 1); i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
};
// Ground up to f(x), each slope on the face it turns to.
const ridge = (f, c) => {
  for (let x = 0; x < CW; x++) for (let y = 0, h = f(x), s = f(x + 0.5) - f(x - 0.5); y <= h; y++) put(x, y, c | (s > 0.15 ? LF : s < -0.15 ? RF : 0));
};
// The sky card at the back: bands of paper under a scalloped top, with stars.
const sky = (bands, stars) => {
  for (let x = 0; x < CW; x++)
    for (let y = 0, top = 54 + round(7 * abs(sin(x * 0.2 + 0.6))), i; y <= top; y++) {
      for (i = 0; i + 1 < bands.length && y + 2 * sin(x * 0.3 + y * 0.07) >= bands[i + 1]; ) i += 2;
      put(x, y, bands[i]);
    }
  for (let n = 0; n < stars; n++) put(2 + rnd() * 52, 36 + rnd() * 16, white);
};
// The moon rides a slot cut in the sky card.
const slot = () => {
  for (let s = 0.12; s < 0.88; s += 0.01) put(28 - 21 * cos(PI * s), 30 + 21 * sin(PI * s), mauve);
};
const moon = (P, s = PI * (0.18 + 0.32 * (1 + sin(P.t * 0.3)))) => disc(28 - 21 * cos(s), 30 + 21 * sin(s), 4.3, cream);
const cloud = (cx, cy, n, c) => {
  for (let k = 0; k < n; k++) disc(cx + (k - (n - 1) / 2) * 3.2, cy + (k % 2) * 1.3, 2.4, c);
};
const windows = (x0, x1, y0, y1, dx, dy, lit) => {
  for (let y = y0; y <= y1; y += dy) for (let x = x0; x <= x1; x += dx) put(x, y, rnd() < lit ? win : black);
};
const pine = (cx, h, w, c) => {
  rect(cx - 1, 0, cx + 1, 5, trunk);
  for (let i = 0, s = (h - 6) / 5, y0, ww; i < 5; i++) (y0 = round(4 + i * s)), cone(cx, y0, min(h - 1, round(y0 + s * 1.7)), (ww = w * (1 - i * 0.16)), 0.4, c), cone(cx, y0, y0, ww, ww, firl);
};
const birds = (P, list, c) =>
  list.forEach(([x0, y, v], i) => {
    for (let n = 0, w = sin(P.t * 9 + i * 2) > 0 ? 1 : -1, x = x0 + ((P.t * v) % 60); n < 2; n++, x -= 60) for (const [a, b] of [[0, 0], [-1, w > 0], [1, w > 0], [-2, w], [2, w]]) put(x + a, y + b, c);
  });
const waves = (o, top, amp, k, deep, lt) => {
  for (let x = 0; x < CW; x++)
    for (let y = 0, u = (x + o) * k, h = top + amp * abs(sin(u)), s = cos(u) * Math.sign(sin(u)); y <= h; y++) put(x, y, (y > h - 1.2 ? white : y > h - 3 ? lt : deep) | (s > 0.2 ? LF : s < -0.2 ? RF : 0));
};
// A tunnel-book frame with an arch cut out: c the card, e the rim, f flecks.
// Pleated, it hangs in folds like a curtain.
const frame = (c, e, f, pleat) => {
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < CW; x++) {
      const dx = abs(x - 27.5), n = pleat ? 0 : 1.4 * sin(y * 0.9 + x * 2.1) + sin(y * 0.4 - x), w = (y < 40 ? 21 : 21 * sqrt(max(0, 1 - ((y - 40) / 22) ** 2))) + n;
      if (dx >= w && y < TH - (pleat ? 0 : 3 * abs(sin(x * 0.35)))) put(x, y, (dx < w + 1.3 ? e : f && rnd() < 0.1 ? f : c) | (pleat ? (x % 4 < 2 ? LF : RF) : n > 0.4 ? LF : n < -0.4 ? RF : 0));
    }
};

// A castle at dusk: a keep between two towers, turrets on the curtain wall,
// pennants that flap and a drawbridge that comes down when the tab is pulled.
const castle = () => {
  rect(9, 0, 46, 15, stone);
  cone(27, 0, 33, 5.5, 5.5, stone);
  for (let x = 9; x <= 46; x += 4) rect(x, 16, x + 1, 17, stone), x < 32 && x > 20 && rect(x + 1, 34, x + 2, 35, stone);
  for (const cx of [10, 45]) cone(cx, 0, 25, 3, 3, stone), cone(cx, 26, 34, 4, 0, roof), rect(cx, 13, cx, 15, dark);
  for (const cx of [18, 36]) cone(cx, 0, 41, 4, 4, stone), cone(cx, 42, 54, 5, 0, roof), rect(cx, 21, cx, 24, dark), rect(cx, 31, cx, 34, dark);
  // Printed stone courses.
  for (let p = 0, x, y; p < T.length; p++) if ((T[p] & 63) === stone && ((y = floor(p / CW)) % 5 === 4 || (y % 5 === 1 && ((x = p % CW) + floor(y / 5) * 3) % 7 === 0))) T[p] = (T[p] & 192) | ink;
  rects([[24, 19, 25, 22, win], [29, 19, 30, 22, win], [25, 0, 29, 7, warm], [26, 8, 28, 8, warm], [26, 0, 26, 7, dark], [28, 0, 28, 7, dark], [26, 11, 28, 16, roof]]);
  disc(27, 28, 2.3, win);
  put(27, 28, dark);
  put(27, 14, yel);
};
const castleDyn = (P) => {
  for (const cx of [18, 36]) {
    rect(cx, 55, cx, 61, dark);
    for (let i = 1, y; i <= 5; i++) put(cx + i, (y = 60 + round(sin(P.t * 7 - i * 0.9) * i * 0.25)), i % 2 ? yel : roof), i < 4 && put(cx + i, y - 1, yel);
  }
  const hb = round(8 * cos(P.pull * 1.45));
  rect(25, 0, 29, hb, wood);
  for (let y = 1; y < hb; y += 2) rect(25, y, 29, y, trunk);
  line(24, 9, 25, hb, dark);
  line(30, 9, 29, hb, dark);
};
// A pine forest in the morning; the stag in the clearing grazes when the tab is pulled.
const mountains = () => {
  sky([skyw, 10, skyl, 30, skyb], 0);
  for (const [px, ph, s, c] of [[31, 50, 1.25, mtn], [10, 39, 1.4, mtnd], [48, 41, 1.3, mtnd]])
    for (let x = 0; x < CW; x++) for (let y = 0, top = ph - abs(x - px) * s; y <= top; y++) put(x, y, (y > ph - 8 + 2 * sin(x * 1.7) ? snow : c) | (x < px ? LF : x > px ? RF : 0));
};
const sun = (P) => {
  disc(44, 55, 3.3, yel);
  for (let k = 0, a; k < 8; k++) (a = P.t * 0.5 + (k * PI) / 4), line(44 + 4.6 * cos(a), 55 + 4.6 * sin(a), 44 + 6.5 * cos(a), 55 + 6.5 * sin(a), yel);
};
const stag = (P) => {
  const a = mix(2.05, 3.95, P.pull), hx = 24 + 7 * cos(a), hy = 10 + 7 * sin(a), b = a - 1.15;
  for (const lx of [24, 26, 31, 33]) rect(lx, 0, lx, 5, trunk);
  rects([[23, 6, 34, 10, deer], [24, 11, 33, 11, deer], [33, 8, 35, 11, white], [hx - 2, hy - 1, hx, hy, deer]]);
  line(24, 10, hx, hy, deer);
  line(25, 10, hx + 1, hy, deer);
  put(hx - 3, hy - 1, dark);
  put(hx + 1, hy + 1, deer);
  for (const [l, o] of [[5, 0], [3.5, 0.6], [3, -0.5]]) line(hx, hy + 1, hx + l * cos(b + o), hy + 1 + l * sin(b + o), trunk);
};
const ferns = () => {
  ridge((x) => 1 + 0.8 * sin(x * 0.9) + (x % 7 === 3 ? 2 : 0), green);
  for (const [x, h] of [[9, 3], [13, 2], [21, 4]]) rect(x, 0, x, h - 1, white), rect(x - 1, h, x + 1, h + 1, fly), put(x, h + 1, white);
  for (const cx of [3, 17, 31, 53]) for (let k = -2; k <= 2; k++) line(cx, 0, cx + k * 1.4, 5 - abs(k) * 0.8, fern);
};

// A lighthouse at night over paper waves; its beam is a card on a wheel,
// long when it swings left, short when right, a flash when it faces us.
const lighthouse = () => {
  ridge((x) => (x < 17 ? -1 : 12 + 3 * sin(x * 0.5) + 2 * sin(x * 1.3) - max(0, 26 - x) * 1.2), rock);
  cone(40, 12, 50, 5, 3, white);
  for (let p = 12 * CW; p < 51 * CW; p++) if ((T[p] & 63) === white && floor(p / CW - 12) % 10 < 5) T[p] = (T[p] & 192) | red;
  rects([[40, 12, 40, 15, black], [40, 30, 40, 30, black], [40, 41, 40, 41, black], [34, 51, 46, 51, black], [37, 52, 43, 56, win], [39, 52, 39, 56, black], [41, 52, 41, 56, black], [40, 62, 40, 63, black], [25, 10, 31, 15, white], [26, 13, 26, 13, win], [30, 13, 30, 13, win], [28, 10, 28, 12, black]]);
  for (let x = 34; x <= 46; x += 2) put(x, 52, black);
  cone(40, 57, 61, 4, 0.5, red);
  cone(28, 16, 19, 4.5, 0.5, red);
};
const beam = (P) => {
  const a = P.t * 1.3, s = sin(a), d = s > 0 ? -1 : 1;
  for (let i = 1; i <= (s > 0 ? 38 : 14) * abs(s); i++) for (let w = 0.5 + i * 0.09, y = round(54 - w); y <= 54 + w; y++) put(40 + d * (3 + i), y, glow);
  if (cos(a) > 0.6) disc(40, 54, 1 + 6 * (cos(a) - 0.6), glow);
};
// A sailing boat rocks on the swell.
const boats = (P) => {
  const b = round(sin(P.t * 1.6));
  rects([[11, 4 + b, 17, 5 + b, wood], [12, 3 + b, 16, 3 + b, wood], [14, 6 + b, 14, 17 + b, dark], [15, 17 + b, 15, 17 + b, red]]);
  for (let y = 7; y <= 16; y++) rect(15, y + b, 15 + (16 - y) * 0.6, y + b, white), y > 7 && rect(13 - (16 - y) * 0.35, y + b, 13, y + b, white);
};

// A city at nightfall: a clock tower whose hands turn on their wheel, a tram
// in the street and a balloon over the roofs.
const city = () => {
  cone(10, 0, 47, 5, 5, glass), cone(10, 48, 51, 3.5, 3.5, glass), cone(10, 52, 55, 2, 2, glass), cone(38, 0, 45, 4, 4, stone), cone(38, 46, 55, 5, 0, roof), cone(49, 44, 46, 3, 0.5, wood);
  rects([[10, 56, 10, 63, grey], [16, 0, 23, 31, brick], [15, 32, 24, 32, brick], [24, 0, 32, 23, cteal], [25, 0, 31, 2, white], [38, 56, 38, 58, black], [43, 0, 54, 35, purple], [47, 39, 51, 43, wood], [47, 36, 47, 38, black], [51, 36, 51, 38, black]]);
  windows(6, 14, 3, 45, 2, 3, 0.45), windows(17, 22, 3, 29, 2, 3, 0.4), windows(25, 31, 3, 21, 3, 3, 0.5), windows(36, 40, 4, 32, 4, 4, 0.5), windows(44, 53, 3, 33, 3, 3, 0.4);
  disc(38, 39, 3.2, white);
};
const clock = (P) => {
  for (const [a, l] of [[-P.t * 1.2, 2.6], [1 - P.t * 0.1, 1.7]]) line(38, 39, 38 + l * cos(a), 39 + l * sin(a), black);
};
const tram = (P) => {
  const x = round(2 + 38 * (0.5 - 0.5 * cos(P.t * 0.45)));
  rects([[x, 1, x + 13, 6, red], [x, 4, x + 13, 4, paper], [x + 1, 7, x + 12, 7, red], [x + 2, 0, x + 2, 0, black], [x + 11, 0, x + 11, 0, black]]);
  for (let i = 0; i < 6; i++) put(x + 1 + i * 2, 5, win);
  line(x + 6, 8, x + 8, 11, black);
};
const balloon = (P) => {
  const x = 15 + 4 * sin(P.t * 0.2), y = 45 + 1.5 * sin(P.t * 0.9);
  for (let yy = -4; yy <= 4; yy++) for (let w = sqrt(20 - yy * yy) * (yy < 0 ? 1 + yy * 0.1 : 1), xx = round(x - w); xx <= x + w; xx++) put(xx, y + yy, (floor(xx - x + 9) % 3 ? red : yel) | (xx < x - 1 ? LF : xx > x + 1 ? RF : 0));
  rect(x - 1, y - 8, x + 1, y - 7, wood);
  line(x - 2, y - 4, x - 1, y - 6, dark);
  line(x + 2, y - 4, x + 1, y - 6, dark);
};
const skyline = () => {
  for (let x = 0, w, h; x < CW; x += w) rect(x, 0, x + (w = 3 + floor(rnd() * 4)) - 1, (h = 12 + floor(rnd() * 20)), sky2), windows(x + 1, x + w - 2, 2, h - 1, 2, 3, 0.25);
};

// Each spread: the far page's print, the initial's colour, the card backs, and
// the cards as [depth behind the gutter, height, folds forward, art, moving
// part]. The first four stand at Layers 4.
const SPREADS = [
  [
    (x, r) => (r > 1 && r < 8 ? sea : (x * 7 + r * 13) % 41 ? green : yel),
    roof,
    mauve,
    [
      [68, 64, 1, () => (sky([peach, 13, pink, 25, mauve, 38, violet], 14), slot(), ridge((x) => 5 + 2.5 * sin(x * 0.22 + 1) + 1.6 * sin(x * 0.61), hill)), moon],
      [14, 62, 0, castle, castleDyn],
      [4, 12, 0, () => {
        ridge((x) => (x > 22 && x < 32 ? -1 : 3.5 + 2.4 * abs(sin(x * 0.5 + 0.3))), greend);
        for (let n = 0, x, y; n < 30; n++) T[(y = floor(rnd() * 5)) * CW + (x = floor(rnd() * CW))] && put(x, y, [yel, pink, white][n % 3]);
      }],
      [56, 56, 1, () => (cloud(10, 49, 4, blush), cloud(45, 43, 3, blush), cloud(30, 53, 2, blush)), (P) => birds(P, [[6, 46, 2.6], [30, 51, 3.2], [44, 39, 2.2]], dark)],
      [40, 30, 1, () => ((h) => (ridge(h, green), [3, 7, 48, 13, 41].forEach((x) => (rect(x, h(x), x, h(x) + 2, trunk), disc(x, h(x) + 3.5, 2, greend)))))((x) => 12 + 9 * sin(x * 0.07 + 0.4) ** 2 + 2 * sin(x * 0.4))],
      [2, 70, 0, () => frame(greend, green, pink)],
    ],
  ],
  [
    (x, r) => (abs(x - 22 - 7 * sin(r * 0.09)) < 2 ? ((x + r) % 9 ? skyb : white) : (x * 11 + r * 7) % 23 ? firl : trunk),
    greend,
    mtnd,
    [
      [68, 64, 1, mountains, sun],
      [14, 62, 0, () => (rect(0, 0, 55, 1, firl), pine(7, 62, 7, fir), pine(48, 56, 7, fir), pine(40, 30, 4, fir)), stag],
      [4, 10, 0, ferns],
      [56, 56, 1, () => (cloud(12, 49, 3, white), cloud(42, 45, 2, white)), (P) => birds(P, [[4, 44, 3], [24, 50, 3.4], [40, 47, 2.8]], dark)],
      [40, 34, 1, () => ((h) => (ridge(h, green), [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52].forEach((x) => cone(x, round(h(x)) - 1, round(h(x)) + 6 + (x % 3) * 2, 2, 0, firb))))((x) => 12 + 6 * sin(x * 0.13 + 1) + 3 * sin(x * 0.4))],
      [2, 70, 0, () => frame(fir, firl, trunk)],
    ],
  ],
  [
    (x, r) => (r % 8 === round(3 + 2 * sin(x * 0.7 + r)) ? white : r % 16 < 8 ? sea : sead),
    red,
    night,
    [
      [68, 64, 1, () => (sky([sead, 7, night, 24, navy], 24), disc(11, 48, 5, cream), disc(13.5, 49.5, 4.4, navy))],
      [14, 64, 0, lighthouse, beam],
      [4, 13, 0, null, (P) => waves(3 * sin(P.t * 0.8), 5, 5, 0.27, sead, sea)],
      [56, 56, 1, () => [...Array(32)].forEach((_, i, a, s = sin(i * 0.3 + 0.6)) => rect(i + 2, 46 + s, i + 2, 47 + s + (i > 6 && i < 26), sky2)), (P) => birds(P, [[10, 40, 4], [36, 48, 3.3]], white)],
      [40, 22, 1, () => waves(0, 8, 3, 0.35, sea, teal), boats],
      [2, 70, 0, () => frame(rock, grey, teal)],
    ],
  ],
  [
    (x, r) => (r < 6 ? grey : abs(r - 34) < 2 && x % 8 < 4 ? yel : street),
    indigo,
    indigo,
    [
      [68, 64, 1, () => (sky([dusk, 9, mag, 19, indigo, 33, navy], 10), slot()), moon],
      [14, 64, 0, city, clock],
      [4, 14, 0, () => (rect(0, 0, 55, 0, black), [5, 28, 50].forEach((x) => rects([[x, 0, x, 9, black], [x - 1, 10, x + 1, 11, win], [x, 12, x, 12, black]]))), tram],
      [56, 56, 1, () => (cloud(40, 50, 3, sky2), cloud(10, 40, 2, sky2)), balloon],
      [40, 34, 1, skyline],
      [2, 70, 0, () => frame(red, yel, 0, 1)],
    ],
  ],
];

const pageTex = (f) => Uint8Array.from({ length: PW * D }, (_, i) => f(i % PW, floor(i / PW)));
// The near page: lines of print, a coloured initial, a page number. A line is
// five units deep so it shows as one row of the panel when the page lies flat.
function nearTex(cap) {
  return pageTex((x, r, l = floor(r / 10) - 1) =>
    r > 7 && r < 25 && x > 4 && x < 9 ? cap : (r % 10 > 4 && l >= 0 && l < 5 && x > (l < 2 ? 9 : 4) && x < PW - 5 && sin(x * 1.9 + l * 3) + sin(x * 0.7 + l * 5) > -0.8) || (r > 69 && abs(x - 28.5) < 2) ? text : paper,
  );
}
// The front cover: cloth and a gold-edged label with a red seal and a title.
const coverTex = () => pageTex((x, r, a = abs(x - 28.5), b = abs(r - 34)) => (a > 14 || b > 19 ? cloth : a > 13 || b > 18 ? yel : a < 6 && r < 32 && r > 20 ? roof : r % 4 > 1 && r > 37 && a < 9 ? text : paper));

const build = ([far, cap, back, cards]) => ({
  far: pageTex(far),
  near: nearTex(cap),
  back: PAL[back],
  cards: cards.map(([zb, h, fwd, art, dyn]) => ((T = new Uint8Array(CW * h)), (TH = h), art && art(), { zb, h, fwd, tex: T, work: dyn ? new Uint8Array(CW * h) : T, dyn })),
});

// The lamp: where its light comes from, its colour, and the room in its pool.
function paint(P) {
  const a = (P.lamp - 0.5) * 2.6, wm = 1 - P.lamp, L = [sin(a) * 0.8, 0.55 + 0.2 * cos(a), -0.8], n = Math.hypot(...L), lx = 32 + sin(a) * 34, tx = 32 + sin(a) * 20;
  P.L = L.map((v) => v / n);
  P.lc = [mix(0.86, 1.08, wm), mix(0.94, 0.9, wm), mix(1.08, 0.66, wm)];
  P.sx = P.L[0] < -0.25 ? 1 : P.L[0] > 0.25 ? -1 : 0;
  for (let p = 0, x, y, c, s; p < N; p++) {
    (x = p & 63), (y = p >> 6);
    if (y < TB) (s = (0.55 + 0.85 * exp(-(((x - lx) / 30) ** 2) - ((y - 34) / 46) ** 2)) * ((x + 3) % 8 ? 1 : 0.86) * (y > TB - 3 ? 0.7 : 1)), (c = [46, 40, 62]);
    else (s = (0.5 + 0.8 * exp(-(((x - tx) / 30) ** 2) - ((y - 104) / 26) ** 2)) * (0.86 + 0.14 * sin(y * 1.9 + 2 * sin(x * 0.11 + y * 0.5)))), (c = [96, 60, 36]);
    for (let i = 0; i < 3; i++) P.bg[p * 3 + i] = c[i] * s * P.lc[i];
  }
}

// A card hinged at (Yb, Zb), w wide from column x0, its height along (dy, dz).
// From behind it shows bk: a page's other face or a card's plain colour. A
// page is a card hinged at the spine, darker into the gutter.
function card(P, tex, bk, w, x0, h, Yb, Zb, dy, dz, bias, page) {
  const { buf, zb, L, lc } = P, f0 = dy + dz * K, s = f0 > 0 ? 1 : -1, f = s * max(abs(f0), 0.03), y0 = G - Yb - Zb * K, side = -P.sx;
  // Light on the face, and on the faces turned left and right.
  const m = [-0.7, 0, 0.7].map((nx, j, _, q = j === 1 ? s : 0.7 * s, d = 0.7 * max(0, nx * L[0] + q * dz * L[1] - q * dy * L[2])) => [0.4 + d * lc[0], 0.42 + d * lc[1], 0.48 + d * lc[2]]);
  for (let y = max(0, floor(f > 0 ? y0 - h * f : y0)), y1 = min(H, ceil(f > 0 ? y0 : y0 - h * f)); y < y1; y++) {
    const v = (y0 - y - 0.5) / f, ty = floor(v), z = Zb + v * dz - bias, row = ty * w, g = page && v < 8 ? 0.7 + 0.0375 * v : 1;
    for (let x = 0, tc, p, o, ci, c, k, e; x < w && v >= 0 && v < h; x++) {
      if (!(tc = tex[row + x]) || z >= zb[(p = y * W + x0 + x)]) continue;
      (zb[p] = z), (o = p * 3), (ci = s > 0 ? tc & 63 : 0), (c = s > 0 ? PAL[ci] : bk.length > 3 ? PAL[bk[row + x]] : bk), (k = m[s > 0 && tc & LF ? 0 : s > 0 && tc & RF ? 2 : 1]);
      // The white core of the card shows along a cut edge that faces the light.
      e = s < 0 ? 0 : ty + 1 >= h || !tex[row + w + x] ? 0.45 : side && (x + side < 0 || x + side >= w || !tex[row + x + side]) ? 0.3 : 0;
      for (let i = 0; i < 3; i++) buf[o + i] = (c[i] + (248 - c[i]) * e) * (EM[ci] ? 1 : k[i]) * g;
    }
  }
}

// One spread's cards opened by open(j), turned by rho about the spine: 0 on the
// far page, PI - phi riding the leaf. Flat, a card folded back lies on top.
function scene(P, S, open, rho) {
  const cr = cos(rho), sr = sin(rho), wob = P.mode === STAND ? P.timer : 9;
  S.cards.forEach((c, i) => {
    if (i >= P.layers) return;
    const lam = ((1 - open(ORDER[i])) * PI) / 2 + 0.16 * sin(wob * 15 - i) * exp(-wob * 4), yc = cos(lam), zc = (c.fwd ? -1 : 1) * sin(lam);
    if (c.dyn) c.work.set(c.tex), (T = c.work), (TH = c.h), c.dyn(P);
    card(P, c.work, S.back, CW, X0, c.h, c.zb * sr, c.zb * cr, zc * sr + yc * cr, zc * cr - yc * sr, c.fwd ? 0.3 : 0.6);
  });
}

const stand = (P, stay) => Object.assign(P, { mode: STAND, timer: 0, stay });

export function setup(params) {
  const P = params;
  Object.assign(P, { buf: new Float32Array(N * 3), bg: new Float32Array(N * 3), zb: new Float32Array(N), t: 0, lamp: -1, mode: OPEN, timer: 0, phi: PI, cur: -1, next: 0, ask: 0, layers: 4, pull: 0 });
  P.sc = SPREADS.map(build);
  P.cover = coverTex();
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 4, 0.06], rate = cl(k[1], 0.2, 3) / 2, d = cl(dt, 0, 0.1) * rate, want = cl(round(k[0]), 0, 3), lamp = cl(k[3], 0, 1);
  P.layers = cl(round(k[2]), 4, 6);
  if (abs(lamp - P.lamp) > 0.002) (P.lamp = lamp), paint(P);
  if (P.cur < 0) P.cur = P.base = want;
  if (want !== P.base) (P.base = want), (P.ask = 1);
  if (input.btnPressed?.[0]) P.ask = 2;
  P.t += d;
  P.pull = sm(0.5 + 1.3 * sin(P.t * 0.9 - 1));
  if (P.mode === OPEN) {
    // The cover swings open toward the viewer, never slower than at Speed 1.2.
    P.phi = PI * (1 - sm((P.timer += cl(dt, 0, 0.1) * max(rate, 0.6)) / 1.6));
    if (P.timer >= 1.6) stand(P, 1.7);
  } else if (P.mode === STAND) {
    // The knob asks for its own spread, the button for the next.
    if (P.ask === 1 && P.base === P.cur) P.ask = 0;
    if ((P.timer += d) >= P.stay || P.ask) Object.assign(P, { mode: TURN, timer: 0, next: P.ask === 1 ? P.base : (P.cur + 1) % 4, ask: 0 });
  } else if ((P.phi = PI * sm((P.timer += d) / 2.8)) && P.timer >= 2.8) (P.cur = P.next), stand(P, 7);
}

// One LED of plain card under the lamp, at depth z.
const px = (P, p, c, k, z) => ((P.zb[p] = z), PAL[c].forEach((v, i) => (P.buf[p * 3 + i] = v * k * P.lc[i])));

export function draw(display, params) {
  const P = params, { buf, phi } = P, A = P.sc[P.cur], deg = (phi * 180) / PI, open = P.mode === OPEN, B = P.mode === TURN ? P.sc[P.next] : null, nr = (B || A).near;
  buf.set(P.bg);
  // The table takes shadows, the wall behind does not.
  P.zb.fill(1e9).fill(500, TB * W);
  // The cover boards round the pages, and the edges of the page block.
  for (let x = 2; x < 62; x++) px(P, 86 * W + x, cloth, 0.7, 90), open || [paper, grey, cloth].forEach((c, i) => px(P, (117 + i) * W + x, c, 0.85 - i * 0.1, 90));
  for (let y = 87; y < (open ? 102 : 120); y++) px(P, y * W + 2, cloth, 0.8, 90), px(P, y * W + 61, cloth, 0.6, 90);
  card(P, A.far, A.far, PW, P0, D, 0, 0, 0, 1, 0, 1);
  if (!open) card(P, nr, nr, PW, P0, D, 0, 0, 0, -1, 0, 1);
  if (P.mode !== STAND) {
    // The leaf, and its own edge, a line of bare card.
    const y = floor(G - D * (sin(phi) - K * cos(phi))), z = -D * cos(phi) - 0.6;
    card(P, B ? B.far : P.cover, A.near, PW, P0, D, 0, 0, sin(phi), -cos(phi), 0, 1);
    for (let x = P0, p; x < P0 + PW && y >= 0 && y < H; x++) if (z < P.zb[(p = y * W + x)]) px(P, p, open ? cloth : white, 0.9, z);
  }
  if (P.mode === STAND || deg < 170) scene(P, A, (j) => (P.mode === STAND ? 1 : 1 - sm((deg - 5 * j) / 80)), 0);
  if (B && deg > 14) scene(P, B, (j) => sm((deg - 92 - 6 * j) / (80 - 6 * j)), PI - phi);
  // The pull-tab at the side of the near page.
  for (let y = 108, e = round(P.pull * 2); y <= 110 && !open; y++) for (let x = 59; x <= 61 + e; x++) px(P, y * W + x, x === 61 + e && y === 109 ? roof : paper, 0.8, -50);
  // Every card's shadow on what stands behind it, a step away from the lamp.
  for (let p = 3 * W, z, k, sx = P.sx, zb = P.zb; p < N; p++) if ((z = zb[p]) < 1e8 && (k = zb[p - W - sx] < z - 3 ? 0.58 : zb[p - 2 * W - 2 * sx] < z - 3 ? 0.78 : 1) < 1) for (let i = 0; i < 3; i++) buf[p * 3 + i] *= k;
  for (let p = 0, o = 0; p < N; p++, o += 3) display.setPixel(p & 63, p >> 6, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
}
