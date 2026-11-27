// ===== Patternflow pattern =====
// Title:   Stream Gaps
// Family:  stellarstream
// Idea:    A globular cluster orbits a galaxy whose centre lies off the panel and sheds its stars through its two Lagrange points into a gold leading tail and a blue trailing one, the window turning round the galaxy with it, and every half minute to a minute and a half an unseen dark subhalo flies through the stream, so the stars where it passed bend out into a spur and then a gap opens and widens, until the cluster has gone and a new one on another orbit takes its place.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tidal tails of globular clusters, grown by releasing stars at the two Lagrange points of an orbiting cluster (the particle-spray method of Küpper and co-authors and of Fardal and co-authors, from memory), and the epicyclic overdensities along young tails (Küpper and co-authors, 2008, from memory); King's tidal radius (1962, from memory); the logarithmic halo with a flat rotation curve (as in Binney and Tremaine's Galactic Dynamics, from memory); gaps cut in streams by dark subhalos (Ray Carlberg, 2009, from memory) and the phases of their growth (Denis Erkal and Vasily Belokurov, 2015, from memory); the gaps and the spur of GD-1 (Adrian Price-Whelan and Ana Bonaca, 2018, from memory); Plummer softening (1911). The window, the numbers and the colours are original, pattern round 269.
// Round:   269
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Subhalo=0..4, Cluster=-1..1, Halo=-1..1
//
// Knob 1: Hue. Turns both tails round the colour wheel together: at 0 the leading tail is gold and the trailing tail sky blue, at 0.25 green against magenta, at 0.5 blue against orange. Each new cluster moves both by up to 22 degrees, and a star's colour deepens over the 90 s after it escapes.
// Knob 2: Subhalo. The mass of the subhalos, nominally 10^6 suns at 0, 10^7 at the opening 2 and 10^8 at 4. Each step of 1 makes the pull 3.2 times stronger and the core 1.8 times wider, so the largest kick a star gets is about 0.15 LED/s at 0, 0.5 at 2 and 1.8 at 4. At 0 a crossing leaves the stream whole; at 2 the stars near it bend out into a spur for half a minute and then part in a gap that widens by about half an LED a second; at 4 the stream is torn into loose loops. The violet glow grows with the mass.
// Knob 3: Cluster. The mass of the cluster, a quarter of the opening's at -1 and four times it at 1, which sets its tidal radius at full mass: 3.3 LED at -1, 5.2 at 0 and 8.3 at 1 at the opening zoom. The stream is about two tidal radii wide and lengthens in proportion to it, so -1 gives a thin short stream and a small knot, 1 a broad long stream round a large bright knot. The knot changes at once; the tails follow as new stars leave.
// Knob 4: Halo. The circular speed of the galaxy, 8.3 model lengths a second at -1, 11 at 0 and 14.6 at 1 (a model length is 1.3 LED at the opening). A cluster keeps its angular momentum, so a heavier halo draws its orbit in: the mean radius of the orbit goes from about 143 to 81 model lengths, the arc across the panel bends harder and one orbit takes 35 s instead of 108 s. Turned slowly, the stream shrinks or swells where it is. The run before the first frame and the head start of a new cluster are counted in orbits, so every setting opens on a stream of the same age, and the subhalos scale with the halo.
//
// What the picture is. A dark navy sky, lighter toward the lower left where the centre of the galaxy lies off the panel, with thirty to seventy faint field stars, and across it a stream of 1600 to 2500 stars, 900 to 1500 of them in view, as a soft band about 6 LED wide in a haze of its own light, running corner to corner. The cluster is a white knot about 5 LED across. Ahead of it on its orbit runs the leading tail, gold, of stars that left through the inner Lagrange point and so go round faster; behind it the trailing tail, sky blue, of stars that left outward and lag. Near the knot each tail sways and bunches into clumps. Every 30 to 90 s a violet glow about 13 LED across sweeps over the stream in 6 s: an unseen subhalo. Where it crossed, the stars first bend out into a spur, a whiter strand beside the stream, and after half a minute a gap opens there and widens, while the window drifts over for 45 to 75 s to watch it and then goes back to the cluster. After 190 to 270 s the cluster has lost its last star and the knot goes out; 8 to 26 s later the window turns to a new cluster on another orbit, perhaps going round the other way so that gold and blue swap ends, and the old stream fades with an e-folding time of 40 s.
// The model. Test stars move in a logarithmic halo, potential 1/2 v0^2 ln(8^2 + R^2) in model lengths, round in the plane, with v0 = 11 model lengths a second at Halo 0, plus the cluster's Plummer potential softened to half its tidal radius, plus the subhalo's, stepped by symplectic Euler at 1/30 s (1/15 s before the first frame, halved while a subhalo passes). The cluster is a point on an orbit of eccentricity 0.04 to 0.17 and mean radius 93 to 123 model lengths at Halo 0, an orbit of about 62 s. Its tidal radius is King's (G M R^2 / 2 v0^2)^(1/3) for this halo: 4 model lengths at full mass and Cluster 0, shrinking with the cube root of the mass left, which falls in a straight line to nothing over the cluster's life. It sheds 3400 stars in pairs, one a tidal radius inward and one outward, at a rate that goes as (R_g / R)^2 so that more leave near pericentre, each with the cluster's angular velocity and a scatter of 0.3 times the angular velocity times the tidal radius (one star in five gets 2.2 times that, the stream's fuzz). The tails, their clumps, the spur and the gap all come out of the integration and are not drawn. A subhalo is a Plummer sphere of G M = 95 model lengths cubed per second squared with a core of 5.5 at Subhalo 2, flying straight at 3.5 v0 through a star of the stream chosen 3.2 s ahead inside the panel and at least 35 model lengths from the cluster, with an impact parameter of 0 to 4 out of the plane added to its softening. A star is coloured by its orbital energy against the cluster's, in units of the energy a star has when it leaves from a Lagrange point, so a kick shows as a change of colour too. Three crossings are run before the first frame, the last about 45 s before it, so the opening stream already carries a young gap.
// What is exact and what is not. The orbits, the shedding at the Lagrange points and the subhalo's pull are integrated as written, and the spur and the gap are what a Plummer flyby does to such a stream in a plane. A real stream takes gigayears and dozens of orbits; here an orbit takes about a minute and a cluster is several times larger against its orbit than Palomar 5 (from memory), so the stream is thick and quick and a spur lasts half a minute instead of hundreds of millions of years. Real subhalos pass above or below a stream and bend it out of its plane; a flat model can only let them cross it, with the out-of-plane distance folded into the softening. The subhalo flies straight and does not pull on the cluster, so the window that follows the cluster stays steady; dark matter gives no light and the glow only marks where it is. Field stars ride fixed circular orbits and feel nothing. The knot is drawn from the cluster's mass, not from stars. The window is a choice: it turns round the galaxy with the cluster, looks up to about 40 model lengths ahead of or behind it on two slow sines, sways its tilt and its distance, drifts to each fresh gap and pans to the next cluster, and each cluster brings its own tilt (9 to 40 degrees) and zoom (1.15 to 1.5 LED a model length). A new cluster's first 55 to 80 s are run in the 8 to 26 s before it appears, its tint shifts by up to 22 degrees as a stand-in for another metallicity, and an old stream fades away where a real one would stay.
//
// Size: 29 KB, over the 25 KB asked. The code is 21 KB; the rest is this header, which carries the numbers the README paragraph is written from.

