// ===== Patternflow pattern =====
// Title:   Kettle
// Family:  kitchen
// Idea:    A glass electric kettle on a dark kitchen counter at night heats under the blue light of its LED ring, from bubbles clinging to the element through the hiss to a rolling boil, its steam fogging the glass and rising from the spout to the top of the panel, until the switch clicks off, the light goes out and someone switches it on again.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 20, after the stages of water coming to the boil in a glass kettle
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Light=0..1, Speed=0.2..3, Fill=1..1.7, Cold=0..1
//
// Knob 1: Light. The colour of the LED ring in the base and of everything it lights: blue at 0, then teal, green and violet, to a warm amber at 1.
// Knob 2: Speed. How fast the water heats and everything moves: at 2 the kettle comes to the boil, boils 3.5 s, clicks off and is switched on again 5 s later, about 15 s a round; at 0.2 it all runs ten times slower.
// Knob 3: Fill. How much water is in the kettle, from one litre to the 1.7 L MAX line on the gauge; a full kettle takes about twice as long to come to the boil.
// Knob 4: Cold. How cold the kitchen is: in a warm one the steam thins out on its way up; in a cold one it billows to the ceiling, the glass above the water fogs over and drops run down it.
// Buttons: K1 tap switches the kettle on or off now.

const W = 64;
const H = 128;
const N = W * H;
// The body's middle column, the first glass row under the rim band, and the
// last row of water, which lies on the element plate.
const CX = 31;
const TOP = 37;
const BOT = 100;
// Steam is kept at half resolution.
const SW = 32;
const SH = 64;
const MAXB = 280;
const MAXP = 190;
const MAXS = 60;
const NSITE = 18;
const ND = 150;
const NC = 46;
// LED colours from blue through teal, green and violet to amber.
const LEDS = [[40, 110, 255], [0, 205, 225], [40, 235, 100], [160, 70, 255], [255, 160, 60]];
const { min, max, round, floor, sin, exp, abs, hypot } = Math;
const rnd = () => Math.random();
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Inner half-width of the glass, a little wider at the foot.
const HW = Float32Array.from({ length: H }, (_, y) => 14 + (3 * (clamp(y, TOP, BOT) - TOP)) / (BOT - TOP));
const wallL = (y) => CX - round(HW[clamp(y, 0, H - 1)]);
const wallR = (y) => CX + round(HW[clamp(y, 0, H - 1)]);
const EX12 = Float32Array.from({ length: 128 }, (_, i) => exp(-i / 12));
const EDGE = Float32Array.from({ length: 64 }, (_, i) => exp(-(i - 1) / 1.6));
const EX6 = Float32Array.from({ length: 128 }, (_, i) => exp(-i / 6));
// The 3x5 letters of MAX on the gauge.
const MAXT = ["101111101", "111101101", "101111010", "101101101", "101101101"];
// The lid, row by row from its knob: half-widths.
const LID = [2, 2, 8, 10, 11, 12, 13, 13];

