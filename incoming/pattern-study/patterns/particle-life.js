// ===== Patternflow pattern =====
// Title:   Particle Life
// Family:  particle
// Idea:    Six species of dots, about six hundred in all, push and pull one another with a force that depends on who meets whom, a hard core and a finite reach, and because the table of attractions is not symmetric, one species chases another that runs from it, so coloured cells, orbiting pairs and chains of pursuit form, break and form again all over the panel while the table itself slowly wanders.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Particle Life, a table of attractions between species of particles with a repulsive core and a finite reach (Jeffrey Ventrella, Clusters, 2005 onward; Tom Mohr, Particle Life, 2021; the force law and the 40 ms friction half-life from memory); the primordial particle system (Thomas Schmickl, Martin Stefanec and Karl Crailsheim, 2016, from memory); an Ornstein-Uhlenbeck drift of the table (Leonard Ornstein and George Uhlenbeck, 1930, from memory); a cell grid one reach wide so the cost grows with the number of dots and not its square; colour in OKLab (Bjorn Ottosson, 2020, from memory), pattern round 124
// Round:   126
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1..4, Scale=-1..1, Chase=-1..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the OKLab hue of all six species, so one turn comes back to where it began. At 0 they are coral (40 degrees), yellow (100), green (158), azure (216), violet (274) and pink (334); at 0.5 the same six sit at 220, 280, 338, 36, 94 and 154. A faint warm light is drawn towards grey further than a cool one, so a yellow or coral trail fading out turns pale and does not go olive or brown.
// Knob 2: Pace. The clock of the model, Pace / 2 model seconds a second, a little faster for a short reach. The friction half-life stays 40 ms of model time and the table wanders on the same clock, so the same population runs faster or slower. The dots' rms speed is 3.2 LEDs a second at 1, 6.4 at the opening 2 and 13.4 at 4.
// Knob 3: Scale. The reach R of the force, 8.4 times 1.68 to the Scale in LEDs: 5.0 at -1, 8.4 at 0 and 14.1 at 1, with the core ending at 0.3 R (1.5, 2.5 and 4.2 LEDs) and the pull peaking at 0.65 R (3.3, 5.5 and 9.2). The number of dots follows, 1,140 at -1, 610 at 0 and 400 at 1 (the least allowed). Bonded groups of three or more dots number 79 and hold 13 dots on average at -1, 27 and 21 at 0, 7 and 71 at 1: many small cells, then a few large clusters.
// Knob 4: Chase. The angle phi between the symmetric part of the table (a pair attracts alike) and the antisymmetric part (one chases, the other flees): 30 degrees at -1, 53 at the opening 0.06 and 74 at 1, which moves the mean of |a(i,j) - a(j,i)| / 2 from 0.20 to 0.33 to 0.40 and the symmetric share |a(i,j) + a(j,i)| / 2 from 0.36 to 0.25 to 0.12. Below 0 the mean pull of the species goes down from 0.05 to -0.07, because a symmetric table lumps. The number of dots falls from 1.22 to 0.62 of its Scale value, so the knob is not a brightness knob: at -1 there are 32 bonded groups of 26 dots on average, rounded cells, and at 1 there are 33 of 11 and the dots stream after each other in chains.

