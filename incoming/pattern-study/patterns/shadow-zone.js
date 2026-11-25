// ===== Patternflow pattern =====
// Title:   Shadow Zone
// Family:  raypaths
// Idea:    A quake on the rim of a disc-shaped cross-section of the Earth sends P and S wavefronts, worked out ray by ray through a layered model, down through a mantle that bends them back up and on into the core, where the liquid outer core stops the S waves and bends the P waves so hard that a wedge of the far surface (the P shadow zone, about 100 to 144 degrees) gets no direct P at all, while below the disc each arrival lights its dot on a travel-time diagram that slowly draws the curves with the P gap and the S cut-off in them.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the core shadow zone of seismology (Richard Oldham, 1906; Beno Gutenberg, 1913; Inge Lehmann, 1936), ray tracing in a layered Earth by the constancy of the ray parameter p = r sin(i) / v (Herglotz and Wiechert, then Jeffreys and Bullen, 1940) in a model patterned on PREM (Dziewonski and Anderson, 1981), all from memory; the marching tracer with its own apex step, the wavefronts drawn as the locus of ray points at one time, the overlapping quakes with their radiation lobes and the self-fading record section are original, pattern round 252
// Round:   254
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Depth=0..4, Core=-1..1, Tempo=-1..1
//
// Knob 1: Hue. Turns P blue-white, S orange and the core phases magenta round the wheel together; it opens on that triad.
// Knob 2: Depth. 0 to 4, opening at 2. The focus depth of the quakes, from 15 km up to about 700 km; a deep quake sits inside the rim and leaves surface-reflected pP and sS fronts behind its direct waves, a second set of curves in the diagram.
// Knob 3: Core. -1 to 1, opening at 0 for the Earth as it is. The radius of the core-mantle boundary from 0.36 to 0.74 of the Earth's radius; the ring moves, and the P shadow zone and the S cut-off in the diagram move with it, from about 127 degrees at the small end to about 62 degrees at the large end.
// Knob 4: Tempo. -1 to 1, opening at about 0.06. How fast the waves travel and the quakes follow each other, from 20 times real time (a quake plays out in 85 s) to 186 times (9 s).

const W = 64, H = 128, RE = 6371;                // panel; Earth radius in km
const DCX = 32, DCY = 32.5, DR = 30, KR = DR / RE;   // the disc: centre and radius in LED, LED per km
const RX0 = 2, RX1 = 61, RY0 = 74, RY1 = 126, TMAX = 1700;   // the record: 0 to 180 degrees across, 0 to TMAX seconds down
const NL = 9, CML = 5, NM = 380, NT = 76, NF = 6, DS = 56;   // layers, the layer above the core, nodes per ray, rays per side, ray families, km per step
const SPEED0 = 62, SPAWN = 720, TEND = 1760, TAUP = 2850;    // model s per display s, model s between quakes, a quake's length, the record's fade, all in model s
const HSWAY = 0.035, HTURN = 0.0001;             // the palette's own drift, in turns of the wheel and turns a second
const GAIN = [1, 0.38, 1, 0.38, 0.5, 0.5];       // brightness of each family
const PAPERA = 0.2, RIMA = 1, RAYA = 0.34, FRONTA = 1, RING_C = 0.3, RING_I = 0.2, RING_S = 0.4;
const { floor, min, max, abs, sqrt, exp, sin, cos, atan2, asin, pow, PI } = Math;
const TP = 2 * PI, DEG = 180 / PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();
const foldA = (a) => { a = ((a % TP) + TP) % TP; return a > PI ? TP - a : a; };
const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- the layered Earth ------------------------------------------------------------------------------------------
// P and S speed are linear in radius inside each layer. The mantle follows PREM down to the core-mantle boundary, the
// outer core is liquid (no S) and slower for P, the inner core is fast again. The core radius is the knob: the lower
// mantle and the core stretch to fit it and the speeds at the boundaries stay.
const MR = { lo: new Float64Array(NL), hi: new Float64Array(NL), vh: new Float64Array(2 * NL), gd: new Float64Array(2 * NL), rc: 0, ri: 0 };
function buildModel(rc) {
  const rcm = rc * RE, ric = 0.351 * rcm, r660 = 0.8963 * RE, r410 = 0.9356 * RE, rmid = rcm + (ric - rcm) * 0.5;
  const lm = (f) => r660 + (rcm - r660) * f;
  const lay = [   // bottom, top, P at the top, P at the bottom, S at the top, S at the bottom
    [r410, RE, 8.10, 9.00, 4.50, 4.80], [r660, r410, 9.00, 10.30, 4.80, 5.60],
    [lm(0.374), r660, 10.75, 12.15, 5.95, 6.70], [lm(0.69), lm(0.374), 12.15, 13.10, 6.70, 7.08],
    [lm(0.933), lm(0.69), 13.10, 13.68, 7.08, 7.25], [rcm, lm(0.933), 13.68, 13.72, 7.25, 7.26],
    [rmid, rcm, 8.065, 9.35, 0, 0], [ric, rmid, 9.35, 10.356, 0, 0], [0, ric, 11.03, 11.26, 0, 0],
  ];
  for (let i = 0; i < NL; i++) {
    const [lo, hi, ph, pl, sh, sl] = lay[i];
    MR.lo[i] = lo; MR.hi[i] = hi;
    MR.vh[i] = ph; MR.gd[i] = (pl - ph) / (hi - lo);
    MR.vh[NL + i] = sh; MR.gd[NL + i] = (sl - sh) / (hi - lo);
  }
  MR.rc = rcm; MR.ri = ric;
}
const velAt = (L, w, r) => MR.vh[w * NL + L] + MR.gd[w * NL + L] * (MR.hi[L] - r);
function layerAt(r) { for (let i = 0; i < NL; i++) if (r >= MR.lo[i]) return i; return NL - 1; }

