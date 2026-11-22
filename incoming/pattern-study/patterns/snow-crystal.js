// ===== Patternflow pattern =====
// Title:   Snow Crystal
// Family:  snowcrystal
// Idea:    Several snow crystals grow at once on a deep night-blue ground, each from its own speck of ice by Reiter's cellular rule for vapour freezing onto a hexagonal lattice with its own constants from the morphology diagram, so a fat plate, a sectored plate, a stellar plate and a feathery dendrite stand side by side, thickening from violet and blue ice tints to white, with slow glints along their facets and a cool haze at the growing tips, then resting, sublimating from the tips inward and fading while new seeds are born elsewhere.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Clifford Reiter's local cellular model of snow crystal growth (2005), with the refinements of Janko Gravner and David Griffeath (2008), and Ukichiro Nakaya's morphology diagram (1954), pattern round 223
// Round:   223
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0..4, Humidity=-1..1, Crowd=-1..1
//
// Knob 1: Hue. The light the ice is seen in. At 0 the ground is deep night blue (6, 14, 44 at the top to 13, 33, 78 at the bottom) and the ice runs from violet-blue where it is thin to near white where it is thick; at 0.25 the ground is indigo and the ice violet; at 0.5 a rose-gold dawn, plum ground and ice from rose through coral to peach white; at 0.75 aurora green, a deep teal ground and ice from teal through mint to white; at 1 it is back at ice blue. Each palette is pure over 0.15 of the knob around its own position and blends over the 0.10 between, and the crystals already grown change colour with it.
// Knob 2: Speed. How fast the whole scene runs: growth, rest, sublimation and births go at 2 to the power 0.35 (knob - 2) below 2 and 2 to the power 0.8 (knob - 2) above, so 0.62 times at 0, 1 times at 2 (where it opens) and 3 times at 4. At 2 the front of a crystal moves 1.0 to 1.5 LEDs a second, so a crystal grows for 7 to 26 s by its size, rests 3.5 to 8.5 s and sublimates for 10 to 13 s. The glints keep their own slow pace at any setting, one turn of the light in 55 to 140 s.
// Knob 3: Humidity. How much vapour the air holds, which moves each crystal's three constants along the morphology diagram, a fat hexagonal plate at 0, a plate with six notched sectors at 0.3, a stellar plate at 0.45 and a feathery fern with side branches at 1 on the diagram's own axis. The knob puts the middle of the crowd at 0.10 on that axis at -1, 0.76 at 0 and 1.0 at 1. Each crystal is drawn off the middle for good, uniformly up to 0.85 either way for three in ten and by up to 0.3 for the rest, so at 0 about seven in ten are stellar dendrites and ferns and the others range from plates up, and at -1 nearly all are plates. It steers crystals that are still growing (they follow it at about a third a second), not just new ones, and it scales the vapour haze at the tips, the glow round each crystal and the mist in the ground by 0.68 times at -1, 1.2 at 0 and 1.4 at 1.
// Knob 4: Crowd. How many crystals grow at once, 4 at -1, 5 at 0 (where it opens) and 7 at 1, plus the one or two that are melting. A crowded panel holds smaller crystals: the size is 1.0 times at 4 and 0.8 times at 7 of a width of 20 to 52 LEDs. Raising the knob seeds new crystals within a second or two. Lowering it starts the most advanced crystal melting at once, then one more every 1.5 s (in scene time) until the count is down.

