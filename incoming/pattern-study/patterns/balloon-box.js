// ===== Patternflow pattern =====
// Title:   Balloon Box
// Family:  weather
// Idea:    Hot-air balloons ride the dawn winds of a valley box: low down the wind carries them one way, higher up it brings them back the other.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the dawn mass ascensions over Albuquerque and the "Albuquerque box", the winds that blow one way near the ground and the other way a few hundred metres up
// Round:   11
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Wind=0.2..3, Balloons=8..16, Sunrise=0..1
//
// Knob 1: Hue. Turns every envelope's colours around the wheel together; each balloon keeps its own stripes, bands or chevrons.
// Knob 2: Wind. How hard the two winds blow: at the bottom of the range the balloons hang almost still, at the top the near ones cross the panel in a few seconds.
// Knob 3: Balloons. How many are in the air; a balloon that joins drifts in from the side or lifts off from the field, and one that leaves drifts out and does not come back.
// Knob 4: Sunrise. The hour: before dawn the sky is deep blue over an orange rim and the burners glow, turned up the sun comes over the ridge and the sky goes to morning blue.
// Buttons: K1 tap fires every burner at once; the envelopes glow from inside and the balloons climb.

const W = 64;
const H = 128;
const N = W * H;
const MAX = 16;
// The two winds meet at this height. Above it they blow to the right, below
// it to the left, and a balloon passing through slows, stops and turns.
const SPLIT = 60;
const SHEAR = 6;
// Envelope colours. A balloon picks one of these as its first colour and
// builds the rest of its fabric from it.
const HUES = [0.0, 0.07, 0.13, 0.27, 0.36, 0.5, 0.58, 0.66, 0.76, 0.86, 0.93];
// How a balloon is sewn: two-colour gores, three-colour gores, a rainbow of
// gores, level bands, zigzag chevrons, a cap and skirt over striped gores.
const DESIGNS = 6;

function hash(a, b) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hsvInto(out, o, h, s, v) {
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

// The envelope's half width at height t, in radii: t is -1 at the crown, the
// sphere is widest at 0, and below 0.3 it tapers to the throat at 1.4.
function halfWidth(t) {
  if (t < -1 || t > 1.4) return 0;
  if (t <= 0.3) return Math.sqrt(1 - t * t);
  const s = (t - 0.3) / 1.1;
  return 0.22 + 0.734 * Math.cos(s * 1.5707963);
}

// The wind at height y: +1 to the right high up, -1 to the left low down.
function wind(y) {
  return Math.tanh((SPLIT - y) / SHEAR);
}

// Sky colour keys from before dawn to morning, top, middle and horizon.
const SKY = [
  [0, [6, 8, 30], [16, 20, 62], [60, 34, 70]],
  [0.06, [6, 10, 58], [20, 26, 104], [196, 78, 52]],
  [0.4, [26, 46, 118], [86, 88, 168], [255, 146, 88]],
  [1, [58, 118, 216], [118, 168, 232], [214, 222, 206]],
];

function skyKeys(s, out) {
  let a = SKY[0];
  let b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++)
    if (s >= SKY[i][0] && s <= SKY[i + 1][0]) {
      a = SKY[i];
      b = SKY[i + 1];
      break;
    }
  const f = b[0] > a[0] ? (s - a[0]) / (b[0] - a[0]) : 0;
  for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) out[k * 3 + c] = a[k + 1][c] + (b[k + 1][c] - a[k + 1][c]) * f;
}

// A new balloon's look: how near it is, its size, its fabric.
function dress(P, i) {
  const d = Math.random();
  P.depth[i] = d;
  P.R[i] = 9 + 7 * d;
  P.design[i] = Math.floor(Math.random() * DESIGNS);
  P.hue0[i] = HUES[Math.floor(Math.random() * HUES.length)];
  P.gores[i] = 8 + 2 * Math.floor(Math.random() * 3);
  P.rot[i] = Math.random() * 6.283;
  P.spin[i] = (Math.random() - 0.5) * 0.5;
  P.glow[i] = 0;
  P.burn[i] = 0;
  P.nextBurn[i] = 1 + Math.random() * 5;
  P.retarget[i] = 6 + Math.random() * 10;
}