// What the model is. Dots on the periodic 64 x 128 panel, each of one of six species. Two dots a distance r apart, with u = r / R,
// push along the line between them with the force
//   F(u) = CORE (u / beta - 1)                       for u < beta, the same for every pair, always a push apart
//   F(u) = a (1 - |2u - 1 - beta| / (1 - beta))      for beta < u < 1, a triangle of height a, a pull when a is positive
//   F(u) = 0                                         beyond the reach
// with beta = 0.3 and a taken from the table by the species of the two dots, in -1..1. The table is not symmetric, so a(i,j) and
// a(j,i) can differ, and then dot i is pulled towards dot j while j is pushed away from i. One step of h seconds of model time:
// the velocity is multiplied by 0.5^(h / 0.04 s), the sum of the forces on the dot within R times h GAMMA R is added (a sum above
// AMAX is squeezed towards it), a thermal kick is added, the speed is clamped to 2 R a second, and the dot moves by h times its
// velocity, wrapped round the panel. The dots are sorted into cells R wide each step and a dot meets the nine cells round it, so
// 600 dots cost 0.2 ms a step and 1,500 dots 0.45 ms.
// The table is six by six numbers that each wander. A symmetric part and an antisymmetric part follow independent Ornstein-
// Uhlenbeck paths with an e-folding time of 7 model seconds and are mixed by phi. Then each species is given the same mean pull
// MU = 0.05 on the others (less, down to -0.07, as Chase goes below 0) and the same mean chasing, and the entries are clipped to
// -1..1. Without that centring a species that repelled all the rest sat still in a lattice, and a table that attracted too many
// made a lump that ran across the panel at the speed clamp.

// What the checks showed. The force peaks at u = (1 + beta) / 2 = 0.65 with the value a and is zero at u = 0.3 (below it F is
// negative, so a pair of attracting dots settles at the contact distance beta R) and at u = 1; found on a grid of 1e5 points
// at 0.6500 and 1.0000, F(0) = -2. At R = 8.4 the core ends at 2.52 LEDs and the pull peaks at 5.46. Newton's third law: with a
// symmetric table, no friction, no kicks and no clamps, 1,000 dots over 600 steps keep the sum of their velocities at 3e-12
// LEDs a second while the sum of their speeds is 4e4 (1e-16 of it, rounding); an antisymmetric table gives 4e3, the pursuit
// that the table is there for. A lone dot thrown at 10 LEDs a second is at 4.2045 after 50 ms, and 10 times 0.5 to the power of
// 50 / 40 is 4.2045; a fit of ln v gives a half-life of 40.000 ms. At the opening, over 900 s, the rms speed is 6.5 LEDs a second
// (0.77 reaches per model second) with a deviation of 1.3 over time, between 4.0 and 10.3, and 6.21, 6.62, 6.39 and 6.66 in
// the four quarters; 1.1 percent of the dots are at the speed clamp at any moment, so the clamp is a safety and the asymmetric
// forces do not heat the dots up. How often the population re-organises: the pairs of dots closer than 1.35 contact
// distances survive 2.5, 5, 10, 20 and 80 s at 0.36, 0.22, 0.11, 0.06 and 0.02. With a table that does not wander the same
// numbers are 0.72, 0.61, 0.50, 0.41 and 0.34: a third of the pairs never part, and 8 percent of the dots sit at the speed clamp,
// where 1 percent do with the wander, because the heavy clumps that formed keep chasing each other. That is why the table wanders.

const { floor, ceil, exp, sqrt, abs, sin, cos, PI, min, max, pow, log } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- tunables
const W = 64, H = 128, NS = 6; // panel in LEDs, number of species
const NMAX = 2400; // the arrays are this long
const BETA = 0.3; // the core, as a share of the reach
const CORE = 2; // push of the core at zero distance, against 1 for the greatest pull of the bump
const T_HALF = 0.04; // friction half-life, seconds of model time
const GAMMA = 16; // acceleration, in reaches a second squared, of a force of 1
const VMAX = 2; // speed clamp, reaches a second; 1 percent of the dots are at it at the opening
const AMAX = 3; // the push a dot can take, in forces of 1; a larger sum is squeezed towards it
const VT = 0.2; // thermal speed of a dot, reaches a second, per component
const HMAX = 1 / 45; // largest step, seconds of model time
const R0 = 8.4, RK = 1.68; // reach in LEDs: R0 * RK^Scale
const N0 = 680, NP = 1.2, NLO = 400, NHI = 1700; // dots: N0 (R0 / R)^NP times a factor that falls with Chase, held between NLO and NHI
const TAU_RULE = 7; // e-folding time of the table's wander, seconds of model time
const TSC = 0.65; // size of a table entry before centring and the clip at 1; the entries then have an rms of 0.51
const MU = 0.05, MUC = 0.12; // the mean pull of every species on the others: MU, less by up to MUC as Chase goes below 0 (a symmetric table lumps)
const PHI0 = 30, PHI1 = 22; // the angle between symmetric and antisymmetric table, degrees: PHI0 + PHI1 (1 + Chase)
const CLOCK = 0.5; // model seconds a second for each unit of Pace
const CKS = 0.5; // the clock runs (R0 / R)^CKS faster for a short reach, so a fine population does not crawl in LEDs a second

