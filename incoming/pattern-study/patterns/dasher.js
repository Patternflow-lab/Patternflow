// ===== Patternflow pattern =====
// Title:   Dasher
// Family:  type
// Idea:    Every letter that could come next stands as a coloured box as wide as the probability a letter-statistics model gives it, the boxes for the letter after that nested inside, and the view zooms into the box being aimed at until it fills the panel and its letter is written along the top, so an autopilot writes four sentences by steering into ever-nested boxes, the likely letters wide and the unlikely ones thin, while a knob bends its aim into plausible nonsense.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dasher (David J. Ward, Alan F. Blackwell and David J. C. MacKay, 2000), writing by steering into boxes sized by a language model, with the 3 by 5 capitals of Word Gesture (pattern round 104), pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Steer=-1..1, Speed=0.2..3, Memory=-1..1, Hue=0..1
//
// Knob 1: Steer. Moves the white cross, the point the view zooms about, off the autopilot's own aim, the small mark under the strip, by up to 24 LEDs either way. At 0 the autopilot writes its sentences word for word. At 0.1 the cross is 2 LEDs off and now and then lands in a neighbouring box, so a letter comes out as one of its neighbours in the alphabet; from 0.3 the text turns into nonsense the model still finds plausible. Back at 0 the autopilot takes up its script again at the next word.
// Knob 2: Speed. How fast the view zooms into a box: 2.5 bits of probability a second at 2, so a letter that costs 3 bits takes 1.2 s however wide its box is. At the opening Memory the autopilot spends 2.8 bits a letter, 1.1 s, and its four sentences take 2 min 20 s. At 0.2 a letter takes ten seconds.
// Knob 3: Memory. How many letters the model remembers when it sizes the boxes. At -1 none: the row of boxes is the same after every letter and after a t the box for h is 5 per cent. At 0 one letter, a bigram, and h is 29 per cent. At 1 mostly two letters, and after th the box for e takes 71 per cent. The autopilot's sentences cost 3.9 bits a letter at -1, 2.8 at 0 and 2.0 at 1.
// Knob 4: Hue. Turns the 27 box colours, one for each letter and one for the space, round the wheel together, so a letter takes another colour while the boxes keep their widths. The space stays the dark box. The opening 0.06 starts the alphabet on a blue a.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, abs, exp, log2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ---- What the model has read: a paragraph written for this pattern.
const CORPUS =
  "A knob has no words on it, only a position, and a position is a thing a hand can steer. " +
  "Turn it a little to the left and the panel writes one letter, turn it a little to the right and it writes another. " +
  "The panel never asks which letter you meant. It guesses what will come next, and it gives the likely letters a wide door and the unlikely ones a narrow slot. " +
  "After a t the letter h is wide and the letter z is a thread. " +
  "When the guess is good the road is wide and the words come fast, and when the guess is poor the road is narrow and the hand must slow down. " +
  "Nam June Paik put a magnet beside a television set and let the picture bend toward it, and here the light is bent in the same way, toward the next letter, by the turn of a knob. " +
  "Nothing is typed and nothing is chosen from a list. You steer, and the light follows your hand into the words. " +
  "A sentence is only a long path, and every letter on it is a door that opens a little wider when it is likely and a little less when it is not. " +
  "Most words begin with the same few letters, and most letters are followed by the same few. " +
  "That is all the panel knows about English, and it is enough to make the next step easy to guess. " +
  "Turn the knob and the light will write. " +
  "Let go of it and the panel will go on writing by itself, in the voice of the few lines it has read.";

// What the autopilot writes, one sentence after another, round and round.
const SENTENCES = [
  "the light follows your hand",
  "a likely letter is a wide door",
  "turn the knob and steer into the words",
  "the panel guesses the rest",
];
const SCRIPT = SENTENCES.join(" ") + " ";

