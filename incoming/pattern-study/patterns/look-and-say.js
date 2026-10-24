// ===== Patternflow pattern =====
// Title:   Look and Say
// Family:  data
// Idea:    Conway's look-and-say sequence types itself down the page, each row read aloud run by run from the row above, and as the rows grow by 1.3 a step the page steps down from numerals to bars to one LED a digit, every Conway element in its own colour.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the look-and-say sequence and its audioactive decay into 92 elements (John Horton Conway, 1986), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Seed=1..5, Digits=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the elements run from pink at hydrogen through violet and blue to green at uranium, and the first seven rows of seed 1, which are not yet elements, are cream.
// Knob 2: Speed. How fast the rows are read. At 2 a row of 78 digits takes three and a half seconds and a row of 5808 six and a half, and the page from seed 1 starts again after about a minute and a half; at 0.2 the reading takes ten times as long.
// Knob 3: Seed. The first row: 1, then 3 (uranium), 312 (zinc), 311311 (barium) and 22 (hydrogen, the one row that reads back as itself, so the page fills with 22s).
// Knob 4: Digits. At 0 each Conway element has its own colour, with a dim strip of it behind its numerals; past the middle the colour says only which digit it is: 1 cyan, 2 violet, 3 gold.
// Buttons: K1 tap starts the page again from the next seed.

