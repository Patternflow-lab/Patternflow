// ===== Patternflow pattern =====
// Title:   Antoine's Necklace
// Family:  space
// Idea:    A glass necklace shaped like a running track holds a closed chain of solid links, each linked with its two neighbours and each a small copy of the whole necklace with its own chain inside, and the camera flies forever into one link: as it grows its surface thins to glass, the chain inside turns solid, and after nine seconds the picture is the start again, one generation deeper towards a point of Antoine's Cantor set.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Antoine's necklace (Louis Antoine, 1921), pattern round 37
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Links=18..30, Turn=45..90
//
// Knob 1: Hue. Turns the three generation colours round the wheel together, a third apart. At 0 the chain is azure in pale lime glass and the chain inside each link is rose; a generation that comes round to red, orange or yellow is laid paler so its shaded side does not go brown.
// Knob 2: Speed. How fast the camera dives: at 2 one generation every 9 s, so a link grows 5.4 times as it fills the panel; at 0.2 one generation every 90 s, at 3 every 6 s.
// Knob 3: Links. Links in every chain, 18 to 30 in steps of two. Each link is the whole necklace shrunk to 0.184 at 18 and 0.111 at 30, so at 18 a link stands about 21 rows tall at the opening and at 30 about 12.
// Knob 4: Turn. How far the necklace is turned about its upright axis: at 45 degrees both kinds of link, the ones lying in the necklace's plane and the ones standing across it, show the same width; at 90 the necklace is seen edge on, the lying links shrink to slivers and the standing ones face the panel. On top of it the necklace swings 22 degrees further round and back once a generation, and sways 8 degrees every 25 s at Speed 2.
// Buttons: K1 tap picks the next link the camera dives into, among the links that lie flat on the two straight runs (three of them at 18 links), and the camera glides over to it in 1.5 s; a tap in the last part of a generation waits for the next one.

// The shape. The core of the necklace is a stadium: two straight runs of
// length 2L joined by two half circles of radius 1. The solid torus round it
// has tube radius RHO. With L = 1 and RHO = 0.27 the outside is 2.54 wide and
// 4.54 tall, and at a turn of 45 degrees it stands about twice as tall as it
// is wide, like the panel.
//
// The links. A chain of N links runs round the core, one every P / N of arc
// (P = 4L + 2 pi = 10.28). Every link is the necklace itself scaled by s, its
// long axis along the core, and they alternate: even links lie in the
// necklace's plane, odd links stand across it. The spacing is SPACE = 3.1
// times a link's own core half width, so s = P / (3.1 N). Measured by
// sampling every link's core at 96 points: at N = 18 the closest two
// neighbours come within 0.47 of a link tube radius of touching, a link comes
// within 0.38 of a tube radius of the parent's wall, and links two apart stay
// 6 tube radii apart; at N = 30 these are 0.91, 4.1 and 6.1. The Gauss
// linking integral, at 120 points a link for N = 18, 24 and 30, comes to 1
// for every pair of neighbours and to 0 for every other pair. Uniform
// spacing fails below 18: at 16 the bends turn neighbours 37 degrees against
// each other, the end of one link swings towards the side of the next, and
// the best scale still leaves them 0.05 of a tube radius into each other.
//
// Every link holds a chain built the same way, so the necklace is a fixed
// set of similarity maps and it is the same at every scale. The dive target
// is a flat link on a straight run, whose map is a pure shrink and shift,
// x -> s x + c. The camera slides towards the map's fixed point
// p = c / (1 - s), a point of the Cantor set, its distance to p shrinking by s
// each generation, so the view at the end of one generation is the view at
// its start. What changes is the colour: generations keep theirs as they grow.

