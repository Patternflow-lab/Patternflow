// ===== Patternflow pattern =====
// Title:   Compound Eye
// Family:  ommatidia
// Idea:    The domed surface of an insect's compound eye in macro, a hexagonal lattice of facets that each act as a tiny curved lens, so every facet mirrors a soft window of light as a small distorted highlight at a different spot, a dark patch of facets that look straight at the viewer travels over the dome with a bright rim, and slanting bands of thin-film colour sweep over the facets as the eye turns, each facet carrying a slice of the band.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the compound eye of a fly or horsefly seen as optics (the deep pseudopupil, described by Franceschini and Kirschfeld, 1971; the reflecting stripes of tabanid eyes, from memory) with thin-film interference colour (Thomas Young, 1801) and a mirror-ball reflection of an area light; the hexagonal lattice laid on a rotating dome by an azimuthal projection, the facet lens that bends each normal, the wandering light, camera and stripe axis, and the facet shimmer are original, pattern round 252
// Round:   254
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Turn=0..4, Facet=-1..1, Stripes=-1..1
//
// Knob 1: Hue. Turns the interference colours of the bands round the wheel; it opens on green, magenta, gold and cyan and the highlights stay white.
// Knob 2: Turn. 0 to 4, opening at 2. How fast the eye turns under the viewer and the dark patch travels; at 0 the eye holds its angle and only the light, the stripes and the facets keep a gentle shimmer, at 4 it turns two and a half times as fast.
// Knob 3: Facet. -1 to 1, opening at 0. The size of a facet, from 5.3 LED across at -1 through 7.5 LED at the start to 10.6 LED at 1; the lattice scales smoothly about the middle of the dome and the lens in each facet keeps the same tilt, so a larger facet shows its highlight larger.
// Knob 4: Stripes. -1 to 1, opening at about 0.06. Trades the stripes against the dark patch: at -1 the bands are faint and the dark patch of facets looking at the viewer is deep and wide, at 1 the bands fill the dome with colour and the dark patch thins to a shadow.

const W = 64, H = 128;
const HX = 32, HY = 64;                 // dome centre on the panel
const RS = 76;                          // radius of the dome in LED, so the panel shows a cap of about 60 degrees
const ZC = 170;                         // distance of the viewer from the dome centre, in LED
const KAP = 0.36;                       // tilt of a facet's lens at its rim, in radians
const PUP = 0.31;                       // angular radius of the dark patch, in radians
const LENSQ = 0.2;                      // how much of the lens's tilt reaches the colour of the film
const LAM = 0.21;                       // turn of the lattice in its own plane
// the colours of four bands in turn at Hue = 0: green, magenta, gold, cyan
const BH = [0.37, 0.86, 0.10, 0.52];
const { floor, min, max, abs, sqrt, exp, sin, cos, pow, acos, PI } = Math;
const TP = 2 * PI;
const ISQ3 = 1 / sqrt(3), H3 = sqrt(3) / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

const KO = 64, KS = 128, KN = KS * KS;   // the facet table: axial coordinates -64..63

function hash2(a, b, s) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// yellow and green are dimmed toward blue so that no band of the palette outshines the others
const SATB = 0.78;
const FH = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  hsv(i / 256, SATB, 1, hv);
  FH[i] = min(1.15, pow(0.7 / (0.299 * hv[0] + 0.587 * hv[1] + 0.114 * hv[2]), 0.8));
}

export function setup(params) {
  const ph = [];
  for (let i = 0; i < 40; i++) ph.push(rnd() * TP);
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, tau: 0, te: 0, frame: 0, ph,
    M: new Float64Array(9),
    fst: new Int32Array(KN).fill(-1),
    f0x: new Float32Array(KN), f0y: new Float32Array(KN), f0z: new Float32Array(KN),
    fjx: new Float32Array(KN), fjy: new Float32Array(KN), fjz: new Float32Array(KN),
    fu: new Float32Array(KN), fgl: new Float32Array(KN), fth: new Float32Array(KN),
    buf: new Float32Array(W * H * 3),
  });
  return st;
}

function mul3(A, B, o) {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
}

