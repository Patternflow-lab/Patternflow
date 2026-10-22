// ===== Patternflow pattern =====
// Title:   Jelly
// Family:  physics
// Idea:    Each jelly is a ring of eighteen masses held by springs and the pressure of what is inside, so dropped into the tall jar they squash, stack, wobble and roll off one another.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Gravity=-1..3, Softness=0..1, Count=4..12
//
// Knob 1: Hue. Turns the whole bag of sweets round the colour wheel; each jelly sits a golden step round from the last, so no two match.
// Knob 2: Gravity. Heavy at 3, a slow float at 0, and below 0 the jar is upside down and they pile against the lid.
// Knob 3: Softness. Firm gums at 0 that bounce and roll; at 1 water balloons that slump over each other.
// Knob 4: Count. How many are in the jar; new ones fall in one after another, and every jelly shrinks to share the room.
// Buttons: K1 tap shakes the jar.

const W = 64;
const H = 128;
const B = 12;
const M = 18;
const STEP = 1 / 90;
const ITER = 3;
// The jellies together take about a third of the jar, whatever their number.
const FILL = 0.5;

function hsvInto(out, o, h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 ? v : k === 1 ? q : k === 2 ? p : k === 3 ? p : k === 4 ? t : v) * 255;
  out[o + 1] = (k === 0 ? t : k === 1 ? v : k === 2 ? v : k === 3 ? q : k === 4 ? p : p) * 255;
  out[o + 2] = (k === 0 ? p : k === 1 ? p : k === 2 ? t : k === 3 ? v : k === 4 ? v : q) * 255;
}

export function setup(params) {
  params.px = new Float32Array(B * M);
  params.py = new Float32Array(B * M);
  params.ox = new Float32Array(B * M);
  params.oy = new Float32Array(B * M);
  params.r = new Float32Array(B);
  params.size = new Float32Array(B);
  params.on = new Uint8Array(B);
  params.inside = new Uint8Array(B);
  params.cx = new Float32Array(B);
  params.cy = new Float32Array(B);
  params.x0 = new Float32Array(B);
  params.x1 = new Float32Array(B);
  params.y0 = new Float32Array(B);
  params.y1 = new Float32Array(B);
  params.col = new Float32Array(B * 3);
  params.rim = new Float32Array(B * 3);
  params.id = new Uint8Array(W * H);
  params.dist = new Float32Array(W * H);
  params.cross = new Float32Array(M + 2);
  params.ringX = new Float32Array(M);
  params.ringY = new Float32Array(M);
  for (let k = 0; k < M; k++) {
    params.ringX[k] = Math.cos((k / M) * Math.PI * 2);
    params.ringY[k] = Math.sin((k / M) * Math.PI * 2);
  }
  for (let b = 0; b < B; b++) params.size[b] = 0.82 + Math.random() * 0.36;
  params.count = 0;
  params.hop = 0.6;
  params.acc = 0;
  params.t = 0;
  params.warm = false;
}

function radiusFor(params, b, count) {
  let sum = 0;
  for (let i = 0; i < count; i++) sum += params.size[i] * params.size[i];
  return Math.sqrt((FILL * W * H) / (Math.PI * sum)) * params.size[b];
}

function place(params, b, x, y, r, vx, vy) {
  for (let k = 0; k < M; k++) {
    const a = (k / M) * Math.PI * 2;
    const i = b * M + k;
    params.px[i] = x + Math.cos(a) * r;
    params.py[i] = y + Math.sin(a) * r;
    params.ox[i] = params.px[i] - vx * STEP;
    params.oy[i] = params.py[i] - vy * STEP;
  }
  params.r[b] = r;
  params.on[b] = 1;
}

function setCount(params, count, g, warm) {
  let queue = 0;
  for (let b = 0; b < B; b++) {
    if (b < count && !params.on[b]) {
      const r = radiusFor(params, b, count);
      if (warm) {
        // At the start they are already in the jar, in a loose stack to settle from.
        const col = b % 2;
        const row = Math.floor(b / 2);
        place(params, b, 18 + col * 28 + (Math.random() - 0.5) * 4, H - 16 - row * 26, r * 0.9, 0, 0);
        params.inside[b] = 1;
      } else {
        // A new one comes in from the side gravity points away from, already moving in.
        // Several at once queue up outside the jar, so they drop in one after another.
        const down = g >= 0;
        const wait = r + 2 + queue * (2 * r + 6);
        queue++;
        place(params, b, r + 2 + Math.random() * (W - 2 * r - 4), down ? -wait : H + wait, r, 0, down ? 90 : -90);
        params.inside[b] = 0;
      }
    }
  }
  params.count = count;
}