const W = 64, H = 128, NPIX = W * H;
const L = 1, RHO = 0.27, SPACE = 3.1, P = 4 * L + 2 * Math.PI;
const BX = 1 + RHO, BY = L + 1 + RHO, BZ = RHO;
// The camera stands 9 units from the necklace's middle with a focal length of
// 222 LEDs, so the 4.54 units of height take 112 rows and the necklace's
// neighbours in the chain it belongs to show above and below it.
const D0 = 9, F = 222;
const { min, max, floor, sqrt, sin, cos, abs, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Point and tangent of the core at arc length u, starting at the middle of
// the right run and going up, so anticlockwise.
function core(u, out) {
  u = ((u % P) + P) % P;
  let x, y, tx, ty;
  if (u < L) (x = 1), (y = u), (tx = 0), (ty = 1);
  else if (u < L + PI) {
    const a = u - L;
    (x = cos(a)), (y = L + sin(a)), (tx = -sin(a)), (ty = cos(a));
  } else if (u < 3 * L + PI) (x = -1), (y = L - (u - L - PI)), (tx = 0), (ty = -1);
  else if (u < 3 * L + 2 * PI) {
    const a = PI + (u - 3 * L - PI);
    (x = cos(a)), (y = -L + sin(a)), (tx = -sin(a)), (ty = cos(a));
  } else (x = 1), (y = -L + (u - 3 * L - 2 * PI)), (tx = 0), (ty = 1);
  out[0] = x;
  out[1] = y;
  out[2] = tx;
  out[3] = ty;
}

// The N maps of one chain: rotation (columns: the link's across, along and
// out-of-plane axes) and centre, all for a parent of size 1.
function buildChain(N) {
  const s = P / (SPACE * N), rot = new Float64Array(9 * N), ctr = new Float64Array(3 * N), targets = [], c = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    core((i * P) / N, c);
    const [x, y, tx, ty] = c, nx = ty, ny = -tx, o = 9 * i;
    if (i % 2 === 0) {
      // A flat link on a straight run gets no rotation at all, even on the
      // left run where its axes point the other way: the stadium looks the
      // same turned half round, and this keeps its map a pure shrink.
      const flatRun = tx === 0;
      rot.set(flatRun ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [nx, ny, 0, tx, ty, 0, 0, 0, 1], o);
      if (flatRun) targets.push(i);
    } else rot.set([0, 0, 1, tx, ty, 0, -ty, tx, 0], o);
    ctr[3 * i] = x;
    ctr[3 * i + 1] = y;
  }
  return { N, s, rot, ctr, targets };
}

// Ray directions through each LED, in view space (x right, y up, looking
// down -z).
const RDX = new Float32Array(NPIX), RDY = new Float32Array(NPIX), RDZ = new Float32Array(NPIX);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - W / 2) / F, dy = -(y + 0.5 - H / 2) / F, n = 1 / sqrt(dx * dx + dy * dy + 1), p = y * W + x;
    RDX[p] = dx * n;
    RDY[p] = dy * n;
    RDZ[p] = -n;
  }

// Light from the upper left and in front, and the half vector for the shine.
const LV = (() => {
  const l = [-0.55, 0.6, 0.58], n = 1 / Math.hypot(...l);
  const lx = l[0] * n, ly = l[1] * n, lz = l[2] * n, hz = lz + 1, hn = 1 / Math.hypot(lx, ly, hz);
  return [lx, ly, lz, lx * hn, ly * hn, hz * hn];
})();

// Solidity and glass by apparent generation a = generation - zoom: a link is
// solid from a = 0.85 up, thins to clear by a = 0.2, and its glass rim fades
// out between a = 0 and a = -1, where it is the parent of the panel's parent.
const solidOf = (a) => sm(0.2, 0.85, a);
const glassOf = (a) => sm(-1, -0.25, a) * (1 - solidOf(a));

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, links: 18, turn: 45, z: 0, gen: 0, clock: 0,
    chain: buildChain(18), tgt: 0, ctx: 0, pend: false, from: null, glide: 1, gz0: 0,
    zb: new Float32Array(NPIX), cr: new Float32Array(NPIX), cg: new Float32Array(NPIX), cb: new Float32Array(NPIX),
    pal: new Float32Array(18), palHue: NaN, list: [],
  };
}

