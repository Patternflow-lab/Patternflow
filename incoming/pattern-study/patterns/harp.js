// ===== Patternflow pattern =====
// Title:   Harp
// Family:  music
// Idea:    A concert pedal harp stands the full height of the panel, and each string an unseen harpist plucks blurs into the lens of its vibration and rings away, the bass widest and longest.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the double-action pedal harp (Sebastien Erard, 1810) and the envelope of a plucked string
// Round:   16
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Tempo=0.5..3.5, Figure=0..3, Damp=0..1
//
// Knob 1: Light. The colour of the stage light on the backdrop and in the ringing strings, starting from a deep blue behind the gilt harp.
// Knob 2: Tempo. Beats a second: 2 is 120 to the minute, 0.5 is 30 and 3.5 is 210.
// Knob 3: Figure. What the harpist plays: 0 broken chords rising across the strings with a rolled chord and a glissando at each cadence, 1 rolled chords in both hands, 2 a tune in harmonics, each string ringing in two halves around a still middle, 3 pedal glissandi up and down every bar over the bass.
// Knob 4: Damp. At the start the strings ring freely, the bass for three seconds; turned up, the left hand stops the bass at each change of chord, and at 1 the palm stops every note as soon as it sounds.
// Buttons: K1 tap is a glissando up all 29 strings and back down. K2 tap changes key a fifth up: a pedal drops a notch and the discs on that note's strings turn.

const W = 64;
const H = 128;
// 29 strings from C2 to C6, one LED wide with one LED between them: string i
// stands in column 5 + 2i. A concert harp has 47, from C1 to G7; the panel
// holds four octaves and a C.
const NS = 29;
const SX0 = 5;
// The underside and the top of the neck, as points the curve passes through.
// It rises a little off the column, sags over the tenor strings and climbs
// again to the shoulder: the harmonic curve.
const NECK_UNDER = [[0, 12.5], [4, 12.5], [8, 12], [14, 13], [22, 16.5], [30, 20.5], [38, 23.5], [45, 24.5], [51, 23.5], [56, 20.5], [60, 16.5], [63, 14], [67, 13]];
const NECK_TOP = [[0, 4], [4, 4], [8, 4], [14, 5.5], [22, 9.5], [30, 14], [38, 17.5], [45, 18.5], [51, 17.5], [56, 14], [59, 11], [61.5, 9.5], [64, 9.5], [67, 11]];
// The soundboard is straight, from the foot of C2 to the foot of C6.
const SB_X0 = 5;
const SB_Y0 = 116;
const SB_X1 = 61;
const SB_Y1 = 27;
// The base: its top, its bottom, and its back end.
const BASE_TOP = 116;
const BASE_BOT = 124;
const BASE_X1 = 26;
// The seven pedals in their slots, as the harpist's feet meet them: D C B on
// the left, E F G A on the right. Up is flat, the middle notch natural, down sharp.
const PEDAL_NOTE = [1, 0, 6, 2, 3, 4, 5];
const PEDAL_X = [4, 7, 10, 15, 18, 21, 24];
// Keys a fifth apart add a sharp in this order and take a flat in the other.
const SHARPS = [3, 0, 4, 1, 5, 2, 6];
// Four bars to a phrase, as chords on scale degrees counted from 0. In minor
// the seventh is raised, so V is major and III and VII are left out.
const PROG_MAJOR = [[0, 5, 3, 4], [0, 3, 4, 4], [0, 5, 1, 4], [0, 2, 3, 4], [3, 4, 0, 4], [0, 4, 5, 4]];
const PROG_MINOR = [[0, 5, 3, 4], [0, 3, 4, 4], [0, 3, 5, 4], [5, 3, 4, 4]];
// Broken-chord shapes, as steps up the chord's strings from the bass root,
// and the beat each note takes: rising eighths, a rise and fall in triplets,
// and a rocking figure that leaves the bass and swings in the treble.
const ARPS = [[[0, 2, 3, 4, 5, 6, 7, 8], 0.5], [[0, 2, 3, 4, 5, 6, 7, 8, 9, 8, 7, 6], 1 / 3], [[0, 4, 6, 7, 9, 7, 6, 4], 0.5]];
// The tune in harmonics: rhythms for a bar, in beats.
const TUNES = [[2, 1, 1], [1, 1, 2], [1, 1, 1, 1], [3, 1], [2, 2]];
// How much of a string's light the LED either side of it catches.
const GLOW = 0.3;
// Brass for the discs and pedals, and the flash of a disc as it turns.
const BRASS = [205, 160, 70];
const GLINT = [50, 80, 120];
// A string at rest, as a share of its full colour; the edges of a ringing
// string's blur against its flash; and the stage-lit halo round it.
const IDLE = 0.38;
const EDGE = 1.05;
const HALO = 0.3;