// One ray. w0: 0 P, 1 S. p: ray parameter in s/rad. dir0: 1 starts downward, -1 upward (it then bounces once off the
// surface). mode at the core-mantle boundary: 0 transmit (P into the core), 1 reflect, 2 convert (S into P and back).
// The ray is marched in short chords with the direction taken at the middle of each step; at the turning radius, which
// has a closed form because the speed is linear in each layer, it is put on the apex and sent up. Nodes (angle from the
// source, radius, time) go to TH, RR, TT from offset off. Returns the node count, or 0 if the ray never came up.
let trTh = 0, trT = 0, trTc = -1;
function trace(w0, p, r0, dir0, mode, TH, RR, TT, off) {
  let r = r0, th = 0, t = 0, w = w0, dir = dir0, L = layerAt(r0 - 1e-6), n = 1, bounced = dir0 > 0, tc = -1, ok = false;
  TH[off] = 0; RR[off] = r; TT[off] = 0;
  while (n < NM) {
    const ds = min(DS, 0.07 * r + 3);
    let v = velAt(L, w, r), sinI = p * v / r, rm, vm, s2;
    for (let pass = 0; pass < 2; pass++) {
      if (dir > 0 && sinI >= 1) {
        const rt = cl(p * (MR.vh[w * NL + L] + MR.gd[w * NL + L] * MR.hi[L]) / (1 + p * MR.gd[w * NL + L]), MR.lo[L], MR.hi[L]);
        r = rt; v = velAt(L, w, r); sinI = min(1, p * v / r); dir = -1;
      }
      sinI = min(1, sinI);
      const ra = r - dir * 0.5 * ds * sqrt(1 - sinI * sinI), rb = 0.5 * ds * sinI;
      rm = cl(sqrt(ra * ra + rb * rb), max(1, MR.lo[L]), MR.hi[L]);
      vm = velAt(L, w, rm);
      s2 = p * vm / rm;
      if (dir > 0 && s2 >= 1) { sinI = 1; continue; }
      break;
    }
    s2 = min(1, s2);
    const im = asin(s2), om = dir > 0 ? PI - im : im, oc = om + 0.5 * ds * sin(om) / r;
    const cx = r + ds * cos(oc), cy = ds * sin(oc);
    const dr = sqrt(cx * cx + cy * cy) - r, dth = atan2(cy, cx), dtt = ds / vm;
    let hit = 0, f = 1;
    if (r + dr > MR.hi[L]) { f = (MR.hi[L] - r) / dr; hit = 1; }
    else if (r + dr < MR.lo[L]) {
      if (L === NL - 1 && r + dr < 0) { f = -r / dr; hit = 3; } else { f = (MR.lo[L] - r) / dr; hit = 2; }
    }
    f = cl(f, 0, 1);
    r += dr * f; th += dth * f; t += dtt * f;
    if (hit === 1) r = MR.hi[L]; else if (hit === 2) r = MR.lo[L];
    TH[off + n] = th; RR[off + n] = r; TT[off + n] = t; n++;
    if (hit === 3) { r = 1e-3; th += PI; dir = -1; continue; }       // straight through the centre
    if (hit === 1) {
      if (L === 0) {
        if (!bounced) { bounced = true; dir = 1; continue; }
        ok = true; break;
      }
      if (L === CML + 1 && mode === 2 && w === 0) w = 1;            // out of the core: P back into S
      L--;
    } else if (hit === 2) {
      if (L === NL - 1) { dir = -1; continue; }
      let w2 = w;
      if (L === CML) {
        if (tc < 0) tc = t;
        if (mode === 1) { dir = -1; continue; }
        if (w === 1) w2 = 0;                                          // S into P
      }
      const v2 = velAt(L + 1, w2, r);
      if (v2 <= 0 || p * v2 / r >= 1) { dir = -1; if (tc < 0) tc = t; continue; }
      L++; w = w2;
    }
  }
  trTh = th; trT = t; trTc = tc;
  return ok ? n : 0;
}

