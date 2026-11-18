// ===== Patternflow pattern =====
// Title:   Recaman's Sequence
// Family:  line
// Idea:    Recaman's sequence climbs a vertical number line one term at a time, each step n drawn as a semicircle of diameter n between the old term and the new one, bulging right when n was added and left when n was taken away (which happens only when the result is above zero and not yet in the sequence), while the picture zooms out so every arc stays on the panel, the newest arc is white and older ones fade to a texture, and the values visited glow on the line so the dark gaps are the numbers not met yet.
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Recaman's sequence (Bernardo Recaman Santos; named and studied by N. J. A. Sloane, OEIS A005132, 1991, year from memory), drawn as semicircular arcs on a number line; pattern round 111
// Round:   111
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..6, Terms=60..160, Fade=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the arcs of an addition are azure and the arcs of a subtraction are rose, the newest arc and the pen are white and the visited values on the line are pale azure. Orange and yellow are made paler so they do not dim to brown.
// Knob 2: Speed. How fast the terms come, 2 terms a second for each unit: 4 a second at 2 (a 60 term run takes 15 s), 1 a second at 0.5 and 12 a second at 6. Each arc is drawn over its own term with an ease. After the last term the pen goes back over all of them in 3 s, the picture rests 1.2 s, goes out in 0.8 s and the run starts again.
// Knob 3: Terms. How many terms a run draws, 60 to 160, a whole number. The camera zooms out to keep the biggest arc under 60 LEDs across and the highest value on the panel, and it is set for the run's end: it never stands closer than 7 times the scale the last term needs. At 60 the terms reach 114, the picture ends at 1 LED a unit and the first arcs are drawn at 7; at 160 the largest value is 495, the last scale is 0.24 LEDs a unit and the first arcs are drawn at 1.7.
// Knob 4: Fade. How long an arc stays bright. At 0 a new arc settles towards its faint texture with a time constant of 2 terms, the texture is 20 percent bright and only the newest 3 terms are 2 LEDs wide; at 1 the time constant is 42 terms, the texture is 85 percent bright and every arc is 2 LEDs wide, so the whole history stays lit. Where it opens, at 0.06, the time constant is 4.4 terms and the texture 24 percent.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sin, cos, exp, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow come out lighter and paler.
function tint(h, s, v, out) {
  const hh = fr(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.5 + 0.5 * v;
    s *= 0.55;
  }
  hsv(hh, s, v, out);
}

const NSEQ = 160; // the most terms the Terms knob can ask for
const AX = 32; // the number line is the seam between columns 31 and 32
const Y0 = 124; // the row of the value 0; larger values stand higher
const SMAX = 9; // LEDs to a unit while the picture is still small
const CAP = 7; // the camera never stands closer than this times the scale the last term needs
const RT = 3; // seconds the replay takes
const HOLD = 1.2; // seconds the finished picture rests after the replay
const FADE = 0.8; // seconds it takes to go out

// Recaman: a(0) = 0 and a(n) = a(n-1) - n if that is above zero and not yet
// in the sequence, otherwise a(n-1) + n. seen[] marks the values used.
function recaman(n) {
  const a = new Int32Array(n + 1);
  const seen = new Uint8Array((n * (n + 1)) / 2 + 2);
  seen[0] = 1;
  for (let i = 1; i <= n; i++) {
    const down = a[i - 1] - i;
    a[i] = down > 0 && !seen[down] ? down : a[i - 1] + i;
    seen[a[i]] = 1;
  }
  return a;
}

export function setup(params) {
  const seq = recaman(NSEQ);
  // pmax[m]: the largest value among the first m + 1 terms, which with the
  // step m itself sets how far the picture must zoom out to hold them.
  const pmax = new Int32Array(NSEQ + 1);
  for (let i = 0; i <= NSEQ; i++) pmax[i] = max(i ? pmax[i - 1] : 0, seq[i]);
  params.s = {
    seq, pmax,
    hue: 0, speed: 2, N: 60, fade: 0.06,
    P: 0, ph: 0, tm: 0, gain: 1, ls: 0, init: true,
    buf: new Float32Array(W * H * 3),
    mark: new Uint8Array(H),
  };
}

// How far the picture must be zoomed out for the first m steps: the largest
// arc (diameter m) within 60 LEDs, the highest value within 120 rows.
function target(S, m) {
  const fit = (n) => min(60 / max(1, n), 120 / max(1, S.pmax[n]));
  return min(SMAX, CAP * fit(S.N), fit(m));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 60, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 6);
  S.N = cl(round(k[2]), 60, NSEQ);
  S.fade = cl(k[3], 0, 1);
  const N = S.N;
  if (S.init) {
    S.ls = log(target(S, 2));
    S.init = false;
  }
  if (S.ph === 0) {
    S.P = min(N, S.P + d * 2 * S.speed);
    if (S.P >= N) {
      S.ph = 1;
      S.tm = 0;
    }
  } else if (S.ph === 1) {
    S.tm += d;
    if (S.tm >= RT + HOLD) {
      S.ph = 2;
      S.tm = 0;
    }
  } else {
    S.tm += d;
    S.gain = 1 - sm(S.tm / FADE);
    if (S.tm >= FADE) {
      S.ph = 0;
      S.P = 0;
      S.tm = 0;
      S.gain = 1;
      S.ls = log(target(S, 2));
    }
  }
  // The camera looks one term ahead, so it is already moving when the next
  // arc starts.
  const m = S.ph === 0 ? min(N, floor(S.P) + 2) : N;
  S.ls += (log(target(S, m)) - S.ls) * (1 - exp(-d * 5));
}

