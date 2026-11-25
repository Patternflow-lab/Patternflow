// ===== Patternflow pattern =====
// Title:   Wagon Wheel
// Family:  strobe
// Idea:    Three spoked neon wheels with five, eight and thirteen spokes spin at the same true speed under one strobe that only takes a picture a few times a second and holds it, so the wheels seem to creep forward, stand dead still or run backward, each in turn and each differently, while the true speed wanders and the shutter, opened longer, smears the spokes into ghost fans and then into a plain disc.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the wagon-wheel effect, a wheel whose spokes seem to turn slowly, stand still or run backward when it is seen only at fixed instants (Peter Mark Roget, 1825, through vertical slats; the stroboscopic form studied by Michael Faraday, 1831, and Joseph Plateau, 1832; in the language of sampling, aliasing, after Harry Nyquist, 1928); the exposure is the spoke profile averaged over the angle swept while the shutter is open, an exact periodic box convolution; the three wheels that share one true speed but not one spoke count, the wandering speed, the strobe tick, the stop-motion hold and the colours are original, pattern round 255
// Round:   255
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0..4, Shutter=0..1, Spin=-1..1
//
// Knob 1: Hue. Turns the three neon colours round the wheel; at the start the wheels are cyan, magenta and gold, and each colour also drifts on its own slow clock, a full turn of the wheel taking a minute or more.
// Knob 2: Rate. 0 to 4, opening at 2. How often the strobe takes a picture, on a log scale from 4 a second at 0 through about 11 at the start to 30 at 4; the picture is held until the next one, so a low rate steps and a high rate glides, and every wheel's standstill speed moves with it.
// Knob 3: Shutter. 0 to 1, opening at 0. How long the strobe stays open, as a share of the time between pictures: at 0 every picture is a crisp instant, at 0.5 the spokes of a fast wheel smear into ghost fans, at 1 a wheel that turns more than a spoke gap per picture washes out into a plain disc.
// Knob 4: Spin. -1 to 1, opening at about 0.06. The true speed of all three wheels at once, on a log scale from 0.28 times at -1 through 1.1 times at the start to 3.6 times at 1 (about one turn a second at the start); it wanders on its own the whole time, so each wheel in turn crosses its own standstill speed and turns round.

const W = 64, H = 128;
const CX = 32;
const CY = [21, 64, 107];            // wheel centres
const NS = [5, 8, 13];               // spokes per wheel
const WH = [1.38, 1.22, 1.06];       // half width of a spoke in LED
const R = 19.2;                      // outer radius of the rim
const RIMW = 2.0;                    // width of the rim
const RHUB = 4.6;                    // radius of the hub disc
const HUE0 = [0.52, 0.83, 0.14];     // cyan, magenta, gold at Hue = 0
const { floor, min, max, abs, sqrt, exp, sin, pow, atan2, asin, tanh, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const rnd = () => Math.random();

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// yellow and green are dimmed toward blue so that no wheel outshines the others
const FH = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  hsv(i / 256, 0.85, 1, hv);
  FH[i] = min(1.12, pow(0.62 / (0.299 * hv[0] + 0.587 * hv[1] + 0.114 * hv[2]), 0.75));
}
const lum = (h) => FH[floor((h - floor(h)) * 256) & 255];

const NR = 120;                      // radial steps of the colour table, a quarter LED each

export function setup(params) {
  // the swings of the true speed are set so that the wheels open with one creeping forward, one
  // creeping back and one standing still: at the opening rate that is a speed of 0.74 to 0.85
  let p;
  for (let tries = 0; tries < 400; tries++) {
    p = [rnd() * TP, rnd() * TP, rnd() * TP, rnd() * TP];
    const w = wander(p, 2.5);
    if (w > 0.74 && w < 0.85) break;
  }
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false, tau: 0, p,
    ph: rnd(), th: rnd(), S: 0, thS: rnd(), SK: 0.1,
    q: Array.from({ length: 48 }, () => rnd() * TP),
    hue: [0, 0, 0], thick: [1, 1, 1], gain: [1, 1, 1], hub0: [0, 0, 0], hub1: [0, 0, 0], rimh: [0, 0, 0], vivid: [1, 1, 1], glow: [1, 1, 1], hubs: [1, 1, 1], sx: [0, 0, 0], sy: [0, 0, 0], rs: [1, 1, 1], rg: [1, 1, 1], rw: [1, 1, 1], hg: [1, 1, 1], sw: new Float64Array(45), sw0: new Float64Array(45),
    spoke: new Float32Array(3 * NR * 3), hub: new Float32Array(9), rim: new Float32Array(9), halo: new Float32Array(9),
    flash: 1, buf: new Float32Array(W * H * 3),
  });
  return st;
}

