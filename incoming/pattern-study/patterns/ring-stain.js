// ===== Patternflow pattern =====
// Title:   Ring Stain
// Family:  coffeering
// Idea:    Drops of dyed liquid land on a slide of glass seen from above, spread in a third of a second, then dry as tinted lenses whose particles stream out to the pinned rim and pile into a dark ring, leaving a pale glaze inside and, where the edge lets go, a few thin inner rings, while later drops dissolve parts of the older stains and the old stains fade over minutes.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the coffee-ring effect, a pinned edge draws an outward capillary flow that carries the particles to the rim (Robert Deegan and colleagues, 1997); concentric rings from a contact line that depins and pins again (Deegan, 2000), pattern round 221
// Round:   221
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Dry=0..4, Slip=-2..2, Drops=-1..1
//
// Knob 1: Hue. The dye of the drops. At 0 it is a blue-green (0.52 of the way round the wheel); turning it takes the whole wheel, and the stains already on the glass change colour with it. Each drop is a little off the dye (up to 0.08 either way) and three in ten are a second dye 0.30 of the wheel along, a violet-pink at 0, so where they overlap the stains blend.
// Knob 2: Dry. How fast the liquid evaporates, which sets a drop's life: 40 s at 0, 15.5 s at 2 (where it opens), 6 s at 4, for a drop of the mean radius (a drop's life goes as its radius to the 0.6, times 0.8 to 1.25). Fast drying also lays down more stain: about 0.13 drops a second at 0, 0.35 at 2 and 0.8 at 4.
// Knob 3: Slip. How readily the contact line lets go and re-pins as the drop shrinks. At -2 the edge never moves and every drop leaves one clean ring; at 0 it leaves two or three; at 2 as many as the drop has room for, up to six, at least 3.3 LEDs apart (radius 6 holds one, 9 two, 12 three, 15 four, 18 five), so a middling drop of radius 11 shows two or three and a big one all of them.
// Knob 4: Drops. Size and rate together. At -1 the mean radius is 21 LEDs and a drop lands every 6 s or so; at 0 it is 11.5 and one lands every 3 s; at 1 it is 7 and one lands every second. The drops under their wet lens cover about 28% of the panel at any moment, whatever the knob says, and none is smaller than radius 6 or bigger than 28.

// What the picture is. The panel is a slide of glass seen from above, ground a deep warm neutral from (14, 12, 18) to (30, 26, 34), with
// a cloudy sheen that slides over it. A drop is a disc of radius R (6 to 28) at a random place, kept off the spots where wet drops
// already lie. On landing it spreads in 0.3 s from 0.28 R to R, overshoots by 3% and settles, and sends one ripple ring from its middle
// to its rim. Then it dries for T seconds as a tinted lens: dark in the middle where it is thick, a bright refraction rim, a soft glint
// of a lamp that fades as the drop flattens, and soft streaks running out to the rim, the capillary flow that carries the particles. The
// particles crowd into a band under the rim and the ring forms there, darker and more saturated every second, 2.7 to 3.2 LEDs thick on
// the main ring and about 2 on the thinner inner ones. If the contact line lets go it retreats 0.3 s to the next ring radius, 3 to 3.6
// LEDs or more in, and a thinner ring starts there, until at T the last lens snaps: it shrinks and fades in 0.7 s and what is left is a
// dark ring, a lighter glaze inside and a pale edge light just outside each outer ring. The stain goes onto a persistent canvas of five
// fields (the strength of the glaze, of the ring and of the edge light, and for the glaze and the ring the dye each carries, kept as an
// offset round the Hue knob so turning the knob recolours them). A drop that lands dissolves 90% of the older stain under its middle in
// 0.75 s, and its own glaze covers what rings are left, so the later drop wins where they overlap. Glaze fades with a time constant of 38
// s, rings 90 s and edge light 60 s, and the glaze shows as its strength to the power 1.8, so a stain is dim after a minute and gone in
// three. The mean level stays within 7% over 900 s. The canvas is pre-run for 210 s with the opening knobs, so the first frame already
// has stains on it.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, sqrt, abs, exp, sin, cos, atan2, log, pow, PI, min, max } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2;

