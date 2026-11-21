// ===== Patternflow pattern =====
// Title:   Hot Plate
// Family:  conduction
// Idea:    A thin metal plate under a thermochromic liquid crystal sheet is solved as the heat equation on the panel's own 64 by 128 cells, with two long slits that insulate it and make the heat take an S-shaped road and one short slit, while three torches wander over it; the sheet shows each isotherm as a band of colour from brown through olive, green, teal and blue to violet and the hottest cores go dark violet, the bands crowd toward a torch and bend round the ends of the slits, and the far side of a slit warms long after the near side.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Joseph Fourier, Theorie analytique de la chaleur (1822); thermochromic liquid crystal thermography
// Round:   211
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=1..3, Spread=-1..1, Slits=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of every colour of the ramp, so one turn comes back to where it began. At 0 the cold plate is dark brown (61, 30, 12) and the heat takes it through olive, green, teal and blue to violet, with the hottest cores a dark violet (56, 11, 77). At 0.25 the cold plate is dark green, the ramp goes teal, magenta and red, and the cores are dark red; at 0.5 it is dark blue, then violet, orange and green, with dark green cores; at 0.75 dark purple, then red, green and teal, with dark blue-green cores.
// Knob 2: Heat. A gain on the temperature that the ramp reads, from 1 to 3 and opening at 2. The field underneath is the same at every setting, so the picture answers at once. At 1 about 5 percent of the plate is past green and the hottest spot is teal; at 2, 24 percent is past green and a core reaches violet; at 3, 36 percent is past green and 4 percent of the plate is violet or darker, the overheated cores. The percentages are for the plate as it opens.
// Knob 3: Spread. The plate's diffusivity, 8.5 times 4 to the power of the knob: 2.1 LED^2 a second at -1, 8.5 at the opening 0 and 34 at 1. Cooling to the room goes with its square root, 0.025, 0.05 and 0.1 a second, so the reach of a torch's heat, the square root of diffusivity over cooling, is 9.2, 13 and 18 LEDs, and the torch's power goes with diffusivity to the power 0.7. Low, the heat stays near the torch in narrow bands; high, it fills a lane and runs down the middle channel in broad soft ones.
// Knob 4: Slits. How far the slits reach, as 1 - ((1 - knob) / 2)^2 of their full length. At -1 the plate is whole. At the opening 0.06 the two long slits are 81 LEDs long and 2 wide, one down from the top edge at columns 20 and 21 and one up from the bottom edge at columns 41 and 42, so they overlap by 34 rows and the heat goes down the middle lane and round both tips, and the short slit is 11 LEDs long from the left edge at rows 45 and 46. At 1 they are 104 and 14 LEDs, and the gaps at the ends of the long ones are 24 rows.

// The field is the temperature T of a metal plate, one cell to an LED, with
//   dT/dt = alpha del^2 T + heat from the torches - cool T,
// stepped explicitly. Between two open cells heat flows by the difference of their
// temperatures; across a slit nothing flows, since the cells of a slit are shut and
// every face next to one is dead. That is what bends the heat round a slit's end.
// The plate's edge loses heat to the room through a face of conductance EDGE.
// A step of alpha dt of 0.24 cells^2 or less is stable (the limit is a quarter), so a
// frame is cut into as many steps as that takes: one at Spread -1, two at 0, five at 1.
// The equation is linear, which gives two things. The plate cannot run away: the
// torches put in a power that stays within bounds and the cooling takes it out. And
// Heat can be applied when the plate is drawn, with no wait for the field to settle.
// The colour is a thermochromic liquid crystal sheet's: dark brown when cold, then
// olive, green, teal, blue and violet as it warms, and a dark violet past its range.
// The slits are black, and every other LED is at least 61 of 255 in its brightest channel.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, exp, sqrt, round, tanh } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the plate
const ALPHA0 = 8.5; // diffusivity at Spread 0, LED^2 a second
const COOL = 0.05; // Newton cooling to the room at Spread 0, a second; it goes with the square root of the diffusivity
const EDGE = 0.35; // conductance of a face on the plate's edge to the room, against 1 for a face between two cells
const LAMMAX = 0.24; // alpha * dt / dx^2 may not pass a quarter; this is the part of that used
const CHUNK = 0.1; // longest stretch of time one pass of the torches' positions covers
const PRE = 3; // cooling times of plate time run before the first frame, 60 s at Spread 0
const TOPEN = 60; // the plate time of the first frame, at every knob place, so the torches open where they always do

// ---- the slits, in cells: two columns wide, from an edge
const SA = 20; // first column of the slit down from the top edge
const SB = 41; // first column of the slit up from the bottom edge
const LONG = 104; // length of both long slits at Slits 1
const SC_Y = 45; // first row of the short slit, from the left edge
const SHORT = 14; // its length at Slits 1

