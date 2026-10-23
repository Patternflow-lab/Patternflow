// ===== Patternflow pattern =====
// Title:   Shoreline
// Family:  ocean
// Idea:    A surf beach seen straight down from a drone: swell lines roll in at a slant, steepen and break white over a sandbar, reform in the trough, break again and run up the sand as swash with a lacy foam edge, and every backwash leaves a dark sheen of wet sand that dries.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 17, after drone photographs of surf beaches; a wave breaks when it is 0.78 of the depth (McCowan, 1894)
// Round:   17
// ===============================
// @matrix 64x128
// @knobs Water=0..1, Speed=0.2..3, Height=1..3, Tide=-1..1
//
// Knob 1: Water. Tropical turquoise over white sand at 0, Atlantic green-blue in the middle, the grey North Sea over brown sand at 1.
// Knob 2: Speed. How fast the beach runs: at 2 the eight-second swell lands a wave every four seconds.
// Knob 3: Height. Wave height in metres: at 1 the bar breaks only the bigger waves of each set, at 3 every wave breaks before the bar and the trough runs white.
// Knob 4: Tide. At -1 low water nearly bares the bar and pulls the water's edge ten rows out; at 1 high water covers the bar and most waves break only at the shore.

const W = 64;
const H = 128;
const N = W * H;
// The sea bed in metres below mid tide: a shelf deepening to 12 m at the top, a sandbar on
// row 52 and the water's edge on row 92, where the beach rises 7 cm a row.
const SHORE = 92;
const BAR = 52;
const SLOPE = 0.07;
// The swell's period in seconds, and its slant: a crest reaches each column 15 ms after the
// one to its left, a slope of 6 degrees out in deep water and less as it slows near the shore.
const PERIOD = 8;
const SKEW = 0.015;
// A wave breaks when it is 0.78 of the depth and stops breaking once it is under 0.45 of it.
const GAMMA = 0.78;
const REFORM = 0.45;
// Seconds the foam takes to fade to a third, and wet sand to dry to a third.
const FOAM_T = 5;
const DRY_T = 7;
// The swash slows by RUN rows a second every second going up and by 0.75 of that coming back.
const RUN = 2.6;
// Water seen from above in deep and in shallow water, the sand, and the foam: tropical,
// Atlantic, North Sea.
const SEAS = [
  [[8, 78, 142], [56, 212, 200], [238, 228, 204], [246, 250, 250]],
  [[12, 52, 92], [44, 142, 142], [214, 188, 146], [240, 244, 244]],
  [[38, 56, 64], [96, 118, 110], [178, 160, 132], [224, 228, 222]],
];
// Two towels: column, row, width, height and their two stripes.
const TOWELS = [
  [9, 113, 4, 7, [40, 90, 200], [236, 236, 230]],
  [44, 117, 7, 4, [230, 120, 40], [250, 200, 60]],
];
const SKIN = [214, 150, 110];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const q4 = (v) => (v <= 0 ? 0 : v >= 254 ? 255 : ((v + 2) >> 2) << 2);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function depth(P, x, y) {
  const off = Math.max(0, 80 - y);
  const channel = P.rip[x] * clamp((y - 40) / 10, 0, 1) * clamp((88 - y) / 12, 0, 1);
  return SLOPE * (SHORE - y) + 0.0009 * off * off - P.bump[x] * Math.exp(-(((y - BAR) / 7) ** 2)) + channel + P.tide;
}

// For the tide as it stands: the depth under each LED, how deep its water looks and how much
// sand shows through it, and how long a crest takes from the top row to each row. Waves run
// at 2.1 rows a second for every square root of a metre of depth, plus a little for their
// own height, so they slow and bunch up as the water shoals.
function retide(P) {
  P.ys = SHORE + P.tide / SLOPE;
  for (let p = 0; p < N; p++) {
    const d = (P.d[p] = depth(P, p % W, (p / W) | 0));
    P.q[p] = Math.max(0.05, d) ** 0.25;
    P.ka[p] = 1 - Math.exp(-Math.max(0, d) / 2.2);
    P.ke[p] = 0.7 * Math.exp(-Math.max(0, d) / 0.25);
  }
  P.tt[0] = 0;
  for (let y = 0; y < H; y++) {
    let d = 0;
    for (let x = 0; x < W; x += 8) d += P.d[y * W + x] / 8;
    P.tt[y + 1] = P.tt[y] + 1 / (2.1 * Math.sqrt(Math.max(0, d) + 0.6));
    P.ft[y] = Math.exp(P.tt[y] / FOAM_T);
  }
  P.tideAt = P.tide;
}

// The row a crest has reached at this age.
function crest(P, age) {
  const tt = P.tt;
  if (age >= tt[H]) return H;
  let lo = 0;
  let hi = H;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (tt[m] <= age) lo = m;
    else hi = m;
  }
  return lo + (age - tt[lo]) / (tt[lo + 1] - tt[lo]);
}