const TA = new Float64Array(9), TB = new Float64Array(9), TC = new Float64Array(9);

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  const k2 = cl(st.ks[1], 0, 4), k3 = cl(st.ks[2], -1, 1), k4 = cl(st.ks[3], -1, 1);
  const sp = pow(k2 / 2, 1.4);
  st.tau += dt;
  st.te += dt * sp;
  const tau = st.tau, te = st.te, ph = st.ph;
  const g = st;

  // the eye turns about three axes at once, each a sum of two slow swings that never line up
  const ea = 0.40 * sin(0.0612 * te + ph[0]) + 0.16 * sin(0.1297 * te + ph[1]);
  const eb = 0.34 * sin(0.0783 * te + ph[2]) + 0.14 * sin(0.1511 * te + ph[3]);
  const ec = 0.55 * sin(0.0537 * te + ph[4]) + 0.20 * sin(0.1069 * te + ph[5]);
  // M = Rz(ec) * Rx(eb) * Ry(ea): the eye's own axes in the world
  const ca = cos(ea), sa = sin(ea), cb = cos(eb), sb = sin(eb), cc = cos(ec), sc = sin(ec);
  TA.set([cc, -sc, 0, sc, cc, 0, 0, 0, 1]);
  TB.set([1, 0, 0, 0, cb, -sb, 0, sb, cb]);
  mul3(TA, TB, TC);
  TA.set([ca, 0, sa, 0, 1, 0, -sa, 0, ca]);
  mul3(TC, TA, st.M);

  // the viewer drifts round the dome, and the dark patch sits where the dome looks straight at it
  g.cx = 52 * sin(0.0891 * te + ph[6]) + 20 * sin(0.1523 * te + ph[7]);
  g.cy = 88 * sin(0.0719 * te + ph[8]) + 30 * sin(0.1277 * te + ph[9]);

  // size of a facet
  const D = 7.5 * pow(1.42, k3);
  g.D = D;
  g.dl = D / RS;

  // the window of light and a smaller lamp wander on their own clock
  let ex = 0.58 * sin(0.0673 * tau + ph[10]) + 0.22 * sin(0.1217 * tau + ph[11]);
  let ey = -0.32 + 0.46 * sin(0.0541 * tau + ph[12]) + 0.16 * sin(0.0997 * tau + ph[13]);
  let ez = 0.72;
  let n = sqrt(ex * ex + ey * ey + ez * ez);
  ex /= n; ey /= n; ez /= n;
  g.e1x = ex; g.e1y = ey; g.e1z = ez;
  // two axes across the window, turned by its own slow angle
  let rx = ey * 0 - ez * -1, ry = ez * 0 - ex * 0, rz = ex * -1 - ey * 0;   // cross(E, up) with up = (0, -1, 0)
  n = sqrt(rx * rx + ry * ry + rz * rz) || 1;
  rx /= n; ry /= n; rz /= n;
  const ux = ey * rz - ez * ry, uy = ez * rx - ex * rz, uz = ex * ry - ey * rx;
  const wa = 0.35 + 0.6 * sin(0.0397 * tau + ph[14]) + 0.25 * sin(0.0883 * tau + ph[15]);
  const cw = cos(wa), sw = sin(wa);
  g.wrx = rx * cw + ux * sw; g.wry = ry * cw + uy * sw; g.wrz = rz * cw + uz * sw;
  g.wux = -rx * sw + ux * cw; g.wuy = -ry * sw + uy * cw; g.wuz = -rz * sw + uz * cw;
  let lx = 0.85 * sin(0.0779 * tau + ph[16]) + 0.2 * sin(0.1393 * tau + ph[17]);
  let ly = 0.6 * sin(0.0587 * tau + ph[18]) + 0.2 * sin(0.1111 * tau + ph[19]);
  let lz = 0.62;
  n = sqrt(lx * lx + ly * ly + lz * lz);
  g.e2x = lx / n; g.e2y = ly / n; g.e2z = lz / n;

  // the axis the bands run across: a world direction that turns in the picture plane and leans in and out of it
  const psi = 0.9 + 0.6 * sin(0.0231 * tau + ph[20]) + 0.28 * sin(0.0557 * tau + ph[21]);
  const chi = 1.05 + 0.24 * sin(0.0347 * tau + ph[22]) + 0.1 * sin(0.0821 * tau + ph[23]);
  g.ux = cos(psi) * sin(chi); g.uy = sin(psi) * sin(chi); g.uz = cos(chi);
  g.fq = 2.7 * (1 + 0.2 * sin(0.0467 * tau + ph[24]) + 0.1 * sin(0.1013 * tau + ph[25]));
  g.fs = 0.042 * tau + 0.35 * sin(0.0337 * tau + ph[26]);

  const sw4 = 0.5 + 0.5 * k4;
  g.sa = 0.4 + 0.8 * sw4;           // stripe strength
  g.pa = 1.3 - 0.75 * sw4;          // dark patch strength
  g.hue = fin(st.ks[0], 0) + 0.07 * sin(0.0213 * tau + ph[27]) + 0.04 * sin(0.0577 * tau + ph[28]);
}