// Lifts a balloon off the field or brings it in on the wind from the side.
function launch(P, i, fromField) {
  dress(P, i);
  const R = P.R[i];
  if (fromField) {
    P.x[i] = 10 + Math.random() * 44;
    // Standing on the field with its basket on the ground.
    P.y[i] = H - 2 * R;
    P.target[i] = 20 + Math.random() * 74;
    P.burn[i] = 2.5;
  } else {
    // Never at the split, where no wind would bring it in.
    let y = 16 + Math.random() * 64;
    if (y > SPLIT - 10) y += 20;
    P.y[i] = y;
    P.target[i] = y;
    const w = wind(y);
    P.x[i] = w > 0 ? -R * 1.1 : W + R * 1.1;
  }
  P.live[i] = 1;
}

export function setup(params) {
  const P = params;
  P.x = new Float32Array(MAX);
  P.y = new Float32Array(MAX);
  P.R = new Float32Array(MAX);
  P.depth = new Float32Array(MAX);
  P.design = new Int8Array(MAX);
  P.hue0 = new Float32Array(MAX);
  P.gores = new Int8Array(MAX);
  P.rot = new Float32Array(MAX);
  P.spin = new Float32Array(MAX);
  P.glow = new Float32Array(MAX);
  P.burn = new Float32Array(MAX);
  P.nextBurn = new Float32Array(MAX);
  P.target = new Float32Array(MAX);
  P.retarget = new Float32Array(MAX);
  P.live = new Int8Array(MAX);
  P.order = new Int32Array(MAX);
  P.fab = new Float32Array(MAX * 9);
  // The rainbow design's gores, one colour each.
  P.rain = new Float32Array(MAX * 12 * 3);
  P.sky = new Float32Array(H * 3);
  P.keys = new Float32Array(9);
  P.bg = new Float32Array(N * 3);
  P.col = new Float32Array(3);
  // The ridge on the far side of the field, and the town's lights under it.
  P.ridge = new Int16Array(W);
  for (let x = 0; x < W; x++)
    P.ridge[x] = Math.round(112 - 4 * Math.sin(x * 0.09 + 0.6) - 3 * Math.sin(x * 0.23 + 2.1) + 2 * hash(x, 3));
  P.town = new Float32Array(N);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(hash(i, 5) * W);
    const y = P.ridge[x] + 3 + Math.floor(hash(i, 6) * (H - P.ridge[x] - 3));
    if (y < H) P.town[y * W + x] = 0.45 + 0.4 * hash(i, 7);
  }
  P.stars = new Float32Array(N);
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(hash(i, 8) * W);
    const y = Math.floor(hash(i, 9) * 70);
    P.stars[y * W + x] = 0.75 + 0.25 * hash(i, 10);
  }
  P.count = 8;
  P.wind = 2;
  P.hue = 0;
  P.sun = 0.06;
  P.ready = 0;
}

