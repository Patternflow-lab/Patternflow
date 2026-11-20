// ===== Patternflow pattern =====
// Title:   Internal Waves
// Family:  internalwave
// Idea:    Packets of internal solitary waves cross a calm sea seen from orbit under a low sun, as curved bands that alternate between rough glittering water and smooth dark slicks, each packet a rank-ordered train with the biggest soliton in front and the smallest behind.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Korteweg and de Vries (1895) for the sech-squared soliton, Zabusky and Kruskal (1965) for the name and the rank-ordered train, Osborne and Burch (1980) for packets of internal solitons in the Andaman Sea, Alpers (1985) for rough and smooth bands from the surface current of an internal wave; pattern round 206
// Round:   206
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.4..4, Width=-1..1, Packets=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel from the gold glint over deep teal sea it opens on.
// Knob 2: Speed. How fast the leading soliton travels, from 0.4 LEDs a second to 4, opening at 2; the smaller solitons behind it are up to 30% slower, so a packet spreads by about 0.3 LEDs for every LED it travels.
// Knob 3: Width. How wide each soliton is, and so how far apart the bands sit: 2.7 LEDs at -1 with bands 11 LEDs apart, 5 at 0 with bands 21 apart, 9 at 1 with only two or three bands across the panel.
// Knob 4: Packets. At -1 one packet at a time, all travelling the same way; at 1 up to four at once, heading up to 75 degrees apart, so they cross in chequers.

const W = 64;
const H = 128;
const { floor, sqrt, exp, sin, cos, tanh, abs, min, max, PI, random } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = (a, b) => a + (b - a) * random();

// Colour ramp from calm dark sea to the brightest glint, at Hue = 0.
const RAMP = [
  [0.0, 6, 48, 76],
  [0.18, 10, 80, 108],
  [0.34, 20, 110, 136],
  [0.46, 100, 160, 176],
  [0.56, 196, 206, 196],
  [0.66, 244, 206, 130],
  [0.78, 252, 172, 56],
  [0.9, 255, 214, 128],
  [1.0, 255, 246, 214],
];
const NL = 512;

// Rotate the ramp round the grey axis by `hue` turns and put each entry's
// luminance back, so a dark teal turned orange stays a bright orange.
function buildLut(L, hue) {
  const th = TAU * hue;
  const c = cos(th), s = sin(th), k = 1 / 3, q = 0.577350269 * s;
  const m00 = c + (1 - c) * k, m01 = (1 - c) * k - q, m02 = (1 - c) * k + q;
  for (let i = 0; i < NL; i++) {
    const v = i / (NL - 1);
    let n = 0;
    while (n < RAMP.length - 2 && v > RAMP[n + 1][0]) n++;
    const a = RAMP[n], b = RAMP[n + 1];
    const u = cl((v - a[0]) / (b[0] - a[0]), 0, 1);
    const r = a[1] + (b[1] - a[1]) * u, g = a[2] + (b[2] - a[2]) * u, bl = a[3] + (b[3] - a[3]) * u;
    let R = max(0, m00 * r + m01 * g + m02 * bl);
    let G = max(0, m02 * r + m00 * g + m01 * bl);
    let B = max(0, m01 * r + m02 * g + m00 * bl);
    const L0 = 0.299 * r + 0.587 * g + 0.114 * bl;
    const L1 = 0.299 * R + 0.587 * G + 0.114 * B + 1e-3;
    let sc = L0 / L1;
    const mx = max(R, G, B) * sc;
    if (mx > 255) sc *= 255 / mx;
    L[i * 3] = R * sc;
    L[i * 3 + 1] = G * sc;
    L[i * 3 + 2] = B * sc;
  }
}

