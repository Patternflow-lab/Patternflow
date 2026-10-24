// ===== Patternflow pattern =====
// Title:   Lichtenberg
// Family:  fractal
// Idea:    High voltage creeps over a wet board of pale wood from an electrode at each end; two branching trees of blue-white plasma and orange embers burn toward each other and char black, an arc flashes down the joined path, the embers die and the next board slides in.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 26, after fractal wood burning and the dielectric breakdown model (Niemeyer, Pietronero and Wiesmann, 1984)
// Round:   26
// ===============================
// @matrix 64x128
// @knobs Wood=0..1, Speed=0.2..3, Pull=1..4, Lead=-1..1
//
// Knob 1: Wood. Pale maple at 0, then white birch, walnut and black-stained oak at 1. The char is black-brown on the pale boards; on the stained one the burn eats through to grey ash.
// Knob 2: Speed. At 2 the power comes on a second and a half after a board is in, the trees meet four and a half seconds later, and a board takes about eleven seconds from wet to gone; at 0.2 it all runs ten times slower.
// Knob 3: Pull. The exponent of the dielectric breakdown model, how hard the far electrode's field draws the growth: at 1 the trees fork like a river delta, each channel feathered with fine twigs and open wood between; at 4 they shoot at each other in a few straight leaders.
// Knob 4: Lead. Which electrode leads: at -1 the top tree burns most of the way down, at 1 the bottom one climbs most of the way up, and near 0 they meet halfway.
// Buttons: K1 tap cuts the power and slides the next board in now.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, exp, sqrt, pow, sin, abs, log2 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const F32 = (n) => new Float32Array(n);
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + hash(xi + 1, yi + 1)) * su * sv;
}

// The board at rest fills columns X0..X1 and rows Y0..Y1; the electrodes
// touch it at (TX, TY) and (BX, BY).
const X0 = 2, X1 = 61, Y0 = 3, Y1 = 124, TX = 32, TY = 9, BX = 31, BY = 118;
// A board slides down this far for the next, with a few rows of rig between.
const SL = 131;
// Seconds at Speed 2: wet board before the power, growth until the trees
// meet, the arc, the embers dying, the slide.
const SOAK = 1.0, TG = 4.8, ARC = 0.5, COOL = 3, SLIDE = 1.6;
// Cells each tree adds a second at the front when it keeps pace with its
// schedule, and fringe twigs a second for every cell of its channels.
const RATE = 200, TWIG = 0.14;
// A cell that joined the tree this recently is still plasma.
const TIP = 0.16;
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
// How readily a channel, a twig and a twig's twig sprout a fringe twig,
// and how far each new generation runs: three or four LEDs, two, then one.
const GEN = [1, 0.4, 0.25], LEN = [2, 1, 0];
// A channel feeding this many cells beyond it burns a groove one, two,
// three and four steps wider, with a brown scorch round it: the trunks
// near the electrodes run thick and dark.
const WIDE = [12, 50, 160, 500];
// How dark the curl's bands run, in grain darkness.
const CURL = 0.45;
const N4 = [-1, 1, -W, W], ND = [-W - 1, -W + 1, W - 1, W + 1], LUT = [0, 1, 16];

// Board, grain, knot and char colours for maple, birch, walnut and
// black-stained oak, where the burn leaves grey ash.
const WOODS = [
  [[228, 196, 150], [160, 110, 66], [128, 76, 40], [30, 19, 14]],
  [[244, 232, 204], [210, 186, 142], [120, 90, 58], [30, 19, 14]],
  [[140, 90, 58], [88, 54, 34], [50, 30, 18], [26, 16, 12]],
  [[50, 44, 46], [30, 26, 28], [18, 14, 14], [92, 86, 80]],
];
const SMOKE = [196, 190, 184], RIG = [16, 17, 22];

