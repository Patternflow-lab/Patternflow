// ===== Patternflow pattern =====
// Title:   Compulsory Figures
// Family:  compulsory
// Idea:    Seen from straight above, dark polished rink ice under arena lights fills with school figures, circle eights, serpentines, threes, loops and brackets that two or three blades trace three times on each foot so every circle becomes a band of close silver lines glinting where it runs across the light, until a resurfacing pass sweeps a wet mirror lane over them that dries back to matte.
// Author:  patternflow-lab
// Date:    2026-11-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: school figures, the compulsory figures of figure skating, traced on a clean patch three times on each foot and judged from the tracings until the ISU dropped them from competition after the 1990 season (from memory); the ice resurfacer that lays a film of water in lanes (Frank Zamboni, 1949, from memory); the anisotropic highlight of scratched and brushed surfaces, bright where a groove runs across the light (Kajiya, 1985, from memory). Original here: blades that integrate constant-curvature edges with cusp turns into a persistent scratch buffer that keeps each groove's direction, lit by drifting lamps, and lanes of wet ice that erase it and dry, pattern round 262
// Round:   262
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=0.2..3, Size=-1..1, Turns=-1..1
//
// Knob 1: Hue. The arena lights over the ice: cool white-blue house lights at 0, warm sodium gold at 0.25, a magenta show light at 0.5, aqua at 0.75 and back to white-blue at 1. The ice stays a deep navy; the lamp reflections and the silver of the tracings take the tint.
// Knob 2: Pace. How fast the blades skate, 3.75 LED a second for each unit: 7.5 at 2 where it opens, so a circle of 31 LED takes about 13 s and a whole figure about a minute and a half; 0.75 at the minimum, a slow crawl; 11 at 3. Resurfacing and the dulling of old grooves follow the skating done, so the ice wears alike at any pace.
// Knob 3: Size. The circle diameter of each new figure, 22 LED at -1, 31 at 0 and 44 at 1, give or take 12 percent. Below about -0.4 three blades work at once, above it two. A serpentine is one figure in eight at -1 and one in three at 1, so big figures run the length of the panel.
// Knob 4: Turns. Which figures the skaters choose. At -1 plain circle eights; in the middle threes and double threes, a sharp cusp pointing into the circle; at 1 loops, brackets, rockers and counters, so the tracings fill with points and little loops. A blade already skating finishes its lobe and changes figure when Size or Turns has moved far.

// What the picture is. Ice 64 by 128 LED seen from straight above. A figure is built in its own frame from arcs: an eight is two circles
// of radius R touching at the start point, both skated off it the same way so the path is an S there; a serpentine is three circles in a
// row, the middle one skated in two halves with a change of edge at the far junction. A turn is a radial cusp on an arc, r -= d (1 - |u|)^2.5
// over 4 or 5 LED each side: inward for a three, outward for a bracket, two for a double three, and at the junction where the edge changes
// for a rocker (pointing into the circle being left) or a counter (into the one entered). A loop adds a turning offset rl (sin p, 1 - cos p)
// that curls a loop of 7 or 8 LED inside the top of the circle. Each foot traces its lobe three times; a tracing sets down within 0.3 LED of
// the start point and strays up to about 1.2 LED either way across the circle from it, so the lines meet at the start and open into a band
// of two or three elsewhere. The speed surges to 1.45 times after a push and decays toward 0.6 along the circle, drops 40 percent through a
// turn, and follows the real path length through cusps and loops. Every 0.45 LED the blade lays a gaussian stroke (sigma 0.72 LED, about
// 2 LED wide) into a float buffer of depth, deeper at a turn's tip, with the depth-weighted double-angle direction of the groove. A turn and
// a push throw a faint spray of snow. After a figure a blade waits a few seconds and starts the next on the cleanest ice clear of the others.
// Resurfacing. After every 950 LED of skating or so (47 to 103 s apart at the opening, 75 on average, never under 35 s) a pass sweeps a lane
// 18 to 26 LED wide across the panel at 9 LED a second over the most worn ice, turning round each time. It takes nine tenths of the depth
// under it, so a ghost of the old figures stays, and leaves a wet film that dries back to matte in patches over about 20 s. Grooves also
// dull by e every 320 s of skating at Pace 2. Before the first frame the blades skate 4800 LED, and a pass is a third to a half across.
// Drawing. Nine lamps scattered over a torus larger than the panel are mirrored in the ice and wander at 1.1 LED a second on a heading
// that random-walks: a broad haze on matte ice (sigma 13 LED), a sharp image on wet ice (sigma 5) with a glaze streaked along the lane.
// A groove's brightness is 1 - exp(-depth) times an ambient part plus a glint, strongest where it runs at right angles to the direction
// of the nearby lamps, so arcs of each circle flash and the flashes slide round as the lamps move. A fresh cut shines for a second or two.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, exp, sin, cos, min, max, abs, pow, round, PI } = Math;
const TAU = 2 * PI;
const imul = Math.imul;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;

