// ===== Patternflow pattern =====
// Title:   Ogham
// Family:  type
// Idea:    A standing stone is seen corner-on with its edge running up the whole panel as the stemline, and an Ogham inscription is cut into it stroke by stroke from the bottom up, one to five strokes a letter, the B aicme on the right face, the H aicme on the left, the M aicme slanting across the edge from one face onto the other and the vowels notched on the edge itself, while a small Latin letter beside each group counts its strokes as they land (B, L, F, S, then N for five on the right) and the view climbs the stone with the chisel.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Ogham alphabet of four aicmí of five letters as the Ogam tract of the Book of Ballymote sets it out (George Calder, Auraicept na n-Éces, 1917), its Old Irish letter names and the MAQI and MUCOI of the Primitive Irish memorial stones (Damian McManus, A Guide to Ogam, 1991); Typewriter's 3 by 5 capitals (pattern round 18); pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Text=0..3, Turn=-1..1
//
// Knob 1: Hue. Turns the light round the wheel: at 0 the cuts are pale gold on blue-grey slate, at 0.5 pale blue on a brown sandstone, the gloss letters a whiter tint of the cuts.
// Knob 2: Speed. Strokes cut a second: 5 at the opening 2, so the alphabet's 60 strokes and 20 letters take 16 seconds before the stone holds 3 seconds with its top in view and a fresh one is started; 0.8 at 0.2, 13.6 at 3.
// Knob 3: Text. Which inscription, each on its own stone: 0 the twenty letters in their four aicmí, 60 strokes over 302 rows of stone; 1 the four aicme names BEITHE HUATHA MUINE AILME, 59 strokes of which 40 are vowel notches; 2 the formula words ANM MAQI MUCOI, 34 strokes; 3 the Old Irish names of the first aicme, BEITHE LUIS FERN SAIL NIN, 76 strokes over 365 rows.
// Knob 4: Turn. Turns the stone about its upright axis, 13 degrees at the opening 0.06 so the left face shows wider, 40 degrees each way at the ends: at -1 the right face comes round to you and the left one shrinks to a sliver, at 1 the reverse, and the strokes on the turning face shorten while the slanting M strokes kink at the edge.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The alphabet. Four aicmí ("families") of five letters, each letter
// one to five strokes: the B aicme to the right of the stemline as it is
// read upward, the H aicme to the left, the M aicme slanting across it, the
// vowels notched on it. On a stone the stemline is the arris itself. The
// third letter is F as the manuscripts give fern; the oldest stones wrote V
// with it.
const AICME = [
  ["B", "L", "F", "S", "N"],
  ["H", "D", "T", "C", "Q"],
  ["M", "G", "NG", "Z", "R"],
  ["A", "O", "U", "E", "I"],
];
const WHERE = {};
AICME.forEach((a, g) => a.forEach((L, i) => (WHERE[L] = [g, i + 1])));
// The inscriptions, a word to a group of letters. The alphabet in aicme
// order; the aicmí named after their first letters; the words of the
// memorial stones, ANM ("name") that opens some and the MAQI ("son of") and
// MUCOI ("of the kin of") of X MAQI Y MUCOI Z, without any names; the Old
// Irish names of the first five letters.
const TEXTS = [
  ["BLFSN", "HDTCQ", "MGNGZR", "AOUEI"],
  ["BEITHE", "HUATHA", "MUINE", "AILME"],
  ["ANM", "MAQI", "MUCOI"],
  ["BEITHE", "LUIS", "FERN", "SAIL", "NIN"],
];
const parse = (w) => {
  const out = [];
  for (let i = 0; i < w.length; i++) {
    if (w[i] === "N" && w[i + 1] === "G") out.push("NG"), i++;
    else out.push(w[i]);
  }
  return out;
};

// Typewriter's 3 by 5 capitals (pattern round 18), the letters the gloss needs.
const FONT = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", Q: "010101101111011", R: "110101110101101",
  S: "011100010001110", T: "111010010010010", U: "101101101101011", Z: "111001010100111",
};

// ---- The stone: a square pillar seen corner-on, its axis at column CX, its
// half diagonal one of RS, a stone to each text; heights v in rows, the
// view climbing the stone with the chisel a whole row at a time so every
// cut lands on one row of LEDs.
const CX = 35.5, RS = [24, 22.5, 25.5, 23.5], CAM0 = -10, VOFF = 40;
const PITCH = 3, LGAP = 8, WGAP = 18, BASE = 9;
// How far each aicme's strokes reach along a face, in face units (one
// unit is one LED when the face is square to you), and the M slant.
const REACH = [12.5, 12.5, 8.5, 2.3], SLANT = 0.42, CUT = 0.62;

