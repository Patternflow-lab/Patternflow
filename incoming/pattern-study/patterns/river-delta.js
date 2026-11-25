// ===== Patternflow pattern =====
// Title:   River Delta
// Family:  riverdelta
// Idea:    A river delta seen from above in time-lapse, building into a valley whose green walls wander and open to side bays: mouth bars split the river, channels fork out into a turquoise sea under a milky plume, old lobes turn from pale sand to green, and the view scrolls with the shoreline for ever.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: reduced-complexity delta models in which water parcels random-walk over a bed, weighted towards deeper cells and their heading, and erode or deposit by their speed (Liang, Voller and Paola 2015; Liang, Passalacqua and Lamb 2015; DeltaRCM, from memory); the shorter-route weight, crevasse, valley, land ageing and palettes are original, pattern round 245
// Round:   245
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sediment=0..4, Waves=-1..1, Flood=-1..1
//
// Knob 1: Hue. Walks round four scenes and blends neighbours; deep water stays darkest and fresh sand lightest in each. At 0 the sea is teal and navy with a turquoise shallow and the land runs from pale sand to olive to green. At 0.25 twilight: indigo sea, ice-blue to violet land. At 0.5 dry season: sea-green sea, gold to lime land. At 0.75 ice: steel-blue sea, slate land. At 1 the first scene again.
// Knob 2: Sediment. 0 to 4, opening at 2. How much sand the river carries. At 0 the supply is lean: one deep channel, a clean sea. At 2 mouth bars form, channels fork and lobes grow. At 4 the plume is thick, bars choke the channels and the shore moves down fast. The bed runs four times faster than the clock, so a lobe is built and left behind within a minute.
// Knob 3: Waves. -1 to 1, opening at 0. Which of river and sea shapes the coast. At -1 the river rules: channels run straight and far out as narrow fingers. At 1 the sea rules: it smooths the bars and the shoreline, and the channels stay pinned at their mouths.
// Knob 4: Flood. -1 to 1, opening at about 0.06. How much water the river carries: wider channels, brighter flow and more crevasses at 1, thin channels and a quiet flow at -1.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const NX = 41, NXP = NX + 2, NY = 86, S = 64 / NX;  // 41 wide plus a sink column each side, 86 deep
const NC = NXP * NY;
const CX = 21;  // the river's column
const R0 = 6;  // river rows at the top
const HB = 1.0, HC = 0.5, ZL = 0.22;  // sea floor depth, river depth, highest land
const HCMAX = 0.7;  // deepest scour
const TARGET = 80 / S;  // row of the shore
const DX = [0, -1, 1, -1, 1], DY = [1, 1, 1, 0, 0];
const UX = [0, -0.7071, 0.7071, -1, 1], UY = [1, 0.7071, 0.7071, 0, 0];
const TP = 2 * PI;
const WARP = 2.4;
const LIVE = 4;  // bed speed over the clock
const RXA = new Float32Array(NC), RYA = new Float32Array(NC);  // the way a fan opens
for (let y = 0; y < NY; y++) {
  for (let x = 0; x < NXP; x++) {
    const dx = x - CX, dy = y + 8, d = Math.sqrt(dx * dx + dy * dy);
    RXA[y * NXP + x] = dx / d;
    RYA[y * NXP + x] = dy / d;
  }
}

