// ===== Patternflow pattern =====
// Title:   Evans Drop
// Family:  ferroxyl
// Idea:    Drops of salt-water gel with a yellow-green indicator sit on a scratched sheet of brushed steel seen from above, and in each one the iron dissolves where the drop is thick into a blue core that runs out along the scratches in tendrils, oxygen turns a pink corona inward from the thin rim, and a rust-brown ring forms where they meet and shrinks as the drop dries, leaving a crusty halo that fades as new drops land and rinse the plate.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ulick R. Evans's drop experiment on steel (1926, the differential aeration cell) read with the ferroxyl indicator of Cushman and Gardner (about 1907): potassium ferricyanide turns Fe2+ Turnbull's blue, phenolphthalein turns OH- pink. All from memory, no paper at hand; pattern round 268.
// Round:   268
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..6, Aeration=-1..1, Scratches=-1..1
//
// Knob 1: Hue. Turns the indicator palette (gel, blue, pink, rust, dried blue stain) once round the wheel with each colour's luma kept; the steel stays steel. 0 and 1 are the natural blue, pink and rust; at 0.5 the blue goes orange, the pink green and the rust teal.
// Knob 2: Pace. How fast the electrochemistry runs against the panel's clock, 1 to 6. A drop lives 180 model seconds on average at any Pace (a third shorter or twice as long for some), so about 180 s on the panel at 1, 90 s where it opens at 2 and 30 s at 6. At 2 a new drop's blue covers 5 percent of its gel after 5 s, 25 after 10 s, 41 after 15 s and 51 after 22 s; a drop lands every 17 s at 2 and every 5.7 s at 6.
// Knob 3: Aeration. How easily oxygen gets through the gel: the thickness at which half of it reaches the metal, 0.24 at -1, 0.57 where it opens, 0.9 at 1 (a drop is about 1.2 thick when it lands). Measured on drops 12 to 50 percent through their life, the blue anode is 0.77 of the radius at -1 (pink rim 0.07 wide, rust ring at 0.74), 0.57 at 0 (pink 0.30, ring 0.62) and 0.40 at 1 (pink 0.53, ring 0.52). Turned from -1 to 1 at Pace 2, the blue falls from 62 to 31 percent of the gel in 8 s.
// Knob 4: Scratches. How many scratches the plate carries and how far blue runs along them: none at -1 (polished, soft streaks only, blue from the pits near each drop's middle alone), 7 at -0.5, 21 at 0, 23 where it opens, 34 at 0.5, 36 at 1. Each is a fine line where the lamp catches it and a track for the blue; they fade in one at a time as the knob goes up, with no jump.
//
// What the picture is. A bare plate of brushed steel filling the 64 by 128 panel: cool grey streaks rising a little to the right, two lamps drifting over it as soft bright bands, a few fine scratches. On it 3 to 8 drops, 18 to 41 LED across, wobbly in outline, each with a bright rim, a pinpoint of lamp and a soft shadow, each at its own age. A new drop lands as a dome, rings and settles, yellow-green; blue starts at pits near its middle and along scratches and grows into a core with tendrils; pink spreads in from the rim; brown rust, ochre at its thin edge and dark in its core, builds where they meet. As the drop thins the core and the ring pull in; in the last third the rim lets go and leaves a smear, pale crust rings at the old rim and a bluish stain, which fade.
// What is modelled. On the 64 by 128 grid: a thickness field per drop (a lens, evaporating, pinned and then let go); oxygen, fed through the gel at a rate 1/h so thin edges are rich and the thick middle poor, taken up by the metal and diffusing; an anode activation, the passive film breaking down where oxygen is low and spreading from pits, faster along scratches, which make the metal act as if it had less oxygen; Fe2+, made at the anode, diffusing and burned by oxygen; OH-, made off the anode where oxygen is plentiful, diffusing; rust, made where Fe2+ meets OH- and kept. Blue and pink are read from Fe2+ and OH- by indicator thresholds. Nothing diffuses out of the wet gel.
// What is made up. Every rate, diffusivity and threshold; the 1/h feed; the drops' sizes, wobble, doming and drying; the pits; the scratch layout; the 180 model-second life; the birth rule (3 to 8 live drops, 5.5 on average); the lamps; and the fade: stains lose 1/e in 50 to 80 model seconds and a new drop rinses what it lands on, which real rust does not do, but without it the plate would fill up with brown. The first update runs 190 model seconds, with two drops already dry and five alive at 7 to 150 s.

