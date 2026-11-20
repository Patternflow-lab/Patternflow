// ===== Patternflow pattern =====
// Title:   Leidenfrost Stars
// Family:  leidenfrost
// Idea:    Mercury-bright water drops skitter on their own vapour across a dark steel plate glowing red-orange at its edges, each drop's rim ringing in a mode of its own so the drop turns into a slowly rotating star of two to ten points, the point count falling as the drop evaporates, drops bouncing off the plate's edge, merging when they touch and ringing down into a new star, shrinking to a last round bead, while new drops fall in from above.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Johann Gottlob Leidenfrost's drop on a hot spoon (1756), the star-shaped drops first photographed by N. J. Holter and W. R. Glasscock (1952), Brunet and Snoeijer's star-drops on an air cushion (2011), Ma, Lietor-Santos and Burton on the oscillating drop (2017), Rayleigh's drop modes (1879); pattern round 205
// Round:   205
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Heat=0.5..4, Size=0..1, Feed=0..1
//
// Knob 1: Hue. Turns drops and plate round the wheel together from the ice-blue silver on a red-orange plate it opens on; at 0.25 the plate is green and the drops pink, at 0.5 the plate is teal and the drops copper.
// Knob 2: Heat. How far above the boiling point the plate is: at 0.5 drops creep at 2 to 4 LEDs a second, ring faintly (points a sixth of the radius long) and a drop 10 LEDs in radius lasts about three minutes; at 2 they skitter at 4 to 9 LEDs a second, points a quarter of the radius, 50 seconds; at 4 they race at up to 16 LEDs a second, points a third of the radius, 25 seconds, and the plate glows hot orange.
// Knob 3: Size. The radius drops are fed in at: at 0 they are 5 to 10.5 LEDs in radius and start with 3 to 8 points, at 1 they are 7 to 12.6 LEDs and start with 5 to 9; the point count then falls as each one evaporates, about one point for every 1.6 LEDs of radius lost.
// Knob 4: Feed. How many drops the plate is kept at and how hard they land: 4 at 0, 5 at the start, 9 at 1 when there is room (water never covers more than a quarter of the plate), and a harder splash and wilder first ringing the higher it goes.

const W = 64;
const H = 128;
const NM = 13;
const { floor, sin, cos, exp, sqrt, abs, log, PI, min, max, atan2, round, pow, random } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = () => sqrt(-2 * log(1 - random())) * cos(TAU * random());
const sm = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// The profile of one rim mode: narrow tips and round broad valleys, mean zero,
// so the points read as points instead of a scalloped circle.
const GN = 1024;
const G = new Float32Array(GN + 2);
const GD = new Float32Array(GN + 2);
(() => {
  const q = 1.55;
  let mean = 0;
  for (let i = 0; i < GN; i++) mean += 1 - 2 * abs(sin((i / GN) * PI)) ** q;
  mean /= GN;
  for (let i = 0; i < GN; i++) {
    const x = (i / GN) * TAU;
    const u = abs(sin(x / 2));
    G[i] = 1 - 2 * u ** q - mean;
    GD[i] = -q * u ** (q - 1) * cos(x / 2);
  }
  G[GN] = G[0];
  GD[GN] = GD[0];
  G[GN + 1] = G[1];
  GD[GN + 1] = GD[1];
})();
let PG = 0;
let PD = 0;
function prof(x) {
  let f = x * (GN / TAU);
  f -= GN * floor(f / GN);
  const i = f | 0;
  const u = f - i;
  PG = G[i] + (G[i + 1] - G[i]) * u;
  PD = GD[i] + (GD[i + 1] - GD[i]) * u;
}

const LAND = 0.34;
const LX = -0.55;
const LY = -0.835;
const GLN = 330;

export function setup(params) {
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    heat: 2, size: 0, feed: 0.06, sz: 1, N: 5, viol: 0.5,
    drops: [], rings: [], timer: 2, still: false,
    M: new Float32Array(9),
    buf: new Float32Array(W * H * 3),
    lut: new Float32Array(GLN * 3),
    ex: new Float32Array(W), ey: new Float32Array(H),
    bx: new Float32Array(4 * W), by: new Float32Array(4 * H),
    bl: [0, 0, 0, 0], bp: [0, 0, 0, 0],
    // blob phases: slow, each on its own period of several minutes
    bph: [0, 1, 2, 3].map(() => random() * TAU),
    bw: [0.0113, 0.0071, 0.0167, 0.0049],
    bw2: [0.0089, 0.0131, 0.0053, 0.0103],
    cBody: [0, 0, 0], cRim: [0, 0, 0], cWarm: [0, 0, 0], cShade: [0, 0, 0], steel: [0, 0, 0],
  };
  params.s = S;
}

