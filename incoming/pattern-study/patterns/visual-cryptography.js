// ===== Patternflow pattern =====
// Title:   Visual Cryptography
// Family:  type
// Idea:    Two shares of random dots are laid over each other as two tints with the second swaying over the first, and each alone is noise, but at exactly zero slip the stack turns into a word in a 3 by 5 capital face, whole lit blocks on a half-lit speckle ground, with a soft bloom at the lock and the slip read out below.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Visual cryptography (Moni Naor and Adi Shamir, 1994, Eurocrypt, from memory); the 3 by 5 capitals of Saccades (pattern round 106) and the digits drawn for Kasiski Examination (pattern round 108), copied from edit-distance.js; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Slip=0..4, Message=0..4
//
// Knob 1: Hue. Turns both tints round the wheel together. At 0 the first share, which stays put, is cyan, the second, which sways, is orange, and a LED both light is the grey-green halfway between; at 0.25 they are violet and green, and at 0.5 the two swap places.
// Knob 2: Speed. At 2 one message takes 15 s: the second share stands locked for 2.6 s, slips away over 2.4 s, roams 7 LEDs out for 4.6 s and comes home over 5.4 s, crossing zero once on the way for a flash of the word 0.2 s long, then settling. Four messages make a loop of 60 s. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Slip. A hand on the second share, 0 to 4 LEDs to the right of where the sway would put it, opening at 0. At 0 the sway locks the shares. A word's area is 3.05 times as bright as its ground at the lock, 1.77 times at 0.5 and 0.90 at 1, where the word has turned into a faint dark ghost; at 2, a whole block, the shares meet the wrong blocks and the ratio is 0.98, nothing.
// Knob 4: Message. Which word to show, snapping at whole numbers. At 0, where it opens, the four come round in turn: ONE IS SNOW, TWO MAKE ONE, NAOR AND SHAMIR 1994 and LINE UP THE DOTS. 1 to 4 holds one of them, and the second share is dealt anew for it, dissolving block by block over 1 s.

const W = 64, H = 128, SW = 32, SH = 54, FH = SH * 2; // the field is FH LEDs tall, the readout lives below it
const FN = W * FH;
const { floor, min, max, abs, exp, sin, cos, sqrt, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, f) => a + (b - a) * f;
const mod = (a, n) => ((a % n) + n) % n;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall from saccades.js and the ten digits, both copied from edit-distance.js; three signs of my own.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
  "+": "...|.#.|###|.#.|...", "-": "...|...|###|...|...", ".": ".|.|.|.|#",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].split("|").map((r) => r.split("").map((c) => c === "#"));

// The four messages, a line to each entry: its words and the scale it is set at (1 or 2 secret pixels to a face pixel).
const MSGS = [
  [["ONE", 2], ["IS", 2], ["SNOW", 2]],
  [["TWO", 2], ["MAKE", 2], ["ONE", 2]],
  [["NAOR", 2], ["AND", 2], ["SHAMIR", 1], ["1994", 1]],
  [["LINE", 2], ["UP", 2], ["THE", 2], ["DOTS", 2]],
];
const GAP = 4; // secret pixels between lines

// Seconds at Speed 2.
const LOCK = 2.6, REL = 2.4, ROAM = 4.6, CAP = 5.4, CYC = LOCK + REL + ROAM + CAP;
// The sway turns once in PER seconds, so a message of CYC = 15 s holds three turns and every message comes home the same way, crossing zero once halfway home.
const RMAX = 7, KAP = 0.6, PER = 5, PHI0 = 1.82, DIS = 1.0;
const XC = 53, YC = 118; // the crosshair's centre

// The shares are made by the Naor and Shamir rule. A secret pixel is a block of 2 by 2 subpixels, one bit each: 1 top left, 2 top right, 4 bottom left, 8 bottom right.
// Share A gets one of the six patterns with two bits set. Share B gets the same pattern where the secret is clear and the complement where it is set.
const TWO = [3, 5, 6, 9, 10, 12];