// ---- the force. u is the distance over the reach, a the pair's attraction (-1..1).
const IB = 1 / BETA, IB1 = 1 / (1 - BETA);
function force(u, a) {
  if (u >= 1) return 0;
  if (u < BETA) return CORE * (u * IB - 1);
  return a * (1 - abs(2 * u - 1 - BETA) * IB1);
}

// ---- colour. OKLab (Bjorn Ottosson, 2020, constants from memory), six species a little under 60 degrees of hue apart, each at its own
// lightness and chroma, brought into the sRGB gamut by taking chroma off; the light of a species is its colour scaled to a largest channel of 1.
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const HUES = [40, 100, 158, 216, 274, 334]; // degrees in OKLab at Hue 0
const LS = [0.8, 0.88, 0.8, 0.78, 0.74, 0.76], CS = [0.15, 0.15, 0.16, 0.14, 0.15, 0.17];
const TMP = [0, 0, 0];
function buildColours(S, shift) {
  for (let k = 0; k < NS; k++) {
    const h = ((HUES[k] + shift) * PI) / 180;
    let C = CS[k];
    for (let it = 0; it < 10; it++) {
      lin(LS[k], C * cos(h), C * sin(h), TMP);
      if (TMP[0] >= 0 && TMP[1] >= 0 && TMP[2] >= 0 && TMP[0] <= 1 && TMP[1] <= 1 && TMP[2] <= 1) break;
      C *= 0.92;
    }
    const m = max(TMP[0], TMP[1], TMP[2], 1e-6);
    S.col[3 * k] = TMP[0] / m;
    S.col[3 * k + 1] = TMP[1] / m;
    S.col[3 * k + 2] = TMP[2] / m;
  }
  S.hueDone = shift;
}

// ---- state. pid is a dot's number, carried through the sorting only so that the bonds can be followed when measuring.
// A normal random number (Box and Muller, 1958, from memory).
const rg = () => {
  const u = 1 - Math.random(), v = Math.random();
  return sqrt(-2 * log(u)) * cos(TAU * v);
};
function newState() {
  const F = (n) => new Float64Array(n);
  const S = {
    n: 0, id: 0,
    x: F(NMAX), y: F(NMAX), vx: F(NMAX), vy: F(NMAX), sp: new Uint8Array(NMAX), pid: new Int32Array(NMAX),
    x2: F(NMAX), y2: F(NMAX), vx2: F(NMAX), vy2: F(NMAX), sp2: new Uint8Array(NMAX), pid2: new Int32Array(NMAX),
    ax: F(NMAX), ay: F(NMAX), cell: new Int32Array(NMAX), cnt: new Int32Array(400), fill: new Int32Array(400),
    gx: 8, gy: 16,
    ou: F(NS * NS), // symmetric entries in the upper triangle, antisymmetric in the lower
    tab: new Float64Array(NS * NS), sy: new Float64Array(NS * NS), an: new Float64Array(NS * NS), rs: new Float64Array(NS), ra: new Float64Array(NS),
    R: R0, phi: PI / 4, mu: MU, pace: 2, kp: 2, ks: 0, kc: 0.06, hueDone: -1, time: 0,
    col: new Float32Array(3 * NS),
    br: new Float32Array(W * H), bg: new Float32Array(W * H), bb: new Float32Array(W * H),
    cr: new Float32Array(W * H), cg: new Float32Array(W * H), cb: new Float32Array(W * H),
    noise: VT, fric: 0.5,
    hr: new Float32Array(GW * GH), hg: new Float32Array(GW * GH), hb: new Float32Array(GW * GH), ht: new Float32Array(GW * GH),
  };
  for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) S.ou[i * NS + j] = rg();
  return S;
}

