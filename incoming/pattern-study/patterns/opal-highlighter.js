// ===== Patternflow pattern =====
// Title:   Opal Highlighter
// Family:  cosmetic
// Idea:    A shimmer highlighter seen up close as a mosaic of opal grains, each a small crystal of stacked silica spheres that sends one colour to the eye by Bragg's law, so as an unseen lamp wanders and the skin beneath slowly shifts, grain after grain flashes pink, gold, lilac or sky blue over a milky pearl, with a white glint where it faces the light exactly, while the mosaic drifts and recrystallises.
// Author:  patternflow-lab
// Date:    2026-11-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Bragg's law of crystal reflection (W. H. Bragg and W. L. Bragg, 1913); the play of colour of precious opal as Bragg diffraction from ordered silica spheres (J. V. Sanders, 1964)
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.2..3, Grain=-1..1, Play=-1..1
//
// Knob 1: Hue. Turns the flashes and the pearl round the wheel together; at 0 the flashes centre on rose pink and run to sky blue one way and gold the other, over a pale pink pearl.
// Knob 2: Drift. How fast the model runs: 0.28 model seconds a second at 0.2, 1 at the opening 2 and 1.4 at 3. The lamp's slowest wave takes about 200 model seconds, the skin's sway 11 to 31, a grain's jiggle 0.8.
// Knob 3: Grain. The size of the opal grains: about 4 LEDs at -1, a fine pinfire sparkle; 7 at the opening; 12 at 1, broad patches that light in part and roll their flash across.
// Knob 4: Play. How far round the wheel the visible band is spread: a sixth at -1, a pastel duochrome with soft, wide flashes and more body colour between them; half at the opening; nine tenths at 1, the full rainbow with sharp flashes on a whiter pearl.

// What the highlighter is. Up close the coat is a mosaic of grains, each a colloidal crystal of silica spheres stacked
// in planes D apart, D between 140 and 280 nm. A grain's planes act as a mirror that only returns one wavelength:
// light from direction L reaches the eye at V when the planes' normal n lies along the half-vector L + V, and then
//   lambda = n_eff D (L + V).n,   n_eff = 1.36,
// which is 2 n_eff D, 380 to 760 nm, when lamp and eye stand straight over the grain, and shorter as they part. The
// reflection falls off as a Gaussian in the sine of the angle between n and the half-vector, about 0.12 rad wide,
// plus a faint wide halo; outside 400 to 700 nm the grain sends nothing the eye sees and stays milky.
// Each grain's normal is the sum of five things: the skin's sway (two sums of five sines, 0.07 rad), the skin's relief
// (16 long waves, 22 to 64 LEDs, each drifting at its own rate with an amplitude that wanders, 0.22 rad), the grain's
// own tilt (a random walk that forgets in 30 model seconds, 0.15 rad), a jiggle (forgets in 0.8 s, 0.05 rad), and a
// bend across the grain (0.012 rad an LED), so a flash lights part of a grain and rolls across it.
// The grains are the cells of their centres, read through a slow warp so the edges are not straight. The centres are
// stirred by six travelling waves of a stream function on the torus, pushed apart to about 0.9 of the grain size and
// nudged at random. Each grain recrystallises about every 45 model seconds: it takes a new D and grows into it over 4 s.
// The lamp hangs about 200 LEDs above the panel and wanders over its middle. The binder between the grains takes a broad
// sheen from it, on the skin with 0.6 of the relief, so the glow moves in soft bands rather than lines.
// The colour: the visible band runs along a table of hues, its width set by Play, its centre by Hue. A lit grain takes
// the table's colour over the pearl, and above 0.8 of its peak it runs to white.
// What was measured, 240 s at 30 fps with a frame kept every half second, at the opening, all knobs at their minimum,
// all at their maximum and two other positions: recur 0.530 to 0.616, the darkest 16 by 16 cell 0.945 to 0.968 of the
// mean, the least-changing cell 0.728 to 0.852, over the last quarter 0.883 to 0.953 and 0.548 to 0.804. For 900 s at
// the opening recur is 0.521 and the mean level is 208 in the first quarter and in the last. The broad sheen is what
// pulls recur down, because it follows a lamp and a sway with few degrees of freedom: over 120 s the opening read 0.697
// with no sheen, 0.517 with a stronger sheen that saw 0.35 of the relief, and 0.634 as it is. The first version, a
// lamp 80 LEDs up and no relief, read 0.119.