// ---- one quake: the rays of its fans, traced once ---------------------------------------------------------------
// families: 0 P (and PKP past the core), 1 PcP, 2 S (and ScS), 3 SKS, 4 pP, 5 sS. Each ray is a track in one array.
const CJP = [0.9995, 0.965, 0.92, 0.85, 0.74, 0.58, 0.40, 0.22, 0.06];   // rays into the core, as fractions of the grazing parameter
const CJC = [0.9995, 0.93, 0.80, 0.62, 0.40, 0.20], CJS = [0.9995, 0.95, 0.88, 0.78, 0.62, 0.42, 0.20];
const CJK = [0.88, 0.76, 0.60, 0.42, 0.22, 0.07], CJD = [0.9995, 0.90, 0.75, 0.55, 0.30];
function newEvent() {
  return {
    TH: new Float32Array(NT * NM), RR: new Float32Array(NT * NM), TT: new Float32Array(NT * NM),
    tn: new Int16Array(NT), tc: new Float32Array(NT), te: new Float32Array(NT), td: new Float32Array(NT),
    tw: new Float32Array(NT), ta: new Float32Array(NT), ra: new Float32Array(NT), fs: new Int16Array(NF), fc: new Int16Array(NF),
    age: 0, prev: 0, ang: 0, mag: 1, df: 1, th0: 0, sh: 0, depth: 20, dep0: 20, k3: 9, heads: [],
  };
}
// the radiation pattern of the quake's mechanism: four lobes for P, the four between them for S, never quite dark
function radAmp(ev, f, k, side) {
  const q = 2 * (side * (f > 3 ? PI - ev.ta[k] : ev.ta[k]) - ev.th0);
  return 0.2 + 0.8 * abs(f === 2 || f === 3 || f === 5 ? cos(q) : sin(q));
}
const tmpP = new Float64Array(40);
// ray parameters: nm mantle rays from shallow to deep, the one grazing the core, then the rays into it
function plist(eta, pc, cj, nm) {
  let n = 0;
  if (nm) {
    const ic = asin(min(0.98, pc / eta));
    for (let j = 0; j < nm; j++) tmpP[n++] = eta * sin(1.54 - (1.54 - ic - 0.03) * (j + 0.5) / nm);
    tmpP[n++] = pc * 1.0004;
  }
  for (let j = 0; j < cj.length; j++) tmpP[n++] = pc * cj[j];
  return n;
}
let kNow = 0;
function traceEvent(ev) {
  const rs = RE - ev.depth, Ls = layerAt(rs - 1e-6);
  const etaP = rs / velAt(Ls, 0, rs), etaS = rs / velAt(Ls, 1, rs), pcP = MR.rc / 13.72, pcS = MR.rc / 7.26;
  let k = 0;
  const add = (fam, w, mode, dir0, n0) => {
    ev.fs[fam] = k; let cnt = 0;
    for (let i = 0; i < n0 && k < NT; i++, k++, cnt++) {
      const p = tmpP[i], n = trace(w, p, rs, dir0, mode, ev.TH, ev.RR, ev.TT, k * NM);
      ev.tn[k] = n && (fam & 1) && fam < 4 && trTc < 0 ? 0 : n;      // reflected and converted rays must meet the core
      ev.tc[k] = trTc; ev.te[k] = trT; ev.td[k] = n ? foldA(trTh) : 0;
      ev.tw[k] = (fam === 0 || fam === 4) && p < 0.465 * pcP ? 0.5 : 1;   // what goes through the inner core is weak
      ev.ta[k] = asin(min(1, p / (w ? etaS : etaP)));
      ev.ra[k] = 0.5 * (radAmp(ev, fam, k, -1) + radAmp(ev, fam, k, 1));
    }
    ev.fc[fam] = cnt;
  };
  add(0, 0, 0, 1, plist(etaP, pcP, CJP, 12));
  add(1, 0, 1, 1, plist(etaP, pcP, CJC, 0));
  add(2, 1, 1, 1, plist(etaS, pcS, CJS, 12));
  add(3, 1, 2, 1, plist(etaS, pcS, CJK, 0));
  if (ev.depth > 90) {
    add(4, 0, 0, -1, plist(etaP, pcP, CJD, 6));
    add(5, 1, 1, -1, plist(etaS, pcS, [], 6));
  } else { ev.fc[4] = 0; ev.fc[5] = 0; ev.fs[4] = k; ev.fs[5] = k; }
  ev.k3 = kNow; ev.dep0 = ev.depth;
}