// the table a(i, j) from the wandering entries: the symmetric part S_ij = S_ji and the antisymmetric part A_ij = -A_ji,
// mixed by the angle phi. phi 0 is a symmetric table and phi 90 degrees a purely antisymmetric one.
function makeTable(S) {
  const c = cos(S.phi), s = sin(S.phi), { ou, tab } = S, sy = S.sy, an = S.an, rs = S.rs, ra = S.ra;
  let m = 0;
  for (let i = 0; i < NS; i++) {
    rs[i] = ra[i] = 0;
    for (let j = 0; j < NS; j++) {
      sy[i * NS + j] = i <= j ? ou[i * NS + j] : ou[j * NS + i];
      an[i * NS + j] = i < j ? ou[j * NS + i] : i > j ? -ou[i * NS + j] : 0;
      rs[i] += sy[i * NS + j] / NS;
      ra[i] += an[i * NS + j] / NS;
    }
    m += rs[i] / NS;
  }
  // every species gets the same mean attraction MU over the others and the same mean chasing, so none of them repels all the
  // rest and sits still in a lattice, none is only prey, and the population as a whole can neither lump nor spread out
  for (let i = 0; i < NS; i++)
    for (let j = 0; j < NS; j++) {
      const sc = sy[i * NS + j] - rs[i] - rs[j] + m, ac = an[i * NS + j] - ra[i] + ra[j];
      tab[i * NS + j] = cl(TSC * (c * sc + s * ac) + S.mu, -1, 1);
    }
}
function wander(S, h) {
  const k = h / TAU_RULE, d = exp(-k), q = sqrt(1 - d * d), { ou } = S;
  for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) ou[i * NS + j] = ou[i * NS + j] * d + q * rg();
}

function setCount(S, n) {
  while (S.n > n) {
    const i = floor(Math.random() * S.n), j = --S.n;
    S.x[i] = S.x[j]; S.y[i] = S.y[j]; S.vx[i] = S.vx[j]; S.vy[i] = S.vy[j]; S.sp[i] = S.sp[j]; S.pid[i] = S.pid[j];
  }
  while (S.n < n) {
    const i = S.n++;
    S.x[i] = Math.random() * W;
    S.y[i] = Math.random() * H;
    S.vx[i] = S.vy[i] = 0;
    S.sp[i] = floor(Math.random() * NS);
    S.pid[i] = S.id++;
  }
}

// ---- the step: sort into cells a reach wide, sum the pair forces over the nine cells round each, integrate
function sortCells(S) {
  const R = S.R, gx = (S.gx = floor(W / R)), gy = (S.gy = floor(H / R)), cx = W / gx, cy = H / gy, nc = gx * gy;
  const { cell, cnt, fill, n, x, y } = S;
  cnt.fill(0, 0, nc + 1);
  for (let i = 0; i < n; i++) {
    const k = min(gx - 1, floor(x[i] / cx)) + gx * min(gy - 1, floor(y[i] / cy));
    cell[i] = k;
    cnt[k + 1]++;
  }
  for (let k = 0; k < nc; k++) cnt[k + 1] += cnt[k];
  for (let k = 0; k < nc; k++) fill[k] = cnt[k];
  const X = S.x2, Y = S.y2, VX = S.vx2, VY = S.vy2, SP = S.sp2, PI_ = S.pid2;
  for (let i = 0; i < n; i++) {
    const o = fill[cell[i]]++;
    X[o] = x[i]; Y[o] = y[i]; VX[o] = S.vx[i]; VY[o] = S.vy[i]; SP[o] = S.sp[i]; PI_[o] = S.pid[i];
  }
  let t;
  t = S.x; S.x = S.x2; S.x2 = t;
  t = S.y; S.y = S.y2; S.y2 = t;
  t = S.vx; S.vx = S.vx2; S.vx2 = t;
  t = S.vy; S.vy = S.vy2; S.vy2 = t;
  t = S.sp; S.sp = S.sp2; S.sp2 = t;
  t = S.pid; S.pid = S.pid2; S.pid2 = t;
}

