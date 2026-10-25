// ===== Patternflow pattern =====
// Title:   Bone Jig
// Family:  halloween
// Idea:    A skeleton the height of the panel dances on a black floor lit from below by a toxic green pool, its jaw clacking on the beat, going through a hopping jig, side kicks, swinging arms, a hip shake, a spin and a rattling shiver, every bone a knobbed capsule rimmed with the glow.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 43; after the jointed dancing skeletons of Halloween decorations and the danse macabre
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Glow=0..1, Speed=0.2..3, Dancers=1..3, Trails=0..1
//
// Knob 1: Glow. Three lights round the knob: at 0 a toxic green pool with a violet rim, at 0.33 an orange one with violet, at 0.67 a violet one with green. Each holds for 0.1 either side of its point and blends into the next in between, and 1 is 0 again. The bones stay near white, 12 percent of the light in them; the light takes their lower edges, the embers in the eye sockets and the pool, and the faint haze round them fades through the rim colour, so a dim orange never reads brown.
// Knob 2: Speed. The tempo: 2 is 96 beats a minute, and the six moves take 8, 8, 8, 8, 4 and 4 beats, 25 seconds in all. At 0.2 the round takes 250 seconds, at 3 about 17.
// Knob 3: Dancers, 1 to 3. At 2 a second skeleton 0.6 the size dances on the right, standing 10 rows further back on the floor and dimmer, a quarter beat behind the first; at 3 a third on the left dances the same moves mirrored. Both stand behind the first.
// Knob 4: Trails. Afterimages behind every moving bone, in the light's colour where they are strong and the rim colour where they fade. Up to 0.1 almost none; at 1 a swinging leg leaves a fan of them that fades by half in 0.28 seconds.
// Buttons: K1 tap pops the skull off: it flies up out of the top of the panel with its jaw chattering, spins twice and drops back onto the neck 1.4 seconds later while the body dances on with its arms up.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, sin, cos, round, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (t) => {
  t = cl(t, 0, 1);
  return t * t * (3 - 2 * t);
};

// Bone lengths in LEDs for the first dancer before its scale.
const FEMUR = 22, TIBIA = 21, HUMERUS = 16, ULNA = 14, SPINE = 29, NECK = 5, SKULL = 8.6;
const HIP_X = 6, HIP_Y = 3, SHOULDER_X = 11;
// Ribs: half width, droop toward the breastbone, for four pairs.
const RIBS = [[8.2, 3.2], [9.8, 3.8], [10.2, 4.2], [9.2, 4]];
// Floor row for the first dancer and for the two behind it.
const FLOOR = 122, FLOOR_BACK = 112;
// Lights round K1: the glow (pool, bone rims, eye embers) and the rim
// colour round the pool, on the floor line and in faint haze.
const PAL = [
  [[0.42, 1, 0.12], [0.55, 0.18, 0.95]],
  [[1, 0.5, 0.06], [0.6, 0.2, 1]],
  [[0.72, 0.32, 1], [0.3, 0.95, 0.25]],
];
const BONE = [1, 0.95, 0.84];

// A pose is 25 numbers: root shift x and hop y, turn about the vertical,
// torso lean, pelvis tilt, spine bend, head tilt, jaw, shoulder shimmy,
// then for the screen-left and screen-right arm and leg the upper bone's
// angle out from straight down and its pitch toward the viewer, and the
// same for the lower bone.
const PX = 0, PY = 1, SPIN = 2, LEAN = 3, TILT = 4, CURVE = 5, HEAD = 6, JAW = 7, SHIM = 8, ARM = 9, LEG = 17, NP = 25;
const limb = (o, at, s, a1, p1, a2, p2) => {
  const k = at + 4 * s;
  (o[k] = a1), (o[k + 1] = p1), (o[k + 2] = a2), (o[k + 3] = p2);
};
const clack = (b) => max(0, sin(TAU * b)) ** 2;

