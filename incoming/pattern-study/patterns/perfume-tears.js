// ===== Patternflow pattern =====
// Title:   Perfume Tears
// Family:  cosmetic
// Idea:    The inside wall of a glass of tinted perfume up close: a thin film climbs from the pool at the bottom, pulled by the Marangoni stress of the evaporating alcohol, gathers into a glossy rim where the stress can no longer carry it, and the rim swells at a Rayleigh-Plateau spacing into tears that slide back down on bright legs into the pool.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: tears of wine (James Thomson, 1855; Carlo Marangoni, 1865), pattern round 40
// Round:   40
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rim=0..1, Warmth=0..1
//
// Knob 1: Hue. The liquid's tint, once round the wheel: at 0 rose violet, 0.1 rose, 0.2 apricot, 0.3 butter, 0.45 green, 0.65 aqua, 0.75 sky blue, 0.9 indigo. From apricot to lime the film and the pool are lifted and paled, so they never read brown or olive. Thin film is dim, thick liquid bright.
// Knob 2: Speed. At 2 the film climbs from the pool at 10.5 rows a second, slowing to 6.9 under the rim as it thickens; about one tear a second lets go, and a tear of radius 3.4 LEDs slides down at 35 rows a second. At 0.2 all of it ten times slower, at 3 half as fast again.
// Knob 3: Rim. How thick the rim grows before it sheds: a critical radius of 2.6 LEDs at 0 and 3.9 at 1. The tears follow the rim's mean radius r at 9.02 r apart: five across the panel at 0 (13 LEDs apart), four at 0.5 and three at 1, while the tears' radius grows from 3.4 to 5.1 LEDs and they come three times less often and fall faster.
// Knob 4: Warmth. How fast the alcohol evaporates. Turned up, the Marangoni stress grows by up to 60%, the film carries 19 instead of 10.5 units of liquid a second and climbs at 19 rows a second, and the rim stands 102 rows above the pool instead of 84, so the dry glass above shrinks from 27 rows to 9 and almost twice as many tears fall.
// Buttons: K1 tap swirls the glass: the pool sloshes up and leaves a coat as thick as the stress can still lift (nearly twice the film at the bottom), the tears and legs washed off. The thin film climbs back up under it in scalloped arches, most of the way in 15 s, while the coat runs into the rim, which lets its first tear go about a second after the tap.

const W = 64, H = 128;
// The pool's surface: rows from YP down are the pool, the film climbs the
// wall above it, NZ cells of one LED, cell 0 just above the surface.
const YP = 112, NZ = YP;
// Film flux up the wall, per unit width: q = A(z) h^2 - B h^3, the
// Marangoni stress A(z) (it falls with height as the alcohol is spent)
// against gravity B. h is in units of the film's thickness at the pool.
const B = 5, A0 = 15, H0F = 1;
// The rim: volume per column into radius in LEDs, r = sqrt(2 V KR / pi).
const KR = 0.06;
// Rayleigh-Plateau: a cylinder of radius r breaks fastest at 9.02 r.
const RP = 9.02;
// Growth rate of the fastest mode on the rim, per second.
const SIG = 1.4;
// Drops: radius from volume, speed from radius, the leg they leave.
const KD = 0.062, KU = 3.5, UF = 5, HLEG = 2, CLEG = 2;
// A drop is a cap on the wall: its radius goes as the cube root of its volume.
const rdOf = (v) => Math.cbrt(v * KD);
// Legs drain under gravity alone, flux BL L^3 / 3 down the wall, and soak
// back into the climbing film with time constant TL.
const BL = 3, TL = 1.3;
// Climbing waves on the film, per second.
const WF = 1.3;
// Opening tint: rose violet.
const HUE0 = 0.86;
const { floor, ceil, min, max, abs, sqrt, exp, sin, cos, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  if (i === 0) (out[0] = v), (out[1] = t), (out[2] = p);
  else if (i === 1) (out[0] = q), (out[1] = v), (out[2] = p);
  else if (i === 2) (out[0] = p), (out[1] = v), (out[2] = t);
  else if (i === 3) (out[0] = p), (out[1] = q), (out[2] = v);
  else if (i === 4) (out[0] = t), (out[1] = p), (out[2] = v);
  else (out[0] = v), (out[1] = p), (out[2] = q);
}