// ---- state ------------------------------------------------------------------------------------------------------
export function setup(params) {
  const ph = []; for (let i = 0; i < 6; i++) ph.push(rnd() * TP);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, tau: 0, view: rnd() * TP, vph: ph,
    ev: [], pool: [], nextIn: 0, k3m: 9, cov: [100, 144, 103], depthBase: 350,
    paper: new Float32Array(W * H * 3), rim: new Float32Array(120 * 3), buf: new Float32Array(W * H * 3),
    col: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  });
  for (let i = 0; i < 7; i++) st.pool.push(newEvent());
  return st;
}

// where direct P and direct S are received for the present core: the grazing rays and the edge of the PKP arrivals
const SCR = [new Float32Array(NM), new Float32Array(NM), new Float32Array(NM)];
function coverage(st) {
  const pcP = MR.rc / 13.72, pcS = MR.rc / 7.26, tr = (w, p, mode) => (trace(w, p, RE - 0.01, 1, mode, SCR[0], SCR[1], SCR[2], 0) ? foldA(trTh) * DEG : -1);
  let e = 180;
  for (let j = 0; j < 12; j++) { const d = tr(0, pcP * (0.97 - 0.035 * j), 0); if (d >= 0 && d < e) e = d; }
  st.cov = [max(0, tr(0, pcP * 1.0004, 0)), e, max(0, tr(1, pcS * 1.0004, 1))];
}

// ---- drawing primitives -----------------------------------------------------------------------------------------
// a soft line into a float RGB buffer: full strength within wc of the segment, falling to nothing at wc + wg; mx takes the
// brighter of the line and what is there, otherwise it adds
function seg(a, x0, y0, x1, y1, cr, cg, cb, i0, i1, wc, wg, mx) {
  const reach = wc + wg;
  const xa = max(0, floor(min(x0, x1) - reach)), xb = min(W - 1, floor(max(x0, x1) + reach));
  const ya = max(0, floor(min(y0, y1) - reach)), yb = min(H - 1, floor(max(y0, y1) + reach));
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, r2 = reach * reach;
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5;
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5, t = l2 > 1e-9 ? cl(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1) : 0;
      const ex = px - (x0 + dx * t), ey = py - (y0 + dy * t), d2 = ex * ex + ey * ey;
      if (d2 >= r2) continue;
      const d = sqrt(d2);
      let f = d <= wc ? 1 : 1 - (d - wc) / wg;
      f *= f * (i0 + (i1 - i0) * t);
      const q = (y * W + x) * 3;
      if (mx) {
        if (cr * f > a[q]) a[q] = cr * f;
        if (cg * f > a[q + 1]) a[q + 1] = cg * f;
        if (cb * f > a[q + 2]) a[q + 2] = cb * f;
      } else { a[q] += cr * f; a[q + 1] += cg * f; a[q + 2] += cb * f; }
    }
  }
}

// the point of ray k at model time T: sets hth and hr and returns 1, or returns 0 when the ray has not started or is over
let hth = 0, hr = 0, hx = 0, hy = 0;
function headAt(ev, k, T) {
  const n = ev.tn[k], o = k * NM, TT = ev.TT;
  if (n < 2 || T < 0 || T > ev.te[k]) return 0;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (TT[o + mid] <= T) lo = mid; else hi = mid; }
  const t0 = TT[o + lo], t1 = TT[o + hi], u = t1 > t0 ? (T - t0) / (t1 - t0) : 0;
  hth = ev.TH[o + lo] + (ev.TH[o + hi] - ev.TH[o + lo]) * u;
  hr = ev.RR[o + lo] + (ev.RR[o + hi] - ev.RR[o + lo]) * u;
  return 1;
}
function ptAt(ev, k, side, T, base) {
  if (!headAt(ev, k, T)) return 0;
  const a = base + side * hth;
  hx = DCX + KR * hr * sin(a); hy = DCY - KR * hr * cos(a);
  return 1;
}
// 0 P, 1 S, 2 core phase: the colour a ray has at time T
function colOf(ev, f, k, T) {
  if (f === 1 || f === 3) return 2;
  if (f > 3) return f - 4;
  return ev.tc[k] >= 0 && T >= ev.tc[k] ? 2 : f / 2;
}

