// ===== Patternflow pattern =====
// Title:   Enigma Rotors
// Family:  type
// Idea:    The whole height of the panel is the signal path of an Enigma: a keycap at the top, three rotors drawn as bands of 26 slanting wires, the reflector's arches at the bottom, and with every letter typed the right rotor clicks round, the current runs down through the three bands in one colour, turns in the reflector and climbs back by other wires in another, and lights a different letter in the lamp, while the plain and the cipher text run along the foot in groups of five.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Enigma machine (Arthur Scherbius, patented 1918; Wehrmacht Enigma I), three rotors and the UKW-B reflector, pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..4, Message=0..5, Rotor=0..25
//
// Knob 1: Hue. Turns the whole machine round the wheel. At 0 the current runs down amber and comes back aqua through three rotors that go from blue to magenta, over rose arches; at 0.25 it runs green and back violet; at 0.5 blue and back red; at 0.75 magenta and back yellow green. The rotors turn with it, and the warm tints are drained to a sandy grey so they do not read as brown.
// Knob 2: Speed. How fast the keys come. At 2 a letter takes 1.55 s: 0.25 s for the clack of the rotors, 0.82 s for the current to go down, turn and come back, and the lamp stays lit until the next key. WETTERBERICHT, 13 letters, takes 20 s. Every time goes as 2 / Speed: five times slower at 0.4, twice as fast at 4.
// Knob 3: Message. 0 WETTERBERICHT, 1 its own ciphertext, which types back out as WETTERBERICHT, 2 NOTHINGTOREPORT, 3 PARTICIPATIONTV, 4 KEINEBESONDERENEREIGNISSE, 5 fifteen As, the first five of which come out BDZGO. Six dots at the foot say which is on. After a message the next one follows; a turn of this knob or of Rotor keeps the same message coming round for 20 s first.
// Knob 4: Rotor. Sets the middle rotor n letters on from the message key and the left rotor 5n, so every wire in two of the three bands slides to a new place and the whole cipher changes. At 0 a message opens on its own key; at 1 the first two messages start with the middle rotor on its notch, and their first key carries the left rotor too. The rotors slide to the new key in 0.8 s.

// The wiring is the real one: rotor I EKMFLGDQVZNTOWYHXUSPAIBRCJ (notch Q to R) on the
// left, II AJDKSIRUXBLHWTMCQGZNPYFVOE (E to F) in the middle, III
// BDFHJLCPRTXVZNYEIWGAKMUSQO (V to W) on the right, and the reflector UKW-B
// YRUHQSLDPXNGOKMIEBFZCWVJAT, with the ring settings at A A A and no plugboard.
// Typing AAAAA from the windows A A A gives BDZGO. The reflector sends the current
// back by a different wire, so no letter ever comes out as itself, and it makes the
// machine its own inverse: the ciphertext typed again from the same windows gives
// the plain text back.
//
// A band is one rotor seen from the side: its 26 wires run from the contacts on
// its right-hand face, the top edge, to the contacts on its left-hand face, the
// bottom edge. The rotor is a ring, so a wire is drawn the short way round and a
// wire that leaves one side comes in on the other. When the rotor steps, every
// wire slides one contact (2.4 LEDs) sideways; the contacts of the fixed rows
// between the bands stay where they are. That is the whole of the machine's
// secrecy: the same key goes through a different set of wires each time.
//
// The panel from the top: the keycap, the windows and the lamp (rows 0 to 12), the three bands
// with the fixed contact rows at 19, 43, 67 and 91, the reflector hanging from
// row 91, and the two lines of text. The three windows stand between the keycap
// and the lamp. The current is drawn
// wire by wire as it runs, so a key shows where it went.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp, sin, cos, PI, ceil } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// ---- machine begin
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RW = ["EKMFLGDQVZNTOWYHXUSPAIBRCJ", "AJDKSIRUXBLHWTMCQGZNPYFVOE", "BDFHJLCPRTXVZNYEIWGAKMUSQO"];
const UKW = "YRUHQSLDPXNGOKMIEBFZCWVJAT";
const NOTCH = [16, 4, 21];
const m26 = (n) => ((n % 26) + 26) % 26;
const code = (s) => [...s].map((c) => c.charCodeAt(0) - 65);
const FWD = RW.map(code);
const BWD = FWD.map((w) => {
  const b = new Array(26);
  w.forEach((o, i) => (b[o] = i));
  return b;
});
const REF = code(UKW);