const q = (a, h) => a * h * h - B * h * h * h;
// Godunov flux across a face with hl below and hr above: the least flux
// between them if hl <= hr, the most if hl > hr. q has its one maximum
// for h > 0 at 2a / 3B.
function god(a, hl, hr) {
  if (hl <= hr) return min(q(a, hl), q(a, hr));
  const hm = (2 * a) / (3 * B);
  return hm > hr && hm < hl ? q(a, hm) : max(q(a, hl), q(a, hr));
}

// The rim stands where the stress can no longer carry the film's flux:
// the largest flux A^3 4 / 27 B^2 falls to q0.
function balance(S) {
  const a0 = A0 * (1 + 0.6 * S.warm), q0 = q(a0, H0F), ar = Math.cbrt((27 * B * B * q0) / 4);
  S.a0 = a0;
  S.q0 = q0;
  S.zr = 84 + 18 * S.warm;
  // A(z) = a0 (1 - z / Z0), reaching ar at the rim.
  S.Z0 = S.zr / (1 - ar / a0);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, rim: 0, warm: 0.06, begun: false, t: 0,
    a0: A0, q0: 10, zr: 90, Z0: 400,
    h: new Float32Array(W * NZ), L: new Float32Array(W * NZ), F: new Float32Array(NZ + 1), V: new Float32Array(W), r: new Float32Array(W), cool: new Float32Array(W),
    re: new Float32Array(W), im: new Float32Array(W), drops: [], rip: [], sw: 0,
    T: new Float32Array(W * H), c: [0, 0, 0], rbar: 2, tau: new Float32Array(NZ), lam: new Float32Array(NZ), hm: new Float32Array(NZ),
  };
}

// Steady film below the rim: the thin root of q(A(z), h) = q0.
function steady(S, z) {
  const a = S.a0 * (1 - z / S.Z0);
  let h = H0F;
  for (let k = 0; k < 30; k++) {
    const f = q(a, h) - S.q0, d = 2 * a * h - 3 * B * h * h;
    if (abs(d) < 1e-6) break;
    h = cl(h - f / d, 0.2, (2 * a) / (3 * B));
  }
  return h;
}

function init(S) {
  const zi = floor(S.zr);
  for (let z = 0; z < NZ; z++) {
    const hs = z < zi ? steady(S, z) : 0;
    for (let x = 0; x < W; x++) S.h[z * W + x] = hs;
  }
  const rc = rimCrit(S), Vc = (PI * rc * rc) / (2 * KR);
  for (let x = 0; x < W; x++) S.V[x] = Vc * (0.7 + 0.25 * random());
}

const rimCrit = (S) => 2.6 + 1.3 * S.rim;

// One step of the film, ds seconds: Godunov fluxes up each column, the
// rim taking what reaches it, and a little sideways spreading.
function film(S, ds) {
  const { h, F, V } = S, zi = floor(S.zr), HM = S.hm;
  for (let z = 0; z < zi; z++) HM[z] = (2 * S.a0 * (1 - z / S.Z0)) / (3 * B);
  for (let x = 0; x < W; x++) {
    F[0] = god(S.a0, H0F, h[x]);
    for (let z = 1; z < zi; z++) F[z] = god(S.a0 * (1 - z / S.Z0), h[(z - 1) * W + x], h[z * W + x]);
    const top = h[(zi - 1) * W + x], fr = q(S.a0 * (1 - zi / S.Z0), top);
    F[zi] = fr > 0 ? fr : 0;
    for (let z = 0; z < zi; z++) {
      const p = z * W + x;
      h[p] = max(0, h[p] + ds * (F[z] - F[z + 1]));
    }
    // Film thicker than the most the stress can lift there (h > 2A / 3B)
    // drains into the rim over a few seconds. Without it a swirled coat
    // would settle on the slow branch of q and hang below the rim for good.
    for (let z = 0; z < zi; z++) {
      const p = z * W + x, ex = (h[p] - HM[z]) * min(1, (z === zi - 1 ? 6 : 0.4) * ds);
      if (ex > 0) {
        h[p] -= ex;
        V[x] += ex;
      }
    }
    // What reaches the rim varies slowly along it.
    V[x] += ds * F[zi] * (1 + 0.35 * sin(0.29 * x + 0.7 * S.t) * sin(0.11 * x - 0.23 * S.t + 1));
  }
  // Sideways: the film spreads, legs widen.
  const D = 1.5 * ds;
  for (let z = 0; z < zi; z++) {
    const o = z * W;
    let prev = h[o + W - 1], first = h[o];
    for (let x = 0; x < W; x++) {
      const c = h[o + x], nx = x === W - 1 ? first : h[o + x + 1];
      h[o + x] = c + D * (prev + nx - 2 * c);
      prev = c;
    }
  }
}

