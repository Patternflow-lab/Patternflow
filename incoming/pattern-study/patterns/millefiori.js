// ===== Patternflow pattern =====
// Title:   Millefiori
// Family:  glass
// Idea:    The view drifts slowly across a Murano millefiori plate, hundreds of cane slices packed tight in dark glass, each a tiny rosette, star or flower of 1-LED rings and petals in cobalt, canary, emerald, ruby and turquoise, while a lamp wanders over the polished surface and every domed slice catches it as a white glint.
// Author:  patternflow-lab
// Date:    2026-10-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Venetian millefiori (murrine) glass from the workshops of Murano, pattern round 20
// Round:   20
// ===============================
// @matrix 64x128
// @knobs Palette=0..4, Speed=0.2..3, Canes=6..12, Light=0..1
//
// Knob 1: Palette. The glass the canes are pulled from: classic Murano cobalt, canary, emerald, ruby and turquoise at 0, then ruby and gold, lagoon blues and greens, spring pinks and lemons, and violet and cyan night glass at 4.
// Knob 2: Speed. How fast the plate slides under the view and the lamp moves: at 2 the plate drifts about two and a half LEDs a second sideways and one down, and the lamp crosses the panel in about twelve seconds.
// Knob 3: Canes. How wide the slices are: at 6 most are 5 to 7 LEDs across, with 3-LED chips in the gaps and a few 11-LED feature canes; at 12 they run up to 15 LEDs and the feature canes to 23, each showing more rings and longer petals.
// Knob 4: Light. How close the lamp hangs: near 0 it is far off and lights the plate almost evenly, each slice carrying a faint glint; turned up it comes down close, throws a bright pool with hard white glints, and the rest of the plate falls dim.
// Buttons: K1 tap pulls a fresh set of canes, and the new plate slides in from the right over the old one in under a second.

const W = 64;
const H = 128;
// The plate is a torus larger than the panel, so the view can drift forever.
const WW = 256;
const WH = 256;
const WN = WW * WH;
const MAXC = 6000;
const RINGS = 12;
// The glassmaker pulls this many canes and cuts every slice from one of them.
const D = 14;
const TAU = Math.PI * 2;

// Five sets of glass. Slots 0..5 go round the colour wheel so slot i and
// slot i+3 sit opposite each other; slot 6 is the milk-white centre glass and
// slot 7 the dark ground the slices are set in. Codes 8..15 are the same
// glass pulled thin and dark.
const SETS = [
  // Murano: ruby, canary, emerald, turquoise, cobalt, amethyst.
  [[215, 10, 45], [255, 205, 0], [0, 185, 70], [0, 195, 200], [25, 60, 255], [150, 40, 225], [236, 232, 220], [5, 8, 40]],
  // Ruby and gold.
  [[225, 0, 35], [255, 175, 0], [255, 95, 0], [0, 165, 115], [25, 35, 190], [255, 60, 130], [255, 236, 170], [34, 4, 8]],
  // Lagoon.
  [[255, 90, 60], [160, 230, 0], [0, 200, 120], [0, 225, 225], [30, 110, 255], [70, 30, 230], [220, 245, 240], [0, 16, 30]],
  // Spring.
  [[255, 70, 150], [250, 235, 30], [60, 210, 40], [0, 200, 255], [120, 90, 255], [255, 140, 70], [255, 240, 245], [20, 10, 30]],
  // Night.
  [[230, 0, 190], [255, 90, 0], [150, 255, 0], [0, 230, 255], [20, 50, 255], [120, 20, 255], [230, 220, 255], [8, 0, 22]],
];
// The main glass of the fourteen canes: cobalt and the greens lead, canary
// and amethyst follow, and ruby comes in mostly as a partner.
const MAINS = [4, 4, 4, 3, 3, 2, 2, 2, 1, 1, 5, 5, 0, 3];
const TYPES = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4];
// Most canes pair their main glass with the opposite one; five have a
// milk-white eye and the rest a canary one.
const PARTS = [3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 2, 4, 5, 2];
const ACCS = [6, 6, 6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (d, m) => (d > m / 2 ? d - m : d < -m / 2 ? d + m : d);
const shuffle = (a) => {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = o[i];
    o[i] = o[j];
    o[j] = t;
  }
  return o;
};