// A new wave and what it will do in each column on its way in. It shoals by Green's law
// (height times the fourth root of depth stays the same) and breaks at GAMMA, the harder the
// further over it is; broken, it loses a twenty-fifth of its height a row, and it reforms in
// the deeper trough. Per row: its height, and how much foam it makes there.
function spawn(P, t0) {
  const k = P.count++;
  // Sets: every seventh wave is the biggest, the ones between smaller.
  const set = 0.5 + 0.5 * Math.sin((k * 2 * Math.PI) / 7 + P.phase);
  const h = P.height * (0.45 + 0.65 * set + 0.12 * (Math.random() - 0.5));
  // Bigger waves make more foam, and it lasts longer.
  const more = 0.6 + 0.3 * h;
  // A retired wave's arrays are used again.
  const old = P.pool.pop();
  const ht = old ? old.ht : new Float32Array(N);
  const fs = old ? old.fs : new Float32Array(N);
  const first = new Int16Array(W).fill(H);
  for (let x = 0; x < W; x++) {
    let flux = h * 6 ** 0.25;
    let s = 0;
    let hc = h;
    for (let y = 0; y < H; y++) {
      const p = y * W + x;
      const d = Math.max(0.05, P.d[p]);
      let v = flux / P.q[p];
      if (s > 0) {
        v = Math.min(hc * 0.96, GAMMA * d);
        s = Math.min(1, s + 0.06);
        if (v < REFORM * d) (s = 0), (flux = v * P.q[p]);
      } else if (v > GAMMA * d) {
        s = clamp((v / (GAMMA * d) - 1) * 4 + 0.3, 0.3, 1);
        v = GAMMA * d;
        if (first[x] === H) first[x] = y;
      }
      hc = v;
      ht[p] = v;
      fs[p] = s * more;
    }
  }
  P.waves.push({ t0, h, ht, fs, first, land: new Uint8Array(W) });
}

export function setup(params) {
  const P = params;
  Object.assign(P, { t: 0, count: 0, waves: [], pool: [], tide: 0, tideAt: 99, height: 1, started: false });
  for (const k of ["d", "q", "ka", "ke", "wet", "grain", "lace"]) P[k] = new Float32Array(N);
  for (const k of ["S", "U"]) P[k] = new Float32Array(W);
  for (const k of ["light", "foam", "ft"]) P[k] = new Float32Array(H);
  P.tt = new Float32Array(H + 1);
  P.row = new Int32Array(H);
  P.col = new Float32Array(N * 3);
  // The bar's crest rises and falls along the beach, and a rip channel cuts through it and
  // on in to the shore, up to 0.8 m deeper than the trough beside it.
  const rx = 30 + Math.random() * 24;
  const ph = Math.random() * 6;
  for (const k of ["bump", "cusp", "rip"]) P[k] = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const r = Math.exp(-(((x - rx) / 6) ** 2));
    P.rip[x] = 0.8 * r;
    P.bump[x] = 2.4 * (1 + 0.1 * Math.sin(x * 0.11 + ph)) * (1 - 0.55 * r);
    // Beach cusps: the run-up reaches further every 16 columns.
    P.cusp[x] = 1 + 0.18 * Math.sin((x * 2 * Math.PI) / 16 + ph);
  }
  // Lace: Worley noise with three points in each cell of an 8 LED grid that wraps, the
  // second-nearest point's distance less the nearest's, so it is 0 along the cell walls
  // where the bubbles gather.
  const pts = [];
  for (let j = 0; j < 16 * 8 * 3; j++) pts.push(Math.random() * 8, Math.random() * 8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let f1 = 99;
      let f2 = 99;
      const cx = x >> 3;
      const cy = y >> 3;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++)
          for (let n = 0; n < 3; n++) {
            const q = ((((cy + j + 16) % 16) * 8 + ((cx + i + 8) % 8)) * 3 + n) * 2;
            const d = Math.hypot((cx + i) * 8 + pts[q] - x - 0.5, (cy + j) * 8 + pts[q + 1] - y - 0.5);
            if (d < f1) (f2 = f1), (f1 = d);
            else if (d < f2) f2 = d;
          }
      P.lace[y * W + x] = Math.min(1, (f2 - f1) / 2.2);
      // A dark grain here and there, and a few pale shell bits.
      const h = Math.random();
      P.grain[y * W + x] = h < 0.04 ? -0.18 : h > 0.96 ? 0.07 : 0;
    }
  // Someone walking along the beach above the swash.
  P.walk = Math.random() * W;
}

