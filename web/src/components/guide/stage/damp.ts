// A critically damped spring, for anything on the stage that follows a
// target: the camera (GuideCanvas), the device coming apart (Explode). It
// never overshoots, and it starts and stops without a corner whatever the
// target does meanwhile — the target can move while it is on its way.

export type Damp = { v: number };

/**
 * One step of `current` toward `target`. `vel` carries the velocity between
 * frames; `smoothTime` is roughly how long most of the way takes, seconds.
 */
export function smoothDamp(current: number, target: number, vel: Damp, smoothTime: number, dt: number) {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}
