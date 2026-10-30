// ===== Patternflow pattern =====
// Title:   Reed-Solomon
// Family:  data
// Idea:    A word becomes a real version 1 QR code, 21 modules of 3 LEDs, its codewords standing above as columns of bits, data and error correction in two colours, the bits snaking into the symbol from the bottom right and the mask swept over them; then a scratch, a blot or a bite spoils part of it, the decoder lights the syndromes and finds the bad codewords by Berlekamp-Massey, Chien search and Forney's formula, and if they are at most half the error correction codewords the spoiled modules flash back, otherwise the count turns red.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Reed-Solomon codes (Irving S. Reed and Gustave Solomon, 1960) in a version 1 QR code (Masahiro Hara, Denso Wave, 1994), decoded with the Berlekamp-Massey algorithm (Elwyn Berlekamp, 1968; James Massey, 1969), Chien search (Robert Chien, 1964) and Forney's formula (G. David Forney, 1965), pattern round 74
// Round:   74
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Damage=8..60, Data=9..19
//
// Knob 1: Hue. Turns data, error correction and damage round the wheel together, a quarter turn or more apart: cyan, violet and red at 0; red, yellow-green and cyan-blue at 0.5. Finders stay warm white, format bits pale gold.
// Knob 2: Speed. At 2 a word takes 10.9 s: set and computed 1.2 s, placed 1.8 s, masked 0.6 s, held 0.6 s, spoiled 0.5 s, read 0.7 s, errors found 0.8 s, repaired 1 s, held 3.2 s, cleared 0.5 s. The first word opens with its bits placed, just before the mask. At 0.2 each step takes ten times as long, at 3 two thirds.
// Knob 3: Damage. The spoiled area, 8 to 60 square modules, times a random 0.7 to 1.5 a word. A blot makes modules dark, a bite out of an edge and a scratch 1.2 modules wide make them light. At 8 a hurt mostly spoils 0 to 4 codewords and H, Q and M mend 996 in 1000. At 60 a blot 4.4 modules in radius spoils 2 to 11: H mends 74 percent, M 47, L 19. A scratch spoils only 2 to 7, crossing codewords 2 modules wide.
// Knob 4: Data. How many of the 26 codewords carry the word, and so the level: 9 is H (17 error correction codewords, mends 8), 13 is Q (13, mends 6), 16 is M (10, mends 5), 19 is L (7, mends 3). A syndrome cell for each error correction codeword, a budget slot for each one it mends. A new level rebuilds the symbol at once.
// Buttons: K1 tap spoils the finished symbol again with the next hurt.

// A version 1 QR code holds 26 codewords of 8 bits. The first k carry the
// word in alphanumeric mode, padded with 236 and 17; the other n = 26 - k are
// the remainder of that polynomial times x^n divided by
// g(x) = (x - a^0)...(x - a^(n-1)) over GF(256), a = 2, built on 0x11D. So
// what is read, taken at a^0 ... a^(n-1), gives n syndromes that are all zero
// unless something changed. From them Berlekamp-Massey finds the shortest
// error locator, Chien search tries every position for its roots and
// Forney's formula gives the value to XOR back: up to n / 2 codewords. The
// QR standard trusts fewer at version 1 (2, 4, 6, 8 for L, M, Q, H) and
// keeps the rest against misreading; their budget slots are dimmer.
//
// The decoder reads the symbol as a scanner does once it has found it: the
// two copies of the 15 format bits, the nearest valid one (within 3 bits),
// the mask it names, then the 208 data modules in zig-zag order.

const W = 64, H = 128, N = 21, SX = 1, SY = 38, CY = 11, TY = 1;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- GF(256) on 0x11D, a = 2.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = EXP[i + 255] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const div = (a, b) => (a ? EXP[LOG[a] + 255 - LOG[b]] : 0);

