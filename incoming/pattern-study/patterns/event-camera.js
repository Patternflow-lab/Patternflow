// ===== Patternflow pattern =====
// Title:   Event Camera
// Family:  eventcam
// Idea:    A model of a dynamic vision sensor watches a hidden scene of two counter-turning spiral wheels and three drifting discs that is never shown, and the panel draws only what its 8192 pixels report, the last event of each pixel in cyan for brighter or crimson for darker and fading from the moment it fired, so every moving edge is a bright line with a comet tail on black.
// Author:  patternflow-lab
// Date:    2026-11-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the dynamic vision sensor pixel, which fires an ON or OFF event with a timestamp when the log intensity has moved by a contrast threshold from its last event (Patrick Lichtsteiner, Christoph Posch and Tobi Delbruck, 2008, recalled), the time surface that shows the age of each pixel's last event with an exponential decay (after Xavier Lagorce, Garrick Orchard, Francesco Galluppi, Bertram Shi and Ryad Benosman, 2017, recalled), the hidden scene is original, pattern round 271
// Round:   271
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Threshold=0.5..4, Speed=-1..1, Memory=-1..1
//
// Knob 1: Hue. Turns both polarity colours round the wheel together, ON at the knob plus half a turn and OFF 0.44 of a turn further on, so brighter edges are cyan and darker ones crimson at 0, violet and yellow-lime at 0.25, red and sea green at 0.5, lime and blue at 0.75. The head of every comet is whitened by up to 40 percent in every hue.
// Knob 2: Threshold. The contrast threshold C of every pixel in natural-log intensity, 0.09 for each unit of the knob: 0.045 at 0.5, 0.18 at the opening 2, 0.36 at 4. At 0.5 the sensor makes 12 events per pixel per second, two thirds of the LEDs are lit and the two weak gratings of the scene wake up as a wash; at 2 it makes 2.6 events and a third are lit; at 4 it makes 1.1 events and only the sharpest arms and the discs speak.
// Knob 3: Speed. How fast the scene runs, 1.9 times 2 to the knob: 0.95 at -1, 1.9 at the opening 0, 3.8 at 1. At the opening the wheels turn at 2.1 and 1.6 radians a second, so an arm of the big one passes a given LED every 0.75 s, and the discs cross the panel at up to 40 LEDs a second. At -1 the sensor still makes 1.2 events per pixel per second; the panel is never blank.
// Knob 4: Memory. The decay time tau of the time surface, 0.1 s times 4.5 to the knob: 22 ms at -1, 0.11 s at the opening 0.06, 0.45 s at 1. At 22 ms only the events of the last frame are lit, a crisp spark on an edge, and 13 percent of the LEDs are on; at 0.45 s every edge drags a tail as long as the scene moves in half a second, and 64 percent are on.

