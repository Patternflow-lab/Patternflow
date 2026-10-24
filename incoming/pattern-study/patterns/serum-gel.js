// ===== Patternflow pattern =====
// Title:   Serum Gel
// Family:  cosmetic
// Idea:    A clear tinted gel fills the panel with pearls and air bubbles hanging in it; light through its jiggling surface draws a slow net of caustics on the back, the beads catch a highlight and a rim, and a tap sets the whole gel wobbling until the beads swing and settle.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 29, after the macro shots of serum and gel cream with suspended beads in skincare films
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beads=8..40, Wobble=0..1
//
// Knob 1: Hue. Turns the gel, its light and the pearls' sheen round the whole colour wheel together, opening on lilac.
// Knob 2: Speed. How fast the gel moves: the caustics crawl and the beads sway at 2; at 0.2 everything hangs nearly still.
// Knob 3: Beads. How many beads hang in the gel, from eight big ones to forty small ones, with two air bubbles for every three; the fewer there are, the bigger each one.
// Knob 4: Wobble. How much the gel jiggles on its own: at 0 it only breathes, turned up its surface ripples, the caustics sharpen into a busy net and the beads keep swinging.
// Buttons: K1 tap knocks the jar: the gel wobbles hard, the caustics swing with it, and the beads swing and settle.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, pow, abs, PI } = Math;
const rnd = () => Math.random();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The opening hue: lilac, not red.
const H0 = 0.78;
// Light rays are cast from a grid SS times finer than the LEDs, over a
// margin M beyond the panel so the edges get light from outside too. How
// far each ray is bent is worked out on a coarser grid, GS LEDs a step,
// since the ripples are much longer than that, and read between its points.
const SS = 1.5, M = 4, GS = 2, GW = (W + 2 * M) / GS + 2, GH = (H + 2 * M) / GS + 2;
const RW = (W + 2 * M) * SS, RH = (H + 2 * M) * SS;
// The surface ripples: six waves 18 to 40 LEDs long.
const NWV = 6;
// Specks of air, always there whatever the Beads knob says.
const SPECKS = 16;

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
  out[o] = r * 255;
  out[o + 1] = g * 255;
  out[o + 2] = b * 255;
}

// The gel's low modes of wobble, as displacement fields: side to side with
// the top swinging most, a bounce, a twist, and a squeeze. Each is a damped
// spring with its angular frequency at Speed 2.
const MODES = 4;
const OMEGA = [3.1, 4.3, 2.6, 5.4];
// They are kept on the coarse grid, which runs M LEDs past the panel on
// every side; the gel past the panel's edges does not move.
const GN = GW * GH, MX = new Float32Array(MODES * GN), MY = new Float32Array(MODES * GN);
for (let j = 0; j < GH; j++)
  for (let i = 0; i < GW; i++) {
    const x = cl(i * GS - M, 0, W), y = cl(j * GS - M, 0, H), p = j * GW + i;
    const sx = sin((PI * x) / W), sy = sin((PI * y) / H), top = cos((PI * y) / (2 * H));
    MX[p] = sx * top;
    MY[GN + p] = sx * sy;
    MX[2 * GN + p] = (-(y - H / 2) / 40) * sx * sy;
    MY[2 * GN + p] = ((x - W / 2) / 40) * sx * sy;
    MX[3 * GN + p] = sin((2 * PI * x) / W) * sy;
  }
// A cosine table, 1024 steps a turn.
const CT = new Float32Array(1024).map((_, i) => cos((i * 2 * PI) / 1024));
const fcos = (a) => CT[(a * 162.97466) & 1023];

