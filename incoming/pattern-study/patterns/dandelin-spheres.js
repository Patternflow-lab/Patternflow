// ===== Patternflow pattern =====
// Title:   Dandelin Spheres
// Family:  geometry
// Idea:    A plane cuts a glass double cone in a conic while the two spheres that touch both the cone and the plane sit in it, each touching the plane at a focus and the cone along a circle, and a point running round the conic lights its two distances to the foci in the same colours as the two equal stretches of the cone's line through it, as the whole scene turns slowly about the axis.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dandelin spheres (Germinal Pierre Dandelin, 1822), pattern round 33
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tilt=30..90, Cone=16..34
//
// Knob 1: Hue. Turns the scene round the wheel together. At 0 the lower sphere is teal, the upper one violet and the cone azure, the conic is white, and the two pairs of equal lengths are gold and pink.
// Knob 2: Speed. At 2 the scene turns once round the axis in about 44 s, hurrying past the moment the plane is seen edge on, and the point runs round the opening ellipse in about 4 s; at 0.2 both go ten times slower.
// Knob 3: Tilt. The plane's angle from level, in degrees. At 30 it cuts an ellipse of eccentricity 0.52 between a small sphere and one twice its size; the ellipse stretches as it tilts, at 74 the upper sphere has run off to infinity and the cut is a parabola, and past that the sphere comes back up from below in the other nappe and the cut is a hyperbola, one branch in each nappe. The view backs off to take in the lower nappe from about 50.
// Knob 4: Cone. The cone's half-angle, 16 to 34 degrees. A wider cone at the same tilt gives a rounder ellipse, a far bigger upper sphere and a camera standing further back, and the parabola comes at a tilt of 90 minus this angle, 56 at 34.
// Buttons: K1 tap swings the plane up to upright and back, through the parabola to the hyperbola and home again, in about 11 s at Speed 2.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, tan, abs, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const RAD = PI / 180;

// World units: the apex at the origin, y up the axis. The plane turns about
// the horizontal line through (XP, YP) along z, so at 90 degrees it stands
// 0.3 off the axis and still cuts a hyperbola instead of two crossing lines.
const XP = -0.3, YP = 0.95;
// The cone is cut off at these heights.
const YTOP = 2.25, YBOT = -2.4;
// The plane is drawn where |x| and |z| are under this.
const PX = 1.05;
// Camera: this far from the point it looks at, this many degrees above it.
const DIST = 9, ELEV = 28 * RAD;
// Five lines of the cone, round its axis.
const GEN = 5;
// The opening hue sits here on the wheel: teal.
const H0 = 0.5;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// How far a hue sits in the orange and yellow that turn brown when shaded.
const warm = (h) => {
  h -= floor(h);
  return max(0, 1 - abs(h - 0.11) / 0.1);
};

export function setup(params) {
  params.s = {
    th: 0.6, ph: 0, sw: -1, hue: 0, tilt: 30, cone: 16, speed: 2, lo: -0.25,
    base: new Float32Array(N * 3), lin: new Float32Array(N * 3),
    zO: new Float32Array(N), zC: new Float32Array(N), zP: new Float32Array(N),
    col: new Float32Array(8 * 3), colHue: NaN, sc: {},
  };
}

