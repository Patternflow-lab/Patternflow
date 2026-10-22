// ===== Patternflow pattern =====
// Title:   Glyph Rain
// Family:  type
// Idea:    Every column keeps writing characters downward and forgets them as it goes, so the panel is full of text that never says anything.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Fall=0.3..6, Density=0..1, Mutate=0..1
//
// Knob 1: Hue. Turns the rain around the colour wheel; the heads stay close to white.
// Knob 2: Fall. How fast the columns fall, each at its own pace around this one.
// Knob 3: Density. How many columns run and how long their tails hang, up to a full wall of text.
// Knob 4: Mutate. How often a glyph already written turns into another; near the top the rain boils.
// Buttons: K4 tap switches between small glyphs and double-size ones.

const W = 64;
const H = 128;
// Small glyphs sit on a 4x6 pitch: 16 columns of 22 rows.
const COLS = Math.floor(W / 4);
const ROWS = Math.ceil(H / 6);

// 3x5 glyphs, one octal digit per row from the top, 4 is the left column.
const FONT = [
  0o75557, 0o26227, 0o71747, 0o71317, 0o55711, 0o74717, 0o74757, 0o71122, 0o75757, 0o75717,
  0o25755, 0o74647, 0o74644, 0o55755, 0o55655, 0o44447, 0o57755, 0o65644, 0o65655, 0o72222,
  0o55557, 0o55255, 0o55222, 0o71247, 0o02720, 0o00700, 0o07070, 0o05250, 0o11244, 0o12421,
  0o42124, 0o57575, 0o02020, 0o34216, 0o61243, 0o27272,
];

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

function rand(p) {
  let s = p.seed;
  s ^= s << 13;
  s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5;
  s >>>= 0;
  p.seed = s;
  return s / 4294967296;
}

function spawn(p, c, scatter) {
  p.len[c] = 4 + rand(p) * (p.rows + 2) * (0.75 + 0.85 * p.density);
  p.rate[c] = 0.55 + rand(p) * 0.9;
  // The gap before the next drop is counted in cells, so it holds at any speed.
  const gap = rand(p) * p.rows * 0.9 * (1 - p.density);
  p.head[c] = scatter ? rand(p) * (p.rows + p.len[c]) : -gap;
  p.wait[c] = 0;
}

function layout(p) {
  p.pw = 4 * p.scale;
  p.ph = 6 * p.scale;
  p.cols = Math.floor(W / p.pw);
  p.rows = Math.ceil(H / p.ph);
  for (let c = 0; c < p.cols; c++) {
    // Golden-ratio steps: whatever share of columns runs is spread evenly.
    const r = c * 0.618034 + 0.31;
    p.rank[c] = r - Math.floor(r);
    spawn(p, c, true);
  }
  for (let i = 0; i < p.glyph.length; i++) {
    p.glyph[i] = Math.floor(rand(p) * FONT.length);
    p.flash[i] = 0;
  }
}

export function setup(params) {
  params.seed = 0x2545f491;
  params.scale = 1;
  params.density = 0;
  params.glyph = new Uint8Array(COLS * ROWS);
  params.flash = new Float32Array(COLS * ROWS);
  params.head = new Float32Array(COLS);
  params.len = new Float32Array(COLS);
  params.rate = new Float32Array(COLS);
  params.wait = new Float32Array(COLS);
  params.rank = new Float32Array(COLS);
  params.fb = new Uint8Array(W * H * 3);
  params.c = [0, 0, 0];
  layout(params);
}

export function update(dt, input, params) {
  const p = params;
  const k = input.knobValues || [0, 2, 0, 0.06];
  p.hue = k[0];
  p.fall = k[1];
  p.density = k[2];
  p.mutate = k[3];
  if (input.btnPressed && input.btnPressed[3]) {
    p.scale = 3 - p.scale;
    layout(p);
  }
  const share = 0.62 + 0.38 * p.density;
  const step = p.fall * 5 * dt;
  for (let c = 0; c < p.cols; c++) {
    if (p.wait[c] > 0) {
      p.wait[c] -= dt;
      if (p.wait[c] <= 0 && p.rank[c] < share) spawn(p, c, false);
      else if (p.wait[c] <= 0) p.wait[c] = 0.3;
      continue;
    }
    const before = Math.floor(p.head[c]);
    p.head[c] += step * p.rate[c];
    const after = Math.floor(p.head[c]);
    // The head writes a fresh glyph into each cell it enters.
    if (after > before && after >= 0 && after < p.rows) {
      const i = after * p.cols + c;
      p.glyph[i] = Math.floor(rand(p) * FONT.length);
    }
    if (p.head[c] - p.len[c] > p.rows) {
      if (p.rank[c] < share) spawn(p, c, false);
      else p.wait[c] = 0.3;
    }
  }
  const chance = (0.4 + 12 * p.mutate * p.mutate) * dt;
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const i = r * p.cols + c;
      p.flash[i] *= Math.exp(-dt * 7);
      const d = p.head[c] - r;
      if (p.wait[c] > 0 || d < 1 || d > p.len[c]) continue;
      if (rand(p) < chance) {
        p.glyph[i] = Math.floor(rand(p) * FONT.length);
        p.flash[i] = 1;
      }
    }
  }
}

export function draw(display, params, time) {
  const p = params;
  const fb = p.fb;
  fb.fill(0);
  const c3 = p.c;
  const sc = p.scale;
  for (let c = 0; c < p.cols; c++) {
    if (p.wait[c] > 0) continue;
    const head = p.head[c];
    const len = p.len[c];
    for (let r = 0; r < p.rows; r++) {
      const d = head - r;
      if (d < 0 || d > len) continue;
      const i = r * p.cols + c;
      let R;
      let G;
      let B;
      if (d < 1) {
        // The head: near white with a little of the hue in it.
        hsv(p.hue + 0.04, 0.3, 1, c3);
      } else {
        const t = d / len;
        const v = 0.12 + 0.88 * Math.pow(1 - t, 1.25) + p.flash[i] * 0.35;
        hsv(p.hue + 0.08 - 0.1 * t, 0.85 + 0.15 * t, Math.min(1, v), c3);
      }
      R = c3[0];
      G = c3[1];
      B = c3[2];
      const bits = FONT[p.glyph[i]];
      const x0 = c * p.pw;
      const y0 = r * p.ph;
      for (let gy = 0; gy < 5; gy++) {
        const row = (bits >> ((4 - gy) * 3)) & 7;
        if (!row) continue;
        for (let gx = 0; gx < 3; gx++) {
          if (!(row & (4 >> gx))) continue;
          for (let sy = 0; sy < sc; sy++) {
            const y = y0 + gy * sc + sy;
            if (y >= H) continue;
            for (let sx = 0; sx < sc; sx++) {
              const o = (y * W + x0 + gx * sc + sx) * 3;
              fb[o] = R;
              fb[o + 1] = G;
              fb[o + 2] = B;
            }
          }
        }
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, fb[o], fb[o + 1], fb[o + 2]);
    }
  }
}
