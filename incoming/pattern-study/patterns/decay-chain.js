// ===== Patternflow pattern =====
// Title:   Decay Chain
// Family:  nuclear
// Idea:    The three natural decay chains, uranium 238, uranium 235 and thorium 232, are drawn on a chart of the nuclides, protons across and neutrons up at 5 LEDs a cell, each as a crystal of its own age on a log clock, so that its cells light one after another down the chain, alpha steps amber and beta steps teal, and settle to one brightness at secular equilibrium above a white lead cell, while a radon leak or a chemical separation starves the cells below it and a new crystal lights a chain again from the top.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Harry Bateman, 1910, "Solution of a system of differential equations occurring in the theory of radioactive transformations" (Proceedings of the Cambridge Philosophical Society): the amount of each nuclide along a decay chain as a sum of exponentials, worked out here in closed form with the branches in and never stepped. The grid is a chart of the nuclides in the manner of Emilio Segrè's chart, protons against neutrons, turned so that Z runs across and N up and the chart stands on a portrait panel. Half-lives and branching shares are the standard values, rounded; branches under 0.1 percent are left out.
// Round:   220
// ===============================
// @matrix 64x128
// @knobs Hue=-0.08..0.08, Clock=0.12..6, Leak=0.25..1, Grains=0..0.12
//
// Knob 1: Hue. Turns the warm colour and the cool one together, and the slate with them. At the opening 0 the alpha cells are amber (hue 0.09, 32 degrees), the beta cells a sky teal (hue 0.55, 198 degrees) and the slate a dark blue (hue 0.60). At -0.08 they are a red orange (0.01) and a sea green teal (0.47) on a green slate; at 0.08 a yellow (0.17) and a blue (0.63) on a violet slate. The white lead cells stay white.
// Knob 2: Clock. The speed of the log clock in decades of age a second, 0.45 times the knob (0.9 at the opening 2, 0.054 at 0.12, 2.7 at 6), times a pace of 0.3 to 2 that is highest over empty stretches and lowest while cells change fast. At the opening a chain lights down its length in about 15 s and a settled chain rests 5 to 16 s; at 0.12 the lighting takes over 4 minutes, at 6 about 5 s. The slate drifts 0.3 times as fast at 0.12 and 2.4 times at 6.
// Knob 3: Leak. How tight the crystals are against radon, a gas that leaks out of rock. The share of radon that decays on into daughters is 10^-L, with L = 0.4 + 6.6 u, where u runs from 0 at the knob's 0.25 to 1 at its 1, times 1 for the uranium 238 chain, 0.85 for thorium 232 and 0.6 for uranium 235 (its radon lives 4 s). At the opening 0.25 uranium 238 keeps 40 percent of its radon before the crystal's own share, and the cells from radon down are 5 percent dimmer; at 1 it keeps one part in ten million and they are 90 percent dimmer, a dark tail under a lit head. A crystal adds up to 1.2 decades of its own and a leak event 1.2 to 3.4 more for a while. The knob also sets how often a resting chain is separated: 30 percent of the time at 0.25, 90 percent at 1, the rest a new crystal. Turning it restarts the chains from the amounts they hold, and the cells starve or come back down the chain over the next seconds.
// Knob 4: Grains. How many grains of different ages the crystal is averaged over, which softens the light. The log range of the brightness runs from 2.6 decades at 0 (a cell is black under 1/400 of the activity of a fresh parent, so only cells near equilibrium show) to 13 at 0.12 (nearly every cell glows, the dim ones faintly), and the spread of the grains' ages from none to 1.6 decades either way. At the opening 0.06 the range is 7.8 decades and the spread 0.8, so a front fades over about two cells.

// The panel is a chart of the nuclides turned to stand: 12 columns of proton number Z, from 81 (thallium) at the left to 92
// (uranium), by 24 rows of neutron number N, from 146 at the top to 123. A nuclide is a cell of 5 by 5 LEDs, the last row and
// column dark. The known nuclides of the window are very dim slate cells, brighter along the line of stability, and the three
// chains lie over them with their real half-lives and branches, 41 cells. An alpha decay is Z-2 and N-2, two cells down to the
// left, a beta-minus decay Z+1 and N-1, one cell down to the right. The chains have A = 4n+2, 4n+3 and 4n and a decay changes
// A by 4 or by 0, so no cell is in two of them. Pb-206, Pb-207 and Pb-208, where they end, are white. A link runs from each
// cell to its daughter in the colour of the decay, as bright as the decays leaving the parent and fading to the daughter's
// own brightness, so the light is seen to run down before the next cell has caught up.
// Each chain is one crystal with an age on a log clock. The amount of each nuclide at that age is Bateman's closed form, one
// exponential for each nuclide above it in the chain, worked out when an epoch starts; a branch feeds its daughter by its
// share (Bi-212 64 percent beta and 36 alpha, Ac-227 98.6 and 1.4). A cell's brightness is its activity, amount times decay
// rate, over that of a fresh parent, on a log scale of R decades. A young crystal has its parent lit and little else; as it ages
// the light comes down in steps, each long-lived nuclide (Th-230, Ra-226, Pa-231, Ac-227, Ra-228, Th-228) holding back the cells
// under it until the age is a few of its half-lives; at secular equilibrium every cell has the parent's brightness, less its
// branching share and less what a leak takes. Past 10^10 years the parent runs down and the chain dims together. The amounts
// agree to 12 digits with a 160 digit evaluation of the same sums.
// An epoch is the stretch since the last thing that happened to the crystal; its age L is the log of the seconds since. It
// starts at L = -3.6 to -2 for a new crystal and at -0.4 for a separation, which starts from the amounts the crystal holds at
// that moment: radon let out (a leak that lasts, then stops), radium taken out, or the parent's element taken out (uranium, or
// thorium for the thorium chain, every isotope of it in the chain, so U-234 goes with U-238). Cells below what was lost go on
// decaying and starve in the order of their half-lives, a dimming front down the chain; when radon is let back they return. An
// epoch ends when the picture has stopped changing, after a rest, or part of the way; a chain left to grow old goes on to 10^17.5
// s. A new crystal, or a separation that darkens the chain, waits while another chain is dark or while neither of the others
// is lit down its length, so that the panel is never an empty chart. The chains open at ages 10^12.2, 10^10.2 and 10^7.2 s.
// The sample is a crowd of grains, so a cell never averages quite flat: each wanders by about 0.08 of full brightness over 6 to 20 s. The slate
// drifts too, in hue, in level and in a mottling of 45 soft patches that each change over 8 to 30 s, and the lit colours a
// little, so that no two minutes are alike even when the chains rest.