// Smooth value noise, wrapping both ways.
function noise(w, h, cell, oct) {
  const out = new Float32Array(w * h);
  let amp = 1;
  let tot = 0;
  for (let o = 0; o < oct; o++, cell /= 2, amp *= 0.5) {
    const gw = w / cell;
    const gh = h / cell;
    const g = Float32Array.from({ length: gw * gh }, rnd);
    const at = (i, j) => g[(j % gh) * gw + (i % gw)];
    for (let y = 0; y < h; y++) {
      const j = floor(y / cell);
      const ty = smooth(0, 1, y / cell - j);
      for (let x = 0; x < w; x++) {
        const i = floor(x / cell);
        const tx = smooth(0, 1, x / cell - i);
        const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
        const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
        out[y * w + x] += amp * (a + (b - a) * ty);
      }
    }
    tot += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

export function setup(params) {
  const P = params;
  const F = (n) => new Float32Array(n);
  Object.assign(P, { buf: F(N * 3), S: F(SW * SH), wipe: F(N), tile: F(N), grain: F(N), sh: F(W), sv: F(W), led: F(3), sr: new Int16Array(W) });
  for (const k of ["bx", "by", "br", "bv", "bp", "be", "bm"]) P[k] = F(MAXB);
  P.pArr = ["px", "py", "pvx", "pvy", "pr", "pa", "pg", "pl"].map((k) => (P[k] = F(MAXP)));
  for (const k of ["dx", "dy", "dvx", "dvy"]) P[k] = F(MAXS);
  // Subway tiles behind the counter, each a little different.
  const shade = Float32Array.from({ length: 512 }, () => 0.85 + 0.2 * rnd());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const band = y >> 2;
      const u = x + (band & 1) * 4;
      const grout = (y & 3) === 3 || (u & 7) === 7;
      P.tile[y * W + x] = grout ? 0.5 : shade[(band * 9 + (u >> 3)) & 511] * ((y & 3) === 0 ? 1.1 : 1);
      P.grain[y * W + x] = (rnd() - 0.5) * 9;
    }
  // Blotchy condensation, and the wisps the steam carries.
  P.fogTex = noise(W, H, 16, 2).map((v) => 0.3 + 1.7 * v * v);
  P.wisp = noise(SW, SH, 8, 3);
  P.siteX = Float32Array.from({ length: NSITE }, (_, i) => 17 + ((i + 0.2 + 0.6 * rnd()) * 29) / NSITE);
  P.siteW = Float32Array.from({ length: NSITE }, () => 0.5 + rnd());
  P.acc = F(NSITE);
  // Drops of condensation on the inside of the glass, each with the fog it needs.
  P.qx = new Int8Array(ND);
  P.qy = new Int16Array(ND);
  P.qt = F(ND);
  for (let i = 0; i < ND; i++) {
    const y = TOP + 1 + floor(rnd() * 60);
    P.qy[i] = y;
    P.qx[i] = wallL(y) + 1 + floor(rnd() * (wallR(y) - wallL(y) - 1));
    P.qt[i] = 0.12 + 0.85 * rnd();
  }
  // Tiny bubbles that cling to the plate and the foot of the glass.
  P.cx = new Int8Array(NC);
  P.cy = new Int16Array(NC);
  P.ct = F(NC);
  for (let i = 0; i < NC; i++) {
    const side = i < 30 ? 0 : i & 1 ? -1 : 1;
    const y = side ? 72 + floor(rnd() * 28) : BOT - (rnd() < 0.3 ? 1 : 0);
    P.cy[i] = y;
    P.cx[i] = side < 0 ? wallL(y) + 1 : side > 0 ? wallR(y) - 1 : 16 + floor(rnd() * 31);
    P.ct[i] = rnd() * 0.85;
  }
  P.runners = [];
  Object.assign(P, { started: false, t: 0, on: true, T: 0.27, Pw: 1, I: 1, hold: 0, off: 0, F: 0, nb: 0, np: 0, ns: 0, eAcc: 0, lAcc: 0, cold: 0.06, m: 1, surf0: 69, fill: 1, hue: 0 });
}

function toggle(P, on) {
  P.on = on;
  P.hold = 0;
  P.off = 0;
}

function release(P, s, reach) {
  if (P.nb >= MAXB) return;
  const i = P.nb++;
  const depth = BOT - P.surf0;
  P.bx[i] = P.siteX[s] + (rnd() - 0.5) * 1.5;
  P.by[i] = BOT;
  P.br[i] = 0.5 + 0.35 * rnd() + 0.5 * P.boilF;
  P.bv[i] = -3;
  P.bp[i] = rnd() * 6.3;
  P.bm[i] = 0.55 + 0.6 * rnd();
  // Below the boil a bubble collapses on its way up, higher as the water heats.
  P.be[i] = rnd() < reach * reach ? -99 : BOT - depth * reach * (0.3 + 0.65 * rnd());
}

function puff(P, x, y, vx, vy, r, a) {
  if (P.np >= MAXP) return;
  const i = P.np++;
  const v = [x, y, vx, vy, r, a * (0.45 + 1.4 * P.cold), 0, (3.4 + 3.6 * P.cold) * (0.8 + 0.4 * rnd())];
  for (let n = 0; n < 8; n++) P.pArr[n][i] = v[n];
}

function burst(P, c, r) {
  P.sv[c] -= 5 + 9 * r;
  if (r > 1.1 && P.ns < MAXS && rnd() < 0.6) {
    const i = P.ns++;
    P.dx[i] = c;
    P.dy[i] = P.surf0 + P.sh[c] - 1;
    P.dvx[i] = (rnd() - 0.5) * 12;
    P.dvy[i] = -(14 + 22 * rnd()) * (0.5 + r / 3);
  }
}

function step(P, h) {
  P.t += h;
  if (P.on) {
    // A full kettle takes longer to come to the boil.
    P.T = min(1, P.T + (0.11 * h) / P.fill ** 1.3);
    if (P.T >= 1 && (P.hold += h) >= 3.5) toggle(P, false);
  } else {
    P.T = 0.15 + (P.T - 0.15) * exp(-h / 3.5);
    if ((P.off += h) >= 5) toggle(P, true);
  }
  const on = P.on ? 1 : 0;
  P.Pw += (on - P.Pw) * (1 - exp(-h / (on ? 0.4 : 0.6)));
  P.I += (on - P.I) * (1 - exp(-h / (on ? 0.12 : 0.25)));
  const T = P.T;
  P.hissF = smooth(0.45, 0.7, T);
  P.boilF = smooth(0.8, 1, T);
  P.cling = smooth(0.22, 0.5, T);
  const reach = smooth(0.5, 0.95, T);
  const steam = smooth(0.5, 1, T) * (0.2 + 0.8 * P.Pw);
  const fogT = smooth(0.45, 0.95, T) * (0.3 + 0.7 * P.cold);
  P.F += (fogT - P.F) * (1 - exp(-h / (fogT > P.F ? 1 : 7)));

  // Bubbles: released from the sites on the plate, rising, wobbling, and
  // either collapsing in cooler water or bursting at the surface.
  const rate = P.Pw * (1.3 * P.hissF * (1 - 0.6 * P.boilF) + 1.1 * P.boilF);
  for (let s = 0; s < NSITE; s++) {
    P.acc[s] += rate * P.siteW[s] * h;
    for (; P.acc[s] >= 1; P.acc[s]--) release(P, s, reach);
  }
  const { bx, by, br, bv, bp, be, bm, sh, sv } = P;
  for (let i = 0; i < P.nb; ) {
    bv[i] += (-(9 + 9 * br[i]) - bv[i]) * (1 - exp(-2 * h));
    by[i] += bv[i] * h;
    bp[i] += (6 + 3 * br[i]) * h;
    bx[i] = clamp(bx[i] + sin(bp[i]) * 4 * h * br[i], wallL(by[i] | 0) + 1.5, wallR(by[i] | 0) - 1.5);
    let dead = false;
    if (by[i] < be[i] + 3) {
      br[i] -= 2.5 * h;
      dead = br[i] < 0.3;
    } else if (P.boilF > 0.2) br[i] = min(P.bm[i] * (1 + 2.2 * P.boilF), br[i] + 2 * P.boilF * h);
    const c = round(bx[i]);
    if (!dead && by[i] - br[i] * 0.5 <= P.surf0 + sh[c]) {
      burst(P, c, br[i]);
      dead = true;
    }
    if (dead) {
      const j = --P.nb;
      for (const A of [bx, by, br, bv, bp, be, bm]) A[i] = A[j];
    } else i++;
  }

  // The surface: a damped string, kicked by bursts and by the churn of the boil.
  const L = wallL(P.surf0 | 0) + 1;
  const R = wallR(P.surf0 | 0) - 1;
  const n = Math.ceil(h * 60);
  for (let k = 0; k < n; k++) {
    const d = h / n;
    for (let x = L; x <= R; x++) {
      const a = 300 * (sh[max(L, x - 1)] + sh[min(R, x + 1)] - 2 * sh[x]) - 40 * sh[x] - 5 * sv[x];
      sv[x] += a * d;
    }
    for (let x = L; x <= R; x++) sh[x] = clamp(sh[x] + sv[x] * d, -4, 3);
  }
  if (rnd() < 14 * P.boilF * P.Pw * h) sv[L + floor(rnd() * (R - L + 1))] += (rnd() - 0.65) * 50 * P.boilF;
  for (let i = 0; i < P.ns; ) {
    P.dvy[i] += 150 * h;
    P.dx[i] = clamp(P.dx[i] + P.dvx[i] * h, L, R);
    P.dy[i] += P.dvy[i] * h;
    if (P.dvy[i] > 0 && P.dy[i] > P.surf0 + sh[round(P.dx[i])]) {
      const j = --P.ns;
      for (const A of [P.dx, P.dy, P.dvx, P.dvy]) A[i] = A[j];
    } else i++;
  }

  // Steam out of the spout, in puffs at the boil, and round the lid.
  P.eAcc += 36 * steam * (1 + P.boilF * P.Pw * (1.2 * max(0, sin(P.t * 5.5)) - 0.35)) * h;
  for (; P.eAcc >= 1; P.eAcc--) puff(P, 9 + rnd() * 2, 33.5, -1 - 2 * rnd(), -8 - 6 * rnd(), 1.6, 0.8 + 0.5 * rnd());
  P.lAcc += 7 * steam * P.boilF * h;
  for (; P.lAcc >= 1; P.lAcc--) puff(P, 21 + rnd() * 20, 29, (rnd() - 0.5) * 3, -4 - 4 * rnd(), 1.8, 0.45 + 0.3 * rnd());
  const { px, py, pvx, pvy, pr, pg, pl } = P;
  const ry = 1 - exp(-h);
  const rx = 1 - exp(-h / 0.8);
  const grow = 3.6 + 2 * P.cold;
  for (let i = 0; i < P.np; ) {
    pg[i] += h;
    const wind = 8 + 3 * sin(0.07 * py[i] + 0.4 * P.t) + 2 * sin(0.17 * P.t + 1.3);
    pvy[i] += (-12 - pvy[i]) * ry;
    pvx[i] += (wind - pvx[i]) * rx + (rnd() - 0.5) * 24 * h;
    px[i] += pvx[i] * h;
    py[i] += pvy[i] * h;
    pr[i] += grow * h;
    if (pg[i] > pl[i] || py[i] + pr[i] < -2 || px[i] > W + 12) {
      const j = --P.np;
      for (const A of P.pArr) A[i] = A[j];
    } else i++;
  }

  // Drops that grow heavy run down through the fog and wipe a clear line.
  const { wipe, runners } = P;
  const keep = exp(-h / 6);
  for (let y = TOP; y <= BOT; y++) for (let x = 14; x <= 48; x++) wipe[y * W + x] *= keep;
  if (P.F > 0.4 && runners.length < 6 && rnd() < (P.F - 0.4) * (0.6 + 1.6 * P.cold) * h) {
    const y = TOP + 1 + rnd() * 8;
    runners.push([wallL(y | 0) + 2 + rnd() * (wallR(y | 0) - wallL(y | 0) - 4), y, 4 + 6 * rnd(), rnd() * 6]);
  }
  P.runners = runners.filter((r) => {
    r[3] += h * 3;
    r[1] += r[2] * h * (0.25 + 0.75 * max(0, sin(r[3])));
    const p = (r[1] | 0) * W + (r[0] | 0);
    wipe[p] = 1;
    return r[1] < P.surf0 + sh[r[0] | 0] - 1;
  });
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = clamp(dt, 0, 0.1);
  P.hue = clamp(k[0], 0, 1);
  P.m = clamp(k[1], 0.2, 3) / 2;
  P.fill = clamp(k[2], 1, 1.7);
  P.surf0 = 101 - (P.fill / 1.7) * 55;
  P.cold = clamp(k[3], 0, 1);
  if (!P.started) {
    P.started = true;
    // Open in the hiss, three seconds after the bubbles began to cling.
    for (let i = 0; i < 30; i++) step(P, 0.1);
  }
  if (input.btnPressed && input.btnPressed[0]) toggle(P, !P.on);
  step(P, dt * P.m);
}

function add(P, x, y, c, v) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) P.buf[o + i] += c[i] * v;
}

