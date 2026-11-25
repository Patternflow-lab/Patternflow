// ===== Patternflow pattern =====
// Title:   Normal Modes
// Family:  normalmodes
// Idea:    A flat skeleton of 52 atoms of two kinds, fused hexagonal rings joined by springs, vibrates in its own normal modes, the eigenvectors of the mass-weighted spring matrix, so a few modes sound at once at frequencies that never line up while every bond shades from blue where it is squeezed to gold where it is stretched, every atom lights as it moves, and turning the mode number slides the nodal lines across the skeleton from a mode that rocks one end to one that breathes through the whole body.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: harmonic normal-mode analysis of a molecule, the eigenproblem of the mass-weighted Hessian (Max Born and Theodore von Karman's lattice dynamics, 1912; Edgar Bright Wilson's GF method for molecular vibrations, about 1939), solved here by the cyclic Jacobi eigenvalue method (Carl Jacobi, 1846), all from memory; the ring patch with two rings left out, the bond springs with next-neighbour bending springs, the mass-1.6 second atom, the strain colouring, the equal-power cross-fade of the leading mode between two whole numbers and the window of companions with their own slow envelopes are original, pattern round 251
// Round:   251
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Amp=0.3..3, Mode=1..40, Mix=-1..1
//
// Knob 1: Hue. Turns every bond and atom colour round the wheel together; it opens on blue for squeezed bonds and gold for stretched ones.
// Knob 2: Amp. 0.3 to 3, opening at 2. How far the skeleton swings: at 0.3 a bond changes length by a few percent and an atom moves under half an LED, at 3 the stiff modes stretch a bond by a third and the soft ones swing an atom 4 to 5 LED.
// Knob 3: Mode. 1 to 40, opening at 1. Which normal mode leads, counted up from the lowest frequency; between two whole numbers the two modes are blended, so the nodal lines slide instead of jumping.
// Knob 4: Mix. -1 to 1, opening at about 0.06. How many other modes ring beside the leading one: at -1 the leader stands almost alone, at 1 about ten share the skeleton and take turns to swell.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, hypot, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v, d) => (Number.isFinite(v) ? v : d);

const ROWS = 7;               // rows of rings, three and two rings in turn, the short rows half a ring across
const PADY = 7.5;             // margin above the top atom and below the bottom one
const K_ANGLE = 0.35;         // spring between the two neighbours of an atom, relative to a bond
const M_HETERO = 1.6;         // mass of the second kind of atom
const F1 = 0.34;              // Hz of the lowest mode
const FPOW = 0.8;             // frequency = F1 * (omega / omega1)^FPOW, so the top of the range is not a blur
const NMODE_MAX = 40;         // top of the Mode knob
const WIN = 20;               // companions considered either side of the leading mode
const S1 = 0.12;              // bond strain per unit of Amp in a single mode
const U1 = 1.7;               // LED an atom swings at most per unit of Amp in a single mode
const DCAP = 4.6;             // LED, the largest swing an atom gets when modes pile up
const GLOW_R = 15;            // LED, reach of the bloom round a moving atom
const GLOW_A = 0.2;           // its brightness at full speed
const NCLOUD = 5;             // faint clouds of light that drift behind the skeleton
const CLOUD_R = 30;           // LED, radius of each
const MIX0 = 0.12;            // the Mix knob's lowest setting still lets this much of the companions through
const CLOUD_V = 0.09;         // its brightness at the middle
const TAU_K = 0.08;           // seconds, knob smoothing
const TAU_TRAIL = 0.13;       // seconds, the ghost of the last frames

