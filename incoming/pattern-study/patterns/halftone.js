// ===== Patternflow pattern =====
// Title:   Halftone
// Family:  print
// Idea:    A soft picture of drifting lights is printed the way a press prints a photograph, one screen of hard dots per ink, each screen at its own angle, so the dots grow and shrink with the tone and the inks lock into rosettes.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Inks=0..3, Speed=0.1..5, Screen=8..13, Turn=0..30
//
// Knob 1: Inks. The ink set, in four steps: process cyan, magenta and yellow; riso blue and pink; Ben-Day blue, red and yellow; black on newsprint.
// Knob 2: Speed. How fast the lights drift under the screens.
// Knob 3: Screen. How many dots fit across the 64 LEDs, from 8 fat poster dots to 13 fine ones.
// Knob 4: Turn. Turns the screens off the printer's rosette towards one shared angle, until at 30 every ink lands dot on dot.
// Buttons: K1 tap knocks the plates out of register, and they settle back.

const W = 64;
const H = 128;

// Each set is a paper colour and its inks. An ink is its colour, the part of
// the picture it prints (0 cyan, 1 magenta, 2 yellow, 3 grey, 4 everything
// warm, so riso pink carries the sun too) and its screen angle in degrees
// away from 45, the angle the eye notices least. Paper stays well under
// full white, since it covers most of the panel.
const SETS = [
  {
    paper: [200, 192, 172],
    inks: [
      [[0, 158, 224], 0, -30],
      [[236, 0, 140], 1, 30],
      [[255, 226, 0], 2, 45],
    ],
  },
  {
    paper: [200, 192, 172],
    inks: [
      [[0, 120, 191], 0, -30],
      [[255, 72, 176], 4, 30],
    ],
  },
  {
    paper: [204, 196, 176],
    inks: [
      [[20, 70, 200], 0, -30],
      [[226, 30, 38], 1, 30],
      [[255, 214, 0], 2, 45],
    ],
  },
  {
    paper: [184, 182, 168],
    inks: [[[20, 20, 24], 3, 0]],
  },
];

// The picture is a dusk sky: bare paper at the top, a magenta glow low
// down where the cyan of the deep sky comes up to meet it, so two screens
// share that band and have to agree. Four lamps wander over it on their own
// loops. Radius in LEDs; how much cyan, magenta and yellow each asks for;
// the middle and reach of its loop down the panel, as shares of the height.
// The last one is plain light, where the dots shrink away to bare paper.
const LAMPS = [
  [26, 0.0, 0.2, 0.8, 0.26, 0.16],
  [22, 0.0, 0.8, 0.1, 0.2, 0.15],
  [18, 0.75, 0.8, 0.1, 0.82, 0.1],
  [22, 0.0, 0.0, 0.0, 0.68, 0.22],
];

export function setup(params) {
  const p = params;
  p.tone = new Float32Array(W * H * 5);
  p.lx = new Float32Array(LAMPS.length);
  p.ly = new Float32Array(LAMPS.length);
  p.t = 0;
  p.slip = 0;
  p.slipX = new Float32Array(3);
  p.slipY = new Float32Array(3);
  p.wave = new Float32Array(W);
  p.cosA = new Float32Array(3);
  p.sinA = new Float32Array(3);
  p.u = new Float32Array(3);
  p.v = new Float32Array(3);
  p.ink = new Float32Array(9);
  p.chan = new Uint8Array(3);
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 8, 0.06];
  p.set = SETS[Math.max(0, Math.min(SETS.length - 1, Math.round(k[0])))];
  p.t += dt * k[1] * 0.5;
  p.pitch = W / k[2];
  p.turn = Math.max(0, Math.min(1, k[3] / 30));
  if (input.btnPressed && input.btnPressed[0]) {
    p.slip = 1;
    for (let i = 0; i < 3; i++) {
      // Each plate slides its own way, six LEDs at the moment of the tap.
      const a = Math.random() * Math.PI * 2;
      p.slipX[i] = Math.cos(a);
      p.slipY[i] = Math.sin(a);
    }
  }
  p.slip = Math.max(0, p.slip - dt * 0.4);

  const t = p.t;
  for (let i = 0; i < LAMPS.length; i++) {
    const o = i * 2.1;
    p.lx[i] = W / 2 + Math.sin(t * (0.37 + i * 0.11) + o) * W * 0.38;
    p.ly[i] = H * LAMPS[i][4] + Math.sin(t * (0.23 + i * 0.07) + o * 1.7) * H * LAMPS[i][5];
  }
  // The bands sway a little, so the sky's dots breathe too.
  const lift = 0.05 * Math.sin(t * 0.31);
  for (let x = 0; x < W; x++) p.wave[x] = 0.07 * Math.sin(x * 0.07 + t * 0.8) + lift;
  const tone = p.tone;
  for (let y = 0; y < H; y++) {
    const g = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const sway = g + p.wave[x];
      const e = Math.max(0, Math.min(1, (sway - 0.3) / 0.7));
      const glow = 1 - ((sway - 0.55) * (sway - 0.55)) / 0.04;
      let c = 0.88 * e * e * (3 - 2 * e);
      let m = glow > 0 ? 0.45 * glow * glow : 0;
      let yl = 0;
      for (let i = 0; i < LAMPS.length; i++) {
        const dx = x - p.lx[i];
        const dy = y - p.ly[i];
        const R = LAMPS[i][0];
        const q = 1 - (dx * dx + dy * dy) / (R * R);
        if (q <= 0) continue;
        const w = q * q;
        c += (LAMPS[i][1] - c) * w;
        m += (LAMPS[i][2] - m) * w;
        yl += (LAMPS[i][3] - yl) * w;
      }
      const o = (y * W + x) * 5;
      tone[o] = c;
      tone[o + 1] = m;
      tone[o + 2] = yl;
      tone[o + 3] = Math.min(1, 0.55 * c + 0.55 * m + 0.35 * yl);
      tone[o + 4] = Math.min(1, m + 0.6 * yl);
    }
  }
}

