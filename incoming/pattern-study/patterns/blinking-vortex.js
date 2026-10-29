// ===== Patternflow pattern =====
// Title:   Blinking Vortex
// Family:  sim
// Idea:    Two point vortices one above the other take turns, each spinning the fluid round itself for half a period while the other rests, and soft bands of two dyes, traced back exactly through every turn, are stretched and folded into filaments until they are finer than an LED and blend to one even colour, when a fresh dye is laid.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the blinking vortex flow (Hassan Aref, Stirring by chaotic advection, J. Fluid Mech. 143, 1984), pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Strength=2..16, Dye=0..3
//
// Knob 1: Hue. Turns both dyes round the wheel: at 0 one is turquoise and the other violet, both brightest in blue, so where they are mixed finer than an LED the brightness holds and only the colour blends to periwinkle.
// Knob 2: Speed. Half periods a second: 2.2 at 2, 0.22 at 0.2, 3.3 at 3.
// Knob 3: Strength. The stirring strength mu = Gamma T / (2 pi a^2), with 2a the distance between the vortices: fluid at the midpoint turns mu/2 radians each half period. At 2 each vortex winds the bands into its own spiral and the bands beyond them stay whole while an S of mixed dye grows between; past about 5 the S fills the middle within two half periods. A dye lasts 12/mu half periods, 6 at 2 and 3 from 4 up. The whole history is traced again at the new strength, so the picture answers at once.
// Knob 4: Dye. How the dye is laid: 0 bands across the panel, 20 rows each; 1 two halves either side of the line through the vortices, shaded in bands of 32 rows; 2 stripes down the panel, 16 columns each; 3 rings round the midpoint, 16 LEDs each. Every band is brightest along its middle and dark where the colour changes.
// Buttons: any knob's button lays a fresh dye now.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, exp, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Aref's flow had a circular wall; this one is the unbounded plane, so each
// vortex alone is the exact point-vortex field: fluid at distance r turns
// about it at Gamma / (2 pi r^2) radians a second and r never changes. A half
// period is then an exact rotation by an angle that depends on r alone,
//   theta(r) = Gamma T / (4 pi r^2) = mu a^2 / (2 r^2),
// with 2a the distance between the vortices. The vortices themselves never
// move: only one is on at a time, and a vortex is not moved by its own field.
const AV = 30, CX = 32, YA = 64 - AV, YB = 64 + AV, A2 = AV * AV;

// A dye lasts 12 / mu half periods (3 to 6), then a fresh one fades in at
// the start of the next. By then an S of dye mixed finer than an LED joins
// the two vortices.
const life = (mu) => cl(round(12 / mu), 3, 6);
// A fresh start begins this far into a dye, so the stirring shows at once.
const AHEAD = 2;

// The angles reach thousands of radians next to a vortex, so sine and cosine
// come from a table of 4096 steps with linear interpolation: an error near
// 3e-7, far below an LED, at half the cost of Math.sin and Math.cos.
const TB = 4096, MASK = TB - 1, KT = TB / (2 * PI);
const SN = new Float64Array(TB + 1), CS = new Float64Array(TB + 1);
for (let i = 0; i <= TB; i++) (SN[i] = sin(i / KT)), (CS[i] = cos(i / KT));

// One sample an LED, at its centre, and the LED's own square traced back
// with it: each half period's rotation has an exact Jacobian, so the square's
// two edges are carried back step by step, and the dye is averaged over the
// patch of the first dye they cover. Where the stirring has pulled one LED's
// worth of fluid out over many bands, the LED shows their mean instead of
// one band picked at random.
//
// The dye has two parts laid along one coordinate u: bands (u = y), stripes
// (u = x) or rings round the midpoint (u = distance), or two halves either
// side of the vortices (u = x - 32, with the shade along y). Its colour,
// dye A or dye B, changes sharply every P / 2 along u. Its shade rises and
// falls as a cosine of period P / 2, darkest where the colour changes and
// brightest in the middle of each band. The two colours share
// their brightest channel, so a colour edge never shows as a step in
// brightness; only the shade does, and the shade is soft.
const LAYOUTS = [
  { u: 1, P: 40 },
  { u: 3, P: 64 },
  { u: 0, P: 32 },
  { u: 2, P: 32 },
];
// Shade: L0 - L1 cos(4 pi u / P), from 0.17 to 0.97.
const L0 = 0.57, L1 = 0.4;
// The shade is averaged as if the LED were BLUR times its traced size, so a
// band of shade fades into its mean before it is squeezed steep enough to
// step more than 40 levels from one LED to the next; the colour is averaged
// over the LED's own traced size.
const BLUR = 3;

