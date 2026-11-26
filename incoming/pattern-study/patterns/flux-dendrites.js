// ===== Patternflow pattern =====
// Title:   Flux Dendrites
// Family:  fluxavalanche
// Idea:    A thin superconducting film seen through a Faraday garnet, where a field that sweeps up and down by random turns pushes flux in from the film edge as a bright rim and now and then a thermomagnetic avalanche shoots in as a thin branching tree of flux, while antiflux enters on the way back and a dark seam marks where it meets what was trapped.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: magneto-optical imaging of superconductors through a Faraday-rotating garnet indicator film, brightness following the local flux density (Koblischka and Wijngaarden, 1995, from memory); the critical state of a hard superconductor, flux held at a fixed slope from the edge and left behind when the field turns (Bean, 1962, from memory); the same in a thin film in a perpendicular field (Brandt and Indenbom, 1993; Zeldov et al., 1994, from memory); thermomagnetic flux avalanches that branch like trees, in YBCO (Leiderer et al., 1993, from memory) and in MgB2 (Johansen et al., 2002, from memory), and the branching models of them (Aranson, Gurevich, Vinokur and others, 2001 to 2005, from memory); flux creep (Anderson and Kim, 1964, from memory). Original here: the critical state kept as a two-sided clamp on a distance field from a notched edge, avalanches as tips that fork, repel the flux already laid and fade by creep, and a sweep of random turning points, pattern round 262
// Round:   262
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.2..3, Pinning=-1..1, Branching=-1..1
//
// Knob 1: Hue. The tint of the garnet's light: lime at 0, green at 0.1, cyan at 0.27, blue at 0.43, violet at 0.52, magenta at 0.6, red at 0.77, amber at 0.88, yellow-lime at 0.93 and back to lime at 1. The ground is a dark shade of the same tint turned a little toward the next hue, and flux that is bright enough goes to near white.
// Knob 2: Sweep. How fast the applied field is swept, 0.1 of the field's own pace at 0.2, 1 at 2 where it opens (a unit of field in about 18 s on an average leg, so the rim's edge moves 2.6 LED a second) and 1.5 at 3. A fast sweep also fires the avalanches a little closer together, 2.4 to 5.2 s apart on the way up at 2 and 4.0 to 8.7 s at 0.2.
// Knob 3: Pinning. How firmly the film holds its flux, its critical current: at -1 the film is weak and at full field the flux has come 90 LED in, at 0 it has come 48 LED, at 1 only 26 LED and the fingers shoot out across dark film. Fingers run longer, up to 125 LED, in a deeper front.
// Knob 4: Branching. How the avalanches fork: a fork every 28 LED or so at -1, every 12 at 0 and every 5 at 1 (never nearer than 7), split at 34 degrees open at -1, 41 at 0 and 48 at 1, so a few forked fingers at -1 and bushy trees at 1; the avalanches also come about a fifth closer together at 1 than at -1.

