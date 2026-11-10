import { describe, expect, it } from 'vitest';
import {
  DOT_ENDS,
  FAN_PIN_S,
  FAN_STAGGER_S,
  PIN_IN_S,
  PULL_FAR,
  PULL_NEAR,
  TURN_TIME_FAR,
  TURN_TIME_NEAR,
  backOut,
  damp,
  dotSize,
  fanProgress,
  fanSeconds,
  headingGap,
  pinArrival,
  pullBack,
  settled,
  spring,
  turnTime,
  waveDelay,
} from './motion';

// Runs a damped value from 0 to `target` for `seconds` at `fps`, and returns
// where it was after each frame.
function travel(target: number, time: number, seconds: number, fps: number) {
  const state = { value: 0, speed: 0 };
  const path: number[] = [];
  for (let frame = 0; frame < Math.round(seconds * fps); frame += 1) path.push(damp(state, target, time, 1 / fps));
  return path;
}

describe('the turn to a picked build', () => {
  it('starts from rest: the first 150 ms covers a small part of the way, where it used to cover half', () => {
    const path = travel(1, 0.4, 2, 60);
    const at150 = path[8];
    expect(at150).toBeGreaterThan(0.05);
    expect(at150).toBeLessThan(0.25);
  });

  it('gathers speed, then loses it, and never goes past the place', () => {
    const path = travel(1, 0.4, 3, 60);
    const steps = path.map((value, index) => value - (path[index - 1] ?? 0));
    const fastest = steps.indexOf(Math.max(...steps));
    expect(fastest).toBeGreaterThan(3);
    expect(fastest).toBeLessThan(path.length / 2);
    expect(Math.max(...path)).toBeLessThanOrEqual(1);
    expect(path[path.length - 1]).toBeGreaterThan(0.999);
  });

  it('is the same turn at 20 frames a second as at 120', () => {
    const slow = travel(1, 0.4, 1, 20);
    const fast = travel(1, 0.4, 1, 120);
    // Half a second in, and at the end.
    expect(slow[9]).toBeCloseTo(fast[59], 1);
    expect(slow[19]).toBeCloseTo(fast[119], 2);
  });

  it('keeps its speed when another build is picked in mid-turn', () => {
    const state = { value: 0, speed: 0 };
    for (let frame = 0; frame < 15; frame += 1) damp(state, 1, 0.4, 1 / 60);
    const speed = state.speed;
    expect(speed).toBeGreaterThan(0);
    const before = state.value;
    damp(state, 2, 0.4, 1 / 60);
    // One frame on it has moved about as far as it was moving a frame, not jumped and not stopped.
    expect(state.value - before).toBeCloseTo(speed / 60, 1);
  });

  it('measures how far round the globe a heading is from another', () => {
    const here = { yaw: 0.3, pitch: 0.2 };
    expect(headingGap(here, here)).toBeCloseTo(0, 6);
    expect(headingGap({ yaw: 0, pitch: 0 }, { yaw: Math.PI, pitch: 0 })).toBeCloseTo(Math.PI, 6);
    expect(headingGap({ yaw: 0, pitch: 0 }, { yaw: 0, pitch: 0.5 })).toBeCloseTo(0.5, 6);
    // The long way round in yaw is still the short way on the globe.
    expect(headingGap({ yaw: -3, pitch: 0 }, { yaw: 3, pitch: 0 })).toBeCloseTo(2 * Math.PI - 6, 6);
  });

  it('gives a hop across the world longer than a hop next door', () => {
    expect(turnTime(0.05)).toBeCloseTo(TURN_TIME_NEAR, 3);
    expect(turnTime(Math.PI)).toBeCloseTo(TURN_TIME_FAR, 3);
    expect(turnTime(1.2)).toBeGreaterThan(turnTime(0.6));
  });

  it('holds the camera back while the place is far round, and brings it all the way in at the end', () => {
    expect(pullBack(0)).toBe(0);
    expect(pullBack(PULL_NEAR)).toBe(0);
    expect(pullBack(PULL_FAR)).toBe(1);
    expect(pullBack(Math.PI)).toBe(1);
    expect(pullBack(0.6)).toBeGreaterThan(pullBack(0.4));
  });
});

