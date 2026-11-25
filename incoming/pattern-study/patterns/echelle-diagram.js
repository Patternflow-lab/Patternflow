// ===== Patternflow pattern =====
// Title:   Echelle Diagram
// Family:  asteroseismology
// Idea:    A star rings like a bell, and the panel shows its sound as an echelle diagram: sixteen orders of frequency stacked from the bottom up, each folded at the star's large separation so that the modes of one angular degree line up in three vertical ridges of glowing beads, every bead a damped oscillator that flares when a convective eddy kicks it and fades as it rings down, with the brightest beads near the middle of the stack.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the echelle diagram, frequency against frequency modulo the large separation (Grec, Fossat and Pomerantz, 1983, from memory); the asymptotic relation nu(n,l) = dnu (n + l/2 + eps) - l(l+1) D0 (Tassoul, 1980, from memory); stochastic excitation and damping of solar-like oscillations (Goldreich and Keeley, 1977, from memory); mixed modes that split the l = 1 ridge of red giants into clusters (Beck et al. 2011 and Bedding et al. 2011, Kepler, from memory); the bead model, the slow drift of dnu, eps and nu_max and the drawing are original, pattern round 249
// Round:   249
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Fold=0..4, Evolution=0..1, Drive=-1..1
//
// Knob 1: Hue. Turns the whole colour ramp round the wheel; it opens on magma, near-black indigo through purple and magenta to orange and a pale yellow-white for the brightest flares.
// Knob 2: Fold. 0 to 4, opening at 2: the trial frequency the diagram is folded at. At 2 it equals the star's own large separation and the three ridges stand vertical, swaying a little as the star's dnu drifts; at 0 and 4 the ridges lean about 20 degrees to either side and wrap round the panel edge, and turning toward 2 straightens them again.
// Knob 3: Evolution. 0 to 1, opening at 0: the age of the star. At 0 it is young and every bead on the middle ridge is a clean single mode; as the knob rises the star swells and each of those beads breaks into a cluster of up to seven close, separately twinkling mixed modes, as in a red giant.
// Knob 4: Drive. -1 to 1, opening at about 0.06: how hard convection kicks the modes. At -1 the beads sit dim and the flares are few and brief; at 1 the ridges are bright and crowded, most beads burn orange and the strongest go pale.

const W = 64, H = 128;
const { floor, exp, sqrt, sin, cos, pow, log, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TP = 2 * PI;

const NO = 16;                    // orders, order 0 at the bottom
const ROW0 = 124, DROW = 8;       // screen row of order 0, rows between orders
const SX = 1.5, SY = 2.2;         // bead size in LED (sigma)
const SPACING = 2.6;              // LED between mixed-mode satellites
const SATX = 1.0, SATY = 2.0;    // a satellite is a narrower bead, so that the cluster reads as beads and not one smear
const FLOOR = 0.09;               // the faint glow a quiet bead keeps
const V = [1, 1.5, 0.55];         // visibility of l = 0, 1, 2
const GMIN = 1 / 18, GMAX = 1 / 4;
const P0 = 0.66;                  // where the l = 0 ridge sits across the panel, in turns
const GAIN = 1.15;                 // brightness to ramp position

// ---- state ---------------------------------------------------------------
export function setup(params) {
  const tw = (a, b) => a + (b - a) * random();
  const st = (params.st = {
    k: [0, 2, 0, 0.06], t: 0, spare: null,
    modes: [],
    ph: new Float64Array(10).map(() => tw(0, TP)),
    buf: new Float32Array(W * H),
    gx: new Float32Array(40), gy: new Float32Array(40),
    lut: new Uint8Array(256 * 3), lutHue: -9,
  });
  const gauss = () => gaussian(st);
  // l = 0 and l = 2 modes carry kind 0 and 2; the l = 1 cluster is kind 1 with slot j = -3..3
  for (let n = 0; n < NO; n++) {
    const en = exp(-((n - 8) * (n - 8)) / (2 * 3.6 * 3.6));
    const mk = (kind, j) => {
      const g = cl((GMIN + (GMAX - GMIN) * pow(en, 0.7) * tw(0.55, 1)) * (j !== 0 ? tw(0.7, 1.15) : 1), GMIN, GMAX);
      st.modes.push({
        n, kind, j, g,
        re: gauss() * 0.7071, im: gauss() * 0.7071,
        w: tw(0.75, 1.2),               // fixed strength of this satellite among its brothers
        o: tw(-0.3, 0.3),               // fixed shift in LED
        pw: tw(0, TP), fw: tw(0.011, 0.029),
      });
    };
    mk(0, 0);
    mk(2, 0);
    for (let j = -3; j <= 3; j++) mk(1, j);
  }
  return st;
}

function gaussian(st) {
  if (st.spare !== null) { const s = st.spare; st.spare = null; return s; }
  let u = 0;
  while (u < 1e-9) u = random();
  const r = sqrt(-2 * log(u)), a = TP * random();
  st.spare = r * sin(a);
  return r * cos(a);
}

// ---- time ----------------------------------------------------------------
export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  st.t += dt;
  // each mode is a damped oscillator kicked by noise: the exact step of an Ornstein-Uhlenbeck pair
  const ms = st.modes;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const ed = exp(-m.g * dt), sd = sqrt((1 - ed * ed) * 0.5);
    m.re = m.re * ed + sd * gaussian(st);
    m.im = m.im * ed + sd * gaussian(st);
  }
}

