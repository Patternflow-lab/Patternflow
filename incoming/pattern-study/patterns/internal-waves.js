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

// Colour ramp from calm dark sea to the brightest glint, built from two hues:
// the sea's and the glint's. Each stop is [v, which hue (0 sea, 1 glint, 0.5 grey), saturation, value].
const STOPS = [
  [0.0, 0, 0.9, 0.27],
  [0.18, 0, 0.9, 0.38],
  [0.34, 0, 0.85, 0.5],
  [0.46, 0, 0.43, 0.69],
  [0.56, 0.5, 0.08, 0.79],
  [0.66, 1, 0.46, 0.96],
  [0.78, 1, 0.78, 0.99],
  [0.9, 1, 0.5, 1],
  [1.0, 1, 0.16, 1],
];
// Hue knob: [position, sea hue, sea saturation, glint hue, glint saturation kept], degrees.
// Between keys the hues turn the short way round.
const KEYS = [
  [0.0, 197, 1, 42, 1],
  [0.2, 208, 0.62, 30, 1],
  [0.4, 268, 0.52, 12, 0.8],
  [0.6, 322, 0.6, 50, 0.7],
  [0.8, 158, 0.82, 68, 0.7],
  [1.0, 188, 0.55, 190, 0.15],
];
const NL = 512;

function hsv(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - abs(((h / 60) % 2) - 1)), m = v - c;
  const i = floor(h / 60);
  const r = [c, x, 0, 0, x, c][i], g = [x, c, c, x, 0, 0][i], b = [0, 0, x, c, c, x][i];
  return [255 * (r + m), 255 * (g + m), 255 * (b + m)];
}
function turn(a, b, u) {
  return a + (((b - a + 540) % 360) - 180) * u;
}

