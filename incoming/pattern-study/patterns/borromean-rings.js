// ===== Patternflow pattern =====
// Title:   Borromean Rings
// Family:  topology
// Idea:    Three lit tubes bent into the golden-rectangle model of the Borromean rings, stretched to 2.3 times their height to stand on the panel, turn slowly round the tall one's axis so the over and under crossings come round in turn, and no two of them are linked: take one away and the other two slide apart.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Borromean rings (Peter Guthrie Tait, 1876), pattern round 33
// Round:   33
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Aspect=1.618..2.4, Tube=0..1
//
// Knob 1: Hue. Turns the three colours round the wheel together, a third apart. At 0 the tall ring is azure, the ring across it pink and the flat ring round the waist lime; a ring that comes round to orange or yellow is laid paler, peach or butter, so its shaded side does not go brown.
// Knob 2: Speed. How fast the rings turn. At 2 one turn takes 20 s and the view nods up and down every 27 s; at 0.2 ten times slower.
// Knob 3: Aspect. Long side over short side of the rectangles before the stretch. At 1.618 they are golden and their 12 corners would be an icosahedron; at 2.4 they are longer and thinner and the room where each passes through the next grows from 0.62 to 1 short side.
// Knob 4: Tube. How much of that room the tubes fill: 29% at 0, so there are about three LEDs of air where one ring passes through the next; at 1, 45%, and they pass within a LED of each other without touching.
// Buttons: K1 tap fades out the ring across the tall one (pink at the opening). With it gone the flat ring slides down the tall ring and off its bottom end in 3 s, since the two were never linked, waits below it, climbs back, and the third ring returns to lock them again; 7.4 s in all.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, sqrt, sin, cos, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The model, short side a = 1. Each ring lies in one coordinate plane:
//   R1 in x = 0, half sides z1 = r and y1 = SIG,
//   R2 in z = 0, half sides x2 = 1 and y2 = SIG r (the tall one),
//   R3 in y = 0, half sides x3 = r and z3 = 1 (the flat one round the waist).
// Unstretched (SIG = 1, r = phi) these are Tait's three golden rectangles.
// The link only asks y1 < y2, x2 < x3 and z3 < z1: along each axis one ring
// passes through the next. Stretching along y keeps all three, so the model
// can be drawn 2.3 times as tall, which the 64 x 128 panel needs: unstretched
// it fits a cube and would light a band about 50 rows high.
const SIG = 2.3;
// Corners rounded to 0.4 of the short side, the camera 12 units away.
const RC = 0.4, CAM = 12;
// Light from the upper left and in front, and the half vector for the shine.
const LX = -0.48, LY = -0.62, LZ = -0.62, LN = 1 / sqrt(LX * LX + LY * LY + LZ * LZ);
const lx = LX * LN, ly = LY * LN, lz = LZ * LN;
const HX = lx, HY = ly, HZ = lz - 1, HN = 1 / sqrt(HX * HX + HY * HY + HZ * HZ);
const hx = HX * HN, hy = HY * HN, hz = HZ * HN;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Points round a rounded rectangle with half sides A (along u) and B (along
// v), about one every `step`, as (u, v) pairs. Four sides and four arcs.
function loop(A, B, c, step, out) {
  let n = 0;
  const side = (u0, v0, u1, v1) => {
    const len = sqrt((u1 - u0) ** 2 + (v1 - v0) ** 2), k = max(1, ceil(len / step));
    for (let i = 0; i < k; i++) (out[n++] = u0 + ((u1 - u0) * i) / k), (out[n++] = v0 + ((v1 - v0) * i) / k);
  };
  const arc = (cu, cv, a0) => {
    const k = max(2, ceil((c * PI) / 2 / step));
    for (let i = 0; i < k; i++) {
      const a = a0 + ((PI / 2) * i) / k;
      out[n++] = cu + c * cos(a);
      out[n++] = cv + c * sin(a);
    }
  };
  const a = A - c, b = B - c;
  side(A, -b, A, b);
  arc(a, b, 0);
  side(a, B, -a, B);
  arc(-a, b, PI / 2);
  side(-A, b, -A, -b);
  arc(-a, -b, PI);
  side(-a, -B, a, -B);
  arc(a, -b, 1.5 * PI);
  return n >> 1;
}

export function setup(params) {
  params.s = {
    turn: 0.6, nod: 0, hue: 0, speed: 2, r: 1.618, tube: 0.06, cut: -1,
    z: [new Float32Array(N), new Float32Array(N), new Float32Array(N)],
    c: [new Float32Array(N * 3), new Float32Array(N * 3), new Float32Array(N * 3)],
    fid: new Int8Array(N), fz: new Float32Array(N), uv: new Float32Array(8192), pts: new Float32Array(16384), col: new Float32Array(9),
  };
}

// K1 tap, seconds: R1 fades 0 to 0.8, the other two slide apart to 3.0,
// hold to 4.4, slide back to 6.6, R1 returns by 7.4.
const T_END = 7.4;
function cutState(t) {
  if (t < 0) return [1, 0, 0];
  const fade = t < 0.8 ? 1 - sm(t / 0.8) : t < 6.6 ? 0 : sm((t - 6.6) / 0.8);
  const sep = t < 0.8 ? 0 : t < 3 ? sm((t - 0.8) / 2.2) : t < 4.4 ? 1 : t < 6.6 ? 1 - sm((t - 4.4) / 2.2) : 0;
  return [fade, sep, sm(t / 1.2) * (1 - sm((t - 6.2) / 1.2))];
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 1.618, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.r = cl(k[2], 1.618, 2.4);
  P.tube = cl(k[3], 0, 1);
  P.turn += d * P.speed * 0.157;
  P.nod += d * P.speed * 0.116;
  if (P.cut >= 0) {
    P.cut += d;
    if (P.cut > T_END) P.cut = -1;
  }
  if (input.btnPressed && input.btnPressed[0] && P.cut < 0) P.cut = 0;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const r = P.r, ZB = P.z, CB = P.c, uv = P.uv, pts = P.pts, col = P.col, fid = P.fid, fz = P.fz;
  // The room where a ring passes through the next: one short side, or r - 1
  // of it where the long side is shorter than two.
  const room = min(1, r - 1), tr = (0.29 + 0.16 * P.tube) * room;
  // LEDs to a unit: the flat ring's corners swing out to rxz from the axis,
  // and the panel is 64 across; the tall ring is SIG r high each side of the
  // middle, and the panel is 128 tall.
  const rxz = sqrt((r - RC) ** 2 + (1 - RC) ** 2) + RC + tr;
  const S = min(27 / rxz, 55 / (SIG * r + tr));
  const [fade, sep, low] = cutState(P.cut);
  // With R1 gone the flat ring drops down the tall ring until it
  // clears the bottom end with 0.6 of a unit of air between the tubes, and
  // the tall ring rises a little to meet it.
  const drop = sep * (SIG * r + 2 * tr + 0.6);
  const up2 = drop * 0.2, down3 = drop * 0.8;

  // The rings turn round the tall ring's axis and the view looks down on them
  // from 14 to 30 degrees, so the flat ring always shows its hole. While the
  // rings come apart the eye sinks to 7 degrees below the middle, near the
  // height the flat ring drops to, so the air between it and the bottom of
  // the tall ring shows.
  const th = P.turn, ct = cos(th), st = sin(th);
  const el = (0.38 + 0.14 * sin(P.nod)) * (1 - low) - 0.12 * low, ce = cos(el), se = sin(el);

  for (let i = 0; i < 9; i += 3) hsv(P.hue + 0.58 + (i / 9), 0.8, 1, col, i);
  // Round orange and yellow the colour goes brown in the shade, so there it
  // keeps less saturation and more light.
  const warm = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let h = P.hue + 0.58 + i / 3;
    h -= floor(h);
    let dh = h - 0.12;
    if (dh > 0.5) dh -= 1;
    warm[i] = sm(1 - abs(dh) / 0.17);
    for (let c = 0; c < 3; c++) col[i * 3 + c] += (1 - col[i * 3 + c]) * 0.45 * warm[i];
  }

  // Ring order in the buffers: 0 the tall ring (R2), 1 the one across it (R1), 2 the flat one (R3).
  for (let ring = 0; ring < 3; ring++) {
    const zb = ZB[ring], cb = CB[ring];
    zb.fill(1e9);
    let A, B;
    if (ring === 0) (A = 1), (B = SIG * r);
    else if (ring === 1) (A = r), (B = SIG);
    else (A = r), (B = 1);
    const n = loop(A, B, RC * min(A, B), tr * 0.3, uv);
    const cr = col[ring * 3], cg = col[ring * 3 + 1], cbl = col[ring * 3 + 2], wl = warm[ring];
    // Every point on screen first, so each can see its neighbours for the
    // tube's direction.
    for (let i = 0; i < n; i++) {
      const u = uv[i * 2], v = uv[i * 2 + 1];
      let X, Y, Z;
      if (ring === 0) (X = u), (Y = v + up2), (Z = 0);
      else if (ring === 1) (X = 0), (Y = v), (Z = u);
      else (X = u), (Y = -down3), (Z = v);
      // Turn about y, then tip the view down by el.
      const xr = X * ct + Z * st, zr = -X * st + Z * ct;
      const up = Y * ce + zr * se, dep = zr * ce - Y * se;
      const sc = (S * CAM) / (CAM + dep);
      pts[i * 4] = 31.5 + xr * sc;
      pts[i * 4 + 1] = 63.5 - up * sc;
      pts[i * 4 + 2] = dep * S;
      pts[i * 4 + 3] = tr * sc;
    }
    for (let i = 0; i < n; i++) {
      const o = i * 4, sx = pts[o], sy = pts[o + 1], dz = pts[o + 2], rp = pts[o + 3];
      const a = ((i + 1) % n) * 4, b = ((i + n - 1) % n) * 4;
      let tx = pts[a] - pts[b], ty = pts[a + 1] - pts[b + 1], tz = pts[a + 2] - pts[b + 2];
      const tl = 1 / (sqrt(tx * tx + ty * ty + tz * tz) + 1e-9);
      (tx *= tl), (ty *= tl), (tz *= tl);
      // Nearer is brighter: a quarter darker at the back of the rings.
      const fog = 1 - 0.25 * cl((dz / S + 2) / 4, 0, 1);
      const x0 = max(0, floor(sx - rp)), x1 = min(W - 1, ceil(sx + rp)), y0 = max(0, floor(sy - rp)), y1 = min(H - 1, ceil(sy + rp));
      const r2 = rp * rp;
      for (let y = y0; y <= y1; y++) {
        const ny = y - sy, ny2 = ny * ny;
        for (let x = x0; x <= x1; x++) {
          const nx = x - sx, d2 = nx * nx + ny2;
          if (d2 >= r2) continue;
          const nzp = sqrt(r2 - d2), z = dz - nzp, p = y * W + x;
          if (z >= zb[p]) continue;
          zb[p] = z;
          // The tube is drawn as a chain of spheres, but the normal is the
          // tube's: the sphere's, less its part along the tube.
          const dt = nx * tx + ny * ty - nzp * tz;
          let Nx = nx - dt * tx, Ny = ny - dt * ty, Nz = -nzp - dt * tz;
          const nl = 1 / (sqrt(Nx * Nx + Ny * Ny + Nz * Nz) + 1e-9);
          (Nx *= nl), (Ny *= nl), (Nz *= nl);
          const dif = max(0, Nx * lx + Ny * ly + Nz * lz);
          const hv = max(0, Nx * hx + Ny * hy + Nz * hz), sp = hv ** 24 * 0.85;
          const lit = (0.2 + 0.3 * wl + 0.8 * dif) * fog;
          cb[p * 3] = cr * lit + sp;
          cb[p * 3 + 1] = cg * lit + sp;
          cb[p * 3 + 2] = cbl * lit + sp;
        }
      }
    }
  }

  // The nearest solid ring at each LED, for the gaps.
  const al = [1, fade, 1];
  for (let p = 0; p < N; p++) {
    let best = -1, bz = 1e9;
    for (let ring = 0; ring < 3; ring++) if (al[ring] > 0.5 && ZB[ring][p] < bz) (bz = ZB[ring][p]), (best = ring);
    fid[p] = best;
    fz[p] = bz;
  }
  const gapDepth = tr * S * 1.1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // Layers front to back: R1 fades by its alpha.
      const z0 = ZB[0][p], z1 = ZB[1][p], z2 = ZB[2][p];
      let R = 0, G = 0, Bc = 0;
      if (z0 < 1e8 || z1 < 1e8 || z2 < 1e8) {
        const ord = z0 <= z1 ? (z1 <= z2 ? [0, 1, 2] : z0 <= z2 ? [0, 2, 1] : [2, 0, 1]) : z0 <= z2 ? [1, 0, 2] : z1 <= z2 ? [1, 2, 0] : [2, 1, 0];
        let keep = 1;
        for (let j = 0; j < 3 && keep > 0.001; j++) {
          const ring = ord[j];
          if (ZB[ring][p] > 1e8) break;
          const a = al[ring] * keep, cb = CB[ring];
          R += cb[p * 3] * a;
          G += cb[p * 3 + 1] * a;
          Bc += cb[p * 3 + 2] * a;
          keep -= a;
        }
        // A dark LED where a nearer tube of another ring passes over this
        // one, so the crossing reads as over and under.
        const me = fid[p];
        if (me >= 0) {
          const zme = fz[p];
          let dark = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= W || (dx === 0 && dy === 0)) continue;
              const q = yy * W + xx, o = fid[q];
              if (o >= 0 && o !== me && fz[q] < zme - gapDepth) dark = 1;
            }
          }
          if (dark) (R *= 0.12), (G *= 0.12), (Bc *= 0.12);
        }
      }
      display.setPixel(x, y, cl(R * 255, 0, 255), cl(G * 255, 0, 255), cl(Bc * 255, 0, 255));
    }
}
