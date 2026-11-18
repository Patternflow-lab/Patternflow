// ===== Patternflow pattern =====
// Title:   Kasiski Examination
// Family:  type
// Idea:    A Vigenere ciphertext fills the top of the panel as 3 by 5 capitals, 14 to a line, and one repeated run of letters after another is lit in its own colour at both of its places, joined by a rule in the margin and a count of the letters between them, while the divisors of each distance are stacked as coloured blocks in bars below, so that the key length shows as the last of the tall bars.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kasiski examination (Friedrich Kasiski, 1863; Charles Babbage earlier, unpublished), Vigenere cipher; the 3 by 5 capitals of Saccades (pattern round 106), copied from scytale.js; pattern round 108
// Round:   108
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Key=3..7, Text=0..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ciphertext is pale blue and the repeats come up orange, teal, magenta, lime, blue, red and on round the wheel, and the key length is marked in gold. The ciphertext skips orange and yellow for crimson and green so it does not read as brown.
// Knob 2: Speed. How fast the examination goes. At 2 the first repeat lights at 0.4 s and each repeat takes 1.25 s: the second place lights 0.15 s after the first, a light runs from one to the other from 0.25 s counting the letters, and the divisors drop into the bars from 0.65 s. Seven to ten repeats take 9 to 13 s, the key length is held for 2.5 s, and then the page starts again. 0.2 is ten times slower and 3 is half as fast again.
// Knob 3: Key. The length of the key the text was written with, from 3 to 7. It snaps to each whole number and writes the text again with a key word of that length, so every letter of the ciphertext changes and the examination starts over. A gap between two copies of a repeat that the key made is a multiple of that length, so the bars rise at it and at its divisors.
// Knob 4: Text. Snaps to one of four plain texts of 176 to 182 letters: 0 the cipher and its key, 1 a harbour at dawn, 2 a kitchen, 3 a letter home. Each has one key word for each length, and the panel makes the ciphertext from the two by the Vigenere rule, cipher = plain + key mod 26.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function mixc(a, b, t, out) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

// The face: capitals 3 wide and 5 tall from saccades.js by way of scytale.js, and the ten digits.
const FACE = {
  A: ".#.|#.#|###|#.#|#.#", B: "##.|#.#|##.|#.#|##.", C: ".##|#..|#..|#..|.##", D: "##.|#.#|#.#|#.#|##.", E: "###|#..|##.|#..|###",
  F: "###|#..|##.|#..|#..", G: ".##|#..|#.#|#.#|.##", H: "#.#|#.#|###|#.#|#.#", I: "###|.#.|.#.|.#.|###", J: "..#|..#|..#|#.#|.#.",
  K: "#.#|#.#|##.|#.#|#.#", L: "#..|#..|#..|#..|###", M: "#.#|###|###|#.#|#.#", N: "##.|#.#|#.#|#.#|#.#", O: ".#.|#.#|#.#|#.#|.#.",
  P: "##.|#.#|##.|#..|#..", Q: ".#.|#.#|#.#|###|.##", R: "##.|#.#|##.|#.#|#.#", S: ".##|#..|.#.|..#|##.", T: "###|.#.|.#.|.#.|.#.",
  U: "#.#|#.#|#.#|#.#|###", V: "#.#|#.#|#.#|#.#|.#.", W: "#.#|#.#|###|###|#.#", X: "#.#|#.#|.#.|#.#|#.#", Y: "#.#|#.#|.#.|.#.|.#.",
  Z: "###|..#|.#.|#..|###",
  0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|###|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###",
};
const GLYPH = {};
for (const ch of Object.keys(FACE)) GLYPH[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => (c === "#" ? 1 : 0));

// Four plain texts of 176 to 182 letters, written for this panel, and for each
// the key word of length 3, 4, 5, 6 and 7 that the text is enciphered with.
const PLAIN = [
  "AND THEN THE ENEMY STARTS READING THE LETTERS. WHEN THE KEY HAS COME ROUND AGAIN THE SAME LETTERS GET THE SAME SHIFT. THE KEY IS THE ONLY THING THE ENEMY DOES NOT HAVE. THE CODE WAS THOUGHT TO BE UNBREAKABLE FOR THREE CENTURIES.",
  "WE WILL LEAVE AT FIRST LIGHT WITH THE OUTGOING TIDE. THE WIND IS FALLING AND THE SEA IS CALMING. THE PILOT IS WATCHING THE COAST AND A STORM IS GATHERING IN THE EAST. SEVEN BOATS WENT OUT BEFORE DAWN AND SIX HAVE COME BACK.",
  "THE COOK IS TASTING THE SAUCE AND THE GUESTS ARE ARRIVING. THE KNIFE IS CUTTING THE ONION AND THE EYES ARE WATERING. STEAM CURLS OFF THE POT AND FOGS THE WINDOW OVER THE SINK. A PINCH OF SALT AND A SPOON OF HONEY GO INTO THE PAN.",
  "THE BED IS HARD BUT THE WINDOW LOOKS OVER THE ROOFS. I MET A WOMAN ON THE PLATFORM WHO KNEW YOUR SISTER. THE FIELDS WERE WET AND THE HILLS WERE GREEN AND THE SKY WAS GREY. TELL THE CHILDREN THAT THE SEA IS BIG AND THE SAND IS WARM.",
];
const KEYS = [
  ["BEE", "LAMP", "BLACK", "GARDEN", "BABBAGE"],
  ["SUN", "LAMP", "TIGER", "CIPHER", "HARVEST"],
  ["OWL", "RAIN", "RIVER", "FOREST", "BABBAGE"],
  ["ZEN", "WIND", "HOUSE", "PLANET", "CABINET"],
];