// A bore reaching the water's edge runs up the beach: its reach in rows grows with the
// square root of the wave's height and with the cusps. Meeting the backwash of the one
// before, it drives that sheet back up.
function launch(P, x, w) {
  const R = 9 * Math.sqrt(w.h) * P.cusp[x] * (1 + 0.15 * Math.sin(x * 0.3 + w.t0));
  const u = Math.sqrt(2 * RUN * R);
  if (P.S[x] > P.ys) P.U[x] = Math.max(P.U[x], u * 0.75);
  else (P.S[x] = P.ys), (P.U[x] = u);
}

function step(P, dt) {
  P.t += dt;
  if (Math.abs(P.tide - P.tideAt) > 0.01) retide(P);
  const ys = P.ys;
  while (P.next <= P.t) {
    spawn(P, P.next);
    P.next += PERIOD * (0.9 + 0.2 * Math.random());
  }
  // A wave is done once its foam has faded behind the water's edge.
  const done = P.tt[Math.min(H, Math.ceil(ys))] + 4 * FOAM_T;
  while (P.waves.length && P.t - P.waves[0].t0 >= done) P.pool.push(P.waves.shift());
  const dry = Math.exp(-dt / DRY_T);
  for (let x = 0; x < W; x++) {
    for (const w of P.waves)
      if (!w.land[x] && crest(P, P.t - w.t0 - SKEW * x) >= ys) {
        w.land[x] = 1;
        launch(P, x, w);
      }
    if (P.S[x] > ys || P.U[x] > 0) {
      P.S[x] = Math.min(H + 2, P.S[x] + P.U[x] * dt);
      P.U[x] -= (P.U[x] > 0 ? RUN : 0.75 * RUN) * dt;
      if (P.S[x] <= ys) (P.S[x] = ys), (P.U[x] = 0);
    }
    for (let y = Math.max(0, Math.floor(ys)); y < H; y++) P.wet[y * W + x] = y <= P.S[x] ? 1 : P.wet[y * W + x] * dry;
  }
  P.walk = (P.walk + 0.45 * dt) % (W + 8);
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 1, 0.06];
  dt = Math.min(dt, 0.1);
  const s = clamp(k[1], 0.05, 4);
  P.sea = clamp(k[0], 0, 1);
  P.height = clamp(k[2], 0.5, 3.5);
  P.tide = 0.7 * clamp(k[3], -1, 1);
  if (!P.started) {
    // The beach has been running for half a minute when the panel opens, with the swell
    // already in flight and the biggest wave of a set due on the bar 14 beach seconds later.
    P.started = true;
    retide(P);
    P.next = -P.tt[BAR] - 2 * PERIOD;
    P.phase = Math.PI / 2 - (2 * Math.PI * (44 + 2 * PERIOD)) / (7 * PERIOD);
    for (let i = 0; i < 30 * 8; i++) step(P, 1 / 8);
  }
  step(P, dt * s);
}

