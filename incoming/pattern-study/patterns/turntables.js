// ===== Patternflow pattern =====
// Title:   Turntables
// Family:  music
// Idea:    Two turntables stacked over a mixer strip, their records spinning under a still band of room light that picks out the grooves, while the DJ holds the waiting record, lets it go on the beat and slides the crossfader over to it.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 18, after the direct-drive DJ turntable with its strobe-dotted platter rim and the two-channel mixer between a pair of them
// Round:   18
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pitch=-8..8, Scratch=0..1, Light=0..1
//
// Knob 1: Hue. Turns the record labels, the meters' LEDs, the crossfader's light and the tint of the room's light round the colour wheel, starting from an amber label over a teal one, green meters and a violet light.
// Knob 2: Pitch. Both pitch sliders in percent: the records turn at 33 1/3 rpm and the music at 124 BPM, each times 1 plus the pitch. The inner row of strobe dots stands still at 0 and the outer row at +3.3; at +2, where the panel opens, the inner row crawls forward and the outer row back.
// Knob 3: Scratch. How long and how hard the DJ scratches the waiting record before letting it go: at 0 only a short cue of small rocks over the first kick, at 1 five seconds of strokes up to a quarter turn, with the crossfader cutting the scratch in on every fast stroke.
// Knob 4: Light. Where the room's light falls, turning the sheen across both records through half a turn and brightening the plinths on that side. The records spin under it and it stays put, swaying a little once a turn because neither record is quite flat.

const W = 64;
const H = 128;
const N = W * H;
// Both decks' spindles, and their radii in LEDs: label, run-out, grooves, the record's
// edge, the slipmat and the platter rim with its two rows of strobe dots.
const CX = 32;
const CY = [29, 99];
const R_SPINDLE = 1.3;
const R_LABEL = 8.5;
const R_RUN = 10.5;
const R_GROOVE = 24.6;
const R_EDGE = 25.4;
const R_MAT = 26.2;
const R_RIM = 28.9;
// A record turns 33 1/3 times a minute, and the music is 124 beats a minute at pitch 0.
const OMEGA = ((2 * Math.PI) / 60) * (100 / 3);
const BPM = 124;
// Strobe dots: rows for pitch 0 and +3.3 %, 54 dots a row.
const DOTS = 54;
const ROWS = [0, 0.033];
// What each LED is: plinth, platter rim, slipmat, record edge, grooves, run-out, label, spindle.
const PLINTH = 0;
const RIM = 1;
const MAT = 2;
const EDGE = 3;
const GROOVE = 4;
const RUN = 5;
const LABEL = 6;
const SPINDLE = 7;
const MIXER = 8;
// Parts of the mix: the waiting deck is held and cued, then let go while the crossfader
// moves over, then it plays alone.
const CUE = 0;
const MIX = 1;
const PLAY = 2;
const SKIN = [205, 150, 112];
const SLEEVE = [34, 30, 44];
const CUFF = [200, 196, 205];
const SILVER = [178, 178, 188];
const LAMP = [255, 236, 206];