// Bubbles lighten the water, so where they crowd it turns pale, not white.
function lift(P, x, y, c, v) {
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) P.buf[o + i] = max(P.buf[o + i], P.buf[o + i] * 0.5 + c[i] * v);
}

function put(P, o, r, g, b) {
  P.buf[o] = r;
  P.buf[o + 1] = g;
  P.buf[o + 2] = b;
}

// The tiled wall, lit by the kettle; the counter top with its pool of light
// and the ring's reflection; the counter's edge and the cupboard below.
function room(P) {
  const { led, tile } = P;
  for (let y = 0; y < H; y++) {
    const yy = clamp(y, P.surf0, 106);
    const dy = y - yy;
    const hw = HW[yy | 0];
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const ex = (x - CX) / 17;
      let g;
      let a = tile[p];
      let b = a * 4;
      if (y < 117) {
        const dx = max(0, abs(x - CX) - hw);
        g = (a * 100) / (1 + (dx * dx + dy * dy) / 70);
      } else if (y < 124) {
        g = 150 * exp(-ex * ex - ((y - 117) / 4) ** 2) + (y === 118 && x >= 14 && x <= 48 ? (x % 3 === 1 ? 70 : 49) : 0);
        b = 7 + P.grain[p];
        a = 1;
      } else {
        g = (y === 124 ? 60 : 12) * exp(-ex * ex * 0.6);
        b = y === 124 ? 28 : 6;
        a = 0.75;
      }
      g *= P.I;
      put(P, p * 3, b + g * led[0], b + a + g * led[1], b + 4 * a + g * led[2]);
    }
  }
}