// ---- the bed -----------------------------------------------------------------
export function setup(params) {
  const f = (n) => new Float32Array(n);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0, tc: 0,
    z: f(NC), F: f(NC), V: f(NC), Vl: f(NC), pl: f(NC), ag: f(NC), qa: f(NC), zt: f(NC), tex: f(NC), wx: f(NC), wy: f(NC),
    D: new Float32Array(NC), WG: new Float64Array(NC),
    PP: new Float64Array(25), Fs: f(NC), fo: 0, vs: 0, grow: 0, front: 20, land: 0.5, cre: 20, frame: 0,
    ix: new Int32Array(W), tx: f(W), sup: 1, bo: 1, wv: 0, qd: 0.9,
  });
  const { z } = st;
  z.fill(-HB);
  // a first shore: the apex floodplain, with the river cut on to a mouth
  for (let y = 0; y < NY; y++) {
    for (let x = 1; x <= NX; x++) if (y < 13) z[y * NXP + x] = 0.12 + 0.08 * rnd();
    const cx = CX;
    for (let x = cx - 2; x <= cx + 2; x++) {
      if (y < 15) z[y * NXP + x] = -HC;
      else if (y < 18) z[y * NXP + x] = -0.3 - 0.05 * (y - 15);
      if (y < 18) st.F[y * NXP + x] = y < 15 ? 0.2 : 0.12;
    }
  }
  for (let y = 0; y < NY; y++) wallRow(st, y);
  for (let x = 1; x <= NX; x++) st.ag[x] = 0;
  for (let i = 0; i < NC; i++) if (z[i] > 0) st.ag[i] = 20 + 60 * rnd();
  texture(st);
  for (let x = 0; x < W; x++) {
    const g = (x + 0.5) / S - 0.5 + 1;
    const i = floor(g);
    st.ix[x] = i;
    st.tx[x] = g - i;
  }
  return st;
}

