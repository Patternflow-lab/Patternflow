// ===== Patternflow pattern =====
// Title:   Voronoi
// Family:  cells
// Idea:    Seeds swirl in a current and every LED takes the colour of the nearest one, so flat panes of glass jostle behind lead, each with a roundel at its seed that turns from disc to diamond to square as the measure of distance changes.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..6, Cells=20..60, Metric=0..2
//
// Knob 1: Hue. The colour of most of the glass; a few panes take the colours across the wheel from it.
// Knob 2: Speed. How fast the current carries the seeds round.
// Knob 3: Cells. How many panes, from 20 big ones to 60 small ones.
// Knob 4: Metric. How distance is measured: 0 is a ruler, 1 is city blocks, 2 is a king's moves on a chessboard, and the roundels go disc, diamond, square.
// Buttons: K1 tap reshuffles the glass colours.

const W = 64;
const H = 128;
const MAX = 64;
// Buckets of 8x8 LEDs, each holding the few seeds that can own one of its LEDs.
const B = 8;
const BX = W / B;
const BY = H / B;
// Seeds keep this far off the frame, so a roundel is seldom cut in half.
const EDGE = 2.5;

// Kinds of glass: hue offset, saturation, brightness, and how often each turns up.
const GLASS = [
  [0.0, 0.95, 0.9, 0.34],
  [0.0, 0.8, 0.62, 0.2],
  [-0.1, 0.9, 0.85, 0.16],
  [0.07, 0.75, 1.0, 0.1],
  [0.5, 0.95, 1.0, 0.12],
  [0.38, 0.9, 0.9, 0.08],
];

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function pickGlass(p) {
  for (let i = 0; i < MAX; i++) {
    let r = Math.random();
    let g = 0;
    while (g < GLASS.length - 1 && r > GLASS[g][3]) {
      r -= GLASS[g][3];
      g++;
    }
    p.kind[i] = g;
    p.jitter[i] = (Math.random() - 0.5) * 0.05;
  }
  p.hue = -1;
}

// The current is a stream function made of four box modes, (1,2), (1,3),
// (2,3) and (1,1), whose strengths rise and fall out of step. A stream
// function cannot pile seeds up, and a box mode never flows through a wall,
// so the seeds stay spread out and on the panel; the mix keeps the vortices
// moving. Each mode is scaled so its fastest point moves at about one unit.
function flow(amp, x, y, out) {
  const px = Math.PI / W;
  const py = Math.PI / H;
  const s1x = Math.sin(px * x), c1x = Math.cos(px * x);
  const s2x = Math.sin(2 * px * x), c2x = Math.cos(2 * px * x);
  const s1y = Math.sin(py * y), c1y = Math.cos(py * y);
  const s2y = Math.sin(2 * py * y), c2y = Math.cos(2 * py * y);
  const s3y = Math.sin(3 * py * y), c3y = Math.cos(3 * py * y);
  out[0] = amp[0] * 0.71 * s1x * c2y + amp[1] * 0.83 * s1x * c3y + amp[2] * 0.6 * s2x * c3y + amp[3] * 0.45 * s1x * c1y;
  out[1] = -amp[0] * 0.71 * c1x * s2y - amp[1] * 0.55 * c1x * s3y - amp[2] * 0.8 * c2x * s3y - amp[3] * 0.9 * c1x * s1y;
}

// Push seeds apart where they crowd, so the panes stay roughly one size.
function spread(p, n, strength) {
  const reach = 0.95 * Math.sqrt((W * H) / n);
  const sx = p.sx;
  const sy = p.sy;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = sx[j] - sx[i];
      const dy = sy[j] - sy[i];
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = ((reach - d) / d) * strength * 0.5;
      sx[i] -= dx * push;
      sy[i] -= dy * push;
      sx[j] += dx * push;
      sy[j] += dy * push;
    }
  }
  for (let i = 0; i < n; i++) {
    sx[i] = Math.min(W - EDGE, Math.max(EDGE, sx[i]));
    sy[i] = Math.min(H - EDGE, Math.max(EDGE, sy[i]));
  }
}

