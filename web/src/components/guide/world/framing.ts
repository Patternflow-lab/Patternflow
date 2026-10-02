// How the stage frames the device on a page: the part of the screen it may
// take, and how far back the camera stands. The stage is one canvas over the
// whole window for every page of the guide (world/GuideWorld); what differs
// from page to page is this, and the camera (GuideCanvas CameraRig) eases
// from one framing to the next.
//
//   a guide   the card's left on a wide screen, above it on a narrow one —
//             measured off the page by the rig (GuideCanvas freeArea), scale 1
//   the hub   above the three choices (hubFraming)
//   Make      no device: it stands far back while the desk is up (AWAY_SCALE)
//
// Pure arithmetic, so it can be tested without a canvas.

/** The free part of the screen, in CSS px. */
export type Free = { l: number; r: number; t: number; b: number };

export type Framing = {
  free: Free;
  /**
   * How much further back than a view's own distance the camera stands
   * (views.ts minR): 1 on a guide. The fit to `free` is unaffected — this
   * only moves the closest the camera comes.
   */
  scale: number;
};

/** Until the hub has measured where its choices start (store.hubTop): Hub.module.css's --hub-top default, 66vh. */
const HUB_TOP_DEFAULT = 0.66;

/**
 * The hub. The device stands alone in the room above the choices, which
 * start `hubTop` px down the screen.
 *
 * On a wide screen the hub's stage used to be a canvas of its own, a box
 * round that room — `99 − hubTop/3` px from the top, `hubTop × 1.667 − 213`
 * tall — and the device stood in it at the view's own distance: from 72 px
 * under the top of the screen to 56 px above the choices. The canvas is the
 * whole window now, so the same picture is asked for in the window's terms:
 * the box as the free area (less the 64 px and 32 px the stage keeps clear
 * at its top and bottom), and the camera further back by the window's height
 * over the box's.
 *
 * On a narrow screen the stage was always the whole screen: the device keeps
 * what the choices leave above them, and never less than 36% of the height.
 */
export function hubFraming(w: number, h: number, hubTop: number, narrow: boolean): Framing {
  const top = hubTop > 0 ? hubTop : h * HUB_TOP_DEFAULT;
  if (narrow) return { free: { l: 12, r: w - 12, t: 56, b: Math.min(h - 12, Math.max(h * 0.36, top - 14)) }, scale: 1 };
  const boxTop = 99 - top / 3;
  const boxH = Math.max(240, top * 1.667 - 213);
  return { free: { l: 24, r: w - 24, t: boxTop + 64, b: boxTop + boxH - 32 }, scale: h / boxH };
}

/** Make: how many times its own distance the device stands back while the desk has the screen. */
export const AWAY_SCALE = 2.6;

/** Make: the device, far back in the middle of the room behind the desk. */
export function awayFraming(w: number, h: number): Framing {
  return { free: { l: 24, r: w - 24, t: 64, b: h - 32 }, scale: AWAY_SCALE };
}
