// ===== Patternflow pattern =====
// Title:   Facet Fire
// Family:  dispersion
// Idea:    A white beam of a few strands comes from the upper left into an irregular glass polygon that turns and sways in the middle of the panel, and at every face it is bent, split into seven colours by the Cauchy law and, past the critical angle, thrown back inside, so spectral fans leave the polygon in changing directions and sweep round it as the beam angle and the polygon move.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Snell's law of refraction (Willebrord Snellius, 1621, from memory), the Fresnel reflectance of a glass face for unpolarised light (Augustin-Jean Fresnel, 1823, from memory) and the dispersion law n = A + B / lambda^2 (Augustin-Louis Cauchy, 1836, from memory), traced as a tree of rays in two dimensions through a polygon; the sparkle of a cut stone called its fire; original in the way it is put on a 64 by 128 panel, pattern round 226
// Round:   226
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Dispersion=0.6..3, Strands=-1..1, Facets=-1..1
//
// Knob 1: Hue. Turns the seven spectral colours and the sleeve of the white beam once round the colour wheel: at 0 the fan runs red, orange, yellow-green, green, cyan-blue, blue, violet and the beam has a faint blue sleeve, at 0.5 the fan runs cyan, azure, violet, magenta, red, yellow, lime, and 1 is the same as 0.
// Knob 2: Dispersion. The B of the Cauchy law, 0.034 at 0.6, 0.128 at 2 where it opens and 0.2 at 3, with the index of the middle colour held at 2.0, so that red and violet part by 1.2 degrees at 0.6, 4.2 at 2 and 6.4 at 3 inside the glass at a 40 degree face; at 2 violet is shut in by total reflection past 25.6 degrees where red still leaves up to 32.7.
// Knob 3: Strands. How many strands the beam has, 2.5 at -1, 3 at 0 where it opens and 6 at +1, 5.2 LEDs apart on average and each leaning a few degrees off the others on its own random sequence; the strand that is joining fades in as the count passes it, so the count never jumps.
// Knob 4: Facets. The number of faces of the polygon, 8 at -1, 12 at 0 where it opens and 16 at +1; between two counts the next face grows out of the middle of an edge, so the shape never jumps, and about 35 LEDs across at every setting.