function xorshift(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// A message's secret pixels, 1 where the face is set.
function secretOf(msg) {
  const sec = new Uint8Array(SW * SH);
  const heights = msg.map(([, sc]) => 5 * sc);
  const total = heights.reduce((a, b) => a + b, 0) + GAP * (msg.length - 1);
  let y0 = floor((SH - total) / 2);
  for (let l = 0; l < msg.length; l++) {
    const [word, sc] = msg[l], width = word.length * 3 * sc + (word.length - 1) * sc;
    const x0 = floor((SW - width) / 2);
    for (let i = 0; i < word.length; i++) {
      const G = GLYPH[word[i]];
      for (let j = 0; j < 5; j++)
        for (let c = 0; c < 3; c++)
          if (G[j][c])
            for (let v = 0; v < sc; v++)
              for (let u = 0; u < sc; u++) sec[(y0 + j * sc + v) * SW + x0 + (i * 4 + c) * sc + u] = 1;
    }
    y0 += heights[l] + GAP;
  }
  return sec;
}

// The blocks' bits spread over the LEDs.
function spread(blocks) {
  const led = new Uint8Array(FN);
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < W; x++) led[y * W + x] = (blocks[(y >> 1) * SW + (x >> 1)] >> ((y & 1) * 2 + (x & 1))) & 1;
  return led;
}

export function setup(params) {
  const rnd = xorshift(0x9e3779b1);
  const blocksA = new Uint8Array(SW * SH);
  for (let i = 0; i < blocksA.length; i++) blocksA[i] = TWO[floor(rnd() * 6)];
  const S = {
    rgb: new Float32Array(W * H * 3),
    A: spread(blocksA), blocksA,
    B: [], blocksB: [], mask: [], glow: [],
    thr: new Float32Array(SW * SH),
    Beff: new Float32Array(FN),
    cA: [0, 0, 0], cB: [0, 0, 0], cL: [0, 0, 0],
    c: 0, p: 0, n: 0, flipped: false, cur: 0, nxt: 0, dis: -1, tgt: 0,
    hue: 0, speed: 2, hand: 0, msgk: 0, ox: 0, oy: 0, lock: 1, flash: 0,
    trail: [], trailT: 0,
  };
  for (let i = 0; i < S.thr.length; i++) S.thr[i] = rnd();
  for (let m = 0; m < MSGS.length; m++) {
    const sec = secretOf(MSGS[m]), bb = new Uint8Array(SW * SH);
    for (let i = 0; i < bb.length; i++) bb[i] = sec[i] ? blocksA[i] ^ 15 : blocksA[i];
    S.blocksB.push(bb);
    S.B.push(spread(bb));
    // The bloom: the word's blocks on the LED grid, blurred twice by a box.
    const mk = new Float32Array(FN);
    for (let y = 0; y < FH; y++) for (let x = 0; x < W; x++) mk[y * W + x] = sec[(y >> 1) * SW + (x >> 1)];
    S.mask.push(mk.slice());
    let a = mk, b = new Float32Array(FN);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < W; x++) {
          let s = 0;
          for (let k = -2; k <= 2; k++) s += a[y * W + cl(x + k, 0, W - 1)];
          b[y * W + x] = s / 5;
        }
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < W; x++) {
          let s = 0;
          for (let k = -2; k <= 2; k++) s += b[cl(y + k, 0, FH - 1) * W + x];
          a[y * W + x] = s / 5;
        }
    }
    S.glow.push(a.map((v) => min(1, v * 1.7)));
  }
  S.Bnow = S.B[0];
  params.s = S;
}

