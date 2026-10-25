// ===== Patternflow pattern =====
// Title:   Leaf Devil
// Family:  halloween
// Idea:    A drift of orange, red and yellow leaves lies at the foot of a deep purple night until a dust devil spins up out of it, skids the pile in, lifts the leaves round and round a swaying funnel that climbs all 128 rows, flings them off the top and then breaks, and the leaves flutter and zigzag back down, flashing as they turn, onto a new pile.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 43; after autumn leaves caught in a dust devil on Halloween night
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Colour=0..1, Speed=0.2..3, Leaves=150..300, Wind=0..1
//
// Knob 1: Colour. Three nights round the knob: at 0 orange, red and yellow leaves with a few purple-black ones under a purple sky; at 0.33 toxic green and orange leaves under a green-black sky; at 0.67 orange, gold and violet leaves under a blue night. Each holds for 0.1 either side of its point and blends into the next in between, and 1 is 0 again.
// Knob 2: Speed. At 2 one round takes about 13 seconds: the devil spins up at 0.6 seconds, reaches the top of the panel 1.6 seconds later, spins for 4.2, breaks over 0.8, and the leaves are down about 5 seconds after that. At 0.2 a round takes about two minutes, at 3 about 9 seconds.
// Knob 3: Leaves, 150 to 300. With 150 the pile at the foot is 7 or 8 rows deep in the middle, with 300 about 16; the funnel takes up nearly all of them at once.
// Knob 4: Wind. A crosswind from the left: it leans the top of the funnel up to 20 LEDs to the right, makes the funnel half as wide again, widens its sway from 7 to 19 LEDs and blows the falling leaves along at up to 22 LEDs a second, so the new pile drifts to the right.
// Buttons: K1 tap is a gust: it throws the whole pile into the air at once and spins up a devil if none is turning.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, round, sin, cos, exp, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// The ground's top row; the pile stacks up from here.
const GROUND = 125;
const MAXLEAVES = 300;
// Leaf shapes as LED offsets, 2 to 4 LEDs: maple, oak, a slim willow leaf and
// a small curled one. The first offset is the stem end, drawn when edge on.
const SHAPES = [
  [[0, 0], [-1, -1], [1, -1], [0, -1]],
  [[0, 0], [1, 0], [0, -1]],
  [[0, 0], [1, -1]],
  [[0, 0], [1, 0], [1, -1]],
];
// Palettes, cycled by K1: sky at the top, sky at the horizon, ground, dust,
// and five leaf colours (the last is the dark one, given to 8% of leaves).
const PAL = [
  {
    top: [0.04, 0, 0.08], low: [0.2, 0.04, 0.3], ground: [0.05, 0.01, 0.06], dust: [0.5, 0.36, 0.62],
    leaf: [[1, 0.5, 0.04], [1, 0.14, 0.04], [1, 0.8, 0.08], [1, 0.33, 0.02], [0.36, 0.1, 0.5]],
  },
  {
    top: [0, 0.05, 0.04], low: [0.04, 0.2, 0.12], ground: [0.01, 0.05, 0.03], dust: [0.4, 0.62, 0.4],
    leaf: [[0.5, 1, 0.08], [1, 0.48, 0.04], [0.8, 1, 0.1], [1, 0.62, 0.05], [0.42, 0.08, 0.5]],
  },
  {
    top: [0.01, 0.02, 0.1], low: [0.08, 0.1, 0.32], ground: [0.02, 0.02, 0.07], dust: [0.45, 0.5, 0.72],
    leaf: [[1, 0.5, 0.04], [1, 0.75, 0.12], [0.72, 0.3, 1], [1, 0.3, 0.06], [0.45, 0.12, 0.62]],
  },
];
// The devil's phases, in seconds at Speed 2: calm, spin-up, full, break.
const CALM = 1.4, SPIN = 1.6, FULL = 4.2, BREAK = 0.8;

function rnd(a, b) {
  return a + (b - a) * Math.random();
}

