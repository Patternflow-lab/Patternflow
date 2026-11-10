// ===== Patternflow pattern =====
// Title:   Braided River
// Family:  weather
// Idea:    The plan view of a braided gravel river runs down the panel: teal channels split round pale sand bars, scour and silt up, jump into new courses and rejoin, and the bars drift, so the braid plate is rebuilt by its own water and sediment and never settles or comes back.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Murray-Paola braided-stream model (A. Brad Murray and Chris Paola, 1994, Nature 371), a cellular model of a gravel braid plate: water routed over a bed to its three downstream cells by a power of the slope, bedload from discharge and slope by a nonlinear power law, bed change from the divergence of bedload, a sideways term and bank collapse (Murray and Paola 1997, Earth Surface Processes and Landforms, on its properties; the flume braids it was compared with are those of Leopold and Wolman 1957 and Ashmore 1982, 1991). Hillshade, Oklab (Bjorn Ottosson 2020). All names and years from memory, and the equations below are my reading of the model, not a copy of its paper.
// Round:   124
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Water=-1..1
//
// Knob 1: Hue. Turns the water round the wheel by the knob times 360 degrees, shallow to deep; the sand does not turn. At 0 the water runs from mint (126, 230, 195) in the shallows through teal (0, 156, 154) to deep blue-green (5, 71, 88) over wet sand (109, 82, 59) that dries to pale gravel (180, 170, 146) with a sun-lit side (234, 214, 194). At 0.25 it is lavender (179, 208, 253), violet (126, 124, 215) and plum (88, 30, 118), at 0.5 pink (253, 181, 215), rose (205, 99, 113) and burnt orange (177, 74, 30), at 0.75 amber (244, 198, 120), olive (161, 147, 14) and green (63, 105, 0). Between red and green the dark water is lifted so that it does not read as brown.
// Knob 2: Flow. The clock of the bed: 50 + 45 times Flow steps of the model a second, 72, 140 and 230 at 0.5, 2 and 4, each step about 1.1 to 1.3 of the model's time unit (the step is cut so that no cell's bed moves more than 0.03). The picture changes by 2.9, 5.3 and 7.7 of 255 in luma (mean over the panel) every half second, and by 18, 34 and 34 over ten seconds, at Flow 0.5 with the other knobs at their minimum, at 2 at the opening and at 4 with the other three at their maximum. The picture is the same at every Flow and only goes faster: the bed correlates at 0.77 with itself 5 s later at the opening, 0.55 after 10 s, 0.30 after 20 s and 0.16 after 40 s.
// Knob 3: Scale. How many LEDs a cell of the model covers: 1.0 at -1, 1.4 at 0 and 2.38 at 1, so the panel shows the whole 64 by 128 cell torus, a window 46 by 91 cells, and a window 27 by 54 cells of it, magnified and smoothed. The braid is the same braid; what changes is how many channels the 64 LEDs hold. A row crosses 9.0, 6.5 and 4.0 channels at -1, 0 and 1 (wet runs of the cover above one half, mean of rows and of 300 s; 7.6 to 9.8, 5.5 to 7.4 and 3.3 to 4.9 over time), each wet channel about 2.3 cells wide, which is 2.4, 3.2 and 5.4 LEDs.
// Knob 4: Water. The discharge of the river against the discharge that carries a bar, 0.5, 0.82 and 1.28 at -1, 0 and 1. It does two things. In the bed it multiplies the stream power in the bedload law, so a low river moves sediment only in its few strongest channels and a high one moves it nearly everywhere, which lowers the relief (rms 0.04 at 1.5 against 0.09 at 0.6), and from about 2 the bed flattens into a sheet and the braid dies (the reason the knob stops at 1.28). In the picture it is the stage: the same discharge covers more of the bed the higher the river stands, so Water is seen at once and the bed follows over a minute. The wet share of a row is 0.20 at -1, 0.32 at 0 and 0.56 at 1, with 5.0, 6.5 and 7.1 channels.

