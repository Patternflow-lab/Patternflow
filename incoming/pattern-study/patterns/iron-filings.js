// ===== Patternflow pattern =====
// Title:   Iron Filings
// Family:  magnetism
// Idea:    Iron filings sprinkled on a sheet of cream paper over three bar magnets that slowly slide and turn beneath it: every filing is a short dark dash that swings to lie along the field at a finite rate, so the lines of force bend through the dashes with a lag, fan out at the poles, and fall apart into loose grit at the points where two fields cancel.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Michael Faraday's iron-filing pictures of lines of force (1831, Experimental Researches in Electricity, series 28 of 1852 on the lines themselves), the school experiment with a bar magnet under paper, the field of a bar magnet as two point poles, and blue noise from Mitchell's best-candidate sampling (Don Mitchell, 1991); pattern round 208
// Round:   208
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Field=0.5..3, Gap=-1..1, Grain=-1..1
//
// Knob 1: Hue. Tints the paper and turns it round the colour wheel once. It opens on warm cream, goes through rose, lilac, blue and green paper and comes back to cream at 1; the filings stay near-black with a lean toward the opposite tint.
// Knob 2: Field. How hard the magnets pull. At 0.5 most filings lie loose at their own angles and only the ones close to a pole line up, at the opening 2 the lines of force run through nearly the whole sheet and fray only at the neutral points and in the far corners, and at 3 every filing is locked on, thick and dark, and the grit near the poles clumps.
// Knob 3: Gap. How far apart the two poles of each magnet stand, from 12 LEDs at -1, where each bar is a short dipole with closed loops, through 22 at the opening 0, to 42 at 1, where the poles are two separate centres of rays and the lines of force bridge a long way between unlike poles and bend away between like ones.
// Knob 4: Grain. The size and the spacing of the filings. At -1 there are about a thousand fine ones, 3 LEDs apart and 4 long; at the opening 0 about 520, 4 apart; at 1 about 250 coarse ones 6 apart and 7 LEDs long. A finer grain draws the lines of force sharper, a coarser one lets each dash show.

