// ===== Patternflow pattern =====
// Title:   Gorkov Lattice
// Family:  levitation
// Idea:    A thin acoustic levitation chamber seen edge-on: four standing sound waves crossing at slowly drifting angles and phases lay a lattice of quiet pressure nodes, a thousand small beads float in them as glowing clumps that climb with the lattice and split, merge and slide as the nodes do, sag and drip onto a striped pile on the floor when the sound is turned down, and are taken up again by the lattice when it is turned up.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the radiation force on a small sphere in a sound field written as the gradient of one potential (L. P. Gor'kov, 1962, from memory); the radiation pressure of a standing wave on a sphere (L. V. King, 1934, from memory); traps moved by steering the phases of an ultrasonic array (Marzo, Drinkwater and others, acoustic tweezers, 2015, from memory). The chamber, the drift schedule, the floor pile and the colours are original, pattern round 269.
// Round:   269
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Drift=0.2..4, Spacing=-1..1, Power=-1..1
//
// Knob 1: Hue. Turns the beads round the colour wheel from ice blue at 0; the sound field behind them is drawn 0.38 of a turn further on, deep rose at 0, and the pile takes the beads' colour in two shades.
// Knob 2: Drift. How fast the four waves wander, as 0.7 (0.3 + K2) units of drift a second: 0.35 at 0.2, 1.6 at 2 and 3.0 at 4. The lattice climbs 0.55 LED a unit, give or take 0.2, so about 0.9 LED a second where it opens and a row crosses the panel in a little over two minutes; at 4 it climbs 1.7 LED a second and the traps outrun some beads, which slide after them in short streaks; at 0.2 it creeps.
// Knob 3: Spacing. Half a wavelength of each standing wave, the distance between its pressure nodes: 8 LED at -1, 11.4 where it opens and 20 at 1, which puts about 110, 55 or 16 traps on the panel.
// Knob 4: Power. The sound pressure against gravity, given as the mean pull of the field over the 14 LED a second a bead falls at: 0.5 at -1, 2.5 at -0.5, 8.9 where it opens and 20 at 1. At -1 every bead slides out of its trap and is on the floor within about twenty seconds; at -0.5 the weaker traps let go and beads drip in strings from clump to clump; above the opening the clumps shrink and sit tight. Turned back up, the traps that rise out of the floor take the pile up again, the bottom rows within twenty seconds and the whole panel over about two minutes.
//
// What the picture is. A thin levitation chamber seen edge-on, 64 x 128 LED standing up. Behind everything the loudness of the sound, the time mean of p squared, is a dim rose interference pattern, 22 to 73 of 255 where it opens, and its dark holes are the pressure nodes. In the holes hang about 55 clumps of beads. Each bead is drawn as a soft blur about 3 LED across, so a clump of twenty is an ice-blue oval 4 to 7 LED long with a pale core, lying along the long axis of its trap. The lattice climbs slowly and sways sideways by about 8 LED, and the clumps go with it and out at the top while new ones are lifted off the floor. As the waves drift the lattice passes from squares and near-hexagons to rows of short bars and to eight-fold rosettes, a ring of beads round a central clump; a node splits and its clump splits with it, or two run together. On the floor lies a pile of beads in stripes of two shades, laid down in the order they landed, and where a trap passes over it the loose top layer stands up by about a LED.
// The model. Four standing waves of one frequency, each two equal plane waves running opposite ways: pressure a cos(k n.x + s) e^(i tau) and air velocity, in pressure units, a n sin(k n.x + s) e^(i tau), summed into a complex P and V on every LED each frame. A bead feels Gor'kov's potential U = |P|^2 / 3 - |V|^2 / 2, the form for a bead much denser and stiffer than air (f1 = f2 = 1), whose minima are pressure nodes where the air moves most. The four directions start 45 degrees apart. The whole set turns back and forth by up to 66 degrees over about ten minutes, the two diagonal pairs wobble by 15 degrees and the other two by 5. The amplitudes rise and fall so the two loudest pairs always play at 84 to 100 percent and the other two fade down to 6 percent, which is what moves the lattice between two, three and four sounding pairs. The phases in time sit 45 degrees apart and wander by 14, so nodes stay points and never run together into lines. The phases in space ramp so the lattice climbs, with slips of up to a third of a spacing that split and merge nodes. Every wander has its own frequency between 0.008 and 0.065 per unit of drift and no two are a ratio of small whole numbers, so the scene does not come back. A bead moves overdamped: its velocity is c times minus the gradient of U, plus 14 LED/s down, plus Brownian jitter of 0.04 LED^2/s, with c set each frame so the mean pull over the panel is Power times 14. In the steep wells the step is taken implicitly, divided by 1 + S h with S the local stiffness, which reaches 300 a second at full power. Beads are discs 1 LED across that may not overlap, two passes of position correction per 1/60 s step, and each neighbour a bead touches slows it, since the clump holds it as well as the trap. A bead that lands on the floor joins its column, 0.55 LED a bead, and a column more than one bead taller than its neighbour sheds its top bead to it, a slope of 29 degrees. It is lifted off again when the field at the surface pulls up harder than gravity and fewer than 20 free beads sit in the 5 x 7 LED above. Fourteen seconds are run at the knobs as found before the first frame.
// What is exact and what is not. The potential and its minima at the pressure nodes, the sum of plane waves, the overdamped fall and the balance of trap against gravity are the textbook picture (from memory). The trap strength is set from the mean slope of U each frame, so Power means the same whichever waves are loud; a real array would have to be driven that way. The drift schedule, the climb and the rule that two pairs always sound are chosen so the traps stay points. Beads carried out of the top or a side are put back on the floor at a random column, as if they had fallen down outside the panel. Beads do not scatter sound onto each other, there is no acoustic streaming, and the waves are unbounded, with no walls to reflect them. The pile is columns with a fixed slope. At 40 kHz in air the nodes are 4.3 mm apart, so where it opens one LED is 0.38 mm and the panel 24 by 48 mm; a polystyrene bead 40 micrometres across falls about 5 cm a second there, ten times faster than the 5 mm a second (14 LED) here.

