// ===== Patternflow pattern =====
// Title:   Blooming Gel
// Family:  cosmetic
// Idea:    Drops of tinted gel polish land one by one on a wet blooming base and spread into soft flowers with feathered edges, their pigment swept ahead of the spreading gel into a deeper rim like a watercolour back-run, until a cure lamp passes down the panel and sets the design and the nail is wiped for a fresh base.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 36, after blooming gel nail art, with the drop's gel spreading by the porous medium equation and its Barenblatt fronts (G. I. Barenblatt, 1952) and its pigment run ahead to the front like a watercolour back-run
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bloom=0..1, Rim=0..1
//
// Knob 1: Hue. Turns the base and both tints once round the wheel; white stays white. At 0 cobalt and lilac drops on a pale lilac base; at 0.1 violet and orchid; at 0.25 raspberry and coral on rose; at 0.35 brick red and peach; at 0.42 orange and yellow on cream; at 0.5 yellow and lime; at 0.6 lime and green; at 0.75 jade and aqua on mint; at 0.9 azure and cobalt. From orange to lime the tints stay near full brightness, so a thick rim deepens toward red or orange instead of going brown or olive, and the base pales to cream.
// Knob 2: Speed. The clock. At 2 a drop lands every 0.35 to 0.8 seconds for 6.2 seconds, the cure lamp passes down the panel in 1.4 seconds, the design rests 1.2 seconds and the wipe takes 1.2, a round every 10.3 seconds; at 0.2 all of it runs ten times slower, at 3 half as fast again.
// Knob 3: Bloom. How big a drop is and how freely its gel spreads. At 0 a drop 12 LEDs across blooms to about 25 across in two seconds; at 0.5 one 15 across blooms to 34; at 1 one 18 across blooms to 38, and the blooms crowd into each other.
// Knob 4: Rim. How far ahead of the gel the pigment runs where the gel thins toward its front. At 0 the outer 4 LEDs of a bloom hold about 1.7 times the pigment of its middle, a soft deeper edge; at 0.06 about twice; at 0.5 about ten times; at 1 some seventy times, nearly all of it in a dark ring with the middle gone pale, a coffee ring.
// Buttons: K1 tap lands a drop now; once the cure lamp has started, the nail is wiped to a fresh base first.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, exp, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// The gel lives on a coarse grid of CW x CH cells, 2 LEDs each; its
// pigment on the LEDs themselves.
const CW = W / 2, CH = H / 2, CN = CW * CH;
// Tiles of 8 x 8 LEDs: only the wet ones and their neighbours are worked.
const TS = 8, TW = W / TS, TH = H / TS;
// Pigments: two tints and white.
const NK = 3;
// The drop's gel spreads as w_t = div(D w grad w), the porous medium
// equation, whose fronts move at a finite speed; D in LED^2 a second at
// Speed 2. The gel soaks into the base, losing SOAK of itself a second, and
// pigment moves only where the gel is thicker than WET.
const SOAK = 0.06, WET = 0.006;
// One painting round in seconds of nail time: drops land until PAINT, the
// cure lamp passes from CURE to HOLD, the design rests, and the wipe runs
// from WIPE to ROUND.
const PAINT = 6.2, CURE = 6.5, HOLD = 7.9, WIPE = 9.1, ROUND = 10.3;

export function setup(params) {
  const S = {
    hue: 0, speed: 2, bloom: 0, rim: 0.06, t: 0, next: 0, first: true, gmob: 1,
    g: new Float32Array(CN), dg: new Float32Array(CN), Gx: new Float32Array(CN), Gy: new Float32Array(CN), set: 0, lamp: -99,
    w: new Float32Array(N), wt: new Float32Array(N), Mx: new Float32Array(N), My: new Float32Array(N),
    p: [new Float32Array(N), new Float32Array(N), new Float32Array(N)], dp: [new Float32Array(N), new Float32Array(N), new Float32Array(N)],
    tile: new Uint8Array(TW * TH), act: new Uint8Array(TW * TH),
    c: [0, 0, 0], col: [new Float32Array(3), new Float32Array(3)], base: [0, 0, 0],
    lastKind: 0, lastX: 32, lastY: 64,
  };
  freshBase(S);
  params.s = S;
}