function newDrop(x, y, R2, landing) {
  const d = {
    x, y, vx: 0, vy: 0, px: 0, py: 0, R2, R20: 0, n: 0, psi: random() * TAU,
    om0: (random() < 0.5 ? -1 : 1) * (0.07 + 0.2 * random()), om: 0,
    A: new Float32Array(NM), T: new Float32Array(NM), X: new Float32Array(NM),
    V: new Float32Array(NM), off: new Float32Array(NM),
    bias: (random() - 0.5) * 1.1, st: landing ? 0 : 1, tl: 0, alpha: landing ? 0 : 1,
    dead: false, tgt: null, mt: 0, fast: false, bead: false,
    breath: random() * TAU, bw: 0.45 + 0.5 * random(),
    nm: 0, am: new Float32Array(4), mm: new Int8Array(4), omm: new Float32Array(4),
    Rr: 0, Rmax: 0, sc: 1,
  };
  d.om = d.om0;
  for (let m = 0; m < NM; m++) d.off[m] = random() * TAU;
  return d;
}

const radiusOf = (d, S) => sqrt(d.R2) * S.sz;
const wantMode = (R, bias) => round(0.62 * R + 0.75 + bias);
function modeAmp(n, R, heat) {
  const a = min(0.14 + 0.055 * heat, 1.85 / n, 0.34);
  return min(max(a, 1.25 / R), 0.34);
}
const omega = (m, R) => cl((3 * sqrt((m * (m * m - 1)) / 6)) / pow(max(R, 3) / 8, 0.75), 2, 11);

function clearSpot(S, R, tries) {
  let bx = W / 2, by = H / 2, best = -1e9;
  for (let i = 0; i < tries; i++) {
    const x = R + 3 + random() * (W - 2 * R - 6);
    const y = R + 3 + random() * (H - 2 * R - 6);
    let c = 1e9;
    for (const d of S.drops) if (!d.dead) c = min(c, sqrt((d.x - x) ** 2 + (d.y - y) ** 2) - radiusOf(d, S) - R);
    c += random() * 4;
    if (c > best) {
      best = c;
      bx = x;
      by = y;
    }
  }
  return [bx, by];
}

// The plate has room for about a quarter of its area in water; a new drop is
// fed no bigger than what is left, and none at all when there is no room.
function birthRadius(S, u) {
  const lo = lerp(5, 7.2, S.size);
  const hi = lerp(10.5, 12.6, S.size);
  let area = 0;
  for (const d of S.drops) if (d.st !== 3 && !d.dead) area += PI * d.R2 * S.sz * S.sz;
  const room = sqrt(max(0, 0.26 * W * H - area) / PI) / S.sz;
  return min(lerp(lo, hi, u === undefined ? random() ** 0.9 : u) / S.sz, room);
}

function spawn(S) {
  const Rb = birthRadius(S);
  if (Rb * S.sz < 4.3) {
    S.timer = 1.5;
    return;
  }
  const [x, y] = clearSpot(S, Rb * S.sz, 16);
  const d = newDrop(x, y, Rb * Rb, true);
  const a = random() * TAU;
  const sp = 1.5 + 3 * random();
  d.vx = sp * cos(a);
  d.vy = sp * sin(a);
  S.drops.push(d);
}

function land(S, d) {
  d.st = 1;
  d.alpha = 1;
  const v = S.viol;
  const R = radiusOf(d, S);
  const sg = () => (random() < 0.5 ? -1 : 1);
  d.X[2] = sg() * (0.15 + 0.13 * v);
  d.X[3] = sg() * (0.1 + 0.09 * v);
  d.V[4] = sg() * 0.6 * v;
  d.n = clamp2(wantMode(R, d.bias), R);
  d.V[d.n] = sg() * (1 + 1.6 * v);
  S.rings.push({ x: d.x, y: d.y, r0: 0.55 * R, r1: (1.45 + 0.35 * v) * R, t: 0, dur: 0.3 + 0.25 * v, a: 0.5 + 0.45 * v });
}

