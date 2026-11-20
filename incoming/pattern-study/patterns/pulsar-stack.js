// ===== Patternflow pattern =====
// Title:   Pulsar Stack
// Family:  pulsar
// Idea:    Every rotation of a radio pulsar is one ridgeline of 64 columns, stacked a row pitch of 4 LEDs apart with each ridge hiding the lines behind it, while sub-pulses slant across the rows, the pulsar nulls and changes mode, scintillation lifts and dims the whole stack, and new rows climb in from the bottom edge.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Single-pulse stacks of CP 1919 plotted by Harold Craft (1970), the pulsar found by Jocelyn Bell and Antony Hewish (1967), drifting sub-pulses (Drake and Craft 1968), nulling (Backer 1970), mode changing (Backer 1970), interstellar scintillation (Rickett 1969); pattern round 205
// Round:   205
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.3..8, Drift=0..1, Nulling=0.15..1
//
// Knob 1: Hue. Turns the line colour round the wheel from the ice white with a blue cast that it opens on; the peaks stay close to white and the far rows keep the colour.
// Knob 2: Rate. How many pulses arrive a second, which is how fast the stack climbs: at 0.3 a new row takes 3.3 s and the panel shows 100 s of pulsar, at 2 a row comes every half second and a ridge is on the panel for 16 s, at 8 the whole stack streams by in 4 s.
// Knob 3: Drift. The slant of the sub-pulse bands, as the LEDs a sub-pulse slides sideways from one row to the next: -3 at 0 where the bands lean to the left going up the panel, 0 in the middle where they stand as vertical columns, +3 at 1 where they lean the other way; mode changes scale and sometimes flip it for tens of rows.
// Knob 4: Nulling. How often the pulsar switches off and how much each pulse differs from its neighbours: at 0.15 about one row in seven is a flat noise line and the profile is steady, at 1 the pulsar is off for more than half the rows and the sub-pulses jump in height and place from row to row.

const W = 64;
const H = 128;
const PITCH = 4;
// A new row is born with its baseline here, far enough below the bottom edge that
// its tallest peak (12.5 LEDs) cannot show before it has begun to climb.
const Y0 = H + 18;
const NR = 44;
const HMAX = 12.5;
const { floor, ceil, sin, cos, exp, sqrt, abs, tanh, log, PI, min, max, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
const TAU = 2 * PI;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// An integer hash to 0..1, so a sub-pulse keeps its own strength and width for as
// long as it stays on the panel, whichever way the drift turns.
function hash(m, salt) {
  let h = (m * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// The modes a pulsar can sit in. dm scales the drift, P2 is the spacing of the
// sub-pulses in LEDs, sub the strength of the drifting part, core and cone the
// steady components, sw the sub-pulse width.
const MODES = [
  { dm: 1.0, P2: 15, sub: 1.2, core: 0.7, cone: 0.8, sw: 3.0 },
  { dm: 0.15, P2: 19, sub: 0.6, core: 1.3, cone: 1.0, sw: 3.5 },
  { dm: 1.8, P2: 11.5, sub: 1.0, core: 0.55, cone: 0.6, sw: 2.5 },
  { dm: -0.6, P2: 16, sub: 1.2, core: 0.8, cone: 0.7, sw: 3.2 },
];
const MKEYS = ["dm", "P2", "sub", "core", "cone", "sw"];

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.15],
    off: 0, n: 0,
    rows: [],
    // the mode machine
    mode: 0, modeLeft: 40, mp: { dm: 1, P2: 15, sub: 1.2, core: 0.7, cone: 0.8, sw: 3.0 },
    // the null machine
    on: true, nullLeft: 0, gate: 1, burst: 0,
    // the drifting phase, in sub-pulse spacings, and its wander
    b: Math.random() * 40, wander: 0,
    c0: 32, cw: 0,
    ac: 0, al: 0, ar: 0, ap: 0,
    salt: floor(Math.random() * 1e6),
    ph: [TAU * Math.random(), TAU * Math.random(), TAU * Math.random(), TAU * Math.random()],
    sc: 0,
    buf: new Float32Array(W * H * 3),
    B: [0.6, 0.8, 1], C: [0, 0, 0],
    lim: new Float32Array(W),
  };
  params.s = S;
}

// Interstellar scintillation: the flux at the telescope, from waves whose
// periods (53, 17.3, 131 and 7.1 s) share no common multiple.
function scint(S, t) {
  const p = S.ph;
  const v = 0.5 * sin((TAU * t) / 53 + p[0]) + 0.35 * sin((TAU * t) / 17.3 + p[1]) + 0.3 * sin((TAU * t) / 131 + p[2]) + 0.2 * sin((TAU * t) / 7.1 + p[3]);
  return exp(0.45 * v + S.sc);
}