// The moves, each a function of the beat b since it started.
function jig(b, o) {
  // Hop on alternate feet: four beats of knees up, four of the foot
  // flicked out to the side; the arms flap out a little on each hop.
  const f = b - floor(b), side = floor(b) & 1, lift = sin(PI * f) ** 1.3, flick = sstep(b - 3.6);
  o[PX] = 1.6 * sin(PI * b);
  o[PY] = -3.5 * lift;
  o[SPIN] = 0.2 * sin((PI * b) / 2);
  o[LEAN] = 0.05 * sin(PI * b);
  o[TILT] = (side ? -0.1 : 0.1) * lift;
  o[HEAD] = 0.12 * sin(PI * b);
  o[JAW] = clack(b);
  for (const s of [0, 1]) limb(o, ARM, s, 0.14 + 0.3 * lift, 0.1, 0.1 + 0.5 * lift, 0);
  limb(o, LEG, side, mix(0.1, 0.3, flick) * lift, mix(1.3, 0.5, flick) * lift, mix(-0.1, 1.1, flick) * lift, mix(-0.15, 0.2, flick) * lift);
  limb(o, LEG, 1 - side, 0.03, 0, 0.02, 0);
}

function kicks(b, o) {
  // Kick out to alternate sides, leaning away; hands on hips for four
  // beats, then fists pumping overhead.
  const f = b - floor(b), side = floor(b) & 1, sg = side ? 1 : -1, k = sin(PI * f) ** 0.8, up = sstep(b - 3.6);
  o[PX] = -sg * 3.5 * k;
  o[PY] = -1 * k;
  o[SPIN] = sg * 0.15 * k;
  o[LEAN] = -sg * 0.14 * k;
  o[TILT] = -sg * 0.1 * k;
  o[HEAD] = sg * 0.12 * k;
  o[JAW] = clack(b);
  for (const s of [0, 1]) limb(o, ARM, s, mix(0.8, 2.45 + 0.2 * k, up), mix(0.15, 0, up), mix(-0.85, 3.1 - 0.35 * k, up), mix(0.35, 0, up));
  limb(o, LEG, side, 0.65 * k, 0.3 * k, 0.9 * k, 0.15 * k);
  limb(o, LEG, 1 - side, -0.05 * k, 0, -0.03 * k, 0);
}

function windmill(b, o) {
  // Arms swing over and down in turn, forearms bent up so the hands stay
  // on the panel; the knees twist in and out, Charleston fashion.
  const th = (PI * b) / 2, tw = sin(PI * b);
  for (const s of [0, 1]) {
    const c = cos(th + s * PI), a1 = 1.45 - 1.25 * c;
    limb(o, ARM, s, a1, 0.25 * sin(th + s * PI), a1 + 1.6, 0);
    limb(o, LEG, s, 0.06 + 0.12 * tw, 0.1, 0.04 - 0.28 * tw, 0);
  }
  o[SPIN] = 0.3 * sin(th);
  o[LEAN] = 0.08 * sin(th);
  o[HEAD] = -0.1 * sin(th);
  o[JAW] = clack(b);
}

function hips(b, o) {
  // Hips out to one side each beat, chest held over the feet, the other
  // knee bent; arms up in a Y with the hands waving.
  const sw = sin(PI * b);
  o[PX] = 5.5 * sw;
  o[TILT] = -0.25 * sw;
  o[LEAN] = -0.2 * sw;
  o[CURVE] = 0.5 * sw;
  o[HEAD] = 0.1 * sw;
  o[JAW] = clack(2 * b);
  for (const s of [0, 1]) {
    const sg = s ? 1 : -1, bend = max(0, -sg * sw);
    limb(o, ARM, s, 2.55 - 0.12 * sg * sw, 0.1, 3.0 + 0.35 * sin(TAU * b + s * PI), 0);
    limb(o, LEG, s, 0.04 + 0.02 * (1 - bend), 0.5 * bend, 0.04 - 0.14 * bend, -0.3 * bend);
  }
}

function spin(b, o) {
  // One whole turn on one foot, the other drawn up to the knee.
  const e = sstep(b / 3.2);
  o[SPIN] = TAU * e;
  o[PY] = -2.5 * sin(PI * min(1, b / 3.2));
  o[JAW] = 0.7;
  for (const s of [0, 1]) limb(o, ARM, s, 1.2, 0.25, 2.5, 0);
  limb(o, LEG, 1, 0.35, 1.0, -0.55, 0.2);
  limb(o, LEG, 0, 0.02, 0, 0.02, 0);
}

