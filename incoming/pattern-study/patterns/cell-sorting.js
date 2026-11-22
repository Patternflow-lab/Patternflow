// ===== Patternflow pattern =====
// Title:   Cell Sorting
// Family:  adhesion
// Idea:    A cellular Potts model of 112 cells of three kinds that stick to their own kind harder than to the others, so a confetti of cells crawls apart into clumps wrapped in shells, while the cells' own crawling and the odd cell changing kind keep tearing the clumps up for them to form again.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: differential adhesion hypothesis (Malcolm Steinberg, 1963), sorting of dissociated amphibian germ layers (Philip Townes and Johannes Holtfreter, 1955), cellular Potts model (Francois Graner and James Glazier, 1992), pattern round 222
// Round:   222
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Temperature=0.5..3, Adhesion=-1..1, Stir=-1..1
//
// Knob 1: Hue. Turns the three kinds of cell round the colour wheel together, 0 to 1 once round. At 0 the core kind is teal (0.5 turn), the shell kind violet (0.8) and the outer kind amber (0.115), each about a third of the wheel from the next.
// Knob 2: Temperature. The T of the Metropolis rule, 3 at 0.5 and 70 at 3 on a log scale, 20 at the opening 2. Low, a cell keeps a hard outline and only shivers at the edge; high, the membranes boil, cells swap neighbours fast and a whole clump slides across the panel in seconds, though every cell stays in one piece.
// Knob 3: Adhesion. How much unlike kinds dislike touching. The cost of a contact between two cells of one kind is 12 at every setting; between unlike kinds it is 12 plus 20 times the contrast times the square of the gap in stickiness (teal 1, violet 0.5, amber 0). At -1 the contrast is 0 and the kinds stay mixed. At 0 (contrast 1) a teal and an amber cell cost 32 and either costs 17 against a violet one, so teal clumps wrap in violet. At 1 the contrast is 1.8, and the clumps are bigger, rounder and slower to tear.
// Knob 4: Stir. The remix. Each cell crawls along a heading that wanders (0.3 rad squared a second); the pull on it is 0.6 energy units a LED at -1, 1.25 at the opening and 2.4 at 1, and a cell is made to change kind 0.1 times a second at -1, 0.6 at the opening and 3 at 1 (it fades to its new colour over 0.8 s and has to find its way to the clump of that kind).

// The panel is the lattice: 64 x 128 sites, one per LED, wrapped on both axes so that nothing piles up at an edge, each site
// holding the number of the cell it belongs to. The 112 cells start as a staggered grid of 8 x 14 seeds (a site goes to the
// nearest), each seed nudged by up to 1.2 LEDs, each cell with a target area of 73 LEDs give or take 15 percent.
// The cells then evolve by the Metropolis rule of the Potts model. A random site t and one of its four neighbours s are picked;
// the cell of s tries to take t over from the cell of t, and the copy is made with probability exp(-dH/T), or always when
// dH < 0, where H is
//   the contact energy: every pair of sites within 2 LEDs (20 neighbours, which keeps the cells round) that belong to
//     different cells counts J(kind, kind),
//   plus 3 times the square of each cell's area minus its target,
//   minus the crawling term, below.
// A copy is also refused if the cell it takes from would be left in two pieces (a table of the 256 ways the ring of eight
// sites round t can be taken) or would shrink under 36 LEDs. A sweep is 8192 such tries; the panel runs 360 sweeps a second.
// The first 1500 sweeps are run at the first update, with the knobs where they are, so the picture opens already sorted.
// Two things are not in the cellular Potts model of Graner and Glazier. Each cell crawls: it has a heading that turns by
// diffusion, and a copy that moves the cell's centre of mass along its heading costs less, by Stir. And a cell is now and
// then made to change kind, so that the order does not settle. The adhesion energies (12, 20 and the stickiness of 1, 0.5
// and 0) were chosen by eye. The stickiness is such that the tension between two kinds goes with the square of the gap,
// which is what lets a middle kind wet the other two and gives a core, a shell and an outer, as in Steinberg's nesting.
// Drawing: a site is on a membrane when its right or lower neighbour is another cell. A two pass chamfer gives each site its distance to the nearest membrane, and the
// colour goes from dark and saturated at the membrane to light and softer 2.25 LEDs in. Each cell has a brightness of its own,
// within 7 percent, and the shown colour follows the model with a time constant of 0.09 s, which softens the one-LED
// flicker of the membranes without smearing a crawling cell.