// The first frame's sky: the balloons spread over both winds, none of them
// at a side, so the panel opens on a fiesta already in the air.
function scatter(P) {
  const n = P.count;
  for (let i = 0; i < MAX; i++) P.live[i] = 0;
  for (let i = 0; i < n; i++) {
    dress(P, i);
    // Heights in turn from the two winds, a little shuffled.
    const slot = (i + 0.5) / n;
    let y = 18 + slot * 84 + (Math.random() - 0.5) * 8;
    if (Math.abs(y - SPLIT) < 9) y = SPLIT + (y < SPLIT ? -9 : 9);
    P.y[i] = y;
    P.target[i] = y;
    P.x[i] = 8 + ((i * 0.618 + 0.2) % 1) * 48;
    P.live[i] = 1;
  }
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 8, 0.06];
  dt = Math.min(dt, 0.1);
  P.hue = k[0];
  P.wind = Math.max(0.2, Math.min(3, k[1]));
  P.count = Math.max(8, Math.min(MAX, Math.round(k[2])));
  P.sun = Math.max(0, Math.min(1, k[3]));
  if (!P.ready) {
    scatter(P);
    P.ready = 1;
  }
  const all = input.btnPressed && input.btnPressed[0];
  let live = 0;
  for (let i = 0; i < MAX; i++) if (P.live[i]) live++;
  // A balloon joins when the knob asks for more than are flying.
  for (let i = 0; i < MAX && live < P.count; i++)
    if (!P.live[i]) {
      launch(P, i, Math.random() < 0.4);
      live++;
    }

  // Near balloons cross the panel faster than far ones, the way they would.
  const pace = 4.4 * P.wind;
  for (let i = 0; i < MAX; i++) {
    if (!P.live[i]) continue;
    const R = P.R[i];
    const d = P.depth[i];
    if (all) {
      P.burn[i] = 2.5;
      P.target[i] = Math.max(16, P.y[i] - 28);
      P.retarget[i] = 8 + Math.random() * 6;
    }
    // Now and then a pilot picks a new height, often in the other wind.
    P.retarget[i] -= dt;
    if (P.retarget[i] <= 0) {
      P.retarget[i] = 7 + Math.random() * 10;
      P.target[i] = P.y[i] < SPLIT ? SPLIT + 8 + Math.random() * 30 : 14 + Math.random() * 38;
    }
    // Climbing takes the burner; between climbs it fires short bursts to hold height.
    const dy = P.target[i] - P.y[i];
    if (dy < -3 && P.burn[i] <= 0) P.burn[i] = 1.2 + Math.random();
    P.nextBurn[i] -= dt;
    if (P.nextBurn[i] <= 0) {
      P.nextBurn[i] = 3 + Math.random() * 6;
      if (P.burn[i] <= 0) P.burn[i] = 0.5 + Math.random() * 0.6;
    }
    const firing = P.burn[i] > 0;
    if (firing) P.burn[i] -= dt;
    P.glow[i] += ((firing ? 1 : 0) - P.glow[i]) * Math.min(1, dt * (firing ? 7 : 0.9));
    const climb = Math.max(-1, Math.min(1, dy / 10)) * (1.2 + 0.8 * Math.sqrt(P.wind / 2));
    P.y[i] += climb * (0.6 + 0.4 * d) * dt;
    P.x[i] += wind(P.y[i]) * pace * (0.5 + 0.5 * d) * dt;
    P.rot[i] += P.spin[i] * dt;
    // Off the side: the balloon is gone, and one takes its place.
    const off = R * 1.15;
    if (P.x[i] < -off - 1 || P.x[i] > W + off + 1 || P.y[i] < -R * 2) {
      if (live > P.count) {
        P.live[i] = 0;
        live--;
      } else launch(P, i, Math.random() < 0.35);
    }
  }

  // Fabric colours for this frame: each balloon's own, turned by K1.
  const fab = P.fab;
  for (let i = 0; i < MAX; i++) {
    if (!P.live[i]) continue;
    const h = P.hue0[i] + P.hue;
    const o = i * 9;
    const des = P.design[i];
    // Every colour at full value, so a seam between two gores changes the
    // hue and not the brightness.
    if (des === 0) {
      hsvInto(fab, o, h, 1, 1);
      hsvInto(fab, o + 3, h + 0.5, 1, 1);
      hsvInto(fab, o + 6, h, 1, 1);
    } else if (des === 1) {
      hsvInto(fab, o, h, 1, 1);
      hsvInto(fab, o + 3, h + 0.33, 1, 1);
      hsvInto(fab, o + 6, h + 0.67, 1, 1);
    } else if (des === 3) {
      hsvInto(fab, o, h, 1, 1);
      hsvInto(fab, o + 3, h + 0.12, 1, 1);
      hsvInto(fab, o + 6, h + 0.24, 1, 1);
    } else if (des === 4) {
      hsvInto(fab, o, h, 1, 1);
      hsvInto(fab, o + 3, h + 0.17, 1, 1);
      hsvInto(fab, o + 6, h + 0.5, 1, 1);
    } else {
      hsvInto(fab, o, h + 0.5, 1, 1);
      hsvInto(fab, o + 3, h, 1, 1);
      hsvInto(fab, o + 6, h + 0.25, 1, 1);
    }
    if (des === 2) for (let g = 0; g < P.gores[i]; g++) hsvInto(P.rain, (i * 12 + g) * 3, h + g / P.gores[i], 1, 1);
  }
}