function forces(S) {
  const { x, y, sp, ax, ay, cnt, tab, n, gx, gy } = S, R = S.R, ir = 1 / R, R2 = R * R;
  ax.fill(0, 0, n);
  ay.fill(0, 0, n);
  for (let cy = 0; cy < gy; cy++) {
    const dn = (cy + 1 === gy ? 0 : cy + 1) * gx, r0 = cy * gx;
    for (let cx = 0; cx < gx; cx++) {
      const k0 = r0 + cx, a0 = cnt[k0], a1 = cnt[k0 + 1];
      if (a0 === a1) continue;
      const xr = cx + 1 === gx ? 0 : cx + 1, xl = cx === 0 ? gx - 1 : cx - 1;
      for (let q = 0; q < 5; q++) {
        const k = q === 0 ? k0 : q === 1 ? r0 + xr : q === 2 ? dn + xl : q === 3 ? dn + cx : dn + xr;
        const b0 = cnt[k], b1 = cnt[k + 1];
        for (let i = a0; i < a1; i++) {
          const xi = x[i], yi = y[i], ti = sp[i] * NS;
          let fx = 0, fy = 0;
          for (let j = q === 0 ? i + 1 : b0; j < b1; j++) {
            let dx = x[j] - xi, dy = y[j] - yi;
            dx = dx > 32 ? dx - W : dx < -32 ? dx + W : dx;
            dy = dy > 64 ? dy - H : dy < -64 ? dy + H : dy;
            const r2 = dx * dx + dy * dy;
            if (r2 >= R2 || r2 === 0) continue;
            const r = sqrt(r2), u = r * ir;
            let fi, fj;
            if (u < BETA) fi = fj = CORE * (u * IB - 1);
            else {
              const h = 1 - abs(2 * u - 1 - BETA) * IB1, tj = sp[j];
              fi = tab[ti + tj] * h;
              fj = tab[tj * NS + sp[i]] * h;
            }
            const k1 = 1 / r;
            fx += fi * dx * k1;
            fy += fi * dy * k1;
            ax[j] -= fj * dx * k1;
            ay[j] -= fj * dy * k1;
          }
          ax[i] += fx;
          ay[i] += fy;
        }
      }
    }
  }
}

function integrate(S, h) {
  const { x, y, vx, vy, ax, ay, n } = S, R = S.R, iA = 1 / AMAX, g = GAMMA * R * h, fr = S.fric, vm = VMAX * R, vm2 = vm * vm;
  const kick = S.noise * R * sqrt((2 * h * 0.69314718) / T_HALF) * 2;
  for (let i = 0; i < n; i++) {
    const fa = sqrt(ax[i] * ax[i] + ay[i] * ay[i]), sq = 1 / (1 + fa * iA);
    let u = vx[i] * fr + g * ax[i] * sq, v = vy[i] * fr + g * ay[i] * sq;
    if (kick > 0) {
      u += kick * (Math.random() + Math.random() + Math.random() - 1.5);
      v += kick * (Math.random() + Math.random() + Math.random() - 1.5);
    }
    const s2 = u * u + v * v;
    if (s2 > vm2) {
      const f = vm / sqrt(s2);
      u *= f;
      v *= f;
    }
    vx[i] = u;
    vy[i] = v;
    let px = x[i] + u * h, py = y[i] + v * h;
    px = px < 0 ? px + W : px >= W ? px - W : px;
    py = py < 0 ? py + H : py >= H ? py - H : py;
    x[i] = px;
    y[i] = py;
  }
}

