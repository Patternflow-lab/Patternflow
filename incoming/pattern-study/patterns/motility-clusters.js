// ===== Patternflow pattern =====
// Title:   Motility Clusters
// Family:  particle
// Idea:    About 1,400 self-propelled discs swim round the periodic panel, each along its own slowly wandering heading and touching the others only to be pushed apart, and above a persistence threshold they jam into pale packed clusters edged by discs that face inward, coloured round the wheel by heading, while a faint gas of free swimmers runs between them and the clusters merge.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: motility-induced phase separation of active Brownian particles (Yaouen Fily and M. Cristina Marchetti, 2012; Michael Cates and Julien Tailleur, 2015), pattern round 50
// Round:   50
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pe=-1..1, Packing=0.55..0.72
//
// Knob 1: Hue. Turns the heading wheel and the tint of the packed discs together. At 0 a disc swimming down is red, down-left yellow, up-left green, up cyan, up-right blue and down-right magenta, so a cluster's edge, where the discs face inward, runs red along its top, cyan along its bottom, violet on its left and yellow-green on its right; packed discs are pale lavender. At 0.25 the tint is pale cyan, at 0.5 pale lime and at 0.75 pale pink.
// Knob 2: Speed. At 2 the discs swim 20 LEDs, ten diameters, a second, at 0.2 a tenth of that and at 3 half as fast again; the turning and the clustering keep pace. The head start before the first frame is always 4 seconds of swimming.
// Knob 3: Pe. The Peclet number v0 / (sigma Dr), the distance in diameters a disc swims before its heading forgets itself, 40 times 8 to the knob. At -1 (Pe 5, a heading lasts half a second at Speed 2) the discs stay a gas of brief clumps, the largest holding a tenth of them; at -0.5 (Pe 14) two fifths; at 0 (Pe 40, four seconds) two thirds after ten seconds, with a third already in one cluster 2.5 s in; at 1 (Pe 320) four fifths.
// Knob 4: Packing. The share of the panel the discs would cover laid flat: 0.55 at the start (1,434 discs), where clusters sit in a gas, to 0.72 (1,877 discs), where the packed phase fills most of the panel and the gas lives in dark bubbles. New discs drop in at random places and taken ones leave from random places.
// Buttons: K1 tap scatters every disc into a fresh uniform gas, and the clusters gather again over the next few seconds.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, sqrt, round, PI, pow, exp } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Disc diameter in LEDs. The neighbour grid is 32 by 64 cells one diameter
// wide, so two discs that overlap are in the same or neighbouring cells.
const SIG = 2, S2 = SIG * SIG, GX = 32, GY = 64, NC = GX * GY, CW = W / GX, LIST2 = (SIG + 0.25) ** 2;
// Swim speed in LEDs a second at Speed 2 (ten diameters a second), the step,
// and how many passes push overlapping pairs apart in each step.
const V0 = 20, HS = 1 / 80, SWEEPS = 6;
// Most discs the Packing knob can ask for, room for the pair list, and the
// head start: seconds of swimming run before the first frame, so the panel
// opens on clusters already gathering out of the gas.
const NMAX = 1900, PMAX = NMAX * 8, PRE = 4;
// Drawing: the squared radius of a disc's splash of light in LEDs, how pale
// the packed discs' tint is, the light of a packed disc and of a lone one,
// and where the heading wheel starts.
const KR = 2.2, TS = 0.25, LC = 0.92, L0 = 0.3, HUE0 = 0.25;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, pe: 40, phi: 0.55, n: 0, t: 0, acc: 0, pre: false,
    x: new Float64Array(NMAX), y: new Float64Array(NMAX), c: new Float64Array(NMAX), s: new Float64Array(NMAX),
    cr: new Float32Array(NMAX), ex: new Float32Array(NMAX), ey: new Float32Array(NMAX),
    x2: new Float64Array(NMAX), y2: new Float64Array(NMAX), c2: new Float64Array(NMAX), s2: new Float64Array(NMAX),
    cr2: new Float32Array(NMAX), ex2: new Float32Array(NMAX), ey2: new Float32Array(NMAX),
    kn: new Float32Array(NMAX), kx: new Float32Array(NMAX), ky: new Float32Array(NMAX),
    pl: new Int32Array(PMAX), m: 0, cell: new Int32Array(NMAX), cnt: new Int32Array(NC + 1), fill: new Int32Array(NC),
    bw: new Float32Array(NP), br: new Float32Array(NP), bg: new Float32Array(NP), bb: new Float32Array(NP),
  };
}

// A uniform gas: discs dropped anywhere, headings anywhere.
function place(S, n) {
  for (let i = S.n; i < n; i++) {
    S.x[i] = Math.random() * W;
    S.y[i] = Math.random() * H;
    const a = Math.random() * TAU;
    S.c[i] = Math.cos(a);
    S.s[i] = Math.sin(a);
    S.cr[i] = S.ex[i] = S.ey[i] = 0;
  }
  S.n = n;
}

