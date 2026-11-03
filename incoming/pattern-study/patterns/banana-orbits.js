// ===== Patternflow pattern =====
// Title:   Banana Orbits
// Family:  physics
// Idea:    Guiding centres of charged particles are integrated through the field of a tall D-shaped tokamak cross-section, so passing particles circle whole flux surfaces shifted a little in or out while trapped ones bounce between mirror points on the low-field side and trace bananas, every now and then a collision kicks one across the boundary onto a new orbit, and a particle whose orbit reaches the wall is lost with a flash.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: banana orbits of trapped particles in neoclassical transport (Alexander Galeev and Roald Sagdeev, ZhETF 1967, Soviet Physics JETP 1968), in the field of a tokamak (Igor Tamm and Andrei Sakharov, 1951); pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pitch=-30..30, Drift=0.01..0.12
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 passing particles are teal to azure and dimmer, trapped ones violet to pink (pinker the deeper they sit in the well), the flux surfaces a dim blue, brighter on the high-field side at the left; at 0.5 passing particles go red, trapped ones green and the surfaces a dim olive.
// Knob 2: Speed. At 2 a particle runs 1000 LEDs a second along its field line, so a trapped particle traces its whole banana, out and back, in 3 to 5 s, and a passing one circles its surface in 1.2 to 2.6 s. At 0.2 ten times slower, at 3 half as fast again. Trails fade on the particles' own clock, so at every speed they hold about half a banana at full strength and the rest fading.
// Knob 3: Pitch. Turns every particle's launch pitch angle, measured at the outer midplane from its own trapped-passing boundary, by this many degrees. At 0 the ten particles start from 16 degrees below their boundary to 24 above it, so 4 pass and 6 are trapped, and collisions trade a few each way. At -30 all start passing and the panel is nested teal rings; at +30 all are trapped deep in the well and their bananas shrink to short pink arcs packed on the outer side. A turned knob relaunches the particles one at a time.
// Knob 4: Drift. The Larmor radius at the major radius as a share of the minor radius, which sets every drift. At the opening 0.06 a banana is 3 to 9 LEDs wide where it crosses the outer midplane, passing orbits sit 3 to 5 LEDs off their surface on the inner side, and a barely trapped particle launched outside rho 0.62 reaches the wall within one bounce. At 0.01 the bananas close to arcs under 2 LEDs wide along the surfaces; at 0.09 every trapped particle launched outside rho 0.55 is lost but the deepest, and at 0.12 the fat orbits flash against the top of the wall every second or so, a new particle taking each one's place.

// The field. The panel is the poloidal cross-section of an axisymmetric
// torus, R the major radius to the right and Z up, lengths in LEDs. The
// geometric centre of the plasma sits at R0 = 81, the minor radius is 27
// across and 2.1 times that tall, with a triangularity that pulls the top
// and bottom tips 8 LEDs inward and a Shafranov shift that moves the
// magnetic axis 3 LEDs outward. The toroidal field is B0 R0 / R with
// B0 = 1, so it is twice as strong at the inner wall as at the outer. The
// poloidal field is (grad psi x grad phi): psi is a function of the shaped
// minor radius rho, psi = a^2 ln(1 + c rho^2 / q0) / (2 c) with nominal
// q0 = 0.5 and c = 1.1, which with the elongation gives a safety factor q
// of 1.0 on the axis, 1.65 at mid radius and 3.5 near the edge, measured by
// following field lines round.
//
// The particles. Units with mass, charge and speed all 1, energy E = 1/2
// and magnetic moment mu = v_perp^2 / (2 B) conserved. The guiding-centre
// equations (Littlejohn's, with the current term dropped because it has no
// part in the poloidal plane here, and the common factor B*_par taken as B,
// which only changes the clock) are
//
//   dX/dt     = v_par b + rho_s (v_par^2 + mu B) (b x grad B) / B^2
//   dv_par/dt = -mu (b . grad B),
//
// rho_s the Larmor radius at B0 for speed 1, the Drift knob times 27. The
// drift (b x grad B) is nearly straight up, the grad-B and curvature drift
// v_d = (v_par^2 + v_perp^2 / 2) / (Omega R). The poloidal angle advances
// with v_par B_pol / B, about v_par / (q R). Both E and the canonical
// toroidal momentum psi + rho_s v_par B0 R0 / B are exact invariants of
// these equations; integrated with RK4 in steps of 3 LEDs of path, both
// held to a few parts in ten million over 30 s and some 20 bounces.
//
// A particle whose mu B reaches E before the high-field side reflects at
// that mirror point and is trapped; its up-drift on the outer leg and
// down-drift on the way back (v_par has changed sign) open its path into a
// banana. Passing particles go all the way round, their orbits shifted out
// or in depending on whether they run with the field or against it.
// Collisions turn a particle's velocity through 20 degrees in a random
// direction, once every 10 s on average at Speed 2, so particles near the
// boundary switch between the two kinds and step to a new orbit a banana
// width away: the random walk of neoclassical transport.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, log, sin, cos, asin, exp, round, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Geometry in LEDs, and the panel position of the geometric centre.
const A = 27, KAP = 2.1, TRI = 0.3, SH = 3, R0 = 81, CX = 31.5, CY = 63.5;
const Q0 = 0.5, QC = 1.1;
// Particles; path length per second at Speed 1; RK4 step; trail time
// constant, mean time between collisions and the turn a collision gives, in
// units of path; how long a lost particle's slot stays empty.
const NP = 10, RATE = 500, STEP = 3, TAU = 1700, COLL = 10000, KICK = 0.35, DEAD = 600;
const E = 0.5;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Shaped minor radius: 0 on the magnetic axis, 1 on the last closed surface.
function rho(R, Z) {
  const z = Z / KAP, xt = R - R0 + (TRI * z * z) / A;
  const r0 = sqrt(xt * xt + z * z) / A;
  const s = r0 < 1 ? SH * (1 - r0 * r0) * (1 - r0 * r0) : 0;
  const xs = xt - s;
  return sqrt(xs * xs + z * z) / A;
}
const psi = (R, Z) => {
  const r = rho(R, Z);
  return (A * A * log(1 + (QC * r * r) / Q0)) / (2 * QC);
};

