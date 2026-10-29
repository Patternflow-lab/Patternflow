// ===== Patternflow pattern =====
// Title:   Photon Disk
// Family:  type
// Idea:    A dark glass disk with its letters cut clear in two rings turns anticlockwise in the lower half of the panel, and each time the glyph the line needs passes the window at twelve o'clock a short flash freezes it white for an instant and sends its light up through a lens that sizes the image onto a strip of brown film at the top, where the line builds up letter by letter in light while the film feeds up a line at a time.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lumitype phototypesetter, sold in the United States as the Photon (René Higonnet and Louis Moyroud, begun 1944, shown in France in September 1946), whose disk held eight rings of two 90-character fonts filmed at 12 sizes from 5 to 72 points; the first book set on it, Albro Gaul's The Wonderful World of Insects (1953); a 5 by 7 face drawn for this pattern; pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Lens=1..2.25
//
// Knob 1: Hue. The colour of the light the flash leaves on the film and of the letters in the glass: azure at 0, violet at 0.25, orange at 0.5, green at 0.75. The flash itself is white and the film stays a dark brown.
// Knob 2: Speed. The disk turns 0.4 times the knob a second, 0.8 at the opening 2, and a letter waits for its glyph to come round, so the flash fires 1.2 times a second on the title and its 26 letters on four lines take 21 s with the line feeds and a rest of 1.6 s at the end. At 0.2 a turn takes 12.5 s, the letters in the disk stand sharp and the title takes three minutes; at 3 the rings smear and it takes 14 s.
// Knob 3: Text. 0 the title of the first book set on the machine, THE WONDERFUL WORLD OF INSECTS; 1 the pangram THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG., 36 flashes; 2 the disk's own 40 glyphs in ring order, where each comes to the window just after the one before, so at 2 the outer ring's letters land about 20 a second and the strobe seems to hold the disk still while A to Z run through the window; 3 R. HIGONNET & L. MOYROUD 1946. A new text starts two lines further down the film.
// Knob 4: Lens. The magnification, 1 to 2.25 in quarter steps, and the lens slides to where a thin lens gives it, the distance from disk to film divided 1 to m: halfway at 1, 15.5 rows above the window, with letters 7 LEDs tall and 9 to the line; 10.9 rows above it at 2.25, with letters 15.75 LEDs tall and 4 to the line, a long word broken with the hyphen from the inner ring. A new size starts the text over two lines down, and letters already on the film keep the size they were set at.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, exp, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// 5 x 7 capitals, figures and four marks, drawn for this pattern, row by row
// from the top.
const GLYPHS = {
  A: ".###. #...# #...# ##### #...# #...# #...#", B: "####. #...# #...# ####. #...# #...# ####.", C: ".###. #...# #.... #.... #.... #...# .###.",
  D: "####. #...# #...# #...# #...# #...# ####.", E: "##### #.... #.... ####. #.... #.... #####", F: "##### #.... #.... ####. #.... #.... #....",
  G: ".###. #...# #.... #.### #...# #...# .####", H: "#...# #...# #...# ##### #...# #...# #...#", I: ".###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.",
  J: "..### ...#. ...#. ...#. ...#. #..#. .##..", K: "#...# #..#. #.#.. ##... #.#.. #..#. #...#", L: "#.... #.... #.... #.... #.... #.... #####",
  M: "#...# ##.## #.#.# #.#.# #...# #...# #...#", N: "#...# #...# ##..# #.#.# #..## #...# #...#", O: ".###. #...# #...# #...# #...# #...# .###.",
  P: "####. #...# #...# ####. #.... #.... #....", Q: ".###. #...# #...# #...# #.#.# #..#. .##.#", R: "####. #...# #...# ####. #.#.. #..#. #...#",
  S: ".#### #.... #.... .###. ....# ....# ####.", T: "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..", U: "#...# #...# #...# #...# #...# #...# .###.",
  V: "#...# #...# #...# #...# #...# .#.#. ..#..", W: "#...# #...# #...# #.#.# #.#.# #.#.# .#.#.", X: "#...# #...# .#.#. ..#.. .#.#. #...# #...#",
  Y: "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..", Z: "##### ....# ...#. ..#.. .#... #.... #####", 0: ".###. #...# #..## #.#.# ##..# #...# .###.",
  1: "..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.", 2: ".###. #...# ....# ...#. ..#.. .#... #####", 3: "##### ...#. ..#.. ...#. ....# #...# .###.",
  4: "...#. ..##. .#.#. #..#. ##### ...#. ...#.", 5: "##### #.... ####. ....# ....# #...# .###.", 6: "..##. .#... #.... ####. #...# #...# .###.",
  7: "##### ....# ...#. ..#.. .#... .#... .#...", 8: ".###. #...# #...# .###. #...# #...# .###.", 9: ".###. #...# #...# .#### ....# ...#. .##..",
  ".": "..... ..... ..... ..... ..... .##.. .##..", ",": "..... ..... ..... ..... .##.. ..#.. .#...",
  "&": ".##.. #..#. #.#.. .#... #.#.# #..#. .##.#", "-": "..... ..... ..... ##### ..... ..... .....",
};
const FONT = {};
for (const k in GLYPHS) {
  const s = GLYPHS[k].replace(/ /g, ""), b = new Uint8Array(35);
  for (let i = 0; i < 35; i++) b[i] = s[i] === "#" ? 1 : 0;
  FONT[k] = b;
}