// The camera's aim point for target index ti of a chain: p = c / (1 - s).
function aim(ch, ti) {
  const i = ch.targets[ti % ch.targets.length], k = 1 / (1 - ch.s);
  return [ch.ctr[3 * i] * k, ch.ctr[3 * i + 1] * k, 0, i];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 18, 45], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.turn = cl(k[3], 45, 90);
  const n = 2 * Math.round(cl(k[2], 18, 30) / 2);
  if (n !== S.chain.N) {
    S.chain = buildChain(n);
    S.tgt = 0;
    S.ctx = S.chain.targets[0];
    S.glide = 1;
    S.pend = false;
  }
  // The glide takes 1.5 s, which is gz of a generation. It must end before
  // the wrap, so a tap late in a generation waits for the next one, where
  // every target's path still starts from the same view.
  const gz = (1.5 * S.speed) / 18;
  if (input.btnPressed && input.btnPressed[0]) S.pend = true;
  if (S.pend && S.glide >= 1 && S.z + gz < 0.95) {
    S.from = aim(S.chain, S.tgt);
    S.tgt = (S.tgt + 1) % S.chain.targets.length;
    S.glide = 0;
    S.gz0 = S.z;
    S.pend = false;
  }
  // If Speed is turned up during a glide it still ends by z = 0.97.
  S.glide = min(1, max(S.glide + d / 1.5, (S.z - S.gz0) / (0.97 - S.gz0)));
  S.clock += (d * S.speed) / 2;
  S.z += (d * S.speed) / 18;
  if (S.z >= 1) {
    // One generation deeper: the target link becomes the necklace, and the
    // necklace it sat in becomes the one round the panel.
    S.z -= 1;
    S.gen++;
    S.glide = 1;
    S.ctx = S.chain.targets[S.tgt];
  }
}

function palette(S) {
  // Three generation colours a third apart. At Hue 0 they are lime (glass of
  // the opening), azure (the opening chain) and rose. Body colour and the
  // floor its shaded side keeps: a red, orange or yellow body keeps more of
  // its light and less of its saturation, as at half light it reads brown.
  for (let g = 0; g < 3; g++) {
    const h = S.hue + 0.227 + g / 3, hh = h - floor(h), hw = hh > 0.9 ? hh - 1 : hh, warm = sm(-0.05, 0.02, hw) * (1 - sm(0.17, 0.27, hw));
    hsv(h, 0.78 - 0.3 * warm, 1, S.pal, g * 6);
    hsv(h, 0.28, 1, S.pal, g * 6 + 3);
    S.pal[15 + g] = warm;
  }
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const ch = S.chain, s = ch.s, z = S.z, sz = pow(s, z);
  // The aim point, gliding after a tap.
  let p = aim(ch, S.tgt);
  if (S.glide < 1 && S.from) {
    const w = sm(0, 1, S.glide);
    p = [S.from[0] + (p[0] - S.from[0]) * w, S.from[1] + (p[1] - S.from[1]) * w, 0, p[3]];
  }
  // View rotation: turn about the upright axis, then lean back 12 degrees.
  // Halfway through each generation the necklace has swung 22 degrees
  // further round, so the run the camera dives at turns to face along the
  // view and the empty middle of the necklace narrows; it swings back by the
  // end, and the swing starts and stops at rest, so the loop has no seam.
  const sw = sin(PI * z), psi = ((S.turn + 22 * sw * sw + 8 * sin((2 * PI * S.clock) / 25)) * PI) / 180, tilt = (-12 * PI) / 180;
  const cy = cos(psi), sy = sin(psi), ct = cos(tilt), st = sin(tilt);
  // R = Rx(tilt) * Ry(psi), row-major.
  const R = [cy, 0, sy, st * sy, ct, -st * cy, -ct * sy, st, ct * cy];
  const k1 = 1 - sz, ox = p[0] * k1, oy = p[1] * k1;
  // World point x -> view: R (x - (1 - s^z) p) - (0, 0, s^z D0).
  const list = (S.list = []);
  const near = 0.05 * sz * D0;
  const visit = (Sc, M, cx, cy0, cz, gen) => {
    // Centre in view.
    const wx = cx - ox, wy = cy0 - oy, wz = cz;
    const vx = R[0] * wx + R[1] * wy + R[2] * wz, vy = R[3] * wx + R[4] * wy + R[5] * wz, vz = R[6] * wx + R[7] * wy + R[8] * wz - sz * D0;
    const rad = Sc * (BY + 0.05);
    if (gen >= 0) {
      if (vz - rad > -near) return;
      const dz = -vz, ext = rad;
      if (dz > ext) {
        const sx = W / 2 + (F * vx) / dz, syy = H / 2 - (F * vy) / dz, pr = (F * ext) / (dz - ext);
        if (sx + pr < 0 || sx - pr > W || syy + pr < 0 || syy - pr > H) return;
        // A tube under a third of an LED thick is not drawn.
        if ((F * Sc * RHO) / dz < 0.17) return;
      }
      const a = gen - z, sol = solidOf(a), gl = glassOf(a);
      if (sol > 0.004 || gl > 0.03) {
        const MV = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++) MV[r * 3 + c] = R[r * 3] * M[c] + R[r * 3 + 1] * M[3 + c] + R[r * 3 + 2] * M[6 + c];
        list.push({ S: Sc, MV, vx, vy, vz, sol, gl, col: (((S.gen + gen) % 3) + 3) % 3 });
      }
      // Behind a link more than 97% solid its chain does not show.
      if (sol >= 0.97 || gen >= 2) return;
    }
    for (let i = 0; i < ch.N; i++) {
      const o = 9 * i, Ri = ch.rot, ci = ch.ctr;
      // Child rotation M * Ri (row-major M; Ri stored by columns).
      const CM = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) CM[r * 3 + c] = M[r * 3] * Ri[o + c * 3] + M[r * 3 + 1] * Ri[o + c * 3 + 1] + M[r * 3 + 2] * Ri[o + c * 3 + 2];
      const px = ci[3 * i], py = ci[3 * i + 1];
      visit(Sc * s, CM, cx + Sc * (M[0] * px + M[1] * py), cy0 + Sc * (M[3] * px + M[4] * py), cz + Sc * (M[6] * px + M[7] * py), gen + 1);
    }
  };
  // Start from the necklace the panel's necklace is a link of: the link the
  // camera dived into last generation.
  const ct0 = ch.ctr, ci0 = S.ctx;
  visit(1 / s, [1, 0, 0, 0, 1, 0, 0, 0, 1], -ct0[3 * ci0] / s, -ct0[3 * ci0 + 1] / s, 0, -1);

  const { zb, cr, cg, cb } = S;
  zb.fill(Infinity);
  cr.fill(0);
  cg.fill(0);
  cb.fill(0);
  for (const e of list) if (e.sol >= 0.999) raster(S, e, true, sz);
  const rest = list.filter((e) => e.sol < 0.999).sort((a, b) => a.vz - b.vz);
  for (const e of rest) raster(S, e, false, sz);
  for (let i = 0; i < NPIX; i++) display.setPixel(i % W, (i / W) | 0, cr[i] * 255, cg[i] * 255, cb[i] * 255);
}