// ---- the blades
const V0 = 3.75; // LED a second for each unit of Pace
const GLIDE = 0.6, SURGE = 0.85, SURGE_L = 1.0; // speed share once the surge has gone, the surge a push adds, its decay in half circles
const D0 = 31, D_OCT = 0.5; // circle diameter at Size 0, and octaves of it for each unit of Size
const LIM_D = 27; // under this diameter three blades share the ice, over it two
const REPS = 3; // tracings on each foot
const DRIFT = 0.3, SPLIT = 1.3, WOB = 0.45; // a tracing's start offset (sd, LED), how far it strays mid-circle (LED, either way), and its wobble (LED)
const SIG = 0.72, DEP = 0.12, STEP_L = 0.45; // the stroke's gaussian, the depth one splat lays, the splat spacing (LED)
const I2S = 1 / (2 * SIG * SIG);
const CUSP = 2.5; // a turn's radial cusp goes as (1 - |u|)^CUSP, a sharp point
// ---- the ice
const WORK0 = 950; // LED of skating between resurfacings, on average
const KEEP = 0.9; // the share of a groove's depth a pass takes away; a ghost of the deepest stays
const LANE_MIN_T = 35, LANE_V = 9, DRY = 22; // s between passes at least, LED a second of the pass, s for wet ice to dry
const PRE_WORK = 4800; // LED skated before the first frame
const SNOW_TAU = 150, FRESH_TAU = 1.6, AGE_TAU = 320; // s: snow melting, a fresh cut's shine, a groove dulling under frost
const NL = 9, LDW = 150, LDH = 210; // the lamps: nine scattered on a torus of LDW x LDH LED
const SM = 13, SG = 5, SB = 26; // lamp image on matte ice, on wet ice, and the reach over which a lamp lights grooves
const LAMP_V = 1.1, LAMP_TURN = 0.16; // the lamps' drift, LED a second, and how fast its heading wanders, rad per root second
// ---- drawing
const AMB = 0.55, GLN = 1.25; // a groove's ambient share and its glint
const SHEEN = 0.13; // the streaky glaze of wet ice
const MAT = 0.24, GLS = 1.0, FR = 0.3, SNW = 0.9, FG = 0.16; // matte haze, wet image, fresh cut, snow, the pass's front

// the lights: lamp colour L, groove silver S, ice I, snow N
const PAL = [
  { L: [176, 212, 255], S: [226, 232, 242], I: [6, 17, 34], N: [222, 234, 252] }, // cool white-blue house lights
  { L: [255, 178, 84], S: [246, 228, 200], I: [9, 16, 32], N: [246, 234, 214] }, // sodium gold
  { L: [232, 84, 214], S: [240, 216, 242], I: [13, 10, 36], N: [242, 224, 246] }, // magenta show light
  { L: [64, 226, 212], S: [210, 244, 238], I: [3, 21, 30], N: [216, 246, 240] }, // aqua
];

function hv(i, j, k) {
  let h = imul(i, 0x27d4eb2d) ^ imul(j, 0x165667b1) ^ imul(k, 0x5bd1e995);
  h = imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; h = imul(h, 0xc2b2ae35);
  return ((h >>> 8) & 0xffff) / 32767.5 - 1;
}
function vn2(x, y, k) {
  const xi = floor(x), yi = floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hv(xi, yi, k), b = hv(xi + 1, yi, k), c = hv(xi, yi + 1, k), d = hv(xi + 1, yi + 1, k);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx;
  return x0 + (x1 - x0) * fy;
}

function blade(i) {
  return { st: 0, wait: 0.5 + 3 * i, hd: 0, segs: null, si: 0, f: 0, x: -99, y: -99, str: 1, sinceP: 0, R: 15, k3: 0, k4: 0, pc: 0, lo: 0, spr: false, px: 0, py: 0, ca: 1, sa: 0, my: 1, cx: [], cy: [] };
}