const W = 64, H = 128, N = W * H;
const CX = 8, CY = 14, NC = CX * CY; // seeds across and down, one cell each
const KN = 20; // sites that feel a contact: 4 + 4 + 4 + 8 round a site
const MCS_RATE = 360; // sweeps of the whole lattice a second
const PRERUN = 1500; // sweeps before the first frame
const { floor, exp, cos, PI, min, sqrt, log } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Offsets round a site. The first eight run once round the ring, so that a mask of them can be looked up.
const OFF = [
  [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0],
  [2, 0], [0, 2], [-2, 0], [0, -2],
  [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1],
];

// For each way the ring can belong to a cell: do the ring sites left once the middle is taken still hang together?
const CONN = new Uint8Array(256);
for (let m = 0; m < 256; m++) {
  const seen = new Uint8Array(8);
  let comps = 0;
  for (let i = 0; i < 8; i++) {
    if (!((m >> i) & 1) || seen[i]) continue;
    comps++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const a = stack.pop();
      for (let j = 0; j < 8; j++) {
        if (!((m >> j) & 1) || seen[j]) continue;
        if (Math.abs(OFF[a][0] - OFF[j][0]) + Math.abs(OFF[a][1] - OFF[j][1]) === 1) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  CONN[m] = comps <= 1 ? 1 : 0;
}

// Kind 0 is the core, 1 the shell, 2 the outer. A larger stickiness is a stickier kind.
const STICK = [1, 0.5, 0];
const BASE_HUE = [0.5, 0.8, 0.115];
const JM = 12; // contact energy of two cells of one kind, which sets how stiff a membrane is
const JG = 40; // unlike kinds cost JM + JG / 2 * contrast * gap^2
const TLO = 3; // the lowest and the highest T on Temperature
const THI = 70;
const LAMBDA = 3; // stiffness of the area constraint
const AMIN = 36; // a cell is not let shrink below this many LEDs
const DR = 0.3; // how fast a cell's heading wanders, rad^2 / s
const FADE = 0.8; // seconds a cell takes to turn to its new colour

function rng(S) {
  let x = S.seed;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  S.seed = x;
  return (x >>> 0) / 4294967296;
}

function gauss(S) {
  return sqrt(-2 * log(rng(S) + 1e-12)) * cos(2 * PI * rng(S));
}

export function setup(params) {
  const S = {
    ready: false, seed: 0x9e3779b9 | 0,
    lat: new Uint16Array(N), tl: new Uint8Array(N), area: new Int32Array(NC), tgt: new Float32Array(NC),
    ty: new Uint8Array(NC), ty0: new Uint8Array(NC), fade: new Float32Array(NC).fill(1), gain: new Float32Array(NC),
    nbr: new Uint16Array(N * KN),
    cmx: new Float32Array(NC), cmy: new Float32Array(NC), ang: new Float32Array(NC), ux: new Float32Array(NC), uy: new Float32Array(NC),
    J: new Float32Array(9), T: 20, mu: 1, acc: 0, swAcc: 0, swRate: 0.5,
    dist: new Int16Array(N), mem: new Uint8Array(N),
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), snap: true,
    lut: new Float32Array(3 * 16 * 3), lutHue: -9, hue: 0, dt: 0.033,
  };
  // The neighbour table, wrapped on both axes.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let k = 0; k < KN; k++) {
        S.nbr[(y * W + x) * KN + k] = ((y + OFF[k][1] + H) % H) * W + ((x + OFF[k][0] + W) % W);
      }
    }
  }
  // Seeds on a staggered grid, each nudged a little; a site belongs to the nearest.
  const sx = [], sy = [];
  for (let j = 0; j < CY; j++) {
    for (let i = 0; i < CX; i++) {
      sx.push(((i + 0.5 + (j & 1) * 0.5) * W) / CX + (rng(S) - 0.5) * 2.4);
      sy.push(((j + 0.5) * H) / CY + (rng(S) - 0.5) * 2.4);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = 1e9, bi = 0;
      for (let c = 0; c < NC; c++) {
        let dx = Math.abs(x - sx[c]), dy = Math.abs(y - sy[c]);
        if (dx > W / 2) dx = W - dx;
        if (dy > H / 2) dy = H - dy;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bi = c;
        }
      }
      S.lat[y * W + x] = bi;
      S.area[bi]++;
    }
  }
  // Target areas differ by 15 percent either way and add up to the lattice.
  let sum = 0;
  for (let c = 0; c < NC; c++) {
    S.tgt[c] = 1 + (rng(S) - 0.5) * 0.3;
    sum += S.tgt[c];
  }
  for (let c = 0; c < NC; c++) {
    S.tgt[c] *= N / sum;
    S.ty[c] = floor(rng(S) * 3) % 3;
    S.ty0[c] = S.ty[c];
    S.gain[c] = 0.93 + 0.14 * rng(S);
  }
  for (let i = 0; i < N; i++) S.tl[i] = S.ty[S.lat[i]];
  // Centres of mass, found round the seed so that a cell across the seam is not torn in two.
  const sxs = new Float64Array(NC), sys = new Float64Array(NC);
  for (let i = 0; i < N; i++) {
    const c = S.lat[i];
    let dx = (i & 63) - sx[c], dy = (i >> 6) - sy[c];
    dx -= W * Math.round(dx / W);
    dy -= H * Math.round(dy / H);
    sxs[c] += dx;
    sys[c] += dy;
  }
  for (let c = 0; c < NC; c++) {
    S.cmx[c] = (((sx[c] + sxs[c] / S.area[c]) % W) + W) % W;
    S.cmy[c] = (((sy[c] + sys[c] / S.area[c]) % H) + H) % H;
    S.ang[c] = rng(S) * 2 * PI;
    S.ux[c] = cos(S.ang[c]);
    S.uy[c] = Math.sin(S.ang[c]);
  }
  params.s = S;
}