// ---- The model. 27 symbols, a to z and the space (26). Letter counts, pair
// counts and triple counts are smoothed from the order below: a pair that was
// never seen borrows from the letter, a triple from the pair, so every box
// has some width and every row of boxes adds to exactly 1.
const A1 = 0.5, L2 = 2, L3 = 5;
const code = (ch) => (ch === " " ? 26 : ch.charCodeAt(0) - 97);
const sym = (c) => (c === 26 ? " " : String.fromCharCode(97 + c));
function buildModel() {
  const text = CORPUS.toLowerCase().replace(/[^a-z]+/g, " ").trim() + " ";
  const n1 = new Float64Array(27), n2 = new Float64Array(729), n3 = new Float64Array(19683);
  let a = 26, b = 26;
  for (const ch of text) {
    const c = code(ch);
    n1[c]++;
    n2[b * 27 + c]++;
    n3[(a * 27 + b) * 27 + c]++;
    a = b;
    b = c;
  }
  const p1 = new Float64Array(27), p2 = new Float64Array(729), p3 = new Float64Array(19683);
  let tot = 0;
  for (let c = 0; c < 27; c++) tot += n1[c];
  for (let c = 0; c < 27; c++) p1[c] = (n1[c] + A1) / (tot + 27 * A1);
  for (let b = 0; b < 27; b++) {
    let n = 0;
    for (let c = 0; c < 27; c++) n += n2[b * 27 + c];
    for (let c = 0; c < 27; c++) p2[b * 27 + c] = (n2[b * 27 + c] + L2 * p1[c]) / (n + L2);
  }
  for (let a = 0; a < 27; a++)
    for (let b = 0; b < 27; b++) {
      const i = (a * 27 + b) * 27;
      let n = 0;
      for (let c = 0; c < 27; c++) n += n3[i + c];
      for (let c = 0; c < 27; c++) p3[i + c] = (n3[i + c] + L3 * p2[b * 27 + c]) / (n + L3);
    }
  return { p1, p2, p3, chars: text.length };
}
const LM = buildModel();

// The row of box shares after the letters a, b, for a model of order o from 1
// to 3 (o between two whole numbers blends the two). Each share is the
// probability of its letter, so the row adds to 1.
function prob(a, b, o, out) {
  const w1 = o < 2 ? 2 - o : 0, w3 = o > 2 ? o - 2 : 0, w2 = 1 - w1 - w3;
  const i2 = b * 27, i3 = (a * 27 + b) * 27;
  for (let c = 0; c < 27; c++) out[c] = w1 * LM.p1[c] + w2 * LM.p2[i2 + c] + w3 * LM.p3[i3 + c];
  return out;
}

// ---- The face: 26 capitals, 3 wide and 5 tall, one string a row.
const FONT = {
  a: [".#.", "#.#", "###", "#.#", "#.#"],
  b: ["##.", "#.#", "##.", "#.#", "##."],
  c: [".##", "#..", "#..", "#..", ".##"],
  d: ["##.", "#.#", "#.#", "#.#", "##."],
  e: ["###", "#..", "##.", "#..", "###"],
  f: ["###", "#..", "##.", "#..", "#.."],
  g: [".##", "#..", "#.#", "#.#", ".##"],
  h: ["#.#", "#.#", "###", "#.#", "#.#"],
  i: ["###", ".#.", ".#.", ".#.", "###"],
  j: ["..#", "..#", "..#", "#.#", ".#."],
  k: ["#.#", "#.#", "##.", "#.#", "#.#"],
  l: ["#..", "#..", "#..", "#..", "###"],
  m: ["#.#", "###", "###", "#.#", "#.#"],
  n: ["##.", "#.#", "#.#", "#.#", "#.#"],
  o: [".#.", "#.#", "#.#", "#.#", ".#."],
  p: ["##.", "#.#", "##.", "#..", "#.."],
  q: [".#.", "#.#", "#.#", "###", ".##"],
  r: ["##.", "#.#", "##.", "#.#", "#.#"],
  s: [".##", "#..", ".#.", "..#", "##."],
  t: ["###", ".#.", ".#.", ".#.", ".#."],
  u: ["#.#", "#.#", "#.#", "#.#", "###"],
  v: ["#.#", "#.#", "#.#", "#.#", ".#."],
  w: ["#.#", "#.#", "###", "###", "#.#"],
  x: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  z: ["###", "..#", ".#.", "#..", "###"],
  " ": ["...", "...", "...", "...", "###"],
};
const GLY = [];
for (let c = 0; c < 27; c++) {
  const px = [];
  FONT[sym(c)].forEach((row, y) => [...row].forEach((ch, x) => ch === "#" && px.push(x, y)));
  GLY.push(px);
}