// Smooth value noise on a grid of cells LEDs, in -1..1, for a w x h field.
function noise(cells, w, h) {
  const gw = Math.ceil(w / cells) + 2, gh = Math.ceil(h / cells) + 2, g = new Float32Array(gw * gh), out = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = random() * 2 - 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / cells, v = y / cells, i = floor(u), j = floor(v), fu = u - i, fv = v - j;
      const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
      const a = g[j * gw + i], b = g[j * gw + i + 1], c = g[(j + 1) * gw + i], d = g[(j + 1) * gw + i + 1];
      out[y * w + x] = (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
    }
  return out;
}

// A fresh blooming base: clear, and unevenly wet, which is what feathers
// the blooms. The gel's mobility varies up to sixfold over 6 to 12 LEDs,
// which bends the fronts into lobes; the pigment's more over 2 to 5 LEDs,
// which mottles the colour inside a bloom.
function freshBase(S) {
  const a = noise(3, CW, CH), b = noise(1.5, CW, CH), m = new Float32Array(CN);
  let mm = 0;
  for (let i = 0; i < CN; i++) mm = max(mm, (m[i] = exp(0.6 * a[i] + 0.3 * b[i])));
  S.gmob = mm;
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x;
      S.Gx[i] = x < CW - 1 ? 0.5 * (m[i] + m[i + 1]) : 0;
      S.Gy[i] = y < CH - 1 ? 0.5 * (m[i] + m[i + CW]) : 0;
    }
  const c = noise(2.5, W, H), d = noise(1.2, W, H), f = new Float32Array(N), e = noise(4, W, H);
  // And how thick the gel must be before pigment can enter, which varies
  // fourfold or more from LED to LED: that frays the edges.
  for (let i = 0; i < N; i++) S.wt[i] = WET * exp(1.2 * d[i] + 0.8 * e[i]);
  for (let i = 0; i < N; i++) f[i] = exp(0.9 * c[i] + 0.5 * d[i]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      S.Mx[i] = x < W - 1 ? 0.5 * (f[i] + f[i + 1]) : 0;
      S.My[i] = y < H - 1 ? 0.5 * (f[i] + f[i + W]) : 0;
    }
  S.g.fill(0);
  S.w.fill(0);
  for (let k = 0; k < NK; k++) S.p[k].fill(0);
  S.set = 0;
}

// A drop of gel lands: a small dome of gel carrying one pigment.
// Its outline is a little wavy, four to seven soft lobes.
function drop(S, x0, y0, kind) {
  const r = 6 + 3 * S.bloom, h0 = 0.5 + 0.25 * S.bloom, R = r * 1.25 + 1;
  const lobes = 4 + floor(random() * 4), ph = random() * 2 * PI, amp = 0.1 + 0.1 * random();
  const shape = (dx, dy) => (dx * dx + dy * dy) / (r * r * (1 + amp * sin(lobes * Math.atan2(dy, dx) + ph)) ** 2);
  for (let y = max(0, floor((y0 - R) / 2)); y <= min(CH - 1, (y0 + R) / 2); y++)
    for (let x = max(0, floor((x0 - R) / 2)); x <= min(CW - 1, (x0 + R) / 2); x++) {
      const d2 = shape(2 * x + 1 - x0, 2 * y + 1 - y0);
      if (d2 < 1) S.g[y * CW + x] += h0 * (1 - d2);
    }
  const P = S.p[kind];
  for (let y = max(0, floor(y0 - R)); y <= min(H - 1, y0 + R); y++)
    for (let x = max(0, floor(x0 - R)); x <= min(W - 1, x0 + R); x++) {
      const d2 = shape(x + 0.5 - x0, y + 0.5 - y0);
      if (d2 < 1) P[y * W + x] += 0.8 * h0 * (1 - d2);
    }
  S.lastKind = kind;
  S.lastX = x0;
  S.lastY = y0;
}

// The next drop: near the last one as often as not, so blooms meet, and
// never the same pigment twice running.
function nextDrop(S) {
  let x, y;
  if (random() < 0.5) {
    const a = random() * 2 * PI, d = 14 + random() * 14;
    x = S.lastX + d * cos(a);
    y = S.lastY + d * sin(a) * 1.4;
  } else {
    x = 8 + random() * (W - 16);
    y = 8 + random() * (H - 16);
  }
  x = cl(x, 6, W - 6);
  y = cl(y, 6, H - 6);
  // After a tint, white one time in three; never white twice.
  const kind = S.lastKind === 2 ? (random() < 0.5 ? 0 : 1) : random() < 0.67 ? 1 - S.lastKind : 2;
  drop(S, x, y, kind);
}