function hash(a, b) {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// the valley: high land down both sides, each edge wandering with the row it stands on (counted from the first row ever, so it
// moves with the bed), and now and then a wall opens out to a side bay.
const WZ = 0.5;
const bay = (v) => (v > 0 ? 6 * v * v * v : 0);
function wallRow(st, y) {
  const g = st.grow + y, z = st.z, ag = st.ag;
  const lo = 4.2 + 2.2 * sin(g / 9.1 + 1.3) + 1.2 * sin(g / 3.7 + 2.1) + 1.0 * sin(g / 17.9 + 5.3) - bay(sin(g / 17.1 + 0.3));
  const hi = NX - 3.2 + 2.2 * sin(g / 10.7 + 3.9) + 1.2 * sin(g / 3.3 + 0.4) + 1.0 * sin(g / 21.3 + 1.7) + bay(sin(g / 19.7 + 3.9));
  for (let x = 1; x <= NX; x++) {
    const i = y * NXP + x;
    if (x - 0.5 < lo || x - 0.5 > hi) {
      z[i] = WZ;
      ag[i] = 90 + 40 * rnd() + (NY - 1 - y) * 1.5;  // olive where the row is new, greener up the panel
    }
  }
}
function texture(st) {
  const { tex, wx, wy, grow } = st;
  for (let y = 0; y < NY; y++) {
    const g = y + grow;
    for (let x = 0; x < NXP; x++) {
      const i = y * NXP + x;
      tex[i] = 0.55 * vnoise(x / 4.1 + 5, g / 4.1 + 9) + 0.45 * vnoise(x / 2.1, g / 2.1);
      // a smooth warp fixed to the bed: it bends the grid's straight edges when drawn
      wx[i] = WARP * (1.4 * vnoise(x / 7.3 + 21, g / 7.3 + 4) + 0.6 * vnoise(x / 3.4 + 13, g / 3.4 + 8) - 1);
      wy[i] = WARP * (1.4 * vnoise(x / 7.9 + 8, g / 7.9 + 29) + 0.6 * vnoise(x / 3.1 + 40, g / 3.1 + 2) - 1);
    }
  }
}

// ---- the flow ----------------------------------------------------------------
// Distance to the open sea through the bed (water 1 a cell, low land 3.5): a parcel is drawn along the shorter way out, so a
// long channel loses its flow to a short one.
function potential(st) {
  const { D, z } = st;
  for (let i = 0; i < NC; i++) D[i] = z[i] < -HB + 0.06 ? 0 : 1e4;
  for (let pass = 0; pass < 4; pass++) {
    const d = pass & 1 ? 1 : -1;  // the rows and columns already visited lie this way
    for (let yy = 0; yy < NY; yy++) {
      const y = d < 0 ? yy : NY - 1 - yy, ok = y + d >= 0 && y + d < NY;
      for (let xx = 1; xx <= NX; xx++) {
        const i = y * NXP + (d < 0 ? xx : NX + 1 - xx), c = z[i] < -0.04 ? 1 : 3.5;
        let b = D[i], v = D[i + d] + c;
        if (v < b) b = v;
        if (ok) {
          const j = i + d * NXP;
          v = D[j] + c;
          if (v < b) b = v;
          v = D[j - 1] + c * 1.414;
          if (v < b) b = v;
          v = D[j + 1] + c * 1.414;
          if (v < b) b = v;
        }
        D[i] = b;
      }
    }
  }
}

function weights(st, theta, lam) {
  const { z, D, WG } = st;
  for (let i = 0; i < NC; i++) {
    const zi = z[i], h = -zi;
    let g;
    if (h > 0.04) g = pow(h > HB ? HB : h, theta);
    else if (zi < ZL + 0.08) { const q = 1 - (zi > 0 ? zi : 0) / (ZL + 0.08); g = 0.01 * q * q; }
    else g = 0;
    WG[i] = g * exp(-lam * D[i]);
  }
}

function parcels(st, P, A) {
  const { z, V, Vl, WG, PP } = st, F = st.Fs;
  const QD = st.qd, UC = 0.38 * (1 - 0.15 * max(0, -st.wv)), KE = 4e-5 * A * (500 / P), KD = (0.2 + 0.1 * max(0, -st.wv)), SHB = 3, LAT = 0.22 - 0.12 * max(0, -st.wv) + 0.06 * max(0, st.wv), LAT2 = 0.10 - 0.08 * max(0, -st.wv) + 0.06 * max(0, st.wv);
  const L0 = (1.2 * st.sup * st.bo * A * min(1, st.frame / 90)) / P, FN0 = 0.5 * L0, PN = 1 / (L0 + FN0);
  const MAXS = NY * 2, OPEN = 1.8, FB = 1.5 + 0.5 * max(0, st.wv);
  const DEEP = HB - 0.06, cx0 = CX;
  for (let p = 0; p < P; p++) {
    const pb = 0.2 * (rnd() * 2 - 1), fL = 1 - pb, fR = 1 + pb;
    let x = cx0 - 2 + ((rnd() * 5) | 0), y = 0, pv = 0, load = L0, fine = FN0, tail = 0, steps = 0;
    while (y < NY - 1 && x > 0 && x < NXP - 1 && steps < MAXS) {
      steps++;
      const idx = y * NXP + x;
      if (tail === 0) {
        V[idx] += 1;
        const zi = z[idx], h = -zi, hh = h < 0.12 ? 0.12 : h;
        const r = (F[idx] * QD) / (hh * (zi > 0 ? UC * (1 + 11.4 * zi) : UC));
        if (r < 1) {
          let d = load * KD * (1 - r);
          if (h < 0.3) d *= 1 + (0.3 - h) * SHB * 1.7;
          if (d > load) d = load;
          load -= d;
          if (h > 0.2 && x > 2 && x < NX - 1) {
            // sand settles a few cells either side: a bar wider than its channel
            const d1 = d * LAT, d2 = d * LAT2;
            d -= 2 * (d1 + d2);
            const a = z[idx - 1] + d1, b = z[idx + 1] + d1, c2 = z[idx - 2] + d2, e2 = z[idx + 2] + d2;
            if (z[idx - 1] < ZL) z[idx - 1] = a > ZL ? ZL : a;
            if (z[idx + 1] < ZL) z[idx + 1] = b > ZL ? ZL : b;
            if (z[idx - 2] < ZL) z[idx - 2] = c2 > ZL ? ZL : c2;
            if (z[idx + 2] < ZL) z[idx + 2] = e2 > ZL ? ZL : e2;
          }
          const nz = zi + d;
          z[idx] = nz > ZL ? ZL : nz;
        } else if (zi > -HCMAX) {
          const e = KE * (r > 4 ? 3 : r - 1);
          z[idx] = zi - e;
          load += e;
        }
        Vl[idx] += (load + fine) * PN;
        fine *= 0.975;
        if (h > DEEP) {
          // at the delta front most of what is left settles
          const sd = load * 0.85, d3 = sd * 0.25;
          load -= sd;
          z[idx] += sd - 2 * d3;
          if (z[idx - 1] < ZL) z[idx - 1] += d3;
          if (z[idx + 1] < ZL) z[idx + 1] += d3;
          tail = 6 + ((rnd() * 14) | 0);
        }
      } else {
        // the plume goes on past the front, a different length for each parcel, fading
        Vl[idx] += (load + fine) * PN;
        fine *= 0.9;
        if (--tail <= 0) break;
      }
      const j0 = idx + NXP, o = pv * 5;
      const g0 = WG[j0], g1 = WG[j0 - 1], g2 = WG[j0 + 1], g3 = WG[idx - 1], g4 = WG[idx + 1];
      // in open water a jet spreads
      const op = g0 > 0.05 * WG[idx] && g1 > 0.05 * WG[idx] && g2 > 0.05 * WG[idx] && g3 > 0 && g4 > 0 && z[idx] < -0.12 && z[j0 - 1] < -0.12 && z[j0 + 1] < -0.12 && z[idx - 1] < -0.12 && z[idx + 1] < -0.12 ? OPEN : 1;
      const rx = RXA[idx], ry = RYA[idx];
      let f0 = FB + ry, f1 = FB + 0.7071 * (ry - rx), f2 = FB + 0.7071 * (ry + rx), f3 = FB - rx, f4 = FB + rx;
      if (f0 < 0.02) f0 = 0.02;
      if (f1 < 0.02) f1 = 0.02;
      if (f2 < 0.02) f2 = 0.02;
      if (f3 < 0.02) f3 = 0.02;
      if (f4 < 0.02) f4 = 0.02;
      const w0 = g0 * PP[o] * f0, w1 = g1 * PP[o + 1] * op * f1 * fL, w2 = g2 * PP[o + 2] * op * f2 * fR, w3 = g3 * PP[o + 3] * op * op * f3 * fL, w4 = g4 * PP[o + 4] * op * op * f4 * fR;
      const tot = w0 + w1 + w2 + w3 + w4;
      if (!(tot > 0)) {
        if (tail === 0) {
          const nz = z[idx] + load;
          z[idx] = nz > ZL ? ZL : nz;
        }
        break;
      }
      let r2 = rnd() * tot, k;
      if ((r2 -= w0) < 0) k = 0;
      else if ((r2 -= w1) < 0) k = 1;
      else if ((r2 -= w2) < 0) k = 2;
      else if ((r2 -= w3) < 0) k = 3;
      else k = 4;
      x += DX[k];
      y += DY[k];
      pv = k;
    }
  }
}

function persistence(st, pers, base) {
  const { PP } = st;
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      const c = UX[a] * UX[b] + UY[a] * UY[b];
      PP[a * 5 + b] = base + (c > 0 ? pow(c, pers) : 0);
    }
  }
}

