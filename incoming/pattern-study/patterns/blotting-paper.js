// ===== Patternflow pattern =====
// Title:   Blotting Paper
// Family:  cosmetic
// Idea:    A thin tinted sheet of oil-blotting paper with its fibres showing hangs in front of a lit wall and, pressed to skin we never see, takes up oil where each pore touches it: translucent spots open with a deeper rim at their wet edge and widen with the square root of time, running a little ahead along the fibres and into one another, and wherever the paper has gone clear the wall shines through brighter and deeper in tint, until most of the sheet glows, holds, and a fresh sheet slides down over it.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 39, after oil-blotting paper pressed to the skin, going translucent where the sebum wicks into its fibres (Lucas-Washburn wicking: Richard Lucas, 1918; Edward Washburn, 1921)
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pores=20..80, Grain=0..1
//
// Knob 1: Hue. Turns the paper's tint round the whole wheel; the dry paper is a dim pale tint and the clear spots the same hue, deeper. At 0 rose, at 0.05 red, 0.1 coral, 0.15 apricot, 0.2 butter, 0.25 pale yellow, 0.3 lime, 0.4 green, 0.5 aqua, 0.6 sky blue, 0.7 blue, 0.8 violet, 0.9 orchid. From 0.02 to 0.34 the dry paper is lifted up to 1.5 times and paled toward grey and the spots a little paler, so red, orange and yellow paper never reads brown or olive.
// Knob 2: Speed. At 2 the first pores touch 0.4 s after a sheet is pressed and the last about 6.5 s after; a tenth of the sheet is clear by 2.5 s, half by 6.7 s and nine tenths by 13 s, then it holds 2.5 s and a fresh sheet slides down in 1.4 s, about 16 s a sheet. At 0.2 the wicking is ten times slower, at 3 one and a half times faster; the slide always takes 1.4 s.
// Knob 3: Pores. How many pores touch the sheet, each later one where the paper is still dry: 20 at the start, whose widest spots reach about 45 LEDs across before they meet, up to 80 at the top, about 24 across. Each spot's radius goes as the square root of its age, and the more pores, the slower each one spreads, so the sheet clears in about the same time.
// Knob 4: Grain. How far the fibres line up along the panel. Up to 0.06 they lie every which way and the spots stay round; at 1 nearly all run up and down, nearly twice as long, and the oil runs along them two and a half times as fast as across, so the spots stretch into tall ovals and the clear patches join in columns.

const W = 64, H = 128, N = W * H;
// Opening tint: rose.
const H0 = 0.94;
// Fibres in a sheet, the width of the wicking front in LEDs, and how far the
// oil runs ahead along a fibre.
const NF = 440, FRONT = 2.6, AHEAD = 1.8;
// Brightness of the dry and the clear paper over the wall, 0..1.
const DRY = 0.24, CLEAR = 1;
// Sheet seconds at Speed 2: the hold, once 90% of the sheet is clear, and the
// slide of the next sheet in real seconds.
const HOLD = 2.5, SLIDE = 1.4;
// Sheet seconds for the paper behind the front to soak to its clearest.
const SOAK = 2.5;
// Spreading rate: the area all the spots open together, in LEDs a second.
const RATE = 1290, LATE = 6.5;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A sheet: its fibres, its paper grain and the slow cockle that makes each
// spot a little uneven. The fibres come from their own generator, so the
// grain knob changes the fibres and never where the pores touch.
function sheet(seed, grain) {
  const F = new Float32Array(N), g = new Float32Array(N), r = rng(seed);
  const spread = 1 - 0.9 * grain;
  for (let f = 0; f < NF; f++) {
    const cx = r() * (W + 8) - 4, cy = r() * (H + 8) - 4, len = (4 + 11 * r()) * (1 + 0.8 * grain), a = PI / 2 + spread * (r() - 0.5) * PI, w = 0.35 + 0.65 * r();
    const dx = cos(a), dy = sin(a), n = Math.ceil(len / 0.5);
    for (let j = 0; j <= n; j++) {
      const s = (j / n - 0.5) * len, x = cx + dx * s, y = cy + dy * s, i = floor(x), k = floor(y), fx = x - i, fy = y - k;
      for (let b = 0; b < 2; b++)
        for (let c = 0; c < 2; c++) {
          const xx = i + c, yy = k + b;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          F[yy * W + xx] += 0.5 * w * (c ? fx : 1 - fx) * (b ? fy : 1 - fy);
        }
    }
  }
  for (let p = 0; p < N; p++) {
    F[p] = min(1, F[p]);
    g[p] = r() * 2 - 1;
  }
  // The cockle roughens the spots' edges; the flocs, clumps of fibres a few
  // LEDs across, cloud the paper where it has gone clear.
  const nz = noise(r, 7, 1), fl = noise(r, 9, 0.5);
  return { F, g, nz, fl, seed };
}

