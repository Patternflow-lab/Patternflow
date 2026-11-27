// ===== Patternflow pattern =====
// Title:   Quorum Switch
// Family:  quorum
// Idea:    A sheet of bacteria on a dark sea-blue medium each make a little signal and sense it, so a dense clump crosses its threshold and switches on with positive feedback, the cloud of signal creeping out ahead lights the cells beside it as a front, a ragged wash of fresh medium sweeps down a corridor of the sheet and puts out the weakly lit cells while the strongly lit ones hold on, and a cull thins a patch so it can grow and light up again.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: autoinduction of luminescence in Vibrio fischeri (Nealson, Platt and Hastings, 1970), the lux system with its positive feedback, the term quorum sensing (Fuqua, Winans and Greenberg, 1994), a cooperative response written as a Hill function (A. V. Hill, 1910). All from memory. The sheet, its numbers, the wash and the cull are original, pattern round 270
// Round:   270
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Growth=1..4, Feedback=-1..1, Wash=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the whole picture, one turn over the range: aqua-green light on a sea-blue ground at 0, violet at 0.25, rose-red at 0.5, yellow at 0.75 and back to aqua at 1.
// Knob 2: Growth. How fast the cells divide, as (K2 / 2) to the 0.75. A young colony of 14 cells and a few stray spores takes 23 s to reach 56 cells at 1, 17 s at 2 where it opens and 12 s at 4, and 93, 49 and 33 s to fill 40 percent of the 540 places. A high setting packs the sheet sooner, so it reaches quorum sooner and is culled more often: over 900 s the colony averages 234 cells with 24 culls at 1 and 264 cells with 114 culls at 4.
// Knob 3: Feedback. How hard the switch is. The cooperativity of the response runs from 2 at -1 to 4 at 1, and the signal a lit cell makes goes up with it. At -1 a cell's glow follows the cloud, so 58 percent of the cells sit partly lit and 12 percent are full on, and a front is soft; at the opening 33 and 32 percent; at 1 only 22 percent are partly lit and 44 percent are full on, the front is crisp and a lit clump holds through a hard wash. The lit state survives down to 0.60 of the places filled at -1, 0.41 at 0 and 0.30 at 1.
// Knob 4: Wash. The flush of fresh medium. At -1 it comes about every 43 s down a corridor 25 to 45 LED wide and leaves a third to two thirds of the signal; at 1 about every 22 s down one 65 to 85 LED wide, leaving a sixteenth to a six-hundredth. A weak wash only dims the weakly lit cells, a hard one puts out every clump but the best fed.
//
// What the picture is. A sheet of 540 places in a hex lattice 4 LED apart, jittered by a LED or so, holds 135 to 305 cells at a time (up to 360 at the top of Growth). A cell is a soft disc about 3 LED across with a halo that grows with its light. A dull cell is a muted teal. A lit cell is aqua-green with a white heart, and a clump of them shines as a patch with a pale haze round it. The ground is a deep blue-green that takes a turquoise tint where the signal is thick, so the cloud can be seen creeping out in front of a lit patch before the cells in its path switch on. A new cell buds out of its parent and slides to its place over a second. The wash shows as a pale ragged band that runs down a corridor with the light going out behind it. The cells wander by half a LED and the signal drifts on a slow stream that turns.
// The model. Each cell makes signal at a rate 0.05 + L, where L is its switch, and senses the signal at its place. The switch follows a Hill function of the signal over the cell's own threshold, L' = (0.02 + 0.98 A^n / (1 + A^n) - L) / tau, with n from 2 to 4 and tau 1.6 s rising and 1.8 s falling. The signal lives on a 32 x 64 grid, one node to 2 x 2 LED, and obeys A' = 24 laplacian(A) - 0.4 A + production, a diffusion length of 7.7 LED, with an upwind stream of up to 1.5 LED a second. The production is scaled so that a sheet of lit cells at every place would stand at 1.25 n + 0.5 thresholds. In a uniform sheet that makes the switch bistable, with a lit state that survives down to about 0.41 of the places filled and a dark state that holds up to about 0.75, which is the hysteresis; in the lattice the same loop shows up as lit patches that grow into thinner colony than they could light on their own. Each cell's threshold is a lognormal draw times a slow field over the sheet, and the medium is richer in some places than others, so a dense rich patch switches on first and its front crawls on at 4 to 8 LED a second until the colony is too thin to carry it. Cells divide into a free neighbouring place at a rate set by Growth and the richness there, die by chance, and spores land on bare places. Lit cells use up oxygen: the thresholds follow the lit share of the sheet, up when a lot is lit and down when little is, so the sheet does not settle all lit or all dark. A flush of fresh medium dilutes the signal and draws it out of the cells in a ragged band that sweeps a corridor. A dose thins a ragged patch 50 to 80 LED across to a tenth or a fifth of its cells, picked well apart so none is left beside another, and falls most often where the sheet is brightest. Now and then a burst of light starts in a place; where the colony is dense enough it takes, and where it is not it fizzles.
// What is exact and what is not. Autoinduction, a threshold in cell density, a switch with hysteresis, signal that diffuses and is washed away, and glow that follows the state of the switch are as the lux system is described. The numbers are chosen so the panel reads, not fitted to data. The cull, the oxygen, the sparks, the corridor of the flush and the richness field are inventions for this picture, and the timings are in model seconds run at 1.45 to a second. The ground tint is the signal itself, drawn.