function hsv(h, s, v) {
  h -= Math.floor(h);
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return 255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// A groove profile for one side of a record, as brightness against radius every 1/50 LED:
// five tracks of fine modulated groove with a dark band between them.
function grooves() {
  const T = new Float32Array(1000);
  const cuts = [];
  for (let i = 1; i < 5; i++) cuts.push(R_RUN + 0.6 + ((R_GROOVE - R_RUN - 1) * (i + (Math.random() - 0.5) * 0.6)) / 5);
  let loud = 0.7;
  let a = Math.random();
  let b = Math.random();
  for (let i = 0; i < T.length; i++) {
    const r = R_RUN + i / 50;
    if (i % 45 === 0) (a = b), (b = Math.random());
    if (cuts.some((c) => Math.abs(r - c) < 0.25)) {
      T[i] = 0.08;
      loud = 0.45 + 0.55 * Math.random();
      continue;
    }
    const u = (i % 45) / 45;
    T[i] = loud * (0.35 + 0.65 * (a + (b - a) * u * u * (3 - 2 * u)));
  }
  return T;
}

export function setup(params) {
  const P = params;
  Object.assign(P, { t: 0, hue: 0, pitch: 0, scratch: 0, light: 0, live: 0, part: CUE, pt: 0, fader: 0, cut: 0, kick: 0, spot: [1, 0.4] });
  P.kind = new Uint8Array(N);
  P.deck = new Int8Array(N).fill(-1);
  P.rr = new Float32Array(N);
  P.th = new Float32Array(N);
  P.ai = new Uint16Array(N);
  P.g = new Float32Array(N);
  P.buf = new Float32Array(N * 3);
  P.sheen = new Float32Array(720);
  P.q = new Float64Array(14);
  const T = [grooves(), grooves()];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (y >= 58 && y < 70) {
        P.kind[p] = MIXER;
        continue;
      }
      const d = y < 58 ? 0 : 1;
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - CY[d];
      const r = Math.hypot(dx, dy);
      P.deck[p] = d;
      P.rr[p] = r;
      P.th[p] = Math.atan2(dy, dx);
      P.ai[p] = Math.floor(((P.th[p] + Math.PI) / (2 * Math.PI)) * 360) % 360;
      P.kind[p] = r < R_SPINDLE ? SPINDLE : r < R_LABEL ? LABEL : r < R_RUN ? RUN : r < R_GROOVE ? GROOVE : r < R_EDGE ? EDGE : r < R_MAT ? MAT : r < R_RIM ? RIM : PLINTH;
      if (P.kind[p] === GROOVE) {
        // The groove brightness averaged over the LED, from 16 points inside it.
        let s = 0;
        for (let j = 0; j < 16; j++) {
          const q = Math.hypot(dx - 0.5 + ((j & 3) + 0.5) / 4, dy - 0.5 + ((j >> 2) + 0.5) / 4);
          s += T[d][clamp(Math.round((q - R_RUN) * 50), 0, 999)];
        }
        // Pushed apart, so neighbouring rings of groove differ in the light.
        P.g[p] = clamp((s / 16 - 0.42) * 2.2 + 0.5, 0.04, 1);
      }
    }
  // Each deck: the record's angle and turn rate, the hand on it, the needle's radius, the
  // beat and the level its meter shows.
  P.decks = [0, 1].map((d) => ({
    phi: Math.random() * 6.28,
    rate: OMEGA,
    held: d === 1,
    hold: 0,
    hand: d === 1 ? 1 : 0,
    rock: 0,
    needle: d === 0 ? 17 + 4 * Math.random() : 23.5,
    beat: 0,
    vu: 0,
    peak: 0,
    peakT: 0,
    strobe: [Math.random(), Math.random()],
    dust: Array.from({ length: 14 }, () => [R_RUN + 1 + Math.random() * 13, Math.random() * 6.28]),
  }));
  P.decks[1].hold = P.decks[1].phi;
}

// How far the waiting record is pushed from where the hand caught it, in radians, s
// seconds into the cue: strokes while scratching, then small rocks back and forth over
// the first kick.
function stroke(P, s) {
  const S = 5 * P.scratch;
  if (s < 0.6) return 0;
  if (s < 0.6 + S) {
    const u = s - 0.6;
    const amp = 0.5 + P.scratch;
    // Two strokes a beat, each pushed sharply forward and drawn back slower, every other
    // one shorter, and the last two beats of every eight small.
    const beat = (u * BPM) / 60;
    const f = beat * 2 - Math.floor(beat * 2);
    const phrase = Math.floor(beat / 2) % 4 === 3 ? 0.3 : 1;
    return amp * phrase * (f < 0.35 ? f / 0.35 : 1 - (f - 0.35) / 0.65) * (Math.floor(beat * 2) % 2 ? 0.6 : 1);
  }
  return 0.22 * Math.sin((s - 0.6 - S) * 2 * Math.PI * 1.6);
}