// The disk: centre and radius in LED units, two rings of glyphs with their
// tops to the rim, the outer one the 26 capitals at radius 26 and the inner
// one the figures and marks at radius 15. The window is at twelve o'clock.
const CX = 31.5, CY = 95.5, RD = 31.5, HUB = 8;
const RINGS = [
  { chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", rc: 26 },
  { chars: "0123456789.,&-", rc: 15 },
];
const WHERE = {};
RINGS.forEach((ring, r) => {
  ring.n = ring.chars.length;
  ring.g = [...ring.chars].map((ch, j) => ((WHERE[ch] = [r, j]), FONT[ch]));
});

// The film: a strip across the top 45 rows; the line being set has its foot
// on row GB, between columns X0 and X0 + LW.
const FY1 = 44, GB = 41, X0 = 5, LW = 54;

// The texts; the specimen of the disk's glyphs breaks its lines without a
// hyphen.
const TEXTS = [
  "THE WONDERFUL WORLD OF INSECTS",
  "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789.,&-",
  "R. HIGONNET & L. MOYROUD 1946",
];
const SPECIMEN = 2;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Every pixel of the disk with its radius, its angle in radians clockwise
// from twelve o'clock, and which ring it can show.
const DISK = (() => {
  const idx = [], ang = [], rad = [], ring = [];
  for (let y = 64; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
      if (r > RD + 0.5) continue;
      let a = atan2(dx, -dy);
      if (a < 0) a += TAU;
      idx.push(y * W + x), ang.push(a), rad.push(r);
      ring.push(abs(r - RINGS[0].rc) < 4.4 ? 0 : abs(r - RINGS[1].rc) < 4.4 ? 1 : -1);
    }
  return { idx: Int32Array.from(idx), ang: Float32Array.from(ang), rad: Float32Array.from(rad), ring: Int8Array.from(ring) };
})();

// Glyph value at (col, row) in its own pixels, bilinear between the cells.
function sample(g, col, row) {
  if (col <= -1 || col >= 5 || row <= -1 || row >= 7) return 0;
  const c0 = floor(col), r0 = floor(row), fc = col - c0, fr = row - r0;
  let v = 0;
  for (let k = 0; k < 4; k++) {
    const c = c0 + (k & 1), r = r0 + (k >> 1);
    if (c < 0 || c > 4 || r < 0 || r > 6 || !g[r * 5 + c]) continue;
    v += (k & 1 ? fc : 1 - fc) * (k >> 1 ? fr : 1 - fr);
  }
  return v;
}

// The glyph of ring r seen at a pixel of radius rr and disk angle b. The
// angle off the glyph's centre line is under 0.23 radians, so sin and cos
// are their first two terms.
function diskGlyph(r, rr, b) {
  const ring = RINGS[r], n = ring.n, jf = (b * n) / TAU, j = round(jf), d = ((jf - j) * TAU) / n, d2 = d * d;
  const u = rr * d * (1 - d2 / 6), v = rr * (1 - d2 / 2) - ring.rc;
  let k = j % n;
  if (k < 0) k += n;
  return sample(ring.g[k], u + 2, 3 - v);
}

// A glyph at magnification m as coverage of the LEDs it falls on, 3 x 3
// samples to an LED, kept once made.
const SCALED = {};
function scaled(ch, m) {
  const key = ch + m;
  if (SCALED[key]) return SCALED[key];
  const g = FONT[ch], w = ceil(5 * m), h = ceil(7 * m), cov = new Float32Array(w * h);
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      let c = 0;
      for (let sy = 0; sy < 3; sy++)
        for (let sx = 0; sx < 3; sx++) {
          const gx = floor((px + (sx + 0.5) / 3) / m), gy = floor((py + (sy + 0.5) / 3) / m);
          if (gx < 5 && gy < 7 && g[gy * 5 + gx]) c++;
        }
      cov[py * w + px] = c / 9;
    }
  return (SCALED[key] = { w, h, cov });
}

