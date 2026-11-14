// ===== Patternflow pattern =====
// Title:   Pigment Flocs
// Family:  cosmetic
// Idea:    Fine shimmer pigment in a tinted base keeps sticking into lacy flocs that glint as they turn, while a slow stir that never comes round the same way twice tears the big ones apart and rubs dust off their loose ends.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: diffusion-limited cluster-cluster aggregation (Paul Meakin, 1983; Max Kolb, Rémi Botet and Rémi Jullien, 1983) with shear breakup and erosion of flocs past a critical stress, after the pigment in a cushion foundation or an ink tint before it is shaken
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stir=0.2..3, Load=-1..1, Stick=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel; at 0 the base is an orchid tint, the pigment a rose pearl and the glints a champagne white. Where it turns the base toward orange the base is lifted to a sand beige, since a dark orange reads brown on the panel.
// Knob 2: Stir. The stir's rms speed, 2.2 LEDs a second at 0.2, 4.3 at the opening 2 and 5.5 at 3, and with it the shear that tears flocs: the largest floc on the panel holds about 130 particles at 0.2, 70 at 2 and 60 at 3.
// Knob 3: Load. How much pigment is in the base: 10 percent of the LEDs at -1, 14 at the opening and 20 at 1. More pigment meets more often, so the flocs grow larger and at 1 the lace nearly joins up across the panel.
// Knob 4: Stick. The chance that two pieces stick when they touch, 0.31 at -1, 0.55 at the opening and 0.99 at 1. Weak bonds also let loose ends fold in and fall off more often, so at -1 the flocs settle into compact clumps in a haze of dust and at 1 every touch holds and they grow open and lacy.

const W = 64, H = 128, NS = W * H;
const PMAX = 2048;
const { floor, sqrt, sin, cos, exp, log, atan2, max, min, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * log(Math.random() + 1e-12)) * cos(TAU * Math.random());
const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

// The stir: a stream function on the 64 by 128 torus, a sum of ten waves whose
// wave vectors fit the torus, so the flow wraps with the panel. Each phase runs
// at its own random rate and wanders, each amplitude breathes, so the field
// never comes back to a state it had. It is prescribed, not solved: the
// pigment does not push back on the base.
const MODES = [[1, 0], [0, 1], [1, 1], [1, -1], [0, 2], [1, 2], [1, -2], [2, 1], [2, -1], [0, 3]];
const NM = MODES.length;