// ---- the quakes -------------------------------------------------------------------------------------------------
function spawn(st) {
  const ev = st.pool.pop();
  if (!ev) return;
  // of two trial positions take the one farther from the quakes still going
  let best = 0, bd = -1;
  for (let c = 0; c < 2; c++) {
    const a = rnd() * TP;
    let d = 9;
    for (const e of st.ev) d = min(d, foldA(a - e.ang - st.view));
    if (d > bd) { bd = d; best = a; }
  }
  ev.ang = best - st.view;
  ev.mag = 0.4 + 0.6 * pow(rnd(), 0.75);
  ev.th0 = rnd() * PI;
  ev.df = 0.5 + 0.9 * rnd();
  ev.depth = cl(st.depthBase * ev.df, 12, 720);
  ev.age = 0; ev.prev = 0; ev.sh = 0; ev.heads.length = 0;
  traceEvent(ev);
  st.ev.push(ev);
}

function rimAdd(st, ang, c, v) {
  const b = ((ang / TP) % 1 + 1) % 1 * 120, i0 = floor(b) % 120, i1 = (i0 + 1) % 120, f = b - floor(b), r = st.rim;
  if (v * (1 - f) > r[i0 * 3 + c]) r[i0 * 3 + c] = v * (1 - f);
  if (v * f > r[i1 * 3 + c]) r[i1 * 3 + c] = v * f;
}

// what each pair of neighbouring rays adds between two moments: the bit of travel-time curve they bound goes onto the
// record paper, the arrival sweeps along the rim on both sides of the source, and the arrivals now are kept as heads
function sweep(st, ev, t0, t1) {
  ev.heads.length = 0;
  for (let f = 0; f < NF; f++) {
    for (let k = ev.fs[f]; k < ev.fs[f] + ev.fc[f] - 1; k++) {
      if (!ev.tn[k] || !ev.tn[k + 1]) continue;
      const da = ev.td[k] * DEG, db = ev.td[k + 1] * DEG, ta = ev.te[k], tb = ev.te[k + 1];
      if (abs(da - db) > 24 || abs(ta - tb) > 190) continue;     // a break in the curve: the shadow zone
      const lo = min(ta, tb), hi = max(ta, tb);
      if (hi < t0 || lo > t1 || hi - lo < 1e-6) continue;
      const u0 = cl((t0 - ta) / (tb - ta), 0, 1), u1 = cl((t1 - ta) / (tb - ta), 0, 1);
      const d0 = da + (db - da) * u0, d1 = da + (db - da) * u1;
      const ci = f === 0 ? (ev.tc[k] >= 0 && ev.tc[k + 1] >= 0 ? 2 : 0) : f === 2 ? (ev.tc[k] >= 0 || ev.tc[k + 1] >= 0 ? 2 : 1) : colOf(ev, f, k, 0), cc = st.col[ci];
      const amp0 = ev.mag * GAIN[f] * ev.tw[k], amp = amp0 * ev.ra[k];
      const x0 = RX0 + d0 / 180 * (RX1 - RX0), x1 = RX0 + d1 / 180 * (RX1 - RX0);
      const y0 = RY0 + (ta + (tb - ta) * u0) / TMAX * (RY1 - RY0), y1 = RY0 + (ta + (tb - ta) * u1) / TMAX * (RY1 - RY0);
      // pieces shorter than the line is wide are made fainter in step, so a slow sweep does not pile up ink
      const ink = PAPERA * amp * min(1, sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) / 1.7);
      if (ink > 1e-4) seg(st.paper, x0, y0, x1, y1, cc[0], cc[1], cc[2], ink, ink, 0.65, 0.8, false);
      const ns = max(1, floor(abs(d1 - d0) / 2.5) + 1);
      for (let s2 = 0; s2 <= ns; s2++) {
        const d = (d0 + (d1 - d0) * s2 / ns) / DEG;
        rimAdd(st, ev.ang + st.view + d, ci, RIMA * amp0 * radAmp(ev, f, k, 1));
        rimAdd(st, ev.ang + st.view - d, ci, RIMA * amp0 * radAmp(ev, f, k, -1));
      }
      if (t1 >= lo && t1 <= hi) ev.heads.push(d1, ci, amp);
    }
  }
}

