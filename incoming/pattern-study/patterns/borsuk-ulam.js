// ===== Patternflow pattern =====
// Title:   Borsuk-Ulam
// Family:  topology
// Idea:    A turning globe carries a slowly changing temperature and pressure, the top disk showing the side that faces you and the bottom disk the far side laid so that each point sits where its antipode sits above, and the white line where the temperature equals the temperature at the antipode crosses the magenta line where the pressure does at an odd number of gold points, the same in both disks, where two opposite places on the Earth have the same weather.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Borsuk-Ulam theorem (Karol Borsuk, 1933, after a question of Stanisław Ulam)
// Round:   39
// ===============================
// @matrix 64x128
// @knobs Degree=3..6, Speed=0.2..3, Weather=0..1, Hue=0..1
//
// Knob 1: Degree. The highest degree of the random spherical harmonics in both fields, the next degree fading in between whole numbers. The two curves hang only on the odd degrees, so at 3 they are cubic curves and meet at 1 to 9 pairs, 2.8 on average: one pair 36% of the time, three 42%, five 19%, seven 3%. 4 adds a finer even layer to the colours and the isobars and leaves the curves cubic; at 5 and 6 the curves are quintic, wind into loops and meet at up to 25 pairs, about 5 on average.
// Knob 2: Speed. How fast the globe turns: at 2 once in 20 seconds round an axis leaning 24 degrees toward you, at 0.2 once in 200 seconds, at 3 once in 13. The curves and the pairs turn with it; a pair that slips over the rim comes back at once on the opposite rim, where its other point is rising.
// Knob 3: Weather. How fast the temperature and the pressure change. At 0 each coefficient swings once in 56 to 168 seconds, the curves creep and a pair of pairs is born or dies about 12 times a minute at Degree 3; at 1 eight times faster, 7 to 21 seconds, about 74 times a minute. Pairs come and go two at a time, where the curves touch, so the count stays odd.
// Knob 4: Hue. Turns the palette: at the start azure for cold and orange for warm with a magenta pressure curve; at 0.25 violet and green with red; at 0.5 red and cyan with green; at 0.75 green and violet with cyan. The temperature curve stays white and the pairs gold. Where cold or warm lands on orange or yellow the pale bands are lifted toward full brightness, so they never go brown or olive.