// ---- the drops
const R_MIN = 6, R_MAX = 28;
const HUE0 = 0.52; // the dye at Hue 0, a blue-green
const DYE_B = 0.3; // the second dye, round the wheel from the first
const P_B = 0.3; // share of drops that are the second dye
const WET_FRAC = 0.28; // share of the panel under a wet drop, at any moment
const RB0 = 11.5; // mean radius at Drops 0
const RB_STEP = 1.85; // mean radius is RB0 over RB_STEP to the power of the knob
const LIFE_SLOW = 40, LIFE_FAST = 6; // seconds, at Dry 0 and Dry 4
const FADE = 0.7; // the snap: the lens lets go over this long
const SP0 = 0.28; // the radius a drop has on touching, as a share of its own
const SLIP_T = 0.3; // the contact line's retreat to the next ring
const DISS_T = 0.75, DISS_K = 3.0; // a landing drop dissolves the older stain under it
const SP_GAP = 3.0; // the least spacing between two rings of one drop
const R_INNER = 3.0; // the smallest ring
const PRE = 210, PRE_DT = 0.4; // the glass has seen this much drying when the panel opens
const MAX_DROPS = 60;

// ---- the stain
const AF = [0.7, 0.9]; // glaze strength of a drop
const TAU_F = 38, TAU_R = 90, TAU_E = 60; // seconds for the glaze, the ring and the edge light to fade to 1/e
const DECAY_STEP = 0.25;
const FILM_GAIN = 0.85;
const FILM_POW = 1.8; // a glaze shows as its strength to this power, so a faded one goes dim sooner than it goes away

