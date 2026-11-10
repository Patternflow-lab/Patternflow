// How the build map moves. Pure numbers, no three.js: Globe.tsx calls these
// from its frame loop, and motion.test.ts holds each one to what it says.

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const smoothstep = (value: number, from: number, to: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

// --- Travel -----------------------------------------------------------------
//
// The globe used to cover a share of what was left on every frame. That is
// fastest in its first frame: half the way to a build on the other side of
// the world was gone in 150 ms, at full zoom, and the map read as cut to the
// place and not as turned to it. `damp` starts from rest, gathers speed and
// arrives gently, and keeps its speed when the target changes under it, so a
// second pick made in mid-flight bends the turn and does not restart it.

export type Damped = { value: number; speed: number };

/**
 * Moves `state` towards `target` as a critically damped spring would:
 * `time` is roughly how long it takes to cover two thirds of the way.
 * The same curve at any frame rate.
 */
export function damp(state: Damped, target: number, time: number, delta: number): number {
  const omega = 2 / Math.max(1e-4, time);
  const x = omega * delta;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = state.value - target;
  const push = (state.speed + omega * change) * delta;
  state.speed = (state.speed - omega * push) * decay;
  state.value = target + (change + push) * decay;
  return state.value;
}

/** The angle between where two headings point the globe, radians (0…π). */
export function headingGap(
  a: { yaw: number; pitch: number },
  b: { yaw: number; pitch: number },
): number {
  const cos =
    Math.sin(a.pitch) * Math.sin(b.pitch) +
    Math.cos(a.pitch) * Math.cos(b.pitch) * Math.cos(a.yaw - b.yaw);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

// A hop to the next pin along is a nudge; a hop across an ocean takes longer,
// so the turn never has to be a blur to get there.
export const TURN_TIME_NEAR = 0.26;   // seconds, see `damp`
export const TURN_TIME_FAR = 0.5;

/** How long a turn of `gap` radians is given. */
export const turnTime = (gap: number) =>
  TURN_TIME_NEAR + (TURN_TIME_FAR - TURN_TIME_NEAR) * smoothstep(gap, 0.2, 2.4);

// While a picked build is still far round the globe the camera stays back, or
// pulls back, to where the whole globe shows, and closes in as the place
// comes round: you see where on Earth you are being taken before you are
// there. Within PULL_NEAR of the place the camera is all the way in.
export const PULL_NEAR = 0.16;        // radians left to turn
export const PULL_FAR = 1.1;

/** 0 with the place in front of the camera … 1 with the camera all the way back. */
export const pullBack = (gapLeft: number) => smoothstep(gapLeft, PULL_NEAR, PULL_FAR);

// --- Pins -------------------------------------------------------------------

export type Sprung = { value: number; speed: number };

// A pin grows under the pointer, and again when picked, with a little more
// than it needs and back: one tenth of the step past, gone in a quarter of a
// second. (16 a second of plain easing got there, and looked like a fade.)
export const PIN_STIFFNESS = 520;
export const PIN_DAMPING = 27;

/** One step of a spring that overshoots a little. Stable at any frame rate. */
export function spring(
  state: Sprung,
  target: number,
  delta: number,
  stiffness = PIN_STIFFNESS,
  damping = PIN_DAMPING,
): number {
  // In slices of 1/240 s at most: taken in one stride at 20 fps this would fly apart.
  let left = Math.min(delta, 0.1);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 240);
    state.speed += (stiffness * (target - state.value) - damping * state.speed) * h;
    state.value += state.speed * h;
    left -= h;
  }
  return state.value;
}

/** Has the spring come to rest on `target`? */
export const settled = (state: Sprung, target: number) =>
  Math.abs(target - state.value) < 0.002 && Math.abs(state.speed) < 0.02;

/** 0 → 1, arriving a little past and back (`over` sets how far past). */
export function backOut(x: number, over = 1.25): number {
  const c = clamp01(x) - 1;
  return 1 + (over + 1) * c * c * c + over * c * c;
}

// --- The fan of a group -------------------------------------------------------
//
// The pins of a group used to leave the shared point as one. Now each leaves
// a moment after the one before it and arrives a hair past its place, so the
// fan is dealt out from the left and gathered back in from the right.

export const FAN_PIN_S = 0.28;        // one pin's way out, seconds
export const FAN_STAGGER_S = 0.05;    // between one pin leaving and the next
export const FAN_CLOSE = 1.5;         // shutting runs this much faster than opening

/** How long the whole fan of `count` pins takes to open, seconds. */
export const fanSeconds = (count: number) => FAN_PIN_S + FAN_STAGGER_S * Math.max(0, count - 1);

/**
 * How far out pin `index` of `count` is with the fan's clock at `clock`
 * (0 shut … 1 open). 0 at its true place, 1 on its slot, a little over 1 on
 * the way in: the clock is plain time, and the shape is all here, so a fan
 * that turns back half open retraces the way it came.
 */
export function fanProgress(clock: number, index: number, count: number): number {
  const t = clamp01(clock) * fanSeconds(count) - index * FAN_STAGGER_S;
  return backOut(t / FAN_PIN_S, 1.1);
}

// --- Arriving ---------------------------------------------------------------
//
// The first time the map is shown it is drawn in the order it happened: the
// pin in Seoul, then the others outwards from it, each link drawn from the
// end that is already there. Shown again in the same visit, it comes up
// quickly and all at once.

export const WAVE_S = 1.15;           // Seoul to the far side of the world
export const WAVE_AGAIN_S = 0.3;
export const PIN_IN_S = 0.34;         // one pin's arrival
export const LINK_DRAW_S = 0.7;       // one link, end to end
export const LINK_DRAW_AGAIN_S = 0.4;
/** A link leaves this long after the pin it leaves from has started to show. */
export const LINK_AFTER_PIN_S = 0.12;

/** When the pin `gap` radians from the first build starts to show, seconds after the map does. */
export const waveDelay = (gap: number, wave = WAVE_S) => 0.12 + (gap / Math.PI) * wave;

/** A pin's size as it arrives: nothing, then up past full size and back. */
export const pinArrival = (seconds: number) => backOut(seconds / PIN_IN_S, 1.6);

// The dots on the links come out of the pin at one end and go into the pin
// at the other. They used to be put down at full size on the pin and lifted
// off it the same way.
export const DOT_ENDS = 0.07;         // share of the link over which a dot grows or shrinks

/** A dot's size (0…1) at `t` (0…1) of the way along its link. */
export const dotSize = (t: number) => smoothstep(t, 0, DOT_ENDS) * smoothstep(1 - t, 0, DOT_ENDS);