export function draw(display, params, time) {
  const P = params;
  const s = P.sun;
  const keys = P.keys;
  skyKeys(s, keys);
  const bg = P.bg;
  // The sky: top colour down to the middle, then to the horizon's rim, with
  // the sun's glow over the ridge on the east side.
  const sunX = 50;
  const sunY = 118 - 40 * s;
  // No glow before the sun is near: until then the rim is the whole dawn.
  const sunAmp = 0.7 * smooth(0.08, 0.5, s);
  const starAmp = 70 * (1 - smooth(0.05, 0.3, s));
  for (let y = 0; y < H; y++) {
    const v = y / 112;
    let f;
    let a;
    let b;
    if (v < 0.55) {
      f = v / 0.55;
      a = 0;
      b = 3;
    } else {
      f = Math.min(1, (v - 0.55) / 0.45);
      // Eased, not squared: squared, the red of the rim climbs 7 levels a
      // row near the ridge and the whole rim reads as a soft edge.
      f = Math.pow(f, 1.5);
      a = 3;
      b = 6;
    }
    for (let c = 0; c < 3; c++) P.sky[y * 3 + c] = keys[a + c] + (keys[b + c] - keys[a + c]) * f;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const o = p * 3;
      if (y >= P.ridge[x]) {
        // The ridge and the field under it, black but for the town.
        const t = P.town[p] * (1 - 0.8 * smooth(0.3, 0.9, s));
        const shade = 10 + 34 * smooth(0.2, 1, s);
        bg[o] = shade * 0.8 + t * 255;
        bg[o + 1] = shade * 0.75 + t * 190;
        bg[o + 2] = shade + t * 90;
        continue;
      }
      const gx = (x - sunX) / 34;
      const gy = (y - sunY) / 22;
      const g = sunAmp * Math.exp(-(gx * gx + gy * gy));
      const st = P.stars[p] * starAmp;
      bg[o] = P.sky[y * 3] + g * 120 + st;
      bg[o + 1] = P.sky[y * 3 + 1] + g * 70 + st;
      bg[o + 2] = P.sky[y * 3 + 2] + g * 30 + st;
    }
  }

  // Far balloons first, so near ones pass in front.
  let n = 0;
  for (let i = 0; i < MAX; i++) if (P.live[i]) P.order[n++] = i;
  for (let a = 1; a < n; a++) {
    const v = P.order[a];
    let b = a - 1;
    while (b >= 0 && P.depth[P.order[b]] > P.depth[v]) {
      P.order[b + 1] = P.order[b];
      b--;
    }
    P.order[b + 1] = v;
  }

  // Light from the east and a little from below, the sun at the rim.
  const Lx = 0.6;
  const Ly = 0.12;
  const Lz = 0.79;
  const amb = 0.63 + 0.06 * s;
  const sunL = 0.41 + 0.04 * s;
  const fab = P.fab;
  const col = P.col;
  for (let q = 0; q < n; q++) {
    const i = P.order[q];
    const cx = P.x[i];
    const cy = P.y[i];
    const R = P.R[i];
    const d = P.depth[i];
    const des = P.design[i];
    const G = P.gores[i];
    const rot = P.rot[i];
    const glow = P.glow[i];
    // Far balloons sit in more of the dawn's shadow.
    const far = 0.88 + 0.12 * d;
    const o9 = i * 9;
    const x0 = Math.max(0, Math.floor(cx - R - 1));
    const x1 = Math.min(W - 1, Math.ceil(cx + R + 1));
    const y0 = Math.max(0, Math.floor(cy - R - 1));
    const y1 = Math.min(H - 1, Math.ceil(cy + 1.4 * R));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const t = dy / R;
      const hw = halfWidth(t) * R;
      if (hw <= 0) continue;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const cover = Math.min(1, hw - Math.abs(dx) + 0.5);
        if (cover <= 0) continue;
        const u = Math.asin(Math.max(-1, Math.min(1, dx / hw)));
        const lon = (u + rot) / 6.2831853 + 2;
        const lf = lon * G;
        const gore = Math.floor(lf) % G;
        let c;
        if (des === 0 || des === 1) c = gore % (des === 0 ? 2 : 3);
        else if (des === 2) c = -1;
        else if (des === 3) c = Math.floor((t + 1) * 2.4) % 3;
        else if (des === 4) {
          const zig = Math.abs(lf - Math.floor(lf) - 0.5);
          c = Math.floor((t + 1) * 2.2 + zig * 1.2) % 3;
        } else c = t < -0.45 || t > 0.95 ? 0 : 1 + (gore % 2);
        const from = c < 0 ? P.rain : fab;
        const oc = c < 0 ? (i * 12 + gore) * 3 : o9 + c * 3;
        col[0] = from[oc];
        col[1] = from[oc + 1];
        col[2] = from[oc + 2];
        // The cloth's light: a sphere above the waist, a cone below it.
        let nx;
        let ny;
        if (t <= 0.3) {
          nx = dx / R;
          ny = t;
        } else {
          nx = (dx / hw) * 0.95;
          ny = 0.3;
        }
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        // Half Lambert: the shadow side turns gently into the dark limb.
        const lam = 0.5 + 0.5 * (nx * Lx + ny * Ly + nz * Lz);
        // The burner lights the envelope from inside, strongest near the mouth.
        const lit = amb + sunL * lam + glow * 0.5 * (0.45 + 0.55 * Math.min(1, (t + 1) / 2.2));
        const p = y * W + x;
        const o = p * 3;
        const white = glow * 0.22;
        for (let ch = 0; ch < 3; ch++) {
          let v = col[ch] * Math.min(1.08, lit) * far;
          v += (255 - v) * white;
          bg[o + ch] += (Math.min(255, v) - bg[o + ch]) * cover;
        }
      }
    }
    // Under the mouth: the cables, the basket and, while it fires, the flame.
    const mouth = cy + 1.4 * R;
    const basketTop = Math.round(mouth + Math.max(2, 0.32 * R));
    const bh = Math.max(2, Math.round(0.24 * R));
    const bw = Math.max(2, Math.round(0.36 * R));
    const bx0 = Math.round(cx - bw / 2);
    const dim = 0.55 + 0.45 * d;
    for (let y = Math.round(mouth); y < basketTop + bh; y++) {
      if (y < 0 || y >= H) continue;
      if (y < basketTop) {
        // Cables from the mouth's corners to the basket's.
        const f = (y - mouth) / Math.max(1, basketTop - mouth);
        const half = 0.22 * R + (bw / 2 - 0.22 * R) * f;
        for (const x of [Math.round(cx - half - 0.5), Math.round(cx + half - 0.5)]) {
          if (x < 0 || x >= W) continue;
          const o = (y * W + x) * 3;
          bg[o] = 70 * dim;
          bg[o + 1] = 62 * dim;
          bg[o + 2] = 56 * dim;
        }
        if (P.burn[i] > 0) {
          const x = Math.round(cx - 0.5);
          if (x >= 0 && x < W) {
            const fl = 0.75 + 0.25 * hash(Math.floor(time * 20), i);
            const o = (y * W + x) * 3;
            bg[o] = 255 * fl;
            bg[o + 1] = 205 * fl;
            bg[o + 2] = 110 * fl;
          }
        }
        continue;
      }
      for (let x = bx0; x < bx0 + bw; x++) {
        if (x < 0 || x >= W) continue;
        const o = (y * W + x) * 3;
        const e = y === basketTop ? 1.15 : 1;
        bg[o] = 130 * dim * e;
        bg[o + 1] = 80 * dim * e;
        bg[o + 2] = 40 * dim * e;
      }
    }
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, bg[o]), Math.min(255, bg[o + 1]), Math.min(255, bg[o + 2]));
    }
}