// What the field is. Two continuous fields on the panel's 64 by 128 torus (64 columns across the flow, 128 rows along it, lengths in cells,
// periodic both ways): the bed z, a height measured from a plane that drops s0 = 0.05 cell per row, and the water discharge Q in every
// column of cells, which averages 1. The plane is imposed, not solved: the real bed is z - s0 y, so the mean slope is s0 to the last digit
// and the domain can wrap along the flow, with the sediment that leaves the bottom row coming in again at the top. Each step:
//   1. Water. Row by row from the top, a cell passes its Q to the three cells below it in proportion to the square root of the drop to
//      each (the two diagonals are sqrt 2 away); a cell with no downhill neighbour sends all to the least uphill. Then 3 percent of the
//      row is renewed from a sheet of discharge 1 with half its size of noise, and the row is scaled to carry 64, as every row does. Row 0
//      is the last row of the step before: Q is a periodic solution, with no inlet. The renewal keeps the water coming as a sheet
//      so that one channel can never take all of it, and the noise is what births new channels.
//   2. Bedload. A cell moves bed material at e = emax p / (1 + p), p = u^2.5, u = qb Q Sbar / uc, where Sbar is the slope the water in
//      the cell actually takes (weighted by the water to each neighbour), qb is the Water knob, emax = 0.03 and uc = 0.0955. That is
//      the nonlinear power law of the model, with the exponent 2.5 and a saturation above it (below). The cell's e is shared out to its
//      three downstream cells in the proportions of its water, and taken from the cell: that sharing is the point (below).
//   3. Sideways. Between neighbours across the flow, bedload slides down the cross-stream slope at lam = 1 times the mean e of the two
//      cells, and a bank steeper than 0.12 per cell (2.4 times s0) gives way by a quarter of the excess each step, which is the bank
//      collapse at the angle of repose, in the units of a bed whose valley slope is 0.05 and not a real one.
//   4. The bed changes by the divergence of all that, times a step dt = min(0.03 / largest change, 0.8 / largest d e / d slope of a
//      cell, 6). All moves are in pairs (what one cell loses another gains) so the sum of z never changes.
//
// Why the bedload is shared out as the water is. This was the first thing to get wrong. With one flux per link, each of the three
// links carrying (q S)^m with its own water q and drop S, the bedload leans downhill across the flow more than the water does
// (the link flux goes as S^(m (1 + 1/2)) against the water's S^(1/2)), and that sideways bedload smooths the bed faster than
// the water's convergence builds it, for any m: beds of 0.003, 0.015 and 0.04 rms relief all decayed (to 0.0004, 0.002 and 0.005 in
// 2000 steps at m = 3), and one of 0.15 fell to 0.057 in 6000 steps at slope 0.1 and to 0.026 at 0.2. With the flux of the cell shared
// as its water is, the two are in ratio m, and the sheet is unstable for m above about 2.2 (a 96 by 192 prototype: relief rms 0.124
// fell to 0.081 in 750 steps at m = 2 and 0.087 to 0.043 at 1.5, held, 0.141 to 0.129, at 2.5, and a bed of 0.01 rms grew to 0.017
// in 2000 steps at 3). A bed that is nearly flat is not a stable state of this model once m is 2.5: it grows into channels by itself, the channels
// branch where the water splits round a high place, the high place grows by the deposit at the split, and avulsion follows from
// a channel that fills at its mouth. That is the braid of the model, and the picture is this.
//
// What keeps it a braid. Not a net: no disc, no restart. Three things, each found by losing the braid without it.
// 1. The saturation. With the bare power law the busiest cell, at Q 5 to 15 times the mean, moves a few hundred times the sediment of a
//    cell on a bar (Q^2.5), the step has to be cut to the busiest cell, and the bars barely move: the discharge field was still
//    correlated at 0.85 with itself 2000 steps on. e is capped at emax, so a channel carries a constant load and a bar a tenth of it.
// 2. The step. Past dt about 1.3 the bed of a busy channel rings with a period of two rows, a column of dots along the channel; the
//    step is limited by the cell where the flux grows fastest with slope (0.8 / d e / d slope); at steps of 2 to 4 the dots cover
//    every busy channel.
// 3. The water. A Water of 2 or more is a flat sheet (rms relief 0.013 after 8000 steps), and at 1.5 relief was 0.04 after 4000; at 1.28 it
//    never fell below 0.038 in 900 s at Scale 1, Flow 4 (0.038 to 0.065 rms). A Water below 0.5 is a river of a few strong channels that
//    stay for minutes: at 0.35 the 900 s run at Flow 0.5 gave recur 0.363 against the 0.40 line, and at 0.5 it gives 0.47 to 0.54, so
//    the knob stops at 0.5.
// The first 700 steps run before the first frame, 0.3 s in Node, from noise blurred over 2 cells across and 16 along the flow. The
// relief is 0.060 to 0.089 rms at the opening over 900 s, 0.068 to 0.105 at the minimum, 0.038 to 0.065 at the maximum.
//
// The picture. A cell's discharge makes the water: the stage is Q times the Water knob's share (qr), the wet cover is a smoothstep of
// that between 0.45 and 1.5, the depth is log(q / 0.7) / log 6.5 and the speed is the square root of the slope the water takes, so
// shallow fast water is mint and deep slow water blue-green, and the shallows are brighter. The bars are sand, from wet at the edge
// of the water to dry gravel on a bar's crown by a 5 by 5 blur of the cover and of the bed, shaded by a hillshade of the bed from
// the north-west, low. Six fields per cell are sampled bilinearly at each LED's place in the window, centred on the torus, so at
// Scale -1 one LED is one cell and at Scale 1 a window of 27 by 54 cells fills the panel with a margin of torus on every side;
// no wrap shows and no band stays still. A 17 by 17 table of water colours is rebuilt when Hue moves. All colours are Oklab, chroma
// 0.10 to 0.17 for water and 0.035 to 0.05 for sand, which the firmware's 1.62 saturation lifts.
//
// Checks. Each run on this file through the Lab's own update and draw (Node, a seeded Math.random).
// 1. Mass. The sum of z over the 8192 cells, kept in double precision from a start at zero: after 900 s at the opening it moved
//    by 7e-15 in a minute (a bed of 8192 cells with 0.07 rms relief), at the minimum 4e-15 and at the maximum 3e-15, which is the
//    rounding of the sums; each step's moves are in pairs and the sum of dz is zero to the last digit.
// 2. Mean slope. The mean over the bed of (s0 + z[y] - z[y+1]), the wrap row included, is 0.050000 at all three, the imposed
//    slope. The bedload-weighted slope along the water's path is 0.041 (0.0409, 0.0408 and 0.0411), 82 percent of the valley's; part of
//    that is the sqrt 2 of the diagonal links and the rest water running down flatter reaches. Every row of Q carries 64 to 2e-8.
// 3. Channels in a row (LED rows, wet runs of the cover above one half, 900 s sampled every 2 s, 32 rows): at the opening 6.5 on average,
//    5.5 to 7.4 as the mean of a sample and 3 to 9 in single rows (300 s); at every knob at its minimum 7.2 (6.4 to 8.4), at its maximum
//    4.5 (3.6 to 5.3); Scale alone 9.0 and 4.0, Water alone 5.0 and 7.1. The brief asked for 5 to 9 at the opening, and it is 6.5.
//    The lab flume range from memory is 2 to 6 for the number of active channels in a section (Ashmore 1991 and later); the panel is wider
//    in channel widths than a flume, 40 to 60 channel widths against 10 to 30, so the opening is a little over the top of that range and
//    the finest corner well over, while Scale 1 is inside it.
// 4. Bar motion at the opening (900 s). The bed's correlation with itself falls to 0.55 in 10 s and 0.16 in 40 s. The best match of the bed
//    after 20 s is 1.0 cell downstream and after 40 s 1.9 cells (a 300 s run on another seed gave 2.3 and 4.8), so bars migrate
//    downstream at 0.05 to 0.11 cells a second, 0.07 to 0.16 LED, and slowly against how fast the channels change: the nearest wet-run
//    centre one second on is 0.6 LED away on average, 1.2 after three seconds (high figures, since a channel that is born or dies counts
//    as a jump). A bar leaves its place by a channel spacing, about 10 LEDs at the opening, in some 40 s, and a random walk of such steps
//    carries one across the 64 LEDs in about 25 minutes. A rough figure. At every knob at its maximum the bed is new in 10 s (0.13), at the
//    minimum it holds 0.80 for 20 s.
// The flowcheck of this study. 240 s at the opening, every knob at its minimum and its maximum, and three random positions: recur 0.603
// to 0.703, dim 0.950 to 0.983, quiet 0.817 to 0.877, drift 0.0 to 0.6 percent; the last quarter dim 0.935 to 0.964, quiet 0.601 to
// 0.832. Seeds 1 to 4 at the minimum: recur 0.525 to 0.555, last-quarter quiet 0.662 to 0.764; at the maximum recur 0.583 to 0.636,
// last-quarter quiet 0.655 to 0.869. 900 s: opening recur 0.618, dim 0.976, quiet 0.915, last quarter 0.978 and 0.880, drift 0.0 percent;
// minimum 0.531, 0.964, 0.900, last quarter 0.927 and 0.794, drift 0.2; maximum 0.582, 0.988, 0.951, last quarter 0.982 and 0.853, drift 0.6.
// A frame is 3.1 ms in study.ts over the knob sweeps and 3.0 to 4.7 ms in the 900 s flowcheck runs (minimum 3.0, opening 3.8, maximum 4.7,
// with other jobs running), most of it the steps of the bed: 1.2, 2.3 and 4 to 8 steps a frame at Flow 0.5, 2 and 4.
//
// Not checked. A grid finer than the 64 by 128 of the panel, so how much of the channel width, one cell, is the lattice's. The lattice
// itself: the diagonal channels and the straightness down the flow come from three-neighbour routing. That the model's exponent 2.5, ratio
// of the two exponents and sideways term are the 1994 ones: they are mine, found to give a braid on this grid. The flume braid
// compared by eye and by channel count only, no bar wavelength. Any bank strength or vegetation. A bed run for more than 900 s.