// ---- colour ---------------------------------------------------------------
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the skeleton -----------------------------------------------------------
function buildGraph() {
  const S3 = sqrt(3) / 2;
  const L = min((H - 2 * PADY) / (1.5 * ROWS + 0.5), 12);
  const atoms = [], key = new Map(), edge = new Set();
  const add = (x, y) => {
    const k = Math.round(x * 8) + "," + Math.round(y * 8);
    if (!key.has(k)) { key.set(k, atoms.length); atoms.push([x, y]); }
    return key.get(k);
  };
  const skip = { "2:2": 1, "4:0": 1 };      // two rings left out, so the patch is not mirror-symmetric
  const ring = [[0, -1], [S3, -0.5], [S3, 0.5], [0, 1], [-S3, 0.5], [-S3, -0.5]];
  for (let r = 0; r < ROWS; r++) {
    const n = r % 2 === 0 ? 3 : 2;
    for (let c = 0; c < n; c++) {
      if (skip[r + ":" + c]) continue;
      const cx = (r % 2 === 0 ? 2 * c : 2 * c + 1) * S3 * L, cy = (1 + 1.5 * r) * L;
      const v = ring.map((p) => add(cx + p[0] * L, cy + p[1] * L));
      for (let i = 0; i < 6; i++) { const a = v[i], b = v[(i + 1) % 6]; edge.add(min(a, b) * 1000 + max(a, b)); }
    }
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const a of atoms) { x0 = min(x0, a[0]); x1 = max(x1, a[0]); y0 = min(y0, a[1]); y1 = max(y1, a[1]); }
  for (const a of atoms) { a[0] += W / 2 - (x0 + x1) / 2; a[1] += H / 2 - (y0 + y1) / 2; }
  const bonds = [...edge].map((e) => [floor(e / 1000), e % 1000]);
  return { atoms, bonds, L, x0, x1, y0, y1 };
}

// cyclic Jacobi eigen-decomposition of a symmetric matrix A (n x n, row-major); returns V, eigenvalues stay on A's diagonal
function jacobi(A, n) {
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < 40; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i * n + j] * A[i * n + j];
    if (off < 1e-20) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        if (abs(apq) < 1e-15) continue;
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (abs(th) + sqrt(th * th + 1));
        const c = 1 / sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const kp = k * n + p, kq = k * n + q, a = A[kp], b = A[kq];
          A[kp] = c * a - s * b; A[kq] = s * a + c * b;
        }
        const rp = p * n, rq = q * n;
        for (let k = 0; k < n; k++) {
          const a = A[rp + k], b = A[rq + k];
          A[rp + k] = c * a - s * b; A[rq + k] = s * a + c * b;
        }
        for (let k = 0; k < n; k++) {
          const kp = k * n + p, kq = k * n + q, a = V[kp], b = V[kq];
          V[kp] = c * a - s * b; V[kq] = s * a + c * b;
        }
      }
    }
  }
  return V;
}