function clamp2(n, R) {
  return cl(n, 2, min(12, max(2, floor(0.8 * R + 0.4))));
}

function kick(d, m, v) {
  if (m >= 2 && m < NM) d.V[m] += v;
}

function stepDrop(S, d, dt) {
  const heat = S.heat;
  if (d.st === 0) {
    d.tl += dt;
    d.alpha = cl(d.tl / LAND, 0, 1);
    if (d.tl >= LAND) land(S, d);
    return;
  }
  d.age = (d.age || 0) + dt;
  if (d.st === 3) {
    const tg = d.tgt;
    if (!tg || tg.dead) {
      d.dead = true;
      return;
    }
    d.mt += dt;
    const amount = d.R20 * (dt / 0.5);
    const take = min(amount, d.R2 - 0.2);
    d.R2 -= take;
    tg.R2 += take;
    const e = 1 - exp(-dt / 0.2);
    d.x += (tg.x - d.x) * e;
    d.y += (tg.y - d.y) * e;
    if (d.mt >= 0.5 || d.R2 < 0.7) d.dead = true;
  } else {
    // Evaporation takes the area, so the radius goes as the root of what is left.
    if (!S.still) d.R2 = max(0.5, d.R2 - 1.05 * heat * (d.fast ? 4 : 1) * dt);
  }
  const R = radiusOf(d, S);
  if (d.st === 1 && !d.bead && R < 2.5) d.bead = true;
  if (d.bead && R < 1.75) {
    d.alpha -= dt / 0.7;
    if (d.alpha <= 0) d.dead = true;
  }
  // Which mode the drop rings in follows its radius, with a margin so it does not flutter between two.
  let nWant = 0;
  if (!d.bead) {
    const Rf = 0.62 * R + 0.75 + d.bias;
    nWant = d.n && abs(Rf - d.n) < 0.62 ? d.n : round(Rf);
    nWant = clamp2(nWant, R);
  }
  if (nWant !== d.n) {
    if (d.n) d.T[d.n] = 0;
    d.n = nWant;
    if (nWant) d.off[nWant] = random() * TAU;
  }
  if (d.n) {
    d.breath += d.bw * dt;
    d.T[d.n] = modeAmp(d.n, R, heat) * (1 + 0.1 * sin(d.breath));
  }
  const kr = 1 - exp(-dt / (d.bead ? 0.8 : 2.2));
  for (let m = 2; m < NM; m++) {
    d.A[m] += (d.T[m] - d.A[m]) * kr;
    const x = d.X[m];
    const v = d.V[m];
    if (x * x + v * v > 1e-8) {
      const w = omega(m, R);
      d.V[m] += (-w * w * x - 2 * 0.3 * w * v) * dt;
      d.X[m] += d.V[m] * dt;
    } else {
      d.X[m] = 0;
      d.V[m] = 0;
    }
  }
  // Points turn slowly, the rate wandering about its own mean.
  d.om += (d.om0 - d.om) * 0.3 * dt + 0.1 * sqrt(dt) * gauss();
  d.psi += d.om * (0.7 + 0.3 * sqrt(heat)) * dt;
  if (d.st === 3) return;
  // Skitter: random pushes from the vapour, spread over a fifth of a second.
  const rate = 0.16 + 0.22 * heat;
  if (random() < dt * rate) {
    // Near an edge the push leans back toward the middle; elsewhere it is any direction.
    const away = atan2(H / 2 - d.y, W / 2 - d.x);
    const near = cl(1 - (min(d.x, W - d.x, d.y, H - d.y) - R) / 16, 0, 1);
    let a = random() * TAU;
    a = atan2(sin(a) + near * sin(away), cos(a) + near * cos(away));
    const mag = (1.8 + 2.4 * pow(heat, 0.8)) * (0.5 + random()) * pow(9 / max(R, 4), 0.35);
    d.px += mag * cos(a);
    d.py += mag * sin(a);
    const sg = random() < 0.5 ? -1 : 1;
    kick(d, 2, (sg * (0.45 + 0.4 * random()) * mag) / 6);
    if (d.n) kick(d, d.n, (-sg * (0.5 + 0.5 * random()) * mag) / 4);
  }
  const e = 1 - exp(-dt / 0.18);
  d.vx += d.px * e;
  d.vy += d.py * e;
  d.px -= d.px * e;
  d.py -= d.py * e;
  const fr = exp(-0.1 * dt);
  d.vx *= fr;
  d.vy *= fr;
  const vmax = 3 + 3.2 * heat;
  const sp = sqrt(d.vx * d.vx + d.vy * d.vy);
  if (sp > vmax) {
    const s = 1 - (1 - vmax / sp) * (1 - exp(-dt / 0.4));
    d.vx *= s;
    d.vy *= s;
  }
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  // The plate's edge: the drop bounces and rings.
  const Rc = R * 1.12 + 0.6;
  if (d.x < Rc) {
    d.x = Rc;
    d.vx = abs(d.vx) * 0.85;
    kick(d, 2, 0.45);
    if (d.n) kick(d, d.n, 0.6);
  } else if (d.x > W - Rc) {
    d.x = W - Rc;
    d.vx = -abs(d.vx) * 0.85;
    kick(d, 2, -0.45);
    if (d.n) kick(d, d.n, -0.6);
  }
  if (d.y < Rc) {
    d.y = Rc;
    d.vy = abs(d.vy) * 0.85;
    kick(d, 2, 0.45);
    if (d.n) kick(d, d.n, 0.6);
  } else if (d.y > H - Rc) {
    d.y = H - Rc;
    d.vy = -abs(d.vy) * 0.85;
    kick(d, 2, -0.45);
    if (d.n) kick(d, d.n, -0.6);
  }
}

