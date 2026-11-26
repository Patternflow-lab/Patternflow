// ===== Patternflow pattern =====
// Title:   Mitochondrial Net
// Family:  mitonet
// Idea:    The mitochondria of a living cell glow lime green in a fluorescence micrograph, chains of beads joined into tubules, rods and a web that creep along invisible tracks out of a dark round nucleus and along the cell edge, while two tips that meet fuse in a flare of light, a tube that pinches thins to a thread and splits, and a piece that has lost its potential dims, turns orange-red, is cut off and cleared in a last flash, and new pieces grow in from the edge so the net never dies out, never fuses into one blob and never falls to dust.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the balance of fission and fusion that gives a cell its mitochondrial shapes, a dynamin-related GTPase cutting tubes in yeast and others joining them (Bleazard and Shaw and co-workers, 1999, from memory), reviewed as a network that stress tips toward dots or toward a web (Richard Youle and Alexander van der Bliek, 2012, from memory); a fission that cuts a depolarised piece away from the net, which then cannot fuse and is taken up by autophagy (Gilad Twig and co-workers, 2008, from memory; Richard Youle and Derek Narendra, 2011, from memory), and the rescue of a weak piece by fusing with a healthy one; tubes carried along microtubules by kinesin and dynein, which is why they run out from the nucleus and round the cell edge. Original code, pattern round 264: beads on springs with a bending stiffness, a weak turn of every tube toward the local track, tip-to-bead fusion by chance when a tip points at a bead within 4.6 LEDs, a cut whose chance grows with the size of the piece, a membrane potential on each bead that spreads along the tube, and births that step in when the mass is below its cap.
// Round:   264
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Motility=0..4, Fusion=-1..1, Stress=-1..1
//
// Knob 1: Hue. The colour of the dye, once round the wheel: lime green at 0 and 1 (hue 0.255), turquoise at 0.25, violet at 0.5, red at 0.75. A piece that has lost its potential keeps a hue 0.21 back along the wheel from the dye (red-orange on lime) and the teal where two tubes cross sits 0.19 forward, so the three stay apart at every setting.
// Knob 2: Motility. How fast the tubes crawl and how restless the net is, 0 to 4, opening at 2. The motors carry a bead 0.4 LED a second at 0, 1.4 at 2 and 3.2 at 4 (times a motor value of about 1 that wanders), the shake grows with it, and the events (pinch, fusion, hit) come at 0.55, 0.8 and 1.6 times their base rate. At 0 the web hangs nearly still and changes by its cuts and fusions; at 4 the whole net slides and sags.
// Knob 3: Fusion. The balance of fusion and fission, -1 to 1, opening at 0. A tip finds a partner 0.22 times as often at -1, as often at 0 and 4.5 times as often at 1, and a cut comes 4.5, 1 and 0.22 times as often. At -1 about 40 pieces, most of one to five beads (the net holds 98 beads at most there); at 0 17 to 24 pieces, the longest 15 to 30 beads; at 1 eight to ten pieces, one web of 30 to 55 beads with loops (the floor is 10 pieces).
// Knob 4: Stress. How much of the net loses its potential, -1 to 1, opening at 0.06. A hit lands on a random bead 0.04 times a second at 0, none at -1 and 0.33 times a second at 1 (times the pace of Motility), and takes it to a potential of 0.04 to 0.18 and its neighbours to 0.3 and 0.45. The damaged stretch is cut off, glows orange-red for 6 to 10 s and is cleared. At 1 two to five red pieces are on the panel and the net holds about 90 beads instead of 115, because the births that fill the cell lag the loss.

// What the picture is. A living cell under a fluorescence microscope. The ground is a violet-black cell with a membrane a few percent brighter at the wall, a faint deeper-violet disc 19 LEDs across for the nucleus a little above the middle,
// and a haze of blue-green ridges for the endoplasmic reticulum. The mitochondria are bright tubes 3.2 to 3.8 LEDs thick. The net is a graph of beads (radius 1.6 to 1.9 LEDs) joined by edges, so a chain, a branch (a bead with three edges),
// a loop and a lone dot are the same kind of thing, and a piece is a connected component.
// How a bead moves. Overdamped, no inertia: each step a bead moves by the sum of forces. A spring on each edge (rest length 3.1 LEDs; a new bond starts at its real length and relaxes in 2.5 s), a bending stiffness on every bead with two edges,
// a push apart under 4.9 LEDs and a weak one out to 12 so tubes spread over the cell, a wall at the nucleus and at the cell edge, and the track. The track is a field of directions, radial from the nucleus inside and along the wall near it (blended from 0.6 to 0.88 of the way to the wall),
// bent by a slow noise of up to 49 degrees so no two tubes run alike. It acts twice: each edge is turned toward the track by a weak torque (about 0.2 a second), and each bead has a motor value, a walk with a 22 s memory shared with its neighbours, that sends it up or down the track.
// Neighbouring beads agree, so a stretch walks together and its ends pull on the rest: the web stretches and sags.
// What happens. Fission: every edge has a hazard 0.0036 (0.5 + (m / 14)^1.6) a second, m the beads in its piece, so a big piece breaks more often per edge than a rod. When it fires the edge pinches for 2.2 s, narrowing at the middle to 0.12 of its width and dimming, and is cut;
// the two ends are kicked 0.9 LED a second apart. A cut that would leave one or two beads is mostly refused, a cut of a loop half as often, and none is made while the net holds 40 pieces.
// Fusion: a tip (a bead with one edge) that points at a bead within 4.6 LEDs, with a potential over 0.3, and meets another tip head on or the side of a tube at more than 44 degrees, bonds at 0.17 a second divided by 1 + n / 38 for the n tips there are, so the machinery saturates.
// Not with its own tube within 16 beads, and not between pieces while the net holds fewer than the floor (20 at -0.2 and below, 10 at 1). A bond flares 1.1 s, and the two share their potential at seven times the rate for 5 s. Tips within 12 LEDs that point at each other are drawn together.
// Potential: each bead has psi, 1 when fed. It spreads along edges at 0.14 a second, heals back to 1 at 0.03 a second above 0.5 and falls on below it, and an edge beside a bead under 0.4 has 14 times the cut hazard, so a damaged stretch is cut off within seconds.
// A piece whose mean potential is under 0.4 cannot fuse and is cleared 2.5 to 6.5 s later: a flash and a 1.4 s fade. A weak piece that fuses with a healthy one first shares its potential and is saved, the rescue by complementation.
// Births: the net has a cap of 115 beads (98 at the fragmented end) and gains 0.1 bead a second for each bead it is short, so the loss to stress is paced by the births. A new bead goes to the tip of a piece (growth), to the side of a piece of ten beads or more (a branch)
// or, in 4 births of 5 when the net has fewer pieces than the floor plus 4 and in 1 of 5 otherwise, as a pair of its own at the cell edge or the nucleus. They fade in over 1.6 s.
// The picture: each edge is rasterised as a stadium with a radius interpolated between its beads, pinched at the middle while it is cut: a body with a soft edge, a bright centre line, a halo (the body blurred, sigma 2.5) and, where two pieces share a pixel, a teal.
// Lime body, a near-white centre, red-orange and dimmer by lost potential, a pale flare at a fusion, a hot flash on a piece being cleared.
// The first update seeds 40 rods of two to eight beads and runs the model 120 s in one go, then 7 s more after a hit, so the first frame is a developed net with a dim piece in it.

