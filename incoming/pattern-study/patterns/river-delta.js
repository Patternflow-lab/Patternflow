// ===== Patternflow pattern =====
// Title:   River Delta
// Family:  riverdelta
// Idea:    A river delta seen from straight above in time-lapse: a river comes in at the top and drops its sand where it slows, mouth bars split the channel, channels fork and run out into a turquoise sea under a milky plume, now and then the whole flow jumps to a shorter route and leaves an old lobe to turn from pale sand through ochre and olive to green, and the view scrolls to follow the shoreline so the delta grows down the panel for ever.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: reduced-complexity delta models in which water parcels random-walk over a bed, weighted towards deeper cells and the direction they were going, and erode or deposit sediment by their speed (Liang, Voller and Paola 2015 and Liang, Passalacqua and Lamb 2015, DeltaRCM, from memory); the shorter-route weight, the crevasse, the scrolling view, the land ageing and the palette are original, pattern round 245
// Round:   245
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sediment=0..4, Waves=-1..1, Flood=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the sea is teal and navy with a turquoise shallow, the land runs from pale sand through ochre and olive to green and the plume is a milky cream; at 0.5 the sea has turned amber and the land blue.
// Knob 2: Sediment. 0 to 4, opening at 2. How much sand the river carries. At 0 there is a lean supply, one deep channel that barely advances and a clean sea. At 2 mouth bars form, channels fork and lobes grow. At 4 the plume is thick, bars choke the channels and the shore moves down the panel fast.
// Knob 3: Waves. -1 to 1, opening at 0. Which of river and sea shapes the coast. At -1 the river rules: channels run straight and far out as narrow fingers like a bird's foot. At 1 the sea rules: it smooths the bars, the shoreline is a long even curve with spits, and the channels are pinned at their mouths.
// Knob 4: Flood. -1 to 1, opening at about 0.06. How much water the river carries: wider channels, brighter flow and a flow that changes route more often at 1, thin channels and a quiet flow at -1.

const W = 64, H = 128;
const { floor, min, max, abs, exp, sqrt, sin, cos, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const NX = 41, NXP = NX + 2, NY = 86, S = 64 / NX;    // the bed is 41 wide, with a sink column either side, and 86 deep
const NC = NXP * NY;
const CX = 1 + 20;                                    // middle column of the river
const R0 = 6;                                         // rows at the top that are always the straight river
const HB = 1.0, HC = 0.5, ZL = 0.22;                  // sea floor depth, river depth, highest land
const HCMAX = 0.7;                                    // deepest a channel scours
const EPSF = 0.01;                                    // weight of low land that a flood may cross
const TARGET = 80 / S;                                // row the shore is held at, 80 LED down
const DX = [0, -1, 1, -1, 1], DY = [1, 1, 1, 0, 0];
const UX = [0, -0.7071, 0.7071, -1, 1], UY = [1, 0.7071, 0.7071, 0, 0];
const TP = 2 * PI;
const RXA = new Float32Array(NC), RYA = new Float32Array(NC);   // unit vector from a point above the top of the bed to each cell: the way a fan opens
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
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, t: 0,
    z: f(NC), F: f(NC), V: f(NC), Vl: f(NC), pl: f(NC), ag: f(NC), qa: f(NC), zt: f(NC), tex: f(NC), mf: f(NC),
    D: new Float32Array(NC), WG: new Float64Array(NC), E: new Float64Array(NC),
    PP: new Float64Array(25), Fs: f(NC), fo: 0, vs: 0, grow: 0, front: 20, land: 0.5, sig: 1, cre: 20, frame: 0,
    ix: new Int32Array(W), tx: f(W), sup: 1, wv: 0, qd: 0.9,
    c1: 0, c2: 0, cc: 1, ss: 0, hue: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  });
  const { z } = st;
  z.fill(-HB);
  // a first shore: the apex floodplain, with the river cut on to a mouth
  for (let y = 0; y < NY; y++) {
    for (let x = 1; x <= NX; x++) if (y < 13) z[y * NXP + x] = 0.12 + 0.08 * rnd();
    for (let x = CX - 2; x <= CX + 2; x++) {
      if (y < 15) z[y * NXP + x] = -HC;
      else if (y < 18) z[y * NXP + x] = -0.3 - 0.05 * (y - 15);
    }
  }
  for (let y = 0; y < NY; y++) wallRow(st, y);
  for (let y = 0; y < 18; y++) for (let x = CX - 2; x <= CX + 2; x++) st.F[y * NXP + x] = y < 15 ? 0.2 : 0.12;
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
// the valley the delta builds into: high land down both sides, its inner edge wandering with the row it stands on
// (counted from the first row ever, so it moves with the bed)
const WZ = 0.5;
function wallRow(st, y) {
  const g = st.grow + y, z = st.z, ag = st.ag;
  const lo = 4.2 + 1.6 * sin(g / 7.3 + 0.7) + 1.0 * sin(g / 3.7 + 2.1) + 1.0 * sin(g / 17.9 + 5.3);
  const hi = NX - 3.2 + 1.6 * sin(g / 8.9 + 3.9) + 1.0 * sin(g / 3.3 + 0.4) + 1.0 * sin(g / 21.3 + 1.7);
  for (let x = 1; x <= NX; x++) {
    const i = y * NXP + x;
    if (x - 0.5 < lo || x - 0.5 > hi) {
      z[i] = WZ;
      if (ag[i] < 150) ag[i] = 150 + 100 * rnd();
    }
  }
}
// a fixed tonal texture in bed coordinates, so it moves with the land
function texture(st) {
  const { tex, grow } = st;
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NXP; x++) {
      tex[y * NXP + x] = 0.55 * vnoise(x / 4.1 + 5, (y + grow) / 4.1 + 9) + 0.45 * vnoise(x / 2.1 + 31, (y + grow) / 2.1 + 17);
    }
  }
}

