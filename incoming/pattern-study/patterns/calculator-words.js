// ===== Patternflow pattern =====
// Title:   Calculator Words
// Family:  type
// Idea:    A pocket calculator fills the panel and keys in a little sum, its keys lighting as they go down, then turns itself upside down so the answer on its seven-segment display reads as a word, 0.7734 as hELLO with the decimal point hanging at the top of the line, holds it, and turns back for the next riddle.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: upside-down calculator spelling on seven-segment displays (BEGHILOS, the 1970s pocket calculator pastime), pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Words=0..3, Glow=0..1
//
// Knob 1: Hue. The colour of the display, with the operator keys and the body following it round the wheel: at 0 a blue-green vacuum fluorescent display over orange operator keys on a slate body; at 0.54 the red of the first LED calculators.
// Knob 2: Speed. How fast the machine works: at 2 a key goes down every 0.22 s and the turn takes 1.3 s, so hELLO is keyed, turned, read and turned back in 7.7 s; at 0.2 it takes ten times as long, at 3 two thirds.
// Knob 3: Words. Which riddles: 0 the classics (hELLO, BOSS, LOSE, GLOBE, GOOSE, EGGSHELL); 1 short words (hI, BEE, OIL, BIG, EGG, ShOE, SOIL); 2 long ones made by multiplying two numbers (LEGIBLE, SLEIGh, BOGGLE, OBLIGE, GIGGLE, SIZZLE, hOBBIES); 3 answers under 1, whose decimal point turns up at the top of the word (IGLOO, hELLO, SILO, SOLO, hOBO, BOO).
// Knob 4: Glow. How much light the display spills: at 0 the unlit segments are almost gone and the digits stand sharp on dark glass; at the opening 0.06 the unlit segments show faintly as a ghost 8 in every place; at 1 the ghosts glow at half strength, a haze spreads round every lit digit, and the display's light falls over the body and the top rows of keys.
// Buttons: any knob's button clears the calculator and starts the next riddle, when the calculator stands the right way up.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The riddles. Each is the sum the machine keys after C, written with *
// and / for the keys x and the division sign; = follows. Read upside down,
// a digit becomes the letter its segments make when turned: 0 O, 1 I, 2 Z,
// 3 E, 4 h, 5 S, 7 L, 8 B, 9 G (a 9 with its tail turns into a 6 shape).
// The order of the digits turns round as well, so 0.7734 reads hELLO.
// Every answer was checked by turning the segment masks below, not by a
// table of letters: the display is only ever drawn the right way up.
const SETS = [
  // 0.7734 hELLO, 5508 BOSS, 3507 LOSE, 38079 GLOBE, 35009 GOOSE, and SHELL
  // (77345) times 1000 plus 993, 77345993 EGGSHELL, the longest the 8 places
  // hold.
  ["1-.2266", "68*81", "21*167", "9*4231", "13*2693", "155*499*1000+993"],
  // 14 hI, 338 BEE, 710 OIL, 918 BIG, 993 EGG, 3045 ShOE, 7105 SOIL.
  ["2*7", "13*26", "10*71", "27*34", "3*331", "35*87", "29*245"],
  // 3781937 LEGIBLE, 491375 SLEIGh, 379908 BOGGLE, 391780 OBLIGE, 379919
  // GIGGLE, 372215 SIZZLE, 5318804 hOBBIES.
  ["967*3911", "125*3931", "519*732", "380*1031", "181*2099", "493*755", "4*1329701"],
  // 0.0791 IGLOO, 0.7734 hELLO, 0.715 SILO, 0.705 SOLO, 0.804 hOBO, 0.08 BOO.
  [".113*.7", "3.867/5", "1.43/2", "1.41/2", "4.02/5", ".2*.4"],
];

// ---- Seven segments, bit 0 to 6 for a to g: a the top bar, b and c the
// right side from the top, d the bottom bar, e and f the left side from the
// bottom, g the middle bar. A 6 keeps its top bar and a 9 its tail, a 7 has
// no f: so a turned 7 is an L and not a 4 with a hook.
const SEG = { 0: 63, 1: 6, 2: 91, 3: 79, 4: 102, 5: 109, 6: 125, 7: 7, 8: 127, 9: 111, "-": 64 };
// A digit is 5 LEDs wide and 11 tall, 1 LED strokes, with the corners left
// dark so every segment stands apart; the decimal point sits one column to
// the right of the bottom bar.
const SEGPX = [[], [], [], [], [], [], []];
for (let i = 1; i <= 3; i++) SEGPX[0].push([i, 0]), SEGPX[3].push([i, 10]), SEGPX[6].push([i, 5]);
for (let j = 1; j <= 4; j++) SEGPX[1].push([4, j]), SEGPX[5].push([0, j]), SEGPX[2].push([4, j + 5]), SEGPX[4].push([0, j + 5]);
const DIG_X = 5, DIG_P = 7, DIG_Y = 11;

