// ===== Patternflow pattern =====
// Title:   Palimpsest
// Family:  type
// Idea:    A parchment leaf carries two Greek texts at right angles, a prayer written across the page in brown iron-gall ink over a scraped-off treatise of Archimedes that runs down it, and the imaging band sweeps from plain light, where the old text is a faint ghost, to ultraviolet, where the parchment glows and the old ink shows dark, to the pseudocolour view that turns the old text red and leaves the prayer dark, while an X-ray beam rasters down the leaf and lights the iron of both inks behind it.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Archimedes Palimpsest (Archimedes' treatises copied in the 10th century, scraped and written over as a prayer book in 1229; multispectral imaging by Roger Easton, Keith Knox and William Christens-Barry and X-ray fluorescence imaging by Uwe Bergmann in the 2000s), Greek minuscule drawn for this pattern, pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Band=0..1, Speed=0.2..3, Page=0..3, Ink=-1..1
//
// Knob 1: Band. The light the leaf is seen in. 0 to 0.15 is plain light: ivory parchment, brown prayer, the old text an ochre ghost 8% darker than the page in red and 25% in blue. 0.4 to 0.6 is ultraviolet: the parchment glows blue and the iron in both inks puts the glow out, the prayer down to 42% of the page and the old text to 65%. 0.85 to 1 is pseudocolour: the red-light picture in the red channel and the ultraviolet one in green and blue, so the old text, pale in red and dark in ultraviolet, comes out red, and the prayer, dark in both, near black. Between, one picture fades into the next.
// Knob 2: Speed. How fast the X-ray beam steps down the leaf, a spot running along it: 26 rows a second at 2, a pass every 6.5 s; 2.6 rows a second at 0.2. For about 16 rows behind the beam the leaf shows its iron map, both inks pale blue on near black, the scraped text as plain as the prayer.
// Knob 3: Page. Which pair of texts, rounded to 0 to 3. 0: the Trisagion over the title of the Method. 1: the Lord's Prayer over the title and first words of the Measurement of a Circle. 2: Kyrie eleison over On Floating Bodies. 3: Glory to thee, our God over the Stomachion.
// Knob 4: Ink. How much of the old ink the scraper left and how far both inks have bled into the parchment. At -1 the prayer's strokes spread 0.5 LED and the old text's 0.35, and even in ultraviolet the old text is a thin line at 75% of the page; at 1 they spread 0.8 and 0.95 LED and the old text shows ochre-brown in plain light, 21% darker than the page in red and 59% in blue.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Greek minuscule, at most 5 LEDs wide on 9 rows: 0 and 1 hold ascenders,
// 2 to 6 the body, 7 and 8 descenders. Each glyph is its first inked row and
// then its rows downward. No accents or breathings.
const FONT = {
  α: [2, ".##.#", "#..#.", "#..#.", "#..#.", ".##.#"],
  β: [0, ".##.", "#..#", "#..#", "###.", "#..#", "#..#", "###.", "#...", "#..."],
  γ: [2, "#...#", ".#.#.", ".#.#.", "..#..", "..#..", ".#.#.", "..#.."],
  δ: [0, ".###", "#...", ".##.", "#..#", "#..#", "#..#", ".##."],
  ε: [2, ".###", "#...", "###.", "#...", ".###"],
  ζ: [0, "####", "..#.", ".#..", "#...", "#...", "#...", ".##.", "...#", "..#."],
  η: [2, "###.", "#..#", "#..#", "#..#", "#..#", "...#", "...#"],
  θ: [0, ".##.", "#..#", "#..#", "####", "#..#", "#..#", ".##."],
  ι: [2, "#.", "#.", "#.", "#.", ".#"],
  κ: [2, "#..#", "#.#.", "##..", "#.#.", "#..#"],
  λ: [0, "#....", "#....", ".#...", ".#...", "..#..", ".#.#.", "#...#"],
  μ: [2, "#..#.", "#..#.", "#..#.", "#..#.", "###.#", "#....", "#...."],
  ν: [2, "#...#", "#...#", ".#..#", ".#.#.", "..#.."],
  ξ: [0, "####", ".#..", "..#.", ".##.", "#...", "#...", ".##.", "...#", "..#."],
  ο: [2, ".##.", "#..#", "#..#", "#..#", ".##."],
  π: [2, "#####", ".#.#.", ".#.#.", ".#.#.", ".#.#."],
  ρ: [2, ".##.", "#..#", "#..#", "#..#", "###.", "#...", "#..."],
  σ: [2, ".####", "#..#.", "#..#.", "#..#.", ".##.."],
  ς: [2, ".###", "#...", "#...", ".##.", "...#", "..#."],
  τ: [2, "####", ".#..", ".#..", ".#..", "..##"],
  υ: [2, "#..#", "#..#", "#..#", "#..#", ".##."],
  φ: [0, "..#..", "..#..", ".###.", "#.#.#", "#.#.#", "#.#.#", ".###.", "..#..", "..#.."],
  χ: [2, "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  ψ: [0, "..#..", "..#..", "#.#.#", "#.#.#", "#.#.#", ".###.", "..#..", "..#..", "..#.."],
  ω: [2, "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
};
const GLYPH = {};
for (const ch in FONT) {
  const [top, ...rows] = FONT[ch];
  const w = max(...rows.map((r) => r.length)), px = [];
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === "#") px.push(i, top + j);
  });
  GLYPH[ch] = { w, px };
}