// Remainder of data(x) x^n mod g(x), highest power first.
function rsRemainder(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const h = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) (h[j] ^= g[j]), (h[j + 1] ^= mul(g[j], EXP[i]));
    g = h;
  }
  const rem = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < n; i++) rem[i] ^= mul(g[i + 1], f);
  }
  return rem;
}
// The received polynomial at a^0 ... a^(n-1).
const syndromes = (cw, n) => Array.from({ length: n }, (_, j) => cw.reduce((v, c) => mul(v, EXP[j]) ^ c, 0));
// Berlekamp-Massey: the shortest LFSR (error locator, lowest power first)
// that generates the syndromes.
function berlekamp(S) {
  let C = [1], B = [1], L = 0, m = 1, b = 1;
  for (let k = 0; k < S.length; k++) {
    let d = S[k];
    for (let i = 1; i <= L; i++) d ^= mul(C[i] || 0, S[k - i]);
    if (!d) { m++; continue; }
    const T = C.slice(), coef = div(d, b);
    for (let i = 0; i < B.length; i++) C[i + m] = (C[i + m] || 0) ^ mul(coef, B[i]);
    if (2 * L <= k) (L = k + 1 - L), (B = T), (b = d), (m = 1);
    else m++;
  }
  return { C, L };
}
// Codeword i is the coefficient of x^(25 - i). Returns the syndromes, the
// codewords found wrong, the mended codewords and whether it worked.
function rsDecode(cw, n) {
  const S = syndromes(cw, n), out = { S, errs: [], fixed: cw.slice(), ok: true };
  if (S.every((v) => !v)) return out;
  const { C, L } = berlekamp(S);
  out.ok = false;
  if (L > n >> 1) return out;
  // Chien search: position p is wrong where the locator vanishes at a^-p.
  const ps = [];
  for (let p = 0; p < 26; p++) {
    let v = 0;
    for (let i = 0; i < C.length; i++) v ^= mul(C[i], EXP[(255 - ((p * i) % 255)) % 255]);
    if (!v) ps.push(p);
  }
  out.errs = ps.map((p) => 25 - p);
  if (ps.length !== L) return out;
  // Forney: e = X Omega(1/X) / Lambda'(1/X), Omega = S Lambda mod x^n.
  const Om = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j <= i && j < C.length; j++) Om[i] ^= mul(C[j], S[i - j]);
  for (const p of ps) {
    const xi = EXP[(255 - p) % 255];
    let om = 0, dl = 0;
    for (let i = n - 1; i >= 0; i--) om = mul(om, xi) ^ Om[i];
    for (let i = 1; i < C.length; i += 2) dl ^= mul(C[i], EXP[(LOG[xi] * (i - 1)) % 255]);
    if (!dl) return out;
    out.fixed[25 - p] ^= mul(EXP[p], div(om, dl));
  }
  out.ok = syndromes(out.fixed, n).every((v) => !v);
  return out;
}

// ---- The message, in alphanumeric mode.
const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const WORDS = ["REED", "SOLOMON", "GALOIS", "SYNDROME", "LIGHT", "KNOB", "PATTERN", "ERASURE"];
function encode(word, k) {
  const bits = [], put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(2, 4);
  put(word.length, 9);
  for (let i = 0; i + 1 < word.length; i += 2) put(45 * ALNUM.indexOf(word[i]) + ALNUM.indexOf(word[i + 1]), 11);
  if (word.length % 2) put(ALNUM.indexOf(word[word.length - 1]), 6);
  for (let i = 0; i < 4 && bits.length < 8 * k; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; out.length < k; pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}
// What the data codewords say, read leniently: a wrong mode or length
// gives question marks, a pair past 44 x 45 + 44 two of them.
function parse(cw, k, len) {
  let pos = 0;
  const take = (n) => {
    let v = 0;
    for (let i = 0; i < n; i++, pos++) v = (v << 1) | (pos < 8 * k ? (cw[pos >> 3] >> (7 - (pos & 7))) & 1 : 0);
    return v;
  };
  const mode = take(4), count = take(9);
  if (mode !== 2 || count > 25) return "?".repeat(len);
  let s = "";
  for (let i = 0; i < count && pos < 8 * k; i += 2) {
    if (i + 1 === count) s += ALNUM[take(6)] || "?";
    else {
      const v = take(11);
      s += v < 2025 ? ALNUM[floor(v / 45)] + ALNUM[v % 45] : "??";
    }
  }
  return s;
}

// ---- The symbol. Levels in the order of the Data knob, with the two bits
// the format info gives each.
const LEVELS = [{ k: 9, bits: 2 }, { k: 13, bits: 3 }, { k: 16, bits: 0 }, { k: 19, bits: 1 }];
const STD = [8, 6, 4, 2];
const FN = new Uint8Array(N * N), BASE = new Uint8Array(N * N);
const setF = (x, y, v) => ((FN[y * N + x] = 1), (BASE[y * N + x] = v));
for (let i = 0; i < N; i++) setF(6, i, +(i % 2 === 0)), setF(i, 6, +(i % 2 === 0));
for (const [cx, cy] of [[3, 3], [N - 4, 3], [3, N - 4]])
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = max(abs(dx), abs(dy));
      if (x >= 0 && x < N && y >= 0 && y < N) setF(x, y, +(d !== 2 && d !== 4));
    }
