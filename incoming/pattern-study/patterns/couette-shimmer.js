// ===== Patternflow pattern =====
// Title:   Couette Shimmer
// Family:  cosmetic
// Idea:    A pearly mica serum fills the gap between a turning inner cylinder and a still outer one, seen from the side, and as the inner one speeds up the smooth sideways streaks of Couette flow break into Taylor vortices, stacked rolls turning in alternate senses whose aligned mica shows as bright and dark bands up the whole panel, which then go wavy and send their waves round the cylinder, while single flakes glint white as they tumble.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 38, after shimmer serum stirred between two cylinders as rheoscopic fluid shows it (Paul Matisse's Kalliroscope), with the Taylor vortices of Taylor-Couette flow (G. I. Taylor, 1923)
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spin=0.5..4, Rolls=5..14, Counter=0..1
//
// Knob 1: Hue. Turns the serum round the whole wheel; its pearl leans 0.12 on round the wheel and the highlight 0.1 back. At 0 lilac with pink pearl; at 0.1 orchid, 0.2 rose, 0.3 coral, 0.4 gold, 0.5 lime, 0.6 mint, 0.7 aqua, 0.8 sky blue, 0.9 periwinkle. From red to lime the dark rolls stay bright and only deepen in colour, so nothing reads brown or olive.
// Knob 2: Spin. How fast the inner cylinder turns, 1 being the critical speed. From 0.5 to 1 plain Couette flow: the serum only runs round, and the panel is a sheen of sideways streaks moving at 5 LEDs a second per unit of Spin. Past 1 Taylor vortices: level bands, a pair of rolls 25.6 rows tall at the opening Rolls, at full contrast by 1.25, standing still while the streaks run through them and flow up one roll and down the next. From 1.2 the rolls go wavy, six waves round the cylinder, two and a half across the panel, travelling round at 0.34 of the inner cylinder's rate: at 2, the opening, a crest crosses the middle every 4.9 seconds. From 2.6 a slower second wave swells and shrinks the first, and from 3 the rolls fill with turbulence and their edges fray while the bands hold. In the laboratory those last two come at about 10 and 20 times the critical speed; the knob draws them in.
// Knob 3: Rolls. How many pairs of rolls stand up the panel, as a narrower gap between the cylinders gives more. At 5 each roll is 12.8 rows tall; at 9.5 6.7; at 14 4.6, a fine ribbing.
// Knob 4: Counter. How fast the outer cylinder turns the other way. Up to 0.15 nothing changes. From 0.15 to 0.6 the rolls lean into a spiral vortex that runs down the panel as it turns, 1.2 pairs of fall across the panel at 0.6, and the waves die away; from 0.6 a second spiral of the other hand runs up through it, and at 1 the two cross in a lattice of diamonds that slides sideways: interpenetrating spirals, as in Andereck, Liu and Swinney's map of the regimes (1986).

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, asin, exp, abs, round, random, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The cylinder seen from the side: column x looks at angle TH[x] round it,
// the front half from -1.29 to 1.29 radians, so a thing going round slows
// and narrows toward the panel's edges. ARC is the distance round the
// surface in LEDs, the cylinder 32 LEDs in radius.
const TH = new Float32Array(W), ARC = new Float32Array(W), SHADE = new Float32Array(W), SPEC = new Float32Array(W);
for (let x = 0; x < W; x++) {
  const xn = (x + 0.5) / 32 - 1, th = asin(0.96 * xn);
  TH[x] = th;
  ARC[x] = th * 32;
  // Light from the front and a little to the left: the serum dims toward
  // the cylinder's edges, and a soft upright highlight sits left of centre.
  SHADE[x] = 0.62 + 0.38 * cos(th + 0.2);
  SPEC[x] = exp(-(((th + 0.42) / 0.32) ** 2));
}