// The cushions push neighbours apart a little before they touch, so a slow
// drop turns away and only one with some speed behind it reaches the other.
function repel(S, dt) {
  const ds = S.drops;
  for (let i = 0; i < ds.length; i++) {
    const a = ds[i];
    if (a.st !== 1 || a.dead) continue;
    for (let j = i + 1; j < ds.length; j++) {
      const b = ds[j];
      if (b.st !== 1 || b.dead) continue;
      const Ra = radiusOf(a, S);
      const Rb = radiusOf(b, S);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = sqrt(dx * dx + dy * dy) + 1e-6;
      const gap = dist - 1.12 * (Ra + Rb);
      if (gap > 4) continue;
      const f = 10 * (1 - max(gap, 0) / 4) * dt;
      const ma = a.R2;
      const mb = b.R2;
      a.vx -= (dx / dist) * f * 2 * (mb / (ma + mb));
      a.vy -= (dy / dist) * f * 2 * (mb / (ma + mb));
      b.vx += (dx / dist) * f * 2 * (ma / (ma + mb));
      b.vy += (dy / dist) * f * 2 * (ma / (ma + mb));
    }
  }
}

function collide(S) {
  const ds = S.drops;
  const capR = lerp(12, 13.5, S.size);
  for (let i = 0; i < ds.length; i++) {
    const a = ds[i];
    if (a.st !== 1 || a.dead) continue;
    for (let j = i + 1; j < ds.length; j++) {
      const b = ds[j];
      if (b.st !== 1 || b.dead || a.st !== 1) continue;
      const Ra = radiusOf(a, S);
      const Rb = radiusOf(b, S);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = sqrt(dx * dx + dy * dy) + 1e-6;
      if (dist >= (Ra + Rb) * 1.1) continue;
      const big = a.R2 >= b.R2 ? a : b;
      const small = big === a ? b : a;
      const Rm = sqrt(a.R2 + b.R2) * S.sz;
      const nice = a.bead || b.bead || Rm <= capR;
      if (nice && !S.still && random() < 0.65) {
        // Merge: the small one flows into the big one in half a second, and the whole rings in a low mode.
        small.st = 3;
        small.tgt = big;
        small.mt = 0;
        small.R20 = small.R2;
        const w = small.R2 / (big.R2 + small.R2);
        big.vx += (small.vx - big.vx) * w;
        big.vy += (small.vy - big.vy) * w;
        const sg = random() < 0.5 ? -1 : 1;
        big.X[2] += sg * (0.1 + 0.1 * w);
        kick(big, 2, sg * (1.1 + 1.3 * w));
        kick(big, 3, -sg * (0.7 + 0.9 * w));
        kick(big, 4, sg * 0.5 * w);
        if (big.n) big.T[big.n] = 0;
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        const ma = a.R2;
        const mb = b.R2;
        const vr = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vr > 0) {
          const ja = (2 * mb) / (ma + mb) * vr * 0.92;
          const jb = (2 * ma) / (ma + mb) * vr * 0.92;
          a.vx -= ja * nx;
          a.vy -= ja * ny;
          b.vx += jb * nx;
          b.vy += jb * ny;
        }
        const over = (Ra + Rb) * 1.14 - dist;
        a.x -= nx * over * (mb / (ma + mb));
        a.y -= ny * over * (mb / (ma + mb));
        b.x += nx * over * (ma / (ma + mb));
        b.y += ny * over * (ma / (ma + mb));
        const sg = random() < 0.5 ? -1 : 1;
        kick(a, 2, sg * 0.7);
        kick(b, 2, -sg * 0.7);
        if (a.n) kick(a, a.n, sg * 0.8);
        if (b.n) kick(b, b.n, -sg * 0.8);
      }
    }
  }
}

