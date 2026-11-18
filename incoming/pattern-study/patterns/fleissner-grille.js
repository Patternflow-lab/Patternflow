// ===== Patternflow pattern =====
// Title:   Fleissner Grille
// Family:  type
// Idea:    A dark card with square windows turns a quarter at a time over a square grid while the letters of a message lift out of a plain square below and land one by one in the windows, in reading order, until the grid holds the scramble, and then the same card is turned again and the letters fly back down in the same order and spell the message.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the turning grille (Eduard Fleissner von Wostrowitz, 1881, in his Handbuch der Kryptographie, year and book from memory), which goes back to the card with holes of Girolamo Cardano (around 1550, from memory); the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Grid=6..8, Turn=0..90
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the card and its window rims are azure, the letters of one word are pale and those of the next are pink, so the scramble still shows which letters came from which word, and when the message is back the four quarters light as tiles of azure, violet, red and lime; at 0.5 the card is orange.
// Knob 2: Speed. At 2 each letter takes 0.42 s to fly, a new one leaves every 0.12 s and a quarter turn of the card takes 0.8 s. An 8 by 8 card is punched by 3.9 s, its last letter lands at 17.0 s, the scramble is read out by 19.6 s, the last letter is back at 33.2 s and the cycle ends at 36.2 s; a 6 by 6 cycle takes 29.1 s. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Grid. The size of the card. Below 7 it is a 6 by 6 card (9 windows, 36 letters, 4^9 = 262,144 possible cards) and from 7 up an 8 by 8 card (16 windows, 64 letters, 4^16 = 4,294,967,296 cards). It opens at 6, and turning it across 7 draws a new card at the other size. Each cycle punches a fresh card, one window in each set of four cells that a quarter turn carries into one another, picked by a seeded generator, and writes the next of four messages for that size.
// Knob 4: Turn. A hand on the card, 0 to 90 degrees clockwise, added to the angle it is at. It opens at 0.06 degrees, where the windows sit on the cells. At 45 the card hangs crooked over the grid and each letter lands under the dark part of it, and at 90 the card is a whole quarter ahead, so its windows stand over the cells the next quarter would fill.