// What the picture is. The ground is the night blue of Hue 0, darker toward the top, with slow swells (three travelling cosines, periods of 33, 48 and 65 s, taking the ground up or down by a third at the most). On it grow 4 to 7 snow crystals, each in its own hexagonal lattice domain of radius 7 to 15 cells with the cells 2 LEDs apart, so a full-grown crystal is 4 times (radius - 2) LEDs across, 20 for the smallest and 52 for the largest. The domains sit at random angles and places, may overlap and are composited with a lighten blend, and a crystal may be cut by the edge of the panel. The seeds are placed by best candidate: of 48 random places the one furthest from the crystals already there (a melting one counts for less as it goes) wins.
// The growth is Reiter's rule. Every cell holds a water mass s, starting at the ambient beta except for a seed of seven frozen cells at 1. A cell is frozen when s >= 1 and receptive when it is frozen or touches a frozen cell. A step splits the mass of each cell in two: the receptive part stays where it is and gains gamma, the rest diffuses, each cell taking the average of its six neighbours blended with itself by alpha (new s = s + alpha/2 (mean of the six minus s)), and the border of the domain holds s = beta. Nothing is drawn from a recipe. The arms, the side branches and the notched corners all come from the lattice, so the six-fold symmetry is exact. The three constants come from one axis, the humidity h from 0 to 1, through eight anchors found by running the rule at radius 15 and looking at what it grew: (alpha, beta, gamma) = (0.5, 0.5, 0.1) at h = 0, a fat plate; (0.2, 0.62, 0.025) at 0.3, a plate with six notched sectors; (0.2, 0.7, 0.01) at 0.45, a stellar plate; (0.2, 0.78, 0.0004) at 0.72, a stellar dendrite with side branches; (0.1, 0.82, 0.00005) at 1, a long lacy fern; with alpha and beta interpolated straight and gamma by its logarithm. The lattice is stepped at a rate that aims for the front to move at 0.5 to 0.74 cells a second; a slow feedback on the front radius corrects the rate when a crystal runs ahead or behind. A step is not drawn as a jump: the picture lerps between the last two states, so a cell crossing s = 1 fades in over the fraction of a step. A seed is grown unseen to a radius of 3 cells, where the arms begin to part, and then fades in over 2.4 s.
// The picture of a crystal is built from its cells. Each cell has an ice amount (1 for a frozen cell, and from about 0.7 of the way to 1 a receptive cell that is nearly frozen counts in part, so the tip advances smoothly; a lone cell inside the ice that the lattice has not yet closed is drawn closed), a thickness that grows with the age of the cell since it froze (1 minus exp of minus the age over 30 s for a plate and 50 s for a dendrite, as ice thickens while vapour keeps landing), and a haze, the excess of s over the ambient in the cells that have not frozen, which is the supersaturated vapour at the growth front. These are splatted onto the LEDs through a soft hexagon kernel 2.1 LEDs in radius, weights normalised per LED so that a one-cell arm is still a clean 2 LED stroke after a contrast curve from 0.34 to 0.62 of cover, and the haze through a wider bump 4.2 LEDs in radius, with a faint glow round the whole crystal, the air it grows in. The thickness steps in 7 terraces with a soft edge, so the growth rings of a plate show as hexagonal bands, and picks the colour from a ramp, thin violet-blue to thick near white, with a second tint that bands with it. Facets glint: the ice is read as a height field (cover times thickness), the normal comes from its slope over 4 LEDs, and a light 42 degrees up goes slowly round the compass for each crystal, so the facets turned to it flash softly one after another and go out. The haze is added to the ground first, then each crystal's ice is mixed over it with a lighten blend.
// A crystal stops growing when it has frozen a cell 2 cells short of its domain border, so the border is never seen. It rests while the haze thins, and sublimates by running its growth backwards: each frozen cell is given the moment it goes, later the thicker (older) it is and earlier the more of its six neighbours are bare, and no cell outlives all the neighbours that froze before it. So the thin tips and side branches go first, edges and corners round off, the arms shorten toward the hub and the hub is the last to go; the whole crystal fades over its last 5 s and takes the thin tints as it thins. Births follow the count the Crowd knob names, one at most every 1.2 to 2.8 s, so the scene is never in step and never comes back to a first picture. The first update runs the crystals up to staggered ages unseen, one of them already melting, so the first frame is a scene in progress.