// Smooth value noise, -1..1, on a grid of cells `cell` LEDs wide, with a
// second octave of half the size at weight w2.
function noise(r, cell, w2) {
  const out = new Float32Array(N);
  for (const [c, w] of [[cell, 1], [cell / 2, w2]]) {
    const gw = Math.ceil(W / c) + 2, gh = Math.ceil(H / c) + 2, G = new Float32Array(gw * gh);
    for (let i = 0; i < G.length; i++) G[i] = r() * 2 - 1;
    for (let y = 0; y < H; y++) {
      const v = y / c, j = floor(v), fy = (v - j) * (v - j) * (3 - 2 * (v - j));
      for (let x = 0; x < W; x++) {
        const u = x / c, i = floor(u), fx = (u - i) * (u - i) * (3 - 2 * (u - i)), a = G[j * gw + i], b = G[j * gw + i + 1], e = G[(j + 1) * gw + i], d = G[(j + 1) * gw + i + 1];
        out[y * W + x] += (w * (a + (b - a) * fx + (e + (d - e) * fx - a - (b - a) * fx) * fy)) / (1 + w2);
      }
    }
  }
  return out;
}

// Where the pores touch: each the best of four tries at standing clear of
// the ones before it, so the first n are spread out for any n.
function pores(seed) {
  const r = rng(seed ^ 0x5bd1e995), out = [];
  for (let i = 0; i < 80; i++) {
    let best = null, bd = -1;
    for (let c = 0; c < 12; c++) {
      const x = r() * (W + 6) - 3, y = r() * (H + 6) - 3;
      let d = 1e9;
      for (const o of out) d = min(d, (o.x - x) ** 2 + (o.y - y) ** 2);
      if (d > bd) {
        bd = d;
        best = { x, y };
      }
    }
    // How fast it wicks, and a share of the time it touches.
    best.k = 0.75 + 0.5 * r();
    best.r = 0.85 + 0.3 * r();
    out.push(best);
  }
  return out;
}

// For every LED, the pore whose oil reaches it first: when that spot opened,
// how fast it spreads and how far the LED is from it. Lucas-Washburn: a spot's
// radius is k sqrt(t - t0), so the oil reaches distance d at t0 + (d / k)^2.
// Distance is stretched across the grain, cut short along the fibres and
// roughened by the cockle.
function wick(S) {
  const { F, nz } = S.cur, P = S.pores.slice(0, S.n), al = sqrt(1 + 1.5 * S.grain), T0 = S.T0, K = S.K, D = S.D;
  // The first pores touch 0.4 s after the press and the rest follow over
  // LATE seconds, each later one where the sheet is still dry.
  P.forEach((o, i) => (o.t0 = 0.4 + LATE * (i / S.n) ** 1.4 * o.r));
  // Each pore's k scaled so that n spots together open RATE LEDs a second.
  let sk = 0;
  for (const o of P) sk += o.k * o.k;
  const kk = sqrt(RATE / (PI * sk)), arr = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, rough = 1 + 0.3 * nz[p], ahead = AHEAD * F[p];
      let bt = 1e9, bi = 0, bd = 0;
      for (let i = 0; i < P.length; i++) {
        const o = P[i], dx = (x - o.x) * al, dy = (y - o.y) / al;
        const d = max(0, sqrt(dx * dx + dy * dy) * rough - ahead), k = o.k * kk, t = o.t0 + (d / k) * (d / k);
        if (t < bt) {
          bt = t;
          bi = i;
          bd = d;
        }
      }
      T0[p] = P[bi].t0;
      K[p] = P[bi].k * kk;
      D[p] = bd;
      arr[p] = bt;
    }
  // The hold starts when nine tenths of the sheet has been reached.
  arr.sort();
  S.full = arr[floor(0.9 * N)];
}