// Value noise on a 128 x 128 lattice that wraps.
const NN = 128;
function vnoise(lat, x, y) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 127, x1 = (xi + 1) & 127, y0 = (yi & 127) * NN, y1 = ((yi + 1) & 127) * NN;
  const a = lat[y0 + x0], b = lat[y0 + x1], c = lat[y1 + x0], d = lat[y1 + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const NT = 640;
const TSTEP = 0.5;

// One packet: a source point far off the panel, so its fronts are circles
// round it; a train of solitons, rank-ordered, the tallest in front.
function makePacket(S, ang, lead, amp0) {
  const hx0 = sin(ang), hy0 = cos(ang);
  const D = rnd(58, 140);
  const lat = rnd(-34, 34);
  const cx = 32 - D * hx0 - lat * hy0, cy = 64 - D * hy0 + lat * hx0;
  const Dp = sqrt((32 - cx) * (32 - cx) + (64 - cy) * (64 - cy));
  const hx = (32 - cx) / Dp, hy = (64 - cy) / Dp;
  const e = 32 * abs(hx) + 64 * abs(hy);
  const n = 4 + floor(random() * 6);
  const lam = rnd(0.76, 0.86);
  const a = [], f = [], g = [];
  for (let j = 0; j < n; j++) {
    a.push(pow2(lam, j) * rnd(0.94, 1.06));
    f.push(1 - 0.3 * (1 - pow2(lam, j)));
    g.push(rnd(3.9, 4.6) * pow2(0.9, j) * (j === 0 ? 1.2 : 1));
  }
  a[0] = 1;
  for (let j = 1; j < n; j++) a[j] = min(a[j], a[j - 1] * 0.97);
  // Nearest and farthest the panel is from the source.
  const nx = cl(cx, 0, W), ny = cl(cy, 0, H);
  let dmax = 0;
  for (const [px, py] of [[0, 0], [W, 0], [0, H], [W, H]]) dmax = max(dmax, sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)));
  const dmin = sqrt((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy)) - 8;
  const P = {
    cx, cy, hx, hy, nx: -hy, ny: hx, Dp, e, n, a, f, g,
    alpha: rnd(26, 48) * PI / 180,
    rho0: Dp - e - 16,
    T: 0,
    dmin, dmax: dmax + 8,
    tab: new Float32Array(NT + 4),
    wa: rnd(1.4, 2.6), wb: rnd(0.8, 1.6),
    ka: TAU / rnd(48, 90), kb: TAU / rnd(24, 44),
    da: rnd(0, TAU), db: rnd(0, TAU), ua: rnd(0, TAU), ub: rnd(0, TAU),
    ra: rnd(0, TAU), rb: rnd(0, TAU),
    ca: rnd(0, TAU), cb: rnd(0, TAU),
    ph1: rnd(0, TAU), ph2: rnd(0, TAU), ph3: rnd(0, TAU),
    kl: TAU / rnd(22, 40),
    amp: lead === undefined ? rnd(0.6, 1) : amp0,
    tx: rnd(0, 100), ty: rnd(0, 100), tx2: rnd(0, 100), ty2: rnd(0, 100), tv: rnd(0.5, 0.9),
  };
  P.T = lead === undefined ? 0 : lead + e + 16;
  return P;
}
function pow2(b, j) {
  let r = 1;
  for (let i = 0; i < j; i++) r *= b;
  return r;
}

const LIFE = 270;

export function setup(params) {
  const lat = new Float32Array(NN * NN);
  for (let i = 0; i < lat.length; i++) lat[i] = random();
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    w: 3, c0: 2, u: 0.53,
    dist: 0, next: 0,
    psi: (random() < 0.5 ? -1 : 1) * rnd(0.45, 0.8) + (random() < 0.5 ? 0 : PI),
    pk: [],
    lat,
    lut: new Float32Array(NL * 3), hueBuilt: -9,
    wx: random() * 100, wy: random() * 100, wdir: rnd(0, TAU), wdirV: 0,
    sp: [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)],
    sw: [rnd(0, TAU), rnd(0, TAU)],
    vb: new Float32Array(W * H),
  };
  params.s = S;
}

function spawn(S, lead, amp0) {
  const sp = (10 + 65 * S.u) * PI / 180;
  let best = 0, bestScore = -1;
  for (let tries = 0; tries < 8; tries++) {
    const ang = S.psi + (random() < 0.5 ? -1 : 1) * sp * rnd(0.25, 1);
    let score = 9;
    for (const P of S.pk) {
      let d = abs(((Math.atan2(P.hx, P.hy) - ang + 3 * PI) % TAU) - PI);
      score = min(score, d);
    }
    if (score > bestScore) {
      bestScore = score;
      best = ang;
    }
  }
  S.pk.push(makePacket(S, best, lead, amp0));
}

