// ===== Patternflow pattern =====
// Title:   Skein
// Family:  bird
// Idea:    Looking straight up at dusk as a skein of geese flies north over you in a ragged V, its tired leader now and then dropping back so another goose can take the point, and each bird turns black against the big full moon as it crosses.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 23, after the V formation of migrating geese
// Round:   23
// ===============================
// @matrix 64x128
// @knobs Dusk=0..1, Speed=0.2..3, Geese=7..31, Wind=-1..1
//
// Knob 1: Dusk. How late it is: at 0 the golden afterglow fills the top of the sky and the moon is pale, and towards 1 the glow sinks to a dim band and the moon and the stars carry a navy sky.
// Knob 2: Speed. The pace of everything: at 2 a skein crosses the panel in about ten seconds with its wings beating three times a second, and at 0.2 it all runs ten times slower.
// Knob 3: Geese. How many birds fly in the skein, from a small V of seven to a long one of thirty one whose arms reach most of the way down the panel. A big skein flies higher, so its birds look smaller.
// Knob 4: Wind. A crosswind from the side. The geese turn their bodies into it and crab across the sky, and the arm on the downwind side grows longer. The clouds drift with it too.
// Buttons: K1 tap startles the skein, and the V breaks into a honking tangle before it pulls itself back into shape.

const W = 64;
const H = 128;
const N = W * H;
const { min, max, sin, cos, abs, hypot, exp, floor, round, PI } = Math;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Ground speed of a skein at Speed 2, in LEDs a second.
const V0 = 12;
// The radius of the moon.
const MR = 11.5;
const MS = 27;