// Positions are [left, middle, right]. The right rotor always steps; the middle
// one steps when the right stands on its notch, and also when it stands on its
// own, which carries the left one with it (the double step).
function stepOnce(p) {
  const sm = p[2] === NOTCH[2] || p[1] === NOTCH[1];
  const sl = p[1] === NOTCH[1];
  return [[m26(p[0] + (sl ? 1 : 0)), m26(p[1] + (sm ? 1 : 0)), m26(p[2] + 1)], [sl, sm, true]];
}

// The contact the current is on at each level of the fixed frame, down and back:
// [key, after right, after middle, after left, after reflector, back through
// left, back through middle, back through right = the lamp].
function pathOf(p, c) {
  const L = [c];
  let x = c;
  for (const k of [2, 1, 0]) {
    x = m26(FWD[k][m26(x + p[k])] - p[k]);
    L.push(x);
  }
  x = REF[x];
  L.push(x);
  for (const k of [0, 1, 2]) {
    x = m26(BWD[k][m26(x + p[k])] - p[k]);
    L.push(x);
  }
  return L;
}

function encipher(key, text) {
  const out = [];
  let p = key.slice();
  for (const ch of text) {
    const [q, st] = stepOnce(p);
    p = q;
    const path = pathOf(p, ch.charCodeAt(0) - 65);
    out.push({ pos: p, stepped: st, path, inp: path[0], out: path[7] });
  }
  return out;
}
// ---- machine end

// ---- the messages: text and the three letters showing in the windows
const KEYS = ["ADU", "ADU", "KCT", "NJP", "BQS", "AAA"];
const TEXTS = ["WETTERBERICHT", "", "NOTHINGTOREPORT", "PARTICIPATIONTV", "KEINEBESONDERENEREIGNISSE", "AAAAAAAAAAAAAAA"];
function keyOf(m, n) {
  const k = code(KEYS[m]);
  return [m26(k[0] + 5 * n), m26(k[1] + n), k[2]];
}
// Message 1 is message 0 as the machine writes it, so it types back out as the first.
TEXTS[1] = encipher(keyOf(0, 0), TEXTS[0]).map((e) => ABC[e.out]).join("");
const NMSG = TEXTS.length;

// ---- timing at Speed 2, in seconds
const STEP = 0.25, CUR0 = 0.27, CYC = 1.55, HOLD = 2.4, RESET = 0.8, FIRST = 0.15, FADE = 0.3, REST = 20;
// The nine stages of the current: key to contact, three bands down, the reflector,
// three bands up, contact to lamp.
const DUR = [0.06, 0.09, 0.09, 0.09, 0.16, 0.09, 0.09, 0.09, 0.06];
const T0 = [];
let TOTAL = 0;
for (const d of DUR) {
  T0.push(TOTAL);
  TOTAL += d;
}

// ---- layout
const X0 = 1.7, PITCH = 2.4, PERIOD = 26 * PITCH, RING0 = 0.5;
const LV = [19, 43, 67, 91];
const KEYX = 5, LAMPX = 58;
const cx = (i) => X0 + PITCH * i;
// Shortest way round the ring for the wire that starts at internal contact q.
const DELTA = FWD.map((w) => w.map((o, q) => m26(o - q + 13) - 13));
const PAIRS = [];
for (let a = 0; a < 26; a++) if (a < REF[a]) PAIRS.push([a, REF[a]]);