// The glass: its walls, the water, the fog and drops above it, the spout.
function glass(P) {
  const { buf, led, sh, sr, fogTex, wipe } = P;
  const I = P.I;
  const F = P.F;
  const t = P.t;
  const hot = smooth(0.3, 1, P.T);
  const milk = 0.35 * P.boilF * P.Pw;
  const shim = 0.06 + 0.16 * hot;
  const wc = [0, 1, 2].map((i) => 210 * (led[i] * (1 - milk) + milk));
  const fc = [0, 1, 2].map((i) => 255 * (0.5 * led[i] + 0.5) * (0.12 + 0.75 * I));
  for (let x = 0; x < W; x++) sr[x] = round(P.surf0 + sh[x]);
  const glass = (o, v, a) => put(P, o, a + 255 * v * led[0], a + 255 * v * led[1], a + 6 + 255 * v * led[2]);
  const fog = (o, p, y, s) => {
    const f = F * fogTex[p] * (0.55 + 1.1 * EX12[min(127, s - y)] + 0.4 * EX6[max(0, y - TOP)]) * (1 - wipe[p]);
    for (let i = 0; i < 3; i++) buf[o + i] = buf[o + i] * 0.7 + f * fc[i];
  };
  for (let y = TOP; y <= BOT; y++) {
    const l = wallL(y);
    const r = wallR(y);
    const lw = I * (0.32 + 0.68 * exp((y - BOT) / 30)) * (1 + 0.3 * milk);
    const row = ((y + floor(t * 9)) & 127) * W;
    for (let x = l; x <= r; x++) {
      const p = y * W + x;
      const o = p * 3;
      const s = sr[x];
      if (x === l || x === r) {
        if (x === l && y <= 46) glass(o, (y & 1 ? 0.1 : 0.04) + 0.12 * I, y & 1 ? 40 : 18);
        else glass(o, y >= s ? 0.25 * I + 0.85 * lw : 0.07 * I + 0.25 * F * I, 26);
      } else if (y >= s) {
        let v = lw * (1 + shim * (fogTex[row + x] - 0.8) + 0.3 * EDGE[min(x - l, r - x)]);
        if (y === s) v = v * 1.35 + 0.18 * I;
        put(P, o, 4 + v * wc[0], 6 + v * wc[1], 10 + v * wc[2]);
      } else fog(o, p, y, s);
    }
  }
  // The spout: a glass lip leaning out to the left, the filter where the wall was.
  for (let y = 34; y <= 46; y++) {
    const xs = round(9 + ((y - 34) * 8) / 12);
    for (let x = xs; x < 17; x++) {
      const o = (y * W + x) * 3;
      if (x === xs || y === 34) glass(o, 0.05 + 0.1 * I + 0.15 * F * I, 30);
      else fog(o, y * W + x, y, round(P.surf0));
    }
  }
}