// ---- Colour. Every letter has one colour, spread round the wheel by the
// golden ratio so that letters next to each other in the alphabet, which are
// next to each other on the panel, are far apart in hue; the odd letters are
// paler so a neighbour differs in more than hue. Orange and yellow go brown
// when dim, so they are paled and lifted; blue is lifted too.
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
function satOf(h) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.07) ** 2)), u = exp(-(((f - 0.66) / 0.07) ** 2));
  return 1 - 0.3 * b - 0.22 * u;
}
function gainOf(h) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.07) ** 2)), c = hsv(h, satOf(h), 1);
  return cl(0.5 / (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114), 1, 2) * (1 + 0.5 * b);
}
const HUE0 = 0.55, PHI = 0.6180339887;
function letterHue(c, hue) {
  return hue + HUE0 + (c === 26 ? 0 : (c * PHI) % 1);
}
function tone(c, hue, v) {
  if (c === 26) return [v, v, v * 0.97];
  const h = letterHue(c, hue), s = c % 2 ? 0.66 : 0.92;
  return hsv(h, s * satOf(h), min(1, v * gainOf(h)));
}

// ---- The field. The panel is the unit interval of the next letter seen
// sideways: x is the share of probability, and up the panel is how many bits
// of that share a box has spent. A box of width w LEDs starts at row
// YB - K log2(64 / w), so each halving is K rows higher, a letter of 3 bits
// starts 3K rows above its parent, and a box 1 LED wide, 6 bits, starts near
// the top. The box fills the panel above its start, the boxes for the letter
// after it start higher inside it, and zooming in is every start sliding down.
const FT = 9, YB = 127, K = 18, NEAR = 26;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(params) {
  const tail = SENTENCES[SENTENCES.length - 1] + " ";
  params.s = {
    lm: { prob, chars: LM.chars, corpus: CORPUS, script: SCRIPT },
    // The view: the unit interval of the next letter after (a, b), seen from lo for w.
    lo: 0, w: 1, a: code(tail[tail.length - 2]), b: 26,
    text: tail, slide: 0, written: "",
    o: 2, tgt: -1, te0: 0, te1: 64,
    fx: 32, cx: 32, gx: 32, a0: null,
    p: 0, mode: 0, next: code(SCRIPT[0]), rand: rng(105),
    steer: 0, speed: 2, hue: 0.06,
    P: new Float64Array(27), cum: new Float64Array(28),
    PB: Array.from({ length: 12 }, () => new Float64Array(27)),
    lb: [], lutHue: -9, lut: [],
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
  };
}

// Where each letter's box sits on the panel, as shares along cum.
function row(S, o) {
  prob(S.a, S.b, o, S.P);
  S.cum[0] = 0;
  for (let c = 0; c < 27; c++) S.cum[c + 1] = S.cum[c] + S.P[c];
}
const x0Of = (S, c) => ((S.cum[c] - S.lo) / S.w) * W;
const x1Of = (S, c) => ((S.cum[c + 1] - S.lo) / S.w) * W;

// The box under screen column x.
function under(S, x) {
  const u = S.lo + (x / W) * S.w;
  for (let c = 0; c < 27; c++) if (u < S.cum[c + 1]) return c;
  return 26;
}

// A letter drawn from the row of boxes by width, leaving out the ones too
// thin to see, and no second space in a row.
function sample(S) {
  let tot = 0;
  for (let c = 0; c < 27; c++) tot += S.P[c] >= 0.01 && !(c === 26 && S.b === 26) ? S.P[c] : 0;
  let r = S.rand() * tot;
  for (let c = 0; c < 27; c++) {
    if (S.P[c] < 0.01 || (c === 26 && S.b === 26)) continue;
    r -= S.P[c];
    if (r <= 0) return c;
  }
  return 4;
}