const W = 64, H = 128, GW = 32, GH = 64, GN = GW * GH;
const COLS = 15, ROWS = 36, NS = COLS * ROWS;
const DT = 1 / 30;
const SPEED = 1.45;   // model seconds to a second
const { floor, ceil, sqrt, exp, log, sin, cos, min, max, abs, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

// the signal, in units of the threshold of an average cell
const DIFF = 24;      // LED^2 a second
const LAM = 0.4;      // decay, 1/s
const C0 = 0.05;      // what a dark cell makes, against 1 for a lit one
const A0 = 0.02;      // the dark level of a cell's switch
const TAUR = 1.6, TAUF = 1.8;   // the switch rises and falls, seconds
const MU0 = 0.085;    // division rate of a cell with room, 1/s
const SPORE = 0.5;   // a new cell lands on bare medium this often, 1/s
const DEATH = 0.015;  // and a cell dies of old age at this rate, 1/s
const SPARK = 0.15;   // a burst of light starts somewhere this often, 1/s, when little is lit
const OXY = 5;        // how hard a lit sheet raises the thresholds
const FULL = 0.9;     // a sheet this full is culled

// slots of a jittered hex lattice that the cells sit in
const MX = 2.6, DX = (W - 2 * MX) / (COLS - 0.5), DY = (H - 2 * MX) / (ROWS - 1);

export function setup(params) {
  const S = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, t: 0, n: 3, u: 0.5, prod: 1, gm: 1, wF: 0.07, wMean: 50,
    A: new Float32Array(GN), A2: new Float32Array(GN), P: new Float32Array(GN), WF: new Float32Array(GN),
    sx: new Float32Array(NS), sy: new Float32Array(NS), N0: new Int32Array(NS), W4: new Float32Array(NS * 4),
    nb: new Int16Array(NS * 6).fill(-1),
    st: new Uint8Array(NS), g: new Float32Array(NS), L: new Float32Array(NS), bri: new Float32Array(NS),
    thr: new Float32Array(NS), mu: new Float32Array(NS), rad: new Float32Array(NS), tdie: new Float32Array(NS).fill(-1),
    bx: new Float32Array(NS), by: new Float32Array(NS), bt: new Float32Array(NS),
    rich: new Float32Array(NS).fill(1), tf: new Float32Array(NS).fill(1), tick: 0, p1: new Float32Array(NS), p2: new Float32Array(NS), f1: new Float32Array(NS), f2: new Float32Array(NS),
    cnt: 0, litN: 0, lf: 0.2, full: 0, nextCull: 20, nextWash: 40, washFrac: 1, washEnd: 0,
    wash: { on: false, s: 0, ux: 0, uy: 1, v: 20, s1: 0, F: 0.1, rate: 3, ph: [0, 0, 0] },
    sph: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], buf: new Float32Array(W * H * 3),
    pn: new Int32Array(W * H), pw: new Float32Array(W * H * 4), cuts: 0, washes: 0,
  };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      let jx = gauss() * 0.6, jy = gauss() * 0.6;
      jx = cl(jx, -1.5, 1.5);
      jy = cl(jy, -1.5, 1.5);
      const x = MX + (c + 0.5 * (r & 1)) * DX + jx, y = MX + r * DY + jy;
      S.sx[i] = x;
      S.sy[i] = y;
      const gx = cl((x - 1) / 2, 0, GW - 1.001), gy = cl((y - 1) / 2, 0, GH - 1.001);
      const i0 = floor(gx), j0 = floor(gy), fx = gx - i0, fy = gy - j0;
      S.N0[i] = j0 * GW + i0;
      S.W4[i * 4] = (1 - fx) * (1 - fy);
      S.W4[i * 4 + 1] = fx * (1 - fy);
      S.W4[i * 4 + 2] = (1 - fx) * fy;
      S.W4[i * 4 + 3] = fx * fy;
      S.rad[i] = 1.5 + 0.28 * (rnd() * 2 - 1);
      S.p1[i] = rnd() * 6.283;
      S.p2[i] = rnd() * 6.283;
      S.f1[i] = 0.21 + 0.3 * rnd();
      S.f2[i] = 0.17 + 0.3 * rnd();
    }
  }
  for (let i = 0; i < NS; i++) {
    let m = 0;
    for (let j = 0; j < NS && m < 6; j++) {
      if (j === i) continue;
      const dx = S.sx[j] - S.sx[i], dy = S.sy[j] - S.sy[i];
      if (dx * dx + dy * dy < 5.6 * 5.6) S.nb[i * 6 + m++] = j;
    }
  }
  // each LED's four nodes of the signal sheet, so the ground is drawn smooth
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = cl(x * 0.5 - 0.25, 0, GW - 1.001), gy = cl(y * 0.5 - 0.25, 0, GH - 1.001);
      const i0 = floor(gx), j0 = floor(gy), fx = gx - i0, fy = gy - j0, p = y * W + x;
      S.pn[p] = j0 * GW + i0;
      S.pw[p * 4] = (1 - fx) * (1 - fy);
      S.pw[p * 4 + 1] = fx * (1 - fy);
      S.pw[p * 4 + 2] = (1 - fx) * fy;
      S.pw[p * 4 + 3] = fx * fy;
    }
  }
  // a few spores to start from
  for (let q = 0; q < 14; q++) seed(S, floor(rnd() * NS));
  S.washFrac = 0.3 + 0.8 * rnd();
  params.s = S;
}

