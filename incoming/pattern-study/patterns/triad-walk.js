// ===== Patternflow pattern =====
// Title:   Triad Walk
// Family:  tonnetz
// Idea:    The panel is a window onto the Tonnetz, the triangular lattice of pitch classes in which every small triangle is a major or a minor triad, and one lit triad at a time swings across an edge to its neighbour, keeping two of its three notes, while the window follows it and its path fades behind it as stained glass.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Leonhard Euler, Tentamen novae theoriae musicae (1739), the lattice of fifths and thirds; Hugo Riemann's triad changes (late 19th century); David Lewin, Generalized Musical Intervals and Transformations (1987); Richard Cohn, Neo-Riemannian operations, parsimonious trichords, and their Tonnetz representations (1997)
// Round:   216
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Scale=1.3..3.15, Memory=-3..1, Bias=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of all twelve pitch classes, so one turn comes back to where it began. At 0 the circle of fifths runs round the colour wheel 30 degrees a step, from C teal (hue 190 degrees in OKLCH) through G sky blue, D light blue, A periwinkle and E lavender to B pink, F sharp coral, C sharp salmon, G sharp amber, D sharp olive, A sharp green and F emerald. On top of the knob the whole wheel turns once in 4 minutes, 1.5 degrees a second.
// Knob 2: Scale. The side of one lattice triangle, 7 LEDs times the knob: 9.1 LEDs at 1.3, 14 at the opening 2 and 22 at 3.15. The panel is 7 triangles wide and 16 rows tall at 9.1, 4.6 wide and 10.6 rows at 14, 2.9 wide and 6.7 rows at 22. The lattice grows and shrinks about the middle of the panel.
// Knob 3: Memory. How long a triad stays lit after the walker leaves it, on a logarithmic scale: 0.5 s at -3, 7.9 s at the opening 0 and 20 s at 1, with a swell of 0.8 to 1.23 times that over 71 s. At 0.5 s only the triad lit now shows. At the opening six or eight triads glow, and at 20 s twenty to thirty, so the walk is a ribbon of glass with the oldest panes nearly gone.
// Knob 4: Bias. Which neo-Riemannian moves the walker prefers, and how fast it hops. At -1 it mostly alternates P and L, the hexatonic flavour: long straight runs along the major-third axis, a hop every 1.7 s on average. At 0 it takes no side and hops every 1.0 s. At +1 it mostly alternates P and R, the octatonic flavour: runs along the minor-third axis, a hop every 0.6 s. Slow rhythms of their own keep pulling it from one flavour to another at any setting.

// What is drawn. Pitch classes sit on a triangular lattice. One step along the
// first axis raises the pitch by a perfect fifth (7 semitones), along the second
// by a major third (4), along the third, the difference of the two, by a minor
// third (3). Call a lattice point (a, b). Its pitch class is (7a + 4b) mod 12 and
// its place on the circle of fifths is k = (a + 4b) mod 12.
// Each small triangle holds three notes that make a triad. The triangle with
// corners (a, b), (a+1, b) and (a, b+1) is major, and the one with corners
// (a+1, b), (a, b+1) and (a+1, b+1) is minor. Triangles that share an edge share
// two notes, so one voice moves and two stay. The three moves of neo-Riemannian
// theory cross the three edges:
//   P (parallel):  C major to C minor, the third moves 1 semitone
//   L (leading):   C major to E minor, the root moves 1 semitone
//   R (relative):  C major to A minor, the fifth moves 2 semitones
// Each move undoes itself (P then P is the start again), so the walker never
// takes the move it just took.
// Alternating two moves goes in a straight line across the lattice: P and L along
// the major-third axis (the hexatonic cycle, six triads, which closes in pitch
// but not on the lattice), P and R along the minor-third axis (the octatonic
// cycle, eight triads), L and R along the fifths axis (24 moves to close). Turning
// at every step instead goes round one lattice point: P, L, R, P, L, R is back
// where it started, a rosette of six triangles.
// The lattice is turned 74 degrees on the panel, so the fifths axis runs almost up
// and down, and it sways 24 degrees either way, see below.
//
// Colour. Each pitch class has a hue that follows k: 30 degrees for each fifth, 120
// for each major third, 90 backwards for each minor third. The colours are OKLCH
// at lightness 0.76 and chroma 0.165, with the chroma cut back until the colour
// fits in sRGB (to 0.123 for the cyans and blues). Inside a lit triangle the three
// corner colours are mixed in OKLab and the chroma of the mix is set back to the
// average chroma of the corners, so the middle of a pane is as clean as its
// corners. The ground is a dark violet black.
//
// A pane is the triangle drawn 1 LED inside the lattice edge, so two panes that
// touch have a dark lead of 2 LEDs between them. Its light is stronger toward the
// edge than in the middle and about 10 percent uneven across the glass, and each
// pane has its own luminosity, 0.62 to 1. A lattice point is a bead 3.4 to 7 LEDs
// across, brighter while a lit pane has it as a corner. The edges are 2 LEDs wide
// and very dim until the walker crosses one: it flashes and falls back in 0.4 s.
//
// What moves. The walker sits on one triangle for a beat, then hops. A hop takes
// 0.1 to 0.24 s: the corner opposite the shared edge slides across it to its
// mirror image, so the pane folds over the edge, and that corner's colour slides
// from the note it leaves to the note it takes. The pane it left stays lit and
// fades over the Memory time. The window follows the walker with a spring, after
// the walker's place is smoothed over 0.6 s, and only once the walker leaves an
// ellipse of 7 by 18 LEDs about a spot that itself roams the panel (6 LEDs across,
// 30 up and down, periods 41.3 and 67.7 s). A lattice point the walker has touched
// keeps a faint glow for minutes (1/e in 110 s), so the route outlasts the panes.
// Which move comes next. After a move there are two choices: go on in a straight
// line (the move before the last one) or turn (the third move). The weights are e
// to the power g, where g belongs to the pair of moves the choice would make. Each
// pair has a slow sine, P-L, P-R and L-R, periods 53.7, 89.3 and 131.1 s, and Bias
// adds up to 2.4 to the P-L pair at -1 and to the P-R pair at +1. A sine of period
// 43.7 s now and then starts a rosette, five or six turns in a row.
// When it hops. The wait is a tempo that Bias sets (0.95 s times e to the power of
// -0.55 Bias), times 2 to the power of three slow sines (periods 61.3, 23.9 and
// 9.7 s), times a swing that makes the hops alternate a little long and a little
// short (37.1 s), times a random factor with a spread of 0.28 in the logarithm.
// One hop in fourteen waits twice as long, to breathe. It is never under 0.24 s or
// over 3.4 s.
// Why no scene comes back. The random choices come from a generator seeded when the
// pattern starts, and every slow swing has a period of its own with no common
// factor. The window drifts too: the colour wheel turns once in 4 minutes, the
// lattice sways (131 and 57 s), grows and shrinks by 7 percent (97 s), the Memory
// time swells by 0.3 octave (71 s) and slow waves of light cross the resting
// lattice (53.1 and 79.7 s). A straight run looks the same at any hue 120 degrees
// away, so without these the same ribbon came back.
// Nothing grows without a limit. The trail keeps the last 28 s, touched lattice
// points go after 660 s, and only the walker's place on the lattice grows, by a few
// dozen steps in 900 s. The walker starts 32 s before the first frame, so the panes
// are laid down when the picture opens.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sin, cos, exp, sqrt, round, pow, PI, abs, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (u) => {
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return u * u * (3 - 2 * u);
};
const mod12 = (v) => ((v % 12) + 12) % 12;

