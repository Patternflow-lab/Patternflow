// ===== Patternflow pattern =====
// Title:   Leader Cells
// Family:  woundhealing
// Idea:    A confluent sheet of about 450 soft cells glows teal and indigo where it is jammed and still, a ragged scratch or a burnt hole is cut in it, and the cells at the edge polarise into the dark gap and crawl, a few tip cells turning white-hot as leaders that pull fingers of followers behind them, until the gap closes, leaves a faint scar of long cells, and another wound is cut somewhere else.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: collective migration of an epithelial monolayer into a scratch (Poujade et al., PNAS 2007); traction forces that reach many cells behind the front (Trepat et al., Nature Physics 2009); leader cells at the tips of fingers (Omelchenko et al., J Cell Sci 2003; Reffay et al., 2014); crawling against purse-string closure (Brugues et al., Nature Physics 2014; Farooqui and Fenteany, 2005); contact inhibition of locomotion (Abercrombie and Heaysman, 1953); self-propelled aligning particles (Vicsek et al., PRL 1995; Szabo et al., Phys Rev E 2006); swirling streams in jammed sheets (Angelini et al., PNAS 2011). All from memory. The model, the leader rule, the numbers and the colours are original, pattern round 267.
// Round:   267
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Motility=0.2..4, Size=-1..1, Wound=-1..1
//
// Knob 1: Hue. Turns the pair of colours that speed is painted in once round the wheel, jammed cells teal and blue at 0, crawling ones violet and magenta, leaders pink and white-hot; every setting keeps the same lightness ramp, so at 0.5 the jammed sheet is orange-olive and the fast cells green.
// Knob 2: Motility. How hard the cells crawl, as (K2 / 2) to the 1.6: 0.025 times the opening at 0.2, a third at 1, 1 at 2, 3 at 4. At the bottom the wound stays open for a minute or two, nothing is pink and the sheet only jostles and divides; at 2 a leader goes about 0.9 LED a second and a wound closes in 30 to 50 s; at the top the leaders go 2.7 LED a second and a gap closes in about 20 s.
// Knob 3: Size. The width of a cell, 3.8 LED at -1, 5 where it opens, 7.2 at 1, so about 800, 450 or 200 cells, and the finger spacing (30 LED at the opening) goes with it. The cells swell or shrink over about a second; the count follows over a minute by division and extrusion.
// Knob 4: Wound. How big and how often. A scratch is 11 LED wide at -1, 18 at the opening and 27 at 1 (a burnt hole 16, 22 and 29 across), and the next one comes 3 s plus about 45 s at -1, 14 s at the opening and 5 s at 1 after the last has closed. Turning it up fast while the sheet is whole cuts a scratch at once.
//
// What the picture is. A culture dish in time-lapse, 64 x 128 LED standing up, on a dark navy field. Cells about 5 LED across lie edge to edge as soft domes, each coloured by how fast it is going: jammed ones cold teal and indigo, crawling ones violet and magenta, leaders pink and white-hot, and a moving cell is drawn a little long along its way. Only where a cell has open space beside it is there a thin lit rim, so the front is a ragged lit line and the inside of the sheet has no net of lines, only shading. Now and then a cell swells, flashes white and splits, and one is squeezed out as a shrinking white spark.
// The model. The wound is a scratch 85 to 130 LED long that comes in from a panel edge and ends in the sheet, 15 to 30 degrees off vertical, bent, wider at the edge end, with a ragged border, or an elliptical burnt hole; it is swept out in about a second. A cell is a soft disc that pushes its neighbours when it overlaps them and sticks a little at a small gap. Its polarity is a vector that relaxes toward the nearest empty space, sensed from the side its neighbours are missing on, and toward the mean polarity of its neighbours, so the pull of the front is felt a few cells back and fades. It loses the part that points into a cell coming the other way (contact inhibition), and it wanders a little. It crawls along its polarity. An edge cell strongly exposed for a second or two, with no leader within 30 LED, becomes a leader: 2.6 times the speed, larger, three and a half times the weight in its neighbours' alignment, stuck harder to them, so it drags a finger. A leader retires when covered or by chance after about a minute, and cannot lead for 14 s. Cells with room spread, cells stretched past their size divide, cells squeezed below nine tenths are pushed out, and a few divide and leave at random all the time. A slow swirl with no net drift, and three drifting patches that push the cells in them one way for ten seconds, keep the closed sheet jostling. Cells that crawled into the wound stay long and pale for about a minute: the scar.
// What is exact and what is not. A scratch assay, leader cells at fingertips, tractions reaching back through the sheet and contact inhibition are as the papers report them. The sheet is a torus 76 x 144 LED with the panel a view onto it, so there are no walls and the cells beyond the panel are the reservoir. The leader rule, the lateral inhibition distance, the speeds, the closing times and the colours are invented to make the picture work: a real wound takes half a day and cells go tens of micrometres an hour. The swirl and the patches are not the mechanical waves of real sheets. The mean velocity of all cells is taken off each step so the sheet cannot drift as a whole.
//
// Size: 29 KB, over the 25 KB asked, because one file holds four things that cannot be left out: the sheet, the wound maker, the healing meter that times the next wound, and the rasteriser.