// ---- colour --------------------------------------------------------------
const STOPS = [
  [0.00, 3, 0, 12],
  [0.14, 22, 6, 52],
  [0.30, 70, 25, 120],
  [0.52, 190, 50, 140],
  [0.76, 250, 140, 60],
  [1.00, 255, 240, 190],
];

function buildLut(st, hue) {
  const th = TP * hue, c = cos(th), s = sin(th) * 0.57735;
  const a = c + (1 - c) / 3, b = (1 - c) / 3 - s, d = (1 - c) / 3 + s;
  const lut = st.lut;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < STOPS.length - 2 && t > STOPS[k + 1][0]) k++;
    const A = STOPS[k], B = STOPS[k + 1];
    const f = sstep(0, 1, cl((t - A[0]) / (B[0] - A[0]), 0, 1));
    const r = A[1] + (B[1] - A[1]) * f, g = A[2] + (B[2] - A[2]) * f, bl = A[3] + (B[3] - A[3]) * f;
    // rotation about the grey axis keeps the brightness near where it was
    lut[i * 3] = cl(a * r + b * g + d * bl, 0, 255) | 0;
    lut[i * 3 + 1] = cl(d * r + a * g + b * bl, 0, 255) | 0;
    lut[i * 3 + 2] = cl(b * r + d * g + a * bl, 0, 255) | 0;
  }
  st.lutHue = hue;
}

// ---- drawing -------------------------------------------------------------
// add one soft blob, wrapping round the side edges
function stamp(st, cx, cy, b, sx, sy) {
  const { buf, gx, gy } = st;
  const rx = (3 * sx + 1) | 0, ry = (3 * sy + 1) | 0;
  const x0 = floor(cx) - rx, y0 = floor(cy) - ry;
  const nx = 2 * rx + 2, ny = 2 * ry + 2;
  const ix = -0.5 / (sx * sx), iy = -0.5 / (sy * sy);
  for (let i = 0; i < nx; i++) { const d = x0 + i + 0.5 - cx; gx[i] = exp(d * d * ix); }
  for (let j = 0; j < ny; j++) {
    const py = y0 + j;
    if (py < 0 || py >= H) { gy[j] = 0; continue; }
    const d = py + 0.5 - cy;
    gy[j] = b * exp(d * d * iy);
  }
  for (let j = 0; j < ny; j++) {
    const w = gy[j];
    if (w < 0.002) continue;
    const row = (y0 + j) * W;
    for (let i = 0; i < nx; i++) {
      let px = (x0 + i) % W;
      if (px < 0) px += W;
      buf[row + px] += w * gx[i];
    }
  }
}