const W = 64, H = 128, NPX = W * H;
const { floor, sqrt, exp, sin, cos, min, max, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();
const randn = () => (rnd() + rnd() + rnd() - 1.5) * 2;

function hash(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = floor(x), iy = floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ---- the cell
const CX = 32, CY = 64, CA = 29.4, CB = 60.8; // the wall, an ellipse bent by a few waves
const NX0 = 31, NY0 = 55, NR0 = 9.4; // the nucleus
const L0 = 3.1; // rest length of an edge
const DR = 4.9; // beads of different tubes keep this far apart
const RF = 4.6; // a tip fuses with a bead this close
const KS = 3.2, KB = 1.3, KA = 0.2, KR = 3.0, KW = 5.0;
const MAXB = 400;
const KSPREAD = 0.9; // the weak push that keeps tubes from crowding one place
const DPSI = 0.14, DEPOL = 0.4;
const NCAP = 115;

function wallS(x, y, t) { // 1 on the cell wall, 0 in the middle
  const dx = (x - CX) / CA, dy = (y - CY) / CB;
  const th = atan2(dy, dx);
  const w = 1 + 0.035 * sin(3 * th + 0.9 + 0.021 * t) + 0.025 * sin(5 * th + 2.1 - 0.013 * t) + 0.02 * sin(2 * th - 1.3 + 0.007 * t);
  const ax = abs(dx), ay = abs(dy);
  return Math.pow(ax * ax * sqrt(ax) + ay * ay * sqrt(ay), 0.4) / w;
}
function nucAt(t, out) { // centre and wobble of the nucleus
  out.x = NX0 + 0.9 * sin(t * 0.0113 + 1.0) + 0.5 * sin(t * 0.0291 + 2.0);
  out.y = NY0 + 1.1 * sin(t * 0.0089 + 0.3) + 0.6 * sin(t * 0.0237 + 4.0);
}
function nucR(th, t) {
  return NR0 * (1 + 0.06 * sin(2 * th + 0.4 + 0.017 * t) + 0.045 * sin(3 * th + 1.7 - 0.011 * t));
}

// ---- state
function makeState() {
  return {
    t: 0, ready: false, beads: [], edges: [], comps: [], stack: [], nc: 0, nal: 0, stamp: 1,
    nuc: { x: NX0, y: NY0 }, ev: { fus: 0, pin: 0, cut: 0, hit: 0, die: 0, born: 0 }, accHit: 0, accBirth: 0, pal: -1,
    K: { vm: 0.85, ev: 1, fus: 1, fis: 1, hit: 0.03, cap: NCAP, ncMin: 14, ncMax: 46, bal: 0, str: 0.06 },
    // per-frame fields
    C1: new Float32Array(NPX), C2: new Float32Array(NPX), ID: new Int32Array(NPX), DM: new Float32Array(NPX),
    FL: new Float32Array(NPX), HH: new Float32Array(NPX), HD: new Float32Array(NPX), HF: new Float32Array(NPX),
    TMP: new Float32Array(NPX), HEATA: new Float32Array(NPX), HEATB: new Float32Array(NPX), HEATC: new Float32Array(NPX),
    BR: new Float32Array(NPX), lone: [], gridHead: new Int32Array(GW * GH), gridNext: new Int32Array(MAXB),
    col: { edge: [0, 0, 0], dEdge: [0, 0, 0], body: [0, 0, 0], hot: [0, 0, 0], halo: [0, 0, 0], dBody: [0, 0, 0], dHot: [0, 0, 0], dHalo: [0, 0, 0], teal: [0, 0, 0], flare: [0, 0, 0] },
    ground: new Float32Array(NPX * 3), erT: -1000, erA: new Float32Array(NPX),
  };
}
const GS = 12, GW = 6, GH = 11; // the grid that finds near beads

export function setup(params) { params.s = makeState(); }

// ---- beads and edges
function newBead(S, x, y, psi, al) {
  const b = {
    x, y, kx: 0, ky: 0, fx: 0, fy: 0, psi, fl: 0, al, dy: -1, doom: -1,
    r: 1.6 + 0.3 * rnd(), mot: randn() * 0.6, ed: [], cid: -1, mark: 0, g: 0, bondT: 99, lt: 0.86 + 0.14 * rnd(),
  };
  S.beads.push(b);
  return b;
}
function link(S, a, b, fresh) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = sqrt(dx * dx + dy * dy);
  const e = { a, b, rest: fresh ? max(len, L0) : L0 * (0.95 + 0.1 * rnd()), rest0: L0 * (0.94 + 0.12 * rnd()), pin: -1, fr: fresh ? 1 : 0, nk: 0.8 + 0.4 * rnd() };
  a.ed.push(e); b.ed.push(e);
  S.edges.push(e);
  if (fresh) {
    S.ev.fus++;
    a.bondT = 0; b.bondT = 0;
    a.fl = 1; b.fl = 1;
    for (const q of a.ed) { const o = q.a === a ? q.b : q.a; o.fl = max(o.fl, 0.45); }
    for (const q of b.ed) { const o = q.a === b ? q.b : q.a; o.fl = max(o.fl, 0.45); }
  }
  return e;
}
function unlink(S, e) {
  let i = e.a.ed.indexOf(e); if (i >= 0) e.a.ed.splice(i, 1);
  i = e.b.ed.indexOf(e); if (i >= 0) e.b.ed.splice(i, 1);
  i = S.edges.indexOf(e); if (i >= 0) { S.edges[i] = S.edges[S.edges.length - 1]; S.edges.pop(); }
}
const other = (e, b) => (e.a === b ? e.b : e.a);

function removeBead(S, b) {
  while (b.ed.length) unlink(S, b.ed[b.ed.length - 1]);
  const i = S.beads.indexOf(b);
  if (i >= 0) { S.beads[i] = S.beads[S.beads.length - 1]; S.beads.pop(); }
}

// the track at a point: a unit vector, radial from the nucleus inside and along the wall near it
const TR = { x: 1, y: 0 };
function trackDir(S, x, y) {
  const t = S.t;
  const nx = x - S.nuc.x, ny = y - S.nuc.y;
  const r = sqrt(nx * nx + ny * ny) + 1e-6;
  let rx = nx / r, ry = ny / r;
  const dx = (x - CX) / CA, dy = (y - CY) / CB;
  const s = sqrt(dx * dx + dy * dy);
  let gx = dx / CA, gy = dy / CB;
  const gl = sqrt(gx * gx + gy * gy) + 1e-9; gx /= gl; gy /= gl;
  const tx = -gy, ty = gx;
  const w = sm(0.6, 0.88, s);
  // the tangent has no sign, so make it agree with the radial one before mixing
  const sg = rx * tx + ry * ty < 0 ? -1 : 1;
  let ux = (1 - w) * rx + w * tx * sg, uy = (1 - w) * ry + w * ty * sg;
  const ul = sqrt(ux * ux + uy * uy) + 1e-9; ux /= ul; uy /= ul;
  const an = (vnoise(x * 0.055 + t * 0.004, y * 0.055 - t * 0.003, 7) - 0.5) * 1.7;
  const c = cos(an), sn = sin(an);
  TR.x = ux * c - uy * sn; TR.y = ux * sn + uy * c;
}

// ---- components, potential and the clearing of damaged pieces
function analyse(S) {
  const B = S.beads, comps = S.comps, t = S.t;
  comps.length = 0;
  for (let i = 0; i < B.length; i++) B[i].cid = -1;
  const stack = S.stack;
  let nc = 0, nal = 0;
  for (let i = 0; i < B.length; i++) {
    const s0 = B[i];
    if (s0.cid >= 0) continue;
    const C = { n: 0, psi: 0, dying: false, doom: -1, ed: 0 };
    s0.cid = comps.length; stack.push(s0);
    while (stack.length) {
      const b = stack.pop();
      C.n++; C.psi += b.psi;
      if (b.dy >= 0) C.dying = true;
      if (b.doom >= 0) C.doom = b.doom;
      C.ed += b.ed.length;
      for (let k = 0; k < b.ed.length; k++) {
        const o = other(b.ed[k], b);
        if (o.cid < 0) { o.cid = comps.length; stack.push(o); }
      }
    }
    C.psi /= C.n; C.ed /= 2;
    comps.push(C);
    if (!C.dying) nc++;
    if (!C.dying) nal += C.n;
  }
  S.nc = nc; S.nal = nal;
  // clearing: a piece with a low mean potential is doomed, a piece that was rescued is not
  for (let i = 0; i < B.length; i++) {
    const b = B[i], C = comps[b.cid];
    if (C.dying) continue;
    if (C.psi < DEPOL) {
      if (C.doom < 0) { C.doom = t + 2.5 + 4 * rnd(); }
      b.doom = C.doom;
      if (t > C.doom) b.dy = 0;
    } else if (C.psi > 0.58) b.doom = -1;
  }
}

function pointOk(S, x, y, pad, minDist) {
  const t = S.t;
  if (wallS(x, y, t) > 0.86) return false;
  const nx = x - S.nuc.x, ny = y - S.nuc.y;
  if (sqrt(nx * nx + ny * ny) < nucR(atan2(ny, nx), t) + pad) return false;
  const B = S.beads;
  for (let i = 0; i < B.length; i++) {
    const dx = B[i].x - x, dy = B[i].y - y;
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  return true;
}

// ---- forces and motion
function forces(S, dt) {
  const B = S.beads, E = S.edges, K = S.K, t = S.t;
  for (let i = 0; i < B.length; i++) { B[i].fx = 0; B[i].fy = 0; }
  const ka = KA * (0.6 + 0.4 * K.vm);
  for (let i = 0; i < E.length; i++) {
    const e = E[i], a = e.a, b = e.b;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = sqrt(dx * dx + dy * dy) + 1e-6;
    const st = ((len - e.rest) / len) * KS;
    a.fx += dx * st; a.fy += dy * st; b.fx -= dx * st; b.fy -= dy * st;
    trackDir(S, (a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
    const dot = dx * TR.x + dy * TR.y;
    const px = dx - dot * TR.x, py = dy - dot * TR.y;
    a.fx += ka * px * 0.5; a.fy += ka * py * 0.5; b.fx -= ka * px * 0.5; b.fy -= ka * py * 0.5;
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i], n = b.ed.length;
    if (n === 2) {
      const n1 = other(b.ed[0], b), n2 = other(b.ed[1], b);
      const fx = KB * ((n1.x + n2.x) * 0.5 - b.x), fy = KB * ((n1.y + n2.y) * 0.5 - b.y);
      b.fx += fx; b.fy += fy; n1.fx -= fx * 0.5; n1.fy -= fy * 0.5; n2.fx -= fx * 0.5; n2.fy -= fy * 0.5;
    } else if (n >= 3) { // the arms of a junction push apart
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const u = other(b.ed[p], b), v = other(b.ed[q], b);
          const dx = v.x - u.x, dy = v.y - u.y, d = sqrt(dx * dx + dy * dy) + 1e-6;
          if (d < 5) { const f = (5 - d) / d * 1.2; u.fx -= dx * f; u.fy -= dy * f; v.fx += dx * f; v.fy += dy * f; }
        }
      }
    }
    // motor: up or down the track
    trackDir(S, b.x, b.y);
    const m = b.mot * K.vm;
    b.fx += TR.x * m; b.fy += TR.y * m;
    // the nucleus and the wall
    const nx = b.x - S.nuc.x, ny = b.y - S.nuc.y;
    const nd = sqrt(nx * nx + ny * ny) + 1e-6;
    const lim = nucR(atan2(ny, nx), t) + 2.6;
    if (nd < lim) { const f = (lim - nd) / nd * KW; b.fx += nx * f; b.fy += ny * f; }
    const ws = wallS(b.x, b.y, t);
    if (ws > 0.9) {
      const dx = (b.x - CX) / (CA * CA), dy = (b.y - CY) / (CB * CB);
      const gl = sqrt(dx * dx + dy * dy) + 1e-9;
      const f = (ws - 0.9) * 30 * KW / 5;
      b.fx -= dx / gl * f; b.fy -= dy / gl * f;
    }
  }
  // beads of different tubes keep apart
  const head = S.gridHead, next = S.gridNext;
  head.fill(-1);
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const cx = cl(floor(b.x / GS), 0, GW - 1), cy = cl(floor(b.y / GS), 0, GH - 1);
    b.g = cx + cy * GW;
    next[i] = head[b.g]; head[b.g] = i;
  }
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    const cx = a.g % GW, cy = (a.g / GW) | 0;
    for (let oy = -1; oy <= 1; oy++) {
      const yy = cy + oy; if (yy < 0 || yy >= GH) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const xx = cx + ox; if (xx < 0 || xx >= GW) continue;
        for (let j = head[xx + yy * GW]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const b = B[j];
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= 144) continue;
          // not neighbours, and not neighbours of a neighbour (those share a tube)
          let skip = false;
          for (let p = 0; p < a.ed.length && !skip; p++) {
            const n1 = other(a.ed[p], a);
            if (n1 === b) { skip = true; break; }
            for (let q = 0; q < n1.ed.length; q++) if (other(n1.ed[q], n1) === b && n1.ed.length < 3) { skip = true; break; }
          }
          if (skip) continue;
          const d = sqrt(d2) + 1e-6;
          let f = d < DR ? (DR - d) / d * KR : 0;
          const q = 1 - d / 12;
          f += q * q * KSPREAD / d;
          a.fx -= dx * f; a.fy -= dy * f; b.fx += dx * f; b.fy += dy * f;
        }
      }
    }
  }
}