function rattle(b, o) {
  // A crouched shiver: shoulders shaking four times a beat, knees
  // knocking, teeth chattering.
  const q = sin(8 * PI * b);
  o[SHIM] = 1.6 * q;
  o[JAW] = 0.5 + 0.5 * sin(16 * PI * b);
  o[HEAD] = 0.12 * sin(4 * PI * b);
  for (const s of [0, 1]) {
    limb(o, ARM, s, 0.95, 0.35, -1.25 + 0.3 * q, 0.5);
    limb(o, LEG, s, 0.22 + 0.1 * q, 0.45, -0.2 - 0.1 * q, -0.45);
  }
}

const MOVES = [[jig, 8], [kicks, 8], [windmill, 8], [hips, 8], [spin, 4], [rattle, 4]];
const ROUND = MOVES.reduce((a, m) => a + m[1], 0);
// The last BLEND of a beat of each move eases into the next one's start.
const BLEND = 0.6;

function pose(B, out, tmp) {
  let b = B - floor(B / ROUND) * ROUND, m = 0;
  while (b >= MOVES[m][1]) (b -= MOVES[m][1]), m++;
  out.fill(0);
  MOVES[m][0](b, out);
  out[SPIN] -= TAU * round(out[SPIN] / TAU);
  const w = sstep((b - (MOVES[m][1] - BLEND)) / BLEND);
  if (w > 0) {
    tmp.fill(0);
    MOVES[(m + 1) % MOVES.length][0](0, tmp);
    for (let i = 0; i < NP; i++) out[i] = mix(out[i], tmp[i], w);
  }
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, count: 1, trail: 0.06, beat: 0, dt: 0,
    // Skull flight after a K1 tap: seconds since, or -1.
    fly: -1,
    pose: new Float64Array(NP), tmp: new Float64Array(NP),
    rgb: new Float32Array(N * 3), a: new Float32Array(N), halo: new Float32Array(N), blur: new Float32Array(N), ghost: new Float32Array(N),
    prims: [],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.count = cl(round(k[2]), 1, 3);
  S.trail = cl(k[3], 0, 1);
  S.beat += d * S.speed * 0.8;
  S.dt = d;
  if (input.btnPressed && input.btnPressed[0] && S.fly < 0) S.fly = 0;
  if (S.fly >= 0) {
    S.fly += d;
    if (S.fly > 1.75) S.fly = -1;
  }
}

// --- the body ---

// A unit vector for a bone on side sg (-1 screen left, 1 right): angle a
// out from straight down, pitch p toward the viewer (negative z).
function dir(sg, a, p) {
  const cp = cos(p);
  return [sg * sin(a) * cp, cos(a) * cp, -sin(p)];
}
const rot = (v, a) => [v[0] * cos(a) - v[1] * sin(a), v[0] * sin(a) + v[1] * cos(a), v[2]];
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];