// Layout: 14 letters a line, four LEDs a letter, seven rows a line, 13 lines.
const CH = 14, X0 = 4, PX = 4, Y0 = 1, PY = 7;
const SEP = 91, RO = 94, BASE = 119, AXIS = 120, LAB = 122;
const BW = 7, bx = (n) => 1 + (n - 2) * 9;
// Time of the examination in seconds at Speed 1, for each repeat.
const T0 = 0.8, PT = 2.5, B_AT = 0.3, SW0 = 0.5, SW = 0.7, LAND = 1.3, LDT = 0.13, HOLD = 5;

// Vigenere: each letter of the text is moved on by the letter of the key under it.
function vig(plain, key) {
  let out = "";
  for (let i = 0; i < plain.length; i++) out += String.fromCharCode(65 + ((plain.charCodeAt(i) + key.charCodeAt(i % key.length) - 130) % 26));
  return out;
}

// The repeats of three letters or more. For every place, the next place that
// carries the same three letters without overlapping them is its partner. A
// place whose partner is one step on from the partner of the place before it
// is the next letter of the same run, so a run is listed once, from its start.
function repeats(c) {
  const n = c.length, at = new Map(), nx = new Array(n).fill(-1), out = [];
  for (let i = 0; i + 3 <= n; i++) {
    const t = c.substr(i, 3);
    if (!at.has(t)) at.set(t, []);
    at.get(t).push(i);
  }
  for (const L of at.values())
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length && nx[L[a]] < 0; b++) if (L[b] - L[a] >= 3) nx[L[a]] = L[b];
  for (let p = 0; p + 3 <= n; p++) {
    const q = nx[p];
    if (q < 0 || (p > 0 && nx[p - 1] === q - 1)) continue;
    let len = 3;
    while (q + len < n && c[p + len] === c[q + len] && len < q - p) len++;
    out.push({ p, q, len, gap: q - p });
  }
  return out;
}

function build(S, ti, K) {
  const plain = PLAIN[ti].replace(/[^A-Z]/g, "");
  S.cipher = vig(plain, KEYS[ti][K - 3]);
  S.reps = repeats(S.cipher);
  const N = S.reps.length;
  // The divisors of each gap from 2 to 8, and for each of those numbers the
  // repeats it divides, in the order they are found.
  S.dv = S.reps.map((r) => {
    const d = [];
    for (let n = 2; n <= 8; n++) if (r.gap % n === 0) d.push(n);
    return d;
  });
  S.stk = [];
  let top = 0;
  for (let n = 0; n <= 8; n++) {
    S.stk[n] = [];
    if (n >= 2) for (let j = 0; j < N; j++) if (S.reps[j].gap % n === 0) S.stk[n].push(j);
    top = max(top, S.stk[n].length);
  }
  S.unit = top <= 6 ? 3 : top <= 10 ? 2 : 1;
  // The answer: the largest number that divides at least three quarters as many
  // gaps as the most does. A gap that is a multiple of 6 is also a multiple of 2
  // and of 3, so for a key of 6 the bars at 2 and 3 stand as tall as the one at 6,
  // and for a key of 4 the bar at 2 does. The key is the last of the tall bars.
  S.answer = 2;
  for (let n = 2; n <= 8; n++) if (S.stk[n].length * 4 >= top * 3) S.answer = n;
  // The repeats each letter belongs to, and when in the repeat it lights.
  S.cj = [];
  S.co = [];
  for (let i = 0; i < S.cipher.length; i++) {
    S.cj.push([]);
    S.co.push([]);
  }
  S.reps.forEach((r, j) => {
    for (let m = 0; m < r.len; m++) {
      S.cj[r.p + m].push(j);
      S.co[r.p + m].push(0);
      S.cj[r.q + m].push(j);
      S.co[r.q + m].push(B_AT);
    }
  });
  S.end = T0 + N * PT + 0.3 + HOLD;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, sig: -1, t: 0, ap: 0, cipher: "", reps: [], dv: [], stk: [], unit: 3, answer: 3, cj: [], co: [], end: 1,
    buf: new Uint8Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  const K = cl(round(k[2]), 3, 7), ti = cl(round(k[3]), 0, 3), sig = ti * 10 + K;
  if (sig !== S.sig) {
    S.sig = sig;
    build(S, ti, K);
    S.t = 0;
    S.ap = 0;
  }
  S.ap += d;
  S.t += d * S.speed;
  if (S.t > S.end) {
    S.t = 0;
    S.ap = 0;
  }
}

