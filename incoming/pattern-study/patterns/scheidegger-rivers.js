// ===== Patternflow pattern =====
// Title:   Scheidegger Rivers
// Family:  line
// Idea:    Scheidegger's random river network on the checkerboard of LEDs, every site draining to the LED down-left or down-right of it, each stream lit by the log of the water through it and coloured by the outlet it reaches, so brooks at the top merge into trunks that thicken down the panel; raindrops run down the rivers, and every so often a site turns the other way and a river is captured, its old bed draining and its new one filling row by row.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Scheidegger's river network model (Adrian Scheidegger, 1967), pattern round 34; its rivers are coalescing random walks, whose scaling limit is the Brownian web (Balint Toth and Wendelin Werner, 1998)
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bias=-1..1, Capture=0..1
//
// Knob 1: Hue. Turns the rivers round the wheel. Each large basin holds one of four hues 0.1 apart: at 0 green, cyan, blue and violet, at 0.25 blue-violet to rose, at 0.5 pink, red, orange and amber, at 0.75 yellow to teal. Brooks are saturated and the big trunks go pale.
// Knob 2: Speed. At 2 raindrops run 16 rows a second (a drop from the top reaches the bottom in 8 s), 14 land each second, and a rerouted river drains and refills 40 rows a second; at 0.2 all of it a tenth as fast, at 3 one and a half times. Captures come in step with it.
// Knob 3: Bias. The chance a site drains down-right, 0.5 + 0.48 x Bias. At 0 even, and the trunks wander straight down; at 0.5 it is 0.74 and every river leans right; at -1 or 1 it is 0.02 or 0.98, so the rivers are straight diagonals that merge only where one site in 50 turns the other way.
// Knob 4: Capture. How often sites change their way down. At 0.06 and Speed 2, 9 sites a second at random and 1.2 a second on large rivers, picked by the flux through them where the other way runs at least 10 rows apart; at 0 the network holds still, at 1 150 and 20 a second and the basins churn.
// Buttons: K1 tap is a burst of rain: 260 drops land on the top 24 rows at once and run together down the network, tracing the tree into its trunks.

const W = 64, H = 128, SW = W / 2, NS = SW * H;
const { floor, min, max, log, exp, round, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

// Site s sits in row y = s / 32 at x = 2 (s % 32) + (y & 1): the LEDs with
// x + y even. Its two neighbours below are x - 1 and x + 1 in row y + 1,
// wrapping round the sides.
const SX = new Int16Array(NS), SY = new Int16Array(NS);
const DL = new Int32Array(NS), DR = new Int32Array(NS), UL = new Int32Array(NS), UR = new Int32Array(NS);
const siteAt = (x, y) => y * SW + (((x % W) + W) % W >> 1);
for (let s = 0; s < NS; s++) {
  const y = floor(s / SW), x = 2 * (s % SW) + (y & 1);
  SX[s] = x;
  SY[s] = y;
  DL[s] = y < H - 1 ? siteAt(x - 1, y + 1) : -1;
  DR[s] = y < H - 1 ? siteAt(x + 1, y + 1) : -1;
  UL[s] = y > 0 ? siteAt(x - 1, y - 1) : -1;
  UR[s] = y > 0 ? siteAt(x + 1, y - 1) : -1;
}
const FMAX = 1500, LFMAX = log(FMAX);

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, bias: 0, cap: 0.06, warm: false, sweep: 0, flipAcc: 0, bigAcc: 0, rainAcc: 0,
    u: new Float32Array(NS), dn: new Int32Array(NS), F: new Float32Array(NS), Q: new Float32Array(NS),
    out: new Int16Array(NS), prev: new Int16Array(NS), ov: new Int32Array(SW * SW), col: new Int8Array(SW).fill(-1),
    col2: new Int8Array(SW), ho: new Float32Array(NS), cum: new Float64Array(NS),
    drops: [], Lv: new Float32Array(W * H), Hu: new Float32Array(W * H), Sa: new Float32Array(W * H),
    Wd: new Float32Array(W * H), Dr: new Float32Array(W * H), c: [0, 0, 0],
  };
  const S = params.s;
  for (let s = 0; s < NS; s++) S.u[s] = random();
}

// Each site drains right when its own random number is under 0.5 + 0.48 Bias.
function route(S) {
  const p = 0.5 + 0.48 * S.bias;
  for (let s = 0; s < NS; s++) S.dn[s] = DL[s] < 0 ? -1 : S.u[s] < p ? DR[s] : DL[s];
}