function step(P, dt) {
  P.t += dt;
  P.pt += dt;
  const rate = OMEGA * (1 + P.pitch);
  const L = P.decks[P.live];
  const O = P.decks[1 - P.live];
  const side = P.live === 0 ? 0 : 1;
  const S = 5 * P.scratch;
  if (P.part === CUE) {
    // The hand comes down on the waiting record and holds it while the platter turns under the mat.
    const end = 0.6 + S + 1.4;
    O.hand = Math.min(1, O.hand + dt * 3);
    if (!O.held) {
      O.held = true;
      O.hold = O.phi;
    }
    const was = O.rock;
    O.rock = stroke(P, P.pt);
    O.phi = O.hold + O.rock;
    O.rate = (O.rock - was) / Math.max(dt, 1e-4);
    P.cut = P.pt > 0.6 && P.pt < 0.6 + S && Math.abs(O.rate) > 1.5 ? 1 : 0;
    P.fader = P.cut ? 1 - side : side;
    // Let go on the next kick of the playing record, in time with it.
    if (P.pt > end && L.beat % 1 < (rate / OMEGA) * dt * (BPM / 60) * 1.01) {
      O.held = false;
      O.beat = Math.floor(L.beat);
      P.part = MIX;
      P.pt = 0;
    }
  } else if (P.part === MIX) {
    const u = clamp(P.pt / 6, 0, 1);
    P.fader = side + (1 - 2 * side) * u * u * (3 - 2 * u);
    if (u >= 1) {
      P.part = PLAY;
      P.pt = 0;
    }
  } else if (P.pt > 12) {
    P.live = 1 - P.live;
    P.part = CUE;
    P.pt = 0;
  }
  P.cut = P.part === CUE ? P.cut : 0;
  for (let d = 0; d < 2; d++) {
    const k = P.decks[d];
    if (!k.held) {
      k.hand = Math.max(0, k.hand - dt * 2.5);
      k.rate = rate;
      k.phi += rate * dt;
      k.beat += (BPM / 60) * (1 + P.pitch) * dt;
      k.needle -= 0.05 * dt;
      if (k.needle < R_RUN + 0.6) k.needle = R_GROOVE - 1;
    }
    // A strobe row's dots seem to turn at the difference between the platter's speed and the speed the row is for.
    for (let j = 0; j < 2; j++) k.strobe[j] += (((1 + P.pitch) / (1 + ROWS[j]) - 1) * OMEGA * dt * DOTS) / (2 * Math.PI);
    // The channel meter: the music while it plays, and the scratch's chirps while it is held.
    const f = k.beat % 1;
    const level = k.held ? clamp(Math.abs(k.rate) / 9, 0, 1) : 0.42 + 0.45 * Math.exp(-6 * f) + 0.18 * Math.exp(-14 * ((f + 0.5) % 1)) + 0.08 * Math.random();
    k.vu = Math.max(level, k.vu - dt * 2.2);
    if (k.vu >= k.peak || P.t - k.peakT > 0.8) (k.peak = k.vu), (k.peakT = P.t);
  }
  // The room's lights jump on each kick of the record playing out.
  P.kick = Math.exp(-5 * (P.decks[P.part === PLAY ? 1 - P.live : P.live].beat % 1));
  // The booth light follows the crossfader onto the deck that is playing out.
  P.spot[0] += (1 - P.fader - P.spot[0]) * Math.min(1, dt * 8);
  P.spot[1] += (P.fader - P.spot[1]) * Math.min(1, dt * 8);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = Math.min(Math.max(dt, 0), 0.1);
  P.hue = clamp(k[0], 0, 1);
  P.pitch = clamp(k[1], -8, 8) / 100;
  P.scratch = clamp(k[2], 0, 1);
  P.light = clamp(k[3], 0, 1);
  for (let i = 0; i < 2; i++) step(P, dt / 2);
}

// The tonearm of a deck: the pivot in the corner, the arm down to the headshell, the needle in the groove.
function arm(P, B, d) {
  const cy = CY[d];
  const k = P.decks[d];
  const px = CX + 26;
  const py = cy - 21;
  const dist = Math.hypot(26, 21);
  const L = 31.5;
  const al = Math.atan2(-21, 26) + Math.acos(clamp((dist * dist + k.needle * k.needle - L * L) / (2 * dist * k.needle), -1, 1));
  const nx = CX + k.needle * Math.cos(al);
  const ny = cy + k.needle * Math.sin(al);
  const put = (x, y, c, w = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 3;
    for (let i = 0; i < 3; i++) B[o + i] = B[o + i] * (1 - w) + c[i] * w;
  };
  // The stylus lamp lights a pool round the needle.
  for (let y = -6; y <= 6; y++)
    for (let x = -6; x <= 6; x++) {
      const w = Math.max(0, 1 - Math.hypot(x, y) / 6.5) ** 2 * 0.35;
      const o = (Math.round(ny + y) * W + Math.round(nx + x)) * 3;
      if (w > 0 && o >= 0 && o < N * 3) for (let i = 0; i < 3; i++) B[o + i] += LAMP[i] * w * 0.4;
    }
  const ux = (nx - px) / L;
  const uy = (ny - py) / L;
  // Counterweight behind the pivot, the pivot's collar, the arm, the headshell.
  for (let s = -7; s < -2; s += 0.5) for (const o of [-1, 0, 1]) put(px + ux * s - uy * o, py + uy * s + ux * o, s < -5 ? [70, 70, 78] : [40, 40, 46]);
  for (let a = 0; a < 6.3; a += 0.3) put(px + 3 * Math.cos(a), py + 3 * Math.sin(a), [120, 120, 130]);
  put(px, py, [20, 20, 24]);
  for (let s = 2; s < L - 4; s += 0.5) put(px + ux * s, py + uy * s, SILVER);
  for (let s = L - 4.5; s <= L; s += 0.5) for (const o of [-1, 0, 1]) put(px + ux * s - uy * o * 0.9, py + uy * s + ux * o * 0.9, o ? [26, 26, 30] : [150, 150, 160]);
  put(px + ux * (L - 2) + uy * 2.5, py + uy * (L - 2) - ux * 2.5, SILVER);
}