// One explicit step of the gel on its coarse grid: finite volumes, the flux
// across a face D w (w_j - w_i) / h^2 with w the mean of the two cells.
function gelStep(S, dt, D) {
  const { g, dg, Gx, Gy } = S, k = (D * dt) / 4;
  dg.fill(0);
  for (let y = Math.ceil(S.set / 2); y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = y * CW + x, gi = g[i];
      if (x < CW - 1) {
        const gj = g[i + 1];
        if (gi > 0 || gj > 0) {
          const q = k * Gx[i] * 0.5 * (gi + gj) * (gj - gi);
          dg[i] += q;
          dg[i + 1] -= q;
        }
      }
      if (y < CH - 1) {
        const gj = g[i + CW];
        if (gi > 0 || gj > 0) {
          const q = k * Gy[i] * 0.5 * (gi + gj) * (gj - gi);
          dg[i] += q;
          dg[i + CW] -= q;
        }
      }
    }
  const soak = exp(-SOAK * dt), dry = 0.004 * dt;
  for (let i = 0; i < CN; i++) {
    const v = (g[i] + dg[i]) * soak - dry;
    g[i] = v > 0 ? v : 0;
  }
}

// The gel's thickness on the LEDs, bilinear from the coarse grid, and which
// tiles have any.
function upsample(S) {
  const { g, w, tile } = S;
  tile.fill(0);
  for (let y = 0; y < H; y++) {
    const v = cl(y / 2 - 0.25, 0, CH - 1.0001), j = v | 0, fy = v - j;
    for (let x = 0; x < W; x++) {
      const u = cl(x / 2 - 0.25, 0, CW - 1.0001), i = u | 0, fx = u - i, q = j * CW + i;
      const val = (g[q] * (1 - fx) + g[q + 1] * fx) * (1 - fy) + (g[q + CW] * (1 - fx) + g[q + CW + 1] * fx) * fy;
      w[y * W + x] = val;
      if (val > WET) tile[((y / TS) | 0) * TW + ((x / TS) | 0)] = 1;
    }
  }
}