function stepPackets(S, dt) {
  const dl = S.c0 * dt;
  S.dist += dl;
  for (const P of S.pk) P.T += dl;
  // The family of headings drifts slowly.
  S.psi += 0.004 * dt * (random() - 0.5) * 6;
  const w = S.w;
  S.pk = S.pk.filter((P) => {
    const j = P.n - 1;
    const rho = P.rho0 + P.f[j] * P.T - sumGap(P, j) * w;
    return rho - 5 * w < P.Dp + P.e + 6;
  });
  if (S.dist >= S.next) {
    spawn(S, undefined, undefined);
    S.next = S.dist + (LIFE / (1 + 3 * S.u)) * rnd(0.75, 1.25);
  }
}
function sumGap(P, j) {
  let s = 0;
  for (let i = 0; i < j; i++) s += P.g[i];
  return s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  dt = cl(dt || 0, 0, 0.1);
  const k = input.knobValues || [0, 2, 0, 0.06];
  S.k = k;
  const e = 1 - exp(-dt / 0.9);
  S.c0 += (cl(k[1], 0.4, 4) - S.c0) * (S.first ? 1 : e);
  S.w += (3 * Math.pow(1.7, cl(k[2], -1, 1)) - S.w) * (S.first ? 1 : e);
  S.u = cl(0.5 + 0.5 * k[3], 0, 1);
  if (S.first) {
    S.first = false;
    const n = 1 + 3 * S.u;
    const m = Math.round(n);
    for (let i = 0; i < m; i++) spawn(S, i === 0 ? rnd(15, 35) : rnd(-60, -10) - 30 * (i - 1), i === 0 ? 1 : rnd(0.45, 0.65));
    S.next = S.dist + (LIFE / n) * rnd(0.4, 0.8);
  }
  S.t += dt;
  stepPackets(S, dt);
  // Chop drift and the sun's slow wander.
  S.wdirV += (-S.wdirV * 0.2 * dt) + 0.12 * sqrt(dt) * (random() - 0.5) * 3.4;
  S.wdir += S.wdirV * dt;
  const ws = 0.9 + 0.35 * S.c0;
  S.wx += cos(S.wdir) * ws * dt;
  S.wy += sin(S.wdir) * ws * dt;
}