// A dim orange or yellow reads as brown on the panel, so the ciphertext goes
// to crimson where its hue would land in orange, and to green in yellow.
function dim(h) {
  h -= floor(h);
  return h < 0.04 || h > 0.2 ? h : h < 0.12 ? 0.95 + h * 0.3 : 0.33;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.cipher) return;
  const buf = S.buf, t = S.t, h = S.hue, N = S.reps.length, n = S.cipher.length;
  buf.fill(0);
  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    buf[o] = min(255, c[0] * a * 255);
    buf[o + 1] = min(255, c[1] * a * 255);
    buf[o + 2] = min(255, c[2] * a * 255);
  };
  const glyph = (ch, x, y, c, a) => {
    const g = GLYPH[ch];
    for (let i = 0; i < 15; i++) if (g[i]) put(x + (i % 3), y + floor(i / 3), c, a);
  };
  const word = (s, x, y, c, a) => {
    for (let i = 0; i < s.length; i++) glyph(s[i], x + i * 4, y, c, a);
  };
  const WHITE = [1, 1, 1], GOLD = [0, 0, 0], INK = [0, 0, 0], TMP = [0, 0, 0], TMP2 = [0, 0, 0], PC = [];
  hsv(h + 0.13, 0.55, 1, GOLD);
  hsv(dim(h + 0.58), 0.38, 1, INK);
  for (let j = 0; j < N; j++) {
    PC.push([0, 0, 0]);
    hsv(h + 0.08 + j * 0.382, j % 2 ? 0.8 : 0.65, 1, PC[j]);
  }
  const jc = t >= T0 ? floor((t - T0) / PT) : -1; // the repeat being examined
  const live = jc >= 0 && jc < N ? S.reps[jc] : null;
  const ts = T0 + jc * PT;
  const sw = live ? (t - ts - SW0) / SW : -1;
  const cur = live && sw >= 0 ? live.p + (live.q - live.p) * min(sw, 1) : -1;
  const after = live && sw > 1 ? exp(-(sw - 1) * SW * 3) : 1;

  // The ciphertext. It is bright until the examination starts, then it drops back so the repeats stand out, and it comes up again for the answer.
  const ta = T0 + N * PT + 0.3, ans = sm((t - ta) / 0.4), basebr = 0.8 - 0.28 * sm((t - T0) / 0.5) * (1 - ans);
  for (let i = 0; i < n; i++) {
    const line = floor(i / CH), x = X0 + (i - line * CH) * PX, y = Y0 + line * PY;
    const la = cl((S.ap - line * 0.015) / 0.12, 0, 1);
    if (la <= 0) continue;
    let bj = -1, age = 0;
    for (let m = 0; m < S.cj[i].length; m++) {
      const j = S.cj[i][m], rt = T0 + j * PT + S.co[i][m];
      if (t >= rt && j > bj) {
        bj = j;
        age = t - rt;
      }
    }
    let br = basebr, c = INK;
    if (bj >= 0) {
      const f = exp(-age * 5), act = t < T0 + (bj + 1) * PT;
      mixc(PC[bj], WHITE, 0.7 * f, TMP);
      c = TMP;
      br = act ? 1 : 0.8;
      if (act) {
        // A box behind the letter in the colour of its repeat.
        const ba = (0.2 + 0.45 * f) * la;
        for (let yy = y - 1; yy <= y + 5; yy++) for (let xx = x - 1; xx <= x + 3; xx++) put(xx, yy, PC[bj], ba);
      }
    } else if (live && cur >= 0 && i >= live.p && i <= live.q && i <= cur) {
      const tr = exp(-(cur - i) / 14) * after;
      mixc(INK, PC[jc], 0.65 * tr, TMP2);
      c = TMP2;
      br = basebr + (1 - basebr) * tr;
    }
    if (live && sw > 0 && sw < 1 && i === floor(cur)) {
      c = WHITE;
      br = 1;
    }
    glyph(S.cipher[i], x, y, c, br * la);
  }

  // The rule in the margin that joins the two places of the repeat being
  // examined, or under the line when both are on one line.
  if (live) {
    const fade = 1 - sm((t - (ts + PT - 0.3)) / 0.3), gp = sm(sw), a = fade * (t > ts + B_AT ? 1 : 0.6);
    const la = floor(live.p / CH), lb = floor(live.q / CH), ca = live.p - la * CH, cb = live.q - lb * CH;
    if (fade > 0) {
      if (la === lb) {
        const gy = Y0 + la * PY, xa = X0 + ca * PX + floor((live.len * PX - 1) / 2), xb = X0 + cb * PX + floor((live.len * PX - 1) / 2);
        const xe = xa + round((xb - xa) * (sw < 0 ? 0 : gp));
        put(xa, gy + 5, PC[jc], a);
        for (let xx = xa; xx <= xe; xx++) put(xx, gy + 6, PC[jc], a);
        if (sw >= 1) put(xb, gy + 5, PC[jc], a);
      } else {
        const left = ca + cb <= 13, sx = left ? 1 : 62, tx = left ? 2 : 61;
        const ya = Y0 + la * PY + 2, yb = Y0 + lb * PY + 2, ye = ya + round((yb - ya) * (sw < 0 ? 0 : gp));
        for (let yy = ya - 1; yy <= ya + 1; yy++) {
          put(sx, yy, PC[jc], a);
          put(tx, yy, PC[jc], a);
        }
        for (let yy = ya; yy <= ye; yy++) put(sx, yy, PC[jc], a);
        if (sw >= 1)
          for (let yy = yb - 1; yy <= yb + 1; yy++) {
            put(sx, yy, PC[jc], a);
            put(tx, yy, PC[jc], a);
          }
      }
    }
  }

  // The rule under the text, then the readout: the count of letters from one
  // place to the next, a dot for each repeat, and at the end the key length.
  for (let x = 0; x < W; x++) put(x, SEP, INK, 0.22);
  if (ans > 0) {
    word("KEY", 2, RO, GOLD, ans * 0.9);
    glyph(String(S.answer), 16, RO, GOLD, ans);
  } else {
    word("GAP", 2, RO, INK, 0.5);
    let jr = -1, val = 0, ra = 1;
    if (live && sw >= 0) {
      jr = jc;
      val = round(live.gap * min(sw, 1));
    } else if (jc > 0) {
      jr = min(jc, N) - 1;
      val = S.reps[jr].gap;
      ra = 0.35;
    }
    if (jr >= 0) {
      const s = String(val);
      for (let i = 0; i < s.length; i++) glyph(s[i], 16 + i * 4, RO, PC[jr], ra);
    }
  }
  for (let j = 0; j < N; j++) {
    const on = t >= T0 + j * PT;
    for (let yy = RO + 1; yy <= RO + 3; yy++) for (let xx = 0; xx < 2; xx++) put(34 + j * 3 + xx, yy, on ? PC[j] : INK, on ? 0.9 : 0.16);
  }

  // The bars: for each number from 2 to 8, a block for each repeat whose gap it divides.
  const u = S.unit, shade = u === 3 ? [1, 0.8, 0.62] : u === 2 ? [1, 0.7] : [1];
  for (let x = 1; x < 62; x++) put(x, AXIS, INK, 0.3);
  for (let m = 2; m <= 8; m++) {
    const x0 = bx(m), isAns = m === S.answer, dm = 1 - 0.35 * ans * (isAns ? 0 : 1);
    let lf = 0, lj = -1, height = 0;
    S.stk[m].forEach((j, slot) => {
      const tl = T0 + j * PT + LAND + S.dv[j].indexOf(m) * LDT;
      if (t < tl) return;
      const ag = t - tl, f = exp(-ag * 7);
      mixc(PC[j], WHITE, 0.8 * f, TMP);
      const yb = BASE - slot * u;
      for (let r = 0; r < u; r++) for (let xx = 0; xx < BW; xx++) put(x0 + xx, yb - r, TMP, shade[u - 1 - r] * dm * cl(ag / 0.05, 0.3, 1));
      height = slot + 1;
      if (f > lf) {
        lf = f;
        lj = j;
      }
    });
    // The label: it flashes in the colour of the repeat that last fell into its bar.
    let lc = INK;
    if (isAns && ans > 0) lc = GOLD;
    else if (lj >= 0) {
      mixc(INK, PC[lj], min(1, lf * 1.4), TMP);
      lc = TMP;
    }
    glyph(String(m), x0 + 2, LAB, lc, isAns && ans > 0 ? ans : 0.45 + 0.55 * lf);
    if (isAns && ans > 0 && height > 0) {
      const yc = BASE - height * u - 1;
      for (let xx = 0; xx < BW; xx++) put(x0 + xx, yc, GOLD, ans);
    }
  }

  const o = buf;
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, o[p * 3], o[p * 3 + 1], o[p * 3 + 2]);
}