// Mobility. A cluster of s particles hops one LED in a random direction at
// HOP s^-MOB hops a second (a monomer HOP), and turns with a rotational
// diffusion of ROT s^-1.5, so dust twinkles and a big floc turns slowly.
const HOP = 26, MOB = 0.65, ROT = 6;
// Breakup. A cluster with radius of gyration Rg in a strain rate g feels a
// stress (g + G0) Rg^2. It splits across its stretching axis at a rate
// KB (stress / SIG)^4 a second, and a particle that hangs on by one bond
// erodes off at KT 4^-Stick + KE (stress / SIG)^2 a second, or folds in
// toward its cluster at 0.12 5^-Stick a second.
const G0 = 0.05, SIG = 8, KB = 0.7, KE = 0.15, KT = 0.08;
const COOL = 0.5, VSEP = 3.2; // a fresh fragment sticks to nothing for COOL s and is pushed apart at VSEP LEDs a second
const SUB = 1 / 120; // largest substep, seconds

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const I = () => new Int32Array(PMAX), F = () => new Float64Array(PMAX);
  const S = {
    occ: new Int32Array(NS),
    px: I(), py: I(), ox: I(), oy: I(), pc: I(), mark: I(), side: new Uint8Array(PMAX), facet: new Float32Array(PMAX), n: 0, stamp: 0,
    mem: new Array(PMAX).fill(null), alive: new Uint8Array(PMAX), live: [], free: [],
    ax: F(), ay: F(), kx: F(), ky: F(), cool: F(), th: F(), fu: F(), fv: F(), str: F(),
    kxm: new Float64Array(NM), kym: new Float64Array(NM), ph: new Float64Array(NM), om: new Float64Array(NM), wn: new Float64Array(NM), wp: new Float64Array(NM), bn: new Float64Array(NM), bp: new Float64Array(NM),
    a: new Float64Array(NM), p: new Float64Array(NM),
    sx: new Float64Array(NM * W), cx: new Float64Array(NM * W), sy: new Float64Array(NM * H), cy: new Float64Array(NM * H),
    dens: new Float32Array(NS), tmp: new Float32Array(NS), halo: new Float32Array(NS), cloud: new Float32Array(NS), psi: new Float32Array(NS), fb: new Float32Array(NS * 3),
    t: 0, T: 0, lt: 0, warm: false, hue: 0, stir: 2, load: 0, stick: 0.06, light: 0, lw: [0, 0, 0], lp: [0, 0, 0], c: new Float32Array(12),
  };
  for (let i = PMAX - 1; i >= 0; i--) S.free.push(i);
  for (let j = 0; j < NM; j++) {
    S.kxm[j] = (TAU * MODES[j][0]) / W;
    S.kym[j] = (TAU * MODES[j][1]) / H;
    S.ph[j] = TAU * Math.random();
    S.om[j] = (0.05 + 0.11 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    S.wn[j] = 0.013 + 0.03 * Math.random();
    S.wp[j] = TAU * Math.random();
    S.bn[j] = 0.017 + 0.04 * Math.random();
    S.bp[j] = TAU * Math.random();
    for (let x = 0; x < W; x++) {
      S.sx[j * W + x] = sin(S.kxm[j] * x);
      S.cx[j * W + x] = cos(S.kxm[j] * x);
    }
  }
  for (let i = 0; i < 3; i++) {
    S.lw[i] = 0.19 + 0.3 * Math.random();
    S.lp[i] = TAU * Math.random();
  }
  params.s = S;
  return S;
}