function integrate(S, dt) {
  const B = S.beads, K = S.K;
  const sh = (0.1 + 0.3 * K.vm) * sqrt(dt);
  const kd = exp(-dt / 1.4);
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    let mx = b.fx * dt + b.kx * dt + randn() * sh * 0.6, my = b.fy * dt + b.ky * dt + randn() * sh * 0.6;
    const l = sqrt(mx * mx + my * my);
    if (l > 0.8) { mx *= 0.8 / l; my *= 0.8 / l; }
    b.x += mx; b.y += my;
    if (!(b.x > -20 && b.x < 84 && b.y > -20 && b.y < 148)) { b.x = CX; b.y = CY + 30; b.kx = 0; b.ky = 0; }
    b.kx *= kd; b.ky *= kd;
    // the motor value wanders and is shared along the tube
    let avg = 0, n = 0;
    for (let k = 0; k < b.ed.length; k++) { avg += other(b.ed[k], b).mot; n++; }
    if (n) b.mot += (avg / n - b.mot) * min(1, dt * 0.35);
    b.mot += -b.mot * dt / 22 + randn() * 0.3 * sqrt(dt);
    b.mot = cl(b.mot, -1.5, 1.5);
  }
}

// ---- chemistry: potential, flares, fades, pinches
function chem(S, dt) {
  const B = S.beads, E = S.edges, K = S.K;
  const rec = 0.03 * (1 - 0.5 * sm(0.3, 1, K.str));
  for (let i = E.length - 1; i >= 0; i--) {
    const e = E[i], a = e.a, b = e.b;
    if (e.fr > 0) e.fr = max(0, e.fr - dt / 5);
    const f = (b.psi - a.psi) * min(DPSI * (1 + 6 * e.fr) * dt, 0.4);
    a.psi += f; b.psi -= f;
    if (e.pin >= 0) {
      e.pin += dt / 2.2;
      e.rest = e.rest0 * (1 + 0.5 * min(1, e.pin));
      if (e.pin >= 1) {
        const dx = b.x - a.x, dy = b.y - a.y, d = sqrt(dx * dx + dy * dy) + 1e-6;
        a.kx -= dx / d * 0.9; a.ky -= dy / d * 0.9; b.kx += dx / d * 0.9; b.ky += dy / d * 0.9;
        unlink(S, e); S.ev.cut++;
      }
    } else {
      e.rest += (e.rest0 - e.rest) * min(1, dt / 2.5);
    }
  }
  const fd = exp(-dt / 1.1);
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i];
    b.fl *= fd;
    b.bondT += dt;
    if (b.al < 1 && b.dy < 0) b.al = min(1, b.al + dt / 1.6);
    if (b.psi > 0.5) b.psi += (1 - b.psi) * rec * dt;
    else b.psi = max(0, b.psi - 0.04 * b.psi * dt);
    if (b.dy >= 0) {
      if (b.dy === 0) { b.fl = 1.3; S.ev.die++; }
      b.dy += dt;
      b.al = cl(1 - (b.dy - 0.25) / 1.4, 0, 1);
      if (b.dy < 0.3) b.fl = max(b.fl, 1.2);
      if (b.dy > 1.8) removeBead(S, b);
    }
  }
}