// One board's wood: grain darkness (above 1 in a knot), how wet the soda
// wash left each spot, and a per-channel speckle.
function wood() {
  const g = F32(N), wet = F32(N), nz = new Int8Array(N * 3);
  const ox = rnd() * 300, oy = rnd() * 300, per = 2.6 + rnd() * 0.6, tilt = (rnd() - 0.5) * 0.06;
  const knots = [];
  for (let k = 0, nk = 1 + floor(rnd() * 3); k < nk; k++)
    knots.push([X0 + 9 + rnd() * (X1 - X0 - 18), Y0 + 14 + rnd() * (Y1 - Y0 - 28), 1.6 + rnd() * 1.4]);
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const i = y * W + x;
      let u = x + tilt * y + 9 * (vn(x / 26 + ox, y / 40 + oy) - 0.5) + 2 * (vn(x / 7 + oy, y / 11 + ox) - 0.5), kd = 0;
      for (const [kx, ky, kr] of knots) {
        const dx = x - kx, dy = (y - ky) / 2.2, d2 = dx * dx + dy * dy;
        // The grain bends round a knot and crowds in close to it.
        u += (kr * kr * 3 * dx) / (d2 + kr * kr);
        kd = max(kd, 1 - sqrt(d2) / kr);
      }
      // Thin dark latewood lines, a pore streak here and there, and the curl
      // of figured maple across the grain, a band every two rows or so.
      const c = 0.5 + 0.5 * Math.cos((2 * Math.PI * u) / per);
      let v = c ** 4 * (0.8 + 0.6 * vn(x / 5 + ox, y / 30)) + 0.22 * (hash(x, floor(y / 4) + 7) - 0.5);
      v += CURL * (0.5 + 0.5 * Math.sin((2 * Math.PI * (y + 1.5 * vn(x / 6 + oy, y / 20))) / 2.3));
      if (kd > 0) v = 1 + kd * 0.6;
      g[i] = cl(v, 0, 1.6);
      wet[i] = 0.5 + 0.5 * vn(x / 9 + oy, y / 9 + ox);
      for (let ch = 0; ch < 3; ch++) nz[i * 3 + ch] = round((rnd() - 0.5) * 4);
    }
  return { g, wet, nz, col: F32(N * 3), at: -1 };
}

// A board's colours for this K1: grain, knots, lamp, bevels and speckle.
function paint(B, wood) {
  const wv = wood * 3, wi = min(2, floor(wv)), wf = wv - wi, WC = [];
  for (let j = 0; j < 4; j++) WC.push([0, 1, 2].map((c) => WOODS[wi][j][c] + (WOODS[wi + 1][j][c] - WOODS[wi][j][c]) * wf));
  B.ch = WC[3];
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const i = y * W + x, gv = B.g[i], lo = gv <= 1 ? 0 : 1, t = gv <= 1 ? gv : (gv - 1) / 0.6;
      let lf = 1.02 - 0.12 * (y / H);
      if (x === X0 || y === Y0) lf *= 1.08;
      if (x === X1 || y === Y1) lf *= 0.7;
      for (let c = 0; c < 3; c++) B.col[i * 3 + c] = (WC[lo][c] + (WC[lo + 1][c] - WC[lo][c]) * t) * lf + B.nz[i * 3 + c];
    }
  B.at = wood;
}