function seed(S, i) {
  if (S.st[i]) return;
  S.st[i] = 1;
  S.g[i] = 0;
  S.L[i] = A0;
  S.bri[i] = 0;
  S.thr[i] = exp(0.2 * gauss());
  S.mu[i] = 0.6 + 0.8 * rnd();
  S.tdie[i] = -1;
  S.bx[i] = 0;
  S.by[i] = 0;
  S.bt[i] = -9;
}

function readKnobs(S, input) {
  const kv = (input && input.knobValues) || S.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) S.k[i] = kv[i];
  const k = S.k, f = cl(k[2], -1, 1), u = (cl(k[3], -1, 1) + 1) / 2;
  S.gm = pow(cl(k[1], 0.5, 4) / 2, 0.75);
  S.n = 3 + f;
  S.prod = ((1.25 * S.n + 0.5) * LAM) / 0.263;   // a full sheet of lit cells stands at 1.25 n + 0.5 thresholds; 0.263 cells to a node of a full sheet
  S.u = u;
  S.wF = exp(log(0.5) * (1 - u) + log(0.01) * u);
  S.wMean = 50 * pow(18 / 50, u);
}

function startWash(S) {
  const w = S.wash, r = rnd();
  let th = r < 0.34 ? PI / 2 : r < 0.68 ? -PI / 2 : r < 0.84 ? 0 : PI;
  th += (rnd() * 2 - 1) * 0.5;
  w.ux = cos(th);
  w.uy = sin(th);
  w.v = 10 + 6 * rnd();
  const pa = [0, W * w.ux, H * w.uy, W * w.ux + H * w.uy], lo = min(pa[0], pa[1], pa[2], pa[3]), hi = max(pa[0], pa[1], pa[2], pa[3]);
  w.s = lo - 13;
  w.s1 = hi + 56;
  w.F = pow(S.wF, 0.6 + 0.8 * rnd());
  w.rate = -log(w.F) / (17 / w.v);
  // the flush runs down a corridor, 25 to 45 LED wide at the weak end of the knob and the whole sheet's width at the hard end
  w.qc = -w.uy * (W / 2) + w.ux * (H / 2) + (rnd() * 2 - 1) * (abs(w.uy) > 0.5 ? 14 : 34);
  w.hw = 12 + 20 * S.u + 10 * rnd();
  w.ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  w.on = true;
  S.washes++;
}

