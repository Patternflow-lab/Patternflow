// ===== Patternflow pattern =====
// Title:   Player Piano
// Family:  music
// Idea:    A pianola composing as it plays: a perforated roll comes off its spool and runs down over the tracker bar, and every slot that crosses the bar holds its key down and lights it.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the pianola and its punched music rolls (Edwin Votey, 1895)
// Round:   15
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Tempo=0.5..3.5, Hands=2..5, Pedal=0..1
//
// Knob 1: Hue. Turns the colours of the parts together, starting from a gold tune over a blue bass.
// Knob 2: Tempo. Beats a second: 2 is 120 to the minute and the paper runs 16 LEDs a second; 0.5 is 30 to the minute, 3.5 is 210.
// Knob 3: Hands. 2 is what one pianist plays: a tune with a second note under its long ones, and a left hand of long bass slots and chords in rows. 3 adds broken chords running up the roll as diagonals, 4 is a duet with the tune and the bass in octaves, and 5 is more than any pianist could play, adding a run of sixteenths across the whole keyboard, up one bar and down the next.
// Knob 4: Pedal. At 0 each slot stops a little short of its note, a quarter note 2.4 rows short; turned up, the sustain pedal holds the notes on towards the bar line, and at 1 every slot runs to it, so each bar's tune and broken chords stand as staircases and the keys ring on after they rise.
// Buttons: K1 tap punches a glissando into the roll as it leaves the spool, and the music after it is in a new key, a fourth higher.

const W = 64;
const H = 128;
// One LED column per semitone: column 0 is E1, middle C is column 32, column 63 is G6.
const LOW = 28;
// Rows of paper per sixteenth note: a beat is 8 rows, a bar of 4/4 is 32.
const R = 2;
// The music roll on its spool, rows 0..6; the paper runs from row 7 down to the bar.
const SPOOL = 7;
// The tracker bar, rows 105..107. A slot sounds while it covers the holes in row 106.
const BAR_Y = 105;
const READ = 106.5;
// The keys, rows 109..127; black keys stop at row 119.
const KEY_Y = 109;
const BLACK_END = 120;
const BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
// How much of a slot's light the paper on either side of it catches.
const GLOW = 0.35;

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
// Four chords to a progression, as scale degrees counted from 0.
const PROG_MAJOR = [
  [0, 4, 5, 3],
  [0, 5, 3, 4],
  [1, 4, 0, 0],
  [0, 3, 4, 0],
  [5, 3, 0, 4],
  [0, 2, 3, 4],
  [0, 3, 1, 4],
  [3, 4, 2, 5],
];
const PROG_MINOR = [
  [0, 5, 2, 6],
  [0, 3, 4, 0],
  [0, 6, 5, 4],
  [0, 3, 6, 4],
];
// A bar of tune is one of these rhythms, in sixteenths.
const MOTIFS = [
  [4, 4, 4, 4],
  [6, 2, 4, 4],
  [4, 2, 2, 4, 4],
  [8, 4, 4],
  [2, 2, 4, 2, 2, 4],
  [3, 3, 2, 4, 4],
  [6, 2, 6, 2],
  [2, 2, 2, 2, 8],
  [4, 4, 2, 2, 2, 2],
];
const ENDINGS = [[4, 4, 8], [8, 8], [12, 4], [16], [6, 2, 8]];

// Parts. A slot carries a mask of the Hands settings that play it: bit 0 is 2 hands, bit 3 is 5.
const MELODY = 0;
const BASS = 1;
const CHORD = 2;
const ARP = 3;
const GLISS = 4;
const ALL = 15;

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pcOf(p) {
  return ((p % 12) + 12) % 12;
}

function scaleOf(params) {
  return params.minor ? MINOR : MAJOR;
}

// The pitch classes of the triad on a scale degree; a minor key's V takes the raised leading note.
function chordPcs(params, d) {
  const sc = scaleOf(params);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const deg = d + 2 * i;
    let pc = sc[deg % 7];
    if (params.minor && d === 4 && i === 1) pc += 1;
    out.push((params.tonic + pc) % 12);
  }
  return out;
}

function scalePcs(params, chord) {
  const sc = scaleOf(params);
  const out = [];
  for (let i = 0; i < 7; i++) out.push((params.tonic + sc[i]) % 12);
  // Over a minor key's V the tune uses the raised seventh too.
  for (let i = 0; i < chord.length; i++) if (out.indexOf(chord[i]) < 0) out[6] = chord[i];
  return out;
}