// ---- the lattice
const ROT = (74 * PI) / 180; // angle of the fifths axis on the panel, radians
const SIDE0 = 7; // triangle side in LEDs for each unit of the Scale knob
const OX = 32, OY = 64; // the middle of the panel, where the window looks
const H3 = sqrt(3) / 2; // altitude of a triangle over its side

// ---- colour
const HUE0 = 190; // hue of the pitch class on k = 0 at Hue 0, degrees in OKLCH
const LIGHT = 0.76; // OKLab lightness of every pitch class
const CHROMA = 0.165; // OKLab chroma before it is cut back to fit sRGB
const GROUND = [0.0032, 0.0016, 0.0072]; // the ground, linear light (about 10, 6, 19 of 255)

// ---- the walk
const PRE = 32; // seconds the walker has been walking before the first frame
const KEEP = 28; // seconds of trail kept: the longest Memory, 20 s, and the swell of the memory on top of it
const AMP = 1.0; // size of the slow swing of each flavour, as a weight exponent
const PUSH = 2.4; // what Bias adds to a flavour at its end of the knob, as a weight exponent
const PERIOD_PL = 53.7, PERIOD_PR = 89.3, PERIOD_LR = 131.1; // periods of the flavour swings, s
const PERIOD_ROSETTE = 43.7; // period of the swing that starts rosettes, s
const MIN_WAIT = 0.24, MAX_WAIT = 3.4; // limits on the wait between hops, s
const FOLLOW = 0.6; // time constant of the smoothed camera target, s
const SPRING = 3; // natural frequency of the camera spring, radians a second
const ROAM_X = 6, ROAM_Y = 30; // where the walker sits on the panel itself wanders by this much across and up or down, LEDs, periods 41.3 and 67.7 s
const DEAD_X = 7, DEAD_Y = 18; // the walker may drift this far across and up or down from the middle of the panel before the window follows, LEDs

// ---- the slow swings of the whole window, so no scene comes back, and the footprint
const HUE_DRIFT = 1 / 240; // turns of hue a second: one full turn of the colour wheel in 4 minutes
const SWAY = (24 * PI) / 180; // the lattice turns this far either way about the middle, period 131 s, with a smaller swing of 57 s on top
const SWELL = 0.3; // the Memory time swells and shrinks by this many octaves either way, period 71.3 s
const FOOT = 0.4; // how brightly a lattice point the walker has touched glows, once its triad has faded, against 1 for a lit corner
const FOOT_T = 110; // seconds for that glow to fall to 1/e
const TIDE = 0.55; // how far the resting lattice (beads and edges) brightens and dims either way as slow waves of light cross it
const BREATH = 0.07; // the lattice grows and shrinks by this share either way, period 97 s

