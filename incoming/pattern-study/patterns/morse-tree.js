// ===== Patternflow pattern =====
// Title:   Morse Tree
// Family:  type
// Idea:    A message is keyed in International Morse and a lamp walks each letter down the binary tree that stands on the tall panel with its root at the top, left for a dit and right for a dah, lighting the node it stops on and writing that letter into the decoded lines above, while a paper tape along the top shows the same dots and dashes in the exact 1 to 3 beat.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: International Morse code and its dichotomic (binary tree) table (Samuel Morse and Alfred Vail, 1830s-40s; international form 1851/1865), with the timing of ITU-R M.1677 (dit 1, dah 3, gaps 1, 3 and 7 units); the 3 by 5 capitals of Scytale (pattern round 107), copied from scytale.js; pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..3, Message=0..3, Reading=0..2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a dit is cyan, a dah pink, the unlit tree steel blue and the decoded text cream.
// Knob 2: Speed. How fast the key goes, as words a minute: 4 times the knob, so 2 is 8 words a minute with a unit of 0.15 s, a dit 0.15 s, a dah 0.45 s, a letter gap 0.45 s and a word gap 1.05 s. 0.5 is 2 words a minute and 3 is 12. The unlit tree brightens while the key is down, so the whole table blinks in the beat.
// Knob 3: Message. Snaps to one of four texts: 0 the call CQ CQ CQ DE PATTERNFLOW K, 1 SOS three times, 2 the first telegram, WHAT HATH GOD WROUGHT, 3 the pangram THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG. Each has its own tint of the unlit tree and the decoded lines. The panel opens on text 0 already 6 s into it, so a letter is being keyed from the first frame; a text chosen with the knob starts from its first mark after 2.5 units of quiet.
// Knob 4: Reading. Snaps to one of three ways of showing the walk: 0 keeps the whole route from the root lit until the letter is read, 1 lights only the branch being keyed and the lamp's node on a brighter table, and 2 all but blacks out the table and lets every node the message has touched stay lit in a wider plate and fade over fourteen seconds, so the text paints its own letters on the tree.

const W = 64, H = 128;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// A dim orange or yellow reads as brown on the panel, so the unlit tree and the
// plates of lit nodes go to crimson where their hue would land in orange, and
// to green in yellow.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE = [1, 1, 1];
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const GREY = [0.8, 0.82, 0.9];

// The face: capitals 3 wide and 5 tall, one string a row, from scytale.js.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// International Morse, the 26 capitals. A dit steps to the left child of the
// tree and a dah to the right, so a letter's code is its address.
const CODE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--",
  N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
};

// The tree in heap order: node 0 is the root, node n has its dit at 2n + 1 and
// its dah at 2n + 2, and depth d holds 2^d nodes. Depth 4 stands on the 16
// columns of 4 LEDs, so a node is centred over the middle of its leaves.
const NN = 31, Y0 = 34, SP = 22;
const PW = [0, 5, 4, 3, 1]; // half the width of a lit node's plate, by depth
const D = [], X = [], Y = [], LET = [];
for (let id = 0; id < NN; id++) {
  const d = 31 - Math.clz32(id + 1), i = id + 1 - (1 << d);
  D.push(d);
  X.push((i << (6 - d)) + (1 << (5 - d)) - 1);
  Y.push(Y0 + SP * d);
}
for (const ch of Object.keys(CODE)) {
  let id = 0;
  for (const s of CODE[ch]) id = 2 * id + (s === "-" ? 2 : 1);
  LET[id] = ch;
}
// The branch to node id: down from the parent, across, down into the child.
// The pixels run from the parent end to the child end.
const EX = [], EY = [];
for (let id = 1; id < NN; id++) {
  const p = (id - 1) >> 1, xa = X[p], xb = X[id], ya = Y[p] + 5, yb = Y[id] - 5, ym = round((ya + yb) / 2);
  const px = [], py = [];
  for (let y = ya; y <= ym; y++) (px.push(xa), py.push(y));
  for (let x = xa + (xb > xa ? 1 : -1); x !== xb; x += xb > xa ? 1 : -1) (px.push(x), py.push(ym));
  for (let y = ym; y <= yb; y++) (px.push(xb), py.push(y));
  EX[id] = px;
  EY[id] = py;
}