// Build one dancer as primitives on the panel. kind 0 a plain capsule,
// 1 a long bone with knobbed ends, 2 a disc, 3 the skull.
function build(S, P, cx, floorY, sc, mirror, dim, flyY, flySpin, armsUp, back) {
  const out = S.prims, lean = P[LEAN], tilt = P[TILT], sh = P[SHIM];
  const segs = [];
  const seg = (a, b, r, kind) => segs.push([a, b, r, kind]);
  // Pelvis: two wings, the arch in front and the sacrum behind.
  const pel = (x, y, z) => rot([x, y, z], tilt);
  for (const sg of [-1, 1]) {
    const pts = [[1.5, -4, 1.5], [8, -7, 1], [10.5, -3, 0.5], [8, 1.5, -0.5], [HIP_X, HIP_Y, 0], [3, 6, -2], [0, 6.5, -2.5]].map(([x, y, z]) => pel(sg * x, y, z));
    for (let i = 0; i + 1 < pts.length; i++) seg(pts[i], pts[i + 1], 1.15, 0);
  }
  const base = pel(0, -5, 2);
  seg(base, pel(0, 2, 2.5), 1.5, 0);
  // Spine, bent sideways by CURVE and leant by LEAN; the vertebrae are
  // beads along it.
  const torso = (v) => add(base, rot(v, lean));
  let prev = base;
  for (let i = 1; i <= 8; i++) {
    const u = i / 8, q = torso([P[CURVE] * 6 * sin(PI * u), -SPINE * u, 1.5 + 2 * sin(PI * u)]);
    seg(prev, q, 0.7, 0);
    segs.push([q, q, 1.35, 2]);
    prev = q;
  }
  const neck = prev, chest = (x, y, z) => add(neck, rot([x, y, z], lean));
  // Ribs: half ellipses round from the spine to the breastbone, dipping
  // toward the front, and the breastbone down the middle.
  RIBS.forEach(([w, droop], k) => {
    for (const sg of [-1, 1]) {
      let p0 = null;
      for (let j = 0; j <= 6; j++) {
        const th = 0.25 + ((PI - 0.6) * j) / 6;
        const p = chest(sg * w * sin(th) + 0.5 * sh, 4 + 5.2 * k + (droop * (1 - cos(th))) / 2, 0.75 * w * cos(th));
        if (p0) seg(p0, p, 0.75, 0);
        p0 = p;
      }
    }
  });
  seg(chest(0.5 * sh, 4 + RIBS[0][1], -6), chest(0.5 * sh, 4 + 5.2 * 3 + RIBS[3][1], -7), 1, 0);
  // Shoulders, collarbones and arms.
  for (const s of [0, 1]) {
    const sg = s ? 1 : -1, o = ARM + 4 * s, w = armsUp;
    const sho = chest(sg * SHOULDER_X + sh, 3, 0);
    seg(chest(0, 1, -2), sho, 0.9, 0);
    // Arms thrown up for the flying skull swing up through the front, so a
    // straight arm never sweeps out past the panel's sides.
    const a1 = mix(P[o], 2.7, w), p1 = mix(P[o + 1], 0, w) + 1.3 * sin(PI * w), a2 = mix(P[o + 2], 3.0, w), p2 = mix(P[o + 3], 0, w) + 1.1 * sin(PI * w);
    const elb = add(sho, rot(dir(sg, a1, p1), lean), HUMERUS), d2 = rot(dir(sg, a2, p2), lean), wri = add(elb, d2, ULNA);
    seg(sho, elb, 1.05, 1);
    seg(elb, wri, 0.95, 1);
    // A bony hand: palm knob and three fingers fanned along the forearm.
    segs.push([add(wri, d2, 1.2), add(wri, d2, 1.2), 1.5, 2]);
    for (const f of [-0.45, 0, 0.45]) {
      const fd = rot(d2, f * sg);
      seg(add(wri, d2, 1.5), add(wri, fd, 5), 0.55, 0);
    }
  }
  // Legs and feet.
  let low = -1e9;
  const legs = [];
  for (const s of [0, 1]) {
    const sg = s ? 1 : -1, o = LEG + 4 * s;
    const hip = pel(sg * HIP_X, HIP_Y, 0);
    const kne = add(hip, dir(sg, P[o], P[o + 1]), FEMUR), ank = add(kne, dir(sg, P[o + 2], P[o + 3]), TIBIA);
    const fd = [sg * 0.45, 0.3, -0.84], toe = add(ank, fd, 5);
    legs.push([hip, kne, ank, toe]);
    low = max(low, ank[1] + 1.5, toe[1] + 1);
  }
  for (const [hip, kne, ank, toe] of legs) {
    segs.push([hip, hip, 2, 2]);
    seg(hip, kne, 1.2, 1);
    seg(kne, ank, 1.1, 1);
    seg(ank, toe, 1.1, 0);
  }
  // Neck and skull.
  const nt = add(neck, rot(rot([0, -NECK, 0], P[HEAD] * 0.5), lean));
  seg(neck, nt, 1.1, 0);
  segs.push([nt, nt, 1.3, 2]);
  const sk = add(nt, rot(rot([0, -SKULL * 0.95, 0], P[HEAD]), lean));
  // Turn about the vertical through the root, mirror, scale and place
  // with the lowest foot on the floor.
  const sp = P[SPIN], cs = cos(sp), sn = sin(sp), m = mirror ? -1 : 1;
  const ry = floorY - low * sc + P[PY] * sc, rx = cx + m * P[PX] * sc;
  const proj = (v) => {
    const x = (v[0] * cs + v[2] * sn) * m, z = -v[0] * sn + v[2] * cs;
    return [rx + x * sc, ry + v[1] * sc, z];
  };
  for (const [a, b, r, kind] of segs) {
    const A = proj(a), B = proj(b);
    out.push({ kind, x0: A[0], y0: A[1], x1: B[0], y1: B[1], z: (A[2] + B[2]) / 2 + back, r: r * sc, dim });
  }
  const C = proj(sk);
  out.push({ kind: 3, x0: C[0], y0: C[1] + flyY * sc, z: C[2] - 1 + back, r: SKULL * sc, dim, yaw: m * (sp + flySpin), roll: m * (P[HEAD] + lean), jaw: P[JAW] });
}