const W = 64, H = 128;
const { min, max, floor, ceil, exp, pow, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Conway's 92 elements, H to U: the name, the digits, and what the element
// becomes when it is read aloud. Every term of the sequence from the eighth
// on is a row of these, and each element decays on its own.
const TABLE = `H 22 H|He 13112221133211322112211213322112 Hf.Pa.H.Ca.Li|Li 312211322212221121123222112 He|Be 111312211312113221133211322112211213322112 Ge.Ca.Li|B 1321132122211322212221121123222112 Be|C 3113112211322112211213322112 B|N 111312212221121123222112 C|O 132112211213322112 N|F 31121123222112 O|Ne 111213322112 F|Na 123222112 Ne|Mg 3113322112 Pm.Na|Al 1113222112 Mg|Si 1322112 Al|P 311311222112 Ho.Si|S 1113122112 P|Cl 132112 S|Ar 3112 Cl|K 1112 Ar|Ca 12 K|Sc 3113112221133112 Ho.Pa.H.Ca.Co|Ti 11131221131112 Sc|V 13211312 Ti|Cr 31132 V|Mn 111311222112 Cr.Si|Fe 13122112 Mn|Co 32112 Fe|Ni 11133112 Zn.Co|Cu 131112 Ni|Zn 312 Cu|Ga 13221133122211332 Eu.Ca.Ac.H.Ca.Zn|Ge 31131122211311122113222 Ho.Ga|As 11131221131211322113322112 Ge.Na|Se 13211321222113222112 As|Br 3113112211322112 Se|Kr 11131221222112 Br|Rb 1321122112 Kr|Sr 3112112 Rb|Y 1112133 Sr.U|Zr 12322211331222113112211 Y.H.Ca.Tc|Nb 1113122113322113111221131221 Er.Zr|Mo 13211322211312113211 Nb|Tc 311322113212221 Mo|Ru 132211331222113112211 Eu.Ca.Tc|Rh 311311222113111221131221 Ho.Ru|Pd 111312211312113211 Rh|Ag 132113212221 Pd|Cd 3113112211 Ag|In 11131221 Cd|Sn 13211 In|Sb 3112221 Pm.Sn|Te 1322113312211 Eu.Ca.Sb|I 311311222113111221 Ho.Te|Xe 11131221131211 I|Cs 13211321 Xe|Ba 311311 Cs|La 11131 Ba|Ce 1321133112 La.H.Ca.Co|Pr 31131112 Ce|Nd 111312 Pr|Pm 132 Nd|Sm 311332 Pm.Ca.Zn|Eu 1113222 Sm|Gd 13221133112 Eu.Ca.Co|Tb 3113112221131112 Ho.Gd|Dy 111312211312 Tb|Ho 1321132 Dy|Er 311311222 Ho.Pm|Tm 11131221133112 Er.Ca.Co|Yb 1321131112 Tm|Lu 311312 Yb|Hf 11132 Lu|Ta 13112221133211322112211213322113 Hf.Pa.H.Ca.W|W 312211322212221121123222113 Ta|Re 111312211312113221133211322112211213322113 Ge.Ca.W|Os 1321132122211322212221121123222113 Re|Ir 3113112211322112211213322113 Os|Pt 111312212221121123222113 Ir|Au 132112211213322113 Pt|Hg 31121123222113 Au|Tl 111213322113 Hg|Pb 123222113 Tl|Bi 3113322113 Pm.Pb|Po 1113222113 Bi|At 1322113 Po|Rn 311311222113 Ho.At|Fr 1113122113 Rn|Ra 132113 Fr|Ac 3113 Ra|Th 1113 Ac|Pa 13 Th|U 3 Pa`;
const ROWS = TABLE.split("|").map((r) => r.split(" "));
const NAME = ROWS.map((r) => r[0]);
const LEN = ROWS.map((r) => r[1].length);
const DEC = ROWS.map((r) => r[2].split(".").map((n) => NAME.indexOf(n)));
const NONE = 92;

// The seeds: the first row, the row from which it is a compound of elements,
// and that compound. Seed 1 runs seven rows before it splits into Hf.Sn.
const SEEDS = [
  ["1", 8, "Hf.Sn"],
  ["3", 1, "U"],
  ["312", 1, "Zn"],
  ["311311", 1, "Ba"],
  ["22", 1, "H"],
];

// The four prints: cell width and height, digits a line, blank lines between
// rows, top margin, and how many lines the row read and the row typed may
// fill together before the page steps down to the next print. Numerals
// first, then bars one LED wide and as tall as the digit, so a run of equal
// digits stands as a flat step; then one LED a digit, two LEDs tall, then
// one.
const LV = [
  { cw: 4, ch: 6, per: 16, gap: 0, top: 1, fit: 16 },
  { cw: 1, ch: 4, per: 64, gap: 1, top: 0, fit: 24 },
  { cw: 1, ch: 2, per: 64, gap: 1, top: 0, fit: 48 },
  { cw: 1, ch: 1, per: 64, gap: 1, top: 0, fit: 999 },
];
// 3x5 numerals 1, 2 and 3, one octal digit a row from the top. No other
// digit ever appears: no run in these seeds is longer than three.
const FONT = [0, 0o26227, 0o71747, 0o71317];
// The largest row the finest print still holds, in lines of 64.
const LAST = 120;
// Rows the page rattles off at the start before it settles to reading.
const BURST = 20;

function say(d) {
  const o = [];
  for (let i = 0; i < d.length; ) {
    let j = i + 1;
    while (j < d.length && d[j] === d[i]) j++;
    o.push(j - i, d[i]);
    i = j;
  }
  return Uint8Array.from(o);
}

function build(P, si) {
  const [s0, at, comp] = SEEDS[si];
  const T = [];
  let d = Uint8Array.from(s0, (c) => +c), E = null;
  for (let n = 1; n <= 48; n++) {
    if (n === at) E = comp.split(".").map((x) => NAME.indexOf(x));
    else if (E) E = E.flatMap((k) => DEC[k]);
    const e = new Uint8Array(d.length).fill(NONE), end = new Uint8Array(d.length);
    if (E) {
      let p = 0;
      for (const k of E) e.fill(k, p, (p += LEN[k])), (end[p - 1] = 1);
    }
    T.push({ d, e, end, n: d.length, ri: null });
    const nx = say(d);
    if (nx.length > LAST * 64) break;
    d = nx;
  }
  P.si = si;
  P.T = T;
  P.lv = 0;
  P.ls = lines(T, 0);
  P.l0 = P.ls;
  P.sc = 0;
  P.n = 0;
  P.st = 1;
  P.w = 0.1;
  P.r = 0;
  // The seed is on the page from the start.
  P.typed = T[0].n;
  P.at = new Float32Array(T[0].n).fill(P.clock - 1);
  P.u = 0;
}

// Where each row starts, in lines of a print.
function lines(T, lv) {
  const L = LV[lv], ls = new Int32Array(T.length + 1);
  for (let k = 0; k < T.length; k++) ls[k + 1] = ls[k] + ceil(T[k].n / L.per) + L.gap;
  return ls;
}
const rowLines = (P, k, lv) => ceil(P.T[k].n / LV[lv].per);

// The runs of the row being read: for each digit, the number of its run.
function runs(t) {
  if (t.ri) return;
  t.ri = new Int32Array(t.n);
  t.rs = [];
  for (let i = 0, r = -1; i < t.n; i++) {
    if (i === 0 || t.d[i] !== t.d[i - 1]) r++, t.rs.push(i);
    t.ri[i] = r;
  }
}

// How long a row takes to type: seconds for its runs at the Speed knob.
function dur(P, k) {
  const runsN = P.T[k].n / 2, f = 2 / P.sp;
  if (P.l0[k] < BURST) return 0.15 * pow(f, 0.5);
  if (P.lv === 0) return f * (0.2 + 0.55 * pow(runsN, 0.5));
  return f * (0.5 + 0.55 * pow(runsN, 0.3));
}

// The scroll that keeps the typing line at the foot of the panel and the
// reading head on it.
function want(P, lv, ls, typed) {
  const L = LV[lv], n = P.n;
  if (n >= P.T.length) return P.sc;
  const tl = ls[n] + floor(min(typed, P.T[n].n - 1) / L.per);
  let s = L.top + (tl + 1) * L.ch + 1 - H;
  if (n > 0) {
    const src = P.T[n - 1], i = src.rs ? src.rs[min(src.rs.length - 1, floor(P.r))] : 0;
    s = min(s, L.top + (ls[n - 1] + floor(i / L.per)) * L.ch - 2);
  }
  return max(0, s);
}

function next(P) {
  P.n++;
  P.r = 0;
  P.typed = 0;
  if (P.n >= P.T.length) return void ((P.st = 3), (P.w = 3));
  const t = P.T[P.n];
  runs(P.T[P.n - 1]);
  P.at = new Float32Array(t.n);
  P.st = 0;
  const lv = P.lv;
  if (lv < 3 && rowLines(P, P.n - 1, lv) + rowLines(P, P.n, lv) > LV[lv].fit) {
    // Step down a print: every digit flies from its old place to its new one.
    P.nl = lv + 1;
    P.nls = lines(P.T, lv + 1);
    P.nsc = want(P, lv + 1, P.nls, 0);
    P.st = 2;
    P.u = 0;
  }
}

export function setup(params) {
  params.s = { si: 0, off: 0, sp: 2, hue: 0, dig: 0.06, col: new Float32Array(93 * 4 * 3), buf: new Float32Array(W * H * 3), clock: 0 };
  build(params.s, 0);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.sp = cl(k[1], 0.2, 3);
  P.dig = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) P.off++;
  const si = (round(cl(k[2], 1, 5)) - 1 + P.off) % SEEDS.length;
  if (si !== P.si) build(P, si);
  P.clock += d;
  if (P.st === 0) {
    const t = P.T[P.n], rn = t.n / 2;
    P.r = min(rn, P.r + (d * rn) / dur(P, P.n));
    // The count is spoken as the run lights up, the digit just after.
    while (P.typed < t.n && (P.typed >> 1) + (P.typed & 1 ? 0.55 : 0.12) <= P.r) P.at[P.typed++] = P.clock;
    if (P.typed >= t.n) (P.st = 1), (P.w = P.l0[P.n] < BURST ? 0.03 : 0.35 * (2 / P.sp));
  } else if (P.st === 1) {
    P.w -= d;
    if (P.w <= 0) next(P);
  } else if (P.st === 2) {
    P.u += d / 1.6;
    if (P.u >= 1) (P.lv = P.nl), (P.ls = P.nls), (P.sc = P.nsc), (P.st = 0);
  } else if (P.st === 3) {
    P.w -= d;
    if (P.w <= 0) (P.st = 4), (P.u = 0);
  } else if (P.st === 4) {
    P.u += d / 0.8;
    if (P.u >= 1) build(P, P.si);
  }
  if (P.st !== 2) P.sc += (want(P, P.lv, P.ls, P.typed) - P.sc) * (1 - exp(-d * 10));
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[o] = c[0] * 255;
  out[o + 1] = c[1] * 255;
  out[o + 2] = c[2] * 255;
}