function makeState() {
  const S = {
    ready: false, t: 0, ks: [0, 2, 0, 0.06],
    acc: new Float32Array(N), tc: new Float32Array(N), ts: new Float32Array(N), snow: new Float32Array(N), fresh: new Float32Array(N),
    wet: new Float32Array(N), mark: new Float32Array(N), frost: new Float32Array(N), dn: new Float32Array(N), wetOn: false,
    bl: [blade(0), blade(1), blade(2)],
    lane: { on: false, cx: 0, cy: 0, ux: 0, uy: 1, nx: -1, ny: 0, hw: 10, f: 0, end: 0, sd: 0 }, ldir: 1,
    workSince: 0, workTotal: 0, workThr: WORK0 * (0.6 + 0.8 * rnd()), laneT: 0,
    lbx: new Float32Array(NL), lby: new Float32Array(NL), lI: new Float32Array(NL), lf: new Float32Array(NL * 2), lp: new Float32Array(NL * 2),
    lox: rnd() * LDW, loy: rnd() * LDH, lh: rnd() * TAU,
    LX: new Float32Array(NL * W), EXM: new Float32Array(NL * W), EXG: new Float32Array(NL * W), EXB: new Float32Array(NL * W),
    LY: new Float32Array(NL * H), EYM: new Float32Array(NL * H), EYG: new Float32Array(NL * H), EYB: new Float32Array(NL * H),
    buf: new Float32Array(N * 3), palAt: -1, pal: null,
  };
  const sd = (rnd() * 1e6) | 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      S.frost[k] = 0.6 * vn2(x / 15, y / 15, sd) + 0.4 * vn2(x / 5.5, y / 5.5, sd + 1);
      S.dn[k] = 0.5 + 0.5 * (0.7 * vn2(x / 8, y / 8, sd + 2) + 0.3 * vn2(x / 3, y / 3, sd + 3));
    }
  }
  // the lamps scattered over the torus, each as far from the others as the best of 12 tries
  for (let n = 0; n < NL; n++) {
    let bd = -1;
    for (let c = 0; c < 12; c++) {
      const x = rnd() * LDW, y = rnd() * LDH;
      let d = 1e9;
      for (let m = 0; m < n; m++) {
        let dx = abs(x - S.lbx[m]), dy = abs(y - S.lby[m]);
        dx = min(dx, LDW - dx); dy = min(dy, LDH - dy); d = min(d, dx * dx + dy * dy);
      }
      if (d > bd) { bd = d; S.lbx[n] = x; S.lby[n] = y; }
    }
    S.lI[n] = 0.7 + 0.3 * rnd(); S.lf[2 * n] = 0.02 + 0.03 * rnd(); S.lf[2 * n + 1] = 0.015 + 0.03 * rnd(); S.lp[2 * n] = rnd() * TAU;
    S.lp[2 * n + 1] = rnd() * TAU;
  }
  return S;
}

export function setup(params) {
  params.s = makeState();
}

// ---- figures
const tmp = new Float32Array(4);

function arc(cx, cy, r, a0, sw) {
  return { cx, cy, r, a0, sw, len: abs(sw) * r, ev: [], lp: null, sp0: 0, sp1: 0, sw0: 1, sw1: 1, push: false, ox: 0, oy: 0, da: 0, wk: 1 + rnd(), wp: rnd() * TAU };
}
// a foot's tracing: its offset and its scale about the start point
function foot(R) {
  return [gauss() * DRIFT, gauss() * DRIFT, (rnd() * 2 - 1) * SPLIT * (0.7 + R / 52)];
}
function put(sg, o) {
  sg.ox = o[0]; sg.oy = o[1]; sg.da = o[2];
}
// kinds: 0 plain, 1 three, 2 double three, 3 loop, 4 bracket, 5 rocker, 6 counter
function turns(sg, kind, R) {
  const w = (3.4 + 0.06 * R) / sg.len, dc = 4.0 + 0.09 * R;
  if (kind === 1 || kind === 5) sg.ev.push({ f: 0.5, w, d: dc });
  else if (kind === 2) sg.ev.push({ f: 1 / 3, w, d: dc }, { f: 2 / 3, w, d: dc });
  else if (kind === 4 || kind === 6) sg.ev.push({ f: 0.5, w, d: -0.85 * dc });
  else if (kind === 3) sg.lp = { f: 0.5, w: (3.2 + 0.05 * R) / sg.len, rl: 2.9 + 0.045 * R };
}
// a rocker's cusp at the junction points into the circle being left, a counter's into the one entered
function joint(a, b, kind, R) {
  const dj = 4.2 + 0.08 * R, hl = 3.8 + 0.05 * R, s = kind === 5 ? 1 : -1;
  a.sp1 = -s * dj; a.sw1 = hl / a.len; b.sp0 = s * dj; b.sw0 = hl / b.len;
}
function build(B, kind, serp, R) {
  const segs = [], rock = kind === 5 || kind === 6;
  for (let rep = 0; rep < REPS; rep++) {
    if (!serp) {
      const a = arc(-R, 0, R, 0, TAU), b = arc(R, 0, R, PI, -TAU), oa = foot(R);
      put(a, oa); put(b, rock ? oa : foot(R)); a.push = true; b.push = !rock; turns(a, kind, R); turns(b, kind, R);
      if (rock) joint(a, b, kind, R);
      segs.push(a, b);
    } else {
      const a = arc(-R, 0, R, 0, TAU), mt = arc(R, 0, R, PI, -PI), c = arc(3 * R, 0, R, PI, TAU), mb = arc(R, 0, R, 0, -PI), o = foot(R);
      put(a, foot(R)); put(mt, o); put(c, o); put(mb, o); a.push = true; mt.push = true; turns(a, kind, R); turns(c, kind, R);
      if (rock) { joint(mt, c, kind, R); joint(c, mb, kind, R); }
      segs.push(a, mt, c, mb);
    }
  }
  B.segs = segs;
  return serp ? [-R, R, 3 * R] : [-R, R];
}

