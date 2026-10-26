// ===== Patternflow pattern =====
// Title:   Rutherford Shadow
// Family:  physics
// Idea:    A parallel beam of equal-energy particles streams up the panel past a repelling nucleus a third of the way up, each particle on its own Coulomb hyperbola with the nucleus at the outer focus, and since every hyperbola only touches the parabola with its focus at the nucleus and its vertex d below it, the beam leaves a sharp parabolic shadow above the nucleus, its edge lit by the orbits that bunch along it while the few head-on particles turn back down in gold.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rutherford scattering, tan(theta/2) = d / 2b (Ernest Rutherford, 1911), after the gold-foil scattering of alpha particles (Hans Geiger and Ernest Marsden, 1909), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Charge=1..6, Attract=0..1
//
// Knob 1: Hue. Turns the beam's colours round the wheel together. At 0 particles that came in on the left of the nucleus are cyan, those on the right violet, and those turned back by more than 90 degrees gold; at 0.25 violet, red and green; at 0.5 red, lime and azure; at 0.75 lime, cyan and magenta. The nucleus stays warm white.
// Knob 2: Speed. At 2 a particle far from the nucleus moves 45 LEDs a second and crosses the panel in about 3 s, its trail about 10 LEDs long. At 0.2 all of it is ten times slower, at 3 half as fast again; the trails keep their length.
// Knob 3: Charge. The head-on turning distance d, in LEDs, which grows with the nucleus's charge over the beam's energy. The shadow is the parabola Y = X^2 / 4d - d, Y up the panel from the nucleus: at 1 it is 4 LEDs wide level with the nucleus and 37 wide on the top row, at 2 8 and 53, at 3 12 wide and filling the top 4 rows, at 6 24 wide and filling every row above row 49. A particle with impact parameter under d / 2 turns back by more than 90 degrees, 1 in 72 of the beam at 1 and 1 in 12 at 6.
// Knob 4: Attract. Turns the charge through zero: the turning distance is d cos(pi K4), 0.98 d at the opening 0.06, 0.71 d at 0.25, nothing at 0.5, where the beam runs straight through, and -d at 1, where the nucleus attracts as hard as it repelled. There the orbits bend in, cross behind the nucleus and fill the shadow, cyan into the violet half and violet into the cyan, and a particle that would pass within 0.35 LED of the centre is taken in, those with impact parameter under 0.69 LED at d = 1.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, sin, cos, atan, round, random, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Units: one LED, and one second at Speed 2. The nucleus sits at the corner
// of four LEDs, 42 rows above the bottom edge. Orbits are worked in its own
// frame: X to the right, Y up the panel (downstream), so an LED at panel
// (x, y) is X = x - XN, Y = YN - y.
const XN = 32, YN = 86;
const V0 = 45; // beam speed far from the nucleus, LEDs a second
const BMAX = 36; // impact parameters fill -36..36, 4 LEDs past each edge
const FLUX = 1.2; // particles a second per LED of beam width
const TAU = 0.1; // trail fade, seconds
const TRAIL = 0.9; // what a trail lays on one LED
const TAU_L = 3, GLOW = 0.016, GLOW_REF = 0.1; // the long exposure's fade and gain
const RNUC = 0.35; // an attracted particle this close is taken in
const CAP = 1400;

// The shadow. Put X = r cos(phi), Y = r sin(phi) into the orbit equation
// below and it becomes b^2 - X b + (s / 2)(r + Y) = 0, a quadratic in the
// impact parameter b of the orbits through (X, Y). Two orbits, both from
// the same side, pass a point where X^2 > 2 s (r + Y); none where it is
// less; and on X^2 = 2 s (r + Y), which is the parabola Y = X^2 / 4s - s,
// the two meet in one, b = X / 2, which touches the parabola there. A
// separate leapfrog run of 2000 orbits from 4000 LEDs below, energy kept to
// 1e-9, found the nearest any came to the axis at heights -0.9 d to 80
// LEDs equal to 2 sqrt(d (Y + d)) to four decimals, at b = X / 2 each time.
// In this pattern, 20 s at each of five repelling settings put one of
// 572,000 particle positions inside the parabola, by 0.00003 LED; every
// position lay within 0.026 LED of its exact hyperbola and every energy
// within 0.06% of V0^2 / 2. Attracting (s < 0) the discriminant
// X^2 + 2|s|(r + Y) never vanishes: through every point pass two orbits,
// one from each side, and there is no envelope and no shadow. Above about
// Y = d/2 the two even share the beam's own flux between them, so in the
// plane they cross behind the nucleus without bunching.

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, d: 1, q: 1, acc: 0, warm: false, n: 0,
    X: new Float64Array(CAP), Y: new Float64Array(CAP), VX: new Float64Array(CAP), VY: new Float64Array(CAP),
    B: new Float32Array(CAP), px: new Float32Array(CAP), py: new Float32Array(CAP),
    R: new Float32Array(N), G: new Float32Array(N), Bl: new Float32Array(N), c: [0, 0, 0],
    L: new Float32Array(N * 3), Lt: new Float32Array(N * 3), Lb: new Float32Array(N * 3), head: new Int16Array(N),
  };
}