// ---- the picture
const TRAIL_TOP = 0.8; // brightness of a triad that has just been left, against 1 for the one lit now
const TRAIL_SHAPE = 1.0; // the fade runs as (1 - age / Memory) to this power
const LUM_LOW = 0.62; // the dimmest glass: each pane gets a luminosity between this and 1, drawn when the walker enters it
const GAP = 1.0; // the glass stops this far inside the lattice edge, LEDs
const PAD = 7; // how far past its edge a triangle's pixels are looked at, LEDs
const EDGE_REST = 0.014; // brightness of an edge nobody has crossed
const FLASH_LIFE = 0.38; // a crossed edge flashes down in this many seconds

// ---- the 12 colours
const GAMMA = new Uint8Array(4096);
for (let i = 0; i < 4096; i++) {
  const v = i / 4095;
  GAMMA[i] = round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055));
}

function oklabToLin(L, a, b, out) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

// A pitch colour: its OKLab coordinates, its chroma, and its linear rgb.
function pitchColour(hueDeg, out) {
  const h = (hueDeg * PI) / 180, tmp = [0, 0, 0];
  let c = CHROMA;
  for (let i = 0; i < 14; i++) {
    oklabToLin(LIGHT, c * cos(h), c * sin(h), tmp);
    if (min(tmp[0], tmp[1], tmp[2]) >= -0.002 && max(tmp[0], tmp[1], tmp[2]) <= 1.002) break;
    c *= 0.93;
  }
  out.L = LIGHT;
  out.a = c * cos(h);
  out.b = c * sin(h);
  out.C = c;
  out.rgb = [cl(tmp[0], 0, 1), cl(tmp[1], 0, 1), cl(tmp[2], 0, 1)];
}

// Mix two pitch colours in OKLab, then put the chroma back to the mixed chroma.
function mixColour(c0, c1, t, out) {
  const L = c0.L + (c1.L - c0.L) * t;
  let a = c0.a + (c1.a - c0.a) * t, b = c0.b + (c1.b - c0.b) * t;
  const C = c0.C + (c1.C - c0.C) * t, m = hypot(a, b);
  if (m > 1e-5) {
    a *= C / m;
    b *= C / m;
  }
  out.L = L;
  out.a = a;
  out.b = b;
  out.C = C;
  return out;
}

// The edge between two lattice points runs from one pitch colour to the next.
// Axis 0 is a step of the fifths axis (k + 1), axis 1 the major-third axis
// (k + 4), axis 2 the line a + b = const (k + 3). Four steps along each edge.
const STEPK = [1, 4, 3];