// Legs: each column drains downward, the flux from the cell above.
function legs(S, ds) {
  const L = S.L, k = (BL / 3) * ds, f = exp(-ds / TL);
  for (let x = 0; x < W; x++) {
    let inflow = 0;
    for (let z = NZ - 1; z >= 0; z--) {
      const p = z * W + x, l = L[p], out = min(l, k * l * l * l);
      L[p] = (l - out + inflow) * f;
      inflow = out;
    }
  }
}

// The rim's sideways instability, mode by mode: sigma(k) = al k^2 - be k^4,
// fastest at k* = 2 pi / (9.02 r), growing at SIG there.
function rimStep(S, ds) {
  const { V, re, im, r } = S;
  let mean = 0;
  for (let x = 0; x < W; x++) mean += V[x];
  mean /= W;
  const rbar = sqrt((2 * mean * KR) / PI);
  S.rbar = rbar;
  const ks = (2 * PI) / max(4, RP * rbar), al = (2 * SIG) / (ks * ks), be = al / (2 * ks * ks);
  for (let n = 0; n < W; n++) {
    let a = 0, b = 0;
    for (let x = 0; x < W; x++) {
      const ph = (2 * PI * n * x) / W;
      a += V[x] * cos(ph);
      b -= V[x] * sin(ph);
    }
    const k = (2 * PI * (n <= W / 2 ? n : n - W)) / W, g = n === 0 ? 1 : exp((al * k * k - be * k * k * k * k) * ds);
    re[n] = a * g;
    im[n] = b * g;
  }
  let after = 0;
  for (let x = 0; x < W; x++) {
    let a = 0;
    for (let n = 0; n < W; n++) {
      const ph = (2 * PI * n * x) / W;
      a += re[n] * cos(ph) - im[n] * sin(ph);
    }
    V[x] = max(0, a / W + 0.02 * (random() - 0.5) * mean * ds * 30);
    after += V[x];
  }
  // Troughs cut off at zero would make liquid: scale back to the volume.
  const k = after > 0 ? (mean * W) / after : 1;
  for (let x = 0; x < W; x++) {
    V[x] *= k;
    r[x] = sqrt((2 * V[x] * KR) / PI);
  }
}

// The thickest place on the rim, once past the critical radius, lets go a
// tear: the swelling over one wavelength runs into a drop.
function shed(S) {
  const { V, r, cool } = S, rc = rimCrit(S);
  let xb = -1;
  for (let x = 0; x < W; x++) if (r[x] >= rc && cool[x] <= 0 && (xb < 0 || r[x] > r[xb])) xb = x;
  if (xb < 0) return;
  const lam = RP * S.rbar, half = max(3, lam / 2), keep = (PI * (0.45 * rc) ** 2) / (2 * KR);
  let v = 0;
  for (let d = -floor(half); d <= floor(half); d++) {
    const x = (xb + d + W) % W, w = cos((PI * d) / (2 * half)) ** 2, take = max(0, V[x] - keep) * w;
    V[x] -= take;
    v += take;
    cool[x] = max(cool[x], 0.6 * w);
  }
  S.drops.push({ x: xb + 0.5, z: S.zr - r[xb], v, age: 0, ph: random() * 6.3 });
}

