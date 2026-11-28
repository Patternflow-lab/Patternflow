// ===== Patternflow pattern =====
// Title:   Taylor Dispersion
// Family:  taylordispersion
// Idea:    Slugs of dye in a slow channel flow are sheared into parabolic tongues, rounded off by diffusion across the channel, and folded back up when the flow turns round.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dispersion of a solute in laminar Poiseuille flow, the shear stretches it and diffusion across the channel evens it out (G. I. Taylor, 1953, from memory), its effective diffusivity D (1 + 2 Pe^2 / 105) between plates (Rutherford Aris, 1956, from memory), the film in which a slug of dye in glycerine is sheared into a tongue and wound back by turning the flow round (Taylor, 1960s, from memory), original code, pattern round 278
// Round:   278
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0..4, Diffusion=-1..1, Reversal=-1..1
//
// Knob 1: Hue. Turns the four dyes round the wheel together. At 0 they are rose, amber, teal-green and violet (hues 0.93, 0.105, 0.45, 0.75); at 0.5 the rose one is green, the amber one blue, the teal one rose and the violet one lime. The navy ground and the two wall strips stay put. Dye already in the channel turns with it.
// Knob 2: Flow. The speed of the middle of the channel against the walls, Um = 4 K rows a second, times a slow swing V(t) of three sines (23, 37 and 61 s) and a small push one way, rms about 0.55. At the opening Um is 8, the middle runs 3.2 rows a second on average and about 10 at the peaks, and a slug is a tongue 24 rows deep after 3 s at V = 1. At 0 nothing moves: slugs stay flat and only blur. At 4 everything is twice as fast: a tongue 32 rows deep after 2 s at V = 1.
// Knob 3: Diffusion. D = 4 x 3^K LED^2 a second across the channel, 1.3 at -1, 4 at 0, 12 at 1, and D / 9 along the rows. It stands for 1 / Pe. The lowest cross-channel mode of a tongue dies in 68 s at -1, 23 s at the opening and 7.6 s at 1, so at -1 the parabolas stay sharp and nested, at 1 they are round soft blobs within seconds. A 6 row slug sheared for 6 s at Um 8 (spread 1.7 to 14 rows) and turned back for 6 s came to a spread of 5.8 rows at -1, 8.9 at 0 and 12.6 at 1: the more diffusion, the less the fold-back undoes.
// Knob 4: Reversal. How often the whole flow is turned round, as in Taylor's film. A flip comes at 0.04 x 4^K a second at random (fading to none at -1, and not within 4 s of the last one), then the flow swings through zero and settles the other way within about 2 s. Over 1200 s: 0 flips a minute at -1, 0.95 at -0.5, 2.15 at the opening 0.06, 4.35 at 0.5, 5.7 at 1. The slow sines of Knob 2 turn the flow on their own, 2.8 sign changes a minute at -1 and 8.5 at 1 with the flips counted, so even at -1 the tongues unwind now and then.
//
// What the picture is. The panel is a stretch of a channel seen from a frame that moves with the mean flow: the walls are the two lighter 2 LED strips at the left and right, the flow runs down the rows, the middle of the channel goes one way and the layers at the walls go the other. Four dyes are let in as slugs across the channel, at random heights, thicknesses and colours, about one a second. A slug is sheared into a parabola, thin and pointed while the flow is fast and the diffusion low, then it rounds off and spreads, and where the flow turns it folds back into a slug as far as diffusion allows. There is always dye in every part of the 128 rows. No labels, no marks.
// What is exact and what is drawn. Exact: d c / d t + u(x) d c / d z = D (c_xx + c_zz / 9) on 60 columns by 128 rows for four dyes, with u = Um V(t) (1/3 - xi^2) and xi = (x - 31.5) / 30, so the mean is zero. No flux at the walls, zero at the top and bottom, so dye that diffuses past the ends is gone. Each column moves in whole rows with the rest carried, which has no numerical diffusion, and a column reads its neighbour at the same panel row with cubic interpolation. The spreading of a slug, with row diffusion off and D = 100 (out of the knob range), came out at 1.22 and 4.88 rows^2 a second at Um 4 and 8, and 8 Um^2 hw^2 / (945 D), the 2 Pe^2 / 105 term of D (1 + 2 Pe^2 / 105) in row units, gives 1.22 and 4.88. Drawn or added: one row is 3 LEDs of channel width, which is the / 9 in the equation, so a slug does not blur into haze before it forms a tongue; the dye bleaches with an e-fold of 14 s, otherwise old dye fills the panel with mud; the injector is a thermostat (rate 0.5 x (0.85 / glow)^2 swung by two slow sines, at the emptiest of three random heights, slugs of 3 to 27 rows, a third of them slanted, a third thicker on one side, one in eight a round patch); the flow programme; D itself is not stretched, hw^2 / (pi^2 D) is 68, 23 and 7.6 s; brightness (c - 0.12)^0.7; where dyes pile up the sum bends toward the strongest, so it does not go white.

