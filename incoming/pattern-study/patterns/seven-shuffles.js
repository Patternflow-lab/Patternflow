// ===== Patternflow pattern =====
// Title:   Seven Shuffles
// Family:  algo
// Idea:    A deck seen edge-on as a stack of rainbow bars is riffle shuffled again and again, each riffle zipping two packets together so the gradient splits into 2, 4, 8 interleaved runs until it reads as confetti, then the deck is unriffled back into order by a radix sort and starts over.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gilbert-Shannon-Reeds riffle shuffle (Edgar Gilbert and Claude Shannon, 1955; Jim Reeds, 1981), seven shuffles suffice (Dave Bayer and Persi Diaconis, 1992), pattern round 29
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cards=32..128, Neatness=0..1
//
// Knob 1: Hue. Turns the rainbow the cards are painted in, which runs from the bottom card of the new deck to the top one.
// Knob 2: Speed. How fast the hands work: at 2 a riffle takes under two seconds and a whole round, from order through the riffles and back, about twenty; at 0.2 ten times longer.
// Knob 3: Cards. How many cards are in the deck, 32 to 128: four rows a card at 32, two at 52 and 64, one from 65 up, so the bars thin to single lines.
// Knob 4: Neatness. Up to 0.1 every riffle is the random Gilbert-Shannon-Reeds one and the strip on the left wall shows how far the deck is from random; turned up, the cut moves to the middle and the cards fall more strictly one from each side, until at 1 every riffle is a perfect faro out-shuffle and the deck comes back to order by itself (five out-shuffles for 32 cards, eight for 52, seven for 128).
// Buttons: K1 tap riffles the deck once more, right away; tapped while the deck is being put back, the riffle comes as soon as it is in order.