// Colour of each element and digit: element hue by place in Conway's table,
// from pink at hydrogen through violet and blue to green at uranium, so an
// element and what it decays into are near in colour. The Digits knob mixes
// toward a hue for each digit. Rows before the split into elements are pale.
const tmp = new Float32Array(6);
function palette(P) {
  const h0 = P.hue + 0.95, col = P.col, k = cl((P.dig - 0.3) / 0.4, 0, 1), g = k * k * (3 - 2 * k);
  for (let e = 0; e <= NONE; e++)
    for (let dg = 1; dg <= 3; dg++) {
      if (e === NONE) hsv(h0 + 0.2, 0.3, 1, tmp, 0);
      else hsv(h0 - 0.58 * (e / 91), 0.75, 1, tmp, 0);
      hsv(h0 + [0, 0.56, 0.85, 0.19][dg], 0.8, 1, tmp, 3);
      const o = (e * 4 + dg) * 3;
      for (let c = 0; c < 3; c++) col[o + c] = tmp[c] + (tmp[c + 3] - tmp[c]) * g;
    }
}

// One digit onto the buffer in print lv at (x, y), the palette colour at o
// scaled by v and whitened by w. Behind a numeral lies a strip of tint, open
// after the last digit of an element; a bar at the end of an element is dimmer.
function put(P, lv, x, y, dg, o, v, w, tint, end) {
  const buf = P.buf, col = P.col;
  const r = col[o] * v, g = col[o + 1] * v, b = col[o + 2] * v;
  const R = r + (255 - r) * w, G = g + (255 - g) * w, B = b + (255 - b) * w;
  if (lv === 0) {
    const bits = FONT[dg], tw = end ? 3 : 4;
    for (let gy = 0; gy < 5; gy++) {
      const yy = y + gy;
      if (yy < 0 || yy >= H) continue;
      const row = (bits >> ((4 - gy) * 3)) & 7;
      for (let gx = 0; gx < tw; gx++) {
        const xx = x + gx;
        if (xx >= W) break;
        const q = (yy * W + xx) * 3;
        if (gx < 3 && row & (4 >> gx)) (buf[q] = R), (buf[q + 1] = G), (buf[q + 2] = B);
        else if (tint > 0) (buf[q] = col[o] * tint), (buf[q + 1] = col[o + 1] * tint), (buf[q + 2] = col[o + 2] * tint);
      }
    }
    return;
  }
  const m = lv === 1 ? (end ? 0.6 : 1) : lv === 2 ? [0, 0.7, 0.86, 1][dg] : [0, 0.8, 0.9, 1][dg];
  for (let yy = lv === 1 ? y + 3 - dg : y, y1 = lv === 1 ? y + 3 : y + LV[lv].ch; yy < y1; yy++) {
    if (yy < 0 || yy >= H || x >= W) continue;
    const q = (yy * W + x) * 3;
    buf[q] = R * m;
    buf[q + 1] = G * m;
    buf[q + 2] = B * m;
  }
}

