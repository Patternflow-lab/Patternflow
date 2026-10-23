// ===== Patternflow pattern =====
// Title:   Pancakes
// Family:  kitchen
// Idea:    A seasoned griddle seen from above: batter is ladled into rounds that spread, bubbles rise and pop and leave holes as the tops set and the rims go golden, a turner flips each one to show its fried side and slides the done ones onto a stack on the plate below, while butter melts in the empty places and oil glints on the iron.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 21, after the flat-top griddles of diner breakfast counters
// Round:   21
// ===============================
// @matrix 64x128
// @knobs Batter=0..1, Speed=0.2..3, Pancakes=6..12, Heat=0..1
//
// Knob 1: Batter. Buttermilk at 0, then blueberry, buckwheat and cocoa at 1; the bowl changes at once and the next rounds are poured from it.
// Knob 2: Speed. How fast the cook works: at 2 a pancake takes about 17 s from the ladle to the plate, and a flip or a serve comes every two or three seconds.
// Knob 3: Pancakes. How many rounds the cook keeps on the iron: six big ones in two columns at 6, twelve silver dollars in three at 12, and one turner for all of them.
// Knob 4: Heat. How hot the griddle runs. Near the low end the pancakes come out golden; turned up they cook faster, bubble more, fry dark brown and the oil starts to smoke.
// Buttons: K1 tap sends the turner to the pancake furthest along, to flip it or serve it now.

const W = 64;
const H = 128;
const N = W * H;
// The iron runs from row IR0 to IR1, the grease trough under it, and the
// butcher block from row CT down, with the batter bowl and the plate on it.
const [IR0, IR1, CT] = [3, 90, 94];
const [PX, PY, PR] = [42, 112, 16.5];
const [BX, BY, BR] = [7, 114, 12.5];
const [EMPTY, POUR, SIDE1, FLIP, SIDE2, SERVE] = [0, 1, 2, 3, 4, 5];
// Pancakes to a full plate; how long the turner takes to get anywhere.
const FULL = 7;
const GO = 0.3;
const { min, max, floor, round, ceil, sin, cos, abs, hypot, exp, atan2, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (x) => ((x = cl(x, 0, 1)), x * x * (3 - 2 * x));
function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x, y) {
  const xi = floor(x), yi = floor(y), u = sm(x - xi), v = sm(y - yi), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + hash(xi + 1, yi + 1)) * u * v;
}

// Each batter: the wet top, the set top, the inside a popped bubble shows,
// and the fried side from pale through golden to dark.
const BAT = [
  [[228, 212, 166], [222, 196, 142], [64, 38, 18], [232, 194, 124], [206, 138, 66], [118, 60, 24]],
  [[226, 212, 172], [218, 196, 148], [62, 38, 22], [228, 190, 126], [202, 134, 68], [114, 58, 26]],
  [[196, 170, 142], [182, 152, 120], [52, 34, 24], [188, 148, 108], [150, 98, 58], [84, 46, 28]],
  [[134, 88, 62], [118, 76, 52], [40, 24, 16], [124, 78, 52], [94, 54, 34], [54, 28, 18]],
];
// A blueberry's skin, raw and baked.
const BERRY = [[64, 40, 118], [50, 28, 70]];
const C = [0, 0, 0];
function fry(bt, b) {
  b = cl(b, 0, 1);
  const [a, c, t] = b < 0.5 ? [bt[3], bt[4], b * 2] : [bt[4], bt[5], b * 2 - 1];
  for (let i = 0; i < 3; i++) C[i] = a[i] + (c[i] - a[i]) * t;
  return C;
}

let B;
const ok = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
function put(x, y, r, g, b) {
  if (!ok(x, y)) return;
  const o = (y * W + x) * 3;
  [B[o], B[o + 1], B[o + 2]] = [r, g, b];
}
function blend(x, y, r, g, b, a) {
  if (!ok(x, y)) return;
  const o = (y * W + x) * 3;
  B[o] += (r - B[o]) * a;
  B[o + 1] += (g - B[o + 1]) * a;
  B[o + 2] += (b - B[o + 2]) * a;
}
function dim(x, y, k) {
  if (!ok(x, y)) return;
  const o = (y * W + x) * 3;
  B[o] *= k;
  B[o + 1] *= k;
  B[o + 2] *= k;
}

