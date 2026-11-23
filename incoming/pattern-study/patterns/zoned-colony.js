// ===== Patternflow pattern =====
// Title:   Zoned Colony
// Family:  colony
// Idea:    A fungal colony on an agar plate seen from above: bright fuzzy fronts race into fresh nutrient and leave concentric zones behind, a stretch of pale sparse mycelium and then a dense dark spore ring, neighbouring colonies stop short of each other along thin dark barrage lines, and the old inside dries to a pale crust and lyses so new colonies seed on the freed ground and the plate never fills up.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: a Fisher-KPP front (Ronald Fisher, 1937; Andrey Kolmogorov, Ivan Petrovsky and Nikolai Piskunov, 1937) with nutrient uptake, under a clock that decides at the front whether the hyphae there will sporulate, after the zonation of fungal colonies grown under alternating light and dark and the barrage lines between incompatible colonies; pattern round 231
// Round:   231
// ===============================
// @matrix 64x128
// @knobs Species=0..1, Pace=0.6..4, Zones=-1..1, Plate=-1..1
//
// Knob 1: Species. Swaps the fungus: blue-green Penicillium at 0, yellow-green Aspergillus at 0.25, deep green Trichoderma at 0.5, pink Fusarium at 0.75, and Penicillium again at 1; between them the colours blend.
// Knob 2: Pace. How fast the time-lapse runs, a third of the opening speed at 0.6 and twice it at 4, and how old the plate already is when you first see it.
// Knob 3: Zones. The spacing of the rings, 3.4 LED between one spore ring and the next at -1, 4.8 at 0 and 6.2 at 1, set by how long one beat of the light-and-dark clock is against how fast the front moves.
// Knob 4: Plate. How rich the agar is and how many colonies land on it: few big ones with thin mycelium at -1, a crowd of small ones with dense mycelium at 1.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sqrt, cos, sin, exp, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- the model: nutrient n, hyphae b, mat m (pale mycelium left behind) and spores s on the 64 x 128 plate
const DB = 0.5; // hyphal spreading, LED^2 a second
const RG = 0.3; // growth rate of hyphae on full agar, a second
const KN = 0.25; // nutrient at which growth is half speed
const DN = 1.0; // nutrient diffusion, LED^2 a second
const UP = 0.08; // nutrient eaten per hypha a second
const KAP = 0.7; // how fast starving hyphae turn into mat and spores, a second
const KS = 0.8; // how fast hyphae retire once the cell is older than twenty-odd seconds, a second
const KD = 0.35; // mat and spores laid down under hyphae, a second
const THETA = 0.04; // hyphal density at which a cell counts as taken by a colony
const RGAP = 2.0; // a colony takes no cell this close to another colony: the barrage
const KIN = 0.035; // fresh agar soaking in, a second
const LYS = 7; // seconds an old zone takes to lyse away
const YL = 1.0; // nutrient a lysed zone gives back
const CEFF = 0.57; // front speed the zones are timed against, LED a second

const WA = 4 / 6;
const WD = 1 / 6;
const W8 = [WA, WA, WA, WA, WD, WD, WD, WD];
const DX8 = [1, -1, 0, 0, 1, -1, 1, -1];
const DY8 = [0, 0, 1, -1, 1, 1, -1, -1];

// ---- species: cream hyphae, young spores, old spores, dried crust
const SPECIES = [
  [[226, 230, 200], [24, 118, 102], [14, 62, 64], [150, 168, 150]], // Penicillium
  [[236, 228, 176], [150, 164, 28], [74, 86, 20], [192, 178, 110]], // Aspergillus
  [[214, 232, 200], [18, 120, 48], [10, 64, 34], [120, 160, 110]], // Trichoderma
  [[246, 228, 218], [212, 92, 128], [120, 44, 76], [206, 166, 166]], // Fusarium
];
const AGAR = [46, 32, 14];
const GLOW = [255, 250, 218];

// ages, in seconds since a cell was taken
const DK0 = 5;
const DK1 = 28;

// ---- setup
const OFF = (r) => {
  const out = [];
  const R = floor(r);
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) if ((dx || dy) && dx * dx + dy * dy <= r * r) out.push([dx, dy]);
  return out;
};

