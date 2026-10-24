// ===== Patternflow pattern =====
// Title:   Toner Pad
// Family:  cosmetic
// Idea:    A close-up of a cotton pad, a white nonwoven web of fine soft fibres crossing at random, where drops of tinted toner land one after another and wick outward, the wet front running ahead along the fibres in fingers while the soaked cotton turns translucent and glows with the toner's tint from the light behind, its fibres darker against it, until each patch dries back from its edges to white.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 35, after a cotton pad soaking up toner
// Round:   35
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Toner=0..1, Fibre=0..1
//
// Knob 1: Hue. The toner's tint, all the way round the wheel from rose at 0; the dry pad keeps only a breath of it. From coral round through orange and gold to lime the tint is laid paler and brighter, peach or butter, and the fibres in it go to a cool grey, because dark there reads brown and olive.
// Knob 2: Speed. How fast it all runs: at 2 a drop lands every 3.2 s, its front is most of the way out in a second and a half, holds, and the patch dries back over 3.6 s; at 0.2 ten times slower.
// Knob 3: Toner. How much toner each drop carries: at 0 it wets about 1800 LEDs, its fingers reaching about 33 LEDs from where it fell; at 1 three times as much, 5400 LEDs across the whole width, with fingers out to about 65.
// Knob 4: Fibre. How coarse the pad is: at 0 a fine web of about 400 thin strands, at 1 an open one of 120 thick ones; the coarser the web, the fewer strands the front runs along and the straighter its edges.
// Buttons: K1 tap lets a drop fall at once, away from the patches still wet.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const rnd = () => Math.random();
// Drops on the pad at once: a fifth, from quick taps, takes the place of the oldest.
const MAXD = 4;

function hsv(h, s, v, out, o) {
  const f = (n) => {
    const k = (n + (h - floor(h)) * 6) % 6;
    return v - v * s * max(0, min(k, 4 - k, 1));
  };
  out[o] = f(5);
  out[o + 1] = f(3);
  out[o + 2] = f(1);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    F: F(N), F2: F(N), tmp: F(N), CE: F(N), CS: F(N), CSE: F(N), CSW: F(N), J: F(N),
    drops: [], pool: [F(N), F(N), F(N), F(N), F(N)],
    // The heap's keys are 32-bit like the reach they are checked against, so a
    // key is never read as stale because it was rounded on the way in.
    hk: F(8 * N + 16), hv: new Int32Array(8 * N + 16),
    T: 0, next: 0, hue: 0, speed: 2, toner: 0, fibre: 0.06, webKey: NaN, started: false, col: F(12), key: NaN,
  };
}