const W = 64, H = 128, NPIX = W * H;
const { floor, sqrt, exp, sin, cos, pow, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Seven colours, wavelengths in micrometres, about evenly spaced in 1 / lambda^2 so that the
// Cauchy law spreads them evenly, and the hue each one is drawn with, in degrees.
const NL = 7;
const LAM = [0.70, 0.62, 0.56, 0.51, 0.478, 0.448, 0.42];
const HUE = [0, 22, 62, 135, 190, 232, 268];
const N0 = 2.0, LAM0 = 0.56;

// The polygon is taken from a pool of 16 corners. The corner at position p joins the
// shape as the count goes up in this order, so that any count is spread round evenly.
const NV = 16;
const ORDER = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
const RANK = new Int32Array(NV);
for (let i = 0; i < NV; i++) RANK[ORDER[i]] = i;

const R0 = 2.05; // ribbon radius, LEDs: 2.2 LEDs wide at half height
const GROW = 0.028; // the ribbon widens by this much per LED of path after the first face
const ALPHA = 0.016; // the glass takes this fraction of a ray per LED of path inside
const EPS = 0.02; // a ray fainter than this is dropped
const DMAX = 8; // faces a ray may meet
const STRAND = 5.2; // LEDs between strands of the beam
const WB = 0.4; // brightness of the white beam
const RG = 0.85; // brightness of a coloured ray
const GAIN = 1.5;
const AURA = 0.16; // a soft sleeve round the white beam, in the colour of the Hue knob
const WSUP = 0.5; // how much a ray that is nearly white is held back against a coloured one
const NSTACK = 400;
const STRIDE = 10;
const CORNER = 1.6; // within this many LEDs of a corner the face normal turns smoothly into its neighbour's

const hash = (n) => {
  const x = sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - floor(x);
};
// Smooth random numbers: a new value at every whole step of t, joined by a Catmull-Rom
// curve, in about -1..1. Each channel has its own sequence.
function wander(t, ch) {
  const i = floor(t), f = t - i, o = ch * 101.7;
  const a = hash(i - 1 + o) * 2 - 1, b = hash(i + o) * 2 - 1, c = hash(i + 1 + o) * 2 - 1, d = hash(i + 2 + o) * 2 - 1;
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

function hsv(h, s, v) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  return [k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p, k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p, k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p];
}

export function setup(P) {
  // The random sequences are read from a clock that opens at 36 s, where the picture is busy.
  P.t = 36;
  P.theta = 0.7;
  P.ar = new Float32Array(NPIX);
  P.ag = new Float32Array(NPIX);
  P.ab = new Float32Array(NPIX);
  P.bt = new Float32Array(NPIX);
  P.br = new Float32Array(NPIX);
  P.bg = new Float32Array(NPIX);
  P.bb = new Float32Array(NPIX);
  P.out = new Float32Array(NPIX * 3);
  P.px = new Float64Array(NV);
  P.py = new Float64Array(NV);
  P.vx = new Float64Array(NV);
  P.vy = new Float64Array(NV);
  P.AX = new Float64Array(NV + 1);
  P.AY = new Float64Array(NV + 1);
  P.EX = new Float64Array(NV + 1);
  P.EY = new Float64Array(NV + 1);
  P.NX = new Float64Array(NV + 1);
  P.NY = new Float64Array(NV + 1);
  P.LEN = new Float64Array(NV + 1);
  P.hs = 0;
  P.ne = 0;
  P.ht = 0;
  P.idx = new Float64Array(NL);
  P.col = new Float64Array(NL * 3);
  P.tint = new Float64Array(6);
  // A stack of faces still to be met: x, y, dx, dy, intensity, colour, depth, edge, path, place on the edge.
  P.st = new Float64Array(NSTACK * STRIDE);
  P.jit = new Float64Array(NV);
  P.rj = new Float64Array(NV);
  for (let p = 0; p < NV; p++) {
    P.jit[p] = 0.3 * (hash(p * 3.7 + 1.3) * 2 - 1);
    P.rj[p] = 0.08 * (hash(p * 5.1 + 9.9) * 2 - 1);
  }
  P.a1 = 6.28 * hash(2.2);
  P.a2 = 6.28 * hash(4.4);
  P.a3 = 6.28 * hash(8.8);
}

// The polygon: n corners out of the pool, turned by theta, each corner with a position
// and a radius of its own wandering on its own sequence.
function buildPoly(P, n, cx, cy, R) {
  const { px, py, AX, AY, EX, EY, NX, NY, LEN, jit, rj } = P;
  const t = P.t, ct = cos(P.theta), st = sin(P.theta);
  // The glass is stretched or squeezed along one axis by up to a fifth, on a sequence of its own.
  const asp = 1.05 + 0.2 * wander(t / 27 + 3.3, 21);
  const nf = floor(n), wp = n - nf;
  for (let p = 0; p < NV; p++) {
    const phi = ((p + jit[p] + 0.12 * wander(t / 18 + p * 1.9, 40 + p)) * TAU) / NV;
    const rr = R * (1 + 0.12 * sin(phi + P.a1) + 0.2 * sin(2 * phi + P.a2) + 0.12 * sin(3 * phi + P.a3)) * (1 + rj[p] + 0.07 * wander(t / (11 + p * 0.9) + p * 3.7, 60 + p));
    const lx = rr * cos(phi), ly = rr * sin(phi) * asp;
    px[p] = cx + lx * ct - ly * st;
    py[p] = cy + lx * st + ly * ct;
  }
  // The corner that is only partly grown stands on the edge between its two neighbours
  // and moves out to its own place by the fraction wp.
  let part = -1;
  if (wp > 0.001 && nf < NV) for (let p = 0; p < NV; p++) if (RANK[p] === nf) part = p;
  if (part >= 0) {
    let a = (part + NV - 1) % NV, b = (part + 1) % NV;
    while (RANK[a] >= nf) a = (a + NV - 1) % NV;
    while (RANK[b] >= nf) b = (b + 1) % NV;
    const dx = px[part] - cx, dy = py[part] - cy;
    const ex = px[b] - px[a], ey = py[b] - py[a];
    const den = dx * ey - dy * ex;
    let s = 0.5;
    if (abs(den) > 1e-9) s = ((px[a] - cx) * ey - (py[a] - cy) * ex) / den;
    let qx, qy;
    if (abs(den) > 1e-9 && s > 0) {
      qx = cx + s * dx;
      qy = cy + s * dy;
    } else {
      qx = 0.5 * (px[a] + px[b]);
      qy = 0.5 * (py[a] + py[b]);
    }
    px[part] = qx + wp * (px[part] - qx);
    py[part] = qy + wp * (py[part] - qy);
  }
  let m = 0;
  const { vx, vy } = P;
  for (let p = 0; p < NV; p++) {
    if (RANK[p] < nf || p === part) {
      vx[m] = px[p];
      vy[m] = py[p];
      m++;
    }
  }
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    const ex = vx[j] - vx[i], ey = vy[j] - vy[i], len = sqrt(ex * ex + ey * ey) + 1e-9;
    AX[i] = vx[i];
    AY[i] = vy[i];
    EX[i] = ex;
    EY[i] = ey;
    LEN[i] = len;
    NX[i] = ey / len;
    NY[i] = -ex / len;
  }
  P.ne = m;
}