const W = 64, H = 128, NPX = W * H;
const { floor, min, max, exp, sqrt, abs, pow, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const LN2 = Math.LN2;

// ---- the chart: protons Z across (81 to 92), neutrons N up (123 to 146), 5 LEDs a cell
const COLS = 12, ROWS = 24, Z0 = 81, N_TOP = 146, X0 = 2, Y0 = 4, PITCH = 5, NCELL = COLS * ROWS;
const cellAt = (z, n) => (N_TOP - n) * COLS + (z - Z0);
// the known nuclides in the window: for each Z from 81, the highest N that has been seen (all of them start at 123)
const KNOWN_TOP = [135, 138, 141, 143, 144, 145, 145, 146, 146, 146, 146, 146];
// the line of beta stability through the heavy end: Tl-205 at N 124, Pb-208 at 126, Ra-226 at 138, Th-232 at 142, U-238 at 146
const valleyN = (z) => 124 + 2 * (z - 81);
// Tl-205 and Bi-209, the stable ones outside the three chains
const STABLE_EXTRA = [[81, 124], [83, 126]];

// the slate behind the chart is mottled by a soft field that wanders: a coarse grid of knots, each drifting on its own
const MX = 5, MY = 9, MSX = 20, MSY = 19, MOX = -8, MOY = -16;

// ---- the three natural chains
const YR = 3.15576e7, DAY = 86400, HR = 3600, MIN = 60;
// [Z, N, half-life in s (0 is stable), [[daughter, share of the decays, 0 alpha or 1 beta-minus], ...]]
// A step is checked against the chart: alpha is Z-2 and N-2, beta-minus is Z+1 and N-1.
const CHAINS = [
  { // uranium 238, A = 4n + 2
    strip: 92, em: 1,
    nuc: [
      [92, 146, 4.468e9 * YR, [[1, 1, 0]]], // U-238
      [90, 144, 24.10 * DAY, [[2, 1, 1]]], // Th-234
      [91, 143, 1.159 * MIN, [[3, 1, 1]]], // Pa-234m
      [92, 142, 2.455e5 * YR, [[4, 1, 0]]], // U-234
      [90, 140, 7.538e4 * YR, [[5, 1, 0]]], // Th-230
      [88, 138, 1600 * YR, [[6, 1, 0]]], // Ra-226
      [86, 136, 3.8235 * DAY, [[7, 1, 0]]], // Rn-222
      [84, 134, 3.098 * MIN, [[8, 1, 0]]], // Po-218
      [82, 132, 26.8 * MIN, [[9, 1, 1]]], // Pb-214
      [83, 131, 19.9 * MIN, [[10, 1, 1]]], // Bi-214
      [84, 130, 164.3e-6, [[11, 1, 0]]], // Po-214
      [82, 128, 22.2 * YR, [[12, 1, 1]]], // Pb-210
      [83, 127, 5.012 * DAY, [[13, 1, 1]]], // Bi-210
      [84, 126, 138.376 * DAY, [[14, 1, 0]]], // Po-210
      [82, 124, 0, []], // Pb-206
    ],
  },
  { // uranium 235, A = 4n + 3
    strip: 92, em: 0.6,
    nuc: [
      [92, 143, 7.04e8 * YR, [[1, 1, 0]]], // U-235
      [90, 141, 25.52 * HR, [[2, 1, 1]]], // Th-231
      [91, 140, 3.276e4 * YR, [[3, 1, 0]]], // Pa-231
      [89, 138, 21.772 * YR, [[4, 0.9862, 1], [5, 0.0138, 0]]], // Ac-227
      [90, 137, 18.68 * DAY, [[6, 1, 0]]], // Th-227
      [87, 136, 22.0 * MIN, [[6, 1, 1]]], // Fr-223
      [88, 135, 11.43 * DAY, [[7, 1, 0]]], // Ra-223
      [86, 133, 3.96, [[8, 1, 0]]], // Rn-219
      [84, 131, 1.781e-3, [[9, 1, 0]]], // Po-215
      [82, 129, 36.1 * MIN, [[10, 1, 1]]], // Pb-211
      [83, 128, 2.14 * MIN, [[11, 0.9972, 0], [12, 0.0028, 1]]], // Bi-211
      [81, 126, 4.77 * MIN, [[13, 1, 1]]], // Tl-207
      [84, 127, 0.516, [[13, 1, 0]]], // Po-211
      [82, 125, 0, []], // Pb-207
    ],
  },
  { // thorium 232, A = 4n
    strip: 90, em: 0.85,
    nuc: [
      [90, 142, 1.405e10 * YR, [[1, 1, 0]]], // Th-232
      [88, 140, 5.75 * YR, [[2, 1, 1]]], // Ra-228
      [89, 139, 6.15 * HR, [[3, 1, 1]]], // Ac-228
      [90, 138, 1.9116 * YR, [[4, 1, 0]]], // Th-228
      [88, 136, 3.6319 * DAY, [[5, 1, 0]]], // Ra-224
      [86, 134, 55.6, [[6, 1, 0]]], // Rn-220
      [84, 132, 0.145, [[7, 1, 0]]], // Po-216
      [82, 130, 10.64 * HR, [[8, 1, 1]]], // Pb-212
      [83, 129, 60.55 * MIN, [[9, 0.6406, 1], [10, 0.3594, 0]]], // Bi-212
      [84, 128, 0.299e-6, [[11, 1, 0]]], // Po-212
      [81, 127, 3.053 * MIN, [[11, 1, 1]]], // Tl-208
      [82, 126, 0, []], // Pb-208
    ],
  },
];

// The brightness of a cell is its activity (amount times decay rate) against the activity of a fresh
// crystal's parent, on a log scale that runs RANGE decades down to black.
const RANGE = 6; // the range the pacing and the settling are judged at
const L_MAX = 17.5; // log10 of the largest age in seconds, 1e10 years
const GZ = [-1, -0.5, 0, 0.5, 1], GW = [0.12, 0.22, 0.32, 0.22, 0.12];
// what an epoch starts with: a new crystal, a radon leak opening or closing, radium or the parent's element taken out, or the
// leak knob moved
const BIRTH = 0, LEAK = 1, SEAL = 2, RA = 3, STRIP = 4, REBASE = 5;

function makeChain(def) {
  const rows = def.nuc, n = rows.length;
  const ch = {
    n, strip: def.strip, em: def.em,
    z: [], cell: [], lam: new Float64Array(n), stable: [], outs: [], into: [], rn: -1, tb: [],
    s: new Float64Array(n), Cm: new Float64Array(n * n), cc: new Float64Array(n * n * n),
    loss: new Float64Array(n), e: new Float64Array(n), tmp: new Float64Array(n), acc: new Float64Array(n),
    bt: new Float64Array(n), ba: new Float64Array(n), bb: new Float64Array(n), b: new Float64Array(n),
    L: 0, lc: 0, baseUsed: 0, cool: 0, Lset: 0, Lend: 0, Lstop: 0, full: true, f: 1, phase: 0, timer: 0, m: 1, ell: 0, evt: 0, kind: BIRTH,
  };
  for (let i = 0; i < n; i++) {
    const [z, nn, T, outs] = rows[i];
    ch.z.push(z);
    ch.cell.push(cellAt(z, nn));
    ch.lam[i] = T > 0 ? LN2 / T : 0;
    ch.stable.push(T === 0);
    ch.outs.push(outs);
    ch.into.push([]);
    if (z === 86) ch.rn = i;
  }
  for (let p = 0; p < n; p++) {
    let alpha = 0;
    for (const [to, share, mode] of ch.outs[p]) {
      ch.into[to].push([p, share * ch.lam[p]]);
      if (mode === 0) alpha += share;
    }
    // beta fraction of each of the four LED columns of the cell: a branching nuclide is two colours side by side
    const tb = [];
    for (let c = 0; c < 4; c++) tb.push(ch.stable[p] ? 0 : cl(c - alpha * 4 + 1, 0, 1));
    ch.tb.push(tb);
  }
  return ch;
}

// Bateman's solution for a chain with branches. For a start of one atom of nuclide j the amount of nuclide i is
// a sum of exponentials, one for each nuclide k between them: cc[j][i][k]. rate is the supply from a parent.
function compile(ch, ell) {
  const n = ch.n, loss = ch.loss, lam = ch.lam, cc = ch.cc;
  for (let i = 0; i < n; i++) loss[i] = lam[i];
  // a leak: the radon is lost at a rate of its own on top of its decay, so that only 10^-ell of it decays into daughters
  if (ell > 0 && ch.rn >= 0) loss[ch.rn] = lam[ch.rn] / pow(10, -ell);
  cc.fill(0);
  for (let j = 0; j < n; j++) {
    cc[(j * n + j) * n + j] = 1;
    for (let i = j + 1; i < n; i++) {
      let sum = 0;
      for (const [p, rate] of ch.into[i]) {
        if (p < j) continue;
        const base = (j * n + p) * n;
        for (let k = j; k <= p; k++) {
          const c = cc[base + k];
          if (c === 0) continue;
          const v = (rate * c) / (loss[i] - loss[k]);
          cc[(j * n + i) * n + k] += v;
          sum += v;
        }
      }
      cc[(j * n + i) * n + i] = -sum;
    }
  }
}

// The amounts at the start of an epoch folded into one coefficient per exponential.
function fold(ch) {
  const n = ch.n, s = ch.s, cc = ch.cc, Cm = ch.Cm;
  Cm.fill(0);
  for (let j = 0; j < n; j++) {
    const sj = s[j];
    if (sj === 0) continue;
    for (let i = j; i < n; i++) {
      const base = (j * n + i) * n;
      for (let k = j; k <= i; k++) Cm[i * n + k] += sj * cc[base + k];
    }
  }
}

function evalN(ch, tau, out) {
  const n = ch.n, loss = ch.loss, Cm = ch.Cm, e = ch.e;
  for (let k = 0; k < n; k++) e[k] = loss[k] === 0 ? 1 : exp(-loss[k] * tau);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const row = i * n;
    for (let k = 0; k <= i; k++) sum += Cm[row + k] * e[k];
    out[i] = sum;
  }
}

