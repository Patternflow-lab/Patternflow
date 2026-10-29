// ===== Patternflow pattern =====
// Title:   Book from the Sky
// Family:  type
// Idea:    A page of invented characters in vertical columns, each put together from stock radicals and parts in the frames real characters use, is printed over again a column at a time from right to left as a thin new sheet is drawn across it, so a page that looks like Chinese and cannot be read keeps renewing itself.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Book from the Sky (Xu Bing, 1987-1991), about 4,000 invented characters cut as pearwood movable type in a Song-style face; the page after Chinese thread-bound books (ruled columns read top to bottom, right to left, a wider top margin than bottom); pattern round 71
// Round:   71
// ===============================
// @matrix 64x128
// @knobs Ink=0..1, Speed=0.2..3, Strokes=-1..1, Notes=0..1
//
// Knob 1: Ink. Paper and ink: at 0 black ink on ivory paper; 0.25 indigo, as in the blue trial impressions of Qing printing; 0.5 vermilion, as in the red ones; 0.75 a rubbing, white characters on black; 1 gold on indigo paper.
// Knob 2: Speed. How fast the new sheet is drawn across and printed: at 2 a column every 2.4 s, a page in 13.4 s and a 2 s rest before the next sheet; ten times slower at 0.2, half again as fast at 3.
// Knob 3: Strokes. How many parts a character is built from. At 0 a quarter of the characters have a part split in two again, 7% are one part with a dot added, and a character has 7 pen lines on average (a line runs from pen down to pen up, so 口 is one); at -1 nothing is split, 23% are one part, 5.8 lines; at 1 85% are split, 10.9 lines.
// Knob 4: Notes. How much of the page is commentary set as two columns of small characters inside one column, four to a place, as Chinese books set their notes: about 7% of the 55 places at 0.06, none at 0, nearly all at 1. Turning Strokes or Notes sets the columns of the new sheet that are not printed yet again.