const W = 64, H = 128;
const MX = 6, MY = 8;                 // the margin of the torus round the panel
const LX = W + 2 * MX, LY = H + 2 * MY;
const HX = LX / 2, HY = LY / 2;
const POOL = 1300;
const STEP = 1 / 30;
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

const KREP = 4.0;         // contact stiffness, per second
const KADH = 2.0;         // adhesion, per second
const V0 = 0.19;          // LED/s an exposed edge cell crawls at Motility 1
const GL = 1.6;           // a leader goes 1 + GL times as fast
const AE = 1.1, AL = 0.7; // polarity gain toward free space: edge, leader
const BAL = 0.95;         // alignment gain
const LA = 2.5;           // a leader counts 1 + LA in the alignment of its neighbours
const TAU = 1.0;          // polarity relaxation time, s
const NOISE = 0.3;        // polarity noise
const KCIL = 6.0;         // contact inhibition rate
const PMAX = 1.8;
const EX0 = 0.2, EX1 = 0.5, WN = 1.3; // exposure that counts as an edge, in rings of neighbours
const RLAT = 30;          // no second leader within this many LED (at a width of 5)

// ---- the state
const MOVE = ["X", "Y", "PX", "PY", "R", "RF", "SPD", "UX", "UY", "EL", "LEAD", "ISL", "LT", "LCD", "EXP", "SC", "HJ", "BJ", "MIT", "ALV", "DIE", "AGE", "FL"];
const TEMP = ["VX", "VY", "SX", "SY", "WS", "AX", "AY", "WA", "FX", "FY", "QX", "QY", "PR", "CR", "CG", "CB"];

export function setup(params) {
  const s = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, t: 0, N: 0, tick: 0,
    m: 1, Rt: 2.5, Rr: 2.5, RtT: 2.5, pre: true,
    head: new Int32Array(1024), nxt: new Int32Array(POOL), ll: new Int32Array(POOL),
    occ: new Uint8Array(32 * 64), free: 0, open: 0, openT: 0, restT: 0, kd: 0, kp: 0.06,
    wounds: [], sweeps: [], splits: [], pa: [],
    Q1: new Float32Array(W * H), Q2: new Float32Array(W * H), I1: new Int16Array(W * H),
    fl: [],
  };
  for (const n of MOVE) s[n] = new Float32Array(POOL);
  for (const n of TEMP) s[n] = new Float32Array(POOL);
  // four waves of a slow, divergence-free swirl (cells are carried along the crests' normal rotated by 90 degrees)
  const NM = [[1, 1], [2, -1], [1, 3], [3, 2]];
  for (let i = 0; i < 4; i++) {
    const kx = NM[i][0] / LX, ky = NM[i][1] / LY, kl = sqrt(kx * kx + ky * ky);
    s.fl.push({ kx: 6.2832 * kx, ky: 6.2832 * ky, dx: ky / kl, dy: -kx / kl, v: 0.11, w: 0.05 + 0.028 * i, p: rnd() * 6.2832 });
  }
  params.s = s;
}

function readKnobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
  s.m = Math.pow(cl(s.k[1], 0.2, 4) / 2, 1.6);
  const z = cl(s.k[2], -1, 1);
  s.RtT = 2.5 * exp((z < 0 ? 0.28 : 0.36) * z);
}

