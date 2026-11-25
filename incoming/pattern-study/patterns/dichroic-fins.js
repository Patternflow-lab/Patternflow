// ===== Patternflow pattern =====
// Title:   Dichroic Fins
// Family:  dichroic
// Idea:    Thirteen small fins of dichroic glass stand out of a wall under one raking lamp, and each throws two soft slanted patches, the colour it passes on the far side and the complementary colour it reflects on the near side, which slide, thin to a line and open again as the lamp circles and the fins turn, and add toward white where they cross.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: dichroic glass, a thin-film interference filter that passes one band and reflects the rest, with a pass band that moves toward blue as the light strikes it more obliquely (optics, from memory); wall pieces of dichroic glass under a single lamp, as in Stephen Knapp's lightpaintings (from about 2002, from memory); the fin layout, the parallelogram patch with a penumbra that widens along its length, the turning fins and the wall knob are original, pattern round 252
// Round:   252
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..4, Light=-1..1, Wall=0..1
//
// Knob 1: Hue. Turns every coating round the wheel; it opens on magenta, rose and violet patches, each beside the green, teal or lime that its fin reflects.
// Knob 2: Speed. 1 to 4, opening at 2. How fast the lamp circles and the fins turn: about two thirds of the opening pace at 1, 1.7 times it at 4.
// Knob 3: Light. -1 to 1, opening at 0. How high the lamp stands off the wall: at -1 it is high and the patches are short stubs beside each fin, at 1 it rakes the wall and the patches are long streaks that cross several neighbours.
// Knob 4: Wall. 0 to 1, opening at about 0.06. How bright the wall is: dark below 0.08, so the patches glow on black, and at 1 a pale wall where the passed colour lies as a coloured shadow and the reflected colour as a pale wash.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, exp, sin, cos, pow, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();

const NF = 13;            // fins
const LD = 200;           // how far the foot of the lamp stands from the middle of the panel, in LED, about
const TE0 = 0.4;          // tangent of the lamp's elevation over the wall at the opening
const S0 = 1.4;           // softness of a patch edge at the fin, in LED
const KP = 0.2;           // and how much it grows per LED of distance along the patch
const HSHIFT = 0.8;       // how far the hue slides as the incidence grows oblique
const TIP = 0.07;         // and how far it slides from the fin to the far end of a patch
const FADE = 0.45;        // how much dimmer the far end of a patch is
const BASE = [0.87, 0.71, 0.79];   // transmitted hue of the three coatings at normal incidence

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// a ramp from 0 to 1 across one unit, centred on 0
const ramp = (x) => { x += 0.5; return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); };