// ---- The keypad: 4 columns of 13 LEDs, 5 rows of 15, labels in 3 by 5.
const GLYPH = {
  0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001",
  5: "111100111001111", 6: "111100111101111", 7: "111001001001001", 8: "111101111101111", 9: "111101111001111",
  C: "011100100100011", p: "010111010000111", "%": "101001010100101", d: "010000111000010", x: "000101010101000",
  "-": "000000111000000", "+": "000010111010000", "=": "000111000111000", ".": "000000000000010",
};
const LAYOUT = [
  ["C", "p", "%", "d"],
  ["7", "8", "9", "x"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", null, ".", "="],
];
const KEYS = [];
LAYOUT.forEach((row, r) =>
  row.forEach((id, c) => {
    if (!id) return;
    const wide = id === "0";
    KEYS.push({ id, x: 3 + 15 * c, y: 32 + 19 * r, w: wide ? 28 : 13, kind: r === 0 ? 0 : c === 3 || id === "=" ? 2 : 1 });
  }),
);
const KEYIX = {};
KEYS.forEach((k, i) => (KEYIX[k.id] = i));

// Machine time is seconds at Speed 2.
const KEY = 0.22, HOLD = 0.8, TURN = 1.3, BACK = 1.1, PAUSE = 0.35;

// ---- The arithmetic of a plain pocket calculator: an operator key works
// out what is pending, left to right, and shows it.
function fmt(v) {
  if (!isFinite(v) || abs(v) >= 1e8) return "E";
  const neg = v < 0;
  v = abs(v);
  const ints = v < 1 ? 1 : floor(Math.log10(v)) + 1;
  let s = v.toFixed(max(0, 8 - ints));
  if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return (neg ? "-" : "") + s;
}
function apply(a, op, b) {
  return op === "+" ? a + b : op === "-" ? a - b : op === "x" ? a * b : b === 0 ? NaN : a / b;
}
function press(S, id) {
  const c = S.calc;
  if (id === "C") (c.acc = 0), (c.op = null), (c.entry = null), (c.disp = "0");
  else if ((id >= "0" && id <= "9") || id === ".") {
    if (c.entry === null) c.entry = id === "." ? "0." : id;
    else if (c.entry.replace(/\D/g, "").length < 8 && !(id === "." && c.entry.includes("."))) c.entry += id;
    c.disp = c.entry;
  } else if (id === "=" || id === "+" || id === "-" || id === "x" || id === "d") {
    if (c.entry !== null) {
      c.acc = c.op ? apply(c.acc, c.op, Number(c.entry)) : Number(c.entry);
      c.entry = null;
      c.disp = fmt(c.acc);
    }
    c.op = id === "=" ? null : id;
  }
  if (KEYIX[id] !== undefined) S.pressed[KEYIX[id]] = S.clock;
}

// The display string, right aligned in 8 places, as segment masks with bit
// 7 for the decimal point.
function cells(disp) {
  const out = new Uint8Array(8);
  if (disp === "E") return (out[7] = 121), out;
  let i = 7;
  for (let j = disp.length - 1; j >= 0 && i >= 0; j--) {
    const ch = disp[j];
    if (ch === ".") {
      j--;
      out[i--] = SEG[disp[j]] | 128;
    } else out[i--] = SEG[ch];
  }
  return out;
}

function startRiddle(S) {
  const list = SETS[S.set];
  const expr = list[S.ri % list.length];
  S.keys = ["C", ...expr.split("").map((ch) => (ch === "*" ? "x" : ch === "/" ? "d" : ch)), "="];
  S.ki = 0;
  S.mt = 0;
  S.tEq = (S.keys.length - 1) * KEY;
  S.read = 0;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, glow: 0.06, set: -1, ri: 0, keys: [], ki: 0, mt: 0, tEq: 0, read: 0, clock: 0,
    theta: 0, calc: { acc: 0, op: null, entry: null, disp: "0" },
    pressed: new Float32Array(KEYS.length).fill(-99),
    face: new Float32Array(W * H * 3), halo: new Float32Array(W * 32), tmp: new Float32Array(W * 32),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.glow = cl(k[3], 0, 1);
  const set = min(3, floor(cl(k[2], 0, 3)));
  if (S.set < 0) (S.set = set), startRiddle(S);
  const step = (d * S.speed) / 2;
  S.mt += step;
  S.clock += step;
  // Keys go down on the beat; a long frame may hold more than one.
  while (S.ki < S.keys.length && S.mt >= S.ki * KEY) press(S, S.keys[S.ki++]);
  if (S.ki === S.keys.length && !S.read) S.read = 1.6 + 0.15 * S.calc.disp.replace(/\D/g, "").length;
  const t0 = S.tEq + HOLD, t1 = t0 + TURN, t2 = t1 + (S.read || 9), t3 = t2 + BACK;
  // Over, then back the way it came.
  S.theta = S.mt < t1 ? PI * ease((S.mt - t0) / TURN) : PI * (1 - ease((S.mt - t2) / BACK));
  let next = S.mt >= t3 + PAUSE;
  if (input.btnPressed && input.btnPressed.some(Boolean) && S.theta === 0) next = true;
  if (next) {
    if (set !== S.set) (S.set = set), (S.ri = 0);
    else S.ri++;
    startRiddle(S);
  }
}

// ---- Drawing the face, always the right way up, into a buffer of its own.
function put(F, x, y, c, m) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  (F[o] = c[0] * m), (F[o + 1] = c[1] * m), (F[o + 2] = c[2] * m);
}
function add(F, x, y, c, m) {
  const o = (y * W + x) * 3;
  (F[o] += c[0] * m), (F[o + 1] += c[1] * m), (F[o + 2] += c[2] * m);
}