function build(P) {
  const bg = P.bg, mk = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const x = p & 63, y = p >> 6, odd = (x + y) & 1;
    let r, g, b, k;
    P.G[p] = 0.85 + 0.1 * floor(hash(x + 77, y + 5) * 3);
    if (y < IR0) (k = 0.8 + 0.12 * vn(x * 0.4, y * 3)), ([r, g, b] = [170 * k, 172 * k, 178 * k]);
    else if (y <= IR1) {
      // Seasoning lies thicker in patches, a little bronze, with crumbs of
      // old batter.
      const s = vn(x * 0.08, y * 0.06) * 0.6 + vn(x * 0.21 + 9, y * 0.19) * 0.4;
      k = 0.84 + 0.32 * s;
      [r, g, b] = [(52 + 10 * s) * k, 44 * k, 39 * k];
      if (odd && rnd() < 0.024) ([r, g, b] = [196, 140, 70]), (mk[p] = 1);
    } else if (y === IR1 + 1) (k = 0.92 + 0.06 * vn(x * 0.5, 1)), ([r, g, b] = [200 * k, 200 * k, 204 * k]);
    else if (y === IR1 + 2) (k = 0.85 + 0.2 * vn(x * 0.25, 3)), ([r, g, b] = [96 * k, 64 * k, 26 * k]);
    else if (y < CT) [r, g, b] = [180, 180, 186];
    else {
      // Oak strips seven LEDs wide, with dark pores along the grain.
      const s = floor((x + 2) / 7), t = hash(s, 5);
      k = (0.9 + 0.08 * t) * (0.92 + 0.14 * vn(x * 0.5 + s * 13, y * 0.09));
      [r, g, b] = [(176 + 20 * t) * k, 126 * k, 76 * k];
      if (!odd && rnd() < 0.12) (r *= 0.28), (g *= 0.26), (b *= 0.25);
    }
    [bg[p * 3], bg[p * 3 + 1], bg[p * 3 + 2]] = [r, g, b];
  }
  // The hood lights' reflection, and oil specks that catch it.
  for (let p = IR0 * W; p <= IR1 * W + 63; p++) {
    const x = p & 63, y = p >> 6;
    P.sheen[p] = exp(-(((x - 20) / 17) ** 2) - (((y - 30) / 11) ** 2)) + 0.8 * exp(-(((x - 44) / 15) ** 2) - (((y - 68) / 12) ** 2));
  }
  P.glint = [];
  for (let p = (IR0 + 1) * W; p < IR1 * W; p++) if (!mk[p] && ((p + (p >> 6)) & 1) && rnd() < 0.12) P.glint.push(p, rnd() * 7, 1.5 + rnd() * 3);
}

function layout(P, n) {
  const cols = n <= 8 ? 2 : 3, rows = ceil(n / cols), cw = W / cols, ch = (IR1 - IR0 - 1) / rows, R = min(cw, ch) / 2 - 1.6;
  if (P.carry) P.stack.push(P.carry), (P.carry = null);
  P.n = n;
  P.slots = Array.from({ length: n }, (_, i) => {
    const x = round(((i % cols) + 0.5) * cw + (rnd() - 0.5) * 2), y = round(IR0 + 1 + (floor(i / cols) + 0.5) * ch + (rnd() - 0.5) * 2);
    return { x, y: y + ((x + y) & 1), R, st: EMPTY, t: rnd(), melt: 0.8 + rnd() * 0.6, p: 0, cake: null };
  });
  P.sp.job = P.ld.job = null;
}