function nearestIn(pcs, target, lo, hi) {
  let best = lo;
  let bd = 1e9;
  for (let p = lo; p <= hi; p++) {
    if (pcs.indexOf(pcOf(p)) < 0) continue;
    const d = Math.abs(p - target);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function stepIn(pcs, p, n) {
  const dir = n < 0 ? -1 : 1;
  for (let k = 0; k < Math.abs(n); k++) {
    p += dir;
    while (pcs.indexOf(pcOf(p)) < 0) p += dir;
  }
  return p;
}

function nextAbove(pcs, p) {
  p++;
  while (pcs.indexOf(pcOf(p)) < 0) p++;
  return p;
}

function add(params, p, t0, d, hold, part, mask) {
  if (p < LOW || p >= LOW + W) return;
  params.slots.push({ p: p, t0: t0, d: d, hold: hold, part: part, mask: mask });
}

function newPhrase(params) {
  params.prog = pick(params.minor ? PROG_MINOR : PROG_MAJOR);
  params.rhythmA = pick(MOTIFS);
  params.rhythmB = pick(ENDINGS);
  // The motif's shape in scale steps: mostly one way, so a bar reads as a run.
  const dir = Math.random() < 0.5 ? -1 : 1;
  params.stepsA = params.rhythmA.map(() => {
    const r = Math.random();
    if (r < 0.1) return 0;
    const n = Math.random() < 0.75 ? 1 : 2;
    return r < 0.75 ? dir * n : -dir * n;
  });
  params.chordStyle = Math.floor(Math.random() * 4);
  params.arpStyle = Math.floor(Math.random() * 3);
  params.bassStyle = Math.floor(Math.random() * 2);
  params.phraseBar = 0;
}

// One bar of music, written onto the roll from tick t.
function composeBar(params, t) {
  if (params.phraseBar >= 8 || !params.prog) {
    if (params.prog && Math.random() < 0.3) {
      // Now and then the next phrase goes to the relative key.
      if (params.minor) params.tonic = (params.tonic + 3) % 12;
      else params.tonic = (params.tonic + 9) % 12;
      params.minor = !params.minor;
    }
    newPhrase(params);
  }
  const i = params.phraseBar;
  const degree = params.prog[i % 4];
  const pcs = chordPcs(params, degree);
  const scale = scalePcs(params, pcs);
  const end = t + 16;

  // The bass: the root in long slots, low in the keyboard, moving as little as it can.
  const root = nearestIn([pcs[0]], params.bass, 33, 47);
  params.bass = root;
  if (params.bassStyle === 0) {
    add(params, root, t, 16, end, BASS, ALL);
    add(params, root - 12, t, 16, end, BASS, 12);
  } else {
    const fifth = nearestIn([pcs[2]], root + 5, root - 7, root + 9);
    add(params, root, t, 8, t + 8, BASS, ALL);
    add(params, fifth, t + 8, 8, end, BASS, ALL);
    add(params, root - 12, t, 8, t + 8, BASS, 12);
    add(params, fifth - 12, t + 8, 8, end, BASS, 12);
  }

  // The left hand's chords: close triads that move to the nearest inversion.
  let best = null;
  let bd = 1e9;
  for (let b = 50; b <= 62; b++) {
    if (pcs.indexOf(pcOf(b)) < 0) continue;
    const v1 = nextAbove(pcs, b);
    const v = [b, v1, nextAbove(pcs, v1)];
    const prev = params.voicing;
    const dist = Math.abs(v[0] - prev[0]) + Math.abs(v[1] - prev[1]) + Math.abs(v[2] - prev[2]);
    if (dist < bd) {
      bd = dist;
      best = v;
    }
  }
  params.voicing = best;
  const hits =
    params.chordStyle === 0 ? [[0, 16]] : params.chordStyle === 1 ? [[0, 4], [4, 4], [8, 4], [12, 4]] : params.chordStyle === 2 ? [[4, 4], [12, 4]] : [[0, 6], [6, 10]];
  for (let h = 0; h < hits.length; h++) {
    const at = t + hits[h][0];
    for (let k = 0; k < 3; k++) add(params, best[k], at, hits[h][1], end, CHORD, ALL);
    add(params, best[0] + 12, at, hits[h][1], end, CHORD, 12);
  }

  // Broken chords in eighths, climbing from the root across two octaves and more.
  const tones = [nearestIn([pcs[0]], 43, 38, 50)];
  for (let k = 1; k < 8; k++) tones.push(nextAbove(pcs, tones[k - 1]));
  const order = params.arpStyle === 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : params.arpStyle === 1 ? [0, 1, 2, 3, 4, 3, 2, 1] : [7, 6, 5, 4, 3, 2, 1, 0];
  for (let k = 0; k < 8; k++) add(params, tones[order[k]], t + 2 * k, 2, end, ARP, 14);
  // Five hands: sixteen chord tones in sixteenths, the whole keyboard in a bar,
  // up on one bar and down on the next.
  const run = [nearestIn([pcs[0]], 30, 28, 39)];
  for (let k = 1; k < 16; k++) run.push(nextAbove(pcs, run[k - 1]));
  const down = params.barCount % 2 === 1;
  for (let k = 0; k < 16; k++) add(params, run[down ? 15 - k : k], t + k, 2, end, ARP, 8);

  // The tune: the motif on the first three bars of each four, set on the chord,
  // and a cadence on the fourth.
  const cadence = i % 4 === 3;
  const rhythm = cadence ? params.rhythmB : params.rhythmA;
  // Over a phrase of eight bars the tune climbs an arch of about an octave and comes down.
  const arch = Math.sin((Math.PI * (i + 0.5)) / 8);
  const target = 64 + 18 * arch + 4 * Math.sin(params.barCount * 1.7);
  let p = nearestIn(pcs, target, 62, 86);
  let at = t;
  const notes = [];
  for (let k = 0; k < rhythm.length; k++) {
    if (k > 0) {
      if (cadence) {
        // The cadence settles on a chord tone, a step or two away.
        p = nearestIn(pcs, stepIn(scale, p, -1), p - 4, p + 2);
      } else {
        let q = stepIn(scale, p, params.stepsA[k] || 0);
        if (q > 86 || q < 62) q = stepIn(scale, p, -(params.stepsA[k] || 0));
        p = q;
      }
    }
    notes.push([p, at, rhythm[k]]);
    at += rhythm[k];
  }
  for (let k = 0; k < notes.length; k++) {
    const n = notes[k];
    add(params, n[0], n[1], n[2], end, MELODY, ALL);
    add(params, n[0] - 12, n[1], n[2], end, MELODY, 12);
    // The right hand takes a chord tone under the tune's long notes on the strong beats.
    if (n[2] >= 4 && (n[1] - t) % 8 === 0) add(params, nearestIn(pcs, n[0] - 6, n[0] - 9, n[0] - 3), n[1], n[2], end, MELODY, ALL);
  }
  params.mel = p;
  params.phraseBar++;
  params.barCount++;
}

// A glissando up the scale over two beats, then the new key's dominant held
// until the bar line, where the music starts again a fourth higher.
function glissando(params, from) {
  const slots = params.slots;
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    if (s.t0 >= from) slots.splice(i, 1);
    else {
      if (s.t0 + s.d > from) s.d = from - s.t0;
      if (s.hold > from) s.hold = from;
    }
  }
  params.tonic = (params.tonic + 5) % 12;
  const scale = [];
  for (let i = 0; i < 7; i++) scale.push((params.tonic + scaleOf(params)[i]) % 12);
  const notes = [];
  for (let p = nearestIn(scale, 34, 30, 40); p <= 88; p = nextAbove(scale, p)) notes.push(p);
  const span = 8;
  for (let k = 0; k < notes.length; k++) {
    const t0 = from + (span * k) / notes.length;
    add(params, notes[k], t0, 0.9, t0 + 0.9 + 3, GLISS, ALL);
  }
  const bar = Math.ceil((from + span + 4) / 16) * 16;
  const v = chordPcs(params, 4);
  const top = notes[notes.length - 1];
  const t1 = from + span;
  add(params, nearestIn([v[0]], 40, 33, 46), t1, bar - t1, bar, BASS, ALL);
  for (let k = 0; k < 3; k++) add(params, nearestIn([v[k]], 56 + 4 * k, 50, 70), t1, bar - t1, bar, CHORD, ALL);
  add(params, nearestIn(v, top - 3, 70, 86), t1, bar - t1, bar, MELODY, ALL);
  params.composed = bar;
  params.prog = null;
}

export function setup(params) {
  params.slots = [];
  params.s = 0;
  params.composed = 0;
  params.tonic = 0;
  params.minor = false;
  params.prog = null;
  params.phraseBar = 0;
  params.barCount = 0;
  params.mel = 74;
  params.bass = 40;
  params.voicing = [55, 60, 64];
  // How lit each key is, and which part last held it down.
  params.keyLevel = new Float32Array(W);
  params.keyPart = new Int8Array(W);
  params.open = new Int8Array(W);
  params.buf = new Float32Array(W * H * 3);
  params.col = new Float32Array(5 * 6 + 3);
  params.hue = 0;
  params.tempo = 2;
  params.hands = 2;
  params.pedal = 0.06;
}

function endOf(s, pedal) {
  // Without the pedal a slot stops short of its note's length: a quarter note
  // is cut 2.4 rows short, a whole note 3.
  const short = s.t0 + s.d - Math.min(1.5, 0.3 * s.d);
  const held = Math.max(short, s.hold - 0.5);
  return short + (held - short) * pedal;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 2, 0.06];
  dt = Math.min(dt, 0.1);
  params.hue = k[0];
  params.tempo = Math.max(0.1, k[1]);
  params.hands = Math.max(2, Math.min(5, Math.round(k[2])));
  params.pedal = Math.max(0, Math.min(1, k[3]));
  // Four sixteenths to a beat.
  params.s += dt * params.tempo * 4;
  const s = params.s;
  const top = s + (READ - SPOOL) / R;
  if (input.btnPressed && input.btnPressed[0]) glissando(params, Math.ceil(top / 4) * 4);
  while (params.composed < top + 8) {
    composeBar(params, params.composed);
    params.composed += 16;
  }
  // Paper that has gone under the tracker bar is wound away.
  const slots = params.slots;
  for (let i = slots.length - 1; i >= 0; i--) if (slots[i].hold < s - 4 && slots[i].t0 + slots[i].d < s - 4) slots.splice(i, 1);

  // Which keys the roll holds down now.
  const bit = 1 << (params.hands - 2);
  const open = params.open;
  open.fill(-1);
  for (let i = 0; i < slots.length; i++) {
    const sl = slots[i];
    if (!(sl.mask & bit)) continue;
    if (sl.t0 > s) continue;
    if (endOf(sl, params.pedal) <= s) continue;
    const x = sl.p - LOW;
    if (open[x] < 0 || sl.part < open[x]) open[x] = sl.part;
  }
  // A key rings on after it rises, longer with the pedal down.
  const fade = Math.exp(-dt / (0.12 + 0.9 * params.pedal));
  for (let x = 0; x < W; x++) {
    if (open[x] >= 0) {
      params.keyLevel[x] = 1;
      params.keyPart[x] = open[x];
    } else params.keyLevel[x] *= fade;
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  const s = params.s;
  const col = params.col;
  const hue = params.hue;
  // Each part's colour, pale for the light through the paper and full for a
  // key it holds down: tune gold, bass blue, chords pink, broken chords green,
  // and a glissando nearly white.
  const PART_HUE = [0.12, 0.6, 0.85, 0.42, 0.0];
  for (let i = 0; i < 5; i++) {
    hsvInto(col, i * 6, hue + PART_HUE[i], i === GLISS ? 0.1 : 0.55, 1);
    hsvInto(col, i * 6 + 3, hue + PART_HUE[i], i === GLISS ? 0.15 : 0.9, 1);
  }
  // The paper, dim and cool, lit from behind. Its tint swings between teal and
  // violet with the hue and never reaches the oranges, which read as brown this dim.
  hsvInto(col, 30, 0.64 + 0.12 * Math.sin(2 * Math.PI * hue), 0.3, 0.16);
  const pr = col[30];
  const pg = col[31];
  const pb = col[32];
  buf.fill(0);
  for (let y = 0; y < BAR_Y; y++) {
    let f = 1;
    if (y < SPOOL) {
      // The wound roll: a cylinder, brightest along its middle.
      const u = (y + 0.5 - SPOOL / 2) / (SPOOL / 2);
      f = 3 * (1 - 0.7 * u * u);
    } else {
      // Printed bar lines every 32 rows.
      const tick = s + (READ - (y + 0.5)) / R;
      const ph = tick / 16 - Math.floor(tick / 16);
      const d = Math.min(ph, 1 - ph) * 16 * R;
      if (d < 1) f += 0.8 * (1 - d);
      // The spool's shadow on the paper just below it.
      if (y === SPOOL) f *= 0.55;
    }
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      buf[o] = pr * f;
      buf[o + 1] = pg * f;
      buf[o + 2] = pb * f;
    }
  }
  // The slots, light coming through them. The paper beside a slot catches a
  // little of its light first, so the slots glow instead of standing as wires.
  const bit = 1 << (params.hands - 2);
  const slots = params.slots;
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      if (!(sl.mask & bit)) continue;
      const x = sl.p - LOW;
      const yb = READ - (sl.t0 - s) * R;
      const yt = READ - (endOf(sl, params.pedal) - s) * R;
      const y0 = Math.max(SPOOL, Math.floor(yt));
      const y1 = Math.min(BAR_Y - 1, Math.ceil(yb) - 1);
      const c = sl.part * 6;
      for (let y = y0; y <= y1; y++) {
        const cov = Math.min(y + 1, yb) - Math.max(y, yt);
        if (cov <= 0) continue;
        if (pass === 0) {
          const g = cov * GLOW;
          for (let n = -1; n <= 1; n += 2) {
            const xn = x + n;
            if (xn < 0 || xn >= W) continue;
            const o = (y * W + xn) * 3;
            buf[o] += col[c + 3] * g;
            buf[o + 1] += col[c + 4] * g;
            buf[o + 2] += col[c + 5] * g;
          }
          continue;
        }
        const o = (y * W + x) * 3;
        buf[o] = Math.max(buf[o], buf[o] + (col[c] - buf[o]) * cov);
        buf[o + 1] = Math.max(buf[o + 1], buf[o + 1] + (col[c + 1] - buf[o + 1]) * cov);
        buf[o + 2] = Math.max(buf[o + 2], buf[o + 2] + (col[c + 2] - buf[o + 2]) * cov);
      }
    }
  // The music still wound on the spool shows on its face as dark perforations,
  // foreshortened over the curve, travelling down as the spool turns.
  const top = s + (READ - SPOOL) / R;
  const rad = SPOOL / 2;
  for (let y = 0; y < SPOOL; y++) {
    const a0 = rad * (Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, (y + 1 - rad) / rad))));
    const a1 = rad * (Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, (y - rad) / rad))));
    const lo = top + a0 / R;
    const hi = top + a1 / R;
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      if (!(sl.mask & bit) || sl.t0 >= hi) continue;
      const e = endOf(sl, params.pedal);
      if (e <= lo) continue;
      const cov = (Math.min(hi, e) - Math.max(lo, sl.t0)) / (hi - lo);
      const o = (y * W + sl.p - LOW) * 3;
      const k = 1 - 0.75 * cov;
      buf[o] *= k;
      buf[o + 1] *= k;
      buf[o + 2] *= k;
    }
    // Brass flanges hold the roll at both ends.
    const u = (y + 0.5 - rad) / rad;
    const fl = 0.55 + 0.45 * (1 - u * u);
    for (let x = 0; x < W; x += W - 1) {
      const o = (y * W + x) * 3;
      buf[o] = 210 * fl;
      buf[o + 1] = 170 * fl;
      buf[o + 2] = 80 * fl;
    }
  }
  // The tracker bar: brass with a row of holes.
  const kp = params.keyPart;
  for (let x = 0; x < W; x++) {
    const lv = params.keyLevel[x];
    const c = kp[x] * 6 + 3;
    for (let y = BAR_Y; y < BAR_Y + 3; y++) {
      const o = (y * W + x) * 3;
      if (y === BAR_Y + 1) {
        buf[o] = 14 + (col[c] - 14) * lv;
        buf[o + 1] = 12 + (col[c + 1] - 12) * lv;
        buf[o + 2] = 10 + (col[c + 2] - 10) * lv;
      } else {
        const f = y === BAR_Y ? 1 : 0.6;
        buf[o] = 210 * f;
        buf[o + 1] = 170 * f;
        buf[o + 2] = 80 * f;
      }
    }
    // The keys.
    const pc = (LOW + x) % 12;
    const black = BLACK[pc] === 1;
    for (let y = KEY_Y; y < H; y++) {
      const o = (y * W + x) * 3;
      let r;
      let g;
      let b;
      if (black && y < BLACK_END) {
        r = 8;
        g = 8;
        b = 12;
        if (y === KEY_Y) r = g = b = 30;
      } else {
        const front = y === H - 1 ? 0.75 : 1;
        r = 150 * front;
        g = 146 * front;
        b = 134 * front;
        if (black) {
          r *= 0.8;
          g *= 0.8;
          b *= 0.8;
        }
      }
      // A key that is down lights in its part's colour; a black key's column
      // below its end belongs to the white keys either side.
      if (lv > 0.01 && (!black || y < BLACK_END)) {
        r += (col[c] - r) * lv;
        g += (col[c + 1] - g) * lv;
        b += (col[c + 2] - b) * lv;
      }
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[o]), Math.min(255, buf[o + 1]), Math.min(255, buf[o + 2]));
    }
}
