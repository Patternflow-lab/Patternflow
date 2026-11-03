// ===== Patternflow pattern =====
// Title:   Tempo Canon
// Family:  rhythm
// Idea:    A player-piano roll scrolls up the tall panel with one lane for each voice of a canon, every voice playing the same melody at its own fixed tempo, and faint lines join the same note in every lane, so the lines arch one way before the convergence point, lie flat across the panel where all the voices strike one note together in a white flash, and arch the other way after it, one new canon after another.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the tempo canons of Conlon Nancarrow's Studies for Player Piano (from 1948; Study No. 36 at 17:18:19:20, Study No. 33 at the square root of 2 to 2, Study No. 40 at e to pi), the convergence point as Kyle Gann named it (The Music of Conlon Nancarrow, 1995), pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spread=-1..1, Voices=4..12
//
// Knob 1: Hue. Turns the voice colours round the wheel together. At 0 the slowest voice in the middle lane is gold and the colours run through green to azure in the fastest lanes at the edges; at 0.5 the middle lane is blue and the colours run through violet and red to orange at the edges. The convergence stays white.
// Knob 2: Speed. The roll moves 6 rows a second for each unit: 12 at the opening 2, where a canon of about 115 rows passes the playhead in 10 s; 1.2 rows a second at 0.2 and 18 at 3.
// Knob 3: Spread. The tempo step between neighbouring voices, 1/4 at the opening 0, so four voices run 4:5:6:7 and the fastest plays the melody in 57% of the rows the slowest takes. Toward -1 the step falls to 1/17, where four voices run 17:18:19:20 as in Study No. 36 and the lines barely bend; toward 1 it rises to 1, four voices 1:2:3:4 and twelve 1:2:...:12, a sharp spindle.
// Knob 4: Voices. 4 to 12 lanes. The slowest voice takes a middle lane and the faster ones sit outward, left and right in turn, so the lane width falls from 16 LEDs to 5 and each canon sharpens from an arch of four columns into a spindle.

// One canon is a melody of n notes, each with an onset s(k) and a length,
// counted in rows at the slowest tempo. Voice i plays it at tempo
// r_i = 1 + d i (d is Spread's step), so its note k sounds at
//
//   t_i(k) = Tc + (s(k) - s(K)) / r_i,
//
// with one note K chosen for the canon. At Tc every voice strikes note K:
// that row is the convergence point. A note ahead of K is reached by the
// faster voices later than by the slow one, a note after K sooner, and the
// gap grows with the distance from K. The faint line through note k in
// every lane therefore bends toward the convergence row at the fast lanes,
// one way above it and the other way below, and lies dead flat at K.
//
// Nancarrow punched such canons into player-piano rolls by hand. Study
// No. 36 runs four voices at 17:18:19:20; Studies No. 33 and 40 use ratios
// that are not fractions at all, the square root of 2 to 2 and e to pi.
// Here the voices step by d, which Spread turns smoothly, so almost every
// setting is such an irrational canon. Kyle Gann's book calls the moment
// all the voices meet the convergence point. Each new canon here gets a new
// melody of 18 to 26 notes and puts its convergence on the first note (a
// quarter of the time), on the last (a quarter) or between 30% and 70% of
// the way through (the rest); the first canon always takes the middle.
//
// The roll runs down: earlier rows sit higher, the paper moves up, and
// notes strike as they cross the playhead at row 76, flashing white. A
// note is a bar 2 rows tall in its voice's lane, set across the lane by its
// pitch, one of 8 steps, with a thin tail for 72% of its note value at that
// voice's tempo. Notes already played are full colour, fading toward the
// top; notes to come are dimmer and paler.