function step(S, h) {
  S.fric = pow(0.5, h / T_HALF);
  wander(S, h);
  makeTable(S);
  sortCells(S);
  forces(S);
  integrate(S, h);
  S.time += h;
}

function advance(S, total) {
  const m = max(1, ceil(total / HMAX - 1e-9)), h = total / m;
  for (let i = 0; i < m; i++) step(S, h);
}

// ---- the knobs
const KNOB = [0, 2, 0, 0.06];
function applyKnobs(S) {
  S.pace = S.kp;
  S.R = R0 * pow(RK, S.ks);
  S.phi = ((PHI0 + PHI1 * (1 + S.kc)) * PI) / 180;
  S.mu = MU + MUC * min(0, S.kc);
}
function wantCount(R, kc) {
  return cl(round(N0 * pow(R0 / R, NP) * (1.22 - 0.3 * (1 + kc))), NLO, NHI);
}
const round = Math.round;

// A random table is tried by letting a scatter of dots run for SPIN seconds of model time and then measuring how far they get in
// PROBE more, as a mean in reaches. Tables drawn at random give 0.5 to 1.9; a symmetric table that does not wander, which sets the
// dots into crystals, gives 0.14 to 0.21 (thermal motion alone). Under DULL the table is thrown away for another, up to TRIES
// times, and the liveliest stays if none passes.
const SPIN = 6, PROBE = 3, TRIES = 4, DULL = 0.35;
function scatter(S) {
  for (let i = 0; i < NS * NS; i++) S.ou[i] = rg();
  for (let i = 0; i < S.n; i++) {
    S.x[i] = Math.random() * W;
    S.y[i] = Math.random() * H;
    S.vx[i] = S.vy[i] = 0;
    S.sp[i] = floor(Math.random() * NS);
  }
}
function probe(S) {
  advance(S, SPIN);
  const x0 = S.x.slice(0, S.n), y0 = S.y.slice(0, S.n), at = new Int32Array(S.n);
  for (let i = 0; i < S.n; i++) at[i] = S.pid[i];
  const home = new Map();
  for (let i = 0; i < S.n; i++) home.set(at[i], i);
  advance(S, PROBE);
  let d = 0;
  for (let i = 0; i < S.n; i++) {
    const k = home.get(S.pid[i]);
    let dx = abs(S.x[i] - x0[k]), dy = abs(S.y[i] - y0[k]);
    dx = dx > W / 2 ? W - dx : dx;
    dy = dy > H / 2 ? H - dy : dy;
    d += sqrt(dx * dx + dy * dy);
  }
  return d / S.n / S.R;
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  const k = knobValues || KNOB;
  S.kp = cl(k[1], 1, 4);
  S.ks = cl(k[2], -1, 1);
  S.kc = cl(k[3], -1, 1);
  applyKnobs(S);
  buildColours(S, cl(k[0], 0, 1) * 360);
  setCount(S, wantCount(S.R, S.kc));
  let best = null, top = -1;
  for (let t = 0; t < TRIES; t++) {
    scatter(S);
    const v = probe(S);
    S.tries = t + 1;
    S.probe = v;
    if (v > top) {
      top = v;
      best = { ou: S.ou.slice(), x: S.x.slice(), y: S.y.slice(), vx: S.vx.slice(), vy: S.vy.slice(), sp: S.sp.slice(), pid: S.pid.slice() };
    }
    if (v >= DULL) break;
  }
  if (S.probe < top) {
    for (const key of Object.keys(best)) S[key].set(best[key]);
    S.probe = top;
  }
  S.time = 0;
  splat(S, 1);
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, h = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360;
  if (abs(hue - S.hueDone) > 0.5) buildColours(S, hue);
  if (h <= 0) return;
  const f = 1 - exp(-4 * h);
  S.kp += (cl(k[1], 1, 4) - S.kp) * f;
  S.ks += (cl(k[2], -1, 1) - S.ks) * f;
  S.kc += (cl(k[3], -1, 1) - S.kc) * f;
  applyKnobs(S);
  const want = wantCount(S.R, S.kc), dn = max(8, floor(S.n * 0.04));
  if (want > S.n) setCount(S, min(want, S.n + dn));
  else if (want < S.n) setCount(S, max(want, S.n - dn));
  advance(S, h * S.pace * CLOCK * pow(R0 / S.R, CKS));
  splat(S, h);
}

