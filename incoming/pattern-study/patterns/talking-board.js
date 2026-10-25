// ===== Patternflow pattern =====
// Title:   Talking Board
// Family:  halloween
// Idea:    A near-black spirit board lies on the table between two candles, its bone-white alphabet in two arcs, the numbers, YES and NO by a sun and a moon, GOODBYE at the foot, and the heart-shaped pointer glides over it on its own, circling, tilting as it swings, stopping with its round glass window over one letter at a time, which lights up green through the glass and joins a word spelled out above the board: HELLO, BOO, BEHIND YOU, YES, I SEE YOU, 1031, NO, RUN and at last GOODBYE.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Flicker=0..1, Aura=0..1
//
// Knob 1: Hue. The colour of whatever answers: the light in and round the pointer's window, the lit letter and the spelled word open a poison green at 0, turn cyan at 0.25, blue at 0.5, violet at 0.75 and pink at 1. The board's dark lacquer turns with it through the cold hues only, violet at 0, magenta at 0.25 and blue at 0.75, so it never goes brown; the bone letters and the candles stay as they are.
// Knob 2: Speed. At 2 the pointer glides about 55 LEDs a second and rests 0.65 seconds on each letter once it lights; HELLO takes 13 seconds from the first circling to the word fading, and all nine messages 111. At 0.2 everything runs ten times slower, at 3 half as fast again. The candles flicker at their own pace.
// Knob 3: Flicker. How the two candles burn: at 0 low and nearly still, the foot of the board in a steady pool of light; at 1 the flames stand 40 per cent taller, gutter and lean, a ragged dip can halve one, and their light reaches nearly twice as far up the board, swelling and sinking with them.
// Knob 4: Aura. The answer's own light round the pointer: at 0.06 a soft glow about 18 LEDs round the window that brightens when a letter lights; at 1 it spreads over 42 LEDs, twice as strong, and washes most of the board in its colour.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, sqrt, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ss = (t) => t * t * (3 - 2 * t);
const q = (v, n) => round(v * n) / n;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The board's letters, 3 by 5: five rows of three bits, as octal digits.
const F3 = {
  A: "25755", B: "65656", C: "34443", D: "65556", E: "74647", F: "74644", G: "34553", H: "55755", I: "72227",
  J: "11152", K: "55655", L: "44447", M: "57755", N: "65555", O: "25552", P: "65644", Q: "25563", R: "65655",
  S: "34216", T: "72222", U: "55557", V: "55552", W: "55775", X: "55255", Y: "55222", Z: "71247",
  0: "75557", 1: "26227", 2: "61247", 3: "61216", 4: "55711", 5: "74616", 6: "34757", 7: "71222", 8: "75757", 9: "75716",
};
// The spelled word's letters, 5 by 7: seven rows of five bits.
const F5 = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], 0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
};

// The board fills the panel below the spelled word, from row 20 down,
// with a thin edge line 2 LEDs in.
const BTOP = 20;
// The two alphabet arcs share a centre below them: A to M on the outer
// arc from -50 to 50 degrees, N to Z on the inner one from -66 to 66.
const ARC_X = 32, ARC_Y = 80.5, R1 = 36.5, R2 = 23.5;
// Where the pointer waits between words, and the two candles.
const REST = [32, 96];
const CANDLES = [[7, 120], [56, 120]];
// The messages, spelled in turn. YES, NO and GOODBYE are answered with
// the printed words.
const MESSAGES = ["HELLO", "BOO", "BEHIND YOU", "YES", "I SEE YOU", "1031", "NO", "RUN", "GOODBYE"];
// Story seconds (one a second at Speed 2): the search loop before a word,
// settling on a letter, the letter lighting, the rest on it once lit, the
// hold on a finished word and its fade.
const SEARCH = 1.6, SETTLE = 0.15, LIGHT = 0.22, LINGER = 0.65, HOLD = 1.4, FADE = 1.4;

