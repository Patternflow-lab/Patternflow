// ===== Patternflow pattern =====
// Title:   Taylor Unmixing
// Family:  sim
// Idea:    Round drops of dye in a very viscous fluid between two walls are sheared by plane Couette flow into thin streaks that wrap round the panel many times and lay down a fine slanted lattice of colours, then the walls run back the same distance and the drops come back where they started, sharp when there is no diffusion and as fainter vertical smears when there is.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: plane Couette flow (Maurice Couette, 1890), shear dispersion (G. I. Taylor, 1953), kinematic reversibility of Stokes flow shown with dye in glycerine (G. I. Taylor, film "Low Reynolds Number Flows", 1966), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Turns=2..8, Diffusion=0..1
//
// Knob 1: Hue. Moves the seven dyes round the wheel together. At 0 they are lime, green, cyan, azure, blue, violet and pink; the seven sit evenly round the wheel, so every 1/7 of the knob the same set comes back with the colours handed on, and in between one dye passes through red. The wheel skips orange and yellow, which read brown and olive where a streak thins out.
// Knob 2: Speed. At 2 one cycle takes 10.4 seconds: 0.8 s at rest, 3.4 s of shearing, 0.6 s held, 3.4 s back, 1.4 s with the drops returned and 0.8 s while they fade and fresh drops take their place. At 0.2 it takes 104 s, at 3 it takes 6.9 s. Diffusion runs on the same clock, so Speed does not change how blurred the drops come back.
// Knob 3: Turns. How far each wall travels before it turns back, in panel heights: 2 to 8, so 256 to 1024 rows, the two walls going opposite ways. At 2 the shear across the 60 columns of fluid reaches 8.5, a drop 29 columns wide becomes a streak 247 rows long that wraps the panel almost twice, and its lines lie 15 columns apart; at 5 the shear reaches 21 and the lines 6 apart; at 8 it reaches 34, a drop wraps the panel 7.7 times and its lines lie 3.8 columns apart. The travel follows the knob over about half a second.
// Knob 4: Diffusion. The dye's diffusivity D = 0.6 k^3 LEDs squared per second. At 0 the drops return exactly, and at the opening 0.06 (D = 0.00013) they look the same. At 0.5 (D = 0.075) a drop comes back 1.4 times as tall at 2 turns and 4.6 times as tall at 8; at 1 (D = 0.6) 2.8 and 10 times as tall, with a third and a tenth of its brightness, and at 8 turns the dye has mixed into soft columns. The streaks blur first: at 8 turns a streak is 0.2 LED thick and diffusion crosses that almost at once, which is why a little D spoils the return.

