import * as THREE from "three";

// The little name pills on the stage (K1..K4 beside the knobs, USB / UART /
// BOOT / RST beside the DevKit's ports and buttons) are DOM, drawn by drei's
// <Html> at a point in the scene. A fixed offset in the scene put them on top
// of their knob on a phone and a hand's width away on a desktop close-up, so
// each is anchored on the thing it names and pushed out beside it here, in
// screen pixels: the thing's projected radius plus a fixed gap, whatever the
// zoom. Where something else sits in between (the DevKit's pin header beside
// its buttons), the pill clears that too and a hairline leads back to it.

export type TagSide = "left" | "right" | "up" | "down";

/**
 * For <Html style>: the box drei centres on the point is what a finger hits,
 * even with the pill in it invisible, and it sat over the knobs on a phone.
 * (drei's own `pointerEvents` prop only reaches its `transform` mode.)
 */
export const NO_POINTER = { pointerEvents: "none" } as const;

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const right = new THREE.Vector3();
const sizes = new WeakMap<HTMLElement, { w: number; h: number; at: number }>();

/** Screen y (px, down) of a world point. */
export function screenY(camera: THREE.Camera, size: { height: number }, p: THREE.Vector3) {
  a.copy(p).project(camera);
  return (-a.y * 0.5 + 0.5) * size.height;
}

/** The pill's text changed: measure it again on its next placement. */
export function forgetPillSize(el: HTMLElement) {
  sizes.delete(el);
}

export function pillSize(el: HTMLElement) {
  const now = performance.now();
  let s = sizes.get(el);
  // Measured once it has a size, then now and then (fonts arrive late).
  if (!s || s.w === 0 || now - s.at > 2000) {
    s = { w: el.offsetWidth, h: el.offsetHeight, at: now };
    sizes.set(el, s);
  }
  return s;
}

/**
 * Place a pill beside a world point.
 * @param at      the centre of what it names (world), where its <Html> is anchored
 * @param radius  that thing's radius (world): the pill starts `gap` px past it
 * @param clear   optional world point the pill's near edge must also clear
 *                (plus `gap`); a leader line then runs back to the thing
 * @param nudgeY  px to move it up or down besides (two tags whose things sit
 *                closer together on screen than a pill is tall)
 */
export function placeTag(
  el: HTMLElement,
  camera: THREE.Camera,
  size: { width: number; height: number },
  at: THREE.Vector3,
  radius: number,
  side: TagSide,
  gap = 7,
  clear?: THREE.Vector3,
  nudgeY = 0,
) {
  const hw = size.width / 2;
  const hh = size.height / 2;
  a.copy(at).project(camera);
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  b.copy(at).addScaledVector(right, radius).project(camera);
  const rpx = Math.hypot((b.x - a.x) * hw, (b.y - a.y) * hh);
  let near = rpx + gap;
  if (clear) {
    b.copy(clear).project(camera);
    const d = side === "left" || side === "right" ? Math.abs(b.x - a.x) * hw : Math.abs(b.y - a.y) * hh;
    near = Math.max(near, d + gap);
  }
  const { w, h } = pillSize(el);
  let tx = 0;
  let ty = 0;
  if (side === "right") tx = near + w / 2;
  else if (side === "left") tx = -(near + w / 2);
  else if (side === "up") ty = -(near + h / 2);
  else ty = near + h / 2;
  ty += nudgeY;
  el.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
  el.dataset.side = side;
  const lead = near - rpx - 3;
  if (clear && lead > 6) {
    el.dataset.lead = "1";
    el.style.setProperty("--lead", `${lead.toFixed(1)}px`);
  } else if (el.dataset.lead) {
    delete el.dataset.lead;
  }
}