// ---- events
function hit(S) {
  const B = S.beads, ok = [];
  for (let i = 0; i < B.length; i++) if (B[i].dy < 0 && B[i].psi > 0.7 && B[i].al > 0.9) ok.push(B[i]);
  if (!ok.length) return;
  const b = ok[floor(rnd() * ok.length)];
  S.ev.hit++;
  b.psi = 0.04 + 0.14 * rnd();
  for (let k = 0; k < b.ed.length; k++) {
    const o = other(b.ed[k], b);
    o.psi = min(o.psi, 0.3);
    for (let q = 0; q < o.ed.length; q++) { const o2 = other(o.ed[q], o); if (o2 !== b) o2.psi = min(o2.psi, 0.45); }
  }
}

// beads that one bead can reach in n edges (marks them with a fresh stamp)
function markNear(S, b, n) {
  const st = ++S.stamp;
  b.mark = st;
  let front = [b];
  for (let d = 0; d < n; d++) {
    const nf = [];
    for (const f of front) for (const e of f.ed) { const o = other(e, f); if (o.mark !== st) { o.mark = st; nf.push(o); } }
    front = nf;
  }
  return st;
}
function reachCount(S, a, skipEdge, target) { // beads reached from a without skipEdge, and whether target is one
  const st = ++S.stamp;
  a.mark = st;
  const stack = [a];
  let n = 0, hit2 = false;
  while (stack.length) {
    const b = stack.pop(); n++;
    for (const e of b.ed) {
      if (e === skipEdge) continue;
      const o = other(e, b);
      if (o === target) hit2 = true;
      if (o.mark !== st) { o.mark = st; stack.push(o); }
    }
  }
  return [n, hit2];
}