const W = 64, H = 128, SW = W + 2, NP = SW * (H + 2);
const { floor, sqrt, exp, sin, cos, abs, min, max, PI, atan2, pow, ceil, log } = Math;
const TWO_PI = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gs = () => (rnd() + rnd() + rnd() - 1.5) * 2;
const pidx = (x, y) => (y + 1) * SW + x + 1;

// periodic value noise on an nx by ny lattice, read at any real place
function grid(nx, ny) {
  const g = new Float32Array(nx * ny);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return g;
}
function vs(g, nx, ny, u, v) {
  u -= nx * floor(u / nx);
  v -= ny * floor(v / ny);
  const x0 = floor(u) % nx, y0 = floor(v) % ny, x1 = (x0 + 1) % nx, y1 = (y0 + 1) % ny;
  let fx = u - floor(u), fy = v - floor(v);
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = g[y0 * nx + x0] + (g[y0 * nx + x1] - g[y0 * nx + x0]) * fx;
  const b = g[y1 * nx + x0] + (g[y1 * nx + x1] - g[y1 * nx + x0]) * fx;
  return a + (b - a) * fy;
}

// natural indicator colours (at the steel's own lightness)
const LIME = [152, 172, 56], BLUE_E = [30, 122, 160], BLUE_C = [4, 50, 118], PINK_E = [214, 152, 184], PINK_C = [180, 86, 142];
const RUST_E = [172, 146, 84], RUST_M = [134, 76, 44], RUST_D = [84, 46, 28], STAIN_B = [26, 62, 126], CRUST = [196, 178, 140];
const PALN = [LIME, BLUE_E, BLUE_C, PINK_E, PINK_C, RUST_E, RUST_M, RUST_D, STAIN_B];

// turn a colour's chroma round the grey axis with its luma kept (YIQ), pulling chroma in if the gamut would be left
function tint(c, ca, sa, out) {
  const r = c[0], g = c[1], b = c[2];
  const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
  const I2 = I * ca - Q * sa, Q2 = I * sa + Q * ca;
  const d0 = 0.956 * I2 + 0.621 * Q2, d1 = -0.272 * I2 - 0.647 * Q2, d2 = -1.106 * I2 + 1.703 * Q2;
  const mx = max(d0, d1, d2), mn = min(d0, d1, d2), s = min(1, 255 / (mx - mn + 1e-6));
  const y = cl(Y, -s * mn, 255 - s * mx);
  out[0] = y + s * d0;
  out[1] = y + s * d1;
  out[2] = y + s * d2;
}

const NSCR = 36;
const BRUSH = -0.11; // the brushing direction, radians, y down: streaks rise a little to the right

export function setup(params) {
  const S = {
    ready: false,
    ks: [0, 2, 0, 0.06],
    t: 0,
    h: new Float32Array(NP), // gel thickness
    rho0: new Float32Array(NP), // radius of the cell in units of its drop's landing radius
    de: new Float32Array(NP), // distance of a wet cell from its drop's edge, LED
    hl: new Float32Array(NP), // the lamp's pinpoint on each dome
    lamp: [-0.6, -0.8],
    wet: new Uint8Array(NP),
    act: new Int32Array(NP),
    nact: 0,
    O: new Float32Array(NP), O2: new Float32Array(NP),
    F: new Float32Array(NP), F2: new Float32Array(NP),
    P: new Float32Array(NP), P2: new Float32Array(NP),
    A: new Float32Array(NP), A2: new Float32Array(NP),
    R: new Float32Array(NP), // rust, kept
    Bs: new Float32Array(NP), // dried blue stain
    C: new Float32Array(NP), // salt crust
    Sw: new Float32Array(NP), // scratches as the metal feels them
    pit: new Float32Array(NP), // pits that stay anodic
    St: new Float32Array(NP), // scratches as the lamp sees them
    u4: -9,
    drops: [],
    nextBirth: 30,
    since: 0,
    img: new Uint8Array(W * H * 3),
    pal: PALN.map(() => [0, 0, 0]),
    palK: -9,
    fx: new Float32Array(W),
    fy: new Float32Array(H),
  };
  // brushed steel: streaks rising to the right in three scales, plus a faint grain
  const g1 = grid(3, 72), g2 = grid(2, 40), g3 = grid(2, 11), g4 = grid(21, 41), gS = grid(30, 60), gT = grid(13, 26);
  S.lf = new Float32Array(NP);
  S.sp = new Float32Array(NP); // speckle for rust and crust, blobs 2 to 4 LED across
  S.nz = new Float32Array(NP);
  const sh = -0.11;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = pidx(x, y), yy = y + sh * (x - 32);
      const a = vs(g1, 3, 72, (x * 3) / W, (yy * 72) / H) - 0.5, b = vs(g2, 2, 40, (x * 2) / W, (yy * 40) / H) - 0.5, c = vs(g3, 2, 11, (x * 2) / W, (yy * 11) / H) - 0.5;
      const d = vs(g4, 21, 41, (x * 21) / W, (y * 41) / H) - 0.5;
      S.lf[i] = 1 + 0.15 * a + 0.2 * b + 0.2 * c + 0.06 * d;
      const s1 = vs(gS, 30, 60, (x * 30) / W, (y * 60) / H), s2 = vs(gT, 13, 26, (x * 13) / W, (y * 26) / H);
      S.sp[i] = cl(0.5 + (0.6 * (s1 - 0.5) + 0.4 * (s2 - 0.5)) * 3.2, 0, 1);
      S.nz[i] = vs(gT, 13, 26, (x * 13) / W + 3.1, (y * 26) / H + 5.7);
    }
  buildScratches(S);
  params.s = S;
  return S;
}