function nudge(params, b, vx, vy, spin) {
  const cx = params.cx[b];
  const cy = params.cy[b];
  for (let k = 0; k < M; k++) {
    const i = b * M + k;
    const dx = params.px[i] - cx;
    const dy = params.py[i] - cy;
    params.ox[i] -= (vx - dy * spin) * STEP;
    params.oy[i] -= (vy + dx * spin) * STEP;
  }
}

function centres(params) {
  const { px, py } = params;
  for (let b = 0; b < B; b++) {
    if (!params.on[b]) continue;
    let sx = 0;
    let sy = 0;
    let x0 = 1e9;
    let x1 = -1e9;
    let y0 = 1e9;
    let y1 = -1e9;
    for (let k = 0; k < M; k++) {
      const i = b * M + k;
      sx += px[i];
      sy += py[i];
      if (px[i] < x0) x0 = px[i];
      if (px[i] > x1) x1 = px[i];
      if (py[i] < y0) y0 = py[i];
      if (py[i] > y1) y1 = py[i];
    }
    params.cx[b] = sx / M;
    params.cy[b] = sy / M;
    params.x0[b] = x0;
    params.x1[b] = x1;
    params.y0[b] = y0;
    params.y1[b] = y1;
  }
}

// A mass that has slipped inside another jelly goes back out through the nearest
// edge, and that edge gives way by the same amount. Without this a mass caught
// inside stays there, far from every mass that could push it.
function pushOut(params, i, b) {
  const { px, py } = params;
  const x = px[i];
  const y = py[i];
  if (x < params.x0[b] || x > params.x1[b] || y < params.y0[b] || y > params.y1[b]) return;
  const o = b * M;
  let inside = false;
  for (let k = 0, m = M - 1; k < M; m = k++) {
    const yk = py[o + k];
    const ym = py[o + m];
    if (yk > y !== ym > y && x < ((px[o + m] - px[o + k]) * (y - yk)) / (ym - yk) + px[o + k]) inside = !inside;
  }
  if (!inside) return;
  let best = 1e9;
  let bj = 0;
  let bt = 0;
  for (let k = 0; k < M; k++) {
    const j = o + k;
    const n = o + ((k + 1) % M);
    const ex = px[n] - px[j];
    const ey = py[n] - py[j];
    let t = ((x - px[j]) * ex + (y - py[j]) * ey) / (ex * ex + ey * ey + 1e-6);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px[j] + ex * t - x;
    const dy = py[j] + ey * t - y;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      bj = k;
      bt = t;
    }
  }
  const j = o + bj;
  const n = o + ((bj + 1) % M);
  const dx = px[j] + (px[n] - px[j]) * bt - x;
  const dy = py[j] + (py[n] - py[j]) * bt - y;
  px[i] += dx * 0.6;
  py[i] += dy * 0.6;
  px[j] -= dx * 0.4 * (1 - bt);
  py[j] -= dy * 0.4 * (1 - bt);
  px[n] -= dx * 0.4 * bt;
  py[n] -= dy * 0.4 * bt;
}