function drops(S, ds) {
  const L = S.L, zi = floor(S.zr);
  for (const d of S.drops) {
    d.age += ds;
    const rd = rdOf(d.v), ut = min(90, KU * rd * rd - UF), u = max(0, ut) * (1 - exp(-d.age / 0.5));
    const z0 = d.z;
    d.z -= u * ds;
    d.x += 1.6 * sin(d.ph + d.age * 1.7) * ds;
    // The leg: liquid left behind at HLEG, a third as wide as the drop.
    const sg = 0.32 * rd + 0.25;
    for (let z = max(0, floor(d.z + rd)); z <= min(zi - 1, floor(z0 + rd)); z++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = floor(d.x) + dx, xx = (x + W) % W, g = exp(-((x + 0.5 - d.x) ** 2) / (2 * sg * sg)), p = z * W + xx;
        if (L[p] < HLEG * g) L[p] = HLEG * g;
      }
    d.v -= CLEG * rd * (z0 - d.z);
    // Too small to slide, it stops and sinks into its leg.
    if (ut < 4 && d.age > 1) d.v = 0;
    if (d.z <= 0) {
      S.rip.push({ x: d.x, age: 0, a: min(1.5, rd / 2) });
      d.v = 0;
    }
  }
  S.drops = S.drops.filter((d) => d.v > 2);
  for (const rp of S.rip) rp.age += ds;
  S.rip = S.rip.filter((rp) => rp.age < 2.5);
}

function step(S, ds) {
  S.t += ds;
  const n = max(1, Math.ceil(ds / 0.008)), sub = ds / n;
  for (let k = 0; k < n; k++) {
    film(S, sub);
    legs(S, sub);
  }
  rimStep(S, ds);
  for (let x = 0; x < W; x++) S.cool[x] -= ds;
  shed(S);
  drops(S, ds);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.rim = cl(k[2], 0, 1);
  S.warm = cl(k[3], 0, 1);
  balance(S);
  if (!S.begun) {
    init(S);
    for (let i = 0; i < 150; i++) step(S, 1 / 30);
    S.begun = true;
  }
  if (input.btnPressed && input.btnPressed[0]) {
    // Swirl: a fresh coat over the whole film, the tears and legs washed off.
    const zi = floor(S.zr);
    const ph = random() * 6.3;
    // As thick as the stress can still lift at each height, a little less
    // here and there: thicker and it would hang as the slow branch.
    for (let z = 0; z < zi; z++) {
      const hm = (2 * S.a0 * (1 - z / S.Z0)) / (3 * B);
      for (let x = 0; x < W; x++) S.h[z * W + x] = max(S.h[z * W + x], hm * (0.9 + 0.05 * sin(0.3 * x + ph) + 0.03 * sin(0.71 * x - ph)));
    }
    S.L.fill(0);
    S.drops = [];
    S.sw = 1;
  }
  S.sw = max(0, S.sw - (d * S.speed) / 2 / 1.5);
  step(S, (d * S.speed) / 2);
}