// NSCR scratches, each with its own switch-on point along the Scratches knob; a wide soft profile for the chemistry, a thin one for the lamp
function buildScratches(S) {
  const tw = new Float32Array(NP), tt = new Float32Array(NP), seen = new Uint8Array(NP);
  S.scr = [];
  for (let s = 0; s < NSCR; s++) {
    const cross = rnd() < 0.2;
    const ang = BRUSH + (cross ? (rnd() < 0.5 ? -1 : 1) * (0.35 + 0.55 * rnd()) : (rnd() + rnd() - 1) * 0.5);
    const len = cross ? 16 + 24 * rnd() : 28 + 56 * rnd();
    const cx = rnd() * W, cy = rnd() * H, bend = (rnd() - 0.5) * 0.7;
    const ca = cos(ang), sa = sin(ang), steps = ceil(len / 0.6), touched = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, s0 = (t - 0.5) * len, off = bend * len * 0.25 * (4 * (t - 0.5) * (t - 0.5) - 0.33);
      const px = cx + ca * s0 - sa * off, py = cy + sa * s0 + ca * off, tp = ss(0, 0.12, t) * ss(1, 0.88, t);
      const x0 = floor(px) - 3, y0 = floor(py) - 3;
      for (let yy = y0; yy <= y0 + 6; yy++) {
        if (yy < 0 || yy >= H) continue;
        for (let xx = x0; xx <= x0 + 6; xx++) {
          if (xx < 0 || xx >= W) continue;
          const d2 = (xx + 0.5 - px) * (xx + 0.5 - px) + (yy + 0.5 - py) * (yy + 0.5 - py), i = pidx(xx, yy);
          const w = exp(-d2 / 3.4) * tp, v = exp(-d2 / 0.5) * tp;
          if (!seen[i]) {
            seen[i] = 1;
            touched.push(i);
          }
          if (w > tw[i]) tw[i] = w;
          if (v > tt[i]) tt[i] = v;
        }
      }
    }
    const n = touched.length, idx = new Int32Array(n), wide = new Float32Array(n), thin = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      const i = touched[j];
      idx[j] = i;
      wide[j] = tw[i];
      thin[j] = tt[i];
      tw[i] = 0;
      tt[i] = 0;
      seen[i] = 0;
    }
    S.scr.push({ th: 0.03 + (0.82 * (s + rnd() * 0.8)) / NSCR, dp: 0.75 + 0.25 * rnd(), idx, wide, thin });
  }
}
function setScratches(S, u) {
  S.u4 = u;
  S.Sw.fill(0);
  S.St.fill(0);
  for (const sc of S.scr) {
    const a = ss(sc.th, sc.th + 0.2, u * 1.2) * sc.dp;
    if (a < 0.01) continue;
    for (let j = 0; j < sc.idx.length; j++) {
      const i = sc.idx[j], w = sc.wide[j] * a, t = sc.thin[j] * a;
      if (w > S.Sw[i]) S.Sw[i] = w;
      if (t > S.St[i]) S.St[i] = t;
    }
  }
}