function advance(S, dt) {
  S.t += dt;
  const e = 1 - exp(-dt / 0.6);
  const k = S.k;
  S.heat += (cl(k[1], 0.5, 4) - S.heat) * e;
  S.size += (cl(k[2], 0, 1) - S.size) * e;
  S.feed += (cl(k[3], 0, 1) - S.feed) * e;
  S.sz = lerp(0.92, 1.06, S.size);
  S.N = 4 + floor(5.99 * sqrt(cl(k[3], 0, 1)));
  S.viol = 0.35 + 0.9 * S.feed;
  const ds = S.drops;
  let live = 0;
  for (const d of ds) if (d.st !== 3 && !d.dead) live++;
  if (live > S.N) {
    let has = false;
    let sm1 = null;
    for (const d of ds) {
      if (d.st !== 1 || d.dead) continue;
      if (d.fast) has = true;
      if (!sm1 || d.R2 < sm1.R2) sm1 = d;
    }
    if (!has && sm1) sm1.fast = true;
  } else {
    for (const d of ds) d.fast = false;
  }
  if (S.still) S.timer = 3;
  else if (live < S.N && ds.length < 12) {
    S.timer -= dt;
    if (S.timer <= 0) {
      spawn(S);
      S.timer = (1 + 4 * random()) / (0.5 + S.viol);
    }
  } else S.timer = max(S.timer, 0.8 + 2 * random());
  repel(S, dt);
  for (const d of ds) stepDrop(S, d, dt);
  collide(S);
  for (let i = ds.length - 1; i >= 0; i--) if (ds[i].dead) ds.splice(i, 1);
  const rs = S.rings;
  for (let i = rs.length - 1; i >= 0; i--) {
    rs[i].t += dt;
    if (rs[i].t >= rs[i].dur) rs.splice(i, 1);
  }
}

function prime(S) {
  S.heat = cl(S.k[1], 0.5, 4);
  S.size = cl(S.k[2], 0, 1);
  S.feed = cl(S.k[3], 0, 1);
  S.sz = lerp(0.92, 1.06, S.size);
  S.N = 4 + floor(5.99 * sqrt(S.feed));
  S.viol = 0.35 + 0.9 * S.feed;
  // The first drops are spread evenly over the size range, one of each, so the plate opens with big ones and small ones.
  const ord = [];
  for (let i = 0; i < S.N; i++) ord.push(i);
  ord.sort(() => random() - 0.5);
  for (let i = 0; i < S.N; i++) {
    const Rb = max(4.6 / S.sz, birthRadius(S, (ord[i] + random()) / S.N));
    const [x, y] = clearSpot(S, Rb * S.sz, 24);
    const d = newDrop(x, y, Rb * Rb, false);
    const a = random() * TAU;
    const sp = (1.5 + 0.4 * S.heat) * (1 + 2 * random());
    d.vx = sp * cos(a);
    d.vy = sp * sin(a);
    const R = Rb * S.sz;
    d.n = clamp2(wantMode(R, d.bias), R);
    d.A[d.n] = modeAmp(d.n, R, S.heat);
    S.drops.push(d);
  }
  // Ten seconds of skitter with the water held still, so the opening already has its ringing and its places.
  S.first = false;
  S.still = true;
  for (let t = 0; t < 10; t += 0.05) advance(S, 0.05);
  S.still = false;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  S.k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) prime(S);
  const n = Math.ceil(dt / 0.04);
  for (let i = 0; i < n; i++) advance(S, dt / n);
}