const W = 64, H = 128;
const { floor, sin, cos, exp, sqrt, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = () => sqrt(-2 * Math.log(Math.random() + 1e-12)) * cos(TAU * Math.random());

const NMAX = 700; // seed pool; the Grain knob decides how many are in play
const NEFF = 1.36; // effective refractive index of silica spheres packed in a binder
const DMIN = 140, DMAX = 280; // plane spacings in nm: 380 to 760 nm straight on, spheres of 170 to 340 nm
const VIEW = 260; // the eye, LEDs above the middle of the panel
const TOWN = 0.15, BEND = 0.012, JIG = 0.05; // a grain's own tilt (rad), its bend (rad per LED) and its jiggle
const STIR = 5; // stream function amplitude of the stirring, LED^2 per model second
const NREL = 16, TREL = 0.22, RS = 4, RX = 17, RY = 33; // the relief: waves, rms slope, coarse grid spacing and size

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A slow signal: a sum of sines with random rates in [lo, hi], no two sharing a ratio.
function wave(n, lo, hi) {
  const w = new Float64Array(n), p = new Float64Array(n), a = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    w[i] = lo + (hi - lo) * Math.random();
    p[i] = TAU * Math.random();
    a[i] = 0.5 + Math.random();
    s += a[i] * a[i];
  }
  const g = sqrt(2 / s);
  for (let i = 0; i < n; i++) a[i] *= g;
  return { w, p, a };
}
const at = (q, t) => {
  let v = 0;
  for (let i = 0; i < q.w.length; i++) v += q.a[i] * sin(q.w[i] * t + q.p[i]);
  return v;
};

function setup(params) {
  const f = () => new Float64Array(NMAX);
  const S = {
    t: 0, px: f(), py: f(), tx: f(), ty: f(), fx: f(), fy: f(), d: f(), dT: f(), ba: f(), bb: f(), bc: f(),
    vx: f(), vy: f(), head: new Int32Array(4096), next: new Int32Array(NMAX), gw: 1, gh: 1, n: 0,
    lampX: wave(4, 0.035, 0.09), lampY: wave(4, 0.03, 0.08), lampZ: wave(3, 0.04, 0.1),
    swayX: wave(5, 0.2, 0.55), swayY: wave(5, 0.2, 0.55),
    flow: [], warp: [], relief: [], rx: new Float32Array(RX * RY), ry: new Float32Array(RX * RY),
    warm: false, hue: 0, drift: 2, grain: 0, play: 0.06, base: new Float32Array(3), lut: new Float32Array(768), wpx: new Float32Array(H), wpy: new Float32Array(W),
  };
  for (let i = 0; i < NMAX; i++) {
    S.px[i] = W * Math.random();
    S.py[i] = H * Math.random();
    S.tx[i] = TOWN * gauss();
    S.ty[i] = TOWN * gauss();
    S.dT[i] = S.d[i] = Math.random();
    S.ba[i] = BEND * gauss();
    S.bb[i] = BEND * gauss();
    S.bc[i] = BEND * gauss();
  }
  // The slow stirring of the grains: a stream function of travelling waves that fit the torus.
  for (let j = 0; j < 6; j++) {
    const m = 1 + floor(3 * Math.random()), nn = 1 + floor(4 * Math.random());
    S.flow.push({ kx: (TAU * m * (Math.random() < 0.5 ? -1 : 1)) / W, ky: (TAU * nn) / H, w: (0.02 + 0.05 * Math.random()) * (Math.random() < 0.5 ? -1 : 1), p: TAU * Math.random(), a: STIR * (0.5 + Math.random()) });
  }
  // The warp that bends grain edges away from straight Voronoi lines.
  for (let j = 0; j < 3; j++) S.warp.push({ fx: 0.15 + 0.2 * Math.random(), fy: 0.1 + 0.15 * Math.random(), w1: 0.03 + 0.05 * Math.random(), w2: 0.03 + 0.05 * Math.random(), p1: TAU * Math.random(), p2: TAU * Math.random() });
  // The skin under the coat: a height field of NREL long waves whose slopes tilt every grain on them.
  // Each wave drifts at its own rate and its amplitude wanders, so the relief never comes back.
  for (let j = 0; j < NREL; j++) {
    const a = TAU * Math.random(), lam = 22 + 42 * Math.random();
    S.relief.push({ cx: cos(a), cy: sin(a), k: TAU / lam, p: TAU * Math.random(), w: (0.04 + 0.12 * Math.random()) * (Math.random() < 0.5 ? -1 : 1), a: gauss() });
  }
  params.s = S;
  return S;
}