function hsvInto(out, h, s, v) {
  for (let c = 0; c < 3; c++) {
    const k = (5 - 2 * c + 6 * (h - Math.floor(h))) % 6;
    out[c] = 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// A Catmull-Rom curve through the points, read off at every column.
function catmull(a, b, c, d, t) {
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
}

function curve(pts) {
  const out = new Float32Array(W);
  let px = pts[0][0];
  let py = pts[0][1];
  for (let k = 0; k < pts.length - 1; k++) {
    const p = [pts[Math.max(0, k - 1)], pts[k], pts[k + 1], pts[Math.min(pts.length - 1, k + 2)]];
    for (let s = 1; s <= 32; s++) {
      const x = catmull(p[0][0], p[1][0], p[2][0], p[3][0], s / 32);
      const y = catmull(p[0][1], p[1][1], p[2][1], p[3][1], s / 32);
      for (let c = Math.max(0, Math.ceil(px)); c <= Math.floor(x) && c < W; c++) out[c] = py + ((y - py) * (c - px)) / (x - px);
      px = x;
      py = y;
    }
  }
  return out;
}

function boardY(x) {
  return SB_Y0 + ((x - SB_X0) * (SB_Y1 - SB_Y0)) / (SB_X1 - SB_X0);
}

// Paints one LED of the frame over what is there, with coverage a.
function paint(P, x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  if (a > 1) a = 1;
  const p = y * W + x;
  const o = p * 3;
  const fr = P.frame;
  fr[o] = r * a + fr[o] * (1 - a);
  fr[o + 1] = g * a + fr[o + 1] * (1 - a);
  fr[o + 2] = b * a + fr[o + 2] * (1 - a);
  P.alpha[p] = a + P.alpha[p] * (1 - a);
}

function gilt(P, x, y, f, a) {
  paint(P, x, y, 225 * f, 172 * f, 70 * f, a);
}

// The crown on top of the column, carved and gilded, from the finial down
// through the abacus, a pair of volutes and hanging leaves to the collar: 3 is
// a highlight, 2 gold, 1 shadow gold, 0 a deep cut, blank is open.
const CROWN = ["  121  ", "  232  ", " 12321 ", "1233332", "0111110", "2302032", "1233321", "0122210", " 12321 ", " 01210 ", " 1221  "];

function buildFrame(P) {
  const under = P.under;
  const top = P.top;
  // The soundbox, seen from the side: its flank tapers from 18 LEDs deep at
  // the base to 3 at the shoulder, and the back is built of staves, whose
  // seams show as lines that close in towards the top.
  const len = Math.hypot(SB_X0 - SB_X1, SB_Y0 - SB_Y1);
  const ux = (SB_X0 - SB_X1) / len;
  const uy = (SB_Y0 - SB_Y1) / len;
  for (let y = 0; y < BASE_TOP; y++)
    for (let x = 0; x < W; x++) {
      const vx = x + 0.5 - SB_X1;
      const vy = y + 0.5 - SB_Y1;
      // s runs down the soundboard from the shoulder, d out from it into the box.
      const s = (vx * ux + vy * uy) / len;
      const d = vx * uy - vy * ux;
      if (s < -0.15 || d < -1) continue;
      const D = 3 + 15 * s;
      const a = clamp01(d + 0.6) * clamp01(D - d + 0.5);
      if (a <= 0) continue;
      const q = clamp01((d - 1) / Math.max(1, D - 1));
      let f = 0.92 - 0.55 * q * q;
      for (const seam of [0.42, 0.68, 0.87]) f *= 1 - 0.4 * Math.exp(-3 * ((q - seam) * D) ** 2);
      // Maple, its grain running along the box.
      f *= 0.93 + 0.07 * Math.sin(s * 140 + q * 7);
      // The soundboard's edge, pale spruce, along the strings' feet.
      const e = clamp01(1.7 - d);
      paint(P, x, y, 165 * f + (228 - 165 * f) * e, 102 * f + (184 - 102 * f) * e, 48 * f + (96 - 48 * f) * e, a);
    }
  // The neck: a gilt rim along the top, dark wood with the tuning pins, and
  // the brass plates of the action along the bottom.
  for (let x = 3; x < W; x++) {
    const t = top[x];
    const u = under[x];
    for (let y = Math.floor(t); y <= Math.ceil(u); y++) {
      const a = clamp01(y + 1 - t) * clamp01(u - y);
      if (a <= 0) continue;
      const v = (y + 0.5 - t) / (u - t);
      if (v < 0.2) gilt(P, x, y, 0.95, a);
      else if (u - y < 2.2) paint(P, x, y, ...BRASS.map((c) => c * (u - y < 1.2 ? 0.54 : 0.72)), a);
      else paint(P, x, y, 92 * (1 - 0.35 * v), 52 * (1 - 0.35 * v), 24 * (1 - 0.35 * v), a);
    }
    // A tuning pin above every string.
    if (x >= SX0 && (x - SX0) % 2 === 0 && x <= SX0 + 2 * (NS - 1)) paint(P, x, Math.round(u - 3.6), 150, 150, 162, 1);
  }
  // The shoulder, where the neck sits on the top of the soundbox.
  for (let x = 62; x < W; x++)
    for (let y = Math.floor(under[x]); y < Math.ceil(boardY(x)) + 1; y++) {
      const f = 0.75 - 0.012 * (y - under[x]);
      paint(P, x, y, 150 * f, 92 * f, 42 * f, 1);
    }
  // A gilt scroll curling on the shoulder.
  const SCROLL = [[60, 10, 0.7], [61, 9, 1.1], [62, 9, 1.15], [63, 10, 0.95], [63, 11, 0.7], [62, 12, 0.6], [61, 11, 0.45], [62, 11, 1.05]];
  for (const [x, y, f] of SCROLL) gilt(P, x, y, f, 1);
  // The column, gilt and round: lit from the front, so the second LED takes
  // the highlight. Carved leaves hang under the crown and over the foot.
  const SHADE = [0.55, 1.05, 0.78, 0.42];
  for (let y = 9; y < BASE_TOP; y++) {
    let wide = 0;
    let carve = 0;
    if (y >= 10 && y < 24) {
      const ly = (y - 10) % 5;
      carve = ly < 3 ? 1 : 0;
      wide = ly === 2 ? 1 : 0;
    } else if (y === 24 || y === 25 || y === 101 || y === 102) wide = 1;
    else if (y >= 103 && y < 113) {
      const ly = (y - 103) % 5;
      carve = ly > 1 ? 1 : 0;
      wide = ly === 3 ? 1 : 0;
    } else if (y >= 113) wide = 2;
    for (let x = 0; x < 4 + wide; x++) {
      let f = x < 4 ? SHADE[x] : 0.5;
      if (carve && x > 0) f *= (x + y) % 2 === 0 ? 1.12 : 0.72;
      if (y === 24 || y === 101) f *= 1.15;
      gilt(P, x, y, f, 1);
    }
  }
  for (let y = 0; y < CROWN.length; y++)
    for (let x = 0; x < CROWN[y].length; x++) {
      const c = CROWN[y][x];
      if (c === " ") continue;
      gilt(P, x, y, c === "3" ? 1.15 : c === "2" ? 0.88 : c === "1" ? 0.6 : 0.3, 1);
    }
  // The base: gilt mouldings above and below dark wood, the pedal slots, and four feet.
  for (let x = 0; x <= BASE_X1; x++)
    for (let y = BASE_TOP; y <= BASE_BOT; y++) {
      if (y > BASE_TOP && y < BASE_BOT) paint(P, x, y, 70, 40, 18, 1);
      else gilt(P, x, y, y === BASE_TOP ? 0.95 : 0.6, 1);
    }
  for (let k = 0; k < 7; k++) for (let y = BASE_TOP + 2; y <= BASE_BOT - 2; y++) paint(P, PEDAL_X[k], y, 16, 10, 6, 1);
  for (let y = BASE_BOT + 1; y < H - 1; y++)
    for (let x = 0; x <= BASE_X1; x++) if (x <= 3 || x >= BASE_X1 - 4) gilt(P, x, y, 0.62 - 0.2 * (y - BASE_BOT - 1), 1);
}

function buildStrings(P) {
  const under = P.under;
  for (const k of ["sx", "sTop", "sBot", "disc1", "disc2", "lenN", "tauN"]) P[k] = new Float32Array(NS);
  P.col = new Float32Array(NS * 3);
  let L0 = 0;
  for (let i = 0; i < NS; i++) {
    const x = SX0 + 2 * i;
    P.sx[i] = x;
    // From the bridge pin under the neck down into the soundboard.
    P.sTop[i] = under[x] + 0.3;
    P.sBot[i] = boardY(x);
    const L = P.sBot[i] - P.sTop[i];
    if (i === 0) L0 = L;
    P.lenN[i] = L / L0;
    // Each disc grips the string a semitone shorter: the natural disc
    // 1 - 2^(-1/12) of its length below the bridge pin, the sharp 1 - 2^(-1/6).
    P.disc1[i] = P.sTop[i] + 0.0561 * L;
    P.disc2[i] = P.sTop[i] + 0.1091 * L;
    // How long a free string rings, in seconds.
    P.tauN[i] = 0.42 + 0.85 * P.lenN[i];
    // Every C red, every F dark blue, the rest gut. The five lowest are
    // wound wire, bronze, keeping a tint of their colour.
    const n = i % 7;
    const c = n === 0 ? [240, 48, 38] : n === 3 ? [38, 62, 215] : [235, 205, 155];
    const m = i >= 5 ? 0 : n === 0 || n === 3 ? 0.45 : 0.75;
    const WIRE = [200, 150, 98];
    for (let k = 0; k < 3; k++) P.col[i * 3 + k] = c[k] + (WIRE[k] - c[k]) * m;
  }
}

// Sets the pedals for a key, counted in fifths from C major; the discs of a
// pedal that moves flash as they turn.
function setKey(P, key, minor) {
  P.key = key;
  P.minor = minor;
  const major = (((4 * key) % 7) + 7) % 7;
  P.tonic = minor ? (major + 5) % 7 : major;
  const acc = [0, 0, 0, 0, 0, 0, 0];
  if (key > 0) for (let k = 0; k < key; k++) acc[SHARPS[k]] = 1;
  else for (let k = 0; k < -key; k++) acc[SHARPS[6 - k]] = -1;
  // Harmonic minor raises the seventh: the note under the minor tonic.
  if (minor) acc[(major + 4) % 7] += 1;
  for (let n = 0; n < 7; n++)
    if (acc[n] !== P.pedal[n]) {
      P.pedal[n] = acc[n];
      P.discGlint[n] = 1;
    }
}

function ev(P, at, i, f, kind) {
  if (i < 0 || i >= NS) return;
  P.events.push({ at, i, f, kind });
}

function roll(P, at, list, span, f) {
  for (let k = 0; k < list.length; k++) ev(P, at + (span * k) / Math.max(1, list.length - 1), list[k], f, 0);
}

function gliss(P, at, from, to, span, f) {
  const n = Math.abs(to - from);
  const dir = to > from ? 1 : -1;
  for (let k = 0; k <= n; k++) ev(P, at + (span * k) / Math.max(1, n), from + dir * k, f, 0);
}

function newPhrase(P) {
  if (P.prog) {
    const r = Math.random();
    if (r < 0.2 && P.key < 4) setKey(P, P.key + 1, P.minor);
    else if (r < 0.35 && P.key > -3) setKey(P, P.key - 1, P.minor);
    else if (r < 0.55) setKey(P, P.key, !P.minor);
  }
  P.prog = pick(P.minor ? PROG_MINOR : PROG_MAJOR);
  P.style = Math.floor(Math.random() * ARPS.length);
  P.tune = pick(TUNES);
  P.phraseBar = 0;
}

// One bar of music, written from beat `at`.
function compose(P, at, fig) {
  if (!P.prog || P.phraseBar >= 4) newPhrase(P);
  const b = P.phraseBar;
  const r = (P.tonic + P.prog[b]) % 7;
  const T = [];
  for (let i = 0; i < NS; i++) if ((i - r + 7) % 7 % 2 === 0 && (i - r + 7) % 7 < 6) T.push(i);
  const k0 = T.indexOf(r);
  const tone = (k) => T[Math.min(T.length - 1, k0 + k)];
  const cad = b === 3;
  // The left hand damps the bass strings that are not in the new chord.
  const stop = clamp01((P.damp - 0.12) / 0.4);
  if (stop > 0)
    for (let i = 0; i < 14; i++)
      if (T.indexOf(i) < 0) {
        P.amp[i] *= 1 - 0.85 * stop;
        P.glow[i] *= 1 - 0.85 * stop;
      }
  if (fig === 0) {
    if (cad) {
      roll(P, at, [r, r + 4, r + 7, tone(5), tone(6), tone(7), tone(8)], 0.3, 0.85);
      gliss(P, at + 2, 3, NS - 1, 1.5, 0.36);
    } else {
      const [steps, beat] = ARPS[P.style];
      for (let n = 0; n < steps.length; n++) ev(P, at + n * beat, tone(steps[n]), n === 0 ? 0.9 : 0.62, 0);
      // The left hand doubles the root an octave up and takes the fifth on the third beat.
      ev(P, at + 0.04, r + 7, 0.55, 0);
      ev(P, at + 2, r + 4, 0.6, 0);
    }
  } else if (fig === 1) {
    roll(P, at, [r, r + 4, r + 7], 0.15, 0.85);
    roll(P, at + 0.1, [tone(5), tone(6), tone(7), tone(8)], 0.18, 0.7);
    if (cad) gliss(P, at + 2, NS - 1, 3, 1.5, 0.36);
    else {
      roll(P, at + 2, [tone(4), tone(5), tone(6), tone(7)], 0.15, 0.55);
      roll(P, at + 3, [tone(6), tone(7), tone(8)], 0.12, 0.5);
    }
  } else if (fig === 2) {
    // The left hand breaks the chord under the tune: root, fifth, octave, fifth.
    ev(P, at, r, 0.7, 0);
    ev(P, at + 1, r + 4, 0.5, 0);
    ev(P, at + 2, r + 7, 0.5, 0);
    ev(P, at + 3, r + 4, 0.45, 0);
    // Harmonics sound best in the middle of the harp, so the tune keeps to
    // strings 9 to 22, starting each bar on the chord tone nearest the last note.
    let p = -99;
    for (const c of T) if (c >= 9 && c <= 22 && Math.abs(c - P.mel) < Math.abs(p - P.mel)) p = c;
    const rhythm = cad ? [4] : P.tune;
    let t = 0;
    for (let k = 0; k < rhythm.length; k++) {
      if (k > 0) {
        const step = Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : Math.random() < 0.5 ? -2 : 2;
        p += step;
        if (p < 9 || p > 22) p -= 2 * step;
      }
      ev(P, at + t, p, 0.95, 1);
      t += rhythm[k];
    }
    P.mel = p;
  } else {
    ev(P, at, r, 0.9, 0);
    ev(P, at + 0.04, r + 7, 0.6, 0);
    gliss(P, at + 0.25, r + 2, NS - 1, 1.75, 0.4);
    gliss(P, at + 2, NS - 1, r + 5, 2, 0.34);
  }
  P.phraseBar++;
}

function pluck(P, i, f, kind) {
  const a0 = f * (1.3 + 3.4 * P.lenN[i]) * (kind ? 0.7 : 1);
  P.amp[i] = Math.max(P.amp[i] * 0.4, a0);
  P.age[i] = 0;
  P.mode[i] = kind ? 2 : 1;
  // Harpists play near the middle of the string; a harmonic is the upper half
  // plucked while the palm touches the middle.
  P.pp[i] = kind ? 0.25 : 0.42 + 0.16 * Math.random();
  P.glow[i] = Math.min(1.2, Math.max(P.glow[i], f));
  // The same note an octave and two octaves down rings in sympathy, on the
  // partial that matches: the octave below in two halves, the next in four.
  for (let m = 2; m <= 4; m *= 2) {
    const j = i - (m === 2 ? 7 : 14);
    if (j < 0) break;
    const s = (0.45 * f * (1.3 + 3.4 * P.lenN[j])) / Math.sqrt(m);
    if (P.amp[j] < s) {
      P.amp[j] = s;
      P.mode[j] = m;
      P.age[j] = 1;
      P.glow[j] = Math.max(P.glow[j], 0.25 * f);
    }
  }
}

export function setup(params) {
  params.under = curve(NECK_UNDER);
  params.top = curve(NECK_TOP);
  for (const k of ["frame", "bg", "buf"]) params[k] = new Float32Array(W * H * 3);
  params.alpha = new Float32Array(W * H);
  buildFrame(params);
  buildStrings(params);
  params.cw = new Float32Array(32);
  params.tint = new Float32Array(3);
  params.lightAt = -1;
  for (const k of ["amp", "age", "pp", "mode", "glow"]) params[k] = new Float32Array(NS);
  for (const k of ["pedal", "pedalPos", "discGlint"]) params[k] = new Float32Array(7);
  params.events = [];
  params.beat = 0;
  params.nextBar = 0;
  params.prog = null;
  params.mel = 16;
  params.light = 0;
  setKey(params, 0, false);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(dt, 0.1);
  P.light = k[0];
  P.tempo = Math.max(0.1, k[1]);
  const fig = Math.max(0, Math.min(3, Math.round(k[2])));
  P.damp = clamp01(k[3]);
  P.beat += dt * P.tempo;
  if (input.btnPressed && input.btnPressed[0]) {
    const span = 0.9 * P.tempo;
    gliss(P, P.beat, 0, NS - 1, span, 0.6);
    gliss(P, P.beat + span + 0.1 * P.tempo, NS - 2, 0, span, 0.5);
  }
  if (input.btnPressed && input.btnPressed[1]) setKey(P, P.key >= 4 ? -3 : P.key + 1, P.minor);
  while (P.nextBar <= P.beat) {
    compose(P, P.nextBar, fig);
    P.nextBar += 4;
  }
  const evs = P.events;
  for (let e = evs.length - 1; e >= 0; e--)
    if (evs[e].at <= P.beat) {
      const v = evs.splice(e, 1)[0];
      pluck(P, v.i, v.f, v.kind);
    }
  const free = (1 - P.damp) ** 1.5;
  for (let i = 0; i < NS; i++) {
    const tau = 0.07 + P.tauN[i] * free;
    P.amp[i] *= Math.exp(-dt / tau);
    P.glow[i] *= Math.exp(-dt / (tau * 1.5));
    P.age[i] += dt;
  }
  for (let n = 0; n < 7; n++) {
    P.discGlint[n] *= Math.exp(-dt / 0.35);
    P.pedalPos[n] += (P.pedal[n] - P.pedalPos[n]) * Math.min(1, dt * 9);
  }
}

// The stage light's hue along the knob: deep blue, violet, magenta and red,
// then quickly past amber and yellow, which read as brown and olive this dim,
// to green and teal and back to blue.
const GEL = [[0, 0.62], [0.15, 0.76], [0.3, 0.88], [0.46, 0.99], [0.58, 1.3], [0.8, 1.48], [1, 1.62]];

function gel(k) {
  for (let i = 1; i < GEL.length; i++)
    if (k <= GEL[i][0]) return GEL[i - 1][1] + ((GEL[i][1] - GEL[i - 1][1]) * (k - GEL[i - 1][0])) / (GEL[i][0] - GEL[i - 1][0]);
  return GEL[GEL.length - 1][1];
}

function backdrop(P) {
  const bg = P.bg;
  const tint = P.tint;
  hsvInto(tint, gel(P.light), 0.78, 1);
  // A cyclorama lit from the floor and dark at the top, and the stage floor
  // with a warm pool from the follow spot.
  const WARM = [255, 222, 175];
  for (let y = 0; y < H; y++) {
    const v = clamp01((y - 8) / 118);
    const lv = y >= H - 2 ? 0.1 : 0.03 + 0.37 * v * v;
    for (let x = 0; x < W; x++) {
      const pool = y >= H - 2 ? 0.22 * Math.exp(-((x - 22) * (x - 22)) / 500) : 0;
      for (let c = 0; c < 3; c++) bg[(y * W + x) * 3 + c] = tint[c] * lv + WARM[c] * pool;
    }
  }
  P.lightAt = P.light;
}

export function draw(display, params) {
  const P = params;
  if (P.lightAt !== P.light) backdrop(P);
  const buf = P.buf;
  buf.set(P.bg);
  const PI = Math.PI;
  const tint = P.tint;
  const cw = P.cw;
  for (let i = 0; i < NS; i++) {
    const x = P.sx[i];
    const ci = i * 3;
    const B = IDLE + 0.7 * P.glow[i];
    const top = P.sTop[i];
    const yB = P.sBot[i];
    const acc = P.pedal[i % 7];
    const yA = acc < 0 ? top : acc === 0 ? P.disc1[i] : P.disc2[i];
    const a = P.amp[i];
    const span = yB - yA;
    const p = P.pp[i];
    const kink = Math.exp(-P.age[i] / 0.12);
    const mode = P.mode[i];
    for (let y = Math.floor(top); y < Math.ceil(yB); y++) {
      const cv = Math.min(y + 1, yB) - Math.max(y, top);
      if (cv <= 0) continue;
      let L = B * cv;
      // The wound strings glint along their winding.
      if (i < 5 && y % 2 === 1) L *= 0.85;
      const u = (y + 0.5 - yA) / span;
      let wp = 0;
      let wn = 0;
      if (a > 0.05 && u > 0 && u < 1) {
        if (mode > 1) wp = wn = a * Math.abs(Math.sin(mode * PI * u));
        else {
          const sn = Math.sin(PI * u);
          // Just after the pluck the string is two straight pieces with a corner
          // where the finger left it, and half a period later the same shape
          // turned over; the corners round off as the high partials die.
          const t1 = u < p ? u / p : (1 - u) / (1 - p);
          const t2 = u < 1 - p ? u / (1 - p) : (1 - u) / p;
          wp = a * (sn + (t1 - sn) * kink);
          wn = a * (sn + (t2 - sn) * kink);
        }
      }
      const h = 0.5 * (wp + wn);
      const c0 = 0.5 * (wp - wn);
      if (h < 0.04) {
        addLight(buf, x, y, P.col, ci, L);
        continue;
      }
      // A string swinging from side to side spends most of its time near the
      // ends of its swing, so the blur is brightest at its two edges. Each LED
      // takes the share of the swing it holds, squared against the edge's, so
      // the lens draws as two bright curves with the neighbours seen between.
      const lo = Math.floor(c0 - h + 0.5);
      const hi = Math.floor(c0 + h + 0.5);
      let Fp = 0;
      let top1 = 0;
      for (let dx = lo; dx <= hi; dx++) {
        const z = (dx + 0.5 - c0) / h;
        const Fz = z >= 1 ? 1 : z <= -1 ? 0 : 0.5 + Math.asin(z) / PI;
        const cov = Fz - Fp;
        Fp = Fz;
        cw[dx - lo] = cov;
        if (cov > top1) top1 = cov;
      }
      L *= EDGE / (top1 * top1);
      for (let dx = lo; dx <= hi; dx++) {
        const cov = cw[dx - lo];
        if (cov > 0) addLight(buf, x + dx, y, P.col, ci, L * cov * cov);
      }
      // The ringing string lights the air around it faintly in the stage light.
      const hl = HALO * P.glow[i] * Math.min(1, h);
      if (hl > 0.004) {
        const reach = h + 2.5;
        const h0 = Math.ceil(c0 - reach);
        const h1 = Math.floor(c0 + reach);
        for (let dx = h0; dx <= h1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const w = hl * (1 - Math.abs(dx - c0) / (reach + 0.5));
          for (let c = 0; c < 3; c++) buf[(y * W + xx) * 3 + c] += tint[c] * w;
        }
      }
    }
  }
  // The frame goes over the strings.
  const fr = P.frame;
  const al = P.alpha;
  for (let p = 0; p < W * H; p++) if (al[p] > 0) for (let o = p * 3; o < p * 3 + 3; o++) buf[o] = fr[o] + buf[o] * (1 - al[p]);
  // The discs under the neck: brass, bright where they grip the string, and
  // flashing as they turn when the pedal for their note moves.
  for (let i = 0; i < NS; i++) {
    const n = i % 7;
    const x = P.sx[i];
    const gl = P.discGlint[n];
    for (let k = 0; k < 2; k++) {
      const y = Math.round(k === 0 ? P.disc1[i] : P.disc2[i]);
      if (y <= P.under[x] + 0.5) continue;
      const f = P.pedal[n] >= k ? 1 : 0.55;
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) buf[o + c] = BRASS[c] * f + GLINT[c] * gl;
    }
  }
  // The pedals in their notches.
  for (let k = 0; k < 7; k++) {
    const n = PEDAL_NOTE[k];
    const yy = BASE_TOP + 4 + 2 * P.pedalPos[n];
    const y0 = Math.floor(yy);
    const fy = yy - y0;
    const gl = 1.05 + 0.4 * P.discGlint[n];
    for (let x = PEDAL_X[k]; x <= PEDAL_X[k] + 1; x++)
      for (let j = 0; j < 2; j++) {
        const w = j === 0 ? 1 - fy : fy;
        const o = ((y0 + j) * W + x) * 3;
        for (let c = 0; c < 3; c++) buf[o + c] += (BRASS[c] * gl - buf[o + c]) * w;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, knee(buf[o]), knee(buf[o + 1]), knee(buf[o + 2]));
    }
}

// Light past 170 rolls off towards 255, so strings ringing together keep their
// edges instead of clipping into one white patch.
function knee(v) {
  return v < 170 ? v : 255 - 85 * Math.exp(-(v - 170) / 85);
}

// A string's light on one LED, and GLOW of it on the LED either side.
function addLight(buf, x, y, col, ci, L) {
  for (let d = -1; d <= 1; d++) {
    if (x + d < 0 || x + d >= W) continue;
    const s = d === 0 ? L : L * GLOW;
    for (let c = 0; c < 3; c++) buf[(y * W + x + d) * 3 + c] += col[ci + c] * s;
  }
}