export function setup(params) {
  params.s = {
    t: 0, wv: new Float32Array(NWV * 8), ph: new Float32Array(NWV), md: new Float32Array(MODES * 2), drive: new Float32Array(MODES), dead: 0,
    gx: new Float32Array(GN), gy: new Float32Array(GN), acc: new Float32Array(N), tmp: new Float32Array(N),
    beads: [], want: 0, hue: 0, wob: 0.06, sp: 2, ready: false,
    bg: new Float32Array(N * 3), col: new Float32Array(8 * 3),
  };
  const P = params.s;
  // Each ripple: its wave vector, how fast it creeps (0.4 to 1.2 LEDs a
  // second at Speed 2), its phase, the direction it bends light, and how
  // fast it jiggles to and fro in place, as a gel's surface does.
  for (let i = 0; i < NWV; i++) {
    const a = (i / NWV) * PI + rnd() * 0.5, L = 18 + rnd() * 22, o = i * 8;
    P.wv[o] = (cos(a) * 2 * PI) / L;
    P.wv[o + 1] = (sin(a) * 2 * PI) / L;
    P.wv[o + 2] = ((0.4 + rnd() * 0.8) * 2 * PI) / L;
    P.wv[o + 3] = rnd() * 2 * PI;
    P.wv[o + 4] = cos(a);
    P.wv[o + 5] = sin(a);
    P.wv[o + 6] = 1.6 + rnd() * 1.6;
    P.wv[o + 7] = rnd() * 2 * PI;
  }
}

// A bead hanging at rest point (hx, hy), depth z from 0 (near) to 1 (far),
// and where it is now. Kind 0 is a pearl, 3 a tinted capsule, 1 an air
// bubble, 2 one of the specks of air that every gel holds. The fewer beads,
// the bigger they are. Each new one tries a few places in its own band of
// the panel's height and keeps the one furthest from the others, so they
// spread out.
function bead(P, n, kind, all, band, bands) {
  const big = 10 * sqrt(8 / n), z = rnd(), f = 1 - 0.45 * z;
  const r = kind === 2 ? 0.7 + rnd() * 0.8 : kind === 1 ? big * (0.3 + 0.3 * rnd()) * f : big * (0.65 + 0.35 * rnd()) * f;
  let bx = 0, by = 0, best = -1;
  for (let tries = 0; tries < 12; tries++) {
    const x = r + 1 + rnd() * (W - 2 * r - 2), y = cl(((band + rnd()) / bands) * H, r + 2, H - r - 3);
    let near = 1e9;
    for (const b of all) if (!b.gone && b.kind !== 2) near = min(near, sqrt((b.hx - x) ** 2 + (b.hy - y) ** 2) - b.r - r);
    if (near > best) (best = near), (bx = x), (by = y);
  }
  if (kind === 0 && rnd() < 0.4) kind = 3;
  return { hx: bx, hy: by, x: bx, y: by, vx: 0, vy: 0, r, z, kind, ph: rnd() * 2 * PI, fq: 0.5 + rnd() * 0.5, a: 0, gone: false };
}

// Keep as many beads, pearls and capsules, as the knob asks for, and two
// bubbles for every three beads: new ones fade in, spare ones fade out, and
// the far ones are drawn first.
function census(P, n) {
  if (!P.beads.length) for (let i = 0; i < SPECKS; i++) P.beads.push(bead(P, 8, 2, P.beads, i, SPECKS));
  for (let kind = 0; kind < 2; kind++) {
    const want = kind ? Math.round((n * 2) / 3) : n, live = P.beads.filter((b) => !b.gone && (b.kind === kind || b.kind === kind + 3));
    if (live.length < want) for (let i = live.length; i < want; i++) P.beads.push(bead(P, n, kind, P.beads, (i * 7) % want, want));
    else for (let i = want; i < live.length; i++) live[i].gone = true;
  }
  P.beads.sort((a, b) => b.z - a.z);
}

function blur(a, b) {
  for (let y = 0; y < H; y++)
    for (let x = 0, p = y * W; x < W; x++, p++) b[p] = (a[x > 0 ? p - 1 : p] + 2 * a[p] + a[x < W - 1 ? p + 1 : p]) * 0.25;
  for (let y = 0; y < H; y++)
    for (let x = 0, p = y * W; x < W; x++, p++) a[p] = (b[y > 0 ? p - W : p] + 2 * b[p] + b[y < H - 1 ? p + W : p]) * 0.25;
}