export function draw(display, params) {
  const P = params;
  const B = P.buf;
  const hA = 0.1 + P.hue;
  const labels = [hsv(hA, 0.8, 0.95), hsv(hA + 0.42, 0.75, 0.8)];
  // The room light: two bright wedges across each record on the line it falls along, the near one brighter.
  const tl = -0.6 + Math.PI * P.light;
  const lx = Math.cos(tl);
  const ly = Math.sin(tl);
  const sh = P.sheen;
  // The room's light is tinted a paler second colour.
  const lc = hsv(hA + 0.58, 0.5, 1).map((v) => v / 255);
  // Neither record is quite flat, so each one's band sways a little and breathes once a turn.
  for (let d = 0; d < 2; d++) {
    const ph = P.decks[d].phi + d * 2;
    const sway = tl + 0.1 * Math.sin(ph);
    const lift = (1 + 0.15 * Math.cos(ph)) * (0.8 + 0.28 * P.kick);
    for (let i = 0; i < 360; i++) {
      const a = ((i + 0.5) / 360) * 2 * Math.PI - Math.PI - sway;
      const s = Math.sin(a);
      sh[d * 360 + i] = lift * (Math.exp(-((s / 0.17) ** 2)) * (0.65 + 0.35 * Math.cos(a)) + 0.3 * Math.exp(-((s / 0.45) ** 2))) + 0.05;
    }
  }
  const Q = P.q;
  for (let d = 0; d < 2; d++) {
    const k = P.decks[d];
    Q[d] = 0.45 + 0.55 * P.spot[d];
    Q[2 + d] = k.phi;
    Q[4 + 2 * d] = k.strobe[0];
    Q[5 + 2 * d] = k.strobe[1];
    for (let i = 0; i < 3; i++) Q[8 + 3 * d + i] = labels[d][i];
  }
  face(B, P.kind, P.deck, P.rr, P.th, P.ai, P.g, sh, Q, lc, lx, ly);
  for (let d = 0; d < 2; d++) {
    const k = P.decks[d];
    const cy = CY[d];
    // Dust on the record turns with it and shows only in the light.
    for (const q of k.dust) {
      const x = Math.round(CX + q[0] * Math.cos(q[1] + k.phi) - 0.5);
      const y = Math.round(cy + q[0] * Math.sin(q[1] + k.phi) - 0.5);
      const p = y * W + x;
      const s = sh[d * 360 + P.ai[p]];
      for (let i = 0; i < 3; i++) B[p * 3 + i] += 30 + 140 * s;
    }
    deckParts(P, B, d);
    arm(P, B, d);
    if (k.hand > 0.01) hand(P, B, d);
  }
  mixer(P, B);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, B[p] > 255 ? 255 : B[p], B[p + 1] > 255 ? 255 : B[p + 1], B[p + 2] > 255 ? 255 : B[p + 2]);
}