const W = 64, H = 128;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The model lives on the panel's own torus: 64 columns across the flow, 128 rows along it, one cell to an LED at Scale -1.
const NX = 64, NY = 128, ST = NX + 2; // every array carries a halo column each side, so that the sweep never tests for a wrap
const NC = ST * NY;

const CFG = {
  s0: 0.05, // imposed mean slope: the bed drops 0.05 cell per row on average; z below is what is left after that is taken off
  emax: 0.03, // bedload a cell can pass on in one step when the stream is far above threshold
  uc: 0.0955, // discharge times slope at which the flux is half of emax. emax and uc are K = 10 of the power law
  eps: 0.03, // share of each row's water that is renewed from a sheet, so that channels are always being born
  noise: 0.5, // relative size of the noise on that sheet
  lam: 1, // lateral bedload: down the cross-stream slope, in proportion to the sediment moving
  rep: 0.12, // slope between neighbours across the flow at which a bank collapses (2.4 times s0)
  rrate: 0.25, // share of the excess slope that slides in a step
  dzmax: 0.03, // largest bed change per step; the step is scaled so that it is never exceeded
  stab: 0.8, // and the step times the fastest growth of flux with slope, per cell, stays under this: above about 0.5 the bed of a busy channel rings with a period of two rows
  gmax: 6,
  z0: 0.06, // rms of the first bed
  spin: 700, // steps before the first frame
};