// What the picture is. A view 64 by 128 LED of a superconducting film, a thin film lying in a field that points through it, the way
// a magneto-optical indicator sees it. The film's edge runs down the left of the panel with a lean and a slow waviness, 7.5 LED in at the
// top and 13 at the bottom, with two V notches cut into it, one between rows 22 and 46 and one between 78 and 108 (5.5 LED deep and 11 wide),
// and the film goes on to the right past the panel. Left of the edge there is no film and the garnet sees the applied field alone.
// Brightness is the local flux density b. The film with no flux is a near-black ground (L = 0.11), flux brings it up to a dim glow
// (L near 0.3 by b = 0.5) and fingers carry it on to near white, and antiflux (b below 0) is darker than the ground. In figures,
// L = 0.11 + 0.19 (1 - exp(-(b / 0.28)^1.5)) + 0.7 smoothstep(0.55, 1.15, w) for flux, where w is what climbs past the glow: a finger
// counts whole and the critical state's flux 0.4, so a deep rim stays a glow and only a finger or the film's very edge goes white.
// For antiflux L = 0.11 (0.15 + 0.85 exp(b / 0.15)). A rim peaks at the edge (b times 1 + 1.3 exp(-s / 4), the way flux piles up at
// a thin film's edge), and a granularity of the film (a sixth either way, static) and a slow mottle (30 percent over 10 LED and 4 LED,
// a new draw every 12 s, faded from one to the next) work on the glow. Outside the film b = 0.18 Ba (1 + 2.2 exp(s / 2.2)) from the edge.
// The critical state. The field the garnet sees at the edge is Ba, the applied one. Inside the film flux is held at a slope no steeper than
// g per LED from the distance s to the edge: Ba - g s <= b <= Ba + g s. Each step b is clamped between those two and keeps what the
// clamp leaves alone. Field up pushes flux in and the front moves in at 1 / g LED a unit of field; field down takes flux out near the
// edge only and what lies deeper stays trapped; field through zero lets antiflux in under a ramp that crosses zero where the trapped flux
// ends, the seam where they annihilate. s is the true distance to the notched edge, so the rim bends round each notch. The pinning
// varies a fifth over 9 LED and a twelfth over 3.5, so the front is wavy. g is 1/48 per LED at Pinning 0 and 1.87 times that for each unit.
// The sweep. Ba runs in legs from a turning point to the next, at 0.05 times a draw of 0.45 to 1.75 times Sweep / 2 field units a
// second, easing in and out over about 2 s and pausing 2 to 14 s at a turn three times in ten. After a peak (0.8 to 1) comes a trough
// (0.42 to 0.7), or one time in fifteen a dip to -0.18 to 0.1, or one time in five a turn back after 0.15 to 0.4 of field (not below
// 0.35); after a trough comes a peak, or one time in five a rise of 0.15 to 0.45. The field never cycles, and what is trapped never
// matches what was trapped before.
// Avalanches. A thermomagnetic avalanche comes with flux entering the film. While Ba is above 0.12 one starts every (3 + 3.5 u) / (0.7 +
// 9.8 q) seconds, u a draw from 0 to 1 and q the smoothed rate at which |Ba| grows, field units a second (about 0.05 on the way up, 0
// on the way down). The root is on the edge, four times in ten at a notch and otherwise anywhere, in a place with no flux laid and none
// in the way, heading in along the edge's normal give or take 0.3 rad. Six times in ten it is a big one, with a reach of 50 LED plus
// 0.5 to 0.95 of the front's depth, 68 to 125 LED; otherwise a small one, 30 to 58 LED. A tip walks 0.7 LED at a time at 52 to 80 LED a second,
// so the tree shoots in over a second or two. Its heading takes a random step (0.11 rad over a LED), is pulled a little back to the
// normal and kept within 0.95 rad of it, and turns away from flux already laid, which it feels at two points 7 and 3.5 LED ahead and 0.55
// rad either side: that is what makes branches fan out instead of tangle. A tip forks with a chance a LED of 0.085 at Branching 0 (it
// doubles for each 0.8 of the knob) after at least 7 LED and with 14 LED of reach left, as a side finger in 55 percent, leaving 0.7 to
// 1.1 rad off the trunk with 45 to 80 percent of its reach, or as a split in two, a child 0.72 rad open on average that keeps 75 to 95
// percent. A fork is dropped if flux already stands 4 to 10 LED ahead of the child. A tip stops when its reach runs out, when flux
// stands a few LED ahead, or where it meets the edge or leaves the panel. A tree has at most 30 tips and the panel 26. The finger is laid
// as a capsule 3.1 LED across at the trunk and 0.4 less for each fork down to 2.1, with soft sides, at a flux 0.7 + 0.6 |Ba| (0.9 to
// 1.35, a tenth either way) that falls to 74 percent over its last 40 LED, with a rough flooded zone round it, a fifth of its flux falling off over 4 LED and
// broken up by a static mottle out to 9 LED. A new finger is white hot and cools over 0.7 s, so the tree flashes in and settles to the tint.
// Fingers do not follow the critical clamp: they are a second field added to the first, fading by creep with a time constant of 26 s, so
// an old tree is a ghost within a minute and the next stands over it.
// Drawing. The two fields are summed and the panel is read from them, the film's edge antialiased over 1.6 LED with a faint glint
// along it, and where flux and antiflux meet a dark seam 2 to 3 LED across is drawn over the crossing. Before the first frame the field is
// swept at a pace that does not depend on Sweep, in steps of 0.25 s, for at least 80 s and until Ba is between 0.3 and 0.85 and a big tree
// has stood for 3 to 35 s, so the opening picture has flux in the film and fingers across it.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, exp, sin, cos, atan2, min, max, abs, pow, PI } = Math;
const imul = Math.imul;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

