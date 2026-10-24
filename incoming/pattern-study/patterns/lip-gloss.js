// ===== Patternflow pattern =====
// Title:   Lip Gloss
// Family:  cosmetic
// Idea:    A band of thick clear gloss is poured along the top of a pale wall and slides down it, its front swelling into a rim that breaks into drips of different lengths, each tipped with a round bead that holds a point of light, while a soft light glides down the film and the drips run off the bottom before a fresh pour.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 31, after clear lip gloss sliding down a tester wall
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pour=0..1, Shimmer=0..1
//
// Knob 1: Hue. The tint of the gloss, all the way round the colour wheel from rose at 0; the wall stays pale and takes only a breath of it.
// Knob 2: Speed. How fast the gloss runs: at 2 the longest drip reaches the bottom about five seconds after the pour starts and a fresh pour comes every eleven seconds; at 0.2 it all runs ten times slower.
// Knob 3: Pour. How much gloss each pour carries, from a thin band that breaks into three or four long drips at 0 to a heavy curtain at 1 that comes down the whole width with eight or nine short scallops on its front.
// Knob 4: Shimmer. Fine flecks of mica in the gloss that ride down with it and flash as they turn, from a clear gloss with a few dozen at 0 to a shimmer gloss packed with them at 1, its film turned pearly.
// Buttons: K1 tap pours a fresh band along the top now.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sqrt, sin, cos, exp, abs, pow, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The opening tint: rose, not red.
const H0 = 0.935;
// The film moves under gravity with a flux C*h^3 (a viscous film on a wall,
// speed going as thickness squared), so a film one unit thick runs C rows a
// second at its front at Speed 2. A pour lasts POUR seconds, one starts
// every CYCLE seconds.
const C = 30, POUR = 3, CYCLE = 11;
// Flecks of mica for the Shimmer knob, at most MAXF at once.
const MAXF = 700;
// Beads hanging from the bottom edge, at most MAXD; one lets go once it holds
// DROP units of gloss.
const MAXD = 24, DROP = 5;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  let r, g, b;
  if (i === 0) (r = v), (g = t), (b = p);
  else if (i === 1) (r = q), (g = v), (b = p);
  else if (i === 2) (r = p), (g = v), (b = t);
  else if (i === 3) (r = p), (g = q), (b = v);
  else if (i === 4) (r = t), (g = p), (b = v);
  else (r = v), (g = p), (b = q);
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    h: F(N), hr: F(N), q: F(H), m: F(W), front: new Int16Array(W), hf: F(W),
    T: 0, since: 0, pourLeft: 0, flow: 0, out: F(W),
    dx: F(MAXD), dv: F(MAXD), df: F(MAXD), dvy: F(MAXD), nd: 0,
    bx: F(MAXD * 3), by: F(MAXD * 3), br: F(MAXD * 3), nb: 0,
    fx: F(MAXF), fy: F(MAXF), fp: F(MAXF), fw: F(MAXF), nf: 0, cover: 0,
    hue: 0, rate: 1, amount: 0, shim: 0.06, started: false,
    tint: F(3), absb: F(3), wall: F(3), pear: F(3), gain: 1, buf: F(N * 3),
  };
}

// A fresh pour: how much gloss comes down each column. A film running down
// a wall breaks its front into fingers (Huppert 1982), the columns that get
// ahead taking more of the flow. Here the fingers are laid into the pour: a
// thin sheet across the whole width with bumps on it of different heights,
// and since the front runs at a speed that goes as thickness squared, each
// bump runs ahead as a drip of its own length.
function newPour(S) {
  const P = S.amount, m = S.m, nf = round(3 + 5 * P + rnd() * 0.8);
  const base = 0.1 + 0.95 * P;
  for (let x = 0; x < W; x++) m[x] = base * (0.9 + 0.2 * rnd());
  for (let k = 0; k < nf; k++) {
    const c = ((k + 0.5 + (rnd() - 0.5) * 0.7) / nf) * W, w = (1.6 + 1.3 * rnd()) * (1.3 - 0.4 * P);
    const a = (0.6 + 1.0 * rnd()) * (1 - 0.55 * P);
    for (let x = 0; x < W; x++) m[x] += a * exp(-(((x + 0.5 - c) / w) ** 2));
  }
  S.pourLeft = POUR * (1 - 0.35 * P);
  S.since = 0;
  S.flow = C * (0.85 + 0.6 * P);
}