// ---- clusters ---------------------------------------------------------------------------------
// Every particle sits on one LED and belongs to one cluster. It keeps an offset
// (ox, oy) in its cluster's own unwrapped frame, so a cluster that crosses the
// edge of the torus still has a centre, a size and a stretching axis. Two
// particles of one cluster are bonded when they are neighbours on the panel and
// neighbours in that frame too.
function newCluster(S) {
  const c = S.free.pop();
  S.alive[c] = 1;
  S.mem[c] = [];
  S.ax[c] = S.ay[c] = S.kx[c] = S.ky[c] = S.cool[c] = S.fu[c] = S.fv[c] = S.str[c] = 0;
  S.th[c] = TAU * Math.random();
  S.live.push(c);
  return c;
}
function killCluster(S, c) {
  S.alive[c] = 0;
  S.mem[c] = null;
  S.free.push(c);
}
function addParticle(S, site) {
  const i = S.n++;
  S.px[i] = site % W;
  S.py[i] = (site / W) | 0;
  S.ox[i] = S.oy[i] = 0;
  S.facet[i] = TAU * Math.random();
  S.occ[site] = i + 1;
  const c = newCluster(S);
  S.mem[c].push(i);
  S.pc[i] = c;
  return i;
}
function removeParticle(S, i) {
  const c = S.pc[i], m = S.mem[c];
  S.occ[S.py[i] * W + S.px[i]] = 0;
  const k = m.indexOf(i);
  m[k] = m[m.length - 1];
  m.pop();
  if (!m.length) killCluster(S, c);
  const L = --S.n;
  if (L !== i) {
    S.px[i] = S.px[L];
    S.py[i] = S.py[L];
    S.ox[i] = S.ox[L];
    S.oy[i] = S.oy[L];
    S.pc[i] = S.pc[L];
    S.facet[i] = S.facet[L];
    S.occ[S.py[i] * W + S.px[i]] = i + 1;
    const ml = S.mem[S.pc[i]];
    ml[ml.indexOf(L)] = i;
  }
}
// Bonded neighbours of particle i.
function bonds(S, i) {
  const c = S.pc[i], x = S.px[i], y = S.py[i];
  let b = 0;
  for (let d = 0; d < 4; d++) {
    const o = S.occ[((y + DY[d] + H) % H) * W + ((x + DX[d] + W) % W)];
    if (o) {
      const j = o - 1;
      if (S.pc[j] === c && S.ox[j] - S.ox[i] === DX[d] && S.oy[j] - S.oy[i] === DY[d]) b++;
    }
  }
  return b;
}
// Particle i of one cluster touches particle j of another, j sitting at i + (dx, dy).
// The smaller cluster joins the larger, its offsets moved into the larger's frame.
function merge(S, i, j, dx, dy) {
  let a = S.pc[i], b = S.pc[j];
  if (S.mem[a].length < S.mem[b].length) {
    const t = a;
    a = b;
    b = t;
    const u = i;
    i = j;
    j = u;
    dx = -dx;
    dy = -dy;
  }
  const sx = S.ox[i] + dx - S.ox[j], sy = S.oy[i] + dy - S.oy[j], ma = S.mem[a], mb = S.mem[b];
  for (let k = 0; k < mb.length; k++) {
    const q = mb[k];
    S.ox[q] += sx;
    S.oy[q] += sy;
    S.pc[q] = a;
    ma.push(q);
  }
  killCluster(S, b);
  return a;
}
const CI = new Int32Array(16), CJ = new Int32Array(16), CD = new Int32Array(16);
// Move cluster c one LED by (dx, dy) if nothing of another cluster is in the
// way, then let it stick to what it now touches.
function tryMove(S, c, dx, dy, pstick) {
  const m = S.mem[c], occ = S.occ, px = S.px, py = S.py, pc = S.pc;
  for (let k = 0; k < m.length; k++) {
    const i = m[k], o = occ[((py[i] + dy + H) % H) * W + ((px[i] + dx + W) % W)];
    if (o && pc[o - 1] !== c) return false;
  }
  for (let k = 0; k < m.length; k++) occ[py[m[k]] * W + px[m[k]]] = 0;
  for (let k = 0; k < m.length; k++) {
    const i = m[k];
    px[i] = (px[i] + dx + W) % W;
    py[i] = (py[i] + dy + H) % H;
    occ[py[i] * W + px[i]] = i + 1;
  }
  if (S.cool[c] > 0) return true;
  let nc = 0;
  for (let k = 0; k < m.length && nc < 16; k++) {
    const i = m[k];
    for (let d = 0; d < 4; d++) {
      const o = occ[((py[i] + DY[d] + H) % H) * W + ((px[i] + DX[d] + W) % W)];
      if (!o) continue;
      const j = o - 1, e = pc[j];
      if (e === c || S.cool[e] > 0) continue;
      let seen = false;
      for (let q = 0; q < nc; q++) if (pc[CJ[q]] === e) seen = true;
      if (!seen && nc < 16) (CI[nc] = i), (CJ[nc] = j), (CD[nc] = d), nc++;
    }
  }
  for (let q = 0; q < nc; q++) {
    const i = CI[q], j = CJ[q];
    if (pc[i] === pc[j] || Math.random() >= pstick) continue;
    merge(S, i, j, DX[CD[q]], DY[CD[q]]);
  }
  return true;
}
// Cut cluster c across its stretching axis (ex, ey) near its centre, and let
// each connected piece go its own way.
function split(S, c, ex, ey, mx, my, rg) {
  const m = S.mem[c], { ox, oy, side, mark, occ, px, py, pc } = S;
  const cut = (Math.random() - 0.5) * 0.7 * rg;
  for (let k = 0; k < m.length; k++) {
    const i = m[k];
    side[i] = (ox[i] - mx) * ex + (oy[i] - my) * ey > cut ? 1 : 0;
  }
  const st = ++S.stamp, comps = [];
  for (let k = 0; k < m.length; k++) {
    const s0 = m[k];
    if (mark[s0] === st) continue;
    mark[s0] = st;
    const comp = [s0];
    for (let h = 0; h < comp.length; h++) {
      const i = comp[h];
      for (let d = 0; d < 4; d++) {
        const o = occ[((py[i] + DY[d] + H) % H) * W + ((px[i] + DX[d] + W) % W)];
        if (!o) continue;
        const j = o - 1;
        if (pc[j] === c && mark[j] !== st && side[j] === side[i] && ox[j] - ox[i] === DX[d] && oy[j] - oy[i] === DY[d]) {
          mark[j] = st;
          comp.push(j);
        }
      }
    }
    comps.push(comp);
  }
  if (comps.length < 2) return;
  let big = 0;
  for (let k = 1; k < comps.length; k++) if (comps[k].length > comps[big].length) big = k;
  for (let k = 0; k < comps.length; k++) {
    const comp = comps[k];
    let id = c;
    if (k === big) S.mem[c] = comp;
    else {
      id = newCluster(S);
      S.mem[id] = comp;
      S.th[id] = S.th[c] + 0.6 * gauss();
      for (let q = 0; q < comp.length; q++) pc[comp[q]] = id;
    }
    const sg = side[comp[0]] ? 1 : -1;
    S.kx[id] = sg * VSEP * ex;
    S.ky[id] = sg * VSEP * ey;
    S.cool[id] = COOL;
  }
}
// A particle hanging on by one bond leaves its cluster as a monomer.
function erode(S, i, c, mx, my) {
  const m = S.mem[c];
  m[m.indexOf(i)] = m[m.length - 1];
  m.pop();
  const d = newCluster(S);
  S.mem[d].push(i);
  const rx = S.ox[i] - mx, ry = S.oy[i] - my, r = sqrt(rx * rx + ry * ry) + 1e-6;
  S.pc[i] = d;
  S.ox[i] = S.oy[i] = 0;
  S.kx[d] = (2 * rx) / r;
  S.ky[d] = (2 * ry) / r;
  S.cool[d] = 2 * COOL;
}