export function draw(display, params, time) {
  const p = params;
  const set = p.set;
  const inks = set.inks;
  const n = inks.length;
  const pitch = p.pitch;
  const tone = p.tone;
  const turn = p.turn;
  // Turned all the way, every screen lands on 30 degrees, dot on dot.
  for (let i = 0; i < n; i++) {
    const a = ((45 + inks[i][2] * (1 - turn) - 15 * turn) * Math.PI) / 180;
    p.cosA[i] = Math.cos(a) / pitch;
    p.sinA[i] = Math.sin(a) / pitch;
  }
  const slip = p.slip * p.slip * 6;
  const s2 = pitch * pitch;
  const cosA = p.cosA;
  const sinA = p.sinA;
  const ink = p.ink;
  const chan = p.chan;
  const U = p.u;
  const V = p.v;
  for (let i = 0; i < n; i++) {
    ink[i * 3] = inks[i][0][0] / 255;
    ink[i * 3 + 1] = inks[i][0][1] / 255;
    ink[i * 3 + 2] = inks[i][0][2] / 255;
    chan[i] = inks[i][1];
  }
  const pr = set.paper[0];
  const pg = set.paper[1];
  const pb = set.paper[2];
  for (let y = 0; y < H; y++) {
    // Each screen's grid position at the start of the row; it then steps by
    // the same amount per LED.
    for (let i = 0; i < n; i++) {
      const px = 0.5 - W / 2 + p.slipX[i] * slip;
      const py = y + 0.5 - H / 2 + p.slipY[i] * slip;
      U[i] = px * cosA[i] + py * sinA[i];
      V[i] = py * cosA[i] - px * sinA[i];
    }
    for (let x = 0; x < W; x++) {
      let r = pr;
      let g = pg;
      let b = pb;
      for (let i = 0; i < n; i++) {
        const ca = cosA[i];
        const sa = sinA[i];
        // In the screen's own grid each dot sits on a whole number.
        const u = U[i];
        const v = V[i];
        U[i] = u + ca;
        V[i] = v - sa;
        const cu = Math.floor(u + 0.5);
        const cv = Math.floor(v + 0.5);
        const fu = u - cu;
        const fv = v - cv;
        // Back out to the panel to read the picture at the dot's centre, so
        // every dot is round whatever the picture does across it.
        let sx = Math.floor((cu * ca - cv * sa) * s2 + W / 2);
        let sy = Math.floor((cu * sa + cv * ca) * s2 + H / 2);
        sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx;
        sy = sy < 0 ? 0 : sy >= H ? H - 1 : sy;
        let c = tone[(sy * W + sx) * 5 + chan[i]];
        // A highlight dot under about two LEDs across drops out, as fine dots
        // do on press; a single lit LED would only read as grit.
        if (c * s2 < 3.8) continue;
        if (c > 1) c = 1;
        // Dot area follows the tone; past where dots touch, the corners fill in.
        const r2 = c < 0.785 ? c / Math.PI : 0.25 + (c - 0.785) * 1.163;
        if (fu * fu + fv * fv < r2) {
          r *= ink[i * 3];
          g *= ink[i * 3 + 1];
          b *= ink[i * 3 + 2];
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