function spawn(S, minLife) {
  const R0 = 9 + 11.5 * pow(rnd(), 0.95);
  const live = S.drops.filter((d) => d.age < d.L);
  let cx = 32, cy = 64, best = -1e9;
  const neighbour = live.length > 0 && rnd() < 0.15;
  for (let t = 0; t < 28; t++) {
    let x, y;
    if (neighbour) {
      const n = live[(rnd() * live.length) | 0], a = rnd() * TWO_PI, r = n.R0 + R0 - 1.5 + 5 * rnd();
      x = n.cx + cos(a) * r;
      y = n.cy + sin(a) * r;
    } else {
      x = R0 * 0.45 + rnd() * (W - 0.9 * R0);
      y = R0 * 0.35 + rnd() * (H - 0.7 * R0);
    }
    if (x < R0 * 0.4 || x > W - R0 * 0.4 || y < R0 * 0.3 || y > H - R0 * 0.3) continue;
    let gap = 24;
    for (const d of live) gap = min(gap, sqrt((x - d.cx) * (x - d.cx) + (y - d.cy) * (y - d.cy)) - R0 - d.R0);
    const sc = neighbour ? -abs(gap - 0.5) : min(gap, 14) + 0.5 * rnd();
    if (gap < -3.5) continue;
    if (sc > best) {
      best = sc;
      cx = x;
      cy = y;
    }
  }
  const L = max(minLife || 0, 156 * exp(0.4 * gs()) * pow(R0 / 13, 0.4));
  const d = {
    cx, cy, R0, L: cl(L, 74, 330), age: 0,
    ex: 0.9 + 0.2 * rnd(), rot: rnd() * PI,
    Hc0: 1.15 * pow(R0 / 13, 0.3) * (0.9 + 0.2 * rnd()),
    tbl: new Float32Array(128),
    am: [0.05 + 0.04 * rnd(), 0.04 * rnd() + 0.02, 0.03 * rnd() + 0.01, 0.02 * rnd()],
    ph: [rnd() * TWO_PI, rnd() * TWO_PI, rnd() * TWO_PI, rnd() * TWO_PI],
    pits: [],
    Hc: 0, Rc: 0,
  };
  const np = 2 + ((rnd() * 2) | 0);
  for (let k = 0; k < np; k++) {
    const a = rnd() * TWO_PI, r = R0 * 0.38 * sqrt(rnd());
    d.pits.push({ x: cx + cos(a) * r, y: cy + sin(a) * r, t: 2 + 24 * rnd(), done: false });
  }
  S.drops.push(d);
  S.since = 0;
}

// the dome of one drop into h: a lens whose edge stays pinned until the last third of its life
function stamp(S, d) {
  const a = d.age, u = min(a / d.L, 1);
  const arr = exp(-a / 1.0), ring = exp(-a / 2.6) * cos((TWO_PI * a) / 3.4);
  const ev = pow(max(1 - u * u, 0), 0.9);
  d.Hc = d.Hc0 * ev * (1 + 0.8 * arr) * (1 + 0.08 * ring);
  if (d.Hc < 0.025) return false;
  d.Rc = d.R0 * (1 - 0.42 * pow(ss(0.6, 1, u), 1.3)) * (1 - 0.45 * arr) * (1 + 0.05 * ring);
  const tb = d.tbl;
  for (let k = 0; k < 128; k++) {
    const th = (k / 128) * TWO_PI - PI;
    tb[k] = 1 + d.am[0] * cos(2 * th + d.ph[0]) + d.am[1] * cos(3 * th + d.ph[1]) + d.am[2] * cos(4 * th + d.ph[2]) + d.am[3] * cos(5 * th + d.ph[3]);
  }
  const Rm = d.Rc * 1.2 + 2, cr = cos(d.rot), sr = sin(d.rot), h = S.h, rho0 = S.rho0, de = S.de;
  const x0 = max(0, floor(d.cx - Rm)), x1 = min(W - 1, ceil(d.cx + Rm)), y0 = max(0, floor(d.cy - Rm)), y1 = min(H - 1, ceil(d.cy + Rm));
  const ex = d.ex, k0 = d.Rc / d.R0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - d.cx, dy = y + 0.5 - d.cy;
      const px = (dx * cr + dy * sr) / ex, py = (-dx * sr + dy * cr) * ex;
      const dist = sqrt(px * px + py * py);
      const q = ((atan2(py, px) + PI) * 128) / TWO_PI, q0 = floor(q) & 127, q1 = (q0 + 1) & 127, f = q - floor(q);
      const w = tb[q0] + (tb[q1] - tb[q0]) * f;
      const rho = dist / (d.Rc * w);
      if (rho >= 1) continue;
      const hh = d.Hc * (1 - rho * rho), i = pidx(x, y);
      if (hh > h[i]) {
        h[i] = hh;
        rho0[i] = rho * k0;
        de[i] = (1 - rho) * d.Rc * w;
      }
    }
  // the lamp's pinpoint, a little towards the lamp from the middle
  const hx = d.cx + S.lamp[0] * d.Rc * 0.42, hy = d.cy + S.lamp[1] * d.Rc * 0.42, ha = ss(0.15, 0.5, d.Hc);
  for (let y = max(0, floor(hy - 3)); y <= min(H - 1, floor(hy + 3)); y++)
    for (let x = max(0, floor(hx - 3)); x <= min(W - 1, floor(hx + 3)); x++) {
      const i = pidx(x, y), v = exp(-((x + 0.5 - hx) * (x + 0.5 - hx) + (y + 0.5 - hy) * (y + 0.5 - hy)) / 1.5) * ha;
      if (v > S.hl[i] && h[i] > HMIN) S.hl[i] = v;
    }
  return true;
}