// Takes discs away at random until n are left. The arrays are in grid order,
// so cutting the tail would empty the bottom of the panel.
function drop(S, n) {
  const { x, y, c, s, cr, ex, ey } = S;
  while (S.n > n) {
    const i = floor(Math.random() * S.n), j = --S.n;
    x[i] = x[j];
    y[i] = y[j];
    c[i] = c[j];
    s[i] = s[j];
    cr[i] = cr[j];
    ex[i] = ex[j];
    ey[i] = ey[j];
  }
}

// Sorts the discs by grid cell, moving every per-disc array along, so the
// pushes below walk memory in order. cnt holds where each cell starts.
function sort(S) {
  const { cell, cnt, fill, n } = S;
  const { x, y, c, s, cr, ex, ey } = S;
  cnt.fill(0);
  for (let i = 0; i < n; i++) {
    const k = floor(x[i] / CW) + GX * floor(y[i] / CW);
    cell[i] = k;
    cnt[k + 1]++;
  }
  for (let k = 0; k < NC; k++) cnt[k + 1] += cnt[k];
  fill.set(cnt.subarray(0, NC));
  const X = S.x2, Y = S.y2, C = S.c2, Sn = S.s2, R = S.cr2, EX = S.ex2, EY = S.ey2;
  for (let i = 0; i < n; i++) {
    const o = fill[cell[i]]++;
    X[o] = x[i];
    Y[o] = y[i];
    C[o] = c[i];
    Sn[o] = s[i];
    R[o] = cr[i];
    EX[o] = ex[i];
    EY[o] = ey[i];
  }
  S.x2 = x, S.y2 = y, S.c2 = c, S.s2 = s, S.cr2 = cr, S.ex2 = ex, S.ey2 = ey;
  S.x = X, S.y = Y, S.c = C, S.s = Sn, S.cr = R, S.ex = EX, S.ey = EY;
}

// One step of h seconds: every disc swims V0 h along its heading, the
// heading turns by rotational diffusion dr, then overlapping pairs are pushed
// apart along the line between them, half the overlap each, the overdamped
// limit of a stiff short-range spring. Nothing attracts.
function step(S, h, dr) {
  swim(S, S.n, sqrt(6 * dr * h), V0 * h);
  sort(S);
  const m = (S.m = pushGrid(S.x, S.y, S.cnt, S.pl));
  for (let sw = 1; sw < SWEEPS; sw++) pushList(S.x, S.y, S.pl, m);
  wrap(S.x, S.y, S.n);
}

function swim(S, n, amp, d) {
  const { x, y, c, s } = S;
  for (let i = 0; i < n; i++) {
    const xi = x[i] + d * c[i], yi = y[i] + d * s[i];
    x[i] = xi < 0 ? xi + W : xi >= W ? xi - W : xi;
    y[i] = yi < 0 ? yi + H : yi >= H ? yi - H : yi;
    const e = amp * (2 * Math.random() - 1), ci = c[i], si = s[i], q = 1 - 0.5 * e * e;
    c[i] = ci * q - si * e;
    s[i] = si * q + ci * e;
  }
}

// The first pass searches the grid, pushes, and lists every pair closer than
// SIG + 0.25; the later passes push only the listed pairs. Returns the list's
// length.
function pushGrid(x, y, cnt, pl) {
  let m = 0;
  for (let cy = 0; cy < GY; cy++) {
    const dn = (cy + 1 === GY ? 0 : cy + 1) * GX, r0 = cy * GX;
    for (let cx = 0; cx < GX; cx++) {
      const k0 = r0 + cx, a0 = cnt[k0], a1 = cnt[k0 + 1];
      if (a0 === a1) continue;
      const xr = cx + 1 === GX ? 0 : cx + 1, xl = cx === 0 ? GX - 1 : cx - 1;
      for (let q = 0; q < 5; q++) {
        const k = q === 0 ? k0 : q === 1 ? r0 + xr : q === 2 ? dn + xl : q === 3 ? dn + cx : dn + xr;
        const b0 = cnt[k], b1 = cnt[k + 1];
        for (let i = a0; i < a1; i++)
          for (let j = q === 0 ? i + 1 : b0; j < b1; j++) {
            const dx = near(x[j] - x[i], W), dy = near(y[j] - y[i], H), r2 = dx * dx + dy * dy;
            if (r2 >= LIST2) continue;
            if (m < PMAX) (pl[m++] = i), (pl[m++] = j);
            if (r2 < S2 && r2 > 0) push(x, y, i, j, dx, dy, r2);
          }
      }
    }
  }
  return m;
}

function pushList(x, y, pl, m) {
  for (let p = 0; p < m; p += 2) {
    const i = pl[p], j = pl[p + 1];
    const dx = near(x[j] - x[i], W), dy = near(y[j] - y[i], H), r2 = dx * dx + dy * dy;
    if (r2 < S2 && r2 > 0) push(x, y, i, j, dx, dy, r2);
  }
}

// The shortest way round the periodic panel.
const near = (d, L) => (d > L / 2 ? d - L : d < -L / 2 ? d + L : d);

function push(x, y, i, j, dx, dy, r2) {
  const r = sqrt(r2), f = (0.5 * (SIG - r)) / r;
  x[i] -= f * dx;
  y[i] -= f * dy;
  x[j] += f * dx;
  y[j] += f * dy;
}