const W = 64, H = 128, NP = W * H;
const POOL = 6000;        // stream stars, a ring shared by the clusters
const NF = 1800;          // field stars
const NC = 3;             // cluster slots
const { floor, sqrt, exp, sin, cos, atan2, min, max, abs, log, pow, cbrt, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;
const wrap = (a) => a - TAU * floor(a / TAU + 0.5);

const V0 = 11;            // circular speed of the halo at Halo 0, LED/s
const RC2 = 64;           // core radius of the halo, 8 LED, squared
const LREF = V0 * 108;    // angular momentum of an average cluster orbit
const NREL = 3400;        // stars a cluster sheds over its life
const PRE = 150;          // seconds run before the first frame at Halo 0; it scales with the orbital period
const LEAD = 3.2;         // seconds from choosing a subhalo's target to its crossing
const WSUB = 3.5;         // subhalo speed in units of the circular speed
const HPRE = 1 / 15;      // step of the run before the first frame
const HLIVE = 1 / 30;

// a private generator for the subhalo's aim, so its draws never shift the main sequence
function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(params) {
  const s = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, t: 0, v0: V0, v0T: V0,
    X: new Float32Array(POOL), Y: new Float32Array(POOL), VX: new Float32Array(POOL), VY: new Float32Array(POOL),
    TR: new Float32Array(POOL), G: new Int8Array(POOL).fill(-1), used: 0, ring: 0,
    cls: [], cur: -1, nextSlot: 0, waitT: 0, nx: -1, ffLeft: 0, skip: new Uint8Array(NC),
    sub: { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, T: 2 * LEAD, bz: 0 },
    hits: [], nextHit: 0,
    fi: -1, fg: -1, ft: 0, fl: 0, wf: 0, fx: 0, fy: 0,
    psi: 0, D: 108, om: 0, g0: 0.42, zm: 1.3, pre: PRE, gam: 0.42, p: [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU],
    FR: new Float32Array(NF), FP: new Float32Array(NF), FW: new Float32Array(NF), FC: new Float32Array(NF),
    RHO: new Float32Array(NP), CR: new Float32Array(NP), CG: new Float32Array(NP), CB: new Float32Array(NP), TMP: new Float32Array(NP),
    WR: new Float32Array(NP), WG: new Float32Array(NP), WB: new Float32Array(NP),
    rgb: new Float32Array(3),
  };
  s.ar = mulberry(floor(rnd() * 4294967296));
  const o0 = (rnd() < 0.5 ? -1 : 1) * (0.12 + 0.18 * rnd());
  s.p[0] = Math.asin(cl((o0 - 0.22 * sin(s.p[1])) / 0.5, -1, 1));
  if (rnd() < 0.5) s.p[0] = PI - s.p[0];
  s.p[2] = (rnd() < 0.5 ? 0 : PI) + 0.4 * (rnd() - 0.5);
  s.p[3] = (rnd() < 0.5 ? 0 : PI) + 0.4 * (rnd() - 0.5);
  for (let i = 0; i < NF; i++) {
    s.FR[i] = 35 + 225 * rnd();
    s.FP[i] = rnd() * TAU;
    const b = rnd();
    s.FW[i] = 0.7 + 2.4 * b * b * b * b;
    s.FC[i] = rnd();
  }
  params.s = s;
}

function readKnobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
  s.v0T = V0 * exp(0.28 * cl(s.k[3], -1, 1));
}

// seconds in units of the orbital period at Halo 0: a slow halo gets longer head starts
const tfOf = (s) => cl((V0 / s.v0) * (V0 / s.v0), 0.55, 1.8);

const rtOf = (s) => 4 * pow(1.59, cl(s.k[2], -1, 1));

// ---- clusters
// a new cluster is made hidden, run through its head start a few steps a frame, and then let in
function prepare(s, first) {
  const slot = s.nextSlot;
  s.nextSlot = (slot + 1) % NC;
  for (let i = 0; i < s.used; i++) if (s.G[i] === slot) s.G[i] = -1;
  // halo clusters go round either way, so each new one picks its sense of rotation
  const v0 = s.v0, L = LREF * (0.86 + 0.28 * rnd()), sgn = rnd() < 0.5 ? -1 : 1;
  const rg = L / v0, e = 0.04 + 0.13 * rnd(), eta = rnd() * TAU, kap = 1.4142 * v0 / rg;
  const R0 = rg * (1 - e * cos(eta));
  s.cls[slot] = {
    x: R0, y: 0, vx: e * kap * rg * sin(eta), vy: sgn * L / R0, sgn,
    m: 1, age: 0, life: first ? s.pre + 90 : 190 + 80 * rnd(), rtf: 0.9 + 0.2 * rnd(), rel: 0,
    alive: true, fading: false, hidden: !first, w: 1, rg,
    // the window's tilt and scale for this cluster, and its tint (a cluster of other metallicity)
    g0: first ? 0.42 : 0.16 + 0.54 * rnd(), zm: first ? 1.3 : 1.15 + 0.35 * rnd(), hu: first ? 0 : 0.12 * (rnd() - 0.5),
  };
  return slot;
}

function letIn(s, slot) {
  const c = s.cls[slot];
  if (s.cur >= 0) s.cls[s.cur].fading = true;
  s.fi = -1;
  c.hidden = false;
  s.cur = slot;
  // turn the new cluster and its tails to an azimuth a little ahead of or behind the window
  const want = s.psi + (rnd() < 0.5 ? -1 : 1) * (0.45 + 0.4 * rnd());
  const th = wrap(want - atan2(c.y, c.x)), ct = cos(th), st = sin(th);
  let x = c.x, y = c.y, vx = c.vx, vy = c.vy;
  c.x = x * ct - y * st; c.y = x * st + y * ct; c.vx = vx * ct - vy * st; c.vy = vx * st + vy * ct;
  const { X, Y, VX, VY, G } = s;
  for (let i = 0; i < s.used; i++) {
    if (G[i] !== slot) continue;
    x = X[i]; y = Y[i]; vx = VX[i]; vy = VY[i];
    X[i] = x * ct - y * st; Y[i] = x * st + y * ct; VX[i] = vx * ct - vy * st; VY[i] = vx * st + vy * ct;
  }
}