const W = 64, H = 128, NPX = W * H;
const { floor, ceil, sqrt, abs, exp, sin, cos, PI, min, max, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = () => Math.random();

// ---- the morphology axis: (alpha, beta, gamma) from the humidity h in 0..1
const ANCH = [
  [0.0, 0.5, 0.5, 0.1], // fat hexagonal plate
  [0.15, 0.3, 0.55, 0.05], // plate with the first notches
  [0.3, 0.2, 0.62, 0.025], // plate with six notched sectors
  [0.45, 0.2, 0.7, 0.01], // stellar plate
  [0.58, 0.2, 0.74, 0.002], // broad stellar dendrite
  [0.72, 0.2, 0.78, 0.0004], // stellar dendrite with side branches
  [0.86, 0.15, 0.8, 0.0001], // fern-like dendrite
  [1.0, 0.1, 0.82, 0.00005], // long lacy fern
];
const ANCH_LG = ANCH.map((a) => Math.log(a[3]));
function pathAt(h, out) {
  h = cl(h, 0, 1);
  let k = 0;
  while (k < ANCH.length - 2 && h > ANCH[k + 1][0]) k++;
  const a = ANCH[k], b = ANCH[k + 1], f = (h - a[0]) / (b[0] - a[0]);
  out[0] = a[1] + (b[1] - a[1]) * f;
  out[1] = a[2] + (b[2] - a[2]) * f;
  out[2] = exp(ANCH_LG[k] + (ANCH_LG[k + 1] - ANCH_LG[k]) * f);
}

// ---- the lattice domains, one per radius
const SQ3H = sqrt(3) / 2;
const PITCH = 2.0; // LEDs between neighbouring cell centres
const DOM = {};
function domain(R) {
  if (DOM[R]) return DOM[R];
  const Wd = 2 * R + 3, n = Wd * Wd, c0 = R + 1;
  const inside = new Uint8Array(n);
  const list = [], X = [], Y = [], dist = [];
  for (let r = -R; r <= R; r++) {
    for (let q = -R; q <= R; q++) {
      if (abs(q + r) > R) continue;
      const idx = (r + c0) * Wd + q + c0;
      inside[idx] = 1;
      list.push(idx);
      X.push(q + r / 2);
      Y.push(r * SQ3H);
      dist.push(Math.max(abs(q), abs(r), abs(q + r)));
    }
  }
  const d = {
    R, Wd, n, inside, nc: list.length, seed: c0 * Wd + c0,
    cells: Int32Array.from(list), X: Float32Array.from(X), Y: Float32Array.from(Y), dist: Uint8Array.from(dist),
    off: [1, -1, Wd, -Wd, 1 - Wd, Wd - 1],
  };
  DOM[R] = d;
  return d;
}

// ---- colour: four palettes round the Hue knob
// each: ground top, ground bottom, ramp thin->thick (6 stops), second tint, haze, glint
const PALS = [
  { // ice blue
    g0: [6, 14, 44], g1: [13, 33, 78],
    ramp: [[112, 98, 214], [100, 138, 232], [140, 184, 244], [190, 220, 250], [228, 242, 255], [250, 253, 255]],
    alt: [176, 126, 236], haze: [72, 150, 226], spec: [236, 248, 255],
  },
  { // violet
    g0: [10, 6, 36], g1: [24, 13, 66],
    ramp: [[104, 72, 214], [130, 94, 232], [164, 128, 244], [200, 170, 250], [234, 218, 255], [252, 246, 255]],
    alt: [120, 176, 244], haze: [136, 98, 230], spec: [248, 240, 255],
  },
  { // rose gold dawn
    g0: [20, 8, 34], g1: [52, 22, 54],
    ramp: [[176, 90, 170], [226, 118, 152], [246, 154, 150], [252, 196, 176], [255, 230, 212], [255, 248, 238]],
    alt: [255, 190, 118], haze: [232, 128, 150], spec: [255, 244, 232],
  },
  { // aurora green
    g0: [3, 14, 30], g1: [6, 36, 54],
    ramp: [[44, 128, 176], [46, 180, 192], [104, 222, 190], [168, 244, 206], [220, 255, 234], [246, 255, 248]],
    alt: [138, 120, 232], haze: [56, 214, 168], spec: [238, 255, 248],
  },
];
const LUTN = 128;
function makePalette() {
  return {
    g0: [0, 0, 0], g1: [0, 0, 0], alt: [0, 0, 0], haze: [0, 0, 0], spec: [0, 0, 0],
    lut: new Float32Array((LUTN + 1) * 3), hue: -1,
  };
}
function blendPalette(P, hue) {
  if (P.hue === hue) return;
  P.hue = hue;
  const u = ((hue % 1) + 1) % 1 * 4, ia = floor(u) % 4, ib = (ia + 1) % 4, f = sm(0.3, 0.7, u - floor(u));
  const A = PALS[ia], B = PALS[ib];
  for (let c = 0; c < 3; c++) {
    P.g0[c] = lerp(A.g0[c], B.g0[c], f);
    P.g1[c] = lerp(A.g1[c], B.g1[c], f);
    P.alt[c] = lerp(A.alt[c], B.alt[c], f);
    P.haze[c] = lerp(A.haze[c], B.haze[c], f);
    P.spec[c] = lerp(A.spec[c], B.spec[c], f);
  }
  const ramp = [];
  for (let k = 0; k < 6; k++) ramp.push([0, 1, 2].map((c) => lerp(A.ramp[k][c], B.ramp[k][c], f)));
  const stops = [0, 0.12, 0.3, 0.55, 0.8, 1];
  for (let i = 0; i <= LUTN; i++) {
    const t = i / LUTN;
    let k = 0;
    while (k < 4 && t > stops[k + 1]) k++;
    const u2 = cl((t - stops[k]) / (stops[k + 1] - stops[k]), 0, 1);
    for (let c = 0; c < 3; c++) P.lut[i * 3 + c] = lerp(ramp[k][c], ramp[k + 1][c], u2);
  }
}

// ---- the ground: three slow travelling swells, tabled once
const NCL = 3;
const CK = [[0.071, 0.043, 0.19, 1.3, 0.28], [-0.037, 0.058, 0.131, 4.1, 0.2], [0.052, -0.022, 0.097, 2.6, 0.16]]; // kx, ky, omega, phase, amplitude
const CT = new Float32Array(NCL * NPX), ST = new Float32Array(NCL * NPX);
for (let k = 0; k < NCL; k++) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = CK[k][0] * x + CK[k][1] * y + CK[k][3];
      CT[k * NPX + y * W + x] = cos(a);
      ST[k * NPX + y * W + x] = sin(a);
    }
  }
}