const W = 64, H = 128, NPIX = W * H;
const NP = 4;            // standing-wave pairs
const NG = 1000;         // beads
const G = 14;            // LED/s, how fast a bead falls through still air
const DIA = 1.0;         // contact diameter, LED
const HP = 0.55;         // LED of pile one bead adds to its column
const SMAX = 400;        // deepest pile a column can hold, in beads
const STEP = 1 / 60;
const TAKE = 20;         // beads a trap lifts off the floor before it stops taking more
const CDAMP = 2.5;       // how much each touching neighbour slows a bead
const HOLD = 8.0;        // mean field speed over fall speed at Power 0
const { floor, sqrt, sin, cos, exp, min, max, abs, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const rnd = () => Math.random();
const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7320508;

export function setup(params) {
  const s = {
    k: [0, 2, 0, 0.06], init: false, acc: 0, t: 0, m: 0,
    X: new Float32Array(NG), Y: new Float32Array(NG), NC: new Uint8Array(NG), VN: new Float32Array(NG), ST: new Uint8Array(NG),
    pool: new Int32Array(NG), npool: 0,
    CNT: new Int32Array(W), TINT: new Float32Array(W * SMAX),
    head: new Int32Array(NPIX).fill(-1), nxt: new Int32Array(NG),
    U: new Float32Array(NPIX), SS: new Float32Array(NPIX), P2: new Float32Array(NPIX), VX: new Float32Array(NPIX), VY: new Float32Array(NPIX),
    DEN: new Float32Array(NPIX), TMP: new Float32Array(NPIX),
    RC: new Float32Array(NP * W), RS: new Float32Array(NP * W), CC: new Float32Array(NP * H), CS: new Float32Array(NP * H),
    sp: new Float64Array(NP), w: [], spacing: 12.6, pw: 1, rate: 1, gm: 0, ga: 0.05,
  };
  // every slow wander gets its own frequency; no two share a ratio of small whole numbers
  const F = [0.0123, 0.0171, 0.0219, 0.0298, 0.0337, 0.0413, 0.0467, 0.0529, 0.0611, 0.0083, 0.0149, 0.0257,
    0.0359, 0.0439, 0.0577, 0.0193, 0.0283, 0.0391, 0.0491, 0.0647, 0.0107, 0.0233, 0.0317, 0.0547];
  for (let p = 0; p < NP; p++) {
    const f = (j) => F[(p * 6 + j) % F.length] * (0.93 + 0.14 * rnd());
    s.w.push({
      base: (p * PI) / 4,
      a1: p & 1 ? 0.18 : 0.06, f1: f(0), p1: rnd() * 6.283, a2: p & 1 ? 0.09 : 0.03, f2: f(1), p2: rnd() * 6.283,
      fa: f(2), pa: rnd() * 6.283, fb: f(3) * 1.7, pb: rnd() * 6.283,
      tb: (p * PI) / 4, ft: f(4), pt: rnd() * 6.283,
      fe: f(5), pe: rnd() * 6.283,
    });
    s.sp[p] = rnd() * 6.283;
  }
  s.rot = { f1: 0.0061, p1: rnd() * 6.283, f2: 0.0137, p2: rnd() * 6.283 };
  s.cv = { fx: 0.031, px: rnd() * 6.283, fy: 0.017, py: rnd() * 6.283 };
  s.m = rnd() * 4000;
  params.s = s;
}

function readKnobs(s, input) {
  const kv = (input && input.knobValues) || s.k;
  for (let i = 0; i < 4; i++) if (typeof kv[i] === "number" && isFinite(kv[i])) s.k[i] = kv[i];
  s.rate = cl(s.k[1], 0.2, 4);
  s.spacing = 8 + 12 * pow((cl(s.k[2], -1, 1) + 1) / 2, 1.8);
  const z = cl(s.k[3], -1, 1);
  s.pw = pow(2, 2.66 * z - 1.34 * z * z);
}

// ---- the sound field
function field(s) {
  const { RC, RS, CC, CS, U, P2, VX, VY, w } = s;
  const m = s.m, k = PI / s.spacing;
  const rot = 0.7 * sin(s.rot.f1 * m + s.rot.p1) + 0.45 * sin(s.rot.f2 * m + s.rot.p2);
  const amp = [], th = [], raw = [];
  for (let p = 0; p < NP; p++) {
    const q = w[p];
    th[p] = rot + q.base + q.a1 * sin(q.f1 * m + q.p1) + q.a2 * sin(q.f2 * m + q.p2);
    raw[p] = sin(q.fa * m + q.pa) + 0.5 * sin(q.fb * m + q.pb);
  }
  // the two loudest pairs always sound; the other two fade in and out against the middle of the order
  const ord = raw.slice().sort((a, b) => b - a), mid = (ord[1] + ord[2]) / 2;
  let a2 = 0;
  for (let p = 0; p < NP; p++) {
    const a = 0.06 + 0.94 * sm(-0.7, 0.25, raw[p] - mid);
    amp[p] = a;
    a2 += a * a;
  }
  const nrm = 1 / sqrt(a2);
  const AC = new Float32Array(NP), AS = new Float32Array(NP), XC = new Float32Array(NP), XS = new Float32Array(NP), YC = new Float32Array(NP), YS = new Float32Array(NP);
  for (let p = 0; p < NP; p++) {
    const q = w[p];
    const nx = cos(th[p]), ny = sin(th[p]);
    const a = amp[p] * nrm;
    const tau = q.tb + 0.25 * sin(q.ft * m + q.pt);
    const ct = cos(tau), st = sin(tau);
    AC[p] = a * ct; AS[p] = a * st;
    XC[p] = a * nx * ct; XS[p] = a * nx * st;
    YC[p] = a * ny * ct; YS[p] = a * ny * st;
    const sh = s.sp[p] + 1.1 * sin(q.fe * m + q.pe);
    for (let x = 0; x < W; x++) {
      const ph = k * nx * (x + 0.5 - W / 2) + sh;
      RC[p * W + x] = cos(ph); RS[p * W + x] = sin(ph);
    }
    for (let y = 0; y < H; y++) {
      const ph = k * ny * (y + 0.5 - H / 2);
      CC[p * H + y] = cos(ph); CS[p * H + y] = sin(ph);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let pr = 0, pi = 0, xr = 0, xi = 0, yr = 0, yi = 0;
      for (let p = 0; p < NP; p++) {
        const rc = RC[p * W + x], rs = RS[p * W + x], cc = CC[p * H + y], cs = CS[p * H + y];
        const c = rc * cc - rs * cs, sn = rs * cc + rc * cs;
        pr += AC[p] * c; pi += AS[p] * c;
        xr += XC[p] * sn; xi += XS[p] * sn;
        yr += YC[p] * sn; yi += YS[p] * sn;
      }
      const p2 = pr * pr + pi * pi, v2 = xr * xr + xi * xi + yr * yr + yi * yi;
      const i = y * W + x;
      P2[i] = p2;
      U[i] = p2 / 3 - v2 / 2;
    }
  }
  // the drift of a bead in the field, LED/s. The trap speed is set from the mean slope of U, so
  // that Power means the same hold against gravity whichever waves are loud.
  let gs = 0;
  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < W; x++) {
      const xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x;
      const i = y * W + x;
      const gx = (U[y * W + xp] - U[y * W + xm]) / (xp - xm), gy = (U[yp * W + x] - U[ym * W + x]) / (yp - ym);
      VX[i] = gx; VY[i] = gy;
      gs += abs(gx) + abs(gy);
    }
  }
  const mean = gs / NPIX / k;
  s.gm = s.gm > 0 ? s.gm + (mean - s.gm) * s.ga : mean;
  const vt = -(G * HOLD * s.pw) / s.gm / k;
  // the stiffness of the field at each LED, per second: a bound on the largest curvature of U
  // times the trap speed, so a step can be taken implicitly in the steep wells
  const SS = s.SS, va = -vt;
  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? -W : 0, yp = y < H - 1 ? W : 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, xm = x > 0 ? -1 : 0, xp = x < W - 1 ? 1 : 0, u = U[i];
      const uxx = U[i + xm] - 2 * u + U[i + xp], uyy = U[i + ym] - 2 * u + U[i + yp];
      const uxy = abs(U[i + yp + xp] - U[i + yp + xm] - U[i + ym + xp] + U[i + ym + xm]) / 4;
      SS[i] = va * max(0, abs(uxx) + uxy, abs(uyy) + uxy);
    }
  }
  for (let i = 0; i < NPIX; i++) { VX[i] *= vt; VY[i] *= vt; }
}