export function setup(params) {
  const P = (params.s = {
    time: 0, ph: 0, pt: 0, tau: 0, power: 0, wood: 0, eta: 1, lead: 0, ym: 64,
    own: new Uint8Array(N), twg: new Uint8Array(N), par: new Int32Array(N), cnt: new Int32Array(N), born: F32(N),
    phi: F32(N), phi0: F32(N), chr: F32(N), sco: F32(N), ht: F32(N),
    cand: [new Int32Array(N), new Int32Array(N)], cw: [F32(N), F32(N)], nc: [0, 0], acc: [0, 0], tac: [0, 0], tw: [], ntw: 0, cells: [new Int32Array(N), new Int32Array(N)], ncell: [1, 1], nsk: [1, 1],
    fr: [TY, BY], meet: -1, meetQ: -1, path: new Int32Array(N), np: 0,
    pl: F32(N), sm: F32(N), puffs: [], ring: new Int32Array(512), nr: 0, hot: new Int32Array(32), nh: 0, flash: 0,
    wa: wood(), wb: wood(),
  });
  for (let k = 0; k < 256; k++) P.tw.push({ left: 0 }), k < 70 && P.puffs.push({ on: 0 });
  // The field round the two bare electrodes, solved once from a straight ramp.
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) P.phi[y * W + x] = cl((y - TY) / (BY - TY), 0, 1);
  (P.own[TY * W + TX] = 1), (P.phi[TY * W + TX] = 0), (P.own[BY * W + BX] = 2), (P.phi[BY * W + BX] = 1);
  relax(P, 400);
  P.phi0.set(P.phi);
  fresh(P);
}

// A clean board under the electrodes, wet and unburnt.
function fresh(P) {
  for (const a of [P.own, P.twg, P.cnt, P.chr, P.sco, P.ht]) a.fill(0);
  P.par.fill(-1);
  P.born.fill(-9);
  P.phi.set(P.phi0);
  for (const t of P.tw) t.left = 0;
  const t = TY * W + TX, b = BY * W + BX;
  (P.own[t] = P.cnt[t] = P.cnt[b] = 1), (P.own[b] = 2), (P.cells[0][0] = t), (P.cells[1][0] = b);
  Object.assign(P, { ncell: [1, 1], nsk: [1, 1], fr: [TY, BY], acc: [0, 0], tac: [0, 0], meet: -1, meetQ: -1, np: 0, tau: 0 });
}

// Red-black over-relaxation of Laplace's equation on the board: the top tree
// held at 0, the bottom one at 1, the board's edges insulating.
function relax(P, sweeps) {
  const { own, phi } = P;
  for (let s = 0; s < sweeps; s++)
    for (let c = 0; c < 2; c++)
      for (let y = Y0; y <= Y1; y++) {
        const r = y * W;
        for (let x = X0 + ((y + c) & 1); x <= X1; x += 2) {
          const i = r + x;
          if (own[i]) continue;
          const v = phi[i];
          const a = x > X0 ? phi[i - 1] : v, b = x < X1 ? phi[i + 1] : v, u = y > Y0 ? phi[i - W] : v, d = y < Y1 ? phi[i + W] : v;
          phi[i] = v + 1.85 * ((a + b + u + d) * 0.25 - v);
        }
      }
}

// A wood cell beside one cell of a tree, or touching one at a corner, may
// join it, with a chance that goes as the field there to the power eta.
// Nothing off the board ever joins, so neighbours need no bounds checks.
function scan(P, eta) {
  const { own, phi, cand, cw } = P, n = [0, 0], t = [0, 0];
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const i = y * W + x;
      if (own[i]) continue;
      // Neighbours of each tree counted in one number, four bits a tree.
      const s4 = LUT[own[i - 1]] + LUT[own[i + 1]] + LUT[own[i - W]] + LUT[own[i + W]];
      const s8 = LUT[own[i - W - 1]] + LUT[own[i - W + 1]] + LUT[own[i + W - 1]] + LUT[own[i + W + 1]];
      for (let k = 0; k < 2; k++) {
        const a = (s4 >> (4 * k)) & 15;
        if (a > 1 || (!a && ((s8 >> (4 * k)) & 15) !== 1)) continue;
        t[k] += pow(max(k ? 1 - phi[i] : phi[i], 1e-5), eta);
        cand[k][n[k]] = i;
        cw[k][n[k]++] = t[k];
      }
    }
  P.nc = n;
}