function fission(S, dt) {
  const E = S.edges, K = S.K, comps = S.comps;
  const k = K.fis * K.ev;
  for (let i = 0; i < E.length; i++) {
    const e = E[i];
    if (e.pin >= 0 || e.a.dy >= 0 || e.b.dy >= 0) continue;
    const m = comps[e.a.cid].n;
    const dmg = min(e.a.psi, e.b.psi) < DEPOL;
    const hz = 0.0036 * k * (0.5 + Math.pow(m / 14, 1.6)) * (dmg ? 14 : 1) * e.nk;
    if (rnd() > 1 - exp(-hz * dt)) continue;
    if (!dmg && S.nc >= K.ncMax) continue;
    const [na, loop] = reachCount(S, e.a, e, e.b);
    if (loop) { if (!dmg && rnd() > 0.5) continue; e.pin = 0; continue; }
    const side = min(na, m - na);
    if (!dmg && rnd() > cl((side - 0.5) / 2.5, 0, 1)) continue;
    e.pin = 0;
  }
}

function fusion(S, dt) {
  const B = S.beads, K = S.K;
  let tips = 0;
  for (let i = 0; i < B.length; i++) if (B[i].ed.length === 1) tips++;
  const cap = 1 / (1 + tips / 38);
  const k = K.fus * K.ev * 0.17 * cap;
  for (let i = 0; i < B.length; i++) {
    const a = B[i];
    if (a.ed.length !== 1 || a.dy >= 0 || a.al < 0.8 || a.psi < 0.3 || a.bondT < 6 || a.ed[0].pin >= 0) continue;
    const n1 = other(a.ed[0], a);
    let ux = a.x - n1.x, uy = a.y - n1.y; const ul = sqrt(ux * ux + uy * uy) + 1e-6; ux /= ul; uy /= ul;
    let best = null, bd = 1e9;
    for (let j = 0; j < B.length; j++) {
      const b = B[j];
      if (b === a || b === n1 || b.dy >= 0 || b.al < 0.8 || b.psi < 0.3 || b.ed.length > 2) continue;
      if (b.ed.length && b.ed[0].pin >= 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 > 144) continue;
      const d = sqrt(d2) + 1e-6;
      if ((dx * ux + dy * uy) / d < 0.6) continue; // the tip must point at it
      if (b.ed.length) { // and meet a tube across it, or another tip head on, never run alongside
        const m1 = other(b.ed[0], b);
        let vx = b.x - m1.x, vy = b.y - m1.y; const vl = sqrt(vx * vx + vy * vy) + 1e-6; vx /= vl; vy /= vl;
        if (b.ed.length === 1 ? ux * vx + uy * vy > -0.35 : abs(ux * vx + uy * vy) > 0.72) continue;
      }
      if (b.cid === a.cid) { markNear(S, a, 16); if (b.mark === S.stamp) continue; }
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) continue;
    if (bd > RF) { // drawn together while they point at each other
      const dx = best.x - a.x, dy = best.y - a.y, f = 0.9 * min(K.fus, 3) * (1 - bd / 12) / bd;
      a.kx += dx * f * dt * 4; a.ky += dy * f * dt * 4;
      if (best.ed.length === 1) { best.kx -= dx * f * dt * 4; best.ky -= dy * f * dt * 4; }
      continue;
    }
    if (best.cid !== a.cid && S.nc <= K.ncMin) continue;
    if (rnd() < 1 - exp(-k * dt * (best.cid === a.cid ? 0.5 : 1))) link(S, a, best, true);
  }
}