const W = 64, H = 128, N = W * H;
const { floor, round, min, max, exp } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- Components, as stroke lists. Each is "wh" (its own grid, w by h
// points) and strokes, each stroke a run of x,y digit pairs joined by
// straight lines; a pair given twice is a dot. Placed in a box, a component
// is stretched to it, so a 5 by 5 part fills a 5 by 9 half as a tall one.
const LEFT = {
  // Radicals in their narrow left-hand forms, 3 by 9.
  ren: "39 2003 1218", shui: "39 0011 0314 0826", shou: "39 0222 101807 0624", mu: "39 0222 1018 1306 2424",
  kou: "39 0323260603", ri: "39 0121270701 0424", yan: "39 1010 0121 0323 0525280805", jin: "39 1001 1021 0323 0525 1318 0827",
  wang: "39 0121 0424 1117 0827", tu: "39 0323 1117 0827", he: "39 2001 0222 1118 1306 2424", mu2: "39 0020280800 0323 0525",
  fu: "39 0008 00202112232415", xin: "39 1018 0203 2121", shi: "39 0121 1104 0525280805",
};
const TOP = {
  // Heads, 9 by 3: grass, roof, bamboo, net, lid, person, mountain, cover.
  cao: "93 0181 2022 6062", mian: "93 4040 02018182", zhu: "93 2002 1131 2222 7052 6181 7272", wang: "93 0080820200 3032 5052",
  tou: "93 4041 0282", ren: "93 4002 4082", shan: "93 0002 4042 8082 0282", mi: "93 02018182",
};
const BOT = {
  // Feet, 9 by 3: heart, fire dots, legs, dish, one.
  xin: "93 0112 2021327281 5050 7070", huo: "93 0211 3132 5152 7182", er: "93 303102 50528281", min: "93 1070 1012 3032 5052 7072 0282", yi: "93 0181",
};
const GEN = {
  // Parts that go anywhere, small grids stretched to their box.
  kou: "33 0020220200", ri: "35 0020240400 0222", mu: "37 0020260600 0222 0424", tian: "55 0040440400 2024 0242",
  wang: "55 0040 0242 0444 2024", tu: "54 1131 0343 2023", gong: "53 1030 2022 0242", shi: "55 0242 2024",
  mu4: "55 0141 2024 2204 2244", da: "55 0141 202204 2244", ren: "55 202104 2244", nv: "55 201244 312304 0242",
  zi: "55 003021 212414 0242", you: "55 00403104 1144", li: "55 01414434 202204", cun: "55 0141 303424 1213",
  ge: "55 0141 1044 3214 3030", jin: "55 4011 111304 1242 3234", qian: "55 1002 114132 2204 2244", pu: "55 1002 1141 3114 1244",
  huo: "55 0112 4132 202204 2244", mi: "55 0011 4031 0242 2024 2204 2244", he: "55 4011 0242 2124 2204 2244", shan: "54 0103 2023 4143 0343",
  bai: "46 2011 0131350501 0333", ji: "55 00404202044443", yi: "55 0040044443", ji2: "55 101304 1030334443",
  shi2: "55 1030 0242 222414 1304 3344", yang: "57 1010 3030 0141 1333 0545 2126", bei: "57 0040440400 0242 1506 3546", ding: "54 0040 202313",
  gong2: "47 0030320204343626", chong: "57 2025 0141434301 0646 4545",
};
const RIGHT = {
  // Right-hand parts that need the whole 5 by 9 half: short-tailed bird, head.
  zhui: "59 2003 1218 3030 2141 2343 2545 2848 3138", ye: "59 0040 2011 1232361612 1434 1708 3748",
};
const NARROW = {
  // Narrow right-hand parts, 3 by 9: knife, ear, seal.
  dao: "39 0105 202817", fu: "39 0008 00202112232415", jie: "39 0020202515 0008",
};
// Enclosures drawn on the whole 9 by 9, with the box left inside them:
// mouth, broad, cliff, walk, borders, corpse.
const ENC = [
  ["0080880800", 2, 2, 5, 5], ["4040 1181 111608", 3, 3, 6, 6], ["1080 101608", 3, 2, 6, 7],
  ["0011 032316273888", 3, 0, 6, 6], ["0800808877", 2, 2, 5, 7], ["10707212 101608", 3, 4, 6, 5],
];

function comp(s) {
  const [wh, ...st] = s.trim().split(" ");
  return { w: +wh[0], h: +wh[1], st: st.map((t) => Array.from(t, Number)) };
}
const set = (o) => Object.keys(o).map((k) => Object.assign(comp(o[k]), { k }));
const SL = set(LEFT), ST = set(TOP), SB = set(BOT), SG = set(GEN), SR = set(RIGHT), SN = set(NARROW);
const SE = ENC.map(([s, x, y, w, h]) => Object.assign(comp("99 " + s), { box: [x, y, w, h], k: "e" + s.length }));
const one = (a) => a[floor(Math.random() * a.length)];

// Real characters that a frame and stock parts would make (休, 林, 字, 因,
// 古), 78 of them, drawn again when they come up: at Strokes 0 that is 3.3%
// of the characters drawn. Only these are checked. The Kangxi dictionary
// (1716) holds 47,035 characters and none of it is here, so a page can
// still carry a real one, which Xu Bing made sure his 4,000 never were.
const REAL = new Set(
  ("LR:ren+mu4 LR:ren+zi LR:ren+cun LR:ren+shi LR:ren+bai LR:ren+ding LR:ren+ge LR:shui+gong LR:shui+shi LR:shui+yang " +
    "LR:shui+ding LR:shui+mu4 LR:shui+bai LR:shou+ding LR:shou+gong LR:shou+zhui LR:mu+cun LR:mu+tu LR:mu+mu4 LR:mu+zhui " +
    "LR:kou+tu LR:kou+ding LR:kou+shi LR:kou+zhui LR:yan+shi LR:yan+yang LR:yan+ding LR:yan+zhui LR:yan+cun LR:jin+shi " +
    "LR:jin+ding LR:jin+zhui LR:ri+wang LR:tu+zhui LR:xin+zhui LR:shi+ding LR:he+zhui LR:wang+li LR2:nv+zi LR2:mu4+mu4 " +
    "LR2:nv+nv LR2:ren+ren TB:mian+zi TB:mian+nv TB:cao+tian TB:ren+wang TB2:kou+kou TB2:ri+ri TB2:tu+tu TB2:huo+huo " +
    "TB2:shi+kou TBb:ri+yi TBb:tian+xin TBb:mu4+huo TBb:kou+er TB:mian+mu4 LRn:he+dao LRn:gong+fu LRn:you+fu " +
    "LR:shui+ri LR:kou+kou LR:ren+li E0:ren E0:da E0:mu4 E0:kou E0:wang E0:zi " +
    "E1:mu4 E1:tu E2:ding E2:li E3:da E3:cun E3:li E3:shi E4:ren E4:kou").split(" "),
);

// Bresenham into a bitmap gw wide.
function line(g, gw, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    g[y0 * gw + x0] = 1;
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * e;
    if (e2 >= dy) (e += dy), (x0 += sx);
    if (e2 <= dx) (e += dx), (y0 += sy);
  }
}
// Stroke component c into the box; returns its stroke count.
function put(g, gw, c, bx, by, bw, bh) {
  const sx = c.w > 1 ? (bw - 1) / (c.w - 1) : 0, sy = c.h > 1 ? (bh - 1) / (c.h - 1) : 0;
  for (const s of c.st) {
    let px = bx + round(s[0] * sx), py = by + round(s[1] * sy);
    for (let i = 2; i < s.length; i += 2) {
      const qx = bx + round(s[i] * sx), qy = by + round(s[i + 1] * sy);
      line(g, gw, px, py, qx, qy);
      (px = qx), (py = qy);
    }
  }
  return c.st.length;
}