// Lay a text out at magnification m: lines centred on the film, a word too
// long for a line broken with a hyphen.
function layout(text, m, plain) {
  const adv = 6 * m, per = max(2, floor((LW + m) / adv)), lines = [], cut = plain ? per : per - 1, hy = plain ? "" : "-";
  let cur = "";
  for (let word of text.split(" ")) {
    while (word.length > per && !cur) lines.push(word.slice(0, cut) + hy), (word = word.slice(cut));
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= per) cur += " " + word;
    else {
      lines.push(cur), (cur = "");
      while (word.length > per) lines.push(word.slice(0, cut) + hy), (word = word.slice(cut));
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  const out = [];
  lines.forEach((line, k) => {
    const x = round(X0 + (LW - (line.length * adv - m)) / 2);
    [...line].forEach((ch, i) => out.push({ ch, line: k, x: x + i * adv }));
  });
  return { chars: out, lines: lines.length };
}

export function setup(params) {
  params.s = {
    t: 0, phi: 0, prev: 0, hue: 0, speed: 2, text: 0, m: 1, job: null, jobs: 0, ci: 0, cur: 0,
    state: "seek", wait: 0, film: 0, filmTo: 0, pen: X0, penTo: X0,
    lit: [], flash: null, started: false, rgb: new Float32Array(W * H * 3),
    c: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0],
  };
  return params.s;
}

function lp(m) {
  return ceil(7 * m) + 3;
}

// Start the job over two blank lines on: a new layout at the knobs' size.
function begin(S) {
  S.job = layout(TEXTS[S.text], S.m, S.text === SPECIMEN);
  S.ci = 0;
  S.cur = 0;
  S.jobs++;
  S.filmTo += 2 * lp(S.m);
  S.state = "wait";
  S.wait = 0.4 * sqrt(2 / S.speed);
}

function advance(S, d) {
  S.t += d;
  S.prev = S.phi;
  S.phi += d * TAU * 0.4 * S.speed;
  const slow = sqrt(2 / S.speed);
  // The film and the carriage ease to where they are sent.
  S.film += (S.filmTo - S.film) * min(1, d / (0.09 * slow));
  S.pen += (S.penTo - S.pen) * min(1, d / 0.025);
  if (S.state === "wait") {
    if ((S.wait -= d) > 0) return;
    S.state = "seek";
  }
  if (S.state === "hold") {
    if ((S.wait -= d) <= 0) begin(S);
    return;
  }
  const job = S.job;
  if (S.ci >= job.chars.length) {
    S.state = "hold";
    S.wait = 1.6 * slow;
    return;
  }
  const c = job.chars[S.ci];
  if (c.line !== S.cur) {
    // A new line: the film feeds up and the carriage goes back.
    S.filmTo += (c.line - S.cur) * lp(S.m);
    S.cur = c.line;
    S.penTo = c.x;
    S.state = "wait";
    S.wait = 0.32 * slow;
    return;
  }
  S.penTo = c.x;
  if (c.ch === " ") {
    S.ci++;
    return;
  }
  // The disk turns anticlockwise, phi radians so far, so glyph j stands at
  // 2 pi j / n - phi clockwise from twelve and the letter after A comes
  // to the window next.
  const [r, j] = WHERE[c.ch], n = RINGS[r].n, off = (TAU * j) / n;
  const a0 = (S.prev - off) / TAU, a1 = (S.phi - off) / TAU;
  if (floor(a1) > floor(a0)) {
    // The glyph crossed the window during this step: flash.
    const at = floor(a1) * TAU + off;
    S.flash = { t: S.t, r, j, phi: at, x: c.x, m: S.m };
    S.lit.push({ ch: c.ch, x: c.x, fy: S.filmTo, m: S.m, t: S.t });
    if (S.lit.length > 120) S.lit.shift();
    S.ci++;
    S.state = "wait";
    S.wait = 0.01;
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1], 0.2, 3);
  const text = cl(round(kv[2]), 0, 3), m = round(cl(kv[3], 1, 2.25) * 4) / 4;
  if (!S.job || text !== S.text || m !== S.m) {
    S.text = text, S.m = m;
    begin(S);
  }
  if (!S.started) {
    // Run the first copy through unseen, so the film opens with it set and
    // the second copy a few letters in.
    S.started = true;
    for (let f = 0; f < 2400 && !(S.jobs > 1 && S.ci > 6); f++) advance(S, 1 / 30);
  }
  advance(S, d);
}

