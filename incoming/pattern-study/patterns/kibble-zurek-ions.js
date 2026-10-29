// ===== Patternflow pattern =====
// Title:   Kibble-Zurek Ions
// Family:  particle
// Idea:    A chain of 30 to 40 ions standing the height of the panel buckles into a zigzag each time its transverse trap is lowered past the critical value, the quench freezes in kinks where the two orientations of the zigzag meet, and the chain prints its history outward on both sides, one rib per ion every quarter second, magenta and green for the two orientations with yellow seams where the kinks run.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kibble-Zurek mechanism (Tom Kibble, 1976; Wojciech Zurek, 1985), the linear-zigzag transition of ion chains (Shmuel Fishman, Gabriele De Chiara, Tommaso Calarco and Giovanna Morigi, 2008), kinks quenched into ion crystals (Karsten Pyka and others, 2013; Stefan Ulm and others, 2013), pattern round 64
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Quench=0.2..3, Ions=30..40, Heat=0..1
//
// Knob 1: Hue. Turns the four colours round the wheel together. At 0 the two orientations of the zigzag are magenta and green, the straight chain blue and the kinks yellow; at 0.25 the orientations are orange and azure on a rose chain; at 0.5 magenta and green trade places and the straight chain turns yellow.
// Knob 2: Quench. How fast the transverse trap frequency falls from 1.3 to 0.42 times its critical value: in 10 s at 0.2, 3.2 s at 1, 0.78 s at 2 and 0.19 s at 3. Over 60 quenches of 30 ions, counted 1.2 s into the hold, that freezes in 0.15 kinks at 0.2, 0.73 at 1, 1.9 at 2 and 2.1 at 3; during the 4 s hold about half of them slide out at the ends.
// Knob 3: Ions. 30 to 40 ions, the axial trap set so a straight chain of any count reaches from row 5 to row 122. Thirty ions sit 3.3 rows apart in the middle and 6.5 at the ends and buckle when the transverse frequency drops below 12.0 times the axial one; forty sit 2.4 rows apart, buckle below 15.5 times and have room for more kinks, 3.1 a quench at Quench 3.
// Knob 4: Heat. The temperature of the random kicks that stand for the cooling laser's photon recoil. At 0.06 they only decide which way each stretch of the chain buckles; at 0.5 the zigzag shivers and the kinks drift; toward 1 kinks and antikinks pop up in pairs and the history breaks into short domains.