function makeState(seed) {
  const S = {
    z: new Float64Array(NC), dz: new Float64Array(NC),
    Q: new Float32Array(NC), Q0: new Float32Array(ST), qsm: new Float32Array(NC), sbm: new Float32Array(NC),
    rs: (seed | 1) >>> 0, steps: 0, time: 0, dt: 1,
  };
  // first bed: noise blurred 2 cells across and 16 along the flow, so that it is already streaks
  const n = NX * NY, a = new Float64Array(n), b = new Float64Array(n);
  let rs = S.rs;
  for (let i = 0; i < n; i++) {
    rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
    a[i] = (rs >>> 0) / 4294967296 - 0.5;
  }
  S.rs = rs >>> 0;
  const blur = (src, dst, sx, sy) => {
    const kx = ceil(sx * 2), ky = ceil(sy * 2), wx = [], wy = [];
    for (let k = -kx; k <= kx; k++) wx.push(exp(-(k * k) / (2 * sx * sx)));
    for (let k = -ky; k <= ky; k++) wy.push(exp(-(k * k) / (2 * sy * sy)));
    const t = new Float64Array(n);
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        let acc = 0, w = 0;
        for (let k = -kx; k <= kx; k++) { acc += wx[k + kx] * src[y * NX + ((x + k + NX * 4) % NX)]; w += wx[k + kx]; }
        t[y * NX + x] = acc / w;
      }
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        let acc = 0, w = 0;
        for (let k = -ky; k <= ky; k++) { acc += wy[k + ky] * t[((y + k + NY * 4) % NY) * NX + x]; w += wy[k + ky]; }
        dst[y * NX + x] = acc / w;
      }
  };
  blur(a, b, 2, 16);
  let mean = 0, sd = 0;
  for (let i = 0; i < n; i++) mean += b[i];
  mean /= n;
  for (let i = 0; i < n; i++) sd += (b[i] - mean) * (b[i] - mean);
  sd = sqrt(sd / n);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) S.z[y * ST + x + 1] = ((b[y * NX + x] - mean) / sd) * CFG.z0;
  halo(S.z);
  S.Q.fill(1);
  S.Q0.fill(1);
  return S;
}