// The pairs of texts: a prayer written across the leaf over the title or
// opening words of one of Archimedes' treatises running down it. The words
// repeat until the leaf is full. A sigma that ends a word is written final.
const PAGES = [
  ["αγιοσ ο θεοσ αγιοσ ισχυροσ αγιοσ αθανατοσ ελεησον ημασ", "περι των μηχανικων θεωρηματων προσ ερατοσθενη εφοδοσ"],
  ["πατερ ημων ο εν τοισ ουρανοισ αγιασθητω το ονομα σου ελθετω η βασιλεια σου", "κυκλου μετρησισ πασ κυκλοσ ισοσ εστι τριγωνω ορθογωνιω"],
  ["κυριε ελεησον", "περι οχουμενων"],
  ["δοξα σοι ο θεοσ ημων δοξα σοι", "στομαχιον"],
].map((pair) => pair.map((t) => t.split(" ").map((w) => w.replace(/σ$/, "ς"))));

// The prayer: 12 lines 10 LEDs apart, 60 LEDs long from x 2. The treatise:
// 5 lines 12 LEDs apart, the first at the right, each 124 LEDs long from y 2,
// its letters turned a quarter turn clockwise so it reads downward.
const LINE = 10, OVER_LINES = 12, UNDER_LINE = 12, UNDER_LINES = 5, SPACE = 3;
// Plain light: the parchment's colour, how much of each channel the prayer's
// ink takes at full strength, and the grain, a share of the page's level.
const VIS = [226, 208, 168], INK = [0.62, 0.72, 0.84], GRAIN = 0.08;

function lay(words, len, lines, put) {
  // The words run on without a break, as a scribe filled a line: a word
  // that reaches the end of a line goes on at the start of the next.
  const text = words.join(" ") + " ";
  let i = 0, line = 0, pos = 0;
  while (line < lines) {
    const ch = text[i++ % text.length];
    if (ch === " ") {
      if (pos > 0) pos += SPACE;
      continue;
    }
    const g = GLYPH[ch];
    if (pos + g.w > len) (line++, (pos = 0));
    if (line >= lines) break;
    // Pen pressure: each letter its own weight.
    put(g, line, pos, 0.8 + 0.2 * Math.random());
    pos += g.w + 1;
  }
}

// Separable Gaussian blur of src into dst, sigma in LEDs.
function blur(src, dst, tmp, sigma) {
  const r = Math.ceil(sigma * 2.5), k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) (k.push(exp((-i * i) / (2 * sigma * sigma))), (sum += k[k.length - 1]));
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx >= 0 && xx < W) v += src[y * W + xx] * k[i + r];
      }
      tmp[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < H) v += tmp[yy * W + x] * k[i + r];
      }
      dst[y * W + x] = v;
    }
}

// Smooth value noise from a coarse random lattice, cell size c.
function lattice(c) {
  const gw = floor(W / c) + 2, gh = floor(H / c) + 2, g = new Float32Array(gw * gh), out = new Float32Array(N);
  for (let i = 0; i < g.length; i++) g[i] = Math.random() * 2 - 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const fx = x / c, fy = y / c, ix = floor(fx), iy = floor(fy), u = smooth(fx - ix), v = smooth(fy - iy);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], d = g[(iy + 1) * gw + ix], e = g[(iy + 1) * gw + ix + 1];
      out[y * W + x] = (a + (b - a) * u) * (1 - v) + (d + (e - d) * u) * v;
    }
  return out;
}