// ---- the face: 26 capitals, 3 wide and 5 tall
const FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "###", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
};
const GLY = {};
for (const ch of Object.keys(FONT)) {
  const px = [];
  FONT[ch].forEach((row, y) => [...row].forEach((c, x) => c === "#" && px.push(x, y)));
  GLY[ch] = px;
}

// ---- colour. Orange and yellow turn brown when they are dim and blue and red
// carry little light, so near them the colour is paled and lifted.
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
function sat(h) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.07) ** 2)), u = exp(-(((f - 0.66) / 0.07) ** 2));
  return 1 - 0.3 * b - 0.22 * u;
}
function gain(h) {
  const f = h - floor(h), b = exp(-(((f - 0.11) / 0.07) ** 2)), c = hsv(h, sat(h), 1);
  return cl(0.5 / (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114), 1, 2) * (1 + 0.5 * b);
}
const tone = (h, v, s = 1) => hsv(h, sat(h) * s, min(1, v * gain(h)));
// The wires and arches are dim, and a dim orange or yellow is brown or olive, so
// for them the warm end of the wheel is drained to a grey with a trace of sand.
const dim = (h, v, s) => {
  const f = h - floor(h);
  return tone(h, v, s * (1 - 0.6 * exp(-(((f - 0.13) / 0.1) ** 2))));
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE = [1, 1, 1];

function palette(h) {
  const band = [0.58, 0.7, 0.82].map((o) => h + o);
  return {
    down: tone(h + 0.1, 1),
    up: tone(h + 0.5, 1),
    wire: band.map((o) => dim(o, 0.27, 0.65)),
    pin: band.map((o) => dim(o, 0.5, 0.85)),
    refl: (j) => dim(h + 0.9 + 0.008 * j, 0.27, 0.85),
    frame: tone(h + 0.64, 0.4),
  };
}

// ---- drawing into a float buffer, the brightest write to a pixel winning
let buf = null;
function put(x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) {
    const t = c[i] * v;
    if (t > buf[o + i]) buf[o + i] = t;
  }
}
// The light on row y between a and b, in LEDs whose centres are at the integers.
function span(y, a, b, c, v) {
  if (y < 0 || y >= H) return;
  const k1 = min(W - 1, floor(b + 0.5));
  for (let k = max(0, floor(a + 0.5)); k <= k1; k++) {
    const cov = min(b, k + 0.5) - max(a, k - 0.5);
    if (cov > 0) put(k, y, c, v * min(1, cov));
  }
}
function splat(x, y, c, v) {
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  put(x0, y0, c, v * (1 - fx) * (1 - fy));
  put(x0 + 1, y0, c, v * fx * (1 - fy));
  put(x0, y0 + 1, c, v * (1 - fx) * fy);
  put(x0 + 1, y0 + 1, c, v * fx * fy);
}
function glyph(ch, x, y, s, c, v) {
  const g = GLY[ch];
  if (!g) return;
  for (let i = 0; i < g.length; i += 2)
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) put(x + g[i] * s + dx, y + g[i + 1] * s + dy, c, v);
}

// One wire of a rotor standing at pv (a real number of contacts, so a rotor
// mid-click slides): rows y0 to y1 of its band, only those whose place along the
// wire, 0 at the top, lies in t0 to t1.
function wire(k, q, pv, y0, y1, c, v, w, t0, t1) {
  const top = X0 + PITCH * (q - pv), dx = PITCH * DELTA[k][q], n = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const tm = (y - y0) / n;
    if (tm < t0 - 1e-6 || tm > t1 + 1e-6) continue;
    const xa = top + dx * max(0, (y - 0.5 - y0) / n), xb = top + dx * min(1, (y + 0.5 - y0) / n);
    let lo = min(xa, xb) - w, hi = max(xa, xb) + w;
    const sh = floor(((lo + hi) / 2 - RING0) / PERIOD) * PERIOD;
    lo -= sh;
    hi -= sh;
    span(y, lo, hi, c, v);
    span(y, lo - PERIOD, hi - PERIOD, c, v);
    span(y, lo + PERIOD, hi + PERIOD, c, v);
  }
}
const wireX = (k, q, pv, t) => {
  const x = X0 + PITCH * (q - pv) + PITCH * DELTA[k][q] * t;
  return RING0 + ((((x - RING0) % PERIOD) + PERIOD) % PERIOD);
};