// After a letter is written the autopilot decides the next. While it follows
// the script the next letter is the script's. A letter that is not the
// script's, written because the knob steered it, puts the autopilot into
// the model's own writing until a space, and then it takes up the script at
// the following word.
function chooseNext(S, c) {
  if (S.mode === 0) {
    if (c === code(SCRIPT[S.p])) S.p = (S.p + 1) % SCRIPT.length;
    else S.mode = 1;
  } else if (c === 26) {
    const q = SCRIPT.indexOf(" ", S.p);
    S.p = q < 0 ? 0 : (q + 1) % SCRIPT.length;
    S.mode = 0;
  }
  row(S, S.o);
  S.next = S.mode === 0 ? code(SCRIPT[S.p]) : sample(S);
}

function commit(S, c) {
  const u0 = S.cum[c], u1 = S.cum[c + 1];
  S.lo = max(0, (S.lo - u0) / (u1 - u0));
  S.w = S.w / (u1 - u0);
  S.text = (S.text + sym(c)).slice(-300);
  S.written = (S.written + sym(c)).slice(-20000);
  S.slide = 1;
  S.a = S.b;
  S.b = c;
  chooseNext(S, c);
}

const ZOOM = 0.866;

// The point to zoom about for the autopilot's letter, on the panel as it is.
function aim(S) {
  const t0 = x0Of(S, S.next), t1 = x1Of(S, S.next), tw = t1 - t0;
  S.a0 = cl(tw < W - 1e-3 ? (W * t0) / (W - tw) : t1 < W ? 0 : W, -4000, 4000);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.steer = cl(k[0], -1, 1);
  S.speed = cl(k[1], 0.05, 3);
  S.hue = k[3];
  const mem = cl(k[2], -1, 1), o = 2 + (mem < 0 ? mem : 0.7 * mem);
  S.slide = max(0, S.slide - dt / 0.3);

  // A new model resizes every box. The box being entered keeps its place on
  // the panel and the rest rearrange round it.
  if (abs(o - S.o) > 1e-4) {
    const w0 = S.te1 - S.te0;
    row(S, o);
    if (S.tgt >= 0 && w0 > 1e-3) {
      const u0 = S.cum[S.tgt], u1 = S.cum[S.tgt + 1];
      S.w = ((u1 - u0) * W) / w0;
      S.lo = u0 - (S.te0 / W) * S.w;
      if (S.w > 1) {
        S.w = 1;
        S.lo = 0;
      }
    } else {
      S.lo = 0;
      S.w = 1;
    }
    S.o = o;
    S.a0 = null;
  }
  row(S, S.o);

  // The autopilot's letter has a box, and scaling the view about one point
  // brings that box to fill the panel when both its edges reach the panel's
  // edges together. That point is where the autopilot aims, taken when the
  // letter begins and held. When the box is off to one side the point is off
  // the panel too, and the zoom slides the view toward it. The knob moves the
  // aim off that point by up to 24 LEDs, and the box that ends up filling the
  // panel is whichever one the aim stays inside.
  const T = S.next;
  if (S.a0 === null) aim(S);
  const want = abs(S.steer) < 0.005 ? S.a0 : cl(S.a0 + 24 * S.steer, 1, W - 2);
  S.fx += (want - S.fx) * (1 - exp(-dt / 0.12));
  const s = exp(-ZOOM * S.speed * dt), uf = S.lo + (S.fx / W) * S.w;
  S.w *= s;
  // The view stays inside the unit interval, whatever the aim does.
  S.lo = cl(uf - (uf - S.lo) * s, 0, 1 - S.w);
  // With the knob at rest the box is never lost: the view keeps it inside
  // until the box is wider than the view, and then keeps the view inside it.
  if (abs(S.steer) < 0.005) {
    const u0 = S.cum[T], u1 = S.cum[T + 1];
    S.lo = S.w >= u1 - u0 ? cl(S.lo, u1 - S.w, u0) : cl(S.lo, u0, u1 - S.w);
  }
  S.cx += (cl(S.fx, 1, W - 2) - S.cx) * (1 - exp(-dt / 0.06));
  S.gx += (cl(S.a0, 1, W - 2) - S.gx) * (1 - exp(-dt / 0.12));

  // A letter is written when its box fills the panel.
  const n0 = S.written.length;
  for (let n = 0; n < 4; n++) {
    row(S, S.o);
    const c = under(S, 0);
    if (S.cum[c + 1] >= S.lo + S.w - 1e-9) commit(S, c);
    else break;
  }
  row(S, S.o);
  if (S.written.length !== n0) aim(S);
  S.tgt = S.next;
  S.te0 = x0Of(S, S.next);
  S.te1 = x1Of(S, S.next);
}