function halo(z) {
  for (let y = 0; y < NY; y++) {
    z[y * ST] = z[y * ST + NX];
    z[y * ST + NX + 1] = z[y * ST + 1];
  }
}

// One step of the bed. qb is the Water knob's number: the discharge of the whole river against the one that carries a bar.
function step(S, qb) {
  const { z, Q, dz, qsm, sbm, Q0 } = S;
  const SQ = Math.SQRT1_2, s0 = CFG.s0, emax = CFG.emax, eps = CFG.eps, qg = qb / CFG.uc;
  const noise = CFG.noise * 2 * eps, base = 1 - eps;
  let rs = S.rs, epmax = 0;
  dz.fill(0);
  for (let x = 0; x < ST; x++) Q[x] = Q0[x]; // row 0 is last step's row 127, routed on, renewed and renormalised
  Q0.fill(0);
  for (let y = 0; y < NY; y++) {
    const o = y * ST, wrapped = y === NY - 1, yn = wrapped ? 0 : y + 1, on = yn * ST;
    const tgt = wrapped ? Q0 : Q, to = wrapped ? 0 : on;
    if (!wrapped) for (let x = 0; x < ST; x++) Q[on + x] = 0;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, j = on + x;
      const zi = z[i] + s0, qi = Q[i];
      // water goes to the three cells below by the square root of the drop to each (the diagonals are sqrt 2 away)
      const sc = zi - z[j], sl = (zi - z[j - 1]) * SQ, sr = (zi - z[j + 1]) * SQ;
      let wc = sc > 0 ? sqrt(sc) : 0, wl = sl > 0 ? sqrt(sl) : 0, wr = sr > 0 ? sqrt(sr) : 0;
      let tot = wc + wl + wr;
      if (tot < 1e-9) {
        // a pit: all to the least uphill of the three
        if (sc >= sl && sc >= sr) wc = 1;
        else if (sl >= sr) wl = 1;
        else wr = 1;
        tot = 1;
      }
      const f = qi / tot;
      tgt[to + x - 1] += wl * f;
      tgt[to + x] += wc * f;
      tgt[to + x + 1] += wr * f;
      // bedload: one flux per cell from its discharge and the discharge-weighted slope, shared out as the water is
      const sb = (wl * sl + wc * sc + wr * sr) / tot;
      let e = 0;
      if (sb > 0) {
        const u = qi * qg * sb;
        const p = u * u * sqrt(u);
        e = (emax * p) / (1 + p);
        const ep = (2.5 * e) / (sb * (1 + p)); // how fast the flux grows with the slope, which sets how long a step may be
        if (ep > epmax) epmax = ep;
        const g = e / tot;
        dz[i] -= e;
        dz[j - 1] += g * wl;
        dz[j] += g * wc;
        dz[j + 1] += g * wr;
        sbm[i] = sb;
      } else sbm[i] = 0;
      qsm[i] = e;
    }
    // fold the halo, renew part of the row from the noisy sheet, and make the row carry what every row carries
    tgt[to + 1] += tgt[to + NX + 1];
    tgt[to + NX] += tgt[to];
    let s = 0;
    for (let x = 1; x <= NX; x++) {
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
      const v = base * tgt[to + x] + eps + noise * ((rs >>> 0) / 4294967296 - 0.5);
      tgt[to + x] = v;
      s += v;
    }
    const gn = NX / s;
    for (let x = 1; x <= NX; x++) tgt[to + x] *= gn;
    tgt[to] = tgt[to + NX];
    tgt[to + NX + 1] = tgt[to + 1];
  }
  S.rs = rs >>> 0;
  // sideways: bedload slides down the cross-stream slope in proportion to the sediment moving, and a bank steeper than rep collapses
  const lam = CFG.lam * 0.5, rep = CFG.rep, rr = CFG.rrate;
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, j = i + 1, sx = z[i] - z[j];
      let J = lam * (qsm[i] + qsm[j]) * sx;
      const a = sx < 0 ? -sx : sx;
      if (a > rep) J += rr * (a - rep) * (sx < 0 ? -1 : 1);
      dz[i] -= J;
      dz[j] += J;
    }
  }
  let mx = 0;
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    dz[o + 1] += dz[o + NX + 1];
    dz[o + NX] += dz[o];
    for (let x = 1; x <= NX; x++) {
      const a = dz[o + x], b = a < 0 ? -a : a;
      if (b > mx) mx = b;
    }
  }
  const dt = min(CFG.gmax, CFG.dzmax / (mx + 1e-12), CFG.stab / (epmax + 1e-9));
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    for (let x = 1; x <= NX; x++) z[o + x] += dz[o + x] * dt;
    z[o] = z[o + NX];
    z[o + NX + 1] = z[o + 1];
  }
  S.dt = dt;
  S.time += dt;
  S.steps++;
}