// One pulse: 64 heights in LEDs above the baseline.
function genRow(S) {
  const k = S.k;
  const nul = cl(k[3], 0.15, 1);
  const f = 0.04 + 0.5 * pow(nul, 0.9);
  const v = 0.18 + 0.85 * nul;
  // the knob-driven drift in LEDs a row, scaled by the mode
  const D = (2 * cl(k[2], 0, 1) - 1) * 3;

  // modes change at random, every 16 to 80 rows
  if (--S.modeLeft <= 0) {
    let m = floor(Math.random() * (MODES.length - 1));
    if (m >= S.mode) m++;
    S.mode = m;
    S.modeLeft = 16 + floor(64 * pow(Math.random(), 1.3));
  }
  const tm = MODES[S.mode];
  const mp = S.mp;
  for (let i = 0; i < MKEYS.length; i++) mp[MKEYS[i]] += (tm[MKEYS[i]] - mp[MKEYS[i]]) * 0.5;

  // nulling: off for 2 to 18 rows, back with a short bright burst
  if (S.on) {
    const pStart = f / (1 - f) / 6.5;
    if (Math.random() < pStart) {
      S.on = false;
      S.nullLeft = 2 + floor(min(16, -log(1 - Math.random()) * 4.5));
    }
  } else if (--S.nullLeft <= 0) {
    S.on = true;
    S.burst = 0.5 + 0.7 * Math.random();
  }
  S.gate += ((S.on ? 1 : 0) - S.gate) * 0.8;
  S.burst *= 0.55;

  // slow wanders: the drift rate, the centre of the profile, the log-strength of each component
  S.wander += -0.06 * S.wander + 0.12 * gauss();
  S.cw += -0.08 * S.cw + 0.25 * gauss();
  S.c0 = 32 + cl(S.cw, -3, 3);
  S.ac = 0.55 * S.ac + 0.84 * 0.35 * v * gauss();
  S.al = 0.5 * S.al + 0.87 * 0.3 * v * gauss();
  S.ar = 0.5 * S.ar + 0.87 * 0.3 * v * gauss();
  S.ap = 0.7 * S.ap + 0.7 * 0.25 * v * gauss();

  const drift = D * mp.dm * cl(1 + 0.3 * S.wander, 0.3, 1.8) + 0.12 * v * gauss();
  S.b += drift / mp.P2;

  // each pulse is stamped with the scintillation at the moment it arrives
  const sc = scint(S, S.t);
  S.sc += -0.02 * S.sc + 0.03 * gauss();
  const gate = S.gate * (1 + S.burst);
  const flux = gate * sc * exp(S.ap);

  const I = new Float32Array(W);
  const c0 = S.c0;
  // steady components: the core and a cone on either side
  const ac = 3.4 * mp.core * exp(S.ac), al = 2.0 * mp.cone * exp(S.al), ar = 2.2 * mp.cone * exp(S.ar);
  for (let x = 0; x < W; x++) {
    const xc = x + 0.5;
    const d0 = (xc - c0) / 3.1, dl = (xc - (c0 - 10.5)) / 4.2, dr = (xc - (c0 + 11.5)) / 4.6;
    I[x] = ac * exp(-0.5 * d0 * d0) + al * exp(-0.5 * dl * dl) + ar * exp(-0.5 * dr * dr);
  }
  // the drifting sub-pulses
  const P2 = mp.P2;
  const span = 27 / P2;
  const m0 = ceil(S.b - span), m1 = floor(S.b + span);
  for (let m = m0; m <= m1; m++) {
    const xm = c0 + (m - S.b) * P2 + 0.5 * v * gauss();
    const e = exp(-0.5 * ((xm - c0) / 11) ** 2);
    const amp = 4.6 * mp.sub * e * (0.3 + 1.0 * hash(m, S.salt)) * exp(0.45 * v * gauss());
    const sw = mp.sw * (0.8 + 0.45 * hash(m, S.salt + 7));
    const x0 = max(0, floor(xm - 4 * sw)), x1 = min(W - 1, ceil(xm + 4 * sw));
    for (let x = x0; x <= x1; x++) {
      const d = (x + 0.5 - xm) / sw;
      I[x] += amp * exp(-0.5 * d * d);
    }
  }
  const hh = new Float32Array(W);
  const hn = new Float32Array(W);
  // receiver noise, a little smoothed so it wobbles and does not buzz
  const w = new Float32Array(W + 2);
  for (let i = 0; i < W + 2; i++) w[i] = gauss();
  for (let x = 0; x < W; x++) {
    const nz = 0.8 * (w[x] + 2 * w[x + 1] + w[x + 2]) * 0.25;
    const s = I[x] * flux;
    const hgt = HMAX * tanh(s / HMAX);
    hn[x] = min(1, hgt / 9);
    hh[x] = max(-1.6, hgt + nz);
  }
  return { h: hh, hn, lum: cl((0.72 + 0.4 * min(1.4, sc)) * exp(0.28 * gauss()), 0.4, 1.5) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.15];
  dt = cl(dt || 0, 0, 0.1);
  const rate = cl(S.k[1], 0.3, 8);
  if (S.first) {
    // Open on a stack that has been arriving for a while.
    S.t = 0;
    for (let i = 0; i < NR; i++) {
      S.rows.push(genRow(S));
      S.t += 1 / rate;
    }
    S.first = false;
  }
  S.t += dt;
  S.off += rate * dt;
  while (S.off >= 1) {
    S.off -= 1;
    S.rows.push(genRow(S));
    if (S.rows.length > NR) S.rows.shift();
  }
}