function sample(A, x, y) {
  let fx = x - 0.5, fy = y - 0.5;
  fx = cl(fx, 0, W - 1.001); fy = cl(fy, 0, H - 1.001);
  const ix = fx | 0, iy = fy | 0, ux = fx - ix, uy = fy - iy, i = iy * W + ix;
  return (A[i] * (1 - ux) + A[i + 1] * ux) * (1 - uy) + (A[i + W] * (1 - ux) + A[i + W + 1] * ux) * uy;
}

// ---- the pile on the floor
function surf(s, c) {
  return H - s.CNT[c] * HP;
}

function absorb(s, i) {
  const { CNT, TINT } = s;
  let c = cl(floor(s.X[i]), 0, W - 1);
  for (let g = 0; g < 40; g++) {
    const l = c > 0 ? CNT[c - 1] : 1e9, r = c < W - 1 ? CNT[c + 1] : 1e9;
    const lo = min(l, r);
    if (CNT[c] <= lo + 1) break;
    c = l < r ? c - 1 : r < l ? c + 1 : rnd() < 0.5 ? c - 1 : c + 1;
  }
  if (CNT[c] >= SMAX) return;
  TINT[c * SMAX + CNT[c]] = cl(0.5 + 0.32 * sin(0.9 * s.t) + 0.22 * sin(0.37 * s.t + 1.3) + 0.12 * (rnd() - 0.5), 0, 1);
  CNT[c]++;
  s.ST[i] = 1;
  s.pool[s.npool++] = i;
}

