// ===== Patternflow pattern =====
// Title:   Alberti Cipher Disk
// Family:  type
// Idea:    Two rings of capitals sit in the top square of the panel, a fixed plain alphabet outside and a turning cipher alphabet inside, and a spoke reads a message letter by letter, lighting each plain letter with the cipher letter beside it and writing both in two lines below, until a letter dropped into the text makes the inner ring turn and stop on a new setting, so that the same plain letter comes out as another cipher letter from there on.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Alberti cipher disk (Leon Battista Alberti, De cifris, c. 1467), the first polyalphabetic cipher, with the setting changed by a capital letter written into the message; the 3 by 5 capitals of Scytale (pattern round 107), copied from scytale.js; pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Index=0..25, Message=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the plain letters are gold, the cipher letters pink, a letter that sets the disk cyan, and a letter that has come back from the cipher green, on rings of dim steel blue and violet.
// Knob 2: Speed. How fast the spoke reads. At 2 a letter takes 0.42 s and a change of setting 0.9 to 1.3 s, and the second reading, which goes back from the cipher to the plain text, runs a third faster. At 0.2 it is ten times slower and at 3 half as fast again.
// Knob 3: Index. The setting the message starts on, snapped to one of the 26 plain letters: the inner ring turns until its first letter, K, stands under that plain letter, and the message begins with that letter written in cyan. It catches at each whole number. Changing it starts the message over, and only the letters before the first letter in the text that resets the disk come out differently. It opens at A.
// Knob 4: Message. Snaps to one of four texts: 0 is MEET ME AT THE BRIDGE BEFORE THE BELLS RING, 1 is the line from Hamlet, 2 is A CIPHER THAT CHANGES ITS MIND IS HARD TO READ and 3 is the opening of A Tale of Two Cities. Each has three or four letters written into it that reset the disk, so in the first text THE comes out as different letters in its two places, and in the last one TIMES does.

const W = 64, H = 128;
const { floor, round, min, max, abs, sin, cos, atan2, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const sm5 = (v) => ((v = cl(v, 0, 1)), v * v * v * (v * (6 * v - 15) + 10));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The face: capitals 3 wide and 5 tall, one string a row, from scytale.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};
const BM = {};
for (const ch of Object.keys(FACE)) BM[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

const N = 26, DL = (2 * PI) / N;
const LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// The inner alphabet, mixed once from a fixed seed (1467, the year De cifris
// is dated to), with K first: K is the mark that Alberti set under the
// capital that names the setting. Inner cell j stands under plain letter j + s.
const INNER = "KXUJZVDGNHSIACEORTLBMYFQWP";

// Four texts, a line each way as the panel writes it. A letter in braces is
// written into the text to reset the disk: the capital that names the new
// setting. Every text starts with one more, the Index knob's. A line is at
// most 14 columns, and a reset takes one.
const MSG = [
  ["MEET ME AT{R}", "THE BRI{F}DGE", "BEFORE{N} THE", "BELLS{K} RING"],
  ["TO BE OR NOT{M}", "TO BE{Q} THAT IS", "THE{D} QUESTION"],
  ["A CIPHER THAT", "{T}CHANGES ITS", "MIND{G} IS HARD", "TO{L} READ"],
  ["IT WAS THE{P}", "BEST OF{X} TIMES", "IT WAS{B} THE", "WORST OF TIMES"],
].map((lines) => {
  const T = [{ k: "I", ch: "A", col: 0, row: 0 }];
  lines.forEach((ln, row) => {
    let col = row ? 0 : 1;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i];
      if (c === "{") T.push({ k: "I", ch: ln[i + 1], col: col++, row }), (i += 2);
      else T.push({ k: c === " " ? "S" : "L", ch: c, col: col++, row });
    }
  });
  return { T, rows: lines.length };
});

// The whole cipher: what each token comes out as, and the setting s it is
// read at. A letter at plain position p stands over inner cell (p - s) mod 26,
// and a capital resets s to its own position.
function crypt(M, s0) {
  let s = s0;
  return M.T.map((t, i) => {
    if (t.k === "S") return { c: " ", s, j: -1, p: -1 };
    if (t.k === "I") {
      s = i ? LET.indexOf(t.ch) : s0;
      return { c: LET[s], s, j: -1, p: s };
    }
    const p = LET.indexOf(t.ch), j = (((p - s) % N) + N) % N;
    return { c: INNER[j], s, j, p };
  });
}