// A reflector arch from contact a to contact b, u from 0 to 1 along it.
const archDepth = (a, b) => 2 + 0.45 * abs(b - a);
function arch(a, b, u0, u1, cf, ct, v, crisp) {
  const xa = cx(a), xb = cx(b), d = archDepth(a, b);
  const n = ceil((abs(xb - xa) + 2 * d) * 1.6);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (u < u0 || u > u1) continue;
    const x = xa + ((xb - xa) * (1 - cos(PI * u))) / 2, y = LV[3] + d * sin(PI * u);
    if (crisp) put(round(x), round(y), cf, v);
    else splat(x, y, mix(cf, ct, u), v);
  }
}
const archAt = (a, b, u) => [cx(a) + ((cx(b) - cx(a)) * (1 - cos(PI * u))) / 2, LV[3] + archDepth(a, b) * sin(PI * u)];

// A path of axis-parallel pieces, drawn to the fraction f of its length.
function poly(pts, f, c, v) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += abs(pts[i][0] - pts[i - 1][0]) + abs(pts[i][1] - pts[i - 1][1]);
  let run = 0, head = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const seg = abs(pts[i][0] - pts[i - 1][0]) + abs(pts[i][1] - pts[i - 1][1]);
    const steps = max(1, round(seg));
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      if ((run + seg * t) / len > f + 1e-6) return head;
      head = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
      put(round(head[0]), round(head[1]), c, v);
    }
    run += seg;
  }
  return head;
}
function glow(p, c) {
  const hot = mix(c, WHITE, 0.85);
  splat(p[0], p[1], hot, 1);
  splat(p[0] + 0.5, p[1] + 0.5, hot, 1);
  for (const [dx, dy] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) splat(p[0] + dx, p[1] + dy, mix(c, WHITE, 0.3), 0.6);
}

function frameBox(x, y, c, v) {
  for (let i = 1; i < 9; i++) {
    put(x + i, y, c, v);
    put(x + i, y + 12, c, v);
  }
  for (let j = 1; j < 12; j++) {
    put(x, y + j, c, v);
    put(x + 9, y + j, c, v);
  }
}

// ---- the state
function load(S, m, n) {
  S.m = m;
  S.n = n;
  S.key = keyOf(m, n);
  S.steps = encipher(S.key, TEXTS[m]);
  S.u = S.key.slice();
  S.from = S.key.slice();
  S.i = -1;
  S.cur = null;
  S.tau = -FIRST;
  S.sf = 1;
  S.phase = "type";
}

function press(S, i) {
  const st = S.steps[i];
  S.i = i;
  S.cur = st;
  S.from = S.u.slice();
  S.u = S.u.map((v, k) => v + (st.stepped[k] ? 1 : 0));
}

function startReset(S, m, n, pv) {
  S.nextM = m;
  S.nextN = n;
  S.from = pv.slice();
  const key = keyOf(m, n);
  S.u = pv.map((v, k) => {
    let d = m26(key[k] - v);
    if (d > 13) d -= 26;
    return v + d;
  });
  S.cur = null;
  S.phase = "reset";
  S.tau = 0;
}

export function setup(params) {
  const S = { buf: new Float32Array(W * H * 3) };
  S.hue = 0;
  S.speed = 2;
  S.km = -1;
  S.kn = -1;
  S.rest = REST;
  S.scroll = 0;
  S.pv = [0, 0, 0];
  params.s = S;
}