// The first face a ray meets, skipping the one it has just left; its distance goes in P.ht.
function firstHit(P, x, y, dx, dy, skip) {
  const { AX, AY, EX, EY } = P;
  let best = 1e9, be = -1, bs = 0;
  for (let e = 0; e < P.ne; e++) {
    if (e === skip) continue;
    const ex = EX[e], ey = EY[e];
    const den = dx * ey - dy * ex;
    if (den > -1e-9 && den < 1e-9) continue;
    const ax = AX[e] - x, ay = AY[e] - y;
    const t = (ax * ey - ay * ex) / den;
    if (t <= 1e-3 || t >= best) continue;
    const s = (ax * dy - ay * dx) / den;
    if (s < 0 || s > 1) continue;
    best = t;
    be = e;
    bs = s;
  }
  P.ht = best;
  P.hs = bs;
  return be;
}

// A soft ribbon of radius r (a bump, (1 - q^2)^2) along a straight run of length L from
// (x0, y0) in the direction (ux, uy), brightness I0 at the start and I1 at the end, added
// into the three sums. An end that joins another run is cross-faded with it over 2 LEDs,
// so a bend shows no bead; a free end fades over the last 1.2 LEDs.
function ribbon(P, x0, y0, ux, uy, L, I0, I1, r0, r1, cr, cg, cb, hasPrev, hasNext) {
  const { ar, ag, ab } = P;
  const steep = abs(uy) > abs(ux);
  const a0 = steep ? y0 : x0, b0 = steep ? x0 : y0;
  const ua = steep ? uy : ux, ub = steep ? ux : uy;
  const amax = steep ? H : W, bmax = steep ? W : H;
  const um = hasPrev ? -1 : 0, uM = L + (hasNext ? 1 : 0);
  const aA = a0 + um * ua, aB = a0 + uM * ua;
  const rmax = r0 > r1 ? r0 : r1;
  const aw = rmax * abs(ub);
  let i0 = Math.ceil((aA < aB ? aA : aB) - 0.5 - aw), i1 = floor((aA < aB ? aB : aA) - 0.5 + aw);
  if (i0 < 0) i0 = 0;
  if (i1 > amax - 1) i1 = amax - 1;
  const hb = rmax / abs(ua), slope = ub / ua, iL = 1 / (L > 1e-3 ? L : 1e-3);
  const g0 = pow(R0 / r0, 0.6), g1 = pow(R0 / r1, 0.6);
  for (let ai = i0; ai <= i1; ai++) {
    const da = ai + 0.5 - a0, bc = b0 + da * slope;
    let j0 = Math.ceil(bc - hb - 0.5), j1 = floor(bc + hb - 0.5);
    if (j0 < 0) j0 = 0;
    if (j1 > bmax - 1) j1 = bmax - 1;
    for (let bi = j0; bi <= j1; bi++) {
      const db = bi + 0.5 - b0;
      const u = da * ua + db * ub;
      if (u < um || u > uM) continue;
      const v = -da * ub + db * ua;
      let f = u * iL;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      const rr = r0 + (r1 - r0) * f, q = (v < 0 ? -v : v) / rr;
      if (q >= 1) continue;
      let p = 1 - q * q;
      p *= p;
      let ws = hasPrev ? 0.5 + u * 0.5 : u / 1.2;
      ws = ws < 0 ? 0 : ws > 1 ? 1 : ws;
      let we = hasNext ? 0.5 - (u - L) * 0.5 : (L - u) / 1.2;
      we = we < 0 ? 0 : we > 1 ? 1 : we;
      const k = (I0 + (I1 - I0) * f) * p * ws * we * (g0 + (g1 - g0) * f);
      const idx = steep ? ai * W + bi : bi * W + ai;
      ar[idx] += k * cr;
      ag[idx] += k * cg;
      ab[idx] += k * cb;
    }
  }
}