// Contact energy between two kinds at contrast c.
function setJ(S, c) {
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) S.J[a * 3 + b] = JM + (JG * c * (STICK[a] - STICK[b]) * (STICK[a] - STICK[b])) / 2;
  }
}

// The Metropolis sweeps. The cell of a neighbour s tries to take over site t.
function sweeps(S, count) {
  const lat = S.lat, tl = S.tl, nbr = S.nbr, ty = S.ty, area = S.area, tgt = S.tgt, J = S.J;
  const lam2 = 2 * LAMBDA, iT = 1 / S.T, cut = 14 * S.T;
  const cmx = S.cmx, cmy = S.cmy, ux = S.ux, uy = S.uy, mu = S.mu;
  let rs = S.seed | 0;
  const total = count * N;
  for (let a = 0; a < total; a++) {
    rs ^= rs << 13;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    const t = (rs >>> 4) & (N - 1);
    const k = ((rs >>> 20) & 3) * 2 + 1;
    const b = t * KN;
    const st = lat[t], ss = lat[nbr[b + k]];
    if (st === ss) continue;
    // Contact energy of t, after the copy less before.
    const tt = ty[st] * 3, ts = ty[ss] * 3;
    let dh = 0;
    for (let j = 0; j < KN; j++) {
      const n = nbr[b + j], id = lat[n], tj = tl[n];
      if (id !== st) dh -= J[tt + tj];
      if (id !== ss) dh += J[ts + tj];
    }
    // Area: the taker grows by one, the loser shrinks by one.
    dh += lam2 * (area[ss] - tgt[ss] - area[st] + tgt[st] + 1);
    // Crawling: the move of each centre of mass, along that cell's heading.
    const tx = t & 63, ty2 = t >> 6;
    let dxs = tx - cmx[ss], dys = ty2 - cmy[ss], dxt = tx - cmx[st], dyt = ty2 - cmy[st];
    if (dxs > 32) dxs -= W;
    else if (dxs < -32) dxs += W;
    if (dys > 64) dys -= H;
    else if (dys < -64) dys += H;
    if (dxt > 32) dxt -= W;
    else if (dxt < -32) dxt += W;
    if (dyt > 64) dyt -= H;
    else if (dyt < -64) dyt += H;
    dh -= mu * (ux[ss] * dxs + uy[ss] * dys - ux[st] * dxt - uy[st] * dyt);
    if (dh > 0) {
      if (dh > cut) continue;
      rs ^= rs << 13;
      rs ^= rs >>> 17;
      rs ^= rs << 5;
      if ((rs >>> 0) / 4294967296 >= exp(-dh * iT)) continue;
    }
    if (area[st] <= AMIN) continue;
    let mask = 0;
    for (let r = 0; r < 8; r++) if (lat[nbr[b + r]] === st) mask |= 1 << r;
    if (!CONN[mask]) continue;
    lat[t] = ss;
    tl[t] = ty[ss];
    let nx = cmx[ss] + dxs / (area[ss] + 1), ny = cmy[ss] + dys / (area[ss] + 1);
    cmx[ss] = nx < 0 ? nx + W : nx >= W ? nx - W : nx;
    cmy[ss] = ny < 0 ? ny + H : ny >= H ? ny - H : ny;
    nx = cmx[st] - dxt / (area[st] - 1);
    ny = cmy[st] - dyt / (area[st] - 1);
    cmx[st] = nx < 0 ? nx + W : nx >= W ? nx - W : nx;
    cmy[st] = ny < 0 ? ny + H : ny >= H ? ny - H : ny;
    area[ss]++;
    area[st]--;
  }
  S.seed = rs;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kn[0];
  S.dt = d;
  S.T = TLO * exp(log(THI / TLO) * cl((kn[1] - 0.5) / 2.5, 0, 1));
  const c = cl(kn[2], -1, 1);
  setJ(S, c < 0 ? 1 + c : 1 + 0.8 * c);
  const u = (cl(kn[3], -1, 1) + 1) / 2;
  S.mu = 0.6 * exp(log(4) * u);
  S.swRate = 0.1 * exp(log(30) * u);
  if (!S.ready) {
    sweeps(S, PRERUN);
    S.ready = true;
  }
  S.acc += d * MCS_RATE;
  const n = floor(S.acc);
  S.acc -= n;
  if (n > 0) sweeps(S, n);
  // Each cell's heading turns by diffusion.
  const sg = sqrt(2 * DR * d);
  for (let i = 0; i < NC; i++) {
    S.ang[i] += sg * gauss(S);
    S.ux[i] = cos(S.ang[i]);
    S.uy[i] = Math.sin(S.ang[i]);
    if (S.fade[i] < 1) S.fade[i] = min(1, S.fade[i] + d / FADE);
  }
  // Cells that change kind now and then.
  S.swAcc += d * S.swRate;
  while (S.swAcc >= 1) {
    S.swAcc -= 1;
    const i = floor(rng(S) * NC) % NC;
    S.ty0[i] = S.ty[i];
    S.fade[i] = 0;
    S.ty[i] = (S.ty[i] + 1 + (rng(S) < 0.5 ? 0 : 1)) % 3;
    for (let p = 0; p < N; p++) if (S.lat[p] === i) S.tl[p] = S.ty[i];
  }
  shade(S);
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The colour of every site: membrane, distance to it, kind, own brightness, and a time constant.
function shade(S) {
  const lat = S.lat, mem = S.mem, dist = S.dist;
  for (let y = 0; y < H; y++) {
    const yd = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, id = lat[i], r = y * W + ((x + 1) & 63), dn = yd + x;
      const m = lat[r] !== id || lat[dn] !== id ? 1 : 0;
      mem[i] = m;
      dist[i] = m ? 0 : 999;
    }
  }
  // Distance to the nearest membrane, a two pass chamfer: 3 for a step and 4 for a diagonal.
  for (let y = 0; y < H; y++) {
    const yu = ((y + H - 1) % H) * W, yy = y * W;
    for (let x = 0; x < W; x++) {
      const xl = (x + W - 1) & 63, xr = (x + 1) & 63;
      if (!mem[yy + x]) dist[yy + x] = min(dist[yy + x], dist[yu + xl] + 4, dist[yu + x] + 3, dist[yu + xr] + 4, dist[yy + xl] + 3);
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    const yd = ((y + 1) % H) * W, yy = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const xl = (x + W - 1) & 63, xr = (x + 1) & 63;
      if (!mem[yy + x]) dist[yy + x] = min(dist[yy + x], dist[yd + xl] + 4, dist[yd + x] + 3, dist[yd + xr] + 4, dist[yy + xr] + 3);
    }
  }
  // Colour by half LEDs from the membrane: dark and saturated on it, light and softer 2.25 LEDs in.
  if (S.lutHue !== S.hue) {
    S.lutHue = S.hue;
    for (let t = 0; t < 3; t++) {
      for (let q = 0; q < 16; q++) {
        const e = sm(0, 4.5, q);
        hsv(BASE_HUE[t] + S.hue, 0.95 - 0.25 * e, 0.4 + 0.6 * e, S.lut, (t * 16 + q) * 3);
      }
    }
  }
  const a = S.snap ? 1 : 1 - exp(-S.dt / 0.09);
  S.snap = false;
  const lut = S.lut, ty = S.ty, ty0 = S.ty0, fade = S.fade, gain = S.gain;
  for (let i = 0; i < N; i++) {
    const id = lat[i], q = min(15, ((dist[i] * 2) / 3) | 0), o = (ty[id] * 16 + q) * 3, g = gain[id] * 255, f = fade[id];
    let r = lut[o], gr = lut[o + 1], bl = lut[o + 2];
    if (f < 1) {
      const o0 = (ty0[id] * 16 + q) * 3, e = f * f * (3 - 2 * f);
      r = lut[o0] + (r - lut[o0]) * e;
      gr = lut[o0 + 1] + (gr - lut[o0 + 1]) * e;
      bl = lut[o0 + 2] + (bl - lut[o0 + 2]) * e;
    }
    S.R[i] += (r * g - S.R[i]) * a;
    S.G[i] += (gr * g - S.G[i]) * a;
    S.B[i] += (bl * g - S.B[i]) * a;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      display.setPixel(x, y, cl(S.R[i], 0, 255) | 0, cl(S.G[i], 0, 255) | 0, cl(S.B[i], 0, 255) | 0);
    }
  }
}