// Brightness and whitening of digit i of row k: rows long read are dim, the
// row being read dims behind the reading head, the run under the head lights
// up, and a digit just typed flashes.
const OLD = 0.62, SRC = 0.95;
function look(P, k, i, out) {
  const n = P.n;
  out[0] = OLD;
  out[1] = 0;
  if (k === n && P.st <= 1) {
    out[0] = 1;
    out[1] = 0.85 * exp(-(P.clock - P.at[i]) / 0.22);
  } else if (k === n - 1 && P.st <= 1) {
    const t = P.T[k], dr = P.r - t.ri[i];
    if (dr < 0) out[0] = SRC;
    else {
      const tau = dur(P, n) / (P.T[n].n / 2), s = dr < 1 ? 0 : ((dr - 1) * tau) / 0.25;
      out[1] = 0.8 * exp(-s);
      out[0] = OLD + (SRC - OLD) * exp(-s * 0.3);
    }
  } else if (k === n - 1) out[0] = SRC;
}

const lk = new Float32Array(2);
function drawPage(P, lv, ls, sc) {
  const L = LV[lv], top = L.top - round(sc), tintBase = (1 - P.dig) * 0.13;
  const last = min(P.n, P.T.length - 1);
  for (let k = 0; k <= last; k++) {
    const t = P.T[k], y0 = top + ls[k] * L.ch;
    if (y0 >= H) break;
    if (y0 + (ls[k + 1] - ls[k]) * L.ch < 0) continue;
    const cnt = k === P.n ? (P.st <= 1 ? P.typed : 0) : t.n;
    for (let i = 0; i < cnt; i++) {
      const y = y0 + floor(i / L.per) * L.ch;
      if (y + L.ch <= 0) {
        i += L.per - 1 - (i % L.per);
        continue;
      }
      if (y >= H) break;
      look(P, k, i, lk);
      const e = t.e[i], dg = t.d[i];
      put(P, lv, (i % L.per) * L.cw, y, dg, (e * 4 + dg) * 3, lk[0], lk[1], e === NONE ? 0 : tintBase * (0.6 + 0.4 * lk[0]), t.end[i]);
    }
  }
}