function buildColours(S, hue) {
  if (S.hueBuilt === hue) return;
  S.hueBuilt = hue;
  for (let k = 0; k < 12; k++) pitchColour(HUE0 + 30 * k + 360 * hue, S.col[k]);
  const m = { L: 0, a: 0, b: 0, C: 0 }, rgb = [0, 0, 0];
  for (let f = 0; f < 3; f++)
    for (let k = 0; k < 12; k++)
      for (let j = 0; j < 4; j++) {
        mixColour(S.col[k], S.col[(k + STEPK[f]) % 12], (j + 0.5) / 4, m);
        oklabToLin(m.L, m.a, m.b, rgb);
        const o = ((f * 12 + k) * 4 + j) * 3;
        S.elut[o] = cl(rgb[0], 0, 1);
        S.elut[o + 1] = cl(rgb[1], 0, 1);
        S.elut[o + 2] = cl(rgb[2], 0, 1);
      }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(S) {
  return sqrt(-2 * Math.log(1 - S.rng())) * cos(TAU * S.rng());
}

// ---- triangles
// A triangle is {o, a, b}. o = 0 is the major triad with corners (a, b), (a+1, b),
// (a, b+1). o = 1 is the minor triad with corners (a+1, b), (a, b+1), (a+1, b+1).
// Moves: 0 = P, 1 = L, 2 = R.
function across(T, m) {
  if (T.o === 0) return m === 0 ? { o: 1, a: T.a, b: T.b - 1 } : m === 1 ? { o: 1, a: T.a, b: T.b } : { o: 1, a: T.a - 1, b: T.b };
  return m === 0 ? { o: 0, a: T.a, b: T.b + 1 } : m === 1 ? { o: 0, a: T.a, b: T.b } : { o: 0, a: T.a + 1, b: T.b };
}
function corners(T) {
  return T.o === 0 ? [[T.a, T.b], [T.a + 1, T.b], [T.a, T.b + 1]] : [[T.a + 1, T.b], [T.a, T.b + 1], [T.a + 1, T.b + 1]];
}
const nodeKey = (a, b) => (a + 524288) * 1048576 + (b + 524288);
const centroid = (T) => (T.o === 0 ? [T.a + 1 / 3, T.b + 1 / 3] : [T.a + 2 / 3, T.b + 2 / 3]);

export function setup(params) {
  const rng = mulberry32(floor(Math.random() * 4294967296));
  const S = {
    rng,
    t: 0,
    pre: false,
    ph: [], // phases of the slow swings
    cur: { o: 0, a: 0, b: 0 },
    lum: 1, // luminosity of the glass the walker is on
    from: null,
    hopT: -10, glide: 0.2,
    nextHop: 0.6,
    m1: -1, m2: -1,
    swirl: 0,
    parity: 0,
    hist: [], // triads the walker has left: {o, a, b, t}
    cross: [], // edges it crossed, as the two lattice points at their ends: {a1, b1, a2, b2, t}
    ca: 1 / 3, cb: 1 / 3, va: 0, vb: 0, // the window, in lattice coordinates, and its speed
    ta: 1 / 3, tb: 1 / 3, // smoothed target
    side: 14, lifeKnob: 7.9, life: 7.9, bias: 0.06, hue: 0,
    hueBuilt: -1,
    col: [], elut: new Float32Array(3 * 12 * 4 * 3),
    buf: new Float32Array(N * 3),
    heat: new Map(),
    foot: new Map(), // lattice points the walker has touched: key to the time of the last touch
  };
  for (let i = 0; i < 16; i++) S.ph.push(rng() * TAU);
  for (let k = 0; k < 12; k++) S.col.push({ L: 0, a: 0, b: 0, C: 0, rgb: [0, 0, 0] });
  params.s = S;
}

// The weight exponent of each pair of moves, by the third move: index 2 is
// the P-L pair, 1 the P-R pair, 0 the L-R pair.
function flavour(S, g) {
  const t = S.t, bias = S.bias;
  g[2] = AMP * sin((TAU * t) / PERIOD_PL + S.ph[0]) + PUSH * max(0, -bias);
  g[1] = AMP * sin((TAU * t) / PERIOD_PR + S.ph[1]) + PUSH * max(0, bias);
  g[0] = AMP * sin((TAU * t) / PERIOD_LR + S.ph[2]);
}

function chooseMove(S) {
  const rng = S.rng;
  if (S.m1 < 0) return floor(rng() * 3);
  if (S.m2 < 0) return (S.m1 + 1 + floor(rng() * 2)) % 3;
  const turn = 3 - S.m1 - S.m2;
  if (S.swirl > 0) {
    S.swirl--;
    return turn;
  }
  const rose = sin((TAU * S.t) / PERIOD_ROSETTE + S.ph[3]);
  if (rose > 0 && rng() < 0.11 * rose) {
    S.swirl = 4 + floor(rng() * 2);
    return turn;
  }
  const g = [0, 0, 0];
  flavour(S, g);
  const ws = exp(g[turn]), wt = exp(g[S.m2]);
  return rng() * (ws + wt) < ws ? S.m2 : turn;
}

// The wait until the next hop, seconds.
function wait(S) {
  const t = S.t, ph = S.ph;
  const base = 0.95 * exp(-0.55 * S.bias);
  const slow = pow(2, 0.38 * sin((TAU * t) / 61.3 + ph[4]) + 0.27 * sin((TAU * t) / 23.9 + ph[5]) + 0.15 * sin((TAU * t) / 9.7 + ph[6]));
  const swing = 1 + 0.2 * sin((TAU * t) / 37.1 + ph[7]) * (S.parity ? 1 : -1);
  let v = base * slow * swing * exp(0.28 * gauss(S));
  if (S.rng() < 1 / 14) v *= 2;
  return cl(v, MIN_WAIT, MAX_WAIT);
}

function hop(S) {
  const A = S.cur, mv = chooseMove(S), B = across(A, mv);
  const va = corners(A), vb = corners(B);
  // The two lattice points the triangles share are the edge that is crossed.
  const shared = va.filter((p) => vb.some((q) => q[0] === p[0] && q[1] === p[1]));
  // A triad is lit once: the one being left goes in at the end, and the one being entered comes out.
  for (let i = S.hist.length - 1; i >= 0; i--) {
    const e = S.hist[i];
    if (e.o === A.o && e.a === A.a && e.b === A.b) S.hist.splice(i, 1);
    else if (e.o === B.o && e.a === B.a && e.b === B.b) S.hist.splice(i, 1);
  }
  S.hist.push({ o: A.o, a: A.a, b: A.b, t: S.nextHop, lum: S.lum });
  S.lum = LUM_LOW + (1 - LUM_LOW) * S.rng();
  for (const q of vb) {
    const key = nodeKey(q[0], q[1]);
    S.foot.delete(key);
    S.foot.set(key, S.nextHop);
  }
  S.cross.push({ a1: shared[0][0], b1: shared[0][1], a2: shared[1][0], b2: shared[1][1], t: S.nextHop });
  const gap = S.nextHop - S.hopT; // the wait that has just ended
  S.from = A;
  S.cur = B;
  S.hopT = S.nextHop;
  S.glide = cl(0.6 * gap, 0.1, 0.24);
  S.m2 = S.m1;
  S.m1 = mv;
  S.parity ^= 1;
  S.nextHop = S.hopT + wait(S);
  const c = centroid(B);
  S.gta = c[0];
  S.gtb = c[1];
}

function advance(S, h) {
  S.t += h;
  S.life = min(KEEP, S.lifeKnob * pow(2, SWELL * sin((TAU * S.t) / 71.3 + S.ph[10])));
  while (S.t >= S.nextHop) hop(S);
  // The window: a target that smooths the walker's jumps, and a spring after it.
  // The walker may wander inside an ellipse round the middle before the window moves.
  const e = 1 - exp(-h / FOLLOW);
  S.ta += (S.gta - S.ta) * e;
  S.tb += (S.gtb - S.tb) * e;
  frame(S);
  const oa = S.ta - S.ca, ob = S.tb - S.cb;
  const rx = ROAM_X * sin((TAU * S.t) / 41.3 + S.ph[12]), ry = ROAM_Y * sin((TAU * S.t) / 67.7 + S.ph[13]);
  const sx = oa * S.ux + ob * S.vx - rx, sy = oa * S.uy + ob * S.vy - ry, dist = hypot(sx / DEAD_X, sy / DEAD_Y);
  let da = 0, db = 0;
  if (dist > 1) {
    const k = 1 - 1 / dist, mx = sx * k, my = sy * k;
    da = S.ia * mx + S.ib * my;
    db = S.ja * mx + S.jb * my;
  }
  const w2 = SPRING * SPRING, w1 = 2 * SPRING;
  S.va += (w2 * da - w1 * S.va) * h;
  S.vb += (w2 * db - w1 * S.vb) * h;
  S.ca += S.va * h;
  S.cb += S.vb * h;
  while (S.hist.length && S.t - S.hist[0].t > KEEP) S.hist.shift();
  while (S.cross.length && S.t - S.cross[0].t > 3) S.cross.shift();
  for (const [key, t] of S.foot) {
    if (S.t - t <= 6 * FOOT_T) break;
    S.foot.delete(key);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0];
  S.side = SIDE0 * cl(k[1], 1.3, 3.15);
  S.lifeKnob = 0.5 * pow(40, cl((k[2] + 3) / 4, 0, 1));
  S.bias = cl(k[3], -1, 1);
  if (!S.pre) {
    S.pre = true;
    const c = centroid(S.cur);
    S.gta = c[0];
    S.gtb = c[1];
    S.hopT = -wait(S);
    S.nextHop = 0.2;
    for (let i = 0; i < round(PRE / 0.05); i++) advance(S, 0.05);
    S.ta = S.gta;
    S.tb = S.gtb;
  }
  let span = cl(dt || 0, 0, 0.2);
  while (span > 1e-9) {
    const h = min(span, 1 / 30);
    advance(S, h);
    span -= h;
  }
}

// ---- drawing
// The resting lattice is a little brighter in some places than in others, and the
// brighter places drift: two slow waves of light on the lattice, periods 53.1 and
// 79.7 s, one 0.55 and 0.9 radians a lattice step along a and b, the other -0.8 and 0.4.
function tide(S, a, b) {
  const w = 0.6 * sin(0.55 * a + 0.9 * b - (TAU * S.t) / 53.1 + S.ph[14]) + 0.4 * sin(-0.8 * a + 0.4 * b + (TAU * S.t) / 79.7 + S.ph[15]);
  return 1 + TIDE * w;
}

// Scene geometry of one frame: the lattice vectors on the panel and the inverse.
function frame(S) {
  const s = S.side * (1 + BREATH * sin((TAU * S.t) / 97 + S.ph[8]));
  const rot = ROT + SWAY * (0.8 * sin((TAU * S.t) / 131 + S.ph[9]) + 0.2 * sin((TAU * S.t) / 57 + S.ph[11]));
  S.ux = s * cos(rot);
  S.uy = s * sin(rot);
  S.vx = s * cos(rot + PI / 3);
  S.vy = s * sin(rot + PI / 3);
  S.sideNow = s;
  const det = S.ux * S.vy - S.vx * S.uy;
  S.ia = S.vy / det;
  S.ib = -S.vx / det;
  S.ja = -S.uy / det;
  S.jb = S.ux / det;
}
const px = (S, a, b) => OX + (a - S.ca) * S.ux + (b - S.cb) * S.vx;
const py = (S, a, b) => OY + (a - S.ca) * S.uy + (b - S.cb) * S.vy;

// One lit triangle with its glow. X, Y: corners on the panel. LA, LB: their
// lattice coordinates (for the glass texture). cols: their three colours. B: brightness.
function paintTriangle(S, X, Y, LA, LB, cols, B) {
  const buf = S.buf;
  const x0 = X[0], y0 = Y[0], x1 = X[1], y1 = Y[1], x2 = X[2], y2 = Y[2];
  const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  const ad = abs(det);
  if (ad < 0.02) return;
  const h0 = ad / hypot(x2 - x1, y2 - y1), h1 = ad / hypot(x0 - x2, y0 - y2), h2 = ad / hypot(x1 - x0, y1 - y0);
  const inv = 1 / det;
  const xa = max(0, floor(min(x0, x1, x2) - PAD)), xb = min(W - 1, ceil(max(x0, x1, x2) + PAD));
  const ya = max(0, floor(min(y0, y1, y2) - PAD)), yb = min(H - 1, ceil(max(y0, y1, y2) + PAD));
  const c0 = cols[0], c1 = cols[1], c2 = cols[2];
  const la0 = LA[0], la1 = LA[1], la2 = LA[2], lb0 = LB[0], lb1 = LB[1], lb2 = LB[2];
  const rgb = [0, 0, 0];
  for (let y = ya; y <= yb; y++) {
    const qy = y + 0.5;
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5;
      const w0 = ((y1 - y2) * (qx - x2) + (x2 - x1) * (qy - y2)) * inv;
      const w1 = ((y2 - y0) * (qx - x2) + (x0 - x2) * (qy - y2)) * inv;
      const w2 = 1 - w0 - w1;
      const d0 = w0 * h0, d1 = w1 * h1, d2 = w2 * h2;
      const dm = d0 < d1 ? (d0 < d2 ? d0 : d2) : d1 < d2 ? d1 : d2;
      if (dm < -PAD) continue;
      // The glass is a little smaller than the triangle, so a dark gap of about 2 LEDs
      // (the lead) lies on each lattice edge, with a soft halo outside the glass.
      const di = dm - GAP;
      const F = di > 0.5 ? 1 : di < -0.5 ? 0 : di + 0.5;
      const o = di < 0 ? -di : 0;
      const Hh = o > 1.5 ? 0.06 * exp(-((o - 1.5) * (o - 1.5)) / (2 * 1.6 * 1.6)) : 0;
      // Colour: the corner colours by their barycentric weights, kept to the triangle outside it.
      let u0 = w0 > 0 ? w0 : 0, u1 = w1 > 0 ? w1 : 0, u2 = w2 > 0 ? w2 : 0;
      const us = u0 + u1 + u2;
      if (us < 1e-6) continue;
      u0 /= us;
      u1 /= us;
      u2 /= us;
      const mid = F > 0 ? min(1, 27 * u0 * u1 * u2) : 0;
      let L = u0 * c0.L + u1 * c1.L + u2 * c2.L + 0.05 * mid;
      let A = u0 * c0.a + u1 * c1.a + u2 * c2.a, Q = u0 * c0.b + u1 * c1.b + u2 * c2.b;
      const C = (u0 * c0.C + u1 * c1.C + u2 * c2.C) * (1 - 0.12 * mid), m = hypot(A, Q);
      if (m > 1e-5) {
        A *= C / m;
        Q *= C / m;
      }
      oklabToLin(L, A, Q, rgb);
      // Glass: the light is a little uneven, and fixed to the lattice.
      const la = u0 * la0 + u1 * la1 + u2 * la2, lb = u0 * lb0 + u1 * lb1 + u2 * lb2;
      const tex = 0.9 + 0.1 * sin(5.1 * la + 2.3 * lb + 1.7 * sin(3.7 * lb - 2.9 * la));
      // Brightest at the edge, like light caught in the rim of a pane, dimmer toward the middle.
      const bevel = 0.76 + 0.24 * (1 - sm(di / 3.0));
      const I = B * (F * (bevel + 0.1 * mid) * tex + Hh);
      const p = (y * W + x) * 3;
      buf[p] += (rgb[0] < 0 ? 0 : rgb[0] > 1 ? 1 : rgb[0]) * I;
      buf[p + 1] += (rgb[1] < 0 ? 0 : rgb[1] > 1 ? 1 : rgb[1]) * I;
      buf[p + 2] += (rgb[2] < 0 ? 0 : rgb[2] > 1 ? 1 : rgb[2]) * I;
    }
  }
}