// ---- the flow ----------------------------------------------------------------
// Distance to the open sea through the bed, a cell of water costing 1 and a cell of low land 3.5, so a parcel is drawn
// along the shorter way out. This is the steeper slope that makes a long channel lose its flow to a short one.
function potential(st) {
  const { D, z } = st;
  for (let i = 0; i < NC; i++) {
    D[i] = z[i] < -HB + 0.06 ? 0 : 1e4;
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < NY; y++) {
      for (let x = 1; x <= NX; x++) {
        const i = y * NXP + x, c = z[i] < -0.04 ? 1 : 3.5;
        let b = D[i];
        let v = D[i - 1] + c;
        if (v < b) b = v;
        if (y > 0) {
          v = D[i - NXP] + c;
          if (v < b) b = v;
          v = D[i - NXP - 1] + c * 1.414;
          if (v < b) b = v;
          v = D[i - NXP + 1] + c * 1.414;
          if (v < b) b = v;
        }
        D[i] = b;
      }
    }
    for (let y = NY - 1; y >= 0; y--) {
      for (let x = NX; x >= 1; x--) {
        const i = y * NXP + x, c = z[i] < -0.04 ? 1 : 3.5;
        let b = D[i];
        let v = D[i + 1] + c;
        if (v < b) b = v;
        if (y < NY - 1) {
          v = D[i + NXP] + c;
          if (v < b) b = v;
          v = D[i + NXP - 1] + c * 1.414;
          if (v < b) b = v;
          v = D[i + NXP + 1] + c * 1.414;
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
    else if (zi < ZL + 0.08) { const q = 1 - (zi > 0 ? zi : 0) / (ZL + 0.08); g = EPSF * q * q; }
    else g = 0;
    WG[i] = g * exp(-lam * D[i]);
  }
}

function parcels(st, P, A) {
  const { z, V, Vl, WG, PP, ag } = st, F = st.Fs;
  const QD = st.qd, UC = 0.38 * (1 - 0.15 * max(0, -st.wv)), KE = 4e-5 * A * (500 / P), KD = (0.2 + 0.1 * max(0, -st.wv)), SHB = 3, LAT = 0.22 - 0.12 * max(0, -st.wv) + 0.06 * max(0, st.wv), LAT2 = 0.10 - 0.08 * max(0, -st.wv) + 0.06 * max(0, st.wv);
  const L0 = (1.2 * st.sup * A * min(1, st.frame / 90)) / P, FN0 = 0.5 * L0, PN = 1 / (L0 + FN0);
  const MAXS = NY * 2, OPEN = 1.8, FB = 2.0 + 0.5 * max(0, st.wv);
  const DEEP = HB - 0.06;
  for (let p = 0; p < P; p++) {
    let x = CX - 2 + ((rnd() * 5) | 0), y = 0, pv = 0, load = L0, fine = FN0, tail = 0, steps = 0;
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
            // sand settles over a few cells either side: a mouth bar wider than the channel that made it
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
          if (zi > 0 && ag[idx] > 0) ag[idx] *= 0.995;
        }
        Vl[idx] += (load + fine) * PN;
        fine *= 0.975;
        if (h > DEEP) {
          // out at the delta front: most of what is left settles here
          const sd = load * 0.85, d3 = sd * 0.25;
          load -= sd;
          z[idx] += sd - 2 * d3;
          if (z[idx - 1] < ZL) z[idx - 1] += d3;
          if (z[idx + 1] < ZL) z[idx + 1] += d3;
          tail = 9;
        }
      } else {
        Vl[idx] += (load + fine) * PN;
        fine *= 0.975;
        if (--tail === 0) break;
        tail = tail > 0 ? tail : 0;
        if (tail === 0) break;
      }
      const j0 = idx + NXP, o = pv * 5;
      const g0 = WG[j0], g1 = WG[j0 - 1], g2 = WG[j0 + 1], g3 = WG[idx - 1], g4 = WG[idx + 1];
      // out in open water, where the banks do not hold the flow, a jet spreads
      const op = g0 > 0.05 * WG[idx] && g1 > 0.05 * WG[idx] && g2 > 0.05 * WG[idx] && g3 > 0 && g4 > 0 && z[idx] < -0.12 && z[j0 - 1] < -0.12 && z[j0 + 1] < -0.12 && z[idx - 1] < -0.12 && z[idx + 1] < -0.12 ? OPEN : 1;
      const rx = RXA[idx], ry = RYA[idx];
      let f0 = FB + ry, f1 = FB + 0.7071 * (ry - rx), f2 = FB + 0.7071 * (ry + rx), f3 = FB - rx, f4 = FB + rx;
      if (f0 < 0.02) f0 = 0.02;
      if (f1 < 0.02) f1 = 0.02;
      if (f2 < 0.02) f2 = 0.02;
      if (f3 < 0.02) f3 = 0.02;
      if (f4 < 0.02) f4 = 0.02;
      const w0 = g0 * PP[o] * f0, w1 = g1 * PP[o + 1] * op * f1, w2 = g2 * PP[o + 2] * op * f2, w3 = g3 * PP[o + 3] * op * op * f3, w4 = g4 * PP[o + 4] * op * op * f4;
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

function persistence(st, pers, base, side) {
  const { PP } = st;
  const gf = [1, 1, 1, 1, 1];
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      const c = UX[a] * UX[b] + UY[a] * UY[b];
      PP[a * 5 + b] = (base + (c > 0 ? pow(c, pers) : 0)) * gf[b];
    }
  }
}