function newLeaf(i) {
  const r = Math.random();
  return {
    i, state: 0, x: 0, y: 0, vx: 0, vy: 0, th: 0, rise: rnd(24, 40), rf: rnd(0.45, 1.1), ceil: 0, hover: null, bob: 0,
    phi: rnd(0, TAU), spin: rnd(5, 13) * (Math.random() < 0.5 ? -1 : 1), psi: rnd(0, TAU), wf: rnd(2.4, 4.4), af: rnd(14, 30),
    tumble: Math.random() < 0.3, quarter: floor(rnd(0, 4)), shape: floor(rnd(0, 4)), col: r < 0.08 ? 4 : floor(rnd(0, 4)), release: 0, hop: 0, order: i,
  };
}

export function setup(params) {
  params.s = {
    t: 0, tau: 0, speed: 2, count: 150, wind: 0.06, hue: 0,
    // Devil: phase 0 calm, 1 spin-up, 2 full, 3 break; time in phase; base x.
    phase: 0, ph: CALM - 0.6, x0: 32, x0v: 0, s: 0, top: GROUND, spinA: 0, life: 0,
    leaves: [], landed: 0, stack: new Float32Array(W),
    rgb: new Float32Array(N * 3), sky: new Float32Array(N * 3), skyHue: NaN, pal: null,
    stars: [], wasDown: false,
  };
  const S = params.s;
  for (let i = 0; i < MAXLEAVES; i++) S.leaves.push(newLeaf(i));
  // The first pile: leaves dropped round the middle of the foot, each
  // rolling off where the pile is steep, so they make a low mound.
  for (const L of S.leaves) {
    L.x = cl(round(31 + (Math.random() + Math.random() + Math.random() - 1.5) * 30), 1, 62);
    L.order = S.landed++;
    L.phi = Math.random() < 0.5 ? 0 : PI;
    roll(S, L);
    stackLeaf(S, L);
  }
  for (let n = 0; n < 12; n++) S.stars.push([floor(rnd(0, W)), floor(rnd(0, 50)), rnd(0.12, 0.3), rnd(0, TAU)]);
}

// The funnel's axis at row y: it sways, more toward the top, and a
// crosswind leans the top over to the right.
function axis(S, y) {
  const up = cl((GROUND - y) / GROUND, 0, 1.1);
  const sway = (7 + 12 * S.wind) * sin(1.1 * S.tau + 0.035 * (GROUND - y)) * up + 2 * sin(2.7 * S.tau + 0.08 * y) * up;
  return S.x0 + sway + 20 * S.wind * up * (0.4 + 0.6 * up);
}
// The funnel widens upward, and a stronger wind feeds a wider one.
const radius = (S, y) => (3.5 + 17 * cl((GROUND - y) / GROUND, 0, 1.1) ** 1.2 * (0.9 + 0.2 * S.s)) * (0.9 + 0.5 * S.wind);

// A resting leaf lies on whatever is under its width, and adds half a row to
// the pile there: leaves lie flat and overlap.
function stackLeaf(S, L) {
  const w = L.shape === 0 ? 3 : 2, x = L.shape === 0 ? L.x - 1 : L.x;
  L.y = pileTop(S, x, w);
  for (let c = x; c < x + w; c++) S.stack[(c + W) % W] = GROUND - 1 - L.y + 0.5;
}

// A leaf landing where the pile is steeper than about half a row a column
// slides down the slope.
function roll(S, L) {
  for (let k = 0; k < 24; k++) {
    const here = S.stack[L.x], l = S.stack[(L.x + W - 2) % W], r = S.stack[(L.x + 2) % W];
    if (here > l + 1 && l <= r) L.x = (L.x + W - 1) % W;
    else if (here > r + 1) L.x = (L.x + 1) % W;
    else break;
  }
}

// The top row of the pile over columns x..x+w-1.
function pileTop(S, x, w) {
  let h = 0;
  for (let c = x; c < x + w; c++) h = max(h, S.stack[(c + W) % W]);
  return GROUND - 1 - h;
}

function enter(L) {
  L.state = 2;
  L.ceil = Math.random() < 0.17 ? 2 : rnd(0.12, 0.98);
  L.hover = null;
}

function release(S, L) {
  // Thrown off the funnel along its spin, still rising a little.
  const w = 5 * S.s + 1;
  L.state = 3;
  L.vx = -sin(L.th) * w * radius(S, L.y) * L.rf + rnd(-8, 8);
  L.vy = -L.rise * 0.4 * S.s - rnd(0, 12);
}