// Four texts, a line each way as the decoded text is written, 14 columns at
// most. A tint moves the unlit tree and the decoded line round the wheel.
const MSG = [
  [["CQ CQ CQ", "DE PATTERNFLOW", "K"], 0],
  [["SOS SOS SOS"], 0.3],
  [["WHAT HATH GOD", "WROUGHT"], -0.2],
  [["THE QUICK", "BROWN FOX", "JUMPS OVER THE", "LAZY DOG"], 0.55],
].map(([lines, tint]) => build(lines, tint));

// The key, in units: a dit 1, a dah 3, 1 between the marks of a letter, 3
// between letters and 7 between words. A line break stands for a space.
function build(lines, tint) {
  const seq = [], keys = [], ev = [];
  let end = 0, gap = false;
  lines.forEach((ln, li) => {
    if (li) gap = true;
    for (let col = 0; col < ln.length; col++) {
      const ch = ln[col];
      if (ch === " ") {
        gap = true;
        continue;
      }
      const code = CODE[ch], a0 = seq.length ? end + (gap ? 7 : 3) : 0, syms = [], path = [0];
      let a = a0, id = 0;
      gap = false;
      for (let k = 0; k < code.length; k++) {
        const dah = code[k] === "-", d = dah ? 3 : 1;
        id = 2 * id + (dah ? 2 : 1);
        syms.push({ a, d });
        path.push(id);
        keys.push([a, d, dah ? 1 : 0]);
        ev.push({ t: a + 1, type: 0, id }, { t: a + d, type: 1, id });
        end = a + d;
        a += d + 1;
      }
      const rd = end + 1.5;
      ev.push({ t: rd, type: 2, id });
      seq.push({ ch, line: li, col, a: a0, syms, path, rd, hm: end + 3 });
    }
  });
  for (let i = 0; i + 1 < seq.length; i++) seq[i].hm = seq[i + 1].a;
  ev.sort((p, q) => p.t - q.t);
  const first = lines.map((_, li) => seq.findIndex((s) => s.line === li));
  return { lines, tint, seq, keys, ev, first, total: end + 3 + 14 };
}

// How the walk is shown: the table's brightness, how long a lit node or branch
// takes to fade once it is let go (seconds), and whether the whole route stays
// lit while the letter is keyed.
const MODE = [
  { gh: 1, tau: 1, route: true },
  { gh: 1.4, tau: 0.3, route: false },
  { gh: 0.1, tau: 14, route: true },
];
const LEAD = 2.5; // units of quiet before the first mark
const PRE = 6; // seconds the first text has been on the air when the panel opens
const TX = 64, TY = 23; // the tape's right edge and top row; a unit is 2 LEDs
const LY = [2, 9, 16]; // top rows of the decoded lines, the newest last

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, msg: -1, mode: 0, t: 0, u: -LEAD, uS: 0.15, kv: 0, ai: -1, ep: 0, nr: 0, kp: 0,
    lvN: new Float32Array(NN), lvE: new Float32Array(NN), fl: new Float32Array(NN),
    buf: new Float32Array(W * H * 3),
  };
}

function restart(S) {
  S.u = -LEAD;
  S.ai = -1;
  S.ep = 0;
  S.nr = 0;
  S.kp = 0;
  S.lvN.fill(0);
  S.lvE.fill(0);
  S.fl.fill(0);
  S.kv = 0;
}

// The letter the key is on at unit u, and how many of its marks have begun.
function state(S) {
  const M = MSG[S.msg], L = S.ai >= 0 && S.u < M.seq[S.ai].hm ? M.seq[S.ai] : null;
  let k = 0;
  if (L) while (k < L.syms.length && L.syms[k].a <= S.u) k++;
  return { M, L, k };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kn[0], 0, 1);
  S.speed = cl(kn[1], 0.5, 3);
  S.mode = cl(round(kn[3]), 0, 2);
  const msg = cl(round(kn[2]), 0, 3);
  S.uS = 0.3 / S.speed;
  if (msg !== S.msg) {
    // The first text is already on the air when the panel is switched on: the
    // key is run silently up to the middle of the message. A text chosen with
    // the knob starts from its first mark.
    const first = S.msg < 0;
    S.msg = msg;
    restart(S);
    if (first) while (S.t < PRE) step(S, 1 / 30);
  }
  step(S, d);
}