const W = 64, H = 128, NMAX = 128;
const { min, max, floor, round, exp, log, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => ((t = cl(t, 0, 1)), t * t * (3 - 2 * t));
const rnd = () => Math.random();

// The deck at rest spans columns XL to XL + BW. In a riffle the bottom packet
// slides DX to the left and the top packet DX to the right, so where they
// interleave each side shows only its own cards: a comb.
const XL = 8, BW = 48, DX = 6;
// The strip on the left wall shows how far the deck is from random; the
// marks on the right wall count the riffles.
const SX = 0, MX = 63;
// Where the rainbow starts at Hue 0 (blue) and how much of the wheel it spans.
const H0 = 0.6, SPAN = 0.78;
// Stop shuffling once the deck is this close to random, in total variation:
// six riffles for 32 cards, seven for 52 (0.334, where six leave 0.614),
// nine for 128.
const ENOUGH = 0.4;

// Phases, and their length in seconds at Speed 2. A riffle splits the deck,
// drops the cards together and squares it up; an unriffle pass does the
// same backwards. REST holds the ordered deck before the first riffle, WAIT
// the shuffled one before it is put back.
const REST = 0, SPLIT = 1, DROP = 2, JOIN = 3, PAUSE = 4, WAIT = 5;
const RIF = [0.8, 0.3, 0.9, 0.3, 0.25, 1.4], UNR = [0.8, 0.2, 0.55, 0.2, 0.08, 1.4];

// log k! for the binomials in Bayer and Diaconis's formula.
const LF = new Float64Array(8400);
for (let i = 1; i < LF.length; i++) LF[i] = LF[i - 1] + log(i);

// Bayer and Diaconis: after k riffles, a deck whose order has r rising
// sequences turns up with probability C(2^k + n - r, n) / 2^(kn), and the
// Eulerian number A(n, r - 1) counts the orders with r of them. Half the
// summed gap from 1/n! is the total variation distance from random.
function tvTable(n) {
  let row = new Float64Array(n + 1), nx = new Float64Array(n + 1);
  row[0] = 1;
  for (let m = 2; m <= n; m++) {
    nx.fill(0);
    for (let j = 0; j < m; j++) nx[j] = (j + 1) * row[j] + (m - j) * (j > 0 ? row[j - 1] : 0);
    [row, nx] = [nx, row];
  }
  const tv = new Float64Array(14);
  for (let k = 0; k < 14; k++) {
    const q = 2 ** k;
    let s = 0;
    for (let r = 1; r <= n; r++) {
      const w = exp(log(row[r - 1]) - LF[n]);
      const ratio = q >= r ? exp(LF[q + n - r] - LF[q - r] - k * n * Math.LN2) : 0;
      s += w * abs(ratio - 1);
    }
    tv[k] = min(1, s / 2);
  }
  return tv;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Each card's colour by its place in the new deck, for this Hue.
function paint(P, hue) {
  P.hue = hue;
  for (let c = 0; c < P.n; c++) hsv(hue + H0 + (SPAN * c) / (P.n - 1), 0.88, 255, P.col, c * 3);
}

export function setup(params) {
  params.s = {
    n: 32, nu: 0, sp: 2, hue: 0,
    deck: new Int16Array(NMAX), from: new Float32Array(NMAX), to: new Float32Array(NMAX), side: new Int8Array(NMAX), nd: new Int16Array(NMAX),
    job: 0, ph: REST, t: 0, k: 0, want: 0, pass: 0, bits: 5, tv: null, kmax: 6, faro: 5, strip: 1, glow: 0, mk: new Float32Array(16),
    col: new Float32Array(NMAX * 3), buf: new Float32Array(W * H * 3), order: new Int16Array(NMAX),
  };
  fresh(params.s, 32);
}

// A new deck of n cards in order: card c at place c, counted from the bottom.
function fresh(P, n) {
  P.n = n;
  for (let c = 0; c < n; c++) P.deck[c] = c;
  P.tv = tvTable(n);
  P.kmax = 1;
  while (P.kmax < 13 && P.tv[P.kmax] >= ENOUGH) P.kmax++;
  P.bits = 1;
  while (1 << P.bits < n) P.bits++;
  // How many perfect out-shuffles bring this deck home.
  const a = new Int16Array(n), b = new Int16Array(n);
  for (let c = 0; c < n; c++) a[c] = c;
  P.faro = 0;
  do {
    faro(a, b, n);
    a.set(b.subarray(0, n));
    P.faro++;
  } while (P.faro < 200 && !sorted(a, n));
  P.job = 0, P.ph = REST, P.t = 0, P.k = 0, P.strip = 1;
  P.mk.fill(0);
  paint(P, P.hue);
}
function sorted(d, n) {
  for (let i = 0; i < n; i++) if (d[i] !== i) return false;
  return true;
}
// The out-shuffle: the bottom half and the top half alternate from the
// bottom up, so the bottom and top cards stay where they are.
function faro(a, b, n) {
  const c = (n + 1) >> 1;
  for (let i = 0, l = 0, r = c; i < n; i++) b[i] = i & 1 ? a[r++] : a[l++];
}

// Plan one riffle. The cut is binomial, as if each card picked a hand by a
// coin; then the cards fall from the bottoms of the two packets, each from a
// packet with chance in proportion to the cards it still holds. Neatness
// pulls the cut to the middle and the falls toward strict alternation.
function riffle(P) {
  const n = P.n, nu = P.nu, d = P.deck;
  let coin = 0;
  for (let i = 0; i < n; i++) coin += rnd() < 0.5 ? 1 : 0;
  const c = cl(round(n / 2 + (coin - n / 2) * (1 - nu) + (n & 1 ? 0.25 : 0)), 0, n);
  let a = c, b = n - c, l = 0, r = c, last = 1;
  for (let j = 0; j < n; j++) {
    const pg = a / (a + b), pa = last > 0 ? 1 : 0;
    const fromL = b === 0 || (a > 0 && rnd() < (1 - nu) * pg + nu * pa);
    const card = fromL ? d[l++] : d[r++];
    fromL ? a-- : b--;
    last = fromL ? -1 : 1;
    plan(P, card, fromL ? -1 : 1, j);
  }
  P.job = 0;
}

// Plan one unriffle: a pass of a binary radix sort. Cards whose original
// place has a 0 in this bit slide left and drop to the bottom, the 1s slide
// right and rise to the top, each side keeping its order. An inverse riffle
// is exactly this with the bits drawn at random.
function unriffle(P) {
  const n = P.n, d = P.deck, bit = 1 << P.pass;
  let z = 0;
  for (let i = 0; i < n; i++) if (!(d[i] & bit)) z++;
  for (let i = 0, lo = 0, hi = z; i < n; i++) {
    const card = d[i];
    if (card & bit) plan(P, card, 1, hi++);
    else plan(P, card, -1, lo++);
  }
  P.job = 1;
}

function plan(P, card, side, j) {
  P.side[card] = side;
  P.to[card] = j;
  P.nd[j] = card;
}

function begin(P) {
  for (let i = 0; i < P.n; i++) P.from[P.deck[i]] = i;
  P.ph = SPLIT, P.t = 0;
}

// What comes after a phase ends.
function next(P) {
  if (P.ph === SPLIT) return (P.ph = DROP), (P.t = 0);
  if (P.ph === DROP) return (P.ph = JOIN), (P.t = 0);
  if (P.ph === JOIN) {
    for (let j = 0; j < P.n; j++) P.deck[j] = P.nd[j];
    if (P.job === 0) {
      P.k++;
      if (P.k <= 16) P.mk[min(15, P.k - 1)] = 1;
    } else P.pass++;
    return (P.ph = PAUSE), (P.t = 0);
  }
  // At rest or after a pause: shuffle on, wait, or put the deck back.
  const home = sorted(P.deck, P.n);
  if (P.job === 1 && P.pass < P.bits) return unriffle(P), begin(P);
  if (P.job === 1 || (home && P.k > 0)) {
    // Back in order: by the radix sort, or by itself after perfect faros.
    if (P.job === 0) P.glow = 1;
    P.job = 0, P.k = 0;
    if (P.want <= 0) return (P.ph = REST), (P.t = 0);
  }
  if (P.want > 0 || (P.ph !== WAIT && P.k < (P.nu > 0.97 ? max(P.faro, 1) : P.kmax) && P.k < 12)) {
    P.want = max(0, P.want - 1);
    return riffle(P), begin(P);
  }
  if (P.ph !== WAIT) return (P.ph = WAIT), (P.t = 0);
  P.pass = 0;
  return unriffle(P), begin(P);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 32, 0.06], d = cl(dt || 0, 0, 0.1);
  const n = round(cl(k[2], 32, NMAX));
  if (n !== P.n) fresh(P, n);
  if (P.hue !== k[0]) paint(P, k[0]);
  P.sp = cl(k[1], 0.2, 3);
  // Below a tenth the riffle is the pure random one the strip is true for.
  P.nu = cl((k[3] - 0.1) / 0.9, 0, 1);
  if (input.btnPressed && input.btnPressed[0]) {
    P.want++;
    if (P.ph === REST || P.ph === WAIT) next(P);
  }
  // The hands slow down with Speed, but the waits between riffles do not
  // drag on past a second or two.
  const still = P.ph === REST || P.ph === WAIT || P.ph === PAUSE;
  P.t += d * (still ? max(P.sp / 2, 0.75) : P.sp / 2);
  const T = P.job ? UNR : RIF;
  if (P.t >= T[P.ph]) next(P);

  // The strip eases to the distance after k riffles, back to full once the
  // deck is being put in order; it fades out as the riffles grow neat, where
  // the formula no longer holds.
  const goal = P.job === 1 ? 1 : P.tv[min(13, P.k)];
  P.strip += (goal - P.strip) * min(1, d * 3);
  P.glow = max(0, P.glow - d * 0.7);
  for (let i = 0; i < 16; i++) {
    const on = i < P.k && P.job === 0 ? 1 : 0;
    P.mk[i] += (on * 0.55 - P.mk[i]) * min(1, d * (on ? 6 : 2.5));
  }
}

// One card edge-on: h rows from row top, its face lit from above and its
// lower edge dim (dark for the thick cards, a faint line at two rows a
// card), across columns a to a + BW with the ends anti-aliased.
function card(P, c, top, h, a, pass) {
  const buf = P.buf, col = P.col, b = a + BW, gap = h >= 3 ? 0 : 0.28;
  const g = P.glow * P.glow * 0.6, r0 = col[c * 3], g0 = col[c * 3 + 1], b0 = col[c * 3 + 2];
  const R = r0 + (255 - r0) * g, G = g0 + (255 - g0) * g, B = b0 + (255 - b0) * g;
  for (let yy = 0; yy < h; yy++) {
    const Y = top + yy, edge = yy === h - 1 && h > 1;
    if (Y < 0 || Y >= H || edge !== (pass === 0)) continue;
    const lv = edge ? gap : 1 - 0.13 * yy;
    for (let x = max(0, floor(a)); x <= min(W - 1, floor(b)); x++) {
      const w = (min(x + 1, b) - max(x, a)) * lv, q = (Y * W + x) * 3;
      if (w <= 0) continue;
      buf[q] += (R - buf[q]) * w;
      buf[q + 1] += (G - buf[q + 1]) * w;
      buf[q + 2] += (B - buf[q + 2]) * w;
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const n = P.n, buf = P.buf, T = P.job ? UNR : RIF, u = P.t / T[P.ph];
  const h = n <= 32 ? 4 : n <= 42 ? 3 : n <= 64 ? 2 : 1, y0 = floor((H - n * h) / 2);
  buf.fill(0);
  const moving = P.ph === SPLIT || P.ph === DROP || P.ph === JOIN;
  // While the packets pass through each other the right one is in front.
  const ord = P.order;
  if (P.ph === SPLIT || P.ph === DROP) {
    let m = 0;
    for (let j = 0; j < n; j++) if (P.side[P.nd[j]] < 0) ord[m++] = P.nd[j];
    for (let j = 0; j < n; j++) if (P.side[P.nd[j]] > 0) ord[m++] = P.nd[j];
  } else for (let j = 0; j < n; j++) ord[j] = moving ? P.nd[j] : P.deck[j];
  // Two passes: the dim edge rows first, then the faces, so a card passing
  // in front never greys another card's face with its edge.
  for (let pass = 0; pass < 2; pass++)
    for (let j = 0; j < n; j++) {
      const c = ord[j];
      let y = j, off = 0;
      if (moving) {
        const s = P.side[c] * DX;
        if (P.ph === SPLIT) (y = P.from[c]), (off = s * ease(u));
        else if (P.ph === DROP) (y = P.from[c] + (P.to[c] - P.from[c]) * ease(u)), (off = s);
        else (y = P.to[c]), (off = s * (1 - ease(u)));
      }
      card(P, c, y0 + round((n - 1 - y) * h), h, XL + off, pass);
    }
  // The strip: full height while the deck is far from random, sinking as
  // the riffles add up.
  const fade = max(0, 1 - P.nu * 8), sh = P.strip * H;
  if (fade > 0)
    for (let y = 0; y < H; y++) {
      const w = cl(sh - (H - 1 - y), 0, 1) * fade * (H - y < sh - 1.5 ? 0.38 : 0.85), q = (y * W + SX) * 3;
      buf[q] = 230 * w, buf[q + 1] = 226 * w, buf[q + 2] = 214 * w;
    }
  // One mark per riffle down the right wall.
  for (let i = 0; i < 16; i++) {
    const w = P.mk[i];
    if (w < 0.02) continue;
    for (let y = 2 + i * 6; y < 5 + i * 6 && y < H; y++) {
      const q = (y * W + MX) * 3;
      buf[q] = 240 * w, buf[q + 1] = 236 * w, buf[q + 2] = 224 * w;
    }
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
