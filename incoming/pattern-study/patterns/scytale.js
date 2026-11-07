// ===== Patternflow pattern =====
// Title:   Scytale
// Family:  type
// Idea:    A ribbon of capitals is wound in a helix round a vertical rod, and only on the rod whose thickness it was written for do the letters of every turn stand in one straight column and read down the rod as a message, while on any other rod they slide round and spell nothing.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Spartan scytale (described by Plutarch, Life of Lysander, c. 100 CE), a transposition cipher that writes the message along the rod and reads the unwound strip; the 3 by 5 capitals of Saccades (pattern round 106), copied from saccades.js; pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rod=6..10, Message=0..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the first strip and the rod are cyan, the letters pale cyan, and a message that reads turns gold. The other two strips come in violet and green. A hue that would leave the ribbon a dim orange goes to crimson or green instead.
// Knob 2: Speed. How fast the rod turns on its axis, which carries the columns of letters across the front from the right edge to the left. At 2 one turn takes 17.5 s, 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Rod. The thickness of the rod as the number K of letters that go round it, from 6 to 10. The radius grows with it, from 18 LEDs at 6 to 30 at 10, because the strip does not change. It is continuous but the rod catches at each whole number: within a fifth of 7, 8 or 9 the columns stand straight, and farther out each turn slides the letters round the rod by 2 pi times the distance to the whole number over K, 1.2 LEDs at the middle for K = 8.06 and 9.5 for K = 7.5. It opens at 6, which is the wrong rod for all three strips.
// Knob 4: Message. Snaps to one of three strips, each written for its own rod and cut from its own colour: 0 for a rod of 8, in cyan, 112 letters, 1 for a rod of 7, in violet, 105 letters, 2 for a rod of 9, in green, 117 letters. On its own rod the letters turn gold, a light goes down each line in reading order and one falls the length of the rod.

const W = 64, H = 128;
const { floor, round, min, abs, sqrt, exp, asin, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The face: capitals 3 wide and 5 tall, one string a row, from saccades.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###", ".": "...|...|...|...|.#.", ",": "...|...|...|.#.|#..",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// Three strips, each with the number of letters K0 that go round the rod it
// was written for and as many letters as K0 times the letters in a line, m.
const MSG = [
  [8, "COME HOME AT ONCE. THE EPHORS HAVE READ YOUR LAST TWO RODS AND WISH TO HEAR YOU AT SPARTA TODAY. BRING YOUR ROD.", 0],
  [7, "THE PASS IS HELD BUT WE ARE FEW. SEND US MEN BEFORE THE NEW MOON. DO NOT WRITE BACK. BURN THIS STRIP NOW.", 0.28],
  [9, "THE FLEET SAILS AT DAWN. HOLD THE STRAIT AND LET NO ONE PASS. SPARTA ASKS NO MORE OF YOU THAN THIS. THE EPHORS WATCH.", -0.22],
].map(([K0, text, tint]) => {
  // The message is written along the rod, K0 lines of m letters, and the strip
  // is read off the rod turn by turn: strip letter j = t * K0 + l is line l of
  // turn t, which is letter l * m + t of the message.
  const N = text.length, m = N / K0, cipher = [];
  for (let j = 0; j < N; j++) {
    const p = (j % K0) * m + floor(j / K0);
    cipher.push(text[p] === " " ? "" : text[p]);
  }
  return { K0, N, m, cipher, tint };
});

const PITCH = 8; // rows the strip climbs in one turn: five of letter, a blank above and below and the edge line
const S0 = 19; // LEDs of strip, along its length, for one letter: the rod's radius is K * S0 / 2 pi
const TOP = 2, BOT = 126; // the rod's first row and the row after its last
const Y0 = TOP + PITCH / 2; // where the first letter of the strip sits
const ARC = 2; // LEDs of rod surface one column of a letter covers, at the middle
const ROT = 0.18; // rod turn in radians a second, per unit of Speed
const INV = 1 / (2 * PI);

// A dim orange or yellow reads as brown on the panel, so the ribbon and the
// rod go to crimson where their hue would land in orange, and to green in
// yellow.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, K: -1, msg: 0, phi: 0.08, lock: 0, seat: 0, armed: false, fy: 999, rl: 0, rt: -2,
    buf: new Uint8Array(W * H * 3),
  };
}