const HMIN = 0.035;
const DO = 0.9, DF = 0.45, DP = 0.8;
const KC = 0.35; // oxygen taken up by the metal, per model second
const BS = 0.45; // how much oxygen a scratch seems to take away from the anode's point of view
const R0A = 0.0035, R1A = 0.14, KDA = 0.25;
const TW = 34; // rust in the wet gel thins out over this many model seconds
const KF = 0.22, KOX = 0.25, KR = 1.0, KP = 0.45, KDP = 0.02, YR = 0.55;

// one model step of dt <= 0.25 s on the wet cells
function step(S, dt, hs) {
  const { O, O2, F, F2, P, P2, A, A2, R, wet, h, act, Sw, pit } = S;
  const n = S.nact;
  for (let k = 0; k < n; k++) {
    const i = act[k];
    const w1 = wet[i - 1], w2 = wet[i + 1], w3 = wet[i - SW], w4 = wet[i + SW];
    const o = O[i], f = F[i], p = P[i], a = A[i];
    const lo = w1 * (O[i - 1] - o) + w2 * (O[i + 1] - o) + w3 * (O[i - SW] - o) + w4 * (O[i + SW] - o);
    const lf = w1 * (F[i - 1] - f) + w2 * (F[i + 1] - f) + w3 * (F[i - SW] - f) + w4 * (F[i + SW] - f);
    const lp = w1 * (P[i - 1] - p) + w2 * (P[i + 1] - p) + w3 * (P[i - SW] - p) + w4 * (P[i + SW] - p);
    const nb = 0.25 * (w1 * A[i - 1] + w2 * A[i + 1] + w3 * A[i - SW] + w4 * A[i + SW]);
    const hh = h[i] > 0.1 ? h[i] : 0.1;
    const sup = (KC * hs) / hh;
    const on = (o + dt * (DO * lo + sup)) / (1 + dt * (sup + KC));
    const sw = Sw[i];
    const oe = on - BS * sw - 0.3 * pit[i];
    const g = 1 - ss(0.36, 0.58, oe);
    let an = a + dt * ((R0A * (0.2 + 3 * sw) + R1A * (0.5 + 2.2 * sw) * nb) * (1 - a) * g - KDA * a * (1 - g));
    an = an < 0 ? 0 : an > 1 ? 1 : an;
    let fn = f + dt * DF * lf;
    fn = (fn + dt * KF * an) / (1 + dt * (KOX * on + KR * p));
    let pn = p + dt * DP * lp;
    pn = (pn + dt * KP * ss(0.4, 0.8, on) * (1 - an) * (1 - p * 0.625)) / (1 + dt * (KDP + KR * f));
    if (pn > 1.6) pn = 1.6;
    if (fn > 3) fn = 3;
    let rn = (R[i] + dt * YR * KR * f * p * (1 - 0.65 * sw)) / (1 + dt / TW);
    if (rn > 3) rn = 3;
    O2[i] = on;
    F2[i] = fn;
    P2[i] = pn;
    A2[i] = an;
    R[i] = rn;
  }
  S.O = O2; S.O2 = O;
  S.F = F2; S.F2 = F;
  S.P = P2; S.P2 = P;
  S.A = A2; S.A2 = A;
}