// ---- one step of the world -----------------------------------------------------
function forceRiver(st) {
  const { z } = st;
  for (let y = 0; y <= R0; y++) {
    const cx = CX;
    for (let x = 1; x <= NX; x++) {
      const i = y * NXP + x;
      if (abs(x - cx) <= 2) { z[i] = -HC; st.ag[i] = 0; }
      else if (z[i] < WZ - 0.01) { z[i] = ZL; if (st.ag[i] < 60) st.ag[i] = 60 + 60 * st.tex[i]; }
    }
  }
  for (let y = 0; y < NY; y++) {
    z[y * NXP] = -HB;
    z[y * NXP + NXP - 1] = -HB;
  }
}

function sim(st, dt, A) {
  const kk = 1 - exp(-dt / 1.1);
  for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * kk;
  const k = st.ks;
  st.t += dt * A;
  st.tc += dt;
  st.frame++;
  const wv = cl(k[2], -1, 1), rv = max(0, -wv), wp = max(0, wv);
  st.wv = wv;
  st.sup = 0.3 + 0.7 * cl(k[1], 0, 4) / 2;
  st.qd = 0.85 * pow(1.8, cl(k[3], -1, 1));
  persistence(st, 1.6 + 2.2 * rv - 1.0 * wp, 0.2 + 0.35 * wp - 0.1 * rv);
  potential(st);
  weights(st, 1.5 + 0.6 * rv - 0.4 * wp, 0.14 + 0.06 * rv);
  const P = A > 1 ? 330 : 480;
  {
    // a cell feels half its own flow and half its neighbours', so a one-cell scour widens
    const { F: Fa, Fs } = st;
    for (let y = 1; y < NY - 1; y++) {
      for (let x = 1; x <= NX; x++) {
        const i = y * NXP + x;
        const bl = (4 * Fa[i] + 2 * (Fa[i - 1] + Fa[i + 1] + Fa[i - NXP] + Fa[i + NXP]) + Fa[i - NXP - 1] + Fa[i - NXP + 1] + Fa[i + NXP - 1] + Fa[i + NXP + 1]) * 0.0625;
        Fs[i] = 0.5 * Fa[i] + 0.5 * bl;
      }
    }
  }
  parcels(st, P, A);
  const { z, F, V, Vl, pl, ag, qa, zt } = st;
  const aF = 0.18, inv = 1 / P;
  for (let i = 0; i < NC; i++) {
    F[i] += aF * (V[i] * inv - F[i]);
    V[i] = 0;
  }
  for (let i = 0; i < NC; i++) {
    pl[i] += 0.12 * (Vl[i] * inv - pl[i]);
    Vl[i] = 0;
  }
  for (let y = 1; y < NY - 1; y++) {
    for (let x = 1; x <= NX; x++) {
      const i = y * NXP + x;
      zt[i] = 0.5 * pl[i] + 0.125 * (pl[i - 1] + pl[i + 1] + pl[i - NXP] + pl[i + NXP]);
    }
  }
  for (let y = 1; y < NY - 1; y++) for (let x = 1; x <= NX; x++) pl[y * NXP + x] = zt[y * NXP + x];
  const sg = 0.0007 * A * dt * cl(pow(st.land / 0.5, 3), 0.25, 3) * (0.6 + 0.4 * st.sup);
  for (let i = 0; i < NC; i++) if (z[i] > -HB + 0.02 && z[i] < WZ - 0.01) z[i] -= sg * (z[i] > 0 ? 1 : 0.5);
  // the shallows creep, and waves (the third knob) make them creep harder
  {
    const kw = min(0.2, (0.006 + 0.06 * wp) * A), Fs = st.Fs, zlo = -0.4 - 0.2 * wp, zhi = 0.06 + 0.1 * wp, zfl = -HB - 0.02;
    for (let y = R0 + 1; y < NY - 1; y++) {
      for (let x = 1; x <= NX; x++) {
        const i = y * NXP + x, zi = z[i];
        if (Fs[i] > 0.012 || zi < zfl || zi > zhi) continue;
        let j = i + 1, zj = z[j];
        if (x < NX && Fs[j] <= 0.012 && zj > zfl && zj < zhi) {
          // the front slope slumps a fifth as fast, so the step to the deep floor softens
          const fl = (zi < zlo || zj < zlo ? 0.2 : 1) * kw * 0.5 * (zi - zj);
          z[i] -= fl;
          z[j] += fl;
        }
        j = i + NXP;
        zj = z[j];
        if (Fs[j] <= 0.012 && zj > zfl && zj < zhi) {
          const fl = (zi < zlo || zj < zlo ? 0.2 : 1) * kw * 0.5 * (z[i] - zj);
          z[i] -= fl;
          z[j] += fl;
        }
      }
    }
  }
  const dts = dt * A;
  for (let i = 0; i < NC; i++) {
    const zi = z[i];
    if (zi > 0.0) {
      let a = ag[i] + dts * 0.7;
      const f = F[i];
      if (f > 0.0004) a *= exp(-f * 40 * dts);
      ag[i] = a;
      qa[i] = 0;
    } else {
      ag[i] = 0;
      qa[i] = F[i] > 0.004 ? 0 : min(200, qa[i] + dts);
    }
  }
  forceRiver(st);
  // a crevasse now and then: a bank beside a busy channel is cut through to open water
  st.cre -= dts * st.qd * st.qd;
  if (st.cre <= 0) {
    st.cre = 2 + 4 * rnd();
    const lo = R0 + 5, hi = max(lo + 2, floor(st.front));
    for (let tries = 0; tries < 8; tries++) {
      const y = lo + ((rnd() * (hi - lo)) | 0), x0 = 1 + ((rnd() * NX) | 0);
      let hit = -1;
      for (let q = 0; q < NX; q++) {
        const x = 1 + ((x0 - 1 + q) % NX), i = y * NXP + x;
        if (F[i] > 0.06 && z[i] < -0.1) { hit = i; break; }
      }
      if (hit < 0) continue;
      const dir = rnd() < 0.5 ? -1 : 1;
      let j = hit, n = 0;
      while (n < 6 && z[j + dir] > -0.1 && (j + dir) % NXP > 0 && (j + dir) % NXP < NXP - 1) { j += dir; n++; }
      const e = j + dir;
      if (n === 0 || n > 4 || e % NXP < 1 || e % NXP > NX || z[e] > -0.12) continue;
      for (let c = hit + dir; c !== e; c += dir) {
        z[c] = min(z[c], -0.16);
        z[c - NXP] = min(z[c - NXP], z[c] + 0.06);
        z[c + NXP] = min(z[c + NXP], z[c] + 0.06);
        F[c] = max(F[c], 0.08);
      }
      break;
    }
  }
  // follow the shore: the view slides down the bed, faster when the front is past row TARGET, never quite still. The front is
  // half the tip of the land (the eight columns that reach furthest) and half the length the land would have if it filled the
  // valley. The sand supply rises when land is scarce.
  if ((st.frame & 1) === 0) {
    const col = [];
    let eq = 0, nl = 0, nw = 0;
    const lim = min(NY - 6, floor(128 / S));
    for (let x = 1; x <= NX; x++) {
      let r = R0;
      for (let y = NY - 4; y > R0; y--) {
        const zz = z[y * NXP + x];
        if (zz > 0.02 && zz < 0.4) { r = y; break; }
      }
      col.push(r);
    }
    for (let y = R0 + 1; y < lim; y++) {
      let a = 0, b = 0;
      for (let x = 1; x <= NX; x++) {
        const zz = z[y * NXP + x];
        if (zz < 0.4) { b++; if (zz > 0) a++; }
      }
      nl += a;
      nw += b;
      if (b > 0) eq += a / b;
    }
    col.sort((a, b) => b - a);
    let s = 0;
    const nt = 8;
    for (let i = 0; i < nt; i++) s += col[i];
    st.front += (0.5 * s / nt + 0.5 * (R0 + eq * 1.6) - st.front) * 0.3;
    st.land = nl / max(1, nw);
  }
  st.bo += (cl(pow(0.3 / max(st.land, 0.06), 1.3), 0.6, 3) - st.bo) * 0.02 * A;
  const want = cl(0.1 + (st.front + st.fo - TARGET) * 0.25, 0.1, 2.0);
  st.vs += (want - st.vs) * 0.04;
  st.fo += st.vs * dts;
  while (st.fo >= 1) {
    st.fo -= 1;
    st.grow++;
    for (const a of [z, F, pl, ag, qa]) a.copyWithin(0, NXP, NC);
    st.front -= 1;
    for (let x = 0; x < NXP; x++) {
      const i = (NY - 1) * NXP + x;
      z[i] = -HB;
      F[i] = 0;
      pl[i] = 0;
      ag[i] = 0;
      qa[i] = 0;
    }
    wallRow(st, NY - 1);
    texture(st);
  }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = (input && input.knobValues) || st.k;
  st.k = [kv[0], kv[1], kv[2], kv[3]];
  if (!st.init) {
    st.init = true;
    st.ks = st.k.slice();
    forceRiver(st);
    for (let i = 0; i < 420; i++) sim(st, 1 / 30, 6);
    // land is as old as its distance behind the front: pale sand at the shore, green well back
    for (let y = R0 + 1; y < NY; y++) {
      for (let x = 1; x <= NX; x++) {
        const i = y * NXP + x;
        if (st.z[i] > 0 && st.z[i] < WZ - 0.01) st.ag[i] = max(st.ag[i], 6 + max(0, st.front - y) * 3.6 + 18 * st.tex[i]);
      }
    }
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt, LIVE);
}