// ---- the stir ---------------------------------------------------------------------------------
function stirModes(S) {
  const T = S.T, a = S.a, p = S.p;
  let v2 = 0;
  for (let j = 0; j < NM; j++) {
    const k = sqrt(S.kxm[j] * S.kxm[j] + S.kym[j] * S.kym[j]);
    const amp = 0.62 + 0.38 * sin(S.bn[j] * T + S.bp[j]);
    a[j] = amp / k;
    p[j] = S.ph[j] + S.om[j] * T + 1.3 * sin(S.wn[j] * T + S.wp[j]);
    v2 += 0.5 * amp * amp;
  }
  // rms speed of the stir, LEDs a second
  const U = (2 + 1.15 * S.stir) / sqrt(v2);
  for (let j = 0; j < NM; j++) a[j] *= U;
}
// Velocity, strain (stretching and shear part) and vorticity at one point.
const FL = new Float64Array(5);
function flowAt(S, x, y) {
  let u = 0, v = 0, ux = 0, uy = 0, vx = 0;
  for (let j = 0; j < NM; j++) {
    const kx = S.kxm[j], ky = S.kym[j], ph = kx * x + ky * y + S.p[j], s = sin(ph), c = cos(ph), a = S.a[j];
    u += a * ky * c;
    v -= a * kx * c;
    ux -= a * ky * kx * s;
    uy -= a * ky * ky * s;
    vx += a * kx * kx * s;
  }
  FL[0] = u;
  FL[1] = v;
  FL[2] = ux;
  FL[3] = 0.5 * (uy + vx);
  FL[4] = vx - uy;
}