// The lift is a table: level to the power 0.8, in steps of 1/256 up to 1.
const LIFT_N = 257;
const LIFT = new Float32Array(LIFT_N);
for (let i = 0; i < LIFT_N; i++) LIFT[i] = min(1, pow(i / 256, 0.8));
const GLOW_N = 6;
const GLOW = new Float32Array(GLOW_N);
for (let i = 0; i < GLOW_N; i++) GLOW[i] = 0.1 * exp(-(i + 0.5) / 1.3);

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { buf, B, C, lim, rows } = S;
  buf.fill(0);
  lim.fill(1e9);
  hsv(0.585 + S.k[0], 0.5, 1, B);
  const n = rows.length;
  // nearest row first, so each ridge can hide what is behind it
  for (let r = n - 1; r >= 0; r--) {
    const row = rows[r];
    const base = Y0 - (n - 1 - r) * PITCH - S.off * PITCH;
    if (base < -4) break;
    const depth = 0.34 + 0.66 * pow(cl(base / H, 0, 1), 0.85);
    const hh = row.h, hn = row.hn;
    for (let x = 0; x < W; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < W - 1 ? x + 1 : W - 1;
      const yc = base - hh[x];
      const ya = 0.5 * (yc + base - hh[xl]), yb = 0.5 * (yc + base - hh[xr]);
      const lo = min(yc, ya, yb), hi = max(yc, ya, yb);
      // The stroke is 2 LEDs thick where the ridge is flat and thins to 1 on a steep face,
      // so two ridges 4 LEDs apart do not run together where they climb.
      const ht = max(0.5, 1 - 0.2 * (hi - lo));
      const top = lo - ht;
      const bot = hi + ht;
      const L = lim[x];
      if (top < L) {
        // brighter at the peaks, whiter too
        const pk = hn[x];
        const br = depth * row.lum * (0.34 + 0.9 * pk);
        const wh = 0.1 + 0.8 * pk * pk;
        const cr = br * (B[0] + (1 - B[0]) * wh);
        const cg = br * (B[1] + (1 - B[1]) * wh);
        const cb = br * (B[2] + (1 - B[2]) * wh);
        const y0 = max(0, floor(top) - GLOW_N + 1);
        const y1 = min(H - 1, floor(bot));
        for (let y = y0; y <= y1; y++) {
          const vis = cl(L - y, 0, 1);
          if (vis <= 0) break;
          let a;
          if (y + 1 <= top) {
            const gi = floor(top - y - 0.5);
            a = GLOW[gi < 0 ? 0 : gi >= GLOW_N ? GLOW_N - 1 : gi];
          } else {
            a = min(y + 1, bot) - max(y, top);
            if (a <= 0) continue;
            if (y < top) a += (top - y) * GLOW[0];
          }
          const i = (y * W + x) * 3;
          const q = a * vis;
          buf[i] += cr * q;
          buf[i + 1] += cg * q;
          buf[i + 2] += cb * q;
        }
        lim[x] = top;
      }
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const e0 = buf[i], e1 = buf[i + 1], e2 = buf[i + 2];
      if (e0 < 0.02 && e1 < 0.02 && e2 < 0.02) continue;
      C[0] = LIFT[min(LIFT_N - 1, (e0 * 256) | 0)];
      C[1] = LIFT[min(LIFT_N - 1, (e1 * 256) | 0)];
      C[2] = LIFT[min(LIFT_N - 1, (e2 * 256) | 0)];
      display.setPixel(x, y, 255 * C[0], 255 * C[1], 255 * C[2]);
    }
}