const bright = (a, R) => (a < 1e-30 ? 0 : cl(1 + Math.log10(a) / R, 0, 1));

// Brightness of every nuclide at log10 age L; sigma is the spread of the grains' ages, in decades.
function levels(ch, L, sigma, out, R) {
  const n = ch.n, acc = ch.acc, N = ch.tmp, lam = ch.lam, aref = lam[0];
  if (sigma < 0.03) evalN(ch, pow(10, L), acc);
  else {
    acc.fill(0);
    for (let g = 0; g < 5; g++) {
      evalN(ch, pow(10, min(L + sigma * GZ[g], 19)), N);
      for (let i = 0; i < n; i++) acc[i] += GW[g] * max(0, N[i]);
    }
  }
  for (let i = 0; i < n; i++) out[i] = bright(ch.stable[i] ? acc[i] : (lam[i] * acc[i]) / aref, R);
}

// Where the picture stops changing, judged with the parent's own slow decay taken out, and the oldest age worth
// drawing (the parent's activity down to 4 percent).
function settle(ch) {
  const n = ch.n, a = ch.ba, b = ch.bb;
  let Lend = L_MAX;
  const s0 = ch.s[0];
  if (s0 > 0.05) Lend = min(Lend, Math.log10(log(s0 / pow(10, -1.4)) / ch.lam[0]));
  ch.Lend = Lend;
  levels(ch, Lend, 0, a, RANGE);
  let L = Lend;
  for (; L > ch.L + 1; L -= 0.1) {
    levels(ch, L, 0, b, RANGE);
    const drift = b[0] - a[0];
    let d = 0;
    for (let i = 1; i < n; i++) if (!ch.stable[i]) d = max(d, abs(b[i] - a[i] - drift));
    if (d > 0.03) break;
  }
  ch.Lset = min(Lend, L + 0.4);
}