const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 1013904223) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

function newStone(S, ti) {
  const letters = [], cuts = [];
  let v = BASE - LGAP, t = 0.3;
  TEXTS[ti].forEach((word, wi) => {
    if (wi) (v += WGAP - LGAP), (t += 1.4);
    for (const L of parse(word)) {
      const [g, n] = WHERE[L];
      v += LGAP;
      if (letters.length) t += 0.9;
      const v0 = v, first = cuts.length;
      for (let i = 0; i < n; i++) {
        if (i) v += PITCH;
        cuts.push({ g, v, t0: t, li: letters.length });
        t += 1;
      }
      letters.push({ L, g, n, mid: (v0 + v) / 2, first });
    }
  });
  S.letters = letters;
  S.cuts = cuts;
  S.end = t + 0.4;
  S.top = v + 20;
  S.r = RS[ti];
  S.side = S.r * Math.SQRT2;
  // Each face's grain: coarse blotches, a finer mottle and single-LED
  // speckle, and the jagged line of its top, highest at the edge.
  const U = ceil(S.side) + 2, V = S.top + VOFF + 30;
  S.U = U;
  S.V = V;
  S.tex = [0, 1].map((f) => {
    const T = new Float32Array(U * V);
    const val = (gx, gy, sc, k) => {
      const x = gx / sc, y = gy / sc, x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = hash(x0, y0, k), b = hash(x0 + 1, y0, k), c = hash(x0, y0 + 1, k), d = hash(x0 + 1, y0 + 1, k);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const seed = ti * 4 + f * 2 + 1;
    for (let y = 0; y < V; y++)
      for (let x = 0; x < U; x++)
        T[y * U + x] = 0.62 + 0.42 * val(x, y, 9, seed) + 0.26 * val(x, y, 3, seed + 40) + 0.2 * hash(x, y, seed + 80);
    return T;
  });
  S.tops = [0, 1].map((f) => {
    const T = new Float32Array(U);
    for (let u = 0; u < U; u++) T[u] = S.top - 12 * (u / S.side) ** 2 - 2.5 * hash(u >> 1, f, ti + 9);
    return T;
  });
  S.t = 0;
  S.cam = CAM0;
  S.phase = 0;
  S.parts = [];
  S.ci = 0;
}

export function setup(params) {
  const S = (params.s = { ti: -1, hue: 0, rate: 5, turn: 0, dim: 1, emit: 0 });
  S.Cov = new Float32Array(W * H);
  S.Fre = new Float32Array(W * H);
  S.Sh = new Float32Array(W * H);
  S.F = new Float32Array(W * H * 3);
  S.colF = new Int8Array(W);
  S.colU = new Float32Array(W);
}

// The cut in progress: the last one whose time has come.
function current(S) {
  const c = S.cuts;
  let i = S.ci || 0;
  if (i >= c.length || c[i].t0 > S.t) i = 0;
  while (i + 1 < c.length && c[i + 1].t0 <= S.t) i++;
  S.ci = i;
  return i;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.rate = 5 * exp(cl(k[1], 0.2, 3) - 2);
  S.turn = cl(k[3] || 0, -1, 1);
  const ti = round(cl(k[2] || 0, 0, 3));
  if (ti !== S.ti) {
    S.ti = ti;
    newStone(S, ti);
  }
  // Carve, hold the finished stone with its top in view, darken, and
  // start again on a fresh one.
  let target;
  if (S.phase === 0) {
    S.t += dt * S.rate;
    S.dim = min(1, S.dim + dt / 0.5);
    const c = S.cuts[current(S)];
    target = c.v + (c.g === 2 ? REACH[2] * SLANT : 0) - 80;
    if (S.t >= S.end) (S.phase = 1), (S.hold = 0);
  } else {
    target = S.top - 112;
    S.hold += dt;
    if (S.hold > 3) S.dim -= dt / 0.7;
    if (S.dim <= 0) {
      S.dim = 0;
      newStone(S, S.ti);
    }
  }
  S.cam += (max(CAM0, target) - S.cam) * (1 - exp(-dt * 2.5));
  // Stone dust off the chisel, in panel columns and stone rows.
  const P = S.parts;
  for (const p of P) {
    p.x += p.vx * dt;
    p.v += p.vv * dt;
    p.vv -= 60 * dt;
    p.life -= dt;
  }
  if (P.length && P[0].life <= 0) S.parts = P.filter((p) => p.life > 0);
  if (S.tip) {
    S.emit += dt * 30;
    while (S.emit >= 1) {
      S.emit -= 1;
      const sd = S.tip[2];
      S.parts.push({ x: S.tip[0], v: S.tip[1], vx: sd * (6 + 14 * Math.random()) + 6 * (Math.random() - 0.5), vv: 4 + 14 * Math.random(), life: 0.3 + 0.4 * Math.random() });
    }
  }
}

// One straight piece of a cut as a capsule of radius rad, into the cover
// buffer, its freshness alongside and its shadow a row above it.
function seg(S, a, b, rad, fresh) {
  const [ax, ay] = a, [bx, by] = b;
  const x0 = max(0, floor(min(ax, bx) - rad - 1)), x1 = min(W - 1, ceil(max(ax, bx) + rad + 1));
  const y0 = max(1, floor(min(ay, by) - rad - 1)), y1 = min(H - 1, ceil(max(ay, by) + rad + 1));
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const u = L2 ? cl((px * dx + py * dy) / L2, 0, 1) : 0;
      const ex = px - u * dx, ey = py - u * dy;
      const c = cl(rad + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (c <= 0) continue;
      const o = y * W + x;
      if (c > S.Cov[o]) S.Cov[o] = c;
      if (c * fresh > S.Fre[o]) S.Fre[o] = c * fresh;
      if (c > S.Sh[o - W]) S.Sh[o - W] = c;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cuts) return;
  const { Cov, Fre, Sh, F, colF, colU } = S;
  Cov.fill(0);
  Fre.fill(0);
  Sh.fill(0);
  F.fill(0);
  // The edge and the far corners across the panel, and how much of a face
  // unit each face shows: cos(45 degrees + turn) on the right, cos(45 - turn)
  // on the left.
  const th = 0.7 * S.turn + 0.18 * (1 - S.turn * S.turn), r = S.r, side = S.side, ve = round(S.cam) + 64;
  const sF = CX + r * sin(th), sR = CX + r * cos(th), sL = CX - r * cos(th);
  const cs = [cos(PI / 4 + th), -cos(PI / 4 - th)];
  const P = (f, u, v) => [sF + u * cs[f], 63.5 - (v - ve)];
  // Each panel column: its face and how far along it.
  for (let x = 0; x < W; x++) {
    const X = x + 0.5, f = X >= sF && X < sR ? 0 : X < sF && X >= sL ? 1 : -1;
    colF[x] = f;
    if (f >= 0) colU[x] = (X - sF) / cs[f];
  }
  const lit = (a) => 0.36 + 0.64 * max(0, (-0.55 * sin(a) + 0.8 * cos(a)) / 0.971);
  const shade = [lit(th + PI / 4), lit(th - PI / 4)];
  const hue = S.hue;
  const stone = hsv(hue + 0.58, 0.3, 84), cutC = hsv(hue + 0.13, 0.42, 245), gloss = hsv(hue + 0.13, 0.18, 230);
  const sky = hsv(hue + 0.62, 0.7, 1);
  const Ye = (v) => 63.5 - (v - ve);

  // ---- The cuts. Strokes start at the edge and run out along a face; an
  // M stroke runs from the left face across the edge onto the right one.
  const ci = S.phase === 0 ? current(S) : -1;
  S.tip = null;
  for (let i = 0; i < S.cuts.length; i++) {
    const c = S.cuts[i];
    if (c.t0 > S.t) break;
    const yc = Ye(c.v);
    if (yc < -12 || yc > H + 12) continue;
    const p = cl((S.t - c.t0) / CUT, 0, 1);
    const fresh = p < 1 ? 1 : exp(-(S.t - c.t0 - CUT) / S.rate / 0.9);
    const L = REACH[c.g], E = P(0, 0, c.v);
    let tip, sd = 1;
    if (c.g < 2) {
      tip = P(c.g, L * p, c.v);
      sd = c.g ? -1 : 1;
      seg(S, E, tip, 0.5, fresh);
    } else if (c.g === 2) {
      const a = P(1, L, c.v - L * SLANT), e = P(1, 0, c.v);
      if (p <= 0.5) {
        tip = P(1, L * (1 - 2 * p), c.v - L * SLANT * (1 - 2 * p));
        sd = -1;
        seg(S, a, tip, 0.5, fresh);
      } else {
        tip = P(0, L * (2 * p - 1), c.v + L * SLANT * (2 * p - 1));
        seg(S, a, e, 0.5, fresh);
        seg(S, E, tip, 0.5, fresh);
      }
    } else {
      tip = P(0, L * p, c.v);
      seg(S, P(1, L * p, c.v), tip, 0.5, fresh);
    }
    if (i === ci && p < 1) S.tip = [tip[0], ve + 63.5 - tip[1], sd];
  }

  // ---- Stone, sky and the cuts over them.
  const top0 = S.tops;
  for (let x = 0; x < W; x++) {
    const f = colF[x], u = colU[x], ui = f < 0 ? 0 : min(S.U - 1, max(0, floor(u)));
    // Lighter towards the edge, which stands nearest, and the edge itself
    // catching the light along its whole height.
    const e = abs(x + 0.5 - sF), edge = e < 1.3 ? 0.45 * (1.3 - e) : 0, near = f < 0 ? 0 : 1 - 0.3 * (u / side) ** 1.5;
    for (let y = 0; y < H; y++) {
      const o = y * W + x;
      const v = ve + 63 - y;
      let R, G, B;
      if (f < 0 || v > top0[f][ui]) {
        const s = 3 + 7 * (y / H);
        R = sky[0] * s;
        G = sky[1] * s;
        B = sky[2] * s;
      } else {
        const vi = cl(floor(v) + VOFF, 0, S.V - 1);
        let l = shade[f] * near * S.tex[f][vi * S.U + ui] + edge;
        l *= 1 - 0.55 * Sh[o] * (1 - Cov[o]);
        const c = Cov[o], fr = Fre[o], cc = (0.7 + 0.3 * shade[f]) * (1 - fr);
        R = stone[0] * l * (1 - c) + c * (cutC[0] * cc + 255 * fr);
        G = stone[1] * l * (1 - c) + c * (cutC[1] * cc + 255 * fr);
        B = stone[2] * l * (1 - c) + c * (cutC[2] * cc + 250 * fr);
      }
      F[o * 3] = R;
      F[o * 3 + 1] = G;
      F[o * 3 + 2] = B;
    }
  }
  const add = (x, y, c, a) => {
    x = floor(x);
    y = floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    F[o] += c[0] * a;
    F[o + 1] += c[1] * a;
    F[o + 2] += c[2] * a;
  };

  // ---- The chisel point and its dust.
  if (S.tip) {
    const tx = S.tip[0], ty = Ye(S.tip[1]), fl = 0.75 + 0.25 * Math.random();
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = sqrt((dx + 0.5 - (tx - floor(tx))) ** 2 + (dy + 0.5 - (ty - floor(ty))) ** 2);
        const a = cl(1 - d / 3, 0, 1);
        if (a > 0) add(tx + dx, ty + dy, [255, 245, 220], a * a * fl);
      }
  }
  for (const p of S.parts) add(p.x, Ye(p.v), gloss, 0.8 * min(1, p.life / 0.3));

  // ---- The gloss: beside each letter, the letter its strokes spell so
  // far, so a five-stroke N reads B, L, F, S and then N as it is cut.
  for (const Lt of S.letters) {
    const yc = Ye(Lt.mid);
    if (yc < -4 || yc > H + 4) continue;
    let done = 0, last = -1;
    for (let j = 0; j < Lt.n; j++) {
      const c = S.cuts[Lt.first + j];
      if (S.t >= c.t0 + CUT) (done = j + 1), (last = c.t0 + CUT);
    }
    if (!done) continue;
    const key = AICME[Lt.g][done - 1], age = (S.t - last) / S.rate;
    const a = done === Lt.n ? 0.75 + 0.25 * exp(-age / 0.6) : 1;
    const col = done === Lt.n ? gloss : [255, 250, 240];
    let x0 = 4 - ((key.length * 4 - 1) >> 1);
    const y0 = round(yc - 3);
    for (const ch of key) {
      const b = FONT[ch];
      for (let j = 0; j < 15; j++) if (b[j] === "1") add(x0 + (j % 3), y0 + floor(j / 3), col, a);
      x0 += 4;
    }
  }

  const g0 = S.dim;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, round(min(255, F[o] * g0)), round(min(255, F[o + 1] * g0)), round(min(255, F[o + 2] * g0)));
}