// A fresh round: its wobbly outline, where bubbles will come up, the dark
// flecks the iron leaves on the fried side, and the berries.
function newCake(P, s) {
  const R = s.R, h = ceil(R * 1.08) + 1, sz = 2 * h + 1, n = sz * sz, berry = P.bi === 1;
  const k = { bi: P.bi, R, h, sz, b: 0, ox: 0, oy: 0, S1: P.S1 * (0.55 + (0.45 * R) / 12.7), dd: new Float32Array(n), site: new Float32Array(n), spk: new Uint8Array(n), mot: new Float32Array(n) };
  const [a1, a2, m0, dens] = [rnd() * 7, rnd() * 7, rnd() * 50, 0.4 + 0.25 * P.heat];
  for (let j = -h, q = 0; j <= h; j++)
    for (let i = -h; i <= h; i++, q++) {
      const a = atan2(j, i), d = (k.dd[q] = hypot(i, j) / (R * (1 + 0.035 * sin(3 * a + a1) + 0.025 * sin(5 * a + a2))));
      k.mot[q] = vn(i * 0.3 + m0, j * 0.3);
      if ((i + j) & 1) continue;
      if (berry && rnd() < 0.07) k.spk[q] = 2;
      else {
        if (d < 0.97 && rnd() < dens) k.site[q] = 0.12 + 0.88 * rnd() ** 0.6;
        if (rnd() < 0.36) k.spk[q] = 1;
      }
    }
  return k;
}

// One pancake centred on (cx, cy): the raw top up (fried 0) or the fried side
// (fried 1), squashed to sy as it turns over and spread to rs while poured.
function cake(P, k, cx, cy, sx, sy, fried, p, rs = 1, lit = 1) {
  const bt = BAT[k.bi], { h, sz, dd, site, spk, mot, R, S1 } = k, ex = h * abs(sx) + 1, ey = h * abs(sy) + 1, setR = 1.02 - 1.1 * p;
  if (abs(sy) < 0.05) return;
  for (let y = max(0, floor(cy - ey)); y <= min(H - 1, ceil(cy + ey)); y++)
    for (let x = max(0, floor(cx - ex)); x <= min(W - 1, ceil(cx + ex)); x++) {
      const i = round((x - cx) / sx), j = round((y - cy) / sy);
      if (i < -h || i > h || j < -h || j > h) continue;
      const q = (j + h) * sz + i + h, d = dd[q] / rs;
      if (d > 1) continue;
      let r, g, b;
      if (!fried) {
        // Wet batter shines; it sets from the rim in, and the rim shows the
        // browning underneath.
        const wet = sm((setR - d) / 0.14 + 0.5), dome = 1.02 - 0.06 * d * d, gl = wet * 14 * exp(-((i / R + 0.3) ** 2 + (j / R + 0.38) ** 2) * 7);
        r = mix(bt[1][0], bt[0][0], wet) * dome + gl;
        g = mix(bt[1][1], bt[0][1], wet) * dome + gl;
        b = mix(bt[1][2], bt[0][2], wet) * dome + gl * 0.8;
        const e = sm((d - 0.8) / 0.2) * cl(p * 1.5, 0, 1);
        if (e > 0) fry(bt, k.b), (r = mix(r, C[0], e)), (g = mix(g, C[1], e)), (b = mix(b, C[2], e));
        const tb = site[q];
        if (tb && p > tb) {
          // A bubble shines for a moment and pops. Where the batter is still
          // wet the hole closes again; where it has set it stays open.
          const age = (p - tb) * S1;
          if (age < 0.3) (r = mix(r, 255, 0.5)), (g = mix(g, 250, 0.5)), (b = mix(b, 236, 0.5));
          else {
            const hk = d < 1.02 - 1.1 * (tb + 0.3 / S1) ? 1 - cl((age - 0.3) / 0.5, 0, 1) : 1;
            (r = mix(r, bt[2][0], hk)), (g = mix(g, bt[2][1], hk)), (b = mix(b, bt[2][2], hk));
          }
        }
      } else {
        fry(bt, k.b * (1.12 - 0.42 * sm((d - 0.5) / 0.5)) * (0.86 + 0.28 * mot[q]) + (spk[q] === 1 ? 0.55 : 0));
        [r, g, b] = C;
        if (spk[q] === 1) (r *= 0.46), (g *= 0.44), (b *= 0.44);
        const e = sm((d - 0.88) / 0.12);
        (r = mix(r, bt[1][0] * 0.9, e)), (g = mix(g, bt[1][1] * 0.9, e)), (b = mix(b, bt[1][2] * 0.9, e));
      }
      if (spk[q] === 2) [r, g, b] = BERRY[fried];
      put(x, y, r * lit, g * lit, b * lit);
    }
}

// A small offset that keeps a pancake's flecks on the grain's dark squares.
function jig() {
  const ox = floor(rnd() * 3) - 1;
  return [ox, ox ? (rnd() < 0.5 ? -1 : 1) : 0];
}