function stepDevil(S, d, gust) {
  S.ph += d;
  if (gust && S.phase === 0) (S.phase = 1), (S.ph = 0.4 * SPIN);
  if (S.phase === 0 && S.ph > CALM) {
    // A new devil, somewhere the pile is.
    let sum = 0, n = 0;
    for (const L of S.leaves) if (L.i < S.count && L.state === 0) (sum += L.x), n++;
    S.x0 = cl((n ? sum / n : 32) + rnd(-10, 10), 18, 46);
    S.x0v = rnd(-3, 3);
    S.phase = 1;
    S.ph = 0;
  } else if (S.phase === 1 && S.ph > SPIN) (S.phase = 2), (S.ph = 0);
  else if (S.phase === 2 && S.ph > FULL) {
    S.phase = 3;
    S.ph = 0;
    for (const L of S.leaves) L.release = rnd(0, BREAK);
  } else if (S.phase === 3 && S.ph > BREAK) {
    // Calm again once nearly everything has landed.
    let flying = 0;
    for (const L of S.leaves) if (L.i < S.count && L.state === 3) flying++;
    if (flying < S.count * 0.04 || S.ph > BREAK + 7) (S.phase = 0), (S.ph = 0);
  }
  const u = S.ph / (S.phase === 1 ? SPIN : S.phase === 3 ? BREAK : 1);
  S.s = S.phase === 1 ? 0.3 + 0.7 * ease(u) : S.phase === 2 ? 1 : S.phase === 3 ? 1 - ease(u) : 0;
  S.top = S.phase === 1 ? GROUND - (GROUND + 12) * ease(u) : S.phase === 0 ? GROUND : -12;
  // The base wanders, more so in a crosswind.
  S.x0v += (rnd(-1, 1) * 6 + (32 - S.x0) * 0.08) * d;
  S.x0 = cl(S.x0 + (S.x0v + 4 * S.wind) * d, 16, 48 - 10 * S.wind);
  S.spinA += d * 5 * S.s;
  S.life = S.phase === 1 ? ease(u) * 0.5 : S.phase === 2 ? 0.5 + 0.5 * min(1, S.ph / 2) : S.phase === 3 ? 1 : 0;
}