// The scene for a tilt and half-angle in radians: the plane n.p = h with
// n = (-sin b, cos b, 0), and the two spheres on the axis at heights s with
// radius |s| sin a. A sphere at s is tangent to the cone, and tangent to the
// plane when |cos b s - h| = |s| sin a, so s = h / (cos b + sin a), the one
// between the apex and the plane, and s = h / (cos b - sin a), past the plane
// while cos b > sin a (an ellipse), at infinity when they are equal (a
// parabola), and below the apex in the other nappe once sin a is the larger
// (a hyperbola).
function scene(S, b, a) {
  const sa = sin(a), ca = cos(a), sb = sin(b), cb = cos(b), h = cb * YP - sb * XP;
  const sc = S.sc;
  sc.sa = sa;
  sc.ca = ca;
  sc.k = sa / ca;
  sc.nx = -sb;
  sc.ny = cb;
  sc.h = h;
  sc.s1 = h / (cb + sa);
  const den = cb - sa;
  sc.s2 = abs(den) > 1e-4 ? h / den : 1e9;
  sc.r1 = abs(sc.s1) * sa;
  sc.r2 = abs(sc.s2) * sa;
  // A focus is the foot of the perpendicular from a sphere's centre to the
  // plane; a contact circle is where the sphere meets the cone, at height
  // s cos^2 a. Along a line of the cone it sits s cos a from the apex.
  for (const [s, k] of [[sc.s1, 1], [sc.s2, 2]]) {
    const d = cb * s - h;
    sc["fx" + k] = -d * sc.nx;
    sc["fy" + k] = s - d * sc.ny;
    sc["g" + k] = s * ca;
  }
  sc.e = sb / ca;
}

// The conic as a curve over the cone's azimuth phi: the line of the cone at
// phi, t (sin a cos phi, cos a, sin a sin phi), meets the plane at
// t = h / (cos b cos a - sin b sin a cos phi). On a hyperbola t changes sign
// where that denominator does, and the point crosses to the other nappe.
function conicT(sc, phi) {
  const den = sc.ny * sc.ca + sc.nx * sc.sa * cos(phi);
  return abs(den) < 1e-6 ? 1e9 : sc.h / den;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.tilt = cl(k[2], 30, 90);
  S.cone = cl(k[3], 16, 34);
  const sp = S.speed / 2;
  if (input.btnPressed && input.btnPressed[0]) S.sw = 0;
  let tilt = S.tilt;
  if (S.sw >= 0) {
    // Up to upright in 4.5 s, a 2 s rest, and back in 4.5 s, at Speed 2.
    S.sw += (d * sp) / 11;
    const u = S.sw, up = u < 0.41 ? sm(u / 0.41) : u < 0.59 ? 1 : 1 - sm((u - 0.59) / 0.41);
    tilt += (90 - tilt) * up;
    if (S.sw >= 1) S.sw = -1;
  }
  scene(S, tilt * RAD, S.cone * RAD);
  const sc = S.sc;
  // The view: level with the ellipse case's spheres while the cut is an
  // ellipse, widening downwards to take in the other nappe as the eccentricity
  // passes 0.8 on its way to the hyperbola.
  const lo = -0.25 - 1.95 * sm((sc.e - 0.8) / 0.3);
  S.lo += (lo - S.lo) * min(1, d * 3);
  // The turn hurries past the azimuths where the camera sees the plane edge
  // on and the conic flattens to a line, and lingers where it lies open.
  const edgeOn = abs(sc.nx * cos(ELEV) * sin(S.th) + sc.ny * sin(ELEV));
  S.th += d * sp * ((2 * PI) / 36) * (0.6 + 1.8 * exp(-((edgeOn / 0.18) ** 2)));
  // The point moves at about 0.55 units a second along the conic. Off the
  // drawn part of a hyperbola or parabola it skips ahead to where it comes
  // back in.
  let left = d * sp * 0.55, guard = 0;
  while (left > 0 && guard++ < 40) {
    const t0 = conicT(sc, S.ph), t1 = conicT(sc, S.ph + 0.01);
    const y0 = t0 * sc.ca;
    if (y0 > YTOP || y0 < YBOT + 0.1) {
      S.ph += 0.05;
      continue;
    }
    const x0 = t0 * sc.sa * cos(S.ph), z0 = t0 * sc.sa * sin(S.ph);
    const x1 = t1 * sc.sa * cos(S.ph + 0.01), z1 = t1 * sc.sa * sin(S.ph + 0.01), y1 = t1 * sc.ca;
    const ds = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 0.01;
    const step = min(left / max(ds, 1e-3), 0.3);
    S.ph += step;
    left -= step * ds;
  }
  S.ph %= 2 * PI;
}

