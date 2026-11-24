// ===== Patternflow pattern =====
// Title:   Video Feedback
// Family:  feedback
// Idea:    A camera looks at the monitor that shows its own picture, so every frame is the last one zoomed in, turned and colour-rotated a little, and a ring of light with one wandering torch is added on each trip, which nests copies of itself into a rainbow tunnel of rotated ellipses that spirals into a dark eye.
// Author:  patternflow-lab
// Date:    2026-11-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: video feedback, a camera pointed at its own monitor, and its spirals, tunnels and filigree as the dynamics of one map (James Crutchfield, "Space-Time Dynamics in Video Feedback", 1984, from memory); the Droste effect; the colour turned in the I/Q plane of YIQ (the NTSC colour signal, 1953, from memory)
// Round:   235
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Twist=0.5..4, Zoom=-1..1, Lights=1..6
//
// Knob 1: Hue. How far the colour turns on each trip round the loop, so every nested copy is a new colour: 20 degrees a trip at 0 (the six visible copies run through about a third of the wheel), 51 at 0.5 and 81 at 1 (a copy in every colour of the wheel, four or five colours across the tunnel). The colour of the newest copy moves too, a third of a turn from 0 to 1 and a full turn in 32 seconds by itself.
// Knob 2: Twist. How far the camera is turned on each trip, 3 degrees at 0.5 (a tight tunnel of nested ellipses), 12 at the opening 2 and 24 at 4, where the copies split into separate blades. It sways by about 40 percent over 51 seconds and 23 seconds, so the arms never settle on one count.
// Knob 3: Zoom. How much each trip shrinks the picture, to 0.946 at -1 (the copies overlap into one filled rainbow ellipse), 0.88 at the opening 0 and 0.82 at 1 (four or five bold rings with a wide black gap between them). It swells and eases by a quarter over 81 seconds.
// Knob 4: Lights. How many arcs the ring is cut into, 1 to 6: at 1 one arc of 342 degrees with a notch, at 2 two of 130, at 3 three of 60, at 6 six of 30. Each arc is 2.4 LED across and fades out at its ends. One torch disc 6 LED across wanders over the panel on any setting.

const W = 64, H = 128, S = 2, IW = W * S, IH = H * S, N = IW * IH;
const { floor, min, max, sqrt, abs, sin, cos, exp, PI } = Math;
const TAU = PI * 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const wob = (t, f, p) => sin(TAU * f * t + p);

const mk = () => new Float32Array(N);

export function setup(params) {
  const vig = mk();
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < IW; x++) {
      const d = min(min(x, IW - 1 - x), min(y, IH - 1 - y));
      const u = cl(d / 14, 0, 1);
      vig[y * IW + x] = 0.78 + 0.22 * u * u * (3 - 2 * u);
    }
  params.st = {
    ready: false, t: 0, acc: 0,
    YA: mk(), IA: mk(), QA: mk(), YB: mk(), IB: mk(), QB: mk(), YT: mk(), IT: mk(), QT: mk(),
    vig, bias: 0.01, mean: 0.14, P: {}, k: [0, 2, 0, 1],
  };
}

// The camera for this loop: where it looks, how far it is zoomed, turned and
// shifted, and how much of each it does is a slow sum of oscillators on
// frequencies that do not divide one another, so the tunnel never settles.
function drive(st, t) {
  const k = st.k, P = st.P;
  P.lnS = -(0.125 + 0.07 * k[2]) * (1 + 0.25 * wob(t, 0.0123, 0.7) + 0.12 * wob(t, 0.0311, 2.1));
  P.s = exp(P.lnS);
  P.phi = ((k[1] * 6) / 180) * PI * (1 + 0.4 * wob(t, 0.0197, 0.3) + 0.2 * wob(t, 0.0431, 1.3));
  P.cx = IW / 2 + 10 * wob(t, 0.0271, 0.2);
  P.cy = IH / 2 + 18 * wob(t, 0.0191, 1.1);
  P.sx = 1.5 * wob(t, 0.0411, 2.0);
  P.sy = 1.5 * wob(t, 0.0337, 0.5);
  P.th = TAU * (0.055 + 0.17 * k[0]) * (1 + 0.08 * wob(t, 0.0517, 0.9));
  P.focus = 0.5 + 0.2 * wob(t, 0.0617, 1.7);
  P.gain = 0.975 + 0.01 * wob(t, 0.0721, 0.6);
  P.hue = 0.0 + 0.35 * k[0] + 0.031 * t + 0.06 * wob(t, 0.0263, 0.8);
  // the fixed point of the camera map: x* - c = (I - s R)^-1 shift
  const cp = cos(P.phi), sp = sin(P.phi), a = 1 - P.s * cp, b = P.s * sp, det = a * a + b * b;
  P.fx = P.cx + (a * P.sx - b * P.sy) / det;
  P.fy = P.cy + (b * P.sx + a * P.sy) / det;
}