const G0 = 1 / 48; // critical slope at Pinning 0, field a LED
const BMAX = 1.0, BMIN = -0.18; // turning points of the field
const GL = 0.11, LC = 0.3; // the ground's level, and the level the film's glow tops out at
const TAU_F = 26; // creep of the fingers, s
const TM = 12; // s between the slices of the film's flux noise
const TAU_H = 0.7; // cooling of a new finger, s
const STEP = 0.7; // LED a tip walks at a time
const CAP_TIPS = 26, CAP_SPAWN = 30; // tips alive in one tree, tips ever in one tree

// ---- noise
function hv(i, j, k) {
  let h = imul(i, 0x27d4eb2d) ^ imul(j, 0x165667b1) ^ imul(k, 0x5bd1e995);
  h = imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = imul(h, 0xc2b2ae35);
  return ((h >>> 8) & 0xffff) / 32767.5 - 1;
}
function vn2(x, y, k) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hv(xi, yi, k), b = hv(xi + 1, yi, k), c = hv(xi, yi + 1, k), d = hv(xi + 1, yi + 1, k);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx;
  return x0 + (x1 - x0) * fy;
}

function makeState() {
  return {
    ready: false, t: 0, ks: [0, 2, 0, 0.06], seed: (rnd() * 1e6) | 0,
    nt: [0, 0], s: new Float32Array(N), sg: new Float32Array(N), rn: new Float32Array(N), gr: new Float32Array(N),
    b: new Float32Array(N), F: new Float32Array(N), hot: new Float32Array(N), tb: new Float32Array(N), tw: new Float32Array(N),
    Ba: 0, absPrev: 0, inflow: 0, sw: { tgt: 0.9, v: 0, r: 1, hold: 0, dir: 1 },
    tips: [], next: 5, lastAval: -99, lastBig: -99, alive: 0, skirtAcc: 0, tm: 1, nid: 0,
    mA: new Float32Array(N), mB: new Float32Array(N), mt: 0, mk: 0, hue: -1, tintF: [1, 1, 1], tintG: [1, 1, 1],
  };
}

export function setup(params) {
  params.s = makeState();
}

function knobs(k) {
  const m = cl(k[1], 0.2, 3) / 2, pin = cl(k[2], -1, 1), br = cl(k[3], -1, 1);
  return {
    m,
    g: G0 * pow(1.87, pin),
    pf: 0.085 * pow(2, 1.25 * br), // forks a LED
    th: 0.72 + 0.12 * br, // rad between the two children, on average
    sig: 0.11 + 0.02 * br,
    evk: 6.5 * pow(2, 0.4 * br),
  };
}