// A part in a box: a stock part, or at the next level the box split in two.
// Small parts are not blown up past two points bigger than their grid.
function part(g, box, nest, keys, depth) {
  const [x, y, w, h] = box;
  if (depth < 2 && Math.random() < nest) {
    keys.push("+");
    if (w >= 5 && (w >= h || h < 5)) {
      const lw = floor((w - 1) / 2);
      return part(g, [x, y, lw, h], nest * 0.6, keys, depth + 1) + part(g, [x + lw + 1, y, w - lw - 1, h], nest * 0.6, keys, depth + 1);
    }
    if (h >= 5) {
      const th = floor((h - 1) / 2);
      return part(g, [x, y, w, th], nest * 0.6, keys, depth + 1) + part(g, [x, y + th + 1, w, h - th - 1], nest * 0.6, keys, depth + 1);
    }
  }
  const pool = w >= 5 && h >= 9 && Math.random() < 0.12 ? SR : SG;
  let c = one(pool);
  for (let i = 0; i < 6 && (c.w > w + 1 || c.h > h + 1); i++) c = one(pool);
  keys.push(c.k);
  const bw = c.w < 5 && w > c.w ? min(w, c.w + 2) : w, bh = c.h < 5 && h > c.h ? min(h, c.h + 2) : h;
  return put(g, 9, c, x + floor((w - bw) / 2), y + floor((h - bh) / 2), bw, bh);
}

// One invented character into the 9 by 9 bitmap g. u is Strokes moved to
// 0..1. Frames and their shares at u = 0.5: one part 7%, left radical and
// right part 36%, two halves 7%, left part and narrow right 6%, head and
// body 16%, two stacked 6%, body and foot 8%, enclosure 14%.
function makeChar(g, u) {
  const nest = u < 0.5 ? 0.6 * u : 0.3 + 1.4 * (u - 0.5);
  const single = u < 0.5 ? 0.22 - 0.3 * u : 0.07 - 0.1 * (u - 0.5);
  for (let tries = 0; ; tries++) {
    g.fill(0);
    const keys = [];
    let r = Math.random(), n = 0, f;
    const sh = (1 - single) / 0.93;
    if (r < single) {
      // Every stock part alone is a real character (木, 力, 米), so a single
      // part gets one dot more where there is room for it.
      (f = "S"), (n = part(g, [0, 0, 9, 9], 0, keys, 2) + 1);
      for (const i of [10, 16, 64, 70, 4, 36, 44].sort(() => Math.random() - 0.5)) {
        let free = true;
        for (let dy = -9; dy <= 9; dy += 9) for (let dx = -1; dx <= 1; dx++) if (g[i + dy + dx]) free = false;
        if (free) {
          g[i] = 1;
          break;
        }
      }
    } else if ((r = (r - single) / sh) < 0.36) {
      const c = one(SL);
      (f = "LR"), keys.push(c.k), (n = put(g, 9, c, 0, 0, 3, 9) + part(g, [4, 0, 5, 9], nest, keys, 0));
    } else if (r < 0.43) (f = "LR2"), (n = part(g, [0, 0, 4, 9], 0, keys, 2) + part(g, [5, 0, 4, 9], 0, keys, 2));
    else if (r < 0.49) {
      n = part(g, [0, 0, 5, 9], nest, keys, 0);
      const c = one(SN);
      (f = "LRn"), keys.push(c.k), (n += put(g, 9, c, 6, 0, 3, 9));
    } else if (r < 0.65) {
      const c = one(ST);
      (f = "TB"), keys.push(c.k), (n = put(g, 9, c, 0, 0, 9, 3) + part(g, [0, 4, 9, 5], nest, keys, 0));
    } else if (r < 0.71) (f = "TB2"), (n = part(g, [0, 0, 9, 4], 0, keys, 2) + part(g, [0, 5, 9, 4], 0, keys, 2));
    else if (r < 0.79) {
      n = part(g, [0, 0, 9, 5], nest, keys, 0);
      const c = one(SB);
      (f = "TBb"), keys.push(c.k), (n += put(g, 9, c, 0, 6, 9, 3));
    } else {
      const i = floor(Math.random() * SE.length), c = SE[i];
      (f = "E" + i), (n = put(g, 9, c, 0, 0, 9, 9) + part(g, c.box, nest, keys, 0));
    }
    if (tries < 8 && REAL.has(f + ":" + keys.join("+"))) continue;
    return n;
  }
}