// A cell joins tree k only if branches stay one LED wide: nothing of the
// tree may touch it but the cell it grows from and that cell's neighbours.
// Touching the other tree is the meeting.
function join(P, c, k, tw = 0) {
  const { own } = P;
  if (own[c]) return false;
  let p = -1, m = 0;
  for (const o of N4) if (own[c + o] === k) (p = c + o), m++;
  if (m > 1) return false;
  if (p < 0) for (const o of ND) if (own[c + o] === k && p < 0) p = c + o;
  if (p < 0) return false;
  const px = p & 63, py = p >> 6;
  let other = -1;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const q = c + dy * W + dx;
      if (q === c || q === p || !own[q]) continue;
      if (own[q] !== k) {
        // The trees may not close before their time.
        if (P.tau < TG - 0.25) return false;
        other = q;
      } else if (abs((q & 63) - px) > 1 || abs((q >> 6) - py) > 1) return false;
    }
  add(P, c, p, k, tw);
  if (other >= 0) (P.meet = c), (P.meetQ = other);
  return true;
}

function add(P, c, p, k, tw) {
  const { cnt, par } = P, y = c >> 6, x = c & 63;
  (P.own[c] = k), (P.twg[c] = tw), (par[c] = p), (cnt[c] = P.ht[c] = P.chr[c] = 1), (P.born[c] = P.time), (P.phi[c] = k - 1);
  P.fr[k - 1] = k === 1 ? max(P.fr[0], y) : min(P.fr[1], y);
  scorch(P, x, y, 1, 0.04);
  P.ring[P.nr++ & 511] = c;
  P.cells[k - 1][P.ncell[k - 1]++] = c;
  if (!tw) P.nsk[k - 1]++;
  // The current that feeds every cell beyond reaches it through all the
  // cells back to the electrode, and the busiest burn into wide grooves.
  for (let a = p; a >= 0; a = par[a]) {
    const w = WIDE.indexOf(++cnt[a]);
    if (w >= 0) {
      const ax = a & 63, ay = a >> 6, r = 1 + 0.6 * w;
      scorch(P, ax, ay, r, w ? 0.9 : 0.7, 1);
      scorch(P, ax, ay, r + 2, 0.35);
    }
  }
}

// With burn set, char a groove of radius r round (x, y), still warm;
// without, brown the wood within r by v, less towards the edge.
function scorch(P, x, y, r, v, burn) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const qx = x + dx, qy = y + dy, d2 = dx * dx + dy * dy, q = qy * W + qx;
      if (d2 > r * r || qx < X0 || qx > X1 || qy < Y0 || qy > Y1) continue;
      if (!burn) P.sco[q] = min(1, P.sco[q] + v * (1 - d2 / (r * r + 1)));
      else (P.chr[q] = max(P.chr[q], v)), (P.ht[q] = max(P.ht[q], 0.5 * v));
    }
}