export function setup(params) {
  const ink = new Uint8Array(N), glyphOf = new Int16Array(N).fill(-1), haloOf = new Int16Array(N).fill(-1);
  const glyphs = [], targets = {};
  // Print one 3 by 5 glyph with its centre at (cx, cy); returns its id.
  const put = (ch, cx, cy) => {
    const x0 = round(cx - 1.5), y0 = round(cy - 2.5), id = glyphs.length, rows = F3[ch];
    glyphs.push({ x0, y0 });
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if ((+rows[r] >> (2 - c)) & 1) {
          const p = (y0 + r) * W + x0 + c;
          ink[p] = 1;
          glyphOf[p] = id;
        }
    return id;
  };
  const word = (text, cx, cy) => {
    const ids = [], x0 = cx - (text.length * 4 - 1) / 2 + 1.5;
    [...text].forEach((ch, i) => ids.push(put(ch, x0 + i * 4, cy)));
    targets[text] = { x: cx, y: cy, ids };
  };
  const arc = (letters, R, a0) => {
    [...letters].forEach((ch, i) => {
      const a = ((-a0 + (2 * a0 * i) / (letters.length - 1)) * PI) / 180;
      const x = ARC_X + R * sin(a), y = ARC_Y - R * cos(a);
      targets[ch] = { x: round(x - 1.5) + 1.5, y: round(y - 2.5) + 2.5, ids: [put(ch, x, y)] };
    });
  };
  arc("ABCDEFGHIJKLM", R1, 50);
  arc("NOPQRSTUVWXYZ", R2, 66);
  [..."1234567890"].forEach((ch, i) => {
    const x = 32 + (i - 4.5) * 6;
    targets[ch] = { x: round(x - 1.5) + 1.5, y: 84.5, ids: [put(ch, x, 84.5)] };
  });
  word("YES", 16.5, 30.5);
  word("NO", 48, 30.5);
  word("GOODBYE", 32, 108.5);
  // A glow ring round each glyph, for when it lights.
  for (let p = 0; p < N; p++) {
    if (ink[p]) continue;
    const x = p % W, y = floor(p / W);
    for (let dy = -1; dy <= 1 && haloOf[p] < 0; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && glyphOf[yy * W + xx] >= 0) {
          haloOf[p] = glyphOf[yy * W + xx];
          break;
        }
      }
  }
  // The sun by YES and the moon by NO, the board's edge, and the table.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, px = x + 0.5, py = y + 0.5;
      const ds = hypot(px - 5, py - 30.5);
      if (ds < 2.3 || (ds > 3.4 && ds < 4.6 && floor(((Math.atan2(py - 30.5, px - 5) / TAU) * 16 + 16.5) % 2) === 0)) ink[p] = 2;
      const dm = hypot(px - 58, py - 30.5), dm2 = hypot(px - 59.6, py - 29.3);
      if (dm < 3.6 && dm2 > 3) ink[p] = 2;
      // The edge: a thin line 2 LEDs in from a rounded rectangle.
      const ex = max(0, abs(px - 32) - 25), ey = max(0, abs(py - 74) - 47);
      const e = hypot(ex, ey);
      if (abs(e - 4.5) < 0.5) ink[p] = 3;
      if (e > 6.5 || py < BTOP) ink[p] = 4;
    }
  params.s = {
    hue: 0, speed: 2, flick: 0, aura: 0.06, rt: 0,
    ink, glyphOf, haloOf, glyphs, targets, lit: new Float32Array(glyphs.length),
    // The pointer: where it is, its tilt, and the step it is on.
    px: REST[0], py: REST[1], ang: 0, vx: 0,
    msg: 0, steps: [], si: 0, st: 0, mv: null, said: "", flash: 0, wordA: 1,
    flame: [1, 1], sway: [0, 0], light: new Float32Array(N * 3),
  };
  plan(params.s);
  // The first search is a short one.
  params.s.steps[0] = { k: "loop", r: 6, dur: 0.5 };
}