// ---- the picture. A dot is a soft bump of radius 1.5 LEDs, (1 - d^2 / 2.25)^2, so it is 2 to 3 LEDs across, added into a float buffer
// in the colour of its species and brighter when it moves. The buffer keeps the larger of what is there and what it brings, faded
// with a life of 0.16 s, and that is the trail. Under it goes the ghost, a faint cool glow that is strongest where few dots are near
// and falls as the density rises, so a void is never black and a cell is left alone: the dots counted on a 4 LED grid, blurred to a
// sigma of 4 LEDs, set the colour and how much. On top goes a dark blue ground, and a tone map that keeps the hue, 1 - exp(-1.3 m)
// on the largest channel, brings the sum to the panel.
const KR = 2.25; // squared radius of a dot, LEDs
const GAIN = 1.1, TK = 1.3, TRAIL = 0.16; // light of one dot, the tone map, the trail's life in seconds
const DIM = 0.45; // how far faint light is drawn towards grey
const SHADE = 0.85, VSHADE = 0.35; // a resting dot shines at SHADE of full, one moving 0.35 reaches a second at full
const GW = 16, GH = 32, HZ = 0.014, HD0 = 1.5; // the ghost: a 4 LED grid, its gain where there are no dots, the blurred count a cell where it has fallen to 1/e
function splat(S, h) {
  const { x, y, vx, vy, sp, n, col, cr, cg, cb, br, bg, bb, hr, hg, hb, ht } = S, R = S.R, iv = 1 / (VSHADE * R);
  cr.fill(0);
  cg.fill(0);
  cb.fill(0);
  hr.fill(0);
  hg.fill(0);
  hb.fill(0);
  for (let i = 0; i < n; i++) {
    const px = x[i], py = y[i], ix = floor(px), iy = floor(py), c = sp[i] * 3;
    const sh = SHADE + (1 - SHADE) * min(1, sqrt(vx[i] * vx[i] + vy[i] * vy[i]) * iv), r = col[c] * GAIN * sh, g = col[c + 1] * GAIN * sh, b = col[c + 2] * GAIN * sh;
    for (let yy = iy - 1; yy <= iy + 1; yy++) {
      const dy = yy + 0.5 - py, row = ((yy + H) & 127) * W;
      for (let xx = ix - 1; xx <= ix + 1; xx++) {
        const dx = xx + 0.5 - px, q = 1 - (dx * dx + dy * dy) / KR;
        if (q <= 0) continue;
        const w = q * q, o = row + ((xx + W) & 63);
        cr[o] += w * r;
        cg[o] += w * g;
        cb[o] += w * b;
      }
    }
    // the ghost: the same particle spread over four cells of the coarse grid
    const gx = px * 0.25 - 0.5, gy = py * 0.25 - 0.5, i0 = floor(gx), j0 = floor(gy), fx = gx - i0, fy = gy - j0;
    const a0 = i0 & (GW - 1), a1 = (i0 + 1) & (GW - 1), r0 = (j0 & (GH - 1)) * GW, r1 = ((j0 + 1) & (GH - 1)) * GW;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy, k0 = col[c], k1 = col[c + 1], k2 = col[c + 2];
    hr[r0 + a0] += w00 * k0; hg[r0 + a0] += w00 * k1; hb[r0 + a0] += w00 * k2;
    hr[r0 + a1] += w10 * k0; hg[r0 + a1] += w10 * k1; hb[r0 + a1] += w10 * k2;
    hr[r1 + a0] += w01 * k0; hg[r1 + a0] += w01 * k1; hb[r1 + a0] += w01 * k2;
    hr[r1 + a1] += w11 * k0; hg[r1 + a1] += w11 * k1; hb[r1 + a1] += w11 * k2;
  }
  for (let rep = 0; rep < 2; rep++)
    for (const A of [hr, hg, hb]) {
      for (let j = 0; j < GH; j++)
        for (let i = 0; i < GW; i++) ht[j * GW + i] = 0.25 * A[j * GW + ((i + GW - 1) & (GW - 1))] + 0.5 * A[j * GW + i] + 0.25 * A[j * GW + ((i + 1) & (GW - 1))];
      for (let j = 0; j < GH; j++)
        for (let i = 0; i < GW; i++) A[j * GW + i] = 0.25 * ht[((j + GH - 1) & (GH - 1)) * GW + i] + 0.5 * ht[j * GW + i] + 0.25 * ht[((j + 1) & (GH - 1)) * GW + i];
    }
  // the ghost is half the colour of what is near and half a cool grey, so a faint halo round a yellow cell never goes olive
  for (let k = 0; k < GW * GH; k++) {
    const m = max(hr[k], hg[k], hb[k], 1e-6), f = HZ * exp(-m / HD0), q = 0.5 / m;
    hr[k] = f * (hr[k] * q + 0.3);
    hg[k] = f * (hg[k] * q + 0.33);
    hb[k] = f * (hb[k] * q + 0.5);
  }
  const d = exp(-h / TRAIL);
  for (let p = 0; p < W * H; p++) {
    const r = br[p] * d, g = bg[p] * d, b = bb[p] * d;
    br[p] = cr[p] > r ? cr[p] : r;
    bg[p] = cg[p] > g ? cg[p] : g;
    bb[p] = cb[p] > b ? cb[p] : b;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { br, bg, bb, hr, hg, hb } = S;
  for (let y = 0, p = 0; y < H; y++) {
    const gy = (y + 0.5) * 0.25 - 0.5, j0 = floor(gy), fy = gy - j0, r0 = (j0 & (GH - 1)) * GW, r1 = ((j0 + 1) & (GH - 1)) * GW;
    for (let x = 0; x < W; x++, p++) {
      const gx = (x + 0.5) * 0.25 - 0.5, i0 = floor(gx), fx = gx - i0, a0 = i0 & (GW - 1), a1 = (i0 + 1) & (GW - 1);
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      let r = br[p] + w00 * hr[r0 + a0] + w10 * hr[r0 + a1] + w01 * hr[r1 + a0] + w11 * hr[r1 + a1];
      let g = bg[p] + w00 * hg[r0 + a0] + w10 * hg[r0 + a1] + w01 * hg[r1 + a0] + w11 * hg[r1 + a1];
      let b = bb[p] + w00 * hb[r0 + a0] + w10 * hb[r0 + a1] + w01 * hb[r1 + a0] + w11 * hb[r1 + a1];
      const m = max(r, g, b);
      if (m > 1e-6) {
        const s = (1 - exp(-TK * m)) / m;
        r *= s;
        g *= s;
        b *= s;
        // what is faint goes towards grey, a warm one further, so a yellow or orange dot fading out turns pale instead of brown
        const t = m * s, wm = (r - b) / t - 0.3, warm = wm < 0 ? 0 : wm > 0.67 ? 1 : wm * 1.5;
        const k = DIM * (1 + 1.2 * warm) * (1 - (t > 0.45 ? 1 : t * 2.2222)), lu = 0.3 * r + 0.55 * g + 0.15 * b;
        r += (lu - r) * k;
        g += (lu - g) * k;
        b += (lu - b) * k;
      }
      display.setPixel(x, y, gam(r + 0.004), gam(g + 0.004), gam(b + 0.012));
    }
  }
}