// ---- the torches
const SIGMA = 2.8; // radius of a torch's flame, LEDs
const QR = 0.42; // heating rate at a torch's centre at Spread 0, temperature units a second; it goes with the diffusivity to the power 0.7
const TORCH = [
  // Each road is a centre and two swings on each axis (amplitude, rad/s, phase); no rate is a multiple of another,
  // so the road never closes. The first torch swings across the top slit, the second across the bottom one and
  // the third roams the whole plate. b is the breath of the flame: depth, rad/s, phase.
  { p: 1.0, c: [20.5, 64], x: [6, 0.47, -28.69, 3, 0.1913, 0], y: [40, 0.0931, -4.85, 14, 0.0471, 4.0], b: [0.45, 0.083, 0.5] },
  { p: 0.9, c: [41.5, 64], x: [6, 0.531, -31.19, 3, 0.2137, 0], y: [38, 0.0719, -3.97, 16, 0.0589, 2.3], b: [0.45, 0.071, 2.2] },
  { p: 0.95, c: [32, 64], x: [21, 0.1337, -7.92, 7, 0.0757, 5.5], y: [42, 0.0617, -4.95, 12, 0.1033, 0.8], b: [0.45, 0.097, 4.1] },
];

// ---- the picture
const LUT = 2048;
const GAMMA = 0.58; // the sheet is read at the temperature to this power, which spreads the cool end of the ramp over more of the plate
const XMAX = 4; // the table covers heat * temperature from 0 to this
// Colour stops of the sheet: where on 0..1 (cold to hottest), hue, saturation, value.
const STOPS = [
  [0.0, 0.06, 0.8, 0.24], // dark brown
  [0.16, 0.09, 0.85, 0.36], // brown
  [0.3, 0.19, 0.85, 0.46], // olive
  [0.45, 0.31, 0.9, 0.72], // green
  [0.6, 0.47, 0.85, 0.85], // teal
  [0.74, 0.6, 0.9, 0.9], // blue
  [0.87, 0.74, 0.8, 0.72], // violet
  [1.0, 0.78, 0.85, 0.3], // dark violet, where the sheet has gone past its range
];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

export function setup(params) {
  params.s = {
    hue: 0, heat: 2, alpha: ALPHA0, cool: COOL, t: 0, warm: false,
    T: new Float64Array(N), fr: new Float64Array(N + 1), fd: new Float64Array(N + W),
    open: new Uint8Array(N).fill(1), gR: new Uint8Array(N), gD: new Uint8Array(N), loss: new Float64Array(N),
    la: -1, lc: -1,
    si: new Int32Array(3 * 300), sw: new Float64Array(3 * 300), sn: 0,
    lut: new Uint8Array(LUT * 3), lutKey: "", c: [0, 0, 0],
  };
  buildMask(params.s, 0, 0);
}

// How long the long slits are for a Slits knob, as a share of LONG: none at -1,
// everything at 1, and 0.78 at the opening 0.06.
function reach(k) {
  const u = (1 - cl(k, -1, 1)) / 2;
  return 1 - u * u;
}

// Rebuild which cells are open and which faces conduct. A cell that opens takes
// the mean of its open neighbours; one that closes loses its heat.
function buildMask(S, la, lc) {
  const old = S.open, open = new Uint8Array(N).fill(1), T = S.T;
  for (let y = 0; y < la; y++) open[y * W + SA] = open[y * W + SA + 1] = 0;
  for (let y = H - la; y < H; y++) open[y * W + SB] = open[y * W + SB + 1] = 0;
  for (let x = 0; x < lc; x++) open[SC_Y * W + x] = open[(SC_Y + 1) * W + x] = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!open[p]) T[p] = 0;
      else if (!old[p]) {
        let s = 0, n = 0;
        if (x > 0 && old[p - 1] && open[p - 1]) (s += T[p - 1]), n++;
        if (x < W - 1 && old[p + 1] && open[p + 1]) (s += T[p + 1]), n++;
        if (y > 0 && old[p - W] && open[p - W]) (s += T[p - W]), n++;
        if (y < H - 1 && old[p + W] && open[p + W]) (s += T[p + W]), n++;
        T[p] = n ? s / n : 0;
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      S.gR[p] = x < W - 1 && open[p] && open[p + 1] ? 1 : 0;
      S.gD[p] = y < H - 1 && open[p] && open[p + W] ? 1 : 0;
      S.loss[p] = open[p] ? EDGE * ((x === 0) + (x === W - 1) + (y === 0) + (y === H - 1)) : 0;
    }
  S.open = open;
  S.la = la;
  S.lc = lc;
}

