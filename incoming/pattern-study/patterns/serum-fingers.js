// ===== Patternflow pattern =====
// Title:   Serum Fingers
// Family:  cosmetic
// Idea:    A thin bright serum is pressed in through a slot along the bottom of a layer of thick pale cream between two glass plates and pushes up through it in rounded fingers that bulge, split and compete, two or three leaders racing for the top while the rest stall, each LED turning from cream to serum once as a finger reaches it; when a finger reaches the top the cream closes back over the fingers, thin ones first, and a new press begins.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 38, after a thin serum pressed into thick cream between two glass plates (Saffman-Taylor viscous fingering, Philip Saffman and Geoffrey Taylor, 1958, in a Hele-Shaw cell, Henry Selby Hele-Shaw, 1898)
// Round:   38
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Fingers=-1..1, Inlet=0..1
//
// Knob 1: Hue. Turns the serum round the whole wheel, the cream a faint tint of the opposite hue. At 0 aqua serum on warm grey cream; at 0.1 azure, at 0.2 violet, at 0.3 orchid, at 0.4 rose, at 0.5 coral, at 0.6 orange, at 0.7 lime, at 0.8 green, at 0.9 jade, each on cream tinted the other way. Faint growth rings in the serum, paler bands between deeper ones 12% dimmer, show where the front stood after every 300 LEDs pressed in.
// Knob 2: Speed. At 2 the serum goes in at 580 LEDs of area a second and a finger reaches the top 9 to 11 seconds into a press; the cell then holds for 1.5 seconds and the cream closes back over 3. At 0.2 all of it ten times slower, the fingers only climbing; at 3 one and a half times faster.
// Knob 3: Fingers. Surface tension, 9 times higher at -1 than at 1. At -1 the lip of the slot carries 3 waves and three fat round fingers rise side by side and seldom split; at 0 six waves, of which two or three fingers win, bulge and split into lobes; at 1 twelve thin fingers, one of which takes off with ragged sides and reaches the top about 2 seconds sooner. The waves of the lip change at the next press.
// Knob 4: Inlet. Where the serum comes in. Up to 0.06 a slot along the whole bottom; toward 1 the slot narrows to a half disc 5 LEDs across at the bottom centre and the serum rises from it as one broad plume whose sides bulge into lobes. Takes effect at the next press.
// Buttons: K1 tap: the cream closes back now and a new press begins.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, cos, exp, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// Serum pressed in, in LEDs of area a second at Speed 2.
const Q0 = 580;
// A fresh run opens with the first PRE seconds of a press already in.
const PRE = 0.6;
// The cream gives way at a front LED as the pressure drop across it to the
// power ETA, times the roughness of the glass there, times 1 + SIG phi, where
// phi is how much more of the disc round it is serum than at a flat front:
// below 0 at a fingertip, which is held back, above 0 in a crevice, which is
// filled up to CAP times faster. That is the surface tension that keeps the
// fingers round. SIG is for Fingers 0.
const ETA = 0.7, SIG = 2, CAP = 1.6;
// Gauss-Seidel sweeps of the pressure each frame, over-relaxed.
const SWEEPS = 12, OMEGA = 1.9;
// The disc the curvature is read over: cells within RC of a front cell. A
// flat front fills PHI0 of it with serum.
const RC = 3.2;
const DISC = [];
for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= RC * RC) DISC.push(dx, dy);
let PHI0 = 0;
{
  let a = 0, b = 0;
  for (let k = 0; k < DISC.length; k += 2) {
    b++;
    if (DISC[k + 1] < 0) a++;
  }
  PHI0 = a / b;
}
// Opening hue: aqua serum.
const H0 = 0.5;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, fingers: 0, inlet: 0, sigma: SIG, begun: false,
    st: new Uint8Array(N), fill: new Float32Array(N), P: new Float32Array(N),
    eta: new Float32Array(N), phi: new Float32Array(N), band: new Float32Array(N), fill0: new Float32Array(N), dist: new Float32Array(N),
    seed: new Uint8Array(N), tex: new Float32Array(N), front: new Int32Array(N), nf: 0,
    vol: 0, mode: 0, timer: 0, maxd: 1,
    A: new Float32Array(4 * N), T: new Float32Array(4 * N), ser: [0, 0, 0], pale: [0, 0, 0], cream: [0, 0, 0],
  };
  const S = params.s;
  // The cream's own static mottle, a few soft lumps.
  const lumps = [];
  for (let k = 0; k < 14; k++) lumps.push([random() * W, random() * H, 6 + random() * 14, random() - 0.5]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (const [lx, ly, r, a] of lumps) v += a * exp(-((x - lx) ** 2 + (y - ly) ** 2) / (r * r));
      S.tex[y * W + x] = v;
    }
}