const pvOf = (S) => {
  if (S.phase === "reset") return S.from.map((v, k) => v + (S.u[k] - v) * smooth(S.tau / RESET));
  const e = S.cur ? smooth(S.tau / STEP) : 1;
  return S.from.map((v, k) => v + (S.u[k] - v) * e);
};

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.4, 4);
  const km = round(cl(k[2] || 0, 0, NMSG - 1)), kn = round(cl(k[3] || 0, 0, 25));
  S.rest += d;
  const dd = (d * S.speed) / 2;
  if (S.km < 0) {
    load(S, km, kn);
    S.km = km;
    S.kn = kn;
    S.rest = REST;
  } else if (km !== S.km || kn !== S.kn) {
    S.km = km;
    S.kn = kn;
    S.rest = 0;
    startReset(S, km, kn, pvOf(S));
  }
  S.tau += dd;
  if (S.phase === "type") {
    if (S.i < 0 && S.tau >= 0) press(S, 0);
    else if (S.i >= 0) {
      const last = S.i + 1 >= S.steps.length;
      if (S.tau >= CYC + (last ? HOLD : 0)) {
        if (!last) {
          S.tau -= CYC;
          press(S, S.i + 1);
        } else startReset(S, S.rest >= REST ? (S.m + 1) % NMSG : S.m, S.n, pvOf(S));
      }
    }
  } else if (S.tau >= RESET) {
    load(S, S.nextM, S.nextN);
  }
  S.pv = pvOf(S);
  // The text slides left once the newest letter would pass the right edge.
  const shown = S.i + 1;
  const end = 1 + 4 * max(0, shown - 1) + 2 * floor(max(0, shown - 1) / 5) + 3;
  S.scroll += (max(0, end - 63) - S.scroll) * min(1, d * 12);
  if (S.phase === "reset") S.sf = max(0, 1 - S.tau / FADE);
}

