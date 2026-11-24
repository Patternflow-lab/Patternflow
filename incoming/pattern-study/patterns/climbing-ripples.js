// ===== Patternflow pattern =====
// Title:   Climbing Ripples
// Family:  crossbedding
// Idea:    A side view through a flume bed with the current running left to right over dark blue-green water: asymmetric sand ripples 22 to 34 LED apart march downstream while the whole bed builds upward, and every lee face leaves a lamina of cream, sand, ochre, rust or slate behind it, so the buried record sweeps up in sloping, sinuous sheets that the next ripple cuts into or stacks on, depending on how fast the bed climbs.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: climbing-ripple cross-lamination and its classes, type A, type B and sinusoidal lamination (John R. L. Allen, 1963; Allen, Sedimentary Structures, 1982; Jopling and Walker, 1968, all from memory), the migrating ripple as a kinematic wave (from memory); pattern round 233
// Round:   233
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.4..3, Climb=-1..1, Ripple=-1..1
//
// Knob 1: Hue. Turns the whole sediment palette round the colour wheel: cream, sand and rust at 0, seafoam green with olive at 0.3, lavender with teal at 0.55, dusty pink at 0.8, and the sand again at 1. The water stays blue-green.
// Knob 2: Flow. How fast the ripples march downstream: 1 LED a second at 0.4, 3.2 at 2 and 4.6 at 3. The bed climbs by the same ratio, so the strata sink at 0.7, 2.2 and 3.2 LED a second.
// Knob 3: Climb. How much the bed grows while a ripple moves, the climb ratio: 0.3 at -1 (17 degrees, each ripple leaves one lee face and the next stoss cuts its top, so the sets dip like cross-bedding), 0.7 at 0 (35 degrees, continuous sinuous sheets), 2.4 at 1 (67 degrees, low waving sheets stacked almost straight up, sinking three times as fast).
// Knob 4: Ripple. The size of the ripples: 16 LED apart and 3 LED high at -1, 28.7 apart and 6.2 high at the opening 0.06, 40 apart and 9 high at 1.

