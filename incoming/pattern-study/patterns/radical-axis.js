// ===== Patternflow pattern =====
// Title:   Radical Axis
// Family:  geometry
// Idea:    Two circles have a straight line of points from which the tangents to both are the same length, and a circle drawn about any point on that line with that length as its radius cuts both circles at right angles, however the two circles are moved.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The radical axis of two circles, from the power of a point (Jakob Steiner, 1826; the axis named by Louis Gaultier, 1813), original, pattern round 139
// Round:   139
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Gap=-1..1, Slide=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The two circles take two colours half a wheel apart, and the plane on each side of the line takes a dark tint of the colour of the circle on that side.
// Knob 2: Size. The radius of the lower circle, from a small one to a little larger than the upper one, which stays the same. The line slides toward the circle that shrinks.
// Knob 3: Gap. The distance between the two centres. Turned down, the lower circle sinks into the upper one without ever being swallowed; turned up, the two come apart and the line stands in the space between them.
// Knob 4: Slide. Where the white circle's centre sits along the line. Start is a little to the right, where the white circle just clears both; turned left the centre goes into the overlap and the white circle shrinks to the point where the two circles cross and is gone.

const W = 64;
const H = 128;
// The figure turns about the middle of the panel.
const MX = 32;
const MY = 64;
const R1 = 19;