function grow(P, d) {
  relax(P, 3);
  // Each tree has a front it should have reached by now, eased in so the
  // growth speeds up as the trees close (a hard pull sends leaders racing
  // out at once), and a cell budget that rises steeply when it lags.
  const s = min(1, P.tau / TG) ** (1.35 - 0.15 * P.eta), late = max(0, P.tau - TG);
  const lag = [TY + (P.ym - TY) * s - P.fr[0], P.fr[1] - (BY - (BY - P.ym) * s)];
  // The leading electrode's tree takes the larger share of the front's
  // cells; fringe twigs sprout as fast as there is channel to carry them,
  // fewer the harder the pull.
  for (let k = 0; k < 2; k++) {
    const f = exp(cl(lag[k] / 6, -2, 2.5)), sh = 1 + (k ? 0.85 : -0.85) * P.lead;
    P.acc[k] += d * RATE * sh * f * (1 + 4 * late);
    P.tac[k] += d * TWIG * P.nsk[k] * ((4.5 - P.eta) / 3.5) ** 2;
  }
  twigs(P);
  if (P.acc[0] < 1 && P.acc[1] < 1 && P.tac[0] < 1 && P.tac[1] < 1) return;
  scan(P, P.eta + 2 * late);
  for (let k = 0; k < 2; k++) {
    const n = min(120, floor(P.acc[k])), C = P.cand[k], S = P.cw[k], m = P.nc[k];
    P.acc[k] -= n;
    if (!m) continue;
    const tot = S[m - 1];
    for (let t = 0, tries = 0; t < n && tries < 3 * n; tries++) {
      const r = rnd() * tot;
      let lo = 0;
      for (let hi = m - 1, mid; lo < hi; ) (mid = (lo + hi) >> 1), S[mid] < r ? (lo = mid + 1) : (hi = mid);
      if (join(P, C[lo], k + 1)) t++;
      if (P.meet >= 0) return;
    }
  }
  // A fringe twig sprouts off a burnt channel, an eighth of a turn off it
  // or now and then a quarter, and runs a few LEDs, bending as it goes. A
  // twig sprouts shorter twigs of its own, three generations deep.
  for (let tries = 0, k = 0; tries < 300; tries++) {
    if (P.tac[k] < 1) k = 1 - k;
    if (P.tac[k] < 1) break;
    const a = P.cells[k][floor(rnd() * P.ncell[k])], g = P.twg[a];
    if (P.par[a] < 0 || g > 2 || rnd() > GEN[g]) continue;
    // The branch's way here, read over four cells so one step cannot throw it.
    let b = a;
    for (let n = 0; n < 4 && P.par[b] >= 0; n++) b = P.par[b];
    const j = round((Math.atan2((a >> 6) - (b >> 6), (a & 63) - (b & 63)) * 4) / Math.PI) & 7;
    const dir = (j + (rnd() < 0.5 ? 1 : 7) * (rnd() < 0.85 ? 1 : 2)) & 7;
    const x = (a & 63) + DIRS[dir][0], y = (a >> 6) + DIRS[dir][1], c = y * W + x;
    if (x < X0 || x > X1 || y < Y0 || y > Y1 || !join(P, c, k + 1, g + 1)) continue;
    P.tac[k]--;
    if (P.meet >= 0) return;
    Object.assign(P.tw[P.ntw++ & 255], { c, d0: dir, dir, k: k + 1, g: g + 1, left: LEN[g] + floor(rnd() * LEN[g]) });
  }
  P.tac = P.tac.map((v) => min(v, 4));
}

function twigs(P) {
  for (const t of P.tw) {
    if (t.left <= 0) continue;
    t.left--;
    // A twig wanders an eighth of a turn, never further off its way.
    if (rnd() < 0.25) {
      const dir = (t.dir + (rnd() < 0.5 ? 1 : 7)) & 7, off = (dir - t.d0 + 8) & 7;
      if (off <= 1 || off >= 7) t.dir = dir;
    }
    const x = (t.c & 63) + DIRS[t.dir][0], y = (t.c >> 6) + DIRS[t.dir][1], c = y * W + x;
    if (x < X0 || x > X1 || y < Y0 || y > Y1 || !join(P, c, t.k, t.g)) {
      t.left = 0;
      continue;
    }
    t.c = c;
    if (P.meet >= 0) return;
  }
}

// The joined path, from the top electrode to the bottom one.
function trace(P) {
  const top = P.own[P.meet] === 1 ? P.meet : P.meetQ, bot = top === P.meet ? P.meetQ : P.meet;
  let n = 0;
  for (let a = top; a >= 0; a = P.par[a]) P.path[n++] = a;
  P.path.subarray(0, n).reverse();
  for (let a = bot; a >= 0; a = P.par[a]) P.path[n++] = a;
  P.np = n;
  for (let j = 0; j < n; j++) {
    const a = P.path[j], x = a & 63, y = a >> 6;
    scorch(P, x, y, 2, 1, 1);
    scorch(P, x, y, 4, 0.5);
    P.ht[a] = 1;
  }
}