const W = 64, H = 128, NX = 60, X0 = 2, NF = 4, PAD = 2, HP = H + 2 * PAD, N = NX * HP;
const { floor, ceil, exp, log, sin, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const QZ = 3;             // one row is this many LED widths along the channel
const GAM = 0.07;         // dye bleaching, 1/s
const LIGHT = 0.85;       // the glow the injector tries to keep on the panel, mean of the four lit dyes per cell
const GAIN = 215;         // light of a dye at concentration 1, of 255
const TH = 0.12;          // dye thinner than this is clear water
const PW = new Float32Array(2048);
for (let i = 0; i < 2048; i++) PW[i] = pow(max(0, i / 1000 - TH), 0.7);
const HWID = 30;          // half width of the channel, LEDs
const UM0 = 4;            // centre-to-wall speed per unit of the Flow knob, rows a second
const D0 = 4;             // diffusivity at Diffusion = 0, LED^2 a second
const PRE = 50;           // seconds run before the first frame
const HUES = [0.93, 0.105, 0.45, 0.75];   // rose, amber, teal-green, violet
const TP = [37, 61, 23, 47, 71];          // slow clocks, seconds

export function setup(params) {
  const mk = () => new Float32Array(N);
  const uP = new Float32Array(NX);
  for (let x = 0; x < NX; x++) { const xi = (x - (NX - 1) / 2) / HWID; uP[x] = 1 / 3 - xi * xi; }
  const th = TP.map(() => TAU * Math.random());
  params.s = {
    c: [mk(), mk(), mk(), mk()], t: [mk(), mk(), mk(), mk()], uP, off: new Float32Array(NX),
    th, sgn: 1, tgt: 1, since: 0, U: 0, inj: 0.3, nextCol: floor(Math.random() * 4),
    act: [], mt: 0, mass: 0, rs: new Float32Array(H), k: null, gam: GAM, dts: 0.05, col: new Float32Array(12),
  };
}

function inject(S) {
  const f = S.nextCol;
  S.nextCol = (f + 1 + (Math.random() < 0.3 ? 1 : 0)) % NF;
  const h = 3 * pow(9, Math.random());
  const c0 = cl(1.3 - 0.03 * h + 0.3 * (Math.random() - 0.5), 0.7, 1.4);
  // where: the emptiest of three random heights, as a person at the port would pick
  const rs = S.rs;
  rs.fill(0);
  for (let g = 0; g < NF; g++) {
    const a = S.c[g];
    for (let x = 0; x < NX; x++) { const b = x * HP + PAD; for (let z = 0; z < H; z++) rs[z] += a[b + z]; }
  }
  const win = h / 2 + 5;
  let z0 = 0, best = 1e9;
  for (let q = 0; q < 3; q++) {
    const zz = Math.random() * H;
    let o = 0;
    for (let z = max(0, floor(zz - win)); z <= min(H - 1, floor(zz + win)); z++) o += rs[z];
    o = o / (2 * win) * (0.6 + 0.8 * Math.random());
    if (o < best) { best = o; z0 = zz; }
  }
  // now and then the dye comes from a port and is a soft patch, not a slug across the channel
  const blob = Math.random() < 0.12, bw = 9 + 12 * Math.random(), bx = Math.random() * NX;
  const T = 0.8 + 0.8 * Math.random();
  // some slugs are put in slanted, or thicker on one side
  const tilt = Math.random() < 0.3 ? (Math.random() - 0.5) * 0.3 : 0;
  const gr = Math.random() < 0.3 ? (Math.random() - 0.5) * 1.2 : 0;
  S.act.push({ f, c0, z0, h, T, left: T, blob, bw, bx, tilt, gr });
}

function feed(S, dt) {
  for (let i = S.act.length - 1; i >= 0; i--) {
    const q = S.act[i], k = (q.c0 * min(dt, q.left)) / q.T, a = S.c[q.f];
    const ex = q.h / 2 + 5 + abs(q.tilt) * NX / 2, zlo = max(0, floor(q.z0 - ex)), zhi = min(H - 1, ceil(q.z0 + ex));
    for (let x = 0; x < NX; x++) {
      const b = x * HP + PAD, o = S.off[x] + 0.5;
      const w = k * (1 + q.gr * (x / NX - 0.5) * 2), zc = q.z0 + q.tilt * (x - NX / 2);
      // stored row z sits at z + off on the panel, so the slug is sampled there
      if (!q.blob) { for (let z = zlo; z <= zhi; z++) a[b + z] += w * sm(0, 1, 0.5 + (q.h / 2 - abs(z + o - zc)) / 1.6); continue; }
      const ux = (x + 0.5 - q.bx) / q.bw;
      if (ux * ux >= 1) continue;
      for (let z = zlo; z <= zhi; z++) {
        const uz = (z + o - q.z0) / (q.h * 0.5 + 2);
        const r2 = ux * ux + uz * uz;
        if (r2 < 1) a[b + z] += k * (1 - r2) * (1 - r2) * (3 - 2 * (1 - r2));
      }
    }
    q.left -= dt;
    if (q.left <= 0) S.act.splice(i, 1);
  }
}

// cubic weights for a sample t of the way from node 0 to node 1, nodes -1..2
function cub(t, w) {
  w[0] = -t * (t - 1) * (t - 2) / 6; w[1] = (t + 1) * (t - 1) * (t - 2) / 2;
  w[2] = -(t + 1) * t * (t - 2) / 2; w[3] = (t + 1) * t * (t - 1) / 6;
}
const WL = new Float64Array(4), WR = new Float64Array(4);

function diffuse(S, a) {
  const az = a / (QZ * QZ), kd = exp(-S.gam * S.dts), off = S.off;
  for (let f = 0; f < NF; f++) {
    const src = S.c[f], dst = S.t[f];
    for (let x = 0; x < NX; x++) {
      const b = x * HP + PAD;
      const xl = x > 0 ? x - 1 : x, xr = x < NX - 1 ? x + 1 : x;
      // a neighbour column is read where the same panel row sits in it, by cubic interpolation
      const dl = off[x] - off[xl], dr = off[x] - off[xr];
      const fl = floor(dl), fr = floor(dr);
      cub(dl - fl, WL); cub(dr - fr, WR);
      const l0 = WL[0], l1 = WL[1], l2 = WL[2], l3 = WL[3], r0 = WR[0], r1 = WR[1], r2 = WR[2], r3 = WR[3];
      const bl = xl * HP + PAD + fl, br = xr * HP + PAD + fr;
      for (let z = 0; z < H; z++) {
        const i = b + z, v = src[i], jl = bl + z, jr = br + z;
        const nl = l0 * src[jl - 1] + l1 * src[jl] + l2 * src[jl + 1] + l3 * src[jl + 2];
        const nr = r0 * src[jr - 1] + r1 * src[jr] + r2 * src[jr + 1] + r3 * src[jr + 2];
        const u = kd * (v + a * (nl + nr - 2 * v) + az * (src[i - 1] + src[i + 1] - 2 * v));
        dst[i] = u > 0 ? u : 0;
      }
    }
    S.c[f] = dst; S.t[f] = src;
  }
}

function shift(S, x, n) {
  const b = x * HP + PAD;
  for (let f = 0; f < NF; f++) {
    const a = S.c[f];
    if (n >= H || -n >= H) { a.fill(0, b, b + H); continue; }
    if (n > 0) { a.copyWithin(b + n, b, b + H - n); a.fill(0, b, b + n); }
    else { const m = -n; a.copyWithin(b, b + m, b + H); a.fill(0, b + H - m, b + H); }
  }
}

function simStep(S, dt) {
  const k = S.k, th = S.th;
  for (let i = 0; i < TP.length; i++) th[i] += (TAU * dt) / TP[i];
  const um = UM0 * cl(k[1], 0, 4), D = D0 * pow(3, cl(k[2], -1, 1));
  const kr = cl(k[3], -1, 1), lam = 0.04 * pow(4, kr) * sm(-1, -0.9, kr);
  // the flow: a reversing telegraph sign times a slow sum of sines
  S.since += dt;
  if (S.since > 4 && Math.random() < lam * dt) { S.tgt = -S.tgt; S.since = 0; }
  S.sgn += (S.tgt - S.sgn) * (1 - exp(-dt / 0.7));
  const V = 0.25 + 0.5 * sin(th[0]) + 0.35 * sin(th[1]) + 0.25 * sin(th[2]);
  S.U = um * V * S.sgn;
  const du = S.U * dt, uP = S.uP, off = S.off;
  for (let x = 0; x < NX; x++) {
    let o = off[x] + du * uP[x];
    const n = floor(o);
    if (n !== 0) { o -= n; shift(S, x, n); }
    off[x] = o;
  }
  S.mt -= dt;
  if (S.mt <= 0) {
    S.mt = 0.25;
    let m = 0;
    for (let f = 0; f < NF; f++) { const a = S.c[f]; for (let i = 0; i < N; i++) { const v = a[i]; if (v > TH) m += PW[min(2047, (v * 1000) | 0)]; } }
    S.mass = m / (NX * H);
  }
  const rate = 0.5 * (1 + 0.4 * sin(th[3]) + 0.3 * sin(th[4])) * pow(cl(LIGHT / (S.mass + 0.02), 0.4, 2.5), 2);
  S.inj -= rate * dt;   // the injections are a Poisson process whose rate follows the thermostat
  while (S.inj < 0) { inject(S); S.inj += -log(1 - Math.random()); }
  feed(S, dt);
  const ns = max(1, ceil((D * dt) / 0.3)), a = (D * dt) / ns;
  S.dts = dt / ns;
  for (let i = 0; i < ns; i++) diffuse(S, a);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    for (let i = 0; i < PRE * 10; i++) simStep(S, 0.1);
  } else {
    const al = 1 - exp(-d / 0.2);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
    simStep(S, d);
  }
}

