// ===== Patternflow pattern =====
// Title:   Braille Relief
// Family:  type
// Idea:    A page of embossed six-dot braille lies in the dark under a low lamp that circles it, so each raised dot shows only as a lit side and a long shadow, while a fingertip glow reads along the lines cell by cell and the print letter it has just felt surfaces small under the cell and fades.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: six-dot braille (Louis Braille, Procédé pour écrire les paroles, la musique et le plain-chant au moyen de points, 1829), uncontracted English letters; text from Helen Keller, The Story of My Life (1903); pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Relief=0.4..2.4, Light=0..1
//
// Knob 1: Hue. Turns the lamp, the shade and the print round the wheel together: at 0 a cream lamp on cool grey paper, blue-violet in the shadows, the print letters pale sky blue.
// Knob 2: Speed. How fast the fingertip reads: 2.5 cells a second at 2, so the 40 cells of the first page take 16 s, 0.25 at 0.2 and 3.75 at 3. The lamp circles the page once in 16 s at 2, once in 36 s at 0.2, so the light moves however slowly the page is read.
// Knob 3: Relief. The height of each dot, from 0.4 LED, barely raised, where the lamp finds a lit rim and a short shadow, to 2.4 LEDs, where every dot throws a shadow down the page across the dots behind it.
// Knob 4: Light. How high the lamp stands: 3 degrees above the paper at 0 (4 at the opening 0.06), where the dots blaze on one side and their shadows run 19 times their height (14 at the opening); 20 degrees at 1, where the shadows shrink to under 3 times and the dots fade to a faint crescent.
// Buttons: any knob's button turns to the next page.