export function setup(params) {
  const P = params;
  P.cx = new Int16Array(MAXC);
  P.cy = new Int16Array(MAXC);
  P.cr = new Float32Array(MAXC);
  P.cd = new Uint16Array(MAXC);
  P.tone = new Float32Array(MAXC);
  // Each slice's glint this frame: when worked out, where, how bright.
  P.gs = new Int32Array(MAXC).fill(-1);
  P.gx = new Float32Array(MAXC);
  P.gy = new Float32Array(MAXC);
  P.gn = new Float32Array(MAXC);
  P.frame = 0;
  // The cane library, per cane and ring count and ring: glass A and B, petal
  // count, phase and duty.
  const L = D * RINGS * RINGS;
  P.ra = new Uint8Array(L);
  P.rb = new Uint8Array(L);
  P.rn = new Uint8Array(L);
  P.rp = new Float32Array(L);
  P.rd = new Float32Array(L);
  P.reg = new Uint8Array(256);
  // Per plate LED: which slice, which ring, the angle round its centre.
  P.cid = new Int16Array(WN);
  P.ring = new Uint8Array(WN);
  P.ang = new Float32Array(WN);
  P.s1 = new Float32Array(WN);
  P.s2 = new Float32Array(WN);
  P.pal = new Float32Array(16 * 3);
  P.size = -1;
  // The last frame, held while a new plate slides in over it.
  P.prev = new Float32Array(W * H * 3);
  P.wipe = -1;
  P.t = 0;
  P.ox = Math.random() * WW;
  P.oy = Math.random() * WH;
  P.lph = Math.random() * TAU;
}

// Pull the canes: each is one design built up ring by ring, the same in every
// slice cut from it, whatever its width.
function canes(P) {
  const mains = shuffle(MAINS);
  const types = shuffle(TYPES);
  const parts = shuffle(PARTS);
  const accs = shuffle(ACCS);
  for (let d = 0; d < D; d++) {
    const m = mains[d];
    const p = (m + parts[d]) % 6;
    const acc = accs[d];
    const half = Math.random() < 0.5 ? 0.5 : 0;
    const type = types[d];
    const pS = Math.random() < 0.4 ? 4 : 8;
    const pL = [5, 6, 8, 8, 10, 12][Math.floor(Math.random() * 6)];
    for (let K = 1; K < RINGS; K++) realise(P, d, K, type, m, p, acc, half, K <= 3 ? pS : pL);
  }
  for (let i = 0; i < 256; i++) P.reg[i] = Math.floor(Math.random() * D);
}