// The decks' faces: plinth, platter rim and its strobe dots, slipmat, the record and its label.
// Q holds each deck's booth light, record angle, strobe rows and label colour.
function face(B, kind, deck, rr, th, ai, g, sh, Q, lc, lx, ly) {
  for (let p = 0; p < N; p++) {
    const o = p * 3;
    const kd = kind[p];
    if (kd === MIXER) continue;
    const d = deck[p];
    const spot = Q[d];
    const r = rr[p];
    let v;
    let c0;
    let c1;
    let c2;
    if (kd === GROOVE || kd === RUN || kd === EDGE) {
      const s = sh[d * 360 + ai[p]] * spot * (0.45 + (0.55 * r) / R_GROOVE);
      if (kd === GROOVE) v = 300 * s * (0.12 + 0.88 * g[p]);
      else if (kd === RUN) v = 170 * s * (Math.abs(r - 9.3) < 0.35 ? 0.4 : 1);
      else v = 20 + 130 * s;
      const base = kd === GROOVE ? 8 + 6 * g[p] : 9;
      c0 = base + v * lc[0];
      c1 = base + v * lc[1];
      c2 = base * 1.15 + v * lc[2];
    } else if (kd === LABEL) {
      // The label turns with the record; each deck's record has its own design.
      let a = th[p] - Q[2 + d];
      a -= Math.floor(a / (2 * Math.PI)) * 2 * Math.PI;
      const L0 = Q[8 + 3 * d];
      const L1 = Q[9 + 3 * d];
      const L2 = Q[10 + 3 * d];
      let f = 1;
      let white = false;
      if (d === 0) {
        white = Math.abs(r * Math.sin(a)) < 1.4 && r > 2;
        if (Math.hypot(r * Math.cos(a) - 0, r * Math.sin(a) - 5.2) < 1.5) f = 0.15;
        if (r > 6 && r < 7.6 && Math.floor(a / 1.05) % 2 === 0) f = 0.35;
      } else {
        f = Math.floor(a / (Math.PI / 3)) % 2 ? 0.5 : 1;
        white = (r > 6.4 && r < 7.4) || Math.hypot(r * Math.cos(a) - 3.5, r * Math.sin(a) - 1.5) < 1.2;
      }
      const s = 1 + 0.25 * sh[d * 360 + ai[p]] * spot;
      c0 = (white ? 235 : L0 * f) * s;
      c1 = (white ? 225 : L1 * f) * s;
      c2 = (white ? 200 : L2 * f) * s;
    } else if (kd === SPINDLE) {
      c0 = c1 = c2 = 200;
    } else if (kd === MAT) {
      c0 = 20;
      c1 = 18;
      c2 = 22;
    } else if (kd === RIM) {
      // The platter rim's strobe dots, lit orange near the strobe lamp at the lower left.
      const row = r < 27.55 ? 0 : 1;
      let u = ((th[p] + Math.PI) / (2 * Math.PI)) * DOTS - Q[4 + 2 * d + row];
      u -= Math.floor(u);
      const lamp = Math.max(0, Math.cos(th[p] - 2.6)) ** 2;
      const lit = 80 + 110 * sh[d * 360 + ai[p]] * spot;
      const dot = u < 0.45;
      c0 = dot ? lit + 185 * lamp : 30;
      c1 = dot ? lit + 40 * lamp : 30;
      c2 = dot ? lit * 1.08 : 35;
    } else {
      // The plinth, satin grey, brighter towards the room's light and under the booth light.
      const dx = (p % W) + 0.5 - CX;
      const dy = Math.floor(p / W) + 0.5 - CY[d];
      v = (38 + 0.5 * (dx * lx + dy * ly)) * (0.8 + 0.3 * spot);
      c0 = v;
      c1 = v;
      c2 = v * 1.1;
    }
    B[o] = c0;
    B[o + 1] = c1;
    B[o + 2] = c2;
  }
}

// The controls in a deck's corners: start button and speed buttons, the strobe lamp, the pitch slider.
function deckParts(P, B, d) {
  const y0 = d ? 70 : 0;
  const box = (x0, y1, w, h, c) => {
    for (let y = y1; y < y1 + h; y++) for (let x = x0; x < x0 + w; x++) B.set(c, ((y0 + y) * W + x) * 3);
  };
  box(2, 52, 7, 4, [120, 120, 128]);
  box(3, 53, 5, 2, [70, 70, 76]);
  box(10, 54, 3, 2, [140, 90, 50]);
  box(14, 54, 3, 2, [90, 90, 96]);
  box(2, 44, 3, 3, [255, 110, 50]);
  // The pitch slider: its slot and cap, and a green light when it sits at 0.
  box(60, 37, 2, 18, [16, 16, 20]);
  const yc = Math.round(45 + P.pitch * 100);
  box(59, yc, 4, 2, [196, 196, 206]);
  box(63, 45, 1, 1, Math.abs(P.pitch) < 0.001 ? [60, 255, 90] : [20, 40, 24]);
}