// The web: fibres laid at random, each a slightly wavy strand, drawn soft
// into F (how much fibre each LED sees) and marked on the links between
// neighbouring LEDs it runs through, which is where the toner wicks fastest.
function web(S) {
  const g = S.fibre, Fd = S.F, CE = S.CE, CS = S.CS, CSE = S.CSE, CSW = S.CSW;
  Fd.fill(0);
  CE.fill(0);
  CS.fill(0);
  CSE.fill(0);
  CSW.fill(0);
  for (let i = 0; i < N; i++) S.J[i] = 0.9 + 0.2 * rnd();
  const count = floor(420 - 300 * g), wid = 0.6 + 1.4 * g;
  for (let f = 0; f < count; f++) {
    let x = -20 + rnd() * (W + 40), y = -20 + rnd() * (H + 40), th = rnd() * PI * 2, bend = 0;
    const len = 40 + 50 * rnd(), b = 0.45 + 0.55 * rnd();
    // Most strands carry the toner a little faster than the gaps; a few
    // carry it about six times as fast, and the front runs out along them.
    const u = rnd(), wick = 0.12 + 1.1 * u * u * u * u;
    let px = -1, py = -1;
    for (let t = 0; t < len; t += 0.6) {
      bend += (rnd() - 0.5) * 0.05;
      bend *= 0.95;
      th += bend * 0.5;
      x += 0.6 * cos(th);
      y += 0.6 * sin(th);
      if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) {
        px = -1;
        continue;
      }
      // Soft splat of the strand.
      const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy, o = iy * W + ix, w = 0.32 * b * wid;
      Fd[o] += w * (1 - fx) * (1 - fy);
      Fd[o + 1] += w * fx * (1 - fy);
      Fd[o + W] += w * (1 - fx) * fy;
      Fd[o + W + 1] += w * fx * fy;
      // The link it crossed.
      const cx = floor(x + 0.5), cy = floor(y + 0.5);
      if (px >= 0 && (cx !== px || cy !== py)) {
        const dx = cx - px, dy = cy - py, a = Math.min(cy, py) * W, k = wick;
        if (abs(dx) <= 1 && abs(dy) <= 1) {
          if (dy === 0) CE[cy * W + min(cx, px)] += k;
          else if (dx === 0) CS[a + cx] += k;
          else if (dx === dy) CSE[a + min(cx, px)] += k;
          else CSW[a + max(cx, px)] += k;
        }
      }
      px = cx;
      py = cy;
    }
  }
  for (let i = 0; i < N; i++) Fd[i] = 1 - exp(-Fd[i] * 1.6);
  // Deeper in the pad the fibres are out of focus: a second web, laid the
  // same way and blurred over five LEDs, gives the white its soft depth.
  const F2 = S.F2, tmp = S.tmp;
  F2.fill(0);
  for (let f = 0; f < 260; f++) {
    let x = rnd() * W, y = rnd() * H, th = rnd() * PI * 2;
    for (let t = 0; t < 50; t += 1) {
      th += (rnd() - 0.5) * 0.08;
      x += cos(th);
      y += sin(th);
      if (x >= 0 && y >= 0 && x < W && y < H) F2[floor(y) * W + floor(x)] += 0.5;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) {
        let a = 0;
        for (let k = -2; k <= 2; k++) a += F2[y * W + cl(x + k, 0, W - 1)];
        tmp[i] = a / 5;
      }
    for (let y = 0, i = 0; y < H; y++)
      for (let x = 0; x < W; x++, i++) {
        let a = 0;
        for (let k = -2; k <= 2; k++) a += tmp[cl(y + k, 0, H - 1) * W + x];
        F2[i] = a / 5;
      }
  }
  for (let i = 0; i < N; i++) F2[i] = 1 - exp(-F2[i] * 3);
}

// How far the toner has to wick to reach each LED from a drop at (x0, y0):
// the cheapest path, where crossing a link costs its length divided by how
// well fibres carry along it. A front at a given reach has run furthest
// along the fibres, so it is fingered and follows them.
function reach(S, d, x0, y0) {
  const hk = S.hk, hv = S.hv, CE = S.CE, CS = S.CS, CSE = S.CSE, CSW = S.CSW, J = S.J, LIM = 45;
  d.fill(1e9);
  let n = 0;
  const push = (k, v) => {
    let i = n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hk[p] <= k) break;
      hk[i] = hk[p];
      hv[i] = hv[p];
      i = p;
    }
    hk[i] = k;
    hv[i] = v;
  };
  for (let y = max(0, floor(y0 - 3)); y <= min(H - 1, floor(y0 + 3)); y++)
    for (let x = max(0, floor(x0 - 3)); x <= min(W - 1, floor(x0 + 3)); x++) {
      const r = Math.hypot(x + 0.5 - x0, y + 0.5 - y0);
      if (r < 3) {
        d[y * W + x] = r * 0.4;
        push(r * 0.4, y * W + x);
      }
    }
  const speed = (c) => 1 / (1 + 4.5 * c);
  while (n > 0) {
    const k = hk[0], v = hv[0];
    // Pop.
    n--;
    const lk = hk[n], lv = hv[n];
    let i = 0;
    while (true) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && hk[c + 1] < hk[c]) c++;
      if (hk[c] >= lk) break;
      hk[i] = hk[c];
      hv[i] = hv[c];
      i = c;
    }
    hk[i] = lk;
    hv[i] = lv;
    if (k > d[v] || k > LIM) continue;
    const x = v % W, y = (v - x) / W, j = J[v];
    const rel = (u, cost) => {
      const nk = k + cost * j;
      if (nk < d[u]) {
        d[u] = nk;
        push(nk, u);
      }
    };
    if (x < W - 1) rel(v + 1, speed(CE[v]));
    if (x > 0) rel(v - 1, speed(CE[v - 1]));
    if (y < H - 1) {
      rel(v + W, speed(CS[v]));
      if (x < W - 1) rel(v + W + 1, 1.414 * speed(CSE[v]));
      if (x > 0) rel(v + W - 1, 1.414 * speed(CSW[v]));
    }
    if (y > 0) {
      rel(v - W, speed(CS[v - W]));
      if (x > 0) rel(v - W - 1, 1.414 * speed(CSE[v - W - 1]));
      if (x < W - 1) rel(v - W + 1, 1.414 * speed(CSW[v - W + 1]));
    }
  }
  // Paths on a grid of LEDs come out in stair steps; two passes of a 3x3
  // blur round the front off while keeping its fingers.
  const tmp = S.tmp;
  for (let pass = 0; pass < 2; pass++) {
    for (let yy = 0, i = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++, i++) tmp[i] = (xx > 0 ? d[i - 1] : d[i]) + d[i] + (xx < W - 1 ? d[i + 1] : d[i]);
    for (let yy = 0, i = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++, i++) d[i] = ((yy > 0 ? tmp[i - W] : tmp[i]) + tmp[i] + (yy < H - 1 ? tmp[i + W] : tmp[i])) / 9;
  }
}