// ---- knobs ---------------------------------------------------------------------------------
const OPEN = [0, 2, 0, 0.06];
const scaleOf = (k) => 1.4 * pow(k < 0 ? 1.4 : 1.7, cl(k, -1, 1)); // LEDs to a cell: 1.0, 1.4, 2.38
const waterOf = (k) => 0.8 * pow(1.6, cl(k, -1, 1)); // 0.5, 0.8, 1.28
const STEPS_BASE = 50, STEPS_PER_FLOW = 45; // bed steps a second: 50 + 45 Flow

function start(params, k) {
  const S = makeState((Math.random() * 4294967296) >>> 0);
  params.s = S;
  params.sc = scaleOf(k[2]);
  params.qb = waterOf(k[3]);
  params.acc = 0;
  for (let i = 0; i < CFG.spin; i++) step(S, params.qb);
  params.hue = k[0];
  params.lutHue = -9;
  params.gridSc = -9;
}

export function setup(params) {
  start(params, OPEN);
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const ft = cl(dt || 0, 0, 0.1), f = 1 - exp(-ft / 0.5);
  params.sc += (scaleOf(k[2]) - params.sc) * f;
  params.qb += (waterOf(k[3]) - params.qb) * f;
  params.hue = k[0];
  params.acc += ft * (STEPS_BASE + STEPS_PER_FLOW * cl(k[1], 0.5, 4));
  let n = 0;
  while (params.acc >= 1 && n < 10) {
    step(params.s, params.qb);
    params.acc -= 1;
    n++;
  }
  if (params.acc > 4) params.acc = 4;
  // Never reached in the runs in the header. If the bed ever went bad, start over.
  if (!isFinite(params.s.z[(NY >> 1) * ST + (NX >> 1)] + params.s.Q[(NY >> 2) * ST + (NX >> 2)])) start(params, k);
  derive(params);
}

// ---- the picture ---------------------------------------------------------------------------
function okRgb(L, C, h, out) {
  const hr = (h * PI) / 180;
  for (let k = 1; k >= 0; k -= 0.05) {
    const a = C * k * cos(hr), b = C * k * sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if (k < 0.01 || (r > -0.002 && r < 1.002 && g > -0.002 && g < 1.002 && bb > -0.002 && bb < 1.002)) {
      out[0] = r;
      out[1] = g;
      out[2] = bb;
      return;
    }
  }
}
const enc = (v) => {
  v = cl(v, 0, 1);
  return ((v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055) * 255 + 0.5) | 0;
};
const RGB = [0, 0, 0];
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const NL = 17;
function buildLuts(P, hue) {
  if (!P.wl) {
    P.wl = new Uint8Array(NL * NL * 3);
    P.sl = new Uint8Array(NL * NL * 3);
    // the sand does not turn with the Hue knob
    for (let id = 0; id < NL; id++) {
      const dry = id / (NL - 1);
      for (let is = 0; is < NL; is++) {
        const sh = is / (NL - 1);
        let L = 0.46 + 0.28 * dry;
        L *= 0.8 + 0.4 * sh;
        okRgb(min(L, 0.92), 0.05 - 0.015 * dry, 62 + 25 * dry + (0.5 - sh) * 40, RGB);
        const o = (id * NL + is) * 3;
        P.sl[o] = enc(RGB[0]);
        P.sl[o + 1] = enc(RGB[1]);
        P.sl[o + 2] = enc(RGB[2]);
      }
    }
  }
  P.lutHue = hue;
  const hw = 205 + 360 * hue;
  for (let id = 0; id < NL; id++) {
    const d = id / (NL - 1); // 0 shallow, 1 deep
    for (let iv = 0; iv < NL; iv++) {
      const v = iv / (NL - 1);
      let L = 0.82 - 0.46 * d + 0.1 * v * (1 - 0.5 * d);
      const C = 0.1 + 0.04 * d + 0.03 * v;
      const h = hw - 32 + 50 * d - 10 * v;
      // between red and green a dark colour is brown on the panel: lift it
      L += max(0, 1 - abs((((h - 80) % 360) + 540) % 360 - 180) / 70) * max(0, 0.66 - L) * 1.3;
      okRgb(L, C, h, RGB);
      const o = (id * NL + iv) * 3;
      P.wl[o] = enc(RGB[0]);
      P.wl[o + 1] = enc(RGB[1]);
      P.wl[o + 2] = enc(RGB[2]);
    }
  }
}