// ---------------------------------------------------------------------------
// drawing

function setMatrix(M, a) {
  const c = cos(a);
  const s = sin(a);
  const k = (1 - c) / 3;
  const q = s * 0.57735027;
  M[0] = c + k; M[1] = k - q; M[2] = k + q;
  M[3] = k + q; M[4] = c + k; M[5] = k - q;
  M[6] = k - q; M[7] = k + q; M[8] = c + k;
}
function rot(M, r, g, b, o) {
  o[0] = M[0] * r + M[1] * g + M[2] * b;
  o[1] = M[3] * r + M[4] * g + M[5] * b;
  o[2] = M[6] * r + M[7] * g + M[8] * b;
  return o;
}

function plate(S) {
  const { buf, ex, ey, bx, by, bl, bp, lut, steel } = S;
  const t = S.t;
  const heat = S.heat;
  const lvl = min(1.35, 0.6 + 0.21 * heat);
  for (let x = 0; x < W; x++) ex[x] = exp(-min(x + 0.5, W - x - 0.5) / 5.2);
  for (let y = 0; y < H; y++) ey[y] = exp(-min(y + 0.5, H - y - 0.5) / 7);
  // Warm patches: four blobs wandering on slow incommensurate orbits.
  for (let k = 0; k < 3; k++) {
    const cx = 32 + 24 * sin(S.bw[k] * t + S.bph[k]) + 6 * sin(S.bw2[k] * 1.9 * t);
    const cy = 64 + 48 * sin(S.bw2[k] * t + 2 * S.bph[k]) + 8 * sin(S.bw[k] * 2.3 * t + 1);
    const sx = 6.5 + 2.5 * k;
    const sy = 9 + 3.5 * k;
    for (let x = 0; x < W; x++) bx[k * W + x] = exp(-((x + 0.5 - cx) ** 2) / (2 * sx * sx));
    for (let y = 0; y < H; y++) by[k * H + y] = exp(-((y + 0.5 - cy) ** 2) / (2 * sy * sy));
    bp[k] = (0.42 + 0.14 * k) * (0.75 + 0.25 * sin(0.031 * t * (1 + 0.37 * k) + 5 * k));
  }
  const sr = steel[0];
  const sg = steel[1];
  const sb = steel[2];
  for (let y = 0; y < H; y++) {
    const eyy = ey[y];
    for (let x = 0; x < W; x++) {
      let g = 0.05 + 0.4 * (ex[x] + eyy);
      for (let k = 0; k < 3; k++) g += bp[k] * bx[k * W + x] * by[k * H + y];
      // Heat shimmer: faint bands that climb the plate, bent by a second slow wave.
      g *= 1 + 0.1 * sin(0.62 * y + 2.1 * t + 1.6 * sin(0.17 * x - 0.5 * t)) + 0.06 * sin(0.37 * x - 0.31 * y + 1.3 * t);
      let v = g * lvl;
      if (v > 0.7) v = 0.7 + 0.35 * (1 - exp((0.7 - v) / 0.35));
      let gi = (v * 256) | 0;
      if (gi < 0) gi = 0;
      else if (gi >= GLN) gi = GLN - 1;
      const sheen = 0.7 + 0.3 * sin(0.06 * x + 0.035 * y + 0.021 * t);
      const i = (y * W + x) * 3;
      buf[i] = lut[gi * 3] + sr * sheen;
      buf[i + 1] = lut[gi * 3 + 1] + sg * sheen;
      buf[i + 2] = lut[gi * 3 + 2] + sb * sheen;
    }
  }
}