// --- drawing ---

function shade(S, ny, y, dim, out, edge = 1) {
  // Lit from below: the lower edge takes the glow, more so near the floor;
  // the upper edge is a little darker.
  const g = S.glow, rim = max(0, ny) * edge, low = cl((y - 40) / 85, 0, 1);
  const t = cl(0.05 + 0.75 * rim ** 3 + 0.2 * low, 0, 0.85), lum = (0.86 + 0.14 * rim + 0.22 * min(0, ny)) * dim;
  // Bone white, a little of the light's colour in it everywhere.
  for (let c = 0; c < 3; c++) out[c] = mix(mix(BONE[c], g[c], 0.12) * lum, g[c] * dim, t);
}

const COL = [0, 0, 0];

function capsule(S, p) {
  const { rgb, a } = S, r = p.r, knob = p.kind === 1, x0 = p.x0, y0 = p.y0, x1 = p.x1, y1 = p.y1;
  const dx = x1 - x0, dy = y1 - y0, ll = dx * dx + dy * dy, len = sqrt(ll) || 1;
  const nx = -dy / len, ny = dx / len, lo = 0.7 * r, lr = 0.78 * r + 0.15, ux = dx / len, uy = dy / len;
  const pad = r + 2.6;
  const xa = max(0, floor(min(x0, x1) - pad)), xb = min(W - 1, floor(max(x0, x1) + pad));
  const ya = max(0, floor(min(y0, y1) - pad)), yb = min(H - 1, floor(max(y0, y1) + pad));
  // Knobs: two lobes at each end, set a little in from the joint.
  const L = knob ? [[x0 + ux * 0.4 * r + nx * lo, y0 + uy * 0.4 * r + ny * lo], [x0 + ux * 0.4 * r - nx * lo, y0 + uy * 0.4 * r - ny * lo], [x1 - ux * 0.4 * r + nx * lo, y1 - uy * 0.4 * r + ny * lo], [x1 - ux * 0.4 * r - nx * lo, y1 - uy * 0.4 * r - ny * lo]] : [];
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5, py = y + 0.5;
      const u = ll > 0 ? cl(((px - x0) * dx + (py - y0) * dy) / ll, 0, 1) : 0;
      let cx = x0 + u * dx, cy = y0 + u * dy, dd = sqrt((px - cx) ** 2 + (py - cy) ** 2) - r;
      for (let k = 0; k < L.length; k++) {
        const lx = L[k][0], ly = L[k][1], e = sqrt((px - lx) ** 2 + (py - ly) ** 2) - lr;
        if (e < dd) (dd = e), (cx = lx), (cy = ly);
      }
      const o = y * W + x;
      // A dark line round each bone where it passes in front of another.
      if (dd > 0.5) {
        if (dd < 1.3) for (let c = 0; c < 3; c++) rgb[o * 3 + c] *= 0.35;
        continue;
      }
      const cov = cl(0.5 - dd, 0, 1), dl = sqrt((px - cx) ** 2 + (py - cy) ** 2) || 1;
      shade(S, (py - cy) / dl, py, p.dim, COL);
      for (let c = 0; c < 3; c++) rgb[o * 3 + c] = mix(rgb[o * 3 + c], COL[c], cov);
      if (cov > a[o]) a[o] = cov;
    }
}

