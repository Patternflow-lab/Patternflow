// The reader's hand on the stage: where the mouse is, for whatever answers it
// — the camera's lean (GuideCanvas CameraRig), the light it carries
// (StageHand.tsx), the hub's panel (world/hubHand.ts), the Build guide's parts
// (build/touch.ts).
//
// Plain numbers, written on pointer events only (StageHand.tsx has the listeners)
// and read from the frame loops, which do their own easing. A mouse, never a
// finger: a touch is a scroll or a knob, there is no hover on a phone, and
// nothing here may move under a thumb. Kept free of three.js so the page's
// own code can read it.

export const hand = {
  /** Across the window, −1 left … 1 right, and −1 top … 1 bottom. */
  x: 0,
  y: 0,
  /** The same place in CSS px. */
  px: 0,
  py: 0,
  /** A mouse is in the window. */
  here: false,
  /** …and on the stage itself: nothing of the page is under it. */
  onStage: false,
  /** Counts the moves: whoever looks for what is under the pointer looks once a move. */
  moves: 0,
};

/** The mouse has gone (left the window, the tab hid) or a finger took over. */
export function handGone() {
  hand.here = false;
  hand.onStage = false;
  hand.moves++;
}

/**
 * How far in front of its subject the hand's light is held, world units, for
 * a camera `r` away from what it is on: close enough that it grazes, and pools.
 */
export function handHold(r: number): number {
  return Math.min(0.9, Math.max(0.2, r * 0.07));
}

/**
 * The DevKit's two buttons under the reader's own finger (Device.tsx takes
 * the press, KitFx.tsx shows it): BOOT and RST go down for as long as the
 * pointer holds them, exactly as the script presses them — the same travel,
 * the same ring, the same tag — and only on the step whose subject they are.
 * Nothing else happens, as nothing else would: the board is out of the case.
 */
export const kitPress = { boot: false, rst: false };