export function setup(params) {
  const p = params;
  p.sx = new Float32Array(MAX);
  p.sy = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) {
    p.sx[i] = Math.random() * W;
    p.sy[i] = Math.random() * H;
  }
  p.kind = new Uint8Array(MAX);
  p.jitter = new Float32Array(MAX);
  p.rgb = new Uint8Array(MAX * 3);
  p.pale = new Uint8Array(MAX * 3);
  p.jewel = new Float32Array(MAX);
  p.tmp = new Float32Array(3);
  p.owner = new Uint8Array(W * H);
  p.cand = new Uint8Array(BX * BY * MAX);
  p.count = new Uint8Array(BX * BY);
  p.T = 0;
  p.amp = new Float32Array(4);
  p.vel = new Float32Array(2);
  p.settled = false;
  pickGlass(p);
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 20, 0.06];
  const n = Math.max(2, Math.min(MAX, Math.round(k[2])));
  p.n = n;
  if (!p.settled) {
    // Relax the random scatter before the first frame, so it opens on even
    // panes: all the seeds first, for when K3 turns up, then the ones in use.
    for (let s = 0; s < 30; s++) spread(p, MAX, 0.5);
    for (let s = 0; s < 30; s++) spread(p, n, 0.5);
    p.settled = true;
  }
  if (input.btnPressed && input.btnPressed[0]) pickGlass(p);

  const speed = k[1];
  p.T += dt * speed * 0.16;
  const T = p.T;
  const amp = p.amp;
  amp[0] = Math.cos(T * 1.0);
  amp[1] = Math.cos(T * 0.71 + 1.3) * 0.9;
  amp[2] = Math.cos(T * 1.37 + 2.1) * 0.6;
  amp[3] = Math.cos(T * 0.53 + 4.0) * 0.8;
  // A plain Euler step spirals outward round every vortex and, fast enough,
  // packs the seeds against the walls. A midpoint step does not.
  const step = 15.6 * speed * dt;
  const vel = p.vel;
  for (let i = 0; i < MAX; i++) {
    const x = p.sx[i];
    const y = p.sy[i];
    flow(amp, x, y, vel);
    flow(amp, x + vel[0] * step * 0.5, y + vel[1] * step * 0.5, vel);
    p.sx[i] = Math.min(W - EDGE, Math.max(EDGE, x + vel[0] * step));
    p.sy[i] = Math.min(H - EDGE, Math.max(EDGE, y + vel[1] * step));
  }
  // A fast current shears the panes apart faster, so the push keeps pace.
  spread(p, n, Math.min(0.35, 0.05 + 0.04 * speed));

  // K4 0..1 blends a ruler into city blocks, 1..2 city blocks into king's moves.
  const m = Math.max(0, Math.min(2, k[3]));
  p.we = m < 1 ? 1 - m : 0;
  p.wm = m < 1 ? m : 2 - m;
  p.wc = m < 1 ? 0 : m - 1;

  if (k[0] !== p.hue) {
    p.hue = k[0];
    // K1 at 0 opens on cobalt rather than the red most of the study opens on.
    const base = 0.6 + k[0];
    for (let i = 0; i < MAX; i++) {
      const g = GLASS[p.kind[i]];
      let h = base + g[0] + p.jitter[i];
      h -= Math.floor(h);
      // Dim orange glass reads as brown on the panel, so warm panes stay bright.
      const warm = h > 0.02 && h < 0.2;
      hsv(h, g[1], warm ? Math.max(0.92, g[2]) : g[2], p.tmp, 0);
      p.rgb[i * 3] = p.tmp[0];
      p.rgb[i * 3 + 1] = p.tmp[1];
      p.rgb[i * 3 + 2] = p.tmp[2];
      // The roundel at the heart of each pane is a thinner, paler glass.
      hsv(h, g[1] * 0.45, 1, p.tmp, 0);
      p.pale[i * 3] = p.tmp[0];
      p.pale[i * 3 + 1] = p.tmp[1];
      p.pale[i * 3 + 2] = p.tmp[2];
    }
  }
}