export function setup(params) {
  const F = (n) => new Float64Array(n);
  const x0 = F(NF), y0 = F(NF), wa = F(NF * 6), hw = F(NF), ht = F(NF), phi0 = F(NF), wr = F(NF), am = F(NF), fq = F(NF), fp = F(NF), f2 = F(NF), p2 = F(NF);
  const kind = new Uint8Array(NF);
  // five rows, three fins and two by turns, each pushed a little off its place
  let i = 0;
  const odd = rnd() < 0.5 ? 1 : 0;
  for (let r = 0; r < 5 && i < NF; r++) {
    const n = (r + odd) % 2 ? 2 : 3;
    for (let c = 0; c < n && i < NF; c++, i++) {
      x0[i] = (c + 0.5) * W / n + (rnd() - 0.5) * 8;
      y0[i] = (r + 0.5) * H / 5 + (rnd() - 0.5) * 10;
    }
  }
  for (; i < NF; i++) { x0[i] = 8 + rnd() * 48; y0[i] = 8 + rnd() * 112; }
  const kinds = [0, 1, 0, 1, 2, 0, 1, 0, 1, 2, 0, 1, 2];
  for (let k = NF - 1; k > 0; k--) { const j = floor(rnd() * (k + 1)); const t = kinds[k]; kinds[k] = kinds[j]; kinds[j] = t; }
  for (i = 0; i < NF; i++) {
    kind[i] = kinds[i];
    hw[i] = 3.4 + 2.6 * rnd();
    ht[i] = 6.5 + 0.75 * hw[i] + 1.5 * rnd();
    phi0[i] = rnd() * PI;
    // every fin turns one way at its own rate, now faster and now slower, and never stops
    wr[i] = (rnd() < 0.5 ? -1 : 1) * (0.055 + 0.06 * rnd());
    fq[i] = 0.06 + 0.05 * rnd(); fp[i] = rnd() * TP;
    am[i] = (0.25 + 0.3 * rnd()) * abs(wr[i]) / fq[i];
    f2[i] = 0.017 + 0.02 * rnd(); p2[i] = rnd() * TP;
    // each fin also wanders a few LED round its place, too slowly to see it go
    for (let c = 0; c < 6; c++) wa[i * 6 + c] = c % 3 === 0 ? 0.01 + 0.016 * rnd() : c % 3 === 1 ? 0.025 + 0.017 * rnd() : rnd() * TP;
  }
  const ph = F(12);
  for (i = 0; i < 12; i++) ph[i] = rnd() * TP;
  const st = (params.st = {
    k: [0, 2, 0, 0.06], ks: [0, 2, 0, 0.06], init: false,
    th: 0, ph,
    x0, y0, wa, hw, ht, phi0, wr, am, fq, fp, f2, p2, kind,
    // what one frame needs of each fin
    px: F(NF), py: F(NF), ux: F(NF), uy: F(NF), su: F(NF), sn: F(NF), len: F(NF), tc: F(NF * 6), rc: F(NF * 6),
    fx: 0, fy: 0, lz: 80,
    mul: new Float32Array(W * H * 3), add: new Float32Array(W * H * 3),
  });
  return st;
}

const tmp = [0, 0, 0];

function pose(st) {
  const th = st.th, p = st.ph, ks = st.ks;
  // the lamp goes round the panel, never at one pace, and its height breathes
  const az = p[0] + 0.039 * th + 0.7 * sin(0.0178 * th + p[1]) + 0.3 * sin(0.0404 * th + p[2]);
  const ld = LD * exp(0.3 * sin(0.0118 * th + p[5]) + 0.15 * sin(0.029 * th + p[6]));
  st.fx = W / 2 + ld * cos(az);
  st.fy = H / 2 + ld * sin(az);
  const k3 = cl(ks[2], -1, 1);
  const lz = ld * TE0 * exp(-(k3 < 0 ? 0.9 : 0.75) * k3) * exp(0.2 * sin(0.0251 * th + p[3]) + 0.12 * sin(0.043 * th + p[4]));
  st.lz = lz;
  const hue = ks[0];
  for (let i = 0; i < NF; i++) {
    const phi = st.phi0[i] + st.wr[i] * th + st.am[i] * sin(st.fq[i] * th + st.fp[i]) + 0.25 * sin(st.f2[i] * th + st.p2[i]);
    const ux = cos(phi), uy = sin(phi);
    const wa = st.wa, j = i * 6;
    const px = st.x0[i] + 4.5 * sin(wa[j] * th + wa[j + 2]) + 2.5 * sin(wa[j + 1] * th + wa[j + 5]);
    const py = st.y0[i] + 6 * sin(wa[j + 3] * th + wa[j + 5]) + 3 * sin(wa[j + 4] * th + wa[j + 2]);
    st.px[i] = px; st.py[i] = py;
    const dx = px - st.fx, dy = py - st.fy;
    const dist = sqrt(dx * dx + dy * dy);
    const L = min(70, st.ht[i] * dist / lz);
    const sx = dx / dist * L, sy = dy / dist * L;
    st.ux[i] = ux; st.uy[i] = uy;
    st.su[i] = sx * ux + sy * uy;
    st.sn[i] = -sx * uy + sy * ux;
    st.len[i] = L;
    // angle of incidence on the face of the fin
    const ce = dist / sqrt(dist * dist + lz * lz);
    const ci = ce * abs(st.sn[i]) / L;
    const sh = HSHIFT * (1 - sqrt(1 - 0.39 * (1 - ci * ci)));
    // the colour at the fin, and the colour at the far end of the patch, a little further round
    for (let e = 0; e < 2; e++) {
      hsv(hue + BASE[st.kind[i]] + sh + TIP * e, 0.88, 1, tmp);
      for (let c = 0; c < 3; c++) {
        st.tc[i * 6 + e * 3 + c] = tmp[c];
        st.rc[i * 6 + e * 3 + c] = (1 - tmp[c]) * 1.04 + 0.06;
      }
    }
  }
}

