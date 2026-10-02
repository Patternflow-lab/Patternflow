import * as THREE from "three";
import { hand } from "../hand";
import { forgetPillSize, placeTag } from "../tags";
import { cardTouch, partLabel, touchFromStage, touchSpot, type TouchKey } from "./touchState";

// The Build guide's parts under the hand.
//
// A mouse over a part on the bench or the board lifts it a hair — along the
// way it comes out of its seat: up off the mat, out of its holes — and names
// it, as the parts list does (reference and part, in the page's language),
// and lights its line in the list; a line of the list pointed at does the
// same from the other side, and the hand's light goes to the part
// (touchState.ts is what the card and the stage share).
//
// It is laid over the build, not part of it. BuildStage puts every part where
// the timeline has it each frame and then calls `frame` here, which adds the
// hair to what it finds and remembers what it wrote — so there is nothing to
// undo: the next frame starts from the build's own place again. A part the
// build is carrying is the build's: one that has moved since the last frame
// is not lifted, not named and not found under the pointer, and neither is
// one that is not on stage, not yet full size, or behind the case.
//
// What is under the pointer is looked for once a pointer move, and no more
// than every 60 ms: the line through the pointer against each part's box in
// its own frame — a dozen boxes — and only when one is hit, against the
// meshes that could be standing in front of it (the case, the board).
// Nothing is looked for under a finger, and nothing lifts for a reader who
// asked for less motion (the name still comes).

/** How far a part lifts, as it looks on screen, px — and the least and most of it, in its own units of length (10 mm). */
const HAIR_PX = 8;
const HAIR_MIN = 0.1;
const HAIR_MAX = 0.9;
/** A part must have lain still this long before it answers, s (a part dropped on the mat rocks a moment). */
const STILL_S = 0.25;
/** The pointer is looked under at most this often, ms. */
const PICK_MS = 60;
/** …and a part that is held is looked at again this often, ms. */
const HELD_MS = 250;
/** Moved this far since the last frame (squared, its own units): it is being carried. */
const MOVED_SQ = 1e-8;

export type TouchPart = {
  /** Its line's key in the BOM (build/bom.ts bomKey). */
  key: TouchKey;
  object: THREE.Object3D;
  /** What its box is measured from, if not all of `object` (the DevKit's group also holds its cable). */
  body?: THREE.Object3D;
  /** Its box in its own frame, if it cannot be measured (the screws are instances). */
  box?: THREE.Box3;
  /** The way it lifts, in the frame it is placed in: up off the mat by default. */
  axis?: (out: THREE.Vector3) => THREE.Vector3;
  /** Its scale when it is whole (a part still arriving is smaller). */
  full?: number;
  /** The stage never writes its place (an InstancedMesh, moved by its instances): this does, outright — and these with it. */
  owned?: THREE.Object3D[];
};

type Item = TouchPart & {
  box: THREE.Box3;
  centre: THREE.Vector3;
  radius: number;
  base: THREE.Vector3;
  written: THREE.Vector3;
  seen: boolean;
  still: number;
  lift: number;
};

export type TouchFrame = {
  camera: THREE.Camera;
  size: { width: number; height: number };
  dt: number;
  /** The guide is on screen and the build is showing its own parts. */
  on: boolean;
  /** No lift: the reader asked for less motion. */
  reduced: boolean;
  /** The parts list is on this step: what it points at counts (a line left focused does not follow the reader down the page). */
  card: boolean;
  /** This line's part is out in the open at this point of the build. */
  live: (key: string) => boolean;
  /** The build is naming this part itself just now (its own tag is up): no second name. */
  named: (key: string) => boolean;
  /** What may stand in front of a part: meshes, each with the key of the part it belongs to, if any. */
  occluders: { mesh: THREE.Object3D; key?: string }[];
  /** How far in front of the part the hand's light is held, world units. */
  hold: number;
};

/** A subtree's box in `frame`'s own coordinates. */
function boxIn(frame: THREE.Object3D, root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  const rel = new THREE.Matrix4();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    rel.identity();
    for (let n: THREE.Object3D | null = m; n && n !== frame; n = n.parent) {
      n.updateMatrix();
      rel.premultiply(n.matrix);
    }
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(rel));
  });
  return box;
}