export function setup(P) {
  const f = () => new Float32Array(N);
  Object.assign(P, {
    n: f(), nn: f(), b: f(), bn: f(), m: f(), s: f(), age: f(), fr: f(),
    own: new Int16Array(N),
    rho: f(), lnz: f(), lat: f(), cnt: new Int32Array(32768), aly: new Float32Array(32768),
    nbr: new Int32Array(N * 8),
    gapOff: OFF(RGAP),
    t: 0, phase: 0, nextId: 0, alive: 0, owned: 0, seedWait: 0, nrho: 0,
    warm: false, T: 7, n0: 1, alys: 130, seedGap: 6, rs: 8, u: 0, fnow: 0,
    waves: [], lw: [],
    pal: [0, 1, 2, 3, 4, 5, 6, 7].map(() => [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]),
  });
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let k = 0; k < 8; k++) {
        const xx = cl(x + DX8[k], 0, W - 1);
        const yy = cl(y + DY8[k], 0, H - 1);
        P.nbr[i * 8 + k] = yy * W + xx;
      }
      P.n[i] = 1;
    }
  // Slowly drifting patches of better and worse agar, and a fixed patchwork that makes the lysis ragged.
  for (let k = 0; k < 7; k++) {
    const lam = 9 + Math.random() * 18;
    const ang = Math.random() * TAU;
    P.waves.push({ kx: (TAU / lam) * cos(ang), ky: (TAU / lam) * sin(ang), w: (Math.random() - 0.5) * 0.16, ph: Math.random() * TAU });
  }
  for (let k = 0; k < 6; k++) {
    const lam = 7 + Math.random() * 8;
    const ang = Math.random() * TAU;
    P.lw.push({ kx: (TAU / lam) * cos(ang), ky: (TAU / lam) * sin(ang), ph: Math.random() * TAU });
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (const w of P.lw) v += sin(w.kx * x + w.ky * y + w.ph);
      P.lnz[y * W + x] = cl(0.5 + v / (2 * sqrt(P.lw.length) * 0.8), 0, 1);
    }
  buildRho(P);
}

function buildRho(P) {
  const ws = P.waves;
  const norm = 1 / sqrt(ws.length * 0.5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = 0; k < ws.length; k++) v += sin(ws[k].kx * x + ws[k].ky * y + ws[k].w * P.t + ws[k].ph);
      P.rho[y * W + x] = exp(0.3 * cl(v * norm * 0.7, -1.2, 1.2));
    }
  P.nrho = P.t;
}

// ---- the plate
function free(P, i) {
  const o = P.own[i];
  if (o) {
    P.owned--;
    P.cnt[o]--;
    if (P.cnt[o] === 0) P.alive--;
  }
  P.own[i] = 0;
  P.b[i] = 0;
  P.m[i] = 0;
  P.s[i] = 0;
  P.age[i] = 0;
}

function claim(P, i, o) {
  P.owned++;
  if (P.cnt[o] === 0) P.alive++;
  P.cnt[o]++;
  P.own[i] = o;
  P.age[i] = 0;
  P.lat[i] = P.aly[o] * (0.97 + 0.06 * P.lnz[i]);
  P.fr[i] = P.fnow;
  P.m[i] = 0;
  P.s[i] = 0;
}

function forbidden(P, x, y, o) {
  const go = P.gapOff;
  for (let k = 0; k < go.length; k++) {
    const xx = x + go[k][0];
    const yy = y + go[k][1];
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const q = P.own[yy * W + xx];
    if (q !== 0 && q !== o) return true;
  }
  return false;
}

// A new colony lands on the free spot with the most room round it, if there is room enough.
function trySeed(P) {
  const R = 22;
  let bx = -1;
  let by = -1;
  let bs = 0;
  for (let t = 0; t < 40; t++) {
    const x = floor(Math.random() * W);
    const y = floor(Math.random() * H);
    if (P.own[y * W + x] !== 0 || P.n[y * W + x] < 0.55) continue;
    let d2 = R * R;
    for (let dy = -R; dy <= R; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= W) continue;
        const e = dx * dx + dy * dy;
        if (e < d2 && P.own[yy * W + xx] !== 0) d2 = e;
      }
    }
    // The edge of the panel counts as room, but not all of it, so colonies still start well inside.
    const edge = 1.4 * min(x + 0.5, W - x - 0.5, y + 0.5, H - y - 0.5) + 6;
    const sc = min(sqrt(d2), edge);
    if (sc > bs) {
      bs = sc;
      bx = x;
      by = y;
    }
  }
  if (bx < 0 || bs < P.rs) return false;
  P.nextId = P.nextId >= 32000 ? 1 : P.nextId + 1;
  const o = P.nextId;
  // Each colony lives its own length of time, so the plate does not clear and refill all at once.
  P.aly[o] = P.alys * (0.35 + 1.6 * Math.random());
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = bx + dx;
      const yy = by + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      claim(P, i, o);
      P.b[i] = 0.9;
    }
  return true;
}