function births(S, dt) {
  const B = S.beads, K = S.K, t = S.t;
  const nal = S.nal;
  S.accBirth += 0.1 * max(0, K.cap - nal) * dt;
  let guard = 0;
  while (S.accBirth >= 1 && guard++ < 3) {
    S.accBirth -= 1;
    const few = S.nc < K.ncMin + 4;
    let mode = rnd();
    if (few) mode = mode < 0.8 ? 0 : mode;
    else mode = mode < 0.2 ? 0 : mode < 0.65 ? 1 : 2;
    for (let tr = 0; tr < 10; tr++) {
      if (mode === 0) { // a pair of its own, at the cell edge or the nucleus
        const ang = rnd() * TAU;
        const nearNuc = rnd() < 0.3;
        let x, y;
        if (nearNuc) { x = S.nuc.x + cos(ang) * (NR0 + 4.5); y = S.nuc.y + sin(ang) * (NR0 + 4.5); }
        else { const w = 0.8; x = CX + cos(ang) * CA * w; y = CY + sin(ang) * CB * w; }
        if (!pointOk(S, x, y, 3.5, 4.6)) continue;
        trackDir(S, x, y);
        const a = newBead(S, x, y, 1, 0), b = newBead(S, x + TR.x * L0, y + TR.y * L0, 1, 0);
        link(S, a, b, false);
        break;
      } else if (mode === 1) { // a tip grows a bead
        const tips = [];
        for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.ed.length === 1 && b.dy < 0 && b.psi > 0.5) tips.push(b); }
        if (!tips.length) { mode = 0; continue; }
        const a = tips[floor(rnd() * tips.length)];
        const n1 = other(a.ed[0], a);
        let ux = a.x - n1.x, uy = a.y - n1.y; const ul = sqrt(ux * ux + uy * uy) + 1e-6;
        const an = randn() * 0.3;
        ux /= ul; uy /= ul;
        const vx = ux * cos(an) - uy * sin(an), vy = ux * sin(an) + uy * cos(an);
        const x = a.x + vx * L0, y = a.y + vy * L0;
        if (!pointOk(S, x, y, 2, 3.4)) continue;
        const b = newBead(S, x, y, a.psi, 0);
        link(S, a, b, false);
        break;
      } else { // a branch on the side of a big piece
        const mids = [];
        for (let i = 0; i < B.length; i++) { const b = B[i]; if (b.ed.length === 2 && b.dy < 0 && S.comps[b.cid].n >= 10 && b.psi > 0.6) mids.push(b); }
        if (!mids.length) { mode = 1; continue; }
        const a = mids[floor(rnd() * mids.length)];
        const n1 = other(a.ed[0], a), n2 = other(a.ed[1], a);
        let ux = n2.x - n1.x, uy = n2.y - n1.y; const ul = sqrt(ux * ux + uy * uy) + 1e-6; ux /= ul; uy /= ul;
        const sg = rnd() < 0.5 ? -1 : 1;
        const x = a.x - uy * sg * L0 * 1.1, y = a.y + ux * sg * L0 * 1.1;
        if (!pointOk(S, x, y, 2, 3.6)) continue;
        const b = newBead(S, x, y, a.psi, 0);
        link(S, a, b, false);
        break;
      }
    }
  }
}

function readKnobs(S, kn) {
  const K = S.K;
  const h = cl(kn[0], 0, 1);
  const u2 = cl(kn[1], 0, 4) / 4;
  const bal = cl(kn[2], -1, 1);
  const st = cl(kn[3], -1, 1);
  K.vm = u2 < 0.5 ? mix(0.4, 1.4, Math.pow(u2 / 0.5, 0.9)) : mix(1.4, 3.2, Math.pow((u2 - 0.5) / 0.5, 1.1));
  K.ev = u2 < 0.5 ? mix(0.55, 0.8, u2 / 0.5) : mix(0.8, 1.6, (u2 - 0.5) / 0.5);
  K.fus = exp(1.5 * bal);
  K.fis = exp(-1.5 * bal);
  K.bal = bal;
  K.str = st;
  K.hit = max(0, 0.045 * exp(2.0 * st) - 0.0061);
  K.cap = NCAP * mix(0.85, 1, sm(-1, 0, bal));
  K.ncMin = floor(mix(20, 10, sm(-0.2, 1, bal)));
  K.ncMax = 40;
  if (abs(h - S.pal) > 0.0005) { S.pal = h; buildPalette(S, h); }
}