function hsv(h, s, v, out, at) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[at] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[at + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[at + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  // c1x, c1y, r1, c2x, c2y, r2, the point on the line, the axis direction u (from circle 1 to circle 2) and its normal n.
  params.g = new Float32Array(16);
  // The white circle: centre x, y and radius (0 when there is none), then the four points where it touches the two circles.
  params.w = new Float32Array(3);
  params.tx = new Float32Array(4);
  params.ty = new Float32Array(4);
  params.col = new Float32Array(18);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath turns the figure a few degrees and moves each value a few percent.
  const phi = 0.1 * Math.sin(t * 0.37 + 0.5);
  const r1 = R1 * (1 + 0.04 * Math.sin(t * 0.29 + 1.3));
  const r2 = (5 + 5.5 * k[1]) * (1 + 0.04 * Math.sin(t * 0.41 + 2.4));
  const dmin = Math.abs(r1 - r2) + 5;
  const dmax = 1.55 * (r1 + r2);
  let f = (Math.max(-1, Math.min(1, k[2])) + 1) * 0.5;
  f = Math.pow(f, 1.4);
  const d = (dmin + (dmax - dmin) * f) * (1 + 0.05 * Math.sin(t * 0.33 + 0.9));
  const ux = Math.sin(phi);
  const uy = Math.cos(phi);
  const nx = Math.cos(phi);
  const ny = -Math.sin(phi);
  // Circle 1 is put so that the two circles together are centred on the panel's middle along the line of centres.
  const sMid = (d + r2 - r1) * 0.5;
  const g = params.g;
  g[0] = MX - ux * sMid;
  g[1] = MY - uy * sMid;
  g[2] = r1;
  g[3] = g[0] + ux * d;
  g[4] = g[1] + uy * d;
  g[5] = r2;
  // The line of equal power crosses the line of centres d1 from circle 1.
  const d1 = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  g[6] = g[0] + ux * d1;
  g[7] = g[1] + uy * d1;
  g[8] = ux;
  g[9] = uy;
  g[10] = nx;
  g[11] = ny;
  g[12] = d1;
  // The white circle sits on that line, s LEDs to the right. Its radius squared is the power of that point, the square of the
  // tangent length to either circle, and when that is not above zero the point is inside the circles and there is no circle.
  const s = 16 + 20 * (k[3] - 0.06) + 1.5 * Math.sin(t * 0.27 + 2);
  const power = d1 * d1 + s * s - r1 * r1;
  const w = params.w;
  const mx = g[6] + nx * s;
  const my = g[7] + ny * s;
  w[0] = mx;
  w[1] = my;
  w[2] = power > 0.25 ? Math.sqrt(power) : 0;
  // Where the white circle meets circle i, the tangent points: along the line from the centre to the middle at r^2 / D, and
  // out to either side of it by r R / D, with D the distance from that centre to the middle and R the white radius.
  const tx = params.tx;
  const ty = params.ty;
  for (let i = 0; i < 2; i++) {
    const cx = g[i * 3];
    const cy = g[i * 3 + 1];
    const r = g[i * 3 + 2];
    const dx = mx - cx;
    const dy = my - cy;
    const dd = Math.max(0.001, Math.hypot(dx, dy));
    const ex = dx / dd;
    const ey = dy / dd;
    const a = (r * r) / dd;
    const h = (r * w[2]) / dd;
    tx[i * 2] = cx + ex * a - ey * h;
    ty[i * 2] = cy + ey * a + ex * h;
    tx[i * 2 + 1] = cx + ex * a + ey * h;
    ty[i * 2 + 1] = cy + ey * a - ex * h;
  }
  const col = params.col;
  hsv(k[0] + 0.03, 0.74, 0.95, col, 0);
  hsv(k[0] + 0.53, 0.72, 0.95, col, 3);
  hsv(k[0] + 0.03, 0.74, 0.34, col, 6);
  hsv(k[0] + 0.53, 0.72, 0.34, col, 9);
  hsv(k[0] + 0.03, 0.6, 0.14, col, 12);
  hsv(k[0] + 0.53, 0.6, 0.14, col, 15);
}

function seg(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  let u = ((x - ax) * dx + (y - ay) * dy) / Math.max(0.0001, dx * dx + dy * dy);
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  const ex = x - (ax + dx * u);
  const ey = y - (ay + dy * u);
  return Math.sqrt(ex * ex + ey * ey);
}

export function draw(display, params, time) {
  const g = params.g;
  const w = params.w;
  const tx = params.tx;
  const ty = params.ty;
  const col = params.col;
  const c1x = g[0];
  const c1y = g[1];
  const r1 = g[2];
  const c2x = g[3];
  const c2y = g[4];
  const r2 = g[5];
  const ax = g[6];
  const ay = g[7];
  const ux = g[8];
  const uy = g[9];
  const mx = w[0];
  const my = w[1];
  const wr = w[2];
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5;
      // Which side of the line of equal power the LED is on: the sign of its distance along u from the line.
      const sd = (xx - ax) * ux + (yy - ay) * uy;
      let r;
      let gg;
      let b;
      if (sd < 0) {
        r = col[12];
        gg = col[13];
        b = col[14];
      } else {
        r = col[15];
        gg = col[16];
        b = col[17];
      }
      // The two discs, dim, so that where they overlap the two colours add.
      const e1 = Math.hypot(xx - c1x, yy - c1y);
      const e2 = Math.hypot(xx - c2x, yy - c2y);
      let f1 = r1 - e1 + 0.5;
      if (f1 > 1) f1 = 1;
      if (f1 > 0) {
        r += col[6] * f1;
        gg += col[7] * f1;
        b += col[8] * f1;
      }
      let f2 = r2 - e2 + 0.5;
      if (f2 > 1) f2 = 1;
      if (f2 > 0) {
        r += col[9] * f2;
        gg += col[10] * f2;
        b += col[11] * f2;
      }
      // The two rings, bright.
      let q1 = 1.5 - Math.abs(e1 - r1);
      if (q1 > 0) {
        if (q1 > 1) q1 = 1;
        r += (col[0] - r) * q1;
        gg += (col[1] - gg) * q1;
        b += (col[2] - b) * q1;
      }
      let q2 = 1.5 - Math.abs(e2 - r2);
      if (q2 > 0) {
        if (q2 > 1) q2 = 1;
        r += (col[3] - r) * q2;
        gg += (col[4] - gg) * q2;
        b += (col[5] - b) * q2;
      }
      // The line of equal power, white.
      let cl = 1.2 - Math.abs(sd);
      // The white circle, thinner, and its four radii to the tangent points, which are the four equal tangents.
      if (wr > 0) {
        const cw = 1.1 - Math.abs(Math.hypot(xx - mx, yy - my) - wr);
        if (cw > cl) cl = cw;
        let dr = 99;
        for (let i = 0; i < 4; i++) {
          const dq = seg(xx, yy, mx, my, tx[i], ty[i]);
          if (dq < dr) dr = dq;
        }
        const cr = (0.9 - dr) * 0.6;
        if (cr > cl) cl = cr;
        for (let i = 0; i < 4; i++) {
          const ex = xx - tx[i];
          const ey = yy - ty[i];
          const qd = ex * ex + ey * ey;
          if (qd < 7) {
            const cd = 2.2 - Math.sqrt(qd);
            if (cd > cl) cl = cd;
          }
        }
      }
      // Its centre.
      const ex = xx - mx;
      const ey = yy - my;
      const qm = ex * ex + ey * ey;
      if (qm < 9) {
        const cd = 2.4 - Math.sqrt(qm);
        if (cd > cl) cl = cd;
      }
      if (cl > 0) {
        if (cl > 1) cl = 1;
        r += (250 - r) * cl;
        gg += (246 - gg) * cl;
        b += (236 - b) * cl;
      }
      display.setPixel(x, y, r, gg, b);
    }
  }
}