const C = [0, 0, 0];
const knee = (v) => (v < 170 ? v | 0 : (170 + 85 * (1 - exp(-(v - 170) / 85))) | 0);   // overlapping dyes add, but do not burn to white

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const hue = S.k[0], col = S.col;
  for (let f = 0; f < NF; f++) { hsv(HUES[f] + hue, 0.9, 1, C); col[f * 3] = C[0]; col[f * 3 + 1] = C[1]; col[f * 3 + 2] = C[2]; }
  for (let x = 0; x < W; x++) {
    const cx = x - X0;
    if (cx < 0 || cx >= NX) {
      const e = x < 2 ? x : 63 - x;
      for (let y = 0; y < H; y++) {
        display.setPixel(x, y, e === 1 ? 20 : 11, e === 1 ? 52 : 32, e === 1 ? 74 : 50);
      }
      continue;
    }
    const b = cx * HP + PAD, o = S.off[cx];
    for (let y = 0; y < H; y++) {
      const fy = y - o, i0 = floor(fy), t = fy - i0;
      let r = 0, g = 0, bl = 0, sb = 0, qr = 0, qg = 0, qb = 0, q3 = 0;
      for (let f = 0; f < NF; f++) {
        const a = S.c[f];
        const v0 = a[b + i0], v1 = a[b + i0 + 1];
        const cc = v0 + (v1 - v0) * t;
        if (cc < TH) continue;
        const bt = PW[min(1300, (cc * 1000) | 0)];
        const w = 0.22 * sm(0.5, 1.4, cc), b3 = bt * bt * bt;
        const cr = col[f * 3] * (1 - w) + w, cg = col[f * 3 + 1] * (1 - w) + w, cb = col[f * 3 + 2] * (1 - w) + w;
        r += bt * cr; g += bt * cg; bl += bt * cb; sb += bt;
        qr += b3 * cr; qg += b3 * cg; qb += b3 * cb; q3 += b3;
      }
      // dyes add; where they pile up the sum bends toward the strongest, so it does not burn to white
      const m = q3 > 0 ? sm(0.8, 1.7, sb) : 0, qs = q3 > 0 ? (sb * m) / q3 : 0;
      r = 4 + GAIN * (r * (1 - m) + qr * qs); g = 13 + GAIN * (g * (1 - m) + qg * qs); bl = 24 + GAIN * (bl * (1 - m) + qb * qs);
      display.setPixel(x, y, knee(r), knee(g), knee(bl));
    }
  }
}