function buildTable(S, P) {
  const tab = P.tab;
  tab.fill(0, 0, NT + 4);
  const w = S.w;
  const T = P.T;
  const fade = sstep(0, 30, T);
  let off = 0;
  for (let j = 0; j < P.n; j++) {
    if (j > 0) off += P.g[j - 1] * w;
    const rho = P.rho0 + P.f[j] * T - off;
    const wj = w * Math.pow(P.a[j], -0.28);
    // Taller solitons decay more slowly; the small ones at the back go first.
    const Aj = P.a[j] * exp(-(T / 640) * (1 + 1.6 * (j / (P.n - 1)))) * (w / wj) * 2.6 * fade * P.amp;
    // Narrow rough lobe ahead of the trough, broader smooth lobe behind it.
    const wR = 1.1 * wj, wS = 1.8 * wj;
    const lo = rho - 5.5 * wS, hi = rho + 5.5 * wR;
    let i0 = floor((lo - P.dmin) / TSTEP), i1 = floor((hi - P.dmin) / TSTEP) + 1;
    if (i1 < 0 || i0 > NT) continue;
    i0 = max(i0, 0);
    i1 = min(i1, NT);
    for (let i = i0; i <= i1; i++) {
      const s = P.dmin + i * TSTEP - rho;
      const z = s / (s < 0 ? wS : wR);
      const ez = exp(-2 * abs(z));
      const q = 1 + ez;
      const sech2 = (4 * ez) / (q * q);
      const th = ((1 - ez) / q) * (z < 0 ? -1 : 1);
      tab[i] += Aj * sech2 * th;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const hue = S.k[0] || 0;
  if (abs(hue - S.hueBuilt) > 0.0005) {
    buildLut(S.lut, hue);
    S.hueBuilt = hue;
  }
  const lut = S.lut;
  const lat = S.lat;
  const t = S.t;
  const pk = S.pk;
  for (const P of pk) buildTable(S, P);
  // The sun's glint: a broad patch off the top left corner, wandering a little.
  const sx = -24 + 14 * sin(0.021 * t + S.sw[0]) + 7 * sin(0.0137 * t + S.sw[1]);
  const sy = -38 + 11 * sin(0.0173 * t + S.sw[1]) + 6 * sin(0.0097 * t + S.sw[0]);
  const wx = S.wx, wy = S.wy;
  const ca = cos(S.wdir), sa = sin(S.wdir);
  const c2 = cos(S.wdir + 0.9), s2 = sin(S.wdir + 0.9);
  const np = pk.length;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      let R = 0;
      let streak = 0;
      for (let p = 0; p < np; p++) {
        const P = pk[p];
        const dx = px - P.cx, dy = py - P.cy;
        const d = sqrt(dx * dx + dy * dy);
        const cs = (dx * P.hx + dy * P.hy) / d;
        const e = sstep(cos(P.alpha * 1.3), cos(P.alpha * 0.55), cs);
        if (e <= 0) continue;
        const wob = P.wa * sin(P.ka * (px * cos(P.da) + py * sin(P.da)) + P.ph1 + 0.07 * t) + P.wb * sin(P.kb * (px * cos(P.db) + py * sin(P.db)) + P.ph2 - 0.11 * t);
        const lt = dx * P.nx + dy * P.ny;
        const along = 0.8 + 0.2 * sin(lt * P.kl + P.ph3);
        const dd = d + wob;
        const f = (dd - P.dmin) / TSTEP;
        const i = f | 0;
        if (i < 0 || i >= NT) continue;
        const r = (P.tab[i] + (P.tab[i + 1] - P.tab[i]) * (f - i)) * e * along;
        R += r;
        if (r > 0.04) {
          // Streaks of chop that run along the front and slide through it.
          const uu = dd / 3 - P.tv * t * 0.4, vv = lt / 10;
          const n = 0.65 * vnoise(lat, uu + P.tx, vv + P.ty) + 0.35 * vnoise(lat, uu * 1.5 - 0.25 * t + P.tx2, vv * 1.7 + P.ty2) - 0.5;
          streak += 2 * n * sstep(0.04, 0.5, r);
        }
      }
      const ddx = px - sx, ddy = py - sy;
      const vb = 0.1 + 0.54 * exp(-(ddx * ddx + ddy * ddy) / (2 * 95 * 95));
      const Rs = R / (1 + 0.35 * abs(R));
      // Wind chop: two layers of stretched value noise that slide over the water.
      const qx = px + wx, qy = py + wy;
      const u1 = (qx * ca + qy * sa) / 3.2, v1 = (-qx * sa + qy * ca) / 7;
      const u2 = (qx * c2 + qy * s2) / 4.4 - 0.4 * t, v2 = (-qx * s2 + qy * c2) / 9;
      const ch = vnoise(lat, u1 + 11, v1 + 7) + vnoise(lat, u2 + 53, v2 + 31) - 1;
      const rough = Rs > 0 ? Rs : 0;
      const slick = Rs < 0 ? -Rs : 0;
      // Near the sun the haze is bright and the slicks cut dark bands in it; far from it the rough lines stand out bright on dark water.
      const gain = min(1, 0.12 + 0.55 * (vb - 0.1) + 0.7 * sstep(0.05, 0.5, rough)) * (1 - 0.85 * slick);
      let v = vb + (Rs > 0 ? 0.62 * Rs : (0.3 + 0.75 * vb) * Rs) + 0.3 * ch * gain + 0.3 * streak;
      v = v > 0.85 ? 0.85 + 0.15 * tanh((v - 0.85) / 0.15) : v < 0.1 ? 0.1 - 0.1 * tanh((0.1 - v) / 0.1) : v;
      const li = ((cl(v, 0, 1) * (NL - 1)) | 0) * 3;
      display.setPixel(x, y, lut[li], lut[li + 1], lut[li + 2]);
    }
  }
}