// ---- one step of dt seconds -------------------------------------------------------------------
// Stir sets the stir's speed, and on top of that the shear a floc feels grows
// as (Stir / 2)^0.4, standing in for the finer eddies of a harder stir.
function advance(S, dt) {
  const stir = S.stir, shear = Math.pow(stir / 2, 0.4), pstick = 0.55 * Math.pow(1.8, S.stick), restr = 0.12 * Math.pow(5, -S.stick), kt = KT * Math.pow(4, -S.stick);
  S.T += dt * (0.6 + 0.25 * stir);
  stirModes(S);
  // load: add or take away a few particles a frame until the count matches the knob
  const target = min(PMAX - 1, Math.round(NS * 0.14 * Math.pow(1.4, S.load)));
  for (let q = 0; q < 6 && S.n < target; q++) {
    for (let tries = 0; tries < 12; tries++) {
      const site = floor(Math.random() * NS);
      if (!S.occ[site]) {
        addParticle(S, site);
        break;
      }
    }
  }
  for (let q = 0; q < 24 && S.n > target; q++) {
    const i = floor(Math.random() * S.n);
    if (S.mem[S.pc[i]].length === 1 || bonds(S, i) === 1) removeParticle(S, i);
  }
  // Per cluster: centre, size, the stir where it is, turning, breakup.
  const live = S.live;
  for (let q = 0; q < live.length; q++) {
    const c = live[q];
    if (!S.alive[c]) continue;
    const m = S.mem[c], s = m.length;
    let sx = 0, sy = 0, sxx = 0, syy = 0;
    for (let k = 0; k < s; k++) {
      const i = m[k], x = S.ox[i], y = S.oy[i];
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
    }
    const mx = sx / s, my = sy / s, rg2 = max(0, sxx / s - mx * mx + syy / s - my * my);
    const i0 = m[0];
    flowAt(S, S.px[i0] - S.ox[i0] + mx, S.py[i0] - S.oy[i0] + my);
    S.fu[c] = FL[0];
    S.fv[c] = FL[1];
    const g = sqrt(FL[2] * FL[2] + FL[3] * FL[3]);
    S.th[c] += 0.5 * FL[4] * dt + sqrt(2 * ROT * Math.pow(s, -1.5) * dt) * gauss();
    const kd = exp(-dt / 0.35);
    S.kx[c] *= kd;
    S.ky[c] *= kd;
    S.cool[c] -= dt;
    const stress = (g * shear + G0) * rg2 / SIG;
    S.str[c] = stress;
    if (s >= 4) {
      const r2 = stress * stress;
      if (Math.random() < dt * KB * r2 * r2) {
        const ang = 0.5 * atan2(FL[3], FL[2]);
        split(S, c, cos(ang), sin(ang), mx, my, sqrt(rg2));
      }
    }
  }
  // Per particle: erosion of particles on one bond, and the slow folding of
  // loose ends that makes a floc more compact the less sticky the pigment is.
  for (let i = 0; i < S.n; i++) {
    const c = S.pc[i], m = S.mem[c];
    if (m.length < 2) continue;
    const st = S.str[c], pe = dt * (kt + KE * st * st), pr = dt * restr;
    const u = Math.random();
    if (u >= pe + pr) continue;
    if (bonds(S, i) !== 1) continue;
    if (u < pe) {
      let mx = 0, my = 0;
      for (let k = 0; k < m.length; k++) (mx += S.ox[m[k]]), (my += S.oy[m[k]]);
      erode(S, i, c, mx / m.length, my / m.length);
    } else fold(S, i, c);
  }
  // The substeps: every cluster, in a fresh random order, is carried by the
  // stir and its own kick, and hops at random with its mobility.
  const ns = max(1, Math.ceil(dt / SUB - 1e-9)), h = dt / ns;
  for (let r = 0; r < ns; r++) {
    for (let q = live.length - 1; q > 0; q--) {
      const k = floor(Math.random() * (q + 1)), t = live[q];
      live[q] = live[k];
      live[k] = t;
    }
    for (let q = 0; q < live.length; q++) {
      const c = live[q];
      if (!S.alive[c]) continue;
      S.ax[c] += (S.fu[c] + S.kx[c]) * h;
      S.ay[c] += (S.fv[c] + S.ky[c]) * h;
      if (S.ax[c] >= 1 || S.ax[c] <= -1) {
        const d = S.ax[c] > 0 ? 1 : -1;
        if (tryMove(S, c, d, 0, pstick)) S.ax[c] -= d;
        else S.ax[c] *= 0.5;
      }
      if (!S.alive[c]) continue;
      if (S.ay[c] >= 1 || S.ay[c] <= -1) {
        const d = S.ay[c] > 0 ? 1 : -1;
        if (tryMove(S, c, 0, d, pstick)) S.ay[c] -= d;
        else S.ay[c] *= 0.5;
      }
      if (!S.alive[c]) continue;
      if (Math.random() < HOP * Math.pow(S.mem[c].length, -MOB) * h) {
        const d = floor(Math.random() * 4);
        tryMove(S, c, DX[d], DY[d], pstick);
      }
    }
    let w = 0;
    for (let q = 0; q < live.length; q++) if (S.alive[live[q]]) live[w++] = live[q];
    live.length = w;
  }
}
// A loose end rolls round the particle it hangs on to the empty place beside
// it that touches most of its own cluster.
function fold(S, i, c) {
  const { occ, px, py, ox, oy, pc } = S;
  let j = -1;
  for (let d = 0; d < 4; d++) {
    const o = occ[((py[i] + DY[d] + H) % H) * W + ((px[i] + DX[d] + W) % W)];
    if (o && pc[o - 1] === c && ox[o - 1] - ox[i] === DX[d] && oy[o - 1] - oy[i] === DY[d]) j = o - 1;
  }
  if (j < 0) return;
  let best = -1, bs = 1;
  for (let d = 0; d < 4; d++) {
    const tx = (px[j] + DX[d] + W) % W, ty = (py[j] + DY[d] + H) % H;
    if (occ[ty * W + tx]) continue;
    const nx = ox[j] + DX[d], ny = oy[j] + DY[d];
    let b = 0;
    for (let e = 0; e < 4; e++) {
      const o = occ[((ty + DY[e] + H) % H) * W + ((tx + DX[e] + W) % W)];
      if (o && o - 1 !== i && pc[o - 1] === c && ox[o - 1] - nx === DX[e] && oy[o - 1] - ny === DY[e]) b++;
    }
    if (b > bs || (b === bs && best >= 0 && Math.random() < 0.5)) (bs = b), (best = d);
  }
  if (best < 0) return;
  occ[py[i] * W + px[i]] = 0;
  px[i] = (px[j] + DX[best] + W) % W;
  py[i] = (py[j] + DY[best] + H) % H;
  ox[i] = ox[j] + DX[best];
  oy[i] = oy[j] + DY[best];
  occ[py[i] * W + px[i]] = i + 1;
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.stir = cl(k[1], 0.2, 3);
  S.load = cl(k[2], -1, 1);
  S.stick = cl(k[3], -1, 1);
  const ft = cl(dt || 0, 0, 0.1);
  if (!S.warm) {
    S.warm = true;
    const target = Math.round(NS * 0.14 * Math.pow(1.4, S.load));
    while (S.n < target) {
      const site = floor(Math.random() * NS);
      if (!S.occ[site]) addParticle(S, site);
    }
    // settle into the living steady state before the first frame is shown
    for (let i = 0; i < 300; i++) advance(S, 0.1);
  }
  S.t += ft;
  S.lt += ft * (0.6 + 0.2 * S.stir);
  advance(S, ft);
}