const CX = 32, CY = 32, R1 = 28.5, R2 = 22; // the two rings, to the centres of their letters
const TX = 4, TY = 69; // column 0 and the first plain row of the lines below
const LS = 14; // rows from one pair of lines to the next

// A letter centred exactly on a half LED goes the same way each time: sin of a
// whole turn is not quite 0, and the letter would sit one LED to the left of
// the one above it.
const snap = (v) => floor(v + 0.5 + 1e-4);
// A dim orange or yellow reads as brown on the panel, so the faces of the disk
// go to crimson where their hue would land in orange, and to green in yellow.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}
const signed = (d) => ((((d + 13) % N) + N) % N) - 13;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, msg: -1, i0: -1, C: null, k: 0, tm: 0, began: false, stage: 0, st: 0,
    ra: 0, rFrom: 0, rTo: 0, na: 0, nFrom: 0, nTo: 0, nd: 0.3, rd: 1,
    GO: new Float32Array(N), GI: new Float32Array(N), GX: new Float32Array(N), gm: 0, nv: 0.3, pf: 1, fa: 1,
    tc: new Float32Array(64).fill(-1), tp: new Float32Array(64).fill(-1),
    cp: "A", cq: "A", cx: "A", ca: 0, cb: 0, cxa: 0, ep: 0, fresh: true,
    buf: new Uint8Array(W * H * 3),
  };
}

function restart(S) {
  S.k = 0;
  S.began = false;
  S.stage = 0;
  S.st = 0;
  S.tc.fill(-1);
  S.tp.fill(-1);
  S.fa = 1;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const msg = cl(round(k[3]), 0, 3), i0 = cl(round(k[2]), 0, 25);
  if (msg !== S.msg || i0 !== S.i0) {
    // A new text or a new first setting starts the message over. The very
    // first time the inner ring is left nine places off, so it turns.
    if (S.fresh) S.ra = S.na = (i0 + 9) % N;
    S.fresh = false;
    S.msg = msg;
    S.i0 = i0;
    S.C = crypt(MSG[msg], i0);
    restart(S);
  }
  const M = MSG[msg], C = S.C, n = M.T.length, g = exp(-d * 1.7);
  for (let i = 0; i < N; i++) {
    S.GO[i] *= g;
    S.GI[i] *= g;
    S.GX[i] *= g;
  }
  S.gm *= g;
  S.ca *= exp(-d * 2.2);
  S.cb *= exp(-d * 2.2);
  S.cxa *= exp(-d * 2.2);
  for (let i = 0; i < n; i++) {
    if (S.tc[i] >= 0) S.tc[i] += d;
    if (S.tp[i] >= 0) S.tp[i] += d;
  }
  const dec = S.stage === 2, active = S.stage === 0 || dec;
  if (active) {
    S.pf = dec ? 0 : min(1, S.pf + d * 2);
    while (S.k < n && M.T[S.k].k === "S") S.k++;
    if (S.k >= n) {
      S.stage++;
      S.st = 0;
    } else {
      const t = M.T[S.k], c = C[S.k];
      if (!S.began) {
        S.began = true;
        S.tm = 0;
        S.nFrom = S.na;
        S.nTo = c.p;
        const dn = signed(c.p - S.na);
        if (t.k === "I") {
          S.nd = 0.45;
          S.rFrom = S.ra;
          S.rTo = c.s;
          S.rd = 0.9 + 0.08 * abs(signed(c.s - S.ra));
          S.cx = LET[c.s];
          S.ca = S.cb = 0;
        } else {
          S.nd = 0.3 + 0.01 * abs(dn);
          S.cp = t.ch;
          S.cq = c.c;
          S.cxa = 0;
        }
        S.ep = 0;
      }
      S.tm += d * S.speed * (dec ? 1.35 : 1);
      const dn = signed(S.nTo - S.nFrom);
      S.na = S.nFrom + dn * sm5(S.tm / S.nd);
      S.nv = min(1, S.nv + d * 6);
      const u = S.tm;
      if (t.k === "I") {
        const ru = (u - 0.2) / S.rd, dr = signed(S.rTo - S.rFrom);
        S.ra = S.rFrom + dr * sm5(ru);
        const lx = sm((u - 0.1) / 0.25);
        S.GX[c.p] = max(S.GX[c.p], lx);
        S.gm = max(S.gm, lx);
        S.cxa = max(S.cxa, lx);
        const ta = 0.2 + S.rd;
        if (u >= ta && !S.ep) {
          S.ep = 1;
          S.ra = c.s;
          (dec ? S.tp : S.tc)[S.k] = 0;
        }
        if (u >= ta + 0.5) (S.k++, (S.began = false));
      } else {
        const ua = u - S.nd, a = sm(ua / 0.1), b = sm((ua - 0.1) / 0.12);
        const lo = dec ? b : a, li = dec ? a : b;
        S.GO[c.p] = max(S.GO[c.p], lo);
        S.GI[c.j] = max(S.GI[c.j], li);
        S.ca = max(S.ca, lo);
        S.cb = max(S.cb, li);
        if (ua >= 0.2 && !S.ep) {
          S.ep = 1;
          (dec ? S.tp : S.tc)[S.k] = 0;
        }
        if (ua >= 0.46) (S.k++, (S.began = false));
      }
    }
  } else {
    S.st += d;
    S.nv = max(0.25, S.nv - d * 1.5);
    if (S.stage === 1) {
      S.pf = cl((1.7 - S.st) / 0.5, 0, 1);
      if (S.st >= 1.8) (S.stage = 2, (S.k = 0), (S.began = false));
    } else if (S.stage === 3) {
      if (S.st >= 3.5) (S.stage = 4, (S.st = 0));
    } else {
      S.fa = cl(1 - S.st / 0.7, 0, 1);
      if (S.st >= 0.8) restart(S);
    }
  }
}

