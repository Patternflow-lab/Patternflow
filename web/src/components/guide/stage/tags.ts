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

/** How close to the screen's edge a pill may come, px. */
const EDGE = 8;

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

/** What a knob's pill needs that a port's does not. */
export type TagOpts = {
  /**
   * A second thing the pill must stand clear of on its side: a knob's dial,
   * which is on the case's face while the pill is anchored on the knob's top
   * — seen at an angle the two are a knob's height apart on screen, and a
   * pill placed by the top alone sat on the dial.
   */
  also?: { at: THREE.Vector3; radius: number };
  /**
   * A pill above or below starts at its thing's left edge and grows to the
   * right as its text does (one no wider than the thing stays centred): left
   * of the knobs is the panel, and a readout centred on K4 lay over it.
   */
  growRight?: boolean;
  /**
   * Where a left/right pill goes instead when there is no room for it on its
   * side (a readout beside K1 on a phone), and how many rows out — a row is a
   * pill's height — so it clears the pill that is already above or below.
   */
  alt?: "up" | "down";
  altRow?: number;
};

const c = new THREE.Vector3();

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
  opts?: TagOpts,
) {
  const hw = size.width / 2;
  const hh = size.height / 2;
  a.copy(at).project(camera);
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  b.copy(at).addScaledVector(right, radius).project(camera);
  const rpx = Math.hypot((b.x - a.x) * hw, (b.y - a.y) * hh);
  // How far the thing reaches from the anchor on each side, px: its own radius, and the second thing's where there is one.
  let extL = rpx;
  let extR = rpx;
  let extU = rpx;
  let extD = rpx;
  if (opts?.also) {
    b.copy(opts.also.at).project(camera);
    const dx = (b.x - a.x) * hw;
    const dy = -(b.y - a.y) * hh;
    c.copy(opts.also.at).addScaledVector(right, opts.also.radius).project(camera);
    const r2 = Math.hypot((c.x - b.x) * hw, (c.y - b.y) * hh);
    extL = Math.max(extL, r2 - dx);
    extR = Math.max(extR, r2 + dx);
    extU = Math.max(extU, r2 - dy);
    extD = Math.max(extD, r2 + dy);
  }
  const { w, h } = pillSize(el);
  // Where the point is on screen: the pill is centred on it before the translate.
  const cx = (a.x * 0.5 + 0.5) * size.width;
  const cy = (-a.y * 0.5 + 0.5) * size.height;
  // A pill beside a knob near the edge of a narrow screen ran off it (K3's on
  // a phone). A pill with somewhere else to go (opts.alt) goes there; one
  // without stays on its side, pushed back onto the screen.
  let place: TagSide = side;
  let row = 0;
  if (opts?.alt && w > 0) {
    const fits = side === "right" ? cx + extR + gap + w + EDGE <= size.width : side === "left" ? cx - extL - gap - w - EDGE >= 0 : true;
    if (!fits) {
      place = opts.alt;
      row = opts.altRow ?? 0;
    }
  }
  let near = (place === "right" ? extR : place === "left" ? extL : place === "up" ? extU : extD) + gap;
  if (clear) {
    b.copy(clear).project(camera);
    const d = place === "left" || place === "right" ? Math.abs(b.x - a.x) * hw : Math.abs(b.y - a.y) * hh;
    near = Math.max(near, d + gap);
  }
  let tx = 0;
  let ty = 0;
  if (place === "right") tx = near + w / 2;
  else if (place === "left") tx = -(near + w / 2);
  else {
    ty = (near + h / 2 + row * (h + 4)) * (place === "up" ? -1 : 1);
    if (opts?.growRight && w > extL + extR) tx = w / 2 - extL;
  }
  ty += nudgeY;
  if (w > 0 && size.width > w + 2 * EDGE) {
    tx = Math.min(Math.max(tx, EDGE + w / 2 - cx), size.width - EDGE - w / 2 - cx);
  }
  if (h > 0 && size.height > h + 2 * EDGE) {
    ty = Math.min(Math.max(ty, EDGE + h / 2 - cy), size.height - EDGE - h / 2 - cy);
  }
  el.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
  el.dataset.side = place;
  const lead = near - rpx - 3;
  if (clear && lead > 6) {
    el.dataset.lead = "1";
    el.style.setProperty("--lead", `${lead.toFixed(1)}px`);
  } else if (el.dataset.lead) {
    delete el.dataset.lead;
  }
}