// window of light: a soft box, as the window of a room seen from far off
const HWD = 0.16, HHT = 0.24, SOFT = 0.09;
const box = (a, half) => 1 - sstep(half - SOFT, half + SOFT, a);

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const g = st, M = st.M, buf = st.buf;
  const fst = st.fst, f0x = st.f0x, f0y = st.f0y, f0z = st.f0z, fjx = st.fjx, fjy = st.fjy, fjz = st.fjz;
  const fu = st.fu, fgl = st.fgl, fth = st.fth;
  const frame = ++st.frame, tau = st.tau;
  const dl = g.dl, D = g.D, kl = KAP / dl;                 // k: how much a facet's lens exaggerates the tilt across it
  const gw = cl(0.085 * D, 0.5, 0.95);                      // half-width of the dark rim between facets, in LED
  const cl2 = cos(LAM), sl2 = sin(LAM);
  const hue = g.hue, sa = g.sa, pa = g.pa;
  const cx = g.cx, cy = g.cy;
  const ux = g.ux, uy = g.uy, uz = g.uz, fq = g.fq, fs = g.fs;
  const ip2 = 2 / (PUP * PUP);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - HX) / RS, ny = (y + 0.5 - HY) / RS;
      const nz = sqrt(max(0.05, 1 - nx * nx - ny * ny));
      // the point of the dome in the eye's own frame, then the plane of the lattice (azimuthal, equal distance)
      const mx = M[0] * nx + M[3] * ny + M[6] * nz, my = M[1] * nx + M[4] * ny + M[7] * nz, mz = M[2] * nx + M[5] * ny + M[8] * nz;
      const sn = sqrt(max(1e-12, 1 - mz * mz));
      const th = acos(cl(mz, -1, 1));
      const sc = sn > 1e-4 ? th / sn : 1;
      const pa0 = mx * sc, pb0 = my * sc;
      const lxp = (pa0 * cl2 - pb0 * sl2) / dl, lyp = (pa0 * sl2 + pb0 * cl2) / dl;
      // which facet: cube rounding on the axial coordinates
      const aq = lxp - lyp * ISQ3, ar = lyp * 2 * ISQ3, as = -aq - ar;
      let rq = Math.round(aq), rs = Math.round(as), rr = Math.round(ar);
      const dq = abs(rq - aq), ds = abs(rs - as), dr = abs(rr - ar);
      if (dq > ds && dq > dr) rq = -rs - rr; else if (ds > dr) rs = -rq - rr; else rr = -rq - rs;
      const ddx = lxp - (rq + rr * 0.5), ddy = lyp - rr * H3;
      const e0 = abs(ddx), e1 = abs(0.5 * ddx + H3 * ddy), e2 = abs(-0.5 * ddx + H3 * ddy);
      const ein = 0.5 - max(e0, e1, e2);                        // inside the facet, in facet widths
      const key = ((rq + KO) & 127) * KS + ((rr + KO) & 127);
      if (fst[key] !== frame) {
        fst[key] = frame;
        const cxp = (rq + rr * 0.5) * dl, cyp = rr * H3 * dl;
        const pa1 = cxp * cl2 + cyp * sl2, pb1 = -cxp * sl2 + cyp * cl2;
        const rho = sqrt(pa1 * pa1 + pb1 * pb1);
        let ax = 0, ay = 0, az = 1;
        if (rho > 1e-6) { const s = sin(rho) / rho; ax = pa1 * s; ay = pb1 * s; az = cos(rho); }
        const wx = M[0] * ax + M[1] * ay + M[2] * az, wy = M[3] * ax + M[4] * ay + M[5] * az, wz = M[6] * ax + M[7] * ay + M[8] * az;
        f0x[key] = wx; f0y[key] = wy; f0z[key] = wz;
        // each facet leans a little of its own, and shivers a little
        const h1 = hash2(rq, rr, 1) - 0.5, h2 = hash2(rq, rr, 2) - 0.5, h3 = hash2(rq, rr, 3) - 0.5;
        const w1 = 0.5 + 1.1 * hash2(rq, rr, 4), w2 = 0.5 + 1.1 * hash2(rq, rr, 5);
        const p1 = TP * hash2(rq, rr, 6), p2 = TP * hash2(rq, rr, 7);
        const jx = 0.05 * h1 + 0.007 * sin(w1 * tau + p1), jy = 0.05 * h2 + 0.007 * sin(w2 * tau + p2), jz = 0.05 * h3;
        let qx = wx + jx, qy = wy + jy, qz = wz + jz;
        const ql = 1 / sqrt(qx * qx + qy * qy + qz * qz);
        qx *= ql; qy *= ql; qz *= ql;
        fjx[key] = qx; fjy[key] = qy; fjz[key] = qz;
        // the facet's own view of the viewer: how far its axis is from looking straight at them
        let vx = cx - RS * wx, vy = cy - RS * wy, vz = ZC - RS * wz;
        const vl = 1 / sqrt(vx * vx + vy * vy + vz * vz);
        vx *= vl; vy *= vl; vz *= vl;
        fu[key] = (1 - cl(qx * vx + qy * vy + qz * vz, -1, 1)) * ip2;
        fgl[key] = 0.8 + 0.4 * hash2(rq, rr, 8);
        fth[key] = 0.16 * (hash2(rq, rr, 9) - 0.5);
      }
      // the facet is a lens: the normal across it leans kl times as far as the dome under it does
      let px = fjx[key] + kl * (nx - f0x[key]), py = fjy[key] + kl * (ny - f0y[key]), pz = fjz[key] + kl * (nz - f0z[key]);
      const pl = 1 / sqrt(px * px + py * py + pz * pz);
      px *= pl; py *= pl; pz *= pl;
      let vx = cx - RS * nx, vy = cy - RS * ny, vz = ZC - RS * nz;
      const vl = 1 / sqrt(vx * vx + vy * vy + vz * vz);
      vx *= vl; vy *= vl; vz *= vl;
      const c = max(0.02, px * vx + py * vy + pz * vz);
      // what the lens mirrors
      const rx = 2 * c * px - vx, ry = 2 * c * py - vy, rz = 2 * c * pz - vz;
      const front = sstep(0.1, 0.5, rx * g.e1x + ry * g.e1y + rz * g.e1z);
      const win = front * box(abs(rx * g.wrx + ry * g.wry + rz * g.wrz), HWD) * box(abs(rx * g.wux + ry * g.wuy + rz * g.wuz), HHT);
      const d2 = rx * g.e2x + ry * g.e2y + rz * g.e2z;
      const lamp = d2 > 0.7 ? exp(-(1 - d2) * 30) : 0;
      const room = 0.5 - 0.5 * ry;
      const halo = exp(-(1 - (rx * g.e1x + ry * g.e1y + rz * g.e1z)) * 5);   // the glow round the window, which lights one side of each lens
      // the bump of the lens: the side of each facet that leans toward the window is brighter
      const bump = 1 + 0.55 * ((px - fjx[key]) * g.e1x + (py - fjy[key]) * g.e1y) / KAP;
      const lit = cl((0.3 + halo * 0.45 + win * 0.9 + lamp * 0.5) * bump, 0, 1.3);
      // thin film: the optical path through the layer falls as the ray tilts away from the lens axis
      const cs = max(0.02, nx * vx + ny * vy + nz * vz);          // the dome's own tilt to the viewer, the lens adds a slice of its own
      const cm = cs + LENSQ * (c - cs);
      const cth = sqrt(max(0.05, 1 - (1 - cm * cm) / 2.1));
      const sig = (nx * ux + ny * uy + nz * uz) + LENSQ * ((px - nx) * ux + (py - ny) * uy + (pz - nz) * uz);
      const Q = fq * sig + fs + 2.6 * (cth - 1) + fth[key];
      const kb = floor(Q), bq = Q - kb;
      const bc = 0.5 - 0.5 * cos(TP * bq);
      const band = 0.1 + 0.9 * bc * sqrt(bc);
      const hh = hue + BH[kb & 3] + 0.1 * (hash2(kb, 3, 11) - 0.5) + (bq - 0.5) * 0.09;
      hsv(hh, SATB, 1, hv);
      const fh = FH[(((hh - floor(hh)) * 256) | 0) & 255];
      const body = sa * band * (0.3 + 0.7 * lit) * fh;
      // the dark patch of facets that look at the viewer, with a bright rim
      const u = 0.7 * fu[key] + 0.3 * (1 - c) * ip2;
      let pf = 1, rimB = 1, rimc = 0, dot = 0;
      if (u < 9) {
        const su = sqrt(u), gp = 1 - sstep(0.4, 1.9, u), ru = (su - 1.45) * 2.8, rim = exp(-ru * ru);
        pf = max(0.03, 1 - pa * gp);
        rimB = 1 + 1.5 * pa * rim * (0.4 + band);
        rimc = rim * pa * 0.45 * fh * (0.2 + 0.8 * band);
        // each lens of the dark patch keeps one dim point where it looks straight at the viewer
        dot = pa * gp * exp(-(1 - c) * 150) * 0.12;
      }
      // a dark rim between facets, soft; the dome darkens toward its limb
      const ge = ein * dl * RS * (0.5 + 0.5 * nz) / gw;
      const gap = (ge < 2.6 ? 1 - 0.78 * exp(-ge * ge) : 1) * (0.45 + 0.55 * sstep(0.2, 0.85, nz));
      const gl = fgl[key], t1 = 1 - c;
      const spec = (win + lamp * 0.5) * gl * (0.78 + 0.22 * t1 * t1) * pf;
      const sheen = (0.5 * halo + 0.35 * room) * max(0.2, bump);
      const k0 = body * pf * rimB + 0.21 * t1 * t1 * t1 * pf * sa + rimc;
      let r = hv[0] * k0 + (0.035 * sheen + 0.3 * dot) * pf;
      let gC = hv[1] * k0 + (0.045 * sheen + 0.3 * dot) * pf;
      let b = hv[2] * k0 + (0.085 * sheen + 0.5 * dot) * pf;
      r = (r + spec * (1 - 0.35 * lamp)) * gap;
      gC = (gC + spec * (0.96 - 0.1 * lamp)) * gap;
      b = (b + spec * (0.86 + 0.14 * lamp)) * gap;
      const q = (y * W + x) * 3;
      buf[q] = r; buf[q + 1] = gC; buf[q + 2] = b;
    }
  }
  // a soft knee: 1 - 1/(1 + ax + (ax)^2/2) follows 1 - exp(-ax) closely and costs no exp
  const A = 2.8;
  for (let i = 0, q = 0; i < W * H; i++, q += 3) {
    const ar = A * buf[q], ag = A * buf[q + 1], ab = A * buf[q + 2];
    display.setPixel(i % W, (i / W) | 0, floor(255 * (1 - 1 / (1 + ar + 0.5 * ar * ar))), floor(255 * (1 - 1 / (1 + ag + 0.5 * ag * ag))), floor(255 * (1 - 1 / (1 + ab + 0.5 * ab * ab))));
  }
}