// ---- colour
const HN = 256;
const WARM = new Float32Array(HN);
const FILM = new Float32Array(HN * 3), RING = new Float32Array(HN * 3), EDGE = new Float32Array(HN * 3), WET = new Float32Array(HN * 3);
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  out[o + 1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  out[o + 2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
}
(function buildLuts() {
  for (let i = 0; i < HN; i++) {
    const h = i / HN, dh = min(abs(h - 0.15), 1 - abs(h - 0.15));
    // Orange, yellow and olive go brown when they are dim. In that band the glaze is paler and stronger, the lens brighter, and the ring a deep crimson in place of dark orange.
    const warm = exp(-(dh / 0.13) * (dh / 0.13));
    hsv(h, 0.78 - 0.22 * warm, 0.92 + 0.08 * warm, FILM, i * 3);
    hsv(h + 0.03 - 0.21 * warm, 1.0, 0.17 + 0.3 * warm, RING, i * 3);
    hsv(h, 0.42, 1.0, EDGE, i * 3);
    hsv(h, 0.74, 0.62 + 0.3 * warm, WET, i * 3);
    WARM[i] = warm;
  }
})();
const GROUND = [14, 12, 18], GROUND_V = [16, 14, 16];

// Smooth noise that wraps in both directions, so the sheen can slide over the glass for ever.
function noiseTex(gw, gh) {
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const t = new Float32Array(NP);
  for (let y = 0; y < H; y++) {
    const fy = (y / H) * gh, iy = floor(fy), ty = sm(0, 1, fy - iy), y0 = iy % gh, y1 = (iy + 1) % gh;
    for (let x = 0; x < W; x++) {
      const fx = (x / W) * gw, ix = floor(fx), tx = sm(0, 1, fx - ix), x0 = ix % gw, x1 = (ix + 1) % gw;
      const a = g[y0 * gw + x0], b = g[y0 * gw + x1], c = g[y1 * gw + x0], d = g[y1 * gw + x1];
      t[y * W + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return t;
}

function makeState() {
  const S = {
    ready: false, time: 0, drops: [], next: 0, dacc: 0, decayStep: DECAY_STEP,
    fa: new Float32Array(NP), fc: new Float32Array(NP),
    ra: new Float32Array(NP), rc: new Float32Array(NP),
    ea: new Float32Array(NP),
    bufR: new Float32Array(NP), bufG: new Float32Array(NP), bufB: new Float32Array(NP),
    sheenA: noiseTex(6, 12), sheenB: noiseTex(4, 8),
    kn: [0, 2, 0, 0.06],
    grow: new Float32Array(8),
  };
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// What the four knobs mean.
function readKnobs(kn) {
  const k1 = cl(kn[0], 0, 1), k2 = cl(kn[1], 0, 4), k3 = cl(kn[2], -2, 2), k4 = cl(kn[3], -1, 1);
  return {
    hue: k1 + HUE0,
    life: LIFE_SLOW * pow(LIFE_FAST / LIFE_SLOW, k2 / 4),
    extra: 4 * pow((k3 + 2) / 4, 1.2), // mean number of rings after the first
    rbar: RB0 / pow(RB_STEP, k4),
  };
}

// The drop's radius as it lands: starts at 0.28 of it, reaches the full radius at 0.275 s, overshoots by 3.4% at 0.55 s and settles.
const spread = (t) => (t > 1.6 ? 1 : SP0 + (1 - SP0) * (1 - exp(-t / 0.18) * cos((2 * PI * t) / 1.1)));

function newDrop(S, P, age) {
  const R = cl(P.rbar * exp(0.28 * gauss()), R_MIN, R_MAX);
  // a spot with the least wet drop on it, out of six
  let cx = 0, cy = 0, best = 1e9;
  for (let c = 0; c < 6; c++) {
    const x = rnd() * W, y = rnd() * H;
    let sc = rnd() * 0.35;
    for (const o of S.drops) {
      if (o.age > o.T) continue;
      const dd = sqrt((x - o.cx) * (x - o.cx) + (y - o.cy) * (y - o.cy));
      sc += max(0, 1 - dd / (R + o.R));
    }
    if (sc < best) { best = sc; cx = x; cy = y; }
  }
  const T = cl(P.life * pow(R / P.rbar, 0.6) * (0.8 + 0.45 * rnd()), 4, 70);
  // the rings: the outer edge sticks for a good part of the life, then lets go and sticks again further in
  const nmax = 1 + floor((R - R_INNER) / SP_GAP);
  let n = max(1, min(nmax, 6, 1 + floor(P.extra + rnd())));
  const sp = n > 1 ? max(SP_GAP, ((R - R_INNER) / (n - 1 + 0.6)) * (0.85 + 0.3 * rnd())) : 0;
  while (n > 1 && R - (n - 1) * sp * 1.1 < R_INNER) n--;
  const rk = [R], ts = [0], te = [], wk = [1], lam = [2.1 + 0.035 * R], es = [0.55];
  if (n > 1) {
    const f0 = 0.42 + 0.12 * rnd();
    const wts = [];
    let tot = 0;
    for (let k = 1; k < n; k++) { const w = (0.8 + 0.4 * rnd()) * pow(0.92, k); wts.push(w); tot += w; }
    let acc = f0;
    for (let k = 1; k < n; k++) {
      rk.push(rk[k - 1] - sp * (0.9 + 0.2 * rnd()));
      ts.push(acc * T);
      acc += ((1 - f0) * wts[k - 1]) / tot;
      wk.push((0.85 + 0.12 * rnd()) * pow(0.94, k - 1));
      lam.push(1.7 + 0.02 * R);
      es.push(0.8);
    }
  }
  for (let k = 0; k < n; k++) te.push(k + 1 < n ? ts[k + 1] : T);
  const second = rnd() < P_B;
  return {
    cx, cy, R, T, age, n, rk, ts, te, wk, lam, es,
    eoff: (second ? DYE_B : 0) + cl(0.045 * gauss(), -0.08, 0.08),
    af: AF[0] + (AF[1] - AF[0]) * rnd(),
    m1: 5 + floor(rnd() * 5), m2: 11 + floor(rnd() * 6),
    p1: rnd() * 6.283, p2: rnd() * 6.283, p3: rnd() * 6.283, p4: rnd() * 6.283,
  };
}

// ---- how one drop leaves its mark
// Film, ring and edge light at distance r from the drop's centre, given how far each ring has grown. They land in QF, QR and QE.
let QF = 0, QR = 0, QE = 0;
function layersAt(d, r, grow) {
  const R = d.R, u = r / R;
  QF = d.af * sm(R + 1.0, R - 0.4, r) * (0.72 + 0.28 * min(1, u * u));
  let nr = 1, ne = 1;
  for (let k = 0; k < d.n; k++) {
    const g = grow[k];
    if (g <= 0) continue;
    const dd = d.rk[k] - r; // positive inside the ring
    if (dd < -2.8 || dd > d.lam[k] * 5.5) continue;
    const o = sm(-d.es[k], d.es[k], dd);
    const tl = dd > 0 ? exp(-dd / d.lam[k]) : 1;
    const p = min(1, 1.5 * o * tl) * d.wk[k] * g;
    const hx = (-dd - 0.95) / 0.62;
    nr *= 1 - 0.97 * p;
    ne *= 1 - (k === 0 ? 0.4 : 0.12) * exp(-hx * hx) * g;
  }
  QR = 1 - nr;
  QE = 1 - ne;
}

const ONES = new Float32Array(8).fill(1);

// The drop has dried: its film, rings and edge light go onto the glass.
function stampDrop(S, d) {
  const e = d.eoff;
  const x0 = max(0, floor(d.cx - d.R - 3.5)), x1 = min(W - 1, ceil(d.cx + d.R + 3.5));
  const y0 = max(0, floor(d.cy - d.R - 3.5)), y1 = min(H - 1, ceil(d.cy + d.R + 3.5));
  const fa = S.fa, fc = S.fc, ra = S.ra, rc = S.rc, ea = S.ea;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - d.cx, dy = y + 0.5 - d.cy, r = sqrt(dx * dx + dy * dy);
      if (r > d.R + 3.5) continue;
      layersAt(d, r, ONES);
      const i = y * W + x;
      if (QF > 0.002) {
        // the new glaze lies over the older rings and edge light, as it does while the drop is still wet
        const cv = 1 - pow(QF, FILM_POW) * FILM_GAIN;
        ra[i] *= cv; rc[i] *= cv; ea[i] *= cv;
        fc[i] = fc[i] * (1 - QF) + QF * e; fa[i] += QF * (1 - fa[i]);
      }
      if (QR > 0.002) { rc[i] = rc[i] * (1 - QR) + QR * e; ra[i] += QR * (1 - ra[i]); }
      if (QE > 0.002) { ea[i] += QE * (1 - ea[i]); }
    }
  }
}

// A landing drop dissolves the older stain under it.
function dissolve(S, d, dt) {
  const Rs = d.R * spread(d.age);
  const k1 = 1 - exp(-DISS_K * dt);
  const x0 = max(0, floor(d.cx - Rs - 1.5)), x1 = min(W - 1, ceil(d.cx + Rs + 1.5));
  const y0 = max(0, floor(d.cy - Rs - 1.5)), y1 = min(H - 1, ceil(d.cy + Rs + 1.5));
  const fa = S.fa, fc = S.fc, ra = S.ra, rc = S.rc, ea = S.ea;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - d.cx, dy = y + 0.5 - d.cy, r = sqrt(dx * dx + dy * dy);
      const ins = cl(Rs - r + 1, 0, 1);
      if (ins <= 0) continue;
      const m = 1 - k1 * ins, i = y * W + x;
      fa[i] *= m; fc[i] *= m; ra[i] *= m; rc[i] *= m; ea[i] *= m;
    }
  }
}

function decay(S, dt) {
  const mf = exp(-dt / TAU_F), mr = exp(-dt / TAU_R), me = exp(-dt / TAU_E);
  const fa = S.fa, fc = S.fc, ra = S.ra, rc = S.rc, ea = S.ea;
  for (let i = 0; i < NP; i++) {
    fa[i] *= mf; fc[i] *= mf; ra[i] *= mr; rc[i] *= mr; ea[i] *= me;
    if (fa[i] < 1e-4) { fa[i] = 0; fc[i] = 0; }
    if (ra[i] < 1e-4) { ra[i] = 0; rc[i] = 0; }
    if (ea[i] < 1e-4) ea[i] = 0;
  }
}

function advance(S, dt, P) {
  S.time += dt;
  for (let j = S.drops.length - 1; j >= 0; j--) {
    const d = S.drops[j];
    d.age += dt;
    if (d.age < DISS_T + dt) dissolve(S, d, dt);
    if (d.age >= d.T + FADE) {
      stampDrop(S, d);
      S.drops.splice(j, 1);
    }
  }
  S.dacc += dt;
  if (S.dacc >= S.decayStep) {
    decay(S, S.dacc);
    S.dacc = 0;
  }
  // the next drop: a rate that would hold the wet share of the panel, nudged by how far it is from it now
  let wet = 0;
  for (const d of S.drops) if (d.age < d.T) wet += PI * d.R * d.R * 0.9;
  const target = WET_FRAC * NP;
  const meanR2 = P.rbar * P.rbar * 1.17;
  const lam = (target / (PI * meanR2 * (P.life * 1.05 + FADE))) * cl(target / max(wet, 500), 0.35, 2.5);
  S.next -= dt;
  const awake = S.drops.reduce((c, d) => c + (d.age < d.T ? 1 : 0), 0);
  if ((S.next <= 0 || awake < 2) && S.drops.length < MAX_DROPS) {
    S.drops.push(newDrop(S, P, 0));
    S.next = (0.45 + 0.55 * -log(1 - rnd() * 0.999)) / lam;
    if (awake < 2) S.next = min(S.next, 0.4);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  const P = readKnobs(kn);
  if (!S.ready) {
    S.ready = true;
    S.decayStep = 1;
    for (let t = 0; t < PRE; t += PRE_DT) advance(S, PRE_DT, P);
    S.decayStep = DECAY_STEP;
  }
  advance(S, d, P);
}

// ---- drawing
const ease = (x) => { const t = cl(x, 0, 1); return t * t * (3 - 2 * t); };
const hIdx = (h) => ((h - floor(h)) * HN) | 0;

function drawDrop(S, d, hue) {
  const t = d.age, T = d.T;
  const bufR = S.bufR, bufG = S.bufG, bufB = S.bufB, grow = S.grow;
  // which stage the contact line is in, and where it sits
  let k = 0;
  while (k + 1 < d.n && t >= d.ts[k + 1]) k++;
  let Rc = d.rk[k];
  if (k > 0) {
    const s = t - d.ts[k];
    if (s < SLIP_T) Rc = d.rk[k - 1] + (d.rk[k] - d.rk[k - 1]) * ease(s / SLIP_T);
  }
  for (let j = 0; j < d.n; j++) grow[j] = t >= T ? 1 : j < k ? 1 : j === k ? 0.04 + 0.96 * pow(cl((t - d.ts[k]) / (d.te[k] - d.ts[k]), 0, 1), 0.85) : 0;
  const f = t > T ? cl((t - T) / FADE, 0, 1) : 0; // the snap
  const ws = (1 - f) * (1 - f);
  Rc *= spread(t) * (1 - 0.3 * ease(f));
  const prog = cl(t / T, 0, 1), Hn = max(0, 1 - prog);
  const hx = hIdx(hue + d.eoff), hi = hx * 3, fgain = FILM_GAIN * (1 + 0.8 * WARM[hx]);
  const fr = FILM[hi], fg = FILM[hi + 1], fb = FILM[hi + 2];
  const rr = RING[hi], rg = RING[hi + 1], rb = RING[hi + 2];
  const er = EDGE[hi], eg = EDGE[hi + 1], eb = EDGE[hi + 2];
  const wr = WET[hi], wg = WET[hi + 1], wb = WET[hi + 2];
  const pr = pow(prog, 1.2), pf = pow(prog, 1.5);
  const reach = max(d.R * 1.06, Rc) + 3.5;
  const x0 = max(0, floor(d.cx - reach)), x1 = min(W - 1, ceil(d.cx + reach));
  const y0 = max(0, floor(d.cy - reach)), y1 = min(H - 1, ceil(d.cy + reach));
  const gx = d.cx - 0.38 * Rc, gy = d.cy - 0.42 * Rc, gs = max(1.7, 0.14 * Rc);
  const rip = t < 0.7 ? (1 - t / 0.7) * (1 - t / 0.7) * 0.45 : 0, ripR = d.R * (0.1 + 1.05 * min(1, t / 0.7));
  const flow = min(1, t / 1.0) * (1 - pow(prog, 3)) * ws;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - d.cx, dy = y + 0.5 - d.cy, r = sqrt(dx * dx + dy * dy);
      if (r > reach) continue;
      const i = y * W + x;
      let R = bufR[i], G = bufG[i], B = bufB[i];
      const lc = cl(Rc - r + 0.5, 0, 1) * (t < 0.04 ? t / 0.04 : 1);
      layersAt(d, r, grow);
      // the glaze: already there in the dry ring left outside the lens, and coming in under the lens as it thins
      const fw = min(1, pow(QF, FILM_POW) * fgain) * (k > 0 ? 1 - lc * ws * (1 - pf) : lc * pf * (1 - f) + f);
      R += (fr - R) * fw; G += (fg - G) * fw; B += (fb - B) * fw;
      if (lc > 0) {
        const wL = lc * ws, u = min(1, r / Rc), u2 = u * u;
        const aL = (0.3 + 0.22 * Hn) * wL;
        R += (wr - R) * aL; G += (wg - G) * aL; B += (wb - B) * aL;
        // thick in the middle, dark there
        const sh = 1 - 0.34 * Hn * pow(1 - u2, 1.2) * wL;
        R *= sh; G *= sh; B *= sh;
        // the particles crowding towards the rim
        const cc = 0.55 * pr * sm(0.55, 1.0, u) * wL;
        R += (rr - R) * cc; G += (rg - G) * cc; B += (rb - B) * cc;
        // soft streaks running outwards
        if (flow > 0.01) {
          const th = atan2(dy, dx);
          const st = sin(d.m1 * th + d.p1) * cos(2 * PI * (1.0 * u - 0.28 * t) + d.p2) + 0.6 * sin(d.m2 * th + d.p3) * cos(2 * PI * (1.5 * u - 0.4 * t) + d.p4);
          const sg = 1 + (0.16 * st * sm(0.2, 0.55, u) * (0.3 + u) + 0.2 * sm(0.3, 1, u) * sm(0.3, 1, u)) * flow * lc;
          R *= sg; G *= sg; B *= sg;
        }
      }
      if (QR > 0.002) { R += (rr - R) * QR; G += (rg - G) * QR; B += (rb - B) * QR; }
      if (QE > 0.002) { R += (er - R) * QE; G += (eg - G) * QE; B += (eb - B) * QE; }
      if (lc > 0) {
        const wL = lc * ws;
        // the bright rim of the lens, the glint of a lamp and the ripple of the landing
        const rx = (Rc - r - 0.8) / 1.2;
        let add = exp(-rx * rx) * (0.25 + 0.75 * Hn) * 0.5 * (1 - 0.55 * grow[k]) * (1 + 1.4 * sin(PI * f));
        const gd = ((x + 0.5 - gx) * (x + 0.5 - gx) + (y + 0.5 - gy) * (y + 0.5 - gy)) / (2 * gs * gs);
        const gl = gd < 6 ? exp(-gd) * 0.5 * pow(Hn, 0.7) : 0;
        let ripple = 0;
        if (rip > 0) { const q = (r - ripR) / 1.5; ripple = exp(-q * q) * rip; }
        add = (add + ripple) * wL;
        R += (er - R) * add + (255 - R) * gl * wL * 0.8;
        G += (eg - G) * add + (255 - G) * gl * wL * 0.8;
        B += (eb - B) * add + (255 - B) * gl * wL * 0.8;
      }
      bufR[i] = R; bufG[i] = G; bufB[i] = B;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = cl(S.kn[0], 0, 1) + HUE0;
  const bufR = S.bufR, bufG = S.bufG, bufB = S.bufB, fa = S.fa, fc = S.fc, ra = S.ra, rc = S.rc, ea = S.ea;
  const ph = S.time * 0.045, wa = cos(ph) * cos(ph), wb = 1 - wa;
  // two sheens slide over the glass in different directions, a LED in 1.1 s and in 1.6 s
  const ax = floor(S.time * 0.9), ay = floor(S.time * 0.5), bx = W - floor(S.time * 0.6), by = floor(S.time * 0.8);
  for (let i = 0; i < NP; i++) {
    const x = i & 63, y = i >> 6;
    const sh = S.sheenA[((y + ay) & 127) * W + ((x + ax) & 63)] * wa + S.sheenB[((y + by) & 127) * W + ((x + bx) & 63)] * wb;
    const gm = 0.92 + 0.16 * sh;
    let R = GROUND[0] + GROUND_V[0] * sh, G = GROUND[1] + GROUND_V[1] * sh, B = GROUND[2] + GROUND_V[2] * sh;
    const a = fa[i];
    if (a > 0.003) {
      const hx = hIdx(fc[i] / a + hue), hi = hx * 3, q = min(1, pow(a, FILM_POW) * FILM_GAIN * (1 + 0.8 * WARM[hx]));
      R += (FILM[hi] - R) * q; G += (FILM[hi + 1] - G) * q; B += (FILM[hi + 2] - B) * q;
    }
    const b = ra[i];
    if (b > 0.003) {
      const hi = hIdx(rc[i] / b + hue) * 3;
      R += (RING[hi] - R) * b; G += (RING[hi + 1] - G) * b; B += (RING[hi + 2] - B) * b;
    }
    const c = ea[i];
    if (c > 0.003) {
      const hi = hIdx((b > 0.02 ? rc[i] / b : a > 0.02 ? fc[i] / a : 0) + hue) * 3;
      R += (EDGE[hi] - R) * c; G += (EDGE[hi + 1] - G) * c; B += (EDGE[hi + 2] - B) * c;
    }
    bufR[i] = R * gm; bufG[i] = G * gm; bufB[i] = B * gm;
  }
  for (const d of S.drops) drawDrop(S, d, hue);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      display.setPixel(x, y, cl(bufR[i], 0, 255) | 0, cl(bufG[i], 0, 255) | 0, cl(bufB[i], 0, 255) | 0);
    }
  }
}