// One explicit step of the pigment over the wet tiles. In the body of a
// bloom it goes with the gel, at the gel's mean velocity -D grad w; where the
// gel thins toward its front it rides the surface, up to beta = 3.5 + 5.5 Rim
// times as fast, so it runs ahead to the front and piles up there, since it
// can only go where there is gel. Within the gel it spreads a little.
function pigmentStep(S, dt, D, beta) {
  const { w, wt, Mx, My, p, dp, tile, act } = S;
  act.fill(0);
  for (let ty = 0; ty < TH; ty++)
    for (let tx = 0; tx < TW; tx++)
      if (tile[ty * TW + tx])
        for (let j = max(0, ty - 1); j <= min(TH - 1, ty + 1); j++) for (let i = max(0, tx - 1); i <= min(TW - 1, tx + 1); i++) act[j * TW + i] = 1;
  const p0 = p[0], p1 = p[1], p2 = p[2], d0 = dp[0], d1 = dp[1], d2 = dp[2];
  const kap = 1.2 * dt, edge = 0.03 + 0.05 * S.rim;
  for (let t = 0; t < TW * TH; t++) {
    if (!act[t]) continue;
    const x0 = (t % TW) * TS, y0 = ((t / TW) | 0) * TS;
    for (let y = y0; y < y0 + TS; y++) {
      const r = y * W;
      d0.fill(0, r + x0, r + x0 + TS);
      d1.fill(0, r + x0, r + x0 + TS);
      d2.fill(0, r + x0, r + x0 + TS);
    }
  }
  for (let t = 0; t < TW * TH; t++) {
    if (!act[t]) continue;
    const x0 = (t % TW) * TS, y0 = ((t / TW) | 0) * TS;
    for (let y = max(y0, Math.ceil(S.set)); y < y0 + TS; y++)
      for (let x = x0; x < x0 + TS; x++) {
        const i = y * W + x, wi = w[i];
        for (let f = 0; f < 2; f++) {
          if (f === 0 ? x === W - 1 : y === H - 1) continue;
          const j = f === 0 ? i + 1 : i + W, wj = w[j];
          if (wi < WET && wj < WET) continue;
          if (p0[i] + p1[i] + p2[i] + p0[j] + p1[j] + p2[j] < 1e-4) continue;
          const m = f === 0 ? Mx[i] : My[i];
          // Upwind: the pigment of the LED the gel leaves. The surface's lead
          // fades in below a gel thickness of about edge.
          const wf = 0.5 * (wi + wj);
          let v = -dt * D * (1 + (beta - 1) * (edge / (wf + edge))) * m * (wj - wi);
          v = v > 0.2 ? 0.2 : v < -0.2 ? -0.2 : v;
          let a0 = 0, a1 = 0, a2 = 0;
          if (v > 0 && wj > wt[j]) (a0 = v * p0[i]), (a1 = v * p1[i]), (a2 = v * p2[i]);
          else if (v < 0 && wi > wt[i]) (a0 = v * p0[j]), (a1 = v * p1[j]), (a2 = v * p2[j]);
          if (wi > wt[i] && wj > wt[j]) {
            const k = kap * m < 0.04 ? kap * m : 0.04;
            a0 -= k * (p0[j] - p0[i]);
            a1 -= k * (p1[j] - p1[i]);
            a2 -= k * (p2[j] - p2[i]);
          }
          d0[i] -= a0;
          d0[j] += a0;
          d1[i] -= a1;
          d1[j] += a1;
          d2[i] -= a2;
          d2[j] += a2;
        }
      }
  }
  for (let t = 0; t < TW * TH; t++) {
    if (!act[t]) continue;
    const x0 = (t % TW) * TS, y0 = ((t / TW) | 0) * TS;
    for (let y = y0; y < y0 + TS; y++)
      for (let x = x0; x < x0 + TS; x++) {
        const i = y * W + x;
        p0[i] += d0[i];
        p1[i] += d1[i];
        p2[i] += d2[i];
      }
  }
}