// ---- drawing
function lines(S, C) {
  const n = S.i + 1;
  const arrived = S.phase === "reset" || (S.cur && S.tau >= CUR0 + TOTAL);
  const nc = arrived ? n : n - 1;
  for (let line = 0; line < 2; line++) {
    const y = line ? 118 : 110, c = line ? C.up : C.down, cnt = line ? nc : n;
    for (let j = 0; j < max(cnt, 0); j++) {
      const x = round(1 + 4 * j + 2 * floor(j / 5) - S.scroll);
      if (x < -3 || x > 63) continue;
      const newest = j === cnt - 1;
      const ch = line ? ABC[S.steps[j].out] : ABC[S.steps[j].inp];
      glyph(ch, x, y, 1, mix(c, WHITE, newest ? 0.5 : 0.15), (newest ? 1 : 0.8) * S.sf);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.steps) return;
  buf = S.buf;
  buf.fill(0);
  const C = palette(S.hue), pv = S.pv;
  const typing = S.phase === "type" && S.cur;
  const pos = typing ? S.cur.pos : S.u.map(m26);
  const clack = (k) => (typing && S.cur.stepped[k] && S.tau < STEP ? sin((PI * S.tau) / STEP) : 0);

  // The bands, top to bottom the right, the middle and the left rotor.
  for (let b = 0; b < 3; b++) {
    const k = 2 - b, fl = clack(k);
    for (let q = 0; q < 26; q++) wire(k, q, pv[k], LV[b], LV[b + 1], mix(C.wire[b], WHITE, fl * 0.1), 1 + 1.0 * fl, 0.35, 0, 1);
  }
  // The reflector, which never moves.
  PAIRS.forEach(([a, b], j) => arch(a, b, 0, 1, C.refl(j), C.refl(j), 1, true));
  // The fixed contacts.
  for (let l = 0; l < 4; l++)
    for (let i = 0; i < 26; i++) put(round(cx(i)), LV[l], C.pin[l === 3 ? 2 : l], 1);

  // The keycap, the lamp and the way to them.
  const arrive = CUR0 + TOTAL;
  const lampOn = typing && S.tau >= arrive;
  frameBox(1, 0, C.frame, 1);
  frameBox(53, 0, C.frame, 1);
  if (typing) {
    glyph(ABC[S.cur.inp], 3, 1, 2, mix(C.down, WHITE, 0.3), 1);
    frameBox(1, 0, C.down, 0.9);
  }
  if (lampOn) {
    glyph(ABC[S.cur.out], 55, 1, 2, mix(C.up, WHITE, 0.3), 1);
    frameBox(53, 0, C.up, 0.9);
  }

  // The current, a stage at a time.
  if (typing && S.tau >= CUR0) {
    const t = S.tau - CUR0, L = S.cur.path;
    const held = cl((S.tau - arrive) / (CYC - arrive), 0, 1);
    const v = 1 - 0.35 * held;
    const f = (s) => cl((t - T0[s]) / DUR[s], 0, 1);
    let head = null;
    const mark = (s, p) => {
      if (f(s) > 0 && f(s) < 1) head = [p, s];
    };
    const kx = round(cx(L[0])), lx = round(cx(L[7]));
    mark(0, poly([[KEYX, 13], [KEYX, 14], [kx, 14], [kx, 19]], f(0), C.down, v));
    for (let s = 1; s <= 3; s++) {
      const b = s - 1, k = 2 - b, q = m26(L[b] + pos[k]);
      if (f(s) > 0) wire(k, q, pv[k], LV[b], LV[b + 1], C.down, v, 1.0, 0, f(s));
      if (f(s) > 0 && f(s) < 1) head = [[wireX(k, q, pv[k], f(s)), LV[b] + f(s) * (LV[b + 1] - LV[b])], 1];
    }
    if (f(4) > 0) arch(L[3], L[4], 0, f(4), C.down, C.up, v, false);
    if (f(4) > 0 && f(4) < 1) head = [archAt(L[3], L[4], f(4)), 4];
    for (let s = 5; s <= 7; s++) {
      const b = 7 - s, k = 2 - b, q = BWD[k][m26(L[6 - b] + pos[k])];
      if (f(s) > 0) wire(k, q, pv[k], LV[b], LV[b + 1], C.up, v, 1.0, 1 - f(s), 1);
      if (f(s) > 0 && f(s) < 1) head = [[wireX(k, q, pv[k], 1 - f(s)), LV[b + 1] - f(s) * (LV[b + 1] - LV[b])], 5];
    }
    mark(8, poly([[lx, 19], [lx, 16], [LAMPX, 16], [LAMPX, 13]], f(8), C.up, v));
    // A contact the current has reached lights on its row.
    const bead = (s, lev, c, i) => {
      if (f(s) < 1) return;
      const x = round(cx(i)), hot = mix(c, WHITE, 0.45);
      put(x, LV[lev], hot, v);
      put(x - 1, LV[lev], c, 0.55 * v);
      put(x + 1, LV[lev], c, 0.55 * v);
    };
    bead(0, 0, C.down, L[0]);
    for (let s = 1; s <= 3; s++) bead(s, s, C.down, L[s]);
    bead(4, 3, C.up, L[4]);
    for (let s = 5; s <= 7; s++) bead(s, 7 - s, C.up, L[s]);
    if (head) glow(head[0], head[1] < 4 ? C.down : C.up);
  }

  // The windows between the keycap and the lamp, left, middle and right rotor,
  // each in the colour of its band; then the dots and the two lines of text.
  for (let j = 0; j < 3; j++) {
    const band = 2 - j, fl = clack(j), x = 20 + 9 * j;
    glyph(ABC[pos[j]], x, 1, 2, mix(C.pin[band], WHITE, 0.4 + 0.5 * fl), 1);
    for (let i = 0; i < 6; i++) put(x + i, 12, C.pin[band], 0.8);
  }
  for (let i = 0; i < NMSG; i++) {
    const on = i === S.m;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(40 + 4 * i + dx, 125 + dy, on ? mix(C.up, WHITE, 0.3) : C.frame, on ? 1 : 0.7);
  }
  lines(S, C);

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) {
      const r = buf[o], g = buf[o + 1], bl = buf[o + 2];
      if (r + g + bl > 0.004) display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, bl * 255));
    }
}