// A glowing bead for a lattice point.
function paintBead(S, cx, cy, r, c, amp, heat) {
  const buf = S.buf, R = ceil(r * 2.8) + 1;
  const xa = max(0, floor(cx - R)), xb = min(W - 1, ceil(cx + R)), ya = max(0, floor(cy - R)), yb = min(H - 1, ceil(cy + R));
  const hs = 2 * (1.15 * r) * (1.15 * r), halo = 0.22 * (0.7 + 0.3 * heat);
  const cr = c.rgb[0], cg = c.rgb[1], cb = c.rgb[2];
  for (let y = ya; y <= yb; y++) {
    const dy = y + 0.5 - cy;
    for (let x = xa; x <= xb; x++) {
      const dx = x + 0.5 - cx, d2 = dx * dx + dy * dy, d = sqrt(d2);
      const core = d <= r - 0.6 ? 1 : d >= r + 0.6 ? 0 : (r + 0.6 - d) / 1.2;
      const g = 1 - 0.5 * min(1, d2 / (r * r));
      const v = amp * (core * g + halo * exp(-d2 / hs) * (1 - core));
      if (v < 0.002) continue;
      const tn = core * 0.3 * (d < r ? (1 - d / r) * (1 - d / r) : 0);
      const p = (y * W + x) * 3;
      buf[p] += (cr * (1 - tn) + tn) * v;
      buf[p + 1] += (cg * (1 - tn) + tn) * v;
      buf[p + 2] += (cb * (1 - tn) + tn) * v;
    }
  }
}