// Colours: lower sphere, upper sphere, cone, plane, conic, the two
// segment colours, white.
function palette(S) {
  const c = S.col, h = S.hue + H0;
  // The cone and the plane are seen faint, where a warm hue reads olive, so
  // they lose more of their colour there than the bright parts do.
  const set = (i, hh, s, v) => {
    const w = warm(hh);
    hsv(hh, s * (1 - (i === 2 || i === 3 ? 0.7 : 0.35) * w), v, c, i * 3);
  };
  set(0, h, 0.72, 1);
  set(1, h + 0.2, 0.62, 1);
  set(2, h + 0.1, 0.55, 1);
  set(3, h + 0.04, 0.5, 1);
  set(4, h + 0.62, 0.14, 1);
  set(5, h + 0.62, 0.6, 1);
  set(6, h + 0.42, 0.55, 1);
  set(7, 0, 0, 1);
  S.colHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.sc.h === undefined) return;
  if (S.colHue !== S.hue) palette(S);
  const sc = S.sc, col = S.col, base = S.base, lin = S.lin, zO = S.zO, zC = S.zC, zP = S.zP;
  const hi = YTOP, lo = S.lo, ty = (hi + lo) / 2;
  // A wider cone pulls the camera back, by the square root of how much
  // wider it is than the 16 degree one, so a wide ellipse still fits.
  const f = (128 * DIST) / ((hi - lo) * cos(ELEV) * sqrt(sc.k / tan(16 * RAD)));
  // Camera basis. fwd looks at (0, ty, 0) from DIST away, ELEV above.
  const ce = cos(ELEV), se = sin(ELEV), st = sin(S.th), ct = cos(S.th);
  const ox = DIST * ce * st, oy = ty + DIST * se, oz = DIST * ce * ct;
  const fx = -ce * st, fy = -se, fz = -ce * ct;
  const rx = ct, rz = -st; // right = fwd x up, level
  const ux = -fy * rz, uy = rz * fx - rx * fz, uz = fy * rx;
  // The light hangs above and to the left of the camera.
  let lx = -0.55 * rx + 0.75 * ux - 0.5 * fx, ly = 0.75 * uy - 0.5 * fy, lz = -0.55 * rz + 0.75 * uz - 0.5 * fz;
  const ll = Math.hypot(lx, ly, lz);
  lx /= ll;
  ly /= ll;
  lz /= ll;
  const k2 = sc.k * sc.k, nx = sc.nx, ny = sc.ny, h = sc.h;
  // Each sphere: height, radius, palette slot, and how warm its hue is.
  const sph = [
    [sc.s1, sc.r1, 0, warm(S.hue + H0)],
    [sc.s2, sc.r2, 3, warm(S.hue + H0 + 0.2)],
  ];
  for (let py = 0, p = 0; py < H; py++) {
    const v = (63.5 - py) / f, bg = 0.025 + 0.02 * (py / H);
    for (let px = 0; px < W; px++, p++) {
      const u = (px - 31.5) / f;
      const dx = fx + u * rx + v * ux, dy = fy + v * uy, dz = fz + u * rz + v * uz;
      const dd = dx * dx + dy * dy + dz * dz, il = 1 / sqrt(dd);
      let r = bg * 0.6, g = bg * 0.75, b = bg * 1.5, tO = 1e9;
      // The spheres, opaque and lit. They are drawn whole even where they
      // rise past the cut cone, a ball sitting in a cup.
      for (let q = 0; q < 2; q++) {
        const s = sph[q][0], rad = sph[q][1];
        if (rad <= 0 || abs(s) > 60) continue;
        const ocy = oy - s, bb = ox * dx + ocy * dy + oz * dz, cc = ox * ox + ocy * ocy + oz * oz - rad * rad, disc = bb * bb - dd * cc;
        if (disc <= 0) continue;
        const t = (-bb - sqrt(disc)) / dd;
        if (t <= 0 || t >= tO) continue;
        tO = t;
        const o = sph[q][2];
        const hx = (ox + t * dx) / rad, hy = (oy + t * dy - s) / rad, hz = (oz + t * dz) / rad;
        const di = max(0, hx * lx + hy * ly + hz * lz);
        // Blinn highlight on the half vector between the light and the eye.
        const vx = lx - dx * il, vy = ly - dy * il, vz = lz - dz * il;
        const vl = Math.hypot(vx, vy, vz);
        const hs = max(0, (hx * vx + hy * vy + hz * vz) / vl), spec = hs ** 28 * 0.75;
        const rim = -(hx * dx + hy * dy + hz * dz) * il;
        // Orange and yellow go brown in shade, so a warm sphere gets more
        // fill light and stays gold.
        const wq = sph[q][3], lit = 0.12 + 0.3 * wq + (0.8 - 0.2 * wq) * di * (0.55 + 0.45 * rim);
        r = col[o] * lit + spec;
        g = col[o + 1] * lit + spec;
        b = col[o + 2] * lit + spec;
      }
      zO[p] = tO;
      // The cone: x^2 + z^2 = k^2 y^2, both nappes. Glass, so each crossing
      // adds a little light, more where the surface is seen edge on.
      const A = dx * dx + dz * dz - k2 * dy * dy, B = 2 * (ox * dx + oz * dz - k2 * oy * dy), C = ox * ox + oz * oz - k2 * oy * oy;
      let tc1 = 1e9, tc2 = 1e9;
      const disc = B * B - 4 * A * C;
      if (disc > 0 && abs(A) > 1e-9) {
        const sq = sqrt(disc);
        let ta = (-B - sq) / (2 * A), tb = (-B + sq) / (2 * A);
        if (ta > tb) [ta, tb] = [tb, ta];
        for (const t of [ta, tb]) {
          const y = oy + t * dy;
          if (t > 0 && y < YTOP && y > YBOT) {
            if (tc1 > 1e8) tc1 = t;
            else tc2 = t;
          }
        }
      }
      zC[p] = tc1;
      // The plane, clipped to a square in x and z and to the cone's height.
      // It is brighter inside the cone, where it is the conic's own disc, and
      // lit along its edges.
      let tp = 1e9, pin = false, pm = 0;
      const nd = nx * dx + ny * dy;
      if (abs(nd) > 1e-6) {
        const t = (h - nx * ox - ny * oy) / nd;
        if (t > 0 && t < tO) {
          const x = ox + t * dx, y = oy + t * dy, z = oz + t * dz;
          const m = min(PX - abs(x), PX - abs(z), y - YBOT, YTOP - y);
          if (m > 0) {
            tp = t;
            pin = x * x + z * z < k2 * y * y;
            pm = (m * f) / t;
          }
        }
      }
      zP[p] = tp;
      // The glass layers in front of the opaque hit, far to near: the far
      // wall of the cone, then the near wall, with the plane wherever it falls.
      const pa = pin ? 0.2 : 0.12, pe = (pin ? 0.3 : 0.08) + 0.5 * exp(-pm * pm * 0.8);
      const pos = tp > tc2 ? 0 : tp > tc1 ? 1 : 2;
      for (let L = 0; L < 3; L++) {
        const isP = L === pos, t = isP ? tp : (L < pos ? L : L - 1) === 0 ? tc2 : tc1;
        if (t >= tO || t > 1e8) continue;
        let a, e, o;
        if (isP) {
          a = pa;
          e = pe;
          o = 9;
        } else {
          const x = ox + t * dx, y = oy + t * dy, z = oz + t * dz, gy = -k2 * y, gl = Math.hypot(x, gy, z) || 1;
          const ci = abs((x * dx + gy * dy + z * dz) / gl) * il, fr = (1 - ci) * (1 - ci);
          a = 0.06 + 0.2 * fr;
          e = 0.07 + 0.42 * fr;
          o = 6;
        }
        r = r * (1 - a) + col[o] * e;
        g = g * (1 - a) + col[o + 1] * e;
        b = b * (1 - a) + col[o + 2] * e;
      }
      base[p * 3] = r;
      base[p * 3 + 1] = g;
      base[p * 3 + 2] = b;
    }
  }

  // Lines and points, splatted over the shading. Behind a sphere they show
  // through dimmed, behind the cone's near wall or the plane a little dimmer.
  lin.fill(0);
  const ssa = sc.sa, sca = sc.ca;
  let cr = 0, cg = 0, cb = 0, cw = 0;
  // A thick line is laid as two strands half an LED either side of its
  // path on the screen, (tox, toy) apart.
  let thick = false, tox = 0, toy = 0;
  const put = (sx, sy, k) => {
    const ix = floor(sx), iy = floor(sy), ax = sx - ix, ay = sy - iy;
    for (let j = 0; j < 4; j++) {
      const X = ix + (j & 1), Y = iy + (j >> 1);
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const wt = k * (j & 1 ? ax : 1 - ax) * (j >> 1 ? ay : 1 - ay), o = (Y * W + X) * 3;
      lin[o] += cr * wt;
      lin[o + 1] += cg * wt;
      lin[o + 2] += cb * wt;
    }
  };
  const splat = (x, y, z, w) => {
    const qx = x - ox, qy = y - oy, qz = z - oz, zz = qx * fx + qy * fy + qz * fz;
    if (zz < 0.1) return;
    const sx = 31.5 + (f * (qx * rx + qz * rz)) / zz, sy = 63.5 - (f * (qx * ux + qy * uy + qz * uz)) / zz;
    if (sx < -2 || sx > W + 1 || sy < -2 || sy > H + 1) return;
    const ni = cl(Math.round(sy), 0, H - 1) * W + cl(Math.round(sx), 0, W - 1);
    let k = w;
    if (zz > zO[ni] + 0.04) k *= 0.38;
    if (zz > zC[ni] + 0.04) k *= 0.62;
    if (zz > zP[ni] + 0.03) k *= 0.75;
    if (!thick) put(sx, sy, k);
    else {
      put(sx + tox, sy + toy, k * 0.62);
      put(sx - tox, sy - toy, k * 0.62);
    }
  };
  const proj = (x, y, z) => {
    const qx = x - ox, qy = y - oy, qz = z - oz, zz = max(0.1, qx * fx + qy * fy + qz * fz);
    return [(f * (qx * rx + qz * rz)) / zz, (f * (qx * ux + qy * uy + qz * uz)) / zz];
  };
  const seg = (ax, ay, az, bx, by, bz) => {
    const [sx0, sy0] = proj(ax, ay, az), [sx1, sy1] = proj(bx, by, bz);
    const L = Math.hypot(sx1 - sx0, sy1 - sy0), n = max(1, Math.ceil(L / 0.6)), w = (L / n) * cw;
    tox = L > 0 ? (-(sy1 - sy0) / L) * 0.55 : 0;
    toy = L > 0 ? ((sx1 - sx0) / L) * 0.55 : 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      splat(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, i === 0 || i === n ? w / 2 : w);
    }
  };
  const use = (o, w) => {
    cr = col[o * 3];
    cg = col[o * 3 + 1];
    cb = col[o * 3 + 2];
    cw = w;
  };
  // A point on the line of the cone at azimuth phi, t along it.
  const gp = (phi, t) => [t * ssa * cos(phi), t * sca, t * ssa * sin(phi)];
  // The cone's lines through the apex and its two rims.
  use(2, 0.3);
  const tTop = YTOP / sca, tBot = YBOT / sca;
  for (let i = 0; i < GEN; i++) {
    const phi = (i * 2 * PI) / GEN + 0.3;
    seg(...gp(phi, tTop), 0, 0, 0);
    seg(0, 0, 0, ...gp(phi, tBot));
  }
  const ring = (y, rad, n) => {
    let px = rad, pz = 0;
    for (let i = 1; i <= n; i++) {
      const a = (i * 2 * PI) / n, qx = rad * cos(a), qz = rad * sin(a);
      seg(px, y, pz, qx, y, qz);
      px = qx;
      pz = qz;
    }
  };
  use(2, 0.5);
  ring(YTOP, YTOP * sc.k, 72);
  ring(YBOT, -YBOT * sc.k, 72);
  // The contact circles, in each sphere's colour, brighter.
  const okS = (s, r) => r > 0 && abs(s) < 60;
  use(0, 0.95);
  if (okS(sc.s1, sc.r1)) ring(sc.g1 * sca, abs(sc.g1 * ssa), 64);
  use(1, 0.95);
  if (okS(sc.s2, sc.r2) && sc.g2 * sca < YTOP && sc.g2 * sca > YBOT) ring(sc.g2 * sca, abs(sc.g2 * ssa), 64);
  // The conic, drawn in pieces wherever it lies inside the cut cone.
  use(4, 1.35);
  const NPH = 240;
  let prev = null;
  for (let i = 0; i <= NPH; i++) {
    const phi = (i * 2 * PI) / NPH, t = conicT(sc, phi), y = t * sca;
    const okp = y < YTOP && y > YBOT;
    const cur = okp ? gp(phi, t) : null;
    if (cur && prev && abs(cur[1] - prev[1]) < 1.2) seg(...prev, ...cur);
    prev = cur;
  }
  // The point, its two distances to the foci and the line of the cone
  // through it, cut where it meets the two contact circles. Each pair in one
  // colour: PF1 equals the stretch to circle 1, PF2 the stretch to circle 2.
  const tP = conicT(sc, S.ph), yP = tP * sca;
  if (yP < YTOP && yP > YBOT) {
    const [Px, Py, Pz] = gp(S.ph, tP);
    const clipT = (t) => cl(t, tBot, tTop);
    thick = true;
    use(5, 1.5);
    if (okS(sc.s1, sc.r1)) {
      seg(Px, Py, Pz, sc.fx1, sc.fy1, 0);
      seg(Px, Py, Pz, ...gp(S.ph, clipT(sc.g1)));
    }
    use(6, 1.5);
    if (okS(sc.s2, sc.r2)) {
      seg(Px, Py, Pz, sc.fx2, sc.fy2, 0);
      seg(Px, Py, Pz, ...gp(S.ph, clipT(sc.g2)));
    } else seg(Px, Py, Pz, ...gp(S.ph, sc.g2 > 0 ? tTop : tBot));
    thick = false;
    use(7, 2.2);
    for (const [ddx, ddy] of [[0, 0], [0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]]) splat(Px + ddx, Py + ddy, Pz, 1);
  }
  // The foci, white points where the spheres touch the plane.
  use(7, 1.6);
  for (const [s, r, fxx, fyy] of [[sc.s1, sc.r1, sc.fx1, sc.fy1], [sc.s2, sc.r2, sc.fx2, sc.fy2]]) {
    if (!okS(s, r) || fyy > YTOP || fyy < YBOT) continue;
    for (const [ddx, ddy] of [[0, 0], [0.014, 0], [-0.014, 0], [0, 0.014], [0, -0.014]]) splat(fxx + ddx, fyy + ddy, 0, 1);
  }
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3;
      display.setPixel(x, y, cl((base[o] + lin[o]) * 255, 0, 255), cl((base[o + 1] + lin[o + 1]) * 255, 0, 255), cl((base[o + 2] + lin[o + 2]) * 255, 0, 255));
    }
}