export function setup(params) {
  const g = buildGraph();
  const NA = g.atoms.length, NB = g.bonds.length, n = 2 * NA;
  const X0 = new Float64Array(NA), Y0 = new Float64Array(NA);
  for (let i = 0; i < NA; i++) { X0[i] = g.atoms[i][0]; Y0[i] = g.atoms[i][1]; }

  // heteroatoms: the atom nearest each of six places spread over the patch
  const mass = new Float64Array(NA).fill(1), typ = new Uint8Array(NA);
  const spots = [[0.3, 0.08], [0.78, 0.25], [0.2, 0.43], [0.62, 0.57], [0.86, 0.78], [0.38, 0.92]];
  let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
  for (let i = 0; i < NA; i++) { bx0 = min(bx0, X0[i]); bx1 = max(bx1, X0[i]); by0 = min(by0, Y0[i]); by1 = max(by1, Y0[i]); }
  for (const sp of spots) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < NA; i++) {
      if (typ[i]) continue;
      const d = hypot((X0[i] - bx0) / (bx1 - bx0) - sp[0], (Y0[i] - by0) / (by1 - by0) - sp[1]);
      if (d < bd) { bd = d; best = i; }
    }
    typ[best] = 1; mass[best] = M_HETERO;
  }

  // dynamical matrix: a unit spring along every bond, a K_ANGLE spring between the two neighbours of each atom
  const adj = Array.from({ length: NA }, () => []);
  for (const b of g.bonds) { adj[b[0]].push(b[1]); adj[b[1]].push(b[0]); }
  const D = new Float64Array(n * n);
  const spring = (a, b, k) => {
    const dx = X0[b] - X0[a], dy = Y0[b] - Y0[a], l = hypot(dx, dy), ux = dx / l, uy = dy / l;
    const q = [ux * ux, ux * uy, uy * ux, uy * uy];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const v = k * q[i * 2 + j];
      D[(2 * a + i) * n + 2 * a + j] += v; D[(2 * b + i) * n + 2 * b + j] += v;
      D[(2 * a + i) * n + 2 * b + j] -= v; D[(2 * b + i) * n + 2 * a + j] -= v;
    }
  };
  for (const b of g.bonds) spring(b[0], b[1], 1);
  for (let c = 0; c < NA; c++) for (let i = 0; i < adj[c].length; i++) for (let j = i + 1; j < adj[c].length; j++) spring(adj[c][i], adj[c][j], K_ANGLE);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i * n + j] /= sqrt(mass[i >> 1] * mass[j >> 1]);
  const V = jacobi(D, n);

  // the modes, lowest first, with the three rigid motions (two shifts and a turn) dropped
  const ord = [];
  for (let i = 0; i < n; i++) ord.push(i);
  ord.sort((a, b) => D[a * n + a] - D[b * n + b]);
  const lmax = D[ord[n - 1] * n + ord[n - 1]];
  const first = ord.findIndex((i) => D[i * n + i] > 1e-7 * lmax);
  const om = [], Us = [], Sb = [];
  const bl = g.bonds.map((b) => hypot(X0[b[1]] - X0[b[0]], Y0[b[1]] - Y0[b[0]]));
  const bux = g.bonds.map((b, k) => (X0[b[1]] - X0[b[0]]) / bl[k]), buy = g.bonds.map((b, k) => (Y0[b[1]] - Y0[b[0]]) / bl[k]);
  let om1 = 1;
  for (let m = first; m < n; m++) {
    const col = ord[m], w = sqrt(max(D[col * n + col], 0));
    if (m === first) om1 = w;
    const u = new Float32Array(n);
    for (let j = 0; j < n; j++) u[j] = V[j * n + col] / sqrt(mass[j >> 1]);
    // scale so that, with Amp 1, the most strained bond swings 12 percent of its length or the farthest atom
    // swings U1 LED, whichever comes first (the soft low modes run out of panel before they run out of strain)
    const sb = new Float32Array(NB);
    let sm = 1e-9, dm = 1e-9;
    for (let k = 0; k < NB; k++) {
      const a = g.bonds[k][0], b = g.bonds[k][1];
      sb[k] = ((u[2 * b] - u[2 * a]) * bux[k] + (u[2 * b + 1] - u[2 * a + 1]) * buy[k]) / bl[k];
      sm = max(sm, abs(sb[k]));
    }
    for (let i = 0; i < NA; i++) dm = max(dm, hypot(u[2 * i], u[2 * i + 1]));
    const f = min(S1 / sm, U1 / dm);
    for (let j = 0; j < n; j++) u[j] *= f;
    for (let k = 0; k < NB; k++) sb[k] *= f;
    om.push(TP * F1 * Math.pow(w / om1, FPOW));
    Us.push(u); Sb.push(sb);
  }
  const nm = om.length;
  const rnd = (() => { let s = 20251125; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; })();
  const th = new Float64Array(nm), ea = new Float64Array(nm), eb = new Float64Array(nm), ra = new Float64Array(nm), rb = new Float64Array(nm);
  for (let m = 0; m < nm; m++) {
    th[m] = rnd() * TP; ea[m] = rnd() * TP; eb[m] = rnd() * TP;
    ra[m] = TP * (0.034 + 0.05 * rnd()); rb[m] = TP * (0.016 + 0.034 * rnd());
  }

  // static background, a deep navy that is a little brighter low on the panel and round the middle
  const bgv = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = (x - 31.5) / 32, gy = (y - 63.5) / 64;
    bgv[y * W + x] = 0.5 + 0.5 * (0.34 * gy + 0.3 * exp(-(gx * gx * 1.4 + gy * gy * 0.7) * 2.2) - 0.08 * gx);
  }

  const bp = new Float64Array(4 * NCLOUD);
  for (let q = 0; q < 4 * NCLOUD; q++) bp[q] = rnd() * TP;
  const st = (params.st = {
    k: [0, 2, 1, 0.06], ks: [0, 2, 1, 0.06], init: false,
    NA, NB, n, nm, g, X0, Y0, mass, typ, bonds: g.bonds, bl, om, Us, Sb, th, ea, eb, ra, rb, bgv,
    w: new Float64Array(nm), act: [],
    px: new Float64Array(NA), py: new Float64Array(NA), vx: new Float64Array(NA), vy: new Float64Array(NA), en: new Float64Array(NA), ve: new Float64Array(NA),
    dx: new Float64Array(NA), dy: new Float64Array(NA), be: new Float64Array(NB),
    bp, cur: new Float32Array(N * 3), gl: new Float32Array(N * 3), fb: new Float32Array(N * 3), out: new Float32Array(N * 3),
    cap: 1,
  });
  return st;
}