// where the blade is at fraction f of a segment, in panel LED; also how deep in a turn (tmp[2]) and in a loop (tmp[3])
function posAt(B, sg, f, out) {
  const a = sg.a0 + sg.sw * f, ca = cos(a), sa = sin(a);
  // a tracing sets off from the start point almost exactly and strays most across the circle from it
  let r = sg.r + sin(PI * f) * (sg.da + WOB * sin(TAU * sg.wk * f + sg.wp)), cu = 0;
  const ev = sg.ev;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], u = abs(f - e.f) / e.w;
    if (u < 1) {
      const p = (1 - u) ** CUSP;
      r -= e.d * p;
      if (p > cu) cu = p;
    }
  }
  if (sg.sp0 !== 0 && f < sg.sw0) {
    const p = (1 - f / sg.sw0) ** CUSP;
    r += sg.sp0 * p;
    if (p > cu) cu = p;
  }
  if (sg.sp1 !== 0 && f > 1 - sg.sw1) {
    const p = (1 - (1 - f) / sg.sw1) ** CUSP;
    r += sg.sp1 * p;
    if (p > cu) cu = p;
  }
  let lx = sg.cx + sg.ox + r * ca, ly = sg.cy + sg.oy + r * sa, lo = 0;
  const L = sg.lp;
  if (L) {
    const u = (f - L.f) / L.w;
    if (u > -1 && u < 1) {
      const ph = PI * (u + 1), sd = sg.sw > 0 ? 1 : -1, o1 = L.rl * sin(ph), o2 = L.rl * (1 - cos(ph));
      lx += -o1 * sa * sd - o2 * ca; ly += o1 * ca * sd - o2 * sa; lo = sin(ph / 2);
    }
  }
  const ym = ly * B.my;
  out[0] = B.px + B.ca * lx - B.sa * ym; out[1] = B.py + B.sa * lx + B.ca * ym; out[2] = cu; out[3] = lo;
}

function lay(S, x, y, a, c2, s2, live) {
  const x0 = max(0, floor(x - 2)), x1 = min(W - 1, floor(x + 2)), y0 = max(0, floor(y - 2)), y1 = min(H - 1, floor(y + 2));
  const acc = S.acc, tc = S.tc, ts = S.ts, fr = S.fresh;
  for (let j = y0; j <= y1; j++) {
    const dy = j + 0.5 - y;
    for (let i = x0; i <= x1; i++) {
      const dx = i + 0.5 - x, g = exp(-(dx * dx + dy * dy) * I2S);
      if (g < 0.01) continue;
      const v = a * g, k = j * W + i;
      acc[k] += v; tc[k] += v * c2; ts[k] += v * s2;
      if (live) fr[k] += v;
    }
  }
}

function spray(S, x, y, n, amp) {
  const sn = S.snow;
  for (let q = 0; q < n; q++) {
    const sx = x + gauss() * 1.8, sy = y + gauss() * 1.8, a = amp * (0.6 + 0.8 * rnd());
    const x0 = max(0, floor(sx - 2.5)), x1 = min(W - 1, floor(sx + 2.5)), y0 = max(0, floor(sy - 2.5)), y1 = min(H - 1, floor(sy + 2.5));
    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const dx = i + 0.5 - sx, dy = j + 0.5 - sy;
        sn[j * W + i] += a * exp(-(dx * dx + dy * dy) * 0.32);
      }
    }
  }
}