function go(P, ph) {
  (P.ph = ph), (P.pt = 0);
  if (ph === 1) P.power = 1;
  if (ph === 2) trace(P), (P.flash = 1);
  if (ph > 2) P.power = 0;
  if (ph === 0) ([P.wa, P.wb] = [P.wb, P.wa]), fresh(P);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 1, 0.06];
  const d = (cl(dt || 0, 0, 0.1) * cl(k[1], 0.2, 3)) / 2;
  (P.wood = cl(k[0], 0, 1)), (P.eta = cl(k[2], 1, 4)), (P.lead = cl(k[3], -1, 1));
  P.ym = (TY + BY) / 2 - 44 * P.lead;
  (P.time += d), (P.pt += d);
  if (input.btnPressed && input.btnPressed[0] && P.ph > 0 && P.ph < 4) go(P, 4);
  const ph = P.ph;
  if (ph === 0 && P.pt >= SOAK) go(P, 1);
  else if (ph === 1) {
    P.tau += d;
    grow(P, d);
    // A board the trees cannot cross trips the breaker without an arc.
    if (P.meet >= 0) go(P, 2);
    else if (P.tau > TG + 3) go(P, 3);
  } else if (ph === 2) {
    // The arc keeps its path white hot.
    for (let j = 0; j < P.np; j++) P.ht[P.path[j]] = 1;
    if (P.pt >= ARC) go(P, 3);
  } else if (ph === 3 && P.pt >= COOL) go(P, 4);
  else if (ph === 4 && P.pt >= SLIDE) go(P, 0), (P.wb = wood());
  P.flash = max(0, P.flash - d * 9);
  heat(P, d), smoke(P, d);
}

// Embers: fresh channels glow and cool to char, while the power is on the
// busy trunks stay hot, and anything hot browns the wood round it.
function heat(P, d) {
  const { ht, own, cnt, sco, hot } = P, dec = exp(-d / (P.power ? 0.3 : 0.9));
  let sum = 0, nh = 0;
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      const i = y * W + x;
      let h = ht[i];
      if (h < 0.004 && !own[i]) continue;
      h *= dec;
      if (P.power && own[i] && cnt[i] > 24) h = max(h, min(0.6, 0.12 * (log2(cnt[i]) - 3.5)) * (0.85 + 0.15 * rnd()));
      ht[i] = h;
      if (h > 0.2 && (cnt[i] > 12 || !own[i])) {
        sum += h;
        for (const o of N4) sco[i + o] = min(1, sco[i + o] + d * h * 0.3);
        if (nh < 32) hot[nh++] = i;
        else if (rnd() < 0.05) hot[floor(rnd() * 32)] = i;
      }
    }
  P.nh = nh;
  P.heatSum = sum;
}

// Smoke puffs rise off the hot channels, spread and thin out.
function smoke(P, d) {
  let want = (P.ph === 4 ? 0 : P.heatSum) * d * 0.22;
  for (const s of P.puffs) {
    if (s.on) {
      if ((s.age += d) > s.life) {
        s.on = 0;
        continue;
      }
      s.x += (s.vx + 3 * sin(s.age * 2.3 + s.y * 0.1)) * d;
      s.y += s.vy * d;
      s.r += d * 1.6;
      continue;
    }
    if (want > rnd() && P.nh) {
      const i = P.hot[floor(rnd() * P.nh)];
      Object.assign(s, { on: 1, x: i & 63, y: i >> 6, vx: (rnd() - 0.5) * 4, vy: -8 - rnd() * 8, r: 1, a: 0.16 + rnd() * 0.16, age: 0, life: 2.5 + rnd() * 2 });
      want -= 1;
    }
  }
}