// the true speed of the wheels in turns a second at Spin = 1: never constant, never a cycle
function wander(p, tau) {
  return 1 + 0.34 * sin(TP * 0.0173 * tau + p[0]) + 0.24 * sin(TP * 0.0391 * tau + p[1])
    + 0.13 * sin(TP * 0.0911 * tau + p[2]) + 0.10 * sin(TP * 0.0071 * tau + p[3]);
}

// 48 slow clocks, none a simple multiple of another: the golden ratio spreads them. The ones that
// turn the colour of a wheel run at 0.007 to 0.02 Hz, the ones that shift a hue along a wheel or
// move it run at 0.012 to 0.034 Hz, the ones that only change how bright or thick something is at
// 0.025 to 0.07 Hz
const FQ = Array.from({ length: 48 }, (_, k) => {
  const g = (k * 0.6180339887 + 0.31) % 1, c = k % 15;
  return c === 0 ? 0.007 + 0.013 * g : [1, 2, 3, 9, 10].includes(c) ? 0.012 + 0.022 * g : 0.025 + 0.045 * g;
});
// each is two swings of its clock, -1 to 1
function swing(st, k) {
  return 0.62 * sin(TP * FQ[k] * st.tau + st.q[k]) + 0.38 * sin(TP * FQ[k] * 1.6180339887 * st.tau + st.q[(k * 7 + 3) % 48]);
}

// one step of the strobe: the true angle runs on, and each time the strobe fires the angle
// at that very instant and the angle swept since the last time are written down
function stepSim(st, dt, f, spin) {
  const w = wander(st.p, st.tau + dt * 0.5);
  st.tau += dt;
  let remTh = spin * w * dt;           // turns this step
  let remPh = f * dt;                  // strobe periods this step
  let ph = st.ph;
  let guard = 0;
  while (remPh > 0 && ph + remPh >= 1 && guard++ < 40) {
    const need = 1 - ph;
    const part = need / remPh;
    const dth = remTh * part;
    st.S += dth;
    st.th = (st.th + dth) % 1;
    st.thS = st.th;
    st.SK = st.S;
    st.S = 0;
    remTh -= dth;
    remPh -= need;
    ph = 0;
  }
  st.th = (st.th + remTh) % 1;
  if (st.th < 0) st.th += 1;
  st.S += remTh;
  st.ph = ph + remPh;
  if (st.ph >= 1) st.ph = 0.999999;
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // a few strobe pictures are taken before the first frame, so the first frame has one to hold
    st.tau = 0;
    for (let n = 0; n < 150; n++) stepSim(st, 1 / 60, 4 * pow(7.5, cl(st.ks[1], 0, 4) / 4), pow(3.6, cl(st.ks[3], -1, 1)));
    for (let k = 0; k < 45; k++) st.sw0[k] = swing(st, k);
  } else {
    const a = 1 - exp(-dt / 0.12);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  const k1 = st.ks[0], k2 = cl(st.ks[1], 0, 4), k3 = cl(st.ks[2], 0, 1), k4 = cl(st.ks[3], -1, 1);
  const f = 4 * pow(7.5, k2 / 4);
  const spin = pow(3.6, k4);
  if (dt > 0) stepSim(st, dt, f, spin);
  st.e = k3;

  // the look of each wheel wanders from the way it opened on fifteen clocks of its own that never
  // line up: its hue, where the hue sits at the hub end and at the rim end of a spoke and on the
  // rim, how vivid and how bright it is, how thick the spokes are, how much it glows, how big the
  // hub is and where the wheel sits
  const sw = st.sw;
  for (let k = 0; k < 45; k++) sw[k] = swing(st, k) - st.sw0[k];
  for (let i = 0; i < 3; i++) {
    const c = i * 15;
    st.hue[i] = k1 + HUE0[i] + 0.28 * sw[c];
    st.hub0[i] = -0.03 + 0.15 * sw[c + 1];
    st.hub1[i] = 0.05 + 0.15 * sw[c + 2];
    st.rimh[i] = 0.05 + 0.14 * sw[c + 3];
    st.vivid[i] = cl(1 + 0.13 * sw[c + 4], 0.82, 1.1);
    st.gain[i] = 1 - 0.42 * min(1, 1.1 * sw[c + 5] * sw[c + 5]);
    st.thick[i] = cl(1 + 0.4 * sw[c + 6], 0.65, 1.45);
    st.glow[i] = cl(1 + 0.7 * sw[c + 7], 0.25, 1.9);
    st.hubs[i] = cl(1 + 0.4 * sw[c + 8], 0.6, 1.5);
    st.sx[i] = 8 * tanh(5.5 * sw[c + 9] / 8);
    st.sy[i] = 2.2 * tanh(1.7 * sw[c + 10] / 2.2);
    st.rs[i] = 1 - 0.14 * min(1, 1.2 * sw[c + 11] * sw[c + 11]);
    st.rg[i] = 1 - 0.42 * min(1, 1.1 * sw[c + 12] * sw[c + 12]);
    st.rw[i] = cl(1 + 0.3 * sw[c + 13], 0.7, 1.4);
    st.hg[i] = 1 - 0.35 * min(1, 1.1 * sw[c + 14] * sw[c + 14]);
  }
  // the strobe tick: the whole wheel is a little brighter while the picture is new
  st.flash = 1 + 0.10 * (1 - sstep(0.2, 0.42, st.ph));
  buildColours(st);
}