function plan(S, B) {
  const k3 = cl(S.ks[2], -1, 1), k4 = cl(S.ks[3], -1, 1);
  const R = 0.5 * D0 * pow(2, D_OCT * k3) * (0.88 + 0.24 * rnd());
  const t = (k4 + 1) / 2;
  const wP = exp(-((t / 0.3) ** 2)), wM = exp(-(((t - 0.5) / 0.3) ** 2)), wH = exp(-(((t - 1) / 0.3) ** 2));
  const wts = [wP, 0.55 * wM, 0.45 * wM, 0.3 * wH, 0.25 * wH, 0.22 * wH, 0.23 * wH];
  let tot = 0;
  for (let i = 0; i < 7; i++) tot += wts[i];
  let r = rnd() * tot, kind = 0;
  while (kind < 6 && r > wts[kind]) r -= wts[kind++];
  const serp = rnd() < 0.12 + 0.12 * (k3 + 1);
  const cs = build(B, kind, serp, R);
  const mid = serp ? R : 0;
  // where: the cleanest ice that keeps the circles on the panel and clear of the other blades
  let best = -1e9;
  const L = S.lane;
  for (let c = 0; c < 18; c++) {
    const al = c < 12 ? rnd() * PI : PI / 2 + (rnd() - 0.5) * 0.6, ca = cos(al), sa = sin(al);
    const mx = 4 + rnd() * (W - 8), my = 4 + rnd() * (H - 8), px = mx - ca * mid, py = my - sa * mid;
    let cov = 0, n = 0, pen = 0, out = 0;
    for (let j = 0; j < cs.length; j++) {
      const wx = px + ca * cs[j], wy = py + sa * cs[j], e = 0.3 * R;
      out += max(0, e - wx, wx - (W - e), e - wy, wy - (H - e));
      for (let q = 0; q < 8; q++) {
        const qx = wx + R * cos((q * PI) / 4), qy = wy + R * sin((q * PI) / 4);
        if (qx >= 0 && qx < W && qy >= 0 && qy < H) {
          const k = (qy | 0) * W + (qx | 0);
          cov += 1 - exp(-S.acc[k]) + 0.8 * S.wet[k];
        } else cov += 0.45;
        n++;
      }
      for (const O of S.bl) {
        if (O === B || O.st !== 1) continue;
        for (let i = 0; i < O.cx.length; i++) {
          const d = sqrt((wx - O.cx[i]) ** 2 + (wy - O.cy[i]) ** 2), lim = R + O.R + 4;
          if (d < lim) pen += 1 - d / lim;
        }
      }
      if (L.on && abs((wx - L.cx) * L.nx + (wy - L.cy) * L.ny) < L.hw + R) pen += 0.5;
    }
    const sc = (-1.5 * cov) / n - 1.2 * pen - 0.12 * out + 0.3 * rnd();
    if (sc > best) { best = sc; B.px = px; B.py = py; B.ca = ca; B.sa = sa; }
  }
  B.my = rnd() < 0.5 ? 1 : -1; B.cx = cs.map((v) => B.px + B.ca * v); B.cy = cs.map((v) => B.py + B.sa * v); B.R = R; B.k3 = S.ks[2]; B.k4 = S.ks[3];
  B.st = 1; B.si = 0; B.f = 0; B.sinceP = 0; B.str = 1; B.pc = 0; B.lo = 0; B.spr = false; posAt(B, B.segs[0], 0, tmp); B.x = tmp[0]; B.y = tmp[1];
}

function finish(B, pace, w) {
  B.st = 0; B.wait = (w === undefined ? 2.5 + 4 * rnd() : w) * sqrt(2 / pace);
}