// ---- Drawing.
// Each box is one colour that is a little brighter at its start than up the
// panel, with a lit lip on its first row. The rows near the top of the panel
// are far away, so they fade into a deep blue haze.
const HAZE = [0.3, 0.42, 1];
const FOG = new Float32Array(H);
for (let y = 0; y < H; y++) FOG[y] = cl(0.12 + 0.88 * ((y - FT) / 40), 0.12, 1);
const DEPTH = YB - FT + 1;

function palette(S) {
  if (S.lutHue === S.hue && S.lut.length) return;
  S.lutHue = S.hue;
  S.lut = [];
  for (let c = 0; c < 27; c++) {
    const L = new Float32Array(DEPTH * 3);
    for (let d = 0; d < DEPTH; d++) {
      const v = 0.68 + 0.32 * exp(-d / 30);
      const col = c === 26 ? [0.1 * v, 0.11 * v, 0.3 * v] : tone(c, S.hue, v);
      L[d * 3] = col[0];
      L[d * 3 + 1] = col[1];
      L[d * 3 + 2] = col[2];
    }
    S.lut.push(L);
  }
}

function fillBox(S, xa, xb, yb, c, edge, lipMix) {
  const L = S.lut[c], a = max(xa, 0), b = min(xb, W);
  for (let y = FT; y <= yb; y++) {
    const g = FOG[y], h = (1 - g) * 0.4, d = (yb - y) * 3, lip = y === yb ? lipMix : 0;
    const r = lerp(L[d] * g + HAZE[0] * h, 1, lip), gr = lerp(L[d + 1] * g + HAZE[1] * h, 1, lip), bl = lerp(L[d + 2] * g + HAZE[2] * h, 1, lip);
    for (let x = a; x < b; x++) {
      const o = y * W + x, e = edge && x === xa ? 0.5 : 1;
      S.R[o] = r * e;
      S.G[o] = gr * e;
      S.B[o] = bl * e;
    }
  }
}

function walk(S, a, b, x0, wpx, depth, par) {
  const P = prob(a, b, S.o, S.PB[depth]);
  let acc = 0;
  for (let c = 0; c < 27; c++) {
    const cw = wpx * P[c], cx0 = x0 + wpx * acc;
    acc += P[c];
    if (cw < 1 || cx0 + cw <= 0 || cx0 >= W) continue;
    const ys = YB - K * log2(W / cw);
    if (ys < NEAR) continue;
    const yb = min(YB, floor(ys)), xa = round(cx0), xb = round(cx0 + cw);
    if (depth === 0 && xb > 24 && xa < 40) S.ground = max(S.ground, yb);
    fillBox(S, xa, xb, yb, c, cw >= 3 && xa >= 0, depth === 0 && c === S.tgt ? 0.9 : 0.3);
    // A child that starts over the rows of its parent's letter hides it.
    if (par && yb >= par.y && xb > par.x && xa < par.x + 3) par.ok = false;
    let lab = null;
    const vis0 = max(cx0, 0), vis1 = min(cx0 + cw, W);
    if (vis1 - vis0 >= 4 && yb - 6 >= FT) {
      lab = { x: round((vis0 + vis1) / 2 - 1.5), y: yb - 6, c, ok: true };
      S.lb.push(lab);
    }
    if (depth < 10) walk(S, b, c, cx0, cw, depth + 1, lab);
  }
}

