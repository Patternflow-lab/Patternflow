// ===== Patternflow pattern =====
// Title:   Hofstadter Butterfly
// Family:  fractal
// Idea:    The energy spectrum of an electron on a square lattice in a magnetic field, energy across and flux per cell up from 0 to 1, with every gap coloured by its Hall integer t and lines of equal electron density sliding up the wings where t is positive and down where it is negative.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hofstadter's butterfly (Douglas Hofstadter, 1976), coloured by the gap labels of Thouless, Kohmoto, Nightingale and den Nijs (1982), pattern round 30
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=16..64, Coupling=-1..1
//
// Knob 1: Hue. Turns every gap colour round the wheel together. At 0 the gaps with t = +1 are cyan and t = -1 magenta; each step up in |t| moves the plus side towards green and the minus side towards blue, and dims it, down to a third from |t| = 12 on.
// Knob 2: Speed. At 2 a line of equal density climbs a t = +1 wing 16 rows a second (eight in a t = +2 gap, and so on), and the bands breathe through one turn of the phase in 3.1 seconds; at 0.2 both run ten times slower.
// Knob 3: Depth. The largest denominator q. Each row's flux is replaced by the nearest fraction p/q with q up to Depth, and the row shows that fraction's spectrum exactly. At 16 four rows share 1/2, the four at each end share 0 and 1 and show one wide band, and the fans above and below are coarse; at 64 two rows share 1/2 and the fans fill in.
// Knob 4: Coupling. lambda = 2^K4, the potential against the hopping, held at exactly 1 (the classic butterfly) within 0.08 of the middle. At -1 (lambda 1/2) the bands open into white sheets a third of the width; at +1 (lambda 2) the same sheets come back grey with one narrow lit sliver each, because Aubry-Andre duality sends lambda to 1/lambda and the energy axis, scaled by 2 + 2 lambda, puts every gap back where it was.
// Buttons: K1 tap fades the colours out for six seconds and leaves Hofstadter's own picture of 1976: the spectrum alone, white on black.