// The exact flux, row by row from the top: 1 for the site itself plus all
// that drains into it.
function flux(S) {
  const F = S.F, dn = S.dn;
  F.fill(1);
  for (let s = 0; s < NS - SW; s++) F[dn[s]] += F[s];
  // Which outlet in the bottom row each site reaches, from the bottom up.
  for (let s = NS - 1; s >= 0; s--) S.out[s] = dn[s] < 0 ? s - (NS - SW) : S.out[dn[s]];
}

// The water on show moves one row per sweep: a rerouted river drains and the
// new one fills from the site that changed downwards.
function sweep(S) {
  const Q = S.Q, dn = S.dn;
  for (let s = NS - 1; s >= SW; s--) {
    let q = 1;
    const a = UL[s], b = UR[s];
    if (dn[a] === s) q += Q[a];
    if (dn[b] === s) q += Q[b];
    Q[s] = q;
  }
}

// Basin colours. A basin draining at least AMIN sites through its outlet
// holds one of four hue steps; after the network changes, each new basin
// takes the colour of the old basin it shares most sites with, and a basin
// with none to take gets the step farthest from those in use.
const STEPS = [-0.1, 0, 0.1, 0.2], AMIN = 120;
function basins(S) {
  const ov = S.ov, F = S.F, B = NS - SW;
  ov.fill(0);
  for (let s = 0; s < NS; s++) ov[S.prev[s] * SW + S.out[s]]++;
  const pairs = [];
  for (let i = 0; i < SW; i++)
    if (S.col[i] >= 0) for (let j = 0; j < SW; j++) if (F[B + j] >= AMIN && ov[i * SW + j] > 0) pairs.push([ov[i * SW + j], i, j]);
  pairs.sort((a, b) => b[0] - a[0]);
  const col = S.col2.fill(-1), taken = new Uint8Array(SW);
  for (const [, i, j] of pairs)
    if (!taken[i] && col[j] < 0) {
      taken[i] = 1;
      col[j] = S.col[i];
    }
  for (let j = 0; j < SW; j++)
    if (F[B + j] >= AMIN && col[j] < 0) {
      let best = 0, far = -1;
      for (let k = 0; k < STEPS.length; k++) {
        let near = 9;
        for (let m = 0; m < SW; m++) if (col[m] >= 0) near = min(near, Math.abs(STEPS[k] - STEPS[col[m]]));
        if (near > far) (far = near), (best = k);
      }
      col[j] = best;
    }
  S.col.set(col);
  S.prev.set(S.out);
}

// How many rows the two paths out of site s, one through each neighbour
// below, run apart before they join (or reach the bottom).
function apart(S, s) {
  let a = DL[s], b = DR[s], n = 0;
  while (a >= 0 && a !== b) {
    a = S.dn[a];
    b = S.dn[b];
    n++;
  }
  return n;
}

// A capture: site s turns to its other neighbour, with the Metropolis chance
// that keeps every site draining right with chance p in the long run.
function flip(S, s) {
  const p = 0.5 + 0.48 * S.bias, right = S.u[s] < p;
  const want = right ? 1 - p : p;
  if (random() * max(p, 1 - p) > want) return false;
  S.u[s] = right ? p + (1 - p) * random() : p * random();
  S.dn[s] = right ? DL[s] : DR[s];
  return true;
}