function drop(S, x, y, age) {
  if (S.drops.length >= MAXD) S.pool.push(S.drops.shift().d);
  const d = S.pool.pop();
  reach(S, d, x, y);
  S.drops.push({ d, x, y, t: age, R: spread(d, S.toner) });
}

// How far a drop's front runs: the reach at which the wet patch covers the
// area its toner can fill, 1800 LEDs at Toner 0 and 5400 at 1, whatever the
// web. Found by halving.
function spread(d, toner) {
  const A = 1800 + 3600 * toner;
  let lo = 0, hi = 40;
  for (let it = 0; it < 18; it++) {
    const R = (lo + hi) / 2;
    let n = 0;
    for (let i = 0; i < N; i++) if (d[i] < R) n++;
    if (n < A) lo = R;
    else hi = R;
  }
  return (lo + hi) / 2;
}

// Somewhere new: of six tries, the one furthest from every patch still wet.
function spot(S) {
  let bx = 32, by = 64, best = -1;
  for (let k = 0; k < 6; k++) {
    const x = 10 + rnd() * 44, y = 12 + rnd() * 104;
    let dd = 1e9;
    for (const e of S.drops) dd = min(dd, Math.hypot(x - e.x, (y - e.y) * 0.7));
    if (dd > best) (best = dd), (bx = x), (by = y);
  }
  return [bx, by];
}