// One cane's rings from the centre out. Petals point straight up or sit half
// a petal over, so a slice is mirror-true and never turns into a pinwheel on
// the LED grid.
function realise(P, d, K, type, m, p, acc, half, petals) {
  const o = (d * RINGS + K) * RINGS;
  const set = (k, a, b, nn, ph, du) => {
    P.ra[o + k] = a;
    P.rb[o + k] = b;
    P.rn[o + k] = nn;
    P.rp[o + k] = ph;
    P.rd[o + k] = du;
  };
  const dm = m + 8;
  const dp = p + 8;
  for (let k = 0; k <= K; k++) {
    const out = k / K;
    // The innermost rings have 8 and 12 LEDs, too few to carry an odd count.
    const pn = k === 1 ? (petals >= 8 ? 8 : 4) : k === 2 ? (petals === 4 ? 4 : petals <= 6 ? 6 : 8) : petals;
    if (k === 0) set(0, type === 3 ? m : acc, 0, 0, 0, 1);
    else if (type === 0) {
      // Bullseye: bright rings parted by dark ones, cased in the partner.
      const seq = [dm, acc, dp, m, dm, p];
      set(k, k === K ? p : seq[(k - 1) % seq.length], 0, 0, 0, 1);
    } else if (type === 1) {
      // Flower: white or partner petals on a dark disc of the main glass,
      // cased in it.
      if (k === K) set(k, m, 0, 0, 0, 1);
      else set(k, k === 1 && K > 3 ? p : acc === 6 ? 6 : p, dm, pn, half, 0.55);
    } else if (type === 2) {
      // Star: points of the main glass taper out into the dark partner.
      if (k === K) set(k, p, 0, 0, 0, 1);
      else set(k, m, dp, pn, half, 0.85 - 0.55 * out);
    } else if (type === 3) {
      // Cog: rings round the eye and a toothed rim.
      if (k === K) set(k, m, dm, Math.max(8, 4 * K), 0, 0.5);
      else set(k, k % 2 ? dp : k % 4 === 2 ? acc : m, 0, 0, 0, 1);
    } else {
      // Rosetta: chevron layers of white and colour, each turned half a
      // point from the one inside it.
      set(k, k % 2 ? m : 6, k % 2 ? dp : dm, pn, half + k * 0.5, 0.5);
    }
  }
}

// Lay out the slices: a few big feature canes first, then ever smaller ones
// thrown into the gaps until the plate is full, as a glassmaker packs a
// mould. Slices from one cane tend to be set together in patches.
function plate(P, size) {
  const r0 = size / 2;
  // Buckets at least as wide as two of the biggest radii together, so a new
  // slice only has to look at its own bucket and the eight round it.
  const gw = Math.max(3, Math.floor(WW / Math.ceil(r0 * 3.8 + 1)));
  const gh = gw;
  const CAP = 40;
  const gc = new Int32Array(gw * gh);
  const gi = new Int16Array(gw * gh * CAP);
  let n = 0;
  const fits = (x, y, r) => {
    const gx = Math.floor((x * gw) / WW);
    const gy = Math.floor((y * gh) / WH);
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const cell = ((gy + j + gh) % gh) * gw + ((gx + i + gw) % gw);
        for (let t = 0; t < gc[cell]; t++) {
          const c = gi[cell * CAP + t];
          const dx = wrap(x - P.cx[c], WW);
          const dy = wrap(y - P.cy[c], WH);
          const m = r + P.cr[c] - 0.4;
          if (dx * dx + dy * dy < m * m) return false;
        }
      }
    return gc[Math.floor((y * gh) / WH) * gw + Math.floor((x * gw) / WW)] < CAP;
  };
  const tries = Math.round((WN / (r0 * r0)) * 7);
  for (let a = 0; a < tries && n < MAXC; a++) {
    const big = a < tries * 0.02 && Math.random() < 0.35;
    const u = a / tries;
    const r = big ? r0 * (1.6 + Math.random() * 0.3) : (1.2 * r0 - (1.2 * r0 - 1.9) * Math.sqrt(u)) * (0.94 + Math.random() * 0.12);
    const x = Math.floor(Math.random() * WW);
    const y = Math.floor(Math.random() * WH);
    if (!fits(x, y, r)) continue;
    const R = Math.max(1.6, r);
    const K = Math.min(Math.floor(R + 0.25), RINGS - 1);
    P.cx[n] = x;
    P.cy[n] = y;
    P.cr[n] = R;
    const d = !big && Math.random() < 0.7 ? P.reg[(y >> 4) * 16 + (x >> 4)] : Math.floor(Math.random() * D);
    P.cd[n] = d * RINGS + K;
    P.tone[n] = 0.82 + Math.random() * 0.18;
    const cell = Math.floor((y * gh) / WH) * gw + Math.floor((x * gw) / WW);
    gi[cell * CAP + gc[cell]++] = n;
    n++;
  }
  // Each LED goes to the slice whose rim it is closest to (d - r), so
  // touching slices meet where their circles touch; past the rim, and on the
  // seam between two slices, is the dark ground.
  P.s1.fill(1e9);
  P.s2.fill(1e9);
  P.cid.fill(-1);
  for (let c = 0; c < n; c++) {
    const R = P.cr[c];
    const m = Math.ceil(R + 1);
    const K = P.cd[c] % RINGS;
    for (let dy = -m; dy <= m; dy++)
      for (let dx = -m; dx <= m; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        const s = d - R;
        if (s > 0.5) continue;
        const q = ((P.cy[c] + dy) & (WH - 1)) * WW + ((P.cx[c] + dx) & (WW - 1));
        if (s < P.s1[q]) {
          P.s2[q] = P.s1[q];
          P.s1[q] = s;
          P.cid[q] = c;
          P.ring[q] = Math.min(Math.round(d), K);
          // Angle from straight up, in turns.
          P.ang[q] = Math.atan2(dx, -dy) / TAU;
        } else if (s < P.s2[q]) P.s2[q] = s;
      }
  }
  for (let q = 0; q < WN; q++) if (P.cid[q] < 0 || P.s2[q] - P.s1[q] < 1) P.ring[q] = 255;
}