function buildGrid(S, s) {
  const gw = max(1, floor(W / s)), gh = max(1, floor(H / s)), head = S.head;
  S.gw = gw;
  S.gh = gh;
  head.fill(-1, 0, gw * gh);
  for (let i = 0; i < S.n; i++) {
    const c = min(gh - 1, floor((S.py[i] / H) * gh)) * gw + min(gw - 1, floor((S.px[i] / W) * gw));
    S.next[i] = head[c];
    head[c] = i;
  }
}

const grainSize = (S) => 7 * Math.pow(1.75, S.grain);
const wrapD = (d, L) => (d > L / 2 ? d - L : d < -L / 2 ? d + L : d);

// Move the grain centres by h model seconds: the stirring (when stir is on), a soft push that
// keeps neighbours about 0.9 s apart, and a little Brownian wander.
function move(S, s, h, stir) {
  buildGrid(S, s);
  const { px, py, vx, vy, head, next, gw, gh } = S, r0 = 0.9 * s, t = S.t;
  for (let i = 0; i < S.n; i++) {
    let u = 0, v = 0;
    if (stir)
      for (const m of S.flow) {
        const c = m.a * cos(m.kx * px[i] + m.ky * py[i] + m.w * t + m.p);
        u += c * m.ky;
        v -= c * m.kx;
      }
    const cx = min(gw - 1, floor((px[i] / W) * gw)), cy = min(gh - 1, floor((py[i] / H) * gh));
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        if ((gw < 3 && ox === 1) || (gh < 3 && oy === 1)) continue;
        for (let j = head[((cy + oy + gh) % gh) * gw + ((cx + ox + gw) % gw)]; j >= 0; j = next[j]) {
          if (j === i) continue;
          const ddx = wrapD(px[i] - px[j], W), ddy = wrapD(py[i] - py[j], H), d2 = ddx * ddx + ddy * ddy;
          if (d2 < r0 * r0 && d2 > 1e-6) {
            const d = sqrt(d2), f = (0.6 * (r0 - d)) / d;
            u += f * ddx;
            v += f * ddy;
          }
        }
      }
    vx[i] = u;
    vy[i] = v;
  }
  const jit = stir ? 0.15 * sqrt(h) : 0;
  for (let i = 0; i < S.n; i++) {
    px[i] = (px[i] + h * vx[i] + jit * gauss() + 2 * W) % W;
    py[i] = (py[i] + h * vy[i] + jit * gauss() + 2 * H) % H;
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.drift = cl(k[1], 0.2, 3);
  S.grain = cl(k[2], -1, 1);
  S.play = cl(k[3], -1, 1);
  const s = grainSize(S);
  S.n = min(NMAX, Math.round((W * H) / (s * s)));
  // The first frame lets the scattered centres push apart into an even mosaic before anything is drawn.
  if (!S.warm) {
    S.warm = true;
    for (let i = 0; i < 40; i++) move(S, s, 0.5, false);
  }
  const h = cl(dt || 0, 0, 0.1) * (0.2 + 0.4 * S.drift);
  S.t += h;
  move(S, s, h, true);
  buildGrid(S, s);
  // Each grain's own tilt wanders slowly (30 model seconds to forget), its jiggle quickly (0.8 s),
  // and now and then it recrystallises with a new plane spacing that it grows into over 4 s.
  const slow = exp(-h / 30), fast = exp(-h / 0.8), ns = sqrt(1 - slow * slow), nf = sqrt(1 - fast * fast), grow = 1 - exp(-h / 4);
  for (let i = 0; i < S.n; i++) {
    S.tx[i] = S.tx[i] * slow + TOWN * ns * gauss();
    S.ty[i] = S.ty[i] * slow + TOWN * ns * gauss();
    S.fx[i] = S.fx[i] * fast + JIG * nf * gauss();
    S.fy[i] = S.fy[i] * fast + JIG * nf * gauss();
    if (Math.random() < h / 45) S.dT[i] = Math.random();
    S.d[i] += (S.dT[i] - S.d[i]) * grow;
  }
  // The relief: drift each wave, let its amplitude wander, and lay its slope on a coarse grid.
  const ra = exp(-h / 25), rn = sqrt(1 - ra * ra);
  let sa = 0;
  for (const m of S.relief) {
    m.p += m.w * h;
    m.a = m.a * ra + rn * gauss();
    sa += m.a * m.a;
  }
  const g = TREL / sqrt(0.5 * max(sa, 1e-6));
  for (let j = 0; j < RY; j++)
    for (let i = 0; i < RX; i++) {
      const X = i * RS, Y = j * RS;
      let ux = 0, uy = 0;
      for (const m of S.relief) {
        const c = m.a * cos(m.k * (m.cx * X + m.cy * Y) + m.p);
        ux += c * m.cx;
        uy += c * m.cy;
      }
      S.rx[j * RX + i] = ux * g;
      S.ry[j * RX + i] = uy * g;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const t = S.t, s = grainSize(S);
  const { px, py, head, next, gw, gh, base, rx, ry } = S;
  // The lamp, LEDs from the panel's top-left corner, and the sway of the surface under it.
  const lx = 32 + 30 * at(S.lampX, t), ly = 64 + 40 * at(S.lampY, t), lz = 200 + 30 * at(S.lampZ, t);
  const gx = 0.07 * at(S.swayX, t), gy = 0.07 * at(S.swayY, t);
  const play = (S.play + 1) / 2;
  const span = 0.16 + 0.74 * play; // how far round the wheel the visible spectrum is spread
  const sig = (0.09 + 0.06 * (1 - play)) * Math.pow(s / 7, -0.15); // angular width of a grain's Bragg peak
  const sig2 = sig * sig, peak = 0.85 + 0.15 * play;
  const centre = 0.88 + S.hue;
  hsv(centre + 0.07, 0.05, 0.7, base, 0);
  // The warp: a row's centres shift sideways by a function of the row, a column's up and down by one of the column.
  const { wpx, wpy, lut } = S, ws = 0.16 * s;
  for (let y = 0; y < H; y++) {
    let v = 0;
    for (const q of S.warp) v += sin(q.fx * (y + 0.5) * (7 / s) + q.w1 * t + q.p1);
    wpx[y] = ws * v;
  }
  for (let x = 0; x < W; x++) {
    let v = 0;
    for (const q of S.warp) v += sin(q.fy * (x + 0.5) * (7 / s) + q.w2 * t + q.p2);
    wpy[x] = ws * v;
  }
  // The flash colours along the visible band, 400 to 700 nm, as a table of 256.
  for (let i = 0; i < 256; i++) hsv(centre + span * (0.5 - i / 255), 0.55, 1, lut, i * 3);
  for (let y = 0; y < H; y++) {
    const Y = y + 0.5, fyr = Y / RS, jy = min(RY - 2, floor(fyr)), vy0 = fyr - jy;
    for (let x = 0; x < W; x++) {
      const X = x + 0.5;
      const wx = (X + wpx[y] + 2 * W) % W, wy = (Y + wpy[x] + 2 * H) % H;
      const cx = min(gw - 1, floor((wx / W) * gw)), cy = min(gh - 1, floor((wy / H) * gh));
      let best = -1, bd = 1e9, bx = 0, by = 0;
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          if ((gw < 3 && ox === 1) || (gh < 3 && oy === 1)) continue;
          let j = head[((cy + oy + gh) % gh) * gw + ((cx + ox + gw) % gw)];
          while (j >= 0) {
            const ddx = wrapD(wx - px[j], W), ddy = wrapD(wy - py[j], H), d2 = ddx * ddx + ddy * ddy;
            if (d2 < bd) (bd = d2), (best = j), (bx = ddx), (by = ddy);
            j = next[j];
          }
        }
      // The surface: the relief under this LED plus the sway of the whole cheek.
      const fxr = X / RS, ix = min(RX - 2, floor(fxr)), u0 = fxr - ix, q0 = jy * RX + ix;
      const sx = gx + (rx[q0] * (1 - u0) + rx[q0 + 1] * u0) * (1 - vy0) + (rx[q0 + RX] * (1 - u0) + rx[q0 + RX + 1] * u0) * vy0;
      const sy = gy + (ry[q0] * (1 - u0) + ry[q0 + 1] * u0) * (1 - vy0) + (ry[q0 + RX] * (1 - u0) + ry[q0 + RX + 1] * u0) * vy0;
      // The grain's lattice normal: the surface, the grain's own tilt, a slight bend across it, its jiggle.
      let tx = sx, ty = sy, d = 0.5;
      if (best >= 0) {
        tx += S.tx[best] + S.fx[best] + S.ba[best] * bx + S.bb[best] * by;
        ty += S.ty[best] + S.fy[best] + S.bb[best] * bx + S.bc[best] * by;
        d = S.d[best];
      }
      const nl = 1 / sqrt(tx * tx + ty * ty + 1);
      // Light and eye directions from this LED.
      let Lx = lx - X, Ly = ly - Y, Lz = lz;
      let ll = 1 / sqrt(Lx * Lx + Ly * Ly + Lz * Lz);
      Lx *= ll;
      Ly *= ll;
      Lz *= ll;
      let Vx = 32 - X, Vy = 64 - Y, Vz = VIEW;
      ll = 1 / sqrt(Vx * Vx + Vy * Vy + Vz * Vz);
      Vx *= ll;
      Vy *= ll;
      Vz *= ll;
      const ax = Lx + Vx, ay = Ly + Vy, az = Lz + Vz, a2 = ax * ax + ay * ay + az * az;
      const an = (ax * tx + ay * ty + az) * nl;
      // Bragg: planes D apart send lambda = n_eff D (L + V).n to the eye; straight over them that is 2 n_eff D.
      const lamb = NEFF * (DMIN + (DMAX - DMIN) * d) * an;
      const off = max(0, 1 - (an * an) / a2); // sin^2 of the angle between the planes' normal and the half-vector
      const vis = sm(380, 420, lamb) * (1 - sm(680, 730, lamb));
      const core = exp(-off / sig2), I = peak * vis * (core + 0.06 * exp(-off / (9 * sig2)));
      // Where the planes face the half-vector almost exactly the flash runs to white.
      const hot = 0.4 * vis * sm(0.8, 1, core);
      const li = 3 * ((cl((lamb - 400) / 300, 0, 1) * 255 + 0.5) | 0), cr = lut[li], cg = lut[li + 1], cb = lut[li + 2];
      // The binder's sheen from the same lamp, on the surface without the grains' own tilt.
      // It sees the relief only in part, so it stays a broad glow and does not draw lines.
      const ex = gx + 0.6 * (sx - gx), ey = gy + 0.6 * (sy - gy), sl = 1 / sqrt(ex * ex + ey * ey + 1);
      const hn = (ax * ex + ay * ey + az) * sl, sh = 0.15 * exp(-max(0, 1 - (hn * hn) / a2) / 0.08);
      const diff = 0.88 + 0.12 * (Lx * ex + Ly * ey + Lz) * sl;
      // Between flashes the grain keeps a faint body colour of its own: the milky opalescence.
      const keep = 1 - 0.75 * min(1, I), body = (0.09 - 0.08 * play) * vis;
      const br = base[0] * (1 - body) + cr * body, bg = base[1] * (1 - body) + cg * body, bb = base[2] * (1 - body) + cb * body;
      const r = (br * diff + sh) * keep + I * cr + hot, g = (bg * diff + sh) * keep + I * cg + hot, b = (bb * diff + sh) * keep + I * cb + hot;
      display.setPixel(x, y, min(255, r * 255), min(255, g * 255), min(255, b * 255));
    }
  }
}