// B_R, B_Z, B_phi and |B| at a point.
const HF = 0.02, HB = 0.05;
function field(R, Z, o) {
  o[0] = -(psi(R, Z + HF) - psi(R, Z - HF)) / (2 * HF * R);
  o[1] = (psi(R + HF, Z) - psi(R - HF, Z)) / (2 * HF * R);
  o[2] = R0 / R;
  o[3] = sqrt(o[0] * o[0] + o[1] * o[1] + o[2] * o[2]);
  return o;
}
const fa = [0, 0, 0, 0], fb = [0, 0, 0, 0];
const modB = (R, Z) => field(R, Z, fb)[3];

// The guiding-centre equations: dR/dt, dZ/dt, dv_par/dt.
function deriv(R, Z, vp, mu, rs, out) {
  const f = field(R, Z, fa), B = f[3];
  const gR = (modB(R + HB, Z) - modB(R - HB, Z)) / (2 * HB);
  const gZ = (modB(R, Z + HB) - modB(R, Z - HB)) / (2 * HB);
  const D = (rs * (vp * vp + mu * B) * (f[2] / B)) / B;
  out[0] = (vp * f[0] + D * gZ) / B;
  out[1] = (vp * f[1] - D * gR) / B;
  out[2] = (-mu * (f[0] * gR + f[1] * gZ)) / B;
}

// Where the surface rho = r crosses the midplane, outside (+1) or inside (-1).
function midplane(r, side) {
  let lo = 0, hi = 1.6 * A;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (rho(R0 + side * m, 0) < r) lo = m;
    else hi = m;
  }
  return R0 + side * lo;
}