function step(st, dt) {
  const ks = st.ks;
  st.tau += dt;
  const dm = dt * SPEED0 * pow(3, cl(ks[3], -1, 1));
  st.view += dt * (0.022 + 0.014 * sin(0.0173 * st.tau + st.vph[0]) + 0.009 * sin(0.0291 * st.tau + st.vph[1]));
  st.depthBase = 15 + 170 * cl(ks[1], 0, 4);
  const k3 = (kNow = cl(ks[2], -1, 1));
  if (abs(k3 - st.k3m) > 0.004) { st.k3m = k3; buildModel(0.5463 + 0.19 * k3); coverage(st); }
  // the record fades and the rim rings down
  const fp = exp(-dm / TAUP), fr = exp(-dm / 100), paper = st.paper;
  for (let i = 64 * W * 3; i < paper.length; i++) paper[i] *= fp;
  for (let i = 0; i < st.rim.length; i++) st.rim[i] *= fr;
  // a new quake after a random wait, and never fewer than three still young, so something is always crossing the disc
  let young = 0;
  for (const e of st.ev) if (e.age < 800) young++;
  if (young < 3) st.nextIn = min(st.nextIn, 40 + 260 * rnd());
  st.nextIn -= dm;
  if (st.nextIn <= 0) {
    if (st.pool.length) { spawn(st); st.nextIn = SPAWN * (0.55 + 0.9 * rnd()); } else st.nextIn = 30;
  }
  let retraced = 0, newest = 1e9;
  for (const e of st.ev) newest = min(newest, e.age);
  for (let i = st.ev.length - 1; i >= 0; i--) {
    const ev = st.ev[i];
    ev.sh += ((ev.age <= newest ? 1 : 0) - ev.sh) * (1 - exp(-dt / 1.2));      // the newest quake marks its shadow on the rim
    ev.prev = ev.age; ev.age += dm;
    if (ev.age > TEND) { st.ev.splice(i, 1); st.pool.push(ev); continue; }
    // a changed core or depth traces the rays again, one quake a frame
    const nd = cl(st.depthBase * ev.df, 12, 720);
    if (retraced < 1 && (abs(ev.k3 - k3) > 0.008 || abs(nd - ev.dep0) > 18)) { ev.depth = nd; traceEvent(ev); retraced++; }
    sweep(st, ev, ev.prev, ev.age);
  }
}

function prepColours(st) {
  // the palette sways a little round the wheel and creeps once round in about three hours
  const t = st.tau, ph = st.vph, c = st.col;
  const h = fin(st.ks[0], 0) + HSWAY * (0.65 * sin(0.0431 * t + ph[2]) + 0.35 * sin(0.0877 * t + ph[1])) + HTURN * t;
  // P, S, core phase; then the ground of the mantle, the outer core and the inner core, each wandering round its own hue
  const hs = [0.56, 0.035, 0.84, 0.035 + 0.045 * sin(0.0213 * t + ph[3]), 0.62 + 0.05 * sin(0.0167 * t + ph[4]), 0.12 + 0.05 * sin(0.0289 * t + ph[5])];
  const ss = [0.42, 0.88, 0.7, 0.55, 0.75, 0.5];
  for (let i = 0; i < 6; i++) { hsv(hs[i] + h, ss[i], 1, hv); c[i][0] = hv[0]; c[i][1] = hv[1]; c[i][2] = hv[2]; }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // a warm start: a hundred seconds of quakes already behind the first frame, so the record is drawn in
    for (let i = 0; i < 400; i++) { prepColours(st); step(st, 0.25); }
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
    prepColours(st);
    if (dt > 0) step(st, dt);
  }
}