function step(S, d) {
  const sp = S.speed / 2;
  route(S);
  flux(S);
  // Small captures land on any site; large ones on a site picked in
  // proportion to the flux through it, among those whose other way down
  // runs at least 10 rows apart from the river it leaves.
  S.flipAcc += d * sp * 150 * S.cap;
  S.bigAcc += d * sp * 20 * S.cap;
  let changed = false;
  while (S.flipAcc >= 1) {
    S.flipAcc -= 1;
    changed = flip(S, floor(random() * (NS - SW))) || changed;
  }
  if (S.bigAcc >= 1) {
    const cum = S.cum;
    let acc = 0;
    for (let s = 0; s < NS; s++) cum[s] = acc += S.F[s];
    while (S.bigAcc >= 1) {
      S.bigAcc -= 1;
      for (let tries = 0; tries < 8; tries++) {
        const r = random() * acc;
        let lo = 0, hi = NS - 1;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (cum[m] < r) lo = m + 1;
          else hi = m;
        }
        if (lo >= NS - SW || apart(S, lo) < 10) continue;
        changed = flip(S, lo) || changed;
        break;
      }
    }
  }
  if (changed) flux(S);
  S.sweep += d * sp * 40;
  while (S.sweep >= 1) {
    S.sweep -= 1;
    sweep(S);
  }
  const k = 1 - exp(-d * sp * 3);
  basins(S);
  for (let s = 0; s < NS; s++) {
    const c = S.col[S.out[s]];
    if (c >= 0) S.ho[s] += (STEPS[c] - S.ho[s]) * k;
  }

  // Rain: drops land on random sites and run down the rivers, two LED steps
  // a row (across, then down).
  S.rainAcc += d * sp * 14;
  while (S.rainAcc >= 1) {
    S.rainAcc -= 1;
    addDrop(S, floor(random() * (NS - 8 * SW)));
  }
  const v = d * sp * 32;
  const drops = S.drops;
  for (let i = drops.length - 1; i >= 0; i--) {
    const D = drops[i];
    D.pos += v;
    while (D.pos >= 1) {
      D.pos -= 1;
      if (D.mid < 0) {
        const t = S.dn[D.s];
        if (t < 0) {
          D.gone = true;
          break;
        }
        D.mid = SY[D.s] * W + SX[t];
        D.s = t;
        D.trail.unshift(D.mid);
      } else {
        D.mid = -1;
        D.trail.unshift(SY[D.s] * W + SX[D.s]);
      }
      if (D.trail.length > 8) D.trail.pop();
    }
    if (D.gone) drops.splice(i, 1);
  }
}

function addDrop(S, s) {
  S.drops.push({ s, mid: -1, pos: random(), trail: [SY[s] * W + SX[s]], gone: false });
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.bias = cl(k[2], -1, 1);
  S.cap = cl(k[3], 0, 1);
  if (!S.warm) {
    route(S);
    flux(S);
    S.Q.set(S.F);
    S.prev.set(S.out);
    basins(S);
    for (let s = 0; s < NS; s++) S.ho[s] = S.col[S.out[s]] >= 0 ? STEPS[S.col[S.out[s]]] : 0;
    const sp = S.speed;
    S.speed = 2;
    for (let i = 0; i < 120; i++) step(S, 1 / 30);
    S.speed = sp;
    S.warm = true;
  }
  if (input.btnPressed && input.btnPressed[0]) for (let i = 0; i < 260; i++) addDrop(S, floor(random() * 24 * SW));
  step(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { Lv, Hu, Sa, Wd, Dr, Q } = S;
  Lv.fill(0);
  Wd.fill(0);
  Dr.fill(0);
  // Each site lights its own LED and the LED beside it on the side it drains
  // to, which is the LED above the site it drains into: a river is a stair of
  // LEDs, across then down, and two streams meeting make a T.
  for (let s = 0; s < NS; s++) {
    const g = cl(log(Q[s]) / LFMAX, 0, 1), L = 30 + 225 * g ** 1.35;
    const p = SY[s] * W + SX[s], h = S.hue + 0.52 + S.ho[s], sat = 0.85 - 0.45 * g;
    const wd = 1 + 1.8 * cl((log(Q[s]) - log(30)) / (LFMAX - log(30)), 0, 1);
    if (L > Lv[p]) (Lv[p] = L), (Hu[p] = h), (Sa[p] = sat), (Wd[p] = wd);
    const t = S.dn[s];
    if (t >= 0) {
      const m = SY[s] * W + SX[t];
      if (L > Lv[m]) (Lv[m] = L), (Hu[m] = h), (Sa[m] = sat), (Wd[m] = wd);
    }
  }
  for (const D of S.drops)
    D.trail.forEach((p, i) => {
      Dr[p] = max(Dr[p], i < 2 ? 1 : 0.85 ** (i - 1));
    });
  const out = S.c;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let L = Lv[p], h = Hu[p], sa = Sa[p];
      // Wide rivers spill onto the LEDs beside them.
      for (const dx of [-2, -1, 1, 2]) {
        const q = y * W + ((x + dx + W) % W), w = Wd[q] - Math.abs(dx);
        if (w > 0) {
          const v = Lv[q] * min(1, w) * (Math.abs(dx) === 1 ? 0.8 : 0.55);
          if (v > L) (L = v), (h = Hu[q]), (sa = Sa[q]);
        }
      }
      const dr = Dr[p];
      if (dr > 0) {
        L = L + (255 - L) * dr;
        sa *= 1 - 0.85 * dr;
      }
      hsv(h, sa, 1, out);
      display.setPixel(x, y, round(out[0] * L), round(out[1] * L), round(out[2] * L));
    }
}