export function draw(display, params) {
  const P = params;
  const u = P.sea * 2;
  const i0 = Math.min(1, Math.floor(u));
  const [deep, shallow, sand, white] = [0, 1, 2, 3].map((j) => mix(SEAS[i0][j], SEAS[i0 + 1][j], u - i0));
  // Sand under a few centimetres of water, wet sand, and the swash's thin sheet.
  const under = mix(sand, deep, 0.25);
  const damp = sand.map((v, j) => v * 0.68 + deep[j] * 0.06);
  const film = mix(damp, shallow, 0.5);
  const { light, foam, lace, col, ys, ka, ke, ft, wet, grain } = P;
  // The lace drifts slowly in to the beach.
  const drift = Math.floor(P.t * 0.6);
  const row = P.row;
  for (let y = 0; y < H; y++) row[y] = ((((y - drift) % H) + H) % H) * W;
  for (let x = 0; x < W; x++) {
    light.fill(0);
    foam.fill(0);
    for (const w of P.waves) {
      // A crest not yet on the panel is still coming in above it.
      const age = P.t - w.t0 - SKEW * x;
      const Y = age < 0 ? age / P.tt[1] : crest(P, age);
      const yc = clamp(Math.floor(Y), 0, Math.min(Math.floor(ys) - 1, H - 1));
      const s = w.fs[yc * W + x];
      if (Y < ys) {
        // The face of the swell: lit behind the crest and in shade in front of it, the shade
        // narrowing and darkening as the wave steepens.
        const steep = clamp(w.ht[yc * W + x] / (GAMMA * Math.max(0.1, P.d[yc * W + x])), 0, 1);
        const L = PERIOD / (P.tt[yc + 1] - P.tt[yc]);
        const amp = 0.07 + 0.03 * w.h + 0.3 * steep;
        const back = 0.3 * L;
        const front = Math.max(1.5, 0.16 * L * (1 - 0.6 * steep));
        for (let y = Math.max(0, Math.ceil(Y - back)); y < Math.min(H, Y + front); y++) {
          const v = y < Y ? (Y - y) / back : (y - Y) / front;
          light[y] += 4 * v * (1 - v) * (y < Y ? amp : -1.3 * amp);
        }
        // A breaking crest is a band of white, thicker the harder it breaks, with a ragged
        // leading edge.
        if (s > 0) {
          const sb = Math.min(1, s);
          const edge = Y + 0.5 + sb * (0.8 + 1.6 * lace[(yc * W + x * 7) % N]);
          for (let y = Math.max(0, Math.floor(Y - 1 - 2 * sb)); y <= edge && y < H; y++) foam[y] = Math.max(foam[y], 0.25 + 0.75 * s);
        }
      }
      // Behind a broken crest the foam it made fades with the time since it passed.
      const fade = Math.exp(-age / FOAM_T);
      for (let y = yc; y >= w.first[x]; y--) {
        const f = w.fs[y * W + x] * fade * ft[y];
        if (f > foam[y]) foam[y] = f;
      }
    }
    const S = P.S[x];
    const back = P.U[x] > 0 ? 1 : 0.55;
    for (let y = 0; y < H; y++) {
      const p = y * W + x;
      let r;
      let g;
      let b;
      let f = 0;
      if (y < ys) {
        // Open water: deep blue fading to the shallow colour over the bar and the beach face,
        // and the sand showing through in the last few centimetres.
        const a = ka[p];
        const e = ke[p];
        const m = 1 + light[y];
        r = (shallow[0] + (deep[0] - shallow[0]) * a) * (1 - e) + under[0] * e;
        g = (shallow[1] + (deep[1] - shallow[1]) * a) * (1 - e) + under[1] * e;
        b = (shallow[2] + (deep[2] - shallow[2]) * a) * (1 - e) + under[2] * e;
        r *= m;
        g *= m;
        b *= m;
        f = foam[y];
      } else if (y <= S) {
        // The swash: a sheet of water over the sand, its foam thick at the edge and thin in
        // the backwash.
        r = film[0];
        g = film[1];
        b = film[2];
        f = (S - y < 1.2 ? 1.1 : Math.exp(-(S - y) / 2.5)) * back;
      } else {
        // Sand, darker while it is wet, with the sky's sheen on it just after the water goes.
        const wv = wet[p];
        const k = 1 + grain[p];
        const w3 = wv * wv * wv;
        const sh = 40 * w3 * w3;
        r = (sand[0] + (damp[0] - sand[0]) * wv) * k + sh * 0.8;
        g = (sand[1] + (damp[1] - sand[1]) * wv) * k + sh * 0.9;
        b = (sand[2] + (damp[2] - sand[2]) * wv) * k + sh;
      }
      // Foam: solid where it is fresh, a net of bubbles along the lace's cell walls as it fades.
      const fv = f > 0 ? clamp((f * 1.3 - lace[row[y] + x]) * 3, 0, 1) * (0.75 + 0.25 * Math.min(1, f)) : 0;
      col[p * 3] = r + (white[0] - r) * fv;
      col[p * 3 + 1] = g + (white[1] - g) * fv;
      col[p * 3 + 2] = b + (white[2] - b) * fv;
    }
  }
  // Things on the dry sand, never in the water.
  const put = (x, y, c, m) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= W || y >= H || y < ys + 2) return;
    for (let j = 0; j < 3; j++) col[(y * W + x) * 3 + j] = m ? col[(y * W + x) * 3 + j] * m : c[j];
  };
  for (const [tx, ty, tw, th, a, b] of TOWELS)
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) put(tx + x, ty + y, (tw > th ? x : y) % 2 ? b : a);
  // Someone on the first towel.
  for (const [x, y, c] of [[10, 114, SKIN], [10, 115, [200, 60, 60]], [11, 115, [200, 60, 60]], [10, 116, SKIN], [11, 117, SKIN]]) put(x, y, c);
  // The umbrella from above, eight panels, red and white, its shadow down to the right.
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (Math.hypot(x, y) <= 3.4) put(28 + x, 114 + y, null, 0.62);
  for (let y = -4; y <= 4; y++)
    for (let x = -4; x <= 4; x++) {
      const r = Math.hypot(x, y);
      const seg = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * 8) % 2;
      if (r <= 3.4) put(26 + x, 112 + y, r < 0.8 ? [240, 240, 236] : seg ? [228, 54, 46] : [244, 240, 232]);
    }
  // The walker, head and shoulders and a short shadow.
  const wx = P.walk - 4;
  const wy = Math.min(H - 6, ys + 15);
  put(wx + 1, wy + 1, null, 0.6);
  put(wx, wy, [40, 60, 140]);
  put(wx, wy - 1, SKIN);
  for (let p = 0; p < N; p++) display.setPixel(p % W, (p / W) | 0, q4(col[p * 3]), q4(col[p * 3 + 1]), q4(col[p * 3 + 2]));
}
