// ===== Patternflow pattern =====
// Title:   Grimoire
// Family:  halloween
// Idea:    A spellbook lies open on a lectern in a dark tower room beside a flickering candle, and a ghostly draft turns its pages by itself, each sheet lifting and curling over, catching the candle light before it lands; on every new spread a toxic-green sigil draws itself stroke by stroke, then its glyphs peel off the page one by one and rise up the dark as green sparks and wisps that fade near the top.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wind=0..1, Glow=0..1
//
// Knob 1: Hue. The colour of the magic, round the whole wheel: toxic green at 0, sky blue at 0.25, violet at 0.5, ember orange at 0.75 and green again at 1. The dark of the room moves from purple at 0 through indigo to deep teal at 1. The candle and the paper stay warm.
// Knob 2: Speed. At 2 the first page lifts at 0.5 s, a slow page takes 1.6 seconds to cross, a sigil draws in 1.4 seconds and burns for 2.6 while its glyphs rise; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Wind. At 0 one slow page turns every 7.8 seconds and the candle stands nearly straight; at 1 the draft riffles seven pages over in 1.1 seconds every 5.9 seconds and lifts the free edge of the next page while it waits. The flame leans and gutters with the draft, and the rising glyphs drift right.
// Knob 4: Glow. How bright the sigil burns: at 0 a thin line and a dim green light on the pages, at the opening 0.06 a little more. At 1 the sigil blazes and lights the room green, throwing four times the sparks, and every rising glyph trails a thick wisp.
// Buttons: K1 tap sends a gust that riffles pages now.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
const hash = (i) => {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The book in its own frame: x across the spread from the gutter (a page
// is PW wide), y down the page from its middle (PH tall), z up off the
// paper. The lectern tilts it toward us; the eye looks down at it.
const GX = 32, YC = 87, PW = 27, PH = 44, CA = cos(0.92), SA = sin(0.92);
// The rise of the paper out of the gutter.
const zp = (x) => 2.4 * (1 - (1 - min(1, abs(x) / 12)) ** 2);
// Book frame to the panel, with a little perspective: the near edge is wider.
function proj(x, y, z, out) {
  const k = 1 + 0.005 * (y * SA + z * CA);
  // Seen a little from the right, so a standing sheet is not edge on.
  out[0] = GX + (x + 0.3 * z) * k;
  out[1] = YC + (y * CA - z * SA) * k;
  out[2] = y * SA + z * CA;
}
// The candle: its flame on the panel and in the book frame.
const FX = 9, FY = 53, CANDLE = [-25, -27, 22];
// The sigil hovers flat at ZS over the paper; its middle on the panel.
const ZS = 3, SGX = GX + 0.3 * ZS, SGY = YC - ZS * SA;

// Light from the candle on a surface with normal n at book point p.
function lambert(px, py, pz, nx, ny, nz) {
  let lx = CANDLE[0] - px, ly = CANDLE[1] - py, lz = CANDLE[2] - pz;
  const d = sqrt(lx * lx + ly * ly + lz * lz);
  return max(0, (lx * nx + ly * ny + lz * nz) / d) / (1 + (d * d) / 2500);
}

// Ink on a page: lines of words with margins, laid out by the page's
// number. u runs from the gutter out, v down the page, both 0..1.
function ink(page, u, v) {
  if (u < 0.12 || u > 0.9 || v < 0.08 || v > 0.93) return 0;
  const yy = v * PH, line = floor(yy / 3.4);
  if (yy - line * 3.4 > 1.3) return 0;
  const sd = page * 131 + line * 17, xx = u * PW;
  // A short last line now and then, and a blank line between paragraphs.
  if (hash(sd) < 0.12 || xx > PW * (0.9 - (hash(sd + 1) < 0.25 ? 0.5 * hash(sd + 2) : 0))) return 0;
  const word = floor(xx / 3.2 + hash(sd + 3) * 3);
  return (xx / 3.2 + hash(sd + 3) * 3) % 1 < 0.78 - 0.25 * hash(sd + word) ? 1 : 0;
}
const PAPER = [1, 0.82, 0.56], INKC = [0.5, 0.31, 0.22];

// Where every LED of the lying spread is on the paper, found once by
// scattering fine samples: page x and y, how much of the LED is paper, and
// the candle light on it.
const SPX = new Float32Array(N), SPY = new Float32Array(N), SPC = new Float32Array(N), SPL = new Float32Array(N);
{
  const o = [0, 0, 0], n = new Float32Array(N);
  for (let x = -PW + 0.15; x < PW; x += 0.3)
    for (let y = -PH / 2 + 0.15; y < PH / 2; y += 0.3) {
      proj(x, y, zp(x), o);
      const p = floor(o[1]) * W + floor(o[0]);
      SPX[p] += x;
      SPY[p] += y;
      n[p]++;
    }
  for (let p = 0; p < N; p++)
    if (n[p]) {
      (SPX[p] /= n[p]), (SPY[p] /= n[p]);
      SPC[p] = min(1, n[p] / 9);
      const x = SPX[p], s = (zp(x + 0.1) - zp(x - 0.1)) / 0.2, l = sqrt(1 + s * s);
      // Darker into the gutter, where the paper turns away and down.
      SPL[p] = lambert(x, SPY[p], zp(x), -s / l, 0, 1 / l) * (0.55 + 0.45 * min(1, abs(x) / 5));
    }
}

// The room, the lectern, the book's cover and the candle's wax, as an
// unlit colour and how much candle light each LED takes, built per Hue.
const WALL = 0, WOOD = 1, COVER = 2, WAX = 3, EDGE = 4;
const KIND = new Uint8Array(N), CLF = new Float32Array(N), GLF = new Float32Array(N);
{
  const o = [0, 0, 0], cov = new Uint8Array(N);
  // The cover: the pages' outline grown by 1.6 and pushed 2 down.
  for (let x = -PW - 1.6; x < PW + 1.6; x += 0.3)
    for (let y = -PH / 2 - 1.6; y < PH / 2 + 1.6; y += 0.3) {
      proj(x, y, -1.2, o);
      cov[floor(o[1]) * W + floor(o[0])] = 1;
    }
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), dx = x + 0.5 - FX, dy = y + 0.5 - FY;
    let k = WALL;
    // The lectern: the slanted board under the book, its front edge, a
    // turned post and a foot.
    const post = abs(x + 0.5 - GX) < 4.5 - 1.6 * sin(((y - 104) / 6) * PI) ** 2 && y >= 104;
    if ((y >= 98 && y < 104 && abs(x + 0.5 - GX) < 29 - (y - 98) * 0.5) || post || (y >= 121 && abs(x + 0.5 - GX) < 16 - (y - 121) * 0.3)) k = WOOD;
    if (y === 103 && k === WOOD) k = EDGE;
    if (cov[p] || SPC[p] > 0) k = COVER;
    // The candle stands behind the book's top left corner.
    if (abs(x + 0.5 - FX) < 1.8 && y >= FY + 4 && y < 74 && !cov[p] && !SPC[p]) k = WAX;
    KIND[p] = k;
    const r = sqrt(dx * dx + dy * dy);
    CLF[p] = k === WAX ? 0.9 - (y - FY - 4) * 0.035 : 1 / (1 + (r * r) / (k === WALL ? 200 : 380)) * (k === WOOD && x < GX ? 1.3 : 1);
    // The sigil's light: strong on the spread, rising up the wall above it.
    const gx = (x + 0.5 - SGX) / 34, gy = (y + 0.5 - SGY) / (y < SGY ? 46 : 18);
    GLF[p] = exp(-(gx * gx + gy * gy) * 2);
  }
}
function scene(S) {
  const room = hsv(0.78 - 0.3 * S.hue, 0.7, 1), A = S.amb, L = S.lit;
  for (let p = 0; p < N; p++) {
    const x = p % W, y = floor(p / W), k = KIND[p];
    let a, l;
    if (k === WALL) {
      // Rough stone blocks of uneven length, the dark gathering toward the top.
      const row = floor(y / 7);
      let bx = -floor(hash(row) * 9), i = 0;
      while (bx + 7 + floor(hash(row * 31 + i) * 7) <= x) bx += 7 + floor(hash(row * 31 + i++) * 7);
      const mortar = y % 7 === 0 || x === bx, v = (mortar ? 0.55 : 0.8 + 0.2 * hash(row * 53 + i)) * (0.6 + 0.4 * min(1, y / 80));
      a = room.map((c) => c * 0.19 * v);
      l = [(0.72 + 0.1 * room[0]) * v, (0.42 + 0.1 * room[1]) * v, (0.24 + 0.1 * room[2]) * v];
    } else if (k === WOOD || k === EDGE) {
      const grain = 0.85 + 0.15 * sin(x * 0.7 + y * 0.2);
      a = [0.09 * grain, 0.035, 0.08 * grain];
      l = k === EDGE ? [0.85, 0.5, 0.25] : [0.5 * grain, 0.24 * grain, 0.14];
    } else if (k === COVER) {
      a = [0.09, 0.02, 0.1];
      l = [0.42, 0.14, 0.2];
    } else {
      a = [0.12, 0.1, 0.08];
      l = [1, 0.85, 0.6];
    }
    for (let c = 0; c < 3; c++) (A[3 * p + c] = a[c]), (L[3 * p + c] = l[c] * CLF[p]);
  }
}