// ---- wounds
const hv = (a, b, sd) => {
  let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(sd, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x, y, sd) => {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hv(ix, iy, sd), b = hv(ix + 1, iy, sd), c = hv(ix, iy + 1, sd), d = hv(ix + 1, iy + 1, sd);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// negative inside the wound; out[0] is how far along the sweep the point is, 0 to 1
function woundSd(w, x, y, out) {
  let dx = x - w.cx, dy = y - w.cy;
  if (dx > HX) dx -= LX; else if (dx < -HX) dx += LX;
  if (dy > HY) dy -= LY; else if (dy < -HY) dy += LY;
  const rag = 2.6 * (vnoise(x / 6.5, y / 6.5, w.sd) - 0.5) * 2 + 1.1 * (vnoise(x / 3.1, y / 3.1, w.sd + 7) - 0.5) * 2;
  if (w.hole) {
    const u = dx * w.c1 + dy * w.s1, v = -dx * w.s1 + dy * w.c1;
    const rho = sqrt((u / w.ra) * (u / w.ra) + (v / w.rb) * (v / w.rb));
    out[0] = rho * 0.5 * (w.ra + w.rb) / w.rmax;
    return (rho - 1) * 0.5 * (w.ra + w.rb) - rag * 0.8;
  }
  const sc = dx * w.ax + dy * w.ay, t0 = dx * w.nx + dy * w.ny;
  const q = cl(sc / w.hl, -1, 1), u = 0.5 + 0.5 * q;
  const t = t0 - w.bow * (1 - q * q);
  const hw = w.hw * (1.15 - 0.3 * u - 0.35 * sm(0.75, 1, u)) * (1 + 0.36 * (vnoise(sc / 16 + 40, 0.5, w.sd + 3) - 0.5));
  const ds = sc - q * w.hl;
  out[0] = 0.5 + 0.5 * cl(sc / w.hl, -1, 1);
  return sqrt(ds * ds + t * t) - hw - rag;
}

function makeWound(s, first) {
  const k4 = s.k[3] - 0.06;
  const hole = !first && rnd() < 0.38;
  const w = { sd: floor(rnd() * 100000), hole, head: 0, age: 0, done: false, fset: false, healed: false, wf: 1, nodes: null };
  if (hole) {
    const d = 22 * exp(0.3 * k4) * (0.9 + 0.2 * rnd());
    const asp = 1 + 0.3 * rnd();
    w.cx = MX + 14 + 36 * rnd();
    w.cy = MY + 22 + 84 * rnd();
    w.ra = 0.5 * d * sqrt(asp);
    w.rb = 0.5 * d / sqrt(asp);
    const a = rnd() * PI;
    w.c1 = cos(a);
    w.s1 = sin(a);
    w.rmax = max(w.ra, w.rb) * 1.6;
    w.rate = 60 / w.rmax;
  } else {
    const th = (15 + 15 * rnd()) * PI / 180, hs = rnd() < 0.5 ? -1 : 1, vs = rnd() < 0.5 ? -1 : 1;
    const L = min(85 + 47 * rnd(), 42 / sin(th));
    const xm = MX + 20 + 24 * rnd();
    const sx = xm - hs * L * sin(th) / 2, sy = vs > 0 ? 1.5 : LY - 1.5;
    w.ax = hs * sin(th);
    w.ay = vs * cos(th);
    w.nx = w.ay;
    w.ny = -w.ax;
    w.hl = L / 2;
    w.cx = sx + w.ax * w.hl;
    w.cy = sy + w.ay * w.hl;
    w.hw = 0.5 * 18 * exp(0.45 * k4) * (0.92 + 0.16 * rnd());
    w.bow = (rnd() < 0.5 ? -1 : 1) * (3 + 5 * rnd());
    w.rate = 95 / L;
  }
  s.wounds.push(w);
  s.sweeps.push(w);
  if (s.wounds.length > 3) s.wounds.shift();
  s.open++;
  s.openT = 0;
  s.restT = 0;
}

function sweepWounds(s, dt) {
  const { X, Y, ALV, DIE, FL, PX, PY, MIT } = s;
  const tmp = [0];
  for (let q = s.sweeps.length - 1; q >= 0; q--) {
    const w = s.sweeps[q];
    w.head += w.rate * dt;
    for (let i = 0; i < s.N; i++) {
      if (DIE[i] > 0) continue;
      if (woundSd(w, X[i], Y[i], tmp) < 0 && tmp[0] <= w.head) {
        DIE[i] = 1 / 0.45;
        FL[i] = 1;
        PX[i] = PY[i] = 0;
        MIT[i] = 0;
        s.ISL[i] = 0;
      }
    }
    if (w.head > 1.05) {
      s.sweeps.splice(q, 1);
      w.done = true;
      w.age = 0;
    }
  }
}

// how much of the panel no cell covers, at a node every 2 LED
function measureFree(s) {
  const { occ, X, Y, R } = s;
  occ.fill(0);
  for (let i = 0; i < s.N; i++) {
    const r = R[i] * 0.95, cx = X[i] - MX, cy = Y[i] - MY;
    if (r < 0.3 || cx < -r || cx > W + r || cy < -r || cy > H + r) continue;
    const g0 = max(0, ceil((cx - r) / 2 - 0.5)), g1 = min(31, floor((cx + r) / 2 - 0.5));
    const h0 = max(0, ceil((cy - r) / 2 - 0.5)), h1 = min(63, floor((cy + r) / 2 - 0.5));
    for (let gy = h0; gy <= h1; gy++) {
      const ey = gy * 2 + 1 - cy;
      for (let gx = g0; gx <= g1; gx++) {
        const ex = gx * 2 + 1 - cx;
        if (ex * ex + ey * ey < r * r) occ[gy * 32 + gx] = 1;
      }
    }
  }
  let n = 0;
  for (let i = 0; i < 2048; i++) n += occ[i];
  return 1 - n / 2048;
}

// ---- cells
function moveCell(s, from, to) {
  for (const n of MOVE) s[n][to] = s[n][from];
}

function newCell(s, x, y, rf) {
  const i = s.N++;
  s.X[i] = x;
  s.Y[i] = y;
  s.RF[i] = rf;
  s.R[i] = s.Rt * rf;
  const a = rnd() * 6.2832;
  s.UX[i] = cos(a);
  s.UY[i] = sin(a);
  s.PX[i] = 0.05 * gauss();
  s.PY[i] = 0.05 * gauss();
  s.SPD[i] = s.EL[i] = s.LEAD[i] = s.ISL[i] = s.LT[i] = s.LCD[i] = s.EXP[i] = s.SC[i] = s.MIT[i] = s.DIE[i] = s.FL[i] = 0;
  s.ALV[i] = 1;
  s.AGE[i] = 4 + 20 * rnd();
  s.HJ[i] = gauss() * 0.03;
  s.BJ[i] = 0.8 + 0.34 * rnd();
  return i;
}

function init(s) {
  s.init = true;
  s.Rt = s.Rr = s.RtT;
  const a = 2 * s.Rt;
  const nc = Math.round(LX / a), nr = 2 * Math.round(LY / (a * 0.866) / 2);
  const ax = LX / nc, ay = LY / nr;
  for (let r = 0; r < nr; r++)
    for (let c = 0; c < nc; c++) {
      const x = (c + 0.5 * (r & 1) + 0.5) * ax + (rnd() - 0.5) * 0.4 * ax;
      const y = (r + 0.5) * ay + (rnd() - 0.5) * 0.4 * ay;
      newCell(s, (x + LX) % LX, (y + LY) % LY, 0.88 + 0.24 * rnd());
    }
  s.pre = true;
  for (let n = 0; n < 100; n++) step(s, 1 / 15);       // 7 s to settle the packing
  makeWound(s, true);
  const w0 = s.wounds[0];
  let t = 0;
  while (t < 80 && !(w0.fset && (w0.wf < 0.66 || w0.healed) && w0.age > 5)) {
    step(s, 1 / 15);
    t += 1 / 15;
  }
  s.pre = false;
  s.restT = 0;
}

// ---- one step
function step(s, dt) {
  const { X, Y, PX, PY, R, RF, SPD, UX, UY, EL, LEAD, ISL, LT, LCD, EXP, PR, FL, SC, HJ, BJ, MIT, ALV, DIE, AGE } = s;
  const { VX, VY, SX, SY, WS, AX, AY, WA, FX, FY, QX, QY } = s;
  const { head, nxt } = s;
  let N = s.N;
  s.t += dt;
  const m = s.m;
  s.Rt += (s.RtT - s.Rt) * min(1, 1.2 * dt);
  const Rt = s.Rt, RN = 3.1 * Rt, RN2 = RN * RN;
  s.Rr += (Rt - s.Rr) * dt / 25;                       // a slow memory of the cell size: after the cells shrink the sheet divides faster
  const gb = 1 + 6 * sm(0.04, 0.2, log(s.Rr / Rt));
  const nbx = max(3, floor(LX / RN)), nby = max(3, floor(LY / RN));
  const bw = LX / nbx, bh = LY / nby;
  head.fill(-1, 0, nbx * nby);
  for (let i = 0; i < N; i++) {
    const b = (floor(Y[i] / bh) % nby) * nbx + (floor(X[i] / bw) % nbx);
    nxt[i] = head[b];
    head[b] = i;
    SX[i] = SY[i] = WS[i] = AX[i] = AY[i] = WA[i] = FX[i] = FY[i] = QX[i] = QY[i] = PR[i] = 0;
  }
  // pair interactions
  for (let by = 0; by < nby; by++)
    for (let bx = 0; bx < nbx; bx++)
      for (let i = head[by * nbx + bx]; i >= 0; i = nxt[i])
        for (let oy = -1; oy <= 1; oy++) {
          const yy = (by + oy + nby) % nby;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = (bx + ox + nbx) % nbx;
            for (let j = head[yy * nbx + xx]; j >= 0; j = nxt[j]) {
              if (j <= i) continue;
              let dx = X[j] - X[i], dy = Y[j] - Y[i];
              if (dx > HX) dx -= LX; else if (dx < -HX) dx += LX;
              if (dy > HY) dy -= LY; else if (dy < -HY) dy += LY;
              const d2 = dx * dx + dy * dy;
              if (d2 >= RN2) continue;
              const d = sqrt(d2) + 1e-6, nx = dx / d, ny = dy / d;
              const w = 1 - d / RN, wj = w * ALV[j], wi = w * ALV[i];
              SX[i] += wj * nx; SY[i] += wj * ny; WS[i] += wj;
              SX[j] -= wi * nx; SY[j] -= wi * ny; WS[j] += wi;
              const aj = wj * (1 + LA * LEAD[j]), ai = wi * (1 + LA * LEAD[i]);
              AX[i] += aj * PX[j]; AY[i] += aj * PY[j]; WA[i] += aj;
              AX[j] += ai * PX[i]; AY[j] += ai * PY[i]; WA[j] += ai;
              const rs = R[i] + R[j], delta = rs - d;
              if (delta > 0) {
                const f = KREP * delta;
                FX[i] -= f * nx; FY[i] -= f * ny; FX[j] += f * nx; FY[j] += f * ny;
                PR[i] += delta; PR[j] += delta;
              } else {
                const ar = 0.15 * rs, g = -delta;
                if (g < ar) {
                  const a = KADH * (g < ar * 0.5 ? g : ar - g) * (1 + 1.2 * max(LEAD[i], LEAD[j]));
                  FX[i] += a * nx; FY[i] += a * ny; FX[j] -= a * nx; FY[j] -= a * ny;
                }
              }
              if (delta > -0.1 * rs) {
                const ci = PX[i] * nx + PY[i] * ny, cj = -(PX[j] * nx + PY[j] * ny);
                if (ci > 0 || cj > 0) {
                  const cs = (PX[i] * PX[j] + PY[i] * PY[j]) / (sqrt((PX[i] * PX[i] + PY[i] * PY[i]) * (PX[j] * PX[j] + PY[j] * PY[j])) + 1e-4);
                  const opp = (1 - cs) * 0.5;
                  if (ci > 0) { QX[i] += ci * opp * nx; QY[i] += ci * opp * ny; }
                  if (cj > 0) { QX[j] -= cj * opp * nx; QY[j] -= cj * opp * ny; }
                }
              }
            }
          }
        }
  // polarity and velocity
  const fl = s.fl, tt = s.t, pa = s.pa, ms = 0.25 + 0.75 * sm(0.02, 0.6, m);
  for (let q = pa.length - 1; q >= 0; q--) {
    const o = pa[q];
    o.t += dt;
    o.x = (o.x + o.c * 0.3 * dt + LX) % LX;
    o.y = (o.y + o.s * 0.3 * dt + LY) % LY;
    if (o.t > o.T) pa.splice(q, 1);
  }
  if (!s.pre && pa.length < 3 && rnd() < dt / 7) {
    const a = rnd() * 6.2832;
    pa.push({ x: rnd() * LX, y: rnd() * LY, r: 12 + 8 * rnd(), c: cos(a), s: sin(a), t: 0, T: 8 + 6 * rnd(), amp: (0.5 + 0.5 * rnd()) * ms });
  }
  let mvx = 0, mvy = 0;
  const sn = sqrt(dt) * NOISE;
  for (let i = 0; i < N; i++) {
    const sl = sqrt(SX[i] * SX[i] + SY[i] * SY[i]);
    const e1 = WS[i] < 0.02 ? 1 : sm(EX0, EX1, sl / WN);
    EXP[i] += (e1 - EXP[i]) * min(1, 5 * dt);
    let gx, gy;
    if (sl > 1e-4) { gx = -SX[i] / sl; gy = -SY[i] / sl; }
    else { const pm = sqrt(PX[i] * PX[i] + PY[i] * PY[i]) + 1e-6; gx = PX[i] / pm; gy = PY[i] / pm; }
    const lead = LEAD[i], f = ALV[i];
    let tx = 0, ty = 0;
    if (WA[i] > 1e-4) { tx = BAL * AX[i] / WA[i]; ty = BAL * AY[i] / WA[i]; }
    const gain = AE * EXP[i] + AL * lead;
    tx += gain * gx; ty += gain * gy;
    for (let q = 0; q < pa.length; q++) {
      const o = pa[q];
      let dx = X[i] - o.x, dy = Y[i] - o.y;
      if (dx > HX) dx -= LX; else if (dx < -HX) dx += LX;
      if (dy > HY) dy -= LY; else if (dy < -HY) dy += LY;
      const d2 = dx * dx + dy * dy;
      if (d2 < o.r * o.r) { const e = 1 - sqrt(d2) / o.r, g = o.amp * e * e * sin(PI * o.t / o.T); tx += g * o.c; ty += g * o.s; }
    }
    const a = min(1, dt / TAU);
    let px = PX[i] + (tx - PX[i]) * a - KCIL * dt * QX[i] + sn * gauss();
    let py = PY[i] + (ty - PY[i]) * a - KCIL * dt * QY[i] + sn * gauss();
    const pm = sqrt(px * px + py * py);
    if (pm > PMAX) { px *= PMAX / pm; py *= PMAX / pm; }
    PX[i] = px * f; PY[i] = py * f;
    const vm = V0 * m * (1 + GL * lead) * f;
    let vx = vm * px + FX[i], vy = vm * py + FY[i];
    let sx = 0, sy = 0;
    for (let q = 0; q < 4; q++) {
      const o = fl[q], v = o.v * sin(o.kx * X[i] + o.ky * Y[i] + o.w * tt + o.p);
      sx += v * o.dx; sy += v * o.dy;
    }
    vx += sx; vy += sy;
    VX[i] = vx; VY[i] = vy;
    mvx += vx; mvy += vy;
  }
  mvx /= max(1, N); mvy /= max(1, N);
  for (let i = 0; i < N; i++) {
    const vx = VX[i] - mvx, vy = VY[i] - mvy;
    let x = X[i] + vx * dt, y = Y[i] + vy * dt;
    if (x >= LX) x -= LX; else if (x < 0) x += LX;
    if (y >= LY) y -= LY; else if (y < 0) y += LY;
    X[i] = x; Y[i] = y;
    const sp = sqrt(vx * vx + vy * vy);
    SPD[i] += (sp - SPD[i]) * min(1, dt / 0.8);
    if (sp > 0.04) {
      UX[i] += (vx / sp - UX[i]) * min(1, 2.5 * dt);
      UY[i] += (vy / sp - UY[i]) * min(1, 2.5 * dt);
      const un = sqrt(UX[i] * UX[i] + UY[i] * UY[i]) + 1e-6;
      UX[i] /= un; UY[i] /= un;
    }
    EL[i] += (0.3 * sm(0.1, 0.8, SPD[i]) + 0.2 * SC[i] - EL[i]) * min(1, 2 * dt);
  }
  // leaders
  let nl = 0;
  const ll = s.ll;
  for (let i = 0; i < N; i++) if (ISL[i] > 0.5) ll[nl++] = i;
  const rlat = RLAT * Rt / 2.5, rl2 = rlat * rlat;
  for (let i = 0; i < N; i++) {
    if (DIE[i] > 0) { ISL[i] = 0; LEAD[i] *= 0.9; continue; }
    const e = EXP[i], pm = sqrt(PX[i] * PX[i] + PY[i] * PY[i]);
    if (ISL[i] > 0.5) {
      LT[i] = e < 0.25 ? LT[i] + dt : max(0, LT[i] - 0.5 * dt);
      if (LT[i] > 1.8 || rnd() < dt / 70) { ISL[i] = 0; LT[i] = 0; LCD[i] = 14; }
    } else if (LCD[i] > 0) LCD[i] -= dt;
    else if (e > 0.6 && pm > 0.45) {
      LT[i] += dt * (e - 0.4) * 2 * (0.6 + 0.8 * (RF[i] - 0.88) / 0.24);
      if (LT[i] > 1.4) {
        let blocked = false;
        for (let q = 0; q < nl && !blocked; q++) {
          let dx = X[ll[q]] - X[i], dy = Y[ll[q]] - Y[i];
          if (dx > HX) dx -= LX; else if (dx < -HX) dx += LX;
          if (dy > HY) dy -= LY; else if (dy < -HY) dy += LY;
          if (dx * dx + dy * dy < rl2) blocked = true;
        }
        if (blocked) LT[i] = 0.4;
        else { ISL[i] = 1; LT[i] = 0; ll[nl++] = i; }
      }
    } else LT[i] = max(0, LT[i] - 2 * dt);
    LEAD[i] += (ISL[i] - LEAD[i]) * min(1, dt);
  }
  // size, division and extrusion
  const sp = s.splits;
  sp.length = 0;
  let div = 0, ext = 0;
  for (let i = 0; i < N; i++) {
    AGE[i] += dt;
    FL[i] = max(0, FL[i] - 0.9 * dt);
    if (DIE[i] > 0) {
      const nv = ALV[i] - DIE[i] * dt;
      R[i] *= max(0, nv) / ALV[i];
      ALV[i] = nv;
      continue;
    }
    const pn = PR[i] / Rt;
    const goal = Rt * RF[i] * (1.1 - 0.3 * sm(0.02, 0.45, pn)) * (1 + 0.1 * LEAD[i]) * (MIT[i] > 0 ? 1.12 : 1);
    R[i] += (goal - R[i]) * min(1, dt);
    if (MIT[i] > 0) {
      MIT[i] -= dt;
      FL[i] = max(FL[i], sm(1.5, 0, MIT[i]));
      if (MIT[i] <= 0) sp.push(i);
    } else if (AGE[i] > 8 && ISL[i] < 0.5) {
      const rho = R[i] / (Rt * RF[i]);
      if (div < 1 && rnd() < (0.0011 + 0.012 * gb * sm(1.03, 1.09, rho)) * dt) { MIT[i] = 1.5; div++; }
      else if (ext < 1 && rnd() < (0.0022 * sm(0.03, 0.4, pn) + 0.12 * sm(0.93, 0.87, rho)) * dt) { DIE[i] = 1 / 1.4; FL[i] = 1; PX[i] = PY[i] = 0; ext++; }
    }
  }
  for (let q = 0; q < sp.length && s.N < POOL - 1; q++) {
    const i = sp[q];
    const a = rnd() * 6.2832, c = cos(a), sn2 = sin(a), r = R[i] * 0.7071;
    const j = newCell(s, X[i], Y[i], RF[i]);
    X[j] = (X[i] - c * 0.55 * r + LX) % LX; Y[j] = (Y[i] - sn2 * 0.55 * r + LY) % LY;
    X[i] = (X[i] + c * 0.55 * r) % LX; Y[i] = (Y[i] + sn2 * 0.55 * r) % LY;
    R[i] = R[j] = r;
    PX[j] = PX[i]; PY[j] = PY[i];
    SPD[j] = SPD[i]; EL[j] = EL[i]; SC[j] = SC[i]; HJ[j] = HJ[i]; BJ[j] = BJ[i];
    AGE[i] = AGE[j] = 0;
    FL[i] = FL[j] = 1;
    RF[j] = cl(RF[i] + 0.04 * gauss(), 0.85, 1.15);
    MIT[i] = 0;
  }
  N = s.N;
  for (let i = N - 1; i >= 0; i--)
    if (ALV[i] <= 0) {
      moveCell(s, N - 1, i);
      N--;
    }
  s.N = N;
  sweepWounds(s, dt);
  // the slow bookkeeping: the free area, healing, the next wound
  s.tick += dt;
  if (s.tick >= 0.25) {
    s.tick -= 0.25;
    tickWounds(s);
  }
}

function tickWounds(s) {
  s.free = measureFree(s);
  const k4 = s.k[3] - 0.06, tmp = [0];
  let open = 0;
  for (const w of s.wounds) {
    w.age += 0.25;
    if (w.done && !w.fset && w.age > 1.2) {
      // the nodes of the panel that lie in the wound, to see how much of it is still empty
      w.fset = true;
      const nd = [];
      for (let g = 0; g < 2048; g++)
        if (woundSd(w, (g & 31) * 2 + 1 + MX, (g >> 5) * 2 + 1 + MY, tmp) < 1) nd.push(g);
      w.nodes = nd;
    }
    if (w.fset && !w.healed) {
      let e = 0;
      for (const g of w.nodes) e += 1 - s.occ[g];
      w.wf = e / max(1, w.nodes.length);
      if (w.wf < 0.27 || w.nodes.length < 12) w.healed = true;
    }
    if (!w.healed) open++;
  }
  if (open === 0 && s.open > 0) s.restT = 0;
  s.open = open;
  if (open > 0) s.openT += 0.25;
  // scar: cells that crawled into a wound stay long and pale for a while
  for (let i = 0; i < s.N; i++) s.SC[i] *= 0.995;
  for (const w of s.wounds) {
    if (!w.done || w.age > 150) continue;
    for (let i = 0; i < s.N; i++) if (s.SPD[i] > 0.08 && woundSd(w, s.X[i], s.Y[i], tmp) < 0) s.SC[i] = 1;
  }
  if (s.pre) return;
  s.kd = s.kd * exp(-0.25) + (s.k[3] - s.kp);
  s.kp = s.k[3];
  if (s.open === 0) {
    s.restT += 0.25;
    const tauW = 14 * exp(-1.1 * k4);
    if (s.restT > 3 && (rnd() < 0.25 / tauW || s.kd > 0.3)) { makeWound(s, false); s.kd = 0; }
  } else if (s.openT > 170 && s.open < 2) makeWound(s, false);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  readKnobs(s, input);
  if (!s.init) init(s);
  s.acc += cl(dt || 0, 0, 0.1);
  let guard = 0;
  while (s.acc >= STEP && guard++ < 4) {
    s.acc -= STEP;
    step(s, STEP);
  }
}

// ---- drawing
function hsv(h, sat, v, o) {
  h -= floor(h);
  const i = floor(h * 6), f = h * 6 - i, p = v * (1 - sat), q = v * (1 - sat * f), t = v * (1 - sat * (1 - f));
  switch (i % 6) {
    case 0: o[0] = v; o[1] = t; o[2] = p; break;
    case 1: o[0] = q; o[1] = v; o[2] = p; break;
    case 2: o[0] = p; o[1] = v; o[2] = t; break;
    case 3: o[0] = p; o[1] = q; o[2] = v; break;
    case 4: o[0] = t; o[1] = p; o[2] = v; break;
    default: o[0] = v; o[1] = p; o[2] = q;
  }
}

// the false colour of a speed u (0 slow, 1 fast, more is white-hot), at the same lightness for every hue
function ramp(hs, u, o) {
  const x = cl(u, 0, 1);
  hsv(hs + 0.42 * Math.pow(x, 0.95), 0.92 - 0.12 * x, 1, o);
  const hh = (hs + 0.42 * Math.pow(x, 0.95)) % 1, wm = exp(-((hh - 0.13) / 0.14) * ((hh - 0.13) / 0.14)) + exp(-((hh - 1.1) / 0.14) * ((hh - 1.1) / 0.14));
  const L = 0.26 + 0.4 * Math.pow(x, 1.2) + 0.3 * sm(0.85, 1.25, u) + 0.2 * wm * (1 - x);
  const Y = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2];
  if (L <= Y) { const k = L / Y; o[0] *= k; o[1] *= k; o[2] *= k; }
  else { const t = (L - Y) / (1 - Y); o[0] += t * (1 - o[0]); o[1] += t * (1 - o[1]); o[2] += t * (1 - o[2]); }
  const wt = 0.8 * sm(0.85, 1.25, u);
  o[0] += wt * (1 - o[0]); o[1] += wt * (1 - o[1]); o[2] += wt * (1 - o[2]);
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (!s.init) init(s);
  const { X, Y, R, SPD, UX, UY, EL, LEAD, PX, PY, SC, FL, HJ, BJ, ALV, CR, CG, CB, Q1, Q2, I1 } = s;
  const N = s.N, hs = 0.52 + s.k[0], o = [0, 0, 0], mk = 0.1 + 0.9 * sm(0.02, 0.6, s.m);
  for (let i = 0; i < N; i++) {
    const pm = sqrt(PX[i] * PX[i] + PY[i] * PY[i]);
    const u = 0.95 * (1 - exp(-SPD[i] / 0.33)) + 0.2 * sm(0.1, 1.2, pm) * mk + 0.45 * LEAD[i] * mk;
    ramp(hs + HJ[i], u, o);
    const sc = SC[i] * 0.18, fl = FL[i] * 0.65, br = BJ[i] * (0.9 + 0.1 * ALV[i]);
    const wt = max(sc, fl);
    CR[i] = cl(o[0] * br + wt * (1 - o[0]), 0, 1);
    CG[i] = cl(o[1] * br + wt * (1 - o[1]), 0, 1);
    CB[i] = cl(o[2] * br + wt * (1 - o[2]), 0, 1);
  }
  Q1.fill(99);
  Q2.fill(99);
  I1.fill(-1);
  for (let i = 0; i < N; i++) {
    const r = R[i] * 1.02;
    if (r < 0.25) continue;
    const el = EL[i], ra = r * (1 + el), rb = r / (1 + el), ia = 1 / ra, ib = 1 / rb;
    const cx = X[i] - MX, cy = Y[i] - MY, ux = UX[i], uy = UY[i], rr = ra * 1.5;
    if (cx < -rr || cx > W + rr || cy < -rr || cy > H + rr) continue;
    const x0 = max(0, floor(cx - rr)), x1 = min(W - 1, ceil(cx + rr)), y0 = max(0, floor(cy - rr)), y1 = min(H - 1, ceil(cy + rr));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - cy;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - cx, al = (dx * ux + dy * uy) * ia, pe = (-dx * uy + dy * ux) * ib, q = al * al + pe * pe, o2 = py * W + px;
        if (q < Q1[o2]) { Q2[o2] = Q1[o2]; Q1[o2] = q; I1[o2] = i; }
        else if (q < Q2[o2]) Q2[o2] = q;
      }
    }
  }
  const BR = 3, BG = 6, BB = 26;
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const o2 = py * W + px, i = I1[o2];
      let r = BR, g = BG, b = BB;
      if (i >= 0) {
        const q = sqrt(Q1[o2]);
        const cov = 1 - sm(1.0, 1.45, q);
        if (cov > 0) {
          const lum = 0.36 + 0.64 * (1 - q * q > 0 ? 1 - q * q : 0);
          const rim = sm(1.5, 2.4, sqrt(Q2[o2])) * sm(0.55, 0.95, q) * 0.8;
          const cr = CR[i], cg = CG[i], cb = CB[i];
          const rr = cr * lum + rim * ((0.4 + 0.6 * cr) - cr * lum);
          const gg = cg * lum + rim * ((0.4 + 0.6 * cg) - cg * lum);
          const bb = cb * lum + rim * ((0.4 + 0.6 * cb) - cb * lum);
          r = (BR + (rr * 255 - BR) * cov);
          g = (BG + (gg * 255 - BG) * cov);
          b = (BB + (bb * 255 - BB) * cov);
        }
      }
      display.setPixel(px, py, (min(255, r) + 0.5) | 0, (min(255, g) + 0.5) | 0, (min(255, b) + 0.5) | 0);
    }
}