function wrap(x, y, n) {
  for (let i = 0; i < n; i++) {
    x[i] = x[i] < 0 ? x[i] + W : x[i] >= W ? x[i] - W : x[i];
    y[i] = y[i] < 0 ? y[i] + H : y[i] >= H ? y[i] - H : y[i];
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.55];
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.pe = 40 * pow(8, cl(k[2], -1, 1));
  S.phi = cl(k[3], 0.55, 0.72);
  if (input.btnPressed && input.btnPressed[0]) S.n = 0;
  const want = min(NMAX, round((S.phi * NP) / (PI * S2 * 0.25)));
  if (want > S.n) place(S, want);
  else if (want < S.n) drop(S, want);
  // Pe = V0 / (SIG Dr), the persistence length in diameters.
  const dr = V0 / (SIG * S.pe);
  let run = cl(dt || 0, 0, 0.1) * (S.speed / 2);
  if (!S.pre) {
    S.pre = true;
    run += PRE;
  }
  S.acc += run;
  let ran = 0;
  while (S.acc >= HS) {
    step(S, HS, dr);
    S.acc -= HS;
    S.t += HS;
    ran += HS;
  }
  if (ran > 0) touch(S, 1 - exp(-ran * 8));
}

// Each disc's neighbours from the last step's pair list: how many touch it
// and the sum of the directions to them, eased so the light does not
// flicker with every knock. A disc packed all round has many neighbours and
// a short sum; a disc at the edge of a cluster has them all on one side.
function touch(S, k) {
  const { x, y, pl, m, kn, kx, ky, cr, ex, ey, n } = S;
  kn.fill(0, 0, n);
  kx.fill(0, 0, n);
  ky.fill(0, 0, n);
  for (let p = 0; p < m; p += 2) {
    const i = pl[p], j = pl[p + 1];
    const dx = near(x[j] - x[i], W), dy = near(y[j] - y[i], H), r = sqrt(dx * dx + dy * dy) + 1e-9;
    kn[i]++;
    kn[j]++;
    kx[i] += dx / r;
    ky[i] += dy / r;
    kx[j] -= dx / r;
    ky[j] -= dy / r;
  }
  for (let i = 0; i < n; i++) {
    cr[i] += (kn[i] - cr[i]) * k;
    ex[i] += (kx[i] - ex[i]) * k;
    ey[i] += (ky[i] - ey[i]) * k;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { x, y, c, s, cr, ex, ey, bw, br, bg, bb, n } = S;
  bw.fill(0);
  br.fill(0);
  bg.fill(0);
  bb.fill(0);
  // The colour wheel by heading: each channel is full for discs swimming
  // within 60 degrees of its own direction and dark beyond 120, a third of a
  // turn apart. Discs packed all round fade to one pale tint.
  const h0 = (S.hue + HUE0) * TAU;
  const ar = Math.cos(h0), as = Math.sin(h0), ag = Math.cos(h0 + TAU / 3), gs = Math.sin(h0 + TAU / 3), ab = Math.cos(h0 - TAU / 3), bs = Math.sin(h0 - TAU / 3);
  const tr = 1 - TS + TS * cl(0.5 + ar, 0, 1), tg = 1 - TS + TS * cl(0.5 + ag, 0, 1), tb = 1 - TS + TS * cl(0.5 + ab, 0, 1);
  for (let i = 0; i < n; i++) {
    const k = cr[i], e = sqrt(ex[i] * ex[i] + ey[i] * ey[i]) / max(k, 1), ci = c[i], si = s[i];
    const lum = L0 + (LC - L0) * cl((k - 0.5) / 3.5, 0, 1), u = cl((k - 3) / 2, 0, 1) * cl(1 - 1.6 * e, 0, 1), v = 1 - u;
    const r = lum * (v * cl(0.5 + ci * ar + si * as, 0, 1) + u * tr);
    const g = lum * (v * cl(0.5 + ci * ag + si * gs, 0, 1) + u * tg);
    const b = lum * (v * cl(0.5 + ci * ab + si * bs, 0, 1) + u * tb);
    const px = x[i], py = y[i], ix = floor(px), iy = floor(py);
    for (let yy = iy - 1; yy <= iy + 1; yy++)
      for (let xx = ix - 1; xx <= ix + 1; xx++) {
        const dx = xx + 0.5 - px, dy = yy + 0.5 - py, w = 1 - (dx * dx + dy * dy) / KR;
        if (w <= 0) continue;
        const o = ((yy + H) & 127) * W + ((xx + W) & 63);
        bw[o] += w;
        br[o] += w * r;
        bg[o] += w * g;
        bb[o] += w * b;
      }
  }
  for (let p = 0, yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++, p++) {
      const w = bw[p], f = w > 1 ? 1 / w : 1;
      display.setPixel(xx, yy, q4(br[p] * f), q4(bg[p] * f), q4(bb[p] * f));
    }
}

// Channels in steps of 4 of 255, from 0..1.
const q4 = (v) => ((v * 63 + 0.5) | 0) << 2;