function step(P, dt, sp, wob) {
  P.t += dt * sp * 0.5;
  // The modes ring like springs; a slow random push keeps them moving by as
  // much as Wobble asks.
  const md = P.md, dr = P.drive, k = sp * 0.5;
  for (let m = 0; m < MODES; m++) {
    const w = OMEGA[m] * k, ze = 0.07;
    dr[m] += (rnd() - 0.5) * dt * 6;
    dr[m] *= 1 - dt * 0.8;
    const f = dr[m] * (0.6 + 9 * wob) * w * w * 0.25;
    let x = md[m * 2], v = md[m * 2 + 1];
    v += (-w * w * x - 2 * ze * w * v + f) * dt;
    x += v * dt;
    md[m * 2] = x;
    md[m * 2 + 1] = v;
  }
  // Beads hang from the gel on springs of their own, softer than the gel, so
  // they lag behind its swing and then catch up; each drifts a little round
  // its rest point on its own.
  for (const b of P.beads) {
    b.a = b.gone ? max(0, b.a - dt * 1.5) : min(1, b.a + dt * 1.5);
    if (b.gone && b.a <= 0) P.dead = 1;
    const p = Math.round((b.hy + M) / GS) * GW + Math.round((b.hx + M) / GS);
    let ux = 0, uy = 0;
    for (let m = 0; m < MODES; m++) {
      ux += md[m * 2] * MX[m * GN + p];
      uy += md[m * 2] * MY[m * GN + p];
    }
    const par = 1.15 - 0.4 * b.z, dfx = 1.4 * sin(P.t * b.fq + b.ph), dfy = 1.8 * sin(P.t * b.fq * 0.71 + b.ph * 1.3);
    const tx = b.hx + ux * par + dfx, ty = b.hy + uy * par + dfy, w = 2.4 * k * (1.1 - 0.3 * b.z);
    b.vx += ((tx - b.x) * w * w - 2 * 0.12 * w * b.vx) * dt;
    b.vy += ((ty - b.y) * w * w - 2 * 0.12 * w * b.vy) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  if (P.dead) (P.beads = P.beads.filter((b) => !b.gone || b.a > 0)), (P.dead = 0);
}

// Light comes down through the gel's rippled surface and lands on the back
// wall. Each ray is bent by the surface's slope where it entered, by up to a
// few LEDs, and by the gel's wobble; where the rays crowd together the wall
// is bright, the caustic net.
function caustics(P, wob) {
  const { gx, gy, acc, wv, md } = P;
  // A jiggling gel ripples more: the bend grows with Wobble and with how
  // hard the modes are swinging.
  let e = 0;
  for (let m = 0; m < MODES; m++) e += abs(md[m * 2]);
  const amp = (1.1 + 0.8 * wob + 0.15 * min(6, e)) / sqrt(NWV / 3), t = P.t * 2, ph = P.ph, jig = 0.5 + 0.8 * wob + 0.12 * min(6, e);
  for (let w = 0; w < NWV; w++) ph[w] = wv[w * 8 + 3] - wv[w * 8 + 2] * t + jig * sin(wv[w * 8 + 6] * t + wv[w * 8 + 7]);
  const m0 = md[0] * 0.8, m1 = md[2] * 0.8, m2 = md[4] * 0.8, m3 = md[6] * 0.8;
  for (let j = 0, q = 0; j < GH; j++)
    for (let i = 0; i < GW; i++, q++) {
      const x = i * GS - M, y = j * GS - M;
      let sx = 0, sy = 0;
      for (let w = 0; w < NWV; w++) {
        const c = fcos(wv[w * 8] * x + wv[w * 8 + 1] * y + ph[w]);
        sx += wv[w * 8 + 4] * c;
        sy += wv[w * 8 + 5] * c;
      }
      // The back wall moves with the gel, so the whole net swings with it.
      gx[q] = sx * amp + m0 * MX[q] + m2 * MX[2 * GN + q] + m3 * MX[3 * GN + q];
      gy[q] = sy * amp + m1 * MY[GN + q] + m2 * MY[2 * GN + q];
    }
  acc.fill(0);
  const wgt = 1 / (SS * SS), inv = 1 / SS, gi = 1 / GS;
  for (let rj = 0; rj < RH; rj++) {
    const fy = rj * inv, uy = fy * gi, j0 = floor(uy), ty = uy - j0;
    for (let ri = 0; ri < RW; ri++) {
      const fx = ri * inv, ux = fx * gi, i0 = floor(ux), tx = ux - i0, q = j0 * GW + i0;
      const X = fx - M + (gx[q] * (1 - tx) + gx[q + 1] * tx) * (1 - ty) + (gx[q + GW] * (1 - tx) + gx[q + GW + 1] * tx) * ty;
      const Y = fy - M + (gy[q] * (1 - tx) + gy[q + 1] * tx) * (1 - ty) + (gy[q + GW] * (1 - tx) + gy[q + GW + 1] * tx) * ty;
      const ix = floor(X), iy = floor(Y);
      if (ix < -1 || ix >= W || iy < -1 || iy >= H) continue;
      const ax = X - ix, ay = Y - iy;
      if (iy >= 0) {
        if (ix >= 0) acc[iy * W + ix] += wgt * (1 - ax) * (1 - ay);
        if (ix < W - 1) acc[iy * W + ix + 1] += wgt * ax * (1 - ay);
      }
      if (iy < H - 1) {
        if (ix >= 0) acc[(iy + 1) * W + ix] += wgt * (1 - ax) * ay;
        if (ix < W - 1) acc[(iy + 1) * W + ix + 1] += wgt * ax * ay;
      }
    }
  }
  // Gel is not quite clear: the light softens on its way to the wall, and
  // each line of it gets a halo on the LEDs beside it.
  blur(acc, P.tmp);
  blur(acc, P.tmp);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 8, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.sp = cl(k[1], 0.2, 3);
  P.wob = cl(k[3], 0, 1);
  const n = cl(Math.round(k[2]), 8, 40);
  if (n !== P.want) (P.want = n), census(P, n);
  if (!P.ready) {
    // The first frame already shows the gel settled and swaying.
    for (const b of P.beads) b.a = 1;
    for (let i = 0; i < 90; i++) step(P, 1 / 30, P.sp, P.wob);
    P.ready = true;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    // A knock: the sway and the bounce get a hard kick, the others a little.
    const s = rnd() < 0.5 ? -1 : 1, w = P.sp * 0.5;
    P.md[1] += s * 10 * OMEGA[0] * w;
    P.md[3] += (rnd() - 0.5) * 8 * OMEGA[1] * w;
    P.md[5] += (rnd() - 0.5) * 4 * OMEGA[2] * w;
    P.md[7] += (rnd() - 0.5) * 3 * OMEGA[3] * w;
  }
  let t = d;
  while (t > 1e-6) {
    const h = min(t, 1 / 60);
    step(P, h, P.sp, P.wob);
    t -= h;
  }
}

export function draw(display, params) {
  const P = params.s;
  if (!P || !P.ready) return;
  caustics(P, P.wob);
  const { acc, bg, col } = P, hue = H0 + P.hue;
  // Gel light and deep, caustic light, pearl one side, pearl rim, pearl
  // other side, capsule body and its gathered light. Orange and yellow gel
  // darkened reads as brown and olive on LEDs, so around those hues the gel
  // is kept lighter, like honey.
  const hw = (hue - floor(hue) + 0.38) % 1, am = max(0, 1 - abs(hw - 0.5) / 0.11);
  hsv(hue, 0.72 - 0.12 * am, 0.62 + 0.3 * am, col, 0);
  hsv(hue + 0.02, 0.85 - 0.1 * am, 0.3 + 0.38 * am, col, 3);
  hsv(hue - 0.03, 0.35, 1, col, 6);
  hsv(hue + 0.12, 0.2, 1, col, 9);
  hsv(hue - 0.14, 0.6, 1, col, 12);
  hsv(hue - 0.1, 0.2, 1, col, 15);
  hsv(hue + 0.05, 0.95, 0.5, col, 18);
  hsv(hue + 0.02, 0.5, 1, col, 21);
  // The gel: light from above, so the top glows and the bottom is deeper,
  // and over it the net of caustic light.
  for (let y = 0; y < H; y++) {
    const g = 1 - (0.55 * y) / H;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, l = cl(acc[p] - 0.6, 0, 1.6) * 0.5;
      for (let q = 0; q < 3; q++) bg[p * 3 + q] = col[q] * g + col[3 + q] * (1 - g) + col[6 + q] * l * (0.55 + 0.45 * g);
    }
  }
  // Beads and bubbles, far ones first.
  for (const b of P.beads) drawBead(P, b);
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p++) display.setPixel(x, y, min(255, bg[p * 3]), min(255, bg[p * 3 + 1]), min(255, bg[p * 3 + 2]));
}