// What changes only with the light, the water level and the switch: the rim
// band, the lid and its knob, the plate, the LED ring and the base.
function shell(P) {
  const { led } = P;
  const I = P.I;
  const glass = (o, v, a) => put(P, o, a + 255 * v * led[0], a + 255 * v * led[1], a + 6 + 255 * v * led[2]);
  for (let y = 35; y <= 36; y++)
    for (let x = 17; x <= 45; x++) {
      const v = (y === 35 ? 0.8 : 0.5) + (x === 22 || x === 23 ? 0.6 : 0);
      put(P, (y * W + x) * 3, 30 * v + 70 * I * v * led[0], 31 * v + 70 * I * v * led[1], 36 * v + 70 * I * v * led[2]);
    }
  for (let j = 0; j < LID.length; j++) {
    const y = 27 + j;
    for (let x = CX - LID[j]; x <= CX + LID[j]; x++) {
      const edge = j === 0 || (j === 2 && abs(x - CX) > 2) || (j > 2 && abs(x - CX) > LID[j - 1]);
      let v = j === 7 ? 6 : 13 + (x < CX ? 4 : 0);
      if (edge) v += x < CX ? 30 : 18;
      put(P, (y * W + x) * 3, v, v, v + 3);
    }
  }
  // The element plate, the LED ring under the glass, the base and its stand.
  for (let y = 101; y <= 116; y++) {
    const x0 = y <= 105 ? 14 : y <= 111 ? 13 : y === 112 || y === 116 ? 11 : 10;
    for (let x = x0; x <= 2 * CX - x0; x++) {
      const o = (y * W + x) * 3;
      if (y <= 103) {
        if (x === 14 || x === 48) glass(o, 0.2 + 0.7 * I, 26);
        else {
          const v = [0.5, 0.3, 0.45][y - 101] * I;
          const a = [40, 26, 13][y - 101];
          put(P, o, a + 255 * v * led[0], a + 255 * v * led[1], a + 4 + 255 * v * led[2]);
        }
      } else if (y <= 105) {
        const v = I * (y === 104 ? (x % 3 === 1 ? 1 : 0.72) : 0.42);
        const a = 16 * (1 - I);
        put(P, o, a + 255 * v * led[0], a + 255 * v * led[1], a + 255 * v * led[2]);
      } else if (y <= 111) {
        const c = 0.45 + 0.55 * exp(-(((x - 24) / 12) ** 2));
        const v = 0.3 * I * exp(-(y - 106) / 1.5);
        const a = 34 * c * (1 - (y - 106) * 0.06);
        put(P, o, a + 255 * v * led[0], a + 255 * v * led[1], a + 4 + 255 * v * led[2]);
      } else {
        const v = y === 112 ? 0.4 * I * exp(-(((x - CX) / 18) ** 2)) : 0.03 * I;
        const a = y === 112 ? 30 : 14;
        put(P, o, a + 255 * v * led[0], a + 255 * v * led[1], a + 4 + 255 * v * led[2]);
      }
    }
  }
}