export function draw(display, params, time) {
  const p = params;
  const n = p.n;
  const sx = p.sx;
  const sy = p.sy;
  const we = p.we;
  const wm = p.wm;
  const wc = p.wc;
  const cand = p.cand;
  const count = p.count;
  const owner = p.owner;

  // Each pane has a roundel round its seed, drawn in the same measure, so it
  // is a disc, a diamond or a square. Under a third of the way to the nearest
  // other seed it can never cross into the next pane.
  const jewel = p.jewel;
  for (let i = 0; i < n; i++) jewel[i] = 1e9;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = sx[j] - sx[i];
      const dy = sy[j] - sy[i];
      const ax = dx < 0 ? -dx : dx;
      const ay = dy < 0 ? -dy : dy;
      const d = we * Math.sqrt(dx * dx + dy * dy) + wm * (ax + ay) + wc * (ax > ay ? ax : ay);
      if (d < jewel[i]) jewel[i] = d;
      if (d < jewel[j]) jewel[j] = d;
    }
  }
  // A roundel under about two LEDs across would be all lead, a dark speck.
  for (let i = 0; i < n; i++) jewel[i] = jewel[i] * 0.3 < 2.2 ? 0 : jewel[i] * 0.3;

  // Any seed that owns an LED in a bucket is within the nearest seed's
  // distance from the bucket centre plus twice the centre-to-corner distance.
  // That holds for all three measures and for any blend of them.
  const reachCorner = we * Math.SQRT2 * 3.5 + wm * 7 + wc * 3.5;
  for (let by = 0; by < BY; by++) {
    for (let bx = 0; bx < BX; bx++) {
      const cx = bx * B + B / 2;
      const cy = by * B + B / 2;
      let best = 1e9;
      for (let i = 0; i < n; i++) {
        const dx = sx[i] - cx;
        const dy = sy[i] - cy;
        const ax = dx < 0 ? -dx : dx;
        const ay = dy < 0 ? -dy : dy;
        const d = we * Math.sqrt(dx * dx + dy * dy) + wm * (ax + ay) + wc * (ax > ay ? ax : ay);
        if (d < best) best = d;
      }
      const limit = best + 2 * reachCorner + 0.01;
      const b = by * BX + bx;
      let c = 0;
      for (let i = 0; i < n; i++) {
        const dx = sx[i] - cx;
        const dy = sy[i] - cy;
        const ax = dx < 0 ? -dx : dx;
        const ay = dy < 0 ? -dy : dy;
        const d = we * Math.sqrt(dx * dx + dy * dy) + wm * (ax + ay) + wc * (ax > ay ? ax : ay);
        if (d <= limit) cand[b * MAX + c++] = i;
      }
      count[b] = c;
    }
  }

  for (let y = 0; y < H; y++) {
    const row = ((y / B) | 0) * BX;
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const b = row + ((x / B) | 0);
      const c = count[b];
      const base = b * MAX;
      const px = x + 0.5;
      let best = 1e9;
      let who = 0;
      for (let j = 0; j < c; j++) {
        const i = cand[base + j];
        const dx = sx[i] - px;
        const dy = sy[i] - py;
        const ax = dx < 0 ? -dx : dx;
        const ay = dy < 0 ? -dy : dy;
        const d = we * Math.sqrt(dx * dx + dy * dy) + wm * (ax + ay) + wc * (ax > ay ? ax : ay);
        if (d < best) {
          best = d;
          who = i;
        }
      }
      // Which piece of glass: the seed's number doubled, plus one inside its roundel.
      owner[y * W + x] = who * 2 + (best < jewel[who] ? 1 : 0);
    }
  }

  // Lead goes on an LED whose right or lower neighbour belongs to another
  // piece of glass, which draws one unbroken line between any two pieces
  // whatever the measure.
  const rgb = p.rgb;
  const pale = p.pale;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const id = owner[o];
      const lead = (x < W - 1 && owner[o + 1] !== id) || (y < H - 1 && owner[o + W] !== id);
      const c = (id >> 1) * 3;
      if (lead) display.setPixel(x, y, 0, 0, 0);
      else if (id & 1) display.setPixel(x, y, pale[c], pale[c + 1], pale[c + 2]);
      else display.setPixel(x, y, rgb[c], rgb[c + 1], rgb[c + 2]);
    }
  }
}