// ---- drawing ----------------------------------------------------------------------------------
function blur(src, dst, tmp, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[o + ((x + W) % W)];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = s / n;
      s += src[o + ((x + r + 1) % W)] - src[o + ((x - r + W) % W)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[((y + H) % H) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = s / n;
      s += tmp[((y + r + 1) % H) * W + x] - tmp[((y - r + H) % H) * W + x];
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { dens, tmp, halo, cloud, psi, occ } = S;
  for (let p = 0; p < NS; p++) dens[p] = occ[p] ? 1 : 0;
  blur(dens, halo, tmp, 2);
  blur(halo, dens, tmp, 2);
  blur(dens, halo, tmp, 5);
  blur(halo, cloud, tmp, 5);
  // the stream function, for a faint swirl of light in the base
  for (let j = 0; j < NM; j++) {
    const a = S.a[j], ky = S.kym[j], ph = S.p[j];
    for (let y = 0; y < H; y++) {
      S.sy[j * H + y] = a * cos(ky * y + ph);
      S.cy[j * H + y] = a * sin(ky * y + ph);
    }
  }
  let pmax = 1e-6;
  for (let j = 0; j < NM; j++) pmax += abs(S.a[j]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let j = 0; j < NM; j++) v += S.sx[j * W + x] * S.sy[j * H + y] + S.cx[j * W + x] * S.cy[j * H + y];
      psi[y * W + x] = v / pmax;
    }
  const c = S.c, hue = S.hue, fb = S.fb;
  // A dark orange base reads brown on the panel, so where the knob turns the
  // base toward orange it is lifted and softened.
  const d = abs(((0.79 + hue - 0.08) % 1 + 1.5) % 1 - 0.5), ob = max(0, 1 - d / 0.14);
  hsv(0.79 + hue, 0.34 - 0.1 * ob, 0.56 + 0.16 * ob, c, 0); // base: orchid milk
  hsv(0.88 + hue, 0.3, 0.74, c, 3); // halo round the flocs
  hsv(0.96 + hue, 0.3, 1, c, 6); // pigment: rose pearl
  hsv(0.12 + hue, 0.05, 1, c, 9); // glint: champagne white
  // The light that makes the glints also lays a broad soft sheen on the
  // glossy base, a band about 90 LEDs long that glides across it.
  S.light = 0;
  for (let i = 0; i < 3; i++) S.light += 1.3 * sin(S.lw[i] * S.lt + S.lp[i]);
  const qx = (TAU / 90) * cos(S.light), qy = (TAU / 90) * sin(S.light), qp = 0.9 * S.lt;
  for (let p = 0; p < NS; p++) {
    const lit = 0.74 + 0.16 * psi[p] + 1.1 * cloud[p] + 0.07 * cos(qx * (p % W) + qy * ((p / W) | 0) - qp), hl = sm(0.02, 0.4, dens[p]) * 0.45;
    for (let k = 0; k < 3; k++) {
      const v = c[k] * lit;
      fb[p * 3 + k] = v + (c[3 + k] - v) * hl;
    }
  }
  // A particle glints when its facet, turned with its floc, faces the light,
  // and a bright glint spills a little onto the four LEDs round it.
  for (let i = 0; i < S.n; i++) {
    const cc = S.pc[i], s = S.mem[cc].length;
    const f = cos(S.facet[i] + S.th[cc] - S.light), sh = 0.5 + 0.5 * f;
    const gl = f > 0 ? Math.pow(f, 24) : 0;
    const br = (0.92 + 0.08 * min(1, (s - 1) / 6)) * (0.82 + 0.18 * sh);
    const p = (S.py[i] * W + S.px[i]) * 3;
    for (let k = 0; k < 3; k++) fb[p + k] = c[6 + k] * br + (c[9 + k] - c[6 + k] * br) * gl;
  }
  for (let i = 0; i < S.n; i++) {
    const cc = S.pc[i], f = cos(S.facet[i] + S.th[cc] - S.light);
    if (f < 0.93) continue;
    const w = 0.25 * Math.pow(f, 24), x = S.px[i], y = S.py[i];
    for (let d = 0; d < 4; d++) {
      const q = (((y + DY[d] + H) % H) * W + ((x + DX[d] + W) % W)) * 3;
      for (let k = 0; k < 3; k++) fb[q + k] += (c[9 + k] - fb[q + k]) * w;
    }
  }
  for (let p = 0; p < NS; p++) display.setPixel(p % W, (p / W) | 0, 255 * min(1, fb[p * 3]), 255 * min(1, fb[p * 3 + 1]), 255 * min(1, fb[p * 3 + 2]));
}