// What the picture is. Each of the 8192 LEDs is a pixel of a dynamic vision sensor. The sensor looks at a scene that is never drawn, and a pixel says nothing while its log intensity stays within a threshold of where it last spoke. When the log intensity has moved by C it fires an ON event if it got brighter or an OFF event if it got darker, with the time it crossed, and moves its reference by C. The panel draws the time surface: for each pixel the polarity of its last event sets the colour, cyan for ON and crimson for OFF at the opening hue, and the age of that event sets the brightness, exp(-age / tau). An edge that moves through the scene leaves a bright leading line where pixels are firing now, and behind it a tail of pixels whose last event was a little longer ago, so the front of a moving disc is a cyan crescent that fades back into the disc and its rear edge a crimson one. Where nothing moves nothing is lit.
// The hidden scene. Its log intensity is ln 0.4 plus the sum of five things. Two spiral wheels with the phase m * angle + b * ln(r + 1.5) minus the turn, r and the angle taken round a moving centre, one with 4 arms turning one way and one with 3 arms turning the other, each cut to a smoothed square wave of height 0.5, so an arm is a step of 1 in ln intensity (a factor 2.7), with edges 2 to 3 LEDs wide 20 LEDs from the centre and twice that at 40. Their centres wander on rates that do not divide, the first over the lower part of the panel and the second over the upper, their windings b swing by 2 and 1.8 and their turn rates by 35 and 30 percent, and each is faded out beyond a radius of 46 or 40 LEDs (give or take 8) and inside a hole of 3 to 13 LEDs round the centre, where its wavelength falls under 11 LEDs and the arms would be finer than the panel. Three discs 9, 8 and 10 LEDs in radius on Lissajous paths, +1.1, -0.9 and +1.0 in ln intensity, with edges 0.85 LED wide. And two weak gratings, wavelengths 26 and 37 LEDs, of height 0.045 and 0.035 in ln intensity, which stay under the threshold at the opening and show only when Threshold is turned below about 1.8. Nothing in it repeats: the wheels, the discs and the gratings run on rates that do not divide, and the winding and turn rates drift.
// The pixel. Eight sub-steps of 4.17 ms a frame, 240 a second. At each the scene is rendered at every LED centre, the input is log(I + 0.05), a first-order low-pass with a 6 ms time constant follows it (the bandwidth of the photoreceptor), and the pixel fires when the filtered value is a threshold C (1 plus 0.03 times a Gaussian, drawn once per pixel, so the mismatch is 3 percent of C) or more away from its reference. A fast edge can cross several thresholds in one sub-step; each moves the reference by C and the time of the last crossing is interpolated inside the sub-step, which is the microsecond stamp the sensor gives. A pixel that has fired cannot fire again for 6 ms; its change waits and shows up in the next event. Background activity: 0.05 events per pixel per second, 70 percent ON, drawn at 0.55 of full brightness and only on pixels that have been silent for 0.4 s.
// What is exact and what is a drawing choice. The pixel model above is the dynamic vision sensor's: the log intensity with an offset, the reference that moves by one threshold at each event, the contrast threshold with mismatch, the refractory time, the low-pass, the noise, and a time surface made from the last timestamp of each pixel. The scene is invented. The refractory period of a real pixel is usually shorter than the 4.17 ms sub-step, so 6 ms is a rounding up of it, and the events are not kept as a list, only the last one of each pixel, as the time surface does. The drawing choices are the colours, the brightness curve (the decay to the power 0.85, so tails read a little brighter), the soft spread of 3 by 3 LEDs (weights 0.25 0.5 0.25 each way, which keeps an edge two LEDs wide instead of a line of single LEDs) and the pale head, a mix toward white of up to 40 percent in the brightest 40 percent.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, atan2, exp, log, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

const SUB = 8;
const DT_SENSOR = 1 / 30;
const TREF = 0.006;
const TLP = 0.006;
const BG = 0.05, BGAMP = 0.55;

// the hidden scene
// two log-spiral wheels, one turning each way, each [arms, winding, winding swing, turn rate,
// centre x (mid, swing, rate, phase, swing 2, rate 2, phase 2), centre y (same), radius (mid, swing, rate, phase)]
const SP = [
  { m: 4, b: 4.5, db: 2, w: 1.1, cx: [32, 22, 0.107, 0.3, 8, 0.0655, 2], cy: [94, 34, 0.083, -0.4, 8, 0.0466, 0], R: [46, 8, 0.061, 0.8] },
  { m: 3, b: 4, db: 1.8, w: -0.85, cx: [32, 22, 0.089, 2.4, 8, 0.0559, 0.5], cy: [34, 34, 0.073, -0.69, 8, 0.0404, 1.7], R: [40, 8, 0.067, 2.9] },
];
// moving discs in log intensity: [x mid, y mid, x swing, y swing, x rate, y rate, x phase, y phase, radius, amplitude]
const BLOBS = [
  [32, 40, 26, 40, 0.341, 0.226, 0.3, 1.1, 9, 1.1],
  [32, 90, 30, 40, 0.203, 0.366, 5.2, 3.3, 8, -0.9],
  [32, 64, 28, 60, 0.453, 0.315, 0.9, 4.4, 10, 1.0],
];
// two weak drifting gratings in log intensity, [wavelength, direction, phase rate, phase, amplitude]
const GR = [
  [26, 1.08, 2.2, 0.7, 0.045],
  [37, -0.41, -3.1, 2.3, 0.035],
];

export function setup(params) {
  const mm = new Float32Array(N);
  for (let i = 0; i < N; i++) mm[i] = 1 + 0.03 * ((Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.7320508);
  const gc = [new Float32Array(N), new Float32Array(N)], gs = [new Float32Array(N), new Float32Array(N)];
  for (let g = 0; g < 2; g++) {
    const kx = (TAU / GR[g][0]) * cos(GR[g][1]), ky = (TAU / GR[g][0]) * sin(GR[g][1]);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const a = kx * (x + 0.5) + ky * (y + 0.5) + GR[g][3];
        gc[g][y * W + x] = cos(a);
        gs[g][y * W + x] = sin(a);
      }
  }
  const wheel = () => ({ c: new Float32Array(N), s: new Float32Array(N), e: new Float32Array(N), ph: 0 });
  params.s = {
    T: 0, ts: 0, k: null, ready: false,
    lf: new Float32Array(N), ref: new Float32Array(N), tl: new Float64Array(N).fill(-100),
    pol: new Int8Array(N), amp: new Float32Array(N), mm, I: new Float32Array(N), lb: new Float32Array(N),
    wh: [wheel(), wheel()], gc, gs,
    fon: new Float32Array(N), foff: new Float32Array(N), t1: new Float32Array(N), t2: new Float32Array(N),
    C: 0.1, tau: 0.15, hue: 0.5, speed: 1,
  };
}