function hueIQ(h, c, out) {
  out[0] = c * cos(TAU * h);
  out[1] = c * sin(TAU * h);
}

// One trip round the loop: resample the last picture through the camera,
// rotate its colour, blur it by the lens and sharpen it back, squash it with
// the monitor's gain, and add the lights.
function loop(st, t) {
  drive(st, t);
  const P = st.P;
  const { YA, IA, QA, YB, IB, QB, YT, IT, QT, vig } = st;
  const m = 1 / P.s, cp = cos(P.phi), sp = sin(P.phi);
  const axx = m * cp, axy = m * sp, ayx = -m * sp, ayy = m * cp;
  const ct = cos(P.th), stt = sin(P.th);
  for (let py = 0; py < IH; py++) {
    const dy = py + 0.5 - P.cy - P.sy, dx0 = 0.5 - P.cx - P.sx;
    const u0 = P.cx + axx * dx0 + axy * dy - 0.5, v0 = P.cy + ayx * dx0 + ayy * dy - 0.5;
    for (let px = 0; px < IW; px++) {
      const o = py * IW + px, u = u0 + axx * px, v = v0 + ayx * px;
      if (u <= -1 || u >= IW || v <= -1 || v >= IH) {
        YB[o] = 0; IB[o] = 0; QB[o] = 0;
        continue;
      }
      const x0 = floor(u), y0 = floor(v), fx = u - x0, fy = v - y0;
      let y = 0, i = 0, q = 0;
      if (x0 >= 0 && x0 < IW - 1 && y0 >= 0 && y0 < IH - 1) {
        const a = y0 * IW + x0, w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        y = YA[a] * w00 + YA[a + 1] * w10 + YA[a + IW] * w01 + YA[a + IW + 1] * w11;
        i = IA[a] * w00 + IA[a + 1] * w10 + IA[a + IW] * w01 + IA[a + IW + 1] * w11;
        q = QA[a] * w00 + QA[a + 1] * w10 + QA[a + IW] * w01 + QA[a + IW + 1] * w11;
      } else {
        for (let cy = 0; cy < 2; cy++)
          for (let cx = 0; cx < 2; cx++) {
            const xx = x0 + cx, yy = y0 + cy;
            if (xx < 0 || xx >= IW || yy < 0 || yy >= IH) continue;
            const w = (cx ? fx : 1 - fx) * (cy ? fy : 1 - fy), a = yy * IW + xx;
            y += YA[a] * w; i += IA[a] * w; q += QA[a] * w;
          }
      }
      YB[o] = y;
      IB[o] = i * ct - q * stt;
      QB[o] = i * stt + q * ct;
    }
  }
  // horizontal [1 2 1] / 4
  for (let py = 0; py < IH; py++) {
    const r = py * IW;
    for (let px = 1; px < IW - 1; px++) {
      const o = r + px;
      YT[o] = 0.25 * (YB[o - 1] + 2 * YB[o] + YB[o + 1]);
      IT[o] = 0.25 * (IB[o - 1] + 2 * IB[o] + IB[o + 1]);
      QT[o] = 0.25 * (QB[o - 1] + 2 * QB[o] + QB[o + 1]);
    }
    YT[r] = YB[r]; YT[r + IW - 1] = YB[r + IW - 1];
    IT[r] = IB[r]; IT[r + IW - 1] = IB[r + IW - 1];
    QT[r] = QB[r]; QT[r + IW - 1] = QB[r + IW - 1];
  }
  // vertical blur, focus, tone, vignette
  const foc = P.focus, cfoc = foc * 0.5, g = P.gain, bias = st.bias;
  let sum = 0;
  for (let py = 0; py < IH; py++) {
    const up = py > 0 ? -IW : 0, dn = py < IH - 1 ? IW : 0;
    for (let px = 0; px < IW; px++) {
      const o = py * IW + px;
      const by = 0.25 * (YT[o + up] + 2 * YT[o] + YT[o + dn]);
      const bi = 0.25 * (IT[o + up] + 2 * IT[o] + IT[o + dn]);
      const bq = 0.25 * (QT[o + up] + 2 * QT[o] + QT[o + dn]);
      let y = YB[o] + foc * (YB[o] - by);
      let i = IB[o] + cfoc * (IB[o] - bi);
      let q = QB[o] + cfoc * (QB[o] - bq);
      y = (y - bias) * g * vig[o];
      i *= g * vig[o]; q *= g * vig[o];
      if (y < 0) y = 0;
      else if (y > 0.55) y = 0.55 + 0.35 * tanh((y - 0.55) / 0.35);
      const c2 = i * i + q * q;
      if (c2 > 0.09) {
        const c = sqrt(c2), e = c - 0.3, f = (0.3 + e / (1 + e / 0.15)) / c;
        i *= f; q *= f;
      }
      YA[o] = y; IA[o] = i; QA[o] = q;
      sum += y;
    }
  }
  // a dark eye where the copies crowd below the size of an LED
  const hr = 12, hx0 = max(0, floor(P.fx - hr - 14)), hx1 = min(IW - 1, floor(P.fx + hr + 14));
  const hy0 = max(0, floor(P.fy - hr - 14)), hy1 = min(IH - 1, floor(P.fy + hr + 14));
  for (let y = hy0; y <= hy1; y++)
    for (let x = hx0; x <= hx1; x++) {
      const d = sqrt((x + 0.5 - P.fx) * (x + 0.5 - P.fx) + (y + 0.5 - P.fy) * (y + 0.5 - P.fy));
      if (d >= hr + 14) continue;
      const u = cl((d - hr) / 14, 0, 1), f = 0.45 + 0.55 * u * u * (3 - 2 * u), o = y * IW + x;
      YA[o] *= f; IA[o] *= f; QA[o] *= f;
    }
  st.mean = sum / N;
  st.bias = cl(st.bias + 0.01 * (st.mean - 0.14), 0.004, 0.15);
  lights(st, t);
}