function add(rgb, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  rgb[o] += r * a, rgb[o + 1] += g * a, rgb[o + 2] += b * a;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.job) return;
  const rgb = S.rgb, c = S.c, c2 = S.c2, c3 = S.c3, t = S.t;
  rgb.fill(0);
  const light = hsv(0.55 + S.hue, 0.75, 1, c);

  // The film: a dark strip with lighter edges.
  const base = hsv(0.07, 0.45, 0.11, c2);
  for (let y = 0; y <= FY1; y++)
    for (let x = 1; x < W - 1; x++) {
      const edge = x === 1 || x === W - 2 ? 1.8 : 1;
      add(rgb, x, y, base[0], base[1], base[2], edge);
    }
  // Exposed letters: white when the flash lands, cooling to the light.
  for (const L of S.lit) {
    const G = scaled(L.ch, L.m), top = round(GB - (S.film - L.fy) - 7 * L.m + 1);
    if (top + G.h < 0 || top > FY1) continue;
    const w = exp(-(t - L.t) / 0.35);
    const r0 = light[0] + (1 - light[0]) * w, g0 = light[1] + (1 - light[1]) * w, b0 = light[2] + (1 - light[2]) * w;
    for (let py = 0; py < G.h; py++) {
      const y = top + py;
      if (y < 0 || y > FY1) continue;
      for (let px = 0; px < G.w; px++) {
        const a = G.cov[py * G.w + px];
        if (a) add(rgb, L.x + px, y, r0, g0, b0, a * 0.9);
      }
    }
  }

  // The disk.
  // Each frame shows the disk over half the frame's turn, like a shutter
  // open half the time.
  const n = DISK.idx.length, span = 0.5 * (S.phi - S.prev), ns = cl(ceil((abs(span) * 28) / 1.2), 1, 6);
  const glass = hsv(0.6 + S.hue, 0.3, 0.12, c3);
  for (let q = 0; q < n; q++) {
    const p = DISK.idx[q], rr = DISK.rad[q], a = DISK.ang[q], ring = DISK.ring[q];
    let r = glass[0], g = glass[1], b = glass[2];
    if (rr > RD - 1) (r = 0.3), (g = 0.31), (b = 0.33);
    else if (rr < HUB) {
      // The hub, with three bolts that turn with the disk.
      let bolt = 0;
      for (let k = 0; k < 3; k++) {
        const ba = (k * TAU) / 3 - S.phi, bx = CX + 4.6 * sin(ba), by = CY - 4.6 * cos(ba);
        const x = (p % W) + 0.5, y = floor(p / W) + 0.5, e = (x - bx) * (x - bx) + (y - by) * (y - by);
        bolt = max(bolt, cl(1.6 - e, 0, 1));
      }
      const v = 0.32 - 0.22 * bolt;
      (r = v), (g = v * 1.02), (b = v * 1.06);
    } else if (ring >= 0) {
      let s = 0;
      for (let k = 0; k < ns; k++) s += diskGlyph(ring, rr, a + S.phi - (span * (k + 0.5)) / ns);
      s /= ns;
      r += s * (0.1 + 0.32 * light[0]), g += s * (0.1 + 0.32 * light[1]), b += s * (0.1 + 0.32 * light[2]);
    }
    rgb[p * 3] += r, rgb[p * 3 + 1] += g, rgb[p * 3 + 2] += b;
  }

  // The flash: the glyph at the window frozen white, a glow round it, and
  // its light through the lens to the film.
  const F = S.flash;
  if (F) {
    const age = t - F.t, e = exp(-age / 0.07), eb = exp(-age / 0.12);
    if (e > 0.01) {
      const rc = RINGS[F.r].rc, oy = CY - rc;
      for (let y = floor(oy - 9); y <= ceil(oy + 9); y++)
        for (let x = 22; x < 42; x++) {
          const dx = x + 0.5 - CX, dy = y + 0.5 - CY, rr = sqrt(dx * dx + dy * dy);
          let a = atan2(dx, -dy);
          if (a < 0) a += TAU;
          const nn = RINGS[F.r].n, b = a + F.phi, jj = ((round((b * nn) / TAU) % nn) + nn) % nn;
          const gv = abs(rr - rc) < 4.4 && jj === F.j ? diskGlyph(F.r, rr, b) : 0;
          const halo = exp(-(dx * dx + (y + 0.5 - oy) ** 2) / 22) * 0.35;
          add(rgb, x, y, 1, 1, 1, gv * e * 1.2);
          add(rgb, x, y, light[0], light[1], light[2], halo * e);
        }
    }
    if (eb > 0.01) {
      // Object 5 LEDs wide at the window, lens of half-width 7.5 where it
      // gives magnification m for the outer ring, image 5m wide with its
      // foot on the gate.
      const m = F.m, o0 = CY - RINGS[0].rc, oy = CY - RINGS[F.r].rc, iy = GB + 1 - 3.5 * m, ix = F.x + 2.5 * m;
      const ly = o0 - (o0 - iy) / (1 + m), ox = CX;
      for (let y = floor(iy); y <= ceil(oy); y++) {
        const yc = y + 0.5;
        let cx, hw;
        if (yc >= ly) {
          const u = (yc - ly) / (oy - ly);
          (cx = ox), (hw = 7.5 + (2.5 - 7.5) * u);
        } else {
          const u = (ly - yc) / (ly - iy);
          (cx = ox + (ix - ox) * u), (hw = 7.5 + (2.5 * m - 7.5) * u);
        }
        for (let x = floor(cx - hw - 1); x <= ceil(cx + hw + 1); x++) {
          const a = cl(hw + 0.5 - abs(x + 0.5 - cx), 0, 1);
          add(rgb, x, y, light[0], light[1], light[2], a * eb * 0.45);
        }
      }
    }
  }

  // The lens, at the height that gives the knob's magnification for the
  // outer ring, and the carriage mark under the line.
  {
    const m = S.m, oy = CY - RINGS[0].rc, iy = GB + 1 - 3.5 * m, ly = oy - (oy - iy) / (1 + m);
    const glow = F ? exp(-(t - F.t) / 0.12) : 0;
    for (let x = 23; x <= 40; x++) {
      const u = (x + 0.5 - CX) / 8.5, hh = 1.6 * sqrt(max(0, 1 - u * u));
      if (hh <= 0) continue;
      for (let y = floor(ly - hh); y <= ceil(ly + hh); y++) {
        const a = cl(hh + 0.5 - abs(y + 0.5 - ly), 0, 1);
        add(rgb, x, y, 0.25 + 0.5 * light[0] * glow, 0.3 + 0.5 * light[1] * glow, 0.34 + 0.5 * light[2] * glow, a);
      }
    }
    const px = round(S.pen);
    for (let x = px; x < px + 5 * m; x++) add(rgb, x, GB + 2, light[0], light[1], light[2], 0.45);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 3;
      display.setPixel(x, y, min(255, rgb[k] * 255) | 0, min(255, rgb[k + 1] * 255) | 0, min(255, rgb[k + 2] * 255) | 0);
    }
}