function release(s, c, slot, h) {
  const R = sqrt(c.x * c.x + c.y * c.y);
  const rt = rtOf(s) * c.rtf * cbrt(max(c.m, 0.03)) * pow(R / c.rg, 0.667);
  c.rel += NREL / c.life * (c.rg / R) * (c.rg / R) * h;
  const ux = c.x / R, uy = c.y / R, om = (c.x * c.vy - c.y * c.vx) / (R * R);
  const { X, Y, VX, VY, G } = s;
  while (c.rel >= 2) {
    c.rel -= 2;
    for (let side = -1; side <= 1; side += 2) {
      const i = s.ring;
      s.ring = (i + 1) % POOL;
      if (i >= s.used) s.used = i + 1;
      const fl = rnd() < 0.2 ? 2.2 : 1;
      const dr = side * rt * (1 + 0.2 * gauss()), dt = 0.25 * rt * gauss();
      const ox = ux * dr - uy * dt, oy = uy * dr + ux * dt, sg = 0.3 * om * rt * fl;
      X[i] = c.x + ox; Y[i] = c.y + oy;
      VX[i] = c.vx - om * oy + sg * gauss();
      VY[i] = c.vy + om * ox + sg * gauss();
      G[i] = slot;
      s.TR[i] = c.age;
    }
  }
}

// one symplectic Euler step of the clusters and the stars (only one slot when only >= 0)
function advance(s, h, only) {
  const v02 = s.v0 * s.v0;
  const sb = s.sub, son = sb.on && only < 0;
  let sgm = 0, se2 = 1;
  if (son) {
    const k2 = cl(s.k[1], 0, 4), rs = 5.5 * pow(10, (k2 - 2) / 4);
    sgm = 95 * pow(10, (k2 - 2) / 2) * v02 / (V0 * V0);   // subhalos scale with the halo
    se2 = rs * rs + sb.bz * sb.bz;
  }
  // clusters, live and dead (a dead one is a point that only marks the orbit)
  let cx = 0, cy = 0, cgm = 0, ce2 = 1;
  const skip = s.skip;
  for (let q = 0; q < NC; q++) {
    const c = s.cls[q];
    skip[q] = !c || (only >= 0 ? q !== only : c.hidden) ? 1 : 0;
    if (skip[q]) continue;
    const r2 = c.x * c.x + c.y * c.y, f = v02 / (RC2 + r2);
    c.vx -= f * c.x * h; c.vy -= f * c.y * h;
    c.x += c.vx * h; c.y += c.vy * h;
    c.rg = abs(c.x * c.vy - c.y * c.vx) / s.v0;
    if (c.fading) c.w *= exp(-h / 40);
    c.age += h;
    if (c.alive) {
      c.m = 1 - c.age / c.life;
      if (c.m <= 0) { c.alive = false; c.m = 0; }
      else {
        release(s, c, q, h);
        const R = sqrt(r2), rt = rtOf(s) * c.rtf * cbrt(c.m) * pow(R / c.rg, 0.667);
        cx = c.x; cy = c.y; cgm = 2 * v02 * rt * rt * rt / r2; ce2 = 0.25 * rt * rt;
      }
    }
  }
  const { X, Y, VX, VY, G } = s;
  const n = s.used;
  for (let i = 0; i < n; i++) {
    const g = G[i];
    if (g < 0 || skip[g]) continue;
    const x = X[i], y = Y[i], f = v02 / (RC2 + x * x + y * y);
    let ax = -f * x, ay = -f * y;
    if (cgm > 0) {
      const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy + ce2, q = cgm / (d2 * sqrt(d2));
      ax -= q * dx; ay -= q * dy;
    }
    if (son) {
      const dx = x - sb.x, dy = y - sb.y, d2 = dx * dx + dy * dy + se2, q = sgm / (d2 * sqrt(d2));
      ax -= q * dx; ay -= q * dy;
    }
    const vx = VX[i] + ax * h, vy = VY[i] + ay * h;
    VX[i] = vx; VY[i] = vy;
    X[i] = x + vx * h; Y[i] = y + vy * h;
  }
}