// the knob to the pace of the scene: about two thirds of the opening pace at 1, 1.7 times it at 4
const pace = (k) => 0.33 + 0.385 * cl(k, 1, 4);

function step(st, dt) {
  const k = st.k, ks = st.ks;
  const a = dt >= 1 ? 1 : 1 - exp(-dt / 0.3);
  for (let i = 0; i < 4; i++) ks[i] += (k[i] - ks[i]) * a;
  st.th += dt * pace(ks[1]);
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || [0, 2, 0, 0.06];
  for (let i = 0; i < 4; i++) st.k[i] = Number.isFinite(kv[i]) ? kv[i] : st.k[i];
  dt = cl(dt || 0, 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
    // the scene starts forty seconds in, at the pace the knob asks for
    st.th = 40 * pace(st.ks[1]);
  }
  if (dt > 0) step(st, dt);
  pose(st);
}

export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const mul = st.mul, add = st.add;
  mul.fill(1); add.fill(0);
  const k4 = cl(st.ks[3], 0, 1);
  const wl = 0.58 * max(0, k4 - 0.08) / 0.92;   // wall level
  const gT = 0.96 - 0.72 * k4;   // the passed colour as light of its own: all of it on a dark wall; on a lit wall most of it is the wall's light filtered
  const gR = 0.8 - 0.3 * k4;     // the reflected colour is always added light
  for (let i = 0; i < NF; i++) {
    const px = st.px[i], py = st.py[i], ux = st.ux[i], uy = st.uy[i];
    const su = st.su[i], sn = st.sn[i], L = st.len[i], w = st.hw[i];
    const hn = abs(sn);
    if (hn < 0.05) continue;
    const sg = hn / L;
    const sMax = S0 + KP * L * 1.2;
    // the box that holds both patches: the base, and the base pushed along the shadow and along its mirror image
    const ex = abs(ux) * w + sMax, ey = abs(uy) * w + sMax;
    const ax = su * ux - sn * uy, ay = su * uy + sn * ux;     // the shadow vector
    const bx = su * ux + sn * uy, by = su * uy - sn * ux;     // mirrored about the fin
    const X0 = max(0, floor(px + min(0, ax, bx) - ex)), X1 = min(W - 1, floor(px + max(0, ax, bx) + ex));
    const Y0 = max(0, floor(py + min(0, ay, by) - ey)), Y1 = min(H - 1, floor(py + max(0, ay, by) + ey));
    const tc = st.tc, rc = st.rc, j = i * 6;
    for (let y = Y0; y <= Y1; y++) {
      const qy = y + 0.5 - py;
      for (let x = X0; x <= X1; x++) {
        const qx = x + 0.5 - px;
        const qn = -qx * uy + qy * ux;
        const an = qn < 0 ? -qn : qn;
        if (an > hn + sMax) continue;
        const t = an / hn;
        const a = qx * ux + qy * uy - t * su;
        const s = S0 + KP * L * (t < 1.2 ? t : 1.2);
        const ca = ramp((a + w) * sg / s) - ramp((a - w) * sg / s);
        if (ca <= 0) continue;
        const c = ca * (ramp(an / s) - ramp((an - hn) / s));
        if (c < 0.004) continue;
        const o = (y * W + x) * 3;
        const e = t < 1 ? t : 1, e1 = 1 - e;
        if (qn * sn > 0) {
          const t0 = tc[j] * e1 + tc[j + 3] * e, t1 = tc[j + 1] * e1 + tc[j + 4] * e, t2 = tc[j + 2] * e1 + tc[j + 5] * e;
          mul[o] *= 1 - c * (1 - t0); mul[o + 1] *= 1 - c * (1 - t1); mul[o + 2] *= 1 - c * (1 - t2);
          const g = c * gT * (1 - FADE * e);
          add[o] += g * t0; add[o + 1] += g * t1; add[o + 2] += g * t2;
        } else {
          const g = c * gR * (1 - FADE * e);
          add[o] += g * (rc[j] * e1 + rc[j + 3] * e); add[o + 1] += g * (rc[j + 1] * e1 + rc[j + 4] * e); add[o + 2] += g * (rc[j + 2] * e1 + rc[j + 5] * e);
        }
      }
    }
  }
  // the wall under the lamp, a little brighter on the side the lamp stands
  const fx = st.fx, fy = st.fy, lz2 = st.lz * st.lz;
  const mid = (W / 2 - fx) * (W / 2 - fx) + (H / 2 - fy) * (H / 2 - fy) + lz2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const dx = x + 0.5 - fx, dy = y + 0.5 - fy;
      const e = wl * (0.3 + 0.7 * sqrt(sqrt(mid / (dx * dx + dy * dy + lz2))));
      add[o] += e * mul[o];
      add[o + 1] += e * 0.96 * mul[o + 1];
      add[o + 2] += e * 0.9 * mul[o + 2];
    }
  }
  // the fins themselves: the lit edge of each sheet of glass
  for (let i = 0; i < NF; i++) {
    const px = st.px[i], py = st.py[i], ux = st.ux[i], uy = st.uy[i], w = st.hw[i];
    const X0 = max(0, floor(px - abs(ux) * w - 2)), X1 = min(W - 1, floor(px + abs(ux) * w + 2));
    const Y0 = max(0, floor(py - abs(uy) * w - 2)), Y1 = min(H - 1, floor(py + abs(uy) * w + 2));
    const r = 0.62 + 0.38 * st.tc[i * 6], g = 0.62 + 0.38 * st.tc[i * 6 + 1], b = 0.62 + 0.38 * st.tc[i * 6 + 2];
    for (let y = Y0; y <= Y1; y++) {
      const qy = y + 0.5 - py;
      for (let x = X0; x <= X1; x++) {
        const qx = x + 0.5 - px;
        const qu = abs(qx * ux + qy * uy) - w, qn = -qx * uy + qy * ux;
        const d = sqrt((qu > 0 ? qu * qu : 0) + qn * qn);
        const c = cl(1.35 - d, 0, 1);
        if (c <= 0) continue;
        const o = (y * W + x) * 3;
        add[o] += (r - add[o]) * c; add[o + 1] += (g - add[o + 1]) * c; add[o + 2] += (b - add[o + 2]) * c;
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let r = add[o], g = add[o + 1], b = add[o + 2];
      // soft clip on the brightest channel, so a crossing stays a colour
      const m = r > g ? (r > b ? r : b) : (g > b ? g : b);
      if (m > 0.7) {
        const q = (m - 0.7) / 0.3, f = (0.7 + 0.3 * q / (1 + q)) / m;
        r *= f; g *= f; b *= f;
      } else if (b < 0.6 * g && r > 0.6 * g) {
        // a dim orange or yellow reads as brown on the panel, so as one dims it slides toward red
        const warm = cl((0.6 * g - b) / (0.4 * g), 0, 1) * cl((r - 0.6 * g) / (0.4 * g), 0, 1);
        g *= 1 - 0.7 * warm * pow(1 - m / 0.7, 0.7);
      }
      display.setPixel(x, y, (r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0);
    }
  }
}