// A round glint.
function spot(P, x, y, rad, amp, cr, cg, cb) {
  const { ar, ag, ab } = P;
  let x0 = floor(x - rad - 0.5), x1 = Math.ceil(x + rad - 0.5), y0 = floor(y - rad - 0.5), y1 = Math.ceil(y + rad - 0.5);
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > W - 1) x1 = W - 1;
  if (y1 > H - 1) y1 = H - 1;
  const ir = 1 / (rad * rad);
  for (let j = y0; j <= y1; j++)
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - x, dy = j + 0.5 - y;
      const q = (dx * dx + dy * dy) * ir;
      if (q >= 1) continue;
      const k = amp * (1 - q) * (1 - q);
      const idx = j * W + i;
      ar[idx] += k * cr;
      ag[idx] += k * cg;
      ab[idx] += k * cb;
    }
}

const rw = (sp) => {
  const w = R0 + GROW * sp;
  return w > R0 * 2.3 ? R0 * 2.3 : w;
};

// One strand of the beam. It is drawn white up to the first face; there it splits into the
// seven colours and each is followed through every face it meets, the share that is
// reflected and the share that is refracted both going on.
function strand(P, sx, sy, dx, dy, wt) {
  const e0 = firstHit(P, sx, sy, dx, dy, -1);
  const L0 = e0 >= 0 ? P.ht : 500;
  const { tint } = P;
  ribbon(P, sx, sy, dx, dy, L0, WB * wt, WB * wt, R0, R0, tint[0], tint[1], tint[2], false, e0 >= 0);
  ribbon(P, sx, sy, dx, dy, L0, AURA * wt, AURA * wt, 3.8, 3.8, tint[3], tint[4], tint[5], false, e0 >= 0);
  if (e0 < 0) return;
  const { st, col, idx, NX, NY, EX, EY, LEN } = P;
  const hs0 = P.hs, ne = P.ne;
  const hx0 = sx + dx * L0, hy0 = sy + dy * L0;
  let sp = 0;
  for (let j = 0; j < NL; j++) {
    const o = sp * STRIDE;
    st[o] = hx0; st[o + 1] = hy0; st[o + 2] = dx; st[o + 3] = dy;
    st[o + 4] = wt; st[o + 5] = j; st[o + 6] = 0; st[o + 7] = e0; st[o + 8] = 0; st[o + 9] = hs0;
    sp++;
  }
  while (sp > 0) {
    sp--;
    const o = sp * STRIDE;
    const hx = st[o], hy = st[o + 1], ddx = st[o + 2], ddy = st[o + 3];
    const I = st[o + 4], j = st[o + 5] | 0, depth = st[o + 6] | 0, e = st[o + 7] | 0, pathLen = st[o + 8];
    const cr = col[j * 3], cg = col[j * 3 + 1], cb = col[j * 3 + 2];
    // The face normal at the place hit: the face's own, turned toward the neighbouring
    // face's within CORNER LEDs of a corner, so that a ray crossing a corner is bent
    // continuously and the fan does not jump from one direction to another.
    let nxo = NX[e], nyo = NY[e];
    const pos = st[o + 9] * LEN[e], rem = LEN[e] - pos;
    if (pos < CORNER) {
      const w = 0.5 * (1 - pos / CORNER), q = (e + ne - 1) % ne;
      nxo += (NX[q] - nxo) * w;
      nyo += (NY[q] - nyo) * w;
    }
    if (rem < CORNER) {
      const w = 0.5 * (1 - rem / CORNER), q = (e + 1) % ne;
      nxo += (NX[q] - nxo) * w;
      nyo += (NY[q] - nyo) * w;
    }
    const nl = sqrt(nxo * nxo + nyo * nyo) + 1e-9;
    nxo /= nl;
    nyo /= nl;
    const dn = ddx * nxo + ddy * nyo;
    const entering = dn < 0;
    const nj = idx[j];
    const n1 = entering ? 1 : nj, n2 = entering ? nj : 1;
    const cosi = dn < 0 ? -dn : dn;
    const sg = entering ? 1 : -1, Nx = sg * nxo, Ny = sg * nyo;
    const eta = n1 / n2, s2 = eta * eta * (1 - cosi * cosi);
    let Rf = 1, cost = 0, tir = true;
    if (s2 < 1) {
      tir = false;
      cost = sqrt(1 - s2);
      const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
      const rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi);
      Rf = 0.5 * (rs * rs + rp * rp);
    }
    // The glint on the face: a faint one for every face the light touches, a bright one
    // where it is totally reflected, and, just as the angle crosses the critical angle of
    // this colour, a spark along the face where the refracted ray skims it.
    let gl = 0.1 + (tir ? 0.55 : 0.8 * Rf);
    spot(P, hx, hy, 2.4, gl * I * RG, cr, cg, cb);
    if (!entering) {
      const u = Math.acos(cosi) - Math.asin(1 / nj);
      if (u > -0.05 && u < 0.14) {
        const fl = u < 0 ? 1 + u / 0.05 : 1 - u / 0.14;
        const el = sqrt(EX[e] * EX[e] + EY[e] * EY[e]);
        const fx = EX[e] / el, fy = EY[e] / el;
        spot(P, hx, hy, 3.2, 1.0 * fl * fl * I, cr, cg, cb);
        ribbon(P, hx - fx * 3.5, hy - fy * 3.5, fx, fy, 7, 0.8 * fl * fl * I * RG, 0.8 * fl * fl * I * RG, 1.4, 1.4, cr, cg, cb, false, false);
      }
    }
    for (let k = 0; k < 2; k++) {
      const Ic = k === 0 ? I * Rf : I * (1 - Rf);
      if (Ic < EPS) continue;
      let cx, cy;
      if (k === 0) {
        cx = ddx + 2 * cosi * Nx;
        cy = ddy + 2 * cosi * Ny;
      } else {
        cx = eta * ddx + (eta * cosi - cost) * Nx;
        cy = eta * ddy + (eta * cosi - cost) * Ny;
      }
      const cl2 = sqrt(cx * cx + cy * cy);
      cx /= cl2;
      cy /= cl2;
      const inside = cx * nxo + cy * nyo < 0;
      const nh = firstHit(P, hx, hy, cx, cy, e);
      const hsn = P.hs;
      const L = nh >= 0 ? P.ht : 500;
      const Ie = inside ? Ic * exp(-ALPHA * L) : Ic;
      const cont = nh >= 0 && Ie >= EPS && depth + 1 < DMAX && sp < NSTACK - 1;
      ribbon(P, hx, hy, cx, cy, L, Ic * RG, Ie * RG, rw(pathLen), rw(pathLen + L), cr, cg, cb, true, cont);
      if (cont) {
        const q = sp * STRIDE;
        st[q] = hx + cx * L; st[q + 1] = hy + cy * L; st[q + 2] = cx; st[q + 3] = cy;
        st[q + 4] = Ie; st[q + 5] = j; st[q + 6] = depth + 1; st[q + 7] = nh; st[q + 8] = pathLen + L; st[q + 9] = hsn;
        sp++;
      }
    }
  }
}