// ---- draw -------------------------------------------------------------------------------------------------------
function discGround(st, buf) {
  const rc = MR.rc / RE, ri = MR.ri / RE, c = st.col, rimv = st.rim, t = st.tau, ph = st.vph;
  // the interior drifts: broad lobes of glow turn through the mantle and the other way through the outer core
  const m1 = 0.052 * t + ph[0], m2 = -0.031 * t + ph[1], o1 = 0.043 * t + ph[2], o2 = -0.067 * t + ph[3];
  for (let y = 0; y < 66; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - DCX, dy = y + 0.5 - DCY, rr = sqrt(dx * dx + dy * dy) / DR;
      if (rr > 1.08) continue;
      const q = (y * W + x) * 3, a = atan2(dx, -dy), ins = cl((1 - rr) * DR / 0.9 + 0.5, 0, 1);
      const wm = sstep(rc - 0.012, rc + 0.012, rr), wi = 1 - sstep(ri - 0.012, ri + 0.012, rr), wo = 1 - wm - wi;
      const vm = (0.12 + 0.07 * (1 - rr)) * max(0.03, 0.5 + 0.45 * sin(2 * a - m1) + 0.35 * sin(3 * a - m2)) * wm;
      const vo = 0.12 * max(0.03, 0.5 + 0.4 * sin(a + o1) + 0.35 * sin(2 * a + o2)) * wo, vi = 0.13 * wi;
      // the rings on the core-mantle boundary, the inner-core boundary and the surface
      const fc = cl(1 - (abs(rr - rc) * DR - 0.8) / 0.9, 0, 1), fi = cl(1 - (abs(rr - ri) * DR - 0.7) / 0.9, 0, 1), fs = cl(1 - (abs(rr - 1 + 1 / DR) * DR - 0.9) / 0.9, 0, 1);
      let e0 = RING_S * fs * fs, e1 = 0, e2 = 0;
      if (fs > 0) {
        // the rim goes dim over the arc where the newest quake's direct P does not arrive
        let sh = 0;
        for (const ev of st.ev) { const da = foldA(a - ev.ang - st.view) * DEG; sh = max(sh, ev.sh * sstep(st.cov[0] - 2, st.cov[0] + 2, da) * (1 - sstep(st.cov[1] - 2, st.cov[1] + 2, da))); }
        e0 *= 1 - 0.92 * sh;
        // the surface rings with what has just arrived: P, S and core-phase energy by angle
        const bb = ((a / TP) % 1 + 1) % 1 * 120, i0 = floor(bb) % 120, i1 = (i0 + 1) % 120, ff = bb - floor(bb);
        e0 += (rimv[i0 * 3] * (1 - ff) + rimv[i1 * 3] * ff) * fs; e1 = (rimv[i0 * 3 + 1] * (1 - ff) + rimv[i1 * 3 + 1] * ff) * fs; e2 = (rimv[i0 * 3 + 2] * (1 - ff) + rimv[i1 * 3 + 2] * ff) * fs;
      }
      const rg = RING_C * fc * fc + RING_I * fi * fi + 0.8 * e2;
      for (let ch = 0; ch < 3; ch++) buf[q + ch] += (c[3][ch] * vm + c[4][ch] * vo + c[5][ch] * vi) * ins + c[2][ch] * rg + c[0][ch] * e0 + c[1][ch] * e1;
    }
  }
}