function bladeStep(S, B, dt, pace, lim, live) {
  if (B.st === 0) {
    B.hd = max(0, B.hd - dt / 0.8);
    if (B.wait > 0) {
      B.wait -= dt;
      return;
    }
    let act = 0;
    for (const O of S.bl) if (O.st === 1) act++;
    if (act < lim) plan(S, B);
    return;
  }
  B.hd = min(1, B.hd + dt / 0.8);
  let rem = dt, guard = 0;
  const vs = V0 * pace * pow(B.R / 15.5, 0.35);
  while (rem > 1e-6 && guard++ < 400) {
    const sg = B.segs[B.si];
    const v = vs * (GLIDE + SURGE * exp(-B.sinceP / (SURGE_L * PI * B.R))) * (1 - 0.4 * B.pc) * (1 - 0.3 * B.lo);
    const st = min(rem, STEP_L / v);
    rem -= st;
    let f = B.f + (v * st) / (sg.len * B.str), end = false;
    if (f >= 1) { f = 1; end = true; }
    posAt(B, sg, f, tmp);
    const dx = tmp[0] - B.x, dy = tmp[1] - B.y, d2 = dx * dx + dy * dy, dl = sqrt(d2);
    if (f > B.f) B.str = cl(0.5 * B.str + (0.5 * dl) / ((f - B.f) * sg.len), 0.3, 8);
    if (dl > 1e-4) lay(S, tmp[0], tmp[1], DEP * (dl / STEP_L) * (1 + 0.8 * tmp[2]) * (1 + 0.3 * tmp[3]), (dx * dx - dy * dy) / d2, (2 * dx * dy) / d2, live);
    // the tip of a turn throws snow
    if (B.pc > 0.8 && tmp[2] < B.pc && !B.spr) { spray(S, B.x, B.y, 4, 0.05); B.spr = true; }
    if (tmp[2] < 0.3) B.spr = false;
    B.pc = tmp[2]; B.lo = tmp[3]; B.x = tmp[0]; B.y = tmp[1]; B.f = f; B.sinceP += dl; S.workSince += dl; S.workTotal += dl;
    if (end) {
      B.si++; B.f = 0;
      if (B.si >= B.segs.length) {
        finish(B, pace);
        return;
      }
      const ns = B.segs[B.si];
      if (ns.push) {
        // the knobs moved far since this figure was chosen: leave it after this lobe
        if (abs(S.ks[2] - B.k3) > 0.3 || abs(S.ks[3] - B.k4) > 0.35) {
          finish(B, pace, 0.6);
          return;
        }
        B.sinceP = 0; B.str = 1;
        // the new foot sets down a little off the old track
        posAt(B, ns, 0, tmp); B.x = tmp[0]; B.y = tmp[1]; spray(S, B.x, B.y, 3, 0.035);
      }
    }
  }
}

// ---- resurfacing
function startLane(S, instant) {
  const L = S.lane;
  S.ldir = -S.ldir;
  let best = -1e9;
  for (let c = 0; c < 7; c++) {
    const ang = rnd() < 0.3 ? PI / 2 + (rnd() * 2 - 1) * 0.35 : (rnd() * 2 - 1) * 0.5;
    const ux = sin(ang) * S.ldir, uy = cos(ang) * S.ldir, nx = -uy, ny = ux, hw = 9 + 4 * rnd();
    const ext = (abs(nx) * W) / 2 + (abs(ny) * H) / 2, off = (rnd() * 2 - 1) * max(0, ext - hw * 0.6);
    const cx = W / 2 + nx * off, cy = H / 2 + ny * off;
    let cov = 0, n = 0, pen = 0;
    for (let j = 2; j < H; j += 6) {
      for (let i = 2; i < W; i += 6) {
        if (abs((i - cx) * nx + (j - cy) * ny) < hw) { cov += 1 - exp(-S.acc[j * W + i]); n++; }
      }
    }
    for (const O of S.bl) {
      if (O.st !== 1) continue;
      for (let i = 0; i < O.cx.length; i++) if (abs((O.cx[i] - cx) * nx + (O.cy[i] - cy) * ny) < hw + O.R) pen += 0.2;
    }
    const sc = (n ? cov / n : 0) - pen + 0.25 * rnd();
    if (sc > best) { best = sc; L.cx = cx; L.cy = cy; L.ux = ux; L.uy = uy; L.nx = nx; L.ny = ny; L.hw = hw; }
  }
  let a0 = 1e9, a1 = -1e9;
  for (let q = 0; q < 4; q++) {
    const a = ((q & 1) * W - L.cx) * L.ux + ((q >> 1) * H - L.cy) * L.uy;
    a0 = min(a0, a); a1 = max(a1, a);
  }
  L.f = a0 - 3; L.end = a1 + 4; L.on = true; L.sd = (rnd() * 1e5) | 0; S.mark.fill(0); S.workSince = 0; S.workThr = WORK0 * (0.6 + 0.8 * rnd());
  S.laneT = 0;
  if (instant) { sweep(S, -1e9, L.end, false); L.on = false; }
}

// the pass's front moving from fa to fb along the lane: grooves and snow under it go, the ice behind it is wet
function sweep(S, fa, fb, wetIt) {
  const L = S.lane, acc = S.acc, tc = S.tc, ts = S.ts, sn = S.snow, fr = S.fresh, mark = S.mark, wet = S.wet;
  for (let y = 0; y < H; y++) {
    const ry = y + 0.5 - L.cy;
    for (let x = 0; x < W; x++) {
      const rx = x + 0.5 - L.cx, al = rx * L.ux + ry * L.uy;
      if (al < fa - 3.5 || al > fb + 0.5) continue;
      const e = ss(L.hw, L.hw - 3.5, abs(rx * L.nx + ry * L.ny));
      if (e <= 0) continue;
      const tg = e * ss(fb + 0.5, fb - 2.5, al), k = y * W + x, mk = mark[k];
      if (tg <= mk) continue;
      const keep = (1 - KEEP * tg) / (1 - KEEP * mk);
      acc[k] *= keep; tc[k] *= keep; ts[k] *= keep; sn[k] *= keep; fr[k] *= keep; mark[k] = tg;
      if (wetIt && tg > wet[k]) wet[k] = tg;
    }
  }
  if (wetIt) S.wetOn = true;
}