// Grain whose neighbours keep apart: white noise with its local mean taken
// out twice, each time spread back evenly over -1..1 by rank, then cut into
// three equal parts, -1, 0 and 1. It has no clumps, and two neighbours
// differ by a whole step four times in five.
function grain() {
  let n = new Float32Array(N);
  for (let p = 0; p < N; p++) n[p] = Math.random();
  const idx = new Int32Array(N);
  for (let pass = 0; pass < 2; pass++) {
    const h = new Float32Array(N);
    for (let p = 0; p < N; p++) {
      const x = p % W, y = floor(p / W);
      h[p] = n[p] - 0.25 * (n[y * W + ((x + 1) % W)] + n[y * W + ((x + W - 1) % W)] + n[((y + 1) % H) * W + x] + n[((y + H - 1) % H) * W + x]);
    }
    for (let p = 0; p < N; p++) idx[p] = p;
    idx.sort((a, b) => h[a] - h[b]);
    for (let r = 0; r < N; r++) n[idx[r]] = ((r + 0.5) / N) * 2 - 1;
  }
  for (let p = 0; p < N; p++) n[p] = n[p] > 1 / 3 ? 1 : n[p] < -1 / 3 ? -1 : 0;
  return n;
}

export function setup(params) {
  // The parchment: a slow mottle in 2% steps, fibres that drink the ink
  // unevenly, and a leaf edge that has gone darker. The grain goes on in
  // build(), where the ink is known.
  const base = new Float32Array(N), vig = new Float32Array(N), fibre = new Float32Array(N);
  const m1 = lattice(16), m2 = lattice(5), f = lattice(2);
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W);
    const edge = min(x + 0.5, W - 0.5 - x, y + 0.5, H - 0.5 - y);
    base[p] = round((0.9 + 0.06 * m1[p] + 0.035 * m2[p]) * 50) / 50;
    vig[p] = 0.72 + 0.28 * smooth(edge / 4);
    fibre[p] = 0.85 + 0.15 * f[p];
  }
  params.s = {
    P: new Float32Array(N), base, vig, gr: grain(), fibre,
    oMask: new Float32Array(N), uMask: new Float32Array(N), tmp: new Float32Array(N),
    O: new Float32Array(N), U: new Float32Array(N), Fe: new Float32Array(N),
    last: new Float32Array(N * 3), fade: 1,
    page: -1, ink: 9, band: 0, speed: 2, T: 0, beam: -12,
  };
}

function build(S, page, ink) {
  const { oMask, uMask } = S;
  if (page !== S.page) {
    oMask.fill(0);
    uMask.fill(0);
    const [over, under] = PAGES[page];
    lay(over, 60, OVER_LINES, (g, line, pos, wt) => {
      for (let i = 0; i < g.px.length; i += 2) {
        const x = 2 + pos + g.px[i], y = 4 + line * LINE + g.px[i + 1];
        if (x < W && y < H) oMask[y * W + x] = wt;
      }
    });
    lay(under, 124, UNDER_LINES, (g, line, pos, wt) => {
      const left = 51 - line * UNDER_LINE;
      for (let i = 0; i < g.px.length; i += 2) {
        const x = left + 8 - g.px[i + 1], y = 2 + pos + g.px[i];
        if (x >= 0 && y < H) uMask[y * W + x] = wt;
      }
    });
  }
  const s = (ink + 1) / 2;
  blur(oMask, S.O, S.tmp, 0.5 + 0.3 * s);
  blur(uMask, S.U, S.tmp, 0.35 + 0.6 * s);
  // The X-ray map sees the iron, not the colour: the old text's iron is
  // still there where the scraper took the colour, and the beam is broader
  // than a pen stroke.
  const { O, U, Fe, tmp, fibre } = S;
  const iron = 0.55 + 0.35 * s;
  for (let p = 0; p < N; p++) Fe[p] = oMask[p] + iron * uMask[p];
  blur(Fe, Fe, tmp, 0.75);
  for (let p = 0; p < N; p++) {
    O[p] = 1 - exp(-3.4 * O[p] * fibre[p]);
    U[p] = 1 - exp(-2.8 * U[p] * fibre[p]);
    Fe[p] = 1 - exp(-2.6 * Fe[p]);
  }
  // The grain, except on the flanks of a stroke, where the ink has
  // soaked in and the step from page to ink is the texture.
  const { P, base, vig, gr } = S;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), o = O[p];
    let d = 0;
    if (x > 0) d = max(d, abs(o - O[p - 1]));
    if (x < W - 1) d = max(d, abs(o - O[p + 1]));
    if (y > 0) d = max(d, abs(o - O[p - W]));
    if (y < H - 1) d = max(d, abs(o - O[p + W]));
    P[p] = (base[p] + GRAIN * gr[p] * (1 - smooth(d / 0.5))) * vig[p];
  }
  S.page = page;
  S.ink = ink;
}

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.band = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.05, 3);
  const page = cl(round(k[2]), 0, PAGES.length - 1);
  const ink = cl(k[3], -1, 1);
  if (page !== S.page || abs(ink - S.ink) > 0.015) {
    if (S.page >= 0 && page !== S.page) S.fade = 0;
    build(S, page, ink);
  }
  S.fade = min(1, S.fade + dt / 0.6);
  S.T += dt;
  // The beam steps down 13 rows a second per unit of Speed and starts again
  // above the leaf once it has left the bottom.
  S.beam += dt * 13 * S.speed;
  if (S.beam > H + 30) S.beam -= H + 42;
}