// ---- drawing ------------------------------------------------------------------
function bond(cur, ax, ay, bx, by, col, hw) {
  const x0 = max(0, floor(min(ax, bx) - hw - 1)), x1 = min(W - 1, floor(max(ax, bx) + hw + 1));
  const y0 = max(0, floor(min(ay, by) - hw - 1)), y1 = min(H - 1, floor(max(ay, by) + hw + 1));
  const dx = bx - ax, dy = by - ay, inv = 1 / (dx * dx + dy * dy + 1e-9);
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - ay;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax;
      const t = cl((px * dx + py * dy) * inv, 0, 1);
      const ex = px - t * dx, ey = py - t * dy;
      const c = cl(hw + 0.5 - sqrt(ex * ex + ey * ey), 0, 1);
      if (c <= 0) continue;
      const o = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) { const v = c * col[q]; if (v > cur[o + q]) cur[o + q] = v; }
    }
  }
}

// a soft bloom round an atom, added over the background and not kept in the ghost
function glow(gl, cx, cy, rad, col, a) {
  const x0 = max(0, floor(cx - rad)), x1 = min(W - 1, floor(cx + rad));
  const y0 = max(0, floor(cy - rad)), y1 = min(H - 1, floor(cy + rad));
  const ir = 1 / (rad * rad);
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx;
      const u = 1 - (px * px + py * py) * ir;
      if (u <= 0) continue;
      const k = a * u * u, o = (y * W + x) * 3;
      gl[o] += col[0] * k; gl[o + 1] += col[1] * k; gl[o + 2] += col[2] * k;
    }
  }
}

function atom(cur, cx, cy, rad, col) {
  const x0 = max(0, floor(cx - rad - 1)), x1 = min(W - 1, floor(cx + rad + 1));
  const y0 = max(0, floor(cy - rad - 1)), y1 = min(H - 1, floor(cy + rad + 1));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx;
      const d = sqrt(px * px + py * py);
      const c = cl(rad + 0.5 - d, 0, 1);
      if (c <= 0) continue;
      const u = d / rad, shade = 0.72 + 0.28 * (1 - u * u);
      const o = (y * W + x) * 3;
      for (let q = 0; q < 3; q++) cur[o + q] = cur[o + q] * (1 - c) + col[q] * shade * c;
    }
  }
}

// rates of the cloud paths, radians a second, none a multiple of another
const BR = Array.from({ length: 4 * NCLOUD }, (_, i) => 0.04 + 0.085 * ((i * 0.6180339887 + 0.17) % 1));