// Tiny invented glyphs, 3x3, row by row from the top left.
const GLYPH = [0b111010010, 0b101010101, 0b110011001, 0b010101010, 0b111101001, 0b100111001, 0b011100011, 0b101111101, 0b110010011, 0b001010111, 0b010111100, 0b111001110];

// A new sigil: an outer ring, a ring of glyphs, an inner ring, a polygon or
// star in it and a small eye in the middle, as strokes in book coordinates
// drawn in that order. Each stroke is a list of points; glyphs are points.
function sigil(seed) {
  const r = (i) => hash(seed * 97 + i), circle = (R, a0) => {
    const pts = [];
    for (let i = 0; i <= 64; i++) pts.push([R * cos(a0 + (TAU * i) / 64), R * sin(a0 + (TAU * i) / 64)]);
    return pts;
  };
  const a0 = r(1) * TAU, forms = [[3, 1], [4, 1], [7, 2], [7, 3], [8, 3], [5, 1], [6, 1], [9, 4]], [n, m] = forms[floor(r(2) * 8)];
  const star = [];
  for (let i = 0; i <= n; i++) star.push([12.5 * cos(a0 + (TAU * i * m) / n), 12.5 * sin(a0 + (TAU * i * m) / n)]);
  const ng = 8 + floor(r(3) * 4), glyphs = [];
  for (let i = 0; i < ng; i++) glyphs.push({ x: 16.5 * cos(a0 + (TAU * i) / ng), y: 16.5 * sin(a0 + (TAU * i) / ng), g: floor(r(10 + i) * GLYPH.length), gone: false });
  const strokes = [circle(20.5, a0), null, circle(13.5, a0 + PI), star, circle(3, 0)];
  // Lengths, so the pen can run along them at one speed; the glyph ring
  // counts as one more stroke, a glyph every 4 units.
  const len = strokes.map((s) => {
    if (!s) return ng * 4;
    let l = 0;
    for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    return l;
  });
  return { strokes, glyphs, len, total: len.reduce((a, b) => a + b, 0) };
}

