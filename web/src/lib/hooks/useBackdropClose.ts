"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * A press on a modal's backdrop closes it, and only a press that began there.
 *
 * Drag across the text in the card to select it and let go outside, and the
 * browser still makes a click. Chromium sends it to the element the press and
 * the release share, which is the backdrop. A backdrop that looked only at
 * the click's target closed the window, and a header pasted into To hardware
 * went with it.
 *
 * Spread the result on the backdrop. Where the press began is noted in the
 * capture phase, so a canvas inside that keeps its pointerdown to itself
 * cannot leave an old answer behind. The click has to land on the backdrop
 * itself as well, so a window opened inside another one closes alone.
 */
export function useBackdropClose(onClose: () => void) {
  const pressedHere = useRef(false);
  return {
    onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
      pressedHere.current = event.target === event.currentTarget;
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      const fromBackdrop = pressedHere.current;
      pressedHere.current = false;
      if (fromBackdrop && event.target === event.currentTarget) onClose();
    },
  };
}