// The rod catches at each whole number: the pull is cubic, so within a fifth
// of a letter of a whole K the rod sits on it and halfway between it does not.
function catchK(k) {
  const i = round(k), f = k - i, u = abs(2 * f);
  return i + (f < 0 ? -0.5 : 0.5) * u * u * u;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const kt = catchK(cl(k[2], 6, 10));
  S.K = S.K < 0 ? kt : S.K + (kt - S.K) * min(1, d * 10);
  S.msg = cl(round(k[3]), 0, 2);
  S.phi -= d * ROT * S.speed;
  // The message reads when the rod is the whole number it was written for.
  const M = MSG[S.msg], Ki = round(S.K);
  const on = Ki === M.K0 ? 1 - sm((abs(S.K - Ki) - 0.01) / 0.03) : 0;
  S.seat = 1 - sm((abs(S.K - Ki) - 0.01) / 0.06);
  S.lock += (on - S.lock) * min(1, d * (on > S.lock ? 4 : 8));
  if (on > 0.6 && !S.armed) {
    S.armed = true;
    S.fy = -12;
  } else if (on < 0.2) S.armed = false;
  S.fy += d * 110;
  // The reading light goes down one line of the message at 7 letters a second
  // and moves to the next line, or when that has turned out of sight to the
  // line at the left of the front, so it always reads what can be read.
  S.rt += d * 7;
  if (S.rt > M.m + 2) {
    S.rt = -2;
    const K0 = M.K0, ang = (l) => ((S.phi + (2 * PI * l) / K0 + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
    let nl = (S.rl + 1) % K0;
    if (abs(ang(nl)) > 1) {
      nl = -1;
      for (let l = 0; l < K0; l++) if (ang(l) > -1 && ang(l) < 1 && (nl < 0 || ang(l) < ang(nl))) nl = l;
    }
    S.rl = nl < 0 ? 0 : nl;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const K = S.K, R = (K * S0) / (2 * PI), M = MSG[S.msg], N = M.N, h = S.hue, lk = S.lock;
  const RIB = [0, 0, 0], EDG = [0, 0, 0], INK = [0, 0, 0], GOLD = [0, 0, 0], ROD = [0, 0, 0], RIM = [0, 0, 0];
  const tn = M.tint;
  hsv(dim(h + 0.52 + tn), 0.62, 1, RIB);
  hsv(dim(h + 0.52 + tn), 0.4, 1, EDG);
  hsv(h + 0.5 + tn, 0.3, 1, INK);
  hsv(h + 0.12, 0.6, 1, GOLD);
  hsv(dim(h + 0.6 + tn), 0.45, 1, ROD);
  hsv(dim(h + 0.5 + tn), 0.25, 1, RIM);
  const eg = 0.36 + 0.3 * S.seat, buf = S.buf, TH = [0, 0, 0], CS = [0, 0, 0], IN = [0, 0, 0], SX = [-1 / 3, 0, 1 / 3];
  for (let x = 0; x < W; x++) {
    for (let s = 0; s < 3; s++) {
      const q = (x + 0.5 + SX[s] - 32) / R;
      IN[s] = abs(q) < 1 ? 1 : 0;
      TH[s] = IN[s] ? asin(q) : 0;
      CS[s] = IN[s] ? sqrt(1 - q * q) : 0;
    }
    for (let y = 0; y < H; y++) {
      let r = 0, g = 0, b = 0;
      if (y >= TOP && y < BOT) {
        const yp = y + 0.5;
        for (let s = 0; s < 3; s++) {
          if (!IN[s]) continue;
          const th = TH[s], cs = CS[s], lam = 0.3 + 0.7 * cs;
          // The bare rod, then the rim.
          let cr = ROD[0] * 0.14 * lam, cg = ROD[1] * 0.14 * lam, cb = ROD[2] * 0.14 * lam;
          if (cs < 0.4) {
            const e = 0.45 * (1 - cs / 0.4);
            cr += RIM[0] * e;
            cg += RIM[1] * e;
            cb += RIM[2] * e;
          }
          // The strip: which turn this row is in, and which letter of it.
          const rb = (th - S.phi) * INV, j0 = round((yp - Y0) / PITCH - rb);
          let hit = false;
          for (let jj = j0 - 1; jj <= j0 + 1 && !hit; jj++) {
            const nc = K * (rb + jj), n = round(nc);
            if (n < 0 || n >= N) continue;
            const ty = round(Y0 + (PITCH * n) / K - 2.5), gy = y - ty;
            if (gy < -2 || gy > 5) continue;
            hit = true;
            const wk = lk * 0.3;
            cr = (RIB[0] * (1 - wk) + GOLD[0] * wk) * 0.3 * lam;
            cg = (RIB[1] * (1 - wk) + GOLD[1] * wk) * 0.3 * lam;
            cb = (RIB[2] * (1 - wk) + GOLD[2] * wk) * 0.3 * lam;
            if (gy === -2) {
              cr = EDG[0] * eg * lam;
              cg = EDG[1] * eg * lam;
              cb = EDG[2] * eg * lam;
            } else if (gy >= 0 && gy < 5) {
              const ch = M.cipher[n];
              const col = floor(((nc - n) * S0) / ARC + 1.5);
              if (ch && col >= 0 && col < 3 && GLYPH[ch][gy * 3 + col]) {
                const v = 0.3 + 0.7 * cs * cs;
                // Gold where the rod reads, with a light that goes down a line
                // of the message and one that falls the length of the rod.
                const near = n % M.K0 === S.rl ? (floor(n / M.K0) - S.rt) / 1.8 : 9, fl = (y - S.fy) / 10;
                const glow = lk * (exp(-near * near) * 0.9 + exp(-fl * fl) * 0.7);
                const mk = lk * 0.85, w = min(1, glow);
                cr = (INK[0] * (1 - mk) + GOLD[0] * mk) * v + w * 0.6;
                cg = (INK[1] * (1 - mk) + GOLD[1] * mk) * v + w * 0.6;
                cb = (INK[2] * (1 - mk) + GOLD[2] * mk) * v + w * 0.45;
              }
            }
          }
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const o = (y * W + x) * 3;
      buf[o] = min(255, (r / 3) * 255);
      buf[o + 1] = min(255, (g / 3) * 255);
      buf[o + 2] = min(255, (b / 3) * 255);
    }
  }
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