// The 15 format bits, bit i at FMT[0][i] beside the top left finder and
// again at FMT[1][i] split under the top right and beside the bottom left.
const FMT = [[], []];
for (let i = 0; i <= 5; i++) FMT[0].push([8, i]);
FMT[0].push([8, 7], [8, 8], [7, 8]);
for (let i = 9; i < 15; i++) FMT[0].push([14 - i, 8]);
for (let i = 0; i < 8; i++) FMT[1].push([N - 1 - i, 8]);
for (let i = 8; i < 15; i++) FMT[1].push([8, N - 15 + i]);
const ISFMT = new Uint8Array(N * N);
for (const [x, y] of [...FMT[0], ...FMT[1]]) setF(x, y, 0), (ISFMT[y * N + x] = 1);
setF(8, N - 8, 1);
function formatBits(level, mask) {
  const data = (LEVELS[level].bits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
// The data modules in placement order: two-module columns from the right,
// up then down, skipping the timing column.
const ORDER = [];
for (let right = N - 1; right >= 1; right -= 2) {
  if (right === 6) right = 5;
  for (let vert = 0; vert < N; vert++)
    for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? N - 1 - vert : vert;
      if (!FN[y * N + x]) ORDER.push(y * N + x);
    }
}
// Which bit of the 208 each module carries (-1 for function modules).
const BITOF = new Int16Array(N * N).fill(-1);
ORDER.forEach((p, i) => (BITOF[p] = i));
// The eight masks: a module flips where its expression is 0.
function maskAt(m, p) {
  const x = p % N, y = floor(p / N), a = (x * y) % 2, b = (x * y) % 3;
  return +([(x + y) % 2, y % 2, x % 3, (x + y) % 3, (floor(x / 3) + floor(y / 2)) % 2, a + b, (a + b) % 2, (((x + y) % 2) + b) % 2][m] === 0);
}

function compose(cw, level, m) {
  const mat = BASE.slice(), f = formatBits(level, m);
  ORDER.forEach((p, i) => (mat[p] = ((cw[i >> 3] >> (7 - (i & 7))) & 1) ^ maskAt(m, p)));
  for (let i = 0; i < 15; i++) for (const c of FMT) mat[c[i][1] * N + c[i][0]] = (f >> i) & 1;
  return mat;
}
// The standard's four penalties: runs of five or more, 2x2 blocks, finder
// look-alikes with four light modules on a side, and imbalance of dark.
function penalty(mat) {
  let p = 0, dark = 0;
  for (let pass = 0; pass < 2; pass++)
    for (let a = 0; a < N; a++) {
      const at = (b) => (b < 0 || b >= N ? 0 : pass ? mat[b * N + a] : mat[a * N + b]);
      let run = 1;
      for (let b = 1; b <= N; b++) {
        if (b < N && at(b) === at(b - 1)) run++;
        else (p += run >= 5 ? run - 2 : 0), (run = 1);
      }
      // Runs of exactly 1, 1, 3, 1, 1; off the symbol counts as light.
      for (let b = 0; b + 6 < N; b++)
        if (!at(b - 1) && at(b) && !at(b + 1) && at(b + 2) && at(b + 3) && at(b + 4) && !at(b + 5) && at(b + 6) && !at(b + 7)) {
          if (!at(b - 2) && !at(b - 3) && !at(b - 4)) p += 40;
          if (!at(b + 8) && !at(b + 9) && !at(b + 10)) p += 40;
        }
    }
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = mat[y * N + x];
      dark += v;
      if (x < N - 1 && y < N - 1 && v === mat[y * N + x + 1] && v === mat[(y + 1) * N + x] && v === mat[(y + 1) * N + x + 1]) p += 3;
    }
  return p + 10 * (Math.ceil(abs(dark * 20 - N * N * 10) / (N * N)) - 1);
}
function build(word, level) {
  const k = LEVELS[level].k, data = encode(word, k), cw = data.concat(rsRemainder(data, 26 - k));
  let best = 0, bp = 1e9;
  for (let m = 0; m < 8; m++) {
    const p = penalty(compose(cw, level, m));
    if (p < bp) (bp = p), (best = m);
  }
  return { word, level, k, n: 26 - k, cw, mask: best, mat: compose(cw, level, best) };
}
// Read a symbol as a scanner does once it has found it.
function readSymbol(mat) {
  let f = null, fd = 99;
  for (const c of FMT) {
    let v = 0;
    for (let i = 0; i < 15; i++) v |= mat[c[i][1] * N + c[i][0]] << i;
    for (let g = 0; g < 32; g++) {
      let d = 0;
      for (let x = v ^ formatBits(g >> 3, g & 7); x; x &= x - 1) d++;
      if (d < fd) (fd = d), (f = { l: g >> 3, m: g & 7 });
    }
  }
  if (fd > 3) return null;
  const cw = new Array(26).fill(0);
  ORDER.forEach((p, i) => (cw[i >> 3] |= (mat[p] ^ maskAt(f.m, p)) << (7 - (i & 7))));
  return { level: f.l, mask: f.m, cw };
}