function step(params, gx, gy, soft) {
  const { px, py, ox, oy, r, on, inside } = params;
  const dt2 = STEP * STEP;
  const count = params.count;
  for (let b = 0; b < B; b++) {
    if (!on[b]) continue;
    // Sizes ease to their share of the room; a jelly no longer counted shrinks away.
    const target = b < count ? radiusFor(params, b, count) : 0;
    r[b] += (target - r[b]) * 0.02;
    if (b >= count && r[b] < 1.2) {
      on[b] = 0;
      continue;
    }
    for (let k = 0; k < M; k++) {
      const i = b * M + k;
      const vx = (px[i] - ox[i]) * 0.997;
      const vy = (py[i] - oy[i]) * 0.997;
      ox[i] = px[i];
      oy[i] = py[i];
      px[i] += vx + gx * dt2;
      py[i] += vy + gy * dt2;
    }
  }

  const kEdge = 0.9 - soft * 0.55;
  const kSkip = 0.3 - soft * 0.27;
  const kArea = 0.6 - soft * 0.35;
  const kShape = 0.05 - soft * 0.042;
  for (let it = 0; it < ITER; it++) {
    for (let b = 0; b < B; b++) {
      if (!on[b]) continue;
      const o = b * M;
      const R = r[b];
      const edge = 2 * R * Math.sin(Math.PI / M);
      const skip = 2 * R * Math.sin((2 * Math.PI) / M);
      for (let k = 0; k < M; k++) {
        for (let s = 1; s <= 2; s++) {
          const i = o + k;
          const j = o + ((k + s) % M);
          const dx = px[j] - px[i];
          const dy = py[j] - py[i];
          const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
          const f = ((d - (s === 1 ? edge : skip)) / d) * 0.5 * (s === 1 ? kEdge : kSkip);
          px[i] += dx * f;
          py[i] += dy * f;
          px[j] -= dx * f;
          py[j] -= dy * f;
        }
      }
      // Pressure: push every mass out along the ring's normal until the area is back.
      let area = 0;
      let grad = 0;
      for (let k = 0; k < M; k++) {
        const i = o + k;
        const j = o + ((k + 1) % M);
        area += px[i] * py[j] - px[j] * py[i];
        const n = o + ((k + 1) % M);
        const p = o + ((k + M - 1) % M);
        const gxk = 0.5 * (py[n] - py[p]);
        const gyk = 0.5 * (px[p] - px[n]);
        grad += gxk * gxk + gyk * gyk;
      }
      area *= 0.5;
      const lambda = ((Math.PI * R * R - area) / (grad + 1e-6)) * kArea;
      for (let k = 0; k < M; k++) {
        const i = o + k;
        const n = o + ((k + 1) % M);
        const p = o + ((k + M - 1) % M);
        // The neighbours' positions have moved by a hair this pass; close enough for pressure.
        px[i] += 0.5 * (py[n] - py[p]) * lambda;
        py[i] += 0.5 * (px[p] - px[n]) * lambda;
      }
      // Shape matching: a weak pull back towards a circle turned the way the ring has
      // turned. It lets a jelly squash but never tie itself in a knot.
      let cx = 0;
      let cy = 0;
      for (let k = 0; k < M; k++) {
        cx += px[o + k];
        cy += py[o + k];
      }
      cx /= M;
      cy /= M;
      let dot = 0;
      let crs = 0;
      for (let k = 0; k < M; k++) {
        const qx = params.ringX[k];
        const qy = params.ringY[k];
        const dx = px[o + k] - cx;
        const dy = py[o + k] - cy;
        dot += qx * dx + qy * dy;
        crs += qx * dy - qy * dx;
      }
      const m = Math.sqrt(dot * dot + crs * crs) + 1e-6;
      const cs = (dot / m) * R;
      const sn = (crs / m) * R;
      for (let k = 0; k < M; k++) {
        const i = o + k;
        const qx = params.ringX[k];
        const qy = params.ringY[k];
        px[i] += (cx + cs * qx - sn * qy - px[i]) * kShape;
        py[i] += (cy + sn * qx + cs * qy - py[i]) * kShape;
      }
    }

    centres(params);
    // Jelly against jelly: masses of two rings keep a hair apart, and grip a little.
    const reach = 1.4;
    for (let a = 0; a < B; a++) {
      if (!on[a]) continue;
      for (let b = a + 1; b < B; b++) {
        if (!on[b]) continue;
        if (params.x0[a] - reach > params.x1[b] || params.x0[b] - reach > params.x1[a]) continue;
        if (params.y0[a] - reach > params.y1[b] || params.y0[b] - reach > params.y1[a]) continue;
        const r2 = reach * reach;
        for (let k = 0; k < M; k++) {
          const i = a * M + k;
          for (let m = 0; m < M; m++) {
            const j = b * M + m;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            const d2 = dx * dx + dy * dy;
            if (d2 >= r2) continue;
            const d = Math.sqrt(d2) + 1e-6;
            const f = ((reach - d) / d) * 0.5;
            px[i] -= dx * f;
            py[i] -= dy * f;
            px[j] += dx * f;
            py[j] += dy * f;
            // A little grip where they touch, so a stack holds and a top one rolls off.
            const fx = ((px[i] - ox[i]) - (px[j] - ox[j])) * 0.08;
            const fy = ((py[i] - oy[i]) - (py[j] - oy[j])) * 0.08;
            ox[i] += fx;
            oy[i] += fy;
            ox[j] -= fx;
            oy[j] -= fy;
          }
        }
      }
    }

    for (let a = 0; a < B; a++) {
      if (!on[a]) continue;
      for (let b = 0; b < B; b++) {
        if (b === a || !on[b]) continue;
        if (params.x0[a] > params.x1[b] || params.x0[b] > params.x1[a]) continue;
        if (params.y0[a] > params.y1[b] || params.y0[b] > params.y1[a]) continue;
        for (let k = 0; k < M; k++) pushOut(params, a * M + k, b);
      }
    }

    for (let b = 0; b < B; b++) {
      if (!on[b]) continue;
      if (!inside[b]) {
        if (params.y0[b] > 0.5 && params.y1[b] < H - 0.5) inside[b] = 1;
      }
      for (let k = 0; k < M; k++) {
        const i = b * M + k;
        if (px[i] < 0.5) {
          px[i] = 0.5;
          oy[i] += (py[i] - oy[i]) * 0.3;
        } else if (px[i] > W - 0.5) {
          px[i] = W - 0.5;
          oy[i] += (py[i] - oy[i]) * 0.3;
        }
        if (!inside[b]) continue;
        if (py[i] > H - 0.5) {
          py[i] = H - 0.5;
          ox[i] += (px[i] - ox[i]) * 0.3;
        } else if (py[i] < 0.5) {
          py[i] = 0.5;
          ox[i] += (px[i] - ox[i]) * 0.3;
        }
      }
    }
  }
}