const W = 64, H = 128, CX = 31.5, CY = 63.5;
const { floor, min, max, abs, sqrt, exp, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Units: lengths in LEDs, time in 1 / omega_z, the axial trap frequency, so
// the axial force is -y. The Coulomb constant K is set per ion count so the
// linear chain reaches HALF rows each way from the middle.
const HALF = 58;
// The transverse trap frequency as a fraction of its critical value: RHI
// holds the chain straight, RLO is the bottom of the quench. At RLO all but
// the two end ions on each side buckle, 2.9 LEDs off the axis for 30 ions.
const RHI = 1.3, RLO = 0.42;
const DT = 0.004, GAMMA = 2, RATE = 1;
// The transverse axis is drawn XS times wider than the axial one, so the
// zigzag of 30 ions spans 12 columns.
const XS = 2;
// History: KW columns each side of the chain, one every KT seconds.
const KW = 19, KT = 0.25;
// Phases of the cycle in seconds: straight hold, quench (from the knob),
// zigzag hold, release.
const T_LIN = 1, T_HOLD = 4, T_UP = 1;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

// The straight chain of n ions for Coulomb constant 1, by Newton's method,
// then scaled to HALF; and the critical transverse stiffness, the largest
// eigenvalue of the transverse Coulomb matrix (its zigzag mode).
function chainFor(n) {
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) z[i] = (i - (n - 1) / 2) * 0.9;
  const J = new Float64Array(n * n), f = new Float64Array(n);
  for (let it = 0; it < 60; it++) {
    J.fill(0);
    let err = 0;
    for (let i = 0; i < n; i++) {
      let fi = -z[i], dii = -1;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const d = z[i] - z[j], ad = abs(d);
        fi += (d > 0 ? 1 : -1) / (d * d);
        const c = 2 / (ad * ad * ad);
        dii -= c;
        J[i * n + j] = c;
      }
      J[i * n + i] = dii;
      f[i] = -fi;
      err = max(err, abs(fi));
    }
    if (err < 1e-10) break;
    // Gaussian elimination on J dz = -f.
    for (let c = 0; c < n; c++) {
      const p = J[c * n + c];
      for (let r = c + 1; r < n; r++) {
        const m = J[r * n + c] / p;
        if (!m) continue;
        for (let k = c; k < n; k++) J[r * n + k] -= m * J[c * n + k];
        f[r] -= m * f[c];
      }
    }
    let lim = 1;
    for (let r = n - 1; r >= 0; r--) {
      let s = f[r];
      for (let k = r + 1; k < n; k++) s -= J[r * n + k] * f[k];
      f[r] = s / J[r * n + r];
    }
    for (let i = 1; i < n; i++) {
      const gap = z[i] - z[i - 1], close = f[i - 1] - f[i];
      if (close > 0.5 * gap) lim = min(lim, (0.5 * gap) / close);
    }
    for (let i = 0; i < n; i++) z[i] += lim * f[i];
  }
  const s = HALF / z[n - 1], K = s * s * s;
  for (let i = 0; i < n; i++) z[i] *= s;
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = abs(z[i] - z[j]), c = K / (d * d * d);
      M[i * n + i] += c;
      M[i * n + j] -= c;
    }
  let v = new Float64Array(n), u = new Float64Array(n), lam = 0;
  for (let i = 0; i < n; i++) v[i] = i % 2 ? 1 : -1;
  for (let it = 0; it < 400; it++) {
    let nn = 0;
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (let j = 0; j < n; j++) a += M[i * n + j] * v[j];
      u[i] = a;
      nn += a * a;
    }
    lam = sqrt(nn);
    for (let i = 0; i < n; i++) v[i] = u[i] / lam;
  }
  return { n, K, z, kxc: lam };
}

export function setup(params) {
  params.s = {
    chains: {}, c: null, n: 0,
    x: new Float64Array(40), y: new Float64Array(40), vx: new Float64Array(40), vy: new Float64Array(40),
    fx: new Float64Array(40), fy: new Float64Array(40), rank: new Int32Array(40), phi: new Float64Array(40),
    hy: new Float32Array(KW * 40), hp: new Float32Array(KW * 40), hn: new Uint8Array(KW), head: 0, kt: 0,
    rgb: new Float32Array(W * H * 3), c: new Float32Array(3), ck: new Float32Array(3),
    phase: 0, pt: 0, r: RHI, tq: 1, temp: 0.002, hue: 0, kinks: [], started: false,
  };
  return params.s;
}

function load(S, n) {
  if (!S.chains[n]) S.chains[n] = chainFor(n);
  const c = (S.c = S.chains[n]);
  S.n = n;
  for (let i = 0; i < n; i++) {
    S.x[i] = 0;
    S.y[i] = c.z[i];
    S.vx[i] = S.vy[i] = 0;
    S.rank[i] = i;
  }
  S.phase = 0;
  S.pt = 0;
  S.r = RHI;
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) * 2;
}

function step(S, h) {
  const n = S.n, x = S.x, y = S.y, vx = S.vx, vy = S.vy, fx = S.fx, fy = S.fy, K = S.c.K;
  const kx = S.c.kxc * S.r * S.r;
  for (let i = 0; i < n; i++) {
    fx[i] = -kx * x[i];
    fy[i] = -y[i];
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j], dy = y[i] - y[j], r2 = dx * dx + dy * dy, inv = K / (r2 * sqrt(r2));
      fx[i] += dx * inv;
      fy[i] += dy * inv;
      fx[j] -= dx * inv;
      fy[j] -= dy * inv;
    }
  const kick = sqrt(2 * GAMMA * S.temp * h), g = 1 - GAMMA * h;
  for (let i = 0; i < n; i++) {
    vx[i] = (vx[i] + fx[i] * h) * g + kick * gauss();
    vy[i] = (vy[i] + fy[i] * h) * g + kick * gauss();
    x[i] += vx[i] * h;
    y[i] += vy[i] * h;
  }
}