// What the aligned mica reflects across one pair of rolls, phase 0 to 2 pi:
// the outflow boundary at 0, where the serum leaves the inner cylinder and
// spreads against the outer one; the inflow boundary at pi. In one roll
// the serum at the outer wall runs up, in the next down, so the flakes there
// lean one way and then the other and the light catches one roll and not
// the next. A thin dark line marks the outflow, where the flakes stand on
// edge, and a thin bright one the inflow.
const NR = 512, REFL = new Float32Array(NR);
for (let i = 0; i < NR; i++) {
  const ph = (i / NR) * TAU, s = sin(ph);
  const d0 = min(ph, TAU - ph), dp = abs(ph - PI);
  REFL[i] = cl(0.5 + 0.34 * (s >= 0 ? s ** 0.6 : -((-s) ** 0.6)) - 0.42 * exp(-((d0 / 0.3) ** 2)) + 0.3 * exp(-((dp / 0.22) ** 2)), 0, 1);
}
const refl = (ph) => {
  const u = (ph / TAU) % 1;
  return REFL[((u < 0 ? u + 1 : u) * NR) | 0];
};

// Streak texture: random values on a 64 by 128 grid, read stretched 6 times
// sideways, so the flakes the flow has lined up show as long streaks.
const NU = 64, NV = 128;