function buildColours(st) {
  const o = hv;
  for (let i = 0; i < 3; i++) {
    const h = st.hue[i], a0 = st.hub0[i], a1 = st.hub1[i], vv = st.vivid[i];
    const lv = lum(h) * st.gain[i] * 1.02;
    for (let ri = 0; ri < NR; ri++) {
      const uu = cl(ri * 0.25 / R, 0, 1);                 // 0 at the hub, 1 at the rim
      hsv(h + a0 + (a1 - a0) * uu, (0.5 + 0.43 * uu) * vv, min(1, lv), o);
      const b = (i * NR + ri) * 3;
      st.spoke[b] = o[0]; st.spoke[b + 1] = o[1]; st.spoke[b + 2] = o[2];
    }
    hsv(h + a0, 0.42 * vv, min(1, 1.03 * lv * st.hg[i]), o);
    st.hub[i * 3] = o[0]; st.hub[i * 3 + 1] = o[1]; st.hub[i * 3 + 2] = o[2];
    hsv(h + st.rimh[i], 0.9 * vv, min(1, 0.98 * lv * st.rg[i]), o);
    st.rim[i * 3] = o[0]; st.rim[i * 3 + 1] = o[1]; st.rim[i * 3 + 2] = o[2];
    hsv(h + 0.5 * (a0 + a1), 0.95 * vv, min(1, 0.87 * lv), o);
    st.halo[i * 3] = o[0]; st.halo[i * 3 + 1] = o[1]; st.halo[i * 3 + 2] = o[2];
  }
}