const W = 64, H = 128;
const { floor, ceil, min, max, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- Braille. Dots are numbered 1-2-3 down the left column and 4-5-6 down
// the right. The first ten letters use only dots 1, 2, 4 and 5; k to t are
// a to j with dot 3 added; u, v, x, y and z are a to e with dots 3 and 6
// added; w stands outside the series as 2-4-5-6. A word broken at the end of
// a line takes the hyphen, dots 3-6. Checked against Unicode's braille block:
// a to z come out as U+2801 2803 2809 2819 2811 280B 281B 2813 280A 281A 2805
// 2807 280D 281D 2815 280F 281F 2817 280E 281E 2825 2827 283A 282D 283D 2835.
const AJ = [[1], [1, 2], [1, 4], [1, 4, 5], [1, 5], [1, 2, 4], [1, 2, 4, 5], [1, 2, 5], [2, 4], [2, 4, 5]];
const DOTS = { " ": [], "-": [3, 6], w: [2, 4, 5, 6] };
for (let i = 0; i < 10; i++) {
  DOTS["abcdefghij"[i]] = AJ[i];
  DOTS["klmnopqrst"[i]] = [...AJ[i], 3];
  if (i < 5) DOTS["uvxyz"[i]] = [...AJ[i], 3, 6];
}

// Helen Keller at the well-house, from chapter IV of The Story of My Life.
// Grade 1 braille, letters and spaces only: the capital sign (dot 6) before
// Everything and I is left out, and so are the comma and the full stops. No
// number sign is needed, as the text has no numbers. 119 letters in 29 words
// fill four pages with 4 hyphens and 354 raised dots.
const TEXT =
  "every|thing had a name and each name gave birth to a new thought as we re|turned to the house every ob|ject which i touched seemed to quiv|er with life";

// ---- The page. Dots 4 LEDs apart inside a cell, cells 10 apart, six to a
// line; lines 18 apart, seven to a page, which leaves a gap of 7 rows under
// each line for the print letter. Embossed braille keeps about 2.5 mm, 6 mm
// and 10 mm; this page keeps the first two near that ratio and sets its lines
// a little wider for the letters.
const DP = 4, CP = 10, NC = 6, LP = 18, NL = 7, X0 = 5, Y0 = 3, R = 1.75;
const PER = NC * NL;

// Words go whole onto a line when they fit. A word that does not fit the
// room left is broken at a syllable marked | in the text if its first part
// and a hyphen fit, and otherwise starts a new line. A word longer than the
// whole line (thought, touched) has no other way and is broken after five
// letters.
function paginate(text) {
  const cells = [];
  let col = 0;
  const put = (ch) => {
    cells.push(ch);
    col = (col + 1) % NC;
  };
  const newline = () => {
    while (col > 0) put(" ");
  };
  for (const word of text.split(" ")) {
    const parts = word.split("|");
    let w = parts.join("");
    if (w.length > NC - col) {
      let cut = 0;
      for (let i = 1, k = 0; i < parts.length; i++) {
        k += parts[i - 1].length;
        if (k + 1 <= NC - col) cut = k;
      }
      if (cut) {
        for (const ch of w.slice(0, cut)) put(ch);
        put("-");
        w = w.slice(cut);
      } else newline();
    }
    while (w.length > NC) {
      for (const ch of w.slice(0, NC - 1)) put(ch);
      put("-");
      w = w.slice(NC - 1);
    }
    for (const ch of w) put(ch);
    if (col > 0) put(" ");
  }
  while (cells.length % PER) cells.push(" ");
  const pages = [];
  for (let i = 0; i < cells.length; i += PER) pages.push(cells.slice(i, i + PER));
  return pages;
}
const PAGES = paginate(TEXT);
// The fingertip stops at the last letter of a page, not at the blank cells
// that pad the last page out.
const ENDS = PAGES.map((pg) => {
  let e = PER;
  while (e > 1 && pg[e - 1] === " ") e--;
  return e;
});

// Dot slot s = (line * NC + cell) * 6 + (dot - 1); its centre falls on a
// corner between LEDs, so a dot is a round 4 by 4 patch.
const NS = PER * 6, SX = new Float32Array(NS), SY = new Float32Array(NS);
for (let s = 0; s < NS; s++) {
  const c = floor(s / 6), k = s % 6;
  SX[s] = X0 + (c % NC) * CP + floor(k / 3) * DP;
  SY[s] = Y0 + floor(c / NC) * LP + (k % 3) * DP;
}
const raised = (page, s) => DOTS[page[floor(s / 6)]].includes((s % 6) + 1);

// ---- Print letters, 3 by 5, as small capitals: lowercase would need
// descenders the gap under a line has no room for.
const FONT = {
  a: "010101111101101", b: "110101110101110", c: "011100100100011", d: "110101101101110",
  e: "111100110100111", f: "111100110100100", g: "011100101101011", h: "101101111101101",
  i: "111010010010111", j: "001001001101010", k: "101101110101101", l: "100100100100111",
  m: "101111111101101", n: "110101101101101", o: "010101101101010", p: "110101110100100",
  q: "010101101110011", r: "110101110101101", s: "011100010001110", t: "111010010010010",
  u: "101101101101111", v: "101101101101010", w: "101101111111101", x: "101101010101101",
  y: "101101010010010", z: "111001010100111", "-": "000000111000000",
};

// ---- Paper grain: a fixed field of tiny slopes from a hash, smoothed, so the
// paper glints a little where its fibres face the lamp.
const GX = new Float32Array(W * H), GY = new Float32Array(W * H);
{
  const hz = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    let h = (i * 2654435761) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    hz[i] = ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
  }
  const sm = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) a += hz[cl(y + dy, 0, H - 1) * W + cl(x + dx, 0, W - 1)];
      sm[y * W + x] = a / 9;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      GX[y * W + x] = 0.04 * (sm[y * W + min(W - 1, x + 1)] - sm[y * W + max(0, x - 1)]);
      GY[y * W + x] = 0.04 * (sm[min(H - 1, y + 1) * W + x] - sm[max(0, y - 1) * W + x]);
    }
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, relief: 0.4, light: 0.06, az: -2.4,
    page: 0, read: 0, cell: 0, hold: 0, turn: 0,
    seen: new Float32Array(PER).fill(-99),
    lift: new Float32Array(NS),
    cov: new Float32Array(W * H), lit: new Float32Array(W * H), hgt: new Float32Array(W * H),
    own: new Int16Array(W * H), sh: new Float32Array(W * H), rgb: new Float32Array(W * H * 3),
  };
  const S = params.s;
  for (let s = 0; s < NS; s++) S.lift[s] = raised(PAGES[0], s) ? 1 : 0;
  S.seen[0] = 0;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.4, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.relief = cl(k[2], 0.4, 2.4);
  S.light = cl(k[3], 0, 1);
  // The lamp keeps circling however slowly the page is read.
  S.az += d * (0.15 + 0.12 * S.speed);
  let page = PAGES[S.page];
  if (S.turn === 0) {
    // Reading: the fingertip steps cell by cell, gliding over the first
    // quarter of each step.
    S.read += d * 1.25 * S.speed;
    const c = floor(S.read);
    if (c >= ENDS[S.page]) (S.turn = 1), (S.hold = 0), (S.read = ENDS[S.page] - 1e-6);
    else if (c !== S.cell) (S.cell = c), (S.seen[c] = S.t);
  } else {
    // The page turns: hold 1.2 s, the dots sink in 0.8 s, and the next
    // page is embossed line by line from the top.
    S.hold += d;
    if (S.turn === 1) {
      const u = cl((S.hold - 1.2) / 0.8, 0, 1);
      for (let s = 0; s < NS; s++) S.lift[s] = raised(page, s) ? 1 - u * u * (3 - 2 * u) : 0;
      if (u >= 1) (S.turn = 2), (S.hold = 0), (S.page = (S.page + 1) % PAGES.length), (page = PAGES[S.page]), S.seen.fill(-99);
    } else {
      for (let s = 0; s < NS; s++) {
        const u = cl((S.hold - 0.18 * floor(s / 6 / NC)) / 0.5, 0, 1);
        S.lift[s] = raised(page, s) ? u * u * (3 - 2 * u) : 0;
      }
      if (S.hold > 0.18 * NL + 0.5) {
        S.turn = 0, S.read = 0, S.cell = 0;
        S.seen.fill(-99);
        S.seen[0] = S.t;
      }
    }
  }
  // Any button turns to the next page now.
  if (S.turn === 0 && input.btnPressed && input.btnPressed.some(Boolean)) (S.turn = 1), (S.hold = 1.2);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { cov, lit, hgt, own, sh, lift, rgb } = S;
  // The lamp: elevation e, toward-the-lamp direction (ux, uy) on the page.
  const e = ((3 + 17 * S.light) * PI) / 180, se = sin(e), ce = cos(e), te = se / ce;
  const ux = cos(S.az), uy = sin(S.az), Lx = ce * ux, Ly = ce * uy;
  cov.fill(0), lit.fill(0), hgt.fill(0), own.fill(-1), sh.fill(0);

  // Domes: h = Hd (1 - r^2 / R^2), shaded at 3 by 3 points in each LED by
  // the lamp's angle to the surface.
  for (let s = 0; s < NS; s++) {
    const Hd = S.relief * lift[s];
    if (Hd < 0.01) continue;
    const cx = SX[s], cy = SY[s], g = (2 * Hd) / (R * R);
    for (let py = cy - 2; py < cy + 2; py++)
      for (let px = cx - 2; px < cx + 2; px++) {
        const p = py * W + px;
        let n = 0, v = 0;
        for (let sy = 0; sy < 3; sy++)
          for (let sx = 0; sx < 3; sx++) {
            const dx = px + (sx + 0.5) / 3 - cx, dy = py + (sy + 0.5) / 3 - cy, r2 = dx * dx + dy * dy;
            if (r2 >= R * R) continue;
            // Normal (g dx, g dy, 1), unnormalised.
            const hx = g * dx, hy = g * dy;
            v += max(0, (hx * Lx + hy * Ly + se) / sqrt(hx * hx + hy * hy + 1));
            n++;
          }
        if (!n) continue;
        cov[p] = n / 9, lit[p] = v / 9;
        const dx = px + 0.5 - cx, dy = py + 0.5 - cy, r2 = dx * dx + dy * dy;
        if (r2 < R * R) (hgt[p] = Hd * (1 - r2 / (R * R))), (own[p] = s);
      }
  }

  // Cast shadows. A point at height z0 is in the shadow of a dome when the
  // ray from it toward the lamp, climbing te per LED, passes under the dome.
  // For the paraboloid this has a closed form: with d the offset from the
  // dome's centre split along (dp) and across (dq) the lamp's direction, the
  // ray's lowest clearance is
  //   f = Hd + te^2 R^2 / (4 Hd) - Hd dq^2 / R^2 + te dp - z0,
  // reached at distance s = -dp - te R^2 / (2 Hd) along the ray, so the
  // shadow on flat paper is a parabola Hd / te long. f > 0 is shadow, softened
  // over a penumbra that widens with s.
  for (let s = 0; s < NS; s++) {
    const Hd = S.relief * lift[s];
    if (Hd < 0.01) continue;
    const cx = SX[s], cy = SY[s], len = Hd / te + R + 1;
    const x0 = max(0, floor(min(cx, cx - len * ux) - R - 1)), x1 = min(W - 1, ceil(max(cx, cx - len * ux) + R + 1));
    const y0 = max(0, floor(min(cy, cy - len * uy) - R - 1)), y1 = min(H - 1, ceil(max(cy, cy - len * uy) + R + 1));
    const sStar0 = (te * R * R) / (2 * Hd), k0 = Hd + (te * te * R * R) / (4 * Hd), kq = Hd / (R * R);
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const p = py * W + px;
        if (own[p] === s) continue;
        const dx = px + 0.5 - cx, dy = py + 0.5 - cy, dp = dx * ux + dy * uy, dq = -dx * uy + dy * ux;
        const ss = -dp - sStar0;
        if (ss <= 0) continue;
        const f = k0 - kq * dq * dq + te * dp - hgt[p];
        if (f <= -0.3) continue;
        const a = cl(f / (0.1 + 0.05 * ss) + 0.5, 0, 1);
        if (a > sh[p]) sh[p] = a;
      }
  }

  // The fingertip rests on the cell being read and glides on to the next
  // one over the first quarter of each step.
  const cell = min(PER - 1, floor(S.read)), fr = S.read - cell, gl = min(1, fr * 4);
  let fx = X0 + (cell % NC) * CP + 2, fy = Y0 + floor(cell / NC) * LP + 4;
  if (S.turn === 0 && cell > 0 && gl < 1) {
    const pc = cell - 1, sm = gl * gl * (3 - 2 * gl);
    const qx = X0 + (pc % NC) * CP + 2, qy = Y0 + floor(pc / NC) * LP + 4;
    (fx = qx + (fx - qx) * sm), (fy = qy + (fy - qy) * sm);
  }
  // The hand lifts while the page turns.
  const touch = S.turn === 0 ? 1 : S.turn === 1 ? max(0, 1 - S.hold / 1.2) : 0;

  // Compose. Brightness goes by the ratio of light on a surface to the
  // light on bare paper, so the paper stays dim at every elevation; a
  // distant lamp falls off a little across the page.
  const lamp = hsv(0.11 + S.hue, 0.45, 1), shade = hsv(0.68 + S.hue, 0.7, 1), paperC = hsv(0.62 + S.hue, 0.12, 0.95);
  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const p = py * W + px;
      const gx = GX[p], gy = GY[p];
      const paper = max(0, (-gx * Lx - gy * Ly + se) / sqrt(1 + gx * gx + gy * gy));
      let v = (lit[p] + (1 - cov[p]) * paper) * (1 - 0.92 * sh[p]);
      let rho = v / se;
      rho *= 1 + (0.3 * ((px - 32) * ux + (py - 64) * uy)) / 64;
      const dx = px + 0.5 - fx, dy = py + 0.5 - fy, gf = touch * exp(-(dx * dx) / 12 - (dy * dy) / 30);
      rho = rho * (1 + 1.2 * gf) + 0.5 * gf;
      const b = 1 - exp(-0.16 * rho * rho), amb = 0.04 + 0.03 * cov[p];
      // Dim light reads brown on LEDs, so the lamp's colour comes in with
      // its brightness: the paper is a cool grey, the lit sides cream.
      const w = b < 0.15 ? 0 : b > 0.6 ? 1 : (b - 0.15) / 0.45;
      rgb[p * 3] = (paperC[0] + (lamp[0] - paperC[0]) * w) * b + shade[0] * amb;
      rgb[p * 3 + 1] = (paperC[1] + (lamp[1] - paperC[1]) * w) * b + shade[1] * amb;
      rgb[p * 3 + 2] = (paperC[2] + (lamp[2] - paperC[2]) * w) * b + shade[2] * amb;
    }

  // The print letters, under the cells read so far, each surfacing as the
  // fingertip reaches it and fading over 3 s.
  const page = PAGES[S.page], ink = hsv(0.56 + S.hue, 0.45, 1);
  for (let c = 0; c < PER; c++) {
    const age = S.t - S.seen[c], glyph = FONT[page[c]];
    if (!glyph || age < 0 || age > 3.2) continue;
    let a = age < 0.15 ? age / 0.15 : age < 0.8 ? 1 : max(0, 1 - (age - 0.8) / 2.4);
    if (S.turn) a *= touch;
    if (a <= 0.01) continue;
    const lx = X0 + (c % NC) * CP + 1, ly = Y0 + floor(c / NC) * LP + 11;
    for (let r = 0; r < 5; r++)
      for (let q = 0; q < 3; q++) {
        if (glyph[r * 3 + q] !== "1") continue;
        const o = ((ly + r) * W + lx + q) * 3;
        rgb[o] += ink[0] * a, rgb[o + 1] += ink[1] * a, rgb[o + 2] += ink[2] * a;
      }
  }
  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, floor(p / W), (255 * min(1, rgb[p * 3])) | 0, (255 * min(1, rgb[p * 3 + 1])) | 0, (255 * min(1, rgb[p * 3 + 2])) | 0);
}