// A fresh press: the inlet filled, the rest cream, new roughness in the glass.
function fresh(S) {
  const { st, fill, P, eta, band, seed } = S;
  st.fill(0);
  fill.fill(0);
  seed.fill(0);
  // The inlet: a slot along the whole bottom at Inlet 0, narrowing to a half
  // disc 5 LEDs across at the bottom centre at 1, its lip rounded at each
  // end. Along the slot the lip is waved, from 3 waves across the panel at
  // Fingers -1 to 12 at 1, so the fingers start at the width they would grow.
  const half = 32 - 30 * S.inlet, RE = 2.6, nb = round(6 * 2 ** S.fingers), ph = random() * 2 * PI, amps = [];
  for (let k = 0; k < 16; k++) amps.push(2 + 4 * random());
  for (let y = H - 6; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = max(0, abs(x + 0.5 - W / 2) - (half - RE)), up = H - (y + 0.5);
      const wv = (2 * PI * nb * (x + 0.5)) / W + ph, amp = amps[floor(wv / (2 * PI) + 0.5) % amps.length];
      const lip = dx > 0 ? sqrt(max(0, RE * RE - dx * dx)) : 2 + amp * (0.5 + 0.5 * cos(wv));
      if (dx <= RE && up <= lip) {
        const p = y * W + x;
        st[p] = 1;
        fill[p] = 1;
        seed[p] = 1;
        band[p] = 0;
      }
    }
  // Roughness of the glass: two octaves of smooth noise, 8 and 4 LEDs
  // across, so the front is nudged at the scale of a finger, not per LED.
  const g8 = [], g4 = [];
  for (let k = 0; k < 9 * 17; k++) g8.push(random() - 0.5);
  for (let k = 0; k < 17 * 33; k++) g4.push(random() - 0.5);
  const vn = (g, s, gw, x, y) => {
    const u = x / s, v = y / s, i = floor(u), j = floor(v), fu = u - i, fv = v - j, a = j * gw + i;
    return (g[a] * (1 - fu) + g[a + 1] * fu) * (1 - fv) + (g[a + gw] * (1 - fu) + g[a + gw + 1] * fu) * fv;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      eta[p] = 1 + 0.5 * vn(g8, 8, 9, x, y) + 0.3 * vn(g4, 4, 17, x, y);
      P[p] = st[p] ? 1 : y / H;
    }
  S.vol = 0;
  S.mode = 0;
  S.timer = 0;
}

// The front: every cream LED next to the serum, and phi there.
function boundary(S) {
  const { st, fill, front, phi } = S;
  let nf = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (st[p]) continue;
      if ((x > 0 && st[p - 1]) || (x < W - 1 && st[p + 1]) || (y > 0 && st[p - W]) || (y < H - 1 && st[p + W])) {
        let s = 0, c = 0;
        for (let k = 0; k < DISC.length; k += 2) {
          const xx = x + DISC[k], yy = y + DISC[k + 1];
          if (xx < 0 || xx >= W || yy >= H) continue;
          c++;
          if (yy < 0) continue;
          const q = yy * W + xx;
          s += st[q] ? 1 : fill[q];
        }
        phi[p] = s / c - PHI0;
        front[nf++] = p;
      }
    }
  S.nf = nf;
}

// Over-relaxed sweeps of Laplace's equation for the pressure in the cream:
// 1 in the serum, which is so thin it holds one pressure throughout, 0 at the
// top edge, where the cream leaves the cell, and no flow through the sides
// and the bottom.
function relax(S, sweeps) {
  const { st, P } = S;
  for (let it = 0; it < sweeps; it++)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (st[p]) continue;
        let s = 0, c = 0;
        if (y === 0) c++;
        else {
          s += st[p - W] ? 1 : P[p - W];
          c++;
        }
        if (y < H - 1) {
          s += st[p + W] ? 1 : P[p + W];
          c++;
        }
        if (x > 0) {
          s += st[p - 1] ? 1 : P[p - 1];
          c++;
        }
        if (x < W - 1) {
          s += st[p + 1] ? 1 : P[p + 1];
          c++;
        }
        P[p] += OMEGA * (s / c - P[p]);
      }
}

const speed = (S, p) => max(0, 1 - S.P[p]) ** ETA * S.eta[p] * cl(1 + S.sigma * S.phi[p], 0, CAP);

// Press in vol LEDs of serum, shared among the front LEDs by how fast the
// cream gives way at each.
function grow(S, vol) {
  const { st, fill, P, band, front, nf } = S;
  let tot = 0;
  for (let k = 0; k < nf; k++) {
    const p = front[k];
    tot += speed(S, p);
  }
  if (tot <= 0) return;
  for (let k = 0; k < nf; k++) {
    const p = front[k], v = speed(S, p);
    if (v <= 0) continue;
    if (fill[p] === 0) band[p] = S.vol;
    fill[p] += (vol * v) / tot;
    if (fill[p] >= 1) {
      fill[p] = 1;
      st[p] = 1;
      P[p] = 1;
      // A finger at the top edge: the cell is full.
      if (p < 2 * W) S.mode = 1;
    }
  }
  S.vol += vol;
}