// the area of a spoke's soft profile up to angle y, one spoke centred on 0 (half width h, edge s)
function prim(y, h, s) {
  if (y <= -h - s) return 0;
  if (y < -h + s) { const q = y + h + s; return q * q / (4 * s); }
  if (y <= h - s) return y + h;
  if (y < h + s) { const q = h + s - y; return 2 * h - q * q / (4 * s); }
  return 2 * h;
}
// the same for a train of spokes a period P apart
function cum(y, h, s, P) {
  const n = floor(y / P + 0.5);
  return n * 2 * h + prim(y - n * P, h, s);
}
// what a pixel at angle x from the spoke sees when the wheel turns through L during the exposure
function expo(x, L, h, s, P) {
  if (h >= P * 0.5) return 1;
  if (h + s > P * 0.5) s = P * 0.5 - h;
  if (s < 1e-5) s = 1e-5;
  if (abs(L) < 1e-5) {
    const n = floor(x / P + 0.5);
    const y = x - n * P;
    return cl((h - abs(y)) / (2 * s) + 0.5, 0, 1);
  }
  return cl((cum(x + L, h, s, P) - cum(x, h, s, P)) / L, 0, 1);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  const buf = st.buf;
  buf.fill(0);
  const e = st.e || 0;
  const fl = st.flash;
  for (let wi = 0; wi < 3; wi++) {
    const cx = CX + st.sx[wi], cy = CY[wi] + st.sy[wi], N = NS[wi], P = TP / N;
    const th = st.thS * TP;                     // where the strobe left the wheel
    const L = e * st.SK * TP;                   // the angle swept while the shutter was open
    const wh = WH[wi] * st.thick[wi];
    const gl = st.glow[wi], rh = RHUB * st.hubs[wi], Rw = R * st.rs[wi], rimw = RIMW * st.rw[wi];
    const sr = st.spoke, hubc = st.hub, rimc = st.rim, haloc = st.halo;
    const x0 = max(0, floor(cx - Rw - 5)), x1 = min(W - 1, floor(cx + Rw + 5));
    const y0 = max(0, floor(cy - Rw - 5)), y1 = min(H - 1, floor(cy + Rw + 5));
    const off = wi * 0.7;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const r = sqrt(dx * dx + dy * dy);
        if (r > Rw + 5) continue;
        let cr = 0, cg = 0, cb = 0;
        const ri = min(NR - 1, floor(r * 4));
        const bi = (wi * NR + ri) * 3;
        // spokes
        if (r > 1.5 && r < Rw - 0.5) {
          const rad = sat1(r - 1.0) * sat1(Rw - 0.5 - r);
          const phi = atan2(dy, dx) - th - off;
          const h = r > wh ? asin(wh / r) : PI * 0.5;
          const s = min(0.5 / r, 0.3);
          const cov = expo(phi, L, h, s, P);
          const hh = r > wh + 1.2 ? asin((wh + 1.2) / r) : PI * 0.5;
          const sh = min(1.4 / r, 0.5);
          const hal = expo(phi, L, hh, sh, P);
          const bodyA = cov * rad;
          const haloA = hal * rad * 0.22 * gl;
          // the halo sits under the body
          const ra = sr[bi], ga = sr[bi + 1], ba = sr[bi + 2];
          const hr = haloc[wi * 3], hg = haloc[wi * 3 + 1], hb = haloc[wi * 3 + 2];
          cr = 1 - (1 - hr * haloA) * (1 - ra * bodyA);
          cg = 1 - (1 - hg * haloA) * (1 - ga * bodyA);
          cb = 1 - (1 - hb * haloA) * (1 - ba * bodyA);
        }
        // rim and its glow
        {
          const ring = sat1(r - (Rw - rimw) + 0.5) * sat1(Rw - r + 0.5);
          let g = 0;
          if (r > Rw) g = 0.34 * gl * exp(-(r - Rw + 0.5) / 1.7);
          else if (r < Rw - rimw) g = 0.24 * gl * exp(-(Rw - rimw - r) / 2.0);
          const a = max(ring, g);
          const rr = rimc[wi * 3], rg = rimc[wi * 3 + 1], rb = rimc[wi * 3 + 2];
          cr = 1 - (1 - cr) * (1 - rr * a);
          cg = 1 - (1 - cg) * (1 - rg * a);
          cb = 1 - (1 - cb) * (1 - rb * a);
        }
        // hub and its glow
        if (r < rh + 4) {
          const disc = sat1(rh - r + 0.5);
          const g = r > rh ? 0.32 * exp(-(r - rh) / 1.5) : 0;
          const pip = 1 - 0.85 * sat1(1.3 - r + 0.5);
          const a = max(disc * pip, g);
          const hr = hubc[wi * 3], hg = hubc[wi * 3 + 1], hb = hubc[wi * 3 + 2];
          cr = 1 - (1 - cr) * (1 - hr * a);
          cg = 1 - (1 - cg) * (1 - hg * a);
          cb = 1 - (1 - cb) * (1 - hb * a);
          if (disc > 0) {
            // the axle hole is dark
            const hole = sat1(1.3 - r + 0.5);
            cr *= 1 - 0.8 * hole; cg *= 1 - 0.8 * hole; cb *= 1 - 0.8 * hole;
          }
        }
        const b = (y * W + x) * 3;
        buf[b] = 1 - (1 - buf[b]) * (1 - cr * fl);
        buf[b + 1] = 1 - (1 - buf[b + 1]) * (1 - cg * fl);
        buf[b + 2] = 1 - (1 - buf[b + 2]) * (1 - cb * fl);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b = (y * W + x) * 3;
      display.setPixel(x, y, cl(floor(buf[b] * 255 + 0.5), 0, 255), cl(floor(buf[b + 1] * 255 + 0.5), 0, 255), cl(floor(buf[b + 2] * 255 + 0.5), 0, 255));
    }
  }
}

function sat1(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