function fillScene(S, Tn) {
  const I = S.I, lb = S.lb, w1 = S.wh[0], w2 = S.wh[1];
  const ca1 = cos(w1.ph), sa1 = sin(w1.ph), ca2 = cos(w2.ph), sa2 = sin(w2.ph);
  const ct1 = cos(GR[0][2] * Tn), st1 = sin(GR[0][2] * Tn), ct2 = cos(GR[1][2] * Tn), st2 = sin(GR[1][2] * Tn);
  const g1c = S.gc[0], g1s = S.gs[0], g2c = S.gc[1], g2s = S.gs[1];
  const a1 = GR[0][4], a2 = GR[1][4];
  const c1 = w1.c, s1 = w1.s, e1 = w1.e, c2 = w2.c, s2 = w2.s, e2 = w2.e;
  for (let p = 0; p < N; p++) {
    let u = 3 * e1[p] * (c1[p] * ca1 + s1[p] * sa1);
    u = u < -1 ? -1 : u > 1 ? 1 : u;
    u = u * (1.5 - 0.5 * u * u);
    let v = 3 * e2[p] * (c2[p] * ca2 + s2[p] * sa2);
    v = v < -1 ? -1 : v > 1 ? 1 : v;
    v = v * (1.5 - 0.5 * v * v);
    lb[p] = 0.5 * (u + v) + a1 * (g1c[p] * ct1 - g1s[p] * st1) + a2 * (g2c[p] * ct2 - g2s[p] * st2);
  }
  for (let b = 0; b < BLOBS.length; b++) {
    const B = BLOBS[b];
    const bx = B[0] + B[2] * sin(B[4] * Tn + B[6]), by = B[1] + B[3] * sin(B[5] * Tn + B[7]);
    const R = B[8], wi = 1 / 0.85, rr = R + 5, amp = B[9];
    const x0 = max(0, floor(bx - rr)), x1 = min(W - 1, floor(bx + rr)), y0 = max(0, floor(by - rr)), y1 = min(H - 1, floor(by + rr));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - by;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - bx, r = sqrt(dx * dx + dy * dy);
        if (r < rr) lb[y * W + x] += amp / (1 + exp((r - R) * wi));
      }
    }
  }
  for (let p = 0; p < N; p++) I[p] = 0.4 * exp(lb[p]);
}

// each wheel's per-frame terms: its centre moves slowly, so the phase of each pixel is fixed within a frame
// and the turn only adds an angle on top of it
function framePhase(S, T) {
  for (let i = 0; i < 2; i++) {
    const Q = SP[i], X = Q.cx, Y = Q.cy, Rr = Q.R, wh = S.wh[i];
    const cx = X[0] + X[1] * sin(X[2] * T + X[3]) + X[4] * sin(X[5] * T + X[6]);
    const cy = Y[0] + Y[1] * sin(Y[2] * T + Y[3]) + Y[4] * sin(Y[5] * T + Y[6]);
    const mb = Q.b + Q.db * sin(0.041 * T + 0.6 + i * 2), mg = sqrt(Q.m * Q.m + mb * mb), R = Rr[0] + Rr[1] * sin(Rr[2] * T + Rr[3]);
    const c = wh.c, s = wh.s, e = wh.e;
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - cy;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx, p = y * W + x;
        const r = sqrt(dx * dx + dy * dy);
        const f = Q.m * atan2(dy, dx) + mb * log(r + 1.5);
        c[p] = cos(f);
        s[p] = sin(f);
        const lam = (TAU * (r + 1.5)) / mg;
        e[p] = sm((lam - 6) / 5) * sm((R - r) / 16);
      }
    }
  }
}

