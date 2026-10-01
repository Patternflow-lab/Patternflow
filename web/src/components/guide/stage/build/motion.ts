import { clamp01 } from "./beats";

// How things move on the build stage. Every curve here takes how far through
// a move the timeline is (0…1, clamped — beats.ts span() relies on that) and
// says how far the part has got; nothing keeps state, so a step reached any
// way, forward or back, is the same picture.
//
// The names say what the part is doing, not the maths:
//
//   glide       leaves gently, arrives gently — a part carried through the air
//   reach       quick off the mark, a long slow arrival — a hand bringing
//               something up to where it must be lined up
//   windUp      leans back a little before it goes — a part picked up
//   past        a hair beyond its place and back — only where there is air
//               behind the place (a turn in a holder, a part held in the hand)
//   press       in until it meets the fit, a breath, then pushed home with a
//               click — never past the end: there is a part behind it
//   land        height above the mat for a part let go just over it: down,
//               one small rebound, a smaller one, still
//   setDown     height for a heavy part lowered onto the mat: no bounce
//   latch       a cover swinging shut: onto the catch, a breath, pressed home
//
// The amounts are sized in millimetres on the part, not as a share of the
// travel: a rebound is a couple of millimetres whether the part fell thirty
// or three hundred.

/** Cubic ease in and out. */
export const glide = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

/** Quintic ease out: quick away, a long arrival. */
export const reach = (x: number) => 1 - Math.pow(1 - clamp01(x), 5);

/** Cubic ease out. */
export const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** Cubic ease in: slow away, quick at the end (something let go). */
export const fall = (x: number) => {
  const c = clamp01(x);
  return c * c * c;
};

/**
 * Leans back by `back` (a share of the travel) before it goes, then glides.
 * Ends exactly on 1.
 */
export function windUp(x: number, back = 0.045) {
  const c = clamp01(x);
  const go = glide((c - 0.12) / 0.88);
  // The lean is over by a quarter of the way, and is gone once the part is travelling.
  const lean = Math.sin(Math.PI * clamp01(c / 0.26));
  return go - back * lean * (1 - go);
}

/**
 * A hair past its place and back (`over` of the travel, at about four fifths
 * of the way). For a turn, or a part held in the air: never for one that
 * seats against another.
 */
export function past(x: number, over = 0.03) {
  const c = clamp01(x);
  // Glides to its place by 0.78; the excursion is one soft lobe after it.
  const go = glide(c / 0.78);
  const s = clamp01((c - 0.6) / 0.4);
  return go + over * Math.sin(Math.PI * s) * (1 - s) * 1.72;
}

/** Leans back, goes, arrives a hair past and settles: a board turned over in its holder. */
export function swing(x: number, back = 0.03, over = 0.025) {
  const c = clamp01(x);
  const go = glide((c - 0.1) / 0.72);
  const lean = Math.sin(Math.PI * clamp01(c / 0.24));
  const s = clamp01((c - 0.62) / 0.38);
  return go - back * lean * (1 - go) + over * Math.sin(Math.PI * s) * (1 - s) * 1.72;
}

/**
 * Pushed in against a fit: `meet` of the way freely, a breath there, then the
 * rest in one short push that stops dead (the click). Never past 1.
 */
export function press(x: number, meet = 0.8) {
  const c = clamp01(x);
  if (c < 0.56) return meet * reach(c / 0.56) * 0.985;
  // The breath: it creeps, it does not stop — a part held against a fit is never quite still.
  if (c < 0.72) return meet * (0.985 + 0.015 * ((c - 0.56) / 0.16));
  // Home: it gives, faster and faster, and stops dead on its seat.
  const u = clamp01((c - 0.72) / 0.2);
  return meet + (1 - meet) * u * u;
}

/**
 * Height above the mat, as a share of the drop, for a part let go: down under
 * its own weight, a rebound of `bounce` (a share of the drop) and a second a
 * quarter of that, then still. 1 → 0, never below.
 */
export function land(x: number, bounce = 0.08) {
  const c = clamp01(x);
  const hit = 0.56;
  if (c < hit) {
    const u = c / hit;
    return 1 - u * u;
  }
  // Never a hair under the mat, not even by a rounding error.
  const hop = (u: number) => Math.max(0, 4 * u * (1 - u));
  if (c < 0.84) return bounce * hop((c - hit) / (0.84 - hit));
  return bounce * 0.24 * hop((c - 0.84) / 0.16);
}

/** Height for a heavy part lowered onto the mat: let down, slower and slower, no rebound. 1 → 0. */
export const setDown = (x: number) => 1 - reach(x);

/**
 * How far over a part still leans as it lands (1 → 0, with a rock the other
 * way and back after it touches): multiply a small angle by it.
 */
export function rock(x: number) {
  const c = clamp01(x);
  const hit = 0.56;
  if (c < hit) return 1 - glide(c / hit);
  const s = (c - hit) / (1 - hit);
  return -0.32 * Math.sin(Math.PI * 2 * s) * (1 - s) * (1 - s);
}

/** How big a part is as it arrives: from nothing, full size before it touches. */
export const grow = (x: number) => ease(clamp01(x) / 0.5);

/**
 * A cover swinging shut on a hinge, as the angle still open (1 → 0): it
 * swings to, comes to rest on its catch (`catchAt` still open), and is
 * pressed home. Never below 0: there is a case behind it.
 */
export function latch(x: number, catchAt = 0.035) {
  const c = clamp01(x);
  if (c < 0.66) {
    const u = c / 0.66;
    // Falls shut faster and faster, then the catch takes it.
    return catchAt + (1 - catchAt) * (1 - glide(u));
  }
  if (c < 0.8) return catchAt;
  return catchAt * (1 - reach((c - 0.8) / 0.14));
}

/** A damped swing about rest, for something hanging that was just let go or brought to a stop: `s` is time since, in swings. 0 before. */
export function sway(s: number, swings = 2.5, decay = 3) {
  if (s <= 0) return 0;
  return Math.sin(Math.PI * 2 * s * swings) * Math.exp(-decay * s * swings);
}

/** A shake of the head — three quick turns, dying away — over 0…1; 0 outside. */
export function shake(x: number) {
  if (x <= 0 || x >= 1) return 0;
  return Math.sin(Math.PI * 6 * x) * (1 - x);
}

/** A small fixed scatter for index `i` (−1…1): the same every time, so the build is the same build. */
export function scatter(i: number, salt = 0) {
  const s = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