const W = 64;
const H = 128;
const { floor, exp, sin, cos, abs, min, max, sqrt, atan2, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The sprinkled grit lives on a torus a little larger than the panel, so a
// dash cut by the edge has neighbours the way the rest have.
const DX0 = -4;
const DY0 = -4;
const DW = W + 8;
const DH = H + 8;
const NMAX = 1100;
const CAND = 9; // best-candidate tries per point

const HUE0 = 72; // degrees: the cream the paper opens on
const PAPER_L = 0.83;
const PAPER_C = 0.04;
const INK_L = 0.17;
const INK_C = 0.03;

// Three bar magnets: centre of a Lissajous path, its half-widths, two
// frequencies that share no factor, a turning rate and a rocking of the
// angle, and a strength. All frequencies are rad/s of panel time.
const MAG = [
  { cx: 31, cy: 36, ax: 17, ay: 22, bx: 10, by: 13, wx: 0.137, wy: 0.083, vx: 0.047, vy: 0.031, p0: 0.4, p1: 2.1, p2: 1.3, p3: 5.0, a0: 1.1, wr: 0.152, wa: 0.071, pa: 0.7, q: 1.0, wq: 0.061, pq: 0.8, len: 1.0 },
  { cx: 33, cy: 93, ax: 18, ay: 22, bx: 10, by: 13, wx: 0.103, wy: 0.121, vx: 0.037, vy: 0.053, p0: 3.3, p1: 0.9, p2: 4.4, p3: 2.2, a0: 4.0, wr: -0.118, wa: 0.089, pa: 2.4, q: 0.9, wq: 0.083, pq: 3.9, len: 0.86 },
  { cx: 32, cy: 64, ax: 20, ay: 28, bx: 9, by: 12, wx: 0.159, wy: 0.067, vx: 0.029, vy: 0.043, p0: 5.1, p1: 4.2, p2: 0.2, p3: 3.4, a0: 2.3, wr: 0.093, wa: 0.113, pa: 4.9, q: 0.72, wq: 0.047, pq: 5.6, len: 1.14 },
];
const TS = 1.3; // how fast the magnets go, against their own frequencies
const T0 = 206; // where on its paths each magnet stands at 0 s
const PREROLL = 9; // seconds of lag already played when the picture opens
const SPARSE = 0.12; // share of the grit that lies on the paper where the field is nothing
const LAMP = 0.12; // how much brighter the paper is under the lamp
const EPS = 2.6; // a pole's softening radius in LEDs
const GAIN = 30; // field to a unit that is 1 at about 12 LEDs from a pole at Field 1
const RMIN = 0.28; // turning rates, 1/s: far from a pole, and next to one
const RMAX = 2.6;
const WMAX = 2.4; // no filing turns faster than this, rad/s

function oklch(L, C, hDeg, out) {
  const h = (hDeg * PI) / 180;
  const a = C * cos(h);
  const b = C * sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  for (let i = 0; i < 3; i++) {
    const v = cl(lin[i], 0, 1);
    out[i] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  }
}

// Blue noise by Mitchell's best candidate: each new point is the farthest
// from the points before it of a few random tries, so the first N points are
// an even scatter for every N, and the Grain knob can take any prefix.
function sprinkle(S) {
  const xs = new Float32Array(NMAX);
  const ys = new Float32Array(NMAX);
  for (let i = 0; i < NMAX; i++) {
    let bx = 0;
    let by = 0;
    let bd = -1;
    for (let c = 0; c < (i === 0 ? 1 : CAND); c++) {
      const x = Math.random() * DW;
      const y = Math.random() * DH;
      let d = 1e9;
      for (let j = 0; j < i; j++) {
        let dx = abs(x - xs[j]);
        let dy = abs(y - ys[j]);
        if (dx > DW / 2) dx = DW - dx;
        if (dy > DH / 2) dy = DH - dy;
        const q = dx * dx + dy * dy;
        if (q < d) d = q;
      }
      if (d > bd) {
        bd = d;
        bx = x;
        by = y;
      }
    }
    xs[i] = bx;
    ys[i] = by;
  }
  S.x = new Float32Array(NMAX);
  S.y = new Float32Array(NMAX);
  for (let i = 0; i < NMAX; i++) {
    S.x[i] = xs[i] + DX0;
    S.y[i] = ys[i] + DY0;
  }
  S.phi = new Float32Array(NMAX); // where each filing lies now
  S.rho = new Float32Array(NMAX); // where it lies when no field holds it
  S.nud = new Float32Array(NMAX); // its own habit of sliding along its axis
  S.thr = new Float32Array(NMAX); // how strong a field it takes to bring it onto the paper at all
  S.w = new Float32Array(NMAX); // how firmly the field holds it, 0..1
  for (let i = 0; i < NMAX; i++) {
    S.rho[i] = (Math.random() - 0.5) * PI;
    S.phi[i] = Math.random() * PI;
    S.nud[i] = Math.random() * 2 - 1;
    S.thr[i] = Math.random();
  }
}

// The bar magnets at panel time T: for each, the two poles and their sign.
function poles(S, T) {
  const L = 22 * Math.pow(1.9, S.gap);
  let n = 0;
  for (let k = 0; k < MAG.length; k++) {
    const m = MAG[k];
    const t = (T + T0) * TS;
    const cx = m.cx + m.ax * sin(m.wx * t + m.p0) + m.bx * sin(m.vx * t + m.p2);
    const cy = m.cy + m.ay * sin(m.wy * t + m.p1) + m.by * sin(m.vy * t + m.p3);
    const th = m.a0 + m.wr * t + 0.9 * sin(m.wa * t + m.pa);
    const h = 0.5 * L * m.len;
    const ux = cos(th) * h;
    const uy = sin(th) * h;
    const P = S.P;
    const q = m.q * (0.78 + 0.22 * sin(m.wq * t + m.pq));
    P[n++] = cx + ux;
    P[n++] = cy + uy;
    P[n++] = q;
    P[n++] = cx - ux;
    P[n++] = cy - uy;
    P[n++] = -q;
    S.bar[k * 5] = cx;
    S.bar[k * 5 + 1] = cy;
    S.bar[k * 5 + 2] = ux;
    S.bar[k * 5 + 3] = uy;
    S.bar[k * 5 + 4] = h;
  }
}

function step(S, dt) {
  S.T += dt;
  poles(S, S.T);
  const P = S.P;
  const np = P.length / 3;
  const f = S.field;
  for (let i = 0; i < NMAX; i++) {
    const x = S.x[i];
    const y = S.y[i];
    let bx = 0;
    let by = 0;
    for (let p = 0; p < np; p++) {
      const dx = x - P[p * 3];
      const dy = y - P[p * 3 + 1];
      const r2 = dx * dx + dy * dy + EPS * EPS;
      const q = P[p * 3 + 2] / Math.pow(r2, 1.25);
      bx += dx * q;
      by += dy * q;
    }
    const u = sqrt(bx * bx + by * by) * GAIN * f;
    // how firmly the field holds this filing: it lies along the field
    // plus its own stray angle, and the stray angle shrinks as the field
    // grows, from a quarter turn either way to nothing
    const w = u / (u + 1);
    S.w[i] = w;
    const target = atan2(by, bx) + S.rho[i] * Math.pow(1 - w, 1.3);
    let d = target - S.phi[i];
    d -= PI * round(d / PI);
    const rate = RMIN + RMAX * w;
    let s = d * (1 - exp(-rate * dt));
    const lim = WMAX * dt;
    if (S.snap) s = d;
    else if (s > lim) s = lim;
    else if (s < -lim) s = -lim;
    S.phi[i] += s;
  }
}

export function setup(params) {
  const S = { hue: 0, field: 2, gap: 0, grain: 0.06, T: -PREROLL, rolled: false };
  S.P = new Float32Array(MAG.length * 6);
  S.bar = new Float32Array(MAG.length * 5);
  S.paper = new Float32Array(3);
  S.ink = new Float32Array(3);
  S.buf = new Float32Array(W * H * 3);
  sprinkle(S);
  params.s = S;
}

function knobs(S, kn) {
  S.hue = cl(kn[0], 0, 1);
  S.field = cl(kn[1], 0.5, 3);
  S.gap = cl(kn[2], -1, 1);
  S.grain = cl(kn[3], -1, 1);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  knobs(S, input.knobValues || [0, 2, 0, 0.06]);
  if (!S.rolled) {
    S.rolled = true;
    // Play the lag before the first frame so the sheet opens already
    // formed: every filing starts where the field wants it, then the
    // magnets run PREROLL seconds with the knobs as they are.
    S.T = -PREROLL;
    S.snap = true;
    step(S, 0);
    S.snap = false;
    for (let k = 0; k < PREROLL * 30; k++) step(S, 1 / 30);
  }
  step(S, cl(dt || 0, 0, 0.1));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  // paper and ink
  const hdeg = HUE0 + 360 * S.hue;
  oklch(PAPER_L, PAPER_C, hdeg, S.paper);
  oklch(INK_L, INK_C, hdeg + 190, S.ink);
  const pr = S.paper[0];
  const pg = S.paper[1];
  const pb = S.paper[2];
  const buf = S.buf;
  const bar = S.bar;
  // a lamp over the sheet that wanders very slowly: a broad pool of light
  const tl = (S.T + T0) * 0.7;
  const lx = 32 + 34 * sin(0.083 * tl + 1.7) + 12 * sin(0.151 * tl);
  const ly = 64 + 66 * sin(0.057 * tl + 0.3) + 20 * sin(0.113 * tl + 2.6);
  const lw = 1 / (2 * 46 * 46);
  const nm = MAG.length;
  // The paper: a soft vignette, and a very faint raised look where a bar
  // lies under it, lit from the top left.
  for (let y = 0; y < H; y++) {
    const ey = (y + 0.5 - H / 2) / (H / 2);
    for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - W / 2) / (W / 2);
      const lxd = x + 0.5 - lx;
      const lyd = y + 0.5 - ly;
      let g = 0.93 - 0.05 * (0.5 * ex * ex + 0.5 * ey * ey) + LAMP * exp(-(lxd * lxd + lyd * lyd) * lw);
      const px = x + 0.5;
      const py = y + 0.5;
      let em = 0;
      for (let k = 0; k < nm; k++) {
        const cx = bar[k * 5];
        const cy = bar[k * 5 + 1];
        const ux = bar[k * 5 + 2];
        const uy = bar[k * 5 + 3];
        const h = bar[k * 5 + 4];
        const rx = px - cx;
        const ry = py - cy;
        let t = h > 0 ? (rx * ux + ry * uy) / (h * h) : 0;
        t = cl(t, -1, 1);
        const nx = px - (cx + ux * t);
        const ny = py - (cy + uy * t);
        const d = sqrt(nx * nx + ny * ny) + 1e-6;
        const e = exp(-(d * d) / 40);
        // slope of the bump along the light: -d e / d d times the unit normal
        const slope = (e * 2 * d) / 40;
        em += slope * ((nx / d) * 0.55 + (ny / d) * 0.83);
      }
      g += 0.3 * em;
      const i = (y * W + x) * 3;
      buf[i] = pr * g;
      buf[i + 1] = pg * g;
      buf[i + 2] = pb * g;
    }
  }
  // The grit. Spacing d, from 3 LEDs at Grain -1 to 6 at 1.
  const d = 4.15 * Math.pow(1.43, S.grain);
  const N = min(NMAX, (DW * DH) / (0.92 * d * d));
  const len0 = 1.04 * d;
  const r0 = 0.2 * d;
  const ir = S.ink[0];
  const ig = S.ink[1];
  const ib = S.ink[2];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < NMAX && i < N + 1; i++) {
      let act = cl(N - i, 0, 1);
      if (act <= 0) continue;
      const w = S.w[i];
      // far from every pole the grit is sparse, near one it is crowded
      act *= sm((SPARSE + (1 - SPARSE) * min(1, w * 1.5) - S.thr[i]) * 10 + 0.5);
      if (act <= 0) continue;
      const ph = S.phi[i];
      const c = cos(ph);
      const s = sin(ph);
      const len = len0 * (0.92 + 0.24 * w);
      const r = r0 * (0.95 + 0.15 * w);
      const slide = S.nud[i] * 0.3 * d * w * w;
      let cxp = S.x[i] + c * slide;
      let cyp = S.y[i] + s * slide;
      let alpha = (0.78 + 0.22 * w) * act;
      let rad = r;
      if (pass === 0) {
        cxp += 0.7;
        cyp += 0.9;
        rad = r + 0.3;
        alpha *= 0.2;
      }
      const hl = max(0, len * 0.5 - rad);
      const reach = len * 0.5 + 1.6;
      const x0 = max(0, floor(cxp - reach));
      const x1 = min(W - 1, floor(cxp + reach));
      const y0 = max(0, floor(cyp - reach));
      const y1 = min(H - 1, floor(cyp + reach));
      // the side that faces the light
      const nl = -s * -0.55 + c * -0.83;
      const nsg = nl >= 0 ? 1 : -1;
      const nla = abs(nl);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const rx = x + 0.5 - cxp;
          const ry = y + 0.5 - cyp;
          const a = rx * c + ry * s;
          const v = -rx * s + ry * c;
          const da = max(abs(a) - hl, 0);
          const dist = sqrt(da * da + v * v);
          const cov = cl(rad + 0.55 - dist, 0, 1);
          if (cov <= 0) continue;
          const o = (y * W + x) * 3;
          const k = cov * alpha;
          if (pass === 0) {
            const m = 1 - 0.55 * k;
            buf[o] *= m;
            buf[o + 1] *= m;
            buf[o + 2] *= m;
          } else {
            // a little steel on the lit edge of the dash
            const sh = cl((v * nsg) / rad, 0, 1) * nla * 0.55;
            const cr = ir + (150 - ir) * sh;
            const cg = ig + (160 - ig) * sh;
            const cb = ib + (178 - ib) * sh;
            buf[o] += (cr - buf[o]) * k;
            buf[o + 1] += (cg - buf[o + 1]) * k;
            buf[o + 2] += (cb - buf[o + 2]) * k;
          }
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      display.setPixel(x, y, cl(buf[i], 0, 255), cl(buf[i + 1], 0, 255), cl(buf[i + 2], 0, 255));
    }
  }
}