function buildLut(L, k) {
  let n = 0;
  while (n < KEYS.length - 2 && k > KEYS[n + 1][0]) n++;
  const A = KEYS[n], B = KEYS[n + 1];
  const u = cl((k - A[0]) / (B[0] - A[0]), 0, 1);
  const hs = turn(A[1], B[1], u), hg = turn(A[3], B[3], u);
  const ss = A[2] + (B[2] - A[2]) * u, gs = A[4] + (B[4] - A[4]) * u;
  // Blue and violet are dim on the panel, so the sea's value is lifted a little there.
  const blue = cl(1 - abs(hs - 265) / 55, 0, 1);
  const st = STOPS.map(([v, w, sat, val]) => {
    const rgb = w === 0.5 ? hsv(0, 0, val) : w === 0 ? hsv(hs, sat * ss, min(1, val * (1 + 0.3 * blue))) : hsv(hg, sat * gs, val);
    return [v, rgb[0], rgb[1], rgb[2]];
  });
  for (let i = 0; i < NL; i++) {
    const v = i / (NL - 1);
    let j = 0;
    while (j < st.length - 2 && v > st[j + 1][0]) j++;
    const p = st[j], q = st[j + 1];
    const t = cl((v - p[0]) / (q[0] - p[0]), 0, 1);
    for (let c = 0; c < 3; c++) L[i * 3 + c] = p[c + 1] + (q[c + 1] - p[c + 1]) * t;
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
function makePacket(S, ang, lead, amp0, lat) {
  const hx0 = sin(ang), hy0 = cos(ang);
  const D = rnd(58, 140);
  const cx = 32 - D * hx0 - lat * hy0, cy = 64 - D * hy0 + lat * hx0;
  const Dp = sqrt((32 - cx) * (32 - cx) + (64 - cy) * (64 - cy));
  const hx = (32 - cx) / Dp, hy = (64 - cy) / Dp;
  const e = 32 * abs(hx) + 64 * abs(hy);
  const n = 5 + floor(random() * 5);
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
    amp: lead === undefined ? rnd(0.65, 1) : amp0, sf: rnd(0.8, 1.25),
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

const LIFE = 200;

export function setup(params) {
  const lat = new Float32Array(NN * NN);
  for (let i = 0; i < lat.length; i++) lat[i] = random();
  const S = {
    t: 0, first: true, k: [0, 2, 0, 0.06],
    w: 3, c0: 2.9, u: 0.53,
    dist: 0, next: 0,
    psi: 0, pb: (random() < 0.5 ? -0.8 : 0.8) + (random() < 0.5 ? 0 : PI), pp: [rnd(0, TAU), rnd(0, TAU)],
    pk: [], hist: [],
    lat,
    lut: new Float32Array(NL * 3), hueBuilt: -9,
    wx: random() * 100, wy: random() * 100, wdir: rnd(0, TAU), wdirV: 0,
    sp: [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)],
    sw: [rnd(0, TAU), rnd(0, TAU)],
    vb: new Float32Array(W * H),
  };
  S.psi = S.pb + 0.3 * sin(S.pp[0]) + 0.15 * sin(S.pp[1]);
  params.s = S;
}

function spawn(S, lead, amp0) {
  const sp = (10 + 65 * S.u) * PI / 180;
  // Of eight tries take the heading and sideways offset least like the last few packets.
  let best = 0, bl = 0, bestScore = -1;
  for (let tries = 0; tries < 8; tries++) {
    const ang = S.psi + (random() < 0.5 ? -1 : 1) * sp * rnd(0.25, 1);
    const lat = rnd(-36, 36);
    let score = 9;
    for (const h of S.hist) score = min(score, abs(((h[0] - ang + 3 * PI) % TAU) - PI) + abs(h[1] - lat) / 50);
    if (score > bestScore) {
      bestScore = score;
      best = ang;
      bl = lat;
    }
  }
  S.hist.push([best, bl]);
  if (S.hist.length > 3) S.hist.shift();
  S.pk.push(makePacket(S, best, lead, amp0, bl));
}

function stepPackets(S, dt) {
  const dl = S.c0 * dt;
  S.dist += dl;
  for (const P of S.pk) P.T += dl * P.sf;
  // The family of headings turns slowly, but stays diagonal.
  S.psi = S.pb + 0.3 * sin(0.0113 * S.t + S.pp[0]) + 0.15 * sin(0.0071 * S.t + S.pp[1]);
  const w = S.w;
  S.pk = S.pk.filter((P) => {
    const j = P.n - 1;
    const rho = P.rho0 + P.f[j] * P.T - sumGap(P, j) * w;
    return rho - 5 * w < P.Dp + P.e + 6;
  });
  if (S.dist >= S.next) {
    spawn(S, undefined, undefined);
    S.next = S.dist + (LIFE / (0.85 + 2 * S.u)) * rnd(0.82, 1.18);
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
  S.c0 += (1.45 * cl(k[1], 0.4, 4) - S.c0) * (S.first ? 1 : e);
  S.w += (3 * Math.pow(1.7, cl(k[2], -1, 1)) - S.w) * (S.first ? 1 : e);
  S.u = cl(0.5 + 0.5 * k[3], 0, 1);
  if (S.first) {
    S.first = false;
    const n = 0.85 + 2 * S.u;
    const m = Math.round(n);
    for (let i = 0; i < m; i++) spawn(S, i === 0 ? rnd(4, 20) : rnd(-60, -10) - 30 * (i - 1), i === 0 ? 1 : rnd(0.4, 0.55));
    S.next = S.dist + (LIFE / n) * rnd(0.3, 0.7);
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
    buildLut(S.lut, cl(hue, 0, 1));
    S.hueBuilt = hue;
  }
  const lut = S.lut;
  const lat = S.lat;
  const t = S.t;
  const pk = S.pk;
  for (const P of pk) buildTable(S, P);
  // The sun's glint: a broad patch off the top left corner that wanders and breathes.
  const sp = S.sp;
  const sx = -24 + 8 * sin(0.043 * t + sp[0]) + 5 * sin(0.0291 * t + sp[1]);
  const sy = -38 + 6 * sin(0.037 * t + sp[2]) + 4 * sin(0.0211 * t + sp[3]);
  const gamp = 0.6 * (1 + 0.06 * sin(0.051 * t + S.sw[0]));
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
      // Slow patches of calmer and more ruffled water.
      const m1 = vnoise(lat, (px + 0.17 * t + 40) / 36, (py - 0.11 * t + 9) / 36);
      const m2 = vnoise(lat, (px - 0.2 * t + 77) / 52, (py + 0.14 * t + 21) / 52);
      const vb = 0.07 + gamp * exp(-(ddx * ddx + ddy * ddy) / (2 * 95 * 95)) + 0.07 * (m1 - 0.5);
      const Rs = R / (1 + 0.35 * abs(R));
      // Wind chop: two layers of stretched value noise that slide over the water.
      const qx = px + wx, qy = py + wy;
      const u1 = (qx * ca + qy * sa) / 3.2, v1 = (-qx * sa + qy * ca) / 7;
      const u2 = (qx * c2 + qy * s2) / 4.4 - 0.4 * t, v2 = (-qx * s2 + qy * c2) / 9;
      const ch = vnoise(lat, u1 + 11, v1 + 7) + vnoise(lat, u2 + 53, v2 + 31) - 1;
      const rough = Rs > 0 ? Rs : 0;
      const slick = Rs < 0 ? -Rs : 0;
      // Near the sun the haze is bright and the slicks cut dark bands in it; far from it the rough lines stand out bright on dark water.
      const gain = min(1, (0.14 + 0.55 * (vb - 0.1)) * (0.45 + 1.1 * m2) + 0.7 * sstep(0.05, 0.5, rough)) * (1 - 0.85 * slick);
      let v = vb + (Rs > 0 ? 0.62 * Rs : (0.3 + 0.75 * vb) * Rs) + 0.3 * ch * gain + 0.3 * streak;
      v = v > 0.85 ? 0.85 + 0.15 * tanh((v - 0.85) / 0.15) : v < 0.1 ? 0.1 - 0.1 * tanh((0.1 - v) / 0.1) : v;
      const li = ((cl(v, 0, 1) * (NL - 1)) | 0) * 3;
      display.setPixel(x, y, lut[li], lut[li + 1], lut[li + 2]);
    }
  }
}