export function setup(params) {
  const F = (n) => new Float64Array(n);
  const S = (params.s = {
    hue: 0, speed: 2, pitch: 0, drift: 0.06, warm: false, frame: 0,
    R: F(NP), Z: F(NP), vp: F(NP), mu: F(NP), off: F(NP), band: F(NP), sg: new Int8Array(NP), k3: F(NP),
    trap: new Uint8Array(NP), shade: F(NP), bIn: F(NP), bOut: F(NP), dead: F(NP), coll: F(NP),
    tr: new Float32Array(N), tg: new Float32Array(N), tb: new Float32Array(N),
    surf: new Float32Array(N), wall: new Float32Array(N), bf: new Float32Array(N),
    k: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], c: [0, 0, 0],
  });
  // Each slot has its own launch radius band, from rho = 0.3 to 0.7, and
  // its own launch offset from the trapped-passing boundary, -16 to +24
  // degrees, the two shuffled apart; the direction along the field
  // alternates.
  const shuffled = () => {
    const o = [];
    for (let i = 0; i < NP; i++) o.push(i);
    for (let i = NP - 1; i > 0; i--) {
      const j = floor(Math.random() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    return o;
  };
  const po = shuffled(), ro = shuffled();
  for (let i = 0; i < NP; i++) {
    S.off[i] = ((-16 + (40 * po[i]) / (NP - 1)) * PI) / 180;
    S.band[i] = ro[i];
    S.sg[i] = i % 2 ? -1 : 1;
  }
  // Flux surfaces at rho = 0.2 to 0.8, and the last closed one, as lines
  // about one LED wide; brightness follows |B|, so the high-field side at the
  // left is brighter.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const R = R0 + x - CX, Z = CY - y, p = y * W + x, r = rho(R, Z);
      const g = sqrt((rho(R + 0.1, Z) - rho(R - 0.1, Z)) ** 2 + (rho(R, Z + 0.1) - rho(R, Z - 0.1)) ** 2) / 0.2;
      const d = (u) => abs(r - u) / g;
      let s = 0;
      for (const u of [0.2, 0.4, 0.6, 0.8]) s = max(s, 1 - d(u) / 0.75);
      S.surf[p] = s * (R0 / R) ** 1.3;
      S.wall[p] = max(0, 1 - d(1) / 0.9);
      S.bf[p] = R0 / R;
      // The magnetic axis, a small dot.
      if (r < 0.05) S.surf[p] = max(S.surf[p], 1.4 * (1 - r / 0.05));
    }
}

// Pitch and kind of particle i from its current state: trapped when mu B
// reaches E on the inside of its surface; shade 0 at the boundary and 1 at
// the deep end of either kind.
function classify(S, i) {
  const r = cl(rho(S.R[i], S.Z[i]), 0.05, 0.98);
  const bIn = modB(midplane(r, -1), 0), bOut = modB(midplane(r, 1), 0);
  S.bIn[i] = bIn;
  S.bOut[i] = bOut;
  const m = S.mu[i];
  if (m * bIn >= E) {
    S.trap[i] = 1;
    S.shade[i] = cl((m * bOut - E * (bOut / bIn)) / (E * (1 - bOut / bIn)), 0, 1);
  } else {
    S.trap[i] = 0;
    S.shade[i] = cl(1 - (m * bIn) / E, 0, 1);
  }
}

function launch(S, i) {
  const r = 0.3 + (0.4 * (S.band[i] + Math.random())) / NP;
  const ro = midplane(r, 1), bo = modB(ro, 0), bi = modB(midplane(r, -1), 0);
  const thc = asin(sqrt(bo / bi));
  const th = cl(thc + S.off[i] + (S.pitch * PI) / 180, 0.1, 1.4);
  S.R[i] = ro;
  S.Z[i] = 0;
  S.vp[i] = S.sg[i] * cos(th);
  S.mu[i] = (sin(th) * sin(th)) / (2 * bo);
  S.k3[i] = S.pitch;
  S.dead[i] = 0;
  S.coll[i] = -COLL * log(1 - Math.random());
  classify(S, i);
}

function colour(S, i, v) {
  if (S.trap[i]) return hsv(S.hue + 0.79 + 0.11 * S.shade[i], 0.78, v, S.c);
  return hsv(S.hue + 0.54 - 0.08 * S.shade[i], 0.85, 0.62 * v, S.c);
}

// Max-blend a colour into the trails at the LED nearest a point.
function splat(S, R, Z, c, w) {
  const x = round(R - R0 + CX), y = round(CY - Z);
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  if (c[0] * w > S.tr[p]) S.tr[p] = min(1, c[0] * w);
  if (c[1] * w > S.tg[p]) S.tg[p] = min(1, c[1] * w);
  if (c[2] * w > S.tb[p]) S.tb[p] = min(1, c[2] * w);
}
const WHITE = [1, 1, 1];
function flash(S, R, Z, rad) {
  for (let j = -rad; j <= rad; j++)
    for (let k = -rad; k <= rad; k++) splat(S, R + k, Z + j, WHITE, 0.9 / (1 + j * j + k * k));
}

