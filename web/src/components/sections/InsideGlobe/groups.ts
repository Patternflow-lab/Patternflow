import type { Build } from './builds';
import { latLngToVec3 } from './builds';

// Which pins are too close together to be told apart, and how a set of them
// opens up. Pure maths over the entries - no three.js, no DOM - so the rules
// can be tested without a globe.
//
// Why this exists: a build whose city is not known sits on its country's
// centre (see `location` in builds.ts), so two builds in one country can have
// the very same coordinates, and no amount of zooming separates them. The
// answer is not to nudge a coordinate - that would claim a place nobody gave
// us - but to draw the set as one pin that says how many it holds, and to fan
// it out on demand.

type LatLng = { lat: number; lng: number };

const TO_RAD = Math.PI / 180;

// Angular distance between two lat/lng points, in radians (haversine).
export function angularDistance(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * TO_RAD;
  const lat2 = b.lat * TO_RAD;
  const dLat = (b.lat - a.lat) * TO_RAD;
  const dLng = (b.lng - a.lng) * TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// A pin is about 3.2 degrees across on the globe (PIN_RADIUS in Globe.tsx), so
// two builds nearer than this overlap by more than a sliver and read as one
// blob. Angular, not on-screen: the pins are world-sized, so what overlaps at
// rest overlaps just the same after the dolly-in.
export const GROUP_ANGLE_DEG = 3;

export type BuildGroup = {
  // Stable for a given membership, so React keeps a group's pin mounted while
  // unrelated entries come and go.
  id: string;
  // West to east, which is the order the fan lays them out in, left to right.
  // Builds on the very same spot keep the order they were given in.
  members: Build[];
  // The mean direction of the members: where the group's one pin is drawn.
  // No member is moved - each keeps its own `location`.
  center: LatLng;
};

function meanDirection(members: Build[]): LatLng {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const { location } of members) {
    const v = latLngToVec3(location.lat, location.lng, 1);
    x += v[0];
    y += v[1];
    z += v[2];
  }
  const length = Math.hypot(x, y, z) || 1;
  // The inverse of latLngToVec3.
  const lat = 90 - Math.acos(Math.min(1, Math.max(-1, y / length))) / TO_RAD;
  const lng = wrapDegrees(Math.atan2(z, -x) / TO_RAD - 180);
  return { lat, lng };
}