// The cream closing back: every serum LED's distance to the cream, so the
// fingers thin from their sides and the trunks go last.
function startClear(S) {
  const { st, fill, fill0, dist, seed } = S;
  for (let p = 0; p < N; p++) {
    fill0[p] = fill[p];
    dist[p] = fill[p] >= 1 && !seed[p] ? 1e9 : 0;
  }
  const D = 1, DD = 1.414;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!dist[p]) continue;
      let d = dist[p];
      if (x > 0) d = min(d, dist[p - 1] + D);
      if (y > 0) {
        d = min(d, dist[p - W] + D);
        if (x > 0) d = min(d, dist[p - W - 1] + DD);
        if (x < W - 1) d = min(d, dist[p - W + 1] + DD);
      }
      dist[p] = d;
    }
  let m = 1;
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x;
      if (!dist[p]) continue;
      let d = dist[p];
      if (x < W - 1) d = min(d, dist[p + 1] + D);
      if (y < H - 1) {
        d = min(d, dist[p + W] + D);
        if (x < W - 1) d = min(d, dist[p + W + 1] + DD);
        if (x > 0) d = min(d, dist[p + W - 1] + DD);
      }
      dist[p] = d;
      if (d < 1e8 && d > m) m = d;
    }
  S.maxd = m;
  S.mode = 2;
  S.timer = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.fingers = cl(k[2], -1, 1);
  S.inlet = max(0, cl(k[3], 0, 1) - 0.06) / 0.94;
  const rate = S.speed / 2;
  // Surface tension: 6 at Fingers -1, 2 at 0, 0.67 at 1.
  S.sigma = SIG * 3 ** -S.fingers;
  if (!S.begun) {
    // Open with the first PRE seconds of a press already in, as at Speed 2.
    fresh(S);
    boundary(S);
    relax(S, 200);
    for (let i = 0; i < PRE * 30; i++) {
      boundary(S);
      relax(S, SWEEPS);
      grow(S, Q0 / 30);
    }
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0] && S.mode < 2) startClear(S);
  if (S.mode === 0 || S.mode === 1) {
    boundary(S);
    relax(S, SWEEPS);
    if (S.mode === 0) grow(S, Q0 * rate * d);
    else {
      S.timer += d * rate;
      if (S.timer > 1.5) startClear(S);
    }
  } else if (S.mode === 2) {
    S.timer += d * rate;
    const u = S.timer / 3, R = (S.maxd + 1.5) * u * u;
    const { fill, fill0, dist, st, seed } = S;
    for (let p = 0; p < N; p++) {
      if (seed[p] || fill0[p] <= 0) continue;
      const f = min(fill0[p], cl(dist[p] - R, 0, 1));
      fill[p] = f;
      st[p] = f >= 1 ? 1 : 0;
    }
    if (u >= 1) {
      fresh(S);
      boundary(S);
      relax(S, 60);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.begun) return;
  const { fill, band, tex, ser, pale, cream, A, T } = S;
  const h = S.hue + H0;
  hsv(h, 0.72, 1, ser);
  hsv(h + 0.06, 0.3, 1, pale);
  hsv(h + 0.5, 0.1, 0.28, cream);
  // The serum's colour, times how full each LED is, and the fill itself,
  // softened by a 3 by 3 blur so the fingers' edges are round on the LEDs.
  // Each LED's serum colour is set once, by how much had been pressed in
  // when the serum got there: faint growth rings.
  for (let p = 0; p < N; p++) {
    const f = fill[p], o = 4 * p;
    if (f <= 0) {
      A[o] = A[o + 1] = A[o + 2] = A[o + 3] = 0;
      continue;
    }
    const ring = 0.5 + 0.5 * cos((band[p] / 300) * 2 * PI), kk = (0.88 + 0.12 * ring) * f;
    A[o] = (ser[0] + (pale[0] - ser[0]) * ring * 0.5) * kk;
    A[o + 1] = (ser[1] + (pale[1] - ser[1]) * ring * 0.5) * kk;
    A[o + 2] = (ser[2] + (pale[2] - ser[2]) * ring * 0.5) * kk;
    A[o + 3] = f;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = 4 * (y * W + x), l = x > 0 ? o - 4 : o, r = x < W - 1 ? o + 4 : o;
      for (let c = 0; c < 4; c++) T[o + c] = 0.25 * A[l + c] + 0.5 * A[o + c] + 0.25 * A[r + c];
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = 4 * p, u = y > 0 ? o - 4 * W : o, d = y < H - 1 ? o + 4 * W : o;
      const f = 0.25 * T[u + 3] + 0.5 * T[o + 3] + 0.25 * T[d + 3], t = (1 + tex[p] * 0.25) * (1 - f);
      const r = cream[0] * t + 0.25 * T[u] + 0.5 * T[o] + 0.25 * T[d];
      const g = cream[1] * t + 0.25 * T[u + 1] + 0.5 * T[o + 1] + 0.25 * T[d + 1];
      const b = cream[2] * t + 0.25 * T[u + 2] + 0.5 * T[o + 2] + 0.25 * T[d + 2];
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}