function flecks(S, st) {
  // Mica hangs all through the gloss: new flecks turn up wherever the film is
  // thick enough to hold them, as many as Shimmer asks for the film there is,
  // and each rides down at the surface speed of the film under it, half as
  // fast again as the film's mean.
  const h = S.h, want = min(MAXF, S.shim * 1000 * S.cover);
  for (let tries = 0; tries < 60 && S.nf < want; tries++) {
    const x = rnd() * W, y = rnd() * H;
    if (h[floor(y) * W + floor(x)] < 0.15) continue;
    const i = S.nf++;
    S.fx[i] = x;
    S.fy[i] = y;
    S.fp[i] = rnd() * 2 * PI;
    S.fw[i] = (1.5 + 2.5 * rnd()) * (rnd() < 0.5 ? -1 : 1);
  }
  for (let i = S.nf - 1; i >= 0; i--) {
    const hh = h[floor(S.fy[i]) * W + floor(S.fx[i])];
    S.fy[i] += 1.5 * C * hh * hh * st;
    S.fp[i] += S.fw[i] * st;
    if (S.fy[i] >= H || hh < 0.06 || S.nf > want + 20) {
      const j = --S.nf;
      S.fx[i] = S.fx[j];
      S.fy[i] = S.fy[j];
      S.fp[i] = S.fp[j];
      S.fw[i] = S.fw[j];
    }
  }
}

function step(S, st) {
  S.T += st;
  S.since += st;
  if (S.since >= CYCLE) newPour(S);
  const h = S.h, q = S.q, m = S.m;
  // The pour feeds the top row; as it ends it tapers off over half a second.
  if (S.pourLeft > 0) {
    const f = S.flow * min(1, S.pourLeft * 2) * st;
    for (let x = 0; x < W; x++) h[x] += m[x] * f;
    S.pourLeft -= st;
  }
  // Each column runs down with flux C*h^3, worked upwind in steps short
  // enough for the fastest wave, which runs at 3*C*h^2.
  let hm = 0;
  for (let p = 0; p < N; p++) if (h[p] > hm) hm = h[p];
  const n = Math.ceil((st * 3 * C * hm * hm) / 0.8) || 1, dt = st / n;
  for (let k = 0; k < n; k++) {
    for (let x = 0; x < W; x++) {
      for (let y = 0, p = x; y < H; y++, p += W) {
        const v = h[p];
        q[y] = C * v * v * v;
      }
      h[x] -= dt * q[0];
      S.out[x] += dt * q[H - 1];
      for (let y = 1, p = x + W; y < H; y++, p += W) h[p] += dt * (q[y - 1] - q[y]);
    }
  }
  // Surface tension pulls a little gloss sideways, so the drips stay round.
  const D = min(0.2, 0.7 * st);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let prev = h[o];
    for (let x = 0; x < W; x++) {
      const c = h[o + x], r = x < W - 1 ? h[o + x + 1] : c;
      h[o + x] = c + D * (prev + r - 2 * c);
      prev = c;
    }
  }
  // A film thinner than 0.45 slowly soaks away, the thinner the faster, so
  // the wall clears from the top, where the draining film is thinnest, while
  // the drips stay.
  const fade = 0.075 * st;
  let cover = 0;
  for (let p = 0; p < N; p++) {
    const v = h[p];
    if (v < 0.45) h[p] = max(0, v - fade * (1 - v / 0.45));
    if (v > 0.15) cover++;
  }
  S.cover = cover / N;
  flecks(S, st);
  drops(S, st);
}

// What runs off the bottom row gathers into a bead hanging from the edge
// under its drip; a full bead lets go and falls away.
function drops(S, st) {
  const out = S.out;
  for (let x = 0; x < W; x++) {
    const v = out[x];
    if (v <= 0) continue;
    out[x] = 0;
    let b = -1, bd = 4.5;
    for (let i = 0; i < S.nd; i++) {
      const d = abs(S.dx[i] - x - 0.5);
      if (S.df[i] < 0 && d < bd) (bd = d), (b = i);
    }
    if (b < 0) {
      if (S.nd >= MAXD) continue;
      b = S.nd++;
      S.dx[b] = x + 0.5;
      S.dv[b] = 0;
      S.df[b] = -1;
    }
    const nv = S.dv[b] + v;
    S.dx[b] = (S.dx[b] * S.dv[b] + (x + 0.5) * v) / nv;
    S.dv[b] = nv;
  }
  for (let i = S.nd - 1; i >= 0; i--) {
    if (S.df[i] < 0) {
      // A bead nothing feeds any more slowly soaks away like the film.
      S.dv[i] -= 0.12 * st;
      if (S.dv[i] > DROP) (S.df[i] = 0), (S.dvy[i] = 20);
      else if (S.dv[i] < 0.05) S.df[i] = 99;
      continue;
    }
    S.dvy[i] += 500 * st;
    S.df[i] += S.dvy[i] * st;
    if (S.df[i] > 14) {
      const j = --S.nd;
      S.dx[i] = S.dx[j];
      S.dv[i] = S.dv[j];
      S.df[i] = S.df[j];
      S.dvy[i] = S.dvy[j];
    }
  }
}

