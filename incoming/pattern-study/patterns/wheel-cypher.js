// ===== Patternflow pattern =====
// Title:   Wheel Cypher
// Family:  type
// Idea:    A cylinder of 25 polished discs stands up the panel, each with its own scrambled alphabet painted round the rim; one disc at a time from the top turns until a 25-letter message reads down one line in amber, the line a set number of letters round then lights in violet as the ciphertext, a clerk's slip down each side carries the plaintext and the ciphertext, and the discs spin away for the next message.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: wheel cypher (Thomas Jefferson, about 1795), reinvented as Étienne Bazeries's cylinder (1891) and issued as the US Army M-94 of 25 aluminium discs (1922); the 25 alphabets are scrambled for this pattern from a fixed seed, not the M-94's, and the 3 by 4 capitals are drawn for it, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Message=0..5, Line=1..5
//
// Knob 1: Hue. Tints the metal and turns the two lit lines with it. At 0 the metal is steel blue, the plaintext amber and the ciphertext violet; at 0.25 the metal is mauve, the lines green and red orange; at 0.5 the metal is bronze, the lines azure and green; at 0.75 the metal is sage, the lines magenta and cyan. The paint on the letters stays white and the slips stay cream.
// Knob 2: Speed. At 2 a disc turns in 0.3 s, so the 25 are set in 7.5 s; after a 0.5 s pause the ciphertext is read off at 0.06 s a letter, the finished message holds 3 s and the discs spin away in 1.3 s, a message every 13.9 s. Every time goes as 2 / Speed.
// Knob 3: Message. 0 ANYOTHERLINEISACIPHERTEXT, 1 TURNEACHWHEELUNTILITREADS, 2 ATTACKATDAWNHOLDTHEBRIDGE, 3 MEETMEATTHEMILLATMIDNIGHT, 4 SENDMOREMENTOTHEEASTRIDGE, 5 NOWISTHETIMEFORALLGOODMEN, and after each the next. A fresh start opens for 3.3 s on the message before, set and enciphered. Turning it sets the new message at once from the top disc, from wherever the discs stand.
// Knob 4: Line. How many letters round from the plaintext the ciphertext lies, to the right, 1 to 5. The whole cylinder stands turned by half that, so the two lines face the front from either side: at the opening 1 they are the two lines next to the front, both one LED to a glyph column; at 5 they stand 2.5 letters either side, 35 degrees round, where the letters are foreshortened to 0.82. Turning it turns the whole cylinder there in about 0.3 s.

// Each disc carries the 26 capitals round its rim in its own order. Turn
// the discs, one by one, until the message reads along one line of the
// cylinder; every other line of 25 letters is then a ciphertext of it, and
// the sender copies one. The receiver, with the same discs in the same
// order on the spindle, sets that ciphertext along a line and looks round
// the cylinder for the one line that reads. Here the order of the discs is
// fixed and the line is the knob.
//
// The cylinder is drawn as it would look: a letter cell 6.04 LEDs wide at
// the front, and each LED column covering the stretch of rim between the
// angles its two edges see, so letters thin as the cosine towards the
// sides and blur into the rim's grain at its edges. Ink is averaged over
// that stretch exactly, from a running sum round each disc.