function slide(s, a, b) {
  const { CNT, TINT } = s;
  TINT[b * SMAX + CNT[b]] = TINT[a * SMAX + CNT[a] - 1];
  CNT[a]--; CNT[b]++;
}

function settle(s) {
  const CNT = s.CNT;
  for (let x = 0; x < W - 1; x++) {
    if (CNT[x] - CNT[x + 1] >= 2) slide(s, x, x + 1);
    else if (CNT[x + 1] - CNT[x] >= 2) slide(s, x + 1, x);
  }
  for (let x = W - 2; x >= 0; x--) {
    if (CNT[x] - CNT[x + 1] >= 2) slide(s, x, x + 1);
    else if (CNT[x + 1] - CNT[x] >= 2) slide(s, x + 1, x);
  }
}

// free beads in the 5 x 7 LED above a point, from the contact grid of the last step
function crowd(s, x, y) {
  const { head, nxt } = s;
  const cx = floor(x), cy = floor(y);
  let n = 0;
  for (let yy = max(0, cy - 6); yy <= min(H - 1, cy); yy++)
    for (let xx = max(0, cx - 2); xx <= min(W - 1, cx + 2); xx++)
      for (let j = head[yy * W + xx]; j >= 0; j = nxt[j]) n++;
  return n;
}