function simulate(params, dt, k, shake) {
  const gravity = k[1];
  const soft = Math.max(0, Math.min(1, k[2]));
  const count = Math.max(4, Math.min(B, Math.round(k[3])));
  // The jar rocks a little in the hand, so the pile keeps sliding and settling.
  const tilt = Math.sin(params.t * 0.45) * 0.16;
  const g = gravity * 150;
  const gx = Math.sin(tilt) * g;
  const gy = Math.cos(tilt) * g;
  if (count !== params.count) setCount(params, count, g, false);
  centres(params);

  params.hop -= dt;
  if (params.hop <= 0 || shake) {
    // One of them gives a hop, or with a shake all of them are thrown.
    params.hop = 0.9 + Math.random() * 1.4;
    const up = g > 25 ? -1 : g < -25 ? 1 : Math.random() < 0.5 ? -1 : 1;
    const pick = Math.floor(Math.random() * params.count);
    for (let b = 0; b < B; b++) {
      if (!params.on[b] || !params.inside[b]) continue;
      if (!shake && b !== pick) continue;
      const lift = shake ? 230 + Math.random() * 170 : 160 + Math.random() * 110;
      nudge(params, b, (Math.random() - 0.5) * (shake ? 280 : 90), up * lift, (Math.random() - 0.5) * 6);
    }
  }

  params.acc += dt;
  let n = 0;
  while (params.acc >= STEP && n < 9) {
    params.acc -= STEP;
    params.t += STEP;
    step(params, gx, gy, soft);
    n++;
  }
  if (n === 9) params.acc = 0;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 4];
  dt = Math.min(dt, 0.1);
  params.hue = k[0] + 0.3;
  if (!params.warm) {
    params.warm = true;
    setCount(params, Math.max(4, Math.min(B, Math.round(k[3]))), k[1], true);
    for (let s = 0; s < 90; s++) simulate(params, STEP, k, false);
  }
  simulate(params, dt, k, input.btnPressed && input.btnPressed[0]);
}