const W = 64, H = 128;
const { floor, min, max, abs, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, both copied from edit-distance.js.
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

// Four messages for each size, 64 and 36 letters without the spaces. The spaces only say where the words end.
const TEXT = {
  8: [
    "TURN THE CARD A QUARTER THEN WRITE THE NEXT SIXTEEN LETTERS THROUGH ITS HOLES",
    "THE SQUARE IS FULL SO READ IT ROW BY ROW AND NOBODY WILL FIND A SINGLE WHOLE WORD",
    "MEET ME BY THE OLD STONE BRIDGE AT NOON AND BRING THE MAP AND TWO SMALL LANTERNS",
    "EVERY LETTER IS STILL HERE IT HAS ONLY MOVED TO ANOTHER SQUARE OF THE SAME GRID",
  ],
  6: [
    "MEET ME AT THE OLD STONE BRIDGE AT NOON ALONE",
    "THE CARD TURNS AND EVERY LETTER MOVES ALONG",
    "SEND THE OLD MAP TO ME BEFORE THE RIVER RISES",
    "NINE HOLES WRITE NINE LETTERS AND THEN TURN",
  ],
};

// Timing in seconds at Speed 2.
const LI = 0.12, FL = 0.42, TURN = 0.8, PUNCH = 2.4, FADE = 0.5, HOLD = 2.2, OUT = 0.6, ROW = 0.18;

// One card and one message: the orbits of cells under a quarter turn, a window chosen in each, where each letter lands, and the clock.
function build(n, cyc) {
  const N = n * n, m = N / 4, P = n === 8 ? 8 : 10, O = (64 - n * P) / 2;
  let seed = (cyc * 2654435761 + n * 40503 + 12345) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // A quarter turn clockwise carries the cell at row r, column c to row c, column n - 1 - r.
  const turn = (c) => (c % n) * n + (n - 1 - floor(c / n));
  const orbit = [], lab = new Int16Array(N).fill(-1);
  for (let c = 0; c < N; c++)
    if (lab[c] < 0) {
      const o = [c];
      lab[c] = orbit.length;
      for (let k = 1, p = c; k < 4; k++) (p = turn(p)), o.push(p), (lab[p] = orbit.length);
      orbit.push(o);
    }
  // One window in each orbit, so that the four turns of the card cover every cell exactly once.
  const hole = orbit.map((o) => o[floor(rnd() * 4)]);
  const isHole = new Uint8Array(N), tgt = [], src = [];
  for (const h of hole) isHole[h] = 1;
  for (let q = 0; q < 4; q++) {
    const cells = hole.map((h) => {
      for (let k = 0; k < q; k++) h = turn(h);
      return h;
    });
    // The cell each window turns out to be on the grid, and the window it is on the card.
    const at = new Map(cells.map((c, j) => [c, hole[j]]));
    cells.sort((a, b) => a - b);
    for (const c of cells) (tgt.push(c), src.push(at.get(c)));
  }
  const words = TEXT[n][cyc % 4].split(" "), letters = [];
  words.forEach((w, wi) => {
    for (const ch of w) letters.push({ ch, tint: wi & 1 });
  });
  // The clock: numbers on the card, the punching, four quarters of writing, the read-out, four quarters of reading back, the hold.
  const dP = PUNCH / m, QUARTER = 0.3 + (m - 1) * LI + FL + 0.2, QT = QUARTER + TURN;
  const tP0 = 1.0, tE0 = tP0 + PUNCH + 0.5, tE1 = tE0 + 3 * QT + QUARTER;
  const tR1 = tE1 + OUT + n * ROW + 0.4, tD0 = tR1 + FADE, tD1 = tD0 + 3 * QT + QUARTER;
  const total = tD1 + HOLD + OUT;
  const Le = [], Ld = [];
  for (let i = 0; i < N; i++) {
    const q = floor(i / m), j = i % m;
    Le.push(tE0 + q * QT + 0.3 + j * LI);
    Ld.push(tD0 + q * QT + 0.3 + j * LI);
  }
  return { n, N, m, P, O, orbit, lab, hole, isHole, tgt, src, letters, dP, QT, QUARTER, tP0, tE0, tE1, tR1, tD0, tD1, total, Le, Ld };
}

export function setup(params) {
  const S = {
    rgb: new Float32Array(W * H * 3), let: new Float32Array(64 * 64 * 3), HS: new Float32Array(64), NA: new Float32Array(64), RF: new Float32Array(64),
    hue: 0, speed: 2, turn: 0, T: 0, cyc: 0, sw: 0, G: null, want: 6,
    c: [0, 0, 0], tmp: [0, 0, 0],
  };
  S.G = build(6, 0);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.turn = cl(kv[3], 0, 90);
  S.want = kv[2] < 7 ? 6 : 8;
  // A new size fades the card out and draws the next one at the other size.
  if (S.want !== S.G.n) {
    S.sw = min(1, S.sw + d / 0.25);
    if (S.sw >= 1) {
      S.cyc++;
      S.G = build(S.want, S.cyc);
      S.T = 0;
    }
  } else S.sw = max(0, S.sw - d / 0.25);
  S.T += (d * S.speed) / 2;
  if (S.T >= S.G.total) {
    S.cyc++;
    S.G = build(S.G.n, S.cyc);
    S.T = 0;
  }
}

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3, k = min(1, a);
  rgb[o] += (c[0] - rgb[o]) * k;
  rgb[o + 1] += (c[1] - rgb[o + 1]) * k;
  rgb[o + 2] += (c[2] - rgb[o + 2]) * k;
}

// A glyph at a whole-LED place.
function glyph(rgb, ch, x, y, c, a) {
  const g = GLYPH[ch];
  if (!g) return;
  for (let i = 0; i < 15; i++) if (g[i]) put(rgb, x + (i % 3), y + floor(i / 3), c, a);
}