// Into (-180, 180].
function wrapDegrees(deg: number): number {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

// Every entry lands in exactly one group; an entry with no close neighbour is
// a group of one. Complete linkage: two sets merge only while EVERY pair
// across them is within the limit, closest sets first. Single linkage would
// let a chain of builds each a little further along the coast swallow a whole
// country into one pin; this keeps a group no wider than one pin's reach.
export function groupBuilds(entries: Build[], maxAngleDeg = GROUP_ANGLE_DEG): BuildGroup[] {
  const limit = maxAngleDeg * TO_RAD + 1e-9;
  const dist: number[][] = entries.map((a) =>
    entries.map((b) => angularDistance(a.location, b.location)),
  );

  // Clusters as lists of indices into `entries`, kept in first-member order.
  const clusters: number[][] = entries.map((_, index) => [index]);
  for (;;) {
    let best: { a: number; b: number; link: number } | null = null;
    for (let a = 0; a < clusters.length; a += 1) {
      for (let b = a + 1; b < clusters.length; b += 1) {
        let link = 0;
        for (const i of clusters[a]) {
          for (const j of clusters[b]) link = Math.max(link, dist[i][j]);
        }
        if (link <= limit && (!best || link < best.link)) best = { a, b, link };
      }
    }
    if (!best) break;
    clusters[best.a] = [...clusters[best.a], ...clusters[best.b]].sort((p, q) => p - q);
    clusters.splice(best.b, 1);
  }

  return clusters.map((indices) => {
    const inOrder = indices.map((index) => entries[index]);
    const center = meanDirection(inOrder);
    const members = inOrder
      .map((build, order) => ({ build, order, east: wrapDegrees(build.location.lng - center.lng) }))
      .sort((p, q) => p.east - q.east || p.order - q.order)
      .map(({ build }) => build);
    return {
      // Sorted, so the id does not depend on the order the entries came in.
      id: inOrder.map((build) => build.id).sort().join('+'),
      members,
      center,
    };
  });
}

// --- The fan ---------------------------------------------------------------
//
// An open group is a hand fan standing on the shared point: its builds on an
// arc above it, west to east. Upwards and never a full circle, because the
// selected build's name is printed just below the pin (GlobeViewer), and on a
// phone a finger covers whatever is under the tap.

const FAN_STEP_MAX = 56 * TO_RAD;     // between neighbours, when there is room
const FAN_SPREAD_MAX = 160 * TO_RAD;  // the whole arc never dips below level
// Neighbouring pins sit at least this far apart, centre to centre: far enough
// that their hit areas do not swallow each other under a fingertip.
const FAN_MIN_CHORD_PX = 30;
// ...and never closer than this many pin radii, so they stay apart once the
// dolly-in has made the pins themselves bigger.
const FAN_MIN_CHORD_PINS = 2.9;

function fanStep(count: number): number {
  return count < 2 ? 0 : Math.min(FAN_STEP_MAX, FAN_SPREAD_MAX / (count - 1));
}

// The direction of one member from the shared point, as an angle on screen
// (radians, anticlockwise from "right"), first member leftmost. `lean` tips
// the whole fan over to the right (see fanLean).
export function fanAngle(count: number, index: number, lean = 0): number {
  return Math.PI / 2 - lean + ((count - 1) / 2 - index) * fanStep(count);
}

export function fanAngles(count: number, lean = 0): number[] {
  return Array.from({ length: count }, (_, index) => fanAngle(count, index, lean));
}

// Centre-to-centre distance between neighbouring pins of the fan, in pixels.
export function fanChordPx(pinRadiusPx: number): number {
  return Math.max(FAN_MIN_CHORD_PX, FAN_MIN_CHORD_PINS * pinRadiusPx);
}

// How far from the shared point the pins sit, in pixels. Sized on screen and
// not as an angle on the globe: an angle that separates the pins after the
// dolly-in would collapse them into each other when the globe is far away.
export function fanRadiusPx(count: number, pinRadiusPx: number): number {
  const step = fanStep(count);
  if (step === 0) return 0;
  return fanChordPx(pinRadiusPx) / (2 * Math.sin(step / 2));
}

// Something else on the map the fan should not land on: its centre in pixels
// from the shared point (x right, y up) and its radius.
export type FanObstacle = { x: number; y: number; r: number };

const FAN_LEAN_STEPS = 6;             // candidates each side of upright
const FAN_LEVEL = 88 * TO_RAD;        // no pin of a leaning fan dips below this
const FAN_CLEARANCE_PX = 3;
// A pin of the fan may be the selected one, drawn this much bigger.
const FAN_PIN_REACH = 1.45;
// How much better (px² of overlap) tipping further must be before the fan
// does it: without this it would rock between two near-equal leans as the
// globe turns under it.
const FAN_LEAN_STICK = 9;

function fanOverlap(
  count: number, radiusPx: number, pinRadiusPx: number, lean: number, obstacles: FanObstacle[],
): number {
  let cost = 0;
  for (let index = 0; index < count; index += 1) {
    const angle = fanAngle(count, index, lean);
    const x = Math.cos(angle) * radiusPx;
    const y = Math.sin(angle) * radiusPx;
    for (const obstacle of obstacles) {
      const need = pinRadiusPx * FAN_PIN_REACH + obstacle.r + FAN_CLEARANCE_PX;
      const short = need - Math.hypot(x - obstacle.x, y - obstacle.y);
      if (short > 0) cost += short * short;
    }
  }
  return cost;
}

// How far to tip the fan over (radians, positive to the right) so its pins do
// not land on a neighbouring pin. The UK and France are the case in point:
// France's fan, standing straight up, would put a pin exactly on the UK.
// Upright unless something is in the way; never so far that a pin dips below
// level; and slow to tip further than `current`, the lean it already has.
export function fanLean(
  count: number,
  radiusPx: number,
  pinRadiusPx: number,
  obstacles: FanObstacle[],
  current = 0,
): number {
  const limit = Math.max(0, FAN_LEVEL - ((count - 1) / 2) * fanStep(count));
  if (limit === 0 || obstacles.length === 0) return 0;

  let best = 0;
  let bestCost = fanOverlap(count, radiusPx, pinRadiusPx, 0, obstacles);
  // Outwards from upright, right before left, so the least lean that clears
  // the neighbours wins and the answer never depends on float noise.
  for (let step = 1; step <= FAN_LEAN_STEPS && bestCost > 0; step += 1) {
    for (const side of [1, -1]) {
      const lean = (side * step * limit) / FAN_LEAN_STEPS;
      const cost = fanOverlap(count, radiusPx, pinRadiusPx, lean, obstacles);
      if (cost < bestCost - 1e-9) {
        best = lean;
        bestCost = cost;
      }
    }
  }
  // Sticky only towards upright: a fan stays less tipped than it might be
  // while the overlap that costs is slight, and comes back up the moment the
  // way is clear - it never keeps a lean it no longer needs.
  if (current !== best && Math.abs(current) < Math.abs(best)) {
    const currentCost = fanOverlap(count, radiusPx, pinRadiusPx, current, obstacles);
    if (currentCost <= bestCost + FAN_LEAN_STICK) return current;
  }
  return best;
}