const FX = new Float64Array(2 * NT), FY = new Float64Array(2 * NT), FA = new Float64Array(2 * NT), FC = new Int8Array(2 * NT), FO = new Uint8Array(2 * NT);
function drawEvent(st, ev, buf, rank) {
  const c = st.col, T = ev.age, base = ev.ang + st.view, newest = rank === 0;
  // the newest quake is the brightest and each older one is dimmer, and any quake dims as it ages
  const life = (rank === 0 ? 1 : rank === 1 ? 0.7 : 0.45) * (0.55 + 0.45 * (1 - sstep(300, 1400, T))), fade = 1 - sstep(1500, TEND, T), wc = 0.62 + 0.6 * ev.mag;
  for (let f = 0; f < NF; f++) {
    const s = ev.fs[f], cnt = ev.fc[f];
    if (!cnt) continue;
    const gf = GAIN[f] * ev.mag * fade;
    // the rays of the newest quake: faint paths from the source to where each has got to, the two that bound the shadow wedge stronger
    if ((f === 0 || f === 2) && newest) for (let k = s; k < s + cnt; k++) {
      const j = k - s, o = k * NM, edge = j === 12 || j === 13;
      if (!ev.tn[k] || (j < 13 && (j & 1))) continue;
      const te = min(T, ev.te[k]);
      let hi = 0;
      { let lo = 0, h2 = ev.tn[k] - 1; while (h2 - lo > 1) { const md = (lo + h2) >> 1; if (ev.TT[o + md] <= te) lo = md; else h2 = md; } hi = lo; }
      for (let sd = -1; sd <= 1; sd += 2) {
        let px = 0, py = 0, pq = -1;
        const rad = radAmp(ev, f, k, sd) * (edge ? 2.2 : 1);
        for (let q = 0; q <= hi + 5; q += 5) {
          let i = min(q, hi), th = ev.TH[o + i], r = ev.RR[o + i];
          if (q > hi) { if (!headAt(ev, k, te)) break; th = hth; r = hr; }
          const a = base + sd * th, x = DCX + KR * r * sin(a), y = DCY - KR * r * cos(a);
          if (pq >= 0) {
            const tq = ev.TT[o + i], cc = c[colOf(ev, f, k, tq)], al = RAYA * gf * rad * (0.35 + 0.65 * min(1, tq / max(1, te)));
            seg(buf, px, py, x, y, cc[0], cc[1], cc[2], al, al, 0.55, 0.9, true);
          }
          px = x; py = y; pq = q;
          if (q > hi) break;
        }
      }
    }
    // the front: the locus of the rays' points at this one moment, joined where neighbours are near
    const nn = 2 * cnt;
    for (let i = 0; i < nn; i++) {
      const left = i < cnt, k = left ? s + i : s + nn - 1 - i;
      FO[i] = 0;
      if (!ev.tn[k] || ((f === 1 || f === 3) && T < ev.tc[k]) || !ptAt(ev, k, left ? -1 : 1, T, base)) continue;
      FX[i] = hx; FY[i] = hy; FA[i] = radAmp(ev, f, k, left ? -1 : 1); FC[i] = colOf(ev, f, k, T); FO[i] = 1;
    }
    const I = FRONTA * gf * life;
    for (let i = 0; i < nn; i++) {
      if (!FO[i]) continue;
      const ca = c[FC[i]], ia = I * FA[i];
      if (i + 1 < nn && FO[i + 1]) {
        const dx = FX[i + 1] - FX[i], dy = FY[i + 1] - FY[i], ib = I * FA[i + 1];
        if (dx * dx + dy * dy < 90) {
          if (FC[i] === FC[i + 1]) seg(buf, FX[i], FY[i], FX[i + 1], FY[i + 1], ca[0], ca[1], ca[2], ia, ib, wc, 1.1, true);
          else {
            const mx = FX[i] + dx * 0.5, my = FY[i] + dy * 0.5, cb = c[FC[i + 1]], im = 0.5 * (ia + ib);
            seg(buf, FX[i], FY[i], mx, my, ca[0], ca[1], ca[2], ia, im, wc, 1.1, true);
            seg(buf, mx, my, FX[i + 1], FY[i + 1], cb[0], cb[1], cb[2], im, ib, wc, 1.1, true);
          }
          continue;
        }
      }
      if (!(i > 0 && FO[i - 1])) seg(buf, FX[i], FY[i], FX[i], FY[i], ca[0], ca[1], ca[2], ia, ia, wc, 1.1, true);
    }
  }
  // the source, and the arrivals of this moment on the record
  const fl = ev.mag * (0.25 + 0.55 * exp(-T / 120)) * fade, rs = RE - ev.depth;
  const sxp = DCX + KR * rs * sin(base), syp = DCY - KR * rs * cos(base);
  seg(buf, sxp, syp, sxp, syp, 1, 1, 1, fl, fl, 0.8 + 1.1 * ev.mag * exp(-T / 160), 1.3, true);
  const hs = ev.heads;
  for (let i = 0; i < hs.length; i += 3) {
    const x = RX0 + hs[i] / 180 * (RX1 - RX0), y = RY0 + T / TMAX * (RY1 - RY0), cc = c[hs[i + 1]], v = 0.15 + 0.85 * hs[i + 2] * fade;
    seg(buf, x, y, x, y, cc[0], cc[1], cc[2], v, v, 0.9, 1.3, true);
  }
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const buf = st.buf, c = st.col, paper = st.paper;
  buf.fill(0);
  discGround(st, buf);
  for (let i = 64 * W * 3; i < buf.length; i++) buf[i] += paper[i];
  // the two bars above the record: where direct P (with its gap) and direct S are received
  const xa = (d) => RX0 + d / 180 * (RX1 - RX0);
  seg(buf, RX0, 67.5, xa(st.cov[0]), 67.5, c[0][0], c[0][1], c[0][2], 0.26, 0.26, 0.9, 0.6, false);
  seg(buf, xa(st.cov[1]), 67.5, RX1, 67.5, c[0][0], c[0][1], c[0][2], 0.26, 0.26, 0.9, 0.6, false);
  seg(buf, RX0, 70.5, xa(st.cov[2]), 70.5, c[1][0], c[1][1], c[1][2], 0.26, 0.26, 0.9, 0.6, false);
  // twelve stations round the rim turn with the view
  for (let i = 0; i < 12; i++) {
    const a = st.view + i * TP / 12, x = DCX + (DR - 0.9) * sin(a), y = DCY - (DR - 0.9) * cos(a);
    seg(buf, x, y, x, y, c[0][0], c[0][1], c[0][2], 0.5, 0.5, 0.9, 0.9, true);
  }
  for (const ev of st.ev) { let rank = 0; for (const e of st.ev) if (e.age < ev.age) rank++; drawEvent(st, ev, buf, rank); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = (y * W + x) * 3;
    display.setPixel(x, y, floor(cl(buf[q] * 255, 0, 255)) || 0, floor(cl(buf[q + 1] * 255, 0, 255)) || 0, floor(cl(buf[q + 2] * 255, 0, 255)) || 0);
  }
}