// Where the card stands, in degrees, at a time: quarters at 0, 90, 180 and 270, and a turn of 0.8 s between them.
function quarterAngle(G, t0, T) {
  if (T < t0) return 0;
  const e = T - t0, q = min(3, floor(e / G.QT)), l = e - q * G.QT;
  return 90 * (q + (q < 3 ? sm((l - G.QUARTER) / TURN) : 0));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.G) return;
  const G = S.G, T = S.T, { n, N, m, P, O, letters, tgt, Le, Ld, tE1, tR1, tD0, tD1 } = G;
  const rgb = S.rgb, LET = S.let, HS = S.HS, NA = S.NA, RF = S.RF;
  rgb.fill(0);
  LET.fill(0);
  const h0 = 0.55 + S.hue;
  const pale = hsv(h0, 0.16, 1, [0, 0, 0]), warm = hsv(h0 + 0.36, 0.55, 1, [0, 0, 0]), tint = [pale, warm];
  const body = hsv(h0, 0.8, 0.13, [0, 0, 0]), edge = hsv(h0, 0.6, 1, [0, 0, 0]), rim = hsv(h0, 0.35, 1, [0, 0, 0]);
  const num = hsv(h0 + 0.08, 0.5, 0.85, [0, 0, 0]), hot = [1, 1, 1], dotC = hsv(h0, 0.4, 0.55, [0, 0, 0]), tmp = S.tmp;
  const fade = min(sm(T / FADE), 1 - sm((T - (G.total - OUT)) / OUT), 1 - S.sw);
  const gO = (P - 4) / 2, gV = (P - 6) / 2; // a glyph's place inside a window

  // The card's angle and how much of it shows.
  const deg = (T < tR1 ? quarterAngle(G, G.tE0, T) : quarterAngle(G, tD0, T)) + S.turn;
  const cardA = T < tE1 ? 1 : T < tR1 ? 1 - sm((T - tE1) / OUT) : T < tD1 ? sm((T - tR1) / FADE) : 1 - sm((T - tD1) / OUT);

  // The punching: each window opens at its turn and the numbers of its orbit go out.
  HS.fill(0);
  NA.fill(0);
  RF.fill(0);
  const nIn = sm((T - 0.3) / 0.6);
  for (let o = 0; o < m; o++) {
    const tp = G.tP0 + o * G.dP, cells = G.orbit[o];
    for (const c of cells) {
      if (c === G.hole[o]) {
        HS[c] = T >= G.tE0 ? 1 : sm((T - tp) / 0.3);
        NA[c] = T >= tp ? (T < tp + 0.12 ? 2 : 1 - sm((T - tp - 0.12) / 0.3)) : nIn;
      } else NA[c] = T >= tp ? 1 - sm((T - tp) / 0.35) : nIn;
    }
  }
  if (T >= G.tE0) NA.fill(0);

  // Letters: where each is and how bright, the plain square below and the grid above.
  const flying = [];
  let curE = 0, curD = 0;
  for (let i = 0; i < N; i++) {
    const L = letters[i], c = tint[L.tint];
    const pc = i % n, pr = floor(i / n), px = O + pc * P + gO, py = 64 + O + pr * P + gV;
    const gc = tgt[i] % n, gr = floor(tgt[i] / n), gx = O + gc * P + gO, gy = O + gr * P + gV;
    // The plain square: whole until the letter leaves, dim while it is away, gone while the message is read out, whole again when it is read back.
    const landD = Ld[i] + FL;
    let pa = 0, pf = 0;
    if (T < Le[i]) pa = 1;
    else if (T < Ld[i]) pa = 0.3 * (1 - sm((T - tE1 - 0.2) / 1.0));
    else if (T >= landD) (pa = 1), (pf = exp(-(T - landD) * 3));
    if (T >= Le[i]) curE = i + 1;
    if (T >= Ld[i]) curD = i + 1;
    if (pa > 0) {
      for (let e = 0; e < 3; e++) tmp[e] = mix(c[e], 1, pf * 0.8);
      glyph(rgb, L.ch, px, py, tmp, pa);
    } else put(rgb, px + 1, py + 2, dotC, 0.3);
    // The grid: the letter sits in its cell from landing to leaving, flashing as it lands and as the read-out passes.
    const landE = Le[i] + FL, wr = G.src[i];
    if (T >= Le[i] && T < landE) (flying.push([L, c, px, py, gx, gy, (T - Le[i]) / FL, i]), (RF[wr] = max(RF[wr], sm(((T - Le[i]) / FL - 0.4) / 0.6))));
    else if (T >= Ld[i] && T < landD) (flying.push([L, c, gx, gy, px, py, (T - Ld[i]) / FL, i]), (RF[wr] = max(RF[wr], 1 - sm((T - Ld[i]) / 0.3))));
    else if (T >= landE && T < Ld[i]) {
      let fl = exp(-(T - landE) * 5);
      RF[wr] = max(RF[wr], exp(-(T - landE) * 6));
      const row = gr, ts = tE1 + OUT + row * ROW;
      fl = max(fl, sm(1 - abs(T - ts - 0.17) / 0.3));
      const g = GLYPH[L.ch], gxx = O + gc * P + gO, gyy = O + gr * P + gV;
      for (let k = 0; k < 15; k++)
        if (g[k]) {
          const o3 = ((gyy + floor(k / 3)) * 64 + gxx + (k % 3)) * 3;
          for (let e = 0; e < 3; e++) LET[o3 + e] = mix(c[e], 1, fl * 0.85);
        }
    } else {
      // An empty cell keeps a dot where its letter will go.
      const o3 = ((gy + 2) * 64 + gx + 1) * 3;
      for (let e = 0; e < 3; e++) LET[o3 + e] = dotC[e] * 0.5;
    }
    // When the message is back, each quarter's cells light as tiles of their own colour, one quarter after another: four turns, every cell once.
    const ta = sm((T - tD1 - floor(i / m) * 0.3) / 0.4);
    if (ta > 0) {
      hsv(h0 + [0, 0.2, 0.45, 0.7][floor(i / m)], 0.65, 0.8, tmp);
      for (let v = 1; v < P - 2; v++)
        for (let u = 1; u < P - 2; u++) {
          const o3 = ((O + gr * P + v) * 64 + O + gc * P + u) * 3;
          for (let e = 0; e < 3; e++) LET[o3 + e] = max(LET[o3 + e], tmp[e] * ta);
        }
    }
  }

  // The top square: the letters under the card, the card with its windows, its rims and its numbers.
  const a = (deg * PI) / 180, cs = cos(a), sn = sin(a), Sz = n * P, half = Sz / 2;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const o3 = (y * 64 + x) * 3, o = (y * W + x) * 3;
      const dx = x + 0.5 - 32, dy = y + 0.5 - 32;
      const cu = dx * cs + dy * sn + half, cv = -dx * sn + dy * cs + half;
      const dm = min(cu, Sz - cu, cv, Sz - cv);
      let r = LET[o3], g = LET[o3 + 1], b = LET[o3 + 2];
      if (dm > -0.6 && cardA > 0) {
        const ec = cl(dm + 0.5, 0, 1) * cardA;
        const ci = cl(floor(cv / P), 0, n - 1), cj = cl(floor(cu / P), 0, n - 1), fu = cu - cj * P, fv = cv - ci * P;
        let hv = 0, rg = 0, rf = 0;
        for (let di = 0; di < 2; di++) {
          if (di && fv < P - 2) continue;
          for (let dj = 0; dj < 2; dj++) {
            if (dj && fu < P - 2) continue;
            const ii = ci + di, jj = cj + dj;
            if (ii >= n || jj >= n) continue;
            const hs = HS[ii * n + jj];
            if (hs <= 0) continue;
            const wc = (P - 1) / 2, dw = hs * wc - max(abs(cu - jj * P - wc), abs(cv - ii * P - wc)), v = cl(dw + 0.5, 0, 1);
            if (v > hv) hv = v;
            const rv = v * cl(1.5 - dw, 0, 1);
            if (rv > rg) (rg = rv), (rf = RF[ii * n + jj]);
          }
        }
        // The letters dim under the dark of the card, and the dark of the card tints the LED.
        const under = ec * (1 - hv);
        r *= 1 - 0.72 * under;
        g *= 1 - 0.72 * under;
        b *= 1 - 0.72 * under;
        r += body[0] * under;
        g += body[1] * under;
        b += body[2] * under;
        // A label printed on the card, a digit or a letter for each of the orbits, read from the card's own cells.
        const na = NA[ci * n + cj];
        if (na > 0 && hv < 0.6) {
          const lb = G.lab[ci * n + cj] + 1, ch = lb < 10 ? String(lb) : String.fromCharCode(55 + lb), nx = floor(fu - gO), ny = floor(fv - gV);
          if (nx >= 0 && nx < 3 && ny >= 0 && ny < 5 && GLYPH[ch][ny * 3 + nx]) {
            const w = min(1, na) * ec, fl = na > 1 ? na - 1 : 0;
            r += (mix(num[0], 1, fl) - r) * w;
            g += (mix(num[1], 1, fl) - g) * w;
            b += (mix(num[2], 1, fl) - b) * w;
          }
        }
        // The rim of each window and the edge of the card.
        const eg = cl(1.4 - dm, 0, 1) * ec * 0.85;
        r += (edge[0] - r) * eg;
        g += (edge[1] - g) * eg;
        b += (edge[2] - b) * eg;
        const rw = rg * cardA * (0.8 + 0.2 * rf);
        r += (mix(rim[0], 1, rf) - r) * rw;
        g += (mix(rim[1], 1, rf) - g) * rw;
        b += (mix(rim[2], 1, rf) - b) * rw;
      }
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = b;
    }

  // The cursor under the next plain letter to leave, and under the next to come back.
  const inE = T >= G.tE0 - 0.4 && T < tE1, inD = T >= tD0 && T < tD1;
  if (inE || inD) {
    const k = inE ? curE : curD;
    if (k < N) for (let u = 0; u < 3; u++) put(rgb, O + (k % n) * P + gO + u, 64 + O + floor(k / n) * P + gV + 6, edge, 0.9);
  }

  // Letters on the wing, over everything, each with a short tail.
  for (const [L, c, x0, y0, x1, y1, f, i] of flying) {
    const e = sm(f), dxv = x1 - x0, dyv = y1 - y0, len = Math.hypot(dxv, dyv) || 1, sgn = i & 1 ? 1 : -1;
    for (let t = 0; t < 3; t++) {
      const ff = max(0, e - t * 0.05), lat = sgn * 5 * sin(PI * ff);
      const X = x0 + dxv * ff - (dyv / len) * lat, Y = y0 + dyv * ff + (dxv / len) * lat;
      for (let k = 0; k < 3; k++) tmp[k] = mix(c[k], 1, 0.55 - 0.15 * t);
      glyph(rgb, L.ch, Math.round(X), Math.round(Y), tmp, t === 0 ? 1 : t === 1 ? 0.5 : 0.22);
    }
  }

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, (255 * cl(rgb[o] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 1] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 2] * fade, 0, 1)) | 0);
}