// ---- one step of the world -----------------------------------------------------
function forceRiver(st) {
  const { z } = st;
  for (let y = 0; y <= R0; y++) {
    for (let x = 1; x <= NX; x++) {
      const i = y * NXP + x;
      if (abs(x - CX) <= 2) { z[i] = -HC; st.ag[i] = 0; }
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
  st.frame++;
  const wv = cl(k[2], -1, 1), rv = max(0, -wv), wp = max(0, wv);
  st.wv = wv;
  st.sup = 0.3 + 0.7 * cl(k[1], 0, 4) / 2;
  st.qd = 0.85 * pow(1.8, cl(k[3], -1, 1));
  persistence(st, 1.6 + 2.2 * rv - 1.0 * wp, 0.2 + 0.35 * wp - 0.1 * rv, 0.5 + 0.5 * wp);
  potential(st);
  weights(st, 1.5 + 0.6 * rv - 0.4 * wp, 0.14 + 0.06 * rv);
  const P = A > 1 ? 330 : 480;
  {
    // the flow a cell feels is half its own count and half the count of its neighbours, so a one-cell scour widens
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
  const { z, F, V, Vl, pl, ag, qa, zt, D } = st;
  const aF = 0.18, inv = 1 / P;
  for (let i = 0; i < NC; i++) {
    F[i] += aF * (V[i] * inv - F[i]);
    V[i] = 0;
  }
  // the plume: a smoothed count of what the parcels still carry, softened once a frame
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
  // sea level rises: everything above the sea floor sinks, faster when land is more than half of the view
  const sg = 0.0007 * A * dt * cl(pow(st.land / 0.5, 3), 0.25, 3) * (0.6 + 0.4 * st.sup);
  for (let i = 0; i < NC; i++) if (z[i] > -HB + 0.02 && z[i] < WZ - 0.01) z[i] -= sg * (z[i] > 0 ? 1 : 0.5);
  // the shallows creep: sand slumps from bars into the shoals beside them (never from the high land, never out of the deep),
  // and waves (the third knob) do it harder
  {
    const kw = min(0.2, (0.006 + 0.06 * wp) * A), Fs = st.Fs, zlo = -0.4 - 0.2 * wp, zhi = 0.06 + 0.1 * wp;
    for (let y = R0 + 1; y < NY - 1; y++) {
      for (let x = 1; x <= NX; x++) {
        const i = y * NXP + x, zi = z[i];
        if (Fs[i] > 0.012 || zi < zlo || zi > zhi) continue;
        let j = i + 1, zj = z[j];
        if (x < NX && Fs[j] <= 0.012 && zj > zlo && zj < zhi) {
          const fl = kw * 0.5 * (zi - zj);
          z[i] -= fl;
          z[j] += fl;
        }
        j = i + NXP;
        zj = z[j];
        if (Fs[j] <= 0.012 && zj > zlo && zj < zhi) {
          const fl = kw * 0.5 * (z[i] - zj);
          z[i] -= fl;
          z[j] += fl;
        }
      }
    }
  }
  // land ages where the flow does not reach it; water that stands still far from the sea goes to marsh
  const dts = dt * A;
  for (let i = 0; i < NC; i++) {
    const zi = z[i];
    if (zi > 0.0) {
      let a = ag[i] + dts;
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
  // a crevasse now and then: a bank beside a busy channel is cut through to the open water next to it, and the channel
  // either takes over the route (the shorter way out) or silts up again
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
  // follow the shore: the view slides down the bed so the front stays near row TARGET. The front is half the tip of the land
  // (the ten columns that reach furthest) and half the length the land would have if it filled the width.
  if ((st.frame & 1) === 0) {
    const col = [];
    let area = 0;
    const lim = min(NY - 6, floor(128 / S));
    for (let x = 8; x <= NX - 7; x++) {
      let r = R0;
      for (let y = NY - 4; y > R0; y--) if (z[y * NXP + x] > 0.02) { r = y; break; }
      col.push(r);
      for (let y = R0 + 1; y < lim; y++) if (z[y * NXP + x] > 0) area++;
    }
    col.sort((a, b) => b - a);
    let s = 0;
    const nt = 8;
    for (let i = 0; i < nt; i++) s += col[i];
    const eq = R0 + (area / (NX - 14)) * 1.6;
    st.front += (0.5 * s / nt + 0.5 * eq - st.front) * 0.3;
    st.land = area / max(1, (lim - R0 - 1) * (NX - 14));
  }
  const want = cl((st.front + st.fo - TARGET) * 0.14, 0, 1.8);
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
    return;
  }
  dt = cl(dt || 0, 0, 0.1);
  if (dt > 0) sim(st, dt, 1);
}

// ---- the picture --------------------------------------------------------------
const WATER = [[0, 128, 222, 208], [0.2, 40, 176, 176], [0.5, 18, 128, 150], [0.8, 10, 70, 104], [1.0, 6, 30, 62]];
const LAND = [[0, 238, 226, 178], [25, 226, 200, 128], [60, 192, 172, 84], [110, 128, 150, 62], [190, 58, 124, 54], [300, 32, 98, 56]];
function ramp(tab, v, out) {
  const n = tab.length;
  if (v <= tab[0][0]) { out[0] = tab[0][1]; out[1] = tab[0][2]; out[2] = tab[0][3]; return; }
  for (let i = 1; i < n; i++) {
    if (v <= tab[i][0]) {
      const a = tab[i - 1], b = tab[i], t = (v - a[0]) / (b[0] - a[0]);
      out[0] = a[1] + (b[1] - a[1]) * t;
      out[1] = a[2] + (b[2] - a[2]) * t;
      out[2] = a[3] + (b[3] - a[3]) * t;
      return;
    }
  }
  out[0] = tab[n - 1][1]; out[1] = tab[n - 1][2]; out[2] = tab[n - 1][3];
}

export function draw(display, params) {
  let st = params.st;
  if (!st) st = setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { z, F, pl, ag, tex, qa, D, ix, tx } = st;
  // hue: a turn about the grey axis
  const th = TP * st.ks[0], c = cos(th), s = sin(th), a = (1 - c) / 3, b = 0.57735 * s;
  const m0 = c + a, m1 = a - b, m2 = a + b;
  const qd = st.qd, fo = st.fo;
  const cw = [0, 0, 0], cL = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5) / S - 0.5 + fo;
    const iy = cl(floor(gy), 0, NY - 2), ty = cl(gy - iy, 0, 1);
    const r0 = iy * NXP, r1 = r0 + NXP;
    for (let x = 0; x < W; x++) {
      const i0 = r0 + ix[x], i1 = r1 + ix[x], u = tx[x];
      const w00 = (1 - u) * (1 - ty), w10 = u * (1 - ty), w01 = (1 - u) * ty, w11 = u * ty;
      const zq = z[i0] * w00 + z[i0 + 1] * w10 + z[i1] * w01 + z[i1 + 1] * w11;
      const fq = F[i0] * w00 + F[i0 + 1] * w10 + F[i1] * w01 + F[i1 + 1] * w11;
      const pq = pl[i0] * w00 + pl[i0 + 1] * w10 + pl[i1] * w01 + pl[i1 + 1] * w11;
      const aq = ag[i0] * w00 + ag[i0 + 1] * w10 + ag[i1] * w01 + ag[i1 + 1] * w11;
      const tq = tex[i0] * w00 + tex[i0 + 1] * w10 + tex[i1] * w01 + tex[i1 + 1] * w11;
      const mq = qa[i0] * w00 + qa[i0 + 1] * w10 + qa[i1] * w01 + qa[i1 + 1] * w11;
      const dq = D[i0] * w00 + D[i0 + 1] * w10 + D[i1] * w01 + D[i1 + 1] * w11;
      // water
      const h = zq < 0 ? -zq : 0;
      ramp(WATER, h / HB, cw);
      let r = cw[0], g = cw[1], bl = cw[2];
      const sflow = sstep(0.05, 0.3, fq * qd);
      const fm = sflow * 0.65 * sstep(0.03, 0.2, h);
      r += (120 - r) * fm; g += (234 - g) * fm; bl += (222 - bl) * fm;
      const pm = (1 - exp(-pq * 12)) * 0.7;
      r += (186 - r) * pm; g += (206 - g) * pm; bl += (168 - bl) * pm;
      const mf = sstep(30, 80, mq) * sstep(7, 16, dq) * sstep(0.3, 0.12, h) * 0.7;
      r += (84 - r) * mf; g += (118 - g) * mf; bl += (78 - bl) * mf;
      // land
      const ae = aq * (0.7 + 0.6 * tq);
      ramp(LAND, ae, cL);
      const damp = 0.78 + 0.22 * sstep(0.0, 0.08, zq);
      const lt = (0.84 + 0.3 * tq) * damp;
      const land = sstep(-0.01, 0.04, zq);
      const foam = (1 - land) * sstep(-0.09, -0.01, zq) * 0.5;
      r += (cL[0] * lt - r) * land; g += (cL[1] * lt - g) * land; bl += (cL[2] * lt - bl) * land;
      r += (235 - r) * foam; g += (250 - g) * foam; bl += (240 - bl) * foam;
      const R = m0 * r + m1 * g + m2 * bl, G = m2 * r + m0 * g + m1 * bl, B = m1 * r + m2 * g + m0 * bl;
      display.setPixel(x, y, cl(floor(R), 0, 255), cl(floor(G), 0, 255), cl(floor(B), 0, 255));
    }
  }
}