function skull(S, p) {
  const { rgb, a } = S, r = p.r, cx = p.x0, cy = p.y0, yaw = p.yaw, cr = cos(p.roll), sr = sin(p.roll);
  const vn = cos(yaw), sn = sin(yaw), rx = r * (0.92 + 0.14 * abs(sn)), ry = r, rm = min(rx, ry);
  // The jaw hangs below the cranium and drops as it opens; seen from the
  // side it juts forward.
  const jo = cl(p.jaw, 0, 1), fwd = sn * r * 0.35;
  const jx = fwd, jy = 0.74 * r + 0.3 * r * jo, jrx = 0.58 * r * (0.62 + 0.38 * abs(vn)), jry = 0.37 * r;
  // Mouth with a row of teeth along each lip, the nose, and the two eye
  // sockets, each turned with the head and faded as it turns away.
  const mouthY = 0.8 * r + 0.15 * r * jo, mh = 0.05 * r + 0.18 * r * jo, mw = 0.42 * r * (0.55 + 0.45 * abs(vn)), mx = fwd * 0.7;
  const nx = sn * rx * 0.95, ny = 0.42 * r, nw = 0.13 * r * vn + 0.35;
  const eyes = [-0.48, 0.48].map((f) => {
    const vis = cos(f + yaw);
    return [vis, sin(f + yaw) * rx * 0.82, 0.04 * r, 0.3 * r * (0.35 + 0.65 * vis), 0.3 * r];
  }).filter((e) => e[0] >= 0.12);
  const ex = S.ember, glow = S.glow, dim = p.dim;
  const pad = r * 1.3 + 4;
  for (let y = max(0, floor(cy - pad)); y <= min(H - 1, floor(cy + pad + r)); y++)
    for (let x = max(0, floor(cx - pad)); x <= min(W - 1, floor(cx + pad)); x++) {
      // Into the skull's own frame, rolled with the head.
      const qx = x + 0.5 - cx, qy = y + 0.5 - cy, X = qx * cr + qy * sr, Y = -qx * sr + qy * cr;
      const dc = sqrt((X / rx) ** 2 + (Y / ry) ** 2), dj = sqrt(((X - jx) / jrx) ** 2 + ((Y - jy) / jry) ** 2);
      const ec = (1 - dc) * rm, ej = (1 - dj) * jry;
      const e = max(ec, ej), o = y * W + x;
      if (e < -0.5) {
        if (e > -1.3) for (let c = 0; c < 3; c++) rgb[o * 3 + c] *= 0.35;
        continue;
      }
      const cov = cl(e + 0.5, 0, 1), onC = ec >= ej;
      const nyv = onC ? Y / ry / max(dc, 1e-3) : (Y - jy) / jry / max(dj, 1e-3);
      shade(S, cl(nyv, -1, 1), y + 0.5, dim, COL, sstep(((onC ? dc : dj) - 0.6) / 0.4));
      let dark = 0, ember = 0;
      if (vn > 0.2 && ec < ej + 0.6 && abs(Y - mouthY) < mh + 0.5 && abs(X - mx) < mw) {
        const tooth = (X - mx) / (0.21 * r) + 10.25, gap = tooth - floor(tooth) < 0.3;
        dark = abs(Y - mouthY) > mh - 1 && !gap ? 0 : 1;
      }
      for (const [vis, fx, fy, ew, eh] of eyes) {
        const de = ((X - fx) / ew) ** 2 + ((Y - fy) / eh) ** 2;
        if (de < 1) {
          dark = 1;
          if (de < 0.16) ember = max(ember, vis * (1 - de / 0.16));
        }
      }
      // The nose: a small triangle pointing down.
      if (vn > 0.15 && Y > ny && Y < ny + 0.22 * r && abs(X - nx) < nw * (1 - (Y - ny) / (0.26 * r))) dark = 1;
      for (let c = 0; c < 3; c++) {
        const v = dark ? (0.04 + ex * ember * glow[c]) * dim : COL[c];
        rgb[o * 3 + c] = mix(rgb[o * 3 + c], v, cov);
      }
      if (cov > a[o]) a[o] = cov;
    }
}

function lights(S) {
  const h = (S.hue - floor(S.hue)) * 3, i = floor(h) % 3, f = h - floor(h), j = (i + 1) % 3;
  const g = cl((f - 0.3) / 0.4, 0, 1), s = g * g * (3 - 2 * g);
  S.glow = [0, 1, 2].map((c) => mix(PAL[i][0][c], PAL[j][0][c], s));
  S.rim = [0, 1, 2].map((c) => mix(PAL[i][1][c], PAL[j][1][c], s));
}