// Shadows fade over three LEDs so their edge stays soft under the grain.
function shadow(cx, cy, R, k) {
  for (let y = floor(cy - R - 2); y <= cy + R + 2; y++)
    for (let x = floor(cx - R - 2); x <= cx + R + 2; x++) {
      const e = sm((hypot(x - cx, y - cy) - R + 1.5) / 3);
      if (e < 1) dim(x, y, k + (1 - k) * e);
    }
}

export function setup(params) {
  const P = params;
  Object.assign(P, { bg: new Float32Array(N * 3), buf: new Float32Array(N * 3), G: new Float32Array(N), sheen: new Float32Array(N), t: 0, n: 0, stack: [], carry: null, pat: -1, pdx: 0, pdy: 0, pst: 0, spat: [], steam: [] });
  P.sp = { x: 70, y: 140, job: null, ph: 0, t: 0, idle: 0 };
  P.ld = { x: 11, y: 110, job: null, ph: 3, t: 0 };
  build(P);
}

// Turn the iron to a cooking morning: a few on each side, a stack already
// started, and then the cook's own clock runs on a while.
function warm(P) {
  const S = [...P.slots].sort(() => rnd() - 0.5);
  S.forEach((s, i) => {
    const f = (i + 0.5) / S.length;
    if (f < 0.12) return;
    s.cake = newCake(P, s);
    if (f < 0.6) (s.st = SIDE1), (s.t = ((f - 0.12) / 0.48) * s.cake.S1 * 0.95);
    else (s.st = SIDE2), (s.t = (f - 0.6) * 9), (s.cake.b = 0.36 + 0.56 * P.heat);
  });
  for (let i = 0, n = 3 + floor(rnd() * 2); i < n; i++) {
    const k = newCake(P, { R: P.slots[0].R });
    [k.b, k.ox, k.oy] = [0.36 + 0.56 * P.heat, ...jig()];
    P.stack.push(k);
  }
  for (let i = 0, n = round(6 * P.rate * 30); i < n; i++) step(P, 1 / 30);
}

export function update(dt, input, params) {
  const P = params, k = input.knobValues || [0, 2, 6, 0.06];
  P.bi = round(cl(k[0], 0, 1) * 3);
  P.rate = cl(k[1], 0.2, 3) / 2;
  P.heat = cl(k[3], 0, 1);
  P.S1 = 8 / (0.7 + 0.8 * P.heat);
  const n = round(cl(k[2], 6, 12));
  if (n !== P.n) layout(P, n);
  if (!P.warm) (P.warm = true), warm(P);
  if (input.btnPressed?.[0]) {
    let best = null;
    for (const s of P.slots) if ((s.st === SIDE1 || s.st === SIDE2) && (!best || s.p > best.p)) best = s;
    if (best) best.rush = true;
  }
  step(P, cl(dt, 0, 0.1) * P.rate);
}