// Adds a round bead of gloss, radius r and height A, centred at cx, cy.
function dome(S, cx, cy, r, A) {
  const { hr, h } = S;
  if (S.nb < MAXD * 3) {
    S.bx[S.nb] = cx;
    S.by[S.nb] = cy;
    S.br[S.nb++] = r;
  }
  for (let y = max(0, floor(cy - r)); y <= min(H - 1, floor(cy + r)); y++)
    for (let X = max(0, floor(cx - r)); X <= min(W - 1, floor(cx + r)); X++) {
      const dx = (X + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r, d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        const p = y * W + X;
        hr[p] = max(hr[p], h[p] + A * sqrt(1 - d2));
      }
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.rate = cl(k[1], 0.2, 3) / 2;
  S.amount = cl(k[2], 0, 1);
  S.shim = cl(k[3], 0, 1);
  if (!S.started) {
    S.started = true;
    newPour(S);
    // Open a second and a half into the first pour.
    for (let i = 0; i < 45; i++) step(S, 1 / 30);
  }
  if (input.btnPressed && input.btnPressed[0]) newPour(S);
  step(S, d * S.rate);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const { h, hr, front, hf, buf, tint, absb, wall } = S;
  const hue = H0 + S.hue;
  // How the gloss tints the light that goes through it: each channel is cut
  // by exp(-a*h), a taken from the tint so thick gloss is the deep colour.
  hsv(hue, 0.8, 1, tint, 0);
  for (let c = 0; c < 3; c++) absb[c] = -Math.log(max(0.2, tint[c])) * 0.95;
  // Orange and yellow tints darkened read brown and olive on LEDs; the wall
  // is bright enough that they stay clear, and they get a touch more light.
  const hw = (hue - floor(hue) + 1) % 1, am = max(0, 1 - abs(hw - 0.11) / 0.1);
  S.gain = 1 + 0.08 * am;
  // The wall: a pale warm white with a breath of the tint.
  hsv(hue + 0.04, 0.07, 1, wall, 0);
  // Each column's front and the rim behind it: walking up from the bottom,
  // every step where the film thickens adds to a ridge that fades over three
  // rows, the capillary ridge a running film piles up at its front.
  const kr = exp(-1 / 2.6);
  for (let x = 0; x < W; x++) {
    let r = 0, f = -1, fh = 0;
    for (let y = H - 1; y >= 0; y--) {
      const p = y * W + x, below = y < H - 1 ? h[p + W] : 0, jump = h[p] - below;
      r *= kr;
      if (jump > 0.02) r += jump * 0.9;
      if (f < 0 && h[p] > 0.1) (f = y), (fh = h[p]);
      hr[p] = h[p] + r;
    }
    front[x] = f;
    hf[x] = fh;
  }
  S.nb = 0;
  // Beads: where a column's front runs further than its neighbours', the
  // gloss gathers into a round bead at the tip of the drip.
  for (let x = 0; x < W; x++) {
    const f = front[x];
    if (f < 6 || f > H - 5) continue;
    let tip = true, lo = 1e9;
    for (let d = -3; d <= 3 && tip; d++) {
      if (!d) continue;
      const xx = x + d;
      if (xx < 0 || xx >= W) continue;
      if (front[xx] > f || (front[xx] === f && d < 0)) tip = false;
      lo = min(lo, front[xx]);
    }
    if (!tip || f - lo < 2) continue;
    const r = 2 + 1.8 * min(1.2, hf[x]);
    dome(S, x + 0.5, f + 0.6 - r * 0.55, r, 0.5 + 0.7 * min(1.2, hf[x]));
  }
  for (let i = 0; i < S.nd; i++) {
    const r = 1.3 + 1.2 * sqrt(S.dv[i]);
    dome(S, S.dx[i], H - 0.3 - r + max(0, S.df[i]), r, 0.6 + 0.15 * r);
  }
  // The light: a soft bar above the wall that glides down it, seen in the
  // gloss as a mirror image moved by the slope of the surface, and a small
  // lamp to one side that puts a point of light on every bead.
  const T = S.T, ys = ((T * 9) % (H + 60)) - 30, lxa = 0.25 * sin(T * 0.37), lya = -0.32 + 0.08 * sin(T * 0.23);
  let hx = lxa, hy = lya, hz = 1;
  const hl = sqrt(hx * hx + hy * hy + hz * hz);
  hx /= hl;
  hy /= hl;
  hz /= hl;
  const sh = S.shim, pear = S.pear;
  hsv(hue - 0.04, 0.3, 245, pear, 0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, t0 = hr[p], t = t0 / (1 + 0.25 * t0);
      const wb = (0.8 + 0.07 * exp(-(((x - 32) / 40) ** 2 + ((y - ys * 0.5 - 30) / 90) ** 2))) * 255;
      const film = sm(0.02, 0.14, t);
      let R = wall[0] * wb, G = wall[1] * wb, B = wall[2] * wb;
      if (film > 0) {
        const g = S.gain;
        R *= exp(-absb[0] * t) * g;
        G *= exp(-absb[1] * t) * g;
        B *= exp(-absb[2] * t) * g;
        // Mica scatters light back out of the gloss, a pearly haze of the
        // tint over the film that grows with Shimmer.
        const pe = 0.42 * sh * film;
        R += (pear[0] - R) * pe;
        G += (pear[1] - G) * pe;
        B += (pear[2] - B) * pe;
        const gx = (hr[x < W - 1 ? p + 1 : p] - hr[x > 0 ? p - 1 : p]) * 0.5;
        const gy = (hr[y < H - 1 ? p + W : p] - hr[y > 0 ? p - W : p]) * 0.5;
        let nx = -gx * 3, ny = -gy * 3, nz = 1;
        const nl = 1 / sqrt(nx * nx + ny * ny + 1);
        nx *= nl;
        ny *= nl;
        nz *= nl;
        // The bar seen in the gloss.
        const yr = y - ny * 22 + (x - 32) * 0.15, bar = exp(-(((yr - ys) / 5) ** 2)) * 0.26 * film;
        // The lamp: a sharp highlight where the surface faces half way
        // between it and the eye.
        const nd = max(0, nx * hx + ny * hy + nz * hz), spot = pow(nd, 200) * film;
        const s = (bar + spot * 1.3 * sm(0.08, 0.35, t)) * 255;
        R += s;
        G += s;
        B += s;
      }
      const q = p * 3;
      buf[q] = R;
      buf[q + 1] = G;
      buf[q + 2] = B;
    }
  // Every bead holds a point of light on the side towards the lamp, and the
  // light it gathers lands as a glow of the tint low on the far side.
  const pl = sqrt(hx * hx + hy * hy) || 1, ux = hx / pl, uy = hy / pl;
  for (let i = 0; i < S.nb; i++) {
    const r = S.br[i], cx = S.bx[i], cy = S.by[i];
    glow(buf, cx + ux * r * 0.42, cy + uy * r * 0.42, 0.55 + 0.04 * r, 235, 235, 235);
    glow(buf, cx - ux * r * 0.35, cy - uy * r * 0.35 + r * 0.15, r * 0.38, 110 * tint[0], 110 * tint[1], 110 * tint[2]);
  }
  // Mica flecks: a pale glint of the tint, flashing white as they turn to
  // the lamp, a bright flash spilling onto the four LEDs round it.
  for (let i = 0; i < S.nf; i++) {
    const x = floor(S.fx[i]), y = floor(S.fy[i]);
    const f = exp((cos(S.fp[i]) - 1) / 0.08), q = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) buf[q + c] += 70 * (0.4 + 0.6 * tint[c]) + 200 * f;
    if (f > 0.6)
      for (let k = 0; k < 4; k++) {
        const X = x + (k === 0 ? 1 : k === 1 ? -1 : 0), Y = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const o = (Y * W + X) * 3;
        buf[o] += 90 * f;
        buf[o + 1] += 90 * f;
        buf[o + 2] += 90 * f;
      }
  }
  for (let p = 0; p < N; p++) {
    const q = p * 3;
    display.setPixel(p % W, (p / W) | 0, knee(buf[q]), knee(buf[q + 1]), knee(buf[q + 2]));
  }
}

// A soft round spot of light, sigma s LEDs, added at x, y.
function glow(buf, x, y, s, r, g, b) {
  const e = s * 2.5, k = 1 / (2 * s * s);
  for (let Y = max(0, floor(y - e)); Y <= min(H - 1, floor(y + e)); Y++)
    for (let X = max(0, floor(x - e)); X <= min(W - 1, floor(x + e)); X++) {
      const w = exp(-((X + 0.5 - x) ** 2 + (Y + 0.5 - y) ** 2) * k), q = (Y * W + X) * 3;
      buf[q] += r * w;
      buf[q + 1] += g * w;
      buf[q + 2] += b * w;
    }
}

function knee(v) {
  return v < 200 ? v : 255 - 55 * exp(-(v - 200) / 55);
}