function field(S) {
  palette(S);
  S.ground = 0;
  // The letter just written is the ground under every box.
  fillBox(S, 0, W, YB, S.b, false, 0.3);
  S.lb.length = 0;
  // The view's own position: its left edge is S.lo of the unit interval, so
  // the first row of boxes begins -S.lo / S.w of a panel from the left.
  walk(S, S.a, S.b, (-S.lo / S.w) * W, W / S.w, 0, null);
  for (const l of S.lb) {
    if (!l.ok) continue;
    const px = GLY[l.c];
    for (let i = 0; i < px.length; i += 2) {
      const x = l.x + px[i], y = l.y + px[i + 1];
      if (x < 0 || x >= W || y < FT || y >= H) continue;
      const o = y * W + x;
      S.R[o] = S.G[o] = S.B[o] = l.c === 26 ? 0.85 : 0;
    }
  }
  // The letter just written, large on the ground it stands on, when the
  // boxes after it leave the ground bare there.
  if (S.b !== 26 && S.ground < 108) {
    const px = GLY[S.b];
    for (let i = 0; i < px.length; i += 2)
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const o = (YB - 14 + px[i + 1] * 2 + dy) * W + 29 + px[i] * 2 + dx;
          S.R[o] = S.G[o] = S.B[o] = 0;
        }
  }
}

// The text so far in a line along the top, the newest letter at the right,
// the line sliding a letter's width left as each is written.
function strip(S) {
  const n = min(S.text.length, 16), at = S.text.length - n;
  const sl = S.slide * S.slide * (3 - 2 * S.slide), off = round(4 * sl);
  for (let i = 0; i < n; i++) {
    const c = code(S.text[at + i]);
    if (c === 26) continue;
    const x0 = 58 - 4 * (n - 1 - i) + off;
    const fade = cl((x0 + 6) / 34, 0, 1), face = tone(c, S.hue, 1).map((v) => lerp(v, 1, 0.35));
    // The oldest letters sink into the haze rather than dim to brown.
    const col = [lerp(0.28, face[0], fade), lerp(0.32, face[1], fade), lerp(0.46, face[2], fade)];
    const px = GLY[c];
    for (let j = 0; j < px.length; j += 2) {
      const x = x0 + px[j], y = 1 + px[j + 1];
      if (x < 0 || x >= W) continue;
      const o = y * W + x;
      S.R[o] = col[0];
      S.G[o] = col[1];
      S.B[o] = col[2];
    }
  }
}

function cross(S) {
  const cx = round(S.cx), cy = 15;
  const white = (x, y, m) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = y * W + x;
    S.R[o] = lerp(S.R[o], 1, m);
    S.G[o] = lerp(S.G[o], 1, m);
    S.B[o] = lerp(S.B[o], 1, m);
  };
  const dark = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = y * W + x;
    S.R[o] *= 0.15;
    S.G[o] *= 0.15;
    S.B[o] *= 0.15;
  };
  // Where the autopilot would aim, a small mark under the strip, when the knob has bent the aim away from it.
  const gx = round(S.gx);
  if (abs(gx - cx) > 2) {
    white(gx, 10, 0.7);
    white(gx - 1, 9, 0.7);
    white(gx, 9, 0.7);
    white(gx + 1, 9, 0.7);
  }
  // The line the aim draws down the panel, every other row.
  for (let y = cy + 4; y <= YB; y += 2) white(cx, y, 0.55);
  for (let d = -3; d <= 3; d++) {
    dark(cx + d, cy - 1);
    dark(cx + d, cy);
    dark(cx + d, cy + 1);
    dark(cx - 1, cy + d);
    dark(cx, cy + d);
    dark(cx + 1, cy + d);
  }
  for (let d = -2; d <= 2; d++) {
    white(cx + d, cy, 1);
    white(cx, cy + d, 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  S.R.fill(0);
  S.G.fill(0);
  S.B.fill(0);
  field(S);
  strip(S);
  cross(S);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const r = S.R[o], g = S.G[o], b = S.B[o];
      if (r + g + b > 0.004) display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
}