function startEpoch(S, ch, kind) {
  const n = ch.n;
  if (kind === BIRTH) {
    // a crystal has its own share of parent, up to two decades under a rich one, and its own tightness against radon
    ch.s.fill(0);
    ch.s[0] = pow(10, -2.1 * pow(rnd(), 1.2));
    ch.evt = 0;
    ch.lc = 1.2 * rnd();
    ch.L = -3.6 + 1.6 * rnd();
  } else {
    evalN(ch, pow(10, ch.L), ch.tmp);
    for (let i = 0; i < n; i++) ch.s[i] = max(0, ch.tmp[i]);
    ch.L = -0.4;
    if (kind === LEAK) ch.evt = 1.2 + 2.2 * rnd();
    else if (kind === SEAL) ch.evt = 0;
    else if (kind === RA || kind === STRIP) {
      const zr = kind === RA ? 88 : ch.strip;
      const keep = pow(10, -(3 + 6 * rnd()));
      for (let i = 0; i < n; i++) if (ch.z[i] === zr && !ch.stable[i]) ch.s[i] *= keep;
    }
  }
  ch.kind = kind;
  ch.baseUsed = S.base;
  ch.ell = ch.em * (S.base + ch.evt + ch.lc);
  compile(ch, ch.ell);
  fold(ch);
  settle(ch);
  ch.phase = 0;
  ch.m = 1;
  ch.f = exp(0.5 * (rnd() * 2 - 1));
  // some epochs are cut off by the next crystal or the next separation while the light is still on its way down
  ch.full = rnd() < 0.68;
  ch.Lstop = ch.full ? ch.Lset + S.sigma : max(ch.L + 4, ch.L + (ch.Lset - ch.L) * (0.6 + 0.3 * rnd()));
  // now and then the crystal is left to grow old, and the whole chain dims as its parent runs down
  if (ch.full && rnd() < 0.18) ch.Lstop = ch.Lend;
}

function chooseNext(S, ch) {
  if (ch.evt > 0) return rnd() < 0.8 ? SEAL : BIRTH;
  if (ch.kind === STRIP) return BIRTH;
  if (rnd() < 0.3 + 0.6 * S.u) {
    const r = rnd();
    return r < 0.4 ? LEAK : r < 0.72 ? RA : STRIP;
  }
  return BIRTH;
}