// A dose that reaches part of the sheet: a ragged blob 50 to 80 LED across. Most
// of the cells in it die over a few seconds. The survivors are picked spread out,
// none beside another, so no clump is left in it to hold its light.
function cull(S) {
  const R = 24 + 16 * rnd(), p1 = rnd() * 6.28, p2 = rnd() * 6.28, sc = [];
  let cx = W * rnd(), cy = H * rnd();
  // it tends to fall where the colony is brightest
  if (S.litN > 8 && rnd() < 0.7) {
    let pick = floor(rnd() * S.litN);
    for (let i = 0; i < NS; i++) if (S.st[i] === 1 && S.bri[i] > 0.5 && pick-- === 0) {
      cx = S.sx[i];
      cy = S.sy[i];
      break;
    }
  }
  for (let i = 0; i < NS; i++) {
    if (S.st[i] !== 1) continue;
    const dx = S.sx[i] - cx, dy = S.sy[i] - cy, a = Math.atan2(dy, dx);
    if (sqrt(dx * dx + dy * dy) < R * (1 + 0.22 * sin(3 * a + p1) + 0.14 * sin(5 * a + p2))) sc.push([rnd(), i]);
  }
  if (sc.length < 16) return false;
  sc.sort((a, b) => a[0] - b[0]);
  const want = ceil(sc.length * (0.1 + 0.1 * rnd())), keep = new Uint8Array(NS);
  let kept = 0;
  for (let j = 0; j < sc.length && kept < want; j++) {
    const i = sc[j][1];
    let ok = true;
    for (let q = 0; q < 6; q++) if (S.nb[i * 6 + q] >= 0 && keep[S.nb[i * 6 + q]]) ok = false;
    if (ok) {
      keep[i] = 1;
      kept++;
    }
  }
  for (let j = 0; j < sc.length; j++) if (!keep[sc[j][1]]) S.tdie[sc[j][1]] = S.t + 0.3 + 3.5 * rnd();
  S.cuts++;
  return true;
}

// the medium is rich in some places and poor in others, and the cells' thresholds
// wander from place to place too; both drift slowly
function fields(S) {
  const t = S.t, ph = S.sph;
  for (let i = 0; i < NS; i++) {
    const x = S.sx[i], y = S.sy[i];
    S.rich[i] = exp(0.5 * (sin(x * 0.11 + ph[3] + t * 0.037) + sin(y * 0.062 + ph[4] - t * 0.029) + sin((x - y) * 0.075 + ph[5] + t * 0.021)));
    S.tf[i] = exp(0.2 * (sin(x * 0.07 - y * 0.05 + ph[1] - t * 0.027) + sin(y * 0.083 + ph[2] + t * 0.033)));
  }
}