// ---- the window: it turns round the galactic centre with the newest cluster
// how far along the orbit (model lengths) the window looks ahead of the cluster; two slow sines, phased so that at the
// first frame the cluster is inside
const offOf = (s, t) => (70 / s.zm) * (0.5 * sin(TAU * (t - s.pre) / 97 + s.p[0]) + 0.22 * sin(TAU * (t - s.pre) / 53.3 + s.p[1]));
function camera(s, h) {
  const c = s.cls[s.cur], t = s.t;
  const off = offOf(s, t);
  const dl = 9 * sin(TAU * (t - s.pre) / 67 + s.p[2]);
  s.g0 += (c.g0 - s.g0) * min(1, h / 12);
  s.zm += (c.zm - s.zm) * min(1, h / 12);
  s.gam = s.g0 + 0.2 * sin(TAU * (t - s.pre) / 113 + s.p[3]);
  // the last ten seconds before the first frame hold the window tight on its aim
  const tight = t > s.pre - 10 && t <= s.pre;
  let d = wrap(atan2(c.y, c.x) + off / c.rg - s.psi);
  let Dt = 0.3 * c.rg + 0.7 * sqrt(c.x * c.x + c.y * c.y) - 5 + dl;
  // after a crossing the window drifts over to the star the subhalo went through, and back
  if (s.fi >= 0) {
    s.ft += h;
    if (s.G[s.fi] !== s.fg || s.ft > s.fl) s.fi = -1;
    else { s.fx = s.X[s.fi]; s.fy = s.Y[s.fi]; }
  }
  s.wf += ((s.fi >= 0 && s.ft > LEAD ? 1 : 0) - s.wf) * min(1, h / 9);
  if (s.wf > 0.001) {
    // two thirds of the way to the gap, so the denser stream toward the cluster stays in view beside it
    const fx = s.fx, fy = s.fy, wf = 0.65 * s.wf * s.wf * (3 - 2 * s.wf);
    d += (wrap(atan2(fy, fx) - s.psi) - d) * wf;
    Dt += (sqrt(fx * fx + fy * fy) + dl - Dt) * wf;
  }
  s.D += (Dt - s.D) * min(1, h / (tight ? 1 : 6));
  s.om += (c.sgn * s.v0 / c.rg - s.om) * min(1, h / 6);
  s.psi += (s.om + d / (tight ? 1 : 12)) * h;
}

function mapping(s) {
  const cp = cos(s.psi), sp = sin(s.psi), cg = cos(s.gam), sg = sin(s.gam), D = s.D, ZM = s.zm;
  // panel = c + ZM (a u_r + b u_t), a = g.e_r - D, b = g.e_t, u_r = (cg, -sg), u_t = (sg, cg)
  return {
    axx: ZM * (cp * cg - sp * sg), axy: ZM * (sp * cg + cp * sg), bx: 32 - ZM * D * cg,
    ayx: ZM * (-cp * sg - sp * cg), ayy: ZM * (-sp * sg + cp * cg), by: 64 + ZM * D * sg,
  };
}