// A crossed edge: a 2-LED line from one note's colour to the other's, with a soft glow.
function paintEdge(S, x1, y1, x2, y2, c1, c2, amp) {
  const buf = S.buf, dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const xa = max(0, floor(min(x1, x2) - 4)), xb = min(W - 1, ceil(max(x1, x2) + 4));
  const ya = max(0, floor(min(y1, y2) - 4)), yb = min(H - 1, ceil(max(y1, y2) + 4));
  const m = { L: 0, a: 0, b: 0, C: 0 }, rgb = [0, 0, 0];
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const qx = x + 0.5 - x1, qy = y + 0.5 - y1;
      const t = cl((qx * dx + qy * dy) / len2, 0, 1);
      const ex = qx - t * dx, ey = qy - t * dy, d = sqrt(ex * ex + ey * ey);
      const v = amp * ((d < 0.6 ? 1 : d < 1.4 ? (1.4 - d) / 0.8 : 0) * 0.85 + 0.22 * exp(-(d * d) / (2 * 1.7 * 1.7)));
      if (v < 0.003) continue;
      mixColour(c1, c2, t, m);
      oklabToLin(m.L + 0.07, m.a, m.b, rgb);
      const p = (y * W + x) * 3;
      buf[p] += cl(rgb[0], 0, 1) * v;
      buf[p + 1] += cl(rgb[1], 0, 1) * v;
      buf[p + 2] += cl(rgb[2], 0, 1) * v;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pre) return;
  frame(S);
  buildColours(S, S.hue + HUE_DRIFT * (S.t - PRE));
  const buf = S.buf, side = S.sideNow, col = S.col;

  // Ground.
  for (let p = 0; p < N; p++) {
    buf[p * 3] = GROUND[0];
    buf[p * 3 + 1] = GROUND[1];
    buf[p * 3 + 2] = GROUND[2];
  }

  // Edges: 2 LEDs wide, dim, drawn for every pixel from its lattice coordinates.
  {
    const { ia, ib, ja, jb, ca, cb } = S, elut = S.elut;
    const hh = side * H3;
    for (let y = 0; y < H; y++) {
      const qy = y + 0.5 - OY;
      for (let x = 0; x < W; x++) {
        const qx = x + 0.5 - OX;
        const A = ca + ia * qx + ib * qy, B = cb + ja * qx + jb * qy;
        let r = 0, g = 0, bl = 0;
        // fifths-axis edges: b is a whole number
        let d = abs(B - floor(B + 0.5)) * hh;
        if (d < 1.5) {
          const e = d < 0.5 ? 1 : 1.5 - d, a0 = floor(A), k0 = mod12(a0 + 4 * floor(B + 0.5));
          const o = ((k0) * 4 + min(3, floor((A - a0) * 4))) * 3;
          r += elut[o] * e;
          g += elut[o + 1] * e;
          bl += elut[o + 2] * e;
        }
        // major-third edges: a is a whole number
        d = abs(A - floor(A + 0.5)) * hh;
        if (d < 1.5) {
          const e = d < 0.5 ? 1 : 1.5 - d, b0 = floor(B), k0 = mod12(floor(A + 0.5) + 4 * b0);
          const o = ((12 + k0) * 4 + min(3, floor((B - b0) * 4))) * 3;
          r += elut[o] * e;
          g += elut[o + 1] * e;
          bl += elut[o + 2] * e;
        }
        // minor-third edges: a + b is a whole number
        d = abs(A + B - floor(A + B + 0.5)) * hh;
        if (d < 1.5) {
          const e = d < 0.5 ? 1 : 1.5 - d, b0 = floor(B), k0 = mod12(floor(A + B + 0.5) + 3 * b0);
          const o = ((24 + k0) * 4 + min(3, floor((B - b0) * 4))) * 3;
          r += elut[o] * e;
          g += elut[o + 1] * e;
          bl += elut[o + 2] * e;
        }
        if (r + g + bl > 0) {
          const p = (y * W + x) * 3;
          const rest = EDGE_REST * tide(S, A, B);
          buf[p] += r * rest;
          buf[p + 1] += g * rest;
          buf[p + 2] += bl * rest;
        }
      }
    }
  }

  // The lit triads: how bright each is, now.
  const lit = [];
  for (const e of S.hist) {
    const age = S.t - e.t;
    if (age >= S.life) continue;
    // A triad just left is handed over from the folding triangle to its own glow.
    const hand = age < S.glide ? sm(age / S.glide) : 1;
    const B = TRAIL_TOP * pow(1 - age / S.life, TRAIL_SHAPE) * hand;
    if (B > 0.004) lit.push({ T: e, B: B * e.lum });
  }

  // Heat of each lattice point: how lit the triads around it are.
  const heat = S.heat;
  heat.clear();
  const warm = (T, B) => {
    for (const q of corners(T)) {
      const key = nodeKey(q[0], q[1]);
      const h = heat.get(key);
      if (h === undefined || h < B) heat.set(key, B);
    }
  };
  for (const l of lit) warm(l.T, l.B);
  warm(S.cur, 1);

  // Beads on the lattice points in view.
  {
    const r = cl(0.155 * side, 1.7, 3.5);
    let amin = 1e9, amax = -1e9, bmin = 1e9, bmax = -1e9;
    for (const [qx, qy] of [[-6, -6], [W + 6, -6], [-6, H + 6], [W + 6, H + 6]]) {
      const A = S.ca + S.ia * (qx - OX) + S.ib * (qy - OY), B = S.cb + S.ja * (qx - OX) + S.jb * (qy - OY);
      amin = min(amin, A);
      amax = max(amax, A);
      bmin = min(bmin, B);
      bmax = max(bmax, B);
    }
    for (let b = floor(bmin); b <= ceil(bmax); b++)
      for (let a = floor(amin); a <= ceil(amax); a++) {
        const cx = px(S, a, b), cy = py(S, a, b);
        if (cx < -6 || cx > W + 6 || cy < -6 || cy > H + 6) continue;
        const key = nodeKey(a, b), ts = S.foot.get(key);
        const h = max(heat.get(key) || 0, ts === undefined ? 0 : FOOT * exp(-(S.t - ts) / FOOT_T));
        paintBead(S, cx, cy, r, col[mod12(a + 4 * b)], 0.13 * tide(S, a, b) + 0.55 * h, h);
      }
  }

  // The triads the walker has left, then the one it is on.
  const X = [0, 0, 0], Y = [0, 0, 0], LA = [0, 0, 0], LB = [0, 0, 0], cs = [null, null, null];
  for (const l of lit) {
    const v = corners(l.T);
    for (let i = 0; i < 3; i++) {
      LA[i] = v[i][0];
      LB[i] = v[i][1];
      X[i] = px(S, v[i][0], v[i][1]);
      Y[i] = py(S, v[i][0], v[i][1]);
      cs[i] = col[mod12(v[i][0] + 4 * v[i][1])];
    }
    paintTriangle(S, X, Y, LA, LB, cs, l.B);
  }
  {
    const T = S.cur, since = S.t - S.hopT, u = S.from ? cl(since / S.glide, 0, 1) : 1;
    const v = corners(T);
    for (let i = 0; i < 3; i++) {
      LA[i] = v[i][0];
      LB[i] = v[i][1];
      cs[i] = col[mod12(v[i][0] + 4 * v[i][1])];
    }
    if (u < 1) {
      // The corner the two triangles do not share slides across the edge.
      const vf = corners(S.from);
      const gone = vf.findIndex((p) => !v.some((q) => q[0] === p[0] && q[1] === p[1]));
      const came = v.findIndex((p) => !vf.some((q) => q[0] === p[0] && q[1] === p[1]));
      const e = sm(u);
      const mixed = { L: 0, a: 0, b: 0, C: 0 };
      const cFrom = col[mod12(vf[gone][0] + 4 * vf[gone][1])], cTo = col[mod12(v[came][0] + 4 * v[came][1])];
      mixColour(cFrom, cTo, e, mixed);
      for (let i = 0; i < 3; i++) {
        let a, b;
        if (i === gone) {
          a = vf[gone][0] + (v[came][0] - vf[gone][0]) * e;
          b = vf[gone][1] + (v[came][1] - vf[gone][1]) * e;
          cs[i] = mixed;
        } else {
          a = vf[i][0];
          b = vf[i][1];
          cs[i] = col[mod12(a + 4 * b)];
        }
        LA[i] = a;
        LB[i] = b;
        X[i] = px(S, a, b);
        Y[i] = py(S, a, b);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        X[i] = px(S, v[i][0], v[i][1]);
        Y[i] = py(S, v[i][0], v[i][1]);
      }
    }
    // It breathes a little while it waits, and flares as it lands.
    const land = S.hopT + S.glide, flare = S.t > land ? 0.3 * exp(-(S.t - land) / 0.25) : 0;
    const breath = 0.96 + 0.04 * sin(TAU * S.t * 0.53 + S.ph[0]);
    paintTriangle(S, X, Y, LA, LB, cs, (breath + flare) * S.lum);
  }

  // An edge flashes as the walker crosses it, then goes back to being a dim edge.
  for (const c of S.cross) {
    const amp = 0.9 * exp(-(S.t - c.t) / FLASH_LIFE);
    if (amp < 0.01) continue;
    paintEdge(S, px(S, c.a1, c.b1), py(S, c.a1, c.b1), px(S, c.a2, c.b2), py(S, c.a2, c.b2), col[mod12(c.a1 + 4 * c.b1)], col[mod12(c.a2 + 4 * c.b2)], amp);
  }

  // Tone: keep each LED's colour and let only its brightness give way near full.
  for (let p = 0; p < N; p++) {
    const b = p * 3;
    let r = buf[b], g = buf[b + 1], bl = buf[b + 2];
    const m = max(r, g, bl);
    if (m > 0.7) {
      const k = (0.7 + 0.3 * (1 - exp(-(m - 0.7) / 0.3))) / m;
      r *= k;
      g *= k;
      bl *= k;
    }
    display.setPixel(p % W, (p / W) | 0, GAMMA[(min(1, r) * 4095) | 0], GAMMA[(min(1, g) * 4095) | 0], GAMMA[(min(1, bl) * 4095) | 0]);
  }
}