// Order the ions along the axis and read the zigzag order parameter of
// each, its sideways offset with the sign flipped on every other ion.
function order(S) {
  const n = S.n, rank = S.rank, y = S.y;
  for (let a = 1; a < n; a++) {
    const v = rank[a];
    let b = a - 1;
    while (b >= 0 && y[rank[b]] > y[v]) {
      rank[b + 1] = rank[b];
      b--;
    }
    rank[b + 1] = v;
  }
  for (let a = 0; a < n; a++) S.phi[a] = (a % 2 ? 1 : -1) * S.x[rank[a]];
}

// A kink sits between two neighbours that have both buckled, more than
// BUCKLED LEDs off the axis, with opposite signs of the order parameter.
const BUCKLED = 0.35;
function kinks(S) {
  const rank = S.rank, phi = S.phi;
  S.kinks.length = 0;
  for (let a = 0; a + 1 < S.n; a++) {
    const pa = phi[a], pb = phi[a + 1];
    if (pa * pb < 0 && abs(pa) > BUCKLED && abs(pb) > BUCKLED) {
      const ya = S.y[rank[a]], yb = S.y[rank[a + 1]];
      S.kinks.push(CY + ya + ((yb - ya) * abs(pa)) / (abs(pa) + abs(pb)));
    }
  }
}