// ---- colour
function hsv(h, s, v, out) {
  h = ((h % 1) + 1) % 1;
  const i = floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const k = i % 6;
  out[0] = (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255;
  out[1] = (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255;
  out[2] = (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255;
}
function buildPalette(S, k1) {
  const c = S.col, h = 0.255 + k1, hd = h - 0.21, ht = h + 0.19;
  hsv(h, 0.95, 0.8, c.body);
  hsv(h + 0.02, 1.0, 0.42, c.edge);
  hsv(hd + 0.01, 1.0, 0.4, c.dEdge);
  hsv(h - 0.02, 0.4, 1.0, c.hot);
  hsv(h + 0.035, 1.0, 0.5, c.halo);
  hsv(hd, 1.0, 0.92, c.dBody);
  hsv(hd + 0.015, 0.7, 1.0, c.dHot);
  hsv(hd, 1.0, 0.42, c.dHalo);
  hsv(ht, 0.95, 0.95, c.teal);
  hsv(h - 0.03, 0.18, 1.0, c.flare);
}

// the ground: cell, wall, nucleus; the haze moves, so it is added in draw
function buildGround(S) {
  const g = S.ground, t = S.t, nc = S.nuc;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5;
      const s = wallS(px, py, t);
      const inside = 1 - sm(0.97, 1.03, s);
      const rim = exp(-((s - 0.965) / 0.045) * ((s - 0.965) / 0.045));
      const vg = 1 - 0.25 * sm(0.3, 1, s);
      let r = 12 * vg * inside + 2 * (1 - inside), gg = 5 * vg * inside + 1 * (1 - inside), b = 21 * vg * inside + 3 * (1 - inside);
      r += 14 * rim; gg += 5 * rim; b += 30 * rim;
      const nx = px - nc.x, ny = py - nc.y, nd = sqrt(nx * nx + ny * ny);
      const nr = nucR(atan2(ny, nx), t);
      const nu = 1 - sm(nr - 1.3, nr + 0.2, nd);
      const nring = exp(-((nd - nr - 0.8) / 1.5) * ((nd - nr - 0.8) / 1.5));
      r += 16 * nu + 5 * nring; gg += 2 * nu + 2 * nring; b += 30 * nu + 16 * nring;
      const k = (y * W + x) * 3;
      g[k] = r; g[k + 1] = gg; g[k + 2] = b;
    }
  }
  S.gT = t;
}

// ---- the model step
function step(S, dt) {
  S.t += dt;
  nucAt(S.t, S.nuc);
  analyse(S);
  forces(S, dt);
  integrate(S, dt);
  chem(S, dt);
  const K = S.K;
  S.accHit += K.hit * K.ev * dt;
  while (S.accHit >= 1) { S.accHit -= 1; hit(S); }
  fission(S, dt);
  fusion(S, dt);
  births(S, dt);
}

function seed(S) {
  nucAt(0, S.nuc);
  for (let n = 0; n < 40 && S.beads.length < 120; n++) {
    const ang = rnd() * TAU, rr = NR0 + 5 + rnd() * 40;
    const x = S.nuc.x + cos(ang) * rr * 0.75, y = S.nuc.y + sin(ang) * rr * 1.45;
    if (!pointOk(S, x, y, 3.5, 5)) continue;
    const len = 2 + floor(rnd() * 7);
    const rad = rnd() < 0.8;
    const ux = rad ? cos(ang) : -sin(ang), uy = rad ? sin(ang) : cos(ang);
    let prev = null;
    for (let i = 0; i < len; i++) {
      const bx = x + ux * i * L0, by = y + uy * i * L0;
      if (wallS(bx, by, 0) > 0.86) break;
      const b = newBead(S, bx, by, 1, 1);
      if (prev) link(S, prev, b, false);
      prev = b;
    }
  }
}

function preroll(S) {
  seed(S);
  const dt = 0.1, T = 120;
  for (let i = 0; i < T / dt; i++) step(S, dt);
  if (S.K.str > -0.5) {
    hit(S);
    for (let i = 0; i < 70; i++) step(S, dt);
  }
  analyse(S);
  buildGround(S);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  readKnobs(S, (input && input.knobValues) || [0, 2, 0, 0.06]);
  if (!S.ready) { S.ready = true; preroll(S); return; }
  let d = cl(dt || 0, 0, 0.1);
  while (d > 0) { const h = min(d, 0.05); step(S, h); d -= h; }
}

// ---- drawing
function blur(src, dst, tmp, sig) {
  const R = 7, K = new Float32Array(2 * R + 1);
  let sum = 0;
  for (let i = -R; i <= R; i++) { K[i + R] = exp(-(i * i) / (2 * sig * sig)); sum += K[i + R]; }
  for (let i = 0; i < K.length; i++) K[i] /= sum;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -R; i <= R; i++) { const xx = x + i; if (xx >= 0 && xx < W) a += src[y * W + xx] * K[i + R]; }
      tmp[y * W + x] = a;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let i = -R; i <= R; i++) { const yy = y + i; if (yy >= 0 && yy < H) a += tmp[yy * W + x] * K[i + R]; }
      dst[y * W + x] = a;
    }
  }
}