// A burst of luminescence in one place: noise in the cells' switch. It takes
// where the colony is dense enough to hold the light, and fizzles where it is not.
function spark(S) {
  if (S.cnt < 20) return;
  let pick = floor(rnd() * S.cnt), cx = 0, cy = 0;
  for (let i = 0; i < NS; i++) if (S.st[i] === 1 && pick-- === 0) {
    cx = S.sx[i];
    cy = S.sy[i];
    break;
  }
  const r = 5 + 3 * rnd();
  for (let i = 0; i < NS; i++) {
    if (S.st[i] !== 1) continue;
    const dx = S.sx[i] - cx, dy = S.sy[i] - cy;
    if (dx * dx + dy * dy < r * r) S.L[i] = max(S.L[i], 0.9);
  }
}

function step(S) {
  const dt = DT, { A, A2, P, st, g, L, bri, thr, mu, tdie, nb } = S;
  S.t += dt;
  if (S.tick++ % 15 === 0) fields(S);
  // lit cells use up the oxygen: the more of the sheet is lit, the harder it is to switch on
  S.lf += (S.litN / NS - S.lf) * dt / 7;
  const ox = exp(OXY * (S.lf - 0.2));
  const t = S.t, n = S.n, prod = S.prod, gm = S.gm, WF = S.WF, wOn = S.wash.on, wRate = S.wash.rate * 0.35;
  P.fill(0);
  let cnt = 0, lit = 0;
  for (let i = 0; i < NS; i++) {
    const s = st[i];
    if (!s) continue;
    cnt++;
    const n0 = S.N0[i], w = i * 4, W4 = S.W4;
    const a = A[n0] * W4[w] + A[n0 + 1] * W4[w + 1] + A[n0 + GW] * W4[w + 2] + A[n0 + GW + 1] * W4[w + 3];
    const xn = pow(a / (thr[i] * S.tf[i] * ox), n), tg = A0 + (1 - A0) * (xn / (1 + xn));
    let li = L[i];
    // the fresh medium also draws the signal out of the cells
    if (wOn) li *= exp(-wRate * (WF[n0] * W4[w] + WF[n0 + 1] * W4[w + 1] + WF[n0 + GW] * W4[w + 2] + WF[n0 + GW + 1] * W4[w + 3]) * dt);
    const l2 = li + ((tg - li) * dt) / (tg > li ? TAUR : TAUF);
    L[i] = l2;
    const bi = bri[i];
    bri[i] = bi + ((l2 - bi) * dt) / (l2 > bi ? 1.0 : 1.7);
    if (bri[i] > 0.5) lit++;
    const gi = g[i], pr = prod * gi * (C0 + l2);
    P[n0] += pr * W4[w];
    P[n0 + 1] += pr * W4[w + 1];
    P[n0 + GW] += pr * W4[w + 2];
    P[n0 + GW + 1] += pr * W4[w + 3];
    if (s === 2) {
      g[i] = gi - dt / 1.5;
      if (g[i] <= 0) st[i] = 0;
      continue;
    }
    if (gi < 1) g[i] = min(1, gi + dt / 2.4);
    if (tdie[i] > 0 && t >= tdie[i]) {
      st[i] = 2;
      tdie[i] = -1;
      continue;
    }
    if (rnd() < DEATH * dt) {
      st[i] = 2;
      continue;
    }
    if (gi > 0.85 && rnd() < MU0 * gm * mu[i] * dt * 3) {
      // the medium is rich in some places and poor in others, and they drift
      if (rnd() * 3 > S.rich[i]) continue;
      let free = 0;
      for (let q = 0; q < 6; q++) {
        const j = nb[i * 6 + q];
        if (j >= 0 && !st[j]) free++;
      }
      if (free && rnd() < free / 6) {
        let pick = floor(rnd() * free);
        for (let q = 0; q < 6; q++) {
          const j = nb[i * 6 + q];
          if (j >= 0 && !st[j] && pick-- === 0) {
            seed(S, j);
            S.L[j] = l2 * 0.7;
            S.bri[j] = bri[i] * 0.6;
            S.bx[j] = S.sx[i] - S.sx[j];
            S.by[j] = S.sy[i] - S.sy[j];
            S.bt[j] = t;
            break;
          }
        }
      }
    }
  }
  S.cnt = cnt;
  S.litN = lit;
  if (rnd() < SPORE * dt) seed(S, floor(rnd() * NS));
  if (rnd() < SPARK * max(0.2, 1 - S.lf / 0.3) * dt) spark(S);

  // events: a cull when the sheet is full or its turn has come, a wash on its own schedule
  S.full = cnt > FULL * NS ? S.full + dt : 0;
  if ((t >= S.nextCull && cnt > 0.5 * NS) || S.full > 3) {
    if (cull(S)) {
      S.nextCull = t + 12 * (0.45 + 1.1 * rnd()) * (1.3 - cnt / NS) * (1.3 - lit / max(1, cnt));
      S.full = 0;
    } else S.nextCull = t + 3;
  }
  const w = S.wash;
  if (!w.on && t >= S.washEnd + S.washFrac * S.wMean) startWash(S);

  // the signal: diffusion, decay, a slow stream, the cells' make
  const hh = DIFF * dt / 4, lam = LAM * dt;
  const sa = 0.34 * (0.6 + 0.4 * sin(0.0173 * t + S.sph[0])) * (0.65 + 0.35 * sin(0.0291 * t + S.sph[2]));
  const th = 1.2 + 1.7 * sin(0.0137 * t + S.sph[1]) + 0.8 * sin(0.0239 * t + S.sph[0]);
  const vx = (sa * 3 * cos(th) * dt) / 2, vy = (sa * 3 * sin(th) * dt) / 2, cx = abs(vx), cy = abs(vy);
  for (let j = 0; j < GH; j++) {
    for (let i = 0; i < GW; i++) {
      const x = j * GW + i, a = A[x];
      const l = i > 0 ? A[x - 1] : a, r = i < GW - 1 ? A[x + 1] : a, u = j > 0 ? A[x - GW] : a, d = j < GH - 1 ? A[x + GW] : a;
      const ux = vx > 0 ? (i > 0 ? l : 0) : i < GW - 1 ? r : 0, uy = vy > 0 ? (j > 0 ? u : 0) : j < GH - 1 ? d : 0;
      A2[x] = a + hh * (l + r + u + d - 4 * a) - lam * a - cx * (a - ux) - cy * (a - uy) + P[x] * dt;
    }
  }
  S.A = A2;
  S.A2 = A;
  if (w.on) {
    w.s += w.v * dt;
    const B = S.A, WF = S.WF, ph = w.ph;
    const tt = t * 0.9;
    for (let j = 0; j < GH; j++) {
      const Y = 2 * j + 1;
      for (let i = 0; i < GW; i++) {
        const X = 2 * i + 1, q = -w.uy * X + w.ux * Y;
        const rag = 5.5 * sin(q * 0.165 + ph[0] + tt * 0.5) + 3.5 * sin(q * 0.3 + ph[1] - tt * 0.8) + 2.2 * sin(q * 0.57 + ph[2] + tt * 1.1);
        const d = w.s - (w.ux * X + w.uy * Y) - rag, x = j * GW + i;
        const wt = sm(0, 5, d) * (1 - sm(14, 26, d)) * (1 - sm(w.hw - 5, w.hw + 7, abs(q - w.qc) + 4 * sin(0.2 * (w.ux * X + w.uy * Y) + ph[1])));
        WF[x] = wt;
        if (wt > 0) B[x] *= exp(-w.rate * wt * dt);
      }
    }
    if (w.s > w.s1) {
      w.on = false;
      WF.fill(0);
      S.washEnd = t;
      S.washFrac = 0.35 + 1.3 * rnd();
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  readKnobs(S, input);
  if (!S.init) {
    S.init = true;
    S.washEnd = 0;
    // run it on until a front is under way, so the panel opens on a colony part lit
    for (let i = 0; i < 6600; i++) {
      step(S);
      if (i > 2100 && S.cnt > 0.3 * NS && S.litN > 0.2 * S.cnt && S.litN < 0.7 * S.cnt && !S.wash.on) break;
    }
  }
  S.acc += cl(dt || 0, 0, 0.1) * SPEED;
  let guard = 0;
  while (S.acc >= DT && guard++ < 6) {
    S.acc -= DT;
    step(S);
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
  return o;
}

// a dim orange reads as brown, so the dim colours' warm hues are pulled down to red
const warm = (h) => {
  h -= floor(h);
  return h < 0.22 ? h * sm(0, 0.22, h) : h;
};

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.init) return;
  const h0 = 0.46 + S.k[0], buf = S.buf, A = S.A, WF = S.WF, t = S.t;
  const base = hsv(warm(h0 + 0.11), 0.92, 0.12, [0, 0, 0]), tint = hsv(warm(h0 + 0.02), 0.8, 0.2, [0, 0, 0]), sheen = hsv(warm(h0 + 0.06), 0.4, 0.1, [0, 0, 0]);
  const off = hsv(warm(h0 + 0.01), 0.66, 0.36, [0, 0, 0]), on = hsv(h0 - 0.015, 0.6, 1, [0, 0, 0]), pale = hsv(h0 - 0.03, 0.12, 1, [0, 0, 0]);
  const pn = S.pn, pw = S.pw;
  for (let p = 0; p < W * H; p++) {
    const n0 = pn[p], q = p * 4;
    const a = A[n0] * pw[q] + A[n0 + 1] * pw[q + 1] + A[n0 + GW] * pw[q + 2] + A[n0 + GW + 1] * pw[q + 3];
    const wf = WF[n0] * pw[q] + WF[n0 + 1] * pw[q + 1] + WF[n0 + GW] * pw[q + 2] + WF[n0 + GW + 1] * pw[q + 3];
    const T = 1 - exp(-0.9 * a);
    buf[p * 3] = (base[0] + tint[0] * T + sheen[0] * wf) * 255;
    buf[p * 3 + 1] = (base[1] + tint[1] * T + sheen[1] * wf) * 255;
    buf[p * 3 + 2] = (base[2] + tint[2] * T + sheen[2] * wf) * 255;
  }
  for (let i = 0; i < NS; i++) {
    if (!S.st[i]) continue;
    const gi = S.g[i], r = S.rad[i] * sm(0, 1, gi);
    if (r < 0.25) continue;
    const dec = exp(-(t - S.bt[i]) / 0.9);
    const x = S.sx[i] + S.bx[i] * dec + 0.5 * sin(S.f1[i] * t + S.p1[i]), y = S.sy[i] + S.by[i] * dec + 0.5 * sin(S.f2[i] * t + S.p2[i]);
    const b = S.bri[i], bl = sm(0.1, 0.75, b), hl = 0.5 * b * b * (S.st[i] === 2 ? gi : 1);
    const cr = off[0] + (on[0] - off[0]) * bl, cg = off[1] + (on[1] - off[1]) * bl, cb = off[2] + (on[2] - off[2]) * bl;
    const wm = 0.7 * sm(0.6, 1, b);
    const R = r + 3.4, x0 = max(0, floor(x - R)), x1 = min(W - 1, floor(x + R)), y0 = max(0, floor(y - R)), y1 = min(H - 1, floor(y + R));
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - y;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - x, d2 = dx * dx + dy * dy, d = sqrt(d2), o = (py * W + px) * 3;
        const core = cl((r - d) / 1.1 + 0.5, 0, 1);
        if (core > 0) {
          const m = wm * (1 - 0.45 * min(1, d / r)), k = core * (S.st[i] === 2 ? 0.4 + 0.6 * gi : 1);
          buf[o] += ((cr + (pale[0] - cr) * m) * 255 - buf[o]) * k;
          buf[o + 1] += ((cg + (pale[1] - cg) * m) * 255 - buf[o + 1]) * k;
          buf[o + 2] += ((cb + (pale[2] - cb) * m) * 255 - buf[o + 2]) * k;
        }
        if (hl > 0.01) {
          const hv = hl * exp(-d2 / 4.6) * 255 * 0.55;
          buf[o] += on[0] * hv;
          buf[o + 1] += on[1] * hv;
          buf[o + 2] += on[2] * hv;
        }
      }
    }
  }
  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p % W, (p / W) | 0, min(255, buf[o]) | 0, min(255, buf[o + 1]) | 0, min(255, buf[o + 2]) | 0);
  }
}