function step(P, d) {
  const sp = P.sp, ld = P.ld;
  P.t += d;
  for (const s of P.slots) {
    s.t += d;
    const k = s.cake;
    if (s.st === SIDE1) (s.p = s.t / k.S1), (k.b = (0.36 + 0.56 * P.heat) * min(1.3, s.p));
    else if (s.st === SIDE2) s.p = s.t / (k.S1 * 0.62);
    // Steam from the cooking ones, smoke when the iron runs too hot.
    if ((s.st === SIDE2 || (s.st === SIDE1 && s.p > 0.5)) && rnd() < d * 2) P.steam.push([s.x + (rnd() - 0.5) * s.R, s.y + (rnd() - 0.5) * s.R, 1, 0]);
    if (s.st >= SIDE1 && rnd() < d * 6 * max(0, P.heat - 0.5)) P.steam.push([s.x + (rnd() - 0.5) * s.R * 2, s.y + (rnd() - 0.5) * s.R * 2, 1, 1]);
  }
  // The turner: the most overdue pancake first.
  if (!sp.job) {
    let best = null, over = 0;
    for (const s of P.slots) {
      const o = s.st === SIDE1 || (s.st === SIDE2 && !P.pst && P.pat < 0) ? s.p - 1 + (s.rush ? 99 : 0) : -1;
      if (o >= over) (best = s), (over = o);
    }
    if (best) Object.assign(sp, { job: best, ph: 0, t: 0, fx: sp.x, fy: sp.y, mode: best.st === SIDE1 ? FLIP : SERVE });
    else if ((sp.idle += d) > 0.6) (sp.x += (70 - sp.x) * min(1, d * 3)), (sp.y += (140 - sp.y) * min(1, d * 3));
  }
  const s = sp.job;
  if (s) {
    sp.t += d;
    const y0 = s.y + s.R + 6, y1 = s.y + 0.3 * s.R;
    if (sp.ph === 0) {
      const u = sm(sp.t / GO);
      [sp.x, sp.y] = [mix(sp.fx, s.x, u), mix(sp.fy, y0, u)];
      if (sp.t >= GO) (sp.ph = 1), (sp.t = 0), (s.st = sp.mode), (s.t = 0), (s.rush = false), (s.land = false);
    } else if (sp.mode === FLIP) {
      const u = sp.t / (0.7 * (s.R / 12.7) ** 0.5);
      sp.x = s.x;
      sp.y = u < 0.3 ? mix(y0, y1, sm(u / 0.3)) : u < 0.85 ? y1 - 3 * sin((PI * (u - 0.3)) / 0.55) : mix(y1, y0 + 2, sm((u - 0.85) / 0.15));
      s.u = u;
      if (u >= 0.85 && !s.land) {
        s.land = true;
        for (let i = 0; i < 8; i++) {
          const a = rnd() * 2 * PI, r = s.R + 1 + rnd() * 4;
          const x = round(s.x + cos(a) * r), y = round(s.y + sin(a) * r);
          P.spat.push([x + 1 - ((x + y) & 1), y, 1]);
        }
      }
      if (u >= 1) (s.st = SIDE2), (s.t = 0), (s.p = 0), (sp.job = null), (sp.idle = 0);
    } else {
      const u = sp.t / 1.2;
      if (u < 0.25) (sp.x = s.x), (sp.y = mix(y0, y1, sm(u / 0.25)));
      else if (u < 0.85) {
        if (!P.carry) (P.carry = s.cake), (s.cake = null), (s.st = EMPTY), (s.t = 0), (s.melt = 0.8 + rnd() * 0.6), ([P.carry.ox, P.carry.oy] = jig());
        const w = sm((u - 0.25) / 0.6), k = P.carry;
        k.x = mix(s.x, PX + k.ox, w);
        k.y = mix(s.y, PY + k.oy, w);
        k.lift = sin(PI * w);
        [sp.x, sp.y] = [k.x, k.y + 0.3 * s.R - 3 * k.lift];
      } else {
        if (P.carry) {
          P.stack.push(P.carry);
          P.carry = null;
          if (P.stack.length >= FULL) P.pat = 0;
          [sp.fx, sp.fy] = [sp.x, sp.y];
        }
        const w = sm((u - 0.85) / 0.15);
        [sp.x, sp.y] = [mix(sp.fx, sp.fx + 8, w), mix(sp.fy, sp.fy + 14, w)];
      }
      if (u >= 1) (sp.job = null), (sp.idle = 0);
    }
  }
  // The ladle, from the bowl to an empty place and back to dip again.
  if (!ld.job && ld.ph === 3) {
    let best = null;
    for (const s of P.slots) if (s.st === EMPTY && s.t > s.melt && (!best || s.t > best.t)) best = s;
    if (best) Object.assign(ld, { job: best, ph: 0, t: 0, fx: ld.x, fy: ld.y });
  }
  const L = ld.job;
  ld.t += d;
  if (ld.ph === 0 && L) {
    const u = sm(ld.t / 0.45);
    [ld.x, ld.y] = [mix(ld.fx, L.x - 2, u), mix(ld.fy, L.y - 3, u)];
    if (ld.t >= 0.45) (ld.ph = 1), (ld.t = 0), (L.st = POUR), (L.t = 0), (L.rs = 0.05), (L.cake = newCake(P, L));
  } else if (ld.ph === 1 && L) {
    const u = ld.t / (0.9 * (L.R / 12.7));
    L.rs = 1 - (1 - min(1, u)) ** 2;
    if (u >= 1) (L.st = SIDE1), (L.t = 0), (L.p = 0), (ld.ph = 2), (ld.t = 0), ([ld.fx, ld.fy] = [ld.x, ld.y]);
  } else if (ld.ph === 2) {
    const u = sm(ld.t / 0.45);
    [ld.x, ld.y] = [mix(ld.fx, 11, u), mix(ld.fy, 110, u)];
    if (ld.t >= 0.7) (ld.ph = 3), (ld.job = null);
  } else if (!L) (ld.ph = 2), (ld.t = 0.45), ([ld.fx, ld.fy] = [ld.x, ld.y]);
  // A full plate gets its butter, then goes out to the right and a clean one
  // comes up from below.
  if (P.pat >= 0 && (P.pat += d) > 3.5 && !P.pst) P.pst = 1;
  if (P.pst === 1 && (P.pdx += 60 * d) > 60) Object.assign(P, { stack: [], pat: -1, pdx: 0, pdy: 40, pst: 2 });
  if (P.pst === 2 && (P.pdy -= 40 * d) <= 0) (P.pdy = 0), (P.pst = 0);
  P.spat = P.spat.filter((q) => (q[2] -= d * 0.6) > 0);
  P.steam = P.steam.filter((q) => ((q[1] -= (q[3] ? 9 : 6) * d), (q[0] += 2.5 * d), (q[2] -= d * 0.7) > 0));
}