// ---- the picture
function geometry(S) {
  // cell colour factors of the known nuclides
  S.band = new Float32Array(NCELL);
  for (let z = Z0; z < Z0 + COLS; z++)
    for (let n = 123; n <= KNOWN_TOP[z - Z0]; n++) {
      const d = (n - valleyN(z)) / 7;
      S.band[cellAt(z, n)] = 0.35 + 0.65 * exp(-d * d);
    }
  for (const [z, n] of STABLE_EXTRA) S.band[cellAt(z, n)] = 1.9;
  // each pixel as a list of (cell, LED column in the cell, weight): a cell is 4x4 and its glow leaks into the 1 LED gap
  const gl = 0.1, gc = 0.03, cw = 0.86;
  const start = new Int32Array(NPX + 1), cellI = [], colI = [], wt = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const lx = x - X0, ly = y - Y0;
      if (lx >= 0 && ly >= 0 && lx < COLS * PITCH && ly < ROWS * PITCH) {
        const cx = floor(lx / PITCH), cy = floor(ly / PITCH), px = lx - cx * PITCH, py = ly - cy * PITCH;
        const add = (ax, ay, col, w) => {
          if (ax < 0 || ax >= COLS || ay < 0 || ay >= ROWS) return;
          cellI.push(ay * COLS + ax);
          colI.push(col);
          wt.push(w);
        };
        if (px < 4 && py < 4) {
          const corner = (px === 0 || px === 3) && (py === 0 || py === 3);
          add(cx, cy, px, corner ? cw : 1);
        } else if (px === 4 && py < 4) {
          add(cx, cy, 3, gl);
          add(cx + 1, cy, 0, gl);
        } else if (px < 4 && py === 4) {
          add(cx, cy, px, gl);
          add(cx, cy + 1, px, gl);
        } else {
          add(cx, cy, 3, gc);
          add(cx + 1, cy, 0, gc);
          add(cx, cy + 1, 3, gc);
          add(cx + 1, cy + 1, 0, gc);
        }
      }
      start[y * W + x + 1] = cellI.length;
    }
  S.pStart = start;
  S.pCell = Int32Array.from(cellI);
  S.pCol = Int32Array.from(colI);
  S.pW = Float32Array.from(wt);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - MOX) / MSX, v = (y + 0.5 - MOY) / MSY;
      const iu = min(MX - 2, floor(u)), iv = min(MY - 2, floor(v));
      const fu = cl(u - iu, 0, 1), fv = cl(v - iv, 0, 1);
      S.mp[y * W + x] = iv * MX + iu;
      S.mf[(y * W + x) * 2] = fu * fu * (3 - 2 * fu);
      S.mf[(y * W + x) * 2 + 1] = fv * fv * (3 - 2 * fv);
    }
  // diagonal links from a cell to its daughter: 2 LEDs thick for a whole decay, thinner for a branch
  S.links = [];
  const inChain = new Uint8Array(NCELL);
  for (const ch of S.chains) for (const c of ch.cell) inChain[c] = 1;
  for (let c = 0; c < S.chains.length; c++) {
    const ch = S.chains[c];
    for (let p = 0; p < ch.n; p++)
      for (const [to, share, mode] of ch.outs[p]) {
        const cp = ch.cell[p], cd = ch.cell[to];
        const x1 = X0 + PITCH * (cp % COLS) + 2, y1 = Y0 + PITCH * floor(cp / COLS) + 2;
        const x2 = X0 + PITCH * (cd % COLS) + 2, y2 = Y0 + PITCH * floor(cd / COLS) + 2;
        const hw = 0.4 + 0.5 * sqrt(share);
        const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
        const idx = [], cov = [], tt = [];
        for (let y = max(0, min(y1, y2) - 3); y <= min(H - 1, max(y1, y2) + 3); y++)
          for (let x = max(0, min(x1, x2) - 3); x <= min(W - 1, max(x1, x2) + 3); x++) {
            const t = cl(((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / len2, 0, 1);
            const ex = x1 + t * dx - (x + 0.5), ey = y1 + t * dy - (y + 0.5);
            let a = cl(hw + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
            if (a < 0.03) continue;
            // a link stays out of the cells it joins and only tints the other chains' cells it crosses
            const lx = x - X0, ly = y - Y0, cx = floor(lx / PITCH), cy = floor(ly / PITCH);
            if (lx >= 0 && ly >= 0 && lx - cx * PITCH < 4 && ly - cy * PITCH < 4) {
              const cell = cy * COLS + cx;
              if (cell === cp || cell === cd) continue;
              if (inChain[cell]) a *= 0.2;
            }
            idx.push(y * W + x);
            cov.push(a);
            tt.push(t);
          }
        S.links.push({
          c, p, to, mode, lshare: Math.log10(share),
          idx: Int32Array.from(idx), cov: Float32Array.from(cov), t: Float32Array.from(tt),
        });
      }
  }
}

export function setup(params) {
  const S = {
    ready: false, hue: 0, v0: 1, rate: 1, flow: 1, u: 0, base: 0.5, sigma: 0.7, R: 7, wander: 0.08,
    mp: new Int32Array(NPX), mf: new Float32Array(NPX * 2),
    chains: CHAINS.map(makeChain),
    cellCol: new Float32Array(NCELL * 4 * 3),
    L0: new Float32Array(NPX * 3), T2: new Float32Array(NPX * 3), T3: new Float32Array(NPX * 3),
    tone: [new Float32Array(3), new Float32Array(3), new Float32Array(3)], toneA: new Float32Array(3), toneB: new Float32Array(3), e0: new Float32Array(3), e1: new Float32Array(3), expo: 1, dhA: 0, dhB: 0,
  };
  // everything that drifts is a sum of three sines of unrelated periods: 5 for the colours and the level of the slate, one
  // for each patch of its mottling, one for each cell of the chains. Nothing in it has a period that the others divide.
  let off = 5 + MX * MY;
  for (const ch of S.chains) {
    ch.off = off;
    off += ch.n;
  }
  S.ph = new Float64Array(off * 3);
  S.om = new Float64Array(off * 3);
  S.pv = new Float32Array(off);
  for (let p = 0; p < off; p++) {
    const lo = p < 5 ? 20 : p < 5 + MX * MY ? 8 : 6, hi = p < 5 ? 60 : p < 5 + MX * MY ? 30 : 20;
    for (let j = 0; j < 3; j++) {
      S.ph[p * 3 + j] = rnd() * 6.2831853;
      S.om[p * 3 + j] = 6.2831853 / (lo * pow(hi / lo, rnd()));
    }
  }
  S.g = S.pv.subarray(0, 5);
  S.mk = S.pv.subarray(5, 5 + MX * MY);
  drift(S, 0);
  geometry(S);
  params.s = S;
}

function drift(S, d) {
  const ph = S.ph, om = S.om, pv = S.pv, f = d * S.flow;
  for (let p = 0; p < pv.length; p++) {
    let v = 0;
    for (let q = p * 3; q < p * 3 + 3; q++) {
      ph[q] += om[q] * f;
      v += Math.sin(ph[q]);
    }
    pv[p] = 0.8165 * v;
  }
}

function readKnobs(S, k) {
  S.hue = k[0];
  S.v0 = 0.45 * cl(k[1], 0.12, 6);
  S.rate = cl(k[1] / 2, 0.4, 2.5);
  S.flow = pow(cl(k[1] / 2, 0.2, 3), 0.8);
  S.u = cl((k[2] - 0.25) / 0.75, 0, 1);
  S.base = 0.4 + 6.6 * S.u;
  const u4 = cl(k[3] / 0.12, 0, 1);
  S.sigma = 1.6 * u4;
  S.R = 2.6 + 10.4 * u4;
}

function refresh(S, ch) {
  levels(ch, ch.L, S.sigma, ch.bt, S.R);
  for (let i = 0; i < ch.n; i++) ch.b[i] = ch.bt[i];
}

// the share of parent in a crystal, in decades under the richest
function rich(ch, g) {
  ch.s[0] = pow(10, -g);
  fold(ch);
  settle(ch);
}

function init(S) {
  const [u238, u235, th232] = S.chains;
  // three crystals of different ages, each with its light on the way down, so that the first frame is already a picture
  startEpoch(S, u238, BIRTH);
  u238.L = 12.2;
  u238.full = true;
  rich(u238, 0.5);
  startEpoch(S, u235, BIRTH);
  u235.L = 10.2;
  u235.full = false;
  u235.Lstop = u235.L + 3.6;
  rich(u235, 1.4);
  startEpoch(S, th232, BIRTH);
  th232.L = 7.2;
  th232.full = true;
  rich(th232, 0.9);
  for (const ch of S.chains) {
    ch.phase = 0;
    if (ch.full) ch.Lstop = ch.Lset + S.sigma;
    refresh(S, ch);
  }
  S.ready = true;
}

const lit = (ch) => {
  let sum = 0;
  for (let i = 0; i < ch.n; i++) if (!ch.stable[i]) sum += ch.b[i];
  return sum;
};

// The end of an epoch: a new crystal or a separation. One that leaves a chain dark waits while another chain is
// dark, or while neither of the other two is lit down its length, so that the panel is never an empty chart.
function leave(S, ch) {
  const next = chooseNext(S, ch);
  if ((next === BIRTH || next === STRIP || next === RA) && lit(ch) > 5) {
    let dark = 0, strong = 0;
    for (const o of S.chains) {
      if (o === ch) continue;
      const v = lit(o);
      if (v < 5) dark++;
      if (v > 9) strong++;
    }
    if (dark > 0 || strong < 1) {
      if (ch.full) {
        ch.phase = 1;
        ch.timer = 1.2;
      } else {
        ch.full = true;
        ch.Lstop = ch.Lset + S.sigma;
      }
      return;
    }
  }
  startEpoch(S, ch, next);
}

function stepChain(S, ch, d) {
  // turning the leak knob starts the chain over from the amounts it holds, with the new tightness
  ch.cool -= d;
  if (ch.cool <= 0 && abs(S.base - ch.baseUsed) > 0.5) {
    startEpoch(S, ch, REBASE);
    ch.cool = 1.5;
  }
  if (ch.phase === 0) {
    levels(ch, ch.L, 0, ch.ba, RANGE);
    levels(ch, ch.L + 0.1, 0, ch.bb, RANGE);
    let Bs = 0, Bm = 0;
    for (let i = 0; i < ch.n; i++) {
      if (ch.stable[i]) continue;
      const v = abs(ch.bb[i] - ch.ba[i]) / 0.1;
      Bs += v;
      if (v > Bm) Bm = v;
    }
    const mt = cl(0.5 / (max(Bm, Bs * 0.25) + 0.25), 0.3, 2);
    ch.m += (mt - ch.m) * (1 - exp(-d / 0.5));
    ch.L += S.v0 * ch.f * ch.m * d;
    if (ch.L >= ch.Lstop) {
      ch.L = ch.Lstop;
      if (ch.full) {
        ch.phase = 1;
        ch.timer = 5 + 11 * rnd();
      } else leave(S, ch);
    }
  } else {
    ch.timer -= d * S.rate;
    if (ch.timer <= 0) leave(S, ch);
  }
  levels(ch, ch.L, S.sigma, ch.bt, S.R);
  const up = 1 - exp(-d / 0.12), down = 1 - exp(-d / 0.5);
  for (let i = 0; i < ch.n; i++) {
    // a finite crowd of grains never averages quite flat: each cell wanders a little, over seconds
    const t = ch.bt[i], tw = t + S.wander * S.pv[ch.off + i] * sm(0.05, 0.4, t) * (ch.stable[i] ? 0.3 : 1);
    ch.b[i] += (cl(tw, 0, 1) - ch.b[i]) * (tw > ch.b[i] ? up : down);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.25, 0.06], d = cl(dt || 0, 0, 0.1);
  readKnobs(S, k);
  if (!S.ready) init(S);
  drift(S, d);
  let sweeping = 0;
  for (const ch of S.chains) {
    stepChain(S, ch, d);
    if (ch.phase === 0) sweeping++;
  }
  if (sweeping === 0) {
    // never let all three rest at once
    let pick = S.chains[0];
    for (const ch of S.chains) if (ch.timer > pick.timer) pick = ch;
    pick.timer = min(pick.timer, 0.3);
  }
}

// ---- drawing
function hsv(h, s, v, o) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = i % 6;
  o[0] = m === 0 ? v : m === 1 ? q : m === 2 ? p : m === 3 ? p : m === 4 ? t : v;
  o[1] = m === 0 ? t : m === 1 ? v : m === 2 ? v : m === 3 ? q : m === 4 ? p : p;
  o[2] = m === 0 ? p : m === 1 ? p : m === 2 ? t : m === 3 ? v : m === 4 ? v : q;
}

function boxBlur(src, dst, tmp, r) {
  // horizontal then vertical running sums, zero beyond the edges
  const inv = 1 / (2 * r + 1);
  for (let c = 0; c < 3; c++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      const row = y * W;
      for (let x = 0; x <= r && x < W; x++) acc += src[(row + x) * 3 + c];
      for (let x = 0; x < W; x++) {
        tmp[(row + x) * 3 + c] = acc * inv;
        const a = x + r + 1, b = x - r;
        if (a < W) acc += src[(row + a) * 3 + c];
        if (b >= 0) acc -= src[(row + b) * 3 + c];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = 0; y <= r && y < H; y++) acc += tmp[(y * W + x) * 3 + c];
      for (let y = 0; y < H; y++) {
        dst[(y * W + x) * 3 + c] = acc * inv;
        const a = y + r + 1, b = y - r;
        if (a < H) acc += tmp[(a * W + x) * 3 + c];
        if (b >= 0) acc -= tmp[(b * W + x) * 3 + c];
      }
    }
  }
}