function blur(src, dst, tmp, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const b = y * W;
    let acc = src[b] * (r + 1);
    for (let i = 1; i <= r; i++) acc += src[b + (i < W ? i : W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[b + x] = acc * inv;
      acc += src[b + (x + r + 1 < W ? x + r + 1 : W - 1)] - src[b + (x - r < 0 ? 0 : x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = tmp[x] * (r + 1);
    for (let i = 1; i <= r; i++) acc += tmp[(i < H ? i : H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc * inv;
      acc += tmp[(y + r + 1 < H ? y + r + 1 : H - 1) * W + x] - tmp[(y - r < 0 ? 0 : y - r) * W + x];
    }
  }
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  P.t += d;
  const t = P.t;
  const k1 = cl(kv[0], 0, 1), k2 = cl(kv[1], 0.6, 3), k3 = cl(kv[2], -1, 1), k4 = cl(kv[3], -1, 1);

  // Indices of the seven colours, the middle one held at N0 whatever B is.
  const B = 0.2 * pow(k2 / 3, 1.1);
  for (let j = 0; j < NL; j++) P.idx[j] = N0 + B * (1 / (LAM[j] * LAM[j]) - 1 / (LAM0 * LAM0));
  for (let j = 0; j < NL; j++) {
    const c = hsv(HUE[j] / 360 + k1, 1, 1);
    P.col[j * 3] = c[0];
    P.col[j * 3 + 1] = c[1];
    P.col[j * 3 + 2] = c[2];
  }
  // The beam is white with a trace of the knob's colour, and a sleeve of that colour round it.
  const tc = hsv(0.55 + k1, 0.18, 1), ta = hsv(0.55 + k1, 1, 1);
  for (let c = 0; c < 3; c++) {
    P.tint[c] = tc[c];
    P.tint[3 + c] = ta[c];
  }
  // The seven colours add up to white: each channel is scaled so that the three sums agree.
  const sm = [0, 0, 0];
  for (let j = 0; j < NL; j++) for (let c = 0; c < 3; c++) sm[c] += P.col[j * 3 + c];
  const mean = (sm[0] + sm[1] + sm[2]) / 3;
  for (let j = 0; j < NL; j++) for (let c = 0; c < 3; c++) P.col[j * 3 + c] *= mean / sm[c];

  // The polygon turns about once in two minutes, a little faster and slower on a random
  // sequence, sways about the middle and breathes.
  P.theta += d * (0.05 + 0.03 * wander(t / 23 + 1.7, 11));
  const cx = 32 + 6 * wander(t / 37 + 5.2, 12) + 1.5 * wander(t / 11 + 4.1, 15), cy = 62 + 11 * wander(t / 43 + 2.9, 13) + 2 * wander(t / 13 + 0.3, 16);
  const R = 17.5 * (1 + 0.16 * wander(t / 31 + 0.4, 14) + 0.04 * wander(t / 9.3 + 6.6, 17));
  buildPoly(P, 12 + 4 * k4, cx, cy, R);

  // The beam comes from above, mostly from the upper left; its angle sweeps through about
  // 60 degrees on random sequences, and it slides across the polygon.
  const ang = 1.2 + 0.5 * wander(t / 41 + 3.1, 1) + 0.3 * wander(t / 19 + 1.1, 18) + 0.14 * wander(t / 7.5 + 7.7, 2);
  const dx = cos(ang), dy = sin(ang);
  const nx = -dy, ny = dx;
  const off = 0.5 * R * wander(t / 19 + 8.8, 3);
  const gap = STRAND * (1 + 0.3 * wander(t / 53 + 2.2, 19));
  const ns = 3 + (k3 < 0 ? 0.5 : 3) * k3;

  P.ar.fill(0);
  P.ag.fill(0);
  P.ab.fill(0);
  // Faint outline of the polygon, so that the shape is there between glints.
  for (let e = 0; e < P.ne; e++) {
    const len = sqrt(P.EX[e] * P.EX[e] + P.EY[e] * P.EY[e]);
    ribbon(P, P.AX[e], P.AY[e], P.EX[e] / len, P.EY[e] / len, len, 0.07, 0.07, 1.5, 1.5, 0.6, 0.75, 1, true, true);
  }
  for (let i = 0; i < 6; i++) {
    const wt = cl(ns - i, 0, 1);
    if (wt <= 0) continue;
    // Each strand also leans a little off the others, on its own random sequence, so the
    // beam is a loose comb and not a bundle.
    const o = (i - (ns - 1) / 2) * gap + 1.6 * wander(t / 15 + i * 4.3, 30 + i);
    const a = ang + 0.075 * wander(t / 13 + i * 3.3, 40 + i), ex = cos(a), ey = sin(a);
    strand(P, cx + nx * (off + o) - ex * 170, cy + ny * (off + o) - ey * 170, ex, ey, wt);
  }

  // Bloom, then the tone. The brightness follows the strongest channel, 1 - exp(-GAIN m),
  // and the colour stays as it was, so a bright red is a bright red and not a pink; a
  // mix of all the colours (white) is held back, so the coloured rays carry the picture.
  const { ar, ag, ab, bt, br, bg, bb, out } = P;
  blur(ar, br, bt, 3);
  blur(ag, bg, bt, 3);
  blur(ab, bb, bt, 3);
  for (let i = 0; i < NPIX; i++) {
    const r = ar[i] + 0.2 * br[i], g = ag[i] + 0.2 * bg[i], b = ab[i] + 0.2 * bb[i];
    const m = r > g ? (r > b ? r : b) : g > b ? g : b;
    const o = i * 3;
    if (m < 1e-4) {
      out[o] = out[o + 1] = out[o + 2] = 0;
      continue;
    }
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
    const k = ((1 - exp(-GAIN * m)) / m) * (1 - WSUP * (mn / m));
    out[o] = r * k;
    out[o + 1] = g * k;
    out[o + 2] = b * k;
  }
}

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o] * 255, out[o + 1] * 255, out[o + 2] * 255);
    }
}