// Plasma at (x, y): how strongly it covers each LED round it.
function plasma(L, x, y, r, v) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const qx = x + dx, qy = y + dy, d2 = dx * dx + dy * dy;
      if (qx >= 0 && qx < W && qy >= 0 && qy < H && d2 <= r * r) L[qy * W + qx] += v / (1 + d2 * 2.5);
    }
}

// Ember colour by heat: dull red, orange, then yellow-white.
const EK = [0, 0.25, 0.6, 1], EC = [[0, 0, 0], [175, 35, 6], [255, 110, 20], [255, 220, 140]];
function ember(h, out) {
  const j = h < 0.25 ? 0 : h < 0.6 ? 1 : 2, t = (min(h, 1) - EK[j]) / (EK[j + 1] - EK[j]);
  for (let c = 0; c < 3; c++) out[c] = EC[j][c] + (EC[j + 1][c] - EC[j][c]) * t;
}

const EM = [0, 0, 0];

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { own, chr, sco, ht, born, pl, sm } = P;
  pl.fill(0);
  sm.fill(0);
  if (P.wa.at !== P.wood) paint(P.wa, P.wood);
  if (P.ph === 4 && P.wb.at !== P.wood) paint(P.wb, P.wood);
  const off = P.ph === 4 ? SL * (1 - (1 + Math.cos((Math.PI * min(1, P.pt / SLIDE)))) / 2) : 0, oy = round(off);

  // Plasma at the tips, and short streamers crackling ahead of them.
  if (P.power) {
    for (let j = 0; j < 512 && j < P.nr; j++) {
      const c = P.ring[(P.nr - 1 - j) & 511], age = P.time - born[c];
      if (age > TIP) break;
      // Twigs behind the front only flash orange.
      if (P.twg[c] && (own[c] === 1 ? (c >> 6) < P.fr[0] - 14 : (c >> 6) > P.fr[1] + 14)) continue;
      const f = (1 - age / TIP) * (0.5 + 0.5 * rnd()), x = c & 63, y = (c >> 6) + oy;
      plasma(pl, x, y, 1.5, f);
      if (rnd() < 0.2)
        for (let st = 0, sx = x, sy = y, len = 2 + floor(rnd() * 5); st < len; st++) {
          if (rnd() < 0.6) sy += own[c] === 1 ? 1 : -1;
          else sx += rnd() < 0.5 ? -1 : 1;
          if (sx < 0 || sx >= W || sy < 0 || sy >= H) break;
          pl[sy * W + sx] += 0.9 - st * 0.12;
        }
    }
    // A blue corona at each electrode.
    const z = 0.4 + 0.4 * rnd();
    plasma(pl, TX, TY + oy, 2.5, z);
    plasma(pl, BX, BY + oy, 2.5, z);
  }
  // The arc down the joined path, flickering sideways.
  if (P.ph === 2) {
    const f = (1 - 0.6 * (P.pt / ARC)) * (0.7 + 0.3 * rnd()), seed = rnd() * 99;
    for (let j = 0; j < P.np; j++) {
      const a = P.path[j], x = (a & 63) + round(1.6 * (vn(j * 0.3, seed) - 0.5)), y = a >> 6;
      if (j % 2 === 0) plasma(pl, x, y, 3.5, 0.35 * f);
      pl[y * W + x] += 3 * f;
    }
  }
  for (const s of P.puffs) {
    if (!s.on) continue;
    // A wisp, twice as tall as it is wide.
    const a = s.a * sin((Math.PI * s.age) / s.life), R = Math.ceil(s.r), R2 = 2 * R;
    for (let dy = -R2; dy <= R2; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const qx = round(s.x) + dx, qy = round(s.y) + dy, d2 = (dx * dx + dy * dy * 0.25) / (s.r * s.r);
        if (qx < 0 || qx >= W || qy < 0 || qy >= H || d2 >= 1) continue;
        sm[qy * W + qx] += a * (1 - d2) * (1 - d2);
      }
  }

  const fl = P.flash * 70, CH = P.wa.ch, dry = P.ph > 1 ? 1 : P.ph ? P.tau / (TG + 0.5) : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let r, g, b;
      // Which board, if any, is under this LED.
      let yb = y - oy, B = P.wa, burnt = 1;
      if (P.ph === 4 && yb < Y0) (yb += SL), (B = P.wb), (burnt = 0);
      if (x >= X0 && x <= X1 && yb >= Y0 && yb <= Y1) {
        const i = yb * W + x, C = B.col;
        // The wet wash glosses the wood; the current steams it off the whole
        // board and the burn dries it at once.
        const s = burnt ? sco[i] : 0, lf = 0.86 + 0.28 * B.wet[i] * max(0, 1 - 3 * s - (burnt ? dry : 0));
        (r = C[i * 3] * lf), (g = C[i * 3 + 1] * lf), (b = C[i * 3 + 2] * lf);
        if (burnt) {
          if (s > 0) (r *= 1 - 0.5 * s), (g *= 1 - 0.66 * s), (b *= 1 - 0.8 * s);
          const c = chr[i];
          if (c > 0) (r += (CH[0] - r) * c), (g += (CH[1] - g) * c), (b += (CH[2] - b) * c);
          const h = ht[i];
          if (h > 0.02 && c > 0.3) {
            // Thick char glows only along its rim.
            const rim = (x > X0 && chr[i - 1] < 0.5) || (x < X1 && chr[i + 1] < 0.5) || chr[i - W] < 0.5 || chr[i + W] < 0.5;
            ember(h * (rim ? 1 : 0.45), EM);
            (r = max(r, EM[0])), (g = max(g, EM[1])), (b = max(b, EM[2]));
          }
        }
        (r += fl), (g += fl), (b += fl * 1.2);
      } else {
        // The dark rig behind, with the board's shadow to its right.
        const sh = x > X1 ? 0.55 : 1, q = hash(x, y);
        (r = (RIG[0] + 6 * q) * sh), (g = (RIG[1] + 6 * hash(y, x)) * sh), (b = (RIG[2] + 6 * q) * sh);
        if (x === 0 || x === 63) (r = 64 + 10 * q), (g = 66 + 10 * q), (b = 74 + 10 * q);
      }
      const m = min(0.7, sm[p]);
      (r += (SMOKE[0] - r) * m), (g += (SMOKE[1] - g) * m), (b += (SMOKE[2] - b) * m);
      // Plasma: deep blue where it is thin, blue-white where it is thick.
      const t = pl[p];
      if (t > 0.01) {
        const u = min(1, t), w = min(1, t / 2.5);
        (r += (90 + 160 * w - r) * u), (g += (120 + 130 * w - g) * u), (b += (255 - b) * u);
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  electrodes(display, P);
}

// Brass clamps with their tips on the board, the red lead in from the top
// and the black one from the bottom.
function electrodes(display, P) {
  for (let e = 0; e < 2; e++) {
    const cx = e ? BX : TX, s = e ? -1 : 1, y0 = e ? H - 1 : 0, lead = e ? [[96, 98, 110], [36, 36, 42]] : [[236, 84, 64], [172, 28, 22]];
    for (let j = 0; j <= 8; j++)
      for (let dx = -3; dx <= 3; dx++) {
        const lit = j === 4 || dx === -3, dark = j === 7 || dx === 3;
        let c = null;
        if (j <= 3 && abs(dx) <= 1) c = lead[dx < 0 ? 0 : 1];
        else if (j >= 4 && j <= 7) c = lit ? [236, 200, 110] : dark ? [130, 96, 40] : [196, 156, 70];
        else if (j === 8 && !dx) c = P.power ? [210, 220, 255] : [240, 214, 130];
        if (c) display.setPixel(cx + dx, y0 + s * j, c[0], c[1], c[2]);
      }
  }
}