// ---- The page. A frame from x 1 to 62 and y 10 to 122, five columns 11
// wide with a rule between each, eleven characters a column on a 10-row
// pitch: 55 places. The top margin is 10 rows and the bottom 5, the wider
// one above as in Chinese books. Columns read right to left, so the
// printing strips run from x 64 down to 0, split at the rules.
const TOPY = 10, BOTY = 122, RULES = [13, 25, 37, 49], EDGES = [64, 49, 37, 25, 13, 0];
const STRIP = new Uint8Array(W);
for (let x = 0; x < W; x++) STRIP[x] = x >= 49 ? 0 : x >= 37 ? 1 : x >= 25 ? 2 : x >= 13 ? 3 : 4;

function makePage(u, notes) {
  const ink = new Uint8Array(N), halo = new Uint8Array(N);
  for (let x = 1; x <= 62; x++) ink[TOPY * W + x] = ink[BOTY * W + x] = 1;
  for (let y = TOPY; y <= BOTY; y++) {
    ink[y * W + 1] = ink[y * W + 62] = 1;
    for (const rx of RULES) ink[y * W + rx] = 1;
  }
  const g = new Uint8Array(81), sg = new Uint8Array(16);
  let strokes = 0, chars = 0, note = false;
  const start = 0.6 * notes, keep = 0.5 + 0.5 * notes;
  for (let j = 0; j < 5; j++)
    for (let k = 0; k < 11; k++) {
      const x0 = 3 + 12 * j, y0 = 12 + 10 * k;
      note = Math.random() < (note ? keep : start);
      if (note) {
        // Four small characters, two side by side, two down.
        for (let q = 0; q < 4; q++) {
          sg.fill(0);
          let c = one(SG);
          while (c.w > 5 || c.h > 5) c = one(SG);
          put(sg, 4, c, 0, 0, 4, 4);
          const ox = x0 + (q & 1 ? 0 : 5), oy = y0 + (q >> 1) * 5;
          for (let i = 0; i < 16; i++) if (sg[i]) ink[(oy + (i >> 2)) * W + ox + (i & 3)] = 1;
        }
        continue;
      }
      strokes += makeChar(g, u);
      chars++;
      // Song faces cut horizontals thin and verticals thick. An LED cannot
      // be thinner than one, so a pixel that only runs sideways is inked
      // lighter (2) and the uprights stay full (1).
      for (let i = 0; i < 81; i++) {
        if (!g[i]) continue;
        const gx = i % 9, gy = floor(i / 9);
        const side = (gx > 0 && g[i - 1]) || (gx < 8 && g[i + 1]), up = (gy > 0 && g[i - 9]) || (gy < 8 && g[i + 9]);
        ink[(y0 + gy) * W + x0 + gx] = side && !up ? 2 : 1;
      }
    }
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (!ink[p] && (ink[p - 1] || ink[p + 1] || ink[p - W] || ink[p + W])) halo[p] = 1;
    }
  return { ink, halo, t0: new Float32Array(5).fill(1e9), strokes, chars };
}

// Paper grain for two sheets, alternating, so each sheet keeps its own.
const GRAIN = [new Float32Array(N), new Float32Array(N)];
for (let s = 0; s < 2; s++)
  for (let p = 0; p < N; p++) {
    let h = Math.imul(p + 7919 * (s + 1), 2654435761) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    GRAIN[s][p] = ((h ^ (h >>> 13)) >>> 0) / 4294967296 - 0.5;
  }

// Paper and ink along Ink: black on ivory, indigo, vermilion, a rubbing
// (the paper inked black, the cut strokes left white), gold on indigo.
const PAL = [
  [[238, 229, 205], [24, 22, 24]],
  [[238, 229, 205], [30, 52, 128]],
  [[238, 229, 205], [192, 48, 26]],
  [[26, 26, 30], [228, 222, 206]],
  [[26, 36, 96], [224, 182, 92]],
];
// Each holds for 0.175 either side of its stop, so the knob rests on whole
// palettes and only passes through the grey between dark and light paper.
function palette(k) {
  const f = cl(k, 0, 1) * 4, i = min(3, floor(f)), a = PAL[i], b = PAL[i + 1];
  let t = cl((f - i - 0.35) / 0.3, 0, 1);
  t = t * t * (3 - 2 * t);
  return [0, 1].map((j) => a[j].map((v, c) => v + (b[j][c] - v) * t));
}