describe('a pin taking a size', () => {
  const grow = (fps: number) => {
    const state = { value: 1, speed: 0 };
    const path: number[] = [];
    for (let frame = 0; frame < fps; frame += 1) path.push(spring(state, 1.45, 1 / fps));
    return { path, state };
  };

  it('goes about a tenth of the step past, and comes to rest on it', () => {
    const { path, state } = grow(60);
    const past = (Math.max(...path) - 1.45) / 0.45;
    expect(past).toBeGreaterThan(0.04);
    expect(past).toBeLessThan(0.16);
    expect(settled(state, 1.45)).toBe(true);
  });

  it('holds together at ten frames a second', () => {
    const { path, state } = grow(10);
    expect(Math.max(...path)).toBeLessThan(1.6);
    expect(settled(state, 1.45)).toBe(true);
  });

  it('arrives on the map from nothing, a little over full size and back', () => {
    expect(pinArrival(0)).toBeCloseTo(0, 6);
    expect(pinArrival(PIN_IN_S)).toBeCloseTo(1, 6);
    const sizes = Array.from({ length: 50 }, (_, index) => pinArrival((index / 49) * PIN_IN_S));
    expect(Math.max(...sizes)).toBeGreaterThan(1.04);
    expect(Math.max(...sizes)).toBeLessThan(1.2);
  });

  it('shows the pins outwards from the first build', () => {
    expect(waveDelay(0)).toBeLessThan(waveDelay(1));
    expect(waveDelay(1)).toBeLessThan(waveDelay(Math.PI));
  });
});

describe('the fan of a group', () => {
  it('is shut at 0 and open at 1, every pin on its slot', () => {
    for (const count of [2, 3, 5]) {
      for (let index = 0; index < count; index += 1) {
        expect(fanProgress(0, index, count)).toBeCloseTo(0, 6);
        expect(fanProgress(1, index, count)).toBeCloseTo(1, 6);
      }
    }
  });

  it('deals the pins out one after another', () => {
    const count = 3;
    // A moment after the first has left, the second has not.
    const early = (FAN_STAGGER_S * 0.8) / fanSeconds(count);
    expect(fanProgress(early, 0, count)).toBeGreaterThan(0);
    expect(fanProgress(early, 1, count)).toBe(0);
    // Half way through, each pin is behind the one before it.
    expect(fanProgress(0.5, 0, count)).toBeGreaterThan(fanProgress(0.5, 1, count));
    expect(fanProgress(0.5, 1, count)).toBeGreaterThan(fanProgress(0.5, 2, count));
  });

  it('takes one pin its own time, and each extra pin a little longer', () => {
    expect(fanSeconds(1)).toBeCloseTo(FAN_PIN_S, 6);
    expect(fanSeconds(4)).toBeCloseTo(FAN_PIN_S + 3 * FAN_STAGGER_S, 6);
  });

  it('carries a pin a hair past its slot, never far', () => {
    const reach = Array.from({ length: 200 }, (_, index) => fanProgress(index / 199, 0, 3));
    expect(Math.max(...reach)).toBeGreaterThan(1.01);
    expect(Math.max(...reach)).toBeLessThan(1.12);
    expect(backOut(0)).toBeCloseTo(0, 6);
    expect(backOut(1)).toBeCloseTo(1, 6);
  });
});

describe('a dot on a link', () => {
  it('comes out of one pin and goes into the other', () => {
    expect(dotSize(0)).toBe(0);
    expect(dotSize(1)).toBe(0);
    expect(dotSize(DOT_ENDS)).toBe(1);
    expect(dotSize(0.5)).toBe(1);
    expect(dotSize(DOT_ENDS / 2)).toBeGreaterThan(0);
    expect(dotSize(DOT_ENDS / 2)).toBeLessThan(1);
  });
});