// Per-cell picture fields, six to a cell: wet cover, depth, speed, hillshade, wide wetness, bar height.
const NF = 6;
function derive(P) {
  const S = P.s, z = S.z, Q = S.Q, sbm = S.sbm;
  // The bed only knows the discharge in proportion; the stage rises and falls with the real one, so Water shows at once.
  const qr = P.qb / 0.82;
  if (!P.F) {
    P.F = new Float32Array(NC * NF);
    P.A = new Float32Array(NC);
    P.B = new Float32Array(NC);
    P.Zb = new Float32Array(NC);
  }
  const F = P.F, A = P.A, B = P.B, Zb = P.Zb;
  for (let y = 0; y < NY; y++) {
    const o = y * ST, ou = (y > 0 ? y - 1 : NY - 1) * ST, od = (y < NY - 1 ? y + 1 : 0) * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, q = Q[i] * qr;
      A[i] = sm(0.45, 1.5, q);
      // light low in the north-west
      const gx = (z[i - 1] - z[i + 1]) * 0.5, gy = (z[ou + x] - z[od + x]) * 0.5;
      const sh = 0.5 + 0.5 * tanh((gx * 0.9 + gy * 0.4) * 34);
      const c = i * NF;
      F[c + 1] = cl(log(q / 0.7) / log(6.5), 0, 1);
      F[c + 2] = cl(sqrt(sbm[i] / CFG.s0) / 1.5, 0, 1);
      F[c + 3] = sh;
    }
    A[o] = A[o + NX];
    A[o + NX + 1] = A[o + 1];
  }
  // wide wetness and bar height: a 5 by 5 binomial of the cover and of the bed
  for (let y = 0; y < NY; y++) {
    const o = y * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x;
      B[i] = (A[i - 2 + (x < 2 ? NX : 0)] + 4 * A[i - 1] + 6 * A[i] + 4 * A[i + 1] + A[i + 2 - (x > NX - 2 ? NX : 0)]) * 0.0625;
      Zb[i] = (z[i - 2 + (x < 2 ? NX : 0)] + 4 * z[i - 1] + 6 * z[i] + 4 * z[i + 1] + z[i + 2 - (x > NX - 2 ? NX : 0)]) * 0.0625;
    }
  }
  for (let y = 0; y < NY; y++) {
    const o = y * ST, ou2 = ((y + NY - 2) % NY) * ST, ou = ((y + NY - 1) % NY) * ST, od = ((y + 1) % NY) * ST, od2 = ((y + 2) % NY) * ST;
    for (let x = 1; x <= NX; x++) {
      const i = o + x, c = i * NF;
      F[c] = A[i];
      F[c + 4] = (B[ou2 + x] + 4 * B[ou + x] + 6 * B[i] + 4 * B[od + x] + B[od2 + x]) * 0.0625;
      F[c + 5] = z[i] - (Zb[ou2 + x] + 4 * Zb[ou + x] + 6 * Zb[i] + 4 * Zb[od + x] + Zb[od2 + x]) * 0.0625;
    }
    for (let k = 0; k < NF; k++) {
      F[(o) * NF + k] = F[(o + NX) * NF + k];
      F[(o + NX + 1) * NF + k] = F[(o + 1) * NF + k];
    }
  }
}