const W = 64, H = 128, FL = 2, FR = 62, WF = FR - FL;
const { floor, ceil, min, max, abs, sqrt, exp, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
// The phases of one cycle, in seconds at Speed 2.
const T_REST = 0.8, T_FWD = 3.4, T_HOLD = 0.6, T_BACK = 3.4, T_BACKREST = 1.4, T_SWAP = 0.8;
const T_CYCLE = T_REST + T_FWD + T_HOLD + T_BACK + T_BACKREST + T_SWAP;
// The film opens in the middle of the forward stroke, so the first second is
// already streaks and the drops come back at 4.9 s.
const T_OPEN = T_REST + 0.75 * T_FWD;
const NB = 7;
// Each pixel is read as a small Gaussian of this variance, so a streak
// thinner than an LED dims in proportion instead of flickering.
const PIX = 0.1;
// Dye hues skip orange to lime: wheel(h) runs lime, green, cyan, blue, violet, pink, red.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Wall travel S at cycle time tau, as a fraction of the full travel.
function travel(tau) {
  if (tau < T_REST) return 0;
  tau -= T_REST;
  if (tau < T_FWD) return (1 - cos((PI * tau) / T_FWD)) / 2;
  tau -= T_FWD;
  if (tau < T_HOLD) return 1;
  tau -= T_HOLD;
  if (tau < T_BACK) return (1 + cos((PI * tau) / T_BACK)) / 2;
  return 0;
}

// A fresh set of drops: seven rows down the panel, each in one of three
// lanes across it, no two neighbours in the same lane.
function drops() {
  const set = [], hues = [0, 1, 2, 3, 4, 5, 6];
  for (let i = NB - 1; i > 0; i--) {
    const j = floor(Math.random() * (i + 1)), t = hues[i];
    hues[i] = hues[j];
    hues[j] = t;
  }
  const lanes = [13, 30, 47];
  let lane = floor(Math.random() * 3);
  const y0 = Math.random() * H;
  for (let i = 0; i < NB; i++) {
    lane = (lane + 1 + floor(Math.random() * 2)) % 3;
    const s = 5 + Math.random() * 1.6;
    set.push({
      x: lanes[lane] + (Math.random() - 0.5) * 5,
      y: y0 + (i * H) / NB + (Math.random() - 0.5) * 4,
      s0: s * s, sxx: s * s, sxy: 0, syy: s * s, hue: hues[i] / NB,
    });
  }
  return set;
}

// One step of the covariance under a shear g = dGamma over a time h with
// diffusivity D. For a shear rate constant over the step this is exact:
// Sigma' = F Sigma F^T + 2 D integral of F(s) F(s)^T, F = [[1, 0], [g, 1]].
function shearStep(b, g, h, D) {
  const sxx = b.sxx, sxy = b.sxy, syy = b.syy;
  b.syy = syy + 2 * g * sxy + g * g * sxx + 2 * D * (h + (g * g * h) / 3);
  b.sxy = sxy + g * sxx + D * g * h;
  b.sxx = sxx + 2 * D * h;
}

export function setup(params) {
  params.s = {
    tau: -1, smax: 0, S: 0, Sprev: 0, set: drops(), old: null,
    rgb: new Float32Array(W * H * 3), c: [0, 0, 0], hue: 0,
  };
}

function advance(S, dtau, D) {
  // Small steps, so the drops keep up with the walls at full speed.
  const n = max(1, ceil(dtau / 0.02));
  for (let k = 0; k < n; k++) {
    const t0 = S.tau, t1 = S.tau + dtau / n;
    const cyc = floor(t1 / T_CYCLE) > floor(t0 / T_CYCLE);
    const s1 = (cyc ? 0 : travel(t1 - floor(t1 / T_CYCLE) * T_CYCLE)) * S.smax;
    // The strain is taken from the travel actually made, so the total comes
    // back to exactly 0 with the walls even if Turns moved on the way.
    const g = (2 * (s1 - S.S)) / WF, h = t1 - t0;
    for (const b of S.set) shearStep(b, g, h, D);
    if (S.old) for (const b of S.old) shearStep(b, 0, h, D);
    S.tau = t1;
    S.S = s1;
    // The swap: the returned drops fade out while new ones are laid down.
    const ph = S.tau - floor(S.tau / T_CYCLE) * T_CYCLE;
    if (!S.old && ph >= T_CYCLE - T_SWAP) {
      S.old = S.set;
      S.set = drops();
    }
    if (cyc) S.old = null;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), turns = cl(kv[2], 2, 8), k4 = cl(kv[3], 0, 1);
  const D = 0.6 * k4 * k4 * k4;
  S.Sprev = S.S;
  if (S.tau < 0) {
    // First frame: run the cycle from its start to the opening point, so
    // the streaks carry the diffusion they would have gathered.
    S.smax = turns * H;
    S.tau = 0;
    advance(S, T_OPEN, D);
    S.Sprev = S.S;
    return;
  }
  // The travel follows the knob over about half a second, so the walls
  // never jump. The drops still come home, because S returns to 0.
  S.smax += (turns * H - S.smax) * min(1, d * 2.5);
  advance(S, (d * speed) / 2, D);
}

function drawSet(S, set, fade) {
  const rgb = S.rgb, c = S.c;
  for (const b of set) {
    const cx = b.x, cy = b.y + (2 * b.x / WF - 1) * S.S;
    const sxx = b.sxx + PIX, sxy = b.sxy, syy = b.syy + PIX;
    const det = sxx * syy - sxy * sxy, det0 = (b.s0 + PIX) * (b.s0 + PIX);
    // Dye is conserved: the peak falls as the patch spreads.
    const amp = sqrt(det0 / det) * fade;
    const v = det / sxx, sv = sqrt(v), slope = sxy / sxx;
    const R = min(H * 2, ceil(4.2 * sv));
    hsv(wheel(b.hue + S.hue), 0.85, 1, c);
    for (let col = FL; col < FR; col++) {
      const dx = col - FL + 0.5 - cx, wx = amp * exp((-0.5 * dx * dx) / sxx);
      if (wx < 0.004) continue;
      let mu = cy + slope * dx - 0.5;
      mu -= floor(mu / H) * H;
      const r0 = floor(mu) - R;
      // Gaussian down the column by recurrence: g(j+1) = g(j) e1, e1 *= e2.
      let dy = r0 - mu, g = wx * exp((-0.5 * dy * dy) / v), e1 = exp(-(2 * dy + 1) / (2 * v));
      const e2 = exp(-1 / v);
      for (let r = r0; r <= r0 + 2 * R + 1; r++) {
        if (g > 0.003) {
          const o = ((((r % H) + H) % H) * W + col) * 3;
          rgb[o] += c[0] * g;
          rgb[o + 1] += c[1] * g;
          rgb[o + 2] += c[2] * g;
        }
        g *= e1;
        e1 *= e2;
      }
    }
  }
}

function rings(S, set, w) {
  if (w < 0.01) return;
  const rgb = S.rgb, c = S.c;
  for (const b of set) {
    const r = 2.3 * sqrt(b.s0);
    hsv(wheel(b.hue + S.hue), 0.6, 1, c);
    for (let yy = floor(b.y - r - 2); yy <= b.y + r + 2; yy++)
      for (let xx = max(FL, floor(FL + b.x - r - 2)); xx <= min(FR - 1, FL + b.x + r + 2); xx++) {
        const dx = xx - FL + 0.5 - b.x, dy = yy + 0.5 - b.y, e = abs(sqrt(dx * dx + dy * dy) - r);
        if (e >= 0.9) continue;
        const v = 0.16 * w * (1 - e / 0.9), o = ((((yy % H) + H) % H) * W + xx) * 3;
        rgb[o] += c[0] * v;
        rgb[o + 1] += c[1] * v;
        rgb[o + 2] += c[2] * v;
      }
  }
}

// Wall ticks: one every 8 rows, a longer brighter one every 32, carried by
// the wall and smeared over the frame's travel.
function tick(y) {
  const m = y - floor(y / 32) * 32, u = m - floor(m / 8) * 8;
  const big = m < 8;
  return cl(1 - abs(u - (big ? 1.5 : 1)) / (big ? 1.8 : 1.1), 0, 1) * (big ? 1 : 0.6);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb;
  // The dark fluid.
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    rgb[o] = 0.008;
    rgb[o + 1] = 0.015;
    rgb[o + 2] = 0.034;
  }
  const ph = S.tau - floor(S.tau / T_CYCLE) * T_CYCLE;
  // The swap: the returned drops fade out, then the fresh ones fade in.
  const u = S.old ? cl((ph - (T_CYCLE - T_SWAP)) / T_SWAP, 0, 1) : 1;
  const fo = 1 - sm(u / 0.5), fn = sm((u - 0.4) / 0.6);
  if (S.old) drawSet(S, S.old, fo);
  drawSet(S, S.set, fn);
  // Where each drop started, as a faint ring at 2.3 sigma, the edge the
  // drop shows at. It comes up over the last 40% of the way back and goes
  // in the first 30% of the next stroke.
  let ring = 0;
  if (ph < T_REST) ring = 1;
  else if (ph < T_REST + 0.3 * T_FWD) ring = 1 - (ph - T_REST) / (0.3 * T_FWD);
  else if (ph > T_REST + T_FWD + T_HOLD + 0.6 * T_BACK) ring = min(1, (ph - (T_REST + T_FWD + T_HOLD + 0.6 * T_BACK)) / (0.4 * T_BACK));
  if (S.old) rings(S, S.old, ring * fo);
  rings(S, S.set, ring * fn);
  // The walls: left moves by -S, right by +S.
  const wc = hsv(0.6 + S.hue * 0.2, 0.2, 1, [0, 0, 0]);
  const ds = S.S - S.Sprev, n = min(40, max(1, ceil(abs(ds) * 1.5)));
  for (let r = 0; r < H; r++) {
    let tl = 0, tr = 0;
    for (let k = 0; k < n; k++) {
      const s = S.Sprev + (ds * (k + 0.5)) / n;
      tl += tick(r + 0.5 + s);
      tr += tick(r + 0.5 - s);
    }
    tl /= n;
    tr /= n;
    for (const [x, t] of [[0, tl], [1, tl], [62, tr], [63, tr]]) {
      const o = (r * W + x) * 3, v = 0.16 + 0.95 * t;
      rgb[o] = wc[0] * v;
      rgb[o + 1] = wc[1] * v;
      rgb[o + 2] = wc[2] * v;
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3) {
    const x = p % W, y = (p / W) | 0;
    if (x < FL || x >= FR) display.setPixel(x, y, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
    else display.setPixel(x, y, (255 * (1 - exp(-2.2 * rgb[o]))) | 0, (255 * (1 - exp(-2.2 * rgb[o + 1]))) | 0, (255 * (1 - exp(-2.2 * rgb[o + 2]))) | 0);
  }
}