function lay(S, seed) {
  S.cur = sheet(seed, S.grain);
  S.pores = pores(seed);
  S.next = sheet(seed + 7919, S.grain);
  wick(S);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 20, grain: 0.06, t: 0, phase: 0, slide: 0, seed: floor(Math.random() * 1e9), begun: false,
    T0: new Float32Array(N), K: new Float32Array(N), D: new Float32Array(N), V: new Float32Array(N), C: new Float32Array(N),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 20, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const n = round(cl(k[2], 20, 80)), grain = cl(k[3], 0, 1);
  if (!S.begun) {
    S.n = n;
    S.grain = grain;
    lay(S, S.seed);
    S.begun = true;
  } else if (abs(grain - S.grain) > 0.01) {
    S.grain = grain;
    S.n = n;
    S.cur = sheet(S.cur.seed, grain);
    S.next = sheet(S.cur.seed + 7919, grain);
    wick(S);
  } else if (n !== S.n) {
    S.n = n;
    wick(S);
  }
  if (S.phase === 0) {
    S.t += (d * S.speed) / 2;
    if (S.t > S.full + HOLD) S.phase = 1;
  } else {
    // A fresh sheet slides down over the old one.
    S.slide += d / SLIDE;
    if (S.slide >= 1) {
      S.phase = 0;
      S.slide = 0;
      S.t = 0;
      S.seed = (S.seed + 7919) >>> 0;
      S.cur = S.next;
      S.pores = pores(S.seed);
      S.next = sheet(S.seed + 7919, S.grain);
      wick(S);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const { T0, K, D, V, C } = S, t = S.t, h = S.hue + H0, hh = h - floor(h);
  const pure = [0, 0, 0];
  {
    const x = hh * 6, i = floor(x) % 6, f = x - floor(x);
    pure[0] = [1, 1 - f, 0, 0, f, 1][i];
    pure[1] = [f, 1, 1, 1 - f, 0, 0][i];
    pure[2] = [0, 0, f, 1, 1, 1 - f][i];
  }
  // Orange and yellow paper goes brown when dim: there the dry paper is
  // lifted and paled.
  const warm = cl(1.6 - abs(hh - 0.12) / 0.1, 0, 1);
  const dryV = DRY * (1 + 0.5 * warm), dryS = 0.2 - 0.15 * warm, clrS = 0.56 - 0.1 * warm;
  // Each LED's brightness is its dry level until the oil reaches it and then
  // rises once, smoothly, to its clear level; nothing else on the sheet moves.
  const { F, g, fl } = S.cur;
  for (let y = 0; y < H; y++) {
    const vy = (y - 63.5) / 92;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, vx = (x - 31.5) / 46, wall = 0.84 + 0.16 * (1 - vx * vx - vy * vy);
      const m = K[p] * sqrt(max(0, t - T0[p])) - D[p], age = t - T0[p] - (D[p] / K[p]) ** 2;
      let s = cl(m / FRONT + 0.5, 0, 1);
      s = s * s * (3 - 2 * s);
      // Behind the front the paper keeps soaking up oil and clears further.
      const soak = age > 0 ? 1 - exp(-age / SOAK) : 0;
      const f = F[p], dry = dryV * wall * (1 + 0.5 * (f - 0.25) + 0.05 * g[p] + 0.06 * fl[p]), clr = CLEAR * wall * (1 - 0.17 * f + 0.03 * g[p] + 0.11 * fl[p]);
      V[p] = dry + (clr - dry) * (0.68 * s + 0.32 * soak);
      // The wet front carries a deeper rim of tint; it changes the colour,
      // not the brightness.
      C[p] = dryS + (clrS - dryS) * s + 1.2 * s * (1 - s);
    }
  }
  const edge = S.phase === 1 ? round(H * (1 - (1 - S.slide) ** 3)) : -1, nf = S.next.F, ng = S.next.g, nl = S.next.fl;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let v = V[p], c = C[p];
      if (y < edge) {
        // The fresh sheet, dry, its fibres sliding down with it.
        const q = (y - edge + H) * W + x, vx = (x - 31.5) / 46, vy = (y - 63.5) / 92;
        v = dryV * (0.84 + 0.16 * (1 - vx * vx - vy * vy)) * (1 + 0.5 * (nf[q] - 0.25) + 0.05 * ng[q] + 0.06 * nl[q]);
        c = dryS;
        if (y === edge - 1) v *= 1.5;
      } else if (edge >= 0 && y - edge < 3) v *= 0.45 + 0.18 * (y - edge);
      v = min(1, v);
      display.setPixel(x, y, round(255 * v * (1 - c + c * pure[0])), round(255 * v * (1 - c + c * pure[1])), round(255 * v * (1 - c + c * pure[2])));
    }
}
