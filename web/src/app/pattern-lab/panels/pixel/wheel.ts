// ── How far a wheel event went ───────────────────────────────────────────────
// One mouse notch is 100 px in Chromium, or three lines. A trackpad sends the
// same travel as dozens of events a few pixels each, so a zoom that counts
// events races to its end on one swipe. The Pixel viewport and the image
// import both add this distance up instead.

export const WHEEL_NOTCH_PX = 100;

/** The event's vertical travel in pixels, whatever unit it came in. */
export function wheelPixels(event: WheelEvent): number {
  // deltaY first: Firefox reports lines only to a page that asks deltaMode first.
  const dy = event.deltaY;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return (dy * WHEEL_NOTCH_PX) / 3;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return dy * WHEEL_NOTCH_PX;
  return dy;
}