// The vapour cushion: the plate under and around a drop is cooler, so it
// glows less, and the shadow falls a little down and to the right.
function cushion(S, d) {
  const { buf, cShade } = S;
  const R = d.Rr;
  const sx = d.x + 1.1 * (0.6 + R / 14);
  const sy = d.y + 2.2 * (0.6 + R / 14);
  const Rc = R * 1.04 + 0.6;
  const reach = Rc + 4;
  const x0 = max(0, floor(sx - reach));
  const x1 = min(W - 1, floor(sx + reach));
  const y0 = max(0, floor(sy - reach));
  const y1 = min(H - 1, floor(sy + reach));
  const al = d.alpha;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dist = sqrt((x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2);
      const c = cl((Rc + 2.4 - dist) / 4.2, 0, 1);
      if (c <= 0) continue;
      const w = sm(c) * al;
      const i = (y * W + x) * 3;
      const k = 1 - 0.72 * w;
      buf[i] = buf[i] * k + cShade[0] * w;
      buf[i + 1] = buf[i + 1] * k + cShade[1] * w;
      buf[i + 2] = buf[i + 2] * k + cShade[2] * w;
    }
}

function prep(d, S) {
  const R = radiusOf(d, S);
  d.sc = d.st === 0 ? 1 + 0.9 * (1 - d.alpha) ** 2 : 1;
  d.Rr = max(1.25, R) * d.sc;
  // The four strongest modes carry the shape.
  let nm = 0;
  let tot = 0;
  for (let m = 2; m < NM; m++) {
    const a = d.A[m] + d.X[m];
    const aa = abs(a);
    if (aa < 0.004) continue;
    let k;
    if (nm < 4) k = nm++;
    else if (aa > abs(d.am[3])) k = 3;
    else continue;
    while (k > 0 && abs(d.am[k - 1]) < aa) {
      d.am[k] = d.am[k - 1];
      d.mm[k] = d.mm[k - 1];
      k--;
    }
    d.am[k] = a;
    d.mm[k] = m;
  }
  d.nm = nm;
  for (let k = 0; k < nm; k++) tot += abs(d.am[k]);
  const s = tot > 0.4 ? 0.4 / tot : 1;
  for (let k = 0; k < nm; k++) {
    d.am[k] *= s;
    d.omm[k] = d.off[d.mm[k]] - d.mm[k] * d.psi;
  }
  d.Rmax = d.Rr * (1 + 1.2 * min(tot, 0.4)) + 2.5;
}

function radiusAt(d, th) {
  let a = 0;
  for (let k = 0; k < d.nm; k++) {
    prof(d.mm[k] * th + d.omm[k]);
    a += d.am[k] * PG;
  }
  return d.Rr * max(0.4, 1 + a);
}