// Stepping down a print: line by line from the top, each numeral drops to a
// block and flies to its place in the finer print.
function drawFlight(P) {
  const A = LV[P.lv], B = LV[P.nl], u = P.u, tintBase = (1 - P.dig) * 0.13;
  const ta = A.top - round(P.sc), tb = B.top - round(P.nsc);
  for (let k = 0; k < P.n; k++) {
    const t = P.T[k];
    for (let i = 0; i < t.n; i++) {
      const xa = (i % A.per) * A.cw, ya = ta + (P.ls[k] + floor(i / A.per)) * A.ch;
      const xb = (i % B.per) * B.cw, yb = tb + (P.nls[k] + floor(i / B.per)) * B.ch;
      if ((ya < -6 || ya >= H) && (yb < -6 || yb >= H)) continue;
      const v = k === P.n - 1 ? SRC : OLD, e = t.e[i], dg = t.d[i], o = (e * 4 + dg) * 3;
      const s = cl((u * 1.5 - 0.5 * cl(ya / H, 0, 1)) * 1.25, 0, 1);
      if (s <= 0) put(P, P.lv, xa, ya, dg, o, v, 0, e === NONE ? 0 : tintBase * (0.6 + 0.4 * v), t.end[i]);
      else {
        const f = s * s * (3 - 2 * s);
        put(P, P.nl, round(xa + (xb - xa) * f), round(ya + (yb - ya) * f), dg, o, v, 0.5 * (1 - f), 0, t.end[i]);
      }
    }
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  palette(P);
  const buf = P.buf;
  buf.fill(0);
  if (P.st === 2) drawFlight(P);
  else drawPage(P, P.lv, P.ls, P.sc);
  const fade = P.st === 4 ? 1 - P.u : 1;
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p] * fade, buf[p + 1] * fade, buf[p + 2] * fade);
}