function iron(P) {
  const { sheen, glint, t, heat } = P;
  for (let p = IR0 * W; p <= IR1 * W + 63; p++) {
    const s = sheen[p] * (0.85 + 0.15 * sin((p >> 6) * 0.5 - t * 4)) * 26;
    B[p * 3] += s;
    B[p * 3 + 1] += s * 0.95;
    B[p * 3 + 2] += s * 0.86;
  }
  for (let i = 0; i < glint.length; i += 3) {
    const p = glint[i], tw = 0.5 + 0.5 * sin(t * glint[i + 2] * (1 + heat) + glint[i + 1]), v = 205 + 50 * (0.4 + 0.6 * sheen[p]) * tw * tw;
    put(p & 63, p >> 6, v, v * 0.94, v * 0.8);
  }
  // Butter melting where the next one goes, and still frying round the new ones.
  for (const s of P.slots) {
    const m = s.st === EMPTY ? cl(s.t / s.melt, 0, 1) : s.st === POUR ? 1 : s.st === SIDE1 ? 1 - cl(s.t / 3, 0, 1) : 0;
    if (!m) continue;
    const pr = s.R * (s.st === EMPTY ? 0.25 + 0.6 * m : 1 + 0.25 * m), f = floor(t * 7);
    for (let y = floor(s.y - pr); y <= s.y + pr; y++)
      for (let x = floor(s.x - pr); x <= s.x + pr; x++) {
        const d = hypot(x - s.x, y - s.y) / pr;
        if (d > 1) continue;
        blend(x, y, 196, 152, 60, 0.75);
        if ((x + y) & 1 && hash(x * 3 + f, y) < 0.28 * (1 - d * 0.5)) put(x, y, 248, 238, 204);
      }
    if (s.st === EMPTY) {
      const hs = 2.6 * (1 - 0.8 * m);
      for (let y = round(s.y - hs); y <= s.y + hs; y++) for (let x = round(s.x - hs); x <= s.x + hs; x++) put(x, y, 252, 232, 140);
    }
  }
  for (const [x, y, l] of P.spat) put(x, y, 120 + 130 * l, 110 + 120 * l, 90 + 90 * l);
}

// A white enamel bowl with a navy rolled rim, full of batter.
function bowl(P) {
  const bt = BAT[P.bi][0];
  for (let y = BY - 16; y < H; y++)
    for (let x = 0; x <= BX + 16; x++) {
      const dx = x - BX, dy = y - BY, d = hypot(dx, dy);
      if (d > BR + 3) continue;
      if (d > BR) {
        if (dx + dy > 0) dim(x, y, 0.76 + 0.24 * sm((d - BR) / 3));
      } else if (d > BR - 1.6) {
        const k = 0.85 + 0.2 * cos(atan2(dy, dx) + 2.3);
        put(x, y, 26 * k, 38 * k, 88 * k);
      } else {
        const k = 0.92 + 0.08 * vn(dx * 0.3 + P.t * 0.2, dy * 0.3) - 0.12 * sm((d - BR + 7) / 5);
        if (P.bi === 1 && !((x + y) & 1) && hash(x + 3, y) < 0.12) put(x, y, ...BERRY[0]);
        else put(x, y, bt[0] * k, bt[1] * k, bt[2] * k);
      }
    }
}