// one stretch of model time (dtm <= 0.25): drops live and die, the gel is laid, cells wet and dry, the chemistry takes a step
function advance(S, dtm, hs, seeding) {
  S.t += dtm;
  S.since += dtm;
  const drops = S.drops;
  let live = 0, young = 0;
  for (const d of drops) {
    d.age += dtm;
    if (d.age < d.L) {
      live++;
      if (d.age < 60) young++;
    }
  }
  // births: slower the more drops are alive; always a young one about; never fewer than 3 or more than 8
  S.nextBirth -= dtm;
  if (live < 8 && !seeding) {
    if (live < 3 || (young === 0 && S.since > 10) || S.nextBirth <= 0) {
      spawn(S, 0);
      S.nextBirth = -log(1 - rnd() * 0.97) * [6, 6, 6, 15, 30, 70, 160, 300][min(live, 7)];
    }
  }
  const h = S.h;
  h.fill(0);
  S.hl.fill(0);
  let kept = 0;
  for (let k = 0; k < drops.length; k++) {
    const d = drops[k];
    if (stamp(S, d)) drops[kept++] = d;
  }
  drops.length = kept;
  // pits: the passive film breaks at a point near the middle where the metal can act as an anode
  for (const d of drops)
    for (const pt of d.pits) {
      if (pt.done || d.age < pt.t) continue;
      const i = pidx(floor(pt.x), floor(pt.y));
      if (!S.wet[i] || S.O[i] > 0.62) continue;
      pt.done = true;
      for (const o of [0, 1, -1, SW, -SW]) S.A[i + o] = max(S.A[i + o], S.wet[i + o] ? 0.45 : 0);
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const j = i + dy * SW + dx, v = exp(-(dx * dx + dy * dy) / 3);
          if (S.wet[j] && v > S.pit[j]) S.pit[j] = v;
        }
    }
  // cells that wet get fresh gel and rinse the old stains; cells that dry leave a crust, and the blue they held
  const { wet, O, F, P, A, R, Bs, C, rho0, act } = S;
  let na = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = pidx(x, y), now = h[i] > HMIN ? 1 : 0;
      if (now !== wet[i]) {
        if (now) {
          O[i] = 1 / (1 + h[i] / hs); F[i] = 0; P[i] = 0; A[i] = 0;
          R[i] *= 0.3; Bs[i] *= 0.3; C[i] *= 0.3;
        } else {
          const m = ss(0.1, 0.5, max(P[i], F[i])), r = rho0[i];
          const cw = 0.95 * exp(-((r - 0.97) / 0.06) * ((r - 0.97) / 0.06)) + 0.45 * exp(-((r - 0.42) / 0.07) * ((r - 0.42) / 0.07)) + 0.06 * ss(0.8, 0.3, r);
          const cc = cw * m;
          if (cc > C[i]) C[i] = cc;
          R[i] *= 1 - 0.85 * S.Sw[i];
          const bb = 0.85 * ss(0.3, 1.2, F[i]);
          if (bb > Bs[i]) Bs[i] = bb;
          O[i] = 0; F[i] = 0; P[i] = 0; A[i] = 0; S.pit[i] = 0;
        }
        wet[i] = now;
      }
      if (now) act[na++] = i;
    }
  S.nact = na;
  step(S, dtm, hs);
  // stains fade where nothing is wet (made up: see the header)
  const eR = exp(-dtm / 52), eB = exp(-dtm / 45), eC = exp(-dtm / 80);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = pidx(x, y);
      if (wet[i]) continue;
      if (R[i] > 0) { R[i] *= eR; if (R[i] < 0.004) R[i] = 0; }
      if (Bs[i] > 0) { Bs[i] *= eB; if (Bs[i] < 0.004) Bs[i] = 0; }
      if (C[i] > 0) { C[i] *= eC; if (C[i] < 0.004) C[i] = 0; }
    }
}

function prerun(S, hs) {
  const T = 190;
  // two drops that are already dry when the picture starts, leaving fading stains, and five alive at ages 7 to 150 s
  const seeds = [[0, 100], [20, 125], [T - 150, 0], [T - 105, 0], [T - 62, 0], [T - 28, 0], [T - 7, 0]];
  let si = 0;
  S.drops.length = 0;
  S.t = 0;
  S.nextBirth = 1e9;
  while (S.t < T) {
    while (si < seeds.length && S.t >= seeds[si][0]) {
      const [b, life] = seeds[si++];
      spawn(S, life ? 0 : T - b + 25 + 45 * rnd());
      if (life) S.drops[S.drops.length - 1].L = life;
    }
    advance(S, 0.25, hs, true);
  }
  S.nextBirth = 2 + 6 * rnd();
  S.since = 0;
}