// ---- the picture --------------------------------------------------------------
// Four palettes, each a scene; knob 1 walks round them and blends neighbours (the fourth blends back into the first). A palette
// turns each part of the base picture by its own angle, brightness kept, so deep water stays darkest and fresh sand lightest.
// Per palette: sea, land, flow and plume angles in degrees (positive from teal towards blue), then a saturation scale.
const PAL = [
  [0, 0, 0, 0, 1.0],  // teal sea, sand to green land
  [62, 150, 85, 120, 0.62], // twilight
  [-35, -14, -45, 0, 0.62], // dry season
  [25, 95, 20, 120, 0.5], // ice
];
const WATER = [[0, 128, 222, 208], [0.18, 40, 176, 176], [0.4, 20, 134, 154], [0.65, 14, 98, 130], [0.85, 8, 54, 88], [1.0, 6, 30, 62]];
const LAND = [[0, 238, 228, 186], [25, 222, 206, 150], [60, 188, 178, 100], [110, 128, 150, 62], [190, 58, 124, 54], [300, 32, 98, 56]];
const FLOW = [120, 234, 222], PLUME = [186, 206, 168], MARSH = [84, 118, 78];
function turn(c, deg, sat, out) {
  const a = -deg * PI / 180, ca = cos(a), sa = sin(a), r = c[0], g = c[1], b = c[2];
  const Y = 0.299 * r + 0.587 * g + 0.114 * b, I = 0.596 * r - 0.274 * g - 0.322 * b, Q = 0.211 * r - 0.523 * g + 0.312 * b;
  const I2 = (I * ca - Q * sa) * sat, Q2 = (I * sa + Q * ca) * sat;
  out[0] = cl(Y + 0.956 * I2 + 0.621 * Q2, 0, 255);
  out[1] = cl(Y - 0.272 * I2 - 0.647 * Q2, 0, 255);
  out[2] = cl(Y - 1.106 * I2 + 1.703 * Q2, 0, 255);
}
function palette(k, out) {
  const u = (k - Math.floor(k)) * 4 + (k >= 1 ? 4 : 0), i = Math.floor(u) % 4, f = u - Math.floor(u);
  const A = PAL[i], B = PAL[(i + 1) % 4], m = (j) => A[j] + (B[j] - A[j]) * f;
  const sat = m(4), tmp = [0, 0, 0];
  const put = (dst, src, deg) => { turn(src, deg, sat, tmp); dst[0] = tmp[0]; dst[1] = tmp[1]; dst[2] = tmp[2]; };
  for (let j = 0; j < WATER.length; j++) { out.w[j][0] = WATER[j][0]; put(out.w[j].c, [WATER[j][1], WATER[j][2], WATER[j][3]], m(0)); }
  for (let j = 0; j < LAND.length; j++) { out.l[j][0] = LAND[j][0]; put(out.l[j].c, [LAND[j][1], LAND[j][2], LAND[j][3]], m(1)); }
  put(out.flow, FLOW, m(2));
  put(out.plume, PLUME, m(3));
  put(out.marsh, MARSH, m(1));
}
function ramp(tab, v, out) {
  let i = 1;
  while (i < tab.length - 1 && v > tab[i][0]) i++;
  const a = tab[i - 1], b = tab[i], t = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
  for (let c = 0; c < 3; c++) out[c] = a.c[c] + (b.c[c] - a.c[c]) * t;
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { z, F, pl, ag, tex, qa, D, ix, tx, wx, wy } = st;
  if (!st.pal) {
    const mk = (n) => { const r = []; for (let j = 0; j < n; j++) { const e = [0]; e.c = [0, 0, 0]; r.push(e); } return r; };
    st.pal = { w: mk(WATER.length), l: mk(LAND.length), flow: [0, 0, 0], plume: [0, 0, 0], marsh: [0, 0, 0] };
  }
  const pal = st.pal;
  palette(st.ks[0], pal);
  const WT = pal.w, LT = pal.l, fc = pal.flow, pc = pal.plume, mc = pal.marsh;
  const qd = st.qd, fo = st.fo, t = st.tc;
  // slow parts with unrelated periods: tide, sea haze, ripeness of the land, tint of the plume
  const tide = 0.09 * sin(TP * t / 83 + 1.1) + 0.06 * sin(TP * t / 131 + 4.2);
  const haze = 1 + 0.07 * sin(TP * t / 59 + 2.0) + 0.05 * sin(TP * t / 97 + 5.1);
  const ripe = 1 + 0.3 * sin(TP * t / 71 + 0.6) + 0.15 * sin(TP * t / 149 + 2.7);
  const pd = 16 * sin(TP * t / 113 + 3.0);
  const cw = [0, 0, 0], cL = [0, 0, 0];
  let i0 = 0, i1 = 0, w00 = 0, w10 = 0, w01 = 0, w11 = 0;
  const q = (a) => a[i0] * w00 + a[i0 + 1] * w10 + a[i1] * w01 + a[i1 + 1] * w11;
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5) / S - 0.5 + fo;
    const iy = cl(floor(gy), 0, NY - 2), ty = cl(gy - iy, 0, 1);
    const r0 = iy * NXP, r1 = r0 + NXP;
    for (let x = 0; x < W; x++) {
      i0 = r0 + ix[x];
      i1 = r1 + ix[x];
      w10 = tx[x] * (1 - ty);
      w00 = (1 - tx[x]) * (1 - ty);
      w01 = (1 - tx[x]) * ty;
      w11 = tx[x] * ty;
      const gx2 = cl(ix[x] + tx[x] + q(wx), 1, NX), gy2 = cl(gy + q(wy), 0, NY - 1.001);
      const ax = floor(gx2), ay = floor(gy2), u = gx2 - ax, v = gy2 - ay;
      i0 = ay * NXP + ax;
      i1 = i0 + NXP;
      w00 = (1 - u) * (1 - v);
      w10 = u * (1 - v);
      w01 = (1 - u) * v;
      w11 = u * v;
      const zq = q(z) - tide, fq = q(F), pq = q(pl), aq = q(ag), tq = q(tex), mq = q(qa), dq = q(D);
      const h = zq < 0 ? -zq : 0;
      ramp(WT, h / HB, cw);
      let r = cw[0] * haze, g = cw[1] * haze, bl = cw[2] * haze;
      const sflow = sstep(0.05, 0.3, fq * qd);
      const fm = sflow * 0.65 * sstep(0.03, 0.2, h);
      r += (fc[0] - r) * fm; g += (fc[1] - g) * fm; bl += (fc[2] - bl) * fm;
      const pm = (1 - exp(-pq * 12)) * 0.7;
      r += (pc[0] - r) * pm; g += (pc[1] + pd - g) * pm; bl += (pc[2] - pd * 0.875 - bl) * pm;
      const mf = sstep(30, 80, mq) * sstep(7, 16, dq) * sstep(0.3, 0.12, h) * 0.7;
      r += (mc[0] - r) * mf; g += (mc[1] - g) * mf; bl += (mc[2] - bl) * mf;
      const ae = aq * (0.7 + 0.6 * tq) * ripe;
      ramp(LT, ae, cL);
      const damp = 0.78 + 0.22 * sstep(0.0, 0.08, zq);
      const lt = (0.84 + 0.3 * tq) * damp;
      const land = sstep(-0.01, 0.04, zq);
      const foam = (1 - land) * sstep(-0.09, -0.01, zq) * 0.5;
      r += (cL[0] * lt - r) * land; g += (cL[1] * lt - g) * land; bl += (cL[2] * lt - bl) * land;
      r += (235 - r) * foam; g += (250 - g) * foam; bl += (240 - bl) * foam;
      display.setPixel(x, y, cl(floor(r), 0, 255), cl(floor(g), 0, 255), cl(floor(bl), 0, 255));
    }
  }
}