// Where the second share stands, in LEDs from where it would line up, at p seconds into a message.
function sway(S, out) {
  const p = S.p, phi = PHI0 + (S.c * 2 * PI) / PER;
  let R = 0, kap = KAP;
  if (p >= LOCK) {
    if (p < LOCK + REL) R = RMAX * sm((p - LOCK) / REL);
    else if (p < LOCK + REL + ROAM) R = RMAX * (1 + 0.12 * sin((2 * PI * (p - LOCK - REL)) / ROAM));
    else {
      const v = (p - LOCK - REL - ROAM) / CAP;
      R = RMAX * (1 - sm(v));
      kap = KAP * (1 - sm(v / 0.25));
    }
  }
  // Each message turns the sway over, so the shares never come home by the same road twice running.
  out[0] = (S.n & 1 ? -1 : 1) * R * cos(phi);
  out[1] = (S.n & 2 ? -1 : 1) * R * kap * sin(phi);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.hand = cl(kv[2], 0, 4);
  S.msgk = cl(floor(kv[3] + 0.5), 0, 4);
  const g = (d * S.speed) / 2;
  S.c += g;
  S.p += g;
  if (S.p >= CYC) (S.p -= CYC), (S.flipped = false), S.n++;
  // On auto the next word is dealt halfway through the roam, while the second share is far out.
  if (S.msgk > 0) S.tgt = S.msgk - 1;
  else if (!S.flipped && S.p >= LOCK + REL + ROAM / 2) {
    S.flipped = true;
    S.tgt = (S.cur + 1) % MSGS.length;
  }
  if (S.dis < 0 && S.tgt !== S.cur) (S.dis = 0), (S.nxt = S.tgt);
  if (S.dis >= 0) {
    S.dis += g / DIS;
    if (S.dis >= 1) (S.cur = S.nxt), (S.dis = -1), (S.Bnow = S.B[S.cur]);
  }
  const o = [0, 0];
  sway(S, o);
  S.ox = o[0] + S.hand;
  S.oy = o[1];
  const dist = hypot(S.ox, S.oy), lock = sm(1 - dist / 0.9);
  if (lock > 0.98 && S.lock <= 0.98) S.flash = 1;
  S.lock = lock;
  S.flash = max(0, S.flash - d * 1.6);
  S.trailT += d;
  if (S.trailT >= 0.06) {
    S.trailT = 0;
    S.trail.push([S.ox, S.oy]);
    if (S.trail.length > 12) S.trail.shift();
  }
}

function put(rgb, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const p = (y * W + x) * 3, k = min(1, a);
  for (let e = 0; e < 3; e++) rgb[p + e] += (c[e] - rgb[p + e]) * k;
}

function glyph(rgb, ch, x, y, c, a) {
  const G = GLYPH[ch];
  if (!G) return 0;
  for (let j = 0; j < 5; j++) for (let i = 0; i < G[j].length; i++) if (G[j][i]) put(rgb, x + i, y + j, c, a);
  return G[0].length;
}