// Box blur of src into dst, radius 2, across then down.
function blur(src, tmp, dst) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += src[y * W + cl(x + k, 0, W - 1)];
      tmp[y * W + x] = s / 5;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -2; k <= 2; k++) s += tmp[cl(y + k, 0, H - 1) * W + x];
      dst[y * W + x] = s / 5;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  lights(S);
  const { rgb, a, halo, ghost } = S, P = S.pose;
  rgb.fill(0);
  a.fill(0);
  S.prims.length = 0;
  const pulse = 0.5 + 0.5 * cos(TAU * S.beat);
  S.ember = 0.75 + 0.25 * pulse;
  // The skull's flight: up out of the panel and back in 1.4 seconds, two
  // turns, then a little bounce on the neck.
  let flyY = 0, flySpin = 0, armsUp = 0;
  if (S.fly >= 0) {
    const u = S.fly / 1.4;
    if (u < 1) {
      flyY = -150 * u * (1 - u);
      flySpin = 2 * TAU * sstep(u);
      armsUp = sin(PI * u) ** 0.6;
    } else flyY = -3 * sin(PI * cl((S.fly - 1.4) / 0.35, 0, 1));
  }
  // Backing dancers first: smaller, dimmer, a quarter beat behind, the
  // one on the left mirrored.
  if (S.count > 1) {
    pose(S.beat - 0.25, P, S.tmp);
    const backs = S.count > 2 ? [12, 52] : [50];
    for (const bx of backs) build(S, P, bx, FLOOR_BACK, 0.6, bx < 32, 0.72, 0, 0, 0, 100);
  }
  pose(S.beat, P, S.tmp);
  if (S.fly >= 0 && S.fly < 1.4) P[JAW] = 0.5 + 0.5 * sin(TAU * 7 * S.fly);
  build(S, P, 32, FLOOR, 1.08, false, 1, flyY, flySpin, armsUp, 0);
  S.prims.sort((p, q) => q.z - p.z);
  for (const p of S.prims) (p.kind === 3 ? skull : capsule)(S, p);
  // Haze round the bones, and the afterimages.
  blur(a, S.blur, halo);
  const keep = (0.5 + 0.42 * S.trail) ** (S.dt * 30), gain = sstep(S.trail / 0.6);
  for (let o = 0; o < N; o++) ghost[o] = max(ghost[o] * keep, a[o]);
  const g = S.glow, rim = S.rim;
  for (let y = 0, o = 0; y < H; y++) {
    // The floor: a pool of light under the first dancer with a rim of the
    // second colour, and a faint floor line.
    const fy = (y + 0.5 - FLOOR - 1.5) / 5.5;
    for (let x = 0; x < W; x++, o++) {
      const fx = (x + 0.5 - 32) / 27, q = sqrt(fx * fx + fy * fy);
      const pool = max(0, 1 - q) ** 1.3 * (0.9 + 0.1 * pulse), ring = max(0, 1 - abs(q - 0.95) / 0.35) * 0.35;
      const line = abs(y - FLOOR - 2) < 0.6 ? 0.16 * max(0, 1 - abs(fx) / 1.25) : 0;
      const hz = 0.22 * halo[o] * (1 - a[o]), gh = gain * 0.9 * max(0, ghost[o] - a[o]);
      // Bones are already weighted by their cover, and the light shows
      // round them in steps of 1/24: a smooth ramp costs more to store than
      // it shows. Faint haze and afterimages take the rim colour, so a faint
      // orange never reads brown; the brighter, the more the glow's own.
      const al = 1 - a[o], lp = round(pool * 0.75 * 24) / 24, lh = round((hz + gh) * 24) / 24, lr = round((ring + line) * 24) / 24;
      const wg = sstep((lh - 0.3) * 2.5);
      const r = rgb[o * 3] + min(1, g[0] * lp + mix(rim[0], g[0], wg) * lh + rim[0] * lr) * al;
      const gg = rgb[o * 3 + 1] + min(1, g[1] * lp + mix(rim[1], g[1], wg) * lh + rim[1] * lr) * al;
      const b = rgb[o * 3 + 2] + min(1, g[2] * lp + mix(rim[2], g[2], wg) * lh + rim[2] * lr) * al;
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, gg)), round(255 * min(1, b)));
    }
  }
}