// Signed distance to a rounded rectangle.
function box(x, y, x0, y0, x1, y1, r) {
  const qx = abs(x - (x0 + x1) / 2) - (x1 - x0) / 2 + r;
  const qy = abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + r;
  return hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r;
}

// The black handle, its inner face lit by the glass, and the switch at its foot.
function handle(P) {
  const { led } = P;
  const I = P.I;
  for (let y = 37; y <= 105; y++) {
    const lw = I * (0.25 + 0.75 * exp((y - BOT) / 24));
    for (let x = wallR(y) + 1; x <= 59; x++) {
      const out = box(x, y, 38, 37, 58, 105, 8);
      const inn = box(x, y, 38, 45, 52.5, 96, 5);
      if (out > 0 || inn < 0) continue;
      let a = 11 + (x === 55 && y > 46 && y < 95 ? 9 : 0);
      if (out > -1.2) a += y < 50 || x < 50 ? 26 : 14;
      const v = inn < 1.4 && x > 50 ? 0.3 * lw : inn < 1.4 && y > 95 ? 0.18 * lw : 0;
      put(P, (y * W + x) * 3, a + 255 * v * led[0], a + 255 * v * led[1], a + 3 + 255 * v * led[2]);
    }
  }
  // The rocker tips as it clicks; its light shows the kettle is on.
  const o = P.on ? 0 : 1;
  for (let y = 99; y <= 102; y++)
    for (let x = 53; x <= 56; x++) {
      const lit = y === 101 + o && (x === 54 || x === 55);
      const v = lit ? 0.4 + 0.6 * I : 0;
      const a = lit ? 20 : y === 99 + o ? 58 : 34;
      put(P, (y * W + x) * 3, a + 255 * v * led[0], a + 255 * v * led[1], a + 4 + 255 * v * led[2]);
    }
}

