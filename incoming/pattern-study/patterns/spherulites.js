// ===== Patternflow pattern =====
// Title:   Spherulites
// Family:  spherulite
// Idea:    A polymer melt slides down a hot stage between crossed polarizers: the top of the panel is black melt, spherulites nucleate as points and grow as discs that each carry a dark Maltese cross and rings of interference colour, and by the bottom they have met along curved seams and tile the panel, while the polarizers turn slowly and every cross swings with them.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: polymer spherulites under the polarizing microscope and their Maltese cross (from memory), banded spherulites as lamellae that twist along the radius (Andrew Keller 1959, Keith and Padden 1959, from memory), the interference colour chart (Auguste Michel-Levy and Alfred Lacroix, 1888), the Jones calculus (R. Clark Jones, 1941), the full-wave sensitive tint plate (from memory), Johnson-Mehl tessellation (William Johnson and Robert Mehl, 1939); the sample that scrolls through a fixed temperature gradient, the per-LED first-arrival test over a short list of nuclei in place of a grid, the plate light held dim in the melt and on the cross arms, and the three-band colour table are original, pattern round 252
// Round:   252
// ===============================
// @matrix 64x128
// @knobs Plate=0..1, Speed=0.2..3, Nuclei=-1..1, Bands=-1..1
//
// Knob 1: Plate. A retarder plate at 45 degrees to the polarizers, 0 to 800 nm of retardation. It opens at 0, with no plate and a black melt; as it grows, the two pairs of opposite quadrants of every spherulite take different colours, and the melt and the cross arms take a faint tint of the plate's own colour, violet at the full wave of 540 nm (0.675).
// Knob 2: Speed. 0.2 to 3, opening at 2. Stage travel and growth together: the sample moves 2 LEDs a second for each unit, 4 at the opening, and the fronts grow at about a quarter of that, so the picture keeps its proportions and only moves faster.
// Knob 3: Nuclei. -1 to 1, opening at 0. How many nuclei the melt throws: at -1 a few spherulites about 32 LEDs across, at 0 about 22, at 1 many about 15 across with closer bands. Growth slows as the count rises, so the height where they meet stays put. The first frame is already grown at the knob's value; a turn after that changes the growth speed at once and the count as new nuclei arrive.
// Knob 4: Bands. -1 to 1, opening at about 0.06. The twist of the lamellae: at -1 no bands, each spherulite one flat colour under its cross; at the opening soft rings 8 to 11 LEDs apart; at 1 rings about 5 LEDs apart that run through three or four colours each.

// The sample moves down the panel and each nucleus moves with it. All fronts grow at one speed, so a point of
// the sample turns crystalline when the first disc reaches it and belongs to that disc for good. With R the
// radius a nucleus would have by now if nothing stood in its way, the owner of a LED is the nucleus with the
// smallest (distance - R), and the LED is crystal when that is below zero. Two such discs meet along a
// hyperbola arc. Nothing is kept on a grid: every frame asks the list of nuclei, 30 to 130 of them.
//
// The stage is hot at the top and colder downward. Most nuclei appear in a band just under the hot zone
// (rows -10 to 12), fewer below it, and more again toward the cold end, which closes the last pockets of melt.
//
// Inside a spherulite the slow axis lies along the radius, at angle a to the polarizer, with retardation G.
// Polarizer, crystal, plate (retardation Gp, slow axis 45 degrees from the polarizer), analyzer at 90 degrees:
// multiplying the four Jones matrices out gives, at wavelength l with d = 2 pi G / l and dp = 2 pi Gp / l,
//   I = 1/2 - 1/2 cos^2(2a) cos(dp) - 1/4 (sin^2 2a - sin 2a) cos(d - dp) - 1/4 (sin^2 2a + sin 2a) cos(d + dp).
// With no plate that is sin^2(2a) sin^2(pi G / l): the cross lies along the polarizer and the analyzer, whichever
// way the crystal is turned, so when the pair turns every cross turns with it.
// Each colour channel is a band of wavelengths, so the table below holds C(G), the mean of cos(2 pi G / l) over
// the band, and the cosines above become lookups. 1/2 (1 - C(G)) is the interference colour at retardation G:
// grey, white, yellow, orange, red, violet at 540 nm, then blue, green, yellow and round again, paler each time.
// A banded spherulite is one whose lamellae twist as they grow outward, so G falls and comes back along the radius.