// choose the star a subhalo will cross, LEAD seconds ahead, inside the panel
function aim(s) {
  const c = s.cls[s.cur], ar = s.ar;
  const ccx = c.x, ccy = c.y, comg = (c.x * c.vy - c.y * c.vx) / (c.x * c.x + c.y * c.y) * LEAD;
  // the window as it will be at the crossing; before the first frame, the window of the first frame
  const psi = s.psi;
  s.psi = s.t < s.pre ? atan2(c.y, c.x) + comg + offOf(s, s.pre) / c.rg : psi + s.om * LEAD;
  const m = mapping(s);
  s.psi = psi;
  const { X, Y, VX, VY, G } = s;
  let pick = -1, cnt = 0, pxs = 0, pys = 0;
  const qx = ccx * cos(comg) - ccy * sin(comg), qy = ccx * sin(comg) + ccy * cos(comg);
  for (let i = 0; i < s.used; i++) {
    const g = G[i];
    if (g < 0 || s.cls[g].w < 0.5 || s.cls[g].hidden) continue;
    const x = X[i], y = Y[i], r2 = x * x + y * y, a = (x * VY[i] - y * VX[i]) / r2 * LEAD;
    const ca = cos(a), sa = sin(a), x1 = x * ca - y * sa, y1 = x * sa + y * ca;
    const px = m.axx * x1 + m.axy * y1 + m.bx, py = m.ayx * x1 + m.ayy * y1 + m.by;
    if (px < 10 || px > 54 || py < 14 || py > 114) continue;
    if (c.alive && (x1 - qx) * (x1 - qx) + (y1 - qy) * (y1 - qy) < 1225) continue;
    cnt++;
    if (ar() * cnt < 1) { pick = i; pxs = x1; pys = y1; }
  }
  if (pick < 0) return false;
  const x = X[pick], y = Y[pick], a = (x * VY[pick] - y * VX[pick]) / (x * x + y * y) * LEAD;
  const vx = VX[pick], vy = VY[pick], vl = sqrt(vx * vx + vy * vy) + 1e-6;
  const tx = (vx * cos(a) - vy * sin(a)) / vl, ty = (vx * sin(a) + vy * cos(a)) / vl;
  const al = (ar() < 0.5 ? -1 : 1) * (40 + 40 * ar()) * PI / 180;
  const dx = tx * cos(al) - ty * sin(al), dy = tx * sin(al) + ty * cos(al), w = WSUB * s.v0;
  const sb = s.sub;
  sb.on = true; sb.t = 0; sb.T = 2 * LEAD;
  sb.vx = w * dx; sb.vy = w * dy;
  sb.x = pxs - sb.vx * LEAD; sb.y = pys - sb.vy * LEAD;
  sb.bz = 4 * ar();
  if (s.t > s.pre && G[pick] === s.cur) { s.fi = pick; s.fg = G[pick]; s.ft = 0; s.fl = 45 + 30 * ar(); }
  return true;
}

function step(s, h) {
  s.t += h;
  s.v0 += (s.v0T - s.v0) * min(1, h / 1.5);
  const sb = s.sub;
  if (sb.on) {
    sb.x += sb.vx * h; sb.y += sb.vy * h; sb.t += h;
    if (sb.t > sb.T) sb.on = false;
  }
  advance(s, h, -1);
  camera(s, h);
  for (let q = 0; q < NC; q++) {
    const c = s.cls[q];
    if (c && c.fading && c.w < 0.01) {
      for (let i = 0; i < s.used; i++) if (s.G[i] === q) s.G[i] = -1;
      s.cls[q] = null;
    }
  }
  // the next subhalo
  if (!sb.on && s.t >= s.nextHit - LEAD) {
    if (aim(s)) {
      s.hits.shift();
      s.nextHit = s.hits.length ? s.hits[0] : s.t + LEAD + 30 + 60 * s.ar();
    } else s.nextHit += s.t < s.pre ? 1 : 4;
  }
  // a new cluster some seconds after the last one has gone, its head start spread over the wait
  if (!s.cls[s.cur].alive) {
    if (s.nx < 0) {
      s.nx = prepare(s, false);
      s.waitT = 8 + 18 * rnd();
      s.ffLeft = (55 + 25 * rnd()) * tfOf(s);
    }
    s.waitT -= h;
    const n = s.waitT > h ? Math.ceil(s.ffLeft / HPRE / (s.waitT / h)) : Math.ceil(s.ffLeft / HPRE);
    for (let q = 0; q < n && s.ffLeft > 0; q++) {
      advance(s, HPRE, s.nx);
      s.ffLeft -= HPRE;
    }
    if (s.waitT <= 0 && s.ffLeft <= 0) {
      letIn(s, s.nx);
      s.nx = -1;
    }
  }
  // field stars on circular orbits
  const FR = s.FR, FP = s.FP, v0 = s.v0;
  for (let i = 0; i < NF; i++) FP[i] += v0 / FR[i] * h;
}

function init(s) {
  s.init = true;
  s.v0 = s.v0T;
  const tf = tfOf(s);
  s.pre = PRE * tf;
  s.hits = [40 * tf, 80 * tf, 105 * tf];
  s.nextHit = s.hits[0];
  s.cur = prepare(s, true);
  const c = s.cls[s.cur];
  s.psi = atan2(c.y, c.x) + offOf(s, 0) / c.rg;
  s.D = 0.3 * c.rg + 0.7 * sqrt(c.x * c.x + c.y * c.y) - 5;
  s.gam = 0.42 + 0.2 * sin(TAU * -s.pre / 113 + s.p[3]);
  s.om = c.sgn * s.v0 / c.rg;
  const n = Math.round(s.pre / HPRE);
  for (let q = 0; q < n; q++) {
    if (s.sub.on) { step(s, HPRE / 2); step(s, HPRE / 2); }
    else step(s, HPRE);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  readKnobs(s, input);
  if (!s.init) init(s);
  s.acc += cl(dt || 0, 0, 0.1);
  let guard = 0;
  while (s.acc >= HLIVE && guard++ < 3) {
    s.acc -= HLIVE;
    step(s, HLIVE);
  }
}

// ---- drawing
function hsv(h, sat, v, o, k) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - sat), q = v * (1 - sat * f), t = v * (1 - sat * (1 - f));
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  o[k] = r; o[k + 1] = g; o[k + 2] = b;
}