export function setup(params) {
  params.s = {
    fresh: true, t: 0, hue: 0, speed: 2, wind: 0, glow: 0.06, key: "", prevBtn: false,
    phase: "turn", pt: -0.5, pages: [], page: 0, leftPage: -1, sg: sigil(1), sgA: 0, draw: 1, flick: 1, lean: 0,
    risers: [], sparks: [], amb: new Float32Array(N * 3), lit: new Float32Array(N * 3),
    buf: new Float32Array(N * 3), zb: new Float32Array(N), mg: new Float32Array(N), ws: new Float32Array(N), o: [0, 0, 0],
  };
}

// The pages that turn at once: one slow sheet in a calm, a riffle in a gale.
function startTurn(S, gust) {
  const w = gust ? max(S.wind, 0.6) : S.wind, n = 1 + round(6 * w * w), dur = 1.6 - 1.1 * w, gap = dur * (0.32 - 0.12 * w);
  S.pages = [];
  for (let i = 0; i < n; i++) S.pages.push({ start: i * gap, dur, num: S.page + i });
  S.page += n;
  S.phase = "turn";
  S.pt = 0;
}

// A glyph leaves the page and rises.
function rise(S, x, y, g) {
  S.risers.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: -11 - 7 * Math.random(), g, age: 0, ph: Math.random() * TAU });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.wind = cl(k[2], 0, 1);
  S.glow = cl(k[3], 0, 1);
  const ds = (d * S.speed) / 2;
  S.t += ds;
  if (S.fresh) {
    // The night is already going: the last sigil's glyphs are on their way
    // up and its light is dying on the page.
    S.fresh = false;
    for (let i = 0, n = 7 + round(5 * S.glow); i < n; i++) {
      rise(S, SGX + (Math.random() - 0.5) * 34, SGY - 4 - Math.random() * 8, floor(Math.random() * GLYPH.length));
      const r = S.risers[i], a = 0.4 + 2.6 * Math.random();
      for (let s = 0; s < a; s += 0.05) step(S, r, 0.05);
    }
    S.sgA = 1;
    for (const g of S.sg.glyphs) g.gone = true;
    S.pages = [{ start: 0, dur: 1.6 - 1.1 * S.wind, num: 0 }];
    S.page = 1;
  }
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !S.prevBtn && !(S.phase === "turn" && S.pt < 0.3)) {
    for (const g of S.sg.glyphs) if (!g.gone && S.phase !== "turn") (g.gone = true), rise(S, ...glyphAt(S, g));
    startTurn(S, true);
  }
  S.prevBtn = btn;
  S.pt += ds;
  // The story: turn the pages, draw the sigil, burn it and let it fade, rest, then turn again.
  if (S.phase === "turn") {
    S.sgA = max(0, S.sgA - ds * 1.3);
    for (const p of S.pages) if (S.pt > p.start + p.dur) S.leftPage = max(S.leftPage, p.num * 2 + 1);
    if (S.pages.every((p) => S.pt > p.start + p.dur)) (S.phase = "draw"), (S.pt = 0), (S.draw = 0), (S.sg = sigil(S.page * 7 + 3)), (S.sgA = 1), (S.pages = []);
  } else if (S.phase === "draw") {
    S.draw = min(1, S.pt / 1.4);
    if (S.pt > 1.4) (S.phase = "burn"), (S.pt = 0);
  } else if (S.phase === "burn") {
    // The glyphs peel off one by one round the ring.
    const gs = S.sg.glyphs;
    gs.forEach((g, i) => {
      if (!g.gone && S.pt > 0.3 + (2 * i) / gs.length) (g.gone = true), rise(S, ...glyphAt(S, g));
    });
    if (S.pt > 2.6) (S.phase = "fade"), (S.pt = 0);
  } else if (S.phase === "fade") {
    S.sgA = 1 - S.pt / 0.6;
    if (S.pt > 0.6) (S.phase = "rest"), (S.pt = 0), (S.sgA = 0);
  } else if (S.pt > 1.6 - 1.4 * S.wind) startTurn(S, false);
  // Sparks fly off a burning sigil and off the pen.
  const burning = S.phase === "burn" ? 1 : S.phase === "draw" ? 0.5 : 0;
  const want = burning * ds * (10 + 30 * S.glow);
  for (let i = 0, n = floor(want) + (Math.random() < want % 1 ? 1 : 0); i < n; i++) {
    const a = Math.random() * TAU, r = Math.random() < 0.5 ? 20.5 : 13.5;
    proj(r * cos(a), r * sin(a), ZS, S.o);
    S.sparks.push({ x: S.o[0], y: S.o[1], vx: (Math.random() - 0.5) * 6, vy: -18 - 14 * Math.random(), age: 0, life: 0.6 + Math.random() });
  }
  for (const r of S.risers) step(S, r, ds);
  S.risers = S.risers.filter((r) => r.y > -4);
  for (const s of S.sparks) (s.x += (s.vx + 10 * S.wind) * ds), (s.y += s.vy * ds), (s.age += ds);
  S.sparks = S.sparks.filter((s) => s.age < s.life);
  // The flame: flicker and the draft's lean.
  // The draft bows the flame and makes it gutter.
  S.flick = 0.84 - 0.24 * S.wind + (0.08 + 0.12 * S.wind) * sin(S.t * 13) + 0.06 * sin(S.t * 31 + 1) + 0.05 * (Math.random() - 0.5);
  S.lean = S.wind * (1.6 + 0.8 * sin(S.t * 3.1)) + 0.4 * sin(S.t * 2.3);
  // The wisps fade.
  const f = exp(-ds / 0.55);
  for (let p = 0; p < N; p++) S.ws[p] *= f;
}