// Pearls are lit from above through the gel, their white leaning one way
// round the colour wheel on one side and the other way on the other, as a
// pearl's sheen shifts, with a rim and a white highlight. A capsule is clear and deeply tinted: light coming down through
// it gathers into a bright spot low inside it. An air bubble is clear, the
// gel behind it brighter, with a thin bright rim and a highlight; a speck is
// a point of light. Far ones sink into the gel's colour.
function drawBead(P, b) {
  // A bead swinging through the gel is drawn out a little along its path
  // and squeezed across it, so it jiggles as it swings and settles round.
  const ax = abs(b.vx), ay = abs(b.vy), qx = cl(1 + 0.02 * ax - 0.01 * ay, 0.82, 1.18), qy = cl(1 + 0.02 * ay - 0.01 * ax, 0.82, 1.18);
  const { bg, col, acc } = P, r = b.r, x1 = max(0, floor(b.x - r * qx - 1)), x2 = min(W - 1, floor(b.x + r * qx + 1));
  const y1 = max(0, floor(b.y - r * qy - 1)), y2 = min(H - 1, floor(b.y + r * qy + 1));
  const fog = 0.45 * b.z, cp = cl(floor(b.y), 0, H - 1) * W + cl(floor(b.x), 0, W - 1), glint = 0.85 + 0.35 * cl(acc[cp] - 0.6, 0, 1.5);
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++) {
      const dx = (x + 0.5 - b.x) / (r * qx), dy = (y + 0.5 - b.y) / (r * qy), d2 = dx * dx + dy * dy, d = sqrt(d2);
      const cov = cl((1 - d) * r + 0.5, 0, 1) * b.a;
      if (cov <= 0) continue;
      const nz = sqrt(max(0, 1 - d2)), p = (y * W + x) * 3, rim = pow(1 - nz, 2.2);
      let R, G, B;
      if (b.kind === 2) {
        const k = 0.9 * (1 - d);
        R = bg[p] + col[6] * k;
        G = bg[p + 1] + col[7] * k;
        B = bg[p + 2] + col[8] * k;
      } else if (b.kind === 1) {
        // Air in gel: clear in the middle, the light bent into a bright rim,
        // and a highlight up towards the light.
        const ring = sm((d - 0.6) / 0.25) * (1 - sm((d - 0.95) / 0.1)), hi = exp(-((dx + 0.35) ** 2 + (dy + 0.4) ** 2) * 22);
        const k = 0.15 + 0.85 * ring;
        R = bg[p] * 1.1 + col[6] * k * 0.85 + 255 * hi;
        G = bg[p + 1] * 1.1 + col[7] * k * 0.85 + 255 * hi;
        B = bg[p + 2] * 1.1 + col[8] * k * 0.85 + 255 * hi;
      } else {
        const hi = pow(max(0, -dx * 0.36 - dy * 0.5 + nz * 0.79), 40) * 255, edge = 1 - 0.3 * sm((d - 0.86) / 0.12);
        if (b.kind === 0) {
          const df = max(0, -dx * 0.3 - dy * 0.75 + nz * 0.6), lit = (0.72 + 0.4 * df) * glint * edge, u = cl(0.5 + 0.6 * (dx - dy) * 0.7, 0, 1);
          R = (col[9] + (col[15] - col[9]) * u) * lit + col[12] * rim * 0.75 + hi;
          G = (col[10] + (col[16] - col[10]) * u) * lit + col[13] * rim * 0.75 + hi;
          B = (col[11] + (col[17] - col[11]) * u) * lit + col[14] * rim * 0.75 + hi;
        } else {
          const core = exp(-(dx * dx + (dy - 0.42) ** 2) * 5) * glint, body = 0.55 * edge;
          R = col[18] * body + col[21] * core + col[21] * rim * 0.5 + hi;
          G = col[19] * body + col[22] * core + col[22] * rim * 0.5 + hi;
          B = col[20] * body + col[23] * core + col[23] * rim * 0.5 + hi;
        }
      }
      R += (bg[p] - R) * fog;
      G += (bg[p + 1] - G) * fog;
      B += (bg[p + 2] - B) * fog;
      bg[p] += (R - bg[p]) * cov;
      bg[p + 1] += (G - bg[p + 1]) * cov;
      bg[p + 2] += (B - bg[p + 2]) * cov;
    }
}