function advance(S, dt) {
  const t0 = S.t % ROUND;
  S.t += dt;
  const t1 = S.t % ROUND;
  const D = 150 + 150 * S.bloom, beta = 3.5 + 5.5 * S.rim;
  if (t1 < t0) {
    freshBase(S);
    S.next = 0.2;
  }
  // Drops while painting.
  if (t1 < PAINT) {
    S.next -= dt;
    if (S.next <= 0) {
      S.next = 0.35 + 0.45 * random();
      nextDrop(S);
    }
  }
  // The cure lamp passes down the panel and sets each row it has passed: the
  // gel and its pigment stop moving there.
  S.lamp = t1 >= CURE && t1 < HOLD + 0.2 ? ((t1 - CURE) / (HOLD - CURE)) * (H + 20) - 10 : -99;
  if (S.lamp > -99) S.set = max(S.set, cl(S.lamp, 0, H));
  // The wipe pushes the colour down ahead of it and lifts it off.
  if (t1 >= WIPE) {
    const row = ((t1 - WIPE) / (ROUND - WIPE)) * (H + 24) - 12;
    for (let y = H - 1; y >= 0; y--) {
      const f = cl((row - y) / 10, 0, 1);
      if (f <= 0) continue;
      for (let k = 0; k < NK; k++) {
        const P = S.p[k];
        for (let x = 0; x < W; x++) {
          const i = y * W + x, v = P[i] * f * 0.3;
          P[i] -= v + 0.25 * f * P[i];
          if (y < H - 1) P[i + W] += v;
        }
      }
    }
  }
  // The gel in explicit steps short enough to hold steady, at most twelve
  // a frame: for the moment a fresh drop is thickest, nail time runs a
  // little slow rather than the sums running away.
  let gm = 0;
  for (let i = 0; i < CN; i++) if (S.g[i] > gm) gm = S.g[i];
  if (gm <= 0) {
    S.w.fill(0);
    return;
  }
  const lim = 0.8 / (D * S.gmob * gm), n = min(12, Math.ceil(dt / lim)), h = min(dt / n, lim);
  for (let s = 0; s < n; s++) gelStep(S, h, D);
  upsample(S);
  // The pigment in one or two steps. No face passes on more than 0.24 of a
  // LED's pigment in one, so even a LED emptying through all four faces
  // keeps a little and none goes below zero.
  const m = dt > 0.04 ? 2 : 1;
  for (let s = 0; s < m; s++) pigmentStep(S, (n * h) / m, D, beta);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.bloom = cl(k[2], 0, 1);
  S.rim = cl(k[3], 0, 1);
  if (S.first) {
    // Open with three drops already landing, spread down the panel.
    for (let n = 0; n < 3; n++) drop(S, 18 + 28 * random(), 22 + 40 * n + 12 * random(), n);
    S.first = false;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    // Once the lamp has started, a new drop needs a fresh base first.
    if (S.t % ROUND >= CURE) {
      S.t = (floor(S.t / ROUND) + 1) * ROUND;
      freshBase(S);
      S.next = 0.6;
    }
    nextDrop(S);
  }
  advance(S, (d * S.speed) / 2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { w, p, col, base, c } = S;
  // Colours: a milky base, two tints round the hue, white. Each tint is a
  // pigment that takes light away as exp(-a p) (Beer-Lambert), its strength
  // a set so a full drop shows the tint.
  // From orange to lime a pale base reads khaki, so there it is paler still.
  const h = S.hue + 0.66, hb = h + 0.04 - floor(h + 0.04), warm = sm(0.02, 0.07, hb) * (1 - sm(0.3, 0.38, hb));
  hsv(h + 0.04, 0.2 - 0.08 * warm, 0.85 + 0.08 * warm, base);
  // The tints: a deep one on the hue and a lighter one 0.1 round from it.
  // Round orange and yellow both are lifted to near full, so a thick rim
  // deepens toward red or orange instead of going brown or olive.
  for (let k = 0; k < 2; k++) {
    const ht = h + 0.1 * k, hk = ht - floor(ht), wk = sm(0.0, 0.05, hk) * (1 - sm(0.28, 0.36, hk));
    hsv(ht, k ? 0.7 : 0.88, (k ? 0.76 : 0.58) + (k ? 0.18 : 0.34) * wk, c);
    for (let ch = 0; ch < 3; ch++) col[k][ch] = max(0, -Math.log(max(c[ch], 0.03) / base[ch]) / 0.15);
  }
  const p0 = p[0], p1 = p[1], p2 = p[2], lb = S.lamp > -99 ? 1 : 0, sh = ((S.t % ROUND) - CURE) * 40 - 30;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, a = p0[i], b = p1[i], wh = 1 - exp(-8 * p2[i]);
      let r = base[0] * exp(-col[0][0] * a - col[1][0] * b);
      let g = base[1] * exp(-col[0][1] * a - col[1][1] * b);
      let bl = base[2] * exp(-col[0][2] * a - col[1][2] * b);
      r += (0.97 - r) * wh;
      g += (0.97 - g) * wh;
      bl += (0.97 - bl) * wh;
      // Wet gel shines: a highlight from the slope of its surface.
      const wi = w[i];
      if (wi > 0) {
        const gx = (x < W - 1 ? w[i + 1] : wi) - (x > 0 ? w[i - 1] : wi), gy = (y < H - 1 ? w[i + W] : wi) - (y > 0 ? w[i - W] : wi);
        const nx = -gx * 14, ny = -gy * 14, nn = 1 / sqrt(1 + nx * nx + ny * ny);
        const sp = (nx * -0.3 + ny * -0.45 + 0.84) * nn, s4 = sp * sp, s8 = s4 * s4, s16 = s8 * s8;
        const gl = 0.45 * s16 * min(1, wi * 12);
        r += gl;
        g += gl;
        bl += gl;
      }
      // The cure lamp's band, and the set coat's sheen behind it.
      if (lb > 0) {
        const q = (y - S.lamp) / 4, b2 = exp(-q * q) * lb;
        r += 0.42 * b2;
        g += 0.36 * b2;
        bl += 0.5 * b2;
      }
      if (y < S.set) {
        const q = (x * 0.5 + y - sh) / 9, b3 = 0.1 * exp(-q * q);
        r += b3;
        g += b3;
        bl += b3;
      }
      display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, bl * 255));
    }
}