// ---- Lab hooks ------------------------------------------------------------------
export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.1);
  if (!st.init) { for (let i = 0; i < 4; i++) st.ks[i] = st.k[i]; }
  else { const a = 1 - exp(-dt / TAU_K); for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a; }
  const { NA, NB, nm, om, Us, Sb, th, ea, eb, ra, rb, w, X0, Y0, px, py, vx, vy, en, ve, dx, dy, be, cur, gl, fb, out, bgv, bonds, bl, typ } = st;
  const sk = st.ks;
  const shift = fin(sk[0], 0);
  const amp = cl(sk[1], 0.3, 3);
  const mu = cl(sk[2], 1, NMODE_MAX);
  const mix = cl(MIX0 + (1 - MIX0) * (sk[3] + 1) / 2, 0, 1);

  // phases of every mode and of its two slow envelopes keep adding up, so nothing ever lines up again
  for (let m = 0; m < nm; m++) {
    th[m] += om[m] * dt; if (th[m] > TP) th[m] -= TP;
    ea[m] += ra[m] * dt; if (ea[m] > TP) ea[m] -= TP;
    eb[m] += rb[m] * dt; if (eb[m] > TP) eb[m] -= TP;
  }

  // weights: the leading mode cross-faded between its two whole numbers, plus a window of companions that take turns
  w.fill(0);
  const lead = mu - 1, lo = floor(lead), fr = lead - lo;
  const lead_w = 1 - 0.55 * mix;
  w[lo] += lead_w * cos(fr * PI / 2);
  if (lo + 1 < nm) w[lo + 1] += lead_w * sin(fr * PI / 2);
  const side = 0.15 + 1.0 * mix, sig = 4.0 + 4.0 * mix;
  for (let m = max(0, floor(lead) - WIN); m <= min(nm - 1, floor(lead) + WIN); m++) {
    const d = m - lead;
    const e = sqrt((0.5 + 0.5 * sin(ea[m])) * (0.5 + 0.5 * sin(eb[m])));
    w[m] += side * (0.18 + 0.82 * e) * exp(-(d * d) / (2 * sig * sig)) * 0.9;
  }
  let sw = 0; const act = st.act; act.length = 0;
  for (let m = 0; m < nm; m++) if (w[m] > 0.01) { act.push(m); sw += w[m] * w[m]; }
  const norm = 1 / sqrt(max(1, sw));

  // displacement and velocity of every atom, and the amplitude envelope of each
  px.fill(0); py.fill(0); vx.fill(0); vy.fill(0); en.fill(0); ve.fill(0);
  for (const m of act) {
    const c = w[m] * norm, ph = th[m], cs = c * cos(ph), sn = c * om[m] * sin(ph), u = Us[m], c2 = c * c, o2 = om[m] * om[m];
    for (let i = 0; i < NA; i++) {
      const ux = u[2 * i], uy = u[2 * i + 1];
      px[i] += cs * ux; py[i] += cs * uy; vx[i] -= sn * ux; vy[i] -= sn * uy;
      const q = ux * ux + uy * uy; en[i] += c2 * q; ve[i] += c2 * o2 * q;
    }
  }
  be.fill(0);
  for (const m of act) { const c2 = (w[m] * norm) * (w[m] * norm), sb = Sb[m]; for (let k = 0; k < NB; k++) be[k] += c2 * sb[k] * sb[k]; }
  let smax = 1e-9;
  for (let k = 0; k < NB; k++) smax = max(smax, sqrt(be[k]));
  let emax = 1e-9, vmax = 1e-9;
  for (let i = 0; i < NA; i++) { en[i] = sqrt(en[i]) * amp; ve[i] = sqrt(ve[i]) * amp; emax = max(emax, en[i]); vmax = max(vmax, ve[i]); }
  const capT = min(1, DCAP / emax);
  if (!st.init || capT < st.cap) st.cap = capT; else st.cap += (capT - st.cap) * (1 - exp(-dt / 0.4));
  const gain = amp * st.cap;
  // the strain at which a bond shows its full colour: half the peak the most strained bond reaches
  const s0 = max(0.004, 0.55 * smax * gain);
  for (let i = 0; i < NA; i++) { dx[i] = X0[i] + gain * px[i]; dy[i] = Y0[i] + gain * py[i]; }

  // draw this frame
  cur.fill(0); gl.fill(0);
  const rest = [0, 0, 0], cc = [0, 0, 0], ct = [0, 0, 0], col = [0, 0, 0], ca = [[0, 0, 0], [0, 0, 0]];
  hsv(0.6 + shift, 0.3, 0.42, rest); hsv(0.575 + shift, 0.85, 1.0, cc); hsv(0.1 + shift, 0.82, 1.0, ct);
  hsv(0.5 + shift, 0.4, 1.0, ca[0]); hsv(0.9 + shift, 0.62, 1.0, ca[1]);
  for (let k = 0; k < NB; k++) {
    const a = bonds[k][0], b = bonds[k][1];
    const len = hypot(dx[b] - dx[a], dy[b] - dy[a]);
    const e = (len / bl[k] - 1) / s0, t = pow075(cl(abs(e), 0, 1)), tgt = e < 0 ? cc : ct;
    for (let q = 0; q < 3; q++) col[q] = rest[q] + (tgt[q] - rest[q]) * t;
    bond(cur, dx[a], dy[a], dx[b], dy[b], col, 1.05);
  }
  for (let i = 0; i < NA; i++) {
    const sp = cl(hypot(vx[i], vy[i]) * amp / vmax, 0, 1);
    const en_n = en[i] / emax;
    const lit = cl(0.28 + 0.72 * (0.7 * sp + 0.3 * en_n), 0, 1);
    const kind = typ[i] ? 1 : 0;
    for (let q = 0; q < 3; q++) col[q] = ca[kind][q] * lit;
    atom(cur, dx[i], dy[i], 2.6 + 0.9 * lit + (kind ? 0.45 : 0), col);
    glow(gl, dx[i], dy[i], GLOW_R, ca[kind], GLOW_A * (0.15 + 0.85 * sp * sp));
  }

  // five faint clouds of light drift across the navy ground on slow paths of their own
  const dec = st.init ? exp(-dt / TAU_TRAIL) : 0;
  const bg = [0, 0, 0], bc = [], bx = [], by = [];
  for (let b = 0; b < NCLOUD; b++) { bc.push([0, 0, 0]); bx.push(0); by.push(0); }
  hsv(0.64 + shift * 0.5, 0.75, 0.07, bg);
  const bp = st.bp;
  for (let b = 0; b < NCLOUD; b++) {
    for (let q = 0; q < 4; q++) bp[b * 4 + q] += BR[b * 4 + q] * dt;
    bx[b] = 32 + 27 * sin(bp[b * 4]) + 8 * sin(bp[b * 4 + 2]); by[b] = 64 + 58 * sin(bp[b * 4 + 1]) + 12 * sin(bp[b * 4 + 3]);
    hsv(0.5 + 0.08 * (b % 3) + shift * 0.5, 0.7, CLOUD_V, bc[b]);
  }
  const ir = 1 / (CLOUD_R * CLOUD_R);
  for (let y = 0, p = 0, p3 = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++, p3 += 3) {
      let c0 = bg[0] * bgv[p], c1 = bg[1] * bgv[p], c2 = bg[2] * bgv[p];
      for (let b = 0; b < NCLOUD; b++) {
        const ddx = x + 0.5 - bx[b], ddy = y + 0.5 - by[b], u = 1 - (ddx * ddx + ddy * ddy) * ir;
        if (u > 0) { const k = u * u; c0 += bc[b][0] * k; c1 += bc[b][1] * k; c2 += bc[b][2] * k; }
      }
      const f0 = max(fb[p3] * dec, cur[p3]), f1 = max(fb[p3 + 1] * dec, cur[p3 + 1]), f2 = max(fb[p3 + 2] * dec, cur[p3 + 2]);
      fb[p3] = f0; fb[p3 + 1] = f1; fb[p3 + 2] = f2;
      out[p3] = min(1, c0 + f0 + gl[p3]); out[p3 + 1] = min(1, c1 + f1 + gl[p3 + 1]); out[p3 + 2] = min(1, c2 + f2 + gl[p3 + 2]);
    }
  }
  st.init = true;
}

const pow075 = (v) => Math.pow(v, 0.75);

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const out = st.out;
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++) {
      const o = p * 3;
      display.setPixel(x, y, floor(out[o] * 255), floor(out[o + 1] * 255), floor(out[o + 2] * 255));
    }
  }
}