function advance(S, d) {
  // The cycle: straight, quench, zigzag, release.
  S.pt += d;
  if (S.phase === 0 && S.pt >= T_LIN) (S.phase = 1), (S.pt = 0);
  if (S.phase === 1 && S.pt >= S.tq) (S.phase = 2), (S.pt = 0);
  if (S.phase === 2 && S.pt >= T_HOLD) (S.phase = 3), (S.pt = 0);
  if (S.phase === 3 && S.pt >= T_UP) (S.phase = 0), (S.pt = 0);
  S.r = S.phase === 0 ? RHI : S.phase === 1 ? RHI + ((RLO - RHI) * S.pt) / S.tq : S.phase === 2 ? RLO : RLO + ((RHI - RLO) * S.pt) / T_UP;
  const steps = max(1, round((d * RATE) / DT)), h = (d * RATE) / steps;
  for (let k = 0; k < steps; k++) step(S, h);
  order(S);
  kinks(S);
  S.kt += d;
  if (S.kt >= KT) {
    S.kt -= KT;
    S.head = (S.head + 1) % KW;
    const b = S.head * 40;
    S.hn[S.head] = S.n;
    for (let a = 0; a < S.n; a++) {
      S.hy[b + a] = S.y[S.rank[a]] + CY;
      S.hp[b + a] = S.phi[a];
    }
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 30, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const q = cl(kv[1], 0.2, 3);
  S.tq = 10 * 30 ** (-(q - 0.2) / 2.4);
  const n = cl(round(kv[2]), 30, 40);
  const heat = cl(kv[3], 0, 1);
  S.temp = 0.002 + 3 * heat * heat * heat;
  if (n !== S.n) load(S, n);
  if (!S.started) {
    // Run quenches until one has frozen in a kink (four at most), and open
    // 1.2 s into its hold, with the history beside it already full.
    S.started = true;
    for (let tries = 0, f = 0; f < 3000; f++) {
      advance(S, 1 / 30);
      if (S.phase === 2 && S.pt >= 1.2 && S.pt < 1.2 + 1 / 30) {
        if (S.kinks.length || ++tries >= 4) break;
      }
    }
  }
  advance(S, d);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.c) return;
  const rgb = S.rgb, c = S.c, ck = S.ck;
  rgb.fill(0);
  hsv(0.1667 + S.hue, 1, 1, ck);
  // History: the newest column touches the chain's zone and older ones move
  // out. Each ion leaves a rib in its colour, one row high while it is on
  // the axis and two once it has buckled, from blue through violet to
  // magenta or through cyan to green; yellow fills the gap at a kink.
  const inner = 12;
  for (let k = 0; k < KW; k++) {
    const col = ((S.head - k) % KW + KW) % KW, b = col * 40, n = S.hn[col];
    const xl = floor(CX) - inner - k, xr = Math.ceil(CX) + inner + k;
    let prevY = -9, prevP = 0;
    for (let a = 0; a < n; a++) {
      const p = S.hp[b + a], Y = floor(S.hy[b + a]);
      const s = cl((abs(p) - 0.25) / 0.3, 0, 1);
      hsv(S.hue + 0.6667 + (p > 0 ? 0.1667 : -0.3333) * s, 1, 1, c);
      const r = c[0], g = c[1], bl = c[2];
      for (let y = Y; y <= Y + (s > 0.5 ? 1 : 0); y++) {
        if (y < 0 || y >= H) continue;
        for (const X of [xl, xr]) {
          if (X < 0 || X >= W) continue;
          const i = (y * W + X) * 3;
          rgb[i] = r;
          rgb[i + 1] = g;
          rgb[i + 2] = bl;
        }
      }
      if (p * prevP < 0 && abs(p) > BUCKLED && abs(prevP) > BUCKLED)
        for (let y = prevY + 2; y < Y; y++) {
          if (y < 0 || y >= H) continue;
          for (const X of [xl, xr]) {
            if (X < 0 || X >= W) continue;
            const i = (y * W + X) * 3;
            rgb[i] = ck[0];
            rgb[i + 1] = ck[1];
            rgb[i + 2] = ck[2];
          }
        }
      prevY = Y;
      prevP = p;
    }
  }
  // Kink ticks beside the chain.
  for (const yk of S.kinks) {
    const Y = round(yk);
    if (Y < 0 || Y >= H) continue;
    for (let X = floor(CX) - inner + 2; X <= Math.ceil(CX) + inner - 2; X++) {
      if (abs(X - CX) < 8) continue;
      const i = (Y * W + X) * 3;
      rgb[i] = ck[0];
      rgb[i + 1] = ck[1];
      rgb[i + 2] = ck[2];
    }
  }
  // Ions: a disc in their colour, with a pale core.
  for (let a = 0; a < S.n; a++) {
    const i = S.rank[a], p = S.phi[a];
    const px = CX + XS * S.x[i], py = CY + S.y[i];
    const s = cl((abs(p) - 0.25) / 0.3, 0, 1);
    hsv(S.hue + 0.6667 + (p > 0 ? 0.1667 : -0.3333) * s, 1, 1, c);
    const hr = c[0], hg = c[1], hb = c[2];
    for (let Y = max(0, floor(py - 3)); Y <= min(H - 1, Math.ceil(py + 3)); Y++)
      for (let X = max(0, floor(px - 3)); X <= min(W - 1, Math.ceil(px + 3)); X++) {
        const e2 = (X - px) * (X - px) + (Y - py) * (Y - py);
        const halo = cl((exp(-((e2 / 5) ** 3)) - 0.25) / 0.5, 0, 1), core = exp(-e2 / 0.6);
        if (halo <= 0) continue;
        const o = (Y * W + X) * 3;
        rgb[o] = max(rgb[o], hr * halo + (255 - hr) * core * 0.8);
        rgb[o + 1] = max(rgb[o + 1], hg * halo + (255 - hg) * core * 0.8);
        rgb[o + 2] = max(rgb[o + 2], hb * halo + (255 - hb) * core * 0.8);
      }
  }
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const o = (Y * W + X) * 3;
      display.setPixel(X, Y, min(255, rgb[o]) | 0, min(255, rgb[o + 1]) | 0, min(255, rgb[o + 2]) | 0);
    }
}