function step(S, d) {
  S.t += d;
  S.u += d / S.uS;
  const M = MSG[S.msg], md = MODE[S.mode];
  if (S.u > M.total) restart(S);
  const u = S.u;
  // Everything lit lets go at the pace of the reading.
  const dn = exp(-d / md.tau), df = exp(-d / 0.3);
  for (let i = 0; i < NN; i++) {
    S.lvN[i] *= dn;
    S.lvE[i] *= dn;
    S.fl[i] *= df;
  }
  // The key's events: a lamp arrives at a node, a mark ends, a letter is read.
  while (S.ep < M.ev.length && M.ev[S.ep].t <= u) {
    const e = M.ev[S.ep++];
    if (e.type === 0) S.lvN[e.id] = 1;
    else if (e.type === 1) S.lvE[e.id] = 1;
    else {
      S.fl[e.id] = 1;
      S.nr++;
    }
  }
  while (S.ai + 1 < M.seq.length && M.seq[S.ai + 1].a <= u) S.ai++;
  while (S.kp < M.keys.length && M.keys[S.kp][0] <= u) S.kp++;
  // The route and the lamp's node are held, not left to fade.
  const { L, k } = state(S);
  const keyed = L ? u < L.syms[k - 1].a + L.syms[k - 1].d : false;
  S.kv += ((keyed ? 1 : 0) - S.kv) * min(1, d * (keyed ? 25 : 12));
  if (L) {
    const key = keyed;
    for (let j = 1; j <= k; j++) {
      const arrived = u >= L.syms[j - 1].a + 1;
      if (md.route && u < L.rd) {
        if (j < k || !key) S.lvE[L.path[j]] = 1;
        if (arrived) S.lvN[L.path[j]] = 1;
      } else if (j === k && arrived) S.lvN[L.path[j]] = 1;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.msg < 0) return;
  const buf = S.buf, { M, L, k } = state(S), md = MODE[S.mode], h = S.hue, u = S.u, tn = M.tint;
  buf.fill(0);
  const put = (x, y, c, v) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3, r = c[0] * v, g = c[1] * v, b = c[2] * v;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  const cDit = hsv(dim(h + 0.5), 0.85, 1), cDah = hsv(dim(h + 0.93), 0.8, 1);
  const cTree = hsv(dim(h + 0.6 + tn), 0.85, 1), cText = hsv(h + 0.14 + tn, 0.45, 1);
  const key = L ? u < L.syms[k - 1].a + L.syms[k - 1].d : false;
  const cur = L ? L.syms[k - 1] : null;
  const front = key ? min(1, u - cur.a) : -1;
  const aId = L ? L.path[k] : -1;
  const pk = 1 + 1.1 * S.kv, gL = 0.58 * md.gh * pk, gE = 0.36 * md.gh * pk;
  const glyph = (ch, x0, y0, c) => {
    const g = GLYPH[ch];
    for (let i = 0; i < 15; i++) if (g[i]) put(x0 + (i % 3), y0 + floor(i / 3), c, 1);
  };

  // Branches: the unlit tree, then the lit parts over it.
  for (let id = 1; id < NN; id++) {
    const px = EX[id], py = EY[id], len = px.length, lit = id & 1 ? cDit : cDah, lv = S.lvE[id];
    const act = id === aId && key ? front : -1;
    for (let j = 0; j < len; j++) {
      const t = act >= 0 && j <= act * (len - 1) ? 1 : lv;
      put(px[j], py[j], mix(scale(cTree, gE), lit, t), 1);
      if (t > 0.05) for (const [dx, dy] of NB) put(px[j] + dx, py[j] + dy, lit, 0.22 * t);
    }
    if (act > 0 && act < 1) {
      const jh = round(act * (len - 1));
      for (let q = 0; q < 3; q++) if (jh - q >= 0) put(px[jh - q], py[jh - q], mix(lit, WHITE, 0.9 - q * 0.3), 1);
    }
  }
  // Letters: the table, with a lit box and a white-hot letter where the lamp has been.
  for (let id = 1; id < NN; id++) {
    const x = X[id], y = Y[id], n = S.lvN[id], f = S.fl[id], lit = id & 1 ? cDit : cDah;
    if (LET[id] === undefined) {
      put(x, y, cTree, gL * 0.7);
      continue;
    }
    if (n > 0.03) {
      const hw = PW[D[id]] + (S.mode === 2 && D[id] < 3 ? 2 : 0), bx0 = x - hw, bx1 = x + hw + (D[id] === 4 ? 1 : 0);
      for (let by = y - 3; by <= y + 3; by++) for (let bx = bx0; bx <= bx1; bx++) put(bx, by, mix(lit, WHITE, 0.15), (S.mode === 2 ? 0.56 : 0.42) * n);
    }
    glyph(LET[id], x - 1, y - 2, mix(mix(scale(cTree, gL), mix(lit, WHITE, 0.6), n), WHITE, f));
  }
  // The root is the lamp: a ring while the key is up, and while it is down a
  // disc in the colour of the mark with a glow round it.
  const rc = key ? (cur.d === 3 ? cDah : cDit) : cTree, cx = X[0], cy = Y[0];
  for (let y = cy - 8; y <= cy + 8; y++)
    for (let x = cx - 8; x <= cx + 8; x++) {
      const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (key) put(x, y, rc, r <= 4 ? 1 : 0.34 * exp(-(r - 4) / 2.2) * (r < 8.5 ? 1 : 0));
      else if (r > 3 && r <= 4) put(x, y, rc, 0.45);
    }

  // The tape: marks come in at the right edge and run left, 2 LEDs a unit.
  for (let x = 0; x < W; x++) put(x, TY + 4, cTree, x & 1 ? 0.12 : 0.2);
  for (let j = M.keys.length ? min(S.kp, M.keys.length) - 1 : -1; j >= 0; j--) {
    const [a, dd, dah] = M.keys[j], e = min(a + dd, u);
    if ((u - e) * 2 > W) break;
    const x0 = TX - (u - a) * 2, x1 = TX - (u - e) * 2, c = dah ? cDah : cDit;
    for (let x = max(0, Math.ceil(x0 - 0.5)); x < Math.ceil(x1 - 0.5); x++) {
      for (let q = 0; q < 4; q++) put(x, TY + q, c, 1);
    }
  }

  // The decoded text: the line being written and the two before it, which
  // go grey as they rise.
  const cl0 = S.ai >= 0 ? M.seq[S.ai].line : 0;
  for (let r = 0; r < 3; r++) {
    const li = cl0 - 2 + r;
    if (li < 0) continue;
    for (let i = M.first[li]; i < M.seq.length && M.seq[i].line === li; i++) {
      const s = M.seq[i];
      if (i >= S.nr) break;
      const age = (u - s.rd) * S.uS, c = mix(cText, WHITE, exp(-age / 0.4));
      glyph(s.ch, 4 + 4 * s.col, LY[r], r === 2 ? c : scale(mix(c, GREY, 0.6), r ? 0.7 : 0.45));
    }
  }
  if (S.ai >= 0 && S.ai < M.seq.length && floor(S.t * 2.5) % 2 === 0) {
    const s = M.seq[S.ai], c = s.col + (S.nr > S.ai ? 1 : 0);
    for (let q = 0; q < 3; q++) put(4 + 4 * c + q, LY[2] + 6, cText, 1);
  }

  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, min(255, buf[o] * 255), min(255, buf[o + 1] * 255), min(255, buf[o + 2] * 255));
  }
}

function scale(c, v) {
  return [c[0] * v, c[1] * v, c[2] * v];
}