const W = 64, H = 128, S = 6, NS = W * S;
const { floor, round, cos, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const BAND = 127, TM = 40;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

// The nearest fraction p/q to a with q at most Q; on a tie the smaller q, so
// p/q comes out in lowest terms.
function nearest(a, Q) {
  let bp = 0, bq = 1, bd = 9;
  for (let q = 1; q <= Q; q++) {
    const p = round(a * q), d = abs(a - p / q);
    if (d < bd - 1e-12) (bd = d), (bp = p), (bq = q);
  }
  return [bp, bq];
}

// Harper's equation, psi(n+1) + psi(n-1) + 2 lambda cos(2 pi alpha n + nu)
// psi(n) = E psi(n), at alpha = p/q. Row y has flux (127 - y) / 127, so 0 at
// the bottom and 1 at the top; column x has energy across -(2 + 2 lambda) to
// 2 + 2 lambda, six samples to an LED.
//
// For each sample: the trace D of the product of the q transfer matrices
// [[E - V(n), -1], [1, 0]], taken at nu = pi / 2q. Chambers' relation says the
// trace at any other nu is D - 2 lambda^q cos(q nu), so E is in the spectrum
// at phase nu where |D - 2 lambda^q cos(q nu)| <= 2, and at some phase where
// |D| <= 2 + 2 lambda^q. Both are checked against the one cached D, so the
// phase turns every frame for nothing.
//
// In a gap, r bands lie below E. r comes from a Sturm count: the negative
// pivots of the chain cut off at 3q sites count its levels below E, which are
// 3r give or take one. The gap labelling theorem puts the density there at
// N = r / q = s + t p / q with whole s and t, so r = t p mod q, and t is r times
// the inverse of p mod q, taken between -q/2 and q/2. t is the Hall
// conductance of a filled gap in units of e^2/h. t = 0 only below and above
// the whole spectrum.
const V = new Float64Array(128);
function buildRow(P, y) {
  const a = (H - 1 - y) / (H - 1), [p, q] = nearest(a, P.Q), lam = P.lam;
  if (P.rp[y] === p && P.rq[y] === q && P.rlam[y] === lam) return 0;
  (P.rp[y] = p), (P.rq[y] = q), (P.rlam[y] = lam);
  const Em = 2 + 2 * lam, lq = lam ** q, lim = 2 + 2 * lq;
  let pin = 1;
  while ((p * pin) % q !== 1 % q) pin++;
  for (let n = 0; n < q; n++) V[n] = 2 * lam * cos((2 * PI * p * (n + 1)) / q + PI / (2 * q));
  P.rl[y] = 2 * lq;
  const o = y * NS;
  for (let j = 0; j < NS; j++) {
    const E = -Em + ((j + 0.5) * 2 * Em) / NS;
    let a0 = 1, b0 = 0, c0 = 0, d0 = 1;
    for (let n = 0; n < q; n++) {
      const v = E - V[n], na = v * a0 - c0, nb = v * b0 - d0;
      (c0 = a0), (d0 = b0), (a0 = na), (b0 = nb);
    }
    const D = a0 + d0;
    P.D[o + j] = D;
    if (abs(D) <= lim) {
      (P.T[o + j] = BAND), (P.R[o + j] = 255);
      continue;
    }
    let cnt = 0, dp = 1e300;
    for (let k = 0; k < 3; k++)
      for (let n = 0; n < q; n++) {
        let dd = V[n] - E - 1 / dp;
        if (dd === 0) dd = 1e-300;
        if (dd < 0) cnt++;
        dp = dd;
      }
    const r = round(cnt / 3);
    let t = (r * pin) % q;
    if (t > q / 2) t -= q;
    P.T[o + j] = r === 0 || r === q ? 0 : t;
    P.R[o + j] = r;
  }
  return 1;
}

export function setup(params) {
  params.s = {
    D: new Float64Array(H * NS), T: new Int8Array(H * NS), R: new Uint8Array(H * NS),
    rp: new Int32Array(H).fill(-1), rq: new Int32Array(H), rlam: new Float64Array(H), rl: new Float64Array(H),
    Q: -1, lam: -1, next: H, phi: 0, wave: 0, hue: NaN, bw: 0, hold: 0,
    pal: new Float32Array((2 * TM + 1) * 3), M: new Float32Array(2 * TM + 1),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 16, 0.06], d = cl(dt || 0, 0, 0.1);
  const Q = round(cl(k[2], 16, 64)), K4 = cl(k[3], -1, 1);
  const lam = abs(K4) < 0.08 ? 1 : 2 ** (round(K4 * 50) / 50);
  // The first frame builds all 128 rows (9 ms at Depth 16, 40 at 64). After a
  // turn of K3 or K4 the rows are built again from the bottom, about 512
  // periods' worth a frame, so a full redraw takes half a second; a row whose
  // fraction and lambda did not change is kept.
  const first = P.Q < 0;
  if (Q !== P.Q || lam !== P.lam) (P.Q = Q), (P.lam = lam), (P.next = 0);
  for (let budget = first ? 1e9 : 512; budget > 0 && P.next < H; ) budget -= buildRow(P, H - 1 - P.next++) * P.Q;
  const sp = cl(k[1], 0.2, 3);
  P.phi += d * sp;
  P.wave += d * sp * 0.125;
  if (input.btnPressed && input.btnPressed[0]) P.hold = 6;
  P.hold = max(0, P.hold - d);
  P.bw = cl(P.bw + (P.hold > 0 ? d : -d) * 1.5, 0, 1);
  if (P.hue !== k[0]) {
    P.hue = k[0];
    for (let t = -TM; t <= TM; t++) {
      const o = (t + TM) * 3, at = abs(t);
      if (t === 0) (P.pal[o] = 0), (P.pal[o + 1] = 0), (P.pal[o + 2] = 0);
      else hsv(k[0] + (t > 0 ? 0.5 : 0.85) - 0.05 * min(at - 1, 4), 0.82, max(0.32, 1 / (1 + 0.2 * (at - 1))), P.pal, o);
    }
  }
}

// In a gap with label t, the density N = s + t alpha climbs t whole units from
// the bottom of the panel to the top (Streda's formula: dN / d alpha = t).
// Each gap is lit by cos(2 pi (2 N - w)), which needs only t alpha because s is
// whole: as w grows, the lines of equal N rise through a gap at 1 / t of the
// pace of the t = 1 wings, and sink where t is negative.
const WK = 2;
export function draw(display, params) {
  const P = params.s;
  if (!P || P.Q < 0) return;
  const pal = P.pal, M = P.M, bw = P.bw, cw = 1 - bw;
  for (let y = 0; y < H; y++) {
    const c = P.rl[y] * cos(P.phi), o = y * NS, al = (H - 1 - y) / (H - 1);
    for (let t = -TM; t <= TM; t++) M[t + TM] = cw * (0.7 + 0.3 * cos(2 * PI * (WK * t * al - P.wave)));
    let prev = P.R[o];
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, miss = 0;
      for (let j = x * S; j < x * S + S; j++) {
        const t = P.T[o + j], rr = P.R[o + j];
        if (t === BAND) {
          // White where the band is at the present phase, grey where it is at
          // some other phase. In the 0, 1/2 and 1 rows the white slides across.
          const w = abs(P.D[o + j] - c) <= 2 ? 255 : 110;
          (r += w), (g += w), (b += w);
        } else {
          // r changed between two gap samples: bands thinner than a sample lie
          // between them, and their count lights the LED.
          if (prev !== 255 && rr !== prev) miss += abs(rr - prev);
          const q = (t + TM) * 3, f = M[t + TM];
          (r += pal[q] * f), (g += pal[q + 1] * f), (b += pal[q + 2] * f);
        }
        prev = rr;
      }
      const wm = min(1, miss * (0.2 + 0.5 * bw));
      (r /= S), (g /= S), (b /= S);
      display.setPixel(x, y, r + (210 - r) * wm, g + (210 - g) * wm, b + (210 - b) * wm);
    }
  }
}