// ---- the footprints of a crystal's cells on the LEDs
const RI = 2.1; // ice kernel radius, LEDs
const RH = 4.2; // haze kernel radius
function buildFoot(c) {
  const D = c.D, nc = D.nc, cs = cos(c.rot), sn = sin(c.rot);
  const px = new Float32Array(nc), py = new Float32Array(nc);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let k = 0; k < nc; k++) {
    px[k] = c.cx + PITCH * (cs * D.X[k] - sn * D.Y[k]);
    py[k] = c.cy + PITCH * (sn * D.X[k] + cs * D.Y[k]);
    x0 = min(x0, px[k]); x1 = max(x1, px[k]); y0 = min(y0, py[k]); y1 = max(y1, py[k]);
  }
  const bx0 = max(0, floor(x0 - RH)), bx1 = min(W - 1, ceil(x1 + RH)), by0 = max(0, floor(y0 - RH)), by1 = min(H - 1, ceil(y1 + RH));
  c.visible = bx1 >= bx0 && by1 >= by0;
  if (!c.visible) return;
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  c.bx0 = bx0; c.by0 = by0; c.bw = bw; c.bh = bh;
  // the weights are normalised over every cell, also those whose LEDs lie off the panel, but only the LEDs on the panel are kept
  const gx0 = floor(x0 - RH), gy0 = floor(y0 - RH), gw = ceil(x1 + RH) - gx0 + 1, gh = ceil(y1 + RH) - gy0 + 1;
  const sumI = new Float32Array(gw * gh), sumH = new Float32Array(gw * gh);
  const rI2 = RI * RI, rH2 = RH * RH;
  const wI = (d) => sm(RI, 0.6, d);
  for (let k = 0; k < nc; k++) {
    const cx = px[k], cy = py[k];
    for (let y = max(gy0, floor(cy - RH)); y <= min(gy0 + gh - 1, ceil(cy + RH)); y++) {
      for (let x = max(gx0, floor(cx - RH)); x <= min(gx0 + gw - 1, ceil(cx + RH)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        if (d2 < rH2) {
          const t = 1 - d2 / rH2;
          sumH[(y - gy0) * gw + x - gx0] += t * t;
          if (d2 < rI2) sumI[(y - gy0) * gw + x - gx0] += wI(sqrt(d2));
        }
      }
    }
  }
  const iS = new Int32Array(nc + 1), hS = new Int32Array(nc + 1);
  const iP = [], iW = [], hP = [], hW = [];
  for (let k = 0; k < nc; k++) {
    iS[k] = iP.length; hS[k] = hP.length;
    const cx = px[k], cy = py[k];
    for (let y = max(by0, floor(cy - RH)); y <= min(by1, ceil(cy + RH)); y++) {
      for (let x = max(bx0, floor(cx - RH)); x <= min(bx1, ceil(cx + RH)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
        if (d2 >= rH2) continue;
        const g = (y - gy0) * gw + x - gx0, l = (y - by0) * bw + x - bx0;
        const t = 1 - d2 / rH2;
        hP.push(l); hW.push((t * t) / sumH[g]);
        if (d2 < rI2) { iP.push(l); iW.push(wI(sqrt(d2)) / sumI[g]); }
      }
    }
  }
  iS[nc] = iP.length; hS[nc] = hP.length;
  c.iS = iS; c.hS = hS;
  c.iP = Uint16Array.from(iP); c.iW = Float32Array.from(iW);
  c.hP = Uint16Array.from(hP); c.hW = Float32Array.from(hW);
  const nl = bw * bh;
  c.A = new Float32Array(nl); c.T = new Float32Array(nl); c.HZ = new Float32Array(nl);
  c.CV = new Float32Array(nl); c.HT = new Float32Array(nl); c.TT = new Float32Array(nl);
  c.mc = new Float32Array(nc); c.tc = new Float32Array(nc); c.hc = new Float32Array(nc); c.mg = new Float32Array(D.n); c.tg = new Float32Array(D.n);
}

// ---- the growth rule
const PA = [0, 0, 0];
const GROW = 0, REST = 1, MELT = 2;
function stepLattice(c, alpha, beta, gamma) {
  const D = c.D, cells = D.cells, nc = D.nc, off = D.off, s = c.s, u = c.u, rec = c.rec, nxt = c.nxt, fz = c.fz;
  const o0 = off[0], o1 = off[1], o2 = off[2], o3 = off[3], o4 = off[4], o5 = off[5];
  for (let k = 0; k < nc; k++) {
    const i = cells[k];
    const r = s[i] >= 1 || s[i + o0] >= 1 || s[i + o1] >= 1 || s[i + o2] >= 1 || s[i + o3] >= 1 || s[i + o4] >= 1 || s[i + o5] >= 1;
    rec[i] = r ? 1 : 0;
    u[i] = r ? 0 : s[i];
  }
  const h = alpha * 0.5, g = 1 / 6;
  for (let k = 0; k < nc; k++) {
    const i = cells[k];
    const m = (u[i + o0] + u[i + o1] + u[i + o2] + u[i + o3] + u[i + o4] + u[i + o5]) * g;
    const v = rec[i] ? s[i] + gamma + h * m : u[i] + h * (m - u[i]);
    nxt[i] = v;
    if (v >= 1 && fz[i] < 0) {
      fz[i] = c.age;
      const d = D.dist[k];
      if (d > c.rmax) c.rmax = d;
    }
  }
  // the border and the outside hold beta
  c.betaOut = beta;
  const outs = c.outs;
  for (let k = 0; k < outs.length; k++) u[outs[k]] = beta;
  const tmp = c.sp;
  c.sp = c.s;
  c.s = nxt;
  c.nxt = tmp;
}

// ---- the state of the whole panel
function makeState() {
  return {
    ready: false, t: 0, tg: 0, scn: 0, kn: [0, 2, 0, 0.06],
    s2: 1, hc: 0.5, Nt: 5,
    xs: [], birthAt: 0, cullAt: 0,
    pal: makePalette(), tmp: [0, 0, 0],
    G: new Float32Array(NPX * 3),
    cloud: new Float32Array(NPX),
  };
}
export function setup(params) {
  params.S = makeState();
}

function sizeScale(Nt) {
  return lerp(1.0, 0.8, cl((Nt - 4) / 3, 0, 1));
}

// where the next seed goes: of twelve random places, the one furthest from the crystals already there
function pickPlace(S, ext) {
  let best = null, bs = -1e9;
  for (let t = 0; t < 48; t++) {
    const x = 2 + rnd() * 60, y = 2 + rnd() * 124;
    let sc = 1e9;
    for (const o of S.xs) {
      // a crystal that is melting is leaving, so it takes up less room the further it has gone
      const oe = o.state === MELT ? o.ext * (1 - sm(0, o.meltDur * 0.8, o.sa)) : o.ext;
      const d = sqrt((x - o.cx) * (x - o.cx) + (y - o.cy) * (y - o.cy)) - 0.62 * (ext + oe);
      if (d < sc) sc = d;
    }
    sc += rnd() * 2;
    if (sc > bs) { bs = sc; best = [x, y]; }
  }
  return best;
}

function spawn(S) {
  const dev = rnd() < 0.3 ? (rnd() * 2 - 1) * 0.85 : (rnd() + rnd() - 1) * 0.3;
  const h0 = cl(S.hc + dev, 0, 1);
  let R = lerp(7, 14.5, Math.pow(rnd(), 0.9)) + 2.4 * (h0 - 0.5);
  R = cl(round(R * sizeScale(S.Nt)), 7, 15);
  const D = domain(R);
  const ext = (R - 2) * PITCH * 0.95;
  const pos = pickPlace(S, ext);
  const hmix = (h0 + S.hc) * 0.5;
  const p = [0, 0, 0];
  pathAt(h0, p);
  const c = {
    D, R, cx: pos[0], cy: pos[1], ext, rot: rnd() * PI * 2, dev, h0,
    s: new Float32Array(D.n).fill(p[1]), sp: null, nxt: new Float32Array(D.n), u: new Float32Array(D.n).fill(p[1]),
    rec: new Uint8Array(D.n), fz: new Float32Array(D.n).fill(-1), life: new Float32Array(D.n),
    betaOut: p[1], rmax: 0, hCur: h0,
    state: GROW, age: 0, sa: 0, acc: 0, frac: 0, adj: 1, alpha: 0,
    Tdur: 0, restDur: 3.5 + rnd() * 5, meltDur: 10 + rnd() * 3,
    est: (50 + 135 * h0) * (R - 2) / 13,
    Ac: lerp(30, 50, h0), ph2: rnd(), psi: rnd() * PI * 2, om: (0.045 + rnd() * 0.07) * (rnd() < 0.5 ? -1 : 1), wph: rnd() * 6.28,
    haze: 1, visible: true,
  };
  c.sp = c.s.slice();
  c.Tdur = (R - 2) / (0.5 + rnd() * 0.24);
  // the cells outside the domain (and the padding ring) are held at beta through u
  const outs = [];
  for (let i = 0; i < D.n; i++) if (!D.inside[i]) outs.push(i);
  c.outs = Int32Array.from(outs);
  for (let k = 0; k < c.outs.length; k++) c.u[c.outs[k]] = p[1];
  for (const o of [0, ...D.off]) { c.s[D.seed + o] = 1; c.sp[D.seed + o] = 1; c.fz[D.seed + o] = 0; }
  c.rmax = 1;
  c.hmix = hmix;
  c.born = 0;
  // a speck has to be a few cells wide before it shows: grown unseen until its radius is 3, which is where the arms begin to part
  const r0 = 3, age0 = c.Tdur * (r0 - 1) / (R - 3);
  let guard = 0;
  while (c.rmax < r0 && guard++ < 400) {
    c.age = age0 * min(1, guard / 24);
    pathAt(c.hCur, PA);
    stepLattice(c, PA[0], PA[1], PA[2]);
  }
  c.age = age0;
  c.frac = 1;
  buildFoot(c);
  S.xs.push(c);
  return c;
}

function growCrystal(S, c, sdt) {
  c.age += sdt;
  c.sa += sdt;
  c.born += sdt;
  if (c.state === GROW) {
    // steer along the morphology axis; the crystal follows the knob by about a third a second
    const target = cl(S.hc + c.dev, 0, 1);
    c.hCur += (target - c.hCur) * (1 - exp(-0.35 * sdt));
    pathAt(c.hCur, PA);
    const Rg = c.R - 2;
    const rdes = min(Rg, 1 + (Rg - 1) * c.age / c.Tdur);
    const err = (rdes - c.rmax) / Rg;
    c.adj = cl(c.adj * exp(1.3 * err * sdt), 0.3, 3.5);
    c.acc += (c.est * c.adj / c.Tdur) * sdt;
    let n = 0;
    while (c.acc >= 1 && n < 14) {
      stepLattice(c, PA[0], PA[1], PA[2]);
      c.acc -= 1;
      n++;
    }
    if (c.acc > 1) c.acc = 1;
    c.frac = c.acc;
    c.alpha = PA[0];
    if (c.rmax >= Rg || c.age > 1.8 * c.Tdur + 6) {
      c.state = REST; c.sa = 0; c.frac = 1;
    }
  } else if (c.state === REST) {
    c.frac = 1;
    c.haze = max(0.12, 1 - sm(0, 2.8, c.sa) * 0.88);
    if (c.sa > c.restDur) startMelt(c);
  }
}

// Sublimation runs the growth backwards. Each cell is given the moment it goes, later the older (thicker) it is and earlier the more of
// its six neighbours are bare, so the thin tips and edges go first, corners round off and the last of the ice is the hub.
function startMelt(c) {
  c.state = MELT; c.sa = 0; c.frac = 1; c.haze = 0;
  const D = c.D, s = c.s, off = D.off, life = c.life, fz = c.fz, tau = c.nxt;
  c.ageM = c.age;
  let tmax = 0.05;
  for (let k = 0; k < D.nc; k++) {
    const i = D.cells[k];
    if (s[i] >= 1) {
      const t = 1 - exp(-max(0, c.age - fz[i]) / c.Ac);
      tau[i] = t;
      if (t > tmax) tmax = t;
    } else tau[i] = -1;
  }
  const L = max(1, c.meltDur - 4.5) / tmax;
  for (let k = 0; k < D.nc; k++) {
    const i = D.cells[k];
    if (tau[i] < 0) { life[i] = -1; continue; }
    let e = 0;
    for (let j = 0; j < 6; j++) {
      const q = i + off[j];
      if (!D.inside[q] || tau[q] < 0) e++;
    }
    life[i] = max(0.1, 0.5 + L * tau[i] - 0.5 * e);
  }
  // no cell outlives every neighbour that froze before it, so no piece is left with nothing to hang from
  const order = [];
  for (let k = 0; k < D.nc; k++) if (life[D.cells[k]] >= 0) order.push(D.cells[k]);
  order.sort((a, b) => fz[a] - fz[b]);
  for (let n = 0; n < order.length; n++) {
    const i = order[n];
    let mo = -1;
    for (let j = 0; j < 6; j++) {
      const q = i + off[j];
      if (life[q] >= 0 && fz[q] < fz[i] - 1e-6 && life[q] > mo) mo = life[q];
    }
    if (mo >= 0 && life[i] > mo) life[i] = mo;
  }
}

// ---- the first picture: crystals at staggered ages, one of them already melting
function prerun(S) {
  const n = S.Nt;
  for (let i = 0; i < n + 1; i++) {
    const c = spawn(S);
    const span = c.Tdur + c.restDur;
    const f = i === n ? 1.2 + rnd() * 0.5 : Math.pow(rnd(), 0.8) * 1.05;
    let left = f * span - c.age;
    if (i === n) left = span + rnd() * 0.45 * c.meltDur - c.age;
    const dt = 0.25;
    while (left > 0) {
      const d = min(dt, left);
      growCrystal(S, c, d);
      left -= d;
      if (c.state === MELT && c.sa > c.meltDur) break;
    }
  }
}

function advance(S, d, sdt) {
  S.t += d;
  S.tg += d;
  S.scn += sdt;
  const xs = S.xs;
  for (let i = 0; i < xs.length; i++) growCrystal(S, xs[i], sdt);
  for (let i = xs.length - 1; i >= 0; i--) {
    const c = xs[i];
    if (c.state === MELT && (c.sa > c.meltDur + 0.2)) xs.splice(i, 1);
  }
  // keep the count the knob names
  let act = 0;
  for (const c of xs) if (c.state !== MELT) act++;
  if (act < S.Nt && S.scn >= S.birthAt) {
    spawn(S);
    S.birthAt = S.scn + 1.2 + rnd() * 1.6;
  } else if (act > S.Nt && S.scn >= S.cullAt) {
    let pick = null, ps = -1;
    for (const c of xs) {
      if (c.state === MELT) continue;
      const sc = (c.state === REST ? 100 : 0) + c.age / c.Tdur;
      if (sc > ps) { ps = sc; pick = c; }
    }
    if (pick) {
      startMelt(pick); // it is stopped where it is
    }
    S.cullAt = S.scn + 1.5;
  }
}

export function update(dt, input, params) {
  if (!params.S) setup(params);
  const S = params.S, kn = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.kn = kn;
  {
    const k2 = cl(kn[1], 0, 4) - 2;
    S.s2 = Math.pow(2, k2 < 0 ? 0.35 * k2 : 0.8 * k2);
  }
  {
    const k3 = cl(kn[2], -1, 1);
    S.hc = k3 < 0 ? 0.76 + 0.66 * k3 : 0.76 + 0.24 * k3;
  }
  {
    const k4 = cl(kn[3], -1, 1);
    S.Nt = round(k4 < 0 ? 5 + k4 : 5 + 2 * k4);
  }
  if (!S.ready) {
    S.ready = true;
    prerun(S);
    S.birthAt = 1;
  }
  advance(S, d, d * S.s2);
}

// ---- drawing
const C0 = 0.34, C1 = 0.62; // the contrast curve on cover
function renderCrystal(S, c, G, P, hz) {
  const D = c.D, nc = D.nc, cells = D.cells, s = c.s, sp = c.sp, fz = c.fz;
  c.drawn = false;
  if (!c.visible) return;
  // alpha: fades in over the first 2.4 s of life and out over the last 3.5 s of the melt
  let alpha = sm(0, 2.4, c.born);
  if (c.state === MELT) alpha *= 1 - sm(c.meltDur - 5, c.meltDur, c.sa);
  if (alpha < 0.004) return;
  c.drawn = true;
  const mc = c.mc, tc = c.tc, hc = c.hc, mg = c.mg, tg = c.tg, frac = c.frac, beta = c.betaOut;
  const m0 = max(0.7, beta + 0.55 * (1 - beta)), ib = 1 / max(0.05, 1 - beta);
  const melting = c.state === MELT;
  c.tauMul = melting ? 0.25 + 0.75 * (1 - sm(c.meltDur - 7, c.meltDur - 1, c.sa)) : 1;
  for (let k = 0; k < nc; k++) {
    const i = cells[k];
    let m, tau = 0.04, h = 0;
    if (melting) {
      const d0 = c.life[i];
      m = d0 < 0 ? 0 : 1 - sm(d0 - 0.8, d0 + 0.8, c.sa);
      if (m <= 0.003) { mc[k] = 0; mg[i] = 0; tg[i] = 0; hc[k] = 0; continue; }
      tau = (1 - exp(-(c.ageM - fz[i]) / c.Ac)) * (0.4 + 0.6 * m);
    } else {
      const v = sp[i] + (s[i] - sp[i]) * frac;
      if (v >= 1) {
        m = 1;
        if (fz[i] >= 0) tau = 1 - exp(-max(0, c.age - fz[i]) / c.Ac);
      } else {
        m = v > m0 ? sm(m0, 1, v) : 0;
        h = (v - beta) * ib;
        if (h < 0) h = 0;
      }
    }
    mc[k] = m; mg[i] = m; tg[i] = tau; tc[k] = tau; hc[k] = h * hz;
  }
  // a lone cell that never froze inside the ice is a window the lattice has not closed yet; it is drawn closed
  if (!melting) {
    const off = D.off;
    for (let k = 0; k < nc; k++) {
      if (mc[k] >= 0.97) continue;
      const i = cells[k];
      let nb = 0, ts = 0;
      for (let j = 0; j < 6; j++) {
        const q = i + off[j];
        if (D.inside[q] && mg[q] > 0.97) { nb++; ts += tg[q]; }
      }
      if (nb >= 5) { mc[k] = 1; tc[k] = ts / nb; hc[k] = 0; }
    }
  }
  // splat
  const A = c.A, T = c.T, HZ = c.HZ, bw = c.bw, bh = c.bh, nl = bw * bh;
  A.fill(0); T.fill(0); HZ.fill(0);
  const iS = c.iS, iP = c.iP, iW = c.iW, hS = c.hS, hP = c.hP, hW = c.hW;
  for (let k = 0; k < nc; k++) {
    const m = mc[k];
    if (m > 0.003) {
      const mt = m * (tc[k] + 0.03);
      for (let e = iS[k], e1 = iS[k + 1]; e < e1; e++) {
        const l = iP[e], w = iW[e];
        A[l] += w * m;
        T[l] += w * mt;
      }
    }
    const h = hc[k];
    if (h > 0.01) {
      for (let e = hS[k], e1 = hS[k + 1]; e < e1; e++) HZ[hP[e]] += hW[e] * h;
    }
  }
  // haze first, so the ice of every crystal is mixed over all the haze
  const hr = P.haze[0] * alpha, hg = P.haze[1] * alpha, hb = P.haze[2] * alpha;
  const bx0 = c.bx0, by0 = c.by0;
  // a wide soft glow under the crystal, the air it grows in, thinner once it has stopped
  const gl = (c.state === GROW ? 1 : c.state === REST ? 0.55 : 0.55 * (1 - sm(0, 5, c.sa))) * hz * 0.06;
  const Rh = c.ext * 1.1 + 6, ir2 = 1 / (Rh * Rh);
  const gr = P.haze[0] * alpha * gl, gg = P.haze[1] * alpha * gl, gb = P.haze[2] * alpha * gl;
  for (let ly = 0; ly < bh; ly++) {
    const row = ly * bw, grow = (by0 + ly) * W + bx0, dy = by0 + ly + 0.5 - c.cy;
    for (let lx = 0; lx < bw; lx++) {
      const z = HZ[row + lx];
      const gi = (grow + lx) * 3;
      if (z > 0.003) {
        const zz = z * 0.5;
        G[gi] += hr * zz; G[gi + 1] += hg * zz; G[gi + 2] += hb * zz;
      }
      const dx = bx0 + lx + 0.5 - c.cx, q = 1 - (dx * dx + dy * dy) * ir2;
      if (q > 0) {
        const w = q * q;
        G[gi] += gr * w; G[gi + 1] += gg * w; G[gi + 2] += gb * w;
      }
    }
  }
  // cover, thickness and the height field
  const CV = c.CV, HT = c.HT, TT = c.TT;
  for (let l = 0; l < nl; l++) {
    const a = A[l];
    if (a > 0.003) {
      const cv = sm(C0, C1, a) * alpha;
      CV[l] = cv;
      // the ice thickens in terraces, one for every 1/7 of the thickness range, soft at the step
      let t = T[l] / a - 0.03;
      if (t < 0) t = 0;
      const tb = t * 7, tf = tb - floor(tb), tt = (floor(tb) + sm(0.35, 0.9, tf)) / 7;
      TT[l] = tt * 0.75 + t * 0.25;
      HT[l] = cv * (0.5 + 3 * tt);
    } else { CV[l] = 0; HT[l] = 0; TT[l] = 0; }
  }
}

function compositeCrystal(S, c, G, P) {
  if (!c.drawn) return;
  const CV = c.CV, HT = c.HT, TT = c.TT, bw = c.bw, bh = c.bh, bx0 = c.bx0, by0 = c.by0, lut = P.lut;
  const t = S.tg;
  // a light 42 degrees up that goes slowly round the compass
  const psi = c.psi + c.om * t + 0.7 * sin(0.113 * t + c.wph);
  const lx = cos(psi) * 0.74, ly = sin(psi) * 0.74, lz = 0.67;
  const hx = lx, hy = ly, hz2 = lz + 1, hn = 1 / sqrt(hx * hx + hy * hy + hz2 * hz2);
  const Hx = hx * hn, Hy = hy * hn, Hz = hz2 * hn;
  const KK = 0.62;
  const sr = P.spec[0], sg = P.spec[1], sb = P.spec[2];
  const ar = P.alt[0], ag = P.alt[1], ab = P.alt[2];
  const ph2 = c.ph2;
  const breath = 1 + 0.05 * sin(0.37 * t + c.wph);
  for (let y = 0; y < bh; y++) {
    const row = y * bw;
    for (let x = 0; x < bw; x++) {
      const l = row + x, cv = CV[l];
      if (cv < 0.004) continue;
      const tau = TT[l];
      const gi = ((by0 + y) * W + bx0 + x) * 3;
      // colour from thickness, with a faint banded second tint
      const ti = cl(tau * breath * c.tauMul, 0, 1) * LUTN, k = ti | 0, f = ti - k, j = k * 3;
      let r = lut[j] + (lut[j + 3] - lut[j]) * f, g = lut[j + 1] + (lut[j + 4] - lut[j + 1]) * f, b = lut[j + 2] + (lut[j + 5] - lut[j + 2]) * f;
      const wv = 0.5 + 0.5 * sin(6.2832 * (tau * 1.9 + ph2));
      const fr = 0.45 * wv * (1 - tau) * (0.25 + tau * 2.2);
      r += (ar - r) * fr; g += (ag - g) * fr; b += (ab - b) * fr;
      // glint from the slope of the height field
      const x0 = x > 1 ? x - 2 : 0, x1 = x < bw - 2 ? x + 2 : bw - 1, y0 = y > 1 ? y - 2 : 0, y1 = y < bh - 2 ? y + 2 : bh - 1;
      const gx = (HT[row + x1] - HT[row + x0]) / (x1 - x0), gy = (HT[y1 * bw + x] - HT[y0 * bw + x]) / (y1 - y0);
      const nx = -gx * KK, ny = -gy * KK, nn = 1 / sqrt(1 + nx * nx + ny * ny);
      let nh = (nx * Hx + ny * Hy + Hz) * nn;
      let sp = 0;
      if (nh > 0.78) {
        nh = (nh - 0.78) * 4.5;
        sp = nh * nh * nh * (0.4 + 0.6 * tau);
      }
      const R0 = G[gi], G0 = G[gi + 1], B0 = G[gi + 2];
      const nr = R0 + (r - R0) * cv, ng = G0 + (g - G0) * cv, nb = B0 + (b - B0) * cv;
      const sw = sp * 0.55 * sqrt(cv);
      const fr2 = nr + sr * sw, fg = ng + sg * sw, fb = nb + sb * sw;
      // lighten
      if (fr2 > R0) G[gi] = fr2;
      if (fg > G0) G[gi + 1] = fg;
      if (fb > B0) G[gi + 2] = fb;
    }
  }
}

export function draw(display, params) {
  const S = params.S;
  if (!S || !S.ready) return;
  const P = S.pal;
  blendPalette(P, cl(S.kn[0], 0, 1));
  const G = S.G, t = S.tg;
  // the ground
  const hum = lerp(0.6, 1.4, cl(S.hc, 0, 1));
  const g0 = P.g0, g1 = P.g1, hz = P.haze;
  const cw = [], sw = [];
  for (let k = 0; k < NCL; k++) { cw.push(cos(CK[k][2] * t)); sw.push(sin(CK[k][2] * t)); }
  const mist = 0.045 * hum;
  for (let y = 0; y < H; y++) {
    const yf = y / (H - 1);
    const br = lerp(g0[0], g1[0], yf), bg = lerp(g0[1], g1[1], yf), bb = lerp(g0[2], g1[2], yf);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let cld = 0;
      for (let k = 0; k < NCL; k++) cld += CK[k][4] * (CT[k * NPX + p] * cw[k] - ST[k * NPX + p] * sw[k]);
      const mm = 1 + 0.55 * cld;
      const add = mist * (0.5 + cld);
      G[p * 3] = br * mm + hz[0] * add;
      G[p * 3 + 1] = bg * mm + hz[1] * add;
      G[p * 3 + 2] = bb * mm + hz[2] * add;
    }
  }
  const xs = S.xs;
  for (let i = 0; i < xs.length; i++) renderCrystal(S, xs[i], G, P, hum);
  for (let i = 0; i < xs.length; i++) compositeCrystal(S, xs[i], G, P);
  for (let p = 0; p < NPX; p++) {
    const r = G[p * 3], g = G[p * 3 + 1], b = G[p * 3 + 2];
    display.setPixel(p % W, (p / W) | 0, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
  }
}