function grid(P) {
  const sc = P.sc;
  P.gridSc = sc;
  if (!P.gx) {
    P.gx = new Int32Array(W); P.gfx = new Float32Array(W);
    P.gy = new Int32Array(H); P.gfy = new Float32Array(H);
  }
  for (let px = 0; px < W; px++) {
    const cx = 31.5 + (px - 31.5) / sc, i = floor(cx);
    P.gx[px] = i + 1; // +1 for the halo column
    P.gfx[px] = cx - i;
  }
  for (let py = 0; py < H; py++) {
    const cy = 63.5 + (py - 63.5) / sc, i = floor(cy);
    P.gy[py] = ((i % NY) + NY) % NY;
    P.gfy[py] = cy - i;
  }
}

export function draw(display, params) {
  const P = params;
  if (!P.s || !P.F) return;
  const hue = cl(P.hue, 0, 1);
  if (abs(P.lutHue - hue) > 0.001 || !P.wl) buildLuts(P, hue);
  if (abs(P.gridSc - P.sc) > 0.002) grid(P);
  const F = P.F, wl = P.wl, sl = P.sl;
  const out = [0, 0, 0, 0, 0, 0];
  for (let py = 0; py < H; py++) {
    const y0 = P.gy[py], y1 = y0 + 1 < NY ? y0 + 1 : 0, ty = P.gfy[py];
    const r0 = y0 * ST, r1 = y1 * ST;
    for (let px = 0; px < W; px++) {
      const x0 = P.gx[px], tx = P.gfx[px];
      const c00 = (r0 + x0) * NF, c10 = c00 + NF, c01 = (r1 + x0) * NF, c11 = c01 + NF;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      for (let k = 0; k < NF; k++) out[k] = F[c00 + k] * w00 + F[c10 + k] * w10 + F[c01 + k] * w01 + F[c11 + k] * w11;
      const a = out[0], td = out[1], v = out[2], sh = out[3], wd = out[4], hz = out[5];
      // water
      let fd = td * (NL - 1), fv = v * (NL - 1);
      let id = min(NL - 2, fd | 0), iv = min(NL - 2, fv | 0);
      let ad = fd - id, av = fv - iv;
      let o00 = (id * NL + iv) * 3, o10 = o00 + NL * 3;
      let q00 = (1 - ad) * (1 - av), q10 = ad * (1 - av), q01 = (1 - ad) * av, q11 = ad * av;
      const lit = 0.92 + 0.16 * (sh - 0.5) * (1 - td);
      const wr = (wl[o00] * q00 + wl[o10] * q10 + wl[o00 + 3] * q01 + wl[o10 + 3] * q11) * lit;
      const wg = (wl[o00 + 1] * q00 + wl[o10 + 1] * q10 + wl[o00 + 4] * q01 + wl[o10 + 4] * q11) * lit;
      const wb = (wl[o00 + 2] * q00 + wl[o10 + 2] * q10 + wl[o00 + 5] * q01 + wl[o10 + 5] * q11) * lit;
      // sand
      const dry = cl(1 - wd * 1.6 + hz * 3, 0, 1);
      fd = dry * (NL - 1);
      fv = sh * (NL - 1);
      id = min(NL - 2, fd | 0);
      iv = min(NL - 2, fv | 0);
      ad = fd - id;
      av = fv - iv;
      o00 = (id * NL + iv) * 3;
      o10 = o00 + NL * 3;
      q00 = (1 - ad) * (1 - av); q10 = ad * (1 - av); q01 = (1 - ad) * av; q11 = ad * av;
      const sr = sl[o00] * q00 + sl[o10] * q10 + sl[o00 + 3] * q01 + sl[o10 + 3] * q11;
      const sg = sl[o00 + 1] * q00 + sl[o10 + 1] * q10 + sl[o00 + 4] * q01 + sl[o10 + 4] * q11;
      const sb = sl[o00 + 2] * q00 + sl[o10 + 2] * q10 + sl[o00 + 5] * q01 + sl[o10 + 5] * q11;
      display.setPixel(px, py, (sr + (wr - sr) * a + 0.5) | 0, (sg + (wg - sg) * a + 0.5) | 0, (sb + (wb - sb) * a + 0.5) | 0);
    }
  }
}