function lift(s, h) {
  const { CNT, VY } = s;
  for (let c = 0; c < W; c++) {
    if (!CNT[c] || !s.npool) continue;
    const y = surf(s, c) - 0.6;
    const vn = sample(VY, c + 0.5, y) + G;
    // a trap rising out of the pile takes up beads until it carries a clump of about TAKE
    if (vn < 0 && rnd() < min(1, (0.15 - vn / G) * 12 * h) && crowd(s, c + 0.5, y) < TAKE) {
      CNT[c]--;
      const i = s.pool[--s.npool];
      s.ST[i] = 0;
      s.X[i] = c + 0.2 + 0.6 * rnd();
      s.Y[i] = y - 0.2;
    }
  }
}

// ---- the beads
function step(s, h) {
  const { X, Y, VN, ST, VX, VY, SS, NC, head, nxt } = s;
  const nz = sqrt(2 * 0.04 * h);
  const cap = 0.9;
  for (let i = 0; i < NG; i++) {
    if (ST[i]) continue;
    const vx = sample(VX, X[i], Y[i]);
    const vy = sample(VY, X[i], Y[i]) + G;
    VN[i] = vy;
    // linearised implicit Euler: in a well of stiffness S the step shrinks by 1 + S h and never overshoots
    // a bead packed among others is held by them as well: each touching neighbour slows it like a wall would
    const f = h / (1 + sample(SS, X[i], Y[i]) * h + CDAMP * NC[i]);
    let dx = vx * f, dy = vy * f;
    const d = sqrt(dx * dx + dy * dy);
    if (d > cap) { dx *= cap / d; dy *= cap / d; }
    X[i] += dx + nz * gauss();
    Y[i] += dy + nz * gauss();
  }
  // contacts: beads are discs DIA across that may not overlap
  NC.fill(0);
  for (let it = 0; it < 2; it++) {
    head.fill(-1);
    for (let i = 0; i < NG; i++) {
      if (ST[i]) continue;
      const c = cl(floor(X[i]), 0, W - 1) + cl(floor(Y[i]), 0, H - 1) * W;
      nxt[i] = head[c]; head[c] = i;
    }
    for (let i = 0; i < NG; i++) {
      if (ST[i]) continue;
      const cx = cl(floor(X[i]), 0, W - 1), cy = cl(floor(Y[i]), 0, H - 1);
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= H) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= W) continue;
          for (let j = head[yy * W + xx]; j >= 0; j = nxt[j]) {
            if (j <= i) continue;
            let ex = X[j] - X[i], ey = Y[j] - Y[i];
            let d2 = ex * ex + ey * ey;
            if (d2 >= DIA * DIA) continue;
            if (d2 < 1e-6) { ex = rnd() - 0.5; ey = rnd() - 0.5; d2 = ex * ex + ey * ey; }
            const d = sqrt(d2), c = ((DIA - d) / d) * 0.25;
            if (it === 0) { NC[i]++; NC[j]++; }
            X[i] -= ex * c; Y[i] -= ey * c;
            X[j] += ex * c; Y[j] += ey * c;
          }
        }
      }
    }
  }
  // walls, ceiling and the pile
  for (let i = 0; i < NG; i++) {
    if (ST[i]) continue;
    // carried out of the panel at the top or a side: back onto the floor, anywhere along it
    if (Y[i] < 0.3 || X[i] < 0.2 || X[i] > W - 0.2) { X[i] = 0.5 + rnd() * (W - 1); absorb(s, i); continue; }
    const c = cl(floor(X[i]), 0, W - 1);
    const top = surf(s, c) - 0.5;
    if (Y[i] > top) {
      if (VN[i] > 0.3 * G) absorb(s, i);
      else Y[i] = top;
    }
  }
}