// ---- 5x7 capitals, digits and the alphanumeric mode's signs, drawn for
// this pattern: seven base-32 digits a glyph, rows from the top, 16 the left
// column.
const FONT_CH = ALNUM + "?";
const FONT =
  "ehjlphe4c4444eeh1248vv2421he26aiv22vgu11he68guhhev124888ehhehheehhf12cehhvhhhuhhuhhu" +
  "ehggghesihhhisvgguggvvggugggehgnhhfhhhvhhhe44444e72222ichikokihggggggvhrllhhhhhpljhh" +
  "ehhhhheuhhugggehhhliduhhukihfgge11uv444444hhhhhhehhhhha4hhhlllahha4ahhhhha444v1248gv" +
  "00000004fke5u4op248j304lel40044v440000v00000000cc01248g00cc0cc0eh12404";

// ---- Layout, top to bottom: the word, marks over the codewords found
// wrong, the codeword columns, the symbol, the syndromes, the budget of
// codewords the level mends, the count.
const MARK_Y = 9, SYN_Y = 105, SLOT_Y = 112, CNT_Y = 118;
const colX = (i, k) => 5 + 2 * i + (i >= k ? 3 : 0);
const PHASES = ["write", "place", "mask", "hold0", "damage", "synd", "locate", "repair", "hold", "clear"];
const DUR = [1.2, 1.8, 0.6, 0.6, 0.5, 0.7, 0.8, 1.0, 3.2, 0.5];
const FUNC = [235, 212, 175], FMTC = [255, 238, 150];