// ---- the film: the edge, and the distance to it
function edgeX(S, y) {
  let x = 7.5 + 0.045 * y + 2.3 * vn2(y / 26, 0.5, S.seed) + 0.8 * vn2(y / 8, 1.5, S.seed);
  for (let n = 0; n < 2; n++) {
    const u = 1 - abs(y - S.nt[n]) / 5.5;
    if (u > 0) x += 5.5 * pow(u, 1.2);
  }
  return x;
}
function buildFilm(S) {
  S.nt[0] = 22 + 24 * rnd();
  S.nt[1] = 78 + 30 * rnd();
  const NP = 360, px = new Float32Array(NP), py = new Float32Array(NP);
  for (let j = 0; j < NP; j++) {
    py[j] = -20 + j * 0.5;
    px[j] = edgeX(S, py[j]);
  }
  const sd = S.seed;
  for (let y = 0; y < H; y++) {
    const j0 = max(0, floor((y - 14 + 20) * 2)), j1 = min(NP - 1, floor((y + 14 + 20) * 2)), ex = edgeX(S, y + 0.5);
    for (let x = 0; x < W; x++) {
      let d2 = 1e9;
      for (let j = j0; j <= j1; j++) {
        const dx = x + 0.5 - px[j], dy = y + 0.5 - py[j];
        const e = dx * dx + dy * dy;
        if (e < d2) d2 = e;
      }
      const i = y * W + x, s = x + 0.5 > ex ? sqrt(d2) : -sqrt(d2);
      S.s[i] = s;
      S.sg[i] = s > 0 ? s * (1 + 0.2 * vn2(x / 9, y / 9, sd + 3) + 0.08 * vn2(x / 3.5, y / 3.5, sd + 4)) : s;
      // the skirt's mottle and the film's granularity
      S.rn[i] = 0.5 + 0.5 * (0.6 * vn2(x / 2.6, y / 2.6, sd + 5) + 0.4 * vn2(x / 6, y / 6, sd + 6));
      S.gr[i] = 1 + 0.16 * (0.65 * vn2(x / 3.1, y / 3.1, sd + 7) + 0.35 * vn2(x / 8, y / 8, sd + 8));
    }
  }
}

// ---- the field and its legs
function newLeg(S, P) {
  const w = S.sw, up = w.dir > 0;
  let tgt;
  if (up) {
    const r = rnd();
    tgt = r < 0.2 ? max(0.35, S.Ba - (0.15 + 0.25 * rnd())) : r < 0.27 ? BMIN + (0.1 - BMIN) * rnd() : 0.42 + 0.28 * rnd();
  } else tgt = rnd() < 0.2 ? min(BMAX, S.Ba + (0.15 + 0.3 * rnd())) : 0.8 + (BMAX - 0.8) * rnd();
  if (abs(tgt - S.Ba) < 0.12) tgt = S.Ba + (up ? -0.2 : 0.2);
  w.tgt = tgt;
  w.dir = tgt > S.Ba ? 1 : -1;
  w.r = 0.45 + 1.3 * rnd();
  w.hold = rnd() < 0.3 ? 2 + 12 * rnd() : 0;
}
function sweep(S, P, dt) {
  const w = S.sw;
  if (w.hold > 0) {
    w.hold -= dt;
    w.v += (0 - w.v) * (1 - exp(-dt / 1.5));
  } else {
    const dir = w.tgt > S.Ba ? 1 : -1, left = abs(w.tgt - S.Ba);
    const vt = dir * 0.05 * w.r * P.m * S.tm * (0.2 + 0.8 * ss(0, 0.14, left));
    w.v += (vt - w.v) * (1 - exp(-dt / 2));
    if (left < 0.004) newLeg(S, P);
  }
  S.Ba = cl(S.Ba + w.v * dt, BMIN - 0.05, BMAX + 0.05);
}
function bean(S, g) {
  const Be = S.Ba, b = S.b, sg = S.sg;
  for (let i = 0; i < N; i++) {
    const sv = sg[i] > 0 ? sg[i] : 0, lo = Be - g * sv, hi = Be + g * sv, v = b[i];
    b[i] = v < lo ? lo : v > hi ? hi : v;
  }
}