function deposit(s, px, py, w, r, g, b) {
  const x = px - 0.5, y = py - 0.5, ix = floor(x), iy = floor(y);
  if (ix < -1 || ix > W - 1 || iy < -1 || iy > H - 1) return;
  const fx = x - ix, fy = y - iy;
  const { RHO, CR, CG, CB } = s;
  for (let q = 0; q < 4; q++) {
    const xx = ix + (q & 1), yy = iy + (q >> 1);
    if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
    const ww = w * ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy), o = yy * W + xx;
    RHO[o] += ww; CR[o] += ww * r; CG[o] += ww * g; CB[o] += ww * b;
  }
}

// two passes of a box of 2R+1 LED each way, for the unresolved light round the stream
function wide(a, t, R) {
  const n = 2 * R + 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let acc = 0;
      for (let x = -R; x <= R; x++) if (x >= 0 && x < W) acc += a[o + x];
      for (let x = 0; x < W; x++) {
        t[o + x] = acc / n;
        const xo = x - R, xi = x + R + 1;
        if (xo >= 0) acc -= a[o + xo];
        if (xi < W) acc += a[o + xi];
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) if (y >= 0 && y < H) acc += t[y * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc / n;
        const yo = y - R, yi = y + R + 1;
        if (yo >= 0) acc -= t[yo * W + x];
        if (yi < H) acc += t[yi * W + x];
      }
    }
  }
}