function wrapX(c) { return W * (c - floor(c)); }

export function draw(display, params) {
  const st = params.st || setup(params);
  const kn = st.k, t = st.t, ph = st.ph;
  const f = 1 + 0.022 * (cl(kn[1], 0, 4) - 2);              // trial folding frequency, 1 is the true dnu
  const k3 = cl(kn[2], 0, 1), k4 = cl(kn[3], -1, 1);
  const Dm = exp(1.1 * k4 * 1.2 * 0.8);                     // the drive, as it reaches the brightness
  // the star itself: dnu, eps and nu_max drift on clocks that share no period
  const r = 1 + 0.0042 * sin(0.0311 * t + ph[0]) + 0.0027 * sin(0.0113 * t + ph[1]) + 0.0012 * sin(0.0731 * t + ph[2]);
  const u = r / f;
  const g = u - 1;                                         // lean in turns per order
  const eps = P0 + 0.012 * sin(0.0173 * t + ph[3]) + 0.008 * sin(0.0053 * t + ph[4]);
  const nm = 8.2 + 1.3 * sin(0.0229 * t + ph[5]) + 0.8 * sin(0.0071 * t + ph[6]);
  const d02 = 0.11 + 0.008 * sin(0.0137 * t + ph[7]);
  const buf = st.buf;
  buf.fill(0);

  // evolution: the satellites come in pairs as the knob rises
  const gate = [sstep(0.02, 0.36, k3), sstep(0.26, 0.66, k3), sstep(0.52, 0.92, k3)];
  const cent = 1 - 0.22 * k3;

  const ms = st.modes;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i], n = m.n;
    let amp = V[m.kind];
    let cx;
    const zn = (n - 7.5) / 7.5;
    const cy = ROW0 - DROW * n;
    const en = 0.28 + 0.72 * exp(-((n - nm) * (n - nm)) / (2 * 3.8 * 3.8));
    const c0 = eps + (n - 7.5) * g + 0.045 * zn * zn;
    if (m.kind === 0) cx = wrapX(c0);
    else if (m.kind === 2) cx = wrapX(c0 - (d02 + 0.012 * zn) * u);
    else {
      cx = wrapX(c0 + 0.5 * u + 0.015 * zn);
      if (m.j === 0) amp *= cent;
      else {
        const aj = m.j < 0 ? -m.j : m.j;
        const L = 1 / (1 + (aj / 1.5) * (aj / 1.5));
        amp *= 0.7 * gate[aj - 1] * sqrt(L) * m.w;
        cx += m.j * SPACING * (1 + 0.06 * sin(m.fw * t + m.pw)) + m.o;
        cx -= W * floor(cx / W);
      }
    }
    if (amp < 0.01) continue;
    const p = m.re * m.re + m.im * m.im;
    const sat = m.kind === 1 && m.j !== 0;
    stamp(st, cx, cy, amp * en * (FLOOR + Dm * pow(p, 0.6)), sat ? SATX : SX, sat ? SATY : SY);
    // a soft halo under the main beads ties each ridge into a chain
    if (!sat) stamp(st, cx, cy, 0.1 * amp * en, 3.4, 4.4);
  }

  // ridge glow and the granulation haze that peaks round nu_max
  const hz = (0.05 + 0.03 * k4);
  if (st.lutHue !== kn[0]) buildLut(st, kn[0]);
  const lut = st.lut;
  for (let y = 0; y < H; y++) {
    const q = (ROW0 - (y + 0.5)) / DROW;
    const hy = hz * (0.25 + 0.75 * exp(-((q - nm) * (q - nm)) / (2 * 4.2 * 4.2)));
    for (let x = 0; x < W; x++) {
      const hx = 0.75 + 0.25 * sin(TP * (x + 0.5) / W + 0.021 * t + ph[8]);
      const I = buf[y * W + x] + hy * hx;
      const tt = 1 - exp(-GAIN * I);
      const o = ((tt * 255) | 0) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