// A signed slip to one decimal: a sign, the digits and a point, from x. A slip of 0.0 has no sign.
function slipText(rgb, v, x, y, c, a) {
  const t = abs(v).toFixed(1), s = abs(v) < 0.05 ? "" : v < 0 ? "-" : "+";
  if (s) glyph(rgb, s, x, y, c, a);
  let cx = x + 4;
  for (const ch of t) cx += glyph(rgb, ch, cx, y, c, a) + 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.A) return;
  const rgb = S.rgb, { cA, cB, cL } = S;
  hsv(0.52 + S.hue, 0.9, 1, cA);
  hsv(0.04 + S.hue, 0.85, 1, cB);
  hsv(0.7 + S.hue, 0.28, 1, cL);
  rgb.fill(0);
  // The second share as it stands now, block by block, old or new while it is being dealt.
  let B = S.Bnow;
  if (S.dis >= 0) {
    const Bo = S.B[S.cur], Bn = S.B[S.nxt], bf = S.Beff, e = sm(S.dis) * 1.0001;
    for (let y = 0; y < FH; y++) for (let x = 0; x < W; x++) bf[y * W + x] = S.thr[(y >> 1) * SW + (x >> 1)] < e ? Bn[y * W + x] : Bo[y * W + x];
    B = bf;
  }
  const A = S.A, ox = S.ox, oy = S.oy, lock = S.lock, gain = 0.82 + 0.18 * lock, boost = 1 + (0.18 + 0.2 * S.flash) * lock;
  const mk = S.mask[S.cur], gl = S.glow[S.cur];
  const bl = (0.3 + 0.05 * sin((S.c * 2 * PI) / 2.5)) * lock + 0.35 * S.flash;
  // B at LED (x, y) is the share sampled at (x - ox, y - oy), wrapping, by the part of each LED the shifted dots cover.
  for (let y = 0; y < FH; y++) {
    const fy = y - oy, iy = floor(fy), ty = fy - iy, y0 = mod(iy, FH), y1 = mod(iy + 1, FH);
    for (let x = 0; x < W; x++) {
      const fx = x - ox, ix = floor(fx), tx = fx - ix, x0 = mod(ix, W), x1 = mod(ix + 1, W);
      const b = mix(mix(B[y0 * W + x0], B[y0 * W + x1], tx), mix(B[y1 * W + x0], B[y1 * W + x1], tx), ty);
      const a = A[y * W + x], o = (y * W + x) * 3;
      const m = mk[y * W + x], k = gain * (1 + (boost - 1) * m) * (1 - 0.3 * lock * (1 - m)), q = bl * gl[y * W + x];
      for (let e = 0; e < 3; e++) {
        // Where both layers light a LED the two tints meet at one brightness, so a doubled LED is no brighter than a single one.
        const v = (cA[e] * a + cB[e] * b) / max(1, a + b);
        rgb[o + e] = min(1, v * k + cL[e] * q);
      }
    }
  }

  // The readout. A line over the band, the two slips, LOCK, and a crosshair that follows the second share.
  for (let x = 4; x < W - 4; x++) put(rgb, x, FH + 1, cL, 0.16);
  glyph(rgb, "X", 2, 112, cA, 0.9);
  slipText(rgb, S.ox, 7, 112, cL, 0.95);
  glyph(rgb, "Y", 2, 120, cB, 0.9);
  slipText(rgb, S.oy, 7, 120, cL, 0.95);
  const word = "LOCK", la = 0.22 + 0.78 * S.lock;
  for (let i = 0; i < word.length; i++) glyph(rgb, word[i], 25 + i * 4, 116, cL, la);
  if (S.lock > 0.02) for (let x = 24; x < 41; x++) (put(rgb, x, 114, cL, 0.7 * S.lock), put(rgb, x, 122, cL, 0.7 * S.lock));
  // The crosshair, 17 by 17 LEDs at the field's own scale: the dot is where the second share's corner stands against the first.
  for (let k = -8; k <= 8; k++) (put(rgb, XC + k, YC, cL, 0.2), put(rgb, XC, YC + k, cL, 0.2));
  for (let k = -9; k <= 9; k++) (put(rgb, XC + k, YC - 9, cL, 0.12), put(rgb, XC + k, YC + 9, cL, 0.12), put(rgb, XC - 9, YC + k, cL, 0.12), put(rgb, XC + 9, YC + k, cL, 0.12));
  for (let i = 0; i < S.trail.length; i++) {
    const [tx, ty] = S.trail[i], f = (i + 1) / S.trail.length;
    splat(rgb, XC + 0.5 + cl(tx, -8, 8), YC + 0.5 + cl(ty, -8, 8), cB, 0.5 * f * f);
  }
  const rr = 3 + 5 * (1 - S.flash) * S.flash;
  if (S.lock > 0.02) for (let a = 0; a < 24; a++) splat(rgb, XC + 0.5 + rr * cos((a * PI) / 12), YC + 0.5 + rr * sin((a * PI) / 12), cL, 0.7 * S.lock);
  splat(rgb, XC + 0.5 + cl(S.ox, -8, 8), YC + 0.5 + cl(S.oy, -8, 8), cB, 1);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}

// A point at a fractional place, shared among the four LEDs round it.
function splat(rgb, x, y, c, a) {
  const fx = floor(x - 0.5), fy = floor(y - 0.5), tx = x - 0.5 - fx, ty = y - 0.5 - fy;
  put(rgb, fx, fy, c, a * (1 - tx) * (1 - ty));
  put(rgb, fx + 1, fy, c, a * tx * (1 - ty));
  put(rgb, fx, fy + 1, c, a * (1 - tx) * ty);
  put(rgb, fx + 1, fy + 1, c, a * tx * ty);
}