const W = 64, H = 128;
const { min, max, abs, sqrt, exp, sin, cos, log, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = () => Math.random();

const MX = 30;                  // nuclei are also born this far outside the left and right edges
const YA = -10, YB = 12;        // the band of the stage where most nuclei appear
const N1 = 0.0018;              // nuclei per LED of area that the band throws at Nuclei 0
const LATE = 0.45, COLD = 1.8;  // the rate just below the band and at the cold end, as shares of the band's
const RHO = 0.26;               // growth speed over stage speed at Nuclei 0
const US = 2;                   // stage travel, LEDs a second for each unit of Speed
const NMAX = 400;               // room for nuclei
const BS = 8, BW = W / BS, BH = H / BS;   // the panel in 8 by 8 blocks
const MAXC = 28, HD = 5.66;     // nuclei kept per block, and half a block's diagonal
const GSTEP = 2, NG = 1500;     // the colour table: 2 nm steps to 3000 nm

// C(G) for red, green and blue: bands 28 nm wide (one sigma) round 610, 540 and 460 nm
const CT = new Float32Array(NG * 3);
(function chart() {
  const mid = [610, 540, 460];
  for (let c = 0; c < 3; c++) {
    for (let g = 0; g < NG; g++) {
      let s = 0, ws = 0;
      for (let k = -7; k <= 7; k++) {
        const w = exp(-(k * k * 64) / (2 * 28 * 28));
        s += w * cos(TP * g * GSTEP / (mid[c] + k * 8));
        ws += w;
      }
      CT[g * 3 + c] = s / ws;
    }
  }
})();
// display value from intensity
const TONE = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) TONE[i] = cl(Math.round(255 * Math.pow(i / 1024, 0.72)), 0, 255);

export function setup(params) {
  const ph = new Float64Array(16);
  for (let i = 0; i < 16; i++) ph[i] = rnd() * TP;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    ta: 0, trav: 0, wait: -log(1 - rnd()), ph,
    n: 0,
    // per nucleus: place, free radius, retardation, band period, band phase, optical sign, band swing, ring lean
    x: new Float64Array(NMAX), y: new Float64Array(NMAX), R: new Float64Array(NMAX),
    g0: new Float64Array(NMAX), pb: new Float64Array(NMAX), bp: new Float64Array(NMAX), sg: new Float64Array(NMAX), sw: new Float64Array(NMAX),
    wc: new Float64Array(NMAX * 4),
    ci: new Int16Array(MAXC),
  });
  return st;
}

// the smallest (distance - R) at a point: above zero the point is still melt
function reach(st, px, py) {
  let m = 1e9;
  const x = st.x, y = st.y, R = st.R;
  for (let i = 0; i < st.n; i++) {
    const dx = px - x[i], dy = py - y[i];
    const v = sqrt(dx * dx + dy * dy) - R[i];
    if (v < m) m = v;
  }
  return m;
}

// how many times more nuclei than at Nuclei 0. Growth slows by the square root of it, so the share of a row
// that has turned at a given height stays the same and only the size of the spherulites changes.
function crowd(k3) { return exp((k3 < 0 ? 0.9 : 0.8) * k3); }

// move the stage on by ds LEDs
function travel(st, ds) {
  const k3 = cl(st.ks[2], -1, 1);
  const f = crowd(k3), rho = RHO / sqrt(f);
  const x = st.x, y = st.y, R = st.R, wc = st.wc;
  for (let i = 0; i < st.n; i++) { y[i] += ds; R[i] += rho * ds; }
  // a nucleus goes once its whole disc is below the panel
  for (let i = st.n - 1; i >= 0; i--) {
    if (y[i] - R[i] > H + 1) {
      const j = --st.n;
      if (i !== j) {
        x[i] = x[j]; y[i] = y[j]; R[i] = R[j]; st.g0[i] = st.g0[j]; st.pb[i] = st.pb[j]; st.bp[i] = st.bp[j]; st.sg[i] = st.sg[j]; st.sw[i] = st.sw[j];
        for (let q = 0; q < 4; q++) wc[i * 4 + q] = wc[j * 4 + q];
      }
    }
  }
  st.trav += ds;
  // nucleation: a Poisson process over the stage below the hot zone, thinned by the temperature profile,
  // and only where the sample is still melt
  const lam = N1 * f / (YB - YA) * COLD * (W + 2 * MX) * (H - YA);
  st.wait -= lam * ds;
  let guard = 0;
  while (st.wait <= 0 && guard++ < 200) {
    st.wait += -log(1 - rnd());
    const py = YA + rnd() * (H - YA), px = -MX + rnd() * (W + 2 * MX);
    if (rnd() * COLD > (py <= YB ? 1 : LATE + (COLD - LATE) * sstep(50, 100, py))) continue;
    if (st.n >= NMAX || reach(st, px, py) <= 0.5) continue;
    const i = st.n++;
    const p = st.ph, s = st.trav;
    x[i] = px; y[i] = py; R[i] = 0;
    // the film is thicker in some stretches of the sample than in others, and each spherulite has its own retardation
    const thick = 0.3 * sin(s / 61 + p[4]) + 0.22 * sin(s / 27.1 + p[5]);
    let g = cl(640 * exp(thick + 0.25 * (2 * rnd() - 1)), 300, 1280);
    // first-order red and violet are dim, so a spherulite that would land there takes the nearer bright side
    if (g > 430 && g < 610) g = g < 520 ? 430 : 610;
    st.g0[i] = g;
    st.pb[i] = (8 + 3 * rnd()) / (1 + 0.25 * k3);
    st.bp[i] = rnd();
    st.sg[i] = rnd() < 0.3 ? -1 : 1;
    // how far the twist pulls the retardation down inside each band, in nm
    st.sw[i] = 220 + 150 * rnd();
    // the rings are a little out of round, each spherulite its own way
    const wa = rnd() * TP, wb = rnd() * TP;
    wc[i * 4] = 0.11 * cos(wa); wc[i * 4 + 1] = 0.11 * sin(wa); wc[i * 4 + 2] = 0.07 * cos(wb); wc[i * 4 + 3] = 0.07 * sin(wb);
  }
}