// A lit thing of one mode (0 alpha, 1 beta-minus) at intensity I, into o as 0..255. The dim end of the warm one
// is shifted toward a red ember and the cool one toward blue, so that dim never turns into brown or grey.
function litColor(S, mode, I, o) {
  I = min(1, I * S.expo);
  if (mode === 0) hsv(0.09 + S.hue + S.dhA - 0.035 * (1 - I), 0.96 - 0.1 * I, 255 * I, o);
  else hsv(0.55 + S.hue + S.dhB + 0.03 * (1 - I), 0.8 - 0.14 * I, 255 * I, o);
  const hl = 16 * I * I * I * I;
  o[0] += hl;
  o[1] += hl;
  o[2] += hl;
}
const ramp = (b) => 0.28 + 0.72 * pow(b, 1.1);
const lead = (b) => 0.72 + 0.28 * b;

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hue = S.hue;
  const gC = S.tone[2], cA = S.tone[0], cB = S.tone[1];
  const gl = exp(0.15 * S.g[1]);
  // the lit colours and the slate each wander a little around the colours the knob gives
  S.expo = exp(0.08 * S.g[2]);
  S.dhA = 0.007 * S.g[3];
  S.dhB = 0.015 * S.g[4];
  hsv(0.6 + hue + 0.02 * S.g[0], 0.6, 1, gC);
  const mk = S.mk, mp = S.mp, mf = S.mf;
  const mAt = (p) => {
    const k = mp[p], fu = mf[p * 2], fv = mf[p * 2 + 1];
    return mix(mix(mk[k], mk[k + 1], fu), mix(mk[k + MX], mk[k + MX + 1], fu), fv);
  };
  const cA0 = S.toneA, cB0 = S.toneB;
  hsv(0.09 + hue, 0.9, 255, cA0);
  hsv(0.55 + hue, 0.75, 255, cB0);
  const cellCol = S.cellCol, band = S.band;
  // the known nuclides, very dim
  for (let c = 0; c < NCELL; c++) {
    const v = band[c] * 34 * gl * max(0.3, 1 + 0.65 * mAt((Y0 + PITCH * floor(c / COLS) + 2) * W + X0 + PITCH * (c % COLS) + 2));
    for (let px = 0; px < 4; px++) {
      const o = (c * 4 + px) * 3;
      cellCol[o] = gC[0] * v;
      cellCol[o + 1] = gC[1] * v;
      cellCol[o + 2] = gC[2] * v;
    }
  }
  for (const ch of S.chains) {
    for (let i = 0; i < ch.n; i++) {
      const b = ch.b[i], c = ch.cell[i];
      if (ch.stable[i]) {
        const I = lead(b);
        for (let px = 0; px < 4; px++) {
          const o = (c * 4 + px) * 3;
          cellCol[o] = 232 * I;
          cellCol[o + 1] = 238 * I;
          cellCol[o + 2] = 255 * I;
        }
        continue;
      }
      const I = ramp(b), w = cl((b - 0.02) / 0.28, 0, 1), k = w * w * (3 - 2 * w);
      litColor(S, 0, I, cA);
      litColor(S, 1, I, cB);
      for (let px = 0; px < 4; px++) {
        const t = ch.tb[i][px], o = (c * 4 + px) * 3;
        cellCol[o] = mix(gC[0] * 62, mix(cA[0], cB[0], t), k);
        cellCol[o + 1] = mix(gC[1] * 62, mix(cA[1], cB[1], t), k);
        cellCol[o + 2] = mix(gC[2] * 62, mix(cA[2], cB[2], t), k);
      }
    }
  }
  // pixels from cells
  const L0 = S.L0, pStart = S.pStart, pCell = S.pCell, pCol = S.pCol, pW = S.pW;
  for (let p = 0; p < NPX; p++) {
    let r = 0, g = 0, b = 0;
    for (let q = pStart[p]; q < pStart[p + 1]; q++) {
      const o = (pCell[q] * 4 + pCol[q]) * 3, w = pW[q];
      r += cellCol[o] * w;
      g += cellCol[o + 1] * w;
      b += cellCol[o + 2] * w;
    }
    L0[p * 3] = r;
    L0[p * 3 + 1] = g;
    L0[p * 3 + 2] = b;
  }
  // links, laid over a pixel where they are brighter than what is there; e0 and e1 are the colours at the two ends
  const e0 = S.e0, e1 = S.e1;
  for (const lk of S.links) {
    const ch = S.chains[lk.c];
    const bp = cl(ch.b[lk.p] + lk.lshare / S.R, 0, 1);
    const bd = ch.stable[lk.to] ? bp : ch.b[lk.to];
    const kp = cl((bp - 0.02) / 0.28, 0, 1), kd = cl((bd - 0.02) / 0.28, 0, 1);
    litColor(S, lk.mode, 0.72 * ramp(bp), e0);
    litColor(S, lk.mode, 0.72 * ramp(bd), e1);
    const sk0 = gC[0] * 92, sk1 = gC[1] * 92, sk2 = gC[2] * 92;
    for (let q = 0; q < lk.idx.length; q++) {
      const t = lk.t[q], o = lk.idx[q] * 3, a = lk.cov[q];
      const k = mix(kp * kp * (3 - 2 * kp), kd * kd * (3 - 2 * kd), t);
      const r = mix(sk0, mix(e0[0], e1[0], t), k), g = mix(sk1, mix(e0[1], e1[1], t), k), b = mix(sk2, mix(e0[2], e1[2], t), k);
      if (r * 77 + g * 150 + b * 29 > (L0[o] * 77 + L0[o + 1] * 150 + L0[o + 2] * 29) * 0.9) {
        L0[o] += (r - L0[o]) * a;
        L0[o + 1] += (g - L0[o + 1]) * a;
        L0[o + 2] += (b - L0[o + 2]) * a;
      }
    }
  }
  // the light of the whole sample, a faint wash over the slate: warm for the alpha cells, cool for the beta ones
  let sa = 0, sb = 0;
  for (const ch of S.chains)
    for (let i = 0; i < ch.n; i++) {
      if (ch.stable[i]) continue;
      if (ch.tb[i][1] < 0.5) sa += ch.b[i];
      else sb += ch.b[i];
    }
  const wa = 0.0014 * sa, wb = 0.0014 * sb;
  const amR = wa * cA0[0] + wb * cB0[0], amG = wa * cA0[1] + wb * cB0[1], amB = wa * cA0[2] + wb * cB0[2];
  // a soft bloom, a box blur of 9 LEDs run twice
  boxBlur(L0, S.T2, S.T3, 4);
  boxBlur(S.T2, S.T2, S.T3, 4);
  for (let y = 0; y < H; y++) {
    const gy0 = (0.055 + 0.02 * (y / H)) * 255 * gl;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, gv = gy0 * max(0.15, 1 + 0.65 * mAt(y * W + x));
      const r = amR + gC[0] * gv + L0[o] + 0.42 * S.T2[o];
      const g = amG + gC[1] * gv + L0[o + 1] + 0.42 * S.T2[o + 1];
      const b = amB + gC[2] * gv + L0[o + 2] + 0.42 * S.T2[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r, g > 255 ? 255 : g, b > 255 ? 255 : b);
    }
  }
}