// The DJ's hand on the left of the record, fingers towards the label, moving round with it.
function hand(P, B, d) {
  const k = P.decks[d];
  const cy = CY[d];
  const a = Math.PI + 0.15 + k.rock;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const w = k.hand;
  const paint = (u, v, c, f) => {
    // u along the radius from the spindle, v across it.
    const x = Math.round(CX + u * ca - v * sa - 0.5 - (1 - w) * 30);
    const y = Math.round(cy + u * sa + v * ca - 0.5);
    if (x < 0 || x >= W || y < (d ? 70 : 0) || y >= (d ? H : 58)) return;
    const o = (y * W + x) * 3;
    B[o] = c[0] * f;
    B[o + 1] = c[1] * f;
    B[o + 2] = c[2] * f;
  };
  // The sleeve and its cuff, the back of the hand, four fingers and the thumb.
  for (let u = 20; u < 40; u += 0.5) for (let v = -3; v <= 3; v += 0.5) paint(u, v, u < 24 ? CUFF : SLEEVE, 1);
  for (let u = 14; u < 21; u += 0.5) for (let v = -4; v <= 4; v += 0.5) paint(u, v, SKIN, 0.75 + 0.25 * Math.cos((v / 4) * 1.4) - (u - 14) * 0.02);
  for (let v = -3; v <= 3; v += 2) for (let u = 9.5 + Math.abs(v) * 0.6; u < 14; u += 0.5) paint(u, v, SKIN, 0.85);
  for (let u = 15; u < 18; u += 0.5) paint(u, 5 - (u - 15) * 0.4, SKIN, 0.7);
}

// The mixer strip between the decks: a meter for each channel and the crossfader between them.
function mixer(P, B) {
  const hA = 0.1 + P.hue;
  const set = (x, y, c, f = 1) => {
    const o = (y * W + x) * 3;
    B[o] = c[0] * f;
    B[o + 1] = c[1] * f;
    B[o + 2] = c[2] * f;
  };
  for (let y = 58; y < 70; y++) {
    const v = y === 58 || y === 69 ? 8 : y === 59 ? 70 : y === 68 ? 22 : 34;
    const c = [v, v, v * 1.15];
    for (let x = 0; x < W; x++) set(x, y, c);
  }
  // 27 segments a meter: 17 in the first colour, 6 in the second, the last 4 in the third.
  const segs = 27;
  const tone = [0, 0.2, 0.33].map((h) => hsv(hA + 0.23 - h, 0.85, 1));
  for (let d = 0; d < 2; d++) {
    const k = P.decks[d];
    const y = d ? 66 : 60;
    const on = Math.round(k.vu * segs);
    const pk = Math.min(segs - 1, Math.round(k.peak * segs) - 1);
    for (let i = 0; i < segs; i++) {
      const c = tone[i < 17 ? 0 : i < 23 ? 1 : 2];
      const f = i < on || i === pk ? 1 : 0.1;
      set(5 + 2 * i, y, c, f);
      set(5 + 2 * i, y + 1, c, f * 0.8);
    }
  }
  const slot = [6, 6, 8];
  for (let x = 12; x <= 51; x++) for (let y = 63; y <= 64; y++) set(x, y, slot);
  const xc = Math.round(12 + P.fader * 36);
  const lit = hsv(hA + 0.42 * P.fader, 0.7, 1);
  for (let y = 62; y <= 65; y++) for (let x = xc; x < xc + 4; x++) set(x, y, x === xc + 1 || x === xc + 2 ? lit : SILVER, y === 65 ? 0.7 : 1);
  const a = hsv(hA, 0.8, 1);
  const b = hsv(hA + 0.42, 0.75, 1);
  for (const y of [63, 64]) {
    set(7, y, a, 0.15 + 0.85 * (1 - P.fader));
    set(8, y, a, 0.15 + 0.85 * (1 - P.fader));
    set(55, y, b, 0.15 + 0.85 * P.fader);
    set(56, y, b, 0.15 + 0.85 * P.fader);
  }
}