const W = 64, H = 128;
const { floor, round, min, max, abs, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The playhead row, rows a second for each unit of Speed, and the rows of
// silence at the slowest tempo between one canon and the next.
const PLAY = 76, RATE = 6, GAP = 14;
// Pitch steps across a lane, note values in rows at the slowest tempo, and
// how much of each value a bar fills.
const PITCHES = 8, VALUES = [3, 3, 4.5, 6, 6, 9], LEGATO = 0.72, HEAD = 2;
// Hue of the slowest voice at knob 0 and the band the voices spread over.
const HUE0 = 0.12, BAND = 0.46;
// Spread: d = 1/4 times 4.25^k below 0 and 4^k above, so 1/17 at -1,
// 1/4 at 0 and 1 at 1.
const stepOf = (k) => 0.25 * (k < 0 ? 4.25 : 4) ** k;
// Rows a strike stays white, and rows the convergence flash lasts.
const STRIKE = 7, FLASH = 22;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A new canon whose slowest voice begins at row `start` of the score.
// `mid` forces the convergence into the middle third (the first canon).
function canon(start, mid) {
  const n = 18 + floor(Math.random() * 9);
  const s = new Float32Array(n), len = new Float32Array(n), p = new Int8Array(n);
  let t = 0, pitch = floor(Math.random() * PITCHES);
  for (let k = 0; k < n; k++) {
    s[k] = t;
    len[k] = VALUES[floor(Math.random() * VALUES.length)];
    t += len[k];
    p[k] = pitch;
    const step = [-2, -1, -1, 0, 1, 1, 2][floor(Math.random() * 7)];
    pitch += step;
    if (pitch < 0) pitch = -pitch;
    if (pitch >= PITCHES) pitch = 2 * (PITCHES - 1) - pitch;
  }
  const u = Math.random();
  const K = mid || u >= 0.5 ? floor(n * (0.3 + 0.4 * Math.random())) : u < 0.25 ? 0 : n - 1;
  return { n, s, len, p, K, Tc: start + s[K], start, end: start + t };
}

export function setup(params) {
  params.s = {
    pos: 0,
    canons: [],
    hue: 0,
    speed: 2,
    voices: 4,
    d: 0.25,
    R: new Float32Array(W * H),
    G: new Float32Array(W * H),
    B: new Float32Array(W * H),
  };
  const S = params.s;
  // The first canon is placed so its convergence reaches the playhead
  // 20 rows (1.7 s at the opening speed) after the start.
  const c = canon(0, true);
  const shift = S.pos + 20 - c.Tc;
  c.start += shift;
  c.end += shift;
  c.Tc += shift;
  S.canons.push(c);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 4], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.d = stepOf(cl(k[2] || 0, -1, 1));
  S.voices = round(cl(k[3] == null ? 4 : k[3], 4, 12));
  S.pos += d * S.speed * RATE;
  const C = S.canons;
  while (C[C.length - 1].start < S.pos + (H - PLAY) + 8) C.push(canon(C[C.length - 1].end + GAP, false));
  while (C.length > 1 && C[0].end + 12 < S.pos - PLAY) C.shift();
}