export function setup(params) {
  const noise = new Float32Array(NU * NV);
  for (let i = 0; i < noise.length; i++) noise[i] = random();
  const rate = new Float32Array(H);
  for (let y = 0; y < H; y++) rate[y] = 0.85 + 0.3 * random();
  const glints = [];
  for (let i = 0; i < 220; i++) glints.push({ a: random() * 2.6 - 1.3, y: random() * H, ph: random() * TAU, w: 0.6 + 0.8 * random() });
  params.s = {
    hue: 0, spin: 2, rolls: 5, counter: 0, warm: 0, t: 0, ang: 0, wave: 0, spiral: 0, su: 0, begun: false,
    noise, rate, glints, glow: new Float32Array(N), CA: new Float32Array(W), CB: new Float32Array(W), RA: new Float32Array(H), RB: new Float32Array(H), col: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
}

function nz(S, u, v) {
  const n = S.noise, fu = floor(u), fv = floor(v), au = u - fu, av = v - fv;
  const i0 = ((fu % NU) + NU) % NU, i1 = (i0 + 1) % NU, j0 = ((fv % NV) + NV) % NV, j1 = (j0 + 1) % NV;
  const a = n[j0 * NU + i0] + (n[j0 * NU + i1] - n[j0 * NU + i0]) * au;
  const b = n[j1 * NU + i0] + (n[j1 * NU + i1] - n[j1 * NU + i0]) * au;
  return a + (b - a) * av;
}

// The regimes Spin walks through, as weights 0..1.
function regimes(s) {
  return {
    // Taylor vortices from the critical speed 1, full by 1.25.
    rolls: sqrt(sm(1, 1.25, s)),
    // Waves on the rolls from 1.2, full by 1.8; quieter again toward 4.
    waves: sqrt(sm(1.2, 1.8, s)) * (1 - 0.6 * sm(3, 4, s)),
    // A second, slower wave that modulates the first, from 2.6.
    modulate: sm(2.6, 3.4, s),
    // Turbulence inside the rolls from 3.
    turb: sm(3, 4, s),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.spin = cl(k[1], 0.5, 4);
  S.rolls = cl(k[2], 5, 14);
  S.counter = cl(k[3], 0, 1);
  step(S, d);
  if (!S.begun) {
    // Open as if the serum had been turning a while.
    for (let i = 0; i < 90; i++) step(S, 1 / 30);
    S.begun = true;
  }
}

function step(S, d) {
  const s = S.spin;
  S.t += d;
  // The streaks run round at 5 LEDs a second per unit of Spin; the inner
  // cylinder turns at twice that, 0.31 radians a second per unit; the
  // waves go round at 0.34 of the inner cylinder's rate, as Coles measured.
  S.su += d * 5 * s;
  S.ang += d * 0.3125 * s;
  S.wave += d * 0.34 * 0.3125 * s;
  S.spiral += d * 0.3125 * s * 0.5;
  // Glints ride the flow: round with the streaks, and up or down the roll
  // they are in toward its inflow boundary, where they dive and come back.
  const R = regimes(s), kk = (TAU * S.rolls) / H;
  for (const g of S.glints) {
    g.a += (d * 5 * s) / 32;
    if (g.a > 1.3) g.a -= 2.6;
    const ph = kk * (g.y - 63.5);
    g.y += d * R.rolls * 1.2 * s * sin(ph);
    if (g.y < 0) g.y += H;
    if (g.y >= H) g.y -= H;
    // At the inflow boundary the serum turns in toward the inner cylinder
    // and the flake goes with it; another comes out somewhere else.
    if (R.rolls > 0.3 && cos(ph) < -0.93) {
      g.y = random() * H;
      g.a = random() * 2.6 - 1.3;
    }
    // Tumbling: a flake turns over faster in faster shear.
    g.ph += d * g.w * (1.2 + 1.6 * s);
  }
}

function palette(S) {
  const h = S.hue + 0.74, hh = h - floor(h);
  // From red through orange and yellow to lime a deep tone reads brown or
  // olive on the panel, so there the rolls keep their brightness and differ
  // by saturation instead: full from 0.03 to 0.23 round the wheel, none
  // beyond 0.96 and 0.3.
  const dw = abs(((hh - 0.13 + 1.5) % 1) - 0.5), warm = 1 - sm(0.1, 0.17, dw);
  const c = S.col;
  // Deep, body, pearl and the highlight that leans round the wheel.
  hsv(h - 0.02 * warm, 0.82 + 0.06 * warm, 0.3 + 0.55 * warm, c[0]);
  hsv(h + 0.01, 0.6 - 0.15 * warm, 0.72 + 0.26 * warm, c[1]);
  hsv(h + 0.12, 0.26 - 0.08 * warm, 1, c[2]);
  hsv(h - 0.1, 0.12, 1, c[3]);
  S.warm = warm;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  const R = regimes(S.spin), kk = (TAU * S.rolls) / H, lam = H / S.rolls;
  // Counter-rotating outer cylinder: from 0.15 the rolls lean into a spiral
  // that runs down the panel as it turns; from 0.6 a second spiral of the
  // other hand, turning the same way and so running up, comes in across it.
  const cr = S.counter, sp1 = 3 * sm(0.15, 0.6, cr), sp2 = sm(0.6, 1, cr);
  const wv = R.waves * (1 - sm(0.15, 0.45, cr));
  const m = 6, aw = 0.13 * lam * kk;
  const c = S.col, glow = S.glow, { CA, CB, RA, RB } = S;
  // The rolls are not all equally strong: two slow waves of strength, one
  // drifting round with the serum, cross each other over the panel.
  for (let x = 0; x < W; x++) {
    CA[x] = sin(0.09 * ARC[x] - 0.8 * S.ang);
    CB[x] = cos(0.21 * ARC[x] + 0.5 * S.ang);
  }
  for (let y = 0; y < H; y++) {
    RA[y] = cos(0.045 * y + 0.13 * S.t);
    RB[y] = sin(0.083 * y - 0.21 * S.t);
  }
  glow.fill(0);
  // Glints: a flake flashes as it turns face on to the light.
  for (const g of S.glints) {
    const cw = cos(g.ph);
    if (cw < 0.85) continue;
    const xs = (sin(g.a) / 0.96 + 1) * 32 - 0.5, xi = round(xs), yi = round(g.y) % H;
    if (xi < 0 || xi >= W) continue;
    const b = ((cw - 0.85) / 0.15) ** 2 * 1.3;
    glow[yi * W + xi] += b;
    if (xi > 0) glow[yi * W + xi - 1] += b * 0.3;
    if (xi < W - 1) glow[yi * W + xi + 1] += b * 0.3;
    if (yi > 0) glow[(yi - 1) * W + xi] += b * 0.3;
    if (yi < H - 1) glow[(yi + 1) * W + xi] += b * 0.3;
  }
  // The streak texture flows along each roll toward its inflow boundary;
  // two copies, three seconds apart, take turns so it never smears.
  const TL = 3, t0 = S.t % TL, t1 = (S.t + TL / 2) % TL, w0 = 1 - abs((2 * t0) / TL - 1);
  const vz = R.rolls * 1.2 * S.spin;
  const turbU = 1 + 2 * R.turb;
  for (let x = 0; x < W; x++) {
    const th = TH[x], arc = ARC[x];
    // Axial displacement of the rolls here: the travelling wave, and in the
    // modulated regime a slower second wave riding on it.
    const wph = m * (th - S.wave);
    const wave = aw * wv * sin(wph) * (1 + 0.5 * R.modulate * sin(2 * th - 0.4 * S.wave * m));
    const spiral1 = sp1 * (th - S.spiral), spiral2 = 3 * sp2 * (th - S.spiral);
    for (let y = 0; y < H; y++) {
      const p = y * W + x;
      let ph = kk * (y - 63.5) + wave;
      if (R.turb > 0) ph += R.turb * 1.4 * (nz(S, arc / 5 - S.su * 0.4, y * 0.35 + S.t * 0.7) - 0.5);
      let rf = refl(ph + spiral1);
      if (sp2 > 0) rf = rf * (1 - 0.5 * sp2) + refl(ph - spiral2) * 0.5 * sp2;
      const rb = 0.5 + R.rolls * (rf - 0.5) * (1 + 0.16 * CA[x] * RA[y] + 0.1 * CB[x] * RB[y]);
      // Streaks: the texture moved round with the serum and along the roll.
      const az = sin(ph + spiral1) * vz, su = S.su * S.rate[y];
      const a0 = nz(S, ((arc - su) / 10) * turbU, (y - az * t0) * 0.75), a1 = nz(S, ((arc - su) / 10) * turbU + 17, (y - az * t1) * 0.75);
      const tex = a0 * w0 + a1 * (1 - w0) - 0.5;
      const sh = SHADE[x], spc = SPEC[x];
      // Light: the serum's body by the cylinder's shading and the rolls,
      // the streaks over it, the highlight strongest on the rolls that
      // catch the light, and the glints.
      const L = sh * (0.18 + 0.72 * rb) + (0.4 - 0.1 * R.rolls) * tex * sh;
      const hi = spc * (0.15 + 0.85 * rb * rb) * 0.75 + glow[p];
      // Deep to body to pearl by L; the highlight toward white.
      let r, g, b;
      if (L < 0.5) {
        const f = cl(L / 0.5, 0, 1);
        r = c[0][0] + (c[1][0] - c[0][0]) * f;
        g = c[0][1] + (c[1][1] - c[0][1]) * f;
        b = c[0][2] + (c[1][2] - c[0][2]) * f;
      } else {
        const f = cl((L - 0.5) / 0.45, 0, 1);
        r = c[1][0] + (c[2][0] - c[1][0]) * f;
        g = c[1][1] + (c[2][1] - c[1][1]) * f;
        b = c[1][2] + (c[2][2] - c[1][2]) * f;
      }
      const lo = 1 - (1 - cl(L / 0.2, 0, 1)) * (1 - 0.7 * S.warm), hm = min(1, hi);
      r *= lo;
      g *= lo;
      b *= lo;
      r += (c[3][0] - r) * hm;
      g += (c[3][1] - g) * hm;
      b += (c[3][2] - b) * hm;
      display.setPixel(x, y, round(255 * cl(r, 0, 1)), round(255 * cl(g, 0, 1)), round(255 * cl(b, 0, 1)));
    }
  }
}