// ---- Hurts, in modules: a scratch 1.2 wide and at most 30 long through
// the middle, a blot with a wobbling rim, a bite centred just off an edge.
function newHurt(s) {
  const kind = s.kinds++ % 3, A = s.area * (0.7 + 0.8 * Math.random()), R = Math.random;
  if (kind === 0) {
    const len = min(A / 1.2, 30), th = R() * PI, cx = 6 + 9 * R(), cy = 6 + 9 * R(), dx = (cos(th) * len) / 2, dy = (sin(th) * len) / 2;
    return { kind, ax: cx - dx, ay: cy - dy, bx: cx + dx, by: cy + dy, dark: 0 };
  }
  if (kind === 1) return { kind, cx: 3 + 15 * R(), cy: 3 + 15 * R(), r: sqrt(A / PI), ph: R() * 7, dark: 1 };
  const u = 4 + 13 * R(), side = floor(R() * 4);
  const [cx, cy] = [[u, -0.3], [N + 0.3, u], [u, N + 0.3], [-0.3, u]][side];
  return { kind, cx, cy, r: sqrt((2 * A) / PI), ph: R() * 7, dark: 0 };
}
function inHurt(h, u, v, g) {
  if (!h || g <= 0) return false;
  if (h.kind === 0) {
    const bx = (h.bx - h.ax) * g, by = (h.by - h.ay) * g;
    const t = cl(((u - h.ax) * bx + (v - h.ay) * by) / (bx * bx + by * by + 1e-9), 0, 1);
    return hypot(u - h.ax - t * bx, v - h.ay - t * by) <= 0.6;
  }
  const dx = u - h.cx, dy = v - h.cy, a = atan2(dy, dx);
  const rim = h.kind === 1 ? 1 + 0.06 * sin(2 * a + 3 * h.ph) + 0.07 * sin(5 * a + h.ph) + 0.05 * sin(8 * a + 2 * h.ph) : 0.9 + 0.14 * abs(sin(5 * a + h.ph));
  return hypot(dx, dy) <= h.r * rim * g;
}
// The symbol with the hurt grown to g, and the codewords read from it with
// the true mask, for the columns, the word and the count.
function spoil(s, g) {
  const sym = s.sym;
  for (let p = 0; p < N * N; p++) s.dmg[p] = inHurt(s.hurt, (p % N) + 0.5, floor(p / N) + 0.5, g) ? s.hurt.dark : sym.mat[p];
  s.seen.fill(0);
  ORDER.forEach((p, i) => (s.seen[i >> 3] |= (s.dmg[p] ^ maskAt(sym.mask, p)) << (7 - (i & 7))));
  s.hit = s.seen.reduce((a, v, i) => a + (v !== sym.cw[i]), 0);
}

function newWord(s, level, phase) {
  const sym = build(WORDS[s.wi % WORDS.length], level);
  Object.assign(s, { sym, dmg: sym.mat.slice(), seen: sym.cw.slice(), hurt: null, dec: null, hit: 0, ph: PHASES.indexOf(phase), pt: 0 });
}

export function setup(params) {
  params.s = { wi: 0, kinds: 1, area: 8, hue: 0, sc: 1, level: -1, btn: false, rgb: new Float32Array(W * H * 3) };
  return params.s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 8, 9], d = cl(dt || 0, 0, 0.1);
  s.hue = k[0] || 0;
  s.sc = 2 / cl(k[1] == null ? 2 : k[1], 0.2, 3);
  s.area = cl(k[2] == null ? 8 : k[2], 8, 60);
  // Data 9, 13, 16, 19: the nearest level.
  const data = cl(k[3] == null ? 9 : k[3], 9, 19);
  let level = 0;
  LEVELS.forEach((L, i) => abs(L.k - data) < abs(LEVELS[level].k - data) && (level = i));
  // The first word, and a new level, start with the bits in place and the
  // mask about to be swept over them.
  if (level !== s.level) (s.level = level), newWord(s, level, "mask");
  const btn = !!(input.btnPressed && input.btnPressed[0]);
  if (btn && !s.btn && s.ph >= 3) Object.assign(s, { dmg: s.sym.mat.slice(), seen: s.sym.cw.slice(), dec: null, ph: 4, pt: 0, hurt: newHurt(s) });
  s.btn = btn;
  s.pt += d;
  while (s.pt >= DUR[s.ph] * s.sc) {
    s.pt -= DUR[s.ph] * s.sc;
    if (++s.ph === PHASES.length) {
      s.wi++;
      newWord(s, s.level, "write");
    }
    const ph = PHASES[s.ph];
    if (ph === "damage") s.hurt = newHurt(s);
    if (ph === "synd") {
      spoil(s, 1);
      // The decoder reads the spoiled symbol on its own.
      const r = readSymbol(s.dmg);
      if (!r) s.dec = { fmt: false, ok: false, good: false, S: [], errs: [] };
      else {
        const dec = rsDecode(r.cw, 26 - LEVELS[r.level].k);
        dec.fmt = true;
        dec.good = dec.ok && r.level === s.sym.level && dec.fixed.every((v, i) => v === s.sym.cw[i]);
        s.dec = dec;
      }
    }
  }
  if (PHASES[s.ph] === "damage") spoil(s, ease(s.pt / (DUR[s.ph] * s.sc)));
}