function step(st, dt) {
  const k = st.k, ks = st.ks;
  const a = dt >= 1 ? 1 : 1 - exp(-dt / 0.25);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  const sp = cl(ks[1], 0.2, 3);
  // the polarizers turn on a clock of their own that the Speed knob only leans on
  st.ta += dt * (0.6 + 0.2 * sp);
  travel(st, US * sp * dt);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // run the stage for two panel heights and more, so the first frame is full from top to bottom
    for (let i = 0; i < 1400; i++) travel(st, 0.25);
  }
  if (dt > 0) step(st, dt);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const n = st.n, X = st.x, Y = st.y, RR = st.R, G0 = st.g0, PB = st.pb, BP = st.bp, SG = st.sg, SW = st.sw;
  const ks = st.ks, p = st.ph, ta = st.ta, WC = st.wc;
  const gp = cl(ks[0], 0, 1) * 800;
  const k4 = cl(ks[3], -1, 1);
  const depth = sstep(-1, -0.2, k4) * (0.45 + 0.55 * sstep(-0.2, 1, k4)), pscale = exp(-0.75 * k4);
  // the polarizer pair, and the plate with it, turns back and forth on three beats that share no period
  const alpha = p[0] + 0.62 * sin(0.113 * ta + p[1]) + 0.45 * sin(0.0473 * ta + p[2]) + 0.3 * sin(0.0211 * ta + p[3]);
  const ca = cos(2 * alpha), sa = sin(2 * alpha);
  const ip = min(NG - 1, (gp / GSTEP + 0.5) | 0) * 3;
  const cp0 = CT[ip], cp1 = CT[ip + 1], cp2 = CT[ip + 2];
  // the melt: what the plate alone lets through, held at a twelfth so that the hot zone stays a dark ground.
  // A dim orange would read as brown, so there it slides toward red.
  const GD = 0.085;
  const gr = 0.5 * (1 - cp0) * GD, gb = 0.5 * (1 - cp2) * GD;
  const gg = 0.5 * (1 - cp1) * GD * (1 - 0.65 * cl((gr - gb) / (gr + 1e-6), 0, 1));
  const tr = TONE[(gr * 1024) | 0], tg = TONE[(gg * 1024) | 0], tb = TONE[(gb * 1024) | 0];

  const ci = st.ci, o = 0;
  for (let by = 0; by < BH; by++) {
    for (let bx = 0; bx < BW; bx++) {
      // which nuclei can own or border a LED of this block: (distance - R) changes by at most half a diagonal
      // between the block's middle and any of its LEDs, so the owner and a neighbour within 1.7 LEDs of it
      // are among those within a whole diagonal and 1.7 of the smallest at the middle
      const cx = bx * BS + BS / 2, cy = by * BS + BS / 2;
      let mm = 1e9;
      for (let i = 0; i < n; i++) {
        const dy = cy - Y[i];
        if (abs(dy) - RR[i] >= mm) continue;
        const dx = cx - X[i];
        const v = sqrt(dx * dx + dy * dy) - RR[i];
        if (v < mm) mm = v;
      }
      let c = 0;
      if (mm < HD + 1) {
        const lim = mm + 2 * HD + 1.7;
        for (let i = 0; i < n && c < MAXC; i++) {
          const dx = cx - X[i], dy = cy - Y[i];
          const v = sqrt(dx * dx + dy * dy) - RR[i];
          if (v <= lim) ci[o + c++] = i;
        }
      }
      for (let y = by * BS; y < by * BS + BS; y++) {
        const py = y + 0.5;
        for (let x = bx * BS; x < bx * BS + BS; x++) {
          if (c === 0) { display.setPixel(x, y, tr, tg, tb); continue; }
          const px = x + 0.5;
          let m1 = 1e9, m2 = 1e9, i1 = -1, d1 = 0, dx1 = 0, dy1 = 0, d2 = 1, dx2 = 0, dy2 = 0;
          for (let q = 0; q < c; q++) {
            const i = ci[o + q];
            const dx = px - X[i], dy = py - Y[i];
            const d = sqrt(dx * dx + dy * dy), m = d - RR[i];
            if (m < m1) { m2 = m1; d2 = d1; dx2 = dx1; dy2 = dy1; m1 = m; i1 = i; d1 = d; dx1 = dx; dy1 = dy; }
            else if (m < m2) { m2 = m; d2 = d; dx2 = dx; dy2 = dy; }
          }
          if (m1 >= 0.5) { display.setPixel(x, y, tr, tg, tb); continue; }
          const cov = min(1, 0.5 - m1);
          const inv = 1 / (d1 + 1e-6), ux = dx1 * inv, uy = dy1 * inv;
          const c2t = ux * ux - uy * uy, s2t = 2 * ux * uy;
          const c2 = c2t * ca + s2t * sa, s2 = (s2t * ca - c2t * sa) * SG[i1];
          // the twist: retardation falls and comes back once every band
          const w4 = i1 * 4;
          const wob = WC[w4] * c2t + WC[w4 + 1] * s2t + WC[w4 + 2] * (c2t * c2t - s2t * s2t) + WC[w4 + 3] * 2 * c2t * s2t;
          const bs = sin(PI * (d1 / max(4.5, PB[i1] * pscale) + BP[i1] + wob));
          const G = max(40, G0[i1] - depth * SW[i1] * bs * bs);
          const ia = min(NG - 1, (abs(G - gp) / GSTEP + 0.5) | 0) * 3, ib = min(NG - 1, ((G + gp) / GSTEP + 0.5) | 0) * 3;
          // the sum above with the plate's own light set apart, so that it can be held as dim on the cross arms
          // as it is in the melt
          const s22 = s2 * s2, A = 0.25 * (s22 - s2), B = 0.25 * (s22 + s2), hc = c2 * c2;
          let r = hc * gr + A * (1 - CT[ia]) + B * (1 - CT[ib]);
          let g = hc * gg + A * (1 - CT[ia + 1]) + B * (1 - CT[ib + 1]);
          let bl = hc * gb + A * (1 - CT[ia + 2]) + B * (1 - CT[ib + 2]);
          if (r < 0) r = 0; if (g < 0) g = 0; if (bl < 0) bl = 0;
          // a young disc comes up from the ground, so a new nucleus is never a single lit LED
          let amp = sstep(0.6, 3.6, RR[i1]);
          // the seam: where the second disc has arrived as well
          if (m2 < 0.5) {
            const iv2 = 1 / (d2 + 1e-6), ex = ux - dx2 * iv2, ey = uy - dy2 * iv2;
            const el = max(0.35, sqrt(ex * ex + ey * ey));
            const sd = (m2 - m1) / el;
            if (sd < 1.1) amp *= 1 - 0.9 * (1 - sd / 1.1) * min(1, 0.5 - m2);
          }
          // the growth front: a pale rim on the last two LEDs, which fades once the front has gone by
          const rim = 0.5 * exp(m1 / 1.6) * amp;
          r = r * amp + rim * 0.7; g = g * amp + rim * 0.88; bl = bl * amp + rim;
          // orange that dims toward a cross arm would pass through brown; it goes by way of red
          const mx = r > g ? r : g;
          if (r > g && mx < 0.7 && bl < 0.5 * g) g *= 1 - 0.6 * (1 - mx / 0.7) * (1 - 2 * bl / g);
          r = gr + (r - gr) * cov; g = gg + (g - gg) * cov; bl = gb + (bl - gb) * cov;
          display.setPixel(x, y, TONE[cl(r, 0, 1) * 1024 | 0], TONE[cl(g, 0, 1) * 1024 | 0], TONE[cl(bl, 0, 1) * 1024 | 0]);
        }
      }
    }
  }
}