// Kinematic waves on the climbing film travel up at c = dq/dh. Each row's
// arrival time from the pool, and how many rows one wave spans there.
function waves(S) {
  const tau = S.tau, lam = S.lam;
  let t = 0;
  for (let z = 0; z < NZ; z++) {
    const a = S.a0 * (1 - z / S.Z0), hs = steady(S, z), c = max(0.5, 2 * a * hs - 3 * B * hs * hs);
    tau[z] = t;
    lam[z] = c / WF;
    t += 1 / c;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { h, r, T, c, L, tau, lam } = S, zi = floor(S.zr);
  T.fill(0);
  waves(S);
  // Thickness on the wall: the film, the legs, the rim's half-cylinder
  // hanging from the line it climbs to, the drops as caps.
  for (let y = 0; y < YP; y++) {
    const z = YP - 1 - y;
    for (let x = 0; x < W; x++) T[y * W + x] = (z < zi ? h[z * W + x] : 0) + L[z * W + x];
  }
  for (let x = 0; x < W; x++) {
    const rr = r[x], zc = S.zr - 1.5 * rr;
    for (let y = max(0, floor(YP - 1 - S.zr)); y <= min(YP - 1, YP - 1 - floor(zc - 1.5 * rr - 1)); y++) {
      const dz = (YP - 1 - y + 0.5 - zc) / 1.5, t2 = rr * rr - dz * dz;
      if (t2 > 0) T[y * W + x] = max(T[y * W + x], 1.2 + 1.4 * sqrt(t2));
    }
  }
  for (const d of S.drops) {
    const rd = rdOf(d.v), yc = YP - 1 - d.z + 0.5;
    // Never above the line the rim hangs from.
    for (let y = max(ceil(YP - 1 - S.zr), floor(yc - 2.4 * rd - 1)); y <= min(YP - 1, floor(yc + rd + 1)); y++)
      for (let x = floor(d.x - rd - 1); x <= floor(d.x + rd + 1); x++) {
        // Round in front, drawn out behind into the leg.
        const dx = x + 0.5 - d.x, dy = y + 0.5 - yc, ey = dy < 0 ? dy / 2.4 : dy, t2 = rd * rd - dx * dx * (dy < 0 ? 1 - dy / (2.4 * rd) : 1) ** 2 - ey * ey;
        if (t2 <= 0) continue;
        const p = y * W + ((x + W) % W);
        T[p] = max(T[p], 1.6 + 1.5 * sqrt(t2));
      }
  }
  const hue = S.hue + HUE0, hh = hue - floor(hue);
  // Orange and yellow read brown when dim: there the liquid is lifted and
  // paled.
  const warm = cl(1.4 - abs(hh - 0.12) / 0.11, 0, 1);
  // Key light from the upper left and a soft one from below right, seen
  // straight on: half vectors.
  const H1 = half(-0.45, -0.6, 0.66), H2 = half(0.35, 0.75, 0.56);
  for (let y = 0; y < YP; y++) {
    const z = YP - 1 - y, wv = z < zi ? cl((lam[z] - 2) / 4, 0, 1) : 0;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, t = T[p];
      const gx = (T[y * W + ((x + 1) % W)] - T[y * W + ((x + W - 1) % W)]) / 2;
      const gy = ((y < YP - 1 ? T[p + W] : t) - (y > 0 ? T[p - W] : t)) / 2;
      const nn = sqrt(gx * gx + gy * gy + 1);
      const n1 = (-gx * H1[0] - gy * H1[1] + H1[2]) / nn, n2 = (-gx * H2[0] - gy * H2[1] + H2[2]) / nn;
      const thick = min(1, t / 2.2), spec = thick * (0.95 * max(0, n1) ** 36 + 0.28 * max(0, n2) ** 6);
      // The film's climbing waves.
      const sh = wv > 0 ? 1 + 0.09 * wv * sin(2 * PI * WF * (S.t - tau[z]) + 1.3 * sin(0.31 * x + 0.07 * z + 0.2 * S.t) + 0.8 * sin(0.13 * x - 0.11 * z)) : 1;
      const body = 1 - exp(-t / 2.4), v = 0.04 + (1.05 + 0.1 * warm) * body ** 1.9 * sh;
      hsv(hue, 0.82 - 0.4 * body - 0.25 * warm, v, c);
      display.setPixel(x, y, round(255 * min(1, c[0] + spec)), round(255 * min(1, c[1] + spec)), round(255 * min(1, c[2] + spec)));
    }
  }
  // The pool: liquid seen through the glass, a bright meniscus, ripples
  // where tears come in.
  for (let x = 0; x < W; x++) {
    let off = 0, glow = 0;
    for (const rp of S.rip) {
      const dx = abs(x + 0.5 - rp.x), fr = rp.age * 18;
      const e = exp(-((dx - fr) ** 2) / 12) * exp(-rp.age / 0.7) * rp.a;
      off += e * sin(dx * 1.1 - rp.age * 9);
      glow += e;
    }
    // A swirl throws the surface up the wall and lets it fall back.
    off -= 4 * S.sw * (0.7 + 0.3 * sin(0.21 * x + 9 * S.sw));
    for (let y = YP; y < H; y++) {
      const u = (y - YP) / (H - YP), dy = y - YP - off, men = exp(-(dy * dy) / 1.5);
      const lit = 0.24 * exp(-max(0, dy) / 4);
      hsv(hue + 0.02, 0.72 - 0.25 * men - 0.25 * warm, 0.34 + 0.2 * warm - 0.12 * u + lit + 0.35 * men + 0.25 * glow * men, c);
      display.setPixel(x, y, round(255 * min(1, c[0] + 0.3 * men)), round(255 * min(1, c[1] + 0.3 * men)), round(255 * min(1, c[2] + 0.3 * men)));
    }
  }
}

function half(x, y, z) {
  const n = sqrt(x * x + y * y + (z + 1) ** 2);
  return [x / n, y / n, (z + 1) / n];
}