function raster(S) {
  const E = S.edges, C1 = S.C1, C2 = S.C2, ID = S.ID, DM = S.DM, FL = S.FL, BR = S.BR;
  C1.fill(0); C2.fill(0); ID.fill(-1); DM.fill(0); FL.fill(0); BR.fill(0);
  const A = S.HEATA, Bh = S.HEATB, Cf = S.HEATC;
  const lone = S.lone;
  lone.length = 0;
  for (let i = 0; i < S.beads.length; i++) { const b = S.beads[i]; if (!b.ed.length) lone.push({ a: b, b, pin: -1 }); }
  const nE = E.length;
  for (let ei = 0; ei < nE + lone.length; ei++) {
    const e = ei < nE ? E[ei] : lone[ei - nE], a = e.a, b = e.b;
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    const ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey + 1e-9;
    const alA = a.al, alB = b.al;
    if (alA < 0.01 && alB < 0.01) continue;
    const pin = e.pin >= 0 ? sm(0, 1, e.pin) : 0;
    const dA = 1 - sm(0.25, 0.8, a.psi), dB = 1 - sm(0.25, 0.8, b.psi);
    const dimA = (1 - 0.3 * dA) * a.lt, dimB = (1 - 0.3 * dB) * b.lt;
    const rA = a.r * (1 + 0.22 * a.fl), rB = b.r * (1 + 0.22 * b.fl);
    const rmax = max(rA, rB) * 1.35 + 0.8;
    const x0 = max(0, floor(min(ax, bx) - rmax)), x1 = min(W - 1, floor(max(ax, bx) + rmax));
    const y0 = max(0, floor(min(ay, by) - rmax)), y1 = min(H - 1, floor(max(ay, by) + rmax));
    const cid = a.cid;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay;
        const s = cl((px * ex + py * ey) / len2, 0, 1);
        const qx = px - s * ex, qy = py - s * ey;
        const d = sqrt(qx * qx + qy * qy);
        let r = mix(rA, rB, s) * (1 - 0.15 * sin(PI * s));
        let amp = mix(alA * dimA, alB * dimB, s) * (1 - 0.1 * sin(PI * s));
        if (pin > 0) {
          const w = exp(-((s - 0.5) / 0.3) * ((s - 0.5) / 0.3));
          r *= 1 - 0.88 * pin * w;
          amp *= 1 - 0.35 * pin * w;
        }
        const rr = max(r, 0.6);
        const c = (1 - sm(0.5 * rr, 1.2 * rr, d)) * amp;
        if (c < 0.01) continue;
        const i = y * W + x;
        const q = d / (0.7 * rr), ridge = exp(-q * q) * amp;
        if (cid === ID[i]) { if (c > C1[i]) { C1[i] = c; DM[i] = mix(dA, dB, s); FL[i] = mix(a.fl, b.fl, s); } if (ridge > BR[i]) BR[i] = ridge; }
        else if (c > C1[i]) {
          if (ID[i] >= 0) C2[i] = C1[i];
          C1[i] = c; ID[i] = cid; DM[i] = mix(dA, dB, s); FL[i] = mix(a.fl, b.fl, s); BR[i] = ridge;
        } else if (c > C2[i]) C2[i] = c;
      }
    }
  }
  for (let i = 0; i < NPX; i++) {
    const c = C1[i];
    A[i] = c * (1 - DM[i]);
    Bh[i] = c * DM[i];
    Cf[i] = c * cl(FL[i], 0, 1.3);
  }
}

export function draw(display, params) {
  if (!params.s) setup(params);
  const S = params.s;
  if (!S.ready) { readKnobs(S, [0, 2, 0, 0.06]); S.ready = true; preroll(S); }
  if (S.t - S.gT > 8) buildGround(S);
  raster(S);
  blur(S.HEATA, S.HH, S.TMP, 2.5);
  blur(S.HEATB, S.HD, S.TMP, 2.5);
  blur(S.HEATC, S.HF, S.TMP, 2.8);
  const t = S.t, col = S.col, G = S.ground;
  const C1 = S.C1, C2 = S.C2, DM = S.DM, FL = S.FL, HH = S.HH, HD = S.HD, HF = S.HF, BR = S.BR;
  const tx = t * 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, k = i * 3;
      let r = G[k], g = G[k + 1], b = G[k + 2];
      // endoplasmic reticulum haze
      const n1 = vnoise(x * 0.09 + tx * 0.01, y * 0.09 - tx * 0.008, 3), n2 = vnoise(x * 0.17 - tx * 0.013, y * 0.17 + tx * 0.01, 5);
      const rg = 1 - abs(2 * (n1 * 0.6 + n2 * 0.4) - 1);
      const er = sm(0.55, 0.95, rg) * (0.45 + 0.55 * n2);
      if (G[k + 2] > 10) { g += 20 * er; b += 15 * er; }
      // halo
      const hh = HH[i], hd = HD[i], hf = HF[i];
      r += col.halo[0] * hh * 1.5 + col.dHalo[0] * hd * 1.5 + col.flare[0] * hf * 0.16;
      g += col.halo[1] * hh * 1.5 + col.dHalo[1] * hd * 1.5 + col.flare[1] * hf * 0.16;
      b += col.halo[2] * hh * 1.5 + col.dHalo[2] * hd * 1.5 + col.flare[2] * hf * 0.16;
      // the tube
      const c = C1[i];
      if (c > 0.004) {
        const dm = DM[i], fl = cl(FL[i], 0, 1.3);
        const br = BR[i];
        const hot = sm(0.55, 1, br), bod = sm(0.08, 0.6, br);
        const er0 = mix(col.edge[0], col.dEdge[0], dm), eg0 = mix(col.edge[1], col.dEdge[1], dm), eb0 = mix(col.edge[2], col.dEdge[2], dm);
        let tr = mix(er0, mix(col.body[0], col.dBody[0], dm), bod), tg = mix(eg0, mix(col.body[1], col.dBody[1], dm), bod), tb = mix(eb0, mix(col.body[2], col.dBody[2], dm), bod);
        const hr = mix(col.hot[0], col.dHot[0], dm), hg = mix(col.hot[1], col.dHot[1], dm), hb = mix(col.hot[2], col.dHot[2], dm);
        tr = mix(tr, hr, hot * 0.8); tg = mix(tg, hg, hot * 0.8); tb = mix(tb, hb, hot * 0.8);
        const ov = min(c, C2[i]);
        if (ov > 0.05) { const w = sm(0.05, 0.6, ov) * 0.7; tr = mix(tr, col.teal[0], w); tg = mix(tg, col.teal[1], w); tb = mix(tb, col.teal[2], w); }
        if (fl > 0.02) { const w = min(1, fl) * 0.85 * hot + min(1, fl) * 0.25; tr = mix(tr, mix(col.flare[0], col.dHot[0], dm), w); tg = mix(tg, mix(col.flare[1], col.dHot[1], dm), w); tb = mix(tb, mix(col.flare[2], col.dHot[2], dm), w); }
        const cc = c > 1 ? 1 : c;
        r = r * (1 - cc) + tr * cc; g = g * (1 - cc) + tg * cc; b = b * (1 - cc) + tb * cc;
      }
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