// Advance every particle by `len` units of path, laying trails.
function advance(S, len) {
  const n = Math.ceil(len / STEP), h = len / n, rs = S.drift * A, [k1, k2, k3, k4] = S.k;
  const fade = exp(-len / TAU);
  for (let p = 0; p < N; p++) {
    S.tr[p] *= fade;
    S.tg[p] *= fade;
    S.tb[p] *= fade;
  }
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < NP; i++) {
      if (S.dead[i] > 0) {
        S.dead[i] -= h;
        if (S.dead[i] <= 0) launch(S, i);
        continue;
      }
      const R = S.R[i], Z = S.Z[i], vp = S.vp[i], mu = S.mu[i];
      deriv(R, Z, vp, mu, rs, k1);
      deriv(R + 0.5 * h * k1[0], Z + 0.5 * h * k1[1], vp + 0.5 * h * k1[2], mu, rs, k2);
      deriv(R + 0.5 * h * k2[0], Z + 0.5 * h * k2[1], vp + 0.5 * h * k2[2], mu, rs, k3);
      deriv(R + h * k3[0], Z + h * k3[1], vp + h * k3[2], mu, rs, k4);
      const nR = R + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      const nZ = Z + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      const nv = vp + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      S.R[i] = nR;
      S.Z[i] = nZ;
      S.vp[i] = nv;
      if (rho(nR, nZ) >= 1) {
        // Lost to the wall.
        flash(S, nR, nZ, 2);
        S.dead[i] = DEAD;
        continue;
      }
      if (vp * nv < 0) {
        // A mirror point: the tip of a banana, and proof of a trapped orbit.
        if (!S.trap[i]) {
          S.trap[i] = 1;
          S.shade[i] = 0;
        }
        flash(S, nR, nZ, 1);
      } else if (S.trap[i] && Z * nZ <= 0 && nR < R0) {
        // Through the inner midplane: only a passing particle gets there.
        S.trap[i] = 0;
        S.shade[i] = 0;
      }
      colour(S, i, 1);
      splat(S, nR, nZ, S.c, 1);
      S.coll[i] -= h;
      if (S.coll[i] <= 0) {
        // A collision turns the velocity through KICK in a random direction.
        const b = modB(nR, nZ), lam = cl(nv, -1, 1), ph = 2 * PI * Math.random();
        const l2 = cl(lam * cos(KICK) + sqrt(1 - lam * lam) * sin(KICK) * cos(ph), -1, 1);
        S.vp[i] = l2;
        S.mu[i] = (1 - l2 * l2) / (2 * b);
        S.coll[i] = -COLL * log(1 - Math.random());
        classify(S, i);
        flash(S, nR, nZ, 1);
      }
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.pitch = cl(k[2] == null ? 0 : k[2], -30, 30);
  S.drift = cl(k[3] == null ? 0.06 : k[3], 0.01, 0.12);
  if (!S.warm) {
    // First frame: launch everyone and run 1.2 s of the particles' clock so
    // the panel opens with its orbits already drawn.
    for (let i = 0; i < NP; i++) launch(S, i);
    for (let j = 0; j < 36 * speed; j++) advance(S, 33);
    S.warm = true;
  }
  // A turned Pitch knob relaunches the particles one at a time, the one
  // furthest from the new setting first.
  let worst = -1, wd = 1;
  for (let i = 0; i < NP; i++) {
    const dd = abs(S.k3[i] - S.pitch);
    if (dd > wd && S.dead[i] <= 0) {
      wd = dd;
      worst = i;
    }
  }
  if (worst >= 0 && S.frame++ % 2 === 0) launch(S, worst);
  advance(S, d * speed * RATE);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const sc = hsv(S.hue + 0.64, 0.6, 1, [0, 0, 0]);
  const wc = hsv(S.hue + 0.64, 0.45, 1, [0, 0, 0]);
  const tr = S.tr, tg = S.tg, tb = S.tb;
  for (let p = 0; p < N; p++) {
    const s = S.surf[p] * 0.22, w = S.wall[p] * (0.2 + 0.2 * S.bf[p]);
    let r = sc[0] * s + wc[0] * w, g = sc[1] * s + wc[1] * w, b = sc[2] * s + wc[2] * w;
    r += tr[p];
    g += tg[p];
    b += tb[p];
    display.setPixel(p % W, (p / W) | 0, round(min(1, r) * 255), round(min(1, g) * 255), round(min(1, b) * 255));
  }
  // Heads: a pale core over the trail.
  for (let i = 0; i < NP; i++) {
    if (S.dead[i] > 0) continue;
    const x = round(S.R[i] - R0 + CX), y = round(CY - S.Z[i]);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    colour(S, i, 1);
    const c = S.c;
    display.setPixel(x, y, round((0.45 + 0.55 * c[0]) * 255), round((0.45 + 0.55 * c[1]) * 255), round((0.45 + 0.55 * c[2]) * 255));
  }
}