export function draw(display, params) {
  const S = params.s;
  if (S.page < 0) return;
  const { P, O, U, Fe, gr, last, T } = S;
  const s = (S.ink + 1) / 2;
  // How much the old ink darkens each picture.
  const aVis = 0.12 + 0.9 * s * s, aRed = 0.3 * aVis, qUV = 0.35 + 0.55 * s;
  // Band weights: plain light, ultraviolet, pseudocolour.
  const b = S.band;
  const tU = smooth((b - 0.15) / 0.25), tP = smooth((b - 0.6) / 0.25);
  const wV = 1 - tU, wP = tP, wU = tU - tP;
  const beam = S.beam, spot = (T * 150) % (W + 20) - 10;
  const fade = smooth(S.fade);
  for (let y = 0; y < H; y++) {
    // The iron map behind the beam: full for 10 rows, then fading.
    const d = beam - y;
    const xr = d < 0 ? exp(-d * d * 0.5) : d < 10 ? 1 : exp(-(d - 10) / 6);
    const line = abs(d) < 2 ? 1 - abs(d) / 2 : 0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, pa = P[p], o = O[p], u = U[p];
      let r = 0, g = 0, bl = 0;
      if (wV > 0) {
        // Plain light: iron-gall brown absorbs blue more than red, and the
        // faded old ink is a pale ochre.
        r += wV * VIS[0] * pa * (1 - INK[0] * o) * (1 - 0.35 * aVis * u);
        g += wV * VIS[1] * pa * (1 - INK[1] * o) * (1 - 0.6 * aVis * u);
        bl += wV * VIS[2] * pa * (1 - INK[2] * o) * (1 - aVis * u);
      }
      // Ultraviolet: the parchment fluoresces; any iron left quenches it.
      const F = pa * (1 - 0.88 * o) * (1 - qUV * u);
      if (wU > 0) {
        r += wU * (20 + 90 * F);
        g += wU * (24 + 120 * F);
        bl += wU * (40 + 200 * F);
      }
      if (wP > 0) {
        // Pseudocolour: red light in red, ultraviolet in green and blue,
        // both stretched the same way.
        const R = cl((pa * (1 - 0.85 * o) * (1 - aRed * u) - 0.2) * 1.35, 0, 1);
        const G = cl((F - 0.2) * 1.35, 0, 1);
        r += wP * 216 * R;
        g += wP * 196 * G;
        bl += wP * 200 * G;
      }
      if (xr > 0.004) {
        // X-ray fluorescence: iron in either ink, pale blue on near black.
        // Counting noise: the map is speckled where there is little iron.
        const fe = Fe[p], sn = (1 - fe) * gr[p];
        const k2 = xr * (0.9 + 0.1 * pa);
        r += k2 * (14 + 6 * sn + 112 * fe - r);
        g += k2 * (22 + 9 * sn + 176 * fe - g);
        bl += k2 * (44 + 16 * sn + 196 * fe - bl);
      }
      if (line > 0) {
        const sp = abs(x - spot) < 3 ? 1 - abs(x - spot) / 3 : 0;
        r += line * (30 + 120 * sp);
        g += line * (44 + 140 * sp);
        bl += line * (52 + 150 * sp);
      }
      if (fade < 1) {
        r = last[p * 3] + (r - last[p * 3]) * fade;
        g = last[p * 3 + 1] + (g - last[p * 3 + 1]) * fade;
        bl = last[p * 3 + 2] + (bl - last[p * 3 + 2]) * fade;
      } else {
        last[p * 3] = r;
        last[p * 3 + 1] = g;
        last[p * 3 + 2] = bl;
      }
      display.setPixel(x, y, min(255, max(0, r)), min(255, max(0, g)), min(255, max(0, bl)));
    }
  }
}