function stepLeaf(S, L, d, gust) {
  const active = S.phase === 1 || S.phase === 2;
  if (L.state === 0) {
    // Lying in the pile: now and then one turns over in the draught.
    if (Math.random() < d * 0.05) L.flipT = 0.4;
    if (gust) {
      L.state = 3;
      L.vx = rnd(-35, 35);
      L.vy = rnd(-130, -50);
      return;
    }
    if (active) {
      const dx = L.x - S.x0, reach = 5 + 36 * S.life;
      if (abs(dx) < reach && Math.random() < d * (1.5 + 4 * S.s)) L.state = 1;
    }
  } else if (L.state === 1) {
    // Skidding over the pile toward the foot of the funnel in little hops.
    if (!active) {
      L.state = 3;
      L.vx = rnd(-10, 10);
      L.vy = -rnd(5, 20);
      return;
    }
    const dx = L.x - S.x0;
    L.x -= Math.sign(dx) * (24 + 30 * S.s) * d;
    L.hop += d * 9;
    L.y = pileTop(S, floor(L.x), 2) - 2.5 * abs(sin(L.hop));
    L.phi += L.spin * d;
    if (abs(dx) < 2 + 3 * L.rf) {
      enter(L);
      const r = radius(S, L.y) * L.rf;
      L.th = Math.acos(cl((L.x - axis(S, L.y)) / r, -1, 1)) * (Math.random() < 0.5 ? 1 : -1);
    }
  } else if (L.state === 2) {
    // Round and up the funnel, faster round near the ground. Each leaf rises
    // to its own height and rides round there, bobbing, so the funnel is full
    // from the ground to the top; one in six goes over the top.
    if (S.phase === 3 && S.ph >= L.release) return release(S, L);
    if (!active && S.phase !== 3) return release(S, L);
    const up = (GROUND - L.y) / GROUND;
    L.th += d * S.s * (6.5 - 3 * min(1, up));
    if (L.ceil < 1 && up >= L.ceil) {
      if (L.hover === null) (L.hover = L.y), (L.bob = 0);
      L.bob += d * 2.2;
      L.y = L.hover - 3 * sin(L.bob);
    } else L.y -= d * L.rise * S.s * (0.75 + 0.5 * up);
    L.phi += L.spin * d * 1.4;
    // Flung out over the top of the column.
    if (L.y < max(S.top, 0) + 3 + 6 * L.rf) return release(S, L);
    L.x = axis(S, L.y) + radius(S, L.y) * L.rf * cos(L.th);
  } else if (L.state === 3) {
    // Fluttering down: rocking from side to side, falling fastest through the
    // middle of each swing, with the crosswind and some drag.
    L.psi += L.wf * d;
    const tx = L.af * cos(L.psi) + 22 * S.wind, ty = 16 + 12 * abs(sin(L.psi));
    L.vx += (tx - L.vx) * min(1, d * 2.2);
    L.vy += (ty - L.vy) * min(1, d * (L.vy < 0 ? 1.4 : 2.2));
    L.x += L.vx * d;
    L.y += L.vy * d;
    L.x = (L.x + W) % W;
    if (L.tumble) L.phi += L.spin * d;
    else L.phi = 1.3 * sin(L.psi);
    // Caught again by the foot of a turning funnel.
    if (active && S.s > 0.6 && L.y > GROUND - 45) {
      const dx = L.x - axis(S, L.y);
      if (abs(dx) < radius(S, L.y) * 0.9 && Math.random() < d * 3) {
        enter(L);
        L.rf = cl(abs(dx) / radius(S, L.y), 0.4, 1.1);
        L.th = dx >= 0 ? 0 : PI;
        return;
      }
    }
    if (L.vy > 0 && L.y >= pileTop(S, floor(L.x), 2)) {
      L.state = 0;
      L.order = S.landed++;
      L.x = floor(L.x);
      L.phi = cos(L.phi) < 0 ? PI : 0;
      roll(S, L);
      stackLeaf(S, L);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 150, 0.06], d0 = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.wind = cl(k[3], 0, 1);
  const count = cl(round(k[2]), 150, MAXLEAVES);
  // Leaves added by K3 drift in from above the panel; on the first frame
  // they are simply part of the pile.
  if (!S.started) (S.started = true), (S.count = count);
  for (const L of S.leaves)
    if (L.i >= S.count && L.i < count) {
      L.state = 3;
      L.x = rnd(0, W);
      L.y = rnd(-40, -2);
      L.vx = L.vy = 0;
    }
  S.count = count;
  const down = !!(input.btnPressed && input.btnPressed[0]);
  const gust = down && !S.wasDown;
  S.wasDown = down;
  const d = d0 * S.speed * 0.5;
  S.t += d0;
  S.tau += d;
  stepDevil(S, d, gust);
  // The pile, restacked each frame in landing order so it settles into gaps
  // left by the leaves the devil took.
  S.stack.fill(0);
  const resting = [];
  for (const L of S.leaves) if (L.i < S.count && L.state === 0) resting.push(L);
  resting.sort((a, b) => a.order - b.order);
  for (const L of resting) stackLeaf(S, L);
  for (const L of S.leaves) {
    if (L.i >= S.count) continue;
    stepLeaf(S, L, d, gust);
    if (L.flipT > 0) {
      L.flipT -= d;
      L.phi += (PI / 0.4) * d;
    }
  }
}

// --- drawing ---

function palette(S) {
  const h = (S.hue - floor(S.hue)) * 3, i = floor(h) % 3, f = h - floor(h), j = (i + 1) % 3;
  const g = cl((f - 0.3) / 0.4, 0, 1), s = g * g * (3 - 2 * g);
  const m = (a, b) => a.map((v, c) => mix(v, b[c], s));
  const A = PAL[i], B = PAL[j];
  return { top: m(A.top, B.top), low: m(A.low, B.low), ground: m(A.ground, B.ground), dust: m(A.dust, B.dust), leaf: A.leaf.map((c, n) => m(c, B.leaf[n])) };
}

function put(rgb, x, y, c, a) {
  x = floor(x);
  y = floor(y);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  rgb[o] = mix(rgb[o], c[0], a);
  rgb[o + 1] = mix(rgb[o + 1], c[1], a);
  rgb[o + 2] = mix(rgb[o + 2], c[2], a);
}

function drawLeaf(S, rgb, L, pal) {
  const base = pal.leaf[L.col], c = cos(L.phi);
  // The far side of the funnel is a little darker, never so dark that an
  // orange leaf turns brown.
  const far = L.state === 2 ? 0.88 + 0.12 * sin(L.th) : 1;
  const back = c < 0;
  // Back of the leaf: a shade warmer and deeper.
  const col = back ? [base[0], base[1] * 0.78, base[2] * 0.8] : base;
  const lit = col.map((v) => min(1, v * far));
  const ox = L.x, oy = L.y;
  if (abs(c) < 0.32) {
    // Edge on: a sliver catching the light.
    put(rgb, ox, oy, lit.map((v) => mix(v, 1, 0.35)), 1);
    if (L.shape !== 2) put(rgb, ox + (L.quarter & 1 ? 0 : 1), oy - (L.quarter & 1 ? 1 : 0), lit, 0.7);
    return;
  }
  const shape = SHAPES[L.shape], q = L.quarter;
  for (let n = 0; n < shape.length; n++) {
    let [dx, dy] = shape[n];
    if (back) dx = -dx;
    for (let r = 0; r < q; r++) [dx, dy] = [-dy, dx];
    put(rgb, ox + dx, oy + dy, lit, 1);
  }
  // Face full on: a flash on the leaf's blade.
  if (abs(c) > 0.93) {
    let [dx, dy] = shape[shape.length - 1];
    if (back) dx = -dx;
    for (let r = 0; r < q; r++) [dx, dy] = [-dy, dx];
    put(rgb, ox + dx, oy + dy, [1, 0.95, 0.7], 0.55 * (abs(c) - 0.93) / 0.07 + (L.col === 4 ? 0.2 : 0));
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const pal = (S.pal = S.skyHue === S.hue && S.pal ? S.pal : palette(S));
  const { rgb, sky } = S;
  // Sky, stars and ground only change with the colour.
  if (S.skyHue !== S.hue) {
    for (let y = 0; y < H; y++) {
      const u = (y / GROUND) ** 1.6;
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3, c = y >= GROUND ? pal.ground : null;
        for (let ch = 0; ch < 3; ch++) sky[o + ch] = c ? c[ch] : mix(pal.top[ch], pal.low[ch], u);
      }
    }
    S.skyHue = S.hue;
  }
  rgb.set(sky);
  for (const [x, y, a, p] of S.stars) put(rgb, x, y, [0.9, 0.85, 1], a * (0.6 + 0.4 * sin(S.t * 1.3 + p)));
  const flying = [];
  for (const L of S.leaves) if (L.i < S.count) flying.push(L);
  // The far half of the funnel's leaves go behind the dust.
  for (const L of flying) if (L.state === 2 && sin(L.th) < 0) drawLeaf(S, rgb, L, pal);
  // Dust: a twisting veil round the funnel's axis, and a cloud at its foot.
  if (S.s > 0.01) {
    const dust = pal.dust;
    for (let y = max(0, floor(S.top - 6)); y <= GROUND + 2 && y < H; y++) {
      const xa = axis(S, y), r = radius(S, y) * 1.1, fade = cl((y - S.top) / 14, 0, 1);
      for (let x = 0; x < W; x++) {
        const u = (x - xa) / r;
        if (abs(u) > 1.7) continue;
        const band = 0.55 + 0.45 * sin(0.3 * y - 3 * S.spinA + 2.6 * u);
        let a = exp(-u * u * 1.6) * band * 0.3;
        const gy = (y - GROUND) / 5, gx = (x - S.x0) / (10 + 12 * S.life);
        a += 0.35 * exp(-gy * gy - gx * gx);
        a *= S.s * fade;
        if (a > 0.004) {
          const o = (y * W + x) * 3;
          for (let ch = 0; ch < 3; ch++) rgb[o + ch] = min(1, rgb[o + ch] + dust[ch] * a);
        }
      }
    }
  }
  // The pile, bottom up, then everything in the air.
  for (const L of flying) if (L.state === 0) drawLeaf(S, rgb, L, pal);
  for (const L of flying) if (L.state === 1 || L.state === 3 || (L.state === 2 && sin(L.th) >= 0)) drawLeaf(S, rgb, L, pal);
  for (let o = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) display.setPixel(x, y, round(255 * min(1, rgb[o * 3])), round(255 * min(1, rgb[o * 3 + 1])), round(255 * min(1, rgb[o * 3 + 2])));
}