function drawFace(S) {
  const F = S.face, hd = 0.46 + S.hue, g = S.glow;
  const body = hsv(hd + 0.15, 0.32, 0.15), bezel = hsv(hd + 0.15, 0.3, 0.06), glass = hsv(hd, 0.7, 0.035 + 0.1 * g);
  const lit = hsv(hd, 0.55, 1), ghost = hsv(hd, 0.65, 0.07 + 0.45 * g), haze = hsv(hd, 0.8, 1);
  F.fill(0);
  // Body: a rounded slab 62 by 126 with a lit top edge and a dark bottom.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      const qx = max(5 - cx, 0, cx - 59), qy = max(5 - cy, 0, cy - 123), a = cl(4.5 - sqrt(qx * qx + qy * qy), 0, 1);
      if (a <= 0) continue;
      const sh = y <= 1 ? 1.5 : y >= 126 ? 0.55 : x <= 1 ? 1.2 : x >= 62 ? 0.75 : 1;
      put(F, x, y, body, a * sh);
    }
  for (let y = 5; y <= 27; y++) for (let x = 2; x <= 61; x++) put(F, x, y, y === 27 ? body : bezel, y === 27 ? 1.35 : 1);
  for (let y = 6; y <= 26; y++) for (let x = 3; x <= 60; x++) put(F, x, y, glass, 1);

  // Display. The haze is the lit segments blurred twice by a 5-wide box.
  const cs = cells(S.calc.disp), Hz = S.halo, T = S.tmp;
  Hz.fill(0);
  for (let i = 0; i < 8; i++) {
    const x0 = DIG_X + DIG_P * i;
    for (let s = 0; s < 7; s++) {
      const on = (cs[i] >> s) & 1;
      for (const [dx, dy] of SEGPX[s]) {
        put(F, x0 + dx, DIG_Y + dy, on ? lit : ghost, 1);
        if (on) Hz[(DIG_Y + dy - 4) * W + x0 + dx] = 1;
      }
    }
    const dp = (cs[i] >> 7) & 1;
    put(F, x0 + 5, DIG_Y + 10, dp ? lit : ghost, 1);
    if (dp) Hz[(DIG_Y + 6) * W + x0 + 5] = 1;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let j = -2; j <= 2; j++) a += Hz[y * W + cl(x + j, 0, W - 1)];
        T[y * W + x] = a / 5;
      }
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < W; x++) {
        let a = 0;
        for (let j = -2; j <= 2; j++) a += T[cl(y + j, 0, 31) * W + x];
        Hz[y * W + x] = a / 5;
      }
  }
  const hz = 0.25 + 1.6 * g;
  for (let y = 6; y <= 26; y++) for (let x = 3; x <= 60; x++) add(F, x, y, haze, hz * Hz[(y - 4) * W + x]);

  // Keys: function keys pale, number keys dark, operator keys in colour.
  // A key that goes down drops one row, loses its shadow and lights up,
  // fading over a quarter of a second of machine time.
  const face = [hsv(hd + 0.15, 0.1, 0.42), hsv(hd + 0.15, 0.2, 0.22), hsv(hd + 0.62, 0.8, 0.62)];
  const glowc = [hsv(hd + 0.15, 0.05, 0.85), hsv(hd, 0.45, 0.7), hsv(hd + 0.62, 0.55, 1)];
  const ink = [hsv(hd + 0.15, 0.3, 0.07), hsv(hd + 0.15, 0.05, 0.8), hsv(hd + 0.62, 0.15, 1)];
  const white = [1, 1, 1];
  for (let i = 0; i < KEYS.length; i++) {
    const K = KEYS[i], P = max(0, Math.exp(-(S.clock - S.pressed[i]) / 0.25)), dy = P > 0.35 ? 1 : 0, kd = K.kind;
    const col = [0, 1, 2].map((j) => face[kd][j] + (glowc[kd][j] - face[kd][j]) * P);
    if (!dy) for (let x = K.x + 1; x < K.x + K.w - 1; x++) put(F, x, K.y + 15, body, 0.45);
    for (let r = 0; r < 15; r++)
      for (let q = 0; q < K.w; q++) {
        if ((r === 0 || r === 14) && (q === 0 || q === K.w - 1)) continue;
        put(F, K.x + q, K.y + dy + r, col, r === 0 ? 1.3 : r === 14 ? 0.62 : q === K.w - 1 ? 0.85 : 1);
      }
    const gl = GLYPH[K.id], gx = K.x + (K.w >> 1) - 1, gy = K.y + dy + 5;
    const ic = [0, 1, 2].map((j) => ink[kd][j] + (white[j] - ink[kd][j]) * P * (kd === 0 ? 0.3 : 1));
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r * 3 + q] === "1") put(F, gx + q, gy + r, ic, 1);
  }
  // The display's light falls on the body and the top rows of keys below
  // it, as a vacuum fluorescent display does in a dark room.
  const sp = 0.3 * g * g + 0.1 * g;
  if (sp > 0)
    for (let y = 28; y < 100; y++) {
      const m = sp * Math.exp(-(y - 28) / 16);
      for (let x = 1; x < 63; x++) add(F, x, y, haze, m * (0.6 + 0.4 * sin((PI * (x - 1)) / 61)));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  drawFace(S);
  const F = S.face, th = S.theta, c = cos(th), s = sin(th);
  const out = (x, y, r, g, b) => display.setPixel(x, y, (255 * min(1, r)) | 0, (255 * min(1, g)) | 0, (255 * min(1, b)) | 0);
  if (s < 1e-6) {
    // At rest, either way up, the face lands on the LEDs one for one: a half
    // turn about the panel's centre sends LED (x, y) to (63 - x, 127 - y).
    const up = c > 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = ((up ? y : H - 1 - y) * W + (up ? x : W - 1 - x)) * 3;
        out(x, y, F[o], F[o + 1], F[o + 2]);
      }
    return;
  }
  // Turning: the face shrinks just enough that its corners stay on the
  // panel, and holds at 0.45 while it lies more than 63 degrees over, so it
  // does not swell at 90 degrees; every LED takes four bilinear samples.
  const f = s > 2 * abs(c) ? 143.11 : 64 * abs(c) + 128 * s, sc = 64 / f;
  const ic = c / sc, is = s / sc;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 4; k++) {
        const px = x + 0.25 + 0.5 * (k & 1) - 32, py = y + 0.25 + 0.5 * (k >> 1) - 64;
        const u = ic * px + is * py + 31.5, v = -is * px + ic * py + 63.5;
        const u0 = floor(u), v0 = floor(v), fu = u - u0, fv = v - v0;
        for (let j = 0; j < 4; j++) {
          const uu = u0 + (j & 1), vv = v0 + (j >> 1);
          if (uu < 0 || uu >= W || vv < 0 || vv >= H) continue;
          const wgt = ((j & 1) ? fu : 1 - fu) * ((j >> 1) ? fv : 1 - fv), o = (vv * W + uu) * 3;
          (r += F[o] * wgt), (g += F[o + 1] * wgt), (b += F[o + 2] * wgt);
        }
      }
      out(x, y, r / 4, g / 4, b / 4);
    }
}