// The length of [0, P/2) mod P that lies below u.
function below(u, P) {
  const k = floor(u / P), r = u - k * P;
  return k * (P / 2) + (r > P / 2 ? P / 2 : r);
}

// The share of dye A in a box of width w round u.
function shareA(halves, u, w, P) {
  if (halves) return w < 1e-6 ? (u < 0 ? 1 : 0) : cl(0.5 - u / w, 0, 1);
  if (w < 1e-3) return u - floor(u / P) * P < P / 2 ? 1 : 0;
  if (w > 1e7) return 0.5;
  return (below(u + w / 2, P) - below(u - w / 2, P)) / w;
}

export function setup(params) {
  params.s = {
    n: AHEAD, f: 0, born: 0, gen: 0, old: -1, fade: 1,
    hue: 0, mu: 2, layout: 0,
    cv: [0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.mu = cl(k[2], 2, 16);
  S.layout = cl(round(k[3]), 0, 3);
  const rate = d * cl(k[1], 0.2, 3) * 1.1;
  S.f += rate;
  // A new dye fades in over 0.4 of a half period while the old one, still
  // being stirred under it, fades out.
  if (S.old >= 0 && (S.fade += rate * 2.5) >= 1) S.old = -1;
  const lay = () => ((S.old = S.born), (S.born = S.n), (S.gen ^= 1), (S.fade = 0));
  while (S.f >= 1) {
    S.f -= 1;
    S.n++;
    if (S.old < 0 && S.n - S.born >= life(S.mu)) lay();
  }
  // A press lays a fresh dye now.
  if (input.btnPressed && input.btnPressed.some(Boolean) && S.old < 0) lay();
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const n = S.n, f = S.f, c = (S.mu * A2) / 2, L = LAYOUTS[S.layout], gen = S.gen, cv = S.cv;
  // The new dye was laid at the start of half period born: it has been turned
  // by the whole half periods born..n-1 and part of n. An old dye still
  // fading out has been turned longer.
  const sNew = n - S.born + 1, sOld = S.old >= 0 ? n - S.old + 1 : -1;
  const steps = max(sNew, sOld);
  const fi = S.fade, wNew = sOld >= 0 ? fi * fi * (3 - 2 * fi) : 1;
  // Both dyes keep blue as their brightest channel at the opening hue.
  const dyeA = hsv(0.51 + S.hue, 0.75, 1), dyeB = hsv(0.79 + S.hue, 0.6, 1);
  const col = (a, lv, g, ch) => lv * (g ? dyeB[ch] * a + dyeA[ch] * (1 - a) : dyeA[ch] * a + dyeB[ch] * (1 - a));
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      let x = i + 0.5, y = j + 0.5;
      // The LED's two edges, carried back with it.
      let ux = 1, uy = 0, vx = 0, vy = 1;
      // Undo the part of the current half period already turned, then the
      // whole half periods before it, newest first. Half period m is
      // stirred by vortex A when m is even and by B when it is odd.
      let frac = f, m = n, aN = 0, lN = 0;
      for (let s = 0; s < steps; s++) {
        const cy = m & 1 ? YB : YA, dx = x - CX, dy = y - cy, r2 = dx * dx + dy * dy + 1e-9;
        const th = (frac * c) / r2;
        let a = th * KT;
        if (a > 1e9) a %= TB;
        const a0 = a | 0, t = a - a0, q = a0 & MASK;
        const co = CS[q] + t * (CS[q + 1] - CS[q]), sn = SN[q] + t * (SN[q + 1] - SN[q]);
        // Back in time: rotate by minus the angle. The angle falls off as
        // 1/r^2, so an edge e first shears by (2 theta / r^2)(d . e) along
        // the circle and then turns with the point.
        const sh = (2 * th) / r2, pu = sh * (dx * ux + dy * uy), pv = sh * (dx * vx + dy * vy);
        const ux1 = ux - dy * pu, uy1 = uy + dx * pu, vx1 = vx - dy * pv, vy1 = vy + dx * pv;
        ux = co * ux1 + sn * uy1, uy = co * uy1 - sn * ux1;
        vx = co * vx1 + sn * vy1, vy = co * vy1 - sn * vx1;
        x = CX + dx * co + dy * sn;
        y = cy - dx * sn + dy * co;
        frac = 1;
        m--;
        if (s + 1 === sNew) dyeAt(L, x, y, ux, uy, vx, vy, cv), (aN = cv[0]), (lN = cv[1]);
      }
      let r = col(aN, lN, gen, 0), g = col(aN, lN, gen, 1), b = col(aN, lN, gen, 2);
      if (wNew < 1) {
        dyeAt(L, x, y, ux, uy, vx, vy, cv);
        const k = 1 - wNew;
        r = r * wNew + k * col(cv[0], cv[1], gen ^ 1, 0);
        g = g * wNew + k * col(cv[0], cv[1], gen ^ 1, 1);
        b = b * wNew + k * col(cv[0], cv[1], gen ^ 1, 2);
      }
      display.setPixel(i, j, (255 * min(1, r)) | 0, (255 * min(1, g)) | 0, (255 * min(1, b)) | 0);
    }
  // The vortices: the one stirring burns white, the resting one is a dim ring.
  const on = n & 1 ? 1 : 0;
  for (let v = 0; v < 2; v++) {
    const cy = v ? YB : YA, act = v === on;
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -2; dx <= 1; dx++) {
        const r = sqrt((dx + 0.5) * (dx + 0.5) + (dy + 0.5) * (dy + 0.5));
        const x = CX + dx, y = cy + dy;
        if (act) {
          const b = r < 1 ? 255 : r < 2 ? 150 : 0;
          if (b) display.setPixel(x, y, b, b, b);
        } else if (r > 1 && r < 2.2) display.setPixel(x, y, 120, 120, 130);
        else if (r < 1) display.setPixel(x, y, 0, 0, 0);
      }
  }
}