// Charcoal stoneware: a raised rim that catches the light, the well, and
// cream flecks in the glaze.
function plate(P) {
  const cx = PX + P.pdx, cy = PY + P.pdy, st = P.stack;
  for (let y = floor(cy - PR - 3); y <= cy + PR + 3; y++)
    for (let x = floor(cx - PR - 3); x <= cx + PR + 3; x++) {
      const dx = x - cx, dy = y - cy, d = hypot(dx, dy);
      if (d > PR + 3) continue;
      if (d > PR) {
        if (dx + dy > 0) dim(x, y, 0.76 + 0.24 * sm((d - PR) / 3));
        continue;
      }
      const k = mix(0.86, 0.98 + 0.1 * cos(atan2(dy, dx) + 2.4), sm((d - PR + 5.5) / 2.5));
      if ((dx + dy) & 1 && hash(dx + 40, dy + 40) < 0.1) put(x, y, 206, 198, 178);
      else put(x, y, 66 * k, 72 * k, 86 * k);
    }
  if (!st.length) return;
  shadow(cx + st[0].ox + 1 + 0.4 * st.length, cy + st[0].oy + 1 + 0.4 * st.length, st[0].R, 0.7);
  st.forEach((k, i) => cake(P, k, cx + k.ox, cy + k.oy, 1, 1, 1, 1, 1, 0.9 ** (st.length - 1 - i)));
  if (P.pat < 0) return;
  const top = st[st.length - 1], bx = cx + top.ox + 1, by = cy + top.oy - 1, m = cl(P.pat / 3, 0, 1), pr = 2 + 4.5 * m, hs = 2.4 * (1 - 0.75 * m);
  for (let y = floor(by - pr); y <= by + pr; y++)
    for (let x = floor(bx - pr); x <= bx + pr; x++) {
      const d = hypot(x - bx, y - by) / pr;
      if (d < 1) blend(x, y, 252, 222, 124, 0.55 * (1 - d * d));
      if (abs(x - bx) <= hs && abs(y - by) <= hs) put(x, y, ...(x - bx >= hs - 1 || y - by >= hs - 1 ? [222, 198, 112] : [252, 238, 160]));
    }
}

// The turner: a slotted steel blade, its front edge up the panel, and a
// wooden handle off toward the cook's right hand. The shadow goes first.
function turner(x0, y0, sh, blade = true, grip = true) {
  x0 = round(x0);
  y0 = round(y0);
  const at = sh ? (x, y) => dim(x + 2, y + 3, 0.55) : put;
  for (let j = -5; blade && j <= 5; j++)
    for (let i = -4; i <= 4; i++) {
      if (j === -5 && abs(i) === 4) continue;
      const k = j === -4 ? 1.1 : 0.9 + 0.01 * j;
      abs(i) === 4 || abs(j) === 5 || (j === -4 && abs(i) === 3) ? at(x0 + i, y0 + j, 64, 64, 70)
      : (i === -2 || i === 0 || i === 2) && j >= -2 && j <= 2 ? at(x0 + i, y0 + j, 40, 38, 38)
      : at(x0 + i, y0 + j, 200 * k, 202 * k, 208 * k);
    }
  for (let s = 0; grip && s < 24; s++) {
    const x = round(x0 + 0.42 * s), y = y0 + 6 + s;
    if (s < 4) at(x, y, 170, 172, 178);
    else {
      const k = s === 9 || s === 17 ? 0 : 0.85 + 0.15 * (s & 1);
      for (let w = 0; w < 2; w++) k ? at(x + w, y, 156 * k * (w ? 0.8 : 1), 100 * k * (w ? 0.8 : 1), 58 * k * (w ? 0.8 : 1)) : at(x + w, y, 214, 184, 112);
    }
  }
}