// Level marks printed on the glass: every quarter litre from 0.5, and MAX at 1.7.
function gauge(P) {
  const { led, sr } = P;
  const I = P.I;
  const ink = (x, y) => {
    const wet = y >= sr[x];
    const v = wet ? 30 + 150 * I * (0.25 + 0.75 * exp((y - BOT) / 24)) : 34 + 50 * I;
    const o = (y * W + x) * 3;
    for (let i = 0; i < 3; i++) P.buf[o + i] = v * (0.7 + 0.3 * led[i]);
  };
  for (const L of [0.5, 0.75, 1, 1.25, 1.5, 1.7]) {
    const y = round(101 - (L / 1.7) * 55);
    const len = L === 1.7 ? 5 : L % 0.5 ? 2 : 4;
    for (let i = 0; i < len; i++) ink(wallL(y) + 2 + i, y);
  }
  for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) if (MAXT[j][i] === "1") ink(25 + i + (i > 2) + (i > 5), 44 + j);
}

function bubbles(P) {
  const { led, sr, bx, by, br } = P;
  const I = P.I;
  const k = 0.3 + 0.7 * I;
  const bc = [0, 1, 2].map((i) => (0.45 * led[i] + 0.55) * k);
  const wet = (x, y) => x >= 0 && x < W && y >= sr[x] && y <= BOT;
  for (let i = 0; i < NC; i++) {
    const v = P.cling - P.ct[i];
    if (v > 0 && wet(P.cx[i], P.cy[i])) add(P, P.cx[i], P.cy[i], bc, min(1, v * 4) * 150 * (0.8 + 0.2 * sin(P.t * 9 + i)));
  }
  for (let i = 0; i < P.nb; i++) {
    const r = br[i];
    if (r < 0.9) {
      if (wet(round(bx[i]), round(by[i]))) lift(P, round(bx[i]), round(by[i]), bc, 150);
      continue;
    }
    for (let y = floor(by[i] - r); y <= Math.ceil(by[i] + r); y++)
      for (let x = floor(bx[i] - r); x <= Math.ceil(bx[i] + r); x++) {
        const d = hypot(x - bx[i], y - by[i]);
        if (d > r + 0.5 || !wet(x, y)) continue;
        const e = abs(d - r);
        if (e < 0.7) lift(P, x, y, bc, 150);
        else if (d < 0.8 && x < bx[i]) lift(P, x, y, bc, 120);
      }
  }
  for (let i = 0; i < P.ns; i++) if (P.dy[i] >= TOP) add(P, round(P.dx[i]), round(P.dy[i]), bc, 140);
  // Drops of condensation, and the ones running down.
  const fc = [0, 1, 2].map((i) => 0.6 * led[i] + 0.4);
  for (let i = 0; i < ND; i++) {
    const x = P.qx[i];
    const y = P.qy[i];
    const v = P.F - P.qt[i];
    if (v > 0 && y < sr[x] - 1) add(P, x, y, fc, min(1, v * 2.5) * (25 + 120 * I) * (1 - P.wipe[y * W + x]));
  }
  for (const [x, y] of P.runners) add(P, x | 0, y | 0, fc, 40 + 150 * I);
}