function sim(S, dt, live) {
  S.t += dt;
  const pace = cl(S.ks[1], 0.2, 3), Dk = D0 * pow(2, D_OCT * cl(S.ks[2], -1, 1)), lim = Dk < LIM_D ? 3 : 2;
  for (const B of S.bl) bladeStep(S, B, dt, pace, lim, live);
  S.laneT += dt;
  const L = S.lane;
  if (L.on) {
    const fa = L.f;
    L.f += LANE_V * dt; sweep(S, fa, L.f, true);
    if (L.f >= L.end) L.on = false;
  } else if (S.workSince >= S.workThr && S.laneT >= LANE_MIN_T) startLane(S, !live);
  // grooves dull on the skating clock, so the ice wears alike at any Pace
  const ks = exp(-dt / SNOW_TAU), ka = exp((-dt * pace) / (2 * AGE_TAU)), sn = S.snow, acc = S.acc, tc = S.tc, ts = S.ts;
  if (live) {
    const kf = exp(-dt / FRESH_TAU), fr = S.fresh, wet = S.wet, dw = dt / DRY;
    let any = false;
    for (let k = 0; k < N; k++) {
      sn[k] *= ks; fr[k] *= kf; acc[k] *= ka; tc[k] *= ka; ts[k] *= ka;
      if (S.wetOn && wet[k] > 0) { wet[k] = max(0, wet[k] - dw); any = true; }
    }
    S.wetOn = any;
    // the lamps' reflections wander at a steady LAMP_V, their heading a random walk
    S.lh += LAMP_TURN * sqrt(dt) * gauss(); S.lox += LAMP_V * cos(S.lh) * dt; S.loy += LAMP_V * sin(S.lh) * dt;
  } else {
    for (let k = 0; k < N; k++) { sn[k] *= ks; acc[k] *= ka; tc[k] *= ka; ts[k] *= ka; }
  }
}

function preroll(S) {
  const pace = cl(S.ks[1], 0.2, 3), dtA = cl(1.8 / (V0 * pace), 0.1, 3);
  for (let n = 0; S.workTotal < PRE_WORK && n < 8000; n++) sim(S, dtA, false);
  // a pass starts and is part of the way across when the first frame shows
  startLane(S, false);
  const tB = ((S.lane.end - S.lane.f) / LANE_V) * (0.3 + 0.25 * rnd());
  for (let t = 0; t < tB; t += 0.1) sim(S, 0.1, true);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input && input.knobValues ? input.knobValues : [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.ready) {
    S.ready = true;
    for (let k = 0; k < 4; k++) S.ks[k] = kn[k];
    preroll(S);
  }
  const e = 1 - exp(-d / 0.3);
  for (let k = 0; k < 4; k++) S.ks[k] += (kn[k] - S.ks[k]) * e;
  if (d > 0) sim(S, d, true);
}

// ---- drawing
function palette(S) {
  const hue = S.ks[0];
  if (abs(S.palAt - hue) < 1e-4) return;
  S.palAt = hue;
  const p = (((hue % 1) + 1) % 1) * 4, i0 = floor(p) % 4, i1 = (i0 + 1) % 4, t = ss(0.2, 0.8, p - floor(p));
  const out = {};
  for (const key of ["L", "S", "I", "N"]) out[key] = [0, 1, 2].map((c) => PAL[i0][key][c] + (PAL[i1][key][c] - PAL[i0][key][c]) * t);
  S.pal = out;
}

function lampTables(S) {
  const em = 1 / (2 * SM * SM), eg = 1 / (2 * SG * SG), eb = 1 / (2 * SB * SB);
  for (let i = 0; i < NL; i++) {
    const lx = S.lbx[i] + S.lox + 4 * sin(S.t * S.lf[2 * i] + S.lp[2 * i]);
    const ly = S.lby[i] + S.loy + 5 * sin(S.t * S.lf[2 * i + 1] + S.lp[2 * i + 1]);
    const I = S.lI[i];
    for (let x = 0; x < W; x++) {
      let d = x + 0.5 - lx;
      d -= LDW * round(d / LDW);
      const d2 = d * d, k = i * W + x;
      S.LX[k] = d; S.EXM[k] = exp(-d2 * em); S.EXG[k] = exp(-d2 * eg); S.EXB[k] = exp(-d2 * eb);
    }
    for (let y = 0; y < H; y++) {
      let d = y + 0.5 - ly;
      d -= LDH * round(d / LDH);
      const d2 = d * d, k = i * H + y;
      S.LY[k] = d; S.EYM[k] = I * exp(-d2 * em); S.EYG[k] = I * exp(-d2 * eg); S.EYB[k] = I * exp(-d2 * eb);
    }
  }
}