const W = 64;
const H = 128;
const ROW0 = 27; // the row the mean bed surface sits on
const RES = 4; // cells a LED, down the record
const NZ = 1536; // cells a column holds, 384 LED of bed
const { floor, ceil, exp, abs, max, min, sin, cos, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// ---- colour: OKLCH to sRGB
function oklch(L, C, hDeg, out) {
  const h = (hDeg * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  for (let i = 0; i < 3; i++) {
    const v = cl(lin[i], 0, 1);
    out[i] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055);
  }
}

// cream, sand, ochre, rust, slate, teal mud, heavy mineral: lightness, chroma, hue in degrees
const PAL = [
  [0.87, 0.012, 95],
  [0.78, 0.026, 84],
  [0.69, 0.05, 82],
  [0.55, 0.07, 32],
  [0.5, 0.018, 255],
  [0.5, 0.04, 205],
  [0.33, 0.025, 285],
];
const TONE = [-0.07, -0.025, 0.025, 0.055];

function buildLut(P, k1) {
  const rot = 360 * k1;
  const o = [0, 0, 0];
  for (let p = 0; p < PAL.length; p++)
    for (let t = 0; t < 4; t++) {
      oklch(PAL[p][0] + TONE[t], PAL[p][1], PAL[p][2] + rot, o);
      const i = (p * 4 + t) * 3;
      P.lut[i] = o[0];
      P.lut[i + 1] = o[1];
      P.lut[i + 2] = o[2];
    }
  oklch(0.2, 0.05, 238, o);
  P.wat[0] = o[0];
  P.wat[1] = o[1];
  P.wat[2] = o[2];
  oklch(0.3, 0.06, 232, o);
  P.wat[3] = o[0];
  P.wat[4] = o[1];
  P.wat[5] = o[2];
}

// ---- the ripple chain: crests, each with its own slow size
function newRipple(x, P) {
  const r = () => TAU / (22 + 60 * Math.random());
  return {
    x,
    A: P.Ak,
    p1: Math.random() * TAU,
    w1: r(),
    p2: Math.random() * TAU,
    w2: r(),
    q1: Math.random() * TAU,
    v1: r(),
    q2: Math.random() * TAU,
    v2: r(),
    rl: 0.02 * gauss(),
  };
}

const noiseA = (r, t) => 0.5 + 0.5 * (0.6 * sin(r.w1 * t + r.p1) + 0.4 * sin(r.w2 * t + r.p2));
const noiseQ = (r, t) => 0.5 + 0.5 * (0.6 * sin(r.v1 * t + r.q1) + 0.4 * sin(r.v2 * t + r.q2));

export function setup(P) {
  Object.assign(P, {
    t: 0,
    zb: 400, // height of the mean bed, in LED, climbs for ever
    c: 3.2,
    cT: 3.2,
    rho: 0.7,
    rhoT: 0.7,
    L: 28,
    LT: 28,
    Ak: 6,
    AT: 6,
    k1: 0,
    rp: [],
    R: new Uint8Array(W * NZ).fill(5),
    hS: new Float32Array(W + 2), // the surface above the mean bed, with a column either side
    hOld: new Float32Array(W + 2),
    raw: new Float32Array(W + 2),
    lut: new Float32Array(PAL.length * 4 * 3),
    wat: new Float32Array(6),
    lc: 0,
    lf: 0,
    cat: 1,
    wm: 0.5,
    mu: 0.5,
    sl: 0.5,
    tone: 1,
    code: 5,
    gr: [],
    warm: false,
    buf: new Float32Array(W * H * 3),
  });
  let x = -40 - Math.random() * 10;
  while (x < W + 60) {
    const r = newRipple(x, P);
    P.rp.push(r);
    x += 28 * (0.8 + 0.4 * Math.random());
  }
  for (let i = 0; i < 11; i++) P.gr.push(newGrain(P, Math.random() * W));
}

function newGrain(P, x) {
  return { x, hg: 3 + 11 * Math.random(), vx: 0.9 + 0.5 * Math.random(), ph: Math.random() * TAU, sp: 0.5 + Math.random(), r: 1.5 + 0.9 * Math.random(), a: 0.5 + 0.5 * Math.random() };
}

// ---- the supply: which colour the next lamina is, and how long it lasts.
// Its slow moods are walks in height climbed, not in time, so one panel always holds several of them.
function ou(v, mu, len, sd, dz) {
  const k = min(1, dz / len);
  return v + (mu - v) * k + sd * Math.sqrt(2 * k) * gauss();
}

function newCoarse(P) {
  const warmth = cl(P.wm, 0, 1);
  const fine = 0.4 + 0.6 * sm(0.3, 0.8, P.rho); // fewer accent laminae where the sets are cut small
  const slateP = fine * (0.03 + 0.17 * sm(0.4, 0.9, P.sl));
  const v = cl(warmth + 0.15 * gauss(), 0, 1);
  let cat = v < 0.27 ? 0 : v < 0.58 ? 1 : v < 0.92 || Math.random() < 0.55 ? 2 : 3;
  let dur = 0.6 + 0.8 * Math.random();
  const r = Math.random();
  if (r < 0.025 * fine) {
    cat = 6;
    dur *= 0.6;
  } else if (r < 0.06 * fine) {
    cat = 5;
    dur *= 0.55;
  } else if (r < 0.06 * fine + slateP) {
    cat = 4;
    dur *= 0.7;
  }
  if (cat === 3) dur *= 0.7;
  if (cat === P.cat) cat = cat <= 2 ? (cat === 0 ? 1 : cat + (Math.random() < 0.5 ? 1 : -1)) : cat === 3 ? 2 : 1;
  P.cat = cat;
  const thk = 3.2 + 1.8 * sm(0.3, 1, P.rho);
  P.lc += (thk / (P.c * (0.71 + P.rho))) * dur;
}

function newFine(P) {
  const step = (Math.random() < 0.5 ? 1 : 2) * (Math.random() < 0.5 ? -1 : 1);
  let t = P.tone + step;
  if (t < 0 || t > 3) t = P.tone - step;
  P.tone = cl(t, 0, 3);
  P.lf += ((1.6 + 0.4 * sm(0.3, 1, P.rho)) / (P.c * (0.71 + P.rho))) * (0.7 + 0.6 * Math.random());
}

// ---- the bed surface, from the crests
function surface(P) {
  const rs = P.rp;
  const raw = P.raw;
  const rl0 = 0.26 + 0.14 * sm(0.12, 2.2, P.rho);
  let i = 0;
  for (let ix = -1; ix <= W; ix++) {
    const x = ix + 0.5;
    while (i + 2 < rs.length && rs[i + 1].x <= x) i++;
    const a = rs[i];
    const b = rs[i + 1];
    const dx = b.x - a.x;
    const l = cl(rl0 + a.rl, 0.18, 0.5) * dx;
    const Ha = 0.55 * a.A;
    const Ta = Ha - a.A;
    const Hb = 0.55 * b.A;
    const u0 = x - a.x;
    let h;
    if (u0 < l) {
      const u = max(u0, 0) / l;
      h = Ha + (Ta - Ha) * (0.5 - 0.5 * cos(PI * u));
    } else {
      const u = min((u0 - l) / (dx - l), 1);
      const s = 0.45 * u + 0.55 * u * u * (3 - 2 * u);
      h = Ta + (Hb - Ta) * s;
    }
    raw[ix + 1] = h;
  }
  const hS = P.hS;
  for (let j = 0; j < W + 2; j++) {
    const l = raw[max(j - 1, 0)];
    const r = raw[min(j + 1, W + 1)];
    hS[j] = 0.25 * l + 0.5 * raw[j] + 0.25 * r;
  }
}

function advance(P, d) {
  const e = 1 - exp(-d / 0.9);
  const ec = 1 - exp(-d / 0.5);
  P.t += d;
  P.c += (P.cT - P.c) * ec;
  P.L += (P.LT - P.L) * e;
  P.Ak += (P.AT - P.Ak) * e;
  P.rho += (P.rhoT - P.rho) * e;
  const rs = P.rp;
  const t = P.t;
  // spacings relax toward their targets about the crest nearest the middle, so a new size spreads from the centre
  let j = 0;
  for (let i = 1; i < rs.length; i++) if (abs(rs[i].x - 32) < abs(rs[j].x - 32)) j = i;
  const n = rs.length;
  const sp = new Array(n - 1);
  const er = 1 - exp(-d / 1.2);
  for (let i = 0; i < n - 1; i++) {
    const tg = P.L * (0.8 + 0.4 * 0.5 * (noiseQ(rs[i], t) + noiseQ(rs[i + 1], t)));
    const cur = rs[i + 1].x - rs[i].x;
    sp[i] = cur + (tg - cur) * er;
  }
  const xj = rs[j].x + P.c * d;
  rs[j].x = xj;
  for (let i = j + 1; i < n; i++) rs[i].x = rs[i - 1].x + sp[i - 1];
  for (let i = j - 1; i >= 0; i--) rs[i].x = rs[i + 1].x - sp[i];
  const ea = 1 - exp(-d / 1.5);
  for (let i = 0; i < n; i++) rs[i].A += (P.Ak * (0.8 + 0.4 * noiseA(rs[i], t)) - rs[i].A) * ea;
  while (rs[0].x > -40) {
    const r = newRipple(rs[0].x - P.L * (0.8 + 0.4 * Math.random()), P);
    rs.unshift(r);
  }
  while (rs.length > 4 && rs[rs.length - 2].x > W + 40) rs.pop();
  // supply
  P.lc -= d;
  P.lf -= d;
  while (P.lc <= 0) newCoarse(P);
  while (P.lf <= 0) newFine(P);
  P.code = P.cat * 4 + P.tone;
  // the bed
  const dz = P.rho * P.c * d;
  P.zb += dz;
  P.mu = ou(P.mu, 0.5, 80, 0.16, dz);
  P.wm = ou(P.wm, P.mu, 10, 0.3, dz);
  P.sl = ou(P.sl, 0.5, 15, 0.3, dz);
  surface(P);
  const R = P.R;
  const hS = P.hS;
  const ho = P.hOld;
  for (let x = 0; x < W; x++) {
    const hn = P.zb + hS[x + 1];
    const h0 = ho[x + 1];
    ho[x + 1] = hn;
    if (hn > h0) {
      const k1 = floor(hn * RES);
      let k = floor(h0 * RES);
      const o = x * NZ;
      for (; k <= k1; k++) R[o + (k % NZ)] = P.code;
    }
  }
}

export function update(dt, input, P) {
  if (!P.rp) setup(P);
  const k = (input && input.knobValues) || [0, 2, 0, 0.06];
  const d = min(max(dt || 0, 0), 0.1);
  P.k1 = k[0];
  P.cT = 1 + 1.375 * (cl(k[1], 0.4, 3) - 0.4);
  const k3 = cl(k[2], -1, 1);
  P.rhoT = k3 < 0 ? 0.7 * pow(0.45, -k3) : 0.7 * pow(3.43, k3);
  const k4 = cl(k[3], -1, 1);
  P.LT = 28 + 12 * k4;
  P.AT = 6 + 3 * k4;
  if (!P.warm) {
    P.warm = true;
    P.c = P.cT;
    P.L = P.LT;
    P.Ak = P.AT;
    P.rho = P.rhoT;
    for (const r of P.rp) r.A = P.Ak;
    surface(P);
    for (let x = 0; x < W; x++) P.hOld[x + 1] = P.zb + P.hS[x + 1];
    // Open on a bed that has been building for as long as it takes to fill the panel.
    const a = P.rho * P.c;
    const T = cl(130 / a, 20, 1500);
    const step = min(0.2, 0.3 / P.c);
    const nst = ceil(T / step);
    for (let i = 0; i < nst; i++) advance(P, T / nst);
  }
  const sub = ceil(d / 0.05);
  for (let i = 0; i < sub; i++) advance(P, d / sub);
  for (const g of P.gr) {
    g.x += g.vx * P.c * d;
    if (g.x > W + 4) Object.assign(g, newGrain(P, -4));
  }
}

// ---- drawing
export function draw(display, P) {
  if (!P.rp) return;
  buildLut(P, P.k1);
  const lut = P.lut;
  const wat = P.wat;
  const R = P.R;
  const hS = P.hS;
  const zb = P.zb;
  const buf = P.buf;
  for (let x = 0; x < W; x++) {
    const S = hS[x + 1];
    const slope = (hS[min(x + 2, W + 1)] - hS[max(x, 0)]) * 0.5;
    const hAbs = zb + S;
    const o = x * NZ;
    for (let y = 0; y < H; y++) {
      const zc = zb + ROW0 - y - 0.5;
      const dpt = hAbs - zc;
      const cov = cl(dpt / (1 + 0.9 * abs(slope)) + 0.5, 0, 1);
      // water
      const wy = cl((y - 4) / (ROW0 + 2 - 4), 0, 1);
      let r = wat[0] + (wat[3] - wat[0]) * wy;
      let g = wat[1] + (wat[4] - wat[1]) * wy;
      let b = wat[2] + (wat[5] - wat[2]) * wy;
      if (cov > 0) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        for (let q = 0; q < 4; q++) {
          const k = floor((zc + (q - 1.5) * 0.25) * RES);
          const ci = R[o + (k % NZ)] * 3;
          sr += lut[ci];
          sg += lut[ci + 1];
          sb += lut[ci + 2];
        }
        sr *= 0.25;
        sg *= 0.25;
        sb *= 0.25;
        const rim = exp(-max(dpt, 0) / 1.4);
        const lit = cl(slope / 0.35, 0, 1);
        const lee = cl(-slope / 0.8, 0, 1);
        const gain = 1 + (0.1 + 0.28 * lit) * rim - 0.3 * lee * exp(-max(dpt, 0) / 3.5);
        sr = min(255, sr * gain);
        sg = min(255, sg * gain);
        sb = min(255, sb * gain);
        r += (sr - r) * cov;
        g += (sg - g) * cov;
        b += (sb - b) * cov;
      }
      const p = (y * W + x) * 3;
      buf[p] = r;
      buf[p + 1] = g;
      buf[p + 2] = b;
    }
  }
  // grains in the water
  for (const gr of P.gr) {
    const xi = cl(floor(gr.x), 0, W - 1);
    const surfRow = ROW0 - hS[xi + 1];
    const gy = surfRow - gr.hg + 1.2 * sin(P.t * gr.sp + gr.ph);
    const s2 = 2 * (gr.r * 0.5) * (gr.r * 0.5);
    for (let y = max(0, floor(gy - 3)); y <= min(H - 1, ceil(gy + 3)); y++)
      for (let x = max(0, floor(gr.x - 3)); x <= min(W - 1, ceil(gr.x + 3)); x++) {
        const dx = x + 0.5 - gr.x;
        const dy = y + 0.5 - gy;
        const a = 0.24 * gr.a * exp(-(dx * dx + dy * dy) / s2);
        const p = (y * W + x) * 3;
        const wcov = cl(ROW0 - hS[x + 1] - (y + 0.5) + 0.5, 0, 1);
        const k = a * wcov;
        buf[p] += (150 - buf[p]) * k;
        buf[p + 1] += (205 - buf[p + 1]) * k;
        buf[p + 2] += (225 - buf[p + 2]) * k;
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, min(255, buf[p]) | 0, min(255, buf[p + 1]) | 0, min(255, buf[p + 2]) | 0);
    }
}