// ---- the avalanches
function normalAt(S, y) {
  const ex = (edgeX(S, y + 1) - edgeX(S, y - 1)) * 0.5;
  return atan2(-ex, 1);
}
function ahead(S, x, y, a, r0, r1, thr) {
  for (let r = r0; r <= r1; r += 3) if (sampD(S, x + r * cos(a), y + r * sin(a)) > thr) return true;
  return false;
}
function launch(S, P, sgn) {
  let y = 0, ok = false;
  for (let tr = 0; tr < 10; tr++) {
    y = rnd() < 0.4 ? S.nt[rnd() < 0.5 ? 0 : 1] + gauss() * 1.6 : 5 + 118 * rnd();
    y = cl(y, 2, H - 3);
    // not under a tree that is still standing
    let lit = 0;
    const xe = floor(edgeX(S, y)) + 4;
    for (let dy = -12; dy <= 12; dy += 3) {
      const yy = floor(y + dy);
      if (yy >= 0 && yy < H && xe < W) lit = max(lit, abs(S.F[yy * W + xe]));
    }
    if (lit < 0.25 && !ahead(S, edgeX(S, y) + 1, y, normalAt(S, y), 3, 15, 0.1)) {
      ok = true;
      break;
    }
  }
  if (!ok) return;
  const x = edgeX(S, y) + 0.6, an = normalAt(S, y);
  const a0 = an + 0.3 * gauss();
  const aS = abs(S.Ba) / max(P.g, 1e-3);
  const big = rnd() < 0.62;
  const reach = big ? cl(50 + 0.7 * aS * (0.75 + 0.6 * rnd()), 68, 125) : 30 + 28 * rnd();
  if (big) S.lastBig = S.t;
  const v = cl(0.7 + 0.6 * abs(S.Ba), 0.9, 1.35) * (0.9 + 0.2 * rnd());
  S.tips.push({ x, y, a: a0, v, rw: 1.55, life: reach, gen: 0, since: 4, sgn, sp: 52 + 28 * rnd(), alive: true, len: 0, id: ++S.nid, tr: { n: 1 } });
  S.alive++;
  S.lastAval = S.t;
  // the root flashes
  stamp(S, x + 1, y, 1.8, v, sgn, 1);
  S.skirtAcc = 99;
}
function sampD(S, x, y) {
  const cx = floor(x), cy = floor(y);
  if (cx < 0 || cx >= W || cy < 0 || cy >= H) return 0;
  return ss(0.12, 0.4, abs(S.F[cy * W + cx]));
}
// the finger itself, a capsule's worth of soft disc, and its hot flash
function stamp(S, x, y, rw, v, sgn, hotv) {
  const R = rw + 1.2, x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R)), y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
  const F = S.F, hot = S.hot, s = S.s;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const i = cy * W + cx;
      if (s[i] < 0.2) continue;
      const dx = cx + 0.5 - x, dy = cy + 0.5 - y, cov = cl(rw + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
      if (cov <= 0) continue;
      const val = v * cov;
      if (sgn > 0) {
        if (val > F[i]) F[i] = val;
        if (hotv * cov > hot[i]) hot[i] = hotv * cov;
      } else if (-val < F[i]) F[i] = -val;
    }
}
// the flooded zone round the finger
function skirt(S, x, y, rw, v, sgn) {
  const R = rw + 9, x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R)), y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
  const F = S.F, s = S.s, rn = S.rn;
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const i = cy * W + cx;
      if (s[i] < 0.2) continue;
      const dx = cx + 0.5 - x, dy = cy + 0.5 - y, d = sqrt(dx * dx + dy * dy);
      if (d <= rw || d > R) continue;
      const val = 0.2 * v * exp(-(d - rw) / 4) * (0.35 + 1.1 * rn[i]);
      if (sgn > 0) {
        if (val > F[i]) F[i] = val;
      } else if (-val < F[i]) F[i] = -val;
    }
}
function walk(S, P, t, dt) {
  let rem = t.sp * dt;
  while (rem > 1e-6 && t.alive) {
    const ds = min(STEP, rem);
    rem -= ds;
    const an = normalAt(S, t.y);
    // heading: a random step, a gentle pull to the normal, away from flux laid, never far from the normal
    const pr = 7, ph = 0.55;
    const dP = sampD(S, t.x + pr * cos(t.a + ph), t.y + pr * sin(t.a + ph)) + 0.6 * sampD(S, t.x + 3.5 * cos(t.a + ph), t.y + 3.5 * sin(t.a + ph));
    const dM = sampD(S, t.x + pr * cos(t.a - ph), t.y + pr * sin(t.a - ph)) + 0.6 * sampD(S, t.x + 3.5 * cos(t.a - ph), t.y + 3.5 * sin(t.a - ph));
    t.a += P.sig * sqrt(ds) * gauss() + 0.01 * sin(an - t.a) * ds + 0.2 * (dM - dP) * ds;
    t.a = an + cl(t.a - an, -0.95, 0.95);
    t.x += cos(t.a) * ds;
    t.y += sin(t.a) * ds;
    t.life -= ds;
    t.since += ds;
    t.len += ds;
    // blocked by flux already laid, a few LED ahead
    if (t.since > 6) {
      const bl = sampD(S, t.x + 2.6 * cos(t.a), t.y + 2.6 * sin(t.a)) + sampD(S, t.x + 4.5 * cos(t.a), t.y + 4.5 * sin(t.a)) * 0.7 +
        0.6 * (sampD(S, t.x + 3.5 * cos(t.a + 0.5), t.y + 3.5 * sin(t.a + 0.5)) + sampD(S, t.x + 3.5 * cos(t.a - 0.5), t.y + 3.5 * sin(t.a - 0.5)));
      if (bl > 0.5) t.alive = false;
    }
    if (t.life <= 0 || S.s[cl(floor(t.y), 0, H - 1) * W + cl(floor(t.x), 0, W - 1)] < 0 || t.x > W + 5 || t.y < -5 || t.y > H + 5 || t.x < -2) t.alive = false;
    // a fork: a split into two that open out, or a side finger that leaves the trunk
    if (t.alive && t.since > 7 && t.life > 14 && S.alive < CAP_TIPS && t.tr.n < CAP_SPAWN && rnd() < P.pf * ds) {
      const side = rnd() < 0.55, sd = rnd() < 0.5 ? 1 : -1;
      let c, th = 0, u = 0;
      if (side) {
        c = { x: t.x, y: t.y, a: t.a + sd * (0.7 + 0.4 * rnd()), v: t.v * 0.9, rw: 0, life: t.life * (0.45 + 0.35 * rnd()), gen: t.gen + 1, since: -4, sgn: t.sgn, sp: t.sp * (0.85 + 0.2 * rnd()), alive: true, len: 0, id: ++S.nid, tr: t.tr };
        t.since = 3;
      } else {
        th = P.th * (0.7 + 0.6 * rnd());
        u = 0.3 + 0.4 * rnd();
        c = { x: t.x, y: t.y, a: t.a - th * (1 - u), v: t.v * 0.96, rw: 0, life: t.life * (0.75 + 0.2 * rnd()) - 3, gen: t.gen + 1, since: 0, sgn: t.sgn, sp: t.sp * (0.9 + 0.2 * rnd()), alive: true, len: 0, id: ++S.nid, tr: t.tr };
        t.a += th * u;
        t.since = 0;
        t.life = t.life * 0.93;
      }
      if (!ahead(S, c.x, c.y, c.a, 4, 10, 0.4)) {
        S.tips.push(c);
        t.tr.n++;
        S.alive++;
      } else if (!side) {
        t.a -= th * u;
      }
    }
    const rw = max(1.05, 1.55 - 0.2 * t.gen);
    t.rw = rw;
    const dim = 0.74 + 0.26 * ss(0, 40, t.life);
    stamp(S, t.x, t.y, rw, t.v * dim, t.sgn, 1);
    S.skirtAcc += ds;
    if (S.skirtAcc > 2.2) {
      skirt(S, t.x, t.y, rw, t.v * dim, t.sgn);
      S.skirtAcc = 0;
    }
  }
}
function grow(S, P, dt) {
  const tips = S.tips;
  let n = 0;
  for (let i = 0; i < tips.length; i++) if (tips[i].alive) n++;
  S.alive = n;
  // tips born in this loop are walked in the next step
  const len = tips.length;
  for (let i = 0; i < len; i++) if (tips[i].alive) walk(S, P, tips[i], dt);
  if (tips.length) {
    let k = 0;
    for (let i = 0; i < tips.length; i++) if (tips[i].alive) tips[k++] = tips[i];
    tips.length = k;
    S.alive = k;
  }
}