// A drop's front: running out fast and slowing as the toner spreads thin,
// holding, then drying back from the far edges towards where it fell.
const TS = 0.8, THOLD = 3.2, TDRY = 3.6;
function front(e) {
  const t = e.t;
  if (t < 0) return -9;
  if (t < THOLD) return e.R * sqrt(1 - exp(-t / TS));
  const full = e.R * sqrt(1 - exp(-THOLD / TS));
  return full * (1 - (t - THOLD) / TDRY);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1], 0.2, 3);
  S.toner = cl(kv[2] || 0, 0, 1);
  S.fibre = cl(kv[3], 0, 1);
  const wk = Math.round(S.fibre * 25);
  if (wk !== S.webKey) {
    S.webKey = wk;
    web(S);
    for (const e of S.drops) {
      reach(S, e.d, e.x, e.y);
      e.R = spread(e.d, S.toner);
    }
  }
  if (!S.started) {
    S.started = true;
    // Open on a patch drying in the lower half and a fresh drop about to land higher up.
    drop(S, 22 + rnd() * 20, 88 + rnd() * 20, 4.2);
    drop(S, 22 + rnd() * 20, 26 + rnd() * 24, -0.2);
    S.next = 3.2;
  }
  const st = (d * S.speed) / 2;
  S.T += st;
  for (const e of S.drops) e.t += st;
  S.drops = S.drops.filter((e) => {
    if (e.t < THOLD + TDRY) return true;
    S.pool.push(e.d);
    return false;
  });
  S.next -= st;
  if ((input.btnPressed && input.btnPressed[0]) || S.next <= 0) {
    const [x, y] = spot(S);
    drop(S, x, y, 0);
    S.next = 3.2;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.started) return;
  const col = S.col, Fd = S.F, F2 = S.F2, T = S.T;
  const h = S.hue + 0.95, key = h;
  if (S.key !== key) {
    const hf = h - floor(h), wm = sm((hf + 0.03) / 0.06) * (1 - sm((hf - 0.24) / 0.06));
    hsv(h, 0.03, 1, col, 0);
    hsv(h, 0.55 - 0.2 * wm, 1, col, 3);
    col[6] = wm;
    S.key = key;
  }
  const wm = col[6];
  const fr = S.drops.map(front);
  // A drying patch also pales a little as it shrinks.
  const mo = S.drops.map((e) => (e.t < THOLD ? 1 : 1 - (0.4 * (e.t - THOLD)) / TDRY));
  // A soft light behind the pad drifts slowly; wet cotton lets it through.
  const gx = 32 + 20 * sin(T * 0.43), gy = 64 + 44 * sin(T * 0.29 + 1);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i++) {
      let wet = 0, deep = 0;
      for (let k = 0; k < S.drops.length; k++) {
        const R = fr[k];
        if (R <= 0) continue;
        const dd = S.drops[k].d[i], w = sm((R - dd) / 1.6 + 0.5) * mo[k];
        if (w > wet) wet = w;
        const dp = w * cl(1 - dd / (R + 2), 0, 1);
        if (dp > deep) deep = dp;
      }
      const f = Fd[i], f2 = F2[i];
      const gdx = x - gx, gdy = y - gy, glow = exp(-(gdx * gdx + gdy * gdy) / 900);
      // Dry: matte white, the fibres a little brighter than the gaps.
      const ld = 0.8 + 0.1 * f2 + 0.12 * f + 0.06 * glow;
      // Wet: translucent and lit from behind in the toner's tint, deeper
      // towards where the drop fell, and the fibres dark against it. A dark
      // fibre in orange or gold would be a brown line, so the fibres go
      // towards a cool grey, there more and only half as dark.
      const lw = (0.94 + 0.04 * wm + 0.22 * glow) * (1 - 0.1 * deep - 0.12 * f2) * (1 - (0.58 - 0.3 * wm) * f), ti = 0.65 + 0.35 * deep;
      let wr = (col[0] + (col[3] - col[0]) * ti) * lw, wg = (col[1] + (col[4] - col[1]) * ti) * lw, wb = (col[2] + (col[5] - col[2]) * ti) * lw;
      const l0 = (0.94 + 0.04 * wm + 0.22 * glow) * (1 - 0.1 * deep - 0.12 * f2), ds = f * (0.25 + 0.55 * wm);
      wr += (0.4 * l0 - wr) * ds;
      wg += (0.43 * l0 - wg) * ds;
      wb += (0.5 * l0 - wb) * ds;
      let r = col[0] * ld + (wr - col[0] * ld) * wet, g = col[1] * ld + (wg - col[1] * ld) * wet, b = col[2] * ld + (wb - col[2] * ld) * wet;
      // A drop that has just landed sits as a glossy bead for a moment before
      // it soaks in: deeper tint under it and a highlight on its upper left.
      for (const e of S.drops) {
        if (e.t < 0 || e.t > 0.6) continue;
        const u = e.t / 0.6, rb = 3.2 * (1 - u * u), bx = x + 0.5 - e.x, by = y + 0.5 - e.y, q = (bx * bx + by * by) / (rb * rb + 0.01);
        if (q >= 1.6) continue;
        const cov = sm((1.3 - q) / 0.5), hx = bx / rb + 0.4, hy = by / rb + 0.4, hl = exp(-(hx * hx + hy * hy) * 5) * 0.6 * cov;
        r = r * (1 - 0.25 * cov) + hl;
        g = g * (1 - 0.25 * cov) + hl;
        b = b * (1 - 0.25 * cov) + hl;
      }
      display.setPixel(x, y, 255 * min(1, r), 255 * min(1, g), 255 * min(1, b));
    }
}