// Each disk sits in a 64 x 64 square, the near side above the far side.
const S2 = 64;
const { floor, min, abs, sqrt, sin, cos, round, random, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The disks: radius RAD about the centre of each 64 x 64 square.
const RAD = 31, CX = 32, CY = 32;
// Each field is a sum over AX zonal harmonics sqrt(2l+1) P_l(u . x) for every
// degree l up to LMAX, each axis u wandering on a great circle.
const AX = 5, LMAX = 6;
// The globe turns round an axis leaning TILT toward you.
const TILT = 0.42;
// Grid seeds for Newton's method each frame, over one hemisphere.
const SEEDS = 72;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

function unit() {
  for (;;) {
    const x = 2 * random() - 1, y = 2 * random() - 1, z = 2 * random() - 1, r = x * x + y * y + z * z;
    if (r > 0.01 && r < 1) {
      const k = 1 / sqrt(r);
      return [x * k, y * k, z * k];
    }
  }
}

// One field: per axis a great circle (two orthonormal vectors and a speed)
// and per degree a coefficient swinging with its own speed and phase.
function field() {
  const F = { e: [], w: [], amp: [], om: [], ph: [], u: new Float64Array(3 * AX), c: new Float64Array(AX * (LMAX + 1)) };
  for (let j = 0; j < AX; j++) {
    const a = unit(), b0 = unit();
    const d = a[0] * b0[0] + a[1] * b0[1] + a[2] * b0[2];
    const b = [b0[0] - d * a[0], b0[1] - d * a[1], b0[2] - d * a[2]], bl = Math.hypot(b[0], b[1], b[2]);
    F.e.push([a, [b[0] / bl, b[1] / bl, b[2] / bl], random() * TAU]);
    F.w.push((0.08 + 0.12 * random()) * (random() < 0.5 ? -1 : 1));
    for (let l = 0; l <= LMAX; l++) {
      F.amp.push(l === 0 ? 0 : (random() < 0.5 ? -1 : 1) * (0.6 + 0.4 * random()));
      F.om.push(0.15 + 0.3 * random());
      F.ph.push(random() * TAU);
    }
  }
  return F;
}

// Axes and coefficients at weather time t, with degree l weighted by how far
// the Degree knob has come past it.
function place(F, t, deg) {
  for (let j = 0; j < AX; j++) {
    const [a, b, p] = F.e[j], th = p + F.w[j] * t, cs = cos(th), sn = sin(th);
    for (let i = 0; i < 3; i++) F.u[3 * j + i] = a[i] * cs + b[i] * sn;
    for (let l = 1; l <= LMAX; l++) {
      const q = j * (LMAX + 1) + l, fade = cl(deg - l + 1, 0, 1);
      F.c[q] = (fade * F.amp[q] * sqrt(2 * l + 1) * sin(F.om[q] * t + F.ph[q])) / Math.pow(l, 0.3);
    }
  }
}

// Even and odd parts of a field at unit vector x, and the gradient of the odd
// part when grad is given: f(x) = even + odd, f(-x) = even - odd.
function evalField(F, x, y, z, L, out, grad) {
  let ev = 0, od = 0, gx = 0, gy = 0, gz = 0;
  for (let j = 0; j < AX; j++) {
    const ux = F.u[3 * j], uy = F.u[3 * j + 1], uz = F.u[3 * j + 2], s = ux * x + uy * y + uz * z, base = j * (LMAX + 1);
    let p0 = 1, p1 = s, d0 = 0, d1 = 1, o = F.c[base + 1] * p1, e = 0, dd = F.c[base + 1];
    for (let l = 1; l < L; l++) {
      const p2 = ((2 * l + 1) * s * p1 - l * p0) / (l + 1), d2 = d0 + (2 * l + 1) * p1, c = F.c[base + l + 1];
      if ((l + 1) & 1) {
        o += c * p2;
        dd += c * d2;
      } else e += c * p2;
      p0 = p1;
      p1 = p2;
      d0 = d1;
      d1 = d2;
    }
    ev += e;
    od += o;
    if (grad) {
      gx += dd * ux;
      gy += dd * uy;
      gz += dd * uz;
    }
  }
  out[0] = ev;
  out[1] = od;
  if (grad) {
    grad[0] = gx;
    grad[1] = gy;
    grad[2] = gz;
  }
}

export function setup(params) {
  const P = S2 * S2;
  // World direction of each pixel of the top square: x right, y up, z
  // toward you, pulled onto the rim outside the disk.
  const wx = new Float32Array(P), wy = new Float32Array(P), wz = new Float32Array(P), cov = new Float32Array(P);
  for (let y = 0; y < S2; y++)
    for (let x = 0; x < S2; x++) {
      const p = y * S2 + x, u = (x + 0.5 - CX) / RAD, v = (CY - y - 0.5) / RAD, r = sqrt(u * u + v * v);
      cov[p] = cl((1 - r) * RAD + 0.5, 0, 1);
      if (r < 1) {
        wx[p] = u;
        wy[p] = v;
        wz[p] = sqrt(1 - r * r);
      } else {
        wx[p] = u / r;
        wy[p] = v / r;
        wz[p] = 0;
      }
    }
  // Seeds: a Fibonacci spiral over the upper hemisphere.
  const seeds = [];
  for (let i = 0; i < SEEDS; i++) {
    const z = (i + 0.5) / SEEDS, r = sqrt(1 - z * z), a = i * 2.39996323;
    seeds.push([r * cos(a), r * sin(a), z]);
  }
  params.s = {
    init: false, t: 0, wt: 0, deg: 3, L: 3, f: field(), g: field(), wx, wy, wz, cov, seeds,
    fe: new Float32Array(P), fo: new Float32Array(P), ge: new Float32Array(P), go: new Float32Array(P),
    lf: new Float32Array(P), lg: new Float32Array(P), roots: [], M: [1, 0, 0, 0, 1, 0, 0, 0, 1], hue: 0.06,
    o1: [0, 0], o2: [0, 0], g1: [0, 0, 0], g2: [0, 0, 0], c: [0, 0, 0], d: [0, 0, 0],
  };
}

// Newton's method on the sphere for fodd = godd = 0: the step is the
// smallest tangent move that zeroes both linearised, taken from x and pulled
// back onto the sphere.
function newton(S, x0) {
  let x = x0[0], y = x0[1], z = x0[2];
  const { o1, o2, g1, g2 } = S;
  for (let it = 0; it < 24; it++) {
    evalField(S.f, x, y, z, S.L, o1, g1);
    evalField(S.g, x, y, z, S.L, o2, g2);
    const F1 = o1[1], F2 = o2[1];
    if (abs(F1) < 1e-13 && abs(F2) < 1e-13) return [x, y, z];
    const d1 = g1[0] * x + g1[1] * y + g1[2] * z, d2 = g2[0] * x + g2[1] * y + g2[2] * z;
    const ax = g1[0] - d1 * x, ay = g1[1] - d1 * y, az = g1[2] - d1 * z;
    const bx = g2[0] - d2 * x, by = g2[1] - d2 * y, bz = g2[2] - d2 * z;
    const a = ax * ax + ay * ay + az * az, b = ax * bx + ay * by + az * bz, c = bx * bx + by * by + bz * bz, det = a * c - b * b;
    if (det < 1e-14) return null;
    const al = (-F1 * c + F2 * b) / det, be = (-F2 * a + F1 * b) / det;
    let sx = al * ax + be * bx, sy = al * ay + be * by, sz = al * az + be * bz;
    const sl = sqrt(sx * sx + sy * sy + sz * sz);
    if (sl > 0.35) {
      sx *= 0.35 / sl;
      sy *= 0.35 / sl;
      sz *= 0.35 / sl;
    }
    x += sx;
    y += sy;
    z += sz;
    const n = 1 / sqrt(x * x + y * y + z * z);
    x *= n;
    y *= n;
    z *= n;
  }
  evalField(S.f, x, y, z, S.L, o1);
  evalField(S.g, x, y, z, S.L, o2);
  return abs(o1[1]) < 1e-10 && abs(o2[1]) < 1e-10 ? [x, y, z] : null;
}

// All antipodal pairs, by Newton's method from three kinds of start: last
// frame's pairs, every 2 x 2 block of LEDs on the near side where both odd
// parts change sign, and a fixed spiral of seeds; each pair kept once.
function findRoots(S) {
  const found = [];
  const add = (r) => {
    if (!r) return;
    for (const q of found) {
      const d = (q[0] - r[0]) ** 2 + (q[1] - r[1]) ** 2 + (q[2] - r[2]) ** 2, e = (q[0] + r[0]) ** 2 + (q[1] + r[1]) ** 2 + (q[2] + r[2]) ** 2;
      if (d < 1e-8 || e < 1e-8) return;
    }
    found.push(r);
  };
  for (const r of S.roots) add(newton(S, r));
  const { fo, go, wx, wy, wz, M } = S;
  for (let y = 0; y < S2 - 1; y++)
    for (let x = 0; x < S2 - 1; x++) {
      const p = y * S2 + x, q = [p, p + 1, p + S2, p + S2 + 1];
      let fp = 0, fn = 0, gp = 0, gn = 0;
      for (const i of q) {
        if (fo[i] > 0) fp = 1;
        else fn = 1;
        if (go[i] > 0) gp = 1;
        else gn = 1;
      }
      if (!(fp && fn && gp && gn)) continue;
      const X = wx[p], Y = wy[p], Z = wz[p];
      add(newton(S, [M[0] * X + M[1] * Y + M[2] * Z, M[3] * X + M[4] * Y + M[5] * Z, M[6] * X + M[7] * Y + M[8] * Z]));
    }
  for (const s of S.seeds) add(newton(S, s));
  S.roots = found;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [3, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.deg = cl(k[0], 3, 6);
  S.L = Math.ceil(S.deg - 1e-9);
  const speed = cl(k[1], 0.2, 3), weather = 0.25 + 1.75 * cl(k[2], 0, 1);
  S.hue = k[3];
  S.t += d * speed;
  S.wt += d * weather;
  place(S.f, S.wt + 3, S.deg);
  place(S.g, S.wt + 3, S.deg);
  // Body from world: undo the lean, then the turn.
  const ph = S.t * 0.025 * TAU, cp = cos(ph), sp = sin(ph), ct = cos(TILT), st = sin(TILT);
  // World = Rx(TILT) Ry(ph) body; body = Ry(-ph) Rx(-TILT) world.
  // Rx(-TILT): (x, y, z) -> (x, ct y + st z, -st y + ct z).
  // Ry(-ph): (x, y, z) -> (cp x - sp z, y, sp x + cp z).
  S.M = [cp, sp * st, -sp * ct, 0, ct, st, sp, -cp * st, cp * ct];
  const { wx, wy, wz, fe, fo, ge, go, o1, o2, M } = S, L = S.L;
  for (let p = 0; p < S2 * S2; p++) {
    const X = wx[p], Y = wy[p], Z = wz[p];
    const x = M[0] * X + M[1] * Y + M[2] * Z, y = M[3] * X + M[4] * Y + M[5] * Z, z = M[6] * X + M[7] * Y + M[8] * Z;
    evalField(S.f, x, y, z, L, o1);
    evalField(S.g, x, y, z, L, o2);
    fe[p] = o1[0];
    fo[p] = o1[1];
    ge[p] = o2[0];
    go[p] = o2[1];
  }
  findRoots(S);
}

// Length of the screen gradient of A + sgn B at LED (x, y), per LED.
function slope(A, B, sgn, x, y) {
  const p = y * S2 + x, xl = x > 0 ? p - 1 : p, xr = x < S2 - 1 ? p + 1 : p, yu = y > 0 ? p - S2 : p, yd = y < S2 - 1 ? p + S2 : p;
  const gx = (A[xr] - A[xl] + sgn * (B[xr] - B[xl])) / (xr - xl), gy = (A[yd] - A[yu] + sgn * (B[yd] - B[yu])) / ((yd - yu) / S2);
  return sqrt(gx * gx + gy * gy) + 1e-9;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { fe, fo, ge, go, cov, wz, c } = S;
  const h0 = 0.52 + S.hue, FS = 2.2, ISO = 2, gc = S.d;
  // Orange and yellow go brown and olive when dim, so near hue 0.12 the
  // pale bands are lifted toward full brightness.
  const yl = [0, 0.5].map((o) => {
    const h = h0 + o - floor(h0 + o);
    return 0.7 * cl(1 - abs(h - 0.12) / 0.11, 0, 1);
  });
  hsv(h0 + 0.25, 0.75, 1, gc);
  // Screen places of the pairs: the member that faces you.
  const pts = [];
  for (const r of S.roots) {
    const M = S.M;
    // World from body is the transpose of M.
    let X = M[0] * r[0] + M[3] * r[1] + M[6] * r[2], Y = M[1] * r[0] + M[4] * r[1] + M[7] * r[2], Z = M[2] * r[0] + M[5] * r[1] + M[8] * r[2];
    if (Z < 0) {
      X = -X;
      Y = -Y;
      Z = -Z;
    }
    pts.push([CX + X * RAD, CY - Y * RAD]);
  }
  const pulse = 0.75 + 0.25 * sin(S.t * 3), { lf, lg } = S;
  // The two odd curves, the same in both disks: fodd(-x) = -fodd(x).
  for (let y = 0; y < S2; y++)
    for (let x = 0; x < S2; x++) {
      const p = y * S2 + x;
      lf[p] = cl(1.25 - abs(fo[p]) / slope(fo, fo, 0, x, y), 0, 1) * cov[p];
      lg[p] = cl(1.15 - abs(go[p]) / slope(go, go, 0, x, y), 0, 1) * cov[p];
    }
  for (let half = 0; half < 2; half++) {
    const sg = half ? -1 : 1;
    for (let y = 0; y < S2; y++)
      for (let x = 0; x < S2; x++) {
        const p = y * S2 + x, a = cov[p];
        if (a <= 0) {
          display.setPixel(x, y + half * S2, 0, 0, 0);
          continue;
        }
        // Temperature: two tones apart from a pale middle, in soft bands.
        const tv = cl((fe[p] + sg * fo[p]) / FS, -1, 1), m = abs(tv) * 4, band = (floor(m) + sm(0.35, 0.65, m - floor(m))) / 4;
        const side = tv < 0 ? 0 : 1, v0 = 0.6 + 0.4 * band;
        hsv(h0 + 0.5 * side, 0.1 + 0.72 * band, v0 + (1 - v0) * yl[side] * sm(0, 0.4, band), c);
        let shade = (0.86 + 0.14 * wz[p]) * a;
        // Pressure: a few contour lines, darker.
        const gv = (ge[p] + sg * go[p]) / ISO, fr = abs(gv - round(gv)) * ISO;
        shade *= 1 - 0.55 * cl(0.95 - fr / slope(ge, go, sg, x, y), 0, 1);
        let R = c[0] * shade, G = c[1] * shade, B = c[2] * shade;
        // The curve godd = 0, where the pressure is the same at the antipode.
        const ga = lg[p];
        R += (gc[0] - R) * ga;
        G += (gc[1] - G) * ga;
        B += (gc[2] - B) * ga;
        // The curve fodd = 0, where the temperature is.
        const fa = lf[p];
        R += (1 - R) * fa;
        G += (1 - G) * fa;
        B += (1 - B) * fa;
        // The pairs: a gold core inside a dark ring, and a glow round it.
        for (const q of pts) {
          const dd = Math.hypot(x + 0.5 - q[0], y + 0.5 - q[1]);
          if (dd >= 6.5) continue;
          if (dd < 2.1) {
            R = 1;
            G = 0.86;
            B = 0.45;
          } else if (dd < 3.2) {
            R *= 0.12;
            G *= 0.12;
            B *= 0.12;
          } else {
            const gw = pulse * 0.9 * (1 - (dd - 3.2) / 3.3) ** 1.5;
            R += (1 - R) * gw;
            G += (0.86 - G) * gw;
            B += (0.45 - B) * gw * 0.5;
          }
        }
        display.setPixel(x, y + half * S2, round(255 * min(1, R)), round(255 * min(1, G)), round(255 * min(1, B)));
      }
  }
}