// The dye at the traced-back point (x, y), averaged over what the LED's
// traced-back edges cover: out[0] the share of dye A, out[1] the shade.
function dyeAt(L, x, y, ux, uy, vx, vy, out) {
  let u, w;
  if (L.u === 1) (u = y), (w = abs(uy) + abs(vy));
  else if (L.u === 0 || L.u === 3) (u = L.u === 3 ? x - CX : x), (w = abs(ux) + abs(vx));
  else {
    const dx = x - CX, dy = y - 64, r = sqrt(dx * dx + dy * dy) + 1e-9, gx = dx / r, gy = dy / r;
    (u = r), (w = abs(gx * ux + gy * uy) + abs(gx * vx + gy * vy));
  }
  // A square pulled out longer than a period does not stay straight: the
  // flow folds it, so it crosses the bands even when its two traced edges
  // happen to lie along them. Past a period, its length counts as width.
  const s = sqrt(ux * ux + uy * uy + vx * vx + vy * vy), fold = (s * s) / (s + L.P);
  out[0] = shareA(L.u === 3, u, max(w, fold), L.P);
  // The halves take their shade from bands along y.
  let us = u, ws = w;
  if (L.u === 3) (us = y), (ws = abs(uy) + abs(vy));
  // A cosine averaged over a Gaussian as wide as the box keeps
  // exp(-(k w)^2 / 24) of its swing, k its wavenumber.
  const kw = ((4 * PI) / L.P) * BLUR * max(ws, fold);
  out[1] = L0 - L1 * exp(-(kw * kw) / 24) * cos(((4 * PI) / L.P) * us);
}