function slice(S, out) {
  const k = S.mk++, sd = S.seed + 50;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = 0.65 * vn2(x / 10 + 3.1 * k, y / 10, sd + k * 7) + 0.35 * vn2(x / 4.2, y / 4.2 + 2.7 * k, sd + 3 + k * 5);
}
function step(S, dt) {
  const P = knobs(S.ks);
  sweep(S, P, dt);
  bean(S, P.g);
  // flux entering the film is what fires an avalanche
  const ab = abs(S.Ba), rate = (ab - S.absPrev) / max(dt, 1e-3);
  S.absPrev = ab;
  S.inflow += (max(0, rate) - S.inflow) * (1 - exp(-dt / 1.2));
  if (S.t >= S.next) {
    if (S.Ba > 0.12 && S.tips.length < 10) {
      const n0 = S.tips.length;
      launch(S, P, S.Ba >= 0 ? 1 : -1);
      S.next = S.t + (n0 === S.tips.length ? 0.5 : (3 + 3.5 * rnd()) / (0.7 + 1.5 * P.evk * S.inflow));
    } else S.next = S.t + 0.5;
  }
  grow(S, P, dt);
  // creep and cooling
  const kF = exp(-dt / TAU_F), kH = exp(-dt / TAU_H), F = S.F, hot = S.hot;
  for (let i = 0; i < N; i++) {
    F[i] *= kF;
    hot[i] *= kH;
  }
  S.mt += dt;
  if (S.mt > TM) {
    S.mt -= TM;
    S.mA.set(S.mB);
    slice(S, S.mB);
  }
  S.t += dt;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    buildFilm(S);
    slice(S, S.mA);
    slice(S, S.mB);
    // pre-roll: sweep the field at a pace that does not depend on the Sweep knob, until it is out and a tree is young
    const P = knobs(S.ks);
    S.tm = cl(1 / P.m, 1, 4);
    S.Ba = 0.04;
    S.sw.tgt = 0.7 + 0.35 * rnd();
    S.sw.dir = 1;
    S.sw.r = 0.8 + 0.6 * rnd();
    S.t = 0;
    let n = 0;
    for (; n < 900; n++) {
      step(S, 0.25);
      const age = S.t - S.lastBig;
      if (S.t > 80 && S.Ba > 0.3 && S.Ba < 0.85 && age > 3 && age < 35 && S.tips.length === 0) break;
    }
    if (n >= 900) {
      launch(S, P, 1);
      for (let q = 0; q < 16; q++) step(S, 0.25);
    }
    S.tm = 1;
    S.next = max(0.5, S.next - S.t);
    S.lastAval -= S.t;
    S.lastBig -= S.t;
    S.t = 0;
  }
  const e = 1 - exp(-d / 0.3);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  step(S, d);
}