// A fixed hash and smooth value noise, for the sky's haze and the clouds.
const hash = (x, y, s) => {
  let h = Math.imul((x * 374761393 + y * 668265263 + s * 982451653) | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function noise(x, y, s) {
  const ix = floor(x);
  const iy = floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => 0.5 * noise(x, y, s) + 0.3 * noise(x * 2.1, y * 2.1, s + 7) + 0.2 * noise(x * 4.3, y * 4.3, s + 13);

// Sky colours by how far a spot is from the afterglow, at dusk and at night.
const SKY0 = [
  [0, 255, 206, 120],
  [0.1, 252, 162, 72],
  [0.22, 238, 108, 82],
  [0.34, 164, 74, 122],
  [0.48, 74, 62, 146],
  [0.66, 30, 44, 122],
  [0.82, 14, 26, 84],
  [0.96, 6, 12, 38],
  [1.06, 3, 7, 20],
  [2, 2, 5, 14],
];
const SKY1 = [
  [0, 84, 62, 96],
  [0.14, 30, 34, 88],
  [0.4, 12, 22, 66],
  [2, 6, 13, 48],
];
// The undersides of clouds, lit from below by the sun that has set.
const CLOUD0 = [
  [0, 255, 232, 176],
  [0.2, 255, 176, 112],
  [0.4, 252, 124, 128],
  [0.65, 196, 96, 156],
  [2, 126, 78, 146],
];
const C3 = [0, 0, 0];
function ramp(P, e, out) {
  let i = 0;
  while (i < P.length - 2 && e > P[i + 1][0]) i++;
  const a = P[i];
  const b = P[i + 1];
  const t = clamp((e - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * t;
  out[1] = a[2] + (b[2] - a[2]) * t;
  out[2] = a[3] + (b[3] - a[3]) * t;
  return out;
}
// How far from the afterglow, 0 at the top right corner (north west) to 1 at the bottom left.
const glowDist = (x, y) => (y + 0.3 * (63 - x)) / 136;

// A cloud: a soft patch of density, drifting sideways and coming round again.
function newCloud(c, y, x) {
  c.w = 30 + floor(Math.random() * 16);
  c.h = 9 + floor(Math.random() * 6);
  c.y = y;
  c.x = x;
  c.m = new Float32Array(c.w * c.h);
  const s = floor(Math.random() * 9999);
  for (let j = 0; j < c.h; j++)
    for (let i = 0; i < c.w; i++) {
      const dx = (i + 0.5) / c.w - 0.5;
      const dy = (j + 0.5) / c.h - 0.5;
      const env = 1 - 4 * dx * dx - 4 * dy * dy;
      const n = fbm(i * 0.2, j * 0.32, s);
      c.m[j * c.w + i] = sstep(0.1, 0.55, env * 0.8 + (n - 0.45) * 1.2);
    }
  return c;
}

function newBird(S, x, y) {
  const b = { x, y, vx: 0, vy: -V0, hd: 0, gs: 0, ph: Math.random() * 6.28, j: Math.random() * 99, drop: 0 };
  S.birds.push(b);
  return b;
}

// A skein is a leader and two arms, each an ordered list of birds from the front.
function newSkein(S, n, x, y, fast) {
  const hd = -0.34 * S.wind;
  const vx = V0 * fast * sin(hd) + 9 * S.wind;
  const vy = -V0 * fast * cos(hd);
  const k = { x, y, hd, vx, vy, L: [], R: [], fast, want: n, rot: 3.2 + Math.random() * 2, side: Math.random() < 0.5 ? -1 : 1, tangle: 0, join: null, flap: Math.random() * 6 };
  k.lead = newBird(S, x, y);
  for (let i = 1; i < n; i++) (i & 1 ? k.L : k.R).push(newBird(S, x, y));
  for (const b of [k.lead, ...k.L, ...k.R]) {
    b.vx = vx;
    b.vy = vy;
  }
  S.skeins.push(k);
  place(S, k, true);
  return k;
}

// Where each bird of a skein wants to be. With snap the birds are put there.
function place(S, k, snap) {
  const n = 1 + k.L.length + k.R.length;
  const t = S.t;
  // A big skein flies higher, so its birds look smaller and sit closer.
  k.gs = clamp(1.05 - 0.013 * (n - 7), 0.74, 1.05);
  const sp = k.gs * (10.2 - 0.07 * (n - 7)) * (1 + 0.04 * sin(t * 0.29 + k.flap));
  const a0 = max(0.31, 0.64 - 0.02 * (n - 7)) * (1 + 0.07 * sin(t * 0.37 + k.flap));
  const h = k.hd;
  const fx = sin(h);
  const fy = -cos(h);
  const set = (b, tx, ty) => {
    // Each bird wanders a little round its slot, so the V is never quite straight.
    tx += 0.9 * sin(t * 0.7 + b.j) + k.tangle * 13 * sin(t * 1.3 + b.j * 3.1);
    ty += 1.3 * sin(t * 0.53 + b.j * 1.7) + k.tangle * 11 * sin(t * 1.1 + b.j * 2.3);
    b.tx = tx;
    b.ty = ty;
    if (snap) {
      b.x = tx;
      b.y = ty;
    }
  };
  // Startled, the whole skein bunches round its middle.
  const cx = k.x - fx * 12 * k.tangle;
  const cy = k.y - fy * 12 * k.tangle;
  set(k.lead, k.x + (cx - k.x) * k.tangle, k.y + (cy - k.y) * k.tangle);
  for (const s of [-1, 1]) {
    const arm = s < 0 ? k.L : k.R;
    // The downwind arm opens a little wider.
    const a = a0 * (1 + 0.2 * s * S.wind);
    const sx = s * sin(a);
    const bk = cos(a);
    for (let r = 0; r < arm.length; r++) {
      const b = arm[r];
      const d = (r + 1) * sp;
      // Right of the heading is (-fy, fx); back is (-fx, -fy).
      let px = k.x + d * (sx * -fy - bk * fx);
      let py = k.y + d * (sx * fx - bk * fy);
      // A bird moving back along the arm keeps to its outside.
      px += s * 4 * b.drop * cos(h);
      py += s * 4 * b.drop * sin(h);
      const u = k.tangle;
      set(b, px + (cx - px) * u, py + (cy - py) * u);
    }
  }
}

function spawn(S, first) {
  const n = S.n;
  const x0 = 32 - S.wind * 30 + (first ? 0 : (Math.random() - 0.5) * 14);
  const ext = ((n - 1) / 2) * (8.6 - 0.11 * (n - 7));
  const y0 = first ? max(50, 110 - ext) : 140;
  const k = newSkein(S, n, x0, y0, 1);
  // The second, smaller skein comes on behind, and most times it catches up and joins.
  const m = max(3, round(n * 0.3));
  const joins = first || Math.random() < 0.65;
  const off = joins ? (Math.random() - 0.5) * 10 : (Math.random() < 0.5 ? -1 : 1) * 17;
  const k2 = newSkein(S, m, x0 + off, max(150, y0 + ext + 40), joins ? 1.6 : 1.04);
  k2.join = joins ? k : null;
  k.next = first ? 4.5 : 8 + Math.random() * 3;
}

export function setup(params) {
  const S = {
    t: 0,
    birds: [],
    skeins: [],
    sky: new Float32Array(N * 3),
    buf: new Float32Array(N * 3),
    A: new Float32Array(N),
    e: new Float32Array(N),
    haze: new Float32Array(N),
    dk: -1,
    moon: new Float32Array(MS * MS),
    cov: new Float32Array(MS * MS),
    stars: [],
    clouds: [],
    n: 7,
    wind: 0.06,
    dusk: 0,
    started: false,
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      S.e[y * W + x] = glowDist(x, y);
      S.haze[y * W + x] = 0.94 + 0.12 * fbm(x * 0.06, y * 0.035, 5);
    }
  // The moon's face: a full disc, darker seas on it and a darker rim.
  const seas = [
    [-3.5, -3.5, 4.6, 3.8],
    [2.5, -3.2, 2.8, 2.6],
    [4.2, 1.2, 3.2, 3.4],
    [-6.2, 1.5, 3, 5.5],
    [-0.5, 4.5, 3, 1.8],
  ];
  for (let j = 0; j < MS; j++)
    for (let i = 0; i < MS; i++) {
      const dx = i - 13;
      const dy = j - 13;
      const r = hypot(dx, dy);
      const cov = clamp(MR + 0.5 - r, 0, 1);
      let sea = 0;
      for (const [sx, sy, rx, ry] of seas) sea = max(sea, sstep(1.15, 0.2, hypot((dx - sx) / rx, (dy - sy) / ry)));
      const alb = 1 - 0.15 * sea - 0.12 * (r / MR) ** 2 - 0.05 * noise(i * 0.7, j * 0.7, 3);
      S.moon[j * MS + i] = alb;
      S.cov[j * MS + i] = cov;
    }
  for (let i = 0; i < 90; i++) S.stars.push({ x: floor(Math.random() * W), y: floor(Math.random() * H), m: Math.random() ** 2.2, p: Math.random() * 6.28 });
  S.clouds.push(newCloud({}, 30, 4), newCloud({}, 68, 26), newCloud({}, 112, -6));
  params.s = S;
}

function stepBirds(S, dt) {
  const ws = S.wind;
  for (const k of S.skeins) {
    // The geese head a little into the wind and crab across it.
    k.hd += (-0.34 * ws - k.hd) * min(1, dt * 1.5);
    const v = V0 * k.fast;
    const vx = v * sin(k.hd) + 9 * ws;
    const vy = -v * cos(k.hd);
    k.vx = vx;
    k.vy = vy;
    k.x += vx * dt;
    k.y += vy * dt;
    k.flap += dt * 2 * PI * 2.9 * (1 + 0.7 * k.tangle);
    if (k.tangle > 0) {
      k.tangle -= dt * 0.33;
      if (k.tangle <= 0) {
        // Reformed, though not always in the same order.
        k.tangle = 0;
        const all = [k.lead, ...k.L, ...k.R].sort(() => Math.random() - 0.5);
        k.lead = all[0];
        k.L = [];
        k.R = [];
        for (let i = 1; i < all.length; i++) (i & 1 ? k.L : k.R).push(all[i]);
      }
    }
    // The leader tires, drops back along one arm, and the next bird up takes the point.
    k.rot -= dt;
    if (k.rot <= 0 && !k.tangle) {
      k.rot = 6 + Math.random() * 3;
      k.side = -k.side;
      const arm = k.side < 0 ? k.L : k.R;
      if (arm.length) {
        const old = k.lead;
        k.lead = arm.shift();
        arm.push(old);
        old.drop = 1;
      }
    }
    // Keep the arms in the split the wind asks for, one bird at a time.
    const m = k.L.length + k.R.length;
    const wantR = round(m * clamp(0.5 + 0.36 * ws, 0.1, 0.9));
    k.bal = (k.bal || 0) - dt;
    if (k.bal <= 0 && wantR !== k.R.length && !k.tangle) {
      k.bal = 0.5;
      if (wantR > k.R.length && k.L.length) k.R.push(k.L.pop());
      else if (k.R.length) k.L.push(k.R.pop());
    }
    // The second skein joins the tail of the first when it has caught up.
    if (k.join) {
      const j = k.join;
      const tail = [j.lead, ...j.L, ...j.R].reduce((a, b) => (b.y > a.y ? b : a));
      if (j.gone || k.y < tail.y + 10) {
        const add = [k.lead, ...k.L, ...k.R];
        if (!j.gone) {
          for (const b of add) (j.L.length <= j.R.length ? j.L : j.R).push(b);
          j.want += add.length;
          k.L = [];
          k.R = [];
          k.lead = null;
          k.gone = true;
        }
        k.join = null;
      }
    }
  }
  S.skeins = S.skeins.filter((k) => !k.gone);
  // When a skein is high on the panel, the next one comes in from the bottom.
  for (const k of S.skeins)
    if (k.next !== undefined) {
      k.next -= dt;
      if (k.next <= 0) {
        k.next = undefined;
        spawn(S, false);
      }
    }
  // The Geese knob adds birds to the tail of the newest skein, or lets some fall away.
  const main = S.skeins.filter((k) => k.join === null && k.fast === 1).pop();
  if (main) {
    if (S.lastN !== S.n) main.want = max(3, main.want + S.n - (S.lastN || S.n));
    S.lastN = S.n;
    S.adj = (S.adj || 0) - dt;
    const n = 1 + main.L.length + main.R.length;
    if (S.adj <= 0 && n !== main.want) {
      S.adj = 0.15;
      const arm = main.L.length <= main.R.length ? main.L : main.R;
      if (n < main.want) {
        const tail = arm.length ? arm[arm.length - 1] : main.lead;
        arm.push(newBird(S, tail.x, max(tail.y + 18, 136)));
      } else {
        const long = main.L.length > main.R.length ? main.L : main.R;
        const b = long.pop();
        b.stray = long === main.L ? -1 : 1;
      }
    }
  }
  for (const k of S.skeins) place(S, k, false);
  // Each bird springs towards its slot and matches the skein's speed.
  for (const k of S.skeins) {
    const all = [k.lead, ...k.L, ...k.R];
    for (let r = 0; r < all.length; r++) {
      const b = all[r];
      b.sk = k;
      b.rank = r === 0 ? 0 : (r + 1) >> 1;
    }
  }
  const om = 2.2;
  for (const b of S.birds) {
    const k = b.sk;
    if (b.stray) {
      // A bird that leaves falls back and peels away to its side.
      b.vx += (b.stray * 6 + 9 * ws - b.vx) * dt;
      b.vy += (-V0 * 0.4 - b.vy) * dt;
      b.hd += (b.stray * 0.4 - b.hd) * dt;
    } else if (k) {
      const ex = b.tx - b.x;
      const ey = b.ty - b.y;
      const ax = om * om * ex - 2 * om * (b.vx - k.vx);
      const ay = om * om * ey - 2 * om * (b.vy - k.vy);
      b.vx += ax * dt;
      b.vy += ay * dt;
      // Not faster than a goose can close up.
      const rx = b.vx - k.vx;
      const ry = b.vy - k.vy;
      const rs = hypot(rx, ry);
      if (rs > 13) {
        b.vx = k.vx + (rx * 13) / rs;
        b.vy = k.vy + (ry * 13) / rs;
      }
      if (b.drop > 0 && hypot(ex, ey) < 2) b.drop = max(0, b.drop - dt);
      // Bodies point along the skein's heading, banking a little as they shift.
      const want = k.hd + clamp(0.03 * rx, -0.4, 0.4) + k.tangle * 0.6 * sin(S.t * 2.3 + b.j);
      b.hd += (want - b.hd) * min(1, dt * 4);
      b.gs = b.gs ? b.gs + (k.gs - b.gs) * min(1, dt) : k.gs;
      // Wings beat out of step down each arm.
      const tp = k.flap - b.rank * 0.9 + k.tangle * b.j;
      b.ph += dt * 2 * PI * 2.9 * (1 + 0.7 * k.tangle) + 0.08 * sin(tp - b.ph);
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.stray) b.ph += dt * 2 * PI * 2.9;
    if (b.y < -14 || b.y > 190 || b.x < -50 || b.x > 114) b.out = true;
  }
  // A skein whose birds have all flown off the top is gone.
  for (const k of S.skeins) {
    const all = [k.lead, ...k.L, ...k.R];
    if (all.every((b) => b.y < -14)) k.gone = true;
  }
  S.skeins = S.skeins.filter((k) => !k.gone);
  S.birds = S.birds.filter((b) => !(b.out && (b.stray || !b.sk || b.sk.gone)));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = clamp(dt || 0, 0, 0.1);
  S.dusk = clamp(k[0], 0, 1);
  const tempo = clamp(k[1], 0.2, 3) / 2;
  S.n = clamp(round(k[2]), 7, 31);
  S.wind = clamp(k[3], -1, 1);
  if (!S.started) {
    S.started = true;
    spawn(S, true);
  }
  const d = dt * tempo;
  S.t += d;
  if (input.btnPressed && input.btnPressed[0])
    for (const sk of S.skeins) {
      sk.tangle = 1;
      for (const b of [sk.lead, ...sk.L, ...sk.R]) {
        b.vx += (Math.random() - 0.5) * 30;
        b.vy += (Math.random() - 0.5) * 24;
      }
    }
  stepBirds(S, d);
  // Clouds drift with the wind high up and come round again.
  const cv = (2.3 + 5 * S.wind) * d;
  for (const c of S.clouds) {
    c.x += cv;
    if (c.x > W + 2) newCloud(c, 14 + Math.random() * 100, -c.w - 2 - Math.random() * 10);
    else if (c.x < -c.w - 14) newCloud(c, 14 + Math.random() * 100, W + 2);
  }
  // The moon climbs a little as the night goes on.
  S.mx = 19 + 4 * S.dusk;
  S.my = 104 - 22 * S.dusk - 5 * (1 - exp(-S.t / 50));
}

function paintSky(S) {
  const dk = S.dusk;
  const w = sstep(0.2, 1, dk);
  const g = 1 + 1.8 * dk;
  const c0 = [0, 0, 0];
  const c1 = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const e = S.e[i];
    ramp(SKY0, e * g, c0);
    ramp(SKY1, e, c1);
    const hz = S.haze[i];
    S.sky[i * 3] = (c0[0] + (c1[0] - c0[0]) * w) * hz;
    S.sky[i * 3 + 1] = (c0[1] + (c1[1] - c0[1]) * w) * hz;
    S.sky[i * 3 + 2] = (c0[2] + (c1[2] - c0[2]) * w) * hz;
  }
  S.dk = dk;
}

// A tapered stroke into the geese's coverage, kept as the larger of what is there.
function stroke(A, ax, ay, bx, by, ra, rb) {
  const x0 = max(0, floor(min(ax, bx) - 2));
  const x1 = min(W - 1, Math.ceil(max(ax, bx) + 2));
  const y0 = max(0, floor(min(ay, by) - 2));
  const y1 = min(H - 1, Math.ceil(max(ay, by) + 2));
  const dx = bx - ax;
  const dy = by - ay;
  const ll = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / ll, 0, 1);
      const d = hypot(x - ax - dx * t, y - ay - dy * t);
      const a = clamp(ra + (rb - ra) * t + 0.5 - d, 0, 1);
      const i = y * W + x;
      if (a > A[i]) A[i] = a;
    }
}

// A goose seen from below: neck stretched forward, wings beating at its sides.
function goose(A, b) {
  const x = b.x;
  const y = b.y;
  if (x < -9 || x > W + 8 || y < -9 || y > H + 8) return;
  const fx = sin(b.hd);
  const fy = -cos(b.hd);
  const P = (u, v) => [x - fy * u + fx * v, y + fx * u + fy * v];
  const g = b.gs || 1;
  const s = sin(b.ph);
  const up = max(0, cos(b.ph));
  // Seen from below, a wing raised or lowered is foreshortened, and on the
  // upstroke it bends at the wrist and sweeps its tip back.
  const th = 0.9 * s;
  const span = g * (0.8 + 5.2 * cos(th) * (1 - 0.18 * up));
  const tipv = g * (-0.7 - 1.7 * up + 0.5 * s);
  const head = P(0, 5.1 * g);
  const neck = P(0, 1.6 * g);
  const chest = P(0, 0.9 * g);
  const tail = P(0, -3.5 * g);
  stroke(A, chest[0], chest[1], tail[0], tail[1], 1.25 * g, 0.55 * g);
  stroke(A, neck[0], neck[1], head[0], head[1], max(0.45, 0.48 * g), max(0.55, 0.7 * g));
  for (const sd of [-1, 1]) {
    const sh = P(sd * 0.8 * g, 0.8 * g);
    const wr = P(sd * (0.8 * g + 0.45 * (span - 0.8 * g)), g * (0.9 - 0.5 * up));
    const tp = P(sd * span, tipv);
    stroke(A, sh[0], sh[1], wr[0], wr[1], 1.0 * g, 0.75 * g);
    stroke(A, wr[0], wr[1], tp[0], tp[1], 0.75 * g, 0.35 * g);
  }
}

export function draw(display, params, time) {
  const S = params.s;
  if (!S || !S.started) return;
  if (abs(S.dk - S.dusk) > 0.002) paintSky(S);
  const dk = S.dusk;
  const { sky, buf, A } = S;
  buf.set(sky);
  // Stars come out where the sky is dark enough to show them.
  const night = 150 + 200 * sstep(0.1, 0.9, dk);
  for (const st of S.stars) {
    const i = st.y * W + st.x;
    const L = max(sky[i * 3], sky[i * 3 + 1], sky[i * 3 + 2]);
    const v = clamp((st.m * night - L) / 60, 0, 1) * (0.75 + 0.25 * sin(S.t * 3.1 + st.p * 7));
    buf[i * 3] += 200 * v;
    buf[i * 3 + 1] += 210 * v;
    buf[i * 3 + 2] += 230 * v;
  }
  // The moon, pale in the dusk and bright at night with a ring of glow round it.
  const mx = S.mx;
  const my = S.my;
  const mb = 0.8 + 0.2 * dk;
  const halo = 0.15 + 0.6 * dk;
  const mc = [255 * mb, 246 * mb, 222 * mb];
  for (let y = max(0, floor(my - 34)); y < min(H, my + 34); y++)
    for (let x = max(0, floor(mx - 34)); x < min(W, mx + 34); x++) {
      const i = (y * W + x) * 3;
      const r = hypot(x - mx, y - my);
      const gl = halo * 60 * exp(-max(0, r - MR) / 7);
      buf[i] += gl * 0.75;
      buf[i + 1] += gl * 0.8;
      buf[i + 2] += gl;
      const ix = round(x - mx + 13);
      const iy = round(y - my + 13);
      if (ix < 0 || iy < 0 || ix >= MS || iy >= MS) continue;
      const cv = S.cov[iy * MS + ix];
      if (cv <= 0) continue;
      const m = S.moon[iy * MS + ix];
      buf[i] += (mc[0] * m - buf[i]) * cv;
      buf[i + 1] += (mc[1] * m - buf[i + 1]) * cv;
      buf[i + 2] += (mc[2] * m - buf[i + 2]) * cv;
    }
  // Clouds, their undersides lit from below by the afterglow, or grey by the moon at night.
  const lw = sstep(0.05, 0.85, dk);
  const g = 1 + 1.8 * dk;
  for (const c of S.clouds) {
    const cx = round(c.x);
    const cy = round(c.y);
    for (let j = 0; j < c.h; j++) {
      const y = cy + j;
      if (y < 0 || y >= H) continue;
      for (let i = 0; i < c.w; i++) {
        const x = cx + i;
        if (x < 0 || x >= W) continue;
        const dn = c.m[j * c.w + i];
        if (dn <= 0) continue;
        const p = y * W + x;
        ramp(CLOUD0, S.e[p] * g, C3);
        const mn = exp(-hypot(x - mx, y - my) / 30);
        const lr = C3[0] + (40 + 60 * mn - C3[0]) * lw;
        const lg = C3[1] + (46 + 62 * mn - C3[1]) * lw;
        const lb = C3[2] + (70 + 70 * mn - C3[2]) * lw;
        const br = 0.5 + 0.5 * dn;
        const q = p * 3;
        const o = 0.9 * dn;
        buf[q] += (lr * br - buf[q]) * o;
        buf[q + 1] += (lg * br - buf[q + 1]) * o;
        buf[q + 2] += (lb * br - buf[q + 2]) * o;
      }
    }
  }
  // The geese, dark against everything behind them.
  A.fill(0);
  for (const b of S.birds) goose(A, b);
  const gr = 6;
  const gg = 5;
  const gb = 10;
  for (let p = 0; p < N; p++) {
    const a = A[p];
    const q = p * 3;
    let r = buf[q];
    let gn = buf[q + 1];
    let bl = buf[q + 2];
    if (a > 0) {
      r += (gr - r) * a;
      gn += (gg - gn) * a;
      bl += (gb - bl) * a;
    }
    display.setPixel(p % W, (p / W) | 0, min(255, r) | 0, min(255, gn) | 0, min(255, bl) | 0);
  }
}