function plot(buf, x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) {
    const q = c[i] * v * 255;
    if (q > buf[o + i]) buf[o + i] = q > 255 ? 255 : q;
  }
}

// One letter at LED position (x0, y0), turned by rot quarter turns clockwise
// (0 stands up, 1 has its top to the right, 2 upside down, 3 to the left) and
// drawn sc LEDs to a cell. A quarter turn moves cells and never smears them.
function blit(buf, ch, x0, y0, rot, sc, c, v) {
  const gl = BM[ch];
  if (!gl || v <= 0) return;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (!gl[row * 3 + col]) continue;
      const px = rot === 0 ? col : rot === 1 ? 4 - row : rot === 2 ? 2 - col : row;
      const py = rot === 0 ? row : rot === 1 ? col : rot === 2 ? 4 - row : 2 - col;
      for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) plot(buf, x0 + px * sc + a, y0 + py * sc + b, c, v);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.C) return;
  const buf = S.buf, h = S.hue, M = MSG[S.msg], C = S.C, n = M.T.length;
  buf.fill(0);
  const GOLD = hsv(h + 0.12, 0.55, 1), PINK = hsv(h + 0.9, 0.55, 1), CYAN = hsv(h + 0.5, 0.4, 1), GREEN = hsv(h + 0.33, 0.6, 1);
  const STEEL = hsv(h + 0.58, 0.45, 0.7), VIOLET = hsv(h + 0.76, 0.35, 0.88), IXD = hsv(h + 0.5, 0.5, 0.5), WHITE = hsv(h + 0.12, 0.12, 1);
  const dec = S.stage >= 2 && S.stage <= 3 ? 1 : 0;

  // The faces of the disk: a steel ring outside, a violet one inside that is
  // brightest at K, and a floor under the middle that shades from blue to
  // violet, both turning with the inner ring, so a reset shows from across the
  // room where no letter is large enough to follow.
  const ra = S.ra * DL;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
      if (r > 32) continue;
      if (r > 25.5) plot(buf, x, y, hsv(dim(h + 0.58), 0.5, 1), 0.14);
      else if (r > 24.9) plot(buf, x, y, WHITE, 0.2);
      else if (r > 18.6) {
        const t = 0.5 + 0.5 * cos(atan2(dx, -dy) - ra);
        plot(buf, x, y, hsv(dim(h + 0.74 + 0.08 * t), 0.55, 1), 0.04 + 0.5 * t);
      } else if (r < 18.2) {
        const u = atan2(dx, -dy) - ra;
        plot(buf, x, y, hsv(dim(h + 0.64 + 0.2 * sin(u)), 0.7, 1), 0.1 + 0.3 * (0.5 + 0.5 * sin(u)));
      }
    }
  }
  const na = S.na * DL;
  // The outer ring: the plain alphabet, standing up, the same at every setting.
  for (let p = 0; p < N; p++) {
    const a = p * DL, x0 = snap(CX + R1 * sin(a) - 1.5), y0 = snap(CY - R1 * cos(a) - 2.5);
    let c = STEEL;
    c = mix(c, dec && S.GO[p] > 0 ? GREEN : GOLD, S.GO[p]);
    c = mix(c, CYAN, S.GX[p]);
    blit(buf, LET[p], x0, y0, 0, 1, c, 1);
  }
  // The inner ring: the cipher alphabet, its letters turned so their tops
  // point outward, to the nearest quarter turn, except at the bottom, where
  // they stand up: M and W are the same shape upside down.
  for (let j = 0; j < N; j++) {
    const a = (j + S.ra) * DL, q = floor((a / (2 * PI)) * 4 + 0.5), r4 = ((q % 4) + 4) % 4, rot = r4 === 2 ? 0 : r4;
    const cx = CX + R2 * sin(a), cy = CY - R2 * cos(a), tall = rot % 2 === 0;
    const x0 = snap(cx - (tall ? 1.5 : 2.5)), y0 = snap(cy - (tall ? 2.5 : 1.5));
    let c = j === 0 ? mix(VIOLET, IXD, 0.9) : VIOLET;
    c = mix(c, PINK, S.GI[j]);
    if (j === 0) c = mix(c, CYAN, S.gm);
    blit(buf, INNER[j], x0, y0, rot, 1, c, 1);
  }
  // The spoke.
  for (let r = 15.5; r < 18.2; r += 0.5) plot(buf, floor(CX + r * sin(na)), floor(CY - r * cos(na)), WHITE, 0.85 * S.nv);

  // What the spoke reads, large in the middle: the plain letter over the cipher
  // letter, or the capital that sets the disk.
  if (S.cxa > 0.02) blit(buf, S.cx, CX - 4, CY - 7, 0, 3, CYAN, S.cxa);
  if (S.ca > 0.02 || S.cb > 0.02) {
    // Left to right in the order it is read: plain to cipher, or back.
    blit(buf, dec ? S.cq : S.cp, CX - 12, CY - 7, 0, 3, dec ? PINK : GOLD, dec ? S.cb : S.ca);
    blit(buf, dec ? S.cp : S.cq, CX + 2, CY - 7, 0, 3, dec ? GREEN : PINK, dec ? S.ca : S.cb);
    const aw = 0.6 * min(S.ca, S.cb);
    for (let a = -3; a <= 1; a++) plot(buf, CX + a, CY, WHITE, aw);
    plot(buf, CX, CY - 1, WHITE, aw);
    plot(buf, CX, CY + 1, WHITE, aw);
  }

  // The two lines: plain over cipher, a pair of lines for each row of the
  // text, set in the middle of the lower square.
  const y1 = TY + ((4 - M.rows) * LS) / 2, fa = S.fa;
  for (let i = 0; i < n; i++) {
    const t = M.T[i];
    if (t.k === "S") continue;
    const x0 = TX + 4 * t.col, yp = y1 + LS * t.row, yc = yp + 6, cur = (S.stage === 0 || S.stage === 2) && i === S.k;
    const written = S.tc[i] >= 0, back = S.tp[i] >= 0, ix = t.k === "I";
    // The plain line: grey as written down, gold as it is read, green as it comes back.
    let pc = STEEL, pv = S.pf;
    if (written) pc = mix(pc, ix ? CYAN : GOLD, S.pf);
    if (back) (pc = ix ? CYAN : GREEN), (pv = 1);
    if (pv > 0) {
      const flash = back ? exp(-S.tp[i] * 5) : written ? exp(-S.tc[i] * 5) : 0, pvv = fa * min(1, (back || written ? 0.78 : 0.9) + flash * 0.3);
      if (ix) for (const [a, b] of [[1, 3], [0, 4], [2, 4]]) plot(buf, x0 + a, yp + b, pc, pvv * pv);
      else blit(buf, t.ch, x0, yp, 0, 1, pc, pvv * pv);
    }
    if (written) {
      const flash = exp(-S.tc[i] * 5), hot = cur && dec ? 0.5 : 0, base = ix ? CYAN : PINK;
      blit(buf, C[i].c, x0, yc, 0, 1, mix(base, WHITE, min(1, flash * 0.5 + hot)), fa * min(1, 0.8 + flash * 0.3));
    }
  }
  const o = buf;
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, o[p * 3], o[p * 3 + 1], o[p * 3 + 2]);
}