// Trace every LED in the link's screen box against the link's own distance
// field, in the link's frame where it has half width 1.
function raster(S, e, solid, sz) {
  const { MV, vx, vy, vz } = e, Sc = e.S, inv = 1 / Sc;
  // Camera in link coordinates: MV^T (0 - centre) / S.
  const ox = -(MV[0] * vx + MV[3] * vy + MV[6] * vz) * inv, oy = -(MV[1] * vx + MV[4] * vy + MV[7] * vz) * inv, oz = -(MV[2] * vx + MV[5] * vy + MV[8] * vz) * inv;
  // Screen box from the eight corners of the link's box.
  let x0 = W, x1 = -1, y0 = H, y1 = -1, full = false;
  for (let c = 0; c < 8; c++) {
    const lx = c & 1 ? BX : -BX, ly = c & 2 ? BY : -BY, lz = c & 4 ? BZ : -BZ;
    const px = vx + Sc * (MV[0] * lx + MV[1] * ly + MV[2] * lz), py = vy + Sc * (MV[3] * lx + MV[4] * ly + MV[5] * lz), pz = vz + Sc * (MV[6] * lx + MV[7] * ly + MV[8] * lz);
    if (-pz < 1e-3) {
      full = true;
      break;
    }
    const sx = W / 2 + (F * px) / -pz, sy = H / 2 - (F * py) / -pz;
    if (sx < x0) x0 = sx;
    if (sx > x1) x1 = sx;
    if (sy < y0) y0 = sy;
    if (sy > y1) y1 = sy;
  }
  if (full) (x0 = 0), (x1 = W - 1), (y0 = 0), (y1 = H - 1);
  const X0 = max(0, floor(x0)), X1 = min(W - 1, floor(x1)), Y0 = max(0, floor(y0)), Y1 = min(H - 1, floor(y1));
  if (X0 > X1 || Y0 > Y1) return;
  const { zb, cr, cg, cb, pal } = S, g6 = e.col * 6, warm = pal[15 + e.col];
  const br = pal[g6], bg = pal[g6 + 1], bb = pal[g6 + 2], gr = pal[g6 + 3], gg = pal[g6 + 4], gbb = pal[g6 + 5];
  const [lx, ly, lz, hx, hy, hz] = LV;
  const eps = 0.3 / F, sol = e.sol, gl = e.gl, dref = sz * D0;
  for (let py = Y0; py <= Y1; py++)
    for (let px = X0; px <= X1; px++) {
      const p = py * W + px, rx = RDX[p], ry = RDY[p], rz = RDZ[p];
      const dx = MV[0] * rx + MV[3] * ry + MV[6] * rz, dy = MV[1] * rx + MV[4] * ry + MV[7] * rz, dz = MV[2] * rx + MV[5] * ry + MV[8] * rz;
      // Slab test against the box.
      let t0 = 0, t1 = 1e9;
      {
        const ix = 1 / dx, a = (-BX - ox) * ix, b = (BX - ox) * ix;
        t0 = max(t0, min(a, b));
        t1 = min(t1, max(a, b));
        const iy = 1 / dy, c = (-BY - oy) * iy, d = (BY - oy) * iy;
        t0 = max(t0, min(c, d));
        t1 = min(t1, max(c, d));
        const iz = 1 / dz, f = (-BZ - oz) * iz, g = (BZ - oz) * iz;
        t0 = max(t0, min(f, g));
        t1 = min(t1, max(f, g));
      }
      if (t0 >= t1) continue;
      const zmax = zb[p] * inv;
      if (t0 >= zmax) continue;
      let t = t0, hit = false, qx = 0, qy = 0, qz = 0, q = 0, rr = 0, dyy = 0;
      for (let it = 0; it < 48; it++) {
        qx = ox + t * dx;
        qy = oy + t * dy;
        qz = oz + t * dz;
        const ay = abs(qy) - L;
        dyy = ay > 0 ? ay : 0;
        rr = sqrt(qx * qx + dyy * dyy);
        q = rr - 1;
        const dist = sqrt(q * q + qz * qz) - RHO;
        if (dist < eps * t) {
          hit = true;
          break;
        }
        t += dist;
        if (t > t1 || t > zmax) break;
      }
      if (!hit) continue;
      // Normal in link coordinates, then in view.
      const rinv = rr > 1e-6 ? 1 / rr : 0, gx = q * qx * rinv, gy = q * (qy < 0 ? -dyy : dyy) * rinv;
      let nl = sqrt(gx * gx + gy * gy + qz * qz);
      nl = nl > 1e-9 ? 1 / nl : 0;
      const nlx = gx * nl, nly = gy * nl, nlz = qz * nl;
      const nx = MV[0] * nlx + MV[1] * nly + MV[2] * nlz, ny = MV[3] * nlx + MV[4] * nly + MV[5] * nlz, nz = MV[6] * nlx + MV[7] * nly + MV[8] * nlz;
      const ndv = -(nx * rx + ny * ry + nz * rz), edge = abs(ndv);
      const lam = max(0, nx * lx + ny * ly + nz * lz), spec = pow(max(0, nx * hx + ny * hy + nz * hz), 36);
      const tv = t * Sc;
      // Depth: nearer than the necklace's middle is brighter.
      const fog = cl(1.25 - 0.55 * (tv / dref), 0.45, 1.2);
      const amb = 0.2 + 0.25 * warm, body = (amb + (1 - amb) * lam) * sm(0.0, 0.45, edge) * fog;
      let r = br * body + 0.75 * spec * fog, g = bg * body + 0.75 * spec * fog, b = bb * body + 0.75 * spec * fog;
      if (solid) {
        zb[p] = tv;
        cr[p] = r;
        cg[p] = g;
        cb[p] = b;
        continue;
      }
      // Glass: a faint tint over its whole face, bright at the rim, and the
      // shine. A thinning link blends its body over what lies behind it.
      const rim = pow(1 - edge, 2.2), gw = gl * (0.05 + 0.85 * rim);
      const keep = 1 - sol;
      cr[p] = cr[p] * keep + r * sol + gr * gw + 0.5 * spec * gl;
      cg[p] = cg[p] * keep + g * sol + gg * gw + 0.5 * spec * gl;
      cb[p] = cb[p] * keep + b * sol + gbb * gw + 0.5 * spec * gl;
    }
}