export function draw(display, params, time) {
  const { px, py, id, dist, cross, col, rim } = params;
  id.fill(0);
  centres(params);
  for (let b = 0; b < B; b++) {
    if (!params.on[b]) continue;
    // Neighbours a golden step apart round the wheel never land on the same colour.
    const h = params.hue + b * 0.381966;
    hsvInto(col, b * 3, h, 0.78, 1);
    hsvInto(rim, b * 3, h + 0.03, 0.35, 1);
    const o = b * M;
    const yA = Math.max(0, Math.floor(params.y0[b]));
    const yB = Math.min(H - 1, Math.ceil(params.y1[b]));
    for (let y = yA; y <= yB; y++) {
      const sy = y + 0.5;
      let n = 0;
      for (let k = 0; k < M; k++) {
        const i = o + k;
        const j = o + ((k + 1) % M);
        const ya = py[i];
        const yb = py[j];
        if (ya <= sy === yb <= sy) continue;
        const x = px[i] + ((sy - ya) * (px[j] - px[i])) / (yb - ya);
        let m = n++;
        while (m > 0 && cross[m - 1] > x) {
          cross[m] = cross[m - 1];
          m--;
        }
        cross[m] = x;
      }
      for (let c = 0; c + 1 < n; c += 2) {
        const xa = Math.max(0, Math.ceil(cross[c] - 0.5));
        const xb = Math.min(W - 1, Math.floor(cross[c + 1] - 0.5));
        for (let x = xa; x <= xb; x++) id[y * W + x] = b + 1;
      }
    }
  }

  // How far each lit LED is from the edge of its own jelly, by a two-pass chamfer.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const v = id[o];
      if (!v) continue;
      const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1 || id[o - 1] !== v || id[o + 1] !== v || id[o - W] !== v || id[o + W] !== v;
      dist[o] = edge ? 0 : 99;
    }
  for (let y = 1; y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const o = y * W + x;
      if (!id[o]) continue;
      let d = dist[o];
      if (dist[o - 1] + 1 < d) d = dist[o - 1] + 1;
      if (dist[o - W] + 1 < d) d = dist[o - W] + 1;
      if (dist[o - W - 1] + 1.41 < d) d = dist[o - W - 1] + 1.41;
      if (dist[o - W + 1] + 1.41 < d) d = dist[o - W + 1] + 1.41;
      dist[o] = d;
    }
  for (let y = H - 2; y >= 0; y--)
    for (let x = W - 2; x >= 1; x--) {
      const o = y * W + x;
      if (!id[o]) continue;
      let d = dist[o];
      if (dist[o + 1] + 1 < d) d = dist[o + 1] + 1;
      if (dist[o + W] + 1 < d) d = dist[o + W] + 1;
      if (dist[o + W + 1] + 1.41 < d) d = dist[o + W + 1] + 1.41;
      if (dist[o + W - 1] + 1.41 < d) d = dist[o + W - 1] + 1.41;
      dist[o] = d;
    }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const v = id[o];
      if (!v) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const b = v - 1;
      const c = b * 3;
      const d = dist[o];
      if (d < 0.5) {
        // A dark seam where two jellies touch keeps each one whole.
        display.setPixel(x, y, col[c] * 0.22, col[c + 1] * 0.22, col[c + 2] * 0.22);
        continue;
      }
      if (d < 1.5) {
        display.setPixel(x, y, rim[c] * 0.9, rim[c + 1] * 0.9, rim[c + 2] * 0.9);
        continue;
      }
      const R = params.r[b];
      const ex = (params.x1[b] - params.x0[b]) * 0.5 + 0.5;
      const ey = (params.y1[b] - params.y0[b]) * 0.5 + 0.5;
      // A dome: thin near the rim, full in the middle.
      const u = Math.min(1, (d - 1) / (0.5 * R));
      const dome = Math.sqrt(1 - (1 - u) * (1 - u));
      let lv = 0.64 + 0.28 * dome;
      // Light through the jelly gathers low and to the right, opposite the shine.
      const gx = (x + 0.5 - params.cx[b] - ex * 0.25) / (ex * 0.6);
      const gy = (y + 0.5 - params.cy[b] - ey * 0.3) / (ey * 0.55);
      const glow = 1 - gx * gx - gy * gy;
      if (glow > 0) lv += glow * 0.25;
      let r = col[c] * lv;
      let g = col[c + 1] * lv;
      let bl = col[c + 2] * lv;
      const sx = (x + 0.5 - params.cx[b] + ex * 0.4) / (ex * 0.28);
      const sy = (y + 0.5 - params.cy[b] + ey * 0.45) / (ey * 0.2);
      const shine = 1 - sx * sx - sy * sy;
      if (shine > 0) {
        const s = Math.min(1, shine * 1.8) * 0.85;
        r += (235 - r) * s;
        g += (235 - g) * s;
        bl += (235 - bl) * s;
      }
      display.setPixel(x, y, Math.min(235, r), Math.min(235, g), Math.min(235, bl));
    }
}