function blur(a, t) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      const l2 = x > 1 ? a[o + x - 2] : 0, l1 = x > 0 ? a[o + x - 1] : 0, r1 = x < W - 1 ? a[o + x + 1] : 0, r2 = x < W - 2 ? a[o + x + 2] : 0;
      t[o + x] = (l2 + r2 + 4 * (l1 + r1) + 6 * a[o + x]) * 0.0625;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const u2 = y > 1 ? t[o - 2 * W] : 0, u1 = y > 0 ? t[o - W] : 0, d1 = y < H - 1 ? t[o + W] : 0, d2 = y < H - 2 ? t[o + 2 * W] : 0;
      a[o] = (u2 + d2 + 4 * (u1 + d1) + 6 * t[o]) * 0.0625;
    }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (!s.init) init(s);
  const { RHO, CR, CG, CB, TMP, rgb, X, Y, VX, VY, G } = s;
  RHO.fill(0); CR.fill(0); CG.fill(0); CB.fill(0);
  const m = mapping(s), v0 = s.v0, v02 = v0 * v0;
  const hue = s.k[0], TR = s.TR;
  const ec = [], en = [], gw = [], gh = [], ga = [];
  for (let q = 0; q < NC; q++) {
    const c = s.cls[q];
    gh.push(c ? hue + c.hu : hue);
    ga.push(c ? c.age : 0);
    if (!c || c.hidden) { gw.push(0); ec.push(0); en.push(1); continue; }
    ec.push(0.5 * (c.vx * c.vx + c.vy * c.vy) + 0.5 * v02 * log(RC2 + c.x * c.x + c.y * c.y));
    en.push(2 * v02 * rtOf(s) * c.rtf / c.rg);
    gw.push(c.w);
  }
  for (let i = 0; i < s.used; i++) {
    const g = G[i];
    if (g < 0 || gw[g] === 0) continue;
    const x = X[i], y = Y[i];
    const px = m.axx * x + m.axy * y + m.bx, py = m.ayx * x + m.ayy * y + m.by;
    if (px < -2 || px > W + 2 || py < -2 || py > H + 2) continue;
    // colour by orbital energy relative to the cluster: leading (bound tighter) gold, trailing blue,
    // pale where it is close to the cluster's own and deeper the longer ago the star got away
    const e = cl((0.5 * (VX[i] * VX[i] + VY[i] * VY[i]) + 0.5 * v02 * log(RC2 + x * x + y * y) - ec[g]) / en[g] / 1.1, -1, 1);
    const u = 1 - exp(-(ga[g] - TR[i]) / 90), a = pow(abs(e), 0.6);
    hsv(e < 0 ? 0.14 - 0.045 * u + gh[g] : 0.55 + 0.07 * u + gh[g], 0.1 + 0.8 * a * (0.75 + 0.25 * u), 1, rgb, 0);
    deposit(s, px, py, gw[g], rgb[0], rgb[1], rgb[2]);
  }
  // field stars
  const { FR, FP, FW, FC } = s;
  for (let i = 0; i < NF; i++) {
    const a = wrap(FP[i] - s.psi);
    if (a > 1.3 || a < -1.3) continue;
    const r = FR[i], x = r * cos(FP[i]), y = r * sin(FP[i]);
    const px = m.axx * x + m.axy * y + m.bx, py = m.ayx * x + m.ayy * y + m.by;
    if (px < -2 || px > W + 2 || py < -2 || py > H + 2) continue;
    const t = FC[i];
    deposit(s, px, py, FW[i], 0.75 + 0.25 * t, 0.8, 1 - 0.3 * t);
  }
  blur(RHO, TMP); blur(CR, TMP); blur(CG, TMP); blur(CB, TMP);
  const { WR, WG, WB } = s;
  WR.set(CR); WG.set(CG); WB.set(CB);
  wide(WR, TMP, 4); wide(WG, TMP, 4); wide(WB, TMP, 4);
  // the cluster and the subhalo in panel coordinates
  const c = s.cls[s.cur];
  let kx = 0, ky = 0, ka = 1, kb = 0;
  if (c.alive) {
    kx = m.axx * c.x + m.axy * c.y + m.bx; ky = m.ayx * c.x + m.ayy * c.y + m.by;
    ka = 1.2 + 0.3 * rtOf(s) * c.rtf * cbrt(c.m); kb = 0.5 + 0.7 * sqrt(c.m);
  }
  const sb = s.sub;
  let hx = 0, hy = 0, hr = 1, hb = 0;
  if (sb.on) {
    hx = m.axx * sb.x + m.axy * sb.y + m.bx; hy = m.ayx * sb.x + m.ayy * sb.y + m.by;
    const k2 = cl(s.k[1], 0, 4), rs = 5.5 * pow(10, (k2 - 2) / 4);
    hr = 1.5 + 0.9 * min(rs, 10);
    const e = sin(PI * sb.t / sb.T);
    hb = 0.7 * e * e * (0.5 + 0.5 * k2 / 4);
  }
  const gx = m.bx, gy = m.by; // the galactic centre on the panel
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const o = py * W + px, fx = px + 0.5, fy = py + 0.5;
      const dgx = fx - gx, dgy = fy - gy, gl = 1 / (1 + (dgx * dgx + dgy * dgy) / 4900);
      let r = 3 + 18 * gl, g = 5 + 13 * gl, b = 17 + 44 * gl;
      // the unresolved light of the stream, a soft haze about ten LED wide
      const wr = WR[o], wg = WG[o], wb2 = WB[o], wl = wr + wg + wb2;
      if (wl > 1e-4) {
        const k = 150 * (1 - exp(-1.2 * wl)) / wl;
        r += wr * k; g += wg * k; b += wb2 * k;
      }
      const rho = RHO[o];
      if (rho > 1e-5) {
        const L = 1 - pow(1 + 0.6 * rho, -1.6), iv = 255 * L / rho, wb = 0.5 * sm(2.5, 7, rho);
        r += (CR[o] * iv) * (1 - wb) + 255 * L * wb;
        g += (CG[o] * iv) * (1 - wb) + 245 * L * wb;
        b += (CB[o] * iv) * (1 - wb) + 225 * L * wb;
      }
      if (kb > 0) {
        const dx = fx - kx, dy = fy - ky, q = (dx * dx + dy * dy) / (ka * ka), p = kb / ((1 + q) * (1 + q)) + 0.22 * kb * exp(-q / 12);
        r += 255 * p; g += 245 * p; b += 215 * p;
      }
      if (hb > 0) {
        const dx = fx - hx, dy = fy - hy, p = hb * exp(-(dx * dx + dy * dy) / (2 * hr * hr));
        r += 110 * p; g += 50 * p; b += 210 * p;
      }
      display.setPixel(px, py, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
    }
}