function drawDrop(S, d) {
  const { buf, cBody, cRim, cWarm } = S;
  const R = d.Rr;
  const cx = d.x;
  const cy = d.y;
  const al = d.alpha;
  const rL = radiusAt(d, atan2(LY, LX));
  const hx = cx + LX * 0.5 * rL;
  const hy = cy + LY * 0.5 * rL;
  const hw = max(1.25, 0.2 * R);
  const hh = max(0.95, 0.1 * R);
  const hx2 = cx - LX * 0.52 * radiusAt(d, atan2(-LY, -LX));
  const hy2 = cy - LY * 0.52 * radiusAt(d, atan2(-LY, -LX));
  const sparkle = R > 5.5 ? 0.45 : 0;
  const x0 = max(0, floor(cx - d.Rmax));
  const x1 = min(W - 1, floor(cx + d.Rmax));
  const y0 = max(0, floor(cy - d.Rmax));
  const y1 = min(H - 1, floor(cy + d.Rmax));
  const nm = d.nm;
  const TX = -LY;
  const TY = LX;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = sqrt(dx * dx + dy * dy) + 1e-6;
      const th = atan2(dy, dx);
      let a = 0;
      let ad = 0;
      for (let k = 0; k < nm; k++) {
        const m = d.mm[k];
        prof(m * th + d.omm[k]);
        a += d.am[k] * PG;
        ad += d.am[k] * m * PD;
      }
      const rr = R * max(0.4, 1 + a);
      const drr = R * ad;
      const dd = max(dist, 0.55 * rr);
      const q = drr / dd;
      const sd = (dist - rr) / sqrt(1 + q * q);
      if (sd > 0.7) continue;
      const cov = sm(cl(0.5 - sd / 1.2, 0, 1)) * al;
      if (cov <= 0.002) continue;
      const depth = -sd;
      const nx = dx / dist;
      const ny = dy / dist;
      const nl = nx * LX + ny * LY;
      const gl = (dx * LX + dy * LY) / R;
      const rim = exp(-(depth * depth) / 1.15);
      const rimI = rim * (0.66 + 0.34 * abs(nl));
      let body = 0.52 + 0.28 * gl;
      body -= 0.12 * exp(-((depth - 2.0) ** 2) / 1.1);
      const cres = exp(-((depth - 2.5) ** 2) / 1.6) * (nl < 0 ? -nl : 0) * 0.3;
      const ex = x + 0.5 - hx;
      const ey = y + 0.5 - hy;
      const u = (ex * TX + ey * TY) / hw;
      const v = (ex * LX + ey * LY) / hh;
      let spec = exp(-(u * u + v * v));
      if (sparkle > 0) {
        const fx = x + 0.5 - hx2;
        const fy = y + 0.5 - hy2;
        spec += sparkle * exp(-((fx * fx + fy * fy) / 1.4));
      }
      if (spec > 1) spec = 1;
      let r = body * cBody[0] + rimI * cRim[0] + cres * cWarm[0] + spec;
      let g = body * cBody[1] + rimI * cRim[1] + cres * cWarm[1] + spec;
      let b = body * cBody[2] + rimI * cRim[2] + cres * cWarm[2] + spec;
      if (r > 1) r = 1;
      if (g > 1) g = 1;
      if (b > 1) b = 1;
      const i = (y * W + x) * 3;
      buf[i] += (r - buf[i]) * cov;
      buf[i + 1] += (g - buf[i + 1]) * cov;
      buf[i + 2] += (b - buf[i + 2]) * cov;
    }
  }
}

function drawRing(S, rg) {
  const { buf, cRim } = S;
  const u = rg.t / rg.dur;
  const r = lerp(rg.r0, rg.r1, 1 - (1 - u) ** 2);
  const a = rg.a * (1 - u) ** 1.6;
  const reach = r + 3.2;
  const x0 = max(0, floor(rg.x - reach));
  const x1 = min(W - 1, floor(rg.x + reach));
  const y0 = max(0, floor(rg.y - reach));
  const y1 = min(H - 1, floor(rg.y + reach));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dist = sqrt((x + 0.5 - rg.x) ** 2 + (y + 0.5 - rg.y) ** 2);
      const w = exp(-((dist - r) ** 2) / 1.7) * a;
      if (w < 0.01) continue;
      const i = (y * W + x) * 3;
      buf[i] = min(1, buf[i] + w * cRim[0]);
      buf[i + 1] = min(1, buf[i + 1] + w * cRim[1]);
      buf[i + 2] = min(1, buf[i + 2] + w * cRim[2]);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const { buf, M, lut } = S;
  setMatrix(M, TAU * S.k[0]);
  rot(M, 0.72, 0.84, 1.0, S.cBody);
  rot(M, 0.82, 0.93, 1.0, S.cRim);
  rot(M, 0.85, 0.95, 1.0, S.cWarm);
  rot(M, 0.012, 0.03, 0.07, S.cShade);
  rot(M, 0.04, 0.045, 0.06, S.steel);
  const tmp = [0, 0, 0];
  // The plate's glow ramp: dull red, then red-orange, then orange, as a hot metal does.
  for (let i = 0; i < GLN; i++) {
    const g = i / 256;
    rot(M, min(1, 1.1 * g), 0.2 * g + 0.42 * g * g, 0.05 * g * g * g, tmp);
    lut[i * 3] = max(0, tmp[0]);
    lut[i * 3 + 1] = max(0, tmp[1]);
    lut[i * 3 + 2] = max(0, tmp[2]);
  }
  plate(S);
  const ds = S.drops;
  for (const d of ds) prep(d, S);
  for (const d of ds) cushion(S, d);
  for (const d of ds) drawDrop(S, d);
  for (const rg of S.rings) drawRing(S, rg);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, 255 * min(1, buf[i]), 255 * min(1, buf[i + 1]), 255 * min(1, buf[i + 2]));
    }
}