function step(P, dt) {
  const { n, nn, b, bn, m, s, age, fr, own, rho, nbr } = P;
  P.t += dt;
  P.phase += (dt * TAU) / P.T;
  P.fnow = sm(-0.25, 0.25, cos(P.phase));
  if (P.t - P.nrho > 1) buildRho(P);

  // age and lysis
  const lat = P.lat;
  for (let i = 0; i < N; i++) {
    if (!own[i]) continue;
    const a = age[i] + dt;
    age[i] = a;
    const al = lat[i];
    if (a > al) {
      // An old zone lyses: the hyphae go first, the mat and spores fade over a few seconds, then the cell is bare agar again with its nutrient back.
      b[i] *= exp(-0.5 * dt);
      if (a > al + LYS) {
        n[i] += YL * (m[i] + s[i]);
        free(P, i);
      }
    }
  }

  // hyphae: spreading between cells of one colony and free cells, growth on nutrient, starvation into mat and spores, taking free cells
  const D = DB * dt;
  for (let i = 0; i < N; i++) {
    const q = i * 8;
    const bi = b[i];
    const o = own[i];
    let acc = 0;
    let near = 0;
    let best = 0;
    let bo = 0;
    for (let k = 0; k < 8; k++) {
      const j = nbr[q + k];
      const bj = b[j];
      if (bj > 0) near = 1;
      const oj = own[j];
      if (o === 0 || oj === 0 || oj === o) {
        acc += W8[k] * (bj - bi);
        if (o === 0 && oj !== 0 && bj > best) {
          best = bj;
          bo = oj;
        }
      }
    }
    if (bi === 0 && near === 0) {
      bn[i] = 0;
      continue;
    }
    const ni = n[i];
    const g = ni / (ni + KN);
    let v = bi + D * acc + dt * RG * rho[i] * g * bi * (1 - bi);
    if (o !== 0) {
      v -= dt * (KAP * (1 - g) * (1 - g) + KS * sm(20, 30, age[i])) * bi;
      let dR = dt * KD * bi;
      const room = 1 - (m[i] + s[i]);
      if (dR > room) dR = room;
      if (dR > 0) {
        const f = fr[i];
        s[i] += f * dR;
        m[i] += (1 - f) * dR;
      }
    } else if (v > 0.004 && bo !== 0) {
      const x = i % W;
      const y = (i - x) / W;
      if (forbidden(P, x, y, bo)) v = 0;
      else if (v > THETA && ni > 0.1) claim(P, i, bo);
    }
    bn[i] = v < 0.00002 ? 0 : v > 1 ? 1 : v;
  }
  P.b = bn;
  P.bn = b;

  // nutrient: diffusion, fresh agar soaking in, uptake
  const n0 = P.n0;
  for (let i = 0; i < N; i++) {
    const q = i * 8;
    const ni = n[i];
    const sa = n[nbr[q]] + n[nbr[q + 1]] + n[nbr[q + 2]] + n[nbr[q + 3]];
    const sd = n[nbr[q + 4]] + n[nbr[q + 5]] + n[nbr[q + 6]] + n[nbr[q + 7]];
    const lap = (4 * sa + sd - 20 * ni) / 6;
    const v = ni + dt * (DN * lap + KIN * (n0 - ni) - UP * ni * b[i]);
    nn[i] = v < 0 ? 0 : v > 1.6 ? 1.6 : v;
  }
  P.n = nn;
  P.nn = n;

  P.seedWait -= dt;
  if (P.seedWait <= 0) {
    // The emptier the plate, the sooner the next spore lands.
    const need = cl((P.owned / N - 0.4) / 0.4, 0.2, 1.6);
    P.seedWait = trySeed(P) ? P.seedGap * (0.6 + 0.8 * Math.random()) * need : 2;
  }
}