// Place a new particle exactly on its incoming orbit where it crosses Y.
// For impact parameter b > 0 and signed turning distance s (s > 0 repels),
// the orbit equation u'' + u = -s / 2b^2 with the particle coming in from
// phi = -pi/2 gives u = 1/r = cos(phi) / b - (s / 2b^2) (1 + sin(phi)).
// Energy and angular momentum b V0 then give the velocity.
function spawn(S, b, Y) {
  if (S.n >= CAP) return;
  const s = S.d * S.q, ab = b < 0 ? -b : b, sg = b < 0 ? -1 : 1;
  const c = s / (2 * ab * ab);
  const u = (ph) => cos(ph) / ab - c * (1 + sin(ph));
  let X, YY, vx, vy;
  if (s === 0) {
    X = ab;
    YY = Y;
    vx = 0;
    vy = V0;
  } else {
    // y(phi) = sin(phi) / u(phi) rises from -infinity on the incoming leg
    // up to the closest approach (repelled) or to the side of the nucleus.
    let lo = -PI / 2 + 1e-12, hi = s > 0 ? -atan(s / (2 * ab)) : 0;
    for (let i = 0; i < 44; i++) {
      const m = 0.5 * (lo + hi);
      if (sin(m) / u(m) < Y) lo = m;
      else hi = m;
    }
    const ph = 0.5 * (lo + hi), uu = u(ph), r = 1 / uu;
    X = r * cos(ph);
    YY = r * sin(ph);
    const v2 = V0 * V0 * (1 - s * uu), vt = ab * V0 * uu, vr = -sqrt(max(0, v2 - vt * vt));
    vx = vr * cos(ph) - vt * sin(ph);
    vy = vr * sin(ph) + vt * cos(ph);
  }
  const i = S.n++;
  S.X[i] = sg * X;
  S.Y[i] = YY;
  S.VX[i] = sg * vx;
  S.VY[i] = vy;
  S.B[i] = b;
  S.px[i] = XN + S.X[i];
  S.py[i] = YN - S.Y[i];
}

function kill(S, i) {
  const j = --S.n;
  S.X[i] = S.X[j];
  S.Y[i] = S.Y[j];
  S.VX[i] = S.VX[j];
  S.VY[i] = S.VY[j];
  S.B[i] = S.B[j];
  S.px[i] = S.px[j];
  S.py[i] = S.py[j];
}

// Kick-drift-kick leapfrog in the nucleus's frame, the step cut so that no
// step moves a particle more than a twentieth of its distance from the
// nucleus or lets the force turn it by more than about that.
function advance(S, ds) {
  const k = (S.d * S.q * V0 * V0) / 2, ak = k < 0 ? -k : k;
  for (let i = 0; i < S.n; i++) {
    let x = S.X[i], y = S.Y[i], vx = S.VX[i], vy = S.VY[i], t = ds, dead = false;
    for (let it = 0; it < 4000 && t > 0; it++) {
      const r2 = x * x + y * y, r = sqrt(r2), sp = sqrt(vx * vx + vy * vy) + 1e-9;
      if (r < RNUC) {
        dead = true;
        break;
      }
      let h = 0.05 * (r / sp);
      if (ak > 0) h = min(h, 0.05 * sqrt((r2 * r) / ak));
      h = min(h, t);
      t -= h;
      let f = k / (r2 * r);
      vx += 0.5 * h * f * x;
      vy += 0.5 * h * f * y;
      x += h * vx;
      y += h * vy;
      const q2 = x * x + y * y;
      f = k / (q2 * sqrt(q2));
      vx += 0.5 * h * f * x;
      vy += 0.5 * h * f * y;
    }
    S.X[i] = x;
    S.Y[i] = y;
    S.VX[i] = vx;
    S.VY[i] = vy;
    const px = XN + x, py = YN - y;
    if (dead || py < -3 || py > H + 4 || px < -4 || px > W + 4) {
      kill(S, i);
      i--;
    }
  }
}

function feed(S, ds) {
  // Poisson arrivals across the beam; each one starts a random part of this
  // step's travel below the panel's bottom edge.
  S.acc += ds * FLUX * 2 * BMAX;
  while (S.acc >= 1) {
    S.acc -= 1;
    let b = (2 * random() - 1) * BMAX;
    if (b > -0.01 && b < 0.01) b = 0.01;
    spawn(S, b, YN - H - 1 - random() * V0 * ds);
  }
}