// Where torch i is at plate time t. Two swings on each axis, none of them a
// multiple of another, so the road never closes; it crosses every lane.
function torchAt(P, t, out) {
  const [ax, wx, px, bx, vx, qx] = P.x, [ay, wy, py, by, vy, qy] = P.y;
  out[0] = P.c[0] + ax * sin(wx * t + px) + bx * sin(vx * t + qx);
  out[1] = P.c[1] + ay * sin(wy * t + py) + by * sin(vy * t + qy);
}

// The flames for the next stretch: each torch heats the open cells within three
// sigma of it. A torch burns above the plate, so it heats both sides of a slit it
// is over; the slit stops only what moves through the metal.
function aim(S, t) {
  const pos = [0, 0];
  let n = 0;
  const rate = QR * (S.alpha / ALPHA0) ** 0.7;
  for (const P of TORCH) {
    torchAt(P, t, pos);
    const [b0, b1, b2] = P.b;
    const q = rate * P.p * (1 + b0 * sin(b1 * t + b2));
    const R = ceil(3 * SIGMA);
    const cx = round(pos[0]), cy = round(pos[1]);
    for (let y = max(0, cy - R); y <= min(H - 1, cy + R); y++)
      for (let x = max(0, cx - R); x <= min(W - 1, cx + R); x++) {
        const p = y * W + x;
        if (!S.open[p]) continue;
        const dx = x - pos[0], dy = y - pos[1], r2 = dx * dx + dy * dy;
        if (r2 > 9 * SIGMA * SIGMA) continue;
        S.si[n] = p;
        S.sw[n] = q * exp(-r2 / (2 * SIGMA * SIGMA));
        n++;
      }
  }
  S.sn = n;
}

// One explicit step of the heat equation for a time h with alpha h <= LAMMAX:
// the flux over a face is the difference of its two cells where the face
// conducts and nothing where a slit is.
function step(S, h) {
  const { T, fr, fd, gR, gD, loss } = S;
  const lam = S.alpha * h, decay = 1 - S.cool * h;
  for (let p = 0; p < N; p++) {
    fr[p + 1] = gR[p] ? T[p + 1] - T[p] : 0;
    fd[p + W] = gD[p] ? T[p + W] - T[p] : 0;
  }
  for (let p = 0; p < N; p++) T[p] += lam * (fr[p + 1] - fr[p] + fd[p + W] - fd[p] - loss[p] * T[p]);
  for (let i = 0; i < S.sn; i++) T[S.si[i]] += S.sw[i] * h;
  for (let p = 0; p < N; p++) T[p] *= decay;
}

function advance(S, span) {
  while (span > 1e-9) {
    const c = min(span, CHUNK);
    aim(S, S.t + c / 2);
    const m = ceil((S.alpha * c) / LAMMAX);
    for (let i = 0; i < m; i++) step(S, c / m);
    S.t += c;
    span -= c;
  }
}

// The sheet's colour at each reading of heat * temperature. The ramp is read
// through a soft ceiling so that it reaches its last colour only at the hottest cores.
function buildLut(S) {
  const key = S.hue.toFixed(3);
  if (key === S.lutKey) return;
  S.lutKey = key;
  const c = S.c;
  for (let i = 0; i < LUT; i++) {
    // Read at a power of the temperature, then through a soft ceiling.
    const r = ((XMAX * i) / (LUT - 1)) ** GAMMA;
    const s = r <= 0.75 ? r : 0.75 + 0.25 * tanh((r - 0.75) / 0.25);
    let k = 0;
    while (k < STOPS.length - 2 && s > STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], u = cl((s - a[0]) / (b[0] - a[0]), 0, 1);
    hsv(a[1] + (b[1] - a[1]) * u + S.hue, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u, c);
    for (let j = 0; j < 3; j++) S.lut[i * 3 + j] = round(255 * c[j]);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.heat = cl(k[1], 1, 3);
  S.alpha = ALPHA0 * 4 ** cl(k[2], -1, 1);
  S.cool = COOL * sqrt(S.alpha / ALPHA0);
  const f = reach(k[3]), la = round(f * LONG), lc = round(f * SHORT);
  if (la !== S.la || lc !== S.lc) buildMask(S, la, lc);
  if (!S.warm) {
    // Open on a plate that has been under the torches for three cooling times.
    S.t = TOPEN - PRE / S.cool;
    advance(S, PRE / S.cool);
    S.warm = true;
  }
  advance(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  buildLut(S);
  const { T, lut, open } = S, g = (S.heat * (LUT - 1)) / XMAX, top = LUT - 1;
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      if (!open[p]) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const i = max(0, min(top, round(T[p] * g))) * 3;
      display.setPixel(x, y, lut[i], lut[i + 1], lut[i + 2]);
    }
}