function buildPalette(S, k1) {
  S.palK = k1;
  const a = k1 * TWO_PI, ca = cos(a), sa = sin(a);
  for (let k = 0; k < PALN.length; k++) tint(PALN[k], ca, sa, S.pal[k]);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  const hsOf = (k) => 0.24 + 0.66 * cl((k + 1) / 2, 0, 1);
  if (!S.ready) {
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    setScratches(S, cl((kn[3] + 1) / 2, 0, 1));
    prerun(S, hsOf(kn[2]));
    S.ready = true;
  }
  const e = 1 - exp(-d / 0.2);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  const pace = cl(S.ks[1], 1, 6), hs = hsOf(S.ks[2]), u4 = cl((S.ks[3] + 1) / 2, 0, 1);
  if (abs(u4 - S.u4) > 0.002) setScratches(S, u4);
  const dm = d * pace, nst = ceil(dm / 0.25 - 1e-6);
  for (let k = 0; k < nst; k++) advance(S, dm / nst, hs, false);
  render(S, d);
}

function render(S, d) {
  const tr = (S.rt = (S.rt || 0) + d); // real time, for the lamp
  if (abs(S.ks[0] - S.palK) > 0.0005) buildPalette(S, S.ks[0]);
  const pal = S.pal, img = S.img, h = S.h, wet = S.wet;
  const [LI, BE, BC, PE, PC, RE, RM, RD, SB] = pal;
  // the lamp: a bright band, tall because the steel is brushed across it, and a light direction for the domes
  const lx = 32 + 24 * sin((TWO_PI * tr) / 86 + 0.6) + 9 * sin((TWO_PI * tr) / 29 + 2.2);
  const ly = 64 + 44 * sin((TWO_PI * tr) / 121 + 2.1);
  const lx2 = 32 + 27 * sin((TWO_PI * tr) / 53 + 4), ly2 = 64 + 52 * sin((TWO_PI * tr) / 71 + 0.9);
  for (let x = 0; x < W; x++) S.fx[x] = exp(-((x - lx) * (x - lx)) / 230) + 0.55 * exp(-((x - lx2) * (x - lx2)) / 90);
  for (let y = 0; y < H; y++) S.fy[y] = 0.55 + 0.45 * exp(-((y - ly) * (y - ly)) / 3000) + 0.3 * exp(-((y - ly2) * (y - ly2)) / 700);
  const Lx = -0.5 + 0.18 * sin((TWO_PI * tr) / 83 + 1.3), Ly = -0.55 + 0.15 * sin((TWO_PI * tr) / 61 + 4.1);
  const Ln = sqrt(Lx * Lx + Ly * Ly), lxn = Lx / Ln, lyn = Ly / Ln;
  S.lamp[0] = lxn;
  S.lamp[1] = lyn;
  const { O, F, P, R, Bs, C, lf, sp, St } = S;
  for (let y = 0; y < H; y++) {
    const fy = S.fy[y];
    for (let x = 0; x < W; x++) {
      const i = pidx(x, y), o = (y * W + x) * 3;
      const sh = S.fx[x] * fy;
      // the steel
      const m = (1 + (lf[i] - 1) * (0.8 + 1.6 * sh)) * (0.9 + 0.5 * sh);
      const sc = St[i] * (9 + 36 * sh);
      let r = 76 * m + 22 * sh + sc, g = 81 * m + 25 * sh + sc, b = 90 * m + 30 * sh + sc * 1.1;
      const hi = h[i];
      let lum = (0.299 * r + 0.587 * g + 0.114 * b) / 100;
      lum = lum < 0.55 ? 0.55 : lum > 1.7 ? 1.7 : lum;
      const lm = 0.62 + 0.38 * lum; // the dyes follow the steel's light more gently than the steel does
      // a soft shadow behind the drop, away from the lamp
      if (hi < HMIN && x > 2 && y > 2 && h[i - 2 - 2 * SW] > HMIN) {
        const sd = 0.74 + 0.1 * (1 - ss(0, 0.3, h[i - 2 - 2 * SW]));
        r *= sd; g *= sd; b *= sd;
      }
      // stains lie on the steel, and show through the gel
      const R_ = R[i], Bs_ = Bs[i], C_ = C[i];
      if (Bs_ > 0.01) {
        const k = Bs_ * 0.75;
        r += (SB[0] * lum - r) * k; g += (SB[1] * lum - g) * k; b += (SB[2] * lum - b) * k;
      }
      let rw = 0;
      if (R_ > 0.01) {
        rw = (1 - exp(-1.6 * R_)) * (0.5 + 0.9 * sp[i]) * (wet[i] ? 1 : 0.55);
        rw = rw > 0.96 ? 0.96 : rw;
      }
      if (wet[i]) {
        const dE = S.de[i], aF = ss(0, 0.9, dE);
        const f = F[i], p = P[i];
        // slope of the dome, for the rim and the highlight
        const gx = (h[i + 1] - h[i - 1]) * 0.5 * 4, gy = (h[i + SW] - h[i - SW]) * 0.5 * 4;
        const gm = sqrt(gx * gx + gy * gy);
        // the gel: yellow-green over the steel, then the dyes laid over it
        let cr = r + (LI[0] * lm - r) * 0.66, cg = g + (LI[1] * lm - g) * 0.66, cb = b + (LI[2] * lm - b) * 0.66;
        const pk = ss(0.2, 0.6, p) * 0.92;
        if (pk > 0.003) {
          const q = ss(0.6, 1.5, p);
          cr += ((PE[0] + (PC[0] - PE[0]) * q) * lm - cr) * pk;
          cg += ((PE[1] + (PC[1] - PE[1]) * q) * lm - cg) * pk;
          cb += ((PE[2] + (PC[2] - PE[2]) * q) * lm - cb) * pk;
        }
        const bl = ss(0.1, 0.3, f);
        if (bl > 0.003) {
          const q = ss(0.2, 1.0, f * (0.75 + 0.5 * S.nz[i]));
          cr += ((BE[0] + (BC[0] - BE[0]) * q) * lm - cr) * bl;
          cg += ((BE[1] + (BC[1] - BE[1]) * q) * lm - cg) * bl;
          cb += ((BE[2] + (BC[2] - BE[2]) * q) * lm - cb) * bl;
        }
        // a thin film at the end of the drop's life dries towards the steel
        const film = aF * ss(0.03, 0.2, hi);
        r += (cr - r) * film; g += (cg - g) * film; b += (cb - b) * film;
        // the rim, a bright line on the edge and brighter on the lamp's side, then the pinpoint of the lamp on the dome
        const spec = S.hl[i] * aF;
        r += spec * 175; g += spec * 185; b += spec * 195;
        if (gm > 0.01) {
          const nxn = -gx / gm, nyn = -gy / gm, face = 0.35 + 0.65 * cl(0.5 + 0.5 * (nxn * lxn + nyn * lyn) / (sqrt(lxn * lxn + lyn * lyn) + 1e-6), 0, 1);
          const rim = exp(-((dE - 0.8) * (dE - 0.8)) / 0.7) * face * aF;
          r += rim * 52; g += rim * 58; b += rim * 68;
        }
      }
      if (rw > 0.003) {
        // rust: ochre at the thin edge, orange-brown, a darker core where it is thick
        const q1 = ss(0.12, 0.6, R_), q2 = ss(0.9, 2, R_);
        let tr_ = RE[0] + (RM[0] - RE[0]) * q1, tg = RE[1] + (RM[1] - RE[1]) * q1, tb = RE[2] + (RM[2] - RE[2]) * q1;
        tr_ += (RD[0] - tr_) * q2; tg += (RD[1] - tg) * q2; tb += (RD[2] - tb) * q2;
        const sv = (0.75 + 0.4 * sp[i]) * (wet[i] ? 1 : 0.8);
        r += (tr_ * lum * sv - r) * rw; g += (tg * lum * sv - g) * rw; b += (tb * lum * sv - b) * rw;
      }
      if (C_ > 0.01) {
        const k = cl(C_ * (0.25 + 1.1 * sp[i]), 0, 0.7);
        r += (CRUST[0] * lum - r) * k; g += (CRUST[1] * lum - g) * k; b += (CRUST[2] * lum - b) * k;
      }
      img[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      img[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      img[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const img = S.img;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, img[o], img[o + 1], img[o + 2]);
    }
}