function stepFrame(S, d) {
  const dsub = d / SUB, dT = (d * S.speed) / SUB, C = S.C;
  const al = 1 - exp(-dsub / TLP);
  framePhase(S, S.T);
  const lf = S.lf, ref = S.ref, tl = S.tl, pol = S.pol, amp = S.amp, mm = S.mm, I = S.I;
  for (let k = 0; k < SUB; k++) {
    const t0 = S.ts + k * dsub, t1 = t0 + dsub, Tn = S.T + (k + 1) * dT;
    S.wh[0].ph += SP[0].w * (1 + 0.35 * sin(0.157 * Tn + 1)) * dT;
    S.wh[1].ph += SP[1].w * (1 + 0.3 * sin(0.113 * Tn + 2.2)) * dT;
    fillScene(S, Tn);
    for (let p = 0; p < N; p++) {
      const Lr = log(I[p] + 0.05), a = lf[p], b = a + al * (Lr - a);
      lf[p] = b;
      const dd = b - ref[p], th = C * mm[p];
      if (dd >= th || dd <= -th) {
        if (t1 - tl[p] >= TREF) {
          const sg = dd > 0 ? 1 : -1, n = floor((sg * dd) / th), e0 = sg * (a - ref[p]), dl = sg * (b - a);
          let f = dl > 1e-9 ? (n * th - e0) / dl : 1;
          f = f < 0 ? 0 : f > 1 ? 1 : f;
          tl[p] = t0 + f * dsub;
          pol[p] = sg;
          amp[p] = 1;
          ref[p] += sg * n * th;
        }
      }
    }
  }
  S.T += d * S.speed;
  S.ts += d;
  // background activity: a few pixels fire for no reason, mostly ON, and faintly
  const nb = floor(BG * N * d + Math.random());
  for (let i = 0; i < nb; i++) {
    const p = (Math.random() * N) | 0;
    if (S.ts - tl[p] < 0.4) continue;
    tl[p] = S.ts - Math.random() * d;
    pol[p] = Math.random() < 0.7 ? 1 : -1;
    amp[p] = BGAMP;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) S.k = [kv[0], kv[1], kv[2], kv[3]];
  const al = 1 - exp(-d / 0.1);
  for (let i = 0; i < 4; i++) S.k[i] += (kv[i] - S.k[i]) * al;
  const k = S.k;
  S.C = 0.09 * cl(k[1], 0.5, 4);
  S.speed = 1.9 * 2 ** cl(k[2], -1, 1);
  S.tau = 0.1 * 4.5 ** cl(k[3], -1, 1);
  S.hue = k[0] + 0.5;
  if (!S.ready) {
    S.ready = true;
    framePhase(S, 0);
    fillScene(S, 0);
    for (let p = 0; p < N; p++) {
      const L = log(S.I[p] + 0.05);
      S.lf[p] = L;
      S.ref[p] = L;
    }
    for (let i = 0; i < 45; i++) stepFrame(S, DT_SENSOR);
  }
  stepFrame(S, d);
}

const cOn = [0, 0, 0], cOff = [0, 0, 0];

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { tl, pol, amp, fon, foff, t1, t2 } = S, tau = S.tau, ts = S.ts;
  for (let p = 0; p < N; p++) {
    const age = ts - tl[p];
    const v = age < 8 * tau ? amp[p] * exp(-age / tau) : 0;
    if (pol[p] > 0) {
      fon[p] = v;
      foff[p] = 0;
    } else {
      fon[p] = 0;
      foff[p] = v;
    }
  }
  blur(fon, t1);
  blur(foff, t2);
  hsv(S.hue, 0.9, 1, cOn);
  hsv(S.hue + 0.44, 0.9, 1, cOff);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let R = 0, G = 0, B = 0;
      for (let q = 0; q < 2; q++) {
        const v = q ? foff[p] : fon[p];
        if (v < 0.004) continue;
        const g = v > 1 ? 1 : v ** 0.85, wt = 0.4 * sm((v - 0.6) / 0.4), c = q ? cOff : cOn;
        R += g * (c[0] + (1 - c[0]) * wt);
        G += g * (c[1] + (1 - c[1]) * wt);
        B += g * (c[2] + (1 - c[2]) * wt);
      }
      display.setPixel(x, y, cl(R * 255, 0, 255) | 0, cl(G * 255, 0, 255) | 0, cl(B * 255, 0, 255) | 0);
    }
}

// a small soft spread, in place through a scratch buffer
function blur(f, t) {
  const a = 0.25, c = 1 - 2 * a;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      t[p] = f[p] * c + a * ((x > 0 ? f[p - 1] : f[p]) + (x < W - 1 ? f[p + 1] : f[p]));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      f[p] = t[p] * c + a * ((y > 0 ? t[p - W] : t[p]) + (y < H - 1 ? t[p + W] : t[p]));
    }
}