// How bright a glow is that is `age` terms old.
function glow(age, lo, tau) {
  return lo + (1 - lo) * exp(-max(0, age) / tau);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, seq = S.seq, N = S.N, s = exp(S.ls);
  buf.fill(0);
  const lo = 0.2 + 0.65 * S.fade, tau = 2 + 40 * S.fade, thickAge = 3 + 200 * S.fade * S.fade;

  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    const r = c[0] * a, g = c[1] * a, b = c[2] * a;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  const yOf = (v) => Y0 - v * s;

  // Colours: an addition azure, a subtraction rose, the pen and the newest arc white.
  const hb = 0.55 + S.hue;
  const CADD = [0, 0, 0], CSUB = [0, 0, 0], PALE = [0, 0, 0];
  tint(hb, 0.85, 1, CADD);
  tint(hb + 0.38, 0.85, 1, CSUB);
  tint(hb, 0.2, 1, PALE);

  // Where the picture stands. In a run the terms up to nC are done and arc q
  // is being drawn, f of the way round. In the replay all N are done and the
  // pen goes back over them in order, R terms in.
  let nC, q = 0, f = 0, R = N;
  if (S.ph === 0) {
    nC = floor(S.P);
    if (nC < N) {
      q = nC + 1;
      f = S.P - nC;
    }
  } else {
    nC = N;
    if (S.ph === 1) {
      R = N * cl(S.tm / RT, 0, 1);
      if (R < N) {
        q = floor(R) + 1;
        f = R - floor(R);
      }
    }
  }
  const now = S.ph === 0 ? S.P : N;
  // The replay's glow takes over from the run's over its first 0.3 s.
  const rho = S.ph === 1 ? sm(S.tm / 0.3) : 0;

  // The arc of term k, from a(k-1) to a(k), drawn from angle 0 to phi.
  const arc = (kk, phi, c, a, thick) => {
    const A = seq[kk - 1], B = seq[kk], side = B > A ? 1 : -1;
    const yA = yOf(A), cy = (yA + yOf(B)) / 2, r = (abs(B - A) * s) / 2;
    const n = ceil(PI * r * 2) + 3;
    for (let i = 0; i <= n; i++) {
      const p = (phi * i) / n, x = AX + side * r * sin(p), y = cy + (yA - cy) * cos(p);
      const px = side > 0 ? floor(x) : ceil(x) - 1, py = floor(y);
      put(px, py, c, a);
      if (thick) put(px + side, py, c, a * 0.6);
    }
  };
  const col = [0, 0, 0];
  for (let kk = 1; kk <= nC; kk++) {
    const base = seq[kk] > seq[kk - 1] ? CADD : CSUB;
    let b = glow(now - kk, lo, tau), age = now - kk;
    if (S.ph === 1) {
      const br = kk > R + 1 ? lo : glow(R - kk, lo, tau);
      b += (br - b) * rho;
      age = R - kk;
    }
    // The newest arcs are whitened.
    const w = age < 4 && age > -1 ? 0.75 * exp(-max(0, age) / 0.8) : 0;
    col[0] = base[0] + (1 - base[0]) * w;
    col[1] = base[1] + (1 - base[1]) * w;
    col[2] = base[2] + (1 - base[2]) * w;
    arc(kk, PI, col, b, age < thickAge && age > -1);
  }
  let tipX = AX, tipY = yOf(seq[min(nC, N)]);
  if (q) {
    const e = PI * sm(f), A = seq[q - 1], B = seq[q], side = B > A ? 1 : -1;
    arc(q, e, [1, 1, 1], 1, true);
    const yA = yOf(A), cy = (yA + yOf(B)) / 2, r = (abs(B - A) * s) / 2;
    tipX = AX + side * r * sin(e);
    tipY = cy + (yA - cy) * cos(e);
  }

  // The values visited, lit on the line two LEDs wide; a dark row is a value
  // (or, below one LED a unit, a run of values) not met yet.
  const mk = S.mark;
  mk.fill(0);
  for (let i = 0; i <= nC; i++) mk[cl(floor(yOf(seq[i])), 0, H - 1)] = 1;
  for (let y = 0; y < H; y++)
    if (mk[y]) {
      put(AX - 1, y, PALE, 0.6);
      put(AX, y, PALE, 0.6);
    }
  // The pen: a white dot with a halo, on the end of the arc being drawn.
  const hx = floor(tipX), hy = floor(tipY), WHITE = [1, 1, 1];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const dd = Math.hypot(hx + dx + 0.5 - tipX, hy + dy + 0.5 - tipY);
      put(hx + dx, hy + dy, WHITE, cl(1.3 - dd * 0.6, 0, 1));
    }

  const g = S.gain;
  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255 * g), min(255, buf[p * 3 + 1] * 255 * g), min(255, buf[p * 3 + 2] * 255 * g));
}