export function update(dt, input, params) {
  const P = params;
  const k = input.knobValues || [0, 2, 6, 0.06];
  dt = clamp(dt, 0, 0.1);
  const speed = clamp(k[1], 0, 3) / 2;
  const size = clamp(k[2], 6, 12);
  P.light = clamp(k[3], 0, 1);
  P.palk = clamp(k[0], 0, 4);
  const fresh = input.btnPressed && input.btnPressed[0];
  if (fresh && P.size > 0) P.wipe = 0;
  else if (P.wipe >= 0) P.wipe = P.wipe + dt * 1.4 > 1 ? -1 : P.wipe + dt * 1.4;
  if (fresh || P.size < 0) canes(P);
  if (fresh || P.size < 0 || Math.abs(size - P.size) > 0.24) {
    P.size = size;
    plate(P, size);
  }
  P.t += dt * speed;
  P.ox += dt * speed * 2.4;
  P.oy += dt * speed * 0.9;
  if (P.ox >= WW) P.ox -= WW;
  if (P.oy >= WH) P.oy -= WH;
  // The lamp wanders over the plate on a slow figure.
  const t = P.t + P.lph * 10;
  P.lx = 32 + 27 * Math.sin(t * 0.26 + P.lph);
  P.ly = 64 + 52 * Math.sin(t * 0.15);
}