// Lanes left to right: the slowest voice (0) in the middle, faster ones
// outward, alternating sides: 4 voices sit 2 0 1 3.
function lanes(V) {
  const order = [0];
  for (let i = 1; i < V; i++) if (i % 2) order.push(i);
  else order.unshift(i);
  return order;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const R = S.R, G = S.G, B = S.B;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  const V = S.voices, order = lanes(V);
  // Lane edges, content width (one dark LED between lanes), bar width.
  const x0 = [], cw = [];
  for (let j = 0; j < V; j++) {
    const a = round((j * W) / V), b = round(((j + 1) * W) / V);
    x0.push(a + (j === 0 ? 1 : 0));
    cw.push(b - a - 1 - (j === 0 ? 1 : 0));
  }
  const bw = max(2, round(cw[0] * 0.36)), tail = bw > 3 ? 2 : 1, tx = (bw - tail) >> 1;
  const tempo = [], col = [];
  for (let i = 0; i < V; i++) {
    tempo.push(1 + S.d * i);
    col.push(hsv(S.hue + HUE0 + (BAND * i) / (V - 1), 0.8, 1));
  }
  // Brightness by row: played notes fade from 1 at the playhead to 0.55 at
  // the top; notes to come are at 0.62 and paled a third toward white, so a
  // dim gold does not turn brown.
  const shade = (y) => (y <= PLAY ? 0.55 + (0.45 * max(0, y)) / PLAY : 0.62);
  const pale = (y) => (y <= PLAY ? 0 : 0.32);

  const add = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = y * W + x;
    R[o] = min(1, R[o] + r * a);
    G[o] = min(1, G[o] + g * a);
    B[o] = min(1, B[o] + b * a);
  };
  // An antialiased line (Xiaolin Wu's), added into the buffer.
  const line = (xa, ya, xb, yb, c0, c1, a) => {
    const steep = abs(yb - ya) > abs(xb - xa);
    if (steep) [xa, ya, xb, yb] = [ya, xa, yb, xb];
    if (xa > xb) [xa, ya, xb, yb, c0, c1] = [xb, yb, xa, ya, c1, c0];
    const n = max(1, round(xb - xa));
    for (let i = 0; i <= n; i++) {
      const f = i / n, x = round(xa) + i, y = ya + (yb - ya) * f, y0 = floor(y), w = y - y0;
      const r = c0[0] + (c1[0] - c0[0]) * f, g = c0[1] + (c1[1] - c0[1]) * f, b = c0[2] + (c1[2] - c0[2]) * f;
      if (steep) {
        add(y0, x, r, g, b, a * (1 - w));
        add(y0 + 1, x, r, g, b, a * w);
      } else {
        add(x, y0, r, g, b, a * (1 - w));
        add(x, y0 + 1, r, g, b, a * w);
      }
    }
  };
  const WHITE = [1, 1, 1];

  for (const c of S.canons) {
    const top = c.start - S.pos + PLAY, bottom = c.end - S.pos + PLAY;
    if (bottom < -4 || top > H + 4) continue;
    const yOf = (i, k) => c.Tc + (c.s[k] - c.s[c.K]) / tempo[i] - S.pos + PLAY;
    const xOf = (j, k) => x0[j] + round(((cw[j] - bw) * c.p[k]) / (PITCHES - 1));
    // Rows since the convergence crossed the playhead.
    const since = S.pos - c.Tc, flash = since >= 0 && since < FLASH ? 1 - since / FLASH : 0;

    // The fan: one faint line per note through all the lanes.
    for (let k = 0; k < c.n; k++) {
      const conv = k === c.K;
      for (let j = 0; j + 1 < V; j++) {
        const ia = order[j], ib = order[j + 1];
        const ya = yOf(ia, k), yb = yOf(ib, k);
        if ((ya < -2 && yb < -2) || (ya > H + 2 && yb > H + 2)) continue;
        const xa = xOf(j, k) + bw / 2, xb = xOf(j + 1, k) + bw / 2;
        if (conv) line(xa - bw / 2, ya, xb + bw / 2, yb, WHITE, WHITE, 0.42 + 0.5 * flash);
        else line(xa, ya, xb, yb, col[ia], col[ib], 0.62 * shade((ya + yb) / 2));
      }
    }
    // A glow over the convergence row as all the voices strike together.
    if (flash > 0) {
      const yc = c.Tc - S.pos + PLAY;
      for (let dy = -3; dy <= 3; dy++) {
        const y = round(yc) + dy, a = flash * 0.35 * exp(-dy * dy * 0.35);
        for (let x = 0; x < W; x++) add(x, y, 1, 1, 1, a);
      }
    }
    // The notes: a bar HEAD rows tall where each note strikes, and a thin
    // tail as long as the note sounds at that voice's tempo, overwriting the
    // lines under them.
    for (let j = 0; j < V; j++) {
      const i = order[j], cc = col[i];
      for (let k = 0; k < c.n; k++) {
        const ya = yOf(i, k), yh = ya + HEAD, yb = max(yh, ya + (c.len[k] * LEGATO) / tempo[i]);
        if (yb < 0 || ya >= H) continue;
        const xs = xOf(j, k), age = PLAY - ya;
        // White for STRIKE rows after it crosses the playhead.
        const hit = age >= 0 && age < STRIKE ? 1 - age / STRIKE : 0;
        const conv = k === c.K ? flash : 0, wt = max(hit, conv);
        for (let y = max(0, floor(ya)); y < min(H, Math.ceil(yb)); y++) {
          const inHead = y < yh, cov = min(y + 1, inHead ? yh : yb) - max(y, inHead ? ya : yh);
          if (cov <= 0) continue;
          const v = shade(y) * (inHead ? 1 : 0.42), q = max(pale(y), wt), m = max(v, wt);
          const r = (cc[0] + (1 - cc[0]) * q) * m, g = (cc[1] + (1 - cc[1]) * q) * m, b = (cc[2] + (1 - cc[2]) * q) * m;
          const a = inHead ? xs : xs + tx, z = inHead ? xs + bw : xs + tx + tail;
          for (let x = a; x < z; x++) {
            const o = y * W + x;
            R[o] += (r - R[o]) * cov;
            G[o] += (g - G[o]) * cov;
            B[o] += (b - B[o]) * cov;
          }
        }
      }
    }
  }
  // The playhead: a short tick at each edge.
  for (const x of [0, W - 1]) add(x, PLAY, 0.55, 0.55, 0.6, 1);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      display.setPixel(x, y, round(R[o] * 255), round(G[o] * 255), round(B[o] * 255));
    }
}