const W = 64, H = 128;
const { floor, round, min, max, abs, asin, sin, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// The cylinder: 25 discs of 5 rows, 4 of letters and a chamfer, from row 1;
// the axis through the middle of LED column 31, radius 25 LEDs, so a letter
// cell at the front is 6.04 LEDs wide and a glyph column 1.007.
const DISCS = 25, PITCH = 5, TOP = 1, R = 25, XC = 31.5, CELL = (2 * PI) / 26, SLOTS = 26 * 12;

// Capitals 3 wide and 4 tall, rows from the top.
const GLYPHS = {
  A: [".#.", "#.#", "###", "#.#"], B: ["##.", "###", "#.#", "###"], C: [".##", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "##."], E: ["###", "##.", "#..", "###"], F: ["###", "#..", "##.", "#.."],
  G: [".##", "#..", "#.#", ".##"], H: ["#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", "###"],
  J: ["..#", "..#", "#.#", ".#."], K: ["#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "###"],
  M: ["###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", ".#."],
  P: ["###", "#.#", "###", "#.."], Q: [".#.", "#.#", "#.#", ".##"], R: ["###", "#.#", "##.", "#.#"],
  S: [".##", "#..", "..#", "##."], T: ["###", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###"], X: ["#.#", ".#.", ".#.", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#."], Z: ["###", "..#", ".#.", "###"],
};
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Six messages of exactly 25 letters, one per disc.
const MESSAGES = [
  "ANYOTHERLINEISACIPHERTEXT", "TURNEACHWHEELUNTILITREADS", "ATTACKATDAWNHOLDTHEBRIDGE",
  "MEETMEATTHEMILLATMIDNIGHT", "SENDMOREMENTOTHEEASTRIDGE", "NOWISTHETIMEFORALLGOODMEN",
];

// The 25 alphabets, shuffled by a fixed generator so every run has the same
// cylinder. ALPHA[d][j] is the letter at place j round disc d, POS[d][c] the
// place of letter c.
const ALPHA = [], POS = [];
{
  let a = 1922;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let d = 0; d < DISCS; d++) {
    const p = ABC.split("");
    for (let i = 25; i > 0; i--) {
      const j = floor(rnd() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    ALPHA.push(p);
    const q = {};
    p.forEach((c, j) => (q[c] = j));
    POS.push(q);
  }
}

// Round each disc the ink of glyph row r in twelfths of a cell, summed so
// any stretch of the rim can be averaged in two lookups. A cell runs from
// twelfth 0 to 12 with the letter centred, its three columns at 3..9.
const INK = [];
for (let d = 0; d < DISCS; d++)
  for (let r = 0; r < 4; r++) {
    const P = new Float32Array(SLOTS + 1);
    for (let s = 0; s < SLOTS; s++) {
      const j = floor(s / 12), k = s % 12, g = GLYPHS[ALPHA[d][j]][r];
      P[s + 1] = P[s] + (k >= 3 && k < 9 && g[floor((k - 3) / 2)] === "#" ? 1 : 0);
    }
    INK.push(P);
  }
const inkAt = (P, s) => {
  const turns = floor(s / SLOTS), u = s - turns * SLOTS, i = floor(u);
  return turns * P[SLOTS] + P[i] + (P[i + 1] - P[i]) * (u - i);
};

// Small integer hash for the grain of metal, paint and paper.
function hash(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
// Grain in three steps, -0.5, 0 or 0.5: as rough to the eye as smooth
// noise, and far fewer distinct values on the panel.
const grain = (a, b) => floor(hash(a, b) * 3) / 2 - 0.5;

// The rim is polished, so at angle th from the front it shows the room at
// 2 th: a lamp-lit wall drawn as two waves in that angle, 3.1 and 9.7 to a
// radian, under a little diffuse light from the lamp up on the left. Each
// disc sits a hair off true and its reflection jogs by up to 0.15 radian
// against its neighbours. The rim's four rows of letters fall from a bright
// top bevel to a dark bottom one, LATHE varies each row's turning a little,
// and the fifth row is the chamfer between two discs.
const ENV = [0.38, 0.22, 3.1, 0.4, 0.16, 9.7, 1.3], DIFF = 0.12, JOG = 0.15, LATHE = 0.1;
const BEVEL = [1.15, 1, 0.86, 0.72, 0.4], CHAMFER = 0.5, CAP = [0.6, 0.55, 0.35];
// The letters are stamped and filled with white paint, which is matte: it
// takes the lamp, not the reflections. PGRAIN is its unevenness.
const MATTE = 0.85, PGRAIN = 0.17;
// The slips: paper level, its fibre, the rules, the shadow of the cylinder
// on the column beside it, and pencil lead.
const PAPER = 0.7, FIBRE = 0.22, RULE = 0.2, SHADOW = 0.35, LEAD = 0.09;

// Each LED column's stretch of the rim in cells from the front, its centre,
// how much of it the cylinder covers, the paint's light there, and per disc
// the light on the metal.
const COL = [], LIGHT = new Float32Array(DISCS * W);
for (let x = 0; x < W; x++) {
  const s0 = (x - XC) / R, s1 = (x + 1 - XC) / R, sc = (x + 0.5 - XC) / R;
  const cover = cl(min(x + 1, XC + R) - max(x, XC - R), 0, 1);
  if (cover <= 0) {
    COL.push(null);
    continue;
  }
  const th = asin(cl(sc, -1, 1));
  COL.push({ a0: asin(cl(s0, -1, 1)) / CELL, a1: asin(cl(s1, -1, 1)) / CELL, ac: th / CELL, cover, matte: MATTE + (1 - MATTE) * cos(th - 0.35) });
  for (let d = 0; d < DISCS; d++) {
    const f = 2 * th + JOG * (hash(d, 77) - 0.5) * 2;
    const env = ENV[0] + ENV[1] * sin(ENV[2] * f + ENV[3]) + ENV[4] * sin(ENV[5] * f + ENV[6]);
    LIGHT[d * W + x] = (1 - DIFF) * env + DIFF * cos(th - 0.35);
  }
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Seconds at Speed 2: a disc's turn, the pause before the ciphertext, one
// cipher letter, the hold on a finished message, the spin away.
const TURN = 0.3, PAUSE = 0.5, CIPH = 0.06, HOLD = 3, SPIN = 1.3, OPEN = 3.3;

const wrap = (v) => ((v % 26) + 26) % 26;
const shortest = (from, to) => {
  let d = wrap(to - from);
  if (d > 13) d -= 26;
  return d;
};

function setMessage(S, m) {
  S.m = ((m % MESSAGES.length) + MESSAGES.length) % MESSAGES.length;
  S.msg = MESSAGES[S.m];
  S.target = [];
  for (let d = 0; d < DISCS; d++) S.target.push(POS[d][S.msg[d]]);
}

function beginSet(S) {
  S.phase = "set";
  S.i = 0;
  S.tau = 0;
  S.set = 0;
  S.ciph = 0;
  S.from = S.phi[0];
}

export function setup(params) {
  const S = { phi: new Float32Array(DISCS), blur: new Float32Array(DISCS), spin0: new Float32Array(DISCS), spinD: new Float32Array(DISCS) };
  S.knob = -1;
  S.line = 1;
  S.turn = -1;
  S.dturn = 0;
  S.hue = 0;
  S.speed = 2;
  S.buf = new Float32Array(W * H * 3);
  params.s = S;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.line = round(cl(k[3] == null ? 1 : k[3], 1, 5));
  // The whole cylinder sits turned by half the line, so the plaintext and
  // the ciphertext stand either side of the front; a new line turns it there.
  const turn0 = S.turn;
  S.turn = S.turn < 0 ? S.line / 2 : S.turn + (S.line / 2 - S.turn) * min(1, (d * S.speed) / 2 / 0.12);
  S.dturn = abs(S.turn - turn0) * (turn0 < 0 ? 0 : 1);
  const km = round(cl(k[2] || 0, 0, 5));
  if (km !== S.knob) {
    if (S.knob < 0) {
      // A fresh start opens on the message before, set and enciphered.
      setMessage(S, km - 1);
      for (let i = 0; i < DISCS; i++) S.phi[i] = S.target[i];
      S.phase = "hold";
      S.tau = HOLD - OPEN;
      S.set = DISCS;
      S.ciph = DISCS;
      S.next = km;
    } else {
      setMessage(S, km);
      S.next = null;
      beginSet(S);
    }
    S.knob = km;
  }
  const old = Float32Array.from(S.phi);
  S.tau += (d * S.speed) / 2;
  if (S.phase === "set") {
    const delta = shortest(S.from, S.target[S.i]);
    S.phi[S.i] = S.from + delta * smooth(S.tau / TURN);
    if (S.tau >= TURN) {
      S.phi[S.i] = S.target[S.i];
      S.set = ++S.i;
      S.tau = 0;
      if (S.i >= DISCS) S.phase = "pause";
      else S.from = S.phi[S.i];
    }
  } else if (S.phase === "pause") {
    if (S.tau >= PAUSE) {
      S.phase = "cipher";
      S.tau = 0;
    }
  } else if (S.phase === "cipher") {
    S.ciph = min(DISCS, floor(S.tau / CIPH) + 1);
    if (S.tau >= CIPH * DISCS) {
      S.phase = "hold";
      S.tau = 0;
    }
  } else if (S.phase === "hold") {
    if (S.tau >= HOLD) {
      S.phase = "spin";
      S.tau = 0;
      // The slip keeps this ciphertext in lead until the next is inked over it.
      S.old = "";
      for (let i = 0; i < DISCS; i++) S.old += ALPHA[i][wrap(S.target[i] + S.line)];
      S.set = 0;
      S.ciph = 0;
      for (let i = 0; i < DISCS; i++) {
        S.spin0[i] = S.phi[i];
        // Each disc flicked by hand: 4 to 11 letters either way.
        S.spinD[i] = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 7);
      }
    }
  } else if (S.phase === "spin") {
    for (let i = 0; i < DISCS; i++) {
      const u = cl((S.tau / SPIN) * 1.25 - (i / DISCS) * 0.25, 0, 1);
      S.phi[i] = S.spin0[i] + S.spinD[i] * (1 - pow(1 - u, 3));
    }
    if (S.tau >= SPIN) {
      setMessage(S, S.next == null ? S.m + 1 : S.next);
      S.next = null;
      beginSet(S);
    }
  }
  for (let i = 0; i < DISCS; i++) S.blur[i] = abs(S.phi[i] - old[i]) + S.dturn;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  const h = S.hue + 0.58;
  const metal = hsv(h, 0.16, 1), paint = hsv(h + 0.5, 0.06, 1), amber = hsv(h + 0.5, 0.75, 1), violet = hsv(h + 0.22, 0.6, 1);
  const line = S.line;

  for (let d = 0; d < DISCS; d++) {
    const y0 = TOP + d * PITCH, phi = S.phi[d] + S.turn, blur = S.blur[d] * 12;
    const plain = d < S.set, ciph = d < S.ciph;
    const jp = S.target[d], jc = wrap(jp + line), lathe = [];
    for (let r = 0; r < PITCH; r++) lathe.push(1 + LATHE * (hash(d * 8 + r, 999) - 0.5));
    for (let x = 0; x < W; x++) {
      const C = COL[x];
      if (!C) continue;
      const sL = (C.a0 + phi + 0.5) * 12, sR = (C.a1 + phi + 0.5) * 12 + blur, span = max(1e-6, sR - sL);
      const uc = C.ac + phi, j = wrap(round(uc)), slot = floor(wrap(uc + 0.5) * 12);
      const litP = plain && j === jp, litC = ciph && j === jc;
      for (let r = 0; r < PITCH; r++) {
        const p = ((y0 + r) * W + x) * 3;
        let b = LIGHT[d * W + x] * BEVEL[r] * lathe[r];
        if (r === 4) b *= 1 + CHAMFER * grain(d * 8 + 4, slot);
        let cr = metal[0] * b, cg = metal[1] * b, cb = metal[2] * b;
        if (r < 4) {
          const P = INK[d * 4 + r], ink = (inkAt(P, sR) - inkAt(P, sL)) / span;
          if (litP || litC) {
            // A lit line: its cells washed in the colour, its letters in it.
            const g = litP ? amber : violet, wash = 0.35;
            cr += (g[0] * wash * b - cr * wash) + (g[0] - cr) * ink;
            cg += (g[1] * wash * b - cg * wash) + (g[1] - cg) * ink;
            cb += (g[2] * wash * b - cb * wash) + (g[2] - cb) * ink;
          } else if (ink > 0) {
            const v = C.matte * (1 + PGRAIN * grain(d * 8 + r + 9000, slot));
            cr += (paint[0] * v - cr) * ink;
            cg += (paint[1] * v - cg) * ink;
            cb += (paint[2] * v - cb) * ink;
          }
        }
        buf[p] = cr * C.cover;
        buf[p + 1] = cg * C.cover;
        buf[p + 2] = cb * C.cover;
      }
    }
  }

  // The end plates: one row on top, the bottom plate and its foot below.
  for (const [y, k] of [[0, CAP[0]], [H - 2, CAP[1]], [H - 1, CAP[2]]])
    for (let x = 0; x < W; x++) {
      const C = COL[x];
      if (!C) continue;
      const b = LIGHT[x] * k * (1 + CHAMFER * grain(y + 31, x)) * C.cover, p = (y * W + x) * 3;
      buf[p] = metal[0] * b;
      buf[p + 1] = metal[1] * b;
      buf[p + 2] = metal[2] * b;
    }

  // The clerk's slips: the plaintext written down the left one from the
  // start, each letter inked amber once its disc is set, and the ciphertext
  // written down the right one in violet as it is read off.
  const paper = hsv(0.11, 0.14, PAPER), lead = [LEAD, LEAD, LEAD * 1.1];
  for (const [x0, x1] of [[0, 5], [57, 63]])
    for (let y = 0; y < H; y++)
      for (let x = x0; x <= x1; x++) {
        const p = (y * W + x) * 3, rule = (y - TOP) % PITCH === 4 ? 1 - RULE : 1;
        // The column against the cylinder lies in its shadow.
        const f = (x === 5 || x === 57 ? SHADOW : 1) * rule * (1 + FIBRE * grain(x * 131 + 7, y));
        buf[p] = paper[0] * f;
        buf[p + 1] = paper[1] * f;
        buf[p + 2] = paper[2] * f;
      }
  // Ink takes the grain of the paper it lies on.
  const glyph = (ch, x0, y0, c) => {
    const g = GLYPHS[ch];
    for (let r = 0; r < 4; r++)
      for (let i = 0; i < 3; i++)
        if (g[r][i] === "#") {
          const x = x0 + i, y = y0 + r, p = (y * W + x) * 3, f = 1 + FIBRE * grain(x * 131 + 7, y);
          buf[p] = c[0] * f;
          buf[p + 1] = c[1] * f;
          buf[p + 2] = c[2] * f;
        }
  };
  for (let d = 0; d < DISCS; d++) {
    const y0 = TOP + d * PITCH;
    glyph(S.msg[d], 1, y0, d < S.set ? amber : lead);
    if (d < S.ciph) glyph(ALPHA[d][wrap(S.target[d] + line)], 59, y0, violet);
    else if (S.old) glyph(S.old[d], 59, y0, lead);
  }

  for (let i = 0; i < W * H; i++)
    display.setPixel(i % W, floor(i / W), round(cl(buf[i * 3], 0, 1) * 255), round(cl(buf[i * 3 + 1], 0, 1) * 255), round(cl(buf[i * 3 + 2], 0, 1) * 255));
}