const tanh = (x) => {
  const e = exp(2 * x);
  return (e - 1) / (e + 1);
};

const iq = [0, 0];

// Light that enters the loop each trip: a ring, an ellipse 1.7 times as tall
// as wide, cut into one to six arcs, and one small torch wandering.
function lights(st, t) {
  const k = st.k, P = st.P, YA = st.YA, IA = st.IA, QA = st.QA;
  const n = k[3];
  const lcx = IW / 2 + 6 * wob(t, 0.0293, 0.4), lcy = IH / 2 + 10 * wob(t, 0.0227, 2.4);
  const Ra = 46 + 5 * wob(t, 0.0173, 1.0), Rb = Ra * (1.6 + 0.18 * wob(t, 0.0457, 0.2)), psi = 0.48 * wob(t, 0.0143, 2.7) + 0.12 * wob(t, 0.0379, 0.4);
  const cpsi = cos(psi), spsi = sin(psi);
  const al = 0.35 * t + 1.0 * wob(t, 0.0137, 0.9);
  const half = 2.4, sector = TAU / n, cover = n < 3 ? 0.95 - 0.225 * (n - 1) : 0.5, len = cover * sector;
  const Rm = sqrt(Ra * Rb);
  hueIQ(P.hue, 0.36, iq);
  const ci = iq[0], cq = iq[1];
  const rr = Rb + 6, x0 = max(0, floor(lcx - rr)), x1 = min(IW - 1, floor(lcx + rr));
  const y0 = max(0, floor(lcy - rr)), y1 = min(IH - 1, floor(lcy + rr));
  const nArc = Math.ceil(n - 1e-6);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const ox = x + 0.5 - lcx, oy = y + 0.5 - lcy;
      const dx = ox * cpsi + oy * spsi, dy = -ox * spsi + oy * cpsi;
      const ex = dx / Ra, ey = dy / Rb, rho = sqrt(ex * ex + ey * ey);
      if (rho < 0.5 || rho > 1.5) continue;
      const gx = dx / (Ra * Ra), gy = dy / (Rb * Rb), gm = sqrt(gx * gx + gy * gy);
      const dist = ((rho - 1) * rho) / gm;
      if (abs(dist) > half + 1) continue;
      const ang = Math.atan2(ey, ex);
      let best = 0;
      for (let j = 0; j < nArc; j++) {
        const grow = j < nArc - 1 || n - j >= 1 ? 1 : n - j;
        const L = len * grow;
        let da = ang - (al + j * sector) - L / 2;
        da -= TAU * Math.round(da / TAU);
        if (abs(da) > L / 2 + 0.2) continue;
        const cov = cl(half - abs(dist) + 0.5, 0, 1);
        const u = cl(0.5 + da / L, 0, 1), e = min(0.3, 0.45 / (L * Rm / 12)), tp = u < e ? u / e : u > 1 - e ? (1 - u) / e : 1;
        const v = cov * tp * tp * (3 - 2 * tp);
        if (v > best) best = v;
      }
      if (best <= 0) continue;
      const o = y * IW + x;
      YA[o] += (0.58 - YA[o]) * best;
      IA[o] += (ci - IA[o]) * best;
      QA[o] += (cq - QA[o]) * best;
    }
  // the torch
  const tx = cl(IW / 2 + 34 * wob(t, 0.0613, 0.4), 14, IW - 14), ty = cl(IH / 2 + 60 * wob(t, 0.0437, 2.4) + 8 * wob(t, 0.1013, 1.1), 14, IH - 14);
  hueIQ(P.hue + 0.5, 0.34, iq);
  const r = 6.4;
  for (let y = floor(ty - r - 2); y <= floor(ty + r + 2); y++)
    for (let x = floor(tx - r - 2); x <= floor(tx + r + 2); x++) {
      const d = sqrt((x + 0.5 - tx) * (x + 0.5 - tx) + (y + 0.5 - ty) * (y + 0.5 - ty));
      const cov = cl(r - d + 0.5, 0, 1);
      if (cov <= 0) continue;
      const o = y * IW + x;
      YA[o] += (0.72 - YA[o]) * cov;
      IA[o] += (iq[0] - IA[o]) * cov;
      QA[o] += (iq[1] - QA[o]) * cov;
    }
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = input.knobValues || [0, 2, 0, 1];
  st.k = [cl(kv[0], 0, 1), cl(kv[1], 0.5, 4), cl(kv[2], -1, 1), cl(kv[3], 1, 6)];
  if (!st.ready) {
    st.ready = true;
    for (let i = 0; i < 90; i++) {
      st.t += 1 / 30;
      loop(st, st.t);
    }
  }
  const d = cl(dt || 0, 0, 0.1);
  st.t += d;
  st.acc += d * 30;
  let n = floor(st.acc);
  st.acc -= n;
  if (n > 3) n = 3;
  for (let i = 0; i < n; i++) loop(st, st.t - ((n - 1 - i) / 30));
}