export function draw(display, params) {
  if (!params.s || !params.s.ready) update(0, null, params);
  const S = params.s;
  palette(S); lampTables(S);
  const P = S.pal, Lc = P.L, Sc = P.S, Ic = P.I, Nc = P.N, buf = S.buf;
  const acc = S.acc, tc = S.tc, ts = S.ts, sn = S.snow, fr = S.fresh, wet = S.wet, frost = S.frost, dn = S.dn;
  const LX = S.LX, LY = S.LY, EXM = S.EXM, EXG = S.EXG, EXB = S.EXB, EYM = S.EYM, EYG = S.EYG, EYB = S.EYB;
  const L = S.lane, lon = L.on;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      let m = 0, g = 0, bw = 0, lc = 0, ls = 0;
      for (let i = 0; i < NL; i++) {
        const iy = i * H + y, yb = EYB[iy];
        if (yb < 1e-3) continue;
        const ix = i * W + x;
        m += EXM[ix] * EYM[iy]; g += EXG[ix] * EYG[iy];
        const b = EXB[ix] * yb;
        if (b < 1e-3) continue;
        const dx = LX[ix], dy = LY[iy], dx2 = dx * dx, dy2 = dy * dy, r2 = dx2 + dy2 + 6;
        bw += b; lc += (b * (dx2 - dy2)) / r2; ls += (b * 2 * dx * dy) / r2;
      }
      const a = acc[k];
      let sb = 0;
      if (a > 0.004) {
        const an = bw > 1e-3 ? cl(0.5 - (0.5 * (tc[k] * lc + ts[k] * ls)) / (a * bw), 0, 1) : 0.5;
        sb = (1 - exp(-a)) * (AMB + GLN * an * an * (0.3 + bw));
      }
      const wv = wet[k];
      let gl = 0, sh = 0;
      if (wv > 0.08) {
        // the film the pass leaves is streaked along the lane, and its sheen picks up the lamps
        gl = ss(0.08, 0.45, wv - 0.32 * dn[k]);
        if (gl > 0) {
          const st = 0.5 + 0.5 * vn2(((x + 0.5 - L.cx) * L.nx + (y + 0.5 - L.cy) * L.ny) / 2.2, 0.5, L.sd);
          gl *= 0.7 + 0.3 * st; sh = gl * SHEEN * (0.25 + st * st) * (0.35 + m);
        }
      }
      const ib = (1 + 0.28 * frost[k]) * (1 - 0.35 * gl), rf = MAT * m * (1 - 0.5 * gl) + GLS * g * gl + sh;
      const sv = sb + min(1, fr[k]) * FR;
      let nv = sn[k] * SNW;
      if (lon) {
        const rx = x + 0.5 - L.cx, ry = y + 0.5 - L.cy, al = rx * L.ux + ry * L.uy - L.f + 1.2;
        if (al > -8 && al < 8) nv += FG * ss(L.hw, L.hw - 3.5, abs(rx * L.nx + ry * L.ny)) * exp(-(al * al) / 10);
      }
      const o = k * 3;
      buf[o] = Ic[0] * ib + Lc[0] * rf + Sc[0] * sv + Nc[0] * nv; buf[o + 1] = Ic[1] * ib + Lc[1] * rf + Sc[1] * sv + Nc[1] * nv;
      buf[o + 2] = Ic[2] * ib + Lc[2] * rf + Sc[2] * sv + Nc[2] * nv;
    }
  }
  // the blades: a small soft bright point where each is cutting
  for (const B of S.bl) {
    if (B.hd < 0.02) continue;
    const x0 = max(0, floor(B.x - 5)), x1 = min(W - 1, floor(B.x + 5)), y0 = max(0, floor(B.y - 5)), y1 = min(H - 1, floor(B.y + 5));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - B.x, dy = y + 0.5 - B.y, d2 = dx * dx + dy * dy;
        const core = exp(-d2 / 1.1) * 0.9 * B.hd, halo = exp(-d2 / 9.7) * 0.25 * B.hd, o = (y * W + x) * 3;
        buf[o] += 250 * core + Lc[0] * halo; buf[o + 1] += 252 * core + Lc[1] * halo; buf[o + 2] += 255 * core + Lc[2] * halo;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[o], 0, 255) | 0, cl(buf[o + 1], 0, 255) | 0, cl(buf[o + 2], 0, 255) | 0);
    }
  }
}