export function draw(display, params) {
  const P = params;
  if (P.size < 0) return;
  // The glass of the moment, between two neighbouring sets.
  const i0 = Math.min(3, Math.floor(P.palk));
  let f = P.palk - i0;
  f = clamp((f - 0.3) / 0.4, 0, 1);
  f = f * f * (3 - 2 * f);
  const pal = P.pal;
  for (let s = 0; s < 8; s++) {
    for (let ch = 0; ch < 3; ch++) pal[s * 3 + ch] = SETS[i0][s][ch] * (1 - f) + SETS[i0 + 1][s][ch] * f;
    // The same glass pulled dark. Dark yellow and orange read as brown on
    // the panel, so they darken to a deep ruby, and lime to a bottle green.
    const r = pal[s * 3];
    const g = pal[s * 3 + 1];
    const b = pal[s * 3 + 2];
    const o = (s + 8) * 3;
    if (b > 0.3 * Math.max(r, g) || g < 0.35 * r) {
      pal[o] = r * 0.18;
      pal[o + 1] = g * 0.18;
      pal[o + 2] = b * 0.18;
    } else if (g > r) {
      pal[o] = r * 0.03;
      pal[o + 1] = g * 0.2;
      pal[o + 2] = g * 0.06;
    } else {
      pal[o] = r * 0.21;
      pal[o + 1] = g * 0.03;
      pal[o + 2] = r * 0.06;
    }
  }
  const L = P.light;
  const sig = 70 - 46 * L;
  const amb = 0.92 - 0.62 * L;
  const pool = 0.2 + 0.85 * L;
  const glint = 0.95 + 0.5 * L;
  // While a new plate slides in, it rides in with its leading edge.
  const ox = Math.floor(P.ox) - (P.wipe >= 0 ? Math.floor((W + 26) * (1 - P.wipe)) : 0);
  const oy = Math.floor(P.oy);
  const lx = P.lx;
  const ly = P.ly;
  const k2 = 1 / (2 * sig * sig);
  P.frame++;
  for (let y = 0; y < H; y++) {
    const wy = (y + oy) & (WH - 1);
    for (let x = 0; x < W; x++) {
      const wx = (x + ox) & (WW - 1);
      const q = wy * WW + wx;
      const c = P.cid[q];
      const kk = P.ring[q];
      const ddx = x - lx;
      const ddy = y - ly;
      const lit = amb + pool * Math.exp(-(ddx * ddx + ddy * ddy) * k2);
      let r;
      let g;
      let b;
      if (kk === 255) {
        r = pal[21] * lit;
        g = pal[22] * lit;
        b = pal[23] * lit;
      } else {
        const e = P.cd[c] * RINGS + kk;
        let code = P.ra[e];
        const nn = P.rn[e];
        if (nn) {
          // Distance from the nearest petal's axis, 0 on it and 0.5 between.
          const u = nn * P.ang[q] + P.rp[e];
          if (Math.abs(u - Math.round(u)) * 2 >= P.rd[e]) code = P.rb[e];
        }
        const tl = lit * P.tone[c];
        r = pal[code * 3] * tl;
        g = pal[code * 3 + 1] * tl;
        b = pal[code * 3 + 2] * tl;
        // The domed slice throws the lamp back as a small glint on the side
        // facing it; where, worked out once a frame for each slice in view.
        if (P.gs[c] !== P.frame) {
          P.gs[c] = P.frame;
          const cxs = x + wrap(P.cx[c] - wx, WW);
          const cys = y + wrap(P.cy[c] - wy, WH);
          const vx = lx - cxs;
          const vy = ly - cys;
          const dl2 = vx * vx + vy * vy;
          const dl = Math.sqrt(dl2) + 1e-3;
          const off = (0.45 * P.cr[c] * Math.min(1, dl / 8)) / dl;
          P.gx[c] = cxs + vx * off;
          P.gy[c] = cys + vy * off;
          P.gn[c] = glint * Math.exp(-dl2 * k2 * 1.4);
        }
        const hx = P.gx[c] - x;
        const hy = P.gy[c] - y;
        const h2 = hx * hx + hy * hy;
        if (h2 < 3 && P.gn[c] > 0.02) {
          const gl = P.gn[c] * Math.exp(-h2 / 0.45);
          r += 250 * gl;
          g += 246 * gl;
          b += 232 * gl;
        }
      }
      const o = (y * W + x) * 3;
      // The edge of the new plate runs right to left, leaning a little.
      const e = P.wipe >= 0 ? x + y * 0.2 - (W + 26) * (1 - P.wipe) : 1;
      if (P.wipe >= 0) {
        if (e < 0) {
          r = P.prev[o];
          g = P.prev[o + 1];
          b = P.prev[o + 2];
        } else if (e < 1) {
          r = g = b = 200;
        }
      }
      // What is shown is what the next new plate slides in over; the old
      // side only shrinks, so it keeps the frame it had when K1 was tapped.
      if (P.wipe < 0 || e >= 1) {
        P.prev[o] = r;
        P.prev[o + 1] = g;
        P.prev[o + 2] = b;
      }
      display.setPixel(x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b));
    }
  }
}