function shown(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

const UP = new THREE.Vector3(0, 1, 0);

export function makeTouch() {
  let items: Item[] = [];
  let hovered: Item | null = null;
  let pill: HTMLDivElement | null = null;
  let wrap: HTMLDivElement | null = null;
  let shownLabel = "";
  const picked = { moves: -1, at: 0 };
  const ray = new THREE.Ray();
  const local = new THREE.Ray();
  const caster = new THREE.Raycaster();
  const inv = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const hits: THREE.Intersection[] = [];
  /** The parts being named this frame. */
  const naming: Item[] = [];

  const ready = (it: Item, f: TouchFrame) =>
    f.on && it.still >= STILL_S && f.live(it.key) && shown(it.object) && it.object.scale.x >= (it.full ?? 1) * 0.98;

  /** The part under the pointer, if there is one and nothing stands in front of it. */
  function pick(f: TouchFrame): Item | null {
    if (!hand.here || !hand.onStage) return null;
    v.set(hand.x, -hand.y, 0.5).unproject(f.camera);
    ray.origin.copy(f.camera.position);
    ray.direction.copy(v).sub(ray.origin).normalize();
    let best: Item | null = null;
    let near = Infinity;
    for (const it of items) {
      if (!ready(it, f)) continue;
      inv.copy(it.object.matrixWorld).invert();
      local.copy(ray).applyMatrix4(inv);
      if (!local.intersectBox(it.box, v)) continue;
      const d = v.applyMatrix4(it.object.matrixWorld).distanceTo(ray.origin);
      if (d < near) {
        near = d;
        best = it;
      }
    }
    if (!best) return null;
    caster.ray.copy(ray);
    caster.near = 0;
    caster.far = near - 0.01;
    for (const o of f.occluders) {
      if (o.key === best.key || !shown(o.mesh)) continue;
      const mat = (o.mesh as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && mat.transparent && mat.opacity < 0.5) continue;
      hits.length = 0;
      caster.intersectObject(o.mesh, false, hits);
      if (hits.length) return null;
    }
    return best;
  }

  return {
    /** The pill that names a part, in the stage's own layer of tags. */
    mount(host: HTMLElement) {
      wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;left:0;top:0;will-change:transform;pointer-events:none;z-index:21";
      pill = document.createElement("div");
      pill.className = "guide-knob-tag";
      pill.dataset.on = "0";
      pill.style.transform = "translate(-50%, -50%)";
      wrap.appendChild(pill);
      host.appendChild(wrap);
      shownLabel = "";
    },
    unmount() {
      wrap?.remove();
      wrap = pill = null;
    },
    /** The parts that can be touched (BuildStage, once it has the device's objects). */
    set(parts: TouchPart[]) {
      items = parts.map((p) => {
        const box = p.box ?? boxIn(p.object, p.body ?? p.object);
        return {
          ...p,
          box,
          centre: box.getCenter(new THREE.Vector3()),
          radius: box.getSize(new THREE.Vector3()).length() / 2,
          base: new THREE.Vector3(),
          written: new THREE.Vector3(),
          seen: false,
          still: 0,
          lift: 0,
        };
      });
      hovered = null;
    },
    /** Everything as the build has it: nothing lifted, nothing named. */
    release() {
      for (const it of items) {
        if (it.owned) {
          it.object.position.set(0, 0, 0);
          for (const w of it.owned) w.position.set(0, 0, 0);
        } else if (it.seen && it.object.position.equals(it.written)) it.object.position.copy(it.base);
        it.written.copy(it.object.position);
        it.lift = 0;
        it.seen = false;
      }
      hovered = null;
      touchFromStage(null);
      touchSpot.on = false;
      if (pill) pill.dataset.on = "0";
    },
    /** After the build has placed its parts for this frame. */
    frame(f: TouchFrame) {
      if (!items.length) return;
      // Where the build has each part, and whether it has moved it.
      for (const it of items) {
        const p = it.object.position;
        if (it.owned) {
          it.still += f.dt;
          continue;
        }
        // Not placed again this frame, it is still where this put it: back to the build's own place first.
        if (it.seen && p.equals(it.written)) p.copy(it.base);
        const moved = it.seen ? p.distanceToSquared(it.base) : Infinity;
        it.base.copy(p);
        it.seen = true;
        it.still = moved > MOVED_SQ ? 0 : it.still + f.dt;
      }

      // Under the pointer: once a move, and not too often.
      const now = performance.now();
      // (And now and then while a part is held: the page scrolls and the camera moves under a pointer that does not.)
      if ((hand.moves !== picked.moves && now - picked.at >= PICK_MS) || (hovered && now - picked.at >= HELD_MS)) {
        picked.moves = hand.moves;
        picked.at = now;
        hovered = pick(f);
      }
      if (hovered && !ready(hovered, f)) hovered = null;
      const stageKey = hovered?.key ?? null;
      touchFromStage(stageKey);
      const cardKey = f.card ? cardTouch() : null;

      // The hair.
      naming.length = 0;
      for (const it of items) {
        // Under the pointer, that part alone; from the card, every part of its line.
        const active = (it === hovered || it.key === cardKey) && ready(it, f);
        const want = active && !f.reduced ? 1 : 0;
        if (it.still === 0) it.lift = 0;
        else {
          it.lift += (want - it.lift) * (1 - Math.exp(-f.dt * 14));
          if (want === 0 && it.lift < 0.004) it.lift = 0;
        }
        const o = it.object;
        if (it.lift > 0 || it.owned) {
          // As far as reads as a hair at this distance.
          const dist = v.setFromMatrixPosition(o.matrixWorld).distanceTo(f.camera.position);
          const cam = f.camera as THREE.PerspectiveCamera;
          const perPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / f.size.height;
          const unit = v2.setFromMatrixScale(o.parent ? o.parent.matrixWorld : o.matrixWorld).x || 1;
          const hair = THREE.MathUtils.clamp((HAIR_PX * perPx) / unit, HAIR_MIN, HAIR_MAX) * it.lift;
          (it.axis ? it.axis(axis) : axis.copy(UP)).multiplyScalar(hair);
          if (it.owned) {
            o.position.copy(axis);
            for (const w of it.owned) w.position.copy(axis);
          } else o.position.copy(it.base).add(axis);
        }
        if (!it.owned) it.written.copy(o.position);
        // What is named: the one under the pointer; from the card, all of its line together.
        if (active && (stageKey ? it === hovered : true)) naming.push(it);
      }

      // The name, and where the hand's light goes for the card's part.
      touchSpot.on = false;
      const named = naming.length ? naming[0].key : null;
      const count = naming.length;
      let reach = 0;
      if (named) {
        anchor.set(0, 0, 0);
        for (const it of naming) {
          it.object.updateWorldMatrix(true, false);
          anchor.add(v.copy(it.centre).applyMatrix4(it.object.matrixWorld));
        }
        anchor.multiplyScalar(1 / count);
        for (const it of naming) {
          const r = it.radius * v2.setFromMatrixScale(it.object.matrixWorld).x * 0.7;
          reach = Math.max(reach, v.copy(it.centre).applyMatrix4(it.object.matrixWorld).distanceTo(anchor) * 0.5 + r);
        }
        if (named !== stageKey) {
          // Between the part and the eye, and a little above: it rakes, as in the hand.
          v.copy(f.camera.position).sub(anchor).normalize();
          touchSpot.x = anchor.x + v.x * f.hold;
          touchSpot.y = anchor.y + v.y * f.hold + f.hold * 0.35;
          touchSpot.z = anchor.z + v.z * f.hold;
          touchSpot.on = true;
        }
      }
      if (!pill || !wrap) return;
      const show = named !== null && count > 0 && !f.named(named);
      if (show) {
        const label = partLabel(named!);
        if (label !== shownLabel) {
          shownLabel = label;
          pill.textContent = label;
          forgetPillSize(pill);
        }
        v.copy(anchor).project(f.camera);
        if (v.z > 1) pill.dataset.on = "0";
        else {
          const x = (v.x * 0.5 + 0.5) * f.size.width;
          const y = (-v.y * 0.5 + 0.5) * f.size.height;
          wrap.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          pill.dataset.on = "1";
          // A line of several parts (the four encoders) is named over the lot.
          placeTag(pill, f.camera, f.size, anchor, reach, "up", 8);
        }
      } else if (pill.dataset.on !== "0") pill.dataset.on = "0";
    },
  };
}

export type Touch = ReturnType<typeof makeTouch>;