// Steam: puffs splatted at half resolution, broken into wisps, lit from below
// by the glass and faintly by the night.
function steam(P) {
  const { S, wisp, px, py, pr, pa, pg, pl, led, buf } = P;
  S.fill(0);
  for (let i = 0; i < P.np; i++) {
    const a = pa[i] * min(1, pg[i] / 0.3) * (1 - pg[i] / pl[i]) ** 1.6;
    const cx = px[i] / 2;
    const cy = py[i] / 2;
    const r = pr[i] / 2;
    const r2 = r * r;
    for (let y = max(0, floor(cy - r)); y <= min(SH - 1, Math.ceil(cy + r)); y++)
      for (let x = max(0, floor(cx - r)); x <= min(SW - 1, Math.ceil(cx + r)); x++) {
        const d = ((x - cx) ** 2 + (y - cy) ** 2) / r2;
        if (d < 1) S[y * SW + x] += a * (1 - d) * (1 - d);
      }
  }
  const off = P.t * 2.2;
  const j0 = floor(off);
  const f = off - j0;
  for (let y = 0; y < 26; y++)
    for (let x = 0; x < SW; x++) {
      const a = wisp[((y + j0) % SH) * SW + x];
      const b = wisp[((y + j0 + 1) % SH) * SW + x];
      S[y * SW + x] *= 0.4 + 1.3 * (a + (b - a) * f);
    }
  const I = P.I;
  const sc = [0, 1, 2].map((i) => 0.55 * led[i] + 0.45 * [0.9, 0.95, 1][i]);
  for (let y = 0; y < 50; y++) {
    const light = 30 + I * 170 * (0.45 + 0.55 * exp(-max(0, 36 - y) / 30));
    const hy = clamp(y / 2 - 0.25, 0, SH - 1.001);
    const y0 = floor(hy);
    const fy = hy - y0;
    for (let x = 0; x < W; x++) {
      const hx = clamp(x / 2 - 0.25, 0, SW - 1.001);
      const x0 = floor(hx);
      const fx = hx - x0;
      const q = y0 * SW + x0;
      const top = S[q] + (S[q + 1] - S[q]) * fx;
      const bot = S[q + SW] + (S[q + SW + 1] - S[q + SW]) * fx;
      const v = top + (bot - top) * fy;
      if (v < 0.003) continue;
      const s = (1 - exp(-1.4 * v)) * light;
      const o = (y * W + x) * 3;
      for (let i = 0; i < 3; i++) buf[o + i] += s * sc[i];
    }
  }
}

export function draw(display, params) {
  const P = params;
  const { buf, led } = P;
  const f = P.hue * 4;
  const li = min(3, floor(f));
  for (let c = 0; c < 3; c++) led[c] = (LEDS[li][c] + (LEDS[li + 1][c] - LEDS[li][c]) * (f - li)) / 255;
  // The room, the lid, the base and the handle are drawn into a layer of their
  // own and kept until the light, the water level or the switch changes.
  const key = `${round(P.I * 60)} ${P.hue} ${P.surf0} ${P.on}`;
  if (key !== P.key) {
    P.key = key;
    P.stat = P.stat || new Float32Array(N * 3);
    P.buf = P.stat;
    room(P);
    shell(P);
    handle(P);
    P.buf = buf;
  }
  buf.set(P.stat);
  glass(P);
  gauge(P);
  bubbles(P);
  steam(P);
  for (let p = 0, o = 0; p < N; p++, o += 3) {
    display.setPixel(p % W, (p / W) | 0, min(255, buf[o]), min(255, buf[o + 1]), min(255, buf[o + 2]));
  }
}