// ---- drawing
const hsv = (h, s, v, out) => {
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const m = ((i % 6) + 6) % 6;
  out[0] = m === 0 ? v : m === 1 ? q : m === 2 ? p : m === 3 ? p : m === 4 ? t : v;
  out[1] = m === 0 ? t : m === 1 ? v : m === 2 ? v : m === 3 ? q : m === 4 ? p : p;
  out[2] = m === 0 ? p : m === 1 ? p : m === 2 ? t : m === 3 ? v : m === 4 ? v : q;
};
function tints(S, k) {
  if (S.hue === k) return;
  S.hue = k;
  const h = (((k + 0.235) % 1) + 1) % 1;
  hsv(h, 0.97, 1, S.tintF);
  hsv(((h + 0.045) % 1), 0.97, 1, S.tintG);
}
// b is the field the garnet sees, w what drives the climb from the film's glow to white: fingers fully, the critical state at 0.4
function tone(b, w) {
  if (b >= 0) {
    const u = b / 0.28, k = ss(0.55, 1.15, w);
    return GL + (LC - GL) * (1 - exp(-pow(u, 1.5))) + (1 - LC) * k;
  }
  return GL * (0.15 + 0.85 * exp(b / 0.15));
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  tints(S, S.ks[0]);
  const tb = S.tb, tw = S.tw, sv = S.s, b = S.b, F = S.F, Ba = S.Ba, gr = S.gr;
  // the field the garnet sees: in the film flux, rim and fingers, outside the applied field with a little compression at the edge
  for (let i = 0; i < N; i++) {
    const s = sv[i], bi = b[i], f = F[i];
    const bean = bi > 0 ? bi * gr[i] * (1 + (s > 0 ? 1.3 * exp(-s / 4) : 0)) : bi;
    const tin = bean + f, win = max(0, f) + 0.4 * max(0, bean);
    if (s >= 0.8) {
      tb[i] = tin;
      tw[i] = win;
    } else {
      const bo = Ba * 0.18 * (1 + 2.2 * exp(min(s, 0) / 2.2)), t = ss(-0.8, 0.8, s);
      tb[i] = bo + (tin - bo) * t;
      tw[i] = 0.4 * max(0, bo) + (win - 0.4 * max(0, bo)) * t;
    }
  }
  const mA = S.mA, mB = S.mB, mw0 = ss(0, 1, S.mt / TM);
  const tF = S.tintF, tG = S.tintG, hot = S.hot;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const bb = tb[i];
      let L = tone(bb, tw[i]);
      if (L > GL) L *= 1 + 0.3 * (mA[i] + (mB[i] - mA[i]) * mw0) * ss(GL, 0.3, L);
      // the dark seam where flux and antiflux meet
      if (abs(bb) < 0.14) {
        let mx = bb, mn = bb;
        for (let q = 0; q < 4; q++) {
          const xx = x + (q === 0 ? 3 : q === 1 ? -3 : 0), yy = y + (q === 2 ? 3 : q === 3 ? -3 : 0);
          if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const v = tb[yy * W + xx];
          if (v > mx) mx = v;
          if (v < mn) mn = v;
        }
        const sm = ss(0.02, 0.1, min(mx, -mn)) * exp(-(bb / 0.05) * (bb / 0.05));
        L *= 1 - 0.75 * sm;
      }
      // the glint of the cut edge
      const e = sv[i] / 0.9;
      L += 0.06 * exp(-e * e);
      L += 0.55 * hot[i] * (1 - L);
      L = cl(L, 0, 1);
      const mw = ss(0.04, 0.25, L), w = ss(0.55, 1, L) * 0.78;
      let r = (tG[0] + (tF[0] - tG[0]) * mw) * L, g = (tG[1] + (tF[1] - tG[1]) * mw) * L, bl = (tG[2] + (tF[2] - tG[2]) * mw) * L;
      r += (L - r) * w;
      g += (L - g) * w;
      bl += (L - bl) * w;
      display.setPixel(x, y, (r * 255) | 0, (g * 255) | 0, (bl * 255) | 0);
    }
  }
}