// A rising glyph: up with a sway, drifting with the wind, leaving a wisp.
function step(S, r, ds) {
  r.age += ds;
  r.vy *= 1 - 0.15 * ds;
  r.x += (r.vx + 5 * sin(r.age * 2.2 + r.ph) + 12 * S.wind) * ds;
  r.y += r.vy * ds;
  const x = floor(r.x), y = floor(r.y) + 2;
  if (x >= 0 && x < W && y >= 0 && y < H) S.ws[y * W + x] = min(1.4, S.ws[y * W + x] + (0.25 + 0.5 * S.glow) * ds * 8);
}

// Where a glyph of the sigil sits on the panel, and which it is.
function glyphAt(S, g) {
  proj(g.x, g.y, ZS, S.o);
  return [S.o[0], S.o[1], g.g];
}

// One turning sheet as fine samples: its section bends from the gutter
// (angle th0) to the free edge (th1), lifting off the right-hand pile and
// landing on the left. The face toward us shows text and takes the candle
// light; a glint runs across it as it faces the flame.
function sheet(S, pg, u) {
  const { buf, zb, o } = S;
  const th0 = PI * ease(u), bend = 0.8 * sin(TAU * u) + 0.25 * S.wind * sin(S.t * 9) * sin(PI * u);
  const th1 = cl(th0 + bend, 0.03, PI - 0.03), lift = 1 - sin(PI * u);
  let x = 0, z = 0;
  const NS = 54, ds = PW / NS;
  for (let i = 0; i < NS; i++) {
    const s = (i + 0.5) / NS, th = th0 + (th1 - th0) * s ** 1.6, c = cos(th), sn = sin(th);
    x += c * ds;
    z += sn * ds;
    const zz = z + zp(x) * lift + 0.3, front = th < PI / 2;
    // Normal of the face we see, and its light.
    const nx = front ? -sn : sn, nz = front ? c : -c;
    const li = lambert(x, 0, zz, nx, 0, nz), glint = li > 0 ? max(0, nx * -0.55 + nz * 0.83) ** 24 : 0;
    const lv = 0.38 + 1.6 * li * S.flick;
    const side = front ? pg.num * 2 : pg.num * 2 + 1, uu = s;
    for (let y = -PH / 2 + 0.25; y < PH / 2; y += 0.5) {
      proj(x, y, zz, o);
      const px = floor(o[0]), py = floor(o[1]);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const p = py * W + px;
      if (o[2] < zb[p]) continue;
      zb[p] = o[2];
      const k = ink(side, uu, (y + PH / 2) / PH), edge = s > 0.97 || abs(y) > PH / 2 - 0.6 ? 0.8 : 1;
      for (let ch = 0; ch < 3; ch++) buf[3 * p + ch] = (k ? INKC[ch] : PAPER[ch]) * min(1.15, lv) * edge + glint * 0.45;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const key = S.hue.toFixed(3);
  if (key !== S.key) (S.key = key), scene(S);
  const { buf, amb, lit, mg, ws, zb, sg, o } = S, fl = S.flick, mc = hsv(0.3 + S.hue, 0.8, 1);
  const burn = S.sgA * (S.phase === "burn" ? 1 + 0.25 * sin(S.t * 17) : S.phase === "draw" ? 0.6 + 0.4 * S.draw : 0.8);
  const gl = burn * (0.08 + 0.92 * S.glow);
  // Room, lectern, cover and candle wax, lit by the flame and the sigil.
  for (let p = 0, q = 0; p < N; p++, q += 3)
    for (let c = 0; c < 3; c++) buf[q + c] = amb[q + c] + lit[q + c] * fl + mc[c] * GLF[p] * gl * 0.8;
  // The lying spread: the left page shows the back of the last sheet that
  // turned, the right one the next sheet.
  const left = S.leftPage, right = S.page * 2;
  for (let p = 0; p < N; p++) {
    const cv = SPC[p];
    if (!cv) continue;
    const x = SPX[p], pg = x < 0 ? left : right;
    const k = ink(pg, abs(x) / PW, (SPY[p] + PH / 2) / PH), lv = 0.22 + 1.7 * SPL[p] * fl, q = 3 * p;
    for (let c = 0; c < 3; c++) {
      const v = (k ? INKC[c] : PAPER[c]) * lv + mc[c] * GLF[p] * gl * 0.6;
      buf[q + c] += (v - buf[q + c]) * cv;
    }
  }
  // The next sheet flutters in the draft, under the hovering sigil.
  zb.fill(-1e9);
  if (S.wind > 0.05 && S.phase !== "turn") sheet(S, { num: S.page }, 0.05 * S.wind * (0.7 + 0.3 * sin(S.t * 7) * sin(S.t * 2.9)));
  // The sigil: strokes up to where the pen is, each LED a bright line with a glow.
  mg.fill(0);
  if (S.sgA > 0) {
    let budget = (S.phase === "draw" ? S.draw : 1) * sg.total, pen = null;
    sg.strokes.forEach((st, si) => {
      if (budget <= 0) return;
      if (!st) {
        sg.glyphs.forEach((g, i) => {
          if (budget > i * 4 && !g.gone) {
            const [gx, gy, gi] = glyphAt(S, g);
            for (let b = 0; b < 9; b++) if ((GLYPH[gi] >> (8 - b)) & 1) put(mg, floor(gx) - 1 + (b % 3), floor(gy) - 1 + floor(b / 3), 1);
          }
        });
        budget -= sg.len[si];
        return;
      }
      let l = 0;
      for (let i = 1; i < st.length && l < budget; i++) {
        const [ax, ay] = st[i - 1], [bx, by] = st[i], sl = Math.hypot(bx - ax, by - ay);
        for (let f = 0; f < sl && l + f < budget; f += 0.45) {
          const x = ax + ((bx - ax) * f) / sl, y = ay + ((by - ay) * f) / sl;
          proj(x, y, ZS, o);
          put(mg, floor(o[0]), floor(o[1]), 1);
          pen = [o[0], o[1]];
        }
        l += sl;
      }
      budget -= sg.len[si];
    });
    const a = S.sgA * (0.55 + 0.45 * S.glow), core = [0.3 + 0.7 * mc[0], 0.3 + 0.7 * mc[1], 0.3 + 0.7 * mc[2]];
    for (let y = 60; y < 104; y++)
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x, m = mg[p], h = (mg[p - 1] + mg[p + 1] + mg[p - W] + mg[p + W]) * 0.25 + (mg[p - W - 1] + mg[p - W + 1] + mg[p + W - 1] + mg[p + W + 1]) * 0.12;
        if (!m && !h) continue;
        for (let c = 0; c < 3; c++) {
          const q = 3 * p + c;
          buf[q] = m ? buf[q] + (core[c] * min(1, burn + 0.2) - buf[q]) * min(1, a * 1.6) : buf[q] + mc[c] * h * a * 0.6;
        }
      }
    // The pen: a white-hot point where the line is being drawn.
    if (pen && S.phase === "draw") glow(buf, pen[0], pen[1], [1, 1, 0.9], 1.8, 1);
  }
  // Turning sheets, over the spread and its sigil.
  zb.fill(-1e9);
  for (const pg of S.pages) {
    const u = (S.pt - pg.start) / pg.dur;
    if (u > 0 && u < 1) sheet(S, pg, u);
  }
  // The candle flame, leaning with the draft, and its halo.
  const lean = S.lean, fh = 6 + 1.2 * sin(S.t * 9) + 0.6 * (fl - 0.82) * 5;
  for (let y = floor(FY - fh - 1); y <= FY + 4; y++)
    for (let x = FX - 5; x <= FX + 5; x++) {
      const v = (FY + 3.5 - (y + 0.5)) / (fh + 3.5);
      if (v < 0 || v > 1 || x < 0) continue;
      const cx = FX + lean * v * v, wdt = 1.9 * sin(PI * (0.15 + 0.85 * v) ** 0.8) * (1 - v * 0.6), dx = abs(x + 0.5 - cx);
      if (dx > wdt + 0.5) continue;
      const a = cl(wdt + 0.5 - dx, 0, 1), hot = 1 - v, q = 3 * (y * W + x), col = [1, 0.45 + 0.5 * hot, 0.1 + 0.6 * hot * hot];
      for (let c = 0; c < 3; c++) buf[q + c] += (col[c] * fl * 1.15 - buf[q + c]) * a;
    }
  glow(buf, FX + lean * 0.5, FY - 2, [1, 0.5, 0.15], 9, 0.28 * fl);
  // Wisps, rising glyphs and sparks in the colour of the magic.
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    const w = ws[p];
    if (w > 0.01) {
      const a = min(1, w) * (0.3 + 0.3 * S.glow) * min(1, floor(p / W) / 30);
      for (let c = 0; c < 3; c++) buf[q + c] += mc[c] * a;
    }
  }
  for (const r of S.risers) {
    const a = min(1, r.age / 0.2) * cl((r.y - 4) / 34, 0, 1), x0 = floor(r.x) - 1, y0 = floor(r.y) - 1, gb = GLYPH[r.g];
    for (let b = 0; b < 9; b++) {
      const x = x0 + (b % 3), y = y0 + floor(b / 3);
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const q = 3 * (y * W + x), on = (gb >> (8 - b)) & 1 ? a : a * 0.25;
      for (let c = 0; c < 3; c++) buf[q + c] += ((0.35 + 0.65 * mc[c]) * 1.1 - buf[q + c]) * on;
    }
  }
  for (const s of S.sparks) {
    const x = floor(s.x), y = floor(s.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const a = (1 - s.age / s.life) * (0.6 + 0.4 * sin(s.age * 40)), q = 3 * (y * W + x);
    for (let c = 0; c < 3; c++) buf[q + c] += (0.5 + 0.5 * mc[c]) * a;
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, min(255, round(buf[q] * 255)), min(255, round(buf[q + 1] * 255)), min(255, round(buf[q + 2] * 255)));
}

function put(mg, x, y, v) {
  if (x >= 0 && x < W && y >= 0 && y < H) mg[y * W + x] = v;
}
// A round soft light added at (x, y).
function glow(buf, gx, gy, col, r, a) {
  for (let y = max(0, floor(gy - 2 * r)); y < min(H, gy + 2 * r); y++)
    for (let x = max(0, floor(gx - 2 * r)); x < min(W, gx + 2 * r); x++) {
      const dx = x + 0.5 - gx, dy = y + 0.5 - gy, f = a * exp(-(dx * dx + dy * dy) / (r * r)), q = 3 * (y * W + x);
      for (let c = 0; c < 3; c++) buf[q + c] += col[c] * f;
    }
}