function advance(P, secs) {
  let left = secs;
  while (left > 1e-6) {
    const h = min(0.12, left);
    step(P, h);
    left -= h;
  }
}

export function update(dt, input, P) {
  if (!P.n) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  P.u = k[0];
  const sp = cl(k[1], 0.6, 4) / 1.2;
  const spacing = 4.8 + 1.4 * cl(k[2], -1, 1);
  const q = cl((k[3] + 1) / 2, 0, 1);
  P.n0 = 0.85 + 0.35 * q;
  P.seedGap = 16 - 8 * q;
  P.rs = 13 - 3.5 * q;
  P.T = spacing / CEFF;
  if (!P.warm) {
    P.warm = true;
    // Open on a plate that has been growing for several minutes. The pre-run is timed by Pace, so a slower plate is a younger one; it then runs on, a few seconds at a time, until the plate is mostly covered and some fronts are still racing.
    const pre = 240 + 60 * sp;
    P.seedWait = 0;
    let t = 0;
    for (; t < pre; t += 0.25) step(P, 0.25);
    for (let extra = 0; extra < 160; extra += 0.25) {
      if (extra % 4 === 0) {
        let race = 0;
        for (let i = 0; i < N; i++) if (P.b[i] > 0.3) race++;
        const cov = P.owned / N;
        if (cov > 0.78 && cov < 0.92 && race > 400) break;
      }
      step(P, 0.25);
    }
  }
  advance(P, d * sp);
}

// ---- drawing
function palette(P) {
  const u4 = (P.u - floor(P.u)) * 4;
  for (let c = 0; c < 8; c++) {
    const pos = (u4 + (c - 3.5) * 0.045 + 4) % 4;
    const a = floor(pos) % 4;
    const bb = (a + 1) % 4;
    const t = sm(0, 1, pos - floor(pos));
    const lum = 0.92 + 0.016 * c;
    for (let j = 0; j < 4; j++)
      for (let ch = 0; ch < 3; ch++) P.pal[c][j][ch] = mix(SPECIES[a][j][ch], SPECIES[bb][j][ch], t) * (j === 0 || j === 3 ? 1 : lum);
  }
}

export function draw(display, P) {
  if (!P.n) return;
  palette(P);
  const { b, m, s, age, own, lat } = P;
  for (let i = 0; i < N; i++) {
    let r = AGAR[0];
    let g = AGAR[1];
    let bl = AGAR[2];
    const mi = m[i];
    const si = s[i];
    if (mi + si > 0.005) {
      const a = age[i];
      const pl = P.pal[own[i] & 7];
      const cw = 0.7 * sm(0.55 * lat[i], 1.0 * lat[i], a);
      const dk = sm(DK0, DK1, a);
      const ly = a > lat[i] ? 1 - sm(0, LYS, a - lat[i]) : 1;
      const am = 0.7 * ly * (1 - exp(-3 * mi));
      const as = 0.97 * ly * (1 - exp(-3.2 * si));
      const cr = pl[3];
      const mr = mix(pl[0][0], cr[0], cw);
      const mg = mix(pl[0][1], cr[1], cw);
      const mb = mix(pl[0][2], cr[2], cw);
      r = mix(r, mr, am);
      g = mix(g, mg, am);
      bl = mix(bl, mb, am);
      const sr = mix(mix(pl[1][0], pl[2][0], dk), cr[0] * 0.85, cw * 0.8);
      const sg = mix(mix(pl[1][1], pl[2][1], dk), cr[1] * 0.85, cw * 0.8);
      const sb = mix(mix(pl[1][2], pl[2][2], dk), cr[2] * 0.85, cw * 0.8);
      r = mix(r, sr, as);
      g = mix(g, sg, as);
      bl = mix(bl, sb, as);
    }
    const bi = b[i];
    if (bi > 0) {
      const gl = 0.96 * sm(0.03, 0.85, bi) * (1 - 0.85 * sm(3, 7, age[i]));
      r = mix(r, GLOW[0], gl);
      g = mix(g, GLOW[1], gl);
      bl = mix(bl, GLOW[2], gl);
    }
    const x = i % W;
    display.setPixel(x, (i - x) / W, r | 0, g | 0, bl | 0);
  }
}