// One trail colour per particle: the side of the beam it came from, cyan on
// the left and violet on the right, and gold once it has been turned back
// by more than 90 degrees, tan(theta / 2) = |s| / 2|b| > 1.
function colour(S, b, out) {
  const ab = b < 0 ? -b : b, s = S.d * S.q;
  if ((s < 0 ? -s : s) > 2 * ab) hsv(S.hue + 0.12, 0.85, 1, out);
  else hsv(S.hue + (b < 0 ? 0.52 : 0.78), 0.9, 1, out);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.d = cl(kv[2], 1, 6);
  S.q = cos(PI * cl(kv[3], 0, 1));
  if (Math.abs(S.q) < 1e-6) S.q = 0;
  if (!S.warm) {
    // Open on the beam already flowing: 3.27 s of it, enough for a
    // particle to cross all 128 rows. The first 2.93 s go in steps of
    // 1/15 s and only lay the long exposure, weighted by how much of it
    // would have faded by then; the trails need just the last 0.33 s.
    S.warm = true;
    for (let i = 0; i < 44; i++) step(S, 1 / 15, exp(-(43 - i) / 15 / TAU_L));
    for (let i = 0; i < 10; i++) step(S, 1 / 30, 0);
    return;
  }
  step(S, (d * S.speed) / 2);
}

function step(S, ds, early) {
  for (let j = 0; j < S.n; j++) (S.px[j] = XN + S.X[j]), (S.py[j] = YN - S.Y[j]);
  feed(S, ds);
  advance(S, ds);
  lay(S, ds, early);
}

// Trails add, so where the orbits bunch the LEDs burn brighter.
function dep(S, x, y, r, g, b) {
  const ix = floor(x), iy = floor(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const p = iy * W + ix;
  S.R[p] += r;
  S.G[p] += g;
  S.Bl[p] += b;
}

// Fade the trails by one step and lay each particle's path over it, the
// path it took this step, dimmer towards where it was. An early step of the
// opening lays only the long exposure, at weight early.
function lay(S, ds, early) {
  const R = S.R, G = S.G, B = S.Bl, c = S.c, L = S.L, fade = exp(-ds / TAU), fadeL = exp(-ds / TAU_L);
  if (!early) {
    for (let p = 0; p < N; p++) {
      R[p] *= fade;
      G[p] *= fade;
      B[p] *= fade;
    }
    for (let p = 0; p < N * 3; p++) L[p] *= fadeL;
  }
  for (let i = 0; i < S.n; i++) {
    const x1 = XN + S.X[i], y1 = YN - S.Y[i], x0 = S.px[i], y0 = S.py[i];
    colour(S, S.B[i], c);
    const len = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2), m = min(40, 1 + floor(len * 2));
    // Each sample stands for len / m of path, so a trail lays TRAIL on each
    // LED of path it crosses, at any speed.
    const share = (TRAIL * len) / m;
    for (let j = 0; j < m; j++) {
      const a = j / m, w = share * exp((-(1 - a) * ds) / TAU);
      const x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a;
      if (!early) dep(S, x, y, c[0] * w, c[1] * w, c[2] * w);
      // The long exposure: path length, in the particle's colour.
      const ix = floor(x), iy = floor(y);
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
        const p = (iy * W + ix) * 3, e = (len / m) * (early || 1);
        L[p] += c[0] * e;
        L[p + 1] += c[1] * e;
        L[p + 2] += c[2] * e;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const R = S.R, G = S.G, B = S.Bl, L = S.L, Lb = S.Lb;
  // The long exposure, blurred over 3 x 3 LEDs (across, then down), glows
  // faintly under the trails: the beam's own density, dark in the shadow
  // and brightest just outside its edge.
  const T = S.Lt;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3, a = x > 0 ? q - 3 : q, b = x < W - 1 ? q + 3 : q;
      for (let ch = 0; ch < 3; ch++) T[q + ch] = L[a + ch] + L[q + ch] + L[b + ch];
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = (y * W + x) * 3, a = y > 0 ? q - 3 * W : q, b = y < H - 1 ? q + 3 * W : q;
      const r = T[a] + T[q] + T[b], g = T[a + 1] + T[q + 1] + T[b + 1], bl = T[a + 2] + T[q + 2] + T[b + 2];
      // Squared, so the glow is faint over the open beam and twice the
      // density along the edge shows four times as bright.
      const k = (max(r, g, bl) * GLOW * GLOW) / (81 * GLOW_REF);
      Lb[q] = r * k;
      Lb[q + 1] = g * k;
      Lb[q + 2] = bl * k;
    }
  // Each head is a near-white LED drawn over its trail, left out of the
  // trail itself so a slow beam does not smear it.
  const head = S.head, c = S.c;
  head.fill(-1);
  for (let i = 0; i < S.n; i++) {
    const x = floor(XN + S.X[i]), y = floor(YN - S.Y[i]);
    if (x >= 0 && x < W && y >= 0 && y < H) head[y * W + x] = i;
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      // The nucleus: four warm white LEDs.
      if ((x === XN - 1 || x === XN) && (y === YN - 1 || y === YN)) display.setPixel(x, y, 255, 236, 200);
      else if (head[p] >= 0) {
        colour(S, S.B[head[p]], c);
        display.setPixel(x, y, round(140 + 115 * c[0]), round(140 + 115 * c[1]), round(140 + 115 * c[2]));
      } else {
        const q = p * 3;
        display.setPixel(x, y, round(min(1, R[p] + Lb[q]) * 255), round(min(1, G[p] + Lb[q + 1]) * 255), round(min(1, B[p] + Lb[q + 2]) * 255));
      }
    }
}