export function draw(display, params) {
  const st = params.st;
  if (!st) return;
  const { YA, IA, QA } = st;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = (y * S) * IW + x * S;
      let Y = 0.25 * (YA[a] + YA[a + 1] + YA[a + IW] + YA[a + IW + 1]);
      const I = 0.25 * (IA[a] + IA[a + 1] + IA[a + IW] + IA[a + IW + 1]);
      const Q = 0.25 * (QA[a] + QA[a + 1] + QA[a + IW] + QA[a + IW + 1]);
      if (Y < 0) Y = 0;
      // dim tails of thin copies go out instead of lingering as dust
      let tf = 1;
      if (Y < 0.14) tf = Math.pow(Y / 0.14, 1.3);
      Y *= tf;
      let dr = (0.956 * I + 0.621 * Q) * tf, dg = (-0.272 * I - 0.647 * Q) * tf, db = (-1.106 * I + 1.703 * Q) * tf;
      let mn = min(dr, dg, db);
      if (Y + mn < 0) {
        const k = Y / (Y - (Y + mn));
        dr *= k; dg *= k; db *= k;
      }
      const mx = max(dr, dg, db);
      if (Y + mx > 1) {
        const k = (1 - Y) / mx;
        dr *= k; dg *= k; db *= k;
      }
      display.setPixel(x, y, ((Y + dr) * 255 + 0.5) | 0, ((Y + dg) * 255 + 0.5) | 0, ((Y + db) * 255 + 0.5) | 0);
    }
}