// The ladle: a steel cup, full of batter until it pours, its handle toward
// the cook's left hand.
function ladle(P, x0, y0, full, sh) {
  x0 = round(x0);
  y0 = round(y0);
  const at = sh ? (x, y) => dim(x + 2, y + 3, 0.55) : put, bt = BAT[P.bi][0];
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      const d = hypot(i, j), k = 0.8 + 0.2 * cos(atan2(j, i) + 2.3);
      if (d > 3.7) continue;
      d > 2.6 ? at(x0 + i, y0 + j, 206 * k, 208 * k, 212 * k) : full ? at(x0 + i, y0 + j, bt[0] * 0.95, bt[1] * 0.95, bt[2] * 0.95) : at(x0 + i, y0 + j, 110, 110, 116);
    }
  for (let s = 4; s < 28; s++) at(round(x0 - 0.5 * s), round(y0 + 0.86 * s), 184, 186, 192);
}

export function draw(display, params) {
  const P = params;
  if (!P.slots) return;
  B = P.buf;
  B.set(P.bg);
  iron(P);
  bowl(P);
  plate(P);
  const sp = P.sp, job = sp.job && sp.ph === 1 ? sp.job : null;
  for (const s of P.slots) {
    const k = s.cake;
    if (!k || s === job) continue;
    if (s.st === POUR) cake(P, k, s.x, s.y, 1, 1, 0, 0, s.rs);
    else cake(P, k, s.x, s.y, 1, 1, s.st === SIDE2 ? 1 : 0, s.st === SIDE1 ? s.p : 1);
  }
  if (job) {
    // The blade slides under the pancake, so it goes down before it.
    turner(sp.x, sp.y, true, true, false);
    turner(sp.x, sp.y, false, true, false);
    if (job.cake && sp.mode === FLIP) {
      const u = job.u || 0, v = cl((u - 0.3) / 0.55, 0, 1), l = sin(PI * v), sy = cos(PI * v) * (1 + 0.12 * l);
      if (l > 0) shadow(job.x + 1 + 2 * l, job.y + 2 + 2 * l, job.R, 1 - 0.4 * l);
      cake(P, job.cake, job.x, job.y - 4 * l, 1 + 0.12 * l, sy, u > 0.575 ? 1 : 0, u > 0.575 ? 1 : job.p);
    } else if (job.cake) cake(P, job.cake, job.x, job.y, 1, 1, 1, 1);
    const k = P.carry;
    if (k) {
      shadow(k.x + 1 + 2 * k.lift, k.y + 2 + 3 * k.lift, k.R, 0.6);
      cake(P, k, round(k.x), round(k.y - 2 * k.lift), 1 + 0.1 * k.lift, 1 + 0.1 * k.lift, 1, 1);
    }
    turner(sp.x, sp.y, true, false, true);
    turner(sp.x, sp.y, false, false, true);
  } else {
    turner(sp.x, sp.y, true);
    turner(sp.x, sp.y, false);
  }
  // Steam is white and thins as it rises; smoke is grey.
  for (const [x0, y0, l, smoke] of P.steam) {
    const r = smoke ? 4 : 2.6, a = smoke ? 0.3 * l * cl((P.heat - 0.5) * 2, 0, 1) : 0.14 * l;
    for (let y = floor(y0 - r); y <= y0 + r; y++)
      for (let x = floor(x0 - r); x <= x0 + r; x++) {
        const d = hypot(x - x0, y - y0) / r;
        if (d < 1) smoke ? blend(x, y, 120, 118, 116, a * (1 - d)) : blend(x, y, 240, 240, 236, a * (1 - d));
      }
  }
  const ld = P.ld, full = ld.ph === 3 || ld.ph === 0;
  ladle(P, ld.x, ld.y, full, true);
  ladle(P, ld.x, ld.y, full, false);
  show(display, B, P.G);
}

// To the panel through a fine grain: neighbouring LEDs lean opposite ways by
// a few levels, as the iron, the batter and the wood never lie quite flat.
function show(display, buf, G) {
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3, r = buf[o], g = buf[o + 1], b = buf[o + 2], L = max(r, g, b, 1);
      const f = 1 + (((x + y) & 1) * 2 - 1) * G[p] * min(16, 0.4 * L) / L;
      display.setPixel(x, y, min(255, max(0, r * f)), min(255, max(0, g * f)), min(255, max(0, b * f)));
    }
}