function put(rgb, x, y, c) {
  const o = (y * W + x) * 3;
  if (x >= 0 && x < W) (rgb[o] = c[0]), (rgb[o + 1] = c[1]), (rgb[o + 2] = c[2]);
}
function glyph(rgb, ch, x0, y0, col) {
  const g = FONT_CH.indexOf(ch);
  for (let r = 0; r < 7 && g >= 0; r++) for (let c = 0; c < 5; c++) if ((parseInt(FONT[g * 7 + r], 32) >> (4 - c)) & 1) put(rgb, x0 + c, y0 + r, col);
}
function fill(rgb, x0, y0, w, h, col) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(rgb, x, y, col);
}
const sc3 = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

export function draw(display, params, time) {
  const s = params.s;
  if (!s || !s.sym) return;
  const rgb = s.rgb, sym = s.sym, K = sym.k, n = sym.n, t = n >> 1;
  const u = s.pt / (DUR[s.ph] * s.sc), at = s.ph, T = time || 0;
  // Data, error correction and damage stay a quarter of the wheel or more
  // apart whatever the hue: cyan, violet and red at 0.
  const DATA = hsv(0.5 + s.hue, 0.75, 255), ECC = hsv(0.75 + s.hue, 0.6, 255), RED = hsv(0.02 + s.hue, 0.88, 255), WHITE = [255, 255, 255];
  const good = s.dec && s.dec.good, fail = s.dec && !s.dec.good && at >= 6;
  rgb.fill(0);

  // The word: typed in while it is encoded, then read from what the
  // codewords say, red where that is wrong.
  const word = sym.word;
  let shown = word;
  if (at >= 4 && !(at >= 7 && good && (at > 7 || u > 0.5))) shown = parse(s.seen, K, word.length).slice(0, 10);
  const tx = round((W - (6 * shown.length - 1)) / 2);
  for (let i = 0; i < shown.length; i++) {
    if (at === 0 && u < ((i + 1) / word.length) * 0.33) break;
    // Once the decoder gives up, none of it can be trusted.
    glyph(rgb, shown[i], tx + 6 * i, TY, shown[i] === word[i] && !fail ? [235, 235, 225] : RED);
  }

  // The codeword columns, 8 bits each, data then error correction.
  const flashFix = at === 7 && good ? exp(-(((u - 0.45) / 0.15) ** 2)) : 0;
  for (let i = 0; i < 26; i++) {
    if (at === 0 && u < (i < K ? 0.33 + (0.34 * i) / K : 0.67 + (0.33 * (i - K)) / n)) continue;
    const x = colX(i, K), base = i < K ? DATA : ECC;
    const v = at >= 4 && !(at >= 7 && good && u > 0.45) && !(at > 7 && good) ? s.seen[i] : sym.cw[i];
    for (let b = 0; b < 8; b++) {
      const bit = (v >> (7 - b)) & 1, wrong = bit !== ((sym.cw[i] >> (7 - b)) & 1);
      let col = wrong ? sc3(RED, bit ? 1 : 0.3) : sc3(base, bit ? 1 : 0.16);
      if (at === 1) {
        const head = (u * 208) | 0, idx = i * 8 + b;
        if (idx < head && idx > head - 6) col = mix(col, WHITE, 1 - (head - idx) / 6);
      }
      if (flashFix && ((s.seen[i] ^ sym.cw[i]) >> (7 - b)) & 1) col = mix(col, WHITE, flashFix);
      fill(rgb, x, CY + 3 * b, 1, 2, col);
    }
  }
  // Marks over the codewords the decoder finds.
  if (s.dec && at >= 6 && at <= 8) {
    const errs = s.dec.errs;
    errs.forEach((i, j) => {
      if (at === 6 && u < (j + 1) / (errs.length + 1)) return;
      fill(rgb, colX(i, K), MARK_Y, 1, 1, fail ? RED : [255, 210, 60]);
    });
  }

  // The symbol, 3 LEDs to a module.
  const fade = at === 9 ? 1 - u : 1, fnIn = at === 0 ? 0 : at === 1 ? cl(u * 5, 0, 1) : 1;
  const hurtG = at === 4 ? ease(u) : at >= 5 ? 1 : 0;
  const heal = good ? (at === 7 ? ease((u - 0.2) / 0.5) : at > 7 ? 1 : 0) : 0;
  const pulse = fail ? 0.75 + 0.25 * sin(T * 6) : 1;
  for (let my = 0; my < N; my++)
    for (let mx = 0; mx < N; mx++) {
      const p = my * N + mx, bi = BITOF[p], isF = FN[p];
      let v = sym.mat[p], col;
      if (isF) {
        if (fnIn <= 0) continue;
        const fmt = ISFMT[p];
        // The format bits arrive with the mask they name.
        if (fmt && at < 2) continue;
        if (fmt && at === 2 && mx + my > u * 42) continue;
        col = sc3(fmt ? FMTC : FUNC, fnIn);
      } else {
        const ci = bi >> 3;
        col = ci < K ? DATA : ECC;
        if (at === 0) continue;
        if (at === 1) {
          const head = (u * 208) | 0;
          if (bi >= head) continue;
          v = (sym.cw[ci] >> (7 - (bi & 7))) & 1;
          if (bi > head - 6) col = mix(col, WHITE, 1 - (head - bi) / 6), (v = 1);
        } else if (at === 2) {
          const front = u * 42 - (mx + my);
          if (front < 0) v = (sym.cw[ci] >> (7 - (bi & 7))) & 1;
          else if (maskAt(sym.mask, p) && front < 3) col = mix(col, WHITE, 1 - front / 3), (v = 1);
        }
      }
      if (!v) col = [0, 0, 0];
      const wrongMod = !isF && s.dmg[p] !== sym.mat[p];
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) {
          const x = SX + 3 * mx + dx, y = SY + 3 * my + dy;
          let c = col;
          if (hurtG > 0 && inHurt(s.hurt, (x - SX + 0.5) / 3, (y - SY + 0.5) / 3, hurtG)) {
            const hc = sc3(RED, (s.hurt.dark ? 1 : 0.38) * pulse);
            c = mix(hc, col, heal);
          }
          put(rgb, x, y, wrongMod && flashFix ? mix(c, WHITE, flashFix) : c);
        }
    }

  // Syndromes: one cell each, dark when zero.
  const cw = min(7, floor(62 / n)), sx = round((W - cw * n + 1) / 2);
  for (let j = 0; j < n; j++) {
    let col = [26, 26, 32];
    const S = s.dec && s.dec.fmt ? s.dec.S[j] || 0 : 0;
    const on = s.dec && at >= 5 && at <= 8 && !(at === 5 && u < j / n) && !(good && (at > 7 || (at === 7 && u > 0.35 + (0.5 * j) / n)));
    if (on && s.dec.fmt && S) col = hsv(S / 255, 0.55, 255);
    else if (on && !s.dec.fmt) col = sc3(RED, 0.4 + 0.3 * sin(T * 6));
    fill(rgb, sx + cw * j, SYN_Y, cw - 1, 4, col);
  }
  // The budget: one slot for each codeword the code can mend; the slots
  // the standard holds back against misreading are dimmer.
  const sw = t > 6 ? 5 : 7, bx = round((W - (sw + 2) * t + 2) / 2), found = s.dec ? s.dec.errs.length : 0;
  for (let j = 0; j < t; j++) {
    let col = j < STD[sym.level] ? [44, 44, 52] : [34, 16, 40];
    if (s.dec && at >= 6 && at <= 8) {
      if (fail) col = sc3(RED, pulse);
      else if (j < found && !(at === 6 && u < (j + 1) / (found + 1))) col = [255, 210, 60];
    }
    fill(rgb, bx + (sw + 2) * j, SLOT_Y, sw, 3, col);
  }
  // The count: codewords spoiled over codewords the code can mend.
  const cnt = `${at >= 4 && at <= 8 ? s.hit : 0}/${t}`, cx = round((W - (6 * cnt.length - 1)) / 2);
  const ccol = at < 4 || at > 8 || !s.hit ? [120, 120, 120] : s.hit > t || fail ? RED : good && at >= 7 ? [120, 255, 140] : [235, 235, 225];
  for (let i = 0; i < cnt.length; i++) glyph(rgb, cnt[i], cx + 6 * i, CNT_Y, ccol);

  for (let i = 0; i < W * H; i++) {
    const j = i * 3;
    display.setPixel(i % W, (i / W) | 0, round(cl(rgb[j] * fade, 0, 255)), round(cl(rgb[j + 1] * fade, 0, 255)), round(cl(rgb[j + 2] * fade, 0, 255)));
  }
}