function advance(s, dt) {
  // the drift clock and the climb of the lattice
  const dm = dt * (0.3 + s.rate) * 0.7;
  const m = s.m, k = PI / s.spacing;
  const ux = 0.25 * sin(s.cv.fx * m + s.cv.px);
  const uy = -(0.55 + 0.2 * sin(s.cv.fy * m + s.cv.py));
  const rot = 0.7 * sin(s.rot.f1 * m + s.rot.p1) + 0.45 * sin(s.rot.f2 * m + s.rot.p2);
  for (let p = 0; p < NP; p++) {
    const q = s.w[p];
    const th = rot + q.base + q.a1 * sin(q.f1 * m + q.p1) + q.a2 * sin(q.f2 * m + q.p2);
    s.sp[p] -= k * (cos(th) * ux + sin(th) * uy) * dm;
    if (s.sp[p] > 1e4 || s.sp[p] < -1e4) s.sp[p] %= 2 * PI;
  }
  s.m += dm;
  s.t += dt;
}

function init(s) {
  s.init = true;
  for (let i = 0; i < NG; i++) {
    s.X[i] = 0.5 + rnd() * (W - 1);
    s.Y[i] = 0.5 + rnd() * (H - 4);
    s.ST[i] = 0;
  }
  // run fourteen seconds at the knobs as found, so the beads are already in the lattice, or on the floor
  const h = 1 / 30;
  for (let n = 0; n < 420; n++) {
    advance(s, h);
    if (n % 3 === 0) field(s);
    step(s, h);
    lift(s, h);
    settle(s);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s;
  readKnobs(s, input);
  if (!s.init) init(s);
  const d = cl(dt || 0, 0, 0.1);
  advance(s, d);
  field(s);
  s.acc += d;
  let guard = 0;
  while (s.acc >= STEP && guard++ < 6) {
    s.acc -= STEP;
    step(s, STEP);
  }
  lift(s, d);
  settle(s);
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

const LB = new Float32Array(256 * 3), LF = new Float32Array(256 * 3);

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (!s.init) init(s);
  const { X, Y, ST, DEN, TMP, P2, CNT, TINT } = s;
  const hb = 0.55 + s.k[0], hf = hb + 0.38;
  const o = [0, 0, 0];
  // bead light by density, beads per square LED after the blur
  for (let j = 0; j < 256; j++) {
    const r = (j / 255) * 3;
    const L = 1 - exp(-1.5 * r);
    hsv(hb, 0.92 - 0.6 * sm(0.7, 2.6, r), L, o);
    LB[j * 3] = o[0] * 255; LB[j * 3 + 1] = o[1] * 255; LB[j * 3 + 2] = o[2] * 255;
  }
  for (let j = 0; j < 256; j++) {
    const e = (j / 255) * 2.5;
    const g = pow(min(1, e / 2), 0.85);
    hsv(hf, 0.8, 0.085 + 0.2 * g, o);
    LF[j * 3] = o[0] * 255; LF[j * 3 + 1] = o[1] * 255; LF[j * 3 + 2] = o[2] * 255;
  }
  DEN.fill(0);
  for (let i = 0; i < NG; i++) {
    if (ST[i]) continue;
    const fx = X[i] - 0.5, fy = Y[i] - 0.5;
    const ix = floor(fx), iy = floor(fy), ux = fx - ix, uy = fy - iy;
    for (let a = 0; a < 2; a++) {
      const yy = iy + a;
      if (yy < 0 || yy >= H) continue;
      const wy = a ? uy : 1 - uy;
      for (let b = 0; b < 2; b++) {
        const xx = ix + b;
        if (xx < 0 || xx >= W) continue;
        DEN[yy * W + xx] += wy * (b ? ux : 1 - ux);
      }
    }
  }
  // two passes of 1 4 6 4 1, about one LED of spread each way
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = 6 * DEN[i];
      v += x > 0 ? 4 * DEN[i - 1] : 0; v += x < W - 1 ? 4 * DEN[i + 1] : 0;
      v += x > 1 ? DEN[i - 2] : 0; v += x < W - 2 ? DEN[i + 2] : 0;
      TMP[i] = v / 16;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = 6 * TMP[i];
      v += y > 0 ? 4 * TMP[i - W] : 0; v += y < H - 1 ? 4 * TMP[i + W] : 0;
      v += y > 1 ? TMP[i - 2 * W] : 0; v += y < H - 2 ? TMP[i + 2 * W] : 0;
      DEN[i] = v / 16;
    }
  const pc = [0, 0, 0];
  for (let x = 0; x < W; x++) {
    const n = CNT[x];
    let top = ((x > 0 ? CNT[x - 1] : n) + 2 * n + (x < W - 1 ? CNT[x + 1] : n)) * HP / 4;
    // where the sound pulls up on the surface, the loose top layer stands a little higher
    if (n > 0) top += 1.1 * sm(0.15, 1, -sample(s.VY, x + 0.5, H - top - 0.6) / G);
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      const fj = cl(floor((P2[i] / 2.5) * 255), 0, 255) * 3;
      let r = LF[fj], g = LF[fj + 1], b = LF[fj + 2];
      const dj = cl(floor((DEN[i] / 3) * 255), 0, 255) * 3;
      r += LB[dj]; g += LB[dj + 1]; b += LB[dj + 2];
      // the pile
      const f0 = H - 1 - y;
      const cover = cl(top - f0, 0, 1);
      if (cover > 0) {
        // an empty column under a smoothed edge borrows the strata of its fuller neighbour
        const src = n > 0 ? x : x > 0 && (x === W - 1 || CNT[x - 1] >= CNT[x + 1]) ? x - 1 : x + 1;
        const jg = cl(floor((f0 + 0.5) / HP), 0, max(0, CNT[src] - 1));
        const tn = TINT[src * SMAX + jg];
        const depth = top - f0;
        const lit = 0.22 + 0.3 * tn + 0.2 * (1 - sm(0, 2.5, depth));
        hsv(hb + 0.08 * (tn - 0.5), 0.8 - 0.25 * tn, lit, pc);
        r = r * (1 - cover) + pc[0] * 255 * cover;
        g = g * (1 - cover) + pc[1] * 255 * cover;
        b = b * (1 - cover) + pc[2] * 255 * cover;
      }
      display.setPixel(x, y, min(255, r) | 0, min(255, g) | 0, min(255, b) | 0);
    }
  }
}