// Timing. The new sheet's edge moves 2.5 × Speed LEDs a second; a strip
// is printed 0.4/Speed s after the sheet has covered it, the impression
// running down the strip in 2/Speed s (0.2 s and 1 s at Speed 2). Fresh
// ink is 10% further from the paper than dry ink and darkens the paper
// beside it by 12% while wet; both dry off in about a second. The page
// underneath shows through the sheet at 13%, and horizontals are inked
// at 72%.
const FRESH = 0.1, WET = 0.12, DRY = 0.9, SPREAD = 0.4, GHOST = 0.13, THIN = 0.72;

export function setup(params) {
  params.s = { t: 0, ready: false, e: 67, rest: 0, sheet: 0, pages: null, u: 0.5, notes: 0.06, speed: 2, ink: 0, key: "" };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.ink = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.u = (cl(k[2], -1, 1) + 1) / 2;
  S.notes = cl(k[3], 0, 1);
  if (!S.ready) {
    // The page is full from the first frame: the sheet on top printed
    // long ago, one under it showing through, and the next one waiting.
    const older = makePage(S.u, S.notes), old = makePage(S.u, S.notes);
    older.t0.fill(-1e3), old.t0.fill(-1e3);
    S.pages = [older, old, makePage(S.u, S.notes)];
    S.ready = true;
    S.key = S.u.toFixed(2) + S.notes.toFixed(2);
  }
  const key = S.u.toFixed(2) + S.notes.toFixed(2);
  if (key !== S.key) {
    // Strokes or Notes turned: the columns of the new sheet not printed yet
    // are set again, so the change shows from the next column on.
    S.key = key;
    const nw = S.pages[2], re = makePage(S.u, S.notes);
    for (let s = 0; s < 5; s++)
      if (nw.t0[s] > 1e8)
        for (let y = 0; y < H; y++)
          for (let x = EDGES[s + 1]; x < EDGES[s]; x++) (nw.ink[y * W + x] = re.ink[y * W + x]), (nw.halo[y * W + x] = re.halo[y * W + x]);
  }
  S.t += d;
  const [, , nw] = S.pages;
  if (S.e > 0) {
    // A page turn is a wipe 67 LEDs long, 13.4 s at Speed 2, longer than
    // the six seconds the map measures over; motion comes from a column
    // changing at a time, never the page at once.
    S.e = max(0, S.e - d * 2.5 * S.speed);
    for (let s = 0; s < 5; s++) if (nw.t0[s] > 1e8 && S.e <= EDGES[s + 1]) nw.t0[s] = S.t + 0.4 / S.speed;
    if (S.e === 0) S.rest = 4 / S.speed;
  } else if ((S.rest -= d) <= 0) {
    S.pages = [S.pages[1], nw, makePage(S.u, S.notes)];
    S.sheet ^= 1;
    S.e = 67;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const [older, old, nw] = S.pages, t = S.t, pass = 2 / S.speed;
  const [paper, ink] = palette(S.ink);
  const dr = ink[0] - paper[0], dg = ink[1] - paper[1], db = ink[2] - paper[2];
  const ga = GRAIN[S.sheet], gb = GRAIN[S.sheet ^ 1];
  const e = S.e, shadowX = e < 64 ? Math.ceil(e) - 1 : -1;
  for (let y = 0; y < H; y++) {
    const rowF = cl((y - TOPY) / (BOTY - TOPY), 0, 1) * pass;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, top = x >= e;
      const pg = top ? nw : old, under = top ? old : older;
      const gr = top ? gb[p] : ga[p];
      // Paper, its grain, and the page under it.
      let a = 0.035 * gr;
      if (under.ink[p]) a += GHOST;
      const ti = pg.t0[STRIP[x]] + rowF;
      if (t >= ti) {
        const age = t - ti;
        if (pg.ink[p]) a = (pg.ink[p] === 2 ? THIN : 1) + FRESH * exp(-age / DRY);
        else if (pg.halo[p]) a += WET * exp(-age / SPREAD);
      }
      const sh = x === shadowX ? 0.97 : 1;
      const r = (paper[0] + dr * a) * sh, g = (paper[1] + dg * a) * sh, b = (paper[2] + db * a) * sh;
      display.setPixel(x, y, cl(r, 0, 255) | 0, cl(g, 0, 255) | 0, cl(b, 0, 255) | 0);
    }
  }
}