// The steps for one message: a search loop, then for each letter a glide
// to it (a small loop first when a letter repeats), a hold and a fade.
function plan(S) {
  const text = MESSAGES[S.msg % MESSAGES.length], steps = [{ k: "loop", r: 10, dur: SEARCH }];
  if (S.targets[text] && text.length > 1) steps.push({ k: "go", t: S.targets[text], say: text });
  else {
    let prev = null;
    for (const ch of text) {
      if (ch === " ") {
        steps.push({ k: "go", t: { x: REST[0], y: REST[1] - 4, ids: [] }, say: " " });
        prev = null;
        continue;
      }
      if (prev === ch) steps.push({ k: "loop", r: 5, dur: 0.7 });
      steps.push({ k: "go", t: S.targets[ch], say: ch });
      prev = ch;
    }
  }
  steps.push({ k: "hold", dur: HOLD }, { k: "fade", dur: FADE });
  S.steps = steps;
  S.si = 0;
  S.st = 0;
  S.mv = null;
  S.said = "";
  S.text = text;
  S.wordA = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.flick = cl(k[2], 0, 1);
  S.aura = cl(k[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.rt += d;
  // The candles keep their own time: two beats each and a slow sway. With
  // Flicker up the flames burn taller and throw more light, and a ragged
  // gutter can drop one to half.
  const fk = 0.12 + 0.88 * S.flick, t = S.rt;
  for (let i = 0; i < 2; i++) {
    const o = i * 2.3;
    const gut = 0.5 + 0.5 * sin(t * 3.1 + o) * sin(t * 1.7 + 2 * o);
    S.flame[i] = (1 + 0.4 * S.flick) * (1 - fk * (0.1 + 0.08 * sin(t * 13.1 + o) + 0.06 * sin(t * 7.3 + 1.3 * sin(t * 2.1 + o))) - 0.4 * S.flick * gut * gut);
    S.sway[i] = fk * (0.8 * sin(t * 1.7 + o) + 0.5 * sin(t * 4.3 + 3 * o));
  }
  const x0 = S.px, y0 = S.py;
  const step = S.steps[S.si];
  S.st += g;
  if (step.k === "loop") {
    // A loop that starts and ends where the pointer is.
    if (!S.mv) S.mv = { x: S.px, y: S.py };
    const u = cl(S.st / step.dur, 0, 1), a = TAU * ss(u);
    S.px = S.mv.x + step.r * sin(a);
    S.py = S.mv.y - step.r * (1 - cos(a)) * 0.8;
    if (u >= 1) nextStep(S);
  } else if (step.k === "go") {
    if (!S.mv) {
      // A curved glide: a quadratic path bowed to one side by up to a
      // third of its length, at about 55 LEDs a second.
      const dx = step.t.x - S.px, dy = step.t.y - S.py, L = hypot(dx, dy);
      const bow = (Math.random() - 0.5) * 0.6 * L;
      S.mv = { x0: S.px, y0: S.py, cx: S.px + dx / 2 - (dy / (L || 1)) * bow, cy: S.py + dy / 2 + (dx / (L || 1)) * bow, dur: 0.3 + L / 55, said: false };
    }
    const m = S.mv, u = cl(S.st / m.dur, 0, 1), e = ss(u);
    const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
    S.px = a * m.x0 + b * m.cx + c * step.t.x;
    S.py = a * m.y0 + b * m.cy + c * step.t.y;
    const rest = S.st - m.dur;
    if (rest > SETTLE) for (const id of step.t.ids) S.lit[id] = max(S.lit[id], cl((rest - SETTLE) / LIGHT, 0, 1));
    if (rest > SETTLE + LIGHT && !m.said) {
      // The letter is read: it joins the word.
      m.said = true;
      S.said += step.say;
      S.flash = 1;
    }
    if (rest > SETTLE + LIGHT + LINGER) nextStep(S);
  } else if (step.k === "hold") {
    if (S.st >= step.dur) nextStep(S);
  } else if (step.k === "fade") {
    // The word fades as the pointer drifts back to where it waits.
    if (!S.mv) S.mv = { x: S.px, y: S.py };
    const u = cl(S.st / step.dur, 0, 1), e = ss(u);
    S.px = mix(S.mv.x, REST[0], e);
    S.py = mix(S.mv.y, REST[1], e);
    S.wordA = 1 - e;
    if (u >= 1) {
      S.msg++;
      plan(S);
    }
  }
  // Letters let go of their light once the pointer leaves them.
  const cur = S.steps[S.si];
  const keep = cur && cur.k === "go" && S.mv && S.mv.said ? cur.t.ids : null;
  for (let i = 0; i < S.lit.length; i++) if (!keep || !keep.includes(i)) S.lit[i] = max(0, S.lit[i] - g / 0.5);
  S.flash = max(0, S.flash - g / 0.6);
  // Tilt with the swing: the pointer leans into its sideways motion.
  if (g > 0) {
    const vx = (S.px - x0) / g;
    S.vx += (vx - S.vx) * min(1, g * 8);
    S.ang += (cl(-S.vx * 0.006, -0.38, 0.38) - S.ang) * min(1, g * 6);
  }
}

function nextStep(S) {
  S.si = min(S.si + 1, S.steps.length - 1);
  S.st = 0;
  S.mv = null;
}

// The pointer, in its own frame with the window centre at the origin: a
// heart with its point up, 25 LEDs wide and 24 tall. Returns 0 outside, 1
// for the body, 2 for its rim, 3 for the window's brass ring and 4 inside
// the glass.
function pointer(lx, ly) {
  const rw = hypot(lx, ly);
  if (rw < 4.4) return 4;
  if (rw < 5.6) return 3;
  const X = lx / 11, Y = (ly + 1.8) / 11;
  const h = X * X + Y * Y - 1;
  if (h * h * h - X * X * Y * Y * Y > 0) return 0;
  // Within about 1.3 LEDs of the outline: the rim.
  const X2 = lx / 9.7, Y2 = (ly + 1.3) / 9.7, h2 = X2 * X2 + Y2 * Y2 - 1;
  return h2 * h2 * h2 - X2 * X2 * Y2 * Y2 * Y2 > 0 ? 2 : 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { ink, glyphOf, haloOf, lit, light } = S;
  // The answer's colour runs from green through cyan, blue and violet to
  // pink and never through orange, which dims to brown on a dark board.
  const spirit = hsv(0.33 + 0.64 * S.hue, 0.85, 1);
  // The board's lacquer turns with Hue only through the cold hues, violet
  // at 0, so a near-black board never reads brown.
  const tint = hsv(0.77 + 0.17 * sin(2 * PI * S.hue), 0.7, 1);
  // Candlelight: a broad pool in the lacquer's colour, and a warm halo
  // close round each flame, bright enough to stay orange.
  const fl0 = S.flame[0], fl1 = S.flame[1];
  const c0x = CANDLES[0][0], c0y = CANDLES[0][1] - 6, c1x = CANDLES[1][0], c1y = CANDLES[1][1] - 6;
  // The answer's own light round the pointer's window, wider with Aura.
  const glowA = 0.35 + 0.65 * litMax(lit), ar2 = (18 + 24 * S.aura) ** 2, aK = (0.36 + 0.36 * S.aura) * glowA;
  // The pool's reach grows with Flicker.
  const reach = 900 + 1900 * S.flick;
  const PX = S.px, PY = S.py;
  for (let p = 0; p < N; p++) {
    const x = (p % W) + 0.5, y = floor(p / W) + 0.5;
    const d0 = (x - c0x) ** 2 + (y - c0y) ** 2, d1 = (x - c1x) ** 2 + (y - c1y) ** 2;
    const o = p * 3;
    // In steps of a 20th, a 16th and a 16th, so the glows do not cost a
    // smooth gradient.
    light[o] = q(fl0 / (1 + d0 / reach) + fl1 / (1 + d1 / reach), 20);
    light[o + 1] = q((fl0 * fl0) / (1 + d0 / 45) + (fl1 * fl1) / (1 + d1 / 45), 16);
    const da = (x - PX) ** 2 + (y - PY) ** 2;
    light[o + 2] = q(aK / (1 + (2.2 * da) / ar2), 16);
  }
  // The pointer's frame.
  const ca = cos(S.ang), sa = sin(S.ang);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, kind = ink[p], L = light[p * 3], Lw = light[p * 3 + 1], La = light[p * 3 + 2];
      let r, g, b;
      if (kind === 4) {
        // The table: almost black.
        (r = 0.01 + 0.3 * Lw), (g = 0.008 + 0.15 * Lw), (b = 0.016);
      } else {
        // The board: near-black lacquer, lit by the pool and the flames.
        const k = 0.05 + 0.15 * L;
        (r = tint[0] * k + 0.8 * Lw), (g = tint[1] * k + 0.42 * Lw), (b = tint[2] * k + 0.08 * Lw);
        if (kind === 1 || kind === 2 || kind === 3) {
          // Bone paint, brighter in the candlelight.
          const v = (0.34 + 0.36 * L + 0.4 * Lw) * (kind === 3 ? 0.5 : 1);
          (r = 0.86 * v), (g = 0.8 * v), (b = 0.72 * v);
        }
        const gi = glyphOf[p], hi = haloOf[p];
        if (gi >= 0 && lit[gi] > 0) {
          const a = lit[gi];
          (r = mix(r, 0.3 + 0.7 * spirit[0], a)), (g = mix(g, 0.3 + 0.7 * spirit[1], a)), (b = mix(b, 0.3 + 0.7 * spirit[2], a));
        } else if (hi >= 0 && lit[hi] > 0) {
          const a = lit[hi] * 0.6;
          (r += spirit[0] * a), (g += spirit[1] * a), (b += spirit[2] * a);
        }
        (r += spirit[0] * La), (g += spirit[1] * La), (b += spirit[2] * La);
      }
      // The pointer: a shadow first, then its body over the board.
      const dx = x + 0.5 - PX, dy = y + 0.5 - PY;
      if (abs(dx) < 18 && abs(dy) < 19) {
        const lx = ca * dx + sa * dy, ly = -sa * dx + ca * dy;
        const pk = pointer(lx, ly);
        if (pk === 0) {
          const sx = ca * (dx - 2) + sa * (dy - 3), sy = -sa * (dx - 2) + ca * (dy - 3);
          if (pointer(sx, sy) > 0) (r *= 0.45), (g *= 0.45), (b *= 0.45);
        } else if (pk === 1) {
          // Smoked glass over the board: the letters show through dimly.
          (r = r * 0.42 + 0.05), (g = g * 0.42 + 0.04), (b = b * 0.42 + 0.06);
        } else if (pk === 2) {
          const v = 0.78 + 0.22 * min(1, L);
          (r = 0.92 * v), (g = 0.88 * v), (b = 0.8 * v);
        } else if (pk === 3) {
          // The window's ring takes the colour of what answers.
          (r = mix(0.95, spirit[0], 0.5 * glowA)), (g = mix(0.85, spirit[1], 0.5 * glowA)), (b = mix(0.6, spirit[2], 0.5 * glowA));
        } else {
          // The glass: clear, the board a little brighter through it, tinted.
          const a = 0.18 + 0.3 * glowA;
          (r = r * 1.15 + spirit[0] * a), (g = g * 1.15 + spirit[1] * a), (b = b * 1.15 + spirit[2] * a);
        }
      }
      display.setPixel(x, y, round(255 * cl(r, 0, 1)), round(255 * cl(g, 0, 1)), round(255 * cl(b, 0, 1)));
    }
  drawCandles(S, display);
  drawWord(S, display, spirit);
}

const litMax = (lit) => {
  let m = 0;
  for (let i = 0; i < lit.length; i++) if (lit[i] > m) m = lit[i];
  return m;
};

// Two candles seen from above at the board's foot: an ivory top with its
// wick, and a flame leaning away from us that sways and stretches.
function drawCandles(S, display) {
  for (let i = 0; i < 2; i++) {
    const [cx, cy] = CANDLES[i], fl = S.flame[i], sw = S.sway[i];
    for (let y = cy - 14; y < min(H, cy + 6); y++)
      for (let x = cx - 6; x <= cx + 6; x++) {
        if (x < 0 || x >= W) continue;
        const px = x + 0.5, py = y + 0.5, dw = hypot(px - cx, (py - cy) * 1.15);
        let c = null;
        if (dw < 5) {
          const v = dw < 1 ? 0.25 : 0.72 + 0.28 * fl - 0.08 * (dw / 5);
          c = dw < 1 ? [0.2, 0.15, 0.12] : [v, v * 0.93, v * 0.8];
        }
        const fh = 9 + 2.5 * fl, fy = cy - 1 - py, fx = px - cx - sw * (fy / fh);
        if (fy > -0.5 && fy < fh) {
          const u = fy / fh, w = (u < 0.25 ? 2.4 * sqrt(u / 0.25) : 2.4 * (1 - (u - 0.25) / 0.75) ** 0.8) * (0.85 + 0.15 * fl);
          if (abs(fx) < w + 0.25) {
            if (abs(fx) < w * 0.45 && u < 0.6) c = [1, 0.97, 0.78];
            else if (abs(fx) < w * 0.8 && u < 0.85) c = [1, 0.78, 0.2];
            else c = [1, 0.5, 0.06];
          }
        }
        if (c) display.setPixel(x, y, round(255 * c[0]), round(255 * c[1]), round(255 * c[2]));
      }
  }
}

// The word spelled so far, above the board: twice size for five letters
// or fewer, the newest letter flashing white as it arrives, every letter
// glowing two LEDs round in the answer's colour.
const WH = 20, wmask = new Uint8Array(W * WH);
function drawWord(S, display, spirit) {
  const text = S.text, said = S.said, sc = text.length <= 5 ? 2 : 1, pitch = 6 * sc;
  const width = text.length * pitch - sc, x0 = round(32 - width / 2), y0 = sc === 2 ? 3 : 7;
  const a = S.wordA;
  if (a <= 0 || !said.length) return;
  wmask.fill(0);
  for (let i = 0; i < said.length; i++) {
    const rows = F5[said[i]];
    if (!rows) continue;
    for (let ry = 0; ry < 7 * sc; ry++)
      for (let rx = 0; rx < 5 * sc; rx++) {
        if (!((rows[floor(ry / sc)] >> (4 - floor(rx / sc))) & 1)) continue;
        const x = x0 + i * pitch + rx, y = y0 + ry;
        if (x >= 0 && x < W) wmask[y * W + x] = i === said.length - 1 ? 2 : 1;
      }
  }
  const fr = S.flash;
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < W; x++) {
      const m = wmask[y * W + x];
      let r, g, b;
      if (m) {
        const f = m === 2 ? fr : 0;
        (r = mix(spirit[0], 1, f)), (g = mix(spirit[1], 1, f)), (b = mix(spirit[2], 1, f));
      } else {
        // The glow: the nearest letter LED within two.
        let best = 9;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && xx < W && yy >= 0 && yy < WH && wmask[yy * W + xx]) best = min(best, dx * dx + dy * dy);
          }
        if (best > 5) continue;
        const k = best <= 2 ? 0.34 : 0.14;
        (r = 0.01 + spirit[0] * k), (g = 0.008 + spirit[1] * k), (b = 0.016 + spirit[2] * k);
      }
      display.setPixel(x, y, round(255 * cl(r * a, 0, 1)), round(255 * cl(g * a, 0, 1)), round(255 * cl(b * a, 0, 1)));
    }
}
